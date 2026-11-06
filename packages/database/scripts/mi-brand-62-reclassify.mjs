/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 2.5 — **BRAND 62건 재검증 · 실제 추출 누락 재산정**(read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 · 추출기 · matcher · alias · BRAND 정책 · GT · DB · 화면 **변경 0**.
 * 🔴 **재방문 0** — 기존 산출(step2/step3/step4)만 쓴다.
 *
 * 🔴🔴 **먼저 — 제 STEP 2 마무리 우려가 «근거 없었다»**:
 * ```
 * 62건은 `evidenceBrandSources.length === 0` 으로 뽑았다 ⟹ **B(이미 추출됨)는 0** 이다.
 * 그리고 beaumonde `goodsNo=1000014021` 은 이 코퍼스에 **아예 없다**(0행 ·
 * `wu-059-gt-facts.json` 쪽 데이터다) ⟹ 62건에 «섞여 들어갈» 수가 없었다.
 * 🔴 CPO 가 제 제기를 받아 STEP 2.5 를 승인했으므로 이 정정을 **먼저** 적는다.
 * ```
 * 🟢 그래도 이 재분류에는 가치가 있다 — A 를 C·D·E·F 와 갈라야 **실제 개선 분모** 가 나온다.
 *
 * 🟢🟢 **그리고 더 정확한 원인을 찾았다** — BRAND 증거 축의 출처가 **셋뿐** 이고
 *    둘이 **alias 등록부 의존** 이다(product-evidence.ts:175·177·178):
 * ```
 * lookupBrandByAliasInTitle(title)   ← ALIAS_ENTRIES 의 **alias 문자열** 만 찾는다
 * BRAND_LABEL_RE.exec(desc)          ← 「Brand: X」 **라벨** 형태만
 * lookupBrandByAliasInTitle(desc)    ← 같음
 * 등록 모양은 { brand: "Bobo Choses", alias: "보보쇼즈" } ⟹ **영문 정식명은 alias 가 아니다**
 * ⟹ 🔴 「… T-Shirt **by Bobo Choses**」 는 구조적으로 **못 읽는다**.
 *    「설명문에 브랜드가 없다」가 아니라 **「그 이름을 찾는 경로가 없다」** 다.
 * ```
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8"));
const s3 = JSON.parse(readFileSync(path.join(DIR, "step3-brand-survey.json"), "utf8"));

const nm = (s) => String(s ?? "").toLowerCase().replace(/[\s_·.\-\[\]#/'’&]/g, "");
const has = (hay, n) => !!n && nm(hay).includes(nm(n));
const pr = (o) => JSON.stringify(o, null, 1);

/** 🔴 판매처명 — 제조사 브랜드로 **취급하지 않는다**(CPO §6 · wu-080 선례). */
const SELLER_NAMES = ["비스킷", "biskuit", "보몽드", "beaumonde", "piccoli", "petite maison",
  "tinyapple", "junioredition", "junior edition", "donokids", "luxboy", "trenbe", "cemarose",
  "kidbizkid", "designerkidswear", "villagekids", "nickis", "folkberlin", "tiptoeboutique", "stockmann"];

/** 🟢 alias 등록부에 실제로 있는 **alias 문자열** — 운영 파일에서 읽는다(지어내지 않는다). */
const aliasSrc = readFileSync(
  path.join(process.cwd(), "../crawler/src/comparison-search/brand-alias.ts"),
  "utf8",
);
const ALIASES = [...aliasSrc.matchAll(/alias:\s*"([^"]+)"/g)].map((m) => m[1]);

const rowOf = (m) =>
  s2.rows.find((x) => x.candidateUrl === m.url && (m.originCode == null || x.originCode === m.originCode)) ??
  s2.rows.find((x) => x.candidateUrl === m.url);

function classify(m) {
  const r = rowOf(m);
  const evBrand = r?.evidenceBrandSources ?? [];
  const title = r?.liveTitle ?? r?.baselineTitle ?? null;
  const desc = m.descriptionRaw ?? r?.descriptionRaw ?? null;
  const origin = m.originBrand ?? r?.originBrand ?? null;
  const live = r?.liveBrand ?? m.liveBrand ?? null;

  const inTitle = has(title, origin);
  const inDesc = has(desc, origin);
  const sellerHits = SELLER_NAMES.filter((s) => has(title, s) || has(desc, s));
  /** 🔴 그 브랜드가 **alias 등록부에 있는가** — 없으면 증거 경로가 구조적으로 없다. */
  const aliasRegistered = ALIASES.some((a) => has(origin, a) || has(a, origin));
  /** 🟢 설명문에 「Brand: X」 라벨이 있는가 — 두 번째 경로. */
  const labelInDesc = /brand\s*[:：]/i.test(String(desc ?? ""));

  let type, why;
  if (evBrand.length > 0) { type = "B_ALREADY_EXTRACTED"; why = `기존 evidence 가 있다(${evBrand.join("+")})`; }
  else if (!origin) { type = "E_ORIGINAL_BRAND_UNAVAILABLE"; why = "원상품 브랜드가 없어 비교 불가"; }
  else if (!title && !desc) { type = "F_INSUFFICIENT_EVIDENCE"; why = "제목·설명문 원문이 둘 다 없다"; }
  else if (inTitle || inDesc) {
    type = "A_TRUE_EXTRACTION_MISS";
    why = `원문(${inTitle ? "제목" : ""}${inTitle && inDesc ? "+" : ""}${inDesc ? "설명문" : ""})에 원상품 브랜드가 있는데 evidence 0` +
      ` · 원인: ${aliasRegistered ? "alias 등록됨(다른 이유)" : "**alias 미등록**"}${labelInDesc ? "" : " · 설명문 라벨 없음"}`;
  } else if (live && !has(live, origin) && !has(origin, live)) {
    type = "D_CONFIRMED_BRAND_MISMATCH"; why = `다른 브랜드가 명시됨(${live})`;
  } else if (sellerHits.length > 0) {
    type = "C_SELLER_NAME_ONLY"; why = `판매처명만 있다(${sellerHits.join("|")})`;
  } else { type = "F_INSUFFICIENT_EVIDENCE"; why = "원문에서 브랜드 표기를 확정할 수 없다"; }

  const i = inDesc ? nm(desc).indexOf(nm(origin)) : inTitle ? nm(title).indexOf(nm(origin)) : -1;
  const hay = inDesc ? desc : title;
  return {
    type, why,
    domain: r?.candidateDomain ?? m.domain, url: m.url, originCode: r?.originCode ?? null,
    originBrand: origin, liveBrand: live,
    evidenceBrandSources: evBrand,
    inTitle, inDesc, aliasRegistered, labelInDesc,
    sellerNamesSeen: sellerHits,
    baseline: r?.baselineSystemVerdict ?? m.baseline, ceoGt: r?.ceoGt ?? m.ceoGt ?? null,
    sourceLocation: inDesc ? "DESCRIPTION" : inTitle ? "TITLE" : null,
    rawExcerpt: i >= 0 ? String(hay).slice(Math.max(0, i - 50), i + 70) : null,
  };
}

const out = s3.missedExtraction.map(classify);
const buckets = out.reduce((a, x) => ((a[x.type] = (a[x.type] ?? 0) + 1), a), {});
const A = out.filter((x) => x.type === "A_TRUE_EXTRACTION_MISS");

console.log("═".repeat(80));
console.log("  STEP 2.5 — BRAND 62건 재분류(재방문 0 · 운영 변경 0)");
console.log("═".repeat(80));
console.log(`\nalias 등록부에서 읽은 alias ${ALIASES.length}개: ${ALIASES.join(" · ")}`);

console.log("\n§5 기존 62건 → 재검증 유형");
console.log(pr(buckets));
console.log(`\n🔴 **실제 추출 누락(A) = ${A.length}** / 기존 집계 62`);

console.log("\n§A 의 «원인» 분해 — 왜 못 읽었는가");
console.log(pr(A.reduce((a, x) => {
  const k = `${x.aliasRegistered ? "alias 등록됨" : "alias 미등록"} · ${x.labelInDesc ? "설명문 라벨 있음" : "설명문 라벨 없음"}`;
  a[k] = (a[k] ?? 0) + 1; return a;
}, {})));
console.log("출처 위치:", pr(A.reduce((a, x) => ((a[x.sourceLocation] = (a[x.sourceLocation] ?? 0) + 1), a), {})));
console.log("원상품 브랜드 분포:", pr(A.reduce((a, x) => ((a[x.originBrand] = (a[x.originBrand] ?? 0) + 1), a), {})));
console.log("GT 보유:", A.filter((x) => x.ceoGt).length, "/", A.length);

console.log("\n표본 4건");
for (const x of A.slice(0, 4)) console.log(`   ${String(x.domain).padEnd(22)} ${x.sourceLocation} · ${x.why}\n      …${x.rawExcerpt}…`);

writeFileSync(path.join(DIR, "step25-brand-reclassify.json"), JSON.stringify({ aliases: ALIASES, buckets, trueMissCount: A.length, rows: out }, null, 1), "utf8");
const cols = ["type", "domain", "originCode", "originBrand", "liveBrand", "sourceLocation", "inTitle", "inDesc", "aliasRegistered", "labelInDesc", "baseline", "ceoGt", "url", "why"];
writeFileSync(
  path.join(DIR, "step25-brand-reclassify.csv"),
  [cols.join(","), ...out.map((r) => cols.map((c) => `"${String(Array.isArray(r[c]) ? r[c].join("|") : (r[c] ?? "")).replace(/"/g, '""')}"`).join(","))].join("\n"),
  "utf8",
);
console.log(`\n🟢 산출: step25-brand-reclassify.json · .csv`);
