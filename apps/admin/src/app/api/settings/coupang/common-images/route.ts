import { NextResponse } from "next/server";
import { uploadPublicImage } from "@/lib/image-storage";

/**
 * Sprint A-11(작업3 — CPO 지시: "상세페이지 공통 이미지(상단/하단), Settings
 * 업로드+ON/OFF") — 파일을 Supabase Storage(product-images 버킷, 기존
 * uploadPublicImage 재사용)에 올리고 공개 URL만 돌려준다. 프로필 저장 자체는
 * 하지 않는다 — Settings 페이지가 이 URL을 받아 다른 필드들과 함께 기존
 * /api/settings/coupang/profiles 저장 흐름에 그대로 태운다(판매자 프로필을
 * 쓰는 곳이 한 곳으로 유지돼야 CP001류 불일치가 안 생긴다).
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
