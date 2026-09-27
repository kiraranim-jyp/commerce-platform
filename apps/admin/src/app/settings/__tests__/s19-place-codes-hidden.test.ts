import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-19 — **출고지·반품지 «번호» 는 셀러의 것이 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실화면(2026-09-27): 배송 프로필에
 *
 *     출고지   Hessen (24496935)        + 코드 직접 입력칸 `24496935`
 *     반품지   반품주소지 (1002578446)  + 코드 직접 입력칸 `1002578446`
 *
 * 이 떠 있었다. 그 번호는 «채널이 발급» 한다 — 셀러가 외워서 적을 값이 아니다.
 *
 * ── Common 과 Mapping 의 경계 ─────────────────────────────────────────────
 *
 *     Common       반품지 = 「서울 물류센터」 · 주소 · 연락처   ← 사람이 아는 사실
 *     Mapping      SmartStore 주소록 번호 · Coupang 반품지 코드 ·
 *                  LotteON 회수지 번호                        ← Adapter 영역
 *
 * 🔴 Commerce 내부 코드를 Common 에 «저장하지 않는다» 는 것이 원칙이고, 화면에
 * 보여주지 않는 것은 그 원칙의 최소선이다.
 *
 * 🔴 Commerce 가 30개가 되면 이런 칸이 채널마다 생긴다 — 만들려는 것과 반대다.
 */

const SETTINGS = readFileSync(join(__dirname, "..", "page.tsx"), "utf8").replace(/\r\n/g, "\n");
/** 주석이 옛 문구를 인용하므로 코드만 본다(같은 실수를 여러 번 했다). */
const code = SETTINGS.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("① 코드를 «적는» 칸이 없다", () => {
  it.each([
    ["출고지", "출고지 코드 직접 입력"],
    ["반품지", "반품지 코드 직접 입력"],
  ])("%s — 직접 입력 placeholder 가 사라졌다", (_label, placeholder) => {
    expect(code).not.toContain(placeholder);
  });
});

describe("② 고르는 길은 남아 있다", () => {
  /* 없애기만 하면 셀러가 출고지를 정할 방법이 사라진다 — 목록은 그대로다. */
  it.each([
    ["출고지", "onOutboundShippingPlaceCodeChange"],
    ["반품지", "onReturnCenterCodeChange"],
  ])("%s — 목록에서 고르면 값이 바뀐다", (_label, handler) => {
    expect(code).toContain(handler);
    expect(code).toContain("목록에서 선택...");
  });
});

describe("③ 🔴 Common 이 갖는 것은 «사실» 이다", () => {
  /* 반품지명·연락처·우편번호·주소는 채널 코드가 아니라 사람이 아는 사실이다.
     이 넷은 Common 에 있어야 하고 화면에 남는다 — 없애면 안 된다. */
  it.each(["반품지명", "반품지 연락처", "반품지 우편번호", "반품지 주소"])("%s 는 그대로 있다", (label) => {
    expect(code).toContain(`label="${label}"`);
  });
});
