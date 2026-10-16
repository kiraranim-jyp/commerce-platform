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
 * WU-037 §3·§5 — **SAME MISS 18건을 10축으로 전수 재분해** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §3: 「기존 보고서의 분류를 출발점으로 하되 **숫자를 그대로 신뢰하지 말고
 *    실제 fixture/결과를 다시 대조**한다.」 그래서 WU-036 의 분류를 복사하지 않고
 *    **운영 comparator 를 다시 호출해** 축 상태를 처음부터 만든다.
 *
 * 🔴 CPO §5: `MATCH / MISMATCH / UNKNOWN / NOT_AVAILABLE` 를 **합치지 않는다.**
 *    ```
 *    MATCH          양쪽에 값이 있고 comparator 가 축을 세웠다
 *    MISMATCH       양쪽에 값이 있는데 comparator 가 «다르다» 고 했다(conflict/blocker)
 *    UNKNOWN        한쪽에만 값이 있다 → «모른다» 이지 «다르다» 가 아니다
 *    NOT_AVAILABLE  양쪽 다 값이 없다 → 애초에 잴 수 없다
 *    ```
 *
 * 🔴 운영 코드 변경 **0** · AI **0** · HTTP **0**(WU-032 캐시) · 비용 **0**.
 * 🔴 기본 SKIP — `WU_037_ANATOMY=1`.
 */

const LIVE = process.env.WU_037_ANATOMY === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const HUMAN = path.join(OUT, "wu-036-human-gt.json");

const ORIGINS: Record<string, { snapshotId: string }> = {
  S1: { snapshotId: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e" },
  S2: { snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113" },
  S3: { snapshotId: "c5395889-7651-4272-aff5-dbeddd8d6199" },
  S4: { snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889" },
  S5: { snapshotId: "32f7b651-29b9-4217-b8ce-46596f538306" },
  S6: { snapshotId: "278d4c38-0a55-4724-bcd6-4a2630b1a278" },
};

const key = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

type AxisState = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_AVAILABLE";

/** CPO §5 의 10축. 🔴 제품에 «칸이 없는» 축은 그렇게 적는다 — 0 으로 적지 않는다. */
const AXES = [
  "brand",
  "modelCode",
  "color",
  "title",
  "category",
  "garmentForm",
  "variantId",
  "image",
  "material",
  "sizeConfig",
] as const;
type AxisName = (typeof AXES)[number];

/** comparator 가 세운 축 이름 → 우리 10축 이름. */
const AXIS_FROM_COMPARATOR: Record<string, AxisName> = {
  TITLE: "title",
  MODEL_CODE: "modelCode",
  CATEGORY: "category",
  COLOR: "color",
  MATERIAL: "material",
  FIT: "garmentForm",
  AUDIENCE: "sizeConfig",
  SIZE: "sizeConfig",
};
/** blocker/conflict 어휘 → 우리 10축. 🔴 「다르다」로 관측된 축만 여기 온다. */
const AXIS_FROM_SIGNAL: Record<string, AxisName> = {
  BRAND_MISMATCH: "brand",
  NO_TITLE_OVERLAP: "title",
  GARMENT_FORM: "garmentForm",
  SIZE_SYSTEM: "sizeConfig",
  MATERIAL: "material",
  COLOR: "color",
  MODEL_CODE: "modelCode",
  COMPOSITION: "material",
  CATEGORY: "category",
  SAME_SELLER_DISTINCT_LISTING: "variantId",
};

const maybe = LIVE ? it : it.skip;

describe("WU-037 — SAME MISS 10축 해부", () => {
  maybe(
    "18건을 축별 MATCH/MISMATCH/UNKNOWN/NOT_AVAILABLE 로 가르고 원인을 분류한다",
    () => {
      for (const f of [CASES, HUMAN]) expect(existsSync(f), f).toBe(true);
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: unknown;
      }[];
      const human = JSON.parse(readFileSync(HUMAN, "utf8")) as {
        id: string;
        searchId: string;
        originUrl: string;
        candidateUrl: string;
        domain: string;
        humanGt: string | null;
        humanReason: string | null;
        priorGt: string;
      }[];

      const originCache: Record<string, ProductFacts> = {};
      const rows: Record<string, unknown>[] = [];

      for (const h of human) {
        const o = ORIGINS[h.searchId];
        if (!o) continue;
        if (!originCache[h.searchId]) {
          const snap = cases.find((c) => c.id === o.snapshotId)!;
          expect(canonicalizeProductUrl(snap.source_url)).toBe(canonicalizeProductUrl(h.originUrl));
          originCache[h.searchId] = productFactsFromIdentityDna(
            buildProductIdentityDna(backfillCanonicalProduct(snap.canonical_product as never)),
          );
        }
        const of_ = originCache[h.searchId];

        const factsFile = path.join(CACHE, `${key(h.candidateUrl)}.facts.json`);
        if (!existsSync(factsFile)) continue;
        const cached = JSON.parse(readFileSync(factsFile, "utf8")) as {
          fetchPath?: string;
          candidate?: { facts?: ProductFacts } | null;
        };
        const cf0 = cached.candidate?.facts ?? null;
        if (!cf0) continue;

        /** 🟢 운영 baseline 재현(WU-033 §1 — 이 보강 없이는 운영이 아니다). */
        const cf: ProductFacts =
          cf0.brandModelCode === null && of_.brandModelCode
            ? {
                ...cf0,
                brandModelCode: confirmBrandCodeInEvidence(of_.brandModelCode, {
                  title: cf0.title,
                  url: cf0.sourceUrl,
                  sku: cf0.sellerSku ?? null,
                }),
              }
            : cf0;

        const cmp = compareCrossSellerProducts(of_, cf);
        const scored = (cmp?.axes ?? []).map((a: { axis?: string } | string) =>
          typeof a === "string" ? a : (a.axis ?? ""),
        );
        const blockers = (cmp?.blockers ?? []).map((b: { blocker?: string } | string) =>
          typeof b === "string" ? b : (b.blocker ?? ""),
        );
        const conflicts = (cmp?.conflicts ?? []).map((c: { conflict?: string } | string) =>
          typeof c === "string" ? c : (c.conflict ?? ""),
        );

        /** ── 10축 상태 ───────────────────────────────────────────────── */
        const pair: Record<AxisName, [unknown, unknown]> = {
          brand: [of_.brand, cf.brand],
          modelCode: [of_.brandModelCode, cf.brandModelCode],
          color: [of_.colorText, cf.colorText],
          title: [of_.coreTitleTokens?.length, cf.coreTitleTokens?.length],
          category: [of_.categoryText, cf.categoryText],
          garmentForm: [of_.fitText, cf.fitText],
          /** 🔴 **제품에 variant 식별자 칸이 없다**(ProductFacts 전수 확인 · WU-035). */
          variantId: [null, null],
          image: [(of_.imageUrls ?? []).length || null, (cf.imageUrls ?? []).length || null],
          material: [of_.materialText, cf.materialText],
          sizeConfig: [(of_.sizeLabels ?? []).length || null, (cf.sizeLabels ?? []).length || null],
        };

        const state = {} as Record<AxisName, AxisState>;
        for (const ax of AXES) {
          const scoredHere = scored.some((s) => AXIS_FROM_COMPARATOR[s] === ax);
          const signalled = [...blockers, ...conflicts].some((s) => AXIS_FROM_SIGNAL[s] === ax);
          const [a, b] = pair[ax];
          if (signalled) state[ax] = "MISMATCH";
          else if (scoredHere) state[ax] = "MATCH";
          else if (a == null && b == null) state[ax] = "NOT_AVAILABLE";
          else state[ax] = "UNKNOWN";
        }

        rows.push({
          id: h.id,
          searchId: h.searchId,
          domain: h.domain,
          humanGt: h.humanGt,
          humanReason: h.humanReason,
          priorGt: h.priorGt,
          miVerdict: cmp?.verdict ?? null,
          scored,
          blockers,
          conflicts,
          state,
          fetchPath: cached.fetchPath ?? null,
          origin: {
            brand: of_.brand,
            modelCode: of_.brandModelCode,
            color: of_.colorText,
            category: of_.categoryText,
            sizes: (of_.sizeLabels ?? []).length,
            images: (of_.imageUrls ?? []).length,
          },
          candidate: {
            brand: cf.brand,
            modelCode: cf.brandModelCode,
            color: cf.colorText,
            category: cf.categoryText,
            sizes: (cf.sizeLabels ?? []).length,
            images: (cf.imageUrls ?? []).length,
            title: cf.title,
          },
        });
      }

      const miss = rows.filter((r) => r.humanGt === "SAME" && r.miVerdict !== "SAME");
      const falseSame = rows.filter((r) => r.humanGt === "DIFFERENT" && r.miVerdict === "SAME");

      /** 축별 상태 분포 — MISS 18건 */
      const dist: Record<string, Record<AxisState, number>> = {};
      for (const ax of AXES) {
        dist[ax] = { MATCH: 0, MISMATCH: 0, UNKNOWN: 0, NOT_AVAILABLE: 0 };
        for (const m of miss) dist[ax][(m.state as Record<AxisName, AxisState>)[ax]]++;
      }

      const summary = {
        total: rows.length,
        humanSame: rows.filter((r) => r.humanGt === "SAME").length,
        humanDifferent: rows.filter((r) => r.humanGt === "DIFFERENT").length,
        miSame: rows.filter((r) => r.miVerdict === "SAME").length,
        falseSame: falseSame.length,
        sameMiss: miss.length,
        axisDistributionOnMiss: dist,
      };

      writeFileSync(path.join(OUT, "wu-037-anatomy.json"), JSON.stringify({ summary, rows }, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-037]", JSON.stringify(summary));
      // eslint-disable-next-line no-console
      for (const m of miss) {
        const st = m.state as Record<AxisName, AxisState>;
        const compact = AXES.map((a) => `${a}:${st[a][0]}${st[a] === "NOT_AVAILABLE" ? "A" : ""}`).join(" ");
        // eslint-disable-next-line no-console
        console.log(
          `[MISS] ${m.id} ${String(m.domain).padEnd(20)} ${String(m.miVerdict).padEnd(14)} [${(m.blockers as string[]).join(",") || "-"}] | ${compact}`,
        );
      }

      /** 🔴 CONTROL — WU-036 확정값과 같아야 한다. */
      expect(rows.length).toBe(51);
      expect(summary.miSame).toBe(10);
      expect(summary.falseSame).toBe(1);
      expect(summary.sameMiss).toBe(18);
    },
    10 * 60_000,
  );
});
