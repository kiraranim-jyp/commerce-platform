import { describe, expect, it } from "vitest";
import { isBatchSurveyTarget } from "../run-domestic-price-check";
import { isCollectableAccess } from "../../../comparison-shops/_lib/comparison-shop";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * BATCH-ACCESS-FILTER-01 — 배치 조사 대상에서 «막힌 사이트» 를 뺀다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 라이브 검색(search/route.ts:187)은 isCollectableAccess 를 보는데 배치
 * (run-domestic-price-check:434)는 «보지 않았다». 그래서 BLOCKED·LOGIN_REQUIRED·
 * API_DISCONTINUED 사이트를 매일 계속 두드렸다 — comparison-shop.ts:50 이
 * 「막힌 사이트를 반복 호출하지 않는다(CEO 명시)」고 적어 둔 약속을 어긴 자리다.
 *
 * 🔴 이 테스트는 조건을 «베껴 쓰지» 않는다. isBatchSurveyTarget 을 직접 부른다 —
 * replica 를 만들면 원본이 바뀔 때 조용히 거짓이 된다(이 저장소가 반복해서
 * 겪은 함정).
 */
type Src = Parameters<typeof isBatchSurveyTarget>[0];

const source = (over: Partial<Src> = {}): Src => ({
  enabled: true,
  status: "ACTIVE",
  accessStatus: null,
  categoryScope: [],
  ...over,
});

describe("① 🔴 접근이 막힌 사이트는 배치 대상에서 빠진다", () => {
  for (const blocked of ["BLOCKED", "LOGIN_REQUIRED", "API_DISCONTINUED"] as const) {
    it(`${blocked} 는 제외된다 — status 가 ACTIVE 여도`, () => {
      expect(isBatchSurveyTarget(source({ accessStatus: blocked }), null)).toBe(false);
    });
  }

  it("🔴 ACTIVE 만으로 접근 불가 사이트가 다시 포함되지 않는다", () => {
    /* 이것이 결함의 모양이었다 — enabled·status·scope 는 통과하는데 접근이 막힌 행. */
    const blockedButActive = source({ accessStatus: "BLOCKED", enabled: true, status: "ACTIVE" });
    expect(isBatchSurveyTarget(blockedButActive, null)).toBe(false);
  });
});

describe("② 🔴 null·OK 는 «그대로 통과» 한다 — 기존 계약을 바꾸지 않았다", () => {
  it("null(확인 안 함)은 통과한다", () => {
    /* 053 실측 분포: 국내 access_status 는 null 16 · OK 1 · LOGIN_REQUIRED 1.
       null 을 막으면 국내 조사가 «통째로» 멈춘다. */
    expect(isBatchSurveyTarget(source({ accessStatus: null }), null)).toBe(true);
  });

  it("undefined 도 통과한다 — 마이그레이션 미실행 세션", () => {
    expect(isBatchSurveyTarget(source({ accessStatus: undefined as never }), null)).toBe(true);
  });

  it("OK 는 통과한다", () => {
    expect(isBatchSurveyTarget(source({ accessStatus: "OK" }), null)).toBe(true);
  });

  it("🔴 판정이 공통 함수와 «완전히 같다» — 여기서 정책을 다시 만들지 않았다", () => {
    for (const st of ["OK", "BLOCKED", "LOGIN_REQUIRED", "API_DISCONTINUED", null, undefined] as const) {
      expect(isBatchSurveyTarget(source({ accessStatus: st as never }), null), String(st)).toBe(
        isCollectableAccess(st),
      );
    }
  });

  it("타입에 \"UNKNOWN\" 이라는 값은 «없다» — null 이 그 자리다", () => {
    /* CPO 가 물은 UNKNOWN 은 MarketSourceAccessStatus 에 존재하지 않는다.
       존재하지 않는 값을 넣어도 공통 함수는 「막힌 셋」이 아니므로 통과한다. */
    expect(isCollectableAccess("UNKNOWN" as never)).toBe(true);
    expect(isBatchSurveyTarget(source({ accessStatus: "UNKNOWN" as never }), null)).toBe(true);
  });
});

describe("③ 다른 필터는 그대로다 (회귀)", () => {
  it("enabled=false 는 제외된다", () => {
    expect(isBatchSurveyTarget(source({ enabled: false }), null)).toBe(false);
  });

  for (const st of ["PAUSED", "NOT_AVAILABLE", "ERROR"] as const) {
    it(`status=${st} 는 제외된다`, () => {
      expect(isBatchSurveyTarget(source({ status: st }), null)).toBe(false);
    });
  }

  it("카테고리 범위가 어긋나면 제외된다", () => {
    expect(isBatchSurveyTarget(source({ categoryScope: ["KIDS_FASHION"] }), ["TENNIS"])).toBe(false);
  });

  it("카테고리 범위가 맞으면 통과한다", () => {
    expect(isBatchSurveyTarget(source({ categoryScope: ["KIDS_FASHION"] }), ["KIDS_FASHION"])).toBe(true);
  });

  it("범위를 못 정하면(null) 필터가 걸리지 않는다 — 기존 동작 그대로", () => {
    expect(isBatchSurveyTarget(source({ categoryScope: ["KIDS_FASHION"] }), null)).toBe(true);
  });

  it("빈 배열 scope 는 여전히 전 카테고리 통과다 — 029 하위호환을 건드리지 않았다", () => {
    expect(isBatchSurveyTarget(source({ categoryScope: [] }), ["TENNIS"])).toBe(true);
  });
});

describe("④ 🔴 이 변경으로 «실제로» 빠지는 행 — 현재 데이터 기준", () => {
  /* 053:30 이 적어 둔 실측 분포로 재현한다:
       국내 18행 = null 16 · OK 1(다나와) · LOGIN_REQUIRED 1(네이버 쇼핑)
     그리고 네이버 쇼핑은 052 에서 status='NOT_AVAILABLE' 이다. */
  const beforeFix = (s: Src, scopes: string[] | null) =>
    s.enabled && s.status === "ACTIVE" && ["KIDS_FASHION"].length >= 0 && sourceFitsScopesShim(s, scopes);
  function sourceFitsScopesShim(s: Src, scopes: string[] | null): boolean {
    if (!scopes || scopes.length === 0) return true;
    if (s.categoryScope.length === 0) return true;
    return s.categoryScope.some((x) => scopes.includes(x));
  }

  const catalog: Src[] = [
    ...Array.from({ length: 16 }, () => source({ accessStatus: null })),
    source({ accessStatus: "OK" }), // 다나와
    source({ accessStatus: "LOGIN_REQUIRED", status: "NOT_AVAILABLE" }), // 네이버 쇼핑
  ];

  it("🔴 변경 전후 대상 수가 «같다» — 이 수정은 방어선이고 즉시 줄어드는 행이 없다", () => {
    const before = catalog.filter((s) => beforeFix(s, null)).length;
    const after = catalog.filter((s) => isBatchSurveyTarget(s, null)).length;
    expect(before).toBe(17); // null 16 + OK 1 (네이버 쇼핑은 status 로 이미 빠짐)
    expect(after).toBe(before);
  });

  it("🔴 그래도 필요한 이유 — status 가 ACTIVE 인 채 BLOCKED 가 되면 전에는 통과했다", () => {
    const future = source({ accessStatus: "BLOCKED", status: "ACTIVE" });
    expect(beforeFix(future, null), "변경 전에는 매일 두드렸다").toBe(true);
    expect(isBatchSurveyTarget(future, null), "변경 후에는 빠진다").toBe(false);
  });
});
