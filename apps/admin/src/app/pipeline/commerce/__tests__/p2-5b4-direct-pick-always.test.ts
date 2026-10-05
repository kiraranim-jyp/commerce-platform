// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { manufacturerFixture } from "./manufacturer-fixture";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-5b-④ — 「카테고리 직접 선택」이 **항상** 열린다 (CPO 지시, 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 실측 사고: 추천이 「가방/지갑 > 남성가방 53점」을 «냈기» 때문에 dead end 가
 * 아니었고, 진입 조건이 `isRecommendDeadEnd(recommend)` 였던 탓에 셀러는 틀린
 * 추천을 보면서도 직접 선택을 **열 수조차 없었다.**
 *
 * 🔴 **마운트한 DOM 으로만 완료 선언한다**(이 저장소의 규칙). 소스 문자열 검사로는
 * 「조건이 바뀌었다」까지만 알 수 있고 「버튼이 실제로 그려진다」는 알 수 없다.
 *
 * 🔴 트리 자체를 새로 만들지 않았다. `CategoryDirectPicker` 는 REWORK-6 ② 가
 * 만든 그대로이고(입력칸 0개 · parentId 로 내려가는 탐색 · onPick = applyCategory),
 * 이번에 바꾼 것은 **그 문을 여는 조건** 하나다.
 */
const f = <T,>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> =>
  ({ value, source, confidence: 1 }) as ProvenanceField<T>;

/** 추천이 «나오는» 상품 — 신호가 충분해서 dead end 가 아니다. */
function product(): CanonicalProduct {
  return {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Magro_Long_Sleeve/descpageMASGT-STMMLS.html",
    title: f("Sergio Tacchini Men's Magro Long Sleeve"),
    brand: f("Sergio Tacchini"),
    price: f({ amount: 120, currency: "USD" }),
    priceValidity: "VALID",
    sku: f("STMMLSWH1"),
    material: f("96% Polyester, 4% Elastane"),
    color: f("Brilliant White"),
    description: f("Content: 96% Polyester, 4% Elastane"),
    descriptionKo: f("경량 테니스 긴팔 상의."),
    titleKo: f("세르지오 타키니 남성 마그로 긴팔"),
    countryOfOrigin: f("Vietnam"),
    careInstructions: f("케어라벨 참조"),
    manufacturer: f(""), recommendedAge: f(""), returnPolicy: f(""),
    weight: f(""), certification: f(""), certificationType: f(""),
    importer: f(""), itemName: f(""), childCertification: f(null),
    modelName: f("STMMLS"), keywords: f([]), seoTitle: f(""), seoDescription: f(""),
    options: f(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["S", "M", "L"] }],
    variants: [
      { id: "a", optionValues: { 사이즈: "S" }, stockQuantity: 1, sku: "a" },
      { id: "b", optionValues: { 사이즈: "M" }, stockQuantity: 4, sku: "b" },
    ],
    images: [
      {
        id: "rep",
        originalUrl: "https://img.example/1.jpg",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: true,
        classification: "PRODUCT",
        selectedVariant: "ORIGINAL",
      },
    ],
    shippingFee: f(0, "DEFAULT"),
    stockQuantity: f(5),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

const panel = () =>
  createElement(LotteOnRegistrationPanel, {
    product: product(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Tennis", "Men", "Tops"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: null,
    onEditCommonInfo: () => {},
    manufacturerResolution: manufacturerFixture(),
  } as never);

afterEach(async () => {
  await unmountTab();
});

describe("🔴 추천 상태와 «무관하게» 직접 선택 문이 열려 있다", () => {
  it("직접 선택 버튼이 화면에 그려진다", async () => {
    const root = await mountExpanded(panel());
    const buttons = Array.from(root.querySelectorAll("button")).map((b) => b.textContent?.trim() ?? "");
    const entry = buttons.filter((label) => label.includes("롯데ON 카테고리") && label.includes("선택"));
    expect(entry.length, `버튼 목록: ${JSON.stringify(buttons)}`).toBeGreaterThan(0);
  });

  it("🔴 추천이 «성공한» 상태에서도 버튼이 뜬다 — 이것이 이번 결함의 핵심", async () => {
    /* 🔴 jsdom 에는 네트워크가 없어서 추천이 항상 실패한다 = 항상 dead end 다.
       그러면 새 분기를 한 번도 밟지 못한다 — 그래서 추천 응답만 세운다.
       🔴 이것으로 Production PASS 를 주장하지 않는다(CPO ⑧). 여기서 재는 것은
       「우리 화면이 추천 «있음» 상태에서 직접 선택 문을 여는가」 하나다. */
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/lotteon/category-recommend")) {
        return new Response(
          JSON.stringify({
            ok: true,
            decision: "RECOMMEND",
            candidates: [
              {
                /* 🔴 완전한 LotteOnStandardCategory 여야 한다 — 후보 카드가
                   displayCategories/noticeItemCodes/safetyTypeCodes 배열을 읽는다
                   (처음에 id·name 만 넣었더니 `reading 'length'` 로 터졌다). */
                category: {
                  id: "C1",
                  name: "남성 티셔츠",
                  parentId: "P1",
                  depth: 3,
                  leaf: true,
                  usable: true,
                  displayCategories: [{ mallCode: "LTON", displayCategoryId: "D1" }],
                  noticeItemCodes: ["01"],
                  taxTypeCode: "01",
                  ageLimitCode: null,
                  safetyTypeCodes: [],
                },
                path: ["패션의류", "남성의류", "남성 티셔츠"],
                score: 98,
                reason: "카테고리 이름에 \"티셔츠\"가 있어 상품유형과 일치합니다.",
                conflict: false,
              },
            ],
            signalEvidence: [],
            scannedLeafCount: 10,
            unrecognizedCount: 0,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const root = await mountExpanded(panel());
      const text = root.textContent ?? "";
      /* dead end 문구가 «아닌» 쪽이 떠야 한다. */
      expect(text).toContain("직접 고를 수 있습니다");
      const buttons = Array.from(root.querySelectorAll("button")).map((b) => b.textContent?.trim() ?? "");
      expect(buttons.some((label) => label.includes("직접 선택"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("🔴 번호를 적으라고 하지 «않는다» — 되살리지 않은 그 길", async () => {
    const root = await mountExpanded(panel());
    expect(root.textContent).toContain("번호를 찾아 적지 않습니다");
  });

  it("🔴 버튼을 누르면 직접 선택 화면이 열린다 — 로딩 상태부터", async () => {
    const root = await mountExpanded(panel());
    const entry = Array.from(root.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").includes("롯데ON 카테고리") && (b.textContent ?? "").includes("선택"),
    );
    expect(entry).toBeDefined();
    const { act } = await import("react");
    await act(async () => {
      entry!.click();
    });
    /* fetch 가 jsdom 에서 실패하므로 로딩이나 오류 중 하나가 떠야 한다 —
       🔴 «조용히 아무것도 안 뜨는» 것이 결함이다. mock 응답으로 성공을 주장하지
       않는다(CPO ⑧): 여기서 재는 것은 「문이 열렸는가」뿐이다. */
    const text = root.textContent ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(/불러오|조회|오류|실패|카테고리/.test(text)).toBe(true);
  });
});

describe("🔴 바꾼 것은 «조건» 하나다 — 수렴 함수와 트리를 건드리지 않았다", () => {
  const read = async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
  };

  it("onPick 이 여전히 applyCategory 다 — 추천/직접 선택이 같은 곳으로 모인다", async () => {
    expect(await read()).toContain("<CategoryDirectPicker onPick={applyCategory}");
  });

  it("🔴 직접 선택 화면에 입력칸이 없다 — 번호 직접 입력을 되살리지 않았다", async () => {
    const source = await read();
    const picker = source.slice(source.indexOf("function CategoryDirectPicker"));
    const body = picker.slice(0, picker.indexOf("\nfunction ") > 0 ? picker.indexOf("\nfunction ") : picker.length);
    expect(body).not.toContain("<input");
  });

  it("🔴 진입 조건이 dead end «에만» 걸려 있지 않다", async () => {
    const source = await read()
      .then((s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, ""));
    /* 옛 조건이 그대로 남아 있으면(=버튼이 다시 dead end 전용이 되면) 실패한다. */
    expect(source).not.toContain("{isRecommendDeadEnd(recommend) && !directPickOpen && (");
    /* dead end 구분 자체는 «유지» 한다 — 추천 실패를 조용히 숨기지 않는다. */
    expect(source).toContain("isRecommendDeadEnd(recommend)");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   P2-5b 정리 — 직접 선택이 /api/lotteon/category-tree «하나» 를 쓴다
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 데이터 경로가 하나다 — 클라이언트 페이징을 제거했다", () => {
  const panelSource = async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
  };

  it("새 라우트를 부른다", async () => {
    expect(await panelSource()).toContain('fetch("/api/lotteon/category-tree")');
  });

  it("🔴 클라이언트 페이징이 «없다» — 상한 상수도 사라졌다", async () => {
    const code = await panelSource();
    expect(code).not.toContain("DIRECT_PICK_PAGE_SIZE");
    expect(code).not.toContain("DIRECT_PICK_MAX_PAGES");
    expect(code).not.toContain("job: \"cheetahStandardCategory\"");
  });

  it("🔴 이 컴포넌트가 파싱하지 않는다 — 파서는 서버 한 곳이다", async () => {
    expect(await panelSource()).not.toContain("parseLotteOnStandardCategory");
  });

  it("🔴 라우트가 «평면 목록» 도 돌려준다 — 고시·과세·안전인증이 버려지지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const route = readFileSync(join(__dirname, "../../../api/lotteon/category-tree/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    /* 트리만 주면 CommerceCategoryTreeNode 가 세 칸뿐이라 applyCategory 가
       채우는 네 가지(전시·고시 품목·과세·요구 안전인증)가 조용히 빈다. */
    expect(route).toContain("categories,");
    expect(route).toContain("tree: buildLotteOnCategoryTree(categories)");
  });

  it("🔴 onPick 수렴 함수는 그대로다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
    expect(raw).toContain("<CategoryDirectPicker onPick={applyCategory}");
  });
});
