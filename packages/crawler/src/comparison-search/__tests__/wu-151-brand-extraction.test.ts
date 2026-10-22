import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lookupBrandAlias, lookupBrandByAliasInTitle } from "../brand-alias";
import { brandFromHtml, priceFromGodoSaleField } from "../product-url-facts";

/** 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-151 — **브랜드가 페이지에 있는데 `brand = null` 로 들어가지 않는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-22) — 이 WU 의 성공 기준은 「보몽드를 SAME 으로 만든다」가 **아니다**:
 * > **「판매처에 브랜드가 있는데 우리 enrichment 가 못 가져오는 일이 다시 발생하지 않는가」**
 *
 * ── 🔴 실측이 만든 변경(2026-10-22 · B226AC009) ───────────────────────────────
 * ```
 * beaumonde.co.kr  og:brand ❌ · product:brand ❌ · JSON-LD brand ❌
 *                  og:title 「**보보쇼즈** 26FW 아동 긴팔 티셔츠 … B226AC009」 ✅
 * 전  facts.brand = null → MI `BRAND_UNCONFIRMED` → **PRESUMED_SAME**(품번 exact 인데도)
 * 후  facts.brand = "Bobo Choses" → blockers **[]** → **SAME**
 * 🔴 **MI 는 한 글자도 바꾸지 않았다** — 바뀐 것은 **추출** 이다(CPO 1-2 의 그 구분).
 * ```
 *
 * ── 🔴 이 파일이 막는 것(CPO 금지 1~4) ──────────────────────────────────────
 * ```
 * ❌ 보몽드 전용 예외        → 도메인 분기가 **0** 임을 단언한다
 * ❌ brand=null + 품번 → SAME → 이 계층은 **brand 를 만들지 못하면 여전히 null** 이다
 * ❌ substring 만으로 확정    → 경계 검사(「보보쇼즈st」 거부)
 * ❌ 무차별 음역            → **등록부에 없는 표기는 인식하지 않는다**
 * ```
 */

/* ───────────────────── A. 표기 → 정규 브랜드명(등록부 전용) ───────────────────── */

describe("A. 🔴 `lookupBrandByAliasInTitle` — 등록부에 있는 표기만, 경계가 맞을 때만", () => {
  it("A-1 🟢 실측 등록된 한글 표기를 정규 브랜드명으로 돌려준다", () => {
    expect(lookupBrandByAliasInTitle("보보쇼즈 26FW 아동 긴팔 티셔츠 Hug Hairy Monster T-shirt B226AC009")).toBe(
      "Bobo Choses",
    );
    /** 🟢 기존 등록도 그대로 동작한다(이 등록부는 WU-151 이 만든 것이 아니다). */
    expect(lookupBrandByAliasInTitle("페페 클래식 티바 슈즈")).toBe("Pèpè Shoes");
  });

  /** 🔴🔴 **CPO 금지 3** — substring 만으로 브랜드를 확정하지 않는다. */
  it("A-2 🔴 표기 뒤에 글자가 이어지면 **거부** 한다(유사품 표기)", () => {
    expect(lookupBrandByAliasInTitle("보보쇼즈st 아동 티셔츠")).toBeUndefined();
    expect(lookupBrandByAliasInTitle("보보쇼즈풍 티셔츠")).toBeUndefined();
    expect(lookupBrandByAliasInTitle("리틀보보쇼즈 티셔츠")).toBeUndefined();
  });

  /** 🔴🔴 **CPO 금지 4** — 등록부에 없는 브랜드는 **추론하지 않는다**. */
  it("A-3 🔴 등록부에 없는 표기는 인식하지 않는다", () => {
    expect(lookupBrandByAliasInTitle("미쉬카 아동 티셔츠")).toBeUndefined();
    expect(lookupBrandByAliasInTitle("보보 쇼즈 티셔츠"), "띄어쓴 표기를 임의로 같은 것으로 치지 않는다").toBeUndefined();
  });

  it("A-4 빈 입력·null 은 조용히 undefined", () => {
    expect(lookupBrandByAliasInTitle("")).toBeUndefined();
    expect(lookupBrandByAliasInTitle(null)).toBeUndefined();
    expect(lookupBrandByAliasInTitle(undefined)).toBeUndefined();
  });

  /** 🟢 정방향(브랜드 → 한글 검색어)은 **그대로** 다 — 기존 소비처가 깨지지 않는다. */
  it("A-5 🟢 기존 정방향 조회가 유지된다(추가 전용)", () => {
    expect(lookupBrandAlias("Bobo Choses")).toBe("보보쇼즈");
    expect(lookupBrandAlias("Pèpè Shoes")).toBe("페페");
    expect(lookupBrandAlias("Unknown Brand")).toBeUndefined();
  });
});

/* ──────────────────── B. `brandFromHtml` — 네 자리 · 우선순위 ──────────────────── */

const OG = (title: string) => `<meta property="og:title" content="${title}">`;

describe("B. 🔴🔴 `brandFromHtml` — 구조화가 언제나 이긴다(추가 전용)", () => {
  it("B-1 🟢 구조화 데이터가 있으면 그것을 쓴다(네 번째 자리는 보지 않는다)", () => {
    const html = `<meta property="og:brand" content="Structured Brand">${OG("보보쇼즈 티셔츠")}`;
    expect(brandFromHtml(html)).toBe("Structured Brand");
  });

  it("B-2 🟢 JSON-LD brand 도 네 번째 자리보다 **먼저** 다", () => {
    const html = `<script type="application/ld+json">{"brand":{"name":"Bobo Choses"}}</script>${OG("보보쇼즈 티셔츠")}`;
    expect(brandFromHtml(html)).toBe("Bobo Choses");
  });

  /** 🔴🔴 **이것이 WU-151 이 연 자리다** — 국내 판매처의 실제 모양. */
  it("B-3 🔴🔴 구조화가 **전부 없을 때만** og:title 의 등록 표기를 읽는다", () => {
    const html = OG("보보쇼즈 26FW 아동 긴팔 티셔츠 Hug Hairy Monster T-shirt B226AC009");
    expect(brandFromHtml(html)).toBe("Bobo Choses");
  });

  /** 🔴 **상품명만** 본다 — 본문의 「추천 브랜드」를 상품 브랜드로 읽지 않는다(CPO STEP 3). */
  it("B-4 🔴🔴 본문에 표기가 있어도 **상품명에 없으면** 읽지 않는다", () => {
    const html = `${OG("아동 긴팔 티셔츠")}<div class="reco">추천 브랜드: 보보쇼즈</div>`;
    expect(brandFromHtml(html)).toBeNull();
  });

  it("B-5 🔴 아무 자리에도 없으면 **null** 이다(지어내지 않는다)", () => {
    expect(brandFromHtml(OG("아동 긴팔 티셔츠 B226AC009"))).toBeNull();
    expect(brandFromHtml("<html></html>")).toBeNull();
  });

  /** 🔴 **CPO 금지 1** — 도메인/사이트 분기가 없다(보몽드 전용이 아니다). */
  it("B-6 🔴 이 계층은 **도메인을 보지 않는다**", () => {
    const title = "보보쇼즈 26FW 아동 긴팔 티셔츠 B226AC009";
    /** 같은 제목이면 어느 사이트의 HTML 이든 같은 답이다 — 입력에 도메인이 없다. */
    expect(brandFromHtml(OG(title))).toBe(brandFromHtml(`<html>${OG(title)}</html>`));
  });
});

/* ─────────────────── C. 고도몰 판매가 — 정가를 판매가로 쓰지 않는다 ─────────────────── */

const GODO = (sale: string, fixed: string, visible: string) =>
  `<input type="hidden" name="set_goods_price" value="${sale}" />` +
  `<input type="hidden" name="set_goods_fixedPrice" value="${fixed}" />` +
  `<div><del><span>88,000</span>원</del><strong>${visible}</strong><span>원</span></div>`;

describe("C. 🔴🔴 `priceFromGodoSaleField` — **판매가** 만 읽는다", () => {
  it("C-1 🟢 판매가 83,600 을 KRW 로 읽는다(실측 모양 그대로)", () => {
    expect(priceFromGodoSaleField(GODO("83600", "88000.00", "83,600"))).toEqual({
      amount: 83600,
      currency: "KRW",
    });
  });

  /** 🔴🔴 **CPO STEP 10** — 정가를 판매가로 쓰지 않는다. */
  it("C-2 🔴🔴 `set_goods_fixedPrice`(정가)를 읽지 않는다", () => {
    const html = `<input type="hidden" name="set_goods_fixedPrice" value="88000.00" /><div>88,000원</div>`;
    expect(priceFromGodoSaleField(html), "정가밖에 없는데 가격을 만들었다").toBeNull();
  });

  /**
   * 🔴🔴 **통화를 지어내지 않는다.** 고도몰은 통화를 적지 않으므로 **두 번째 독립
   *    출처**(화면의 「…원」 표기)가 동의할 때만 KRW 로 확정한다.
   */
  it("C-3 🔴🔴 「원」 증거가 없으면 **null** 이다", () => {
    const html = `<input type="hidden" name="set_goods_price" value="83600" /><div>83,600</div>`;
    expect(priceFromGodoSaleField(html)).toBeNull();
  });

  /** 🔴 1차 구현이 여기서 실패했다 — 숫자와 「원」 사이에 **태그가 끼어 있다**. */
  it("C-4 🔴 숫자와 「원」 사이에 태그가 있어도 읽는다(실측 마크업)", () => {
    const html =
      `<input type="hidden" name="set_goods_price" value="83600" />` +
      `<strong>83,600</strong><span>원</span>`;
    expect(priceFromGodoSaleField(html)).toEqual({ amount: 83600, currency: "KRW" });
  });

  it("C-5 🔴 0 이하·숫자 아님은 null 이다", () => {
    expect(priceFromGodoSaleField(`<input name="set_goods_price" value="0" /><div>0원</div>`)).toBeNull();
    expect(priceFromGodoSaleField(`<input name="set_goods_price" value="" /><div>원</div>`)).toBeNull();
  });

  it("C-6 🟢 그 필드가 없는 페이지는 **동작 불변**(null)", () => {
    expect(priceFromGodoSaleField("<html><div>83,600원</div></html>")).toBeNull();
  });
});

/* ───────────────────────── D. 배선 — 끊기면 FAIL 한다 ───────────────────────── */

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **WU-110 의 교훈** — 판정 함수를 «직접» 부르는 단언은 **배선을 못 본다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-110 에서 실제로 났다: 「`price: shopifyVariantPrice(body)` 를 `null` 로 되돌려도
 *    **0 failed**」. 위 A~C 도 같다 — 두 함수를 `htmlPath` 에서 **떼어 내도** 전부 통과한다.
 * 🟢 그래서 **소스 앵커** 를 같이 둔다(그 파일의 기존 패턴과 같은 방식).
 */
describe("D. 🔴🔴 배선 — 두 계층이 실제 경로에 꽂혀 있다", () => {
  const SRC = stripComments(readFileSync(new URL("../product-url-facts.ts", import.meta.url), "utf8"));

  it("D-1 🔴 브랜드 네 번째 자리가 `brandFromHtml` 안에 꽂혀 있다", () => {
    expect(SRC).toContain("lookupBrandByAliasInTitle(");
    /** 🔴 그리고 **구조화 루프 뒤** 여야 한다(추가 전용 · 덮어쓰기 금지). */
    const loopAt = SRC.indexOf("for (const re of BRAND_PATTERNS)");
    const aliasAt = SRC.indexOf("lookupBrandByAliasInTitle(");
    expect(loopAt).toBeGreaterThan(-1);
    expect(aliasAt).toBeGreaterThan(loopAt);
  });

  it("D-2 🔴 고도몰 판매가가 가격 사슬의 **마지막** 자리에 꽂혀 있다", () => {
    expect(SRC).toContain("priceFromGodoSaleField(html)");
    /** 🔴 구조화(JSON-LD · microdata)가 **먼저** 와야 한다. */
    expect(SRC).toMatch(/priceFromJsonLd\(html\)\s*\?\?\s*micro\?\.price\s*\?\?\s*priceFromGodoSaleField\(html\)/);
  });

  /** 🔴 **CPO 금지 1** — 사이트 전용 분기를 만들지 않았다. */
  it("D-3 🔴 두 계층에 **도메인 분기가 없다**", () => {
    for (const needle of ["beaumonde", "shinsegae", "lfmall", "godo.co.kr"]) {
      expect(SRC.toLowerCase(), `🔴 사이트 전용 분기가 생겼다: ${needle}`).not.toContain(needle);
    }
  });
});
