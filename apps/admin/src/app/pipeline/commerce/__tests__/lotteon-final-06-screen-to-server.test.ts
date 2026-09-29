// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, LotteOnChannelInfo } from "@commerce/shared";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { manufacturerFixture } from "./manufacturer-fixture";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-06 4순위(CPO 지시, 2026-09-29) — **화면이 고른 것이 서버로 가는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 화면: 「KC 에서 대상 아님을 골랐는데 등록 시작 버튼이 여전히 비활성」.
 *
 * 이 명제는 두 조각으로 갈라진다 —
 *
 *   ① 화면이 고른 값이 «서버 요청에 실리는가»       ← 이 파일
 *   ② 서버가 그 값을 받아 «차단을 푸는가»           ← api/lotteon/__tests__/
 *                                                    registration01-payload-evidence ⑤
 *
 * 지금까지 ②만 있었다. 그래서 「타입은 만들었는데 호출부가 안 넘긴다」는
 * 이 저장소가 세 번 반복한 실수를 화면 쪽에서 잡을 자리가 없었다.
 *
 * 🔴 이 파일은 **실제 fetch 요청 본문** 을 본다. 폼 함수를 직접 부르지 않는다 —
 * 그러면 「함수는 맞는데 화면이 그 함수를 안 쓴다」를 놓친다.
 */

function field<T>(value: T, source = "USER_EDITED") {
  return { value, source, confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field("Cotton"),
    color: field("Lavender"),
    recommendedAge: field(""),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    /* 🔴 Production 원문 그대로다. 「스페인」으로 깨끗하게 만들지 않는다 —
       실제로 들어오는 값은 영문이고, 그 형태에서 자동선택이 되는지가 요점이다. */
    countryOfOrigin: field("Spain"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
  } as unknown as CanonicalProduct;
}

function savedInfo(overrides: Partial<LotteOnChannelInfo["certification"]> = {}): LotteOnChannelInfo {
  return {
    category: { standardCategoryNo: "205001", displayCategoryNos: ["3001"] },
    notice: { itemCode: "23", articlesText: "" },
    certification: { safetyText: "", importProxyCode: "", ...overrides },
    delivery: {
      outboundPlaceNo: "OW-77",
      returnPlaceNo: "RT-88",
      deliveryCostPolicyNo: "DC-99",
      deliveryRegionGroupCode: "RG-01",
      courierCode: "0004",
      returnCourierCode: "0004",
      weekdayCloseTime: "1400",
    },
    codes: { originCode: "", taxTypeCode: "01", brandNo: "", externalProductNo: "" },
  };
}

/** payload-preview 로 나간 요청 본문들 — 화면이 «실제로» 보낸 것. */
let previewBodies: Record<string, unknown>[] = [];

/** 롯데ON 공통코드 OPLC_CD 응답(실제 모양: code/name). */
const ORIGIN_ITEMS = [
  { code: "KR", name: "대한민국" },
  { code: "ES", name: "스페인" },
  { code: "IT", name: "이탈리아" },
];

beforeEach(() => {
  previewBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const text = String(url);
      if (text.includes("/api/lotteon/common-codes")) {
        const group = new URL(text, "http://x").searchParams.get("group");
        return {
          ok: true,
          json: async () => ({ ok: true, items: group === "OPLC_CD" ? ORIGIN_ITEMS : [] }),
        };
      }
      if (text.includes("/api/lotteon/payload-preview")) {
        previewBodies.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
        return { ok: true, json: async () => ({ ok: true, validation: { ok: false, fields: [], readyCount: 0, missingCount: 0, blockedCount: 0 } }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    }),
  );
});

afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

async function renderTab(channelInfo: LotteOnChannelInfo): Promise<HTMLElement> {
  return mountExpanded(
    createElement(LotteOnRegistrationPanel, {
      product: { ...makeProduct(), lotteOnChannelInfo: channelInfo },
      channelInfo,
      commonPrice: { priceKrw: 128000, resolved: true },
      commonCategorySources: [],
      onEditCommonInfo: () => {},
      manufacturerResolution: manufacturerFixture(),
    } as never),
  );
}

/** 화면이 마지막으로 서버에 보낸 채널 입력. */
const lastChannel = () => (previewBodies.at(-1)?.channel ?? {}) as Record<string, unknown>;

/**
 * 셀러가 «실제로 누르는» 동작. 🔴 `act()` 로 감싸는 이유는 React 가 상태 변경과
 * 그에 딸린 effect·fetch 를 이 블록 끝에서 흘려보내기 때문이다 — 감싸지 않으면
 * 「눌렀는데 아무 일도 없다」가 제품 결함이 아니라 검사 환경 때문에 나온다.
 */
async function clickSafetyTarget(container: HTMLElement, value: "TARGET" | "EXCLUDED"): Promise<void> {
  const radio = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
    (input) => input.value === value,
  );
  expect(radio, `${value} 라디오가 화면에 없다`).toBeDefined();
  await act(async () => {
    radio!.click();
  });
}

describe("① KC 선택이 «서버 요청» 에 실린다", () => {
  it("미선택이면 safetyTarget 키가 아예 없다 — 「대상 아님」으로 보내지 않는다", async () => {
    await renderTab(savedInfo());
    expect(previewBodies.length).toBeGreaterThan(0);
    expect(lastChannel()).not.toHaveProperty("safetyTarget");
  });

  it("🔴 「인증 대상 아님」을 «누르면» 그 선언이 서버로 간다", async () => {
    const container = await renderTab(savedInfo());
    const before = previewBodies.length;

    await clickSafetyTarget(container, "EXCLUDED");

    /* 🔴 누른 뒤 «새 요청이 나가야» 한다. 안 나가면 화면만 바뀌고 서버 판정은
       옛 입력에 대한 답으로 남는다 — 그것이 곧 「골랐는데 여전히 막힘」이다. */
    expect(previewBodies.length, "선택 후 재검증 요청이 나가지 않았다").toBeGreaterThan(before);
    expect(lastChannel().safetyTarget).toBe("EXCLUDED");
  });

  it("「인증 대상」을 누르면 TARGET 이 간다", async () => {
    const container = await renderTab(savedInfo());
    await clickSafetyTarget(container, "TARGET");
    expect(lastChannel().safetyTarget).toBe("TARGET");
  });

  it("저장된 선택은 처음 요청부터 실려 나간다 — 재조회 후에도 유지된다", async () => {
    await renderTab(savedInfo({ safetyTarget: "EXCLUDED" }));
    expect(lastChannel().safetyTarget).toBe("EXCLUDED");
  });
});

describe("② 원산지 — 영문 원문이 롯데ON 코드로 «서버까지» 간다", () => {
  it("🔴 Spain → 스페인 → ES 가 요청 본문의 originCode 로 실린다", async () => {
    await renderTab(savedInfo());
    /* 목록이 도착하면 자동선택이 한 번 돌고 재검증이 나간다. */
    expect(lastChannel().originCode, "원산지 자동선택이 서버 요청까지 오지 않았다").toBe("ES");
  });

  it("공통코드 목록을 못 받으면 «지어내지» 않는다 — 빈 값으로 남고 검증기가 막는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { body?: string }) => {
        const text = String(url);
        if (text.includes("/api/lotteon/common-codes")) {
          return { ok: true, json: async () => ({ ok: false, message: "롯데ON 공통코드를 불러오지 못했습니다." }) };
        }
        if (text.includes("/api/lotteon/payload-preview")) {
          previewBodies.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
          return { ok: true, json: async () => ({ ok: true, validation: { ok: false, fields: [], readyCount: 0, missingCount: 0, blockedCount: 0 } }) };
        }
        return { ok: true, json: async () => ({ ok: true }) };
      }),
    );
    await renderTab(savedInfo());
    expect(lastChannel().originCode).toBe("");
  });

  it("셀러가 이미 고른 원산지 코드를 자동선택이 «덮지 않는다»", async () => {
    const saved = savedInfo();
    saved.codes.originCode = "IT";
    await renderTab(saved);
    expect(lastChannel().originCode).toBe("IT");
  });
});
