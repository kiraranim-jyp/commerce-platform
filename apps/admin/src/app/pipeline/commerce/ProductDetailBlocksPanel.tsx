"use client";

import { useMemo, useState } from "react";
import {
  detailBlockIdentities,
  detailBlockIdentity,
  detailBlockLabel,
  isEmptyDetailOverride,
  mergeProductDetailBlocks,
  newCustomTextId,
  type DetailBlockIdentity,
  type DetailPageBlock,
  type ProductDetailOverride,
} from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 ⑤ — **이 상품만** 상세페이지를 바꾼다 (CEO 확정 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 설정 화면(`settings/page.tsx`)의 공통 기본값 안내문이 이미 이렇게 약속해 뒀다:
 *
 *     *「상품 등록 화면에서 이 상품만 다르게 바꿀 수도 있습니다
 *       (여기 기본값은 바뀌지 않습니다).」*
 *
 * 그런데 그 화면이 없었다. 이 패널이 그 약속을 지킨다.
 *
 * ── 🔴 이 패널은 «블록 배열을 들고 있지 않다» ────────────────────────────
 * 상태로 갖는 것은 `ProductDetailOverride`(delta) 하나다. 화면에 보이는 목록은
 * 그때그때 `mergeProductDetailBlocks(기본값, override)` 로 «계산» 한다. 배열을
 * 상태로 들면 셀러가 설정을 고쳐도 이 상품이 옛 구성에 묶여 버린다 — N-3.86 이
 * 상품별 detailBlocks 를 끊은 이유가 바로 그것이다.
 *
 * ── 🔴 「삭제」 버튼이 블록을 «지우지 않는다» ────────────────────────────
 * N-4.09 와 같은 규칙으로 `enabled:false` 를 쓴다. 그래서 셀러가 되살릴 수 있고,
 * 되살리는 것은 patch 를 지우는 것이다. 지금 화면에서도 꺼진 블록은 흐리게
 * «보인다» — 사라지면 다시 켤 방법이 없어진다.
 *
 * ── 🔴 추가할 수 있는 것 ─────────────────────────────────────────────────
 * 상품별 «이미지» 블록은 현재 `DetailPageBlock` 유니온에 자기 URL 칸이 없다
 * (COMMON_IMAGE 는 셀러 프로필 URL 을 쓴다). 그래서 이번 패널은 **모델에 이미
 * 있는 것만** 다룬다 — 안 되는 것을 「지원」으로 보이게 하지 않는다
 * (부분 구현으로 화면이 거짓말하게 만들지 않는다).
 */

/**
 * 상품에서 «추가» 할 수 있는 블록. 🔴 모델에 이미 있는 kind 만 올린다.
 *
 * 🔴 라벨을 여기서 새로 짓지 «않는다» — `detailBlockLabel()` 이 목록 행에 쓰는
 * 그 이름을 그대로 쓴다. 처음에 「상품 이미지」·「상품 상세 설명」처럼 다르게
 * 적었더니 **같은 블록이 추가 버튼과 목록 행에서 다른 이름으로 불렸다**(테스트가
 * 잡았다). 어휘가 둘로 갈리면 셀러가 같은 것을 두 개로 센다.
 */
const ADDABLE: { kind: DetailPageBlock["kind"]; label: string; hint: string }[] = [
  { kind: "CUSTOM_TEXT", label: "직접 입력 텍스트", hint: "이 상품에만 들어가는 안내 문구" },
  { kind: "SIZE_CHART_IMAGES", label: "사이즈표", hint: "수집된 사이즈표 이미지" },
  { kind: "PRODUCT_IMAGES", label: "상품 상세이미지", hint: "상품정보에서 선택한 이미지" },
  { kind: "AI_DESCRIPTION", label: "AI 생성 설명", hint: "상세설명 칸의 본문" },
  { kind: "BRAND_INTRO", label: "브랜드 소개", hint: "브랜드 관리에 저장된 소개글" },
];

function makeBlock(kind: DetailPageBlock["kind"], customTextSeed: number): DetailPageBlock | null {
  switch (kind) {
    case "CUSTOM_TEXT":
      return {
        id: `product-${customTextSeed}`,
        kind: "CUSTOM_TEXT",
        content: "",
        enabled: true,
        customTextId: newCustomTextId(customTextSeed),
      };
    case "SIZE_CHART_IMAGES":
      return { id: "product-size-chart", kind: "SIZE_CHART_IMAGES", enabled: true };
    case "PRODUCT_IMAGES":
      return { id: "product-images", kind: "PRODUCT_IMAGES", enabled: true };
    case "AI_DESCRIPTION":
      return { id: "product-description", kind: "AI_DESCRIPTION", enabled: true };
    case "BRAND_INTRO":
      return { id: "product-brand-intro", kind: "BRAND_INTRO", enabled: true };
    default:
      /* TEMPLATE_SECTION · COMMON_IMAGE 는 셀러 설정에 이미 있는 자리라 «추가» 가
         아니라 켜고 끄는 것이다 — 목록에서 토글로 다룬다. */
      return null;
  }
}

export function ProductDetailBlocksPanel({
  sellerDefaultBlocks,
  override,
  onChange,
}: {
  /** 셀러 설정의 기본 구성. 🔴 서버가 계산해 내려준 값이고 여기서 수정하지 않는다. */
  sellerDefaultBlocks: DetailPageBlock[];
  override: ProductDetailOverride | undefined;
  onChange: (next: ProductDetailOverride | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  /** 🔴 화면 목록은 «계산» 이다 — 상태가 아니다(위 주석 참고). */
  const blocks = useMemo(
    () => mergeProductDetailBlocks(sellerDefaultBlocks, override),
    [sellerDefaultBlocks, override],
  );
  const identities = useMemo(() => detailBlockIdentities(blocks), [blocks]);
  const defaultIdentities = useMemo(() => new Set(detailBlockIdentities(sellerDefaultBlocks)), [sellerDefaultBlocks]);

  const changedCount =
    Object.keys(override?.patches ?? {}).length + (override?.added ?? []).length + (override?.order ? 1 : 0);

  /** 🔴 빈 껍데기를 남기지 않는다 — 빈 override 는 `undefined` 로 접는다. */
  function commit(next: ProductDetailOverride) {
    onChange(isEmptyDetailOverride(next) ? undefined : next);
  }

  function patch(identity: DetailBlockIdentity, value: { enabled?: boolean; content?: string }) {
    const patches = { ...(override?.patches ?? {}) };
    patches[identity] = { ...patches[identity], ...value };
    commit({ ...override, patches });
  }

  function resetBlock(identity: DetailBlockIdentity) {
    const patches = { ...(override?.patches ?? {}) };
    delete patches[identity];
    /* 상품에서 «추가» 한 블록은 되돌릴 기본값이 없다 — 목록에서 뺀다. */
    /* 🔴 `customTextId` 는 CUSTOM_TEXT 에만 있다 — 좁히지 않고 읽으면 타입이
       막는다(막아 준 것이 맞다). 식별자 하나로 비교하면 충분하다: added 안에서
       몇 번째 CUSTOM_TEXT 인지를 세어 같은 규칙으로 식별자를 만든다. */
    let seq = 0;
    const added = (override?.added ?? []).filter(
      (b) => detailBlockIdentity(b, b.kind === "CUSTOM_TEXT" ? seq++ : 0) !== identity,
    );
    commit({ ...override, patches, added, order: override?.order?.filter((id) => id !== identity) });
  }

  function add(kind: DetailPageBlock["kind"]) {
    const seed = blocks.filter((b) => b.kind === "CUSTOM_TEXT").length;
    const block = makeBlock(kind, seed);
    if (!block) return;
    const id = detailBlockIdentity(block, seed);
    /* 🔴 이미 목록에 있는 것은 «추가» 가 아니라 켜는 것이다. */
    if (identities.includes(id)) {
      patch(id, { enabled: true });
      return;
    }
    commit({ ...override, added: [...(override?.added ?? []), block] });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= identities.length) return;
    const next = [...identities];
    [next[index], next[target]] = [next[target], next[index]];
    commit({ ...override, order: next });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-text-primary">
          이 상품의 상세페이지
          {changedCount > 0 ? (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {changedCount}곳 변경
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-text-tertiary">공통 설정 그대로</span>
          )}
        </span>
        <span className="text-xs text-text-secondary">{open ? "접기" : "펼치기"}</span>
      </button>

      {open ? (
        <>
          <p className="mt-2 text-xs text-text-secondary">
            설정 &gt; 상세페이지 기본 구성을 그대로 쓰고, 바꾼 것만 이 상품에 저장합니다. 공통 설정을
            나중에 고치면 여기서 바꾸지 않은 블록에는 그대로 반영됩니다.
          </p>

          <ol className="mt-3 space-y-2 text-sm">
            {blocks.map((block, index) => {
              const identity = identities[index];
              const isProductOnly = !defaultIdentities.has(identity);
              const isPatched = Boolean(override?.patches?.[identity]);
              return (
                <li
                  key={identity}
                  className={`rounded-md border p-2.5 ${block.enabled ? "border-border" : "border-border bg-background opacity-60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-background text-xs font-medium text-text-tertiary">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium text-text-primary">{detailBlockLabel(block)}</span>
                      {isProductOnly ? (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                          이 상품만
                        </span>
                      ) : null}
                      {isPatched ? (
                        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] text-text-secondary">
                          변경됨
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label="위로"
                        className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-background disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === blocks.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="아래로"
                        className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-background disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <label className="ml-1 flex items-center gap-1.5 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={block.enabled}
                          onChange={(e) => patch(identity, { enabled: e.target.checked })}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        사용
                      </label>
                      {isPatched || isProductOnly ? (
                        <button
                          type="button"
                          onClick={() => resetBlock(identity)}
                          className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-background"
                        >
                          되돌리기
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {block.kind === "CUSTOM_TEXT" ? (
                    <textarea
                      value={block.content}
                      onChange={(e) => patch(identity, { content: e.target.value })}
                      rows={2}
                      placeholder="이 상품에만 들어갈 문구"
                      className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-text-secondary">추가:</span>
            {ADDABLE.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => add(item.kind)}
                title={item.hint}
                className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-background"
              >
                + {item.label}
              </button>
            ))}
          </div>

          {/* 🔴 상품별 이미지 삽입은 모델에 자리가 없다 — 「지원」으로 보이게 하지 않는다. */}
          <p className="mt-2 text-[11px] text-text-tertiary">
            상단·하단 공통 이미지는 설정에서 관리합니다. 이 상품만의 이미지를 중간에 넣는 기능은
            아직 없습니다.
          </p>

          {changedCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="mt-3 rounded border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background"
            >
              공통 설정으로 초기화
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
