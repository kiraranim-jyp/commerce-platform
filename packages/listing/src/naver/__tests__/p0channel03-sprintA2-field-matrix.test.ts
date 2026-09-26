import { describe, expect, it } from "vitest";
import { preserveRegisteredValues, PRESERVABLE_UPDATE_FIELDS } from "../preserve-registered-values";
import { compareRegisteredProduct } from "../registered-change";
import { detectUpdateDataLoss, type RegisteredProductSnapshot } from "../update-preflight";
import type { NaverProductRegistrationPayload } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A-2 STEP 4 — **필드 행렬을 CEO 대신 계약이 검증한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-09-26): SmartStore 는 가격·상품명으로 Production 동작이 이미
 * 확인됐고, 그것이 «공통 UPDATE 계약» 의 검증이다. 나머지 필드를 CEO 가 하나씩
 * 눌러 확인하지 «않는다» — 같은 계약을 필드마다 반복해서 사람에게 시키는 것은
 * 검증이 아니라 비용이다.
 *
 * 그래서 네 필드 × 네 계약을 여기서 전수로 고정한다:
 *
 *              변경값 반영   미변경값 보존   ChangeSet 일치   outgoing 일치
 *     상품명        ✓             ✓              ✓               ✓
 *     판매가격      ✓             ✓              ✓               ✓
 *     재고          ✓             ✓              ✓               ✓
 *     상세설명      ✓             ✓              ✓               ✓
 *
 * 🔴 「ChangeSet 일치」와 「outgoing 일치」는 다른 질문이다. 앞의 것은 «화면이
 * 말하는 것» 이고 뒤의 것은 «실제로 나가는 payload» 다 — 이 둘이 갈라진 것이
 * F-14-7b 의 사고였다(요약 1건 · 확인창 3건).
 */

/** 지금 채널에 나가 있는 것 — 13714803530 실측값을 본뜬 모양. */
const REGISTERED: RegisteredProductSnapshot = {
  name: "Bobo Choses Tag Woven Pants",
  salePrice: 157100,
  stockQuantity: 7,
  detailContent: "가".repeat(1907),
  representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
  optionalImageCount: 7,
  optionCombinationCount: 6,
  hasProvidedNotice: true,
  smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
};

/** 우리 빌더가 만드는 것 — 전부 Master 값이다(재고 999 · 상세설명 1835자). */
function masterPayload(over: Record<string, unknown> = {}): NaverProductRegistrationPayload {
  return {
    originProduct: {
      name: "Bobo Choses Tag Woven Pants",
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
  } as unknown as NaverProductRegistrationPayload;
}

const origin = (p: NaverProductRegistrationPayload) => p.originProduct as unknown as Record<string, unknown>;

/** 셀러가 한 필드를 고친 상황. 라우트가 하는 일을 «같은 순서로» 재현한다. */
function editOneField(field: (typeof PRESERVABLE_UPDATE_FIELDS)[number], value: unknown) {
  const edited = masterPayload({ [field]: value });
  /* 라우트 순서: 빌더 → (F-14-6a 전시상태) → F-14-7 되돌리기 → F-14-7b 재대조 */
  const { payload, unpreservable } = preserveRegisteredValues(edited, REGISTERED, [field]);
  return {
    payload,
    unpreservable,
    outgoing: compareRegisteredProduct(REGISTERED, payload),
    risks: detectUpdateDataLoss(REGISTERED, payload),
  };
}

/** 그 필드의 「지금 등록된 값」. */
const registeredValue: Record<(typeof PRESERVABLE_UPDATE_FIELDS)[number], unknown> = {
  name: REGISTERED.name,
  salePrice: REGISTERED.salePrice,
  stockQuantity: REGISTERED.stockQuantity,
  detailContent: REGISTERED.detailContent,
};

/** 셀러가 넣을 새 값. 🔴 실제로 셀러가 할 만한 수정이다. */
const newValue: Record<(typeof PRESERVABLE_UPDATE_FIELDS)[number], unknown> = {
  name: "Bobo Choses Tag Woven Pants !",
  salePrice: 156900,
  stockQuantity: 12,
  detailContent: "다".repeat(2000),
};

/** 화면에 보이는 이름 — ChangeSet 의 label 과 대조한다. */
const label: Record<(typeof PRESERVABLE_UPDATE_FIELDS)[number], string> = {
  name: "상품명",
  salePrice: "판매가격",
  stockQuantity: "재고수량",
  detailContent: "상세설명",
};

describe.each([...PRESERVABLE_UPDATE_FIELDS])("STEP 4 — %s 하나만 고쳤을 때", (field) => {
  const result = editOneField(field, newValue[field]);

  it("① 변경값이 실제로 나간다", () => {
    expect(origin(result.payload)[field]).toEqual(newValue[field]);
  });

  it("② 🔴 고치지 않은 나머지 셋은 «지금 등록된 값» 그대로다", () => {
    for (const other of PRESERVABLE_UPDATE_FIELDS) {
      if (other === field) continue;
      expect(origin(result.payload)[other], `${other} 가 Master 값으로 덮였다`).toEqual(
        registeredValue[other],
      );
    }
    expect(result.unpreservable).toEqual([]);
  });

  it("③ 🔴 ChangeSet 에 그 «한 항목만» 있다", () => {
    /* 이것이 화면(요약·확인창)이 말하는 내용이다. 여기 셋이 뜨면 셀러는 자기가
       하지 않은 변경을 보내게 된다. */
    expect(result.outgoing.changedFields).toEqual([label[field]]);
  });

  it("④ outgoing 이 ChangeSet 과 «같은 것» 을 말한다", () => {
    const changed = result.outgoing.fields.filter((f) => f.verdict === "CHANGED");
    expect(changed).toHaveLength(1);
    expect(changed[0]?.label).toBe(label[field]);
    /* 🔴 그 한 칸의 from/to 가 「지금 등록된 값 → 새 값」이다. */
    if (field !== "detailContent") {
      expect(changed[0]?.from).toBe(String(registeredValue[field]));
      expect(changed[0]?.to).toBe(String(newValue[field]));
    }
  });

  it("⑤ 손실검사를 통과한다 — 보낼 수 있는 상태다", () => {
    expect(result.risks).toEqual([]);
  });

  it("🔴 원래 값으로 되돌려 보내면 «변경이 0건» 이다", () => {
    const reverted = editOneField(field, registeredValue[field]);
    expect(reverted.outgoing.changedFields).toEqual([]);
    expect(reverted.risks).toEqual([]);
  });
});

describe("STEP 4 — 아무것도 고치지 않은 경우", () => {
  it("🔴 payload 가 «지금 등록된 값» 과 같아지고 변경 0건이다", () => {
    const { payload, preserved } = preserveRegisteredValues(masterPayload(), REGISTERED, []);
    expect(preserved.sort()).toEqual([...PRESERVABLE_UPDATE_FIELDS].sort());
    expect(compareRegisteredProduct(REGISTERED, payload).changedFields).toEqual([]);
    expect(detectUpdateDataLoss(REGISTERED, payload)).toEqual([]);
  });
});

describe("STEP 4 — 두 필드를 함께 고친 경우", () => {
  it("고친 둘만 나가고 나머지 둘은 보존된다", () => {
    const edited = masterPayload({ name: newValue.name, stockQuantity: newValue.stockQuantity });
    const { payload } = preserveRegisteredValues(edited, REGISTERED, ["name", "stockQuantity"]);
    expect(origin(payload).name).toBe(newValue.name);
    expect(origin(payload).stockQuantity).toBe(newValue.stockQuantity);
    expect(origin(payload).salePrice).toBe(REGISTERED.salePrice);
    expect(String(origin(payload).detailContent)).toHaveLength(1907);
    expect(compareRegisteredProduct(REGISTERED, payload).changedFields.sort()).toEqual(
      ["상품명", "재고수량"].sort(),
    );
  });
});
