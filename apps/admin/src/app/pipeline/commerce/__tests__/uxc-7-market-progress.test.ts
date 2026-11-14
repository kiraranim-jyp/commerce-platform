/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UXC-진행 — **② 시장 판단에서도 「지금 무엇을 하는지」가 보인다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 실측 — 신규 상품 분석이 **약 96초**(03:48:29 → 03:50:05) 걸리는데 그동안 화면은
 *    「한국 시장 가격을 조회하고 있습니다…」 **한 줄** 뿐이었다.
 * 🔴🔴 원인은 「진행 표시가 없다」가 아니라 **«그 자리에 없다»** 였다 — 단계 목록이
 *    ① 상품 수집에서만 그려졌다.
 *
 * ── 🔴🔴 그리고 **기존 계약 셋과 충돌했고, 계약을 «풀지 않고» 이름을 옮겼다** ──
 * ```
 * 「국내 비교상품」 → 「국내 시장 검색」   후보 목록 어휘가 ② 본문에 서면 안 된다
 * 「판매 판단」     → 「MI 판매 판단」     결론 영역 «최상위 제목» 과 글자가 같았다
 * ```
 * 🟢 둘 다 **표현만** 바뀌었다 — key · 상태 · 신호 · 순서 **변경 0**.
 *
 * 🔴 이 파일이 **하지 않는** 것 — 새 상태·새 신호 0 · 가짜 진행률 0 · 후보 표 0 ·
 *    MI 판단·가격 계산 0.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StageBody } from "../StageBody";
import type { StageFocus } from "../stage-focus";
import type { Workflow } from "../workflow";

const SRC = readFileSync(join(__dirname, "../StageBody.tsx"), "utf8")
  .split(String.fromCharCode(13))
  .join("");
const WF_SRC = readFileSync(join(__dirname, "../workflow.ts"), "utf8")
  .split(String.fromCharCode(13))
  .join("");

const focusAt = (main: StageFocus["main"]) => ({ main, images: "REFERENCE" }) as unknown as StageFocus;

/** 🟢 실제 `subSteps` 모양 그대로 — 지어낸 칸 0. */
const steps = [
  { key: "market_price", label: "시장 가격 조회", status: "DONE", message: null },
  {
    key: "domestic_comparison",
    label: "국내 시장 검색",
    status: "RUNNING",
    message: "국내 시장 데이터를 분석하고 있습니다...",
  },
  { key: "final_verdict", label: "MI 판매 판단", status: "DONE_NO_DATA", message: "⚪ 검색 데이터 없음" },
];
const WORKFLOW = { current: { subSteps: steps, headline: "" } } as unknown as Workflow;

function mount(main: StageFocus["main"]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(
      createElement(StageBody, {
        focus: focusAt(main),
        workflow: WORKFLOW,
        surfaces: { source: null, images: null, price: null, required: null },
        archive: null,
        channels: [],
        onGoToChannel: () => {},
      } as never),
    );
  });
  return host;
}

describe("UXC-진행 ② 시장 판단의 단계 표시", () => {
  it("G-1 🔴🔴 ② 단계에서 **단계 목록이 선다**(전에는 통째로 없었다)", () => {
    const h = mount("MARKET");
    expect(h.querySelector('[data-testid="market-stage-steps"]'), "🔴 진행 표시가 사라졌다").not.toBeNull();
    expect(h.querySelectorAll('[data-testid="market-stage-step"]').length).toBe(steps.length);
  });

  it("G-2 🔴 **실제 상태가 그대로** 반영된다 — 완료·진행 중·결과없음을 구분한다", () => {
    const h = mount("MARKET");
    expect(
      [...h.querySelectorAll('[data-testid="market-stage-step"]')].map((n) => n.getAttribute("data-status")),
      "🔴 상태가 뭉개졌다",
    ).toEqual(["DONE", "RUNNING", "DONE_NO_DATA"]);
    expect(h.textContent ?? "", "🔴 진행 중 단계의 설명이 사라졌다").toContain(
      "국내 시장 데이터를 분석하고 있습니다",
    );
    /** 🔴 「없다」를 「진행 중」으로 꾸미지 않는다. */
    expect(h.textContent ?? "").toContain("⚪ 검색 데이터 없음");
  });

  it("G-3 🔴🔴 **가짜 진행률을 만들지 않는다** — 퍼센트·타이머·자동 증가 0", () => {
    const h = mount("MARKET");
    expect(h.textContent ?? "", "🔴 가짜 진행률이 생겼다").not.toMatch(/\d+\s*%/);
    /** 🔴 소스 축으로도 막는다(렌더만 보면 나중에 타이머가 들어와도 통과한다). */
    const i = SRC.indexOf("function MarketStage");
    const fn = SRC.slice(i, SRC.indexOf("\n}", i));
    for (const banned of ["setInterval", "setTimeout", "Date.now", "progress", "%"]) {
      expect(fn, `🔴 진행 표시에 임의 타이머/퍼센트가 들어왔다: ${banned}`).not.toContain(banned);
    }
  });

  it("G-4 🟢 **같은 데이터를 쓴다** — 사본을 만들지 않았다", () => {
    expect(SRC, "🔴 단계 배열의 owner 가 갈렸다").toContain("workflow.current.subSteps.map");
    expect(SRC, "🔴 ② 에 workflow 가 전달되지 않는다").toContain("<MarketStage workflow={workflow} />");
  });

  it("G-5 🟢 ① 상품 수집의 기존 표시는 **그대로** 다(한쪽만 고치지 않았다)", () => {
    const h = mount("COLLECTION");
    expect(h.textContent ?? "", "🔴 ① 의 단계 표시가 사라졌다").toContain("시장 가격 조회");
  });

  it("G-6 🔴 ② 의 기존 안내 문장을 **지우지 않았다** · 후보 표를 넣지 않았다", () => {
    const h = mount("MARKET");
    expect(h.textContent ?? "", "🔴 기존 안내가 사라졌다").toContain("동일상품 여부는 시스템이 판단합니다");
    expect(h.querySelector('[data-testid="mi-candidate-row"]'), "🔴 ② 에 후보 표가 들어왔다").toBeNull();
  });

  it("G-7 🔴🔴 **충돌한 어휘가 되살아나면 FAIL** 한다(계약을 풀지 않은 증거)", () => {
    /** 🔴 그 둘이 돌아오면 기존 계약 셋이 다시 깨진다 — 여기서 먼저 잡는다. */
    expect(WF_SRC, "🔴 후보 목록 어휘가 진행 단계로 되돌아왔다").not.toContain('"국내 비교상품"');
    expect(WF_SRC, "🔴 결론 제목과 같은 라벨로 되돌아왔다").not.toContain('const label = "판매 판단"');
    /** 🟢 바뀐 이름이 실제로 쓰인다. */
    expect(WF_SRC).toContain('"국내 시장 검색"');
    expect(WF_SRC).toContain('const label = "MI 판매 판단"');
  });
});
