import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeNaverPayloadReadiness } from "../readiness";
import { buildPriorityItems, describePriorityItem } from "../readiness-state";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 5 — **안내문이 «있는 곳» 을 가리키는지 계약으로 묶는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 저장소에서 **같은 버그가 7주 넘게 살아 있었다** — `readiness.ts`
 *    `naverFieldSectionId` 주석(2026-10-06 CEO 보고): 「바로가기가 기본정보로
 *    보내는데 실제 입력 위치는 고시정보다」. 그 주석이 남긴 교훈이 이것이다:
 *    **「위치는 주석이 아니라 테스트가 지킨다」.**
 *
 * STAGE 5 가 찾은 것: 등록 검증기의 재고 안내문이 **Settings** 를 가리켰는데
 * `Settings` 에 그 칸이 **없다**. 실제 칸은 **상품정보(`SourceDataView`)** 다.
 *
 * 🔴 그리고 그 문장은 **셀러 화면까지 그대로 간다**(죽은 문자열이 아니다) —
 *    아래 `S5-5`/`S5-6` 이 그 사슬을 **행동으로** 단언한다.
 *
 * 🔴 **판정은 건드리지 않는다** — 이 파일은 «말과 목적지» 만 본다.
 */

const ROOT = (() => {
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "packages", "listing", "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo 루트를 찾지 못했다");
})();

const VALIDATOR = readFileSync(path.join(ROOT, "packages/listing/src/naver/validate-payload.ts"), "utf8");
/** 🔴 주석을 벗긴다 — 주석에 든 옛 문장이 계약을 통과시키면 안 된다. */
const VALIDATOR_CODE = VALIDATOR.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const PLATFORM_PREVIEW = readFileSync(
  path.join(ROOT, "apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"),
  "utf8",
);
const SOURCE_DATA_VIEW = readFileSync(
  path.join(ROOT, "apps/admin/src/app/pipeline/commerce/SourceDataView.tsx"),
  "utf8",
);
/** 🟢 Settings 화면 전수 — 한 파일만 보면 탭이 늘 때 거짓 통과한다. */
const SETTINGS_DIR = path.join(ROOT, "apps/admin/src/app/settings");
const SETTINGS_SRC = readdirSync(SETTINGS_DIR)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => readFileSync(path.join(SETTINGS_DIR, f), "utf8"))
  .join("\n");

/* ══════════════ A — 재고 안내문: 고친 것 ══════════════ */

describe("STAGE5 · A — 재고 안내문이 실제 입력칸을 가리킨다", () => {
  it("S5-1 🔴🔴 재고 안내문이 **Settings 를 가리키지 않는다**", () => {
    const line = VALIDATOR_CODE.split("\n").find((l) => l.includes("보낼 옵션 조합이 0개입니다"));
    expect(line, "🔴 그 안내문이 사라졌다 — 이 계약의 분모가 없다").toBeTruthy();
    expect(line, "🔴 Settings 에는 「기본 재고 수량」 칸이 없다").not.toContain("Settings");
    expect(line).toContain("상품정보");
    expect(line).toContain("기본 재고 수량");
  });

  /** 🟢 그 칸이 «정말로» 거기 있는지 소스로 확인한다 — 안내문만 고치면 또 거짓말이 된다. */
  it("S5-2 🟢 「기본 재고 수량」 입력칸은 **상품정보(SourceDataView)에 있다**", () => {
    expect(SOURCE_DATA_VIEW, "🔴 입력칸이 옮겨졌다 — 안내문을 같이 고쳐야 한다").toContain("기본 재고 수량");
    expect(SOURCE_DATA_VIEW).toContain("onUpdateSellerDefaultStock");
  });

  /** 🔴 그리고 Settings 에는 **없다** — 이것이 옛 안내문이 틀렸던 이유다. */
  it("S5-3 🔴 Settings 전수에 그 칸이 **없다**(분모 확인)", () => {
    expect(SETTINGS_SRC.length, "🔴 Settings 소스를 읽지 못했다").toBeGreaterThan(1000);
    expect(SETTINGS_SRC).not.toContain("기본 재고");
    expect(SETTINGS_SRC).not.toContain("sellerDefaultStock");
  });

  /** 🟢 세 표면이 **같은 곳** 을 말한다 — 화면은 이미 맞게 적고 있었다. */
  it("S5-4 🟢 옵션 섹션의 안내문과 **같은 곳** 을 가리킨다", () => {
    expect(PLATFORM_PREVIEW, "🔴 화면 쪽 안내문이 바뀌었다").toContain(
      "상품정보 → 재고에서 기본 재고수량을 채우면 등록됩니다.",
    );
    const line = VALIDATOR_CODE.split("\n").find((l) => l.includes("보낼 옵션 조합이 0개입니다"))!;
    /** 🔴 둘 다 「상품정보」를 말해야 한다(한쪽만 고치면 또 모순이다). */
    expect(line).toContain("상품정보");
  });
});

/* ══════════════ B — Settings 를 가리키는 안내문 «전수» 가 실재하는 칸을 가리킨다 ══════════════ */

describe("STAGE5 · B — Settings 를 가리키는 안내문은 실재하는 칸만 가리킨다", () => {
  /**
   * 🟢 분모를 **코드에서 뽑는다** — 안내문이 늘어도 이 계약이 같이 커진다.
   * 🔴 「Settings」를 말하면서 「…」 로 칸 이름을 **인용한** 문장만 본다
   *    (인용이 없는 일반 안내는 가리킬 칸이 특정되지 않으므로 분모가 아니다).
   */
  /** 🔴 소스의 `\"` 이스케이프를 먼저 벗긴다 — 1차에 백슬래시까지 칸 이름으로 잡았다. */
  const quoted = (s: string) =>
    [...s.replace(/\\/g, "").matchAll(/[「"]([^「」"]{2,20})[」"]/g)].map((m) => m[1]!.trim());
  const settingsLines = VALIDATOR_CODE.split("\n").filter(
    (l) => l.includes("Settings") && quoted(l).length > 0,
  );

  it("S5-5 🔴 인용된 칸 이름이 **Settings 화면에 실재한다**", () => {
    /* eslint-disable no-console */
    expect(settingsLines.length, "🔴 분모가 0 이면 이 계약은 아무것도 잠그지 않는다").toBeGreaterThan(0);
    const bad: string[] = [];
    for (const l of settingsLines) {
      for (const label of quoted(l)) {
        if (!SETTINGS_SRC.includes(label)) bad.push(label);
      }
    }
    console.log(`\n═══ STAGE5/B — Settings 를 가리키며 칸을 인용한 안내문 ${settingsLines.length}건 ═══`);
    for (const l of settingsLines) console.log(`  · 인용 [${quoted(l).join(" / ")}]`);
    console.log(`  🔴 Settings 에 없는 칸: ${bad.length ? bad.join(", ") : "없음"}`);
    expect(bad, "🔴 안내문이 Settings 에 없는 칸을 가리킨다 — 셀러가 갈 곳이 없다").toEqual([]);
  });
});

/* ══════════════ C — 그 문장이 «셀러 화면까지» 간다(LIVE 증명) ══════════════ */

describe("STAGE5 · C — 검증기 안내문은 배너까지 간다(죽은 문자열이 아니다)", () => {
  /** 🟢 운영 함수를 직접 부른다 — 소스 grep 이 아니다. */
  const validation = {
    ok: false,
    readyCount: 0,
    missingCount: 1,
    blockedCount: 0,
    issues: [],
    fields: [
      {
        field: "detailAttribute.optionInfo.optionCombinations",
        status: "MISSING" as const,
        reason: "상품정보 → 재고의 「기본 재고 수량」을 입력하면 조합이 복구됩니다",
      },
    ],
  };

  it("S5-6 🔴🔴 `reason` 이 `hint` 로 실려 간다", () => {
    const summary = computeNaverPayloadReadiness(validation as never);
    const item = summary.items.find((i) => i.label && i.hint);
    expect(item, "🔴 hint 가 비면 안내문이 화면에 못 간다").toBeTruthy();
    expect(item!.hint).toContain("상품정보");
    expect(item!.hint, "🔴 Settings 로 되돌아갔다").not.toContain("Settings");
  });

  it("S5-7 🔴🔴 그 `hint` 가 배너의 **`why`** 가 된다 — 셀러가 읽는 문장이다", () => {
    const summary = computeNaverPayloadReadiness(validation as never);
    /**
     * 🔴 인자는 **셋** 이다 — `(summary, priceValid, priceSectionId)`.
     *    1차에 둘만 넘겼고 **typecheck 가 잡았다**(런타임은 통과했다 · TS2554).
     * 🟢 `priceValid = true` 로 둔다 — 가격 항목이 섞이면 이 계약의 분모가 흐려진다.
     */
    const items = buildPriorityItems(summary as never, true, undefined);
    expect(items.length, "🔴 우선 항목이 비면 배너에 아무것도 안 뜬다").toBeGreaterThan(0);
    const guides = items.map((i) => describePriorityItem(i));
    const why = guides.map((g) => g.why).join(" | ");
    expect(why, "🔴 안내문이 배너까지 오지 않는다 — 그러면 이 수정의 의미가 없다").toContain("상품정보");
    expect(why).not.toContain("Settings의 「기본 재고 수량」");
  });

  /** 🔴 목적지(섹션)는 **그대로 둔다** — 그 버튼은 동작하고, 그 섹션이 같은 말을 적고 있다. */
  it("S5-8 🟢 목적지 매핑은 바꾸지 않았다(옵션 섹션 유지)", () => {
    const readiness = readFileSync(path.join(ROOT, "apps/admin/src/app/pipeline/commerce/readiness.ts"), "utf8");
    expect(readiness).toContain(
      'if (field === "detailAttribute.optionInfo.optionCombinations") return "section-options";',
    );
    /** 🟢 그 섹션이 실제로 그려진다(죽은 id 가 아니다). */
    expect(PLATFORM_PREVIEW).toContain('sectionProps("section-options")');
  });
});
