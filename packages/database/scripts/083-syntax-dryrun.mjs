/**
 * 🔵 083 **SQL 문법 검증** — 트랜잭션 안에서 실행하고 **반드시 ROLLBACK** 한다.
 *
 * 🔴🔴 **DB 에 적용하는 것이 아니다.** Postgres 는 DDL 이 트랜잭션이므로 rollback 하면
 *    아무것도 남지 않는다. 그리고 **롤백 뒤에 표가 없는지 다시 확인** 한다(증거).
 * 🔴 파일의 `begin;`/`commit;` 을 **벗겨서** 내 트랜잭션 안에 넣는다 —
 *    파일 안의 `commit` 이 돌면 rollback 이 무의미해진다(그것이 이 스크립트의 핵심 주의점).
 * 🔴 CPO 지시: 「083 은 **독립성 검증과 SQL 문법 검증** 을 마친 후 별도로 DB 적용 승인을 요청」.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const FILE = "prisma/migrations_manual/083_ceo_judgments.sql";
const raw = readFileSync(FILE, "utf8");

/** 🔴 파일의 트랜잭션 경계를 제거한다(주석 안의 글자는 건드리지 않도록 줄 단위로 본다). */
const body = raw
  .split(/\r?\n/)
  .filter((line) => !/^\s*(begin|commit)\s*;\s*$/i.test(line))
  .join("\n");

if (/^\s*commit\s*;/im.test(body)) {
  console.log("🔴 중단 — body 에 commit 이 남아 있다(rollback 이 무의미해진다)");
  process.exit(1);
}

/**
 * 🔴 `$executeRawUnsafe` 는 **다중 문장을 받지 못한다**(42601 — prepared statement).
 *    그래서 문장 단위로 쪼갠다. 🔴 **주석을 먼저 벗긴다** — 주석 안의 `;` 로 쪼개면
 *    문장이 깨진다(이 저장소가 반복해 밟은 「주석을 안 벗겼다」 함정의 같은 계열).
 * 🟢 `$$` 블록·함수 정의가 **없는** 파일이라 세미콜론 분할이 안전하다(083 전수 확인).
 */
const statements = body
  .split(/\r?\n/)
  .filter((line) => !/^\s*--/.test(line))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

if (raw.includes("$$")) {
  console.log("🔴 중단 — `$$` 블록이 있어 세미콜론 분할이 안전하지 않다");
  process.exit(1);
}
console.log(`문장 ${statements.length}개로 분할했다`);

const exists = async () =>
  (
    await p.$queryRawUnsafe(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name in ('ceo_judgments','ceo_judgment_axes')`,
    )
  )[0].n;

console.log(`전(前) 표 개수: ${await exists()}   (0 이어야 한다)`);

let ok = false;
let err = null;
try {
  await p.$transaction(async (tx) => {
    for (const [i, stmt] of statements.entries()) {
      try {
        await tx.$executeRawUnsafe(stmt);
      } catch (e) {
        /** 🔴 어느 문장이 터졌는지 **같이** 적는다 — 「문법 오류」만으로는 고칠 수 없다. */
        throw new Error(`문장 #${i + 1} 실패: ${stmt.slice(0, 90)} … → ${String(e.message).slice(0, 200)}`);
      }
    }
    const inTx = await tx.$queryRawUnsafe(
      `select count(*)::int as n from information_schema.tables
        where table_schema='public' and table_name in ('ceo_judgments','ceo_judgment_axes')`,
    );
    console.log(`트랜잭션 «안» 표 개수: ${inTx[0].n}   (2 여야 한다 = DDL 이 문법적으로 돌았다)`);
    ok = inTx[0].n === 2;

    /**
     * 🔵 CPO 보안 4항 — **실제 DB 가 말하는 것** 을 읽는다(SQL 텍스트 검사가 아니다).
     * 🔴 이 조회도 **같은 트랜잭션 안** 이므로 롤백되면 전부 사라진다.
     */
    const rls = await tx.$queryRawUnsafe(
      `select relname, relrowsecurity as rls_on, relforcerowsecurity as rls_forced
         from pg_class where relname in ('ceo_judgments','ceo_judgment_axes') order by relname`,
    );
    console.log("\n── RLS 활성화 상태 ──");
    for (const r of rls) console.log(`  ${r.relname}  rls=${r.rls_on}  forced=${r.rls_forced}`);

    const pol = await tx.$queryRawUnsafe(
      `select tablename, policyname from pg_policies
        where tablename in ('ceo_judgments','ceo_judgment_axes')`,
    );
    console.log(`── 정책(policy) 개수: ${pol.length}   🔴 0 이어야 한다(= 기본 전부 거부) ──`);

    const grants = await tx.$queryRawUnsafe(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
        where table_name in ('ceo_judgments','ceo_judgment_axes')
        order by table_name, grantee, privilege_type`,
    );
    console.log("── 부여된 권한 «전수» (내가 적은 두 줄 밖의 것이 있는지) ──");
    for (const g of grants) console.log(`  ${g.table_name.padEnd(18)} ${g.grantee.padEnd(16)} ${g.privilege_type}`);
    const anon = grants.filter((g) => g.grantee === "anon");
    console.log(`  🔴 anon 권한: ${anon.length}건  ${anon.length === 0 ? "🟢" : "🔴 " + JSON.stringify(anon)}`);

    const bypass = await tx.$queryRawUnsafe(
      `select rolname, rolbypassrls, rolsuper from pg_roles
        where rolname in ('service_role','authenticated','anon','postgres') order by rolname`,
    );
    console.log("── 역할별 RLS 우회 권한(`service_role` 이 우회하는지) ──");
    for (const r of bypass) console.log(`  ${r.rolname.padEnd(16)} bypassrls=${r.rolbypassrls}  super=${r.rolsuper}`);
    /** 🔴 **반드시 되돌린다** — throw 로 트랜잭션을 깨서 rollback 시킨다. */
    throw new Error("__INTENTIONAL_ROLLBACK__");
    /**
     * 🔴 기본 timeout 5초로는 12문장이 안 끝난다(1차 실행이 **#8 에서 만료** 됐고,
     *    그것을 「문법 오류」로 읽을 뻔했다 — 오류 문구를 끝까지 읽어야 갈린다).
     */
  }, { timeout: 60_000, maxWait: 20_000 });
} catch (e) {
  if (!String(e.message).includes("__INTENTIONAL_ROLLBACK__")) err = e;
}

console.log(`후(後) 표 개수: ${await exists()}   🔴 0 이어야 한다(적용되지 않았다는 증거)`);
console.log(err ? `🔴 문법 오류: ${String(err.message).slice(0, 400)}` : ok ? "🟢🟢 문법 PASS" : "🔴 미확인");
await p.$disconnect();
