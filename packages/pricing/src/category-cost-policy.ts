import type { PriceTaxBasis } from "./price-basis";
import type { TaxRateRef } from "./import-tax";
import { EMS_VOLUMETRIC_DIVISOR } from "./parcel-weight";

/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — **카테고리별 비용 정책**.
 *
 * ── 이 파일이 존재하는 이유 ──────────────────────────────────────────────
 * 지시의 핵심은 "기존 정책을 깨지 않고 카테고리별로 분기하는 것"이다:
 *
 *   아동의류  기존 비용 정책 유지(MI-COST-POLICY-1 그대로)
 *   골프      별도 비용 정책(관세·부가세·중량·용적중량 포함)
 *
 * MI-COST-POLICY-1(2026-09-12)은 "관세·부가세는 구매자 부담"이라는 **결정**이었고
 * 그 결정 자체는 여전히 유효하다 — 다만 그것이 **모든 카테고리의 사실**은
 * 아니었다. 아동의류 직구는 개인 자가사용 소액 통관이라 판매자가 통관세를 내지
 * 않는 경우가 실제로 대부분이다. 골프채는 단가가 높아 그 전제가 깨진다.
 *
 * 그래서 정책을 **뒤집지 않고 넓힌다**. 아래 DEFAULT 정책은 MI-COST-POLICY-1이
 * 만든 상태와 한 글자도 다르지 않고, 그것이 카테고리를 모를 때의 동작이다.
 * 골프만 별도 항목으로 갈라진다.
 *
 * ── 🔴 카테고리 id를 여기서 지어내지 않는다 ──────────────────────────────
 * 아래 키는 전부 packages/category의 CATEGORY_PROFILES에 실제로 있는 id다
 * (KIDS_FASHION · WOMEN_FASHION · FASHION_ACCESSORIES · HOME_LIFESTYLE · GOLF).
 * pricing이 category 패키지를 import하지 않는 이유는 의존 방향을 새로 만들지
 * 않기 위해서다 — 대신 apps/admin(두 패키지를 모두 쓰는 유일한 곳)의 테스트가
 * "CATEGORY_PROFILES의 모든 id에 비용 정책이 있는가"를 고정한다. 카테고리를
 * 하나 더 만들면 그 테스트가 먼저 깨지고, 그때 비용 정책을 **결정**하게 된다.
 *
 * ── 왜 필드가 이것뿐인가 ─────────────────────────────────────────────────
 * 오늘 코드가 실제로 갈라지는 것만 둔다(CATEGORY_PROFILES의 원칙 그대로).
 * 갈라지는 것은 둘이다: ① 관세·수입부가세를 판매자 원가로 보는가 ② 국제배송비를
 * 중량으로 계산하는가. 쓰이지 않는 칸을 파 두면 다음 사람이 그 칸을 채우려고
 * 없는 규칙을 지어낸다.
 */

/** 이 정책이 붙는 자리. CATEGORY_PROFILES의 id + "모를 때". */
export type CostPolicyId =
  | "DEFAULT"
  | "KIDS_FASHION"
  | "WOMEN_FASHION"
  | "FASHION_ACCESSORIES"
  | "HOME_LIFESTYLE"
  | "GOLF";

export interface CategoryCostPolicy {
  id: CostPolicyId;
  label: string;
  /**
   * 관세·수입부가세를 **판매자 착지원가에 넣는가**.
   *
   * false면 unified-price-decision의 착지원가 합산에 그 항목들이 아예 오르지
   * 않는다(MI-COST-POLICY-1 상태 그대로 — 값을 넘겨도 무시된다).
   * true면 원가 항목이 되고, 세율을 모르면 "확인 필요"로 남는다.
   */
  importTaxesInLandedCost: boolean;
  /** importTaxesInLandedCost가 false면 둘 다 null이다(읽을 자리가 없다). */
  customsDutyRate: TaxRateRef | null;
  importVatRate: TaxRateRef | null;
  /**
   * 국제배송비를 실중량/용적중량으로 계산하는가. false면 지금까지처럼 판매자
   * 기본값(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw) 하나를 쓴다.
   */
  weightBasedShipping: boolean;
  /** 용적중량 제수. weightBasedShipping일 때만 의미가 있다. */
  volumetricDivisor: number | null;
  /**
   * PRICING-BASIS-1 — 이 정책으로 계산한 **착지원가가 어느 세금 기준인가**.
   * 국내 시장가(언제나 TAX_INCLUDED)와 나란히 놓아도 되는지가 이 값 하나로
   * 정해진다(price-basis.comparePriceBasis 참고).
   */
  landedCostTaxBasis: PriceTaxBasis;
  /** 화면/보고에 그대로 쓰는 한 줄. */
  policyNote: string;
}

/**
 * 🟢 수입부가세 10% — 부가가치세법 제30조(세율). 재화의 수입에 대한 부가가치세
 * 과세표준은 "관세의 과세가격 + 관세 + 개별소비세 등"이다(같은 법 제29조 제2항).
 * 골프채에는 개별소비세가 붙지 않으므로(import-tax.ts 주석) 과세표준은
 * CIF + 관세다.
 */
const KOREA_IMPORT_VAT_RATE: TaxRateRef = {
  percent: 10,
  confidence: "CONFIRMED",
  basis: "부가가치세법 세율 10% · 과세표준은 관세의 과세가격(CIF) + 관세 + 개별소비세 등(같은 법 제29조 제2항)",
  sources: ["https://www.law.go.kr/법령/부가가치세법/제29조"],
  verifiedOn: "2026-09-15",
};

/**
 * 🟢 **기본(WTO 협정) 세율 8% — 확정.** HSK 9506.31.00.00 "골프채(완제품)".
 *
 * ── 근거 ─────────────────────────────────────────────────────────────────
 * 1차 근거는 **RCEP 협정 부속서 I의 한국 양허표**다. 일반주해(General Notes)
 * ¶2가 "base rate는 각 당사국의 2014.1.1. 기준 **MFN 실행세율**을 반영한다"고
 * 규정하고, 한국 양허표의 9506.31.00.00 행 Base Rate가 **8.0%** 다. 즉 우리가
 * 읽은 것은 기사나 상담 요약이 아니라 조약 부속서에 적힌 숫자다.
 * 국내 관세사 답변들("HS 9506.31-0000, 관세율 8%, 부가세 10%")도 같은 값이다.
 *
 * 골프공(9506.32) · 골프채 부분품(9506.39.10) · 기타(9506.39.90)도 모두 base
 * 8.0%라, "골프용품"이라는 카테고리 한 칸으로 묶어도 기본세율은 갈리지 않는다.
 *
 * ── 🔴 남은 미확인(숨기지 않는다) ────────────────────────────────────────
 * 관세청 관세법령정보포털(unipass)의 **2026년자 관세율표 원문은 확인하지
 * 못했다** — 해당 화면이 JS로만 렌더링돼 조회에 실패했다. 8%는 한국의 WTO
 * 양허세율이기도 해서 움직였을 가능성이 낮지만, 사람이 한 번 눈으로 확인할
 * 필요가 있다. reviewNote가 그 사실을 들고 다닌다.
 */
const GOLF_CUSTOMS_DUTY_RATE: TaxRateRef = {
  percent: 8,
  confidence: "CONFIRMED",
  basis:
    "HSK 9506.31.00.00(골프채 완제품) 기본·WTO 협정세율 8% — RCEP 부속서 I 한국 양허표 Base Rate 8.0%(일반주해 ¶2: base rate = 2014.1.1. MFN 실행세율) · 국내 관세사 답변 일치",
  sources: [
    "https://fta.mofcom.gov.cn/upload/agreementFiles/rcep/rceppdf/17%20Schedules%20-%20KR%20for%20JP.pdf",
    "https://fta.mofcom.gov.cn/upload/agreementFiles/rcep/rceppdf/00%20General%20Notes_en.pdf",
    "https://www.a-ha.io/questions/45aceb87fdc5ac94abf1540611c9213d",
  ],
  verifiedOn: "2026-09-15",
  reviewNote:
    "관세청 unipass의 2026년자 관세율표 원문 미확인(JS 렌더링으로 조회 실패) — 사람이 한 번 확인할 것. 매년 재확인 필요.",
};

/**
 * 🔴 **RCEP 대일본 협정세율 5.3% — 알고 있지만 기본값으로 쓰지 않는다.**
 *
 * ── 세율 자체는 확정이다 ─────────────────────────────────────────────────
 * RCEP 부속서 I 한국 양허표(대일본) 9506.31.00.00은 base 8.0%에서 15년 균등
 * 철폐다: Y1 7.5 · Y2 6.9 · Y3 6.4 · Y4 5.9 · **Y5 5.3** · … · Y15 0.0.
 * RCEP은 한국에 2022.2.1. 발효했고 일반주해 ¶4(a)/¶5 기준으로 Y1 = 2022 →
 * **2026년은 Y5 = 5.3%** 다.
 *
 * ── 그런데 자동으로 적용되지 않는다 ──────────────────────────────────────
 * RCEP 제3.22조 1·2항: 협정관세는 **원산지증명(Proof of Origin)에 근거해서만**
 * 적용되고, 수입자는 신고 시점에 유효한 원산지증명을 **소지**하고 있어야 한다.
 * 제3.16조 1항이 인정하는 원산지증명은 ①발급기관 CO ②인증수출자의 원산지신고서
 * ③수출자·생산자의 원산지신고서 셋뿐이고, **수입자 자가발급은 한국에서 인정되지
 * 않는다**(각주 5가 그 선택지를 일본에만 준다).
 *
 * 일본 소매 사이트에서 직구한 클럽에는 그 서류가 따라오지 않는다. 그러므로
 * **기본값은 8%다.** 5.3%는 셀러가 실제로 일본 수출자·생산자의 원산지신고서나
 * 발급기관 CO를 갖고 있을 때만 셀러가 직접 입력해서 쓰는 값이다
 * (ImportTaxInput.sellerConfirmedDutyRatePercent).
 *
 * ── 🔴 이 값을 카테고리 전체에 쓰면 틀린다 ───────────────────────────────
 * 5.3%는 **골프채(9506.31) 한 줄**의 2026년 세율이다. 골프공(9506.32)과
 * 부분품(9506.39.x)은 10년 철폐 일정이라 2026년에 **4.0%**다. 우리 카테고리는
 * "골프용품" 한 칸이라 HS 줄을 구분하지 못한다 — 그래서 이 상수를 정책에
 * 연결하지 않고 **참고 자료로만** 둔다. 연결하는 순간 골프공에 5.3%가 붙는다.
 *
 * 세율은 매년 내려간다(2027.1.1. → 4.8%). 연도가 박힌 이름인 것이 그 장치다.
 */
export const GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026: TaxRateRef = {
  percent: 5.3,
  confidence: "CONFIRMED",
  basis:
    "RCEP 부속서 I 한국 양허표(대일본) HSK 9506.31.00.00 Y5(2026년) 5.3% — 🔴 원산지증명서(RCEP 제3.22조)를 소지한 경우에만 적용된다. 일본 소매 직구에는 그 서류가 없으므로 기본값은 기본세율 8%다. 골프공·부분품은 이 값이 아니라 4.0%다.",
  sources: [
    "https://fta.mofcom.gov.cn/upload/agreementFiles/rcep/rceppdf/17%20Schedules%20-%20KR%20for%20JP.pdf",
    "https://asean.org/wp-content/uploads/2024/10/Regional-Comprehensive-Economic-Partnership-RCEP-Agreement-Full-Text.pdf",
  ],
  verifiedOn: "2026-09-15",
  reviewNote: "2027.1.1.부터 Y6 4.8%로 내려간다 — 연도가 바뀌면 이 상수를 새로 만들어야 한다.",
};

export const CATEGORY_COST_POLICIES: Record<CostPolicyId, CategoryCostPolicy> = {
  /**
   * 카테고리를 모를 때. **MI-COST-POLICY-1 + MI-UX-FINAL-4 이후의 오늘 동작과
   * 한 글자도 다르지 않다** — 이것이 이 스프린트의 회귀 안전장치다. 카테고리를
   * 넘기지 않는 모든 기존 호출부가 이 정책을 받는다.
   */
  DEFAULT: {
    id: "DEFAULT",
    label: "기본",
    importTaxesInLandedCost: false,
    customsDutyRate: null,
    importVatRate: null,
    weightBasedShipping: false,
    volumetricDivisor: null,
    landedCostTaxBasis: "TAX_EXCLUDED",
    policyNote: "관세·수입부가세는 구매자 부담이라 판매자 원가에 넣지 않습니다(MI-COST-POLICY-1)",
  },
  /** 🔴 아동의류는 DEFAULT와 **완전히 같은 값**이다. 이 줄이 달라지면 회귀다. */
  KIDS_FASHION: {
    id: "KIDS_FASHION",
    label: "아동의류",
    importTaxesInLandedCost: false,
    customsDutyRate: null,
    importVatRate: null,
    weightBasedShipping: false,
    volumetricDivisor: null,
    landedCostTaxBasis: "TAX_EXCLUDED",
    policyNote: "관세·수입부가세는 구매자 부담이라 판매자 원가에 넣지 않습니다(MI-COST-POLICY-1)",
  },
  WOMEN_FASHION: {
    id: "WOMEN_FASHION",
    label: "여성 패션",
    importTaxesInLandedCost: false,
    customsDutyRate: null,
    importVatRate: null,
    weightBasedShipping: false,
    volumetricDivisor: null,
    landedCostTaxBasis: "TAX_EXCLUDED",
    policyNote: "관세·수입부가세는 구매자 부담이라 판매자 원가에 넣지 않습니다(MI-COST-POLICY-1)",
  },
  FASHION_ACCESSORIES: {
    id: "FASHION_ACCESSORIES",
    label: "패션 잡화",
    importTaxesInLandedCost: false,
    customsDutyRate: null,
    importVatRate: null,
    weightBasedShipping: false,
    volumetricDivisor: null,
    landedCostTaxBasis: "TAX_EXCLUDED",
    policyNote: "관세·수입부가세는 구매자 부담이라 판매자 원가에 넣지 않습니다(MI-COST-POLICY-1)",
  },
  HOME_LIFESTYLE: {
    id: "HOME_LIFESTYLE",
    label: "라이프스타일",
    importTaxesInLandedCost: false,
    customsDutyRate: null,
    importVatRate: null,
    weightBasedShipping: false,
    volumetricDivisor: null,
    landedCostTaxBasis: "TAX_EXCLUDED",
    policyNote: "관세·수입부가세는 구매자 부담이라 판매자 원가에 넣지 않습니다(MI-COST-POLICY-1)",
  },
  /**
   * 🔴 이 저장소에서 **처음으로** 관세·부가세를 판매자 원가로 보는 카테고리다.
   *
   * 골프채는 단가가 높아(¥100,000대) 소액면세 한도를 언제나 넘고, 재판매 목적
   * 수입은 애초에 자가사용 소액면세·목록통관 대상이 아니다. 즉 통관세는 실제로
   * 판매자가 치르는 돈이다 — MI-COST-POLICY-1이 아동의류에서 "판매자가 내지 않는
   * 돈"이라고 판단한 근거가 이 카테고리에서는 성립하지 않는다.
   *
   * 세율은 둘 다 확정됐다: 기본세율 8%(RCEP 부속서 I 한국 양허표 base rate) ·
   * 수입부가세 10%(부가가치세법). 그래서 골프 상품은 오늘 실제로 끝까지
   * 계산된다. RCEP 5.3%는 원산지증명서가 있어야 받는 세율이라 기본값이 아니고,
   * 셀러가 서류를 갖고 있을 때만 직접 입력한다
   * (GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026 주석 참고).
   */
  GOLF: {
    id: "GOLF",
    label: "골프용품",
    importTaxesInLandedCost: true,
    customsDutyRate: GOLF_CUSTOMS_DUTY_RATE,
    importVatRate: KOREA_IMPORT_VAT_RATE,
    weightBasedShipping: true,
    volumetricDivisor: EMS_VOLUMETRIC_DIVISOR,
    landedCostTaxBasis: "LANDED_TAXED",
    policyNote:
      "상품가 + 국제배송비 + 관세 + 수입부가세를 모두 판매자 원가로 봅니다 · 국제배송비는 실중량과 용적중량 중 큰 쪽으로 계산합니다",
  },
};

/**
 * 카테고리 id → 비용 정책. **모르는 id는 DEFAULT다.**
 *
 * KIDS_FASHION으로 폴백하지 않는 것이 중요하다. 값이 같더라도 id가 다르면
 * 화면이 "아동의류 기준으로 계산했습니다"라고 말하게 되고, 그건 우리가 모르는
 * 것을 아는 것처럼 말하는 것이다(CATEGORY_PROFILES의 selectedMarketSourceScopes가
 * 모르는 id에 null을 돌려주는 것과 같은 규칙).
 */
export function resolveCategoryCostPolicy(categoryProfileId: string | null | undefined): CategoryCostPolicy {
  if (!categoryProfileId) return CATEGORY_COST_POLICIES.DEFAULT;
  return (
    (CATEGORY_COST_POLICIES as Record<string, CategoryCostPolicy | undefined>)[categoryProfileId] ??
    CATEGORY_COST_POLICIES.DEFAULT
  );
}
