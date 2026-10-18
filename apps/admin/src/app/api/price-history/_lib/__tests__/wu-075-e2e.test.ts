import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
describe("WU-075 실데이터 E2E", () => {
  (process.env.MI_P0_02_LIVE === "1" ? it : it.skip)("19건 — 비상품 6 제거 · 정상 13 유지", async () => {
    const gt = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "wu-068-new-gt.json"), "utf8")) as { id: string; url: string; why: string | null }[];
    let removed = 0, kept = 0, falseRemoved = 0;
    for (const r of gt) {
      const f = await factsFromProductUrl(r.url);
      const non = /404|홈페이지/.test(String(r.why));
      // eslint-disable-next-line no-console
      console.log(`${r.id.padEnd(5)} ${non ? "비상품" : "상품  "} → ${f.status}`);
      if (non && f.status === "REDIRECTED_AWAY") removed++;
      if (!non && f.status === "OK") kept++;
      if (!non && f.status !== "OK") falseRemoved++;
    }
    expect(removed).toBe(6);
    expect(kept).toBe(13);
    expect(falseRemoved).toBe(0);
  }, 900_000);
});
