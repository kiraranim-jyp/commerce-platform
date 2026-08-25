#!/usr/bin/env node
// Sprint B-1.2 — comparison-search 매칭 로직 회귀 테스트. 네트워크 호출 없이
// scoreCandidateMatch()만 직접 검증한다(신규 테스트 프레임워크 도입 없이, Node의
// 내장 TS 실행 지원 + node:assert만 사용 — packages/crawler에는 기존에 vitest 등
// 테스트 러너가 없었고, "신규 dependency 금지" 지시에 따라 새 devDependency를
// 추가하지 않는다).
//
// 사용법: node packages/crawler/scripts/test-match.mjs

import assert from "node:assert/strict";
import { scoreCandidateMatch } from "../src/comparison-search/match.ts";

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

// Test 1: 동일 brand + 동일 normalized title + 동일 color -> high confidence
test("Test 1: 브랜드+제목+색상 모두 일치 -> high confidence", () => {
  const query = { title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe Shoes" }),
  );
  assert.ok(result.confidence >= 0.8, `confidence should be >= 0.8, got ${result.confidence}`);
});

// Test 2: 동일 model + 다른 color -> confidence 감소
test("Test 2: 같은 모델, 다른 색상 -> 색상 일치 케이스보다 confidence 낮음", () => {
  const query = { title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe" };
  const sameColor = scoreCandidateMatch(query, candidate({ title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe" }));
  const diffColor = scoreCandidateMatch(query, candidate({ title: "Lucy Sandals in Black by Pepe", brand: "Pepe" }));
  assert.ok(diffColor.confidence < sameColor.confidence, "different color should score lower than same color");
});

// Test 3: brand mismatch -> confidence 크게 감소
test("Test 3: 브랜드 불일치 -> confidence 크게 감소", () => {
  const query = { title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe" };
  const matchBrand = scoreCandidateMatch(query, candidate({ title: "Lucy Sandals in Kava Brown by Pepe", brand: "Pepe" }));
  const mismatchBrand = scoreCandidateMatch(
    query,
    candidate({ title: "Lucy Sandals in Kava Brown by Other Brand", brand: "Other Brand" }),
  );
  assert.ok(mismatchBrand.confidence < 0.4, `brand mismatch should be low, got ${mismatchBrand.confidence}`);
  assert.ok(mismatchBrand.confidence < matchBrand.confidence * 0.5, "brand mismatch should drop well below brand match");
});

// Test 4: SKU/article code exact match -> 매우 높은 confidence
test("Test 4: SKU 정확히 일치 -> 매우 높은 confidence", () => {
  const query = { title: "Some Different Title Entirely", brand: "Unknown", sku: "LUCY/FAU-KASC" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Completely Different Text", sku: "LUCY/FAU-KASC" }),
  );
  assert.ok(result.confidence >= 0.9, `SKU exact match should be near-certain, got ${result.confidence}`);
});

// Test 5: title만 유사하고 brand가 다름 -> 동일상품으로 판단하지 않음
test("Test 5: 제목만 유사, 브랜드 다름 -> 낮은 confidence(동일상품 아님)", () => {
  const query = { title: "Girls Floral Jacquard Dress", brand: "Jessie and James London" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Girls Floral Jacquard Dress", brand: "Sarah Louise" }),
  );
  assert.ok(result.level === "low" || result.level === "medium", `expected low/medium, got ${result.level}`);
  assert.ok(result.confidence < 0.6, `expected < 0.6, got ${result.confidence}`);
});

// Test 6: 실제 회귀 케이스 — Junior Edition Lucy Cut Out Sandals
test("Test 6: Junior Edition 회귀 상품 -> 기존 60%보다 명확히 높은 동일상품 confidence", () => {
  const query = {
    title: "Lucy Cut Out Sandals in Kava Brown by PèPè",
    brand: "PèPè",
    sourceUrl: "https://www.junioredition.com/en-kr/products/lucy-cut-out-sandals-in-kava-brown-by-pepe",
  };
  const result = scoreCandidateMatch(
    query,
    candidate({
      title: "Lucy Cut Out Sandals in Kava Brown by PèPè",
      url: "https://www.junioredition.com/products/lucy-cut-out-sandals-in-kava-brown-by-pepe",
      brand: "Pèpè Shoes",
    }),
  );
  assert.ok(result.confidence > 0.6, `should clearly beat old 60%, got ${result.confidence}`);
  assert.ok(result.confidence >= 0.9, `expected near-certain match, got ${result.confidence}`);
  assert.equal(result.level, "very_high");
});

// N-4.18-I STEP I-6(대표님 지시, 2026-08-25) — 카테고리 신호의 5개 방어 케이스.
// 실측 결과(RULII/LOOXLOO/DEUXBEBE breadcrumb는 상품유형이 아니라 프로모션/
// 브랜드 그룹이라 못 씀 — match.ts 주석 참고)에 따라 카테고리는 제목 텍스트의
// 실제 상품유형 단어(원피스/바지/셔츠 등)로만 판단한다.

// Case A: 같은 SKU + 같은 색상 + PANTS -> 매우 높은 점수
test("STEP I-6 Case A: 같은 SKU+색상+카테고리(PANTS) -> 매우 높은 점수", () => {
  const query = { title: "Bobo Choses Denim Pants in Blue", brand: "Bobo Choses", sku: "B126AC050" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Bobo Choses Denim Trousers in Blue", brand: "Bobo Choses", sku: "B126AC050" }),
  );
  assert.ok(result.confidence >= 0.95, `expected >= 0.95, got ${result.confidence}`);
});

// Case B: 같은 브랜드 + 다른 SKU + PANTS -> SKU 불일치로 감점(카테고리 일치가 구제하지 않음)
test("STEP I-6 Case B: 같은 브랜드, 다른 SKU, 같은 카테고리 -> SKU 불일치로 낮은 점수", () => {
  const query = { title: "Bobo Choses Denim Pants in Blue", brand: "Bobo Choses", sku: "B126AC050" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Bobo Choses Denim Pants in Blue", brand: "Bobo Choses", sku: "B126AC999" }),
  );
  assert.ok(result.confidence < 0.7, `SKU mismatch should stay low despite same category, got ${result.confidence}`);
});

// Case C: 같은 모델 + 같은 색상 + TOP vs PANTS -> 카테고리 불일치로 강한 감점
test("STEP I-6 Case C: 같은 모델+색상, TOP vs PANTS -> 카테고리 불일치 강한 감점", () => {
  const query = { title: "Bobo Choses Stripe Shirt in Blue", brand: "Bobo Choses" };
  const withoutCategory = scoreCandidateMatch(
    query,
    candidate({ title: "Bobo Choses Stripe Top in Blue", brand: "Bobo Choses" }),
  );
  const mismatchCategory = scoreCandidateMatch(
    query,
    candidate({ title: "Bobo Choses Stripe Pants in Blue", brand: "Bobo Choses" }),
  );
  assert.ok(
    mismatchCategory.confidence < withoutCategory.confidence,
    `TOP vs PANTS should score lower than TOP vs TOP, got ${mismatchCategory.confidence} vs ${withoutCategory.confidence}`,
  );
  assert.ok(mismatchCategory.reasons.includes("카테고리 불일치"), "reasons should include 카테고리 불일치");
});

// Case D: 같은 모델 + 같은 색상 + 카테고리 정보 없음(둘 다 상품유형 단어 없음) -> 감점하지 않음
test("STEP I-6 Case D: 카테고리 정보 없음(양쪽 다) -> 카테고리로 감점하지 않는다", () => {
  const query = { title: "Bobo Choses Signature Piece in Blue", brand: "Bobo Choses" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Bobo Choses Signature Piece in Blue", brand: "Bobo Choses" }),
  );
  assert.ok(!result.reasons.includes("카테고리 불일치"), "no category info on either side must not be MISMATCH");
});

// Case E: 카테고리만 같고 브랜드/모델/SKU 전부 다름 -> 절대 동일상품 판정 금지
test("STEP I-6 Case E: 카테고리만 동일, 나머지 전부 불일치 -> 동일상품 아님", () => {
  const query = { title: "Bobo Choses Denim Pants in Blue", brand: "Bobo Choses", sku: "B126AC050" };
  const result = scoreCandidateMatch(
    query,
    candidate({ title: "Completely Unrelated Denim Pants in Red", brand: "Totally Different Brand", sku: "XYZ999" }),
  );
  assert.ok(result.level === "low", `category-only match must stay 'low', got ${result.level}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
