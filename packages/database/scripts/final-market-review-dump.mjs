/**
 * FINAL MARKET COMPARISON — 운영 노출 데이터 덤프 (READ-ONLY · 쓰기 0 · 네트워크 0 · 과금 0)
 *
 * 🔴 로컬에서는 운영 discovery 를 재현할 수 없다 —
 *    `comparison-shop.ts:141` 이 service-role 키 없으면 `[]` 를 돌려주고(해외 등록부 0),
 *    search provider 는 `NOT_CONFIGURED` 다. 그래서 **운영이 이미 낸 산출물** 을 읽는다.
 * 🟢 칸 이름은 `information_schema` 로 **읽어서** 쓴다(추측 금지 — 1차에 `created_at` 으로
 *    추측해 42703 을 맞았다).
 *
 * 🔴🔴 **스냅샷 단위로 고른다.** 1차에 `origin_code` 로 묶었다가 **39개 분석을 합친 값** 을
 *    화면 값처럼 찍었다 — 화면은 **한 스냅샷** 을 그린다.
 *    🟢 같은 `(snapshot_id, candidate_url)` 2행 이상은 **0건** 이다(부분 유니크가 지킨다 ·
 *       WU-141-R1 수정이 운영에서 동작한다) ⟹ 「중복 39회」는 **결함이 아니라 누적** 이다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });

const origins = await p.$queryRawUnsafe(`
  select origin_code,
         count(*)::int as n,
         count(*) filter (where price_amount is not null)::int as with_price,
         count(*) filter (where human_verdict is not null)::int as human,
         count(distinct snapshot_id)::int as snapshots,
         max(last_seen_at) as latest
  from candidate_reviews
  where origin_code is not null
  group by origin_code
  order by with_price desc, n desc
  limit 10`);

console.log("═══ 후보 보유 원상품 (가격 보유 순) ═══");
for (const r of origins) {
  console.log(
    `  ${String(r.origin_code).padEnd(14)} 행 ${String(r.n).padStart(3)} · 가격 ${String(r.with_price).padStart(3)} ·` +
      ` 사람판정 ${String(r.human).padStart(3)} · 스냅샷 ${String(r.snapshots).padStart(3)} · 최근 ${String(r.latest ?? "-").slice(0, 16)}`,
  );
}

const target = process.env.ORIGIN_CODE ?? String(origins[0]?.origin_code ?? "");

const snaps = await p.$queryRawUnsafe(
  `select snapshot_id, count(*)::int as n,
          count(*) filter (where price_amount is not null)::int as with_price,
          count(*) filter (where human_verdict is not null)::int as human,
          max(last_seen_at) as latest
   from candidate_reviews
   where origin_code = $1 and snapshot_id is not null
   group by snapshot_id order by with_price desc, n desc limit 8`,
  target,
);
console.log(`\n═══ ${target} 의 스냅샷별 후보 (화면 한 장 = 스냅샷 하나) ═══`);
for (const s of snaps) {
  console.log(
    `  ${String(s.snapshot_id).slice(0, 8)} 후보 ${String(s.n).padStart(3)} · 가격 ${String(s.with_price).padStart(3)} ·` +
      ` 사람판정 ${String(s.human).padStart(3)} · 최근 ${String(s.latest ?? "-").slice(0, 16)}`,
  );
}
const snapshotId = process.env.SNAPSHOT_ID ?? String(snaps[0]?.snapshot_id ?? "");

const rows = await p.$queryRawUnsafe(
  `select origin_code, candidate_domain, candidate_title, candidate_url, market,
          system_verdict, match_truth, price_tier, price_amount, price_currency,
          price_status, sold_out, human_verdict, blockers, match_reasons, source,
          snapshot_id, last_seen_at
   from candidate_reviews where snapshot_id = $1::uuid order by price_tier, candidate_domain`,
  snapshotId,
);

/** 🔴 원상품도 같이 낸다 — 후보만 보면 CPO 가 «무엇과» 비교하는지 알 수 없다. */
const origin = snapshotId
  ? await p.$queryRawUnsafe(
      `select id, title, source_url, status from product_snapshots where id = $1::uuid`,
      snapshotId,
    )
  : [];

const payload = {
  target,
  snapshotId,
  origins,
  snaps,
  origin,
  rows: rows.map((r) => ({ ...r, price_amount: r.price_amount == null ? null : Number(r.price_amount) })),
};
writeFileSync(path.join(OUT, "final-market-review.json"), JSON.stringify(payload, null, 1));
console.log(
  `\n🟢 덤프 완료 — ${path.join(OUT, "final-market-review.json")}` +
    `\n   원상품 ${target} · 스냅샷 ${snapshotId.slice(0, 8)} · 후보 ${rows.length}건`,
);
await p.$disconnect();
