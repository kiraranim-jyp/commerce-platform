import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

/** WU-099 보조 — **원상품 facts 를 검증 화면용으로** 뽑는다(운영 추출기 변경 0). */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";

describe("WU-099 원상품", () => {
  (LIVE ? it : it.skip)("facts", async () => {
    const f = await factsFromProductUrl(ORIGIN);
    const o = {
      url: ORIGIN,
      title: f.candidate?.title ?? null,
      brand: f.candidate?.facts?.brand ?? null,
      modelCode: f.candidate?.facts?.brandModelCode ?? null,
      color: f.candidate?.facts?.colorText ?? null,
      /** 🔴 `SHOPIFY_JSON` 경로라 가격이 null 일 수 있다 — **지어내지 않는다**(WU-079 보류). */
      price: f.candidate?.price ?? null,
      imageUrl: f.candidate?.imageUrl ?? null,
      fetchPath: f.fetchPath,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(o));
    writeFileSync(path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-099-origin.json"), JSON.stringify(o, null, 1));
    expect(o.title).toBeTruthy();
  }, 300_000);
});
