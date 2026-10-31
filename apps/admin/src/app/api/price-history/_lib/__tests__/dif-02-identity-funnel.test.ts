import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ComparisonCandidate, ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { isEvidenceEvaluationWorthwhile, judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-IDENTITY-FUNNEL-02 — **Human SAME 이 어디서 사라지는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO §11: 「핵심 KPI 는 **SAME 숫자를 억지로 올리는 것이 아니라 Human SAME
 *           recovery 를 높이는 것** 이다.」
 *
 * 🔴🔴 **새 Search 를 하지 않는다**(CPO §3). 입력은 **이미 CEO 가 라벨한 URL** 이고
 *    그 뒤 경로(Crawl → Evidence → Identity)는 **운영 함수 그대로** 다.
 * 🔴 판정 변경 0 · threshold 0 · 8축 0 · Registry 0 · Query 0.
 * 🔴 게이트 `DIF_02_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 *
 * 🔴🔴 **⑧ 게이트 전/후를 가른다**(CPO §3) — 직전 WU 가 「18 → 4」를 뭉쳐 적었다.
 *    여기서는 URL 하나하나가 어느 칸에서 멈췄는지 적는다.
 */
const LIVE = process.env.DIF_02_PROBE === "1";
const FIX = path.join(__dirname, "fixtures");
const OUTDIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

/**
 * 🔴🔴🔴 DIF-03 — **1차 집계가 이 키 때문에 틀렸다. 그대로 보고했으면 거짓이었다.**
 *
 * `loose()` 는 raw URL 을 쓴다. 그런데 운영은 상품 페이지를 받아 **사이트가 스스로
 * 적은 canonical**(Shopify `/products/<handle>`)을 후보 URL 로 싣는다. GT 는
 * `/en-kr/collections/<c>/products/<handle>` 처럼 **로케일·목록 접두가 붙은** URL 이라
 * 둘이 글자로 다르다 ⟹ 1차 하니스가 **같은 상품을 「NOT_IN_POOL」로 9건** 찍었고,
 * 그중 **7건은 실제로는 JUDGED/SAME 까지 간 후보** 였다.
 *
 * 🟢 그래서 GT 라벨을 붙이는 키를 **「판매처 + 상품 handle」** 로 바꾼다.
 * 🔴 운영 로직이 아니다 — **라벨 매칭 전용** 이다(CPO §3-C 「harness 만 수정」).
 * 🔴 운영 `canonicalListingKey` 를 그대로 못 쓰는 이유: 그 함수는 **로케일을 보존**
 *    한다(시장 구분 · CPO 확정 정책). 여기서 필요한 것은 「CEO 가 라벨한 그 상품인가」다.
 */
const productKey = (u: string): string => {
  try {
    const x = new URL(u);
    const segs = x.pathname.toLowerCase().replace(/\/+$/, "").split("/").filter(Boolean);
    return `${x.hostname.toLowerCase().replace(/^www\./, "")}/${segs[segs.length - 1] ?? ""}`;
  } catch {
    return loose(u);
  }
};
const fx = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;

/**
 * 🔴 원상품 URL 을 **지어내지 않았다** — 저장된 데이터에서 읽은 값이다
 *    (B226AC009 = `wu-133-gt-origins.json` · B226AC010 = 리포 저장 URL).
 */
const ORIGINS: { code: string; url: string }[] = [
  { code: "B226AC009", url: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt" },
  { code: "B226AC010", url: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt" },
];

/** 🟢 CEO 라벨 전수 통합(URL 키 · 먼저 등록된 것이 이긴다 — 상충 0 은 아래에서 확인). */
function loadGt(): Map<string, { origin: string; url: string; human: string; src: string }> {
  const m = new Map<string, { origin: string; url: string; human: string; src: string }>();
  const add = (o?: string, u?: string, v?: string, src = "") => {
    if (!o || !u || !v) return;
    const k = loose(u);
    if (m.has(k)) return;
    m.set(k, { origin: o, url: u, human: v.toUpperCase(), src });
  };
  type C = Record<string, string | undefined>;
  const pull = (file: string, o: string, u: string, v: string) => {
    const d = fx<{ candidates?: C[]; rows?: C[]; items?: C[] }>(file);
    for (const c of d.candidates ?? d.rows ?? d.items ?? []) add(c[o], c[u], c[v], file.slice(0, 12));
  };
  pull("wu-112-human-gt.json", "originCode", "url", "verdict");
  pull("wu-111-human-gt.json", "originCode", "url", "humanVerdict");
  pull("wu-125-human-gt.json", "origin", "url", "human");
  pull("wu-116-human-gt.json", "originCode", "url", "humanVerdict");
  for (const f of ["core-same03-human-gt.json", "core-2aj-human-gt.json", "core-2al-human-gt.json"]) {
    const d = fx<{ candidates?: C[]; rows?: C[]; items?: C[] }>(f);
    for (const c of d.candidates ?? d.rows ?? d.items ?? [])
      add(c.originCode ?? c.origin, c.url, c.humanVerdict ?? c.human ?? c.verdict, f.slice(0, 12));
  }
  return m;
}

/** 🔴 한 URL 이 멈춘 «칸». 「후보 없음」과 「게이트에서 버려짐」을 섞지 않는다. */
type StopAt = "NOT_IN_POOL" | "GATE_DROPPED" | "NOT_SHOP_BEST" | "JUDGED";

interface Row {
  origin: string;
  url: string;
  domain: string;
  human: string;
  inPool: boolean;
  /** ⑧ `isEvidenceEvaluationWorthwhile` 산출 — 샵 단위다. */
  gatePassed: boolean | null;
  stopAt: StopAt;
  /** 🔴 풀에서 떨어졌다면 **왜** 떨어졌는가 — Crawl 문제와 Evidence 문제를 가른다. */
  dropReason: string | null;
  /**
   * 🔴🔴 PRICE-ELIGIBILITY-AUDIT-01A — **「금액이 있다」와 「가격 축에 들어간다」는 다르다.**
   *    CPO 가 `19/19 → 20/20` 과 「가격 변화 0」의 모순을 지적했고, 그 둘을 가를 칸이
   *    이 하니스에 **없었다**.
   * 🔴 **재계산하지 않는다** — `judgeDomesticCandidate` 가 돌려주는 값을 그대로 적는다
   *    (`matchTruth: evidenceDecision.truth` · `priceTier: priceTierFromLink(...)`).
   * 🔴 샵 대표가 아닌 행에는 **둘 다 없다**(`null`) — 운영도 그 행의 tier 를 만들지 않는다.
   */
  matchTruth: string | null;
  tier: string | null;
  /** 🟢 파생이 아니라 **기록** 이다 — `tier` 가 EXACT|COMPARISON 일 때만 참. */
  priceEligible: boolean;
  /** 🟢 **게이트 전에 이미 계산돼 있던** 값이다(여기서 판정하지 않는다). */
  verdict: string | null;
  matchLevel: string | null;
  blockers: string[];
  conflicts: string[];
  market: string | null;
  price: number | null;
  currency: string | null;
  priceStatus: string | null;
  /**
   * 🔵🔵 PRICE-POLICY-CONDITIONAL-AUDIT-01 — **TEXT_CONFIRMED 7건을 가를 Evidence.**
   *    🔴 새로 크롤링하지 않는다 — 후보가 **이미 들고 있는** 칸을 그대로 적는다
   *       (`candidate.facts` · `crossSellerReasons`).
   */
  title: string | null;
  reasons: string[];
  f_brand: string | null;
  f_code: string | null;
  f_color: string | null;
  f_material: string | null;
  f_fit: string | null;
  f_tokens: string[];
  f_images: number;
}

describe("DIF-02 — Human SAME recovery funnel (새 Search 0)", () => {
  it.runIf(LIVE)(
    "GT URL 하나하나가 어느 칸에서 멈추는지 적는다",
    async () => {
      const gt = loadGt();
      /** 🔴 DIF-03 — 라벨을 **상품 키** 로도 색인한다(1차 하니스가 여기서 틀렸다). */
      const gtByProduct = new Map<string, { origin: string; url: string; human: string; src: string }>();
      for (const g of gt.values()) if (!gtByProduct.has(productKey(g.url))) gtByProduct.set(productKey(g.url), g);
      const rows: Row[] = [];
      /* eslint-disable no-console */

      for (const origin of ORIGINS) {
        const mine = [...gt.values()].filter((g) => g.origin === origin.code);
        if (mine.length === 0) continue;

        /* ── ① 원상품을 «운영 경로» 로 추출한다 ── */
        const r = await shopifySiteStrategy.extract(origin.url);
        expect(r, `원상품 추출 실패: ${origin.url}`).toBeTruthy();
        const product = buildCanonicalProduct(
          origin.url,
          r!.productData as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        );
        const dna = buildProductIdentityDna(product);
        console.log(
          `\n━━ ${origin.code} — brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} color=${dna.color} · GT ${mine.length}건`,
        );
        /** 🔴 원상품 brand 가 비면 모든 후보가 BRAND_UNCONFIRMED 가 된다(WU-133 사슬의 머리). */
        expect(dna.brand.value, "🔴 원상품 brand 공백 — 이 실행의 모든 판정이 왜곡된다").toBeTruthy();

        const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          searchTerm: terms[0] ?? dna.title,
          searchTerms: terms,
          facts: productFactsFromIdentityDna(dna),
        };

        /* ── ② 후보 풀(🔴 Search 가 아니다 — CEO 가 라벨한 URL 을 넣는다) ── */
        const pool = await collectUrlCandidatePool({
          urls: mine.map((g) => g.url),
          originUrl: dna.sourceUrl,
          maxUrls: mine.length,
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        });
        /** 🔴 열화된 실행으로 funnel 을 내지 않는다(「측정불가」≠「0」· WU-133 게이트). */
        expect(
          pool.metrics.usableProductUrls,
          `열화된 실행(${pool.metrics.usableProductUrls}/${mine.length}) — 재실행 필요`,
        ).toBeGreaterThan(mine.length / 3);

        /**
         * 🔴 풀에서 떨어진 URL 의 **사유** 를 들고 간다. 이것 없이 `NOT_IN_POOL` 만 적으면
         *    「Crawl 문제」와 「Evidence 문제」를 가를 수 없다(CPO §6 의 분기 조건).
         */
        const dropReason = new Map<string, string>();
        for (const d of pool.metrics.dropped ?? []) dropReason.set(loose(d.url), d.reason);

        const seenUrl = new Set<string>();
        for (const res of pool.searchResults) {
          if (res.status !== "ok" || res.candidates.length === 0) continue;
          const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          if (notSelf.length === 0) continue;
          const scored = withConfidence(query, notSelf);
          let priced: ComparisonCandidate[] = scored;
          try {
            priced = await enrichCandidatePrices(scored, res.domain, query);
          } catch {
            /* 운영과 같다 */
          }
          /** 🔴 ⑧ 게이트를 **따로** 부른다 — 전/후를 가르기 위해서다(CPO §3). */
          const gatePassed = isEvidenceEvaluationWorthwhile(priced, dna.brandModelCode, res.domain);
          const j = await judgeDomesticCandidate({
            domain: res.domain,
            candidates: priced,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
          });
          for (const c of priced) {
            const k = productKey(c.url);
            seenUrl.add(k);
            const g = gtByProduct.get(k);
            const isBest = j.kind === "JUDGED" && productKey(j.best.url) === k;
            const m = classifyCandidateMarket({
              domain: res.domain,
              currency: c.price?.currency ?? null,
              isRegisteredDomesticShop: false,
              marketEvidence: c.marketEvidence ?? null,
            });
            rows.push({
              origin: origin.code,
              url: c.url,
              domain: res.domain,
              human: g?.human ?? "(라벨없음)",
              inPool: true,
              gatePassed,
              stopAt: !gatePassed ? "GATE_DROPPED" : isBest ? "JUDGED" : "NOT_SHOP_BEST",
              verdict: c.crossSellerVerdict ?? null,
              matchLevel: c.matchLevel ?? null,
              blockers: (c.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
              conflicts: (c.crossSellerConflicts ?? []).map((x) => (typeof x === "string" ? x : x.conflict)),
              market: m.market,
              price: c.price?.amount ?? null,
              currency: c.price?.currency ?? null,
              priceStatus: c.priceStatus ?? null,
              dropReason: null,
              title: c.title ?? null,
              reasons: c.crossSellerReasons ?? [],
              f_brand: c.facts?.brand ?? null,
              f_code: c.facts?.brandModelCode ?? null,
              f_color: c.facts?.colorText ?? null,
              f_material: c.facts?.materialText ?? null,
              f_fit: c.facts?.fitText ?? null,
              f_tokens: c.facts?.coreTitleTokens ?? [],
              f_images: c.facts?.imageUrls?.length ?? 0,
              /** 🔴 샵 대표만 운영이 tier 를 만든다 — 나머지는 `null`(지어내지 않는다). */
              matchTruth: j.kind === "JUDGED" && isBest ? j.matchTruth : null,
              tier: j.kind === "JUDGED" && isBest ? j.priceTier : null,
              priceEligible:
                j.kind === "JUDGED" && isBest && (j.priceTier === "EXACT" || j.priceTier === "COMPARISON"),
            });
          }
        }
        /** 🔴 풀에 아예 못 들어온 URL 도 **적는다**(0 으로 만들지 않는다). */
        for (const g of mine)
          if (!seenUrl.has(productKey(g.url)))
            rows.push({
              origin: origin.code,
              url: g.url,
              domain: (() => {
                try {
                  return new URL(g.url).hostname;
                } catch {
                  return "?";
                }
              })(),
              human: g.human,
              inPool: false,
              gatePassed: null,
              stopAt: "NOT_IN_POOL",
              verdict: null,
              matchLevel: null,
              blockers: [],
              conflicts: [],
              market: null,
              price: null,
              currency: null,
              priceStatus: null,
              dropReason: dropReason.get(loose(g.url)) ?? "(기록없음)",
              title: null,
              reasons: [],
              f_brand: null,
              f_code: null,
              f_color: null,
              f_material: null,
              f_fit: null,
              f_tokens: [],
              f_images: 0,
              matchTruth: null,
              tier: null,
              priceEligible: false,
            });
      }

      /* ── ③ 보고 — 🔴 분모를 같이 적는다 ── */
      const n = rows.length;
      const stop = (s: StopAt) => rows.filter((r) => r.stopAt === s).length;
      console.log(
        `\n【FUNNEL】 GT ${n}  →  풀 진입 ${rows.filter((r) => r.inPool).length}/${n}` +
          `  →  ⑧ 통과 ${rows.filter((r) => r.gatePassed === true).length}` +
          `  →  샵 대표 ${stop("JUDGED")}`,
      );
      console.log(
        `   멈춘 칸 — NOT_IN_POOL ${stop("NOT_IN_POOL")} · GATE_DROPPED ${stop("GATE_DROPPED")}` +
          ` · NOT_SHOP_BEST ${stop("NOT_SHOP_BEST")} · JUDGED ${stop("JUDGED")}`,
      );

      /** 🔴 **왜** 풀에 못 들어왔는가 — 이것 없이는 Crawl 문제와 Evidence 문제를 못 가른다. */
      const notIn = rows.filter((r) => r.stopAt === "NOT_IN_POOL");
      const why: Record<string, number> = {};
      for (const r of notIn) why[r.dropReason ?? "?"] = (why[r.dropReason ?? "?"] ?? 0) + 1;
      console.log(`   NOT_IN_POOL 사유 — ${JSON.stringify(why)}`);

      /** 🔴🔴 CPO §11 의 그 표 — Human SAME 이 **무엇으로** 끝났는가. */
      const sameRows = rows.filter((r) => r.human === "SAME");
      const bucket = (r: Row) => (r.stopAt === "JUDGED" ? (r.verdict ?? "(판정없음)") : r.stopAt);
      const dist: Record<string, number> = {};
      for (const r of sameRows) dist[bucket(r)] = (dist[bucket(r)] ?? 0) + 1;
      console.log(`\n【Human SAME ${sameRows.length}건의 행방】`);
      for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`   ${k.padEnd(16)} ${v}`);

      /** 🔴 Negative 도 같이 본다 — recall 만 보면 FP 가 숨는다. */
      const diffRows = rows.filter((r) => r.human === "DIFFERENT");
      const leaked = diffRows.filter((r) => r.stopAt === "JUDGED" && (r.verdict === "SAME" || r.verdict === "PRESUMED_SAME"));
      console.log(`\n【Human DIFFERENT ${diffRows.length}건】 SAME/PRESUMED 로 누출 ${leaked.length}`);
      for (const r of leaked) console.log(`   🔴 ${r.domain} ${r.verdict} ${r.price ?? "-"}${r.currency ?? ""}`);

      /** 🔴🔴 CPO §4-A — **false negative 후보**(Human SAME 인데 SAME/PRESUMED 가 아니다). */
      const fn = sameRows.filter((r) => !(r.verdict === "SAME" || r.verdict === "PRESUMED_SAME"));
      console.log(`\n【false negative 후보 ${fn.length}건 — 최대 10】`);
      for (const r of fn.slice(0, 10))
        console.log(
          `   ${r.domain.padEnd(26)} stop=${r.stopAt.padEnd(14)} verdict=${String(r.verdict).padEnd(14)}` +
            ` lvl=${String(r.matchLevel).padEnd(9)} blk=[${r.blockers.join(",")}] cfl=[${r.conflicts.join(",")}]`,
        );

      /** 🟢 가격 — SAME/PRESUMED 후보에 실제 금액이 붙는가(CPO §8). */
      const strong = rows.filter((r) => r.stopAt === "JUDGED" && (r.verdict === "SAME" || r.verdict === "PRESUMED_SAME"));
      /**
       * 🔴🔴 PRICE-ELIGIBILITY-AUDIT-01A — **두 축을 가른다**(CPO §2).
       *    `priceAmountPresent` = 그 후보 페이지에서 금액을 읽었다
       *    `priceEligible`      = tier 가 EXACT|COMPARISON 이라 **집계에 들어간다**
       */
      const eligible = strong.filter((r) => r.priceEligible);
      console.log(
        `\n【가격 — 두 축】 SAME/PRESUMED ${strong.length}` +
          `  priceAmountPresent ${strong.filter((r) => r.price != null).length}` +
          `  🔴 priceEligible ${eligible.length}` +
          `  그중 금액 보유 ${eligible.filter((r) => r.price != null).length}`,
      );
      /** 🔴 blocker × human × 가격 — 이 표가 다음 정책 결정의 입력이다. */
      const byBlocker = new Map<string, { all: number; same: number; diff: number; priced: number; elig: number }>();
      for (const r of rows.filter((x) => x.verdict === "SAME" || x.verdict === "PRESUMED_SAME")) {
        for (const b of r.blockers.length ? r.blockers : ["(blocker 없음)"]) {
          const e = byBlocker.get(b) ?? { all: 0, same: 0, diff: 0, priced: 0, elig: 0 };
          e.all += 1;
          if (r.human === "SAME") e.same += 1;
          if (r.human === "DIFFERENT") e.diff += 1;
          if (r.price != null) e.priced += 1;
          if (r.priceEligible) e.elig += 1;
          byBlocker.set(b, e);
        }
      }
      /**
       * 🔵🔵🔵 MATCH-TRUTH-PRICE-ELIGIBILITY-AUDIT-01 — **판단축은 blocker 가 아니라
       *    `matchTruth` 다**(PE-01A 의 반증). 그래서 그 축으로 먼저 센다.
       * 🔴 분모는 **판정이 난 행 전수** 다(SAME/PRESUMED 로 좁히지 않는다) —
       *    CONFLICT·SIMILAR 가 어디로 가는지도 같이 봐야 누출을 설명할 수 있다.
       */
      type Cell = { all: number; same: number; diff: number; priced: number; elig: number };
      const tally = (key: (r: Row) => string | null, src: Row[]) => {
        const m = new Map<string, Cell>();
        for (const r of src) {
          const k = key(r);
          if (k === null) continue;
          const e = m.get(k) ?? { all: 0, same: 0, diff: 0, priced: 0, elig: 0 };
          e.all += 1;
          if (r.human === "SAME") e.same += 1;
          if (r.human === "DIFFERENT") e.diff += 1;
          if (r.price != null) e.priced += 1;
          if (r.priceEligible) e.elig += 1;
          m.set(k, e);
        }
        return m;
      };
      const pct = (n: number, d: number) => (d === 0 ? "  -  " : `${String(Math.round((100 * n) / d)).padStart(3)}%`);
      /** 🔴 샵 대표가 아닌 행은 `matchTruth` 가 **없다** — 분모에서 뺀다(지어내지 않는다). */
      const judged = rows.filter((r) => r.matchTruth !== null);
      console.log(`\n【B. matchTruth × human × 가격】 분모 ${judged.length}(샵 대표만 · 나머지는 matchTruth 없음)`);
      console.log("  matchTruth              전체 hSAME hDIFF  금액  자격   자격률  SAME정밀  DIFF누출");
      for (const [k, e] of [...tally((r) => r.matchTruth, judged).entries()].sort((a, z) => z[1].all - a[1].all))
        console.log(
          `  ${k.padEnd(22)} ${String(e.all).padStart(4)} ${String(e.same).padStart(5)} ${String(e.diff).padStart(5)}` +
            ` ${String(e.priced).padStart(5)} ${String(e.elig).padStart(5)}   ${pct(e.elig, e.all)}    ${pct(e.same, e.same + e.diff)}    ${pct(e.diff, e.same + e.diff)}`,
        );
      /** 🔴 같은 matchTruth 안에서 blocker 가 자격을 왜곡하는가 — 그것이 §6 의 질문이다. */
      console.log("\n【C. matchTruth × blocker】 (샵 대표 전수)");
      console.log("  matchTruth              blocker                       전체 hSAME hDIFF  금액  자격");
      const pairs = new Map<string, Cell>();
      for (const r of judged)
        for (const b of r.blockers.length ? r.blockers : ["(blocker 없음)"]) {
          const k = `${r.matchTruth}|${b}`;
          const e = pairs.get(k) ?? { all: 0, same: 0, diff: 0, priced: 0, elig: 0 };
          e.all += 1;
          if (r.human === "SAME") e.same += 1;
          if (r.human === "DIFFERENT") e.diff += 1;
          if (r.price != null) e.priced += 1;
          if (r.priceEligible) e.elig += 1;
          pairs.set(k, e);
        }
      for (const [k, e] of [...pairs.entries()].sort((a, z) => z[1].all - a[1].all)) {
        const [mt, b] = k.split("|");
        console.log(
          `  ${String(mt).padEnd(22)} ${String(b).padEnd(29)} ${String(e.all).padStart(4)} ${String(e.same).padStart(5)} ${String(e.diff).padStart(5)} ${String(e.priced).padStart(5)} ${String(e.elig).padStart(5)}`,
        );
      }
      /** 🔴 §7·§8·§9 — 지목된 세 그룹을 **행 단위로** 전부 찍는다(집계로 뭉개지 않는다). */
      for (const want of ["MODEL_CODE_AGE_LINE", "AUDIENCE_LINE", "NO_TITLE_OVERLAP"]) {
        const g = judged.filter((r) => r.blockers.includes(want));
        console.log(`\n【D. ${want}】 ${g.length}건 — 행 전수`);
        for (const r of g)
          console.log(
            `    ${r.domain.padEnd(24)} human=${r.human.padEnd(10)} verdict=${String(r.verdict).padEnd(14)}` +
              ` truth=${String(r.matchTruth).padEnd(18)} tier=${String(r.tier).padEnd(11)} elig=${String(r.priceEligible).padEnd(5)} ${r.price ?? "-"}${r.currency ?? ""}`,
          );
      }
      /** 🔴 §7 — Human DIFFERENT 누출을 **전 칸과 함께** 적는다. */
      console.log("\n【E. Human DIFFERENT 누출 — 전 칸】");
      for (const r of judged.filter((x) => x.human === "DIFFERENT" && x.priceEligible))
        console.log(
          `    🔴 ${r.domain} | verdict=${r.verdict} | truth=${r.matchTruth} | tier=${r.tier} | elig=${r.priceEligible}` +
            ` | blockers=[${r.blockers.join(",")}] | ${r.price}${r.currency} | ${r.url}`,
        );
      /** 🔴 §10 — CONFLICT(세트 포함)가 가격 축에 **들어가지 않는다** 를 숫자로 적는다. */
      /**
       * 🔵🔵🔵 PP-01 §3 — **TEXT_CONFIRMED 모집단 전수.** 집계로 뭉개지 않는다.
       * 🔴 분모는 **샵 대표(matchTruth 가 있는 행)** 다 — 그것이 가격 축의 분모다.
       */
      const tc = rows.filter((r) => r.matchTruth === "TEXT_CONFIRMED");
      console.log(`\n【PP-01 A】 TEXT_CONFIRMED 모집단 **${tc.length}건** 전수`);
      for (const r of tc) {
        console.log(
          `\n  ── ${r.domain}  human=${r.human}  verdict=${r.verdict}  tier=${r.tier}  elig=${r.priceEligible}  ${r.price ?? "-"}${r.currency ?? ""}  ${r.market}`,
        );
        console.log(`     title   ${String(r.title).slice(0, 88)}`);
        console.log(
          `     facts   brand=${JSON.stringify(r.f_brand)} code=${JSON.stringify(r.f_code)} color=${JSON.stringify(r.f_color)}`,
        );
        console.log(
          `             material=${JSON.stringify(String(r.f_material).slice(0, 40))} fit=${JSON.stringify(r.f_fit)} images=${r.f_images}`,
        );
        console.log(`     tokens  [${r.f_tokens.join(" ")}]`);
        console.log(`     blk=[${r.blockers.join(",")}] cfl=[${r.conflicts.join(",")}]`);
        console.log(`     reasons ${JSON.stringify(r.reasons)}`);
      }
      /** 🔴 §6 — **기존 필드만** 으로 분리 조건을 탐색한다(새 matcher 0 · 새 threshold 0). */
      const axisCount = (r: Row) => r.reasons.filter((x) => x.startsWith("근거")).length;
      console.log("\n【PP-01 D】 기존 필드 후보 — 값이 실제로 갈리는 것만 적는다");
      console.log("  seller                   human      근거수  brand  code   color   material  images  blk");
      for (const r of tc)
        console.log(
          `  ${r.domain.padEnd(24)} ${r.human.padEnd(10)} ${String(axisCount(r)).padStart(5)}` +
            `  ${r.f_brand ? "O" : "X"}      ${r.f_code ? "O" : "X"}     ${r.f_color ? "O" : "X"}       ${r.f_material ? "O" : "X"}       ${String(r.f_images).padStart(2)}    [${r.blockers.join(",")}]`,
        );
      const conflictRows = rows.filter((r) => r.verdict === "CONFLICT");
      console.log(
        `\n【F. CONFLICT ${conflictRows.length}건 — 가격 자격 ${conflictRows.filter((r) => r.priceEligible).length}` +
          `  (COMPOSITION 포함 ${conflictRows.filter((r) => r.conflicts.includes("COMPOSITION")).length}건)】`,
      );

      console.log("\n【blocker × human × 가격】 SAME/PRESUMED 후보 전수");
      console.log("  blocker                       전체 hSAME hDIFF  금액  가격자격");
      for (const [b, e] of [...byBlocker.entries()].sort((a, z) => z[1].all - a[1].all))
        console.log(
          `  ${b.padEnd(29)} ${String(e.all).padStart(4)} ${String(e.same).padStart(5)} ${String(e.diff).padStart(5)} ${String(e.priced).padStart(5)} ${String(e.elig).padStart(8)}`,
        );
      console.log(
        `\n【참고 · 기존 줄】 SAME/PRESUMED ${strong.length}건 중 금액 보유 ${strong.filter((r) => r.price != null).length}` +
          ` · VERIFIED ${strong.filter((r) => r.priceStatus === "VERIFIED_CURRENT").length}` +
          ` · 🇰🇷 ${strong.filter((r) => r.market === "KR").length} · 🌎 ${strong.filter((r) => r.market === "OVERSEAS").length}`,
      );

      mkdirSync(OUTDIR, { recursive: true });
      writeFileSync(path.join(OUTDIR, "dif-02-funnel.json"), JSON.stringify(rows, null, 2));
      console.log(`\n산출 → ${path.join(OUTDIR, "dif-02-funnel.json")}`);
      expect(rows.length).toBeGreaterThan(0);
    },
    1_200_000,
  );
});
