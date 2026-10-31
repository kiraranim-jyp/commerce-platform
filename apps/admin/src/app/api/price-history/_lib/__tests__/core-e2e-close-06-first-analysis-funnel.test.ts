import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-06 — **최초 분석에서 국내/해외 후보·가격이 나오는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 정정: CLOSE-05 의 「🔄 다시 분석」은 **본선이 아니다.** 제품의 정상 흐름은
 * ```
 * 상품 URL → 최초 분석 → AI Search → 국내+해외 후보 → 동일상품 가능성
 *          → 후보별 실제 가격 → 가격 비교 화면
 * ```
 * 이고, 셀러가 「다시 분석」을 눌러야 가격이 보이면 **FAIL** 이다.
 *
 * 🔴 이 WU 는 **조사 전용** 이다 — 운영 코드 변경 **0**(CPO §7·§8-⑦).
 * 🔴 금지 전수 준수 — Registry 0 · adapter 0 · threshold 0 · matchTruth 0 ·
 *    priceTier 0 · Search provider 0 · Query 0 · 새 가격 API 0 · UI 0.
 *
 * 🟢 **운영 함수를 그대로 부른다** — `runDomesticPriceCheck` 에 `/check` 라우트와
 *    **같은 인자 모양** 으로(`webSearch: true` · `domesticListingHop: true`).
 *    🔴 복제식이 아니다 · 하니스가 판정을 만들지 않는다.
 * 🔴 **1 Product = 1 Search** — 통과하는 결과가 나올 때까지 다시 돌리지 않는다.
 * 🔴 게이트 `CLOSE_06_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 *
 * 🔴🔴 **측정 한계를 먼저 적는다**(DSP-01 이 기록한 그 한계와 같다):
 *    service-role 키가 없어 **등록부(domestic_price_sources)가 비어서 돈다** ⟹
 *    「등록부 검색」 생산자의 기여는 **측정불가** 다. 🟢 그러나 CPO 가 묻는 본선은
 *    **AI Search 축** 이고 그 축은 등록부를 **참조하지 않는다**(WU-024 계약).
 */

const LIVE = process.env.CLOSE_06_PROBE === "1";

/** 🔴 CEO 가 보고 있는 그 상품이다 — `KRW 88,000` 국내 참고가격이 뜬 B226AC009. */
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const SNAPSHOT = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";
const WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";

/** 🔴 **추정이 아니다** — 운영 `classifyCandidateMarket` 이 낸 `market` 값을 그대로 쓴다. */
type Row = {
  source: string;
  domain: string;
  url: string;
  market: string;
  verdict: string;
  tier: string;
  truth: string;
  price: number | null;
  currency: string | null;
  priceStatus: string;
  blockers: string;
};

describe("CORE-E2E-CLOSE-06 — 최초 분석 funnel(국내 vs 해외)", () => {
  it.runIf(LIVE)(
    "🔴 Search → Candidate → Crawl → Identity → Price → UI 를 시장별로 센다",
    async () => {
      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { selectMiSameCandidates, selectPresumedCandidates } = await import(
        "../../../../pipeline/commerce/mi-same-candidates"
      );

      /* ── ① 원상품 — 운영 추출 경로 그대로 ───────────────────────────────── */
      const extracted = await shopifySiteStrategy.extract(ORIGIN);
      const product = buildCanonicalProduct(
        ORIGIN,
        extracted!.productData as never,
        {} as never,
        [],
      );
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(
        `\n[C06-origin] brand="${dna.brand.value}" code=${dna.brandModelCode} color=${dna.color}`,
      );

      /* ── ② 최초 분석 1회 — 라우트와 같은 인자 모양 ──────────────────────── */
      const r = (await runDomesticPriceCheck({
        snapshotId: SNAPSHOT,
        workspaceId: WORKSPACE,
        dna,
        description: product.description.value || undefined,
        /** 🟢 **본선** — 최초 분석이 켜는 그 둘이다. 🔴 재투입 URL 은 주지 않는다. */
        webSearch: true,
        domesticListingHop: true,
      } as never)) as unknown as Record<string, unknown>;

      /* ── ③ 생산자 전수 — 뭉치지 않고 출처별로 센다 ──────────────────────── */
      const PRODUCERS = [
        ["webSearchEvidence", "WEB_SEARCH"],
        ["domesticListingEvidence", "DOMESTIC_LISTING"],
        ["overseasAutoEvidence", "OVERSEAS_AUTO"],
        ["urlCandidateEvidence", "URL_CANDIDATE"],
        ["geminiEvidence", "GEMINI"],
        ["reviewedSameEvidence", "REVIEWED_SAME"],
        ["weakCandidateEvidence", "WEAK(판정 전 탈락)"],
      ] as const;

      const rows: Row[] = [];
      const weak: Row[] = [];
      for (const [key, label] of PRODUCERS) {
        const arr = (r[key] as Record<string, unknown>[] | null) ?? [];
        console.log(`[C06-producer] ${label.padEnd(20)} ${String(arr.length).padStart(3)}건`);
        for (const e of arr) {
          const row: Row = {
            source: label,
            domain: String(e.domain ?? ""),
            url: String(e.discoveredUrl ?? ""),
            market: String(e.market ?? "UNKNOWN"),
            verdict: String(e.crossSellerVerdict ?? "-"),
            tier: String(e.priceTier ?? "-"),
            truth: String(e.matchTruth ?? "-"),
            price: (e.priceAmount as number | null) ?? null,
            currency: (e.priceCurrency as string | null) ?? null,
            priceStatus: String(e.priceStatus ?? "-"),
            blockers: JSON.stringify(e.crossSellerBlockers ?? []),
          };
          if (key === "weakCandidateEvidence") weak.push(row);
          else rows.push(row);
        }
      }

      /* ── ④ 풀 계측 — Search·추출 단계는 운영이 이미 센다 ────────────────── */
      for (const k of ["webSearchUrlMetrics", "domesticListingMetrics", "urlCandidateMetrics"]) {
        if (r[k] != null) console.log(`[C06-pool] ${k} ${JSON.stringify(r[k])}`);
      }
      const shop = (r.domesticShop as Record<string, unknown> | undefined) ?? r;
      for (const k of ["searchStatuses", "sourceErrors", "geminiMetrics"]) {
        if (shop[k] != null) console.log(`[C06-shop] ${k} ${JSON.stringify(shop[k]).slice(0, 400)}`);
      }

      /* ── ⑤ 시장별 단계 표 — 🔴 숫자 없는 PASS 금지(CPO §5) ─────────────── */
      const isKr = (x: Row): boolean => x.market === "KR";
      const isOs = (x: Row): boolean => x.market === "OVERSEAS";
      const same = (x: Row): boolean =>
        x.verdict === "SAME" || x.verdict === "PRESUMED_SAME";
      const priced = (x: Row): boolean => x.price != null;

      /** 🔴 UI 는 **운영 선택기** 로 센다 — 내가 조건을 다시 쓰지 않는다. */
      const uiRows = rows as unknown as Parameters<typeof selectMiSameCandidates>[0];
      const uiKr =
        selectMiSameCandidates(uiRows, "KR").priced.length +
        selectPresumedCandidates(uiRows, "KR").length;
      const uiOs =
        selectMiSameCandidates(uiRows, "OVERSEAS").priced.length +
        selectPresumedCandidates(uiRows, "OVERSEAS").length;

      const table = [
        ["Candidate 생성(판정 도달)", rows.filter(isKr).length, rows.filter(isOs).length],
        ["판정 전 탈락(WEAK)", weak.filter(isKr).length, weak.filter(isOs).length],
        ["SAME/PRESUMED", rows.filter((x) => isKr(x) && same(x)).length, rows.filter((x) => isOs(x) && same(x)).length],
        ["가격 존재", rows.filter((x) => isKr(x) && priced(x)).length, rows.filter((x) => isOs(x) && priced(x)).length],
        ["SAME/PRESUMED + 가격", rows.filter((x) => isKr(x) && same(x) && priced(x)).length, rows.filter((x) => isOs(x) && same(x) && priced(x)).length],
        ["최종 UI 표시", uiKr, uiOs],
      ] as const;

      console.log("\n════ CORE-E2E-CLOSE-06 — 최초 분석 단계표 ════");
      console.log("단계".padEnd(26) + "🇰🇷 국내".padStart(10) + "🌎 해외".padStart(10));
      for (const [name, kr, os] of table) {
        console.log(name.padEnd(26) + String(kr).padStart(10) + String(os).padStart(10));
      }
      console.log(
        `\n🔴 market=UNKNOWN(국내도 해외도 아님) ${rows.filter((x) => x.market === "UNKNOWN").length}건` +
          ` · WEAK UNKNOWN ${weak.filter((x) => x.market === "UNKNOWN").length}건`,
      );

      /* ── ⑥ 한 줄씩 — 어느 칸에서 멈췄는지 뭉치지 않는다 ────────────────── */
      console.log("\n──── 판정 도달 후보 전수 ────");
      for (const x of rows) {
        console.log(
          `[C06-row] ${x.market.padEnd(8)} ${x.domain.padEnd(26)} ${x.source.padEnd(18)}` +
            ` v=${x.verdict.padEnd(14)} tier=${x.tier.padEnd(11)}` +
            ` ${String(x.price ?? "-").padStart(9)} ${(x.currency ?? "").padEnd(4)} ${x.priceStatus.padEnd(18)} blk=${x.blockers}`,
        );
      }
      console.log("\n──── 판정 전 탈락(WEAK) 전수 ────");
      for (const x of weak) {
        console.log(
          `[C06-weak] ${x.market.padEnd(8)} ${x.domain.padEnd(26)} v=${x.verdict.padEnd(14)}` +
            ` ${String(x.price ?? "-").padStart(9)} ${(x.currency ?? "").padEnd(4)} blk=${x.blockers}`,
        );
      }

      /**
       * 🔴🔴 **열화를 감지하면 측정을 거부한다**(WU-133 이 세운 그 게이트).
       *    후보가 통째로 0 이면 「국내가 없다」가 아니라 **「측정불가」** 다.
       */
      expect(
        rows.length + weak.length,
        "🔴 후보가 전건 0 — 열화 가능성. 이 실행의 숫자를 제품 사실로 쓰지 않는다",
      ).toBeGreaterThan(0);
    },
    600_000,
  );
});
