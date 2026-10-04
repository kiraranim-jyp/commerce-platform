import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectedMarketSourceScopes, sourceFitsScopes } from "@commerce/category";
import { isCollectableAccess } from "../../comparison-shops/_lib/comparison-shop";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO-TENNIS-MARKET-SOURCE-03 — **두 숫자가 각각 무엇을 세는가** (CEO 지시 6·7)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 화면에서 본 「테니스 — 국내 1곳 · 해외 5곳」과 시장조사 화면의
 * 「조사 대상 N곳」은 **서로 다른 값** 이다. 코드 기준으로 가른다:
 *
 *   설정 화면   「국내 N곳」  catalogSourceCount
 *                 status='ACTIVE' ∧ isCollectableAccess ∧ sourceFitsScopes
 *                 ∧ catalogEnabled(운영자 전역 스위치)
 *
 *   설정 화면   「해외 N곳」  overseasSourceCount
 *                 isActive ∧ isCollectableAccess ∧ sourceFitsScopes
 *
 *   시장조사    「조사 대상 N곳」  sourceCount
 *                 위 국내 네 조건 + workspaceEnabled(이 셀러가 켰는지)
 *
 * 🔴 그래서 항상 `sourceCount <= catalogSourceCount` 다. 두 숫자가 다르면 버그가
 * 아니라 「운영자는 켰지만 이 셀러가 껐다」는 뜻이다.
 *
 * 🔴 그리고 `collection_strategy` 는 **두 숫자 어디에도 들어가지 않는다** —
 * 「목록에 있다」와 「자동으로 읽는다」가 다른 축이기 때문이다. 이 테스트가 그
 * 분리를 고정한다. 섞이면 MANUAL 사이트가 숫자에서 사라져 셀러는 「등록했는데
 * 왜 안 보이나」가 되고, 반대로 섞지 않으면서 라벨을 안 보여주면 「숫자는 3인데
 * 값이 안 나온다」가 된다.
 */
const HERE = __dirname;
const ROUTE = readFileSync(join(HERE, "../route.ts"), "utf8");
const SETTINGS = readFileSync(join(HERE, "../../../settings/page.tsx"), "utf8");
const PIPELINE = readFileSync(join(HERE, "../../../pipeline/page.tsx"), "utf8");
const SPLIT_NL = String.fromCharCode(10);
const sqlOnly = (rel: string) =>
  readFileSync(join(HERE, "../../../../../../../packages/database/prisma/migrations_manual/", rel), "utf8")
    .split(SPLIT_NL)
    .filter((l) => !l.trimStart().startsWith("--"))
    .join(SPLIT_NL);
const SQL_073_RAW = readFileSync(
  join(HERE, "../../../../../../../packages/database/prisma/migrations_manual/073_danawa_common_scope.sql"),
  "utf8",
);
const SQL_073 = sqlOnly("073_danawa_common_scope.sql");

describe("① 🔴 설정 화면의 「국내 N곳」 = catalogSourceCount", () => {
  it("그 자리에 그 값이 그려진다", () => {
    expect(SETTINGS).toContain("국내 {c.catalogSourceCount}곳 · 해외 {c.overseasSourceCount}곳");
  });

  it("catalogEnabled 는 «운영자 전역 스위치» 다 — 셀러 설정이 아니다", () => {
    const lib = readFileSync(join(HERE, "../../domestic-price-sources/_lib/domestic-price-source.ts"), "utf8");
    expect(lib).toContain("catalogEnabled: row.enabled");
    expect(lib).toContain("enabled: row.enabled && workspaceEnabled");
  });
});

describe("② 🔴 시장조사 화면의 「조사 대상 N곳」 = sourceCount", () => {
  it("그 자리에 그 값이 그려진다", () => {
    expect(PIPELINE).toContain("조사 대상 ${category.sourceCount}곳");
  });

  it("「준비중」은 available 로 갈린다", () => {
    expect(PIPELINE).toContain("준비중(조사 사이트 없음)");
    expect(PIPELINE).toContain("disabled={!category.available}");
  });

  it("🔴 available 은 «국내» 카탈로그 수로만 결정된다 — 해외는 영향이 없다", () => {
    expect(ROUTE).toContain("available: catalogSourceCount > 0");
  });
});

describe("③ 🔴 두 숫자의 포함 관계 — sourceCount <= catalogSourceCount", () => {
  it("같은 fitting 에서 각각 다른 플래그로 센다", () => {
    expect(ROUTE).toContain("sourceCount: fitting.filter((s) => s.enabled).length");
    expect(ROUTE).toContain("const catalogSourceCount = fitting.filter((s) => s.catalogEnabled).length");
  });

  it("🔴 enabled 가 catalogEnabled 의 «부분집합» 이다 — AND 로 합쳐져 있다", () => {
    const lib = readFileSync(join(HERE, "../../domestic-price-sources/_lib/domestic-price-source.ts"), "utf8");
    /* enabled = catalogEnabled && workspaceEnabled 이므로 enabled ⊆ catalogEnabled. */
    expect(lib).toContain("row.enabled && workspaceEnabled");
  });
});

describe("④ 🔴 collection_strategy 는 두 숫자에 «들어가지 않는다»", () => {
  it("라우트의 세 카운트 식에 collectionStrategy 가 없다", () => {
    const block = ROUTE.slice(ROUTE.indexOf("const fitting ="), ROUTE.indexOf("available:"));
    expect(block).not.toContain("collectionStrategy");
    expect(block).not.toContain("AUTO_SCRAPE");
    expect(block).not.toContain("MANUAL");
  });

  it("🔴 실제 수집은 «따로» 거른다 — AUTO 가 아니면 unsupported 다", () => {
    const crawler = readFileSync(
      join(HERE, "../../../../../../../packages/crawler/src/comparison-search/index.ts"),
      "utf8",
    );
    expect(crawler).toContain(
      'source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE"',
    );
  });

  it("화면이 그 축을 «라벨로» 보여 준다 — 숫자에 섞지 않고 따로 말한다", () => {
    expect(SETTINGS).toContain('MANUAL: "수동"');
    expect(SETTINGS).toContain('NOT_AVAILABLE: "수집 불가"');
  });

  it("🔴 「수집 불가」 라벨이 collection_strategy 에서 온다 — status 가 아니다", () => {
    /* CEO 화면에서 에누리가 「수집 불가」로 보인 근거다. 그 값은 072 가 넣은
       'MANUAL' 이 «아니다» → 그 행은 072 이전부터 있었고 on conflict 가 버렸다.
       🔴 처음에 선언부를 400자 앞에서 찾았는데 맵 이름이 달랐다 — 실제 이름은
       DOMESTIC_STRATEGY_LABEL 이고 키 타입이 collectionStrategy 다. */
    expect(SETTINGS).toContain(
      'const DOMESTIC_STRATEGY_LABEL: Record<DomesticPriceSource["collectionStrategy"], string>',
    );
    const decl = SETTINGS.slice(
      SETTINGS.indexOf("const DOMESTIC_STRATEGY_LABEL"),
      SETTINGS.indexOf("};", SETTINGS.indexOf("const DOMESTIC_STRATEGY_LABEL")),
    );
    expect(decl).toContain('NOT_AVAILABLE: "수집 불가"');
    expect(decl).toContain('MANUAL: "수동"');
    /* 🔴 status 라벨과 «다른» 맵이다 — 둘을 섞으면 원인을 잘못 읽는다. */
    expect(decl).not.toContain('ACTIVE:');
  });
});

describe("⑤ 🔴 073 — 다나와 «한 행» 만 바꾼다", () => {
  it("domain 으로 좁힌다 — scope 로 쓸어 담지 않는다", () => {
    expect(SQL_073).toContain("where domain = 'danawa.com'");
    /* 🔴 `where category_scope = array['GOLF']` 로 쓰면 네이버 쇼핑도 함께 바뀐다. */
    expect(SQL_073).not.toMatch(/where\s+category_scope/i);
  });

  it("category_scope 한 칸만 바꾸고 나머지는 건드리지 않는다", () => {
    expect(SQL_073).toContain("set category_scope = '{}'");
    /* 🔴 SET 절만 떼어 본다. 처음에 문장 전체에서 `collection_strategy =` 를
       찾았더니 **access_note 문자열 안의 설명 텍스트**("collection_strategy=MANUAL
       은 그대로")가 걸려 거짓 실패했다 — «바꾸는 칸» 과 «적어 두는 문장» 은 다르다. */
    const setClause = SQL_073.slice(SQL_073.indexOf("set "), SQL_073.indexOf(" where "))
      /* 🔴 SQL 문자열 리터럴을 벗긴다. access_note 에 넣는 «설명 문장» 안에
         "collection_strategy=MANUAL 은 그대로" 라는 글자가 있어서, 벗기지 않으면
         그 텍스트가 대입으로 잡힌다(두 번째 거짓 실패였다). `''` 이스케이프까지
         고려해 리터럴 전체를 지운다. */
      .replace(/'(?:[^']|'')*'/g, "''");
    const assigned = [...setClause.matchAll(/(?:^|\s)([a-z_]+)\s*=/g)].map((m) => m[1]);
    /* 대입은 정확히 셋이다: category_scope · access_note · updated_at. */
    expect([...new Set(assigned)].sort()).toEqual(["access_note", "category_scope", "updated_at"]);
    for (const col of ["access_status", "status", "collection_strategy", "enabled", "source_role"]) {
      expect(assigned, col).not.toContain(col);
    }
  });

  it("🔴 파서가 없으므로 AUTO 로 올리지 않았다", () => {
    expect(SQL_073).not.toContain("AUTO_API");
    expect(SQL_073).not.toContain("AUTO_SCRAPE");
  });

  it("🔴 에누리·카카오·네이버 쇼핑을 건드리지 않았다", () => {
    for (const d of ["enuri.com", "shoppinghow.kakao.com", "shopping.naver.com"]) {
      expect(SQL_073, d).not.toContain(d);
    }
  });

  it("🔴 insert·delete 가 없다 — update 하나뿐이다", () => {
    expect(SQL_073).not.toMatch(/\binsert\s+into\b/i);
    expect(SQL_073).not.toMatch(/\bdelete\s+from\b/i);
    expect((SQL_073.match(/\bupdate\s+domestic_price_sources\b/gi) ?? []).length).toBe(1);
  });

  it("🔴 해외 표를 건드리지 않았다", () => {
    expect(SQL_073).not.toContain("comparison_shops");
  });

  it("멱등이다 — 이미 공통이면 0행이 바뀐다", () => {
    expect(SQL_073).toContain("and category_scope <> '{}'");
  });
});

describe("⑥ 🔴 공통화로 «잃는 것이 없다» — 빈 배열은 OR 이다", () => {
  it("다나와가 GOLF 에서 빠지지 않는다", () => {
    /* array['GOLF'] → '{}' 는 「빼기」가 아니라 「전부에 더하기」다. */
    expect(sourceFitsScopes([], selectedMarketSourceScopes("GOLF"))).toBe(true);
    expect(sourceFitsScopes([], selectedMarketSourceScopes("TENNIS"))).toBe(true);
    expect(sourceFitsScopes([], selectedMarketSourceScopes("KIDS_FASHION"))).toBe(true);
  });

  it("그래서 기존 골프 조사 대상이 한 곳도 줄지 않는다", () => {
    const before = sourceFitsScopes(["GOLF"], selectedMarketSourceScopes("GOLF"));
    const after = sourceFitsScopes([], selectedMarketSourceScopes("GOLF"));
    expect(before).toBe(true);
    expect(after).toBe(true);
  });

  it("그 이유가 파일에 적혀 있다", () => {
    expect(SQL_073_RAW).toContain("잃는 것이 없다");
  });
});

describe("⑦ 🔴 네이버 쇼핑은 scope 를 고쳐도 돌아오지 않는다", () => {
  it("API_DISCONTINUED 가 isCollectableAccess 에서 막힌다", () => {
    expect(isCollectableAccess("API_DISCONTINUED")).toBe(false);
  });

  it("🔴 그래서 073 이 그 행을 고치지 않은 것이 맞다 — 고쳐도 효과가 없다", () => {
    /* scope 가 '{}' 여도 네 조건의 두 번째에서 걸린다. */
    const scopeOk = sourceFitsScopes([], selectedMarketSourceScopes("TENNIS"));
    expect(scopeOk).toBe(true);
    expect(isCollectableAccess("API_DISCONTINUED") && scopeOk).toBe(false);
    expect(SQL_073_RAW).toContain("돌아오지");
  });
});

describe("⑧ 🔴 072 의 on conflict 가 기존 행을 덮지 않았다 — 그 함정을 기록한다", () => {
  it("072 가 on conflict do nothing 이다 — 기존 행이 있으면 내 값이 버려진다", () => {
    expect(sqlOnly("072_domestic_common_comparison_sites_seed.sql")).toContain("on conflict do nothing");
  });

  it("072 는 에누리를 MANUAL 로 «넣으려 했다»", () => {
    expect(sqlOnly("072_domestic_common_comparison_sites_seed.sql")).toContain("'에누리', 'enuri.com'");
    expect(sqlOnly("072_domestic_common_comparison_sites_seed.sql")).toContain("'MANUAL', 'ACTIVE'");
  });

  it("🔴 073 이 그 사실(화면은 「수집 불가」)을 기록해 둔다 — 추측으로 덮지 않는다", () => {
    expect(SQL_073_RAW).toContain("on conflict do nothing");
    expect(SQL_073_RAW).toContain("072 의 값을 버렸다");
  });
});
