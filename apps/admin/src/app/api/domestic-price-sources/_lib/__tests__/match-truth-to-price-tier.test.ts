import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  deriveMatchTruth,
  type CrossSellerVerdict,
  type MatchTruth,
  type ModelEvidenceResult,
} from "@commerce/crawler";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
  type ShopifyProductLike,
} from "@commerce/crawler/src/comparison-search/seller-facts";
import { scoreCandidateMatch } from "@commerce/crawler/src/comparison-search/match";
import type { ProductFacts } from "@commerce/shared";
import { priceTierFromLink } from "../domestic-product-link";

/**
 * MATCHING-FIX-01 Phase B/E(CEO 지시, 2026-09-16) — **판정 하나가 가격까지 가는
 * 길을 한 파일에서 끝까지 이어 본다.**
 *
 * ══ 왜 이 파일이 생겼나 ══════════════════════════════════════════════════════
 * 삭제된 `isSameProductForPricing()` 은 이름으로 「이 후보를 동일상품 가격에
 * 쓸 것인가」를 답했지만, **프로덕션 호출부가 0개**라 실제로는 아무것도 정하지
 * 않았다. 진짜로 정하는 길은 이것이다:
 *
 *   compareCrossSellerProducts → verdict ┐
 *   compareModelCode           → 품번증거 ├→ deriveMatchTruth → match_truth(DB)
 *   scoreCandidateMatch        → 텍스트등급 ┘                        │
 *                                                priceTierFromLink ←┘
 *                                                       │
 *                          EXACT = 동일상품 가격 · COMPARISON = 참고 · EXCLUDED = 버림
 *
 * 그 길을 통째로 확인하는 테스트가 없어서, 두 체계가 30%의 입력에서 갈라져 있는
 * 것을 아무도 잡지 못했다. 이 파일이 그 자리를 메운다.
 *
 * 🔴 판정을 새로 만들지 않는다. 전부 운영 함수를 그대로 부르고, 픽스처는 손으로
 *    쓰지 않은 실측 응답이다(packages/crawler/src/__tests__/fixtures).
 */

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/crawler/src/__tests__/fixtures",
);

function smallable(file: string, productId: string): ProductFacts {
  const facts = productFactsFromSmallableHtml(readFileSync(path.join(FIXTURES, file), "utf8"), productId);
  if (!facts) throw new Error(`smallable 픽스처를 읽지 못했다: ${file}`);
  return facts;
}

function bobo(code: string): ProductFacts {
  const raw = JSON.parse(
    readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8"),
  ) as ShopifyProductLike;
  return productFactsFromShopifyProduct(raw, "bobochoses.com");
}

function junior(handle: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, `junioredition-${handle}.json`), "utf8")) as Record<
    string,
    unknown
  >;
  return productFactsFromShopifyProduct(
    {
      title: raw.title as string,
      handle: raw.handle as string,
      url: `/products/${raw.handle as string}`,
      description: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
      images: raw.images as string[],
    },
    "junioredition.com",
  );
}

/** 판정 → 저장값 → 가격 티어. 세 칸을 한 번에 돌려준다. */
function chain(
  a: ProductFacts,
  b: ProductFacts,
  level: "low" | "medium" | "high" | "very_high",
): { verdict: CrossSellerVerdict; modelCode: ModelEvidenceResult; truth: MatchTruth; tier: string } {
  const verdict = compareCrossSellerProducts(a, b).verdict;
  const modelCode = compareModelCode(a.brandModelCode, b.brandModelCode);
  const truth = deriveMatchTruth(level, modelCode, verdict);
  // 저장되는 행은 verified 도 함께 갖는다. matchTruth 가 있으면 priceTierFromLink 는
  // verified 를 «보지 않는다»(domestic-product-link.ts:52-55) — 그 사실을 양쪽
  // verified 로 한 번에 확인한다.
  const withTrue = priceTierFromLink({ matchTruth: truth, verified: true });
  const withFalse = priceTierFromLink({ matchTruth: truth, verified: false });
  expect(withTrue).toBe(withFalse);
  return { verdict, modelCode, truth, tier: withTrue };
}

/* ═════════════ ① 여섯 가지 «실제 사고 입력» 회귀 ═════════════ */

describe("MATCHING-FIX-01 ①: 판정 → match_truth → 가격 티어", () => {
  /**
   * 🔴 identifier unavailable — **이 저장소의 출발점**.
   * 판매처마다 자기 재고번호를 쓴다. Smallable 은 브랜드 품번을 아예 싣지 않아
   * compareModelCode 가 "unavailable" 이다. 그런데도 브랜드·상품군·색상·소재·핏·
   * 대상이 동시에 맞으면 동일상품이고, 동일상품 가격에 들어간다.
   */
  it("identifier unavailable — 품번을 맞춰볼 수 없어도 여러 축이 맞으면 EXACT 다", () => {
    const r = chain(smallable("smallable-430701-product.html", "430701"), bobo("B226AC114"), "low");
    expect(r.modelCode).toBe("unavailable");
    expect(r.verdict).toBe("SAME");
    expect(r.truth).toBe("STRONG_IDENTIFIER");
    expect(r.tier).toBe("EXACT");
  });

  /**
   * 🔴 SKU 충돌 — 판매처 재고번호가 서로 다른 것은 **충돌이 아니다**.
   * 실제로 텍스트 채점기는 이 쌍에 「SKU 불일치」 근거를 남긴다(아래 단언).
   * 그 문장이 남아 있다는 이유로 등급이 깎이면 안 된다 — 이것이 감사에서 나온
   * 「STRONG_IDENTIFIER+verified 19건 전부 match_reasons 에 SKU 불일치가 있다」의
   * 정체다. 사고가 아니라 정상이고, 그 사실을 여기서 못박는다.
   */
  it("SKU 충돌 — 판매처 재고번호가 달라도 판정이 깎이지 않는다", () => {
    const registered = smallable("smallable-430701-product.html", "430701");
    const candidate = bobo("B226AC114");
    expect(registered.sellerSku).toBe("AAA1804922");
    expect(registered.brandModelCode).toBeNull();

    // 텍스트 채점기는 «양쪽 다 코드가 있을 때»만 SKU 축을 발화한다(match.ts:386).
    // 국내 파서가 자기 상품코드를 실어 보내면 정확히 이 모양이 된다.
    const scored = scoreCandidateMatch(
      { title: registered.title, brand: registered.brand ?? undefined, sku: registered.sellerSku ?? undefined },
      {
        title: candidate.title,
        url: candidate.sourceUrl,
        price: null,
        imageUrl: null,
        confidence: 0,
        sku: candidate.brandModelCode ?? undefined,
      },
    );
    expect(scored.reasons).toContain("SKU 불일치");

    // 그래도 등급과 티어는 위 테스트와 «같다».
    const r = chain(registered, candidate, scored.level);
    expect(r.tier).toBe("EXACT");
  });

  /** 🔴 색상 충돌 — 나머지 축이 전부 맞아도 색이 어긋나면 가격에서 «빠진다». */
  it("색상 충돌 — 다른 색은 동일상품 가격에서 빠진다(EXCLUDED)", () => {
    const r = chain(smallable("smallable-430651-fr.html", "430651"), bobo("B226AC042"), "very_high");
    expect(r.verdict).toBe("CONFLICT");
    expect(r.truth).toBe("CONFLICT");
    expect(r.tier).toBe("EXCLUDED");
  });

  /**
   * 🔴 모델 충돌 — model-code.ts:75-82 의 접두사 규칙. B226AC042 와 B226AC043 은
   * 제목이 글자 하나까지 같아서 텍스트로는 원리상 구분되지 않는다. 앞자리를
   * 공유하다 갈라지는 품번만이 유일한 판별 근거다.
   */
  it("모델 충돌 — B226AC042 ↔ B226AC043 은 텍스트가 100%여도 EXCLUDED 다", () => {
    const left = bobo("B226AC042");
    const right = bobo("B226AC043");
    expect(left.title).toBe(right.title); // 텍스트로는 구분 불가
    expect(compareModelCode("B226AC042", "B226AC043")).toBe("conflict");
    for (const level of ["low", "medium", "high", "very_high"] as const) {
      const r = chain(left, right, level);
      expect(r.truth).toBe("CONFLICT");
      expect(r.tier).toBe("EXCLUDED");
    }
  });

  /**
   * 🔴 partial identifier — 표기법이 다른 같은 상품. PèPè 실측:
   * 해외 "01195-VERNICE-NERO" ↔ 국내 "PP24KASHE1195NER" 는 접두사를 전혀 공유하지
   * 않고 숫자 코어 "1195" 만 공유한다 → partial → 텍스트 점수가 아무리 낮아도
   * STRONG_IDENTIFIER 로 올라가 동일상품 가격에 들어간다(P-7-C 실측 회귀).
   */
  it("partial identifier — 텍스트가 low 여도 부분 일치 품번이면 EXACT 다", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
    expect(deriveMatchTruth("low", "partial")).toBe("STRONG_IDENTIFIER");
    expect(priceTierFromLink({ matchTruth: "STRONG_IDENTIFIER", verified: false })).toBe("EXACT");
    // 한쪽이 다른 쪽을 통째로 품는 경우(사이즈 접미사)도 같은 자리다.
    expect(compareModelCode("B126AI018", "B126AI01831152")).toBe("partial");
  });

  /**
   * 🔴 USER_EDITED — 셀러가 고친 값이 매칭까지 «그대로» 간다.
   *
   * buildProductIdentityDna 는 CanonicalProduct 필드의 `.value` 만 읽고 `.source`
   * 는 보지 않는다(product-identity-dna.ts:184-212). 그래서 셀러가 손으로 고친
   * 값(USER_EDITED)과 크롤러가 읽어온 값(ORIGINAL)은 매칭에서 완전히 같은 취급을
   * 받는다 — 셀러가 색을 고쳤는데 판정이 옛 색을 계속 보고 있으면 안 된다.
   *
   * 여기서는 판정기에 그 «값»이 도달했을 때 답이 달라진다는 것으로 확인한다.
   * 색만 바꾼 두 사실 묶음이 서로 다른 티어를 낸다 = 고친 값이 실제로 쓰였다.
   */
  it("USER_EDITED — 셀러가 고친 색이 판정에 그대로 반영된다", () => {
    const candidate = bobo("B226AC042"); // 라벤더
    const asCrawled = smallable("smallable-430651-fr.html", "430651"); // 네이비(원문)
    expect(chain(asCrawled, candidate, "very_high").tier).toBe("EXCLUDED");

    // 셀러가 "이 상품은 라벤더다"라고 고쳤다고 하자 — 색 칸만 바뀐다.
    const asEdited: ProductFacts = { ...asCrawled, colorText: candidate.colorText };
    const edited = chain(asEdited, candidate, "very_high");
    expect(edited.verdict).not.toBe("CONFLICT");
    // 색 충돌이 사라졌다는 것 자체가 「고친 값이 판정기까지 갔다」의 증거다.
    expect(compareCrossSellerProducts(asEdited, candidate).conflicts.map((c) => c.conflict)).not.toContain("COLOR");
  });
});

/* ═════════════ ② 삭제된 함수가 지키던 «의도» ═════════════ */

describe("MATCHING-FIX-01 ②: 삭제된 isSameProductForPricing 의 의도", () => {
  /**
   * 그 함수는 `verdict === "SAME"` 이었다. 교차판매처 축 «하나만» 놓고 보면 그
   * 규칙은 지금도 그대로 살아 있다 — SAME 만 EXACT tier 에 닿는다. 그 사실을
   * 값 전수로 고정한다(이것이 삭제된 단언을 대신하는 자리다).
   */
  it("교차판매처 판정만으로 EXACT 에 닿는 것은 SAME 하나뿐이다", () => {
    const verdicts: CrossSellerVerdict[] = ["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"];
    const reachable: CrossSellerVerdict[] = [];
    for (const verdict of verdicts) {
      for (const level of ["low", "medium", "high", "very_high"] as const) {
        const truth = deriveMatchTruth(level, "unavailable", verdict);
        if (priceTierFromLink({ matchTruth: truth, verified: false }) === "EXACT" && !reachable.includes(verdict)) {
          reachable.push(verdict);
        }
      }
    }
    expect(reachable).toEqual(["SAME"]);
  });

  /**
   * 🔴 흡수되지 «않은» 것도 사실로 적는다. 품번이 exact/partial 이면 교차판매처
   * 판정이 PRESUMED_SAME 이어도 EXACT tier 에 닿는다(match-truth.ts:77-80).
   * 삭제된 함수와 실제 경로가 갈리던 24개 조합의 정체가 이것이고,
   * **고치지 않았다** — 고치면 기존 판정이 바뀐다. 판정 «정의» 단계의 과제다.
   */
  it("🔴 미해결 — 품번이 맞으면 교차판매처 보류(PRESUMED_SAME)를 넘어 EXACT 가 된다", () => {
    const mismatches: string[] = [];
    for (const verdict of ["PRESUMED_SAME", "SIMILAR", "UNKNOWN"] as const) {
      for (const modelCode of ["exact", "partial"] as const) {
        for (const level of ["low", "medium", "high", "very_high"] as const) {
          const truth = deriveMatchTruth(level, modelCode, verdict);
          if (priceTierFromLink({ matchTruth: truth, verified: false }) === "EXACT") {
            mismatches.push(`${level}/${modelCode}/${verdict}`);
          }
        }
      }
    }
    // 3 verdict × 2 modelCode × 4 level = 24. 감사가 센 그 24개와 같은 수다.
    expect(mismatches).toHaveLength(24);
  });

  /** 반대 방향(동일상품인데 가격에서 빠지는 쪽)은 구조적으로 만들 수 없다 —
   *  compareCrossSellerProducts 는 품번이 충돌하면 verdict 자체를 CONFLICT 로
   *  끝내므로(cross-seller.ts:522-537) SAME 과 품번충돌은 함께 나올 수 없다. */
  it("동일상품인데 가격에서 빠지는 조합은 만들 수 없다", () => {
    const left = bobo("B226AC042");
    const right = bobo("B226AC043");
    const match = compareCrossSellerProducts(left, right);
    expect(compareModelCode(left.brandModelCode, right.brandModelCode)).toBe("conflict");
    expect(match.verdict).toBe("CONFLICT"); // SAME 이 될 수 없다
  });
});

/* ═════════════ ③ 같은 판매처가 둘로 갈라 놓은 진열 ═════════════ */

describe("MATCHING-FIX-01 ③: 같은 품번을 여러 상품이 나눠 쓴다", () => {
  /**
   * 🔴 이 단언은 «옳은 동작»이 아니라 «오늘의 사실»이다 — packages/crawler 의
   * identifier-safety.test.ts 「🔴 미해결」과 같은 사고를, 이번에는 가격 티어까지
   * 이어서 기록한다. junioredition.com 은 서로 다른 상품에 같은 Product code 를
   * 적고(AW26MS185 세 상품), 교차판매처 판정은 그것을 PRESUMED_SAME 으로
   * 막아내는데, 품번이 exact 라 deriveMatchTruth 가 그 보류를 넘어간다.
   */
  it("🔴 미해결 — 같은 품번을 쓰는 다른 상품이 동일상품 가격(EXACT)에 들어간다", () => {
    const pairs: [string, string][] = [
      ["bubble-sweatshirt-in-grey-melange-by-main-story", "bubble-sweatshirt-in-graystone-by-main-story"],
      ["bubble-sweatshirt-in-grey-melange-by-main-story", "bubble-sweatshirt-in-conker-stripe-by-main-story"],
      ["minnie-newborn-body-in-rosetto-by-konges-slojd", "minnie-newborn-onesie-in-rosetto-by-konges-slojd"],
      ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "giulia-flower-sandals-in-camelia-by-pepe"],
    ];
    for (const [left, right] of pairs) {
      const r = chain(junior(left), junior(right), "low");
      expect(r.modelCode).toBe("exact");
      expect(r.verdict).toBe("PRESUMED_SAME"); // 판정기는 「같다고 확정하지 않았다」
      expect(r.tier).toBe("EXACT"); // ← 그런데 가격은 들어간다. 여기가 사고다.
    }
  });
});
