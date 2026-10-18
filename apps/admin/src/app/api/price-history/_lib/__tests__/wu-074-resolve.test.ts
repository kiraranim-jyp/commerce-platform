import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLivePageProbe, resolveCandidate, isCrawlable } from "@commerce/crawler/src/discovery-core";

/**
 * WU-074 STEP 2 — **운영 함수 `resolveCandidate` 로 반사실을 잰다** (LIVE)
 *
 * 🔴🔴 이 WU 의 핵심 발견이 여기에 있다 — **방어는 이미 구현돼 있다.**
 *    `discovery-core/url-resolver.ts:86-101` 이
 *      ⒜ `status 404|410` → `NOT_FOUND`
 *      ⒝ `rel=canonical` 이 다르면 **그 쪽으로 target 을 옮기고**
 *      ⒞ 「URL 모양은 상품인데 도착지가 상품이 아니면」 → **`UNUSABLE`**
 *    를 전부 한다. 🟢 그 주석이 **`main-story.com` 을 실측 사례로 지명** 하는데
 *    그것이 바로 CEO 가 「홈페이지 메인호출」이라고 한 **S4-1** 이다.
 *
 * 🔴 그런데 ④(`factsFromProductUrl`)는 그 함수를 **부르지 않는다.** URL 모양만 보고
 *    바로 fetch 하고, 받은 HTML 의 `rel=canonical` 을 **읽지 않는다.**
 *    ⟹ 같은 리포 안에서 같은 문제의 방어가 **둘로 갈려** 있다.
 *
 * 🟢 그래서 「새 판별축」이 아니라 **기존 운영 함수를 그대로 부른다**(전수검토 10축 ①).
 * 🔴 직접 PageProbe 를 만들지 않는다 — `createLivePageProbe` 를 쓴다
 *    (헌장 함정: 자작 probe 는 리다이렉트를 안 따라가 12/12 UNKNOWN 을 냈다).
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-074-resolve.json");
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

describe("WU-074 STEP 2 — resolveCandidate 반사실", () => {
  (LIVE ? it : it.skip)(
    "19(CEO GT) + 51(WU-036 GT) 전수",
    async () => {
      const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as { id: string; url: string; gt: string; why: string | null }[];
      const g3 = (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: { candidateUrl: string }[] }).rows;

      const items = [
        ...nw.map((r) => ({ id: r.id, url: r.url, set: "CEO19", why: r.why })),
        ...g3.map((r, i) => ({ id: `G${i + 1}`, url: r.candidateUrl, set: "GT51", why: null as string | null })),
      ];
      const out: Record<string, unknown> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
      const probe = createLivePageProbe({ timeoutMs: 25_000 });

      for (const it0 of items) {
        const k = key(it0.url);
        if (out[k]) continue;
        let rec: Record<string, unknown>;
        try {
          const r = await resolveCandidate(it0.url, [], probe);
          rec = {
            ...it0,
            classification: r.classification,
            httpStatus: r.httpStatus,
            finalUrl: r.finalUrl,
            steps: r.steps,
            crawlable: isCrawlable(r),
          };
        } catch (e) {
          rec = { ...it0, classification: "__THREW__", error: String(e).slice(0, 120), crawlable: null };
        }
        out[k] = rec;
        writeFileSync(CACHE, JSON.stringify(out));
      }
      expect(Object.keys(out).length).toBeGreaterThanOrEqual(items.length);
    },
    1_800_000,
  );
});
