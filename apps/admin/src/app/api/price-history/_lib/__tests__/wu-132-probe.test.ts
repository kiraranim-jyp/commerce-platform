/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 — **E2E 실측 하니스** (게이트 없으면 SKIP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 게이트 `WU_132_PROBE=1` 없으면 **SKIP** 한다(회귀에서 외부 HTTP 금지).
 * 🔴 DB 쓰기 0 · AI 0 · Gemini 0 · 새 provider 0 · schema 0.
 *
 * 🔴🔴 **운영 호출 순서를 그대로 베낀다**(헌장 §5-B · WU-130 probe 와 같은 규약).
 *    로컬에 service-role 이 없어 `runDomesticPriceCheck` 전체를 부를 수 없으므로
 *    **등록부만 DB 덤프로 주입** 하고 나머지는 운영 함수를 같은 순서로 부른다:
 * ```
 * 🌎 collectOverseasAutoPool → judgeDomesticCandidate → priceTierFromLink
 *                            → classifyCandidateMarket
 * 🔁 collectUrlCandidatePool(shopId = REVIEWED_SAME_SHOP_ID)   ← WU-132 ⑥ 신규
 *                            → 같은 판정 사슬
 * 📊 selectMiSameCandidates(rows, "KR" | "OVERSEAS")            ← WU-132 ①② 신규
 * ```
 *
 * 🔴 선행 덤프(`packages/database` 에서):
 *    `node --env-file=.env scripts/mi-010-comparison-shops-dump.mjs`
 *    `node --env-file=.env scripts/wu-130-snapshot-dump.mjs`
 *    `node --env-file=.env scripts/wu-132-review-dump.mjs`
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
/**
 * 🔴 운영이 transient pool 소비 루프에서 쓰는 **그 세 함수** 를 같이 가져온다
 *    (`isSelfReferenceCandidate` → `withConfidence` → `enrichCandidatePrices`).
 *    빠뜨리면 `priceStatus` 가 비어 **거짓 0건** 이 나온다(1차에 실제로 났다).
 */
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildCrossSellerSearchQueries,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { collectOverseasAutoPool } from "../overseas-auto-pool";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate, MAX_SUPPLIED_CANDIDATE_URLS } from "../run-domestic-price-check";
import { classifyCandidateMarket } from "../candidate-market";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME, isTransientShopId } from "../transient-candidates";
import {
  selectMiSameCandidates,
  transientDisplayTier,
} from "../../../../pipeline/commerce/mi-same-candidates";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

const LIVE = process.env.WU_132_PROBE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const read = <T>(f: string): T => {
  const p = path.join(OUT, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${f}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};
/* eslint-disable no-console */
const log = (s: string) => console.log(s);

interface Snap {
  id: string;
  source_url: string;
  title: string;
  workspace_id: string;
  workspace: Record<string, unknown>;
}
interface ShopRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  access_status: string | null;
  category_scope: string[] | null;
}
interface ReviewDump {
  rows: { origin_code: string | null; candidate_url: string; human_verdict: string | null }[];
  sameUrls: string[];
}

const SCOPES = ["KIDS_FASHION"];

function buildQuery(snap: Snap) {
  const product = backfillCanonicalProduct(
    (snap.workspace as { canonicalProduct: unknown }).canonicalProduct as never,
  );
  const dna = buildProductIdentityDna(product);
  const searchTerms = buildCrossSellerSearchQueries(dna).filter(Boolean);
  return {
    dna,
    query: {
      title: dna.title,
      brand: dna.brand.value || undefined,
      sourceUrl: dna.sourceUrl,
      sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
      searchTerm: searchTerms[0] ?? dna.title,
      searchTerms,
      facts: productFactsFromIdentityDna(dna),
    },
  };
}

/**
 * 🔴 **sink 가 만드는 그 행을 그대로 만든다**(run-domestic-price-check 의 push 블록).
 *    🔴 지어내는 값 0 — 전부 판정 산출이거나 후보가 들고 온 값이다.
 */
function toRow(
  source: GeminiTransientRow["source"],
  domain: string,
  j: Awaited<ReturnType<typeof judgeDomesticCandidate>> & { kind: "JUDGED" },
): GeminiTransientRow {
  const tier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
  const m = classifyCandidateMarket({
    domain,
    currency: j.best.price?.currency ?? null,
    isRegisteredDomesticShop: false,
  });
  return {
    source,
    domain,
    title: j.best.title,
    imageUrl: j.best.imageUrl ?? null,
    soldOut: j.best.soldOut ?? null,
    discoveredUrl: j.best.url,
    matchTruth: j.matchTruth,
    priceTier: tier,
    crossSellerVerdict: j.best.crossSellerVerdict ?? null,
    confidence: j.best.confidence ?? null,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: j.best.price?.amount ?? null,
    priceCurrency: j.best.price?.currency ?? null,
    priceStatus: j.best.priceStatus ?? null,
    market: m.market,
    basis: m.basis,
  };
}

describe("WU-132 E2E 실측 — MI SAME → 가격비교 / 재투입", () => {
  it.runIf(LIVE)(
    "①② 선별과 ⑥ 재투입이 운영 경로에서 작동한다",
    async () => {
      const two = read<{ s1: Snap | null; s2: Snap | null }>("wu130-two.json");
      const shopRows = read<ShopRow[]>("wu010-comparison-shops.json");
      const reviews = read<ReviewDump>("wu-132-reviews.json");

      /** 🔴 재투입 대상은 **원상품 축(origin_code)** 으로 고른다 — 다른 상품의 SAME 을
       *  끌어오면 그 자체가 오염이다(부분 유니크가 둘인 이유 · WU-131 계약 ⒝). */
      const sameByOrigin = new Map<string, string[]>();
      for (const r of reviews.rows) {
        if (r.human_verdict !== "SAME" || !r.origin_code) continue;
        const list = sameByOrigin.get(r.origin_code) ?? [];
        list.push(r.candidate_url);
        sameByOrigin.set(r.origin_code, list);
      }
      log(
        `\n📚 검토 이력 — 전체 ${reviews.rows.length}행 · SAME ${reviews.sameUrls.length} · ` +
          `원상품축 ${[...sameByOrigin.entries()].map(([k, v]) => `${k}:${v.length}`).join(" ")}`,
      );

      for (const [label, snap] of [
        ["S1 b226ac042", two.s1],
        ["S2 b226ac009", two.s2],
      ] as const) {
        if (!snap) {
          log(`\n══ ${label} — 🔴 스냅샷 없음(측정불가)`);
          continue;
        }
        const { dna, query } = buildQuery(snap);
        const originCode = dna.brandModelCode ? dna.brandModelCode.toUpperCase() : null;
        log(`\n══ ${label} · ${snap.title}`);
        log(`   originCode=${originCode ?? "null"}`);

        const rows: GeminiTransientRow[] = [];

        /* ───────────── 🌎 해외 자동검색(기존 경로 · 불변) ───────────── */
        const pool = await collectOverseasAutoPool({
          query,
          categoryScopes: SCOPES,
          listShops: async () =>
            shopRows.map((r) => ({
              id: r.id,
              name: r.name,
              domain: r.domain,
              url: r.url,
              country: r.country,
              currency: r.currency,
              categoryScope: r.category_scope ?? [],
              accessStatus: r.access_status,
              accessNote: null,
              role: null,
              operatorKey: null,
              source: "SYSTEM",
              isActive: r.is_active,
              createdAt: "",
            })) as never,
        });
        log(`   🌎 metrics=${JSON.stringify(pool.metrics)}`);
        for (const r of pool.searchResults) expect(isTransientShopId(r.shopId)).toBe(true);
        for (const result of pool.searchResults) {
          if (result.status !== "ok" || result.candidates.length === 0) continue;
          const j = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: result.candidates,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
          });
          if (j.kind !== "JUDGED") continue;
          rows.push(toRow("OVERSEAS_AUTO", result.domain, j));
        }

        /* ───────────── 🔁 ⑥ 이전 판단 재투입 (WU-132 신규) ───────────── */
        const reuse = originCode ? (sameByOrigin.get(originCode) ?? []) : [];
        log(`   🔁 재투입 대상 ${reuse.length}건`);
        if (reuse.length > 0) {
          const already = new Set(
            rows.map((r) => r.discoveredUrl.toLowerCase().replace(/[?#].*$/, "")),
          );
          const reviewedPool = await collectUrlCandidatePool({
            urls: reuse,
            originUrl: query.sourceUrl,
            maxUrls: MAX_SUPPLIED_CANDIDATE_URLS,
            existingCanonicalUrls: already,
            shopId: REVIEWED_SAME_SHOP_ID,
            shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
          });
          log(`   🔁 metrics=${JSON.stringify(reviewedPool.metrics)}`);
          /** 🔴🔴 **산출물에 등록부 uuid 가 남으면 저장 오염이다.** */
          for (const r of reviewedPool.searchResults) {
            expect(r.shopId).toBe(REVIEWED_SAME_SHOP_ID);
            expect(isTransientShopId(r.shopId)).toBe(true);
          }
          for (const result of reviewedPool.searchResults) {
            if (result.status !== "ok" || result.candidates.length === 0) continue;
            /**
             * 🔴🔴 **운영은 여기서 두 단계를 «더» 한다**(`for (const r of transientPools)`):
             * ```
             * isSelfReferenceCandidate 제거 → withConfidence → enrichCandidatePrices
             * ```
             * 🔴 1차 하니스가 이 둘을 빠뜨려 `priceStatus` 가 **전건 `-`** 로 나왔고,
             *    그대로 보고했으면 「MI SAME 인데 가격 미확인이라 0건」이라는 **거짓 결론**
             *    이었다. 🟢 §5-B 가 막으라고 한 바로 그 실수다 — 순서를 그대로 베낀다.
             */
            const notSelf = result.candidates.filter(
              (c) => !isSelfReferenceCandidate(query.sourceUrl, c.url),
            );
            const scored = withConfidence(query, notSelf);
            let priced = scored;
            try {
              priced = await enrichCandidatePrices(scored, result.domain, query);
            } catch {
              /* 🔴 보강 실패는 점수만 있는 후보로 계속 간다(운영과 같다). */
            }
            const j = await judgeDomesticCandidate({
              domain: result.domain,
              candidates: priced,
              sourceUrl: query.sourceUrl,
              foreignModelCode: dna.brandModelCode,
              foreignColor: dna.color,
              fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
            });
            if (j.kind !== "JUDGED") {
              log(`   🔁 ${result.domain} → ${j.kind}${"gate" in j ? `/${j.gate}` : ""}`);
              continue;
            }
            rows.push(toRow("REVIEWED_SAME", result.domain, j));
          }
        }

        /* ───────────── 📊 ①② 선별 (WU-132 신규) ───────────── */
        log(`   ── 후보 ${rows.length}건 전수 ──`);
        for (const r of rows) {
          log(
            `     ${(r.source ?? "?").padEnd(14)} ${r.domain.padEnd(24)} tier=${transientDisplayTier(r) ?? "null"} ` +
              `truth=${r.matchTruth ?? "null"} ${r.priceCurrency ?? "-"} ${r.priceAmount ?? "-"} ` +
              `${r.priceStatus ?? "-"} market=${r.market} stock=${String(r.soldOut)} img=${r.imageUrl ? "Y" : "N"}`,
          );
        }
        for (const market of ["KR", "OVERSEAS"] as const) {
          const sel = selectMiSameCandidates(rows, market);
          log(
            `   📊 ${market} — 가격비교 ${sel.priced.length}건 ` +
              `[${sel.priced.map((r) => `${r.domain} ${r.priceCurrency} ${r.priceAmount}`).join(" · ")}] ` +
              `· SAME 이지만 제외 ${sel.sameButExcluded.length}건 ` +
              `[${sel.sameButExcluded.map((x) => `${x.row.domain}:${x.reason}`).join(" · ")}]`,
          );
          /** 🔴 올라간 후보는 **세 축을 전부** 통과했어야 한다(선별기 계약의 실데이터 확인). */
          for (const r of sel.priced) {
            expect(transientDisplayTier(r)).toBe("SAME");
            expect(r.soldOut).not.toBe(true);
            expect(r.priceStatus).toBe("VERIFIED_CURRENT");
            expect(r.market).toBe(market);
          }
        }
      }
    },
    900_000,
  );
});
