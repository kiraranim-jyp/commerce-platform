import { describe, expect, it } from "vitest";
import {
  CACHE_TTL_BY_STATUS,
  SEARCH_INTEREST_OK_TTL_MS,
  isSearchInterestCacheFresh,
} from "../market-signals-cache-policy";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * P-30(CPO 지시, 2026-09-03) — 기존 구조는 API 실패 결과(null)까지 정상
 * 데이터와 똑같이 7일 캐싱했다. 일시적 오류 한 번이 "확인 불가"를 일주일간
 * 고정시키고, 원인을 고쳐도 캐시가 재확인을 막던 문제를 회귀 방지한다.
 */
describe("isSearchInterestCacheFresh — 정상 데이터는 기존 7일 전략 유지", () => {
  it("OK는 7일 직전까지 유효하고 7일이 지나면 만료된다", () => {
    const value = { ratio: 42, keyword: "Bobo Choses", status: "OK" as const };
    expect(isSearchInterestCacheFresh(value, 6 * DAY)).toBe(true);
    expect(isSearchInterestCacheFresh(value, SEARCH_INTEREST_OK_TTL_MS)).toBe(false);
  });
});

describe("isSearchInterestCacheFresh — 실패는 정상 데이터와 같은 수명으로 굳지 않는다", () => {
  it("핵심 회귀 방지: 모든 실패 상태의 TTL은 정상(7일)보다 짧다", () => {
    for (const status of ["NO_DATA", "AUTH_ERROR", "REQUEST_ERROR", "TRANSIENT_ERROR", "NOT_CONFIGURED"] as const) {
      expect(CACHE_TTL_BY_STATUS[status]).toBeLessThan(SEARCH_INTEREST_OK_TTL_MS);
    }
  });

  it("일시적 오류(TRANSIENT_ERROR)는 30분 뒤 다시 시도할 수 있다 — 7일간 고정되지 않는다", () => {
    const value = { ratio: null, keyword: "Bobo Choses", status: "TRANSIENT_ERROR" as const };
    expect(isSearchInterestCacheFresh(value, 10 * 60 * 1000)).toBe(true); // 10분 — 반복 호출은 막는다
    expect(isSearchInterestCacheFresh(value, 31 * 60 * 1000)).toBe(false); // 30분 초과 — 재시도 허용
    expect(isSearchInterestCacheFresh(value, 6 * DAY)).toBe(false); // 구 정책이면 true였다
  });

  it("인증/요청 오류는 6시간 동안 반복 호출을 막지만 하루를 기다리게 하지는 않는다", () => {
    for (const status of ["AUTH_ERROR", "REQUEST_ERROR"] as const) {
      const value = { ratio: null, keyword: "Bobo Choses", status };
      expect(isSearchInterestCacheFresh(value, 5 * HOUR)).toBe(true);
      expect(isSearchInterestCacheFresh(value, 7 * HOUR)).toBe(false);
    }
  });

  it("NO_DATA는 실패가 아니라 사실이므로 1일 유지하되 7일까지 굳히지는 않는다", () => {
    const value = { ratio: null, keyword: "Bobo Choses", status: "NO_DATA" as const };
    expect(isSearchInterestCacheFresh(value, 12 * HOUR)).toBe(true);
    expect(isSearchInterestCacheFresh(value, DAY + 1)).toBe(false);
  });

  it("NOT_CONFIGURED는 외부 호출을 하지 않은 상태라 캐시로 인정하지 않는다", () => {
    const value = { ratio: null, keyword: "Bobo Choses", status: "NOT_CONFIGURED" as const };
    expect(isSearchInterestCacheFresh(value, 0)).toBe(false);
  });
});

describe("isSearchInterestCacheFresh — P-30 이전에 저장된 legacy 행 호환", () => {
  it("status가 없고 ratio가 숫자면 정상 조회 결과가 분명하므로 7일 TTL을 인정한다", () => {
    const legacy = { ratio: 37, keyword: "Bobo Choses" };
    expect(isSearchInterestCacheFresh(legacy, 3 * DAY)).toBe(true);
    expect(isSearchInterestCacheFresh(legacy, 8 * DAY)).toBe(false);
  });

  it("status가 없고 ratio가 null인 행은 원인 불명이므로 신뢰하지 않고 즉시 만료 처리한다(수동 DB 삭제 불필요)", () => {
    const poisoned = { ratio: null, keyword: "Bobo Choses" };
    expect(isSearchInterestCacheFresh(poisoned, 0)).toBe(false);
    expect(isSearchInterestCacheFresh(poisoned, 1000)).toBe(false);
  });
});
