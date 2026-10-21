/**
 * SUPABASE-GRANT-01 — **public 스키마 권한 실측** (READ ONLY)
 *
 * 🔴 배경: Supabase 변경(2026-10-30) — 그 날 이후 `public` 에 **새로 만드는** 테이블은
 *    명시적 `GRANT` 가 없으면 Data API(PostgREST/GraphQL/supabase-js)에서 접근 불가.
 *    🟢 **기존 테이블의 현재 권한은 유지** 된다 ⟹ 지금 운영이 깨지는 변경이 아니다.
 *
 * 🔴🔴 **이 스크립트는 아무것도 바꾸지 않는다** — GRANT/REVOKE 0 · DDL 0.
 * 🔴 메일 예시(`anon` 에 CRUD 전부)를 **그대로 적용하지 않는다**(CPO 명시).
 *    먼저 「누가 실제로 접근하는가」를 재야 한다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/supabase-grant-audit.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);

const ROLES = ["anon", "authenticated", "service_role"];

console.log("=== ① 현재 접속 role (CTO 가 무엇으로 보고 있는지) ===");
console.log(JSON.stringify((await q("select current_user, session_user"))[0]));

console.log("\n=== ② public 테이블 × RLS × 정책 수 × role 별 GRANT ===");
const rows = await q(`
  select c.relname as table_name,
         c.relrowsecurity as rls,
         (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies,
         coalesce((select string_agg(distinct privilege_type, ',' order by privilege_type)
                     from information_schema.role_table_grants g
                    where g.table_schema='public' and g.table_name=c.relname and g.grantee='anon'), '') as anon,
         coalesce((select string_agg(distinct privilege_type, ',' order by privilege_type)
                     from information_schema.role_table_grants g
                    where g.table_schema='public' and g.table_name=c.relname and g.grantee='authenticated'), '') as auth,
         coalesce((select string_agg(distinct privilege_type, ',' order by privilege_type)
                     from information_schema.role_table_grants g
                    where g.table_schema='public' and g.table_name=c.relname and g.grantee='service_role'), '') as svc
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by c.relname
`);
const short = (s) =>
  s
    ? s
        .split(",")
        .map((p) => ({ SELECT: "S", INSERT: "I", UPDATE: "U", DELETE: "D", TRUNCATE: "T", REFERENCES: "R", TRIGGER: "G" })[p] ?? p[0])
        .sort()
        .join("")
    : "—";
console.log(`테이블 ${rows.length}개`);
console.log("   table                              RLS pol  anon  auth  svc");
for (const r of rows) {
  console.log(
    `   ${r.table_name.padEnd(34)} ${(r.rls ? "ON " : "off").padEnd(3)} ${String(r.policies).padEnd(4)} ` +
      `${short(r.anon).padEnd(5)} ${short(r.auth).padEnd(5)} ${short(r.svc)}`,
  );
}

console.log("\n=== ③ 요약 — role 별 「권한이 하나라도 있는」 테이블 수 ===");
for (const [k, label] of [["anon", "anon"], ["auth", "authenticated"], ["svc", "service_role"]]) {
  const n = rows.filter((r) => r[k]).length;
  console.log(`   ${label.padEnd(15)} ${n}/${rows.length}`);
}
console.log(`   🔴 RLS OFF            ${rows.filter((r) => !r.rls).length}/${rows.length}`);
console.log(`   🔴 RLS ON · 정책 0    ${rows.filter((r) => r.rls && r.policies === 0).length}`);
console.log(
  `   🔴🔴 anon 권한 있는데 RLS OFF  ${rows.filter((r) => r.anon && !r.rls).length}  ← 있으면 즉시 검토 대상`,
);

console.log("\n=== ④ 🔴 pg_default_acl — «앞으로» 만들어지는 객체의 기본 권한 ===");
const acl = await q(`
  select pg_get_userbyid(d.defaclrole) as grantor,
         n.nspname as schema,
         d.defaclobjtype as objtype,
         d.defaclacl::text as acl
    from pg_default_acl d
    left join pg_namespace n on n.oid = d.defaclnamespace
   order by 1,2,3
`);
if (acl.length === 0) console.log("   (default ACL 항목 없음 — 기본값이 그대로다)");
for (const a of acl) console.log(`   ${a.grantor} → ${a.schema ?? "(전체)"} [${a.objtype}] ${a.acl}`);
console.log("   🔴 여기서 아무것도 revoke/alter 하지 않았다(CPO 명시).");

await prisma.$disconnect();
