import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3 — **수정 화면이 «자기 진실» 을 만들지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 다섯:
 *   ① 항목 목록·설명·capability 를 화면에 하드코딩하지 않는다.
 *   ② 초안을 화면이 소유하지 않는다 — payload 를 만드는 값과 두 벌이 되면 안 된다.
 *   ③ 변경 1개 이상일 때만 버튼이 열린다(숨기지 «않고» 꺼 둔다).
 *   ④ 대조하지 못한 항목을 「바뀝니다」로 단정하지 않는다.
 *   ⑤ 화면에 «붙어 있다» — 그리고 SmartStore·연결된 상품에만.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const PANEL = codeOnly(readFileSync(join(__dirname, "../ChannelEditPanel.tsx"), "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 화면이 목록을 따로 만들지 않는다", () => {
  it("항목은 editorFieldSchema 가 준 것을 그대로 그린다", () => {
    expect(PANEL).toContain("editorFieldSchema(model)");
    expect(PANEL).toContain("fields.map(");
  });

  it("🔴 필드 이름·라벨을 화면에 하드코딩하지 않는다", () => {
    /* 라벨·순서·설명은 schema 가 정한다. 화면이 아는 유일한 필드 이름은
       상세설명이고(길어서 길이만 말한다), 그것도 «표시 방식» 이지 목록이 아니다. */
    for (const label of ["상품명\"", "판매가격\"", "카테고리\"", "재고\""]) {
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
    /* 「보낼 값」을 보여줄지는 schema 의 editable 만 본다 — 나가지 않는 값을
       나란히 두면 반영된다고 읽힌다. */
    expect(PANEL).toContain("{field.editable ?");
  });
});

describe("② 🔴 초안을 화면이 소유하지 않는다", () => {
  it("draft 와 touched 는 props 로 들어온다", () => {
    expect(PANEL).toContain("draft: Partial<Record<EditableField, unknown>>");
    expect(PANEL).toContain("touched?: readonly EditableField[]");
  });

  it("🔴 입력칸을 두지 않는다 — 되받아 쓰면 상품명 파생 규칙이 두 번 걸린다", () => {
    expect(PANEL).not.toContain("<input");
    expect(PANEL).not.toContain("onChange");
    /* 값은 각자의 편집기에서 고친다고 «말한다» — 셀러가 어디서 고칠지 알아야 한다. */
    expect(PANEL).toContain("각 항목의 편집 화면에서 고치시면");
  });

  it("보낼 값도 «대조하는 단위» 로 보여준다 — 화면과 판단이 같은 것을 본다", () => {
    expect(PANEL).toContain("toComparable(field.compareUnit, draft[field.field])");
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

describe("③ 🔴 변경 목록과 수정 버튼은 «여기에 없다»(F-14-5)", () => {
  it("버튼도 변경 목록도 이 화면에는 없다 — 우측 요약 하나뿐이다", () => {
    /* 같은 것을 두 자리에 그리면 하나는 반드시 옛말을 하게 되고, 셀러는
       가까운 쪽을 믿는다. */
    expect(PANEL).not.toContain("<button");
    expect(PANEL).not.toContain("gate.changes.map(");
    expect(PANEL).toContain("오른쪽 요약에 있습니다");
  });

  it("어느 항목이 바뀌는지는 «게이트에게» 묻는다 — 화면이 세지 않는다", () => {
    expect(PANEL).toContain("evaluateEditGate(model, draft, touched)");
    expect(PANEL).not.toContain("detectFieldChanges");
  });
});

describe("④ 🔴 모르는 것을 안다고 말하지 않는다", () => {
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

describe("⑤ 🔴 화면에 «붙어 있다» — 그리고 SmartStore 에만", () => {
  it("연결을 아는 상품에만 나온다", () => {
    expect(WORKSPACE).toContain("<ChannelEditPanel");
    expect(WORKSPACE).toContain('tab === "smartstore" && registrationStateFor("smartstore").basis === "CHANNEL_PRODUCT"');
  });

  it("🔴 초안은 보낼 payload 의 투영이다 — product·listing 을 다시 읽지 않는다", () => {
    expect(WORKSPACE).toContain("channelEditDraftFromNaverPayload(");
    /* 검증에 쓴 «그» payload 를 들고 있는다 — 다시 만들면 두 벌이 된다. */
    expect(WORKSPACE).toContain("setSmartStorePayload(payload);");
  });

  it("🔴 payload 계산이 실패하면 비운다 — 옛 값을 「보낼 값」이라고 말하지 않는다", () => {
    const nulls = WORKSPACE.match(/setSmartStorePayload\(null\)/g) ?? [];
    expect(nulls.length).toBeGreaterThanOrEqual(2);
  });

  it("대조 못 하는 축은 «불러온 순간의» payload 와 비교한다", () => {
    expect(WORKSPACE).toContain("localTouchSignals(");
    expect(WORKSPACE).toContain("channelEdit.basePayload");
  });

  it("🔴 화면을 열기만 해서는 채널을 부르지 않는다 — 셀러가 누를 때만 나간다", () => {
    expect(WORKSPACE).toContain("void loadChannelEdit()");
    /* useEffect 안에서 부르면 탭을 열기만 해도 판매자 계정으로 GET 이 나간다. */
    expect(WORKSPACE).not.toMatch(/useEffect\([^)]*loadChannelEdit/);
  });

  it("🔴 수정 버튼이 곧 전송이 아니다 — 등록과 같은 문을 지나 확인을 한 번 더 받는다", () => {
    expect(WORKSPACE).toContain('onSubmit={() => void confirmListing("smartstore")}');
    const mount = WORKSPACE.slice(WORKSPACE.indexOf("<ChannelEditPanel"), WORKSPACE.indexOf("</section>"));
    expect(mount).not.toContain("fetch(");
    expect(mount).not.toContain("PUT");
  });

  it("읽지 못한 이유를 화면에 남긴다", () => {
    expect(WORKSPACE).toContain("channelEditNote");
    expect(WORKSPACE).toContain("지금 등록된 내용을 읽지 못했습니다");
  });
});
