/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { TransientCandidateSections } from "../DomesticPriceIntelligencePanel";
import {
  WEAK_CANDIDATE_HEADING,
  WEAK_CANDIDATE_SCOPE_NOTICE,
  type GeminiTransientRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DIP-01 — **마운트한 DOM** 으로 본다(Render PASS ≠ 소스 PASS)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-091 이 세운 네 조건을 그대로 지킨다 — 하나라도 빠지면 2026-09-19 사고
 *    (「유력 후보 5건」)의 모양으로 돌아간다:
 *    ① 기본 **접힘** ② 판정된 구역보다 **뒤** ③ 행마다 **판정 라벨**
 *    ④ **「쓰이지 않는다」를 글자로** 적는다
 */

function mount(props: Parameters<typeof TransientCandidateSections>[0]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(TransientCandidateSections, props));
  });
  return host;
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

const WEAK: GeminiTransientRow[] = [
  {
    domain: "weakshop.co.kr",
    title: "증거 부족 후보 A",
    discoveredUrl: "https://weakshop.co.kr/products/a",
    crossSellerVerdict: "SIMILAR",
    priceAmount: 51000,
    priceCurrency: "KRW",
    market: "KR",
    source: "WEB_SEARCH",
  },
];
const JUDGED: GeminiTransientRow[] = [
  {
    domain: "judged.com",
    title: "판정된 후보 B",
    discoveredUrl: "https://judged.com/products/b",
    crossSellerVerdict: "SAME",
    priceAmount: 37,
    priceCurrency: "GBP",
    market: "OVERSEAS",
    source: "OVERSEAS_AUTO",
  },
];

describe("DIP-01 D — 버려진 후보가 화면에 «선다»", () => {
  it("D-1 🟢 구역이 뜨고 제목·판매처·상품명·통화가 보인다", () => {
    const box = q(mount({ weak: WEAK }), "weak-candidate-transient");
    expect(box, "구역이 렌더되지 않았다").not.toBeNull();
    const t = box!.textContent ?? "";
    expect(t).toContain(WEAK_CANDIDATE_HEADING);
    expect(t).toContain("weakshop.co.kr");
    expect(t).toContain("증거 부족 후보 A");
    /** 🟢 통화 그대로 — 환산하지 않는다. */
    expect(t).toContain("KRW");
  });

  /** 🔴 WU-091 ④ — 「쓰이지 않는다」를 **글자로** 적지 않으면 유력 후보로 읽힌다. */
  it("D-2 🔴 「가격 비교·판매 판단에 쓰이지 않는다」를 **적는다**", () => {
    const host = mount({ weak: WEAK });
    expect(q(host, "weak-candidate-scope")?.textContent).toBe(WEAK_CANDIDATE_SCOPE_NOTICE);
    expect(WEAK_CANDIDATE_SCOPE_NOTICE).toContain("가격 비교");
    expect(WEAK_CANDIDATE_SCOPE_NOTICE).toContain("판매 판단");
  });

  /** 🔴 WU-091 ① — 기본 접힘. `open` 이 붙으면 「유력」으로 읽힌다. */
  it("D-3 🔴 기본 **접혀** 있다", () => {
    const box = q(mount({ weak: WEAK }), "weak-candidate-transient")!;
    const details = box.querySelector("details");
    expect(details, "접힘 컨테이너가 없다").not.toBeNull();
    expect((details as HTMLDetailsElement).open, "🔴 펼쳐져 있다 — 유력 후보로 읽힌다").toBe(false);
  });

  /** 🔴 WU-091 ③ — 행마다 판정이 적혀야 한다. */
  it("D-4 🔴 행에 **판정 라벨**이 있다", () => {
    const box = q(mount({ weak: WEAK }), "weak-candidate-transient")!;
    expect(box.querySelectorAll('[data-testid="gt-verdict"]').length).toBeGreaterThan(0);
  });

  /**
   * 🔴🔴 **「동일상품」이라고 적지 않는다.** 제목이 그렇게 읽히는 순간 이 구역은
   *    판정 영역이 되고, 셀러는 판정되지 않은 것을 판정된 것으로 읽는다.
   */
  it("D-5 🔴 제목이 **동일상품이라고 단정하지 않는다**", () => {
    expect(WEAK_CANDIDATE_HEADING).not.toContain("동일상품");
    expect(WEAK_CANDIDATE_HEADING).toContain("판정하지 못한");
  });

  /** 🔴 WU-091 ② — 판정된 구역보다 **뒤** 에 선다(먼저 서면 결론처럼 읽힌다). */
  it("D-6 🔴 판정된 구역보다 **뒤**에 온다", () => {
    const html = mount({ overseasAuto: JUDGED, weak: WEAK }).innerHTML;
    const judgedAt = html.indexOf("judged.com");
    const weakAt = html.indexOf("weakshop.co.kr");
    expect(judgedAt).toBeGreaterThanOrEqual(0);
    expect(weakAt, "🔴 버려진 후보가 판정된 후보보다 «앞»에 선다").toBeGreaterThan(judgedAt);
  });

  /** 🟢 없으면 구역도 안내문도 **아예 뜨지 않는다**(빈 구역으로 자리를 먹지 않는다). */
  it("D-7 🟢 버려진 후보가 없으면 구역이 **없다**", () => {
    const host = mount({ overseasAuto: JUDGED });
    expect(q(host, "weak-candidate-transient")).toBeNull();
    expect(q(host, "weak-candidate-scope")).toBeNull();
  });

  /**
   * 🔴🔴 **내부 어휘를 셀러 화면에 노출하지 않는다**(CPO §13 금지 목록).
   *    🟢 `접힌 채로` 본다 — 1차 노출면이 기준이다.
   */
  it("D-8 🔴 1차 노출면에 **내부 토큰이 없다**", () => {
    const host = mount({ weak: WEAK });
    const c = host.cloneNode(true) as HTMLElement;
    for (const d of [...c.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
    const first = (c.textContent ?? "").replace(/\s+/g, " ");
    for (const w of ["WEB_SEARCH", "EVIDENCE_NOT_WORTHWHILE", "PRESUMED_SAME", "matchLevel", "priceTier", "Apify"]) {
      expect(first, `🔴 내부 토큰 노출: ${w}`).not.toContain(w);
    }
  });
});

describe("DIP-01 E — 🔴 표시 전용 경계(배선 소스)", () => {
  const PANEL = readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8").replace(/\r\n/g, "\n");
  /** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`. */
  const CODE = PANEL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  /**
   * 🔴🔴🔴 패널의 evidence 소비처는 **셋** 이다 — 후보 카드 · `marketComparisonInput`
   *    (📊 시장 판매 판단) · `buildMarketJudgement`(가격 판단). 버려진 후보는
   *    **첫째 하나에만** 들어간다.
   */
  it("E-1 🔴🔴 `marketComparisonInput` 에 **들어가지 않는다**", () => {
    const block = CODE.slice(
      CODE.indexOf("const marketComparisonInput = useMemo"),
      CODE.indexOf("costPriceKrw: data?.currentPrice?.costPriceKrw"),
    );
    expect(block.length).toBeGreaterThan(100);
    expect(block, "🔴 판정 안 된 후보가 시장 판단 입력에 들어갔다").not.toContain("weakCandidateEvidence");
  });

  it("E-2 🔴🔴 `buildMarketJudgement` 에 **들어가지 않는다**", () => {
    const block = CODE.slice(
      CODE.indexOf("const miJudgement = buildMarketJudgement(["),
      CODE.indexOf("const miOverseasGuide ="),
    );
    expect(block.length).toBeGreaterThan(50);
    expect(block, "🔴 판정 안 된 후보가 가격 판단에 들어갔다").not.toContain("weakCandidateEvidence");
    /** 🟢 기존 여섯은 그대로다(이 WU 가 빼지 않았다). */
    expect(block).toContain("...(webSearchEvidence ?? [])");
  });

  it("E-3 🟢 배선은 **후보 카드 구역 하나** 로만 간다 — 두 응답 경로 모두", () => {
    expect(CODE).toContain("weak={weakCandidateEvidence}");
    /** 🔴 자동 1회차 · 「🔄 다시 분석」 **둘 다** — 한쪽만 고치면 그 경로에서 사라진다. */
    expect(CODE).toContain("setWeakCandidateEvidence(j.domesticShop?.weakCandidateEvidence ?? null)");
    expect(CODE).toContain("setWeakCandidateEvidence(json.domesticShop?.weakCandidateEvidence ?? null)");
  });
});
