/**
 * 🔵🔵🔵 083 **실제 DB 적용**(CPO 승인 2026-11-07 · 승인된 최종 SQL 한정).
 *
 * 🔴 **드라이런과 다르다** — 이 스크립트는 **COMMIT** 한다.
 * 🟢 그래도 **트랜잭션 안에서** 적용한다 — 16문장 중 하나라도 실패하면 **전부 되돌아간다**
 *    (절반만 생긴 표가 남는 것이 가장 나쁘다).
 * 🔴 승인 범위 밖은 **하지 않는다** — 전역 DEFAULT PRIVILEGES · LEGACY 소급 수정 ·
 *    GT_IMPORT 적재 · 다른 migration · 운영 판정 로직 **전부 0**.
 * 🔴 적용 **전** 상태를 먼저 찍고, 적용 **후** CPO 확인 5항을 실행한다.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const FILE = "prisma/migrations_manual/083_ceo_judgments.sql";
const T = ["ceo_judgments", "ceo_judgment_axes"];
const list = T.map((t) => `'${t}'`).join(",");

const raw = readFileSync(FILE, "utf8");
if (raw.includes("$$")) {
  console.log("🔴 중단 — `$$` 블록이 있어 세미콜론 분할이 안전하지 않다");
  process.exit(1);
}

/** 🔴 파일의 `begin;`/`commit;` 을 벗긴다 — 내 트랜잭션이 경계를 소유한다. */
const statements = raw
  .split(/\r?\n/)
  .filter((l) => !/^\s*(begin|commit)\s*;\s*$/i.test(l))
  .filter((l) => !/^\s*--/.test(l))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const tableCount = async (c = p) =>
  (
    await c.$queryRawUnsafe(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name in (${list})`,
    )
  )[0].n;

console.log(`문장 ${statements.length}개 · 적용 «전» 표 개수: ${await tableCount()}`);

try {
  await p.$transaction(
    async (tx) => {
      for (const [i, stmt] of statements.entries()) {
        try {
          await tx.$executeRawUnsafe(stmt);
        } catch (e) {
          throw new Error(`문장 #${i + 1} 실패: ${stmt.slice(0, 90)} … → ${String(e.message).slice(0, 220)}`);
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  console.log("🟢🟢 **COMMIT 완료** — 적용됐다");
} catch (e) {
  console.log(`🔴 적용 실패(전부 롤백됨): ${String(e.message).slice(0, 400)}`);
  await p.$disconnect();
  process.exit(1);
}

/* ─────────── CPO 확인 5항 — 적용 «후» 실측 ─────────── */
console.log("\n════ CPO 적용 후 확인 5항 ════");

const n = await tableCount();
console.log(`① 두 표가 실제로 존재하는가 → ${n}개  ${n === 2 ? "🟢 PASS" : "🔴 FAIL"}`);

const rls = await p.$queryRawUnsafe(
  `select relname, relrowsecurity as rls_on from pg_class where relname in (${list}) order by relname`,
);
const rlsAll = rls.length === 2 && rls.every((r) => r.rls_on === true);
console.log(`② RLS 활성화 → ${rls.map((r) => `${r.relname}=${r.rls_on}`).join(" · ")}  ${rlsAll ? "🟢 PASS" : "🔴 FAIL"}`);

const pol = await p.$queryRawUnsafe(`select policyname from pg_policies where tablename in (${list})`);
console.log(`③ 정책 개수 → ${pol.length}  ${pol.length === 0 ? "🟢 PASS(기본 거부)" : "🔴 FAIL"}`);

const grants = await p.$queryRawUnsafe(
  `select table_name, grantee, privilege_type from information_schema.role_table_grants
    where table_name in (${list}) and grantee in ('anon','authenticated')
    order by grantee, table_name, privilege_type`,
);
const anon = grants.filter((g) => g.grantee === "anon");
const auth = grants.filter((g) => g.grantee === "authenticated");
const authOk = auth.length === 2 && auth.every((g) => g.privilege_type === "SELECT");
console.log(`④ anon 권한 → ${anon.length}건  ${anon.length === 0 ? "🟢 PASS" : "🔴 FAIL " + JSON.stringify(anon)}`);
console.log(
  `   authenticated → ${auth.map((g) => `${g.table_name}:${g.privilege_type}`).join(" · ") || "(없음)"}  ${authOk ? "🟢 PASS(SELECT 만)" : "🔴 FAIL"}`,
);

const roles = await p.$queryRawUnsafe(
  `select rolname, rolbypassrls from pg_roles where rolname in ('service_role','authenticated','anon') order by rolname`,
);
console.log(`⑤ RLS 우회 → ${roles.map((r) => `${r.rolname}=${r.rolbypassrls}`).join(" · ")}`);
console.log("   🔴 클라이언트 직접 접근 0 은 «코드 grep» 으로 따로 확인한다(이 스크립트 범위 밖).");

const pass = n === 2 && rlsAll && pol.length === 0 && anon.length === 0 && authOk;
console.log(`\n${pass ? "🟢🟢 **적용 PASS — 5항 중 DB 축 4항 전부 통과**" : "🔴 FAIL — 위 항목 확인"}`);

await p.$disconnect();
