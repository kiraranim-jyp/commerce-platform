import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { reviewKey } from "./candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 판단 쓰기 경로**(CPO 승인 2026-11-07 · 범위 ⒞ — **판단 본문만**)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **축(`ceo_judgment_axes`)을 쓰지 않는다.** CPO 가 범위를 **명시적으로 축소** 했다:
 * ```
 * Supabase JS 에는 트랜잭션 API 가 없고, apps/admin 은 Prisma 를 들일 수 없다
 * (계약이 `@prisma/client`·`PrismaClient` 를 금지한다). RPC 함수는 **추가 migration** 이고
 * 이번 승인에 없다. ⟹ 🔴 「판단 insert → 축 insert → 실패 시 판단 삭제」(보상 삭제)는
 *    **원자적이 아니고**, 삭제까지 실패하면 **「축 없는 판단」** 이 남는다. 그것은
 *    083 이 지키려는 **「축 미입력 ↔ 확인 불가」** 구분을 깨뜨린다.
 * ⟹ 🟢 그래서 **그 경로 자체를 만들지 않았다**(CPO 문장: 「축 INSERT 가 실패한 불완전한
 *    판단을 남기는 경로 자체를 만들지 않습니다」).
 * ```
 * 🟢 **축이 없는 판단은 «정상적인 축 미입력» 이다**(083 설계 그대로 — 행이 없으면 미입력).
 * 🔴 축 저장은 **후속 과제** 다 — RPC 신설 + 실행 권한 설계 + 단일 트랜잭션 보장 +
 *    실패 롤백 검증을 **별도 승인** 으로 받는다.
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ──────────────────────────────────────────────
 *  · `UPDATE` **0** — 판단은 **append-only** 다(기존 버전을 덮지 않는다)
 *  · 동일 내용 비교 **0** — 같은 내용을 다시 눌러도 **새 버전** 이다(CPO 결정 Ⓘ:
 *    「다시 판단하거나 재확인한 **행위 자체** 를 기록에서 없애면 안 된다」)
 *  · `rawNote` **자동 생성 0** — 시스템이 메모를 만들지 않는다(없으면 `null`)
 *  · 축 **추론 0** · `candidate_reviews` 접근 **0**(표가 다르다 ⟹ 구조적으로 불가능)
 *  · 「최신 고르기」 **0** — 조회는 **버전 전부** 를 돌려준다(충돌을 숨기지 않는다)
 */

export type CeoJudgmentVerdict = "SAME" | "DIFFERENT" | "UNDECIDED";

/** 🟢 083 의 `ceo_judgments_verdict_check` 와 **같은 집합**. 🔴 DB CHECK «앞에서» 막는다. */
export function isCeoJudgmentVerdict(v: unknown): v is CeoJudgmentVerdict {
  return v === "SAME" || v === "DIFFERENT" || v === "UNDECIDED";
}

/**
 * 🟢 083 의 `ceo_judgment_axes_state_check` 와 같은 집합.
 * 🔴 **이번 경로는 축을 쓰지 않는다** — 그래도 술어를 둔 이유는 하나다: 후속 RPC WU 가
 *    이 집합을 **다시 적지 않게** 한다(사본이 둘이 되면 DB CHECK 와 갈라진다).
 */
export type CeoAxisState = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_APPLICABLE";
export function isCeoAxisState(v: unknown): v is CeoAxisState {
  return v === "MATCH" || v === "MISMATCH" || v === "UNKNOWN" || v === "NOT_APPLICABLE";
}

export interface CeoJudgmentRow {
  id: string;
  reviewKey: string;
  pairId: string;
  originUrl: string;
  candidateUrl: string;
  reviewUrlKey: string;
  humanVerdict: CeoJudgmentVerdict;
  reviewer: string;
  reviewedAt: string;
  /** 🔴 원문 그대로. 시스템이 만들지 않는다 — 없으면 `null` 이고 빈 문자열과 섞지 않는다. */
  rawNote: string | null;
  /** 🔴 **상품 속성 축이 아니다** — 분류·판매 정책 문맥 전용(CPO 결정 ③). */
  decisionContext: string | null;
  version: number;
  /** 직전 판단 id. 🟢 이력 사슬이고 **최신을 고르는 값이 아니다**. */
  supersedesId: string | null;
  snapshotId: string | null;
  createdAt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRow = (r: any): CeoJudgmentRow => ({
  id: r.id,
  reviewKey: r.review_key,
  pairId: r.pair_id,
  originUrl: r.origin_url,
  candidateUrl: r.candidate_url,
  reviewUrlKey: r.review_url_key,
  humanVerdict: r.human_verdict,
  reviewer: r.reviewer,
  reviewedAt: r.reviewed_at,
  rawNote: r.raw_note ?? null,
  decisionContext: r.decision_context ?? null,
  version: Number(r.version),
  supersedesId: r.supersedes_id ?? null,
  snapshotId: r.snapshot_id ?? null,
  createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT =
  "id, review_key, pair_id, origin_url, candidate_url, review_url_key, human_verdict, reviewer, reviewed_at, raw_note, decision_context, version, supersedes_id, snapshot_id, created_at";

export interface SaveCeoJudgmentInput {
  reviewKey: string;
  pairId: string;
  originUrl: string;
  candidateUrl: string;
  humanVerdict: CeoJudgmentVerdict;
  reviewer: string;
  rawNote?: string | null;
  decisionContext?: string | null;
  snapshotId?: string | null;
}

/** 직전 최대 버전 한 행. 🔴 **최신 「판단」을 고르는 함수가 아니다** — 버전 계산 전용이다. */
async function latestVersion(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  reviewKeyValue: string,
  pairId: string,
): Promise<{ id: string; version: number } | null> {
  const { data, error } = await supabase
    .from("ceo_judgments")
    .select("id, version")
    .eq("review_key", reviewKeyValue)
    .eq("pair_id", pairId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: (data as { id: string }).id, version: Number((data as { version: number }).version) };
}

/**
 * **판단 한 건을 새 버전으로 저장한다.** 🔴 `UPDATE` 를 쓰지 않는다.
 *
 * ── 🔴 중복 방지 — 세 가지를 가른다 ──────────────────────────────────────────
 * ```
 * ⒜ 동시/재시도로 **같은 version 이 둘** 이 되는 것
 *    🟢 `UNIQUE (review_key, pair_id, version)` 이 **DB 에서** 막는다.
 *    🔴 그런데 `max(version)+1` 은 읽고 쓰는 사이에 **경쟁(TOCTOU)** 이 있다 ⟹
 *       동시 요청 둘이 같은 version 을 계산할 수 있다.
 *    🟢 그때 `23505` 가 나고 **1회만** 재조회·재시도한다(기존 `saveHumanVerdict` 와 같은 모양).
 *    🔴 **무한 재시도 금지** — 두 번째도 실패하면 `null` 을 돌려주고 호출부가 500 을 낸다.
 * ⒝ 같은 내용 재제출 → 🟢 **새 버전을 만든다**(CPO 결정 Ⓘ · 내용 비교 **0**)
 * ⒞ 축 중복 → 🔴 **해당 없음**(이번 경로는 축을 쓰지 않는다)
 * ```
 */
export async function saveCeoJudgment(input: SaveCeoJudgmentInput): Promise<CeoJudgmentRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  /** 🟢 저장 키는 **기존 경로와 같은 정규화기** 다 — 복제하면 조회가 못 찾는다. */
  const urlKey = reviewKey(input.candidateUrl);
  const now = new Date().toISOString();

  const attempt = async (): Promise<{ row: CeoJudgmentRow | null; conflict: boolean }> => {
    const prev = await latestVersion(supabase, input.reviewKey, input.pairId);
    const { data, error } = await supabase
      .from("ceo_judgments")
      .insert({
        review_key: input.reviewKey,
        pair_id: input.pairId,
        origin_url: input.originUrl,
        candidate_url: input.candidateUrl,
        review_url_key: urlKey,
        human_verdict: input.humanVerdict,
        reviewer: input.reviewer,
        reviewed_at: now,
        /** 🔴 **지어내지 않는다** — 안 왔으면 `null` 이다. */
        raw_note: input.rawNote ?? null,
        decision_context: input.decisionContext ?? null,
        version: (prev?.version ?? 0) + 1,
        /** 🟢 이력 사슬 — 직전 판단을 **지우지 않고 잇는다**. */
        supersedes_id: prev?.id ?? null,
        snapshot_id: input.snapshotId ?? null,
      })
      .select(SELECT)
      .maybeSingle();
    if (error) {
      /** 🔴 **유니크 충돌만** 재시도 대상이다 — 다른 오류를 재시도로 덮지 않는다. */
      const conflict = (error as { code?: string }).code === "23505";
      if (!conflict) console.warn("[ceo-judgment] 저장 실패:", (error as { code?: string }).code, error.message);
      return { row: null, conflict };
    }
    return { row: data ? toRow(data) : null, conflict: false };
  };

  const first = await attempt();
  if (first.row) return first.row;
  if (!first.conflict) return null;

  /** 🔴 **단 한 번** 만 다시 한다(무한 루프 금지 · CPO 명시). */
  const second = await attempt();
  if (!second.row && second.conflict) {
    console.warn("[ceo-judgment] 23505 재시도도 충돌 — 저장하지 않았다");
  }
  return second.row;
}

/**
 * 판단 조회. 🔴 **버전 전부** 를 돌려준다 — 「최신 고르기」는 **소비처의 일** 이다
 *    (083 인덱스 주석: 「충돌을 보여줘야 하므로 전부 남는다」).
 *
 * 🔴🔴 **범위 축이 «필수» 다.** `ceo_judgments` 에는 `workspace_id` 칸이 **없다**(083 실측) ⟹
 *    `review_url_key` 만으로 조회하면 **다른 workspace 의 판단까지** 나올 수 있다.
 *    🟢 그래서 이 함수는 `snapshotId` 를 **반드시** 받고, 호출부가 그 스냅샷의 소유권을
 *       **이미 확인한 뒤** 부른다(`getSnapshot(snapshotId, workspaceId)`).
 *    🔴 URL 키 축 조회(표시 UI 가 쓸 것)는 **이번 범위가 아니다** — 그 범위 결정과 함께 연다.
 */
export async function listCeoJudgments(input: { snapshotId: string }): Promise<CeoJudgmentRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ceo_judgments")
    .select(SELECT)
    .eq("snapshot_id", input.snapshotId)
    /** 🟢 쌍 → 버전 순. 🔴 정렬이 「최신만 고르는」 뜻은 아니다. */
    .order("pair_id", { ascending: true })
    .order("version", { ascending: true });
  if (error) {
    console.warn("[ceo-judgment] 조회 실패:", error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(toRow);
}
