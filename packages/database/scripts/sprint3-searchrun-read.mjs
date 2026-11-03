/** SPRINT 3 — workspace.searchRun 판독 (read-only · SELECT only) */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const rows = await p.$queryRawUnsafe(`
  select id, title, source_url, updated_at,
         (workspace->'searchRun') as search_run
    from product_snapshots
   where workspace ? 'searchRun'
   order by updated_at desc
   limit 5
`);

console.log(`searchRun 보유 스냅샷 ${rows.length}건\n`);
for (const r of rows) {
  console.log("=".repeat(78));
  console.log(`${r.id}  ${new Date(r.updated_at).toISOString()}`);
  console.log(`${r.title}`);
  console.log(`${r.source_url}`);
  console.log(JSON.stringify(r.search_run, null, 1));
}
if (!rows.length) {
  console.log("🔴 0건 — 배포 이후 분석 실행이 아직 없거나 저장이 실패했다(추정 금지)");
}
await p.$disconnect();
