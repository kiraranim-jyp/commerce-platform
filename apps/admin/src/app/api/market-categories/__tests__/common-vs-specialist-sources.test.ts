import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_PROFILE_LIST, selectedMarketSourceScopes, sourceFitsScopes } from "@commerce/category";
import { isCollectableAccess } from "../../comparison-shops/_lib/comparison-shop";
import { isBatchSurveyTarget } from "../../price-history/_lib/run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO-TENNIS-MARKET-SOURCE-02 — **공통 가격비교 / 카테고리별 전문** 분리
 * ════════════════════════════════════════════════════════════════════════════
 *
 *                      시장조사 소스
 *                           │
 *               ┌───────────┴───────────┐
 *         공통 가격비교              전문 조사
 *       category_scope = '{}'    category_scope = ['TENNIS'] …
 *
 * 🔴 「테니스니까 테니스 사이트만 본다」가 아니다. 테니스 상품도 국내 전체
 * 가격비교 + 해외 가격비교 + 테니스 전문 소스를 «함께» 조사해야 한다.
 *
 * 🔴 이 파일은 **DB 없이 검증 가능한 것만** 잰다. 「Production 화면에 몇 개가
 * 보이는가」는 DB 상태에 달렸고 CTO 는 그것을 읽을 수 없다 — 그 부분은 §H 로
 * 올렸다. 여기서 고정하는 것은 «필터 계약» 이다.
 */
const ROOT = join(__dirname, "../../../../..");
const SQL_072 = readFileSync(
  join(ROOT, "../../packages/database/prisma/migrations_manual/072_domestic_common_comparison_sites_seed.sql"),
  "utf8",
);
/**
 * SQL 주석을 벗긴 판. 이 파일의 주석에는 설명을 위해 array['GOLF'] ·
 * AUTO_SCRAPE · 'OK' · 사이트 이름이 여러 번 나온다. 벗기지 않고 검사했다가
 * 세 단정이 거짓 실패했다 — 이 저장소에서 아홉 번째로 걸린 함정이다.
 * 「무엇을 넣었는가」는 «문장» 으로만 센다.
 */
const SPLIT_NL = String.fromCharCode(10);
const SQL_ONLY = SQL_072.split(SPLIT_NL)
  .filter((l) => !l.trimStart().startsWith("--"))
  .join(SPLIT_NL);

/** 소스 한 행의 최소 모양 — 네 축을 따로 갖는다. */
const src = (over: Partial<Parameters<typeof isBatchSurveyTarget>[0]> = {}) => ({
  enabled: true,
  status: "ACTIVE" as const,
  accessStatus: null,
  categoryScope: [] as string[],
  ...over,
});

const ALL_PROFILE_IDS = CATEGORY_PROFILE_LIST.map((p) => p.id);

describe("① 🔴 공통 소스는 «모든» 카테고리에서 걸린다", () => {
  it.each(ALL_PROFILE_IDS)("category_scope=[] 가 %s 에서 통과한다", (id) => {
    expect(sourceFitsScopes([], selectedMarketSourceScopes(id))).toBe(true);
  });

  it("🔴 그래서 공통 사이트를 카테고리마다 «중복 등록하지 않는다»", () => {
    /* 한 행이 일곱 카테고리를 모두 덮는다 — 카테고리가 늘어도 행이 늘지 않는다. */
    const covered = ALL_PROFILE_IDS.filter((id) => sourceFitsScopes([], selectedMarketSourceScopes(id)));
    expect(covered).toHaveLength(ALL_PROFILE_IDS.length);
    /* 실측 6개다. 처음에 7 로 적었는데 MATERNITY 는 «하위 갈래» 라
       CATEGORY_PROFILE_LIST 에 없다. 숫자를 지어내지 않고 실제 목록을 쓴다. */
    expect(ALL_PROFILE_IDS.length).toBe(6);
    expect(ALL_PROFILE_IDS).toContain("TENNIS");
  });
});

describe("② 🔴 전문 소스는 자기 카테고리 «밖에서 빠진다»", () => {
  it("TENNIS 전용은 TENNIS 에서만 걸린다", () => {
    for (const id of ALL_PROFILE_IDS) {
      const fits = sourceFitsScopes(["TENNIS"], selectedMarketSourceScopes(id));
      expect(fits, `${id}`).toBe(id === "TENNIS");
    }
  });

  it("🔴 반대 방향 — KIDS_FASHION 전용이 TENNIS 조사에 섞이지 않는다", () => {
    expect(sourceFitsScopes(["KIDS_FASHION"], selectedMarketSourceScopes("TENNIS"))).toBe(false);
  });

  it("🔴 GOLF 전용(다나와·네이버쇼핑의 현재 scope)이 TENNIS 에서 빠진다", () => {
    /* 이것이 TENNIS 가 「준비중」인 실제 원인이다 — 052 가 둘을 array['GOLF'] 로
       넣었고, 공통('{}') 국내 행이 0개였다(053 실측: KIDS_FASHION 16 · GOLF 2). */
    expect(sourceFitsScopes(["GOLF"], selectedMarketSourceScopes("TENNIS"))).toBe(false);
  });

  it("복수 연결은 양쪽에서 걸린다 — ['TENNIS','GOLF']", () => {
    expect(sourceFitsScopes(["TENNIS", "GOLF"], selectedMarketSourceScopes("TENNIS"))).toBe(true);
    expect(sourceFitsScopes(["TENNIS", "GOLF"], selectedMarketSourceScopes("GOLF"))).toBe(true);
    expect(sourceFitsScopes(["TENNIS", "GOLF"], selectedMarketSourceScopes("KIDS_FASHION"))).toBe(false);
  });
});

describe("③ 🔴 카테고리 연결이 「활성」이나 「조사 가능」을 뜻하지 않는다 — 네 축이 따로다", () => {
  const scopes = selectedMarketSourceScopes("TENNIS");

  it("공통 scope 라도 enabled=false 면 조사 대상이 아니다", () => {
    expect(isBatchSurveyTarget(src({ enabled: false }), scopes)).toBe(false);
  });

  it("공통 scope 라도 status!=ACTIVE 면 제외된다", () => {
    for (const status of ["PAUSED", "NOT_AVAILABLE", "ERROR"] as const) {
      expect(isBatchSurveyTarget(src({ status }), scopes), status).toBe(false);
    }
  });

  it("🔴 접근 차단 상태는 카테고리가 맞아도 제외된다", () => {
    for (const a of ["BLOCKED", "LOGIN_REQUIRED", "API_DISCONTINUED"] as const) {
      expect(isCollectableAccess(a), a).toBe(false);
      expect(isBatchSurveyTarget(src({ accessStatus: a }), scopes), a).toBe(false);
    }
  });

  it("🔴 null(확인 안 함)은 통과한다 — 막으면 기존 조사가 통째로 멈춘다", () => {
    expect(isCollectableAccess(null)).toBe(true);
    expect(isBatchSurveyTarget(src({ accessStatus: null }), scopes)).toBe(true);
  });

  it("네 축이 모두 맞을 때만 조사 대상이다", () => {
    expect(isBatchSurveyTarget(src(), scopes)).toBe(true);
  });
});

describe("④ 🔴 072 시드 — 공통으로 넣고, 「자동 수집」을 주장하지 않는다", () => {
  it("두 사이트를 공통(category_scope='{}')으로 넣는다", () => {
    expect(SQL_ONLY).toContain("'에누리', 'enuri.com'");
    expect(SQL_ONLY).toContain("'카카오 쇼핑하우', 'shoppinghow.kakao.com'");
    /* 🔴 카테고리 ID 를 적지 않는다 — '{}' 는 「전부」다. */
    expect(SQL_ONLY).not.toContain("array[");
    expect(SQL_ONLY).toContain("'{}', 'P0'");
    expect(SQL_ONLY).toContain("'{}', 'P1'");
  });

  it("🔴 자동 파서가 없으므로 MANUAL 이다 — ACTIVE 가 「수집 가능」을 뜻하지 않는다", () => {
    expect(SQL_ONLY).toContain("'MANUAL', 'ACTIVE'");
    expect(SQL_ONLY).not.toContain("'AUTO_SCRAPE'");
    expect(SQL_ONLY).not.toContain("'AUTO_API'");
  });

  it("🔴 MANUAL 은 실제 수집에서 «구조적으로» 빠진다 — 위장이 아니다", () => {
    const crawler = readFileSync(join(ROOT, "../../packages/crawler/src/comparison-search/index.ts"), "utf8");
    expect(crawler).toContain('source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE"');
  });

  it("🔴 access_status 를 'OK' 로 «위장하지 않는다» — 열어 본 적이 없다", () => {
    expect(SQL_ONLY).not.toContain("'OK',");
    expect(SQL_ONLY).toContain("«미확인»");
  });

  it("🔴 기존 행을 UPDATE/DELETE 하지 않는다 — insert 하나뿐이다", () => {
    expect(SQL_ONLY).not.toMatch(/\bupdate\s+domestic_price_sources/i);
    expect(SQL_ONLY).not.toMatch(/\bdelete\s+from/i);
    expect((SQL_ONLY.match(/\binsert into\b/gi) ?? []).length).toBe(1);
    expect(SQL_ONLY).toContain("on conflict do nothing");
  });

  it("🔴 다나와·네이버 쇼핑을 다시 넣지 않는다 — 중복 INSERT 금지", () => {
    expect(SQL_ONLY).not.toContain("danawa.com");
    expect(SQL_ONLY).not.toContain("shopping.naver.com");
  });

  it("🔴 해외 표를 건드리지 않는다 — 070 의 다섯 행은 그대로다", () => {
    expect(SQL_ONLY).not.toContain("comparison_shops");
  });

  it("🔴 판매채널을 조사 소스로 넣지 않는다", () => {
    for (const channel of ["coupang", "smartstore", "11st", "gmarket", "lotteon", "musinsa"]) {
      expect(SQL_ONLY.toLowerCase(), channel).not.toContain(channel);
    }
  });

  it("가격비교 매체로 분류한다 — 판매처·수요데이터가 아니다", () => {
    expect(SQL_ONLY).toContain("'PRICE_COMPARISON'");
    expect(SQL_ONLY).not.toContain("'PRICE_COLLECTION'");
    expect(SQL_ONLY).not.toContain("'DEMAND_DATA'");
  });
});

describe("⑤ 🔴 근거 없는 사이트는 «등록하지 않았다»", () => {

  it("트렌비를 넣지 않았다 — 어느 카테고리를 다루는지 확인 기록이 없다", () => {
    expect(SQL_ONLY).not.toContain("트렌비");
    expect(SQL_ONLY.toLowerCase()).not.toContain("trenbe");
    /* 그리고 그 «이유» 는 주석에 적혀 있다 — 그래서 원문(SQL_072)으로 본다.
       등록 여부는 문장(SQL_ONLY)으로, 판단 근거는 주석으로 확인한다. */
    expect(SQL_072).toContain("트렌비");
    expect(SQL_072).toContain("임의 결정");
  });

  it("테니스맨션을 넣지 않았다 — 도메인이 저장소에 없다", () => {
    expect(SQL_ONLY).not.toContain("테니스맨션");
    expect(SQL_072).toContain("도메인을 지어내지 않는다");
  });

  it("🔴 존재하지 않는 카테고리를 만들지 않았다", () => {
    /* 프로필에 실제로 있는 ID 만 어휘로 쓸 수 있다. */
    const ids = new Set(ALL_PROFILE_IDS as string[]);
    for (const m of SQL_072.matchAll(/array\['([A-Z_]+)'/g)) {
      expect(ids.has(m[1]) || m[1] === "KIDS_GOODS", m[1]).toBe(true);
    }
  });
});

describe("⑥ 🔴 TENNIS 는 자동 감지 대상이 아니다 — 셀러가 고른다", () => {
  it("scope 어휘가 프로필 id 와 같다", () => {
    expect(selectedMarketSourceScopes("TENNIS")).toEqual(["TENNIS"]);
  });

  it("일곱 프로필이 모두 자기 scope 를 갖는다", () => {
    for (const id of ALL_PROFILE_IDS) {
      const scopes = selectedMarketSourceScopes(id);
      expect(scopes, id).not.toBeNull();
      expect(scopes!.length, id).toBeGreaterThan(0);
    }
  });
});

describe("⑦ 🔴 해외 공통 5개는 «적용해도 표시되지 않는다» — is_active=false", () => {
  const SQL_070 = readFileSync(
    join(ROOT, "../../packages/database/prisma/migrations_manual/070_global_comparison_sites_seed.sql"),
    "utf8",
  );
  const SQL_070_ONLY = SQL_070.split(SPLIT_NL)
    .filter((l) => !l.trimStart().startsWith("--"))
    .join(SPLIT_NL);

  /* 🔴 「해외 기존 공통 5개가 표시되어야 한다」는 기대가 현재 코드에서 성립하지
     않는다. 070 이 다섯 행을 전부 is_active=false 로 넣었고, market-categories
     의 overseasSourceCount 는 s.isActive 를 «먼저» 본다. 070 자신이 그 이유를
     적어 뒀다: 파서가 없는 사이트를 「수집 가능」으로 표시하지 않는다.
     이 테스트는 그 사실을 고정해서, 보고가 추측이 아니라 코드 근거가 되게 한다. */
  it("070 의 다섯 행이 모두 is_active=false 다", () => {
    const actives = SQL_070_ONLY.match(/'SYSTEM', (true|false)/g) ?? [];
    expect(actives).toHaveLength(5);
    expect(new Set(actives)).toEqual(new Set(["'SYSTEM', false"]));
  });

  it("🔴 해외 카운트가 isActive 를 먼저 본다 — 그래서 켜기 전엔 0 이다", () => {
    const route = readFileSync(join(__dirname, "../route.ts"), "utf8");
    expect(route).toContain("overseasSourceCount: shops.filter(");
    expect(route).toContain("(s) => s.isActive && isCollectableAccess(s.accessStatus)");
  });

  it("🔴 「선택 가능」은 «국내» 카운트로만 결정된다 — 해외는 영향이 없다", () => {
    const route = readFileSync(join(__dirname, "../route.ts"), "utf8");
    expect(route).toContain("available: catalogSourceCount > 0");
    expect(route).not.toContain("available: overseasSourceCount");
    expect(route).not.toContain("catalogSourceCount + overseasSourceCount");
  });

  it("🔴 072 가 해외를 켜지 «않았다» — 그 결정은 CEO 몫이다", () => {
    expect(SQL_ONLY).not.toMatch(/is_active\s*=\s*true/i);
    expect(SQL_ONLY).not.toContain("setComparisonShopActive");
  });
});
