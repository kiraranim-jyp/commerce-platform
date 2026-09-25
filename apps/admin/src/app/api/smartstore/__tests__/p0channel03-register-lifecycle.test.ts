import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-7 — **라우트의 갈림길**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 이 라우트에는 «만들기» 하나뿐이었다. 상품을 고치면 갈 곳이 없었고,
 * 재분석으로 새 snapshot 이 생기면 «또» 만들었다 — SmartStore 외부번호 6개의
 * 뿌리가 그것이다.
 *
 * 🔴 이 파일이 지키는 것은 「동작」이 아니라 «순서와 빗장» 이다. 실제 네이버
 * 호출은 테스트할 수 없으므로(Production API 0건 원칙), 대신 «위험한 코드가
 * 존재하지 않는다» 를 고정한다 — 이 스프린트의 다른 테스트들과 같은 방식.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = join(__dirname, "../register/route.ts");
const SRC = codeOnly(readFileSync(ROUTE, "utf8"));
const RAW = readFileSync(ROUTE, "utf8");

describe("① 판단은 한 곳이다 — 라우트가 직접 정하지 않는다", () => {
  it("resolveLifecycle() 이 정한다", () => {
    expect(SRC).toContain("resolveLifecycle(\"smartstore\", true, {");
  });

  it("🔴 operation 을 «추론» 해서 적지 않는다 — 정해진 변수를 그대로 적는다", () => {
    /* 「external_product_id 가 있으면 UPDATE」 같은 추론을 하면 판단이 두 벌이
       되고, 화면과 실제가 갈라진다. */
    expect(SRC).toContain("operation: plannedOperation,");
    expect(SRC).toContain('operation: "UPDATE",');
    /* 🔴 «이력에 적는 자리» 만 본다. F-10 이 needsConfirmation 에
       `operation: "RECREATE"` 를 쓰는데 그것은 「무엇을 물어보는가」이지
       「무엇을 했다고 적는가」가 아니다 — 파일 전체를 훑으면 그 둘이 섞인다. */
    const logged = [...SRC.matchAll(/await logRegistrationAttempt\([^;]*?operation: ([^,\n]+)/g)].map(
      (m) => m[1]!.trim(),
    );
    expect(logged.length).toBeGreaterThan(0);
    /* CREATE/RECREATE 를 문자열로 박아 넣던 자리가 사라졌다 — 정해진 변수뿐. */
    for (const value of logged) {
      expect(['"CREATE"', '"RECREATE"']).not.toContain(value);
    }
  });
});

describe("② 🔴 카테고리 UNKNOWN 을 「안 바뀜」으로 접지 않는다", () => {
  it("categoryUnknown 을 따로 넘긴다", () => {
    expect(SRC).toContain('categoryUnknown: comparison.category === "UNKNOWN"');
    expect(SRC).toContain('category: comparison.category === "CHANGED"');
  });

  it("🔴 비교가 전수인지 «계산해서» 넘긴다 — true 를 박지 않는다", () => {
    expect(SRC).toContain("comparedEverything: comparison.notCompared.length === 0");
    expect(SRC).not.toContain("comparedEverything: true");
  });
});

describe("③ 🔴 읽지 못하면 «정하지 않는다» — fail-closed", () => {
  it("GET 실패는 CREATE 로 내려가지 않고 거기서 끝난다", () => {
    const iFetch = SRC.indexOf("await fetchRegisteredProduct(");
    const iGuard = SRC.indexOf("if (!current.ok) {");
    const iCompare = SRC.indexOf("compareRegisteredProduct(");
    expect(iFetch).toBeGreaterThan(-1);
    expect(iGuard).toBeGreaterThan(iFetch);
    expect(iGuard).toBeLessThan(iCompare);
  });

  it("판단 → 실행 순서다", () => {
    const iDecision = SRC.indexOf("resolveLifecycle(");
    const iUpdate = SRC.indexOf("await updateRegisteredProduct(");
    const iCreate = SRC.indexOf("path: CREATE_PRODUCT_PATH");
    expect(iDecision).toBeLessThan(iUpdate);
    expect(iDecision).toBeLessThan(iCreate);
  });
});

describe("④ 🔴 중복 CREATE 를 구조적으로 막는다", () => {
  it("POST «앞» 에 마지막 빗장이 있다", () => {
    /* F-12a 에서 이 빗장의 «판단» 을 resolveCreateGate() 한 곳으로 모았다.
       여기서 지키는 것은 그대로다 — 빗장이 POST 앞에 선다. */
    const iGuard = SRC.indexOf("resolveCreateGate({");
    const iCreate = SRC.indexOf("path: CREATE_PRODUCT_PATH");
    expect(iGuard).toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(iCreate);
  });

  it("🔴 RECREATE 는 셀러 동의 없이 진행하지 않는다", () => {
    /* 동의 없이 만들면 마켓에 상품이 하나 더 생긴다 — 이번에 고치려는 중복
       그 자체다. 기본값은 «안 함» 이어야 한다. */
    expect(SRC).toContain("body.confirmRecreate === true");
    expect(SRC).toContain("if (!confirmRecreate) {");
    const iConsent = SRC.indexOf("if (!confirmRecreate) {");
    const iPlan = SRC.indexOf('plannedOperation = "RECREATE";');
    expect(iConsent).toBeLessThan(iPlan);
  });

  it("RECREATE 는 연결을 «갈아끼운다» — 새로 만들지 않는다", () => {
    /* 새로 만들면 같은 상품 × 같은 채널에 ChannelProduct 가 둘이 되고,
       「지금 어느 외부 상품과 연결돼 있는가」에 답이 두 개가 된다. */
    expect(SRC).toContain("replaceChannelProductLink(existing.id,");
  });

  it("🔴 새 번호를 못 읽었으면 갈아끼우지 않는다 — String(undefined) 방지", () => {
    /* "undefined" 가 external_product_id 에 들어가면 현재 연결이 존재하지
       않는 상품을 가리키고, 다음 등록이 그것을 수정하려 든다. */
    expect(SRC).toContain("if (result.externalProductId) {");
    /* 🔴 «연결을 갈아끼우는» 자리에 무가드 String() 이 없어야 한다.
       (응답을 result.externalProductId 로 옮기는 자리는 `!= null` 가드가 있는
        기존 코드이고, 그쪽은 undefined 를 undefined 로 남긴다.) */
    expect(SRC).not.toContain("replaceChannelProductLink(existing.id, String(");
  });
});

describe("⑤ 🔴 하지 않은 것을 했다고 적지 않는다", () => {
  it("UPDATE 실패·NOOP·BLOCKED 에는 operation 을 적지 않는다", () => {
    /* logRegistrationAttempt 의 5번째 인자가 없는 호출 = operation NULL.
       「시도해서 실패」와 「애초에 보내지도 않음」이 같아지면 안 된다. */
    /* 🔴 `await` 로 앵커한다 — 앵커가 없으면 함수 «정의» 의 lifecycle 파라미터
       타입까지 세어서 검사가 조용히 무의미해진다(처음에 실제로 그랬다). */
    const withOperation = SRC.match(/await logRegistrationAttempt\([^;]*?\{\s*\n?\s*operation:/g) ?? [];
    /* operation 을 적는 호출은 «성공 두 곳» 뿐이다(UPDATE 성공 · CREATE/RECREATE 성공). */
    expect(withOperation.length).toBe(2);
  });

  it("UPDATE 성공은 «같은» 외부번호를 돌려준다", () => {
    expect(SRC).toContain("externalProductId: updated.originProductNo,");
  });

  it("🔴 ListingStatus 를 새로 만들지 않았다 — 과거 97행의 의미를 흔들지 않는다", () => {
    for (const invented of ['"NOOP"', '"BLOCKED"', '"SKIPPED"', '"NO_CHANGE"']) {
      expect(SRC).not.toContain(`status: ${invented}`);
    }
  });

  it("RECREATE 감사기록에 «무엇을 대체했는지» 가 남는다", () => {
    expect(SRC).toContain("replacedExternalProductId");
  });
});

describe("⑥ 기존 CREATE 경로를 건드리지 않았다", () => {
  it("연결이 없으면(기존 381 snapshot) 예전 그대로 CREATE 로 내려간다", () => {
    /* findChannelProductBySnapshot 은 product_id 가 NULL 이면 null 을 낸다 —
       그 상품들은 if (existing) 블록에 «들어가지도» 않는다. */
    expect(SRC).toContain('const existing = await findChannelProductBySnapshot(snapshotId, "smartstore");');
    expect(SRC).toContain("if (existing) {");
  });

  it("🔴 외부 상품을 지우는 경로가 없다", () => {
    expect(SRC).not.toContain('method: "DELETE"');
    expect(RAW).not.toContain("DELETE");
  });
});
