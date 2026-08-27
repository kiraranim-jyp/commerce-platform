#!/usr/bin/env node
// N-4.18-Q3 PART H-3-2(대표님 지시, 2026-08-27) — FORETFORET mpn 추출 + modelCode
// 비교(exact/partial/unavailable/conflict) 회귀 테스트. test-match.mjs와 같은 컨벤션
// (node:assert만 사용, 신규 테스트 러너 추가 없음).
//
// 사용법: node packages/crawler/scripts/test-model-code.mjs

import assert from "node:assert/strict";
import { extractProductCode } from "../src/description-facts.ts";
import { extractForetforetModelCode } from "../src/comparison-search/foretforet.ts";
import { compareModelCode, extractForeignModelCode } from "../src/comparison-search/model-code.ts";

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

// N-4.18-Q3 PART H-3-2 — 실측 확인(2026-08-27, curl foretforet.com
// branduid=10226592): 상세페이지 JSON-LD Product 블록에 이 형태 그대로 mpn이
// 있다(값 자체는 실제 실측값 PP24KASHE1195NER). 두 번째 JSON-LD 블록은 실측에서
// 홑따옴표를 쓰는 비표준 형식이라 JSON.parse가 실패하는 것도 함께 재현한다.
const FORET_DETAIL_HTML = `
<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER","sku":"040000036758","mpn":"PP24KASHE1195NER","brand":{"@type":"Brand","name":"PEPE SHOES"},"offers":{"@type":"Offer","price":258000,"priceCurrency":"KRW","availability":"https://schema.org/InStock"}}</script>
<script type="application/ld+json">{'not': 'valid json, single quotes'}</script>
</head><body></body></html>
`;

test("H-3-2 Test 1: FORETFORET JSON-LD에서 mpn 추출 -> 실측 골든케이스 값", () => {
  const code = extractForetforetModelCode(FORET_DETAIL_HTML);
  assert.equal(code, "PP24KASHE1195NER");
});

test("H-3-2 Test 2: mpn이 없는 JSON-LD만 있으면 null(추측 금지)", () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"x"}</script>`;
  assert.equal(extractForetforetModelCode(html), null);
});

test("H-3-2 Test 3: JSON-LD 자체가 없으면 null", () => {
  assert.equal(extractForetforetModelCode("<html><body>no jsonld</body></html>"), null);
});

// N-4.18-Q3 PART H-3-2 — 실측 확인(junioredition.com PèPè "Lulu T Bar Shoes"
// 실제 body_html 전문): "Article code: 01195-VERNICE-NERO." 문장이 그대로 있다.
test("H-3-2 Test 4: 해외측 'Article code' 라벨 실측 추출 -> 하이픈 포함 값 그대로", () => {
  const description = "Article code: 01195-VERNICE-NERO. Colour - Vernice Nero (Black Patent).";
  assert.equal(extractForeignModelCode(description), "01195-VERNICE-NERO");
});

// N-4.19 회귀 — 하이픈 없는 기존 케이스(Bobo Choses)가 여전히 그대로 동작하는지.
test("H-3-2 Test 5: 기존 'Product code' 케이스(하이픈 없음) 회귀 유지", () => {
  const description = "Product code B226AC010 AW26 Made in Portugal.";
  assert.equal(extractProductCode(description), "B226AC010");
  assert.equal(extractForeignModelCode(description), "B226AC010");
});

test("H-3-2 Test 6: description 자체가 없으면 null", () => {
  assert.equal(extractForeignModelCode(undefined), null);
});

// N-4.18-Q3 PART H-3-2 — 실측 골든케이스 정직한 결과: 해외 "01195-VERNICE-NERO"와
// 국내 "PP24KASHE1195NER"는 문자열 전체가 다르지만 "1195"(4자리 숫자)를 공유한다.
// 완전 일치가 아니므로 "exact"가 아니라 "partial"이어야 한다(대표님 예시는
// 설명용 이상적 결과였고, 실측값은 다르다 — 있는 그대로 보고).
test("H-3-2 Test 7 [실측 골든케이스]: 해외 Article code vs 국내 mpn -> partial(exact 아님)", () => {
  const result = compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER");
  assert.equal(result, "partial", `실제로는 exact가 아니라 partial이어야 함, got ${result}`);
});

test("H-3-2 Test 8: 정규화 후 완전히 같은 코드 -> exact", () => {
  assert.equal(compareModelCode("B226AC010", "B226AC010"), "exact");
  assert.equal(compareModelCode("b226-ac010", "B226AC010"), "exact", "대소문자/하이픈 차이만 있으면 정규화 후 exact");
});

test("H-3-2 Test 9: 한쪽만 있음 -> unavailable(비교 자체를 못 함)", () => {
  assert.equal(compareModelCode("B226AC010", null), "unavailable");
  assert.equal(compareModelCode(null, "PP24KASHE1195NER"), "unavailable");
  assert.equal(compareModelCode(null, null), "unavailable");
});

test("H-3-2 Test 10: 양쪽 다 있는데 공통점이 거의 없음 -> conflict", () => {
  const result = compareModelCode("B226AC010", "XYZ999QRS");
  assert.equal(result, "conflict");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
