import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WU-076 STEP 1b — **CONTROL 재시도: 식별자 «세그먼트» 를 바꾼다** (LIVE)
 *
 * 🔴🔴 1차 CONTROL 이 **세 건에서 무효** 였다. 경로 **마지막 칸** 을 바꿨는데
 *    한국 Cafe24 계열은 마지막이 `…/category/367/display/1/` 같은 **꼬리표** 라
 *    바꿔도 **같은 상품** 이 나온다(biskuit·littleluna 는 bogus 제목이 후보와 **글자 그대로 같았다**).
 *    상품 식별자는 **중간의 숫자 세그먼트**(`/8891/`)에 있다.
 *
 * 🟢 그래서 ⒜ 경로의 **숫자 세그먼트 전부** 를 바꾸고 ⒝ 그래도 없으면 마지막 칸을 바꾼다.
 * 🔴 그리고 **무효 판정 기준을 명시** 한다 — bogus 제목이 그 호스트의 **실제 후보 제목과
 *    같으면 그 CONTROL 은 무효** 다(없는 상품이 아니라 같은 상품을 받은 것이다).
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CAND = path.join(OUT, "wu-076-cand.json");
const CTRL2 = path.join(OUT, "wu-076-control2.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BOGUS = "9980001";

function bogusByIdSegment(raw: string): string | null {
  try {
    const u = new URL(raw);
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return null;
    const numeric = segs.map((s, i) => [s, i] as const).filter(([s]) => /^\d{3,}$/.test(s));
    if (numeric.length > 0) {
      for (const [, i] of numeric) segs[i] = BOGUS;
    } else {
      segs[segs.length - 1] = `wu076-${BOGUS}`;
    }
    u.pathname = `/${segs.join("/")}`;
    for (const [k, v] of [...u.searchParams]) if (/^\d{3,}$/.test(v)) u.searchParams.set(k, BOGUS);
    return u.toString();
  } catch {
    return null;
  }
}

describe("WU-076 STEP 1b — CONTROL 재시도", () => {
  (LIVE ? it : it.skip)(
    "1차에서 200 을 준 호스트 + 한국 계열 전부",
    async () => {
      const cand = Object.values(JSON.parse(readFileSync(CAND, "utf8")) as Record<string, { url: string; host: string; owner: { title: string | null } }>);
      const c1 = JSON.parse(readFileSync(path.join(OUT, "wu-076-control.json"), "utf8")) as Record<string, { status: number | null }>;
      /** 🔴 1차가 200/403/null 이었던 호스트는 전부 다시 본다 — 「404 였다」만 확정으로 남긴다. */
      const retry = Object.entries(c1).filter(([, v]) => v.status !== 404).map(([h]) => h);

      const out: Record<string, unknown> = existsSync(CTRL2) ? JSON.parse(readFileSync(CTRL2, "utf8")) : {};
      for (const host of retry) {
        if (out[host]) continue;
        const sample = cand.find((c) => c.host === host);
        const twin = sample ? bogusByIdSegment(sample.url) : null;
        if (!twin || twin === sample?.url) {
          out[host] = { host, twin, invalid: "식별자 세그먼트를 못 찾았다" };
          writeFileSync(CTRL2, JSON.stringify(out));
          continue;
        }
        let rec: Record<string, unknown>;
        try {
          const res = await fetch(twin, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
          const html = (await res.text()).slice(0, 300_000);
          const title = (/<title[^>]*>([^<]+)<\/title>/i.exec(html) ?? [])[1]?.trim() ?? null;
          /** 🔴 무효 판정 — 그 호스트의 실제 후보 제목과 같으면 「없는 상품」을 받은 게 아니다. */
          const realTitles = cand.filter((c) => c.host === host).map((c) => (c.owner.title ?? "").trim());
          rec = { host, twin, status: res.status, finalUrl: res.url || twin, title, len: html.length, html, invalid: realTitles.includes(title ?? "") ? "후보와 같은 제목" : null };
        } catch (e) {
          rec = { host, twin, status: null, error: String(e).slice(0, 90) };
        }
        out[host] = rec;
        writeFileSync(CTRL2, JSON.stringify(out));
        // eslint-disable-next-line no-console
        console.log(`${host.padEnd(26)} ${String((rec as { status?: number }).status).padEnd(4)} len=${String((rec as { len?: number }).len ?? "-").padEnd(7)} invalid=${String((rec as { invalid?: string }).invalid)}  「${String((rec as { title?: string }).title).slice(0, 44)}」`);
      }
      expect(Object.keys(out).length).toBe(retry.length);
    },
    1_800_000,
  );
});
