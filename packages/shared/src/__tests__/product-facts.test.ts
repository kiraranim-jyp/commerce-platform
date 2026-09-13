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
