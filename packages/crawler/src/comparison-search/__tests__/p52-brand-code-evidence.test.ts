/**
 * MI-DISCOVERY-P5.2(CPO 지시, 2026-10-07) — 국내 브랜드 품번 Evidence + 색상 미확인 가드.
 *
 * 🔴 이 파일의 모든 문자열은 **실측 원문** 이다(2026-10-07). 깨끗하게 다듬은 값으로
 *    재면 `[메인스토리]  AW26MS185`(대괄호 + 공백 둘)처럼 실제로 걸리는 모양을 놓친다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { confirmBrandCodeInTitle } from "../domestic-identifiers";
import { deriveMatchTruth, isColorUnverified } from "../match-truth";
import { compareModelCode } from "../model-code";
import { searchLittleluna } from "../littleluna";
import { productFactsFromListing } from "../seller-facts";

const FOREIGN_CODE = "AW26MS185";
const FOREIGN_COLOR = "Grey Melange";

/** 실측 제목 원문. littleluna 는 대괄호 + 공백 둘, deuxbebe 는 공백 하이픈 공백. */
const LL_GREY = "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange";
const LL_GRAYSTONE = "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Graystone";
const LL_ROSE = "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Rose Shadow";
const LL_CHOCO = "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Chocolate Brown";
const DB_FERN = "AW26MS185 - Bubble Sweatshirt - Fern Green";
const FF_MELANGE = "AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356";

describe("P5.2 Step 1 — confirmBrandCodeInTitle 은 «확인» 만 한다", () => {
  it("① 실측 제목 5건에서 품번을 확인한다 — 한글·대괄호·하이픈이 경계로 쓰인다", () => {
    for (const title of [LL_GREY, LL_GRAYSTONE, LL_ROSE, LL_CHOCO, DB_FERN]) {
      expect(confirmBrandCodeInTitle(FOREIGN_CODE, title)).toBe(FOREIGN_CODE);
    }
  });

  it("② 소문자 slug 에서도 확인된다(littleluna URL 표기)", () => {
    expect(confirmBrandCodeInTitle(FOREIGN_CODE, "메인스토리-aw26ms185-bubble-sweatshirt-grey-melange")).toBe(
      FOREIGN_CODE,
    );
  });

  it("🔴 ③ 판매처 자체코드만 있는 제목은 확인되지 않는다 — 포레포레 오염 차단", () => {
    expect(confirmBrandCodeInTitle(FOREIGN_CODE, FF_MELANGE)).toBeNull();
    expect(confirmBrandCodeInTitle(FOREIGN_CODE, "보보쇼즈BS고BOBO트랙수트팬츠 (75A7D-415-16)")).toBeNull();
  });

  it("🔴 ④ 부분 일치를 «절대» 인정하지 않는다 — 토큰 전체가 같아야 한다", () => {
    // 접두사·접미사·중간 삽입 — 셋 다 거부돼야 한다.
    expect(confirmBrandCodeInTitle(FOREIGN_CODE, "AW26MS1850 - Bubble Sweatshirt")).toBeNull();
    expect(confirmBrandCodeInTitle(FOREIGN_CODE, "XAW26MS185 - Bubble Sweatshirt")).toBeNull();
    expect(confirmBrandCodeInTitle("AW26MS18", LL_GREY)).toBeNull();
  });

  it("🔴 ⑤ 순수 숫자 품번이 가격·상품번호에 우연히 걸리지 않는다 — Mini Rodini 2672014894", () => {
    // 🔴 문자열 포함으로 재면 아래 둘 다 «걸린다». 토큰 비교라서 둘 다 거부된다.
    expect(confirmBrandCodeInTitle("2672014894", "상품 12672014894번 스웨트셔츠")).toBeNull();
    expect(confirmBrandCodeInTitle("2672014894", "하트 스웨트셔츠 26720148940")).toBeNull();
    // 토큰으로 떨어져 있으면 확인된다.
    expect(confirmBrandCodeInTitle("2672014894", "미니로디니 2672014894 하트 스웨트셔츠")).toBe("2672014894");
  });

  it("🔴 ⑥ 돌려주는 값은 해외 품번 아니면 null «둘뿐» 이다 → compareModelCode 는 conflict/partial 을 만들 수 없다", () => {
    const titles = [LL_GREY, LL_GRAYSTONE, LL_ROSE, LL_CHOCO, DB_FERN, FF_MELANGE, "아무 상품", ""];
    for (const title of titles) {
      const confirmed = confirmBrandCodeInTitle(FOREIGN_CODE, title);
      expect(confirmed === FOREIGN_CODE || confirmed === null).toBe(true);
      // 이것이 「오염되지 않는다」의 구조적 근거다.
      expect(["exact", "unavailable"]).toContain(compareModelCode(FOREIGN_CODE, confirmed));
    }
  });

  it("⑦ 해외 품번이 없으면 아무것도 하지 않는다 — 국내에서 품번을 추측하지 않는다", () => {
    expect(confirmBrandCodeInTitle(null, LL_GREY)).toBeNull();
    expect(confirmBrandCodeInTitle("", LL_GREY)).toBeNull();
    expect(confirmBrandCodeInTitle("   ", LL_GREY)).toBeNull();
  });
});

describe("P5.2 Step 2 — 색상 미확인 가드", () => {
  it("① isColorUnverified 는 「해외에 색상이 있고 국내에서 못 읽은」 때만 참이다", () => {
    expect(isColorUnverified(FOREIGN_COLOR, null)).toBe(true);
    expect(isColorUnverified(FOREIGN_COLOR, "")).toBe(true);
    expect(isColorUnverified(FOREIGN_COLOR, "Grey")).toBe(false);
    // 🔴 해외에도 색상이 없으면 색상은 판단 축이 아니다 — 모르는 것으로 깎지 않는다.
    expect(isColorUnverified(null, null)).toBe(false);
    expect(isColorUnverified("", null)).toBe(false);
  });

  it("🔴 ② 품번 exact + 색상 미확인 → EXACT 로 가지 «않는다»", () => {
    const guarded = deriveMatchTruth("low", "exact", "SIMILAR", [], [], true);
    expect(guarded).not.toBe("EXACT_IDENTIFIER");
    expect(guarded).not.toBe("STRONG_IDENTIFIER");
    // 🔴 CONFLICT 로 만들지도 않는다 — 「다른 상품」이라고 확정한 것이 아니다.
    expect(guarded).not.toBe("CONFLICT");
  });

  it("🔴 ③ high 등급에서도 막는다 — 텍스트 점수가 높다고 색상이 확인된 것은 아니다", () => {
    expect(deriveMatchTruth("high", "exact", "SIMILAR", [], [], true)).not.toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("very_high", "exact", undefined, [], [], true)).not.toBe("EXACT_IDENTIFIER");
  });

  it("🔴 ④ partial 도 같이 막는다 — 색상을 모르는 위험은 품번 강도와 무관하다", () => {
    expect(deriveMatchTruth("low", "partial", "SIMILAR", [], [], true)).not.toBe("STRONG_IDENTIFIER");
  });

  it("⑤ 색상이 확인되면 기존대로 승격한다 — 가드가 정답을 막지 않는다", () => {
    expect(deriveMatchTruth("low", "exact", "SIMILAR", [], [], false)).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("high", "exact", "SIMILAR", [], [], false)).toBe("EXACT_IDENTIFIER");
  });

  it("🔴 ⑥ 인자를 생략하면 예전과 «완전히 똑같다»", () => {
    expect(deriveMatchTruth("low", "exact", "SIMILAR", [], [])).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("high", "exact")).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("low", "exact", "SIMILAR", [], [], undefined)).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "exact", "SIMILAR", [], [], null)).toBe("STRONG_IDENTIFIER");
  });
});

describe("🔴🔴 P5.2 Step 4 — 네 색상 진실표(littleluna AW26MS185)", () => {
  /** 각 색상이 «어떤» 메커니즘으로 갈리는지까지 고정한다 — 우연히 맞는 것을 막는다. */
  const truthFor = (title: string, crossSeller: Parameters<typeof deriveMatchTruth>[2], conflicts: { conflict: "COLOR" }[]) => {
    const facts = productFactsFromListing({ title, url: "https://littleluna.co.kr/product/x/1/" });
    const confirmed = confirmBrandCodeInTitle(FOREIGN_CODE, title);
    return {
      colorText: facts.colorText,
      modelCode: compareModelCode(FOREIGN_CODE, confirmed),
      truth: deriveMatchTruth(
        "low",
        compareModelCode(FOREIGN_CODE, confirmed),
        crossSeller,
        [],
        conflicts,
        isColorUnverified(FOREIGN_COLOR, facts.colorText),
      ),
    };
  };

  it("🟢 Grey Melange = 동일상품 — 색상이 읽히고 품번이 exact", () => {
    const r = truthFor(LL_GREY, "SIMILAR", []);
    expect(r.colorText).toBe("Grey");
    expect(r.modelCode).toBe("exact");
    expect(r.truth).toBe("STRONG_IDENTIFIER");
  });

  it("🔴 Chocolate Brown = 동일상품 아님 — 색상이 읽히고 «어긋난다»(P4 변경 B 경로)", () => {
    const r = truthFor(LL_CHOCO, "CONFLICT", [{ conflict: "COLOR" }]);
    expect(r.colorText).toBe("Brown");
    expect(r.modelCode).toBe("exact");
    expect(r.truth).toBe("SIMILAR");
  });

  it("🔴 Graystone = 동일상품 아님 — 색상을 «못 읽었다»(P5.2 Step 2 가드 경로)", () => {
    const r = truthFor(LL_GRAYSTONE, "SIMILAR", []);
    expect(r.colorText).toBeNull();
    expect(r.modelCode).toBe("exact");
    expect(r.truth).not.toBe("STRONG_IDENTIFIER");
    expect(r.truth).not.toBe("EXACT_IDENTIFIER");
  });

  it("🔴 Rose Shadow = 동일상품 아님 — 색상을 «못 읽었다»(P5.2 Step 2 가드 경로)", () => {
    const r = truthFor(LL_ROSE, "SIMILAR", []);
    expect(r.colorText).toBeNull();
    expect(r.modelCode).toBe("exact");
    expect(r.truth).not.toBe("STRONG_IDENTIFIER");
    expect(r.truth).not.toBe("EXACT_IDENTIFIER");
  });

  it("🔴 가드가 없었다면 Graystone·Rose Shadow 가 동일상품이 됐다 — 가드의 존재 이유", () => {
    // colorUnverified 를 넘기지 «않은» 경우(= P5.2 이전 동작)를 대조군으로 둔다.
    for (const title of [LL_GRAYSTONE, LL_ROSE]) {
      const confirmed = confirmBrandCodeInTitle(FOREIGN_CODE, title);
      expect(deriveMatchTruth("low", compareModelCode(FOREIGN_CODE, confirmed), "SIMILAR", [], [])).toBe(
        "STRONG_IDENTIFIER",
      );
    }
  });
});

describe("P5.2 Step 3 — littleluna 어댑터는 실제 응답에서 읽는다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("실측 fixture 에서 4색상·가격·품절·브랜드를 읽는다", async () => {
    const html = readFileSync(
      join(__dirname, "..", "..", "__tests__", "fixtures", "littleluna-mainstory-aw26ms185-search.html"),
      "utf8",
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));

    const got = await searchLittleluna("메인스토리");
    expect(got).toHaveLength(4);
    // 실측 응답 순서 그대로(4120 → 4117). 어댑터가 순서를 바꾸지 않는다는 것도 사실이다.
    expect(got.map((c) => c.title)).toEqual([LL_GREY, LL_GRAYSTONE, LL_ROSE, LL_CHOCO].map((t) => t.replace(/\s+/g, " ")));
    expect(got.map((c) => c.price?.amount)).toEqual([117000, 117000, 117000, 113000]);
    // 🔴 실측 4건 모두 품절이었다 — 「확인 못 했다(null)」가 아니라 「품절(true)」이다.
    expect(got.every((c) => c.soldOut === true)).toBe(true);
    expect(got.every((c) => c.brand === "MAIN STORY")).toBe(true);
    expect(got.every((c) => c.url.startsWith("https://littleluna.co.kr/product/"))).toBe(true);
    // 🔴 목록에 자체 상품코드 칸이 없다 — 지어내지 않는다.
    expect(got.every((c) => c.sku === undefined)).toBe(true);
    // 🔴 어댑터가 brandModelCode 를 채우지 않는다(seller-facts.ts 규칙).
    expect(got.every((c) => c.facts?.brandModelCode === null)).toBe(true);
    // 🔴 정가는 null — 목록의 `0원` 을 정가로 올리면 화면이 100% 할인을 말한다.
    expect(got.every((c) => c.regularPrice === null)).toBe(true);
  });

  it("어댑터가 읽은 제목이 그대로 품번 확인을 통과한다 — 두 단계가 실제로 이어진다", async () => {
    const html = readFileSync(
      join(__dirname, "..", "..", "__tests__", "fixtures", "littleluna-mainstory-aw26ms185-search.html"),
      "utf8",
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
    const got = await searchLittleluna("메인스토리");
    expect(got.every((c) => confirmBrandCodeInTitle(FOREIGN_CODE, c.title) === FOREIGN_CODE)).toBe(true);
  });
});
