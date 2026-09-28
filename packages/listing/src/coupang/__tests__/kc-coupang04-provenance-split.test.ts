import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoupangCompliance,
  buildComplianceReport,
  DEFAULT_KC_EXEMPTION_TEXT,
  type CoupangCategoryMeta,
} from "../../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-04 — **라벨은 바뀌지만 «행동» 은 바뀌지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이번 수정의 위험은 「고치는 것」이 아니라 「따라 움직이는 것」이다.
 *
 *     DEFAULT_VALUE 하나를 둘로 가른다
 *       → 어딘가에서 `=== "DEFAULT_VALUE"` 로 «세던» 곳이 한쪽을 놓친다
 *       → 지금 확인을 요구하던 13건이 조용히 요구하지 않게 된다
 *       → 🔴 판매자가 문장을 못 본 채 등록된다. 고치기 전보다 나쁘다.
 *
 * 그래서 이 파일의 절반은 **「사라지지 않았는가」** 를 잰다.
 */

const CONTEXT = { productName: "Baby Swim Cap", contactNumber: "010-0000-0000" };

const META: CoupangCategoryMeta = {
  attributes: [],
  noticeCategories: [
    {
      noticeCategoryName: "기타 재화",
      noticeCategoryDetailNames: [
        { noticeCategoryDetailName: "인증/허가 사항", required: "MANDATORY" },
        { noticeCategoryDetailName: "기타 추가 정보", required: "MANDATORY" },
      ],
    },
  ],
};

const build = (ctx: Record<string, unknown> = {}) =>
  buildCoupangCompliance(META, { ...CONTEXT, ...ctx }, { optionGroups: [] });

const kcResult = (ctx: Record<string, unknown> = {}) =>
  build(ctx).noticeResults.find((r) => r.fieldName === "인증/허가 사항")!;

const SETTINGS_TEXT = "KC인증 어린이제품 공급자적합성확인";

describe("① 세 출처가 «각각» 제 이름을 받는다", () => {
  it("Settings 문구 → SETTINGS_DEFAULT", () => {
    expect(kcResult({ kcExemptionText: SETTINGS_TEXT }).source).toBe("SETTINGS_DEFAULT");
  });

  it("코드 기본 문구 → DEFAULT_VALUE", () => {
    expect(kcResult().source).toBe("DEFAULT_VALUE");
  });

  it("상품별 직접 입력 → USER_INPUT (그대로 유지)", () => {
    const r = kcResult({ userOverrides: { "인증/허가 사항": "KC 안전확인 제12-345호" } });
    expect(r.source).toBe("USER_INPUT");
  });

  it("🔴 Settings 가 비면 코드 기본값으로 떨어진다 — 사다리는 그대로다", () => {
    for (const empty of [undefined, ""]) {
      expect(kcResult({ kcExemptionText: empty }).source).toBe("DEFAULT_VALUE");
    }
  });
});

describe("🔴 ② payload 값은 «한 글자도» 바뀌지 않았다", () => {
  it("Settings 문구가 그대로 실린다", () => {
    expect(kcResult({ kcExemptionText: SETTINGS_TEXT }).value).toBe(SETTINGS_TEXT);
  });

  it("설정이 없으면 코드 기본값이 그대로 실린다", () => {
    expect(kcResult().value).toBe(DEFAULT_KC_EXEMPTION_TEXT);
  });

  it("🔴 공백 경로도 «그대로» 둔다 — 판정 없이 고치지 않는다(KC-COUPANG-02 §3)", () => {
    /* 쿠팡이 공백을 어떻게 다루는지 재 본 적이 없다. 이번 작업은 출처 이름만
       바꾸는 것이므로 이 동작을 건드리지 않는다. */
    const r = kcResult({ kcExemptionText: "   " });
    expect(r.value).toBe("   ");
    expect(r.source).toBe("SETTINGS_DEFAULT");
  });

  it("notices 배열의 content 가 출처와 무관하게 같다", () => {
    const a = build({ kcExemptionText: SETTINGS_TEXT }).notices;
    const b = build({ kcExemptionText: SETTINGS_TEXT }).notices;
    expect(a).toEqual(b);
    expect(build().notices.find((n) => n.noticeCategoryDetailName === "인증/허가 사항")?.content).toBe(
      DEFAULT_KC_EXEMPTION_TEXT,
    );
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ③ NEGATIVE — 확인 요구가 «사라지지 않았는가»
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ③ 확인 요구는 두 출처 모두에서 유지된다", () => {
  /** 모달의 실제 식을 그대로 옮긴 것(ListingConfirmationModal.tsx:139~143). */
  const needsReview = (source: string) => {
    const autoFilled = source === "DEFAULT_VALUE" || source === "SETTINGS_DEFAULT";
    return autoFilled;
  };

  it.each([
    ["Settings 문구", { kcExemptionText: SETTINGS_TEXT }],
    ["코드 기본값", {}],
  ])("%s 는 여전히 확인을 요구한다", (_label, ctx) => {
    expect(needsReview(kcResult(ctx).source)).toBe(true);
  });

  it("상품별 입력은 여전히 확인을 요구하지 않는다 — 기존 정책 그대로", () => {
    expect(needsReview(kcResult({ userOverrides: { "인증/허가 사항": "직접" } }).source)).toBe(false);
  });

  it("🔴 화면 코드가 «두 출처 모두» 를 autoFilled 로 본다", () => {
    const workspace = readFileSync(
      join(__dirname, "..", "..", "..", "..", "..", "apps", "admin", "src", "app", "pipeline", "CommerceWorkspace.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(workspace).toContain(
      'autoFilled: r.source === "DEFAULT_VALUE" || r.source === "SETTINGS_DEFAULT",',
    );
  });
});

describe("🔴 ④ 준비도 목록에서 항목이 사라지지 않았다", () => {
  const reportOf = (ctx: Record<string, unknown> = {}) => {
    const built = build(ctx);
    return buildComplianceReport(built.attributeResults, built.noticeResults);
  };

  it.each([
    ["Settings 문구", { kcExemptionText: SETTINGS_TEXT }],
    ["코드 기본값", {}],
  ])("%s — defaultsApplied 에 KC 칸이 남아 있다", (_label, ctx) => {
    const applied = reportOf(ctx).defaultsApplied;
    expect(applied.some((f) => f.fieldName === "인증/허가 사항")).toBe(true);
  });

  it("🔴 출처가 함께 실린다 — 화면이 문장을 가를 수 있어야 한다", () => {
    const fromSettings = reportOf({ kcExemptionText: SETTINGS_TEXT }).defaultsApplied.find(
      (f) => f.fieldName === "인증/허가 사항",
    );
    const fromCode = reportOf().defaultsApplied.find((f) => f.fieldName === "인증/허가 사항");
    expect(fromSettings?.source).toBe("SETTINGS_DEFAULT");
    expect(fromCode?.source).toBe("DEFAULT_VALUE");
  });

  it("🔴 점수가 바뀌지 않았다 — 두 출처의 Compliance Score 가 같다", () => {
    expect(reportOf({ kcExemptionText: SETTINGS_TEXT }).score).toBe(reportOf().score);
    expect(reportOf({ kcExemptionText: SETTINGS_TEXT }).verdict).toBe(reportOf().verdict);
  });
});

describe("🔴 ⑤ 화면 문구가 «누가 넣었는지» 를 틀리게 말하지 않는다", () => {
  const read = (...p: string[]) =>
    readFileSync(join(__dirname, "..", "..", "..", "..", "..", "apps", "admin", "src", "app", "pipeline", ...p), "utf8");
  const MODAL = read("commerce", "ListingConfirmationModal.tsx");
  const EDITOR = read("commerce", "CategoryRequirementsEditor.tsx");
  const READINESS = read("commerce", "readiness.ts");
  const codeOf = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("🔴 모달에서 「따져가 자동으로 입력한 기본값입니다」 단정이 사라졌다", () => {
    expect(codeOf(MODAL)).not.toContain("위 문구는 따져가 «자동으로» 입력한 기본값입니다");
  });

  it("모달이 출처별로 다른 문장을 낸다", () => {
    const code = codeOf(MODAL);
    expect(code).toContain('notice.source === "SETTINGS_DEFAULT"');
    expect(code).toContain("판매자 설정에 입력된 문구입니다");
    expect(code).toContain("따져가가 기본으로 입력한 문구입니다");
  });

  it("카테고리 편집기 라벨이 두 출처를 가른다", () => {
    const code = codeOf(EDITOR);
    expect(code).toContain('SETTINGS_DEFAULT: "판매자 설정에 입력한 문구"');
    expect(code).not.toContain('DEFAULT_VALUE: "업계 관용 기본값 자동 적용"');
  });

  it("준비도 힌트가 출처를 따른다", () => {
    const code = codeOf(READINESS);
    expect(code).toContain("판매자 설정값 적용:");
    expect(code).toContain("기본값 자동 적용:");
  });

  it("🔴 판정(classifyMissing)은 두 출처를 같게 다룬다 — 그래서 결과가 안 바뀐다", () => {
    const registry = read("commerce", "commerce-registry.ts");
    expect(codeOf(registry)).toContain(
      'return sourceStatuses.every((s) => s === "MANUAL_REQUIRED") ? "INPUT" : "CONFIRM";',
    );
  });
});

describe("🔴 ⑥ 다른 채널은 건드리지 않았다", () => {
  it("SETTINGS_DEFAULT 는 쿠팡 어휘다 — 네이버/롯데ON 빌더에 없다", () => {
    for (const rel of ["naver/build-payload.ts", "lotteon/build-payload.ts"]) {
      const src = readFileSync(join(__dirname, "..", "..", rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(src).not.toContain("SETTINGS_DEFAULT");
    }
  });

  it("Common KC 어휘(FieldValueSource)를 늘리지 않았다", () => {
    const shared = readFileSync(
      join(__dirname, "..", "..", "..", "..", "shared", "src", "field-requirement.ts"),
      "utf8",
    );
    expect(shared).not.toContain("SETTINGS_DEFAULT");
  });
});
