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
