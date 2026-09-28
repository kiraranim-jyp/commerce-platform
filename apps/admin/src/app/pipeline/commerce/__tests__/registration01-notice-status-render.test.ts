// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REGISTRATION-01 / 3차 — 고시 13항목 상태가 «실제로 그려지는가»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 소스 PASS 는 Render PASS 가 아니다. 이 스프린트에서 그 규칙으로 두 번
 * 틀렸다(S-24 · STEP3-FIX). 그래서 마운트한 DOM 으로 잰다.
 *
 * 그리고 이 파일이 지키는 것은 «표시» 만이 아니다 —
 *   · 화면이 서버 판정을 그대로 쓰는가 (제 나름의 판정을 만들지 않는가)
 *   · 항목«코드» 가 셀러 화면에 서지 않는가
 *   · 「현재 등록 불가」에 입력칸을 만들지 않는가
 */

function field<T>(v: T) {
  return { value: v, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Watercolor All Over Cropped Sweatshirt"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC040"),
    description: field("d"),
    material: field("17% Recycled Cotton"),
    color: field("Lavender"),
    recommendedAge: field(""),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
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
    titleKo: field("수채화 올오버 크롭 스웨트셔츠"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("Spain"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(30),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
  } as unknown as CanonicalProduct;
}

/** 🔴 서버가 실제로 내려보내는 모양 그대로다(build-context 의 resolveLotteOnNotice 결과). */
const NOTICE = {
  schemaKnown: true,
  articles: [
    { pdArtlCd: "0020", pdArtlCnts: "Lavender" },
    { pdArtlCd: "0410", pdArtlCnts: "17% Recycled Cotton" },
    { pdArtlCd: "0060", pdArtlCnts: "Spain" },
  ],
  fills: [
    { code: "0210", label: "품명 및 모델명", required: true, status: "NEEDS_INPUT", reason: "상품정보에 품명 또는 모델명이 없습니다. 상품코드(SKU)를 모델명으로 대신 쓰지 않습니다." },
    { code: "0200", label: "KC 인증정보", required: true, status: "NEEDS_INPUT", reason: "KC 인증번호가 없습니다. 인증번호는 실제 인증서의 값이라 만들 수 없습니다." },
    { code: "0780", label: "크기, 중량", required: true, status: "FILLED", value: "2-3 Years, 4-5 Years", from: "상품정보 · 치수(사이즈 옵션)" },
    { code: "0020", label: "색상", required: true, status: "FILLED", value: "Lavender", from: "상품정보 · 색상" },
    { code: "0410", label: "재질", required: true, status: "FILLED", value: "17% Recycled Cotton", from: "상품정보 · 소재" },
    { code: "0790", label: "사용연령 또는 권장사용연령", required: true, status: "NEEDS_INPUT", reason: "상품정보에 사용연령이 없습니다." },
    { code: "1830", label: "크기ㆍ체중의 한계", required: true, status: "BLOCKED", reason: "해당하지 않는 상품에 무엇을 적어야 하는지 기준을 확인하지 못했습니다." },
    { code: "0220", label: "동일모델의 출시년월", required: true, status: "BLOCKED", reason: "동일모델의 출시년월을 담을 자리가 상품정보에 없습니다." },
    { code: "0070", label: "제조자, 수입자", required: true, status: "FILLED", value: "Bobo Choses", from: "상품정보 · 제조사/수입사" },
    { code: "0060", label: "제조국", required: true, status: "FILLED", value: "Spain", from: "상품정보 · 원산지" },
    { code: "0800", label: "취급방법 및 취급시 주의사항, 안전표시 (주의, 경고 등)", required: true, status: "NEEDS_INPUT", reason: "상품정보에 취급 시 주의사항이 없습니다." },
    { code: "0080", label: "품질보증기준", required: true, status: "FILLED", value: "소비자분쟁해결기준에 따름", from: "판매자 설정 · 품질보증기준" },
    { code: "0090", label: "A/S 책임자와 전화번호", required: true, status: "BLOCKED", reason: "A/S 연락처는 있으나 「A/S 업체명」을 담을 칸이 아직 없습니다." },
  ],
};

let editCommonInfoCalls = 0;

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
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: {} }) });
    }),
  );
}

function panel(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids"], origin: "원본" }],
    sellerSettings: null,
    onEditCommonInfo: () => {
      editCommonInfoCalls += 1;
    },
    manufacturerResolution: { ...resolveManufacturer({ brandProfileManufacturer: "Bobo Choses" }), loading: false },
  } as never);
}

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

beforeEach(() => {
  editCommonInfoCalls = 0;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
});
afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

describe("① 13항목이 «전부» 그려진다", () => {
  it("항목 13줄이 DOM 에 선다", async () => {
    stub();
    const el = await mountExpanded(panel());
    const rows = el.querySelectorAll("[data-notice-status]");
    expect(rows).toHaveLength(13);
  });

  it("세 상태가 «개수대로» 갈린다 — 서버가 준 대로다", async () => {
    stub();
    const el = await mountExpanded(panel());
    const count = (status: string) => el.querySelectorAll(`[data-notice-status="${status}"]`).length;
    expect(count("FILLED")).toBe(6);
    expect(count("NEEDS_INPUT")).toBe(4);
    expect(count("BLOCKED")).toBe(3);
  });

  it("항목명과 값이 실제로 보인다", async () => {
    stub();
    const body = text(await mountExpanded(panel()));
    expect(body).toContain("품질보증기준");
    expect(body).toContain("소비자분쟁해결기준에 따름");
    expect(body).toContain("동일모델의 출시년월");
    expect(body).toContain("현재 등록 불가");
  });

  it("몇 개가 자동으로 찼는지 말해 준다", async () => {
    stub();
    expect(text(await mountExpanded(panel()))).toContain("13개 항목 중 6개");
  });
});

describe("🔴 ② 항목코드가 셀러 화면에 서지 «않는다»", () => {
  it.each(["0210", "0780", "0790", "1830", "0220", "0090", "pdArtlCd"])("%s 가 보이지 않는다", async (token) => {
    stub();
    const el = await mountExpanded(panel());
    /* 🔴 목록이 «실제로 그려진 뒤» 에 없어야 의미가 있다. 이 확인이 없으면
       아무것도 안 그려져도 통과하는 공허한 검사가 된다(음성 대조에서 확인했다). */
    expect(el.querySelectorAll("[data-notice-status]")).toHaveLength(13);
    expect(text(el)).not.toContain(token);
  });
});

describe("🔴 ③ 「현재 등록 불가」에 입력칸을 만들지 않는다", () => {
  it("BLOCKED 줄 안에 input 이나 textarea 가 없다", async () => {
    stub();
    const el = await mountExpanded(panel());
    for (const row of Array.from(el.querySelectorAll('[data-notice-status="BLOCKED"]'))) {
      expect(row.querySelector("input")).toBeNull();
      expect(row.querySelector("textarea")).toBeNull();
    }
  });

  it("상품정보에서 채울 수 있는 것이 있으면 «그쪽으로» 보낸다", async () => {
    stub();
    const el = await mountExpanded(panel());
    const link = Array.from(el.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("상품정보에서 채우기"));
    expect(link).toBeDefined();
    link?.click();
    expect(editCommonInfoCalls).toBe(1);
  });
});

describe("🔴 ④ 「모른다」와 「없다」를 섞지 않는다", () => {
  it("품목 표를 모르면 항목을 «지어내지 않고» 그렇게 말한다", async () => {
    stub({ schemaKnown: false, fills: [], articles: [] });
    const el = await mountExpanded(panel());
    expect(el.querySelectorAll("[data-notice-status]")).toHaveLength(0);
    const body = text(el);
    expect(body).toMatch(/고시 품목을 먼저 고르면|항목표는 아직 준비되지 않았습니다/);
  });
});
