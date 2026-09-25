import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12(CTO 지시, 2026-09-25) — **첫 Production PUT 의 관문**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 수정은 PATCH 가 아니라 «전체 교체» 다. preflight 가 「사라지는 것」은
 * 막지만 「의도하지 않은 변경」은 막지 못한다 — 그것은 사람만 알아본다.
 *
 * 🔴 이 파일은 CTO 작업지시서 §4(실행 순서) · §5(하지 않을 것) · §7(자동검증
 * 체크리스트)를 «소스로» 고정한다. 사람이 PUT 전에 눈으로 훑는 목록을
 * 테스트가 대신 지키게 한다 — 사람은 열 번 중 한 번 빠뜨린다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));
const UPDATER = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));
const PANEL = codeOnly(readFileSync(join(__dirname, "../../../pipeline/commerce/UpdateConfirmPanel.tsx"), "utf8"));

describe("① 🔴 확인 없이는 PUT 하지 않는다", () => {
  it("confirmUpdate 는 === true 로만 받는다 — 기본값은 «안 함»", () => {
    expect(ROUTE).toContain("body.confirmUpdate === true");
  });

  it("🔴 확인 게이트가 updateRegisteredProduct 호출 «앞» 이다", () => {
    const iGate = ROUTE.indexOf("if (!confirmUpdate) {");
    const iPut = ROUTE.indexOf("await updateRegisteredProduct(");
    expect(iGate).toBeGreaterThan(-1);
    expect(iGate).toBeLessThan(iPut);
  });

  it("게이트에서 «반환» 한다 — 아래로 흘러가지 않는다", () => {
    const gate = ROUTE.slice(ROUTE.indexOf("if (!confirmUpdate) {"), ROUTE.indexOf("await updateRegisteredProduct("));
    expect(gate).toContain("return NextResponse.json(result);");
    /* 🔴 게이트 안에서 네이버를 부르는 코드가 없어야 한다(외부 호출 0회). */
    expect(gate).not.toContain("callNaverApi");
    expect(gate).not.toContain("updateRegisteredProduct");
  });

  it("🔴 게이트 응답에 operation 을 적지 않는다 — 아무것도 하지 않았다", () => {
    const gate = ROUTE.slice(ROUTE.indexOf("if (!confirmUpdate) {"), ROUTE.indexOf("await updateRegisteredProduct("));
    expect(gate).toContain("await logRegistrationAttempt(result, undefined, snapshotId, jobKey);");
    /* 🔴 «기록 호출» 만 본다. 이 블록에는 needsConfirmation.operation 이 있는데
       그것은 「무엇을 물어보는가」이지 「무엇을 했다고 적는가」가 아니다 —
       블록 전체에서 "operation:" 을 금지하면 그 둘을 섞는다(실제로 섞었다).
       lifecycle 인자는 객체 리터럴로 넘어가므로, 그 형태가 없는지 본다. */
    const loggedWithLifecycle = /logRegistrationAttempt\([^;]*\{/.test(gate);
    expect(loggedWithLifecycle, "게이트가 lifecycle 을 기록했다 — 아무것도 하지 않았는데").toBe(false);
  });
});

describe("② §4 실행 순서 — GET → payload → ChangeSet → 손실검사 → PUT", () => {
  it("라우트에서 순서가 고정돼 있다", () => {
    const iFetch = ROUTE.indexOf("await fetchRegisteredProduct(");
    const iCompare = ROUTE.indexOf("compareRegisteredProduct(");
    const iDecision = ROUTE.indexOf("resolveLifecycle(");
    const iLoss = ROUTE.indexOf("detectUpdateDataLoss(current.snapshot, payload)");
    const iPut = ROUTE.indexOf("await updateRegisteredProduct(");
    expect(iFetch).toBeLessThan(iCompare);
    expect(iCompare).toBeLessThan(iDecision);
    expect(iDecision).toBeLessThan(iLoss);
    expect(iLoss).toBeLessThan(iPut);
  });

  it("🔴 보내기 직전 preflight 를 «빼지 않았다» — 이중 확인이다", () => {
    /* 보여준 시점과 보내는 시점 사이에 상품이 바뀔 수 있다. fail-closed 는
       보내기 직전에 한 번 더 서 있어야 의미가 있다. */
    expect(UPDATER).toContain("detectUpdateDataLoss(current.snapshot, payload)");
    const iPreflight = UPDATER.indexOf("detectUpdateDataLoss(");
    const iPut = UPDATER.indexOf('method: "PUT"');
    expect(iPreflight).toBeLessThan(iPut);
  });

  it("성공 처리는 응답 상품번호 대조 «뒤» 다", () => {
    const iVerify = UPDATER.indexOf("if (!isSameOriginProduct(");
    const iSuccess = UPDATER.indexOf("return { ok: true, originProductNo, status: res.status };");
    expect(iVerify).toBeLessThan(iSuccess);
  });
});

describe("③ §4 절대 금지 — 실패가 성공이 되지 않는다", () => {
  it("GET 실패 → PUT 하지 않는다", () => {
    expect(ROUTE).toContain("if (!current.ok) {");
    expect(UPDATER).toContain('if (!current.ok) return { ok: false, step: "FETCH"');
  });

  it("preflight 실패 → PUT 하지 않는다", () => {
    const between = UPDATER.slice(UPDATER.indexOf("if (risks.length > 0) {"), UPDATER.indexOf('method: "PUT"'));
    expect(between).toContain('step: "PREFLIGHT"');
    expect(between).toContain("return {");
  });

  it("🔴 응답 ID 없음·불일치 → 성공 처리하지 않는다", () => {
    expect(UPDATER).toContain("if (!isSameOriginProduct(originProductNo, responded)) {");
    expect(UPDATER).toContain('step: "VERIFY"');
  });

  it("🔴 PUT 성공 «전» 에 ChannelProduct 를 바꾸지 않는다", () => {
    /* touchChannelProduct 가 updated.ok 확인 뒤에만 있어야 한다. */
    const iFail = ROUTE.indexOf("if (!updated.ok) {");
    const iTouch = ROUTE.indexOf("await touchChannelProduct(existing.id);");
    expect(iFail).toBeGreaterThan(-1);
    expect(iTouch).toBeGreaterThan(iFail);
  });

  it("🔴 UPDATE 실패가 RECREATE 로 «떨어지지» 않는다(§9 fallback 금지)", () => {
    const failBlock = ROUTE.slice(
      ROUTE.indexOf("if (!updated.ok) {"),
      ROUTE.indexOf("logStep(\"상품 수정\", \"success\""),
    );
    expect(failBlock).not.toContain("RECREATE");
    expect(failBlock).not.toContain("plannedOperation");
    expect(failBlock).toContain("return NextResponse.json(result);");
  });
});

describe("④ §7 체크리스트 — UPDATE 경로가 CREATE 를 부르지 않는다", () => {
  it("🔴 UPDATE 분기 안에서 CREATE POST 가 호출되지 않는다", () => {
    const updateBranch = ROUTE.slice(
      ROUTE.indexOf('if (decision.operation === "UPDATE") {'),
      ROUTE.indexOf('if (decision.operation === "RECREATE") {'),
    );
    expect(updateBranch).not.toContain("CREATE_PRODUCT_PATH");
    expect(updateBranch).not.toContain('method: "POST"');
  });

  it("🔴 UPDATE 성공은 기존 ChannelProduct 를 «유지» 한다 — 갈아끼우지 않는다", () => {
    const updateBranch = ROUTE.slice(
      ROUTE.indexOf('if (decision.operation === "UPDATE") {'),
      ROUTE.indexOf('if (decision.operation === "RECREATE") {'),
    );
    expect(updateBranch).toContain("await touchChannelProduct(existing.id);");
    expect(updateBranch).toContain("channelProductId: existing.id,");
    /* 연결을 새로 만들거나 교체하는 코드가 이 분기에 없어야 한다. */
    expect(updateBranch).not.toContain("replaceChannelProductLink");
    expect(updateBranch).not.toContain("linkChannelProduct");
  });

  it("UPDATE 성공은 같은 상품번호를 돌려준다", () => {
    expect(ROUTE).toContain("externalProductId: updated.originProductNo,");
  });

  it("operation = UPDATE 로 기록한다", () => {
    expect(ROUTE).toContain('operation: "UPDATE",');
  });
});

describe("⑤ §6 NOOP 은 계속 닫혀 있다", () => {
  it("🔴 comparedEverything 을 «계산해서» 넘긴다 — true 를 박지 않는다", () => {
    expect(ROUTE).toContain("comparedEverything: comparison.notCompared.length === 0");
    expect(ROUTE).not.toContain("comparedEverything: true");
  });
});

describe("⑥ 🔴 보고서가 「유지됨」을 뭉개지 않는다", () => {
  it("보장의 종류를 «셋» 으로 나눠 싣는다", () => {
    /* unchanged(값이 같음 확인) · lossChecked(사라지지 않음) ·
       notCompared(보지 못함). 한 줄로 합치면 확인하지 않은 것을 확인했다고
       말하는 것이 된다. */
    expect(ROUTE).toContain("unchanged:");
    expect(ROUTE).toContain("lossChecked:");
    expect(ROUTE).toContain("notCompared:");
  });

  it("lossChecked 는 «비교 계층» 이 단 플래그로 고른다 — 화면이 목록을 따로 만들지 않는다", () => {
    expect(ROUTE).toContain("f.lossProtected");
  });

  it("화면에도 세 칸이 그대로 있다", () => {
    expect(PANEL).toContain("그대로입니다");
    expect(PANEL).toContain("사라지지 않습니다");
    expect(PANEL).toContain("확인하지 못했습니다");
  });

  it("🔴 화면이 diff 를 «다시 계산하지» 않는다", () => {
    for (const forbidden of ["compareRegisteredProduct", "detectUpdateDataLoss", "resolveLifecycle"]) {
      expect(PANEL).not.toContain(forbidden);
    }
  });

  it("🔴 손실검사 BLOCKED 면 실행 버튼이 «존재하지» 않는다", () => {
    /* 비활성화가 아니라 아예 렌더하지 않는다 — 있으면 누군가 disabled 를 뗀다. */
    expect(PANEL).toContain('const blocked = diff?.dataLossCheck === "BLOCKED"');
    expect(PANEL).toContain("{!blocked && (");
  });

  it("아직 보내지 않았다고 말한다 — 실패 메시지가 아니다", () => {
    expect(PANEL).toContain("보내지 않았습니다");
  });
});
