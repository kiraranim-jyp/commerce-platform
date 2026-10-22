import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate, MAX_SUPPLIED_CANDIDATE_URLS } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-158 — **AI Search 국내 «상세 URL» 확보율** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 정정(2026-10-22) — 「**AI Search 가 없다**」가 아니라 「**AI Search 가 국내
 * 동일상품의 «실제 상품 상세 URL» 을 더 잘 가져오도록 정확도를 올리는 것**」이 과제다.
 * KPI 는 하나 — **AI Search 가 국내 동일상품의 실제 상품 상세 URL 을 몇 개 확보하는가.**
 *
 * 🔴 운영 코드 변경 **0** · MI **0** · adapter **0** · registry **0** · Gemini **0**.
 * 🔴 게이트 `WU_158_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢🟢 방법론적 발견 — `site:<샵>` + 브랜드/시즌 이 **상세 URL 을 낸다** ───────
 * ```
 * WU-156 의 일반 질의 5종 → 국내 상세 URL **0**
 * WU-158 의 `site:beaumonde.co.kr` + 한국어 상품명/시즌 → `goods_view.php?goodsNo=`
 *          **12건**(아래 목록) ⟹ 🟢 **URL 모양·채널은 작동한다**
 * ```
 *
 * ── 🔴🔴 그런데 «그 상품» 의 URL 만 안 돌아온다 — 질의 8종 전부 ───────────────
 * ```
 * ① "B226AC009"                                    국내 상세 0
 * ② 상세 URL 명시(한국어)                            국내 상세 0
 * ③ 판매처명 + 품번                                  국내 상세 0
 * ④ 영어 + site:kr                                  국내 상세 0
 * ⑤ site:beaumonde.co.kr 보보쇼즈 허그 헤어리 몬스터 티셔츠  🟢 상세 7 · 🔴 **목표 0**
 * ⑥ site:beaumonde.co.kr B226AC009                  🔴 상세 1(무관) · 품번 색인 없음
 * ⑦ 샵의 정확한 제목 그대로                           🔴 해외만
 * ⑧ site:beaumonde.co.kr 보보쇼즈 26FW               🟢 상세 4 · 🔴 **목표 0**
 * ```
 * 🔴🔴 그리고 **색인 신선도 문제가 아니다** — ⑧이 `goodsNo=1000014101·1000014104`
 *    (26FW)을 냈고 목표 상품은 `goodsNo=**1000014021**` 로 **같은 번호대** 다.
 * 🔴🔴 엔진은 그 페이지를 **읽는다** — 답변 문장이 `B226AC009 · 88,000원` 과
 *    자매상품 `B226AC028 · 135,000원` 까지 인용했다. 그런데 **URL 을 링크로 주지
 *    않는다.** 🔴 우리 파이프라인은 **링크만** 받을 수 있다 ⟹ 그것이 병목이다.
 */
const LIVE = process.env.WU_158_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/**
 * 🟢 `site:` 표적 검색이 **실제로 돌려준** 국내 상세 URL 전수(2026-10-22 · 가공 0).
 * 🔴 전부 **다른 상품** 이다 — 그것이 측정 대상이다(MI 가 거르는지 본다).
 */
const SEARCH_YIELDED = [
  "https://m.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000013177",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000011368",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000011571",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000013107",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000012880",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000011589",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000011548",
  "https://m.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000010090",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014101",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014104",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000013369",
  "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000009997",
] as const;

/**
 * 🔴🔴 **CONTROL** — WU-150 이 `SAME · KRW 83,600 · market KR` 로 증명한 그 URL.
 *    🔴 **검색이 돌려주지 않았다.** 사람이 WU-150 에서 확보한 값이다.
 *    🟢 그래서 「파이프라인이 되는가」와 「검색이 주는가」를 **가를 수 있다**(§5-B).
 */
const CONTROL_URL = "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022";
const CONTROL_KEY = "1000014022";

/**
 * 🔴🔴 **내가 1차에 `goodsNo=1000014021` 을 썼고 CONTROL 이 FAIL 했다.**
 *    그 번호는 **`Booty Ghosts T-shirt B226AC010`**(다른 상품)이다 — 한 자리 틀렸다.
 *    🟢 게이트가 그것을 잡았다. 게이트가 없었으면 「MI 가 12건을 올바르게 걸렀다」는
 *       **거짓 결론** 을 적었을 것이다(실제로는 하니스가 고장나 전건 DROPPED 였다).
 *    🔴 좌표를 기억에서 쓰지 않고 **WU-150 하니스에서 읽어** 고쳤다.
 */

describe("WU-158 — AI Search 국내 상세 URL 확보율", () => {
  it.runIf(LIVE)("검색 산출 12건 + CONTROL 1건을 운영 파이프라인으로 가른다", async () => {
    /* eslint-disable no-console */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
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

    const ALL = [...SEARCH_YIELDED, CONTROL_URL];
    console.log("\n══════ 🔴 WU-158 입력 ══════");
    console.log(`  검색이 돌려준 국내 상세 URL   ${SEARCH_YIELDED.length}`);
    console.log(`  CONTROL(사람이 확보 · WU-150)  1`);
    console.log(`  URL 모양 PRODUCT_PAGE          ${ALL.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE").length}/${ALL.length}`);
    console.log(
      `  🔴 운영 상한 maxUrls = **${MAX_SUPPLIED_CANDIDATE_URLS}** ⟹ 운영이라면 ${ALL.length}건 중 ` +
        `${Math.max(0, ALL.length - MAX_SUPPLIED_CANDIDATE_URLS)}건은 **열어 보지도 못한다**`,
    );

    /** 🔴 측정이므로 상한을 전부 연다. 🔴 「운영과 같다」로 적지 않는다. */
    const pool = await collectUrlCandidatePool({
      urls: [...ALL],
      originUrl: dna.sourceUrl,
      maxUrls: ALL.length,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log(
      `\n  pool — supplied ${pool.metrics.suppliedUrls} → accepted ${pool.metrics.acceptedUrls}` +
        ` → usable ${pool.metrics.usableProductUrls} → miEligible ${pool.metrics.miEligibleCandidates}`,
    );

    let same = 0;
    let krSame = 0;
    let krPriced = 0;
    let controlSame = false;
    console.log("\n── 후보별 판정 ──");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다 */
      }
      /**
       * 🔴 **추출된 사실을 먼저 찍는다** — 「12건이 다른 상품이다」를 내 판단이 아니라
       *    **데이터** 로 보이기 위해서다(제목·품번은 운영 추출기가 읽은 값이다).
       */
      /**
       * 🔴 1차에 `c.modelCode` 를 찍으려 했고 **그 칸은 `ComparisonCandidate` 에 없다**
       *    (typecheck TS2339 가 잡았다 · 이 저장소가 여러 번 기록한 「칸 이름 추측」 함정).
       *    🔴 실행은 `code=-` 를 찍었으므로 그대로 보고하면 **「품번 전건 null」이라는
       *       거짓 사실** 이 됐다. 🟢 **존재하는 칸** 으로 바꿨다.
       */
      for (const c of priced) {
        const mark = c.url.includes(CONTROL_KEY) ? "🔴 CONTROL" : "          ";
        console.log(
          `   ${mark} lvl=${String(c.matchLevel ?? "-").padEnd(10)} conf=${String(c.confidence ?? "-").padEnd(6)}` +
            ` ${String(c.title).slice(0, 52)}`,
        );
      }

      /**
       * 🔴🔴 **운영과 같은 모양으로 부른다 — 배열을 통째로 넘긴다.**
       *    1차에 후보를 **한 개씩** 넘겼더니 ⑧ 증거 게이트(`isEvidenceEvaluationWorthwhile`)가
       *    **전건 DROPPED** 를 냈다. 🔴 그 상태의 숫자를 「MI 가 걸렀다」로 읽으면 거짓이다.
       *    🟢 운영은 샵당 **대표 1건** 을 고른다(`selectDomesticCandidate`) — 그것이 본래 동작이고,
       *       품번이 exact 인 CONTROL 이 그 경쟁을 이겨야 한다. 그것을 그대로 본다.
       */
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
      });
      if (j.kind !== "JUDGED") {
        console.log(`\n   → ${res.domain}: **${j.kind}**`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });
      const amount = j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "-";
      const wonIsControl = j.best.url.includes(CONTROL_KEY);
      console.log(
        `\n   → 샵 대표 = ${wonIsControl ? "🟢 **CONTROL**" : "🔴 다른 후보"} · tier=${tier}` +
          ` · market=${mk.market} · ${amount}\n     ${String(j.best.title).slice(0, 72)}`,
      );
      if (tier === "SAME") {
        same += 1;
        if (wonIsControl) controlSame = true;
        if (mk.market === "KR") {
          krSame += 1;
          if (j.best.price?.amount != null) krPriced += 1;
        }
      }
    }

    console.log("\n══════ 🔴🔴 KPI ══════");
    console.log(`  검색이 돌려준 «국내 동일상품» 상세 URL   **0** / ${SEARCH_YIELDED.length}  ← 🔴 목표 ≥3 미달`);
    console.log(`  검색이 돌려준 국내 상세 URL(다른 상품)   ${SEARCH_YIELDED.length}  ← 🟢 URL 모양·채널은 작동한다`);
    console.log(`  SAME 총계                               ${same}`);
    console.log(`  🇰🇷 SAME                                 ${krSame}`);
    console.log(`  🇰🇷 가격 확인 SAME                        ${krPriced}`);
    console.log(`\n  🔴 CONTROL(사람이 확보한 URL)이 SAME 인가 = ${controlSame ? "🟢 YES" : "🔴 NO"}`);
    console.log("  🟢 CONTROL 이 SAME 이면 — **파이프라인은 정상이고 병목은 «검색 산출» 하나** 다.");
    console.log("  🟢 나머지 12건이 SAME 이 아니면 — **MI 가 다른 상품을 올바르게 거른다**.");

    /**
     * 🔴🔴 **§5-B CONTROL 게이트** — 운영이 낸 «그 값» 이 재현되지 않으면 이 측정을
     *    전략 판단에 쓰지 않는다. WU-150 이 확정한 값은 `SAME` 이다.
     */
    expect(controlSame, "🔴 CONTROL 재현 실패 — 이 측정을 전략 판단에 쓰지 않는다").toBe(true);
  }, 900_000);
});
