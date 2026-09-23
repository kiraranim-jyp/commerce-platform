import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import {
  COMMERCE_ORDER,
  LOTTEON_COMMERCE_ID,
  commerceLabel,
  isPlatformCommerce,
  type CommerceId,
} from "../commerce-registry";
import { buildRegistrationChannels, type RegistrationChannel } from "../registration-channels";
import { isSelectableCommerce, selectionSummary } from "../CommerceSelector";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-05 STEP 2(CPO 확정, 2026-09-23) — **화면이 세 커머스를 같은 자격으로 다룬다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이번에 고친 것 ────────────────────────────────────────────────────────
 * 화면의 채널 목록이 `Record<PlatformId, …>` 였다. `PlatformId` 에는 롯데ON 이
 * 없어서, 오른쪽 「커머스 등록」 카드와 ④ 본문에 **롯데ON 이 아예 서지 못했다.**
 *
 * ── 🔴 이 파일이 지키는 경계 ──────────────────────────────────────────────
 * 넓힌 것은 «화면 식별자» 하나뿐이다. `PlatformId` · 어댑터 레지스트리 · DB 는
 * 한 글자도 바뀌지 않았다 — 그것을 아래 ③이 코드로 고정한다.
 */

const DIR = join(__dirname, "..");

/** 주석을 걷어낸 «실행되는 코드» 만. 이 전환의 주석에는 옛 타입 이름이 설명으로 남아 있다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("① 화면이 아는 커머스는 셋이다", () => {
  it("🔴 COMMERCE_ORDER = 스마트스토어 · 쿠팡 · 롯데ON", () => {
    expect([...COMMERCE_ORDER]).toEqual(["smartstore", "coupang", LOTTEON_COMMERCE_ID]);
  });

  it("11번가는 화면에서 빠진다 — 기능 삭제가 아니라 비노출(정책 그대로)", () => {
    expect(PLATFORM_ORDER).toContain("elevenst");
    expect(COMMERCE_ORDER).not.toContain("elevenst");
  });

  it("이름은 어댑터가 이미 갖고 있는 것을 쓴다 — 두 번 적지 않는다", () => {
    expect(commerceLabel("coupang")).toBe(PLATFORM_ADAPTERS.coupang.label);
    expect(commerceLabel("smartstore")).toBe(PLATFORM_ADAPTERS.smartstore.label);
    expect(commerceLabel(LOTTEON_COMMERCE_ID)).toBe("롯데ON");
  });

  it("🔴 어댑터를 인덱싱해도 되는지 판별식이 하나다", () => {
    // 이 판별 없이 PLATFORM_ADAPTERS[id] 를 하면 롯데ON 에서 undefined 가 되어
    // 렌더 중에 터진다 — CommerceWorkspace 의 isPlatformTab() 과 같은 계약이다.
    expect(isPlatformCommerce("coupang")).toBe(true);
    expect(isPlatformCommerce(LOTTEON_COMMERCE_ID)).toBe(false);
    for (const id of COMMERCE_ORDER) {
      if (isPlatformCommerce(id)) expect(PLATFORM_ADAPTERS[id]).toBeDefined();
    }
  });
});

describe("② 채널 목록에 롯데ON 이 «실제로» 선다", () => {
  const channels = buildRegistrationChannels({
    order: COMMERCE_ORDER,
    labelOf: commerceLabel,
    isComingSoon: (id) => isPlatformCommerce(id) && id === "elevenst",
    isPreviewOnly: (id) => id === "smartstore",
    readiness: {
      coupang: { state: "READY", priorityItems: [], provisional: false, requiredTotal: 7 },
      [LOTTEON_COMMERCE_ID]: {
        state: "NEEDS_REVIEW",
        priorityItems: [{ key: "lotteon-missing", label: "확인 필요", sourceItems: [] }],
        provisional: false,
        requiredTotal: 12,
      },
    },
  });

  it("🔴 세 줄이 서고, 그중 하나가 롯데ON 이다", () => {
    expect(channels.map((c) => c.id)).toEqual(["smartstore", "coupang", LOTTEON_COMMERCE_ID]);
  });

  it("롯데ON 은 «준비중» 이 아니다 — 실제 등록이 동작하는 채널이다", () => {
    const lotteon = channels.find((c) => c.id === LOTTEON_COMMERCE_ID)!;
    expect(lotteon.availability).toBe("AVAILABLE");
    expect(isSelectableCommerce(lotteon)).toBe(true);
  });

  it("상태와 부족 항목 수를 그대로 옮긴다 — 여기서 판정하지 않는다", () => {
    const lotteon = channels.find((c) => c.id === LOTTEON_COMMERCE_ID)!;
    expect(lotteon.state).toBe("NEEDS_REVIEW");
    expect(lotteon.blockingCount).toBe(1);
    const smartstore = channels.find((c) => c.id === "smartstore")!;
    // 보고된 적 없는 채널은 «상태 없음» 이다 — 0을 「준비됨」으로 읽지 않게.
    expect(smartstore.state).toBeNull();
    expect(smartstore.blockingCount).toBe(0);
  });
});

describe("③ 🔴 넓힌 것은 «화면» 뿐이다", () => {
  const REGISTRY = readFileSync(join(DIR, "commerce-registry.ts"), "utf8");

  it("packages/shared 의 PlatformId 는 그대로다 — 세 값뿐", () => {
    const shared = readFileSync(join(DIR, "../../../../../../packages/shared/src/product-types.ts"), "utf8");
    expect(shared).toContain('export type PlatformId = "smartstore" | "coupang" | "elevenst";');
  });

  it("어댑터 레지스트리에 롯데ON 을 «넣지 않았다»", () => {
    const registry = readFileSync(join(DIR, "../../../../../../packages/marketplace/src/registry.ts"), "utf8");
    expect(codeOnly(registry)).not.toContain("lotteon:");
  });

  it("화면 레이어 파일이 어댑터를 «직접 인덱싱하지» 않는다", () => {
    // 인덱싱은 반드시 isPlatformCommerce() 를 통과한 뒤에만 한다.
    const code = codeOnly(REGISTRY);
    expect(code).toContain("isPlatformCommerce(id) ? PLATFORM_ADAPTERS[id].label");
  });

  it("탭 키와 커머스 식별자가 같은 글자다", () => {
    const workspace = readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8");
    expect(codeOnly(workspace)).toContain("const LOTTEON_TAB = LOTTEON_COMMERCE_ID;");
  });
});

describe("④ 선택기 — 고르는 것은 등록이 «아니다»", () => {
  const channel = (over: Partial<RegistrationChannel>): RegistrationChannel => ({
    id: "coupang",
    label: "쿠팡",
    availability: "AVAILABLE",
    state: "READY",
    blockingCount: 0,
    provisional: false,
    requiredTotal: 0,
    ...over,
  });

  it("준비중 채널은 고를 수 없다 — 골라도 갈 곳이 없다", () => {
    expect(isSelectableCommerce(channel({ availability: "COMING_SOON" }))).toBe(false);
    expect(isSelectableCommerce(channel({ availability: "PREVIEW_ONLY" }))).toBe(true);
  });

  it("🔴 준비가 «안 된» 채널도 고를 수 있다 — 채널 독립성이 화면에서 먼저 깨지면 안 된다", () => {
    /* 한 채널이 부족하다고 체크박스를 잠그면 「쿠팡 때문에 스마트스토어도 못
       넣는」 상태가 된다. 부족하다는 사실은 그 줄에 적고, 고르는 것은 막지 않는다. */
    expect(isSelectableCommerce(channel({ state: "BLOCKED", blockingCount: 3 }))).toBe(true);
  });

  it("선택 개수를 사람이 읽는 말로 적는다", () => {
    expect(selectionSummary(0)).toBe("선택된 커머스가 없습니다");
    expect(selectionSummary(2)).toBe("선택 2개");
  });

  it("🔴 하나도 고르지 않으면 다음 단계로 갈 수 없다", () => {
    const source = readFileSync(join(DIR, "CommerceSelector.tsx"), "utf8");
    /* N-06-B — [등록 준비 확인]이 롯데ON 검증을 «실행» 하게 되면서 확인 중에도
       잠긴다. 잠그는 조건이 늘었을 뿐, 0개 선택이면 못 누르는 것은 그대로다. */
    expect(codeOnly(source)).toContain("disabled={selectedCount === 0 || checking}");
  });

  it("🔴 이 화면이 등록을 «하지 않는다» — 등록 경로를 부르지 않는다", () => {
    const code = codeOnly(readFileSync(join(DIR, "CommerceSelector.tsx"), "utf8"));
    for (const forbidden of ["fetch(", "LISTING_EXECUTORS", "/register"]) {
      expect(code, `선택기가 ${forbidden} 를 건드린다`).not.toContain(forbidden);
    }
  });
});

describe("⑤ 선택 상태는 저장하지 «않는다» (CPO 확정 ② ㉮)", () => {
  it("workspace 저장 본문에 선택이 들어가지 않는다", () => {
    const page = readFileSync(join(DIR, "../page.tsx"), "utf8");
    expect(page).not.toContain("selectedCommerces");
    expect(page).not.toContain("registrationSelection");
  });

  it("스냅샷 타입에도 자리를 만들지 않았다 — migration 0", () => {
    const types = readFileSync(join(DIR, "../../api/snapshots/_lib/types.ts"), "utf8");
    expect(types).not.toContain("selectedCommerces");
    expect(types).not.toContain("registrationSelection");
  });

  it("빈 상태로 시작한다 — 고른 적 없는 채널로 등록이 나가지 않는다", () => {
    const workspace = codeOnly(readFileSync(join(DIR, "../CommerceWorkspace.tsx"), "utf8"));
    expect(workspace).toContain("useState<CommerceId[]>([])");
  });
});
