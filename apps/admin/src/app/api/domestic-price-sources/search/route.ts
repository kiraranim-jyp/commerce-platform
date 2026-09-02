import {
  compareModelCode,
  deriveMatchTruth,
  extractForeignModelCode,
  fetchDomesticModelCode,
  searchDomesticShops,
  supportsDomesticIdentifierExtraction,
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
 * 전용 실시간 조회)이므로 독립적으로 matchTruth만 계산해서 얹는다.
 *
 * P-28(CPO 지시, 2026-09-03) — modelCode 추출을 foretforet.com 하드코딩에서
 * fetchDomesticModelCode 레지스트리(도메인 → 추출기)로 일반화했다. 실측(Curious
 * Turnip All Over Swim Cap by Bobo Choses): 해외 "Product code B126AI018" ↔
 * 국내 bobochoses.com 공식몰(b126ai018-...) 코드가 실제로 일치하는데도, 이
 * 라우트가 foretforet.com 외 도메인은 항상 compareModelCode(x, null)="unavailable"
 * 로 고정해서 EXACT 등급에 절대 도달할 수 없었다 — run-domestic-price-check.ts와
 * 같은 레지스트리를 재사용해 화면(이 라우트가 데이터 원천인 "국내 가격비교" UI)과
 * 자동 확인 파이프라인의 판정이 항상 일치하게 한다(단일 소스). */
const MAX_MODEL_CODE_FETCH_PER_SHOP = 3;

async function attachMatchTruth(
  results: ComparisonSearchResult[],
  foreignModelCode: string | null,
): Promise<ComparisonSearchResult[]> {
  return Promise.all(
    results.map(async (result) => {
      if (result.status !== "ok" || result.candidates.length === 0) return result;
      // 국내측 modelCode 추출기가 없는 도메인은 fetchModelCode 자체가 없으므로
      // compareModelCode(x, null)="unavailable"이 되고, deriveMatchTruth가 이를
      // 정직하게 TEXT_CONFIRMED/SIMILAR로 처리한다 — "식별자가 없다"를 "다른
      // 상품이다"로 지어내지 않는다.
      if (!supportsDomesticIdentifierExtraction(result.domain)) {
        const candidates = result.candidates.map((c) => ({
          ...c,
          matchTruth: c.matchLevel ? deriveMatchTruth(c.matchLevel, compareModelCode(foreignModelCode, null)) : undefined,
        }));
        return { ...result, candidates };
      }
      // 상위 N개까지만 실제 추출 시도(비용 제한, run-domestic-price-check.ts의
      // MAX_EVIDENCE_CANDIDATES와 같은 원칙) — 나머지는 modelCode 비교 없이 텍스트
      // 등급만으로 matchTruth를 매긴다(추측 금지 — 추출 안 한 건 "확인 안 함"이지
      // "충돌"이 아니다).
      const candidates = await Promise.all(
        result.candidates.map(async (c, i) => {
          if (!c.matchLevel) return c;
          const domesticModelCode =
            i < MAX_MODEL_CODE_FETCH_PER_SHOP ? await fetchDomesticModelCode(result.domain, c.url) : null;
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
