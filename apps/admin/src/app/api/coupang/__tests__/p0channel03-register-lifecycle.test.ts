import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-8 — **쿠팡의 갈림길은 두 갈래다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SmartStore 와 달리 쿠팡에는 «고치기» 가 없다. 구현을 덜 한 것이 아니라
 * 근거가 없는 것이다:
 *
 *     update         UNKNOWN        수정 엔드포인트 근거 «없음»    → BLOCKED
 *     categoryUpdate NOT_SUPPORTED  공식이 「불가」로 «명시»        → RECREATE
 *
 * 🔴 이 파일이 지키는 것: 없는 것을 만들어 두지 않았다는 사실. 만들어 두면
 * 다음 사람이 「있으니까 쓸 수 있다」고 읽는다 — 이번 스프린트에 LotteON
 * apiNo 90 에서 실제로 겪은 오류다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));
const LIB = codeOnly(readFileSync(join(__dirname, "../_lib/registered-product.ts"), "utf8"));

describe("① 🔴 쿠팡에 UPDATE 경로를 만들지 «않았다»", () => {
  it("수정 API 를 부르는 코드가 없다", () => {
    expect(SRC).not.toContain('method: "PUT"');
    expect(SRC).not.toContain('method: "PATCH"');
    expect(SRC).not.toContain("updateRegisteredProduct");
  });

  it("🔴 operation 으로 'UPDATE' 를 적을 수 «없다» — 타입이 막는다", () => {
    /* logRegistrationAttempt 의 lifecycle 인자가 CREATE|RECREATE 뿐이다.
       근거 없는 값을 이력에 적는 길 자체를 없앤다. */
    expect(SRC).toContain('operation: "CREATE" | "RECREATE"');
    expect(SRC).not.toContain('"UPDATE"');
  });

  it("🔴 외부 상품을 지우는 경로가 없다", () => {
    expect(SRC).not.toContain('method: "DELETE"');
  });
});

describe("② 판단은 한 곳이다", () => {
  it("resolveLifecycle() 이 정한다", () => {
    expect(SRC).toContain('resolveLifecycle("coupang", true, {');
  });

  it("🔴 operation 을 추론하지 않고 정해진 변수를 적는다", () => {
    expect(SRC).toContain("operation: plannedOperation,");
  });

  it("🔴 카테고리를 못 읽으면 「안 바뀜」이 아니라 UNKNOWN 이다", () => {
    expect(SRC).toContain("categoryUnknown: !both");
    expect(SRC).toContain("comparedEverything: false");
    /* 비교하지 않은 것을 「전수로 봤다」고 말하지 않는다. */
    expect(SRC).not.toContain("comparedEverything: true");
  });
});

describe("③ 🔴 읽지 못하면 CREATE 로 «내려가지 않는다»", () => {
  it("조회 실패는 거기서 끝난다 — POST 앞에서", () => {
    const iFetch = SRC.indexOf("await fetchRegisteredCoupangCategory(");
    const iGuard = SRC.indexOf("if (!registered.ok) {");
    const iCreate = SRC.indexOf("path: CREATE_PRODUCT_PATH");
    expect(iFetch).toBeGreaterThan(-1);
    expect(iGuard).toBeGreaterThan(iFetch);
    expect(iGuard).toBeLessThan(iCreate);
  });

  it("판단이 POST «앞» 이다", () => {
    expect(SRC.indexOf("resolveLifecycle(")).toBeLessThan(SRC.indexOf("path: CREATE_PRODUCT_PATH"));
  });
});

describe("④ 🔴 중복 CREATE 를 구조적으로 막는다", () => {
  it("POST 앞에 마지막 빗장이 있다", () => {
    const iGuard = SRC.indexOf('if (blocksCreate(Boolean(existing)) && plannedOperation !== "RECREATE")');
    expect(iGuard).toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(SRC.indexOf("path: CREATE_PRODUCT_PATH"));
  });

  it("🔴 RECREATE 는 셀러 동의 없이 진행하지 않는다", () => {
    expect(SRC).toContain("body.confirmRecreate === true");
    expect(SRC.indexOf("if (!confirmRecreate) {")).toBeLessThan(
      SRC.indexOf('plannedOperation = "RECREATE";'),
    );
  });

  it("RECREATE 는 연결을 갈아끼우고, 새 번호가 없으면 건드리지 않는다", () => {
    expect(SRC).toContain("replaceChannelProductLink(existing.id, result.externalProductId)");
    expect(SRC).toContain("if (result.externalProductId) {");
  });
});

describe("⑤ 성공했을 때만 연결한다", () => {
  it("링크 코드가 «성공 분기 안» 에 있다", () => {
    const iSucceeded = SRC.indexOf("if (succeeded) {");
    const iLink = SRC.indexOf("linkChannelProduct({");
    expect(iSucceeded).toBeGreaterThan(-1);
    expect(iLink).toBeGreaterThan(iSucceeded);
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

describe("⑥ 🔴 조회는 카테고리 하나만 읽는다 — 결과를 바꾸지 않는 비교를 짓지 않는다", () => {
  it("읽기 전용이다", () => {
    expect(LIB).toContain('method: "GET"');
    for (const write of ['method: "POST"', 'method: "PUT"', 'method: "DELETE"']) {
      expect(LIB).not.toContain(write);
    }
  });

  it("여기서 lifecycle 을 판단하지 않는다", () => {
    expect(LIB).not.toContain("resolveLifecycle");
    for (const forbidden of ['"CREATE"', '"UPDATE"', '"RECREATE"', '"NOOP"', '"BLOCKED"']) {
      expect(LIB).not.toContain(forbidden);
    }
  });

  it("🔴 못 읽은 것을 「없다」로 단정하지 않는다 — null 을 내고 호출부가 막는다", () => {
    expect(LIB).toContain("code == null ? null : String(code)");
  });
});
