/**
 * WU-138 후속 — **국내 human GT 가 얼마나 있는가** (READ ONLY)
 *
 * 🔴 CPO: 「국내 GT 확보 가능성을 조사하고 **기존 데이터에서 재사용 가능한 국내 GT 까지
 *    전수 검토** 한 뒤, 국내 MI 개선을 판단할 수 있는 **최소 표본과 측정방법** 을 확정.
 *    코드 수정부터 하지 않는다. 충분히 확보되지 않으면 **그 사실 자체를 근거와 함께** 보고.」
 *
 * 🔴 DB 쓰기 0 · 외부 HTTP 0 · AI 0 · 운영 코드 0.
 * 🔴 「국내」 판별은 **두 축으로 갈라 적는다** — 운영 `classifyCandidateMarket` 이
 *    `.kr` TLD / 등록부 둘만 KR 증거로 인정하고 **통화 단독 결정을 금지** 하기 때문이다.
 *      ① `.kr` TLD        → 운영이 KR 로 확정할 수 있는 축
 *      ② `.com` + 한국몰  → 운영 market **UNKNOWN**(WU-077 이 측정한 그 자리)
 *    🔴 둘을 합쳐 「국내 N건」으로 적지 않는다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-138-domestic-gt-survey.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const q = (sql, ...a) => prisma.$queryRawUnsafe(sql, ...a);

const FIXDIRS = [
  path.join(import.meta.dirname, "..", "..", "..", "apps", "admin", "src", "app", "api", "price-history", "_lib", "__tests__", "fixtures"),
];

const loose = (u) => String(u ?? "").trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** 🔴 이 목록은 **관측된 호스트** 다 — 지어낸 것이 아니고, 이 트랙의 보고서에서
 *  한국 쇼핑몰로 확인된 것만 적는다. 🔴 그래도 「추정」이라고 적는다(운영 판정 아님). */
const KR_MALL_NON_KR_TLD = new Set([
  "global.trenbe.com",
  "m.luxboy.com",
  "luxboy.com",
  "mustit.co.kr",
  "m.web.mustit.co.kr",
  "kream.co.kr",
  "ljm8481.cafe24.com",
  "miniboutique.co.kr",
]);

/* ─────────────────── ① fixture 라벨 전수 ─────────────────── */
const rows = [];
for (const dir of FIXDIRS) {
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    continue;
  }
  for (const f of files) {
    /** 🔴 wu-099/100 은 **가치 라벨**(USEFUL/NOISE)이라 동일성 GT 가 아니다 — 제외. */
    if (/wu-(099|100)/.test(f)) continue;
    let j;
    try {
      j = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    const arr = Array.isArray(j) ? j : (j.candidates ?? j.labels ?? Object.values(j).find(Array.isArray));
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      const url = c.url ?? c.candidateUrl ?? null;
      const verdict = c.verdict ?? c.humanVerdict ?? c.human ?? null;
      const origin = c.originCode ?? c.origin ?? c.sid ?? null;
      if (!url || !verdict) continue;
      rows.push({ src: f, url, verdict: String(verdict).toUpperCase(), origin });
    }
  }
}

/** 🔴 URL 키로 중복을 접는다 — 같은 후보가 여러 fixture 에 있다. */
const byUrl = new Map();
for (const r of rows) {
  const k = loose(r.url);
  const prev = byUrl.get(k);
  if (!prev) byUrl.set(k, { ...r, srcs: [r.src], conflict: false });
  else {
    prev.srcs.push(r.src);
    if (prev.verdict !== r.verdict) prev.conflict = true;
  }
}
const uniq = [...byUrl.values()];

const krTld = uniq.filter((r) => (host(r.url) ?? "").endsWith(".kr"));
const krMall = uniq.filter((r) => {
  const h = host(r.url);
  return h && !h.endsWith(".kr") && KR_MALL_NON_KR_TLD.has(h);
});
const overseas = uniq.filter((r) => !krTld.includes(r) && !krMall.includes(r));

const tally = (xs) => ({
  n: xs.length,
  SAME: xs.filter((x) => x.verdict === "SAME").length,
  DIFFERENT: xs.filter((x) => x.verdict === "DIFFERENT").length,
  기타: xs.filter((x) => x.verdict !== "SAME" && x.verdict !== "DIFFERENT").length,
  상충: xs.filter((x) => x.conflict).length,
});

console.log("=== ① fixture human GT 전수 (URL 키 · 가치라벨 제외) ===");
console.log(`라벨행 ${rows.length} → 고유 URL ${uniq.length}`);
console.log(`🇰🇷 .kr TLD        ${JSON.stringify(tally(krTld))}`);
console.log(`🟡 .com 한국몰(추정) ${JSON.stringify(tally(krMall))}   🔴 운영 market 은 UNKNOWN 일 수 있다`);
console.log(`🌎 해외            ${JSON.stringify(tally(overseas))}`);

console.log("\n--- 🇰🇷 .kr 라벨 전수 (원상품별) ---");
for (const r of [...krTld, ...krMall].sort((a, b) => String(a.origin).localeCompare(String(b.origin)))) {
  console.log(`  ${String(r.origin ?? "-").padEnd(12)} ${r.verdict.padEnd(10)} ${host(r.url)}  [${r.srcs.join(",")}]${r.conflict ? " 🔴상충" : ""}`);
}

/* ─────────── ② 그 원상품 스냅샷이 DB 에 «있는가» (측정 가능 분모) ─────────── */
const origins = [...new Set([...krTld, ...krMall].map((r) => r.origin).filter(Boolean))];
console.log("\n=== ② 그 라벨의 원상품 스냅샷이 DB 에 있는가 (없으면 측정불가) ===");
for (const o of origins) {
  const n = (
    await q(
      `select count(*)::int as n from product_snapshots where source_url ilike $1`,
      `%${String(o).toLowerCase()}%`,
    )
  )[0].n;
  console.log(`  ${String(o).padEnd(14)} 스냅샷 ${n}건 ${n === 0 ? "🔴 측정불가" : "🟢 측정가능"}`);
}

/* ─────────── ③ 운영 DB 의 셀러 판단(candidate_reviews) — 재사용 가능한 GT ─────────── */
console.log("\n=== ③ candidate_reviews (운영에 쌓인 셀러 판단) ===");
const cols = (
  await q(
    "select column_name from information_schema.columns where table_name='candidate_reviews' order by ordinal_position",
  )
).map((r) => r.column_name);
if (cols.length === 0) console.log("  (테이블 없음)");
else {
  console.log(`  칸: ${cols.join(", ")}`);
  const cr = await q(
    `select human_verdict, count(*)::int as n from candidate_reviews where human_verdict is not null group by human_verdict order by n desc`,
  );
  for (const r of cr) console.log(`  ${r.human_verdict}: ${r.n}`);
  const krRows = await q(
    `select origin_code, human_verdict, candidate_url as url from candidate_reviews
      where human_verdict is not null and (candidate_url ilike '%.kr/%' or candidate_url ilike '%.co.kr%' or candidate_url ilike '%trenbe%' or candidate_url ilike '%luxboy%' or candidate_url ilike '%mustit%' or candidate_url ilike '%kream%')
      order by origin_code`,
  );
  console.log(`\n  🇰🇷 국내(추정) 라벨 ${krRows.length}건`);
  for (const r of krRows) console.log(`    ${String(r.origin_code).padEnd(14)} ${String(r.human_verdict).padEnd(10)} ${host(r.url)}`);
}

/* ─────────── ④ 국내 후보를 «낼 수 있는» 공급원이 있는가 ─────────── */
console.log("\n=== ④ 국내 후보 공급원 (등록부) ===");
const shops = await q(
  `select collection_strategy, count(*)::int as n from domestic_price_sources group by collection_strategy order by n desc`,
);
for (const s of shops) console.log(`  ${s.collection_strategy}: ${s.n}`);

await prisma.$disconnect();
