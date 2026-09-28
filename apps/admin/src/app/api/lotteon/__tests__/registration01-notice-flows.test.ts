import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REGISTRATION-01 — 고시 항목이 «payload 까지» 흐르는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 resolver 단위 테스트(`notice-resolve.test.ts`)만으로는 이 배선을 증명하지
 * 못한다. 실제 등록 경로는 라우트 → `build-context` → 빌더다. 이 스프린트에서
 * 같은 계열의 공허한 가드를 네 번 만들었고, 그중 하나가 정확히
 * 「payload 빌더에 channel 을 직접 넘겨 build-context 를 건너뛴」 것이었다.
 *
 * 그래서 여기서는 **실제 `buildLotteOnContext` 를 부른다.** 의존성만 흉내 낸다.
 */

const fetchLotteOnIdentity = vi.fn();
const getDefaultSellerProfile = vi.fn();
const loadSellerSettings = vi.fn();
const getDefaultDescriptionTemplate = vi.fn();
const findBrandProfileByName = vi.fn();
const loadLotteOnSellerSettings = vi.fn();

vi.mock("../_lib/identity", () => ({ fetchLotteOnIdentity: () => fetchLotteOnIdentity() }));
vi.mock("../../coupang/_lib/seller-profile", () => ({ getDefaultSellerProfile: () => getDefaultSellerProfile() }));
vi.mock("@/lib/seller-settings", () => ({
  SELLER_SETTINGS_UNAVAILABLE_MESSAGE: "판매자 설정을 읽지 못했습니다.",
  loadSellerSettings: () => loadSellerSettings(),
}));
vi.mock("../../coupang/_lib/description-template", () => ({
  getDefaultDescriptionTemplate: () => getDefaultDescriptionTemplate(),
}));
vi.mock("../../coupang/_lib/brand-profile", () => ({
  findBrandProfileByName: (name: string) => findBrandProfileByName(name),
}));
vi.mock("../_lib/seller-settings", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, loadLotteOnSellerSettings: () => loadLotteOnSellerSettings() };
});

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

/** 지금 실제로 등록하려는 아동 반바지. */
function product(overrides: Record<string, unknown> = {}) {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Watercolor All Over Cropped Sweatshirt"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC040"),
    description: field("d"),
    material: field("17% Recycled Cotton"),
    color: field("Lavender"),
    recommendedAge: field(""),
    manufacturer: field("Bobo Choses S.L."),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["2-3 Years", "4-5 Years", "6-7 Years"] }],
    variants: [],
    images: [],
    titleKo: field("수채화 크롭 스웨트셔츠"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("Spain"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(30),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
    ...overrides,
  } as never;
}

function form(overrides: Record<string, unknown> = {}) {
  return {
    standardCategoryNo: "BC63080300",
    displayCategoryNos: ["FC11130203"],
    originCode: "ES",
    taxTypeCode: "01",
    brandNo: "",
    externalProductNo: "",
    noticeItemCode: "23",
    /* 🔴 폼은 «비어 있다». 이 파일이 재는 것은 공통에서 오는 값이다. */
    noticeArticles: [],
    safetyCertifications: [],
    importProxyCode: "",
    outboundPlaceNo: "PLO3837441",
    returnPlaceNo: "PLO3837441",
    deliveryCostPolicyNo: "4279402",
    deliveryRegionGroupCode: "GN101",
    courierCode: "0004",
    returnCourierCode: "0004",
    weekdayCloseTime: "1400",
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.resetModules();
  for (const m of [
    fetchLotteOnIdentity,
    getDefaultSellerProfile,
    loadSellerSettings,
    getDefaultDescriptionTemplate,
    findBrandProfileByName,
    loadLotteOnSellerSettings,
  ]) {
    m.mockReset();
  }
  fetchLotteOnIdentity.mockResolvedValue({ ok: true, identity: { trGrpCd: "SR", trNo: "LO10179008" } });
  getDefaultSellerProfile.mockResolvedValue(null);
  loadSellerSettings.mockResolvedValue({
    source: "SELLER_SETTINGS",
    failed: false,
    manufacturer: null,
    importer: null,
    asContactNumber: "+821046458306",
    qualityGuarantee: "소비자분쟁해결기준에 따름",
    kcExemptionText: null,
    defaultCountryOfOrigin: null,
  });
  getDefaultDescriptionTemplate.mockResolvedValue(null);
  findBrandProfileByName.mockResolvedValue(null);
  loadLotteOnSellerSettings.mockResolvedValue({});
});

async function articles(p = product(), f = form()) {
  const { buildLotteOnContext } = await import("../_lib/build-context");
  const context = await buildLotteOnContext(p, f);
  return context.input.channel.noticeArticles;
}

describe("① 공통 값이 «payload 까지» 간다", () => {
  it.each([
    ["0020", "Lavender"],
    ["0410", "17% Recycled Cotton"],
    ["0060", "Spain"],
    ["0800", "30도 손세탁"],
    ["0080", "소비자분쟁해결기준에 따름"],
    ["0070", "Bobo Choses S.L."],
  ])("%s 가 실려 나간다", async (code, value) => {
    const list = await articles();
    expect(list.find((a) => a.pdArtlCd === code)?.pdArtlCnts).toBe(value);
  });

  it("🔴 0780 크기·중량은 사이즈 옵션의 «치수» 로 간다", async () => {
    const list = await articles();
    expect(list.find((a) => a.pdArtlCd === "0780")?.pdArtlCnts).toBe("2-3 Years, 4-5 Years, 6-7 Years");
  });
});

describe("🔴 ② 채울 수 없는 것은 «실리지 않는다»", () => {
  it.each(["0210", "0790", "0220", "1830", "0090", "0200"])("%s 는 payload 에 없다", async (code) => {
    const list = await articles();
    expect(list.find((a) => a.pdArtlCd === code)).toBeUndefined();
  });

  it("사이즈 옵션이 있어도 사용연령(0790)을 만들지 않는다", async () => {
    const list = await articles();
    const body = JSON.stringify(list);
    /* 치수로는 나가지만(0780), 연령 항목으로는 나가지 않는다. */
    expect(body).toContain("6-7 Years");
    expect(list.find((a) => a.pdArtlCd === "0790")).toBeUndefined();
  });

  it("SKU 가 있어도 모델명(0210)을 만들지 않는다", async () => {
    const list = await articles();
    expect(JSON.stringify(list)).not.toContain("B226AC040");
  });

  it("A/S 연락처만으로 0090 을 채우지 않는다 — 제조사를 업체명으로 쓰지도 않는다", async () => {
    const list = await articles();
    expect(list.find((a) => a.pdArtlCd === "0090")).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain("+821046458306");
  });
});

describe("③ 셀러가 확정한 값이 «먼저» 다", () => {
  it("폼에 있는 코드는 공통이 덮지 않는다", async () => {
    const list = await articles(product(), form({ noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "라벤더(셀러 확정)" }] }));
    const color = list.filter((a) => a.pdArtlCd === "0020");
    expect(color).toHaveLength(1);
    expect(color[0].pdArtlCnts).toBe("라벤더(셀러 확정)");
  });

  it("폼에 없는 코드는 공통이 채운다 — 같은 요청에서 둘이 «함께» 나간다", async () => {
    const list = await articles(product(), form({ noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "라벤더(셀러 확정)" }] }));
    expect(list.find((a) => a.pdArtlCd === "0410")?.pdArtlCnts).toBe("17% Recycled Cotton");
  });
});

describe("🔴 ④ 모르는 품목이면 아무것도 만들지 않는다", () => {
  it("품목 01 은 표를 아직 들이지 않았다 — 빈 목록이 나간다", async () => {
    const list = await articles(product(), form({ noticeItemCode: "01" }));
    expect(list).toHaveLength(0);
  });

  it("품목코드가 비어 있어도 마찬가지다", async () => {
    const list = await articles(product(), form({ noticeItemCode: "" }));
    expect(list).toHaveLength(0);
  });
});

describe("⑤ 값이 생기면 그때 실린다", () => {
  it("상품정보에 사용연령이 들어오면 0790 이 나간다", async () => {
    const list = await articles(product({ recommendedAge: field("4-5세") }));
    expect(list.find((a) => a.pdArtlCd === "0790")?.pdArtlCnts).toBe("4-5세");
  });

  it("품명과 모델명이 «둘 다» 들어오면 0210 이 나간다", async () => {
    const list = await articles(product({ itemName: field("아동용 스웨트셔츠"), modelName: field("B226AC040") }));
    expect(list.find((a) => a.pdArtlCd === "0210")?.pdArtlCnts).toBe("아동용 스웨트셔츠 / B226AC040");
  });
});
