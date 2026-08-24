import { classifyPriorityTier, buildHeadline, type DashboardPriorityTier } from "../src/app/api/dashboard/readiness/_lib/priority";
import type { SnapshotReadiness } from "../src/app/api/snapshots/_lib/compute-readiness";
import type { RegistrationReadinessState } from "../src/app/pipeline/commerce/readiness-state";

/**
 * N-3.56 STEP16 / N-3.57 STEP9 — Dashboard 우선순위 분류(classifyPriorityTier)를
 * 실제 Naver API 호출 없이 순수 로직만 검증한다(computeSnapshotReadiness
 * 자체는 라이브 크리덴셜이 필요해 tsx 스크립트로는 못 돌린다 — 이 부분은
 * STEP15 브라우저 실측으로 커버한다).
 *
 * N-3.57 STEP9(CPO 지시: "Dashboard와 Pipeline 상태 완전 일치") — Hamster
 * Kid Cap이 Coupang에만 실제로 등록되고 SmartStore는 여전히 KC 미확정으로
 * BLOCKED인데, 예전 로직은 snapshot.status만 보고 tier5(✅ 등록완료)로
 * 뭉뚱그렸다. 이제 플랫폼별 registered 플래그를 기준으로 판정한다 — 지원
 * 플랫폼 전부가 registered일 때만 tier5, 아니면 아직 등록 안 된 플랫폼만으로
 * 나머지 tier를 계산한다(G2/G3 케이스가 이 회귀를 고정한다).
 */
function readiness(
  states: RegistrationReadinessState[],
  fixCounts: number[],
  registeredFlags?: boolean[],
): SnapshotReadiness {
  return {
    priceValid: true,
    priceLevel: "UNKNOWN",
    price: {
      level: "UNKNOWN",
      marginPercent: null,
      currentSellingPriceKrw: null,
      domesticLowestPriceKrw: null,
      lastCheckedAt: null,
      reason: "테스트 픽스처",
    },
    platforms: states.map((state, i) => ({
      platform: "smartstore" as const,
      supported: true,
      categoryConfirmed: true,
      state,
      priorityItems: Array.from({ length: fixCounts[i] ?? 0 }, (_, k) => ({ key: `k${k}`, label: `항목${k}`, sourceItems: [] })),
      registered: registeredFlags?.[i] ?? false,
    })),
  };
}

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "OK " : "FAIL"} ${name} -> actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  if (ok) pass += 1;
  else fail += 1;
}

// A) READY 플랫폼이 하나라도 있으면 Tier1
check("A) READY -> tier1", classifyPriorityTier("IN_PROGRESS", readiness(["READY"], [0])), 1);

// B) 1~2개만 남은 NEEDS_REVIEW -> tier2
check("B) NEEDS_REVIEW(fix=1) -> tier2", classifyPriorityTier("IN_PROGRESS", readiness(["NEEDS_REVIEW"], [1])), 2);
check("B2) NEEDS_REVIEW(fix=2) -> tier2", classifyPriorityTier("IN_PROGRESS", readiness(["NEEDS_REVIEW"], [2])), 2);

// C) NEEDS_REVIEW인데 남은 게 많으면(3개+) tier2가 아니어야 한다
check("C) NEEDS_REVIEW(fix=3) -> tier4(많이 남음)", classifyPriorityTier("IN_PROGRESS", readiness(["NEEDS_REVIEW"], [3])), 4);

// D) SELLER_REVIEW(KC 등 판매자 확인) -> tier3
check("D) SELLER_REVIEW -> tier3", classifyPriorityTier("IN_PROGRESS", readiness(["SELLER_REVIEW"], [1])), 3);

// E) 모든 플랫폼 BLOCKED -> tier4
check("E) BLOCKED -> tier4", classifyPriorityTier("IN_PROGRESS", readiness(["BLOCKED"], [0])), 4);

// F) 지원 플랫폼 전부 registered=true -> 항상 tier5(state와 무관)
check(
  "F) 전체 플랫폼 registered -> tier5",
  classifyPriorityTier("REGISTERED", readiness(["READY"], [0], [true])),
  5,
);

// G) 플랫폼별 상태가 섞인 경우(스마트스토어 BLOCKED, 쿠팡 READY, 둘 다 미등록)
// -> 하나라도 READY면 "오늘 등록 가능"이므로 tier1.
check(
  "G) mixed(BLOCKED+READY, 둘 다 미등록) -> tier1",
  classifyPriorityTier("IN_PROGRESS", readiness(["BLOCKED", "READY"], [0, 0])),
  1,
);

// G2(N-3.57 STEP9, Hamster Kid Cap 회귀 고정) — Coupang은 이미 등록됐고
// SmartStore는 KC 미확정 BLOCKED. "일부만 등록됨"을 tier5(등록완료)로
// 잘못 표시하면 안 된다 — 아직 등록 안 된 SmartStore 기준으로 tier4여야 한다.
check(
  "G2) Coupang만 등록, SmartStore BLOCKED -> tier4(등록완료 아님)",
  classifyPriorityTier("REGISTERED", readiness(["BLOCKED", "READY"], [0, 0], [false, true])),
  4,
);

// G3 — 위와 같은 상황이지만 SmartStore가 READY(등록 가능)라면 tier1이어야
// 한다(이미 등록된 Coupang은 계산에서 제외, 남은 SmartStore만 본다).
check(
  "G3) Coupang만 등록, SmartStore READY -> tier1",
  classifyPriorityTier("REGISTERED", readiness(["READY", "READY"], [0, 0], [false, true])),
  1,
);

// H) 정렬 정확성 — tier가 뒤섞인 배열을 정렬하면 1,2,3,4,5 순서가 나와야 한다
const items: { id: string; priorityTier: DashboardPriorityTier }[] = [
  { id: "e", priorityTier: 4 },
  { id: "a", priorityTier: 1 },
  { id: "d", priorityTier: 5 },
  { id: "c", priorityTier: 3 },
  { id: "b", priorityTier: 2 },
];
items.sort((a, b) => a.priorityTier - b.priorityTier);
check(
  "H) sort order",
  items.map((i) => i.id),
  ["a", "b", "c", "e", "d"],
);

// I) 빈 목록 헤드라인
check("I) headline(empty)", buildHeadline({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }), "등록 준비 중인 상품이 없습니다.");
// J) READY 3개 -> "오늘은 3개 상품부터 등록하세요."
check("J) headline(tier1=3)", buildHeadline({ 1: 3, 2: 1, 3: 0, 4: 0, 5: 0 }), "오늘은 3개 상품부터 등록하세요.");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
