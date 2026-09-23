import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { channelActionLabel, type RegistrationChannel } from "../registration-channels";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-C(CPO 승인, 2026-09-23) — **「확인 2건」에서 끝내지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 셀러가 Master 에서 「쿠팡 확인 2건」을 보고 나면, 그 다음에 하는 일은 쿠팡 탭을
 * 열고 열한 개 섹션을 처음부터 다시 읽는 것이었다. 무엇이 비었는지 «이름» 이
 * 없었기 때문이다.
 *
 * 🔴 새 판정도 새 저장소도 만들지 않았다. 채널 검증이 이미 만든 값
 * (priorityItems · buildLotteOnMissingInfo)에 「어느 커머스의」만 한 겹 붙였다.
 */

const DIR = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(DIR, relative), "utf8");
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(read("../CommerceWorkspace.tsx"));
const SELECTOR = codeOnly(read("CommerceSelector.tsx"));

describe("① 부족 항목에 «출처» 가 붙는다 (C-1)", () => {
  it("채널 검증이 만든 목록을 그대로 감싼다 — 새 판정이 없다", () => {
    expect(WORKSPACE).toContain("const missingByCommerce = useMemo(");
    expect(WORKSPACE).toContain("mergedReadiness[id]?.priorityItems ?? []");
    // 목록을 다시 계산하는 경로가 생기지 않았다.
    expect(WORKSPACE).not.toContain("buildPriorityItems(summary, priceValid, \"section-notice\")");
  });

  it("🔴 키가 채널별로 갈린다 — 두 채널에 같은 항목이 있어도 섞이지 않는다", () => {
    expect(WORKSPACE).toContain("key: `${id}:${item.key}`");
    expect(WORKSPACE).toContain("key: `lotteon:${item.key}`");
  });

  it("이동 목적지(sectionId)를 잃지 않고 옮긴다", () => {
    expect(WORKSPACE).toContain("sectionId: item.sectionId");
    expect(WORKSPACE).toContain("externalHref: item.externalHref");
  });
});

describe("② 그 자리로 «데려간다» (C-2)", () => {
  it("채널 탭을 열고 섹션까지 스크롤한다", () => {
    const fn = WORKSPACE.slice(WORKSPACE.indexOf("function requestFix("), WORKSPACE.indexOf("useEffect(() => {\n    if (!fixScrollRequest)"));
    expect(fn).toContain("setTab(item.commerceId)");
    expect(fn).toContain("setFixScrollRequest(item.sectionId ?? null)");
  });

  it("🔴 탭을 옮긴 «뒤» 에 스크롤한다 — 그 화면은 아직 DOM 에 없다", () => {
    expect(WORKSPACE).toContain("document.getElementById(fixScrollRequest)?.scrollIntoView");
    expect(WORKSPACE).toContain("}, [fixScrollRequest, tab]);");
  });

  it("설정 화면에서만 고칠 수 있는 항목은 그쪽으로 보낸다", () => {
    expect(WORKSPACE).toContain("if (item.externalHref)");
  });

  it("선택기가 항목 이름과 [바로 수정]을 그린다", () => {
    expect(SELECTOR).toContain("바로 수정");
    expect(SELECTOR).toContain("onFixRequest(item)");
  });

  it("🔴 고른 채널만 펼친다 — 안 고른 채널의 목록이 화면을 덮지 않는다", () => {
    expect(SELECTOR).toContain("checked && (missingByCommerce?.[channel.id]?.length ?? 0) > 0");
  });

  it("다 못 적으면 «외 N건» 이라고 말한다 — 숨기지 않는다", () => {
    expect(SELECTOR).toContain("외 {missingByCommerce![channel.id]!.length - MISSING_PREVIEW_COUNT}건");
  });
});

describe("③ 롯데ON 도 같은 모양이다 (C-3)", () => {
  it("기존 검증 함수를 그대로 쓴다 — 새 검증을 만들지 않았다", () => {
    expect(WORKSPACE).toContain("const missing = buildLotteOnMissingInfo(validation);");
    expect(WORKSPACE).toContain("setLotteOnMissing(");
  });

  it("🔴 공통 상품정보에서 고쳐야 하는 항목은 롯데ON 섹션으로 보내지 않는다", () => {
    // where === "COMMON_PRODUCT" 면 그 탭에는 고칠 칸이 없다(읽기 전용이다).
    expect(WORKSPACE).toContain('item.where === "COMMON_PRODUCT" ? undefined : item.sectionId');
  });
});

describe("④ 단계마다 버튼이 «그 자리에서 일어나는 일» 을 적는다 (C-4)", () => {
  const channel = (over: Partial<RegistrationChannel> = {}): RegistrationChannel => ({
    id: "coupang",
    label: "쿠팡",
    availability: "AVAILABLE",
    state: "READY",
    blockingCount: 0,
    provisional: false,
    requiredTotal: 0,
    ...over,
  });

  it("③ 등록 준비에서는 «확인하기» — 누르면 탭으로 갈 뿐이다", () => {
    expect(channelActionLabel(channel(), "CHECK")).toBe("쿠팡 확인하기");
  });

  it("④ 커머스 등록에서는 «등록» — 실제로 나간다", () => {
    expect(channelActionLabel(channel(), "REGISTER")).toBe("쿠팡 등록");
  });

  it("기본값은 기존 그대로다 — 호출부를 다 고치지 않아도 동작이 안 바뀐다", () => {
    expect(channelActionLabel(channel())).toBe("쿠팡 등록");
  });

  it("준비중 채널은 단계와 무관하게 «준비중»", () => {
    const soon = channel({ availability: "COMING_SOON", label: "11번가" });
    expect(channelActionLabel(soon, "CHECK")).toBe("11번가 준비중");
    expect(channelActionLabel(soon, "REGISTER")).toBe("11번가 준비중");
  });

  it("화면이 단계로 문구를 고른다", () => {
    expect(WORKSPACE).toContain('workflow.currentStepKey === "COMMERCE_REGISTERING" ? "REGISTER" : "CHECK"');
  });
});

describe("⑤ 저장 구조는 그대로다", () => {
  it("DB·snapshot 에 새 칸을 만들지 않았다", () => {
    const types = readFileSync(join(DIR, "../../api/snapshots/_lib/types.ts"), "utf8");
    for (const forbidden of ["missingByCommerce", "commerceMissing", "fixRequest"]) {
      expect(types).not.toContain(forbidden);
    }
  });
});
