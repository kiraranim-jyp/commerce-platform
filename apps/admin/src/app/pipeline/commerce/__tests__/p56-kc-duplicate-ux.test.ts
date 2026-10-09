// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, resolveKcStatus, validateNaverPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P1-7(CPO ⑥, 2026-10-09) — **같은 의사결정을 두 번 묻지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측: 「판매가능상품 확인 + 면제대상 여부 판단」이 중복 설정처럼 보인다.
 *
 * 실제로 KC 섹션에는 «같은 상태를 말하는 경고판이 둘» 쌓였고, 양쪽의 [직접
 * 입력] 버튼이 «같은 함수» 를 불렀다. 게다가 그 함수는
 * `goToSection("section-kc")` — 버튼 «자신이 들어 있는» 섹션으로 스크롤해서,
 * 셀러가 누르면 아무 일도 일어나지 않았다.
 *
 * ── 🔴 이 파일이 소스 검사가 «아닌» 이유 ──────────────────────────────────
 * 중복은 「문자열이 몇 번 적혔는가」가 아니라 「한 화면에 몇 개가 떠 있는가」다.
 * 기존 KC 가드 네 개(p0kc06 · p0kc07 · p0-kc-safety · n0701b)는 전부 소스
 * 문자열을 세기 때문에, 패널을 조건부로 바꾸는 이 수정을 «한 건도» 감지하지
 * 못한다 — 문자열은 그대로 남아 있기 때문이다. 그래서 여기서는 실제로 마운트해
 * 세고, 반대 방향(배너가 없을 때)도 같이 센다.
 *
 * ── 🔴 kcStatus 를 손으로 적지 않는다 ──────────────────────────────────────
 * 상태는 운영 함수 `resolveKcStatus` 가 내고, 필드 목록은 운영 함수
 * `validateNaverPayload(buildNaverProductPayload(...))` 가 낸다. 둘 중 하나라도
 * 손으로 지어내면 「화면은 맞는데 실제 상태에서는 안 뜨는」 경우를 못 잡는다.
 *
 * ── 🔴 합치지 «않은» 것도 여기서 고정한다 ─────────────────────────────────
 * CPO 작업지시서는 `○ 인증 필요 / ○ 인증 면제 / ○ 해당 없음` 3지 라디오를
 * 적었다. 만들지 않았다 — 그것은 두 축(어린이제품 인증 · KC 인증)과 따져 내부
 * 확인기록을 한 칸으로 접는 **새 KC 상태 모델**이고, CEO 확정 2번이 금지한다.
 * 접으면 셀러가 누른 「확인했다」가 채널에 「면제」로 나간다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

/** KIDS 카테고리 실상품 모양 — 🔴 인증정보는 «비어» 있다(그래서 확인이 필요하다). */
function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://www.smallable.com/en/product/short-123456",
    title: field("아동용 반바지"),
    titleKo: field("아동용 반바지"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("설명"),
    descriptionKo: field("설명"),
    material: field("코튼 100%"),
    color: field("블루"),
    recommendedAge: field("3-4Y"),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [{ url: "https://cdn.example.com/a.jpg", role: "MAIN" }],
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field("따조"),
    itemName: field("유아동 반바지"),
    modelName: field("BC-SHORT-01"),
    weight: field("120g"),
    certificationType: field(""),
    /* 🔴 비어 있어야 resolveKcStatus 가 SELLER_REVIEW_REQUIRED 를 낸다. */
    childCertification: field(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

/** delta-model-name-and-manufacturer.test.ts 가 쓰는 그 인자다 — 어린이제품 요구 카테고리. */
const PAYLOAD_ARGS = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: "1",
  refundAddressBookNo: "1",
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: true,
} as const;

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

/** 🔴 운영 함수 두 개를 그대로 탄다 — 검증 결과를 손으로 만들지 않는다. */
function validationOf(product: CanonicalProduct) {
  const base = validateNaverPayload(
    buildNaverProductPayload({ product, listing: listingOf(product), ...PAYLOAD_ARGS } as never),
    { product, ...PAYLOAD_ARGS, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false } as never,
    true,
  );
  return {
    ...base,
    kcStatus: resolveKcStatus({
      categoryVerified: true,
      categoryRequiresChildCertification: true,
      childCertification: product.childCertification,
    }),
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * @param withBanner false 면 kcStatus 를 떼어 배너가 뜨지 않는 경우를 만든다.
 *   🔴 대조군이다. 「배너가 있을 때 패널이 접힌다」만 재면, 패널을 통째로 지운
 *   변경과 구별되지 않는다(이 저장소에서 부정 단정이 대조군 없이 틀린 적이 있다).
 */
async function mount(withBanner: boolean): Promise<void> {
  const product = makeProduct();
  const validation = validationOf(product);
  await act(async () => {
    root.render(
      createElement(PlatformPreview, {
        manufacturerResolution: manufacturerFixture(),
        product,
        listing: listingOf(product),
        categoryCandidates: [],
        listingStatus: "DRAFT" as const,
        listingResult: null,
        naverValidation: withBanner ? validation : { ...validation, kcStatus: undefined },
        onFixTextField: () => {},
        onSetFieldReference: () => {},
        onUpdateChildCertification: () => {},
        onUpdateKcDeclaration: () => {},
        onSelectCategory: () => {},
        onOpenListingModal: () => {},
        onRetryListing: () => {},
        developerMode: false,
      } as never),
    );
  });
  await act(async () => {
    expandAllSections(container);
  });
}

function screenText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}
function buttonsNamed(...names: string[]): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter((b) =>
    names.some((n) => (b.textContent ?? "").includes(n)),
  ) as HTMLButtonElement[];
}

describe("① 🔴 전제 — 운영 함수가 실제로 「확인 필요」를 낸다", () => {
  it("인증정보가 비면 SELLER_REVIEW_REQUIRED 다", () => {
    expect(validationOf(makeProduct()).kcStatus).toBe("SELLER_REVIEW_REQUIRED");
  });

  it("🔴 인증 블록의 렌더 조건(productCertificationInfos 필드)도 실제로 성립한다", () => {
    /* 이 조건이 거짓이면 아래 단언들이 「없으니 통과」가 되어 전부 무의미해진다. */
    const fields = validationOf(makeProduct()).fields;
    expect(fields.some((f) => f.field.startsWith("productCertificationInfos"))).toBe(true);
  });
});

describe("② 🔴 한 화면에 경고판이 «하나» 다", () => {
  it("배너가 뜨면 블록의 중복 경고판은 그려지지 않는다", async () => {
    await mount(true);
    const text = screenText();
    expect(text, "배너가 사라졌다 — 이 테스트의 전제가 깨졌다").toContain("판매 가능 여부를 확인해주세요");
    expect(text, "같은 상태를 말하는 경고판이 둘 떠 있다").not.toContain("KC 인증 · 판매자 확인 필요");
  });

  it("🔴 대조군 — 배너가 없으면 블록의 경고판이 «유일한» 경고로 남는다", async () => {
    await mount(false);
    const text = screenText();
    expect(text, "배너도 없고 경고판도 없다 — 셀러가 아무 안내도 못 받는다").toContain(
      "KC 인증 · 판매자 확인 필요",
    );
    expect(text).toContain("① 실제 인증정보가 있는 경우");
    expect(text).toContain("② 입력하지 않는 경우");
  });
});

describe("③ 🔴 같은 일을 하는 버튼이 둘이 아니다", () => {
  it("[직접 입력] 버튼은 화면에 하나뿐이다", async () => {
    await mount(true);
    const enter = buttonsNamed("KC 정보 직접 입력하기", "인증정보 직접 입력");
    expect(enter.map((b) => b.textContent?.trim())).toEqual(["KC 정보 직접 입력하기"]);
  });

  it("배너가 없는 경우에도 하나뿐이다", async () => {
    await mount(false);
    const enter = buttonsNamed("KC 정보 직접 입력하기", "인증정보 직접 입력");
    expect(enter.map((b) => b.textContent?.trim())).toEqual(["인증정보 직접 입력"]);
  });
});

describe("④ 🔴 접었다고 «사실» 이 사라지지 않는다", () => {
  it.each([true, false])("배너 %s — 규제 면책과 참조 불가가 화면에 있다", async (withBanner) => {
    await mount(withBanner);
    const text = screenText();
    expect(text).toContain("TTAEJYO는 KC 인증의 진위나 법적 적용 여부를 판정하지 않습니다");
    expect(text).toContain("로 대체할 수 없습니다");
  });

  it.each([true, false])("배너 %s — [요청 문구 복사]가 화면에 있다", async (withBanner) => {
    await mount(withBanner);
    expect(buttonsNamed("요청 문구 복사")).toHaveLength(1);
  });

  it("🔴 [요청 문구 복사]가 두 번 그려지지 않는다 — 경고판 밖으로 옮기면서 남길 수 있었다", async () => {
    await mount(false);
    expect(buttonsNamed("요청 문구 복사")).toHaveLength(1);
  });
});

describe("⑤ 🔴 [직접 입력]이 «그 칸» 으로 간다 — 자기 섹션이 아니라", () => {
  it("인증번호 칸에 앵커 id 가 붙어 있다", async () => {
    await mount(true);
    const anchor = container.querySelector("#field-kcCertificationNumber");
    expect(anchor, "앵커가 없으면 버튼이 섹션 맨 위로만 간다").not.toBeNull();
    expect(anchor?.textContent).toContain("인증번호");
    expect(anchor?.querySelector("input, button"), "앵커 안에 입력 수단이 없다").not.toBeNull();
  });

  it("🔴 배너 호출부가 앵커를 «넘긴다» — 인자를 만들고 안 넘긴 실수가 세 번 있었다", () => {
    const src = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(src).toContain('onEnterKcInfo={() => goToSection("section-kc", KC_CERT_NUMBER_ANCHOR)}');
    expect(src, "앵커 없는 옛 호출이 남아 있다").not.toContain('onEnterKcInfo={() => goToSection("section-kc")}');
  });
});

describe("⑥ 🔴 새 KC 상태 모델을 만들지 «않았다»", () => {
  it("두 축이 여전히 따로 있다 — 한 칸으로 접지 않았다", async () => {
    await mount(true);
    const text = screenText();
    expect(text).toContain("어린이제품 인증");
    expect(text).toContain("KC 인증");
    const names = new Set(
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map((r) => r.name),
    );
    expect(names.has("kc-child"), "어린이제품 축이 사라졌다").toBe(true);
    expect(names.has("kc-main"), "KC 축이 사라졌다").toBe(true);
  });

  it("🔴 CPO 가 적은 3지 라디오를 만들지 않았다 — 접으면 확인기록이 면제 신고가 된다", async () => {
    await mount(true);
    const labels = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).map(
      (r) => (r.closest("label")?.textContent ?? "").trim(),
    );
    expect(labels).not.toContain("인증 필요");
    expect(labels).not.toContain("해당 없음 / 확인 필요");
  });

  it("라디오가 「판매가능 확인」과 다른 항목임을 화면이 «말한다»", async () => {
    await mount(true);
    expect(screenText()).toContain("스마트스토어에 신고할 값");
  });

  it("🔴 판정 규칙은 건드리지 않았다 — resolveKcStatus 식 그대로", () => {
    const compliance = readFileSync(
      join(__dirname, "../../../../../../../packages/listing/src/naver/compliance.ts"),
      "utf8",
    );
    expect(compliance).toContain('return hasFullCert ? "CERTIFIED_REFERENCE" : "SELLER_REVIEW_REQUIRED";');
  });
});

