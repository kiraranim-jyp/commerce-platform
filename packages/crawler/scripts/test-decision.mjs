#!/usr/bin/env node
// N-4.18-Q3 PART H-3-5(대표님 지시, 2026-08-27) — Evidence 기반 자동확정/검토필요/
// 기존판단유지 결정 레이어 회귀 테스트. test-match.mjs 등과 같은 컨벤션
// (node:assert만 사용). 기존 scoreCandidateMatch/classifyMatchLevel은 여기서
// 다시 계산하지 않는다 — 이 함수가 재계산하지 않는다는 것 자체를 회귀로
// 고정한다(모든 테스트가 MatchResult를 완성된 입력으로만 받는다).
//
// 사용법: node --experimental-strip-types packages/crawler/scripts/test-decision.mjs
// (tsx로 실행: npx tsx packages/crawler/scripts/test-decision.mjs)

import assert from "node:assert/strict";
import { decideCandidateEvidence } from "../src/comparison-search/decision.ts";
import { compareModelCode } from "../src/comparison-search/model-code.ts";
import { classifyImageEvidence } from "../src/comparison-search/image-evidence.ts";

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

function match(level, confidence) {
  return { confidence, level, reasons: [] };
}

// N-4.18-Q3 PART H-3-5 실측 골든케이스 1 — PèPè(2026-08-27 production API 실측:
// confidence=0.71/level=medium). modelCode는 H-3-2 실측값 그대로("01195-VERNICE-NERO"
// vs "PP24KASHE1195NER" -> partial). image는 H-3-4 실측값 그대로(distance=86 ->
// weak_or_no_evidence). options는 해외측 추출 함수가 아직 없어 unavailable(정직).
test("H-3-5 골든케이스1(PèPè): medium + modelCode partial + image weak -> unchanged(강등 없음)", () => {
  const modelCode = compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER");
  const image = classifyImageEvidence(86);
  assert.equal(modelCode, "partial");
  assert.equal(image, "weak_or_no_evidence");
  const result = decideCandidateEvidence({
    match: match("medium", 0.71),
    modelCode,
    options: "unavailable",
    image,
  });
  assert.equal(result.decision, "unchanged");
});

// N-4.18-Q3 PART H-3-5 실측 골든케이스 2 — Bobo Choses(2026-08-27 production API
// 실측: confidence=1.0/level=very_high). modelCode/options/image 전부 이 사이트용
// 추출/비교 함수가 없어 unavailable(지어내지 않음) — 이 레이어가 very_high를
// 절대 건드리지 않아야 한다.
test("H-3-5 골든케이스2(Bobo Choses): very_high + 증거 전부 unavailable -> unchanged(건드리지 않음)", () => {
  const result = decideCandidateEvidence({
    match: match("very_high", 1.0),
    modelCode: "unavailable",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "unchanged");
});

// N-4.18-Q3 PART H-3-5 — 유사 오답 후보: 텍스트 매칭 자체는 high로 강하게 나왔지만
// (예: 같은 브랜드 다른 스타일 번호라 제목이 비슷함) modelCode가 실제로 다르면
// conflict다(H-3-2 실측 로직 그대로 재사용: 서로 무관한 두 코드).
test("H-3-5 유사 오답: 기존 매칭 high인데 modelCode conflict -> review_required(자동확정 금지)", () => {
  const modelCode = compareModelCode("B226AC010", "XYZ999QRS");
  assert.equal(modelCode, "conflict");
  const result = decideCandidateEvidence({
    match: match("high", 0.9),
    modelCode,
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "review_required");
});

test("H-3-5: modelCode conflict는 기존 level이 very_high여도 review_required로 강제 전환", () => {
  const result = decideCandidateEvidence({
    match: match("very_high", 0.98),
    modelCode: "conflict",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "review_required");
});

test("H-3-5: modelCode exact + 기존 high -> auto_confirm(대표님 예시 표 그대로)", () => {
  const modelCode = compareModelCode("B226AC010", "B226AC010");
  assert.equal(modelCode, "exact");
  const result = decideCandidateEvidence({
    match: match("high", 0.88),
    modelCode,
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "auto_confirm");
});

test("H-3-5: modelCode exact + 기존 very_high -> auto_confirm", () => {
  const result = decideCandidateEvidence({
    match: match("very_high", 0.97),
    modelCode: "exact",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "auto_confirm");
});

test("H-3-5 안전 경계: modelCode exact이어도 기존 level이 medium이면 auto_confirm 아님(임의 확장 금지)", () => {
  const result = decideCandidateEvidence({
    match: match("medium", 0.75),
    modelCode: "exact",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "unchanged");
});

test("H-3-5 안전 경계: modelCode exact이어도 기존 level이 low면 auto_confirm 아님", () => {
  const result = decideCandidateEvidence({
    match: match("low", 0.4),
    modelCode: "exact",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "unchanged");
});

// N-4.18-Q3 PART H-3-5 핵심 안전장치(대표님 지시, H-3-4 실측 반영) — 이미지
// weak_or_no_evidence/unavailable, 옵션 partial_overlap/unavailable은 절대
// 기존 very_high/high/medium 후보를 낮추지 않는다.
test("H-3-5 핵심 안전장치: image weak_or_no_evidence는 기존 very_high를 절대 강등하지 않는다", () => {
  const result = decideCandidateEvidence({
    match: match("very_high", 1.0),
    modelCode: "unavailable",
    options: "unavailable",
    image: "weak_or_no_evidence",
  });
  assert.equal(result.decision, "unchanged");
  assert.notEqual(result.decision, "review_required");
});

test("H-3-5: options strong_overlap 단독으로는 auto_confirm을 만들지 않는다(보조 근거일 뿐)", () => {
  const result = decideCandidateEvidence({
    match: match("medium", 0.72),
    modelCode: "unavailable",
    options: "strong_overlap",
    image: "unavailable",
  });
  assert.equal(result.decision, "unchanged");
});

test("H-3-5: image strong_match 단독으로는 auto_confirm을 만들지 않는다(보조 근거일 뿐)", () => {
  const result = decideCandidateEvidence({
    match: match("medium", 0.72),
    modelCode: "unavailable",
    options: "unavailable",
    image: "strong_match",
  });
  assert.equal(result.decision, "unchanged");
});

test("H-3-5: modelCode partial은 reasons에 보조 근거로만 기록되고 unchanged 유지", () => {
  const result = decideCandidateEvidence({
    match: match("high", 0.9),
    modelCode: "partial",
    options: "unavailable",
    image: "unavailable",
  });
  assert.equal(result.decision, "unchanged");
  assert.ok(result.reasons.some((r) => r.includes("부분 일치")));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
