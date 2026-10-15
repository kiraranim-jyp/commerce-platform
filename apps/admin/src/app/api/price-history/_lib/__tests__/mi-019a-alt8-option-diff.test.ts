/**
 * WU-019A-ALT-8 — CONFLICT → `SAME_MODEL_OPTION_DIFF` 경로 검증 (HTTP 0 · 수정 0)
 *
 * 🔴 운영 코드 0 · UI 0 · 문구 0 · threshold 0 · 색상사전 0 · 검색 0 · AI 0 · 비용 ₩0.
 * 🟢 ALT-5 가 측정한 **그 2건** 만 쓴다(새 검색·새 후보·새 GT 0).
 *
 * 🔴🔴 ALT-7 에서 드러난 **하니스 누락을 반복하지 않는다** — 운영 순서를 그대로 탄다:
 * ```
 * candidate → withConfidence(점수/cross) → attachProductMatchTruth(productMatchTruth)
 *           → overseasMatchDisplay(화면 등급)      ← 전부 **기존 owner**
 * ```
 * 🔴 재현 한계를 먼저 적는다 — ALT-3 결과 JSON 은 후보의 `sku`/`facts` 를 저장하지
 *    않았다. 그래서 `sku` 는 `undefined` 로 둔다(구조화코드 단계를 건너뛴다).
 *    🟢 이 사례의 판정은 **title 모델명 단계**(splitModelColor)가 결정하므로 그 축은
 *    운영과 동일하게 재현된다. 🔴 「전 구간 동일」이라고 적지 않는다.
 */
import { describe, expect, it } from "vitest";
import {
  attachProductMatchTruth,
  withConfidence,
  type ComparisonCandidate,
  type ComparisonSearchResult,
} from "@commerce/crawler";
import { overseasMatchDisplay } from "../../../../pipeline/commerce/match-display";

/** 🟢 ALT-5 실측값 그대로(원상품 AW26MS185 Grey Melange · Main Story). */
const ORIGIN_TITLE = "Bubble Sweatshirt in Grey Melange by Main Story";
const ORIGIN_URL = "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story";
/** 🟢 WU-019A-ALT-9 — **B10 3건**(cross=PRESUMED_SAME)을 같은 경로로 통과시킨다.
 *    🔴 새 검색·새 후보·새 GT 0 — ALT-3 에서 이미 측정된 그 세 건이다. */
const B10 = [
  { id: "B10 Rose Shadow", title: "AW26MS185 - Bubble Sweatshirt - Rose Shadow", url: "https://www.deuxbebe.com/product/detail.html?product_no=18285", conf: 0.62 },
  { id: "B10 Conker(PRESUMED)", title: "Bubble Sweatshirt in Conker Stripe by Main Story", url: "https://junioredition.com/products/bubble-sweatshirt-in-conker-stripe-by-main-story", conf: 0.78 },
  { id: "B10 Graystone(PRESUMED)", title: "Bubble Sweatshirt in Graystone by Main Story", url: "https://junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story", conf: 0.78 },
];

const CASES = [
  { id: "Conker Stripe", title: "Bubble Sweatshirt in Conker Stripe by Main Story", url: "https://junioredition.com/products/bubble-sweatshirt-in-conker-stripe-by-main-story", conf: 0.78 },
  { id: "Graystone", title: "Bubble Sweatshirt in Graystone by Main Story", url: "https://junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story", conf: 0.78 },
];

describe("WU-019A-ALT-8 — CONFLICT + 같은 모델/다른 색상 → 화면 등급", () => {
  it("운영 순서(withConfidence → attachProductMatchTruth → overseasMatchDisplay)를 그대로 탄다", () => {
    const query = { title: ORIGIN_TITLE, brand: "Main Story", sourceUrl: ORIGIN_URL, sku: "AW26MS185" };

    for (const c of CASES) {
      /* ① 운영과 같은 점수기. 🔴 cross 는 ALT-5 실측값(CONFLICT)을 그대로 싣는다 —
         suggest facts 가 저장돼 있지 않아 재계산할 수 없기 때문이다(한계 명시). */
      const base: ComparisonCandidate = {
        title: c.title, url: c.url, price: null, regularPrice: null, imageUrl: null,
        confidence: c.conf, crossSellerVerdict: "CONFLICT",
      };
      const scored = withConfidence(query, [base]);
      /* ② 🔴 ALT-7 에서 빠뜨린 그 단계. 🔴🔴 그리고 이 함수는 **샵 결과 배열**
         (`ComparisonSearchResult[]`)을 받는다 — 후보 배열을 넘기면 `status !== "ok"`
         에서 **조용히 그대로 반환** 된다(내가 실제로 그렇게 틀렸다 · 열세 번째 계열).
         🟢 운영 호출부(api/comparison/search/route.ts)가 넘기는 모양을 그대로 만든다. */
      const result: ComparisonSearchResult = {
        shopId: "poc", shopName: "poc", domain: "junioredition.com", status: "ok", candidates: scored,
      };
      const attached = attachProductMatchTruth(query, [result]);
      const out = attached[0].candidates[0];
      const truth = out.productMatchTruth;
      /* ③ 화면 등급 owner(컴포넌트가 쓰는 그 함수). */
      const display = truth ? overseasMatchDisplay(truth) : null;

      console.log(
        `  [${c.id}] cross=${out.crossSellerVerdict} matchLevel=${out.matchLevel} ` +
          `conf=${out.confidence}\n      productMatchTruth=${truth} → display tier=${display?.tier} 문구="${display?.label}"`,
      );
      expect(truth, `${c.id}: productMatchTruth 가 비어 있다`).toBeTruthy();
    }
  });

  /** 🔴🔴 ALT-9 — **`cross=PRESUMED_SAME` 이면 같은 쌍이 어떤 등급이 되는가.**
   *    rank 표(product-identity.ts:40): SAME_MODEL_VARIANT **4** vs PRESUMED_SAME → ?
   *    🔴 추측하지 않고 운영 함수로 측정한다. */
  it("ALT-9: cross=PRESUMED_SAME 인 B10 3건의 화면 등급", () => {
    const query = { title: ORIGIN_TITLE, brand: "Main Story", sourceUrl: ORIGIN_URL, sku: "AW26MS185" };
    for (const c of B10) {
      const base: ComparisonCandidate = {
        title: c.title, url: c.url, price: null, regularPrice: null, imageUrl: null,
        confidence: c.conf, crossSellerVerdict: "PRESUMED_SAME",
      };
      const result: ComparisonSearchResult = {
        shopId: "poc", shopName: "poc", domain: "poc", status: "ok", candidates: withConfidence(query, [base]),
      };
      const out = attachProductMatchTruth(query, [result])[0].candidates[0];
      const display = out.productMatchTruth ? overseasMatchDisplay(out.productMatchTruth) : null;
      console.log(
        `  [${c.id}] cross=${out.crossSellerVerdict} matchLevel=${out.matchLevel} conf=${out.confidence}` +
          `
      productMatchTruth=${out.productMatchTruth} → tier=${display?.tier} 문구="${display?.label}"`,
      );
      expect(out.productMatchTruth).toBeTruthy();
    }
  });
});
