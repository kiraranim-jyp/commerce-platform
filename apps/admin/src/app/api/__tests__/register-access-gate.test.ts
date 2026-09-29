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
  /** registration_attempts 에 실제로 «들어간 행». 무엇이 기록되는지 재려면 필요하다. */
  rows: [] as Record<string, unknown>[],
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
      insert: async (row: Record<string, unknown>) => {
        hoisted.calls.push(`insert:${table}`);
        hoisted.rows.push(row);
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
  hoisted.rows = [];
  hoisted.snapshotWorkspaceId = undefined;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS;
  else process.env.COMMERCE_REGISTRATION_WORKSPACE_IDS = savedEnv;
});

/* ══ REGISTRATION-INCIDENT-01(2026-09-29) — 이 가드가 지키는 것을 «좁힌다» ══════
   원래 단언은 `hoisted.calls` 가 통째로 비어 있을 것이었다. 그런데 이 가드의
   뜻은 제목이 말하는 그대로 **「자격증명에 닿지 않는다」** 이지 「DB 를 한 번도
   만지지 않는다」가 아니다.

   거절이 «등록이력에 남지 않는» 것이 이번 P0 장애의 본체였다(스마트스토어·
   쿠팡이 동시에 403 인데 이력이 완전히 비어 있었다). 그래서 감사 기록 한 줄은
   허용하고, 자격증명·프로필 조회는 여전히 0건이어야 한다.

   🔴 약화가 아니다. 아래에서 「감사 기록은 «남는다»」를 따로 단언한다. */
const AUDIT_CALL = "insert:registration_attempts";
const credentialCalls = () => hoisted.calls.filter((call) => call !== AUDIT_CALL);

describe("미인증 → 401, 그리고 자격증명에 닿지 않는다", () => {
  beforeEach(() => {
    hoisted.authOk = false;
  });

  for (const channel of CHANNELS) {
    it(`${channel.name}: 401`, async () => {
      const { POST } = await channel.load();
      const res = await POST(post(`http://localhost/api/${channel.name}/register`, channel.body));
      expect(res.status).toBe(401);
      expect(credentialCalls(), "미인증인데 자격증명을 조회했다").toEqual([]);
      /* 🔴 미인증은 «기록도» 하지 않는다 — 로그인 없는 DB 쓰기 경로를 만들지 않는다. */
      expect(hoisted.calls, "미인증 요청이 이력에 행을 넣었다").toEqual([]);
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
      expect(credentialCalls(), "다른 워크스페이스인데 전역 자격증명을 조회했다").toEqual([]);
      /* 🔴 COMMERCE-LIFECYCLE-FINAL-03 — 허용 목록이 어긋났을 때 복구에 필요한
         값은 «호출자 자신의» workspaceId 하나다. 런타임 로그에만 두면 로그가
         회전하면서 사라진다(실측). 그래서 이력에도 남는다. */
      const denial = hoisted.rows.find((row) => String(row.error_code ?? "").includes("WORKSPACE_NOT_ALLOWED"));
      expect(denial, "거절 행을 찾지 못했다").toBeDefined();
      expect((denial!.response as { deniedWorkspaceId?: string } | undefined)?.deniedWorkspaceId).toBe(OTHER_WS);
      /* 🔴 자격증명은 «절대» 실리지 않는다. */
      expect(JSON.stringify(denial)).not.toMatch(/token|secret|key/i);
      /* 🔴 그리고 «거절은 보인다» — 이력에 남지 않던 것이 이번 장애의 본체다. */
      expect(hoisted.calls, "거절이 등록이력에 남지 않았다").toContain(AUDIT_CALL);
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
      expect(credentialCalls()).toEqual([]);
      expect(hoisted.calls, "거절이 등록이력에 남지 않았다").toContain(AUDIT_CALL);
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
    expect(credentialCalls()).toEqual([]);
    expect(hoisted.calls, "거절이 등록이력에 남지 않았다").toContain(AUDIT_CALL);
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
