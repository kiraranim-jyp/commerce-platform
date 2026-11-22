/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-IDENTITY-REVIEW-FINAL-03 ④ — **최종 검증 덤프(실데이터 한 번에)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 완료 판정 기준 셋을 **한 테스트에서** 증거로 남긴다:
 * ```
 * ① 원상품 ↔ 후보의 브랜드·품번·상품명을 나란히 볼 수 있는가
 * ② 자동 판단이 어려운 후보를 직접 승인/제외할 수 있는가
 * ③ 그 결과가 저장되고 자동 판정과 혼동되지 않는가
 * ```
 * 🔴 입력은 **운영 저장분**(`mi-final-e2e-01.json` · 스냅샷 `25a3bba7` · 후보 10) ·
 *    fixture 조작 0 · 새 수집 0 · 외부 HTTP 0(POST 는 가짜 응답으로 받는다).
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 마운트 DOM 축이고 최종은 CPO/CEO 1회다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_LIST_HEADING,
  REVIEW_COMPARE_AXES,
  REVIEW_COMPARE_AXIS_LABEL,
  REVIEW_UNRESOLVED_MARKET_HEADING,
  selectReviewQueue,
  type OriginIdentity,
} from "../mi-same-candidates";
import { HUMAN_REVIEW_VALUES } from "../GeminiTransientCandidates";
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
  snapshot: { id: string; title: string; brand: { value: string }; sku: { value: string } };
  candidateReviews: Record<string, unknown>[];
}
const fixture = (): Fixture => JSON.parse(readFileSync(FIX, "utf8")) as Fixture;

const realRows = (): GeminiTransientRow[] =>
  toSavedCandidateRows(
    fixture().candidateReviews.map((r) => candidateReviewRowFromDb(r)),
  ) as GeminiTransientRow[];

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
    root.render(createElement(MarketPriceComparison, { snapshotId: fixture().snapshot.id, ...props }));
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

const txt = (el: Element | null) => (el?.textContent ?? "").trim();

describe("FINAL-03 ④ — 최종 검증 덤프", () => {
  it("E2E 🟢🟢 비교목록표 실데이터 — 8건 · 세 축 · 구역 · 판정 저장", async () => {
    const rows = realRows();
    const origin = realOrigin();

    /* ── 분모를 먼저 적는다 ─────────────────────────────────────────────── */
    const all = selectReviewQueue(rows, "ALL");
    const kr = selectReviewQueue(rows, "KR");
    const os = selectReviewQueue(rows, "OVERSEAS");
    const placed = new Set([...kr, ...os].map((e) => e.row.discoveredUrl));
    const unresolved = all.filter((e) => !placed.has(e.row.discoveredUrl));

    const posted: { url: string; body: Record<string, unknown> }[] = [];
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posted.push({
          url: String(input),
          body: JSON.parse(init.body ?? "{}") as Record<string, unknown>,
        });
      }
      return { ok: true, json: async () => ({ ok: true, reviews: [] }) } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const host = mount({ rows, originIdentity: origin });
      const reviewRows = [...host.querySelectorAll('[data-testid="mi-review-row"]')];

      /* ── ① 나란히 비교 ─────────────────────────────────────────────── */
      const table = reviewRows.map((r) => {
        const axes = REVIEW_COMPARE_AXES.map((axis) => {
          const tr = r.querySelector(`[data-testid="mi-review-axis-${axis.toLowerCase()}"]`)!;
          return {
            axis: REVIEW_COMPARE_AXIS_LABEL[axis],
            origin: txt(tr.querySelector('[data-testid="mi-review-origin-value"]')),
            candidate: txt(tr.querySelector('[data-testid="mi-review-candidate-value"]')),
          };
        });
        return {
          domain: txt(r.querySelector("p")),
          reasons: [...r.querySelectorAll('[data-testid="mi-review-reason"]')].map((e) => txt(e)),
          axes,
          canJudge: HUMAN_REVIEW_VALUES.every((v) =>
            Boolean(r.querySelector(`[data-testid="mi-select-${v.toLowerCase()}"]`)),
          ),
        };
      });

      /* ── ② 직접 판정 ─────────────────────────────────────────────── */
      await act(async () => {
        reviewRows[0]
          ?.querySelector('[data-testid="mi-select-same"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      /* ── ③ 자동 판정 불변 ─────────────────────────────────────────── */
      const systemAfter = rows
        .map((r) => `${r.discoveredUrl}|${r.crossSellerVerdict}|${r.matchTruth}|${r.priceTier}`)
        .sort();

      /* eslint-disable no-console */
      console.log(
        "\n[FINAL-03-E2E] " +
          JSON.stringify(
            {
              snapshot: fixture().snapshot.id,
              origin: { brand: origin.brand, modelCode: origin.modelCode, title: origin.title },
              denominator: { candidates: rows.length, reviewQueue: all.length },
              groups: {
                [CANDIDATE_LIST_HEADING.KR]: kr.length,
                [CANDIDATE_LIST_HEADING.OVERSEAS]: os.length,
                [REVIEW_UNRESOLVED_MARKET_HEADING]: unresolved.length,
              },
              screenRows: reviewRows.length,
              judgePost: posted.map((p) => ({
                endpoint: p.url.replace(/^.*\/api/, "/api"),
                candidateUrl: p.body.candidateUrl,
                humanVerdict: p.body.humanVerdict,
                contextKeys: Object.keys(
                  (p.body.candidate ?? {}) as Record<string, unknown>,
                ).length,
              })),
              rows: table,
            },
            null,
            1,
          ),
      );
      /* eslint-enable no-console */

      /* ── 단언 ─────────────────────────────────────────────────────── */
      expect(rows, "🔴 입력 분모가 10 이 아니다").toHaveLength(10);
      /**
        * 🔵🔵 MI-CANDIDATE-ELIGIBILITY-01 — **8 → 2.** 원상품과 연결 근거가 없는
        *    후보 6건이 검토 대기에서 빠졌다(CEO 가 「왜 후보까지 온거지?」라 한 그것).
        * 🔵🔵🔵 **MCQ-02(CPO 판정 2026-11-23) — 2 → 1.** 「브랜드만 같은」 후보
        *    (`kids-world` 「Bobo Choses 맨투맨 …」)가 하나 더 빠졌다.
        *    🔴 사유는 **다국어가 아니다** — 원상품 식별어 `pop` 이 그 제목에 없다.
        */
      expect(reviewRows, "🔴 화면 검토 행이 1개가 아니다").toHaveLength(1);
      expect(kr.length + os.length + unresolved.length, "🔴 구역 합이 전체와 다르다").toBe(all.length);
      /** ① 세 축이 **행마다** 원상품/후보 둘 다 채워져 있다(빈 칸 0). */
      for (const r of table) {
        expect(r.axes, "🔴 축이 셋이 아니다").toHaveLength(3);
        for (const a of r.axes) {
          expect(a.origin.length, `🔴 원상품 ${a.axis} 칸이 비었다`).toBeGreaterThan(0);
          expect(a.candidate.length, `🔴 후보 ${a.axis} 칸이 비었다`).toBeGreaterThan(0);
        }
        /** ② 네 선택지가 **행마다** 있다. */
        expect(r.canJudge, `🔴 ${r.domain} 에서 판정할 수 없다`).toBe(true);
        expect(r.reasons.length, `🔴 ${r.domain} 에 보류 사유가 없다`).toBeGreaterThan(0);
      }
      /** ③ 저장은 **기존 API** 로 가고 자동 판정은 **그대로** 다. */
      expect(posted, "🔴 판정 저장 POST 가 나가지 않았다").toHaveLength(1);
      expect(posted[0]!.url).toContain(`/${fixture().snapshot.id}/candidate-reviews`);
      expect(posted[0]!.body.humanVerdict).toBe("SAME");
      expect(
        rows
          .map((r) => `${r.discoveredUrl}|${r.crossSellerVerdict}|${r.matchTruth}|${r.priceTier}`)
          .sort(),
        "🔴 사람 판정이 자동 판정을 덮었다",
      ).toEqual(systemAfter);
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
