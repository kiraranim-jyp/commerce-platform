import { describe, expect, it } from "vitest";
import type { ChannelNoticeOverride } from "@commerce/shared";
import { DETAIL_PAGE_REFERENCE_TEXT } from "../reference-eligibility";
import {
  NAVER_NOTICE_REQUIRED_CONFIRMED,
  NOTICE_KEY_PACK_DATE,
  NOTICE_KEY_RELEASE_DATE,
  isSellerDecidedNoticeState,
  resolveChannelNoticeField,
} from "../channel-notice-override";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NAVER-CHANNEL-NOTICE-OVERRIDES-03 (CPO 확정 「㉡」, 2026-09-30)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 가장 비싼 오답 두 개를 먼저 잠근다:
 *   ① 참조 문구가 셀러가 적은 연월을 «덮는다» → 값을 잃는다
 *   ② `DISCLOSED_DEFAULT` 를 `SELLER_REFERENCED` 와 «같게» 다룬다
 *      → 「셀러가 확인한 것」과 「우리가 정한 것」이 한 값으로 뭉치고,
 *         이 작업이 없애려는 결함이 그대로 남는다
 *
 * 🔴 그리고 ③ — `outgoing` 이 비면 네이버가 `NotEmpty` 로 거부한다(실측:
 * fixtures/smartstore/golden-success-01.json attempt 6). 그래서 「어떤 상태에서도
 * 비지 않는다」를 명제로 고정한다.
 */

function override(o: ChannelNoticeOverride): ChannelNoticeOverride {
  return o;
}

describe("① 실제 값이 언제나 먼저다", () => {
  it("셀러가 적은 연월이 그대로 나간다", () => {
    const r = resolveChannelNoticeField(override({ values: { [NOTICE_KEY_PACK_DATE]: "2025-03" } }), NOTICE_KEY_PACK_DATE);
    expect(r).toEqual({ outgoing: "2025-03", state: "SELLER_VALUE" });
  });

  it("🔴 참조 선택이 «함께» 있어도 실제 값이 이긴다", () => {
    const r = resolveChannelNoticeField(
      override({ values: { [NOTICE_KEY_PACK_DATE]: "2025-03" }, referenced: [NOTICE_KEY_PACK_DATE] }),
      NOTICE_KEY_PACK_DATE,
    );
    expect(r.outgoing).toBe("2025-03");
    expect(r.state).toBe("SELLER_VALUE");
  });

  it("공백만 든 값은 «없는 것» 으로 본다 — 더러운 입력", () => {
    const r = resolveChannelNoticeField(override({ values: { [NOTICE_KEY_PACK_DATE]: "   " } }), NOTICE_KEY_PACK_DATE);
    expect(r.state).toBe("DISCLOSED_DEFAULT");
  });
});

describe("② REFERENCED 와 DISCLOSED_DEFAULT 는 payload 가 같고 «상태가 다르다»", () => {
  it("셀러가 고른 참조는 SELLER_REFERENCED 다", () => {
    const r = resolveChannelNoticeField(override({ referenced: [NOTICE_KEY_RELEASE_DATE] }), NOTICE_KEY_RELEASE_DATE);
    expect(r).toEqual({ outgoing: DETAIL_PAGE_REFERENCE_TEXT, state: "SELLER_REFERENCED" });
  });

  it("아무것도 안 하면 DISCLOSED_DEFAULT 다", () => {
    const r = resolveChannelNoticeField(undefined, NOTICE_KEY_RELEASE_DATE);
    expect(r).toEqual({ outgoing: DETAIL_PAGE_REFERENCE_TEXT, state: "DISCLOSED_DEFAULT" });
  });

  it("🔴 두 상태의 payload 는 «같다» — 그래서 상태로만 구분할 수 있어야 한다", () => {
    const chosen = resolveChannelNoticeField(override({ referenced: [NOTICE_KEY_PACK_DATE] }), NOTICE_KEY_PACK_DATE);
    const defaulted = resolveChannelNoticeField({}, NOTICE_KEY_PACK_DATE);
    expect(chosen.outgoing).toBe(defaulted.outgoing);
    expect(chosen.state).not.toBe(defaulted.state);
    expect(isSellerDecidedNoticeState(chosen.state)).toBe(true);
    expect(isSellerDecidedNoticeState(defaulted.state)).toBe(false);
  });

  it("🔴 DISCLOSED_DEFAULT 는 «저장되지 않는다» — 빈 override 와 부재가 같은 결과다", () => {
    /* 저장 구조에 이 상태를 담는 칸이 없다는 것을 계약으로 고정한다. 담기면
       SELLER_REFERENCED 와 구분할 수 없게 되고, 왕복에서 구분이 사라진다. */
    expect(resolveChannelNoticeField({}, NOTICE_KEY_PACK_DATE).state).toBe("DISCLOSED_DEFAULT");
    expect(resolveChannelNoticeField(undefined, NOTICE_KEY_PACK_DATE).state).toBe("DISCLOSED_DEFAULT");
    expect(resolveChannelNoticeField({ values: {}, referenced: [] }, NOTICE_KEY_PACK_DATE).state).toBe(
      "DISCLOSED_DEFAULT",
    );
  });
});

describe("③ outgoing 은 어떤 상태에서도 비지 않는다", () => {
  const cases: (ChannelNoticeOverride | undefined)[] = [
    undefined,
    {},
    { values: {} },
    { referenced: [] },
    { values: { [NOTICE_KEY_PACK_DATE]: "" } },
    { values: { [NOTICE_KEY_PACK_DATE]: "  " } },
    { referenced: [NOTICE_KEY_PACK_DATE] },
    { values: { [NOTICE_KEY_PACK_DATE]: "2025-03" } },
    { values: { 다른칸: "값" } },
  ];

  it("🔴 WEAR 제조연월 — 아홉 가지 상태 전부에서 비지 않는다", () => {
    for (const c of cases) {
      const r = resolveChannelNoticeField(c, NOTICE_KEY_PACK_DATE);
      expect(r.outgoing.trim(), `상태가 비었다: ${JSON.stringify(c)}`).not.toBe("");
    }
  });

  it("🔴 KIDS 출시연월도 같다", () => {
    for (const c of cases) {
      expect(resolveChannelNoticeField(c, NOTICE_KEY_RELEASE_DATE).outgoing.trim()).not.toBe("");
    }
  });

  it("🔴 날짜를 지어내지 않는다 — 폴백은 «언제나» 참조 문구다", () => {
    const r = resolveChannelNoticeField(undefined, NOTICE_KEY_PACK_DATE);
    expect(r.outgoing).toBe(DETAIL_PAGE_REFERENCE_TEXT);
    expect(r.outgoing).not.toMatch(/\d{4}/);
  });
});

describe("④ 필수 여부 — 확인된 것과 «모르는 것» 을 가른다", () => {
  it("WEAR 제조연월은 필수임이 «확인됐다»(attempt 6 NotEmpty)", () => {
    expect(NAVER_NOTICE_REQUIRED_CONFIRMED[NOTICE_KEY_PACK_DATE]).toBe(true);
  });

  it("🔴 KIDS 출시연월은 UNKNOWN 이다 — 「선택」이 아니다", () => {
    /* false 는 「선택 항목」이 아니라 「확인되지 않았다」다. 이 칸이 true 로 바뀌려면
       빼고 등록해서 거부를 받아야 하고, 그건 별도 승인 사안이다. */
    expect(NAVER_NOTICE_REQUIRED_CONFIRMED[NOTICE_KEY_RELEASE_DATE]).toBe(false);
  });

  it("모른다고 해서 비우지 않는다", () => {
    expect(resolveChannelNoticeField(undefined, NOTICE_KEY_RELEASE_DATE).outgoing).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });
});

describe("⑤ 키는 payload 필드명이 아니라 «의미» 다", () => {
  it("packDateText / releaseDateText 를 키로 쓰지 않는다", () => {
    /* 저장 구조가 채널 payload 필드명을 알면, 네이버가 이름을 바꾸는 날 저장된
       셀러 입력이 고아가 된다. */
    expect(NOTICE_KEY_PACK_DATE).toBe("packDate");
    expect(NOTICE_KEY_RELEASE_DATE).toBe("releaseDate");
  });

  it("모르는 키는 기본값으로 떨어진다 — 예외를 던지지 않는다", () => {
    expect(resolveChannelNoticeField({}, "존재하지않는칸").state).toBe("DISCLOSED_DEFAULT");
  });
});
