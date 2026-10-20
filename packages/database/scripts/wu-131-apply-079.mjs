/**
 * WU-131 §4 — **079 를 실제로 적용하고 «검증» 한다.**
 *
 * 🔴 **079 만** 적용한다 — `commerce_egress_events`(078) 같은 기존 누락분을
 *    이번 작업에서 같이 밀지 않는다(CPO §4 명시 · 그것은 다른 스프린트의 것이다).
 * 🔴 DDL 은 **DIRECT_URL**(5432)로 간다 — pooler(6543 · pgbouncer)는 DDL 에 부적합하다.
 * 🟢 파일을 그대로 읽어 실행한다(여기서 SQL 을 다시 적지 않는다 — 두 벌이 되면 갈라진다).
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-131-apply-079.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const SQL_PATH = path.join(process.cwd(), "prisma", "migrations_manual", "079_candidate_reviews.sql");

/** 🔴 DDL 은 direct 연결로. 없으면 멈춘다(pooler 로 몰래 시도하지 않는다). */
const url = process.env.DIRECT_URL;
if (!url) {
  console.error("🔴 DIRECT_URL 이 없다 — DDL 을 pooler 로 실행하지 않는다.");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** 🔴 `--` 주석과 문자열을 건드리지 않고 «문장» 단위로만 가른다. */
function statements(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const stmts = statements(sql);
  console.log(`079 문장 ${stmts.length}개 적용(DIRECT_URL)`);
  for (const s of stmts) {
    await prisma.$executeRawUnsafe(s);
    console.log("  🟢 " + s.split("\n")[0].slice(0, 72));
  }

  /* ───────── 🔴 적용 «검증» — 파일만 만들고 끝내지 않는다(CPO §4) ───────── */
  const cols = await prisma.$queryRawUnsafe(
    `select column_name, data_type from information_schema.columns
      where table_name='candidate_reviews' order by ordinal_position`,
  );
  console.log(`\n① columns ${cols.length}개: ${cols.map((c) => c.column_name).join(", ")}`);

  const idx = await prisma.$queryRawUnsafe(
    `select indexname, indexdef from pg_indexes where tablename='candidate_reviews' order by indexname`,
  );
  console.log(`② index ${idx.length}개:`);
  for (const i of idx) console.log(`   · ${i.indexname}${/UNIQUE/i.test(i.indexdef) ? "  🟢 UNIQUE" : ""}`);

  const chk = await prisma.$queryRawUnsafe(
    `select conname from pg_constraint where conrelid='candidate_reviews'::regclass and contype='c' order by conname`,
  );
  console.log(`③ check constraint ${chk.length}개: ${chk.map((c) => c.conname).join(", ")}`);

  /* 🔴 insert/select 까지 **실제로** 해 본다. 🟢 끝나면 지운다(쓰레기 행을 남기지 않는다). */
  const probeUrl = "https://wu131.probe.invalid/products/probe";
  await prisma.$executeRawUnsafe(
    `insert into candidate_reviews (origin_code, candidate_url, source, human_verdict)
       values ('WU131_PROBE', $1, 'GT_IMPORT', 'UNDECIDED')
     on conflict do nothing`,
    probeUrl,
  );
  const got = await prisma.$queryRawUnsafe(
    `select origin_code, candidate_url, human_verdict, source from candidate_reviews where candidate_url = $1`,
    probeUrl,
  );
  console.log(`④ insert/select 🟢 ${JSON.stringify(got)}`);

  /** 🔴 유니크가 **실제로 막는지** 본다 — 선언만 보고 믿지 않는다. */
  let blocked = false;
  try {
    await prisma.$executeRawUnsafe(
      `insert into candidate_reviews (origin_code, candidate_url, source) values ('WU131_PROBE', $1, 'GT_IMPORT')`,
      probeUrl,
    );
  } catch {
    blocked = true;
  }
  console.log(`⑤ 같은 (origin_code, url) 재삽입 차단: ${blocked ? "🟢 막힌다" : "🔴 막지 못한다"}`);

  const del = await prisma.$executeRawUnsafe(`delete from candidate_reviews where origin_code='WU131_PROBE'`);
  console.log(`⑥ probe 행 정리 ${del}건 삭제`);
  if (!blocked) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
