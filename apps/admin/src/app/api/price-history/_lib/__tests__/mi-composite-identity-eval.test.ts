/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI 복합 식별 근거 평가 — BRAND + MODEL_CODE + PRODUCT_NAME (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · HTTP 0 · 수집 0 · DB 0.** 기존 fixture 원문만 쓴다.
 * 🔴 재구현 금지 — 판정은 운영 `compareCrossSellerProducts` 가 하고,
 *    facts 는 운영 `productFactsFromListing` 이 만든다. 내가 만드는 것은 **설정 둘** 뿐이다:
 *    ```
 *    BASE  후보 facts 를 title + url 로만 만든다        (현행 운영 모양)
 *    DESC  후보 facts 에 **상세설명 원문** 을 같이 넘긴다 (반사실)
 *    ```
 * 🔴 분모는 **GT 라벨 ∩ 양쪽 전문 = 16쌍** 이고 109·A군 7·IDENTITY_AXIS 26 과 **합산하지 않는다**.
 * 🔴 UNKNOWN 을 MISMATCH 로 바꾸지 않는다. 평가 불가를 성공/실패로 세지 않는다.
 * 🔴 산출물은 `preserved/` 에 쓴다 — `fixtures/` 에 쓰면 사용자 계약이 FAIL 한다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  compareCrossSellerProducts,
  brandsCompatible,
} from "@commerce/crawler/src/comparison-search/cross-seller";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import { confirmBrandCodeInEvidence } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";

type Pair = {
  originUrl: string;
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  baselineSystemVerdict: string | null;
  humanGt: string | null;
  origin: {
    title?: string | null;
    description?: string | null;
    descriptionKo?: string | null;
    brand?: string | null;
    color?: string | null;
    material?: string | null;
  };
  candidate: { title?: string | null; description?: string | null };
};

const FIXTURE = path.join(__dirname, "fixtures", "mi-reeval-03-keyword-input.json");
const OUT_DIR = path.join(__dirname, "preserved");
const OUT = path.join(OUT_DIR, "mi-composite-identity-eval.json");

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const present = (v: unknown): boolean => text(v).length > 0;

/** 세 상태 — 🔴 「모른다」와 「달랐다」를 섞지 않는다. */
type Tri = "CONFIRMED" | "MISMATCH" | "UNKNOWN";

type AxisSnapshot = {
  brand: Tri;
  modelCode: Tri;
  productName: Tri;
  /** 운영 판정기 산출 — 내 계산이 아니다. */
  verdict: string;
  axisPoints: Record<string, number>;
  blockers: string[];
  identifierConfirmed: boolean;
};

function originFacts(p: Pair) {
  const base = productFactsFromListing({
    title: text(p.origin.title) || "(제목 없음)",
    url: p.originUrl,
    brand: text(p.origin.brand) || null,
    description: text(p.origin.description) || null,
  });
  // 🔴 품번은 fixture 의 `originCode` 가 권위다(제목에서 재추출하지 않는다).
  return { ...base, brandModelCode: p.originCode ?? base.brandModelCode };
}

function candidateFacts(p: Pair, withDescription: boolean) {
  return productFactsFromListing({
    title: text(p.candidate.title) || "(제목 없음)",
    url: p.candidateUrl ?? p.originUrl,
    description: withDescription ? text(p.candidate.description) || null : null,
  });
}

/** 후보 텍스트에서 브랜드를 «운영 owner» 로 읽는다(별칭/한글 포함). */
function brandFromText(...parts: (string | null | undefined)[]): string[] {
  const found: string[] = [];
  for (const part of parts) {
    if (!present(part)) continue;
    for (const m of findBrandAliasMentions(text(part))) {
      if (!found.includes(m.brand)) found.push(m.brand);
    }
  }
  return found;
}

function evaluate(p: Pair, withDescription: boolean): AxisSnapshot {
  const x = originFacts(p);
  const y = candidateFacts(p, withDescription);
  const match = compareCrossSellerProducts(x, y);

  const axisPoints: Record<string, number> = {};
  for (const a of match.axes) axisPoints[a.axis] = (axisPoints[a.axis] ?? 0) + a.points;

  // ── MODEL_CODE — 운영 확인기. 건초더미에 설명을 더하는 것이 반사실의 핵심이다.
  const haystackTitle = withDescription
    ? [text(p.candidate.title), text(p.candidate.description)].filter(Boolean).join("\n")
    : text(p.candidate.title);
  const confirmed = confirmBrandCodeInEvidence(p.originCode ?? null, {
    title: haystackTitle,
    url: p.candidateUrl,
    sku: null,
  });
  let modelCode: Tri;
  if (!present(p.originCode)) modelCode = "UNKNOWN";
  else if (confirmed !== null) modelCode = "CONFIRMED";
  else modelCode = "UNKNOWN"; // 🔴 「후보 페이지에서 못 찾았다」는 불일치가 아니다

  // ── BRAND
  const originBrand = text(p.origin.brand);
  const candBrands = brandFromText(
    p.candidate.title,
    withDescription ? p.candidate.description : null,
  );
  let brand: Tri;
  if (!originBrand || candBrands.length === 0) brand = "UNKNOWN";
  else if (candBrands.some((b) => brandsCompatible(originBrand, b))) brand = "CONFIRMED";
  else brand = "MISMATCH";

  // ── PRODUCT_NAME — 🔴 운영 TITLE 점수가 아니다. 이 하니스의 지표임을 이름으로 밝힌다.
  const shared = x.coreTitleTokens.filter((t) => y.coreTitleTokens.includes(t));
  const productName: Tri =
    x.coreTitleTokens.length === 0 || y.coreTitleTokens.length === 0
      ? "UNKNOWN"
      : shared.length > 0
        ? "CONFIRMED"
        : "MISMATCH";

  return {
    brand,
    modelCode,
    productName,
    verdict: match.verdict,
    axisPoints,
    blockers: match.blockers.map((b) => b.blocker),
    identifierConfirmed: match.identifierConfirmed,
  };
}

const COMBOS = [
  { key: "1_BRAND", need: ["brand"] },
  { key: "2_MODEL_CODE", need: ["modelCode"] },
  { key: "3_PRODUCT_NAME", need: ["productName"] },
  { key: "4_BRAND+MODEL_CODE", need: ["brand", "modelCode"] },
  { key: "5_BRAND+PRODUCT_NAME", need: ["brand", "productName"] },
  { key: "6_MODEL_CODE+PRODUCT_NAME", need: ["modelCode", "productName"] },
  { key: "7_BRAND+MODEL_CODE+PRODUCT_NAME", need: ["brand", "modelCode", "productName"] },
] as const;

type Tally = {
  denominator: number;
  evaluable: number;
  sameRecovered: number;
  differentContaminated: number;
  similarMisread: number;
  unmeasured: number;
  byHost: Record<string, string>;
};

describe("MI 복합 식별 근거 평가 (평가 전용 · 운영 변경 0)", () => {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as { pairs: Pair[] };
  const all = raw.pairs;
  const scope = all.filter(
    (p) => present(p.humanGt) && present(p.origin?.description) && present(p.candidate?.description),
  );

  it("분모가 PHASE 1 확정값(16쌍 · SAME 6 · DIFFERENT 9 · SIMILAR 1)과 같다", () => {
    expect(all.length).toBe(109);
    expect(scope.length).toBe(16);
    const gt = scope.reduce<Record<string, number>>((acc, p) => {
      const k = p.humanGt as string;
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    expect(gt).toEqual({ SAME: 6, DIFFERENT: 9, SIMILAR: 1 });
  });

  it("8조합 × 두 설정을 측정하고 preserved/ 에 보존한다", () => {
    const rows = scope.map((p) => {
      const base = evaluate(p, false);
      const desc = evaluate(p, true);
      return {
        originCode: p.originCode,
        candidateDomain: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        humanGt: p.humanGt,
        storedBaselineVerdict: p.baselineSystemVerdict,
        base,
        desc,
        changed: base.verdict !== desc.verdict,
      };
    });

    const tally = (cfg: "base" | "desc"): Record<string, Tally> => {
      const out: Record<string, Tally> = {};
      for (const combo of COMBOS) {
        const t: Tally = {
          denominator: rows.length,
          evaluable: 0,
          sameRecovered: 0,
          differentContaminated: 0,
          similarMisread: 0,
          unmeasured: 0,
          byHost: {},
        };
        for (const r of rows) {
          const snap = r[cfg] as unknown as Record<string, Tri>;
          const states = combo.need.map((k) => snap[k]);
          const allConfirmed = states.every((s) => s === "CONFIRMED");
          const anyUnknown = states.some((s) => s === "UNKNOWN");
          if (anyUnknown && !allConfirmed) t.unmeasured++;
          else t.evaluable++;
          if (!allConfirmed) continue;
          if (r.humanGt === "SAME") t.sameRecovered++;
          if (r.humanGt === "DIFFERENT") t.differentContaminated++;
          if (r.humanGt === "SIMILAR") t.similarMisread++;
          const h = r.candidateDomain ?? "(도메인 공백)";
          t.byHost[h] = `${t.byHost[h] ? t.byHost[h] + "," : ""}${r.humanGt}`;
        }
        out[combo.key] = t;
      }
      return out;
    };

    // 8번째 = 기존 운영 판정(Baseline). 🔴 내 조합이 아니라 판정기 산출이다.
    const baselineTally = (cfg: "base" | "desc") => {
      const t = {
        denominator: rows.length,
        sameAsSame: 0,
        differentAsSame: 0,
        similarAsSame: 0,
        verdicts: {} as Record<string, number>,
      };
      for (const r of rows) {
        const v = (r[cfg] as AxisSnapshot).verdict;
        t.verdicts[v] = (t.verdicts[v] ?? 0) + 1;
        if (v === "SAME") {
          if (r.humanGt === "SAME") t.sameAsSame++;
          if (r.humanGt === "DIFFERENT") t.differentAsSame++;
          if (r.humanGt === "SIMILAR") t.similarAsSame++;
        }
      }
      return t;
    };

    // §5-B CONTROL — 저장된 운영 verdict 를 BASE 설정이 재현하는가.
    const control = rows.reduce(
      (acc, r) => {
        if (!present(r.storedBaselineVerdict)) {
          acc.noStored++;
          return acc;
        }
        if (r.storedBaselineVerdict === r.base.verdict) acc.reproduced++;
        else {
          acc.mismatched++;
          acc.mismatchDetail.push(
            `${r.candidateDomain ?? "(공백)"}|stored=${r.storedBaselineVerdict}|base=${r.base.verdict}`,
          );
        }
        return acc;
      },
      { reproduced: 0, mismatched: 0, noStored: 0, mismatchDetail: [] as string[] },
    );

    const artifact = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · HTTP 0 · 수집 0. 분모는 GT 라벨 ∩ 양쪽 전문 16쌍이며 " +
        "109 · A군 7 · IDENTITY_AXIS 26 과 합산하지 않는다. UNKNOWN 은 「모른다」이고 오판이 아니다. " +
        "PRODUCT_NAME 은 이 하니스의 지표(핵심 토큰 공유 ≥1)이고 운영 TITLE 점수가 아니다.",
      denominator: {
        fixturePairs: all.length,
        scope: rows.length,
        gt: { SAME: 6, DIFFERENT: 9, SIMILAR: 1 },
        notMerged: { bGroupPairs: 109, aGroupFullText: 7, identityAxisPairs: 26 },
      },
      control,
      combos: { base: tally("base"), desc: tally("desc") },
      operationalVerdict: { base: baselineTally("base"), desc: baselineTally("desc") },
      changedPairs: rows.filter((r) => r.changed).map((r) => ({
        host: r.candidateDomain,
        humanGt: r.humanGt,
        from: r.base.verdict,
        to: r.desc.verdict,
      })),
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다 — 결과를 통과시키기 위한 단언을 쓰지 않는다.
    expect(rows.length).toBe(16);
    expect(Object.keys(artifact.combos.base)).toHaveLength(7);
    expect(Object.keys(artifact.combos.desc)).toHaveLength(7);
  });
});
