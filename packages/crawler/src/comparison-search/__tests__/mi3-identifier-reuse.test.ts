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
  it("BRAND_UNCONFIRMED 하나만 있으면 식별자 승격이 «그대로» 다", () => {
    /* 🔴 모르는 것을 반증으로 쓰면, 정보가 부족한 판매처의 진짜 동일상품이
       식별자가 있는데도 사라진다(포레포레 골든케이스가 그 모양이다). */
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", b("BRAND_UNCONFIRMED"))).toBe(
      "EXACT_IDENTIFIER",
    );
    expect(deriveMatchTruth("low", "partial", "SIMILAR", b("BRAND_UNCONFIRMED"))).toBe("STRONG_IDENTIFIER");
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
  it("보류가 «없으면» 식별자 승격은 예전과 같다", () => {
    expect(deriveMatchTruth("very_high", "exact", "PRESUMED_SAME", [])).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("high", "exact", undefined, undefined)).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("low", "exact")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "partial")).toBe("STRONG_IDENTIFIER");
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
