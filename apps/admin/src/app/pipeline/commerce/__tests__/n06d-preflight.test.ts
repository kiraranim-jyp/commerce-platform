import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countSelectionReadiness,
  selectionReadinessSummary,
} from "../CommerceSelector";
import { buildRegistrationChannels, type RegistrationChannel } from "../registration-channels";
import { COMMERCE_ORDER, LOTTEON_COMMERCE_ID, commerceLabel, isPlatformCommerce } from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-D(CPO 확정, 2026-09-24) — **Registration Preflight**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 등록 버튼을 누르기 «전» 에 고른 커머스가 지금 등록 가능한 상태인지 확인한다.
 *
 * ── 🔴 이 단계의 가장 중요한 계약 ─────────────────────────────────────────
 *
 *     Preflight 가 확인하는 payload  ==  실제 등록이 보내는 payload
 *
 * 이것을 «테스트로» 지키는 것이 아니라 «구조로» 지킨다: Preflight 전용 payload
 * builder 를 만들지 않았다. 두 벌이 생기는 순간 한쪽만 고쳐지고, 화면은 통과라고
 * 말하는데 등록은 거절되는 상태가 된다(이 저장소가 CP001 로 이미 겪은 사고다).
 * 아래 ③이 그 «두 벌이 없다» 를 소스로 고정한다.
 */

const DIR = join(__dirname, "..");
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const channels = (over: Partial<Record<string, RegistrationChannel["state"]>> = {}) =>
  buildRegistrationChannels({
    order: COMMERCE_ORDER,
    labelOf: commerceLabel,
    isComingSoon: (id) => isPlatformCommerce(id) && id === "elevenst",
    isPreviewOnly: (id) => id === "smartstore",
    readiness: Object.fromEntries(
      Object.entries(over).map(([id, state]) => [
        id,
        { state, priorityItems: state === "READY" ? [] : [{ key: "x", label: "확인", sourceItems: [] }], provisional: false, requiredTotal: 10 },
      ]),
    ),
  });

describe("① 고른 것들이 «지금» 등록 가능한지 센다", () => {
  it("READY / 확인 필요 / 확인 전 세 갈래로만 나눈다", () => {
    const counts = countSelectionReadiness(channels({ smartstore: "READY", coupang: "NEEDS_REVIEW" }), [
      "smartstore",
      "coupang",
      LOTTEON_COMMERCE_ID,
    ]);
    expect(counts).toEqual({ selected: 3, ready: 1, needsReview: 1, unknown: 1 });
  });

  it("🔴 고르지 «않은» 채널은 세지 않는다", () => {
    const counts = countSelectionReadiness(channels({ smartstore: "READY", coupang: "READY" }), ["smartstore"]);
    expect(counts.selected).toBe(1);
    expect(counts.ready).toBe(1);
  });

  it("🔴 상태가 없는 채널을 «등록 가능» 으로 세지 않는다", () => {
    // 부족 항목 0건이지만 보고된 적이 없다 — 그것은 준비됐다는 뜻이 아니다.
    const counts = countSelectionReadiness(channels(), ["coupang"]);
    expect(counts.ready).toBe(0);
    expect(counts.unknown).toBe(1);
  });

  it("0 인 갈래는 문장에 적지 않는다 — 없는 것을 세지 않는다", () => {
    expect(selectionReadinessSummary({ selected: 2, ready: 2, needsReview: 0, unknown: 0 })).toBe("등록 가능 2");
    expect(selectionReadinessSummary({ selected: 3, ready: 1, needsReview: 1, unknown: 1 })).toBe(
      "등록 가능 1 · 확인 필요 1 · 확인 전 1",
    );
    expect(selectionReadinessSummary({ selected: 0, ready: 0, needsReview: 0, unknown: 0 })).toBe("");
  });
});

describe("② 선택한 커머스만 Preflight 한다", () => {
  const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));

  it("🔴 롯데ON 은 고르지 않으면 preview 를 부르지 않는다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("async function checkSelectedReadiness()"),
      WORKSPACE.indexOf("const [multiConfirmOpen"),
    );
    expect(fn).toContain("if (!selectedCommerces.includes(LOTTEON_COMMERCE_ID)) return;");
    expect(fn.indexOf("selectedCommerces.includes(LOTTEON_COMMERCE_ID)")).toBeLessThan(
      fn.indexOf("/api/lotteon/payload-preview"),
    );
  });

  it("스마트스토어·쿠팡의 사전 점검은 외부 API 를 부르지 않는다 — 어댑터 계산이다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("const provisionalReadiness = useMemo("),
      WORKSPACE.indexOf("const mergedReadiness = useMemo("),
    );
    expect(fn).toContain("PLATFORM_ADAPTERS[platformId].toListingModel(");
    expect(fn).not.toContain("fetch(");
  });

  it("등록 실행 대상도 «고른 것» 의 교집합이다", () => {
    expect(WORKSPACE).toContain("COMMERCE_ORDER.filter((id) => selectedCommerces.includes(id))");
  });
});

describe("③ 🔴 Preflight 전용 payload builder 가 «없다»", () => {
  const FILES = [
    "../CommerceWorkspace.tsx",
    "CommerceSelector.tsx",
    "PlatformPreview.tsx",
    "LotteOnRegistrationPanel.tsx",
  ];

  it.each(FILES)("%s — preflight 전용 조립 함수를 만들지 않았다", (relative) => {
    const code = codeOnly(readFileSync(join(DIR, relative), "utf8"));
    for (const forbidden of [
      "buildPreflight",
      "PreflightPayload",
      "preflightPayload",
      "previewPayloadBuilder",
    ]) {
      expect(code, `Preflight 전용 payload 경로가 생겼다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("등록에 쓰는 그 경로를 그대로 쓴다 — 실행은 기존 executor / 기존 라우트", () => {
    const code = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));
    expect(code).toContain("LISTING_EXECUTORS[platform].execute(");
    expect(code).toContain('fetch("/api/lotteon/register"');
    // ListingModel 을 만드는 곳도 하나뿐이다(단독 등록과 같은 함수).
    expect(code).toContain("const listingModelFor = useCallback(");
  });
});

describe("④ 등록 직전 게이트는 기존 정책 그대로다", () => {
  const WORKSPACE = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));

  it("🔴 누르자마자 나가지 않는다 — 최종 확인이 먼저다", () => {
    expect(WORKSPACE).toContain("onClick={() => setMultiConfirmOpen(true)}");
    expect(WORKSPACE).toContain("void registerSelected()");
  });

  it("🔴 중복 LIVE 등록 차단이 그대로 있다", () => {
    // 같은 상품·같은 채널로 이미 성공한 LIVE 이력이 있으면 다시 쏘지 않는다.
    expect(WORKSPACE).toContain('entry.mode === "LIVE" && entry.result.status === "SUBMITTED"');
  });

  it("🔴 실패 격리 — 한 채널이 실패해도 루프를 멈추지 않는다", () => {
    const loop = WORKSPACE.slice(
      WORKSPACE.indexOf("async function registerSelected()"),
      WORKSPACE.indexOf("function retryListing()"),
    );
    expect(loop).toContain("} catch (error) {");
    expect(loop).not.toContain("break;");
  });

  it("실행 순서는 화면 순서 그대로다 — 체크한 순서가 아니다", () => {
    expect(WORKSPACE).toContain("COMMERCE_ORDER.filter((id) => selectedCommerces.includes(id))");
  });
});
