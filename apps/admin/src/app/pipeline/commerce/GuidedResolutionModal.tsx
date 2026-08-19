"use client";

import { useState } from "react";
import type { PriorityItem } from "./RegistrationStatusBanner";

/**
 * N-3.55 STEP4(CPO 지시: "화면을 길게 스크롤하면서 MISSING을 찾게 하지
 * 않는다") — RegistrationStatusBanner가 만든 우선순위 항목을 하나씩
 * 보여주고, "지금 확인하기"를 누르면 실제 입력 UI가 있는 곳(기존
 * goToSection/Settings 이동, PlatformPreview.tsx가 이미 갖고 있는 메커니즘)
 * 으로 그대로 보낸다. 이 모달 안에 입력 폼을 새로 복제하지 않는다 — 입력
 * 로직이 두 곳에 있으면 결국 다른 결과를 낼 위험이 있다(이 코드베이스가
 * 여러 번 겪은 CP001류 문제와 같은 종류).
 */
export function GuidedResolutionModal({
  items,
  onClose,
  onGoToItem,
}: {
  items: PriorityItem[];
  onClose: () => void;
  onGoToItem: (item: PriorityItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const total = items.length;
  const done = index >= total;
  const current = items[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-surface p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {!done && current ? (
          <>
            <p className="text-xs font-medium text-text-tertiary">
              {index + 1} / {total}
            </p>
            <h3 className="mt-1 text-base font-semibold text-text-primary">{current.label}</h3>
            {current.detail && <p className="mt-2 text-sm text-text-secondary">{current.detail}</p>}
            {current.sourceItems.length > 1 && (
              <ul className="mt-2 space-y-0.5 text-xs text-text-tertiary">
                {current.sourceItems.map((si) => (
                  <li key={si.label}>· {si.label}{si.hint ? ` — ${si.hint}` : ""}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {current.sectionId && (
                <button
                  type="button"
                  onClick={() => onGoToItem(current)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  지금 확인하기
                </button>
              )}
              {current.externalHref && (
                <a
                  href={current.externalHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                  className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  Settings에서 확인
                </a>
              )}
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-background"
              >
                다음
              </button>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i - 1)}
                  className="px-2 py-1.5 text-sm text-text-tertiary hover:underline"
                >
                  이전
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-2xl">🎉</p>
            <h3 className="mt-1 text-base font-semibold text-text-primary">확인할 항목을 모두 살펴봤습니다</h3>
            <p className="mt-2 text-sm text-text-secondary">
              아직 남은 항목이 있다면 화면 상단 상태가 계속 알려드립니다 — 모두 해결되면 등록을 진행할 수 있습니다.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
