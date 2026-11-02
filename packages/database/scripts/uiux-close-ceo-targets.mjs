/**
 * UI/UX FINAL SPRINT CLOSE — CEO 확인 대상 선정 (read-only)
 *
 * 🔴 「무엇이 보일지」를 미리 확인한다 — 그러지 않으면 **정상인데 FAIL 로 보이는** 것을
 *    CEO 가 결함으로 보고한다(이 트랙에서 반복된 실패 모양).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

/** ① priceOverrideKrw(최종 선택 가격)가 **이미 설정된** 스냅샷이 있는가 */
const withFinal = await p.$queryRawUnsafe(`
  select id, title,
         (workspace->'canonicalProduct'->'priceOverrideKrw'->>'value') as final_krw
    from product_snapshots
   where workspace->'canonicalProduct'->'priceOverrideKrw'->>'value' is not null
   order by updated_at desc limit 5
`);
console.log("=== 최종 선택 가격이 이미 설정된 스냅샷 ===");
console.log(withFinal.length ? withFinal : "  🔴 0건 — CEO 화면엔 「아직 선택하지 않았습니다」가 뜬다(정상)");

/** ② resume 확인 대상 — 저장 후보가 국내+해외 둘 다 있고 SAME/PRESUMED 가 있는 것 */
const best = await p.$queryRawUnsafe(`
  select r.snapshot_id, s.title,
         count(*)::int n,
         count(*) filter (where r.market='KR')::int kr,
         count(*) filter (where r.market='OVERSEAS')::int os,
         count(*) filter (where r.system_verdict='SAME')::int same,
         count(*) filter (where r.system_verdict='PRESUMED_SAME')::int pre,
         count(r.price_status)::int ps,
         count(*) filter (where r.price_currency='KRW')::int krw_rows
    from candidate_reviews r
    join product_snapshots s on s.id = r.snapshot_id
   where r.snapshot_id is not null
   group by r.snapshot_id, s.title
  having count(*) filter (where r.market='KR') > 0
     and count(*) filter (where r.market='OVERSEAS') > 0
   order by n desc limit 5
`);
console.log("\n=== resume 확인 대상(국내+해외 둘 다 저장된 스냅샷) ===");
for (const r of best) {
  console.log(
    `  ${r.snapshot_id}  "${r.title}"  후보 ${r.n}(KR ${r.kr}/OS ${r.os}) · ` +
      `SAME ${r.same} · PRESUMED ${r.pre} · price_status ${r.ps} · KRW후보 ${r.krw_rows}`,
  );
}

/** ③ 🔴 저장되지 않는 생산자 — resume 에서 복원되지 않는다(정직하게 적을 한계) */
const bySrc = await p.$queryRawUnsafe(
  `select source, count(*)::int n from candidate_reviews group by source order by n desc`,
);
console.log("\n=== 저장된 생산자(이것만 resume 에서 복원된다) ===");
for (const r of bySrc) console.log(`  ${r.source}: ${r.n}`);

await p.$disconnect();
