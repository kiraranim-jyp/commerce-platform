import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12b §3 — **번호가 두 개다. 섞이면 남의 상품을 고친다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     originProductNo    원상품 번호 — 수정 API 의 경로 식별자
 *     channelProductNo   채널(스마트스토어) 상품 번호 — «다른 것»
 *
 * 공식 수정 경로는 `/v2/products/origin-products/{originProductNo}` 하나뿐이다.
 * 여기에 channelProductNo 를 넣으면 존재하지 않는 원상품을 가리키거나, 최악의
 * 경우 «다른 상품» 을 가리킨다 — 그리고 우리는 성공으로 읽을 수 있다.
 *
 * 🔴 지금 코드는 originProductNo 만 쓰고 channelProductNo 는 «참조조차» 하지
 * 않는다. 그 상태를 고정한다. 나중에 화면에서 채널 번호를 받아 오는 순간
 * 이 검사가 먼저 깨진다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));
const UPDATER = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));
const STORE = codeOnly(readFileSync(join(__dirname, "../../_lib/channel-product.ts"), "utf8"));

describe("① 🔴 수정은 origin-products 경로 하나뿐이다", () => {
  it("PUT · GET 모두 origin-products 를 쓴다", () => {
    expect(UPDATER).toContain("/v2/products/origin-products/${originProductNo}");
    /* 채널 상품 경로로 수정하는 코드가 없어야 한다. */
    expect(UPDATER).not.toContain("channel-products/");
    expect(UPDATER).not.toContain("channelProductNo");
  });

  it("경로 인자가 «연결이 들고 있는» 번호다", () => {
    expect(ROUTE).toContain("existing.externalProductId,");
  });
});

describe("② 🔴 external_product_id 에 적는 것은 originProductNo 다", () => {
  it("성공 응답의 originProductNo 를 그대로 옮긴다", () => {
    expect(ROUTE).toContain("originProductNo != null ? String(originProductNo) : undefined");
  });

  it("🔴 채널 상품 번호를 저장하지 않는다", () => {
    for (const src of [ROUTE, UPDATER, STORE]) {
      expect(src).not.toContain("channelProductNo");
      expect(src).not.toContain("smartstoreChannelProductNo");
    }
  });
});

describe("③ 🔴 응답 번호를 요청 번호와 대조한다", () => {
  it("다르면 성공으로 처리하지 않는다", () => {
    /* 「UPDATE 인 줄 알았는데 새 상품이 생긴」 경우를 여기서 잡는다 —
       번호가 섞였을 때 가장 먼저 드러나는 자리이기도 하다. */
    expect(UPDATER).toContain("isSameOriginProduct(originProductNo, responded)");
    expect(UPDATER).toContain('step: "VERIFY"');
  });
});
