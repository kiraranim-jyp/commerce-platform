import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { launchChromium } from "../browser-launcher";
import { extractProductData } from "../product-data-extractor";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **실제 HTML 에서 옵션이 «뽑히는가».** (CPO 승인 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 왜 이 파일이 생겼나 ─────────────────────────────────────────────────
 * P2-3(`02592bc`)는 Offer → 사이즈 «변환» 을 닫았지만, 그 입력을 **손으로
 * 적었다**(`p2-3-offer-options.test.ts` 의 `MAGRO_OFFERS`). 그래서
 *
 *     「변환 함수가 통과한다」  ≠  「실제 페이지에서 Offer 행을 찾는다」
 *
 * 두 번째를 **한 번도 재지 않았다.** 셀러가 「사이즈가 안 들어온다」고 했을 때
 * 테스트는 전부 초록이었고, 그래서 원인을 가릴 수가 없었다. 그 공백을 메운다.
 *
 * ── 🔴 입력이 실측이다 ────────────────────────────────────────────────────
 * `fixtures/tennis-warehouse-magro-offers.html` 은 2026-10-06 에 그 상품 URL 을
 * 1회 받아 **그대로 저장한 186KB 원본** 이다. 값을 손으로 적지 않는다 — 이 파일의
 * 단정은 전부 그 HTML 을 실제 추출기에 통과시킨 «결과» 를 본다.
 *
 * 🔴 기존 `tennis-warehouse-product.html` 과 **다른 fixture** 다. 그것은 이미지
 * 전략용으로 떠 둔 것이고 `itemprop="offers"` 가 0건이다 — 그 fixture 로는 이
 * 경로를 영원히 검증할 수 없다(이번 조사에서 그것 때문에 한 번 오진했다).
 *
 * 🔴 `p2-3-offer-options.test.ts` 를 **지우지 않는다.** 역할이 다르다:
 *     그 파일   offerRowsToOptions 의 «변환 규칙» (단위 테스트)
 *     이 파일   실제 HTML → 추출기 → optionGroups (통합 테스트)
 *
 * ── 브라우저를 쓰는 이유 ──────────────────────────────────────────────────
 * 추출기의 옵션 경로는 전부 `page.evaluate` 안에서 돈다. 그래서 DOM 이 필요하다.
 * `playwright` 는 이 패키지의 «기존» 의존성이고, fixture 는 `file://` 로 열어
 * 네트워크를 쓰지 않는다(결정적 · 재현 가능).
 */
const FIXTURE = join(__dirname, "fixtures", "tennis-warehouse-magro-offers.html");

/** 이 fixture 가 담고 있는 상품의 사이즈 축. 실제 페이지의 다섯 Offer 다. */
const EXPECTED_SIZES = ["S", "M", "L", "XL", "XXL"];

describe("실제 HTML → 옵션 추출 (P2-3 가 비워 둔 칸)", () => {
  it(
    "🔴 실제 저장된 페이지에서 사이즈 5개와 variants 5개가 «뽑힌다»",
    async () => {
      const html = readFileSync(FIXTURE, "utf8");
      const browser = await launchChromium();
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(FIXTURE).href, { waitUntil: "domcontentloaded" });

        /* ── 전제: 이 fixture 에 실제로 Offer 마크업이 있다 ──────────────────
           🔴 이 단정이 없으면 fixture 가 낡아 Offer 가 사라져도 아래가 조용히
              「옵션 없음」으로 통과한다 — 그것이 이번에 오진한 구조다. */
        const domCounts = await page.evaluate(() => ({
          offers: document.querySelectorAll('[itemprop="offers"][itemscope]').length,
          sku: document.querySelectorAll('[itemprop="sku"]').length,
          selects: document.querySelectorAll("select").length,
          jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
        }));
        expect(domCounts.offers, "fixture 에 Offer 마크업이 없다").toBe(5);
        expect(domCounts.sku).toBe(5);
        /* 🔴 JSON-LD 가 없고 select 가 상품 옵션이 아니라는 것이 이 페이지의 성질이다 —
           그래서 Offer 경로가 «유일한» 옵션 출처다. 그 전제도 같이 못박는다. */
        expect(domCounts.jsonLd).toBe(0);
        expect(domCounts.selects).toBe(1);

        /* ── 실제 추출기를 통과시킨다 ─────────────────────────────────────── */
        const { data } = await extractProductData(html, page);

        expect(data.optionGroups).toHaveLength(1);
        /* 축 이름이 「사이즈」여야 치수 고시(resolveSizeFromOptions)가 찾는다. */
        expect(data.optionGroups?.[0]?.name).toBe("사이즈");
        expect(data.optionGroups?.[0]?.values).toEqual(EXPECTED_SIZES);

        expect(data.variants).toHaveLength(5);
        /* 🔴 variants 가 비면 payload 의 hasRealProductOptions 가 false 가 되어
           optionInfo 블록이 통째로 생략된다 — 그 길을 여기서 막는다. */
        expect(data.variants?.map((v) => v.optionValues["사이즈"])).toEqual(EXPECTED_SIZES);

        /* SKU·재고가 Offer 에서 함께 따라온다(값을 지어내지 않는다). */
        for (const variant of data.variants ?? []) {
          expect(variant.sku, "SKU 가 비었다").toBeTruthy();
          expect(typeof variant.stockQuantity).toBe("number");
        }
        /* 🔴 재고를 전부 같은 값으로 채우지 «않는다» — Offer 별 실측이어야 한다. */
        expect(new Set((data.variants ?? []).map((v) => v.stockQuantity)).size).toBeGreaterThan(1);

        await page.close();
      } finally {
        await browser.close();
      }
    },
    300_000,
  );

  it(
    "🔴 핏 척도(Small / True to Size / Large)가 사이즈로 들어오지 «않는다»",
    async () => {
      /* 이 페이지 본문에는 Overall Sizing 패널이 있다. 본문 스캔이 먼저 답하면
         존재하지 않는 사이즈를 파는 상품이 된다 — Offer 가 그보다 앞서야 한다. */
      const html = readFileSync(FIXTURE, "utf8");
      const browser = await launchChromium();
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(FIXTURE).href, { waitUntil: "domcontentloaded" });
        const { data } = await extractProductData(html, page);
        const values = data.optionGroups?.[0]?.values ?? [];
        /* 🔴 «먼저» 값이 실제로 있다고 못박는다. 이것이 없으면 옵션이 0개일 때도
           아래 `not.toContain` 이 전부 참이 되어 테스트가 공허해진다 —
           실제로 음성 대조에서 그 구멍이 드러났다(Offer 경로를 막았는데 통과). */
        expect(values).toEqual(EXPECTED_SIZES);
        for (const forbidden of ["True to Size", "Small", "Large"]) {
          expect(values, `핏 척도가 사이즈로 들어왔다: ${forbidden}`).not.toContain(forbidden);
        }
        await page.close();
      } finally {
        await browser.close();
      }
    },
    300_000,
  );
});
