/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-04 — Candidate Fetch Reliability (CPO 지시, 2026-10-11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 HTTP 를 쓴다.
 *
 * MI-P0-03 에서 후보의 48~52% 가 `NOT_READABLE` 이었다. 그것이 최대 병목이다.
 * 🔴 **「외부 사이트 문제」라고 단정하지 않는다**(CPO 금지). 원인을 갈라 센다.
 *
 * ── 🔴 분류 어휘를 «만들지 않는다» — owner 가 이미 갖고 있다 ────────────────
 *   `factsFromProductUrl` → `ProductUrlFactsStatus`
 *        OK · NOT_PRODUCT_URL · UNREACHABLE · NO_FACTS
 *   `fetchPath`  SHOPIFY_JSON · PLAIN_HTML · NONE
 *   `httpCalls`  코드가 직접 보고하는 요청 수
 *
 * 🔴 그런데 `UNREACHABLE` 안에는 차단(403/429) · 타임아웃 · DNS · TLS 가 «섞여»
 *    있다. 그래서 같은 URL 에 **raw HTTP 를 따로** 쳐서 상태코드를 본다 —
 *    그것 없이는 「우리 fetcher 문제」와 「사이트가 막는다」를 가를 수 없다.
 *
 * 🔴 그리고 **같은 URL 을 `universalExtract` 로도** 시도한다(Smallable 선례:
 *    Light Fetch UNREACHABLE · universalExtract 읽힘). 둘이 갈리면 그것은
 *    **외부 문제가 아니라 경로 문제** 다.
 *    🔴 비용이 크므로 universalExtract 는 «갈린 호스트의 대표 1건» 에만 쓴다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { CRAWLER_USER_AGENT } from "../../utils/user-agent";
import { createLivePageProbe } from "../live-page-probe";
import { resolveCandidate } from "../url-resolver";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

interface Rec { url: string; level: string; discovered: { url: string; title: string | null }[] }

/** 🔴 raw HTTP — 상태코드가 없으면 차단과 네트워크 실패를 가를 수 없다. */
async function rawProbe(url: string): Promise<{ status: number | null; bytes: number | null; err: string | null; server: string | null }> {
  try {
    const r = await fetch(url, {
      headers: { Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "User-Agent": CRAWLER_USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const server = r.headers.get("server") ?? (r.headers.get("cf-ray") ? "cloudflare" : null);
    const text = await r.text();
    return { status: r.status, bytes: text.length, err: null, server };
  } catch (e) {
    return { status: null, bytes: null, err: e instanceof Error ? `${e.name}: ${e.message.split("\n")[0]}` : "unknown", server: null };
  }
}

describe.skipIf(!LIVE)("🔴 MI-P0-04 — NOT_READABLE 원인 분류 (후보 전수)", () => {
  it(
    "resolve → Light Fetch status → raw HTTP 를 같이 재서 원인을 가른다",
    async () => {
      const p = path.join(OUT_DIR, "mi-p0-03-levels.json");
      if (!existsSync(p)) throw new Error(`선행 측정 없음: ${p}`);
      const { recs } = JSON.parse(readFileSync(p, "utf8")) as { recs: Rec[] };
      const urls = [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))];

      let probeBytes = 0;
      const probe = createLivePageProbe({ onResult: (r) => (probeBytes += r.bytes) });
      interface Row {
        url: string; host: string | null; finalUrl: string;
        classification: string; crawlerUrl: string | null;
        lfStatus: string; fetchPath: string; httpCalls: number;
        raw: { status: number | null; bytes: number | null; err: string | null; server: string | null } | null;
        /** 🔴 갈라 적는 최종 사유 — 어휘를 만들지 않고 위 값들의 «조합» 으로만 쓴다. */
        cause: string;
      }
      const rows: Row[] = [];
      for (const u of urls) {
        const resolved = await resolveCandidate(u, [], probe);
        let host: string | null = null;
        try { host = new URL(resolved.finalUrl).hostname.replace(/^www\./, ""); } catch {}
        let lf = { status: "SKIPPED_NOT_PRODUCT", fetchPath: "NONE", httpCalls: 0 };
        if (resolved.classification === "PRODUCT_PAGE" && resolved.crawlerUrl) {
          const r = await factsFromProductUrl(resolved.crawlerUrl);
          lf = { status: r.status, fetchPath: r.fetchPath, httpCalls: r.httpCalls };
        }
        // 🔴 raw HTTP 는 «읽지 못한» 것에만 쓴다 — 성공한 것에 또 요청하지 않는다.
        const needRaw = lf.status !== "OK";
        const raw = needRaw && resolved.crawlerUrl ? await rawProbe(resolved.crawlerUrl) : null;

        const cause =
          resolved.classification !== "PRODUCT_PAGE" ? `RESOLVE_${resolved.classification}`
          : lf.status === "OK" ? "OK"
          : raw?.err ? `NETWORK_${raw.err.split(":")[0]}`
          : raw?.status === 403 || raw?.status === 401 ? "BLOCKED_HTTP_" + raw.status
          : raw?.status === 429 ? "RATE_LIMITED"
          : raw?.status === 404 || raw?.status === 410 ? "GONE_" + raw.status
          : raw?.status && raw.status >= 500 ? "SERVER_" + raw.status
          : raw?.status === 200 && lf.status === "UNREACHABLE" ? "🔴 OUR_FETCHER(raw 200 인데 우리가 못 받았다)"
          : raw?.status === 200 && lf.status === "NO_FACTS" ? "🔴 OUR_PARSER(raw 200 · 상품명 못 읽음)"
          : `OTHER_${lf.status}_raw${raw?.status ?? "none"}`;

        rows.push({ url: u, host, finalUrl: resolved.finalUrl, classification: resolved.classification,
                    crawlerUrl: resolved.crawlerUrl, lfStatus: lf.status, fetchPath: lf.fetchPath,
                    httpCalls: lf.httpCalls, raw, cause });
        if (rows.length % 40 === 0) console.log(`  …${rows.length}/${urls.length}`); // eslint-disable-line no-console
      }

      const tally = (key: (r: Row) => string) => {
        const t: Record<string, number> = {};
        for (const r of rows) { const k = key(r); t[k] = (t[k] ?? 0) + 1; }
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      /** 🔴 우리 쪽 문제인 호스트 — universalExtract 대조 대상이다. */
      const ourSide = rows.filter((r) => r.cause.startsWith("🔴"));
      const byHostOurSide: Record<string, number> = {};
      for (const r of ourSide) byHostOurSide[r.host ?? "?"] = (byHostOurSide[r.host ?? "?"] ?? 0) + 1;

      const report = {
        totals: { distinctUrls: urls.length, probeBytes },
        byCause: tally((r) => r.cause),
        byClassification: tally((r) => r.classification),
        byLightFetchStatus: tally((r) => r.lfStatus),
        byFetchPath: tally((r) => r.fetchPath),
        /** 🔴 핵심 — 「우리 쪽 문제」로 분류된 후보의 호스트 분포 */
        ourSideByHost: Object.fromEntries(Object.entries(byHostOurSide).sort((a, b) => b[1] - a[1])),
        ourSideCount: ourSide.length,
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-04-fetch-causes.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: undefined }, null, 2));

      expect(rows.length).toBe(urls.length);
    },
    240 * 60 * 1000,
  );
});
