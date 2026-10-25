import { canonicalizeProductUrl } from "@commerce/crawler";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-131 — **후보 검토 이력** 의 데이터 계층 (운영에 «없던» 계층)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정기가 아니다.** 이 파일은 점수도 verdict 도 가격도 만들지 않는다 —
 *    MI 가 낸 값을 `system_*` 로 **그대로 보관** 하고, 사람이 누른 값을
 *    `human_verdict` 에 **따로** 둔다. 🔴 둘은 서로 덮지 않는다(그 불일치가 GT 다).
 *
 * 🔴 **가격은 표시용** 이다 — 집계·판정·alert 에 들어가지 않는다(WU-131 §13).
 * 🔴 **URL 정규화기를 새로 만들지 않았다** — `canonicalizeProductUrl`(WU-009C)을 쓴다.
 *    그 함수는 추적/검색 파라미터만 걷고 **식별 파라미터는 보존** 한다(국내 Cafe24 계열이
 *    `?branduid=` 로 상품을 가르므로 쿼리를 통째로 버리면 다른 상품이 한 행으로 접힌다).
 */

/** 🔴 네 상태뿐이다 — DB check constraint 와 **같은 어휘** 다(갈라지면 저장이 터진다). */
export const HUMAN_VERDICTS = ["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED"] as const;
export type HumanVerdict = (typeof HUMAN_VERDICTS)[number];

export function isHumanVerdict(v: unknown): v is HumanVerdict {
  return typeof v === "string" && (HUMAN_VERDICTS as readonly string[]).includes(v);
}

/** 🔴 출처. DB check constraint 와 같은 집합이다. */
export type ReviewSource = "OVERSEAS_AUTO" | "DOMESTIC_REGISTRY" | "SELLER_URL" | "GEMINI" | "GT_IMPORT";

export interface CandidateReviewRow {
  candidateUrl: string;
  candidateDomain: string | null;
  candidateTitle: string | null;
  imageUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  market: string | null;
  systemVerdict: string | null;
  matchTruth: string | null;
  priceTier: string | null;
  blockers: string[];
  humanVerdict: HumanVerdict | null;
  source: ReviewSource;
  firstSeenAt: string;
  lastSeenAt: string;
  reviewedAt: string | null;
}

/** 🟢 「이번에 본 후보」를 남길 때 쓰는 입력. 🔴 `humanVerdict` 는 **여기 없다** —
 *  사람 판단은 오직 `saveHumanVerdict` 로만 들어간다(자동 경로가 GT 를 쓰지 못하게). */
export interface SeenCandidateInput {
  candidateUrl: string;
  candidateDomain?: string | null;
  candidateTitle?: string | null;
  imageUrl?: string | null;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  market?: string | null;
  systemVerdict?: string | null;
  matchTruth?: string | null;
  priceTier?: string | null;
  blockers?: string[];
  source: ReviewSource;
}

/**
 * 🔴 식별 키 — 호출부가 **각자 정규화하지 않는다**(두 곳이 갈라지면 같은 후보가 두 행이 된다).
 * 🟢 소문자로 맞춘다 — host 대문자 차이로 행이 갈리지 않게.
 */
export function reviewKey(rawUrl: string): string {
  return canonicalizeProductUrl(rawUrl).toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRow = (r: any): CandidateReviewRow => ({
  candidateUrl: r.candidate_url,
  candidateDomain: r.candidate_domain ?? null,
  candidateTitle: r.candidate_title ?? null,
  imageUrl: r.image_url ?? null,
  priceAmount: r.price_amount == null ? null : Number(r.price_amount),
  priceCurrency: r.price_currency ?? null,
  market: r.market ?? null,
  systemVerdict: r.system_verdict ?? null,
  matchTruth: r.match_truth ?? null,
  priceTier: r.price_tier ?? null,
  blockers: Array.isArray(r.blockers) ? r.blockers : [],
  humanVerdict: isHumanVerdict(r.human_verdict) ? r.human_verdict : null,
  source: r.source,
  firstSeenAt: r.first_seen_at,
  lastSeenAt: r.last_seen_at,
  reviewedAt: r.reviewed_at ?? null,
});

/**
 * 이 원상품의 검토 이력 **전부**.
 *
 * 🔴🔴 축이 **둘** 이다 — 지금 화면의 `snapshotId` «그리고» 과거 GT 의 `originCode`.
 *    후자가 없으면 **snapshot 이 생기기 전에 사람이 판단한 것** 이 영원히 안 보인다
 *    (WU-131 §2 가 찾은 그 공백이다).
 * 🔴 workspace 가 다르면 돌려주지 않는다 — 단 `GT_IMPORT` 행은 운영 공용이라
 *    `workspace_id` 가 null 이고 그 경우는 통과시킨다.
 */
export async function listCandidateReviews(input: {
  snapshotId: string;
  originCode: string | null;
  workspaceId: string;
}): Promise<CandidateReviewRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const ors = [`snapshot_id.eq.${input.snapshotId}`];
  if (input.originCode) ors.push(`origin_code.eq.${input.originCode}`);
  const { data, error } = await supabase
    .from("candidate_reviews")
    .select("*")
    .or(ors.join(","))
    .order("last_seen_at", { ascending: false });
  if (error) {
    console.warn("[candidate-review] 조회 실패:", error.message);
    return [];
  }
  return (data as any[])
    .filter((r) => r.workspace_id == null || r.workspace_id === input.workspaceId)
    .map(toRow);
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AA — **가격 자격 전용 리더.** 범위가 아래 재투입과 «다르다»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 범위를 고정했다**(2026-10-25):
 * ```
 * 「사람 판정의 효력 범위 → **스냅샷 + 후보 URL** 한정.
 *   URL 전역 SAME 으로 만들지 않습니다. 같은 URL 이 다른 원상품에서는 다른
 *   상품일 수 있기 때문입니다.」
 * ```
 *
 * 🔴🔴 **그래서 `listReviewedSameUrls` 를 재사용하지 «않는다».** 두 축의 범위가 다르다:
 * ```
 * 재투입(아래)      snapshot_id **OR** origin_code   — 범위가 «넓다»
 *                   ⟹ 위험이 **fetch 비용** 뿐이다(판정은 페이지를 다시 열어 새로 낸다)
 * 가격 자격(이 함수) snapshot_id **만**              — 범위가 «좁다»
 *                   ⟹ 위험이 **오판** 이다(그 금액이 셀러의 가격 판단에 들어간다)
 * ```
 * 🔴 두 함수를 합치면 범위가 **넓은 쪽으로** 끌려간다 ⟹ CPO 가 금지한
 *    「URL 전역 SAME」이 조용히 생긴다. 그래서 **질의를 따로 둔다**
 *    (`listCandidateReviews` 는 `snapshotId` 를 돌려주지 않아 사후 필터도 불가능하다).
 *
 * 🔴 **`SAME` 만** 자격을 얻는다 — CPO 확정:
 * ```
 * SAME → VERIFIED_SAME   ·   DIFFERENT → EXCLUDED   ·   UNCERTAIN/UNDECIDED → EXCLUDED
 * ```
 * 🔴 `SIMILAR` 도 **자격이 없다**(「유사상품을 형성대에 섞지 않는다」 · CORE-2U).
 *
 * 🔴 돌려주는 것은 **정규화된 URL 키 집합** 이다 — verdict 문자열을 밖으로 내보내지
 *    않는다(그것이 나가면 하류가 사람 판단을 MI 라벨처럼 쓰게 된다).
 */
export async function listSnapshotVerifiedSameKeys(input: {
  snapshotId: string;
  workspaceId: string;
}): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("candidate_reviews")
    .select("candidate_url, human_verdict, workspace_id, snapshot_id")
    /** 🔴 **`origin_code` 축을 쓰지 않는다** — 그것이 CPO 가 막은 「URL 전역」이다. */
    .eq("snapshot_id", input.snapshotId)
    .eq("human_verdict", "SAME");
  if (error) {
    console.warn("[candidate-review] 가격 자격 조회 실패:", error.message);
    return [];
  }
  const keys = new Set<string>();
  for (const r of data as any[]) {
    /** 🔴 다른 workspace 의 판단은 쓰지 않는다 — 단 운영 공용(GT) 행은 통과(위 규약과 동일). */
    if (r.workspace_id != null && r.workspace_id !== input.workspaceId) continue;
    if (typeof r.candidate_url !== "string" || !r.candidate_url) continue;
    keys.add(reviewKey(r.candidate_url));
  }
  return [...keys];
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 WU-132 ⑥ — **셀러가 「동일상품」이라 한 URL 만** 돌려준다 (재투입 입력)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — WU-118 이 측정했다: 사람이 SAME 이라 한 URL 을 다시 넣으면
 * **19/19 가 후보로 살아남는다**(파이프라인이 그 URL 을 버리지 않는다). 없던 것은
 * **그 URL 을 다음 조회의 입력으로 되돌리는 경로** 하나였다.
 *
 * 🔴 **`SAME` 만** 고른다. 과거 `DIFFERENT`/`SIMILAR`/`UNDECIDED` 는 **넣지 않는다**
 *    (CPO 금지 — 「과거 DIFFERENT 는 자동 편입 금지」).
 * 🔴 **사람 판단을 MI 판정으로 위조하지 않는다.** 이 함수가 돌려주는 것은 **URL 뿐**
 *    이고, 그 URL 이 동일상품인지는 기존 판정기가 페이지를 열어 **처음부터 다시** 낸다.
 * 🔴 **새 질의를 만들지 않는다** — 이력 조회 owner(`listCandidateReviews`)를 그대로
 *    쓴다(두 곳이 갈라지면 화면의 이력과 재투입 대상이 달라진다).
 * 🔴 상한을 받는다 — 재투입이 fetch 비용이므로 호출부가 그 값을 소유한다.
 */
export async function listReviewedSameUrls(input: {
  snapshotId: string;
  originCode: string | null;
  workspaceId: string;
  limit: number;
}): Promise<string[]> {
  if (input.limit <= 0) return [];
  const rows = await listCandidateReviews(input);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.humanVerdict !== "SAME") continue;
    /** 🔴 저장 키와 **같은 정규화기** 로 접는다 — 두 축(snapshot/originCode)에서
     *  같은 URL 이 두 행으로 올 수 있다(부분 유니크가 둘이다 · WU-131 계약 ⒝). */
    const key = reviewKey(r.candidateUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(r.candidateUrl);
    if (urls.length >= input.limit) break;
  }
  return urls;
}

/**
 * 「이번 조회에서 본 후보」를 남긴다(= 📚 이력의 생산자).
 *
 * 🔴🔴 **사람 판단을 건드리지 않는다.** `human_verdict`/`reviewed_at` 을 쓰지 않으므로
 *    이미 판단한 후보가 재조회로 **초기화되지 않는다**(이 함수의 가장 중요한 성질).
 * 🟢 `last_seen_at` 만 갱신한다 — 「언제 마지막으로 보였나」가 화면에 필요하다.
 * 🔴 실패해도 **throw 하지 않는다** — 이력 저장 실패가 가격확인 자체를 깨뜨리지 않는다.
 */
/* ═══════ 🔴🔴🔴 WU-141-R1 STEP 4 — **「저장 실패」의 원인은 `ON CONFLICT` 였다** ═══════
 *
 * 🔴🔴 **운영 DB 실측(2026-10-21 · `scripts/wu-141-review-save-probe.mjs`)**:
 * ```
 * 079 의 유니크는 **부분(partial) 인덱스 둘** 이다 —
 *   candidate_reviews_snapshot_url_key  on (snapshot_id, candidate_url) WHERE snapshot_id is not null
 *   candidate_reviews_origin_url_key    on (origin_code, candidate_url) WHERE snapshot_id is null …
 * 그런데 이 파일은 `.upsert(…, { onConflict: "snapshot_id,candidate_url" })` 를 썼다.
 * PostgREST 는 그것을 `ON CONFLICT (snapshot_id, candidate_url) DO UPDATE` 로 번역하고,
 * 🔴 Postgres 는 **부분 인덱스를 술어 없이 추론하지 못한다** ⟹ 실측 결과:
 *    ⒜ 앱과 같은 문장               → **42P10** 「no unique or exclusion constraint
 *                                     matching the ON CONFLICT specification」
 *    ⒝ `… WHERE snapshot_id is not null` 을 같이 준 문장 → 🟢 성공
 * ⟹ 🔴🔴 **쓰기 경로가 WU-131 이후 «한 번도» 성공하지 못했다.** 네 판단 전부 실패이고
 *    (CEO 가 본 그것) 📚 이력(`recordSeenCandidates`)도 **조용히** 0 을 돌려주고 있었다
 *    (그 함수는 throw 하지 않는다 ⟹ 화면이 아무 말도 하지 않았다).
 * ```
 * 🟢 **고치는 방법으로 schema 를 바꾸지 않았다.** 부분 유니크 둘은 WU-131 이 계약으로
 *    잠근 설계이고(「UNIQUE 를 candidate_url 단독으로 두지 않는다」), 운영 schema 변경은
 *    STOP 조건에 가깝다. 🔴 그래서 **문장 모양만** 바꿨다 —
 *    `조회 → 있으면 update / 없으면 insert`, 그리고 **경쟁 삽입은 `23505` 로 받아 갱신**.
 * 🟢 부분 유니크 인덱스의 **방어는 그대로 살아 있다**(무결성을 느슨하게 하지 않았다).
 */
const UNIQUE_VIOLATION = "23505";

/**
 * 그 스냅샷에서 같은 후보 URL 의 행 id. 🔴 **키 축은 `(snapshot_id, candidate_url)`** 이고
 * 그것이 079 의 부분 유니크 인덱스와 같은 축이다(새 키를 만들지 않는다).
 */
async function findReviewId(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  snapshotId: string,
  key: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("candidate_reviews")
    .select("id")
    .eq("snapshot_id", snapshotId)
    .eq("candidate_url", key)
    .maybeSingle();
  if (error) {
    console.warn(`[candidate-review] 기존 행 조회 실패(${error.code}):`, error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

export async function recordSeenCandidates(input: {
  snapshotId: string;
  originCode: string | null;
  workspaceId: string;
  candidates: readonly SeenCandidateInput[];
}): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase || input.candidates.length === 0) return 0;
  const now = new Date().toISOString();
  /** 🔴 같은 요청 안에서 같은 키가 둘이면 upsert 가 터진다 — 먼저 접는다. */
  const byKey = new Map<string, SeenCandidateInput>();
  for (const c of input.candidates) {
    const k = reviewKey(c.candidateUrl);
    if (!byKey.has(k)) byKey.set(k, c);
  }
  const rows = [...byKey.entries()].map(([key, c]) => ({
    workspace_id: input.workspaceId,
    snapshot_id: input.snapshotId,
    origin_code: input.originCode,
    candidate_url: key,
    candidate_domain: c.candidateDomain ?? null,
    candidate_title: c.candidateTitle ?? null,
    image_url: c.imageUrl ?? null,
    price_amount: c.priceAmount ?? null,
    price_currency: c.priceCurrency ?? null,
    market: c.market ?? null,
    system_verdict: c.systemVerdict ?? null,
    match_truth: c.matchTruth ?? null,
    price_tier: c.priceTier ?? null,
    blockers: c.blockers ?? [],
    source: c.source,
    last_seen_at: now,
  }));
  /**
   * 🔴 같은 이유로 `upsert` 를 쓸 수 없다(위 블록의 42P10 실측). 🟢 **키 조회 한 번** 으로
   *    기존/신규를 가른 뒤, 신규는 **한 번에 insert** 하고 기존만 갱신한다.
   * 🔴🔴 갱신 payload 에 `human_verdict`/`human_note`/`reviewed_at` 이 **없다** —
   *    이력 기록이 **셀러 판단을 덮지 않는다**(WU-131 의 가장 중요한 성질 · 계약으로 잠김).
   */
  const keys = rows.map((r) => r.candidate_url);
  const { data: existing, error: lookupError } = await supabase
    .from("candidate_reviews")
    .select("id, candidate_url")
    .eq("snapshot_id", input.snapshotId)
    .in("candidate_url", keys);
  if (lookupError) {
    console.warn(`[candidate-review] 이력 조회 실패(${lookupError.code}):`, lookupError.message);
    return 0;
  }
  const idByKey = new Map<string, string>();
  for (const r of (existing ?? []) as { id: string; candidate_url: string }[]) {
    idByKey.set(r.candidate_url, r.id);
  }

  let written = 0;
  const fresh = rows.filter((r) => !idByKey.has(r.candidate_url));
  if (fresh.length > 0) {
    const { error } = await supabase.from("candidate_reviews").insert(fresh);
    if (error) {
      /** 🔴 경쟁 삽입(`23505`)은 다음 조회에서 갱신되므로 이력 하나를 잃는 것이 전부다. */
      console.warn(`[candidate-review] 이력 신규 저장 실패(${error.code}):`, error.message);
    } else {
      written += fresh.length;
    }
  }
  for (const row of rows) {
    const id = idByKey.get(row.candidate_url);
    if (!id) continue;
    /** 🔴 `workspace_id`/`snapshot_id`/`candidate_url` 는 키라서 **다시 쓰지 않는다**. */
    const { workspace_id: _w, snapshot_id: _s, candidate_url: _u, ...observed } = row;
    const { error } = await supabase.from("candidate_reviews").update(observed).eq("id", id);
    if (error) {
      console.warn(`[candidate-review] 이력 갱신 실패(${error.code}):`, error.message);
      continue;
    }
    written += 1;
  }
  return written;
}

/**
 * 셀러 판단을 저장한다.
 *
 * 🔴🔴 **`system_*` 를 쓰지 않는다** — MI 산출을 사람 판단으로 덮지 않는 것이 이 WU 의 계약이다.
 * 🟢 후보 행이 아직 없으면(이력보다 먼저 눌린 경우) 만들면서 넣는다.
 */
export async function saveHumanVerdict(input: {
  snapshotId: string;
  originCode: string | null;
  workspaceId: string;
  candidateUrl: string;
  humanVerdict: HumanVerdict;
  humanNote?: string | null;
  source?: ReviewSource;
}): Promise<CandidateReviewRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const now = new Date().toISOString();
  const key = reviewKey(input.candidateUrl);

  /**
   * 🔴 **셀러 판단만 쓴다** — `system_*` 칸은 **건드리지 않는다**(WU-131 양방향 계약).
   *    insert 경로에서도 그 칸들을 넣지 않으므로 사람 판단이 MI 산출을 덮지 않는다.
   */
  const verdictFields = {
    human_verdict: input.humanVerdict,
    human_note: input.humanNote ?? null,
    reviewed_at: now,
    last_seen_at: now,
  };

  const existingId = await findReviewId(supabase, input.snapshotId, key);
  if (existingId) {
    const { data, error } = await supabase
      .from("candidate_reviews")
      .update(verdictFields)
      .eq("id", existingId)
      .select("*")
      .maybeSingle();
    if (error) {
      console.warn(`[candidate-review] 판단 갱신 실패(${error.code}):`, error.message);
      return null;
    }
    return data ? toRow(data) : null;
  }

  const { data, error } = await supabase
    .from("candidate_reviews")
    .insert({
      workspace_id: input.workspaceId,
      snapshot_id: input.snapshotId,
      origin_code: input.originCode,
      candidate_url: key,
      source: input.source ?? "SELLER_URL",
      ...verdictFields,
    })
    .select("*")
    .maybeSingle();
  if (!error) return data ? toRow(data) : null;

  /**
   * 🔴 **경쟁 삽입** — 조회와 삽입 사이에 `recordSeenCandidates` 가 같은 키를 넣었으면
   *    부분 유니크 인덱스가 `23505` 로 막는다(그 방어는 **그대로 유지** 한다).
   * 🟢 그때는 한 번 더 찾아 **갱신** 한다 — 셀러의 클릭을 잃지 않는다.
   */
  if (error.code === UNIQUE_VIOLATION) {
    const raced = await findReviewId(supabase, input.snapshotId, key);
    if (raced) {
      const { data: updated, error: updateError } = await supabase
        .from("candidate_reviews")
        .update(verdictFields)
        .eq("id", raced)
        .select("*")
        .maybeSingle();
      if (!updateError) return updated ? toRow(updated) : null;
      console.warn(`[candidate-review] 경쟁 삽입 후 갱신 실패(${updateError.code}):`, updateError.message);
      return null;
    }
  }
  console.warn(`[candidate-review] 판단 저장 실패(${error.code}):`, error.message);
  return null;
}
