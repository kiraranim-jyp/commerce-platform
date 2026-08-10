#!/usr/bin/env node
// Sprint B-1.8 — 상세 가격 확인 대상 선정(비용 상한) 회귀 테스트. 순수 함수만 골라
// price-confirmation.ts에 분리해뒀기 때문에(fetchShopifyProductJson 등 실제 네트워크
// 호출부와 분리) 네트워크/모킹 없이 바로 테스트한다(test-match.mjs와 같은 방식 —
// 신규 테스트 프레임워크 도입 없음).
//
// 사용법: node packages/crawler/scripts/test-price-confirmation.mjs

import assert from "node:assert/strict";
import {
  MAX_DETAIL_CONFIRMATIONS_PER_SHOP,
  selectCandidatesForDetailConfirmation,
} from "../src/comparison-search/price-confirmation.ts";

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

function candidate(overrides) {
  return { title: "", url: "https://example.com/products/x", price: null, imageUrl: null, confidence: 0, ...overrides };
}

// Test A: very_high 1위, high 2위, medium 3위 -> 상세 확인 대상은 최대 2건(1,2위만)
test("Test A: very_high+high+medium -> 상세 대상은 앞 2개(very_high, high)만", () => {
  const candidates = [
    candidate({ matchLevel: "very_high" }),
    candidate({ matchLevel: "high" }),
    candidate({ matchLevel: "medium" }),
  ];
  const selected = selectCandidatesForDetailConfirmation(candidates);
  assert.deepEqual(selected, [0, 1]);
  assert.ok(selected.length <= MAX_DETAIL_CONFIRMATIONS_PER_SHOP);
});

// Test D: medium/low 후보만 있으면 상세 확인 대상 0건
test("Test D: medium/low만 있으면 상세 확인 대상 0건", () => {
  const candidates = [candidate({ matchLevel: "medium" }), candidate({ matchLevel: "low" })];
  const selected = selectCandidatesForDetailConfirmation(candidates);
  assert.deepEqual(selected, []);
});

// very_high가 3개 이상이어도 상한(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)을 넘지 않는다
test("Test A-2: very_high가 3개여도 상세 대상은 상한(2)까지만", () => {
  const candidates = [
    candidate({ matchLevel: "very_high" }),
    candidate({ matchLevel: "very_high" }),
    candidate({ matchLevel: "very_high" }),
  ];
  const selected = selectCandidatesForDetailConfirmation(candidates);
  assert.equal(selected.length, MAX_DETAIL_CONFIRMATIONS_PER_SHOP);
});

// unsupported/빈 후보 목록이면 대상 0건(빈 배열이어도 에러 없이 동작)
test("Test E: 후보 없음 -> 상세 확인 대상 0건", () => {
  const selected = selectCandidatesForDetailConfirmation([]);
  assert.deepEqual(selected, []);
});

// (Test B: 상세 API 성공 -> priceSource="detail" / Test C: 상세 API 실패 -> priceSource="search"
// 유지는 실제 fetchShopifyProductJson 네트워크 호출이 필요해 이 파일에서는 검증하지 않는다
// — production 배포 후 실제 Junior Edition 상품으로 확인한다.)

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
