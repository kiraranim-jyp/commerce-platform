/**
 * N-4.09(대표님 지시, 긴급 고객 피드백 2026-08-24) — 쿠팡 상세페이지 기본
 * 블록 순서를 "상품 이미지 → 상품 설명 → 하단 공통 이미지 → 안내문구(기본
 * 비노출)"로 바꾼 뒤 assembleContentsFromBlocks() 실제 결과가 그 순서와
 * 일치하는지 확인한다. 순수 함수 회귀 테스트라 credential/DB 없이 동작한다.
 */
import { assembleContentsFromBlocks, defaultDetailBlocks } from "@commerce/listing";

const blocks = defaultDetailBlocks();
console.log("defaultDetailBlocks():");
for (const b of blocks) {
  console.log(`  ${b.kind}${"position" in b ? `(${b.position})` : ""}${"section" in b ? `(${b.section})` : ""} enabled=${b.enabled}`);
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

assertEqual(blocks.find((b) => b.kind === "PRODUCT_IMAGES")?.enabled, true, "PRODUCT_IMAGES enabled by default");
assertEqual(blocks.find((b) => b.kind === "AI_DESCRIPTION")?.enabled, true, "AI_DESCRIPTION enabled by default");
assertEqual(
  blocks.find((b) => b.kind === "COMMON_IMAGE" && b.position === "bottom")?.enabled,
  true,
  "bottom COMMON_IMAGE enabled by default",
);
assertEqual(
  blocks.find((b) => b.kind === "COMMON_IMAGE" && b.position === "top")?.enabled,
  false,
  "top COMMON_IMAGE disabled by default (blocked instance still present so it stays togglable)",
);
for (const section of ["shipping", "exchange", "return", "agentBuy", "as"] as const) {
  assertEqual(
    blocks.find((b) => b.kind === "TEMPLATE_SECTION" && b.section === section)?.enabled,
    false,
    `TEMPLATE_SECTION(${section}) disabled by default`,
  );
}

const contents = assembleContentsFromBlocks(blocks, {
  aiDescription: "테스트 상품 상세 설명입니다.",
  template: {
    shippingBlocks: [],
    exchangeBlocks: [],
    returnBlocks: [],
    agentBuyBlocks: [],
    asBlocks: [],
    shippingInfo: "배송 안내 문구",
    exchangeInfo: "교환 안내 문구",
    returnInfo: "반품 안내 문구",
    agentBuyInfo: "구매대행 안내 문구",
    asInfo: "AS 안내 문구",
  } as never,
  sellerConfig: {
    topCommonImageUrl: "https://example.com/top.jpg",
    topCommonImageEnabled: true,
    bottomCommonImageUrl: "https://example.com/bottom.jpg",
    bottomCommonImageEnabled: true,
  } as never,
  productImageUrls: ["https://example.com/p1.jpg", "https://example.com/p2.jpg"],
  sizeChartImageUrls: [],
});

console.log("\nassembleContentsFromBlocks() result order:");
const summary = contents.map((c) =>
  c.contentsType === "IMAGE" ? `IMAGE:${c.contentDetails[0]?.content}` : `TEXT:${c.contentDetails[0]?.content.split("\n")[0]}`,
);
for (const line of summary) console.log(`  ${line}`);

assertEqual(summary.length, 4, "exactly 4 content items (2 product images + description text + bottom image)");
assertEqual(summary[0], "IMAGE:https://example.com/p1.jpg", "content[0] = first product image");
assertEqual(summary[1], "IMAGE:https://example.com/p2.jpg", "content[1] = second product image");
assertEqual(summary[2], "TEXT:테스트 상품 상세 설명입니다.", "content[2] = AI description text");
assertEqual(summary[3], "IMAGE:https://example.com/bottom.jpg", "content[3] = bottom common image");
assertEqual(
  summary.some((s) => s.includes("배송") || s.includes("교환") || s.includes("반품") || s.includes("구매대행") || s.includes("AS 안내")),
  false,
  "no notice text (shipping/exchange/return/agentBuy/AS) appears by default",
);

if (process.exitCode === 1) {
  console.error("\n검증 실패 — 위 FAIL 항목 확인");
} else {
  console.log("\n전체 통과");
}
