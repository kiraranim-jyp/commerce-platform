/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02 STEP A/B — registry 진실값 고정 + Discovery whitelist 주입
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 존재하는 이유는 **숫자를 두 번 틀렸기 때문**이다.
 *
 *     보고 ①  11개   `grep -c "domain:"` 로 셌다 → CPO 가 잡았다
 *     보고 ②  10개   「정정」하며 배열의 객체 리터럴만 셌다 → 작업지시서에 박혔다
 *     실측     21개   `listPriceSourceAdapters()` — 배열 첫 줄의
 *                     `...SHOPIFY_SUGGEST_DOMAINS.map(shopifySuggestAdapter)` 가
 *                     11개를 더 넣는다
 *
 * 🔴 그리고 작업지시서에 「🟢 배열 안 shopifySuggestAdapter() 호출 0건 — 동적
 *    추가 없음」이라고 적혀 있었다. 그 문장이 거짓이다. 문서가 틀리면 그 뒤의
 *    모든 판단이 틀린 전제에서 출발한다 — 그래서 **문서가 아니라 테스트** 로 잠근다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPriceSourceAdapters } from "../../comparison-search/price-source-adapter";
import { createGoogleDiscoveryProvider, GEMINI_API_KEY_ENV } from "../google-discovery";
import { generateQueries } from "../query-generator";
import {
  domesticPriceSourceDomains,
  matchSupportedDomain,
  priceSourceCoverage,
  supportedPriceSourceDomains,
} from "../supported-sellers";
import type { ProductIdentity } from "../types";

/* ═══════════════════════ STEP A — registry 진실값 ═══════════════════════ */

describe("🔴 MI-P0-02 STEP A — registry 는 owner 로 센다", () => {
  /**
   * 🔴 이 숫자는 **실측값** 이다(2026-10-11). 어댑터를 추가하면 이 테스트가 깨지고,
   *    그때 «의식적으로» 올려야 한다. 그것이 목적이다 — 조용히 늘어나면 whitelist
   *    효과 측정이 과거 숫자 위에서 돌아간다.
   */
  it("total 21 · OVERSEAS 13 · DOMESTIC 8 · 중복 0", () => {
    const coverage = priceSourceCoverage();
    expect(coverage.total).toBe(21);
    expect(coverage.overseas).toBe(13);
    expect(coverage.domestic).toBe(8);
    expect(coverage.duplicates).toEqual([]);
    // 🔴 OVERSEAS + DOMESTIC 이 total 과 같아야 한다 — 새 catalog 값이 생기면
    //    whitelist 가 조용히 그 도메인을 빠뜨린다.
    expect(coverage.overseas + coverage.domestic).toBe(coverage.total);
  });

  /** 🔴 rakuten 은 파서가 «있고» 자격증명이 «없다». 두 사실을 섞지 않는다. */
  it("NOT_CONFIGURED 는 rakuten 하나이고, whitelist 에서 빠지지 않는다", () => {
    expect(priceSourceCoverage().notConfigured).toEqual(["rakuten.co.jp"]);
    // 🔴 「키가 없어서 가격을 못 읽었다」와 「그 판매처를 못 찾았다」는 다른 실패다.
    expect(supportedPriceSourceDomains()).toContain("rakuten.co.jp");
  });

  /**
   * 🔴 **동적 등록이 있다.** 작업지시서는 「0건」이라고 적었다.
   *    배열에 직접 적힌 객체 리터럴보다 registry 가 «크다» 는 것으로 증명한다 —
   *    SHOPIFY_SUGGEST_DOMAINS 는 export 되지 않으므로 숫자를 복사하지 않는다.
   */
  it("🔴 배열은 spread 로 어댑터를 «더» 넣는다 — 리터럴만 세면 모자란다", () => {
    const src = stripComments(readSource());
    expect(src).toContain("...SHOPIFY_SUGGEST_DOMAINS.map(shopifySuggestAdapter)");
    const literalCount = (src.match(/^\s{4}domain:\s*"/gm) ?? []).length;
    expect(literalCount).toBe(10);
    expect(listPriceSourceAdapters().length).toBeGreaterThan(literalCount);
  });

  /**
   * 🔴 **틀린 세는 법이 틀렸다는 것을 테스트로 고정한다.** 이 단언이 FAIL 하면
   *    누군가 다시 grep 으로 세도 맞는 상태가 된 것이고, 그러면 이 테스트를
   *    지우면 된다. 그때까지는 grep 숫자를 KPI 에 쓸 수 없다는 증거다.
   */
  it("🔴 `grep -c \"domain:\"` 는 owner 와 다른 숫자를 준다", () => {
    const grepCount = (stripComments(readSource()).match(/domain:/g) ?? []).length;
    expect(grepCount).not.toBe(listPriceSourceAdapters().length);
  });

  it("DOMESTIC 8곳에 bobochoses.com 이 들어 있다 — 브랜드 국적이 아니라 KRW 때문이다", () => {
    const domestic = domesticPriceSourceDomains();
    expect(domestic).toHaveLength(8);
    expect(domestic).toContain("bobochoses.com");
    expect(domestic).not.toContain("childrensalon.com");
  });
});

function readSource(): string {
  return readFileSync(path.join(__dirname, "..", "..", "comparison-search", "price-source-adapter.ts"), "utf8");
}

/** 🔴 여덟 번 걸린 함정 — 소스 문자열 검사는 주석을 벗기고 한다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ═══════════════════ 도메인 매칭 — 접미사 공격 ═══════════════════ */

describe("🔴 matchSupportedDomain — `includes` 로 재지 않는다", () => {
  it("정확히 같거나 점으로 끝나는 접미사만 적중이다", () => {
    expect(matchSupportedDomain("littleluna.co.kr")).toBe("littleluna.co.kr");
    expect(matchSupportedDomain("www.littleluna.co.kr")).toBe("littleluna.co.kr");
    expect(matchSupportedDomain("shop.littleluna.co.kr")).toBe("littleluna.co.kr");
    // 실측: grounding 의 web.title 은 끝에 점이 붙어 오는 경우가 있다.
    expect(matchSupportedDomain("littleluna.co.kr.")).toBe("littleluna.co.kr");
  });

  it("🔴 접미사를 흉내낸 호스트는 적중이 아니다", () => {
    expect(matchSupportedDomain("littleluna.co.kr.attacker.net")).toBeNull();
    expect(matchSupportedDomain("evil-littleluna.co.kr")).toBeNull();
    expect(matchSupportedDomain("notlooxloo.com")).toBeNull();
    expect(matchSupportedDomain("")).toBeNull();
  });
});

/* ═══════════════════ STEP B — whitelist 주입 ═══════════════════ */

const IDENTITY: ProductIdentity = {
  brand: "Main Story",
  productName: "Bubble Sweatshirt",
  productType: "Sweatshirt",
  genderAge: null,
  color: "Grey Melange",
  size: null,
  season: "AW26",
  productCode: "AW26MS185",
  sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  sourceSite: "junioredition.com",
  sourceCountry: "GB",
  market: "GB",
};

describe("🔴 MI-P0-02 STEP B — Discovery 프롬프트의 whitelist", () => {
  const saved = process.env[GEMINI_API_KEY_ENV];
  let sentBody = "";

  beforeEach(() => {
    process.env[GEMINI_API_KEY_ENV] = "synthetic-not-a-real-key";
    sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_i: unknown, init?: { body?: string }) => {
        sentBody = init?.body ?? "";
        return new Response(JSON.stringify({ candidates: [{ groundingMetadata: { groundingChunks: [] } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    if (saved === undefined) delete process.env[GEMINI_API_KEY_ENV];
    else process.env[GEMINI_API_KEY_ENV] = saved;
    vi.unstubAllGlobals();
  });

  const send = async (options?: Parameters<typeof createGoogleDiscoveryProvider>[0]) => {
    const provider = createGoogleDiscoveryProvider(options);
    await provider.discover(IDENTITY, generateQueries(IDENTITY)[0]);
    return provider;
  };

  /**
   * 🔴 **안전 기본값.** 호출부가 whitelist 를 빠뜨리면 꺼지는 것이 아니라 켜진다.
   *    꺼진 채로 측정하면 「whitelist 를 켰는데 효과가 없다」는 거짓 결론이 나온다.
   */
  it("생략하면 registry 전체가 프롬프트에 실린다", async () => {
    const provider = await send();
    const domains = supportedPriceSourceDomains();
    expect(provider.preferredDomains()).toEqual(domains);
    for (const d of domains) expect(sentBody, `${d} 가 프롬프트에 없다`).toContain(d);
  });

  /** 🔴 대조군(baseline)은 `[]` 를 **명시** 해야 만들어진다. */
  it("`[]` 를 명시하면 whitelist 문단이 통째로 사라진다", async () => {
    const provider = await send({ preferredDomains: [] });
    expect(provider.preferredDomains()).toEqual([]);
    expect(sentBody).not.toContain("반드시 함께 포함");
    /* 🔴 MI-014 — **문구가 아니라 «의도» 를 잠근다.** Prompt v2 에서 어미가
     *    「마세요」→「마라」로 바뀌어 리터럴 단언이 깨졌다. 의도는 그대로다 —
     *    다음 prompt 수정에 또 깨지지 않도록 정규식으로 본다. */
    expect(sentBody).not.toMatch(/목록에만 한정하지/);
    // 🔴 registry 도메인이 한 곳도 새어 들어가지 않아야 한다 — 하나라도 남으면
    //    대조군이 대조군이 아니다.
    for (const d of supportedPriceSourceDomains()) {
      expect(sentBody, `baseline 인데 ${d} 가 실렸다`).not.toContain(d);
    }
  });

  /**
   * 🔴 whitelist 를 **배타적으로 만들지 않는다.** 목록만 보게 하면 어댑터가 없는
   *    판매처를 영구히 못 보고, 「어디에 어댑터를 더 붙여야 하는가」의 답을
   *    측정으로 얻을 수 없다 — false-negative 를 우리가 만들어 넣는 셈이다.
   */
  it("🔴 「목록에만 한정하지 마세요」가 같이 실린다", async () => {
    await send();
    /* 🔴 MI-014 — **문구가 아니라 «의도» 를 잠근다.** Prompt v2 에서 어미가
     *    「마세요」→「마라」로 바뀌어 리터럴 단언이 깨졌다. 의도는 그대로다 —
     *    다음 prompt 수정에 또 깨지지 않도록 정규식으로 본다. */
    expect(sentBody).toMatch(/목록에만 한정하지/);
  });

  /** 🔴 whitelist 를 넣으면서 판정 요구를 끼워 넣지 않았다(P5.4-C §7 유지). */
  it("🔴 판정 금지 문구가 그대로 남아 있다", async () => {
    await send();
    /* 🔴 MI-014 — **문구가 아니라 «의도» 를 잠근다.** Prompt v2 에서 어미가
     *    「마세요」→「마라」로 바뀌어 리터럴 단언이 깨졌다. 의도는 그대로다 —
     *    다음 prompt 수정에 또 깨지지 않도록 정규식으로 본다. */
    /** 🟢 v2 는 「동일상품인지 **판정하지 마라**」로 적는다 — 둘 다 받는다. */
    expect(sentBody).toMatch(/판[단정]하지 마/);
    expect(sentBody).not.toContain("동일한 상품인지");
    expect(sentBody).not.toContain("같은 상품인지 알려");
    // 기존 단언(브랜드·품번 적재)도 유지된다.
    expect(sentBody).toContain("Main Story");
    expect(sentBody).toContain("AW26MS185");
  });

  /**
   * 🔴 `preferredDomains()` 가 **실제로 보낸 것** 을 말해야 한다. 이 접근자가
   *    프롬프트와 어긋나면 보고서가 「켰다고 생각했는데 안 켜져 있었다」를
   *    만들 수 있다 — 이 저장소가 반복한 사고다.
   */
  it("🔴 preferredDomains() 와 프롬프트가 어긋나지 않는다", async () => {
    const only = ["littleluna.co.kr", "looxloo.com"];
    const provider = await send({ preferredDomains: only });
    expect(provider.preferredDomains()).toEqual(only);
    for (const d of only) expect(sentBody).toContain(d);
    expect(sentBody).not.toContain("chocoel.co.kr");
  });
});
