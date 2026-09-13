import {
  compareModelCode,
  deriveMatchTruth,
  extractForeignModelCode,
  fetchDomesticModelCode,
  searchDomesticShops,
  supportsDomesticIdentifierExtraction,
  type ComparisonSearchResult,
} from "@commerce/crawler";
import { sourceFitsScopes } from "@commerce/category";
import {
  buildCrossSellerSearchQueries,
  identityDnaFromFields,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { resolveCategoryScopes } from "../_lib/category-scope";
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

/** 원본 URL 자체에서 모델코드를 뽑는다 — 설명문에 코드 표기가 없는 자사몰용
 * 폴백이다. 국내 후보에 쓰는 레지스트리를 그대로 재사용하므로, 지원 도메인이
 * 늘어나면 이 경로도 함께 늘어난다(도메인 분기를 여기에 만들지 않는다). */
async function extractModelCodeFromSourceUrl(sourceUrl: string | undefined): Promise<string | null> {
  if (!sourceUrl) return null;
  let domain: string;
  try {
    domain = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!supportsDomesticIdentifierExtraction(domain)) return null;
  return fetchDomesticModelCode(domain, sourceUrl).catch(() => null);
}

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
          matchTruth: c.matchLevel
            ? deriveMatchTruth(c.matchLevel, compareModelCode(foreignModelCode, null), c.crossSellerVerdict)
            : undefined,
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
          return { ...c, matchTruth: deriveMatchTruth(c.matchLevel, modelCodeEvidence, c.crossSellerVerdict) };
        }),
      );
      return { ...result, candidates };
    }),
  );
}

/**
 * MI-DOMESTIC-FIX-1 §6(CPO 지시, 2026-09-09) — "국내에 정말 없는 것"과
 * "검색은 됐는데 매칭에서 다 떨어진 것"을 구분할 수 있게 하는 최소 계측.
 *
 * 지금까지 API 응답에는 원시 검색 결과 수가 없어서, 0건 화면을 보고도 둘 중
 * 어느 쪽인지 판단할 방법이 아예 없었다. 요청당 정확히 한 줄만 남긴다 —
 * 후보별 로그를 남기면 Production 로그가 감당이 안 된다.
 *
 * 검색어는 길이를 잘라서 남기고(상품명 전문을 로그에 쌓지 않는다), 후보 URL·
 * 상품명·upstream 원본 응답은 남기지 않는다.
 */
const DEBUG_QUERY_MAX_LEN = 80;

function logDomesticFunnel(
  searchTerm: string,
  rawResults: { candidates?: unknown[] }[],
  results: { candidates?: { price?: unknown; soldOut?: boolean | null; matchTruth?: string }[] }[],
) {
  const all = results.flatMap((r) => r.candidates ?? []);
  const truth = (t: string) => all.filter((c) => c.matchTruth === t).length;
  console.log("[MI-domestic-debug]", {
    query: searchTerm.slice(0, DEBUG_QUERY_MAX_LEN),
    queryLen: searchTerm.length,
    shops: rawResults.length,
    rawResults: rawResults.reduce((n, r) => n + (r.candidates?.length ?? 0), 0),
    candidateResults: all.length,
    priceAvailable: all.filter((c) => c.price != null).length,
    // 재고 3분류는 반드시 따로 센다 — soldOut=null(확인 불가)이 판매중으로
    // 뭉뚱그려지면 §4에서 요구한 재고불명 현황 파악이 불가능해진다.
    stockOnSale: all.filter((c) => c.soldOut === false).length,
    stockSoldOut: all.filter((c) => c.soldOut === true).length,
    stockUnknown: all.filter((c) => c.soldOut == null).length,
    exact: truth("EXACT_IDENTIFIER") + truth("STRONG_IDENTIFIER"),
    textConfirmed: truth("TEXT_CONFIRMED"),
    similar: truth("SIMILAR"),
    conflict: truth("CONFLICT"),
    insufficientEvidence: truth("INSUFFICIENT_EVIDENCE"),
  });
}

export async function POST(request: Request) {
  // GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 이 라우트가 셀러 화면의 데이터
  // 원천이므로, 판매자가 자기 목록에서 끈 편집샵은 여기서도 검색되면 안 된다
  // (끈 이유가 "이 샵 결과는 내 판단에 방해가 된다"인데 화면엔 그대로 뜨면
  // 껐다는 사실 자체가 거짓말이 된다). 어느 워크스페이스인지는 requireUser()만
  // 정한다 — 크롤러 요청을 실제로 발생시키는 경로라 인증 없이 열어두지 않는다.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        brand?: string;
        sourceUrl?: string;
        sku?: string;
        description?: string;
        /** MATCHING-2.0-CORE — 화면이 이미 갖고 있던 값. 보내주면 색상/소재 축이
         * 살아나고, 안 보내주면 예전과 똑같이 동작한다. */
        color?: string;
        material?: string;
      }
    | null;
  if (!body?.title) {
    return NextResponse.json({ ok: false, error: "title이 필요합니다." }, { status: 400 });
  }

  // s.enabled는 이미 "카탈로그 ON && 이 판매자 ON"으로 합쳐진 실효값이다
  // (listDomesticPriceSources 주석) — 여기서 두 플래그를 다시 AND하지 않는다.
  //
  // TTAEJYO 2.0(CEO 지시, 2026-09-12) — 여기에 카테고리 적합도를 하나 더 건다.
  // 노출 모델(카탈로그 ON && 판매자 ON)은 그대로다. 세 번째 조건이 아니라
  // **그 위에 얹는 필터**라 판매자가 켜 둔 샵을 우리가 몰래 끄지 않는다:
  // 카테고리를 못 정하면(null) 필터 자체가 걸리지 않고, category_scope를
  // 주장하지 않은 소스(빈 배열)는 언제나 통과한다(sourceFitsScopes 주석).
  const categoryScopes = resolveCategoryScopes({
    title: body.title,
    description: body.description,
    brand: body.brand,
    sourceUrl: body.sourceUrl,
  });
  const sources = (await listDomesticPriceSources(auth.user.workspaceId)).filter(
    (s) => s.enabled && s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, categoryScopes),
  );

  // MI-DOMESTIC-FIX-1(CPO 지시, 2026-09-09) — 여기가 buildDomesticShopQuery를
  // 우회하던 자리다. searchTerm을 비워두면 크롤러가 query.title로 폴백해서
  // "Stella McCartney Kids Girls Black Cotton Halloween Logo Sweatshirt" 같은
  // 원제목이 그대로 국내 편집샵 검색창에 들어갔고, 검색어가 길면 0건이 되는
  // 것은 이미 실측으로 확인된 동작이었다(product-identity-dna.ts 주석 참고).
  // 배치 경로와 같은 검색어 정책을 쓰도록 잇기만 한다 — title은 그대로 넘겨
  // 매칭 스코어링 신호로는 계속 쓰인다(검색어는 좁게, 매칭 신호는 넓게).
  //
  // MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 검색어를 하나만 만들던 것을 여러
  // 개로 넓힌다. "브랜드 + 명사 하나"는 그 브랜드의 같은 유형 상품을 전부 끌고
  // 오고, 판매처별 상위 5건 한도 때문에 정작 목표 상품이 후보에 들지 못한다.
  // buildCrossSellerSearchQueries는 좁은 말부터 넓은 말 순서로 돌려주고,
  // 크롤러가 결과가 나오는 첫 검색어에서 멈춘다. searchTerm은 그대로 넘겨
  // 이 목록을 모르는 경로(하위호환)가 예전처럼 동작하게 둔다.
  const dna = identityDnaFromFields({
    title: body.title,
    brand: body.brand,
    sku: body.sku,
    sourceUrl: body.sourceUrl,
    color: body.color,
    material: body.material,
    description: body.description,
  });
  /**
   * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **다른 판매자의 검색창에
   * 이 판매자의 재고번호를 넣지 않는다.**
   *
   * 이 줄은 buildDomesticShopQuery(dna)였고, tier가 SKU인 상품에서 그 값은
   * 판매처 자신의 재고번호다(Smallable AAA1804922). searchTerms를 모르는
   * 하위호환 분기가 폴백으로 쓰는 자리라, 그 번호가 그대로 Bobo 공식몰로 나가는
   * — 언제나 0건인 — 말이 장전돼 있었다. 저장 경로(run-domestic-price-check)와
   * **같은 값**을 쓴다: 사다리의 첫 칸. 두 경로가 다른 폴백 정책을 갖지 않는다.
   */
  const searchTerms = buildCrossSellerSearchQueries(dna);
  const searchTerm = searchTerms[0] ?? body.title;
  const rawResults = await searchDomesticShops(
    {
      title: body.title,
      brand: body.brand,
      sourceUrl: body.sourceUrl,
      sku: body.sku,
      description: body.description,
      searchTerm,
      searchTerms,
      facts: productFactsFromIdentityDna(dna),
    },
    sources.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
  );
  // P-10-F(CEO 승인, 2026-09-11) — 원본 코드를 설명문에서만 찾던 것을 넓힌다.
  //
  // 실측(Bobo Choses, 대표님 제보): 원본 URL이
  // /en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt 인데 자사몰
  // 설명문에는 "Product code" 표기가 없다(그 표기는 Junior Edition 같은 편집샵이
  // 쓴다). 그래서 foreignModelCode가 null이 되고, compareModelCode(null, x)는
  // "unavailable"이라 국내 후보가 코드를 갖고 있어도 비교조차 못 했다 — 색상만
  // 다른 B226AC042가 정답 B226AC043과 같은 등급으로 나온 이유다.
  //
  // 코드는 그 URL 안에 이미 있었다. 국내 후보 URL을 파싱하는 바로 그 레지스트리가
  // 원본 URL에도 그대로 통한다. 새 추출기를 만들지 않고 있는 것을 재사용한다.
  const foreignModelCode =
    extractForeignModelCode(body.description) ?? (await extractModelCodeFromSourceUrl(body.sourceUrl));
  const results = await attachMatchTruth(rawResults, foreignModelCode);

  logDomesticFunnel(searchTerm, rawResults, results);

  return NextResponse.json({ ok: true, results });
}
