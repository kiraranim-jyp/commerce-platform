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
  const { error } = await supabase
    .from("candidate_reviews")
    .upsert(rows, { onConflict: "snapshot_id,candidate_url", ignoreDuplicates: false });
  if (error) {
    console.warn("[candidate-review] 이력 저장 실패:", error.message);
    return 0;
  }
  return rows.length;
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
  const { data, error } = await supabase
    .from("candidate_reviews")
    .upsert(
      {
        workspace_id: input.workspaceId,
        snapshot_id: input.snapshotId,
        origin_code: input.originCode,
        candidate_url: reviewKey(input.candidateUrl),
        human_verdict: input.humanVerdict,
        human_note: input.humanNote ?? null,
        source: input.source ?? "SELLER_URL",
        reviewed_at: now,
        last_seen_at: now,
      },
      { onConflict: "snapshot_id,candidate_url", ignoreDuplicates: false },
    )
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[candidate-review] 판단 저장 실패:", error.message);
    return null;
  }
  return data ? toRow(data) : null;
}
