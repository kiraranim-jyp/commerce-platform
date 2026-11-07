/**
 * 🔵 CEO 판단 저장 구조 — **실제 PK · FK · 인덱스 · 이력 구조 조사**(CPO 지시 §3).
 * 🔴 READ-ONLY · DB 쓰기 0 · schema 변경 0 · 네트워크 0.
 * 🔴 **칸 이름을 추측하지 않는다** — `information_schema` / `pg_*` 에서 읽는다
 *    (이 트랙에서 칸 이름 추측으로 열다섯 번 틀렸다).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const q = (sql) => p.$queryRawUnsafe(sql);
const J = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x));
const show = async (title, sql) => {
  console.log(`\n═══ ${title} ═══`);
  try {
    const rows = await q(sql);
    if (!rows.length) return console.log("  (0행)");
    for (const r of rows) console.log("  " + J(r));
  } catch (e) {
    console.log("  🔴 질의 실패: " + String(e.message).slice(0, 160));
  }
};

const T = "candidate_reviews";

await show(
  "① 칸 전수 (이름 · 타입 · null 허용 · 기본값)",
  `select ordinal_position as n, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_name='${T}' order by ordinal_position`,
);

await show(
  "② 제약 전수 — PK · FK · UNIQUE · CHECK",
  `select con.conname as name, con.contype as type, pg_get_constraintdef(con.oid) as def
     from pg_constraint con join pg_class rel on rel.oid=con.conrelid
    where rel.relname='${T}' order by con.contype, con.conname`,
);

await show(
  "③ 인덱스 전수 (부분 유니크가 둘이라는 WU-131 계약 확인)",
  `select indexname, indexdef from pg_indexes where tablename='${T}' order by indexname`,
);

await show(
  "④ 이 표를 가리키는 FK 가 «있는가» (하류 참조)",
  `select rel.relname as from_table, pg_get_constraintdef(con.oid) as def
     from pg_constraint con join pg_class rel on rel.oid=con.conrelid
    where con.contype='f' and con.confrelid=(select oid from pg_class where relname='${T}')`,
);

await show(
  "⑤ 🔴 이력 구조가 «있는가» — 버전/변경이력 칸을 이름으로 찾는다",
  `select column_name from information_schema.columns
    where table_name='${T}'
      and (column_name ilike '%version%' or column_name ilike '%history%'
           or column_name ilike '%revision%' or column_name ilike '%prev%'
           or column_name ilike '%superseded%' or column_name ilike '%updated%')`,
);

await show(
  "⑥ 실제 데이터 — human_verdict 분포와 workspace/origin 축",
  `select human_verdict, count(*)::int as n,
          count(workspace_id)::int as with_ws, count(origin_code)::int as with_origin,
          count(human_note)::int as with_note, max(reviewed_at)::text as last_reviewed
     from ${T} group by human_verdict order by n desc`,
);

await show(
  "⑦ 🔴 같은 (url) 에 행이 «둘 이상» 있는가 — 부분 유니크가 둘이라 가능하다",
  `select candidate_url, count(*)::int as rows,
          count(distinct coalesce(human_verdict,'(null)'))::int as distinct_verdicts
     from ${T} group by candidate_url having count(*)>1 order by rows desc limit 10`,
);

await show(
  "⑧ 🔴 사람 판단이 «바뀐 적» 이 있는가 — 같은 url 에 서로 다른 verdict",
  `select candidate_url, string_agg(distinct human_verdict, ' | ') as verdicts, count(*)::int as rows
     from ${T} where human_verdict is not null
    group by candidate_url having count(distinct human_verdict)>1 limit 10`,
);

await show(
  "⑨ 참고 — 이 리포의 수동 migration 최신 번호(다음 번호를 추측하지 않기 위해)",
  `select 1 as placeholder`,
);

await p.$disconnect();
