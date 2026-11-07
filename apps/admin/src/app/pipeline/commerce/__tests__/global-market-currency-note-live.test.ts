import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, type MarketObservationInput } from "../global-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵 **실제 운영 데이터 사례 / 비발화 사례**(CPO 완료 보고 요구 · 2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「완료 후 **실제 운영 데이터 사례와 비발화 사례를 각각** 보고한다.」
 * 🔴 네트워크 0 · DB 0 — 아래 표는 **운영 DB 전수 질의 결과를 그대로 베낀 것** 이다
 *    (`price_observations` · `source_label='MARKET_PROBE'` · `market_code` 비어 있지 않음 ·
 *     2026-11-07 · 재현 스크립트는 `docs/WORKORDER-GLOBAL-MARKET-CURRENCY-NOTE.md` §3-1).
 * 🟢 **운영 함수를 그대로 부른다** — 조건식을 여기서 복제하지 않는다(§5-B CONTROL).
 *
 * 🔴 분모 — 판매처 **8곳**. 🔴 「모든 판매처에서 맞다」로 적지 않는다(새 판매처가 늘면 바뀐다).
 */

/** 🔴 운영 DB 실측 — `(host, market_code, currency)` 조합 전수. 손으로 꾸미지 않았다. */
const PRODUCTION_ROWS: { host: string; market: string; currency: string }[] = [
  { host: "bobochoses.co.jp", market: "en-int", currency: "JPY" },
  { host: "bobochoses.com", market: "en-de", currency: "EUR" },
  { host: "bobochoses.com", market: "en-fr", currency: "EUR" },
  { host: "bobochoses.com", market: "en-int", currency: "EUR" },
  { host: "bobochoses.com", market: "en-us", currency: "USD" },
  { host: "louisemisha.com", market: "en-au", currency: "AUD" },
  { host: "louisemisha.com", market: "en-ca", currency: "CAD" },
  { host: "louisemisha.com", market: "en-de", currency: "EUR" },
  { host: "louisemisha.com", market: "en-gb", currency: "GBP" },
  { host: "louisemisha.com", market: "en-jp", currency: "JPY" },
  { host: "louisemisha.com", market: "en-us", currency: "USD" },
  { host: "luksusbaby.kr", market: "en-int", currency: "KRW" },
  { host: "main-story.com", market: "en-int", currency: "GBP" },
  { host: "www.junioredition.com", market: "en-au", currency: "AUD" },
  { host: "www.junioredition.com", market: "en-int", currency: "GBP" },
  { host: "www.junioredition.com", market: "en-int", currency: "JPY" },
  { host: "www.smallable.com", market: "fr", currency: "EUR" },
  { host: "www.smallable.com", market: "jp", currency: "EUR" },
  { host: "www.smallable.com", market: "kr", currency: "EUR" },
  { host: "www.smallable.com", market: "us", currency: "EUR" },
  { host: "www.wynken.co.uk", market: "en-int", currency: "GBP" },
];

/** 🔴 금액은 이 축과 무관하다 — 「금액이 있다」만 필요하므로 1 로 둔다(발화 조건은 통화·지역이다). */
const toObservation = (r: { market: string; currency: string }): MarketObservationInput => ({
  marketCode: r.market,
  currency: r.currency,
  priceAmount: 1,
  priceKrw: 1,
});

function byHost(): Map<string, MarketObservationInput[]> {
  const out = new Map<string, MarketObservationInput[]>();
  for (const r of PRODUCTION_ROWS) {
    const list = out.get(r.host) ?? [];
    list.push(toObservation(r));
    out.set(r.host, list);
  }
  return out;
}

describe("E. 실제 운영 데이터 — 발화 / 비발화 전수", () => {
  it("E-1 🔴 발화 사례 — 판매처 8곳 중 «한 곳» 이다", () => {
    const fired: string[] = [];
    for (const [host, observations] of byHost()) {
      if (buildGlobalMarketCard({ observations }).currencyNote !== null) fired.push(host);
    }
    // 🔴 호스트 이름이 코드에 **없다** — 조건이 데이터에서 계산된다는 증거다.
    expect(fired).toEqual(["www.smallable.com"]);
  });

  it("E-2 🟢 발화 사례의 문구 — 통화가 관측에서 왔다", () => {
    const note = buildGlobalMarketCard({ observations: byHost().get("www.smallable.com")! }).currencyNote;
    expect(note).toBe("가격 기준 통화 EUR · 배송국가를 지정해 조회한 가격입니다(현지통화 가격이 아닙니다)");
  });

  it("E-3 🔴🔴 비발화 사례 **일곱 곳** — 각각 «다른 이유» 다", () => {
    const h = byHost();
    const reason = (host: string) => {
      const obs = h.get(host)!;
      const currencies = new Set(obs.map((o) => o.currency));
      const regions = new Set(
        obs.map((o) => /^(?:[a-z]{2}-)?([a-z]{2})$/.exec(o.marketCode)?.[1]).filter(Boolean),
      );
      return { currencies: currencies.size, regions: regions.size };
    };

    // ⒜ **통화가 여러 종** — 시장별 통화를 말하는 판매처다(붙이면 거짓이 된다).
    for (const host of ["louisemisha.com", "bobochoses.com", "www.junioredition.com"]) {
      expect(buildGlobalMarketCard({ observations: h.get(host)! }).currencyNote, host).toBeNull();
      expect(reason(host).currencies, host).toBeGreaterThan(1);
    }
    // ⒝ **지역이 0** — `en-int` 단독이라 국가가 없다(모르면 말하지 않는다).
    for (const host of ["bobochoses.co.jp", "luksusbaby.kr", "main-story.com", "www.wynken.co.uk"]) {
      expect(buildGlobalMarketCard({ observations: h.get(host)! }).currencyNote, host).toBeNull();
      expect(reason(host).regions, host).toBe(0);
    }
    // 🔴 비발화 사유를 **합계로** 센다(3 + 4 = 7). 둘을 겹쳐 세지 않는다.
    expect(h.size - 1).toBe(7);
    // 🟡 junioredition 은 **두 조건 모두** 미달이다(통화 3 · 지역 1) — ⒜ 로만 센다.
    expect(reason("www.junioredition.com")).toEqual({ currencies: 3, regions: 1 });
  });

  it("E-4 🔴 분모를 적는다 — 판매처 8곳 · 조합 21건", () => {
    // 🔴 **이 단언이 내 전사 누락을 잡았다** — `www.wynken.co.uk` 를 빠뜨려 7/20 이었다.
    //    손으로 베낀 표는 **개수를 같이 단언** 한다(그 줄이 없으면 조용히 틀린다).
    expect(byHost().size).toBe(8);
    expect(PRODUCTION_ROWS).toHaveLength(21);
  });
});
