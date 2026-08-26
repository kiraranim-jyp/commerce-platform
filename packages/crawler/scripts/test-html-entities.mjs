#!/usr/bin/env node
// N-4.18-P-7(대표님 지시, 2026-08-26) — decodeHtmlEntities() 단위 테스트.
// 네트워크 호출 없음(기존 test-match.mjs와 동일 패턴).
//
// 사용법: node packages/crawler/scripts/test-html-entities.mjs

import assert from "node:assert/strict";
import { decodeHtmlEntities } from "../src/comparison-search/html-entities.ts";
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

test("Test 1: Misha &amp; Puff -> Misha & Puff", () => {
  assert.equal(decodeHtmlEntities("Misha &amp; Puff"), "Misha & Puff");
});

test("Test 2: 일반 문자열 -> 변경 없음", () => {
  assert.equal(decodeHtmlEntities("Pèpè Shoes"), "Pèpè Shoes");
  assert.equal(decodeHtmlEntities("페페슈즈 플랫슈즈"), "페페슈즈 플랫슈즈");
});

test("Test 3: &lt; &gt; &quot; 정상 디코딩", () => {
  assert.equal(decodeHtmlEntities("&lt;tag&gt;"), "<tag>");
  assert.equal(decodeHtmlEntities("&quot;quoted&quot;"), '"quoted"');
});

test("Test 4: 숫자 엔티티(&#39; / &#x27;) 정상 디코딩", () => {
  assert.equal(decodeHtmlEntities("Kid&#39;s"), "Kid's");
  assert.equal(decodeHtmlEntities("Kid&#x27;s"), "Kid's");
});

test("Test 5: 이미 정상적인 & -> & 그대로 유지(세미콜론 없는 순수 &)", () => {
  assert.equal(decodeHtmlEntities("Tom & Jerry"), "Tom & Jerry");
});

test("Test 6: A.FEEFEE(엔티티 없음) -> 변경 없음, PèPè와 여전히 불일치", () => {
  const query = { title: "Ginevra Patent Leather Ballet Slippers in Black by PèPè", brand: "Pèpè Shoes" };
  const candidate = {
    title: decodeHtmlEntities("아페페양말 (35970-011-01)"),
    url: "https://www.looxloo.com/product/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    brand: decodeHtmlEntities("A.FEEFEE"),
  };
  const result = scoreCandidateMatch(query, candidate);
  assert.equal(result.confidence, 0, `decode가 새 오탐을 만들면 안 된다, got ${result.confidence}`);
});

test("Test 7: LOOXLOO 실측 형태(Misha &amp; Puff, 공백 있음) 디코딩 후 브랜드 일치", () => {
  const query = { title: "WN 골디헤어핀세트", brand: "Misha & Puff" };
  const candidate = {
    title: "미샤앤퍼프 WN골디헤어핀세트 (76A7A-872-04)",
    url: "https://www.looxloo.com/product/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    brand: decodeHtmlEntities("Misha &amp; Puff"),
  };
  const result = scoreCandidateMatch(query, candidate);
  assert.ok(result.reasons.includes("브랜드 일치"), `decode 후 브랜드 일치해야 함, reasons=${JSON.stringify(result.reasons)}`);
});

test("Test 7b(참고, 정직한 잔여 gap): RULII/DEUXBEBE 실측 형태(공백 없는 misha&amp;puff)는 디코딩해도 공백차이로 여전히 불일치 — 새 오탐은 아님(low 유지)", () => {
  const query = { title: "Scout Top- String", brand: "Misha & Puff" };
  const candidate = {
    title: "미샤앤퍼프 스카우트 탑- 스트링 [K3000-298] Scout Top- String",
    url: "https://www.rulii.co.kr/product/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    brand: decodeHtmlEntities("Misha&amp;Puff"),
  };
  const result = scoreCandidateMatch(query, candidate);
  assert.equal(result.level, "low", `공백 차이로 인한 잔여 불일치는 이번 fix 범위 밖 — low 유지만 확인, got ${result.level}`);
});

test("Test 8: Bobo Choses(엔티티 없음) 회귀 — 대소문자만 다른 기존 매칭 결과 불변", () => {
  const query = { title: "Van Dog T-shirt", brand: "Bobo Choses" };
  const candidate = {
    title: decodeHtmlEntities("보보쇼즈 Van Dog T-shirt"),
    url: "https://www.looxloo.com/product/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    brand: decodeHtmlEntities("BOBO CHOSES"),
  };
  const result = scoreCandidateMatch(query, candidate);
  assert.ok(result.reasons.includes("브랜드 일치"), `기존처럼 브랜드 일치해야 함, reasons=${JSON.stringify(result.reasons)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
