/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-009 C — **저장용 원본 URL 정규화** (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 fixture 는 **실측값** 이다 — WU-008 에서 운영 DB `product_snapshots` 에
 *    실제로 들어 있던 두 행이다(날조 0):
 * ```
 * bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket?utm_source=chatgpt.com
 * bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket
 * ```
 * 🔴 **시장은 합치지 않는다** — `.co.jp` ↔ `.com` ↔ `/en-kr` 는 서로 다른 시장이다.
 * 🔴 AI 0 · 외부 호출 0 · 임계값 0 · Registry 0.
 */
import { describe, expect, it } from "vitest";
import { canonicalizeProductUrl } from "../self-reference";

const JP = "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket";

describe("WU-009 C ① 실측 중복을 하나로 모은다", () => {
  it("🔴🔴 `?utm_source=` 만 다른 두 URL 이 **같아진다**", () => {
    expect(canonicalizeProductUrl(`${JP}?utm_source=chatgpt.com`)).toBe(JP);
    expect(canonicalizeProductUrl(JP)).toBe(JP);
    expect(canonicalizeProductUrl(`${JP}?utm_source=chatgpt.com`)).toBe(canonicalizeProductUrl(JP));
  });

  it("추적 파라미터 전반이 제거된다", () => {
    for (const q of [
      "utm_source=a&utm_medium=b&utm_campaign=c",
      "fbclid=xxx",
      "gclid=yyy",
      "igshid=zzz",
      "srsltid=www",
    ]) {
      expect(canonicalizeProductUrl(`${JP}?${q}`)).toBe(JP);
    }
  });

  it("Shopify 검색/컬렉션 문맥(밑줄) 파라미터도 제거된다", () => {
    expect(canonicalizeProductUrl(`${JP}?_pos=1&_psq=Bobo+Choses+B226AC117&_psid=x&_ss=e`)).toBe(JP);
  });
});

describe("WU-009 C ② 🔴 시장·식별 정보는 **보존** 한다", () => {
  it("host 를 합치지 않는다 — `.co.jp` 와 `.com` 은 다른 스토어다", () => {
    const com = "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket";
    expect(canonicalizeProductUrl(`${com}?utm_source=x`)).toBe(com);
    /** 🔴 두 스토어가 **같은 URL 이 되지 않는다.** */
    expect(canonicalizeProductUrl(`${com}?utm_source=x`)).not.toBe(canonicalizeProductUrl(`${JP}?utm_source=x`));
  });

  it("🔴 로케일 경로를 떼지 않는다 — `/en-kr/` 은 **다른 시장** 이다", () => {
    const kr = "https://bobochoses.com/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket";
    const global = "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket";
    expect(canonicalizeProductUrl(`${kr}?utm_source=x`)).toBe(kr);
    expect(canonicalizeProductUrl(kr)).not.toBe(canonicalizeProductUrl(global));
  });

  it("식별 파라미터는 남는다 — variant / product_no / branduid", () => {
    const a = "https://bobochoses.com/products/x?variant=40096037535807";
    expect(canonicalizeProductUrl(a)).toBe(a);
    const b = "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=6";
    expect(canonicalizeProductUrl(b)).toBe(b);
    const c = "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592";
    expect(canonicalizeProductUrl(c)).toBe(c);
  });

  it("혼합 쿼리에서 **추적만** 골라 제거한다", () => {
    expect(canonicalizeProductUrl("https://a.com/products/x?variant=12&utm_source=y&_psq=z&cate_no=6")).toBe(
      "https://a.com/products/x?variant=12&cate_no=6",
    );
  });

  it("🟢 제거할 것이 없으면 **입력을 그대로** 돌려준다 (재직렬화 없음)", () => {
    const raw = "https://A.com/Products/X?b=2&a=1";
    expect(canonicalizeProductUrl(raw)).toBe(raw);
    /** 🔴 대소문자·파라미터 순서·끝 슬래시를 **바꾸지 않는다** — 저장용 URL 은 열려야 한다. */
    expect(canonicalizeProductUrl("https://a.com/x/")).toBe("https://a.com/x/");
  });

  it("열 수 없는 입력은 그대로 통과시킨다 (저장을 막지 않는다)", () => {
    expect(canonicalizeProductUrl("/products/x?utm_source=a")).toBe("/products/x?utm_source=a");
    expect(canonicalizeProductUrl("")).toBe("");
    expect(canonicalizeProductUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
  });
});
