import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 DISCOVERY E2E-04 — **운영 입구 함수에 CEO 실행과 «같은 입력» 을 넣는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 필요한가 — E2E-03 은 `.tsx` 배선만 봤다. CEO 실제 실행(07:55 KST ·
 *    배포 05:38 «이후»)의 런타임 로그는 이렇게만 말한다:
 * ```
 * [SP07-websearch] {"query":"\"B226AC009\"","searches":1,"organic":9,
 *                   "skipped":null,"failed":false}
 * ```
 * 🔴 그런데 그 뒤 **판정 로그에 web-search 도메인이 한 건도 없다.**
 *    `judgeDomesticCandidate` 가 `NO_CANDIDATES` 를 내면 **로그 없이 `continue`**
 *    하므로(run-domestic-price-check.ts:1761) 그 구간이 **완전히 침묵한다.**
 *
 * 🔴 **이 파일은 추측을 지운다** — 같은 9 URL · 같은 origin 을 운영
 *    `collectUrlCandidatePool` 에 넣어 **실제 drop 사유** 를 받는다.
 *
 * ── 🔴 이 측정의 한계(먼저 적는다) ──────────────────────────────────────────
 * ```
 * ⒜ URL 9건은 **CEO 실행의 것이 아니다** — 운영은 검색 URL 을 로그에 남기지
 *    않는다. 같은 질의(`"B226AC009"`)의 **다른 실행** 산출이고, SP-10 이
 *    실행 간 URL 겹침을 **3~30%** 로 측정했다 ⟹ 집합이 다를 수 있다
 * ⒝ fetch 는 **이 PC(한국 가정용 IP)** 에서 나간다. 운영은 Vercel egress 다
 *    ⟹ 「열렸다/못 열었다」는 IP 에 따라 갈릴 수 있다
 * ⒞ 🟢 반면 **입력 경계(모양 게이트)는 순수** 라 IP 와 무관하게 같다
 * ```
 */

const FIX = join(__dirname, "fixtures/search-provider-05-raw.json");
const LIVE = process.env.E2E04_LIVE === "1";

/** 🔴 CEO 실행 스냅샷의 **실제 origin**(운영 DB 실측 · 747221b4…). */
const CEO_ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";

function operatingQueryUrls(): string[] {
  const raw = JSON.parse(readFileSync(FIX, "utf8")) as {
    runs: { productId: string; query: string; results: { url: string }[] }[];
  };
  const run = raw.runs.find((r) => r.productId === "S2" && r.query === '"B226AC009"');
  if (!run) throw new Error("운영 질의 run 을 찾지 못했다");
  return run.results.map((r) => r.url);
}

describe("E2E-04 — AI Search 9건이 입구에서 어떻게 되는가", () => {
  it("🟢 분모 고정 — 운영 질의 산출은 9건이다", () => {
    expect(operatingQueryUrls()).toHaveLength(9);
  });

  it.runIf(LIVE)(
    "🔴 운영 `collectUrlCandidatePool` 에 그대로 넣는다(실제 HTTP)",
    async () => {
      const urls = operatingQueryUrls();
      const pool = await collectUrlCandidatePool({
        urls,
        originUrl: CEO_ORIGIN,
        maxUrls: 10,
        existingCanonicalUrls: new Set<string>(),
        shopId: "__web_search__",
        shopNamePrefix: "웹 검색 후보(일시)",
      });

      const m = pool.metrics;
      console.log(
        `[E2E04-pool] ${JSON.stringify({
          supplied: m.suppliedUrls,
          accepted: m.acceptedUrls,
          usable: m.usableProductUrls,
          miEligible: m.miEligibleCandidates,
          fetchCalls: m.fetchCalls,
          overLimit: m.notFetchedOverLimit.length,
        })}`,
      );
      for (const d of m.dropped) {
        console.log(`[E2E04-drop] ${new URL(d.url).hostname.padEnd(24)} ${d.reason}`);
      }
      for (const r of pool.searchResults) {
        console.log(
          `[E2E04-cand] ${r.domain.padEnd(24)} status=${r.status} n=${
            r.status === "ok" ? r.candidates.length : 0
          }`,
        );
      }
      /** 🔴 단언하지 않는다 — 이 블록은 **측정** 이다(수치를 미리 고정하면 관측이 아니다). */
      expect(m.suppliedUrls).toBe(9);
    },
    180_000,
  );

  /**
   * 🔴🔴 **IP 축을 가른다.** 위 블록은 이 PC(한국 가정용 IP)에서 나간다. 운영은
   *    데이터센터 egress 다. 「운영에서 못 연다」와 「그 사이트가 죽었다」를 섞지
   *    않으려면 **같은 URL 을 두 경로로** 열어 봐야 한다.
   * 🔴 프록시 URL 은 출력하지 않는다(자격증명이 들어 있다).
   * 🔴 이것은 **우회가 아니다** — UA 를 돌리거나 재시도를 늘리지 않는다. 같은 요청을
   *    **출구만 바꿔** 1회씩 보낸다.
   */
  it.runIf(LIVE)(
    "🔴 같은 9건을 **로컬 IP ↔ 데이터센터 IP** 로 각각 연다",
    async () => {
      /**
       * 🔴 1차에 `undici.request` 를 썼다가 **9/9 전부 `UND_ERR_INVALID_ARG`** 가
       *    났다. 바로 위 블록에서 11st·danawa 가 **열렸으므로** 그 값은 거짓이고,
       *    그대로 보고했으면 「로컬도 데이터센터도 전부 차단」이라는 **없는 사실** 을
       *    적을 뻔했다. 🟢 `undici.fetch`(운영 crawler 와 같은 API 모양)로 바꾼다.
       */
      const { ProxyAgent, fetch: uFetch } = await import("undici");
      const envText = readFileSync(join(__dirname, "../../../../../../.env.local"), "utf8");
      const matched = envText.match(/^OCI_PROXY_URL\s*=\s*"?([^"\r\n]+)"?/m);
      if (!matched) {
        console.log("[E2E04-egress] 🔴 OCI_PROXY_URL 없음 — 데이터센터 축 측정불가");
        return;
      }
      const agent = new ProxyAgent(matched[1]!);
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

      async function probe(url: string, viaProxy: boolean) {
        try {
          const res = await uFetch(url, {
            method: "GET",
            headers: { "user-agent": ua, accept: "text/html" },
            ...(viaProxy ? { dispatcher: agent } : {}),
            signal: AbortSignal.timeout(25_000),
          });
          const body = await res.text();
          return `${res.status}/${body.length}`;
        } catch (e) {
          const chain: string[] = [];
          let cur: unknown = e;
          while (cur && chain.length < 3) {
            const c = cur as { code?: string; message?: string; cause?: unknown };
            chain.push(c.code ?? c.message?.slice(0, 28) ?? "?");
            cur = c.cause;
          }
          return `ERR:${chain.join("<")}`;
        }
      }

      for (const u of operatingQueryUrls()) {
        const host = new URL(u).hostname;
        const direct = await probe(u, false);
        const dc = await probe(u, true);
        console.log(`[E2E04-egress] ${host.padEnd(24)} 로컬=${direct.padEnd(18)} 데이터센터=${dc}`);
      }
      expect(true).toBe(true);
    },
    300_000,
  );
});
