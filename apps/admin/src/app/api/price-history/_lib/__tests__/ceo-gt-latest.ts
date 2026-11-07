import ceoEvidenceReview from "./fixtures/ceo-evidence-review-gt.json";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 최신 판단 — «별도 버전» 으로 보존한다**(CPO 결정 ① · 2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기존 기준선을 덮어쓰지 않는다**(CPO 명시):
 * ```
 * ❌ `SAME05_BASELINE` 수정        ❌ `wu-059-gt-facts.json` 수정
 * ❌ `CEO_RELABEL` 에 C42/C50 추가  ❌ Main Story 제외 정책 · 22쌍 운영 적격 분모 변경
 * ✅ **최신 CEO 판단은 이 파일에서 «따로» 읽는다** — 역사와 최신을 하나로 합치지 않는다
 * ```
 *
 * ── 🔴 왜 별도 버전인가 — DB 가 이미 그 상황이다 ────────────────────────────
 * 운영 `candidate_reviews` 실측(2026-11-07): 같은 후보 URL 에 **서로 다른 사람 판단이
 * 이미 공존** 한다(`villagekids.co.uk/products/pale-blue-3d-logo-t-shirt` →
 * `DIFFERENT | SAME` 둘 다 실재). 🔴 그리고 그 표에는 **버전·이력 칸이 0** 이다
 * (`version`/`history`/`revision`/`prev`/`superseded` 전부 없음 · 실측).
 * ⟹ 🔴 「최신으로 덮어쓴다」를 코드에서 하면 **그 충돌이 보이지 않게 된다.**
 *
 * ── 🔴 CTO 가 «하지 않은» 것 ────────────────────────────────────────────────
 *  · 그룹 `ceoNote` 를 개별 쌍에 **분배하지 않았다**(CPO §5 금지 · 고유 note 는 5개다)
 *  · `ceoAxes` 를 **추론해 채우지 않았다**(전건 `{}` 그대로 · CPO §4·§6 금지)
 *  · 원문을 **한 글자도 가공하지 않았다**
 */

export type CeoVerdict = "SAME" | "DIFFERENT" | "UNDECIDED";

export interface CeoLatestLabel {
  id: string;
  /** 🔴 **원문 그대로** — 가공 금지(계약이 바이트 동일을 단언한다). */
  ceoNote: string;
  ceoVerdict: CeoVerdict;
  /** 🔴 전건 `{}` 다. **추론해 채우지 않는다**(미입력과 UNKNOWN 은 다르다). */
  ceoAxes: Record<string, unknown>;
  domain: string;
  originUrl: string;
  candidateUrl: string;
  /** 그 쌍의 **이전** 사람 판단(없으면 null). 🔴 덮어쓰지 않고 **같이** 들고 있는다. */
  priorCeoVerdict: string | null;
}

interface RawPair {
  id: string;
  domain: string;
  originUrl: string;
  candidateUrl: string;
  priorCeoVerdict: string | null;
  ceoVerdict: string;
  ceoAxes: Record<string, unknown>;
  ceoNote: string;
}

const RAW = ceoEvidenceReview as unknown as {
  review: string;
  receivedAt: string;
  pairs: RawPair[];
};

/** 🟢 수신 조서의 식별자 — 어느 조서에서 온 라벨인지 추적 가능해야 한다. */
export const CEO_LATEST_REVIEW = { review: RAW.review, receivedAt: RAW.receivedAt } as const;

const isCeoVerdict = (v: string): v is CeoVerdict => v === "SAME" || v === "DIFFERENT" || v === "UNDECIDED";

/**
 * 🔴🔴 **`readonly` 는 «타입» 일 뿐이고 런타임을 막지 못한다** — 이 세션에서 실제로
 *    당했다: 계약이 `biggest.ids.sort()` 를 써서 **export 된 공용 배열을 제자리에서
 *    뒤섞었다**(typecheck 가 잡았지만 런타임은 통과했다).
 * 🟢 그래서 **얼려서** 막는다. 이제 그런 코드는 strict mode 에서 **throw** 한다 —
 *    「다음 사람이 실수할 수 있다」가 아니라 **실수가 불가능** 해진다.
 */
const deepFreeze = <T>(v: T): T => {
  if (Array.isArray(v)) v.forEach(deepFreeze);
  else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(v);
};

/** 🔴 조서 전건. 걸러내지 않는다 — 분모를 여기서 줄이면 그 사실이 사라진다. */
export const CEO_LATEST_LABELS: readonly CeoLatestLabel[] = deepFreeze(
  RAW.pairs.map((p) => {
    if (!isCeoVerdict(p.ceoVerdict)) throw new Error(`알 수 없는 CEO 판정: ${p.id}=${p.ceoVerdict}`);
    return {
      id: p.id,
      ceoNote: p.ceoNote,
      ceoVerdict: p.ceoVerdict,
      ceoAxes: p.ceoAxes,
      domain: p.domain,
      originUrl: p.originUrl,
      candidateUrl: p.candidateUrl,
      priorCeoVerdict: p.priorCeoVerdict ?? null,
    };
  }),
);

/**
 * 🔴 **기준선 충돌** — 이전 사람 판단과 최신 CEO 판단이 다른 쌍.
 *
 * 🔴 「최신이 이긴다」로 **접지 않는다**(CPO ①: 「기존 SAME 과 최신 DIFFERENT 가
 *    공존하는 기준선 충돌로 관리한다」). 그래서 **둘 다** 들고 있다.
 */
export interface CeoBaselineConflict {
  id: string;
  prior: string;
  latest: CeoVerdict;
}

export const CEO_BASELINE_CONFLICTS: readonly CeoBaselineConflict[] = deepFreeze(
  CEO_LATEST_LABELS.filter((l) => l.priorCeoVerdict != null && l.priorCeoVerdict !== l.ceoVerdict).map((l) => ({
    id: l.id,
    prior: l.priorCeoVerdict!,
    latest: l.ceoVerdict,
  })),
);

/**
 * 🔴🔴 **확정 정확도 분모에서 빠지는 쌍**(CPO ①: 「C50 은 UNDECIDED 로 유지하며
 *    확정 GT 정확도 계산에서 제외한다」).
 *
 * 🔴 술어는 **`UNDECIDED` 하나** 다 — 「404 라서」를 조건으로 쓰지 않는다. 사유는
 *    `ceoNote` 에 있고(원문), **사유를 코드가 해석하면 그것이 자동 구조화** 다(CPO 금지).
 */
export const CEO_UNDECIDED_IDS: readonly string[] = CEO_LATEST_LABELS.filter(
  (l) => l.ceoVerdict === "UNDECIDED",
).map((l) => l.id);

/** 확정 분모 — `UNDECIDED` 를 뺀 쌍. 🔴 이것이 **최신 조서의** 분모이고 33쌍이 아니다. */
export const CEO_LATEST_DECIDED: readonly CeoLatestLabel[] = CEO_LATEST_LABELS.filter(
  (l) => l.ceoVerdict !== "UNDECIDED",
);

/**
 * 🔵 **그룹별 근거** — 고유 `ceoNote` 단위로 묶는다.
 *
 * 🔴🔴 **쌍별 근거가 아니다.** 11쌍이 고유 note **5개** 를 공유한다(실측) ⟹
 *    CPO §5: 「그룹 메모를 CTO 가 임의로 개별 쌍에 분배하지 않는다」.
 * 🟢 그래서 묶음을 **그대로 노출** 한다 — 쪼개는 것은 사람이 확인할 일이다.
 */
export interface CeoNoteGroup {
  ids: readonly string[];
  /** 🔴 원문 그대로. */
  note: string;
  verdicts: readonly CeoVerdict[];
}

export const CEO_NOTE_GROUPS: readonly CeoNoteGroup[] = (() => {
  const by = new Map<string, { ids: string[]; verdicts: CeoVerdict[] }>();
  for (const l of CEO_LATEST_LABELS) {
    const g = by.get(l.ceoNote) ?? { ids: [], verdicts: [] };
    g.ids.push(l.id);
    if (!g.verdicts.includes(l.ceoVerdict)) g.verdicts.push(l.ceoVerdict);
    by.set(l.ceoNote, g);
  }
  return [...by.entries()].map(([note, g]) => ({ ids: g.ids, note, verdicts: g.verdicts }));
})();
