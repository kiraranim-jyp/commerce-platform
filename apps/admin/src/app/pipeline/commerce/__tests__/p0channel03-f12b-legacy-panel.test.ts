import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12b — **막기만 하고 «길을 주지 않던» 자리**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 063 이전에 등록된 상품은 ChannelProduct 가 없다. 화면은 「등록됨」이라 말하고,
 * 등록을 누르면 중복 방지 빗장에 막히는데 — 예전에는 그 막힘이 «조용했다»:
 *
 *     blockedFromSending() → setListingStates(SUBMITTED) → return null
 *
 * executor 를 부르지 않으므로 API 도 0회, `registration_attempts` 행도 «없다».
 * 셀러 입장에서는 가격을 고치고 등록을 눌렀는데 아무 일도 일어나지 않는다 —
 * 대표님이 ₩156,900 으로 겪은 것이 정확히 이 상태다.
 *
 * 🔴 이 파일이 지키는 것: 막을 때는 «이유를 말하고», 그 자리에서 «풀 수 있게» 한다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));
const PANEL_RAW = readFileSync(join(__dirname, "../LegacyLinkPanel.tsx"), "utf8");
const PANEL = codeOnly(PANEL_RAW);

describe("① 🔴 막을 때 «조용히» 막지 않는다", () => {
  const block = WORKSPACE.slice(
    WORKSPACE.indexOf("if (blockedFromSending(platform)) {"),
    WORKSPACE.indexOf("const listing = listingModelFor(platform);"),
  );

  it("🔴 SUBMITTED 로 적지 «않는다» — 아무것도 보내지 않았다", () => {
    /* 예전에는 여기서 SUBMITTED 로 적어, 화면이 「등록됨」이라 말하면서
       실제로는 아무 일도 하지 않았다. */
    expect(block).not.toContain('[platform]: "SUBMITTED"');
    expect(block).toContain('[platform]: "FAILED"');
  });

  it("왜 못 보냈는지를 결과로 남긴다", () => {
    expect(block).toContain("setListingResults(");
    expect(block).toContain("registrationBasisNote(state)");
  });

  it("푸는 방법을 같이 말한다", () => {
    expect(block).toContain("resolution:");
    expect(block).toContain("연결");
  });
});

describe("② 🔴 같은 화면에서 «풀 수 있다»", () => {
  it("ATTEMPT_ONLY 일 때만 복구 패널이 선다", () => {
    expect(WORKSPACE).toContain('registrationStateFor(tab).basis === "ATTEMPT_ONLY"');
    expect(WORKSPACE).toContain("<LegacyLinkPanel");
  });

  it("연결이 끝나면 화면이 상태를 다시 읽는다", () => {
    expect(WORKSPACE).toContain("onLinked={() => void refreshAttempts()}");
  });

  it("🔴 셀러에게 콘솔·SQL·credential 을 요구하지 않는다 — 버튼 하나다", () => {
    expect(PANEL).toContain('fetch("/api/channel-products/link"');
    for (const forbidden of ["SUPABASE", "service_role", "prompt(", "SERVICE_ROLE"]) {
      expect(PANEL).not.toContain(forbidden);
    }
  });
});

describe("③ 🔴 자동으로 잇지 않는다 — 두 단계다", () => {
  it("먼저 계획을 읽고(dry-run), 그 다음에 잇는다", () => {
    /* 한 번에 이으면 「사람이 확인한 뒤에만 연결한다」가 말뿐이 된다. */
    expect(PANEL).toContain("call(false)");
    expect(PANEL).toContain("call(true)");
    expect(PANEL).toContain('kind: "PLANNED"');
  });

  it("🔴 첫 호출에 apply 를 싣지 않는다", () => {
    expect(PANEL).toContain("...(apply ? { apply: true } : {})");
  });

  it("무엇을 근거로 잇는지 보여준다 — 성공한 등록 이력", () => {
    expect(PANEL_RAW).toContain("성공한 등록 이력");
    expect(PANEL).toContain("plan.successfulAttempts");
  });
});

describe("④ 🔴 서버가 멈춘 이유를 «덮지» 않는다", () => {
  it("STOP 문구를 그대로 보여준다", () => {
    expect(PANEL).toContain("data.stop");
    /* 「연결에 실패했습니다」 같은 말로 덮으면 무엇이 어긋났는지가 사라진다. */
    expect(PANEL_RAW).toContain("잇지 않았습니다");
  });

  it("상품번호를 모르면 버튼이 잠긴다 — 근거 없이 잇지 않는다", () => {
    expect(PANEL).toContain("!externalProductId");
  });

  it("🔴 스마트스토어 상품 자체를 건드리지 않는다고 말한다", () => {
    expect(PANEL_RAW).toContain("상품 자체는 건드리지 않고");
  });
});
