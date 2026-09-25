import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3 — **수정 화면이 «자기 진실» 을 만들지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 넷:
 *   ① 항목 목록·설명·capability 를 화면에 하드코딩하지 않는다.
 *   ② 초안을 화면이 소유하지 않는다 — payload 를 만드는 값과 두 벌이 되면 안 된다.
 *   ③ 변경 1개 이상일 때만 버튼이 열린다(숨기지 «않고» 꺼 둔다).
 *   ④ 대조하지 못한 항목을 「바뀝니다」로 단정하지 않는다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const PANEL = codeOnly(readFileSync(join(__dirname, "../ChannelEditPanel.tsx"), "utf8"));

describe("① 🔴 화면이 목록을 따로 만들지 않는다", () => {
  it("항목은 editorFieldSchema 가 준 것을 그대로 그린다", () => {
    expect(PANEL).toContain("editorFieldSchema(model)");
    expect(PANEL).toContain("fields.map(");
  });

  it("🔴 필드 이름을 화면에 하드코딩하지 않는다 — 한 곳만 예외(입력칸 종류)", () => {
    /* 라벨·순서·설명은 schema 가 정한다. 화면이 아는 것은 「이 항목은 이
       패널에서 직접 입력받는다」뿐이고, 그것은 표로 한 곳에 모아 둔다. */
    expect(PANEL).toContain("const INLINE_INPUT");
    for (const label of ["상품명\"", "판매가격\"", "카테고리\""]) {
      expect(PANEL, `라벨을 화면이 다시 적었다: ${label}`).not.toContain(label);
    }
  });

  it("한 줄 설명도 schema 가 준 것을 쓴다", () => {
    expect(PANEL).toContain("{field.note}");
    expect(PANEL).not.toContain("fieldCapabilityNote");
  });

  it("🔴 capability 를 화면이 다시 판단하지 않는다", () => {
    expect(PANEL).not.toContain("fieldCapability(");
    expect(PANEL).not.toContain("CHANNEL_CAPABILITY");
    /* 입력칸은 schema 의 editable 만 본다. */
    expect(PANEL).toContain("field.editable ? INLINE_INPUT[field.field] : undefined");
  });
});

describe("② 🔴 초안을 화면이 소유하지 않는다", () => {
  it("draft 와 touched 는 props 로 들어온다", () => {
    expect(PANEL).toContain("draft: Partial<Record<EditableField, unknown>>");
    expect(PANEL).toContain("touched?: readonly EditableField[]");
  });

  it("🔴 자체 상태를 두지 않는다 — 두 벌이 되면 고친 것이 나가지 않는다", () => {
    expect(PANEL).not.toContain("useState");
    expect(PANEL).not.toContain("useReducer");
  });

  it("🔴 기준값을 화면이 만들지 않는다 — 채널 GET 한 model 만 읽는다", () => {
    expect(PANEL).not.toContain("buildChannelEditModel");
    expect(PANEL).not.toContain("fetch(");
  });
});

describe("③ 🔴 변경 1개 이상일 때만 열린다", () => {
  it("게이트는 evaluateEditGate 가 정한다 — 화면이 세지 않는다", () => {
    expect(PANEL).toContain("evaluateEditGate(model, draft, touched)");
    expect(PANEL).toContain("disabled={busy || !gate.canSubmit}");
  });

  it("🔴 버튼을 «숨기지» 않는다 — 꺼져 있는 것과 없는 것은 다르다", () => {
    /* 손실 게이트(UpdateConfirmPanel)는 버튼을 만들지 않는다 —
       「보내면 사라진다」이기 때문이다. 여기는 「보낼 것이 없다」다. */
    expect(PANEL).toContain("고친 내용이 있으면 버튼이 열립니다.");
    expect(PANEL).not.toContain("{gate.canSubmit && (");
  });

  it("변경 목록도 게이트가 준 것을 쓴다", () => {
    expect(PANEL).toContain("gate.changes.map(");
    expect(PANEL).not.toContain("detectFieldChanges");
  });
});

describe("④ 🔴 모르는 것을 안다고 말하지 않는다", () => {
  it("대조하지 못한 항목은 「고치셨습니다」라고만 말한다", () => {
    expect(PANEL).toContain("고치셨습니다");
    expect(PANEL).toContain("미리 보여드리지는 못하지만 그대로 반영됩니다");
  });

  it("🔴 읽지 못한 값을 「없음」으로 그리지 않는다", () => {
    expect(PANEL).toContain('if (baseline.state === "UNREAD") return "읽지 못했습니다";');
    /* 빈 값과 못 읽은 것을 «다른 말» 로 한다. */
    expect(PANEL).toContain('return "비어 있습니다"');
  });

  it("🔴 「지금 값」의 출처를 화면이 밝힌다", () => {
    expect(PANEL).toContain("에서 방금 읽어 온 것입니다");
  });

  it("개발용 낱말을 앞면에 쓰지 않는다", () => {
    for (const word of ["Snapshot", "payload", "capability", "UNKNOWN", "PARTIAL", "GET "]) {
      const front = PANEL.slice(PANEL.indexOf("<section"));
      expect(front, `앞면에 개발용 낱말: ${word}`).not.toContain(word);
    }
  });
});
