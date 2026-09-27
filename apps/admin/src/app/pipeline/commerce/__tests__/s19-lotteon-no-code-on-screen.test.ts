import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-19 — **셀러는 코드가 아니라 «이름» 을 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실화면(2026-09-27)에 이렇게 떠 있었다.
 *
 *     출고지번호      PLO3837441
 *     배송비정책번호  4279402
 *
 * F-7 이 «입력» 은 막았지만(readOnly) «표시» 는 코드 그대로였다. 셀러가 관리할
 * 정보가 아니고, 롯데ON 판매자센터가 발급한 번호라 외워서 쓸 수도 없다.
 *
 * 🔴 값을 «바꾸지 않았다». 코드는 payload 로 그대로 나가고 화면만 이름을 쓴다.
 * 그래서 등록 동작은 한 글자도 달라지지 않는다.
 */

const PANEL = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8").replace(/\r\n/g, "\n");
const FIELDS = readFileSync(join(__dirname, "..", "registration-fields.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("① 표시와 값이 갈린다", () => {
  it("입력칸이 displayValue 를 먼저 그린다", () => {
    expect(FIELDS).toContain("const shown = displayValue ?? value;");
    expect(FIELDS).toContain("value={shown}");
  });

  /* 🔴 값 자체는 손대지 않았다 — onChange 와 payload 는 그대로다. */
  it("값(value)은 그대로 남아 있다", () => {
    expect(FIELDS).toContain("onChange={(event) => onChange(event.target.value)}");
  });
});

describe("② 롯데ON 배송 세 칸이 «이름» 을 보여준다", () => {
  it.each([
    ["출고지", "outboundPlaceNo", "outboundPlaces"],
    ["반품지", "returnPlaceNo", "returnPlaces"],
    ["배송비 정책", "deliveryCostPolicyNo", "costPolicies"],
  ])("%s — 목록에서 살아 있는 이름을 쓴다", (_label, field, list) => {
    expect(PANEL).toContain(`liveNameOf(deliverySettings.data?.${list}, form.delivery.${field})`);
  });

  /* 🔴 CEO 가 «바로» 잡은 부분이다. 처음에 「이름을 못 찾으면 코드로 되돌아간다」로
     만들었는데 그것은 내부 코드가 fallback 으로 다시 살아나는 길이다.
     PLO3837441 은 셀러에게 «아무것도 아닌 것보다 나쁘다» — 관리할 수 없는
     값을 관리하라고 보여준다. */
  it("🔴 이름을 모르면 «코드가 아니라» 확인 필요다", () => {
    expect(PANEL).toContain("function sellerFacingName");
    expect(PANEL).toContain("`${what} 확인 필요`");
    /* 코드로 되돌아가는 옛 경로가 사라졌다. */
    expect(PANEL).not.toContain("?? undefined)");
  });

  it("고른 적이 없으면 빈 칸이다 — 「확인 필요」라고 겁주지 않는다", () => {
    expect(PANEL).toContain('return code.trim() ? `${what} 확인 필요` : "";');
  });
});

describe("③ 🔴 코드가 «셀러 화면» 에 다시 서지 않는다", () => {
  /* 주석은 이 변경을 설명하느라 코드 예시를 인용한다 — 코드만 본다. */
  const code = PANEL.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("Production 에서 본 그 값들이 화면 문자열로 박혀 있지 않다", () => {
    expect(code).not.toContain("PLO3837441");
    expect(code).not.toContain("4279402");
  });

  it("세 칸이 여전히 읽기 전용이다 — 코드를 «적게» 하지 않는다", () => {
    expect(PANEL).toContain("readOnly");
  });
});
