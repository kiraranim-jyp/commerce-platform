import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RegistrationStatusBanner } from "../RegistrationStatusBanner";
import { RegistrationReadinessCard } from "../RegistrationReadinessCard";
import type { PriorityItem } from "../readiness-state";
import type { ReadinessItem } from "../readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REG-SUMMARY-OWNERSHIP-01 — **같은 사실을 두 자리가 말하지 않는다.**
 * (CPO 「안 ①」 확정, 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── CEO 가 본 것 ──────────────────────────────────────────────────────────
 *     상단   남은 항목 2개 · 대표이미지 · 원산지 직접입력
 *     하단   ✗ 고시정보 └ 원산지 직접입력
 *            ✗ 채널 필수정보 └ 대표이미지
 * 같은 사실이 두 번 나온다.
 *
 * ── 🔴 원인은 「중복」이 아니라 「상단이 하나만 말했다」 다 ────────────────
 * 상단은 `const [first] = priorityItems` 로 **첫 항목만** 그렸다. 그런데 라벨은
 * 「2개」라고 세고 있었다. 그래서 둘째 항목을 설명하는 곳이 화면에 없었고, 그
 * 공백을 하단의 「막는 필드 펴기」(CEO 지시 2026-09-22)가 메우고 있었다.
 *
 * 🔴 그 지시를 **폐기하지 않는다.** 「막는 필드의 이름을 알려라」는 유효하고,
 * 바뀐 것은 **소유 화면** 이다 — 상단이 전부를 말하고 하단은 자리 ✓/✗ 만 한다.
 *
 * ── 🔴 이 파일이 막는 재작업 ──────────────────────────────────────────────
 * 하단만 걷어내면 둘째 항목의 해결 방법이 사라진다. 그 상태가 배포되지 않도록
 * **상단이 전부를 그린다는 것을 먼저 DOM 으로 증명** 한다(CPO 지시).
 * 그래서 아래 ①이 ②보다 먼저 온다 — 순서가 계약이다.
 */

const item = (over: Partial<PriorityItem> & { key: string; label: string }): PriorityItem => ({
  sourceItems: [],
  ...over,
});

const source = (label: string, over: Partial<ReadinessItem> = {}): ReadinessItem =>
  ({ label, passed: false, required: true, ...over }) as ReadinessItem;

/** CEO 화면을 그대로 본뜬 둘. 🔴 서로 다른 자리로 보내는 둘이어야 의미가 있다. */
const TWO_ITEMS: PriorityItem[] = [
  item({
    key: "legal",
    label: "원산지 직접입력",
    sectionId: "section-notice",
    sourceItems: [source("원산지 직접입력", { group: "LEGAL" })],
  }),
  item({
    key: "product-info",
    label: "대표이미지 확인",
    sectionId: "section-basic",
    sourceItems: [source("대표이미지", { group: "PRODUCT_INFO" })],
  }),
];

const CHECKED: ReadinessItem[] = [source("원산지 직접입력"), source("대표이미지")];

function bannerMarkup(items: PriorityItem[]): string {
  return renderToStaticMarkup(
    createElement(RegistrationStatusBanner, {
      state: "BLOCKED",
      priorityItems: items,
      /* 🔴 onItemClick 이 있어야 [바로가기] 버튼이 선다 — 없으면 이 테스트가
         「버튼이 없다」를 통과시켜 버린다. 화면도 같은 조건으로 렌더한다. */
      onItemClick: () => {},
      checkedItems: CHECKED,
    }),
  );
}

describe("① 🔴 상단이 남은 항목 «전부» 를 소유한다", () => {
  const markup = bannerMarkup(TWO_ITEMS);

  it("🔴 공허 방지 — 두 항목이 서로 다르고 마크업이 비어 있지 않다", () => {
    expect(TWO_ITEMS[0]!.label).not.toBe(TWO_ITEMS[1]!.label);
    expect(markup.length).toBeGreaterThan(200);
  });

  it("🔴 두 항목의 «이름» 이 둘 다 있다 — 하나만 그리던 것이 이 결함이었다", () => {
    for (const expected of ["원산지 직접입력", "대표이미지 확인"]) {
      expect(markup, `${expected} 가 상단에 없다`).toContain(expected);
    }
  });

  it("두 항목 각각에 「무엇이 비어 있는가」가 붙는다", () => {
    expect(markup).toContain("비어 있는 항목: 원산지 직접입력");
    expect(markup).toContain("비어 있는 항목: 대표이미지");
  });

  it("두 항목 각각에 「어디서 고치는가」가 붙는다 — 자리가 서로 다르다", () => {
    expect(markup).toContain("「고시정보」에서 입력합니다");
    expect(markup).toContain("「기본정보」에서 입력합니다");
  });

  it("🔴 [바로가기] 버튼이 «두 개» 다 — 하나면 둘째는 갈 곳이 없다", () => {
    const buttons = markup.match(/<button/g) ?? [];
    expect(buttons.length).toBe(2);
    expect(markup).toContain("「고시정보」에서 입력하기 →");
    expect(markup).toContain("「기본정보」에서 입력하기 →");
  });

  it("항목이 셋이면 셋 다 그린다 — 상한을 두지 않았다", () => {
    const three = [...TWO_ITEMS, item({ key: "category", label: "카테고리 확인", sectionId: "section-category", sourceItems: [source("카테고리")] })];
    const m = bannerMarkup(three);
    expect((m.match(/<button/g) ?? []).length).toBe(3);
    expect(m).toContain("카테고리 확인");
  });

  it("🔴 번호(①②)를 박지 않는다 — priorityItems 는 «묶음» 이라 라벨의 N 과 어긋난다", () => {
    /* buildPriorityItems 가 LEGAL 여러 개를 `legal` 하나로 접는다. 「2개」 아래에
       ①만 서는 일이 생기므로 번호를 쓰지 않는다. 집계 규칙도 바꾸지 않았다. */
    expect(markup).not.toContain("①");
    expect(markup).not.toContain("②");
  });

  it("남은 항목이 없으면 그 블록이 아예 서지 않는다", () => {
    expect(bannerMarkup([])).not.toContain("남은 항목");
  });
});

describe("② 🔴 하단은 «자리 단위» 만 말한다 — 필드명을 다시 나열하지 않는다", () => {
  const markup = renderToStaticMarkup(
    createElement(RegistrationReadinessCard, {
      required: [
        source("원산지 직접입력", { group: "LEGAL", sectionId: "section-notice", hint: "원산지를 확인하지 못했습니다." }),
        source("카테고리", { passed: true, group: "LEGAL", sectionId: "section-category" }),
      ],
      allRequiredPassed: false,
      status: null,
      onRegister: () => {},
    } as never),
  );

  it("🔴 공허 방지 — 카드가 실제로 렌더됐고 «자리» 이름이 보인다", () => {
    expect(markup).toContain("필수 확인");
    /* 자리 이름이 없으면 아래 not.toContain 이 전부 참이 되어 공허해진다. */
    expect(markup).toContain("고시정보");
  });

  it("🔴 막는 «필드» 이름이 하단에 없다 — 상단이 그것을 소유한다", () => {
    expect(markup, "하단이 필드명을 다시 나열한다 — 중복이다").not.toContain("원산지 직접입력");
  });

  it("🔴 접힌 개수 표시(「외 N개」)도 없다 — 목록이 아니기 때문이다", () => {
    expect(markup).not.toContain("외 ");
  });
});
