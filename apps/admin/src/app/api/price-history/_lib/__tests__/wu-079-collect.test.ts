import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/**
 * WU-079 STEP 1 — **가격 증거 수집** (LIVE · `MI_P0_02_LIVE=1`)
 *
 * 🔴 실패군(beaumonde 2) · 성공군(JSON-LD 성공 국내) · 경계군을 **같은 방법** 으로 받는다.
 * 🟢 판정은 운영 owner `factsFromProductUrl` 이 낸 값을 쓴다 — 복제하지 않는다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-079-pages.json");
const T63 = path.join(OUT, "wu-063-table.json");
const G36 = path.join(OUT, "wu-036-3way.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

describe("WU-079 STEP 1 — 가격 증거 수집", () => {
  (LIVE ? it : it.skip)(
    "실패군 + 성공군 + 경계군",
    async () => {
      const T = JSON.parse(readFileSync(T63, "utf8")) as { id: string; domain: string; price: number | null; currency: string | null; priceStatus: string | null; kr: boolean }[];
      const G = (JSON.parse(readFileSync(G36, "utf8")) as { rows: { candidateUrl: string }[] }).rows;
      const urlOf = (id: string) => G[Number(id.slice(1)) - 1]?.candidateUrl ?? null;

      /** 🔴 실패군 — WU-063 이 지목한 beaumonde 2건. */
      const fail = T.filter((r) => /beaumonde/i.test(r.domain));
      /** 🟢 성공군/경계군 — 국내 계열 중 가격이 «있는» 것 전부(대조군). */
      const KR = (d: string) => /\.kr$|\.co\.kr|biskuit|mustit|luxboy|donokids|littleluna|miniboutique|luksus/i.test(d);
      const ok = T.filter((r) => KR(r.domain) && r.price != null);

      const targets = [...fail, ...ok].map((r) => ({ ...r, url: urlOf(r.id) })).filter((r) => r.url);
      const out: Record<string, unknown> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

      for (const t of targets) {
        const k = key(t.url!);
        if (out[k]) continue;
        let status: number | null = null;
        let html = "";
        let finalUrl = t.url!;
        try {
          const res = await fetch(t.url!, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
          status = res.status;
          finalUrl = res.url || t.url!;
          html = (await res.text()).slice(0, 600_000);
        } catch (e) {
          html = `__ERR__ ${String(e).slice(0, 90)}`;
        }
        /** 🟢 운영 owner — 「지금 제품이 이 페이지에서 가격을 얻는가」. */
        let owner: Record<string, unknown> = { status: "__THREW__" };
        try {
          const f = await factsFromProductUrl(t.url!);
          owner = {
            status: f.status,
            title: f.candidate?.title ?? null,
            price: f.candidate?.price ?? null,
            priceStatus: f.candidate?.priceStatus ?? null,
            priceSource: f.candidate?.priceSource ?? null,
          };
        } catch {
          /* 기록만 한다 */
        }
        out[k] = { id: t.id, url: t.url, domain: t.domain, tableSays: { price: t.price, currency: t.currency, priceStatus: t.priceStatus }, status, finalUrl, html, owner };
        writeFileSync(CACHE, JSON.stringify(out));
        // eslint-disable-next-line no-console
        console.log(`${String(t.id).padEnd(4)} ${String(t.domain).padEnd(22)} http=${String(status).padEnd(4)} owner=${String(owner.status).padEnd(16)} price=${JSON.stringify(owner.price)}`);
      }
      expect(Object.keys(out).length).toBe(targets.length);
    },
    1_800_000,
  );
});
