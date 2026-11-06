/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IPES PHASE D — **상세설명 식별정보가 «검색 쿼리» 에 닿는가**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 합격 조건: 「추출에 그치지 말고 **그 값이 실제 검색 쿼리와 후보 재발견에
 *    반영됐는지까지** 증명해야 한다」.
 *
 * 🔴🔴 그래서 **운영 owner 를 그대로 부른다**(헌장 §5-B · 복제식 금지) —
 *    `buildProductIdentityDna` → `buildCrossSellerSearchQueries` ·
 *    `buildDomesticShopQuery`. 🔴 내가 품번을 다시 뽑지 않는다.
 *
 * 🟢 그리고 **반사실** 을 같이 잰다 — `description` 을 비운 CanonicalProduct 로
 *    같은 owner 를 한 번 더 불러 **쿼리가 어떻게 달라지는가** 를 본다.
 *    🔴 그것이 「설명문이 쿼리에 닿는다」의 유일한 직접 증거다.
 *
 * 🔴 DB 쓰기 0 · HTTP 0 · 새 검색 0 · 판정 0 · 운영 코드 변경 0.
 */
import { PrismaClient } from "@prisma/client";
import {
  buildProductIdentityDna,
  buildCrossSellerSearchQueries,
  buildDomesticShopQuery,
} from "../../shared/src/product-identity-dna.ts";

const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select id, source_url, workspace->'canonicalProduct' cp
    from product_snapshots
   where workspace->'canonicalProduct' is not null
   order by created_at desc`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  상세설명 → brandModelCode → 검색 쿼리  (운영 owner 직접 호출)");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log(`스냅샷 전수 ${rows.length}\n`);

const t = {
  dnaOk: 0,
  dnaFail: 0,
  code: 0,
  codeNull: 0,
  /** 🟢 반사실 — description 을 비우면 품번이 «사라지는» 스냅샷 = 설명문이 유일 출처 */
  codeOnlyFromDescr: 0,
  /** 🔴 설명문을 비워도 그대로 = 다른 출처(제목/slug)가 이미 준다 */
  codeFromElsewhere: 0,
  /** 🔴 둘 다 null */
  neverCode: 0,
  queryChanged: 0,
  domesticQueryChanged: 0,
  brandBlank: 0,
};
const examples = [];
const failures = [];

for (const r of rows) {
  const cp = r.cp;
  let dna, dnaNoDesc;
  try {
    dna = buildProductIdentityDna(cp);
    /** 🔴 **원본을 수정하지 않는다** — 얕은 복사로 description 만 비운 «사본» 을 만든다. */
    dnaNoDesc = buildProductIdentityDna({ ...cp, description: { value: "", source: "ORIGINAL", confidence: 0 } });
    t.dnaOk++;
  } catch (e) {
    t.dnaFail++;
    if (failures.length < 3) failures.push(`${String(r.source_url).slice(0, 60)} → ${String(e.message).slice(0, 80)}`);
    continue;
  }

  if (!dna.brand.value.trim()) t.brandBlank++;

  const c = dna.brandModelCode;
  const c0 = dnaNoDesc.brandModelCode;
  if (c) t.code++;
  else t.codeNull++;

  if (c && !c0) {
    t.codeOnlyFromDescr++;
    if (examples.length < 10)
      examples.push({ code: c, url: String(r.source_url).slice(0, 72), descrGone: true });
  } else if (c && c0) t.codeFromElsewhere++;
  else if (!c && !c0) t.neverCode++;

  const q = buildCrossSellerSearchQueries(dna).join(" | ");
  const q0 = buildCrossSellerSearchQueries(dnaNoDesc).join(" | ");
  if (q !== q0) t.queryChanged++;

  const dq = buildDomesticShopQuery(dna);
  const dq0 = buildDomesticShopQuery(dnaNoDesc);
  if (dq !== dq0) t.domesticQueryChanged++;
}

console.log("── 운영 DNA 산출 ──");
console.log(`  DNA 생성 성공 ${t.dnaOk} · 🔴 실패 ${t.dnaFail}`);
for (const f of failures) console.log(`     🔴 ${f}`);
console.log(`  brandModelCode 있음 ${t.code} · 🔴 null ${t.codeNull}`);
console.log(`  🔴 브랜드 빈값 ${t.brandBlank}`);

console.log("\n── 🟢🟢 반사실: description 을 비우면? ──");
console.log(`  🟢 품번이 **사라진다**(= 설명문이 유일 출처)   ${t.codeOnlyFromDescr}`);
console.log(`  🔴 품번이 그대로(= 제목/slug 가 이미 준다)      ${t.codeFromElsewhere}`);
console.log(`  🔴 둘 다 null(= 어디에도 품번이 없다)           ${t.neverCode}`);
console.log(`  🟢🟢 해외 검색 쿼리가 **달라진다**              ${t.queryChanged}`);
console.log(`  🟢🟢 국내 샵 검색 쿼리가 **달라진다**           ${t.domesticQueryChanged}`);

if (examples.length) {
  console.log("\n🟢 설명문이 유일 출처인 품번(= 설명문을 빼면 검색어가 죽는다):");
  for (const x of examples) console.log(`    ${x.code.padEnd(20)} ${x.url}`);
}

/* ── B226AC009 파일럿 한 건을 쿼리 문자열까지 보여 준다 ───────────────── */
const pilot = rows.find((r) => /bobochoses\.com\/en-kr\/products\/b226ac009/i.test(r.source_url));
if (pilot) {
  const dna = buildProductIdentityDna(pilot.cp);
  console.log("\n── 🔵 B226AC009 파일럿 · 운영 쿼리 원문 ──");
  console.log(`  brand=${JSON.stringify(dna.brand)} brandModelCode=${JSON.stringify(dna.brandModelCode)}`);
  console.log(`  identifier=${JSON.stringify(dna.identifier)}`);
  console.log(`  국내 샵 쿼리  ▸ ${JSON.stringify(buildDomesticShopQuery(dna))}`);
  buildCrossSellerSearchQueries(dna).forEach((q, i) => console.log(`  해외 쿼리 ${i + 1} ▸ ${JSON.stringify(q)}`));
}

console.log("\n🔴 이 스크립트는 **읽기만** 했다 — DB 쓰기 0 · 판정 0 · 운영 코드 변경 0.");
await p.$disconnect();
