"use client";

import { useCallback, useEffect, useState } from "react";
import type { HumanReview, ReviewHistoryRow, ReviewSaveState } from "./GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **후보 선택 저장: 공용 owner 하나**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 «새 로직» 이 아니다 — `MiPanelView` 안에 있던 그 코드를 «옮긴» 것이다.**
 *    (`DomesticPriceIntelligencePanel.tsx` 의 `domesticReview` · `reviewSaveState` ·
 *     `reviewHistory` · `loadReviewHistory` · `handleDomesticReview`)
 *    🔴 CPO §4 가 **`candidate-reviews` POST 중복 구현을 금지** 했으므로 **복제하지 않고
 *       옮겼다** — 그래서 구현은 **이 파일 하나** 이고 패널은 이것을 «쓴다».
 *
 * 🔴 왜 옮겨야 했나 — 셀러가 보는 결론 영역(`MarketPriceComparison`)과 그 저장 로직이
 *    **서로 다른 컴포넌트 안** 에 갇혀 있었다. WU-152 가 패널을 `HIDDEN` 으로 둔 뒤
 *    (`return null`) **선택 UI 가 화면에서 사라졌고**, 결론 영역은 그 핸들러에 닿을 수
 *    없었다 ⟹ 「후보는 보이는데 고를 수 없다」가 CORE-E2E 의 마지막 구멍이었다.
 *
 * 🔴 저장되는 것은 **사람의 판단** 이고 **시스템 판정을 덮지 않는다**(WU-081 계약) —
 *    서버가 `system_*` 와 `human_verdict` 를 **다른 칸** 에 보존한다.
 * 🔴 이 값은 MI 입력 · 가격 집계 · 알림 · 등록 payload 에 **들어가지 않는다.**
 * 🔴 `PRESUMED_SAME` 을 고를 수 있다는 것이 **SAME 승격이 아니다**(CPO §6) —
 *    판정은 그대로 남고 **셀러의 선택 대상** 이 되는 것뿐이다.
 */
export interface CandidateReviewApi {
  /** url → 사람이 고른 판단. 🔴 시스템 판정과 **다른 칸** 이다. */
  review: Record<string, HumanReview>;
  /** 🔴 「눌렀다」가 아니라 **「저장됐다」** 를 화면이 말해야 한다(WU-131 §8). */
  saveState: Record<string, ReviewSaveState>;
  /** 🔴 `null` = **아직 안 읽었다**(「0건」이 아니다 · WU-131 §3-B). */
  history: ReviewHistoryRow[] | null;
  /** 🔴 즉시 저장한다. 실패하면 **되돌리고 말한다.** */
  onReview: (url: string, verdict: HumanReview) => void;
}

/**
 * 🔴 `enabled` — 같은 화면에 이 훅의 instance 가 **둘** 생기지 않게 하는 스위치다.
 *    패널은 운영에서 항상 `HIDDEN`(렌더 0)이므로 **끈다** ⟹ 이력 GET 이 두 번 돌지 않는다.
 * 🔴 기본값은 `true` 다 — 끄는 쪽이 **명시** 여야 한다(조용히 저장이 죽지 않게).
 */
export function useCandidateReview(
  snapshotId?: string | null,
  options?: { enabled?: boolean },
): CandidateReviewApi {
  const enabled = options?.enabled ?? true;
  const [review, setReview] = useState<Record<string, HumanReview>>({});
  const [saveState, setSaveState] = useState<Record<string, ReviewSaveState>>({});
  const [history, setHistory] = useState<ReviewHistoryRow[] | null>(null);

  /**
   * 🟢 진입할 때 **이력을 읽는다** — 이것이 「다시 들어와도 판단이 남아 있다」의 전부다.
   * 🔴 실패해도 화면을 깨뜨리지 않는다(이력은 보조 정보다).
   */
  const loadHistory = useCallback(async () => {
    /**
     * 🔴 식별자가 없으면 **부르지 않는다** — 없는 주소로 fetch 해서 404 를 「이력 0」으로
     *    읽지 않기 위해서다(렌더 전용 하니스가 그 상태다).
     */
    if (!enabled || !snapshotId) return;
    try {
      const res = await fetch(`/api/price-history/${snapshotId}/candidate-reviews`);
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean; reviews?: ReviewHistoryRow[] };
      if (!json.ok || !Array.isArray(json.reviews)) return;
      setHistory(json.reviews);
      /** 🟢 저장된 판단을 **버튼 상태로 되살린다** — 그래야 재진입 시 선택이 보인다. */
      const restored: Record<string, HumanReview> = {};
      for (const r of json.reviews) if (r.humanVerdict) restored[r.candidateUrl] = r.humanVerdict;
      setReview((prev) => ({ ...restored, ...prev }));
    } catch {
      /* 🔴 조용히 둔다 — 이력 조회 실패가 가격 화면을 깨뜨리지 않는다. */
    }
  }, [enabled, snapshotId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /**
   * 🔴 **즉시 저장** 한다(WU-131 §8). 낙관적으로 버튼을 먼저 칠하되 실패하면
   *    **되돌리고 말한다** — 저장 안 된 판단을 저장된 것처럼 보여주면 그 자체가 거짓이다.
   */
  const onReview = useCallback(
    (url: string, verdict: HumanReview) => {
      const before = review[url];
      setReview((prev) => ({ ...prev, [url]: verdict }));
      /** 🔴 식별자가 없으면 **저장했다고 말하지 않는다** — 화면 state 로만 남는다. */
      if (!snapshotId) return;
      setSaveState((prev) => ({ ...prev, [url]: "SAVING" }));
      void (async () => {
        try {
          const res = await fetch(`/api/price-history/${snapshotId}/candidate-reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidateUrl: url, humanVerdict: verdict }),
          });
          const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
          if (!res.ok || !json?.ok) throw new Error("save failed");
          setSaveState((prev) => ({ ...prev, [url]: "SAVED" }));
          await loadHistory();
        } catch {
          /** 🔴 되돌린다 — 화면이 「저장됨」이라고 거짓말하지 않게. */
          setReview((prev) => {
            const next = { ...prev };
            if (before) next[url] = before;
            else delete next[url];
            return next;
          });
          setSaveState((prev) => ({ ...prev, [url]: "ERROR" }));
        }
      })();
    },
    [review, snapshotId, loadHistory],
  );

  return { review, saveState, history, onReview };
}
