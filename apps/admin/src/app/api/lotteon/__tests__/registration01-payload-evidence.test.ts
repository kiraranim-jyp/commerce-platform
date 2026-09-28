import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REGISTRATION-01 / 2차 — **API 87 에 «무엇을» 보내는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-09-28): 화면보다 먼저, 등록 직전 payload 와 BLOCK 원인을 확정한다.
 *
 * 이 파일은 `register/route.ts` 가 하는 것을 «같은 순서로» 한다 —
 *
 *     157  buildLotteOnContext(product, channel)
 *     188  validateLotteOnPayload(context.input)
 *     189  buildLotteOnPayload(context.input)
 *     289  (여기서 API 87 로 나간다 — 우리는 여기까지만 간다)
 *
 * 🔴 외부 호출은 하지 않는다. 그리고 이 파일은 «증거» 라서, 통과 여부만이 아니라
 * 실제로 실려 나가는 항목을 출력한다.
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

/** 🔴 Production 화면에서 확인된 그 상품이다. 값을 보태지 않았다. */
function product(overrides: Record<string, unknown> = {}) {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Watercolor All Over Cropped Sweatshirt by Bobo Choses"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC040"),
    description: field("d"),
    material: field("17% Recycled Cotton"),
    color: field("Lavender"),
    /* 화면이 「상품정보에 아직 없습니다」라고 말한 칸들 — 비워 둔다. */
    recommendedAge: field(""),
    itemName: field(""),
    modelName: field(""),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years", "12-13 Years"] }],
    /* 🔴 실제 상품에는 옵션 6개와 이미지가 있다. 비워 두면 「옵션 없음 ·
       대표 이미지 없음」이 BLOCK 으로 잡혀서 «진짜» 막는 것이 무엇인지 흐려진다
       (처음 이 파일을 비운 채로 돌렸다가 그 두 개가 섞여 나왔다). */
    variants: ["2-3 Years", "4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years", "12-13 Years"].map((size, index) => ({
      id: `v${index}`,
      optionValues: { Size: size },
      stockQuantity: 5,
    })),
    images: [
      {
        id: "i1",
        originalUrl: "https://example.com/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("수채화 올오버 크롭 스웨트셔츠"),
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
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
    ...overrides,
  } as never;
}

/** 화면이 지금 보내고 있는 폼. 🔴 원산지와 KC 는 비어 있다(화면 그대로). */
function form(overrides: Record<string, unknown> = {}) {
  return {
    standardCategoryNo: "BC63080300",
    displayCategoryNos: ["FC11130203"],
    originCode: "",
    taxTypeCode: "01",
    brandNo: "",
    externalProductNo: "",
    noticeItemCode: "23",
    noticeArticles: [],
    safetyCertifications: [],
    importProxyCode: "",
    outboundPlaceNo: "PLO3837441",
    returnPlaceNo: "PLO3837441",
    deliveryCostPolicyNo: "4279402",
    deliveryRegionGroupCode: "GN000",
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

/** 라우트와 «같은 순서» 로 만든다. */
async function pipeline(p = product(), f = form()) {
  const { buildLotteOnContext } = await import("../_lib/build-context");
  const { buildLotteOnPayload, validateLotteOnPayload } = await import("@commerce/listing");
  const context = await buildLotteOnContext(p, f);
  return {
    validation: validateLotteOnPayload(context.input),
    payload: buildLotteOnPayload(context.input) as Record<string, unknown>,
  };
}

/** payload 는 `{ spdLst: [등록 1건] }` 이다 — 고시는 그 안에 있다. */
const notice = (payload: Record<string, unknown>) => {
  const first = (payload.spdLst as Record<string, unknown>[] | undefined)?.[0] ?? {};
  return (first.pdItmsInfo ?? {}) as { pdItmsCd?: string; pdItmsArtlLst?: { pdArtlCd: string; pdArtlCnts: string }[] };
};

describe("① API 87 로 나가는 고시 블록", () => {
  it("🔴 pdItmsCd 와 pdItmsArtlLst 가 실제로 실린다 — 증거를 출력한다", async () => {
    const { payload, validation } = await pipeline();
    const block = notice(payload);

    /* eslint-disable no-console */
    console.log("\n===== API 87 직전 · pdItmsInfo =====");
    console.log("pdItmsCd =", block.pdItmsCd);
    for (const article of block.pdItmsArtlLst ?? []) {
      console.log(`  ${article.pdArtlCd}  ${article.pdArtlCnts}`);
    }
    console.log("===== Readiness =====");
    for (const item of validation.fields) {
      console.log(`  ${item.status.padEnd(8)} ${item.field.padEnd(16)} ${item.label}`);
    }
    /* eslint-enable no-console */

    expect(block.pdItmsCd).toBe("23");
    expect((block.pdItmsArtlLst ?? []).length).toBeGreaterThan(0);
  });

  it("실린 항목은 «전부» 코드와 값을 갖는다 — 빈 항목이 섞이지 않는다", async () => {
    const { payload } = await pipeline();
    for (const article of notice(payload).pdItmsArtlLst ?? []) {
      expect(article.pdArtlCd.trim()).not.toBe("");
      expect(article.pdArtlCnts.trim()).not.toBe("");
    }
  });
});

describe("🔴 ② 검증기는 13개를 요구하지 «않는다» — 내가 틀렸던 부분이다", () => {
  it("항목이 7개여도 고시 항목(pdItmsArtlLst)은 READY 가 된다", async () => {
    const { validation, payload } = await pipeline();
    const list = notice(payload).pdItmsArtlLst ?? [];
    expect(list.length).toBeLessThan(13);

    const articles = (validation.fields).find((item) => item.field === "pdItmsArtlLst");
    expect(articles?.status).toBe("READY");
  });

  it("고시 항목이 «하나도 없으면» 그때는 막는다", async () => {
    /* 품목을 모르는 값으로 두면 resolver 가 아무것도 만들지 않는다. */
    const { validation } = await pipeline(product(), form({ noticeItemCode: "01" }));
    const articles = (validation.fields).find((item) => item.field === "pdItmsArtlLst");
    expect(articles?.status).not.toBe("READY");
  });
});

describe("🔴 ③ 그래서 지금 실제로 막는 것은 무엇인가", () => {
  it("남은 BLOCK 을 이름으로 고정한다", async () => {
    const { validation } = await pipeline();
    const blocked = (validation.fields)
      .filter((item) => item.status !== "READY")
      .map((item) => item.field)
      .sort();
    /* eslint-disable-next-line no-console */
    console.log("\n===== 아직 READY 가 아닌 항목 =====\n ", blocked.join(", "));

    /* 원산지코드와 안전인증(KC)이다. 고시 «항목» 이 아니다. */
    expect(blocked).toContain("oplcCd");
    expect(blocked).toContain("sftyAthnLst");
    expect(blocked).not.toContain("pdItmsArtlLst");
  });

  it("셀러가 원산지와 KC 를 채우면 남는 BLOCK 이 없다", async () => {
    const { validation } = await pipeline(
      product(),
      form({
        originCode: "ES",
        safetyCertifications: [{ sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789" }],
        importProxyCode: "PUR_PRX",
      }),
    );
    const blocked = (validation.fields).filter((item) => item.status !== "READY").map((item) => item.field);
    /* eslint-disable-next-line no-console */
    console.log("\n===== 원산지·KC 를 채운 뒤 남은 항목 =====\n ", blocked.join(", ") || "(없음)");
    expect(blocked).toHaveLength(0);
  });
});

describe("🔴 ④ 채우지 못한 6항목은 payload 에 «흔적도» 없다", () => {
  it.each(["0210", "0200", "0790", "0220", "1830", "0090"])("%s 는 실리지 않는다", async (code) => {
    const { payload } = await pipeline();
    expect((notice(payload).pdItmsArtlLst ?? []).find((a) => a.pdArtlCd === code)).toBeUndefined();
  });

  it("빈 문자열로 «자리만» 채우지도 않는다", async () => {
    const { payload } = await pipeline();
    const body = JSON.stringify(notice(payload).pdItmsArtlLst ?? []);
    expect(body).not.toContain('"pdArtlCnts":""');
  });
});
