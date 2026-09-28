// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ListingConfirmationModal } from "../ListingConfirmationModal";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-04 — **「소스 PASS ≠ Render PASS」**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 형제 파일(`packages/listing/.../kc-coupang04-provenance-split.test.ts`)은
 * 빌더의 출력과 소스 문자열을 본다. 그것만으로는 **판매자가 화면에서 실제로
 * 무엇을 읽는지** 알 수 없다 — 이 저장소는 그 착각으로 여러 번 틀렸다.
 *
 * 🔴 이번 수정의 «요점 자체» 가 화면 문장이다. 그러니 마운트해서 읽는다.
 */

function mount(
  coupangKcNotices: { fieldName: string; value: string; autoFilled: boolean; source?: string }[],
): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      createElement(ListingConfirmationModal, {
        listing: { platformLabel: "쿠팡", title: "Baby Swim Cap", priceKrw: 39000, priceSource: "ESTIMATED" },
        coupangKcNotices,
        onCancel: () => {},
        onConfirm: () => {},
      } as never),
    );
  });
  return host;
}

const SETTINGS_TEXT = "KC인증 어린이제품 공급자적합성확인";
const CODE_DEFAULT = "KC마크 없이 구매대행 가능한 품목";

const notice = (value: string, source: string) => [
  { fieldName: "인증/허가 사항", value, autoFilled: true, source },
];

describe("🔴 ① 판매자가 읽는 문장이 «누가 넣었는지» 를 맞게 말한다", () => {
  it("Settings 문구 — 「판매자 설정에 입력된 문구입니다」", () => {
    const text = mount(notice(SETTINGS_TEXT, "SETTINGS_DEFAULT")).textContent ?? "";
    expect(text).toContain("판매자 설정에 입력된 문구입니다");
    expect(text).not.toContain("따져가가 기본으로 입력한 문구입니다");
  });

  it("코드 기본값 — 「따져가가 기본으로 입력한 문구입니다」", () => {
    const text = mount(notice(CODE_DEFAULT, "DEFAULT_VALUE")).textContent ?? "";
    expect(text).toContain("따져가가 기본으로 입력한 문구입니다");
    expect(text).not.toContain("판매자 설정에 입력된 문구입니다");
  });

  it("🔴 판매자 문구를 「따져가가 자동으로 넣었다」고 말하지 «않는다» — 이것이 이번 수정의 전부다", () => {
    const text = mount(notice(SETTINGS_TEXT, "SETTINGS_DEFAULT")).textContent ?? "";
    expect(text).not.toContain("따져가 «자동으로» 입력한 기본값");
    expect(text).not.toContain("자동으로 입력한 기본값입니다");
  });

  it("출처가 DOM 속성으로도 남는다 — 화면 증거를 나중에 다시 읽을 수 있다", () => {
    const host = mount(notice(SETTINGS_TEXT, "SETTINGS_DEFAULT"));
    expect(host.querySelector("[data-notice-source]")?.getAttribute("data-notice-source")).toBe(
      "SETTINGS_DEFAULT",
    );
  });
});

describe("🔴 ② 화면에 «실제로 등록될 값» 이 그대로 보인다", () => {
  it.each([
    ["Settings 문구", SETTINGS_TEXT, "SETTINGS_DEFAULT"],
    ["코드 기본값", CODE_DEFAULT, "DEFAULT_VALUE"],
  ])("%s 가 화면에 나온다", (_l, value, source) => {
    expect(mount(notice(value, source)).textContent ?? "").toContain(value);
  });

  it("법적 판정을 하지 않는다는 문장이 그대로 있다", () => {
    const text = mount(notice(SETTINGS_TEXT, "SETTINGS_DEFAULT")).textContent ?? "";
    expect(text).toContain("법적으로 판정하지 않습니다");
  });
});

describe("🔴 ③ 확인 요구가 «화면에서» 사라지지 않았다", () => {
  it.each([
    ["Settings 문구", "SETTINGS_DEFAULT"],
    ["코드 기본값", "DEFAULT_VALUE"],
  ])("%s — 확인 체크박스가 그려진다", (_l, source) => {
    const host = mount(notice(SETTINGS_TEXT, source));
    expect(host.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
    expect(host.textContent ?? "").toContain("위 입력값을 확인했습니다");
  });

  it("🔴 상품별 직접 입력(autoFilled=false)은 확인 칸이 «없다» — 기존 정책 그대로", () => {
    const host = mount([
      { fieldName: "인증/허가 사항", value: "KC 안전확인 제12-345호", autoFilled: false, source: "USER_INPUT" },
    ]);
    expect(host.textContent ?? "").not.toContain("위 입력값을 확인했습니다");
  });
});

describe("🔴 ④ 내부 코드명이 셀러 화면에 «글자로» 나오지 않는다", () => {
  it.each([
    ["Settings 문구", "SETTINGS_DEFAULT"],
    ["코드 기본값", "DEFAULT_VALUE"],
  ])("%s — SETTINGS_DEFAULT / DEFAULT_VALUE 가 본문에 없다", (_l, source) => {
    const text = mount(notice(SETTINGS_TEXT, source)).textContent ?? "";
    expect(text).not.toContain("SETTINGS_DEFAULT");
    expect(text).not.toContain("DEFAULT_VALUE");
  });
});
