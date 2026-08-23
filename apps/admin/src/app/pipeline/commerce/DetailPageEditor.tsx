"use client";

import { useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type { CoupangPayload, DetailPageBlock } from "@commerce/listing";
import { defaultDetailBlocks, detailBlockLabel } from "@commerce/listing";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { blocksMatchDefault } from "./detail-block-compare";
import { deriveCommonImageGateStatus } from "./common-image-gate";

/** 아직 블록 리스트에 없는 옵트인 블록만 "블록 추가"에서 고를 수 있다 —
 * AI_DESCRIPTION/TEMPLATE_SECTION×5/COMMON_IMAGE×2/PRODUCT_IMAGES는
 * defaultDetailBlocks()가 항상 만들어두므로 추가 대상이 아니다. */
const ADDABLE_KINDS: Extract<DetailPageBlock["kind"], "BRAND_INTRO" | "SIZE_CHART_IMAGES" | "CUSTOM_TEXT">[] = [
  "BRAND_INTRO",
  "SIZE_CHART_IMAGES",
  "CUSTOM_TEXT",
];

let nextBlockSeq = 0;
function newBlockId(): string {
  nextBlockSeq += 1;
  return `block-${Date.now()}-${nextBlockSeq}`;
}

function createBlock(kind: (typeof ADDABLE_KINDS)[number]): DetailPageBlock {
  if (kind === "CUSTOM_TEXT") return { id: newBlockId(), kind, content: "", enabled: true };
  return { id: newBlockId(), kind, enabled: true };
}

/** 삭제 가능한 블록(옵트인 3종)인지 — 나머지는 on/off만 가능하다(계정
 * 설정/상품 데이터와 직접 연결된 핵심 블록이라 목록에서 아예 없애면 다시
 * 추가할 방법이 헷갈린다). */
function isRemovable(block: DetailPageBlock): boolean {
  return block.kind === "BRAND_INTRO" || block.kind === "SIZE_CHART_IMAGES" || block.kind === "CUSTOM_TEXT";
}

function moveBlock(blocks: DetailPageBlock[], index: number, direction: -1 | 1): DetailPageBlock[] {
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** N-4.08 P1-3(대표님 지시: "이중 게이트 UX 개선") — deriveCommonImageGateStatus()가
 * 낸 5가지 상태를 셀러 언어 문구/색으로 매핑한다. */
const COMMON_IMAGE_GATE_COPY: Record<
  ReturnType<typeof deriveCommonImageGateStatus>,
  { icon: string; text: string; className: string }
> = {
  VISIBLE: { icon: "✓", text: "상세페이지에 표시됩니다", className: "bg-success-soft text-success" },
  PRODUCT_OFF: { icon: "⚠", text: "이 상품에서는 표시되지 않습니다", className: "bg-warning-soft text-warning" },
  SELLER_OFF: {
    icon: "⚠",
    text: "기본 설정이 OFF라 상세페이지에는 표시되지 않습니다",
    className: "bg-warning-soft text-warning",
  },
  BOTH_OFF: {
    icon: "–",
    text: "기본 설정과 이 상품 모두 사용 안 함이라 표시되지 않습니다",
    className: "bg-background text-text-tertiary",
  },
  NOT_CONFIGURED: {
    icon: "–",
    text: "공통 이미지가 설정되지 않았습니다",
    className: "bg-background text-text-tertiary",
  },
};

/**
 * Detail Page Editor(2026-08-04, CEO 지시 — 백로그 A-12-5) — 쿠팡 상세페이지
 * contents 조립을 블록 단위로 켜고 끄고 순서를 바꾼다. 실제 조립은 서버
 * (assembleContentsFromBlocks, packages/listing)가 하므로 이 컴포넌트는 순서/
 * on-off만 관리하고, 최종 결과 미리보기는 CommerceWorkspace가 이미 디바운스로
 * 불러오는 payloadPreview(진짜 서버 계산 결과)를 그대로 재사용한다 — 클라이언트
 * 에서 조립 로직을 다시 만들면 "미리보기는 이런데 실제 등록은 다르다"는 CP001과
 * 같은 신뢰 문제가 재발한다.
 */
export function DetailPageEditor({
  product,
  blocks,
  onChange,
  payloadPreview,
  platformLabel = "쿠팡",
  defaultBlocks,
  sellerCommonImages,
}: {
  product: CanonicalProduct;
  blocks: DetailPageBlock[];
  onChange: (blocks: DetailPageBlock[]) => void;
  payloadPreview?: { payload: CoupangPayload } | null;
  /** Sprint P1(CPO 지시, 2026-08-19) — SmartStore 탭에서도 이 에디터를 쓰게
   * 되면서 "쿠팡에 등록됩니다" 문구가 고정 텍스트로는 틀린 말이 된다.
   * payloadPreview는 여전히 CoupangPayload 모양만 받는다(Naver 쪽 실제
   * 조립 결과 미리보기는 NaverPayloadPreview가 별도로 이미 보여주고 있어
   * 여기서 새 미리보기 렌더링을 만들지 않는다 — SmartStore 탭에서는
   * payloadPreview가 항상 null/undefined로 넘어와 이 블록만 조용히
   * 생략된다). */
  platformLabel?: string;
  /** N-4.08 P1-1(대표님 지시) — Settings에서 관리하는 셀러 기본값
   * (SellerProfile.defaultDetailBlocks). null/빈 배열이면(한 번도 설정 안 함)
   * 코드 상수 defaultDetailBlocks()로 폴백한다 — page.tsx의 신규 상품 배정
   * 로직과 동일한 계약이다. */
  defaultBlocks?: DetailPageBlock[] | null;
  /** N-4.08 P1-3(대표님 지시: "이중 게이트 UX 개선") — Settings의 공통
   * 상단/하단 이미지 URL·ON/OFF(SellerProfile.top/bottomCommonImageUrl/Enabled).
   * COMMON_IMAGE 블록 행에서 "왜 안 보이는지" 셀러에게 바로 보여주는 용도로만
   * 쓴다 — 실제 payload 조립 판정(assembleContentsFromBlocks)은 그대로 서버가
   * 한다. null이면(fetch 전/실패) 상태 표시를 생략한다(체크박스 자체는 항상
   * 그대로 동작한다). */
  sellerCommonImages?: {
    topUrl: string | null;
    topEnabled: boolean;
    bottomUrl: string | null;
    bottomEnabled: boolean;
  } | null;
}) {
  const presentKinds = new Set(blocks.map((b) => b.kind));
  const addableOptions = ADDABLE_KINDS.filter((kind) => !presentKinds.has(kind) || kind === "CUSTOM_TEXT");

  const productImageCount = product.images.filter(
    (img) => img.useInDescription && img.classification !== "SIZE_CHART",
  ).length;
  const sizeChartImages = product.images.filter(
    (img) => img.useInDescription && img.classification === "SIZE_CHART",
  );

  const previewContents = payloadPreview?.payload.items[0]?.contents ?? [];

  const effectiveDefaultBlocks = defaultBlocks && defaultBlocks.length > 0 ? defaultBlocks : defaultDetailBlocks();
  const isUsingDefault = blocksMatchDefault(blocks, effectiveDefaultBlocks);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          상세페이지에 들어갈 블록의 순서와 노출 여부를 정합니다 — 여기서 끄지 않으면 아래 순서
          그대로 {platformLabel}에 등록됩니다.
        </p>
        <Badge variant={isUsingDefault ? "default" : "warning"} size="sm" className="shrink-0">
          {isUsingDefault ? "기본 설정 사용 중" : "이 상품만 변경됨"}
        </Badge>
      </div>

      {!isUsingDefault && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowResetConfirm(true)}>
          기본 설정 다시 적용
        </Button>
      )}

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowResetConfirm(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-semibold text-text-primary">기본 설정으로 되돌릴까요?</h3>
            <p className="mt-2 text-sm text-text-secondary">
              이 상품의 상세페이지 구성만 현재 Settings 기본값으로 교체합니다. 다른 상품이나
              Settings 자체는 바뀌지 않습니다.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)}>
                취소
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onChange(effectiveDefaultBlocks.map((b) => ({ ...b })));
                  setShowResetConfirm(false);
                }}
              >
                기본 설정 적용
              </Button>
            </div>
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            className={`rounded-md border p-3 text-sm ${block.enabled ? "border-border" : "border-border bg-background opacity-60"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge size="sm" variant="default">
                  {index + 1}
                </Badge>
                <span className="font-medium text-text-primary">{detailBlockLabel(block)}</span>
                {block.kind === "PRODUCT_IMAGES" && (
                  <span className="text-xs text-text-tertiary">{productImageCount}장</span>
                )}
                {block.kind === "SIZE_CHART_IMAGES" && (
                  <span className="text-xs text-text-tertiary">{sizeChartImages.length}장</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => onChange(moveBlock(blocks, index, -1))}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === blocks.length - 1}
                  onClick={() => onChange(moveBlock(blocks, index, 1))}
                >
                  ↓
                </Button>
                <label className="ml-1 flex items-center gap-1.5 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={block.enabled}
                    onChange={(e) =>
                      onChange(blocks.map((b) => (b.id === block.id ? { ...b, enabled: e.target.checked } : b)))
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  사용
                </label>
                {isRemovable(block) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(blocks.filter((b) => b.id !== block.id))}
                  >
                    삭제
                  </Button>
                )}
              </div>
            </div>

            {block.kind === "COMMON_IMAGE" &&
              sellerCommonImages &&
              (() => {
                const sellerUrl = block.position === "top" ? sellerCommonImages.topUrl : sellerCommonImages.bottomUrl;
                const sellerEnabled =
                  block.position === "top" ? sellerCommonImages.topEnabled : sellerCommonImages.bottomEnabled;
                const status = deriveCommonImageGateStatus({
                  sellerImageUrl: sellerUrl,
                  sellerEnabled,
                  productEnabled: block.enabled,
                });
                const copy = COMMON_IMAGE_GATE_COPY[status];
                return (
                  <div className={`mt-2 space-y-1.5 rounded-md p-2 text-xs ${copy.className}`}>
                    <p>
                      기본 설정: {sellerEnabled ? "사용" : "사용 안 함"} · 현재 상품:{" "}
                      {block.enabled ? "사용" : "사용 안 함"}
                    </p>
                    <p className="font-medium">
                      {copy.icon} {copy.text}
                    </p>
                    {status === "PRODUCT_OFF" && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)}>
                        기본 설정으로 복원
                      </Button>
                    )}
                    {(status === "SELLER_OFF" || status === "NOT_CONFIGURED") && (
                      <a
                        href="/settings?tab=detail"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-medium text-primary hover:underline"
                      >
                        {status === "NOT_CONFIGURED" ? "상세페이지 설정으로 이동" : "설정에서 변경"} →
                      </a>
                    )}
                  </div>
                );
              })()}

            {block.kind === "CUSTOM_TEXT" && (
              <textarea
                value={block.content}
                onChange={(e) =>
                  onChange(blocks.map((b) => (b.id === block.id ? { ...b, content: e.target.value } : b)))
                }
                placeholder="예: 세탁 시 찬물 사용을 권장합니다."
                rows={3}
                className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
            )}
            {block.kind === "SIZE_CHART_IMAGES" && sizeChartImages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sizeChartImages.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={getSelectedImageUrl(img)}
                    alt=""
                    className="h-12 w-12 rounded border border-border object-cover"
                  />
                ))}
              </div>
            )}
            {block.kind === "BRAND_INTRO" && (
              <p className="mt-2 text-xs text-text-tertiary">
                설정 → 브랜드 관리의 브랜드 소개 문구를 그대로 씁니다. 문구를 바꾸려면 설정에서
                수정해주세요.
              </p>
            )}
          </li>
        ))}
      </ol>

      {addableOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-tertiary">블록 추가:</span>
          {addableOptions.map((kind) => (
            <Button
              key={kind}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onChange([...blocks, createBlock(kind)])}
            >
              + {kind === "BRAND_INTRO" ? "브랜드 소개" : kind === "SIZE_CHART_IMAGES" ? "사이즈표" : "직접 입력 텍스트"}
            </Button>
          ))}
        </div>
      )}

      {previewContents.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-secondary">실제 조립 결과 미리보기</p>
          <div className="mt-1.5 space-y-1.5 rounded-md bg-background p-2.5">
            {previewContents.map((content, index) =>
              content.contentsType === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={content.contentDetails[0]?.content}
                  alt=""
                  className="h-16 w-16 rounded border border-border object-cover"
                />
              ) : (
                <p key={index} className="whitespace-pre-wrap text-xs text-text-secondary">
                  {content.contentDetails.map((d) => d.content).join("\n")}
                </p>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
