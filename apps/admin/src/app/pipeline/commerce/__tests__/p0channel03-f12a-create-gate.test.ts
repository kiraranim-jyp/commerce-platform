import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_ORDER,
  type CommerceId,
} from "../commerce-registry";
import {
  createGateMessage,
  resolveCreateGate,
  type CreateGateVerdict,
} from "../channel-lifecycle";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a(CTO 지시 §7) — **새 상품을 만들어도 되는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-12 후속에서 이 빗장을 세 라우트에 «복제» 했다. 복제된 판단은 반드시
 * 갈라진다 — 그때도 채널 문자열 하나만 안 고치면 조용히 틀리는 상태였다.
 * 판단을 한 곳으로 모았고, 이 파일이 §7 매트릭스를 «표로» 고정한다.
 *
 * 🔴 문자열 검사가 아니라 «동작» 을 본다. 소스에 특정 문자열이 있는지 보는
 * 검사는 리팩터 한 번에 무의미해진다(이 세션에서 세 번 겪었다).
 */

/** CTO 지시 §7 의 표를 그대로 옮긴다. */
const MATRIX: {
  state: string;
  hasChannelProduct: boolean;
  priorSuccess: boolean | null;
  create: CreateGateVerdict;
  recreate: CreateGateVerdict;
}[] = [
  {
    state: "ChannelProduct 있음",
    hasChannelProduct: true,
    priorSuccess: true,
    create: "BLOCKED_LINKED",
    recreate: "ALLOW",
  },
  {
    state: "ChannelProduct 없음 + 성공 이력 있음",
    hasChannelProduct: false,
    priorSuccess: true,
    create: "BLOCKED_PRIOR_SUCCESS",
    recreate: "ALLOW",
  },
  {
    state: "ChannelProduct 없음 + 이력 조회 실패(null)",
    hasChannelProduct: false,
    priorSuccess: null,
    create: "BLOCKED_UNKNOWN",
    recreate: "ALLOW",
  },
  {
    state: "최초 등록(연결도 이력도 없음)",
    hasChannelProduct: false,
    priorSuccess: false,
    create: "ALLOW",
    recreate: "ALLOW",
  },
];

describe("① §7 매트릭스 — CREATE", () => {
  it.each(MATRIX)("$state → $create", ({ hasChannelProduct, priorSuccess, create }) => {
    expect(resolveCreateGate({ hasChannelProduct, priorSuccess, plannedOperation: "CREATE" })).toBe(create);
  });

  it("🔴 만들어도 되는 경우는 «하나뿐» 이다 — 연결도 이력도 없을 때", () => {
    const allowed = MATRIX.filter(
      (row) =>
        resolveCreateGate({
          hasChannelProduct: row.hasChannelProduct,
          priorSuccess: row.priorSuccess,
          plannedOperation: "CREATE",
        }) === "ALLOW",
    );
    expect(allowed).toHaveLength(1);
    expect(allowed[0]!.state).toContain("최초 등록");
  });
});

describe("② §7 매트릭스 — RECREATE 는 지나간다", () => {
  it.each(MATRIX)("$state → $recreate", ({ hasChannelProduct, priorSuccess, recreate }) => {
    /* 「이미 있다」를 알고도 셀러가 새로 만들기로 정한 경우다. 여기서 막으면
       카테고리를 바꿀 방법이 영영 없어진다 — 쿠팡은 그 길밖에 없다. */
    expect(resolveCreateGate({ hasChannelProduct, priorSuccess, plannedOperation: "RECREATE" })).toBe(recreate);
  });
});

describe("③ 🔴 모르면 막는다 — fail-closed", () => {
  it("null 을 false 처럼 다루지 않는다", () => {
    const unknown = resolveCreateGate({ hasChannelProduct: false, priorSuccess: null, plannedOperation: "CREATE" });
    const none = resolveCreateGate({ hasChannelProduct: false, priorSuccess: false, plannedOperation: "CREATE" });
    expect(unknown).not.toBe(none);
    expect(unknown).toBe("BLOCKED_UNKNOWN");
  });

  it("🔴 막힌 이유마다 말이 다르다 — 셀러가 할 수 있는 일이 다르기 때문", () => {
    const messages = new Set(
      (["BLOCKED_LINKED", "BLOCKED_PRIOR_SUCCESS", "BLOCKED_UNKNOWN"] as const).map((v) =>
        createGateMessage(v, "스마트스토어", "13713593585"),
      ),
    );
    expect(messages.size).toBe(3);
  });

  it("허용일 때는 문구가 없다 — 「막지 않았다」를 말로 만들지 않는다", () => {
    expect(createGateMessage("ALLOW", "쿠팡")).toBe("");
  });

  it("🔴 연결 번호를 모르면 «지어내지» 않는다", () => {
    expect(createGateMessage("BLOCKED_LINKED", "쿠팡", null)).toContain("번호 확인 불가");
    expect(createGateMessage("BLOCKED_LINKED", "쿠팡", null)).not.toContain("null");
    expect(createGateMessage("BLOCKED_LINKED", "쿠팡", undefined)).not.toContain("undefined");
  });
});

describe("④ 🔴 세 채널이 «같은» 함수를 쓴다 — 복제하지 않았다", () => {
  const routes: Record<string, string> = {
    smartstore: readFileSync(join(__dirname, "../../../api/smartstore/register/route.ts"), "utf8"),
    coupang: readFileSync(join(__dirname, "../../../api/coupang/register/route.ts"), "utf8"),
    lotteon: readFileSync(join(__dirname, "../../../api/lotteon/register/route.ts"), "utf8"),
  };

  it.each(Object.keys(routes))("%s 가 resolveCreateGate 를 부른다", (name) => {
    expect(routes[name]!).toContain("resolveCreateGate({");
  });

  it("🔴 라우트가 자기 판단을 «따로» 쓰지 않는다", () => {
    /* 예전 복제판의 흔적(priorSuccess 를 직접 비교하는 분기)이 남아 있으면
       판단이 두 벌이 된다. */
    for (const [name, src] of Object.entries(routes)) {
      expect(src, `${name} 에 옛 복제 분기가 남아 있다`).not.toContain("priorSuccess !== false");
      expect(src, `${name} 에 옛 복제 분기가 남아 있다`).not.toContain("priorSuccess === null");
    }
  });

  it("🔴 채널 이름을 «자기 것» 으로 넘긴다 — 복붙 사고 방지", () => {
    expect(routes.smartstore!).toContain('hasPriorSuccessfulAttempt(snapshotId, "smartstore")');
    expect(routes.coupang!).toContain('hasPriorSuccessfulAttempt(snapshotId, "coupang")');
    expect(routes.lotteon!).toContain("hasPriorSuccessfulAttempt(snapshotId, LOTTEON_PLATFORM_KEY)");
  });

  it("세 채널 전부가 COMMERCE_ORDER 에 있다 — 빠진 채널이 없다", () => {
    for (const id of Object.keys(routes) as CommerceId[]) {
      expect(COMMERCE_ORDER).toContain(id);
    }
    expect(COMMERCE_ORDER).toHaveLength(3);
  });
});
