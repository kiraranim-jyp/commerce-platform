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
 * WU-033 — **잔여 MISS 완전 분해 + 「새 연결축이 있는가」** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **구현하지 않는다.** CPO 금지 6항을 그대로 받는다:
 * ```
 * ❌ 색상 추출 재작업            ❌ SKU 를 brandModelCode 로 억지 귀속
 * ❌ threshold 완화              ❌ PRESUMED → SAME 강제 승격
 * ❌ 도메인→브랜드 Registry 매핑  ❌ AI 판단 사용
 * ```
 * 🔴 그래서 이 파일은 **`compareCrossSellerProducts` 를 호출만** 하고, 새 축을
 *    **판정기에 배선하지 않는다** — 축의 «판별력» 만 독립적으로 잰다.
 *
 * 🔴 HTTP **0** — WU-032 가 받아 둔 디스크 캐시만 읽는다. AI 0 · 비용 0.
 * 🔴 기본 SKIP — `WU_033_AUDIT=1` 없이는 돌지 않는다.
 */

const LIVE = process.env.WU_033_AUDIT === "1";
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

/* ────────────────────────────────────────────────────────────────────────────
 * 새 연결축 후보 — 🔴 **판정기에 넣지 않는다. 판별력만 잰다.**
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * 🟢 **이미지 자산 이름**. 같은 상품을 파는 서로 다른 샵은 **브랜드가 배포한 같은
 *    상품 사진**을 그대로 올리는 경우가 많다. 그 파일명은 판매처가 지어낸 값이
 *    아니라 **브랜드 쪽 자산 이름** 이다.
 * 🔴 CDN 변형 꼬리(`_1024x1024`, `_800x`, `@2x`)와 쿼리를 벗겨야 같은 자산이
 *    같은 이름이 된다.
 */
function imageAssetNames(urls: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of urls) {
    let base: string;
    try {
      base = new URL(raw, "https://x.invalid").pathname.split("/").pop() ?? "";
    } catch {
      base = raw.split("?")[0]?.split("/").pop() ?? "";
    }
    base = base
      .replace(/\.(jpe?g|png|webp|avif|gif)$/i, "")
      .replace(/[_-]\d{2,4}x\d{0,4}$/i, "")
      .replace(/@\d+x$/i, "")
      .trim()
      .toLowerCase();
    if (base.length >= 4) out.add(base);
  }
  return out;
}

/** 🔴 품번은 «정규화해서» 본다 — 하이픈/공백/대소문자만 걷는다(새 규칙 0). */
const normCode = (s: string) => s.replace(/[\s_-]/g, "").toLowerCase();

interface NewAxisSignals {
  /** ① 원상품과 후보가 **같은 이미지 자산**을 쓰는가. */
  sharedImageAsset: boolean;
  sharedImageCount: number;
  /** ② 원상품 품번이 후보의 **이미지 파일명**에 있는가(제목·URL 이 아니라). */
  codeInImageName: boolean;
  /** ③ 원상품 품번이 후보 **URL slug** 에 있는가. */
  codeInUrlSlug: boolean;
  /** ④ 원상품 품번이 후보 **제목**에 있는가 — 🟢 기존 WU-004 가 이미 보는 자리(대조군). */
  codeInTitle: boolean;
  /** ⑤ 후보가 이미지를 **아예 갖고 있지 않은가**(측정불가 분모). */
  candidateHasImages: boolean;
}

function newAxisSignals(origin: ProductFacts, candidate: ProductFacts): NewAxisSignals {
  const oImgs = imageAssetNames(origin.imageUrls ?? []);
  const cImgs = imageAssetNames(candidate.imageUrls ?? []);
  let shared = 0;
  for (const n of cImgs) if (oImgs.has(n)) shared++;

  const code = origin.brandModelCode ? normCode(origin.brandModelCode) : null;
  const inImage =
    !!code && [...cImgs].some((n) => normCode(n).includes(code));
  const inSlug = !!code && normCode(candidate.urlSlug ?? "").includes(code);
  const inTitle = !!code && normCode(candidate.title ?? "").includes(code);

  return {
    sharedImageAsset: shared > 0,
    sharedImageCount: shared,
    codeInImageName: inImage,
    codeInUrlSlug: inSlug,
    codeInTitle: inTitle,
    candidateHasImages: cImgs.size > 0,
  };
}

const maybe = LIVE ? it : it.skip;

describe("WU-033 — 잔여 MISS 의 원인과 «새 연결축» 가능성", () => {
  maybe(
    "14 MISS 를 전수 분해하고, 판정기 밖에서 새 축의 판별력을 잰다",
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
        /** 🔴 캐시가 없으면 **지어내지 않는다** — 그 행은 측정불가다(HTTP 0 원칙). */
        if (!existsSync(factsFile)) {
          rows.push({ searchId: gtRow.searchId, candidateUrl: gtRow.candidateUrl, gt: gtRow.gt, status: "NO_CACHE" });
          continue;
        }
        const cached = JSON.parse(readFileSync(factsFile, "utf8")) as {
          fetchPath?: string;
          candidate?: { facts?: ProductFacts } | null;
        };
        const candidateFacts = cached.candidate?.facts ?? null;
        if (!candidateFacts) {
          rows.push({ searchId: gtRow.searchId, candidateUrl: gtRow.candidateUrl, gt: gtRow.gt, status: "NO_FACTS" });
          continue;
        }

        /* ════════════════════════════════════════════════════════════════════
         * 🔴🔴 **운영 baseline 을 «재현» 한다 — 직접 호출은 운영이 아니다.**
         *
         * 첫 실행에서 verdict 분포가 WU-031 과 어긋났다(PRESUMED 13/SIMILAR 1 →
         * 7/7). 원인은 `withConfidence`(match.ts:507-520)가 비교 **전에**
         * `confirmBrandCodeInEvidence(title · url · sku)` 로 후보 품번을 **확인해
         * 채워 넣기** 때문이다(WU-004). 그 보강을 빼고 재면 **다른 제품을 재는 것** 이다.
         *
         * 🔴 그래서 「URL slug 에 품번이 있다」는 **새 축이 아니다** — 이미 운영이 본다.
         * ══════════════════════════════════════════════════════════════════════ */
        const withProductionAugment = (extraHaystack?: string | null): ProductFacts =>
          candidateFacts.brandModelCode === null && originFacts.brandModelCode
            ? {
                ...candidateFacts,
                brandModelCode: confirmBrandCodeInEvidence(originFacts.brandModelCode, {
                  title: candidateFacts.title,
                  url: candidateFacts.sourceUrl,
                  sku: extraHaystack ?? candidateFacts.sellerSku ?? null,
                }),
              }
            : candidateFacts;

        /** 🟢 운영과 같은 입력. 이것이 이 WU 의 baseline 이다. */
        const prodFacts = withProductionAugment();
        const cmp = compareCrossSellerProducts(originFacts, prodFacts);

        /* 🔴 **유일하게 «새» 자리**: 이미지 파일명. 건초더미에 **한 칸만** 더한다.
         *    규칙은 바꾸지 않는다 — 같은 `confirmBrandCodeInEvidence` 를 쓴다.
         *    🔴 구현이 아니라 **측정** 이다(운영 코드 변경 0). */
        const imageHaystack = [...imageAssetNames(candidateFacts.imageUrls ?? [])].join(" ");
        const imageFacts = withProductionAugment(
          [candidateFacts.sellerSku ?? "", imageHaystack].filter(Boolean).join(" "),
        );
        const cmpImage = compareCrossSellerProducts(originFacts, imageFacts);

        const signals = newAxisSignals(originFacts, candidateFacts);

        rows.push({
          searchId: gtRow.searchId,
          candidateUrl: gtRow.candidateUrl,
          domain: (() => {
            try {
              return new URL(gtRow.candidateUrl).hostname.replace(/^www\./, "");
            } catch {
              return "?";
            }
          })(),
          gt: gtRow.gt,
          status: "OK",
          fetchPath: cached.fetchPath ?? null,
          verdict: cmp?.verdict ?? null,
          /** 🔴 이미지 파일명을 건초더미에 더했을 때의 판정(측정 전용). */
          verdictWithImageHaystack: cmpImage?.verdict ?? null,
          modelCodeGainedFromImage:
            prodFacts.brandModelCode === null && imageFacts.brandModelCode !== null,
          axes: (cmp?.axes ?? []).map((a: { axis?: string } | string) =>
            typeof a === "string" ? a : (a.axis ?? JSON.stringify(a)),
          ),
          blockers: (cmp?.blockers ?? []).map((b: { blocker?: string } | string) =>
            typeof b === "string" ? b : (b.blocker ?? ""),
          ),
          conflicts: (cmp?.conflicts ?? []).map((c: { conflict?: string } | string) =>
            typeof c === "string" ? c : (c.conflict ?? ""),
          ),
          signals,
          origin: {
            brand: originFacts.brand,
            brandModelCode: originFacts.brandModelCode,
            colorText: originFacts.colorText,
            categoryText: originFacts.categoryText,
            materialText: originFacts.materialText,
            images: (originFacts.imageUrls ?? []).length,
            title: originFacts.title,
          },
          candidate: {
            brand: candidateFacts.brand,
            brandModelCode: candidateFacts.brandModelCode,
            colorText: candidateFacts.colorText,
            categoryText: candidateFacts.categoryText,
            materialText: candidateFacts.materialText,
            images: (candidateFacts.imageUrls ?? []).length,
            title: candidateFacts.title,
          },
        });
      }

      /* ── 새 축의 «판별력» — GT SAME 에서 켜지고 GT DIFFERENT 에서 꺼지는가 ── */
      const ok = rows.filter((r) => r.status === "OK");
      const same = ok.filter((r) => r.gt === "SAME");
      const diff = ok.filter((r) => r.gt === "DIFFERENT");
      const sig = (r: Record<string, unknown>, k: keyof NewAxisSignals) =>
        Boolean((r.signals as NewAxisSignals)[k]);

      const power: Record<string, unknown> = {};
      for (const k of ["sharedImageAsset", "codeInImageName", "codeInUrlSlug", "codeInTitle"] as const) {
        const tp = same.filter((r) => sig(r, k)).length;
        const fp = diff.filter((r) => sig(r, k)).length;
        power[k] = {
          firesOnGtSame: tp,
          firesOnGtDifferent: fp,
          /** 🔴 분모를 적는다 — 「0」을 「완벽」으로 읽지 않기 위해서다. */
          recallOfGtSame: +(tp / same.length).toFixed(3),
          /** 🔴🔴 이 값이 0 이 아니면 **False SAME 위험** 이다. */
          falsePositiveOnDifferent: fp,
        };
      }

      const missRows = ok.filter((r) => r.gt === "SAME" && r.verdict !== "SAME");
      const summary = {
        measurable: ok.length,
        gtSame: same.length,
        gtDifferent: diff.length,
        miss: missRows.length,
        missVerdicts: missRows.reduce<Record<string, number>>((acc, r) => {
          const v = String(r.verdict);
          acc[v] = (acc[v] ?? 0) + 1;
          return acc;
        }, {}),
        candidatesWithImages: ok.filter((r) => sig(r, "candidateHasImages")).length,
        newAxisPower: power,
        /* 🔴🔴 **증분** — 운영 baseline 대비 이미지 건초더미가 벌어들이는 것과 잃는 것. */
        imageHaystack: {
          modelCodeGained: ok.filter((r) => r.modelCodeGainedFromImage).length,
          modelCodeGainedOnGtSame: same.filter((r) => r.modelCodeGainedFromImage).length,
          modelCodeGainedOnGtDifferent: diff.filter((r) => r.modelCodeGainedFromImage).length,
          sameBefore: same.filter((r) => r.verdict === "SAME").length,
          sameAfter: same.filter((r) => r.verdictWithImageHaystack === "SAME").length,
          falseSameBefore: diff.filter((r) => r.verdict === "SAME").length,
          /** 🔴🔴 이 값이 0 이 아니면 CPO 기준으로 **탈락** 이다. */
          falseSameAfter: diff.filter((r) => r.verdictWithImageHaystack === "SAME").length,
        },
      };

      writeFileSync(path.join(OUT, "wu-033-residual.json"), JSON.stringify({ summary, rows }, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-033]", JSON.stringify(summary));

      /** 🔴 CONTROL — WU-031/032 와 같은 분모·같은 baseline 이어야 한다. */
      expect(ok.length).toBe(51);
      expect(missRows.length).toBe(14);
    },
    10 * 60_000,
  );
});
