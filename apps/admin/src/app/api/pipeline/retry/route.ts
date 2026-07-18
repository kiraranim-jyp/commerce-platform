import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ImageType } from "@commerce/shared";
import {
  ImglyRemoverProvider,
  SharpEnhancerProvider,
  SharpOptimizerProvider,
  processSingleProductImage,
  processSingleStandardImage,
  storagePaths,
  type ProcessedImageFile,
} from "@commerce/image";
import type { WorkspaceItem } from "../response.types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 이미지 1장만 다시 처리한다. 메인 파이프라인(/api/pipeline)은 요청 시작 시
 * 이전 요청의 storage를 통째로 지우고, Vercel 서버리스 함수는 /tmp가 인스턴스
 * 간에 공유된다는 보장이 없다 — 그래서 "실패한 이미지 재실행"은 원본 요청의
 * 서버 쪽 상태에 절대 의존할 수 없다. 대신 클라이언트가 이미 갖고 있는 원본
 * dataUrl을 그대로 다시 보내고, 이 라우트는 그것만으로 배경제거~압축까지
 * 완전히 새로 처리한다. (나중에 상태를 갖는 방식으로 "고치지" 말 것 — 이건
 * 의도된 설계다.)
 */

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], "base64"), mime: match[1] };
}

function pickPreferredFile(
  files: ProcessedImageFile[],
  type: ImageType,
): ProcessedImageFile | undefined {
  const preferredExt = type === "PRODUCT" ? "png" : "jpg";
  return files.find((f) => f.format === preferredExt) ?? files[0];
}

function toDataUrl(filePath: string, mime: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST(request: Request) {
  const { dataUrl, fileName, type } = (await request.json()) as {
    dataUrl?: string;
    fileName?: string;
    type?: ImageType;
  };

  if (!dataUrl || !fileName || !type) {
    return NextResponse.json({ error: "dataUrl, fileName, type이 필요합니다." }, { status: 400 });
  }
  // 파이프라인 본류에서도 PRODUCT/MODEL/DETAIL/SIZE_CHART만 실제로 가공한다
  // (PACKAGE/LOGO/BANNER/UNKNOWN은 분류만 되고 처리 단계를 거치지 않으므로 재실행 대상이 아니다).
  const STANDARD_TYPES = ["MODEL", "DETAIL", "SIZE_CHART"] as const;
  if (type !== "PRODUCT" && !STANDARD_TYPES.includes(type as (typeof STANDARD_TYPES)[number])) {
    return NextResponse.json({ error: `재실행할 수 없는 타입입니다: ${type}` }, { status: 400 });
  }

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    return NextResponse.json({ error: "dataUrl 형식이 올바르지 않습니다." }, { status: 400 });
  }

  fs.mkdirSync(storagePaths.tmp, { recursive: true });
  const sourcePath = path.join(storagePaths.tmp, `retry-${fileName}`);
  fs.writeFileSync(sourcePath, decoded.buffer);

  try {
    const enhancer = new SharpEnhancerProvider();
    const optimizer = new SharpOptimizerProvider();

    const processed =
      type === "PRODUCT"
        ? await processSingleProductImage(sourcePath, {
            backgroundRemover: new ImglyRemoverProvider(),
            enhancer,
            optimizer,
          })
        : await processSingleStandardImage(
            sourcePath,
            type as (typeof STANDARD_TYPES)[number],
            { enhancer, optimizer },
            { preEnhance: false },
          );

    const preferred =
      processed.status === "success" ? pickPreferredFile(processed.files, type) : undefined;
    const detailDataUrl = preferred
      ? toDataUrl(preferred.file, MIME_BY_FORMAT[preferred.format] ?? "image/jpeg")
      : null;

    const item: WorkspaceItem = {
      // processed.baseName은 임시 소스 파일명("retry-0002")에서 나온 것이라 원래 카드의
      // id("0002")와 다르다 — 프론트가 items 배열에서 같은 id를 찾아 교체할 수 있도록
      // 요청받은 fileName 기준으로 되돌려서 id를 만든다.
      id: path.parse(fileName).name,
      fileName,
      type,
      status: processed.status,
      failureReason: processed.failureReason,
      originalDataUrl: dataUrl,
      originalWidth: processed.original.width,
      originalHeight: processed.original.height,
      originalBytes: processed.original.bytes,
      detailDataUrl,
      outputWidth: processed.output?.width,
      outputHeight: processed.output?.height,
      fileSize: preferred?.bytes,
      isRepresentative: false,
    };

    return NextResponse.json({ item });
  } catch (error) {
    // processSingle*Image는 내부적으로 실패를 status:"failed"로 감싸서 돌려주지만,
    // 그 함수에 들어가기도 전에 문제가 생기는 경우(예: 이 파일 자체가 손상됐다고
    // sharp가 즉시 던지는 경우)를 대비한 안전망이다 — 이게 없으면 카드가 "Failed"로
    // 갱신되는 대신 fetch 자체가 500으로 죽어서 프론트에 훨씬 불친절하게 보인다.
    console.error("[pipeline/retry] 실행 실패", error);
    const item: WorkspaceItem = {
      id: path.parse(fileName).name,
      fileName,
      type,
      status: "failed",
      failureReason: error instanceof Error ? error.message : String(error),
      originalDataUrl: dataUrl,
      originalWidth: 0,
      originalHeight: 0,
      originalBytes: 0,
      detailDataUrl: null,
      isRepresentative: false,
    };
    return NextResponse.json({ item });
  } finally {
    fs.rmSync(sourcePath, { force: true });
  }
}
