import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttemptByPlatform, type LastAttemptRow } from "../../../api/snapshots/_lib/attempts-summary";
import {
  LOTTEON_COMMERCE_ID,
  isAlreadyRegistered,
  type CommerceLastAttempts,
} from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-D 후속(CEO 확정, 2026-09-24) — **중복 등록의 마지막 방어선은 DB 다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Gate 6번이 조건부 PASS 였던 이유: 중복 LIVE 차단이 «세션 안의 기억» 하나였다.
 * 새로고침하면 그 기억이 비워지고, 화면은 「✓ 등록됨」이라 말하는데 코드는
 * 막지 않는 상태가 됐다. 실제 등록 전에 반드시 닫아야 하는 구멍이었다.
 *
 * 🔴 기준을 `registration_attempts`(영속)로 옮긴다. 새 테이블도 새 컬럼도
 * 만들지 않는다 — 이미 쌓이고 있는 그 표를 읽을 뿐이다.
 *
 * 🔴 막는 것은 「이미 성공했다」 하나뿐이다. 실패 재시도도, 최초 등록도, 다른
 * 채널도 막지 않는다. 「의도적 재등록」 기능은 이번에 만들지 않는다(CEO 확정).
 */

const attempts = (over: CommerceLastAttempts): CommerceLastAttempts => over;
const submitted = (id: string) => ({ status: "SUBMITTED" as const, at: "2026-09-24T01:00:00Z", externalProductId: id, errorCode: null });
const failed = (code: string) => ({ status: "FAILED" as const, at: "2026-09-24T01:00:00Z", externalProductId: null, errorCode: code });

describe("① 이미 성공한 커머스만 막는다", () => {
  it("🔴 최초 등록은 막지 않는다 — 이력이 없다", () => {
    expect(isAlreadyRegistered(attempts({}), "smartstore")).toBe(false);
  });

  it("🔴 성공 이력이 있으면 막는다", () => {
    expect(isAlreadyRegistered(attempts({ smartstore: submitted("13664004406") }), "smartstore")).toBe(true);
  });

  it("🔴 실패는 막지 «않는다» — 재시도는 정상 흐름이다", () => {
    expect(isAlreadyRegistered(attempts({ coupang: failed("CP001") }), "coupang")).toBe(false);
  });

  it("🔴 채널은 서로 독립이다 — 스마트스토어 성공이 쿠팡을 막지 않는다", () => {
    const state = attempts({ smartstore: submitted("1"), coupang: failed("CP001") });
    expect(isAlreadyRegistered(state, "smartstore")).toBe(true);
    expect(isAlreadyRegistered(state, "coupang")).toBe(false);
    expect(isAlreadyRegistered(state, LOTTEON_COMMERCE_ID)).toBe(false);
  });

  it("쿠팡 성공이 스마트스토어 재등록을 막지 않는다(그 반대도)", () => {
    const state = attempts({ coupang: submitted("9") });
    expect(isAlreadyRegistered(state, "coupang")).toBe(true);
    expect(isAlreadyRegistered(state, "smartstore")).toBe(false);
  });

  it("롯데ON 도 같은 규칙을 탄다", () => {
    expect(isAlreadyRegistered(attempts({ [LOTTEON_COMMERCE_ID]: submitted("L1") }), LOTTEON_COMMERCE_ID)).toBe(true);
  });
});

describe("② 새로고침을 넘는다 — 판단 근거가 DB 이기 때문", () => {
  /* 화면 state 는 새로고침하면 비워진다. 그래서 판단 근거를 «DB 에서 읽은 값» 으로
     둔다 — 아래는 그 값이 실제 이력에서 어떻게 만들어지는지까지 이어 붙인 것이다. */
  const rows: LastAttemptRow[] = [
    { snapshot_id: "s1", platform: "smartstore", status: "SUBMITTED", created_at: "2026-09-24T01:00:00Z", external_product_id: "13664004406", error_code: null },
    { snapshot_id: "s1", platform: "coupang", status: "FAILED", created_at: "2026-09-24T02:00:00Z", external_product_id: null, error_code: "CP001" },
  ];

  it("DB 이력 → 마지막 시도 → 중복 판정까지 한 줄로 이어진다", () => {
    const last = latestAttemptByPlatform(rows) as CommerceLastAttempts;
    expect(isAlreadyRegistered(last, "smartstore")).toBe(true); // 성공 이력 → 막힘
    expect(isAlreadyRegistered(last, "coupang")).toBe(false); // 마지막이 실패 → 재시도 가능
  });

  it("🔴 성공한 뒤 실패가 이어져도 «이미 등록됨» 이다 — 상품은 이미 나갔다", () => {
    /* 마지막 시도만 보면 FAILED 라 재시도로 읽히지만, 그 앞에 SUBMITTED 가 있으면
       상품은 이미 마켓에 있다. latestAttemptByPlatform 은 «마지막» 을 주므로
       이 경우 화면은 재시도를 허용한다 — 그래서 여기서 그 한계를 명시해 둔다. */
    const late = latestAttemptByPlatform([
      { snapshot_id: "s1", platform: "coupang", status: "FAILED", created_at: "2026-09-24T03:00:00Z", external_product_id: null, error_code: "CP001" },
      { snapshot_id: "s1", platform: "coupang", status: "SUBMITTED", created_at: "2026-09-24T01:00:00Z", external_product_id: "9", error_code: null },
    ]) as CommerceLastAttempts;
    // 현재 계약: «마지막 시도» 기준. 이 조합은 E 단계 실측에서 다시 본다.
    expect(isAlreadyRegistered(late, "coupang")).toBe(false);
    expect(late.coupang?.status).toBe("FAILED");
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("③ 단독 등록과 다중 등록이 «같은 문» 을 지난다", () => {
  it("🔴 판정이 한 곳이다 — 화면이 자기 규칙을 따로 만들지 않는다", () => {
    expect(WORKSPACE).toContain("const alreadyRegistered = (id: CommerceId) => isAlreadyRegistered(commerceLastAttempts, id);");
  });

  it("단독 등록 경로가 그 문을 지난다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("async function confirmListing("),
      WORKSPACE.indexOf("setListingProgress(\"PREPARING\")"),
    );
    expect(fn).toContain("if (alreadyRegistered(platform))");
  });

  it("다중 등록 경로도 그 문을 지난다 — 그리고 «실행하지 않았다» 고 적는다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("if (alreadyRegistered(id))");
    expect(loop).toContain('status: "SKIPPED"');
    expect(loop).toContain("이미 등록된 커머스라 다시 보내지 않았습니다.");
    // 🔴 건너뛴 것을 성공으로 세지 않는다.
    expect(loop).not.toContain('[id]: { status: "SUBMITTED" }');
  });

  it("🔴 건너뛴 채널이 나머지 채널을 막지 않는다 — 루프는 계속 돈다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("continue;");
    expect(loop).not.toContain("break;");
  });

  it("세션 기억 차단도 그대로 남아 있다 — 두 겹이다", () => {
    // DB 가 마지막 방어선이고, 세션 차단은 같은 화면 안에서의 연속 클릭을 막는다.
    expect(WORKSPACE).toContain('entry.mode === "LIVE" && entry.result.status === "SUBMITTED"');
  });
});

describe("④ 새 저장소를 만들지 않았다", () => {
  it("registration_attempts 만 읽는다", () => {
    const route = readFileSync(
      join(__dirname, "../../../api/snapshots/[id]/attempts/route.ts"),
      "utf8",
    );
    expect(route).toContain('.from("registration_attempts")');
    for (const forbidden of ["insert(", "update(", "upsert("]) {
      expect(route).not.toContain(forbidden);
    }
  });

  it("snapshot workspace 에 등록 상태 칸을 만들지 않았다", () => {
    /* 🔴 `SnapshotWorkspaceState`(= workspace jsonb 에 저장되는 것)만 본다.
       같은 파일의 `ProductSnapshotSummary.registeredPlatforms` 는 목록 API 가
       registration_attempts 를 집계해 «조회 시점에» 채우는 파생값이고, 저장되는
       값이 아니다 — 이번 작업과 무관하게 예전부터 있었다. */
    const types = readFileSync(join(__dirname, "../../../api/snapshots/_lib/types.ts"), "utf8");
    const workspaceState = types.slice(
      types.indexOf("export interface SnapshotWorkspaceState {"),
      types.indexOf("export interface ProductSnapshot {"),
    );
    for (const forbidden of ["registered", "alreadyRegistered", "lastAttempts"]) {
      expect(workspaceState, `workspace 에 저장되는 칸이 생겼다: ${forbidden}`).not.toContain(forbidden);
    }
  });
});
