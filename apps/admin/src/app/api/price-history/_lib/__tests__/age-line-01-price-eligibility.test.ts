import { describe, expect, it } from "vitest";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-AGE-LINE-AUDIT-01 §13 — **M5/M6 가격 자격**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO §9 가 제안한 변경:
 * ```
 * PRESUMED + blocker 있음  →  가격 집계 **제외**
 * ```
 *
 * 🔴🔴🔴 **그 변경을 구현하지 않았다 — 현재 표본에서 «순손실» 이기 때문이다.**
 *    실측(AGE-LINE-01 · 새 Search 0 · 금액 보유 SAME/PRESUMED **19**):
 * ```
 * 제외 대상(PRESUMED + blocker) **7**
 *   🔴 그중 **6 건이 human SAME** 이다
 *      biskuit.kr ₩88,000(SAME) · cissywears £33(SAME) · kids21 S$70(SAME) ·
 *      kolkid C$56(SAME) · cissywears £33(SAME) · billsstore ₩70,000(SAME)
 *   🟢 human DIFFERENT 는 **1 건뿐** (m.luxboy ₩59,000)
 * 🔴🔴 제외하면 남는 **KRW 후보가 1 건**(beaumonde ₩83,600)이 된다 —
 *    정답 ₩88,000 과 ₩70,000 이 **같이 사라진다**.
 * ```
 * ⟹ FP 1 을 막으려고 정답 6 을 버린다. CPO §11 KPI(「recovery ↑ **그리고**
 *    leakage ↓」)에 **역행** 하므로 **STOP** 하고 정책 결정으로 올린다.
 *
 * 🟢 그리고 blocker 종류로 갈라도 순이득이 안 된다(실측):
 * ```
 * AUDIENCE_LINE      5 → 전부 human SAME      ← 빼면 안 된다
 * NO_TITLE_OVERLAP   2 → SAME 1 · DIFFERENT 1  ← precision 1/2
 * ```
 *
 * 🔴 이 파일은 **현재 동작을 고정** 한다. 정책이 열리면 M5 가 FAIL 로 뒤집히고
 *    그것이 수정의 증거다.
 */

describe("AGE-LINE-01 M5/M6 — 가격 자격의 «현재» 동작", () => {
  /**
   * 🔴 M5 — 운영 owner 는 `matchTruth` 와 `verified` **둘만** 본다.
   *    blocker 는 **보지 않는다** ⟹ 「blocker 있는 PRESUMED」가 지금은 가격 축에 든다.
   */
  it("M5 🔴 `priceTierFromLink` 는 blocker 를 **보지 않는다**(현재 동작)", () => {
    /** PRESUMED_SAME 의 실제 귀결 — `matchTruth = TEXT_CONFIRMED` · verified 아님. */
    const tier = priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false });
    expect(tier, "정책이 열렸다면 이 단언을 갱신해야 한다").toBe("COMPARISON");
    /** 🔴 국내 축 자격은 `EXACT | COMPARISON` 이라 **이 값이 가격에 들어간다**. */
    expect(["EXACT", "COMPARISON"]).toContain(tier);
  });

  /** 🟢 M6 — 확정 SAME 경로는 **불변** 이다(이 감사가 가격을 한 칸도 바꾸지 않았다). */
  it("M6 🟢 식별자 확정 경로는 `EXACT` 그대로다", () => {
    expect(priceTierFromLink({ matchTruth: "EXACT_IDENTIFIER", verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: "STRONG_IDENTIFIER", verified: true })).toBe("EXACT");
  });

  /** 🟢 그리고 **동일상품이 아닌 것** 은 이미 금액에서 빠진다(WU-062 · 되돌리지 않았다). */
  it("M6-b 🟢 CONFLICT 는 `EXCLUDED` 다 — 금액 집계에서 빠진다", () => {
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
  });
});
