import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyExistingRegistration,
  createGateMessage,
  existingRegistrationMessage,
  resolveCreateGate,
  type ExistingRegistrationOutcome,
} from "../channel-lifecycle";
import { classifySiblingConnectionRows } from "@/app/api/_lib/channel-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-IMPLEMENT(CPO 승인, 2026-10-08) — **기존 등록 연결 복구.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 고치는 것은 중복 «감지» 가 아니다. 감지는 맞게 동작했다. 고치는 것은
 *    「이미 등록됨」 다음에 **갈 곳이 없던** 것이다.
 *
 * 실측(Production DB, 2026-10-08):
 *
 *   JOB-261008-002  snapshot a8892f0d  product 68c372cb  SUBMITTED 05:34:10
 *                   → channel_products  smartstore · 13737210648
 *   JOB-261008-003  snapshot e9c3d1c0  product 15096ca1  FAILED    05:52:54
 *                   → channel_products  «없음»          ← 셀러가 막힌 지점
 *   source_url      두 건이 «완전히 동일»(길이 145)
 *
 *   전수: 복구 가능 (JOB,채널) 74쌍 · 36 JOB · 3채널
 *   🔴 모호: JOB-260929-014 / -018 — lotteon 후보 2개
 *            (LO2782615680 · LO2782636437)
 *
 * 🔴 아래 fixture 는 그 실측값을 쓴다. 깨끗한 가짜 값으로 바꾸지 않는다 —
 *    그러면 「후보 2개」 같은 실제 모양을 놓친다.
 */

/* 실측 외부번호. 🔴 더미로 바꾸지 않는다. */
const SS_REAL = "13737210648";
const LO_A = "LO2782615680";
const LO_B = "LO2782636437";

const connection = (externalProductId: string, channel = "smartstore", status = "UNKNOWN") => ({
  channel,
  externalProductId,
  status,
});

/** 🔴 실측 — 연결을 «갖고 있는» 형제 작업. CPO ㉮ 의 이동 목적지다. */
const SIB_JOB = "JOB-261008-002";
const SIB_SNAPSHOT = "a8892f0d-8680-4b42-9069-71f5cab0632f";
const SIB = { jobKey: SIB_JOB, snapshotId: SIB_SNAPSHOT };

describe("🔴 ① 후보 1개 — EXISTING_CONNECTION_FOUND", () => {
  it("실측 JOB-261008-003 의 형제 연결 1건이면 FOUND 다", () => {
    const outcome = classifyExistingRegistration({ state: "FOUND", connection: connection(SS_REAL), target: SIB });
    expect(outcome.kind).toBe("EXISTING_CONNECTION_FOUND");
    if (outcome.kind !== "EXISTING_CONNECTION_FOUND") throw new Error("unreachable");
    expect(outcome.externalProductId).toBe(SS_REAL);
    expect(outcome.channel).toBe("smartstore");
  });

  it("🔴 셀러가 읽는 문장에 «상품번호가 들어 있다» — 모르는 번호를 확인하라고 하지 않는다", () => {
    const outcome = classifyExistingRegistration({ state: "FOUND", connection: connection(SS_REAL), target: SIB });
    const message = existingRegistrationMessage(outcome, "스마트스토어");
    expect(message).toContain(SS_REAL);
    /* 🔴 CPO ㉮ — 「연결하면」이 아니라 «갈 곳» 을 말한다. */
    expect(message).toContain(SIB_JOB);
    expect(message).not.toContain("연결하면");
  });

  it("🔴 FOUND 는 status 를 «지어내지 않는다» — 기록된 값 그대로다", () => {
    const outcome = classifyExistingRegistration({
      state: "FOUND",
      connection: connection(SS_REAL, "smartstore", "UNKNOWN"),
      target: SIB,
    });
    if (outcome.kind !== "EXISTING_CONNECTION_FOUND") throw new Error("unreachable");
    expect(outcome.status).toBe("UNKNOWN");
    expect(outcome.status).not.toBe("LIVE");
  });
});

describe("🔴 ② 후보 0개 — NEEDS_RECONCILIATION", () => {
  it("형제에 연결이 없으면 NO_CANDIDATE 다", () => {
    const outcome = classifyExistingRegistration({ state: "NONE" });
    expect(outcome).toEqual({ kind: "NEEDS_RECONCILIATION", reason: "NO_CANDIDATE", candidates: [] });
  });

  it("🔴 「등록 실패」로 말하지 않는다 — 할 수 있는 일을 말한다", () => {
    const message = existingRegistrationMessage(classifyExistingRegistration({ state: "NONE" }), "스마트스토어");
    expect(message).not.toContain("실패");
    expect(message).toContain("연결");
  });
});

describe("🔴🔴 ③ 후보 2개 이상 — 임의 선택 금지", () => {
  /** 🔴 실데이터 회귀(CPO 지정): JOB-260929-014 / -018 의 lotteon 후보 2개. */
  const scan = { state: "AMBIGUOUS" as const, connections: [connection(LO_A, "lotteon"), connection(LO_B, "lotteon")] };

  it("AMBIGUOUS 는 FOUND 로 «승격되지 않는다»", () => {
    const outcome = classifyExistingRegistration(scan);
    expect(outcome.kind).toBe("NEEDS_RECONCILIATION");
    expect(outcome.kind).not.toBe("EXISTING_CONNECTION_FOUND");
  });

  it("🔴 후보를 하나로 줄이지 않는다 — 둘 다 그대로 남는다", () => {
    const outcome = classifyExistingRegistration(scan);
    if (outcome.kind !== "NEEDS_RECONCILIATION") throw new Error("unreachable");
    expect(outcome.reason).toBe("MULTIPLE_CANDIDATES");
    expect(outcome.candidates).toEqual([LO_A, LO_B]);
  });

  it("🔴 문장이 후보 «전부» 를 보여준다 — 하나만 보여주면 셀러가 그것을 고른다", () => {
    const message = existingRegistrationMessage(classifyExistingRegistration(scan), "롯데ON");
    expect(message).toContain(LO_A);
    expect(message).toContain(LO_B);
  });
});

describe("🔴 ④ 확인 못 함 — UNKNOWN 을 「없다」로 적지 않는다", () => {
  it("UNKNOWN 은 NO_CANDIDATE 와 «다른» 사유로 남는다", () => {
    const outcome = classifyExistingRegistration({ state: "UNKNOWN" });
    if (outcome.kind !== "NEEDS_RECONCILIATION") throw new Error("unreachable");
    expect(outcome.reason).toBe("UNKNOWN");
    expect(outcome.reason).not.toBe("NO_CANDIDATE");
  });

  it("🔴 모르는 상태에서 상품번호를 지어내지 않는다", () => {
    const message = existingRegistrationMessage(classifyExistingRegistration({ state: "UNKNOWN" }), "스마트스토어");
    expect(message).toContain("확인하지 못");
    expect(message).not.toMatch(/\d{8,}/);
  });
});

describe("🔴🔴 ⑤ 복구 경로가 생겨도 CREATE 는 열리지 않는다", () => {
  it("resolveCreateGate 는 그대로 BLOCKED_PRIOR_SUCCESS 다", () => {
    expect(
      resolveCreateGate({ hasChannelProduct: false, priorSuccess: true, plannedOperation: "CREATE" }),
    ).toBe("BLOCKED_PRIOR_SUCCESS");
  });

  it("🔴 ExistingRegistrationOutcome 에 «허용» 을 뜻하는 값이 구조적으로 없다", () => {
    /* 타입으로 막혀 있다는 것을 런타임으로도 확인한다 — 네 입력 모두가
       두 kind 중 하나로만 떨어진다. */
    const inputs: Parameters<typeof classifyExistingRegistration>[0][] = [
      { state: "NONE" },
      { state: "UNKNOWN" },
      { state: "FOUND", connection: connection(SS_REAL), target: SIB },
      { state: "AMBIGUOUS", connections: [connection(LO_A), connection(LO_B)] },
    ];
    const kinds = inputs.map((s) => classifyExistingRegistration(s).kind);
    expect(new Set(kinds)).toEqual(new Set(["EXISTING_CONNECTION_FOUND", "NEEDS_RECONCILIATION"]));
    expect(kinds).not.toContain("ALLOW");
  });

  it("기존 차단 문구가 사라지지 않는다(회귀)", () => {
    expect(createGateMessage("BLOCKED_PRIOR_SUCCESS", "스마트스토어")).toContain("중복");
    expect(createGateMessage("BLOCKED_LINKED", "스마트스토어", SS_REAL)).toContain(SS_REAL);
  });
});

describe("🔴 ⑥ 다른 상품 / 다른 채널 정책은 그대로다 (회귀)", () => {
  it("연결도 이력도 없으면 ALLOW — 정상 신규 등록이 막히지 않는다", () => {
    expect(
      resolveCreateGate({ hasChannelProduct: false, priorSuccess: false, plannedOperation: "CREATE" }),
    ).toBe("ALLOW");
  });

  it("연결을 알면 BLOCKED_LINKED — 복구 경로로 빠지지 않는다", () => {
    expect(
      resolveCreateGate({ hasChannelProduct: true, priorSuccess: true, plannedOperation: "CREATE" }),
    ).toBe("BLOCKED_LINKED");
  });

  it("동의받은 RECREATE 는 여전히 지나간다", () => {
    expect(
      resolveCreateGate({ hasChannelProduct: true, priorSuccess: true, plannedOperation: "RECREATE" }),
    ).toBe("ALLOW");
  });

  it("확인 못 하면 여전히 막는다", () => {
    expect(
      resolveCreateGate({ hasChannelProduct: false, priorSuccess: null, plannedOperation: "CREATE" }),
    ).toBe("BLOCKED_UNKNOWN");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴 후보를 «무엇으로 세는가» — 동작으로 잠근다.

   처음엔 소스 문자열 검사(`byExternalId` 가 있는가)로 뒀는데, mutation M4 가
   그것이 하중을 받지 않음을 증명했다 — 선언을 지워도 뒤에 남은 참조 때문에
   통과했다. 그래서 순수 함수로 뽑아 동작을 단언한다.
   ───────────────────────────────────────────────────────────────────────── */
const row = (id: string, productId: string, externalProductId: string | null, status = "UNKNOWN") => ({
  id,
  product_id: productId,
  channel: "smartstore",
  external_product_id: externalProductId,
  status,
});

describe("🔴🔴 ⑧ 후보는 외부 상품번호로 센다 — 행 수로 세지 않는다", () => {
  it("🔴 형제 Product 가 셋인데 외부번호가 «하나» 면 FOUND 다 (실측 JOB-260928-006 모양)", () => {
    const scan = classifySiblingConnectionRows(
      [row("r1", "p1", "13719076772"), row("r2", "p2", "13719076772"), row("r3", "p3", "13719076772")],
      new Map([["p1", SIB]]),
    );
    expect(scan.state).toBe("FOUND");
    if (scan.state !== "FOUND") throw new Error("unreachable");
    expect(scan.connection.externalProductId).toBe("13719076772");
  });

  it("외부번호가 둘이면 AMBIGUOUS 다 (실측 lotteon 모양)", () => {
    const scan = classifySiblingConnectionRows([row("r1", "p1", LO_A), row("r2", "p2", LO_B)]);
    expect(scan.state).toBe("AMBIGUOUS");
    if (scan.state !== "AMBIGUOUS") throw new Error("unreachable");
    expect(scan.connections.map((c) => c.externalProductId)).toEqual([LO_A, LO_B]);
  });

  it("🔴 같은 번호가 여러 행이면 «가장 최근»(첫 행)을 남긴다", () => {
    const scan = classifySiblingConnectionRows(
      [row("newest", "p1", SS_REAL, "UNKNOWN"), row("older", "p2", SS_REAL, "LIVE")],
      new Map([["p1", SIB]]),
    );
    if (scan.state !== "FOUND") throw new Error("unreachable");
    expect(scan.connection.id).toBe("newest");
    expect(scan.connection.status).toBe("UNKNOWN");
  });

  it("🔴 외부번호가 빈 행은 후보로 세지 않는다 — 번호 없는 연결은 이을 수 없다", () => {
    expect(classifySiblingConnectionRows([row("r1", "p1", null), row("r2", "p2", "")]).state).toBe("NONE");
  });

  it("행이 없으면 NONE", () => {
    expect(classifySiblingConnectionRows([]).state).toBe("NONE");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴 소스 경계 — 「형제 탐색 기준을 두 벌 만들지 않는다」를 코드로 잠근다.
   🔴 주석을 벗기고 본다(여덟 번 걸린 함정).
   ───────────────────────────────────────────────────────────────────────── */
function strippedSource(relativeFromRepoCommerce: string): string {
  const abs = path.join(__dirname, relativeFromRepoCommerce);
  return readFileSync(abs, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("🔴🔴 ⑦ 형제 탐색 기준이 한 벌이다", () => {
  const channelProduct = "../../../api/_lib/channel-product.ts";

  it("연결 복구가 «중복 차단과 같은» 형제 탐색 함수를 부른다", () => {
    const src = strippedSource(channelProduct);
    expect(src).toContain("resolveSameSourceSnapshotIds");
  });

  it("🔴 정규화를 다시 구현하지 않는다 — computeSourceUrlKey 를 여기서 부르지 않는다", () => {
    const src = strippedSource(channelProduct);
    expect(src).not.toContain("computeSourceUrlKey");
  });

  it("🔴 자기 Product 를 형제로 세지 않는다", () => {
    const src = strippedSource(channelProduct);
    expect(src).toContain("ownProductId");
  });


  it("🔴 라우트가 복구 조립을 복제하지 않는다 — 공용 헬퍼를 부른다", () => {
    const src = strippedSource("../../../api/smartstore/register/route.ts");
    expect(src).toContain("buildExistingRegistrationNotice");
    expect(src).not.toContain("findSiblingChannelConnections");
  });

  it("🔴 복구 조회는 BLOCKED_PRIOR_SUCCESS 에서만 한다 — 막지 않을 것에 DB 를 더 때리지 않는다", () => {
    const src = strippedSource("../../../api/smartstore/register/route.ts");
    expect(src).toMatch(/gate === "BLOCKED_PRIOR_SUCCESS"\s*\?\s*await buildExistingRegistrationNotice/);
  });

  /**
   * 🔴🔴 CPO 결정 ㉮ — **`linkLegacyRegistration` 을 이 용도로 쓰지 않는다.**
   *
   * 실측으로 확인됐다: 그 함수는 «외부번호» 로 대상 snapshot 을 고르므로
   * 13737210648 은 JOB-002 를 가리키고, 이미 그 Product 에 물려 있어
   * `alreadyLinked` 로 끝난다. 억지로 옮기면 두 Product 가 한 외부상품을
   * 가리켜 다음 UPDATE 의 기준이 사라진다.
   */
  it("🔴 복구 경로가 link 라우트를 부르지 않는다", () => {
    for (const f of ["../../../api/_lib/existing-registration.ts", channelProduct]) {
      expect(strippedSource(f), `${f} 가 link 를 복구 수단으로 쓴다`).not.toContain("linkLegacyRegistration");
    }
    /* 🔴 `replaceChannelProductLink` 는 channel-product.ts 의 «기존» RECREATE 수단이다
       (지우면 재등록이 깨진다). 금지하는 것은 «복구 경로» 가 그것을 쓰는 것이다. */
    expect(strippedSource("../../../api/_lib/existing-registration.ts")).not.toContain("replaceChannelProductLink");
  });

  it("🔴 복구 경로에 channel_products 쓰기가 «없다» — 이동은 쓰기가 0 이다", () => {
    const src = strippedSource("../../../api/_lib/existing-registration.ts");
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });
});

describe("🔴🔴 ⑨ CPO ㉮ — 기존 등록 작업으로 «이동» 시킨다", () => {
  it("FOUND 는 이동할 JOB 키를 싣는다", () => {
    const outcome = classifyExistingRegistration({
      state: "FOUND",
      connection: connection(SS_REAL),
      target: SIB,
    });
    if (outcome.kind !== "EXISTING_CONNECTION_FOUND") throw new Error("unreachable");
    expect(outcome.siblingJobKey).toBe(SIB_JOB);
    expect(outcome.siblingSnapshotId).toBe(SIB_SNAPSHOT);
  });

  it("🔴 이동할 곳을 모르면 FOUND 로 «올리지 않는다» — 갈 곳 없는 「찾았다」는 고치기 전과 같다", () => {
    /* originByProduct 를 주지 않으면 목적지가 없다. */
    const scan = classifySiblingConnectionRows([row("r1", "p1", SS_REAL)]);
    expect(scan.state).not.toBe("FOUND");
    expect(scan.state).toBe("AMBIGUOUS");
  });

  it("목적지가 있으면 FOUND 이고 그 JOB 을 가리킨다", () => {
    const scan = classifySiblingConnectionRows(
      [row("r1", "p1", SS_REAL)],
      new Map([["p1", { jobKey: SIB_JOB, snapshotId: SIB_SNAPSHOT }]]),
    );
    if (scan.state !== "FOUND") throw new Error("unreachable");
    expect(scan.target.jobKey).toBe(SIB_JOB);
    expect(scan.target.snapshotId).toBe(SIB_SNAPSHOT);
  });

  it("🔴 jobKey 가 null 이어도 «지어내지 않고» 일반 문구로 안내한다", () => {
    const outcome = classifyExistingRegistration({
      state: "FOUND",
      connection: connection(SS_REAL),
      target: { jobKey: null, snapshotId: SIB_SNAPSHOT },
    });
    const message = existingRegistrationMessage(outcome, "스마트스토어");
    expect(message).toContain("기존 등록 작업");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
