/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-IDENTITY-REVIEW-COMPLETION-02 — **비교목록표가 «화면에» 선다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유** — REV-01 은 선택기(`selectReviewQueue`)까지였고 CPO 판정이
 *    이랬다: 「**선택기를 만든 것과 사용자가 실제로 비교목록표를 쓰는 것은 전혀 다른
 *    단계**」. 🔴 그래서 여기서는 **함수를 부르는 것으로 완료를 선언하지 않는다** —
 *    `MarketPriceComparison` 을 **마운트해서 DOM 으로** 잰다(헌장 §5: Render PASS ≠ 소스 PASS).
 *
 * 🔴 입력은 **운영 저장분**(`mi-final-e2e-01.json` — 스냅샷 `25a3bba7` · 후보 10)이다.
 *    fixture 조작 0 · 판정 라벨 변경 0 · 새 후보 생성 0.
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    이것은 **마운트 DOM 축** 이고 최종 판정은 CEO 1회다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_LIST_HEADING,
  REVIEW_CANDIDATE_VALUE_NOT_IN_RESPONSE,
  REVIEW_COMPARE_AXES,
  REVIEW_COMPARE_AXIS_LABEL,
  REVIEW_OPEN_PAGE_TEXT,
  REVIEW_QUEUE_EMPTY,
  REVIEW_QUEUE_HEADING,
  REVIEW_QUEUE_NOTE,
  REVIEW_UNRESOLVED_MARKET_HEADING,
  REVIEW_VALUE_UNKNOWN,
  selectReviewQueue,
  type OriginIdentity,
} from "../mi-same-candidates";
import { DESCRIPTION_EVIDENCE_SCOPE } from "../origin-description-evidence";
/** 🔴 판정 어휘를 테스트가 **지어내지 않는다** — 운영과 같은 맵을 읽는다. */
import {
  HUMAN_REVIEW_BUTTON,
  HUMAN_REVIEW_VALUES,
  SAVE_STATE_TEXT,
} from "../GeminiTransientCandidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import { toSavedCandidateRows } from "../../../api/price-history/_lib/saved-candidate-rows";
import { candidateReviewRowFromDb } from "../../../api/price-history/_lib/candidate-review";

const FIX = join(
  __dirname,
  "..",
  "..",
  "..",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "mi-final-e2e-01.json",
);

interface Fixture {
  snapshot: {
    id: string;
    title: string;
    brand: { value: string };
    sku: { value: string };
  };
  candidateReviews: Record<string, unknown>[];
}

const fixture = (): Fixture => JSON.parse(readFileSync(FIX, "utf8")) as Fixture;

/** 🔴 **운영 복원 경로 그대로** — 손으로 행을 만들지 않는다(§5-B ownerGate 와 같은 이유). */
const realRows = (): GeminiTransientRow[] =>
  toSavedCandidateRows(
    fixture().candidateReviews.map((r) => candidateReviewRowFromDb(r)),
  ) as GeminiTransientRow[];

/** 🟢 원상품 세 칸도 **그 스냅샷이 들고 있는 값** 이다 — 지어내지 않는다. */
const realOrigin = (): OriginIdentity => {
  const s = fixture().snapshot;
  return { brand: s.brand.value, modelCode: s.sku.value, title: s.title, description: null };
};

let mounted: { host: HTMLElement; cleanup: () => void } | null = null;

function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(MarketPriceComparison, { snapshotId: fixture().snapshot.id, ...props }),
    );
  });
  mounted = {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
  return host;
}

afterEach(() => {
  mounted?.cleanup();
  mounted = null;
});

const q = (host: HTMLElement, sel: string) => [...host.querySelectorAll(sel)];
const text = (el: Element | null) => el?.textContent ?? "";

/* ════════════════════════════════════════════════════════════════════════════
 * A. 🟢 실데이터 — **검토 대상 8건** 이 화면에 선다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 A — 실데이터가 비교목록표에 오른다", () => {
  /**
   * 🔴 분모를 **먼저** 잠근다 — 후보 10 중 확정 `SAME` 2건(bonbonverona · mariodannakids)은
   *    자동 판정이 끝났으므로 검토 대기에 들지 않는다 ⟹ **10 − 2 = 8**.
   * 🔴 이 수가 흔들리면 「8건이 떴다」가 아무 뜻도 없어진다.
   */
  it("A-1 🔴 입력 분모 — 운영 저장분 후보 **10** · 확정 SAME **2**", () => {
    const rows = realRows();
    expect(rows, "🔴 입력 분모가 10 이 아니다").toHaveLength(10);
    const same = rows.filter((r) => r.priceTier === "EXACT" && r.crossSellerVerdict === "SAME");
    expect(same, "🔴 확정 SAME 이 2건이 아니다").toHaveLength(2);
  });

  it("A-2 🟢🟢 **마운트한 DOM 에 검토 행이 8개** 다(선택기 호출이 아니라 화면이다)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    expect(q(host, '[data-testid="mi-review-row"]'), "🔴 화면에 검토 행이 8개가 아니다").toHaveLength(
      8,
    );
  });

  it("A-3 🟢 머리말이 **전체 축의 건수** 를 말한다(필터와 무관하게 흔들리지 않는다)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const summary = text(host.querySelector('[data-testid="mi-review-queue-summary"]'));
    expect(summary).toContain(REVIEW_QUEUE_HEADING);
    expect(summary, "🔴 건수가 화면에 없다").toContain("8");
  });

  it("A-4 🔴 **확정 SAME 은 검토 행에 없다** — 자동 판정이 끝난 것을 다시 묻지 않는다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const body = q(host, '[data-testid="mi-review-row"]')
      .map((r) => text(r))
      .join("\n");
    for (const banned of ["bonbonverona", "mariodannakids"]) {
      expect(body, `🔴 확정 SAME 후보가 검토 행에 있다: ${banned}`).not.toContain(banned);
    }
  });

  it("A-5 🟢 선택기와 화면이 **같은 수** 를 본다(복제 계산 0)", () => {
    const rows = realRows();
    const host = mount({ rows, originIdentity: realOrigin() });
    expect(q(host, '[data-testid="mi-review-row"]').length).toBe(selectReviewQueue(rows, "ALL").length);
  });

  it("A-6 🔴 사유 칠(chip)이 **행마다** 선다 — 「왜 자동으로 못 닫혔나」가 비어 있지 않다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    for (const row of q(host, '[data-testid="mi-review-row"]')) {
      expect(
        row.querySelectorAll('[data-testid="mi-review-reason"]').length,
        "🔴 사유 없는 검토 행이 있다",
      ).toBeGreaterThan(0);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * B. 🔵 **나란히 비교** — 세 축이 같은 줄에서 원상품 ↔ 후보로 선다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 B — 브랜드·품번·상품명이 나란히 선다", () => {
  it("B-1 🟢 행마다 비교표가 있고 **축이 정확히 세 줄** 이다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const rows = q(host, '[data-testid="mi-review-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.querySelector('[data-testid="mi-review-compare"]'), "🔴 비교표가 없다").not.toBeNull();
      for (const axis of REVIEW_COMPARE_AXES) {
        expect(
          r.querySelector(`[data-testid="mi-review-axis-${axis.toLowerCase()}"]`),
          `🔴 ${axis} 축 줄이 없다`,
        ).not.toBeNull();
      }
    }
  });

  it("B-2 🟢 세 축의 **이름이 화면에 있다**(라벨 owner 는 선택기 파일 하나다)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const t = text(host.querySelector('[data-testid="mi-review-compare"]'));
    for (const axis of REVIEW_COMPARE_AXES) {
      expect(t, `🔴 ${axis} 이름이 없다`).toContain(REVIEW_COMPARE_AXIS_LABEL[axis]);
    }
  });

  it("B-3 🟢🟢 **원상품 값이 실제로 보인다** — 브랜드 「Bobo Choses」 · 상품명", () => {
    const origin = realOrigin();
    const host = mount({ rows: realRows(), originIdentity: origin });
    const t = q(host, '[data-testid="mi-review-origin-value"]')
      .map((e) => text(e))
      .join("\n");
    expect(t, "🔴 원상품 브랜드가 화면에 없다").toContain(origin.brand!);
    expect(t, "🔴 원상품 상품명이 화면에 없다").toContain(origin.title!);
  });

  it("B-4 🔴🔴 **빈 품번을 「없다」로 적지 않는다** — 이 상품의 `sku` 는 실제로 빈 문자열이다", () => {
    const origin = realOrigin();
    expect(origin.modelCode, "🔴 fixture 가 바뀌었다 — 이 단언의 전제가 깨졌다").toBe("");
    const host = mount({ rows: realRows(), originIdentity: origin });
    const codeRow = host.querySelector('[data-testid="mi-review-axis-model_code"]');
    expect(text(codeRow), "🔴 빈 값이 빈 칸으로 나갔다").toContain(REVIEW_VALUE_UNKNOWN);
  });

  it("B-5 🔴🔴 원상품 값이 **아예 없으면** 세 칸이 전부 「확인 불가」다(영역은 선다)", () => {
    const host = mount({ rows: realRows(), originIdentity: null });
    expect(q(host, '[data-testid="mi-review-row"]').length, "🔴 원상품이 없으면 영역이 죽었다").toBe(8);
    const cells = q(host, '[data-testid="mi-review-origin-value"]');
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(text(c)).toBe(REVIEW_VALUE_UNKNOWN);
  });

  it("B-6 🔴🔴 후보 쪽 브랜드·품번 **원값이 없다는 사실을 말한다** — 빈 칸으로 두지 않는다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const t = q(host, '[data-testid="mi-review-candidate-value"]')
      .map((e) => text(e))
      .join("\n");
    expect(t, "🔴 응답에 없다는 사실이 화면에 없다 — 빈 칸이 「후보에 브랜드가 없다」로 읽힌다").toContain(
      REVIEW_CANDIDATE_VALUE_NOT_IN_RESPONSE,
    );
  });

  it("B-7 🟢 후보 **상품명은 행이 들고 온 값** 이다(판정이 고른 그 제목)", () => {
    const rows = realRows();
    const host = mount({ rows, originIdentity: realOrigin() });
    const titles = q(host, '[data-testid="mi-review-axis-title"]')
      .map((e) => text(e))
      .join("\n");
    const expected = selectReviewQueue(rows, "ALL")
      .map((e) => e.row.title)
      .filter((t): t is string => Boolean(t && t.trim()));
    expect(expected.length, "🔴 분모 0 — 제목 있는 검토 후보가 없다").toBeGreaterThan(0);
    for (const t of expected) expect(titles, `🔴 후보 제목이 화면에 없다: ${t}`).toContain(t);
  });

  it("B-8 🟢 원문 확인 통로가 **행마다** 있다 — 사람이 직접 볼 수 있어야 판단이 된다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const links = q(host, '[data-testid="mi-review-open-page"]');
    expect(links, "🔴 원문 통로가 행 수와 다르다").toHaveLength(8);
    for (const a of links) {
      expect(text(a)).toBe(REVIEW_OPEN_PAGE_TEXT);
      expect((a as HTMLAnchorElement).getAttribute("href"), "🔴 갈 곳 없는 링크다").toMatch(/^http/);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * C. 🟢 시장별 구역 — 국내 / 해외 / 시장 미확정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **1차 설계는 버튼 + `useState` 였고 기존 계약이 그것을 막았다** —
 *    `core-ux-seller-01 UX-06-d`「이 영역에 **state 는 0** 이다 · 생기면 UX 조립을
 *    넘은 것이다(STOP 조건)」. 🟢 그 가드를 **풀지 않고** 구역 분할로 바꿨다.
 * 🟢 덤 — 세 시장이 **한눈에 같이** 보이고 클릭·복원 상태가 사라졌다.
 */

describe("REV-02 C — 시장별 구역이 겹치지 않고 합이 전체다", () => {
  it("C-1 🔴🔴 **state 가 없다** — 이 영역이 상태를 만들지 않는다(기존 계약과 같은 축)", () => {
    const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const bad of ["useState", "useReducer", "useEffect"]) {
      expect(SRC, `🔴 이 영역에 상태가 생겼다: ${bad}`).not.toContain(bad);
    }
  });

  it("C-2 🟢 구역이 **국내 · 해외 · 시장 미확정** 셋이다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    for (const key of ["kr", "overseas", "unresolved"]) {
      expect(
        host.querySelector(`[data-testid="mi-review-group-${key}"]`),
        `🔴 ${key} 구역이 없다`,
      ).not.toBeNull();
    }
  });

  it("C-3 🟢🟢 **합이 전체** 이고 **겹치지 않는다**(누락 0 · 중복 0)", () => {
    const rows = realRows();
    const host = mount({ rows, originIdentity: realOrigin() });
    const urls = q(host, '[data-testid="mi-review-open-page"]').map((a) =>
      (a as HTMLAnchorElement).getAttribute("href"),
    );
    const all = selectReviewQueue(rows, "ALL");
    expect(urls, "🔴 구역 합이 전체와 다르다").toHaveLength(all.length);
    expect(new Set(urls).size, "🔴 같은 후보가 두 구역에 섰다").toBe(all.length);
  });

  it("C-4 🟢 각 구역의 건수가 **선택기와 같다**(복제 계산 0)", () => {
    const rows = realRows();
    const host = mount({ rows, originIdentity: realOrigin() });
    const rowsIn = (key: string) =>
      host.querySelectorAll(`[data-testid="mi-review-group-${key}"] [data-testid="mi-review-row"]`)
        .length;
    expect(rowsIn("kr")).toBe(selectReviewQueue(rows, "KR").length);
    expect(rowsIn("overseas")).toBe(selectReviewQueue(rows, "OVERSEAS").length);
    /** 🟢 미확정 = 전체 − (국내 + 해외) — 그 차집합이 **실제로 0 이 아니다**(분모 잠금). */
    const unresolved =
      selectReviewQueue(rows, "ALL").length -
      selectReviewQueue(rows, "KR").length -
      selectReviewQueue(rows, "OVERSEAS").length;
    expect(unresolved, "🔴 분모 0 — 시장 미확정 후보가 없다").toBeGreaterThan(0);
    expect(rowsIn("unresolved")).toBe(unresolved);
  });

  it("C-5 🔴 **빈 구역의 머리말을 그리지 않는다** — 「국내 0건」은 조회 실패로 읽힌다", () => {
    const rows = realRows();
    expect(selectReviewQueue(rows, "KR"), "🔴 fixture 전제가 바뀌었다").toHaveLength(0);
    const host = mount({ rows, originIdentity: realOrigin() });
    expect(
      text(host.querySelector('[data-testid="mi-review-group-kr"]')).trim(),
      "🔴 빈 구역이 머리말을 그렸다",
    ).toBe("");
  });

  it("C-6 🟢 **시장 미확정을 국내·해외로 옮겨 적지 않는다**(승격 0)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    expect(
      text(host.querySelector('[data-testid="mi-review-group-unresolved"]')),
    ).toContain(REVIEW_UNRESOLVED_MARKET_HEADING);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * D. 🔴 노출 층 — 접힘 안 · `open` 없음 · 머리말은 1차
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 D — 보류 후보를 「유력 후보」로 보여주지 않는다", () => {
  it("D-1 🔴🔴 영역이 `<details>` 이고 **펼쳐져 있지 않다**(2026-09-19 사고 기전)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const el = host.querySelector('[data-testid="mi-review-queue"]');
    expect(el, "🔴 영역이 없다").not.toBeNull();
    expect(el!.tagName.toLowerCase()).toBe("details");
    expect(el!.hasAttribute("open"), "🔴 펼쳐 두면 보류 후보가 유력 후보로 읽힌다").toBe(false);
  });

  it("D-2 🟢 머리말은 **1차에 선다** — 「검토할 것이 N건 있다」가 숨지 않는다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const s = host.querySelector('[data-testid="mi-review-queue-summary"]');
    expect(s, "🔴 요약이 없다").not.toBeNull();
    expect(s!.tagName.toLowerCase()).toBe("summary");
    expect(s!.parentElement?.getAttribute("data-testid")).toBe("mi-review-queue");
  });

  it("D-3 🔴 검토 행의 조상 `<details>` 가 **정확히 1** 이다(세 겹 뒤에 숨지 않는다)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const rows = q(host, '[data-testid="mi-review-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      let d = 0;
      for (let p = r.parentElement; p && p !== host; p = p.parentElement) {
        if (p.tagName.toLowerCase() === "details") d += 1;
      }
      expect(d, `🔴 접힘 깊이가 ${d} 다`).toBe(1);
    }
  });

  /**
   * 🔴🔴 **1차 단언이 동어반복이었고 음성 대조(N1)가 그것을 잡았다.** `rows: null` 만
   *    주면 `MarketPriceComparison` 자체가 `!checkRan && !canRecheck` 로 **통째로
   *    `return null`**(:740) 하므로, 내 가드를 지워도 통과했다.
   * 🟢 그래서 **컴포넌트가 실제로 렌더되는 조건**(`onRecheck` 보유)에서 잰다 —
   *    그러면 이 단언은 **내 가드 하나** 를 본다.
   */
  it("D-4 🔴🔴 **조회가 돌지 않았으면 영역을 그리지 않는다** — 「0건」은 거짓이다", () => {
    const host = mount({ rows: null, originIdentity: realOrigin(), onRecheck: () => {} });
    /** 🔴 분모를 같이 잠근다 — 바깥 영역이 서 있어야 이 단언이 내 가드를 본다. */
    expect(
      host.querySelector('[data-testid="market-price-comparison"]') ?? host.firstElementChild,
      "🔴 바깥 영역이 안 섰다 — 이 단언은 아무것도 보지 않는다",
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="mi-review-queue"]'),
      "🔴 조회 전에 「검토 대기 0건」이 떴다",
    ).toBeNull();
  });

  it("D-5 🟢 **조회는 돌았고 후보가 0** 이면 영역은 서고 「없다」를 말한다(다른 사실이다)", () => {
    const host = mount({ rows: [], originIdentity: realOrigin() });
    expect(host.querySelector('[data-testid="mi-review-queue"]')).not.toBeNull();
    expect(text(host.querySelector('[data-testid="mi-review-queue-empty"]'))).toBe(REVIEW_QUEUE_EMPTY);
  });

  it("D-6 🟢 오독 방지 문장이 영역 안에 있다 — 지우면 이 단언이 FAIL 한다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    expect(text(host.querySelector('[data-testid="mi-review-queue-note"]'))).toBe(REVIEW_QUEUE_NOTE);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * E. 🔴 검토 저장 — **기존 훅 하나** · 새 API 0 · 입력칸 0
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 E — 저장 경로를 새로 만들지 않았다", () => {
  /**
   * 🔴🔴 **판정 버튼을 두지 않았다 — 그 이유를 계약으로 남긴다.**
   *
   * 1차 구현은 `CandidateSelect` 를 검토 행에 달았고 기존 계약 **셋** 이 FAIL 했다:
   * ```
   * core-e2e-close-04            「선택 UI 제거 · 저장 «경로» 보존」
   * sourcing-candidate-unified-ux-1 V-1/V-2  「동일상품 선택 UI 가 사라졌다」(⑦ · CPO 승인 ⒝)
   * stage2-evidence-recovery D2-3 「사람 판정은 셀러 카드에 표시되지 않는다」
   * ```
   * 🔴 그 셋은 **CPO 가 승인한 제품 제거 결정** 이다 ⟹ CTO 가 스스로 되돌리지 않는다(§3).
   * 🟢 그래서 **가드를 한 글자도 풀지 않았고** 이 영역은 「비교와 근거」까지 한다.
   * 🔵 버튼 복원 여부는 **CPO 판정 사안** 으로 올렸다.
   */
  /**
   * 🔵🔵🔵 **FINAL-03 ① — CPO 가 복원을 승인했다. 이 단언의 방향이 뒤집혔다.**
   *
   * 🔴 REV-02 에서는 「버튼을 두지 않았다」가 계약이었다 — 기존 계약 셋이
   *    **CPO 승인 ⒝**(선택 UI 제거)를 담고 있었기 때문이다.
   * 🔵 CPO 결정 — 「비교목록표를 만든 목적이 CPO·CEO 의 직접 검토이기 때문에 승인한다.」
   * 🟢 그래서 그 셋을 **범위만 좁혀** 갱신했다(후보 행에 0 · 검토 접힘에 1 이상).
   */
  it("E-1 🔵🔵 검토 행에 **판정 UI 가 선다**(CPO 승인 · 셀러 후보 행은 그대로 0)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const rows = q(host, '[data-testid="mi-review-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(
        r.querySelector('[data-testid="mi-candidate-select"]'),
        "🔴 검토 행에 판정 UI 가 없다 — 사람이 판단할 수 없다",
      ).not.toBeNull();
      /** 🟢 판단에 필요한 나머지도 같이 있다. */
      expect(r.querySelector('[data-testid="mi-review-compare"]')).not.toBeNull();
      expect(r.querySelector('[data-testid="mi-review-open-page"]')).not.toBeNull();
    }
  });

  it("E-1b 🟢 저장 **경로는 살아 있다** — 훅 배선을 지우지 않았다(복원은 CPO 판정)", () => {
    const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
    expect(SRC, "🔴 저장 경로가 사라졌다").toContain("useCandidateReview(snapshotId)");
  });

  it("E-2 🔴 **입력칸이 없다** — 셀러/검토자에게 글쓰기를 요구하지 않는다(`core-2s D-3`)", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const area = host.querySelector('[data-testid="mi-review-queue"]')!;
    expect(area.querySelectorAll("input").length, "🔴 입력칸이 생겼다").toBe(0);
    expect(area.querySelectorAll("textarea").length, "🔴 입력칸이 생겼다").toBe(0);
  });

  it("E-3 🔴 소스가 **새 fetch/새 저장 경로** 를 만들지 않았다", () => {
    const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 주석을 벗긴 뒤에 본다(여덟 번 걸린 함정). */
    for (const banned of ["fetch(", "candidate-reviews", "useEffect("]) {
      expect(SRC, `🔴 비교목록표가 자기 호출 경로를 만들었다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 저장 owner 는 **그 훅 하나** 다. */
    expect(SRC, "🔴 검토 훅 배선이 사라졌다").toContain("useCandidateReview(snapshotId)");
    /** 🟢 선택기를 **재사용** 한다 — 다시 만들지 않았다(세 구역이 같은 함수를 부른다). */
    expect(SRC, "🔴 선택기를 다시 만들었다").toContain('selectReviewQueue(rows, "ALL")');
    expect(SRC).toContain('selectReviewQueue(rows, "KR")');
    expect(SRC).toContain('selectReviewQueue(rows, "OVERSEAS")');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * F. 🔴🔴 상세설명 근거 — **표시 전용** 이고 판정에 연결되지 않았다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 F — 상세설명 근거는 표시 전용이다", () => {
  const ORIGIN_WITH_DESC: OriginIdentity = {
    brand: "Bobo Choses",
    modelCode: "B226AC033",
    title: "Bobo Choses Pop sweatshirt",
    /** 🔴 라벨 모양을 **추출기가 아는 꼴** 로 둔다 — 값을 지어내는 것이 아니라 입력이다. */
    description: "Brand : Bobo Choses\nProduct name : Pop sweatshirt\n100% organic cotton",
  };

  /**
   * 🔴🔴 **1차 구현은 추출기를 import 했고 Production 배포가 실패했다** —
   *    `Module not found: @commerce/crawler/.../brand-description-evidence`.
   *    원인은 그 두 파일이 **git 에 커밋되지 않은 작업트리 파일** 이라는 것이다
   *    (로컬 build 는 exit 0 이었다 ⟹ **로컬 PASS 가 배포 PASS 가 아니다**).
   * 🔴 CTO 는 사용자 파일을 커밋하지 않았다 ⟹ 이 축은 **지금 비어 있다**.
   * 🟢 그래서 단언을 **그 사실로** 바꿨다 — 「없는 것은 근거가 아니라 추출기다」.
   */
  it("F-1 🔴🔴 추출기가 저장소에 없으므로 **근거 영역을 그리지 않는다**(상세설명이 있어도)", () => {
    const host = mount({ rows: realRows(), originIdentity: ORIGIN_WITH_DESC });
    expect(
      host.querySelector('[data-testid="mi-review-origin-evidence"]'),
      "🔴 근거 없이 영역이 섰다 — 「찾아봤지만 없다」는 거짓이다",
    ).toBeNull();
  });

  it("F-1b 🔴 어댑터가 **저장소에 없는 모듈을 import 하지 않는다**(배포가 깨진다)", () => {
    const SRC = readFileSync(join(__dirname, "..", "origin-description-evidence.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 주석을 벗긴 뒤에 본다 — 머리말이 그 모듈 이름을 **설명으로** 적는다. */
    for (const banned of ["brand-description-evidence", "product-name-description-evidence"]) {
      expect(SRC, `🔴 커밋되지 않은 모듈을 import 한다: ${banned}`).not.toContain(banned);
    }
  });

  it("F-1c 🟢 되살릴 자리는 **한 곳** 이다 — 화면은 어댑터만 본다", () => {
    const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
    expect(SRC, "🔴 화면이 추출기를 직접 부른다").not.toContain("analyzeBrandDescriptionEvidence");
    expect(SRC, "🔴 어댑터 배선이 사라졌다").toContain("originDescriptionEvidence(originIdentity)");
  });

  it("F-2 🔴🔴 범위 문장이 **「판정에 쓰이지 않는다」를 직접 말한다**", () => {
    expect(DESCRIPTION_EVIDENCE_SCOPE).toContain("자동 판정에는 사용되지 않습니다");
  });

  it("F-3 🔴 상세설명이 **없으면 영역을 그리지 않는다** — 「찾아봤지만 없다」로 읽히지 않게", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    expect(
      host.querySelector('[data-testid="mi-review-origin-evidence"]'),
      "🔴 원문이 없는데 근거 영역이 섰다",
    ).toBeNull();
  });

  it("F-4 🔴🔴 **운영 판정 owner 셋은 추출기를 여전히 import 하지 않는다**(동결 유지)", () => {
    const CRAWLER = join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "..",
      "..",
      "packages",
      "crawler",
      "src",
      "comparison-search",
    );
    for (const o of ["product-url-facts.ts", "cross-seller.ts", "seller-facts.ts"]) {
      const src = readFileSync(join(CRAWLER, o), "utf8");
      for (const banned of [
        "brand-description-evidence",
        "product-name-description-evidence",
        "analyzeBrandDescriptionEvidence",
        "analyzeProductNameDescriptionEvidence",
      ]) {
        expect(src, `🔴 ${o} 가 추출기를 끌어왔다: ${banned}`).not.toContain(banned);
      }
    }
  });

  it("F-5 🔴 선택기는 원상품 식별값을 **인자로 받지 않는다** — 판정이 그 값에 흔들릴 길이 없다", () => {
    const SRC = readFileSync(join(__dirname, "..", "mi-same-candidates.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const at = SRC.indexOf("export function selectReviewQueue");
    expect(at, "🔴 선택기가 사라졌다").toBeGreaterThan(-1);
    const sig = SRC.slice(at, SRC.indexOf("{", SRC.indexOf("): Array<", at)));
    expect(sig, "🔴 선택기가 원상품 식별값을 받는다").not.toContain("OriginIdentity");
    expect(sig, "🔴 선택기가 상세설명을 받는다").not.toContain("description");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * H. 🔵🔵🔵 FINAL-03 ① — **사람 판정 UI(CPO 승인)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 결정 — 「비교목록표를 만든 목적이 CPO·CEO 의 직접 검토이기 때문에 승인한다.
 *    기존 계약 3건은 이 범위에서만 수정하십시오. 자동 판정 정책을 바꾸는 것은 아니다.」
 * 🔴 그래서 여기서 재는 것은 셋이다 — ⒜ **검토 접힘 안에만** 있다 ⒝ **기존 저장
 *    경로** 를 쓴다 ⒞ 사람 판정이 **자동 판정을 덮지 않는다**.
 */

describe("REV-02/FINAL-03 H — 사람 판정 UI", () => {
  it("H-1 🟢🟢 **행마다 판정 UI 가 선다** — 네 선택지가 기존 어휘 owner 의 것이다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const rows = q(host, '[data-testid="mi-review-row"]');
    expect(rows.length, "🔴 분모 0").toBeGreaterThan(0);
    for (const r of rows) {
      const sel = r.querySelector('[data-testid="mi-candidate-select"]');
      expect(sel, "🔴 검토 행에 판정 UI 가 없다").not.toBeNull();
      for (const v of HUMAN_REVIEW_VALUES) {
        const btn = sel!.querySelector(`[data-testid="mi-select-${v.toLowerCase()}"]`);
        expect(btn, `🔴 ${v} 선택지가 없다`).not.toBeNull();
        /** 🔴 문구를 테스트가 **지어내지 않는다** — 같은 맵을 읽는다(DB CHECK 와 같은 어휘). */
        expect(text(btn)).toBe(HUMAN_REVIEW_BUTTON[v]);
      }
    }
  });

  /**
   * 🔴🔴 **가짜 훅을 넣지 않는다.** 1차에서 `api` 를 `mount()` 로 넘기려 했으나
   *    `MarketPriceComparison` 은 **자기 `useCandidateReview(snapshotId)`** 를 쓰므로
   *    그 prop 이 **무시된다**(내 테스트가 아무것도 가로채지 못해 호출 0 이었다).
   * 🟢 그래서 **운영 경로를 그대로** 쟀다 — `fetch` 를 세워 **실제 POST 본문** 을 본다.
   *    이것이 「기존 저장 API 재사용」의 직접 증거다(새 API 0).
   */
  it("H-2 🟢🟢 **누르면 기존 저장 API 로 간다** — 실제 POST 본문을 확인한다", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const prev = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        calls.push({
          url: String(input),
          body: JSON.parse(init.body ?? "{}") as Record<string, unknown>,
        });
      }
      return { ok: true, json: async () => ({ ok: true, reviews: [] }) } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      const host = mount({ rows: realRows(), originIdentity: realOrigin() });
      const first = q(host, '[data-testid="mi-review-row"]')[0]!;
      await act(async () => {
        first
          .querySelector('[data-testid="mi-select-same"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(calls, "🔴 저장 POST 가 나가지 않았다").toHaveLength(1);
      /** 🟢 **기존 엔드포인트** 다 — 새 주소를 만들지 않았다. */
      expect(calls[0]!.url).toContain("/candidate-reviews");
      expect(calls[0]!.url).toContain(fixture().snapshot.id);
      expect(calls[0]!.body.humanVerdict).toBe("SAME");
      expect(String(calls[0]!.body.candidateUrl)).toMatch(/^http/);
      /** 🟢 맥락이 같이 간다 — 재진입에서 「왜 그렇게 봤는지」를 복원할 수 있어야 한다. */
      expect(calls[0]!.body.candidate, "🔴 후보 맥락이 빠졌다 — 맨몸 행이 생긴다").toBeTruthy();
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("H-3 🔴🔴 **사람 판정이 자동 판정을 덮지 않는다** — 행의 시스템 값이 그대로다", async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({ ok: true, reviews: [] }),
      }) as unknown as Response) as unknown as typeof fetch;
    try {
      const rows = realRows();
      const key = (r: GeminiTransientRow) =>
        `${r.discoveredUrl}|${r.crossSellerVerdict}|${r.matchTruth}|${r.priceTier}`;
      const before = rows.map(key).sort();
      const host = mount({ rows, originIdentity: realOrigin() });
      await act(async () => {
        q(host, '[data-testid="mi-review-row"]')[0]
          ?.querySelector('[data-testid="mi-select-different"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(rows.map(key).sort(), "🔴 사람 판정이 시스템 판정을 덮었다").toEqual(before);
      /** 🟢 그리고 화면의 **시스템 사유 칠** 도 그대로 있다(다른 노드·다른 state). */
      expect(
        text(host.querySelector('[data-testid="mi-review-reasons"]')).length,
        "🔴 사유 칠이 사라졌다",
      ).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = prev;
    }
  });

  it("H-4 🔴 저장 owner 는 **그 훅 하나** 다 — 영역이 자기 저장 경로를 만들지 않았다", () => {
    const AREA = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(AREA, "🔴 영역이 직접 fetch 한다").not.toContain("fetch(");
    expect(AREA, "🔴 영역이 주소를 직접 적는다").not.toContain("candidate-reviews");
    expect(AREA, "🔴 훅 배선이 사라졌다").toContain("useCandidateReview(snapshotId)");
    /** 🟢 그 훅의 인스턴스는 **하나** 다 — 둘이면 이력 GET 이 두 번 돈다. */
    expect(AREA.split("useCandidateReview(").length - 1).toBe(1);
  });

  it("H-5 🟢 저장 상태 어휘는 **기존 owner** 것이다 — 「눌렀다」와 「저장됐다」를 가른다", () => {
    const LEAF = readFileSync(join(__dirname, "..", "GeminiTransientCandidates.tsx"), "utf8");
    expect(LEAF, "🔴 저장 상태 어휘 owner 가 사라졌다").toContain("SAVE_STATE_TEXT");
    for (const k of ["SAVING", "SAVED", "ERROR"] as const) {
      expect(SAVE_STATE_TEXT[k].length, `🔴 ${k} 문구가 비었다`).toBeGreaterThan(0);
    }
    /** 🟢 그 문구를 그리는 것은 `CandidateSelect` 이고 검토 행이 **그것을 그대로** 쓴다. */
    const AREA = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
    expect(AREA).toContain("<CandidateSelect row={row} api={api} />");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * I. 🔵🔵🔵 FINAL-03 ② — **후보 원값 두 칸**
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02/FINAL-03 I — 후보 브랜드·품번 원값", () => {
  it("I-1 🟢🟢 **원값이 있으면 그대로 선다** — 원상품과 나란히", () => {
    const target = selectReviewQueue(realRows(), "ALL")[0]!.row.discoveredUrl;
    const rows = realRows().map((r) =>
      r.discoveredUrl === target ? { ...r, brand: "Bobo Choses", modelCode: "B226AC033" } : r,
    );
    const host = mount({ rows, originIdentity: realOrigin() });
    const cells = q(host, '[data-testid="mi-review-candidate-value"]').map((e) => text(e));
    expect(cells, "🔴 후보 브랜드 원값이 화면에 없다").toContain("Bobo Choses");
    expect(cells, "🔴 후보 품번 원값이 화면에 없다").toContain("B226AC033");
  });

  it("I-2 🔴🔴 **원값이 차단축 문장을 이긴다** — 값과 차이를 한 칸에서 섞지 않는다", () => {
    /**
     * 🔴 **저장분 복원 경로는 차단축을 `crossSellerConflicts` 에 넣는다**(합쳐 저장된다 ·
     *    `saved-candidate-rows.ts:149`). 1차에 `crossSellerBlockers` 만 봐서 **분모 0** 이었다.
     */
    const base = selectReviewQueue(realRows(), "ALL").find((e) =>
      [...(e.row.crossSellerBlockers ?? []), ...(e.row.crossSellerConflicts ?? [])].includes(
        "BRAND_MISMATCH",
      ),
    );
    expect(base, "🔴 분모 0 — 브랜드 차단축을 든 후보가 없다").toBeTruthy();
    const rows = realRows().map((r) =>
      r.discoveredUrl === base!.row.discoveredUrl ? { ...r, brand: "Fendi" } : r,
    );
    const host = mount({ rows, originIdentity: realOrigin() });
    const cells = q(host, '[data-testid="mi-review-candidate-value"]').map((e) => text(e));
    expect(cells, "🔴 원값이 안 섰다").toContain("Fendi");
    expect(cells.join("|"), "🔴 같은 칸에 값과 차이가 같이 적혔다").not.toContain("Fendi · ");
  });

  it("I-3 🔴 **원값이 없으면 지어내지 않는다** — 차이 또는 「확인 불가」다(CPO 명시)", () => {
    const rows = realRows().map((r) => ({ ...r, brand: null, modelCode: null }));
    const host = mount({ rows, originIdentity: realOrigin() });
    const t = q(host, '[data-testid="mi-review-candidate-value"]')
      .map((e) => text(e))
      .join("|");
    expect(
      t.includes(REVIEW_VALUE_UNKNOWN) || t.includes(REVIEW_CANDIDATE_VALUE_NOT_IN_RESPONSE),
      "🔴 빈 칸을 그대로 뒀다 — 「후보에 브랜드가 없다」로 읽힌다",
    ).toBe(true);
  });

  it("I-4 🟢 **서버가 그 두 칸을 «판정이 고른 후보의 facts» 에서 옮긴다**(새 수집 0)", () => {
    const RUNNER = readFileSync(
      join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "run-domestic-price-check.ts"),
      "utf8",
    );
    expect(RUNNER, "🔴 브랜드 원값 배선이 없다").toContain("brand: best.facts?.brand ?? null");
    expect(RUNNER, "🔴 품번 원값 배선이 없다").toContain(
      "modelCode: best.facts?.brandModelCode ?? null",
    );
  });

  it("I-5 🔴🔴 **그 두 칸은 판정·가격에 들어가지 않는다** — 소비처가 비교표 하나다", () => {
    const AREA = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 `row.brand`·`row.modelCode` 를 읽는 곳이 **각각 한 번** 이어야 한다. */
    expect(AREA.split("row.brand").length - 1, "🔴 브랜드 원값 소비처가 둘 이상이다").toBe(1);
    expect(AREA.split("row.modelCode").length - 1, "🔴 품번 원값 소비처가 둘 이상이다").toBe(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * G. 🔴 승격 0 — 이 화면이 판정을 바꾸지 않는다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("REV-02 G — 자동 판정 승격 0", () => {
  it("G-1 🔴 검토 행에 **가격 결론·추천가 어휘가 없다** — 금액 owner 가 아니다", () => {
    const host = mount({ rows: realRows(), originIdentity: realOrigin() });
    const t = q(host, '[data-testid="mi-review-row"]')
      .map((r) => text(r))
      .join("\n");
    for (const banned of ["추천 판매가", "적정가", "시장 평균", "권장 판매가"]) {
      expect(t, `🔴 검토 행이 가격 결론을 말한다: ${banned}`).not.toContain(banned);
    }
  });

  it("G-2 🔴🔴 **보류가 확정으로 바뀌지 않았다** — 같은 입력에서 tier 분포가 그대로다", () => {
    const rows = realRows();
    const before = rows.map((r) => `${r.discoveredUrl}|${r.priceTier}|${r.crossSellerVerdict}`).sort();
    mount({ rows, originIdentity: realOrigin() });
    const after = rows.map((r) => `${r.discoveredUrl}|${r.priceTier}|${r.crossSellerVerdict}`).sort();
    expect(after, "🔴 화면이 입력 판정을 바꿨다").toEqual(before);
  });

  it("G-3 🔴 호출부가 **값을 만들지 않는다** — 원상품 세 칸이 전부 `product` 의 칸이다", () => {
    const WS = readFileSync(join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const at = WS.indexOf("originIdentity={{");
    expect(at, "🔴 원상품 배선이 사라졌다").toBeGreaterThan(-1);
    const block = WS.slice(at, WS.indexOf("}}", at));
    /**
     * 🔴 **옵셔널 접근 + `?? null`** 이다. 그 모양이 된 계기를 남긴다 — 1차는
     *    `product.sku.value` 로 바로 읽었고 **레거시 스냅샷에 그 칸이 없는** 경로에서
     *    `TypeError` 가 나 **페이지가 통째로 안 떴다**(`golf01-wire-page-chain` 3 FAIL).
     * 🔴 `?? null` 은 **「모른다」** 다 — 값을 지어내는 폴백이 아니다.
     */
    for (const need of [
      "brand: product.brand?.value ?? null",
      "modelCode: product.sku?.value ?? null",
      "title: product.title?.value ?? null",
      "description: product.description?.value ?? null",
    ]) {
      expect(block, `🔴 ${need} 가 없다`).toContain(need);
    }
    /** 🔴 **문자열 기본값을 만들지 않는다** — 빈 값은 화면이 「확인 불가」로 말한다. */
    expect(block, "🔴 호출부가 값을 지어낸다").not.toMatch(/\?\?\s*"/);
    expect(block, "🔴 호출부가 값을 지어낸다").not.toContain("||");
  });
});
