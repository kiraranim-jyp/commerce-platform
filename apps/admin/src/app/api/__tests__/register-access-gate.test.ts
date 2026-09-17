import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P0-C PRE-REGISTER SECURITY GATE(CEO 승인, 2026-09-17).
 *
 * 🔴 여기서 재는 것은 "라우트에 requireRegistrationAccess 라는 글자가 있는가"가
 *    아니다. **인증/권한이 실패했을 때 자격증명 조회가 한 번도 안 일어나는가**다.
 *    글자만 보면 게이트를 부르고 결과를 버리는 코드도 통과한다. 그리고 자격증명
 *    조회가 일어났다는 것은 곧 "그 다음이 외부 플랫폼 호출"이라는 뜻이다.
 *
 * CEO QA 4항목을 그대로 옮겼다:
 *   미인증 → 401 · 다른 workspace → 403 · 본인 workspace → 기존 로직 진입 ·
 *   기존 payload 생성 로직 변경 없음
 */

const OWNER_WS = "ws-owner";
const OTHER_WS = "ws-other";

const hoisted = vi.hoisted(() => ({
  authOk: true,
  workspaceId: "ws-owner",
  /** 자격증명 조회가 일어났는지 — 게이트를 통과했다는 유일한 관측 가능한 증거. */
  calls: [] as string[],
  /** product_snapshots.workspace_id 로 돌려줄 값. undefined면 행이 없는 것. */
  snapshotWorkspaceId: undefined as string | null | undefined,
}));

vi.mock("@/lib/auth/require-user", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireUser: async () =>
      hoisted.authOk
        ? { ok: true, user: { userId: "u1", email: "a@b.c", workspaceId: hoisted.workspaceId, impersonated: false } }
        : {
            ok: false,
            response: NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 }),
          },
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "product_snapshots"
              ? {
                  data:
                    hoisted.snapshotWorkspaceId === undefined
                      ? null
                      : { workspace_id: hoisted.snapshotWorkspaceId },
                  error: null,
                }
              : { data: null, error: null },
        }),
      }),
      // registration_attempts 기록용 — 게이트가 막으면 여기까지 오지 않는다.
      insert: async () => {
        hoisted.calls.push(`insert:${table}`);
        return { error: null };
      },
    }),
  }),
}));

/** 세 채널의 자격증명 조회. 게이트 바로 다음 줄이고, 여기가 불렸다면 게이트가
 *  열렸다는 뜻이다. null을 돌려주므로 라우트는 그 자리에서 "인증정보 없음"으로
 *  끝난다 — 어떤 경우에도 외부 플랫폼 호출로 넘어가지 않는다. */
vi.mock("../coupang/_lib/env", () => ({
  getCoupangCredentials: async () => {
    hoisted.calls.push("coupang:credentials");
    return null;
  },
  getVendorUserId: async () => null,
}));
vi.mock("../naver/_lib/env", () => ({
  getNaverCredentials: async () => {
    hoisted.calls.push("naver:credentials");
    return null;
  },
}));
vi.mock("../lotteon/_lib/env", () => ({
  getLotteOnCredentials: async () => {
    hoisted.calls.push("lotteon:credentials");
    return null;
  },
}));

const product = { brand: { value: "BRAND" }, title: { value: "T" } };
const listing = { priceKrw: 10000 };

const post = (url: string, body: unknown) =>
  new Request(url, { method: "POST", body: JSON.stringify(body) });

const CHANNELS = [
  {
    name: "coupang",
    load: () => import("../coupang/register/route"),
    body: { product, listing },
    credentialCall: "coupang:credentials",
  },
  {
    name: "smartstore",
    load: () => import("../smartstore/register/route"),
    body: { product, listing },
    credentialCall: "naver:credentials",
  },
  {
    name: "lotteon",
    load: () => import("../lotteon/register/route"),
    body: { product },
    credentialCall: "lotteon:credentials",
  },
] as const;

let savedEnv: string | undefined;

/** 세 register 라우트는 @commerce/listing 등을 통째로 끌고 와서 첫 import가
 *  혼자 4초를 넘긴다. 그 비용이 첫 테스트의 5초 한계에 걸려 전체 스위트로 돌릴
 *  때만 실패했다 — 테스트가 틀린 게 아니라 로드 비용이라, 여기서 미리 데운다. */
beforeAll(async () => {
  await Promise.all(CHANNELS.map((channel) => channel.load()));
}, 120_000);

beforeEach(() => {
  savedEnv = process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS;
  process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS = OWNER_WS;
  hoisted.authOk = true;
  hoisted.workspaceId = OWNER_WS;
  hoisted.calls = [];
  hoisted.snapshotWorkspaceId = undefined;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS;
  else process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS = savedEnv;
});

describe("미인증 → 401, 그리고 자격증명에 닿지 않는다", () => {
  beforeEach(() => {
    hoisted.authOk = false;
  });

  for (const channel of CHANNELS) {
    it(`${channel.name}: 401`, async () => {
      const { POST } = await channel.load();
      const res = await POST(post(`http://localhost/api/${channel.name}/register`, channel.body));
      expect(res.status).toBe(401);
      expect(hoisted.calls, "미인증인데 자격증명을 조회했다").toEqual([]);
    });
  }
});

describe("다른 workspace → 403, 그리고 자격증명에 닿지 않는다", () => {
  beforeEach(() => {
    hoisted.workspaceId = OTHER_WS;
  });

  for (const channel of CHANNELS) {
    it(`${channel.name}: 403`, async () => {
      const { POST } = await channel.load();
      const res = await POST(post(`http://localhost/api/${channel.name}/register`, channel.body));
      expect(res.status).toBe(403);
      expect(hoisted.calls, "다른 워크스페이스인데 전역 자격증명을 조회했다").toEqual([]);
    });
  }
});

describe("🔴 허용 워크스페이스가 설정되지 않으면 fail-closed(403)", () => {
  beforeEach(() => {
    delete process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS;
  });

  for (const channel of CHANNELS) {
    it(`${channel.name}: 403 — "설정이 없으니 열어둔다"가 되지 않는다`, async () => {
      const { POST } = await channel.load();
      const res = await POST(post(`http://localhost/api/${channel.name}/register`, channel.body));
      expect(res.status).toBe(403);
      expect(hoisted.calls).toEqual([]);
    });
  }

  it("응답은 설정해야 할 환경변수 이름과 호출자 자신의 workspaceId를 알려준다", async () => {
    const { POST } = await CHANNELS[0].load();
    const res = await POST(post("http://localhost/api/coupang/register", CHANNELS[0].body));
    const json = (await res.json()) as { requiredEnv?: string; workspaceId?: string };
    expect(json.requiredEnv).toBe("COMMERCE_REGISTRATION_WORKSPACE_IDS");
    expect(json.workspaceId).toBe(OWNER_WS);
  });
});

describe("본인 workspace → 기존 등록 로직에 진입한다", () => {
  for (const channel of CHANNELS) {
    it(`${channel.name}: 게이트를 통과해 자격증명 조회까지 간다`, async () => {
      const { POST } = await channel.load();
      const res = await POST(post(`http://localhost/api/${channel.name}/register`, channel.body));
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(hoisted.calls, "본인 워크스페이스인데 게이트가 막았다").toContain(channel.credentialCall);
    });
  }
});

describe("스냅샷 소유권", () => {
  it("남의 스냅샷으로 등록하면 403이고 자격증명에 닿지 않는다", async () => {
    hoisted.snapshotWorkspaceId = OTHER_WS;
    const { POST } = await CHANNELS[0].load();
    const res = await POST(
      post("http://localhost/api/coupang/register", { ...CHANNELS[0].body, snapshotId: "snap-1" }),
    );
    expect(res.status).toBe(403);
    expect(hoisted.calls).toEqual([]);
  });

  it("내 스냅샷이면 통과한다", async () => {
    hoisted.snapshotWorkspaceId = OWNER_WS;
    const { POST } = await CHANNELS[0].load();
    const res = await POST(
      post("http://localhost/api/coupang/register", { ...CHANNELS[0].body, snapshotId: "snap-1" }),
    );
    expect(res.status).not.toBe(403);
    expect(hoisted.calls).toContain("coupang:credentials");
  });

  it("🔴 workspace_id가 null인 옛 스냅샷은 막지 않는다 — 043 이전 행으로 기존 흐름이 끊기면 안 된다", async () => {
    hoisted.snapshotWorkspaceId = null;
    const { POST } = await CHANNELS[0].load();
    await POST(post("http://localhost/api/coupang/register", { ...CHANNELS[0].body, snapshotId: "old" }));
    expect(hoisted.calls).toContain("coupang:credentials");
  });
});

describe("기존 동작 회귀 — 게이트는 body 검증을 앞지르지 않는다", () => {
  it("본인 workspace여도 product가 없으면 기존 400이 그대로 나온다", async () => {
    const { POST } = await CHANNELS[0].load();
    const res = await POST(post("http://localhost/api/coupang/register", {}));
    expect(res.status).toBe(400);
    expect(hoisted.calls).toEqual([]);
  });
});
