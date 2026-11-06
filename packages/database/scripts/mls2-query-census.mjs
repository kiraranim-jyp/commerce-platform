/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 §1 점검 — **영어·한글 질의가 «이미» 어디까지 나오는가**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §1: 「코드 변경 전에 아래 항목을 실제 코드와 테스트로 확인한다」.
 * 🔴🔴 그래서 **운영 질의 생산자 셋을 그대로 부른다**(복제식 금지 · 헌장 §5-B):
 *    `buildDomesticShopQuery` · `buildCrossSellerSearchQueries` · `buildDiscoveryQuerySet`.
 * 🔴 새 질의 규칙 0 · 새 alias 0 · DB 쓰기 0 · HTTP 0 · 판정 0.
 */
import { PrismaClient } from "@prisma/client";
import {
  buildProductIdentityDna,
  buildDomesticShopQuery,
  buildCrossSellerSearchQueries,
} from "../../shared/src/product-identity-dna.ts";
import { buildDiscoveryQuerySet } from "../../crawler/src/discovery-core/query-planner.ts";
import { lookupBrandAlias } from "../../crawler/src/comparison-search/brand-alias.ts";
import { extractProductCode } from "../../crawler/src/description-facts.ts";

const p = new PrismaClient();
const TARGETS = (process.env.MLS2_CODES ?? "b226ac009,b226ac033,b226ac110").split(",");

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 §1 — 운영 질의 생산자 셋의 실제 산출(영어 · 한글)");
console.log("══════════════════════════════════════════════════════════════════\n");

/* ── 전수 집계 먼저 ──────────────────────────────────────────────────────── */
const all = await p.$queryRawUnsafe(`
  select source_url, workspace->'canonicalProduct' cp from product_snapshots
   where workspace->'canonicalProduct' is not null order by created_at desc`);

let aliasHit = 0;
let koQuery = 0;
let koNone = 0;
const brandSet = new Map();
for (const r of all) {
  let dna;
  try {
    dna = buildProductIdentityDna(r.cp);
  } catch {
    continue;
  }
  const b = dna.brand.value.trim();
  if (b) brandSet.set(b, (brandSet.get(b) ?? 0) + 1);
  const alias = lookupBrandAlias(b || undefined);
  if (alias) aliasHit++;
  /** 🔴 실제 질의 집합을 불러 «한글 질의가 나오는가» 를 센다 — 추정하지 않는다. */
  const qs = buildDiscoveryQuerySet({
    brand: b || null,
    productName: dna.title,
    productCode: dna.brandModelCode,
    productType: dna.category?.value ?? null,
    color: dna.color,
    facts: null,
  });
  const ko = qs.filter((q) => /_KO$/.test(q.axis ?? "") || /[가-힣]/.test(q.text));
  if (ko.length > 0) koQuery++;
  else koNone++;
}

console.log("── 전수(스냅샷 " + all.length + ") ──");
console.log(`  🟢 한글 alias 가 등록된 브랜드의 스냅샷 ${aliasHit}`);
console.log(`  🟢 **한글 질의가 실제로 생성되는** 스냅샷 ${koQuery}`);
console.log(`  🔴 한글 질의가 **하나도 없는** 스냅샷 ${koNone}`);
const top = [...brandSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("\n  브랜드 분포(상위 12) — 🔴 alias 미등록은 한글 질의가 구조적으로 0 이다:");
for (const [b, n] of top) {
  const a = lookupBrandAlias(b);
  console.log(`    ${String(n).padStart(3)}  ${b.padEnd(30)} ${a ? `🟢 alias "${a}"` : "🔴 alias 없음"}`);
}

/* ── 파일럿 상품별 상세 ──────────────────────────────────────────────────── */
for (const t of TARGETS) {
  const rows = await p.$queryRawUnsafe(
    `select source_url, workspace->'canonicalProduct' cp from product_snapshots
      where source_url ilike $1 and workspace->'canonicalProduct' is not null
      order by created_at desc limit 1`,
    `%${t}%`,
  );
  if (rows.length === 0) {
    console.log(`\n▪ ${t.toUpperCase()} — 🔴 스냅샷 없음 ⟹ **측정불가**(0 으로 세지 않는다)`);
    continue;
  }
  const cp = rows[0].cp;
  const dna = buildProductIdentityDna(cp);
  const brand = dna.brand.value.trim();
  const alias = lookupBrandAlias(brand || undefined);
  const descr = cp.description?.value ?? "";

  console.log(`\n▪ ${t.toUpperCase()}  ${String(rows[0].source_url).slice(0, 64)}`);
  console.log(`   브랜드 ${JSON.stringify(brand)} · 한글 alias ${JSON.stringify(alias ?? null)}`);
  console.log(`   품번 ${JSON.stringify(dna.brandModelCode)} (설명문 라벨 추출 ${JSON.stringify(extractProductCode(descr) ?? null)})`);
  /** 🔴 한글 «상품명» 은 어디서 오는가 — 칸이 있어도 질의에 쓰이는지는 별개다. */
  console.log(`   titleKo ${JSON.stringify(cp.titleKo?.value ?? null)} (source ${cp.titleKo?.source ?? "-"})`);
  console.log(`   🇰🇷 국내 샵 질의 ▸ ${JSON.stringify(buildDomesticShopQuery(dna))}`);
  buildCrossSellerSearchQueries(dna).forEach((q, i) => console.log(`   🌎 교차 질의 ${i + 1} ▸ ${JSON.stringify(q)}`));
  const qs = buildDiscoveryQuerySet({
    brand: brand || null,
    productName: dna.title,
    productCode: dna.brandModelCode,
    productType: dna.category?.value ?? null,
    color: dna.color,
    facts: null,
  });
  console.log(`   🔎 Discovery 질의 ${qs.length}개:`);
  for (const q of qs) console.log(`        ${String(q.axis).padEnd(18)} ${JSON.stringify(q.text)}`);
}

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · HTTP 0 · 새 질의 규칙 0 · 새 alias 0 · 판정 0.");
await p.$disconnect();
