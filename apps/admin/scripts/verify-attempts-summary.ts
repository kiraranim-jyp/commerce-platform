/**
 * Sprint D(CPO 지시: "SmartStore/Coupang 실제 등록 상태 분리") — B-2에서 만든
 * aggregateAttemptRows()가 실제로 플랫폼별 상태를 절대 섞지 않는지 순수 함수
 * 레벨에서 검증한다. registration_attempts DB 조회 없이 조립한 행만 넣는다
 * (LIVE POST 없음, LIVE 조회조차 없음 — 순수 AUTO 테스트).
 *
 * 실행: npx tsx apps/admin/scripts/verify-attempts-summary.ts
 * 하나라도 실패하면 assert가 예외를 던지고 프로세스가 비정상 종료한다(1).
 */
import assert from "node:assert/strict";
import { aggregateAttemptRows, type AttemptRow } from "../src/app/api/snapshots/_lib/attempts-summary";

function row(
  snapshotId: string,
  platform: string,
  status: "SUBMITTED" | "FAILED",
  createdAt: string,
): AttemptRow {
  return { snapshot_id: snapshotId, platform, status, created_at: createdAt };
}

let passed = 0;
function check(label: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log("D-10: SmartStore/Coupang 실제 등록 상태 분리\n");

// Case 1 — Coupang만 성공, SmartStore는 시도 자체가 없음 → SmartStore가 절대
// registeredPlatforms에 끼어들면 안 된다.
{
  const rows = [row("snap-1", "coupang", "SUBMITTED", "2026-08-19T01:00:00Z")];
  const result = aggregateAttemptRows(rows);
  check("Case 1: Coupang만 SUBMITTED → registeredPlatforms=[coupang], smartstore 없음", () => {
    assert.deepEqual(result["snap-1"].registeredPlatforms, ["coupang"]);
    assert.equal(result["snap-1"].hasError, false);
  });
}

// Case 2 — 같은 스냅샷에서 Coupang은 최신 시도가 FAILED, SmartStore는
// SUBMITTED. Coupang의 실패가 SmartStore의 성공 상태를 오염시키면 안 된다.
{
  const rows = [
    row("snap-2", "smartstore", "SUBMITTED", "2026-08-19T02:00:00Z"),
    row("snap-2", "coupang", "FAILED", "2026-08-19T01:30:00Z"),
  ];
  const result = aggregateAttemptRows(rows);
  check("Case 2: SmartStore 성공 + Coupang 실패가 서로 섞이지 않는다", () => {
    assert.deepEqual(result["snap-2"].registeredPlatforms, ["smartstore"]);
    // hasError는 스냅샷 전체 플래그(플랫폼 무관 "뭔가 문제가 있다" 신호)이므로
    // true여야 한다 — 다만 registeredPlatforms에 coupang이 없다는 게 핵심.
    assert.equal(result["snap-2"].hasError, true);
    assert.ok(!result["snap-2"].registeredPlatforms.includes("coupang" as never));
  });
}

// Case 3 — Coupang이 과거에 SUBMITTED(성공)했다가, 나중에 재시도해서 FAILED.
// "한 번이라도 성공한 적 있음"(registeredPlatforms)과 "지금 최신 상태가
// 실패"(hasError)는 별개 질문이라 둘 다 true가 나오는 게 올바른 설계다.
{
  const rows = [
    row("snap-3", "coupang", "FAILED", "2026-08-19T03:00:00Z"), // 최신
    row("snap-3", "coupang", "SUBMITTED", "2026-08-18T10:00:00Z"), // 과거 성공
  ];
  const result = aggregateAttemptRows(rows);
  check("Case 3: 과거 성공 + 최신 실패 → registeredPlatforms 유지, hasError=true", () => {
    assert.deepEqual(result["snap-3"].registeredPlatforms, ["coupang"]);
    assert.equal(result["snap-3"].hasError, true);
  });
}

// Case 4 — 두 스냅샷의 이력이 한 쿼리 결과에 섞여 들어와도 서로의 상태로
// 새어나가면 안 된다(가장 기본적인 격리 확인).
{
  const rows = [
    row("snap-a", "coupang", "SUBMITTED", "2026-08-19T01:00:00Z"),
    row("snap-b", "coupang", "FAILED", "2026-08-19T01:00:00Z"),
  ];
  const result = aggregateAttemptRows(rows);
  check("Case 4: 스냅샷 간 격리 — snap-a 성공이 snap-b로 새어나가지 않는다", () => {
    assert.deepEqual(result["snap-a"].registeredPlatforms, ["coupang"]);
    assert.equal(result["snap-a"].hasError, false);
    assert.deepEqual(result["snap-b"].registeredPlatforms, []);
    assert.equal(result["snap-b"].hasError, true);
  });
}

// Case 5 — lastAttemptAt은 플랫폼 무관하게 그 스냅샷의 가장 최근 시도 시각.
{
  const rows = [
    row("snap-5", "smartstore", "SUBMITTED", "2026-08-19T05:00:00Z"),
    row("snap-5", "coupang", "SUBMITTED", "2026-08-19T09:00:00Z"),
  ];
  const result = aggregateAttemptRows(rows);
  check("Case 5: lastAttemptAt은 플랫폼 무관 최신 시각(coupang 09:00)", () => {
    assert.equal(result["snap-5"].lastAttemptAt, "2026-08-19T09:00:00Z");
  });
}

// Case 6 — snapshot_id가 null인 행(마이그레이션 전 레거시 이력)은 조용히
// 건너뛴다(크래시하면 안 된다).
{
  const rows: AttemptRow[] = [
    { snapshot_id: null, platform: "coupang", status: "SUBMITTED", created_at: "2026-08-19T01:00:00Z" },
  ];
  check("Case 6: snapshot_id 없는 레거시 행은 무시된다(크래시 없음)", () => {
    const result = aggregateAttemptRows(rows);
    assert.deepEqual(result, {});
  });
}

console.log(`\n전체 ${passed}개 케이스 통과`);
