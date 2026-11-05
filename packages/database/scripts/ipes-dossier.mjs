/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IPES PHASE A~B — **CPO 직접 검토용 Evidence 패키지**(read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 는 판정하지 않는다.** 점수·가중치·임계값·동일상품 판정 **전부 0**.
 *    라벨 **번역 0**(SAME/동일/USEFUL … 원문 그대로) · 병합 0 · 중복 제거 0 ·
 *    추론으로 채우기 0 · 새 검색 0 · 새 추출 0 · DB 쓰기 0.
 *
 * 🟢 「일치 여부」 칸은 **기계적 문자열 비교** 결과만 적는다 —
 *    `EQUAL` / `DIFFERS` / `ORIGIN_MISSING` / `CANDIDATE_MISSING` / `BOTH_MISSING`.
 *    🔴 그것은 **동일상품 판정이 아니다**(CPO 가 기준을 정할 재료다).
 *
 * 산출(TEMP/mi-p0-02/):
 *   ipes-rows.jsonl       원본 행 전수(source_id · source_row_id · 원문 라벨)
 *   ipes-evidence.jsonl   (원상품 × 후보) 쌍별 Evidence 나란히 + 출처 + 확인상태
 *   ipes-lineage.jsonl    같은 후보 URL 이 여러 자료에 있는가(**표시만**)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const FIX = path.resolve("apps/admin/src/app/api/price-history/_lib/__tests__/fixtures");
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });

/** 🔴 자료 성격을 **네 가지로 갈라** 둔다(CPO A-2). 추측하지 않고 파일별로 고정한다. */
const SOURCE_TYPE = {
  "core-same03-human-gt.json": "CEO_GT",
  "core-2m-ceo-visual-gt.json": "CEO_GT",
  "core-2aj-human-gt.json": "CEO_GT",
  "core-2al-human-gt.json": "CEO_GT",
  "core-desc-review-ceo-gt.json": "CEO_GT",
  "wu-093-human-gt.json": "CEO_GT",
  "wu-111-human-gt.json": "CEO_GT",
  "wu-112-human-gt.json": "CEO_GT",
  "wu-116-human-gt.json": "CEO_GT",
  "wu-125-human-gt.json": "CEO_GT",
  "wu-099-human-value.json": "VALUE_LABEL",
  "wu-100-human-value.json": "VALUE_LABEL",
  "sprint5-brand-gt.json": "DB_EXPORT",
  "cand-02-rows.json": "SYSTEM_DUMP",
  "dmc-01-trace.json": "SYSTEM_DUMP",
  "dsp-01-funnel.json": "SYSTEM_DUMP",
  "query-adopt-01-production.json": "SYSTEM_DUMP",
  "query-arch-01-production.json": "SYSTEM_DUMP",
};

const LABEL_KEYS = [
  "ceoUiLabel",
  "calibrationLabel",
  "humanVerdict",
  "human",
  "ceo",
  "ceoVerdict",
  "verdict",
  "label",
  "value",
];
const BASIS_KEYS = ["ceoBasis", "why", "note", "reason", "basis", "memo", "humanNote"];
const URL_KEYS = ["url", "candidateUrl", "candidate_url", "link"];

/** 🔴 깊이 우선으로 **라벨이 붙은 노드** 를 모은다 — 키 이름을 지어내지 않는다. */
function walk(node, key, out, depth = 0) {
  if (depth > 9 || node == null) return;
  if (Array.isArray(node)) {
    node.forEach((x, i) => walk(x, `${key}[${i}]`, out, depth + 1));
    return;
  }
  if (typeof node !== "object") return;
  const keys = Object.keys(node);
  const labels = {};
  for (const lk of LABEL_KEYS) if (typeof node[lk] === "string") labels[lk] = node[lk];
  if (Object.keys(labels).length > 0) {
    const basis = {};
    for (const bk of BASIS_KEYS) if (node[bk] != null && String(node[bk]).trim() !== "") basis[bk] = node[bk];
    const urlKey = URL_KEYS.find((k) => typeof node[k] === "string");
    out.push({
      source_row_id: key,
      /** 🔴 라벨은 **원문 그대로** — 번역/정렬 0. */
      labels,
      basis,
      candidate_url: urlKey ? node[urlKey] : /^https?:\/\//.test(key) ? key : null,
      domain: node.domain ?? node.candidateDomain ?? node.host ?? null,
      origin_code: node.originCode ?? node.origin ?? null,
      market: node.market ?? null,
      system_verdict: node.system ?? node.systemVerdict ?? null,
      match_truth: node.matchTruth ?? null,
      price_tier: node.priceTier ?? null,
      in_domestic_reference: node.inDomesticReference ?? null,
      blockers: node.blockers ?? null,
      conflicts: node.conflicts ?? null,
      /** 🟢 그 노드가 들고 있던 **모든 칸 이름** — 무엇이 보존됐는지 CPO 가 직접 본다. */
      present_keys: keys,
      raw: node,
    });
  }
  for (const k of keys) walk(node[k], `${key}.${k}`, out, depth + 1);
}

const rows = [];
for (const f of existsSync(FIX) ? readdirSync(FIX).filter((x) => x.endsWith(".json")) : []) {
  const type = SOURCE_TYPE[f];
  if (!type) continue; /** 🔴 분류하지 않은 파일은 **넣지 않는다**(추측 금지). */
  let json;
  try {
    json = JSON.parse(readFileSync(path.join(FIX, f), "utf8"));
  } catch {
    rows.push({ source_id: f, source_type: type, parse_error: true });
    continue;
  }
  const got = [];
  walk(json, "$", got);
  for (const g of got) rows.push({ source_id: f, source_type: type, ...g });
}

/* ── 운영 DB ─────────────────────────────────────────────────────────────── */
const p = new PrismaClient();
const db = await p.$queryRawUnsafe(`
  select id, snapshot_id, origin_code, candidate_url, candidate_domain, candidate_title,
         image_url, price_amount, price_currency, price_status, market,
         system_verdict, match_truth, price_tier, blockers, match_reasons,
         human_verdict, human_note, source, first_seen_at, last_seen_at
    from candidate_reviews order by origin_code, candidate_domain`);
for (const r of db)
  rows.push({
    source_id: "candidate_reviews",
    source_type: r.human_verdict ? "OPERATIONAL_DB_HUMAN" : "OPERATIONAL_DB_OBSERVED",
    source_row_id: r.id,
    labels: r.human_verdict ? { humanVerdict: r.human_verdict } : {},
    basis: r.human_note ? { humanNote: r.human_note } : {},
    candidate_url: r.candidate_url,
    domain: r.candidate_domain,
    origin_code: r.origin_code,
    market: r.market,
    system_verdict: r.system_verdict,
    match_truth: r.match_truth,
    price_tier: r.price_tier,
    in_domestic_reference: null,
    blockers: r.blockers,
    conflicts: null,
    present_keys: Object.keys(r),
    raw: r,
  });

/* ── 원상품 Evidence — **저장된 스냅샷** 에서 읽는다(새 추출 0) ───────────── */
const snaps = await p.$queryRawUnsafe(`
  select id, source_url, title, (workspace->'canonicalProduct') cp
    from product_snapshots where workspace ? 'canonicalProduct'`);
/** 🔴 origin_code 는 저장돼 있지 않다 — **URL 문자열** 로만 잇는다(추론 금지). */
const originByCode = new Map();
for (const s of snaps) {
  const m = /\/(b\d{3}[a-z]{2}\d{3})/i.exec(String(s.source_url));
  if (!m) continue;
  const code = m[1].toUpperCase();
  if (!originByCode.has(code)) originByCode.set(code, s);
}

/** 🟢 `{value, source, confidence}` 를 그대로 꺼낸다 — 출처·확인상태가 그 안에 있다. */
const fld = (cp, k) => {
  const v = cp?.[k];
  if (v == null) return { value: null, source: null, confidence: null, present: false };
  if (typeof v === "object" && "value" in v)
    return { value: v.value ?? null, source: v.source ?? null, confidence: v.confidence ?? null, present: true };
  return { value: v, source: null, confidence: null, present: true };
};
const AXES = [
  ["Brand", "brand"],
  ["ModelName", "modelName"],
  ["SKU", "sku"],
  ["ProductName", "title"],
  ["Form", "shopifyProductType"],
  ["Color", "color"],
  ["Material", "material"],
  ["Audience", "recommendedAge"],
  ["CountryOfOrigin", "countryOfOrigin"],
];
const norm = (x) => (x == null ? null : String(x).trim().toLowerCase().replace(/\s+/g, " "));
/** 🔴 **기계적 문자열 비교** 다 — 동일상품 판정이 아니다. */
const rawMatch = (a, b) => {
  const A = norm(a);
  const B = norm(b);
  if ((A === null || A === "") && (B === null || B === "")) return "BOTH_MISSING";
  if (A === null || A === "") return "ORIGIN_MISSING";
  if (B === null || B === "") return "CANDIDATE_MISSING";
  return A === B ? "EQUAL" : "DIFFERS";
};

const evidence = [];
for (const r of rows) {
  if (!r.origin_code || !r.candidate_url) continue;
  const snap = originByCode.get(String(r.origin_code).toUpperCase());
  const cp = snap?.cp ?? null;
  const axes = AXES.map(([name, key]) => {
    const o = fld(cp, key);
    /** 🔴 후보측은 자료가 들고 있는 칸만 — **없으면 없다고 적는다**(추론 0). */
    const cand =
      name === "ProductName"
        ? (r.raw?.candidate_title ?? r.raw?.title ?? null)
        : name === "Brand"
          ? (r.raw?.brand ?? r.raw?.matched_brand ?? null)
          : null;
    return {
      axis: name,
      origin_value: o.value,
      origin_source: o.source,
      origin_confidence: o.confidence,
      origin_present: o.present,
      candidate_value: cand,
      candidate_present: cand != null && String(cand).trim() !== "",
      raw_match: rawMatch(o.value, cand),
    };
  });
  evidence.push({
    source_id: r.source_id,
    source_row_id: r.source_row_id,
    source_type: r.source_type,
    origin_code: r.origin_code,
    origin_url: snap?.source_url ?? null,
    origin_title: snap?.title ?? null,
    origin_images: Array.isArray(cp?.images) ? cp.images.length : 0,
    candidate_url: r.candidate_url,
    domain: r.domain,
    market: r.market,
    labels: r.labels,
    basis: r.basis,
    system_verdict: r.system_verdict,
    match_truth: r.match_truth,
    price_tier: r.price_tier,
    blockers: r.blockers,
    axes,
  });
}

/* ── 계보 / 중복 «가능성» — 🔴 표시만 한다(병합·제거 0) ───────────────────── */
const byUrl = new Map();
for (const r of rows) {
  if (!r.candidate_url) continue;
  const k = String(r.candidate_url).trim().toLowerCase();
  if (!byUrl.has(k)) byUrl.set(k, []);
  byUrl.get(k).push({ source_id: r.source_id, source_type: r.source_type, source_row_id: r.source_row_id, labels: r.labels });
}
const lineage = [...byUrl.entries()]
  .filter(([, v]) => v.length > 1)
  .map(([url, v]) => ({ candidate_url: url, appearances: v.length, in: v }));

const w = (f, arr) => writeFileSync(path.join(OUT, f), arr.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
w("ipes-rows.jsonl", rows);
w("ipes-evidence.jsonl", evidence);
w("ipes-lineage.jsonl", lineage);

/* ── 요약 ────────────────────────────────────────────────────────────────── */
const byType = rows.reduce((a, r) => ((a[r.source_type] = (a[r.source_type] ?? 0) + 1), a), {});
console.log("══ IPES PHASE A~B 패키지 ══\n");
console.log("원본 행 전수:", rows.length, JSON.stringify(byType));
console.log("Evidence 쌍(원상품 연결됨):", evidence.length);
console.log("원상품 스냅샷 매칭된 품번:", [...originByCode.keys()].sort().join(", "));
console.log("🔴 중복 «가능성» URL(2개 이상 자료에 등장):", lineage.length, "— 표시만 했고 병합 0");

const diff = rows.filter(
  (r) => r.labels?.humanVerdict && r.system_verdict && r.labels.humanVerdict !== r.system_verdict,
);
console.log("\n🔴 사람 ↔ 시스템 **불일치 행**:", diff.length);
const dd = diff.reduce((a, r) => {
  const k = `${r.labels.humanVerdict} ↔ ${r.system_verdict}`;
  a[k] = (a[k] ?? 0) + 1;
  return a;
}, {});
for (const [k, n] of Object.entries(dd)) console.log(`   ${k}  n=${n}`);

console.log("\n🟢 라벨 어휘 **원문 전수**(번역 0):");
const vocab = {};
for (const r of rows)
  for (const [k, v] of Object.entries(r.labels ?? {})) vocab[`${k}=${v}`] = (vocab[`${k}=${v}`] ?? 0) + 1;
for (const [k, n] of Object.entries(vocab).sort((a, b) => b[1] - a[1])) console.log(`   ${k}  n=${n}`);

console.log(`\n→ ${OUT}\\ipes-rows.jsonl · ipes-evidence.jsonl · ipes-lineage.jsonl`);
console.log("🔴 읽기만 했다 — 판정 0 · 번역 0 · 병합 0 · 추론 0 · DB 쓰기 0.");
await p.$disconnect();
