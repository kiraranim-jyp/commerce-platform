import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 F-7 — **셀러는 Commerce 내부 코드를 알 필요가 없다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 첫 LIVE 등록이 이 한 줄로 거절됐다:
 *
 *     보낸 값  "oplcCd": "OPLC_CD"      ← 코드가 아니라 «코드그룹 이름»
 *
 * 화면이 「공통코드 OPLC_CD」라는 힌트를 달아 두고 셀러에게 번호를 «적게» 했고,
 * 셀러는 그 힌트를 답으로 읽었다. 원산지 칸은 그때 고쳐졌지만 **배송 세 칸은
 * 같은 모양으로 남아 있었다** — 그것을 이번에 걷어낸다.
 *
 * 🔴 코드가 사라진 것이 아니다. 라벨 옆 ⓘ(apiCodeTip)와 읽기 전용 칸에 그대로
 * 있다 — 「무엇으로 나가는가」는 여전히 확인할 수 있다. 사라진 것은 «적으라는
 * 지시» 다.
 */

const PANEL = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
const FIELDS = readFileSync(join(__dirname, "..", "registration-fields.tsx"), "utf8");

/** 도움말 줄(note)에 실제로 쓰이는 글자만 본다 — 주석의 «이렇게 틀렸었다» 기록은 남긴다. */
const NOTE_TEXTS = (PANEL.match(/note="[^"]*"/g) ?? []).join("\n");

describe("① 코드 그룹 이름을 도움말에 적지 않는다", () => {
  it.each(["DV_CO_CD", "DV_RGSPR_GRP_CD", "OPLC_CD", "PD_ITMS_CD"])("note 에 %s 가 없다", (group) => {
    expect(NOTE_TEXTS).not.toContain(group);
  });

  it("🔴 예시 «코드값» 도 적지 않는다 — 「(예: 0001 롯데택배)」가 있었다", () => {
    expect(NOTE_TEXTS).not.toMatch(/예:\s*\d{3,}/);
  });

  it("대신 「무엇을 고르는가」를 말한다", () => {
    for (const phrase of ["롯데ON이 정한 배송 지역 중에서 고릅니다.", "롯데ON이 정한 택배사 중에서 고릅니다."]) {
      expect(NOTE_TEXTS).toContain(phrase);
    }
    /* 원산지만 문구가 «함수» 다(F-3 — 상품 원산지를 덧붙인다). 같은 규칙이 적용된
       것을 그 함수에서 확인한다. */
    expect(PANEL).toContain("롯데ON이 정한 원산지 중에서 고릅니다.");
  });
});

describe("② 라벨이 사람의 말이다", () => {
  it.each([
    ['label="배송 가능 지역"', 'label="배송가능지역코드"'],
    ['label="택배사"', 'label="택배사코드"'],
    ['label="반품 택배사"', 'label="반품택배사코드"'],
  ])("%s (옛 %s)", (now, before) => {
    expect(PANEL).toContain(now);
    expect(PANEL).not.toContain(before);
  });

  /* 🔴 코드는 지운 것이 아니라 ⓘ 안에 있다 — REWORK-14 가 만든 자리 그대로다. */
  it("API 필드명은 ⓘ 에 남아 있다", () => {
    expect(FIELDS).toContain("롯데ON API 필드명");
  });
});

describe("③ 목록이 있으면 코드를 «적게» 하지 않는다", () => {
  it("ChannelCodeField 가 readOnly 를 받는다", () => {
    expect(FIELDS).toContain("readOnly?: boolean;");
    expect(FIELDS).toContain("readOnly={readOnly}");
  });

  /* ══ F-8 로 계약이 «바뀌었다» ══
     F-7 은 「목록이 있을 때만」 읽기 전용이었다. 즉 조회가 실패하면 코드 입력이
     되살아났다 — 그것이 곧 「셀러에게 코드를 묻는 마지막 통로」였고, CPO 가
     그 fallback 을 제거하라고 확정했다. 이제 «조건 없이» 읽기 전용이다. */
  it("코드 칸은 조건 없이 읽기 전용이다 — 조회 실패해도 되살아나지 않는다", () => {
    expect(PANEL).not.toMatch(/readOnly=\{[^}]*length[^}]*\}/);
    /* 4칸(배송지역·택배사·반품택배사·원산지) + 고시 품목 + 고시 항목. */
    expect((PANEL.match(/^\s+readOnly$/gm) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("고를 것이 없으면 «안내와 재시도» 가 선다 — 입력칸이 아니다", () => {
    expect(PANEL).toContain("function CodeListUnavailable(");
    expect(PANEL).toContain("목록을 불러오지 못했습니다.");
    expect(PANEL).toContain("다시 불러오기");
    /* 🔴 판정은 「오류일 때」가 아니라 「고를 것이 없을 때」다 — 오류 없이 0건이
       와도 셀러에게 남는 길이 없기는 마찬가지다. */
    expect(PANEL).toContain("if (list.items.length === 0)");
    expect(PANEL).toContain("if (options.length === 0)");
  });

  it("드롭다운은 이름으로 고르게 한다 — 「이름 (코드)」가 아니다", () => {
    expect(PANEL).toContain("{option.name || option.code}");
    expect(PANEL).not.toContain("`${option.name} (${option.code})`");
  });
});

describe("④ 고른 즉시 다시 확인한다 — 다만 타이핑마다는 아니다", () => {
  it("목록에서 고르는 경로가 pickAndRecheck 를 쓴다", () => {
    const picks = PANEL.match(/onPick=\{\(value\) => (\w+)\(/g) ?? [];
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) expect(pick).toContain("pickAndRecheck");
  });

  it("pickAndRecheck 가 commit 과 재확인을 함께 한다", () => {
    const body = PANEL.slice(PANEL.indexOf("function pickAndRecheck"));
    const fn = body.slice(0, body.indexOf("\n  }"));
    expect(fn).toContain("commitForm(next)");
    expect(fn).toContain("runValidation(next)");
  });

  /* 🔴 자유 입력은 그대로 stale + [등록 정보 확인] 이다. 이 확인은 서버에서
     207 Identity 를 매번 호출하고 프록시가 느린 것이 실측돼 있다 — 타이핑마다
     쏘면 화면이 느려지고 롯데ON 에 불필요한 부하를 준다. */
  it("자유 입력(onChange)은 재확인을 부르지 않는다", () => {
    const changes = PANEL.match(/onChange=\{\(value\) => (\w+)\(/g) ?? [];
    expect(changes.length).toBeGreaterThan(0);
    for (const change of changes) expect(change).not.toContain("pickAndRecheck");
  });
});
