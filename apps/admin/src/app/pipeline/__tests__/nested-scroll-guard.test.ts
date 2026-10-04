import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-1 E — Pipeline 중첩 세로 스크롤 가드 (CPO 지시, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 목표: 「상품정보 화면에서 마우스 휠을 내렸을 때 중간 패널만 따로 움직이거나,
 * 화면 안에 또 다른 세로 스크롤바가 생기지 않는 것」.
 *
 * 🔴 **주석을 벗기고 센다.** 이 저장소는 스크롤을 «제거한» 이력을 주석에 길게
 * 적어 두었다(Commerce-6 F-8 D · N-05 QA FIX). 벗기지 않고 grep 하면 이미 고친
 * 자리가 «살아 있는 코드» 처럼 잡힌다 — 실제로 내 1차 조사에서 네 건 중 셋이
 * 그 주석이었다. 가드가 뭔가를 잡으면 주석부터 의심한다.
 *
 * 🔴 **AppShell 은 이 가드의 대상이 아니다.** 거기의 `h-dvh overflow-hidden` +
 * `main overflow-y-auto` 는 CEO 실측으로 만든 «단일 스크롤» 구조다(N-05 QA FIX ②:
 * 문서와 main 이 둘 다 자라서 스크롤바가 두 개였던 것을 닫은 것). 문서 스크롤로
 * 되돌리면 그 버그가 되살아난다 — 되돌리지 않는다.
 */
const PIPELINE = join(__dirname, "..");

/** 블록 주석 · 줄 주석 · JSX 주석을 모두 제거한다(연속 줄 포함). */
function codeOnly(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...tsxFiles(full));
      continue;
    }
    if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const SCROLL_RE = /overflow-y-(?:auto|scroll)|overflow-auto/;

/**
 * 예외 — UI 자체가 독립적으로 떠야 하는 영역, 그리고 진단용 원문 덤프.
 *
 * 🔴 「예외」를 넓히지 않는다. 각 줄에 «왜» 를 적는다. 셀러의 상품정보 흐름에서
 * 중간 패널이 따로 움직이는 것은 예외가 아니다.
 */
const ALLOWED: { file: string; why: string }[] = [
  { file: "PreviewModal.tsx", why: "모달 — CPO 가 명시한 예외(독립적으로 떠야 한다)" },
  { file: "ProgressPanel.tsx", why: "개발 로그 — 기본 접힘, 셀러가 「개발 로그」를 직접 펼쳤을 때만 뜬다" },
  /* 아래 넷은 payload 원문(JSON) 진단 패널이다. 셀러의 상품정보 입력 흐름이
     아니라 CTO/CPO 가 보낼 값을 확인하는 자리이고, 높이를 풀면 수천 줄 JSON 이
     페이지에 그대로 쏟아진다. 🔴 셀러 흐름으로 올릴 때는 이 예외를 지우고
     「더 보기 / 접기」로 바꾼다(N-05 QA FIX 가 목록에 쓴 그 패턴). */
  { file: "PayloadInspector.tsx", why: "payload 원문 진단" },
  { file: "CoupangPayloadInspector.tsx", why: "payload 원문 진단" },
  { file: "NaverPayloadPreview.tsx", why: "payload 원문 진단" },
  { file: "ListingSection.tsx", why: "payload 원문 진단" },
  { file: "LotteOnRegistrationPanel.tsx", why: "payload 원문 진단" },
];

describe("🔴 Pipeline 에 새 중첩 세로 스크롤을 만들지 않는다", () => {
  const offenders: { file: string; line: number; text: string }[] = [];
  for (const path of tsxFiles(PIPELINE)) {
    const name = path.split(/[\\/]/).pop()!;
    if (ALLOWED.some((a) => a.file === name)) continue;
    const lines = codeOnly(readFileSync(path, "utf8")).split(String.fromCharCode(10));
    lines.forEach((line, i) => {
      if (SCROLL_RE.test(line)) offenders.push({ file: name, line: i + 1, text: line.trim().slice(0, 100) });
    });
  }

  it("예외 목록 밖에는 세로 스크롤 컨테이너가 없다", () => {
    expect(offenders, JSON.stringify(offenders, null, 1)).toEqual([]);
  });

  it("🔴 가드가 공허하지 않다 — 스캔한 파일이 충분히 많다", () => {
    expect(tsxFiles(PIPELINE).length).toBeGreaterThan(20);
  });

  it("🔴 예외는 전부 이유가 적혀 있다", () => {
    for (const a of ALLOWED) expect(a.why.length, a.file).toBeGreaterThan(10);
  });
});

describe("🔴 AppShell 의 단일 스크롤 구조를 되돌리지 않았다", () => {
  const SHELL = readFileSync(join(__dirname, "../../../components/layout/AppShell.tsx"), "utf8");

  it("shell 은 뷰포트에 고정되고 문서가 자라지 않는다", () => {
    const code = codeOnly(SHELL);
    expect(code).toContain("h-dvh");
    expect(code).toContain("overflow-hidden");
  });

  it("스크롤 컨테이너는 main «하나» 다", () => {
    const code = codeOnly(SHELL);
    expect(code).toContain('<main className="min-h-0 flex-1 overflow-y-auto">');
    /* 🔴 사이드바는 짧은 화면에서 메뉴가 잘리지 않도록 자기 스크롤을 갖는다 —
       셀러 콘텐츠 영역이 아니므로 「중간 패널이 따로 움직인다」와 다른 사안이다. */
    expect((code.match(/overflow-y-auto/g) ?? []).length).toBe(2);
  });
});
