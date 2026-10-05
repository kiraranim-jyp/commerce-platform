import type { SupabaseClient } from "@supabase/supabase-js";
import { CANDIDATE_MUTABLE_FIELDS } from "@/lib/sourcing-candidate-policy";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — Candidate CRUD 의 **저장소 접근**. 판단은 여기 없다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 역할을 가른다:
 *     sourcing-candidate-policy.ts   «무엇을 허용하는가» — 순수 판단
 *     이 파일                        «어떻게 읽고 쓰는가» — DB 접근만
 * 섞으면 라우트가 늘어날 때 한쪽에만 검사가 빠진다.
 *
 * 🔴 조회는 «전부» workspace 로 좁힌다(repo 관행 — snapshots/_lib/snapshot.ts).
 * 그리고 읽은 workspace 값을 정책에 «다시» 넘긴다. 중복이 아니다 — 가드가 둘이다:
 *   ① 쿼리가 남의 행을 애초에 읽지 않는다
 *   ② 나중에 누가 `.eq()` 를 빼면 정책이 그 행을 거절한다
 * 하나만 두면 그 하나가 사라지는 날 조용히 열린다.
 */

/** DB 컬럼명. 🔴 camelCase 로 쓰면 「없는 컬럼」을 가리킨다(schema.prisma 주석). */
const COLUMN_OF: Record<(typeof CANDIDATE_MUTABLE_FIELDS)[number], string> = {
  sourceUrl: "source_url",
  sourceSite: "source_site",
  sourceCountry: "source_country",
  priceAmount: "price_amount",
  currency: "currency",
  availability: "availability",
  shippingNote: "shipping_note",
  identityMatchTruth: "identity_match_truth",
  observedAt: "observed_at",
};

const CANDIDATE_COLUMNS =
  "id, product_id, originating_snapshot_id, source_kind, source_url, source_site, source_country, " +
  "price_amount, currency, availability, shipping_note, identity_match_truth, observed_at, created_at, updated_at";

export interface CandidateRow {
  id: string;
  product_id: string;
  originating_snapshot_id: string | null;
  source_kind: string | null;
  source_url: string;
  source_site: string;
  source_country: string | null;
  price_amount: string | number | null;
  currency: string | null;
  availability: string | null;
  shipping_note: string | null;
  identity_match_truth: string | null;
  observed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 화면이 쓰는 모양. 🔴 `workspace_id` 를 내보내지 «않는다» — 내부 격리 식별자다. */
export function toCandidate(row: CandidateRow) {
  return {
    id: row.id,
    productId: row.product_id,
    originatingSnapshotId: row.originating_snapshot_id,
    /* 🔴 NULL 을 「직접 입력」으로 바꾸지 않는다. 077 이 정한 대로 미확정이다 —
       「알 수 없음」과 「없음」을 섞지 않는다. */
    sourceKind: row.source_kind,
    sourceUrl: row.source_url,
    sourceSite: row.source_site,
    sourceCountry: row.source_country,
    /* NUMERIC 은 드라이버가 문자열로 줄 수 있다. 🔴 숫자로 바꾸면서 정밀도를
       잃지 않도록 원문도 함께 남긴다 — 가격은 반올림으로 다투는 칸이다. */
    priceAmount: row.price_amount == null ? null : Number(row.price_amount),
    priceAmountRaw: row.price_amount == null ? null : String(row.price_amount),
    currency: row.currency,
    availability: row.availability,
    shippingNote: row.shipping_note,
    identityMatchTruth: row.identity_match_truth,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProductOwnership {
  /** 🔴 읽은 값을 그대로 돌려준다 — 정책이 비교한다. 여기서 판단하지 않는다. */
  workspaceId: string | null;
  selectedCandidateId: string | null;
}

/** Product 를 workspace 로 좁혀 읽는다. 없거나 남의 것이면 null 이다. */
export async function loadProductOwnership(
  supabase: SupabaseClient,
  productId: string,
  workspaceId: string,
): Promise<ProductOwnership | null> {
  const { data, error } = await supabase
    .from("products")
    .select("workspace_id, selected_sourcing_candidate_id")
    .eq("id", productId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    workspaceId: (data.workspace_id as string | null) ?? null,
    selectedCandidateId: (data.selected_sourcing_candidate_id as string | null) ?? null,
  };
}

export async function listCandidates(
  supabase: SupabaseClient,
  productId: string,
  workspaceId: string,
): Promise<CandidateRow[]> {
  const { data, error } = await supabase
    .from("sourcing_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("product_id", productId)
    .eq("workspace_id", workspaceId)
    /* 🔴 「싼 것 먼저」로 정렬하지 «않는다». 통화가 섞여 있으면 그 정렬은 거짓말이고
       (환율 적용은 MI 의 일이다), 화면이 그것을 「추천 순」으로 읽는다. */
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as unknown as CandidateRow[];
}

/** 🔴 product 로 좁혀 읽는다 — 남의 Product 의 후보를 «읽지도» 않는다. */
export async function loadCandidate(
  supabase: SupabaseClient,
  productId: string,
  candidateId: string,
  workspaceId: string,
): Promise<CandidateRow | null> {
  const { data, error } = await supabase
    .from("sourcing_candidates")
    .select(CANDIDATE_COLUMNS)
    .eq("id", candidateId)
    .eq("product_id", productId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as CandidateRow;
}

/**
 * snapshot 의 provenance 확인용. 🔴 workspace 로 좁혀 읽으므로, 남의 snapshot 은
 * 「없음」과 구분되지 않는다 — 존재 여부를 알려주지 않는다.
 */
export async function loadSnapshotProductId(
  supabase: SupabaseClient,
  snapshotId: string,
  workspaceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("product_id")
    .eq("id", snapshotId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.product_id as string | null) ?? null;
}

/** 허용된 칸만 DB 컬럼으로 옮긴다. 🔴 목록 밖의 키는 여기 도달하지 못한다. */
export function toColumnPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of CANDIDATE_MUTABLE_FIELDS) {
    if (field in patch) out[COLUMN_OF[field]] = patch[field];
  }
  return out;
}

/** Postgres unique_violation. 같은 Product 에 같은 소싱처 URL 이 두 번 서는 경우. */
export const PG_UNIQUE_VIOLATION = "23505";
/** Postgres check_violation. 077 의 `SELLER_ENTERED → snapshot NULL` 등. */
export const PG_CHECK_VIOLATION = "23514";
