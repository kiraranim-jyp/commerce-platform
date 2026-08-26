// N-4.18-P-4 STEP P-4-13(대표님 지시, 2026-08-26) — Regression: 기존에 이미
// 성공하던 국내 4개 소스(LOOXLOO/RULII/CHOCO.EL/DEUXBEBE) 검색이 alias
// fallback 배선 이후에도 그대로 동작하는지, 그리고 원문에서 이미 결과가 있을
// 때는 querySource가 채워지지 않는지(= alias를 시도하지 않았다는 뜻) 확인한다.
//
// 사용법: npx tsx scripts/test-brand-alias-regression.mts
import { searchDomesticShops } from "../src/comparison-search/index";
import type { ComparisonQuery, DomesticSourceRef } from "../src/comparison-search/types";

const CASES: Array<{ source: DomesticSourceRef; query: ComparisonQuery }> = [
  {
    source: { id: "rulii", name: "RULII", domain: "rulii.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" },
    query: { title: "청바지", brand: "Bobo Choses", searchTerm: "청바지" },
  },
  {
    source: { id: "looxloo", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" },
    query: { title: "원피스", brand: "Some Brand", searchTerm: "원피스" },
  },
  {
    source: { id: "chocoel", name: "CHOCO.EL", domain: "chocoel.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" },
    query: { title: "니트", brand: "Some Brand", searchTerm: "니트" },
  },
  {
    source: { id: "deuxbebe", name: "DEUXBEBE", domain: "deuxbebe.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" },
    query: { title: "원피스", brand: "Some Brand", searchTerm: "원피스" },
  },
];

async function main() {
  let allOk = true;
  for (const { source, query } of CASES) {
    const [result] = await searchDomesticShops(query, [source]);
    const ok = result.status === "ok" && result.candidates.length > 0 && result.querySource === undefined;
    if (!ok) allOk = false;
    console.log(
      `${source.name}: status=${result.status} candidates=${result.candidates.length} querySource=${result.querySource ?? "(원문, 정상)"} -> ${ok ? "PASS" : "FAIL"}`,
    );
  }
  console.log(`\n${allOk ? "전체 PASS — 기존 4개 소스 회귀 없음, alias 미사용 확인" : "일부 FAIL"}`);
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
