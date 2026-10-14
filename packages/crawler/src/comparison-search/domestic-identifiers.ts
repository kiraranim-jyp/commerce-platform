import { fetchForetforetModelCode } from "./foretforet";

/**
 * P-28(CPO 지시, 2026-09-03) — "국내 동일상품 매칭 엔진의 도메인별 식별자
 * 검증 커버리지 누락"을 고친다. 실측(Curious Turnip All Over Swim Cap by
 * Bobo Choses): 해외 원문에 "Product code B126AI018", 국내 bobochoses.com
 * 공식몰에도 동일 코드(b126ai018)가 실제로 존재하는데, fetchForetforetModelCode
 * 하나만 foretforet.com에 하드코딩돼 있어서 다른 도메인은 애초에 코드를
 * 비교해볼 기회조차 없었다(compareModelCode(x, null)="unavailable" 고정).
 * compareModelCode/deriveMatchTruth/priceTierFromLink는 이미 완전히
 * 도메인-무관(pure) 함수이므로, 여기서는 "도메인 → 국내 식별자 추출기"
 * 레지스트리 하나만 추가한다 — 매칭 판정 기준(LCS≥4, EXACT_IDENTIFIER 승격
 * 조건 등)은 전혀 건드리지 않는다.
 */

/** Bobo Choses Korea 공식(bobochoses.com)은 Shopify product handle이 항상
 * "{브랜드 모델코드}-{slug}" 형식이다(실측 10건 이상: b226ac010-booty-ghosts-
 * t-shirt, b126ai018-curious-turnip-all-over-swim-cap, b126ac155-color-
 * herbalist-all-over-leggings 등). 이 코드 형식(문자 1개+숫자 3개+문자 2개+
 * 숫자 3개, 예: B126AI018)은 해외(Junior Edition) 설명문의
 * "Product code B226AC010" 표기와 완전히 동일한 패턴이다 — 별도 HTTP fetch
 * 없이 URL만으로 안전하게 추출할 수 있다(product.json의 variants[].sku도
 * 같은 코드를 접두사로 포함하지만 사이즈별 접미사가 붙어있어서(실측:
 * "B126AI01831152") handle 쪽이 접미사 없이 더 깨끗하다). */
const BOBOCHOSES_HANDLE_CODE_RE = /^([a-z]\d{3}[a-z]{2}\d{3})-/i;

export function extractBobochosesModelCode(url: string): string | null {
  let handle: string;
  try {
    handle = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return null;
  }
  const match = BOBOCHOSES_HANDLE_CODE_RE.exec(handle);
  return match ? match[1].toUpperCase() : null;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.2 Step 1(CPO 지시, 2026-10-07) — **품번을 «추출» 하지 않는다.
 * 이미 확정된 품번이 국내 제목에 있는지 «확인» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 위 추출기 레지스트리는 도메인마다 「이 사이트는 품번을 어디에 적는가」를 알아야
 * 한다. 그런데 실측(2026-10-07)에서 두 판매처가 품번을 **상품명에 그대로** 적고
 * 있었고, 그 자리는 `sellerSku` 칸도 URL 앞머리도 아니었다:
 *
 *   deuxbebe    `AW26MS185 - Bubble Sweatshirt - Fern Green`        품번이 첫 토큰
 *   littleluna  `[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange`
 *   foretforet  `AW26 2차[메인스토리]멜란지 …-MA26KASST0577356`      자체코드만
 *
 * 🔴 `productFactsFromListing` 이 `brandModelCode: null` 을 하드코딩한 것은 옳다 —
 *    포레포레 `MA26KASST0577356` 를 품번 칸에 넣으면 compareModelCode 가 접두사부터
 *    갈라져 「모델코드 충돌」을 **지어낸다**(seller-facts.ts 주석). 이 함수는 그
 *    위험의 «반대 방향» 이다.
 *
 * 왜 오염되지 않는가 — 구조가 보장한다:
 *   ① 해외에서 **이미 확정된** 문자열만 받는다. 국내에서 품번을 새로 추측하지 않는다.
 *   ② 돌려주는 값은 `foreignCode` 그 자체 아니면 `null` «둘뿐» 이다. 그래서
 *      `compareModelCode` 는 `exact` 아니면 `unavailable` 밖에 낼 수 없다 —
 *      🔴 `partial` 도 `conflict` 도 **구조적으로 만들 수 없다.**
 *   ③ 판매처 자체코드는 해외 품번과 같을 수 없으므로 절대 채택되지 않는다.
 *
 * 🔴 **토큰 «전체» 가 같아야 한다.** 부분 일치를 허용하면 안 되는 이유가 실측에
 *    있다 — Mini Rodini 품번 `2672014894` 는 순수 숫자 10자리다. 문자열 포함으로
 *    재면 국내 목록의 가격·상품번호 같은 숫자열에 우연히 걸린다. 그래서 제목을
 *    영숫자 아닌 모든 문자로 쪼갠 뒤 **한 토큰이 품번과 완전히 같을 때만** 인정한다.
 *    `AW26MS185` 는 `AW26MS185 - Bubble …` 에서 첫 토큰이고, littleluna 의
 *    `메인스토리-aw26ms185-bubble-…` 에서도 한 토큰이다(실측 둘 다 통과).
 */
export function confirmBrandCodeInTitle(foreignCode: string | null, title: string): string | null {
  const code = foreignCode?.trim();
  if (!code) return null;
  const needle = code.toUpperCase();
  // 영숫자 아닌 모든 문자(공백·하이픈·대괄호·한글)로 쪼갠다 — 한글은 품번 토큰의
  // 일부가 될 수 없으므로 경계로 쓰는 것이 정확하다(`[메인스토리]  AW26MS185 - …`).
  for (const token of title.toUpperCase().split(/[^A-Z0-9]+/)) {
    if (token === needle) return code;
  }
  return null;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-004 Track A — **건초더미만 넓힌다.** 판정 규칙은 위 함수 그대로다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — 구현 «전» 벤치마크 실측(비용 0 · 저장된 후보 15건):
 * ```
 * 🔴 title 에서 발견   **0건**   ← 위 함수가 보던 유일한 자리
 * 🟢 URL 에서 발견     **3건**   bobochoses(공식) · global.trenbe.com · 운영 링크
 * ```
 * 🟢 즉 품번은 **URL 경로에 적혀 있었고 제목에는 없었다.** 특히 `global.trenbe.com`
 *    (등록부 «밖» 리세일 플랫폼)이 그렇고, WU-023B 에서 그 후보가 SAME(0.53)을 받았다.
 *
 * ── 🔴 안전 성질 셋을 **그대로 물려받는다** ────────────────────────────────
 * ```
 * ① 원본에서 확정된 품번만 받는다 — 후보에서 품번을 «추출» 하지 않는다
 * ② 반환은 `code` 아니면 `null` 둘뿐 → compareModelCode 가 `exact|unavailable` 만 낸다
 *    (partial·conflict 를 **구조적으로** 만들 수 없다)
 * ③ **토큰 전체 일치** — 각 필드를 위 함수에 그대로 넘겨 같은 규칙으로 본다
 *    (규칙을 복제하지 않는다. 복제하면 둘이 갈라진다)
 * ```
 *
 * ── 🔴🔴 `description` 을 **일부러 넣지 않았다** ────────────────────────────
 * ```
 * ① 벤치마크에서 **효과가 측정되지 않았다**(fixture 분모가 무관한 상품이라 0건)
 * ② 상세설명에는 «관련상품/추천상품» 의 품번이 함께 적히는 경우가 있다 →
 *    **다른 상품의 품번이 토큰으로 걸리는** FP 벡터다. FP 0 이 이 WU 의 최우선 KPI 다.
 * 🔴 측정되지 않은 이득을 위해 FP 위험을 먼저 받지 않는다. 필요해지면 그때 **재서** 넣는다.
 * ```
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-007A — 🔴🔴 **우리 검색어가 「상대의 식별 증거」로 재활용되는 것을 막는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측(WU-007)에서 **거짓 양성 27/27 = 100%** 가 났다. 원인은 순환 증거다:
 * ```
 * buildCrossSellerSearchQueries(product-identity-dna.ts:432) 의 1번 질의 = **품번 단독**
 *   → Shopify Predictive Search 가 응답 URL 에 **그 질의를 되돌려 넣는다**
 *       /products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_ss=sc
 *                                            └──── 우리 질의 ────┘
 *   → 그 URL 을 건초더미로 쓰면 「우리가 물어본 품번」이 「상대가 가진 품번」이 된다
 *   → MODEL_CODE 축 exact → matchTruth EXACT/STRONG → priceTierFromLink EXACT
 *   → 🔴 **전혀 다른 상품(기프트백)의 가격이 국내 최저가·판매판정에 들어간다**
 * ```
 *
 * 🟢 **새 정책이 아니다** — `self-reference.ts:63-67` 이 이미 같은 말을 적어 뒀다:
 *    「Shopify 는 검색/컬렉션 문맥을 `_pos` `_psq` `_ss` `_v` `_fid` 처럼 밑줄로
 *      시작하는 파라미터에 싣는다 — **전부 listing 을 가리지 못한다**」
 *
 * 🔴🔴 **쿼리 «전체» 를 버리지 않는다** — 그러면 식별에 쓰이는 파라미터까지 사라진다.
 *    실측 반례: `?variant=40096037535807`(Shopify 변형 id) · `?product_no=8021`(Cafe24) ·
 *    `?branduid=10226592`(메이크샵). 그래서 **검색 문맥 파라미터만** 걷어낸다.
 */
const SEARCH_TERM_PARAMS = new Set([
  /* 🟢 실측으로 확인된 FP 원인은 밑줄 계열(`_psq`)이다 — 아래 이름들은 **예방** 이다.
     근거: `buildCrossSellerSearchQueries` 가 **모든 어댑터에** 품번을 질의로 던지므로,
     검색어를 URL 에 남기는 플랫폼이면 같은 FP 가 난다. 🔴 「측정됨」과 「예방」을 섞지 않는다. */
  "q",
  "query",
  "keyword",
  "keywords",
  "search", // 🟢 self-reference.ts 의 NON_IDENTIFYING_PARAMS 에도 이미 들어 있다(메이크샵)
  "searchword",
  "sq",
  "term",
  "s",
]);

/** 🔴 밑줄로 시작하면 Shopify 의 검색/컬렉션 문맥이다(리포 기존 판단). */
const isSearchContextParam = (name: string): boolean =>
  name.startsWith("_") || SEARCH_TERM_PARAMS.has(name.toLowerCase());

/**
 * 식별 증거로 URL 을 읽기 «전» 에 검색 문맥 파라미터를 걷어낸다.
 *
 * 🔴 `new URL()` 을 쓰지 않는다 — 상대 경로(`/products/x?...`)도 그대로 처리해야 한다.
 *    (어댑터에 따라 절대/상대가 섞인다.)
 */
export function stripSearchContextFromUrl(raw: string): string {
  const hashAt = raw.indexOf("#");
  const base = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
  const qAt = base.indexOf("?");
  if (qAt < 0) return base;
  const path = base.slice(0, qAt);
  const kept: string[] = [];
  for (const pair of base.slice(qAt + 1).split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const rawName = eq >= 0 ? pair.slice(0, eq) : pair;
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      /* 잘못 인코딩된 이름은 날것 그대로 판단한다 — 버리지 않는다. */
    }
    if (isSearchContextParam(name)) continue;
    kept.push(pair);
  }
  return kept.length > 0 ? `${path}?${kept.join("&")}` : path;
}

export interface BrandCodeEvidenceFields {
  /** 후보 상품명. */
  title?: string | null;
  /** 🟢 후보 상품 URL — 실측에서 **유일하게 효과가 확인된** 자리다. */
  url?: string | null;
  /** 🟡 후보가 노출한 sku/상품코드. 🔴 이것을 품번으로 «승격» 하는 것이 아니다 —
   *     원본 품번이 그 칸에 적혀 있는지 **확인** 할 뿐이다(판매처 자체코드는 절대 같지 않다). */
  sku?: string | null;
}

/**
 * 원본 품번이 후보의 **title · url · sku** 중 한 곳에라도 토큰으로 있으면 그 품번을,
 * 아니면 `null` 을 돌려준다. 🔴 `confirmBrandCodeInTitle` 과 **같은 값 공간** 이다.
 */
export function confirmBrandCodeInEvidence(
  foreignCode: string | null,
  fields: BrandCodeEvidenceFields,
): string | null {
  const code = foreignCode?.trim();
  if (!code) return null;
  /**
   * 🔴🔴 품번 자체가 구분자를 품은 경우가 있다 — 실측(원상품 26건 중 **2건**):
   * ```
   * Pèpè Shoes    `01195-VERNICE-NERO`
   * Misha & Puff  `B1408F26-670`
   * ```
   * 위 `confirmBrandCodeInTitle` 은 건초더미를 영숫자 아닌 문자로 **쪼갠 뒤 한 토큰이
   * 품번과 같은지** 본다. 그런데 needle 에 하이픈이 있으면 **어떤 토큰과도 같아질 수
   * 없다** → URL 에 `.../01195-vernice-nero-shoes` 로 **그대로 적혀 있어도 `null`** 이었다
   * (실측 확인). 🔴 즉 하이픈 품번은 **구조적 False Negative** 였다.
   *
   * 🟢 그래서 품번도 같은 규칙으로 쪼개어 **토큰 «수열» 이 연속으로 일치** 하는지 본다.
   * 🔴 이것은 **부분일치가 아니다** — 수열의 각 토큰이 **전체 일치** 해야 하고 경계도
   *    지켜진다. 그래서 `b226ac0100` 은 `B226AC010` 에 걸리지 않고 `12672014894` 도
   *    `2672014894` 에 걸리지 않는다(음성대조 M1 이 그것을 잠근다).
   */
  const parts = code.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return null;
  /**
   * 🔴🔴 **구분자를 「코드용 기호」로만 제한한다.** 토큰 수열을 그냥 이어 붙이면
   *    실제 FP 가 난다 — 음성대조에서 걸렸다:
   * ```
   * code  B1408F26-670
   * 제목  "B1408F26 사이즈 670"   ← 한글이 영숫자가 아니라 **구분자로 지워져**
   *                                 두 토큰이 인접해지고 수열이 «거짓으로» 성립했다
   * ```
   * 🟢 그래서 품번 조각 사이에 허용하는 것은 `- _ . /` 와 «없음» 뿐이다.
   *    공백도 허용하지 않는다(「B1408F26 670」을 같은 품번으로 단정하지 않는다).
   * 🔴 그리고 양 끝에 영숫자가 붙으면 안 된다 — `b1408f26-6700` · `011950-vernice-nero`
   *    같은 **부분일치를 계속 막는다**.
   */
  /* 🟢 `parts` 는 `[^A-Z0-9]+` 로 쪼갠 결과라 **영숫자만** 들어 있다 →
     정규식 이스케이프가 **필요하지 않다**(특수문자가 들어올 수 없다). */
  const re = new RegExp(`(?<![A-Z0-9])${parts.join("[-_./]?")}(?![A-Z0-9])`);
  /* 🔴🔴 WU-007A — URL 은 **검색 문맥 파라미터를 걷어낸 뒤** 읽는다.
     그러지 않으면 우리가 보낸 질의(`?_psq=<품번>`)가 상대의 증거로 재활용된다
     (실측 FP 27/27). 🟢 실제 상품 path/handle 의 품번은 그대로 남는다. */
  const urlHaystack = fields.url ? stripSearchContextFromUrl(fields.url) : null;
  for (const haystack of [fields.title, urlHaystack, fields.sku]) {
    if (!haystack) continue;
    /* 🔴 돌려주는 것은 **원본 품번 문자열 그대로** 다 — 후보 쪽 문자열을 돌려주면
       compareModelCode 의 값 공간(`exact|unavailable`)이 깨진다. */
    if (re.test(haystack.toUpperCase())) return code;
  }
  return null;
}

/** 도메인별 국내 상품 식별자 추출기 레지스트리. 새 판매처를 여기 한 줄만
 * 추가하면 run-domestic-price-check.ts/domestic-price-sources/search/route.ts
 * 양쪽 호출부 모두 코드 변경 없이 그 도메인을 지원하게 된다 — 호출부는
 * 도메인 이름을 알 필요가 없다(CPO 지시: "if/else 도메인 분기가 route.ts에
 * 계속 늘어나는 구조는 금지"). */
const DOMESTIC_IDENTIFIER_EXTRACTORS: Record<string, (url: string) => Promise<string | null>> = {
  "foretforet.com": fetchForetforetModelCode,
  "bobochoses.com": (url: string) => Promise.resolve(extractBobochosesModelCode(url)),
};

export function supportsDomesticIdentifierExtraction(domain: string): boolean {
  return domain in DOMESTIC_IDENTIFIER_EXTRACTORS;
}

export async function fetchDomesticModelCode(domain: string, url: string): Promise<string | null> {
  const extractor = DOMESTIC_IDENTIFIER_EXTRACTORS[domain];
  return extractor ? extractor(url) : null;
}
