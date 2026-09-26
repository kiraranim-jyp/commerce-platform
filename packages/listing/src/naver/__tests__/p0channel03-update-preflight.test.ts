import { describe, expect, it } from "vitest";
import {
  detectUpdateDataLoss,
  isSameOriginProduct,
  type RegisteredProductSnapshot,
} from "../update-preflight";
import type { NaverProductRegistrationPayload } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-2 — **수정이 «지우지» 않게 막는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 공식 계약: 「요청 메시지에 «포함하지 않은 정보는 제거»하는 행동으로
 * 동작하며, 유지하려는 정보 역시 그대로 구성하여 호출해야 합니다.」
 *
 * 🔴 PATCH 가 아니라 전체 «교체» 다. 바뀐 것만 보내면 나머지가 지워지고,
 * 네이버는 200 을 준다 — 실제 판매 중인 상품의 상세설명·이미지가 사라진
 * 채 우리는 «성공» 으로 기록한다. 이 파일이 그 경로를 막는다.
 */

/**
 * 현재 실제로 나가 있는 상품(13713593585 을 본뜬 모양).
 *
 * 🔴 F-14-6a — `smartstoreChannelProduct` 가 «추가됐다». F-14-6 실측에서 GET
 * 응답의 최상위 키가 둘(originProduct · smartstoreChannelProduct)이라는 것이
 * 드러났고, 전시 상태를 모른 채 보내면 판매 중인 상품이 전시 중지가 될 수
 * 있다. 그래서 이 축이 «없는» 스냅샷은 이제 통과하지 못한다 — 그 계약은
 * ⑤에서 따로 고정한다.
 */
const CURRENT: RegisteredProductSnapshot = {
  detailContent: "<p>상세설명</p>",
  representativeImageUrl: "https://example.com/rep.jpg",
  optionalImageCount: 6,
  optionCombinationCount: 5,
  hasProvidedNotice: true,
  salePrice: 147900,
  smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
};

/** 유지할 것을 «전부» 담은 온전한 payload. */
const full = (over: Record<string, unknown> = {}): NaverProductRegistrationPayload =>
  ({
    originProduct: {
      detailContent: "<p>상세설명</p>",
      salePrice: 147900,
      images: {
        representativeImage: { url: "https://example.com/rep.jpg" },
        optionalImages: Array.from({ length: 6 }, (_, i) => ({ url: `https://example.com/${i}.jpg` })),
      },
      detailAttribute: {
        productInfoProvidedNotice: { productInfoProvidedNoticeType: "KIDS", kids: {} },
        optionInfo: { optionCombinations: Array.from({ length: 5 }, () => ({})) },
      },
      ...over,
    },
    /* 🔴 F-14-6a — 「유지할 것을 전부 담았다」는 말에 전시 상태도 포함된다.
       UPDATE 에서 빌더가 실제로 이렇게 만든다(registeredChannelProduct 입력). */
    smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
  }) as unknown as NaverProductRegistrationPayload;

describe("① 온전한 payload 는 통과한다", () => {
  it("유지할 것을 전부 담았으면 위험 0", () => {
    expect(detectUpdateDataLoss(CURRENT, full())).toEqual([]);
  });

  it("값이 «바뀐» 것은 손실이 아니다 — 가격 인상은 정상 수정", () => {
    expect(detectUpdateDataLoss(CURRENT, full({ salePrice: 159000 }))).toEqual([]);
  });

  it("이미지/옵션이 «늘어나는» 것도 손실이 아니다", () => {
    const more = full({
      images: {
        representativeImage: { url: "https://example.com/rep.jpg" },
        optionalImages: Array.from({ length: 8 }, () => ({ url: "x" })),
      },
    });
    expect(detectUpdateDataLoss(CURRENT, more)).toEqual([]);
  });
});

describe("② 🔴 있던 것이 없어지면 «막는다»", () => {
  const lost = (p: NaverProductRegistrationPayload) => detectUpdateDataLoss(CURRENT, p).map((r) => r.field);

  it("상세설명이 빠지면 — 상품 페이지가 비어 버린다", () => {
    expect(lost(full({ detailContent: "" }))).toContain("originProduct.detailContent");
  });

  it("대표 이미지가 빠지면 — 목록에 아무것도 안 보인다", () => {
    expect(lost(full({ images: { optionalImages: [] } }))).toContain(
      "originProduct.images.representativeImage",
    );
  });

  it("🔴 추가 이미지가 «줄어드는» 것도 손실이다", () => {
    const fewer = full({
      images: {
        representativeImage: { url: "https://example.com/rep.jpg" },
        optionalImages: [{ url: "x" }],
      },
    });
    const risk = detectUpdateDataLoss(CURRENT, fewer).find((r) => r.field.includes("optionalImages"));
    expect(risk?.reason).toBe("EMPTIED");
    expect(risk?.label).toContain("6 → 1");
  });

  it("🔴 옵션이 줄어들면 — 팔던 사이즈가 사라진다", () => {
    const fewer = full({
      detailAttribute: {
        productInfoProvidedNotice: { productInfoProvidedNoticeType: "KIDS", kids: {} },
        optionInfo: { optionCombinations: [{}] },
      },
    });
    const risk = detectUpdateDataLoss(CURRENT, fewer).find((r) => r.field.includes("optionInfo"));
    expect(risk?.reason).toBe("EMPTIED");
    expect(risk?.label).toContain("5 → 1");
  });

  it("🔴 상품정보제공고시가 빠지면 — 법적 고지가 사라진다", () => {
    const noNotice = full({
      detailAttribute: { optionInfo: { optionCombinations: Array.from({ length: 5 }, () => ({})) } },
    });
    expect(lost(noNotice)).toContain(
      "originProduct.detailAttribute.productInfoProvidedNotice",
    );
  });

  it("🔴 salePrice 는 «수정 시에도 필수» 다 (공식 문의 #1903)", () => {
    expect(lost(full({ salePrice: undefined }))).toContain("originProduct.salePrice");
    expect(lost(full({ salePrice: 0 }))).toContain("originProduct.salePrice");
  });

  it("여러 개가 동시에 빠지면 전부 보고한다 — 하나만 고치고 다시 누르지 않게", () => {
    const broken = detectUpdateDataLoss(CURRENT, {
      originProduct: { salePrice: 147900 },
    } as unknown as NaverProductRegistrationPayload);
    expect(broken.length).toBeGreaterThanOrEqual(4);
  });
});

describe("③ 🔴 빠진 값을 «채우지» 않는다", () => {
  it("무엇이 빠졌는지 말할 뿐이다 — 추측으로 메우면 그것도 손실이다", () => {
    const risks = detectUpdateDataLoss(CURRENT, full({ detailContent: "" }));
    for (const r of risks) {
      expect(r).toHaveProperty("field");
      expect(r).toHaveProperty("label");
      expect(r).not.toHaveProperty("suggestedValue");
      expect(r).not.toHaveProperty("autoFill");
    }
  });
});

describe("④ 🔴 응답 상품번호가 다르면 성공이 아니다", () => {
  it("같으면 통과", () => {
    expect(isSameOriginProduct("13713593585", "13713593585")).toBe(true);
    expect(isSameOriginProduct("13713593585", 13713593585)).toBe(true);
    expect(isSameOriginProduct("13713593585", " 13713593585 ")).toBe(true);
  });

  it("🔴 다르면 실패 — UPDATE 인 줄 알았는데 새 상품이 생긴 것이다", () => {
    /* 그대로 성공 처리하면 우리는 모르는 채 중복을 하나 더 만든다.
       이 프로젝트가 이미 그렇게 SmartStore 외부번호 6개를 만들었다. */
    expect(isSameOriginProduct("13713593585", "13713593586")).toBe(false);
  });

  it("응답에 번호가 «없으면» 성공이 아니다 — 없는 것을 같다고 하지 않는다", () => {
    expect(isSameOriginProduct("13713593585", null)).toBe(false);
    expect(isSameOriginProduct("13713593585", undefined)).toBe(false);
    expect(isSameOriginProduct("13713593585", "")).toBe(false);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑤ P0-CHANNEL-03 F-14-6a — **전시 상태를 보존한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-14-6 실측에서 GET 최상위 키가 «둘» 이라는 것이 드러났다. 그동안 이 축은
 * 손실검사에도 변경감지에도 «없었고», 빌더는 그 자리를 SUSPENSION 고정값으로
 * 채워 보냈다 — 판매 중인 상품을 고치면 전시 상태까지 덮였다.
 *
 * 🔴 여기서 막는 것은 「사라짐」이 아니라 「바뀜」이다. 데이터는 그대로인데
 * 상품이 «안 보이게» 되고, 셀러는 가격 하나 고쳤을 뿐이다.
 */
describe("⑤ 🔴 F-14-6a — 전시 상태", () => {
  const withDisplay = (status: string | undefined) =>
    ({
      ...full(),
      smartstoreChannelProduct: status === undefined ? {} : { channelProductDisplayStatusType: status },
    }) as unknown as NaverProductRegistrationPayload;

  const displayRisks = (current: RegisteredProductSnapshot, next: NaverProductRegistrationPayload) =>
    detectUpdateDataLoss(current, next).filter((risk) =>
      risk.field.startsWith("smartstoreChannelProduct"),
    );

  it("B. 판매 중(ON)을 그대로 되보내면 통과한다", () => {
    expect(displayRisks(CURRENT, withDisplay("ON"))).toEqual([]);
  });

  it("C. 전시 중지(SUSPENSION)를 그대로 되보내면 통과한다", () => {
    const suspended: RegisteredProductSnapshot = {
      ...CURRENT,
      smartstoreChannelProduct: { channelProductDisplayStatusType: "SUSPENSION" },
    };
    expect(displayRisks(suspended, withDisplay("SUSPENSION"))).toEqual([]);
  });

  it("D. 🔴 지금 상태를 «읽지 못했으면» 막는다 — 추정하지 않는다", () => {
    /* smartstoreChannelProduct 자체가 없는 경우(예전 스냅샷 모양). */
    const unread: RegisteredProductSnapshot = { ...CURRENT, smartstoreChannelProduct: undefined };
    const risks = displayRisks(unread, withDisplay("SUSPENSION"));
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ reason: "MISSING" });
    expect(risks[0]?.label).toContain("읽지 못했습니다");
    /* 🔴 ON 으로도 SUSPENSION 으로도 추정하지 않는다 — 어느 쪽을 보내도 막힌다. */
    expect(displayRisks(unread, withDisplay("ON"))).toHaveLength(1);
  });

  it("D-2. 🔴 되보낼 수 «없는» 값(WAIT 등 응답 전용)도 막는다", () => {
    /* 스펙상 입력 가능한 값은 ON·SUSPENSION 둘뿐이다. WAIT 를 읽었다면 우리는
       그것을 보존할 수단이 없고, 대신 SUSPENSION 을 보내는 것이 바로 사고다. */
    const waiting: RegisteredProductSnapshot = {
      ...CURRENT,
      smartstoreChannelProduct: { channelProductDisplayStatusType: "WAIT" },
    };
    expect(displayRisks(waiting, withDisplay("WAIT"))).toHaveLength(1);
  });

  it("E. 🔴 ON 인데 SUSPENSION 을 보내면 «막는다» — 이것이 이번에 찾은 결함이다", () => {
    const risks = displayRisks(CURRENT, withDisplay("SUSPENSION"));
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({
      field: "smartstoreChannelProduct.channelProductDisplayStatusType",
      reason: "CHANGED",
    });
    /* 🔴 셀러의 말로 적는다 — 「SUSPENSION」은 우리 말이다. */
    expect(risks[0]?.label).toContain("판매 중");
    expect(risks[0]?.label).toContain("전시 중지");
  });

  it("E-2. 전시 상태를 «아예 안 보내는» 것도 막는다 — 전체 교체다", () => {
    const noChannel = { ...full(), smartstoreChannelProduct: undefined } as unknown as NaverProductRegistrationPayload;
    expect(displayRisks(CURRENT, noChannel)).toHaveLength(1);
  });

  it("🔴 위험이 하나라도 있으면 PUT 을 호출하지 않는다는 계약 그대로다", () => {
    /* detectUpdateDataLoss 가 «비어 있어야만» 보낸다(update-product.ts).
       그래서 이 축 하나만으로도 전송이 멈춘다. */
    expect(detectUpdateDataLoss(CURRENT, withDisplay("SUSPENSION")).length).toBeGreaterThan(0);
  });
});
