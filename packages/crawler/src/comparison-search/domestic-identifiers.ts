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
