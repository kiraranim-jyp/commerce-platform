#!/usr/bin/env node
// N-4.18-Q3 PART H-3-8(대표님 지시, 2026-08-27) — H-3-7 실측 중 발견된 title
// 노이즈 버그(junioredition.com "- Last Ones In Stock - 28-29 EUR" suffix가
// scoreCandidateMatch()의 title Jaccard 유사도를 희석시켜 PèPè golden case가
// medium(0.71)에서 low(0.67)로 떨어지는 문제) 회귀 테스트.
//
// 절대 원칙: scoreCandidateMatch()/classifyMatchLevel()의 계산식·threshold는
// 재현하지 않고 그대로 통과시킨다 — 이 테스트는 "정제된 title이 기존 함수에
// 그대로 들어갔을 때 실측값과 같은 결과가 나오는가"만 검증한다.
//
// 사용법: npx tsx packages/crawler/scripts/test-title-normalize.mjs

import assert from "node:assert/strict";
import { normalizeMatchingTitle } from "../src/comparison-search/title-normalize.ts";
import { scoreCandidateMatch, withConfidence } from "../src/comparison-search/match.ts";

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

// 실측(2026-08-27, H-3-7): 실제 PèPè production 스냅샷 title 그대로.
const PEPE_FULL_TITLE = "Lulu T Bar Shoes in Vernice Nero by PèPè - Last Ones In Stock - 28-29 EUR";
const PEPE_MULTI_SIZE_TITLE = "Bruno Cut Out Sandals in Lobelia Blue by PèPè - Last Ones In Stock - 20 EUR / 34 EUR";
// 실측(2026-08-27): FORETFORET 실제 후보(branduid=10226592), scoreCandidateMatch 재계산 없음 그대로 사용.
const FORETFORET_CANDIDATE = {
  title: "AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER",
  url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
  brand: "PEPE SHOES",
};

test("1) normalizeMatchingTitle: 'Last Ones In Stock' suffix만 제거, 앞부분 보존", () => {
  assert.equal(normalizeMatchingTitle(PEPE_FULL_TITLE), "Lulu T Bar Shoes in Vernice Nero by PèPè");
});

test("2) normalizeMatchingTitle: 슬래시로 이어진 복수 가격도 함께 제거(20 EUR / 34 EUR)", () => {
  assert.equal(
    normalizeMatchingTitle(PEPE_MULTI_SIZE_TITLE),
    "Bruno Cut Out Sandals in Lobelia Blue by PèPè",
  );
});

test("3) normalizeMatchingTitle: 패턴이 없는 title은 완전히 그대로 반환(오탐 없음)", () => {
  const clean = "Stamp Bloom All Over Denim Pants by Bobo Choses";
  assert.equal(normalizeMatchingTitle(clean), clean);
});

test("4) normalizeMatchingTitle: 'Stock'/'EUR' 단어가 있어도 트리거 문구가 없으면 손대지 않음", () => {
  const notNoise = "Stockholm Print Tote Bag - EUR Edition";
  assert.equal(normalizeMatchingTitle(notNoise), notNoise);
});

test("5) 정제 전(fixture 재현): PèPè golden case가 low로 오분류됨(H-3-7 실측 버그 고정)", () => {
  const result = scoreCandidateMatch(
    { title: PEPE_FULL_TITLE, brand: "Pèpè Shoes" },
    FORETFORET_CANDIDATE,
  );
  assert.equal(result.level, "low");
  assert.ok(result.confidence < 0.7, `버그 재현 실패 — confidence=${result.confidence}`);
});

test("6) 정제 후: withConfidence()를 통과하면 PèPè golden case가 medium 이상으로 회복", () => {
  const query = { title: PEPE_FULL_TITLE, brand: "Pèpè Shoes" };
  const [scored] = withConfidence(query, [FORETFORET_CANDIDATE]);
  assert.ok(scored.confidence >= 0.7, `회복 실패 — confidence=${scored.confidence}`);
  assert.equal(scored.matchLevel, "medium");
  // 원본 title은 결과 객체에서 그대로 보존되어야 한다(정제본은 계산 입력에만 쓰임).
  assert.equal(scored.title, FORETFORET_CANDIDATE.title);
});

test("7) 회귀: title 노이즈가 없는 Bobo Choses 실측 케이스는 결과 불변(1.0/EXACT급)", () => {
  const query = { title: "Stamp Bloom all over denim pants", brand: "Bobo Choses" };
  const candidate = { title: "Stamp Bloom all over denim pants", url: "https://bobochoses.com/x", brand: null };
  const [scored] = withConfidence(query, [candidate]);
  assert.equal(scored.confidence, 1);
  assert.equal(scored.matchLevel, "very_high");
});

test("8) 회귀: 무관 상품은 정규화 이후에도 여전히 low 유지(과교정 없음)", () => {
  const query = { title: PEPE_FULL_TITLE, brand: "Pèpè Shoes" };
  const unrelated = { title: "보보쇼즈 Paint Forest코듀셔츠", url: "https://looxloo.com/x", brand: "BOBO CHOSES" };
  const [scored] = withConfidence(query, [unrelated]);
  assert.equal(scored.matchLevel, "low");
});

test("9) 오탐 방지: 가격/재고 정보가 실제 상품명의 일부인 경우('20 EUR' 등 트리거 문구 없이 단독 등장) 잘못 삭제하지 않음", () => {
  // "Last Ones In Stock" 트리거 문구가 없으면, 가격/재고성 단어가 title 어디에
  // 있든(중간/끝) 절대 건드리지 않는다 — 진짜 상품명일 수 있으므로.
  const priceInName = "20 EUR Canvas Tote by Studio Nine";
  assert.equal(normalizeMatchingTitle(priceInName), priceInName);
  const stockInMiddle = "In Stock Now Limited Edition Sneakers by Acme";
  assert.equal(normalizeMatchingTitle(stockInMiddle), stockInMiddle);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
