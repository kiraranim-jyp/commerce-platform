import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveMatchTruth } from "@commerce/crawler";
import { buildOverseasReference, type OverseasPriceSummary } from "../overseas-reference";
import { tierDisplay } from "../match-display";
import { priceTierFromLink } from "../../../api/domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-I / Ⓐ 어휘 정합 — **같은 상태를 같은 말로 부른다**(CPO GO 2026-11-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 원칙: 「**`PRESUMED_SAME` 은 동일상품 추정이다. `SIMILAR` 는 유사상품 참고다.
 * 두 상태를 같은 말로 표시하지 않는다.**」
 *
 * 🔴 **LOCK(이 WU 가 건드리지 않은 것 · 아래 §C 가 계약으로 지킨다)**:
 * ```
 * matchTruth · Identity 판정 · 점수 · threshold · priceTierFromLink ·
 * 가격 eligibility · `SIMILAR → textOnly` 경로 · A(Generic-only) · B(COLOR/SIZE) ·
 * 국내 REFERENCE 신설 · 추가 HTTP
 * ```
 * 🟢 바뀐 것은 `TIER_LABEL` 의 **두 글자줄** 뿐이다 — `COMPARISON` · `REFERENCE`.
 */

const summaryOf = (byPriceTier: Record<string, number>): OverseasPriceSummary => ({
  count: Object.values(byPriceTier).reduce((s, n) => s + n, 0),
  byCurrency: { USD: { count: 1, lowestAmount: 58 } },
  byMarket: { OVERSEAS: 1 },
  byPriceTier,
});
const noteOf = (byPriceTier: Record<string, number>) =>
  buildOverseasReference(summaryOf(byPriceTier), { showTierNote: true })?.tierNote ?? "";

/* ══════════════════ A — 어휘가 owner 와 일치한다(행동 축) ══════════════════ */

describe("STAGE4-I · A — tier 어휘가 owner(match-display)와 같은 말을 쓴다", () => {
  /**
   * 🔴 `TEXT_CONFIRMED` 하나가 두 이름을 갖고 있었다:
   *    `priceTierFromLink` → **COMPARISON** → 「유사상품」(이 표) 🔴
   *    `domesticMatchDisplay` → **PRESUMED_SAME** → 「동일상품 추정」(owner) 🟢
   */
  it("I-1 🔴🔴 `COMPARISON` 은 **「동일상품 추정」** 이다 — 「유사상품」이 아니다", () => {
    const note = noteOf({ COMPARISON: 2 });
    /** 🔴 확정 어휘는 **글자로** 단언한다(구현 상수를 import 하면 동어반복이다). */
    expect(note).toContain("동일상품 추정");
    expect(note, "🔴 추정을 「유사상품」이라 부르면 셀러가 그 가격을 버린다").not.toContain("유사상품");
  });

  it("I-2 🟢 `REFERENCE` 는 **「유사상품 · 참고」** 다 — 「참고」 단독이 아니다", () => {
    const note = noteOf({ REFERENCE: 1 });
    expect(note).toContain("유사상품 · 참고");
    expect(note, "🔴 「참고」만으로는 «무엇의» 참고인지 말하지 못한다").not.toBe("참고 1");
  });

  it("I-3 🔴 두 상태가 **서로 다른 말** 이다(혼동 금지 · CPO 지시 ②)", () => {
    const both = noteOf({ COMPARISON: 2, REFERENCE: 1 });
    expect(both).toContain("동일상품 추정");
    expect(both).toContain("유사상품 · 참고");
    /** 🔴 같은 말로 합쳐지면 이 WU 가 한 일이 사라진다. */
    expect(noteOf({ COMPARISON: 1 })).not.toBe(noteOf({ REFERENCE: 1 }));
  });

  /** 🟢 drift 방지 — owner 가 label 을 바꾸면 이 줄이 FAIL 한다(두 독립 owner 를 묶는다). */
  it("I-4 🟢 owner 의 label 과 **문자열이 같다** — 사본이 갈라지지 않는다", () => {
    expect(noteOf({ COMPARISON: 1 })).toContain(tierDisplay("PRESUMED_SAME").label);
    expect(noteOf({ REFERENCE: 1 })).toContain(tierDisplay("SIMILAR").label);
    expect(noteOf({ EXACT: 1 })).toContain(tierDisplay("SAME").label);
  });

  /** 🔴 기존 계약 보존 — WU-056 이 고친 `EXCLUDED` 누출과 `EXACT` 는 **그대로** 다. */
  it("I-5 🔴 `EXACT` · `EXCLUDED` 는 한 글자도 바뀌지 않았다(WU-056 보존)", () => {
    expect(noteOf({ EXACT: 3 })).toContain("동일상품 3");
    expect(noteOf({ EXCLUDED: 2 })).toContain("동일상품 아님 2");
    /** 🔴 내부 영문 토큰이 셀러 화면으로 새지 않는다. */
    for (const t of ["EXACT", "COMPARISON", "REFERENCE", "EXCLUDED"]) {
      expect(noteOf({ [t]: 1 }), `🔴 ${t} 토큰이 그대로 출력됐다`).not.toContain(t);
    }
  });
});

/* ════════ B — 노출 위치: 현재 화면은 «바뀌지 않는다»(CPO 지시 ①·③) ════════ */

describe("STAGE4-I · B — 실제 노출 위치", () => {
  const SRC = path.join(__dirname, "..");
  const read = (f: string) => readFileSync(path.join(SRC, f), "utf8");

  /**
   * 🔴🔴 **STAGE 4-H 의 서술을 정정한다.** 4-H 는 「`showTierNote` 기본값이 true 라
   *    해외에는 그 어휘가 살아 있다」고 적었다 — **호출부를 보지 않은 추론이었다.**
   * 🟢 실제로는 **두 분기 모두 `false`** 다(🇰🇷 CORE-2U-A · 🌎 CORE-2V §5).
   */
  it("I-6 🟢 `tierNote` 는 국내·해외 **둘 다 꺼져 있다** — 해외만 남은 것이 아니다", () => {
    const src = read("MarketPriceComparison.tsx");
    const hits = src.match(/showTierNote: false/g) ?? [];
    expect(hits.length, "🔴 두 분기(🇰🇷/🌎) 모두 꺼져 있어야 한다").toBe(2);
    expect(src).not.toContain("showTierNote: true");
  });

  /** 🔴 두 번째 렌더 지점은 `reference={null}` 이라 **그릴 것이 없다**. */
  it("I-7 🔴 `MarketColumn` 의 렌더는 `reference={null}` 이고 `showTierNote` 를 **받지 못한다**", () => {
    const src = read("MarketPriceComparison.tsx");
    expect(src).toContain("<OverseasReferencePrice summary={reference} {...referenceProps} />");
    /** 🟢 `referenceProps` 타입에 그 칸이 **없다** ⟹ 그 경로로는 켤 수 없다. */
    const propsType = src.slice(src.indexOf("referenceProps: {"), src.indexOf("referenceProps: {") + 320);
    expect(propsType).not.toContain("showTierNote");
  });

  /**
   * 🔴 그래서 이 WU 는 **잠재 결함** 을 고친 것이다 — 기본값이 `true` 이므로
   *    누가 `showTierNote` 를 주거나 summary 를 넘기는 순간 그 어휘가 노출된다.
   */
  it("I-8 🔴 기본값은 여전히 `true` 다 — 그래서 어휘를 고치는 것이 의미가 있다", () => {
    expect(buildOverseasReference(summaryOf({ COMPARISON: 1 }))?.tierNote).toContain("동일상품 추정");
  });

  /** 🔴 셀러 화면에서 제거된 컴포넌트는 **건드리지 않았다**(WU-149 가 뺀 둘). */
  it("I-9 🔴 `DomesticShopSearch` · `ComparisonShopSearch` 는 **렌더되지 않는다**(범위 밖)", () => {
    const ws = readFileSync(path.join(SRC, "..", "CommerceWorkspace.tsx"), "utf8");
    expect(ws).not.toContain("<DomesticShopSearch");
    expect(ws).not.toContain("<ComparisonShopSearch");
  });
});

/* ══════════ C — LOCK: 판정과 가격 eligibility 가 «한 글자도» 안 바뀐다 ══════════ */

describe("STAGE4-I · C — 판정 · eligibility 불변(LOCK)", () => {
  it("I-10 🔴 `priceTierFromLink` 매핑 전수 불변", () => {
    const t = (matchTruth: string, verified = false) =>
      priceTierFromLink({ matchTruth, verified } as never);
    expect(t("EXACT_IDENTIFIER")).toBe("EXACT");
    expect(t("STRONG_IDENTIFIER")).toBe("EXACT");
    expect(t("TEXT_CONFIRMED")).toBe("COMPARISON");
    expect(t("SIMILAR")).toBe("REFERENCE");
    expect(t("CONFLICT")).toBe("EXCLUDED");
    expect(t("INSUFFICIENT_EVIDENCE")).toBe("EXCLUDED");
  });

  /** 🔴 2026-09-20 실측(다른 신발 10건이 「비교 가능한 유사상품」으로 섰다)이 만든 줄이다. */
  it("I-11 🔴 `SIMILAR → textOnly` 경로 불변 — level low 는 INSUFFICIENT_EVIDENCE", () => {
    expect(deriveMatchTruth("low", "unavailable", "SIMILAR", [] as never, [] as never, false)).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });

  it("I-12 🔴 A 와 B 가 들어 있지 **않다**(HOLD · NO-GO 유지)", () => {
    const cross = readFileSync(
      path.join(__dirname, "../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ")
      .replace(/\s+/g, " ");
    /** 🔴 A 미적용 — 추정 게이트가 기존 술어 그대로다. */
    expect(cross).toContain(
      'if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";',
    );
    /** 🔴 B 미적용 — COLOR 축과 COLOR_VARIANT 생산자가 그대로다. */
    expect(cross).toContain('axes.push({ axis: "COLOR"');
    expect(cross).toContain('blockers.push({ blocker: "COLOR_VARIANT"');
  });

  /** 🔴 국내 REFERENCE 신설 금지 — 국내 버킷은 여전히 EXACT|COMPARISON 둘뿐이다. */
  it("I-13 🔴 국내 가격 버킷에 `REFERENCE` 를 **만들지 않았다**", () => {
    const mi = readFileSync(
      path.join(__dirname, "../../../api/price-history/_lib/market-intelligence.ts"),
      "utf8",
    );
    expect(mi).toContain('if (tier === "EXACT") exactShopRecords.push(record);');
    expect(mi).toContain('else if (tier === "COMPARISON") comparisonShopRecords.push(record);');
    expect(mi, "🔴 REFERENCE 버킷이 새로 생겼다 — 범위 밖이다").not.toContain("referenceShopRecords");
  });
});
