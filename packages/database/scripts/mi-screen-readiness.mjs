/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 MI 통합 — 「한 화면에 무엇이 나오는가」 판독기 (read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **먼저 읽는다 — 이 표의 맹점은 «시점에 따라» 다르다.**
 * ```
 * 🔵 **2026-11-06(migration 082 + 배선) «이후» 실행** — 맹점이 **닫혔다.**
 *    ① 이 다섯 생산자를 담는다 — OVERSEAS_AUTO · GEMINI · SELLER_URL ·
 *      **WEB_SEARCH** · **DOMESTIC_LISTING**
 *
 * 🔴 **그 «이전» 에 쓰인 행(기준선 180행)에는 국내 둘이 없다.**
 *    (079 의 `source` CHECK 가 다섯 값뿐이었고 그 둘이 없었다 ⟹ 국내 후보 «행» 이
 *     버려졌다. 🔴 소급 backfill 은 **하지 않았다** — 그 URL·제목은 다시 수집해야
 *     생기고 사이트 재접속은 금지다.)
 * ⟹ 🔴🔴 **그러므로 과거 구간에서 ①의 🇰🇷 열을 「국내 공급량」으로 읽지 않는다.**
 *    배선 이후 실행이 섞여 있으면 **두 구간을 같은 분모로 세지 않는다**(first_seen_at 로 가른다).
 *
 * 🔴 실측 사고(2026-11-05) — ①이 「국내 후보 총 1행 / 64 스냅샷」을 냈고 그것이
 *    「국내 공급이 구조적으로 비어 있다」는 **블로커 판정** 으로 올라갔다. 같은 날
 *    ②의 영속 관측값은 최근 6 실행에서 WEB_SEARCH **6** · DOMESTIC_LISTING **3** 을
 *    기록하고 있었다. ⟹ 그 「0」은 **계측의 맹점** 이었다(헌장 §5-B 「측정불가 ≠ 0」).
 * ```
 * 🟢 **국내 축을 판단할 때는 ②(`workspace.searchRun`)를 본다.** 그 칸은 여섯 생산자
 *    전수와 시장별 단계표를 담는다(MI-FUNNEL-PERSIST-01 · migration 0).
 * 🔴 ②가 비어 있으면 「국내 0」이 아니라 **「그 실행이 아직 없다」** 다.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const padL = (s, n) => " ".repeat(Math.max(0, n - String(s ?? "-").length)) + String(s ?? "-");
const padR = (s, n) => String(s ?? "-") + " ".repeat(Math.max(0, n - String(s ?? "-").length));

/* ══════════════════════════════════════════════════════════════════════════
 * ① candidate_reviews — 🔵 **082 이후 다섯 생산자** / 🔴 그 이전 행은 셋뿐(위 맹점 참조)
 * ══════════════════════════════════════════════════════════════════════════ */
const r = await p.$queryRawUnsafe(`
  select snapshot_id, origin_code,
         count(*)::int as cand,
         count(*) filter (where market='KR')::int as kr,
         count(*) filter (where market='OVERSEAS')::int as os,
         count(*) filter (where market is null or market='UNKNOWN')::int as unk,
         count(*) filter (where price_amount is not null)::int as priced,
         count(*) filter (where price_status='VERIFIED_CURRENT')::int as verified,
         count(*) filter (where price_tier in ('EXACT','COMPARISON'))::int as money_tier,
         count(*) filter (where system_verdict='SAME')::int as same,
         count(*) filter (where human_verdict is not null)::int as human,
         max(first_seen_at) as last
  from candidate_reviews group by 1,2
  order by max(first_seen_at) desc limit 12
`);
console.log("\n=== ① candidate_reviews 최근 12 스냅샷 ===");
console.log("🔵 082+배선(2026-11-06) 이후 행은 WEB_SEARCH·DOMESTIC_LISTING 을 담는다.");
console.log("🔴 그 이전 행에는 둘이 «없다»(backfill 0) — 두 구간을 같은 분모로 세지 않는다.");
console.log("  snapshot  origin        후보  🇰🇷  🌎  ❔  가격  검증  tier자격 SAME  사람  최근");
for (const x of r)
  console.log(
    `  ${String(x.snapshot_id).slice(0, 8)}  ${padR(x.origin_code, 12)} ` +
      `${padL(x.cand, 4)} ${padL(x.kr, 3)} ${padL(x.os, 3)} ${padL(x.unk, 3)} ` +
      `${padL(x.priced, 5)} ${padL(x.verified, 5)} ${padL(x.money_tier, 7)} ` +
      `${padL(x.same, 5)} ${padL(x.human, 5)}  ${String(x.last).slice(4, 10)}`,
  );
const agg = await p.$queryRawUnsafe(`
  select count(distinct snapshot_id)::int as snaps,
         count(*) filter (where market='KR')::int as kr_total,
         count(distinct snapshot_id) filter (where market='KR')::int as snaps_with_kr,
         count(*) filter (where market='OVERSEAS')::int as os_total
  from candidate_reviews
`);
console.log("\n=== ① 전수(세 생산자 한정) ===", JSON.stringify(agg[0]));

/* ══════════════════════════════════════════════════════════════════════════
 * ② workspace.searchRun — 🟢 **여섯 생산자 전수 + 시장별 단계표**
 * ══════════════════════════════════════════════════════════════════════════ */
const runs = await p.$queryRawUnsafe(`
  select id, title, updated_at, (workspace->'searchRun') as search_run
    from product_snapshots
   where workspace ? 'searchRun'
   order by updated_at desc
`);

console.log("\n=== ② workspace.searchRun — 국내 축은 «이것» 으로 판단한다 ===");
if (runs.length === 0) {
  console.log("🔴 0건 — 배포 이후 분석 실행이 아직 없다. **「국내 0」이 아니라 「측정 없음」** 이다.");
} else {
  console.log(`보유 실행 N = ${runs.length}`);
  console.log(
    "  상품                            W   D   O   G   S   R | 🇰🇷후보 🇰🇷S/P 🇰🇷가격 | 🌎후보 🌎S/P 🌎가격 | ❔",
  );
  let anyFunnel = 0;
  for (const row of runs) {
    const sr = row.search_run ?? {};
    const pr = sr.producers ?? {};
    const f = sr.funnel ?? null;
    if (f) anyFunnel += 1;
    const kr = f?.KR ?? {};
    const os = f?.OVERSEAS ?? {};
    const unk = f?.UNKNOWN_MARKET ?? {};
    const sp = (c) => (c.SAME ?? 0) + (c.PRESUMED_SAME ?? 0);
    console.log(
      `  ${padR(String(row.title ?? "-").slice(0, 30), 30)} ` +
        `${padL(pr.WEB_SEARCH, 3)} ${padL(pr.DOMESTIC_LISTING, 3)} ${padL(pr.OVERSEAS_AUTO, 3)} ` +
        `${padL(pr.GEMINI, 3)} ${padL(pr.SELLER_URL, 3)} ${padL(pr.REVIEWED_SAME, 3)} | ` +
        `${padL(f ? kr.candidates : "·", 6)} ${padL(f ? sp(kr) : "·", 6)} ` +
        `${padL(f ? kr.sameOrPresumedWithPrice : "·", 6)} | ` +
        `${padL(f ? os.candidates : "·", 5)} ${padL(f ? sp(os) : "·", 5)} ` +
        `${padL(f ? os.sameOrPresumedWithPrice : "·", 5)} | ` +
        `${padL(f ? unk.candidates : "·", 3)}`,
    );
  }
  console.log("\n  W=WEB_SEARCH D=DOMESTIC_LISTING O=OVERSEAS_AUTO G=GEMINI S=SELLER_URL R=REVIEWED_SAME");
  console.log("  S/P = SAME + PRESUMED_SAME · 🇰🇷가격 = SAME/PRESUMED 이면서 가격이 있는 후보 수");
  if (anyFunnel === 0) {
    console.log(
      "\n🔴🔴 `funnel` 칸이 **전건 없다** — MI-FUNNEL-PERSIST-01 배포 «전» 실행이다.\n" +
        "   🔴 그러므로 시장별 숫자는 **측정불가** 다(「국내 0」으로 적지 않는다).\n" +
        "   🟢 생산자 열(W/D/O/G/S/R)은 그 전부터 저장되므로 **공급 유무는 그것으로 읽는다**.",
    );
  } else if (anyFunnel < runs.length) {
    console.log(
      `\n🟡 \`funnel\` 보유 ${anyFunnel}/${runs.length} — 배포 전/후 실행이 섞여 있다.` +
        " 🔴 두 구간을 **같은 표로 집계하지 않는다**.",
    );
  }
  /** 🔴 공급 유무는 생산자 열로 집계한다 — funnel 이 없는 구간에서도 읽을 수 있다. */
  const sum = (k) => runs.reduce((a, x) => a + ((x.search_run?.producers ?? {})[k] ?? 0), 0);
  console.log(
    "\n=== ② 생산자 합(전 실행) ===",
    JSON.stringify({
      WEB_SEARCH: sum("WEB_SEARCH"),
      DOMESTIC_LISTING: sum("DOMESTIC_LISTING"),
      OVERSEAS_AUTO: sum("OVERSEAS_AUTO"),
      GEMINI: sum("GEMINI"),
      SELLER_URL: sum("SELLER_URL"),
      REVIEWED_SAME: sum("REVIEWED_SAME"),
    }),
  );
  /** 🔴 Search 실패는 공급 0 과 **다른 축** 이다 — 같이 적는다. */
  const failed = runs.filter((x) => x.search_run?.search?.failed === true).length;
  const timeout = runs.filter((x) => x.search_run?.search?.timeout === true).length;
  console.log(
    `=== ② Search 실패 축 === ${JSON.stringify({ runs: runs.length, failed, timeout })}` +
      "   🔴 실패한 실행의 숫자를 「공급 0」으로 세지 않는다",
  );
}

await p.$disconnect();
