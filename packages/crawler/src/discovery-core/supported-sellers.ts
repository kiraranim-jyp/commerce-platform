import { listPriceSourceAdapters } from "../comparison-search/price-source-adapter";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02 STEP A/B — **「가격 owner 가 있는 판매처」목록을 손으로 적지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 모듈이 존재하는 이유는 실제 사고다. 이 스프린트의 작업지시서에 registry 가
 * 「10개」로 적혀 있었고, 그 직전 세션 보고서에는 「11개」로 적혀 있었다.
 * **둘 다 틀렸다.** 실측(2026-10-11, `listPriceSourceAdapters()` 호출):
 *
 *     total 21 · OVERSEAS 13 · DOMESTIC 8 · 중복 0
 *
 * 두 숫자가 어떻게 나왔는지도 분명하다:
 *
 *     11  `grep -c "domain:"` — 타입 선언·함수 인자까지 센 값(13 에서 조정한 것)
 *     10  배열에 «직접 적힌» 객체 리터럴 수. 🔴 첫 줄
 *         `...SHOPIFY_SUGGEST_DOMAINS.map(shopifySuggestAdapter)` 가
 *         **11개를 더 넣는다** — 그 줄을 세지 않았다
 *
 * 🔴 그래서 작업지시서의 「🟢 배열 안 shopifySuggestAdapter() 호출 0건 — 동적
 *    추가 없음」은 **사실이 아니다**(price-source-adapter.ts:357 에 있다).
 *
 * ── 이 모듈이 지키는 것 ─────────────────────────────────────────────────────
 * 🔴 **문자열 목록을 복사하지 않는다.** registry 를 호출해 읽는다. 복사본을 두면
 *    어댑터를 하나 추가했을 때 Discovery 는 모르고, 그 순간 「가격 owner 가 있는
 *    판매처를 Gemini 가 못 찾는다」는 측정이 거짓이 된다 — 이 저장소가
 *    SHOPIFY_SUGGEST_DOMAINS 를 세 벌 적었다가 Rakuten 을 unsupported 로 만든
 *    것과 같은 실패다(price-source-adapter.ts 머리 주석).
 *
 * 🔴 **readiness 를 걸러내지 않는다.** rakuten.co.jp 는 자격증명이 없어
 *    NOT_CONFIGURED 지만 「파서가 있다」는 사실은 참이다. Discovery 가 그 도메인을
 *    찾는 것은 여전히 의미가 있고, 「키가 없어서 가격을 못 읽었다」와 「그 판매처를
 *    못 찾았다」는 **다른 실패** 다. 거르면 두 실패가 한 숫자로 합쳐진다.
 */

/** registry 에 파서가 «실제로» 있는 모든 도메인. 🔴 호출 시점에 읽는다. */
export function supportedPriceSourceDomains(): string[] {
  return listPriceSourceAdapters().map((a) => a.domain);
}

/**
 * 국내 가격 매칭 KPI 의 분모가 사는 쪽. 🔴 `catalog` 는 「지리」가 아니라 「어느
 * 카탈로그 테이블에 사는가」다(price-source-adapter.ts:162). bobochoses.com 이
 * DOMESTIC 인 것은 `/ko-kr/products/{handle}.json` 이 **KRW 절대가** 를 주기
 * 때문이고(bobochoses-kr.ts 실측), 브랜드 국적 때문이 아니다.
 */
export function domesticPriceSourceDomains(): string[] {
  return listPriceSourceAdapters()
    .filter((a) => a.catalog === "DOMESTIC")
    .map((a) => a.domain);
}

/**
 * 🔴 측정 보고서가 「무엇을 whitelist 로 보냈는가」를 추정하지 않게 하는 자리.
 *    숫자를 손으로 적지 않고 이 함수의 결과를 그대로 싣는다.
 */
export interface PriceSourceCoverage {
  total: number;
  overseas: number;
  domestic: number;
  /** 파서는 있지만 자격증명이 없어 호출 자체를 못 하는 도메인. */
  notConfigured: string[];
  /** 🔴 같은 도메인이 두 번 등록되면 whitelist 가 조용히 중복된다. 사실로 적는다. */
  duplicates: string[];
}

export function priceSourceCoverage(): PriceSourceCoverage {
  const all = listPriceSourceAdapters();
  const domains = all.map((a) => a.domain);
  return {
    total: all.length,
    overseas: all.filter((a) => a.catalog === "OVERSEAS").length,
    domestic: all.filter((a) => a.catalog === "DOMESTIC").length,
    notConfigured: all.filter((a) => a.readiness().state === "NOT_CONFIGURED").map((a) => a.domain),
    duplicates: domains.filter((d, i) => domains.indexOf(d) !== i),
  };
}

/**
 * 호스트가 registry 도메인에 «속하는가». 🔴 `includes` 로 재지 않는다 —
 * `evil-looxloo.com.attacker.net` 이 통과하고, 더 현실적으로는
 * `shop.littleluna.co.kr` 같은 서브도메인과 `littleluna.co.kr.other.com` 을
 * 가를 수 없다. 정확히 같거나 «점으로 끝나는 접미사» 일 때만 참이다.
 */
export function matchSupportedDomain(hostname: string, domains = supportedPriceSourceDomains()): string | null {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  for (const d of domains) {
    const domain = d.toLowerCase();
    if (host === domain || host.endsWith(`.${domain}`)) return d;
  }
  return null;
}
