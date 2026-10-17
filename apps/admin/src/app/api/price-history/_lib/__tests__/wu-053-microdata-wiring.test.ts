import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractMicrodataFromHtml,
  productFactsFromListing,
  withConfidence,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { factsFromProductUrl } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-053 §2/§5 — **microdata 배선의 before/after 와 False SAME**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §5 가 요구한 KPI 를 **각각** 재고 섞지 않는다:
 * ```
 * 기존 상품페이지 회귀 · NO_FACTS · 가격검증 · HTTP 횟수
 * MI SAME · False SAME · SAME MISS
 * ```
 * 🔴🔴 **False SAME 증가 = 즉시 HOLD**(CPO §5). 그래서 `sellerSku` 는 운영에
 *    올리지 않고 **이 파일에서 반사실로만** 재서 판단 근거를 남긴다.
 *
 * 실행: `WU_053_LIVE=1` (live 섹션만) · 순수 섹션은 항상 돈다.
 */

const LIVE = process.env.WU_053_LIVE === "1";
const maybe = LIVE ? it : it.skip;
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const TENNIS_ORIGINS = path.join(OUT, "wu-053-tennis-origins.json");

/* ══════════════ A. 🔴 안전 게이트 — Product scope 가 1개가 아니면 읽지 않는다 ══════════════ */

describe("A. Product scope 게이트 (순수 · HTTP 0)", () => {
  const PRODUCT_SCOPE = `itemtype="https://schema.org/Product"`;
  const one = `<div ${PRODUCT_SCOPE}><span itemprop="name">Trattino Polo</span>
     <span itemprop="sku" content="STMFTP0"></span>
     <div itemprop="offers"><span itemprop="price" content="120.00"></span>
     <span itemprop="priceCurrency" content="USD"></span></div></div>`;

  it("🟢 scope 1개 → 값을 읽는다", () => {
    const m = extractMicrodataFromHtml(one);
    expect(m?.title).toBe("Trattino Polo");
    expect(m?.sku).toBe("STMFTP0");
    expect(m?.price).toEqual({ amount: 120, currency: "USD" });
  });

  /** 🔴🔴 **목록 방어.** scope 가 둘이면 첫 상품을 읽어 거짓 증거를 만들지 않는다. */
  it("🔴 scope 2개(목록) → null", () => {
    expect(extractMicrodataFromHtml(one + one)).toBeNull();
  });

  it("🔴 scope 0개 → null (기존 동작 불변)", () => {
    expect(extractMicrodataFromHtml(`<div><span itemprop="name">x</span></div>`)).toBeNull();
  });

  /** 🔴 통화 없는 금액은 가격으로 만들지 않는다 — 기존 규약 그대로. */
  it("🔴 통화가 없으면 price 를 만들지 않는다", () => {
    const m = extractMicrodataFromHtml(
      `<div ${PRODUCT_SCOPE}><div itemprop="offers"><span itemprop="price" content="120.00"></span></div></div>`,
    );
    expect(m).not.toBeNull();
    expect(m?.price).toBeUndefined();
  });

  /** 🟢 `content` 가 없으면 텍스트를 쓴다 — DOM 판과 같은 순서다. */
  it("🟢 content 가 없으면 텍스트를 읽는다", () => {
    const m = extractMicrodataFromHtml(`<div ${PRODUCT_SCOPE}><span itemprop="name">Magro Top</span></div>`);
    expect(m?.title).toBe("Magro Top");
  });

  /** 🔴 `http://schema.org/Product` 도 같은 스펙이다(둘 다 쓰인다). */
  it("🟢 http/https 둘 다 scope 로 인식한다", () => {
    expect(extractMicrodataFromHtml(`<div itemtype="http://schema.org/Product"><span itemprop="sku">A</span></div>`)?.sku).toBe("A");
  });
});

/* ══════════════ B. 🔴 배선이 «보강만» 하는지 — 소스로 잠근다 ══════════════ */

describe("B. 배선 경계", () => {
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();
  const src = readFileSync(path.join(repoRoot, "packages/crawler/src/comparison-search/product-url-facts.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /** 🔴 JSON-LD 가 **먼저** 다 — 순서가 뒤집히면 기존 결과가 바뀐다. */
  it("🔴 JSON-LD 가 microdata 보다 우선한다", () => {
    expect(src).toContain("priceFromJsonLd(html) ?? micro?.price ?? null");
    expect(src).toContain("brandFromHtml(html) ?? micro?.brand ?? null");
  });

  /** 🔴🔴 **sku 를 올리지 않는다** — identity 를 바꾸지 않겠다는 계약이다. */
  it("🔴 candidate.sku 를 microdata 로 채우지 않는다", () => {
    expect(src).not.toMatch(/sku:\s*micro/);
    expect(src).not.toMatch(/sellerSku:\s*micro/);
  });

  /** 🔴 추가 HTTP 가 없다 — 이미 받은 html 만 읽는다. */
  it("🔴 microdata 때문에 fetch 가 늘지 않는다", () => {
    const after = src.slice(src.indexOf("extractMicrodataFromHtml(html)"));
    expect(after).not.toMatch(/fetchPlainHtml|fetchWithDomainRateLimit/);
  });
});

/* ══════════════ C. 🔴 실측 before/after + False SAME 반사실 ══════════════ */

describe("C. 실측 (live)", () => {
  maybe(
    "CONTROL 여섯 유형 · 가격 획득 · sku 반사실",
    async () => {
      const CONTROL = [
        { url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt", kind: "JSON-LD 상품" },
        { url: "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue", kind: "JSON-LD 상품(국내)" },
        { url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", kind: "JSON-LD 상품(Cafe24)" },
        {
          url: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Trattino_Polo/descpageMASGT-STMFTP.html",
          kind: "🔴🔴 microdata-only 상품",
        },
        { url: "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=003", kind: "🔴 목록" },
        { url: "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011", kind: "🔴 목록" },
      ];

      // eslint-disable-next-line no-console
      console.log("\n[WU-053 after] kind | status | HTTP | price | priceStatus | brand");
      let httpTotal = 0;
      const results: Record<string, unknown>[] = [];
      /** 🔴 후보 객체를 **보관** 한다 — 아래 반사실에서 같은 URL 을 두 번 열지 않기 위해서다. */
      const candidates: Awaited<ReturnType<typeof factsFromProductUrl>>["candidate"][] = [];
      for (const c of CONTROL) {
        const r = await factsFromProductUrl(c.url);
        candidates.push(r.candidate);
        httpTotal += r.httpCalls;
        results.push({
          kind: c.kind,
          status: r.status,
          httpCalls: r.httpCalls,
          price: r.candidate?.price ? `${r.candidate.price.currency} ${r.candidate.price.amount}` : null,
          priceStatus: r.candidate?.priceStatus ?? null,
          brand: r.candidate?.brand ?? null,
          /** 🔴 sku 가 올라가지 않았음을 **런타임으로** 확인한다(소스 가드와 이중). */
          sku: r.candidate?.sku ?? null,
        });
        const last = results[results.length - 1]!;
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(last.kind).padEnd(26)} ${String(last.status).padEnd(10)} http=${last.httpCalls} price=${last.price ?? "없음"} (${last.priceStatus ?? "-"}) brand=${last.brand ?? "-"} sku=${last.sku ?? "-"}`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(`  HTTP 합계 ${httpTotal}`);

      /** 🟢 목표 — microdata-only 상품이 **가격을 얻는다**. */
      const tennis = results[3]!;
      expect(tennis.status, "microdata-only 상품이 OK 여야 한다").toBe("OK");
      expect(tennis.price, "🔴 microdata 가격이 올라오지 않았다").not.toBeNull();
      expect(tennis.priceStatus).toBe("VERIFIED_CURRENT");
      /** 🟢 브랜드도 microdata 에서 올라온다 — M2 변이가 이것을 증명한다. */
      expect(tennis.brand, "🔴 microdata 브랜드가 올라오지 않았다").toBe("Sergio Tacchini");
      /** 🔴🔴 sku 는 **올라가지 않아야** 한다. */
      expect(tennis.sku, "🔴 sku 가 올라갔다 — identity 가 바뀔 수 있다").toBeNull();

      /**
       * 🔴🔴 **내 단언이 처음 틀렸다 — 숨기지 않고 적는다.**
       *    `results[0]`(bobochoses)·`[1]`(tinyapple)은 `/products/` 라 **Shopify JSON
       *    경로** 다. 그 경로는 통화를 모르므로 `price: null` 을 **의도적으로** 둔다
       *    (product-url-facts.ts:188 — 가격은 뒤의 `enrichCandidatePrices` 가 채운다).
       *    그런데 나는 그 둘을 「JSON-LD 상품」으로 묶고 `VERIFIED_CURRENT` 를 기대했다.
       * 🟢 HTML+JSON-LD 경로의 회귀 대조군은 **`[2]` foretforet** 이다.
       */
      expect(results[0]!.status, "Shopify 경로는 그대로 OK").toBe("OK");
      expect(results[0]!.price, "🔴 Shopify 경로에 가격을 만들어선 안 된다(설계)").toBeNull();
      expect(results[1]!.price).toBeNull();
      /** 🟢 HTML+JSON-LD 는 **한 글자도 바뀌지 않는다** — microdata scope 가 0 이다. */
      expect(results[2]!.priceStatus).toBe("VERIFIED_CURRENT");
      expect(results[2]!.price).toBe("KRW 258000");

      /** 🔴 목록 2건은 **여전히** 상품 증거를 얻지 못한다(= 거짓 승격 0). */
      for (const i of [4, 5]) {
        expect(results[i]!.price, `목록(${i}) 이 가격을 얻었다`).toBeNull();
      }

      /* ── 🔴🔴 sku 반사실 — 올렸다면 identity 가 어떻게 바뀌는가 ──────────── */
      expect(existsSync(TENNIS_ORIGINS), TENNIS_ORIGINS).toBe(true);
      const origins = JSON.parse(readFileSync(TENNIS_ORIGINS, "utf8")) as {
        id: string;
        title: string;
        canonical_product: unknown;
      }[];
      /** 🔴 원상품은 **다른 품목** 이다(Short ↔ Polo) — GT = DIFFERENT. */
      const origin = origins.find((o) => /Trattino Short/i.test(o.title)) ?? origins[0]!;
      const dna = buildProductIdentityDna(backfillCanonicalProduct(origin.canonical_product as never));
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        /**
         * 🔴🔴 **운영 식을 그대로 베낀다**(run-domestic-price-check.ts:786).
         *    처음에 `dna.sku?.value` 로 썼고 그 칸은 **존재하지 않는다** —
         *    실제 칸은 `identifier` 이고 `tier === "SKU"` 일 때만 쓴다
         *    (ProductIdentityDna:57-58). 그래서 1차 반사실은 `query.sku === undefined`
         *    로 돌아 **`match.ts:461` 경로가 발화조차 하지 않았다** = 측정 무효였다.
         *    🔴 이 트랙 **열한 번째** 칸 이름 추측 실수다.
         */
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        sourceUrl: dna.sourceUrl,
        facts: productFactsFromIdentityDna(dna),
      };

      const baseCandidate = candidates[3]!;
      const verdictOf = (cand: typeof baseCandidate) =>
        withConfidence(query, [cand] as never)[0]?.crossSellerVerdict ?? null;

      const withoutSku = verdictOf(baseCandidate);
      /** 🔴 반사실 — sku 와 sellerSku 를 둘 다 올린 후보. */
      const withSkuCandidate = {
        ...baseCandidate,
        sku: "STMFTP0",
        facts: productFactsFromListing({
          title: baseCandidate.title,
          url: baseCandidate.url,
          brand: baseCandidate.brand,
          sellerSku: "STMFTP0",
        }),
      };
      const withSku = verdictOf(withSkuCandidate as typeof baseCandidate);

      // eslint-disable-next-line no-console
      console.log(
        `\n[WU-053 sku 반사실] 원상품="${origin.title}"(sku ${JSON.stringify(query.sku)}) ↔ 후보="${baseCandidate.title}"\n` +
          `   GT=DIFFERENT · 현행(sku 미올림)=${withoutSku} · 반사실(sku 올림)=${withSku}`,
      );

      /** 🔴🔴 현행은 **SAME 이 아니어야** 한다 — 다른 품목이다. */
      expect(withoutSku, "🔴 FALSE SAME — 다른 품목이 SAME 이 됐다").not.toBe("SAME");
      expect(withSku, "🔴 sku 반사실에서 FALSE SAME 이 생겼다").not.toBe("SAME");
    },
    15 * 60_000,
  );
});
