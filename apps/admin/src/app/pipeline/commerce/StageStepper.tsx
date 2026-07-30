"use client";

import { useState } from "react";
import type { CategorySelection } from "@commerce/category";
import { isVerifiedCategorySelected } from "@commerce/marketplace";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";

type StageStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_ACTION";
type Stage = "analyze" | "images" | "category" | "content" | "store";

const STAGE_LABELS: Record<Stage, string> = {
  analyze: "상품 분석",
  images: "이미지 준비",
  category: "카테고리 확인",
  content: "AI 콘텐츠",
  store: "스토어 등록",
};

const STAGE_ORDER: Stage[] = ["analyze", "images", "category", "content", "store"];

/**
 * PM의 5단계 SaaS 진행 UI(① 상품 분석 → ② 이미지 준비 → ③ 카테고리 확인 →
 * ④ AI 콘텐츠 → ⑤ 스토어 등록). 이 컴포넌트는 이미지 파이프라인이 이미 끝난
 * 뒤(CommerceWorkspace가 마운트된 뒤)에만 렌더링되므로 앞의 두 단계(상품
 * 분석/이미지 준비)는 항상 COMPLETED다 — 그 두 단계의 진행 중 상태는
 * page.tsx의 로딩 화면에서 별도로 보여준다(AnalysisStageIndicator).
 */
export function StageStepper({
  product,
  categoryMappings,
  onNavigate,
}: {
  product: CanonicalProduct;
  categoryMappings: Record<PlatformId, CategorySelection>;
  onNavigate: (tab: "source" | "content" | PlatformId) => void;
}) {
  // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 CP001 버그가
  // 재발한다(packages/marketplace/src/category-field.ts 주석 참고).
  const categoryDone = Object.values(categoryMappings).some(isVerifiedCategorySelected);
  const contentDone = product.titleKo.value.trim().length > 0;
  const imagesDone = product.images.length > 0;

  const statuses: Record<Stage, StageStatus> = {
    analyze: "COMPLETED",
    images: imagesDone ? "COMPLETED" : "NEEDS_ACTION",
    category: categoryDone ? "COMPLETED" : "NEEDS_ACTION",
    content: contentDone ? "COMPLETED" : "NEEDS_ACTION",
    store: imagesDone && categoryDone && contentDone ? "NEEDS_ACTION" : "LOCKED",
  };

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const nextStage = STAGE_ORDER.find((stage) => statuses[stage] !== "COMPLETED") ?? "store";

  const stageTab: Record<Stage, "source" | "content" | PlatformId> = {
    analyze: "source",
    images: "source",
    category: "smartstore",
    content: "content",
    store: "smartstore",
  };

  const nextActionMessage: Record<Stage, string> = {
    analyze: "상품 분석이 완료됐습니다",
    images: "이미지를 확인해주세요",
    category: "카테고리를 확인해주세요",
    content: "AI 상품 콘텐츠를 만들어보세요",
    store:
      statuses.store === "NEEDS_ACTION"
        ? "스토어 등록을 시작할 수 있습니다"
        : "이미지/카테고리/AI 콘텐츠를 먼저 완료해주세요",
  };

  const nextActionCta: Record<Stage, string> = {
    analyze: "상품 정보 보기",
    images: "이미지 확인하기",
    category: "카테고리 확인하기",
    content: "AI 콘텐츠 생성",
    store: "스토어 등록 준비",
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold tracking-tight text-text-primary">상품 등록 준비</h2>

      {/* 사용자가 화면에 들어오자마자 "지금 뭘 해야 하는지"부터 보이게 최상단에
       * 둔다 — 5단계 진행바 전체를 먼저 훑지 않아도 된다. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-primary-soft px-4 py-3">
        <div>
          <p className="text-xs text-primary/70">현재 단계: {STAGE_LABELS[nextStage]}</p>
          <p className="text-sm font-medium text-primary">{nextActionMessage[nextStage]}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(stageTab[nextStage])}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {nextActionCta[nextStage]} →
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDetailsExpanded((v) => !v)}
        className="mt-3 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        상세 진행과정 {detailsExpanded ? "접기 ▴" : "펼치기 ▾"}
      </button>

      {detailsExpanded && (
        <ol className="mt-3 flex flex-wrap items-center gap-y-3">
          {STAGE_ORDER.map((stage, index) => (
            <li key={stage} className="flex items-center">
              <button
                type="button"
                onClick={() => onNavigate(stageTab[stage])}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-background"
              >
                <StageIcon status={statuses[stage]} index={index + 1} />
                <span
                  className={
                    statuses[stage] === "COMPLETED"
                      ? "text-text-secondary line-through decoration-border"
                      : statuses[stage] === "LOCKED"
                        ? "text-text-tertiary"
                        : "font-medium text-text-primary"
                  }
                >
                  {STAGE_LABELS[stage]}
                </span>
              </button>
              {index < STAGE_ORDER.length - 1 && (
                <span className="mx-1 text-text-tertiary" aria-hidden>
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StageIcon({ status, index }: { status: StageStatus; index: number }) {
  if (status === "COMPLETED") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (status === "NEEDS_ACTION") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
        !
      </span>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <span className="flex h-5 w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-warning/70 text-[10px] font-bold text-white">
        ●
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border text-[9px] font-medium text-text-tertiary">
      {index}
    </span>
  );
}
