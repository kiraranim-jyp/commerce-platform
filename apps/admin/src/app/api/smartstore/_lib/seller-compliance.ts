import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import type { KcStatus } from "@commerce/listing";
import { COMPLIANCE_POLICY_VERSION } from "@commerce/listing";

/**
 * N-3.52(CPO 지시 STEP8) — 판매자가 "판매 전 최종 확인" 화면에서 남긴 확인
 * 기록. 단순 boolean이 아니라 "언제/어떤 카테고리/어떤 KC 상태/어떤 정책
 * 버전 기준으로" 확인했는지 저장한다(상품 상태가 나중에 바뀌었을 때 추적
 * 목적, migrations_manual/024).
 */
export interface SellerComplianceConfirmationRow {
  id: string;
  snapshotId: string | null;
  platform: string;
  categoryCode: string;
  kcStatus: KcStatus;
  confirmed: boolean;
  policyVersion: string;
  confirmedAt: string;
}

interface SellerComplianceConfirmationDbRow {
  id: string;
  snapshot_id: string | null;
  platform: string;
  category_code: string;
  kc_status: KcStatus;
  confirmed: boolean;
  policy_version: string;
  confirmed_at: string;
}

function toRow(row: SellerComplianceConfirmationDbRow): SellerComplianceConfirmationRow {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    platform: row.platform,
    categoryCode: row.category_code,
    kcStatus: row.kc_status,
    confirmed: row.confirmed,
    policyVersion: row.policy_version,
    confirmedAt: row.confirmed_at,
  };
}

/** 새 확인 기록을 남긴다 — 덮어쓰지 않는다(감사 로그 목적, 매번 새 행). */
export async function saveSellerComplianceConfirmation(input: {
  snapshotId: string | null;
  platform: string;
  categoryCode: string;
  kcStatus: KcStatus;
  confirmed: boolean;
  /** Sprint B-1(CPO 지시) — Job Key 생애주기 다이어그램의 "validation" 단계. */
  jobKey?: string | null;
}): Promise<SellerComplianceConfirmationRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const row: Record<string, unknown> = {
    snapshot_id: input.snapshotId,
    platform: input.platform,
    category_code: input.categoryCode,
    kc_status: input.kcStatus,
    confirmed: input.confirmed,
    policy_version: COMPLIANCE_POLICY_VERSION,
    job_key: input.jobKey ?? null,
  };
  let { data, error } = await supabase.from("seller_compliance_confirmations").insert(row).select("*").single();
  // 마이그레이션 025 미실행 환경 대비 — job_key 컬럼이 없으면 그 필드만 빼고 재시도한다.
  if (error && "job_key" in row) {
    delete row.job_key;
    ({ data, error } = await supabase.from("seller_compliance_confirmations").insert(row).select("*").single());
  }
  if (error) {
    console.warn("[seller-compliance] 저장 실패:", error.message);
    return null;
  }
  return toRow(data as SellerComplianceConfirmationDbRow);
}

/** register route가 최종 게이트 재확인에 쓰는 조회 — snapshotId 기준 최신
 * 1건만 본다(같은 상품을 다시 열어 카테고리가 바뀌면 이전 확인은 더 이상
 * 유효하지 않을 수 있으므로 categoryCode도 호출부에서 함께 대조한다). */
export async function getLatestSellerComplianceConfirmation(
  snapshotId: string | null,
): Promise<SellerComplianceConfirmationRow | null> {
  if (!snapshotId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seller_compliance_confirmations")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[seller-compliance] 조회 실패:", error.message);
    return null;
  }
  return data ? toRow(data as SellerComplianceConfirmationDbRow) : null;
}
