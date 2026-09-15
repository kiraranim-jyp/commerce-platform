"use client";

import { MANUFACTURER_SOURCE_LABEL } from "@commerce/listing";
import type { ManufacturerResolutionState } from "./use-manufacturer-resolution";

/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사를 말하는 화면은 하나다.**
 *
 * 세 탭(스마트스토어 · 쿠팡 · 롯데ON)이 이 컴포넌트 하나를 쓴다. 그래서 "쿠팡만
 * ⚠ 제조사 없음이 남는" 상태가 **구조적으로** 성립하지 않는다 — 판정도
 * (resolveManufacturer) 문장도(여기) 한 벌뿐이기 때문이다.
 *
 * 예전에는 이 문단이 PlatformPreview 안에 인라인으로 있었고, 그것이 읽던 값은
 * `naverResolved.notice.manufacturer`였다 — 스마트스토어 탭에서만 채워지는
 * prop이라 쿠팡 탭에서는 항상 "없음"으로 읽혔다.
 *
 * 🔴 값을 지어내지 않는다. NONE은 "어디까지 찾아봤는지"를 적고 실제 입력
 * 경로 두 개(이 칸 직접 입력 / Settings 브랜드 프로필)를 가리킨다.
 */
export function ManufacturerResolutionNote({
  resolution,
  className = "",
}: {
  resolution: ManufacturerResolutionState;
  /** 격자 안에 놓일 때 칸을 가로지르게 하는 용도(레이아웃만, 판정과 무관). */
  className?: string;
}) {
  // 상품 원문이 이미 답한 경우 — 입력칸에 그 값이 그대로 보인다. 같은 말을
  // 한 번 더 적지 않는다.
  if (resolution.source === "PRODUCT") return null;

  if (resolution.loading) {
    return (
      <p
        data-manufacturer-note="LOADING"
        className={`rounded bg-background px-2 py-1.5 text-[11px] text-text-tertiary ${className}`}
      >
        제조사 출처를 확인하고 있습니다 — 상품 원문 → 브랜드 프로필 → 판매자 기본정보 순서로 찾습니다.
      </p>
    );
  }

  if (resolution.resolved) {
    return (
      <p
        data-manufacturer-note={resolution.source}
        className={`rounded bg-selected-soft px-2 py-1.5 text-[11px] text-selected ${className}`}
      >
        🔵 상품 원문에 제조사가 없어 {MANUFACTURER_SOURCE_LABEL[resolution.source]}의 제조사{" "}
        <strong>{resolution.value}</strong>가 자동으로 적용됩니다 — 위 칸에 직접 입력하면 그 값이 우선합니다.
      </p>
    );
  }

  return (
    <p
      data-manufacturer-note="NONE"
      className={`rounded bg-warning-soft px-2 py-1.5 text-[11px] text-warning ${className}`}
    >
      ⚠ 제조사 정보가 없습니다 — 상품 원문 → 브랜드 프로필 → 판매자 기본정보를 확인했지만 제조사 정보가
      없습니다. 위에서 직접 입력하거나 Settings → 브랜드 프로필에서 제조사를 등록하면 해당 브랜드 상품에 자동
      적용됩니다.
    </p>
  );
}
