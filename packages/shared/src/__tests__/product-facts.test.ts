import { describe, expect, it } from "vitest";
import {
  buildSizeProfile,
  extractCodeLikeSlugSegment,
  extractFitPhrase,
  extractLabeledProductCode,
  extractLeadingColorPhrase,
  materialCompositionKey,
  normalizeSizeLabel,
  parseMaterialComposition,
  resolveAdultGender,
  resolveAudienceGroup,
  resolveAudienceLine,
  resolveColorHueGroups,
  tokenizeFactText,
} from "../product-facts";

/**
 * MATCHING-2.0-CORE — 여기 나오는 문자열은 전부 2026-09-13에 smallable.com과
 * bobochoses.com이 실제로 내려준 값이다. 지어낸 예시를 쓰지 않는 이유는, 이
 * 정규화기들이 존재하는 유일한 이유가 "두 판매처가 같은 사실을 다르게 적는다"는
 * 실제 표기 차이를 흡수하는 것이기 때문이다.
 */
describe("소재 — 적는 순서가 달라도 같은 사실이다", () => {
  it("'100% Organic Cotton'(Smallable)과 'Organic Cotton 100%'(Bobo)는 같은 성분 목록이다", () => {
    const smallable = parseMaterialComposition("  SIZE AND FIT    Loose fit    COMPOSITION    100% Organic Cotton  ");
    const bobo = parseMaterialComposition("Light heather grey sweatshirt. Organic Cotton 100%. Loose fit.");
    expect(materialCompositionKey(smallable)).toBe("organic cotton:100");
    expect(materialCompositionKey(bobo)).toBe(materialCompositionKey(smallable));
  });

  it("여러 성분도 적는 순서와 무관하게 같은 값이 된다", () => {
    const smallable = parseMaterialComposition("17% Cotton, 66% Organic Cotton, 17% Recycled Cotton");
    const bobo = parseMaterialComposition("Organic Cotton 66%, Recycled Cotton 17%, Cotton 17%");
    expect(materialCompositionKey(smallable)).toBe(materialCompositionKey(bobo));
    expect(materialCompositionKey(smallable)).toBe("cotton:17,organic cotton:66,recycled cotton:17");
  });

  it("100% 면과 66/17/17 혼방은 서로 다른 값이다", () => {
    expect(materialCompositionKey(parseMaterialComposition("100% Organic Cotton"))).not.toBe(
      materialCompositionKey(parseMaterialComposition("Organic Cotton 66%, Recycled Cotton 17%, Cotton 17%")),
    );
  });

  it("할인 문구를 소재로 읽지 않는다", () => {
    expect(parseMaterialComposition("50% Off Sale this week")).toEqual([]);
  });
});

describe("색상 — 같은 색을 다르게 부르는 것과 다른 색을 구분한다", () => {
  it("수식어가 둘 붙어도 색 이름을 찾아낸다", () => {
    expect(extractLeadingColorPhrase("Light heather grey sweatshirt. Organic Cotton 100%.")).toBe("light heather grey");
    expect(extractLeadingColorPhrase("Light pink t-shirt. Organic Cotton 100%.")).toBe("light pink");
    expect(extractLeadingColorPhrase("Offwhite t-shirt. Organic Cotton 100%.")).toBe("offwhite");
  });

  it("첫 문장만 본다 — 뒤 문장의 색 단어를 상품 색으로 삼지 않는다", () => {
    expect(extractLeadingColorPhrase("Organic Cotton 100%. Made with blue dye in Portugal.")).toBeNull();
  });

  it("'Heather grey'와 'Light heather grey'는 같은 묶음, 'Blue'와 'Light pink'는 다른 묶음이다", () => {
    expect([...resolveColorHueGroups("Heather grey")]).toEqual(["GREY"]);
    expect([...resolveColorHueGroups("light heather grey")]).toEqual(["GREY"]);
    expect([...resolveColorHueGroups("Midnight blue")]).toEqual(["BLUE"]);
    expect([...resolveColorHueGroups("Navy blue")]).toEqual(["BLUE"]);
    expect([...resolveColorHueGroups("light pink")]).toEqual(["PINK"]);
    expect([...resolveColorHueGroups("Lavender")]).toEqual(["PURPLE"]);
  });

  it("어느 묶음인지 단정할 수 없는 색이름은 판정하지 않는다", () => {
    // Ecru를 목록에 넣지 않은 것은 실수가 아니다 — 아이보리 쪽인지 베이지 쪽인지
    // 사람마다 다르게 부르는 말이라, 어디에 넣어도 그 순간 없는 충돌이 생긴다.
    expect(resolveColorHueGroups("Ecru").size).toBe(0);
  });
});

describe("핏 — 관측된 표현만 읽는다", () => {
  it("Smallable의 'SIZE AND FIT / Loose fit'과 Bobo의 'Loose fit.'은 같은 값이다", () => {
    expect(extractFitPhrase("  SIZE AND FIT    Loose fit    COMPOSITION    100% Organic Cotton  ")).toBe("loose fit");
    expect(extractFitPhrase("Light heather grey sweatshirt. Organic Cotton 100%. Loose fit.")).toBe("loose fit");
  });

  it("'Fits true to size'는 'Loose fit'과 다른 값이다", () => {
    expect(extractFitPhrase("Light pink t-shirt. Fits true to size, take your normal size.")).toBe(
      "fits true to size",
    );
  });

  it("핏 표현이 없으면 null이다(없는 것을 지어내지 않는다)", () => {
    expect(extractFitPhrase("Offwhite t-shirt. Organic Cotton 100%. Responsibly made in Portugal.")).toBeNull();
  });
});

describe("사이즈 — 표기가 달라도 같은 사이즈이고, 체계가 다르면 다른 상품이다", () => {
  it("'4/5 years'(Smallable)와 '4-5Y'(Bobo)는 같은 값이 된다", () => {
    expect(normalizeSizeLabel("4/5 years")).toEqual({ value: "4-5y", system: "AGE" });
    expect(normalizeSizeLabel("4-5Y")).toEqual({ value: "4-5y", system: "AGE" });
  });

  it("연령형과 알파벳형은 서로 다른 체계다", () => {
    const kids = buildSizeProfile(["2-3Y", "4-5Y", "12-13Y"]);
    const adult = buildSizeProfile(["XS", "S", "M", "L", "XL"]);
    expect([...kids.systems]).toEqual(["AGE"]);
    expect([...adult.systems]).toEqual(["ALPHA"]);
  });

  /**
   * MATCHING-2.0-REGRESSION(2026-09-14). 개월 표기는 지금까지 **통째로 버려지거나**
   * 연령형과 같은 체계로 들어갔다. 라벨 원문은 전부 실측(bobochoses.com은 "3M",
   * junioredition.com은 "6 Months", Misha & Puff는 "12-18 Months").
   */
  it("개월 표기를 읽는다 — 판매처마다 다른 표기가 같은 값이 된다", () => {
    expect(normalizeSizeLabel("6M")).toEqual({ value: "6m", system: "MONTH" });
    expect(normalizeSizeLabel("6 Months")).toEqual({ value: "6m", system: "MONTH" });
    expect(normalizeSizeLabel("6 mois")).toEqual({ value: "6m", system: "MONTH" });
    expect(normalizeSizeLabel("12-18 Months")).toEqual({ value: "12-18m", system: "MONTH" });
  });

  it("개월형과 연령형은 서로 다른 체계다 — 6개월 아기옷과 여섯 살 아이 옷은 다른 물건이다", () => {
    const baby = buildSizeProfile(["3M", "6M", "9M", "12M", "18M", "24M"]);
    const kids = buildSizeProfile(["2/3 years", "4/5 years", "12/13 years"]);
    expect([...baby.systems]).toEqual(["MONTH"]);
    expect([...kids.systems]).toEqual(["AGE"]);
  });

  it("알파벳 사이즈 'M'은 개월로 읽히지 않는다 — 앞에 숫자가 없다", () => {
    expect(normalizeSizeLabel("M")).toEqual({ value: "m", system: "ALPHA" });
    expect(normalizeSizeLabel("S")).toEqual({ value: "s", system: "ALPHA" });
  });
});

describe("대상 연령 / 성별 — 제목이 아니라 사이트 자신의 분류에서 읽는다", () => {
  it("Smallable breadcrumb는 아동, Bobo 태그는 상품마다 아동/성인이 갈린다", () => {
    expect(resolveAudienceGroup(["Home", "Fashion  Children", "Boy", "Sweatshirts"])).toBe("KIDS");
    expect(resolveAudienceGroup(["aw26", "branded", "children", "clothing", "Kid", "sweatshirts"])).toBe("KIDS");
    expect(resolveAudienceGroup(["adult", "aw26", "clothing", "drop-1", "t-shirts", "Woman"])).toBe("ADULT");
  });

  it("성별은 성인 표기에서만 읽는다 — 아동 매장의 Boy/Girl 진열 칸으로 충돌을 만들지 않는다", () => {
    expect(resolveAdultGender(["Home", "Fashion  Children", "Boy"])).toBeNull();
    expect(resolveAdultGender(["adult", "Woman"])).toBe("FEMALE");
  });
});

/**
 * MATCHING-3.2-B(CEO 지시, 2026-09-14) — 아동 안쪽의 연령 라인.
 *
 * 여기 나오는 신호는 전부 2026-09-14 라이브 실측 원문이다(Smallable breadcrumb,
 * bobochoses.com / junioredition.com 상품 태그·상품유형).
 */
describe("아동 안쪽의 연령 라인 — 원문이 직접 말한 것만 읽는다", () => {
  it("판매처가 아기라고 적으면 BABY다 — 같은 상품에 붙은 우산말(children)이 그것을 덮지 않는다", () => {
    // bobochoses.com 아기 상품의 실제 태그. "children"이 함께 붙어 있다.
    expect(resolveAudienceLine(["aw26", "Baby", "children", "clothing", "trousers"])).toBe("BABY");
    // junioredition.com 아기 상품의 실제 태그 + 상품유형.
    expect(resolveAudienceLine(["all-baby", "baby", "baby-tops", "6-12-months", "Baby T Shirt"])).toBe("BABY");
    expect(resolveAudienceLine(["0-3-months", "newborn", "Bodysuit"])).toBe("BABY");
    // Smallable은 매장 자체가 부서로 갈려 있다(breadcrumb 실측).
    expect(resolveAudienceLine(["Home", "Fashion  Baby", "Girl", "Swimwear"])).toBe("BABY");
  });

  it("아동은 CHILD다", () => {
    expect(resolveAudienceLine(["aw26", "children", "clothing", "Kid", "t-shirts"])).toBe("CHILD");
    expect(resolveAudienceLine(["Home", "Fashion  Children", "Boy", "Blouses, T-shirts"])).toBe("CHILD");
    expect(resolveAudienceLine(["kids", "T Shirt"])).toBe("CHILD");
  });

  it("주니어는 JUNIOR다", () => {
    expect(resolveAudienceLine(["Boys", "Junior Boys", "T-Shirts"])).toBe("JUNIOR");
  });

  it("원문이 아무 말도 안 하면 null이다 — 아동일 거라고 채우지 않는다", () => {
    // junioredition.com 아동 상품의 흔한 태그는 연령 낱말이 아니라 사이즈 목록이다.
    expect(resolveAudienceLine(["1-year", "10-years", "2-years", "t-shirts", "tops", "T Shirt"])).toBeNull();
    expect(resolveAudienceLine([])).toBeNull();
    // 성인 상품에도 아동 라인은 없다 — 이 축은 아동 안쪽만 가른다.
    expect(resolveAudienceLine(["bobo-choses-adult", "womens-tops", "T Shirt"])).toBeNull();
    // toddler는 어느 라인에도 넣지 않았다 — 실측에서 그 말을 단 96건 전부 사이즈
    // 라벨이 없어 아기인지 아동인지 데이터가 말해주지 않는다.
    expect(resolveAudienceLine(["toddler", "T Shirt"])).toBeNull();
  });

  it("KIDS/ADULT 축은 그대로다 — 이 축은 성인↔아동 규칙을 건드리지 않는다", () => {
    const babyTags = ["all-baby", "baby", "baby-tops", "Baby T Shirt"];
    const childTags = ["aw26", "children", "clothing", "Kid", "t-shirts"];
    expect(resolveAudienceGroup(babyTags)).toBe("KIDS");
    expect(resolveAudienceGroup(childTags)).toBe("KIDS");
    expect(resolveAudienceLine(babyTags)).toBe("BABY");
    expect(resolveAudienceLine(childTags)).toBe("CHILD");
  });

  it("한글 표기도 같은 파이프라인을 통과한다", () => {
    expect(resolveAudienceLine(["베이비", "티셔츠"])).toBe("BABY");
    expect(resolveAudienceLine(["아동", "티셔츠"])).toBe("CHILD");
    expect(resolveAudienceLine(["주니어"])).toBe("JUNIOR");
  });
});

describe("한글 토큰은 살아남고, 다시 온전한 글자로 돌아온다", () => {
  it("NFKD로 분해된 자모가 구분자로 취급돼 한글이 통째로 사라지지 않는다", () => {
    expect(tokenizeFactText("루이 스웨트셔츠 원피스")).toEqual(["루이", "스웨트셔츠", "원피스"]);
  });

  it("토큰은 검색어로 그대로 나가므로 NFC 완성형이어야 한다", () => {
    // 분해된 자모를 이어붙이면 화면에는 같아 보여도 바이트가 달라 검색이 0건이 된다.
    for (const token of tokenizeFactText("원피스")) {
      expect(token).toBe(token.normalize("NFC"));
    }
    expect(tokenizeFactText("원피스")[0]).toBe("원피스");
  });

  it("한글 어휘 목록도 같은 파이프라인을 통과해 실제로 매칭된다", () => {
    expect(resolveAudienceGroup(["아동복", "키즈"])).toBe("KIDS");
    expect(resolveAudienceGroup(["여성"])).toBe("ADULT");
    expect([...resolveColorHueGroups("네이비")]).toEqual(["BLUE"]);
  });
});

describe("브랜드 품번은 원문이 그렇게 부른 자리에서만 읽는다", () => {
  it("설명문 라벨", () => {
    expect(extractLabeledProductCode("...Product code B126AH013 SS26 Made in China.")).toBe("B126AH013");
    expect(extractLabeledProductCode("Article code: 01195-VERNICE-NERO.")).toBe("01195-VERNICE-NERO");
  });

  it("브랜드 공식몰 URL 앞머리", () => {
    expect(extractCodeLikeSlugSegment("b226ac114-bobo-choses-bolder-half-zipped-sweatshirt")).toBe("B226AC114");
  });

  it("판매처 자신의 재고번호는 품번으로 읽히지 않는다", () => {
    // Smallable 슬러그는 브랜드 이름으로 시작하고 상품 id로 끝난다 — 둘 다 조건을
    // 못 넘는다. 이 두 값이 품번으로 새어 들어가면 "SKU가 다르니 다른 상품"이라는
    // 틀린 규칙이 되살아난다.
    expect(extractCodeLikeSlugSegment("bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701")).toBeNull();
    expect(extractCodeLikeSlugSegment("430701")).toBeNull();
    expect(extractLabeledProductCode("  SIZE AND FIT  Loose fit  COMPOSITION  100% Organic Cotton  ")).toBeNull();
  });
});
