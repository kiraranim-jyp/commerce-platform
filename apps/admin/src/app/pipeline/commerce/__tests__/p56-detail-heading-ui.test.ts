import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * P5.6 P0-2(CEO 요구, 2026-10-09) — 상세페이지 «항목» 제목 입력칸.
 *
 * 🔴 조립·저장 계층은 552b525 에서 닫았다(listing 12 PASS). 이 파일은 «화면이
 *    그 칸을 실제로 준다» 는 것만 잠근다 — 패널은 upload/sessionStorage 를 끼고
 *    있어 마운트가 새 harness 가 되므로 소스로 확인하고, 그 한계를 적어 둔다.
 */
const SRC = readFileSync(new URL("../ProductDetailBlocksPanel.tsx", import.meta.url), "utf8");

describe("🔴🔴 ① 두 항목 kind 모두 제목 칸을 갖는다", () => {
  it("CUSTOM_TEXT 와 CUSTOM_IMAGE 가 같은 조건에서 제목을 받는다", () => {
    expect(SRC).toContain('block.kind === "CUSTOM_TEXT" || block.kind === "CUSTOM_IMAGE"');
  });

  it("제목 변경이 heading 으로 저장된다 — 조립기와 같은 어휘", () => {
    expect(SRC).toMatch(/patch\(identity, \{ heading: e\.target\.value \}\)/);
  });

  it("값이 block.heading 에서 온다", () => {
    expect(SRC).toContain("value={block.heading ?? \"\"}");
  });
});

describe("🔴🔴 ② 기존 칸을 건드리지 않았다 — 회귀", () => {
  it("본문(content) 입력이 그대로다", () => {
    expect(SRC).toMatch(/patch\(identity, \{ content: e\.target\.value \}\)/);
  });
  it("이미지 문구(caption) 입력이 그대로다", () => {
    expect(SRC).toMatch(/patch\(identity, \{ caption: e\.target\.value \}\)/);
  });
  it("🔴 제목이 본문·문구를 «대체하지» 않는다 — 셋이 각자 있다", () => {
    expect(SRC).toContain("value={block.content}");
    expect(SRC).toContain("value={block.caption ?? \"\"}");
  });
});

describe("🔴 ③ 제목은 선택이다", () => {
  it("비워도 된다고 화면이 말한다", () => {
    expect(SRC).toContain("비워도 됩니다");
  });
});
