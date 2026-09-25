import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-10 — **동의 UI 는 실제 동작대로 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CTO 명시: 「RECREATE = 기존 상품 삭제」처럼 오해할 수 있는 표현을 쓰지
 * 않는다. 실제로 일어나는 일은 «상품이 하나 더 생기고 옛 상품은 남는 것» 이다.
 *
 * 「기존 상품을 새것으로 바꿉니다」라고 쓰면 셀러는 옛 상품이 사라진다고 읽고,
 * 실제로는 남아 있으니 그대로 두 개를 팔게 된다 — Production 의 중복 9건이
 * 만들어진 방식과 같은 오해다. 그래서 «문장» 으로 막고, 여기서 고정한다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const PANEL_PATH = join(__dirname, "../RecreateConsentPanel.tsx");
const PANEL = codeOnly(readFileSync(PANEL_PATH, "utf8"));
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 「지운다」로 읽히는 말을 쓰지 않는다", () => {
  it.each(["삭제", "교체", "덮어"])("「%s」는 아예 쓰지 않는다 — 부정문으로도 오해를 부른다", (forbidden) => {
    expect(PANEL).not.toContain(forbidden);
  });

  it.each(["지우", "판매중지"])(
    "🔴 「%s」는 «부정문으로만» 쓸 수 있다 — 「…하지 않습니다」",
    (word) => {
      /* 단어 금지만으로는 약하다: 「기존 상품을 교체합니다」를 막아도
         「판매중지로 바꿉니다」는 통과한다. 그래서 «주장인지 부정인지» 를 본다.
         이 단어가 나오면 바로 뒤에 「않」이 따라와야 한다. */
      for (const match of PANEL.matchAll(new RegExp(word, "g"))) {
        const after = PANEL.slice(match.index, match.index + 40);
        expect(after, `「${word}」가 부정 없이 쓰였다: ${after}`).toContain("않");
      }
    },
  );

  it("실제 동작을 «그대로» 적는다 — 하나 더 생기고, 옛 것은 남는다", () => {
    expect(PANEL).toContain("하나 더");
    expect(PANEL).toContain("그대로 남습니다");
    expect(PANEL).toContain("지우거나 판매중지로");
  });

  it("🔴 아직 아무것도 나가지 않았다고 말한다 — 실패 메시지가 아니다", () => {
    expect(PANEL).toContain("아직");
    expect(PANEL).toContain("보내지 않았습니다");
  });

  it("옛 상품을 내리는 버튼을 두지 않았다 — 그런 코드 경로가 없다", () => {
    expect(PANEL).not.toContain("onDelete");
    expect(PANEL).not.toContain("onSuspend");
  });
});

describe("② 🔴 이유를 지어내지 않는다", () => {
  it("서버가 준 reason 을 그대로 보여준다", () => {
    expect(PANEL).toContain("{request.reason}");
  });

  it("지금 나가 있는 상품번호도 서버 값 그대로다", () => {
    expect(PANEL).toContain("request.currentExternalProductId");
  });
});

describe("③ 🔴 두 번 눌러 두 개 만들지 않는다", () => {
  it("진행 중이면 버튼이 잠긴다", () => {
    expect(PANEL).toContain("disabled={busy}");
  });

  it("누르는 순간 패널을 «먼저» 닫는다", () => {
    const handler = WORKSPACE.slice(
      WORKSPACE.indexOf("onConfirm={() => {"),
      WORKSPACE.indexOf("onCancel={() => setRecreateConsent(null)}"),
    );
    expect(handler.indexOf("setRecreateConsent(null);")).toBeLessThan(
      handler.indexOf("confirmListing(target, { confirmRecreate: true })"),
    );
  });
});

describe("④ 🔴 자동으로 동의하지 않는다", () => {
  it("동의는 셀러가 누른 «그 요청에만» 실린다", () => {
    /* 서버가 되물은 자리에서 코드가 곧장 재요청하면, 물어본 적이 없는 것과
       같아진다 — 그 자리에 confirmRecreate:true 가 있으면 안 된다. */
    const afterAsk = WORKSPACE.slice(
      WORKSPACE.indexOf("if (result.needsConfirmation) {"),
      WORKSPACE.indexOf("const finishedAt = Date.now();"),
    );
    expect(afterAsk).toContain("setRecreateConsent(");
    expect(afterAsk).not.toContain("confirmRecreate: true");
  });

  it("보이는 탭의 질문만 세운다", () => {
    expect(WORKSPACE).toContain("recreateConsent.platform === tab");
  });
});

describe("⑤ 서버·실행기·화면이 «같은 이름» 을 쓴다", () => {
  const files = {
    executor: join(__dirname, "../../../../../../../packages/listing/src/executor.ts"),
    smartstore: join(__dirname, "../../../api/smartstore/register/route.ts"),
    coupang: join(__dirname, "../../../api/coupang/register/route.ts"),
  };

  it("confirmRecreate 가 세 곳 모두에 있다 — 한 곳만 빠지면 동의가 사라진다", () => {
    for (const [, path] of Object.entries(files)) {
      expect(readFileSync(path, "utf8")).toContain("confirmRecreate");
    }
  });

  it("🔴 두 라우트가 «구조화된» needsConfirmation 으로 되묻는다", () => {
    for (const path of [files.smartstore, files.coupang]) {
      const src = codeOnly(readFileSync(path, "utf8"));
      expect(src).toContain("needsConfirmation: {");
      expect(src).toContain('operation: "RECREATE",');
    }
  });

  it("🔴 동의 기본값은 «안 함» 이다 — === true 로만 받는다", () => {
    for (const path of [files.smartstore, files.coupang]) {
      expect(codeOnly(readFileSync(path, "utf8"))).toContain("body.confirmRecreate === true");
    }
  });
});
