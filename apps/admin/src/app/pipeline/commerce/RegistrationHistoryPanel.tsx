"use client";

import { useState } from "react";
import type { RegistrationHistoryEntry } from "@commerce/listing";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";

const COLLAPSED_LIMIT = 5;

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "성공",
  FAILED: "실패",
};

const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "text-success",
  FAILED: "text-error",
};

/** P0-C REWORK ②(CEO 실측, 2026-09-17) — DRY_RUN 결과를 "성공"이라고 부르지
 * 않는다. coupangExecutor는 DRY_RUN일 때 쿠팡 등록 API를 한 번도 호출하지 않고
 * payload 조립(/api/coupang/payload-preview)만 한 뒤 status="SUBMITTED"를
 * 돌려준다(packages/listing/src/executors/coupang.executor.ts:56, :105).
 * 그 값을 이 표가 "성공"으로 적었기 때문에 셀러가 "등록됐다"로 읽었다 —
 * 같은 상태값이라도 실제 API를 부른 LIVE와 부르지 않은 DRY_RUN은 다르게 적는다. */
function statusLabel(status: string, mode: string): string {
  if (status === "SUBMITTED" && mode !== "LIVE") return "미리보기";
  return STATUS_LABEL[status] ?? status;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Sprint A-6(작업4 — 등록 소요시간 측정) — CPO 예시 형식("2분 31초") 그대로. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

export function RegistrationHistoryPanel({ history }: { history: RegistrationHistoryEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  if (history.length === 0) return null;

  // P1-UI Epic 8 — 이력이 쌓일수록 화면을 길게 늘어뜨리지 않는다. 최근 5건만
  // 기본으로 보여주고, 전체를 봐야 할 때만(재고/오류 추적 등) 펼친다.
  const visible = showAll ? history : history.slice(0, COLLAPSED_LIMIT);

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-text-primary">등록 이력</h3>
        {history.length > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            {showAll ? "최근 5건만 보기" : `전체보기 (${history.length}건)`}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        이 세션에서 시도한 등록 기록입니다 — 새로고침하면 초기화됩니다.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {visible.map((entry, index) => (
          <li key={index} className="flex items-center justify-between gap-2 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary">{entry.productName}</p>
              <p className="text-text-secondary">
                {PLATFORM_ADAPTERS[entry.platform].label} ·{" "}
                <span className={entry.mode === "LIVE" ? "font-semibold text-error" : undefined}>
                  {entry.mode}
                </span>{" "}
                · {formatTime(entry.executedAt)}
              </p>
              {entry.result.status === "FAILED" && entry.result.error && (
                <p className="mt-0.5 text-error">{entry.result.error.message}</p>
              )}
              {/* N-3.70 STEP7 — 위 ListingSection.tsx와 같은 이유로 플랫폼별
               * 라벨을 분기한다(등록 이력에서도 SmartStore 건에 "쿠팡 상품
               * ID"가 뜨던 버그). */}
              {entry.result.externalProductId && (
                <p className="mt-0.5 text-text-secondary">
                  {entry.platform === "coupang" ? "쿠팡 상품 ID" : "네이버 상품번호"}: {entry.result.externalProductId}
                </p>
              )}
              {/* N-4.12 STEP10(대표님 지시: "등록 성공인데 실제 상품 ID가 없는
               * 애매한 상태가 없는지 확인") — 실제 코드 조사 결과, 쿠팡/네이버
               * 등록 API가 SUCCESS를 반환해도 응답 바디에 상품 ID가 없는
               * 경우(register/route.ts: `parsed.data != null ? ... : undefined`)
               * SUBMITTED로 저장되면서 상품 ID만 조용히 비어있었다 — 새 상태를
               * 만들지 않고, 바로 이 화면에서 그 애매함을 숨기지 않고 그대로
               * 보여준다. */}
              {/* P0-C REWORK ②(CEO 실측, 2026-09-17) — 위 경고에 mode 조건이
               * 없어서, 애초에 등록 API를 부르지도 않은 DRY_RUN 건까지
               * "{채널}이 등록을 수락했지만 상품 ID를 돌려받지 못했습니다"로
               * 적혔다. DRY_RUN에 상품 ID가 없는 건 이상 징후가 아니라 당연한
               * 결과다 — 그 둘을 같은 문장으로 말하지 않는다. */}
              {entry.result.status === "SUBMITTED" && entry.mode !== "LIVE" && (
                <p className="mt-0.5 text-warning">
                  ⚠️ 미리보기(DRY_RUN)입니다 — {PLATFORM_ADAPTERS[entry.platform].label}에 등록 요청을 보내지
                  않았습니다. 등록될 데이터만 검증했고, 상품 ID가 없는 것은 정상입니다.
                </p>
              )}
              {entry.result.status === "SUBMITTED" && entry.mode === "LIVE" && !entry.result.externalProductId && (
                <p className="mt-0.5 text-warning">
                  ⚠️ {PLATFORM_ADAPTERS[entry.platform].label}이 등록을 수락했지만 상품 ID를 돌려받지 못했습니다 —
                  {entry.platform === "coupang" ? " Wing" : " 스마트스토어 센터"}에서 실제 등록 여부를 직접 확인해주세요.
                </p>
              )}
              {entry.result.externalUrl && (
                <p className="mt-0.5 text-text-secondary">{entry.result.externalUrl}</p>
              )}
              {entry.timing && (entry.timing.totalElapsedMs != null || entry.timing.editorElapsedMs != null) && (
                <p className="mt-0.5 text-text-tertiary">
                  {entry.timing.totalElapsedMs != null && `전체 ${formatDuration(entry.timing.totalElapsedMs)}`}
                  {entry.timing.totalElapsedMs != null && entry.timing.editorElapsedMs != null && " · "}
                  {entry.timing.editorElapsedMs != null && `입력 ${formatDuration(entry.timing.editorElapsedMs)}`}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 font-medium ${entry.result.status === "SUBMITTED" && entry.mode !== "LIVE" ? "text-text-secondary" : (STATUS_CLASS[entry.result.status] ?? "text-text-secondary")}`}
            >
              {statusLabel(entry.result.status, entry.mode)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
