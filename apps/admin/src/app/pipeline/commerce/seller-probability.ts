/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **MLS2 §3 — 「고확률 동일상품 후보」 표현 계층**(CPO 확정 2026-11-06)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 정책 원문(그대로 옮긴다):
 * ```
 * 핵심 식별 항목 3개 — ① 브랜드 ② 상품명 ③ 상세설명에서 확인되는 식별정보
 * 「핵심 항목 3개 중 **서로 독립적인 근거 2개 이상** 이 일치하면
 *   고확률 동일상품 후보로 분류하는 방향으로 구현한다.」
 * ```
 *
 * 🔴🔴🔴 **이것은 «판정» 이 아니라 «표현» 이다.** 지켜야 하는 경계:
 * ```
 * ❌ Identity threshold · SAME_MIN_AXES · blocker · conflict · matchTruth 변경
 * ❌ `crossSellerVerdict` 를 덮어쓰기        ❌ 가격 집계 자격(eligibility) 변경
 * ❌ 새 증거 추출 · 새 HTTP · 새 사전/번역    ❌ GT·human_verdict 변경
 * 🟢 허용 — **이미 계산된 값을 읽어** 셀러가 읽을 분류 하나를 만드는 것
 * ```
 * 🔴 CPO 명시: 「새로운 고확률 분류를 기존 SAME 판정에 **무조건 대입하지 않는다**」
 *    ⟹ 그래서 이 모듈은 `crossSellerVerdict` 를 **입력으로만** 쓰고 **돌려주지 않는다**.
 *
 * 🔴🔴 **입력은 전부 기존 칸이다.** 새로 뽑는 것이 **하나도 없다** —
 *    `crossSellerBlockers` · `crossSellerConflicts` · `matchTruth` ·
 *    `matchReasons`(「근거:」/「보류:」 줄). 🟢 `pendingNote` 가 쓰는 그 방식이다.
 */
import type { SplitEvidence } from "./blocker-text";

/** CPO §3 의 **핵심 식별 항목 셋**. 🔴 이 셋을 늘리지 않는다(가산 근거는 별도다). */
export type CoreIdentityAxis = "BRAND" | "PRODUCT_NAME" | "DETAIL_IDENTIFIER";

/**
 * 🔴🔴 **세 상태다 — 「미확인」과 「불일치」를 섞지 않는다**(CPO 명시 ·
 *    「정보가 없는 항목은 일치로 간주하지 않는다」 · 「미확인과 불일치는 구분한다」).
 */
export type CoreAxisState = "MATCHED" | "MISMATCHED" | "UNKNOWN";

export interface CoreAxisFinding {
  axis: CoreIdentityAxis;
  state: CoreAxisState;
  /** 🔴 **왜 그렇게 읽었는지** — 내부 토큰이 아니라 그 토큰을 만든 «사실» 이다. */
  basis: string;
}

/**
 * 셀러에게 보여줄 분류. 🔴 `SAME`/`PRESUMED_SAME` 같은 **Identity 어휘를 쓰지 않는다** —
 * 그 어휘를 재사용하면 다음 사람이 「판정이 여기서 일어난다」고 읽는다
 * (메모 `guard-blocking-my-name-means-the-name-collides` 의 그 사고).
 */
export type SellerProbability = "HIGH" | "POSSIBLE" | "CONFLICTED" | "INSUFFICIENT";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CPO 보정(2026-11-06) — 불일치는 «두 등급» 이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 가 1차 구현의 `MISMATCHED ≥ 1 → CONFLICTED` 를 **반려했다**:
 * ```
 * 「이 규칙을 **모든 불일치에 일괄 적용하면 안 된다**.
 *   · 브랜드가 확실히 다름       → **강한 불일치**
 *   · 제조사 품번이 확실히 다름  → **강한 불일치**
 *   · 상품명이 다름 → 번역 · 표기 · 시즌명 · **판매처 자체 상품명** 차이인지 검토
 *   브랜드와 제조사 품번이 일치하고 **상품명만 다르다면,
 *   상품명 차이만으로 고확률 후보에서 탈락시키지 않는다.」**
 * ```
 * 🟢 **이 저장소의 실측이 그 보정을 지지한다** — 국내 판매처는 상품명을 **자기 말로**
 *    다시 쓴다(「허그 헤어리 몬스터 티셔츠」 ↔ 「Hug Hairy Monster T-shirt」 ·
 *    토큰 겹침 0). `NO_TITLE_OVERLAP` 이 측정한 것은 **표기 차이** 이고
 *    「다른 상품」이 아니다.
 * 🔴 반대로 **브랜드·품번은 언어 중립** 이라 「확실히 다름」이 곧 다른 상품이다.
 */
const STRONG_AXES = new Set<CoreIdentityAxis>(["BRAND", "DETAIL_IDENTIFIER"]);

export interface SellerProbabilityResult {
  probability: SellerProbability;
  findings: CoreAxisFinding[];
  matchedCount: number;
  mismatchedCount: number;
  /** 🔴 **브랜드·품번의 확정 불일치** — 이것만 고확률을 막는다. */
  strongMismatchCount: number;
  /** 🟡 **상품명 표기 차이** — 막지 않는다. 🔴 단 **숨기지도 않는다**(화면이 말한다). */
  weakMismatchCount: number;
  unknownCount: number;
  /** 🟢 가산 근거(색상·소재·연령·카테고리·형태…) — 🔴 **핵심 불일치를 덮지 않는다**. */
  supporting: string[];
  /** 🔴 숨기지 않고 **따로** 내보낸다(CPO: 「충돌하는 근거는 숨기지 않고 별도 표시」). */
  conflicting: string[];
}

export interface SellerProbabilityInput {
  /** 🔴 기존 칸 그대로. 이름을 바꾸지 않는다. */
  crossSellerBlockers?: readonly string[] | null;
  crossSellerConflicts?: readonly string[] | null;
  matchTruth?: string | null;
  /** 🟢 「근거:」/「보류:」 로 갈린 줄들 — `splitEvidenceReasons` 의 산출을 그대로 받는다. */
  agreement?: SplitEvidence | null;
}

const has = (xs: readonly string[] | null | undefined, t: string) => (xs ?? []).includes(t);

/** 🔴 식별자 경로로 «확정» 된 matchTruth 둘. 🟢 기존 어휘를 그대로 읽는다. */
const IDENTIFIER_CONFIRMED = new Set(["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"]);

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 축 ① 브랜드
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 `BRAND_MISMATCH`(확인된 불일치) ↔ `BRAND_UNCONFIRMED`(모른다)를 **가른다** —
 *    IPES DOSSIER 13행에서 둘이 **같이** 나왔고 의미가 다르다.
 */
function brandAxis(input: SellerProbabilityInput): CoreAxisFinding {
  if (has(input.crossSellerBlockers, "BRAND_MISMATCH")) {
    return { axis: "BRAND", state: "MISMATCHED", basis: "브랜드가 서로 다릅니다" };
  }
  if (has(input.crossSellerBlockers, "BRAND_UNCONFIRMED")) {
    return { axis: "BRAND", state: "UNKNOWN", basis: "브랜드를 확인하지 못했습니다" };
  }
  return { axis: "BRAND", state: "MATCHED", basis: "브랜드가 일치합니다" };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 축 ② 상품명
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 **「겹침 0」은 불일치이고, 「근거 줄이 없다」는 미확인이다.**
 *    IPES 13행 전부에 「보류: 핵심 상품명에 겹치는 말이 없다」가 있었다 —
 *    그 줄의 **유무** 로 가르면 「모른다」가 「일치」로 새어 들어간다.
 * 🟢 그래서 **일치는 「근거:」 줄이 상품명을 말할 때만** 인정한다.
 */
function productNameAxis(input: SellerProbabilityInput): CoreAxisFinding {
  if (has(input.crossSellerBlockers, "NO_TITLE_OVERLAP")) {
    return { axis: "PRODUCT_NAME", state: "MISMATCHED", basis: "상품명에 겹치는 말이 없습니다" };
  }
  const named = (input.agreement?.agree ?? []).some((line) => line.includes("상품명"));
  if (named) {
    return { axis: "PRODUCT_NAME", state: "MATCHED", basis: "상품명의 핵심 단어가 겹칩니다" };
  }
  return { axis: "PRODUCT_NAME", state: "UNKNOWN", basis: "상품명으로는 확인하지 못했습니다" };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 축 ③ 상세설명에서 확인되는 식별정보(품번 · 모델코드)
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 **「값이 있다」가 아니라 「양쪽이 같다고 확인됐다」만 일치다**(CPO:
 *    「상세설명의 품번·모델코드는 원본 출처와 실제 값이 일치하는지 확인한다」).
 *    🟢 그 확인은 **이미 운영이 했다** — `matchTruth` 가 식별자 경로로 확정될 때만
 *       `EXACT_IDENTIFIER`/`STRONG_IDENTIFIER` 가 된다 ⟹ 그 값을 **읽기만** 한다.
 * 🔴 `MODEL_CODE` 충돌은 **확인된 불일치** 다(품번이 서로 달랐다).
 */
function detailIdentifierAxis(input: SellerProbabilityInput): CoreAxisFinding {
  if (has(input.crossSellerConflicts, "MODEL_CODE") || has(input.crossSellerBlockers, "MODEL_CODE_AGE_LINE")) {
    return { axis: "DETAIL_IDENTIFIER", state: "MISMATCHED", basis: "상품코드가 서로 다릅니다" };
  }
  if (input.matchTruth && IDENTIFIER_CONFIRMED.has(input.matchTruth)) {
    return { axis: "DETAIL_IDENTIFIER", state: "MATCHED", basis: "상품코드가 일치합니다" };
  }
  return { axis: "DETAIL_IDENTIFIER", state: "UNKNOWN", basis: "상품코드를 확인하지 못했습니다" };
}

/**
 * 🔴 **가산 근거는 핵심 축과 «같은 줄에 세지 않는다»**(CPO: 「추가 근거는 고확률 후보의
 *    신뢰도를 보강한다. 핵심 식별 근거의 강한 불일치를 덮는 용도로 사용하지 않는다」).
 * 🟢 상품명 축이 이미 쓴 줄은 **빼서** 같은 근거를 두 번 세지 않는다.
 */
function supportingLines(agreement: SplitEvidence | null | undefined): string[] {
  return (agreement?.agree ?? []).filter((line) => !line.includes("상품명"));
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **분류 — CPO 규칙 여덟을 그대로 옮긴 것이다**
 * ════════════════════════════════════════════════════════════════════════════
 * ```
 * CONFLICTED    확인된 불일치가 **하나라도** 있다
 *               🔴 CPO: 「강한 불일치가 발견되면 단순 일치 개수만으로 고확률 분류하지 않는다」
 *               ⟹ 그래서 이 검사가 **개수 검사보다 먼저** 온다
 * HIGH          확인된 일치 **2개 이상** + 불일치 **0**
 * POSSIBLE      확인된 일치 1개 + 불일치 0
 * INSUFFICIENT  확인된 일치 0 (전부 미확인)
 *               🔴 「정보가 없는 항목은 일치로 간주하지 않는다」의 귀결이다
 * ```
 * 🔴 **중복 계산을 구조적으로 막는다** — 축이 셋이고 축당 상태가 하나뿐이라
 *    같은 원문을 여러 경로에서 읽어도 **한 축은 한 번만** 센다(CPO 금지 ①).
 */
export function classifySellerProbability(input: SellerProbabilityInput): SellerProbabilityResult {
  const findings = [brandAxis(input), productNameAxis(input), detailIdentifierAxis(input)];
  const matchedCount = findings.filter((f) => f.state === "MATCHED").length;
  const mismatched = findings.filter((f) => f.state === "MISMATCHED");
  const strongMismatchCount = mismatched.filter((f) => STRONG_AXES.has(f.axis)).length;
  const weakMismatchCount = mismatched.length - strongMismatchCount;
  const unknownCount = findings.filter((f) => f.state === "UNKNOWN").length;

  /**
   * 🔴🔴 **CPO 보정 — 막는 것은 «강한» 불일치뿐이다**(브랜드 · 제조사 품번).
   * ```
   * 브랜드 ✅ + 품번 ✅ + 상품명 ❌(표기 차이)  → **HIGH**  ← 전엔 CONFLICTED 였다
   * 브랜드 ✅ + 상품명 ✅ + 품번 ❌(확정 불일치) → **CONFLICTED**(별도 검토)
   * ```
   * 🔴 `UNKNOWN` 은 **불일치가 아니다** — 분모에서 빠지고 막지도 않는다.
   */
  const probability: SellerProbability =
    strongMismatchCount > 0
      ? "CONFLICTED"
      : matchedCount >= 2
        ? "HIGH"
        : matchedCount === 1
          ? "POSSIBLE"
          : "INSUFFICIENT";

  return {
    probability,
    findings,
    matchedCount,
    mismatchedCount: mismatched.length,
    strongMismatchCount,
    weakMismatchCount,
    unknownCount,
    supporting: supportingLines(input.agreement),
    conflicting: input.agreement?.hold ?? [],
  };
}

/**
 * 🔴 셀러가 읽을 **말** 의 owner 는 이 파일 하나다 — 화면이 문자열을 만들지 않는다.
 * 🔴 내부 토큰(`HIGH`·`BRAND_MISMATCH`…)을 그대로 노출하지 않는다.
 * 🔴 「동일상품」이라고 **단정하지 않는다** — CPO: 「100% 동일상품을 증명하는 것이
 *    목표가 아니다」 · 「PRESUMED_SAME 을 검증된 동일상품 가격으로 표시하지 않는다」.
 */
export const SELLER_PROBABILITY_LABEL: Record<SellerProbability, string> = {
  HIGH: "동일상품 가능성 높음",
  POSSIBLE: "동일상품 가능성 있음",
  CONFLICTED: "다른 상품일 수 있음",
  INSUFFICIENT: "확인된 근거 부족",
};

/** 🟢 「근거 2개 중 …」을 셀러가 읽을 수 있게 **한 줄** 로. 🔴 점수를 만들지 않는다. */
export function sellerProbabilitySummary(r: SellerProbabilityResult): string {
  const core = `핵심 근거 ${r.matchedCount}/3 일치`;
  /** 🔴 강한 불일치를 **먼저** 말한다 — 셀러가 가장 먼저 알아야 하는 사실이다. */
  if (r.strongMismatchCount > 0) return `${core} · 확인된 불일치 ${r.strongMismatchCount}건`;
  /**
   * 🟡 **상품명 표기 차이는 「불일치」로 적지 않는다** — CPO 보정대로 「검토」 축이다.
   *    🔴 국내 판매처가 상품명을 자기 말로 다시 쓰는 것이 **정상** 이라서다.
   */
  if (r.weakMismatchCount > 0) return `${core} · 상품명 표기 차이 ${r.weakMismatchCount}건`;
  if (r.unknownCount > 0) return `${core} · 미확인 ${r.unknownCount}건`;
  return core;
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-LIST-UI-01 — **CPO 4상태 표시 계층**(승인 2026-11-06 ②③)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정을 만들지 않는다.** 아래 전부 **이미 계산된 값을 읽어 «말» 로 바꾸는 것** 이다 —
 *    Identity 임계값 · 8축 · 가격 eligibility · GT **변경 0**.
 *
 * ── CPO 가 고정한 네 상태 ───────────────────────────────────────────────────
 * ```
 * SAME      핵심 식별정보 일치 · 주요 차이 없음
 * SIMILAR   핵심 식별정보 일치 · **컬러·형태 등 차이 확인**      ← C19 · C20
 * 검토 필요  근거 충돌 **또는 이미지 부족**                      ← C22
 * DIFFERENT 실제 다른 상품이라는 근거 확인
 * ```
 * 🔴 **내부 토큰에 `SAME`/`DIFFERENT` 를 쓰지 않는다** — 이 파일 머리(:46)가 적어 둔
 *    그 이유 때문이다(Identity 어휘를 재사용하면 「판정이 여기서 일어난다」고 읽힌다).
 *    🟢 그 넷은 **셀러가 읽는 라벨** 이고 타입 값은 기존 어휘 계열로 둔다.
 */

/**
 * 🔴 **보조 축의 «확정» 차이** — 핵심 식별정보가 같아도 실물이 다를 수 있는 자리다.
 * 🟢 토큰을 **지어내지 않았다** — `cross-seller.ts` 가 실제로 내는 값들이다.
 * 🔴 `COLOR_VARIANT` 는 **보류**(색조는 같고 색상명만 다름)라 **차이로 세지 않는다** —
 *    그 구분이 WU-044 의 계약이고 섞으면 「다른 표기」가 「다른 상품」이 된다.
 */
export const SUPPORTING_DIFF_LABEL: Record<string, string> = {
  COLOR: "색상",
  FIT: "핏",
  GARMENT_FORM: "형태",
  MATERIAL: "소재",
  SET: "구성",
};

/**
 * 🔴 **이미지 근거** — 「실물 차이를 눈으로 확인할 수 있는가」. CPO ② 가 C22 에서
 *    요구한 축이다(후보 이미지 **0** 이라 SAME 도 SIMILAR 도 확정 금지).
 * 🔴 `UNKNOWN` 은 「없다」가 **아니다** — 호출부가 안 넘긴 상태다(기본값).
 */
export type ImageEvidence = "BOTH" | "ONE_SIDE" | "NONE" | "UNKNOWN";

/** 🟢 셀러 화면이 쓰는 네 칸. 🔴 Identity 어휘를 피한 이름이다. */
export type SellerDisplayState = "LIKELY_SAME" | "LIKELY_SIMILAR" | "NEEDS_REVIEW" | "LIKELY_DIFFERENT";

export const SELLER_DISPLAY_LABEL: Record<SellerDisplayState, string> = {
  LIKELY_SAME: "동일상품 가능성 높음",
  LIKELY_SIMILAR: "유사상품",
  NEEDS_REVIEW: "검토 필요",
  LIKELY_DIFFERENT: "다른 상품일 수 있음",
};

export interface SellerDisplayInput {
  result: SellerProbabilityResult;
  /** 🟢 `crossSellerConflicts` 를 **그대로** 넘긴다 — 이 함수가 다시 판정하지 않는다. */
  conflicts?: readonly string[] | null;
  imageEvidence?: ImageEvidence;
}

export interface SellerDisplay {
  state: SellerDisplayState;
  label: string;
  /** 🔴 **왜 그 상태인지** — 내부 토큰이 아니라 셀러가 읽는 사실이다. */
  reason: string;
  /** 🟢 차이가 확인된 보조 축의 **사람 말**(「색상」·「형태」…). 없으면 빈 배열. */
  differingAxes: string[];
}

/**
 * 🔴🔴 **순서가 계약이다** — 위에서 아래로, 먼저 걸린 것이 이긴다:
 * ```
 * ① 강한 불일치(브랜드·품번)        → 다른 상품일 수 있음
 * ② 핵심 일치 + 보조 축 «확정» 차이  → **유사상품**              ← CPO ③ (C19·C20)
 * ③ 핵심 일치 + **이미지 없음**      → **검토 필요**              ← CPO ② (C22)
 * ④ 핵심 일치 + 차이 없음            → 동일상품 가능성 높음
 * ⑤ 그 외(근거 부족·미확인)          → 검토 필요
 * ```
 * 🔴 ③ 이 ④ **앞** 에 온다 — 이미지가 없으면 「차이가 없다」를 **확인한 것이 아니다**
 *    (C22 는 브랜드·품번이 맞는데 실제로는 다른 상품이었고 CEO 가 「이미지 비교 필요」라 했다).
 * 🔴 ②가 ③ 앞인 이유 — 차이가 **이미 확인됐으면** 이미지가 없어도 유사상품으로 말할 수 있다.
 */
export function resolveSellerDisplay(input: SellerDisplayInput): SellerDisplay {
  const r = input.result;
  const differingAxes = [...new Set(input.conflicts ?? [])]
    .filter((t) => t in SUPPORTING_DIFF_LABEL)
    .map((t) => SUPPORTING_DIFF_LABEL[t]);

  if (r.strongMismatchCount > 0) {
    return {
      state: "LIKELY_DIFFERENT",
      label: SELLER_DISPLAY_LABEL.LIKELY_DIFFERENT,
      reason: "브랜드 또는 상품코드가 서로 다릅니다",
      differingAxes,
    };
  }
  const coreMatched = r.matchedCount >= 2;
  if (coreMatched && differingAxes.length > 0) {
    return {
      state: "LIKELY_SIMILAR",
      label: SELLER_DISPLAY_LABEL.LIKELY_SIMILAR,
      reason: `핵심 식별정보는 같고 ${differingAxes.join(" · ")}이(가) 다릅니다`,
      differingAxes,
    };
  }
  if (coreMatched && input.imageEvidence === "NONE") {
    return {
      state: "NEEDS_REVIEW",
      label: SELLER_DISPLAY_LABEL.NEEDS_REVIEW,
      reason: "핵심 식별정보는 같지만 실물 차이를 확인할 이미지가 없습니다",
      differingAxes,
    };
  }
  if (coreMatched) {
    return {
      state: "LIKELY_SAME",
      label: SELLER_DISPLAY_LABEL.LIKELY_SAME,
      reason: "핵심 식별정보가 일치하고 확인된 차이가 없습니다",
      differingAxes,
    };
  }
  return {
    state: "NEEDS_REVIEW",
    label: SELLER_DISPLAY_LABEL.NEEDS_REVIEW,
    reason:
      r.weakMismatchCount > 0
        ? "상품명 표기가 달라 추가 확인이 필요합니다"
        : "확인된 핵심 근거가 부족합니다",
    differingAxes,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **품번 «세 칸» 을 같은 의미로 표시하지 않는다**(CPO 지시 2026-11-06 표)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 구분이 이번 트랙에서 **거짓 블로커를 만든 자리** 다 — 추출 축이 비었다고
 *    「후보가 원상품 품번을 놓쳤다」로 읽었는데 **확인 축은 그 품번을 잡고 있었다**.
 * ```
 * ORIGIN_EXTRACTED  원상품에서 확보한 품번                (원상품 `brandModelCode`)
 * CANDIDATE_CONFIRMED 원상품 품번이 후보 근거에서 확인됨   (`confirmBrandCodeInEvidence`)
 * SELLER_OWN        확인되지 않은 **판매처 코드**          (`sellerSku` · 품번이 아니다)
 * ```
 * 🔴 셋을 한 칸에 합치지 않는다 — 합치면 판매처 코드가 품번처럼 보인다.
 */
export type CodeFieldKind = "ORIGIN_EXTRACTED" | "CANDIDATE_CONFIRMED" | "SELLER_OWN";

export const CODE_FIELD_LABEL: Record<CodeFieldKind, string> = {
  ORIGIN_EXTRACTED: "원상품 품번",
  CANDIDATE_CONFIRMED: "원상품 품번과 일치 확인",
  SELLER_OWN: "판매처 자체 코드(미확인)",
};

/**
 * 🔴 **판매처 코드를 품번으로 승격하지 않는다** — 그 금지는 실측으로 확정됐다
 *    (`candidate-code-parity-01` · 승격하면 `slugCarriesCode` 로 **근거 없는 SAME** 이 난다).
 * 🟢 그래서 이 함수는 **라벨만** 고른다. 값을 바꾸거나 합치지 않는다.
 */
export function codeFieldLabel(kind: CodeFieldKind): string {
  return CODE_FIELD_LABEL[kind];
}
