/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **8축 증거를 «읽는» 쪽**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드가 **아니다.** MI 를 한 글자도 바꾸지 않는다 —
 *    `compareCrossSellerProducts` 가 **이미 낸 결과** 를 화면 어휘로 **옮기기만** 한다.
 *
 * ── 🔴🔴 지시서의 「8축」은 코드의 축 이름과 **같지 않다** ────────────────────
 * ```
 * START-HERE §9  BRAND · TITLE · MODEL_CODE · COLOR · MATERIAL · FIT ·
 *                GARMENT_FORM · AUDIENCE_LINE
 * 코드 실제      CrossSellerAxis = TITLE · MODEL_CODE · CATEGORY · COLOR ·
 *                MATERIAL · FIT · AUDIENCE · SIZE · IMAGE
 * ⟹ 🔴 `BRAND` · `GARMENT_FORM` · `AUDIENCE_LINE` 은 **축이 아니라 blocker** 다
 *    (`BRAND_UNCONFIRMED` / `BRAND_MISMATCH` · `GARMENT_FORM` · `AUDIENCE_LINE`).
 * 🔴 그래서 「BRAND 축이 몇 점」이라고 **지어내지 않는다** — 축에서 온 값인지
 *    blocker/conflict 에서 온 값인지를 `from` 칸에 **적는다.**
 * ```
 *
 * ── 🔴🔴🔴 가장 중요한 성질 — **충돌이면 축이 «계산되지 않는다»** ───────────
 * ```
 * `cross-seller.ts:898` 의 조기 반환이 `axes: []` 를 돌려준다.
 * ⟹ MODEL_CODE 충돌 하나로 **TITLE 축이 계산조차 되지 않는다**(START-HERE §11 의
 *   「SI-3 사정거리」가 바로 이 사실이다).
 * 🔴 그때 나머지 축을 「UNKNOWN」으로 적으면 **「봤지만 몰랐다」로 읽힌다.**
 *    사실은 **「보지 않았다」** 다 ⟹ `NOT_AVAILABLE` + `earlyReturn` 으로 가른다.
 * ```
 */
import type {
  CrossSellerAxis,
  CrossSellerMatch,
} from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";

/**
 * 🔴 `FAIL` 과 `CONFLICT` 를 합치지 않는다 — 전자는 **보류**(SAME 을 막지만 다르다고
 *    말하지 않는다), 후자는 **반증**(점수를 보기 전에 판정이 끝난다)이다.
 * 🔴 `UNKNOWN`(비교했지만 근거 부족) 과 `NOT_AVAILABLE`(값이 없어서 / 계산되지
 *    않아서 비교 자체를 못 했다)도 합치지 않는다.
 */
export type Same03AxisState = "PASS" | "FAIL" | "CONFLICT" | "UNKNOWN" | "NOT_AVAILABLE";

export interface Same03AxisRow {
  /** 지시서가 쓰는 이름(화면 라벨). */
  label: string;
  state: Same03AxisState;
  /** 🔴 이 상태가 **어디서** 왔는가 — 축 점수 / 보류 / 반증 / 값 없음. */
  from: "AXIS" | "BLOCKER" | "CONFLICT" | "NO_VALUE" | "NOT_COMPUTED";
  /** MI 가 적어 둔 사람이 읽는 설명. 🔴 없으면 빈 문자열이고 지어내지 않는다. */
  detail: string;
  /** 축 점수(축에서 온 경우만). */
  points: number | null;
  /** 🔴 원상품 값 ↔ 후보 값을 **나란히** 보여준다(§9 raw evidence). */
  originValue: string | null;
  candidateValue: string | null;
}

export interface Same03Evidence {
  rows: Same03AxisRow[];
  /** 🔴🔴 충돌로 **조기 종료** 되어 축이 하나도 계산되지 않았다. */
  earlyReturn: boolean;
  /** 눈에 띄게 보여야 하는 것 — 보류/반증 원문. */
  blockers: { name: string; detail: string }[];
  conflicts: { name: string; detail: string }[];
}

const text = (v: unknown): string | null => {
  if (Array.isArray(v)) return v.length ? v.join(" · ") : null;
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

/**
 * 🔴 지시서의 8축 + `IMAGE`.
 * 🔴 `IMAGE` 는 **실제로 계산될 때만** 행을 만든다(§9) — 지금 후보 `imageUrl` 은
 *    추출 경로에서 하드코딩 `null` 이라(§9 공급 문제) 보통 계산되지 않는다.
 *    🔴 그때 「이미지 축 UNKNOWN」을 적으면 **축이 있는 것처럼** 읽힌다.
 */
const SPEC: {
  label: string;
  axis: CrossSellerAxis | null;
  blockers: string[];
  conflicts: string[];
  originOf: (f: ProductFacts) => string | null;
}[] = [
  { label: "BRAND", axis: null, blockers: ["BRAND_MISMATCH", "BRAND_UNCONFIRMED"], conflicts: [], originOf: (f) => text(f.brand) },
  { label: "TITLE", axis: "TITLE", blockers: ["NO_TITLE_OVERLAP"], conflicts: [], originOf: (f) => text(f.coreTitleTokens) },
  { label: "MODEL_CODE", axis: "MODEL_CODE", blockers: ["SAME_SELLER_DISTINCT_LISTING"], conflicts: ["MODEL_CODE"], originOf: (f) => text(f.brandModelCode) },
  { label: "COLOR", axis: "COLOR", blockers: ["COLOR_VARIANT"], conflicts: ["COLOR"], originOf: (f) => text(f.colorText) },
  { label: "MATERIAL", axis: "MATERIAL", blockers: ["MATERIAL"], conflicts: [], originOf: (f) => text(f.materialText) },
  { label: "FIT", axis: "FIT", blockers: ["FIT"], conflicts: [], originOf: (f) => text(f.fitText) },
  { label: "GARMENT_FORM", axis: "CATEGORY", blockers: ["GARMENT_FORM"], conflicts: ["CATEGORY", "COMPOSITION"], originOf: (f) => text(f.categoryText) },
  {
    label: "AUDIENCE_LINE",
    axis: "AUDIENCE",
    blockers: ["AUDIENCE_LINE", "SIZE_SYSTEM"],
    conflicts: ["AUDIENCE", "GENDER"],
    originOf: (f) => text(f.ageRangeText) ?? text(f.audienceSignals),
  },
];

export function buildSame03Evidence(
  cross: CrossSellerMatch,
  originFacts: ProductFacts,
  candidateFacts: ProductFacts,
): Same03Evidence {
  const blockers = cross.blockers.map((b) => ({ name: String(b.blocker), detail: b.detail }));
  const conflicts = cross.conflicts.map((c) => ({ name: String(c.conflict), detail: c.detail }));
  /**
   * 🔴 「조기 종료」를 **추측하지 않는다** — `cross-seller.ts` 가 반증을 만났을 때만
   *    `axes` 를 비운 채 반환한다. 둘을 **같이** 봐야 「축이 0개인 정상 결과」와
   *    구분된다.
   */
  const earlyReturn = conflicts.length > 0 && cross.axes.length === 0;

  const rows: Same03AxisRow[] = SPEC.map((spec) => {
    const originValue = spec.originOf(originFacts);
    const candidateValue = spec.originOf(candidateFacts);
    const base = { label: spec.label, originValue, candidateValue };

    const conflict = conflicts.find((c) => spec.conflicts.includes(c.name));
    if (conflict) {
      return { ...base, state: "CONFLICT" as const, from: "CONFLICT" as const, detail: conflict.detail, points: null };
    }
    const blocker = blockers.find((b) => spec.blockers.includes(b.name));
    if (blocker) {
      /**
       * 🔴 `BRAND_UNCONFIRMED` 는 「읽지 못했다」이고 `BRAND_MISMATCH` 는 「읽었는데
       *    달랐다」다 — `cross-seller.ts` 의 `OBSERVED_DIFFERENCE_BLOCKERS` 가 그 선을
       *    긋는다. 🔴 모름을 `FAIL` 로 적으면 그 구분이 화면에서 사라진다.
       */
      const unconfirmed = blocker.name === "BRAND_UNCONFIRMED";
      return {
        ...base,
        state: unconfirmed ? ("UNKNOWN" as const) : ("FAIL" as const),
        from: "BLOCKER" as const,
        detail: blocker.detail,
        points: null,
      };
    }
    const axis = spec.axis ? cross.axes.find((a) => a.axis === spec.axis) : undefined;
    if (axis) {
      return { ...base, state: "PASS" as const, from: "AXIS" as const, detail: axis.detail, points: axis.points };
    }
    if (earlyReturn) {
      return {
        ...base,
        state: "NOT_AVAILABLE" as const,
        from: "NOT_COMPUTED" as const,
        detail: "반증으로 조기 종료되어 이 축은 계산되지 않았습니다",
        points: null,
      };
    }
    if (!originValue || !candidateValue) {
      return {
        ...base,
        state: "NOT_AVAILABLE" as const,
        from: "NO_VALUE" as const,
        detail: !originValue && !candidateValue ? "양쪽 모두 값이 없습니다" : "한쪽에 값이 없습니다",
        points: null,
      };
    }
    return { ...base, state: "UNKNOWN" as const, from: "NO_VALUE" as const, detail: "근거가 되지 못했습니다", points: null };
  });

  /** 🟢 `IMAGE` 는 **실제로 계산됐을 때만** 행을 더한다. */
  const image = cross.axes.find((a) => a.axis === "IMAGE");
  if (image) {
    rows.push({
      label: "IMAGE",
      state: "PASS",
      from: "AXIS",
      detail: image.detail,
      points: image.points,
      originValue: text(originFacts.imageUrls),
      candidateValue: text(candidateFacts.imageUrls),
    });
  }

  return { rows, earlyReturn, blockers, conflicts };
}

/* ══════════════════════════════════════════════════════════════════════════════
   🔴 화면에 **드러내야** 하는 공급 문제 (§9 · 이미 측정됨 · 고치지 않는다)
   ══════════════════════════════════════════════════════════════════════════════ */

export interface Same03SupplyGap {
  label: string;
  note: string;
}

/**
 * 「CEO 가 SAME 이라 봤는데 시스템은 왜 막혔는가」를 화면에서 보이게 한다.
 *
 * 🔴 **고치는 코드가 아니다** — 이미 측정된 사실을 **값에서 읽어** 적는다.
 * 🔴 사실이 아닌 것은 적지 않는다 — 각 항목이 **그 후보에서 실제로 성립할 때만** 나온다.
 */
export function describeSame03SupplyGaps(
  evidence: Same03Evidence,
  candidateFacts: ProductFacts,
  imageFromPageMeta: boolean,
): Same03SupplyGap[] {
  const gaps: Same03SupplyGap[] = [];

  /** 🔴 구조적 사실 — `ProductFacts` 에 상세설명 칸이 **없다**(판정에 전달되지 않는다). */
  gaps.push({
    label: "상세설명",
    note: "판정기에 전달되는 칸이 없습니다 — 상세설명은 어느 축에도 들어가지 않습니다",
  });

  if ((candidateFacts.imageUrls ?? []).length === 0) {
    gaps.push({
      label: "이미지",
      note: imageFromPageMeta
        ? "후보 추출 경로가 이미지를 주지 않아 이 화면에서만 페이지 대표 이미지를 보충했습니다 — 판정에는 쓰이지 않았습니다"
        : "후보 추출 경로가 이미지를 주지 않았습니다 — 판정에 이미지 축이 없습니다",
    });
  }

  const modelCode = evidence.rows.find((r) => r.label === "MODEL_CODE");
  if (modelCode?.state === "CONFLICT") {
    gaps.push({
      label: "품번",
      note: "품번이 갈려 반증으로 처리됐고, 그 때문에 나머지 축이 계산되지 않았습니다",
    });
  } else if (modelCode?.state === "NOT_AVAILABLE" && modelCode.from === "NO_VALUE") {
    gaps.push({ label: "품번", note: "후보 페이지에서 공식 품번을 읽지 못했습니다" });
  }

  const title = evidence.rows.find((r) => r.label === "TITLE");
  if (title?.state === "FAIL") {
    gaps.push({
      label: "상품명",
      note: "한국어 상품명과 영문 원상품 사이에 겹치는 낱말이 없어 보류됐습니다",
    });
  }

  return gaps;
}
