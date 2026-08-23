import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * N-4.07 2차(대표님 지시: "가격보다 동일상품 판별 정확도가 우선이다") —
 * domestic_product_links(마이그레이션 029) CRUD. 매칭 자체는 새로 만들지 않는다
 * — packages/crawler의 match.ts(scoreCandidateMatch, SKU 우선/브랜드 게이트)가
 * 이미 계산한 matchLevel을 그대로 이 테이블의 match_type 어휘로 옮기기만 한다.
 */
export type DomesticMatchType = "EXACT" | "HIGH_CONFIDENCE" | "REVIEW_REQUIRED" | "NOT_MATCHED";

/** match.ts의 classifyMatchLevel(very_high/high/medium/low)을 그대로 재사용한
 * matchLevel을 이 테이블의 어휘로 옮긴다. EXACT/HIGH_CONFIDENCE는 verified=true로
 * 자동 확정한다(신호 자체가 이미 SKU 일치 또는 매우 높은 종합 confidence라
 * 사람이 다시 볼 이유가 적다) — REVIEW_REQUIRED만 관리자 승인 전까지
 * verified=false로 남는다(migration 029 주석의 "검증 안 된 매칭을 가격 판단에
 * 쓰지 않는다" 원칙). low(NOT_MATCHED)는 링크 자체를 만들지 않는다(호출부에서
 * 필터링). */
export function toDomesticMatchType(matchLevel: "very_high" | "high" | "medium" | "low"): {
  matchType: DomesticMatchType;
  autoVerified: boolean;
} {
  if (matchLevel === "very_high") return { matchType: "EXACT", autoVerified: true };
  if (matchLevel === "high") return { matchType: "HIGH_CONFIDENCE", autoVerified: true };
  if (matchLevel === "medium") return { matchType: "REVIEW_REQUIRED", autoVerified: false };
  return { matchType: "NOT_MATCHED", autoVerified: false };
}

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
    .select("verified")
    .eq("snapshot_id", input.snapshotId)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  const keepVerified = existing ? (existing as { verified: boolean }).verified : false;

  const { data, error } = await supabase
    .from("domestic_product_links")
    .upsert(
      {
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
        match_reasons: input.matchReasons,
        verified: keepVerified || input.verified,
        verified_at: keepVerified || input.verified ? new Date().toISOString() : null,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "snapshot_id,source_id" },
    )
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, link: toLink(data as DomesticProductLinkRow) };
}

export interface UpdateDomesticProductLinkInput {
  verified?: boolean;
  status?: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
}

/** 관리자가 REVIEW_REQUIRED 후보를 직접 승인/반려하거나(verified), 링크가 깨졌음을
 * 표시할 때(status=BROKEN_LINK) 쓴다. */
export async function updateDomesticProductLink(
  id: string,
  input: UpdateDomesticProductLinkInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.verified !== undefined) {
    patch.verified = input.verified;
    patch.verified_at = input.verified ? new Date().toISOString() : null;
  }
  if (input.status !== undefined) patch.status = input.status;
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
