// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ListingConfirmationModal } from "../ListingConfirmationModal";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P1-8(CPO ⑨, 2026-10-09) — **판매 전 최종확인은 세 채널이 «같은» 계약이다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🟢 먼저 조사 결과를 적는다 — 「공통화」는 이미 돼 있었다 ───────────────
 * CPO ⑨ 는 「커머스마다 최종확인 화면이 다르다」를 전제로 공통화를 지시했다.
 * 실제 코드는 그렇지 않았다:
 *
 *   ListingConfirmationModal   REWORK-7 ⑤ — 세 채널이 «같은 컴포넌트»
 *   ChannelRegistrationFrame   REWORK-2  — 세 채널이 «같은 골격»
 *   RegistrationReadinessCard  REWORK-2  — 세 채널이 «같은 판정 카드»
 *
 * ── 🔴 그래서 «실제로» 달랐던 것 하나 ─────────────────────────────────────
 * 모달은 P0-KC-08 에서 `readinessBlockers` 를 받아 「열린 것 ≠ 등록해도 되는
 * 것」을 자기 안에서 한 번 더 판정한다. 스마트스토어·쿠팡 경로는 그 값을
 * 넘겼고 **롯데ON 경로는 넘기지 않았다** — `?? []` 로 내려가 readinessOk 가
 * 항상 true 였다. 조용히 꺼진 가드다.
 *
 * ── 🔴 CPO 지시 중 «하지 않은» 것 ─────────────────────────────────────────
 * ⑨ 는 모달 안에 상품정보·옵션·가격·상세페이지·필수정보·태그·인증KC·모델명
 * 체크리스트를 세우라고 적었다. 그 목록은 **N-3.58 STEP5(CPO 지시)가 일부러
 * 걷어낸 것**이다 — 「최종 등록 모달은 약관 동의처럼 단순하게」이고, 이 화면이
 * 열리는 시점엔 상위 게이트(canRegister)가 그 필드들을 이미 통과시켰으므로
 * 다시 나열하는 것이 중복이었다.
 *
 * 🔴 두 CPO 지시가 정면으로 어긋난다. CTO 가 한쪽을 조용히 되돌리지 않는다 —
 *    이번에는 「세 채널 계약 일치」만 하고, 체크리스트 복원은 CPO 결정 항목으로
 *    남긴다. 이 블록(③)이 그 경계를 못으로 박는다: 체크리스트를 되돌리려면
 *    이 테스트를 «의도적으로» 고쳐야 한다.
 */

const LISTING = {
  platformLabel: "롯데ON",
  title: "아동용 반바지",
  priceKrw: 39000,
  priceSource: "SELLER_OVERRIDE" as const,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(props: Record<string, unknown>): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ListingConfirmationModal, {
        listing: LISTING,
        mode: "LIVE",
        onCancel: () => {},
        onConfirm: () => {},
        ...props,
      } as never),
    );
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}
/** 모든 체크박스를 셀러처럼 «실제로» 누른다 — 그래야 남은 가드가 blockers 뿐이다. */
async function checkEverything(): Promise<void> {
  const boxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  for (const box of boxes) {
    await act(async () => box.click());
  }
}
function confirmButton(): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button"));
  const found = buttons.find((b) => /등록|확인하고/.test(b.textContent ?? "") && !/취소/.test(b.textContent ?? ""));
  if (!found) throw new Error(`확인 버튼이 없다 — 버튼: ${buttons.map((b) => b.textContent).join(" / ")}`);
  return found as HTMLButtonElement;
}

describe("① 🔴 미비가 있으면 모든 체크를 눌러도 등록이 잠긴다", () => {
  it("blockers 가 있으면 확인 버튼이 disabled 다", async () => {
    await mount({ readinessBlockers: ["고시정보 — 제조국", "대표이미지"] });
    await checkEverything();
    expect(confirmButton().disabled, "미비가 있는데 등록이 열렸다").toBe(true);
  });

  it("무엇이 막고 있는지 화면이 «적는다»", async () => {
    await mount({ readinessBlockers: ["고시정보 — 제조국", "대표이미지"] });
    const t = text();
    expect(t).toContain("아직 등록할 수 없습니다");
    expect(t).toContain("고시정보 — 제조국");
    expect(t).toContain("대표이미지");
  });

  it("🔴 대조군 — 미비가 없으면 같은 조작으로 열린다", async () => {
    await mount({ readinessBlockers: [] });
    await checkEverything();
    expect(confirmButton().disabled, "미비가 없는데 등록이 잠겼다 — 가드가 과하다").toBe(false);
  });

  it("🔴 넘기지 «않으면» 가드가 꺼진다 — 롯데ON 이 그 상태였다", async () => {
    /* 이 테스트는 결함의 «모양» 을 고정한다. prop 을 빼면 readinessOk 가 항상
       true 라, 미비가 있어도 등록이 열린다. 그래서 호출부 전수(② 블록)가 필요하다. */
    await mount({});
    await checkEverything();
    expect(confirmButton().disabled).toBe(false);
  });
});

describe("② 🔴 세 채널 호출부가 «전부» 같은 계약을 넘긴다", () => {
  const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const CALLERS = [
    ["CommerceWorkspace.tsx (스마트스토어 · 쿠팡 · 다중)", join(__dirname, "../../CommerceWorkspace.tsx")],
    ["LotteOnRegistrationPanel.tsx (롯데ON)", join(__dirname, "../LotteOnRegistrationPanel.tsx")],
  ] as const;

  it.each(CALLERS)("%s 가 readinessBlockers 를 넘긴다", (_name, path) => {
    const src = strip(readFileSync(path, "utf8"));
    const at = src.indexOf("<ListingConfirmationModal");
    expect(at, "모달 호출부가 없다").toBeGreaterThan(-1);
    expect(src.slice(at, at + 3000), "이 경로만 모달 안 가드가 꺼진다").toContain("readinessBlockers=");
  });

  it("🔴 호출부가 둘뿐이다 — 새 호출부가 생기면 이 목록도 같이 늘어야 한다", () => {
    const all = [
      join(__dirname, "../../CommerceWorkspace.tsx"),
      join(__dirname, "../LotteOnRegistrationPanel.tsx"),
      join(__dirname, "../KcSellerStatusBanner.tsx"),
      join(__dirname, "../PlatformPreview.tsx"),
      join(__dirname, "../ChannelRegistrationFrame.tsx"),
      join(__dirname, "../RegistrationReadinessCard.tsx"),
    ];
    const mounts = all.filter((p) => strip(readFileSync(p, "utf8")).includes("<ListingConfirmationModal"));
    expect(mounts).toHaveLength(2);
  });

  it("🔴 롯데ON 은 «상위 N건» 목록이 아니라 실패 전수를 넘긴다", () => {
    const src = strip(readFileSync(join(__dirname, "../LotteOnRegistrationPanel.tsx"), "utf8"));
    const at = src.indexOf("readinessBlockers=");
    const line = src.slice(at, at + 200);
    /* priorityItems 는 상위 몇 건으로 잘린 목록이다 — 그것으로 게이트를 세우면
       잘려 나간 미비가 통과한다. readinessItems(서버 검증 전수)를 써야 한다. */
    expect(line).toContain("readinessItems");
    expect(line).not.toContain("priorityItems");
  });

  it("판정을 새로 만들지 않았다 — 서버 검증 결과를 그대로 센다", () => {
    const src = readFileSync(join(__dirname, "../LotteOnRegistrationPanel.tsx"), "utf8");
    expect(src).toContain("(validation?.fields ?? []).map((field) => ({");
  });
});

describe("③ 🔴 N-3.58 STEP5 를 되돌리지 «않았다» — 체크리스트는 CPO 결정 항목이다", () => {
  const MODAL = readFileSync(join(__dirname, "../ListingConfirmationModal.tsx"), "utf8");

  it("모달이 여전히 세 채널 공용이다 — ListingModel 네 칸만 요구한다", () => {
    expect(MODAL).toContain(
      'listing: Pick<ListingModel, "platformLabel" | "title" | "priceKrw" | "priceSource">;',
    );
  });

  it("🔴 필드별 체크리스트를 되살리지 않았다 — 체크박스는 책임 확인용 몇 개뿐이다", async () => {
    await mount({ readinessBlockers: [] });
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length, `체크박스 ${boxes.length}개 — 필드 목록이 돌아왔다`).toBeLessThanOrEqual(4);
  });

  it("「등록 대상 Commerce」는 이미 보인다 — platformLabel 이 그 자리다", async () => {
    await mount({ listing: { ...LISTING, platformLabel: "선택한 커머스 2곳 (스마트스토어 · 쿠팡)" } });
    expect(text()).toContain("선택한 커머스 2곳 (스마트스토어 · 쿠팡)");
  });

  it("판매가격도 이미 보인다", async () => {
    await mount({ readinessBlockers: [] });
    expect(text()).toContain("39,000");
  });
});
