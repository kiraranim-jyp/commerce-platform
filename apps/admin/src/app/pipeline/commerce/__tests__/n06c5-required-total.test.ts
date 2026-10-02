import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistrationChannels, type RegistrationChannel } from "../registration-channels";
import { COMMERCE_ORDER, LOTTEON_COMMERCE_ID, commerceLabel, isPlatformCommerce } from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06 C-5(CPO 확정, 2026-09-24) — **이미 계산한 숫자를 버리지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Master 화면은 「쿠팡 확인 2건」은 알아도 «몇 개 중 2건인지» 를 말할 수 없었다.
 * 그 수를 몰라서가 아니다 — `computeChecklistReadiness()` 가 이미
 * `required: ReadinessItem[]` 을 만들어 두고, 상위 레이어로 올라올 때만 버리고
 * 있었다.
 *
 * ── 🔴 이 파일이 지키는 경계 ──────────────────────────────────────────────
 * 새 판정을 만들지 않았다. 그리고 **「자동 해결 19」를 적지 않는다** — 21 − 2 = 19
 * 는 산수로는 맞지만, 그 19 가 「자동으로 해결됐다」인지 「애초에 요구되지
 * 않았다」인지 지금 데이터로는 가를 수 없다. 추정한 숫자를 화면에 적는 순간
 * 이 화면의 «모든» 숫자가 의심받는다. 가르는 축은 N-07 에서 만든다.
 */

const DIR = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(DIR, relative), "utf8");
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("① 필수 항목 수가 채널 모델까지 «살아서» 온다", () => {
  const channels = buildRegistrationChannels({
    order: COMMERCE_ORDER,
    labelOf: commerceLabel,
    isComingSoon: (id) => isPlatformCommerce(id) && id === "elevenst",
    isPreviewOnly: (id) => id === "smartstore",
    readiness: {
      coupang: {
        state: "NEEDS_REVIEW",
        priorityItems: [
          { key: "manufacturer", label: "제조자", sourceItems: [] },
          { key: "notice", label: "상품정보제공고시", sourceItems: [] },
        ],
        provisional: false,
        requiredTotal: 21,
      },
      [LOTTEON_COMMERCE_ID]: {
        state: "READY",
        priorityItems: [],
        provisional: false,
        requiredTotal: 14,
      },
    },
  });
  const byId = Object.fromEntries(channels.map((c) => [c.id, c])) as Record<string, RegistrationChannel>;

  it("보고된 값을 그대로 옮긴다", () => {
    expect(byId.coupang.requiredTotal).toBe(21);
    expect(byId.coupang.blockingCount).toBe(2);
    expect(byId[LOTTEON_COMMERCE_ID].requiredTotal).toBe(14);
  });

  it("🔴 보고된 적 없는 채널은 0 이다 — 그리고 0 은 «모른다» 는 뜻이다", () => {
    /* 0 을 「필수 0개」로 읽으면 안 된다. 그래서 화면은 0 일 때 숫자를 아예
       말하지 않는다(아래 ③). */
    expect(byId.smartstore.requiredTotal).toBe(0);
    expect(byId.smartstore.state).toBeNull();
  });
});

describe("② 계산 경로를 새로 만들지 않았다", () => {
  const PREVIEW = codeOnly(read("PlatformPreview.tsx"));
  const WORKSPACE = codeOnly(read("../CommerceWorkspace.tsx"));

  it("채널 화면은 이미 있던 readinessSummary.required 를 그대로 보고한다", () => {
    expect(PREVIEW).toContain("const requiredTotal = readinessSummary.required.length;");
    expect(PREVIEW).toContain("onReadinessChange?.(registrationState, priorityItems, requiredTotal)");
  });

  it("사전 점검도 같은 값을 쓴다 — 두 경로가 다른 수를 말하지 않는다", () => {
    expect(WORKSPACE).toContain("requiredTotal: summary.required.length");
  });

  it("🔴 롯데ON 은 서버 검증이 센 값을 쓴다(fields 전체)", () => {
    expect(WORKSPACE).toContain("requiredTotal: lotteOnReadiness.total");
  });

  it("🔴 값을 «만드는» 곳이 둘뿐이다 — 세 번째 계산 경로가 없다", () => {
    /* 타입 선언(`requiredTotal: number;`)은 세지 않는다. 실제로 값을 만드는
       줄만 센다: 사전 점검(summary.required.length)과 롯데ON(서버가 센 total).
       탭이 보고하는 값은 PlatformPreview 가 만들어 넘겨줄 뿐이다. */
    const assignments = WORKSPACE.split(String.fromCharCode(10))
      .filter((line) => line.includes("requiredTotal:") && !line.includes("number"))
      .map((line) => line.trim());
    expect(assignments, `값을 만드는 줄: ${assignments.join(" | ")}`).toHaveLength(2);
  });
});

describe("③ 🔴 화면은 «아는 것만» 적는다", () => {
  const SELECTOR = codeOnly(read("CommerceSelector.tsx"));

  it("전체 수를 알면 「필수 N · 확인 M건」으로 말한다", () => {
    expect(SELECTOR).toContain("channel.requiredTotal > 0 ? `필수 ${channel.requiredTotal} · ` : \"\"");
  });

  it("🔴 「자동 해결」이라는 말을 화면에 쓰지 않는다", () => {
    /* 지금 데이터로는 「자동 해결 / 사용자 확인 / 사용자 입력 / 미해결」을 가를
       수 없다. 가르지 못하는 것을 숫자로 적지 않는다(CPO 확정). */
    for (const forbidden of ["자동 해결", "자동해결", "autoResolved", "resolvedCount"]) {
      expect(SELECTOR, `추정 분류가 화면에 들어왔다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("전체 수를 모르면 수 접두사 없이 문구만 적는다", () => {
    // requiredTotal 이 0 이면 접두사가 빈 문자열이라 문구가 그대로 남는다.
    expect(SELECTOR).toContain("const scope = channel.requiredTotal > 0");
  });

  /* ══ URGENT ① (CPO 확정, 2026-10-01) ══════════════════════════════════
     🔴 이 테스트가 옛 문구 「확인 ${blockingCount}건」을 소스 문자열로 고정하고
     있었다. RED 와 YELLOW 가 그 한 문구를 «공유» 했기 때문인데, 그것이 바로
     고친 결함이다 — 등록을 «막는 것» 과 «봐야 하는 것» 이 같은 말을 쓰고 있었다.
     문구를 가른 뒤이므로 단정도 가른다. */
  it("🔴 RED 와 YELLOW 가 «다른» 문구를 쓴다", () => {
    expect(SELECTOR).toContain("필수 입력");
    expect(SELECTOR).toContain("확인 필요");
    /* 두 분기가 한 줄에서 갈린다 — level 을 보고 고른다. */
    expect(SELECTOR).toContain('level === "RED" ?');
  });

  it("🔴 점과 문구가 «같은 함수» 를 본다 — 둘이 어긋날 수 없다", () => {
    /* readinessStateToLevel 을 문구 쪽에서도 부른다. 따로 판단하면 색과 글자가
       다른 말을 하는 날이 온다. */
    expect(SELECTOR).toContain("const level = readinessStateToLevel(channel.state)");
  });

  it("합산 요약을 만들지 않았다 — 어느 채널이 막혔는지를 지우지 않는다", () => {
    for (const forbidden of ["등록 가능 여부 합산", "totalBlocking", "aggregateReadiness"]) {
      expect(SELECTOR, forbidden).not.toContain(forbidden);
    }
  });
});

describe("④ 기존 판정은 한 글자도 바뀌지 않았다", () => {
  it("readiness 계산 함수의 반환 모양이 그대로다", () => {
    const readiness = readFileSync(join(DIR, "readiness.ts"), "utf8");
    expect(readiness).toContain("return { items, required, recommended, allRequiredPassed, percent };");
  });

  it("DB·snapshot 에 새 칸을 만들지 않았다", () => {
    const types = readFileSync(join(DIR, "../../api/snapshots/_lib/types.ts"), "utf8");
    expect(types).not.toContain("requiredTotal");
  });
});
