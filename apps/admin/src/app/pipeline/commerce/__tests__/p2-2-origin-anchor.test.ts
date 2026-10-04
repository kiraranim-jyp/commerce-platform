import { describe, expect, it } from "vitest";
import { REGISTRATION_FIELD_ANCHOR, registrationFieldAnchor } from "../readiness-state";
import type { PriorityItem } from "../readiness-state";
/* `ReadinessItem` 은 readiness-state 가 re-export 하지 않는다 — 원래 자리에서 가져온다. */
import type { ReadinessItem } from "../readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-2 ① — 「기본정보에서 입력하기」가 **그 칸** 으로 간다 (CEO 실측, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사고: 버튼을 눌러도 원산지로 가지 않았다. 원인은 버튼이 아니라 «이동 대상»
 * 이다 — `goToSection` 은 섹션을 열고 그 안의 **첫 번째** 입력칸을 포커스하고,
 * 기본정보의 첫 칸은 「상품명」이다. 그래서 「이동」이라고 말하면서 이동하지 않았다.
 *
 * 🔴 공통 패턴인지를 «구조로» 재고, 원산지 하나만 통과하는지 보지 않는다 —
 * 필드를 더하는 비용이 「표 한 줄 + id 한 개」인지가 이 테스트의 관심사다.
 */
const item = (label: string, sourceLabels: string[]): PriorityItem => ({
  key: label,
  label,
  sourceItems: sourceLabels.map((l) => ({ label: l, passed: false, required: true }) as ReadinessItem),
});

describe("① 🔴 원산지 두 라벨이 «같은 칸» 을 가리킨다", () => {
  it("「원산지」(코드 미확인) → 원산지 입력칸", () => {
    expect(registrationFieldAnchor(item("스마트스토어 확인 필요", ["원산지"]))).toBe("field-countryOfOrigin");
  });

  it("🔴 「원산지 직접입력」(04 로 떨어진 경우) → «같은» 칸", () => {
    /* P2-1 A 가 두 이름으로 가른 그 둘이다. 셀러가 적는 곳은 하나뿐이므로
       앵커도 하나여야 한다 — 두 칸으로 보내면 셀러는 어디에 적을지 모른다. */
    expect(registrationFieldAnchor(item("스마트스토어 확인 필요", ["원산지 직접입력"]))).toBe(
      "field-countryOfOrigin",
    );
  });

  it("항목 라벨 자체로도 찾는다 — sourceItems 가 비어 있어도", () => {
    expect(registrationFieldAnchor(item("원산지", []))).toBe("field-countryOfOrigin");
  });
});

describe("② 🔴 표에 없는 항목은 지금까지와 «똑같이» 동작한다 (회귀 없음)", () => {
  it("매핑이 없으면 undefined — 섹션까지만 이동한다", () => {
    expect(registrationFieldAnchor(item("상품명", ["상품명"]))).toBeUndefined();
    expect(registrationFieldAnchor(item("카테고리", ["카테고리"]))).toBeUndefined();
    expect(registrationFieldAnchor(item("인증정보(KC)", ["인증정보(KC)"]))).toBeUndefined();
  });

  it("🔴 가드가 공허하지 않다 — 표가 실제로 비어 있지 않다", () => {
    expect(Object.keys(REGISTRATION_FIELD_ANCHOR).length).toBeGreaterThan(0);
  });
});

describe("③ 🔴 앵커 id 가 화면에 «실제로» 있다 — 이동 경로 없는 안내를 만들지 않는다", () => {
  it("표의 모든 앵커가 PlatformPreview 의 DOM id 와 짝이 있다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const preview = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8");
    /* 🔴 주석을 벗기고 본다 — 앵커 id 를 «설명하는» 주석이 그 파일에 있어서,
       벗기지 않으면 설명문이 짝으로 세어진다(이 저장소에서 반복해 걸린 함정). */
    const code = preview
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    for (const anchor of new Set(Object.values(REGISTRATION_FIELD_ANCHOR))) {
      expect(code, `${anchor} 앵커가 화면에 없다 — 눌러도 아무 데도 가지 않는다`).toContain(`id="${anchor}"`);
    }
  });
});

describe("④ 🔴 클릭 지점이 앵커를 «실제로 넘긴다»", () => {
  it("goToSection 이 두 번째 인자를 받고 호출부가 그것을 넘긴다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("function goToSection(sectionId: string, fieldAnchorId?: string)");
    expect(code).toContain("goToSection(item.sectionId, registrationFieldAnchor(item))");
    /* 🔴 포커스도 앵커 «안» 에서 찾는다 — 스크롤만 하고 포커스를 섹션 첫 칸에
       두면 셀러는 여전히 상품명에 커서가 간다(그것이 이번 결함이었다). */
    expect(code).toContain("anchor?.querySelector<HTMLElement>(INPUT_SELECTOR)");
  });
});
