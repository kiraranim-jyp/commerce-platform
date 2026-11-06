/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-BRAND-EVIDENCE — **BRAND 증거 부재 146/152 의 원인 규명**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 후속 지시 §1~§4. **운영 코드 0 · matcher 0 · GT 0 · migration 0 · 재방문 0.**
 * 🟢 입력은 STEP 2 가 **이미 보존한** `step2-evidence.json` 하나다(`descriptionRaw` 포함).
 *
 * 🔴🔴 이 파일이 가르는 핵심 한 가지:
 * ```
 * 「설명문에 브랜드가 **있는데 못 뽑았다**」(= 추출 누락 · 개선 가능)
 *      ↕  섞으면 「브랜드가 없다」는 거짓이 된다
 * 「설명문에 브랜드가 **실제로 없다**」(= 부재 · 개선 불가)
 * ```
 * 🔴 판매자명·도메인명을 브랜드로 **간주하지 않는다**(CPO §3 · wu-080 금지축).
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const d = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const rows = d.rows;
const ok = rows.filter((r) => r.visitStatus === "OK");

const nm = (s) => String(s ?? "").toLowerCase().replace(/[\s_·.\-\[\]#/'’]/g, "");
const has = (hay, needle) => !!needle && nm(hay).includes(nm(needle));
const pr = (o) => JSON.stringify(o, null, 1);

/* ═══════════ §1-A. MODEL_CODE 75건의 «나머지 12건» ═══════════════════════ */
const withCode = ok.filter((r) => r.liveModelCode);
const classifyCode = (r) => {
  const up = String(r.liveModelCode).toUpperCase();
  if (r.originCodes.length === 0) return "원본 품번 부재(비교 불가)";
  if (r.originCodes.some((c) => c === up)) return "일치";
  return "불일치(충돌 근거)";
};
const codeBuckets = withCode.reduce((a, r) => ((a[classifyCode(r)] = (a[classifyCode(r)] ?? 0) + 1), a), {});

/* ═══════════ §1-B. 95 URL ↔ 152 행 관계 ═════════════════════════════════ */
const byUrl = new Map();
for (const r of rows) byUrl.set(r.candidateUrl, (byUrl.get(r.candidateUrl) ?? 0) + 1);
const urlRelation = {
  전체_행: rows.length,
  고유_URL: byUrl.size,
  접근OK_행: ok.length,
  접근OK_고유URL: new Set(ok.map((r) => r.candidateUrl)).size,
  "URL당_행_분포(원상품이 둘 이상이면 같은 URL 이 여러 행)": [...byUrl.values()].reduce(
    (a, n) => ((a[n] = (a[n] ?? 0) + 1), a),
    {},
  ),
  설명: "행 = (원상품 × 후보URL) 조합 · URL = 방문 단위(중복 제거). 152 는 «방문 성공한 URL 을 가진 행» 수다.",
};

/* ═══════════ §1-C/D. BRAND 증거 6건 ↔ 없는 146건을 가른다 ═══════════════ */
const hasBrandEv = (r) => (r.evidenceBrandSources ?? []).length > 0;
const brandYes = ok.filter(hasBrandEv);
const brandNo = ok.filter((r) => !hasBrandEv(r));

/** 🔴 유형 분리(CPO §3) — 판매자명/도메인은 브랜드로 세지 않는다. */
function brandCase(r) {
  const o = r.originBrand;
  const desc = r.descriptionRaw;
  const title = r.liveTitle ?? r.baselineTitle;
  if (!desc && !title) return "원문 미확보(설명문·제목 둘 다 없음)";
  if (!o) return "원상품 브랜드 부재(대조 불가)";
  const inDesc = has(desc, o);
  const inTitle = has(title, o);
  if (inDesc && inTitle) return "🟢 제목·설명문 둘 다에 원상품 브랜드 명시";
  if (inDesc) return "🟢 설명문에만 원상품 브랜드 명시";
  if (inTitle) return "🟢 제목에만 원상품 브랜드 명시";
  /** 🔴 다른 브랜드가 명시된 경우 — 운영 `liveBrand` 가 원상품과 다르다. */
  if (r.liveBrand && !has(r.liveBrand, o) && !has(o, r.liveBrand)) return "🔴 다른 브랜드가 명시됨";
  return "브랜드 표기를 찾지 못함(실제 부재 가능)";
}
const brandNoCases = brandNo.reduce((a, r) => ((a[brandCase(r)] = (a[brandCase(r)] ?? 0) + 1), a), {});

/** 🔴🔴 **추출 누락** — 증거는 없는데 원문에는 브랜드가 있다. 개선 가능 분모다. */
const missed = brandNo.filter((r) => {
  const o = r.originBrand;
  return o && (has(r.descriptionRaw, o) || has(r.liveTitle ?? r.baselineTitle, o));
});

/* ═══════════ §4. GT 대조 — 브랜드 증거를 더하면 어떻게 되는가 ════════════ */
const gtRows = ok.filter((r) => r.ceoGt);
const gtImpact = gtRows.reduce((a, r) => {
  const k = `${r.ceoGt} / ${missed.includes(r) ? "브랜드 회수 가능" : hasBrandEv(r) ? "이미 증거 있음" : "회수 불가"}`;
  a[k] = (a[k] ?? 0) + 1;
  return a;
}, {});

/* ═══════════ 출력 ═══════════════════════════════════════════════════════ */
console.log("═".repeat(78));
console.log("  MI-BRAND-EVIDENCE — BRAND 증거 부재 원인 규명(read-only · 재방문 0)");
console.log("═".repeat(78));

console.log("\n§1-A. MODEL_CODE 추출 75건의 내부 분류 (CPO 가 물은 «나머지 12건»)");
console.log(pr(codeBuckets));

console.log("\n§1-B. 95 URL ↔ 152 행 관계");
console.log(pr(urlRelation));

console.log(`\n§1-C. BRAND 증거가 «있는» 행 ${brandYes.length}건 — 원문·출처`);
for (const r of brandYes) {
  console.log(`   ${r.candidateDomain} · 출처 ${(r.evidenceBrandSources ?? []).join("+")}`);
  console.log(`      원상품 브랜드 「${r.originBrand ?? "-"}」 · 운영 추출 brand 「${r.liveBrand ?? "-"}」`);
  console.log(`      설명문 ${r.descriptionRaw ? `${r.descriptionRaw.length}자` : "없음"} · ${r.candidateUrl}`);
}

console.log(`\n§1-D. BRAND 증거가 «없는» 행 ${brandNo.length}건 — 유형 분리`);
console.log(pr(brandNoCases));
console.log(`   설명문 확보 ${brandNo.filter((r) => r.descriptionRaw).length} / ${brandNo.length}`);

console.log(`\n🔴🔴 §3. **추출 누락**(원문엔 브랜드가 있는데 증거 0) = ${missed.length}건`);
for (const r of missed.slice(0, 12)) {
  const o = r.originBrand;
  const where = has(r.descriptionRaw, o) ? "설명문" : "제목";
  const hay = where === "설명문" ? r.descriptionRaw : (r.liveTitle ?? r.baselineTitle);
  const i = nm(hay).indexOf(nm(o));
  console.log(`   ${String(r.candidateDomain).padEnd(24)} ${where} · 원상품 「${o}」 · CEO ${r.ceoGt ?? "-"}`);
  console.log(`      …${String(hay).slice(Math.max(0, i - 60), i + 60)}…`);
}
if (missed.length > 12) console.log(`   … 외 ${missed.length - 12}건(JSON 참조)`);

console.log("\n§4. CEO GT 보유 행 × 브랜드 회수 가능성");
console.log(pr(gtImpact));

const out = {
  codeBuckets,
  urlRelation,
  brandYes: brandYes.map((r) => ({ domain: r.candidateDomain, url: r.candidateUrl, sources: r.evidenceBrandSources, originBrand: r.originBrand, liveBrand: r.liveBrand })),
  brandNoCases,
  missedExtraction: missed.map((r) => ({
    domain: r.candidateDomain, url: r.candidateUrl, originBrand: r.originBrand,
    liveBrand: r.liveBrand, ceoGt: r.ceoGt, baseline: r.baselineSystemVerdict,
    inDescription: has(r.descriptionRaw, r.originBrand), inTitle: has(r.liveTitle ?? r.baselineTitle, r.originBrand),
    descriptionRaw: r.descriptionRaw,
  })),
  gtImpact,
};
writeFileSync(path.join(DIR, "step3-brand-survey.json"), JSON.stringify(out, null, 1), "utf8");
console.log(`\n🟢 산출: ${path.join(DIR, "step3-brand-survey.json")}`);
