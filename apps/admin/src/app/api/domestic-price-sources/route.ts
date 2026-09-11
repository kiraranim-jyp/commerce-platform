import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createDomesticPriceSource, listDomesticPriceSources } from "./_lib/domestic-price-source";

/** GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 편집샵 목록은 공용 카탈로그이지만
 * ON/OFF는 판매자별이다. 어떤 워크스페이스로 보는지는 requireUser()만 정한다 —
 * 요청 body/query의 workspaceId는 권한 근거가 아니다(require-user.ts §5/§13). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const sources = await listDomesticPriceSources(auth.user.workspaceId);
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        url?: string;
        name?: string;
        categoryScope?: string[];
        priority?: "P0" | "P1" | "P2";
        collectionStrategy?: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
      }
    | null;
  if (!body?.url) {
    return NextResponse.json({ ok: false, error: "URL이 필요합니다." }, { status: 400 });
  }
  const result = await createDomesticPriceSource({ ...body, url: body.url });
  return NextResponse.json(result);
}
