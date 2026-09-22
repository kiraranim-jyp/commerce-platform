import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 R6-FS — 「읽지 못했다」를 「값이 없다」로 위장하지 않는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ───────────────────────────────────────────────────────
 * loadFromSellerSettings() 가 «두 가지» 를 똑같이 null 로 돌려줬다.
 *
 *     seller_settings 행이 없다        → null
 *     seller_settings 조회가 실패했다   → null   🔴
 *
 * 그래서 DB 장애가 「아직 설정 안 했네」로 둔갑했고, 임시 호환층이 받아서
 * 레거시 프로필의 «옛 값» 을 등록 payload 로 흘려보냈다. 경고 로그 한 줄만
 * 남고 셀러는 모른다. 지금 레거시에는 12:52 에 얼어붙은 제조사가 남아 있다 —
 * 우연히 같을 뿐이고, 값이 갈라지는 순간 조용히 틀린 상품이 올라간다.
 *
 * ── 🔴 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 딱 하나다. **ERROR 는 절대 NOT_FOUND 로 변환되지 않는다.**
 *
 * 그리고 그 반대도 지킨다 — 「값이 비었다」는 여전히 등록을 막지 «않는다».
 * 그건 채널별 completeness 정책이고 다른 문제다. 이번 변경이 그것까지
 * 막아 버리면 멀쩡한 상품이 등록되지 않는다.
 */

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

const { loadSellerSettings } = await import("../seller-settings");

const FIVE = {
  manufacturer: "규하맘샵",
  as_contact_number: "해외 구매대행으로 A/S 불가",
  quality_guarantee: "품질보증 문구",
  kc_exemption_text: "KC 문구",
  default_country_of_origin: "상세설명 참조",
};
const EMPTY_ROW = {
  manufacturer: null,
  as_contact_number: null,
  quality_guarantee: null,
  kc_exemption_text: null,
  default_country_of_origin: null,
};

/** 두 표의 응답을 각각 정해 주고, 실제로 «어느 표를 읽었는지» 를 기록한다. */
function stub(plan: {
  canonical: { data?: unknown; error?: { message: string } } | (() => never);
  legacy?: { data?: unknown; error?: { message: string } };
}) {
  const touched: string[] = [];
  mocks.getSupabaseAdmin.mockReturnValue({
    from(table: string) {
      touched.push(table);
      const result = table === "seller_settings" ? plan.canonical : (plan.legacy ?? { data: null });
      const chain = {
        select: () => chain,
        is: () => chain,
        eq: () => chain,
        maybeSingle: () => {
          if (typeof result === "function") result();
          return Promise.resolve({ data: null, error: null, ...(result as object) });
        },
      };
      return chain;
    },
  });
  return touched;
}

beforeEach(() => mocks.getSupabaseAdmin.mockReset());

describe("Test 1 — FOUND", () => {
  it("canonical 을 쓰고 레거시는 «쳐다보지도» 않는다", async () => {
    const touched = stub({ canonical: { data: FIVE }, legacy: { data: { ...FIVE, manufacturer: "옛제조사" } } });
    const r = await loadSellerSettings();
    expect(r.manufacturer).toBe("규하맘샵");
    expect(r.source).toBe("SELLER_SETTINGS");
    expect(r.failed).toBe(false);
    expect(touched).toEqual(["seller_settings"]);
  });
});

describe("Test 2 — NOT_FOUND (행 없음)", () => {
  it("호환층이 받는다 — 기존 동작 그대로", async () => {
    const touched = stub({ canonical: { data: null }, legacy: { data: FIVE } });
    const r = await loadSellerSettings();
    expect(r.manufacturer).toBe("규하맘샵");
    expect(r.source).toBe("LEGACY_PROFILE");
    expect(r.failed).toBe(false);
    expect(touched).toEqual(["seller_settings", "coupang_seller_profiles"]);
  });

  it("레거시도 비었으면 NONE — «ERROR 가 아니다»", async () => {
    stub({ canonical: { data: null }, legacy: { data: null } });
    const r = await loadSellerSettings();
    expect(r.source).toBe("NONE");
    expect(r.failed).toBe(false);
  });
});

describe("Test 3 — DB ERROR", () => {
  it("🔴 레거시 조회를 «아예 하지 않는다»", async () => {
    const touched = stub({ canonical: { error: { message: "connection reset" } }, legacy: { data: FIVE } });
    const r = await loadSellerSettings();
    expect(touched).toEqual(["seller_settings"]);
    expect(r.source).toBe("ERROR");
    expect(r.failed).toBe(true);
  });

  it("값은 전부 null 이다 — 「모른다」이지 「비었다」가 아니다", async () => {
    stub({ canonical: { error: { message: "timeout" } } });
    const r = await loadSellerSettings();
    expect(r.manufacturer).toBeNull();
    expect(r.qualityGuarantee).toBeNull();
  });
});

describe("Test 4 — 🔴 ERROR + 레거시에 값이 있다 (가장 중요)", () => {
  it("레거시 「규하맘샵」이 «절대» 반환되지 않는다", async () => {
    /* 이것이 이 작업의 전부다. 예전에는 여기서 옛 제조사가 그대로 나가
       실제 상품에 붙었다. */
    stub({ canonical: { error: { message: "permission denied" } }, legacy: { data: FIVE } });
    const r = await loadSellerSettings();
    expect(r.manufacturer).not.toBe("규하맘샵");
    expect(r.manufacturer).toBeNull();
    expect(r.source).not.toBe("LEGACY_PROFILE");
    expect(r.failed).toBe(true);
  });
});

describe("Test 5 — 둘 다 정상이면 canonical 만", () => {
  it("레거시를 읽지 않는다", async () => {
    const touched = stub({ canonical: { data: FIVE }, legacy: { data: FIVE } });
    await loadSellerSettings();
    expect(touched).not.toContain("coupang_seller_profiles");
  });
});

describe("Test 6 — 행은 있는데 다섯 칸이 다 비었다", () => {
  it("기존 정책대로 호환층으로 내려간다 — completeness 정책을 새로 만들지 않는다", async () => {
    const touched = stub({ canonical: { data: EMPTY_ROW }, legacy: { data: FIVE } });
    const r = await loadSellerSettings();
    expect(r.source).toBe("LEGACY_PROFILE");
    expect(r.failed).toBe(false);
    expect(touched).toEqual(["seller_settings", "coupang_seller_profiles"]);
  });
});

describe("추가 상태 — 조사에서 찾은 것들", () => {
  it("🔴 예기치 못한 throw 도 ERROR 다 — 조용히 폴백하지 않는다", async () => {
    stub({
      canonical: () => {
        throw new Error("fetch failed");
      },
      legacy: { data: FIVE },
    });
    const r = await loadSellerSettings();
    expect(r.failed).toBe(true);
    expect(r.manufacturer).toBeNull();
  });

  it("🔴 env 미설정은 ERROR 가 «아니다» — 등록 화면을 통째로 막지 않는다", async () => {
    // 로컬 개발 등에서 클라이언트가 없는 상태다. 그때는 레거시도 똑같이 못
    // 읽으므로 「값이 없다」가 사실이다.
    mocks.getSupabaseAdmin.mockReturnValue(null);
    const r = await loadSellerSettings();
    expect(r.source).toBe("NONE");
    expect(r.failed).toBe(false);
  });

  it("레거시 조회가 실패해도 ERROR 로 올리지 않는다 — canonical 은 정상으로 「없다」고 답했다", async () => {
    stub({ canonical: { data: null }, legacy: { error: { message: "legacy down" } } });
    const r = await loadSellerSettings();
    expect(r.source).toBe("NONE");
    expect(r.failed).toBe(false);
  });
});

describe("소비자 — ERROR 가 등록을 막는다", () => {
  const read = (p: string) => readFileSync(join(__dirname, "../..", p), "utf8");

  it("쿠팡 등록이 payload 를 만들기 «전» 에 멈춘다", () => {
    const src = read("app/api/coupang/register/route.ts");
    expect(src).toContain("if (sellerSettings.failed)");
    expect(src).toContain('code: "CP009"');
    // 🔴 멈추는 위치가 조립보다 앞이어야 한다. 뒤면 빈 값 payload 가 기록에 남는다.
    expect(src.indexOf("if (sellerSettings.failed)")).toBeLessThan(src.indexOf("buildCoupangPayload("));
  });

  it("SmartStore 가 «인증 실패» 로 오해하지 않는다", () => {
    const resolve = read("app/api/naver/_lib/resolve-context.ts");
    const route = read("app/api/smartstore/register/route.ts");
    expect(resolve).toContain('return { status: "SELLER_SETTINGS_UNAVAILABLE"');
    // 전용 분기가 일반 분기보다 앞에 있어야 step: AUTHENTICATION 으로 안 샌다.
    expect(route.indexOf('context.status === "SELLER_SETTINGS_UNAVAILABLE"')).toBeLessThan(
      route.indexOf('context.status !== "OK"'),
    );
  });

  it("LotteON 이 «값 부족» 으로 말하지 않는다", () => {
    const ctx = read("app/api/lotteon/_lib/build-context.ts");
    const route = read("app/api/lotteon/register/route.ts");
    expect(ctx).toContain("sellerSettingsError");
    // 검증(「부족합니다」)보다 앞에서 멈춘다 — 셀러가 고칠 것이 없는 안내를 받지 않게.
    expect(route.indexOf("if (context.sellerSettingsError)")).toBeLessThan(
      route.indexOf("validateLotteOnPayload("),
    );
  });

  it("설정 체크리스트가 「미입력」이라고 말하지 않는다", () => {
    expect(read("app/api/coupang/_lib/settings-status.ts")).toContain("if (!sellerSettings.failed)");
  });

  it("QA 배치가 30건을 빈 값으로 돌리지 않는다", () => {
    expect(read("app/api/admin/registration-qa-batch/route.ts")).toContain("if (sellerSettings.failed)");
  });

  it("🔴 GET 이 200 + 빈 값으로 답하지 않는다 — 설정 화면이 칸을 비우면 저장으로 «지워진다»", () => {
    const route = read("app/api/settings/seller-settings/route.ts");
    expect(route).toContain("status: 503");
    // 화면도 그 응답을 무시하고 칸을 덮지 않아야 한다.
    expect(read("app/settings/page.tsx")).toContain("if (!data.ok) return;");
  });
});
