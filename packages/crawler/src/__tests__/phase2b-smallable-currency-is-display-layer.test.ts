import { describe, expect, it } from "vitest";
import { fetchPlainHtmlWithFinalUrl } from "../shopify-product-json";
import { parseSmallableProductId, readSmallableMarketPrice } from "../smallable-market-probe";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 PHASE 2-B — **「요청 통화」가 현지 시장가인가, 사이트 자체 환산인가**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 코드 변경 0 · DB 0 · 과금 0.** 운영 fetch 경로만 쓴다. 게이트 `PHASE2_LIVE=1`.
 *
 * ── 이 측정이 이 WU 의 전제를 가른다 ────────────────────────────────────────
 * `docs/global-market-local-currency-probe.md` 의 완료 조건 1·2 는
 * 「JP 행이 **실제 JPY 관측** 으로 표시된다」인데, 그 전제는
 * **「`?currency=JPY` 가 돌려주는 값이 일본 시장이 스스로 정한 엔화 가격」** 이다.
 *
 * 🔴 PHASE 2 실측이 그 전제를 흔들었다:
 * ```
 *   country=JP  EUR 54      JPY 10078    →  10078 / 54 = 186.63
 *   country=KR  EUR 49      JPY  9145    →   9145 / 49 = 186.63   (PHASE 1 값)
 * ```
 * 두 비율이 **같다.** 같다면 `currency=` 는 시장이 아니라 **표시 계층** 이고,
 * 그 JPY 는 **사이트가 자기 환율로 EUR 를 바꾼 값** 이다.
 *
 * 🔴🔴 그러면 그것을 저장하는 것은 문서가 **절대 금지** 한 바로 그 행위가 된다 —
 *    「❌ €81 → 환율 → ¥13,365 로 표시하거나 저장」. 환산 주체가 우리에서
 *    사이트로 바뀌었을 뿐 **같은 산술** 이다.
 * 🟢 그리고 운영 코드가 **이미 그렇게 적어 뒀다**(`smallable-market-probe.ts:28-30`):
 *    「나라마다 현지 통화를 받으면 사이트 자체 환율 스프레드가 섞여서 시장 간 차이가
 *     『얼마나 다른가』가 아니라 『누구 환율인가』가 된다」.
 *
 * ── 어떻게 가르는가 ─────────────────────────────────────────────────────────
 * `currency` 가 표시 계층이면 **통화 간 비율이 국가와 무관하게 일정** 하다.
 * 시장이 스스로 정한 가격이면 **국가마다 비율이 달라야** 한다(끝수도 제각각이다).
 * 🔴 「비슷하다」로 판정하지 않는다 — 비율을 **국가 2개 × 통화 3개** 로 재고
 *    편차를 숫자로 적는다. 🔴 환율 API 를 쓰지 않는다(그 축은 이 질문과 무관하다).
 */

const LIVE = process.env.PHASE2_LIVE === "1";

const URL_BASE =
  "https://www.smallable.com/en/product/sherpa-cap-soucoupes-recycled-fiber-brown-bobo-choses-430753";

/** 🔴 국가 × 통화 격자. 같은 통화를 **여러 국가** 에서 재야 비율 불변을 증명할 수 있다. */
const COUNTRIES = ["JP", "KR", "US"];
const CURRENCIES = ["EUR", "JPY", "USD"];

describe.skipIf(!LIVE)("PHASE 2-B — currency 는 시장인가 표시 계층인가", () => {
  it(
    "국가 × 통화 격자에서 통화 간 비율이 국가와 무관하게 일정한가",
    async () => {
      /* eslint-disable no-console */
      const productId = parseSmallableProductId(URL_BASE)!;
      const grid: Record<string, Record<string, number | null>> = {};

      console.log(`\n상품 ${URL_BASE}  productId=${productId}\n`);
      console.log("═══ ① 국가 × 통화 격자(실측) ═══");
      for (const country of COUNTRIES) {
        grid[country] = {};
        for (const currency of CURRENCIES) {
          let amt: number | null = null;
          try {
            const r = await fetchPlainHtmlWithFinalUrl(`${URL_BASE}?currency=${currency}&country=${country}`);
            const reading = r ? readSmallableMarketPrice(r.html, productId) : null;
            // 🔴 응답 통화가 요청 통화와 다르면 그 칸은 **측정불가** 다(값을 쓰지 않는다).
            amt = reading && reading.currency === currency ? reading.amount : null;
          } catch {
            amt = null;
          }
          grid[country]![currency] = amt;
          await new Promise((s) => setTimeout(s, 1100));
        }
        console.log(
          `  country=${country}  ` +
            CURRENCIES.map((c) => `${c} ${grid[country]![c] ?? "🔴"}`.padEnd(14)).join(""),
        );
      }

      /* ─────────────── ② 통화쌍 비율 — 국가별로 비교한다 ─────────────── */
      console.log("\n═══ ② 통화쌍 비율(국가별) — 일정하면 «표시 계층» 이다 ═══");
      const verdicts: string[] = [];
      for (const [a, b] of [
        ["JPY", "EUR"],
        ["USD", "EUR"],
      ] as [string, string][]) {
        const ratios: { country: string; r: number }[] = [];
        for (const country of COUNTRIES) {
          const x = grid[country]![a];
          const y = grid[country]![b];
          if (x != null && y != null && y > 0) ratios.push({ country, r: x / y });
        }
        if (ratios.length < 2) {
          console.log(`  ${a}/${b}  🔴 분모 ${ratios.length} — **측정불가**(국가 2개 이상 필요)`);
          verdicts.push(`${a}/${b}=측정불가`);
          continue;
        }
        const vals = ratios.map((v) => v.r);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const spreadPct = ((max - min) / min) * 100;

        /**
         * 🔴🔴 **편차 임계값으로 판정하면 틀린다** — 1차 판정이 그렇게 해서
         *    `USD/EUR` 을 「🟢 시장별 독립(0.563%)」으로 **잘못** 찍었다. 금액이 정수로
         *    반올림되는 통화는 그 자체로 ±0.5 단위 잡음이 생긴다(USD 57 이면 약 0.9%).
         *
         * 🟢 올바른 검사는 **「하나의 환율이 격자 전부를 설명하는가」** 다.
         *    각 국가가 `round(base × r) == observed` 를 만족하는 `r` 구간을 주고,
         *    그 구간들의 **교집합이 비어 있지 않으면** 단일 환율로 설명된다 ⟹ 표시 계층.
         * 🔴 환율 API 를 쓰지 않는다 — 관측값만으로 닫히는 검사다.
         */
        let lo = -Infinity;
        let hi = Infinity;
        for (const country of COUNTRIES) {
          const x = grid[country]![a];
          const y = grid[country]![b];
          if (x == null || y == null || y <= 0) continue;
          // 표시 반올림 단위: 1 미만 소수가 보이면 0.01, 아니면 1.
          const unit = Number.isInteger(x) ? 1 : 0.01;
          lo = Math.max(lo, (x - unit / 2) / y);
          hi = Math.min(hi, (x + unit / 2) / y);
        }
        const singleRate = lo < hi;
        console.log(
          `  ${a}/${b}  ` +
            ratios.map((v) => `${v.country} ${v.r.toFixed(3)}`).join(" · ") +
            `   편차 ${spreadPct.toFixed(3)}%  ·  단일환율 구간 [${lo.toFixed(4)}, ${hi.toFixed(4)}] ` +
            `⟹ ${singleRate ? "🔴 설명된다" : "🟢 설명 안 된다"}`,
        );
        verdicts.push(
          singleRate
            ? `${a}/${b}=🔴 표시계층(단일환율이 ${ratios.length}국가 전부를 설명한다)`
            : `${a}/${b}=🟢 시장별 독립(단일환율로 설명되지 않는다)`,
        );
      }

      console.log("\n═══ ③ 판정 ═══");
      for (const v of verdicts) console.log(`  ${v}`);
      const displayLayer = verdicts.filter((v) => v.includes("표시계층")).length;
      console.log(
        displayLayer > 0
          ? "\n  🔴🔴🔴 **`?currency=` 는 표시 계층이다** — 그 값은 사이트 자체 환산이고\n" +
              "     저장하면 문서가 금지한 「환율로 현지 통화를 만들어 내기」와 **같은 산술** 이다.\n" +
              "     ⟹ 🔴 완료 조건 1·2(실제 JPY/USD 관측)는 **이 판매처에서 달성 불가** 다."
          : "\n  🟢 비율이 국가마다 다르다 — 시장별 독립 가격일 가능성이 있다(추가 검증 필요).",
      );

      /** 🔴 PASS 조건은 측정이 돌았다는 것뿐이다 — 숫자를 여기서 고정하지 않는다. */
      expect(Object.keys(grid).length).toBe(COUNTRIES.length);
    },
    15 * 60 * 1000,
  );
});
