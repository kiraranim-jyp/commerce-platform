import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type ProductFacts } from "@commerce/shared";
import { originFactsFromIdentityDna, summarizeIdentityEvidence } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-EVIDENCE-API-UI-1 — **응답 계약 ⒜ + 한글↔라틴 비교** (CPO 승인)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 네트워크 **0** · DB **0**.
 */

const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (p: string) => strip(readFileSync(path.join(REPO, p), "utf8"));

const mkOrigin = (title: string, description: string): ProductFacts =>
  originFactsFromIdentityDna({
    sourceUrl: "https://bobochoses.com/products/b226ac009",
    brand: { value: "Bobo Choses", confident: true },
    title,
    description: { value: description, source: "ORIGINAL" },
  } as never);

/* ════════════════════════════════════════════════════════════════════════════
 * §1 🔴🔴 한글 ↔ 라틴 거짓 CONFLICT 해소 (CPO 추가 결정 3)
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-API-UI-1 §1 — 한글·라틴 표기 비교", () => {
  const OS = mkOrigin(
    "Bobo Choses Hug Hairy Monster Long Sleeve T-Shirt B226AC009",
    "Brand : Bobo Choses Product Name : Hug Hairy Monster Long Sleeve T-Shirt",
  );
  const KR = mkOrigin(
    "보보쇼즈 허그 헤어리 몬스터 긴팔 티셔츠 B226AC009",
    "브랜드 : 보보쇼즈 상품명 : 허그 헤어리 몬스터 긴팔 티셔츠",
  );

  it("①-a 🟢🟢 BRAND — 「Bobo Choses」 ↔ 「보보쇼즈」가 **CONFLICT 가 아니다**", () => {
    const brand = summarizeIdentityEvidence(OS, KR).axes.find((a) => a.axis === "BRAND")!;
    expect(brand.originState).toBe("PRESENT");
    expect(brand.candidateState).toBe("PRESENT");
    /** 🔴 1차 요약기는 여기서 **거짓 CONFLICT** 를 냈다(정규화 문자열 겹침 0). */
    expect(brand.comparison).toBe("PRESENT");
    expect(brand.conflictBasis).toBeNull();
    /** 🟢 **원문은 그대로 보존** 된다 — 한쪽을 다른 쪽 표기로 덮지 않는다. */
    expect(brand.origin.map((v) => v.raw).join(" ")).toContain("Bobo Choses");
    expect(brand.candidate.map((v) => v.raw).join(" ")).toContain("보보쇼즈");
  });

  it("①-b 🔴 등록부가 **모르는** 브랜드는 임의로 같다고 하지 않는다", () => {
    const other = mkOrigin("Unknownbrand Tee", "Brand : Unknownbrand");
    const brand = summarizeIdentityEvidence(OS, other).axes.find((a) => a.axis === "BRAND")!;
    expect(brand.comparison).toBe("CONFLICT");
    expect(brand.conflictBasis).toContain("Unknownbrand");
  });

  it("①-c 🔴 **진짜 다른 브랜드** 는 여전히 CONFLICT 다(등록부에 둘 다 있다)", () => {
    const konges = mkOrigin("Konges Slojd Clothing Tee", "Brand : Konges Slojd Clothing");
    const brand = summarizeIdentityEvidence(OS, konges).axes.find((a) => a.axis === "BRAND")!;
    expect(brand.comparison).toBe("CONFLICT");
  });

  it("①-d 🟢 PRODUCT_NAME — 브랜드/유형 낱말을 뺀 **고유 토큰** 으로 본다", () => {
    const name = summarizeIdentityEvidence(OS, OS).axes.find((a) => a.axis === "PRODUCT_NAME")!;
    expect(name.comparison).toBe("PRESENT");
    /** 🔴 서로 다른 상품명은 드러나야 한다. */
    const other = mkOrigin("Booty Ghosts Bandana Skirt", "Product Name : Booty Ghosts Bandana Skirt");
    const diff = summarizeIdentityEvidence(OS, other).axes.find((a) => a.axis === "PRODUCT_NAME")!;
    expect(diff.comparison).toBe("CONFLICT");
  });

  it("①-e 🔴 새 사전/alias 를 **만들지 않았다** — 등록부는 하나이고 크기가 그대로다", () => {
    const summary = read("packages/crawler/src/comparison-search/identity-evidence-summary.ts");
    /** 🔴 요약기에 브랜드 표기를 **적지 않았다**(양쪽 NFKD 로 본다). */
    const nfkd = summary.normalize("NFKD");
    for (const alias of ["보보쇼즈", "ボボショーズ", "페페"]) {
      expect(nfkd).not.toContain(alias.normalize("NFKD"));
    }
    /** 🟢 조회는 **BRAND-1 owner** 로 한다. */
    expect(summary).toContain("findBrandAliasMentions");
    expect(summary).toContain("brandIdentitiesCompatible");
    expect(summary).toContain("buildCoreTitleTokens");
    /** 🔴 등록부 크기 불변 — 브랜드 **4**. */
    const rows = read("packages/crawler/src/comparison-search/brand-alias.ts").match(/\{\s*brand:\s*"/g) ?? [];
    expect(rows).toHaveLength(4);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * §2 응답 계약 ⒜ — 경계 6항
 * ════════════════════════════════════════════════════════════════════════════ */

describe("IDENTITY-EVIDENCE-API-UI-1 §2 — 응답 계약 경계", () => {
  const ROUTE = read("apps/admin/src/app/api/price-history/check/route.ts");
  const RUNNER = read("apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts");

  it("②-a 🟢 `/check` 응답 최상위에 `identityEvidence` 가 있다", () => {
    expect(ROUTE).toContain("identityEvidence: domesticShop?.identityEvidence ?? null");
  });

  it("②-b 🔴 **기존 응답 칸을 지우거나 의미를 바꾸지 않았다**", () => {
    for (const keep of ["domesticShop,", "overseasReference:", "domesticReference:"]) {
      expect(ROUTE, `🔴 기존 칸 ${keep} 가 사라졌다`).toContain(keep);
    }
  });

  it("②-c 🔴🔴 **집계 입력이 아니다** — 가격 축 sink 와 다른 배열이다", () => {
    expect(RUNNER).toContain("identityEvidenceRows.push({");
    /** 🔴 `computeMarketIntelligence` 인자에 들어가지 않는다. */
    expect(RUNNER).not.toMatch(/computeMarketIntelligence\([^)]*identityEvidence/);
    expect(read("apps/admin/src/app/api/price-history/check/route.ts")).not.toMatch(
      /computeMarketIntelligence\([^)]*identityEvidence/,
    );
  });

  it("②-d 🔴 **가격·판정 어휘를 섞지 않는다** — 그 칸에 금액/tier/verdict 가 없다", () => {
    const origin = mkOrigin("Bobo Choses Tee B226AC009", "Brand : Bobo Choses");
    const row = { candidateUrl: "https://x.test/p", domain: "x.test", ...summarizeIdentityEvidence(origin, origin) };
    const json = JSON.stringify(row);
    for (const f of ["priceKrw", "priceTier", "verdict", "soldOut", "currency", "amount", "recommend"]) {
      expect(json, `🔴 ${f} 가 섞였다`).not.toContain(f);
    }
  });

  it("②-e 🔴 **후보 연결이 명확** 하다 — 한 줄 = 한 `candidateUrl`", () => {
    const origin = mkOrigin("Bobo Choses Tee B226AC009", "Brand : Bobo Choses");
    const rows = ["https://a.test/1", "https://b.test/2"].map((u) => ({
      candidateUrl: u,
      ...summarizeIdentityEvidence(origin, origin),
    }));
    expect(new Set(rows.map((r) => r.candidateUrl)).size).toBe(2);
    /** 🔴 축 배열이 **행마다 따로** 다(참조 공유로 섞이지 않는다). */
    expect(rows[0]!.axes).not.toBe(rows[1]!.axes);
  });

  it("②-f 🔴 `ComparisonCandidate.facts` 를 **통째로 복제하지 않는다**", () => {
    const origin = mkOrigin("Bobo Choses Tee B226AC009", "Brand : Bobo Choses");
    const json = JSON.stringify(summarizeIdentityEvidence(origin, origin));
    /** 🔴 facts 고유 칸들이 그 산출에 **없다**. */
    for (const f of ["urlSlug", "sellerSku", "coreTitleTokens", "imageUrls", "sizeLabels", "audienceSignals"]) {
      expect(json, `🔴 facts 칸 ${f} 가 복제됐다`).not.toContain(f);
    }
  });

  it("②-g 🔴 DB/schema 변경이 **없다** — migration 신규 0", () => {
    const runner = read("apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts");
    expect(runner).not.toMatch(/identityEvidence[^\n]*upsert/);
    expect(runner).not.toMatch(/identityEvidence[^\n]*insert/);
  });
});
