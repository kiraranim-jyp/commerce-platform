// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * REWORK-11 ①(CEO 지시, 2026-09-15) — **접힌 섹션을 여는 손.**
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────────────────
 * 롯데ON 탭이 스마트스토어·쿠팡과 같은 펼침 정책을 쓰게 되면서(첫 화면에는
 * ① 기본 상품정보만 열린다 — registration-sections.ts `initialOpenSections`),
 * `renderToStaticMarkup`으로 한 번 그려서 안쪽 글자를 읽던 검사들이 전부
 * "그 글자가 없다"가 됐다. **맞는 결과다** — 접혀 있으니까 없다.
 *
 * 그래서 검사도 셀러가 하는 일을 한다: 화면을 띄우고(mount) 섹션을 펼친 다음
 * (click) 읽는다. 정적 렌더로는 할 수 없는 일이라 jsdom에 올린다.
 *
 * 🔴 화면을 테스트용으로 고치지 않았다. 여는 방법은 셀러가 쓰는 그 버튼
 * (「펼치기 ▼」)을 실제로 누르는 것 하나뿐이다.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** CollapsibleSection의 머리 버튼 문구 — 접혀 있을 때만 이 글자가 보인다. */
const EXPAND_LABEL = "펼치기 ▼";

export function expandAllSections(scope: HTMLElement): number {
  let clicked = 0;
  // 펼치면 그 안에 또 접힌 섹션이 나올 수 있다(중첩 아코디언) — 더 열 것이
  // 없을 때까지 돈다. 상한을 두는 이유는 무한 루프를 구조적으로 막기 위해서다.
  for (let pass = 0; pass < 10; pass += 1) {
    const buttons = Array.from(scope.querySelectorAll("button")).filter((button) =>
      (button.textContent ?? "").includes(EXPAND_LABEL),
    );
    if (buttons.length === 0) break;
    for (const button of buttons) button.click();
    clicked += buttons.length;
  }
  return clicked;
}

/**
 * 화면을 띄우고 **모든 섹션을 펼친** 다음 컨테이너를 돌려준다.
 *
 * 같은 파일 안에서 여러 번 불러도 된다 — 직전 마운트를 정리하고 새로 올린다.
 */
export async function mountExpanded(element: ReactElement): Promise<HTMLElement> {
  await unmountTab();
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const mounted = root;
  await act(async () => {
    mounted.render(element);
  });
  await act(async () => {
    expandAllSections(container!);
  });
  return container;
}

/**
 * 이 입력칸의 **이름**. 세 탭이 같은 행 컴포넌트(FieldRow)를 쓰게 되면서
 * `<label>`이 더 이상 input을 감싸지 않는다 — 라벨과 입력칸이 형제다. 그래서
 * "입력칸을 품은 가장 가까운 조상 중 라벨을 가진 것"을 찾아 올라간다.
 */
export function fieldLabelOf(element: Element): string {
  let node: Element | null = element;
  while (node) {
    if (node.matches("label")) return clean(node.textContent ?? "");
    const label = node.querySelector("label");
    if (label) return clean(label.textContent ?? "");
    node = node.parentElement;
  }
  return "";
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function unmountTab(): Promise<void> {
  if (root) {
    const current = root;
    await act(async () => current.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}
