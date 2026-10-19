import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/**
 * WU-083 STEP 1 — **Smallable 을 운영 owner 로 연다** (LIVE)
 *
 * 🔴 메모 `smallable-market-is-shipping-destination` 과 WU-016 이
 *    「Smallable UNREACHABLE · `fetch()` 로 재면 **헤더 초과** 로 못 받는다」를 남겼다.
 *    🟢 그래서 **먼저 운영 경로가 실제로 닿는지** 부터 본다(①/②/③ 분리의 1단계).
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 🔴 CPO 가 지정한 대표 케이스 + control 셋. */
const TARGETS = [
  { id: "SMALLABLE", url: "https://www.smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700" },
  { id: "CTRL-A-공식", url: "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt" },
  { id: "CTRL-B-국내", url: "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac112/28063/category/1/display/3/" },
  { id: "CTRL-C-SSG", url: "https://shinsegaemall.ssg.com/item/itemView.ssg?itemId=1000883221075&salestrNo=6005&siteNo=6004" },
];

describe("WU-083 STEP 1 — Smallable 수집", () => {
  (LIVE ? it : it.skip)(
    "운영 owner + raw fetch",
    async () => {
      const out: Record<string, unknown> = {};
      for (const t of TARGETS) {
        /** 🟢 운영 owner — 「지금 제품이 이 URL 에서 무엇을 얻는가」. */
        let owner: Record<string, unknown> = { status: "__THREW__" };
        try {
          const f = await factsFromProductUrl(t.url);
          owner = {
            status: f.status,
            fetchPath: f.fetchPath,
            httpCalls: f.httpCalls,
            title: f.candidate?.title ?? null,
            brand: f.candidate?.facts?.brand ?? null,
            price: f.candidate?.price ?? null,
            modelCode: f.candidate?.facts?.brandModelCode ?? null,
            colorText: f.candidate?.facts?.colorText ?? null,
          };
        } catch (e) {
          owner = { status: "__THREW__", error: String(e).slice(0, 120) };
        }
        /** 🔴 raw 도 받아 본다 — 「운영이 못 받는다」와 「페이지에 없다」를 가른다. */
        let raw: Record<string, unknown> = {};
        try {
          const res = await fetch(t.url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
          const html = (await res.text()).slice(0, 900_000);
          raw = { status: res.status, finalUrl: res.url, len: html.length, html };
        } catch (e) {
          raw = { status: null, error: String(e).slice(0, 140) };
        }
        out[t.id] = { url: t.url, owner, raw };
        // eslint-disable-next-line no-console
        console.log(`${t.id.padEnd(14)} owner=${String(owner.status).padEnd(16)} path=${String(owner.fetchPath).padEnd(12)} raw=${String(raw.status).padEnd(5)} len=${String(raw.len ?? raw.error).slice(0, 60)}`);
      }
      writeFileSync(path.join(OUT, "wu-083-pages.json"), JSON.stringify(out));
      expect(Object.keys(out)).toHaveLength(TARGETS.length);
    },
    900_000,
  );
});
