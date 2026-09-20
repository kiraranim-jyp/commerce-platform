import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractForetforetShippingPolicy } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 2 ④(CEO 지시, 2026-09-20) — **한 건이 나머지를 죽이지 않는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * recordPriceObservations 는 상태와 금액이 모순되는 관측이 하나라도 있으면
 * **그 배치를 통째로 거절한다**(한 행도 쓰지 않는다). 그 설계는 옳다 —
 * 「UNREAD 인데 배송비 0원」 같은 행을 막는 것이 054/DOMESTIC-SHIPPING-02 의
 * 전부이기 때문이다.
 *
 * 🔴 그러나 그 대가가 이것이다: FLAT 을 «금액 없이» 만들어 내는 순간, 그 상품
 *    하나가 아니라 **같이 돌던 다른 판매처의 가격까지 0행이 된다.** 이번
 *    FLAT 승격이 실제로 위험한 지점은 파싱 정확도가 아니라 여기다.
 *
 * 그래서 이 파일은 파서의 «출력을 그대로» 저장 계층에 넣어 본다. 손으로 만든
 * 관측이 아니라 실측 HTML → 파서 → 관측 배치다.
 */

const hoisted = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

function makeSupabaseStub() {
  function builder() {
    let pending: Array<Record<string, unknown>> | null = null;
    const chain = {
      insert: (payload: Array<Record<string, unknown>>) => {
        pending = payload;
        return chain;
      },
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      limit: () => chain,
      then: (resolve: (v: { data: unknown; error: null; count: number }) => unknown) => {
        if (!pending) return resolve({ data: [], error: null, count: 0 });
        for (const row of pending) hoisted.rows.push({ id: `row-${hoisted.rows.length + 1}`, ...row });
        return resolve({ data: null, error: null, count: pending.length });
      },
    };
    return chain;
  }
  return { from: () => builder() };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => makeSupabaseStub() }));

const { recordPriceObservations } = await import("../price-observations");

const SNAPSHOT_ID = "0767b19b-0000-0000-0000-00000000c0c0";

/* ── 실측 원문(2026-09-20) ── */
const field = (label: string, alert: string) =>
  `<p><span class="shopdetailInfoName">배송비</span>` +
  `<span class="shopdetailInfoCont"><a href="javascript:alert('${alert}');">` +
  `<span>${label}</span></a></p>`;
const FLAT_HTML =
  field("배송조건 : (고정)", "주문금액에 상관없이 배송비가 3,500원 청구됩니다.") +
  `<dl><dt>입점사 배송비</dt><dd>주문금액에 상관없이 배송비가 3,500원 청구됩니다. <br>제주 및 도서산간 지역 4000원</dd></dl>`;
/** 라벨은 (고정)인데 금액이 둘 — 파서가 FLAT 을 «만들지 않아야» 하는 입력. */
const AMBIGUOUS_HTML = field("배송조건 : (고정)", "배송비 3,500원, 제주 및 도서산간 지역 4000원");

/** 파서 출력을 그대로 실은 포레포레 관측. */
function foretforetObservation(html: string) {
  const s = extractForetforetShippingPolicy(html);
  return {
    snapshotId: SNAPSHOT_ID,
    source: "DOMESTIC_SHOP" as const,
    sourceLabel: "포레포레",
    sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
    currency: "KRW",
    priceAmount: 70000,
    priceKrw: 70000,
    shippingPolicyStatus: s.status,
    shippingPolicyNote: s.note,
    shippingCostAmount: s.amountKrw,
  };
}

/** 같은 실행에서 같이 돌던 «다른 판매처» — 배송정책을 읽는 코드가 없는 쪽이다. */
const otherShop = {
  snapshotId: SNAPSHOT_ID,
  source: "DOMESTIC_SHOP" as const,
  sourceLabel: "DEUXBEBE(듀베베)",
  sourceProductUrl: "https://deuxbebe.com/product/x",
  currency: "KRW",
  priceAmount: 162000,
  priceKrw: 162000,
};

beforeEach(() => {
  hoisted.rows.length = 0;
});

describe("P0-C STEP 2 ④ — FLAT 관측이 같은 배치의 다른 관측을 죽이지 않는다", () => {
  it("🟢 FLAT 3,500 과 다른 판매처 가격이 «둘 다» 저장된다", async () => {
    const result = await recordPriceObservations([foretforetObservation(FLAT_HTML), otherShop]);
    expect(result).toEqual({ ok: true, count: 2 });
    expect(hoisted.rows).toHaveLength(2);
    expect(hoisted.rows[0]).toMatchObject({
      shipping_policy_status: "FLAT",
      shipping_cost_amount: 3500,
      price_krw: 70000,
    });
    // 🔴 같이 돌던 판매처가 멀쩡히 남았다 — 이것이 이 테스트의 전부다.
    expect(hoisted.rows[1]).toMatchObject({ source_label: "DEUXBEBE(듀베베)", price_krw: 162000 });
  });

  it("🟢 금액이 모호하면 UNREAD 로 내려가고, 그래도 배치는 살아 있다", async () => {
    const obs = foretforetObservation(AMBIGUOUS_HTML);
    expect(obs.shippingPolicyStatus).toBe("UNREAD");
    expect(obs.shippingCostAmount).toBeNull();

    const result = await recordPriceObservations([obs, otherShop]);
    expect(result).toEqual({ ok: true, count: 2 });
    expect(hoisted.rows).toHaveLength(2);
    expect(hoisted.rows[0]).toMatchObject({ shipping_policy_status: "UNREAD", shipping_cost_amount: null });
  });

  it("🔴 그 가드가 «실재한다»는 것도 확인한다 — 손으로 모순을 만들면 배치가 통째로 거절된다", async () => {
    // 파서는 이런 값을 만들 수 없다(유니온이 막는다). 가드가 살아 있는지만 본다.
    const result = await recordPriceObservations([
      { ...otherShop, shippingPolicyStatus: "FLAT" as const },
      otherShop,
    ]);
    expect(result.ok).toBe(false);
    expect(hoisted.rows).toHaveLength(0);
  });

  it("(조건) 은 예전 그대로 — 금액 없이 저장되고 조건 원문이 남는다", async () => {
    const html = field("배송조건 : (조건)", "총 결제금액이 70,000원 미만시 배송비 3,000원이 청구됩니다.");
    const result = await recordPriceObservations([foretforetObservation(html), otherShop]);
    expect(result).toEqual({ ok: true, count: 2 });
    expect(hoisted.rows[0]).toMatchObject({
      shipping_policy_status: "CONDITIONAL_FREE",
      shipping_cost_amount: null,
    });
    expect(hoisted.rows[0]!.shipping_policy_note).toContain("70,000원 미만시");
  });
});
