// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADD_SAME_URL_HINT,
  ADD_SAME_URL_LABEL,
  MarketPriceComparison,
} from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-154-A — **「동일상품 URL 추가」는 «공급» 이지 «판정» 이 아니다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 최종 결정(2026-10-22) — ⒞(보몽드 어댑터)는 **robots 전면차단으로 폐기** 되고
 * ⒜ 가 채택됐다. WU-152 가 닫은 공급 입구를 **후보 목록이 아니라 URL 한 칸** 으로 연다.
 *
 * ── 🔴 CPO 가 글자로 건 조건 ──────────────────────────────────────────────────
 * ```
 * ❌ URL 입력만으로 SAME 강제        → 이 컴포넌트는 판정을 **만들지 않는다**
 * ❌ 후보 목록 재노출                → 행·개수·등급·판정 버튼 **0**
 * ❌ MI/threshold/BRAND/TITLE 완화   → 이 WU 는 그 파일들을 **건드리지 않았다**
 * ```
 * 🟢 흐름은 기존 계약 그대로 — 셀러 URL → candidate → MI → SAME/가격 → 최종 영역.
 */

const rows: GeminiTransientRow[] = [];
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(props: Record<string, unknown> = {}): Promise<void> {
  await act(async () => {
    root.render(createElement(MarketPriceComparison, { rows, ...props } as never));
  });
}

const input = () => container.querySelector<HTMLInputElement>('[data-testid="mi-add-same-url"] input');
const button = () => container.querySelector<HTMLButtonElement>('[data-testid="mi-add-same-url"] button');

async function type(value: string): Promise<void> {
  const el = input()!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("A. 🔴 넘기지 않으면 **칸이 없다**(기존 호출부 호환)", () => {
  it("A-1 `onAddSameUrl` 이 없으면 입력이 렌더되지 않는다", async () => {
    await mount();
    expect(container.querySelector('[data-testid="mi-add-same-url"]')).toBeNull();
    expect(container.textContent ?? "").not.toContain(ADD_SAME_URL_LABEL);
  });
});

describe("B. 🟢 넘기면 **한 칸 + 버튼 하나** 다", () => {
  it("B-1 라벨·안내·입력·버튼이 선다", async () => {
    await mount({ onAddSameUrl: () => {} });
    const area = container.querySelector('[data-testid="mi-add-same-url"]')!;
    expect(area.textContent ?? "").toContain(ADD_SAME_URL_LABEL);
    expect(area.textContent ?? "").toContain(ADD_SAME_URL_HINT);
    expect(area.querySelectorAll("input")).toHaveLength(1);
    expect(area.querySelectorAll("button")).toHaveLength(1);
  });

  /**
   * 🔴🔴 **후보 목록이 돌아온 것이 아니다**(CPO 금지 · WU-149/152 계약과 같은 축).
   */
  it("B-2 🔴 후보 행·판정 버튼·등급이 **하나도** 없다", async () => {
    await mount({ onAddSameUrl: () => {} });
    const area = container.querySelector('[data-testid="mi-add-same-url"]')!;
    expect(area.querySelector("table")).toBeNull();
    expect(area.querySelectorAll("li")).toHaveLength(0);
    const text = area.textContent ?? "";
    for (const banned of ["동일상품입니다", "유사상품", "다른 상품", "🟡 동일상품 추정", "후보"]) {
      expect(text, `🔴 "${banned}" 이 입력 칸에 있다`).not.toContain(banned);
    }
  });

  /** 🔴 **판정 어휘를 쓰지 않는다** — 「SAME 으로 추가」가 아니라 「확인」이다. */
  it("B-3 🔴 버튼이 판정을 약속하지 않는다", async () => {
    await mount({ onAddSameUrl: () => {} });
    const label = button()!.textContent ?? "";
    expect(label).toBe("확인");
    expect(label).not.toContain("동일");
    expect(label).not.toContain("SAME");
  });
});

describe("C. 🔴🔴 URL 만 위로 올린다 — 판정을 만들지 않는다", () => {
  it("C-1 🟢 유효한 URL 을 그대로 올려보낸다", async () => {
    const seen: string[] = [];
    await mount({ onAddSameUrl: (u: string) => seen.push(u) });
    await type("https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022");
    await act(async () => button()!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(seen).toEqual(["https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022"]);
  });

  /** 🔴 URL 모양이 아니면 **보내지 않는다** — 서버 400 을 셀러에게 보여주지 않는다. */
  it("C-2 🔴 URL 이 아니면 버튼이 잠긴다", async () => {
    const seen: string[] = [];
    await mount({ onAddSameUrl: (u: string) => seen.push(u) });
    expect(button()!.disabled, "빈 값인데 눌린다").toBe(true);
    await type("보몽드에서 팔아요");
    expect(button()!.disabled, "URL 이 아닌데 눌린다").toBe(true);
    expect(seen).toEqual([]);
  });

  /** 🔴 요청이 도는 동안 잠근다(같은 요청이 두 번 나가지 않는다). */
  it("C-3 🔴 `addingSameUrl` 이면 잠긴다", async () => {
    await mount({ onAddSameUrl: () => {}, addingSameUrl: true });
    await type("https://example.com/p/1");
    expect(button()!.disabled).toBe(true);
    expect(button()!.textContent).toContain("확인 중");
  });
});

/* ───────────────── D. 배선 — 끊기면 조용히 아무 일도 안 일어난다 ───────────────── */

/**
 * 🔴🔴 **WU-110 교훈의 반복 적용** — 컴포넌트를 직접 부르는 단언은 배선을 못 본다.
 *    이 입력의 URL 은 **MI 패널의 `recheckNow`** 로 가야 하고, 그 ref 는
 *    `presentation === "HIDDEN"` 의 `return null` **앞** 에서 채워져야 한다
 *    (셀러 화면에서 패널은 HIDDEN 이다 — 뒤에 있으면 입력이 **조용히 죽는다**).
 */
describe("D. 🔴🔴 배선 — 공급이 실제로 MI 패널의 기존 요청 경로로 간다", () => {
  /**
   * 🔴 이 파일은 `@vitest-environment jsdom` 이라 `import.meta.url` 이 **`file:` 이
   *    아니다** — 1차에 `new URL(…, import.meta.url)` 로 읽어 **파일 전체가 로드 실패**
   *    했다(「no tests」). 🟢 이 저장소의 다른 계약처럼 `__dirname` 을 쓴다.
   */
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const PANEL = strip(readFileSync(path.join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8"));
  const WORKSPACE = strip(readFileSync(path.join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8"));

  it("D-1 🔴 `recheckNowRef` 가 `HIDDEN` 의 `return null` **앞** 에서 채워진다", () => {
    const assignAt = PANEL.indexOf("recheckNowRef.current = recheckNow");
    const hiddenAt = PANEL.indexOf('if (presentation === "HIDDEN") return null');
    expect(assignAt).toBeGreaterThan(-1);
    expect(hiddenAt).toBeGreaterThan(-1);
    expect(assignAt, "🔴 HIDDEN 뒤면 셀러 화면에서 입력이 조용히 죽는다").toBeLessThan(hiddenAt);
  });

  it("D-2 🔴 기존 요청 경로를 쓴다 — 새 fetch 를 만들지 않았다", () => {
    /** URL 은 `recheckNow` 의 인자로만 들어간다(POST 본문은 기존 그대로). */
    expect(PANEL).toContain("recheckNowRef.current?.(url)");
    expect(PANEL).toMatch(/async function recheckNow\(overrideUrl\?: string\)/);
    expect(PANEL).toMatch(/candidateUrls: suppliedUrls/);
    /** 🔴 Workspace 는 fetch 하지 않는다 — 요청 owner 가 둘이 되면 안 된다. */
    const handler = WORKSPACE.slice(
      WORKSPACE.indexOf("function handleAddSameUrl"),
      WORKSPACE.indexOf("function handleAddSameUrl") + 300,
    );
    expect(handler).not.toContain("fetch(");
    expect(handler).toContain("nonce");
  });

  it("D-3 🟢 결론 영역과 패널이 **둘 다** 그 배선을 들고 있다", () => {
    expect(WORKSPACE).toContain("onAddSameUrl={handleAddSameUrl}");
    expect(WORKSPACE).toContain("suppliedUrlRequest={suppliedUrlRequest}");
  });
});
