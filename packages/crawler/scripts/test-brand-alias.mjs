#!/usr/bin/env node
// N-4.18-P-4 STEP P-4-13(대표님 지시, 2026-08-26) — brand-alias.ts 순수 함수
// 단위테스트. 네트워크 호출 없음(신규 테스트 러너 dependency 추가 없이 기존
// test-match.mjs와 동일 패턴: node:assert + .ts 직접 import).
//
// 사용법: node packages/crawler/scripts/test-brand-alias.mjs

import assert from "node:assert/strict";
import { lookupBrandAlias } from "../src/comparison-search/brand-alias.ts";

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

test("Test 1: 실측 등록된 브랜드(PèPè Shoes) -> alias 페페 반환", () => {
  assert.equal(lookupBrandAlias("Pèpè Shoes"), "페페");
});

test("Test 2: 실측 등록된 브랜드(Emile et Ida) -> alias 에밀에이다 반환", () => {
  assert.equal(lookupBrandAlias("Emile et Ida"), "에밀에이다");
});

test("Test 3: 실측 등록된 브랜드(Konges Slojd Clothing, 실제 DB brand 필드값) -> alias 콩제슬래드 반환", () => {
  assert.equal(lookupBrandAlias("Konges Slojd Clothing"), "콩제슬래드");
});

test("Test 4: 대소문자/발음기호 차이 -> 여전히 같은 브랜드로 인식(match.ts normalizeText와 동일 원리)", () => {
  assert.equal(lookupBrandAlias("pepe shoes"), "페페");
  assert.equal(lookupBrandAlias("PEPE SHOES"), "페페");
});

test("Test 5: 등록되지 않은 브랜드(Bobo Choses) -> undefined(폴백 시도 안 함)", () => {
  assert.equal(lookupBrandAlias("Bobo Choses"), undefined);
});

test("Test 6: 표시용 타이틀 문자열(Konges Sløjd, 실제 brand 필드가 아닌 title 파생값) -> 등록 안 됨, undefined", () => {
  // brand-alias.ts는 CanonicalProduct.brand.value("Konges Slojd Clothing")만 등록한다.
  // "Konges Sløjd"(타이틀의 "by Konges Sløjd"에서 파생된 표시값)로는 매칭되지 않아야
  // 한다 — 새 alias를 추론하지 않는다는 원칙을 코드 수준에서도 지킨다.
  assert.equal(lookupBrandAlias("Konges Sløjd"), undefined);
});

test("Test 7: undefined/빈 문자열 brand -> undefined", () => {
  assert.equal(lookupBrandAlias(undefined), undefined);
  assert.equal(lookupBrandAlias(""), undefined);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
