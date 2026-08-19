import type { SnapshotReadiness } from "../../../snapshots/_lib/compute-readiness";

/**
 * N-3.56 STEP4(CPO 지시: "정렬 기준은 최근 작업 시간이 아니라 등록
 * 가능성이다") — 5단계 우선순위를 여기 한 곳에서만 판정한다(대시보드
 * 목록/요약 카운트가 각자 다시 계산하면 서로 다른 정렬 기준을 쓰게 될
 * 위험이 있다).
 *
 * Priority1 🟢 지금 등록 가능(하나 이상의 플랫폼이 READY)
 * Priority2 🟡 1~2개만 더 확인하면 되는 상품(모든 플랫폼이 BLOCKED는
 *   아니고, 가장 적게 남은 플랫폼의 우선순위 항목이 1~2개)
 * Priority3 🟠 판매자 확인이 필요한 상품(KC 등 SELLER_REVIEW)
 * Priority4 🔴 핵심 정보가 막혀있는 상품(모든 지원 플랫폼이 BLOCKED)
 * Priority5 지원하는 모든 플랫폼에 이미 등록 완료된 상품 — 더 볼 것이
 *   없으므로 항상 가장 아래.
 *
 * N-3.57 STEP0/STEP9(CPO 지시: "Dashboard와 Pipeline 상태 완전 일치") —
 * 예전에는 스냅샷 하나에 status(IN_PROGRESS/REGISTERED) 단일 플래그만 보고
 * tier5를 판정했다. 그런데 실제 등록 이력(registration_attempts)을 조사해보니
 * Hamster Kid Cap처럼 "Coupang에는 등록됐지만 SmartStore는 KC 미확정으로
 * 여전히 BLOCKED"인 상품이 tier5(✅ 등록완료)로 뭉뚱그려져 SmartStore
 * 등록이 막혀있다는 사실이 가려지는 문제가 있었다. 이제 플랫폼별
 * registered 플래그(computeSnapshotReadiness가 registration_attempts에서
 * 실제로 채워준다)를 기준으로, "지원하는 모든 플랫폼이 등록 완료"일 때만
 * tier5로 판정하고, 아니면 아직 등록되지 않은 플랫폼들의 상태만으로 나머지
 * tier를 계산한다(이미 등록된 플랫폼은 "더 할 일 없음"으로 계산에서 제외).
 */
export type DashboardPriorityTier = 1 | 2 | 3 | 4 | 5;

export function classifyPriorityTier(
  snapshotStatus: "IN_PROGRESS" | "REGISTERED",
  readiness: SnapshotReadiness,
): DashboardPriorityTier {
  if (readiness.platforms.length === 0) return snapshotStatus === "REGISTERED" ? 5 : 4;

  const allRegistered = readiness.platforms.every((p) => p.registered);
  if (allRegistered) return 5;

  const remaining = readiness.platforms.filter((p) => !p.registered);
  const states = remaining.map((p) => p.state);
  if (states.includes("READY")) return 1;

  const minFixCount = Math.min(...remaining.map((p) => p.priorityItems.length));
  if (states.includes("NEEDS_REVIEW") && minFixCount <= 2) return 2;

  if (states.includes("SELLER_REVIEW")) return 3;

  return 4;
}

const TIER_META: Record<DashboardPriorityTier, { icon: string; label: string }> = {
  1: { icon: "🟢", label: "지금 등록 가능" },
  2: { icon: "🟡", label: "1~2개만 확인하면 등록 가능" },
  3: { icon: "🟠", label: "판매자 확인 필요" },
  4: { icon: "🔴", label: "핵심 정보 부족" },
  5: { icon: "✅", label: "등록 완료" },
};

export function tierMeta(tier: DashboardPriorityTier) {
  return TIER_META[tier];
}

/** N-3.56 STEP2 — "오늘은 3개 상품부터 등록하세요" 같은 헤드라인 문구.
 * Priority1(READY) 개수를 그대로 쓴다 — 별도의 "추천" 판정 로직을 새로
 * 만들지 않는다. */
export function buildHeadline(tierCounts: Record<DashboardPriorityTier, number>): string {
  if (tierCounts[1] > 0) return `오늘은 ${tierCounts[1]}개 상품부터 등록하세요.`;
  if (tierCounts[2] > 0) return `${tierCounts[2]}개 상품이 1~2가지만 확인하면 등록할 수 있어요.`;
  if (tierCounts[3] > 0) return `${tierCounts[3]}개 상품이 판매자 확인을 기다리고 있어요.`;
  if (tierCounts[4] > 0) return `등록 가능한 상품이 아직 없어요 — 부족한 정보를 먼저 채워주세요.`;
  return "등록 준비 중인 상품이 없습니다.";
}
