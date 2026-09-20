import { describe, expect, it } from "vitest";
import { brandIdentitiesCompatible, resolveBrandIdentity, resolveGarmentForms, tokenizeFactText } from "@commerce/shared";
import { compareCrossSellerProducts } from "../cross-seller";
import type { ProductFacts } from "@commerce/shared";

/**
 * P0-A.35(CEO 지시, 2026-09-20) — 매칭 정확도 통합 수정의 회귀.
 *
 * 전부 **실측에서 나온 실제 문자열**이다(2026-09-20 고정 카탈로그:
 * junioredition 1,033 · kongessloejd 3,533 · angulus 1,272 · liewood 1,617).
 */

const facts = (over: Partial<ProductFacts> & { title: string }): ProductFacts => ({
  sourceUrl: over.sourceUrl ?? `https://example.com/products/${encodeURIComponent(over.title)}`,
  urlSlug: over.urlSlug ?? over.title.toLowerCase().replace(/\s+/g, "-"),
  brand: over.brand ?? null,
  brandModelCode: over.brandModelCode ?? null,
  sellerSku: over.sellerSku ?? null,
  title: over.title,
  // 🔴 실제 파이프라인과 같은 토크나이저를 쓴다 — 여기서 손으로 만들면
  //    테스트가 현실이 아니라 내 가정을 지키게 된다.
  coreTitleTokens: over.coreTitleTokens ?? tokenizeFactText(over.title),
  categoryText: over.categoryText ?? null,
  colorText: over.colorText ?? null,
  materialText: over.materialText ?? null,
  fitText: over.fitText ?? null,
  ageRangeText: over.ageRangeText ?? null,
  sizeLabels: over.sizeLabels ?? [],
  audienceSignals: over.audienceSignals ?? [],
  imageUrls: over.imageUrls ?? [],
});

describe("② 색상 문자열을 «옷의 형태» 로 읽지 않는다", () => {
  it("🔴 'MANON SWIMSUIT - dress blue' 가 원피스가 되지 않는다", () => {
    expect([...resolveGarmentForms("MANON SWIMSUIT - dress blue")]).toEqual([]);
  });

  it("🔴 'MANON SWIM SHOES - dress blue' 도 마찬가지다 — 신발이 원피스가 되던 자리", () => {
    expect([...resolveGarmentForms("MANON SWIM SHOES - dress blue")]).toEqual([]);
  });

  it("진짜 형태는 그대로 읽는다 — 자르는 것이 목적이 아니다", () => {
    expect([...resolveGarmentForms("COCO DRESS - cherry blue coeur")]).toEqual(["DRESS"]);
    expect([...resolveGarmentForms("ROLI STRIPE DRESS - rose cream stripe")]).toEqual(["DRESS"]);
  });

  it("구분자가 없으면 자르지 않는다", () => {
    expect([...resolveGarmentForms("Coco Dress in Cherry Blue Coeur by Konges Sløjd")]).toEqual(["DRESS"]);
  });
});

describe("① 형태 축의 공백 — 실측으로 확인된 것만 채웠다", () => {
  it("TOP (Konges 33건이 0% 였다)", () => {
    expect([...resolveGarmentForms("COCO TOP - cherry blue coeur")]).toEqual(["TOP"]);
  });

  it("ROMPER (29건 중 7% 만 읽혔고, 그중 일부는 DRESS 로 «오독» 됐다)", () => {
    expect([...resolveGarmentForms("COCO ROMPER - cherry blue coeur")]).toEqual(["ROMPER"]);
  });

  it("BODYSUIT — Konges 는 'BODY' 로만 적는다(105건)", () => {
    expect([...resolveGarmentForms("MINNIE SHORT SLEEVE BODY - carmona")]).toContain("BODYSUIT");
  });

  it("🔴 tee 는 «별도 형태» 가 아니라 SHIRT 다 — 가르면 없던 충돌이 생긴다", () => {
    expect([...resolveGarmentForms("MINNIE TEE - carmona")]).toEqual(["SHIRT"]);
    expect([...resolveGarmentForms("MINNIE T-SHIRT - carmona")]).toEqual(["SHIRT"]);
  });
});

describe("④ 브랜드 표준화 계층", () => {
  it("판촉·법인 꼬리를 떼면 같은 브랜드가 된다", () => {
    const a = resolveBrandIdentity("Konges Sløjd A/S");
    const b = resolveBrandIdentity("Konges Sløjd Clothing 30% Off Sale");
    expect(a.value).toBe(b.value);
    expect(brandIdentitiesCompatible(a, b)).toBe(true);
  });

  it("🔴 떼어냈다는 사실이 사라지지 않는다 — confidence 가 내려간다", () => {
    expect(resolveBrandIdentity("Angulus").confidence).toBe("HIGH");
    expect(resolveBrandIdentity("Angulus Sale 70% Off").confidence).toBe("LOW");
  });

  it("🔴 발음기호를 접는다 — 이걸 빠뜨려 PèPè↔Pepe 가 깨졌었다(내가 만든 회귀)", () => {
    expect(resolveBrandIdentity("Pèpè Shoes").value).toBe("pepe");
    expect(brandIdentitiesCompatible(resolveBrandIdentity("Pèpè Shoes"), resolveBrandIdentity("Pepe"))).toBe(true);
  });

  it("시즌코드는 브랜드가 아니다 — bobochoses vendor='AW26' 실측", () => {
    expect(resolveBrandIdentity("AW26").confidence).toBe("NONE");
  });

  it("🔴 꼬리만 남으면 되돌린다 — 브랜드를 «지워서» 만들지 않는다", () => {
    expect(resolveBrandIdentity("Sale").value).toBe("sale");
  });

  it("다른 브랜드를 합치지 않는다", () => {
    expect(brandIdentitiesCompatible(resolveBrandIdentity("Liewood"), resolveBrandIdentity("Angulus"))).toBe(false);
  });
});

/* ── ⑤ COCO 실사례: 같은 라인 4종이 갈리는가 ── */
const KONGES = "Konges Sløjd A/S";
/* 🔴 coreTitleTokens 는 «실측값» 을 그대로 쓴다. tokenizeFactText 로 생제목을
   쪼개면 브랜드·전치사가 섞여 실제 파이프라인과 다른 토큰이 나오고, 그러면
   테스트가 현실이 아니라 내 fixture 를 검증하게 된다.
   (2026-09-20 실측: 양쪽 다 [coco, dress, cherry, coeur]) */
const cocoRef = facts({
  title: "Coco Dress in Cherry Blue Coeur by Konges Sløjd",
  sourceUrl: "https://www.junioredition.com/products/coco-dress-in-cherry-blue-coeur-by-konges-slojd",
  brand: "Konges Sløjd Clothing 30% Off Sale",
  coreTitleTokens: ["coco", "dress", "cherry", "coeur"],
  colorText: "Blue",
  sizeLabels: ["3 Years", "4 Years", "5 Years"],
  audienceSignals: ["kids"],
});
const konges = (title: string, tokens: string[]) =>
  facts({ title, sourceUrl: `https://kongessloejd.com/products/${title.toLowerCase().replace(/\s+/g, "-")}`,
    brand: KONGES, coreTitleTokens: tokens, colorText: "blue", sizeLabels: ["2Y", "3Y", "4Y"], audienceSignals: ["kids"] });

describe("⑤ COCO 라인 — 정답만 SAME 이고 나머지는 막힌다", () => {
  it("🟢 COCO DRESS 는 SAME 이다 (수정 전에는 도달 불가였다)", () => {
    const r = compareCrossSellerProducts(cocoRef, konges("COCO DRESS - cherry blue coeur", ["coco", "dress", "cherry", "coeur"]));
    expect(r.verdict).toBe("SAME");
    expect(r.blockers).toHaveLength(0);
  });

  const LINE: [string, string, string[]][] = [
    ["COCO TOP - cherry blue coeur", "TOP", ["coco", "top", "cherry", "coeur"]],
    ["COCO ROMPER - cherry blue coeur", "ROMPER", ["coco", "romper", "cherry", "coeur"]],
    ["COCO MINI SHORTS - cherry blue coeur", "PANTS", ["coco", "mini", "shorts", "cherry", "coeur"]],
  ];
  for (const [title, form, tokens] of LINE) {
    it(`🔴 ${form} 은 SAME 이 아니다 — 옷의 형태가 다르다`, () => {
      const r = compareCrossSellerProducts(cocoRef, konges(title, tokens));
      expect(r.verdict).not.toBe("SAME");
      expect(r.blockers.map((b) => b.blocker)).toContain("GARMENT_FORM");
    });
  }
});

describe("⑤ 🔴 「핵심 상품명 «일부»」만으로 SAME 에 오르지 않는다", () => {
  /** 브랜드를 고친 직후 실제로 터진 오탐이다. 단어 하나(coeur)가 겹쳤다. */
  it("CHARLENE DRESS ↔ Coco Dress 는 SAME 이 아니다", () => {
    const r = compareCrossSellerProducts(cocoRef, konges("CHARLENE DRESS - coeur navy", ["charlene", "dress", "coeur", "navy"]));
    expect(r.verdict).not.toBe("SAME");
  });

  it("그래도 후보에서 통째로 사라지지는 않는다 — 점수를 낮춘 것이 아니다", () => {
    const r = compareCrossSellerProducts(cocoRef, konges("CHARLENE DRESS - coeur navy", ["charlene", "dress", "coeur", "navy"]));
    expect(["PRESUMED_SAME", "SIMILAR"]).toContain(r.verdict);
  });
});

describe("④ 🔴 「다르다」와 「확인 못 했다」를 같이 말하지 않는다", () => {
  it("브랜드를 읽었는데 달랐으면 BRAND_MISMATCH 만 나온다", () => {
    const r = compareCrossSellerProducts(
      facts({ title: "Coco Dress", brand: "Liewood", sourceUrl: "https://a.com/products/x" }),
      facts({ title: "Coco Dress", brand: "Angulus", sourceUrl: "https://b.com/products/y" }),
    );
    const names = r.blockers.map((b) => b.blocker);
    expect(names).toContain("BRAND_MISMATCH");
    expect(names).not.toContain("BRAND_UNCONFIRMED");
  });

  it("한쪽이라도 브랜드를 못 읽었을 때만 BRAND_UNCONFIRMED 다", () => {
    const r = compareCrossSellerProducts(
      facts({ title: "Coco Dress", brand: null, sourceUrl: "https://a.com/products/x" }),
      facts({ title: "Coco Dress", brand: "Angulus", sourceUrl: "https://b.com/products/y" }),
    );
    const names = r.blockers.map((b) => b.blocker);
    expect(names).toContain("BRAND_UNCONFIRMED");
    expect(names).not.toContain("BRAND_MISMATCH");
  });
});
