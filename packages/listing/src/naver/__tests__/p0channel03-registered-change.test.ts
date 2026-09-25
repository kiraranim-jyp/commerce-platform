import { describe, expect, it } from "vitest";
import { compareRegisteredProduct } from "../registered-change";
import type { RegisteredProductSnapshot } from "../update-preflight";
import type { NaverProductRegistrationPayload } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-6 — **무엇이 바뀌었는가를 「읽어서」 안다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 근거는 「우리가 지난번에 보낸 것」이 아니라 「지금 나가 있는 것」이다.
 * 셀러가 스마트스토어 관리자에서 직접 고칠 수 있기 때문이다.
 *
 * 🔴 이 파일이 지키는 것은 정확도가 아니라 «정직함» 이다:
 *    못 본 것을 「같다」고 말하지 않는다.
 */

/** 지금 나가 있는 것. */
const CURRENT: RegisteredProductSnapshot = {
  name: "Color Block Zipped Sweatshirt",
  salePrice: 159000,
  stockQuantity: 10,
  detailContent: "<p>상세</p>",
  representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
  optionalImageCount: 3,
  optionCombinationCount: 4,
  hasProvidedNotice: true,
  leafCategoryId: "50000167",
};

/** 보내려는 것 — 기본은 CURRENT 와 «같은» 내용. */
function payload(origin: Record<string, unknown> = {}): NaverProductRegistrationPayload {
  return {
    originProduct: {
      statusType: "SALE",
      leafCategoryId: "50000167",
      name: "Color Block Zipped Sweatshirt",
      salePrice: 159000,
      stockQuantity: 10,
      detailContent: "<p>상세</p>",
      images: {
        representativeImage: { url: "https://shop-phinf.pstatic.net/NEW.jpg" },
        optionalImages: [{ url: "1" }, { url: "2" }, { url: "3" }],
      },
      detailAttribute: {
        productInfoProvidedNotice: { productInfoProvidedNoticeType: "WEAR" },
        optionInfo: { optionCombinations: [{}, {}, {}, {}] },
      },
      ...origin,
    },
    smartstoreChannelProduct: {},
  } as unknown as NaverProductRegistrationPayload;
}

const changed = (p: NaverProductRegistrationPayload) =>
  compareRegisteredProduct(CURRENT, p).changedFields;

describe("① 같으면 «차이 없음» 이다", () => {
  it("내용이 같으면 changedFields 가 비어 있다", () => {
    expect(changed(payload())).toEqual([]);
  });

  it("🔴 이미지 URL 이 달라도 «변경» 으로 세지 않는다", () => {
    /* 등록할 때마다 네이버에 다시 업로드돼 URL 이 «항상» 새 것이다. 이것을
       변경으로 세면 아무것도 안 고쳐도 매번 변경으로 잡혀서, 변경 감지가
       아무 말도 하지 않는 것과 같아진다. */
    expect(changed(payload())).toEqual([]);
    expect(compareRegisteredProduct(CURRENT, payload()).notCompared.join(" ")).toContain("이미지");
  });
});

describe("② 실제로 바뀐 것은 잡는다", () => {
  it("판매가격", () => {
    expect(changed(payload({ salePrice: 149000 }))).toContain("판매가격");
  });

  it("🔴 상품명 — 셀러가 가장 자주 고치고, 놓치면 조용히 사라진다", () => {
    expect(changed(payload({ name: "새 이름" }))).toContain("상품명");
  });

  it("재고수량 · 상세설명", () => {
    expect(changed(payload({ stockQuantity: 0 }))).toContain("재고수량");
    expect(changed(payload({ detailContent: "<p>다른 상세</p>" }))).toContain("상세설명");
  });

  it("🔴 옵션·추가이미지는 «양방향» 으로 본다 — 늘어난 것도 변경이다", () => {
    /* preflight 의 관심(줄어들면 손실)과 다른 질문이다. 옵션이 늘어난 것은
       손실은 아니지만 분명히 «바뀐» 것이고, UPDATE 로 나가야 한다. */
    const more = payload({ detailAttribute: { optionInfo: { optionCombinations: [{}, {}, {}, {}, {}] } } });
    expect(changed(more).join(" ")).toContain("옵션 개수(4 → 5)");
    const fewer = payload({ detailAttribute: { optionInfo: { optionCombinations: [{}] } } });
    expect(changed(fewer).join(" ")).toContain("옵션 개수(4 → 1)");
  });
});

describe("③ 🔴 카테고리는 세 갈래다 — boolean 이 아니다", () => {
  it("같으면 SAME", () => {
    expect(compareRegisteredProduct(CURRENT, payload()).category).toBe("SAME");
  });

  it("다르면 CHANGED", () => {
    expect(compareRegisteredProduct(CURRENT, payload({ leafCategoryId: "50000168" })).category).toBe(
      "CHANGED",
    );
  });

  it("🔴 지금 등록된 카테고리를 읽지 못했으면 UNKNOWN — 「같다」가 아니다", () => {
    /* 여기서 SAME 으로 뭉개면 카테고리 변경이 조용히 UPDATE 로 나간다.
       CHANGED 로 뭉개면 새 상품이 생긴다 — 외부번호 6개가 그렇게 생겼다. */
    for (const missing of [undefined, null, "  "]) {
      const cmp = compareRegisteredProduct({ ...CURRENT, leafCategoryId: missing }, payload());
      expect(cmp.category).toBe("UNKNOWN");
    }
  });

  it("보내려는 카테고리가 비어 있어도 UNKNOWN 이다", () => {
    expect(compareRegisteredProduct(CURRENT, payload({ leafCategoryId: "" })).category).toBe("UNKNOWN");
  });
});

describe("④ 🔴 못 본 것을 「같다」고 말하지 않는다", () => {
  it("notCompared 가 «항상» 비어 있지 않다 — 이 비교는 전수가 아니다", () => {
    /* GET 응답의 실제 모양을 실측한 적이 없다. 언젠가 실측되면 이 목록이
       줄어들 수 있지만, 그때까지는 비어 있다고 말하지 않는다. */
    expect(compareRegisteredProduct(CURRENT, payload()).notCompared.length).toBeGreaterThan(0);
  });

  it("읽지 못한 필드는 «변경» 이 아니라 «못 봄» 으로 간다", () => {
    /* 🔴 undefined 를 「없었다」로 읽으면 있던 것이 사라졌다고 거짓 변경을
       만들고, 셀러는 고치지도 않은 항목이 바뀐다는 말을 듣는다. */
    const blind: RegisteredProductSnapshot = { leafCategoryId: "50000167" };
    const cmp = compareRegisteredProduct(blind, payload());
    expect(cmp.changedFields).toEqual([]);
    expect(cmp.notCompared.join(" ")).toContain("상품명");
    expect(cmp.notCompared.join(" ")).toContain("읽지 못했다");
  });
});

describe("⑤ 🔴 여기서 lifecycle 을 정하지 않는다", () => {
  it("판단 낱말이 이 파일에 없다 — 판단은 resolveLifecycle 한 곳이다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(join(__dirname, "../registered-change.ts"), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const forbidden of ['"CREATE"', '"UPDATE"', '"RECREATE"', '"NOOP"', '"BLOCKED"']) {
      expect(code).not.toContain(forbidden);
    }
    expect(code).not.toContain("resolveLifecycle");
  });
});
