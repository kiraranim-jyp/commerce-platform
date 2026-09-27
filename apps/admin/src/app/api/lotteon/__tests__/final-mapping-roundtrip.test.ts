import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * FINAL-3COMMERCE — **저장한 값이 «돌아오는가»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 지적: 「소스에 조건이 있으니 PASS」는 완료가 아니다. 실제로 이 스프린트
 * 에서 그 방식으로 두 번 틀렸다 —
 *
 *   ① ⑤배송 picker 숨김   조건은 있었는데 sellerFixed 가 언제나 null 이라
 *                          «한 번도 발동하지 않았다»
 *   ② 화면 타입            067 로 컬럼이 생겼는데 패널 타입이 그것을 몰라서
 *                          「설정이 채웠는가」를 판단할 수 없었다
 *
 * 둘 다 «모양» 만 봤기 때문이다. 이 파일은 실제 함수를 통과시켜서 **저장한
 * 여섯 값이 그대로 돌아오는지** 를 본다. Supabase 만 흉내 내고 나머지는
 * 프로덕션 코드 그대로다.
 */

const upsert = vi.fn();
const maybeSingle = vi.fn();
const getSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

/** 셀러가 「롯데ON 연결」에서 여섯 개를 고른 상태. */
const PICKED = {
  outboundPlaceNo: "PLO3837441",
  outboundPlaceLabel: "Hessen 물류센터",
  returnPlaceNo: "PLO3837441_R",
  returnPlaceLabel: "반품주소지",
  deliveryCostPolicyNo: "4279402",
  deliveryCostPolicyLabel: "업체배송 19800원",
  deliveryRegionGroupCode: "GN101",
  deliveryRegionGroupLabel: "전국",
  courierCode: "EP",
  courierLabel: "우체국택배",
  returnCourierCode: "EP",
  returnCourierLabel: "우체국택배",
} as const;

beforeEach(() => {
  vi.resetModules();
  upsert.mockReset();
  maybeSingle.mockReset();
  getSupabaseAdmin.mockReset();
});

describe("① 저장 — 고른 여섯 값이 «컬럼» 으로 간다", () => {
  it("PUT 이 받는 모양 그대로 저장된다", async () => {
    upsert.mockResolvedValue({ error: null });
    getSupabaseAdmin.mockReturnValue({ from: () => ({ upsert }) });

    const mod = await import("../_lib/seller-settings");
    const result = await mod.saveLotteOnSellerSettings(PICKED);
    expect(result).toEqual({ ok: true });

    const row = upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    /* 🔴 여섯 값과 그 이름이 «전부» 컬럼에 실려야 한다. 하나라도 빠지면 화면은
       고른 것처럼 보이는데 다음에 열면 비어 있다. */
    expect(row.outbound_place_no).toBe("PLO3837441");
    expect(row.return_place_no).toBe("PLO3837441_R");
    expect(row.delivery_cost_policy_no).toBe("4279402");
    expect(row.delivery_region_group_code).toBe("GN101");
    expect(row.courier_code).toBe("EP");
    expect(row.return_courier_code).toBe("EP");
    expect(row.courier_label).toBe("우체국택배");
    expect(row.return_courier_label).toBe("우체국택배");
  });
});

describe("② 재조회 — 저장한 값이 «그대로» 돌아온다", () => {
  it("여섯 값 + 이름이 전부 살아 돌아온다", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        outbound_place_no: PICKED.outboundPlaceNo,
        outbound_place_label: PICKED.outboundPlaceLabel,
        return_place_no: PICKED.returnPlaceNo,
        return_place_label: PICKED.returnPlaceLabel,
        delivery_cost_policy_no: PICKED.deliveryCostPolicyNo,
        delivery_cost_policy_label: PICKED.deliveryCostPolicyLabel,
        delivery_region_group_code: PICKED.deliveryRegionGroupCode,
        delivery_region_group_label: PICKED.deliveryRegionGroupLabel,
        courier_code: PICKED.courierCode,
        courier_label: PICKED.courierLabel,
        return_courier_code: PICKED.returnCourierCode,
        return_courier_label: PICKED.returnCourierLabel,
        weekday_close_time: null,
        saturday_close_time: null,
      },
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    });

    const mod = await import("../_lib/seller-settings");
    const loaded = await mod.loadLotteOnSellerSettings();

    expect(loaded.source).toBe("SELLER_SETTINGS");
    expect(loaded.failed).toBe(false);
    for (const key of Object.keys(PICKED) as (keyof typeof PICKED)[]) {
      expect(loaded[key], key).toBe(PICKED[key]);
    }
  });

  /* 🔴 067 «적용 전» 에도 살아야 한다. 새 컬럼이 없으면 undefined 로 오는데
     그것을 null 로 바꿔 내보내지 않으면 화면이 undefined 를 본다. */
  it("택배사 컬럼이 아직 없어도 죽지 않는다", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        outbound_place_no: "PLO1",
        outbound_place_label: "출고",
        return_place_no: null,
        return_place_label: null,
        delivery_cost_policy_no: null,
        delivery_cost_policy_label: null,
        delivery_region_group_code: null,
        delivery_region_group_label: null,
        weekday_close_time: null,
        saturday_close_time: null,
      },
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    });

    const mod = await import("../_lib/seller-settings");
    const loaded = await mod.loadLotteOnSellerSettings();
    expect(loaded.courierCode).toBeNull();
    expect(loaded.returnCourierCode).toBeNull();
    expect(loaded.outboundPlaceNo).toBe("PLO1");
  });
});

describe("③ 🔴 사다리 — 상품 폼이 «먼저» 다", () => {
  it("폼이 비면 설정값이 들어온다", async () => {
    const mod = await import("../_lib/seller-settings");
    const r = mod.resolveLotteOnSellerFixedValue("", "PLO3837441");
    expect(r.value).toBe("PLO3837441");
    expect(r.source).toBe("SELLER_SETTING");
  });

  /* 이 상품에서만 다른 출고지를 골랐다면 설정이 그것을 덮으면 안 된다 —
     덮으면 엉뚱한 곳에서 물건이 나간다. */
  it("폼에 값이 있으면 설정이 «덮지 않는다»", async () => {
    const mod = await import("../_lib/seller-settings");
    const r = mod.resolveLotteOnSellerFixedValue("PLO-OTHER", "PLO3837441");
    expect(r.value).toBe("PLO-OTHER");
    expect(r.source).toBe("PRODUCT");
  });

  it("둘 다 없으면 null — 검증기가 막는다", async () => {
    const mod = await import("../_lib/seller-settings");
    expect(mod.resolveLotteOnSellerFixedValue("", null).value).toBeNull();
  });
});

describe("④ 🔴 조회 실패를 «설정 없음» 으로 말하지 않는다", () => {
  it("오류면 source=ERROR · failed=true", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    getSupabaseAdmin.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    });
    const mod = await import("../_lib/seller-settings");
    const loaded = await mod.loadLotteOnSellerSettings();
    expect(loaded.source).toBe("ERROR");
    expect(loaded.failed).toBe(true);
  });
});
