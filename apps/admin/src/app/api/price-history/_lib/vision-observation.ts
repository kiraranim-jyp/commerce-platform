import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * P0-A.30.2 ㉠(CEO 결정, 2026-09-20) — **Vision 관측을 가격 경로에서 떼어낸다.**
 *
 * ── 왜 이 파일이 따로 있는가 ────────────────────────────────────────────────
 * vision-evidence.ts 는 «링크가 된 후보» 의 관측을 domestic_product_links 위에
 * 얹는다. 그런데 E1 후보(교차판매처 SIMILAR + 텍스트 low)는 링크가 만들어지지
 * 않는다 — toDomesticMatchType("low") 가 NOT_MATCHED 라 저장 직전에 continue 된다.
 * 관측을 위해 링크를 만들면 그 순간 priceTier=COMPARISON 이 생겨 «관측만 했는데
 * 가격 비교에 들어간다». 그래서 표를 나눴다(마이그레이션 057).
 *
 * 🔴 이 모듈이 쓰는 표는 «어떤 판정도 읽지 않는다». priceTierFromLink 는 여전히
 *    match_truth·verified 만 보고, deriveMatchTruth 는 이 표의 존재를 모른다.
 *
 * ── 조용한 실패를 금지한다 ──────────────────────────────────────────────────
 * 지금까지 Vision 실패는 전부 null 이었다. 「키가 없어서」와 「이미지를 못 받아서」와
 * 「모델이 거절해서」가 같은 모양이면, 점수가 안 쌓일 때 원인을 사후에 물을 수
 * 없다 — 실제로 P0-A.29-F 에서 그 질문에 코드로 답하지 못했다. 그래서 여기서는
 * 실패도 «행으로» 남긴다. score=NULL 인 행이 「실패」인지 「아직 안 봄」인지
 * status 로 구분된다.
 *
 * 🔴 API key 값은 어디에도 출력하지 않는다 — 있다/없다만 status 로 남긴다.
 */

export type VisionObservationStatus =
  | "OK"
  | "NO_API_KEY"
  | "IMAGE_FETCH_FAILED"
  | "API_REJECTED"
  | "EMPTY_RESPONSE"
  | "PARSE_FAILED";

export interface VisionObservation {
  status: VisionObservationStatus;
  score: number | null;
  reason: string | null;
  failureDetail: string | null;
  model: string;
  promptVersion: string;
  mediaResolution: string;
}

export interface RecordVisionObservationInput {
  snapshotId: string;
  sourceId: string | null;
  shopDomain: string;
  candidateUrl: string;
  originImageUrl: string;
  candidateImageUrl: string;
  crossSellerVerdict: string | null;
  gate: string;
  observation: VisionObservation;
}

/**
 * 🔴 같은 후보를 같은 조건으로 다시 부르지 않는다.
 *
 * 모델·프롬프트·해상도·두 이미지 URL 중 «하나라도» 바뀌면 다른 관측이다 — 그게
 * 재현의 조건이기 때문이다(056 의 findCachedVisionEvidence 와 같은 원칙).
 * 상품이 사진을 갈아끼우면 새 행이 생기는 것이 맞다.
 */
export async function hasVisionObservation(input: {
  snapshotId: string;
  candidateUrl: string;
  model: string;
  promptVersion: string;
  mediaResolution: string;
  originImageUrl: string;
  candidateImageUrl: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("vision_observations")
    .select("id")
    .eq("snapshot_id", input.snapshotId)
    .eq("candidate_url", input.candidateUrl)
    .eq("vision_model", input.model)
    .eq("prompt_version", input.promptVersion)
    .eq("media_resolution", input.mediaResolution)
    .eq("origin_image_url", input.originImageUrl)
    .eq("candidate_image_url", input.candidateImageUrl)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function recordVisionObservation(
  input: RecordVisionObservationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const o = input.observation;
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase 미설정" };
  const { error } = await supabase.from("vision_observations").insert({
    snapshot_id: input.snapshotId,
    source_id: input.sourceId,
    shop_domain: input.shopDomain,
    candidate_url: input.candidateUrl,
    origin_image_url: input.originImageUrl,
    candidate_image_url: input.candidateImageUrl,
    vision_model: o.model,
    prompt_version: o.promptVersion,
    media_resolution: o.mediaResolution,
    score: o.score,
    reason: o.reason,
    status: o.status,
    failure_detail: o.failureDetail,
    gate: input.gate,
    cross_seller_verdict: input.crossSellerVerdict,
  });
  // 중복 키(같은 조건의 관측이 이미 있음)는 실패가 아니다 — 재호출을 막는 것이
  // 이 인덱스의 목적이고, 목적대로 동작한 것이다.
  if (error && !/duplicate key|unique constraint/i.test(error.message)) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * P0-A.30.2 §5 — **E1 게이트.**
 *
 *   CONFLICT        → 제외 (반증이 있다)
 *   UNKNOWN         → 제외 (축이 «하나도» 안 맞았다 — 볼 것이 없다)
 *   SIMILAR 이상    → 관측 대상
 *
 * 🔴 이 함수는 «무엇을 눈으로 볼 것인가» 만 정한다. 같은 SIMILAR 값이
 *    deriveMatchTruth 에서는 등급을 올리지 못하도록 막혀 있다(P0-A.29-F R1) —
 *    두 결정은 층이 다르다. 판정에 쓰지 않는 신호를 «사람이 확인할 후보» 로
 *    삼는 것은 모순이 아니지만, 그 경계가 흐려지면 위험하므로 여기 적어 둔다.
 */
const E1_VERDICTS = new Set(["SAME", "PRESUMED_SAME", "SIMILAR"]);

export function isE1VisionCandidate(crossSellerVerdict: string | undefined | null): boolean {
  return Boolean(crossSellerVerdict && E1_VERDICTS.has(crossSellerVerdict));
}

/** 같은 (상품,샵)에서 여러 후보가 E1 을 통과하면 근거가 강한 쪽 하나만 본다. */
const E1_RANK: Record<string, number> = { SAME: 3, PRESUMED_SAME: 2, SIMILAR: 1 };

export function pickE1Candidate<T extends { crossSellerVerdict?: string; confidence: number; imageUrl: string | null }>(
  candidates: T[],
): T | null {
  const ok = candidates.filter((c) => isE1VisionCandidate(c.crossSellerVerdict) && c.imageUrl);
  if (ok.length === 0) return null;
  return [...ok].sort(
    (a, b) =>
      (E1_RANK[b.crossSellerVerdict ?? ""] ?? 0) - (E1_RANK[a.crossSellerVerdict ?? ""] ?? 0) ||
      b.confidence - a.confidence,
  )[0];
}
