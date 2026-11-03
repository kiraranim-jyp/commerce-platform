import { describe, expect, it } from "vitest";
import { collectWebSearchUrls, webSearchIdentityFromDna } from "../web-search-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 4 GATE C1/C5 — **실제 상품 N개의 «실제 전달 질의» 를 찍는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「코드에 선언된 query 가 아니라 **runtime 에서 실제로 provider 에 전달되는
 * 최종 문자열**」. 🔴 그래서 이 하니스는 **문자열을 조립하지 않는다** —
 * ```
 * 원상품 추출(운영 전략) → buildProductIdentityDna(운영)
 *   → webSearchIdentityFromDna(**운영 owner**)
 *   → collectWebSearchUrls(**운영 함수**) → provider 경계에서 «건네진 값» 을 잡는다
 * ```
 * 🟢 **검색 과금 0** — provider 호출은 주입구(`search`)로 가로채고 빈 배열을 돌려준다.
 *    🔴 그래서 이 하니스는 **공급량(organic)을 측정하지 않는다**(그건 라이브 1회가 필요하다).
 * 🟢 HTTP 는 **원상품 추출뿐** 이고 그것은 무료다.
 *
 * 🔴 게이트 `SPRINT4_QUERY=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.SPRINT4_QUERY === "1";

/**
 * 🔴 **내가 고른 표본이 아니다** — 이 트랙이 운영에서 실제로 돌린 상품들이다:
 *    AC038 은 운영 DB `workspace.searchRun` + 운영 로그에 실행 기록이 있고,
 *    AC017/AC010/AC009 는 SPRINT 3 이 TEST 대상으로 쓴 실제 상품이다.
 * 🔴 URL 을 **지어내지 않았다** — 전부 저장소/운영 기록에 있는 그대로다.
 */
const PRODUCTS = [
  "https://bobochoses.com/en-kr/products/b226ac038-hidden-monster-sweatshirt",
  "https://bobochoses.com/en-kr/products/b226ac017-booo-bo-choses-t-shirt",
  "https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt",
  "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt",
];

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - String(s).length));

describe("SPRINT4-GATE-02 — 실제 상품의 runtime 질의", () => {
  it.runIf(LIVE)("🔎 상품마다 provider 에 건네지는 문자열을 그대로 찍는다", async () => {
    const { shopifySiteStrategy } = await import("@commerce/crawler/src/site-strategies/shopify.site-strategy");
    const { buildProductIdentityDna } = await import("@commerce/shared");
    const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");

    const rows: { url: string; query: string | null; ok: Record<string, boolean | null> }[] = [];

    for (const origin of PRODUCTS) {
      let query: string | null = null;
      let dna: Awaited<ReturnType<typeof buildProductIdentityDna>> | null = null;
      try {
        const extracted = await shopifySiteStrategy.extract(origin);
        const product = buildCanonicalProduct(origin, extracted!.productData as never, {} as never, []);
        dna = buildProductIdentityDna(product);
        /** 🔴 **운영 owner 둘** 을 그대로 부른다 — 베끼지 않는다. */
        const identity = webSearchIdentityFromDna(dna as never, origin);
        /**
         * 🔴 **지역 변수로 받지 않는다** — 콜백 안 대입을 TS 제어흐름이 추적하지 못해
         *    사용처에서 타입이 `never` 가 된다(typecheck 가 실제로 3건 잡았다).
         */
        const capture: { sent: string | null } = { sent: null };
        const out = await collectWebSearchUrls({
          identity: identity as never,
          search: async (q: string) => {
            capture.sent = q;
            return [];
          },
          token: "x",
        });
        /** 🔴 계측값이 아니라 **건네진 값** 을 쓴다(둘이 다르면 그 자체가 결함이다). */
        expect(out.metrics.query, "🔴 계측값과 전달값이 다르다").toBe(capture.sent);
        query = capture.sent;
      } catch (err) {
        /** 🔴 추출 실패를 「질의가 없다」로 적지 않는다 — **측정불가** 로 적는다. */
        query = null;
        /* eslint-disable-next-line no-console */
        console.log(`[EXTRACT_FAIL] ${origin} ${(err as Error)?.name ?? "?"}`);
      }

      const brand = dna?.brand.value || null;
      const code = dna?.brandModelCode ?? null;
      const nameHead = (dna?.title ?? "").split(/\s+/).filter(Boolean)[0] ?? null;
      const has = (s: string | null) => (s && query ? query.includes(s) : null);
      /**
       * 🔴🔴 **내 1차 라벨이 틀렸고 그대로 보고했으면 거짓이었다.**
       *    `material` 을 그대로 비교했더니 **전건 `facts=false`** 가 나왔다. 원인은
       *    배선이 아니라 그 값의 **모양** 이다 — 운영 material 은
       *    「Blue sweatshirt. Organic Cotton 66% … Responsibly made in Spain.」 처럼
       *    **문장** 이고, 조립기는 **긴 산문을 질의에 넣지 않는다**(3단어/28자 상한).
       *    🟢 그래서 실제 질의에 실리는 사실 조각은 **색상 · 핏** 이고 둘 다 들어가 있다.
       * 🔴 그러므로 「관측된 사실 조각이 **하나라도** 질의에 실렸는가」로 센다.
       */
      const factBits = [dna?.color ?? null, dna?.fit ?? null].filter((v): v is string => Boolean(v));
      const factsOk = query == null ? null : factBits.length === 0 ? null : factBits.some((f) => query!.includes(f));
      const ok = {
        brand: has(brand),
        code: has(code),
        name: has(nameHead),
        facts: factsOk,
        /** 🔴 **글자로** 본다(상수 import 금지 · 동어반복). */
        intent: query ? query.includes("국내해외 동일상품 판매처") : null,
      };
      rows.push({ url: origin, query, ok });

      /* eslint-disable no-console */
      console.log(
        `\n── ${origin}\n` +
          `   brand=${JSON.stringify(brand)} code=${JSON.stringify(code)} color=${JSON.stringify(dna?.color ?? null)} ` +
          `material=${JSON.stringify(dna?.material ?? null)} fit=${JSON.stringify(dna?.fit ?? null)}\n` +
          `   QUERY  ${JSON.stringify(query)}\n` +
          `   요소   brand=${pad(ok.brand, 5)} code=${pad(ok.code, 5)} name=${pad(ok.name, 5)} ` +
          `facts=${pad(ok.facts, 5)} intent=${ok.intent}`,
      );
    }

    /* eslint-disable no-console */
    console.log("\n═══ C2 판정표 (null = 그 상품에 그 재료가 «없다» = 측정불가) ═══");
    for (const r of rows) {
      console.log(
        `${pad(r.url.split("/").pop(), 42)} brand=${pad(r.ok.brand, 5)} code=${pad(r.ok.code, 5)} ` +
          `name=${pad(r.ok.name, 5)} facts=${pad(r.ok.facts, 5)} intent=${r.ok.intent}`,
      );
    }

    /** 🔴 **의도 신호는 질의가 만들어진 모든 상품에서 예외 없이** 들어가야 한다. */
    const built = rows.filter((r) => r.query);
    expect(built.length, "🔴 질의가 만들어진 상품이 하나도 없다 — 측정불가").toBeGreaterThanOrEqual(3);
    for (const r of built) {
      expect(r.ok.intent, `🔴🔴 판매처 의도가 빠졌다: ${r.url}`).toBe(true);
      /** 🔴 「브랜드 + 상품명」 뿐으로 쪼그라들지 않았다 — 식별자와 사실 조각이 같이 있다. */
      expect(r.ok.code, `🔴 품번이 질의에서 빠졌다: ${r.url}`).not.toBe(false);
      expect(r.ok.facts, `🔴 관측된 사실 조각이 질의에서 전부 빠졌다: ${r.url}`).not.toBe(false);
    }
  }, 600_000);
});
