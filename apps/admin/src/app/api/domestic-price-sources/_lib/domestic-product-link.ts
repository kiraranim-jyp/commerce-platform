import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CrossSellerVerdict, MatchTruth } from "@commerce/crawler";

/**
 * N-4.07 2차(대표님 지시: "가격보다 동일상품 판별 정확도가 우선이다") —
 * domestic_product_links(마이그레이션 029) CRUD. 매칭 자체는 새로 만들지 않는다
 * — packages/crawler의 match.ts(scoreCandidateMatch, SKU 우선/브랜드 게이트)가
 * 이미 계산한 matchLevel을 그대로 이 테이블의 match_type 어휘로 옮기기만 한다.
 */
export type DomesticMatchType = "EXACT" | "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "NOT_MATCHED";

/** match.ts의 classifyMatchLevel(very_high/high/medium/low)을 그대로 재사용한
 * matchLevel을 이 테이블의 어휘로 옮긴다.
 *
 * N-4.18-C STEP6(대표님 지시, 2026-08-25: "95% 이상일 때만 가격비교 대상으로
 * 확정한다" / "85~94%는 후보로 표시하지만 자동 가격 경쟁력 계산에는 사용하지
 * 않는다") — 이전에는 very_high/high 둘 다 autoVerified:true였다. 이번 지시로
 * **95% 이상(very_high)만** 자동 검증한다 — high(85~94%, N-4.18-D에서 경계
 * 조정됨)/medium(70~84%)은 후보로는 계속 링크를 만들어 화면에 보여주되
 * (migration 029 "후보를 안 버린다" 원칙), verified=false로 남아 실제 가격
 * 비교/경쟁력 계산에는 쓰이지 않는다(STEP2에서 verified&&ACTIVE 링크만 가격을
 * 재조회하므로, 여기서 autoVerified:false면 자동으로 가격 계산 대상에서
 * 빠진다). low(NOT_MATCHED, <70%)는 여전히 링크 자체를 만들지 않는다(호출부에서
 * 필터링).
 *
 * N-4.18-D(대표님 지시, 2026-08-25) — classifyMatchLevel의 구간 경계를
 * 95/80/60에서 대표님이 확정한 95/85/70으로 교체했다(match.ts). 매칭엔진의
 * 전역 임계값이므로 이 파일은 match.ts의 결과를 그대로 옮기기만 한다. */
export function toDomesticMatchType(matchLevel: "very_high" | "high" | "medium" | "low"): {
  matchType: DomesticMatchType;
  autoVerified: boolean;
} {
  if (matchLevel === "very_high") return { matchType: "EXACT", autoVerified: true };
  if (matchLevel === "high") return { matchType: "HIGH_CONFIDENCE", autoVerified: false };
  if (matchLevel === "medium") return { matchType: "REVIEW_REQUIRED", autoVerified: false };
  return { matchType: "NOT_MATCHED", autoVerified: false };
}

/**
 * P-19-B Sprint 6/7(CPO 지시, 2026-09-02) — "동일상품 확인은 식별자(SKU/모델코드)
 * 근거가 있어야만, 비교상품은 식별자 없이도 시장 참고가격으로만" 원칙을 이 함수
 * 하나로 고정한다. matchTruth는 이미 decideCandidateEvidence()/deriveMatchTruth()가
 * 계산해서 저장한 값(P-10 STEP 4)을 그대로 재사용한다 — 새 판정 로직이 아니다.
 * EXCLUDED(CONFLICT/INSUFFICIENT_EVIDENCE)는 가격 재조회/시장가격 계산 어느
 * 쪽에도 쓰지 않는다. matchTruth가 null인 행(마이그레이션 030 이전 레거시 —
 * domestic-product-link.ts 기존 주석과 동일한 "일괄 backfill 없음" 원칙)은
 * 기존 verified 플래그로만 EXACT/COMPARISON을 구분한다.
 */
export type DomesticPriceTier = "EXACT" | "COMPARISON" | "EXCLUDED";

export function priceTierFromLink(link: Pick<DomesticProductLink, "matchTruth" | "verified">): DomesticPriceTier {
  if (link.matchTruth === "EXACT_IDENTIFIER" || link.matchTruth === "STRONG_IDENTIFIER") return "EXACT";
  if (link.matchTruth === "TEXT_CONFIRMED" || link.matchTruth === "SIMILAR") return "COMPARISON";
  if (link.matchTruth === "CONFLICT" || link.matchTruth === "INSUFFICIENT_EVIDENCE") return "EXCLUDED";
  return link.verified ? "EXACT" : "COMPARISON";
}

/**
 * MATCHING-FIX-01 Phase D(CEO 지시, 2026-09-16) — 「사람이 눌렀다」를 적는 한 줄의
 * 접두사. 🔴 판정에 쓰이지 않는다. 이 값이 여기(저장 계층)에 있는 이유는,
 * upsert 가 match_reasons 를 통째로 교체할 때 **지우면 안 되는 줄**을 알아보는
 * 주체가 바로 이 파일이기 때문이다. 뜻과 화면 문구는 match-provenance.ts 가 갖는다.
 */
export const HUMAN_CONFIRMATION_PREFIX = "사람 확인: ";

export interface DomesticProductLink {
  id: string;
  snapshotId: string;
  sourceId: string;
  externalProductId: string | null;
  externalUrl: string;
  matchedBrand: string | null;
  matchedTitle: string | null;
  matchedModelName: string | null;
  matchedColor: string | null;
  matchType: DomesticMatchType;
  matchConfidence: number;
  matchReasons: string[];
  /** P-10 STEP 4(대표님/CPO 지시, 2026-08-30) — decideCandidateEvidence()가 이미
   * 계산하던 값을 저장/전달한다(재계산 없음). 마이그레이션 030 이전에 만들어진
   * 행은 null이다 — "가격 다시 확인"으로 재검색되면 그때 채워진다(일괄 backfill
   * 없음, STEP 3.5 결정). */
  matchTruth: MatchTruth | null;
  /**
   * P0-A.8 MATCHING MEASUREMENT ONLY(CEO 승인, 2026-09-18) — compareCrossSellerProducts()가
   * 실제로 낸 판정. 🔴 **어떤 판정에도 입력으로 쓰이지 않는다.** 측정 전용이다.
   *
   * 왜 필요한가: A/B/C 후보안이 전부 이 값을 입력으로 쓰는데, 실측 결과 70행 중
   * 복원 가능한 행이 0건이라 「이 안을 적용하면 가격이 몇 개 사라지는가」에
   * 구간으로만 답할 수 있었다. 게다가 오늘 국내 비교가격을 공급하는 EXACT 14개가
   * **전부** 품번 한 축으로 서 있어(품번 근거 아닌 EXACT = 0건) 안전지대가 없다.
   *
   * 🔴 null 과 "UNKNOWN" 은 다르다. null = 이 행을 교차판매처 판정기로 **본 적이 없다**
   *    (마이그레이션 055 이전 행, 또는 그 판정을 거치지 않는 경로). "UNKNOWN" =
   *    판정기가 실제로 보고 «근거가 모자랐다»고 결론낸 것. 둘을 합치면 이 칸을
   *    만든 이유가 그 자리에서 사라진다. backfill 하지 않는 이유도 같다.
   */
  crossSellerVerdict: CrossSellerVerdict | null;
  /**
   * P0-A.29-B(CEO 승인 ㉮, 2026-09-19) — Vision 등급 «원점수» 와 그것을 재현하는 데
   * 필요한 것들. 🔴 **어떤 판정에도 입력으로 쓰이지 않는다** — priceTierFromLink 는
   * 여전히 matchTruth·verified 만 읽는다. 관측 전용이다.
   *
   * 🔴 HIGH/REVIEW/LOW 로 접어서 저장하지 않는다. 경계가 아직 정해지지 않았고,
   *    정해진 뒤에도 과거 행의 뜻이 바뀌면 안 된다.
   * 🔴 null 은 「같지 않다」가 아니라 «이 쌍을 Vision 으로 본 적이 없다» 이다
   *    (055 cross_seller_verdict 와 같은 규칙).
   */
  visionScore: number | null;
  visionReason: string | null;
  visionModel: string | null;
  visionPromptVersion: string | null;
  visionMediaResolution: string | null;
  visionImageRefs: string[] | null;
  visionCheckedAt: string | null;
  verified: boolean;
  verifiedAt: string | null;
  status: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
  createdAt: string;
  updatedAt: string;
}

interface DomesticProductLinkRow {
  id: string;
  snapshot_id: string;
  source_id: string;
  external_product_id: string | null;
  external_url: string;
  matched_brand: string | null;
  matched_title: string | null;
  matched_model_name: string | null;
  matched_color: string | null;
  match_type: DomesticMatchType;
  match_confidence: number;
  match_reasons: string[];
  match_truth: MatchTruth | null;
  /** 마이그레이션 055. 미실행 환경/레거시 행에서는 undefined 또는 null이다. */
  cross_seller_verdict?: CrossSellerVerdict | null;
  /** 마이그레이션 056. 같은 이유로 전부 optional이다. */
  vision_score?: number | null;
  vision_reason?: string | null;
  vision_model?: string | null;
  vision_prompt_version?: string | null;
  vision_media_resolution?: string | null;
  vision_image_refs?: string[] | null;
  vision_checked_at?: string | null;
  verified: boolean;
  verified_at: string | null;
  status: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
  created_at: string;
  updated_at: string;
}

function toLink(row: DomesticProductLinkRow): DomesticProductLink {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    sourceId: row.source_id,
    externalProductId: row.external_product_id,
    externalUrl: row.external_url,
    matchedBrand: row.matched_brand,
    matchedTitle: row.matched_title,
    matchedModelName: row.matched_model_name,
    matchedColor: row.matched_color,
    matchType: row.match_type,
    matchConfidence: Number(row.match_confidence),
    matchReasons: row.match_reasons ?? [],
    matchTruth: row.match_truth ?? null,
    crossSellerVerdict: row.cross_seller_verdict ?? null,
    visionScore: row.vision_score ?? null,
    visionReason: row.vision_reason ?? null,
    visionModel: row.vision_model ?? null,
    visionPromptVersion: row.vision_prompt_version ?? null,
    visionMediaResolution: row.vision_media_resolution ?? null,
    visionImageRefs: row.vision_image_refs ?? null,
    visionCheckedAt: row.vision_checked_at ?? null,
    verified: row.verified,
    verifiedAt: row.verified_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDomesticProductLinks(snapshotId: string): Promise<DomesticProductLink[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("domestic_product_links")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("match_confidence", { ascending: false });
  if (error) {
    console.warn("[domestic-product-link] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as DomesticProductLinkRow[]).map(toLink);
}

export interface UpsertDomesticProductLinkInput {
  snapshotId: string;
  sourceId: string;
  externalUrl: string;
  externalProductId?: string | null;
  matchedBrand?: string | null;
  matchedTitle?: string | null;
  matchedModelName?: string | null;
  matchedColor?: string | null;
  matchType: DomesticMatchType;
  matchConfidence: number;
  matchReasons: string[];
  matchTruth: MatchTruth;
  /** P0-A.8 — 측정 전용. 🔴 «실제 근거가 있을 때만» 넘긴다. 호출부가 교차판매처
   *  판정을 돌리지 않았으면 undefined 로 두고, 여기서 UNKNOWN 으로 메우지 않는다. */
  crossSellerVerdict?: CrossSellerVerdict;
  /** P0-A.29-B — 측정 전용. 호출부가 «실제로 Vision 을 돌렸을 때만» 넘긴다.
   *  안 돌렸으면 undefined 로 두고, 여기서 0 이나 다른 값으로 메우지 않는다. */
  vision?: {
    model: string;
    promptVersion: string;
    mediaResolution: string;
    score: number;
    reason: string | null;
    imageRefs: string[];
    checkedAt: string;
  };
  verified: boolean;
}

/** snapshot_id+source_id 조합은 unique 제약이 있다(migration 029) — 이미 연결이
 * 있으면 최신 검색 결과로 갱신하고, 없으면 새로 만든다. 사람이 REVIEW_REQUIRED를
 * 이미 승인(verified=true)해 뒀는데 이후 재검색으로 confidence가 살짝 바뀌었다고
 * 다시 미검증 상태로 되돌리면 안 되므로, 기존에 verified=true였던 링크는 그대로
 * 둔다(matchType이 NOT_MATCHED로 바뀌는 경우만 예외 — 아래 별도 처리). */
export async function upsertDomesticProductLink(
  input: UpsertDomesticProductLinkInput,
): Promise<{ ok: true; link: DomesticProductLink } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing } = await supabase
    .from("domestic_product_links")
    .select("verified, match_reasons")
    .eq("snapshot_id", input.snapshotId)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  const keepVerified = existing ? (existing as { verified: boolean }).verified : false;
  /**
   * MATCHING-FIX-01 Phase D(CEO 지시, 2026-09-16) — **사람이 확인했다는 기록은
   * 재검색으로 지워지지 않는다.**
   *
   * 바로 위 keepVerified 와 같은 이유, 같은 모양이다. match_reasons 는 매 저장마다
   * 통째로 교체되는데, 사람이 승인 버튼을 눌렀다는 사실만 그 안에 들어 있다
   * (오늘 스키마에 그 칸이 따로 없다 — match-provenance.ts 주석 참고). 그대로 두면
   * cron 이 한 번 돌 때마다 verified=true 는 남고 «누가 그렇게 정했는지»만
   * 사라져서, 화면이 다시 엔진 판정을 사람 확인처럼 말하게 된다.
   */
  const carriedHumanReasons = (
    (existing as { match_reasons?: unknown[] } | null)?.match_reasons ?? []
  ).filter((r): r is string => typeof r === "string" && r.startsWith(HUMAN_CONFIRMATION_PREFIX));

  const row: Record<string, unknown> = {
    snapshot_id: input.snapshotId,
    source_id: input.sourceId,
    external_url: input.externalUrl,
    external_product_id: input.externalProductId ?? null,
    matched_brand: input.matchedBrand ?? null,
    matched_title: input.matchedTitle ?? null,
    matched_model_name: input.matchedModelName ?? null,
    matched_color: input.matchedColor ?? null,
    match_type: input.matchType,
    match_confidence: input.matchConfidence,
    match_reasons: [...input.matchReasons, ...carriedHumanReasons],
    match_truth: input.matchTruth,
    verified: keepVerified || input.verified,
    verified_at: keepVerified || input.verified ? new Date().toISOString() : null,
    status: "ACTIVE",
    updated_at: new Date().toISOString(),
  };
  /**
   * P0-A.8(CEO 승인, 2026-09-18) — 🔴 **호출부가 실제로 준 값이 있을 때만** 적는다.
   * undefined 면 칸 자체를 넣지 않는다 — 여기서 "UNKNOWN"으로 메우면 «판정기가
   * 근거 부족이라고 결론낸 것»과 «이 경로가 판정기를 아예 안 거친 것»이 같은 값이
   * 되고, 이 칸을 만든 이유가 그 자리에서 사라진다.
   */
  if (input.crossSellerVerdict !== undefined) row.cross_seller_verdict = input.crossSellerVerdict;
  /* P0-A.29-B — 같은 원칙. 호출부가 Vision 을 «실제로 돌렸을 때만» 칸을 쓴다.
     안 돌렸으면 기존 값을 덮지 않는다(재검색 때마다 점수가 지워지면 캐시가 무의미해진다). */
  if (input.vision) {
    row.vision_model = input.vision.model;
    row.vision_prompt_version = input.vision.promptVersion;
    row.vision_media_resolution = input.vision.mediaResolution;
    row.vision_score = input.vision.score;
    row.vision_reason = input.vision.reason;
    row.vision_image_refs = input.vision.imageRefs;
    row.vision_checked_at = input.vision.checkedAt;
  }

  // P0-A.29-F 후속(CEO 지시, 2026-09-20) — 🔴 **폴백이 «컬럼이 없을 때» 에만 돌게
  // 한다.** 전에는 첫 시도가 «어떤 이유로든» 실패하면 vision_* 를 통째로 버리고
  // 재시도했다. 055/056 은 Production 에 이미 적용돼 있으므로(2026-09-20 스키마
  // 조회로 확인), 그 상태에서 이 폴백이 도는 경우는 «관계없는 오류» 뿐이고 그때
  // 잃는 것은 관측 데이터다 — 조용히. 이 저장소가 반복해서 금지해 온 모양이다.
    // 마이그레이션 055/056 미실행 환경 대비 — 컬럼이 없으면 그 칸만 빼고 한 번 더 시도한다
  // (registration_attempts 의 optionalColumns 폴백과 같은 이유·같은 모양).
  // 🔴 측정 칸 하나 때문에 «가격 공급 경로»가 끊기면 안 된다. 링크 저장이 우선이다.
  const isMissingColumnError = (message: string) =>
    /column .* does not exist|could not find .* column|schema cache/i.test(message);
  const VISION_COLUMNS = [
    "vision_model", "vision_prompt_version", "vision_media_resolution",
    "vision_score", "vision_reason", "vision_image_refs", "vision_checked_at",
  ] as const;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("domestic_product_links")
      .upsert(row, { onConflict: "snapshot_id,source_id" })
      .select()
      .single();
    if (!error) return { ok: true, link: toLink(data as DomesticProductLinkRow) };
    if (attempt === 0 && isMissingColumnError(error.message) && VISION_COLUMNS.some((c) => c in row)) {
      console.warn("[domestic-product-link] vision_* 칸이 없어 빼고 재시도:", error.message);
      for (const c of VISION_COLUMNS) delete row[c];
      continue;
    }
    if (attempt <= 1 && isMissingColumnError(error.message) && "cross_seller_verdict" in row) {
      console.warn("[domestic-product-link] cross_seller_verdict 칸이 없어 빼고 재시도:", error.message);
      delete row.cross_seller_verdict;
      continue;
    }
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "링크 저장에 실패했습니다." };
}

export interface UpdateDomesticProductLinkInput {
  verified?: boolean;
  status?: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
}

/** 관리자가 REVIEW_REQUIRED 후보를 직접 승인/반려하거나(verified), 링크가 깨졌음을
 * 표시할 때(status=BROKEN_LINK) 쓴다.
 *
 * MATCHING-FIX-01 Phase D(CEO 지시, 2026-09-16) — verified 를 «사람이» 켤 때는
 * 그 사실을 match_reasons 에 한 줄로 남긴다. 🔴 verified 값 자체의 의미나 계산은
 * 그대로다(여기서 판정하지 않는다) — 지금까지 「엔진이 자동으로 켠 true」와
 * 「사람이 눌러서 켠 true」가 완전히 같은 모양이라 화면이 둘을 구분할 방법이
 * 없었고, 그래서 화면이 엔진 판정을 «사람이 확인함»처럼 말했다. 이 한 줄이
 * 그 구분의 유일한 근거다.
 *
 * 반려(verified=false)일 때는 줄을 남기지 않는다 — 「사람이 아니라고 했다」는
 * 기록은 이번 범위 밖이고, 없는 사실을 만들지 않는다. */
export async function updateDomesticProductLink(
  id: string,
  input: UpdateDomesticProductLinkInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.verified !== undefined) {
    patch.verified = input.verified;
    patch.verified_at = input.verified ? now : null;
  }
  if (input.status !== undefined) patch.status = input.status;

  if (input.verified === true) {
    const { data: existing } = await supabase
      .from("domestic_product_links")
      .select("match_reasons")
      .eq("id", id)
      .maybeSingle();
    const reasons = ((existing as { match_reasons?: unknown[] } | null)?.match_reasons ?? []).filter(
      (r): r is string => typeof r === "string",
    );
    // 이미 승인 기록이 있으면 다시 쌓지 않는다(같은 사실을 두 번 적지 않는다).
    if (!reasons.some((r) => r.startsWith(HUMAN_CONFIRMATION_PREFIX))) {
      patch.match_reasons = [...reasons, `${HUMAN_CONFIRMATION_PREFIX}관리자가 화면에서 직접 승인함 (${now})`];
    }
  }

  const { error } = await supabase.from("domestic_product_links").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** cron/수동 확인이 매일 순회할 대상 — 스냅샷 무관하게 "검증되고 활성 상태인
 * 모든 링크"를 가져온다(daily-price-check가 전체 스냅샷을 순회하며 이 안에서
 * 필터링하는 대신, 링크 목록 자체를 한 번에 가져와 스냅샷별로 묶는 편이 쿼리
 * 수가 적다). */
export async function listVerifiedActiveDomesticLinks(): Promise<DomesticProductLink[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("domestic_product_links")
    .select("*")
    .eq("verified", true)
    .eq("status", "ACTIVE");
  if (error) {
    console.warn("[domestic-product-link] verified 목록 조회 실패:", error.message);
    return [];
  }
  return (data as DomesticProductLinkRow[]).map(toLink);
}
