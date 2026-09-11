import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * MI-TEXT-1(CEO 지시, 2026-09-12) — "3초 안에 판단하고, 자세한 건 펼쳐서 본다."
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 판정 카드의 첫 화면이 이랬다:
 *
 *   🇰🇷 대한민국 시장 기준
 *   🟢 판매 추천
 *   국내 동일상품 대비 가격 경쟁력이 있고 목표 마진도 확보됩니다.   ← 문장
 *   가격 경쟁력은 조건부 판매 수준이지만 종합 시장 신호가 …        ← 문장
 *   ▸ 왜 이렇게 판단했나요?
 *
 * 셀러는 "🟢"를 본 다음 두 문장을 끝까지 읽어야 무엇이 좋고 무엇이 나쁜지
 * 알 수 있었다. 그런데 그 답은 이미 축 등급이 갖고 있었고, 축은 화면 한참
 * 아래(⑤ 판단 근거)에 있었다 — 결론과 근거가 다섯 블록 떨어져 있었다.
 *
 * ── 정보는 하나도 지우지 않는다 ──────────────────────────────────────────
 * 두 문장은 접힘 상세의 **첫 줄**로 내려갔다. 이 테스트가 고정하는 것이
 * 정확히 그 사실이다: 문장이 사라지지 않았고, 첫 화면에는 없고, 상세를 펼치면
 * 맨 위에 있다.
 *
 * ── 왜 소스 텍스트를 검사하는가 ──────────────────────────────────────────
 * price-single-surface.test.ts / price-display-layout.test.ts와 같은 이유다.
 * 이건 계산 규칙이 아니라 배치 규칙이라 순수 함수로 표현할 수 없는데, 깨지는
 * 방식은 늘 똑같다: 누군가 "이 설명이 중요하니까 위에 보이게 하자"며 문장을
 * 판정 아래로 되돌린다. 그 순간 이 지시 전체가 원상복구된다.
 */
function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
}

const panel = read("../DomesticPriceIntelligencePanel.tsx");
const radar = read("../MiRadar.tsx");

const verdictAt = panel.indexOf("{FINAL_VERDICT_COPY[sellerDecision.finalVerdict].icon}");
const axesAt = panel.indexOf("<MiVerdictAxes");
/** 주석에도 같은 문구가 나오므로(왜 이 자리로 옮겼는지 설명한다) 버튼 자체를 찾는다. */
const toggleAt = panel.indexOf("{caret(showMarketDetail)} 왜 이렇게 판단했나요?");
const detailOpenAt = panel.indexOf("{showMarketDetail && (");
const descriptionAt = panel.indexOf("{representativeVerdict.description}");

describe("판정 카드 첫 화면은 결론 + 축 세 줄 + 토글뿐이다", () => {
  it("판정 바로 아래가 축 줄이다", () => {
    expect(verdictAt).toBeGreaterThan(-1);
    expect(axesAt).toBeGreaterThan(verdictAt);
    expect(axesAt).toBeLessThan(toggleAt);
  });

  it("긴 설명 문장이 첫 화면에 없다 — 접힘 안에만 있다", () => {
    expect(descriptionAt).toBeGreaterThan(-1); // 지워지지 않았다
    expect(descriptionAt).toBeGreaterThan(detailOpenAt); // 접힘 블록 안이다
  });

  it("그 문장은 접힘 상세의 첫 줄이다 — 눌러 놓고 답을 찾아 헤매지 않는다", () => {
    const between = panel.slice(detailOpenAt, descriptionAt);
    // 상세 시작과 문장 사이에 다른 데이터 블록이 끼어 있지 않다(주석만 있다).
    expect(between).not.toContain("<dl");
    expect(between).not.toContain("<ul");
    expect(between).not.toContain("confidenceBasis");
  });

  it("강등 사유도 지워지지 않고 상세로 함께 내려갔다", () => {
    const downgradeAt = panel.indexOf("종합 시장 신호가 불리해");
    expect(downgradeAt).toBeGreaterThan(detailOpenAt);
  });

  it("토글 문구는 CEO 지시문 그대로다", () => {
    expect(panel).toContain("왜 이렇게 판단했나요?");
  });
});

describe("등급 어휘는 한 곳에서만 나온다", () => {
  it("별점·등급 단어 매핑이 MiRadar.tsx의 LEVEL_STARS 하나뿐이다", () => {
    // 요약(MiVerdictAxes)과 상세(MiAxisStars)가 각자 매핑을 갖는 순간, 같은
    // 상품의 같은 축이 화면 위아래에서 다른 등급으로 보이는 날이 온다.
    // 주석에는 별이 나올 수 있으므로(왜 5칸인지 설명한다) 값 선언만 센다.
    expect((radar.match(/mark: "★/g) ?? []).length).toBe(3);
    expect(panel).not.toContain('mark: "★');
  });

  it("Radar 3등급 매핑 자체는 그대로다(HIGH/MEDIUM/LOW)", () => {
    expect(radar).toContain('HIGH: { mark: "★★★★★"');
    expect(radar).toContain('MEDIUM: { mark: "★★★☆☆"');
    expect(radar).toContain('LOW: { mark: "★☆☆☆☆"');
  });

  it("결측 축을 ☆☆☆☆☆로 그리지 않는다 — 모르는 것과 낮은 것은 다르다", () => {
    // 주석은 "☆☆☆☆☆로 그리면 안 된다"고 설명하므로 그 문자열을 갖는다.
    // 실제로 그릴 수 있는 값(LEVEL_STARS의 mark)에 그 별이 없다는 것만 본다.
    expect(radar).not.toContain('mark: "☆☆☆☆☆"');
    // 결측 축은 두 컴포넌트 모두 emptyStateForAxis의 칩을 쓴다.
    expect((radar.match(/emptyStateForAxis\(axis\.state\)/g) ?? []).length).toBe(2);
  });
});

describe("판단 근거 네 축은 여전히 화면에 있다", () => {
  it("⑤ 판단 근거의 MiAxisStars가 사슬 뒤에 그대로 있다", () => {
    // 첫 화면의 세 줄은 요약이다. 결측 사유·모순 문장·🎯 상품 판단 신뢰도는
    // 여전히 ⑤에만 있고, 이 테스트가 그 자리를 지킨다(정보 손실 없음).
    const chainAt = panel.indexOf("<PriceChainView");
    const evidenceAt = panel.indexOf("<MiAxisStars");
    expect(evidenceAt).toBeGreaterThan(chainAt);
    expect(panel).toContain("PRICE_SECTION_TITLE.DECISION_EVIDENCE");
  });
});
