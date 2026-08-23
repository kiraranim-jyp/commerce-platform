import { searchDomesticShops } from "@commerce/crawler";
import { NextResponse } from "next/server";
import { listDomesticPriceSources } from "../_lib/domestic-price-source";

/** N-4.07(대표님 지시: "국내 키즈의류 수입아동복 편집샵 사이트를 기본 등록해서 비교해줘") —
 * /api/comparison/search(해외)와 같은 계약, listDomesticPriceSources()의 활성(enabled &&
 * status=ACTIVE) 소스만 대상으로 검색한다. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; brand?: string; sourceUrl?: string; sku?: string }
    | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  const sources = (await listDomesticPriceSources()).filter((s) => s.enabled && s.status === "ACTIVE");
  const results = await searchDomesticShops(
    { title: body.title, brand: body.brand, sourceUrl: body.sourceUrl, sku: body.sku },
    sources.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
  );

  return NextResponse.json({ ok: true, results });
}
