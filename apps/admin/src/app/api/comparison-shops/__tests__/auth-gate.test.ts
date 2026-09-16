import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SOURCE-POLICY-01 후속(CEO 승인, 2026-09-16) — 해외 소스 CRUD 4개에 인증이 없었다.
 *
 * `/api/domestic-price-sources`(국내)는 처음부터 `requireUser()`를 지나는데
 * `/api/comparison-shops`(해외)는 **`requireUser` import 조차 없었다.** 즉 로그인하지
 * 않은 누구나 해외 조사 소스 28곳을 켜고 끄고 지울 수 있었다.
 *
 * 🔴 여기서 재는 것은 "소스에 requireUser 라는 글자가 있는가"가 아니라
 *    **인증이 실패했을 때 실제로 401이 나가고 DB 함수가 한 번도 안 불리는가**다.
 *    글자만 보면 `requireUser()`를 부르고 결과를 버리는 코드도 통과한다.
 */

const hoisted = vi.hoisted(() => ({
  authOk: true,
  calls: [] as string[],
}));

vi.mock("@/lib/auth/require-user", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireUser: async () =>
      hoisted.authOk
        ? { ok: true, user: { userId: "u1", email: "a@b.c", workspaceId: "w1" } }
        : {
            ok: false,
            response: NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 }),
          },
  };
});

vi.mock("../_lib/comparison-shop", () => ({
  listComparisonShops: async () => {
    hoisted.calls.push("list");
    return [];
  },
  createComparisonShop: async () => {
    hoisted.calls.push("create");
    return { ok: true };
  },
  setComparisonShopActive: async () => {
    hoisted.calls.push("setActive");
    return { ok: true };
  },
  updateComparisonShopCountry: async () => {
    hoisted.calls.push("updateCountry");
    return { ok: true };
  },
  deleteComparisonShop: async () => {
    hoisted.calls.push("delete");
    return { ok: true };
  },
}));

vi.mock("@commerce/crawler", () => ({
  comparisonShopCollectability: () => ({ parserAvailable: false, collectionMethod: null }),
}));

const params = Promise.resolve({ id: "s1" });
const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/comparison-shops/s1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  hoisted.authOk = true;
  hoisted.calls = [];
});

describe("비로그인 — 네 핸들러 전부 401이고 DB에 닿지 않는다", () => {
  beforeEach(() => {
    hoisted.authOk = false;
  });

  it("GET /api/comparison-shops → 401", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(hoisted.calls, "인증 실패인데 DB 함수가 불렸다").toEqual([]);
  });

  it("POST /api/comparison-shops → 401 (body가 유효해도)", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/comparison-shops", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(hoisted.calls).toEqual([]);
  });

  it("PATCH /api/comparison-shops/[id] → 401 (isActive 토글 차단)", async () => {
    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(jsonRequest({ isActive: false }), { params });
    expect(res.status).toBe(401);
    expect(hoisted.calls, "비로그인이 소스를 끌 수 있었다").toEqual([]);
  });

  it("DELETE /api/comparison-shops/[id] → 401 (삭제 차단)", async () => {
    const { DELETE } = await import("../[id]/route");
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), { params });
    expect(res.status).toBe(401);
    expect(hoisted.calls, "비로그인이 소스를 지울 수 있었다").toEqual([]);
  });
});

describe("로그인 — 기존 흐름은 그대로 동작한다 (회귀)", () => {
  it("GET 은 목록을 돌려준다", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(hoisted.calls).toContain("list");
  });

  it("POST 는 생성으로 이어진다", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/comparison-shops", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(hoisted.calls).toContain("create");
  });

  it("POST 는 url 이 없으면 400 — 인증 통과 뒤에도 기존 검증이 산다", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/comparison-shops", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
    expect(hoisted.calls).toEqual([]);
  });

  it("PATCH 는 isActive 토글로 이어진다", async () => {
    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(jsonRequest({ isActive: true }), { params });
    expect(res.status).toBe(200);
    expect(hoisted.calls).toContain("setActive");
  });

  it("PATCH 는 country/currency 경로도 그대로다", async () => {
    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(jsonRequest({ country: "JP", currency: "JPY" }), { params });
    expect(res.status).toBe(200);
    expect(hoisted.calls).toContain("updateCountry");
  });

  it("DELETE 는 삭제로 이어진다", async () => {
    const { DELETE } = await import("../[id]/route");
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), { params });
    expect(res.status).toBe(200);
    expect(hoisted.calls).toContain("delete");
  });
});
