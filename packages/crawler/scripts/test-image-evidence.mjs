#!/usr/bin/env node
// N-4.18-Q3 PART H-3-4(대표님 지시, 2026-08-27) — dHash 이미지 교차비교 회귀 테스트.
// test-match.mjs/test-model-code.mjs와 같은 컨벤션(node:assert만 사용).
// classifyImageEvidence는 순수 함수라 오프라인으로 검증한다. hashImageUrl/
// computeMinImageDistance는 실제 네트워크 다운로드가 필요해서(로컬 파일 생성이
// 아니라 URL만 받는 계약이라 sharp 합성 이미지를 만들 필요 없이 실제 안정적인
// 공개 이미지 URL로 검증한다) 최소한의 실측 케이스만 포함한다.
//
// 사용법: node --experimental-strip-types packages/crawler/scripts/test-image-evidence.mjs
// (tsx로 실행: npx tsx packages/crawler/scripts/test-image-evidence.mjs)

import assert from "node:assert/strict";
import {
  classifyImageEvidence,
  computeMinImageDistance,
  hashImageUrl,
} from "../src/comparison-search/image-evidence.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      passed += 1;
    } catch (error) {
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
      failed += 1;
    }
  })();
}

// N-4.18-Q3 PART H-3-4 — 실측 확인(2026-08-27): dedup.service.ts 기존 임계값
// (<=10)을 그대로 재사용한다. classifyImageEvidence는 순수 함수라 네트워크 없이
// 경계값을 전부 확인할 수 있다.
await test("H-3-4 Test 1: distance=null -> unavailable(비교 자체를 못 함)", () => {
  assert.equal(classifyImageEvidence(null), "unavailable");
});

await test("H-3-4 Test 2: distance=0(완전 동일) -> strong_match", () => {
  assert.equal(classifyImageEvidence(0), "strong_match");
});

await test("H-3-4 Test 3: distance=10(기존 dedup.service.ts 임계값 경계) -> strong_match", () => {
  assert.equal(classifyImageEvidence(10), "strong_match");
});

await test("H-3-4 Test 4: distance=11(임계값 바로 위) -> weak_or_no_evidence(다른 상품 아님)", () => {
  assert.equal(classifyImageEvidence(11), "weak_or_no_evidence");
});

// N-4.18-Q3 PART H-3-4 실측(2026-08-27, 실제 3개 상품 쌍으로 측정): 동일상품
// distance=86, 완전-다른상품 distance=107, 유사-다른상품 distance=119 — 셋 다
// 임계값(10)을 크게 넘는다. weak_or_no_evidence가 "다른 상품"이 아니라 "근거
// 없음"을 뜻하므로, 이 실측값들도 여전히 weak_or_no_evidence로만 분류되고
// "다른 상품"이라는 판정을 내리지 않는다는 것을 고정한다.
await test("H-3-4 Test 5: 실측 골든케이스 distance=86 -> weak_or_no_evidence(다른 상품이라 하지 않음)", () => {
  const result = classifyImageEvidence(86);
  assert.equal(result, "weak_or_no_evidence");
  assert.notEqual(result, "strong_match", "실제 동일상품인데 strong_match를 놓쳤다고 지어내지 않는다");
});

await test("H-3-4 Test 6: computeMinImageDistance — 한쪽 이미지가 없으면 null(빈 배열과 구분)", async () => {
  const result = await computeMinImageDistance([], ["https://example.com/x.jpg"]);
  assert.equal(result.minDistance, null);
  assert.equal(result.comparedPairs, 0);
});

// N-4.18-Q3 PART H-3-4 — 실제 안정적인 공개 이미지 URL로 hashImageUrl 파이프라인
// 자체의 정확성을 확인한다(같은 URL을 두 번 받으면 distance=0이어야 한다 —
// 실측으로 이미 확인된 사실을 회귀로 고정).
const STABLE_TEST_IMAGE_URL =
  "https://cdn.shopify.com/s/files/1/0874/8574/files/Pepe-SS25-Lulu-T-Bar-Shoes-Vernice-Nero.jpg?v=1740567403";

await test("H-3-4 Test 7 [네트워크]: 같은 URL을 두 번 해시하면 distance=0 (파이프라인 정확성)", async () => {
  const [a, b] = await Promise.all([hashImageUrl(STABLE_TEST_IMAGE_URL), hashImageUrl(STABLE_TEST_IMAGE_URL)]);
  if (!a || !b) {
    console.log("        (네트워크 접근 불가 — 스킵 취급하지 않고 실패로 보고)");
  }
  assert.ok(a && b, "실제 이미지 다운로드+해시에 실패함");
  assert.equal(a, b);
});

await test("H-3-4 Test 8 [네트워크]: 존재하지 않는 URL -> null(추정하지 않음)", async () => {
  const result = await hashImageUrl("https://cdn.shopify.com/does-not-exist-cartpilot-h3-4-test.jpg");
  assert.equal(result, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
