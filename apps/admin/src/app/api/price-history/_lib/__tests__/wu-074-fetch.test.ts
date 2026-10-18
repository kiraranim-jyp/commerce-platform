import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/**
 * WU-074 STEP 1 — **19건의 실제 HTTP 응답을 받는다** (LIVE · `MI_P0_02_LIVE=1`)
 *
 * 🔴 왜 필요한가 — WU-067 의 19건은 **HTML 캐시가 없다**(facts 만 저장했다).
 *    그래서 「soft-404 가 HTTP 몇으로 오는가」를 **기존 데이터로는 답할 수 없다.**
 *    🔴 그 답 없이는 CPO 가 요구한 「404 차단율」을 적을 수 없다.
 *
 * 🟢 운영 owner 를 **그대로** 부른다 — `factsFromProductUrl`. 복제식이 아니다.
 * 🟢 추가로 raw HTML 을 같은 UA 로 한 번 더 받아 **신호 분해용** 으로만 쓴다.
 * 🔴 드리프트 감지 — WU-067 당시 제목과 **다르면 기록** 한다. 같은 페이지라고 단정하지 않는다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-074-live.json");
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

describe("WU-074 STEP 1 — 실제 응답 수집", () => {
  (LIVE ? it : it.skip)(
    "19건 HTTP 상태 + HTML + 운영 owner 결과",
    async () => {
      const gt = JSON.parse(readFileSync(NEW_GT, "utf8")) as { id: string; url: string; title: string | null }[];
      const prev = existsSync(CACHE) ? (JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, unknown>) : {};
      const out: Record<string, unknown> = { ...prev };

      for (const r of gt) {
        if (out[r.id]) continue;
        let httpStatus: number | null = null;
        let html = "";
        try {
          const res = await fetch(r.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
          httpStatus = res.status;
          html = await res.text();
        } catch (e) {
          httpStatus = null;
          html = `__FETCH_ERROR__ ${String(e).slice(0, 120)}`;
        }
        /** 🟢 운영 owner — 「지금 제품이 이 URL 을 어떻게 판정하는가」. */
        let owner: { status: string; title: string | null; hasFacts: boolean } = {
          status: "__THREW__",
          title: null,
          hasFacts: false,
        };
        try {
          const f = await factsFromProductUrl(r.url);
          owner = { status: f.status, title: f.candidate?.title ?? null, hasFacts: !!f.candidate?.facts };
        } catch {
          /* 기록만 한다 */
        }
        out[r.id] = { url: r.url, httpStatus, html: html.slice(0, 400_000), owner, titleAtWu067: r.title };
        writeFileSync(CACHE, JSON.stringify(out));
        // eslint-disable-next-line no-console
        console.log(`${r.id.padEnd(5)} http=${String(httpStatus).padEnd(4)} owner=${owner.status.padEnd(15)} ${String(owner.title).slice(0, 44)}`);
      }
      expect(Object.keys(out).length).toBe(gt.length);
    },
    600_000,
  );
});
