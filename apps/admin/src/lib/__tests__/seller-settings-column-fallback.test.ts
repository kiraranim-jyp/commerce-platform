import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-NOTICE-FIELD-IMPLEMENT-0090-01 — **컬럼이 생기기 «전» 에도 안 깨진다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `as_company_name` 은 migration 068 이 만드는데, 그 SQL 은 **CEO 가 Supabase 에서
 * 실행한다**(저장소 규약). 즉 코드 배포와 컬럼 생성의 «순서를 우리가 정할 수 없다».
 *
 * 그 사이에 새 컬럼을 SELECT 하다 실패하면 판매자 설정 «전체» 를 못 읽고,
 * 그러면 지금 유일하게 LIVE 등록에 성공하는 쿠팡 경로까지 막힌다.
 *
 * ── 🔴 그래서 지키는 것 셋 ────────────────────────────────────────────────
 *   ① 컬럼이 있으면 그 값을 읽는다.
 *   ② 컬럼이 «없으면»(42703) 구 목록으로 다시 읽어 «기존 다섯 칸은 살린다».
 *   ③ 🔴 다른 오류는 «그대로 ERROR» 다 — 장애를 「설정 없음」으로 위장하지 않는다.
 *      ③이 이 파일의 핵심이다. ②만 있으면 넓은 삼킴이 되어, 이 저장소가 R6-FS 에서
 *      없앤 바로 그 병이 다시 생긴다.
 */

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

const hoisted = vi.hoisted(() => ({
  /** 호출된 select 목록 — 「두 번 읽었는가」를 말이 아니라 «횟수» 로 센다. */
  selects: [] as string[],
  answer: (() => ({ data: null, error: null })) as (columns: string) => QueryResult,
}));

vi.mock("../supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: (columns: string) => {
        hoisted.selects.push(columns);
        const result = hoisted.answer(columns);
        const leaf = {
          eq: () => leaf,
          is: () => leaf,
          maybeSingle: async () => result,
        };
        return leaf;
      },
    }),
  }),
}));

const { loadSellerSettings } = await import("../seller-settings");

const ROW_WITHOUT_NEW = {
  manufacturer: "따조",
  as_contact_number: "+821046458306",
  quality_guarantee: "보증",
  kc_exemption_text: null,
  default_country_of_origin: "KR",
};

beforeEach(() => {
  hoisted.selects = [];
  vi.restoreAllMocks();
});

describe("① 컬럼이 «있을 때»", () => {
  it("as_company_name 을 그대로 읽는다", async () => {
    hoisted.answer = () => ({
      data: { ...ROW_WITHOUT_NEW, as_company_name: "따조 고객센터" },
      error: null,
    });
    const settings = await loadSellerSettings(null);
    expect(settings.failed).toBe(false);
    expect(settings.asCompanyName).toBe("따조 고객센터");
    expect(settings.asContactNumber).toBe("+821046458306");
    /* 🔴 한 번만 읽는다 — 정상 경로에서 두 번 왕복하면 그것도 결함이다. */
    expect(hoisted.selects).toHaveLength(1);
    expect(hoisted.selects[0]).toContain("as_company_name");
  });
});

describe("② 컬럼이 «아직 없을 때»(migration 068 전)", () => {
  it("🔴 42703 이면 구 목록으로 다시 읽고, 기존 칸은 살아 있다", async () => {
    hoisted.answer = (columns) =>
      columns.includes("as_company_name")
        ? { data: null, error: { code: "42703", message: 'column "as_company_name" does not exist' } }
        : { data: ROW_WITHOUT_NEW, error: null };

    const settings = await loadSellerSettings(null);

    /* 🔴 실패로 끝나지 «않는다». 여기서 failed:true 가 되면 쿠팡 등록이 막힌다. */
    expect(settings.failed).toBe(false);
    expect(settings.source).toBe("SELLER_SETTINGS");
    expect(settings.manufacturer).toBe("따조");
    expect(settings.asContactNumber).toBe("+821046458306");
    /* 새 칸은 «없는 채로» 온다 — 지어내지 않는다. */
    expect(settings.asCompanyName).toBeNull();

    /* 말이 아니라 횟수로: 두 번 읽었고, 두 번째는 새 컬럼이 «빠진» 목록이다. */
    expect(hoisted.selects).toHaveLength(2);
    expect(hoisted.selects[0]).toContain("as_company_name");
    expect(hoisted.selects[1]).not.toContain("as_company_name");
    expect(hoisted.selects[1]).toContain("as_contact_number");
  });
});

describe("③ 🔴 다른 오류는 «삼키지 않는다»", () => {
  it.each([
    ["08006", "connection failure"],
    ["42501", "permission denied for table seller_settings"],
    [undefined, "네트워크가 끊겼습니다"],
  ])("code=%s 는 그대로 ERROR 다 — 구 목록으로 되돌리지 않는다", async (code, message) => {
    hoisted.answer = () => ({ data: null, error: { code: code as string | undefined, message } });

    const settings = await loadSellerSettings(null);

    /* 🔴 「읽지 못했다」는 사실이 그대로 남아야 한다. 이것이 없으면 DB 장애가
       「판매자가 아직 설정 안 함」으로 둔갑하고, 제조사가 빈 채로 실제 상품이 올라간다. */
    expect(settings.failed).toBe(true);
    expect(settings.source).toBe("ERROR");
    /* 🔴 그리고 재조회를 «하지 않는다» — 한 번만 읽었다. */
    expect(hoisted.selects).toHaveLength(1);
  });
});
