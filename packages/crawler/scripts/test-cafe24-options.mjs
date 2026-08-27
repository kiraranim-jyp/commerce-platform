#!/usr/bin/env node
// N-4.18-Q3 PART H-3-3(대표님 지시, 2026-08-27) — RULII/LOOXLOO/DEUXBEBE JSON-LD
// offers[] -> ProductOption[] 추출 회귀 테스트. test-match.mjs/test-model-code.mjs와
// 같은 컨벤션(node:assert만 사용, 신규 테스트 러너 추가 없음). 아래 JSON-LD는 실제
// 실측 curl 결과(2026-08-27)를 그대로 옮긴 것 — 지어낸 값 없음.
//
// 사용법: node --experimental-strip-types packages/crawler/scripts/test-cafe24-options.mjs
// (tsx로 실행: npx tsx packages/crawler/scripts/test-cafe24-options.mjs)

import assert from "node:assert/strict";
import { extractRuliiOptions } from "../src/comparison-search/rulii.ts";
import { extractLooxlooOptions } from "../src/comparison-search/looxloo.ts";
import { extractDeuxbebeOptions } from "../src/comparison-search/deuxbebe.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    failed += 1;
  }
}

function jsonLdHtml(product) {
  return `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body></body></html>`;
}

// 실측(2026-08-27, curl): RULII product_no=3360 "페페슈즈 도톰리본 쪼리샌들 1235.
// FGI/VLC Souffle Milk" — 8개 사이즈 옵션, 7개 OutOfStock + 1개 InStock(일부 품절
// 실사례). 기존 DETAIL_SOLDOUT_RE(전체 품절 판정)는 이 페이지에서 false(전체
// 품절 아님)를 반환함 — 옵션 중 1개가 InStock인 것과 모순되지 않음(교차검증 완료).
const RULII_OFFERS = [
  { name: "...1235. FGI/VLC Souffle Milk 24", price: 160000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000A" },
  { name: "...1235. FGI/VLC Souffle Milk 25", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000B" },
  { name: "...1235. FGI/VLC Souffle Milk 26", price: 170000, priceCurrency: "KRW", availability: "InStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000C" },
  { name: "...1235. FGI/VLC Souffle Milk 27", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000D" },
  { name: "...1235. FGI/VLC Souffle Milk 28", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000E" },
  { name: "...1235. FGI/VLC Souffle Milk 29", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000F" },
  { name: "...1235. FGI/VLC Souffle Milk 30", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000G" },
  { name: "...1235. FGI/VLC Souffle Milk 31", price: 170000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.rulii.co.kr/product/x/3360/?item_code=P0000EZG000H" },
];

test("H-3-3 RULII Test 1: 8개 옵션 전부 추출(실측 그대로)", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: RULII_OFFERS });
  const options = extractRuliiOptions(html);
  assert.equal(options?.length, 8);
});

test("H-3-3 RULII Test 2: 일부 품절 실사례(7 OutOfStock + 1 InStock) availability 보존", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: RULII_OFFERS });
  const options = extractRuliiOptions(html);
  const outOfStockCount = options.filter((o) => o.availability === false).length;
  const inStockCount = options.filter((o) => o.availability === true).length;
  assert.equal(outOfStockCount, 7);
  assert.equal(inStockCount, 1);
});

test("H-3-3 RULII Test 3: name/price/itemCode 원본 그대로 보존", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: RULII_OFFERS });
  const options = extractRuliiOptions(html);
  assert.equal(options[0].name, "...1235. FGI/VLC Souffle Milk 24");
  assert.equal(options[0].price, 160000);
  assert.equal(options[0].itemCode, "P0000EZG000A");
});

test("H-3-3 RULII Test 4: JSON-LD/offers 없으면 null(빈 배열과 구분)", () => {
  assert.equal(extractRuliiOptions("<html><body>no jsonld</body></html>"), null);
  const noOffers = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x" });
  assert.equal(extractRuliiOptions(noOffers), null);
});

// 실측(2026-08-27, curl): LOOXLOO product_no=11518 "보보쇼즈 Booo보쇼즈우븐팬츠
// (76A7D-410-02)" — 6개 사이즈 옵션, 전부 InStock(품절 사례는 이번 실측에서
// 찾지 못함 — 지어내지 않고 있는 그대로 반영).
const LOOXLOO_OFFERS = [
  { name: "...(76A7D-410-02) BLUE-100", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FE" },
  { name: "...(76A7D-410-02) BLUE-110", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FF" },
  { name: "...(76A7D-410-02) BLUE-120", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FG" },
  { name: "...(76A7D-410-02) BLUE-130", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FH" },
  { name: "...(76A7D-410-02) BLUE-140", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FI" },
  { name: "...(76A7D-410-02) BLUE-150", price: 195000, priceCurrency: "KRW", availability: "InStock", url: "https://www.looxloo.com/product/x/11518/?item_code=P0000RBA00FJ" },
];

test("H-3-3 LOOXLOO Test 1: 6개 옵션 전부 추출 + 전부 InStock(실측 그대로)", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: LOOXLOO_OFFERS });
  const options = extractLooxlooOptions(html);
  assert.equal(options?.length, 6);
  assert.ok(options.every((o) => o.availability === true));
});

test("H-3-3 LOOXLOO Test 2: 색상+사이즈 결합 옵션명을 억지로 분리하지 않고 원문 그대로 보존", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: LOOXLOO_OFFERS });
  const options = extractLooxlooOptions(html);
  assert.equal(options[0].name, "...(76A7D-410-02) BLUE-100");
});

test("H-3-3 LOOXLOO Test 3: JSON-LD/offers 없으면 null", () => {
  assert.equal(extractLooxlooOptions("<html><body>no jsonld</body></html>"), null);
});

// 실측(2026-08-27, curl): DEUXBEBE product_no=18052 "로히트 셔츠 - 오트" — 완전
// 품절 실사례(6개 옵션 전부 OutOfStock). 기존 LISTING_SOLDOUT_RE/DETAIL_SOLDOUT_RE도
// 이 상품을 true(품절)로 판정 — 모순 없음(교차검증 완료).
const DEUXBEBE_SOLDOUT_OFFERS = [
  { name: "로히트 셔츠 - 오트 2-3y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000A" },
  { name: "로히트 셔츠 - 오트 3-4y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000B" },
  { name: "로히트 셔츠 - 오트 4-5y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000C" },
  { name: "로히트 셔츠 - 오트 5-6y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000D" },
  { name: "로히트 셔츠 - 오트 6-7y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000E" },
  { name: "로히트 셔츠 - 오트 7-8y", price: 215000, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18052/?item_code=P000BASI000F" },
];

test("H-3-3 DEUXBEBE Test 1: 완전 품절 실사례 -> 6개 전부 availability:false", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: DEUXBEBE_SOLDOUT_OFFERS });
  const options = extractDeuxbebeOptions(html);
  assert.equal(options?.length, 6);
  assert.ok(options.every((o) => o.availability === false));
});

// 실측(2026-08-27, curl): DEUXBEBE product_no=18047 "알리아 피나포어 드레스 -
// 라벤더" — 일부 품절 실사례(7개 옵션 중 4개 OutOfStock + 3개 InStock, 순서까지
// curl 원본 그대로: OutOfStock/InStock/InStock/OutOfStock/InStock/OutOfStock/
// OutOfStock). 기존 판정도 false(전체 품절 아님) — 모순 없음.
const DEUXBEBE_PARTIAL_OFFERS = [
  { name: "알리아 피나포어 드레스 - 라벤더 2-3y 나현님개인결제창", price: 271600, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000A" },
  { name: "알리아 피나포어 드레스 - 라벤더 3-4y", price: 271600, priceCurrency: "KRW", availability: "InStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000B" },
  { name: "알리아 피나포어 드레스 - 라벤더 4-5y", price: 271600, priceCurrency: "KRW", availability: "InStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000C" },
  { name: "알리아 피나포어 드레스 - 라벤더 5-6y", price: 271600, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000D" },
  { name: "알리아 피나포어 드레스 - 라벤더 6-7y", price: 271600, priceCurrency: "KRW", availability: "InStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000E" },
  { name: "알리아 피나포어 드레스 - 라벤더 7-8y", price: 271600, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000F" },
  { name: "알리아 피나포어 드레스 - 라벤더 8-9y", price: 271600, priceCurrency: "KRW", availability: "OutOfStock", url: "https://www.deuxbebe.com/product/x/18047/?item_code=P000BASD000G" },
];

test("H-3-3 DEUXBEBE Test 2: 일부 품절 실사례(4 OutOfStock + 3 InStock) 그대로 보존", () => {
  const html = jsonLdHtml({ "@context": "https://schema.org", "@type": "Product", name: "x", offers: DEUXBEBE_PARTIAL_OFFERS });
  const options = extractDeuxbebeOptions(html);
  const outOfStockCount = options.filter((o) => o.availability === false).length;
  const inStockCount = options.filter((o) => o.availability === true).length;
  assert.equal(outOfStockCount, 4);
  assert.equal(inStockCount, 3);
});

test("H-3-3 DEUXBEBE Test 3: JSON-LD/offers 없으면 null", () => {
  assert.equal(extractDeuxbebeOptions("<html><body>no jsonld</body></html>"), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
