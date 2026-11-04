import { describe, expect, it } from "vitest";
import { fetchPlainHtmlWithFinalUrl } from "../shopify-product-json";
import { probeSmallableMarkets, readSmallableMarketPrice, parseSmallableProductId } from "../smallable-market-probe";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PHASE 1 — **Smallable 라이브 실측**(운영 fetch 경로 그대로 · 과금 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 코드 변경 0.** 이 파일은 **읽기만** 한다.
 * 🔴 **왜 운영 fetch 유틸을 쓰는가** — raw `node:https` 로 6조합을 던졌더니 **전건 403**
 *    이었다. 🔴 그것을 「사이트가 막는다」로 단정하지 않는다(WU-105 가 적어 둔 그 함정) —
 *    운영은 `fetchWithDomainRateLimit` + Chrome UA 를 쓰고 **2026-10-29 까지 실제로
 *    248행을 저장했다** ⟹ 내 요청 헤더가 부족했을 가능성이 먼저다.
 * 🟢 그래서 **운영이 쓰는 그 함수**(`fetchPlainHtmlWithFinalUrl`)로 다시 잰다(§5-B CONTROL).
 *
 * 🔴 게이트 — `PHASE1_LIVE=1` 없으면 건너뛴다(CI 에서 네트워크를 쓰지 않는다).
 */

const LIVE = process.env.PHASE1_LIVE === "1";

/** 🔴 DB 실측에서 가장 최근에 관측된 Smallable 상품(2026-10-29). */
const URL_BASE =
  "https://www.smallable.com/en/product/sherpa-cap-soucoupes-recycled-fiber-brown-bobo-choses-430753";

const COMBOS: [string, string][] = [
  ["currency=EUR&country=JP", "문서(09-13): EUR 81"],
  ["currency=JPY&country=JP", "문서: JPY 13,365 ← 일본 현지가"],
  ["currency=JPY&country=KR", "문서: JPY 12,045 ← 한국가를 엔화로"],
  ["currency=USD&country=US", "문서: USD 91"],
  ["currency=KRW&country=KR", "문서: KRW 114,464"],
  ["country=JP", "통화 미지정 — egress 가 정한다"],
];

describe.skipIf(!LIVE)("PHASE 1 — Smallable 라이브 실측", () => {
  it(
    "6조합 × 운영 fetch · 그리고 운영 probe 가 지금 무엇을 내는가",
    async () => {
      /* eslint-disable no-console */
      const productId = parseSmallableProductId(URL_BASE);
      console.log(`\n상품 ${URL_BASE}\n  productId=${productId}\n`);

      console.log("═══ ① 6조합 — 운영 fetch 경로(fetchPlainHtmlWithFinalUrl) ═══");
      const seen: { q: string; got: string }[] = [];
      for (const [q, note] of COMBOS) {
        const url = `${URL_BASE}?${q}`;
        let got = "🔴 fetch 실패";
        try {
          const r = await fetchPlainHtmlWithFinalUrl(url);
          if (r) {
            /** 🟢 운영 reader 를 그대로 쓴다 — 여기서 파서를 새로 만들지 않는다. */
            const reading = productId ? readSmallableMarketPrice(r.html, productId) : null;
            got = reading
              ? `${reading.currency} ${reading.amount}`
              : `🟡 읽기 실패(html ${r.html.length}B · final ${r.finalUrl.slice(0, 48)})`;
          }
        } catch (e) {
          got = `🔴 THREW ${(e as Error).message.slice(0, 40)}`;
        }
        seen.push({ q, got });
        console.log(`  ${q.padEnd(26)} → ${got.padEnd(34)} (${note})`);
        await new Promise((s) => setTimeout(s, 1200));
      }

      console.log("\n═══ ② 운영 probe — probeSmallableMarkets(현재 동작) ═══");
      try {
        const out = await probeSmallableMarkets(URL_BASE, []);
        console.log(`  반환 ${out.length}건`);
        for (const o of out) console.log(`    ${JSON.stringify(o)}`);
        /**
         * 🔴 그 반환에 **country 칸이 있는가** 가 PHASE 1 설계의 핵심이다 —
         *    저장부(`run-price-check.ts:137·218`)는 `probe.shopMeta?.country` 만 보고
         *    Smallable 은 Shopify 가 아니라 `shopMeta` 가 **항상 null** 이다.
         */
        console.log(`  🔵 반환 칸: ${out[0] ? Object.keys(out[0]).join(" · ") : "(없음)"}`);
      } catch (e) {
        console.log(`  🔴 THREW ${(e as Error).message.slice(0, 80)}`);
      }

      console.log("\n═══ ③ 요약 ═══");
      const ok = seen.filter((s) => /^[A-Z]{3} /.test(s.got));
      console.log(`  금액을 읽은 조합 ${ok.length}/${COMBOS.length}`);
      const currencies = [...new Set(ok.map((s) => s.got.split(" ")[0]))];
      console.log(`  관측된 통화 ${currencies.join(" · ") || "없음"}`);
      console.log(
        currencies.length > 1
          ? "  🟢🟢 **요청 통화가 실제로 먹는다** — 현지통화 관측이 가능하다"
          : "  🔴 통화가 하나뿐이다 — 요청 통화가 먹지 않거나 fetch 가 막혔다(둘을 가른 뒤 적는다)",
      );

      /** 🔴 PASS 조건은 **측정이 돌았다** 는 것뿐이다 — 숫자를 여기서 고정하지 않는다. */
      expect(seen.length).toBe(COMBOS.length);
    },
    10 * 60 * 1000,
  );
});
