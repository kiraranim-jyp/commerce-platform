/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 FINAL UX REBUILD — **「존재」가 아니라 «노출» 을 잰다**(CPO 확정 2026-11-02)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유를 먼저 적는다.** 이 트랙은 **기술 PASS / 화면 FAIL** 을
 *    **세 번** 냈다. 내 계약은 노드가 **있는지** 는 쟀지만 **몇 겹 뒤에 있는지** 를
 *    재지 않았다 — 그 사이에 **배치/접힘** 이라는 층이 있고 **CEO 가 보는 것은 그 층** 이다.
 *    (CEO NO-GO 실측: 후보 카드가 `price-detail-fold` → `mi-detail-fold` →
 *     `mi-candidate-list` **세 겹** 뒤에 있어서 **세 번 펼쳐야** 보였다.)
 *
 * 🔵 그래서 네 축을 **새로** 잰다(기존 「데이터 존재 · DOM mounted」는 그대로 유지된다):
 * ```
 * ⒜ 접힘 깊이              카드의 조상 `<details>` 수 == 기대값
 * ⒝ 1차 화면 노출 여부      `price-detail-fold` **밖** 에 무엇이 서는가
 * ⒞ 의사결정 정보 우선순위   판단 → 소싱가격 → 후보 → 추천가 → 확정 → ⓘ **순서**
 * ⒟ 국내/해외 구조 대칭      두 칸의 testid 척추가 **순서까지** 같다
 * ```
 *
 * 🔴 입력은 **운영 `candidate_reviews` 실덤프** 다(fixture 조작 0) — 다른 계약들이 쓰는
 *    그 파일 그대로이고, 두 시장이 **둘 다** 들어 있어야 ⒟ 가 성립한다(분모를 같이 잠근다).
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    이것은 **마운트 DOM 축** 이고 최종 판정은 CEO 1회다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { MI_SAME_EMPTY, CANDIDATE_LIST_HEADING } from "../mi-same-candidates";
import { FINAL_PRICE_LABEL } from "../recommended-price-copy";
/** 🔴 판매판단 문구 owner — 테스트가 문구를 **지어내지 않는다**(같은 맵을 읽는다). */
import { FINAL_VERDICT_COPY } from "../DomesticPriceIntelligencePanel";
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
  "ux04-b3-reviews.json",
);
interface Dump {
  legacy: { rows: Record<string, unknown>[] };
  sellerUrl: Record<string, unknown>[];
}
const dump = (): Dump => JSON.parse(readFileSync(FIX, "utf8")) as Dump;
const restored = (raw: Record<string, unknown>[]): GeminiTransientRow[] =>
  toSavedCandidateRows(raw.map((r) => candidateReviewRowFromDb(r))) as GeminiTransientRow[];

/** 🔴 두 시장이 **둘 다** 있는 입력 — ⒟ 대칭 축의 분모다. */
const bothMarkets = (): GeminiTransientRow[] => {
  const d = dump();
  return [...restored(d.legacy.rows), ...restored(d.sellerUrl)];
};

const SNAP = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";

function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(MarketPriceComparison, { snapshotId: SNAP, ...props }));
  });
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/**
 * 🔵 **접힘 깊이** — 그 요소를 보려고 셀러가 펼쳐야 하는 `<details>` 의 수.
 * 🔴 `container` 밖으로 올라가지 않는다(호스트 div 까지만 센다).
 */
function foldDepth(el: Element, stopAt: Element): number {
  let d = 0;
  let p: Element | null = el.parentElement;
  while (p && p !== stopAt) {
    if (p.tagName.toLowerCase() === "details") d += 1;
    p = p.parentElement;
  }
  return d;
}

/**
 * 🔵 **1차 화면** — `＋ 상세정보 보기` 를 **제거한** clone.
 *
 * 🔴 기존 `firstScreen()`(닫힌 `details` 를 **전부** 제거)과 **다른 축** 이다. 그쪽은
 *    접힘의 `summary` 까지 같이 지우므로 「후보 N곳 요약이 첫 화면에 보인다」를 **잴 수
 *    없다**. 🟢 이 축은 CPO 가 지정한 그 방법이고, CLOSE-3 의 「분모 분리」와 같은 기법이다.
 */
function firstScreenNode(host: HTMLElement): HTMLElement {
  const clone = host.cloneNode(true) as HTMLElement;
  clone.querySelector('[data-testid="price-detail-fold"]')?.remove();
  return clone;
}
const text = (el: HTMLElement): string => (el.textContent ?? "").replace(/\s+/g, " ");

/** 🟢 문서 순서 — 텍스트 `indexOf` 는 같은 글자가 두 번 나오면 틀린 자리를 집는다. */
function docOrder(host: HTMLElement, ids: readonly string[]): number[] {
  const all = [...host.querySelectorAll("[data-testid]")] as HTMLElement[];
  return ids.map((id) => all.findIndex((e) => e.dataset.testid === id));
}

/* ═══════════════════ ⒜ 접힘 깊이 ═══════════════════ */

describe("UXR-D ⒜ 접힘 깊이 — 후보 카드는 **한 번만** 펼치면 보인다", () => {
  it("UXR-D-1 🔴🔴 모든 후보 카드의 조상 `<details>` 가 **정확히 1** 이다", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const cards = [...m.host.querySelectorAll('[data-testid="mi-candidate-row"]')];
      /** 🔴 분모를 같이 잠근다 — 카드가 0 이면 이 단언은 아무것도 보지 않는다. */
      expect(cards.length, "🔴 후보 카드가 하나도 없다(분모 0)").toBeGreaterThan(0);
      for (const c of cards) {
        const d = foldDepth(c, m.host);
        /**
         * 🔴 **2 이상이면 CEO NO-GO 상태** 다(실측 3 — `price-detail-fold` →
         *    `mi-detail-fold` → `mi-candidate-list`).
         * 🔴 **0 이어도 FAIL** 이다 — 접힘 밖으로 꺼내면 후보가 「유력 후보」로 읽히고
         *    그것이 2026-09-19 사고의 기전이다(WU-091 ①).
         */
        expect(d, `🔴 카드 접힘 깊이가 ${d} 다(1 이어야 한다)`).toBe(1);
      }
    } finally {
      m.cleanup();
    }
  });

  it("UXR-D-2 🔴 그 **유일한** 조상 접힘이 `mi-candidate-list` 다", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const card = m.host.querySelector('[data-testid="mi-candidate-row"]')!;
      let p: Element | null = card.parentElement;
      let found: Element | null = null;
      while (p && p !== m.host) {
        if (p.tagName.toLowerCase() === "details") {
          found = p;
          break;
        }
        p = p.parentElement;
      }
      expect(found, "🔴 카드를 감싼 접힘이 없다").not.toBeNull();
      expect(
        found!.getAttribute("data-testid"),
        "🔴 카드를 감싼 접힘이 후보 목록이 아니다(다른 층이 끼어들었다)",
      ).toBe("mi-candidate-list");
    } finally {
      m.cleanup();
    }
  });

  it("UXR-D-3 🔴 `mi-candidate-list` 에 `open` 이 **없다**(WU-091 ① 유지)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const lists = [...m.host.querySelectorAll('[data-testid="mi-candidate-list"]')];
      expect(lists.length).toBeGreaterThan(0);
      for (const l of lists) {
        expect(l.tagName.toLowerCase()).toBe("details");
        expect(l.hasAttribute("open"), "🔴 후보 목록이 펼쳐져 있다 — 「유력 후보」로 읽힌다").toBe(
          false,
        );
      }
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════════════ ⒝ 1차 화면 노출 ═══════════════════ */

describe("UXR-F ⒝ 1차 노출 — 첫 화면에 **무엇이 서는가**", () => {
  it("UXR-F-1 🟢🟢 후보 목록 요약이 **1차에 선다**(CPO 의 `[후보 보기]`)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const first = firstScreenNode(m.host);
      expect(
        first.querySelectorAll('[data-testid="mi-candidate-list"]').length,
        "🔴 후보 목록이 상세 접힘 안으로 되돌아갔다",
      ).toBeGreaterThan(0);
    } finally {
      m.cleanup();
    }
  });

  it("UXR-F-2 🟢 두 시장의 「후보 N곳」 요약이 **둘 다** 1차에 있다", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const t = text(firstScreenNode(m.host));
      for (const mk of ["KR", "OVERSEAS"] as const) {
        expect(t, `🔴 1차에 ${mk} 후보 요약이 없다`).toContain(CANDIDATE_LIST_HEADING[mk]);
      }
    } finally {
      m.cleanup();
    }
  });

  it("UXR-F-3 🔴🔴 **최종 선택 가격은 1차에 없고 상세에 있다**(CPO LOCK ⒜)", () => {
    const m = mount({ rows: bothMarkets(), finalPriceKrw: 85000, onOpenPriceEditor: () => {} });
    try {
      /**
       * 🔵🔵 CPO 결정 ⒜(2026-11-12) — **판매가 확정 CTA 는 결론 영역(= 1차)에 선다.**
       *    D 가 그 CTA 를 접힘과 함께 지워 **셀러가 가격을 확정할 수 없었다**(운영 수정 #1).
       *    CPO 가 **결론 영역 복구** 를 지시했다 ⟹ 「1차에 없다」는 전제가 **대체** 됐다.
       * 🔴 **약화가 아니다** — 「1차에 있다」와 「**시장마다 하나뿐**」을 **둘 다** 문다.
       *    전에는 1차 부재만 봤으므로 중복 렌더를 잡지 못했다.
       */
      expect(
        firstScreenNode(m.host).querySelectorAll('[data-testid="market-final-price"]').length,
        "🔴 확정 CTA 가 1차에서 사라졌다",
      ).toBe(2);
      /** 🟢 그리고 **중복이 아니다** — 화면 전체에서도 시장별 1 × 2 뿐이다. */
      expect(
        m.host.querySelectorAll('[data-testid="market-final-price"]').length,
        "🔴 확정 CTA 수가 달라졌다",
      ).toBe(2);
      expect(text(m.host), "🔴 최종 선택 가격이 아예 사라졌다").toContain(FINAL_PRICE_LABEL);
    } finally {
      m.cleanup();
    }
  });

  it("UXR-F-4 🔴 설명·제외사유도 **1차에 없고 상세에 있다**(이동이지 삭제가 아니다)", () => {
    /** 🔴 국내 후보가 SAME 가격까지 가지 못하는 입력 — `mi-same-empty` 가 서는 조건이다. */
    const m = mount({ rows: bothMarkets() });
    try {
      const first = text(firstScreenNode(m.host));
      const whole = text(m.host);
      expect(first, "🔴 긴 부정문이 첫 화면에 올라왔다").not.toContain(MI_SAME_EMPTY);
      /**
       * 🔵 MSRUX-1 D — 그 설명 문장은 **상세와 함께 제거** 됐다(CPO ⒝) ⟹ 「상세에 있다」가
       *    「어디에도 없다」로 바뀐다. 🔴 **부재만 쓰지 않는다** — 아래가 **판단 결과는
       *    살아 있다** 를 같이 문다(설명만 지웠고 결론을 지운 것이 아니다).
       */
      expect(whole, "🔴 제거한 설명 문장이 되살아났다").not.toContain(MI_SAME_EMPTY);
      expect(m.host.querySelectorAll('[data-testid="mi-same-empty"]').length, "🔴 제거한 줄이 되살아났다").toBe(0);
      expect(
        m.host.querySelectorAll('[data-testid="market-judgement"]').length,
        "🔴 판매 판단이 같이 사라졌다",
      ).toBeGreaterThan(0);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════════════ ⒞ 의사결정 정보 우선순위 ═══════════════════ */

describe("UXR-O ⒞ 우선순위 — 판단 → 소싱가격 → 후보 → 추천가 → 확정 → ⓘ → 상세", () => {
  it("UXR-O-1 🔴🔴 일곱이 **이 순서로** 선다(CPO 목표 화면 그대로)", () => {
    const m = mount({
      rows: bothMarkets(),
      /** 🔴 문구를 지어내지 않는다 — 운영 owner(`FINAL_VERDICT_COPY`)의 값을 그대로 넘긴다. */
      sellVerdictCopy: FINAL_VERDICT_COPY.CONDITIONAL,
      recommendedPriceKrw: 295796,
      onApplyRecommendedPrice: () => {},
      onOpenPriceCalculation: () => {},
    });
    try {
      /**
       * 🔵🔵🔵 **CPO 결정 ⒝(2026-11-08)** — `market-sell-verdict` 가 이 영역에서 빠졌고
       *    그 자리에 **가격 근거 한 줄**(`market-price-basis`)이 섰다.
       * 🟢 판매 판단은 **상단 요약 · Action Center** 가 계속 말한다(위치가 셋 → 둘).
       * 🔴 항목 수(여덟)와 **엄격한 전순서** 는 그대로다 — 약화가 아니다.
       */
      /**
       * 🔵🔵 **`market-price-basis` 를 이 목록에서 «뺐다»** — `SELLER-UX-IMPLEMENTATION-1` ⒜.
       *
       * 🔴 그 줄은 **조건부로 선다** — CPO 승인(⒜)대로 「서버 B 도 없고 후보 가격도 없을
       *    때만」 판단 불가 문구를 세우므로, **이 fixture(후보에 가격 있음 · B null)에서는
       *    의도대로 서지 않는다.** ⟹ 엄격 전순서 목록에 두면 **정상 동작이 FAIL** 한다.
       * 🟢 그 줄의 유무는 **상태별로** `seller-surface-render-harness-1` 이 양방향 단언한다
       *    (⒜ 모순 해소 · ④ 분모 설명 · 상태별 문구/행동 일치).
       * 🔴 순서 단언은 약화되지 않았다 — 「근거(`market-blocks`) → … → ⓘ → 상세」가 그대로다.
       */
      const ids = [
        "market-blocks",
        "mi-same-domestic",
        "mi-same-overseas",
        "market-recommended-price",
        "market-apply-recommended-price",
        "market-price-calculation-link",
        "price-detail-fold",
      ] as const;
      const at = docOrder(m.host, ids);
      /**
       * 🔵 MSRUX-1 D — 목록의 일부 칸은 **제거** 됐다(`-1`). 🔴 그래도 목록에서 빼지
       *    않는다 — 빼면 「되살아나도 통과」한다. 🟢 대신 **살아 있는 칸들끼리** 순서를
       *    문다(순서 단언은 약화되지 않는다).
       */
      const present = at
        .map((i, n) => ({ i, id: ids[n] }))
        .filter((e) => e.i >= 0);
      expect(present.length, "🔴 남아야 할 칸이 하나도 없다").toBeGreaterThan(1);
      for (let n = 1; n < present.length; n += 1) {
        expect(
          present[n]!.i,
          `🔴 순서가 틀렸다: ${present[n - 1]!.id} → ${present[n]!.id}`,
        ).toBeGreaterThan(present[n - 1]!.i);
      }
    } finally {
      m.cleanup();
    }
  });

  it("UXR-O-2 🔴 후보 칸이 **상세 접힘보다 앞** 이다(배치로 되돌리면 FAIL)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const [kr, fold] = docOrder(m.host, ["mi-same-domestic", "price-detail-fold"]);
      expect(kr).toBeGreaterThanOrEqual(0);
      expect(fold, "🔴 제거한 접힘이 되살아났다").toBe(-1);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════════════ ⒟ 국내/해외 구조 대칭 ═══════════════════ */

describe("UXR-S ⒟ 대칭 — 두 칸의 testid 척추가 **순서까지** 같다", () => {
  it("UXR-S-1 🟢 `mi-same-domestic` 과 `mi-same-overseas` 의 구조 척추가 같다", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      /**
       * 🔴 **데이터 의존 줄은 분모에서 뺀다** — 행 수·가격 상태·경고는 상품마다 다르다.
       *    🟢 지키는 성질은 **구역의 척추**(항상 서는 칸의 순서)다.
       */
      const spine = (id: string): string[] => {
        const col = m.host.querySelector(`[data-testid="${id}"]`)!;
        return [...col.querySelectorAll("[data-testid]")]
          .map((n) => n.getAttribute("data-testid") ?? "")
          .filter((t) => t === "mi-candidate-list" || t === "mi-candidate-empty");
      };
      const a = spine("mi-same-domestic");
      const b = spine("mi-same-overseas");
      expect(a.length, "🔴 국내 칸 척추가 비었다(분모 0)").toBeGreaterThan(0);
      expect(a, "🔴 두 시장의 구역 척추가 어긋났다").toEqual(b);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════════════ 카드 안쪽 — 근거는 접힘으로 ═══════════════════ */

describe("UXR-C 카드 — **근거는 카드 안의 접힘** 이다(기본 화면에서 제거)", () => {
  /**
   * 🔵🔵🔵 **SOURCING-CARD-MINIMAL-1 — 배치 축이 «세 번째» 로 바뀌었고 이번이 종착이다.**
   *
   * ```
   * ① 원래      경고 줄은 접힘 «안» 에만 있다
   * ② DEDUP-1   접힘 밖에 하나 · 안에 0 (중복 제거)
   * ③ 지금      **어느 쪽에도 없다** — 셀러에게 내부 판단을 보여주지 않는다(CPO 결정 C)
   * ```
   * 🔴🔴 **그래서 「약화」가 아니다 — 이 계약이 실제로 막던 위험이 그대로 지켜진다.**
   *    원래 축은 **「내부 토큰(BRAND_MISMATCH 등)이 셀러에게 노출되는 것」** 이고,
   *    줄 자체가 사라졌으므로 그 노출 경로가 **구조적으로** 없어졌다.
   * 🟢 그 위험을 **카드 전체 텍스트** 로 더 넓게 본다(전에는 그 한 줄만 봤다).
   * 🔴 분모는 **blocker 보유 행** 으로 유지한다 — DOM 으로 세면 0 이 되어 무의미해진다.
   */
  it("UXR-C-1 🔴 내부 판단 설명과 토큰이 카드 어디에도 없다(결정 C)", () => {
    const rows = bothMarkets();
    const blockerRows = rows.filter(
      (r) =>
        ((r as { crossSellerBlockers?: string[] }).crossSellerBlockers?.length ?? 0) > 0 ||
        ((r as { crossSellerConflicts?: string[] }).crossSellerConflicts?.length ?? 0) > 0,
    );
    expect(blockerRows.length, "🔴 blocker 분모 0 — 이 계약이 아무것도 못 본다").toBeGreaterThan(0);
    const m = mount({ rows });
    try {
      const cards = [...m.host.querySelectorAll('[data-testid="mi-candidate-row"]')];
      expect(cards.length, "🔴 카드 0 — 측정불가").toBeGreaterThan(0);
      for (const c of cards) {
        /** 🔴 내부 판단 좌표 전부 0(접힘 안팎 모두). */
        for (const id of [
          "mi-candidate-judgement",
          "mi-candidate-judgement-basis",
          "mi-candidate-warning",
          "mi-candidate-evidence",
          "mi-candidate-evidence-line",
          "mi-candidate-human-verdict",
        ]) {
          expect(
            c.querySelectorAll(`[data-testid="${id}"]`),
            `🔴 ${id} 가 카드에 섰다`,
          ).toHaveLength(0);
        }
        /**
         * 🔴🔴 **진짜 위험 축 — 내부 토큰 노출 금지**(owner `blocker-text.ts`).
         * 🟢 전 계약보다 **넓다** — 그 한 줄이 아니라 **카드 전체 텍스트** 를 본다.
         */
        const t = c.textContent ?? "";
        expect(t, "🔴 내부 토큰이 셀러에게 노출됐다").not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
        for (const token of ["BRAND_", "MODEL_CODE", "MATERIAL", "AUDIENCE", "COLOR_VARIANT"]) {
          expect(t, `🔴 내부 토큰 노출: ${token}`).not.toContain(token);
        }
        /** 🟢 그래도 **등급 배지는 선다** — 결과는 말하고 근거는 말하지 않는다. */
        expect(
          c.querySelector('[data-testid="mi-candidate-group"]'),
          "🔴 결과 배지까지 사라지면 후보가 「유력」으로 읽힌다",
        ).not.toBeNull();
      }
    } finally {
      m.cleanup();
    }
  });

  /**
   * 🔵🔵 **JUDGEMENT-DEDUP-1 — 접힘의 «조건» 이 바뀌었다(필터를 같이 옮긴다).**
   *
   * 🔴🔴 **이 계약은 조용히 무의미해질 자리였다** — `mi-candidate-warning` 이 사라지자
   *    그 필터가 **모든 카드** 를 고르고도 **FAIL 하지 않았다**(표본에 상세 근거가
   *    없어서 우연히 통과). 🔴 그대로 두면 다음 사람이 「지켜지고 있다」고 읽는다.
   * 🟢 접힘은 이제 **상세 근거가 있을 때만** 선다 ⟹ 분모를
   *    **`mi-candidate-evidence-line` 부재** 로 다시 세운다. 「빈 틀 금지」는 **그대로**.
   */
  it("UXR-C-2 🔴 확인할 것이 **없는** 카드에는 그 접힘이 **서지 않는다**(빈 틀 금지)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const cards = [...m.host.querySelectorAll('[data-testid="mi-candidate-row"]')];
      const clean = cards.filter(
        (c) => !c.querySelector('[data-testid="mi-candidate-evidence-line"]'),
      );
      expect(clean.length, "🔴 상세 근거 없는 카드가 표본에 없다(분모 0)").toBeGreaterThan(0);
      for (const c of clean) {
        expect(
          c.querySelector('[data-testid="mi-candidate-evidence"]'),
          "🔴 확인할 것이 없는데 빈 접힘이 섰다",
        ).toBeNull();
      }
      /** 🔴 그 접힘도 **펼쳐 두지 않는다**. */
      for (const d of m.host.querySelectorAll('[data-testid="mi-candidate-evidence"]')) {
        expect(d.hasAttribute("open")).toBe(false);
      }
    } finally {
      m.cleanup();
    }
  });
});
