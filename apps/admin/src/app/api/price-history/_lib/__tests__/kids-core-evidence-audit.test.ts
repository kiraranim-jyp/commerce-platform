/**
 * ════════════════════════════════════════════════════════════════════════════
 * KIDS 핵심 식별 증거 전수 감사 — BRAND · MODEL_CODE · PRODUCT_NAME (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · verdict 변경 0 · HTTP 0 · 수집 0 · DB 0 · 계약 변경 0.**
 * 🔴🔴 **두 자료를 «분리해서» 쓴다**(CPO STEP A 요구):
 *    ```
 *    저장된 운영 결과   `mi-reeval-01-db-human.json`  `system_verdict` · `price_tier`
 *                      ⟹ 🟢 **정답 대조의 기준** (하니스가 만든 값이 아니다)
 *    증거 원문          `mi-reeval-03-keyword-input.json` origin/candidate 설명·제목
 *                      ⟹ 🟢 **증거 추출률 측정용**
 *    조인 키            **(origin_code, candidate_url)** — 🔴 도메인 단독 조인 금지
 *    ```
 * 🔴 하니스 재구성 verdict 를 **저장된 운영 verdict 처럼 취급하지 않는다** — 이 파일은
 *    verdict 를 **재계산하지 않는다**(증거 추출만 한다).
 * 🔴 한쪽 설명에서 읽은 값을 **다른 쪽 상품의 칸에 넣지 않는다**(Contract A).
 * 🔴 산출물은 `preserved/` 에만 쓴다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import { confirmBrandCodeInTitle } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { brandsCompatible } from "@commerce/crawler/src/comparison-search/cross-seller";
import { extractLabeledProductCodes } from "@commerce/shared/src/product-facts";

const DIR = __dirname;
const EVID = path.join(DIR, "fixtures", "mi-reeval-03-keyword-input.json");
const STORED = path.join(DIR, "fixtures", "mi-reeval-01-db-human.json");
const OUT_DIR = path.join(DIR, "preserved");
const OUT = path.join(OUT_DIR, "kids-core-evidence-audit.json");

type EvidPair = {
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  humanGt: string | null;
  origin: { title?: string | null; description?: string | null; brand?: string | null };
  candidate: { title?: string | null; description?: string | null };
};
type StoredRow = {
  origin_code?: string | null;
  candidate_url?: string | null;
  candidate_domain?: string | null;
  human_verdict?: string | null;
  system_verdict?: string | null;
  match_truth?: string | null;
  price_tier?: string | null;
  origin_title?: string | null;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => s(v).length > 0;
const key = (code: unknown, url: unknown) => `${s(code).toUpperCase()}|${s(url)}`;

/** 세 상태 — 🔴 「모른다」와 「달랐다」를 섞지 않는다. */
type Tri = "PRESENT" | "ABSENT" | "CONFLICT";

describe("KIDS 핵심 식별 증거 감사 (평가 전용 · verdict 재계산 0)", () => {
  const evid = (JSON.parse(readFileSync(EVID, "utf8")) as { pairs: EvidPair[] }).pairs;
  const storedRaw = JSON.parse(readFileSync(STORED, "utf8")) as unknown;
  const stored: StoredRow[] = Array.isArray(storedRaw)
    ? (storedRaw as StoredRow[])
    : (Object.values(storedRaw as Record<string, unknown>).find((v) => Array.isArray(v)) as StoredRow[]);

  const storedByKey = new Map<string, StoredRow>();
  for (const r of stored) storedByKey.set(key(r.origin_code, r.candidate_url), r);

  it("STEP A~D — 증거 추출률과 저장 verdict 대조를 preserved/ 에 보존한다", () => {
    const rows = evid.map((p) => {
      const originCode = s(p.originCode);
      const oDesc = s(p.origin.description);
      const cDesc = s(p.candidate.description);
      const cTitle = s(p.candidate.title);
      const oTitle = s(p.origin.title);

      // ── B-1 BRAND (양쪽 «각자» 자기 설명에서만 읽는다 · Contract A)
      const oBrandList = s(p.origin.brand);
      const oBrandDesc = findBrandAliasMentions(oDesc).map((m) => m.brand);
      const cBrandTitle = findBrandAliasMentions(cTitle).map((m) => m.brand);
      const cBrandDesc = findBrandAliasMentions(cDesc).map((m) => m.brand);
      const cBrandAny = [...new Set([...cBrandTitle, ...cBrandDesc])];
      const originBrandAny = oBrandList || oBrandDesc[0] || "";
      let brand: Tri;
      if (!originBrandAny || cBrandAny.length === 0) brand = "ABSENT";
      else brand = cBrandAny.some((b) => brandsCompatible(originBrandAny, b)) ? "PRESENT" : "CONFLICT";

      // ── B-2 MODEL_CODE
      const oCodeLabeled = extractLabeledProductCodes(oDesc).map((l) => l.value);
      const cCodeLabeledAll = extractLabeledProductCodes(cDesc);
      const cCodeDistinct = [...new Set(cCodeLabeledAll.map((l) => l.value.toUpperCase()))];
      /** 🔴 맨문자열 — 운영 per-field 규칙을 그대로 쓴다(새 파서 0). */
      const bareInTitle = originCode ? confirmBrandCodeInTitle(originCode, cTitle) !== null : false;
      const bareInDesc = originCode ? confirmBrandCodeInTitle(originCode, cDesc) !== null : false;
      let code: Tri;
      if (!originCode || (cCodeDistinct.length === 0 && !bareInTitle && !bareInDesc)) code = "ABSENT";
      else if (cCodeDistinct.length === 1 && cCodeDistinct[0] !== originCode.toUpperCase())
        code = "CONFLICT";
      else code = "PRESENT";

      // ── B-3 PRODUCT_NAME (운영 토큰 생성기 재사용 · 🔴 TITLE 점수와 동일시하지 않는다)
      const oFacts = productFactsFromListing({
        title: oTitle || "(없음)",
        url: s(p.candidateUrl) || "about:blank",
        brand: oBrandList || null,
        description: oDesc || null,
      });
      const cFacts = productFactsFromListing({
        title: cTitle || "(없음)",
        url: s(p.candidateUrl) || "about:blank",
        description: cDesc || null,
      });
      const sharedName = oFacts.coreTitleTokens.filter((t) => cFacts.coreTitleTokens.includes(t));
      const name: Tri =
        !has(oTitle) || !has(cTitle)
          ? "ABSENT"
          : sharedName.length > 0
            ? "PRESENT"
            : "CONFLICT";

      const st = storedByKey.get(key(originCode, p.candidateUrl));

      return {
        originCode,
        candidateDomain: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        humanGt: p.humanGt,
        /** 🟢 저장된 운영 결과 — 하니스가 만든 값이 **아니다**. */
        storedSystemVerdict: st?.system_verdict ?? null,
        storedMatchTruth: st?.match_truth ?? null,
        storedPriceTier: st?.price_tier ?? null,
        joined: Boolean(st),
        evidence: { brand, code, name },
        detail: {
          originBrandFromList: oBrandList || null,
          originBrandFromDescription: oBrandDesc,
          candidateBrandFromTitle: cBrandTitle,
          candidateBrandFromDescription: cBrandDesc,
          originLabeledCodesInDescription: oCodeLabeled,
          candidateLabeledCodesInDescription: cCodeLabeledAll.map((l) => `${l.label}=${l.value}`),
          candidateBareCodeInTitle: bareInTitle,
          candidateBareCodeInDescription: bareInDesc,
          sharedNameTokens: sharedName,
          hasOriginDescription: has(oDesc),
          hasCandidateDescription: has(cDesc),
          hasOriginTitle: has(oTitle),
        },
      };
    });

    const rate = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length;

    /** STEP D — 저장 verdict ↔ GT 대조. 🔴 조인·라벨·verdict 가 **셋 다** 있어야 센다. */
    const comparable = rows.filter((r) => r.joined && has(r.humanGt) && has(r.storedSystemVerdict));
    const sameFamily = (v: string | null) => v === "SAME" || v === "PRESUMED_SAME";
    const misjudged = {
      gtSameMissed: comparable.filter((r) => r.humanGt === "SAME" && !sameFamily(r.storedSystemVerdict)),
      gtDifferentAsSame: comparable.filter(
        (r) => r.humanGt === "DIFFERENT" && sameFamily(r.storedSystemVerdict),
      ),
      gtSimilarOverreach: comparable.filter(
        (r) => r.humanGt === "SIMILAR" && sameFamily(r.storedSystemVerdict),
      ),
    };

    const artifact = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · verdict 재계산 0 · HTTP 0 · 수집 0. " +
        "storedSystemVerdict/priceTier 는 **저장된 운영 결과** 이고 evidence 는 **원문 추출** 이다 — 섞지 않는다. " +
        "조인 키는 (origin_code, candidate_url) 다. 조인·GT·verdict 가 셋 다 있는 행만 정확도 분모다. " +
        "ABSENT 는 「모른다」이고 CONFLICT 는 「달랐다」다 — 서로 바꾸지 않는다. " +
        "PRODUCT_NAME 은 핵심 토큰 공유(≥1) 지표이고 운영 TITLE 점수가 아니다.",
      stepA: {
        evidencePairs: evid.length,
        storedRows: stored.length,
        joined: rate((r) => r.joined),
        gtLabeled: rate((r) => has(r.humanGt)),
        storedVerdictPresent: rate((r) => has(r.storedSystemVerdict)),
        comparable: comparable.length,
        gtDistribution: rows.reduce<Record<string, number>>((a, r) => {
          const k = r.humanGt ?? "(미라벨)";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        originDescription: rate((r) => r.detail.hasOriginDescription),
        candidateDescription: rate((r) => r.detail.hasCandidateDescription),
        bothDescription: rate(
          (r) => r.detail.hasOriginDescription && r.detail.hasCandidateDescription,
        ),
        originTitleMissing: rate((r) => !r.detail.hasOriginTitle),
      },
      stepB: {
        brand: {
          originFromList: rate((r) => Boolean(r.detail.originBrandFromList)),
          originFromDescription: rate((r) => r.detail.originBrandFromDescription.length > 0),
          candidateFromTitle: rate((r) => r.detail.candidateBrandFromTitle.length > 0),
          candidateFromDescription: rate((r) => r.detail.candidateBrandFromDescription.length > 0),
          verdict: rows.reduce<Record<string, number>>((a, r) => {
            a[r.evidence.brand] = (a[r.evidence.brand] ?? 0) + 1;
            return a;
          }, {}),
        },
        modelCode: {
          originLabeledInDescription: rate(
            (r) => r.detail.originLabeledCodesInDescription.length > 0,
          ),
          candidateLabeledInDescription: rate(
            (r) => r.detail.candidateLabeledCodesInDescription.length > 0,
          ),
          candidateBareInTitle: rate((r) => r.detail.candidateBareCodeInTitle),
          candidateBareInDescription: rate((r) => r.detail.candidateBareCodeInDescription),
          verdict: rows.reduce<Record<string, number>>((a, r) => {
            a[r.evidence.code] = (a[r.evidence.code] ?? 0) + 1;
            return a;
          }, {}),
        },
        productName: {
          verdict: rows.reduce<Record<string, number>>((a, r) => {
            a[r.evidence.name] = (a[r.evidence.name] ?? 0) + 1;
            return a;
          }, {}),
        },
      },
      stepD: {
        comparableDenominator: comparable.length,
        byGt: comparable.reduce<Record<string, Record<string, number>>>((a, r) => {
          const g = r.humanGt as string;
          a[g] = a[g] ?? {};
          const v = r.storedSystemVerdict as string;
          a[g][v] = (a[g][v] ?? 0) + 1;
          return a;
        }, {}),
        gtSameMissed: misjudged.gtSameMissed.length,
        gtDifferentAsSame: misjudged.gtDifferentAsSame.length,
        gtSimilarOverreach: misjudged.gtSimilarOverreach.length,
        /** 🔴 오판 사례의 증거 조합 — 원인 분류의 입력. */
        misjudgedCases: [
          ...misjudged.gtSameMissed,
          ...misjudged.gtDifferentAsSame,
          ...misjudged.gtSimilarOverreach,
        ].map((r) => ({
          host: r.candidateDomain,
          originCode: r.originCode,
          gt: r.humanGt,
          stored: r.storedSystemVerdict,
          tier: r.storedPriceTier,
          truth: r.storedMatchTruth,
          evidence: r.evidence,
          candidateLabeledCodes: r.detail.candidateLabeledCodesInDescription,
          sharedNameTokens: r.detail.sharedNameTokens,
        })),
      },
      unmeasurable: {
        notJoined: rows.length - rate((r) => r.joined),
        gtLabeledButNoStoredVerdict: rate((r) => has(r.humanGt) && !has(r.storedSystemVerdict)),
        note: "🔴 0 으로 세지 않는다 — 조인되지 않거나 저장 verdict 가 없는 행은 정확도 분모 밖이다",
      },
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다.
    expect(rows.length).toBe(evid.length);
    expect(artifact.stepA.comparable).toBe(comparable.length);
  });
});
