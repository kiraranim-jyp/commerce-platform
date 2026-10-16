import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalizeProductUrl,
  compareCrossSellerProducts,
  factsFromProductUrl,
  withConfidence,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-031 — **AI 후보 → MI Identity 연결 정확도 전수 감사** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 아무것도 고치지 않는다.** MI 로직·threshold·색상사전·정책에
 *    한 글자도 손대지 않는다(CPO §13/§15). 하는 일은 **재는 것** 뿐이다.
 *
 * 🔴 기본 SKIP — `WU_031_AUDIT=1` 없이는 돌지 않는다(회귀가 네트워크를 타면 안 된다).
 * 🔴 AI 호출 **0** · 검색 API **0** · 키 **0** · 비용 **0**. 쓰는 것은 후보 URL 의
 *    **공개 상품 페이지 GET** 뿐이다(기존 WU-022 dataset 재사용 · 새 Search 0).
 *
 * ── 🔴 판정의 출처를 섞지 않는다 ───────────────────────────────────────────
 *   GT   = 사람이 상품 페이지를 보고 라벨한 값(`mi-022-gt.json`)
 *   MI   = **운영 함수** `withConfidence`(→ `compareCrossSellerProducts`)의 산출
 *   연결고리 = 그 운영 함수가 낸 `axes`/`blockers`/`conflicts` 를 **그대로** 읽는다
 * 🔴 AI 의 SAME/confidence/reason 은 **쓰지 않는다**(GT 로도 근거로도).
 * 🟢 MATCH/MISMATCH/UNKNOWN 을 내가 새로 계산하지 않는다 — 운영 comparator 가
 *    이미 `BRAND_UNCONFIRMED`(모름)와 `BRAND_MISMATCH`(다름)를 **갈라서** 낸다.
 */

const LIVE = process.env.WU_031_AUDIT === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const GT = path.join(OUT, "mi-022-gt.json");

/** 🔴 출처: `docs/AI-SEARCH-COLLECTION-019A-SEARCH.md` §3 작업표(전부 운영 DB 실데이터). */
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

type LinkStatus = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_AVAILABLE";

interface AuditRow {
  searchId: string;
  candidateUrl: string;
  candidateFinalUrl: string | null;
  gt: string;
  factsStatus: string;
  miVerdict: string | null;
  miConfidence: number | null;
  identifierConfirmed: boolean | null;
  outcome: "PASS" | "SAME_MISS" | "FALSE_SAME" | "TRUE_NEGATIVE" | "UNMEASURABLE";
  links: Record<"brand" | "modelCode" | "color" | "title" | "category", LinkStatus>;
  cause: string | null;
  origin: Record<string, unknown>;
  candidate: Record<string, unknown>;
  axes: string[];
  reasons?: string[];
  blockers: string[];
  conflicts: string[];
}

const maybe = LIVE ? it : it.skip;

describe("WU-031 — AI 후보가 실제 SAME 일 때 MI 가 연결하는가", () => {
  maybe(
    "GT 전수를 운영 MI 로 재현하고 연결고리를 기록한다",
    async () => {
      expect(existsSync(CASES) && existsSync(GT)).toBe(true);
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as { id: string; source_url: string; canonical_product: unknown }[];
      const gtRows = JSON.parse(readFileSync(GT, "utf8")) as { searchId: string; candidateUrl: string; gt: string }[];

      const rows: AuditRow[] = [];
      let httpCalls = 0;

      for (const gtRow of gtRows) {
        const origin = ORIGINS[gtRow.searchId];
        if (!origin) continue;
        const snapshot = cases.find((c) => c.id === origin.snapshotId);
        expect(snapshot, `스냅샷 ${origin.snapshotId} 없음`).toBeTruthy();
        /** 🔴 CONTROL — 원상품 매핑이 틀리면 아래 숫자가 전부 무효다(§5-B). */
        expect(canonicalizeProductUrl(snapshot!.source_url)).toBe(canonicalizeProductUrl(origin.expectedOrigin));

        /* 🟢 운영 `check/route.ts` 와 **같은 변환 사슬**. */
        const product = backfillCanonicalProduct(snapshot!.canonical_product as never);
        const dna = buildProductIdentityDna(product);
        const originFacts = productFactsFromIdentityDna(dna);
        const query = { title: dna.title, brand: dna.brand.value || undefined, sourceUrl: dna.sourceUrl, facts: originFacts };

        /* ① 후보 페이지를 **실제로 열어** 사실을 읽는다(운영 함수). */
        let facts;
        try {
          facts = await factsFromProductUrl(gtRow.candidateUrl);
        } catch {
          facts = null;
        }
        httpCalls += facts?.httpCalls ?? 0;

        const base = {
          searchId: gtRow.searchId,
          candidateUrl: gtRow.candidateUrl,
          gt: gtRow.gt,
          origin: {
            brand: originFacts.brand ?? null,
            modelCode: originFacts.brandModelCode ?? null,
            color: originFacts.colorText ?? null,
            title: dna.title,
            category: originFacts.categoryText ?? null,
          },
        };

        if (!facts || facts.status !== "OK" || !facts.candidate) {
          rows.push({
            ...base,
            candidateFinalUrl: facts?.crawlerUrl ?? null,
            factsStatus: facts?.status ?? "THREW",
            miVerdict: null,
            miConfidence: null,
            identifierConfirmed: null,
            outcome: "UNMEASURABLE",
            links: { brand: "NOT_AVAILABLE", modelCode: "NOT_AVAILABLE", color: "NOT_AVAILABLE", title: "NOT_AVAILABLE", category: "NOT_AVAILABLE" },
            cause: "EXTRACTION",
            candidate: {},
            axes: [],
            blockers: [],
            conflicts: [],
          });
          continue;
        }

        /* ②③ 운영 판정 — 점수·축·보류·충돌이 전부 여기서 나온다. */
        const [scored] = withConfidence(query, [facts.candidate]);
        const cf = scored.facts ?? null;
        /**
         * 🔴🔴 **`axes` 는 후보 객체에 실리지 않는다 — 내가 키를 지어냈다가 잡혔다.**
         *    `match.ts:539-540` 가 cross 를 **네 칸**(verdict/reasons/blockers/conflicts)
         *    으로만 펼치고 `axes` 는 내부 값으로 남긴다(WU-013 이 같은 함정을 기록해 뒀다).
         *    그 상태로 돌렸더니 **연결고리가 전부 「없음」** 으로 나왔다 — 전건 null 이면
         *    내 키부터 의심한다는 규칙이 정확히 들어맞은 자리다.
         * 🟢 그래서 **운영 비교기를 직접** 불러 `axes` 를 받는다(복제 계산이 아니다).
         */
        const cross = cf ? compareCrossSellerProducts(originFacts, cf) : null;
        /** 🔴 사람이 읽는 근거 문장 — **축 판별에 쓰지 않는다**(한국어 문장이다). */
        const reasons = (scored.crossSellerReasons ?? []) as string[];
        const axisNames = (cross?.axes ?? []).map((a) => a.axis);
        /** 🔴 `String(obj)` 는 `"[object Object]"` 다 — **값** 을 꺼낸다(운영도 같은 버그였다). */
        const blockers = (scored.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker));
        const conflicts = (scored.crossSellerConflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict));

        /**
         * 🔴 **연결고리는 운영 산출에서 «읽는다».** 새 비교를 만들지 않는다.
         *    MATCH   = 그 축이 점수로 들어갔다(axes)
         *    MISMATCH= 그 축이 충돌/보류로 잡혔다(conflicts/blockers)
         *    UNKNOWN = 후보 쪽 값이 없다
         */
        const link = (
          axisName: string,
          conflictNames: string[],
          blockerNames: string[],
          candidateValue: unknown,
        ): LinkStatus => {
          if (conflicts.some((c) => conflictNames.includes(c))) return "MISMATCH";
          if (blockers.some((b) => blockerNames.includes(b))) return "MISMATCH";
          if ((axisNames as string[]).includes(axisName)) return "MATCH";
          return candidateValue ? "UNKNOWN" : "NOT_AVAILABLE";
        };

        const links = {
          brand: blockers.includes("BRAND_MISMATCH")
            ? ("MISMATCH" as LinkStatus)
            : blockers.includes("BRAND_UNCONFIRMED")
              ? ("UNKNOWN" as LinkStatus)
              : cf?.brand
                ? ("MATCH" as LinkStatus)
                : ("NOT_AVAILABLE" as LinkStatus),
          modelCode: link("MODEL_CODE", ["MODEL_CODE"], [], cf?.brandModelCode),
          color: link("COLOR", ["COLOR"], [], cf?.colorText),
          title: link("TITLE", [], ["NO_TITLE_OVERLAP"], cf?.coreTitleTokens?.length),
          category: link("CATEGORY", ["CATEGORY", "AUDIENCE"], [], cf?.categoryText),
        };

        const mi = scored.crossSellerVerdict ?? null;
        const outcome: AuditRow["outcome"] =
          gtRow.gt === "SAME" ? (mi === "SAME" ? "PASS" : "SAME_MISS") : mi === "SAME" ? "FALSE_SAME" : "TRUE_NEGATIVE";

        /** 🔴 원인은 **정보 부족** 과 **로직** 을 절대 섞지 않는다(CPO §9). */
        const missingLinks = Object.entries(links).filter(([, v]) => v === "UNKNOWN" || v === "NOT_AVAILABLE");
        const cause =
          outcome === "SAME_MISS"
            ? missingLinks.length > 0
              ? `INFO_MISSING:${missingLinks.map(([k]) => k).join("+")}`
              : "MI_LOGIC"
            : outcome === "FALSE_SAME"
              ? `FALSE_SAME:${Object.entries(links).filter(([, v]) => v === "MATCH").map(([k]) => k).join("+") || "NO_AXIS"}`
              : null;

        rows.push({
          ...base,
          candidateFinalUrl: facts.crawlerUrl ?? null,
          factsStatus: facts.status,
          miVerdict: mi,
          miConfidence: scored.confidence ?? null,
          identifierConfirmed: (scored as { identifierConfirmed?: boolean }).identifierConfirmed ?? null,
          outcome,
          links,
          cause,
          candidate: {
            brand: cf?.brand ?? null,
            modelCode: cf?.brandModelCode ?? null,
            color: cf?.colorText ?? null,
            title: facts.candidate.title,
            category: cf?.categoryText ?? null,
          },
          axes: axisNames as string[],
          reasons,
          blockers,
          conflicts,
        });
      }

      /* ─────────── KPI (분모를 섞지 않는다) ─────────── */
      const measurable = rows.filter((r) => r.outcome !== "UNMEASURABLE");
      const gtSame = measurable.filter((r) => r.gt === "SAME");
      const gtDiff = measurable.filter((r) => r.gt === "DIFFERENT");
      const sameMiss = gtSame.filter((r) => r.outcome === "SAME_MISS");
      const falseSame = gtDiff.filter((r) => r.outcome === "FALSE_SAME");
      const miSame = measurable.filter((r) => r.miVerdict === "SAME");

      const kpi = {
        httpCalls,
        candidates: rows.length,
        unmeasurable: rows.length - measurable.length,
        measurable: measurable.length,
        gtSame: gtSame.length,
        gtDifferent: gtDiff.length,
        sameLinked: gtSame.length - sameMiss.length,
        sameMiss: sameMiss.length,
        sameMissRate: gtSame.length ? +(sameMiss.length / gtSame.length).toFixed(3) : null,
        falseSame: falseSame.length,
        falseSameRateOfGtDifferent: gtDiff.length ? +(falseSame.length / gtDiff.length).toFixed(3) : null,
        precisionOfMiSame: miSame.length ? +((miSame.length - falseSame.length) / miSame.length).toFixed(3) : null,
        accuracy: measurable.length
          ? +((gtSame.length - sameMiss.length + (gtDiff.length - falseSame.length)) / measurable.length).toFixed(3)
          : null,
        causeHistogram: rows.reduce<Record<string, number>>((acc, r) => {
          if (!r.cause) return acc;
          const key = r.cause.split(":")[0];
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
        missingLinkHistogram: sameMiss.reduce<Record<string, number>>((acc, r) => {
          for (const [k, v] of Object.entries(r.links)) {
            if (v === "UNKNOWN" || v === "NOT_AVAILABLE") acc[k] = (acc[k] ?? 0) + 1;
          }
          return acc;
        }, {}),
      };

      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "wu-031-audit.json"), JSON.stringify({ kpi, rows }, null, 2), "utf8");
      console.log(`[WU-031] ${JSON.stringify(kpi)}`);

      /** 🔴 임계값을 단언하지 않는다 — 이 WU 는 **측정** 이다. 분모만 확인한다. */
      expect(rows.length).toBeGreaterThan(0);
      expect(measurable.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
