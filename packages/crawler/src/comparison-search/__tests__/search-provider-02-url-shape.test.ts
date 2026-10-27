import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "../url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-02 — **Candidate URL 분류 정확성 복구**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Apify 를 위해 새 기능을 만드는 것이 아니다.** 기존 Candidate URL 계약의
 *    **거짓 음성(false negative)** 을 제거하는 작업이다.
 *
 * ── 🔴 실측으로 확인한 결함 둘 ──────────────────────────────────────────────
 * ```
 * ① 부분문자열 과매치 — `LISTING_PATH` 의 토큰 뒤가 `\/?`(선택) 라서
 *    **세그먼트 경계가 없다**:
 *      `/shopping/...`  → `shop` 이 매치   🔴 상품 상세가 LISTING_PAGE
 *      `/clothing/...`  → **`c` 가 매치**   🔴🔴 PoC 보고보다 **넓다**
 *      `/cart/...` `/contact` 도 같은 이유로 LISTING_PAGE
 *    ⟹ 🔴 「c 로 시작하는 **모든** 경로 세그먼트」가 목록으로 분류되고 있었다
 * ② `/p/<slug>` 상품 상세를 읽지 못한다 — PoC 실측 `answear.ro/p/…-b226ac010-…`
 *    (🔴 그 URL 에 **우리 품번이 그대로** 있었다)
 * ```
 *
 * 🔴 **범용 heuristic 을 넓히지 않는다**(CPO §4 · STOP 조건). 고치는 것은 **둘** 이다 —
 *    ⒜ 토큰에 **세그먼트 경계** 를 준다 ⒝ 기존 상품 접두 목록에 `p` 를 **하나** 더한다.
 */

describe("DISCOVERY-SEARCH-PROVIDER-02 §M1 — `shopping` 은 목록이 아니다", () => {
  /**
   * 🔴🔴 **내가 M1 을 쓸 때 몰랐던 «세 번째» 결함이 여기서 드러났다 — 그대로 적는다.**
   * ```
   * 수정 전  /id/shopping/kids/…-item-37035483.aspx → **LISTING_PAGE**(`shop` 과매치)
   * 수정 후  같은 URL                                → **UNKNOWN_PAGE**
   * ⟹ 🟢 과매치는 **사라졌다**(이 Sprint 의 목표). 🔴 그런데 PRODUCT_PAGE 도 아니다.
   * 원인  `PRODUCT_SUFFIX` 가 **`.html` 만** 본다 — farfetch 는 **`.aspx`** 다.
   * ```
   * 🔴 **`.aspx` 를 넣지 않았다**(CPO §4 · STOP 조건 — 범용 heuristic 과도 확대 금지):
   *    ⒜ 넣으려면 `NON_PRODUCT_FILE`(현재 `\.html?$` 전용)도 같이 넓혀야 하고
   *       그러면 `about.aspx` 류가 **상품으로 올라간다**
   *    ⒝ 근거가 **farfetch 한 사이트(N=1)** 이고, 🔴 그 사이트는 JSON-LD Product 가
   *       **없어서**(PoC 실측 0/6) PRODUCT_PAGE 가 돼도 Evidence 가 안 나온다
   *    ⟹ **CPO 판정 사안으로 올린다.** 이 계약은 **현재 상태를 고정** 하고, 열면 FAIL 한다.
   */
  it("M1 — shopping 과매치가 사라진다(🔴 단 `.aspx` 는 아직 상품 접미가 아니다)", () => {
    const farfetch =
      "https://www.farfetch.com/id/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-t-shirt-item-37035483.aspx";
    /** 🟢 이 Sprint 가 고친 것 — 더 이상 목록이 아니다. */
    expect(classifyUrlShape(farfetch)).not.toBe("LISTING_PAGE");
    /** 🔴 아직 남은 것 — `.aspx` 미지원이라 「모른다」에 머문다(CPO 판정 대기). */
    expect(classifyUrlShape(farfetch)).toBe("UNKNOWN_PAGE");
    /** 🟢 같은 모양이 `.html` 이면 **상품으로 올라간다** — 막는 것이 확장자뿐임을 고정한다. */
    expect(
      classifyUrlShape("https://www.farfetch.com/id/shopping/kids/bobo-choses-item-37035483.html"),
    ).toBe("PRODUCT_PAGE");
  });

  it("M1-b — 🔴 `shop` ⊂ `shopping` 부분문자열 과매치가 다시 생기면 FAIL 한다", () => {
    /** 🔴 이 세 줄이 과매치의 **직접 증거** 다 — 토큰이 세그먼트 전체여야 한다. */
    expect(classifyUrlShape("https://x.test/shopping/kids/item-123.aspx")).not.toBe("LISTING_PAGE");
    expect(classifyUrlShape("https://x.test/shopper/profile.html")).not.toBe("LISTING_PAGE");
    expect(classifyUrlShape("https://x.test/brandnew/story")).not.toBe("LISTING_PAGE");
  });

  it("M1-c — 🔴🔴 `c` 토큰도 경계가 없었다(PoC 보고보다 넓은 결함)", () => {
    /** `/clothing/` · `/cart/` · `/contact` 가 전부 LISTING_PAGE 였다. */
    expect(classifyUrlShape("https://x.test/clothing/mens/shirt-9981")).not.toBe("LISTING_PAGE");
    expect(classifyUrlShape("https://x.test/cart/view")).not.toBe("LISTING_PAGE");
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-02 §M2 — 진짜 목록은 그대로 목록이다(과수정 금지)", () => {
  it("M2 — shop/.../category → LISTING_PAGE", () => {
    expect(classifyUrlShape("https://x.test/shop/kids/tops")).toBe("LISTING_PAGE");
  });

  it("M2-b — 기존 목록 토큰 전수가 유지된다", () => {
    for (const path of [
      "/collections/kids",
      "/collection/aw26",
      "/category/tops",
      "/categories/kids",
      "/search/bobo",
      "/shop/kids",
      "/brand/bobo-choses",
      "/brands/bobo",
      "/c/1234",
    ]) {
      expect(classifyUrlShape(`https://x.test${path}`), path).toBe("LISTING_PAGE");
    }
  });

  it("M2-c — 🟢 상품 경로가 목록 «아래» 에 있으면 여전히 상품이다(기존 우선순위 유지)", () => {
    expect(classifyUrlShape("https://x.test/en-kr/collections/sale/products/voyage-dress-123")).toBe(
      "PRODUCT_PAGE",
    );
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-02 §M3 — `/p/` 상품 상세", () => {
  it("M3 — /p/...B226AC010... → PRODUCT_PAGE", () => {
    expect(
      classifyUrlShape(
        "https://answear.ro/p/bobo-choses-longsleeve-pentru-copii-din-bumbac-booty-ghosts-gri-b226ac010-1843935",
      ),
    ).toBe("PRODUCT_PAGE");
  });

  it("M3-b — 🔴 `/p` 단독(슬러그 없음)은 상품이 아니다(과도한 shortcut 금지)", () => {
    expect(classifyUrlShape("https://x.test/p")).not.toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://x.test/p/")).not.toBe("PRODUCT_PAGE");
  });

  it("M3-c — 🔴 `/p/index.html` 같은 비상품 파일은 여전히 걸러진다", () => {
    expect(classifyUrlShape("https://x.test/p/index.html")).toBe("UNKNOWN_PAGE");
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-02 §M4 — 기존 계약 회귀", () => {
  it("M4 — 기존 상품/비상품 판정이 그대로다", () => {
    /** 🟢 WU-073/075 가 고정한 모양들. */
    expect(classifyUrlShape("https://x.test/products/b226ac010-booty-ghosts")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://x.test/product/list.html?cate_no=110")).toBe("UNKNOWN_PAGE");
    expect(classifyUrlShape("https://x.test/about.html")).toBe("UNKNOWN_PAGE");
    expect(classifyUrlShape("https://x.test/")).toBe("UNKNOWN_PAGE");
    expect(classifyUrlShape("not a url")).toBe("UNUSABLE");
    expect(
      classifyUrlShape("https://wonderforkids.test/main-story-bubble-sweatshirt-grey-melange-fleece.html"),
    ).toBe("PRODUCT_PAGE");
  });

  it("M4-b — 🔴 Amazon/eBay 류 기존 접두가 유지된다", () => {
    expect(classifyUrlShape("https://x.test/dp/B00ABCDEFG")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://x.test/itm/123456789")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://x.test/goods/view-998")).toBe("PRODUCT_PAGE");
  });
});
