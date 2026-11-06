/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 — **기존 전체 데이터로 Evidence 기준 검증**(read-only · HTTP 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 금지 전수 준수 — 새 수집 0 · 새 하니스 0 · 새 분류 로직 0 · HTTP 0 ·
 *    429 조사 0 · 추출 조사 0 · Identity/가격 정책 변경 0 · DB 쓰기 0.
 * 🟢 기존 `seller-probability.ts`(표현 계층)와 운영 DB 를 **그대로** 쓴다.
 * 🔴 CEO 라벨을 **번역하지 않는다** — 원문 그대로 교차표를 만든다.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { classifySellerProbability } from "../../../apps/admin/src/app/pipeline/commerce/seller-probability.ts";
import { splitEvidenceReasons } from "../../../apps/admin/src/app/pipeline/commerce/blocker-text.ts";

const p = new PrismaClient();
const J = (s) => {
  try {
    const v = JSON.parse(s ?? "null");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/** 🔴 분모는 **운영 DB 의 사람 판정 행** 하나다(`DB_EXPORT` 중복을 섞지 않는다). */
const rows = await p.$queryRawUnsafe(`
  select origin_code, candidate_domain, candidate_url, candidate_title, image_url,
         human_verdict, human_note, system_verdict, match_truth, market,
         price_amount, price_currency, price_status, price_tier,
         blockers::text blk, match_reasons::text rsn, source
    from candidate_reviews
   where human_verdict is not null
   order by origin_code, candidate_domain`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 — 기존 전체 데이터 Evidence 기준 검증");
console.log("══════════════════════════════════════════════════════════════════\n");

/* ── ① 분모 확정 ─────────────────────────────────────────────────────────── */
const byOrigin = new Map();
const gtDist = new Map();
for (const r of rows) {
  const k = r.origin_code ?? "(null)";
  if (!byOrigin.has(k)) byOrigin.set(k, new Map());
  const m = byOrigin.get(k);
  m.set(r.human_verdict, (m.get(r.human_verdict) ?? 0) + 1);
  gtDist.set(r.human_verdict, (gtDist.get(r.human_verdict) ?? 0) + 1);
}
/** 🔴 중복 URL 을 **표시만** 한다 — 병합하지 않는다(CPO 금지). */
const urlSeen = new Map();
for (const r of rows) urlSeen.set(r.candidate_url, (urlSeen.get(r.candidate_url) ?? 0) + 1);
const dupUrls = [...urlSeen.entries()].filter(([, n]) => n > 1);

console.log(`① 사람 판정 행 **${rows.length}** · 원상품 ${byOrigin.size} · 고유 후보 URL ${urlSeen.size}`);
console.log(`   CEO 판정 분포 — ${[...gtDist].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`   🔴 중복 URL(표시만 · 병합 0) ${dupUrls.length}`);
console.log("   상품별:");
for (const [k, m] of byOrigin)
  console.log(`     ${String(k).padEnd(12)} ${[...m].map(([a, b]) => `${a} ${b}`).join(" · ")}`);

/* ── ② Evidence 확보율 ──────────────────────────────────────────────────── */
const cnt = (f) => rows.filter(f).length;
const ev = {
  candidate_title: cnt((r) => r.candidate_title),
  image_url: cnt((r) => r.image_url),
  system_verdict: cnt((r) => r.system_verdict),
  match_truth: cnt((r) => r.match_truth),
  match_reasons: cnt((r) => J(r.rsn).length > 0),
  blockers_present: cnt((r) => J(r.blk).length > 0),
  market: cnt((r) => r.market && r.market !== "UNKNOWN"),
  price_amount: cnt((r) => r.price_amount != null),
  price_status: cnt((r) => r.price_status),
  human_note: cnt((r) => r.human_note && String(r.human_note).trim()),
};
console.log(`\n② Evidence 확보율 (분모 ${rows.length})`);
for (const [k, v] of Object.entries(ev))
  console.log(`   ${k.padEnd(18)} ${String(v).padStart(3)} / ${rows.length}  ${((v / rows.length) * 100).toFixed(0)}%`);

/* ── ③ 핵심 3축 확보율 + 2-of-3 적용 ───────────────────────────────────── */
const axisTally = { BRAND: {}, PRODUCT_NAME: {}, DETAIL_IDENTIFIER: {} };
const grid = new Map();
const detail = [];
for (const r of rows) {
  const res = classifySellerProbability({
    crossSellerBlockers: J(r.blk),
    /** 🔴 `candidate_reviews` 에 conflicts 칸이 **없다** ⟹ 그 축은 측정불가다. */
    crossSellerConflicts: null,
    matchTruth: r.match_truth,
    agreement: splitEvidenceReasons(J(r.rsn)),
  });
  for (const f of res.findings) axisTally[f.axis][f.state] = (axisTally[f.axis][f.state] ?? 0) + 1;
  const key = `${r.human_verdict}|${res.probability}`;
  grid.set(key, (grid.get(key) ?? 0) + 1);
  detail.push({
    origin: r.origin_code,
    domain: r.candidate_domain,
    url: r.candidate_url,
    candidateTitle: r.candidate_title,
    ceo: r.human_verdict,
    ceoNote: r.human_note,
    system: r.system_verdict,
    matchTruth: r.match_truth,
    blockers: J(r.blk),
    agree: splitEvidenceReasons(J(r.rsn)).agree,
    hold: splitEvidenceReasons(J(r.rsn)).hold,
    axes: res.findings.map((f) => `${f.axis}:${f.state}`),
    probability: res.probability,
    matched: res.matchedCount,
    strongMismatch: res.strongMismatchCount,
    weakMismatch: res.weakMismatchCount,
    unknown: res.unknownCount,
    market: r.market,
    price: r.price_amount == null ? null : `${r.price_amount} ${r.price_currency ?? ""}`.trim(),
    priceStatus: r.price_status,
    priceTier: r.price_tier,
    producer: r.source,
  });
}
console.log("\n③ 핵심 3축 상태 분포");
for (const [a, m] of Object.entries(axisTally))
  console.log(`   ${a.padEnd(18)} ${Object.entries(m).map(([k, v]) => `${k} ${v}`).join(" · ")}`);

/* ── ④ CPO §5 교차표 ───────────────────────────────────────────────────── */
const PROBS = ["HIGH", "POSSIBLE", "CONFLICTED", "INSUFFICIENT"];
const VERDICTS = [...new Set(rows.map((r) => r.human_verdict))];
console.log("\n④ CEO 판정 × 고확률 분류 교차표");
console.log(`   ${"CEO".padEnd(11)} ${PROBS.map((x) => x.padEnd(13)).join("")}합계`);
for (const v of VERDICTS) {
  const line = PROBS.map((pr) => String(grid.get(`${v}|${pr}`) ?? 0).padEnd(13)).join("");
  const sum = PROBS.reduce((a, pr) => a + (grid.get(`${v}|${pr}`) ?? 0), 0);
  console.log(`   ${v.padEnd(11)} ${line}${sum}`);
}

/* ── ⑤ 평가 가능 분모 — 🔴 핵심 축이 전부 UNKNOWN 인 행은 **제외** ───────── */
const evaluable = detail.filter((d) => d.matched > 0 || d.strongMismatch > 0 || d.weakMismatch > 0);
const excluded = detail.filter((d) => !evaluable.includes(d));
const evSame = evaluable.filter((d) => d.ceo === "SAME");
const evDiff = evaluable.filter((d) => d.ceo === "DIFFERENT");
console.log(`\n⑤ 평가 가능 분모 — ${evaluable.length} / ${rows.length}  🔴 근거 부족 제외 ${excluded.length}`);
console.log(`   평가 가능 CEO SAME ${evSame.length} · CEO DIFFERENT ${evDiff.length}`);
const highSame = evSame.filter((d) => d.probability === "HIGH").length;
const highDiff = evDiff.filter((d) => d.probability === "HIGH").length;
console.log(`   🟢 SAME → HIGH ${highSame} / ${evSame.length}`);
console.log(`   🔴 DIFFERENT → HIGH(오포함) ${highDiff} / ${evDiff.length}`);
console.log(`   🔴 SAME → HIGH 아님(놓침) ${evSame.length - highSame}`);
if (excluded.length)
  console.log(`   🔴 제외된 행(핵심 3축 전건 UNKNOWN · 성공/실패로 세지 않는다): ${excluded.length}`);

/* ── ⑥ 전체 후보 비교표 파일 ───────────────────────────────────────────── */
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02", "mls2-candidate-table.jsonl");
writeFileSync(out, detail.map((d) => JSON.stringify(d)).join("\n") + "\n", "utf8");
console.log(`\n⑥ 전체 후보 비교표 → ${out}  (${detail.length}행)`);

/* ── ⑦ CPO §3 패턴 — 실제 사례와 건수 ─────────────────────────────────── */
const pat = (label, f) => {
  const hit = detail.filter(f);
  console.log(`   ${String(hit.length).padStart(3)}  ${label}`);
  return hit;
};
console.log("\n⑦ 패턴별 건수(기존 데이터 기준)");
pat("CEO SAME ↔ 시스템 PRESUMED_SAME", (d) => d.ceo === "SAME" && d.system === "PRESUMED_SAME");
pat("CEO SAME ↔ 시스템 SAME", (d) => d.ceo === "SAME" && d.system === "SAME");
pat("CEO SAME ↔ 시스템 판정 없음", (d) => d.ceo === "SAME" && !d.system);
pat("CEO DIFFERENT ↔ 시스템 PRESUMED_SAME", (d) => d.ceo === "DIFFERENT" && d.system === "PRESUMED_SAME");
pat("브랜드 확정 불일치(BRAND_MISMATCH)", (d) => d.blockers.includes("BRAND_MISMATCH"));
pat("브랜드 미확인(BRAND_UNCONFIRMED)", (d) => d.blockers.includes("BRAND_UNCONFIRMED"));
pat("상품명 겹침 0(NO_TITLE_OVERLAP)", (d) => d.blockers.includes("NO_TITLE_OVERLAP"));
pat("핵심 3축 전건 UNKNOWN(근거 부족)", (d) => d.unknown === 3);
pat("가격이 있는 행", (d) => d.price != null);
pat("가격 자격 통과 상태(VERIFIED_CURRENT)", (d) => d.priceStatus === "VERIFIED_CURRENT");
pat("CEO 판정 사유가 보존된 행", (d) => d.ceoNote && String(d.ceoNote).trim());

console.log("\n🔴 읽기만 했다 — HTTP 0 · DB 쓰기 0 · 라벨 번역 0 · 병합 0 · 코드 변경 0.");
await p.$disconnect();
