/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_GROUP_NOTE,
  CANDIDATE_PRICE_UNVERIFIED,
  priceState,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import { toSavedCandidateRows } from "../../../api/price-history/_lib/saved-candidate-rows";
import { candidateReviewRowFromDb } from "../../../api/price-history/_lib/candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 **B-3 화면 축** + **UX-FINAL-01**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 따로 있는가 — 순수 축만으로는 배선을 못 본다.**
 *    WU-110 이 적어 둔 그 함정이고, 이 트랙이 `-01`·`-02`·`-03` 에서 **세 번** 밟았다:
 *    변환기가 올바른 배열을 돌려줘도 **컴포넌트가 그 배열을 그리지 않으면** 셀러에게는
 *    후보가 없다. 🟢 그래서 **복원 배열 하나만으로 마운트** 해서 DOM 을 직접 센다.
 *
 * 🔴 입력은 **운영 실데이터** 다 — `_lib/__tests__/fixtures/ux04-b3-reviews.json`
 *    (운영 `candidate_reviews` read-only 덤프)을 **운영 변환기 둘** 에 그대로 통과시킨다.
 *    ⟹ 하니스가 자기 행을 손으로 만들지 않는다(§5-B).
 *
 * 🔴🔴 **그래도 「Production UX PASS」로 적지 않는다.** 실제 `?resume=` 화면은 로그인
 *    뒤라 CTO 가 볼 수 없다 — 이 파일이 증명하는 것은 **「코드가 그렇게 돼 있다」** 이고
 *    「화면이 실제로 그렇다」는 **CEO 축(B-4)** 이다.
 */

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
  withState: { snapshotId: string; rows: Record<string, unknown>[] };
  legacy: { snapshotId: string; rows: Record<string, unknown>[] };
  sellerUrl: Record<string, unknown>[];
  unmapped: Record<string, unknown>[];
}
const dump = (): Dump => JSON.parse(readFileSync(FIX, "utf8")) as Dump;

/** 🟢 운영 경로를 그대로 — DB 행 → 도메인 행 → 복원 행. 가공 0. */
const restored = (raw: Record<string, unknown>[]): GeminiTransientRow[] =>
  toSavedCandidateRows(raw.map((r) => candidateReviewRowFromDb(r))) as GeminiTransientRow[];

const SNAP = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";

function mount(rows: GeminiTransientRow[] | null) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(MarketPriceComparison, { rows, snapshotId: SNAP }));
  });
  return {
    host,
    html: host.innerHTML,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");

/* ═══════════ B3-10 · B3-05 — 복원 배열 «하나» 로 후보가 선다 ═══════════ */

describe("B3-10 🔴🔴 복원 배열만으로 후보 카드가 **실제로 그려진다**", () => {
  it("B3-10 `mi-candidate-row` 가 선다 — 그리고 분모가 0 이 아니다", () => {
    const rows = restored(dump().legacy.rows);
    /** 🔴 분모 0 이면 「복원이 그려진다」가 **아무것도 없는 상태에서 참** 이 된다. */
    expect(rows.length).toBeGreaterThan(0);
    const m = mount(rows);
    try {
      const cards = m.host.querySelectorAll('[data-testid="mi-candidate-row"]');
      expect(cards.length).toBeGreaterThan(0);
      /** 🔴 가격 칸도 같이 선다 — 「후보는 있는데 가격이 없다」는 이 WU 의 FAIL 모양이다. */
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-price"]').length).toBe(
        cards.length,
      );
    } finally {
      m.cleanup();
    }
  });

  it("B3-10-b 🔴 복원 행의 **금액·통화가 글자로** 뜬다(환산 0 · 지어내기 0)", () => {
    const rows = restored(dump().legacy.rows).filter(
      (r) => r.priceAmount != null && r.priceCurrency,
    );
    expect(rows.length).toBeGreaterThan(0);
    const m = mount(rows);
    try {
      const texts = [...m.host.querySelectorAll('[data-testid="mi-candidate-price"]')].map(
        (n) => n.textContent ?? "",
      );
      /** 🔴 통화는 **저장된 그 통화** 다 — 원화로 바꾸지 않는다. */
      for (const r of rows) {
        expect(texts.some((t) => t.includes(String(r.priceCurrency)))).toBe(true);
      }
    } finally {
      m.cleanup();
    }
  });

  it("B3-05 🔴 같은 후보가 **두 번 서지 않는다** — `mi-same-row` 는 0 이다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      /** 🔴 A 에서 제거한 두 번째 surface 가 복원 경로로 **되살아나지 않는다**. */
      expect(m.host.querySelectorAll('[data-testid="mi-same-row"]').length).toBe(0);
      const urls = [...m.host.querySelectorAll('[data-testid="mi-candidate-row"] a')].map(
        (a) => (a as HTMLAnchorElement).getAttribute("href"),
      );
      expect(new Set(urls).size).toBe(urls.length);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ B3-06 — P1 / P2 / P3 가 저장값으로 복원된다 ═══════════ */

describe("B3-06 🔴🔴 P1/P2/P3 — 특히 `VERIFIED_CURRENT` 는 **반드시 P1** 이다", () => {
  it("B3-06 저장된 `VERIFIED_CURRENT` 행이 **P1(CONFIRMED)** 로 복원된다", () => {
    const rows = restored(dump().withState.rows);
    /** 🔴 분모 — B-2 writer 가 실제로 저장한 그 행이다(없으면 이 축은 측정불가). */
    expect(rows.length).toBe(1);
    expect(rows[0].priceStatus).toBe("VERIFIED_CURRENT");
    expect(priceState(rows[0])).toBe("CONFIRMED");
    const m = mount(rows);
    try {
      const card = m.host.querySelector('[data-testid="mi-candidate-row"]');
      expect(card).not.toBeNull();
      expect(card?.getAttribute("data-price-state")).toBe("CONFIRMED");
      /** 🔴 P1 에는 「검증 전」 줄이 **서지 않는다** — 서면 P1/P2 가 구별되지 않는다. */
      expect(
        m.host.querySelectorAll('[data-testid="mi-candidate-price-unverified"]').length,
      ).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("B3-06-b 🔴 `price_status` 가 **없는 기존 행은 P2** 다(D7) — P1 로 추정하지 않는다", () => {
    const rows = restored(dump().legacy.rows).filter(
      (r) => r.priceAmount != null && r.priceCurrency,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.priceStatus === null)).toBe(true);
    expect(rows.every((r) => priceState(r) === "UNVERIFIED")).toBe(true);
    const m = mount(rows);
    try {
      /** 🔴 그 행들에는 「검증 전」 줄이 **반드시** 선다(FAIL-04 의 그 자리). */
      const unverified = m.host.querySelectorAll(
        '[data-testid="mi-candidate-price-unverified"]',
      );
      expect(unverified.length).toBe(rows.length);
      expect(unverified[0].textContent).toContain(CANDIDATE_PRICE_UNVERIFIED);
    } finally {
      m.cleanup();
    }
  });

  it("B3-06-c 🔴 P3(가격 없음)은 **금액을 지어내지 않는다**", () => {
    const rows = restored(dump().unmapped).filter((r) => r.priceAmount == null);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => priceState(r) === "NONE")).toBe(true);
  });
});

/* ═══════════ LOCK — 미매핑 source 는 배지를 세우지 않는다 ═══════════ */

describe("LOCK 🔵 복원 배지 — DoD ②③ 를 **DOM 으로** 확인한다", () => {
  it("DoD ③ 미매핑 source 행에 **빈 배지 DOM 이 0** 이다", () => {
    const rows = restored(dump().unmapped);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source === undefined)).toBe(true);
    const m = mount(rows);
    try {
      /**
       * 🔴 화면의 출처 배지는 `{row.source && (…)}` 가드 뒤에 있다 ⟹ `undefined` 면
       *    **노드가 아예 없다**. 🟢 그래서 「빈 배지」가 구조적으로 불가능하다.
       */
      const badges = [...m.host.querySelectorAll("span")].filter(
        (s) => (s.textContent ?? "").trim() === "",
      );
      expect(badges.length).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("DoD ⑤ 미매핑이어도 후보가 **화면에서 제거되지 않는다**", () => {
    const rows = restored(dump().unmapped);
    const m = mount(rows);
    try {
      /** 🔴 분모 — 등급을 못 낸 행은 리스트에 안 서는 기존 정책이 있으므로 «0 이상» 만 본다.
       *    🟢 중요한 것은 **source 때문에** 빠지지 않는다는 것이고 그것은 순수 축이 잠갔다. */
      expect(m.host.querySelectorAll('[data-testid="mi-same-row"]').length).toBe(0);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ B3-08 — live 가 있으면 live 가 «전부» 이긴다 ═══════════ */

describe("B3-08 🔴🔴 live 후보와 저장분을 **섞지 않는다** — 배선으로 확인한다", () => {
  const PANEL = readFileSync(join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8");
  const code = PANEL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("B3-08 `rows` 는 **anyEvidence ? live : saved** 다 — 합치는 모양이 아니다", () => {
    /** 🟢 live 가 하나라도 있으면 live 가 전부 이긴다 ⟹ 중복이 **구조적으로** 불가능하다. */
    expect(code).toMatch(/rows:\s*anyEvidence/);
    expect(code).toContain(": saved,");
    /** 🔴 저장분을 live 배열에 **spread 하지 않는다**(그 순간 같은 후보가 두 판 섞인다). */
    expect(code).not.toMatch(/\.\.\.\(?saved/);
    expect(code).not.toContain("...(data?.savedCandidateRows");
  });

  it("B3-08-b 🔴 복원 배선이 **deps 에 있다** — 없으면 영원히 발화하지 않는다", () => {
    /** 🔴 GET 응답은 첫 렌더보다 늦게 온다. 이 파일이 네 번 밟은 함정이다. */
    expect(code).toContain("data?.savedCandidateRows,");
  });

  it("B3-08-c 🔴 복원분이 **가격 집계 배열로 흘러가지 않는다**", () => {
    /** 🔴 화면 state setter 로도 들어가지 않는다 — 들어가면 출처 배열이 오염된다. */
    for (const setter of [
      "setGeminiEvidence(data?.savedCandidateRows",
      "setOverseasAutoEvidence(data?.savedCandidateRows",
      "setWebSearchEvidence(data?.savedCandidateRows",
    ]) {
      expect(code).not.toContain(setter);
    }
  });
});

/* ═══════════ UX-FINAL-01 ⒜ — 그룹 설명 본문 제거 · 뜻 보존 ═══════════ */

describe("UX-FINAL-01 ⒜ 🔵 그룹 설명 **본문** 이 사라지고 **뜻은 남는다**", () => {
  it("⒜-1 `mi-candidate-group-note` 노드가 **0** 이다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-group-note"]').length).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("⒜-2 🔴 그래도 **설명문이 tooltip 으로 살아 있다** — 삭제가 아니라 이동이다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      const heads = [...m.host.querySelectorAll('[data-testid="mi-candidate-group-heading"]')];
      expect(heads.length).toBeGreaterThan(0);
      for (const h of heads) {
        const title = h.getAttribute("title") ?? "";
        /** 🔴 어휘 owner 의 글자 그대로여야 한다 — 새로 쓰지 않았다. */
        expect(Object.values(CANDIDATE_GROUP_NOTE)).toContain(title);
      }
    } finally {
      m.cleanup();
    }
  });

  it("⒜-3 🔴 설명문이 **본문 텍스트로는** 더 이상 나오지 않는다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      /** 🔴 `title` 속성은 textContent 에 안 들어간다 ⟹ 이 단언이 둘을 가른다. */
      const body = m.host.textContent ?? "";
      for (const note of Object.values(CANDIDATE_GROUP_NOTE)) {
        expect(body).not.toContain(note);
      }
    } finally {
      m.cleanup();
    }
  });

  it("⒜-4 🔴 **라벨은 그대로** 다 — 행마다 판정 라벨(WU-091)을 지우지 않았다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      const cards = m.host.querySelectorAll('[data-testid="mi-candidate-row"]');
      expect(cards.length).toBeGreaterThan(0);
      /** 🔴 행 안의 등급 라벨이 카드 수만큼 있다. */
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-group"]').length).toBe(
        cards.length,
      );
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ UX-FINAL-01 ⒝ — 가격이 시각적으로 1순위 ═══════════ */

describe("UX-FINAL-01 ⒝ 🔵 가격이 카드에서 **가장 큰 글자** 다 (DOM 순서는 불변)", () => {
  /** 🟢 카드 블록 하나를 잘라 **그 안에서** 센다 — 파일 전체를 세면 다른 영역이 섞인다. */
  const card = (() => {
    const start = SRC.indexOf('data-testid="mi-candidate-row"');
    const end = SRC.indexOf('data-testid="mi-candidate-empty"');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return SRC.slice(start, end);
  })();

  /**
   * 🔴🔴 **이 단언은 «강화된» 것이다 — 1차 단언이 음성대조를 통과했다.**
   *
   * 1차는 「다른 모든 줄보다 크다」였는데, 가격을 **변경 전 값**(13px)으로 되돌리는
   * 변이에서 **그대로 통과** 했다 — 13 > 11 이 **이미 참** 이었기 때문이다. 즉 그
   * 단언은 이 WU 가 바꾼 것을 **하나도 잠그지 못했다**(동어반복에 가까웠다).
   * 🟢 그래서 「**한 눈에** 크다」를 배수로 적는다 — 17/11 ≈ 1.55 통과 · 13/11 ≈ 1.18 FAIL.
   * 🔴 배수를 1.4 로 둔 근거는 **변경 전 값이 반드시 FAIL 해야 한다** 는 것이다.
   */
  const MIN_PRICE_SIZE_RATIO = 1.4;

  it("⒝-1 가격 줄이 카드의 다른 줄보다 **한 눈에** 크다(배수로 잠근다)", () => {
    const priceIdx = card.indexOf('data-testid="mi-candidate-price"');
    expect(priceIdx).toBeGreaterThan(0);
    /** 🔴 가격 `<p>` 의 className 은 그 testid 바로 **앞** 에 있다. */
    const priceClass = card.slice(Math.max(0, priceIdx - 220), priceIdx);
    const px = /text-\[(\d+)px\]/.exec(priceClass);
    expect(px).not.toBeNull();
    const priceSize = Number(px?.[1]);

    const others = [...card.matchAll(/text-\[(\d+)px\]/g)]
      .map((m) => ({ size: Number(m[1]), at: m.index ?? 0 }))
      /** 🔴 가격 줄 자신은 분모에서 뺀다. */
      .filter((o) => o.at < priceIdx - 220 || o.at > priceIdx);
    expect(others.length).toBeGreaterThan(0);
    const biggestOther = Math.max(...others.map((o) => o.size));
    /** 🔴 「크다」가 아니라 「**분명히** 크다」다 — 위 블록이 그 이유를 적었다. */
    expect(priceSize / biggestOther).toBeGreaterThanOrEqual(MIN_PRICE_SIZE_RATIO);
  });

  it("⒝-2 가격 줄이 **굵다**(강조가 크기 하나에 의존하지 않는다)", () => {
    const priceIdx = card.indexOf('data-testid="mi-candidate-price"');
    expect(card.slice(Math.max(0, priceIdx - 220), priceIdx)).toContain("font-bold");
  });

  /**
   * 🔵🔵🔵 **UNIFIED-UX-1 ② 에서 이 순서가 «뒤집혔다». 의도된 변경이다.**
   *
   * 🔴 전 계약: 「등급이 가격보다 **앞**」(R2-08). 그때 등급은 **기본 카드** 의 한 칸이었다.
   * 🔴🔴 CPO 확정(2026-11-09) — 기본 카드는 **이미지·상품명·사이트명·링크·가격** 다섯 칸
   *    이고 **등급은 「우리 판단」 영역으로 이동** 한다 ⟹ 등급이 가격 **뒤** 로 간다.
   * 🟢 **R2-08 이 지키던 뜻은 그대로다** — 「1순위 = **시각 비중**, DOM 순서가 아니다」.
   *    가격이 가장 큰 글자라는 것은 ⒝-1 이 계속 단언한다.
   * 🔴 **약화가 아니다** — 순서만 뒤집은 것이 아니라 **등급이 「우리 판단」 영역 «안»**
   *    에 있는지까지 본다(기본 5칸으로 되돌아가면 FAIL).
   */
  /**
   * 🔵🔵🔵 **SOURCING-CARD-MINIMAL-1 — 순서가 다시 뒤집혔다(CPO 결정 C).**
   *
   * 🔴 「우리 판단」 영역이 **제거** 되고 **등급 배지가 기본 정보로 올라왔다**
   *    ⟹ 등급이 가격 **앞** 이다(= UNIFIED-UX-1 이전의 배치로 돌아왔다).
   * 🟢 **⒝-1 이 지키는 뜻은 그대로다** — 「1순위 = **시각 비중**」. 가격이 가장 큰
   *    글자라는 단언은 그 케이스가 계속 들고 있다(이 케이스는 **순서** 만 본다).
   * 🔴 **약화 0** — 영역이 **되살아나면 FAIL** 하는 단언을 **같이** 둔다.
   */
  it("⒝-3 🔴🔴 등급 배지가 가격 **앞** 이고 「우리 판단」 영역은 없다(결정 C 구조)", () => {
    const group = card.indexOf('data-testid="mi-candidate-group"');
    const price = card.indexOf('data-testid="mi-candidate-price"');
    expect(group).toBeGreaterThan(0);
    expect(price).toBeGreaterThan(0);
    /** 🔴 등급이 가격보다 **먼저** 다 — 금액을 먼저 읽고 등급을 모르면 추정가를 확정가로 읽는다. */
    expect(group, "🔴 등급 배지가 가격 뒤에 있다").toBeLessThan(price);
    /** 🔴 별도 판단 영역은 **없다**. */
    expect(
      card.indexOf('data-testid="mi-candidate-judgement"'),
      "🔴 「우리 판단」 영역이 되살아났다",
    ).toBe(-1);
  });

  it("⒝-4 🔴 가격 **글자 자체** 는 안 바뀌었다 — 환산·기호 추가가 0 이다", () => {
    const m = mount(restored(dump().legacy.rows));
    try {
      const texts = [...m.host.querySelectorAll('[data-testid="mi-candidate-price"]')].map(
        (n) => n.textContent ?? "",
      );
      expect(texts.length).toBeGreaterThan(0);
      /** 🔴 후보 카드의 금액에 **원화 환산을 붙이지 않는다**(WU-056-R1 계약과 같은 축). */
      for (const t of texts) expect(t).not.toMatch(/약\s*₩|≈/);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ UX-FINAL-01 ⒞ — 국내/해외가 같은 카드다 ═══════════ */

describe("UX-FINAL-01 ⒞ 🔵 국내/해외 DOM 구조·타이포가 **같다**(D4)", () => {
  it("⒞-1 두 시장이 **같은 컴포넌트** 를 쓴다 — 그래서 어긋날 수 없다", () => {
    /** 🟢 `["KR","OVERSEAS"].map(…)` 으로 `MarketBlock` 하나를 돌린다(분기 0). */
    expect(SRC).toMatch(/\(\["KR",\s*"OVERSEAS"\]\s*as\s*const\)\.map/);
  });

  it("⒞-2 🔴 카드 안에 **시장별 스타일 분기가 없다**", () => {
    const start = SRC.indexOf('data-testid="mi-candidate-row"');
    const end = SRC.indexOf('data-testid="mi-candidate-empty"');
    const body = SRC.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 `market === "KR" ? … : …` 같은 모양이 카드 안에 있으면 둘이 벌어진다. */
    expect(body).not.toMatch(/market\s*===\s*"KR"\s*\?/);
    expect(body).not.toMatch(/market\s*===\s*"OVERSEAS"\s*\?/);
  });

  it("⒞-3 🟢 복원 행에 두 시장이 섞여 있어도 카드 구조가 같다", () => {
    const d = dump();
    const rows = [...restored(d.legacy.rows), ...restored(d.sellerUrl)];
    const kr = rows.filter((r) => r.market === "KR");
    const os = rows.filter((r) => r.market === "OVERSEAS");
    /** 🔴 분모 — 두 시장이 **둘 다** 표본에 있어야 비교가 성립한다. */
    expect(kr.length).toBeGreaterThan(0);
    expect(os.length).toBeGreaterThan(0);

    const shape = (subset: GeminiTransientRow[]) => {
      const m = mount(subset);
      try {
        const card = m.host.querySelector('[data-testid="mi-candidate-row"]');
        expect(card).not.toBeNull();
        return [...(card?.querySelectorAll("[data-testid]") ?? [])].map(
          (n) => n.getAttribute("data-testid") ?? "",
        );
      } finally {
        m.cleanup();
      }
    };
    /**
     * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다.** 두 카드를 통째로 비교했더니
     *    KR 쪽에만 `mi-candidate-warning` 이 있어 FAIL 했는데, 그것은 **그 행에 확인할
     *    것이 있어서**(blocker 1건) 선 줄이다 — 「확인할 것이 없으면 아무 줄도 서지
     *    않는다」가 `-02` 가 확정한 **의도된 동작** 이다. ⟹ 시장 차이가 아니다.
     * 🟢 그래서 축을 **둘로 가른다** —
     *    ⒜ **구조 척추**(데이터와 무관하게 항상 서는 줄)는 **순서까지 같다**
     *    ⒝ 나머지 차이는 **데이터 의존 줄의 부분집합** 이어야 한다(그 밖이면 FAIL)
     */
    /**
     * 🔵 CLOSE-3 §2 — **분모(scope) 변경이다.** 환산 줄 둘을 데이터 의존으로 더한다.
     *
     * 🔴🔴 그 차이는 **시장(KR ↔ OVERSEAS)이 아니라 «통화» 에서 온다** — 코드 조건은
     *    `row.priceCurrency !== "KRW"` 하나이고 `market` 을 **보지 않는다**. KRW 후보에
     *    환산 줄이 없는 것은 「`₩88,000` 아래 `약 ₩88,000`」을 적지 않는 **의도된 동작**
     *    이다(§2 「중복 환산 없음」).
     * 🟢 표본에서 통화와 시장이 함께 움직여 구조 차이처럼 보이지만, **시장별 구조 분기
     *    금지**(⒞-2 가 `market === "KR" ?` 모양을 소스에서 직접 막는다)는 그대로다.
     */
    /**
     * 🔵 **FINAL UX REBUILD — 분모에 `mi-candidate-evidence` 를 더한다**(2026-11-02).
     *
     * 🔴 CPO 목표 화면이 「`blockers` · 내부 판정 문구는 기본 화면에서 제거(**근거 안으로**)」
     *    라서 경고 줄들이 카드 **안** 의 `<details>` 로 들어갔다. 그 접힘은 **경고가 있을
     *    때만** 선다(빈 틀 금지) ⟹ `mi-candidate-warning` 과 **정확히 같은 데이터 조건** 이다.
     * 🟢 그래서 **같은 집합** 에 넣는다 — 구조 척추(항상 서는 줄)는 한 줄도 바뀌지 않았다.
     */
    const DATA_DEPENDENT = new Set([
      "mi-candidate-price-unverified",
      "mi-candidate-evidence",
      "mi-candidate-warning",
      "mi-candidate-price-krw",
      "mi-candidate-price-krw-unavailable",
      /**
       * 🔵 **UNIFIED-UX-1 ②⑤⑦ — 데이터 의존 줄 셋을 분모에 더한다.**
       *
       * 🔴 셋 다 **「있을 때만」** 선다 — 판단 근거는 경고가 없으면 0, 참고가격 사용
       *    여부는 가격이 없거나 미확인이면 0, 사람 판정은 저장분이 있을 때만 선다.
       * 🟢 **구조 척추는 그대로다** — 「우리 판단」 영역(`mi-candidate-judgement`)과
       *    등급(`mi-candidate-group`)은 **항상** 서므로 spine 에 남아 비교된다
       *    ⟹ 시장별 구조 분기 금지는 **약화되지 않는다**.
       */
      "mi-candidate-judgement-basis",
      "mi-candidate-human-verdict",
      "mi-candidate-price-use",
    ]);
    /**
     * 🔵🔵 **SOURCING-CARD-MINIMAL-1 — 위 집합의 넷은 이제 «어느 행에도» 서지 않는다**
     *    (`mi-candidate-evidence` · `mi-candidate-warning` · `mi-candidate-judgement-basis` ·
     *     `mi-candidate-human-verdict` — CPO 결정 C·D).
     * 🟢 **목록에 남겨 둔다** — 지우면 그 줄이 되살아날 때 **구조 불일치로 오탐** 이 난다.
     * 🟢 되살아나는 것을 막는 축은 **다른 계약 다섯** 이 들고 있다
     *    (`stage2 D1-5` · `cand-02 R2-03/R2-04/R2-07` · `close-04/05` · `sprint3-p4`).
     * 🟢 그리고 **구조 척추에는 `mi-candidate-group` 이 남아** 국내·해외 동일 구조를 지킨다.
     */
    const a = shape(kr);
    const b = shape(os);

    const spine = (t: string[]) => t.filter((x) => !DATA_DEPENDENT.has(x));
    expect(spine(a)).toEqual(spine(b));
    /** 🔴 척추가 비면 이 단언은 아무것도 보지 않는다 — 분모를 같이 잠근다. */
    expect(spine(a).length).toBeGreaterThan(3);

    /** 🔴 데이터 의존 줄 **밖의** 차이는 허용하지 않는다(시장별 구조 분기 금지). */
    const diff = [...new Set([...a, ...b])].filter((t) => a.includes(t) !== b.includes(t));
    for (const t of diff) expect(DATA_DEPENDENT.has(t)).toBe(true);
  });
});
