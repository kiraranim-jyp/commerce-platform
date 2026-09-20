/** 임시 시뮬레이션(P0-A STEP B). 오프라인·읽기전용. 끝나면 삭제한다.
 *  실행: packages/crawler 에서  npx tsx scripts/_tmp-p0a-sim.mts <links.json>
 *
 *  🔴 판정 함수는 운영 코드를 그대로 부른다. A/B/C 안만 이 파일에서 «모사»한다
 *     (프로덕션 로직은 한 줄도 건드리지 않는다).
 *     priceTierFromLink 는 apps/admin 에 있고 「@/」 별칭 때문에 tsx 로 못 부른다 —
 *     그래서 티어 매핑만 여기 옮겨 적었고, 그 매핑이 운영 함수와 같다는 것은
 *     match-truth-priority.test.ts ③ 「6단계 판정이 3단계 티어로 뭉개지는 지점」이
 *     운영 함수를 직접 불러 고정하고 있다.
 */
import { readFileSync } from "node:fs";
import { deriveMatchTruth, MATCH_TRUTH_RANK, type MatchTruth } from "../src/comparison-search/match-truth";
import { compareModelCode } from "../src/comparison-search/model-code";
import type { CrossSellerVerdict } from "../src/comparison-search/cross-seller";
import type { MatchLevel } from "../src/comparison-search/match";
import type { ModelEvidenceResult } from "../src/comparison-search/evidence";

type Tier = "EXACT" | "COMPARISON" | "EXCLUDED";
type Truth = MatchTruth | "NEEDS_REVIEW";

function tierOf(t: Truth): Tier {
  if (t === "EXACT_IDENTIFIER" || t === "STRONG_IDENTIFIER") return "EXACT";
  if (t === "TEXT_CONFIRMED" || t === "SIMILAR") return "COMPARISON";
  if (t === "NEEDS_REVIEW") return "EXCLUDED"; // B안: 새 값은 CHECK 제약에도 priceTier 에도 없다 → 오늘의 저장소에서는 버려진다
  return "EXCLUDED";
}

const HIGH = new Set<MatchLevel>(["high", "very_high"]);
/** match-truth.ts:93-103 의 «품번 없음» 경로만 떼어낸 것(운영 동작과 동일). */
function textAndCrossOnly(level: MatchLevel, crossSeller?: CrossSellerVerdict): MatchTruth {
  return deriveMatchTruth(level, "unavailable", crossSeller);
}

/* ── 현재(오늘) ── */
const CURRENT = (l: MatchLevel, m: ModelEvidenceResult, c?: CrossSellerVerdict): Truth =>
  deriveMatchTruth(l, m, c);

/* ── A안: CONFLICT→EXCLUDED · PRESUMED_SAME/SIMILAR/UNKNOWN 에서는 품번 단독 승격 금지 ── */
const HOLD: readonly (CrossSellerVerdict | undefined)[] = ["PRESUMED_SAME", "SIMILAR", "UNKNOWN"];
const PLAN_A = (l: MatchLevel, m: ModelEvidenceResult, c?: CrossSellerVerdict): Truth => {
  if (c === "CONFLICT") return "CONFLICT";
  if (m === "conflict") return "CONFLICT";
  if (HOLD.includes(c)) return textAndCrossOnly(l, c); // 품번은 등급을 «올리지» 못한다
  if (m === "exact") return HIGH.has(l) ? "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
  if (m === "partial") return "STRONG_IDENTIFIER";
  return textAndCrossOnly(l, c);
};

/* ── B안: exact + PRESUMED_SAME 만 새 «보류/검토» 단계로 뺀다 ── */
const PLAN_B = (l: MatchLevel, m: ModelEvidenceResult, c?: CrossSellerVerdict): Truth => {
  if (c === "CONFLICT") return "CONFLICT";
  if (m === "conflict") return "CONFLICT";
  if (m === "exact" && c === "PRESUMED_SAME") return "NEEDS_REVIEW";
  return deriveMatchTruth(l, m, c);
};

/* ── C안: exact + SAME 만 EXACT. 그 외 품번 «단독»으로 EXACT 금지 ── */
const PLAN_C = (l: MatchLevel, m: ModelEvidenceResult, c?: CrossSellerVerdict): Truth => {
  if (c === "CONFLICT") return "CONFLICT";
  if (m === "conflict") return "CONFLICT";
  if (m === "exact" && c === "SAME") return HIGH.has(l) ? "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
  return textAndCrossOnly(l, c); // 품번은 더 이상 혼자 승격시키지 않는다
};

const PLANS = { CURRENT, A: PLAN_A, B: PLAN_B, C: PLAN_C } as const;
type PlanName = keyof typeof PLANS;

const LEVELS: readonly MatchLevel[] = ["low", "medium", "high", "very_high"];
const MODELS: readonly ModelEvidenceResult[] = ["exact", "partial", "conflict", "unavailable"];
const CROSS: readonly (CrossSellerVerdict | undefined)[] = [
  undefined,
  "SAME",
  "PRESUMED_SAME",
  "SIMILAR",
  "UNKNOWN",
  "CONFLICT",
];

function pad(s: unknown, n: number) {
  return String(s).padEnd(n);
}

/* ══════════════ 층1 — 합성 전수(우선순위 «구조»를 확정한다) ══════════════ */
console.log("\n##### 층1 — 합성 전수 96칸 (실제 상품 아님. 구조만 본다) #####\n");
const tally: Record<PlanName, Record<Tier | "NEEDS_REVIEW", number>> = {} as never;
for (const p of Object.keys(PLANS) as PlanName[]) {
  tally[p] = { EXACT: 0, COMPARISON: 0, EXCLUDED: 0, NEEDS_REVIEW: 0 };
}
const changed: Record<PlanName, { from: Tier; to: Tier; key: string; truth: Truth }[]> = {
  CURRENT: [],
  A: [],
  B: [],
  C: [],
};
for (const l of LEVELS)
  for (const m of MODELS)
    for (const c of CROSS) {
      const base = tierOf(CURRENT(l, m, c));
      for (const p of Object.keys(PLANS) as PlanName[]) {
        const t = PLANS[p](l, m, c);
        tally[p][tierOf(t)] += 1;
        if (t === "NEEDS_REVIEW") tally[p].NEEDS_REVIEW += 1;
        if (p !== "CURRENT" && tierOf(t) !== base) {
          changed[p].push({ from: base, to: tierOf(t), key: `${l}/${m}/${c ?? "none"}`, truth: t });
        }
      }
    }
console.log(pad("안", 8), pad("EXACT", 8), pad("COMPARISON", 12), pad("EXCLUDED", 10), "NEEDS_REVIEW");
for (const p of Object.keys(PLANS) as PlanName[]) {
  const t = tally[p];
  console.log(pad(p, 8), pad(t.EXACT, 8), pad(t.COMPARISON, 12), pad(t.EXCLUDED, 10), t.NEEDS_REVIEW);
}
for (const p of ["A", "B", "C"] as const) {
  const lost = changed[p].filter((x) => x.from === "EXACT");
  const gained = changed[p].filter((x) => x.to === "EXACT");
  console.log(`\n[${p}안] 티어가 바뀐 칸 ${changed[p].length}/96 · EXACT 에서 빠짐 ${lost.length} · EXACT 로 들어옴 ${gained.length}`);
  const byPattern = new Map<string, number>();
  for (const x of changed[p]) byPattern.set(`${x.from}→${x.to}`, (byPattern.get(`${x.from}→${x.to}`) ?? 0) + 1);
  for (const [k, v] of byPattern) console.log(`   ${k}: ${v}`);
}

/* ══ 층1-b: 문서화된 10건이 «어떤 입력 모양»인지, 각 안이 그 모양을 잡는지 ══ */
console.log("\n##### 층1-b — 문서화된 10건의 «입력 모양»에 각 안을 적용 #####");
console.log("(상품 픽스처가 아니라 입력 3튜플만 쓴다. 실제 쌍 재현은 층3 참고)\n");
const DOCUMENTED: { name: string; n: number; level: MatchLevel; m: ModelEvidenceResult; c: CrossSellerVerdict; cause: string }[] = [
  {
    name: "junioredition self-search false SAME",
    n: 7,
    level: "low",
    m: "exact",
    c: "PRESUMED_SAME",
    cause: "판매처가 두 상품에 같은 Product Code (5쌍 exact / Misha&Puff 2쌍은 partial)",
  },
  {
    name: "junioredition (Misha&Puff 2쌍의 실제 모양)",
    n: 2,
    level: "low",
    m: "partial",
    c: "PRESUMED_SAME",
    cause: "품번이 서로 다른데 LCS≥4 로 partial",
  },
  {
    name: "Booty Ghosts LCS-related",
    n: 3,
    level: "low",
    m: "partial",
    c: "SAME",
    cause: 'LCS≥4 로 "26AC0" 가 우연히 겹침 + core 5 라 crossSeller 자체가 SAME',
  },
];
for (const d of DOCUMENTED) {
  const row = (["CURRENT", "A", "B", "C"] as PlanName[]).map((p) => {
    const t = PLANS[p](d.level, d.m, d.c);
    return `${p}=${tierOf(t)}`;
  });
  console.log(`${pad(d.name, 46)} n=${d.n}  [${d.level}/${d.m}/${d.c}]  ${row.join("  ")}`);
  console.log(`${" ".repeat(46)} 원인: ${d.cause}`);
}

/* ══ 층1-c: Booty Ghosts 의 품번 비교는 순수함수라 «실제로» 재현된다 ══ */
console.log("\n##### 층1-c — Booty Ghosts 품번 비교 실제 재현(순수함수) #####");
for (const other of ["SB126AC001", "SB126AC002", "SB126AC003"]) {
  console.log(`  compareModelCode("B226AC010","${other}") = ${compareModelCode("B226AC010", other)}`);
}
console.log(`  compareModelCode("B226AC010","B226AC114") = ${compareModelCode("B226AC010", "B226AC114")}  (같은 문서 ③ — conflict)`);

/* ══════════════ 층2 — 저장된 70행으로 «되살릴 수 있는 것»만 ══════════════
 * 입력 links.json 은 아래 두 쿼리를 그대로 담은 것이다(읽기 전용).
 * packages/database 에서 `node --env-file=.env` 로 돌려야 @prisma/client 가 잡힌다.
 *
 *   links: SELECT l.id, l.snapshot_id, l.source_id, l.match_truth, l.verified,
 *                 l.match_confidence::float8 AS conf, l.match_type, l.status,
 *                 l.matched_title, l.matched_model_name, l.external_url,
 *                 l.match_reasons, l.updated_at::text AS updated_at,
 *                 src.domain AS source_domain, s.title AS snapshot_title
 *          FROM domestic_product_links l
 *          LEFT JOIN domestic_price_sources src ON src.id = l.source_id
 *          LEFT JOIN product_snapshots s ON s.id = l.snapshot_id
 *
 *   obs:   SELECT source_ref_id, snapshot_id, count(*)::int AS n,
 *                 count(price_krw)::int AS n_priced
 *          FROM price_observations
 *          WHERE source = 'DOMESTIC_SHOP' AND source_ref_id IS NOT NULL
 *          GROUP BY 1,2
 */
console.log("\n##### 층2 — domestic_product_links 70행 재구성 #####\n");
const dump = JSON.parse(readFileSync(process.argv[2], "utf8")) as {
  links: Record<string, unknown>[];
  obs: { source_ref_id: string; snapshot_id: string; n: number; n_priced: number }[];
};

/** decision.ts:88-105 가 «쓴» 문장을 되읽어 (level, modelCode) 를 복원한다. */
function reconstruct(reasons: string[]): { level: MatchLevel | null; modelCode: ModelEvidenceResult | null } {
  const joined = reasons.join(" / ");
  const lvl = /기존 매칭 level=(\w+)/.exec(joined)?.[1] as MatchLevel | undefined;
  if (/modelCode 완전 일치/.test(joined)) return { level: lvl ?? null, modelCode: "exact" };
  if (/modelCode 부분 일치\(식별자 근거\)/.test(joined)) return { level: lvl ?? null, modelCode: "partial" };
  // 레거시 문장(P-7-C 이전 decision.ts). 「부분 일치인데 기존 판단 유지」였다.
  if (/modelCode 부분 일치 — 보조 근거/.test(joined)) return { level: null, modelCode: "partial" };
  // 🔴 decision.ts:91 의 문장에만 걸리도록 «기존 매칭 level=» 까지 붙여 고정한다.
  //    이것 없이 /modelCode 충돌/ 로만 보면 match.ts 가 쓰는 다른 문장
  //    「텍스트 유사도 상위 2건은 modelCode 충돌로 제외하고 이 후보를 선택함」(20행)에
  //    오탐한다 — 그 문장은 «이 후보»가 아니라 «탈락한 다른 후보»에 대한 말이다.
  if (/modelCode 충돌\(기존 매칭 level=/.test(joined)) return { level: lvl ?? null, modelCode: "conflict" };
  if (/교차판매처 판정 동일상품/.test(joined)) return { level: lvl ?? null, modelCode: "unavailable" };
  if (/교차판매처 반증/.test(joined)) return { level: lvl ?? null, modelCode: "unavailable" };
  return { level: null, modelCode: "unavailable" }; // decision=unchanged 경로는 항상 unavailable(decision.ts:109)
}

// 🔴 price_observations.source_ref_id 는 «링크 id» 가 아니라 «판매처 id» 다
//    (실측 67/67). market-intelligence.ts:76 도 같은 키로 잇는다:
//    tierBySourceId = new Map(links.map((l) => [l.sourceId, ...])).
//    그래서 (snapshot_id, source_id) 쌍으로 이어야 한다.
const obsBySource = new Map(dump.obs.map((o) => [`${o.snapshot_id}|${o.source_ref_id}`, o]));
const rows = dump.links.map((l) => {
  const r = reconstruct((l.match_reasons as string[]) ?? []);
  const stored = l.match_truth as MatchTruth | null;
  const tier: Tier = stored ? tierOf(stored) : (l.verified as boolean) ? "EXACT" : "COMPARISON";
  return {
    id: l.id as string,
    snapshot: l.snapshot_id as string,
    stored,
    tier,
    ...r,
    crossSeller: /근거:|보류:/.test(((l.match_reasons as string[]) ?? []).join(" ")) ? "RECOVERABLE" : null,
    obs: obsBySource.get(`${l.snapshot_id as string}|${l.source_id as string}`),
  };
});

const cnt = <T>(arr: T[], f: (x: T) => boolean) => arr.filter(f).length;
console.log(`행 ${rows.length}`);
console.log(`  crossSellerVerdict 복원 가능 : ${cnt(rows, (r) => r.crossSeller !== null)}  ← 🔴 A/B/C 의 «입력»`);
console.log(`  modelCode 복원 가능          : ${cnt(rows, (r) => r.modelCode !== null)}`);
console.log(`  matchLevel 복원 가능         : ${cnt(rows, (r) => r.level !== null)}`);
const byModel = new Map<string, number>();
for (const r of rows) byModel.set(String(r.modelCode), (byModel.get(String(r.modelCode)) ?? 0) + 1);
console.log("  modelCode 분포:", Object.fromEntries(byModel));
const byTier = new Map<string, number>();
for (const r of rows) byTier.set(r.tier, (byTier.get(r.tier) ?? 0) + 1);
console.log("  오늘의 티어 분포:", Object.fromEntries(byTier));

// 복원한 (level, modelCode) 로 저장값을 재계산해서 «복원이 맞는지» 검산한다.
let ok = 0;
let mismatch: string[] = [];
for (const r of rows) {
  if (!r.level || !r.modelCode) continue;
  const recomputed = deriveMatchTruth(r.level, r.modelCode, undefined);
  if (recomputed === r.stored) ok += 1;
  else mismatch.push(`${r.id} 저장=${r.stored} 재계산=${recomputed} (${r.level}/${r.modelCode})`);
}
console.log(`\n  검산: level+modelCode 둘 다 복원된 행 중 저장값과 일치 ${ok}건 · 불일치 ${mismatch.length}건`);
for (const m of mismatch.slice(0, 5)) console.log("    " + m);

// 🔴 가격 영향 — 품번 한 축만으로 EXACT 에 들어간 행이 몇 개이고, 그게 몇 개 상품인가.
const exactRows = rows.filter((r) => r.tier === "EXACT");
const identifierDriven = exactRows.filter((r) => r.modelCode === "exact" || r.modelCode === "partial");
console.log(`\n  EXACT 티어 행 ${exactRows.length} 중 «품번 단독»으로 EXACT 인 행: ${identifierDriven.length}`);
const atRiskSnapshots = new Set(identifierDriven.map((r) => r.snapshot));
const exactSnapshots = new Set(exactRows.map((r) => r.snapshot));
console.log(`  그 행이 붙은 상품(snapshot) 수: ${atRiskSnapshots.size} / EXACT 를 가진 상품 ${exactSnapshots.size}`);
// 품번 축이 전부 빠지면 EXACT 가 «하나도 없어지는» 상품
const survives = new Set(exactRows.filter((r) => !(r.modelCode === "exact" || r.modelCode === "partial")).map((r) => r.snapshot));
const wouldLoseAll = [...atRiskSnapshots].filter((s) => !survives.has(s));
console.log(`  🔴 품번 축이 전부 빠지면 동일상품 가격을 «통째로» 잃는 상품: ${wouldLoseAll.length}개`);
const pricedLost = identifierDriven.filter((r) => r.obs && r.obs.n_priced > 0);
console.log(`  그 행 중 실제 가격 관측치가 달려 있는 행: ${pricedLost.length} (관측치 ${pricedLost.reduce((s, r) => s + (r.obs?.n_priced ?? 0), 0)}건)`);
console.log(
  `\n  🔴 그러나 이 ${identifierDriven.length}행이 A/C안에서 «실제로» 빠지는지는 crossSellerVerdict 가 있어야 정해진다 — 복원 가능 0건.`,
);

/* ── 안별 «최대 손실» 구간. 최소는 전부 0(모든 쌍이 SAME 이었다면 아무것도 안 빠진다) ── */
console.log("\n  ── 안별 가격 손실 구간(최소 ~ 최대). crossSellerVerdict 를 모르므로 구간으로만 말한다 ──");
const exactOnly = identifierDriven.filter((r) => r.modelCode === "exact");
const partialOnly = identifierDriven.filter((r) => r.modelCode === "partial");
const bounds: [string, number, string][] = [
  // A안: exact/partial × {PRESUMED_SAME,SIMILAR,UNKNOWN} 에서만 빠진다 → 최대 42
  ["A", identifierDriven.length, "품번행 전부가 보류 판정(PRESUMED_SAME/SIMILAR/UNKNOWN)이었을 때"],
  // B안: exact × PRESUMED_SAME 만 새 단계로 → 최대 23(partial 은 손대지 않는다)
  ["B", exactOnly.length, "exact 행 전부가 PRESUMED_SAME 이었을 때(partial 20행은 손대지 않는다)"],
  // C안: exact×SAME 만 살아남는다 → 최대 42
  ["C", identifierDriven.length, "품번행 중 exact×SAME 이 하나도 없었을 때"],
];
for (const [name, max, why] of bounds) {
  const snaps = new Set(
    (name === "B" ? exactOnly : identifierDriven).map((r) => r.snapshot),
  );
  const lostAll = [...snaps].filter((s) => !survives.has(s));
  const priced = (name === "B" ? exactOnly : identifierDriven).filter((r) => r.obs && r.obs.n_priced > 0);
  console.log(
    `   ${name}안  최대 ${String(max).padStart(2)}행 / 상품 ${String(lostAll.length).padStart(2)}개 / 가격관측치 ${priced.reduce((s, r) => s + (r.obs?.n_priced ?? 0), 0)}건 — ${why}`,
  );
}
console.log(`   세 안 모두 «최소» 는 0 이다 — 저장된 행으로는 그 이상을 좁힐 수 없다.`);
console.log(`   🔴 EXACT 를 가진 상품 ${exactSnapshots.size}개 중 ${wouldLoseAll.length}개(${Math.round((wouldLoseAll.length / exactSnapshots.size) * 100)}%)가 «품번 한 축»에만 의존한다.`);
console.log(`      살아남는 ${exactSnapshots.size - wouldLoseAll.length}개는 전부 match_truth=null + verified=true 인 레거시 행이다(판정기가 만든 행이 아니다).`);
console.log(`   측정 장치 결론: A/B/C 를 재려면 crossSellerVerdict 를 «행에 적는» 것이 선행돼야 한다.`);

/* ══════════════ 층3 — 문서화된 실측 케이스를 «픽스처로» 재현 ══════════════ */
console.log("\n##### 층3 — 문서화된 10건 재현(픽스처가 있는 것만) #####\n");
const { compareCrossSellerProducts } = await import("../src/comparison-search/cross-seller");
const { productFactsFromShopifyProduct, productFactsFromSmallableHtml } = await import(
  "../src/comparison-search/seller-facts"
);
import type { ProductFacts } from "@commerce/shared";
const { fileURLToPath } = await import("node:url");
const FX = fileURLToPath(new URL("../src/__tests__/fixtures/", import.meta.url));
const junior = (h: string): ProductFacts => {
  const raw = JSON.parse(readFileSync(FX + `junioredition-${h}.json`, "utf8")) as Record<string, unknown>;
  return productFactsFromShopifyProduct(
    {
      title: raw.title as string,
      handle: raw.handle as string,
      url: `/products/${raw.handle as string}`,
      description: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
      images: raw.images as string[],
    },
    "junioredition.com",
  );
};
const registered = (h: string, col: string): ProductFacts => ({
  ...junior(h),
  sourceUrl: `https://www.junioredition.com/en-kr/collections/${col}/products/${h}`,
});
const bobo = (c: string): ProductFacts =>
  productFactsFromShopifyProduct(
    JSON.parse(readFileSync(FX + `bobochoses-${c.toLowerCase()}.json`, "utf8")),
    "bobochoses.com",
  );

/** [이름, 왼쪽facts, 오른쪽facts, 정답(같은 상품인가)] */
const REAL: [string, ProductFacts, ProductFacts, boolean][] = [];
const FALSE_SAME: [string, string, string][] = [
  ["minnie-newborn-body-in-rosetto-by-konges-slojd", "konges-slojd", "minnie-newborn-onesie-in-rosetto-by-konges-slojd"],
  ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing", "bubble-sweatshirt-in-graystone-by-main-story"],
  ["baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff", "baby-circus-stripe-romper-in-antique-rose-by-misha-puff"],
  ["baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff", "circus-stripe-cardigan-in-mink-by-misha-puff"],
  ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes", "giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe"],
  ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes", "giulia-flower-sandals-in-camelia-by-pepe"],
  ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes", "giulia-flower-sandals-in-cacao-by-pepe"],
  ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing", "bubble-sweatshirt-in-conker-stripe-by-main-story"],
  ["bubble-sweatshirt-in-graystone-by-main-story", "kids-clothing", "bubble-sweatshirt-in-conker-stripe-by-main-story"],
];
for (const [h, col, other] of FALSE_SAME) REAL.push([`FP? ${h.slice(0, 28)} ↔ ${other.slice(0, 28)}`, registered(h, col), junior(other), false]);
const SELF = ["lulu-t-bar-shoes-in-vernice-nero-by-pepe", "minnie-newborn-body-in-rosetto-by-konges-slojd", "bubble-sweatshirt-in-grey-melange-by-main-story", "giulia-flower-sandals-in-ombretto-pink-by-pepe", "baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff"];
for (const h of SELF) REAL.push([`TP  self ${h.slice(0, 40)}`, registered(h, "kids-clothing"), junior(h), true]);
REAL.push(["TN  bobo B226AC042 ↔ B226AC043(색만 다름)", bobo("B226AC042"), bobo("B226AC043"), false]);

console.log(pad("쌍", 62), pad("cross", 14), pad("model", 11), pad("정답", 5), "CURRENT  A안      B안      C안");
const score: Record<PlanName, { fp: number; fn: number; exact: number }> = {
  CURRENT: { fp: 0, fn: 0, exact: 0 }, A: { fp: 0, fn: 0, exact: 0 }, B: { fp: 0, fn: 0, exact: 0 }, C: { fp: 0, fn: 0, exact: 0 },
};
for (const [name, a, b, same] of REAL) {
  const c = compareCrossSellerProducts(a, b).verdict;
  const m = compareModelCode(a.brandModelCode, b.brandModelCode);
  const cells = (["CURRENT", "A", "B", "C"] as PlanName[]).map((p) => {
    const t = tierOf(PLANS[p]("low", m, c));
    if (t === "EXACT") { score[p].exact += 1; if (!same) score[p].fp += 1; }
    else if (same) score[p].fn += 1;
    return pad(t, 9);
  });
  console.log(pad(name, 62), pad(c, 14), pad(m, 11), pad(same ? "같음" : "다름", 5), cells.join(""));
}
console.log("\n  level=low 고정(실측 링크가 low 였다). 합계:");
console.log(pad("안", 8), pad("EXACT 쌍", 10), pad("FP(다른데 EXACT)", 20), "FN(같은데 EXACT 아님)");
for (const p of ["CURRENT", "A", "B", "C"] as PlanName[])
  console.log(pad(p, 8), pad(score[p].exact, 10), pad(score[p].fp, 20), score[p].fn);

/* ══ 층3-b — 🔴 «진짜 교차판매처 쌍» 은 어떤 verdict 를 받는가 ══
   A안/C안이 위험한 이유는 여기에 있다. 서로 다른 판매처의 «진짜 동일상품» 이
   SAME 을 못 받으면, A/C안은 그 쌍을 EXACT 에서 떨어뜨린다 = 가격 손실. */
console.log("\n##### 층3-b — 서로 다른 판매처의 진짜 동일상품 쌍 #####\n");
const smallable = (f: string, id: string): ProductFacts => {
  const r = productFactsFromSmallableHtml(readFileSync(FX + f, "utf8"), id);
  if (!r) throw new Error("픽스처 파싱 실패 " + f);
  return r;
};
const CROSS_PAIRS: [string, ProductFacts, ProductFacts, boolean][] = [
  ["Smallable 430701 ↔ Bobo B226AC114 (문서: 진짜 동일상품)", smallable("smallable-430701-product.html", "430701"), bobo("B226AC114"), true],
  ["Smallable 430651 ↔ Bobo B226AC042 (문서: 색 충돌)", smallable("smallable-430651-fr.html", "430651"), bobo("B226AC042"), false],
  ["Smallable 430632 ↔ Bobo B226AC018", smallable("smallable-430632-product.html", "430632"), bobo("B226AC018"), false],
  ["Smallable 430700 ↔ Bobo B226AC112", smallable("smallable-430700-product.html", "430700"), bobo("B226AC112"), false],
];
console.log(pad("쌍", 52), pad("cross", 14), pad("model", 12), "CURRENT  A안      B안      C안");
for (const [name, a, b] of CROSS_PAIRS) {
  const c = compareCrossSellerProducts(a, b).verdict;
  const m = compareModelCode(a.brandModelCode, b.brandModelCode);
  const cells = (["CURRENT", "A", "B", "C"] as PlanName[]).map((p) => pad(tierOf(PLANS[p]("low", m, c)), 9));
  console.log(pad(name, 52), pad(c, 14), pad(m, 12), cells.join(""));
}
console.log(
  "\n  🔴 판매처가 브랜드 품번을 싣지 않으면(Smallable) modelCode=unavailable 이라 A/B/C 가 «아무것도 바꾸지 않는다».",
);
console.log("     즉 A/C안의 손실은 «양쪽 다 품번을 싣는 판매처 쌍» 에만 생긴다.");

/* ══════════════ STEP D — Vision «호출 대상» 이 몇 쌍인가 ══════════════
   게이트(CEO 지시):
     TEXT 확정(crossSeller=SAME)                  → 호출 안 함
     TEXT 명백 제외(crossSeller=CONFLICT | modelCode=conflict) → 호출 안 함
     그 외(=애매)                                  → LOW-RES 호출
   🔴 «애매» 판정에 쓰는 값은 withConfidence 이후에도 살아 있는 것만이다:
      confidence · matchLevel · crossSellerVerdict · modelCode · matchTruth
      (axes[]/blockers[]/identifierConfirmed/conflicts[] 는 match.ts:487-490 에서 버려진다) */
console.log("\n##### STEP D — Vision 호출 대상 비율 #####\n");
const ambiguous = (m: ModelEvidenceResult, c?: CrossSellerVerdict) =>
  !(c === "SAME" || c === "CONFLICT" || m === "conflict");
let gateN = 0, gateAmb = 0;
for (const l of LEVELS) for (const m of MODELS) for (const c of CROSS) { gateN++; if (ambiguous(m, c)) gateAmb++; }
console.log(`  층1(합성 96칸)  애매 = ${gateAmb}/${gateN} (${Math.round((gateAmb / gateN) * 100)}%)`);
let rN = 0, rAmb = 0;
for (const [, a, b] of [...REAL.map((r) => [r[0], r[1], r[2]] as const), ...CROSS_PAIRS.map((r) => [r[0], r[1], r[2]] as const)]) {
  const c = compareCrossSellerProducts(a, b).verdict;
  const m = compareModelCode(a.brandModelCode, b.brandModelCode);
  rN++; if (ambiguous(m, c)) rAmb++;
}
console.log(`  층3(실측 픽스처 ${rN}쌍) 애매 = ${rAmb}/${rN} (${Math.round((rAmb / rN) * 100)}%)`);
console.log(`  층2(저장 70행)   애매 = 측정 불가 — crossSellerVerdict 복원 0건`);
console.log("\n  🔴 IMAGE 축 제약(cross-seller.ts:642-644): IMAGE 는 corePoints 에서 빠져 있어");
console.log("     SIMILAR→PRESUMED_SAME 승격만 가능하고 «SAME 을 만들 수 없다».");
console.log("     → Vision 이 same_product=true 를 줘도 오늘 배선으로는 EXACT tier 를 «만들 수 없다».");
console.log("  🔴 compareCrossSellerProducts 의 3번째 인자는 CrossSellerImageEvidence{minDistance:number|null}");
console.log("     = dHash 해밍거리 칸이다(cross-seller.ts:128-130). same_product:true|false|unknown 을 담을 칸이 «아니다».");
