import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2B — **내부 API 필드명은 셀러 UI 어디에도 서지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-7 이 「입력」을 없앴고, C-2A 가 판정표의 `→ owhpNo` 를 없앴다. 그런데 하나가
 * 더 남아 있었다 — 입력칸 라벨 뒤의 ⓘ 가 `title` 과 `sr-only` 로 「롯데ON API
 * 필드명 owhpNo」를 들고 있었다. 눈에 덜 띄었을 뿐 셀러에게 가는 자리였고,
 * 스크린리더는 그것을 그대로 읽는다.
 *
 * 🔴 CPO 결정: REWORK-14 의 기존 의도보다 현재 제품 원칙이 우선한다.
 *    visible text · title · aria-label · sr-only · InfoTip · placeholder ·
 *    help text 에 같은 원칙을 적용한다.
 *
 * 🔴 코드 «자체» 는 버리지 않았다. 검증기 · lotteOnField · 로그 · 테스트에는
 *    그대로 있다 — 없앤 것은 셀러 UI 로 나가는 통로다. 그래서 이 테스트는
 *    「소스에 문자열이 있는가」가 아니라 「화면 요소로 나가는가」를 본다.
 */

const DIR = __dirname;
const PANEL = readFileSync(join(DIR, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
const FIELDS = readFileSync(join(DIR, "..", "registration-fields.tsx"), "utf8");

const INTERNAL_FIELD_NAMES = [
  "owhpNo",
  "rtrpNo",
  "hdcCd",
  "rtngHdcCd",
  "dvCstPolNo",
  "dvRgsprGrpCd",
] as const;

/** 주석(`/* … *\/` 과 `//`)은 개발자 코드다 — CPO 가 명시적으로 허용했다. */
function sellerFacing(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("① 노출 통로가 없어졌다", () => {
  it("apiCodeTip 이 존재하지 않는다", () => {
    expect(FIELDS).not.toContain("function apiCodeTip");
    /* 🔴 주석을 걷고 본다 — 이 변경을 «설명하는» 주석에도 같은 문구가 나온다
       (그대로 검사했다가 내가 쓴 설명문을 잡아 헛되이 실패했다). */
    expect(sellerFacing(FIELDS)).not.toContain("롯데ON API 필드명");
  });

  it("필드 컴포넌트가 code prop 을 받지 않는다", () => {
    expect(FIELDS).not.toMatch(/^\s*code\?: string;/m);
    expect(FIELDS).not.toContain("labelSuffix={apiCodeTip(code)}");
  });

  it("롯데ON 탭이 code= 를 한 곳도 넘기지 않는다", () => {
    expect(PANEL).not.toMatch(/^\s*code="/m);
  });
});

describe("② 🔴 내부 필드명이 «셀러가 읽는 자리» 에 없다", () => {
  it.each(INTERNAL_FIELD_NAMES)("%s 가 JSX 속성/문자열로 나가지 않는다", (name) => {
    const code = sellerFacing(PANEL);
    /* 남아도 되는 단 하나 — requirementOf("owhpNo") 같은 «조회 키» 다.
       화면에 그려지는 것이 아니라 검증 결과를 찾는 데 쓴다. */
    const occurrences = code.split(name).length - 1;
    const lookups = (code.match(new RegExp(`requirementOf\\("${name}"\\)`, "g")) ?? []).length;
    expect(occurrences, `${name}: 조회 키 외의 사용이 남아 있다`).toBe(lookups);
  });

  it.each(["title=", "aria-label=", "sr-only", "placeholder="])(
    "%s 에 내부 필드명이 섞이지 않는다",
    (attr) => {
      for (const line of sellerFacing(PANEL).split("\n")) {
        if (!line.includes(attr)) continue;
        for (const name of INTERNAL_FIELD_NAMES) {
          expect(line, `${attr} — ${name}`).not.toContain(name);
        }
      }
    },
  );
});

describe("③ 접근성 설명을 «없앤» 것이 아니다", () => {
  /* CPO: 「접근성용 설명 자체는 유지 가능 · 사용자에게 의미 있는 설명으로 변경」.
     각 칸에는 이미 사람이 읽는 도움말(note)이 있고 그쪽이 의미를 갖는다. */
  it("공용 InfoTip 자체는 남아 있다 — 다른 쓰임이 있다", () => {
    expect(FIELDS).toContain("export function InfoTip");
  });

  it("배송 칸들이 여전히 사람이 읽는 안내를 갖는다", () => {
    expect(PANEL).toContain("롯데ON이 정한 택배사 중에서 고릅니다.");
    expect(PANEL).toContain("반품을 회수할 택배사입니다.");
  });
});
