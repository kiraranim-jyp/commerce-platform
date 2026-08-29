import {
  compareModelCode,
  deriveMatchTruth,
  extractForeignModelCode,
  fetchForetforetModelCode,
  searchDomesticShops,
  type ComparisonSearchResult,
} from "@commerce/crawler";
import { NextResponse } from "next/server";
import { listDomesticPriceSources } from "../_lib/domestic-price-source";

/** N-4.07(대표님 지시: "국내 키즈의류 수입아동복 편집샵 사이트를 기본 등록해서 비교해줘") —
 * /api/comparison/search(해외)와 같은 계약, listDomesticPriceSources()의 활성(enabled &&
 * status=ACTIVE) 소스만 대상으로 검색한다.
 *
 * P-7-B(CPO 지시, 2026-08-29) — 실측 골든케이스(Pepe Shoes "Lulu T-Bar Shoes in
 * Vernice Nero"): 이 라우트가 셀러가 실제로 보는 "국내 가격비교" 화면의 데이터
 * 원천인데, 지금까지 modelCode 증거(compareModelCode/decideCandidateEvidence,
 * run-domestic-price-check.ts에는 이미 있었다)를 전혀 쓰지 않고 matchLevel/confidence
 * 만으로 배지를 매겼다 — 그래서 진짜 동일상품(포레포레 PP24KASHE1195NER, 71%)과
 * 실제로는 다른 상품(듀베베 72%)이 화면에서 똑같은 "유사상품" 배지로 구분 없이
 * 보였다. run-domestic-price-check.ts의 자동확정 로직(decideCandidateEvidence)은
 * 건드리지 않는다 — 이 라우트는 그 파이프라인과 완전히 별개(캐시/DB 미저장, 읽기
 * 전용 실시간 조회)이므로 독립적으로 matchTruth만 계산해서 얹는다. */
const MAX_MODEL_CODE_FETCH_PER_SHOP = 3;

async function attachMatchTruth(
  results: ComparisonSearchResult[],
  foreignModelCode: string | null,
): Promise<ComparisonSearchResult[]> {
  return Promise.all(
    results.map(async (result) => {
      if (result.status !== "ok" || result.candidates.length === 0) return result;
      // FORETFORET만 modelCode 추출 기능이 있다(N-4.18-Q3 H-3-2, 실측 확인). 다른
      // 사이트는 fetchModelCode가 없으므로 compareModelCode(x, null)="unavailable"이
      // 되고, deriveMatchTruth가 이를 정직하게 TEXT_CONFIRMED/SIMILAR로 처리한다 —
      // "식별자가 없다"를 "다른 상품이다"로 지어내지 않는다.
      if (result.domain !== "foretforet.com") {
        const candidates = result.candidates.map((c) => ({
          ...c,
          matchTruth: c.matchLevel ? deriveMatchTruth(c.matchLevel, compareModelCode(foreignModelCode, null)) : undefined,
        }));
        return { ...result, candidates };
      }
      // 상위 N개까지만 실제 HTTP fetch(비용 제한, run-domestic-price-check.ts의
      // MAX_EVIDENCE_CANDIDATES와 같은 원칙) — 나머지는 modelCode 비교 없이 텍스트
      // 등급만으로 matchTruth를 매긴다(추측 금지 — fetch 안 한 건 "확인 안 함"이지
      // "충돌"이 아니다).
      const candidates = await Promise.all(
        result.candidates.map(async (c, i) => {
          if (!c.matchLevel) return c;
          const domesticModelCode = i < MAX_MODEL_CODE_FETCH_PER_SHOP ? await fetchForetforetModelCode(c.url) : null;
          const modelCodeEvidence = compareModelCode(foreignModelCode, domesticModelCode);
          return { ...c, matchTruth: deriveMatchTruth(c.matchLevel, modelCodeEvidence) };
        }),
      );
      return { ...result, candidates };
    }),
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; brand?: string; sourceUrl?: string; sku?: string; description?: string }
    | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  const sources = (await listDomesticPriceSources()).filter((s) => s.enabled && s.status === "ACTIVE");
  const rawResults = await searchDomesticShops(
    { title: body.title, brand: body.brand, sourceUrl: body.sourceUrl, sku: body.sku },
    sources.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
  );
  const foreignModelCode = extractForeignModelCode(body.description);
  const results = await attachMatchTruth(rawResults, foreignModelCode);

  return NextResponse.json({ ok: true, results });
}
