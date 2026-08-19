import { resolveRegistrationReadinessState, buildPriorityItems } from "../src/app/pipeline/commerce/RegistrationStatusBanner";
import type { ReadinessSummary, ReadinessItem } from "../src/app/pipeline/commerce/readiness";

function summary(items: ReadinessItem[]): ReadinessSummary {
  const required = items.filter((i) => i.required);
  return {
    items,
    required,
    recommended: items.filter((i) => !i.required),
    allRequiredPassed: required.every((i) => i.passed),
    percent: required.length ? Math.round((required.filter((i) => i.passed).length / required.length) * 100) : 100,
  };
}

const caseA = summary([{ label: "카테고리", passed: true, required: true, group: "PRODUCT_INFO" }]);
console.log("A) priceValid=false ->", resolveRegistrationReadinessState(caseA, false));
console.log("   priority:", buildPriorityItems(caseA, false, "section-price").map((i) => i.label));

const caseB = summary([
  { label: "카테고리", passed: false, required: true, sectionId: "section-category", group: "PRODUCT_INFO" },
  {
    label: "인증서 번호(KC)",
    passed: false,
    required: true,
    sectionId: "section-kc",
    group: "LEGAL",
    hint: "판매자 확인 필요",
  },
  { label: "소재", passed: false, required: true, sectionId: "section-basic", group: "PRODUCT_INFO" },
  { label: "출고지 주소", passed: false, required: true, externalHref: "/settings", group: "BUSINESS_SETTINGS" },
]);
console.log("B) SELLER_REVIEW_REQUIRED ->", resolveRegistrationReadinessState(caseB, true, "SELLER_REVIEW_REQUIRED"));
console.log(
  "   priority:",
  buildPriorityItems(caseB, true, "section-price").map((i) => i.label),
);

const caseC = summary([{ label: "카테고리", passed: true, required: true, group: "PRODUCT_INFO" }]);
console.log("C) all passed ->", resolveRegistrationReadinessState(caseC, true));

console.log("D) kcStatus=BLOCKED ->", resolveRegistrationReadinessState(caseB, true, "BLOCKED"));
