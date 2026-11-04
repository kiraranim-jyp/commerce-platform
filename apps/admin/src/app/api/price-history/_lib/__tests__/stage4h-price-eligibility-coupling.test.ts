import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveMatchTruth } from "@commerce/crawler";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { domesticMatchDisplay, isDefaultVisibleTier, tierDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-H — **후보 보존과 가격 eligibility 가 «한 칸» 을 공유한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 분석 전용 — 운영 코드 **0** · A/B 구현 **0** · 네트워크 **0**.
 *
 * CPO 전략(2026-11-04): 「후보 발견은 **Recall 우선** · Identity 는 **가능성 구분** ·
 * 가격은 **판정 수준에 따른 eligibility 구분** · 유사상품은 **버리지 않고 참고로 활용**」
 *
 * 🔴🔴 이 파일이 고정하는 사실 하나 — **`matchTruth` 가 셋을 동시에 결정한다**:
 * ```
 * matchTruth ──┬─ priceTierFromLink      → 가격 eligibility
 *              ├─ domesticMatchDisplay   → 화면 배지(가능성 등급)
 *              └─ isDefaultVisibleTier   → **기본 노출 여부**
 * ```
 * ⟹ 🔴 그래서 「추정 근거를 거두는」 변경이 **자동으로 「후보를 화면에서 내리는」 변경** 이 된다.
 *    그 둘을 가르려면 **분리할 자리가 필요하다**(전문 `docs/STAGE4H-...md` §6).
 */

const SRC_ROOT = path.join(__dirname, "../../../..");
const read = (p: string) => readFileSync(path.join(SRC_ROOT, p), "utf8");

/** 🟢 운영 후보의 `matchLevel` 은 **전건 low** 다(WU-088 실측 64/64) — 그 조건으로 잰다. */
const LOW = "low" as const;
const NONE = [] as never;

describe("STAGE4-H — Generic-only 후보가 A 아래에서 어디로 가는가", () => {
  /**
   * 🔴🔴 A 는 `PRESUMED_SAME → SIMILAR` 다. 그 다음이 CPO 가 의도한 곳이 **아니다**:
   * `deriveMatchTruth` 에 `if (crossSeller === "SIMILAR") return textOnly` 가 있고
   * `textOnly` 는 level low 에서 **INSUFFICIENT_EVIDENCE** 다.
   */
  it("H-1 🔴 A 적용 후 — `SIMILAR` + level low → **INSUFFICIENT_EVIDENCE**(SIMILAR 가 아니다)", () => {
    const truth = deriveMatchTruth(LOW, "unavailable", "SIMILAR", NONE, NONE, false);
    expect(truth).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("H-2 🔴 그 값의 가격 eligibility 는 **EXCLUDED** 다 — 「참고 가격」이 아니다", () => {
    expect(priceTierFromLink({ matchTruth: "INSUFFICIENT_EVIDENCE", verified: false } as never)).toBe("EXCLUDED");
  });

  it("H-3 🔴🔴 그리고 **기본 노출에서 빠진다** — 후보 보존이 깨지는 지점", () => {
    const display = domesticMatchDisplay("INSUFFICIENT_EVIDENCE" as never);
    expect(display.tier).toBe("UNKNOWN");
    expect(isDefaultVisibleTier("UNKNOWN"), "🔴 UNKNOWN 은 기본 노출에서 빠진다(더 보기 뒤)").toBe(false);
  });

  it("H-4 🟢 대조군 — 현재(BASE)의 `PRESUMED_SAME` 은 **보존되고 COMPARISON 이다**", () => {
    const truth = deriveMatchTruth(LOW, "unavailable", "PRESUMED_SAME", NONE, NONE, false);
    expect(truth).toBe("TEXT_CONFIRMED");
    expect(priceTierFromLink({ matchTruth: truth, verified: false } as never)).toBe("COMPARISON");
    const display = domesticMatchDisplay(truth);
    expect(display.tier).toBe("PRESUMED_SAME");
    expect(isDefaultVisibleTier("PRESUMED_SAME")).toBe(true);
  });

  /**
   * 🟢🟢 `crossSellerReserved` 가 **CPO 가 원하는 분리의 구현체** 다 —
   *    「추정(PRESUMED_SAME)은 식별자 경로로 확정 가격이 되지 못한다」.
   * 🔴 CF-3 은 그 상한을 **푸는** 반사실이고 R2 가 참사로 재확인했다(precision 62.5% < 87.5%).
   */
  it("H-5 🟢 `crossSellerReserved` — 품번이 exact 여도 `PRESUMED_SAME` 은 EXACT 가 못 된다", () => {
    const reserved = deriveMatchTruth(LOW, "exact", "PRESUMED_SAME", NONE, NONE, false);
    expect(reserved, "🔴 추정이 확정 식별자로 승격되면 그 상한이 풀린 것이다").toBe("TEXT_CONFIRMED");
    expect(priceTierFromLink({ matchTruth: reserved, verified: false } as never)).toBe("COMPARISON");
    /** 🟢 대조 — 같은 품번 exact 인데 verdict 가 SAME 이면 식별자 경로가 열린다. */
    const confirmed = deriveMatchTruth(LOW, "exact", "SAME", NONE, NONE, false);
    expect(confirmed).toBe("STRONG_IDENTIFIER");
    expect(priceTierFromLink({ matchTruth: confirmed, verified: false } as never)).toBe("EXACT");
  });
});

describe("STAGE4-H — 어휘: 같은 상태를 두 곳이 다르게 부른다", () => {
  /**
   * 🔴🔴 `TEXT_CONFIRMED` 하나가 두 이름을 갖는다:
   * ```
   * 후보 카드 쪽   match-display   TIERS.PRESUMED_SAME.label = **"동일상품 추정"**  🟢 정확
   * 가격 집계 쪽   overseas-reference TIER_LABEL.COMPARISON = **"유사상품"**        🔴 과소
   * ```
   * 🔴 CPO 가 원하는 4단계의 둘째 칸(「동일상품 **추정** 가격」)이 가격 쪽에서
   *    **「유사상품」으로 읽힌다** ⟹ 셀러가 그 가격을 「다른 상품 가격」으로 버릴 수 있다.
   */
  it("H-6 🟢 후보 카드 쪽 어휘는 **정확하다** — 「동일상품 추정」", () => {
    expect(tierDisplay("PRESUMED_SAME").label).toBe("동일상품 추정");
  });

  it("H-7 🔴🔴 가격 집계 쪽 어휘는 같은 상태를 **「유사상품」** 이라 부른다", () => {
    const src = read("pipeline/commerce/overseas-reference.ts");
    /** 🔴 소스로 본다 — `TIER_LABEL` 은 export 되지 않는다(사본을 만들지 않기 위해). */
    expect(src).toContain('COMPARISON: "유사상품"');
    expect(src).toContain('EXACT: "동일상품"');
  });

  /**
   * 🟢 그 어휘 문제를 **국내에서는 이미 한 번 막았다** — CORE-2U-A 가 `showTierNote` 로
   *    등급 분포 줄을 껐다(CEO 화면의 「국내 가격 형성대 **유사상품 1**」이 그 줄이었다).
   * 🔴 그러나 **기본값이 `true`** 라 **해외 축에는 그대로 남아 있다**.
   */
  it("H-8 🔴 `showTierNote` 기본값이 true 다 — 해외에는 그 어휘가 살아 있다", () => {
    const src = read("pipeline/commerce/overseas-reference.ts");
    expect(src).toContain("showTierNote");
    expect(src, "🔴 기본값이 true 라는 사실이 주석에 적혀 있다(해외 불변)").toContain("기본값은 `true`");
  });
});

describe("STAGE4-H — 국내/해외 eligibility 비대칭", () => {
  /**
   * 🔴🔴 같은 tier 가 시장에 따라 **다르게 취급된다**:
   * ```
   * 국내  market-intelligence  EXACT|COMPARISON 만 버킷에 담는다 ⟹ REFERENCE **제외**
   * 해외  candidate-market     **EXCLUDED 만** 뺀다              ⟹ REFERENCE **포함**
   * ```
   * ⟹ 🔴 CPO 4단계의 셋째 칸(「유사상품 참고 가격」)이 **국내에는 구조적으로 없다**.
   */
  it("H-9 🔴 국내 버킷은 EXACT|COMPARISON 만 담는다(REFERENCE 제외)", () => {
    const src = read("api/price-history/_lib/market-intelligence.ts");
    expect(src).toContain('if (tier === "EXACT") exactShopRecords.push(record);');
    expect(src).toContain('else if (tier === "COMPARISON") comparisonShopRecords.push(record);');
  });

  it("H-10 🔴 해외 집계는 **EXCLUDED 만** 뺀다(REFERENCE 포함)", () => {
    const src = read("api/price-history/_lib/candidate-market.ts");
    expect(src).toContain('if (r.priceTier === "EXCLUDED") continue;');
    expect(src, "🔴 REFERENCE 를 빼지 않는다는 사실이 주석에 적혀 있다").toContain("`REFERENCE` 는 **빼지 않는다.**");
  });

  /** 🟢 그리고 **판정 입력은 EXACT 하나** 다 — CPO 가 원하는 신뢰도 분리가 이미 있다. */
  it("H-11 🟢 가격 «판정» 입력은 EXACT 뿐이다(COMPARISON 은 표시 전용)", () => {
    const src = read("api/price-history/_lib/market-intelligence.ts");
    expect(src).toContain("**가격판정 입력은 EXACT 뿐이다.**");
    expect(src).toContain('domesticBasis !== "EXACT"');
  });
});
