import { universalExtract } from "@commerce/crawler";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await universalExtract(url, { debug: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[extractor-test] 실행 실패", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 },
    );
  }
}
