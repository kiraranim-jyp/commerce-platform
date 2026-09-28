import { describe, expect, it } from "vitest";
import {
  applyCoupangEdits,
  coupangUpdateGate,
  detectCoupangUpdateLoss,
  itemKeyOf,
  type CoupangRegisteredProduct,
} from "../../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-IMPLEMENT-01 Phase 5 — **negative test 가 본문이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 지정한 아홉 가지를 그대로 잰다. 요점은 하나 —
 *
 *   🔴 **Master 로 payload 를 다시 만들어 PUT 하는 길을 막는다.**
 *
 * 실측 fixture 는 «실제 GET 응답의 모양» 그대로다(COUPANG-UPDATE-CAPABILITY-01,
 * sellerProductId 16394846257). 🔴 연락처·주소는 넣지 않았다 — 응답에 있었지만
 * 테스트에 필요하지 않다.
 */

/** 🔴 쿠팡이 «덧붙여 주는» 칸을 일부러 섞어 둔다 — 그것들이 지켜지는지가 핵심이다. */
const BASELINE: CoupangRegisteredProduct = {
  sellerProductId: 16394846257,
  status: "SAVED",
  statusName: "임시저장",
  sellerProductName: "Bubble Sweatshirt in Grey Melange by Main Story",
  displayProductName: "main story Bubble Sweatshirt in Grey Melange",
  displayCategoryCode: 85551,
  categoryId: 9687,
  productOrigin: "",
  mdId: "NLUP_TEMP_SAVED",
  contributorType: "API_SELLER",
  requested: false,
  productId: null,
  deliveryMethod: "AGENT_BUY",
  items: [
    {
      sellerProductItemId: 38554512389,
      vendorItemId: null,
      itemName: "Grey Melange / 4Y",
      salePrice: 147900,
      maximumBuyCount: 1,
      certifications: [],
      images: [{}, {}, {}, {}, {}, {}, {}],
      notices: [{}, {}, {}, {}, {}],
      attributes: [{}, {}],
      contents: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
      searchTags: [{}],
    },
    {
      sellerProductItemId: 38554512390,
      vendorItemId: null,
      itemName: "Grey Melange / 6Y",
      salePrice: 147900,
      maximumBuyCount: 1,
      certifications: [],
      images: [{}],
      notices: [{}],
      attributes: [{}],
      contents: [{}],
      searchTags: [{}],
    },
  ],
};

const clone = (v: CoupangRegisteredProduct): CoupangRegisteredProduct => JSON.parse(JSON.stringify(v));

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ① 상태 게이트 — 실측한 범위 밖으로 나가지 않는다 (CPO Phase 4)
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ① 상태 게이트", () => {
  it("SAVED → ALLOW", () => {
    expect(coupangUpdateGate(BASELINE)).toEqual({ allowed: true, status: "SAVED" });
  });

  it.each([
    ["승인완료", "APPROVED"],
    ["판매중", "ON_SALE"],
    ["심사중", "IN_REVIEW"],
  ])("%s → BLOCKED — 승인 후 규칙은 재 본 적이 없다", (_l, status) => {
    const gate = coupangUpdateGate({ ...BASELINE, status });
    expect(gate.allowed).toBe(false);
    expect(gate).toMatchObject({ reason: "STATUS_NOT_SAVED", status });
  });

  it.each([
    ["상태 미확인", { ...BASELINE, status: undefined }],
    ["상태 빈 문자열", { ...BASELINE, status: "   " }],
  ])("%s → BLOCKED", (_l, base) => {
    expect(coupangUpdateGate(base as CoupangRegisteredProduct)).toMatchObject({
      allowed: false,
      reason: "STATUS_UNKNOWN",
    });
  });

  it.each([
    ["baseline 없음(GET 실패)", null],
    ["baseline undefined", undefined],
  ])("%s → BLOCKED", (_l, base) => {
    expect(coupangUpdateGate(base)).toMatchObject({ allowed: false, reason: "NO_BASELINE" });
  });

  it("🔴 막힌 이유를 «구분해서» 말한다 — 「안 된다」와 「모른다」는 다른 사실이다", () => {
    const reasons = new Set([
      (coupangUpdateGate(null) as { reason: string }).reason,
      (coupangUpdateGate({ ...BASELINE, status: undefined }) as { reason: string }).reason,
      (coupangUpdateGate({ ...BASELINE, status: "APPROVED" }) as { reason: string }).reason,
    ]);
    expect(reasons.size).toBe(3);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ② overlay — 고친 것만 바뀌고 나머지는 GET 값 그대로 (CPO PASS 케이스 2개)
   ════════════════════════════════════════════════════════════════════════════ */
describe("② overlay — 「실제 수정 필드만 변경」 · 「수정 안 한 필드는 GET 값 유지」", () => {
  it("상품명만 고치면 상품명만 바뀐다", () => {
    const out = applyCoupangEdits(BASELINE, { name: "새 상품명" });
    expect(out.sellerProductName).toBe("새 상품명");
    expect(out.displayProductName).toBe("새 상품명");
    /* 나머지는 한 칸도 안 바뀐다. */
    const { sellerProductName: _a, displayProductName: _b, ...restOut } = out;
    const { sellerProductName: _c, displayProductName: _d, ...restBase } = BASELINE;
    expect(restOut).toEqual(restBase);
  });

  it("옵션 가격만 고치면 그 옵션만 바뀐다", () => {
    const out = applyCoupangEdits(BASELINE, { items: { "38554512389": { salePrice: 99000 } } });
    expect(out.items![0].salePrice).toBe(99000);
    expect(out.items![1]).toEqual(BASELINE.items![1]);
    expect(out.items![0].itemName).toBe(BASELINE.items![0].itemName);
  });

  it("재고는 maximumBuyCount 자리다 — S-17 에서 확정된 기존 매핑", () => {
    const out = applyCoupangEdits(BASELINE, { items: { "38554512390": { maximumBuyCount: 7 } } });
    expect(out.items![1].maximumBuyCount).toBe(7);
  });

  it("🔴 아무것도 안 고치면 baseline 과 «완전히» 같다", () => {
    expect(applyCoupangEdits(BASELINE, {})).toEqual(BASELINE);
  });

  it("🔴 baseline 을 «변형하지 않는다» — 원본이 그대로다", () => {
    const before = clone(BASELINE);
    applyCoupangEdits(BASELINE, { name: "x", items: { "38554512389": { salePrice: 1 } } });
    expect(BASELINE).toEqual(before);
  });

  it("🔴 모르는 칸도 그대로 나른다 — 타입에 없는 칸이 사라지면 안 된다", () => {
    const withUnknown = { ...BASELINE, 쿠팡이나중에추가한칸: { a: 1 } };
    expect(applyCoupangEdits(withUnknown, { name: "x" })["쿠팡이나중에추가한칸"]).toEqual({ a: 1 });
  });

  it("식별자 없는 옵션은 건드리지 않는다 — 그 값이 없으면 쿠팡이 «새 옵션 추가» 로 읽는다", () => {
    const base = { ...BASELINE, items: [{ sellerProductItemId: null, salePrice: 100 }] };
    expect(applyCoupangEdits(base, { items: { "null": { salePrice: 999 } } }).items![0].salePrice).toBe(100);
  });

  it("itemKeyOf 는 «문자열» 로 다룬다 — 숫자로 비교하면 정밀도에서 샌다", () => {
    expect(itemKeyOf({ sellerProductItemId: 38554512389 })).toBe("38554512389");
    expect(itemKeyOf({ sellerProductItemId: null })).toBeNull();
    expect(itemKeyOf({})).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ③ 손실 가드 — CPO 지정 negative 7가지 (Phase 2·5)
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ③ 손실 가드 — 사라지거나 줄면 BLOCKED", () => {
  it("정상 overlay 는 위험 0 — 막지 말아야 할 것을 막지 않는다", () => {
    const out = applyCoupangEdits(BASELINE, { name: "새 이름", items: { "38554512389": { salePrice: 1000 } } });
    expect(detectCoupangUpdateLoss(BASELINE, out)).toEqual([]);
  });

  it("🔴 Master 값으로 baseline 이 덮어써지는 경우 → FAIL", () => {
    /* 「빌더가 만든 payload 를 그대로 PUT」이 정확히 이 모양이다 — 쿠팡이 관리하는
       칸(status·mdId·productOrigin·categoryId·productId …)이 통째로 없다. */
    const fromMaster: CoupangRegisteredProduct = {
      sellerProductName: BASELINE.sellerProductName,
      displayCategoryCode: BASELINE.displayCategoryCode,
      deliveryMethod: "AGENT_BUY",
      items: (BASELINE.items ?? []).map((i) => ({ itemName: i.itemName, salePrice: i.salePrice })),
    };
    const risks = detectCoupangUpdateLoss(BASELINE, fromMaster);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.map((r) => r.field)).toContain("status");
  });

  it("🔴 쿠팡 관리 필드가 outgoing 에서 사라짐 → FAIL", () => {
    const out = clone(BASELINE);
    delete out.mdId;
    expect(detectCoupangUpdateLoss(BASELINE, out)).toContainEqual(
      expect.objectContaining({ field: "mdId", reason: "MISSING" }),
    );
  });

  it("🔴 items[] 일부 누락 → FAIL", () => {
    const out = clone(BASELINE);
    out.items = [out.items![0]];
    const risks = detectCoupangUpdateLoss(BASELINE, out);
    expect(risks).toContainEqual(expect.objectContaining({ field: "items", reason: "EMPTIED" }));
  });

  it("🔴 sellerProductItemId 누락 → FAIL", () => {
    const out = clone(BASELINE);
    delete out.items![0].sellerProductItemId;
    expect(detectCoupangUpdateLoss(BASELINE, out)).toContainEqual(
      expect.objectContaining({ field: "items[38554512389].sellerProductItemId", reason: "MISSING" }),
    );
  });

  it("🔴 certifications 임의 «생성» → FAIL — KC 번호를 지어내지 않는다", () => {
    const out = clone(BASELINE);
    out.items![0].certifications = [{ certificationType: "KC", certificationCode: "제12-345호" }];
    expect(detectCoupangUpdateLoss(BASELINE, out)).toContainEqual(
      expect.objectContaining({ field: "items[38554512389].certifications", reason: "FABRICATED" }),
    );
  });

  it.each([
    ["이미지", "images"],
    ["상품정보제공고시", "notices"],
    ["구매옵션", "attributes"],
    ["상세내용", "contents"],
  ])("🔴 %s 가 줄어들면 → FAIL (배열에서 빠지면 쿠팡은 «삭제» 로 읽는다)", (_l, key) => {
    const out = clone(BASELINE);
    (out.items![0][key] as unknown[]).pop();
    expect(detectCoupangUpdateLoss(BASELINE, out)).toContainEqual(
      expect.objectContaining({ field: `items[38554512389].${key}`, reason: "EMPTIED" }),
    );
  });

  it.each([
    ["옵션명", "itemName"],
    ["판매가", "salePrice"],
    ["재고", "maximumBuyCount"],
  ])("🔴 %s 가 비워지면 → FAIL", (_l, key) => {
    const out = clone(BASELINE);
    out.items![0][key] = null;
    expect(detectCoupangUpdateLoss(BASELINE, out)).toContainEqual(
      expect.objectContaining({ field: `items[38554512389].${key}`, reason: "MISSING" }),
    );
  });

  it("🔴 원래 비어 있던 칸은 지킬 것이 없다 — 없는 손실을 만들지 않는다", () => {
    /* `productOrigin` 은 baseline 에서 이미 "" 다. 그것까지 MISSING 으로 세면
       정상 수정이 전부 막힌다. */
    const out = clone(BASELINE);
    delete out.productOrigin;
    expect(detectCoupangUpdateLoss(BASELINE, out).map((r) => r.field)).not.toContain("productOrigin");
  });

  it("🔴 값이 «바뀌는» 것은 손실이 아니다 — 그게 수정이다", () => {
    const out = applyCoupangEdits(BASELINE, { name: "전혀 다른 이름" });
    expect(detectCoupangUpdateLoss(BASELINE, out)).toEqual([]);
  });
});
