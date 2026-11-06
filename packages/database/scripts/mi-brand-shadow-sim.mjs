/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-BRAND SHADOW IMPACT SIMULATION — **62건 영향 측정만**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 브랜드 추출기 · matcher · Identity · GT · DB **변경 0** · 재방문 **0**.
 * 🟢 입력은 STEP 3 산출(`step3-brand-survey.json`) — `descriptionRaw` 가 보존돼 있다.
 *
 * 🔴🔴 CPO 가 가르라고 한 **세 문제를 섞지 않는다**:
 * ```
 * ① 추출   설명문에 브랜드가 있는데 증거로 안 나온다        ← STEP 3 가 62건으로 확정
 * ② 비교   새로 읽은 브랜드가 원상품 브랜드와 같은가         ← 이 파일이 잰다
 * ③ 정책   그 증거가 기존 판정을 어떻게 바꾸는가             ← 시나리오 A/B 로 **분리**
 * ```
 * 🔴 판매처명 · 도메인명 · 판매자 자체 표기를 제조사 브랜드로 **오인하지 않는다**.
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s3 = JSON.parse(readFileSync(path.join(DIR, "step3-brand-survey.json"), "utf8"));
const step2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const missed = s3.missedExtraction;

const nm = (s) => String(s ?? "").toLowerCase().replace(/[\s_·.\-\[\]#/'’&]/g, "");
const has = (hay, n) => !!n && nm(hay).includes(nm(n));
const pr = (o) => JSON.stringify(o, null, 1);

/* ── 코퍼스에서 관측된 브랜드 어휘 ─────────────────────────────────────────
 * 🔴 사전을 «지어내지 않았다» — 이 코퍼스의 `originBrand`·`liveBrand` 실측값만 모았다.
 * 🔴 판매처명으로 확인된 것은 **브랜드 집합에서 뺀다**(biskuit 「비스킷」 선례). */
const SELLER_NAME_TOKENS = ["비스킷", "biskuit", "piccoli", "petite maison", "tinyapple", "junioredition", "donokids", "luxboy", "trenbe"];
const BRANDS = [
  ...new Set(
    step2.rows
      .flatMap((r) => [r.originBrand, r.liveBrand])
      .filter(Boolean)
      .map((b) => String(b).trim()),
  ),
].filter((b) => !SELLER_NAME_TOKENS.some((t) => nm(b) === nm(t)));

/* ── ② 비교 — 가상 BRAND evidence 를 만들고 원상품과의 관계를 정한다 ───── */
function simulate(m) {
  const desc = m.descriptionRaw ?? "";
  const origin = m.originBrand;
  /** 🟢 원문에서 실제로 보이는 브랜드 후보 전수(원상품 것 포함). */
  const seen = BRANDS.filter((b) => has(desc, b));
  const others = seen.filter((b) => !has(b, origin) && !has(origin, b));
  /** 🔴 판매처명이 설명문에 있는가 — 오인 위험 관측. */
  const sellerNameInDesc = SELLER_NAME_TOKENS.filter((t) => has(desc, t));

  let relation;
  if (!origin) relation = "UNKNOWN";
  else if (!has(desc, origin)) relation = "UNKNOWN";
  else if (others.length > 0) relation = "AMBIGUOUS";
  else relation = "CONFIRMED_MATCH";

  const i = nm(desc).indexOf(nm(origin ?? ""));
  return {
    originCode: m.url && null,
    url: m.url,
    domain: m.domain,
    originBrand: origin,
    liveBrand: m.liveBrand,
    baseline: m.baseline,
    ceoGt: m.ceoGt,
    /** 가상 증거 */
    evidence: {
      rawText: i >= 0 ? desc.slice(Math.max(0, i - 40), i + 60) : null,
      normalizedValue: origin,
      sourceType: "DESCRIPTION",
      sourceLocation: "descriptionRaw",
      relationToOrigin: relation,
      confidence: relation === "CONFIRMED_MATCH" ? "HIGH" : relation === "AMBIGUOUS" ? "LOW" : "NONE",
    },
    otherBrandsInDescription: others,
    sellerNameInDescription: sellerNameInDesc,
  };
}
const sim = missed.map(simulate);

/* ── ③ 정책 — 시나리오를 «섞지 않는다» ────────────────────────────────── */
/** A: 증거만 추가하고 정책 불변 ⟹ 판정 변화는 **구조적으로 0** 이다. */
const scenarioA = { verdictChanges: 0, note: "증거만 수집 · 기존 브랜드 판정 규칙이 그 증거를 읽지 않는다 ⟹ 변화 0(구조적)" };

/** B: 기존 브랜드 판정 규칙이 신규 DESCRIPTION 증거까지 읽는다고 «가정» 한다. */
function scenarioBOutcome(x) {
  if (x.evidence.relationToOrigin === "CONFIRMED_MATCH") return "BRAND MATCHED(UNCONFIRMED 해소)";
  if (x.evidence.relationToOrigin === "AMBIGUOUS") return "🔴 AMBIGUOUS — 다른 브랜드 동시 등장(MISMATCH 위험)";
  return "변화 없음(UNKNOWN 유지)";
}
const bBuckets = sim.reduce((a, x) => ((a[scenarioBOutcome(x)] = (a[scenarioBOutcome(x)] ?? 0) + 1), a), {});

/* ── ④ 🔴 기존 SAME 이 차단되는가 ─────────────────────────────────────── */
const existingSame = sim.filter((x) => x.baseline === "SAME");
const sameBlocked = existingSame.filter((x) => x.evidence.relationToOrigin !== "CONFIRMED_MATCH");

/* ── GT 영향(분모 = GT 보유 행만) ─────────────────────────────────────── */
const gt = sim.filter((x) => x.ceoGt);
const gtTable = gt.reduce((a, x) => {
  const k = `${x.ceoGt} → ${scenarioBOutcome(x)}`;
  a[k] = (a[k] ?? 0) + 1;
  return a;
}, {});

/* ═══════════════════════ 출력 ═══════════════════════════════════════════ */
console.log("═".repeat(80));
console.log("  MI-BRAND SHADOW IMPACT SIMULATION — 62건 (운영 변경 0)");
console.log("═".repeat(80));
console.log(`\n대상 ${sim.length}건 · 브랜드 어휘(실측 관측값) ${BRANDS.length}개 · 판매처명 토큰 제외 ${SELLER_NAME_TOKENS.length}`);

console.log("\n§2. 가상 BRAND evidence 의 «원상품과의 관계»");
console.log(pr(sim.reduce((a, x) => ((a[x.evidence.relationToOrigin] = (a[x.evidence.relationToOrigin] ?? 0) + 1), a), {})));

console.log("\n§5-A. 시나리오 A — 증거만 추가(정책 불변)");
console.log(pr(scenarioA));

console.log("\n§5-B. 시나리오 B — 기존 브랜드 판정이 신규 증거를 읽는다고 가정");
console.log(pr(bBuckets));

console.log("\n🔴🔴 §4/§6-C. **기존 SAME 보호 여부**");
console.log(`   62건 중 기존 system verdict = SAME : ${existingSame.length}`);
console.log(`   🔴 그중 CONFIRMED_MATCH 가 아닌 것(차단 위험): ${sameBlocked.length}`);
for (const x of sameBlocked) console.log(`      ${x.domain} · ${x.evidence.relationToOrigin} · others=${x.otherBrandsInDescription.join("|")}\n         ${x.url}`);
if (sameBlocked.length === 0) console.log("   🟢 **기존 SAME 이 차단되는 사례 0건** — 62건의 SAME 은 전부 원상품 브랜드와 CONFIRMED_MATCH 다.");

console.log("\n§6-B. CEO GT 영향(분모 = GT 보유 행만)");
console.log(`   GT 보유 ${gt.length} / ${sim.length}  🔴 나머지 ${sim.length - gt.length}건은 **효과 측정불가**`);
console.log(pr(gtTable));

console.log("\n§7-10. 🔴 판매처명·다른 브랜드 오인 위험");
const amb = sim.filter((x) => x.otherBrandsInDescription.length > 0);
const sellerRisk = sim.filter((x) => x.sellerNameInDescription.length > 0);
console.log(`   다른 브랜드가 설명문에 동시 등장: ${amb.length}`);
for (const x of amb.slice(0, 8)) console.log(`      ${x.domain} · 원상품 「${x.originBrand}」 ↔ 동시 등장 ${x.otherBrandsInDescription.join(" | ")}`);
console.log(`   판매처명 토큰이 설명문에 등장: ${sellerRisk.length}`);

const out = { brandsObserved: BRANDS, scenarioA, scenarioBBuckets: bBuckets, existingSame: existingSame.length, sameBlocked, gtTable, gtRows: gt, ambiguous: amb, rows: sim };
writeFileSync(path.join(DIR, "step4-brand-shadow.json"), JSON.stringify(out, null, 1), "utf8");
console.log(`\n🟢 산출: ${path.join(DIR, "step4-brand-shadow.json")}`);
