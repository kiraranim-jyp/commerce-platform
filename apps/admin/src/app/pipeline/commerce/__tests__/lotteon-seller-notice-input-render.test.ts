// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-NOTICE-SELLER-CONFIRMATION-01 — 셀러 입력칸이 «실제로 그려지는가»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 소스 PASS 는 Render PASS 가 아니다. 이 저장소에서 그 규칙으로 여러 번 틀렸다.
 * `0220`/`1830` 을 셀러가 채울 수 있게 만들었는데, 칸이 «서지 않으면» 아무것도
 * 바뀌지 않은 것이다. 그래서 마운트한 DOM 으로 잰다.
 *
 * 그리고 이 파일이 지키는 것은 표시만이 아니다 —
 *   · 셀러에게 항목«코드»(0220 같은 것)를 보여주지 않는가 (F-8 원칙)
 *   · 화이트리스트 «밖» 인 KC(0200)에는 입력칸을 만들지 «않는가»
 */

function field<T>(v: T) {
  return { value: v, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Hug Hairy Monster T-Shirt"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B126AC096"),
    description: field("d"),
    material: field("면 100%"),
    color: field("Grey Melange"),
    recommendedAge: field(""),
    manufacturer: field("Bobo Choses"),
    careInstructions: field("30도 이하 손세탁"),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["2-3 Years", "4-5 Years"] }],
    variants: [],
    images: [
      {
        id: "i1",
        originalUrl: "https://example.com/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("보보쇼즈 키즈 티셔츠"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(30),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field("아동용 반팔 티셔츠"),
    modelName: field(""),
    weight: field("120g"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(143500),
  } as unknown as CanonicalProduct;
}

/**
 * 🔴 서버가 «지금» 내려보내는 모양이다 — `0220`·`1830` 은 더 이상 BLOCKED 가
 * 아니라 NEEDS_INPUT 이고(셀러가 채우면 풀린다), `0200` 은 여전히 셀러가 채울 수
 * 없는 항목이다(실제 인증서 값).
 */
const NOTICE = {
  schemaKnown: true,
  articles: [
    { pdArtlCd: "0020", pdArtlCnts: "Grey Melange" },
    { pdArtlCd: "0410", pdArtlCnts: "면 100%" },
  ],
  fills: [
    { code: "0210", label: "품명 및 모델명", required: true, status: "NEEDS_INPUT", reason: "상품정보에 품명 또는 모델명이 없습니다." },
    { code: "0200", label: "KC 인증정보", required: true, status: "NEEDS_INPUT", reason: "KC 인증번호가 없습니다. 인증번호는 실제 인증서의 값이라 만들 수 없습니다." },
    { code: "0020", label: "색상", required: true, status: "FILLED", value: "Grey Melange", from: "상품정보 · 색상" },
    { code: "0410", label: "재질", required: true, status: "FILLED", value: "면 100%", from: "상품정보 · 소재" },
    {
      code: "1830",
      label: "크기ㆍ체중의 한계",
      required: true,
      status: "NEEDS_INPUT",
      reason: "크기·체중에 제한이 있으면 그 내용을, 없으면 없다는 사실을 입력해 주세요.",
    },
    {
      code: "0220",
      label: "동일모델의 출시년월",
      required: true,
      status: "NEEDS_INPUT",
      reason: "동일모델의 출시년월을 입력해 주세요. 상품정보에서 찾을 수 없는 값이라 지어내지 않습니다.",
    },
  ],
};

function stub(notice: unknown = NOTICE) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/lotteon/payload-preview")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              payload: {},
              validation: { ok: false, fields: [], readyCount: 0, missingCount: 1, blockedCount: 1 },
              notice,
            }),
        });
      }
      if (url.includes("/api/lotteon/common-codes")) {
        /* 🔴 롯데ON 이 주는 모양 그대로 — 우리가 코드를 만들지 않는다. */
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              items: [
                { code: "KR", name: "대한민국" },
                { code: "ES", name: "스페인" },
                { code: "FR", name: "프랑스" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: {} }) });
    }),
  );
}

function panel(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 143500, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids"], origin: "원본" }],
    sellerSettings: null,
    onEditCommonInfo: () => {},
    manufacturerResolution: { ...resolveManufacturer({ brandProfileManufacturer: "Bobo Choses" }), loading: false },
  } as never);
}

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
});
afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

describe("🔴 셀러 입력칸이 DOM 에 선다", () => {
  it("칸 묶음이 «존재한다» — 소스가 아니라 마운트한 DOM 으로 센다", async () => {
    stub();
    const el = await mountExpanded(panel());
    expect(el.querySelector("[data-lotteon-seller-notice]")).not.toBeNull();
  });

  it("두 항목이 «항목명» 으로 보인다 — 출시년월과 크기·체중 한계", async () => {
    stub();
    const block = (await mountExpanded(panel())).querySelector("[data-lotteon-seller-notice]") as HTMLElement;
    const body = text(block);
    expect(body).toContain("동일모델의 출시년월");
    expect(body).toContain("크기ㆍ체중의 한계");
  });

  it("실제로 «입력 가능한» 칸이다 — readOnly 가 아니다", async () => {
    stub();
    const block = (await mountExpanded(panel())).querySelector("[data-lotteon-seller-notice]") as HTMLElement;
    const inputs = [...block.querySelectorAll("input")];
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const input of inputs) expect(input.readOnly).toBe(false);
  });
});

describe("🔴🔴 F-8 을 되돌리지 않았다 — 셀러는 항목코드를 보지 않는다", () => {
  it("항목«코드» 문자열이 입력칸 묶음에 «없다»", async () => {
    stub();
    const block = (await mountExpanded(panel())).querySelector("[data-lotteon-seller-notice]") as HTMLElement;
    const html = block.innerHTML;
    /* 🔴 라벨·안내·placeholder 어디에도 코드가 서지 않는다. value 로도 안 된다. */
    expect(html).not.toContain("0220");
    expect(html).not.toContain("1830");
    expect(html).not.toContain("pdArtlCd");
  });
});

describe("🔴🔴 화이트리스트 밖에는 칸을 만들지 않는다", () => {
  it("KC(0200)에는 입력칸이 «생기지 않는다» — 규제 필드를 셀러 입력으로 열지 않는다", async () => {
    stub();
    const block = (await mountExpanded(panel())).querySelector("[data-lotteon-seller-notice]") as HTMLElement;
    /* 서버는 0200 도 NEEDS_INPUT 으로 내려보낸다. 그래도 칸은 서지 않는다. */
    expect(text(block)).not.toContain("KC 인증정보");
  });

  it("칸 수가 «정확히 둘» 이다 — 늘어나면 여기서 깨진다", async () => {
    stub();
    const block = (await mountExpanded(panel())).querySelector("[data-lotteon-seller-notice]") as HTMLElement;
    expect(block.querySelectorAll("input")).toHaveLength(2);
  });
});


/* ══ LOTTEON-FINAL-02 P0 — 원산지 자동 선택이 «화면에서» 도는가 ═══════════════
   순수 함수는 8/8 로 증명했지만 패널 배선은 DOM 으로 재지 않았다고 보고했다.
   그 구멍을 여기서 닫는다 — 이 저장소 규칙은 「Render PASS ≠ 소스 PASS」다. */
describe("🔴 원산지코드가 «화면에서» 자동으로 채워진다", () => {
  it("상품 원산지(스페인)로 OPLC_CD 가 잡혀 입력칸에 선다", async () => {
    stub();
    const el = await mountExpanded(panel());
    const input = [...el.querySelectorAll("input")].find((i) => i.value === "ES");
    expect(input, "원산지코드 ES 가 채워진 입력칸이 없다").toBeDefined();
  });

  it("🔴 목록에 없는 원산지는 «채우지 않는다» — 코드를 지어내지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const url = String(input);
        if (url.includes("/api/lotteon/payload-preview")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ok: true,
                payload: {},
                validation: { ok: false, fields: [], readyCount: 0, missingCount: 1, blockedCount: 1 },
                notice: NOTICE,
              }),
          });
        }
        if (url.includes("/api/lotteon/common-codes")) {
          /* 스페인이 «없는» 목록이다. */
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ ok: true, items: [{ code: "KR", name: "대한민국" }] }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: {} }) });
      }),
    );
    const el = await mountExpanded(panel());
    const values = [...el.querySelectorAll("input")].map((i) => i.value);
    expect(values).not.toContain("KR");
  });
});
