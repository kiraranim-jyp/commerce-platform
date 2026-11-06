/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IPES PHASE D 선행 측정 — **상세설명이 기본정보를 얼마나 메우는가**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시 §5-3 의 **네 구분을 그대로** 센다 —
 *    기본정보만 확보 / 상세설명 추가 확보 / 양쪽 일치 / 양쪽 충돌
 *
 * 🔴🔴 **추출기를 새로 만들지 않는다.** 운영 추출기를 **그대로 import** 해서 돌린다
 *    (`extractProductCode` · `extractManufacturer` · `extractLabeledProductCode`).
 *    🔴 그래야 「측정값」과 「운영이 실제로 뽑는 값」이 같다(헌장 §5-B).
 * 🔴 DB 쓰기 0 · 새 HTTP 0 · 새 검색 0 · 원본 수정 0 · 판정 0.
 */
import { PrismaClient } from "@prisma/client";
import { extractProductCode, extractManufacturer } from "../../crawler/src/description-facts.ts";
import { extractLabeledProductCode } from "../../shared/src/product-facts.ts";

/** 🟢 브랜드 품번 «모양» — 라벨이 없어도 품번처럼 보이는 토큰을 찾는다.
 *  🔴 이것은 **측정용 관측기** 이고 운영 추출기가 아니다(판정에 쓰지 않는다). */
const CODE_SHAPE_RE = /\b([A-Z]{1,3}\d{3}[A-Z]{2}\d{3})\b/i;

const p = new PrismaClient();

/**
 * 🔴🔴 **칸 이름을 추측하지 않는다 — DB 키 전수로 확인했다**(이 트랙 13번째 함정).
 *    `productCode` 라는 칸은 **없다**. 실제 칸은 `sku` · `modelName` 이고,
 *    🟢 브랜드 품번은 **`variants[].sku`** 에 들어 있다(실측 `B226AC00945101`).
 */
const rows = await p.$queryRawUnsafe(`
  select id, source_url,
         workspace->'canonicalProduct'->'brand'->>'value'       brand,
         workspace->'canonicalProduct'->'brand'->>'source'      brand_src,
         workspace->'canonicalProduct'->'title'->>'value'       title,
         workspace->'canonicalProduct'->'sku'->>'value'         code,
         workspace->'canonicalProduct'->'modelName'->>'value'   model_name,
         (select string_agg(v->>'sku', ',')
            from jsonb_array_elements(
                   case when jsonb_typeof(workspace->'canonicalProduct'->'variants')='array'
                        then workspace->'canonicalProduct'->'variants' else '[]'::jsonb end) v) variant_skus,
         workspace->'canonicalProduct'->'description'->>'value'  descr
    from product_snapshots
   where workspace->'canonicalProduct' is not null
   order by created_at desc`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  상세설명 ↔ 기본정보 식별정보 격차 — 운영 추출기로 측정");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log(`스냅샷 전수 ${rows.length}\n`);

/** 🔴 URL 에 박힌 품번 — 「기본정보」가 아니라 **세 번째 출처** 다. 갈라서 센다. */
const codeFromUrl = (u) => /\/(?:products?|item)\/([a-z]\d{3}[a-z]{2}\d{3})/i.exec(u ?? "")?.[1] ?? null;

const tally = {
  descr_present: 0,
  descr_absent: 0,
  brand_basic: 0,
  brand_blank: 0,
  code_basic: 0,
  code_blank: 0,
  // §5-3 네 구분 — 상품코드
  code_basic_only: 0,
  code_descr_only: 0,
  code_both_equal: 0,
  code_both_conflict: 0,
  // 보조 관측
  code_url_only: 0,
  code_variant_only: 0,
  manuf_descr_only: 0,
  code_anywhere: 0,
  code_nowhere: 0,
};
const descrOnlyCode = [];
const conflicts = [];
const brandBlank = [];

for (const r of rows) {
  const d = r.descr ?? "";
  if (d.trim()) tally.descr_present++;
  else tally.descr_absent++;

  const brandBasic = (r.brand ?? "").trim();
  if (brandBasic) tally.brand_basic++;
  else {
    tally.brand_blank++;
    brandBlank.push({ url: r.source_url, src: r.brand_src, title: r.title });
  }

  const basicCode = (r.code ?? "").trim() || null;
  if (basicCode) tally.code_basic++;
  else tally.code_blank++;

  /** 🟢 운영 추출기 둘 + 모양 관측기 하나 */
  const dCode = extractProductCode(d) ?? extractLabeledProductCode(d) ?? CODE_SHAPE_RE.exec(d)?.[1] ?? null;
  const uCode = codeFromUrl(r.source_url);

  if (basicCode && !dCode) tally.code_basic_only++;
  else if (!basicCode && dCode) {
    tally.code_descr_only++;
    descrOnlyCode.push({ url: r.source_url, code: dCode, title: r.title });
  } else if (basicCode && dCode) {
    if (basicCode.toUpperCase() === dCode.toUpperCase()) tally.code_both_equal++;
    else {
      tally.code_both_conflict++;
      conflicts.push({ url: r.source_url, basic: basicCode, descr: dCode });
    }
  }
  if (!basicCode && !dCode && uCode) tally.code_url_only++;

  /** 🟢 **네 번째 출처** — `variants[].sku`. 브랜드 품번이 접두로 들어 있다. */
  const vCode = CODE_SHAPE_RE.exec(r.variant_skus ?? "")?.[1] ?? null;
  if (!basicCode && !dCode && !uCode && vCode) tally.code_variant_only++;
  if (basicCode || dCode || uCode || vCode) tally.code_anywhere++;
  else tally.code_nowhere++;

  if (extractManufacturer(d)) tally.manuf_descr_only++;
}

console.log("── §5-3 네 구분 · 상품코드 ──");
console.log(`  기본정보만 확보      ${tally.code_basic_only}`);
console.log(`  🟢 상세설명 추가 확보 ${tally.code_descr_only}`);
console.log(`  양쪽 일치            ${tally.code_both_equal}`);
console.log(`  🔴 양쪽 충돌         ${tally.code_both_conflict}`);
console.log(`  🔴🔴 둘 다 없고 «URL 에만» 있다        ${tally.code_url_only}   ← 세 번째 출처`);
console.log(`  🔴🔴 셋 다 없고 «variants[].sku 에만»  ${tally.code_variant_only}   ← 네 번째 출처`);
console.log(`  🟢 어딘가에 품번이 있다 ${tally.code_anywhere} · 🔴 어디에도 없다 ${tally.code_nowhere}`);

console.log("\n── 기본정보 보유 현황 ──");
console.log(`  description 있음 ${tally.descr_present} · 없음 ${tally.descr_absent}`);
console.log(`  brand  있음 ${tally.brand_basic} · 🔴 빈값 ${tally.brand_blank}`);
console.log(`  sku.value 있음 ${tally.code_basic} · 🔴 빈값 ${tally.code_blank}`);
console.log(`  상세설명에서 제조사 추출됨 ${tally.manuf_descr_only}`);

if (descrOnlyCode.length) {
  console.log("\n🟢 상세설명에서만 품번이 나온 스냅샷(원문 근거 보존):");
  for (const x of descrOnlyCode.slice(0, 12)) console.log(`    ${x.code.padEnd(14)} ${String(x.url).slice(0, 78)}`);
}
if (conflicts.length) {
  console.log("\n🔴 기본정보 ↔ 상세설명 품번 충돌(둘 다 보존 · 임의 선택 안 함):");
  for (const x of conflicts.slice(0, 12)) console.log(`    기본 ${x.basic} ↔ 설명 ${x.descr}  ${String(x.url).slice(0, 60)}`);
}
if (brandBlank.length) {
  console.log(`\n🔴 브랜드가 빈 스냅샷 ${brandBlank.length}건(앞 8건 · source 같이 적는다):`);
  for (const x of brandBlank.slice(0, 8))
    console.log(`    source=${String(x.src).padEnd(10)} ${String(x.title ?? "").slice(0, 34).padEnd(34)} ${String(x.url).slice(0, 56)}`);
}

console.log("\n🔴 이 스크립트는 **읽기만** 했다 — DB 쓰기 0 · 판정 0 · 원본 수정 0.");
await p.$disconnect();
