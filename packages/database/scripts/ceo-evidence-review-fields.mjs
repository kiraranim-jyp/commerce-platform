/**
 * 🔵 CEO EVIDENCE REVIEW ③ — **수집 필드 전수 목록 · 반영 여부 · URL 매핑**(CPO §8-1·8-2·8-5)
 * 🔴 읽기 전용 · 네트워크 0 · DB 접근 0(덤프 fixture 를 읽는다) · 운영 변경 0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "..", "..");
const FIX = path.join(ROOT, "apps", "admin", "src", "app", "api", "price-history", "_lib", "__tests__", "fixtures");
const J = (f) => JSON.parse(readFileSync(path.join(FIX, f), "utf8"));
const A = J("wu-059-gt-facts.json");
const B = J("wu-068-new-gt.json");
const D = J("ceo-evidence-review-db.json");

const TARGET_IDS = ["C27", "C05", "C06", "C19", "C20", "C50", "S1-5", "S1-6", "C22", "C42", "C25"];
const pairs = [
  ...Object.entries(A.candidates).map(([id, c]) => ({ id, ...c, human: c.humanGt, src: "wu-059" })),
  ...Object.values(B).map((r) => ({ ...r, human: r.gt, src: "wu-068" })),
].filter((p) => TARGET_IDS.includes(p.id));

const V = (x) => (x && typeof x === "object" && !Array.isArray(x) && "value" in x ? x.value : x);
const E = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)
  || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
const T = "`";   /** 🔴 백틱을 리터럴로 쓰면 쉘/템플릿에서 깨진다 — 상수로 둔다. */
const c = (s) => `${T}${s}${T}`;

/** 비교표 25행 + 가격 10행에 **세운** canonicalProduct 칸. 나머지는 ⑥ 전수 덤프에 들어간다. */
const SHOWN_CP = new Set(["brand", "modelName", "sku", "title", "titleKo", "manufacturer", "importer",
  "shopifyProductType", "color", "material", "recommendedAge", "options", "optionGroups", "stockQuantity",
  "countryOfOrigin", "careInstructions", "certification", "images", "sourceUrl", "description",
  "descriptionKo", "seoDescription", "price", "regularPrice", "shippingFee", "priceBreakdown",
  "priceValidity", "priceOverrideKrw"]);

const cpKeys = new Set();
for (const o of Object.values(A.origins)) for (const k of Object.keys(o.canonicalProduct)) cpKeys.add(k);
const originN = Object.keys(A.origins).length;
const fill = (k) => Object.values(A.origins).filter((o) => !E(V(o.canonicalProduct[k]))).length;

const FACT_KEYS = ["sourceUrl", "urlSlug", "brand", "brandModelCode", "sellerSku", "title", "coreTitleTokens",
  "categoryText", "colorText", "materialText", "fitText", "ageRangeText", "sizeLabels", "audienceSignals",
  "imageUrls", "description", "evidence"];
const FACT_NOTE = {
  description: `🔴 **0/11** — MI 가 상세설명을 보지 못했다는 직접 증거`,
  evidence: `🔴 **0/11** — 축별 구조화 증거가 저장되지 않았다`,
  sellerSku: `🔴 0/11 · matcher 가 읽지 않는다(보존용)`,
  ageRangeText: `🔴 0/11`,
};

const MISSING_SLOTS = [
  ["상세설명 HTML · 구조화 콘텐츠", "🔴 저장 칸 없음", `${c("ProductFacts")} 에 html 칸이 없고 ${c("canonicalProduct.description")} 은 평문이다`],
  ["상세설명 이미지 · 순서", "🟡 원본만 부분", `${c("canonicalProduct.images[].useInDescription")} 로 **원본은 구분 가능** · 🔴 후보측은 칸 없음`],
  ["상세설명 수집 시점 · 수집 상태", "🔴 저장 칸 없음", `후보 수집 시점은 ${c("candidate_reviews.first_seen_at/last_seen_at")} 뿐이고 **설명문 단위 기록이 없다**`],
  ["상세설명에서 추출된 브랜드·코드·소재·색상", "🔴 저장분 0", `후보 ${c("facts.evidence")} **0/11**`],
  ["패턴 · 프린트", "🔴 저장 칸 없음", `${c("ProductFacts")}·${c("canonicalProduct")} 양쪽에 그 칸이 없다`],
  ["실루엣", "🔴 저장 칸 없음", `${c("fitText")} 가 가장 가깝고 그것은 «핏» 이다`],
  ["상품 ID · 플랫폼 식별자", "🟡 부분", `후보는 ${c("urlSlug")}·${c("sellerSku")}(0/11) · 원본은 ${c("sku")}`],
  ["성별", "🔴 저장 칸 없음", `${c("audienceSignals")} 원문 조각으로만 간접 관측된다`],
  ["세일가 / 정상가 분리", "🟡 원본만", `${c("canonicalProduct.regularPrice")} 존재 · 🔴 후보측 칸 없음`],
  ["가격 출처 URL", "🟡 대체", `후보는 ${c("candidate_url")} 과 같다 ⟹ 별도 칸이 없다`],
  ["파싱 상태 · 오류 정보", "🔴 저장 칸 없음", `후보 ${c("price_status")} 외에 파싱 오류 기록이 없다`],
  ["상품 상태(신품/중고 등)", "🔴 저장 칸 없음", "양쪽 모두 그 칸이 없다"],
  ["디자이너 정보", "🔴 저장 칸 없음", `${c("manufacturer")}·${c("importer")} 는 제조·수입이고 디자이너가 아니다`],
];

let m = "# CEO Evidence Review — 수집 필드 전수 목록 및 반영 여부\n\n";
m += "> 🔴 **운영 변경 0 · DB 쓰기 0 · 추가 크롤링 0 · 추가 번역 0.** 이 문서는 조사 산출이다.\n";
m += `> 화면 → ${c("docs/ceo-evidence-review.html")} · 생성기 → ${c("ceo-evidence-review-build.test.ts")}(네트워크 0).\n\n`;
m += "## 0. 🔴 먼저 — **조사 대상은 11쌍이다**\n\n";
m += "지시서 §8-5 의 「6개 비교 쌍」을 **정정한다**. 기존 화면의 카드 수가 **11**(실측 · `<section class=\"card\">` 개수)이고,\n";
m += "이번 화면도 **같은 11쌍**이다(분모를 바꾸면 기존 조서와 대조할 수 없다).\n\n";

m += `## 1. 원본 상품 — ${c("product_snapshots.workspace.canonicalProduct")} · 전수 **${cpKeys.size}칸** (분모 ${originN} origin)\n\n`;
m += "| 칸 | 값 보유 | 화면 반영 | 비고 |\n|---|--:|:-:|---|\n";
for (const k of [...cpKeys].sort()) {
  const shown = SHOWN_CP.has(k);
  m += `| ${c(k)} | ${fill(k)}/${originN} | ${shown ? "🟢 비교표·가격" : "🟡 덤프만"} | `
    + `${shown ? "② 증거 비교 또는 ⑤ 가격 영역에 세웠다" : "⑥ 수집 전수 덤프에 **값·출처 그대로** 있다"} |\n`;
}
m += "\n🔴 **미반영 칸은 0** 이다 — 비교표에 세우지 않은 칸도 **⑥ 수집 전수 덤프**에 값과 `source` 가 같이 들어 있다.\n";
m += `🔴 칸 모양이 섞여 있다 — ${c("{value,source,confidence}")} 래퍼 **28칸** · 평평한 값 **14칸**`;
m += `(${c("images")} ${c("variants")} ${c("sourceUrl")} ${c("shopifyTags")} ${c("optionGroups")} …). 래퍼를 **조건부로** 벗긴다.\n`;

m += `\n## 2. 후보 상품 — ${c("ProductFacts")} · 전수 **17칸** (분모 ${pairs.length})\n\n`;
m += "| 칸 | 값 보유 | 화면 반영 | 비고 |\n|---|--:|:-:|---|\n";
for (const k of FACT_KEYS) {
  const n = pairs.filter((p) => !E(p.facts[k])).length;
  m += `| ${c(k)} | ${n}/${pairs.length} | 🟢 반영 | ${FACT_NOTE[k] ?? "② 비교표 + ⑥ 덤프"} |\n`;
}

m += `\n## 3. 후보 — ${c("candidate_reviews")} · **${Object.keys(D.rows[0] ?? {}).length}칸** (🔴 행 보유 **2/11**)\n\n`;
m += `덤프 행 **${D.rows.length}** → 정규화 URL 기준 고유 **2**. 🔴 ${c("global.trenbe.com")} 이 **2행** 이고 `;
m += "**하나만** verdict 를 갖는다 ⟹ 값이 있는 쪽을 **결정적으로** 고른다(1차 구현은 마지막 행이 **우연히** 이겼다).\n\n";
m += `| 칸 | 값 보유(분모 ${D.rows.length}행) | 화면 반영 |\n|---|--:|:-:|\n`;
for (const k of Object.keys(D.rows[0] ?? {})) {
  const n = D.rows.filter((r) => !E(r[k])).length;
  m += `| ${c(k)} | ${n}/${D.rows.length} | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |\n`;
}

m += "\n## 4. 11쌍 — 원본 ↔ 후보 URL 매핑 (§8-5)\n\n";
m += "| # | id | 원본 searchId | 원본 URL | 후보 판매처 | 후보 URL | 이전 CEO 판정 | fixture |\n|--:|---|---|---|---|---|---|---|\n";
pairs.forEach((p, i) => {
  const o = A.origins[p.searchId]?.canonicalProduct ?? {};
  m += `| ${i + 1} | ${p.id} | ${c(p.searchId)} | ${String(V(o.sourceUrl) ?? "(미수집)")} | ${p.domain} | ${p.url} | ${p.human} | ${c(p.src)} |\n`;
});
m += `\n🔴 원본 ${c("searchId")} 는 **6개**(S1~S6)이고 후보가 11이다 — 같은 원본에 후보가 여럿 붙는다.\n`;

m += "\n## 5. 🔴 지시서 §3 항목 중 **저장 칸 자체가 없는** 것\n\n";
m += "| 지시서 항목 | 상태 | 근거 |\n|---|---|---|\n";
for (const [a, b, why] of MISSING_SLOTS) m += `| ${a} | ${b} | ${why} |\n`;
m += "\n🔴 위 항목을 **임의로 만들거나 추정하지 않았다** — 화면에 `미수집` 또는\n";
m += "「저장 칸이 없습니다(확인 불가)」로 적었다(CPO §2 · §4).\n";

writeFileSync(path.join(ROOT, "docs", "CEO-EVIDENCE-REVIEW-FIELDS.md"), m, "utf8");
console.log(`🟢 docs/CEO-EVIDENCE-REVIEW-FIELDS.md`);
console.log(`   canonicalProduct ${cpKeys.size}칸 · ProductFacts 17칸 · candidate_reviews ${Object.keys(D.rows[0] ?? {}).length}칸 · 쌍 ${pairs.length}`);
console.log(`   비교표에 세운 원본 칸 ${[...cpKeys].filter((k) => SHOWN_CP.has(k)).length}/${cpKeys.size} · 나머지는 전수 덤프`);
