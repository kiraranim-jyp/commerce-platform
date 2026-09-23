// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommerceSelector } from "../CommerceSelector";
import { COMMERCE_ORDER, commerceLabel, isPlatformCommerce, type CommerceId } from "../commerce-registry";
import { buildRegistrationChannels } from "../registration-channels";

/**
 * N-05-A — **정적 판정으로 끝내지 않는다.** 실제로 마운트해서 세 줄이 그려지고,
 * 체크가 먹고, 하나도 안 고르면 다음 단계 버튼이 잠기는지를 DOM 으로 확인한다.
 *
 * 🔴 채널 목록은 화면이 쓰는 그 함수(buildRegistrationChannels + COMMERCE_ORDER)
 * 로 만든다 — 테스트가 자기만의 목록을 지어내면 「화면에는 셋인데 검사에는
 * 둘」 같은 상태를 못 잡는다.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const CHANNELS = buildRegistrationChannels({
  order: COMMERCE_ORDER,
  labelOf: commerceLabel,
  isComingSoon: (id) => isPlatformCommerce(id) && id === "elevenst",
  isPreviewOnly: (id) => id === "smartstore",
  readiness: { coupang: { state: "READY", priorityItems: [], provisional: false, requiredTotal: 7 } },
});

async function render(selected: CommerceId[], onToggle: (id: CommerceId, next: boolean) => void = () => {}) {
  await act(async () => {
    root.render(
      createElement(CommerceSelector, { channels: CHANNELS, selected, onToggle, onConfirm: () => {} }),
    );
  });
}

function boxes(): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="checkbox"]'));
}

function confirmButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes("등록 준비 확인"),
  );
  if (!button) throw new Error("[등록 준비 확인] 버튼이 화면에 없다");
  return button as HTMLButtonElement;
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("N-05-A — 등록할 커머스 선택기(실제 마운트)", () => {
  it("🔴 세 커머스가 «이름으로» 선다 — 롯데ON 포함", async () => {
    await render([]);
    expect(boxes()).toHaveLength(3);
    for (const label of ["스마트스토어", "쿠팡", "롯데ON"]) {
      expect(text(), `${label} 이 선택기에 없다`).toContain(label);
    }
  });

  it("고른 것만 체크돼 있다", async () => {
    await render(["coupang"]);
    const checked = boxes().filter((box) => box.checked);
    expect(checked).toHaveLength(1);
    expect(text()).toContain("선택 1개");
  });

  it("🔴 체크하면 그 커머스 id 로 올라간다", async () => {
    const calls: [CommerceId, boolean][] = [];
    await render([], (id, next) => calls.push([id, next]));
    await act(async () => {
      boxes()[2].click(); // 세 번째 = 롯데ON
    });
    expect(calls).toEqual([["lotteon", true]]);
  });

  it("체크를 풀면 false 로 올라간다", async () => {
    const calls: [CommerceId, boolean][] = [];
    await render(["coupang"], (id, next) => calls.push([id, next]));
    await act(async () => {
      boxes()[1].click();
    });
    expect(calls).toEqual([["coupang", false]]);
  });

  it("🔴 하나도 고르지 않으면 [등록 준비 확인] 이 잠긴다", async () => {
    await render([]);
    expect(confirmButton().disabled).toBe(true);
    expect(text()).toContain("선택된 커머스가 없습니다");
  });

  it("하나라도 고르면 열린다", async () => {
    await render(["smartstore"]);
    expect(confirmButton().disabled).toBe(false);
  });

  it("🔴 화면이 «여기서 등록되지 않는다» 고 직접 말한다", async () => {
    // 체크박스를 눌렀을 뿐인데 상품이 나갈까 봐 못 누르는 일이 없어야 한다.
    await render([]);
    expect(text()).toContain("여기서 바로 등록되지 않습니다");
  });

  it("준비 상태를 줄마다 그대로 적는다 — 판정을 새로 하지 않는다", async () => {
    await render([]);
    expect(text()).toContain("준비됨"); // 쿠팡(READY)
    expect(text()).toContain("아직 확인하지 않았습니다"); // 상태 보고 전 채널
  });
});
