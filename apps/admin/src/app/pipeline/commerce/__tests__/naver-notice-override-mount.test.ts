// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, ChannelNoticeOverride, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import {
  applyChannelNoticeOverride,
  DETAIL_PAGE_REFERENCE_TEXT,
  NOTICE_KEY_PACK_DATE,
  NOTICE_KEY_RELEASE_DATE,
} from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NAVER-CHANNEL-NOTICE-OVERRIDES-03 REVIEW — **화면 동작 검증** (CPO 지시 2항)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「테스트 PASS 만으로 저장 경계와 실제 UI 동작까지 모두 입증된 것은 아니다.
 * 실제 입력, 참조 선택, 입력값 삭제, 새로고침 후 복구를 마운트 테스트로 검증.」
 *
 * 형제 파일들이 재는 것과 «다른 것» 을 잰다:
 *   channel-notice-override.test.ts         판정 규칙(순수 함수)
 *   naver-notice-override-ui.test.ts        저장 왕복(JSON + backfill)
 *   이 파일                                  🔴 셀러의 «손동작» — 실제 DOM 이벤트
 *
 * 🔴 상태를 이 파일이 다시 계산하지 않는다. `CommerceWorkspace` 가 «부르는 바로 그»
 * 함수로 상위 state 를 갱신하고, 화면이 올려보낸 것을 저장한 뒤 «다시 마운트»
 * 한다 — 새로고침 복구가 그것이다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): { value: T; source: FieldSource; confidence: number } {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 유아동 상품. KIDS/WEAR 어느 쪽이든 두 칸 중 하나가 payload 에 실린다. */
function makeProduct(override?: ChannelNoticeOverride): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-shorts",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("Terry bermuda shorts for kids."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field(""),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("설명"),
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
    modelName: field("AAA1804916"),
    weight: field("120g"),
    certificationType: field(""),
    childCertification: field(null),
    ...(override ? { channelNoticeOverrides: { smartstore: override } } : {}),
  } as unknown as CanonicalProduct;
}

let container: HTMLDivElement;
let root: Root;
/** 화면이 올려보낸 것을 «그대로» 담는다 — 이 파일이 판정을 만들지 않는다. */
let saved: ChannelNoticeOverride | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  saved = undefined;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * 🔴 FINAL GATE(CPO 지시, 2026-09-30) — 여기 있던 것: `updateNoticeOverride` 의
 * **복제 규약** 이었다. CPO 가 「실제 운영 함수가 아닌 복제를 검증한다」를 남은
 * 리스크로 지목했고, 그 지적이 맞았다.
 *
 * 지금은 컴포넌트가 실제로 부르는 **바로 그 함수** 를 부른다. 복제가 사라졌으므로
 * 「복제는 맞는데 운영 코드는 틀린」 경우가 구조적으로 불가능하다.
 */
function applyToStore(key: string, next: { value?: string; referenced?: boolean }) {
  saved = applyChannelNoticeOverride(saved, key, next);
}

function Harness({ initial }: { initial?: ChannelNoticeOverride }) {
  const [override, setOverride] = useState<ChannelNoticeOverride | undefined>(initial);
  const product = makeProduct(override);
  return createElement(PlatformPreview, {
    manufacturerResolution: manufacturerFixture(),
    product,
    listing: PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore"),
    categoryCandidates: [],
    listingStatus: "DRAFT" as const,
    listingResult: null,
    onFixTextField: () => {},
    onSetFieldReference: () => {},
    onUpdateNoticeOverride: (key: string, next: { value?: string; referenced?: boolean }) => {
      applyToStore(key, next);
      setOverride(saved);
    },
    onSelectCategory: () => {},
    onOpenListingModal: () => {},
    onRetryListing: () => {},
    developerMode: false,
  } as never);
}

async function mount(initial?: ChannelNoticeOverride): Promise<void> {
  await act(async () => {
    root.render(createElement(Harness, { initial }));
  });
  /* 🔴 고시는 «접힌» 섹션이다. 셀러가 하듯 펼치고 본다 — 이 한 줄이 없어서
     첫 실행이 「칸이 화면에 없다」로 실패했고, 그 실패가 내 배치 오류(KC 섹션
     안에 넣은 것)를 잡았다. 접힘을 우회해 컴포넌트만 마운트했다면 못 잡았다. */
  await act(async () => {
    expandAllSections(container);
  });
}

function rowOf(key: string): HTMLElement {
  const row = container.querySelector(`[data-notice-override="${key}"]`);
  if (!row) throw new Error(`[${key}] 칸이 화면에 없다`);
  return row as HTMLElement;
}
function stateOf(key: string): string {
  return rowOf(key).querySelector("[data-notice-state]")?.getAttribute("data-notice-state") ?? "";
}
function textOf(key: string): string {
  return (rowOf(key).textContent ?? "").replace(/\s+/g, " ").trim();
}
/**
 * 🔴 React 제어 입력에 값을 «실제로» 넣는다.
 *
 * `input.value = v` 로 직접 대입하면 React 의 값 추적기가 그 변화를 못 보고
 * `onChange` 가 돌지 않는다 — 처음에 그렇게 짰다가 「적었는데 상태가 그대로」로
 * 5건이 실패했다. 그건 «코드» 결함이 아니라 하니스 결함이었다. prototype 의 native
 * setter 로 넣어야 추적기가 갱신되고 그때 비로소 셀러의 타이핑과 같아진다.
 */
async function type(key: string, value: string): Promise<void> {
  const input = rowOf(key).querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function toggleReference(key: string): Promise<void> {
  const button = rowOf(key).querySelector("[data-notice-reference-toggle]") as HTMLButtonElement;
  await act(async () => button.click());
}

describe("① 두 칸이 화면에 서고, 기본 상태를 «말한다»", () => {
  it("제조연월·출시연월 두 칸이 마운트된 DOM 에 있다", async () => {
    await mount();
    expect(rowOf(NOTICE_KEY_PACK_DATE)).toBeTruthy();
    expect(rowOf(NOTICE_KEY_RELEASE_DATE)).toBeTruthy();
  });

  it("🔴 아무것도 안 한 상태에서 DISCLOSED_DEFAULT 이고, 그 사실을 문장으로 말한다", async () => {
    await mount();
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("DISCLOSED_DEFAULT");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain("기본값으로 전송");
    expect(rowOf(NOTICE_KEY_PACK_DATE).querySelector("[data-notice-disclosure]")).not.toBeNull();
  });

  it("🔴 현재 전송되는 값을 화면이 그대로 보여준다", async () => {
    await mount();
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain(DETAIL_PAGE_REFERENCE_TEXT);
  });

  it("🔴 KIDS 출시연월은 「확인되지 않았습니다」로 말하고 «선택 항목» 이라고 하지 않는다", async () => {
    await mount();
    const row = rowOf(NOTICE_KEY_RELEASE_DATE);
    expect(row.querySelector("[data-notice-unknown]")).not.toBeNull();
    const t = textOf(NOTICE_KEY_RELEASE_DATE);
    expect(t).toContain("확인되지 않았습니다");
    expect(t).not.toContain("선택 항목");
    expect(t).not.toContain("선택사항");
  });

  it("WEAR 제조연월에는 UNKNOWN 문구가 붙지 않는다 — 필수임이 확인됐다", async () => {
    await mount();
    expect(rowOf(NOTICE_KEY_PACK_DATE).querySelector("[data-notice-unknown]")).toBeNull();
  });

  it("🔴 셀러는 항목 코드를 보지 않는다", async () => {
    await mount();
    const t = textOf(NOTICE_KEY_PACK_DATE) + textOf(NOTICE_KEY_RELEASE_DATE);
    expect(t).not.toContain("packDateText");
    expect(t).not.toContain("releaseDateText");
  });
});

describe("② 실제 입력", () => {
  it("연월을 적으면 SELLER_VALUE 가 되고 그 값이 전송 값으로 바뀐다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("SELLER_VALUE");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain("2025-03");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain("판매자 입력");
  });

  it("🔴 적은 뒤에는 「기본값으로 전송」 안내가 사라진다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    expect(rowOf(NOTICE_KEY_PACK_DATE).querySelector("[data-notice-disclosure]")).toBeNull();
  });

  it("한 칸을 적어도 다른 칸은 기본 상태 그대로다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    expect(stateOf(NOTICE_KEY_RELEASE_DATE)).toBe("DISCLOSED_DEFAULT");
  });
});

describe("③ 참조 선택", () => {
  it("누르면 SELLER_REFERENCED 가 되고 「판매자 선택」으로 표시된다", async () => {
    await mount();
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    expect(stateOf(NOTICE_KEY_RELEASE_DATE)).toBe("SELLER_REFERENCED");
    expect(textOf(NOTICE_KEY_RELEASE_DATE)).toContain("판매자 선택");
  });

  it("🔴 payload 값은 기본값과 «같지만» 상태와 문구가 다르다", async () => {
    await mount();
    const before = textOf(NOTICE_KEY_RELEASE_DATE);
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    const after = textOf(NOTICE_KEY_RELEASE_DATE);
    expect(after).toContain(DETAIL_PAGE_REFERENCE_TEXT);
    expect(before).toContain(DETAIL_PAGE_REFERENCE_TEXT);
    expect(after).not.toBe(before);
    expect(rowOf(NOTICE_KEY_RELEASE_DATE).querySelector("[data-notice-disclosure]")).toBeNull();
  });

  it("다시 누르면 해제되고 DISCLOSED_DEFAULT 로 돌아간다", async () => {
    await mount();
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    expect(stateOf(NOTICE_KEY_RELEASE_DATE)).toBe("DISCLOSED_DEFAULT");
  });

  it("🔴 실제 값이 있는 칸은 참조를 눌러도 값이 이긴다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    await toggleReference(NOTICE_KEY_PACK_DATE);
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("SELLER_VALUE");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain("2025-03");
  });
});

describe("④ 입력값 삭제", () => {
  it("🔴 비우면 값이 사라지고 DISCLOSED_DEFAULT 로 «후퇴» 한다 — 빈 값을 보내지 않는다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    await type(NOTICE_KEY_PACK_DATE, "");
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("DISCLOSED_DEFAULT");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain(DETAIL_PAGE_REFERENCE_TEXT);
    expect(saved?.values?.[NOTICE_KEY_PACK_DATE]).toBeUndefined();
  });

  it("공백만 남겨도 같다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    await type(NOTICE_KEY_PACK_DATE, "   ");
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("DISCLOSED_DEFAULT");
  });
});

describe("⑤ 새로고침 후 복구 — 언마운트 → 저장값으로 재마운트", () => {
  it("🔴 적은 값이 복귀 화면에 남는다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    const persisted = saved;
    await act(async () => root.unmount());
    root = createRoot(container);
    /* 🔴 JSON 왕복까지 통과시킨다 — 실제 저장은 jsonb 다. */
    await mount(JSON.parse(JSON.stringify(persisted)) as ChannelNoticeOverride);
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("SELLER_VALUE");
    expect(textOf(NOTICE_KEY_PACK_DATE)).toContain("2025-03");
  });

  it("🔴 참조 «선택» 과 «기본값» 의 차이가 복귀 후에도 보존된다", async () => {
    await mount();
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    const persisted = saved;
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(JSON.parse(JSON.stringify(persisted)) as ChannelNoticeOverride);
    expect(stateOf(NOTICE_KEY_RELEASE_DATE)).toBe("SELLER_REFERENCED");
    /* 같은 override 안의 다른 칸은 승격되지 않는다. */
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("DISCLOSED_DEFAULT");
  });

  it("🔴 값 + 참조가 공존하는 상태도 복귀 후 각각 유지된다", async () => {
    await mount();
    await type(NOTICE_KEY_PACK_DATE, "2025-03");
    await toggleReference(NOTICE_KEY_RELEASE_DATE);
    const persisted = saved;
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(JSON.parse(JSON.stringify(persisted)) as ChannelNoticeOverride);
    expect(stateOf(NOTICE_KEY_PACK_DATE)).toBe("SELLER_VALUE");
    expect(stateOf(NOTICE_KEY_RELEASE_DATE)).toBe("SELLER_REFERENCED");
  });
});
