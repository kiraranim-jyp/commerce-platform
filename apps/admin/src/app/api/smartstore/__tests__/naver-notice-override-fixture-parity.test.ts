import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DETAIL_PAGE_REFERENCE_TEXT,
  NOTICE_KEY_PACK_DATE,
  NOTICE_KEY_RELEASE_DATE,
  resolveChannelNoticeField,
} from "@commerce/listing";
import type { ChannelNoticeOverride } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NAVER-CHANNEL-NOTICE-OVERRIDES-03 — **회귀 기준은 실제 성공 payload 다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 회귀 기준으로 `golden-success-01/02` 를 지정했다. 그래서 값을 손으로
 * 다시 적지 않고 **fixture 원문을 읽어서** 대조한다 — 손으로 적으면 「내가 상상한
 * 성공 payload」와 비교하는 것이 되고, 이 저장소가 이미 두 번 걸린 함정이다.
 *
 * 🔴 이 파일이 고정하는 명제 하나: **셀러가 아무것도 하지 않으면 payload 가
 * 바뀌지 않는다.** 그것이 이 스프린트의 안전장치 전부다. 화면이 새 말을 하게
 * 됐지만 채널에 나가는 바이트는 그대로다.
 *
 * 두 fixture 는 실제 HTTP 200 SUBMITTED 를 받은 등록이다:
 *   golden-success-01      WEAR  · packDateText
 *   golden-success-02-kids KIDS  · releaseDateText
 */

function fixture(name: string): Record<string, unknown> {
  const url = new URL(`../../../../../fixtures/smartstore/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as Record<string, unknown>;
}

function noticeOf(name: string): Record<string, Record<string, string>> {
  const raw = fixture(name);
  const payload = raw.finalPayload as Record<string, unknown>;
  return payload.productInfoProvidedNotice as Record<string, Record<string, string>>;
}

const WEAR_NOTICE = noticeOf("golden-success-01.json");
const KIDS_NOTICE = noticeOf("golden-success-02-kids.json");

describe("fixture 원문이 실제로 이 값을 담고 있다 (대조군)", () => {
  it("🔴 fixture 를 읽지 못하면 아래 대조가 무의미하다 — 먼저 확인한다", () => {
    expect(WEAR_NOTICE.productInfoProvidedNoticeType as unknown).toBe("WEAR");
    expect(KIDS_NOTICE.productInfoProvidedNoticeType as unknown).toBe("KIDS");
    expect(WEAR_NOTICE.wear.packDateText).toBeTruthy();
    expect(KIDS_NOTICE.kids.releaseDateText).toBeTruthy();
  });
});

describe("① 셀러가 아무것도 하지 않으면 기존 성공 payload 와 «동일» 하다", () => {
  const untouched: ChannelNoticeOverride | undefined = undefined;

  it("WEAR packDateText — fixture 값과 같다", () => {
    expect(resolveChannelNoticeField(untouched, NOTICE_KEY_PACK_DATE).outgoing).toBe(WEAR_NOTICE.wear.packDateText);
  });

  it("KIDS releaseDateText — fixture 값과 같다", () => {
    expect(resolveChannelNoticeField(untouched, NOTICE_KEY_RELEASE_DATE).outgoing).toBe(
      KIDS_NOTICE.kids.releaseDateText,
    );
  });

  it("빈 override 객체(backfill 직후 상태)에서도 같다", () => {
    expect(resolveChannelNoticeField({}, NOTICE_KEY_PACK_DATE).outgoing).toBe(WEAR_NOTICE.wear.packDateText);
    expect(resolveChannelNoticeField({}, NOTICE_KEY_RELEASE_DATE).outgoing).toBe(KIDS_NOTICE.kids.releaseDateText);
  });

  it("🔴 그 값이 「상품 상세페이지 참조」임을 fixture 가 증언한다", () => {
    /* 우리가 그 문구를 새로 만든 것이 아니라는 것을 fixture 로 고정한다. */
    expect(WEAR_NOTICE.wear.packDateText).toBe(DETAIL_PAGE_REFERENCE_TEXT);
    expect(KIDS_NOTICE.kids.releaseDateText).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });
});

describe("② 셀러가 실제 연월을 적으면 그 값이 fixture 값을 «대체» 한다", () => {
  it("WEAR — 적은 값이 나가고 참조 문구는 나가지 않는다", () => {
    const out = resolveChannelNoticeField({ values: { [NOTICE_KEY_PACK_DATE]: "2025-03" } }, NOTICE_KEY_PACK_DATE);
    expect(out.outgoing).toBe("2025-03");
    expect(out.outgoing).not.toBe(WEAR_NOTICE.wear.packDateText);
  });

  it("KIDS — 같다", () => {
    const out = resolveChannelNoticeField(
      { values: { [NOTICE_KEY_RELEASE_DATE]: "2024-09" } },
      NOTICE_KEY_RELEASE_DATE,
    );
    expect(out.outgoing).toBe("2024-09");
  });
});

describe("③ 다른 고시 칸은 이 경로가 «건드리지 않는다»", () => {
  it("🔴 fixture 의 나머지 칸이 override 와 무관하다 — 키가 겹치지 않는다", () => {
    /* `material`/`color` 등은 공통 화이트리스트(resolveNoticeFieldValue) 경로다.
       이 override 의 키(`packDate`/`releaseDate`)가 그 이름들과 겹치면 두 경로가
       서로를 덮는다. 겹치지 않음을 고정한다. */
    const overrideKeys = [NOTICE_KEY_PACK_DATE, NOTICE_KEY_RELEASE_DATE];
    for (const key of Object.keys(WEAR_NOTICE.wear)) expect(overrideKeys).not.toContain(key);
    for (const key of Object.keys(KIDS_NOTICE.kids)) expect(overrideKeys).not.toContain(key);
  });
});
