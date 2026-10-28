import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 E2E-CLOSE-01 §7-F — **render owner 사슬을 «전수» 로 잠근다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「`webSearchEvidence` 를 **한 컴포넌트에 연결했다고 해서** 실제 화면에
 *       연결됐다고 가정하지 않는다.」
 *
 * 🔴 E2E-04 는 `TransientCandidateSections` 를 **직접** 마운트했다 — 그 컴포넌트가
 *    실제 트리에서 **누구 밑에 서는지** 는 보지 않았다. 이 파일이 **그 한 홉** 을 닫는다.
 * 🟢 실제 사슬 = `DomesticPriceIntelligencePanel` → **`MiPanelView`** → `TransientCandidateSections`.
 *
 * ── 🔴 이 파일이 «하지 못한» 것 (먼저 적는다) ──────────────────────────────
 * ```
 * `MiPanelView` 전체를 마운트하려면 운영 `PriceHistoryResponse` 전체가 필요하다.
 * 🔴 그 fixture 를 **칸을 추측해 지어내려다** 두 번 연속 터뜨렸다(`signals` ·
 *    `lowestPriceKrw`) — 이 트랙이 반복해 온 「칸 이름 추측」 함정이라 **멈췄다.**
 * ⟹ 🔴 **이 홉의 DOM 축은 측정하지 않았다.** 아래는 **소스 축** 이다.
 * 🟢 그 아래 홉(Sections → DOM)은 `e2e04-domestic-candidate-visible` 이
 *    **마운트 DOM** 으로 잡고 있고 변이 D1 이 그 계약의 유효성을 증명했다.
 * ```
 *
 * 🔴 네트워크 0 · DB 0 · 운영 코드 변경 0.
 */

const PANEL = stripComments(
  readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8").replace(/\r\n/g, "\n"),
);

/** 🟢 생산자 목록을 **손으로 적지 않는다** — 최종 소비 호출부에서 뽑는다. */
function producersAtRenderer(): string[] {
  const at = PANEL.indexOf("<TransientCandidateSections");
  const call = PANEL.slice(at, PANEL.indexOf("/>", at));
  return [...call.matchAll(/\w+=\{(\w+Evidence)\}/g)].map((m) => m[1]!);
}

describe("E2E-CLOSE-01 — render owner 사슬", () => {
  it("🟢 최종 렌더러가 받는 생산자를 전수로 뽑는다", () => {
    const fields = producersAtRenderer();
    expect(fields.length, "생산자가 6 미만이다 — 사슬이 좁아졌다").toBeGreaterThanOrEqual(6);
    expect(fields).toContain("webSearchEvidence");
    expect(fields).toContain("domesticListingEvidence");
  });

  it("🔴🔴 바깥 패널 → `MiPanelView` 홉에서 **한 생산자도 빠지지 않는다**", () => {
    const at = PANEL.indexOf("<MiPanelView");
    expect(at).toBeGreaterThan(0);
    const call = PANEL.slice(at, PANEL.indexOf("/>", at));
    for (const f of producersAtRenderer()) {
      expect(call, `${f}: 바깥 패널 → MiPanelView 사슬이 끊겼다(화면까지 못 간다)`).toContain(`${f}={${f}}`);
    }
  });

  /**
   * 🔴 `MiPanelView` 가 그 컴포넌트를 **조건부로** 감추면 사슬이 살아 있어도 화면은 0 이다.
   *    현재는 `CollapsibleSection` 안에 **조건 없이** 선다 — 그 성질을 잠근다.
   */
  it("🔴 최종 렌더러가 **조건부 렌더 뒤에 숨지 않는다**", () => {
    const at = PANEL.indexOf("<TransientCandidateSections");
    /** 바로 앞 120자에 삼항/`&&` 게이트가 없어야 한다. */
    const before = PANEL.slice(Math.max(0, at - 120), at);
    expect(before, "최종 렌더러 앞에 조건 게이트가 생겼다").not.toMatch(/\?\s*$|&&\s*$/);
  });
});
