import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { compareCrossSellerProducts } from "../comparison-search/cross-seller";
import { productFactsFromShopifyProduct } from "../comparison-search/seller-facts";

/**
 * P0-A.27(CEO 승인, 2026-09-19) — COMPOSITION 축과 CATEGORY taxon 우선.
 *
 * 🔴 이 파일의 중심은 **GOLDEN-FP-001** 이다. 이미지로도 기존 축으로도 잡히지
 *    않았던 유일한 유형이고, 잃어버리면 다시 찾기 어렵다.
 */

interface Opts { title: string; type?: string; body?: string; handle?: string; vendor?: string; domain?: string }

function product({ title, type = "T-shirts", body = "Organic Cotton 100%.", handle = "p-x", vendor = "Konges Sløjd", domain = "kongessloejd.com" }: Opts): ProductFacts {
  return productFactsFromShopifyProduct(
    { title, handle, url: `/products/${handle}`, body, vendor, type, tags: "children, clothing" },
    domain,
  );
}

const compare = (a: Opts, b: Opts) =>
  compareCrossSellerProducts(product({ ...a, domain: a.domain ?? "kongessloejd.com" }), product({ ...b, domain: b.domain ?? "junioredition.com" }));
const conflictsOf = (a: Opts, b: Opts) => compare(a, b).conflicts.map((c) => c.conflict);

/* ── GOLDEN-FP-001 ────────────────────────────────────────────────────────── */

describe("🔴 GOLDEN-FP-001 — PACEY SET ↔ PACEY DRESS", () => {
  /* 실측(P0-A.23): Vision 이 95점을 줬다 — 진짜 동일상품의 «최저값과 같은» 점수라
     어떤 임계값으로도 가를 수 없었다. 사진 속 원피스가 정말 같은 옷이기 때문이다.
     다른 것은 «구성» 이고, 그건 제목에만 있다. */
  const SET = { title: "PACEY SET - cherry dot", type: "WOVEN ROMPERS & JUMPSUITS", handle: "pacey-set-cherry-dot" };
  const DRESS = { title: "PACEY DRESS - cherry dot", type: "WOVEN DRESSES", handle: "pacey-dress-cherry-dot" };

  it("CONFLICT 로 끝난다 — 절대 SAME/PRESUMED_SAME 이 되지 않는다", () => {
    const m = compare(SET, DRESS);
    expect(m.verdict, "🔴 세트와 단품이 동일상품으로 묶였다 — 국내 비교가가 틀어진다").toBe("CONFLICT");
    expect(m.conflicts.map((c) => c.conflict)).toContain("COMPOSITION");
  });

  it("양방향으로 같다", () => {
    expect(compare(DRESS, SET).verdict).toBe("CONFLICT");
  });

  it("🔴 «woven» 하나로 CATEGORY 축이 붙지 않는다", () => {
    // WOVEN ROMPERS & JUMPSUITS ↔ WOVEN DRESSES — 원단 공법 낱말은 상품군이 아니다.
    const m = compare(SET, DRESS);
    expect(m.axes.some((a) => a.axis === "CATEGORY")).toBe(false);
  });
});

/* ── COMPOSITION ──────────────────────────────────────────────────────────── */

describe("COMPOSITION — 구성이 다르면 충돌", () => {
  const base = { type: "Socks", handle: "socks-x" };
  for (const [a, b] of [
    ["2 PACK RIB SOCKS - cherry", "RIB SOCKS - cherry"],
    ["3 PACK RIB SOCKS - cherry", "2 PACK RIB SOCKS - cherry"],
    ["GIFT BUNDLE - cherry", "RIB SOCKS - cherry"],
    ["STARTER KIT - cherry", "RIB SOCKS - cherry"],
  ] as const) {
    it(`${a} ↔ ${b} → COMPOSITION 충돌`, () => {
      expect(conflictsOf({ ...base, title: a }, { ...base, title: b })).toContain("COMPOSITION");
    });
  }

  it("같은 구성이면 충돌하지 않는다", () => {
    expect(conflictsOf({ ...base, title: "2 PACK RIB SOCKS - cherry" }, { ...base, title: "2 PACK RIB SOCKS - cherry" }))
      .not.toContain("COMPOSITION");
  });

  it("🔴 양쪽 다 표시가 없으면 «모른다» — 충돌이 아니다", () => {
    /* null 은 「단품이다」가 아니라 「이 판매처가 적지 않았다」이다. 실측 246쌍 중
       238쌍이 이 경우였다 — 여기서 충돌을 내면 대다수 진짜 동일상품이 죽는다. */
    expect(conflictsOf({ ...base, title: "RIB SOCKS - cherry" }, { ...base, title: "RIB SOCKS - cherry" }))
      .not.toContain("COMPOSITION");
  });

  it("구성 낱말이 제목 안에 우연히 들어간 경우를 구분한다", () => {
    // "SETTER"·"PACKABLE" 같은 말이 SET/PACK 으로 읽히면 안 된다(\b 경계).
    expect(conflictsOf({ ...base, title: "SETTER DOG TOY - cherry" }, { ...base, title: "PACKABLE JACKET - cherry" }))
      .not.toContain("COMPOSITION");
  });
});

/* ── CATEGORY ─────────────────────────────────────────────────────────────── */

describe("CATEGORY — taxon 이 일치할 때만 축이 붙는다", () => {
  /* 🔴 재는 자리를 정확히 잡아야 한다. 두 번 헛짚고 나서야 찾았다:
       · 색상이 다르면 COLOR 충돌로 조기 반환 → axes 가 통째로 비어 «무엇이든» 통과한다
       · 상품유형 taxon 이 «둘 다 있고 다르면» CATEGORY 충돌이라 역시 조기 반환이다
     실제 문제는 **한쪽 taxon 이 null** 일 때다. 그때 taxonOutcome 은 mismatch 가
     아니라 unknown 이고, 예전 OR 규칙이 «원문 토큰» 으로 내려가 원단 낱말 하나로
     축을 줬다. GOLDEN-FP-001 이 정확히 이 모양이었다(실측):
       extractCategoryTaxon("WOVEN ROMPERS & JUMPSUITS") → null
       extractCategoryTaxon("WOVEN DRESSES")             → "DRESS"          */
  const left = { title: "ALFE cherry", body: "Cherry. Organic Cotton 100%.", handle: "alfe-a", type: "WOVEN ROMPERS & JUMPSUITS" };

  it("🔴 한쪽 taxon 이 null 이고 원단 낱말(woven)만 공유하면 축이 «붙지 않는다»", () => {
    const m = compare(left, { ...left, handle: "alfe-b", type: "WOVEN DRESSES" });
    expect(m.conflicts, "조기 반환이 일어나 CATEGORY 규칙을 재지 못한다").toHaveLength(0);
    expect(m.axes.some((a) => a.axis === "CATEGORY"), "🔴 woven 한 낱말로 상품군이 같다고 판정됐다").toBe(false);
  });

  it("같은 상품군이면 예전처럼 축이 붙는다 (회귀)", () => {
    const same = { ...left, type: "WOVEN DRESSES" };
    const m = compare(same, { ...same, handle: "alfe-b" });
    expect(m.conflicts).toHaveLength(0);
    expect(m.axes.some((a) => a.axis === "CATEGORY")).toBe(true);
  });
});
