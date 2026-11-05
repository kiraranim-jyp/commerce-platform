/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DOMESTIC-FUNNEL — 국내 축 라이브 측정의 **입력 덤프** (read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 덤프가 필요한가** — 운영 `listDomesticPriceSources` 는 service-role 키를
 *    요구해서 로컬에서 `[]` 를 돌려준다(메모 `production-secrets-are-write-only`).
 *    그 상태로 국내 축을 재면 **전건 0** 이 나오고, 그 0 을 제품 사실로 읽으면
 *    「국내 공급이 없다」는 거짓 결론이 된다(이 트랙이 실제로 그렇게 틀렸다).
 *
 * 🟢 그래서 **등록부 «행» 만 DATABASE_URL 로 읽어 내보낸다.** 🔴 사이트를 **고르지
 *    않는다** — 선별(포털 제외 · 정렬 · 상한)은 하니스가 **운영 함수와 운영 순서로**
 *    한다(메모 `harness-must-derive-inputs-like-production`).
 *
 * 🔴 쓰기 0 · 외부 호출 0 · 정책 0. 산출은 TEMP 의 json 하나다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/** 🔴 칸 이름을 추측하지 않는다 — 스키마에서 읽어 확인한 뒤 고른다(헌장의 그 함정). */
const cols = await p.$queryRawUnsafe(
  `select column_name from information_schema.columns where table_name='domestic_price_sources'`,
);
const has = new Set(cols.map((c) => c.column_name));
for (const need of ["domain", "url", "priority", "source_type"]) {
  if (!has.has(need)) {
    console.log(`🔴 등록부에 '${need}' 칸이 없다 — 덤프를 만들지 않는다(추측 금지).`);
    process.exit(1);
  }
}

const sources = await p.$queryRawUnsafe(`
  select id, domain, url, priority, source_type, collection_strategy, category_scope, enabled
    from domestic_price_sources
   order by priority, domain
`);

/**
 * 🔴 원상품은 **실재하는 스냅샷** 에서 고른다. 🔴 URL 을 지어내지 않는다.
 * 🟢 국내 이력이 있는 품번(B226AC009)을 1순위로, 없으면 최신 스냅샷을 쓴다.
 */
const snaps = await p.$queryRawUnsafe(`
  select id, source_url, title, workspace_id,
         (workspace->'canonicalProduct'->'brand'->>'value') as brand,
         (workspace->'canonicalProduct'->>'brandModelCode') as code
    from product_snapshots
   where source_url is not null
   order by (source_url ilike '%b226ac009%') desc, updated_at desc
   limit 5
`);

const out = {
  at: new Date().toISOString(),
  sources,
  snapshots: snaps,
  counts: {
    sources: sources.length,
    byStrategy: sources.reduce((a, s) => {
      a[s.collection_strategy ?? "NULL"] = (a[s.collection_strategy ?? "NULL"] ?? 0) + 1;
      return a;
    }, {}),
    bySourceType: sources.reduce((a, s) => {
      a[s.source_type ?? "NULL"] = (a[s.source_type ?? "NULL"] ?? 0) + 1;
      return a;
    }, {}),
    withHttpUrl: sources.filter((s) => typeof s.url === "string" && /^https?:\/\//i.test(s.url)).length,
  },
};

const dir = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "domestic-funnel-input.json");
writeFileSync(file, JSON.stringify(out, null, 1), "utf8");

console.log("=== DOMESTIC-FUNNEL 입력 덤프 ===");
console.log("등록부 행:", out.counts.sources, "· http url 보유:", out.counts.withHttpUrl);
console.log("수집전략:", JSON.stringify(out.counts.byStrategy));
console.log("source_type:", JSON.stringify(out.counts.bySourceType));
console.log("원상품 후보:");
for (const s of snaps)
  console.log(`  ${String(s.id).slice(0, 8)}  brand=${s.brand ?? "-"}  code=${s.code ?? "-"}  ${String(s.title ?? "").slice(0, 40)}`);
console.log("→", file);

await p.$disconnect();
