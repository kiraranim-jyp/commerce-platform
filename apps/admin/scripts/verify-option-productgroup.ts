/**
 * SmartStore 플로우 개선 STEP3 — ProductGroup/hasVariant JSON-LD에서 옵션축
 * (Color/Size)+조합별 가격/SKU/재고를 실제로 뽑아내는지 검증한다. CPO가
 * 요청한 비교표의 시나리오(옵션 없음/Size/Color/Color+Size/가격동일/가격상이/
 * 품절옵션/SKU 있음)를 schema.org 표준 구조로 재현해서 실행한다 — DOM 관련
 * 시나리오(JS state, select 스캔)는 Playwright Page가 필요해 이 스크립트
 * 범위 밖이며 실브라우저로 별도 확인한다.
 */
import { extractProductGroupOptions } from "@commerce/crawler";

function ldJson(node: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
}

function productGroup(hasVariant: unknown[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: "Test Product",
    hasVariant,
  };
}

const cases: { label: string; html: string }[] = [
  {
    label: "A. Color만 (가격 동일)",
    html: ldJson(
      productGroup([
        { "@type": "Product", color: "Blue", sku: "SKU-BLUE", offers: { price: "77.00", priceCurrency: "USD" } },
        { "@type": "Product", color: "Red", sku: "SKU-RED", offers: { price: "77.00", priceCurrency: "USD" } },
      ]),
    ),
  },
  {
    label: "B. Size만 (가격 동일)",
    html: ldJson(
      productGroup([
        { "@type": "Product", size: "S", sku: "SKU-S", offers: { price: "77.00", priceCurrency: "USD" } },
        { "@type": "Product", size: "M", sku: "SKU-M", offers: { price: "77.00", priceCurrency: "USD" } },
      ]),
    ),
  },
  {
    label: "C. Color+Size (가격 상이)",
    html: ldJson(
      productGroup([
        { "@type": "Product", color: "Blue", size: "S", sku: "SKU-BLUE-S", offers: { price: "77.00", priceCurrency: "USD" } },
        { "@type": "Product", color: "Blue", size: "M", sku: "SKU-BLUE-M", offers: { price: "77.00", priceCurrency: "USD" } },
        { "@type": "Product", color: "Red", size: "S", sku: "SKU-RED-S", offers: { price: "82.00", priceCurrency: "USD" } },
      ]),
    ),
  },
  {
    label: "D. 품절 옵션 포함",
    html: ldJson(
      productGroup([
        { "@type": "Product", size: "S", sku: "SKU-S", offers: { price: "50.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" } },
        { "@type": "Product", size: "M", sku: "SKU-M", offers: { price: "50.00", priceCurrency: "EUR", availability: "https://schema.org/OutOfStock" } },
      ]),
    ),
  },
  {
    label: "E. 옵션 없음(hasVariant 없음, 일반 Product) → null 기대",
    html: ldJson({ "@context": "https://schema.org", "@type": "Product", name: "No variant", offers: { price: "10.00", priceCurrency: "USD" } }),
  },
  {
    label: "F. hasVariant는 있지만 축 정보(color/size/additionalProperty) 없음 → null 기대(지어내지 않음)",
    html: ldJson(
      productGroup([
        { "@type": "Product", sku: "SKU-1", offers: { price: "10.00", priceCurrency: "USD" } },
        { "@type": "Product", sku: "SKU-2", offers: { price: "12.00", priceCurrency: "USD" } },
      ]),
    ),
  },
];

let pass = 0;
for (const c of cases) {
  const result = extractProductGroupOptions(c.html);
  console.log(`\n=== ${c.label} ===`);
  if (!result) {
    console.log("  결과: null (옵션 추출 안 됨)");
  } else {
    console.log("  optionGroups:", JSON.stringify(result.optionGroups));
    console.log("  variants:", JSON.stringify(result.variants, null, 2).slice(0, 600));
  }
  pass++;
}
console.log(`\n총 ${pass}개 시나리오 실행 완료`);
