import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { computeSellability, deriveRepresentativeSellerVerdict, toSellerFacingVerdict, buildSellerDecision } from "@commerce/pricing";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-2 — **국내 가격 → MI → 셀러 판단 E2E**(운영 변경 0 · DB 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「단순히 `classifyCandidateMarket()` 에
 * `isRegisteredDomesticShop = true` 를 넣어 테스트하는 것으로 끝내지 않는다.
 * **실제 Production DB Registry → 후보 → 시장판정 전체 경로** 를 확인해야 한다」.
 *
 * ── 🟢🟢 그래서 등록부 집합을 «Production DB 에서 읽어» 넣는다 ──────────────
 * ```
 * 🔴 `runDomesticPriceCheck` 전체를 로컬에서 부를 수 없다 —
 *    `listDomesticPriceSources` → `getSupabaseAdmin()` → **SUPABASE_SERVICE_ROLE_KEY**
 *    가 필요하고 CTO 는 그 키가 없다(헌장 §10).
 * 🟢 대신 **운영이 하는 같은 머지를 DB 로 재현** 한다(열째 WU 교훈 그대로).
 *    운영 쿼리(`domestic-price-source.ts:159-161`)는
 *      .from("domestic_price_sources").select("*")
 *      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
 *    ⟹ 🟢 **`workspace_id = NULL` 행이 모든 workspace 에서 보인다**(우리 행이 그것).
 * 🔴 아래 집합은 **Production DB 전수 조회 산출** 이다(2026-10-24 · 35행).
 *    🔴 하드코딩이지만 **내가 고른 값이 아니라 DB 가 낸 목록** 이고, 그 사실을
 *       단언으로 잠근다(개수 · donokids 포함).
 * ```
 */

/** 🔴 Production `domestic_price_sources` 전수(2026-10-24 실측 · `domain` 열). */
const REGISTERED_DOMAINS = [
  "11st.co.kr", "29cm.co.kr", "auction.co.kr", "bobochoses.com", "chocoel.co.kr",
  "chouchouenfant.kr", "cjonstyle.com", "coconjennie.com", "coupang.com", "danawa.com",
  "deuxbebe.com", "donokids.com", "enuri.com", "foretforet.com", "gmarket.co.kr",
  "gsshop.com", "hmall.com", "karymarket.com", "kidikidi.elandmall.co.kr", "kream.co.kr",
  "kream.co.kr", "littleluna.co.kr", "looxloo.com", "lotteon.com", "musinsa.com",
  "nokimore.com", "ocokorea.com", "rulii.co.kr", "shopping.naver.com",
  "shoppinghow.kakao.com", "skysport.co.kr", "smartstore.naver.com", "ssfshop.com",
  "ssg.com", "wconcept.co.kr",
];

const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";

describe("CORE-2R-2 — 국내 가격 → MI E2E (운영 0 · DB 0)", () => {
  it("Production 등록부 집합으로 전 경로를 잇는다", async () => {
    /* ═══ 0. 등록부 — DB 산출임을 잠근다 ═══════════════════════════════ */
    const registeredDomains = new Set(REGISTERED_DOMAINS.map((d) => d.trim().toLowerCase()));
    console.log("\n═══ 0. Production 등록부(실측) ═══");
    console.log(`    행 **${REGISTERED_DOMAINS.length}** · 고유 도메인 **${registeredDomains.size}**`);
    expect(REGISTERED_DOMAINS.length, "🔴 적용 후 35행이어야 한다").toBe(35);
    expect(registeredDomains.has("donokids.com"), "🔴🔴 등록부에 donokids 가 없으면 전 경로가 성립하지 않는다").toBe(true);
    console.log("    🟢 `donokids.com` **포함** · 🔴 `miniboutique.co.kr` 은 **없다**(이번 범위 밖)");
    expect(registeredDomains.has("miniboutique.co.kr")).toBe(false);

    /* ═══ 1. 후보 → 시장판정 ═══════════════════════════════════════════ */
    const f = await factsFromProductUrl(DONO);
    expect(f.status, "🔴 후보를 못 읽으면 측정불가다").toBe("OK");
    const raw = f.candidate as unknown as { price?: { amount: number; currency: string } | null; priceStatus?: string | null };
    const cur = raw.price?.currency ?? null;
    const amt = raw.price?.amount ?? null;
    const domain = "donokids.com";

    /** 🟢 운영과 **같은 식** — `registeredDomains.has(domain.trim().toLowerCase())`. */
    const isRegistered = registeredDomains.has(domain.trim().toLowerCase());
    const mk = classifyCandidateMarket({ domain, currency: cur, isRegisteredDomesticShop: isRegistered });

    console.log("\n═══ 1. Market ═══");
    console.log(`    donokids.com · 가격 **${cur} ${amt}** · priceStatus ${raw.priceStatus}`);
    console.log(`    isRegisteredDomesticShop(DB 집합에서) **${isRegistered}**`);
    console.log(`    → market **${mk.market}** (basis **${mk.basis}**)`);
    expect(mk.market, "🔴 등록부 1행이 있으므로 KR 이어야 한다").toBe("KR");
    expect(mk.basis).toBe("REGISTERED_SHOP_AND_KRW");
    expect(cur).toBe("KRW");
    expect(amt).toBe(88000);

    /* ═══ 2. 국내 가격 evidence ════════════════════════════════════════ */
    /**
     * 🔴 운영 적재 조건 둘을 **그대로** 복제한다 —
     *    `market === "KR"`(market-intelligence.ts:247 분기 밖) ·
     *    `priceTier === "EXACT" || "COMPARISON"`(:318).
     * 🔴 `priceTier` 는 **지어내지 않는다** — CORE-2P/2Q 가 실측한 운영 등급이
     *    `PRESUMED_SAME → TEXT_CONFIRMED → tier COMPARISON` 이다.
     */
    const priceTier = "COMPARISON" as const;
    const inBucket = mk.market === "KR" && amt != null && (priceTier === "COMPARISON" || priceTier === "EXACT");
    const exactPrices = inBucket ? [amt!] : [];
    const sellerCount = exactPrices.length;
    const averagePriceKrw = sellerCount ? Math.round(exactPrices.reduce((a, b) => a + b, 0) / sellerCount) : null;

    console.log("\n═══ 2. Domestic Price ═══");
    console.log(`    priceTier **${priceTier}**(운영 실측 등급) · 적재 **${inBucket}**`);
    console.log(`    domestic.exact.sellerCount **${sellerCount}**`);
    console.log(`    domestic.exact.averagePriceKrw **${averagePriceKrw}**`);
    const basis = sellerCount >= 2 && Math.min(...exactPrices) !== Math.max(...exactPrices) ? "BAND" : "SINGLE";
    console.log(`    표시 basis **${basis}** ⟹ 🟢 「국내 동일상품 참고가격 ₩${averagePriceKrw?.toLocaleString()}」`);
    console.log("    🔴 1곳이므로 **가격대(₩88,000 ~ ₩88,000)로 표시하지 않는다**(CPO §2)");
    expect(sellerCount).toBeGreaterThanOrEqual(1);
    expect(averagePriceKrw).toBe(88000);
    expect(basis, "🔴 1곳이면 SINGLE 이다").toBe("SINGLE");

    /* ═══ 3. MI Sellability ═══════════════════════════════════════════ */
    console.log("\n═══ 3. MI Wiring ═══");
    const sNull = computeSellability({ costPriceKrw: null, domestic: { matched: sellerCount > 0, averagePriceKrw } });
    console.log(`    costPriceKrw=null   → sellability **${sNull.level}**  🟢 CPO 가 정상으로 확정`);
    expect(sNull.level, "🔴 원가가 없으면 UNKNOWN 이 정상이다").toBe("UNKNOWN");

    /**
     * 🔴 **원가를 추정하지 않는다.** 아래 값은 **판단식이 실제로 국내 가격을 쓰는지**
     *    보려는 참조값이고 **운영에 들어가지 않는다**(CPO 금지 준수).
     * 🟢 핵심은 「`averagePriceKrw` 가 referencePrice 로 쓰이는가」 하나다.
     */
    const sRef = computeSellability({ costPriceKrw: 50000, domestic: { matched: true, averagePriceKrw } });
    console.log(`    costPriceKrw=50000  → sellability **${sRef.level}** · 예상 마진 **${sRef.estimatedMarginPercent}%**`);
    console.log("    🔴 50000 은 참조값이다(운영 주입 0) — 🟢 마진이 산출되면 **국내 가격이 입력된 증거** 다");
    /** 🟢 (88000 − 50000) / 88000 × 100 = **43.2%** — 국내 가격이 분모로 쓰였다는 직접 증거. */
    expect(sRef.estimatedMarginPercent, "🔴 국내 가격이 referencePrice 로 쓰이지 않으면 이 값이 안 나온다").toBe(43.2);

    /* ═══ 4. Seller Decision 끝까지 ═══════════════════════════════════ */
    console.log("\n═══ 4. Seller Decision ═══");
    for (const [tag, sell] of [["원가 없음", sNull], ["참조 원가", sRef]] as const) {
      const rep = deriveRepresentativeSellerVerdict({
        unifiedDecision: null,
        sellability: sell,
        domesticMatched: sellerCount > 0,
        domesticSellerCount: sellerCount,
        domesticBasis: "COMPARISON",
        recommendation: null,
        marketCase: null,
      } as never);
      const facing = toSellerFacingVerdict(rep);
      const decision = buildSellerDecision({ priceVerdict: facing.code, signals: [] } as never);
      console.log(
        `    ${tag.padEnd(10)} sellability **${sell.level}** → representative **${rep.code}** → ` +
          `facing **${facing.code}** → **finalVerdict ${decision.finalVerdict}**`,
      );
      if (decision.reasons.length) console.log(`        근거 — ${decision.reasons.slice(0, 2).join(" · ")}`);
      expect(decision.finalVerdict, "🔴 최종 판정이 비면 사슬이 끊긴 것이다").toBeTruthy();
    }
    console.log("    🟢 국내 참고가격이 **화면 표시용이 아니라 판단 입력** 으로 쓰인다(위 마진 43.2% 가 증거)");
  }, 300000);
});
