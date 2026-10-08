import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-H(CPO 결정 ㉮, 2026-10-08) — **이동 배너.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 저장소의 규약은 「화면은 마운트한 DOM 으로만 완료 선언」이다. 그런데
 *    `CommerceWorkspace.tsx` 는 4,300줄에 DB·fetch·sessionStorage 를 다 끼고
 *    있어 이 배너 하나를 위해 전체를 마운트할 수 없다(그 자체가 새 harness 다 —
 *    CPO 금지). 그래서 **배너를 그대로 베낀 컴포넌트를 마운트** 하지 않고,
 *    소스에서 «구조» 를 단언한다. 🔴 그리고 그 한계를 숨기지 않고 적는다:
 *
 *      이 파일이 보장하는 것    서버 칸을 읽는가 · 문자열 파싱을 안 하는가
 *                               · 갈 곳 없으면 버튼을 안 만드는가
 *      보장하지 «못하는» 것     실제 브라우저에서 보이는가 → CEO 확인 몫
 *
 * 🔴 `.test.tsx` 는 이 저장소의 vitest 설정에서 «수집되지 않는다» 는 기록이
 *    있어(로컬 툴체인 조용한 무동작) 확장자를 `.test.tsx` 로 두면서도
 *    DOM 렌더에 의존하지 않게 만들었다 — 수집 여부 자체를 아래에서 단언한다.
 */
const SRC = readFileSync(
  path.join(__dirname, "..", "..", "CommerceWorkspace.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** 배너 블록만 잘라 본다 — 파일 전체로 재면 애먼 줄에 걸린다. */
function banner(): string {
  const i = SRC.indexOf('data-testid="existing-registration-notice"');
  expect(i, "이동 배너를 찾지 못했다").toBeGreaterThan(-1);
  const start = SRC.lastIndexOf("{(() => {", i);
  const end = SRC.indexOf("{recreateConsent", i);
  return SRC.slice(start, end);
}

describe("🔴 이 테스트 파일이 실제로 수집된다", () => {
  it("수집 자체를 단언한다 — .test.tsx 가 조용히 빠지면 이 줄이 안 돈다", () => {
    expect(true).toBe(true);
  });
});

describe("🔴🔴 배너는 서버가 구조화한 칸을 읽는다", () => {
  it("existingRegistration 을 읽는다", () => {
    expect(banner()).toContain("existingRegistration");
  });

  it("🔴 error.message 를 문자열로 뒤지지 않는다", () => {
    const b = banner();
    expect(b).not.toContain("error?.message");
    expect(b).not.toMatch(/\.message\.(includes|match|indexOf)/);
    /* JOB 번호를 문구에서 파싱하지 않는다. */
    expect(b).not.toMatch(/JOB-\d/);
  });

  it("kind 를 확인한 뒤에만 그린다 — NEEDS_RECONCILIATION 에 이동 버튼이 뜨지 않는다", () => {
    expect(banner()).toContain('found.kind !== "EXISTING_CONNECTION_FOUND"');
  });
});

describe("🔴🔴 갈 곳이 없으면 버튼을 만들지 않는다", () => {
  it("siblingJobKey 와 siblingSnapshotId 가 «둘 다» 있을 때만 이동한다", () => {
    const b = banner();
    expect(b).toMatch(/found\.siblingJobKey && found\.siblingSnapshotId/);
    /* 버튼 자체가 그 조건 뒤에 있다. */
    const iCond = b.indexOf("found.siblingJobKey && found.siblingSnapshotId");
    const iBtn = b.indexOf('data-testid="existing-registration-move"');
    expect(iBtn).toBeGreaterThan(iCond);
  });

  it("🔴 jobKey 가 없으면 그 사실을 말한다 — 빈 칸으로 두지 않는다", () => {
    expect(banner()).toContain("작업 번호를 확인하지 못했습니다");
  });
});

describe("🔴🔴 이동은 «쓰기가 0» 이다", () => {
  it("배너에 fetch·POST·link·apply 가 없다", () => {
    const b = banner();
    for (const forbidden of ["fetch(", "POST", "linkLegacyRegistration", "apply", "channel-products/link"]) {
      expect(b, `배너가 ${forbidden} 를 쓴다 — 이동은 쓰기가 없어야 한다`).not.toContain(forbidden);
    }
  });

  it("🔴 기존 복원 경로(?resume=)를 그대로 쓴다 — 새 라우트를 만들지 않았다", () => {
    expect(banner()).toContain("/pipeline?resume=");
    expect(banner()).toContain("encodeURIComponent");
  });

  it("🔴 그 경로가 실제로 복원에 쓰이는 파라미터다", () => {
    const page = readFileSync(path.join(__dirname, "..", "..", "page.tsx"), "utf8");
    expect(page).toContain('get("resume")');
  });
});

describe("🔴 커머스 탭에서만 뜬다", () => {
  it("기존 isPlatformTab 으로 좁힌다 — 새 narrowing 을 만들지 않았다", () => {
    expect(banner()).toContain("isPlatformTab(tab)");
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴🔴 롯데ON 화면도 «같은» 안내를 한다(CPO P5.5-H FINAL).
   🔴 상태 모델을 개편하지 않았다 — `registerResult.result` 가 이미 그려지는
      자리에 두 줄을 넓혔다. 그 사실 자체를 아래에서 단언한다.
   ───────────────────────────────────────────────────────────────────────── */
const LOTTEON = readFileSync(path.join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

function lotteonBanner(): string {
  const i = LOTTEON.indexOf('data-testid="lotteon-existing-registration"');
  expect(i, "롯데ON 이동 배너를 찾지 못했다").toBeGreaterThan(-1);
  const start = LOTTEON.lastIndexOf("existingRegistration?.kind", i);
  return LOTTEON.slice(start, i + 1800);
}

describe("🔴🔴 롯데ON 화면 — 같은 안내 · 같은 규약", () => {
  it("서버가 내려보내는 existingRegistration 을 읽는다", () => {
    expect(lotteonBanner()).toContain("EXISTING_CONNECTION_FOUND");
  });

  it("🔴 갈 곳이 둘 다 있을 때만 이동 버튼을 만든다", () => {
    const b = lotteonBanner();
    expect(b).toMatch(/found\.siblingJobKey && found\.siblingSnapshotId/);
    const iCond = b.indexOf("found.siblingJobKey && found.siblingSnapshotId");
    const iBtn = b.indexOf('data-testid="lotteon-existing-registration-move"');
    expect(iBtn).toBeGreaterThan(iCond);
  });

  it("🔴 이동은 쓰기가 0 이다 — fetch·link·apply 가 없다", () => {
    const b = lotteonBanner();
    for (const forbidden of ["fetch(", "linkLegacyRegistration", "apply", "channel-products/link"]) {
      expect(b, `롯데ON 배너가 ${forbidden} 를 쓴다`).not.toContain(forbidden);
    }
  });

  it("🔴 같은 복원 경로(?resume=)를 쓴다 — 롯데ON 전용 경로를 만들지 않았다", () => {
    expect(lotteonBanner()).toContain("/pipeline?resume=");
  });

  it("🔴 message 를 문자열로 뒤지지 않는다", () => {
    const b = lotteonBanner();
    expect(b).not.toMatch(/\.message\.(includes|match|indexOf)/);
    expect(b).not.toMatch(/JOB-\d/);
  });

  it("🔴 롯데ON 상태 모델을 개편하지 않았다 — 기존 registerResult 자리에 얹었다", () => {
    expect(LOTTEON).toContain("registerResult.result.existingRegistration");
    expect(LOTTEON).not.toContain("setExistingRegistration");
  });
});

describe("🔴🔴 세 화면이 «같은» 문구와 «같은» 경로를 쓴다", () => {
  it("두 배너가 같은 문장 구조를 쓴다 — 채널마다 다른 말을 하지 않는다", () => {
    for (const b of [banner(), lotteonBanner()]) {
      expect(b).toContain("기존 등록 작업");
      expect(b).toContain("기존 등록 작업으로 이동");
      expect(b).toContain("작업 번호를 확인하지 못했습니다");
    }
  });
});
