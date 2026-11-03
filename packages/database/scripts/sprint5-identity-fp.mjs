/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 5 — IDENTITY PRECISION DIAGNOSIS (read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **진단 전용** — 쓰기 0 · 외부 호출 0 · 운영 코드 0.
 * 🔴 사람 판정(`human_verdict`)과 **그 실행의 시스템 판정**(`system_verdict`)을 같이
 *    꺼낸다. 🔴 둘은 서로 **덮지 않는다**(WU-081/131 계약) — 그래서 한 행에 둘 다 있다.
 * 🔴 빈칸을 **추정으로 채우지 않는다**.
 *
 * 🔴🔴 칸 이름을 **추측하지 않았다** — `information_schema` 로 읽은 실제 이름이다
 *    (1차에 `url`/`system_match_truth` 로 썼다가 **42703 으로 터졌다** · 이 트랙의 반복 함정).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const rows = await p.$queryRawUnsafe(`
  select r.snapshot_id, s.title as origin_title, r.origin_code,
         r.candidate_domain, r.candidate_title, r.candidate_url,
         r.system_verdict, r.match_truth, r.price_tier, r.blockers,
         r.human_verdict, r.market, r.price_amount, r.price_currency,
         coalesce(r.reviewed_at, r.last_seen_at) as at
    from candidate_reviews r
    left join product_snapshots s on s.id = r.snapshot_id
   order by coalesce(r.reviewed_at, r.last_seen_at) desc
   limit 120
`);

const pad = (s, n) => String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
console.log(`candidate_reviews 행 ${rows.length}건 (최근순)\n`);

const labelled = rows.filter((r) => r.human_verdict);
let fp = 0;
let tp = 0;
const blockerFreqFp = new Map();

/** 🔴 `LABELLED=1` 이면 **사람 판정이 있는 행만** 찍는다(미판정 행이 표를 덮는다). */
const ONLY_LABELLED = process.env.LABELLED === "1";
for (const r of ONLY_LABELLED ? labelled : rows) {
  const human = r.human_verdict ?? null;
  const sys = r.system_verdict ?? "-";
  const sysPositive = sys === "SAME" || sys === "PRESUMED_SAME";
  const isFp = human === "DIFFERENT" && sysPositive;
  const isTp = human === "SAME" && sysPositive;
  if (isFp) fp++;
  if (isTp) tp++;
  if (isFp) {
    const blk = Array.isArray(r.blockers) ? r.blockers : [];
    for (const b of blk.length ? blk : ["(blocker 없음)"]) blockerFreqFp.set(b, (blockerFreqFp.get(b) ?? 0) + 1);
  }
  console.log(
    `${isFp ? "🔴FP" : isTp ? "🟢TP" : human ? "  ·" : "   "} ${pad(r.origin_title, 26)} ${pad(r.candidate_domain, 22)} ` +
      `h=${pad(human ?? "(미판정)", 10)} sys=${pad(sys, 14)} truth=${pad(r.match_truth, 16)} tier=${pad(r.price_tier, 11)} ` +
      `${pad(r.price_amount, 8)} ${pad(r.price_currency, 4)}`,
  );
  console.log(`      "${String(r.candidate_title ?? "-").slice(0, 76)}"  blk=${JSON.stringify(r.blockers ?? null)}`);
  /**
   * 🔴 **왜 올라갔는가** 는 blocker 가 아니라 «근거 축» 이 말한다(§1 질문 1·2).
   *    🔴 `match_reasons` 는 운영이 저장한 값 그대로다 — 내가 만들지 않는다.
   */
  if (process.env.REASONS === "1" && Array.isArray(r.match_reasons)) {
    for (const why of r.match_reasons) console.log(`        · ${String(why).slice(0, 92)}`);
  }
}

console.log(`\n── 집계 ─────────────────────────────────────────────────────`);
console.log(`  사람 판정 있는 행 = ${labelled.length} / 전체 ${rows.length}  🔴 나머지는 분모에 넣지 않는다(측정불가)`);
console.log(`  🔴 FALSE POSITIVE (human DIFFERENT × system SAME/PRESUMED) = ${fp}`);
console.log(`  🟢 AGREE        (human SAME     × system SAME/PRESUMED) = ${tp}`);
if (labelled.length) {
  const denom = fp + tp;
  console.log(`  precision(시스템 positive 중 사람 SAME) = ${tp}/${denom}` + (denom ? ` = ${((tp / denom) * 100).toFixed(0)}%` : ""));
}
if (blockerFreqFp.size) {
  console.log(`\n  🔴 FP 들이 «달고 있던» blocker 빈도 — 이게 「보류인데 통과했다」의 증거다`);
  for (const [b, n] of [...blockerFreqFp.entries()].sort((a, c) => c[1] - a[1])) {
    console.log(`     ${pad(b, 30)} ${n}`);
  }
}
await p.$disconnect();
