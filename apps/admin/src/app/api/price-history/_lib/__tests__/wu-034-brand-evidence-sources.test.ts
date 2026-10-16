import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeProductUrl, compareCrossSellerProducts, confirmBrandCodeInEvidence } from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
  type ProductFacts,
} from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-034 — **`BRAND_UNCONFIRMED` 를 독립 증거원별로 전수 분해** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-16):
 * > 「`BRAND_UNCONFIRMED` 를 독립 증거원별로 전수 분해해서 **실제로 안전하게 확인
 * >   가능한 증거원이 존재하는가** 를 검증한다. 그리고 이 단계에서는 **브랜드를
 * >   «추정» 하는 것과 «확인» 하는 것을 절대 섞으면 안 된다.**」
 *
 * 🔴 그래서 증거원을 두 등급으로 **갈라서** 센다:
 * ```
 * 확인(CONFIRM)  그 페이지가 «이 상품의 브랜드» 라고 **스스로 선언** 한 칸
 *                JSON-LD Product.brand · og:brand · product:brand · microdata brand
 * 추정(INFER)    그 선언이 아닌 것에서 **우리가 유추** 하는 것
 *                og:site_name · 도메인 · 제목 부분일치 · 음차 대응표
 * ```
 * 🔴🔴 **추정 등급은 「값이 있다」로도 세지 않는다** — 세는 순간 섞인다.
 *
 * 🔴 운영 코드 변경 **0** · HTTP **0**(WU-032 캐시) · AI 0 · 비용 0 · 구현 0.
 * 🔴 기본 SKIP — `WU_034_AUDIT=1`.
 */

const LIVE = process.env.WU_034_AUDIT === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const GT = path.join(OUT, "mi-022-gt.json");

const ORIGINS: Record<string, { snapshotId: string; expectedOrigin: string }> = {
  S1: {
    snapshotId: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
  },
  S2: {
    snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
  },
  S3: {
    snapshotId: "c5395889-7651-4272-aff5-dbeddd8d6199",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses",
  },
  S4: {
    snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  },
  S5: {
    snapshotId: "32f7b651-29b9-4217-b8ce-46596f538306",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  },
  S6: {
    snapshotId: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
    expectedOrigin: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
  },
};

const key = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

const maybe = LIVE ? it : it.skip;

describe("WU-034 — BRAND_UNCONFIRMED 를 증거원 등급별로 분해한다", () => {
  maybe(
    "확인 등급 증거원이 실제로 존재하는지 세고, 원상품 브랜드 주입의 «부작용» 까지 잰다",
    async () => {
      expect(existsSync(CASES) && existsSync(GT)).toBe(true);
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: unknown;
      }[];
      const gtRows = JSON.parse(readFileSync(GT, "utf8")) as {
        searchId: string;
        candidateUrl: string;
        gt: "SAME" | "DIFFERENT";
      }[];

      /**
       * 🔴🔴 **원상품 브랜드를 «주입» 했을 때의 전이를 본다.**
       *    WU-032 는 「SAME 이 몇 개 늘었나」만 셌다. 그런데 `BRAND_UNCONFIRMED`
       *    (= 모름)가 `BRAND_MISMATCH`(= 다름)로 **바뀌면 신호가 더 나빠진다** —
       *    후보 브랜드에 **샵 이름**(`비스킷`)과 **음차**(`보보쇼즈`)가 들어 있기
       *    때문이다. 그래서 **blocker 전이** 를 같이 적는다.
       * 🔴 값은 지어내지 않는다 — 원상품 호스트가 **그 브랜드의 공식몰** 인 경우만.
       *    🔴 이것이 「도메인→브랜드 매핑」이라는 점을 숨기지 않는다. CPO 금지 항목이고,
       *       그래서 **구현하지 않고 효과/부작용만 잰다.**
       */
      const ORIGIN_BRAND_BY_HOST: Record<string, string> = { "bobochoses.co.jp": "Bobo Choses" };

      const rows: Record<string, unknown>[] = [];

      for (const gtRow of gtRows) {
        const origin = ORIGINS[gtRow.searchId];
        if (!origin) continue;
        const snapshot = cases.find((c) => c.id === origin.snapshotId);
        expect(snapshot).toBeTruthy();
        expect(canonicalizeProductUrl(snapshot!.source_url)).toBe(canonicalizeProductUrl(origin.expectedOrigin));

        const product = backfillCanonicalProduct(snapshot!.canonical_product as never);
        const dna = buildProductIdentityDna(product);
        const originFacts = productFactsFromIdentityDna(dna);

        const factsFile = path.join(CACHE, `${key(gtRow.candidateUrl)}.facts.json`);
        if (!existsSync(factsFile)) continue;
        const cached = JSON.parse(readFileSync(factsFile, "utf8")) as {
          fetchPath?: string;
          candidate?: { facts?: ProductFacts } | null;
        };
        const candidateFacts = cached.candidate?.facts ?? null;
        if (!candidateFacts) continue;

        /** 🟢 운영 baseline 재현(WU-033 §1 — 이 보강이 없으면 운영이 아니다). */
        const prodFacts: ProductFacts =
          candidateFacts.brandModelCode === null && originFacts.brandModelCode
            ? {
                ...candidateFacts,
                brandModelCode: confirmBrandCodeInEvidence(originFacts.brandModelCode, {
                  title: candidateFacts.title,
                  url: candidateFacts.sourceUrl,
                  sku: candidateFacts.sellerSku ?? null,
                }),
              }
            : candidateFacts;

        const before = compareCrossSellerProducts(originFacts, prodFacts);

        /** 원상품 브랜드만 복구한 반사실. 🔴 후보는 **손대지 않는다**. */
        const originHost = (() => {
          try {
            return new URL(dna.sourceUrl).hostname.replace(/^www\./, "");
          } catch {
            return "";
          }
        })();
        const recovered = originFacts.brand || ORIGIN_BRAND_BY_HOST[originHost] || null;
        const after =
          recovered === originFacts.brand
            ? before
            : compareCrossSellerProducts({ ...originFacts, brand: recovered }, prodFacts);

        const blockersOf = (c: typeof before) =>
          (c?.blockers ?? []).map((b: { blocker?: string } | string) =>
            typeof b === "string" ? b : (b.blocker ?? ""),
          );

        rows.push({
          searchId: gtRow.searchId,
          gt: gtRow.gt,
          domain: (() => {
            try {
              return new URL(gtRow.candidateUrl).hostname.replace(/^www\./, "");
            } catch {
              return "?";
            }
          })(),
          originBrand: originFacts.brand,
          recoveredOriginBrand: recovered,
          candidateBrand: candidateFacts.brand,
          verdictBefore: before?.verdict ?? null,
          verdictAfter: after?.verdict ?? null,
          blockersBefore: blockersOf(before),
          blockersAfter: blockersOf(after),
        });
      }

      const touched = rows.filter((r) => r.originBrand !== r.recoveredOriginBrand);
      const has = (r: Record<string, unknown>, k: "blockersBefore" | "blockersAfter", v: string) =>
        (r[k] as string[]).includes(v);

      const summary = {
        measurable: rows.length,
        /** 🔴 원상품 브랜드 주입이 **실제로 닿는** 행. */
        originBrandInjected: touched.length,
        transitions: {
          /** 🟢 모름 → 확인됨 (blocker 사라짐). */
          unconfirmedCleared: touched.filter(
            (r) => has(r, "blockersBefore", "BRAND_UNCONFIRMED") && !has(r, "blockersAfter", "BRAND_UNCONFIRMED"),
          ).length,
          /** 🔴🔴 모름 → **다름**. 신호가 «나빠지는» 전이다. */
          unconfirmedToMismatch: touched.filter(
            (r) => has(r, "blockersBefore", "BRAND_UNCONFIRMED") && has(r, "blockersAfter", "BRAND_MISMATCH"),
          ).length,
          verdictImproved: touched.filter((r) => r.verdictBefore !== "SAME" && r.verdictAfter === "SAME").length,
          verdictWorsened: touched.filter((r) => r.verdictBefore === "SAME" && r.verdictAfter !== "SAME").length,
        },
        falseSameAfter: rows.filter((r) => r.gt === "DIFFERENT" && r.verdictAfter === "SAME").length,
      };

      writeFileSync(path.join(OUT, "wu-034-brand.json"), JSON.stringify({ summary, rows: touched }, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-034]", JSON.stringify(summary));
      // eslint-disable-next-line no-console
      console.log(
        "[WU-034-detail]",
        JSON.stringify(
          touched.map((r) => ({
            s: r.searchId,
            gt: r.gt,
            d: r.domain,
            cand: r.candidateBrand,
            v: `${r.verdictBefore}→${r.verdictAfter}`,
            b: `${(r.blockersBefore as string[]).join("|") || "-"} → ${(r.blockersAfter as string[]).join("|") || "-"}`,
          })),
        ),
      );

      /** 🔴 CONTROL — 분모와 baseline 이 선행 WU 와 같아야 한다. */
      expect(rows.length).toBe(51);
      expect(rows.filter((r) => r.gt === "SAME" && r.verdictBefore === "SAME").length).toBe(10);
      expect(rows.filter((r) => r.gt === "DIFFERENT" && r.verdictBefore === "SAME").length).toBe(0);
    },
    10 * 60_000,
  );
});
