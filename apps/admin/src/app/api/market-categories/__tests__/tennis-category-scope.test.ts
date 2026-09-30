import { describe, expect, it } from "vitest";
import {
  CATEGORY_PROFILES,
  CATEGORY_PROFILE_LIST,
  detectCategoryProfile,
  isNaverNoticeTypeSupported,
  selectedMarketSourceScopes,
  sourceFitsScopes,
} from "@commerce/category";
import { isCollectableAccess } from "../../comparison-shops/_lib/comparison-shop";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TENNIS 시장조사 카테고리 (CPO 확정, 2026-09-30)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 드롭다운에 이름을 더하는 것이 목적이 아니다. 「사이트 등록 → 카테고리 연결
 * → 조사 대상 선정」이 실제로 이어지는지를 잰다. 그래서 조사 대상 선정에 쓰이는
 * «세 조건의 곱» 을 여기서 그대로 조립한다 — 화면·라우트가 쓰는 것과 같은 함수다
 * (market-categories/route.ts:72 · comparison/search/route.ts:92).
 *
 * 🔴 replica 를 만들지 않았다. isCollectableAccess 를 실제 모듈에서 import 한다 —
 * 조건을 여기 베껴 쓰면 원본이 바뀔 때 이 테스트가 조용히 거짓이 된다.
 */
const TENNIS_SCOPES = selectedMarketSourceScopes("TENNIS");

/** 조사 대상 선정 — 세 축의 곱. 라우트와 같은 조립이다. */
function isSurveyTarget(
  site: { categoryScope: string[]; enabled: boolean; accessStatus: "OK" | "BLOCKED" | null },
  scopes: string[] | null,
): boolean {
  return site.enabled && isCollectableAccess(site.accessStatus) && sourceFitsScopes(site.categoryScope, scopes);
}

const site = (over: Partial<Parameters<typeof isSurveyTarget>[0]> = {}) => ({
  categoryScope: [] as string[],
  enabled: true,
  accessStatus: null as "OK" | "BLOCKED" | null,
  ...over,
});

describe("① 관리자 카테고리 선택지에 「테니스」가 노출된다", () => {
  /* 🔴 `/api/market-categories` 는 CATEGORY_PROFILE_LIST 를 그대로 map 한다
     (route.ts:64). 그래서 이 목록에 있으면 화면 선택지에 있다. */
  it("CATEGORY_PROFILE_LIST 에 id=TENNIS · label=테니스 가 있다", () => {
    const tennis = CATEGORY_PROFILE_LIST.find((p) => p.id === "TENNIS");
    expect(tennis).toBeDefined();
    expect(tennis!.label).toBe("테니스");
  });
});

describe("② 테니스 선택 시 TENNIS scope 가 반환된다", () => {
  it("selectedMarketSourceScopes('TENNIS') === ['TENNIS']", () => {
    expect(TENNIS_SCOPES).toEqual(["TENNIS"]);
  });

  it("🔴 프로필 id 와 scope 어휘가 «같다» — 둘이 갈리면 연결이 조용히 끊긴다", () => {
    expect(CATEGORY_PROFILES.TENNIS.marketSourceScopes).toEqual([CATEGORY_PROFILES.TENNIS.id]);
  });
});

describe("③ 공통 사이트는 테니스에서도 조사 대상이다", () => {
  it("category_scope = [] 는 «전 카테고리» 라 테니스에서도 걸린다", () => {
    expect(isSurveyTarget(site({ categoryScope: [] }), TENNIS_SCOPES)).toBe(true);
  });

  it("🔴 그래서 공통 사이트를 테니스에 «중복 등록하지 않는다»", () => {
    /* 기존 국내·해외 공통 사이트는 빈 배열 그대로 두면 된다. TENNIS 를 배열에
       더하는 순간 「이 사이트는 테니스 전용」처럼 읽히고, 다른 카테고리에서
       빠질 위험이 생긴다. */
    const common = site({ categoryScope: [] });
    for (const scopes of [["TENNIS"], ["KIDS_FASHION"], ["GOLF"], null]) {
      expect(isSurveyTarget(common, scopes), `${JSON.stringify(scopes)}`).toBe(true);
    }
  });
});

describe("④ 테니스 전문 사이트는 테니스에서 조사 대상이다", () => {
  it("category_scope = ['TENNIS'] 가 테니스에서 걸린다", () => {
    expect(isSurveyTarget(site({ categoryScope: ["TENNIS"] }), TENNIS_SCOPES)).toBe(true);
  });

  it("복수 연결도 된다 — ['TENNIS','GOLF'] 는 양쪽에서 걸린다", () => {
    const both = site({ categoryScope: ["TENNIS", "GOLF"] });
    expect(isSurveyTarget(both, TENNIS_SCOPES)).toBe(true);
    expect(isSurveyTarget(both, selectedMarketSourceScopes("GOLF"))).toBe(true);
  });
});

describe("⑤ 다른 카테고리 전용 사이트는 테니스에서 제외된다", () => {
  it("🔴 ['KIDS_FASHION'] 전용 사이트가 테니스 조사에 섞이지 않는다", () => {
    expect(isSurveyTarget(site({ categoryScope: ["KIDS_FASHION"] }), TENNIS_SCOPES)).toBe(false);
  });

  it("🔴 반대 방향도 막힌다 — 테니스 전용이 아동 조사에 섞이지 않는다", () => {
    expect(
      isSurveyTarget(site({ categoryScope: ["TENNIS"] }), selectedMarketSourceScopes("KIDS_FASHION")),
    ).toBe(false);
  });
});

describe("⑥ 비활성·조사 불가 사이트는 기존 규칙대로 제외된다", () => {
  it("enabled=false 는 카테고리가 맞아도 제외된다", () => {
    expect(isSurveyTarget(site({ categoryScope: ["TENNIS"], enabled: false }), TENNIS_SCOPES)).toBe(false);
  });

  it("accessStatus=BLOCKED 는 카테고리가 맞아도 제외된다", () => {
    expect(isSurveyTarget(site({ categoryScope: ["TENNIS"], accessStatus: "BLOCKED" }), TENNIS_SCOPES)).toBe(false);
  });

  it("🔴 세 축이 «따로» 다 — 카테고리 연결이 활성화나 조사 가능을 뜻하지 않는다", () => {
    const linked = site({ categoryScope: ["TENNIS"] });
    expect(sourceFitsScopes(linked.categoryScope, TENNIS_SCOPES)).toBe(true);
    expect(isSurveyTarget({ ...linked, enabled: false }, TENNIS_SCOPES)).toBe(false);
    expect(isSurveyTarget({ ...linked, accessStatus: "BLOCKED" }, TENNIS_SCOPES)).toBe(false);
  });
});

describe("⑦ 기존 카테고리와 자동 감지에 회귀가 없다", () => {
  it("기존 6개 프로필이 그대로 있다", () => {
    for (const id of [
      "KIDS_FASHION",
      "WOMEN_FASHION",
      "FASHION_ACCESSORIES",
      "HOME_LIFESTYLE",
      "GOLF",
    ] as const) {
      expect(CATEGORY_PROFILES[id], id).toBeDefined();
    }
  });

  it("🔴 TENNIS 는 «자동 감지되지 않는다» — 키워드 배열이 전부 비어 있다", () => {
    const t = CATEGORY_PROFILES.TENNIS;
    for (const key of [
      "platformPathKeywords",
      "conflictPathKeywords",
      "ageGroups",
      "genders",
      "productTypes",
      "brandHints",
      "productKeywords",
    ] as const) {
      expect(t[key], `${key} 에 값이 생기면 자동 판정이 바뀐다`).toEqual([]);
    }
    expect(t.subProfiles).toBeUndefined();
  });

  it("🔴 테니스 어휘가 들어와도 TENNIS 로 자동 판정되지 않는다", () => {
    for (const text of [
      "Sergio Tacchini Men's Fall Magro Top tennis",
      "테니스 원피스",
      "tennis racket",
    ]) {
      const d = detectCategoryProfile({ ageGroup: "adult", gender: "men", productType: "" }, text, "Sergio Tacchini");
      expect(d?.profile.id, text).not.toBe("TENNIS");
    }
  });

  it("아동 신호는 여전히 KIDS_FASHION 으로 간다", () => {
    const d = detectCategoryProfile({ ageGroup: "kids", gender: "unisex", productType: "" }, "kids t-shirt", "");
    expect(d?.profile.id).toBe("KIDS_FASHION");
  });
});

describe("⑧ 🔴 시장조사 카테고리 추가가 채널 «등록» 분류를 바꾸지 않는다", () => {
  it("자동 판정 결과가 그대로다 — 채널 카테고리 추천의 입력이 이것이다", () => {
    /* 채널 등록 카테고리(네이버 leafCategoryId · 쿠팡 displayCategoryCode ·
       롯데ON 표준카테고리)는 이 상수에서 오지 않는다. 다만 자동 판정은 추천의
       입력이라, 그것이 안 바뀌면 채널 분류도 안 바뀐다. ⑦에서 확인했다. */
    const d = detectCategoryProfile({ ageGroup: "adult", gender: "women", productType: "" }, "여성 원피스", "");
    expect(d?.profile.id).toBe("WOMEN_FASHION");
  });

  it("🔴 TENNIS 의 고시유형은 WEAR 이고 «실제로 지원되는» 값이다", () => {
    /* GOLF 는 SPORTS_EQUIPMENT 라 지원 목록에 없어 false 다. 테니스는 의류
       축이라 WEAR 이고, 그 경로는 TENNIS-READY-TO-REGISTER 에서 3채널로 쟀다. */
    expect(CATEGORY_PROFILES.TENNIS.naverNoticeType).toBe("WEAR");
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.TENNIS)).toBe(true);
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.GOLF)).toBe(false);
  });
});
