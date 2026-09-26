import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 Phase E-1 — **「설정이 없다」와 「설정을 못 읽었다」는 다른 말이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 그동안 `loadLotteOnSellerSettings()` 는 세 경우를 «한 값» 으로 돌려줬다:
 *
 *     저장소 연결 없음 · 조회 실패 · 값 없음   →   전부 EMPTY
 *
 * 그리고 라우트는 무엇이 오든 `ok: true` 였다. 그래서 화면은 장애를
 * 「설정 없음」이라고 말했고, 셀러는 설정을 고치러 가지만 «고칠 것이 없다» —
 * 값은 이미 들어 있기 때문이다.
 *
 * 🔴 새 패턴을 만들지 않았다. `lib/seller-settings.ts` 의 `ResolvedSellerSettings`
 * (PIVOT-03 R6-FS)와 «같은 모양» 이다.
 *
 * 🔴 «값» 은 한 글자도 달라지지 않는다 — 실패해도 빈 값을 돌려주므로 등록 경로의
 * 사다리는 그대로고, 빈 값은 검증기가 평소대로 SELLER_PLACE_REQUIRED 로 잡는다.
 */

const maybeSingle = vi.fn();
const getSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

/** `from().select().eq().maybeSingle()` 만 흉내 내는 최소 스텁. */
function supabaseStub() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  };
}

const ROW_ALL_NULL = {
  outbound_place_no: null,
  outbound_place_label: null,
  return_place_no: null,
  return_place_label: null,
  delivery_cost_policy_no: null,
  delivery_cost_policy_label: null,
  delivery_region_group_code: null,
  delivery_region_group_label: null,
  weekday_close_time: null,
  saturday_close_time: null,
};

async function load() {
  const mod = await import("../_lib/seller-settings");
  return mod.loadLotteOnSellerSettings();
}

beforeEach(() => {
  vi.resetModules();
  maybeSingle.mockReset();
  getSupabaseAdmin.mockReset();
  getSupabaseAdmin.mockReturnValue(supabaseStub());
});

describe("세 갈래를 가른다", () => {
  it("저장소에 연결하지 못하면 ERROR — 「설정 없음」이 아니다", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const result = await load();
    expect(result.source).toBe("ERROR");
    expect(result.failed).toBe(true);
  });

  it("조회가 실패하면 ERROR", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await load();
    expect(result.source).toBe("ERROR");
    expect(result.failed).toBe(true);
  });

  it("행이 없으면 NONE — 조회는 «성공했고» 값이 실제로 없는 것이다", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await load();
    expect(result.source).toBe("NONE");
    expect(result.failed).toBe(false);
  });

  it("행은 있는데 열 개가 전부 비었으면 NONE", async () => {
    maybeSingle.mockResolvedValue({ data: ROW_ALL_NULL, error: null });
    const result = await load();
    expect(result.source).toBe("NONE");
    expect(result.failed).toBe(false);
  });

  it("값이 하나라도 있으면 SELLER_SETTINGS", async () => {
    maybeSingle.mockResolvedValue({ data: { ...ROW_ALL_NULL, outbound_place_no: "115" }, error: null });
    const result = await load();
    expect(result.source).toBe("SELLER_SETTINGS");
    expect(result.failed).toBe(false);
    expect(result.outboundPlaceNo).toBe("115");
  });
});

describe("🔴 값은 달라지지 않는다 — 등록 경로 회귀 방지", () => {
  it("실패해도 빈 값을 돌려준다(호출부를 throw 로 막지 않는다)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await load();
    expect(result.outboundPlaceNo).toBeNull();
    expect(result.returnPlaceNo).toBeNull();
    expect(result.deliveryCostPolicyNo).toBeNull();
    expect(result.deliveryRegionGroupCode).toBeNull();
  });

  it("값이 있으면 예전처럼 그대로 실어 준다", async () => {
    maybeSingle.mockResolvedValue({
      data: { ...ROW_ALL_NULL, outbound_place_no: "115", return_place_no: "116", weekday_close_time: "1400" },
      error: null,
    });
    const result = await load();
    expect(result.outboundPlaceNo).toBe("115");
    expect(result.returnPlaceNo).toBe("116");
    expect(result.weekdayCloseTime).toBe("1400");
  });
});

describe("계약 — 판정은 loader 한 곳에서만 한다", () => {
  it("라우트가 failed/source 를 그대로 실어 보낸다", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "settings", "lotteon-seller", "route.ts"),
      "utf8",
    );
    expect(source).toContain("ok: true, values, source, failed");
    /* 🔴 라우트가 스스로 판정하지 않는다 — loader 결과를 펼쳐 옮기기만 한다. */
    expect(source).toContain("const { source, failed, ...values } = await loadLotteOnSellerSettings()");
  });

  it("화면이 failed 를 받아 「불러오지 못했습니다」를 말한다", () => {
    const panel = readFileSync(
      join(__dirname, "..", "..", "..", "pipeline", "commerce", "LotteOnRegistrationPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("setSellerFixedFailed");
    expect(panel).toContain("판매자 설정을 불러오지 못했습니다");
    /* 🔴 「설정 없음」으로 읽히지 않게 그 말을 명시적으로 부정한다. */
    expect(panel).toContain("설정이 비어 있는 것이 아니라");
  });

  it("🔴 4279402 를 어디에도 박지 않았다", () => {
    for (const path of [
      join(__dirname, "..", "_lib", "seller-settings.ts"),
      join(__dirname, "..", "..", "settings", "lotteon-seller", "route.ts"),
      join(__dirname, "..", "..", "..", "pipeline", "commerce", "LotteOnRegistrationPanel.tsx"),
    ]) {
      expect(readFileSync(path, "utf8")).not.toContain("4279402");
    }
  });
});

describe("E-5 — 저장된 표시이름을 «현재 이름» 으로 말하지 않는다", () => {
  it("조회된 이름이 있으면 그쪽을 쓰고, 없으면 「저장 당시 이름」이라고 적는다", () => {
    const panel = readFileSync(
      join(__dirname, "..", "..", "..", "pipeline", "commerce", "LotteOnRegistrationPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("function liveNameOf(");
    expect(panel).toContain("const shownName = liveName || label;");
    expect(panel).toContain("(저장 당시 이름)");
  });

  it("네 칸 모두 조회 결과와 대조한다", () => {
    const panel = readFileSync(
      join(__dirname, "..", "..", "..", "pipeline", "commerce", "LotteOnRegistrationPanel.tsx"),
      "utf8",
    );
    expect(panel.match(/liveName=\{liveNameOf\(/g) ?? []).toHaveLength(4);
  });
});
