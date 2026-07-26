#!/usr/bin/env node
// 상품 갤러리 범위 + PRODUCT 배경제거 후보 보존 정책 회귀 테스트.
// 두 실제 케이스를 고정한다:
//   1. Smallable — __NEXT_DATA__에 섞여 있던 브랜드 캐러셀/추천상품 이미지가
//      상품 이미지로 잘못 수집되던 문제 (next-data.strategy.ts 스코핑 버그).
//   2. LillaMode — PRODUCT로 분류된 이미지 4장 모두 배경제거가 "시도"는 되지만
//      품질 미달 시 결과를 통째로 버리던 문제 (원본/누끼 후보 이중 보존 정책).
//
// 사용법: node packages/crawler/scripts/test-gallery-scope.mjs [baseUrl]
// 기본 baseUrl은 http://localhost:3034 (미지정 시)

const BASE = process.argv[2] || "http://localhost:3034";

const SMALLABLE_URL =
  "https://www.smallable.com/en/product/bobo-organic-cotton-t-shirt-pale-pink-bobo-choses-430631?algsearch=8a468cb59a6e85f2fdb1b9ee8aa9eae8";
const LILLAMODE_URL = "https://www.lillamode.com/sv/accessoarer/16989-bobo-choses-flip-flops.html";

// Smallable 페이지의 __NEXT_DATA__에서 실제로 관찰된 노이즈 — 브랜드 캐러셀 항목들.
// 이 중 하나라도 최종 이미지 목록에 다시 나타나면 회귀다.
const SMALLABLE_NOISE_MARKERS = [
  "emileetida",
  "oliver_furniture",
  "main_sauvage",
  "charlie_crane",
  "liewood",
  "nobodinoz",
];

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ ${message}`);
    failures++;
  }
}

async function extract(url) {
  const res = await fetch(`${BASE}/api/extractor-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function pipeline(url) {
  const res = await fetch(`${BASE}/api/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  const events = lines.map((l) => JSON.parse(l.slice(6)));
  const complete = events.find((e) => e.type === "complete");
  const error = events.find((e) => e.type === "error");
  if (!complete) {
    throw new Error(error?.error || "complete 이벤트를 받지 못했습니다.");
  }
  return complete;
}

async function testSmallableGalleryScope() {
  console.log("\n=== Smallable: 상품 갤러리 범위 (추천상품/브랜드 캐러셀 제외) ===");
  const data = await extract(SMALLABLE_URL);
  const urls = data.images.map((img) => img.url);

  assert(
    urls.length >= 1 && urls.length <= 8,
    `최종 이미지 개수가 합리적인 범위(1~8장)다 — 실제: ${urls.length}장`,
  );
  assert(
    urls.every((u) => u.includes("smallable.com")),
    "모든 최종 이미지가 smallable.com 도메인이다(다른 사이트 이미지 없음)",
  );

  const noiseFound = urls.filter((u) =>
    SMALLABLE_NOISE_MARKERS.some((marker) => u.toLowerCase().includes(marker)),
  );
  assert(
    noiseFound.length === 0,
    `브랜드 캐러셀 노이즈가 섞이지 않았다 (발견: ${noiseFound.length}개)`,
  );
}

async function testLillaModeVariantPreservation() {
  console.log("\n=== LillaMode: PRODUCT 이미지 4장 모두 원본/누끼 후보 이중 보존 ===");
  const extraction = await extract(LILLAMODE_URL);
  assert(
    extraction.images.length === 4,
    `상품 갤러리 이미지 4장이 정확히 수집됐다 — 실제: ${extraction.images.length}장`,
  );
  assert(
    extraction.images.every((img) => img.url.includes("lillamode.com")),
    "모든 이미지가 lillamode.com 도메인이다",
  );

  const result = await pipeline(LILLAMODE_URL);
  const productItems = result.items.filter((item) => item.type === "PRODUCT");
  assert(productItems.length === 4, `PRODUCT로 분류된 이미지가 4장이다 — 실제: ${productItems.length}장`);

  const succeeded = productItems.filter((item) => item.status === "success");
  assert(succeeded.length === productItems.length, "PRODUCT 이미지 처리가 전부 성공했다");

  // 핵심 회귀 포인트: usedOriginal(원본이 기본으로 선택됨)이어도 배경제거 후보가
  // "대안(alternate)"으로 남아있어야 한다 — 예전에는 품질 미달 시 통째로 버려졌다.
  const withoutProcessedCandidate = succeeded.filter(
    (item) => item.usedOriginal !== false && item.alternateKind !== "PROCESSED",
  );
  assert(
    withoutProcessedCandidate.length === 0,
    `모든 PRODUCT 이미지가 배경제거 후보를 갖고 있다(기본 선택이거나 대안으로) — ` +
      `누락: ${withoutProcessedCandidate.map((i) => i.fileName).join(", ") || "없음"}`,
  );
  assert(
    succeeded.every((item) => item.isJPEG === true),
    "모든 PRODUCT 이미지가 유효한 JPEG로 표준화됐다",
  );
}

try {
  await testSmallableGalleryScope();
  await testLillaModeVariantPreservation();
} catch (error) {
  console.error(`\n❌ 테스트 실행 실패: ${error.message}`);
  failures++;
}

console.log(`\n${failures === 0 ? "✅ 전체 통과" : `❌ ${failures}건 실패`}`);
if (failures > 0) process.exit(1);
