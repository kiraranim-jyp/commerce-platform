import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Sprint A ② — **`build-context` 가 「모른다」를 «01 과세» 로 메우지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 왜 «따로» 있는가 — 내 가드에 구멍이 있었다.
 *
 * 처음 쓴 Sprint A 가드 20건으로 음성 대조를 했더니 `"01"` 폴백을 «두 곳» 에
 * 되살렸는데 **한 곳만 잡혔다.**
 *
 *     BLANK_LOTTEON_CHANNEL_CONFIG.taxTypeCode = "01"   → 잡혔다 (DATA 단 검사)
 *     build-context  `trimOrNull(form.taxTypeCode) ?? "01"`  → 🔴 «안 잡혔다»
 *
 * 앞의 것은 상수라 직접 읽을 수 있었고, 뒤의 것은 «함수를 통과시켜야만» 드러난다.
 * 그런데 내 검사는 payload 빌더에 `channel` 을 직접 넘겼기 때문에 build-context 를
 * 아예 지나치지 않았다 — 실제 등록 경로는 라우트 → build-context → 빌더다.
 *
 * 🔴 이것이 이 스프린트에서 같은 계열로 «네 번째» 다:
 *   조건이 발동하지 않음 · 표시만 보고 상태를 놓침 · 메서드를 무시함 · 경로를 건너뜀.
 * 그래서 여기서는 «실제 build-context 를 부른다». 의존성만 흉내 낸다.
 */

const fetchLotteOnIdentity = vi.fn();
const getDefaultSellerProfile = vi.fn();
const loadSellerSettings = vi.fn();
const getDefaultDescriptionTemplate = vi.fn();
const findBrandProfileByName = vi.fn();
const loadLotteOnSellerSettings = vi.fn();

vi.mock("../_lib/identity", () => ({ fetchLotteOnIdentity: () => fetchLotteOnIdentity() }));
vi.mock("../../coupang/_lib/seller-profile", () => ({
  getDefaultSellerProfile: () => getDefaultSellerProfile(),
}));
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

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

/** 등록 경로가 실제로 넘기는 최소 상품. */
function product() {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("d"),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field("Bobo Choses S.L."),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(30),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043"),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
  } as never;
}

/** 롯데ON 탭이 넘기는 폼. `taxTypeCode` 만 바꿔 가며 본다. */
function form(taxTypeCode: string) {
  return {
    standardCategoryNo: "BC63080300",
    displayCategoryNos: ["FC11130203"],
    originCode: "ES",
    taxTypeCode,
    brandNo: "",
    externalProductNo: "",
    noticeItemCode: "23",
    noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "네이비" }],
    safetyCertifications: [],
    importProxyCode: "",
    categoryAttributes: [],
    outboundPlaceNo: "PLO3837441",
    returnPlaceNo: "PLO3837441",
    deliveryCostPolicyNo: "4279402",
    deliveryRegionGroupCode: "GN101",
    courierCode: "0004",
    returnCourierCode: "0004",
    weekdayCloseTime: "1400",
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
  loadSellerSettings.mockResolvedValue({ source: "SELLER_SETTINGS", failed: false, importer: null });
  getDefaultDescriptionTemplate.mockResolvedValue(null);
  findBrandProfileByName.mockResolvedValue(null);
});

/* 🔴 반환 모양은 `{ input, identityError, sellerSettingsError }` 다 —
   채널 설정은 `context.input.channel` 안에 있다. 처음에 `context.channel` 로
   써서 4건이 한꺼번에 깨졌다. 모양을 추측하지 말고 타입을 읽어야 했다. */
async function contextFor(taxTypeCode: string) {
  const mod = await import("../_lib/build-context");
  return mod.buildLotteOnContext(product(), form(taxTypeCode));
}

describe("🔴 과세 — 폼이 비면 build-context 가 «메우지 않는다»", () => {
  it("빈 값은 빈 값으로 나온다 — 01 로 바뀌지 않는다", async () => {
    const context = await contextFor("");
    /* 🔴 예전에는 `?? "01"` 이라 여기서 「과세」가 되어 나갔다.
       면세 상품이면 과세 상품으로 잘못 등록된다. */
    expect(context.input.channel.taxTypeCode).toBe("");
  });

  it("공백만 있어도 메우지 않는다", async () => {
    const context = await contextFor("   ");
    expect(context.input.channel.taxTypeCode).toBe("");
  });

  it("셀러가 고른 값은 그대로 간다", async () => {
    const context = await contextFor("02");
    expect(context.input.channel.taxTypeCode).toBe("02");
  });
});

describe("🔴 브랜드·업체상품번호 — 화면이 묻지 않으므로 «비어서» 온다", () => {
  it("빈 폼 값은 null 로 정규화되어 payload 키가 빠진다", async () => {
    const context = await contextFor("01");
    expect(context.input.channel.brandNo ?? null).toBeNull();
    expect(context.input.channel.externalProductNo ?? null).toBeNull();
  });
});
