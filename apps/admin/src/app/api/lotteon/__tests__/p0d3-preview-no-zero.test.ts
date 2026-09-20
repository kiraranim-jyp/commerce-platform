import { describe, expect, it } from "vitest";
import { buildLotteOnPayload, BLANK_LOTTEON_CHANNEL_CONFIG, validateLotteOnPayload } from "@commerce/listing";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-D.3 §6(CEO 지시, 2026-09-20) — **preview 에 「등록가 ₩0」을 만들지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 packages/listing 이 아니라 여기 있는 이유: apps/admin/vitest.config.ts
 *    의 include 에 packages/listing 이 «없다». 그 아래 테스트 25개는 한 번도
 *    실행된 적이 없다(shared·category 가 같은 처지였다가 고쳐진 선례가 그 파일
 *    주석에 남아 있다). 러너를 넓히는 것은 이번 스프린트 범위가 아니라, 새 회귀를
 *    «실제로 도는» 자리에 둔다.
 *
 * 여기 있던 코드는 `const basePriceKrw = price.priceKrw ?? 0;` 였다.
 * 가격이 UNRESOLVED 면 payload 의 `slPrc` 가 **0** 이 됐다.
 *
 * 🔴 0 은 「모른다」가 아니라 **「0원에 판다」** 는 다른 사실이다.
 *    실제 등록은 validate 가 먼저 돌아 막고 있지만(register/route.ts:149),
 *    **막는 것과 지어내지 않는 것은 별개다.** preview 는 「보내면 이렇게 나간다」를
 *    보여주는 화면이고, 거기에 ₩0 이 뜨면 그 화면이 거짓말을 한다.
 */

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

function product(over: Partial<{ amount: number; currency: string; validity: string }> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/x",
    title: field("테스트 상품"),
    brand: field("Test"),
    price: field({ amount: over.amount ?? 0, currency: over.currency ?? "" }),
    priceValidity: (over.validity ?? "VALID") as never,
    /* 🔴 아래는 packages/listing/src/lotteon/__tests__/build-payload.test.ts 의
       makeProduct 와 «같은» 필드 목록이다. 하나라도 빠지면 payload 조립이
       터진다(실제로 두 번 터뜨렸다 — keywords, importer). */
    sku: field(""),
    description: field(""),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field("테스트제조사"),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테스트 상품"),
    descriptionKo: field(""),
    keywords: field([] as string[]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(10),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
  } as unknown as CanonicalProduct;
}

const input = (p: CanonicalProduct) => ({
  product: p,
  channel: BLANK_LOTTEON_CHANNEL_CONFIG,
  detailHtml: "<p>상세</p>",
  liveRates: { EUR: 1480 },
});

describe("① 가격 미확정이면 slPrc 가 null 이다 — 0 이 아니다", () => {
  const payload = buildLotteOnPayload(input(product({ amount: 0, currency: "" })));
  const items = payload.spdLst[0]!.itmLst;

  it("🔴 ₩0 을 만들지 않는다", () => {
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.slPrc).toBeNull();
      expect(item.slPrc).not.toBe(0);
    }
  });

  it("payload 어디에도 slPrc 0 이 없다 — 직렬화해서 확인한다", () => {
    expect(JSON.stringify(payload)).not.toContain('"slPrc":0');
  });
});

describe("② 그래도 등록은 여전히 막힌다 — 이번 변경이 문을 열지 않았다", () => {
  it("🔴 validate 가 PRICE_UNRESOLVED 로 BLOCKED 한다", () => {
    const result = validateLotteOnPayload(input(product({ amount: 0, currency: "" })));
    expect(result.ok).toBe(false);
    const priceField = result.fields.find((f) => f.field === "slPrc");
    expect(priceField?.status).toBe("BLOCKED");
    expect(priceField?.code).toBe("PRICE_UNRESOLVED");
  });
});

describe("③ 🔴 무회귀 — 가격이 있는 상품의 payload 는 그대로다", () => {
  it("€75 → slPrc 가 숫자로 들어간다", () => {
    const payload = buildLotteOnPayload(input(product({ amount: 75, currency: "EUR" })));
    for (const item of payload.spdLst[0]!.itmLst) {
      expect(typeof item.slPrc).toBe("number");
      expect(item.slPrc!).toBeGreaterThan(0);
    }
  });
});
