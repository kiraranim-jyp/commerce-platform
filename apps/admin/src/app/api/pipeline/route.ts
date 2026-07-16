import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { extractProductImages } from "@commerce/crawler";
import {
  CompositeClassifierProvider,
  GeminiClassifierProvider,
  ImglyRemoverProvider,
  ResolutionThumbnailSelector,
  RuleBaseClassifierProvider,
  SharpEnhancerProvider,
  SharpOptimizerProvider,
  runImagePipeline,
  storagePaths,
} from "@commerce/image";

export const runtime = "nodejs";
export const maxDuration = 300;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  // IMAGE_STORAGE_ROOT / IMAGE_LOGS_ROOT는 배포 환경변수로 /tmp 하위에 고정되어 있다
  // (Vercel 서버리스 함수는 /tmp 외 파일시스템이 읽기 전용이라, 모듈 로드 시점에
  // 경로가 확정되는 storagePaths/PipelineLogger는 요청 중에 바꿀 수 없다).
  // 이전 요청의 잔여물이 남아있지 않도록 시작 시점에 정리한다.
  fs.rmSync(storagePaths.root, { recursive: true, force: true });
  fs.rmSync(process.env.IMAGE_LOGS_ROOT ?? "logs", { recursive: true, force: true });

  try {
    const images = await extractProductImages(url);
    if (images.length === 0) {
      return NextResponse.json({ error: "이미지를 찾지 못했습니다." }, { status: 422 });
    }

    const result = await runImagePipeline(url, url, images, {
      classifier: new CompositeClassifierProvider(
        new GeminiClassifierProvider(),
        new RuleBaseClassifierProvider(),
      ),
      backgroundRemover: new ImglyRemoverProvider(),
      enhancer: new SharpEnhancerProvider(),
      optimizer: new SharpOptimizerProvider(),
      thumbnailSelector: new ResolutionThumbnailSelector(),
    });

    const toDataUrl = (fileName: string): string | null => {
      const ext = path.extname(fileName).replace(".", "").toLowerCase();
      const format = ext === "jpeg" ? "jpg" : ext;
      if (!(format in MIME_BY_EXT)) return null;

      const filePath = path.join(
        storagePaths.optimized(format as "jpg" | "png" | "webp"),
        fileName,
      );
      if (!fs.existsSync(filePath)) return null;

      const buffer = fs.readFileSync(filePath);
      return `data:${MIME_BY_EXT[format]};base64,${buffer.toString("base64")}`;
    };

    const withDataUrls = (fileNames: string[]) =>
      fileNames
        .map((fileName) => ({ fileName, dataUrl: toDataUrl(fileName) }))
        .filter((item): item is { fileName: string; dataUrl: string } => item.dataUrl !== null);

    // 같은 사진이 jpg/png/webp 여러 포맷으로 생성되므로, 화면에는 사진 1장당
    // 대표 포맷 하나만 보여준다 (실제 파일은 optimized/{jpg,png,webp}/에 전부 남아있다).
    const pickOnePerPhoto = (fileNames: string[], preferredExt: "png" | "jpg"): string[] => {
      const byBaseName = new Map<string, string[]>();
      for (const fileName of fileNames) {
        const base = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, "");
        byBaseName.set(base, [...(byBaseName.get(base) ?? []), fileName]);
      }
      return [...byBaseName.values()].map(
        (variants) => variants.find((name) => name.endsWith(`.${preferredExt}`)) ?? variants[0],
      );
    };

    // PRODUCT는 누끼 결과를 보여주기 위해 PNG(투명배경)를 우선한다.
    const productPreview = pickOnePerPhoto(result.metadata.productImages, "png");
    const detailPreview = [
      ...pickOnePerPhoto(result.metadata.detailImages, "jpg"),
      ...pickOnePerPhoto(result.metadata.modelImages, "jpg"),
      ...pickOnePerPhoto(result.metadata.sizeChart, "jpg"),
    ];

    const [thumbnailFileName, ...restProductPreview] = productPreview;

    return NextResponse.json({
      metadata: result.metadata,
      thumbnail: thumbnailFileName
        ? toDataUrl(thumbnailFileName)
        : toDataUrl(result.metadata.thumbnail),
      detailImages: withDataUrls([...restProductPreview, ...detailPreview]),
      storageNote:
        "이미지는 서버리스 함수의 임시 저장소(/tmp)에만 저장되며 다음 요청 시 자동 삭제됩니다. " +
        "영구 저장이 필요하면 Supabase Storage 등 별도 연동이 필요합니다.",
    });
  } catch (error) {
    console.error("[pipeline] 실행 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 },
    );
  }
}
