import { describe, expect, it } from "vitest";
import {
  PRESERVABLE_UPDATE_FIELDS,
  preserveRegisteredValues,
} from "../preserve-registered-values";
import { detectUpdateDataLoss, type RegisteredProductSnapshot } from "../update-preflight";
import type { NaverProductRegistrationPayload } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-7 — **고치지 않은 값은 그대로 나간다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 에서 나온 실제 사고를 그대로 본뜬다: 셀러가 상품명에 「!」 하나를
 * 붙였는데 재고가 7 → 999, 상세설명이 1907자 → 1835자로 같이 나갔다.
 *
 * 🔴 「변경된 필드만 PUT 에 넣는다」로 고치지 않는다(CTO §6). 전체 교체라 그러면
 * 나머지가 지워진다. 보내는 것은 여전히 전체 payload 이고, 그 «내용» 이
 * 「지금 등록된 값 + 셀러가 고친 값」이 된다.
 */

/** 지금 등록돼 있는 것 — CEO 테스트 상품(13714803530)의 실측값을 본뜬 모양. */
const REGISTERED: RegisteredProductSnapshot = {
  name: "Bobo Choses 26AW 키즈 Booo Bo Choses Tag Woven Pants",
  salePrice: 157100,
  stockQuantity: 7,
  detailContent: "가".repeat(1907),
  representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
  optionalImageCount: 7,
  optionCombinationCount: 6,
  hasProvidedNotice: true,
  smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
};

/** 빌더가 만든 것 — 전부 «우리 Master» 값이다(그것이 이 사고의 원인이었다). */
const masterPayload = (over: Record<string, unknown> = {}): NaverProductRegistrationPayload =>
  ({
    originProduct: {
      name: "Bobo Choses 26AW 키즈 Booo Bo Choses Tag Woven Pants",
      salePrice: 157100,
      stockQuantity: 999,
      detailContent: "나".repeat(1835),
      images: {
        representativeImage: { url: "https://shop-phinf.pstatic.net/NEW.jpg" },
        optionalImages: Array.from({ length: 7 }, () => ({ url: "x" })),
      },
      detailAttribute: {
        productInfoProvidedNotice: { productInfoProvidedNoticeType: "WEAR" },
        optionInfo: { optionCombinations: Array.from({ length: 6 }, () => ({})) },
      },
      ...over,
    },
    smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
  }) as unknown as NaverProductRegistrationPayload;

const origin = (payload: NaverProductRegistrationPayload) =>
  payload.originProduct as unknown as Record<string, unknown>;

describe("🔴 Production 사고 재현 — 상품명만 고쳤는데 재고·상세설명이 같이 나갔다", () => {
  it("고치기 «전» 의 동작을 그대로 적어 둔다 — Master 값이 전부 실려 있었다", () => {
    const before = masterPayload({ name: "Bobo Choses 26AW 키즈 Booo Bo Choses Tag Woven Pants !" });
    expect(origin(before).stockQuantity).toBe(999);
    expect(String(origin(before).detailContent)).toHaveLength(1835);
  });

  it("Case 4. 상품명을 고치면 상품명만 나가고 «나머지는 지금 등록된 값» 이다", () => {
    const edited = masterPayload({ name: "Bobo Choses 26AW 키즈 Booo Bo Choses Tag Woven Pants !" });
    const { payload, unpreservable } = preserveRegisteredValues(edited, REGISTERED, ["name"]);
    expect(origin(payload).name).toBe("Bobo Choses 26AW 키즈 Booo Bo Choses Tag Woven Pants !");
    expect(origin(payload).stockQuantity).toBe(7);
    expect(String(origin(payload).detailContent)).toHaveLength(1907);
    expect(origin(payload).salePrice).toBe(157100);
    expect(unpreservable).toEqual([]);
  });

  it("Case 2. 재고만 고치면 재고만 나간다", () => {
    const edited = masterPayload({ stockQuantity: 12 });
    const { payload } = preserveRegisteredValues(edited, REGISTERED, ["stockQuantity"]);
    expect(origin(payload).stockQuantity).toBe(12);
    expect(origin(payload).name).toBe(REGISTERED.name);
    expect(String(origin(payload).detailContent)).toHaveLength(1907);
  });

  it("Case 3. 상세설명만 고치면 상세설명만 나간다", () => {
    const edited = masterPayload({ detailContent: "다".repeat(2000) });
    const { payload } = preserveRegisteredValues(edited, REGISTERED, ["detailContent"]);
    expect(String(origin(payload).detailContent)).toHaveLength(2000);
    expect(origin(payload).stockQuantity).toBe(7);
    expect(origin(payload).name).toBe(REGISTERED.name);
  });

  it("Case 5. 아무것도 고치지 않으면 payload 가 «지금 등록된 값» 과 같아진다", () => {
    const { payload, preserved } = preserveRegisteredValues(masterPayload(), REGISTERED, []);
    expect(origin(payload).name).toBe(REGISTERED.name);
    expect(origin(payload).salePrice).toBe(REGISTERED.salePrice);
    expect(origin(payload).stockQuantity).toBe(REGISTERED.stockQuantity);
    expect(String(origin(payload).detailContent)).toHaveLength(1907);
    expect(preserved.sort()).toEqual([...PRESERVABLE_UPDATE_FIELDS].sort());
  });
});

describe("🔴 되돌릴 수 없으면 «보내지 않는다»", () => {
  it("고치지 않은 축을 읽지 못했으면 unpreservable 로 «알린다»", () => {
    const unread: RegisteredProductSnapshot = { ...REGISTERED, stockQuantity: undefined };
    const { unpreservable, payload } = preserveRegisteredValues(masterPayload(), unread, ["name"]);
    expect(unpreservable).toEqual(["stockQuantity"]);
    /* 🔴 그 칸은 «그대로 둔다» — 지어낸 값을 넣지 않는다. 보낼지 말지는 호출부가
       정하고, 라우트는 이 목록이 비어 있지 않으면 PUT 하지 않는다. */
    expect(origin(payload).stockQuantity).toBe(999);
  });

  it("🔴 셀러가 «고친» 축은 읽지 못해도 문제가 아니다 — 새 값을 보내는 것이 목적이다", () => {
    const unread: RegisteredProductSnapshot = { ...REGISTERED, stockQuantity: undefined };
    const { unpreservable } = preserveRegisteredValues(masterPayload(), unread, ["stockQuantity"]);
    expect(unpreservable).toEqual([]);
  });
});

describe("🔴 전체 교체 원칙을 깨지 않는다", () => {
  it("payload 에서 칸을 «빼지» 않는다 — 빼면 그 값이 지워진다", () => {
    const { payload } = preserveRegisteredValues(masterPayload(), REGISTERED, ["name"]);
    for (const field of PRESERVABLE_UPDATE_FIELDS) {
      expect(origin(payload)[field], `${field} 가 payload 에서 사라졌다`).toBeDefined();
    }
    /* 이미지·옵션·고시도 그대로 남아 있다. */
    expect(origin(payload).images).toBeDefined();
    expect(origin(payload).detailAttribute).toBeDefined();
  });

  it("손실검사를 그대로 통과한다 — 되돌린 payload 는 «온전하다»", () => {
    const { payload } = preserveRegisteredValues(masterPayload(), REGISTERED, ["name"]);
    expect(detectUpdateDataLoss(REGISTERED, payload)).toEqual([]);
  });

  it("🔴 원본 payload 를 건드리지 않는다 — 보고서와 전송이 갈라지지 않게", () => {
    const before = masterPayload();
    preserveRegisteredValues(before, REGISTERED, []);
    expect(origin(before).stockQuantity).toBe(999);
  });

  it("🔴 복원할 수 «없는» 축은 손대지 않는다 — 개수만 읽은 것은 내용을 모른다", () => {
    /* 이미지·옵션·고시는 GET 에서 개수·존재만 읽는다(F-13 §표). 복원 대상이
       아니라는 사실을 목록으로 고정한다 — 나중에 근거 없이 늘리지 않게. */
    expect([...PRESERVABLE_UPDATE_FIELDS]).toEqual([
      "name",
      "salePrice",
      "stockQuantity",
      "detailContent",
    ]);
  });
});
