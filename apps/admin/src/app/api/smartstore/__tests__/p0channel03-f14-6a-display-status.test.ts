import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toRegisteredProductSnapshot } from "../_lib/update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-6a — **전시 상태가 라우트를 지나 payload 까지 간다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-14-6 실측에서 GET 최상위 키가 «둘» 이라는 것이 드러났다. 값 자체의 계약은
 * `packages/listing` 쪽 테스트가 고정한다(빌더 분기 · 손실검사 7축). 이 파일이
 * 지키는 것은 «배선» 이다 — 읽은 값이 실제로 payload 까지 가는가.
 *
 * 🔴 넷:
 *   ① GET 응답에서 전시 상태를 «읽는다».
 *   ② 읽지 못한 것을 빈 객체로 «메우지 않는다».
 *   ③ UPDATE 로 정해진 뒤 «같은 빌더» 로 payload 를 다시 만든다(두 벌이 아니다).
 *   ④ 그 갈아끼우기가 확인 화면·손실검사·PUT «앞» 이다 — 본 것과 나간 것이 같다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));

describe("① 🔴 GET 응답에서 전시 상태를 읽는다", () => {
  it("originProduct «밖» 의 축을 스냅샷에 담는다", () => {
    const mapped = toRegisteredProductSnapshot({
      originProduct: { name: "A", salePrice: 1000 },
      smartstoreChannelProduct: { channelProductDisplayStatusType: "ON" },
    });
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.snapshot.smartstoreChannelProduct?.channelProductDisplayStatusType).toBe("ON");
    }
  });

  it("전시 중지도 그대로 읽는다", () => {
    const mapped = toRegisteredProductSnapshot({
      originProduct: { name: "A" },
      smartstoreChannelProduct: { channelProductDisplayStatusType: "SUSPENSION" },
    });
    if (!mapped.ok) throw new Error(mapped.message);
    expect(mapped.snapshot.smartstoreChannelProduct?.channelProductDisplayStatusType).toBe("SUSPENSION");
  });
});

describe("② 🔴 읽지 못한 것을 메우지 않는다", () => {
  it("응답에 없으면 undefined 다 — 빈 객체로 채우지 않는다", () => {
    const mapped = toRegisteredProductSnapshot({ originProduct: { name: "A" } });
    if (!mapped.ok) throw new Error(mapped.message);
    /* 🔴 `?? {}` 로 메우면 「읽었는데 상태가 없었다」가 되고, 거기서부터 추정이
       시작된다. undefined 여야 손실검사가 「모른다」로 막는다. */
    expect(mapped.snapshot.smartstoreChannelProduct).toBeUndefined();
  });

  it("코드에도 그 메움이 «없다»", () => {
    const UPDATER = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));
    expect(UPDATER).toContain("smartstoreChannelProduct: parsed?.smartstoreChannelProduct,");
    expect(UPDATER).not.toContain("smartstoreChannelProduct: parsed?.smartstoreChannelProduct ??");
  });
});

describe("③ 🔴 같은 빌더로 다시 만든다 — 두 벌이 아니다", () => {
  it("빌더 입력을 변수로 두고, UPDATE 에서 한 칸만 더한다", () => {
    expect(ROUTE).toContain("const payloadInput = {");
    expect(ROUTE).toContain("payload = buildNaverProductPayload(payloadInput);");
    expect(ROUTE).toContain("registeredChannelProduct: current.snapshot.smartstoreChannelProduct,");
  });

  it("🔴 별도 payload 조립 경로를 만들지 않았다 — 빌더 호출은 둘 다 같은 함수다", () => {
    const calls = ROUTE.match(/buildNaverProductPayload\(/g) ?? [];
    expect(calls).toHaveLength(2);
    /* payload 를 손으로 깁지 않는다(필드 하나만 갈아끼우는 방식 금지). */
    expect(ROUTE).not.toContain("payload.smartstoreChannelProduct =");
    expect(ROUTE).not.toContain("...payload.smartstoreChannelProduct");
  });

  it("🔴 전시 상태를 라우트가 «추정하지» 않는다", () => {
    /* 빌더가 정하고, 모르면 비운다. 라우트에 SUSPENSION/ON 이라는 낱말 자체가
       없어야 한다 — 있으면 두 번째 판단이 생긴 것이다. */
    expect(ROUTE).not.toContain('"SUSPENSION"');
    expect(ROUTE).not.toContain('"ON"');
    expect(ROUTE).not.toContain("channelProductDisplayStatusType");
  });
});

describe("④ 🔴 본 것과 나간 것이 같다 — 갈아끼우기가 먼저다", () => {
  const iRebuild = ROUTE.indexOf("registeredChannelProduct: current.snapshot.smartstoreChannelProduct");

  it("UPDATE 로 정해진 «뒤» 다 — CREATE 는 건드리지 않는다", () => {
    const iDecision = ROUTE.indexOf('if (decision.operation === "UPDATE") {');
    expect(iDecision).toBeGreaterThan(-1);
    expect(iDecision).toBeLessThan(iRebuild);
  });

  it("확인 화면·손실검사·PUT «앞» 이다", () => {
    expect(iRebuild).toBeLessThan(ROUTE.indexOf("if (!confirmUpdate) {"));
    expect(iRebuild).toBeLessThan(ROUTE.indexOf("detectUpdateDataLoss(current.snapshot, payload)"));
    expect(iRebuild).toBeLessThan(ROUTE.indexOf("await updateRegisteredProduct("));
  });

  it("PUT 직전 검사에 «같은 스냅샷» 이 넘어간다 — 두 번 읽지 않는다", () => {
    /* 두 번 읽으면 그 사이에 전시 상태가 바뀔 수 있고, 그러면 「보여준 상태」와
       「검사한 상태」가 달라진다. */
    expect(ROUTE).toContain("current.snapshot,");
  });
});
