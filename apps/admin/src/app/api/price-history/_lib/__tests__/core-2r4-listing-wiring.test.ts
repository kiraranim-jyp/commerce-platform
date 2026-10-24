import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countStrongKrSellerSignals,
  extractMarketEvidence,
  hasCompositeKrSellerEvidence,
  MIN_STRONG_KR_SELLER_SIGNALS,
} from "@commerce/crawler/src/comparison-search/market-evidence";
import { classifyCandidateMarket } from "../candidate-market";
import {
  collectDomesticListingUrls,
  MAX_DETAIL_URLS_PER_SITE,
  MAX_LISTING_HOP_SITES,
  MAX_LISTING_URLS_PER_SITE,
} from "../domestic-listing-pool";
import {
  DOMESTIC_LISTING_SHOP_ID,
  isTransientShopId,
  TRANSIENT_SHOP_IDS,
} from "../transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-4 — STEP 2(목록 탐색 생산자) · STEP 3(marketEvidence) · STEP 4(종합)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **네트워크 0.** 라이브 fetch 는 `fetchHtml` 주입으로 대체한다(운영 기본값은 운영 함수).
 * 🔴 이 파일이 잠그는 것은 **경계** 다 — 저장 차단 · 출처 보존 · 상한 · 「단독 신호 금지」.
 */

const LIB = join(__dirname, "..");
const RUNNER = readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8");
const ROUTE = readFileSync(join(LIB, "..", "check", "route.ts"), "utf8");
const POOL = readFileSync(join(LIB, "domestic-listing-pool.ts"), "utf8");

/** 🔴 소스 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}
const RUNNER_CODE = stripComments(RUNNER);
const ROUTE_CODE = stripComments(ROUTE);
const POOL_CODE = stripComments(POOL);

/* ════════════════════════════ A. 저장 차단 · 출처 ════════════════════════════ */

describe("CORE-2R-4 A — 일시 샵 계약(DB 오염 차단)", () => {
  /**
   * 🔴🔴 이 생산자는 **등록부에 실재하는 국내 호스트** 를 다룬다 — 집합에서 빠지면
   *    upsert 가 **오류 없이 성공** 해 일시 후보가 영구 링크가 된다(앞의 넷보다 위험하다).
   */
  it("A-1 🔴 다섯 번째 일시 샵이 `TRANSIENT_SHOP_IDS` 에 있다", () => {
    expect(TRANSIENT_SHOP_IDS.has(DOMESTIC_LISTING_SHOP_ID)).toBe(true);
    expect(isTransientShopId(DOMESTIC_LISTING_SHOP_ID)).toBe(true);
  });

  /** 🔴 집합을 **전수 순회** 한다 — 숫자만 고쳐 통과시키는 길을 막는다. */
  it("A-2 🔴 집합의 모든 id 가 술어를 통과하고 uuid 가 섞이지 않았다", () => {
    expect(TRANSIENT_SHOP_IDS.size).toBeGreaterThanOrEqual(5);
    for (const id of TRANSIENT_SHOP_IDS) {
      expect(isTransientShopId(id), `${id} 가 술어를 통과하지 못한다`).toBe(true);
      expect(id, `${id} 가 등록부 uuid 모양이다`).not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });

  /** 🔴 출처를 「그 외는 Gemini」로 두면 보고가 조용히 거짓이 된다. */
  it("A-3 🔴 출처가 다섯 값으로 갈려 있고 runner 가 다섯 번째를 **명시** 한다", () => {
    expect(RUNNER_CODE).toContain('"DOMESTIC_LISTING"');
    expect(RUNNER_CODE).toContain("result.shopId === DOMESTIC_LISTING_SHOP_ID");
    expect(RUNNER_CODE).toContain("domesticListingEvidence");
  });

  /** 🔴 네 배열을 합치지 않는다 — 합치면 「누가 찾았는가」가 사라진다. */
  it("A-4 🔴 응답이 배열을 **가른 채로** 내보낸다", () => {
    for (const field of [
      "geminiEvidence",
      "urlCandidateEvidence",
      "overseasAutoEvidence",
      "reviewedSameEvidence",
      "domesticListingEvidence",
    ]) {
      expect(RUNNER_CODE).toContain(field);
    }
  });

  /** 🔴 MI 입력 한 곳에서만 합친다 — 그러지 않으면 가격 집계에 영원히 못 들어간다. */
  /**
   * 🔴🔴 **1차 단언이 뚫렸고 그것을 적는다.** 처음엔 블록 안에
   *    `domesticShop.domesticListingEvidence` 문자열만 봤는데, 그 이름은 **위의
   *    truthiness 조건줄에도** 있어서 **배열을 펼치는 줄(`...`)을 지워도 통과** 했다
   *    (M6 가 0 FAIL 이었다). 🟢 그래서 **펼침 형태 그대로** 를 단언한다.
   */
  it("A-5 🔴 route 가 다섯 배열을 **MI 입력 한 곳** 에서 «펼쳐» 합친다", () => {
    const at = ROUTE_CODE.indexOf("const transientEvidence");
    expect(at).toBeGreaterThan(0);
    const block = ROUTE_CODE.slice(at, ROUTE_CODE.indexOf("computeMarketIntelligence", at));
    for (const field of [
      "geminiEvidence",
      "urlCandidateEvidence",
      "overseasAutoEvidence",
      "reviewedSameEvidence",
      "domesticListingEvidence",
    ]) {
      expect(block, `${field} 가 MI 입력에서 펼쳐지지 않는다`).toContain(`...(domesticShop.${field} ?? [])`);
    }
  });

  /**
   * 🔴 `candidate_reviews.source` check constraint 에 `DOMESTIC_LISTING` 이 **없다**.
   *    기존 값으로 적으면 그 후보의 **원래 출처를 덮는다** ⟹ 이력 저장에 넣지 않는다.
   */
  it("A-6 🔴 이력 저장(`recordSeenCandidates`)에 다섯 번째 출처를 넣지 않았다", () => {
    const at = ROUTE_CODE.indexOf("recordSeenCandidates({");
    expect(at).toBeGreaterThan(0);
    const block = ROUTE_CODE.slice(ROUTE_CODE.lastIndexOf("const seen = [", at), at);
    expect(block).not.toContain("domesticListingEvidence");
  });
});

/* ═══════════════════ B. 목록 탐색 생산자 — 상한 · 사이트 비(非)특정 ═══════════════ */

const ENTRY = "https://shop.example";
/** 🟢 「진입 페이지 → 브랜드 블록 → 공유 분류값 → 목록 → 상세」의 **최소 모양**. */
const ENTRY_HTML = `
  <a href="/d/detail.html?pid=1&cat=58">[브랜드케이] 다른상품 #999XX111</a>
  <a href="/d/detail.html?pid=2&cat=58">[브랜드케이] 또다른상품 #999XX112</a>
  <a href="/d/detail.html?pid=3&cat=58">[브랜드케이] 세번째 #999XX113</a>
  <a href="/d/list.html?cat=58">브랜드케이 전체보기</a>
  <a href="/d/list.html?cat=77">다른 브랜드</a>
`;
const LISTING_HTML = `
  <a href="?page=1">1</a><a href="?page=2">2</a>
  <a href="/d/detail.html?pid=9">[브랜드케이] 찾는상품 #226AC009</a>
`;

function fakeFetch(map: Record<string, string | null>) {
  return async (url: string) => {
    const hit = Object.entries(map).find(([k]) => url.includes(k));
    return hit ? hit[1] : null;
  };
}

/** 🟢 hop-1 주입 — robots/sitemap 을 타지 않고 **진입 HTML 만** 준 상태를 만든다. */
function fakeExpand(entryHtml: string | null, detailUrls: string[] = []) {
  return async () => ({
    host: "shop.example",
    robotsAllowed: true as boolean | null,
    source: "NONE" as const,
    linkCount: 0,
    detailUrls,
    httpCalls: 2,
    note: null,
    entryHtml,
  });
}

describe("CORE-2R-4 B — 목록 탐색 생산자(네트워크 0)", () => {
  it("B-1 🟢 브랜드 블록 → 공유 분류값 → 목록 → **상세 URL** 까지 간다", async () => {
    const r = await collectDomesticListingUrls({
      sites: [{ domain: "shop.example", entryUrl: ENTRY }],
      code: "B226AC009",
      brandTerms: ["브랜드케이"],
      fetchHtml: fakeFetch({ "list.html?cat=58": LISTING_HTML }),
      expand: fakeExpand(ENTRY_HTML),
    });
    expect(r.urls).toEqual(["https://shop.example/d/detail.html?pid=9"]);
    expect(r.metrics.outcomes[0].source).toBe("BRAND_LISTING");
    expect(r.metrics.providerCalls).toBe(0);
  });

  /** 🔴 **다른 브랜드의 목록을 열지 않는다** — 공유 분류값이 그것을 가른다. */
  it("B-2 🔴 브랜드 분류값이 다른 목록(`cat=77`)은 열지 않는다", async () => {
    const opened: string[] = [];
    await collectDomesticListingUrls({
      sites: [{ domain: "shop.example", entryUrl: ENTRY }],
      code: "B226AC009",
      brandTerms: ["브랜드케이"],
      fetchHtml: async (u) => {
        opened.push(u);
        return u.includes("cat=58") ? LISTING_HTML : "<p/>";
      },
      expand: fakeExpand(ENTRY_HTML),
    });
    expect(opened.some((u) => u.includes("cat=58"))).toBe(true);
    expect(opened.some((u) => u.includes("cat=77"))).toBe(false);
  });

  /** 🔴 품번이 없으면 **아무것도 하지 않는다**(목록 텍스트 일치가 오탐이 된다). */
  it("B-3 🔴 품번이 없거나 짧으면 HTTP 를 **한 번도** 쓰지 않는다", async () => {
    let calls = 0;
    for (const code of [null, "B22"]) {
      const r = await collectDomesticListingUrls({
        sites: [{ domain: "shop.example", entryUrl: ENTRY }],
        code,
        brandTerms: ["브랜드케이"],
        fetchHtml: async () => {
          calls += 1;
          return ENTRY_HTML;
        },
        expand: fakeExpand(ENTRY_HTML),
      });
      expect(r.urls).toEqual([]);
      expect(r.metrics.visitedSites).toBe(0);
    }
    expect(calls).toBe(0);
  });

  /** 🔴 브랜드 표기가 없으면 목록을 추측하지 않는다 — **이유를 적고** 멈춘다. */
  it("B-4 🔴 진입 페이지에 브랜드 표기가 없으면 `NO_BRAND_BLOCK` 으로 멈춘다", async () => {
    const r = await collectDomesticListingUrls({
      sites: [{ domain: "shop.example", entryUrl: ENTRY }],
      code: "B226AC009",
      brandTerms: ["없는브랜드"],
      fetchHtml: async () => LISTING_HTML,
      expand: fakeExpand(ENTRY_HTML),
    });
    expect(r.urls).toEqual([]);
    expect(r.metrics.outcomes[0].note).toContain("NO_BRAND_BLOCK");
  });

  /** 🔴 robots 전면 금지면 **그 사이트를 건드리지 않는다**(hop-1 소유 규칙 유지). */
  it("B-5 🔴 robots 전면 금지면 목록을 열지 않는다", async () => {
    let opened = 0;
    const r = await collectDomesticListingUrls({
      sites: [{ domain: "shop.example", entryUrl: ENTRY }],
      code: "B226AC009",
      brandTerms: ["브랜드케이"],
      fetchHtml: async () => {
        opened += 1;
        return LISTING_HTML;
      },
      expand: async () => ({
        host: "shop.example",
        robotsAllowed: false as boolean | null,
        source: "NONE" as const,
        linkCount: 0,
        detailUrls: [],
        httpCalls: 1,
        note: "ROBOTS_DISALLOW_ALL",
        entryHtml: null,
      }),
    });
    expect(opened).toBe(0);
    expect(r.urls).toEqual([]);
    expect(r.metrics.outcomes[0].robotsAllowed).toBe(false);
  });

  /** 🔴 상한에 걸린 사이트를 **조용히 버리지 않는다**. */
  it("B-6 🔴 사이트 상한 초과분이 `skippedOverLimit` 에 남는다", async () => {
    const r = await collectDomesticListingUrls({
      sites: [
        { domain: "a.example", entryUrl: "https://a.example" },
        { domain: "b.example", entryUrl: "https://b.example" },
      ],
      code: "B226AC009",
      brandTerms: ["브랜드케이"],
      maxSites: 1,
      fetchHtml: async () => null,
      expand: fakeExpand(null),
    });
    expect(r.metrics.visitedSites).toBe(1);
    expect(r.metrics.skippedOverLimit).toEqual(["b.example"]);
  });

  /** 🔴 hop-1 이 URL 에서 품번을 찾으면 **목록을 열지 않는다**(HTTP 절약 · 출처 구분). */
  it("B-7 🟢 URL 에 품번이 있으면 `URL_CODE` 로 끝난다", async () => {
    let opened = 0;
    const r = await collectDomesticListingUrls({
      sites: [{ domain: "shop.example", entryUrl: ENTRY }],
      code: "B226AC009",
      brandTerms: ["브랜드케이"],
      fetchHtml: async () => {
        opened += 1;
        return LISTING_HTML;
      },
      expand: fakeExpand(ENTRY_HTML, ["https://shop.example/p/b226ac009"]),
    });
    expect(r.urls).toEqual(["https://shop.example/p/b226ac009"]);
    expect(r.metrics.outcomes[0].source).toBe("URL_CODE");
    expect(opened).toBe(0);
  });

  /** 🔴 **사이트 전용 상수 0** — 이 파일에 특정 샵/경로 이름이 있으면 하드코딩이다. */
  it("B-8 🔴 모듈에 사이트 전용 문자열이 **없다**", () => {
    for (const banned of ["donokids", "shopdetail", "shopbrand", "xcode", "branduid", "cafe24", "miniboutique"]) {
      expect(POOL_CODE.toLowerCase(), `사이트 전용 문자열 ${banned}`).not.toContain(banned);
    }
  });

  /** 🔴 상한이 **상수로 존재** 하고 전수 크롤링이 되지 않는다. */
  it("B-9 🔴 상한 셋이 작은 값으로 고정돼 있다", () => {
    /**
     * 🔴🔴 CORE-2R-7 — **6 → 14 로 올렸고 그 이유를 적는다.** 6 은 운영 등록부에서
     *    **정답 샵(`donokids.com` · P1 · 실효 10번째)을 잘랐고** 그것이 CEO Production
     *    FAIL 의 실제 원인이었다. 🟢 전수로 늘린 것이 **아니다** — 포털/오픈마켓을
     *    `isListingHopTarget` 로 먼저 빼고(13곳) 그 위에 **백스톱** 으로만 남긴다.
     * 🔴 그래도 상한은 **작게** 유지한다 — 전수 크롤링이 되면 안 된다(아래 E-4 가 짝이다).
     */
    expect(MAX_LISTING_HOP_SITES).toBeLessThanOrEqual(16);
    expect(MAX_LISTING_URLS_PER_SITE).toBeLessThanOrEqual(3);
    expect(MAX_DETAIL_URLS_PER_SITE).toBeLessThanOrEqual(10);
  });

  /** 🔴 후보를 **이미 낸** 샵은 다시 뒤지지 않는다(같은 일을 두 번 하지 않는다). */
  it("B-10 🔴 runner 가 「후보를 낸 샵」을 대상에서 뺀다", () => {
    expect(RUNNER_CODE).toContain("producedCandidates");
    expect(RUNNER_CODE).toContain("!producedCandidates.has(s.domain.trim().toLowerCase())");
  });

  /**
   * 🔴🔴 **호출부가 켜지 않으면 외부 HTTP 가 한 번도 발생하지 않는다.**
   *    이 가드가 없으면 `runDomesticPriceCheck` 를 부르는 **모든** 경로(일괄 cron 포함)가
   *    사이트마다 robots/목록을 긁는다 — 실제로 기존 단위 테스트 4건이 **15초 타임아웃**
   *    으로 그것을 잡았다(그 실패가 이 가드를 만들었다).
   */
  it("B-11 🔴 `domesticListingHop` 가 꺼져 있으면 경로가 **열리지 않는다**", () => {
    expect(RUNNER_CODE).toContain("if (input.domesticListingHop)");
    const at = RUNNER_CODE.indexOf("if (input.domesticListingHop)");
    const call = RUNNER_CODE.indexOf("collectDomesticListingUrls({");
    expect(call, "수집기 호출이 플래그 블록 «안» 에 있어야 한다").toBeGreaterThan(at);
  });

  /** 🔴 켜는 곳은 **셀러 확인 경로 하나** 다 — 일괄 cron 은 켜지 않는다(비용). */
  it("B-12 🔴 `check` 라우트만 켜고 일괄 cron 은 켜지 않는다", () => {
    expect(ROUTE_CODE).toContain("domesticListingHop: true");
    const TRIGGER = stripComments(readFileSync(join(LIB, "trigger-domestic-price-check.ts"), "utf8"));
    expect(TRIGGER).not.toContain("domesticListingHop");
  });
});

/* ════════════════════ C. marketEvidence — 사실만 읽는다 ════════════════════ */

const KR_FOOTER = `
  <footer><span>사업자등록번호</span> : <em>266-88-02038</em>
  <span>통신판매업 신고번호</span> : 2023-서울용산-0048 </footer>`;

describe("CORE-2R-4 C — marketEvidence(순수 · 추가 HTTP 0)", () => {
  it("C-1 🟢 태그로 쪼개진 고시 문구를 읽는다", () => {
    const e = extractMarketEvidence(KR_FOOTER);
    expect(e.businessRegistration).toBe(true);
    expect(e.mailOrderRegistration).toBe(true);
    expect(countStrongKrSellerSignals(e)).toBe(2);
  });

  /** 🔴 라벨만 있고 **번호가 없으면** 증거가 아니다(안내 문구를 증거로 쓰지 않는다). */
  it("C-2 🔴 라벨만 있으면 false 다", () => {
    const e = extractMarketEvidence("<p>사업자정보확인 · 통신판매업 안내</p>");
    expect(e.businessRegistration).toBe(false);
    expect(e.mailOrderRegistration).toBe(false);
    expect(hasCompositeKrSellerEvidence(e)).toBe(false);
  });

  it("C-3 🔴 HTML 이 없으면 전부 false 다 — 「해외」가 아니라 「모른다」", () => {
    expect(countStrongKrSellerSignals(extractMarketEvidence(null))).toBe(0);
    expect(countStrongKrSellerSignals(extractMarketEvidence(""))).toBe(0);
  });

  /** 🔴 보조 증거(배송·결제)는 **강한 증거 수에 더하지 않는다**(한국어 페이지 = KR 금지). */
  it("C-4 🔴 배송·결제만 있으면 강한 증거는 0 이다", () => {
    const e = extractMarketEvidence("<p>택배 배송비 2,500원 · 무통장 입금</p>");
    expect(e.domesticShipping).toBe(true);
    expect(e.domesticPayment).toBe(true);
    expect(countStrongKrSellerSignals(e)).toBe(0);
    expect(hasCompositeKrSellerEvidence(e)).toBe(false);
  });

  it("C-5 🔴 문턱은 **둘** 이다 — 하나로는 종합이 성립하지 않는다", () => {
    expect(MIN_STRONG_KR_SELLER_SIGNALS).toBe(2);
    const one = extractMarketEvidence("<p>개인통관고유부호를 입력해 주세요</p>");
    expect(countStrongKrSellerSignals(one)).toBe(1);
    expect(hasCompositeKrSellerEvidence(one)).toBe(false);
  });
});

/* ═════════════════ D. 종합 판정 — 「단독 신호 KR」이 불가능하다 ═════════════════ */

const EV2 = extractMarketEvidence(KR_FOOTER);

describe("CORE-2R-4 D — composite market gate", () => {
  /** 🟢 등록부 **밖** · `.com` · KRW 인데 사이트 증거 둘이면 KR 이다. */
  it("D-1 🟢 강한 증거 2 + KRW → KR(`KR_SELLER_EVIDENCE_AND_KRW`)", () => {
    expect(
      classifyCandidateMarket({
        domain: "shop.example",
        currency: "KRW",
        isRegisteredDomesticShop: false,
        marketEvidence: EV2,
      }),
    ).toEqual({ market: "KR", basis: "KR_SELLER_EVIDENCE_AND_KRW" });
  });

  /** 🔴🔴 **증거 단독으로는 KR 이 되지 않는다** — 통화가 없으면 판정 자체가 없다. */
  it("D-2 🔴 증거만 있고 가격(통화)이 없으면 `NO_PRICE_EVIDENCE`", () => {
    expect(
      classifyCandidateMarket({
        domain: "shop.example",
        currency: null,
        isRegisteredDomesticShop: false,
        marketEvidence: EV2,
      }),
    ).toEqual({ market: "UNKNOWN", basis: "NO_PRICE_EVIDENCE" });
  });

  /** 🔴 신호 **하나** + KRW 는 여전히 UNKNOWN 이다(CPO 금지: 단독 신호 KR). */
  it("D-3 🔴 강한 증거 1 + KRW → UNKNOWN", () => {
    const one = extractMarketEvidence("<p>사업자등록번호 : 266-88-02038</p>");
    expect(countStrongKrSellerSignals(one)).toBe(1);
    expect(
      classifyCandidateMarket({
        domain: "shop.example",
        currency: "KRW",
        isRegisteredDomesticShop: false,
        marketEvidence: one,
      }),
    ).toEqual({ market: "UNKNOWN", basis: "KRW_WITHOUT_DOMAIN_EVIDENCE" });
  });

  /** 🔴 증거 + **외화** 는 충돌이다 — 둘 중 하나를 고르지 않는다. */
  it("D-4 🔴 강한 증거 2 + 외화 → UNKNOWN(충돌)", () => {
    expect(
      classifyCandidateMarket({
        domain: "shop.example",
        currency: "USD",
        isRegisteredDomesticShop: false,
        marketEvidence: EV2,
      }),
    ).toEqual({ market: "UNKNOWN", basis: "CONFLICT_KR_SELLER_EVIDENCE_WITH_FOREIGN_CURRENCY" });
  });

  /** 🔴 **기존 동작 불변** — 증거를 안 넘기면 한 글자도 바뀌지 않는다(WU-020 계약). */
  it("D-5 🔴 marketEvidence 가 없으면 기존 basis 가 그대로다", () => {
    expect(classifyCandidateMarket({ domain: "x.co.kr", currency: "KRW", isRegisteredDomesticShop: false })).toEqual({
      market: "KR",
      basis: "KR_TLD_AND_KRW",
    });
    expect(classifyCandidateMarket({ domain: "x.com", currency: "KRW", isRegisteredDomesticShop: true })).toEqual({
      market: "KR",
      basis: "REGISTERED_SHOP_AND_KRW",
    });
    expect(classifyCandidateMarket({ domain: "x.com", currency: "KRW", isRegisteredDomesticShop: false })).toEqual({
      market: "UNKNOWN",
      basis: "KRW_WITHOUT_DOMAIN_EVIDENCE",
    });
  });

  /**
   * 🔴🔴 **등록부가 KR 판정의 «이유» 가 되지 않는다**(CPO 지시) — 사이트 증거가 있으면
   *    `basis` 가 그 사실을 말한다. 🟢 등록부 분기는 지우지 않았다(증거 없는 후보용).
   */
  it("D-6 🔴 증거가 있으면 등록부보다 **증거가 이유** 로 적힌다", () => {
    expect(
      classifyCandidateMarket({
        domain: "x.com",
        currency: "KRW",
        isRegisteredDomesticShop: true,
        marketEvidence: EV2,
      }).basis,
    ).toBe("KR_SELLER_EVIDENCE_AND_KRW");
  });

  /** 🔴 운영이 후보의 증거 칸을 **실제로 넘긴다**(배선이 끊기면 전건 UNKNOWN 으로 돌아간다). */
  it("D-7 🔴 runner 가 `marketEvidence` 를 판정 함수에 넘긴다", () => {
    const at = RUNNER_CODE.indexOf("...classifyCandidateMarket({");
    expect(at).toBeGreaterThan(0);
    const block = RUNNER_CODE.slice(at, at + 400);
    expect(block).toContain("marketEvidence: best.marketEvidence");
  });
});

/* ═══ E. 🔴🔴 CORE-2R-7 — 상한·정렬이 «정답 샵» 을 자르지 않는다(운영 등록부 실측 재현) ═══ */

import { isBatchSurveyTarget } from "../run-domestic-price-check";
import { isListingHopTarget } from "../domestic-listing-pool";

/**
 * 🔴🔴 **CEO Production FAIL 의 실제 원인이 여기였다.** 운영 등록부(아동 scope · enabled ·
 *    ACTIVE · 접근가능) **19곳** 을 `(priority, domain)` 으로 정렬하면 데이터가 있는 유일한
 *    샵 `donokids.com`(P1)이 **10번째** 라 `MAX_LISTING_HOP_SITES = 6` 밖이었다 ⟹
 *    **한 번도 방문하지 않았고** 국내 후보가 구조적으로 0 이었다.
 * 🟢 아래 19행은 **운영 DB 실측값 그대로** 다(2026-10-24 · `source_type` 포함 · 지어낸 값 0).
 */
const REGISTRY_SNAPSHOT: { domain: string; priority: "P0" | "P1" | "P2"; sourceType: string | null }[] = [
  { domain: "29cm.co.kr", priority: "P1", sourceType: "MARKETPLACE" },
  { domain: "danawa.com", priority: "P0", sourceType: "MARKETPLACE" },
  { domain: "musinsa.com", priority: "P1", sourceType: "MARKETPLACE" },
  { domain: "shoppinghow.kakao.com", priority: "P1", sourceType: "MARKETPLACE" },
  { domain: "ssfshop.com", priority: "P0", sourceType: "MARKETPLACE" },
  { domain: "wconcept.co.kr", priority: "P2", sourceType: "MARKETPLACE" },
  /** 🔴 080 이 `source_type` 을 세우지 않아 **NULL** 이다 — allowlist 로 짜면 여기서 잘린다. */
  { domain: "donokids.com", priority: "P1", sourceType: null },
  { domain: "chocoel.co.kr", priority: "P0", sourceType: "RETAILER" },
  { domain: "chouchouenfant.kr", priority: "P1", sourceType: "RETAILER" },
  { domain: "coconjennie.com", priority: "P1", sourceType: "RETAILER" },
  { domain: "deuxbebe.com", priority: "P1", sourceType: "RETAILER" },
  { domain: "foretforet.com", priority: "P0", sourceType: "RETAILER" },
  { domain: "karymarket.com", priority: "P1", sourceType: "RETAILER" },
  { domain: "littleluna.co.kr", priority: "P1", sourceType: "RETAILER" },
  { domain: "looxloo.com", priority: "P0", sourceType: "RETAILER" },
  { domain: "nokimore.com", priority: "P1", sourceType: "RETAILER" },
  { domain: "ocokorea.com", priority: "P1", sourceType: "RETAILER" },
  { domain: "rulii.co.kr", priority: "P0", sourceType: "RETAILER" },
  { domain: "kidikidi.elandmall.co.kr", priority: "P1", sourceType: "VERTICAL" },
];

/** 🟢 운영 `hopSites` 유도를 **그대로** 재현한다(손으로 사이트를 넣지 않는다 · §5-B). */
function hopSites(produced: string[]): string[] {
  return REGISTRY_SNAPSHOT.filter((s) => !produced.includes(s.domain))
    .filter((s) => isListingHopTarget(s))
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.domain.localeCompare(b.domain))
    .slice(0, MAX_LISTING_HOP_SITES)
    .map((s) => s.domain);
}

describe("CORE-2R-7 E — 정답 샵이 상한에 잘리지 않는다", () => {
  /** 🔴🔴 이 단언 하나가 이번 FAIL 의 재발을 막는다. */
  it("E-1 🟢🟢 `donokids.com` 이 실제 `hopSites` 에 **들어간다**", () => {
    const sites = hopSites(["looxloo.com"]);
    expect(sites, "🔴 정답 샵이 상한/정렬에서 잘렸다 — CEO FAIL 이 재발한다").toContain("donokids.com");
  });

  /** 🔴 포털/오픈마켓은 **빠진다**(메모 `portal-scraping-blocked-by-terms` 의 기존 판단). */
  it("E-2 🔴 MARKETPLACE 6곳은 대상에서 빠진다", () => {
    const sites = hopSites([]);
    for (const portal of ["29cm.co.kr", "danawa.com", "musinsa.com", "shoppinghow.kakao.com", "ssfshop.com", "wconcept.co.kr"]) {
      expect(sites, `${portal} 는 포털이라 목록 탐색 대상이 아니다`).not.toContain(portal);
    }
  });

  /** 🔴 `sourceType = null` 은 「분류되지 않음」이지 「포털」이 아니다 — allowlist 금지. */
  it("E-3 🔴 분류되지 않은 행(null)은 **남는다**", () => {
    expect(isListingHopTarget({ sourceType: null })).toBe(true);
    expect(isListingHopTarget({ sourceType: "RETAILER" })).toBe(true);
    expect(isListingHopTarget({ sourceType: "VERTICAL" })).toBe(true);
    expect(isListingHopTarget({ sourceType: "MARKETPLACE" })).toBe(false);
  });

  /** 🔴 상한은 **백스톱** 으로만 남는다 — 실제 대상 수를 자르지 않는다. */
  it("E-4 🟢 전문몰 전수가 상한 안에 들어간다", () => {
    const eligible = REGISTRY_SNAPSHOT.filter((s) => isListingHopTarget(s));
    expect(eligible.length).toBe(13);
    expect(eligible.length).toBeLessThanOrEqual(MAX_LISTING_HOP_SITES);
    expect(hopSites(["looxloo.com"]).length).toBe(12);
  });

  /** 🟢 운영 판정 함수를 **그대로** 쓴다는 것을 같이 잠근다(사본 0). */
  it("E-5 🔴 `isBatchSurveyTarget` 은 그대로다 — 이번에 바꾸지 않았다", () => {
    const base = { enabled: true, status: "ACTIVE" as const, accessStatus: null, categoryScope: ["KIDS_FASHION"] };
    expect(isBatchSurveyTarget(base, ["KIDS_FASHION"])).toBe(true);
    expect(isBatchSurveyTarget({ ...base, enabled: false }, ["KIDS_FASHION"])).toBe(false);
    expect(isBatchSurveyTarget({ ...base, accessStatus: "BLOCKED" }, ["KIDS_FASHION"])).toBe(false);
  });
});
