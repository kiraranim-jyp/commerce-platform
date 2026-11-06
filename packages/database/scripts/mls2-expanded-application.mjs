/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 — **확장 후보군 «전체» 에 CPO Evidence 기준 일괄 적용**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 방향(2026-11-06): 「38행은 **검증용** 이고 **확장된 후보군 전체가 실제 적용
 *    대상** 이다. `DETAIL_IDENTIFIER` 가 UNKNOWN 이 많다는 이유로 전체 적용을 멈추지 않는다.」
 *
 * 🔴 금지 준수 — 신규 수집 0 · 사이트 재접속 0 · 429 조사 0 · 새 하니스 0 ·
 *    Evidence 재적재 0 · threshold 변경 0 · 정책 변경 0 · schema/운영 코드 0 · DB 쓰기 0.
 * 🔴 새 기준/가중치 **만들지 않는다** — `classifySellerProbability` 를 **그대로** 쓴다.
 * 🔴 원본 후보를 **삭제·병합하지 않는다**(중복은 표시만).
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
/** 🔴 **전수** 다 — `human_verdict` 조건을 걸지 않는다(그것이 38행 제한의 원인이었다). */
const rows = await p.$queryRawUnsafe(`
  select origin_code, candidate_domain, candidate_url, candidate_title, human_verdict, human_note,
         system_verdict, match_truth, price_amount, price_currency, price_status, price_tier,
         market, image_url, sold_out, source, blockers::text blk, match_reasons::text rsn
    from candidate_reviews order by origin_code, candidate_domain`);

const J = (s) => { try { const v = JSON.parse(s ?? "null"); return Array.isArray(v) ? v : []; } catch { return []; } };
const pad = (s, n) => String(s ?? "-").padEnd(n);
const CLS = ["HIGH", "POSSIBLE", "CONFLICTED", "INSUFFICIENT"];

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 — 확장 후보군 전체에 CPO Evidence 기준 적용");
console.log("══════════════════════════════════════════════════════════════════\n");

const A = rows.map((r) => {
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    /** 🔴 이 표에 `conflicts` 칸이 없다 ⟹ MODEL_CODE 충돌은 측정불가(0 으로 세지 않는다). */
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: splitEvidenceReasons(J(r.rsn)),
  });
  return { r, res, observable: res.findings.filter((f) => f.state !== "UNKNOWN").length };
});

const uniq = new Set(rows.map((x) => x.candidate_url)).size;
console.log(`후보 행 **${rows.length}** · 고유 URL **${uniq}** · 원상품 ${new Set(rows.map((x) => x.origin_code)).size}`);
console.log(`🔴 같은 URL 이 여러 행 = ${rows.length - uniq}건 — **병합하지 않았다**(표시만)`);
const prod = new Map();
for (const r of rows) prod.set(r.source, (prod.get(r.source) ?? 0) + 1);
console.log(`생산자 — ${[...prod].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(
  "🔴🔴 **이 표에 `WEB_SEARCH` · `DOMESTIC_LISTING` 이 없다**(079 source CHECK 가 그 둘을 담지\n" +
    "   못한다 · 기존 확정 사실) ⟹ 🔴 **「국내 후보가 1건」을 국내 공급량으로 읽지 않는다**.\n" +
    "   국내 생산자 관측은 `workspace.searchRun` 이 owner 다 — 이 적용의 분모가 아니다.",
);

/* ── ① 전체 판정 분포(CPO §6-1~4) ──────────────────────────────────────── */
console.log("\n── ① 확장 후보군 전체 판정 분포 ──");
for (const c of CLS) {
  const n = A.filter((a) => a.res.probability === c).length;
  console.log(`  ${pad(c, 14)} ${String(n).padStart(4)}   ${((n / A.length) * 100).toFixed(1)}%`);
}

/* ── ② 시장 분포(CPO §6-5) ─────────────────────────────────────────────── */
console.log("\n── ② 시장 × 판정 ──");
console.log(`${pad("market", 11)} ${CLS.map((c) => pad(c, 13)).join("")}합계`);
for (const m of ["KR", "OVERSEAS", null]) {
  const sub = A.filter((a) => (m === null ? !a.r.market || a.r.market === "UNKNOWN" : a.r.market === m));
  if (sub.length === 0) continue;
  console.log(`${pad(m ?? "미확정", 11)} ${CLS.map((c) => pad(sub.filter((a) => a.res.probability === c).length, 13)).join("")}${sub.length}`);
}

/* ── ③ 축별 확보(CPO §6-6~7) ───────────────────────────────────────────── */
console.log("\n── ③ 핵심 축별 상태(전수) ──");
for (const axis of ["BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER"]) {
  const c = { MATCHED: 0, MISMATCHED: 0, UNKNOWN: 0 };
  for (const a of A) c[a.res.findings.find((f) => f.axis === axis).state]++;
  console.log(`  ${pad(axis, 19)} MATCHED ${pad(c.MATCHED, 5)} MISMATCHED ${pad(c.MISMATCHED, 5)} 🔴 UNKNOWN ${c.UNKNOWN}`);
}
const obs = { 0: 0, 1: 0, 2: 0, 3: 0 };
for (const a of A) obs[a.observable]++;
console.log(`  관측 축 — 0 ${obs[0]} · 1 ${obs[1]} · 🟢 2 ${obs[2]} · 🟢 3 ${obs[3]}`);
console.log(
  `  🔴 **DETAIL_IDENTIFIER 미측정 때문에 HIGH 가 구조적으로 불가능한 행 = ${obs[0] + obs[1]}**\n` +
    "     (관측 축이 1개 이하 ⟹ MATCHED 2 를 채울 수 없다) — 🔴 이것은 **데이터 품질** 이고 판정 오류가 아니다",
);

/* ── ④ 가격 비교 가능 후보(CPO §6-8) ───────────────────────────────────── */
console.log("\n── ④ 소싱가격 비교에 쓸 수 있는 후보 ──");
/** 🔴 기존 가격 정책을 그대로 쓴다 — `VERIFIED_CURRENT` 만 확정 가격이다. */
const priced = A.filter((a) => a.r.price_amount != null && Number.isFinite(Number(a.r.price_amount)));
const verified = priced.filter((a) => a.r.price_status === "VERIFIED_CURRENT");
console.log(`  가격 «관측» 있음 ${priced.length}   🟢 가격 «확정»(VERIFIED_CURRENT) ${verified.length}`);
console.log("  🔴 관측과 확정을 섞지 않는다 — 아래는 **확정 가격** 만 센다.");
for (const c of ["HIGH", "POSSIBLE"]) {
  const sub = verified.filter((a) => a.res.probability === c);
  const cur = new Map();
  for (const a of sub) cur.set(a.r.price_currency, (cur.get(a.r.price_currency) ?? 0) + 1);
  console.log(`  ${pad(c, 11)} ${String(sub.length).padStart(3)}건  통화별 ${[...cur].map(([k, v]) => `${k} ${v}`).join(" · ") || "-"}`);
}
/** 🔴 **통화를 섞어 최저가를 고르지 않는다**(환산 금지 계약). 통화별로만 낸다. */
const hp = verified.filter((a) => a.res.probability === "HIGH" || a.res.probability === "POSSIBLE");
const byCur = new Map();
for (const a of hp) {
  const k = a.r.price_currency ?? "?";
  const v = Number(a.r.price_amount);
  const cur = byCur.get(k);
  if (!cur || v < cur.v) byCur.set(k, { v, dom: a.r.candidate_domain, cls: a.res.probability, origin: a.r.origin_code });
}
console.log("  🟢 통화별 최저 «유효» 소싱 후보(🔴 환산 0 · 통화 혼합 비교 0):");
for (const [k, x] of byCur) console.log(`     ${pad(k, 5)} ${String(x.v).padStart(9)}  ${pad(x.dom, 26)} ${x.cls}  (원상품 ${x.origin})`);

/* ── ⑤ CEO GT 검증 분모는 «별도» 다 ───────────────────────────────────── */
const gt = A.filter((a) => a.r.human_verdict);
const gtEval = gt.filter((a) => a.observable >= 2);
console.log(`\n── ⑤ CEO GT 검증(별도 분모 · 적용 대상이 아니다) ──`);
console.log(`  GT 행 ${gt.length} · 평가 가능(관측 축 ≥2) ${gtEval.length}`);
const hiD = gtEval.filter((a) => a.r.human_verdict === "DIFFERENT" && a.res.probability === "HIGH").length;
const hiS = gtEval.filter((a) => a.r.human_verdict === "SAME" && a.res.probability === "HIGH").length;
console.log(`  🟢 오포함(CEO DIFFERENT → HIGH) **${hiD}**   HIGH 중 CEO SAME ${hiS}`);
const noGt = A.length - gt.length;
console.log(`  🔴 GT 가 «없는» 확장 후보 ${noGt}건 — **정답으로 간주하지 않고 성능 지표에 넣지 않았다**`);

/* ── ⑥ 전수 비교표 ─────────────────────────────────────────────────────── */
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02", "mls2-expanded-candidates.tsv");
const head = [
  "origin_code", "candidate_domain", "candidate_url", "candidate_title", "market", "producer",
  "ceo_verdict(검증용)", "system_verdict", "match_truth",
  "BRAND", "PRODUCT_NAME", "DETAIL_IDENTIFIER", "observable_axes",
  "CPO_판정", "강한불일치", "약한차이", "미확인", "보조근거", "불일치근거",
  "price_amount", "price_currency", "price_status", "price_tier", "image_url",
].join("\t");
const body = A.map(({ r, res, observable }) =>
  [
    r.origin_code, r.candidate_domain, r.candidate_url, r.candidate_title, r.market, r.source,
    r.human_verdict, r.system_verdict, r.match_truth,
    ...res.findings.map((f) => f.state), observable,
    res.probability, res.strongMismatchCount, res.weakMismatchCount, res.unknownCount,
    res.supporting.join(" | "), res.conflicting.join(" | "),
    r.price_amount, r.price_currency, r.price_status, r.price_tier, r.image_url,
  ].map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t"),
);
writeFileSync(out, [head, ...body].join("\n"), "utf8");
console.log(`\n🟢 확장 후보군 전수 비교표 → ${out}  (${body.length}행 · 24칸)`);

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · HTTP 0 · 새 기준 0 · 병합 0 · 정책 변경 0.");
await p.$disconnect();
