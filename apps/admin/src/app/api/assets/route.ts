import { NextResponse } from "next/server";
import { createAsset, listAssets } from "./_lib/asset";

export async function GET(request: Request) {
  const tag = new URL(request.url).searchParams.get("tag") ?? undefined;
  const assets = await listAssets(tag);
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  const tagsRaw = formData?.get("tags");
  const tags =
    typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const result = await createAsset(file, tags);
  return NextResponse.json(result);
}
