import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-2 — **수정 경로는 fail-closed 다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 수정은 «전체 교체» 라(공식: 「포함하지 않은 정보는 제거하는 행동으로
 * 동작」), 바뀐 것만 보내면 나머지가 지워지는데 응답은 200 이다. 그래서 순서가
 * 곧 안전장치다:
 *
 *     GET(지금 나가 있는 것) → preflight(사라지는 것?) → PUT → 응답번호 검증
 *
 * 순서가 바뀌거나 한 단계가 빠지면 실제 판매 상품의 상세설명·이미지가
 * 조용히 사라진다. 이 파일이 «순서와 조기 반환» 을 못 박는다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));
const RAW = readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8");
const CLIENT = codeOnly(
  readFileSync(join(__dirname, "../../naver/_lib/client.ts"), "utf8"),
);

describe("① 순서 — GET → preflight → PUT → 검증", () => {
  const iFetch = SRC.indexOf("await fetchRegisteredProduct(");
  const iPreflight = SRC.indexOf("detectUpdateDataLoss(");
  const iPut = SRC.indexOf('method: "PUT"');
  const iVerify = SRC.indexOf("isSameOriginProduct(");

  it("네 단계가 모두 있다", () => {
    for (const i of [iFetch, iPreflight, iPut, iVerify]) expect(i).toBeGreaterThan(-1);
  });

  it("🔴 preflight 가 PUT «앞» 이다 — 보내고 나서 검사하면 늦는다", () => {
    expect(iFetch).toBeLessThan(iPreflight);
    expect(iPreflight).toBeLessThan(iPut);
  });

  it("🔴 응답번호 검증이 PUT «뒤» 다", () => {
    expect(iPut).toBeLessThan(iVerify);
  });
});

describe("② 🔴 fail-closed — 확인 못 하면 «보내지 않는다»", () => {
  it("GET 이 실패하면 거기서 끝난다", () => {
    expect(SRC).toContain('if (!current.ok) return { ok: false, step: "FETCH"');
  });

  it("🔴 위험이 하나라도 있으면 PUT 을 호출하지 않는다", () => {
    /* 「일부만 지워지는」 결과가 가장 나쁘다 — 0건일 때만 보낸다. */
    expect(SRC).toContain("if (risks.length > 0) {");
    const between = SRC.slice(SRC.indexOf("if (risks.length > 0) {"), SRC.indexOf('method: "PUT"'));
    expect(between).toContain('step: "PREFLIGHT"');
    expect(between).toContain("return {");
  });

  it("위험 항목을 그대로 돌려준다 — 무엇이 사라지는지 화면이 말할 수 있게", () => {
    expect(SRC).toContain("risks,");
  });
});

describe("③ 🔴 응답번호가 다르면 성공이 아니다", () => {
  it("검증 실패 시 VERIFY 단계로 끊는다", () => {
    expect(SRC).toContain("if (!isSameOriginProduct(originProductNo, responded)) {");
    expect(SRC).toContain('step: "VERIFY"');
  });

  it("성공 반환이 «검증 뒤» 에만 있다", () => {
    const iVerifyBlock = SRC.indexOf("if (!isSameOriginProduct(");
    const iSuccess = SRC.indexOf("return { ok: true, originProductNo, status: res.status };");
    expect(iVerifyBlock).toBeLessThan(iSuccess);
  });
});

describe("④ 🔴 여기서 lifecycle 을 다시 판단하지 않는다", () => {
  it("resolveLifecycle 을 부르지 않는다 — 판단은 한 곳이다", () => {
    expect(SRC).not.toContain("resolveLifecycle");
    for (const forbidden of ["RECREATE", "CREATE", "NOOP"]) {
      expect(SRC).not.toContain(`"${forbidden}"`);
    }
  });

  it("payload 를 여기서 조립하지 않는다 — CREATE 와 같은 builder 를 쓴다", () => {
    expect(SRC).not.toContain("buildNaverProductPayload");
    expect(SRC).toContain("payload: NaverProductRegistrationPayload");
  });
});

describe("⑤ 🔴 오류 문구를 지어내지 않는다", () => {
  it("네이버 invalidInputs 원문을 그대로 옮긴다", () => {
    expect(SRC).toContain("invalidInputs");
    expect(RAW).toContain("사유:");
  });
});

describe("⑥ client — PUT 만 늘렸고 DELETE 는 없다", () => {
  it("PUT 이 POST 와 «같은» 경로를 탄다", () => {
    expect(CLIENT).toContain('method: "GET" | "POST" | "PUT"');
  });

  it("🔴 DELETE 를 넣지 않았다 — 외부 상품을 지우는 경로는 없어야 한다", () => {
    expect(CLIENT).not.toContain('"DELETE"');
  });
});
