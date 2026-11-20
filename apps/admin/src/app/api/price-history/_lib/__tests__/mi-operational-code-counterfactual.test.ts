/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI 운영 판정 경로 반사실 — 후보 `brandModelCode` 입력 유무 (평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 변경 0 · verdict 변경 0 · HTTP 0 · 수집 0 · DB 0 · 계약 변경 0.**
 * 🔴🔴 **직전 측정의 결함을 교정한다** — 그때는 `compareModelCode` 를 **직접** 불러
 *    「GT SAME 1건이 conflict 로 막힌다」를 적었다. 🔴 그것은 소비자를 거치지 않은 값이다.
 *    이번에는 **운영 판정기 `compareCrossSellerProducts`** 를 통과시켜
 *    `ageLineDesignMatch`(blocker `MODEL_CODE_AGE_LINE`) 발화까지 본다.
 * 🔴 두 설정의 차이는 **후보 facts 의 `brandModelCode` 한 칸** 뿐이다:
 *    ```
 *    BASE    productFactsFromListing 그대로 (그 팩토리는 :380 에서 **null** 을 넣는다)
 *    FILLED  그 칸에 **후보 자신의 라벨 품번**(extractLabeledProductCode(설명))을 넣는다
 *    ```
 * 🔴 `fixtures/` 쓰기 0 — 산출물은 `preserved/` 에만 쓴다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { extractLabeledProductCode } from "@commerce/shared/src/product-facts";

type Pair = {
  originUrl: string;
  originCode: string | null;
  candidateUrl: string | null;
  candidateDomain: string | null;
  humanGt: string | null;
  origin: { title?: string | null; description?: string | null; brand?: string | null };
  candidate: { title?: string | null; description?: string | null };
};

const FIXTURE = path.join(__dirname, "fixtures", "mi-reeval-03-keyword-input.json");
const OUT_DIR = path.join(__dirname, "preserved");
const OUT = path.join(OUT_DIR, "mi-operational-code-counterfactual.json");

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (v: unknown): boolean => s(v).length > 0;

/** 품번 라인 문자 — `B226A«C»009` 의 그 자리. 🔴 판정에 쓰지 않는다(분류 전용). */
const line = (code: string): string | null => code.toUpperCase().match(/^B226A([BCI])\d+$/)?.[1] ?? null;

describe("MI 운영 판정 경로 반사실 (평가 전용 · 운영 변경 0)", () => {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as { pairs: Pair[] };
  /**
   * 🔴🔴 **1차 측정을 무효로 만든 결함** — `origin.title` 이 비어 있는 행에 폴백
   * 「(제목 없음)」을 넣었더니 원상품 `coreTitleTokens` 가 `["제목","없음"]` 이 됐고,
   * `ageLineDesignMatch` 의 조건 ②(연령 어휘 뺀 토큰 **완전 일치**)가 **당연히** 실패했다.
   * 🔴 그 값을 「운영에서도 CONFLICT 로 떨어진다」로 읽으면 거짓 결론이다.
   * ⟹ **원상품 제목이 있는 행만** 유효 분모로 삼고, 없는 행은 **측정불가** 로 센다.
   */
  const gtAndDesc = raw.pairs.filter(
    (p) => has(p.humanGt) && has(p.candidate?.description) && has(p.originCode),
  );
  const unmeasurableNoOriginTitle = gtAndDesc.filter((p) => !has(p.origin?.title)).length;
  const scope = gtAndDesc.filter((p) => has(p.origin?.title));

  it("운영 판정기로 BASE ↔ FILLED 를 비교하고 preserved/ 에 보존한다", () => {
    const rows = scope.map((p) => {
      const originCode = s(p.originCode);
      const desc = s(p.candidate.description);

      const originFactsBase = productFactsFromListing({
        title: s(p.origin.title) || "(제목 없음)",
        url: p.originUrl,
        brand: s(p.origin.brand) || null,
        description: s(p.origin.description) || null,
      });
      // 🔴 원상품 품번은 fixture 의 originCode 가 권위다.
      const x = { ...originFactsBase, brandModelCode: originCode };

      const candBase = productFactsFromListing({
        title: s(p.candidate.title) || "(제목 없음)",
        url: p.candidateUrl ?? p.originUrl,
        description: desc || null,
      });
      const candOwnCode = extractLabeledProductCode(desc);
      const candFilled = candOwnCode ? { ...candBase, brandModelCode: candOwnCode } : candBase;

      const read = (m: ReturnType<typeof compareCrossSellerProducts>) => ({
        verdict: m.verdict,
        blockers: m.blockers.map((b) => b.blocker),
        conflicts: m.conflicts.map((c) => c.conflict),
        axes: m.axes.map((a) => `${a.axis}:${a.points}`),
        identifierConfirmed: m.identifierConfirmed,
      });

      const base = read(compareCrossSellerProducts(x, candBase));
      const filled = read(compareCrossSellerProducts(x, candFilled));

      const originLine = line(originCode);
      const candLine = candOwnCode ? line(candOwnCode) : null;

      return {
        originCode,
        candidateDomain: p.candidateDomain,
        candidateUrl: p.candidateUrl,
        humanGt: p.humanGt,
        candidateOwnCode: candOwnCode,
        /** 🟢 직접 호출값 — 운영 경로 결과와 **구분해서** 적는다. */
        directCompareModelCode: candOwnCode ? compareModelCode(originCode, candOwnCode) : "unavailable",
        isAcAbLine: Boolean(originLine && candLine && originLine !== candLine),
        isSameLineDifferentNumber:
          Boolean(originLine && candLine && originLine === candLine) &&
          originCode.toUpperCase() !== (candOwnCode ?? "").toUpperCase(),
        originCoreTitleTokens: x.coreTitleTokens,
        candidateCoreTitleTokens: candFilled.coreTitleTokens,
        base,
        filled,
        /** 🟢 `ageLineDesignMatch` 의 관측 가능한 산출물. */
        ageLineBlockerFired: filled.blockers.includes("MODEL_CODE_AGE_LINE"),
        modelCodeConflictRecorded: filled.conflicts.includes("MODEL_CODE"),
        verdictChanged: base.verdict !== filled.verdict,
      };
    });

    const tally = (key: "base" | "filled") => {
      const out = { SAME: {}, DIFFERENT: {}, SIMILAR: {} } as Record<string, Record<string, number>>;
      for (const r of rows) {
        const gt = r.humanGt as string;
        const v = r[key].verdict;
        out[gt] = out[gt] ?? {};
        out[gt][v] = (out[gt][v] ?? 0) + 1;
      }
      return out;
    };

    const changed = rows.filter((r) => r.verdictChanged);
    const withOwnCode = rows.filter((r) => r.candidateOwnCode);

    const artifact = {
      note:
        "🔴 평가 전용 · 운영 변경 0 · verdict 변경 0 · HTTP 0 · 수집 0. " +
        "두 설정의 차이는 후보 facts 의 brandModelCode 한 칸뿐이다(BASE 는 listing 팩토리의 null). " +
        "directCompareModelCode 는 **직접 호출값** 이고 base/filled 는 **운영 판정기 산출** 이다 — 섞지 않는다. " +
        "분모는 GT 라벨 ∩ 후보 설명 ∩ originCode 이며 16쌍·A군 7·IDENTITY_AXIS 26 과 합산하지 않는다.",
      denominator: {
        scope: rows.length,
        /** 🔴 0 으로 세지 않는다 — 원상품 제목이 없어 `ageLineDesignMatch` 를 잴 수 없는 행. */
        unmeasurableNoOriginTitle,
        gt: rows.reduce<Record<string, number>>((a, r) => {
          const k = r.humanGt as string;
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        candidateOwnCodeRecovered: withOwnCode.length,
        notMerged: { bothSideFullText: 16, aGroupFullText: 7, identityAxisPairs: 26 },
      },
      verdictByGt: { base: tally("base"), filled: tally("filled") },
      changedPairs: changed.map((r) => ({
        host: r.candidateDomain,
        humanGt: r.humanGt,
        originCode: r.originCode,
        candidateOwnCode: r.candidateOwnCode,
        directCompareModelCode: r.directCompareModelCode,
        from: r.base.verdict,
        to: r.filled.verdict,
        ageLineBlockerFired: r.ageLineBlockerFired,
        modelCodeConflictRecorded: r.modelCodeConflictRecorded,
      })),
      acAbCases: rows
        .filter((r) => r.isAcAbLine)
        .map((r) => ({
          host: r.candidateDomain,
          humanGt: r.humanGt,
          originCode: r.originCode,
          candidateOwnCode: r.candidateOwnCode,
          directCompareModelCode: r.directCompareModelCode,
          ageLineBlockerFired: r.ageLineBlockerFired,
          modelCodeConflictRecorded: r.modelCodeConflictRecorded,
          baseVerdict: r.base.verdict,
          filledVerdict: r.filled.verdict,
          originCoreTitleTokens: r.originCoreTitleTokens,
          candidateCoreTitleTokens: r.candidateCoreTitleTokens,
        })),
      sameLineDifferentNumberCases: rows.filter((r) => r.isSameLineDifferentNumber).length,
      rows,
    };

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(artifact, null, 1), "utf8");

    // 🔴 사실 단언만 둔다 — 결과를 통과시키기 위한 단언을 쓰지 않는다.
    expect(rows.length + unmeasurableNoOriginTitle).toBe(gtAndDesc.length);
    expect(withOwnCode.length).toBeGreaterThan(0);
    // 🟢 이 분모에서 GT DIFFERENT 는 두 설정에서 **같아야** 한다(오염 0). 깨지면 FAIL 로 드러난다.
    expect(artifact.verdictByGt.filled.DIFFERENT).toEqual(artifact.verdictByGt.base.DIFFERENT);
  });
});
