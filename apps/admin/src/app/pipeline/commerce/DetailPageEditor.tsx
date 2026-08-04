"use client";

import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type { CoupangPayload, DetailPageBlock } from "@commerce/listing";
import { detailBlockLabel } from "@commerce/listing";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
}: {
  product: CanonicalProduct;
  blocks: DetailPageBlock[];
  onChange: (blocks: DetailPageBlock[]) => void;
  payloadPreview?: { payload: CoupangPayload } | null;
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-tertiary">
        상세페이지에 들어갈 블록의 순서와 노출 여부를 정합니다 — 여기서 끄지 않으면 아래 순서
        그대로 쿠팡에 등록됩니다.
      </p>

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
