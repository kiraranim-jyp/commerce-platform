/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 — **CPO 2차 진위 검증용 비교표**(HIGH 48건 · read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 는 2차 판정을 «하지 않는다».** CPO 원문:
 *    「근거 없이 CPO_CONFIRMED 로 승격하지 않는다」 ·
 *    「CTO 가 비교표와 검증 근거를 제출하면 **제가 CPO 기준으로 최종 판정**」.
 *    ⟹ 🟢 이 스크립트는 **판정 칸을 비워 둔다**(`cpo_verdict` 공란).
 *    🟢 단 **기계적으로 자명한 것 하나** 는 미리 표시한다 —
 *       비교 근거가 구조적으로 부족한 행은 `CPO_REVIEW(근거부족)` 로 **제안** 한다
 *       (🔴 제안이고 판정이 아니다 · 사유를 같이 적는다).
 *
 * 🔴 금지 준수 — 신규 수집 0 · 사이트 접속 0 · 429 조사 0 · 기준 재설계 0 ·
 *    threshold 0 · GT 변경 0 · 가격 정책 0 · 기존 판정 덮어쓰기 0 · DB 쓰기 0.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select cr.origin_code, cr.snapshot_id, cr.candidate_domain, cr.candidate_url, cr.candidate_title,
         cr.human_verdict, cr.system_verdict, cr.match_truth, cr.price_amount, cr.price_currency,
         cr.price_status, cr.price_tier, cr.market, cr.image_url, cr.source,
         cr.blockers::text blk, cr.match_reasons::text rsn,
         ps.source_url origin_url,
         ps.workspace->'canonicalProduct'->'title'->>'value' origin_title,
         ps.workspace->'canonicalProduct'->'brand'->>'value' origin_brand
    from candidate_reviews cr
    left join product_snapshots ps on ps.id = cr.snapshot_id
   order by cr.origin_code nulls last, cr.candidate_domain`);

const J = (s) => { try { const v = JSON.parse(s ?? "null"); return Array.isArray(v) ? v : []; } catch { return []; } };
const pad = (s, n) => String(s ?? "-").padEnd(n);

const A = rows.map((r) => {
  const ag = splitEvidenceReasons(J(r.rsn));
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: ag,
  });
  return { r, res, ag, observable: res.findings.filter((f) => f.state !== "UNKNOWN").length };
});

const HIGH = A.filter((a) => a.res.probability === "HIGH");
const POSSIBLE = A.filter((a) => a.res.probability === "POSSIBLE");

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 — CPO 2차 진위 검증용 비교표");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log(`🟢 1차 HIGH **${HIGH.length}건** ← CPO 2차 검증 대상`);
console.log(`🟡 1차 POSSIBLE **${POSSIBLE.length}건** ← **보류 목록**(이번 통과 대상 아님)`);
console.log(`🔴 CONFLICTED / INSUFFICIENT 는 통과 후보에 **포함하지 않았다**\n`);

/* ── ① 원상품 연결 — 🔴 STEP 4 의 선행 조건이다 ────────────────────────── */
const linked = HIGH.filter((a) => a.r.origin_code && a.r.origin_url);
const unlinked = HIGH.filter((a) => !a.r.origin_code || !a.r.origin_url);
console.log("── ① 원상품 연결 상태(STEP 4 선행) ──");
console.log(`  🟢 원상품 연결됨 ${linked.length} / ${HIGH.length}`);
console.log(`  🔴 **연결 없음 ${unlinked.length}** — origin_code 또는 스냅샷 조인 실패`);
const byOrigin = new Map();
for (const a of HIGH) {
  const k = a.r.origin_code ?? "(origin_code null)";
  byOrigin.set(k, (byOrigin.get(k) ?? 0) + 1);
}
console.log("  원상품별 HIGH 건수:");
for (const [k, n] of [...byOrigin].sort((x, y) => y[1] - x[1])) console.log(`    ${pad(k, 22)} ${n}`);

/* ── ② 비교 근거 충분성 — 🔴 «제안» 이고 판정이 아니다 ─────────────────── */
console.log("\n── ② 비교 근거 충분성(🔴 CTO 제안 · 판정 아님) ──");
const suggest = (a) => {
  const need = [];
  if (!a.r.candidate_title) need.push("후보상품명");
  if (!a.r.image_url) need.push("이미지");
  if (!a.r.origin_code) need.push("원상품연결");
  if (a.ag.agree.length === 0 && a.ag.hold.length === 0) need.push("근거문장");
  return need;
};
let enough = 0;
const shortRows = [];
for (const a of HIGH) {
  const n = suggest(a);
  if (n.length === 0) enough++;
  else shortRows.push({ a, n });
}
console.log(`  🟢 비교 가능(필수 자료 전부 있음) ${enough} / ${HIGH.length}`);
console.log(`  🔴 **CPO_REVIEW 제안(자료 부족) ${shortRows.length}** — 부족 항목별:`);
const miss = new Map();
for (const { n } of shortRows) for (const x of n) miss.set(x, (miss.get(x) ?? 0) + 1);
for (const [k, v] of [...miss].sort((x, y) => y[1] - x[1])) console.log(`      ${pad(k, 14)} ${v}건`);

/* ── ③ 가격 연결(STEP 4) ───────────────────────────────────────────────── */
console.log("\n── ③ HIGH 후보의 가격 연결 ──");
const verified = HIGH.filter((a) => a.r.price_status === "VERIFIED_CURRENT" && a.r.price_amount != null);
console.log(`  가격 관측 ${HIGH.filter((a) => a.r.price_amount != null).length} · 🟢 확정(VERIFIED_CURRENT) ${verified.length}`);
const vLinked = verified.filter((a) => a.r.origin_code && a.r.origin_url);
console.log(`  🔴 확정 가격 중 **원상품 연결된 것 ${vLinked.length}** — 🔴 연결 없는 가격은 최저 소싱처로 **확정하지 않는다**`);
const byCur = new Map();
for (const a of vLinked) {
  const k = a.r.price_currency ?? "?";
  const v = Number(a.r.price_amount);
  const cur = byCur.get(k);
  if (!cur || v < cur.v) byCur.set(k, { v, dom: a.r.candidate_domain, origin: a.r.origin_code });
}
if (byCur.size === 0) console.log("  🔴 **통화별 최저 유효 소싱가격을 산출할 수 없다** — 원상품 연결된 확정가격이 0건이다");
else for (const [k, x] of byCur) console.log(`  🟢 ${pad(k, 5)} 최저 ${String(x.v).padStart(9)}  ${pad(x.dom, 26)} 원상품 ${x.origin}`);

/* ── ④ 국내 축 ────────────────────────────────────────────────────────── */
const kr = HIGH.filter((a) => a.r.market === "KR");
console.log(`\n── ④ 국내 축 ──\n  HIGH 중 market=KR **${kr.length}건**`);
console.log("  🔴 이 표에 `WEB_SEARCH`·`DOMESTIC_LISTING` 이 **구조적으로 없다** ⟹");
console.log("     🔴 **「국내 동일상품이 없다」로 읽지 않는다**(국내 관측 owner 는 `workspace.searchRun`)");

/* ── ⑤ CPO 제출용 비교표 ──────────────────────────────────────────────── */
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02", "mls2-cpo-secondary-HIGH48.tsv");
const head = [
  "원상품식별자", "원상품명", "원상품브랜드", "원상품URL",
  "후보상품명", "후보판매처", "후보URL", "시장",
  "1차판정", "BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER", "관측축수",
  "핵심일치근거", "핵심불일치근거", "보조근거",
  "가격", "통화", "가격검증상태", "price_tier", "이미지",
  "기존시스템verdict", "CEO_GT(검증용)", "원상품연결",
  "CTO제안(판정아님)", "부족자료",
  "CPO_2차판정(공란)", "CPO_판정사유(공란)",
].join("\t");
const body = HIGH.map(({ r, res, ag }) => {
  const need = suggest({ r, ag });
  return [
    r.origin_code, r.origin_title, r.origin_brand, r.origin_url,
    r.candidate_title, r.candidate_domain, r.candidate_url, r.market,
    res.probability, ...res.findings.map((f) => f.state), res.findings.filter((f) => f.state !== "UNKNOWN").length,
    ag.agree.join(" | "), ag.hold.join(" | "), res.supporting.join(" | "),
    r.price_amount, r.price_currency, r.price_status, r.price_tier, r.image_url,
    r.system_verdict, r.human_verdict, r.origin_code && r.origin_url ? "연결됨" : "🔴 연결없음",
    need.length === 0 ? "" : "CPO_REVIEW(근거부족)", need.join(","),
    "", "",
  ].map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t");
});
writeFileSync(out, [head, ...body].join("\n"), "utf8");
console.log(`\n🟢 **CPO 제출용 비교표** → ${out}  (${body.length}행 · 28칸)`);
console.log("🔴 `CPO_2차판정` · `CPO_판정사유` 칸은 **공란** 이다 — CTO 가 채우지 않았다.");

const outP = path.join(path.dirname(out), "mls2-possible33-hold.tsv");
writeFileSync(
  outP,
  [head, ...POSSIBLE.map(({ r, res, ag }) => [
    r.origin_code, r.origin_title, r.origin_brand, r.origin_url,
    r.candidate_title, r.candidate_domain, r.candidate_url, r.market,
    res.probability, ...res.findings.map((f) => f.state), res.findings.filter((f) => f.state !== "UNKNOWN").length,
    ag.agree.join(" | "), ag.hold.join(" | "), res.supporting.join(" | "),
    r.price_amount, r.price_currency, r.price_status, r.price_tier, r.image_url,
    r.system_verdict, r.human_verdict, r.origin_code && r.origin_url ? "연결됨" : "🔴 연결없음",
    "", "", "", "",
  ].map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t"))].join("\n"),
  "utf8",
);
console.log(`🟡 보류 목록(POSSIBLE ${POSSIBLE.length}) → ${outP}`);

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · HTTP 0 · 2차 판정 0 · 기준 재설계 0 · 병합 0.");
await p.$disconnect();
