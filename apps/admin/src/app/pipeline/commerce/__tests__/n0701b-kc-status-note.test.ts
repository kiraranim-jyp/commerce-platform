import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kcNeedsAction, kcStatusNote } from "../kc-status-note";
import { classifyMissing, missingKindLabel } from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-07-01 2차(CEO 확정, 2026-09-24) — **③ 등록 준비의 KC 한 줄**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * KC 상태는 지금까지 스마트스토어 «탭을 열어야만» 보였다. 그래서 ③ 에서
 * 「무엇을 확인해야 하는가」를 읽던 셀러는 KC 를 ④ 최종 확인 모달에서야 처음
 * 만났다. 이제 ③ 에서도 같은 상태를 말한다.
 *
 * 🔴 새 상태 모델을 만들지 않았다(CEO 확정 2번). `resolveKcStatus()` 의 4-state 를
 * 한 줄로 옮겨 적을 뿐이다.
 */

describe("① 네 상태를 셀러의 말로 옮긴다", () => {
  it("NOT_APPLICABLE → 해당 없음(행동 없음)", () => {
    const note = kcStatusNote("NOT_APPLICABLE");
    expect(note.text).toBe("KC 인증 · 해당 없음");
    expect(note.tone).toBe("OK");
    expect(note.actionLabel).toBeUndefined();
  });

  it("CERTIFIED_REFERENCE → 인증정보 확인됨(행동 없음)", () => {
    const note = kcStatusNote("CERTIFIED_REFERENCE");
    expect(note.text).toBe("KC 인증 · 인증정보 확인됨");
    expect(note.tone).toBe("OK");
    expect(note.actionLabel).toBeUndefined();
  });

  it("🔴 SELLER_REVIEW_REQUIRED → «판매자 확인» 필요 — 「입력 필요」가 아니다", () => {
    /* 값을 채우는 것만이 답이 아니다. 「이 상품은 대상이 아니다」라는 판단도
       답이고, 그 판단은 TTAEJYO 가 대신할 수 없다(AI 판단 ≠ 법적 확정). */
    const note = kcStatusNote("SELLER_REVIEW_REQUIRED");
    expect(note.text).toContain("판매자 확인 필요");
    expect(note.text).not.toContain("입력");
    expect(note.actionLabel).toBe("확인하기");
  });

  it("BLOCKED → 카테고리를 먼저 확정해야 물어볼 수 있다", () => {
    const note = kcStatusNote("BLOCKED");
    expect(note.text).toContain("카테고리 확정 후");
    expect(note.tone).toBe("ATTENTION");
  });

  it("🔴 null 은 «해당 없음» 이 아니라 «확인 전» 이다", () => {
    /* 탭을 안 열어 판정이 없는 상태다. 그것을 「대상 아님」으로 적으면
       확인하지 않은 것을 확인했다고 말하는 것이 된다. */
    const note = kcStatusNote(null);
    expect(note.text).toBe("KC 인증 · 확인 전");
    expect(note.text).not.toContain("해당 없음");
    expect(note.tone).toBe("UNKNOWN");
    expect(kcStatusNote(undefined)).toEqual(note);
  });

  it("행동이 필요한 상태만 ⚠ 로 센다", () => {
    expect(kcNeedsAction("SELLER_REVIEW_REQUIRED")).toBe(true);
    expect(kcNeedsAction("BLOCKED")).toBe(true);
    expect(kcNeedsAction("NOT_APPLICABLE")).toBe(false);
    expect(kcNeedsAction("CERTIFIED_REFERENCE")).toBe(false);
    // 확인 전은 ⚠ 가 아니다 — 아직 아무것도 판정되지 않았다.
    expect(kcNeedsAction(null)).toBe(false);
  });
});

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const DIR = join(__dirname, "..");
const SELECTOR = codeOnly(readFileSync(join(DIR, "CommerceSelector.tsx"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));
const PREVIEW = codeOnly(readFileSync(join(DIR, "PlatformPreview.tsx"), "utf8"));

describe("② ③ 화면과 ④ 모달이 «같은 값» 을 본다", () => {
  it("두 곳 모두 smartStoreValidation.kcStatus 를 쓴다", () => {
    expect(WORKSPACE).toContain("smartstoreKcStatus={smartStoreValidation?.kcStatus ?? null}");
    expect(WORKSPACE).toContain("smartStoreValidation?.kcStatus ?? null) : undefined");
  });

  it("🔴 KC 줄은 스마트스토어에만 — 쿠팡·롯데ON 에는 이 4-state 가 없다", () => {
    expect(SELECTOR).toContain('checked && channel.id === "smartstore" &&');
  });

  it("[확인하기]는 기존 이동 경로를 그대로 쓴다 — 새 navigation 을 만들지 않았다", () => {
    expect(SELECTOR).toContain('sectionId: "section-kc"');
    expect(SELECTOR).toContain("onFixRequest({");
  });
});

describe("③ 🔴 새 KC 상태 모델을 만들지 않았다", () => {
  it("라디오로 「대상 여부」를 다시 묻지 않는다", () => {
    /* 대상 여부는 카테고리가 정하고(NOT_APPLICABLE), 셀러가 뒤집는 경로는
       seller_compliance_confirmations 다. 라디오를 만들면 두 벌이 된다. */
    for (const forbidden of ["NewKcStatus", "ConditionalKcStatus", "KcRequirementStatus"]) {
      expect(SELECTOR).not.toContain(forbidden);
      expect(WORKSPACE).not.toContain(forbidden);
      expect(PREVIEW).not.toContain(forbidden);
    }
  });

  it("인증 «유형» 칸은 유형만 받는다 — 여부를 텍스트로 묻지 않는다", () => {
    expect(PREVIEW).toContain('label="인증 유형"');
    expect(PREVIEW).not.toContain('label="인증 대상 여부/유형"');
  });

  it("payload 에 실리는 값은 그대로다 — certificationType 그대로", () => {
    expect(PREVIEW).toContain('fix?.("certificationType", v)');
  });
});

describe("④ 「확인 필요」와 「입력 필요」를 가른다", () => {
  it("🔴 근거가 없으면 아무 말도 하지 않는다 — 가격/카테고리처럼 sourceItems 가 빈 항목", () => {
    expect(classifyMissing([])).toBeUndefined();
    expect(missingKindLabel(undefined)).toBeNull();
  });

  it("🔴 하나라도 근거를 모르면 통째로 «모른다» — 반만 아는 것을 다 안다고 적지 않는다", () => {
    expect(classifyMissing(["MANUAL_REQUIRED", undefined])).toBeUndefined();
    expect(classifyMissing([undefined])).toBeUndefined();
  });

  it("전부 MANUAL_REQUIRED 면 셀러가 직접 적어야 한다", () => {
    expect(classifyMissing(["MANUAL_REQUIRED"])).toBe("INPUT");
    expect(classifyMissing(["MANUAL_REQUIRED", "MANUAL_REQUIRED"])).toBe("INPUT");
    expect(missingKindLabel("INPUT")).toBe("입력 필요");
  });

  it("채울 근거가 하나라도 있으면 «확인» 이다 — 보기만 하면 된다", () => {
    expect(classifyMissing(["AUTO"])).toBe("CONFIRM");
    expect(classifyMissing(["SETTINGS_DEFAULT"])).toBe("CONFIRM");
    expect(classifyMissing(["DEFAULT_VALUE"])).toBe("CONFIRM");
    expect(classifyMissing(["MANUAL_REQUIRED", "AUTO"])).toBe("CONFIRM");
    expect(missingKindLabel("CONFIRM")).toBe("확인 필요");
  });

  it("🔴 새 축을 만들지 않았다 — ReadinessItem.sourceStatus 를 그대로 읽는다", () => {
    expect(WORKSPACE).toContain("kind: classifyMissing(item.sourceItems.map((s) => s.sourceStatus))");
    const readiness = readFileSync(join(DIR, "readiness.ts"), "utf8");
    expect(readiness).toContain('sourceStatus?: "AUTO" | "SETTINGS_DEFAULT" | "MANUAL_REQUIRED" | "DEFAULT_VALUE";');
  });
});
