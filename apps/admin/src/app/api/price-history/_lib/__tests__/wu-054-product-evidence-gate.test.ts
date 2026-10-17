import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd, extractMicrodataFromHtml } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-054 — **Product Evidence Gate 안전성 전수 검증** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 검토 대상 규칙:
 * ```
 * URL shape = PRODUCT_PAGE → fetch
 *   JSON-LD Product 있음   → 후보 유지
 *   microdata Product 있음 → 후보 유지
 *   둘 다 없음             → 후보 pool 진입 **보류**
 * ```
 * 🔴🔴 **「Product evidence 없음 = 목록」으로 정의하지 않는다**(CPO §1). 정확한 의미는
 *    **「현재 시스템이 상품임을 입증할 기존 증거가 없다」** 다.
 *
 * ── 🔴 평가 집합은 **전부 기존 데이터** 다. URL 을 새로 만들지 않았다 ──────────
 * ```
 * ① WU-036 Human GT **51건**  — CEO 블라인드 리뷰 · SAME 27 / DIFFERENT 23 / UNCERTAIN 1
 *    🔴 이 51건은 **이미 `factsFromProductUrl` 을 통과해 후보가 된 것들** 이다.
 *       즉 **현행 규칙에서 살아 있는 후보** 이고, gate 가 이들을 떨어뜨리면 **순손실** 이다.
 * ② 알려진 LISTING **7건** — WU-050/051 의 AI URL 6 + WU-052 의 Cafe24 목록 1
 * ```
 *
 * 🔴 **운영 리더로만 측정한다** — `extractFromJsonLd` · `extractMicrodataFromHtml`.
 *    내가 정규식을 따로 쓰면 「운영이 보는 것」과 다른 것을 재게 된다(§5-B).
 *
 * 실행: `WU_054_LIVE=1` (기본 skip · 실제 HTTP ~58회 · 읽기 전용 GET)
 */

const LIVE = process.env.WU_054_LIVE === "1";
const maybe = LIVE ? it : it.skip;
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const GT_FILE = path.join(OUT, "wu-036-3way.json");

interface GtRow {
  id: string;
  candidateUrl: string;
  domain: string;
  miVerdict: string;
  humanGt: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

/** 🔴 WU-050/051 의 AI URL 6건 + WU-052 의 Cafe24 목록 1건. **원문 그대로**(`%%` 포함). */
const KNOWN_LISTINGS = [
  "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=003&utm_source=chatgpt.com",
  "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011&utm_source=chatgpt.com",
  "https://www.lfmall.co.kr/app/search/result/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88%2B%EC%A7%91%EC%97%85?utm_source=chatgpt.com",
  "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=002&page=4&utm_source=chatgpt.com",
  "https://www.lfmall.co.kr/app/search/result/%EB%B3%B4%EB%B3%B4%EC%87%BC%%EC%A6%88%2B%EC%A7%91%EC%97%85?utm_source=chatgpt.com",
  "https://www.lotteon.com/csearch/search/search?mallId=1&platform=pc&q=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%8826&render=search&utm_source=chatgpt.com",
  "https://www.foretforet.com/product/list.html?cate_no=110",
];

type Evidence = "JSON_LD" | "MICRODATA" | "BOTH" | "NONE" | "NOT_FETCHED" | "UNREACHABLE";

async function probe(url: string): Promise<{
  shape: string;
  evidence: Evidence;
  title: boolean;
  price: boolean;
  brand: boolean;
}> {
  const shape = classifyUrlShape(url);
  if (shape !== "PRODUCT_PAGE") {
    return { shape, evidence: "NOT_FETCHED", title: false, price: false, brand: false };
  }
  const html = await fetchPlainHtml(url);
  /** 🔴🔴 **「받지 못했다」를 「증거가 없다」로 적지 않는다**(§5-B). */
  if (html === null) return { shape, evidence: "UNREACHABLE", title: false, price: false, brand: false };

  const ld = extractFromJsonLd(html);
  const micro = extractMicrodataFromHtml(html);
  const evidence: Evidence = ld && micro ? "BOTH" : ld ? "JSON_LD" : micro ? "MICRODATA" : "NONE";
  return {
    shape,
    evidence,
    title: !!(ld?.title ?? micro?.title),
    price: !!(ld?.price ?? micro?.price),
    brand: !!(ld?.brand ?? micro?.brand),
  };
}

describe("WU-054 — Product Evidence Gate 전수 검증", () => {
  maybe(
    "기존 51건 + 목록 7건으로 gate 안전성을 측정한다",
    async () => {
      expect(existsSync(GT_FILE), GT_FILE).toBe(true);
      const gt = (JSON.parse(readFileSync(GT_FILE, "utf8")) as { rows: GtRow[] }).rows;
      expect(gt).toHaveLength(51);

      const rows: (GtRow & Awaited<ReturnType<typeof probe>> & { kept: boolean })[] = [];
      for (const r of gt) {
        const p = await probe(r.candidateUrl);
        /** 🔴 gate 는 **증거가 확인된 것만** 유지한다. UNREACHABLE 은 「없다」가 아니다. */
        rows.push({ ...r, ...p, kept: p.evidence === "JSON_LD" || p.evidence === "MICRODATA" || p.evidence === "BOTH" });
      }

      const listings: (Awaited<ReturnType<typeof probe>> & { url: string; kept: boolean })[] = [];
      for (const url of KNOWN_LISTINGS) {
        const p = await probe(url);
        listings.push({
          url,
          ...p,
          kept: p.evidence === "JSON_LD" || p.evidence === "MICRODATA" || p.evidence === "BOTH",
        });
      }

      /* ── ② Product evidence 분포 ─────────────────────────────────────── */
      const dist: Record<string, number> = {};
      for (const r of rows) dist[r.evidence] = (dist[r.evidence] ?? 0) + 1;

      /* ── ③ LISTING 제거 효과 (P0-A) ──────────────────────────────────── */
      const listingKept = listings.filter((l) => l.kept);

      /* ── ④ 실제 PRODUCT 손실 (P0-B) ──────────────────────────────────── */
      const excluded = rows.filter((r) => !r.kept);
      const excludedUnreachable = excluded.filter((r) => r.evidence === "UNREACHABLE");
      /** 🔴🔴 **이것이 P0-B 다** — 받아 봤는데 증거가 없어서 떨어지는 것. */
      const excludedNoEvidence = excluded.filter((r) => r.evidence === "NONE");
      const excludedNotFetched = excluded.filter((r) => r.evidence === "NOT_FETCHED");

      /* ── ⑤ SAME 손실 ─────────────────────────────────────────────────── */
      const sameLost = excludedNoEvidence.filter((r) => r.humanGt === "SAME");
      const miSameLost = excludedNoEvidence.filter((r) => r.miVerdict === "SAME");

      /* ── ⑥ 가격증거 손실 ─────────────────────────────────────────────── */
      const priceLost = excludedNoEvidence.filter((r) => r.price);

      const summary = {
        "① 평가 집합": `GT 51 + 목록 ${KNOWN_LISTINGS.length}`,
        "② evidence 분포": dist,
        "③ P0-A 목록 중 gate 통과(=오염 잔존)": `${listingKept.length}/${listings.length}`,
        "④ P0-B 증거부재로 제외": excludedNoEvidence.length,
        "④-b 🔴 UNREACHABLE(측정불가)": excludedUnreachable.length,
        "④-c NOT_FETCHED(shape 가 먼저 막음)": excludedNotFetched.length,
        "⑤ 🔴 Human SAME 손실": sameLost.length,
        "⑤-b 🔴 MI SAME 손실": miSameLost.length,
        "⑥ 🔴 가격증거 손실": priceLost.length,
      };

      // eslint-disable-next-line no-console
      console.log("\n[WU-054 요약] " + JSON.stringify(summary, null, 1));

      // eslint-disable-next-line no-console
      console.log("\n[WU-054 제외 대상 전수]");
      for (const r of excluded) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${r.id} ${r.domain.padEnd(24)} ev=${r.evidence.padEnd(12)} shape=${r.shape.padEnd(13)} mi=${r.miVerdict.padEnd(14)} human=${r.humanGt}`,
        );
      }
      // eslint-disable-next-line no-console
      console.log("\n[WU-054 목록 7건]");
      for (const l of listings) {
        // eslint-disable-next-line no-console
        console.log(`  ${l.kept ? "🔴 유지" : "🟢 제외"} ev=${l.evidence.padEnd(12)} ${l.url.slice(0, 88)}`);
      }

      writeFileSync(path.join(OUT, "wu-054-gate.json"), JSON.stringify({ summary, rows, listings }, null, 2));

      /** 🔴 단언은 **측정이 성립했는지** 까지만. 기대값을 박으면 측정이 아니다. */
      expect(rows).toHaveLength(51);
      expect(listings).toHaveLength(KNOWN_LISTINGS.length);
      /** 🔴 모든 행이 분류됐는가 — 분류되지 않은 행이 있으면 KPI 가 거짓으로 통과한다. */
      expect(excluded.length).toBe(
        excludedNoEvidence.length + excludedUnreachable.length + excludedNotFetched.length,
      );
    },
    30 * 60_000,
  );

  /**
   * 🔴🔴 **원인 분류(CPO §4) — 「증거 없음」이 「내용 없음」이 아니다.**
   *
   * 위에서 제외된 2건은 전부 `beaumonde.co.kr/goods/goods_view.php?goodsNo=…` 이고
   * **`view`(상세) 경로** 다. 그 페이지가 실제로 상품 내용을 갖고 있는지 확인한다 —
   * 🔴 내 probe 의 `title/price/brand` 는 **구조화 데이터 기준** 이므로 그것만 보고
   *    「상품이 아니다」로 읽으면 틀린다.
   */
  maybe(
    "제외된 2건이 «내용은 있는» 상품 페이지인지 확인한다",
    async () => {
      const URLS = [
        "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
        "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000013334",
      ];
      for (const u of URLS) {
        const html = await fetchPlainHtml(u);
        expect(html, `${u} 를 받지 못했다`).not.toBeNull();
        const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html!)?.[1] ?? null;
        const docTitle = /<title[^>]*>([^<]+)<\/title>/i.exec(html!)?.[1]?.trim() ?? null;
        const ldBlocks = (html!.match(/application\/ld\+json/gi) ?? []).length;
        const itemprops = (html!.match(/itemprop\s*=/gi) ?? []).length;
        const krw = /([0-9][0-9,]{4,})\s*원/.exec(html!)?.[1] ?? null;
        // eslint-disable-next-line no-console
        console.log(
          `\n  ${u}\n   og:title=${JSON.stringify(og)}\n   <title>=${JSON.stringify(docTitle?.slice(0, 60) ?? null)}` +
            `\n   ld+json 블록 ${ldBlocks} · itemprop ${itemprops} · 본문 「원」 금액 ${JSON.stringify(krw)}`,
        );
        /** 🟢 **상품명은 있다** — 그래서 현행 경로가 이 페이지를 후보로 만들 수 있었다. */
        expect(og ?? docTitle, "상품명조차 없다면 전제가 달라진다").toBeTruthy();
        /** 🔴 그런데 구조화 데이터는 **둘 다 0** 이다 — 그것이 제외의 원인이다. */
        expect(ldBlocks).toBe(0);
        expect(itemprops).toBe(0);
      }
    },
    10 * 60_000,
  );

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 §addendum — **다음 WU 의 과녁이 맞는지** 한 번만 재 둔다
   * ══════════════════════════════════════════════════════════════════════════
   *
   * CPO 가 다음 WU 의 목표로 「① 본문 가격 ② 한글 브랜드」를 꼽았다. 🔴 그런데
   * C27 의 `og:title` 에는 **품번 `B226AC010` 이 그대로 있다**. 그리고 WU-004 가
   * `confirmBrandCodeInEvidence` 의 건초더미를 **title + url + sku** 로 넓혀 뒀다
   * (match.ts:601). ⟹ **품번 축이 이미 서 있을 가능성** 이 있다.
   *
   * 그렇다면 다음 WU 의 과녁은 「한글 브랜드 사전」이 아니라
   * **「품번이 확인됐을 때 BRAND_UNCONFIRMED 를 어떻게 다룰 것인가」**(= WU-035 의
   * 질문)가 된다. 🔴 전제가 틀린 채 큰 WU 를 열면 비싸므로 **구현 0 으로 사실만** 적는다.
   *
   * 🔴 새 규칙·새 사전·새 축 **0**. 운영 함수(`withConfidence`)를 그대로 1회 부른다.
   */
  maybe(
    "addendum — C27 의 품번 축이 이미 서 있는가 (다음 WU 과녁 확인)",
    async () => {
      const gtRows = (JSON.parse(readFileSync(GT_FILE, "utf8")) as { rows: GtRow[] }).rows;
      const c27 = gtRows.find((r) => r.id === "C27");
      expect(c27, "C27 이 GT 에 없다").toBeTruthy();

      const { factsFromProductUrl, withConfidence, productFactsFromListing } = await import("@commerce/crawler");

      /** 🔴 원상품은 WU-038 덤프에 있는 그 스냅샷이 아니다 — C27 의 origin 은
       *     junioredition B226AC010 이고, 우리 덤프에 없다. 그래서 **DB 를 다시 읽지
       *     않고**, 이 addendum 은 **후보 쪽 사실만** 본다(원상품 축은 측정하지 않는다). */
      const probed = await factsFromProductUrl(c27!.candidateUrl);
      expect(probed.status, "C27 후보를 열지 못했다").toBe("OK");
      const cand = probed.candidate!;

      /**
       * 🔴 **원상품 품번을 «우리가 아는 값» 으로 넣어** 품번 축이 서는지만 본다.
       *    `B226AC010` 은 C01 에서 이미 확인된 그 상품의 품번이고(원상품 제목이
       *    「Booty Ghosts … by Bobo Choses」), 지어낸 값이 아니다.
       * 🔴 브랜드는 **의도적으로 비운다** — 「브랜드 없이 품번만 있을 때」를 재는 것이
       *    이 addendum 의 목적이다.
       */
      const originFactsLike = productFactsFromListing({
        title: "Booty Ghosts Long Sleeve T-Shirt",
        /**
         * 🔴🔴 **1차 실행에서 내 하니스가 틀렸다.** origin URL 을 후보 URL 에서
         *    만들어 **호스트가 같아졌고**(beaumonde.co.kr), 그래서
         *    `SAME_SELLER_DISTINCT_LISTING` 이 **거짓으로** 발화했다.
         *    🟢 실제 C27 의 origin 은 **junioredition.com** 이다(GT 에 적혀 있다).
         */
        url: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt",
        brand: undefined,
      });
      const scored = withConfidence(
        {
          title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
          sku: "B226AC010",
          sourceUrl: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt",
          facts: { ...originFactsLike, brandModelCode: "B226AC010" },
        } as never,
        [cand] as never,
      );
      const s = scored[0] as unknown as {
        crossSellerVerdict?: string;
        crossSellerBlockers?: ({ blocker: string } | string)[];
        facts?: { brandModelCode?: string | null; brand?: string | null };
      };

      // eslint-disable-next-line no-console
      console.log(
        `\n[WU-054 addendum] C27 후보 제목=${JSON.stringify(cand.title?.slice(0, 70))}\n` +
          `   후보 facts.brandModelCode = ${JSON.stringify(s.facts?.brandModelCode ?? null)}\n` +
          `   후보 facts.brand          = ${JSON.stringify(s.facts?.brand ?? null)}\n` +
          `   verdict = ${s.crossSellerVerdict ?? "null"} · blockers = ${JSON.stringify(
            (s.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
          )}`,
      );

      /** 🔴 단언은 **관측 성립** 까지만 — 기대값을 박지 않는다(이건 측정이다). */
      expect(cand.title, "후보 제목이 비었다").toBeTruthy();
    },
    10 * 60_000,
  );
});
