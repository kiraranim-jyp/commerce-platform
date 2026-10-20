/**
 * WU-131 §9/§10 — **기존 Human GT 를 `candidate_reviews` 로 시딩한다.**
 *
 * 🔴 **의미를 임의 변경하지 않는다** — 기존 SAME/DIFFERENT/UNCERTAIN 을 그대로 옮긴다.
 *    매핑은 하나뿐이다: `UNCERTAIN → UNDECIDED`(어휘가 다르고 뜻이 같다).
 *    🔴 B226AC009 에는 UNCERTAIN 이 **0건** 이라 이 시딩에서는 **발화하지 않는다**(실측).
 * 🔴 **B226AC010(21건) · wu-093(10건)은 넣지 않는다**(§9) —
 *    전자는 원상품 snapshot 이 없고, 후자는 원상품이 「S1/S2」 이고 키가 판매처 SKU 다.
 * 🔴 `wu-099`/`wu-100` 은 **가치 라벨**(USEFUL/NOISE/UNSURE)이라 GT 가 아니다 — 제외.
 * 🟢 `source = GT_IMPORT` · MI 산출은 `system_*` · 사람 판단은 `human_verdict`.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-131-import-gt.mjs          (dry-run · 숫자만)
 *   node --env-file=.env scripts/wu-131-import-gt.mjs --apply  (실제 저장)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ORIGIN = "B226AC009";
const FIX = path.join(
  process.cwd(),
  "..",
  "..",
  "apps",
  "admin",
  "src",
  "app",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
);
const FILES = [
  "wu-093-human-gt.json",
  "wu-111-human-gt.json",
  "wu-112-human-gt.json",
  "wu-116-human-gt.json",
  "wu-125-human-gt.json",
];

/** 🔴 유일한 매핑. 그 외는 **글자 그대로** 옮긴다. */
const MAP = { SAME: "SAME", SIMILAR: "SIMILAR", DIFFERENT: "DIFFERENT", UNCERTAIN: "UNDECIDED" };

/** 🔴 운영과 **같은 키** 를 써야 한다 — 소문자 canonical URL(`reviewKey` 와 같은 성질).
 *  🟢 추적/검색 파라미터만 걷고 식별 파라미터는 보존한다. */
function key(raw) {
  try {
    const u = new URL(raw);
    const drop = [];
    for (const [k] of u.searchParams) {
      if (k.startsWith("_") || ["q", "query", "keyword", "keywords", "search", "searchword", "sq", "term", "s", "from_keyword"].includes(k))
        drop.push(k);
    }
    for (const k of drop) u.searchParams.delete(k);
    u.hash = "";
    return u.toString().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

const rows = [];
for (const f of FILES) {
  const o = JSON.parse(readFileSync(path.join(FIX, f), "utf8"));
  for (const r of o.candidates ?? o.humanReview ?? o.review ?? []) {
    const origin = r.originCode ?? r.origin ?? null;
    if (origin !== ORIGIN) continue; // 🔴 §9 — 다른 원상품은 넣지 않는다
    const human = MAP[r.verdict ?? r.humanVerdict ?? r.human ?? ""] ?? null;
    if (!r.url || !human) continue;
    rows.push({
      k: key(r.url),
      url: r.url,
      human,
      domain: r.domain ?? r.host ?? null,
      title: r.candidateTitle ?? r.title ?? null,
      system: r.systemVerdict ?? r.system ?? null,
      tier: r.systemPriceTier ?? r.priceTier ?? null,
      amount: r.aggregatedPrice?.amount ?? null,
      currency: r.aggregatedPrice?.currency ?? null,
      market: r.market ?? null,
      file: f,
    });
  }
}

/** 🔴🔴 **행 ≠ 고유 후보.** 같은 URL 이 두 파일에 있다(실측: `global.trenbe.com`). */
const byKey = new Map();
let conflict = 0;
for (const r of rows) {
  const prev = byKey.get(r.k);
  if (!prev) byKey.set(r.k, r);
  else if (prev.human !== r.human) {
    conflict += 1;
    console.log(`  🔴🔴 판단 상충 — ${prev.file}:${prev.human} ↔ ${r.file}:${r.human}  ${r.k.slice(0, 70)}`);
  }
}
const unique = [...byKey.values()];
const tally = {};
for (const r of unique) tally[r.human] = (tally[r.human] ?? 0) + 1;

console.log(`원상품 ${ORIGIN}`);
console.log(`  GT 행 ${rows.length} → 🟢 **고유 후보 ${unique.length}**(중복 ${rows.length - unique.length})`);
console.log(`  판단 상충 ${conflict}건 ${conflict === 0 ? "🟢" : "🔴 — 상충이 있으면 넣지 않는다"}`);
console.log(`  분포 ${JSON.stringify(tally)}`);

if (conflict > 0) {
  console.error("🔴 판단이 상충하는 GT 가 있다 — 임의로 고르지 않는다. 중단.");
  process.exit(1);
}
if (!APPLY) {
  console.log("\n(dry-run) — 저장하려면 --apply");
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
let inserted = 0;
for (const r of unique) {
  /** 🔴 snapshot 축이 아니라 **origin 축** 으로 넣는다 — 그래야 어느 스냅샷에서 열어도 보인다.
   *  🟢 그 부분 유니크(`origin_code, candidate_url`)가 중복 적재를 막는다. */
  await prisma.$executeRawUnsafe(
    `insert into candidate_reviews
       (origin_code, candidate_url, candidate_domain, candidate_title,
        price_amount, price_currency, market, system_verdict, price_tier,
        human_verdict, source, reviewed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'GT_IMPORT',now())
     on conflict (origin_code, candidate_url) where snapshot_id is null and origin_code is not null
     do update set human_verdict = excluded.human_verdict,
                   system_verdict = coalesce(excluded.system_verdict, candidate_reviews.system_verdict)`,
    ORIGIN,
    r.k,
    r.domain,
    r.title,
    r.amount,
    r.currency,
    r.market,
    r.system,
    r.tier,
    r.human,
  );
  inserted += 1;
}
const back = await prisma.$queryRawUnsafe(
  `select human_verdict, count(*)::int as n from candidate_reviews
    where origin_code=$1 and source='GT_IMPORT' group by 1 order by 1`,
  ORIGIN,
);
console.log(`\n🟢 입력 ${inserted}건 → 조회 ${back.reduce((a, b) => a + b.n, 0)}건 · ${JSON.stringify(back)}`);
const dup = await prisma.$queryRawUnsafe(
  `select count(*)::int as n from (select candidate_url from candidate_reviews
     where origin_code=$1 group by candidate_url having count(*)>1) t`,
  ORIGIN,
);
console.log(`🔴 candidate_url 중복 ${dup[0].n}건 ${dup[0].n === 0 ? "🟢" : "🔴"}`);
await prisma.$disconnect();
