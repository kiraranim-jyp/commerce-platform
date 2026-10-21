/**
 * WU-141-R1 STEP 4 — **「후보 검토 저장 실패」의 원인 실측**
 *
 * 🔴 가설: `candidate_reviews` 의 UNIQUE 가 **부분(partial) 유니크 인덱스** 인데
 *    앱이 PostgREST upsert(`onConflict: "snapshot_id,candidate_url"`)를 쓴다.
 *    Postgres 는 `ON CONFLICT (cols)` 로 **부분 인덱스를 추론하지 못한다**
 *    (인덱스 술어와 같은 WHERE 를 문장에 줘야 하는데 PostgREST 는 주지 않는다)
 *    ⟹ 42P10 「no unique or exclusion constraint matching the ON CONFLICT specification」
 *
 * 🔴 **DDL 0 · 영구 쓰기 0.** 쓰기 시도는 전부 트랜잭션 안에서 **ROLLBACK** 한다.
 * 사용법: packages/database 에서  node --env-file=.env <this file>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);

console.log("=== ① 접속 role ===");
console.log(JSON.stringify((await q("select current_user, session_user"))[0]));

console.log("\n=== ② candidate_reviews 가 실재하는가 ===");
console.log(
  JSON.stringify(
    await q(`select c.relname, c.relrowsecurity as rls
             from pg_class c join pg_namespace n on n.oid=c.relnamespace
             where n.nspname='public' and c.relname='candidate_reviews'`),
  ),
);

console.log("\n=== ③ 🔴 유니크 제약/인덱스의 «실제» 모양 (부분인가?) ===");
console.log(
  JSON.stringify(
    await q(`select i.relname as index_name,
                    ix.indisunique as is_unique,
                    ix.indpred is not null as is_partial,
                    pg_get_indexdef(ix.indexrelid) as def
             from pg_index ix
             join pg_class i on i.oid = ix.indexrelid
             join pg_class t on t.oid = ix.indrelid
             join pg_namespace n on n.oid = t.relnamespace
             where n.nspname='public' and t.relname='candidate_reviews'
             order by i.relname`),
    null,
    1,
  ),
);

console.log("\n=== ④ 테이블 수준 UNIQUE «제약»(constraint) 이 있는가 ===");
console.log(
  JSON.stringify(
    await q(`select conname, contype, pg_get_constraintdef(oid) as def
             from pg_constraint
             where conrelid = 'public.candidate_reviews'::regclass
             order by conname`),
    null,
    1,
  ),
);

console.log("\n=== ⑤ 현재 행 수 ===");
console.log(JSON.stringify((await q("select count(*)::int as n from candidate_reviews"))[0]));

/* ───────────── ⑥ 🔴 핵심 — 앱이 쓰는 그 문장을 «트랜잭션 안에서» 실제로 시도 ─────────────
 * PostgREST 의 upsert 는 아래 모양으로 번역된다:
 *   INSERT ... ON CONFLICT (snapshot_id, candidate_url) DO UPDATE SET ...
 * 🔴 부분 유니크 인덱스면 이 문장은 **42P10** 으로 터진다. 그것을 직접 확인한다.
 */
const snap = await q(
  `select id, workspace_id from product_snapshots order by created_at desc limit 1`,
);
if (snap.length === 0) {
  console.log("\n⑥ 측정불가 — product_snapshots 가 비어 있다(FK 때문에 시도 불가)");
} else {
  const { id: snapshotId, workspace_id: workspaceId } = snap[0];
  console.log(`\n=== ⑥ ON CONFLICT 추론 실측 (snapshot ${snapshotId}) ===`);

  const url = "https://wu141-probe.example/p/1";
  const insert = (onConflictClause) => `
    insert into candidate_reviews
      (workspace_id, snapshot_id, candidate_url, human_verdict, source, reviewed_at, last_seen_at)
    values
      ('${workspaceId}', '${snapshotId}', '${url}', 'SAME', 'SELLER_URL', now(), now())
    ${onConflictClause}
  `;

  /** ⒜ 앱과 «같은» 모양 — 부분 인덱스를 술어 없이 추론하려 한다. */
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        insert("on conflict (snapshot_id, candidate_url) do update set human_verdict = excluded.human_verdict"),
      );
      throw new Error("__ROLLBACK__");
    });
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("__ROLLBACK__")) {
      console.log("⒜ 앱과 같은 ON CONFLICT (snapshot_id, candidate_url) → 🟢 성공(그리고 롤백)");
    } else {
      const code = e?.meta?.code ?? e?.code ?? "";
      console.log(`⒜ 앱과 같은 ON CONFLICT → 🔴 실패  code=${code}`);
      console.log(`   ${msg.split("\n").filter((l) => l.trim()).slice(-3).join(" | ")}`);
    }
  }

  /** ⒝ 부분 인덱스 술어를 «같이» 준 경우 — 이러면 추론이 된다(비교군). */
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        insert(
          "on conflict (snapshot_id, candidate_url) where snapshot_id is not null do update set human_verdict = excluded.human_verdict",
        ),
      );
      throw new Error("__ROLLBACK__");
    });
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("__ROLLBACK__")) {
      console.log("⒝ 술어를 같이 준 ON CONFLICT … WHERE snapshot_id is not null → 🟢 성공(롤백)");
    } else {
      console.log(`⒝ 술어를 같이 준 경우 → 🔴 실패: ${msg.split("\n")[0]}`);
    }
  }

  /** ⒞ 🟢 **수정 후 모양** — 조회 → insert → 재삽입(23505 로 막혀야 한다) → id 로 update. */
  console.log("\n=== ⑦ 수정 후 문장 모양 실측 (조회 → insert / update) ===");
  try {
    await prisma.$transaction(async (tx) => {
      const find = () =>
        tx.$queryRawUnsafe(
          `select id, human_verdict, system_verdict from candidate_reviews
           where snapshot_id = $1::uuid and candidate_url = $2`,
          snapshotId,
          url,
        );
      console.log(`⒞-1 조회(없어야 한다) → ${(await find()).length}건`);

      await tx.$executeRawUnsafe(insert(""));
      const after = await find();
      console.log(`⒞-2 insert 후 조회 → ${after.length}건 🟢`);

      /**
       * 🔴 부분 유니크 **방어는 살아 있어야** 한다 — 느슨하게 고친 것이 아니다.
       * 🔴🔴 SAVEPOINT 로 감싼다 — Postgres 는 트랜잭션 안에서 오류가 나면 그 트랜잭션을
       *    **abort** 시키므로, 감싸지 않으면 뒤 단계가 「current transaction is aborted」로
       *    줄줄이 실패한다(1차 실행에서 실제로 그렇게 나왔다).
       * 🟢 운영 코드에는 그 문제가 **없다** — insert 와 폴백 update 가 supabase-js 의
       *    **서로 다른 요청** 이라 한 트랜잭션을 공유하지 않는다. 여기서만 모양을 맞춘다.
       */
      await tx.$executeRawUnsafe("savepoint dup_probe");
      try {
        await tx.$executeRawUnsafe(insert(""));
        console.log("⒞-3 🔴 재삽입이 막히지 않았다 — 무결성 방어가 사라졌다");
      } catch (dup) {
        console.log(
          `⒞-3 재삽입 → 🟢 막혔다 code=${dup?.meta?.code ?? dup?.code ?? ""} (부분 유니크 유지)`,
        );
      }
      await tx.$executeRawUnsafe("rollback to savepoint dup_probe");

      const n = await tx.$executeRawUnsafe(
        `update candidate_reviews set human_verdict = 'DIFFERENT', reviewed_at = now()
         where id = $1::uuid`,
        after[0].id,
      );
      const final = await find();
      console.log(`⒞-4 id 로 update → ${n}행 · human_verdict=${final[0].human_verdict} 🟢`);
      console.log(
        `⒞-5 🔴 system_verdict 는 그대로 → ${JSON.stringify(final[0].system_verdict)}`,
      );
      throw new Error("__ROLLBACK__");
    });
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("__ROLLBACK__")) console.log("⒞ 🟢 전부 성공 — 롤백했다(영구 쓰기 0)");
    else console.log(`⒞ 🔴 수정 후 모양 실패: ${msg.split("\n")[0]}`);
  }
}

await prisma.$disconnect();
