import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttemptByPlatform, type LastAttemptRow } from "../../../api/snapshots/_lib/attempts-summary";
import {
  LOTTEON_COMMERCE_ID,
  blocksRegistrationRequest,
  isAlreadyRegistered,
  resolveRegistrationState,
  type CommerceChannelConnections,
  type CommerceLastAttempts,
  type RegistrationStateInput,
} from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-D 후속(CEO 확정, 2026-09-24) — **중복 등록의 마지막 방어선은 DB 다**
 * P0-CHANNEL-03 F-10(CTO 지시, 2026-09-25) — **기준이 ChannelProduct 로 옮겼다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 옮겼나 ─────────────────────────────────────────────────────────────
 * 전: 이 «snapshot» 에 SUBMITTED 이력이 있는가  → 재분석하면 초기화됐다
 * 후: 이 «상품» 이 이 채널에 나가 있는가         → 재분석해도 그대로다
 *
 * 재분석하면 새 snapshot 이 생기고 그 snapshot 에는 이력이 없어, 화면이
 * 「미등록」이라고 말했다. 셀러가 그 말을 믿고 다시 누른 결과가 SmartStore
 * 외부번호 6개다.
 *
 * 🔴 이 파일이 지키는 두 가지:
 *   ① 이력은 «막는 쪽으로만» 일한다 — 상태의 근거로 복귀하지 않는다.
 *   ② 「등록됨」과 「보내면 안 됨」은 «다른 질문» 이다. 그 둘이 같았기 때문에
 *      등록된 상품을 고칠 방법이 아예 없었다.
 */

const submitted = (id: string) => ({ status: "SUBMITTED" as const, at: "2026-09-24T01:00:00Z", externalProductId: id, errorCode: null });
const failed = (code: string) => ({ status: "FAILED" as const, at: "2026-09-24T01:00:00Z", externalProductId: null, errorCode: code });
const link = (id: string) => ({ externalProductId: id, channelProductId: `cp_${id}`, status: "UNKNOWN" });

/** 기본은 「정체성 있음 · 연결 없음 · 이력 없음」 — 새로 수집한 상품. */
const input = (over: Partial<RegistrationStateInput> = {}): RegistrationStateInput => ({
  connections: {} as CommerceChannelConnections,
  hasProductIdentity: true,
  lastAttempts: {} as CommerceLastAttempts,
  ...over,
});

describe("① 연결이 있으면 그것이 답이다", () => {
  it("🔴 최초 등록은 막지 않는다 — 연결도 이력도 없다", () => {
    expect(isAlreadyRegistered(input(), "smartstore")).toBe(false);
    expect(blocksRegistrationRequest(resolveRegistrationState("smartstore", input()))).toBe(false);
  });

  it("연결이 있으면 «등록됨» 이고 근거가 ChannelProduct 다", () => {
    const state = resolveRegistrationState("smartstore", input({ connections: { smartstore: link("13664004406") } }));
    expect(state.registered).toBe(true);
    expect(state.basis).toBe("CHANNEL_PRODUCT");
    expect(state.externalProductId).toBe("13664004406");
  });

  it("🔴 연결을 «아는» 상품은 요청을 막지 않는다 — 서버가 UPDATE/RECREATE 를 정한다", () => {
    /* 여기서 막으면 셀러는 등록한 상품을 영영 고칠 수 없다. 중복은 라우트의
       blocksCreate 빗장과 lifecycle 판단이 막는다 — 화면이 막을 일이 아니다. */
    const state = resolveRegistrationState("smartstore", input({ connections: { smartstore: link("1") } }));
    expect(blocksRegistrationRequest(state)).toBe(false);
  });

  it("🔴 채널은 서로 독립이다 — 스마트스토어 연결이 쿠팡을 막지 않는다", () => {
    const i = input({ connections: { smartstore: link("1") } });
    expect(isAlreadyRegistered(i, "smartstore")).toBe(true);
    expect(isAlreadyRegistered(i, "coupang")).toBe(false);
    expect(isAlreadyRegistered(i, LOTTEON_COMMERCE_ID)).toBe(false);
  });

  it("롯데ON 도 같은 규칙을 탄다", () => {
    expect(isAlreadyRegistered(input({ connections: { [LOTTEON_COMMERCE_ID]: link("L1") } }), LOTTEON_COMMERCE_ID)).toBe(true);
  });
});

describe("①-2 🔴 기존 CREATE 회귀 — 세 경우를 그대로 유지한다(CTO 명시)", () => {
  it("Product 없음 + Snapshot → CREATE", () => {
    const i = input({ hasProductIdentity: false });
    expect(isAlreadyRegistered(i, "smartstore")).toBe(false);
    expect(blocksRegistrationRequest(resolveRegistrationState("smartstore", i))).toBe(false);
  });

  it("Product 있음 + ChannelProduct 없음 → CREATE", () => {
    /* 🔴 ChannelProduct 가 없다고 «UPDATE 로 가지 않는다». 연결이 없으면
       나가 있지 않은 것이고, 나가 있지 않으면 만드는 것이 맞다. */
    const i = input({ hasProductIdentity: true });
    expect(resolveRegistrationState("smartstore", i).basis).toBe("NONE");
    expect(blocksRegistrationRequest(resolveRegistrationState("smartstore", i))).toBe(false);
  });

  it("Product 있음 + ChannelProduct 있음 → lifecycle 판단(막지 않는다)", () => {
    const i = input({ connections: { smartstore: link("1") } });
    expect(resolveRegistrationState("smartstore", i).basis).toBe("CHANNEL_PRODUCT");
    expect(blocksRegistrationRequest(resolveRegistrationState("smartstore", i))).toBe(false);
  });
});

describe("② 🔴 재분석해도 등록 상태가 사라지지 않는다 — 이번 작업의 핵심", () => {
  it("새 snapshot(이력 0건)이어도 같은 Product 의 연결이 있으면 «등록됨» 이다", () => {
    /* 재분석 → 새 snapshot → 이력은 비어 있다. 그러나 연결은 Product 에
       매달려 있어 그대로다. 옛 기준이라면 여기서 「미등록」이 됐고, 셀러가
       다시 눌러 외부번호가 하나 더 생겼다. */
    const afterReanalysis = input({ connections: { smartstore: link("13713593585") }, lastAttempts: {} });
    const state = resolveRegistrationState("smartstore", afterReanalysis);
    expect(state.registered).toBe(true);
    expect(state.basis).toBe("CHANNEL_PRODUCT");
    /* 그리고 「등록됨 / 수정 가능」이다 — 막히지 않는다. */
    expect(blocksRegistrationRequest(state)).toBe(false);
  });
});

describe("③ 🔴 이력은 «막는 쪽으로만» 일한다", () => {
  it("연결이 없고 성공 이력만 있으면 등록됨 — 상품은 이미 마켓에 있다", () => {
    const state = resolveRegistrationState("coupang", input({ lastAttempts: { coupang: submitted("16394846257") } }));
    expect(state.registered).toBe(true);
    expect(state.basis).toBe("ATTEMPT_ONLY");
  });

  it("🔴 그 상태에서는 요청을 «막는다» — 서버가 CREATE 로 내려가 중복이 된다", () => {
    /* 서버도 연결을 못 찾으므로 CREATE 경로를 탄다. 마켓에 이미 있는 상품이
       하나 더 생긴다 — 정확히 이번 스프린트가 고치려는 사고다. */
    const state = resolveRegistrationState("coupang", input({ lastAttempts: { coupang: submitted("16394846257") } }));
    expect(blocksRegistrationRequest(state)).toBe(true);
  });

  it("🔴 정체성이 있는데 연결이 없으면 needsAttention — 기록이 유실된 것이다", () => {
    const lost = resolveRegistrationState("coupang", input({ hasProductIdentity: true, lastAttempts: { coupang: submitted("9") } }));
    expect(lost.needsAttention).toBe(true);
  });

  it("기존 381건(정체성 없음)은 needsAttention 이 아니다 — 예전부터의 정상 상태다", () => {
    const legacy = resolveRegistrationState("coupang", input({ hasProductIdentity: false, lastAttempts: { coupang: submitted("9") } }));
    expect(legacy.registered).toBe(true);
    expect(legacy.basis).toBe("ATTEMPT_ONLY");
    expect(legacy.needsAttention).toBe(false);
    /* 🔴 기존 화면이 깨지지 않는다 — 옛 기준과 «같은» 답을 낸다. */
    expect(blocksRegistrationRequest(legacy)).toBe(true);
  });

  it("🔴 실패는 막지 «않는다» — 재시도는 정상 흐름이다", () => {
    expect(isAlreadyRegistered(input({ lastAttempts: { coupang: failed("CP001") } }), "coupang")).toBe(false);
  });

  it("🔴 이력이 «등록됨» 을 취소하지 못한다 — 연결이 있으면 이력을 보지 않는다", () => {
    /* 이것이 「이력을 상태의 근거로 복귀시키지 않는다」의 실제 의미다.
       연결이 있는 한 마지막 시도가 FAILED 여도 등록 상태는 유지된다. */
    const state = resolveRegistrationState("coupang", input({
      connections: { coupang: link("16394846257") },
      lastAttempts: { coupang: failed("CP001") },
    }));
    expect(state.registered).toBe(true);
    expect(state.basis).toBe("CHANNEL_PRODUCT");
  });
});

describe("④ DB 이력 → 마지막 시도 → 판정까지 이어진다", () => {
  const rows: LastAttemptRow[] = [
    { snapshot_id: "s1", platform: "smartstore", status: "SUBMITTED", created_at: "2026-09-24T01:00:00Z", external_product_id: "13664004406", error_code: null },
    { snapshot_id: "s1", platform: "coupang", status: "FAILED", created_at: "2026-09-24T02:00:00Z", external_product_id: null, error_code: "CP001" },
  ];

  it("연결이 아직 없는 기존 상품은 이력으로 판정된다", () => {
    const i = input({ hasProductIdentity: false, lastAttempts: latestAttemptByPlatform(rows) as CommerceLastAttempts });
    expect(isAlreadyRegistered(i, "smartstore")).toBe(true); // 성공 이력 → 막힘
    expect(isAlreadyRegistered(i, "coupang")).toBe(false); // 마지막이 실패 → 재시도 가능
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("⑤ 단독 등록과 다중 등록이 «같은 문» 을 지난다", () => {
  it("🔴 판정이 한 곳이다 — 화면이 자기 규칙을 따로 만들지 않는다", () => {
    expect(WORKSPACE).toContain("const blockedFromSending = (id: CommerceId) => blocksRegistrationRequest(registrationStateFor(id));");
  });

  it("단독 등록 경로가 그 문을 지난다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("async function confirmListing("),
      WORKSPACE.indexOf("setListingProgress(\"PREPARING\")"),
    );
    expect(fn).toContain("if (blockedFromSending(platform))");
  });

  it("다중 등록 경로도 그 문을 지난다 — 그리고 «실행하지 않았다» 고 적는다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("if (blockedFromSending(id))");
    expect(loop).toContain('status: "SKIPPED"');
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
    expect(WORKSPACE).toContain('entry.mode === "LIVE" && entry.result.status === "SUBMITTED"');
  });
});

describe("⑥ 🔴 RECREATE 동의는 «그 요청에만» 실린다", () => {
  it("동의를 state 에 눌러 두지 않는다 — 인자로 그때만 넘긴다", () => {
    /* state 에 두면 다음 상품·다음 채널의 RECREATE 가 묻지도 않고 나간다. */
    expect(WORKSPACE).toContain("confirmRecreate: options?.confirmRecreate,");
  });

  it("서버가 되물으면 «문자열이 아니라» 구조로 받는다", () => {
    expect(WORKSPACE).toContain("if (result.needsConfirmation) {");
    /* error.message 를 뒤져서 동의 UI 를 띄우지 않는다 — 문구가 바뀌면
       조용히 사라지는 결합을 만들지 않는다. */
    expect(WORKSPACE).not.toContain("새 상품으로 다시 등록합니다\")");
  });
});

describe("⑦ 새 저장소를 만들지 않았다", () => {
  it("이력과 연결을 «읽기만» 한다", () => {
    const route = readFileSync(
      join(__dirname, "../../../api/snapshots/[id]/attempts/route.ts"),
      "utf8",
    );
    expect(route).toContain('.from("registration_attempts")');
    /* 🔴 F-10 — channel_products 를 «같이» 읽는다(상태의 근거). 단, 읽기뿐이고
       조회는 공통 저장소(_lib/channel-product)를 거친다 — 라우트가 직접
       테이블을 짜면 세 채널 중 하나를 빠뜨리는 일이 생긴다. */
    expect(route).toContain("findChannelProductsBySnapshot");
    for (const forbidden of ["insert(", "update(", "upsert(", "delete("]) {
      expect(route).not.toContain(forbidden);
    }
  });

  it("snapshot workspace 에 등록 상태 칸을 만들지 않았다", () => {
    const types = readFileSync(join(__dirname, "../../../api/snapshots/_lib/types.ts"), "utf8");
    const workspaceState = types.slice(
      types.indexOf("export interface SnapshotWorkspaceState {"),
      types.indexOf("export interface ProductSnapshot {"),
    );
    for (const forbidden of ["registered", "alreadyRegistered", "lastAttempts", "connections"]) {
      expect(workspaceState, `workspace 에 저장되는 칸이 생겼다: ${forbidden}`).not.toContain(forbidden);
    }
  });
});
