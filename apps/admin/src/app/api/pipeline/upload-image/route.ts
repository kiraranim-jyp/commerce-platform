import { NextResponse } from "next/server";
import { uploadPublicImage } from "@/lib/image-storage";

/**
 * CEO 지시(2026-08-24, CPO 부재중): "각 커머스별 이미지는 제거하고 공통인
 * 상품정보에서만 관리 — 신규 이미지를 추가할 수 있게" — 크롤링으로 못 가져온
 * 이미지(예: 판매자가 직접 찍은 사진)를 상품정보 탭에서 바로 추가할 때 쓴다.
 * Settings 공통 이미지 업로드(/api/settings/coupang/common-images)와 같은
 * uploadPublicImage()를 그대로 재사용한다 — 별도 버킷/로직을 새로 만들지 않는다.
 */
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadPublicImage(buffer, file.name, file.type);
  if (!url) {
    return NextResponse.json({ ok: false, error: "업로드에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url });
}
