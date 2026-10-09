import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { mockProductContentProvider } from "@commerce/content";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ④ 상세설명 자동 작성 (CPO 확정, 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 재는 것은 「문장이 만들어지는가」가 아니라 **「다른 칸을 건드리지 않는가」** 다.
 * `generateContent` 는 다섯 칸을 덮는데, 이 버튼은 「상세설명」이라는 이름을 달고
 * 있으므로 `descriptionKo` «하나만» 바꿔야 한다 — 이름과 동작이 다르면 화면이
 * 거짓말하는 것이다.
 *
 * 🔴 소스 검사는 주석을 벗기고 한다 — 주석에 "AI" 와 필드 이름들이 설명으로
 * 여러 번 나온다([[source-scan-must-strip-comments]]).
 */
const DIR = __dirname;
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

const WORKSPACE_RAW = readFileSync(join(DIR, "../../CommerceWorkspace.tsx"), "utf8");
const WORKSPACE = codeOnly(WORKSPACE_RAW);

/** `generateDescriptionOnly` 본문만 떼어 본다. */
const WRAPPER = (() => {
  const i = WORKSPACE.indexOf("function generateDescriptionOnly()");
  return WORKSPACE.slice(i, WORKSPACE.indexOf("\n  }", i));
})();

function field<T>(value: T, source: FieldSource): ProvenanceField<T> {
  return { value, source, confidence: 0.5 };
}

/**
 * ══ 🔴 P5.6 재작업(CEO 실측, 2026-10-09) — **버튼이 한 칸 더 들어갔다.** ══
 *
 * CEO: 「상세설명이 source data · 필수정보 두 곳에 존재한다. Source Data 쪽이
 * 맞고 필수정보 쪽은 제거. 자동 작성 기능도 Source Data 로 이동」.
 *
 * 그래서 이 버튼은 CommerceWorkspace 의 «필수정보 작업면» 에서
 * SourceDataView 의 「상세설명」 Row «안» 으로 옮겨졌다. 이 블록이 재던 것
 * 셋(라벨 · 같은 함수 · 상품정보 탭 안)은 «의도가 그대로» 다 — 읽는 파일만
 * 바뀐다. 느슨해지지 않게 양쪽을 다 센다: 배선은 workspace 에, 버튼은
 * SourceDataView 에 있어야 한다.
 */
describe("① 버튼 — 상품정보(Source Data)에 있고 문구가 정확하다", () => {
  const SOURCE_VIEW = readFileSync(join(__dirname, "../SourceDataView.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("라벨이 정확히 「상세설명 자동 작성」이다", () => {
    expect(SOURCE_VIEW).toContain("상세설명 자동 작성");
  });

  it("onClick 이 descriptionKo 전용 함수를 «그대로» 부른다 — 새 함수를 만들지 않았다", () => {
    expect(SOURCE_VIEW).toContain("onClick={onGenerateDescription}");
    expect(WORKSPACE).toContain("onGenerateDescription={generateDescriptionOnly}");
  });

  it("상품정보(source) 탭 안에 있다 — 그 배선이 source 탭 분기 뒤에 있다", () => {
    const sourceTabStart = WORKSPACE.indexOf('tab === "source" &&');
    expect(sourceTabStart).toBeGreaterThan(-1);
    expect(WORKSPACE.indexOf("onGenerateDescription={generateDescriptionOnly}")).toBeGreaterThan(sourceTabStart);
  });

  it("🔴 필수정보 영역에 같은 버튼이 «남아 있지 않다» — 두 곳이 되지 않게", () => {
    expect(WORKSPACE).not.toContain("상세설명 자동 작성");
  });

  it("🔴 새 탭을 만들지 않았다 — 탭은 source · content + 채널뿐이다", () => {
    expect(WORKSPACE).toContain('type CommerceTab = "source" | "content" | CommerceId');
  });
});

describe("② 🔴 descriptionKo «하나만» 바꾼다", () => {
  it("래퍼가 descriptionKo 를 쓴다", () => {
    expect(WRAPPER).toContain("descriptionKo:");
  });

  for (const other of ["titleKo", "keywords", "seoTitle", "seoDescription"]) {
    it(`🔴 ${other} 를 쓰지 않는다`, () => {
      expect(WRAPPER, `${other} 가 함께 덮인다 — 버튼 이름이 「상세설명」인데 다른 칸을 바꾼다`).not.toContain(
        `${other}:`,
      );
    });
  }

  it("🔴 generateContent 를 부르지 않는다 — 그것은 다섯 칸을 덮는다", () => {
    expect(WRAPPER).not.toContain("generateContent");
  });
});

describe("③ 기존 것을 그대로 쓴다", () => {
  it("같은 provider 의 같은 메서드를 부른다 — 새 생성기를 만들지 않았다", () => {
    expect(WRAPPER).toContain("mockProductContentProvider.generateDescription(prev)");
  });

  it("🔴 ProductContentProvider 구현체가 여전히 mock «하나» 다 — LLM 을 들이지 않았다", () => {
    const providersDir = join(DIR, "../../../../../../../packages/content/src/providers");
    const entries = readFileSync(join(providersDir, "mock.provider.ts"), "utf8");
    expect(entries).toContain("export const mockProductContentProvider");
    /* 새 provider 를 추가했다면 이 파일 외에도 구현체가 생긴다. */
    expect(WORKSPACE).not.toMatch(/import \{[^}]*ContentProvider[^}]*\} from "@commerce\/ai"/);
  });

  it("🔴 fetch·LLM 호출이 래퍼에 없다", () => {
    for (const f of ["fetch(", "await ", "openai", "gemini", "anthropic"]) {
      expect(WRAPPER.toLowerCase(), f).not.toContain(f);
    }
  });

  it("generateContent 와 content 탭은 «불변» 이다", () => {
    expect(WORKSPACE).toContain("function generateContent()");
    expect(WORKSPACE).toContain("titleKo: mockProductContentProvider.generateTitle(prev)");
    /* content 탭은 여전히 disabled + 준비중이다. */
    expect(WORKSPACE).toContain('<TabButton active={tab === "content"} disabled');
  });
});

describe("④ 🔴 셀러가 쓴 문장을 덮지 않는다", () => {
  it("source === USER_EDITED 이고 값이 있으면 그대로 돌려준다", () => {
    expect(WRAPPER).toContain('prev.descriptionKo.source === "USER_EDITED"');
    expect(WRAPPER).toContain("return prev;");
  });

  it("🔴 빈 값이면 USER_EDITED 라도 작성한다 — 빈 칸을 지키는 것이 목적이 아니다", () => {
    expect(WRAPPER).toContain('prev.descriptionKo.value.trim() !== ""');
  });
});

describe("⑤ provider 가 쓰는 데이터와 빈 입력 처리", () => {
  const base = {
    brand: field("Sergio Tacchini", "ORIGINAL"),
    material: field("80% cotton", "ORIGINAL"),
    options: field<string[]>(["S", "M"], "ORIGINAL"),
    description: field("Hoodie sweater.", "ORIGINAL"),
    title: field("HASHTAG HOODIE", "ORIGINAL"),
    optionGroups: [],
    variants: [],
  } as unknown as CanonicalProduct;

  it("실제로 존재하는 데이터만 조립한다", () => {
    const out = mockProductContentProvider.generateDescription(base);
    expect(out.value).toContain("Sergio Tacchini");
    expect(out.value).toContain("80% cotton");
    expect(out.value).toContain("S, M");
  });

  it("🔴 재료가 하나도 없으면 «빈 문자열» 이다 — 지어내지 않는다", () => {
    const empty = {
      brand: field("", "ORIGINAL"),
      material: field("", "ORIGINAL"),
      options: field<string[]>([], "ORIGINAL"),
      description: field("", "ORIGINAL"),
      title: field("", "ORIGINAL"),
      optionGroups: [],
      variants: [],
    } as unknown as CanonicalProduct;
    const out = mockProductContentProvider.generateDescription(empty);
    expect(out.value).toBe("");
    expect(out.confidence).toBe(0);
  });
});

describe("⑥ 🔴 버튼·상품정보 영역에 「AI」 문구가 없다", () => {
  it("버튼 주변 섹션에 AI 가 한 글자도 없다", () => {
    const i = WORKSPACE.indexOf("상세설명 자동 작성");
    const section = WORKSPACE.slice(Math.max(0, i - 900), i + 300);
    expect(section).not.toContain("AI");
  });

  it("🔴 AI_GENERATED·「AI 추천」 배지는 «그대로» 둔다 — 이번 범위 밖", () => {
    const badge = codeOnly(readFileSync(join(DIR, "../provenance.tsx"), "utf8"));
    expect(badge).toContain('AI_GENERATED: "AI 추천"');
  });

  it("FieldSource 를 확장하지 않았다", () => {
    const types = readFileSync(join(DIR, "../../../../../../../packages/shared/src/product-types.ts"), "utf8");
    expect(types).toContain(
      'export type FieldSource = "ORIGINAL" | "AI_GENERATED" | "USER_EDITED" | "DEFAULT" | "REQUIRED" | "DETAIL_PAGE_REFERENCE";',
    );
  });
});
