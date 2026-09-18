// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RegistrationHistoryEntry } from "@commerce/listing";
import { RegistrationHistoryPanel } from "../RegistrationHistoryPanel";

/**
 * P0-C REWORK ②(CEO 실측, 2026-09-17) — 「쿠팡이 등록을 수락했지만 상품 ID를
 * 돌려받지 못했습니다」 사고의 회귀 방지.
 *
 * 실제로 일어난 일: coupangConnection이 CONNECTED가 아니어서 mode=DRY_RUN이
 * 됐고, executor는 쿠팡 등록 API를 부르지 않고 payload 조립만 한 뒤
 * status="SUBMITTED"를 돌려줬다. 이 표가 그것을 "성공" + 「수락했지만 상품 ID
 * 없음」으로 적어서 셀러가 "등록됐는데 뭔가 이상하다"로 읽었다 — 등록은
 * 시도조차 되지 않았는데.
 *
 * 🔴 여기서 재는 것은 «렌더된 DOM 문자열» 이다. "라벨 함수가 존재한다"가
 *    아니라, DRY_RUN 행이 실제 화면에서 「성공」이라는 글자를 얻지 못하고
 *    LIVE 경고 문구가 DRY_RUN 행에 새지 않는가다.
 */

function entry(overrides: Partial<RegistrationHistoryEntry>): RegistrationHistoryEntry {
  return {
    productName: "테스트 상품",
    platform: "coupang",
    executedAt: "2026-09-17T10:45:00.000Z",
    mode: "DRY_RUN",
    listingKey: "https://example.com/p::coupang",
    result: { status: "SUBMITTED", platform: "coupang", mode: "DRY_RUN", retryable: false },
    ...overrides,
  } as RegistrationHistoryEntry;
}

function render(entries: RegistrationHistoryEntry[]): string {
  return renderToStaticMarkup(createElement(RegistrationHistoryPanel, { history: entries }));
}

describe("DRY_RUN 행은 «성공» 이라고 말하지 않는다", () => {
  it("상태 배지가 「미리보기」다 — 「성공」이 아니다", () => {
    const html = render([entry({})]);
    expect(html).toContain("미리보기");
    expect(html, "DRY_RUN 행에 「성공」 배지가 붙었다 — 이번 사고 그 자체다").not.toContain(">성공<");
  });

  it("「등록 요청을 보내지 않았습니다」를 명시하고, LIVE용 「수락했지만 상품 ID」 문구는 없다", () => {
    const html = render([entry({})]);
    expect(html).toContain("등록 요청을 보내지");
    expect(html, "등록 API를 부르지도 않은 행에 「수락」 문구가 붙었다").not.toContain("등록을 수락했지만");
  });
});

describe("LIVE 행의 기존 동작은 그대로다 (회귀)", () => {
  it("LIVE + 상품 ID 없음 → 「수락했지만 상품 ID를 돌려받지 못했습니다」 경고가 산다", () => {
    const html = render([
      entry({
        mode: "LIVE",
        result: { status: "SUBMITTED", platform: "coupang", mode: "LIVE", retryable: false },
      }),
    ]);
    expect(html).toContain("등록을 수락했지만");
    expect(html).toContain(">성공<");
    expect(html).not.toContain("미리보기");
  });

  it("LIVE + 상품 ID 있음 → 경고 없이 「성공」", () => {
    const html = render([
      entry({
        mode: "LIVE",
        result: {
          status: "SUBMITTED",
          platform: "coupang",
          mode: "LIVE",
          retryable: false,
          externalProductId: "12345678",
        },
      }),
    ]);
    expect(html).toContain(">성공<");
    expect(html).not.toContain("등록을 수락했지만");
    expect(html).not.toContain("미리보기");
  });

  it("FAILED 는 mode 와 무관하게 「실패」다", () => {
    const html = render([
      entry({ result: { status: "FAILED", platform: "coupang", mode: "DRY_RUN", retryable: true } }),
    ]);
    expect(html).toContain(">실패<");
  });
});
