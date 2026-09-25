import { describe, expect, it } from "vitest";
import { compareRegisteredProduct, type FieldVerdict } from "../registered-change";
import { detectUpdateDataLoss, type RegisteredProductSnapshot } from "../update-preflight";
import type { NaverProductRegistrationPayload } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-6 / F-11b — **무엇이 바뀌었는가를 「읽어서」 안다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 근거는 「우리가 지난번에 보낸 것」이 아니라 「지금 나가 있는 것」이다.
 * 셀러가 스마트스토어 관리자에서 직접 고칠 수 있기 때문이다.
 *
 * 🔴 이 파일이 지키는 것은 정확도가 아니라 «정직함» 이다:
 *    못 본 것을 「같다」고 말하지 않는다. 거짓 CHANGED 보다 NOT_COMPARED 가 낫다.
 */

/** 지금 나가 있는 것. F-11b 승격 축까지 전부 읽힌 상태. */
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
  naverShoppingSearchInfo: { modelName: "M-1", manufacturerName: "제조사", brandName: "브랜드" },
  originAreaInfo: { originAreaCode: "03" },
  certificationTargetExcludeContent: {
    childCertifiedProductExclusionYn: true,
    kcCertifiedProductExclusionYn: "KC_EXEMPTION_OBJECT",
    kcExemptionType: "OVERSEAS",
  },
};

/** 보내려는 것 — 기본은 CURRENT 와 «같은» 내용. */
function payload(originOver: Record<string, unknown> = {}, detailOver: Record<string, unknown> = {}): NaverProductRegistrationPayload {
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
        naverShoppingSearchInfo: { modelName: "M-1", manufacturerName: "제조사", brandName: "브랜드" },
        originAreaInfo: { originAreaCode: "03" },
        certificationTargetExcludeContent: {
          childCertifiedProductExclusionYn: true,
          kcCertifiedProductExclusionYn: "KC_EXEMPTION_OBJECT",
          kcExemptionType: "OVERSEAS",
        },
        ...detailOver,
      },
      ...originOver,
    },
    smartstoreChannelProduct: {},
  } as unknown as NaverProductRegistrationPayload;
}

const changed = (p: NaverProductRegistrationPayload) => compareRegisteredProduct(CURRENT, p).changedFields;
const verdictOf = (
  cmp: ReturnType<typeof compareRegisteredProduct>,
  path: string,
): FieldVerdict | undefined => cmp.fields.find((f) => f.path === path)?.verdict;

describe("① 같으면 «차이 없음» 이다", () => {
  it("내용이 같으면 changedFields 가 비어 있다", () => {
    expect(changed(payload())).toEqual([]);
  });

  it("🔴 이미지 URL 이 달라도 «변경» 으로 세지 않는다", () => {
    /* 등록할 때마다 네이버에 다시 업로드돼 URL 이 «항상» 새 것이다. */
    expect(changed(payload())).toEqual([]);
    expect(compareRegisteredProduct(CURRENT, payload()).notCompared.join(" ")).toContain("이미지");
  });
});

describe("② 기존 9개 축은 F-11b 에서 «재설계하지 않았다»(CTO 명시)", () => {
  it("판매가격 · 상품명 · 재고 · 상세설명", () => {
    expect(changed(payload({ salePrice: 149000 }))).toContain("판매가격");
    expect(changed(payload({ name: "새 이름" }))).toContain("상품명");
    expect(changed(payload({ stockQuantity: 0 }))).toContain("재고수량");
    expect(changed(payload({ detailContent: "<p>다른 상세</p>" }))).toContain("상세설명");
  });

  it("🔴 옵션·추가이미지는 «양방향» 으로 본다 — 늘어난 것도 변경이다", () => {
    const more = payload({}, { optionInfo: { optionCombinations: [{}, {}, {}, {}, {}] } });
    expect(changed(more).join(" ")).toContain("옵션 개수(4 → 5)");
    const fewer = payload({}, { optionInfo: { optionCombinations: [{}] } });
    expect(changed(fewer).join(" ")).toContain("옵션 개수(4 → 1)");
  });
});

describe("③ 🔴 카테고리는 세 갈래다 — boolean 이 아니다", () => {
  it("같으면 SAME · 다르면 CHANGED", () => {
    expect(compareRegisteredProduct(CURRENT, payload()).category).toBe("SAME");
    expect(compareRegisteredProduct(CURRENT, payload({ leafCategoryId: "50000168" })).category).toBe("CHANGED");
  });

  it("🔴 지금 등록된 카테고리를 읽지 못했으면 UNKNOWN — 「같다」가 아니다", () => {
    for (const missing of [undefined, null, "  "]) {
      expect(compareRegisteredProduct({ ...CURRENT, leafCategoryId: missing }, payload()).category).toBe("UNKNOWN");
    }
  });

  it("🔴 GET 에 카테고리가 «있다» 는 것이 「수정할 수 있다」는 뜻이 아니다", () => {
    /* capability 는 resolveLifecycle 의 표가 정한다. 이 파일은 그것을 모른다 —
       판단 낱말이 아예 없다는 것으로 고정한다(아래 ⑦). */
    expect(compareRegisteredProduct(CURRENT, payload()).category).toBe("SAME");
  });
});

describe("④ F-11b 승격 — 실측으로 경로가 확인된 축만", () => {
  const P = {
    model: "originProduct.detailAttribute.naverShoppingSearchInfo.modelName",
    brand: "originProduct.detailAttribute.naverShoppingSearchInfo.brandName",
    origin: "originProduct.detailAttribute.originAreaInfo.originAreaCode",
    kcExclusion: "originProduct.detailAttribute.certificationTargetExcludeContent.kcCertifiedProductExclusionYn",
  } as const;

  it("GET = outgoing → UNCHANGED", () => {
    const cmp = compareRegisteredProduct(CURRENT, payload());
    for (const path of Object.values(P)) expect(verdictOf(cmp, path)).toBe("UNCHANGED");
  });

  it("GET ≠ outgoing → CHANGED", () => {
    const cmp = compareRegisteredProduct(
      CURRENT,
      payload({}, {
        naverShoppingSearchInfo: { modelName: "M-2", manufacturerName: "제조사", brandName: "브랜드" },
        originAreaInfo: { originAreaCode: "04" },
      }),
    );
    expect(verdictOf(cmp, P.model)).toBe("CHANGED");
    expect(verdictOf(cmp, P.origin)).toBe("CHANGED");
    expect(cmp.changedFields).toContain("모델명");
    expect(cmp.changedFields).toContain("원산지");
  });

  it("🔴 GET 에 값 있음 / outgoing 없음 → MISSING", () => {
    const cmp = compareRegisteredProduct(
      CURRENT,
      payload({}, { naverShoppingSearchInfo: { modelName: "M-1", manufacturerName: "제조사" } }),
    );
    expect(verdictOf(cmp, P.brand)).toBe("MISSING");
    expect(cmp.changedFields).toContain("브랜드명");
  });

  it("🔴 GET 에 값 없음 / outgoing 있음 → ADDED", () => {
    const cmp = compareRegisteredProduct(
      { ...CURRENT, naverShoppingSearchInfo: { manufacturerName: "제조사", brandName: "브랜드" } },
      payload(),
    );
    expect(verdictOf(cmp, P.model)).toBe("ADDED");
  });

  it("🔴 부모 객체를 «읽지 못했으면» NOT_COMPARED — 거짓 MISSING 을 만들지 않는다", () => {
    for (const unreadable of [undefined, null]) {
      const cmp = compareRegisteredProduct({ ...CURRENT, naverShoppingSearchInfo: unreadable }, payload());
      expect(verdictOf(cmp, P.model)).toBe("NOT_COMPARED");
      expect(verdictOf(cmp, P.brand)).toBe("NOT_COMPARED");
      /* 못 본 것을 「달라졌다」로 세지 않는다. */
      expect(cmp.changedFields).not.toContain("모델명");
    }
  });

  it('🔴 빈 문자열과 «값 없음» 을 다르게 보지 않는다 — 거짓 MISSING 방지', () => {
    /* 빌더는 빈 값을 `|| undefined` 로 걷어내는데 GET 은 "" 로 줄 수 있다. */
    const cmp = compareRegisteredProduct(
      { ...CURRENT, naverShoppingSearchInfo: { modelName: "", manufacturerName: "제조사", brandName: "브랜드" } },
      payload({}, { naverShoppingSearchInfo: { manufacturerName: "제조사", brandName: "브랜드" } }),
    );
    expect(verdictOf(cmp, P.model)).toBe("UNCHANGED");
  });
});

describe("⑤ 🔴 승격하지 «않은» 축 — GET 에 있어도 비교하지 않는다", () => {
  const notComparedText = () => compareRegisteredProduct(CURRENT, payload()).notCompared.join(" | ");
  const reasonFor = (label: string) =>
    compareRegisteredProduct(CURRENT, payload()).fields.find((f) => f.label === label)?.reason ?? "";

  it("배송/반품 정책 — 서버가 정규화한다(deliveryBundleGroupId)", () => {
    /* 우리는 null 을 보내는데 서버가 기본 그룹 ID 를 채워 돌려준다(공식 스펙).
       비교하면 아무것도 안 고쳐도 «항상» 다르다. */
    expect(notComparedText()).toContain("배송/반품 정책");
    expect(reasonFor("배송/반품 정책")).toContain("정규화");
  });

  it.each([
    ["카테고리 상품속성", "productAttributes"],
    ["KC 인증정보", "productCertificationInfos"],
    ["판매자 상품코드", "sellerManagementCode"],
  ])("%s — 비교 계약 근거 부족(CTO 확정)", (label) => {
    expect(notComparedText()).toContain(label);
    expect(reasonFor(label)).toContain("근거가 부족");
  });

  it("원산지 «부가정보»(content·importer)는 코드와 달리 비교하지 않는다", () => {
    expect(notComparedText()).toContain("원산지 부가정보");
  });

  it("🔴 NOT_COMPARED 에는 «항상» 이유가 붙는다 — 이유 없는 미비교를 남기지 않는다", () => {
    const cmp = compareRegisteredProduct({ ...CURRENT, name: undefined }, payload());
    for (const field of cmp.fields.filter((f) => f.verdict === "NOT_COMPARED")) {
      expect(field.reason, `${field.label} 에 이유가 없다`).toBeTruthy();
    }
  });

  it("notCompared 가 «항상» 비어 있지 않다 — 이 비교는 아직 전수가 아니다", () => {
    expect(compareRegisteredProduct(CURRENT, payload()).notCompared.length).toBeGreaterThan(0);
  });
});

describe("⑥ 🔴 KC 두 필드를 혼동하지 않는다", () => {
  it("«대상 제외 신고» 는 비교하고, «실제 인증정보» 는 비교하지 않는다", () => {
    const cmp = compareRegisteredProduct(CURRENT, payload());
    const exclusion = cmp.fields.find((f) => f.path.includes("certificationTargetExcludeContent"));
    const infos = cmp.fields.find((f) => f.path.includes("productCertificationInfos"));
    expect(exclusion?.verdict).not.toBe("NOT_COMPARED");
    expect(infos?.verdict).toBe("NOT_COMPARED");
  });

  it("면제 사유가 달라지면 CHANGED 다", () => {
    const cmp = compareRegisteredProduct(
      CURRENT,
      payload({}, {
        certificationTargetExcludeContent: {
          childCertifiedProductExclusionYn: true,
          kcCertifiedProductExclusionYn: "KC_EXEMPTION_OBJECT",
          kcExemptionType: "PARALLEL_IMPORT",
        },
      }),
    );
    expect(cmp.changedFields).toContain("KC 면제 사유");
  });

  it("🔴 KC «판정» 을 하지 않는다 — 상태 모델과 결합하지 않았다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(join(__dirname, "../registered-change.ts"), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const forbidden of ["KcStatus", "kcStatus", "SmartStoreKcDeclaration", "seller_compliance"]) {
      expect(code).not.toContain(forbidden);
    }
  });
});

describe("⑦ 🔴 ChangeSet 과 detectUpdateDataLoss 는 분리돼 있다", () => {
  it("여기서 lifecycle 을 정하지 않는다 — 판단 낱말이 없다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(join(__dirname, "../registered-change.ts"), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const forbidden of ['"CREATE"', '"UPDATE"', '"RECREATE"', '"NOOP"', '"BLOCKED"']) {
      expect(code).not.toContain(forbidden);
    }
    expect(code).not.toContain("resolveLifecycle");
    /* 🔴 손실 탐지를 부르지도 않는다 — 두 질문이 섞이면 서로를 가린다. */
    expect(code).not.toContain("detectUpdateDataLoss");
  });

  it("🔴 손실 방지 6축이 회귀하지 않았다 — F-11b 는 그쪽을 건드리지 않았다", () => {
    /* 상세설명·대표이미지·추가이미지·옵션·고시·판매가격. */
    const stripped = {
      originProduct: {
        ...payload().originProduct,
        detailContent: "",
        images: { representativeImage: undefined, optionalImages: [] },
        salePrice: 0,
        detailAttribute: { optionInfo: { optionCombinations: [] } },
      },
    } as unknown as NaverProductRegistrationPayload;
    const risks = detectUpdateDataLoss(CURRENT, stripped).map((r) => r.field);
    expect(risks).toContain("originProduct.detailContent");
    expect(risks).toContain("originProduct.images.representativeImage");
    expect(risks).toContain("originProduct.images.optionalImages");
    expect(risks).toContain("originProduct.detailAttribute.optionInfo");
    expect(risks).toContain("originProduct.detailAttribute.productInfoProvidedNotice");
    expect(risks).toContain("originProduct.salePrice");
    expect(risks).toHaveLength(6);
  });

  it("🔴 F-11b 승격 축은 손실 탐지에 «들어가지 않았다»", () => {
    /* 같은 스냅샷 타입을 공유하지만 보는 칸이 다르다. 새 축이 손실 판정을
       바꾸면 기존 6축 계약이 조용히 늘어난 것이다. */
    const full = payload();
    expect(detectUpdateDataLoss(CURRENT, full)).toEqual([]);
    const withoutPromoted = payload({}, {
      naverShoppingSearchInfo: undefined,
      originAreaInfo: undefined,
      certificationTargetExcludeContent: undefined,
    });
    expect(detectUpdateDataLoss(CURRENT, withoutPromoted)).toEqual([]);
    /* 그런데 ChangeSet 은 그것을 «본다» — 역할이 다르다는 증거다. */
    expect(compareRegisteredProduct(CURRENT, withoutPromoted).changedFields.length).toBeGreaterThan(0);
  });
});
