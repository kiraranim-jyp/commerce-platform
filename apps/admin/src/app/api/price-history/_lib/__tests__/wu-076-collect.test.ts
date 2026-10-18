import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/**
 * WU-076 STEP 1 — **200 soft-404 수집** (LIVE · `MI_P0_02_LIVE=1`)
 *
 * 🔴🔴 **CTO 는 Human GT 를 만들 수 없다.** 그래서 라벨 대신 **CONTROL probe** 를 쓴다 —
 *    같은 호스트에 **존재할 수 없는 상품 URL** 을 넣고 무엇이 오는지 본다.
 * ```
 * bogus → 404/410 또는 리다이렉트  ⟹ 그 사이트는 없는 상품을 «정직하게» 알린다
 *                                    ⟹ 후보의 200 은 **의미가 있다**
 * bogus → 200 이고 본문이 후보와 «같다» ⟹ 🔴 그 후보는 **200 soft-404** 다
 * ```
 * 🟢 이것은 사람 라벨이 아니라 **사이트가 스스로 보여 주는 반증** 이다.
 *
 * 🔴 운영 코드를 **바꾸지 않는다.** 판정은 운영 owner `factsFromProductUrl` 로 받는다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CAND = path.join(OUT, "wu-076-cand.json");
const CTRL = path.join(OUT, "wu-076-control.json");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/** 🔴 존재할 수 없는 토큰 — 사이트의 실제 식별자와 충돌하지 않게 길고 특이하게 둔다. */
const BOGUS = "wu076zzz9x8y7q4m2";

/**
 * 후보 URL 에서 **같은 모양의 «없는 상품» URL** 을 만든다.
 * 🔴 경로 마지막 칸을 바꾸고, 쿼리에 숫자 식별자가 있으면 그것도 바꾼다
 *    (한국 CMS 는 식별자가 쿼리에 있다 — `?branduid=` · `?goodsNo=`).
 */
function bogusTwin(raw: string): string | null {
  try {
    const u = new URL(raw);
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return null;
    segs[segs.length - 1] = BOGUS;
    u.pathname = `/${segs.join("/")}`;
    for (const [k, v] of [...u.searchParams]) {
      if (/^\d{3,}$/.test(v)) u.searchParams.set(k, "999999999");
    }
    return u.toString();
  } catch {
    return null;
  }
}

async function grab(url: string): Promise<{ status: number | null; finalUrl: string; html: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
    return { status: res.status, finalUrl: res.url || url, html: (await res.text()).slice(0, 300_000) };
  } catch (e) {
    return { status: null, finalUrl: url, html: `__ERR__ ${String(e).slice(0, 100)}` };
  }
}

describe("WU-076 STEP 1 — 후보 + CONTROL 수집", () => {
  (LIVE ? it : it.skip)(
    "② 통과 90건 + 호스트별 bogus 쌍둥이",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[] }[] };
      const kept = [...new Set(s.rows.flatMap((r) => r.candidates))];

      /* ── ① 후보 전수 — 운영 owner 판정 + raw 응답 ── */
      const cand: Record<string, unknown> = existsSync(CAND) ? JSON.parse(readFileSync(CAND, "utf8")) : {};
      for (const url of kept) {
        const k = key(url);
        if (cand[k]) continue;
        const raw = await grab(url);
        let owner = { status: "__THREW__", title: null as string | null, brand: null as string | null, price: null as unknown };
        try {
          const f = await factsFromProductUrl(url);
          owner = {
            status: f.status,
            title: f.candidate?.title ?? null,
            brand: f.candidate?.facts?.brand ?? null,
            price: f.candidate?.price ?? null,
          };
        } catch {
          /* 기록만 한다 */
        }
        cand[k] = { url, host: new URL(url).host, ...raw, owner };
        writeFileSync(CAND, JSON.stringify(cand));
      }

      /* ── ② 호스트별 CONTROL — 없는 상품에 무엇을 주는가 ── */
      const ctrl: Record<string, unknown> = existsSync(CTRL) ? JSON.parse(readFileSync(CTRL, "utf8")) : {};
      const byHost = new Map<string, string>();
      for (const url of kept) if (!byHost.has(new URL(url).host)) byHost.set(new URL(url).host, url);
      for (const [host, sample] of byHost) {
        if (ctrl[host]) continue;
        const twin = bogusTwin(sample);
        if (!twin) {
          ctrl[host] = { host, twin: null, skipped: "경로가 없다" };
          continue;
        }
        const raw = await grab(twin);
        ctrl[host] = { host, twin, ...raw };
        writeFileSync(CTRL, JSON.stringify(ctrl));
        // eslint-disable-next-line no-console
        console.log(`${host.padEnd(30)} bogus → ${String(raw.status).padEnd(4)} final=${new URL(raw.finalUrl).pathname.slice(0, 30)}`);
      }

      expect(Object.keys(cand).length).toBe(kept.length);
      expect(Object.keys(ctrl).length).toBe(byHost.size);
    },
    3_000_000,
  );
});
