"use client";

import type { CategorySelection } from "@commerce/category";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";

type StepStatus = "DONE" | "NEEDS_ACTION" | "BLOCKED";
type Step = "product" | "images" | "category" | "content" | "store";

const STEP_LABELS: Record<Step, string> = {
  product: "상품 정보",
  images: "이미지",
  category: "카테고리",
  content: "AI 상품 콘텐츠",
  store: "스토어 등록",
};

export function ReadinessChecklist({
  product,
  categoryMappings,
  onNavigate,
}: {
  product: CanonicalProduct;
  categoryMappings: Record<PlatformId, CategorySelection>;
  onNavigate: (tab: "source" | "content" | PlatformId) => void;
}) {
  const categoryDone = Object.values(categoryMappings).some(
    (c) => c.state === "SELECTED" || c.state === "CONFIRMED",
  );
  const contentDone = product.titleKo.value.trim().length > 0;
  const imagesDone = product.images.length > 0;

  const statuses: Record<Step, StepStatus> = {
    product: "DONE",
    images: imagesDone ? "DONE" : "NEEDS_ACTION",
    category: categoryDone ? "DONE" : "NEEDS_ACTION",
    content: contentDone ? "DONE" : "NEEDS_ACTION",
    store: imagesDone && categoryDone && contentDone ? "NEEDS_ACTION" : "BLOCKED",
  };

  const order: Step[] = ["product", "images", "category", "content", "store"];
  const nextStep = order.find((step) => statuses[step] !== "DONE") ?? "store";

  const nextAction: Record<Step, { message: string; cta: string; tab: "source" | "content" | PlatformId }> = {
    product: { message: "상품 정보를 확인해주세요", cta: "상품 정보 보기", tab: "source" },
    images: { message: "이미지를 확인해주세요", cta: "이미지 확인하기", tab: "source" },
    category: { message: "카테고리를 선택해주세요", cta: "카테고리 선택하기", tab: "smartstore" },
    content: { message: "AI 상품 콘텐츠를 만들어보세요", cta: "AI 콘텐츠 생성", tab: "content" },
    store: { message: "스토어 등록을 시작할 수 있습니다", cta: "스토어 등록 준비", tab: "smartstore" },
  };

  const action = nextAction[nextStep];

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold tracking-tight text-text-primary">상품 등록 준비</h2>

      <ol className="mt-3 space-y-1.5">
        {order.map((step) => (
          <li key={step} className="flex items-center gap-2 text-sm">
            <StepIcon status={statuses[step]} isCurrent={step === nextStep} />
            <span
              className={
                statuses[step] === "DONE"
                  ? "text-text-secondary line-through decoration-border"
                  : statuses[step] === "BLOCKED"
                    ? "text-text-tertiary"
                    : "font-medium text-text-primary"
              }
            >
              {STEP_LABELS[step]}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-primary-soft px-4 py-3">
        <p className="text-sm font-medium text-primary">{action.message}</p>
        <button
          type="button"
          onClick={() => onNavigate(action.tab)}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {action.cta} →
        </button>
      </div>
    </section>
  );
}

function StepIcon({ status, isCurrent }: { status: StepStatus; isCurrent: boolean }) {
  if (status === "DONE") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (isCurrent) {
    return <span className="h-4 w-4 shrink-0 rounded-full bg-warning" aria-hidden />;
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border" aria-hidden />;
}
