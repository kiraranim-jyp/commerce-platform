/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-021 — **최종 MI / 등록판정 연결** 검증 (KIDS + TENNIS 공통 E2E)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini 0 · 외부 HTTP 0 · DB 쓰기 0 · 운영 코드 변경 0.** 입력은 전부
 *    **읽기 전용 덤프**(`mi-021-decision-dump.mjs` · 운영 DB 실데이터)다.
 *
 * 🔴🔴 **복제식을 쓰지 않는다.** 운영 `computeMarketIntelligence` 가 부르는 **그
 *    함수들을 그 순서로** 부른다. 각 줄에 운영 호출부 줄번호를 적어 둔다 —
 *    로컬에서 `computeMarketIntelligence` 자체는 부를 수 없다(`getSupabaseAdmin()`
 *    이 service-role key 없이 **조용히 null** 을 준다 · 헌장 §12).
 *
 * ── 🔴 CONTROL 의 한계를 먼저 적는다 (§5-B) ────────────────────────────────
 * ```
 * 운영의 «최종 verdict» 는 **DB 에 저장되지 않는다.**
 *   product_snapshots 칸 12개: id · source_url · title · thumbnail_url · status ·
 *   workspace · created_at · updated_at · last_opened_at · job_key ·
 *   workspace_id · product_id  → 판정 칸이 **없다**
 *   price_alerts  이 표본 26개에 대해 **0행**
 * → 🔴 그래서 「운영이 낸 그 값을 재현했다」는 CONTROL 을 **세울 수 없다.**
 *    이 측정은 **「사슬이 끝까지 도는가 + 무엇을 내는가」** 의 증거이고
 *    **「운영 재현」 증거가 아니다.** 둘을 같은 칸에 적지 않는다.
 * 🟢 단 **입력** 은 운영 실데이터다(관측 75행 · 링크 5행) — 가공하지 않았다.
 * ```
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeSellability,
  deriveRepresentativeSellerVerdict,
  summarizeDomesticMarketSplit,
  toSellerFacingVerdict,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
/** 🔴 owner 가 `@commerce/pricing` 이 «아니다» — admin `_lib` 이다(추측 금지, 실측). */
import { selectCostBasisOriginObservations } from "../price-observations";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow { id: string; title: string; brand: string }
interface ObsRow {
  snapshot_id: string; id: string; source: string; source_label: string | null;
  source_product_url: string | null; source_ref_id: string | null; currency: string | null;
  price_amount: number | null; price_krw: number | null; sold_out: boolean | null;
  market_code: string | null; market_country: string | null; checked_at: string;
  shipping_cost_amount: number | null; tax_amount: number | null; exchange_rate: number | null;
  sale_price_krw: number | null; original_price_krw: number | null;
}
interface LinkRow {
  snapshot_id: string; source_id: string; match_truth: string | null; verified: boolean | null;
  match_type: string | null; cross_seller_verdict: string | null; status: string | null;
}

const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

/** 🟢 DB 행 → owner 가 먹는 모양. 🔴 **칸 이름만** 옮긴다(값을 만들지 않는다). */
const toRecord = (o: ObsRow): PriceObservationRecord =>
  ({
    id: o.id,
    snapshotId: o.snapshot_id,
    source: o.source,
    sourceLabel: o.source_label,
    sourceProductUrl: o.source_product_url,
    sourceRefId: o.source_ref_id,
    currency: o.currency,
    priceAmount: o.price_amount,
    shippingCostAmount: o.shipping_cost_amount,
    taxAmount: o.tax_amount,
    exchangeRate: o.exchange_rate,
    priceKrw: o.price_krw,
    salePriceKrw: o.sale_price_krw,
    originalPriceKrw: o.original_price_krw,
    soldOut: o.sold_out,
    marketCode: o.market_code,
    marketCountry: o.market_country,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: o.checked_at,
  }) as unknown as PriceObservationRecord;

describe.skipIf(!LIVE)("🔴 WU-021 — 최종 MI/등록판정 연결 (Gemini 0 · HTTP 0)", () => {
  it("운영 호출 순서 그대로 사슬을 돌려 두 카테고리의 최종 판정을 낸다", () => {
    const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
    const observations = read<ObsRow[]>("d021-observations.json");
    const links = read<LinkRow[]>("d021-links.json");

    const seen = new Set<string>();
    const kids = [...(groups.control ?? []), ...groups.kids, ...groups.kids2].filter((r) =>
      seen.has(r.id) ? false : (seen.add(r.id), true),
    );
    const plan = [
      ...kids.map((row) => ({ row, scope: "KIDS_FASHION" as const })),
      ...groups.tennis.map((row) => ({ row, scope: "TENNIS" as const })),
    ];

    const rows: Record<string, unknown>[] = [];

    for (const { row, scope } of plan) {
      const mine = observations.filter((o) => o.snapshot_id === row.id);
      const originRecords = mine.filter((o) => o.source === "SELLER_ORIGIN").map(toRecord);
      const domesticShopHistory = mine.filter((o) => o.source === "DOMESTIC_SHOP").map(toRecord);

      /** 🟢 운영 :128 — 원가 근거 선택기(MARKET_PROBE 를 제외하는 owner). */
      const originHistory = selectCostBasisOriginObservations(originRecords);
      /** 🟢 운영 :303 — 가장 최신 원가. 🔴 직접 계산하지 않는다. */
      const costPriceKrw = originHistory[0]?.priceKrw ?? null;
      const costBasis = (originHistory[0]?.sourceLabel as string | null) ?? null;

      /** 🟢 운영 :136-146 — `priceTierFromLink` **호출** 로 tier 를 얻어 두 버킷으로. */
      const tierBySourceId = new Map(
        links
          .filter((l) => l.snapshot_id === row.id)
          .map((l) => [
            l.source_id,
            priceTierFromLink({ matchTruth: l.match_truth, verified: l.verified } as never),
          ]),
      );
      const exactShopRecords: PriceObservationRecord[] = [];
      const comparisonShopRecords: PriceObservationRecord[] = [];
      for (const record of domesticShopHistory) {
        const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
        if (tier === "EXACT") exactShopRecords.push(record);
        else if (tier === "COMPARISON") comparisonShopRecords.push(record);
      }

      /** 🟢 운영 집계 owner. */
      const split = summarizeDomesticMarketSplit(exactShopRecords, comparisonShopRecords);
      const domesticSummary = split.resolved;

      /** 🟢 운영 :663 — 같은 입력 모양. */
      const sellability = computeSellability({
        costPriceKrw,
        domestic: { matched: split.exact.sellerCount > 0, averagePriceKrw: split.exact.averagePriceKrw },
      });

      /**
       * 🔴🔴 **여기서 사슬이 끊긴다 — 하니스의 한계이고 제품 결함이 아니다.**
       *    운영은 `computePriceRecommendation`(:461)에 `totalCostKrw: cost.landedCostKrw`
       *    를 넘기고, 그 `cost` 는 `computePriceBreakdown(..., exchangeRates.rates)`(:437)
       *    가 만든다. 그 환율은 `fetchLiveExchangeRates()`(:436)가 **DB/외부** 에서 받는다.
       * 🔴 이 WU 는 HTTP 0 이므로 **환율을 받지 않는다** → landedCost·marketCase 를
       *    **만들지 않는다.** 🔴 지어내지 않고 `null` 로 넘기고, 그래서 아래 ⑦⑧은
       *    **「marketCase 없이」 조건의 값** 이다. 운영 값이라고 적지 않는다.
       */
      const recommendation = null;

      /** 🟢 운영 :675 — 대표 판정. */
      const representative = deriveRepresentativeSellerVerdict({
        unifiedDecision: null,
        sellability,
        domesticMatched: domesticSummary.sellerCount > 0,
        domesticSellerCount: domesticSummary.sellerCount,
        domesticBasis: split.basis,
        /** 🔴 위 주석의 이유로 **비운다** — 지어내지 않는다. */
        marketCase: null,
        recommendation,
        domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
        landedCostKrw: null,
      } as never);

      /** 🟢 운영 :698 — 화면용 3단 압축. */
      const facing = toSellerFacingVerdict(representative);

      rows.push({
        scope,
        brand: row.brand || "(빈 브랜드)",
        title: row.title.slice(0, 36),
        "① 원가 관측": originRecords.length,
        "①-b 원가 채택": originHistory.length,
        costPriceKrw,
        costBasis,
        "② 국내관측": domesticShopHistory.length,
        "②-b 링크": tierBySourceId.size,
        "③ tier EXACT 레코드": exactShopRecords.length,
        "③-b COMPARISON 레코드": comparisonShopRecords.length,
        "④ basis": split.basis,
        "④-b sellerCount": domesticSummary.sellerCount,
        "④-c 최저가": domesticSummary.lowestPriceKrw,
        "⑤ sellability": sellability.level,
        "⑤-b 마진%": sellability.estimatedMarginPercent,
        "⑥ marketCase": "🔴 측정 안 함(환율 필요)",
        "⑦🔴🔴 representative": (representative as { code?: string }).code ?? null,
        "⑧🔴🔴 sellerFacing": (facing as { code?: string }).code ?? null,
      });
    }

    const tally = (xs: Record<string, unknown>[], key: string) =>
      xs.reduce<Record<string, number>>((t, r) => {
        const k = String(r[key] ?? "(null)");
        t[k] = (t[k] ?? 0) + 1;
        return t;
      }, {});
    const kidsRows = rows.filter((r) => r.scope === "KIDS_FASHION");
    const tennisRows = rows.filter((r) => r.scope === "TENNIS");
    const summary = (xs: Record<string, unknown>[]) => ({
      상품: xs.length,
      "원가 있음": xs.filter((r) => r.costPriceKrw != null).length,
      "국내 EXACT 레코드 있음": xs.filter((r) => Number(r["③ tier EXACT 레코드"]) > 0).length,
      "sellerCount>0": xs.filter((r) => Number(r["④-b sellerCount"]) > 0).length,
      sellability: tally(xs, "⑤ sellability"),
      representative: tally(xs, "⑦🔴🔴 representative"),
      "🔴🔴 sellerFacing": tally(xs, "⑧🔴🔴 sellerFacing"),
    });

    const report = {
      "🔴🔴 DISCLAIMER":
        "운영 `computeMarketIntelligence` 가 부르는 **그 함수들을 그 순서로** 불렀다(줄번호는 코드 주석). " +
        "🔴 로컬에서 그 함수 자체는 부를 수 없다(service-role key). " +
        "🔴🔴 **CONTROL 없음** — 운영 최종 verdict 가 DB 에 저장되지 않는다(snapshot 칸 12개에 판정 칸 0 · " +
        "price_alerts 0행). 그래서 이 숫자는 「사슬이 도는가 + 무엇을 내는가」이고 「운영 재현」이 아니다. " +
        "🟢 입력(관측 75행 · 링크 5행)은 운영 실데이터다.",
      "① KIDS_FASHION": summary(kidsRows),
      "② TENNIS": summary(tennisRows),
      "③🔴 등록 판정(P-32)": {
        결론: "⚪ 이 하니스로 **측정하지 않는다**",
        이유:
          "`computeRegistrationReadiness(inputs: PlatformReadinessInput[])` 의 입력은 채널 등록 상태이고 " +
          "가격/판정 덤프에 없다. 🟢 그리고 P-32 불변식(registration-readiness-outcome.ts:15-20)이 " +
          "**판매 판정과 등록 준비의 상호 무영향** 을 선언하고, 그 함수가 sellVerdict 를 **인자로 받지 않는다** " +
          "(:109) — WU-019R 에서 코드로 확인했다. 즉 ⑧이 무엇이든 등록 준비는 바뀌지 않는다.",
      },
      products: rows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    let seq = 1;
    while (existsSync(path.join(OUT_DIR, `dec021-${seq}.json`))) seq += 1;
    writeFileSync(path.join(OUT_DIR, `dec021-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify({ ...report, products: `(${rows.length}건 — dec021-${seq}.json)` }, null, 1));

    expect(rows.length).toBeGreaterThan(0);
  });
});
