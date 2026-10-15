/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A-ALT ③ — Discovery URL **identity/KPI 규격** (HTTP 0 · AI 0 · 비용 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 테스트가 잠그는 것은 **KPI 정의** 다 — 대조는 `identityKey` 로만,
 *    저장/표시는 `canonicalUrl`, 보고는 `rawSearchUrl`.
 * 🟢 실측된 왜곡(1/7 ↔ 2/7)을 **회귀 케이스로** 고정한다.
 */
import { describe, expect, it } from "vitest";
import { discoveryUrlRecord, matchesKnownPositive } from "../discovery-url-identity";

/** 🟢 WU-019A-ALT 실측 쌍 — DDG 가 준 장식 URL ↔ 알려진 정답. */
const KNOWN = "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt";
const FOUND_DECORATED =
  "https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt?utm_source=ddg&_pos=1";

describe("WU-019A-ALT ③ 세 층을 갈라 적는다", () => {
  it("🔴 한 호출에서 **셋이 동시에** 나온다 — 하나만 들고 다니지 못한다", () => {
    const r = discoveryUrlRecord(FOUND_DECORATED);
    expect(Object.keys(r).sort()).toEqual(["canonicalUrl", "identityKey", "rawSearchUrl", "shape"]);
    /** ① 원문은 **가공되지 않는다**(엔진이 무엇을 줬는지가 증거다). */
    expect(r.rawSearchUrl).toBe(FOUND_DECORATED);
    /** ② 추적·검색 파라미터만 걷히고 🔴 **로케일은 남는다**(시장 증거 보존). */
    expect(r.canonicalUrl).toBe("https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt");
    expect(r.canonicalUrl).not.toMatch(/utm_source|_pos/);
    /** ③ 같은 페이지 키. */
    expect(r.identityKey).toBe("https://bobochoses.com|b226ac010-booty-ghosts-t-shirt");
  });

  it("🔴🔴 **실측 왜곡 회귀** — 장식 URL 과 정답이 같은 `identityKey` 다(1/7 → 2/7 의 원인)", () => {
    expect(matchesKnownPositive(FOUND_DECORATED, KNOWN)).toBe(true);
    /** 🔴 문자열 대조로는 틀렸다 — 그것이 과소 집계(1/7)를 만들었다. */
    expect(FOUND_DECORATED.includes(KNOWN.replace("https://", ""))).toBe(false);
  });

  it("🔴 판매처는 **합치지 않는다** — 같은 handle 이라도 다른 샵이면 불일치", () => {
    expect(matchesKnownPositive("https://bobochoses.co.jp/products/b226ac010-booty-ghosts-t-shirt", KNOWN)).toBe(false);
  });

  it("🔴 다른 상품은 당연히 불일치", () => {
    expect(matchesKnownPositive("https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt", KNOWN)).toBe(false);
  });

  it("🔴 `identityKey` 를 만들 수 없으면 **맞았다고 하지 않는다**(null 은 불일치)", () => {
    const list = discoveryUrlRecord("https://bobochoses.com/collections/new-arrivals-kid");
    expect(list.identityKey).toBeNull();
    expect(matchesKnownPositive("https://bobochoses.com/collections/new-arrivals-kid", KNOWN)).toBe(false);
    /** 🟢 그래도 ①②는 남는다 — 「엔진이 목록 URL 을 줬다」는 사실이 증거다. */
    expect(list.rawSearchUrl).toContain("collections");
    expect(list.shape).not.toBe("PRODUCT_PAGE");
  });

  it("🟢 비-Shopify 식별 파라미터는 `identityKey` 에 **남는다**(WU-017-E2E 수정과 정합)", () => {
    const a = discoveryUrlRecord("https://www.foretforet.com/shop/shopdetail.html?branduid=10226592&utm_source=x");
    expect(a.identityKey).toContain("branduid=10226592");
    expect(a.identityKey).not.toContain("utm_source");
    /** 🔴 같은 샵의 다른 상품은 불일치여야 한다(쿼리를 떼면 둘이 같아진다). */
    expect(
      matchesKnownPositive(
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
        "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
      ),
    ).toBe(false);
  });

  it("🔴🔴 **대조는 양쪽을 같은 함수로** 통과시킨다 — 한쪽만 정규화하면 그것이 왜곡이다", () => {
    /** 정답 쪽이 장식돼 있어도 결과가 같아야 한다(비대칭이면 KPI 가 흔들린다). */
    expect(matchesKnownPositive(KNOWN, FOUND_DECORATED)).toBe(true);
    expect(matchesKnownPositive(FOUND_DECORATED, FOUND_DECORATED)).toBe(true);
  });

  it("🔴 알려진 성질을 숨기지 않는다 — Shopify `identityKey` 는 **로케일을 접는다**", () => {
    /** 🔴 그래서 ③으로 시장을 구분할 수 없다. 시장은 ②(canonicalUrl)가 들고 있다.
     *     🟢 정책이 바뀌면 이 단언이 FAIL 로 뒤집히고 그것이 수정의 증거다. */
    const global = discoveryUrlRecord(KNOWN);
    const kr = discoveryUrlRecord("https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt");
    expect(kr.identityKey).toBe(global.identityKey);
    expect(kr.canonicalUrl).not.toBe(global.canonicalUrl);
  });
});
