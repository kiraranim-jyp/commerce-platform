import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-9 — **롯데ON 은 「만들기 하나」이고, 그것이 정직한 상태다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     update         UNKNOWN   apiNo 90 은 「승인 상품 수정」이고 계약 미확인
 *     categoryUpdate UNKNOWN   근거 없음
 *
 * 🔴 이 파일이 지키는 것은 «없는 것을 만들어 두지 않았다» 는 사실이다.
 * 이번 스프린트는 정확히 그 반대 실수로 시작했다 — capability 표가 「apiNo 90
 * 이 문서에 있다」를 근거로 update=SUPPORTED 라고 적고 있었다. 「존재」를
 * 「확인」으로 읽은 것이다. 같은 일이 코드에서 반복되지 않게 고정한다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));

describe("① 🔴 확인되지 않은 수정을 «구현하지 않았다»", () => {
  it("apiNo 90(상품수정)을 부르지 않는다", () => {
    expect(SRC).not.toContain("modification/request");
    expect(SRC).not.toContain("productModification");
  });

  it("🔴 다른 상품 쓰기 API 도 부르지 않는다 — 91 가격 · 86 재고 · 92/111 판매상태", () => {
    for (const path of ["item/price/change", "item/stock/change", "product/status/change", "item/status/change"]) {
      expect(SRC).not.toContain(path);
    }
  });

  it("🔴 operation 에 'CREATE' 외에는 적을 수 «없다» — 타입이 막는다", () => {
    /* UPDATE·RECREATE 는 실행 경로가 없다. 받을 수 없는 값을 타입에 열어 두면
       다음 사람이 「적을 수 있으니 할 수 있다」고 읽는다. */
    expect(SRC).toContain('operation: "CREATE"; channelProductId: string | null');
    expect(SRC).not.toContain('"RECREATE"');
    expect(SRC).not.toContain('"UPDATE"');
  });

  it("🔴 외부 상품을 지우는 경로가 없다", () => {
    expect(SRC).not.toContain('method: "DELETE"');
  });
});

describe("② 이미 나가 있으면 «만들지 않는다»", () => {
  it("현재 연결을 먼저 확인한다 — POST 앞에서", () => {
    const iFind = SRC.indexOf("await findChannelProductBySnapshot(snapshotId, LOTTEON_PLATFORM_KEY)");
    const iPost = SRC.indexOf("LOTTEON_WRITE_PATHS.productRegistration");
    expect(iFind).toBeGreaterThan(-1);
    expect(iFind).toBeLessThan(iPost);
  });

  it("🔴 연결이 있으면 «무조건» 반환한다 — 새로 만드는 길이 문법적으로 없다", () => {
    const block = SRC.slice(SRC.indexOf("if (existing) {"), SRC.indexOf("const response = await callLotteOnApi("));
    expect(block).toContain("return NextResponse.json({ ok: false, result, validation });");
    /* 이 블록 안에서 POST 로 빠져나가는 경로가 없어야 한다. */
    expect(block).not.toContain("callLotteOnApi");
  });

  it("판단은 resolveLifecycle 이 한다 — 라우트가 문구를 지어내지 않는다", () => {
    expect(SRC).toContain("resolveLifecycle(LOTTEON_PLATFORM_KEY, true, {");
    expect(SRC).toContain("decision.reason");
  });

  it("🔴 비교하지 «않았다» 고 말한다 — 「안 바뀌었다」가 아니다", () => {
    expect(SRC).toContain("categoryUnknown: true");
    expect(SRC).toContain("comparedEverything: false");
    expect(SRC).not.toContain("comparedEverything: true");
  });
});

describe("③ 성공했을 «때만» 연결한다", () => {
  it("링크가 SUBMITTED 경로에만 있다", () => {
    const iSubmitted = SRC.indexOf('status: "SUBMITTED"');
    const iLink = SRC.indexOf("linkChannelProduct({");
    expect(iSubmitted).toBeGreaterThan(-1);
    expect(iLink).toBeGreaterThan(iSubmitted);
  });

  it("🔴 returnCode·spdNo 검사 «뒤» 다 — HTTP 200 은 성공이 아니다", () => {
    const iReturnCheck = SRC.indexOf("if (!response.returnOk || !spdNo) {");
    expect(iReturnCheck).toBeGreaterThan(-1);
    expect(iReturnCheck).toBeLessThan(SRC.indexOf("linkChannelProduct({"));
  });

  it("🔴 product_id 가 없으면(기존 381건) 잇지 않는다", () => {
    expect(SRC).toContain("const productId = await findProductIdBySnapshot(snapshotId);");
    expect(SRC).toContain("if (productId) {");
  });

  it("063 미적용 환경에서도 이력 기록이 죽지 않는다 — 새 컬럼이 먼저 포기된다", () => {
    const list = SRC.slice(SRC.indexOf("const optionalColumns = ["), SRC.indexOf("for (let attempt"));
    expect(list.indexOf('"channel_product_id"')).toBeLessThan(list.indexOf('"snapshot_id"'));
    expect(list.indexOf('"operation"')).toBeLessThan(list.indexOf('"snapshot_id"'));
  });
});

describe("④ 🔴 210 guard 를 건드리지 않았다", () => {
  it("주문 축 금지 목록은 이 변경과 무관하게 그대로다", () => {
    const guard = readFileSync(join(__dirname, "../_lib/forbidden-endpoints.ts"), "utf8");
    for (const apiNo of [210, 137, 52, 60, 71, 225]) {
      expect(guard).toContain(`apiNo: ${apiNo},`);
    }
  });
});
