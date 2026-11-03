/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 6 — **전체 흐름 정합성 감사**(read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO(2026-11-03): 「현재 구현이 실제로 끝까지 제대로 작동하는지 CTO 가 스스로 검증하고
 * 결함이 있으면 완결한다.」 🔴 **정책은 바꾸지 않는다** — 결함만 찾는다.
 *
 * 🔴 쓰기 0 · 외부 호출 0 · 운영 코드 0 · 과금 0.
 * 🔴 **추정으로 칸을 채우지 않는다** — 없으면 「측정불가」로 적는다.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = (s) => p.$queryRawUnsafe(s);
const pad = (s, n) => String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const findings = [];
const add = (sev, area, msg) => findings.push({ sev, area, msg });

console.log("═══ SPRINT 6 — FLOW AUDIT (read-only) ═══\n");

/* ── A. searchRun ↔ producer ↔ 후보 이력 정합 ───────────────────────────── */
const runs = await q(`
  select id, title,
         (workspace->'searchRun'->'search'->>'organic')::int  as organic,
         (workspace->'searchRun'->'search'->>'failed')        as failed,
         (workspace->'searchRun'->'producers'->>'WEB_SEARCH')::int      as p_web,
         (workspace->'searchRun'->'producers'->>'OVERSEAS_AUTO')::int   as p_os,
         (workspace->'searchRun'->'producers'->>'DOMESTIC_LISTING')::int as p_dom,
         (select count(*)::int from candidate_reviews r where r.snapshot_id = s.id) as reviews
    from product_snapshots s
   where workspace ? 'searchRun' order by updated_at desc`);
console.log("── A. searchRun ↔ 후보 이력 ─────────────────────────────────");
console.log(`${pad("상품", 30)} ${pad("organic", 8)} ${pad("failed", 7)} ${pad("W/O/D", 10)} ${pad("reviews", 8)}`);
for (const r of runs) {
  const prod = (r.p_web ?? 0) + (r.p_os ?? 0) + (r.p_dom ?? 0);
  console.log(
    `${pad(r.title, 30)} ${pad(r.organic, 8)} ${pad(r.failed, 7)} ${pad(`${r.p_web}/${r.p_os}/${r.p_dom}`, 10)} ${pad(r.reviews, 8)}` +
      (prod > 0 && r.reviews === 0 ? "  🔴 후보는 있는데 **이력 0**" : ""),
  );
  /** 🔴 후보가 있었는데 이력이 0 이면 재진입에서 그 후보가 사라진다. */
  if (prod > 0 && r.reviews === 0) add("🔴", "A/이력", `${r.title}: producer ${prod} 인데 candidate_reviews 0`);
}

/* ── B. 사람 GT 충돌 — 같은 후보 URL 에 서로 다른 라벨 ────────────────── */
const conflict = await q(`
  select candidate_url, count(distinct human_verdict)::int k,
         array_agg(distinct human_verdict) as verdicts, count(*)::int n
    from candidate_reviews where human_verdict is not null
   group by candidate_url having count(distinct human_verdict) > 1`);
console.log("\n── B. 사람 판정 충돌(같은 URL · 다른 라벨) ──────────────────");
if (conflict.length === 0) console.log("  🟢 충돌 0");
for (const c of conflict) {
  console.log(`  🔴 ${c.verdicts.join(" ↔ ")} (${c.n}행) ${String(c.candidate_url).slice(0, 86)}`);
  add("🔴", "B/GT", `사람 판정 충돌 ${c.verdicts.join("↔")} — ${c.candidate_url}`);
}

/* ── C. 저장 칸 누락 — 재진입 복원이 무엇을 잃는가 ──────────────────── */
const miss = await q(`
  select source,
         count(*)::int n,
         count(*) filter (where system_verdict is null)::int no_verdict,
         count(*) filter (where price_status  is null)::int no_pstatus,
         count(*) filter (where image_url     is null)::int no_image,
         count(*) filter (where match_reasons is null)::int no_reasons
    from candidate_reviews group by source order by source`);
console.log("\n── C. 재진입 복원 칸 누락 ───────────────────────────────────");
console.log(`${pad("source", 18)} ${pad("n", 5)} ${pad("verdict∅", 9)} ${pad("price∅", 8)} ${pad("image∅", 8)} ${pad("reasons∅", 9)}`);
for (const m of miss) {
  console.log(`${pad(m.source, 18)} ${pad(m.n, 5)} ${pad(m.no_verdict, 9)} ${pad(m.no_pstatus, 8)} ${pad(m.no_image, 8)} ${pad(m.no_reasons, 9)}`);
}

/* ── D. 가격 자격 ↔ tier 정합(P1 계약이 저장분에서도 지켜지는가) ─────── */
const price = await q(`
  select system_verdict, price_tier, count(*)::int n,
         count(*) filter (where price_amount is not null)::int priced
    from candidate_reviews where system_verdict is not null
   group by 1,2 order by 1,2`);
console.log("\n── D. verdict × price_tier(저장분) ──────────────────────────");
for (const r of price) {
  const bad = ["SIMILAR", "CONFLICT", "UNKNOWN"].includes(r.system_verdict) && r.price_tier === "EXACT";
  console.log(`  ${pad(r.system_verdict, 15)} ${pad(r.price_tier, 12)} n=${pad(r.n, 4)} 가격보유=${r.priced}${bad ? "  🔴 자격 위반" : ""}`);
  if (bad) add("🔴", "D/가격", `${r.system_verdict} 인데 tier EXACT (${r.n}행)`);
}

/* ── E. 시장 분류 — KRW ↔ market 정합 ─────────────────────────────────── */
const mk = await q(`
  select market, price_currency, count(*)::int n from candidate_reviews
   where price_currency is not null group by 1,2 order by 1,2`);
console.log("\n── E. market × 통화 ─────────────────────────────────────────");
for (const r of mk) {
  const bad = r.market === "KR" && r.price_currency !== "KRW";
  const odd = r.market === "OVERSEAS" && r.price_currency === "KRW";
  console.log(`  ${pad(r.market, 10)} ${pad(r.price_currency, 5)} n=${r.n}${bad ? "  🔴 KR 인데 외화" : odd ? "  🟡 해외인데 KRW" : ""}`);
  if (bad) add("🔴", "E/시장", `market=KR 인데 ${r.price_currency} (${r.n}행)`);
}

/* ── F. 등록 연결 — 스냅샷 상태 분포 ─────────────────────────────────── */
const st = await q(`select status, count(*)::int n from product_snapshots group by 1 order by 2 desc`);
console.log("\n── F. 스냅샷 status 분포 ────────────────────────────────────");
console.log("  " + st.map((r) => `${r.status}:${r.n}`).join(" · "));

console.log("\n═══ 발견 ═══");
if (findings.length === 0) console.log("  🟢 데이터 축 결함 0");
for (const f of findings) console.log(`  ${f.sev} [${f.area}] ${f.msg}`);
await p.$disconnect();
