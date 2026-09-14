import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * UX 2.2(CEO 지시, 2026-09-11) — 화면에 Action Center는 **하나**다.
 *
 * ── 왜 소스 텍스트를 검사하는가 ──────────────────────────────────────────
 * 이건 계산 규칙이 아니라 **배치 규칙**이라 순수 함수로 표현할 수가 없다. 그런데
 * 깨지는 방식은 언제나 똑같다: 누군가 새 탭/새 화면을 만들면서 "여기도 오른쪽에
 * 상태 카드가 있으면 좋겠는데"라며 한 벌 더 렌더한다. 그 한 줄을 막는 가장 싼
 * 장치가 "JSX 사용처가 몇 개인가"를 세는 것이다. 이 프로젝트에서 반복된 버그
 * 유형(같은 정보의 두 번째 사본이 생기고 한쪽만 갱신되는 것)과 정확히 같은
 * 계열이라, 타입으로 막을 수 없으면 숫자로라도 못박는다.
 *
 * 이 테스트가 실패하면 고쳐야 할 것은 테스트가 아니라 배치다 — 새로 만든 카드를
 * 지우거나, 기존 Action Center를 그 자리에서 쓰게 만들어야 한다.
 */

function read(relativeToRepoFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToRepoFile, import.meta.url)), "utf8");
}

const workspace = read("../../CommerceWorkspace.tsx");
const platformPreview = read("../PlatformPreview.tsx");
const lotteOnPanel = read("../LotteOnRegistrationPanel.tsx");
const frame = read("../ChannelRegistrationFrame.tsx");

describe("오른쪽 기둥은 화면에 하나뿐이다", () => {
  it("<ActionCenter>는 코드 전체에서 한 번만 렌더된다", () => {
    // import 문과 헷갈리지 않게 JSX 사용처(`<ActionCenter`)만 센다.
    expect(workspace.match(/<ActionCenter\b/g) ?? []).toHaveLength(1);
  });

  it("Action Center가 탭 분기 안에 들어가 있지 않다", () => {
    // 탭 분기 안에 있으면 "그 탭에서만 존재하는 오른쪽 기둥"이 되고, 다른 탭이
    // 자기 기둥을 또 만들게 된다 — UX 2.2 이전이 정확히 그 모양이었다.
    const actionCenterAt = workspace.indexOf("<ActionCenter");
    const sourceTabBranchAt = workspace.indexOf('{tab === "source" && (');
    // LOTTEON COMMERCE SPRINT 2(2026-09-14) — 이 분기의 조건식이
    // `tab !== "source" && tab !== "content"`에서 `isPlatformTab(tab)`으로
    // 바뀌었다(롯데ON 탭이 PlatformId가 아니라서 PLATFORM_ADAPTERS를 인덱싱하는
    // 자리와 분리해야 했다). **검사 대상은 그대로 "채널 분기의 위치"다** —
    // 찾는 문자열만 새 조건식으로 맞춘다.
    const channelBranchAt = workspace.indexOf("{listing && isPlatformTab(tab) && (");
    expect(actionCenterAt).toBeGreaterThan(-1);
    expect(sourceTabBranchAt).toBeGreaterThan(-1);
    expect(channelBranchAt).toBeGreaterThan(-1);
    // 탭 분기들이 모두 끝난 뒤(그리고 공통 grid 안에서) 한 번 렌더된다.
    expect(actionCenterAt).toBeGreaterThan(sourceTabBranchAt);
    expect(actionCenterAt).toBeGreaterThan(channelBranchAt);
  });

  /**
   * REWORK-2(CEO 지시, 2026-09-14) — 규칙이 **하나 더 정확해졌다.**
   *
   * UX 2.2는 "채널 화면은 오른쪽 기둥을 갖지 않는다"였다. 그 규칙대로 만들었더니
   * 렌더 덤프에서 드러난 화면은 이랬다: 채널 탭 오른쪽에 선 것은 채널 등록
   * 요약이 아니라 **상품 Action 카드**("등록 전 확인 · 커머스 등록")였고, 등록
   * 판정·부족정보·등록 버튼은 본문에 세로로 쌓여 있었다.
   *
   * 그래서 규칙을 "기둥이 하나다"로 되돌린다 — **누가 그 하나를 갖는지**가
   * 화면마다 다를 뿐이다(stage-focus의 actionCenter.pillar). 채널 탭에서는
   * 워크스페이스가 자기 기둥을 접고(channelOwnsPillar), 채널 화면이 등록 요약
   * 하나를 세운다. 두 기둥이 동시에 서는 경우는 여전히 없다.
   */
  it("채널 화면에서는 상품 Action Center가 서지 않는다", () => {
    // 워크스페이스가 자기 기둥을 접는 배선이 실제로 있다.
    expect(workspace).toContain("channelOwnsPillar");
    expect(workspace).toContain('stageFocus.actionCenter.pillar === "CHANNEL_REGISTRATION"');
    expect(workspace).toContain("{!channelOwnsPillar && (");
  });

  it("채널 화면의 오른쪽 기둥은 세 채널이 같은 컴포넌트로 세운다", () => {
    // 예전 PlatformPreview의 [본문 | 360px 상태 카드] 2단은 돌아오지 않는다 —
    // 폭도 순서도 공용 프레임 하나가 정한다.
    expect(platformPreview).not.toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
    expect(platformPreview).toContain("<ChannelRegistrationFrame");
    expect(platformPreview).toContain("<ChannelRegistrationSummary");
    expect(lotteOnPanel).toContain("<ChannelRegistrationFrame");
    expect(lotteOnPanel).toContain("<ChannelRegistrationSummary");
    // 등록 게이트와 등록 버튼은 그대로 살아 있다 — 지운 것이 아니라 옮긴 것이다.
    expect(platformPreview).toContain("onRegister={onOpenListingModal}");
    expect(lotteOnPanel).toContain("onRegister={() => void runRegister()}");
  });

  it("공용 프레임은 저장소에 하나뿐이다", () => {
    // 프레임이 둘이 되는 순간 "세 채널이 같은 화면"이 코드에서 거짓이 된다.
    for (const source of [platformPreview, lotteOnPanel]) {
      expect(source).toContain('from "./ChannelRegistrationFrame"');
    }
    expect(frame.match(/lg:grid-cols-\[minmax\(0,1fr\)_300px\]/g) ?? []).toHaveLength(1);
  });
});

describe("시장 분석 패널은 탭과 무관하게 한 번만 마운트된다", () => {
  it("<DomesticPriceIntelligencePanel>도 한 번만 렌더된다", () => {
    expect(workspace.match(/<DomesticPriceIntelligencePanel\b/g) ?? []).toHaveLength(1);
  });

  it("탭 분기보다 먼저 마운트된다 — 쿠팡 탭이 복원돼도 분석이 돈다", () => {
    // 예전에는 이 패널이 상품정보 탭 안에서만 마운트돼서, 쿠팡 탭이
    // sessionStorage로 복원된 세션에서는 시장 분석이 시작조차 되지 않았다.
    // 그러면 ② 시장 판단이 "시작 안 함"에 머물러 상단 단계가 뒤로 돌아갔다.
    const panelAt = workspace.indexOf("<DomesticPriceIntelligencePanel");
    const sourceTabBranchAt = workspace.indexOf('{tab === "source" && (');
    expect(panelAt).toBeGreaterThan(-1);
    expect(panelAt).toBeLessThan(sourceTabBranchAt);
  });

  it("표현 무게는 단계가 정한 값을 그대로 넘긴다", () => {
    // 화면이 stage === "..." 를 직접 세기 시작하면 같은 판단이 여러 벌로 흩어진다.
    expect(workspace).toContain("presentation={stageFocus.mi}");
    expect(workspace).toContain("checklistMode={stageFocus.actionCenter.checklist}");
    expect(workspace).toContain("channelsMode={stageFocus.actionCenter.channels}");
  });
});
