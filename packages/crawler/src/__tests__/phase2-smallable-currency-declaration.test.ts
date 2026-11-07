import { describe, expect, it } from "vitest";
import { fetchPlainHtmlWithFinalUrl } from "../shopify-product-json";
import { parseSmallableProductId, readSmallableMarketPrice } from "../smallable-market-probe";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PHASE 2 — **「Smallable 이 통화를 스스로 선언하는가」**(라이브 · 읽기 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 코드 변경 0 · DB 0 · 과금 0.** 운영 fetch 경로(`fetchPlainHtmlWithFinalUrl`)만 쓴다.
 * 🔴 게이트 `PHASE2_LIVE=1` — 없으면 건너뛴다(CI 네트워크 0).
 *
 * ── 왜 이 질문인가 ──────────────────────────────────────────────────────────
 * `docs/global-market-local-currency-probe.md` §4 질문 1 이 **유일하게 미확인** 으로
 * 남긴 축이다: 「사이트가 스스로 선언하는 값을 쓸 수 있는가?(Shopify `localization`/
 * `/meta.json` 은 가능, **Smallable 은 미확인**)」
 *
 * 🔴 이것이 중요한 이유 — 현지통화 관측에는 「시장 → 통화」 대응이 필요하고,
 *    그것을 **코드에 심는 것은 `GLOBAL-SOURCE-PRICE-POLICY-FINAL` §F 가 금지** 한다.
 *    ⟹ **사이트가 선언한다면 금지를 피해서 구현할 수 있고, 선언하지 않으면 CPO 결정이다.**
 * 🔴 PHASE 1 은 「요청 통화가 먹는가」만 쟀다(먹는다). 「우리가 무엇을 요청해야 하는지를
 *    사이트가 알려주는가」는 **재지 않았다** — 그 공백이 이 파일이다.
 *
 * 🔴 **추측하지 않는다.** 선언 자리를 찾지 못하면 「없다」가 아니라 **「이 경로에서
 *    확인되지 않았다」** 로 적는다(§5-B).
 */

const LIVE = process.env.PHASE2_LIVE === "1";

/** 🔴 DB 실측(2026-11-07 · phase2-jp-currency.mjs ⑤)에서 가장 최근 Smallable 상품. */
const URL_BASE =
  "https://www.smallable.com/en/product/sherpa-cap-soucoupes-recycled-fiber-brown-bobo-choses-430753";

/** ISO 4217 세 글자 통화 후보. 🔴 이 목록은 «찾는 대상» 이고 매핑이 아니다. */
const CURRENCY_CODES = ["EUR", "JPY", "USD", "GBP", "KRW", "CHF", "AUD", "CAD", "SEK", "DKK", "NOK", "PLN"];

/** 선언 자리 후보 — 각각 **서로 다른 가설** 이다. 하나라도 맞으면 §F 를 피할 수 있다. */
function findCurrencyDeclarations(html: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const push = (k: string, v: string) => {
    (out[k] ??= []).push(v.length > 220 ? `${v.slice(0, 220)}…` : v);
  };

  // ⒜ 국가 ↔ 통화가 **같은 객체** 안에 있는 JSON 조각.
  for (const m of html.matchAll(
    /\{[^{}]{0,200}?"(?:country|countryCode|iso|code)"\s*:\s*"[A-Za-z]{2}"[^{}]{0,200}?"(?:currency|currencyCode)"\s*:\s*"[A-Z]{3}"[^{}]{0,200}?\}/g,
  )) {
    push("A_country_currency_same_object", m[0]);
  }
  // ⒝ 역순(통화가 먼저).
  for (const m of html.matchAll(
    /\{[^{}]{0,200}?"(?:currency|currencyCode)"\s*:\s*"[A-Z]{3}"[^{}]{0,200}?"(?:country|countryCode|iso|code)"\s*:\s*"[A-Za-z]{2}"[^{}]{0,200}?\}/g,
  )) {
    push("B_currency_country_same_object", m[0]);
  }
  // ⒞ `currency` 키가 등장하는 모든 자리(분모를 보기 위해).
  for (const m of html.matchAll(/"(?:currency|currencyCode|priceCurrency)"\s*:\s*"([A-Z]{3})"/g)) {
    push(`C_currency_key_${m[1]}`, m[0]);
  }
  // ⒟ 통화 **기호** 가 국가 선택기에 붙어 있는가(`JP ¥` 같은 모양).
  for (const m of html.matchAll(/[A-Z]{2}[^<>{}]{0,24}?(?:¥|￥|＄|\$|£|€|₩)/g)) push("D_country_symbol_pair", m[0]);
  // ⒠ 통화 코드 **글자** 가 몇 종류 등장하는가.
  for (const code of CURRENCY_CODES) {
    const n = html.split(code).length - 1;
    if (n > 0) push("E_currency_code_occurrences", `${code}×${n}`);
  }
  // ⒡ Next.js 데이터 블록이 있는가(있으면 그 안을 더 파볼 수 있다).
  for (const m of html.matchAll(/id="(__NEXT_DATA__|__NUXT__|__INITIAL_STATE__)"/g)) push("F_data_blob", m[1]);
  // ⒢ 배송 가능 국가 목록을 선언하는가(문서 §4 질문 2 — 프로브 가드의 근거).
  for (const m of html.matchAll(
    /"(?:ships?To|shippingCountries|availableCountries|deliveryCountries|countries)"\s*:\s*\[[^\]]{0,200}\]/g,
  )) {
    push("G_ships_to_declaration", m[0]);
  }
  return out;
}

describe.skipIf(!LIVE)("PHASE 2 — Smallable 통화 선언 여부(라이브)", () => {
  it(
    "① JP 조회가 실제 JPY 인가 ② 사이트가 국가→통화를 선언하는가",
    async () => {
      /* eslint-disable no-console */
      const productId = parseSmallableProductId(URL_BASE);
      expect(productId).toBeTruthy();
      console.log(`\n상품 ${URL_BASE}\n  productId=${productId}\n`);

      /* ─────────────── ① CPO 질문: JP 조회 결과가 실제 JPY 인가 ─────────────── */
      console.log("═══ ① JP 축 — 운영이 요청하는 모양 ↔ 현지통화를 요청한 모양 ═══");
      const JP_AXES: [string, string][] = [
        ["currency=EUR&country=JP", "🔴 **운영이 지금 보내는 요청**(withSourceMarketCountry)"],
        ["currency=JPY&country=JP", "🔵 현지통화를 «명시» 했을 때"],
        ["country=JP", "🔴 통화 미지정 — egress 가 정한다(RULE 1 위반 경로)"],
      ];
      const jp: { q: string; cur: string | null; amt: number | null }[] = [];
      let htmlForDeclaration = "";
      for (const [q, note] of JP_AXES) {
        let cur: string | null = null;
        let amt: number | null = null;
        try {
          const r = await fetchPlainHtmlWithFinalUrl(`${URL_BASE}?${q}`);
          if (r) {
            if (!htmlForDeclaration) htmlForDeclaration = r.html;
            const reading = productId ? readSmallableMarketPrice(r.html, productId) : null;
            if (reading) {
              cur = reading.currency;
              amt = reading.amount;
            }
          }
        } catch (e) {
          console.log(`    🔴 THREW ${(e as Error).message.slice(0, 60)}`);
        }
        jp.push({ q, cur, amt });
        console.log(`  ${q.padEnd(26)} → ${(cur ? `${cur} ${amt}` : "🔴 읽기 실패").padEnd(16)} ${note}`);
        await new Promise((s) => setTimeout(s, 1200));
      }

      const operational = jp.find((r) => r.q === "currency=EUR&country=JP");
      const explicit = jp.find((r) => r.q === "currency=JPY&country=JP");
      console.log(
        `\n  🔵 **CPO 질문의 답** — 운영 요청의 JP 응답 통화 = ${operational?.cur ?? "미확인"} ` +
          `⟹ ${operational?.cur === "JPY" ? "🟢 JPY 다" : "🔴 **JPY 가 아니다**"}`,
      );

      /* ─────────────── ② 사이트가 국가→통화를 선언하는가 ─────────────── */
      console.log("\n═══ ② 통화 선언 자리 전수 탐색(가설 7개) ═══");
      if (!htmlForDeclaration) {
        console.log("  🔴 HTML 을 받지 못했다 — 이 축은 **측정불가** 다(「선언하지 않는다」로 적지 않는다)");
      } else {
        console.log(`  (HTML ${htmlForDeclaration.length}B)`);
        const found = findCurrencyDeclarations(htmlForDeclaration);
        for (const key of [
          "A_country_currency_same_object",
          "B_currency_country_same_object",
          "D_country_symbol_pair",
          "F_data_blob",
          "G_ships_to_declaration",
          "E_currency_code_occurrences",
        ]) {
          const hits = found[key];
          console.log(`  ${key.padEnd(34)} ${hits ? `${hits.length}건` : "🔴 0건"}`);
          for (const h of (hits ?? []).slice(0, 4)) console.log(`      ${h}`);
        }
        const curKeys = Object.keys(found).filter((k) => k.startsWith("C_currency_key_"));
        console.log(`  C_currency_key_*  (통화 키가 선언한 값) ${curKeys.map((k) => k.slice(15)).join(" · ") || "🔴 0건"}`);

        const declaresPair =
          (found.A_country_currency_same_object?.length ?? 0) + (found.B_currency_country_same_object?.length ?? 0);
        console.log(
          `\n  🔵 **§4 질문 1 의 답** — 국가↔통화를 같은 자리에 선언하는가: ` +
            `${declaresPair > 0 ? `🟢 **그렇다(${declaresPair}건)** ⟹ §F 없이 구현 가능` : "🔴 **이 경로에서 확인되지 않았다** ⟹ CPO 결정 사안"}`,
        );
      }

      /** 🔴 PASS 조건은 **측정이 돌았다** 는 것뿐이다 — 숫자를 여기서 고정하지 않는다. */
      expect(jp.length).toBe(JP_AXES.length);
    },
    10 * 60 * 1000,
  );
});
