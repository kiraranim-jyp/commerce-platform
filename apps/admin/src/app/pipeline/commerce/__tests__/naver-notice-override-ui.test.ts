// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct,
  MASTER_FIELD_GROUP,
  type CanonicalProduct,
  type ChannelNoticeOverride,
} from "@commerce/shared";
import { NOTICE_KEY_PACK_DATE, NOTICE_KEY_RELEASE_DATE, resolveChannelNoticeField } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NAVER-CHANNEL-NOTICE-OVERRIDES-03 — 저장·왕복·호환 (CPO 확정, 2026-09-30)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 추가 조건: 「자동저장 및 재로딩 과정에서 `REFERENCED` 와
 * `DISCLOSED_DEFAULT` 의 차이가 보존되는지 검증하세요.」
 *
 * 🔴 왕복은 «JSON» 이다. `page.tsx` 가 product 를 그대로
 * `product_snapshots.workspace`(jsonb) 로 보내고, 되읽을 때
 * `backfillCanonicalProduct` 를 지난다. 그래서 그 두 단계를 실제로 통과시킨다 —
 * 함수만 부르고 「저장되겠지」로 끝내지 않는다.
 */

function roundTrip(product: CanonicalProduct): CanonicalProduct {
  /* 자동저장 → DB(jsonb) → 재로딩을 그대로 흉내낸다. */
  return backfillCanonicalProduct(JSON.parse(JSON.stringify(product)) as CanonicalProduct);
}

/* 🔴 backfillCanonicalProduct 는 `raw.price.value` 를 읽는다(legacy priceValidity
   추론). 그래서 «완전히 빈» 객체로는 왕복을 흉내낼 수 없다 — 최소 스텁을 둔다.
   처음에 `{}` 로 짰다가 여기서 걸렸고, 그 실패가 오히려 「backfill 이 실제로
   돈다」를 증명한다(스텁이 통과했다면 왕복을 재지 않았다는 뜻이다). */
function minimalProduct(): CanonicalProduct {
  return {
    price: { value: { amount: 1000, currency: "KRW" }, source: "ORIGINAL", confidence: 1 },
  } as unknown as CanonicalProduct;
}

function productWith(override?: ChannelNoticeOverride): CanonicalProduct {
  return {
    ...minimalProduct(),
    ...(override ? { channelNoticeOverrides: { smartstore: override } } : {}),
  } as unknown as CanonicalProduct;
}

describe("① 분류 — 새 칸이 Master 가 아니라 COMMERCE_BINDING 이다", () => {
  it("MASTER_FIELD_GROUP 에 COMMERCE_BINDING 으로 등록돼 있다", () => {
    expect(MASTER_FIELD_GROUP.channelNoticeOverrides).toBe("COMMERCE_BINDING");
  });

  it("🔴 channelPriceOverrides 와 «같은» 층이다 — 채널 키 모양을 따랐다는 증거", () => {
    expect(MASTER_FIELD_GROUP.channelNoticeOverrides).toBe(MASTER_FIELD_GROUP.channelPriceOverrides);
  });
});

describe("② 기존 workspace 호환 — 새 키가 «없어도» 죽지 않는다", () => {
  it("키가 없는 과거 스냅샷을 backfill 하면 빈 객체가 된다", () => {
    const legacy = minimalProduct();
    expect(backfillCanonicalProduct(legacy).channelNoticeOverrides).toEqual({});
  });

  it("🔴 그때 payload 는 기존과 «같다» — 기본값이 유지된다", () => {
    const restored = backfillCanonicalProduct(minimalProduct());
    const r = resolveChannelNoticeField(restored.channelNoticeOverrides?.smartstore, NOTICE_KEY_PACK_DATE);
    expect(r.state).toBe("DISCLOSED_DEFAULT");
    expect(r.outgoing.trim()).not.toBe("");
  });
});

describe("③ 왕복 — REFERENCED 와 DISCLOSED_DEFAULT 의 «차이» 가 보존된다", () => {
  it("🔴 셀러가 고른 참조는 왕복 후에도 SELLER_REFERENCED 다", () => {
    const saved = roundTrip(productWith({ referenced: [NOTICE_KEY_RELEASE_DATE] }));
    expect(
      resolveChannelNoticeField(saved.channelNoticeOverrides?.smartstore, NOTICE_KEY_RELEASE_DATE).state,
    ).toBe("SELLER_REFERENCED");
  });

  it("🔴 아무것도 안 한 칸은 왕복 후에도 DISCLOSED_DEFAULT 다 — 승격되지 않는다", () => {
    const saved = roundTrip(productWith({ referenced: [NOTICE_KEY_RELEASE_DATE] }));
    /* 같은 override 안의 «다른» 칸이다. 참조 하나를 골랐다고 나머지가 함께
       「셀러가 정한 것」이 되어서는 안 된다. */
    expect(resolveChannelNoticeField(saved.channelNoticeOverrides?.smartstore, NOTICE_KEY_PACK_DATE).state).toBe(
      "DISCLOSED_DEFAULT",
    );
  });

  it("실제 값도 왕복에서 남는다", () => {
    const saved = roundTrip(productWith({ values: { [NOTICE_KEY_PACK_DATE]: "2025-03" } }));
    const r = resolveChannelNoticeField(saved.channelNoticeOverrides?.smartstore, NOTICE_KEY_PACK_DATE);
    expect(r).toEqual({ outgoing: "2025-03", state: "SELLER_VALUE" });
  });

  it("🔴 두 상태가 한 상품에 «공존» 하고 왕복에서 섞이지 않는다", () => {
    const saved = roundTrip(
      productWith({ values: { [NOTICE_KEY_PACK_DATE]: "2025-03" }, referenced: [NOTICE_KEY_RELEASE_DATE] }),
    );
    const o = saved.channelNoticeOverrides?.smartstore;
    expect(resolveChannelNoticeField(o, NOTICE_KEY_PACK_DATE).state).toBe("SELLER_VALUE");
    expect(resolveChannelNoticeField(o, NOTICE_KEY_RELEASE_DATE).state).toBe("SELLER_REFERENCED");
  });

  it("🔴 JSON 에 DISCLOSED_DEFAULT 라는 «값» 이 남지 않는다 — 부재로만 표현된다", () => {
    const saved = roundTrip(productWith({ referenced: [NOTICE_KEY_RELEASE_DATE] }));
    const json = JSON.stringify(saved.channelNoticeOverrides);
    expect(json).not.toContain("DISCLOSED");
    expect(json).not.toContain(NOTICE_KEY_PACK_DATE);
  });
});
