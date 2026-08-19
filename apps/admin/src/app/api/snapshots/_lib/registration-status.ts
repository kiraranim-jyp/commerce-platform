import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PlatformId } from "@commerce/shared";

/**
 * N-3.57 STEP0/STEP9(CPO 지시: "Dashboard와 Pipeline 상태 완전 일치") —
 * STEP0 조사에서 발견한 실제 문제: product_snapshots.status는
 * IN_PROGRESS/REGISTERED 단일 플래그라 "어느 플랫폼에" 등록됐는지 구분하지
 * 못한다. Hamster Kid Cap은 Coupang에는 실제로 등록됐지만(2026-08-03~09,
 * registration_attempts 확인) SmartStore/Naver는 KC 미확정으로 여전히
 * BLOCKED다 — 그런데 대시보드는 snapshot.status만 보고 이 상품을 "✅ 등록
 * 완료"(tier5)로 뭉뚱그려 보여줘서, SmartStore에서는 아직 등록할 수 없다는
 * 사실을 가려버린다. 이 함수는 registration_attempts(snapshot_id로 실제
 * 연결된 기록만, status='SUBMITTED')를 조회해 "실제로 어느 플랫폼에
 * 등록됐는지"를 정확히 돌려준다 — 새 판정 로직이 아니라 이미 존재하는
 * 등록 이력을 있는 그대로 재조합한 것이다.
 */
export async function getRegisteredPlatforms(snapshotId: string): Promise<Set<PlatformId>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("registration_attempts")
    .select("platform")
    .eq("snapshot_id", snapshotId)
    .eq("status", "SUBMITTED");
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.platform as PlatformId));
}
