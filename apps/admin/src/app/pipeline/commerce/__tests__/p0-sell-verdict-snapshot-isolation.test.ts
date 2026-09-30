// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { ActionCenter } from "../ActionCenter";
import { FINAL_VERDICT_COPY, type SellerFinalVerdict } from "../DomesticPriceIntelligencePanel";
import { resolveSellVerdict, type ScopedSellVerdict } from "../sell-verdict-scope";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-SELL-VERDICT-SNAPSHOT-ISOLATION-01 (CEO 지시, 2026-09-30)
 * **상품 A 의 판매 판정이 상품 B 의 요약에 남지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실제로 터진 모양: A 가 🟡 조건부 판매를 보고한 뒤 B 로 넘어가면, 분석 패널은
 * `if (loading) return` 때문에 아무것도 보고하지 않고 요약은 **A 의 판정을 계속**
 * 보여줬다. `verdictPending` 도 false 로 남아 「⏳ 시장 분석 중」조차 안 떴다.
 *
 * ── 🔴 왜 소스 문자열 검사를 «하지» 않는가 ─────────────────────────────────
 * 형제 파일 `single-action-center.test.ts` 는 «배치 규칙» 이라 소스를 센다.
 * 여기는 «상태 전환» 이라 그 방식이 맞지 않다 — 「초기화 코드가 있다」가
 * 「이전 판정이 안 보인다」를 뜻하지 않는다(effect 로 고치면 코드는 있는데 첫
 * 프레임은 여전히 샌다). 그래서 전환을 실제로 일으켜서 «결과» 를 본다.
 *
 * 두 축을 같이 본다:
 *   ① 순수 함수 — 상품 경계에서 판정이 실제로 끊기는가
 *   ② 마운트한 DOM — 셀러가 화면에서 «무엇을 읽는가»
 *      (이 저장소 규약: Render PASS ≠ 소스 PASS)
 */

const SNAP_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const SNAP_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

/** 패널이 보고하는 일을 그대로 흉내낸다 — 보고 시점의 snapshotId 를 같이 새긴다. */
function report(snapshotId: string | null, verdict: SellerFinalVerdict | null): ScopedSellVerdict {
  return { snapshotId, verdict };
}

describe("① 판정은 그 상품에 귀속된다 (상태 전환)", () => {
  it("A 가 CONDITIONAL 을 보고하면 A 에서 그 판정이 보인다", () => {
    const state = report(SNAP_A, "CONDITIONAL");
    expect(resolveSellVerdict(state, SNAP_A)).toEqual({ verdict: "CONDITIONAL", reported: true });
  });

  it("🔴 B 로 전환하면 A 의 판정이 «남지 않는다»", () => {
    const state = report(SNAP_A, "CONDITIONAL");
    expect(resolveSellVerdict(state, SNAP_B).verdict).toBeNull();
  });

  it("🔴 B 의 판정이 아직 안 왔으면 «대기» 다 — 판단 불가가 아니다", () => {
    const state = report(SNAP_A, "CONDITIONAL");
    /* reported=false 여야 요약이 「⏳ 시장 분석 중」을 그린다. true 면 곧바로
       「⚪ 판단 불가」가 되고, 그것도 B 에 대해 하지 않은 말이다. */
    expect(resolveSellVerdict(state, SNAP_B).reported).toBe(false);
  });

  it("B 가 NOT_RECOMMENDED 를 보고하면 B 의 판정만 보인다", () => {
    const state = report(SNAP_B, "NOT_RECOMMENDED");
    expect(resolveSellVerdict(state, SNAP_B)).toEqual({ verdict: "NOT_RECOMMENDED", reported: true });
    /* 되짚어 A 로 돌아가도 B 의 답을 빌려 쓰지 않는다. */
    expect(resolveSellVerdict(state, SNAP_A).verdict).toBeNull();
  });

  it("🔴 같은 상품에서는 판정이 유지된다 — 탭 이동 sticky 는 보존한다", () => {
    const state = report(SNAP_A, "RECOMMENDED");
    /* 탭 이동은 snapshotId 를 바꾸지 않는다. 패널이 언마운트돼 보고가 끊겨도
       마지막 값이 그대로 읽혀야 한다(의도된 sticky visited 설계). */
    expect(resolveSellVerdict(state, SNAP_A)).toEqual({ verdict: "RECOMMENDED", reported: true });
    expect(resolveSellVerdict(state, SNAP_A)).toEqual({ verdict: "RECOMMENDED", reported: true });
  });

  it("🔴 «판단 불가» 와 «아직 안 옴» 을 가른다", () => {
    /* 이 상품이 실제로 null 을 보고한 것 = 판단 불가 */
    expect(resolveSellVerdict(report(SNAP_A, null), SNAP_A)).toEqual({ verdict: null, reported: true });
    /* 보고 자체가 없는 것 = 대기 */
    expect(resolveSellVerdict(null, SNAP_A)).toEqual({ verdict: null, reported: false });
  });

  it("스냅샷 생성 전(null) 판정은 스냅샷이 생기면 따라오지 않는다", () => {
    const state = report(null, "CONDITIONAL");
    expect(resolveSellVerdict(state, undefined)).toEqual({ verdict: "CONDITIONAL", reported: true });
    expect(resolveSellVerdict(state, null)).toEqual({ verdict: "CONDITIONAL", reported: true });
    expect(resolveSellVerdict(state, SNAP_A).verdict).toBeNull();
  });
});

/* ══ ② 화면 증거 — 셀러가 실제로 읽는 글자 ═══════════════════════════════════ */

function mountSummary(state: ScopedSellVerdict | null, snapshotId: string | null): string {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const { verdict, reported } = resolveSellVerdict(state, snapshotId);
  act(() => {
    root.render(
      createElement(ActionCenter, {
        verdict: verdict ? FINAL_VERDICT_COPY[verdict] : null,
        verdictPending: !reported,
        channels: [],
        checklist: [],
      } as never),
    );
  });
  const text = host.textContent ?? "";
  act(() => root.unmount());
  host.remove();
  return text;
}

describe("② 요약 화면이 실제로 무엇을 말하는가 (마운트한 DOM)", () => {
  beforeAll(() => {
    /* 이게 없으면 React 가 act(...) 경고를 내고 flush 를 보장하지 않는다 —
       그 상태의 `not.toContain` 은 「렌더가 안 됐다」로도 통과하는 거짓 PASS 다
       (형제 파일 golf015-category-panel-mount.test.ts 와 같은 설정). */
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("🔴 «부정» 단정의 대조군 — 마운트가 실제로 글자를 만든다", () => {
    /* 아래 not.toContain 들이 「아무것도 안 그려졌다」로 통과하는 것을 막는다.
       요약 카드의 머리말은 판정과 무관하게 항상 있어야 한다. */
    expect(mountSummary(report(SNAP_A, "CONDITIONAL"), SNAP_B)).toContain("판매 판단");
  });

  it("A 에서는 「조건부 판매」가 읽힌다", () => {
    expect(mountSummary(report(SNAP_A, "CONDITIONAL"), SNAP_A)).toContain("조건부 판매");
  });

  it("🔴 B 로 넘어간 화면에 「조건부 판매」가 읽히지 «않는다»", () => {
    const text = mountSummary(report(SNAP_A, "CONDITIONAL"), SNAP_B);
    expect(text).not.toContain("조건부 판매");
    /* 🔴 「판단 불가」로 바꿔치기하는 것도 답이 아니다 — B 에 대해 하지 않은 말이다. */
    expect(text).not.toContain("판단 불가");
    expect(text).toContain("시장 분석 중");
  });

  it("🔴 A=판매 추천 → B 전환 화면에 「판매 추천」이 읽히지 않는다", () => {
    /* 가장 비싼 오답 — B 가 실제로 비추천인데 요약이 추천이라고 말하는 경우. */
    const text = mountSummary(report(SNAP_A, "RECOMMENDED"), SNAP_B);
    expect(text).not.toContain("판매 추천");
  });

  it("B 가 비추천을 보고하면 그때 「판매 비추천」이 읽힌다", () => {
    const text = mountSummary(report(SNAP_B, "NOT_RECOMMENDED"), SNAP_B);
    expect(text).toContain("판매 비추천");
    expect(text).not.toContain("시장 분석 중");
  });

  it("같은 상품이면 판정 글자가 그대로 유지된다", () => {
    expect(mountSummary(report(SNAP_A, "RECOMMENDED"), SNAP_A)).toContain("판매 추천");
  });
});
