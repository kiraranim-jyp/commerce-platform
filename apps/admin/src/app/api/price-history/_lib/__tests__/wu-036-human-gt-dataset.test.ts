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
 * WU-036 — **AI 후보 → MI → 사람 육안 GT** 3-Way 검증 자료 생성
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 **판정하지 않는다.** CEO 가 실제 페이지를 보고 판정할 수 있도록
 *    «자료» 를 만든다. 운영 코드 변경 0 · AI 호출 **0** · HTTP **0**(캐시) · 비용 0.
 *
 * ── 🔴🔴 blind review 설계 (CPO §2) ──────────────────────────────────────
 * 「사람 판단 기준은 AI/MI 결과를 **먼저 보지 않는 것**을 원칙으로 한다.」
 * 그래서 산출 JSON 은 두 덩어리로 갈라서 낸다:
 * ```
 * visible   원상품 정보 · 후보 URL · 도메인 · 후보 페이지 제목(여는 데 필요)
 * sealed    MI verdict · MI blockers · 우리가 «추출한» 값 · AI 출처
 * ```
 * 🔴 `sealed` 를 화면이 **판정 입력 전에 보여주지 않는다**. 우리 추출값까지 가리는
 *    이유는, 그것을 보면 사람이 **페이지가 아니라 우리 추출을 검증하게 되기** 때문이다.
 *
 * ── 🔴 AI 출처는 보존하되 «판정» 으로 쓰지 않는다 (CPO §2) ────────────────
 * `aiProviders` 와 `aiRawAnswer` 를 싣지만 **GT 로도 MI 입력으로도 쓰지 않는다.**
 *
 * 🔴 기본 SKIP — `WU_036_DATASET=1`.
 */

const LIVE = process.env.WU_036_DATASET === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const GT = path.join(OUT, "mi-022-gt.json");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");

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
const norm = (u: string) => {
  try {
    const x = new URL(u);
    return (x.hostname + x.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

const maybe = LIVE ? it : it.skip;

describe("WU-036 — 육안 GT 검증 자료", () => {
  maybe(
    "원상품 · AI 출처 · 후보 URL · (봉인된) MI 결과를 한 건씩 묶는다",
    async () => {
      for (const f of [CASES, GT, SEARCH]) expect(existsSync(f), f).toBe(true);
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: unknown;
      }[];
      const gtRows = JSON.parse(readFileSync(GT, "utf8")) as {
        searchId: string;
        candidateUrl: string;
        gt: string;
        gtReason?: string;
      }[];
      const search = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; model: string; candidates?: string[] }[];
      };

      /** 🟢 AI 출처 역색인 — 같은 URL 을 여러 AI 가 냈으면 **전부** 보존한다. */
      const providersByUrl: Record<string, Set<string>> = {};
      for (const r of search.rows) {
        for (const u of r.candidates ?? []) {
          (providersByUrl[norm(u)] ??= new Set()).add(r.model);
        }
      }

      const originCache: Record<string, { facts: ProductFacts; sourceUrl: string; title: string }> = {};
      const items: Record<string, unknown>[] = [];

      for (const [i, gtRow] of gtRows.entries()) {
        const origin = ORIGINS[gtRow.searchId];
        if (!origin) continue;
        if (!originCache[gtRow.searchId]) {
          const snapshot = cases.find((c) => c.id === origin.snapshotId);
          expect(snapshot).toBeTruthy();
          /** 🔴 CONTROL — 선행 WU 와 같은 원상품인지 매번 확인한다. */
          expect(canonicalizeProductUrl(snapshot!.source_url)).toBe(canonicalizeProductUrl(origin.expectedOrigin));
          const dna = buildProductIdentityDna(backfillCanonicalProduct(snapshot!.canonical_product as never));
          originCache[gtRow.searchId] = {
            facts: productFactsFromIdentityDna(dna),
            sourceUrl: dna.sourceUrl,
            title: dna.title,
          };
        }
        const o = originCache[gtRow.searchId];

        const factsFile = path.join(CACHE, `${key(gtRow.candidateUrl)}.facts.json`);
        const cached = existsSync(factsFile)
          ? (JSON.parse(readFileSync(factsFile, "utf8")) as {
              fetchPath?: string;
              candidate?: { facts?: ProductFacts; title?: string } | null;
            })
          : null;
        const cf = cached?.candidate?.facts ?? null;

        /** 🟢 운영 baseline 재현(WU-033 §1). */
        const prodFacts: ProductFacts | null = cf
          ? cf.brandModelCode === null && o.facts.brandModelCode
            ? {
                ...cf,
                brandModelCode: confirmBrandCodeInEvidence(o.facts.brandModelCode, {
                  title: cf.title,
                  url: cf.sourceUrl,
                  sku: cf.sellerSku ?? null,
                }),
              }
            : cf
          : null;
        const cmp = prodFacts ? compareCrossSellerProducts(o.facts, prodFacts) : null;

        items.push({
          id: `C${String(i + 1).padStart(2, "0")}`,
          searchId: gtRow.searchId,
          /* ── visible: 사람이 판정 «전» 에 보는 것 ─────────────────────── */
          origin: {
            url: o.sourceUrl,
            title: o.title,
            brand: o.facts.brand,
            modelCode: o.facts.brandModelCode,
            color: o.facts.colorText,
            category: o.facts.categoryText,
            material: o.facts.materialText,
            imageUrls: (o.facts.imageUrls ?? []).slice(0, 3),
          },
          candidate: {
            url: gtRow.candidateUrl,
            domain: (() => {
              try {
                return new URL(gtRow.candidateUrl).hostname.replace(/^www\./, "");
              } catch {
                return "?";
              }
            })(),
            /** 🟡 페이지 제목만 노출 — 그 페이지를 여는 데 필요한 «이름표» 다. */
            pageTitle: cf?.title ?? cached?.candidate?.title ?? null,
            reachable: cf !== null,
          },
          /* ── sealed: 판정을 «기록한 뒤» 에만 보여준다 ──────────────────── */
          sealed: {
            aiProviders: [...(providersByUrl[norm(gtRow.candidateUrl)] ?? [])].sort(),
            miVerdict: cmp?.verdict ?? null,
            miAxes: (cmp?.axes ?? []).map((a: { axis?: string } | string) =>
              typeof a === "string" ? a : (a.axis ?? ""),
            ),
            miBlockers: (cmp?.blockers ?? []).map((b: { blocker?: string } | string) =>
              typeof b === "string" ? b : (b.blocker ?? ""),
            ),
            miConflicts: (cmp?.conflicts ?? []).map((c: { conflict?: string } | string) =>
              typeof c === "string" ? c : (c.conflict ?? ""),
            ),
            fetchPath: cached?.fetchPath ?? null,
            extracted: cf
              ? {
                  brand: cf.brand,
                  modelCode: cf.brandModelCode,
                  color: cf.colorText,
                  category: cf.categoryText,
                  material: cf.materialText,
                  images: (cf.imageUrls ?? []).length,
                }
              : null,
            /** 🔴 **기존 GT 다.** 사람 판정과 «대조» 하는 용도이고 정답으로 보여주지 않는다. */
            priorGt: gtRow.gt,
            priorGtReason: gtRow.gtReason ?? null,
          },
        });
      }

      writeFileSync(path.join(OUT, "wu-036-review-dataset.json"), JSON.stringify(items, null, 2));
      const byProvider: Record<string, number> = {};
      for (const it of items) {
        for (const p of (it.sealed as { aiProviders: string[] }).aiProviders) byProvider[p] = (byProvider[p] ?? 0) + 1;
      }
      // eslint-disable-next-line no-console
      console.log(
        "[WU-036]",
        JSON.stringify({
          items: items.length,
          origins: Object.keys(originCache).length,
          reachable: items.filter((i) => (i.candidate as { reachable: boolean }).reachable).length,
          byProvider,
        }),
      );

      expect(items.length).toBe(51);
      /** 🔴 출처가 비어 있으면 AI별 KPI 를 낼 수 없다 — 전건 있어야 한다. */
      expect(items.every((i) => (i.sealed as { aiProviders: string[] }).aiProviders.length > 0)).toBe(true);
    },
    10 * 60_000,
  );
});
