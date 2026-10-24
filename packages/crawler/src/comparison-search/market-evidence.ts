/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-4 STEP 3 — **판매처가 «어느 시장의 사업자» 인가** 를 말하는 증거
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「`domestic_price_sources` 를 국내 판정의 **권위 있는 근거로
 * 쓰지 않는다**」 · 「**어느 한 필드 하나만으로 KR 을 확정하면 안 된다**」 ·
 * 「기존 데이터 → marketEvidence → **복수 증거 종합** → KR / OVERSEAS / UNKNOWN」.
 *
 * ── 🔴🔴 왜 `ProductFacts` 에 넣지 않았나 (CPO 가 타입 설계를 수정했다) ─────────
 * ```
 * ❌ `ProductFacts` 14칸에 시장정보를 더하지 않는다 — 그 타입은 **상품 identity/
 *    evidence 용** 이고, 섞으면 「상품 ↔ 판매자/사이트 ↔ 시장」이 다시 뒤섞인다.
 * 🟢 그래서 **별도 구조** 로 붙인다:
 *      ComparisonCandidate
 *        ├─ facts(ProductFacts)   ← 상품
 *        └─ **marketEvidence**     ← 판매자/사이트
 * ```
 *
 * ── 🔴🔴 WU-063 과 충돌하지 않는 이유 (CPO 가 직접 정리했다) ───────────────────
 * ```
 * WU-063 이 REJECT 한 것 = 「**단일 페이지 신호를 KR 판정의 «결정자» 로**」 쓰는 것.
 *   실측 근거 — 페이지 단위 신호는 **같은 샵 안에서도 갈린다**
 *              (donokids C21 ✓ · C22 ✓ · **C43 ✗**)
 * 🟢 이 파일은 **판정하지 않는다** — 사실 다섯 칸을 «읽기만» 한다.
 *    KR/OVERSEAS/UNKNOWN 은 `candidate-market.ts` 가 **증거를 종합해서** 낸다.
 * 🔴 그리고 그 종합은 **강한 증거 2개 이상** 을 요구한다 — 신호 하나로는 못 넘는다.
 *    ⟹ WU-063 이 막은 모양(「신호 하나 = KR」)은 **구조적으로 만들 수 없다**.
 * 🔴 그래도 C43 같은 페이지는 여전히 **UNKNOWN** 이다(이 한계를 숨기지 않는다) —
 *    보수적인 방향의 오류이고, 「KR 로 잘못 단정」하는 방향이 아니다.
 * ```
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ────────────────────────────────────────────────
 * ```
 * 🔴 **추가 HTTP 0** — 호출부가 **이미 받아 둔 HTML** 만 넘긴다
 *    (WU-053 microdata reader · WU-151 고도몰 필드와 **같은 모양**).
 * 🔴 **판정 0** — market 도 verdict 도 내지 않는다. boolean 다섯 칸이 전부다.
 * 🔴 **도메인 분기 0** — donokids 전용 규칙이 **없다**(사이트 이름이 이 파일에 0건).
 * 🔴 **번역/음역/사전 확장 0** — 읽는 것은 **한국 법령이 요구하는 고시 문구** 다.
 * 🔴 가격·통화·재고·상품 identity 를 건드리지 않는다.
 * ```
 */

/**
 * 🔴 판매처 사이트가 **스스로 적은** 시장 사실. 🔴 「없음」은 「해외다」가 아니라
 *    **「그 페이지에서 확인되지 않았다」** 다(전부 false 여도 OVERSEAS 로 읽지 않는다).
 */
export interface MarketEvidence {
  /**
   * 🟢 **강한 증거** — 「사업자등록번호」 라벨 **그리고** `000-00-00000` 번호 모양.
   * 🔴 라벨만, 또는 번호 모양만으로는 **false** 다(둘을 같이 요구한다).
   */
  businessRegistration: boolean;
  /**
   * 🟢 **강한 증거** — 「통신판매업 신고」 라벨 **그리고** `제2020-…` 신고번호 모양.
   *    전자상거래법이 한국 사업자에게 요구하는 고시 항목이다.
   */
  mailOrderRegistration: boolean;
  /**
   * 🟢 **강한 증거** — 「개인통관고유부호」. 한국 관세청 제도의 고유 명칭이라
   *    다른 시장 페이지에 **나타날 이유가 없다**.
   */
  personalCustomsCode: boolean;
  /** 🟡 보조 증거 — 국내 배송 어휘(택배 · 배송비 · 도서산간). 단독으로는 아무 일도 안 한다. */
  domesticShipping: boolean;
  /** 🟡 보조 증거 — 국내 결제 어휘(무통장입금 · 실시간계좌이체 · 네이버/카카오페이). */
  domesticPayment: boolean;
}

/** 🟢 전부 「확인되지 않음」. 🔴 HTML 을 못 받은 경우와 **같은 값** 이다. */
export const EMPTY_MARKET_EVIDENCE: MarketEvidence = {
  businessRegistration: false,
  mailOrderRegistration: false,
  personalCustomsCode: false,
  domesticShipping: false,
  domesticPayment: false,
};

/**
 * 🔴 **태그를 벗기고 본다.** 고시 문구는 `<span>사업자등록번호</span> : <em>123-45-67890</em>`
 *    처럼 태그로 쪼개져 있다(WU-151 이 고도몰 「원」 표기에서 이미 밟은 함정).
 */
function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

/** 「사업자등록번호」 — 띄어쓰기/「등록」 생략 표기를 함께 받는다. */
const BIZ_LABEL_RE = /사업자\s*(?:등록\s*)?번호/;
/** 🔴 숫자 모양까지 **같이** 요구한다 — 라벨만 있는 안내문을 증거로 쓰지 않는다. */
const BIZ_NUMBER_RE = /\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/;

/** 「통신판매업신고」/「통신판매 신고번호」 등 표기 변형. */
const MAIL_ORDER_LABEL_RE = /통신\s*판매\s*업?\s*(?:신고|번호)/;
/** 🔴 신고번호 모양(`제2020-서울강남-1234호` · `2020-…`)을 **같이** 요구한다. */
const MAIL_ORDER_NUMBER_RE = /제?\s*\d{4}\s*-\s*[^\s]{1,20}\s*-\s*\d{1,6}\s*호?/;

/** 한국 관세청 제도 고유 명칭. 🔴 이 말 자체가 한국 시장 신호다. */
const CUSTOMS_CODE_RE = /개인\s*통관\s*고유\s*부호/;

const SHIPPING_RE = /(?:택배|배송비|도서\s*산간|무료\s*배송|당일\s*발송|평일\s*\d+시\s*이전)/;
const PAYMENT_RE = /(?:무통장\s*입금|실시간\s*계좌\s*이체|가상\s*계좌|네이버\s*페이|카카오\s*페이|토스\s*페이)/;

/**
 * 🟢 **순수 함수** — 이미 받은 HTML 문자열 하나만 읽는다(네트워크 0 · DOM 0).
 *
 * 🔴 값을 **지어내지 않는다** — 문구가 없으면 `false` 이고, 그 false 는
 *    「해외다」가 아니라 **「이 페이지에서 확인되지 않았다」** 다.
 */
export function extractMarketEvidence(html: string | null | undefined): MarketEvidence {
  if (!html) return EMPTY_MARKET_EVIDENCE;
  const text = toText(html);
  return {
    businessRegistration: BIZ_LABEL_RE.test(text) && BIZ_NUMBER_RE.test(text),
    mailOrderRegistration: MAIL_ORDER_LABEL_RE.test(text) && MAIL_ORDER_NUMBER_RE.test(text),
    personalCustomsCode: CUSTOMS_CODE_RE.test(text),
    domesticShipping: SHIPPING_RE.test(text),
    domesticPayment: PAYMENT_RE.test(text),
  };
}

/**
 * 🔴🔴 **강한 증거의 «개수»** — 종합 판정이 보는 유일한 숫자다.
 *
 * 🔴 보조 증거(배송·결제)는 **여기에 더하지 않는다.** 그 둘은 한국어 쇼핑몰이면
 *    거의 언제나 참이라 변별력이 낮고, 더하면 「한국어 페이지 = KR」이 되어
 *    WU-063 이 REJECT 한 그 모양으로 되돌아간다.
 */
export function countStrongKrSellerSignals(evidence: MarketEvidence | null | undefined): number {
  if (!evidence) return 0;
  let n = 0;
  if (evidence.businessRegistration) n += 1;
  if (evidence.mailOrderRegistration) n += 1;
  if (evidence.personalCustomsCode) n += 1;
  return n;
}

/**
 * 🔴 **종합 문턱 — 강한 증거 «둘».**
 *
 * 왜 2 인가: ① 1 이면 「사업자등록번호 하나 = KR」이 되고 그것이 CPO 가 글자로
 * 금지한 「단독 신호」다. ② 3 이면 `개인통관고유부호` 가 없는 정상 국내몰이 전부
 * 빠진다(그 문구는 해외직구 안내가 있는 몰에만 있다). 🔴 그리고 이 상수는
 * **통화 증거와 «함께»** 쓰인다 — 그래서 실제 KR 확정에는 **사실 셋** 이 필요하다.
 */
export const MIN_STRONG_KR_SELLER_SIGNALS = 2;

export function hasCompositeKrSellerEvidence(evidence: MarketEvidence | null | undefined): boolean {
  return countStrongKrSellerSignals(evidence) >= MIN_STRONG_KR_SELLER_SIGNALS;
}
