/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI 품번 복구 유형 평가 — 라벨 ↔ 맨문자열 ↔ 복수 ↔ 부재 (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · HTTP 0 · 수집 0 · DB 0 · verdict 변경 0.** 기존 fixture 원문만 쓴다.
 * 🔴 재구현 금지 — 전부 운영 owner 다:
 *    `extractLabeledProductCodes` / `extractLabeledProductCode`(Contract M) ·
 *    `confirmBrandCodeInTitle`(맨문자열 토큰수열 규칙) · `compareModelCode`(충돌 판정) ·
 *    `findBrandAliasMentions`(브랜드 별칭)
 * 🔴 **generic 코드 모양 탐지기를 만들지 않는다**(WU-079 금지 선례) ⟹ CPO 유형 ④
 *    「맨문자열 품번이 «불일치»」는 **측정불가** 로 남긴다(0 으로 적지 않는다).
 * 🔵 분모를 넓힌다 — 유형 ①~⑦ 은 **후보 자신의 코드** 만 필요하므로 「양쪽 전문」이 아니라
 *    **GT 라벨 ∩ 후보 설명** 이 유효 분모다(원상품 품번은 `originCode` 칸에 있다).
 * 🔴 다른 분모(16쌍 · A군 7 · IDENTITY_AXIS 26)와 **합산하지 않는다**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  extractLabeledProductCode,
  extractLabeledProductCodes,
} from "@commerce/shared/src/product-facts";
import { confirmBrandCodeInTitle } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";

type Pair = {
  originUrl: string;
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  humanGt: string | null;
  baselineSystemVerdict: string | null;
  origin: { title?: string | null; description?: string | null; brand?: string | null };
  candidate: { title?: string | null; description?: string | null };
};

const FIXTURE = path.join(__dirname, "fixtures", "mi-reeval-03-keyword-input.json");
const OUT_DIR = path.join(__dirname, "preserved");
const OUT = path.join(OUT_DIR, "mi-code-typology-eval.json");

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => t(v).length > 0;

/** CPO 유형표. 🔴 ④와 ⑥은 구조적으로 측정불가다(사유는 각 주석). */
type CodeType =
  | "1_LABELED_MATCH"
  | "2_LABELED_MISMATCH"
  | "3_BARE_MATCH"
  | "5_MULTI_CODE"
  | "7_NO_CODE";

describe("MI 품번 복구 유형 평가 (평가 전용 · 운영 변경 0)", () => {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as { pairs: Pair[] };
  const all = raw.pairs;

  // 🔵 유효 분모 — GT 라벨 ∩ 후보 설명(원상품 품번은 originCode 칸).
  const scope = all.filter(
    (p) => has(p.humanGt) && has(p.candidate?.description) && has(p.originCode),
  );

  it("분모를 넓히면 GT 라벨 ∩ 후보 설명이 「양쪽 전문 16」보다 크다", () => {
    expect(all.length).toBe(109);
    expect(scope.length).toBeGreaterThan(16);
  });

  it("유형별 GT 결과를 집계하고 preserved/ 에 보존한다", () => {
    const rows = scope.map((p) => {
      const desc = t(p.candidate.description);
      const originCode = t(p.originCode);

      // 후보 «자신의» 라벨 품번 — Contract M 이 복수·충돌에서 null 을 준다.
      const labeledAll = extractLabeledProductCodes(desc);
      const labeledDistinct = [...new Set(labeledAll.map((l) => l.value.toUpperCase()))];
      const labeledOne = extractLabeledProductCode(desc);

      // 맨문자열 — 운영 per-field 규칙(토큰 수열 전체 일치)을 설명문에 적용한다.
      const bareHit = confirmBrandCodeInTitle(originCode, desc) !== null;

      // 🟢 충돌 판정은 운영 owner 가 한다.
      const cmp = labeledOne ? compareModelCode(originCode, labeledOne) : "unavailable";

      let type: CodeType;
      if (labeledDistinct.length > 1) type = "5_MULTI_CODE";
      else if (labeledOne && cmp === "exact") type = "1_LABELED_MATCH";
      else if (labeledOne) type = "2_LABELED_MISMATCH";
      else if (bareHit) type = "3_BARE_MATCH";
      else type = "7_NO_CODE";

      const candBrands = [
        ...new Set(
          [...findBrandAliasMentions(t(p.candidate.title)), ...findBrandAliasMentions(desc)].map(
            (m) => m.brand,
          ),
        ),
      ];

      return {
        originCode,
        candidateDomain: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        humanGt: p.humanGt,
        storedBaselineVerdict: p.baselineSystemVerdict,
        type,
        labeledCodes: labeledAll.map((l) => `${l.label}=${l.value}`),
        labeledOne,
        compareModelCode: cmp,
        bareHit,
        descriptionLength: desc.length,
        /** 🔴 PLAIN_HTML 여부는 fixture 에 없다 — URL 모양 **대용치** 다. */
        shopifyUrlShapeProxy: (p.candidateUrl ?? "").includes("/products/"),
        /** 유형 ⑧ */
        originBrandBlank: !has(p.origin.brand),
        /** 유형 ⑨ */
        candidateBrandExtractionFailed: candBrands.length === 0,
      };
    });

    const byType: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      byType[r.type] = byType[r.type] ?? {};
      const gt = r.humanGt as string;
      byType[r.type][gt] = (byType[r.type][gt] ?? 0) + 1;
    }

    const gtTotals = rows.reduce<Record<string, number>>((acc, r) => {
      const k = r.humanGt as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

    /** CPO 목표 분모 충족 여부 — 🔴 못 채우면 그대로 적는다(추정·임의 라벨 금지). */
    const goal = {
      gtDifferentTarget: 10,
      gtDifferentActual: gtTotals.DIFFERENT ?? 0,
      gtSameTarget: 10,
      gtSameActual: gtTotals.SAME ?? 0,
      labeledMismatchTarget: 3,
      labeledMismatchActual: rows.filter((r) => r.type === "2_LABELED_MISMATCH").length,
    };

    const artifact = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · HTTP 0 · 수집 0 · verdict 변경 0. " +
        "분모는 GT 라벨 ∩ 후보 설명 ∩ originCode 이며 16쌍·A군 7·IDENTITY_AXIS 26 과 합산하지 않는다. " +
        "유형 ④(맨문자열 불일치)는 generic 코드 탐지기를 만들지 않았으므로 측정불가다. " +
        "유형 ⑥(연관상품 블록)은 fixture 에 섹션 위치 정보가 없어 측정불가이고 ⑤가 그 대용치다. " +
        "shopifyUrlShapeProxy 는 PLAIN_HTML 판별이 아니라 URL 모양 대용치다.",
      denominator: {
        fixturePairs: all.length,
        scope: rows.length,
        gt: gtTotals,
        bothSideFullTextScope: 16,
        notMerged: { aGroupFullText: 7, identityAxisPairs: 26 },
      },
      goal,
      unmeasurable: {
        type4_bareMismatch: "generic 코드 모양 탐지기 금지(WU-079) ⟹ 측정하지 않았다",
        type6_relatedBlock: "설명문 내 섹션 위치 정보가 fixture 에 없다 ⟹ ⑤가 대용치다",
        plainHtmlPath: "후보 fetchPath 가 fixture 에 없다 ⟹ URL 모양 대용치만 기록",
      },
      byType,
      conflictBehaviour: rows
        .filter((r) => r.type === "2_LABELED_MISMATCH")
        .map((r) => ({
          host: r.candidateDomain,
          humanGt: r.humanGt,
          originCode: r.originCode,
          candidateOwnCode: r.labeledOne,
          compareModelCode: r.compareModelCode,
        })),
      brandAxis: {
        originBrandBlank: rows.filter((r) => r.originBrandBlank).length,
        candidateBrandExtractionFailed: rows.filter((r) => r.candidateBrandExtractionFailed).length,
      },
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다 — 결과를 통과시키기 위한 단언을 쓰지 않는다.
    expect(rows.length).toBe(scope.length);
    expect(Object.keys(byType).length).toBeGreaterThan(0);
  });
});
