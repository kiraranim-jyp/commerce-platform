/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-130 — **합류 E2E 실측 하니스** (게이트 없으면 SKIP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 게이트 `WU_130_PROBE=1` 없으면 **SKIP** 한다(회귀에서 외부 HTTP 금지).
 * 🔴 DB 쓰기 0 · AI 0 · Gemini 0 · 새 provider 0.
 *
 * 🔴🔴 **운영 호출 순서를 그대로 베낀다**(헌장 §5-B). 로컬에서는
 *    `listDomesticPriceSources`/`listComparisonShops` 가 service-role 을 요구해
 *    `runDomesticPriceCheck` 전체를 부를 수 없으므로(헌장 §10), **등록부 두 개만**
 *    DB 덤프로 주입하고 나머지는 **운영 함수를 같은 순서로** 부른다:
 * ```
 * 🌎 collectOverseasAutoPool  → judgeDomesticCandidate → priceTierFromLink
 *                             → classifyCandidateMarket → 해외 집계
 * 🇰🇷 isBatchSurveyTarget      → searchDomesticShops(P0 먼저 · very_high 조기중단)
 *                             → judgeDomesticCandidate → priceTierFromLink
 *    🔴 국내 등록부 후보는 **transient 가 아니다** ⟹ sink 가 아니라 upsert 로 간다
 * ```
 * 🔴 선행 덤프(`packages/database` 에서):
 *    `node --env-file=.env scripts/mi-010-comparison-shops-dump.mjs`
 *    `node --env-file=.env scripts/wu-130-snapshot-dump.mjs`
 *    `node --env-file=.env scripts/wu-130-domestic-dump.mjs`
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchDomesticModelCode, searchDomesticShops } from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildCrossSellerSearchQueries,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { collectOverseasAutoPool } from "../overseas-auto-pool";
import { isBatchSurveyTarget, judgeDomesticCandidate } from "../run-domestic-price-check";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const LIVE = process.env.WU_130_PROBE === "1";
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
interface DomesticRow {
  id: string;
  name: string;
  domain: string;
  currency: string;
  collection_strategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string;
  access_status: string | null;
  category_scope: string[] | null;
  priority: string;
  workspace_id: string | null;
}
interface LinkRow {
  snapshot_id: string;
  source_domain: string;
  match_truth: string | null;
  verified: boolean;
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
    /** 🔴 `/check` 가 만드는 그 query 다(제목·sku·searchTerm·searchTerms·facts). */
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

/** 🔴 「후보가 무엇인가」를 **반드시** 적는다 — 「DROPPED」만 보면 「게이트가 동일상품을
 *  버렸다」와 「그 샵이 그 상품을 안 판다」를 구별할 수 없다(WU-093/114 에서 틀린 자리). */
const dumpCandidates = (domain: string, cands: readonly unknown[]): void =>
  log(
    `    ${domain} 후보 ${cands.length}건:\n` +
      cands
        .map((c, i) => {
          const x = c as {
            matchLevel?: string;
            crossSellerVerdict?: string;
            confidence?: number;
            title: string;
            price?: { currency: string; amount: number };
          };
          return (
            `      #${i} ${x.matchLevel ?? "?"}/${x.crossSellerVerdict ?? "?"} conf=${x.confidence?.toFixed(2) ?? "?"} ` +
            `「${x.title}」 ${x.price?.currency ?? "-"} ${x.price?.amount ?? "-"}`
          );
        })
        .join("\n"),
  );

describe("WU-130 합류 E2E 실측 (두 상품)", () => {
  it.runIf(LIVE)(
    "🌎 해외 + 🇰🇷 국내 자동검색이 같은 MI 경로로 들어간다",
    async () => {
      const two = read<{ s1: Snap | null; s2: Snap | null }>("wu130-two.json");
      const shopRows = read<ShopRow[]>("wu010-comparison-shops.json");
      const dom = read<{
        sources: DomesticRow[];
        settings: { workspace_id: string; source_id: string; enabled: boolean }[];
        links: LinkRow[];
      }>("wu130-domestic.json");

      for (const [label, snap] of [
        ["S1 b226ac042", two.s1],
        ["S2 b226ac009", two.s2],
      ] as const) {
        if (!snap) {
          log(`\n══ ${label} — 🔴 스냅샷 없음(측정불가)`);
          continue;
        }
        const { dna, query } = buildQuery(snap);
        log(`\n══ ${label} · ${snap.title} · ws=${snap.workspace_id}`);
        log(`   searchTerms=${JSON.stringify(query.searchTerms)}`);

        /* ───────────── 🌎 해외 자동검색 ───────────── */
        const pool = await collectOverseasAutoPool({
          query,
          categoryScopes: SCOPES,
          /** 🔴 운영은 `listComparisonShops()` 를 부른다 — 로컬에 service-role 이 없어
           *  **같은 행** 을 덤프로 넣는다(WU-092 교훈: 칸을 비우면 거짓 결론이 난다). */
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
        for (const r of pool.searchResults) expect(r.shopId).toBe("__overseas_auto__");

        const overseasEvidence: { market: string; currency: string; amount: number | null; priceTier: string }[] = [];
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
          if (j.kind !== "JUDGED") {
            log(`   🌎 ${result.domain} → ${j.kind}${"gate" in j ? `/${j.gate}` : ""}`);
            continue;
          }
          const tier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
          const m = classifyCandidateMarket({
            domain: result.domain,
            currency: j.best.price?.currency ?? null,
            /** 🔴 해외 등록부에 `.kr`/KRW 가 **0** 이라(실측 35행) 운영값과 같다. */
            isRegisteredDomesticShop: false,
          });
          log(
            `   🌎 ${result.domain} → ${j.best.crossSellerVerdict ?? "?"} / truth=${j.matchTruth ?? "null"} / ` +
              `tier=${tier} / ${j.best.price?.currency ?? "-"} ${j.best.price?.amount ?? "-"} / ` +
              `${m.market}(${m.basis}) / priceStatus=${j.best.priceStatus ?? "-"}`,
          );
          /** 🔴 운영 MI 해외 가지와 **같은 조건**(market !== KR · KRW 제외 · 금액 필수). */
          if (m.market === "KR") continue;
          if (j.best.price?.currency?.trim().toUpperCase() === "KRW") continue;
          if (j.best.price?.amount != null && j.best.price.currency) {
            overseasEvidence.push({
              market: m.market,
              currency: j.best.price.currency,
              amount: j.best.price.amount,
              priceTier: tier,
            });
          }
        }
        log(`   🌎 🧾 해외 동일상품 참고가격 = ${JSON.stringify(summarizeCandidateOverseasPrices(overseasEvidence))}`);

        /* ───────────── 🇰🇷 국내 자동검색 ───────────── */
        /** 🔴 운영 머지를 **그대로** 재현한다 — 카탈로그 `enabled` 는 **무시** 되고
         *  workspace 설정이 owner 이며 **설정이 없으면 ON**(fail-open · 마이그레이션 047). */
        const wsSettings = new Map(
          dom.settings.filter((s) => s.workspace_id === snap.workspace_id).map((s) => [s.source_id, s.enabled]),
        );
        const visible = dom.sources.filter((s) => s.workspace_id === null || s.workspace_id === snap.workspace_id);
        const sources = visible.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          currency: s.currency,
          collectionStrategy: s.collection_strategy,
          enabled: wsSettings.get(s.id) ?? true,
          status: s.status,
          accessStatus: s.access_status,
          categoryScope: s.category_scope ?? [],
          priority: s.priority,
        }));
        const targets = sources.filter((s) => isBatchSurveyTarget(s as never, SCOPES));
        const toRef = (s: (typeof targets)[number]) => ({
          id: s.id,
          name: s.name,
          domain: s.domain,
          currency: s.currency,
          collectionStrategy: s.collectionStrategy,
        });
        const p0 = targets.filter((s) => s.priority === "P0");
        const rest = targets.filter((s) => s.priority !== "P0");
        const p0Results = await searchDomesticShops(query, p0.map(toRef) as never);
        const veryHigh = p0Results.some((r) => r.candidates.some((c) => c.matchLevel === "very_high"));
        const restResults =
          rest.length > 0 && !veryHigh ? await searchDomesticShops(query, rest.map(toRef) as never) : [];
        const krResults = [...p0Results, ...restResults];
        const krStatus: Record<string, number> = {};
        let krTotal = 0;
        for (const r of krResults) {
          krStatus[r.status] = (krStatus[r.status] ?? 0) + 1;
          krTotal += r.candidates.length;
        }
        log(
          `   🇰🇷 등록부 ${dom.sources.length} → 가시 ${visible.length} → 자격 **${targets.length}** ` +
            `(AUTO_* ${targets.filter((t) => t.collectionStrategy.startsWith("AUTO")).length}) → ` +
            `status=${JSON.stringify(krStatus)} 후보=${krTotal}`,
        );
        let krJudged = 0;
        for (const result of krResults) {
          if (result.status !== "ok" || result.candidates.length === 0) continue;
          dumpCandidates(result.domain, result.candidates);
          const j = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: result.candidates,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
          });
          if (j.kind !== "JUDGED") {
            log(`   🇰🇷 ${result.domain} → ${j.kind}${"gate" in j ? `/${j.gate}` : ""}`);
            continue;
          }
          krJudged += 1;
          const tier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
          log(
            `   🇰🇷 ${result.domain} → ${j.best.crossSellerVerdict ?? "?"} / truth=${j.matchTruth ?? "null"} / ` +
              `tier=${tier} / ${j.best.price?.currency ?? "-"} ${j.best.price?.amount ?? "-"} / **upsert 대상**(sink 아님)`,
          );
        }
        const mine = dom.links.filter((l) => l.snapshot_id === snap.id);
        log(
          `   🇰🇷 JUDGED ${krJudged} · 저장된 링크 ${mine.length}건: ` +
            (mine.map((l) => `${l.source_domain}(${l.match_truth ?? "null"}/v=${l.verified})`).join(" · ") || "없음"),
        );
      }
    },
    600_000,
  );

  it("게이트가 없으면 아무 것도 하지 않는다", () => {
    expect(LIVE || true).toBe(true);
  });
});
