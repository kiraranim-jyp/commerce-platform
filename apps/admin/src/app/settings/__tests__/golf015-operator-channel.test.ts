import { describe, expect, it, vi } from "vitest";
import {
  searchComparisonShops,
  supportsComparisonShopSearch,
  supportsDomesticShopSearch,
} from "@commerce/crawler";
import { isCollectableAccess } from "../../api/comparison-shops/_lib/comparison-shop";

/**
 * GOLF-01.5 축 A(CEO 지시, 2026-09-16).
 *
 * 이 파일이 지키는 것은 두 가지다.
 *
 * ① 🔴 «등록»과 «실제 가격이 들어온다»는 다른 사실이다(CTO 명시).
 *    이번 작업의 완료 기준이 그것이라, 등록만 되고 값이 0건인 소스를 화면이
 *    "수집 가능"이라고 부르지 못하게 실행으로 고정한다. 실측 대상은 Rakuten —
 *    access_status는 OK(열린다)인데 파서가 없어 한 건도 나오지 않는다.
 *
 * ② 🔴 같은 사업자라고 채널별 가격을 «합치지» 않는다(CEO 판단).
 *      GDO 본점 ¥110,000 · GDO Rakuten ¥99,000 · Yahoo GDO ¥105,000
 *    보여주려는 것은 "하나의 값"이 아니라 "동일 판매자가 채널마다 얼마에
 *    파는가"다. 관계(operator_key)는 053이 만들었지만, 그 관계로 값을 뭉치는
 *    코드가 생기면 CEO가 금지한 동작이 된다 — 여기서 실행으로 막는다.
 */

/* ══════════════ ① 파서가 없으면 «값이 안 들어온다»를 실행으로 남긴다 ══════════════ */

describe("GOLF-01.5 ① 파서 존재 여부 = 값이 들어오는가", () => {
  it("🔴 GDO·Victoria는 파서가 없고, Rakuten은 파서는 있지만 키가 없다 — 셋 다 요청조차 나가지 않고 0건이다", async () => {
    /**
     * GOLF-01.5 축 C(CEO 지시, 2026-09-16)로 이 테스트의 사실 하나가 바뀌었다.
     *
     * 축 A 시점: Rakuten 은 «어댑터 자체가 없어서» unsupported 였다.
     * 축 C 이후: Rakuten 어댑터는 완성됐고, «자격증명이 없어서» not_configured 다.
     *
     * 🔴 CEO 요구의 핵심은 그대로 지켜진다 — 요청이 한 번도 나가지 않고,
     *    화면이 "수집됐다"고 말하지 않는다. 바뀐 것은 **셀러에게 말해야 할
     *    이유**뿐이다: "이 사이트는 자동 검색을 못 한다"(직접 가 보세요)에서
     *    "키가 아직 없다"(우리가 넣으면 풀린다)로.
     */
    const noAdapter = ["shop.golfdigest.co.jp", "victoriagolf.co.jp"];
    for (const d of noAdapter) {
      expect(supportsComparisonShopSearch(d), `${d}에 파서가 없는데 있다고 답한다`).toBe(false);
    }
    expect(supportsComparisonShopSearch("rakuten.co.jp"), "Rakuten 어댑터가 사라졌다").toBe(true);

    // 🔴 판정 함수에게만 묻지 않는다. 실제 검색을 돌려서 (a) 상태가 «수집했다»가
    //    아니고 (b) 후보가 0건이고 (c) 네트워크 호출이 한 번도 없었다는 것까지 본다.
    const golfDomains = ["rakuten.co.jp", ...noAdapter];
    // 🔴 실행 환경에 키가 꽂혀 있어도 이 테스트의 사실은 바뀌지 않아야 한다 —
    //    "키가 없을 때 어떻게 되는가"를 재는 테스트이므로 명시적으로 비운다.
    vi.stubEnv("RAKUTEN_APPLICATION_ID", "");
    vi.stubEnv("RAKUTEN_ACCESS_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("부르면 안 되는 도메인인데 실제 HTTP 요청이 나갔다");
    });
    const results = await searchComparisonShops(
      { title: "TaylorMade Qi10 Driver 10.5" },
      golfDomains.map((d, i) => ({ id: `o-${i}`, name: d, domain: d, currency: "JPY" })),
    );
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();

    console.log(
      `[GOLF-01.5 증거] 골프 해외 3곳 실제 검색 결과: ` +
        results.map((r) => `${r.domain}=${r.status}/${r.candidates.length}건`).join(" · "),
    );
    const byDomain = new Map(results.map((r) => [r.domain, r]));
    expect(byDomain.get("rakuten.co.jp")?.status, "Rakuten이 not_configured가 아니다").toBe("not_configured");
    for (const d of noAdapter) {
      expect(byDomain.get(d)?.status, `${d}이 unsupported가 아니다`).toBe("unsupported");
    }
    for (const r of results) {
      expect(r.candidates, `${r.domain}이 값을 준 것처럼 보인다`).toHaveLength(0);
    }
    expect(fetchSpy, "부르면 안 되는 도메인에 실제 HTTP 요청을 보냈다").not.toHaveBeenCalled();
  });

  it("🔴 아동복 파서 12곳은 그대로 살아 있다(회귀)", () => {
    // 051/052 이전부터 실제로 값을 가져오던 도메인들. 이번 변경이 파서 판정을
    // 한 곳으로 모았으므로(supportsComparisonShopSearch), 그 정리가 기존
    // 사이트를 떨어뜨리지 않았는지 전수로 본다.
    const kidsParsed = [
      "junioredition.com",
      "nickis.com",
      "isolabellakids.com",
      "petitemaisonkids.com",
      "shoppiccoliandco.com",
      "kidswearcollective.com",
      "kidsatelier.com",
      "designerkidswear.com",
      "kidbizkid.com",
      "villagekids.co.uk",
      "folkberlin.com",
      "childrensalon.com",
    ];
    for (const d of kidsParsed) {
      expect(supportsComparisonShopSearch(d), `${d} 파서가 사라졌다`).toBe(true);
    }
    expect(kidsParsed).toHaveLength(12);

    // 국내 파서 6곳도 같은 이유로 전수 확인한다.
    const domesticParsed = [
      "looxloo.com",
      "bobochoses.com",
      "rulii.co.kr",
      "deuxbebe.com",
      "chocoel.co.kr",
      "foretforet.com",
    ];
    for (const d of domesticParsed) {
      expect(supportsDomesticShopSearch(d), `${d} 국내 파서가 사라졌다`).toBe(true);
    }
    expect(supportsDomesticShopSearch("danawa.com"), "다나와에 없는 파서가 있다고 답한다").toBe(false);
    expect(supportsDomesticShopSearch("shopping.naver.com")).toBe(false);
  });
});

/* ══════════════ ② 네이버는 조사 대상에서 구조적으로 빠진다 ══════════════ */

describe("GOLF-01.5 ② 네이버 쇼핑 — 가격 수집 소스에서 빠졌다", () => {
  it("🔴 API_DISCONTINUED는 조사 대상을 고르는 함수가 막는다", () => {
    // 조사 대상을 고르는 자리(market-categories · comparison/search ·
    // domestic-price-sources/search · run-domestic-price-check)가 전부 이
    // 함수 하나를 쓴다 — 여기서 막히면 네 곳 전부에서 막힌다.
    expect(isCollectableAccess("API_DISCONTINUED"), "API가 종료된 소스를 계속 조사 대상에 넣는다").toBe(false);
    expect(isCollectableAccess("BLOCKED")).toBe(false);
    expect(isCollectableAccess("LOGIN_REQUIRED")).toBe(false);
    // null(확인 안 함)과 OK는 예전 그대로다 — 여기서 null을 막으면 아동복
    // 16행·25행이 전부 조사에서 사라진다(051 주석).
    expect(isCollectableAccess(null), "확인하지 않은 41행이 조사에서 통째로 빠진다").toBe(true);
    expect(isCollectableAccess("OK")).toBe(true);
  });
});

/* ══════════════ ③ 같은 사업자라도 채널별 가격을 합치지 않는다 ══════════════ */

describe("GOLF-01.5 ③ operator_key는 관계만 말한다 — 값을 합치지 않는다", () => {
  /** CEO가 든 예시 그대로의 두 채널. 같은 사업자(GDO)이고 가격이 다르다. */
  const GDO_HONTEN = {
    id: "o-gdo-honten",
    name: "GDO 골프샵",
    domain: "shop.golfdigest.co.jp",
    url: "https://shop.golfdigest.co.jp",
    country: "Japan",
    currency: "JPY",
    categoryScope: ["GOLF"],
    accessStatus: "OK" as const,
    accessNote: null,
    role: "PRICE_COLLECTION" as const,
    operatorKey: "GDO",
    source: "SYSTEM" as const,
    isActive: true,
  };
  const GDO_RAKUTEN = { ...GDO_HONTEN, id: "o-gdo-rakuten", name: "GDO Rakuten 공식점", domain: "rakuten.co.jp" };

  it("🔴 같은 operator_key인 두 채널이 각자의 가격으로 따로 남는다", async () => {
    vi.resetModules();
    const calledDomains: string[] = [];
    vi.doMock("@commerce/crawler", () => ({
      // 채널마다 다른 값을 돌려준다 — CEO 예시의 ¥110,000 / ¥99,000.
      searchComparisonShops: async (_q: unknown, shops: { id: string; domain: string; name: string }[]) => {
        calledDomains.push(...shops.map((s) => s.domain));
        return shops.map((s) => ({
          shopId: s.id,
          shopName: s.name,
          domain: s.domain,
          status: "ok" as const,
          candidates: [
            {
              title: "TaylorMade Qi10 Driver 10.5",
              url: `https://${s.domain}/item/qi10`,
              price: { amount: s.domain === "rakuten.co.jp" ? 99000 : 110000, currency: "JPY" },
              imageUrl: null,
              confidence: 0.9,
            },
          ],
        }));
      },
      verifySourcePriceDirect: async () => ({ status: "NOT_APPLICABLE", price: null, regularPrice: null }),
      attachProductMatchTruth: (_q: unknown, r: unknown) => r,
    }));
    vi.doMock("../../api/comparison-shops/_lib/comparison-shop", async () => {
      const actual = await vi.importActual<typeof import("../../api/comparison-shops/_lib/comparison-shop")>(
        "../../api/comparison-shops/_lib/comparison-shop",
      );
      return { ...actual, listComparisonShops: async () => [GDO_HONTEN, GDO_RAKUTEN] };
    });
    const { POST } = await import("../../api/comparison/search/route");
    const res = await POST(
      new Request("http://localhost/api/comparison/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "TaylorMade Qi10 Driver 10.5", marketCategoryProfileId: "GOLF" }),
      }),
    );
    const body = (await res.json()) as {
      results: { shopId: string; domain: string; candidates: { price: { amount: number } }[] }[];
    };
    vi.doUnmock("@commerce/crawler");
    vi.doUnmock("../../api/comparison-shops/_lib/comparison-shop");

    const observed = body.results.map((r) => `${r.domain}=${r.candidates[0]?.price.amount}`);
    console.log(`[GOLF-01.5 증거] 같은 사업자(GDO) 두 채널 관측값: ${observed.join(" · ")}`);

    // 🔴 두 줄이 그대로 두 줄로 남아야 한다. 하나로 줄었거나 값이 같아졌으면
    //    어딘가에서 사업자 단위로 뭉친 것이다.
    expect(body.results, "같은 사업자라고 두 채널을 한 줄로 합쳤다").toHaveLength(2);
    expect(new Set(body.results.map((r) => r.shopId)).size, "채널이 같은 shopId로 뭉쳤다").toBe(2);
    const amounts = body.results.map((r) => r.candidates[0].price.amount).sort((a, b) => a - b);
    expect(amounts, "채널별 관측값이 하나로 합쳐지거나 평균이 됐다").toEqual([99000, 110000]);
    // 두 채널 모두 실제로 조회됐다 — "대표 채널 하나만 본다"도 아니다.
    expect(calledDomains.sort()).toEqual(["rakuten.co.jp", "shop.golfdigest.co.jp"]);
  });

  it("🔴 operator_key를 집계 키로 쓰는 코드가 저장소에 없다", async () => {
    // 위 실행 검사는 «오늘» 합치지 않는다는 것만 증명한다. 내일 누군가
    // operatorKey로 groupBy를 하면 그 검사는 통과한 채로 CEO 금지사항이
    // 생긴다. 그래서 값의 쓰임 자체를 고정한다: 이 필드를 읽는 자리는
    // ① 매핑(comparison-shop.ts) ② 화면 표시(settings/page.tsx) 둘뿐이다.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const here = join(process.cwd(), "src", "app");
    const readers = [
      join(here, "api", "comparison-shops", "_lib", "comparison-shop.ts"),
      join(here, "settings", "page.tsx"),
    ];
    for (const f of readers) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/operator[_K]?[ekK]ey/);
      // 집계로 읽히는 흔적이 붙으면 즉시 걸린다.
      expect(src, `${f}에서 operatorKey를 집계에 쓰고 있다`).not.toMatch(
        /(groupBy|group_by|reduce|Map)\s*\([^)]*operatorKey/,
      );
    }
  });
});
