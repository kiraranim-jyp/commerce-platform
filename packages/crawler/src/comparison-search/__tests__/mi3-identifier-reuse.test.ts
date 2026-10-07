import { describe, expect, it } from "vitest";
import {
  OBSERVED_DIFFERENCE_BLOCKER_LIST,
  hasObservedDifference,
  type CrossSellerBlocker,
} from "../cross-seller";
import { deriveMatchTruth } from "../match-truth";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-3 / P0-1(CPO 지시, 2026-09-26) — **품번 재사용 회귀 matrix**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 목표는 한 문장이다: 「판매처가 품번을 재사용하는 경우에도 다른 상품이 EXACT 로
 * 뚫리지 않게 한다」. 실제 픽스처 7쌍은 `__tests__/identifier-safety.test.ts` 가
 * 덮고, 이 파일은 그 «규칙 자체» 를 조합으로 전수 고정한다.
 *
 * 🔴 기존 정책을 바꾸지 않았다는 것도 함께 지킨다 — 점수·threshold·CONFLICT 우선·
 * 「확인 못 했다」의 취급이 그대로인지 여기서 센다.
 */

const b = (...list: CrossSellerBlocker[]) => list.map((blocker) => ({ blocker }));

describe("① 🔴 품번 재사용 — 관측된 차이가 있으면 식별자 단독 승격을 막는다", () => {
  it("같은 판매처가 두 상품으로 진열했다 + 품번 exact → EXACT 아님", () => {
    /* 실측 7쌍의 구조 그대로다. 품번은 같고, 판매처가 스스로 둘로 진열했다. */
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", b("SAME_SELLER_DISTINCT_LISTING"))).toBe(
      "TEXT_CONFIRMED",
    );
    expect(deriveMatchTruth("high", "exact", "PRESUMED_SAME", b("SAME_SELLER_DISTINCT_LISTING"))).toBe(
      "TEXT_CONFIRMED",
    );
  });

  it("품번 partial 도 같다 — Misha&Puff 두 쌍의 구조", () => {
    expect(deriveMatchTruth("low", "partial", "PRESUMED_SAME", b("SAME_SELLER_DISTINCT_LISTING"))).toBe(
      "TEXT_CONFIRMED",
    );
  });

  it("🔴 「다른 상품이다」로 «단정하지» 않는다 — CONFLICT 로 보내지 않는다", () => {
    /* 근거는 「확정할 수 없다」까지다. 참고 가격으로는 남는다. */
    const truth = deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", b("SAME_SELLER_DISTINCT_LISTING"));
    expect(truth).not.toBe("CONFLICT");
    expect(truth).not.toBe("INSUFFICIENT_EVIDENCE");
  });

  it.each([
    "GARMENT_FORM",
    "MATERIAL",
    "FIT",
    "SIZE_SYSTEM",
    "BRAND_MISMATCH",
    "AUDIENCE_LINE",
    "NO_TITLE_OVERLAP",
  ] as CrossSellerBlocker[])("%s 도 «관측된 차이» 다 — 품번 단독 승격을 막는다", (blocker) => {
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", b(blocker))).not.toBe("EXACT_IDENTIFIER");
  });
});

describe("② 🔴 「확인 못 했다」로는 깎지 않는다", () => {
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴 이 원칙은 **살아 있지만 범위가 좁아졌다** — MI P0 IDENTITY PRECISION FIX
   *    (CPO 결정 1, 2026-10-07).
   * ══════════════════════════════════════════════════════════════════════════
   *
   * MI-3 의 원칙은 「모르는 것(BRAND_UNCONFIRMED)을 반증으로 쓰지 않는다」였고,
   * 지키려던 것은 **포레포레 골든케이스** — 정보가 부족한 판매처의 진짜 동일상품이
   * 식별자가 있는데도 사라지는 일이다.
   *
   * 🟢 그 골든케이스는 그대로 산다. 그것은 `partial + SIMILAR` 이고(아래 둘째 줄),
   *    CPO 결정 1 은 SIMILAR 을 건드리지 않는다.
   *
   * 🔴 좁아진 칸은 «하나» 다 — verdict 가 **PRESUMED_SAME** 일 때. 이제는 보류 사유가
   *    BRAND_UNCONFIRMED 하나뿐이어도 식별자 단독 확정을 막는다. 이유: PRESUMED_SAME
   *    자체가 「교차판매처 판정기가 같다고 확정하지 않았다」는 뜻이고, CPO 가
   *    Precision 우선으로 `PRESUMED_SAME ≠ EXACT` 를 확정했다. 그리고 「브랜드를
   *    확인하지 못했다」는 EXACT 를 «지킬» 근거가 되기에는 더 약한 사실이다.
   *
   * 🔴 CONFLICT 로 가지는 않는다 — 여전히 「다른 상품이다」가 아니다.
   */
  it("BRAND_UNCONFIRMED — SIMILAR 에서는 승격이 그대로, PRESUMED_SAME 에서는 막힌다", () => {
    // 🔴 좁아진 칸: PRESUMED_SAME 은 보류 사유가 「확인 못 함」뿐이어도 EXACT 가 아니다.
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", b("BRAND_UNCONFIRMED"))).toBe("TEXT_CONFIRMED");
    // 🟢 포레포레 골든케이스는 그대로 산다 — 모르는 것으로 식별자를 깎지 않는다.
    expect(deriveMatchTruth("low", "partial", "SIMILAR", b("BRAND_UNCONFIRMED"))).toBe("STRONG_IDENTIFIER");
    // 그리고 UNKNOWN 에서도 그대로다(CPO 범위 밖).
    expect(deriveMatchTruth("very_high", "exact", "UNKNOWN", b("BRAND_UNCONFIRMED"))).toBe("EXACT_IDENTIFIER");
  });

  it("hasObservedDifference 가 그 구분을 그대로 말한다", () => {
    expect(hasObservedDifference(b("BRAND_UNCONFIRMED"))).toBe(false);
    expect(hasObservedDifference(b("SAME_SELLER_DISTINCT_LISTING"))).toBe(true);
    /* 섞여 있으면 «차이가 있다» 가 이긴다. */
    expect(hasObservedDifference(b("BRAND_UNCONFIRMED", "GARMENT_FORM"))).toBe(true);
    expect(hasObservedDifference([])).toBe(false);
    expect(hasObservedDifference(undefined)).toBe(false);
  });

  it("🔴 blocker 를 새로 만들고 분류표에 넣지 않으면 «조용히» 통과한다 — 개수로 센다", () => {
    /* 지금 blocker 는 9개이고 그중 8개가 「관측된 차이」다(BRAND_UNCONFIRMED 만
       아니다). 이 숫자가 어긋나면 새 blocker 가 분류되지 않았다는 뜻이다. */
    const all: CrossSellerBlocker[] = [
      "MATERIAL",
      "FIT",
      "SIZE_SYSTEM",
      "BRAND_UNCONFIRMED",
      "NO_TITLE_OVERLAP",
      "GARMENT_FORM",
      "BRAND_MISMATCH",
      "AUDIENCE_LINE",
      "SAME_SELLER_DISTINCT_LISTING",
    ];
    expect(all).toHaveLength(9);
    expect(OBSERVED_DIFFERENCE_BLOCKER_LIST).toHaveLength(all.length - 1);
    const unclassified = all.filter(
      (x) => x !== "BRAND_UNCONFIRMED" && !OBSERVED_DIFFERENCE_BLOCKER_LIST.includes(x),
    );
    expect(unclassified, `분류표에서 빠진 blocker: ${unclassified.join(", ")}`).toEqual([]);
  });
});

describe("③ 🔴 기존 정책이 그대로다", () => {
  /** 🔴 MI P0 IDENTITY PRECISION FIX(CPO 결정 1, 2026-10-07) — 이제 가드가 둘이다.
   *  ① blockers 가 「관측된 차이」를 담고 있으면 막는다(MI-3, 호출부가 넘길 때만).
   *  ② verdict 가 PRESUMED_SAME 이면 막는다(결정 1, blockers 와 «무관하게»).
   *
   *  ②가 필요한 이유는 실측이다: 운영 호출부 둘 중 `domestic-price-sources/search`
   *  route 는 blockers 를 **넘기지 않는다**(인자 3개). 그 경로에서 ①은 영구히
   *  무력하고, 그래서 품번 하나로 EXACT 가 계속 나왔다. ②는 blockers 에 의존하지
   *  않으므로 두 경로 모두에서 선다. */
  it("보류가 «없어도» PRESUMED_SAME 은 막히고, 그 밖의 식별자 승격은 예전과 같다", () => {
    // 🔴 결정 1 — blockers 가 비어 있어도 verdict 만으로 막는다.
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", [])).toBe("TEXT_CONFIRMED");
    // 🟢 나머지는 한 글자도 바뀌지 않았다 — 과잉 차단이 아니라는 대조군.
    expect(deriveMatchTruth("high", "exact", undefined, undefined)).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("low", "exact")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "partial")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("very_high", "exact", "SAME", [])).toBe("EXACT_IDENTIFIER");
  });

  it("🔴 인자를 «생략하면» 한 글자도 달라지지 않는다 — 옛 호출부 보호", () => {
    for (const level of ["low", "medium", "high", "very_high"] as const) {
      for (const code of ["exact", "partial", "unavailable", "conflict"] as const) {
        for (const cross of [undefined, "SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"] as const) {
          expect(deriveMatchTruth(level, code, cross)).toBe(deriveMatchTruth(level, code, cross, undefined));
        }
      }
    }
  });

  it("CONFLICT 는 여전히 «맨 먼저» 이긴다 — 품번이 있어도", () => {
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", [])).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "conflict", "SAME", [])).toBe("CONFLICT");
    /* 보류가 있든 없든 마찬가지다. */
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT", b("SAME_SELLER_DISTINCT_LISTING"))).toBe("CONFLICT");
  });

  it("교차판매처 SAME 의 승격은 그대로다 — Smallable 430701 ↔ Bobo B226AC114 경로", () => {
    expect(deriveMatchTruth("low", "unavailable", "SAME")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "unavailable", "PRESUMED_SAME")).toBe("TEXT_CONFIRMED");
  });

  it("SIMILAR 로는 여전히 «올리지 않는다»(P0-A.29-F R1)", () => {
    expect(deriveMatchTruth("low", "unavailable", "SIMILAR")).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("🔴 식별자가 «없는» 후보는 보류가 있어도 예전 그대로다 — 이번 변경의 사정권 밖", () => {
    for (const cross of ["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN"] as const) {
      expect(deriveMatchTruth("low", "unavailable", cross, b("SAME_SELLER_DISTINCT_LISTING"))).toBe(
        deriveMatchTruth("low", "unavailable", cross),
      );
    }
  });
});

describe("④ 🔴 가격 pool 까지 — EXACT tier 에 닿는 등급만 센다", () => {
  /** `priceTierFromLink`(apps/admin) 이 EXACT 로 보는 두 등급. 여기서는 그 정의를
   *  다시 만들지 않고 «닿는지» 만 본다 — 실제 tier 계약은 admin 쪽 테스트가 덮는다. */
  const reachesSameProductPrice = (truth: string) =>
    truth === "EXACT_IDENTIFIER" || truth === "STRONG_IDENTIFIER";

  it("품번 재사용 쌍은 어느 텍스트 등급에서도 동일상품 가격에 닿지 않는다", () => {
    for (const level of ["low", "medium", "high", "very_high"] as const) {
      for (const code of ["exact", "partial"] as const) {
        const truth = deriveMatchTruth(level, code, "PRESUMED_SAME", b("SAME_SELLER_DISTINCT_LISTING"));
        expect(reachesSameProductPrice(truth), `${level}/${code} 가 뚫렸다`).toBe(false);
      }
    }
  });

  it("정상 식별자 쌍은 그대로 닿는다 — 막을 것만 막았다", () => {
    expect(reachesSameProductPrice(deriveMatchTruth("very_high", "exact", "SAME", []))).toBe(true);
    expect(reachesSameProductPrice(deriveMatchTruth("low", "partial", "UNKNOWN", []))).toBe(true);
  });
});
