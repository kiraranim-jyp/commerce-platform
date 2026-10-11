/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-05 — SAME Product Discovery E2E (CPO 지시, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 HTTP 를 쓴다.
 *
 * **전략 질문:** 실제 Production 상품 1개가 들어왔을 때, 우리가 가진 상품 정보로
 * 동일상품을 충분한 확률로 발견하고 SAME 판정까지 연결할 수 있는가.
 *
 * ── 이 파일이 «새로» 재는 것 두 가지 ───────────────────────────────────────
 * ① 🔴 **origin facts 폴백.** MI-P0-03 에서 smallable 2건이
 *    `factsFromProductUrl`(Light Fetch) 로 `UNREACHABLE` 이라 **Identity 를
 *    아예 못 돌렸다**. 그 2건의 SAME 0 은 Discovery 실패가 «아니라» 우리 쪽
 *    입력 실패다. MI-P0-02i 에서 `universalExtract` 는 같은 URL 을 읽었다.
 *    → Light Fetch 실패 시 `universalExtract` 로 폴백해 7/7 을 판정 가능하게 만든다.
 *    🔴 Production 코드를 바꾸지 «않는다» — 이 하니스 안에서만 폴백한다.
 *       「운영에도 폴백이 필요한가」는 측정 결과로 판단할 일이다.
 *
 * ② 🔴 **known-SAME false negative.** fixture 에 같은 상품이 두 판매처에 있다
 *    (junioredition Main Story ↔ main-story.com). Gemini 가 그 «짝» 을 후보로
 *    돌려주는지 본다. 돌려주지 않으면 Recall 실패이고, 후보 수로는 안 보인다.
 *
 * 🔴 Gemini 를 truth 로 쓰지 않는다. 판정은 `compareCrossSellerProducts` 가 한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { productFactsFromShopifyProduct } from "../../comparison-search/seller-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { universalExtract } from "../../universal-extractor";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

interface Golden { host: string; url: string; brand: string; title: string; code: string | null; color: string | null; material: string }
interface Rec { url: string; level: string; buildable?: boolean; discovered: { url: string; title: string | null }[] }

/**
 * 🔴 `universalExtract` 결과를 `ProductFacts` 로 옮긴다. **새 추출기를 만들지
 *    않는다** — `productFactsFromShopifyProduct` 가 이미 그 변환을 한다.
 *    `ExtractedProductData` 의 칸 이름을 타입에서 확인해 그대로 매핑한다
 *    (title·brand·description·sku·material·shopifyProductType·shopifyTags).
 */
async function originFactsWithFallback(
  url: string,
  host: string,
): Promise<{ facts: ProductFacts | null; via: "LIGHT_FETCH" | "UNIVERSAL_EXTRACT" | "NONE"; detail: string }> {
  const lf = await factsFromProductUrl(url);
  if (lf.candidate?.facts) return { facts: lf.candidate.facts, via: "LIGHT_FETCH", detail: `status=${lf.status}` };
  try {
    const ue = await universalExtract(url);
    const p = ue.productData;
    if (!p?.title) return { facts: null, via: "NONE", detail: `lf=${lf.status} ue=no-title` };
    const facts = productFactsFromShopifyProduct(
      {
        title: p.title,
        url,
        description: p.description,
        vendor: p.brand,
        type: p.shopifyProductType,
        tags: p.shopifyTags,
        options: (p.optionGroups ?? []).map((g) => ({ name: g.name, values: g.values })),
        // 🔴 칸 이름을 타입에서 읽었다 — `ExtractedImage` 는 `url` 이다
        //    (`originalUrl` 로 추측했다가 typecheck 가 잡았다).
        images: ue.images.map((i) => i.url).filter(Boolean),
      },
      host,
    );
    return { facts, via: "UNIVERSAL_EXTRACT", detail: `lf=${lf.status} → ue OK` };
  } catch (e) {
    return { facts: null, via: "NONE", detail: `lf=${lf.status} ue=${e instanceof Error ? e.name : "?"}` };
  }
}

describe.skipIf(!LIVE)("🔴 MI-P0-05 — SAME Product Discovery E2E", () => {
  it(
    "origin facts 폴백 + known-SAME 짝 탐색 + 상품단위 퍼널",
    async () => {
      const p = path.join(OUT_DIR, "mi-p0-03-levels.json");
      if (!existsSync(p)) throw new Error(`선행 측정 없음: ${p}`);
      const { golden, recs } = JSON.parse(readFileSync(p, "utf8")) as { golden: Golden[]; recs: Rec[] };
      const cq = JSON.parse(readFileSync(path.join(OUT_DIR, "mi-p0-03-candidate-quality.json"), "utf8")) as {
        details: { url: string; classification: string; crawlerUrl: string | null; readable: boolean; candidateHost: string | null }[];
      };
      const det = new Map(cq.details.map((d) => [d.url, d]));

      /* ── ① origin facts — Light Fetch 실패 시 universalExtract 폴백 ── */
      const origins = new Map<string, { facts: ProductFacts | null; via: string; detail: string }>();
      for (const g of golden) {
        const o = await originFactsWithFallback(g.url, g.host);
        origins.set(g.url, o);
        // eslint-disable-next-line no-console
        console.log(`origin ${g.host.padEnd(22)} via=${o.via.padEnd(18)} facts=${!!o.facts} ${o.detail}`);
      }

      /* ── ② 후보 facts 를 한 번만 만들고 재사용 ── */
      const candFacts = new Map<string, ProductFacts | null>();
      const candUrls = [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))];
      for (const u of candUrls) {
        const d = det.get(u);
        if (!d || d.classification !== "PRODUCT_PAGE" || !d.crawlerUrl) { candFacts.set(u, null); continue; }
        if (!d.readable) { candFacts.set(u, null); continue; }
        const f = await factsFromProductUrl(d.crawlerUrl);
        candFacts.set(u, f.candidate?.facts ?? null);
      }

      /* ── ③ 상품단위 퍼널 + Level 별 최초 SAME ── */
      const LV = ["L0", "L1", "L2", "L3", "L4"];
      const perProduct = golden.map((g) => {
        const rs = recs.filter((r) => r.url === g.url);
        const of_ = origins.get(g.url)?.facts ?? null;
        const seen = new Set<string>();
        let raw = 0, prod = 0, read = 0, selfRef = 0;
        const tally: Record<string, number> = {};
        let firstSame: string | null = null, firstAny: string | null = null;
        for (const L of LV) {
          for (const r of rs.filter((x) => x.level === L)) {
            for (const d of r.discovered ?? []) {
              raw++;
              if (seen.has(d.url)) continue;
              seen.add(d.url);
              const dd = det.get(d.url);
              if (dd?.classification === "PRODUCT_PAGE") prod++;
              if (dd?.readable) read++;
              if (isSelfReferenceCandidate(g.url, d.url)) { selfRef++; continue; }
              const cf = candFacts.get(d.url);
              if (!of_) { tally.ORIGIN_FACTS_MISSING = (tally.ORIGIN_FACTS_MISSING ?? 0) + 1; continue; }
              if (!cf) { tally.NOT_READABLE = (tally.NOT_READABLE ?? 0) + 1; continue; }
              const v = compareCrossSellerProducts(of_, cf).verdict;
              tally[v] = (tally[v] ?? 0) + 1;
              if (v === "SAME" && !firstSame) firstSame = L;
              if ((v === "SAME" || v === "PRESUMED_SAME") && !firstAny) firstAny = L;
            }
          }
        }
        const tok = rs.reduce((a, r) => a + ((r as unknown as { usage?: { totalTokens: number } }).usage?.totalTokens ?? 0), 0);
        return { host: g.host, brand: g.brand, codePresent: !!g.code,
                 queries: rs.filter((r) => r.buildable).length, tokens: tok,
                 rawCandidates: raw, distinct: seen.size, productPage: prod, readable: read,
                 selfReferenceExcluded: selfRef, verdicts: tally,
                 SAME: tally.SAME ?? 0, SAME_LIKELY: tally.PRESUMED_SAME ?? 0,
                 firstSameLevel: firstSame, firstSameOrLikelyLevel: firstAny,
                 originVia: origins.get(g.url)?.via ?? "?" };
      });

      /* ── ④ known-SAME false negative — 짝이 후보에 들어왔는가 ── */
      const KNOWN_PAIR = { originHostPart: "junioredition.com", brand: "Main Story", expectHost: "main-story.com" };
      const target = golden.find((g) => g.host === KNOWN_PAIR.originHostPart && g.brand === KNOWN_PAIR.brand);
      const pairHosts = target
        ? [...new Set(recs.filter((r) => r.url === target.url)
            .flatMap((r) => (r.discovered ?? []).map((d) => (d.title ?? "").trim().toLowerCase())).filter(Boolean))]
        : [];
      const knownSame = {
        product: target ? `${target.host} / ${target.brand}` : "🔴 표본에 없음",
        expectHost: KNOWN_PAIR.expectHost,
        found: pairHosts.some((h) => h.includes(KNOWN_PAIR.expectHost)),
        candidateHosts: pairHosts,
      };

      const report = { sample: { populationN: 497, sampleN: golden.length,
                                 criteria: "호스트 층화(junioredition 2 · bobochoses 2 · smallable 2 · tennis 1) · 품번 보유/미보유 둘 다" },
                       perProduct, knownSame };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-05-e2e.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));
      expect(perProduct).toHaveLength(golden.length);
    },
    240 * 60 * 1000,
  );
});
