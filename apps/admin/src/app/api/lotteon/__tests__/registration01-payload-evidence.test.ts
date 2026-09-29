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
    payload: buildLotteOnPayload(context.input) as unknown as Record<string, unknown>,
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

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ② 롯데ON 은 고시 «전 항목» 을 요구한다 — 실측이 내 판단을 뒤집었다
   ════════════════════════════════════════════════════════════════════════════

   이 자리에는 「검증기는 13개를 요구하지 «않는다»」가 있었다. 근거는 우리
   검증기가 그렇게 «동작한다» 는 것뿐이었지, 롯데ON 이 그렇다는 근거가 아니었다.

   첫 실제 CREATE 가 답했다(2026-09-29, CEO 실행):

       returnCode 0000  정상 처리되었습니다
                 9999  상품품목항목코드 필수값이 누락입니다
       판매자상품번호(spdNo) 없음 = **등록되지 않았다**

   10개를 실어 보냈고 3개(0220 동일모델 출시년월 · 1830 크기·체중의 한계 ·
   0090 A/S 책임자와 전화번호)가 비어 있었다.

   🔴 그래서 검사를 뒤집는다. 「화면은 통과인데 등록은 실패」가 이 저장소가
   가장 비싸게 겪어 온 상태이고, 이번이 그 교과서적 사례다.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("🔴 ② 고시 항목이 하나라도 비면 «보내기 전에» 막는다", () => {
  const noticeField = (validation: { fields: { field: string; status: string; reason?: string }[] }) =>
    validation.fields.find((item) => item.field === "pdItmsArtlLst");

  it("10개만 채워진 지금 상태는 BLOCKED 다 — 9999 를 다시 받지 않는다", async () => {
    const { validation, payload } = await pipeline();
    expect((notice(payload).pdItmsArtlLst ?? []).length).toBeLessThan(13);
    expect(noticeField(validation)?.status).toBe("BLOCKED");
  });

  it("무엇이 비었는지 «이름으로» 말한다 — 셀러가 어디를 채울지 알아야 한다", async () => {
    const { validation } = await pipeline();
    const reason = noticeField(validation)?.reason ?? "";
    for (const label of ["동일모델의 출시년월", "크기ㆍ체중의 한계", "A/S 책임자와 전화번호"]) {
      expect(reason, `비어 있는 항목 이름이 안내에 없다: ${label}`).toContain(label);
    }
  });

  it("13개를 전부 채우면 READY 가 된다", async () => {
    const { validation } = await pipeline(
      product(),
      form({
        originCode: "ES",
        safetyTarget: "EXCLUDED",
        /* 🔴 값을 «지어내지» 않는다 — 셀러가 화면(0220·1830)과 설정(0090)에서
           채우는 바로 그 경로로 넣는다. */
        noticeArticles: [
          { pdArtlCd: "0220", pdArtlCnts: "2026-03" },
          { pdArtlCd: "1830", pdArtlCnts: "해당사항 없음" },
          { pdArtlCd: "0090", pdArtlCnts: "따조 고객센터 / 02-1234-5678" },
          { pdArtlCd: "0210", pdArtlCnts: "아동 스웨트셔츠 / B226AC040" },
          { pdArtlCd: "0790", pdArtlCnts: "24개월 이상" },
          { pdArtlCd: "0800", pdArtlCnts: "30도 손세탁" },
        ],
      }),
    );
    console.log("DBG reason:", noticeField(validation)?.reason);
    expect(noticeField(validation)?.status).toBe("READY");
  });

  it("고시 항목이 «하나도 없으면» 그때도 막는다", async () => {
    /* 품목을 모르는 값으로 두면 resolver 가 아무것도 만들지 않는다. */
    const { validation } = await pipeline(product(), form({ noticeItemCode: "01" }));
    expect(noticeField(validation)?.status).not.toBe("READY");
  });

  it("🔴 품목 표를 «모르는» 품목에 필수 목록을 지어내지 않는다", async () => {
    /* 모르는 품목코드라도, 실린 항목이 온전하면 «전 항목 검사» 로 막지 않는다. */
    const { validation } = await pipeline(
      product(),
      form({ noticeItemCode: "77", noticeArticles: [{ pdArtlCd: "9990", pdArtlCnts: "값" }] }),
    );
    expect(noticeField(validation)?.status).toBe("READY");
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
    /* 🔴 LOTTEON-FINAL-07 — 「고시 «항목» 이 아니다」가 틀렸다. 실측 9999 가
       고시 전 항목 필수를 확정했고, 이제 그것도 «보내기 전에» 막힌다. */
    expect(blocked).toContain("oplcCd");
    expect(blocked).toContain("sftyAthnLst");
    expect(blocked).toContain("pdItmsArtlLst");
  });

  it("셀러가 원산지와 KC 를 채우면 남는 BLOCK 이 없다", async () => {
    const { validation } = await pipeline(
      /* 🔴 고시 `0200`(KC 인증정보)은 «상품정보의 실제 인증번호» 에서 온다.
         이 검사의 뜻이 「셀러가 KC 를 채우면 풀린다」이므로, 그 칸도 채운
         상품으로 잰다 — 값을 지어내는 것이 아니라 셀러가 입력하는 자리다. */
      product({
        childCertification: field({
          certificationNumber: "CB123456789",
          companyName: "한국기계전기전자시험연구원",
          certificationDate: "2026-01-02",
        }),
      }),
      form({
        originCode: "ES",
        safetyCertifications: [{ sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789" }],
        importProxyCode: "PUR_PRX",
        /* 🔴 LOTTEON-FINAL-07 — 고시도 «셀러가» 채운다. 지어내는 값이 아니라
           고시 섹션(0220·1830…)과 판매자 설정(0090)의 입력칸으로 들어오는 값이다. */
        noticeArticles: [
          { pdArtlCd: "0220", pdArtlCnts: "2026-03" },
          { pdArtlCd: "1830", pdArtlCnts: "해당사항 없음" },
          { pdArtlCd: "0090", pdArtlCnts: "따조 고객센터 / 02-1234-5678" },
          { pdArtlCd: "0210", pdArtlCnts: "아동 스웨트셔츠 / B226AC040" },
          { pdArtlCd: "0790", pdArtlCnts: "24개월 이상" },
          { pdArtlCd: "0800", pdArtlCnts: "30도 손세탁" },
        ],
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

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ⑤ LOTTEON-FINAL-05 #2 — 신고가 «라우트를 통과해» 두 문에 다 닿는가

   이 저장소가 세 번 반복한 실수가 있다: **「인자를 만든 것」과 「넘기는 것」을
   같다고 여기는 것.** 타입 선언만 하고 호출부를 빠뜨리면 화면에서는 골랐는데
   서버는 못 본 상태가 되고, 그 차이는 실등록에서야 드러난다.

   그래서 여기서는 «라우트와 같은 순서» 로 돌려서 확인한다. 위 fixture 는
   Production 화면에서 확인된 그 상품이고, 값을 보태지 않았다.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("🔴 ⑤ 안전인증 신고가 라우트를 통과해 두 문에 다 닿는다", () => {
  const blockedFields = (validation: { fields: { field: string; status: string }[] }) =>
    validation.fields.filter((item) => item.status !== "READY").map((item) => item.field);

  it("미선택 — 예전 그대로 KC 가 막는다(고르지 않은 것을 통과시키지 않는다)", async () => {
    const { validation, payload } = await pipeline(product(), form({ originCode: "ES" }));
    expect(blockedFields(validation)).toContain("sftyAthnLst");
    /* 두 번째 문도 닫혀 있다 — 0200 이 payload 에 실리지 않는다. */
    expect((notice(payload).pdItmsArtlLst ?? []).find((a) => a.pdArtlCd === "0200")).toBeUndefined();
  });

  it("「대상 아님」 — 인증정보 없이도 남는 BLOCK 이 «없다»", async () => {
    const { validation } = await pipeline(product(), form({ originCode: "ES", safetyTarget: "EXCLUDED" }));
    console.log("\n===== 「인증 대상 아님」 신고 뒤 남은 항목 =====\n ", blockedFields(validation).join(", ") || "(없음)");
    /* 🔴 이 검사의 축은 KC «하나» 다. 고시(pdItmsArtlLst)는 별개 축이고 실측
       9999 이후 따로 막힌다 — 「남는 BLOCK 이 0」으로 적으면 고시 규칙이 바뀔
       때마다 KC 검사가 애먼 이유로 깨진다. */
    expect(blockedFields(validation)).not.toContain("sftyAthnLst");
  });

  it("「대상 아님」 — 고시 0200 이 「해당사항 없음」으로 실려 나간다", async () => {
    const { payload } = await pipeline(product(), form({ originCode: "ES", safetyTarget: "EXCLUDED" }));
    const article = (notice(payload).pdItmsArtlLst ?? []).find((a) => a.pdArtlCd === "0200");
    expect(article?.pdArtlCnts).toBe("해당사항 없음");
  });

  it("🔴 「대상 아님」이어도 인증번호를 지어내지 않는다 — sftyAthnLst 가 아예 없다", async () => {
    const { payload } = await pipeline(product(), form({ originCode: "ES", safetyTarget: "EXCLUDED" }));
    const first = (payload.spdLst as Record<string, unknown>[])[0];
    expect(first.sftyAthnLst).toBeUndefined();
  });

  it("「대상」 신고 + 인증정보 없음 — 막힌다(신고와 payload 가 어긋난 상태다)", async () => {
    const { validation } = await pipeline(product(), form({ originCode: "ES", safetyTarget: "TARGET" }));
    expect(blockedFields(validation)).toContain("sftyAthnLst");
  });

  it("「대상 아님」 + 인증정보가 같이 오면 모순으로 막는다", async () => {
    const { validation } = await pipeline(
      product(),
      form({
        originCode: "ES",
        safetyTarget: "EXCLUDED",
        safetyCertifications: [{ sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789" }],
      }),
    );
    expect(validation.fields.find((f) => f.field === "sftyAthnLst")?.code).toBe("SAFETY_DECLARATION_CONFLICT");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ⑥ LOTTEON-FINAL-06 2순위 — 「상품 상세페이지 참조」가 롯데ON 고시에 닿는가

   공통 상품정보의 「선택 N건 상세페이지 참조로 일괄 등록」은 **값을 비우고
   `source` 만 `DETAIL_PAGE_REFERENCE` 로 바꾼다.** 롯데ON 은 `product.X.value`
   «만» 읽고 있어서 그 상태를 그냥 «빈 값» 으로 봤다 — 같은 상품이 쿠팡·
   스마트스토어에서는 참조로 등록되는데 롯데ON 고시에서만 통째로 빠졌다.

   🔴 화이트리스트를 여기서 다시 정하지 않는다. 판정은 공통 모듈
   (`notice/reference-eligibility.ts`) 하나가 하고, 이 검사는 그 판정이 롯데ON
   까지 «닿는지» 만 본다.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("🔴 ⑥ 상세페이지 참조가 롯데ON 고시까지 닿는다", () => {
  /** 일괄 참조 처리가 만든 모양 — 값은 비고 source 만 바뀐다. */
  const referenced = () => ({ value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }) as never;
  const allReferenced = () =>
    product({
      material: referenced(),
      color: referenced(),
      careInstructions: referenced(),
      recommendedAge: referenced(),
      itemName: referenced(),
      modelName: referenced(),
      weight: referenced(),
      importer: referenced(),
      manufacturer: referenced(),
    });
  const articleCodes = (payload: Record<string, unknown>) =>
    (notice(payload).pdItmsArtlLst ?? []).map((a) => a.pdArtlCd);

  it("참조 처리한 항목이 「상품 상세페이지 참조」로 실려 나간다", async () => {
    const { payload } = await pipeline(allReferenced(), form({ originCode: "ES", safetyTarget: "EXCLUDED" }));
    const articles = notice(payload).pdItmsArtlLst ?? [];
    /* 색상(0020) · 소재(0410) · 제조자(0070) — 예전에는 셋 다 «빠졌다». */
    for (const code of ["0020", "0410", "0070", "0210", "0790", "0800"]) {
      expect(articles.find((a) => a.pdArtlCd === code)?.pdArtlCnts, `고시 ${code} 가 비었다`).toBe(
        "상품 상세페이지 참조",
      );
    }
  });

  it("참조 처리 뒤 고시 항목 수가 «늘어난다» — 값이 있는 상품보다 적지 않다", async () => {
    const { payload: referencedPayload } = await pipeline(
      allReferenced(),
      form({ originCode: "ES", safetyTarget: "EXCLUDED" }),
    );
    const { payload: plainPayload } = await pipeline(product(), form({ originCode: "ES", safetyTarget: "EXCLUDED" }));
    expect(articleCodes(referencedPayload).length).toBeGreaterThan(articleCodes(plainPayload).length);
  });

  it("🔴 KC(0200)는 이 길로 오지 않는다 — 인증을 「상세페이지 참조」로 얼버무리지 않는다", async () => {
    /* 인증 대상 여부를 «고르지 않은» 상태다. 참조 처리를 아무리 해도 0200 은
       채워지면 안 된다 — 실제 인증 취득 여부를 우리가 알 수 없다(N-3.45 STEP10). */
    const { payload } = await pipeline(allReferenced(), form({ originCode: "ES" }));
    expect(articleCodes(payload)).not.toContain("0200");
  });

  it("🔴 원산지(0060)도 참조로 대체되지 않는다 — 법정 표시 항목이다", async () => {
    const { payload } = await pipeline(
      allReferenced(),
      form({ originCode: "ES", safetyTarget: "EXCLUDED" }),
    );
    const origin = (notice(payload).pdItmsArtlLst ?? []).find((a) => a.pdArtlCd === "0060");
    expect(origin?.pdArtlCnts).not.toBe("상품 상세페이지 참조");
  });
});
