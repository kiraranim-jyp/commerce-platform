/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 2 E2E — **입력 덤프**(read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 덤프인가** — 운영 `listComparisonShops`/`listDomesticPriceSources` 는
 *    service-role 키를 요구해서 로컬에서 `[]` 를 돌려준다. 그 상태로 발견력을 재면
 *    **전건 0** 이 나오고 그 0 을 제품 사실로 읽으면 거짓 결론이 된다.
 * 🟢 그래서 **등록부 «행» 만** 내보낸다. 🔴 선별(활성·접근·scope·정렬·상한)은
 *    하니스가 **운영 함수로** 한다(`collectOverseasAutoPool` 의 `listShops` 주입구 ·
 *    그 파일 주석이 「테스트/측정용 주입구」라고 명시한 자리다).
 *
 * 🔴🔴 **표본을 손으로 고르지 않는다** — CPO §9 의 여섯 유형을 덮기 위해
 *    **호스트별 최신 1건** 을 규칙으로 뽑는다(성공 사례만 고르는 것을 막는다).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/** 🔴 칸 이름을 추측하지 않는다 — 스키마에서 읽어 확인한다. */
const need = async (table, cols) => {
  const got = new Set(
    (
      await p.$queryRawUnsafe(
        `select column_name from information_schema.columns where table_name='${table}'`,
      )
    ).map((c) => c.column_name),
  );
  const miss = cols.filter((c) => !got.has(c));
  if (miss.length > 0) {
    console.log(`🔴 ${table} 에 칸이 없다: ${miss.join(", ")} — 덤프를 만들지 않는다`);
    process.exit(1);
  }
};
await need("comparison_shops", ["id", "name", "domain", "url", "currency", "category_scope", "access_status", "is_active"]);
await need("domestic_price_sources", ["domain", "url", "priority", "source_type", "collection_strategy"]);

/**
 * 🟢 `ComparisonShop`(운영 타입)의 **camelCase 칸 이름** 으로 내보낸다 —
 *    하니스가 매핑을 또 만들지 않게 한다. 🔴 운영 필터가 읽는 칸은
 *    `isActive` · `accessStatus` · `categoryScope` 셋이다(overseas-auto-pool.ts).
 */
const overseasShops = (
  await p.$queryRawUnsafe(`
  select id, name, domain, url, country, currency, category_scope, access_status,
         access_note, source_role, operator_key, is_active
    from comparison_shops order by domain`)
).map((s) => ({
  id: s.id,
  name: s.name,
  domain: s.domain,
  url: s.url,
  country: s.country,
  currency: s.currency,
  categoryScope: Array.isArray(s.category_scope) ? s.category_scope : [],
  accessStatus: s.access_status,
  accessNote: s.access_note,
  sourceRole: s.source_role,
  operatorKey: s.operator_key,
  isActive: s.is_active,
}));

const domesticSources = await p.$queryRawUnsafe(`
  select id, domain, url, priority, source_type, collection_strategy, category_scope, enabled
    from domestic_price_sources order by priority, domain`);

/**
 * 🔴 CPO §9 여섯 유형 — **호스트를 분산** 한다(한 사이트에 전체를 종속시키지 않는다 ·
 *    그리고 같은 호스트를 반복 호출해 rate-limit 에 걸리는 것을 피한다).
 */
const HOSTS = [
  "bobochoses.com",
  "www.junioredition.com",
  "www.smallable.com",
  "www.tennis-warehouse.com",
  "main-story.com",
  "www.childrensalon.com",
];
const samples = [];
for (const host of HOSTS) {
  const rows = await p.$queryRawUnsafe(
    `select id, source_url, title,
            (workspace->'canonicalProduct'->'brand'->>'value') as brand
       from product_snapshots
      where source_url like 'https://${host}/%'
      order by updated_at desc limit 1`,
  );
  if (rows[0]) samples.push({ host, ...rows[0] });
  else console.log(`🟡 ${host} — 스냅샷 0건(표본에서 빠진다 · 「실패」가 아니다)`);
}

const out = { at: new Date().toISOString(), overseasShops, domesticSources, samples };
const dir = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "sprint2-e2e-input.json");
writeFileSync(file, JSON.stringify(out, null, 1), "utf8");

console.log("=== SPRINT 2 E2E 입력 덤프 ===");
console.log(`해외 등록부 ${overseasShops.length} (활성 ${overseasShops.filter((s) => s.isActive).length})`);
console.log(`국내 등록부 ${domesticSources.length}`);
console.log(`표본 ${samples.length} / 호스트 ${HOSTS.length}`);
for (const s of samples)
  console.log(`  ${String(s.id).slice(0, 8)}  ${String(s.host).padEnd(26)} brand="${(s.brand ?? "").slice(0, 16)}"  ${String(s.title ?? "").slice(0, 38)}`);
console.log("→", file);

await p.$disconnect();
