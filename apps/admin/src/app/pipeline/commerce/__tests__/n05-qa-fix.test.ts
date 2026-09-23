import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-05 QA FIX(CPO 확정, 2026-09-23) — **CEO 화면에서 확인된 두 가지**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── Blocker 1 — 선택기가 ④ 에 있었다 ──────────────────────────────────────
 * 「등록할 커머스」를 ④ 커머스 등록 단계에 뒀다. 그런데 ④ 는 ③ 등록 준비가
 * **전부 끝나야** 열린다 — 셀러는 준비하는 내내 「어디에 팔지」를 고를 수
 * 없었고, 다 끝낸 뒤에야 처음 묻는 순서가 됐다. 순서가 뒤집혀 있었다.
 *
 *   ③ 등록 준비   어디에 등록할 것인가(선택 + 준비 상태)
 *   ④ 커머스 등록  고른 곳에 «실제로» 등록한다
 *
 * 🔴 ④ 에 체크박스를 «복제하지 않는다». 같은 체크박스가 두 번 서면 셀러는
 * 「여기서 다시 골라야 하나」로 읽는다.
 *
 * ── Blocker 2 — 일반 화면에 두 번째 세로 스크롤이 있었다 ──────────────────
 * 일반 상품/커머스 UI 는 페이지 스크롤 하나만 쓴다. 긴 목록은 이 저장소가 이미
 * 쓰는 「더 보기 / 접기」로 접는다. JSON payload · 로그 viewer 는 예외다.
 */

const DIR = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(DIR, relative), "utf8");

/** 주석을 걷어낸 «실행되는 코드» 만. 이 수정의 주석에는 옛 클래스 이름이 남아 있다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const STAGE_BODY = codeOnly(read("StageBody.tsx"));
const WORKSPACE = codeOnly(read("../CommerceWorkspace.tsx"));

describe("① 선택기는 ③ 등록 준비에 선다", () => {
  it("🔴 PrepareStage 가 선택기를 받는다", () => {
    const prepare = STAGE_BODY.slice(
      STAGE_BODY.indexOf("function PrepareStage("),
      STAGE_BODY.indexOf("function PrepareWorkSurface("),
    );
    expect(prepare).toContain("commerceSelector");
    expect(prepare).toContain("{commerceSelector && <div");
  });

  it("🔴 RegisterStage 는 선택기를 «받지 않는다» — 중복 표시 금지(CPO 지시 D)", () => {
    const register = STAGE_BODY.slice(STAGE_BODY.indexOf("function RegisterStage("));
    expect(register).not.toContain("commerceSelector");
  });

  it("④ 는 «실행 줄» 만 받는다 — 어디에 팔지는 ③ 에서 이미 정했다", () => {
    const register = STAGE_BODY.slice(STAGE_BODY.indexOf("function RegisterStage("));
    expect(register).toContain("commerceRunner");
  });

  it("화면이 선택기를 PREPARE 에, 실행 줄을 REGISTER 에 넘긴다", () => {
    expect(STAGE_BODY).toMatch(/focus\.main === "PREPARE" &&[\s\S]{0,600}commerceSelector=\{commerceSelector\}/);
    expect(STAGE_BODY).toMatch(/focus\.main === "REGISTER" &&[\s\S]{0,400}commerceRunner=\{commerceRunner\}/);
  });

  it("🔴 ③ 의 선택기에는 등록 버튼이 없다 — 고르는 것과 등록하는 것은 다른 단계다", () => {
    const selectorProps = WORKSPACE.slice(
      WORKSPACE.indexOf("commerceSelector={"),
      WORKSPACE.indexOf("commerceRunner={"),
    );
    expect(selectorProps).toContain("<CommerceSelector");
    expect(selectorProps).not.toContain("onRegisterSelected");
  });

  it("실행은 ④ 의 줄에서만 시작된다", () => {
    const runner = WORKSPACE.slice(WORKSPACE.indexOf("commerceRunner={"));
    expect(runner).toContain("setMultiConfirmOpen(true)");
  });
});

describe("② 선택 독립성 — 한 커머스 때문에 다른 커머스를 못 고르지 않는다", () => {
  it("선택기가 준비 상태로 체크박스를 잠그지 않는다", () => {
    const selector = codeOnly(read("CommerceSelector.tsx"));
    // 잠그는 유일한 조건은 «실행 중» 뿐이다(state/blockingCount 가 아니다).
    expect(selector).toContain("disabled={busy}");
    expect(selector).not.toContain("disabled={channel.state");
    expect(selector).not.toContain("blockingCount > 0}");
  });
});

/* ══ Blocker 2 — 일반 화면에는 세로 스크롤이 «하나» ═══════════════════════ */

/** 일반 상품/커머스 UI — 내부 세로 스크롤을 만들면 안 되는 파일. */
const PLAIN_UI = ["CategoryTreeBrowser.tsx", "LotteOnRegistrationPanel.tsx", "CommerceSelector.tsx", "StageBody.tsx"];

/** viewer — 내부 스크롤이 허용되는 곳(JSON payload · 로그). */
const VIEWERS: [string, string][] = [
  ["CoupangPayloadInspector.tsx", "max-h-64 overflow-auto"],
  ["PayloadInspector.tsx", "max-h-64 overflow-auto"],
  ["NaverPayloadPreview.tsx", "max-h-96 overflow-auto"],
  ["ListingSection.tsx", "max-h-48 overflow-auto"],
];

describe("③ 일반 UI 에 내부 세로 스크롤이 없다", () => {
  it.each(PLAIN_UI)("%s", (file) => {
    const code = codeOnly(read(file));
    const offenders = code.match(/overflow-y-auto|max-h-\d+/g) ?? [];
    expect(offenders, `내부 스크롤이 남아 있다: ${offenders.join(", ")}`).toEqual([]);
  });

  it("🔴 대신 「더 보기 / 접기」로 접는다 — 길이를 숨기지 않고 숫자로 말한다", () => {
    const tree = read("CategoryTreeBrowser.tsx");
    expect(tree).toContain("더 보기 (");
    expect(tree).toContain("접기");
    const lotteon = read("LotteOnRegistrationPanel.tsx");
    expect(lotteon).toContain("더 보기 (");
  });

  it("새 목록/아코디언 컴포넌트를 만들지 않았다 — 기존 패턴 재사용", () => {
    // 이 수정으로 추가된 컴포넌트 파일이 없다(상태 두 개와 버튼 한 줄이 전부다).
    const tree = codeOnly(read("CategoryTreeBrowser.tsx"));
    expect(tree).toContain("useState");
    expect(tree).not.toContain("export function CategoryList");
  });
});

describe("④ viewer 의 내부 스크롤은 그대로 둔다(예외)", () => {
  it.each(VIEWERS)("%s 는 %s 를 유지한다", (file, className) => {
    expect(read(file)).toContain(className);
  });

  it("수집 로그 viewer 도 그대로다", () => {
    expect(readFileSync(join(DIR, "../ProgressPanel.tsx"), "utf8")).toContain("h-48 overflow-y-auto");
  });
});
