#!/usr/bin/env node
// 7개 대상 사이트에 대한 회귀 테스트. /api/extractor-test를 호출해서 각 사이트가
// 최소 1장 이상의 상품 이미지를 뽑아내는지 확인한다. 배경제거/분류 등 뒷단 파이프라인은
// 건드리지 않고 추출 단계만 검증한다(빠르고, 실패 원인이 추출인지 아닌지 바로 구분됨).
//
// 사용법: node packages/crawler/scripts/test-sites.mjs [baseUrl]
// 기본 baseUrl은 http://localhost:3000

const BASE = process.argv[2] || "http://localhost:3000";

const SITES = [
  ["LojaDada", "https://www.lojadada.com/en/leggings/10855-dices-aop-leggings.html"],
  [
    "JuniorEdition",
    "https://www.junioredition.com/en-kr/collections/bobo-choses/products/tangerine-all-over-baby-swim-cap-by-bobo-choses",
  ],
  ["LillaMode", "https://www.lillamode.com/sv/accessoarer/16989-bobo-choses-flip-flops.html"],
  ["Zalando", "https://www.zalando.nl/bobo-choses-bobo-choses-pop-hoodie-khaki-b5t24k00d-n11.html"],
  ["BoboChoses", "https://bobochoses.com/products/b126ac009-van-dog-t-shirt"],
  ["SummerMade", "https://summermade.com/products/bobo-choses-by-hand-t-shirt"],
  [
    "Babyshop",
    "https://www.babyshop.com/de-de/p/bobo-choses-bucket-hat-multicolor/BC-B126AI047-991",
  ],
];

async function testSite(name, url) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/api/extractor-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(90000),
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const data = await res.json();
    if (!res.ok || data.error) {
      return { name, url, pass: false, reason: data.error || `HTTP ${res.status}`, elapsed };
    }
    const finalCount = data.images?.length ?? 0;
    const strategyCounts = data.strategyCounts ?? {};
    const usedStrategies =
      Object.entries(strategyCounts)
        .filter(([, c]) => c > 0)
        .map(([s]) => s)
        .join("+") || "none";
    return {
      name,
      url,
      pass: finalCount >= 1,
      finalCount,
      candidates: data.trace?.length ?? 0,
      excluded: data.trace?.filter((t) => !t.included).length ?? 0,
      usedStrategies,
      elapsed,
    };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { name, url, pass: false, reason: String(err?.message ?? err), elapsed };
  }
}

const results = [];
for (const [name, url] of SITES) {
  const result = await testSite(name, url);
  results.push(result);
}

console.log("=== Regression: 7-site extraction test ===");
let passCount = 0;
for (const r of results) {
  const status = r.pass ? "PASS" : "FAIL";
  if (r.pass) passCount++;
  console.log(
    `${r.name.padEnd(15)} ${status}  final=${r.finalCount ?? "-"} candidates=${r.candidates ?? "-"} excluded=${r.excluded ?? "-"} strategies=${r.usedStrategies ?? "-"} time=${r.elapsed}s${r.reason ? " reason=" + r.reason.split("\n")[0] : ""}`,
  );
}
console.log(`\n${passCount}/${SITES.length} passed`);

if (passCount === 0) process.exit(1);
