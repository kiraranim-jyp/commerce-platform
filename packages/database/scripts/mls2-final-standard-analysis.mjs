/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 FINAL — **기존 전수 데이터로 Evidence 기준을 확정한다**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 지시(2026-11-06): 「새 상품 수집 · 사이트 추출 · 429 · 새 하니스 **금지**.
 *    이미 확보한 데이터로 **동일상품 판단 기준을 완성** 한다.」
 *
 * 🔴 **평가 가능한 분모를 분리한다** — 「Evidence 가 부족한 행은 성능 평가 분모에서
 *    제외한다」(CPO §5). 그래서 행마다 **관측 가능한 핵심 축 수** 를 먼저 센다.
 * 🔴 라벨 번역 0 · 원본 수정 0 · DB 쓰기 0 · HTTP 0 · 판정 로직 변경 0.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select origin_code, candidate_domain, candidate_url, candidate_title, human_verdict, human_note,
         system_verdict, match_truth, price_amount, price_currency, price_status, price_tier,
         market, image_url, sold_out, source, blockers::text blk, match_reasons::text rsn
    from candidate_reviews where human_verdict is not null
   order by origin_code, candidate_domain`);

const J = (s) => { try { const v = JSON.parse(s ?? "null"); return Array.isArray(v) ? v : []; } catch { return []; } };
const pad = (s, n) => String(s ?? "-").padEnd(n);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 FINAL — 전수 Evidence 분석 및 2-of-3 성능");
console.log("══════════════════════════════════════════════════════════════════\n");
console.log(`사람 판정 행 ${rows.length} (운영 DB candidate_reviews 단독 분모)\n`);

/* ── ① 상품별 GT — 🔴 인수인계 표와 «대조» 한다 ──────────────────────────── */
const byOrigin = new Map();
for (const r of rows) {
  const k = r.origin_code ?? "(null)";
  const o = byOrigin.get(k) ?? { SAME: 0, DIFFERENT: 0, SIMILAR: 0, other: 0, urls: new Set() };
  if (o[r.human_verdict] !== undefined) o[r.human_verdict]++;
  else o.other++;
  o.urls.add(r.candidate_url);
  byOrigin.set(k, o);
}
console.log("── ① 상품별 CEO GT(원본 대조) ──");
console.log(`${pad("상품", 12)} ${pad("행", 4)} ${pad("고유URL", 8)} ${pad("SAME", 6)} ${pad("DIFF", 6)} ${pad("SIMILAR", 8)} 기타`);
let tS = 0, tD = 0, tSim = 0, tDup = 0;
for (const [k, o] of [...byOrigin.entries()].sort((a, b) => b[1].SAME + b[1].DIFFERENT - (a[1].SAME + a[1].DIFFERENT))) {
  const n = o.SAME + o.DIFFERENT + o.SIMILAR + o.other;
  tS += o.SAME; tD += o.DIFFERENT; tSim += o.SIMILAR; tDup += n - o.urls.size;
  console.log(`${pad(k, 12)} ${pad(n, 4)} ${pad(o.urls.size, 8)} ${pad(o.SAME, 6)} ${pad(o.DIFFERENT, 6)} ${pad(o.SIMILAR, 8)} ${o.other}`);
}
console.log(`${pad("합계", 12)} ${pad(rows.length, 4)} ${pad("", 8)} ${pad(tS, 6)} ${pad(tD, 6)} ${pad(tSim, 8)}`);
console.log(`🔴 같은 URL 이 한 상품에 여러 행으로 있는 경우 ${tDup}건 — 🔴 병합하지 않았다(표시만)`);

/* ── ② Evidence 확보율 ──────────────────────────────────────────────────── */
const miss = (f) => rows.filter(f).length;
console.log("\n── ② Evidence 확보율(사람 판정 행 기준) ──");
const cov = [
  ["match_reasons", miss((r) => J(r.rsn).length === 0)],
  ["blockers 칸", miss((r) => r.blk == null)],
  ["system_verdict", miss((r) => !r.system_verdict)],
  ["match_truth", miss((r) => !r.match_truth)],
  ["candidate_title", miss((r) => !r.candidate_title)],
  ["price_amount", miss((r) => r.price_amount == null)],
  ["price_status", miss((r) => !r.price_status)],
  ["market", miss((r) => !r.market || r.market === "UNKNOWN")],
  ["image_url", miss((r) => !r.image_url)],
];
for (const [k, n] of cov) console.log(`  ${pad(k, 18)} 미수집 ${pad(n, 4)} / ${rows.length}   확보 ${rows.length - n}`);

/* ── ③ 핵심 축별 관측 가능성 + 2-of-3 적용 ─────────────────────────────── */
const analysed = rows.map((r) => {
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    /** 🔴 이 표에 conflicts 칸이 **없다** ⟹ MODEL_CODE 충돌은 측정불가(0 으로 세지 않는다). */
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: splitEvidenceReasons(J(r.rsn)),
  });
  const observable = res.findings.filter((f) => f.state !== "UNKNOWN").length;
  return { r, res, observable };
});

console.log("\n── ③ 핵심 축별 상태 분포 ──");
for (const axis of ["BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER"]) {
  const c = { MATCHED: 0, MISMATCHED: 0, UNKNOWN: 0 };
  for (const a of analysed) c[a.res.findings.find((f) => f.axis === axis).state]++;
  console.log(`  ${pad(axis, 19)} MATCHED ${pad(c.MATCHED, 4)} MISMATCHED ${pad(c.MISMATCHED, 4)} 🔴 UNKNOWN ${c.UNKNOWN}`);
}
const obs = { 0: 0, 1: 0, 2: 0, 3: 0 };
for (const a of analysed) obs[a.observable]++;
console.log(`\n  관측 가능한 핵심 축 수 — 0축 ${obs[0]} · 1축 ${obs[1]} · 🟢 2축 ${obs[2]} · 🟢 3축 ${obs[3]}`);
console.log(`  🔴 **2-of-3 을 평가할 수 있는 행 = 2축 이상 = ${obs[2] + obs[3]}** (나머지 ${obs[0] + obs[1]} 은 구조적으로 HIGH 가 불가능하다)`);

/* ── ④ CPO §5 교차표 — 전수 / 평가가능 두 분모로 «갈라» 적는다 ─────────── */
const CLS = ["HIGH", "POSSIBLE", "CONFLICTED", "INSUFFICIENT"];
const table = (set, label) => {
  console.log(`\n── ④ ${label} (n=${set.length}) ──`);
  console.log(`${pad("CEO 판정", 12)} ${CLS.map((c) => pad(c, 13)).join("")}합계`);
  for (const v of ["SAME", "DIFFERENT", "SIMILAR", "UNCERTAIN"]) {
    const sub = set.filter((a) => a.r.human_verdict === v);
    if (sub.length === 0 && v === "UNCERTAIN") continue;
    console.log(
      `${pad(v, 12)} ${CLS.map((c) => pad(sub.filter((a) => a.res.probability === c).length, 13)).join("")}${sub.length}`,
    );
  }
};
table(analysed, "전수 분모 — 🔴 성능 지표로 쓰지 않는다(Evidence 결손 포함)");
const evaluable = analysed.filter((a) => a.observable >= 2);
table(evaluable, "🟢 **평가 가능 분모**(핵심 축 2개 이상 관측)");

const eS = evaluable.filter((a) => a.r.human_verdict === "SAME");
const eD = evaluable.filter((a) => a.r.human_verdict === "DIFFERENT");
const hiS = eS.filter((a) => a.res.probability === "HIGH").length;
const hiD = eD.filter((a) => a.res.probability === "HIGH").length;
console.log(`\n🟢 평가 가능 CEO SAME ${eS.length} · DIFFERENT ${eD.length}`);
console.log(`🟢 HIGH 중 CEO SAME ${hiS} · 🔴 CEO DIFFERENT ${hiD}  ⟹ 오포함 ${hiD}건`);
console.log(`🔴 평가 가능 SAME 중 HIGH 가 아닌 것 ${eS.length - hiS}건(놓침)`);
console.log(`🔴 평가 분모에서 제외된 행 ${analysed.length - evaluable.length}건 — 🔴 성공/실패로 세지 않는다`);

/* ── ⑤ 전수 후보 비교표 파일 ────────────────────────────────────────────── */
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02", "mls2-final-candidates.tsv");
const head = [
  "origin_code", "candidate_domain", "candidate_url", "candidate_title", "ceo_verdict", "ceo_note",
  "system_verdict", "match_truth", "BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER",
  "observable_axes", "probability", "supporting", "conflicting",
  "price_amount", "price_currency", "price_status", "price_tier", "market", "image_url", "producer",
].join("\t");
const body = analysed.map(({ r, res, observable }) =>
  [
    r.origin_code, r.candidate_domain, r.candidate_url, r.candidate_title, r.human_verdict, r.human_note,
    r.system_verdict, r.match_truth,
    ...res.findings.map((f) => f.state),
    observable, res.probability, res.supporting.join(" | "), res.conflicting.join(" | "),
    r.price_amount, r.price_currency, r.price_status, r.price_tier, r.market, r.image_url, r.source,
  ].map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t"),
);
writeFileSync(out, [head, ...body].join("\n"), "utf8");
console.log(`\n🟢 전수 후보 비교표 → ${out}  (${body.length}행 · 원본 라벨·근거 보존)`);

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · HTTP 0 · 라벨 번역 0 · 판정 로직 변경 0.");
await p.$disconnect();
