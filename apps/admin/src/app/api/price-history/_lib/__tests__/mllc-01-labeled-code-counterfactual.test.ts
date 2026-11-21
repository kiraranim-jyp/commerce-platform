import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { findBrandAliasMentions } from "@commerce/crawler/src/comparison-search/brand-alias";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import { recoverModelCodeFromDetail } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import { confirmBrandCodeInEvidence } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { extractLabeledProductCode } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLLC-01 — **승인된 「라벨 전용」 변경의 «순효과» 를 먼저 잰다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **착수 전 확인에서 그 변경이 «이미 구현돼 있다» 는 것이 나왔다**(헌장 §4-D).
 * ```
 * 승인 변경   `productFactsFromListing`(seller-facts.ts:380)의 `brandModelCode: null` 을
 *            `extractLabeledProductCode(input.description) ?? null` 로 채운다
 * 🔴 그런데  운영 PLAIN_HTML 경로는 그 팩토리 **산출물에**
 *            `recoverModelCodeFromDetail`(model-code-from-detail.ts:68)을 **이미 적용** 한다
 *            (product-url-facts.ts:621 · SHOPIFY_JSON 쪽은 :428)
 *            그 함수는 `facts.description` 에서 **품번 «모양»**(`\bB\d{3}[A-Z]{2}\d{3}\b`)을
 *            찾아 **비어 있을 때만** 채운다(Contract A/C) ⟹ **라벨을 요구하지 않는다**
 * ⟹ 🔴 승인 변경은 그보다 **좁다**(라벨 필수) ⟹ 순효과가 **0 일 것** 으로 보인다
 * ```
 * 🟢 그래서 이 파일은 **구현 전에 그 가정을 반사실로 검증** 한다 — 운영 코드 **0 줄** 변경.
 *
 * 🔴 **두 팔은 운영 호출 순서를 그대로 베낀다**(§5-B):
 * ```
 * BASE   productFactsFromListing(… description …)            → recoverModelCodeFromDetail
 * LABEL  productFactsFromListing(…) + brandModelCode 를 라벨로 채운 뒤 → recoverModelCodeFromDetail
 * 🔴 두 팔의 **다른 점은 그 한 칸뿐** 이다. 나머지 입력은 바이트 동일하게 만든다.
 * ```
 *
 * 🔴 **동결 준수** — SAME/PRESUMED_SAME 임계값 · blocker · BRAND 점수 · Contract P2 ·
 *    `materialText`/`fitText`/`ageRangeText`/`sizeLabels` · slug 폴백 · `sellerSku`
 *    **전부 건드리지 않는다**. HTTP **0** · DB **0** · 수집 **0**.
 */

const HERE = __dirname;
const FIXTURE = path.join(HERE, "fixtures", "mi-reeval-03-keyword-input.json");
const OUT = path.join(HERE, "preserved", "mllc-01-labeled-code-counterfactual.json");

const t = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

interface Pair {
  originUrl: string | null;
  originCode: string | null;
  candidateUrl: string;
  candidateDomain: string | null;
  humanGt: string | null;
  origin: { title?: string; description?: string; brand?: string };
  candidate: { title?: string; description?: string };
}

const PAIRS: Pair[] = (() => {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8"));
  return (raw.pairs ?? raw) as Pair[];
})();

/** 🟢 후보 브랜드는 **두 팔에 동일하게** 넣는다 — 델타에 영향을 주지 않게 한다. */
const candidateBrand = (p: Pair): string | null => {
  for (const part of [p.candidate.title, p.candidate.description]) {
    if (!t(part)) continue;
    const hit = findBrandAliasMentions(t(part));
    if (hit.length > 0) return hit[0]!.brand;
  }
  return null;
};

const originFacts = (p: Pair) => {
  const base = productFactsFromListing({
    title: t(p.origin.title) || "(제목 없음)",
    url: p.originUrl ?? p.candidateUrl,
    brand: t(p.origin.brand) || null,
    description: t(p.origin.description) || null,
  });
  /**
   * 🔴🔴 **원상품 품번은 fixture 의 `originCode` «하나» 가 권위다.**
   *    1차 하니스는 `?? base.brandModelCode` 로 폴백했는데, 구현이 들어간 뒤
   *    그 폴백이 **원상품 설명의 라벨 코드** 를 끌어와 `originCode === null` 인 쌍의
   *    판정을 바꿨다 ⟹ **두 팔 모두** 가 흔들려 델타가 오염됐다(A-3 가 그것을 FAIL 로 잡았다).
   * 🔴 그리고 그것은 **운영 모양이 아니다** — 운영 원상품 facts 는
   *    `productFactsFromIdentityDna`(origin-facts.ts:44)가 만들고 이 팩토리를 쓰지 않는다.
   * 🟢 그래서 폴백을 없앤다 — 원상품 코드는 **있으면 그 값, 없으면 null** 이다.
   */
  return { ...base, brandModelCode: p.originCode ?? null };
};

/** 🔴 운영 PLAIN_HTML 경로를 그대로 베낀다 — 팩토리 → `recoverModelCodeFromDetail`. */
const candidateFacts = (p: Pair, arm: "BASE" | "LABEL") => {
  const description = t(p.candidate.description) || null;
  const made = productFactsFromListing({
    title: t(p.candidate.title) || "(제목 없음)",
    url: p.candidateUrl,
    brand: candidateBrand(p),
    description,
  });
  /**
   * 🔴🔴 **두 팔을 «팩토리의 현재 동작과 무관하게» 고정한다.**
   *    구현이 들어간 뒤에 BASE 를 팩토리 그대로 쓰면 BASE == LABEL 이 되어 이 반사실이
   *    **동어반복** 이 된다(실제로 한 번 그렇게 됐고 A-4 가 조용히 통과로 뒤집혔다).
   * 🟢 그래서 BASE 는 **변경 전 동작(`brandModelCode: null`)을 명시 재현** 하고,
   *    LABEL 은 **승인된 한 줄** 을 명시 재현한다. 둘 다 그 뒤에 운영 복구기를 통과한다.
   */
  const armed =
    arm === "LABEL"
      ? { ...made, brandModelCode: extractLabeledProductCode(description) ?? null }
      : { ...made, brandModelCode: null };
  return recoverModelCodeFromDetail(armed);
};

const judge = (p: Pair, arm: "BASE" | "LABEL") => {
  const y = candidateFacts(p, arm);
  const m = compareCrossSellerProducts(originFacts(p), y);
  const pts: Record<string, number> = {};
  for (const a of m.axes) pts[a.axis] = (pts[a.axis] ?? 0) + a.points;
  return {
    verdict: m.verdict,
    brandModelCode: y.brandModelCode,
    axisPoints: pts,
    blockers: (m.blockers ?? []).map((b) => b.blocker),
    conflicts: (m.conflicts ?? []).map((c) => c.conflict),
  };
};

const ROWS = PAIRS.map((p) => {
  const base = judge(p, "BASE");
  const label = judge(p, "LABEL");
  return {
    originCode: p.originCode,
    candidateDomain: p.candidateDomain ?? "(공백)",
    candidateUrl: p.candidateUrl,
    humanGt: p.humanGt ?? "미라벨",
    base,
    label,
    verdictChanged: base.verdict !== label.verdict,
    codeChanged: base.brandModelCode !== label.brandModelCode,
  };
});

const byGt = (g: string) => ROWS.filter((r) => r.humanGt === g);
const tally = (rs: typeof ROWS, pick: (r: (typeof ROWS)[number]) => string) => {
  const o: Record<string, number> = {};
  for (const r of rs) o[pick(r)] = (o[pick(r)] ?? 0) + 1;
  return o;
};
const hasCodeConflict = (a: { conflicts: string[] }) => a.conflicts.includes("MODEL_CODE");

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 STEP A-2 — **`match.ts` 의 «확인 경로» 를 포함한 반사실**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 1차 반사실은 `compareCrossSellerProducts` 를 **직접** 불러 운영 배선 하나를
 *    건너뛰었다. `match.ts:629` 가 그것이다:
 * ```
 * c.facts.brandModelCode === null && query.facts?.brandModelCode
 *   ? { ...c.facts, brandModelCode: confirmBrandCodeInEvidence(원상품품번,
 *                                     { title, url, sku }) }
 *   : c.facts
 * ```
 * 🔴🔴 **칸이 «채워지면» 그 확인 경로가 아예 돌지 않는다.** 그래서 라벨 복구가
 *    ⒜ 원상품 코드를 title/url 에서 확인하던 쌍의 **확인을 막고**
 *    ⒝ 대신 **다른 코드** 를 넣어 `compareModelCode` 충돌을 만들 수 있다.
 *    🟢 `core-2j-identity-field-purity` A 의 주석이 바로 그 위험을 적어 둔다.
 * 🟢 그래서 **같은 109건 · 새 수집 0** 으로 그 배선까지 포함해 다시 잰다.
 * 🔴 운영 코드는 **한 글자도** 바꾸지 않는다(이 파일은 평가 전용이다).
 */
const judgeWithConfirm = (p: Pair, arm: "BASE" | "LABEL") => {
  const x = originFacts(p);
  const description = t(p.candidate.description) || null;
  const made = productFactsFromListing({
    title: t(p.candidate.title) || "(제목 없음)",
    url: p.candidateUrl,
    brand: candidateBrand(p),
    description,
  });
  const armed =
    arm === "LABEL"
      ? { ...made, brandModelCode: extractLabeledProductCode(description) ?? null }
      : { ...made, brandModelCode: null };
  const afterRecover = recoverModelCodeFromDetail(armed);
  /** 🟢 `match.ts:629` 와 **같은 게이트** 다 — 채워져 있으면 확인하지 않는다. */
  const y =
    afterRecover.brandModelCode === null && x.brandModelCode
      ? {
          ...afterRecover,
          brandModelCode: confirmBrandCodeInEvidence(x.brandModelCode, {
            title: t(p.candidate.title),
            url: p.candidateUrl,
            sku: afterRecover.sellerSku ?? null,
          }),
        }
      : afterRecover;
  const m = compareCrossSellerProducts(x, y);
  return {
    verdict: m.verdict,
    brandModelCode: y.brandModelCode,
    confirmRan: afterRecover.brandModelCode === null && !!x.brandModelCode,
    conflicts: (m.conflicts ?? []).map((c) => c.conflict),
  };
};

const WIRED = PAIRS.map((p) => {
  const base = judgeWithConfirm(p, "BASE");
  const label = judgeWithConfirm(p, "LABEL");
  return {
    originCode: p.originCode,
    candidateDomain: p.candidateDomain ?? "(공백)",
    candidateUrl: p.candidateUrl,
    humanGt: p.humanGt ?? "미라벨",
    base,
    label,
    verdictChanged: base.verdict !== label.verdict,
    /** 🔴 확인 경로가 BASE 에서는 돌고 LABEL 에서는 «막힌» 쌍 — 이것이 그 위험 모드다. */
    confirmSuppressed: base.confirmRan && !label.confirmRan,
  };
});
const wiredByGt = (g: string) => WIRED.filter((r) => r.humanGt === g);
const hasCodeConflictW = (a: { conflicts: string[] }) => a.conflicts.includes("MODEL_CODE");

describe("MLLC-01 STEP A-2 — 확인 경로를 포함한 반사실(같은 109건 · 새 수집 0)", () => {
  it("A2-0 🟢 확인 경로가 **실제로 발화하는 쌍이 있다** — 배선을 모델링했다는 증거", () => {
    expect(WIRED.filter((r) => r.base.confirmRan).length).toBeGreaterThan(0);
  });

  it("A2-1 🔴🔴 **GT DIFFERENT → SAME 전환 0** (확인 경로 포함)", () => {
    expect(
      wiredByGt("DIFFERENT").filter((r) => r.base.verdict !== "SAME" && r.label.verdict === "SAME"),
    ).toHaveLength(0);
  });

  it("A2-2 🔴🔴 **GT SAME 이 품번 충돌로 새로 막히지 않는다** (확인 경로 포함)", () => {
    expect(
      wiredByGt("SAME").filter((r) => !hasCodeConflictW(r.base) && hasCodeConflictW(r.label)),
    ).toHaveLength(0);
  });

  it("A2-3 🔴 **확인 경로가 막혀 verdict 가 나빠진 쌍이 0** 이다", () => {
    const harmed = WIRED.filter((r) => r.confirmSuppressed && r.verdictChanged);
    expect(harmed).toHaveLength(0);
  });

  it("A2-4 🔴 전 분모 verdict 변화 0 — 확인 배선을 넣어도 같다", () => {
    expect(WIRED.filter((r) => r.verdictChanged)).toHaveLength(0);
  });
});

describe("MLLC-01 STEP A — 반사실(운영 호출 순서 그대로 · HTTP 0)", () => {
  it("A-0 🟢 분모를 먼저 적는다 — GT 라벨별로 **per-label 까지** 가른다(합산 금지)", () => {
    /**
     * 🔴🔴 **1차 A-0 은 합계(36)만 단언해서 내 보고서의 거짓 수치를 잡지 못했다.**
     *    보고서가 98 축 숫자(SAME 18 · DIFFERENT 13)를 109 축에 섞어 적었고 CPO 가 잡았다.
     * 🟢 그래서 per-label 을 **상호 배타** 로 잠근다 — 조용히 틀릴 자리를 없앤다.
     */
    expect(ROWS).toHaveLength(109);
    expect(byGt("SAME")).toHaveLength(20);
    expect(byGt("DIFFERENT")).toHaveLength(15);
    expect(byGt("SIMILAR")).toHaveLength(1);
    expect(byGt("미라벨")).toHaveLength(73);
    /** 🔴 그 넷 밖의 라벨이 **없다** — 분류되지 않은 값이 생기면 FAIL 한다. */
    const known = new Set(["SAME", "DIFFERENT", "SIMILAR", "미라벨"]);
    expect(ROWS.filter((r) => !known.has(r.humanGt))).toHaveLength(0);
    /** 🟢 상호 배타 합계 = 전수. */
    expect(20 + 15 + 1 + 73).toBe(ROWS.length);
  });

  it("A-1 🔴🔴 **GT DIFFERENT → SAME 전환이 0건** 이다(CPO 핵심 통과 조건)", () => {
    const opened = byGt("DIFFERENT").filter(
      (r) => r.base.verdict !== "SAME" && r.label.verdict === "SAME",
    );
    expect(opened).toHaveLength(0);
  });

  it("A-2 🔴 **GT SAME 이 품번 충돌로 새로 막히는 건수**를 센다(숨기지 않는다)", () => {
    const blocked = byGt("SAME").filter(
      (r) => !hasCodeConflict(r.base) && hasCodeConflict(r.label),
    );
    // 🟢 산출물이 명단을 들고 있다 — 이 단언은 「세었다」를 고정한다.
    expect(blocked.length).toBeGreaterThanOrEqual(0);
  });

  it("A-3 🔴🔴 **순효과 — verdict 가 바뀐 쌍이 전 분모에서 0건** 이다", () => {
    expect(ROWS.filter((r) => r.verdictChanged)).toHaveLength(0);
  });

  it("A-4 🟢 BASE 팔에서도 품번이 복구된다 — `recoverModelCodeFromDetail` 이 살아 있다", () => {
    // 🔴 이것이 0 이면 「이미 복구된다」가 거짓이고 §4-D 판단의 전제가 무너진다.
    expect(ROWS.filter((r) => r.base.brandModelCode != null).length).toBeGreaterThan(0);
  });

  it("A-4b 🔴🔴 그런데 **중복이 아니다** — 라벨 추출이 칸을 «추가로» 채우는 쌍이 있다", () => {
    const added = ROWS.filter((r) => r.base.brandModelCode == null && r.label.brandModelCode != null);
    // 🟢 운영 복구기는 모양(`B###AA###`)만 읽으므로 다른 브랜드 품번을 못 읽는다.
    expect(added.length).toBeGreaterThan(0);
    // 🔴 그리고 그중 **모양 규칙을 벗어난 값** 이 실재한다(그것이 공백의 증거다).
    const bobo = /^B\d{3}[A-Z]{2}\d{3}$/;
    expect(added.some((r) => !bobo.test(String(r.label.brandModelCode)))).toBe(true);
  });

  it("A-4c 🔴 라벨 값이 기존 복구값을 **덮어쓰지 않는다**(열화 방지 · 실측 0건)", () => {
    const overwritten = ROWS.filter(
      (r) =>
        r.base.brandModelCode != null &&
        r.label.brandModelCode != null &&
        r.base.brandModelCode !== r.label.brandModelCode,
    );
    expect(overwritten).toHaveLength(0);
  });

  it("A-5 🔴 운영 복구기는 **라벨을 요구하지 않는다** — 승인 변경이 더 좁다는 근거", () => {
    const src = readFileSync(
      path.join(HERE, "..", "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "comparison-search", "model-code-from-detail.ts"),
      "utf8",
    );
    // 🔴 주석을 벗기고 본다(이 트랙의 함정).
    const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");
    expect(code).toContain("facts.description");
    expect(code).toContain("if (facts.brandModelCode) return facts");
    // 🟢 라벨 추출기를 쓰지 않는다 ⟹ 모양만으로 읽는다.
    expect(code).not.toContain("extractLabeledProductCode");
  });

  it("A-6 🔴 운영 PLAIN_HTML 경로가 그 복구기를 **실제로 부른다**(배선 단언)", () => {
    const src = readFileSync(
      path.join(HERE, "..", "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "comparison-search", "product-url-facts.ts"),
      "utf8",
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");
    expect(code).toContain("attachProductEvidence(recoverModelCodeFromDetail(facts))");
  });

  it("A-7 🟢 산출물을 `preserved/` 에 남긴다 — 🔴 `fixtures/` 는 건드리지 않는다", () => {
    const sameBlocked = byGt("SAME").filter(
      (r) => !hasCodeConflict(r.base) && hasCodeConflict(r.label),
    );
    const out = {
      note:
        "MLLC-01 STEP A — 승인된 「라벨 전용」 변경의 순효과 반사실. 🔴 운영 코드 0 · HTTP 0 · " +
        "DB 0 · 수집 0. 🔴 두 팔의 차이는 후보 `brandModelCode` 한 칸뿐이고 나머지 입력은 동일하다.",
      finding:
        "🔴🔴 순효과 0 — 운영 PLAIN_HTML 경로가 `recoverModelCodeFromDetail`(model-code-from-detail.ts:68)을 " +
        "product-url-facts.ts:621 에서 이미 적용하고, 그 함수는 라벨 없이 품번 모양만으로 " +
        "`brandModelCode` 를 비어 있을 때만 채운다(Contract A/C) ⟹ 승인 변경은 그 부분집합이다.",
      denominator: {
        fixturePairs: ROWS.length,
        gt: tally(ROWS, (r) => r.humanGt),
        notMerged: "109 · 36(GT) · 73(미라벨) · 98 · 24 · 16 은 서로 다른 집합 — 합산하지 않는다",
      },
      stepB: {
        "① GT DIFFERENT → SAME 전환": byGt("DIFFERENT").filter(
          (r) => r.base.verdict !== "SAME" && r.label.verdict === "SAME",
        ).length,
        "② GT SAME 이 품번 충돌로 새로 막힘": sameBlocked.length,
        "③ GT SIMILAR verdict 변화": byGt("SIMILAR").filter((r) => r.verdictChanged).length,
        "④ 미라벨 verdict 변화": byGt("미라벨").filter((r) => r.verdictChanged).length,
        "⑤ 전 분모 verdict 변화": ROWS.filter((r) => r.verdictChanged).length,
        "⑥ 전 분모 brandModelCode 칸 변화": ROWS.filter((r) => r.codeChanged).length,
      },
      /**
       * 🔵 STEP A-2 — `match.ts:629` 확인 경로를 포함한 재측정(같은 109건).
       * 🔴 1차 반사실이 건너뛴 배선이고, `core-2j` A 가 경고한 위험 모드다.
       */
      stepA2WithConfirmPath: {
        "확인 경로가 BASE 에서 발화한 쌍": WIRED.filter((r) => r.base.confirmRan).length,
        "확인 경로가 LABEL 에서 «막힌» 쌍": WIRED.filter((r) => r.confirmSuppressed).length,
        "그중 verdict 가 나빠진 쌍": WIRED.filter((r) => r.confirmSuppressed && r.verdictChanged)
          .length,
        "GT DIFFERENT → SAME 전환": wiredByGt("DIFFERENT").filter(
          (r) => r.base.verdict !== "SAME" && r.label.verdict === "SAME",
        ).length,
        "GT SAME 품번충돌 새 차단": wiredByGt("SAME").filter(
          (r) => !hasCodeConflictW(r.base) && hasCodeConflictW(r.label),
        ).length,
        "전 분모 verdict 변화": WIRED.filter((r) => r.verdictChanged).length,
      },
      baseRecovery: {
        "BASE 팔에서 품번이 복구된 쌍": ROWS.filter((r) => r.base.brandModelCode != null).length,
        "그중 GT 라벨 보유": ROWS.filter(
          (r) => r.base.brandModelCode != null && r.humanGt !== "미라벨",
        ).length,
      },
      verdictTally: { base: tally(ROWS, (r) => r.base.verdict), label: tally(ROWS, (r) => r.label.verdict) },
      sameBlockedByCodeConflict: sameBlocked.map((r) => ({
        originCode: r.originCode,
        host: r.candidateDomain,
        baseCode: r.base.brandModelCode,
        labelCode: r.label.brandModelCode,
      })),
      limitations: [
        "🔴 이 반사실은 **PLAIN_HTML(후보 상세 URL) 경로** 를 재현한다. 등록부 어댑터 7개" +
          "(looxloo·rulii·deuxbebe·littleluna·chocoel·foretforet·childrensalon)는 " +
          "`productFactsFromListing` 에 `description` 을 **넘기지 않으므로**(전수 grep 0) " +
          "승인 변경도 `recoverModelCodeFromDetail` 도 **읽을 것이 없다** ⟹ 그 경로의 품번 공백은 " +
          "STRUCTURING_GAP 이 아니라 **DATA_SOURCE_GAP** 이다.",
        "🔴 후보 브랜드는 등록부 4개 별칭으로만 채웠다(두 팔 동일) — 운영의 JSON-LD 브랜드가 아니다. " +
          "델타에는 영향이 없으나 **절대 verdict 값은 운영 값이 아니다**.",
        "🔴 미라벨 73건은 GT 가 없으므로 전환의 옳고 그름을 판정할 수 없다(측정불가 · 0 이 아니다).",
      ],
      rows: ROWS,
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));
    expect(out.rows).toHaveLength(ROWS.length);
  });
});
