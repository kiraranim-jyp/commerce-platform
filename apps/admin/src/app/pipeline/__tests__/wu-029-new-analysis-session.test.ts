import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-029 — **A → B → C 연속 분석이 끊기지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **먼저 전제를 정정한다.** 「＋ 새 상품 분석이 없다」는 관찰은 화면에서는
 *    맞았지만 코드에서는 **틀렸다** — 버튼은 처음부터 `pipeline/page.tsx` 의
 *    `PageHeader actions` 에 있었고(`resetWorkspace`), 리셋 함수도 A→B 를 위해
 *    세대(generation)까지 올리도록 설계돼 있었다.
 *
 * 🔴 실제 결함은 **둘** 이었고 둘 다 이 파일이 잠근다:
 * ```
 * ① 닿을 수 없다 — 결과 화면이 길어 버튼이 스크롤 밖으로 사라진다
 * ② 오염된다   — resetWorkspace 가 «상품별» state 넷을 빠뜨려 A 의 값이
 *                 B 의 **스냅샷에 저장** 된다(화면이 아니라 서버 기록이다)
 * ```
 *
 * 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5).
 */

const PAGE = readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

/** `resetWorkspace` 본문만 잘라 낸다 — 바깥의 다른 `setX` 에 속지 않기 위해서다. */
const RESET_BODY = (() => {
  const start = PAGE.indexOf("function resetWorkspace()");
  expect(start).toBeGreaterThan(-1);
  const rest = PAGE.slice(start);
  return rest.slice(0, rest.indexOf("\n  }") + 4);
})();

/* ══════════════ ① 🔴 행동이 «닿는다» ══════════════ */

describe("① 새 상품 분석은 결과가 아무리 길어도 닿을 수 있다", () => {
  it("버튼은 이미 있었다 — 새로 만들지 않았다", () => {
    expect(PAGE).toContain("새 상품 분석");
    expect(PAGE).toContain("onClick={resetWorkspace}");
    /** 🔴 행동 통로는 **하나** 다. 같은 라벨이 두 곳에 있으면 상태가 갈린다. */
    expect((PAGE.match(/새 상품 분석/g) ?? [])).toHaveLength(1);
  });

  it("🔴 그 머리글이 화면에 붙어 있다(sticky) — 그래야 스크롤 뒤에도 보인다", () => {
    expect(PAGE).toMatch(/<PageHeader[\s\S]{0,400}?sticky/);
  });

  it("PageHeader 의 sticky 는 **선택** 이고 기본은 꺼져 있다(다른 화면 영향 0)", () => {
    const plain = renderToStaticMarkup(PageHeader({ title: "x" }) as never);
    const stuck = renderToStaticMarkup(PageHeader({ title: "x", sticky: true }) as never);
    expect(plain).not.toContain("sticky");
    expect(stuck).toContain("sticky top-0");
  });

  it("분석이 시작된 뒤에만 보인다(빈 화면에 리셋 버튼을 세우지 않는다)", () => {
    expect(PAGE).toContain("const started = loading || result !== null;");
    expect(PAGE).toMatch(/started \? \([\s\S]{0,600}새 상품 분석/);
  });
});

/* ══════════════ ② 🔴🔴 A 의 값이 B 로 넘어가지 않는다 ══════════════ */

describe("② 상품별 state 는 전부 리셋된다 — 서버 기록 오염 금지", () => {
  /**
   * 🔴 **스냅샷에 저장되는 값** 부터 본다. 이 둘이 리셋되지 않아서
   *    「B 의 스냅샷에 A 의 카테고리/상세 override 가 저장되는」 상태였다.
   */
  it.each([
    ["setCategoryMappings", "채널별 카테고리 — 스냅샷에 저장된다"],
    ["setDetailOverride", "상품별 상세페이지 override — 스냅샷에 저장된다"],
    ["setUrl", "원본 URL"],
    ["setMarketCategoryId", "조사 카테고리 — 스냅샷에 저장된다"],
    ["setProduct", "정규화 상품"],
    ["setResult", "분석 결과"],
    ["setItems", "이미지 작업본"],
    ["setSnapshotId", "스냅샷 식별자"],
    ["setProductId", "상품 식별자"],
    ["setJobKey", "작업 키"],
    ["setSnapshotStatus", "등록 상태"],
    ["setFailure", "실패 배너"],
    ["setAnalysisStartedAt", "분석 시작 시각"],
    ["setActiveTab", "열려 있던 탭"],
    ["setRepresentativeId", "대표 이미지"],
    ["setProgressLog", "진행 로그"],
  ])("%s 가 리셋된다 (%s)", (setter) => {
    expect(RESET_BODY).toContain(`${setter}(`);
  });

  /**
   * 🔴 **반대 방향도 잠근다.** 상품에 속하지 않은 값까지 지우면 B 가 카테고리를
   *    고르지 못하거나 화면이 다시 로딩 상태로 떨어진다 — 과잉 리셋도 결함이다.
   */
  it.each(["setMarketCategories", "setHydrated", "setDeveloperMode"])(
    "%s 는 리셋하지 «않는다»(상품에 속한 값이 아니다)",
    (setter) => {
      expect(RESET_BODY).not.toContain(`${setter}(`);
    },
  );

  /** 🔴 서버 데이터를 지우지 않는다 — 「새 상품」은 작업 context 교체이지 삭제가 아니다. */
  it("리셋이 서버 데이터를 지우지 않는다(DELETE/삭제 호출 0)", () => {
    expect(RESET_BODY).not.toMatch(/fetch\(|DELETE|deleteSnapshot|remove\(/);
    /** 🟢 지우는 것은 **브라우저 세션 저장소** 뿐이다. */
    expect(RESET_BODY).toContain("sessionStorage.removeItem");
  });

  /**
   * 🔴 A 의 늦은 응답이 B 를 덮어쓰지 않게 하는 **세대 올리기** 가 그대로 있다.
   *    이것이 없으면 A 의 저장 응답이 B 의 스냅샷 id 를 덮어쓴다(기존 설계).
   */
  it("세대를 올리고 저장 lock 을 푼다 — A 의 늦은 응답이 B 를 덮지 않는다", () => {
    expect(RESET_BODY).toContain("sessionGenerationRef.current += 1");
    expect(RESET_BODY).toContain("snapshotIdRef.current = null");
    expect(RESET_BODY).toContain("creatingSnapshotRef.current = false");
  });

  /** 🔴 `?resume=` 가 남으면 새로고침이 방금 리셋한 화면을 되살린다. */
  it("resume 쿼리를 URL 에서 지운다", () => {
    expect(RESET_BODY).toContain('url.searchParams.delete("resume")');
  });
});

/* ══════════════ ③ 🔴 저장 payload 와 리셋 목록이 어긋나지 않는다 ══════════════ */

describe("③ 스냅샷에 저장되는 «상품별» 값은 전부 리셋 목록에 있다", () => {
  /**
   * 🔴🔴 이것이 이번 결함의 **근본 형태** 다 — 「저장되는 값」과 「리셋되는 값」이
   *    따로 자라면서 둘이 갈라졌다. 그래서 두 목록을 **같은 테스트에서** 맞댄다.
   */
  const SAVED_PRODUCT_SCOPED: { field: string; setter: string }[] = [
    { field: "categoryMappings", setter: "setCategoryMappings" },
    { field: "detailOverride", setter: "setDetailOverride" },
    { field: "representativeId", setter: "setRepresentativeId" },
    { field: "marketCategoryProfileId", setter: "setMarketCategoryId" },
  ];

  it.each(SAVED_PRODUCT_SCOPED)("저장되는 $field 는 리셋된다", ({ field, setter }) => {
    /** 🟢 실제로 저장 payload 에 실리는지 먼저 확인한다(없는 것을 잠그지 않는다). */
    const save = PAGE.slice(PAGE.indexOf("workspace: {"));
    expect(save.slice(0, save.indexOf("}),"))).toContain(field);
    expect(RESET_BODY).toContain(`${setter}(`);
  });
});

/* ══════════════ ④ 🔴 WU-028 결과 표시가 접힘 «밖» 에 선다 ══════════════ */

describe("④ 직접 입력 후보 결과를 보려고 되물음을 펼치지 않아도 된다", () => {
  const PANEL = readFileSync(
    path.join(__dirname, "..", "commerce", "DomesticPriceIntelligencePanel.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /**
   * 🔴🔴 **「뒤에 있다」로 단언하면 속는다.** 처음엔 위치(index)만 비교했는데,
   *    변이(M5)가 구역을 **접힘 블록 뒤에 둔 채로 `showMarketDetail &&` 로 감싸서**
   *    통과했다 — 위치는 밖인데 조건은 안이었다. 🟢 그래서 **접힘이 닫힌 뒤 구간에
   *    그 조건이 한 번도 나오지 않는 것** 을 단언한다(술어까지 잠근다).
   */
  it("두 일시 후보 구역이 접힘 «조건 밖» 에 있다", () => {
    const collapseAt = PANEL.indexOf("{showMarketDetail && (");
    expect(collapseAt).toBeGreaterThan(-1);
    const closeAt = PANEL.indexOf("\n        )}", collapseAt);
    expect(closeAt).toBeGreaterThan(collapseAt);
    const afterCollapse = PANEL.slice(closeAt);
    expect(afterCollapse).toContain("<TransientCandidateSections");
    /** 🔴 닫힌 뒤에는 그 조건이 **다시 나오지 않는다** — 나오면 또 접힘 안이다. */
    expect(afterCollapse).not.toContain("showMarketDetail");
  });

  /** 🟢 **입력칸은 접힘 안에 그대로 둔다** — 행동이지 결론이 아니다(첫 화면 계약 보존). */
  it("입력칸은 여전히 되물음 안에 있다", () => {
    const collapseAt = PANEL.indexOf("{showMarketDetail && (");
    const inputAt = PANEL.indexOf('data-testid="wu024-candidate-urls"');
    const sectionAt = PANEL.indexOf("<TransientCandidateSections");
    expect(inputAt).toBeGreaterThan(collapseAt);
    expect(inputAt).toBeLessThan(sectionAt);
  });
});
