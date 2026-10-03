import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categoryFieldRule, isVerifiedCategorySelected } from "../category-field";
import type { CategorySelection } from "@commerce/category";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 4 — **막는 것을 「확인 필요」라고 말하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 카테고리가 플랫폼 코드로 확정되지 않으면 등록이 «실제로» 막힌다:
 *
 *     isVerifiedCategorySelected  false
 *       → resolveVerifiedCategoryCode()        null
 *       → missingSellerConfigFields()          「쿠팡 카테고리 코드」
 *       → classifyMissingSellerConfig()        CP001 — 등록 실패
 *
 * 그런데 `onFail` 이 `WARNING` 이어서 화면은 🟡「확인 필요」라고 말했다.
 * 「등록을 막는 것과 봐야 하는 것을 다른 말로 적는다」가 이번 요구사항의 ① 이고,
 * 이 테스트가 그 한 줄이 다시 내려가는 것을 막는다.
 */
const sel = (over: Partial<CategorySelection>): CategorySelection =>
  ({ state: "UNRESOLVED", candidate: null, ...over }) as CategorySelection;

describe("① 🔴 카테고리 미확정은 ERROR 다 — WARNING 이 아니다", () => {
  it("규칙의 onFail 이 ERROR 다", () => {
    expect(categoryFieldRule(sel({})).onFail).toBe("ERROR");
  });

  it("🔴 소스에 WARNING 이 남아 있지 않다 — 주석을 벗기고 본다", () => {
    const src = readFileSync(join(__dirname, "../category-field.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(src).toContain('onFail: "ERROR"');
    expect(src).not.toContain('onFail: "WARNING"');
  });
});

describe("② 등급이 «막히는 조건» 과 정확히 같다", () => {
  const BLOCKED = [
    ["아무것도 안 고름", sel({})],
    ["추천만 받음", sel({ state: "RECOMMENDED" })],
    ["골랐지만 플랫폼 코드가 아님", sel({ state: "SELECTED", candidate: { id: "internal-1" } as never })],
    [
      "확정했지만 플랫폼 코드가 아님",
      sel({ state: "CONFIRMED", candidate: { id: "internal-1", isVerifiedPlatformCode: false } as never }),
    ],
  ] as [string, CategorySelection][];

  it.each(BLOCKED)("%s → check 실패이고 등급이 ERROR 다", (_label, selection) => {
    const rule = categoryFieldRule(selection);
    expect(rule.check()).toBe(false);
    expect(rule.onFail).toBe("ERROR");
    expect(isVerifiedCategorySelected(selection)).toBe(false);
  });

  it("🔴 플랫폼이 돌려준 코드를 확정하면 통과한다 — 항상 막는 것이 아니다", () => {
    const ok = sel({ state: "CONFIRMED", candidate: { id: "63955", isVerifiedPlatformCode: true } as never });
    expect(categoryFieldRule(ok).check()).toBe(true);
    expect(isVerifiedCategorySelected(ok)).toBe(true);
  });
});

describe("③ 🔴 세 어댑터가 «같은» 규칙 하나를 쓴다", () => {
  const ADAPTERS = ["coupang", "smartstore", "elevenst"] as const;

  it.each(ADAPTERS)("%s 어댑터가 categoryFieldRule 을 그대로 부른다", (name) => {
    const src = readFileSync(join(__dirname, `../adapters/${name}.adapter.ts`), "utf8");
    expect(src).toContain("categoryFieldRule(categorySelection)");
    /* 🔴 자기만의 카테고리 판정을 따로 만들지 않았다 — 셋이 갈리면 한 채널만
       「확인 필요」로 남는다. */
    expect(src).not.toMatch(/onFail:\s*"WARNING"[\s\S]{0,120}카테고리/);
  });

  it("라벨이 한 곳에서만 온다", () => {
    expect(categoryFieldRule(sel({})).label).toBe("카테고리");
    expect(categoryFieldRule(sel({})).field).toBe("category");
  });
});

describe("④ 문구가 «무엇을 해야 하는지» 를 말한다", () => {
  it("아직 안 골랐으면 고르라고 한다", () => {
    expect(categoryFieldRule(sel({})).message).toContain("카테고리를 선택");
  });
  it("추천만 받았으면 확인하라고 한다", () => {
    expect(categoryFieldRule(sel({ state: "RECOMMENDED" })).message).toContain("추천된 카테고리");
  });
  it("🔴 골랐는데 플랫폼 코드가 아니면 «다시 고르라» 고 한다 — 「확인」으로 뭉개지 않는다", () => {
    const msg = categoryFieldRule(
      sel({ state: "SELECTED", candidate: { id: "x" } as never }),
    ).message;
    expect(msg).toContain("실제 카테고리 코드로 확인되지 않았");
    expect(msg).toContain("다시 선택");
  });
});
