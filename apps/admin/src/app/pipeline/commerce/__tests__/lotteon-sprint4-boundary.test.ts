import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import {
  buildLotteOnMissingInfo,
  buildLotteOnSafetyLineFromCommon,
  collectLotteOnNoticeSourceValues,
  computeLotteOnRegistrationReadiness,
  type LotteOnValidationSnapshot,
} from "../lotteon-channel-form";
import {
  LOTTEON_SAFETY_FLAG_TO_TYPE_CODE,
  buildLotteOnCategoryPath,
  parseLotteOnDisplayCategory,
  parseLotteOnStandardCategory,
  recommendLotteOnStandardCategories,
  type LotteOnStandardCategory,
} from "../lotteon-category";

/**
 * LOTTEON COMMERCE SPRINT 4(CEO 확정, 2026-09-14) — 이 파일이 지키는 명제는
 * 넷이다.
 *
 *  ① 경계     롯데ON 탭이 부족하다고 말하는 것 중 **공통 상품정보는 상품정보
 *             탭으로 보낸다.** 채널 탭에서 고치라고 하지 않는다.
 *  ② 단일판정 등록 가능성은 서버 검증 결과를 **세기만** 한다 — 화면이 자기
 *             규칙으로 퍼센트를 만들지 않는다.
 *  ③ 재입력금지 상품정보에 이미 있는 값(소재·색상·제조사·KC인증)을 롯데ON
 *             탭이 다시 묻지 않는다.
 *  ④ 필드명   onpick 205/206 파싱은 **문서 원문 필드**로만 한다.
 */

/* ── 테스트 픽스처 ───────────────────────────────────────────────────────── */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/en/kids/girl/shorts/terry-bermuda",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts for kids."),
    material: field("면 100%"),
    color: field("아이보리"),
    recommendedAge: field("4-5세"),
    manufacturer: field("Bobo Choses S.L."),
    careInstructions: field("찬물 손세탁"),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["4-5Y", "6-7Y"] }],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    breadcrumbPath: ["Home", "Kids", "Girl", "Shorts"],
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field("주식회사 따조"),
    childCertification: field(null),
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043"),
    weight: field(""),
    certificationType: field("공급자적합성확인 대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

function snapshot(fields: LotteOnValidationSnapshot["fields"]): LotteOnValidationSnapshot {
  const readyCount = fields.filter((f) => f.status === "READY").length;
  const missingCount = fields.filter((f) => f.status === "MISSING").length;
  const blockedCount = fields.filter((f) => f.status === "BLOCKED").length;
  return { ok: missingCount === 0 && blockedCount === 0, fields, readyCount, missingCount, blockedCount };
}

/* ── ② 단일 판정 ─────────────────────────────────────────────────────────── */

describe("등록 가능성 — 서버 검증 결과를 세기만 한다", () => {
  it("확인 전에는 0%다 — 모르는 것을 '가능'으로 낙관하지 않는다", () => {
    expect(computeLotteOnRegistrationReadiness(null)).toEqual({
      percent: 0,
      total: 0,
      readyCount: 0,
      allRequiredPassed: false,
    });
  });

  it("퍼센트는 통과한 필드 수 / 전체 필드 수다", () => {
    const readiness = computeLotteOnRegistrationReadiness(
      snapshot([
        { field: "spdNm", label: "판매자상품명", status: "READY" },
        { field: "slPrc", label: "판매가", status: "READY" },
        { field: "scatNo", label: "표준카테고리", status: "BLOCKED", reason: "x" },
        { field: "oplcCd", label: "원산지코드", status: "MISSING", reason: "y" },
      ]),
    );
    expect(readiness.total).toBe(4);
    expect(readiness.readyCount).toBe(2);
    expect(readiness.percent).toBe(50);
    expect(readiness.allRequiredPassed).toBe(false);
  });

  it("등록 게이트는 서버가 준 ok를 그대로 쓴다 — 화면이 다시 계산하지 않는다", () => {
    const allReady = snapshot([
      { field: "spdNm", label: "판매자상품명", status: "READY" },
      { field: "slPrc", label: "판매가", status: "READY" },
    ]);
    expect(computeLotteOnRegistrationReadiness(allReady)).toMatchObject({ percent: 100, allRequiredPassed: true });

    // 서버가 ok:false라고 하면 퍼센트가 100이어도 게이트는 닫힌다.
    expect(computeLotteOnRegistrationReadiness({ ...allReady, ok: false }).allRequiredPassed).toBe(false);
  });
});

/* ── ① 경계 ──────────────────────────────────────────────────────────────── */

describe("부족한 정보 — 왜 필요한지 + 무엇을 어디서", () => {
  const missing = buildLotteOnMissingInfo(
    snapshot([
      { field: "spdNm", label: "판매자상품명", status: "READY" },
      { field: "scatNo", label: "표준카테고리", status: "BLOCKED", reason: "표준카테고리번호가 선택되지 않았습니다." },
      { field: "itmImgLst", label: "대표 이미지", status: "MISSING", reason: "대표 이미지가 없습니다." },
      { field: "owhpNo", label: "출고지번호", status: "BLOCKED", reason: "선등록 필요" },
      { field: "sftyAthnLst", label: "안전인증", status: "BLOCKED", reason: "어린이제품은 필수입니다." },
    ]),
  );

  it("통과한 항목은 목록에 오르지 않는다", () => {
    expect(missing.map((item) => item.key)).not.toContain("spdNm");
  });

  it("항목마다 '왜'와 '무엇을'이 둘 다 있다 — 입력칸 이름만 나열하지 않는다", () => {
    expect(missing.length).toBeGreaterThan(0);
    for (const item of missing) {
      expect(item.why.length, item.key).toBeGreaterThan(10);
      expect(item.what.length, item.key).toBeGreaterThan(10);
    }
  });

  it("🔴 공통 상품정보는 '상품정보'에서 고치라고 한다 — 롯데ON 탭에서 고치라고 하지 않는다", () => {
    const image = missing.find((item) => item.key === "itmImgLst");
    expect(image?.where).toBe("COMMON_PRODUCT");
    expect(image?.sectionId).toBeUndefined();
  });

  it("롯데ON 판매자센터에서만 만들 수 있는 값은 그렇게 말한다 — 우리가 만들 수 있는 척하지 않는다", () => {
    expect(missing.find((item) => item.key === "owhpNo")?.where).toBe("LOTTEON_SELLER_CENTER");
  });

  it("공통 상품정보가 목록 맨 앞에 온다 — 고치면 세 채널이 함께 해결되기 때문이다", () => {
    expect(missing[0]?.where).toBe("COMMON_PRODUCT");
  });

  it("서버가 준 사유를 버리지 않는다", () => {
    expect(missing.find((item) => item.key === "scatNo")?.why).toContain("표준카테고리번호가 선택되지 않았습니다.");
  });

  it("표에 없는 새 필드도 빠뜨리지 않는다 — 기본 안내로 떨어질 뿐이다", () => {
    const unknown = buildLotteOnMissingInfo(
      snapshot([{ field: "someNewField", label: "새 필드", status: "MISSING", reason: "아직 없다" }]),
    );
    expect(unknown).toHaveLength(1);
    expect(unknown[0].label).toBe("새 필드");
  });
});

/* ── ③ 재입력 금지 ───────────────────────────────────────────────────────── */

describe("상품정보에 이미 있는 값을 롯데ON 탭이 다시 묻지 않는다", () => {
  it("고시 내용으로 쓸 수 있는 공통 값을 모아 준다(소재·색상·제조사·원산지…)", () => {
    const rows = collectLotteOnNoticeSourceValues(makeProduct());
    const labels = rows.map((row) => row.label);
    expect(labels).toContain("소재");
    expect(labels).toContain("색상");
    expect(labels).toContain("제조사");
    expect(labels).toContain("제조국/원산지");
    expect(labels).toContain("치수(사이즈)");
    expect(rows.find((row) => row.label === "치수(사이즈)")?.value).toBe("4-5Y, 6-7Y");
  });

  it("비어 있는 값은 줄로 만들지 않는다 — 빈 칸을 '있다'고 말하지 않는다", () => {
    const rows = collectLotteOnNoticeSourceValues(makeProduct({ material: field(""), color: field("  ") }));
    expect(rows.map((row) => row.label)).not.toContain("소재");
    expect(rows.map((row) => row.label)).not.toContain("색상");
  });

  it("🔴 인증번호를 만들지 않는다 — 상품정보에 없으면 null이다", () => {
    expect(buildLotteOnSafetyLineFromCommon(makeProduct(), "CHL_CFM")).toBeNull();
  });

  it("상품정보의 어린이제품 인증을 롯데ON 형식으로 옮겨 적는다(값은 그대로)", () => {
    const product = makeProduct({
      childCertification: field({
        certificationNumber: "CB123456789",
        companyName: "따조",
        certificationDate: "20250101",
        name: "한국기계전기전자시험연구원",
      }),
    });
    expect(buildLotteOnSafetyLineFromCommon(product, "CHL_CFM")).toBe(
      "CHL_CFM:CB123456789:한국기계전기전자시험연구원",
    );
  });

  it("유형코드는 우리가 정하지 않는다 — 카테고리가 알려주지 않으면 옮기지 않는다", () => {
    const product = makeProduct({
      childCertification: field({ certificationNumber: "CB1", companyName: "따조", certificationDate: "20250101" }),
    });
    expect(buildLotteOnSafetyLineFromCommon(product, null)).toBeNull();
    expect(buildLotteOnSafetyLineFromCommon(product, "")).toBeNull();
  });
});

/* ── ④ 필드명 · 추천 ─────────────────────────────────────────────────────── */

/** 205 문서 Response Sample 원문을 그대로 옮긴 것 + 같은 스키마의 아동복 노드.
 * 스키마(키 이름)는 문서 원문이고, 두 번째 노드의 **값**만 이 테스트용이다. */
const SAMPLE_205 = [
  {
    depth_no: "1",
    std_cat_id: "BC01000000",
    std_cat_nm: "유아동패션",
    upr_std_cat_id: "0",
    leaf_yn: "N",
    use_yn: "Y",
  },
  {
    depth_no: "2",
    std_cat_id: "BC01030100",
    std_cat_nm: "유아동 반바지",
    upr_std_cat_id: "BC01000000",
    leaf_yn: "Y",
    use_yn: "Y",
    tdf_cd: "01",
    age_limit_cd: "0",
    chl_cfm: "Y",
    chl_athn: "",
    disp_list: [{ mall_dvs_cd: "LTON", std_cat_id: "BC01030100", disp_cat_id: "FC14070100" }],
    pd_Itms_list: [{ std_cat_id: "BC01030100", pd_Itms_cd: "23" }],
    attr_list: [],
  },
  {
    depth_no: "1",
    std_cat_id: "BC09000000",
    std_cat_nm: "가전디지털",
    upr_std_cat_id: "0",
    leaf_yn: "N",
    use_yn: "Y",
  },
  {
    depth_no: "2",
    std_cat_id: "BC09990000",
    std_cat_nm: "주방가전",
    upr_std_cat_id: "BC09000000",
    leaf_yn: "Y",
    use_yn: "Y",
  },
];

describe("onpick 205/206 — 문서 원문 필드로만 읽는다", () => {
  it("표준카테고리의 2중 카테고리·고시·과세·안전인증이 한 응답에서 함께 나온다", () => {
    const parsed = parseLotteOnStandardCategory(SAMPLE_205[1]);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe("BC01030100");
    expect(parsed!.name).toBe("유아동 반바지");
    expect(parsed!.leaf).toBe(true);
    // 전시카테고리(dcatLst 후보)
    expect(parsed!.displayCategories).toEqual([{ mallCode: "LTON", displayCategoryId: "FC14070100" }]);
    // 고시 품목코드(pdItmsCd) — 23은 어린이제품이다
    expect(parsed!.noticeItemCodes).toEqual(["23"]);
    // 과세구분(tdfDvsCd)
    expect(parsed!.taxTypeCode).toBe("01");
    // 요구 안전인증 유형(sftyAthnTypCd)
    expect(parsed!.safetyTypeCodes).toEqual(["CHL_CFM"]);
  });

  it("최상위(upr_std_cat_id '0')는 부모 없음으로 읽는다", () => {
    expect(parseLotteOnStandardCategory(SAMPLE_205[0])!.parentId).toBeNull();
  });

  it("필수 필드가 없으면 지어내지 않고 null이다", () => {
    expect(parseLotteOnStandardCategory({ depth_no: "3" })).toBeNull();
    expect(parseLotteOnStandardCategory(null)).toBeNull();
    expect(parseLotteOnDisplayCategory({ upr_disp_cat_id: "EC1" })).toBeNull();
  });

  it("🔴 elc_athn → ELC_AHTN — 문서의 철자를 우리가 '고치지' 않는다", () => {
    // 87 공통코드표가 ELC_AHTN이다(205 플래그명만 elc_athn). 우리가 고쳐 보내면
    // 롯데ON이 모르는 코드가 된다.
    expect(LOTTEON_SAFETY_FLAG_TO_TYPE_CODE.elc_athn).toBe("ELC_AHTN");
    expect(LOTTEON_SAFETY_FLAG_TO_TYPE_CODE.chl_cfm).toBe("CHL_CFM");
  });

  it("조상 경로는 있는 것만 세운다 — 부모를 못 찾으면 거기서 멈춘다", () => {
    const all = SAMPLE_205.map(parseLotteOnStandardCategory).filter((c): c is LotteOnStandardCategory => c != null);
    const byId = new Map(all.map((c) => [c.id, c]));
    expect(buildLotteOnCategoryPath(byId.get("BC01030100")!, byId)).toEqual(["유아동패션", "유아동 반바지"]);
    // 부모가 목록에 없으면 자기 이름만 남는다(가짜 조상을 만들지 않는다).
    expect(buildLotteOnCategoryPath(byId.get("BC01030100")!, new Map())).toEqual(["유아동 반바지"]);
  });
});

describe("카테고리 추천 — 기존 추천 기계장치를 그대로 쓴다", () => {
  const categories = SAMPLE_205.map(parseLotteOnStandardCategory).filter(
    (c): c is LotteOnStandardCategory => c != null,
  );

  it("리프가 아닌 카테고리는 후보가 되지 않는다(87의 scatNo는 리프다)", () => {
    const result = recommendLotteOnStandardCategories(makeProduct(), categories);
    expect(result.candidates.map((c) => c.category.id)).not.toContain("BC01000000");
    expect(result.scannedLeafCount).toBe(2);
  });

  it("아동 반바지 상품에서 아동 반바지 카테고리가 주방가전보다 위에 온다", () => {
    const result = recommendLotteOnStandardCategories(makeProduct(), categories);
    expect(result.candidates[0]?.category.id).toBe("BC01030100");
    const shorts = result.candidates.find((c) => c.category.id === "BC01030100")!;
    const appliance = result.candidates.find((c) => c.category.id === "BC09990000")!;
    expect(shorts.score).toBeGreaterThan(appliance.score);
    // 점수 이유는 scoreCategoryCandidate()가 만든 문장 그대로다.
    expect(shorts.reason.length).toBeGreaterThan(0);
  });

  it("후보가 하나도 없으면 REJECT다 — 억지로 하나를 고르지 않는다", () => {
    expect(recommendLotteOnStandardCategories(makeProduct(), []).decision).toBe("REJECT");
  });

  it("🔴 반환값 어디에도 CategorySelection이 없다 — 공통 카테고리로 되돌아갈 타입이 없다", () => {
    const result = recommendLotteOnStandardCategories(makeProduct(), categories);
    expect(Object.keys(result).sort()).toEqual(
      ["candidates", "decision", "scannedLeafCount", "signalEvidence", "unrecognizedCount"].sort(),
    );
    for (const candidate of result.candidates) {
      expect(Object.keys(candidate).sort()).toEqual(["category", "conflict", "path", "reason", "score"].sort());
    }
  });
});

/* ── 화면 소스 검사 — 경계가 코드에 남아 있는가 ───────────────────────────── */

const PANEL_SOURCE = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");

describe("롯데ON 탭 소스 — 경계를 되돌리지 못하게 한다", () => {
  it("공통 상품 데이터를 고치는 콜백이 여전히 하나도 없다", () => {
    for (const forbidden of ["onUpdateProduct", "onUpdateField", "onUpdateVariant", "updateSalePriceKrw"]) {
      expect(PANEL_SOURCE, `롯데ON 탭이 공통 상품정보를 고치기 시작했다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("가격을 이 패널이 다시 계산하지 않는다", () => {
    expect(PANEL_SOURCE).not.toContain("resolveListingPrice");
  });

  it("공통 카테고리를 쓰지도 고치지도 않는다", () => {
    // 타입이 없으니 값이 흘러들 자리도 없다(주석에는 이 이름이 나오므로
    // "언급 금지"가 아니라 "사용 금지"를 본다).
    expect(PANEL_SOURCE).not.toContain("CategorySelection");
    expect(PANEL_SOURCE).not.toContain("setCategoryMappings");
    expect(PANEL_SOURCE).not.toContain("selectCategory");
  });

  it("등록 버튼 게이트가 세 조건을 모두 본다(§10)", () => {
    expect(PANEL_SOURCE).toContain("!stale && readiness.percent === 100 && readiness.allRequiredPassed");
  });
});
