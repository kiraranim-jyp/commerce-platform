"use client";

import type { CategorySelection } from "@commerce/category";
import { isVerifiedCategorySelected } from "@commerce/marketplace";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import {
  PREPARE_ITEM_LABELS,
  PREPARE_ITEM_ORDER,
  STAGE_LABELS,
  STAGE_ORDER,
  resolveStageProgress,
  type PrepareItemKey,
  type StageKey,
  type StageStatus,
} from "./stage-progress";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 상단 진행 표시를 판단 중심 4단계로 바꾼다.
 *
 *   ① 상품 수집  →  ② ⭐ 시장 판단  →  ③ 등록 준비  →  ④ 커머스 등록
 *
 * 기존 5단계는 전부 등록 작업이라 화면이 언제나 "카테고리를 확인해주세요"를
 * 가리켰다 — 팔지 말지도 정하지 않은 셀러에게 등록을 재촉하는 순서였다.
 * 판단(②)을 독립 단계로 올리고, 이미지/카테고리/AI 콘텐츠는 ③ 안의 항목으로
 * 내린다. 단계 판정 규칙 자체는 stage-progress.ts에 그대로 옮겨 두었고
 * (테스트로 고정), 특히 카테고리 확정 조건은 한 글자도 바꾸지 않았다 —
 * 실제 등록 payload에 들어가는 값이라 없어지면 register API가 CP001로 거부한다.
 *
 * 이 컴포넌트는 이미지 파이프라인이 끝난 뒤(CommerceWorkspace 마운트 후)에만
 * 렌더링되므로 ①은 항상 완료다 — 수집 진행 상태는 page.tsx의 로딩 화면
 * (AnalysisStageIndicator)이 따로 보여준다.
 */
export function StageStepper({
  product,
  categoryMappings,
  verdictKnown,
  onNavigate,
  onFocusMarket,
}: {
  product: CanonicalProduct;
  categoryMappings: Record<PlatformId, CategorySelection>;
  /** 시장 판단 결과가 이미 나왔는가. 아직이면 ②가 "분석 중"으로 남는다. */
  verdictKnown: boolean;
  onNavigate: (tab: "source" | "content" | PlatformId) => void;
  /** ②를 눌렀을 때 판단 카드로 스크롤. 없으면 상품정보 탭 이동만 한다. */
  onFocusMarket?: () => void;
}) {
  // isVerifiedPlatformCode까지 확인해야 한다 — state만 보면 CP001 버그가
  // 재발한다(packages/marketplace/src/category-field.ts 주석 참고).
  const categoryDone = Object.values(categoryMappings).some(isVerifiedCategorySelected);
  const progress = resolveStageProgress({
    imagesDone: product.images.length > 0,
    categoryDone,
    contentDone: product.titleKo.value.trim().length > 0,
    verdictKnown,
  });
  const { statuses, currentStage, pendingPrepareItems } = progress;

  /** ③ 안의 항목별 이동 위치. 카테고리는 플랫폼 탭에만 있으므로 기존 대상 그대로다. */
  const prepareItemTab: Record<PrepareItemKey, "source" | "content" | PlatformId> = {
    images: "source",
    category: "smartstore",
    content: "content",
  };

  const nextActionMessage: Record<StageKey, string> = {
    collect: "상품 수집이 끝났습니다",
    market: verdictKnown ? "시장 판단이 준비됐습니다" : "한국 시장 기준으로 판단하는 중입니다",
    prepare:
      pendingPrepareItems.length > 0
        ? `${pendingPrepareItems.map((k) => PREPARE_ITEM_LABELS[k]).join(" · ")}을(를) 확인해주세요`
        : "등록 준비가 끝났습니다",
    register:
      statuses.register === "NEEDS_ACTION"
        ? "커머스에 등록할 수 있습니다"
        : "등록 준비 항목을 먼저 마무리해주세요",
  };

  const nextActionCta: Record<StageKey, string> = {
    collect: "상품 정보 보기",
    market: "시장 판단 보기",
    prepare: pendingPrepareItems.length > 0 ? `${PREPARE_ITEM_LABELS[pendingPrepareItems[0]]} 확인하기` : "등록 준비 확인",
    register: "커머스 등록",
  };

  function goToStage(stage: StageKey) {
    if (stage === "market") {
      onNavigate("source");
      onFocusMarket?.();
      return;
    }
    if (stage === "collect") {
      onNavigate("source");
      return;
    }
    if (stage === "prepare") {
      onNavigate(prepareItemTab[pendingPrepareItems[0] ?? "category"]);
      return;
    }
    onNavigate("smartstore");
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      {/* MI-FLOW-2 — 진행바를 접어두지 않는다. 4칸이면 한 줄에 들어가고,
          "지금 어디쯤인지"는 첫 화면에서 보여야 하는 정보다(기존에는 5칸이라
          기본 접힘이었고, 그래서 대부분의 셀러가 단계 자체를 본 적이 없다). */}
      <ol className="flex flex-wrap items-center gap-y-2">
        {STAGE_ORDER.map((stage, index) => (
          <li key={stage} className="flex items-center">
            <button
              type="button"
              onClick={() => goToStage(stage)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-background ${
                stage === currentStage ? "bg-primary-soft" : ""
              }`}
            >
              <StageIcon status={statuses[stage]} index={index + 1} />
              <span
                className={
                  stage === currentStage
                    ? "font-semibold text-primary"
                    : statuses[stage] === "COMPLETED"
                      ? "text-text-secondary"
                      : statuses[stage] === "LOCKED"
                        ? "text-text-tertiary"
                        : "font-medium text-text-primary"
                }
              >
                {/* ②는 이 제품의 핵심 단계다 — 나머지와 같은 무게로 두면 다시
                    "등록 도구"로 읽힌다. ⭐는 장식이 아니라 그 위계 표시다. */}
                {stage === "market" ? "⭐ " : ""}
                {STAGE_LABELS[stage]}
              </span>
            </button>
            {index < STAGE_ORDER.length - 1 && (
              <span className="mx-0.5 text-text-tertiary" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* 지금 무엇을 하면 되는지 한 줄. 진행바를 다 훑지 않아도 되게 바로 아래 둔다. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-primary-soft px-4 py-3">
        <div>
          <p className="text-xs text-primary/70">현재 단계: {STAGE_LABELS[currentStage]}</p>
          <p className="text-sm font-medium text-primary">{nextActionMessage[currentStage]}</p>
        </div>
        <button
          type="button"
          onClick={() => goToStage(currentStage)}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {nextActionCta[currentStage]} →
        </button>
      </div>

      {/* ③ 안의 항목을 단계로 승격하지 않고 항목으로 나열한다 — 카테고리는
          여전히 등록에 반드시 필요하지만(payload 값), 그것이 화면의 헤드라인
          단계일 이유는 없다. 항목별 이동은 기존과 같은 탭으로 간다. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-[11px]">
        <li className="text-text-tertiary">등록 준비 항목</li>
        {PREPARE_ITEM_ORDER.map((key) => {
          const done = !pendingPrepareItems.includes(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate(prepareItemTab[key])}
                className="flex items-center gap-1 hover:underline"
              >
                <span className={done ? "text-success" : "text-warning"}>{done ? "✓" : "⚠"}</span>
                <span className={done ? "text-text-secondary" : "font-medium text-text-primary"}>
                  {PREPARE_ITEM_LABELS[key]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
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
