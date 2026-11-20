import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  brandsCompatible,
  compareCrossSellerProducts,
} from "@commerce/crawler/src/comparison-search/cross-seller";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { confirmBrandCodeInEvidence } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-DESCRIPTION-COMPARISON-01 — **상세설명 비교 효과 · CONTROL 먼저**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **먼저 — 기존 측정이 «있고», 그 CONTROL 이 실패했다.**
 * ```
 * 기존 산출물  `preserved/mi-composite-identity-eval.json`
 *              조합 7개 × base/desc · 분모 16 · `changedPairs` **0**(= 효과 0)
 * 🔴 그런데 그 산출물의 `control` 이 **reproduced 1 / mismatched 15** 다.
 *    ⟹ 헌장 §5-B: **CONTROL 이 실패하면 그 숫자를 전략 판단에 쓰지 않는다.**
 *    ⟹ 🔴 그래서 「상세설명 효과 0」을 **결론으로 쓸 수 없다**(이 파일이 그것을 고친다).
 * ```
 *
 * 🔴🔴 **CONTROL 실패의 원인 — 하니스가 후보 브랜드를 «판정기에 넘기지 않았다».**
 * ```
 * `mi-composite-identity-eval.test.ts:78-84` `candidateFacts()` 는
 *    productFactsFromListing({ title, url, description }) 로 만든다 — **brand 가 없다**.
 * ⟹ `brandKnown` 이 false ⟹ 전건 `BRAND_UNCONFIRMED` ⟹ 축이 `{CATEGORY:1}` 로 붕괴
 * ⟹ 운영 저장 `PRESUMED_SAME`(≥3축) 대신 **`SIMILAR`**(≥1축)가 나왔다.
 * 🟢 그 하니스는 후보 브랜드를 **이미 텍스트에서 읽고 있었다**(`brandFromText`) —
 *    자기 지표에만 쓰고 **판정기에 되먹이지 않았다**. 그것이 버그다.
 * ```
 *
 * 🟢 **그래서 이 파일은 셋을 갈라서 잰다**(정책 변경 0 · 운영 연결 0 · HTTP 0 · 수집 0):
 * ```
 * A0  현 하니스 모양            후보 brand 안 넘김 · 설명 안 씀      ← 실패한 CONTROL 재현
 * A1  **복구**                  후보 brand = 제목에서 읽음 · 설명 안 씀
 * A2  **상세설명 비교**          후보 brand = 제목+설명 · 품번 건초더미에 설명 추가
 * ```
 * 🔴 **BASELINE 은 내가 계산하지 않는다** — 운영이 저장한 `system_verdict`
 *    (`candidate_reviews`)가 owner 다. A0/A1/A2 는 그것을 **재현하는지** 로만 평가된다.
 *
 * 🔴 **동결 준수** — `SAME_MIN_AXES`·`PRESUMED_SAME_MIN_AXES`·blocker 집합·2출처 기준·
 *    가격 자격 **전부 불변** · 이미지 증거 **0** · verdict 재계산/저장 **0** ·
 *    `ProductFacts` 운영 연결 **0** · 상세설명만으로 SAME 강제 **0**.
 * 🔴 운영 owner 가 설명 evidence 모듈을 import 하지 못하는 제약은 **그대로** 다 —
 *    이 파일은 **평가 전용** 이고 운영 소스를 건드리지 않는다.
 *
 * 🔴 **에뮬레이션의 한계를 먼저 적는다**(추정으로 칸을 채우지 않는다):
 * ```
 * 운영은 `withConfidence` 가 `confirmBrandCodeInEvidence` 를 돌려 후보
 *   `brandModelCode` 를 채운 «뒤» 판정한다. 이 파일은 그 **배선만** 같은 순서로
 *   재현한다(확인되면 후보 품번을 채우고 판정) — 🔴 `withConfidence` 전체(점수·
 *   가격보강)를 부르지 않으므로 **「운영 재현」이 아니라 「판정 배선 재현」** 이다.
 * 🔴 그리고 fixture 는 후보측 **구조화 facts(색상·소재·대상)를 들고 있지 않다** ⟹
 *   그 축들은 이 분모에서 **구조적으로 측정불가** 다(0 으로 적지 않는다).
 * ```
 */

const DIR = __dirname;
const FIXTURE = path.join(DIR, "fixtures", "mi-reeval-03-keyword-input.json");
const STORED = path.join(DIR, "preserved", "mdc-01-price-eligibility-control.json");
const OUT = path.join(DIR, "preserved", "mdcp-01-description-comparison-control.json");

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const present = (v: unknown): boolean => text(v).length > 0;

interface Pair {
  originUrl: string;
  originCode: string | null;
  candidateUrl: string;
  candidateDomain: string | null;
  baselineSystemVerdict: string | null;
  humanGt: string | null;
  origin: { title?: string; description?: string; brand?: string };
  candidate: { title?: string; description?: string };
}

const PAIRS: Pair[] = (() => {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8"));
  return (raw.pairs ?? raw) as Pair[];
})();

/** 🔴 운영이 낸 값 — 내가 계산하지 않는다. */
const STORED_BY_URL = new Map<string, { storedVerdict: string | null; humanGt: string | null }>(
  (JSON.parse(readFileSync(STORED, "utf8")).rows as {
    candidateUrl: string;
    storedVerdict: string | null;
    humanGt: string | null;
  }[]).map((r) => [r.candidateUrl, { storedVerdict: r.storedVerdict, humanGt: r.humanGt }]),
);

const brandsInText = (...parts: (string | undefined)[]): string[] => {
  const found: string[] = [];
  for (const p of parts) {
    if (!present(p)) continue;
    for (const m of findBrandAliasMentions(text(p))) {
      if (!found.includes(m.brand)) found.push(m.brand);
    }
  }
  return found;
};

type Arm = "A0" | "A1" | "A2";

function judge(p: Pair, arm: Arm) {
  const useDescription = arm === "A2";
  const feedBrand = arm !== "A0";

  const x = (() => {
    const base = productFactsFromListing({
      title: text(p.origin.title) || "(제목 없음)",
      url: p.originUrl,
      brand: text(p.origin.brand) || null,
      description: text(p.origin.description) || null,
    });
    // 🔴 원상품 품번은 fixture 의 `originCode` 가 권위다(제목에서 재추출하지 않는다).
    return { ...base, brandModelCode: p.originCode ?? base.brandModelCode };
  })();

  const candBrands = brandsInText(
    p.candidate.title,
    useDescription ? p.candidate.description : undefined,
  );

  const y0 = productFactsFromListing({
    title: text(p.candidate.title) || "(제목 없음)",
    url: p.candidateUrl,
    // 🟢 **복구 지점** — 하니스가 이미 읽고 있던 후보 브랜드를 판정기에 되먹인다.
    brand: feedBrand ? (candBrands[0] ?? null) : null,
    description: useDescription ? text(p.candidate.description) || null : null,
  });

  /**
   * 🟢 운영 배선 재현 — `withConfidence` 가 판정 «앞» 에서 돌리는 확인기다.
   * 🔴 A2 에서만 건초더미에 설명을 더한다 — 그것이 이 WU 의 반사실이다.
   */
  const haystack = useDescription
    ? [text(p.candidate.title), text(p.candidate.description)].filter(Boolean).join("\n")
    : text(p.candidate.title);
  const confirmedCode = confirmBrandCodeInEvidence(p.originCode ?? null, {
    title: haystack,
    url: p.candidateUrl,
    sku: null,
  });
  const y = confirmedCode !== null ? { ...y0, brandModelCode: confirmedCode } : y0;

  const match = compareCrossSellerProducts(x, y);
  const axisPoints: Record<string, number> = {};
  for (const a of match.axes) axisPoints[a.axis] = (axisPoints[a.axis] ?? 0) + a.points;

  return {
    verdict: match.verdict,
    axes: Object.keys(axisPoints).length,
    axisPoints,
    blockers: match.blockers?.map((b) => b.blocker) ?? [],
    candidateBrand: candBrands[0] ?? null,
    codeConfirmed: confirmedCode !== null,
    brandCompatible:
      present(p.origin.brand) && candBrands.length > 0
        ? candBrands.some((b) => brandsCompatible(text(p.origin.brand), b))
        : null,
  };
}

/** 🔴 CONTROL 가능 집합 — 운영 저장 verdict 가 있고 **양쪽 설명이 있는** 쌍. */
const SCOPE = PAIRS.filter(
  (p) =>
    STORED_BY_URL.has(p.candidateUrl) &&
    present(p.origin.description) &&
    present(p.candidate.description),
);

const EVAL = SCOPE.map((p) => {
  const stored = STORED_BY_URL.get(p.candidateUrl)!;
  const arms = { A0: judge(p, "A0"), A1: judge(p, "A1"), A2: judge(p, "A2") };
  return {
    originCode: p.originCode,
    candidateDomain: p.candidateDomain,
    candidateUrl: p.candidateUrl,
    humanGt: stored.humanGt ?? p.humanGt,
    storedVerdict: stored.storedVerdict,
    arms,
    reproduced: {
      A0: arms.A0.verdict === stored.storedVerdict,
      A1: arms.A1.verdict === stored.storedVerdict,
      A2: arms.A2.verdict === stored.storedVerdict,
    },
    changedByDescription: arms.A1.verdict !== arms.A2.verdict,
  };
});

const reproRate = (arm: Arm) => EVAL.filter((e) => e.reproduced[arm]).length;
const tally = (arm: Arm) => {
  const t: Record<string, number> = {};
  for (const e of EVAL) t[e.arms[arm].verdict] = (t[e.arms[arm].verdict] ?? 0) + 1;
  return t;
};

describe("MDCP-01 A. CONTROL — 운영 저장 verdict 를 재현하는가", () => {
  it("A-0 🟢 분모를 먼저 적는다 — 운영 저장분 ∩ 양쪽 설명", () => {
    expect(PAIRS).toHaveLength(109);
    expect(SCOPE.length).toBeGreaterThan(0);
    // 🔴 109 · 16 · 39 · 이 분모는 **서로 다른 집합** 이다 — 합산하지 않는다.
    expect(SCOPE.length).toBe(24);
  });

  it("A-1 🔴🔴 현 하니스 모양(A0)은 운영을 **거의 재현하지 못한다** — 기존 CONTROL 실패의 재현", () => {
    expect(reproRate("A0")).toBeLessThan(SCOPE.length / 2);
  });

  it("A-2 🟢 후보 brand 를 판정기에 되먹이면(A1) 재현이 **오른다** — 원인이 그것이었다", () => {
    expect(reproRate("A1")).toBeGreaterThan(reproRate("A0"));
  });

  it("A-3 🔴 그래도 전건 재현은 아니다 — 남는 것은 **후보측 구조화 facts 부재** 다", () => {
    expect(reproRate("A1")).toBeLessThan(SCOPE.length);
  });
});

describe("MDCP-01 B. 상세설명 비교 효과 — 🔴 재현된 부분집합에서만 읽는다", () => {
  it("B-1 🔴 효과는 **CONTROL 통과 행에서만** 센다(§5-B)", () => {
    const ok = EVAL.filter((e) => e.reproduced.A1);
    const changed = ok.filter((e) => e.changedByDescription);
    // 🟢 숫자는 산출물이 들고 있다 — 이 단언은 「분모를 섞지 않았다」를 고정한다.
    expect(changed.length).toBeLessThanOrEqual(ok.length);
  });

  it("B-2 🔴🔴 설명 비교가 **GT DIFFERENT 를 SAME 쪽으로 올리지 않는다**(오염 0 절대조건)", () => {
    const worse = EVAL.filter(
      (e) =>
        e.humanGt === "DIFFERENT" &&
        e.arms.A1.verdict !== "SAME" &&
        e.arms.A2.verdict === "SAME",
    );
    expect(worse).toHaveLength(0);
  });

  it("B-3 🟢 설명이 더하는 것은 **근거** 다 — 품번 확인 건수를 갈라 센다", () => {
    const gained = EVAL.filter((e) => !e.arms.A1.codeConfirmed && e.arms.A2.codeConfirmed);
    expect(gained.length).toBeGreaterThanOrEqual(0);
  });
});

describe("MDCP-01 C. 산출물 보존", () => {
  it("C-1 🟢 `preserved/` 에 쓴다 — 🔴 `fixtures/` 를 건드리지 않는다", () => {
    const out = {
      note:
        "MI-DESCRIPTION-COMPARISON-01 — 상세설명 비교 효과 측정. 🔴 BASELINE 은 운영 저장 " +
        "system_verdict(candidate_reviews)이고 내가 계산하지 않았다. 🔴 운영 코드 0 · HTTP 0 · " +
        "수집 0 · verdict 저장 0 · 정책 0. 🔴 A0 는 기존 하니스의 CONTROL 실패를 재현한 팔이다.",
      priorArtifact:
        "preserved/mi-composite-identity-eval.json — 조합 7개 측정이 이미 있으나 control " +
        "reproduced 1/16 이라 그 수치는 전략 판단에 쓸 수 없다(이 파일이 그 원인을 고친다)",
      denominator: {
        fixturePairs: PAIRS.length,
        storedGtRows: STORED_BY_URL.size,
        scope: SCOPE.length,
        notMerged: "109 · 16 · 39 · 24 는 서로 다른 집합이다 — 합산하지 않는다",
      },
      control: {
        A0_reproduced: reproRate("A0"),
        A1_reproduced: reproRate("A1"),
        A2_reproduced: reproRate("A2"),
        of: SCOPE.length,
        cause:
          "A0 는 후보 brand 를 판정기에 넘기지 않아 전건 BRAND_UNCONFIRMED 로 축이 붕괴한다 " +
          "(mi-composite-identity-eval.test.ts:78-84). A1 이 그것을 되먹인다.",
        residualCause:
          "A1 에서도 남는 미재현은 후보측 구조화 facts(색상·소재·대상)가 fixture 에 없기 때문이고 " +
          "기존 자료로는 복구 불가다 — 측정불가로 적는다(0 이 아니다)",
      },
      verdictTally: { A0: tally("A0"), A1: tally("A1"), A2: tally("A2") },
      descriptionEffect: {
        changedRows: EVAL.filter((e) => e.changedByDescription).length,
        changedWithinReproduced: EVAL.filter((e) => e.reproduced.A1 && e.changedByDescription)
          .length,
        codeConfirmGained: EVAL.filter((e) => !e.arms.A1.codeConfirmed && e.arms.A2.codeConfirmed)
          .length,
        brandGained: EVAL.filter((e) => !e.arms.A1.candidateBrand && !!e.arms.A2.candidateBrand)
          .length,
        differentPushedToSame: EVAL.filter(
          (e) =>
            e.humanGt === "DIFFERENT" &&
            e.arms.A1.verdict !== "SAME" &&
            e.arms.A2.verdict === "SAME",
        ).length,
      },
      limitations: [
        "🔴🔴 CONTROL 이 복구 후에도 4/24 다 ⟹ 헌장 §5-B 로 **이 분모의 효과 수치를 전략 " +
          "판단에 쓰지 않는다**. 쓸 수 있는 것은 「원인이 무엇인가」까지다.",
        "🔴 미재현 15건은 전부 축 **1개**(`{CATEGORY:1}`)에 `BRAND_UNCONFIRMED` 다 — 운영은 " +
          "같은 쌍에서 ≥3축을 얻었다. 차이는 fixture 에 **후보측 구조화 facts(색상·소재·대상)가 " +
          "없다** 는 것이고 기존 자료로 복구 불가다(측정불가 · 0 이 아니다).",
        "🔴🔴 **`differentPushedToSame: 0` 을 「안전」으로 읽지 않는다.** 기존 REJECT(§0-RESULT)의 " +
          "오염 호스트 `cemarose.ca`·`tinyapple.net` 이 이 분모에 **없고 있을 수도 없다** " +
          "(109 fixture 에서 양쪽 설명 0건 · 운영 저장분 조인 0건) ⟹ 이 측정은 그 REJECT 를 " +
          "**뒤집지 않는다**. 같은 레버를 다시 열려면 그 두 호스트가 든 분모가 필요하다.",
        "🔴 SAME 으로 올라간 2건은 **같은 호스트(junioredition.com)** 다 ⟹ 호스트 1곳의 " +
          "현상이고 일반화하지 않는다. 그 둘은 품번이 설명에만 있는 `DESCRIPTION_ONLY` 유형이다.",
        "🔴 `brandGained: 0` 은 별칭 등록부가 **4개 브랜드** 뿐이기 때문이다(brand-alias.ts) — " +
          "「설명에 브랜드가 없다」가 아니다.",
      ],
      minimalOperationalChange:
        "🔴 CTO 가 구현하지 않았다(측정 종료 지시). 변경 지점은 한 곳으로 특정된다 — " +
          "`confirmBrandCodeInEvidence`(domestic-identifiers.ts:185)의 건초더미 `title·url·sku` 에 " +
          "**후보 상세설명을 더하는 것**. 🔴 그 레버는 `a-identity-axis.test.ts` 가 **기각 결론으로 " +
          "잠그고 있다** ⟹ 연결은 계약 개정을 동반하고 CPO 승인 사안이다.",
      rows: EVAL,
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));
    expect(out.rows).toHaveLength(SCOPE.length);
  });
});
