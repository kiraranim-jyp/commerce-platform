// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, LotteOnChannelInfo } from "@commerce/shared";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import {
  EMPTY_LOTTEON_CHANNEL_FORM,
  fromLotteOnChannelInfo,
  needsSafetyTargetChoice,
  parseSafetyEntries,
  requiresSafetyCertification,
  serializeSafetyEntries,
  summarizeLotteOnManagedValues,
  toLotteOnChannelInfo,
  toLotteOnChannelPayload,
  type LotteOnChannelForm,
} from "../lotteon-channel-form";
import { manufacturerFixture } from "./manufacturer-fixture";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-05 #2(CEO 지시, 2026-09-29) — KC 인증 **3상태**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 보고: 「KC 를 무조건 입력해야 해서 등록이 어렵다」. 실제로 그랬다 —
 * 롯데ON 탭에는 「이 상품은 인증 대상이 아니다」라고 말할 칸이 아예 없었고,
 * 고시 품목 23(어린이제품)을 고르는 순간 인증번호 없이는 나갈 길이 없었다.
 *
 *   정직한 판매자는 막히고, 아무 값이나 넣은 판매자는 통과한다.
 *   출구가 없으면 시스템은 거짓말을 보상한다.
 *
 * 스마트스토어에서 어린이제품에 「12313ㄹㅇ」이 붙어 실제로 등록된 사건의
 * 뿌리가 그것이었다. 그래서 같은 축(SmartStoreKcDeclaration)을 롯데ON 어휘로
 * 놓는다 — 새 KC 상태 모델을 만드는 것이 «아니다».
 *
 * ── 🔴 이 파일이 지키는 것 ─────────────────────────────────────────────────
 *   ① 세 상태가 셋이다 — 미선택 ≠ 대상 아님
 *   ② 폼 → 저장 → 폼 왕복에서 「고른 적 없음」이 보존된다
 *   ③ 화면이 셋을 «다르게» 그린다(마운트한 DOM 으로 본다)
 *   ④ 셀러가 내부 코드(CHL_*)를 타이핑하지 않는다
 *
 * 등록을 막고 여는 «판정» 은 여기 없다. 그것은 서버 한 곳
 * (packages/listing/src/lotteon/validate-payload.ts)에 있고, 그쪽 검사는
 * build-payload.test.ts 의 「안전인증 3상태」 블록이 한다.
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
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
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
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

/** 고시 품목 23(어린이제품)이 골라진 저장값 — KC 축이 살아나는 조건이다. */
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
      courierCode: "",
      returnCourierCode: "",
      weekdayCloseTime: "1400",
    },
    codes: { originCode: "OP-ES", taxTypeCode: "01", brandNo: "", externalProductNo: "" },
  };
}

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

/** 셀러가 **읽는 글자**만 남긴다. */
function visibleText(container: HTMLElement): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

function childForm(overrides: Partial<LotteOnChannelForm["certification"]> = {}): LotteOnChannelForm {
  return {
    ...EMPTY_LOTTEON_CHANNEL_FORM,
    notice: { ...EMPTY_LOTTEON_CHANNEL_FORM.notice, itemCode: "23" },
    certification: { ...EMPTY_LOTTEON_CHANNEL_FORM.certification, ...overrides },
  };
}

afterEach(async () => {
  await unmountTab();
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("① 세 상태가 «셋» 이다 — 미선택을 「대상 아님」으로 읽지 않는다", () => {
  it("빈 폼에는 safetyTarget 키가 아예 없다 — 그것이 「미선택」의 표현이다", () => {
    expect(EMPTY_LOTTEON_CHANNEL_FORM.certification.safetyTarget).toBeUndefined();
    expect("safetyTarget" in EMPTY_LOTTEON_CHANNEL_FORM.certification).toBe(false);
  });

  it("미선택은 어린이제품에서 여전히 인증정보를 요구한다", () => {
    expect(requiresSafetyCertification(childForm())).toBe(true);
    expect(needsSafetyTargetChoice(childForm())).toBe(true);
  });

  it("「대상 아님」을 고르면 인증정보를 요구하지 않는다", () => {
    expect(requiresSafetyCertification(childForm({ safetyTarget: "EXCLUDED" }))).toBe(false);
    expect(needsSafetyTargetChoice(childForm({ safetyTarget: "EXCLUDED" }))).toBe(false);
  });

  it("「대상」을 고르면 품목코드와 무관하게 요구한다", () => {
    /* 🔴 품목 23 이 «아닌» 폼으로 잰다 — 품목코드가 요구한 것인지 신고가
       요구한 것인지 구별되지 않으면 이 검사는 아무것도 증명하지 않는다. */
    const nonChild = { ...EMPTY_LOTTEON_CHANNEL_FORM, certification: { ...EMPTY_LOTTEON_CHANNEL_FORM.certification, safetyTarget: "TARGET" as const } };
    expect(requiresSafetyCertification(nonChild)).toBe(true);
  });
});

describe("② 저장 왕복 — 「고른 적 없음」이 살아남는다", () => {
  it("고르지 않았으면 저장에 키를 «만들지 않는다»", () => {
    const saved = toLotteOnChannelInfo(childForm());
    expect("safetyTarget" in saved.certification).toBe(false);
    /* 🔴 JSON 을 한 번 통과시켜 본다 — jsonb 로 들어갔다 나오는 실제 경로다. */
    const roundTripped = JSON.parse(JSON.stringify(saved)) as LotteOnChannelInfo;
    expect(fromLotteOnChannelInfo(roundTripped).certification.safetyTarget).toBeUndefined();
  });

  it("고른 값은 그대로 왕복한다", () => {
    for (const target of ["TARGET", "EXCLUDED"] as const) {
      const saved = JSON.parse(JSON.stringify(toLotteOnChannelInfo(childForm({ safetyTarget: target }))));
      expect(fromLotteOnChannelInfo(saved).certification.safetyTarget).toBe(target);
    }
  });

  it("이 키를 모르던 «옛 스냅샷» 은 미선택으로 읽힌다 — 자동으로 대상 아님이 되지 않는다", () => {
    const legacy = savedInfo(); // safetyTarget 이 없는 모양 그대로
    expect(fromLotteOnChannelInfo(legacy).certification.safetyTarget).toBeUndefined();
    expect(requiresSafetyCertification(fromLotteOnChannelInfo(legacy))).toBe(true);
  });

  it("서버로 보내는 입력에도 신고가 실린다 — 화면이 대신 판정하지 않는다", () => {
    const sent = toLotteOnChannelPayload(childForm({ safetyTarget: "EXCLUDED" }));
    expect(sent.safetyTarget).toBe("EXCLUDED");
    expect(toLotteOnChannelPayload(childForm())).not.toHaveProperty("safetyTarget");
  });

  it("상품정보 요약이 「대상 아님」을 «0건» 으로 적지 않는다", () => {
    const rows = summarizeLotteOnManagedValues(savedInfo({ safetyTarget: "EXCLUDED" })).rows;
    expect(rows.find((row) => row.label === "안전인증")?.value).toContain("인증 대상 아님");
    /* 🔴 아직 고르지 않은 상품은 여전히 «값 없음» 이다(둘이 같아 보이면 안 된다). */
    expect(summarizeLotteOnManagedValues(savedInfo()).rows.find((row) => row.label === "안전인증")?.value).toBeNull();
  });
});

describe("③ 줄 문자열 ↔ 칸 — 왕복에서 값을 잃지 않는다", () => {
  it("`유형코드:인증번호:기관명` 을 칸 셋으로 푼다", () => {
    const { entries, unparsed } = parseSafetyEntries("CHL_CFM:CB123456789:한국기계전기전자시험연구원");
    expect(entries).toEqual([
      { typeCode: "CHL_CFM", number: "CB123456789", orgName: "한국기계전기전자시험연구원" },
    ]);
    expect(unparsed).toEqual([]);
  });

  it("🔴 형식이 깨진 줄을 «버리지 않는다» — 저장을 한 번 더 했다고 글자가 사라지면 안 된다", () => {
    const raw = "CHL_CFM:CB123456789\n알아볼 수 없는 줄";
    const { entries, unparsed } = parseSafetyEntries(raw);
    expect(unparsed).toEqual(["알아볼 수 없는 줄"]);
    expect(serializeSafetyEntries(entries, unparsed)).toContain("알아볼 수 없는 줄");
  });

  it("빈 행은 줄로 만들지 않는다 — `:` 같은 쓰레기가 저장되지 않는다", () => {
    expect(serializeSafetyEntries([{ typeCode: "", number: "", orgName: "" }])).toBe("");
  });

  it("기관명이 없으면 두 칸짜리 줄로 되돌아간다", () => {
    expect(serializeSafetyEntries([{ typeCode: "CHL_ATHN", number: "CB-1", orgName: "" }])).toBe("CHL_ATHN:CB-1");
  });
});

describe("④ 화면 — 세 상태가 «다르게» 보인다(마운트한 DOM)", () => {
  it("미선택이면 「아직 고르지 않았다」고 말하고, 인증 입력칸도 함께 서 있다", async () => {
    const container = await renderTab(savedInfo());
    const text = visibleText(container);
    expect(text).toContain("이 상품은 안전인증 대상입니까?");
    expect(text).toContain("아직 고르지 않았습니다");
    /* 🔴 고르지 않은 것을 「대상 아님」으로 처리하지 않는다는 말이 화면에 있다. */
    expect(text).toContain("고르지 않은 것을 「대상 아님」으로 처리하지 않습니다");
    expect(container.querySelector('[aria-label="인증번호"]')).not.toBeNull();
  });

  it("「대상 아님」을 고르면 인증 입력칸이 사라진다 — 요구하지 않는 것을 묻지 않는다", async () => {
    const container = await renderTab(savedInfo({ safetyTarget: "EXCLUDED" }));
    expect(container.querySelector('[aria-label="인증번호"]')).toBeNull();
    expect(container.querySelector('[aria-label="안전인증 유형"]')).toBeNull();
    const text = visibleText(container);
    expect(text).toContain("인증 대상이 아니라고 신고하셨습니다");
    /* 🔴 「따져가 확인했다」로 읽히지 않는다 — 판매자의 신고다. */
    expect(text).toContain("신고");
  });

  it("「대상」이면 인증 입력칸이 선다", async () => {
    const container = await renderTab(savedInfo({ safetyTarget: "TARGET" }));
    expect(container.querySelector('[aria-label="인증번호"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="안전인증 유형"]')).not.toBeNull();
  });

  it("🔴 「대상 아님」 + 인증정보가 같이 있으면 모순이라고 «말한다»(조용히 지우지 않는다)", async () => {
    const container = await renderTab(savedInfo({ safetyTarget: "EXCLUDED", safetyText: "CHL_CFM:CB123456789" }));
    const text = visibleText(container);
    expect(text).toContain("둘 중 하나만 남겨야 등록할 수 있습니다");
    /* 지워야 할 값이 화면에 보여야 셀러가 무엇을 지우는지 안다. */
    expect(container.querySelector('input[value="CB123456789"]')).not.toBeNull();
  });

  it("셀러가 내부 코드를 «읽지도 치지도» 않는다 — 고르는 것은 세 이름이다", async () => {
    const container = await renderTab(savedInfo({ safetyTarget: "TARGET" }));
    const select = container.querySelector('[aria-label="안전인증 유형"]') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent ?? "");
    expect(labels).toEqual(["인증 유형 선택", "안전인증", "안전확인", "공급자적합성확인"]);
    /* 🔴 코드는 value 로만 있다 — 셀러가 읽는 글자에는 없다. */
    for (const code of ["CHL_ATHN", "CHL_CFM", "CHL_SUPS"]) {
      expect(labels.join(" ")).not.toContain(code);
    }
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "",
      "CHL_ATHN",
      "CHL_CFM",
      "CHL_SUPS",
    ]);
  });

  it("목록 밖의 유형이 이미 저장돼 있으면 «버리지 않고» 그대로 세운다", async () => {
    const container = await renderTab(savedInfo({ safetyTarget: "TARGET", safetyText: "LIFE_CFM:LC-1" }));
    const select = container.querySelector('[aria-label="안전인증 유형"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toContain("LIFE_CFM");
    expect(select.value).toBe("LIFE_CFM");
  });
});
