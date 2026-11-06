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

export interface SellerProbabilityResult {
  probability: SellerProbability;
  findings: CoreAxisFinding[];
  matchedCount: number;
  mismatchedCount: number;
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
  const mismatchedCount = findings.filter((f) => f.state === "MISMATCHED").length;
  const unknownCount = findings.filter((f) => f.state === "UNKNOWN").length;

  const probability: SellerProbability =
    mismatchedCount > 0
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
    mismatchedCount,
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
  if (r.mismatchedCount > 0) return `${core} · 확인된 불일치 ${r.mismatchedCount}건`;
  if (r.unknownCount > 0) return `${core} · 미확인 ${r.unknownCount}건`;
  return core;
}
