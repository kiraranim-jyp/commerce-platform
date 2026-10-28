import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 DISCOVERY E2E-07 — **입구 손실 분해** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 목적은 하나다 — 「이미 한 번 검색한 결과가 왜 최종 동일상품 후보로 살아남지
 * 못하는가」를 **숫자로** 낸다. 🔴 검색을 더 잘하게 만들지 않는다.
 *
 * ── 🔴 금지(그대로 지킨다) ─────────────────────────────────────────────────
 * ```
 * 추가 Search 0 · Apify 0 · Query 변경 0 · retry 0 ·
 * UA 변경 0 · Cookie 0 · Proxy 0 · 브라우저 0 · 사이트별 adapter 0 ·
 * Identity/threshold/MI/Registry 변경 0 · 운영 로직 변경 0
 * ```
 *
 * ── 🔴 두 축을 섞지 않는다 ─────────────────────────────────────────────────
 * ```
 * ⒜ **운영 산출**  — `classifyUrlShape` · `collectUrlCandidatePool` 의 실제 reason
 * ⒝ **보조 probe** — HTTP 상태코드. 운영은 `UNREACHABLE` 하나로 뭉개서 돌려주므로
 *    (메모 `WU-105`: 「거부됨(4xx)」과 「닿지 못함」을 구분하지 못한다) **코드만**
 *    따로 잰다. 🔴 UA 를 바꾸지 않는다 — 기본 요청 1회씩이다(우회가 아니다).
 * ```
 *
 * ── 🔴 이 측정의 한계(먼저 적는다) ─────────────────────────────────────────
 * ```
 * ⒜ URL 9건은 **CEO 09:44 실행의 것이 아니다**(그 실행 URL 은 로그에 없다 ·
 *    영구 측정불가). 같은 질의의 **다른 실행** 산출이고 겹침은 3~30%(SP-10).
 * ⒝ fetch 는 이 PC(한국 가정용 IP)에서 나간다 — 운영은 Vercel egress 다.
 * ⒞ 🔴 **market 은 facts 가 있어야 난다.** 입구에서 죽은 URL 의 시장은
 *    **측정불가** 이고, 아래 표의 「도메인 추정」은 **추정** 이지 운영 판정이 아니다.
 * ```
 */

const LIVE = process.env.E2E07_LIVE === "1";
const CEO_ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";

function storedSearchUrls(): string[] {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "fixtures/search-provider-05-raw.json"), "utf8"),
  ) as { runs: { productId: string; query: string; results: { url: string }[] }[] };
  const run = raw.runs.find((r) => r.productId === "S2" && r.query === '"B226AC009"');
  if (!run) throw new Error("저장된 운영 질의 run 을 찾지 못했다");
  return run.results.map((r) => r.url);
}

/** 🔴 **추정** 이다 — 운영 `classifyCandidateMarket` 산출이 아니다(그건 facts 를 요구한다). */
function domainGuess(host: string): "🇰🇷추정" | "🌎추정" {
  return /\.kr$|\.co\.kr$|11st|gmarket|coupang|danawa|lfmall/.test(host) ? "🇰🇷추정" : "🌎추정";
}

describe("E2E-07 — 입구 손실 분해(추가 Search 0)", () => {
  it("🟢 분모 고정 — 재사용 URL 9건 · 새로 만들지 않았다", () => {
    expect(storedSearchUrls()).toHaveLength(9);
  });

  it.runIf(LIVE)(
    "🔴🔴 URL별 전 구간 — shape → pool → fetch(HTTP) → facts → judge",
    async () => {
      /** 🔴 barrel 에 없다 — 기존 하니스들과 **같은 깊은 경로** 를 쓴다(사본 금지). */
      const { classifyUrlShape } = await import("@commerce/crawler/src/comparison-search/url-shape");
      const urls = storedSearchUrls();

      /* ── ① 모양 게이트(순수 · HTTP 0) ─────────────────────────────────── */
      const shape = new Map(urls.map((u) => [u, classifyUrlShape(u)]));

      /* ── ② 운영 pool(실제 fetch) ──────────────────────────────────────── */
      const pool = await collectUrlCandidatePool({
        urls,
        originUrl: CEO_ORIGIN,
        maxUrls: 10,
        existingCanonicalUrls: new Set<string>(),
        shopId: "__web_search__",
        shopNamePrefix: "웹 검색 후보(일시)",
      });
      const dropReason = new Map(pool.metrics.dropped.map((d) => [d.url, d.reason]));
      const survivors = new Set<string>();
      for (const r of pool.searchResults) {
        if (r.status !== "ok") continue;
        for (const c of r.candidates) survivors.add(new URL(c.url).hostname);
      }

      /* ── ③ 🔴 HTTP «코드» 만 따로 — 운영은 UNREACHABLE 로 뭉갠다 ───────── */
      const httpCode = new Map<string, string>();
      for (const u of urls) {
        try {
          /** 🔴 UA 를 **바꾸지 않는다**(우회 금지) · 1회 · redirect 기본. */
          const res = await fetch(u, { signal: AbortSignal.timeout(25_000) });
          httpCode.set(u, String(res.status));
          await res.arrayBuffer();
        } catch (e) {
          const c = e as { code?: string; name?: string };
          httpCode.set(u, `ERR:${c.code ?? c.name ?? "?"}`);
        }
      }

      /* ── ④ 표 ─────────────────────────────────────────────────────────── */
      /* eslint-disable no-console */
      console.log(
        `\n[E2E07] host${" ".repeat(20)} 추정  shape            HTTP    pool결과`,
      );
      for (const u of urls) {
        const host = new URL(u).hostname;
        const alive = survivors.has(host);
        console.log(
          `[E2E07-url] ${host.padEnd(24)} ${domainGuess(host)} ${String(shape.get(u)).padEnd(16)} ` +
            `${String(httpCode.get(u)).padEnd(7)} ${alive ? "SURVIVED" : (dropReason.get(u) ?? "(기록없음)")}`,
        );
      }
      const m = pool.metrics;
      console.log(
        `[E2E07-kpi] ${JSON.stringify({
          raw: urls.length,
          productShape: [...shape.values()].filter((s) => s === "PRODUCT_PAGE").length,
          accepted: m.acceptedUrls,
          usable: m.usableProductUrls,
          miEligible: m.miEligibleCandidates,
          fetchCalls: m.fetchCalls,
        })}`,
      );
      const by403 = urls.filter((u) => httpCode.get(u) === "403").map((u) => new URL(u).hostname);
      console.log(`[E2E07-403] ${by403.length}건 — ${by403.join(" · ")}`);

      /** 🔴 측정이다 — 수치를 미리 고정하지 않는다(분모만 잠근다). */
      expect(m.suppliedUrls).toBe(9);
    },
    600_000,
  );
});
