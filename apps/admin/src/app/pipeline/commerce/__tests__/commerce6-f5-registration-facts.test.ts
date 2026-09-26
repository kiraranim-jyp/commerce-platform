import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANNEL_CAPABILITY } from "../channel-lifecycle";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 F-5 — **「못 찾았다」를 「없다」로 적지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-5 조사에서 「롯데ON 전시카테고리 입력칸이 없다」 · 「KC 입력 경로가 없다」 ·
 * 「쿠팡이 variant 를 하나로 합쳐 보낸다」는 보고가 올라왔고, **셋 다 사실이
 * 아니었다.** 같은 오해가 반복되면 누군가 이미 있는 UI 를 다시 만든다.
 *
 * 🔴 이 파일은 기능을 바꾸지 않는다. 「있다」를 못박기만 한다.
 */

const PANEL = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
const COUPANG_BUILDER = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "..", "..", "packages", "listing", "src", "coupang", "build-payload.ts"),
  "utf8",
);

describe("① 롯데ON 전시카테고리 — 입력 경로가 «있다»", () => {
  it("전시카테고리 입력칸이 화면에 있다", () => {
    expect(PANEL).toContain("전시카테고리번호(dcatLst) 쉼표 입력칸");
    expect(PANEL).toContain("displayCategoryNos");
  });

  /* 🔴 그리고 셀러가 따로 채울 필요도 없다 — 표준카테고리를 고르면 함께 온다. */
  it("표준카테고리를 고르면 전시카테고리가 함께 채워진다", () => {
    expect(PANEL).toContain("setDisplayCategoryText(next.category.displayCategoryNos.join(\", \"))");
  });
});

describe("② 롯데ON 안전인증(KC) — 입력 경로가 «있다»", () => {
  it("안전인증 입력칸이 화면에 있다", () => {
    expect(PANEL).toContain("value={form.certification.safetyText}");
  });

  it("비어 있으면 화면이 그것을 «부족» 으로 센다", () => {
    expect(PANEL).toContain("const safetyMissing = safetyRequired && !form.certification.safetyText.trim()");
  });
});

describe("③ 쿠팡 옵션 — variant 마다 item 을 만든다", () => {
  it("variantSlots 를 map 해서 item 을 하나씩 만든다", () => {
    expect(COUPANG_BUILDER).toContain("const built = variantSlots.map((variant) =>");
    expect(COUPANG_BUILDER).toContain("const items: CoupangItem[] = built.map((b) => b.item);");
  });

  it("그 의도가 주석으로 남아 있다", () => {
    expect(COUPANG_BUILDER).toContain("variant별로 item을 하나씩 만든다");
  });
});

describe("④ 등록 lifecycle — Commerce-6 이 건드리지 않았다", () => {
  /* 🔴 UNKNOWN 은 실패가 아니라 «조사 부채» 다. 억지로 SUPPORTED 로 올리지 않는다. */
  it("capability 가 그대로다 — SmartStore 만 update SUPPORTED", () => {
    expect(CHANNEL_CAPABILITY.smartstore.update).toBe("SUPPORTED");
    expect(CHANNEL_CAPABILITY.coupang.update).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.lotteon.update).toBe("UNKNOWN");
  });

  it("어댑터가 등록된 채널은 SmartStore 하나다", () => {
    const adapters = readFileSync(join(__dirname, "..", "edit-adapters", "index.ts"), "utf8");
    const registry = adapters.slice(adapters.indexOf("EDIT_ADAPTERS"));
    expect(registry).toContain("smartstore:");
    expect(registry.slice(0, 600)).not.toMatch(/^\s*coupang:/m);
    expect(registry.slice(0, 600)).not.toMatch(/^\s*lotteon:/m);
  });
});
