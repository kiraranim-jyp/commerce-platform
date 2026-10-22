import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildPrimaryQuery } from "@commerce/crawler/src/discovery-core/query-generator";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-156 — **검색어를 바꾸면 국내 «상세» URL 이 나오는가** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「검색 결과에 가격/상품명이 있다고 해서 성공으로 판단하지
 * 않는다. 핵심 KPI 는 **`PRODUCT_DETAIL candidate`** 다.」
 *
 * 🔴 **이 WU 에서 코드를 바꾸지 않는다** — Case A/B/C 판정이 먼저다(CPO §12).
 * 🔴 URL 분류기 **수정 금지**(CPO §2) — 그래서 오분류를 발견해도 **적어만 둔다**.
 *
 * ── 🔴 Query A 와 C 가 «같은 문자열» 이다(측정이 밝힌 것) ────────────────────
 * ```
 * 운영 primary query owner = buildPrimaryQuery(identity)  (WU-014)
 * 이 상품에서 level = **L1_MODEL_CODE** · text = **"B226AC009"**
 * ⟹ 🔴 「품번 중심으로 바꾸자」(Query C)는 **이미 그렇게 되어 있다.**
 *    그래서 A 와 C 를 각각 세지 않고 **같은 행** 으로 적는다(분모 조작 금지).
 * ```
 *
 * ── 공급원 ──────────────────────────────────────────────────────────────────
 * ```
 * `cto-websearch`(WU-073/116/155 와 **같은 라벨** · 비용 0 · Gemini 호출 0)
 * 🔴 **이것은 운영 producer 가 아니다** — 운영 Gemini grounding 과 **엔진이 다르다**.
 *    그래서 「검색어를 바꾸면 운영에서 이만큼 나온다」로 **적지 않는다**.
 * 🔴 AI 단계에서 후보를 **줄이지 않았다** — 돌려준 링크를 전부 넣는다(위키백과 포함).
 * ```
 * 🔴 게이트 `WU_156_PROBE=1` 없으면 SKIP.
 */
const LIVE = process.env.WU_156_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🔴 2026-10-22 실제 검색 결과 링크 **전수**(순서 그대로 · 가공 0). */
const QUERIES: { id: string; label: string; text: string; urls: readonly string[] }[] = [
  {
    id: "A/C",
    label: "A 현재 운영 primary = C 품번 중심(같은 문자열)",
    text: "B226AC009",
    urls: [
      "https://bobochoses.com/en-de/products/b226ac009-hug-hairy-monster-t-shirt",
      "https://www.beaumonde.co.kr/",
      "https://en.wikipedia.org/wiki/B22",
      "https://en.wikipedia.org/wiki/SIG_Sauer_P226",
      "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
      "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
      "https://global.trenbe.com/products/bobo-choses-kids-long-sleeve-t-shirt-160072377-p",
      "https://en.wikipedia.org/wiki/B99",
      "https://www.gmarket.co.kr/n/search?k=0&keyword=%EA%B3%A8%EB%93%A0%EB%B3%B4%EC%9D%B4&p=2&s=3&t=d",
    ],
  },
  {
    id: "B",
    label: "B 상세 URL 명시(검색결과/카테고리/기획전 제외 요구)",
    text: "Bobo Choses B226AC009 … 국내 판매처 실제 상품 상세 페이지 URL … 상품 상세 URL만",
    urls: [
      "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
      "https://bobochoses.com/collections/all-baby",
      "https://bobochoses.com/en-us/collections/all-kids",
      "https://bobochoses.com/en-us/collections/t-shirts-for-baby",
      "https://bobochoses.com/en-us/collections/t-shirts-for-kid",
      "https://www.junioredition.com/products/hug-hairy-monster-baby-t-shirt-by-bobo-choses",
      "https://www.junioredition.com/collections/bobo-choses/t-shirts",
      "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
      "https://bornyesterdaykids.com/products/bobo-choses-baby-hug-hairy-monster-l-s-t-shirt-booo-bo-choses-tag-denim-pants-set-light-blue-red",
      "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
    ],
  },
  {
    id: "D",
    label: "D 판매처명 + 품번(CPO 가 가격을 찾은 그 경로)",
    text: "보몽드 도노키즈 트렌비 B226AC009 보보쇼즈 허그 헤어리 몬스터 티셔츠 상품페이지",
    urls: [
      "https://shop.coupang.com/beaumondekr?ocid=17295735&checkBatchDelivery=true&pid=7907482626&viid=88739618284&platform=p&brandId=0&locale=ko_KR",
      "https://www.feelway.com/gv_Moncler_7537147736.html",
      "https://m.bunjang.co.kr/keywords/hUG",
      "https://en.wikipedia.org/wiki/Little_Live_%22Gotta_Go%22_Pets_(brand)",
      "https://www.beaumonde.co.kr/",
      "https://en.wikipedia.org/wiki/YooHoo_%26_Friends",
      "https://en.wikipedia.org/wiki/Troll-friendly",
      "https://en.wikipedia.org/wiki/Clown_shoe",
      "https://en.wikipedia.org/wiki/Hogeon",
      "https://en.wikipedia.org/wiki/Shopkins",
    ],
  },
  {
    id: "E",
    label: "E 영어 + site: 연산자로 국내 도메인 강제",
    text: 'site:kr OR site:co.kr "B226AC009" product detail page buy online store Korea',
    urls: [
      "https://www.ivisitkorea.com/online-shopping-in-korea/",
      "https://www.ubuy.kr/en/",
      "https://10mag.com/english-websites-for-online-shopping-in-korea/",
      "https://oppastore.com/",
      "https://www.koreastore.fr/en",
      "https://en.wikipedia.org/wiki/List_of_Korean_online_fashion_retailers",
      "https://en.wikipedia.org/wiki/Kmall24",
      "https://www.gowonderfully.com/post/23-korean-online-shopping-websites-you-will-love",
      "https://www.yami.com/us/en/pages/korea",
      "https://en.wikipedia.org/wiki/List_of_South_Korean_retail_companies",
    ],
  },
];

/** 🔴 한국 판매처 «후보» — 도메인 휴리스틱이다(운영 `classifyCandidateMarket` 가 아니다). */
const krLike = (u: string) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith(".kr") || h.endsWith(".co.kr") || /coupang|bunjang|trenbe|gmarket|feelway|ssg|lotte/.test(h);
  } catch {
    return false;
  }
};

describe("WU-156 — 검색어 5종 × 국내 상세 URL 공급", () => {
  it.runIf(LIVE)("Query A~E 를 같은 조건으로 돌려 PRODUCT_DETAIL candidate 를 센다", async () => {
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

    /** 🔴 §3 — 운영 primary query owner 를 **호출해서** 적는다(추측 0). */
    const primary = buildPrimaryQuery({
      title: dna.title,
      brand: dna.brand.value || undefined,
      productCode: dna.brandModelCode ?? undefined,
      color: dna.color ?? undefined,
    } as never);
    console.log("\n══════ 🔴 §3 운영 primary query (buildPrimaryQuery 호출 결과) ══════");
    console.log(`  level = ${primary.level}`);
    console.log(`  text  = ${JSON.stringify(primary.text)}`);
    console.log(`  🔴 Query C(「품번 중심으로 바꾸자」)는 **이미 운영 상태** 다`);

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

    interface Row {
      id: string;
      raw: number;
      krRaw: number;
      shapeDetail: number;
      krShapeDetail: number;
      accepted: number;
      usable: number;
      miInput: number;
      krMiInput: number;
      same: number;
      krSame: number;
      krPriced: number;
    }

    const out: Row[] = [];
    for (const q of QUERIES) {
      const shapeDetail = q.urls.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE");
      const pool = await collectUrlCandidatePool({
        urls: [...q.urls],
        originUrl: dna.sourceUrl,
        maxUrls: q.urls.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });

      let miInput = 0;
      let krMiInput = 0;
      let same = 0;
      let krSame = 0;
      let krPriced = 0;
      const detail: string[] = [];

      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
        const scored = withConfidence(query, notSelf);
        miInput += scored.length;
        if (scored.some((c) => krLike(c.url))) krMiInput += scored.length;
        let priced = scored;
        try {
          priced = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: priced,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        if (j.kind !== "JUDGED") continue;
        const tier = domesticMatchDisplay(j.matchTruth as never).tier;
        const m = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: false,
        });
        if (tier === "SAME") {
          same += 1;
          if (m.market === "KR") {
            krSame += 1;
            if (j.best.price?.amount != null) krPriced += 1;
          }
        }
        detail.push(
          `   ${res.domain.padEnd(24)} tier=${String(tier).padEnd(14)} market=${String(m.market).padEnd(9)}` +
            ` price=${j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "-"}`,
        );
      }

      console.log(`\n── Query ${q.id} 후보 상세 ──`);
      for (const d of detail) console.log(d);
      if (detail.length === 0) console.log("   (후보 0)");

      out.push({
        id: q.id,
        raw: q.urls.length,
        krRaw: q.urls.filter(krLike).length,
        shapeDetail: shapeDetail.length,
        krShapeDetail: shapeDetail.filter(krLike).length,
        accepted: pool.metrics.acceptedUrls,
        usable: pool.metrics.usableProductUrls,
        miInput,
        krMiInput,
        same,
        krSame,
        krPriced,
      });
    }

    const ROWS: [string, (r: Row) => number][] = [
      ["① raw 검색결과 URL", (r) => r.raw],
      ["②   그중 🇰🇷 도메인", (r) => r.krRaw],
      ["③ URL 모양 PRODUCT_PAGE", (r) => r.shapeDetail],
      ["④   🔴 그중 🇰🇷 = **KPI**", (r) => r.krShapeDetail],
      ["⑤ accepted(풀 진입)", (r) => r.accepted],
      ["⑥ usable(fetch 성공)", (r) => r.usable],
      ["⑦ MI 입력", (r) => r.miInput],
      ["⑧ SAME", (r) => r.same],
      ["⑨ 🇰🇷 SAME", (r) => r.krSame],
      ["⑩ 🇰🇷 가격 확인 SAME", (r) => r.krPriced],
    ];
    console.log("\n══════ 🔴 WU-156 Query 비교표 ══════");
    console.log(`  ${"단계".padEnd(26)} ${out.map((r) => r.id.padStart(7)).join("")}`);
    for (const [label, f] of ROWS) {
      console.log(`  ${label.padEnd(26)} ${out.map((r) => String(f(r)).padStart(7)).join("")}`);
    }
    const best = Math.max(...out.map((r) => r.krShapeDetail));
    console.log(`\n  🔴🔴 **KPI(🇰🇷 PRODUCT_DETAIL candidate) 최대값 = ${best}**`);
    console.log(`  🔴 GO 기준(≥3) ${best >= 3 ? "충족" : "**미달**"} · 목표(≥5) ${best >= 5 ? "충족" : "미달"}`);

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(out.length).toBe(QUERIES.length);
  }, 900_000);
});
