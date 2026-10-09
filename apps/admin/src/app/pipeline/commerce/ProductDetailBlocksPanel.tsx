"use client";

import { useEffect, useMemo, useState } from "react";
import {
  detailBlockIdentities,
  detailBlockIdentity,
  detailBlockLabel,
  isEmptyDetailOverride,
  mergeProductDetailBlocks,
  newCustomImageId,
  newCustomTextId,
  type DetailBlockIdentity,
  type DetailBlockPatch,
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
 * ── 🔴 상품별 이미지 (SELLER-UX-FINAL) ──────────────────────────────────
 * 「이미지」와 「이미지+텍스트」는 `CUSTOM_IMAGE` **하나** 로 표현한다 — 문구가
 * 비면 이미지만, 차 있으면 이미지 아래에 문구가 붙는다. 90% 가 같은 kind 를
 * 둘로 쪼개면 조립기에 같은 분기가 두 벌 생긴다.
 *
 * 🔴 **새 이미지 저장 시스템을 만들지 않았다.** 셋 중 하나에서 URL 을 얻는다:
 *     ① 이 상품의 수집된 이미지 (이미 우리 스토리지에 있다)
 *     ② 이미지 라이브러리 (`/api/assets` — 설정·브랜드가 쓰는 그 테이블)
 *     ③ 직접 업로드 (`/api/pipeline/upload-image` — 상품정보 탭이 쓰는 그 라우트)
 *
 * 🔴 외부 사이트 이미지 주소를 «적어 넣는 칸이 없다». 조립 직전에
 * `isRegistrationSafeImageUrl`(http(s) allowlist)이 한 번 더 막는다.
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
  { kind: "CUSTOM_TEXT", label: "직접 입력 텍스트", hint: "제목 + 문구로 한 항목을 만듭니다" },
  { kind: "SIZE_CHART_IMAGES", label: "사이즈표", hint: "수집된 사이즈표 이미지" },
  { kind: "PRODUCT_IMAGES", label: "상품 상세이미지", hint: "상품정보에서 선택한 이미지" },
  { kind: "AI_DESCRIPTION", label: "AI 생성 설명", hint: "상세설명 칸의 본문" },
  { kind: "BRAND_INTRO", label: "브랜드 소개", hint: "브랜드 관리에 저장된 소개글" },
];

/** 라이브러리 목록 응답 — `/api/assets` 가 돌려주는 모양 그대로. */
interface AssetOption {
  id: string;
  url: string;
  fileName: string | null;
}

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
    case "CUSTOM_IMAGE":
      /* 🔴 url 없이 만들지 않는다 — 빈 URL 블록은 조립에서 조용히 사라져서
         셀러에게는 「추가했는데 안 나온다」로 보인다. addImage() 가 url 을
         받아 직접 만든다. */
      return null;
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
  productImageUrls = [],
}: {
  /** 셀러 설정의 기본 구성. 🔴 서버가 계산해 내려준 값이고 여기서 수정하지 않는다. */
  sellerDefaultBlocks: DetailPageBlock[];
  override: ProductDetailOverride | undefined;
  onChange: (next: ProductDetailOverride | undefined) => void;
  /** 이 상품의 수집된 이미지 URL. 🔴 이미 우리 스토리지에 올라간 것들이다. */
  productImageUrls?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  /* 🔴 P0-3 — 「고르는 중」이 «추가» 인지 «교체» 인지 구분한다. 한 상태로 합치면
     교체를 누른 뒤 고른 이미지가 새 블록으로 붙는다(순서가 또 끝으로 밀린다). */
  const [replacing, setReplacing] = useState<DetailBlockIdentity | null>(null);
  const [assets, setAssets] = useState<AssetOption[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** 🔴 화면 목록은 «계산» 이다 — 상태가 아니다(위 주석 참고). */
  const blocks = useMemo(
    () => mergeProductDetailBlocks(sellerDefaultBlocks, override),
    [sellerDefaultBlocks, override],
  );
  const identities = useMemo(() => detailBlockIdentities(blocks), [blocks]);
  const defaultIdentities = useMemo(() => new Set(detailBlockIdentities(sellerDefaultBlocks)), [sellerDefaultBlocks]);

  /* 라이브러리는 «펼칠 때» 한 번만 읽는다 — 패널을 열기만 해도 요청이 나가면
     목록 화면이 아닌 곳에서 불필요한 호출이 생긴다. */
  useEffect(() => {
    if (!picking || assets !== null) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/assets");
        const data = (await res.json()) as { assets?: AssetOption[] };
        if (alive) setAssets(data.assets ?? []);
      } catch {
        if (alive) setAssets([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [picking, assets]);

  const changedCount =
    Object.keys(override?.patches ?? {}).length + (override?.added ?? []).length + (override?.order ? 1 : 0);

  /** 🔴 빈 껍데기를 남기지 않는다 — 빈 override 는 `undefined` 로 접는다. */
  function commit(next: ProductDetailOverride) {
    onChange(isEmptyDetailOverride(next) ? undefined : next);
  }

  /* 🔴 인라인 타입을 쓰지 않는다 — 공용 `DetailBlockPatch` 를 그대로 받는다.
     처음에 `{ enabled?, content? }` 로 적었더니 caption 이 빠져 타입이 막았다
     (막아 준 것이 맞다: 목록이 두 벌로 갈리면 한쪽이 조용히 안 먹는다). */
  function patch(identity: DetailBlockIdentity, value: DetailBlockPatch) {
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

  /** 이미지 블록을 «URL 을 갖고» 만든다. 🔴 url 없이 만들지 않는다. */
  function addImage(url: string) {
    /* 🔴 교체 중이면 «추가하지 않는다» — 같은 picker 를 두 동작이 쓴다. */
    if (replacing) {
      replaceImage(replacing, url);
      return;
    }
    const seed = blocks.filter((b) => b.kind === "CUSTOM_IMAGE").length;
    const block: DetailPageBlock = {
      id: `product-image-${seed}`,
      kind: "CUSTOM_IMAGE",
      url,
      caption: "",
      enabled: true,
      customImageId: newCustomImageId(seed),
    };
    /* 같은 이미지를 두 번 넣는 것은 막지 않는다 — 상세페이지에 같은 사진을
       두 자리에 쓰는 것은 정상이고, 식별자는 순번으로 갈린다. */
    commit({ ...override, added: [...(override?.added ?? []), block] });
    setPicking(false);
    setUploadError(null);
  }

  /* ══ 🔴 P5.6 후속 P0-3(CEO 실화면 FAIL, 2026-10-10) — **이미지 교체.** ══════

     CEO: 「블록별로 이미지 + 텍스트 수정 불가」. 확인해 보니 절반만 맞았다 —
     제목·문구·caption 은 «되고» 있었고, 없던 것은 **이미지를 갈아끼우는 길** 뿐이다.
     지우고 다시 넣으면 순서가 끝으로 밀리니, 셀러에게는 「수정 불가」였다.

     🔴 `DetailBlockPatch.url` 은 **열지 않는다.** 그 금지에는 이유가 있다 —
        셀러 기본값에 있는 이미지를 상품 override 가 가리키면, 기본값을 바꿨을 때
        어느 쪽이 맞는지 알 수 없는 모순이 생긴다(detail-override.ts:180).

     🔴 대신 **상품이 «추가» 한 블록의 url 을 `added` 안에서 직접 고친다.**
        그 블록의 주인은 이 상품이므로 모순이 생기지 않는다. 셀러 기본값 이미지는
        여전히 못 바꾼다 — 숨기고(사용 해제) 새 이미지를 넣는 길만 준다. */
  function replaceImage(identity: DetailBlockIdentity, url: string) {
    const added = (override?.added ?? []).map((b) =>
      b.kind === "CUSTOM_IMAGE" && detailBlockIdentity(b, 0) === identity ? { ...b, url } : b,
    );
    commit({ ...override, added });
    setPicking(false);
    setReplacing(null);
    setUploadError(null);
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      /* 🔴 상품정보 탭이 쓰는 그 라우트다 — 새 업로드 경로를 만들지 않았다. */
      const res = await fetch("/api/pipeline/upload-image", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        setUploadError(data.error ?? "업로드에 실패했습니다.");
        return;
      }
      addImage(data.url);
    } catch {
      setUploadError("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
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
                  {/* 🔴 P5.6 P0-2(CEO 요구, 2026-10-09) — 항목 «제목».
                      CEO 가 원한 것은 블록 나열이 아니라 [상품 특징]·[사이즈 정보]
                      같은 «항목» 이다. 텍스트와 이미지가 같은 제목을 가지면 한
                      항목으로 묶여 나간다(조립기 withHeading 이 그 일을 한다).
                      🔴 비워 두면 지금까지와 «완전히 같다» — 기존 상세페이지가
                         바뀌지 않는다. */}
                  {block.kind === "CUSTOM_TEXT" || block.kind === "CUSTOM_IMAGE" ? (
                    <input
                      value={block.heading ?? ""}
                      onChange={(e) => patch(identity, { heading: e.target.value })}
                      placeholder="항목 제목(예: 상품 특징 · 사이즈 정보) — 비워도 됩니다"
                      className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-semibold text-text-primary"
                    />
                  ) : null}
                  {block.kind === "CUSTOM_TEXT" ? (
                    <textarea
                      value={block.content}
                      onChange={(e) => patch(identity, { content: e.target.value })}
                      rows={2}
                      placeholder="이 상품에만 들어갈 문구"
                      className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                    />
                  ) : null}
                  {block.kind === "CUSTOM_IMAGE" ? (
                    <div className="mt-2 flex gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={block.url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded border border-border object-cover"
                      />
                      {/* 문구를 비우면 「이미지」, 채우면 「이미지+문구」다 — 블록이
                          둘이 아니라 하나이고 라벨이 그것을 말해 준다. */}
                      <div className="flex w-full flex-col gap-1.5">
                        <textarea
                          value={block.caption ?? ""}
                          onChange={(e) => patch(identity, { caption: e.target.value })}
                          rows={2}
                          placeholder="이미지 아래에 넣을 문구(비워도 됩니다)"
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-text-primary"
                        />
                        {/* 🔴 P0-3 — 교체는 «이 상품이 추가한» 이미지에만 준다.
                            셀러 기본값 이미지는 주인이 셀러 설정이므로 여기서
                            바꾸지 않는다(바꾸면 어느 쪽이 맞는지 알 수 없어진다). */}
                        {isProductOnly ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReplacing(identity);
                              setPicking(true);
                            }}
                            className="self-start rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-background"
                          >
                            이미지 변경
                          </button>
                        ) : (
                          <span className="text-[11px] text-text-tertiary">
                            셀러 기본 상세페이지의 이미지입니다 — 바꾸려면 「사용」을 끄고 이 상품 이미지를
                            추가하세요.
                          </span>
                        )}
                      </div>
                    </div>
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
            {/* 이미지는 «URL 을 고른 뒤» 에 블록이 생긴다 — 빈 이미지 블록을
                만들지 않는다(조립에서 조용히 사라져 「추가했는데 안 나온다」가 된다). */}
            <button
              type="button"
              onClick={() => {
                setReplacing(null);
                setPicking((v) => !v);
              }}
              title="이 상품에만 넣는 이미지 — 문구를 같이 적으면 이미지+문구가 된다"
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-background"
            >
              + 이 상품 이미지
            </button>
          </div>

          {picking ? (
            <div className="mt-2 rounded-md border border-border bg-background p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-primary">이미지 고르기</span>
                <button
                  type="button"
                  onClick={() => {
                    setPicking(false);
                    /* 🔴 교체 상태를 «반드시» 푼다 — 안 풀면 다음 「이미지 추가」가 교체로 샌다. */
                    setReplacing(null);
                  }}
                  className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface"
                >
                  닫기
                </button>
              </div>

              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface">
                {uploading ? "업로드 중…" : "파일 올리기"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {uploadError ? <p className="mt-1.5 text-xs text-error">{uploadError}</p> : null}

              {productImageUrls.length > 0 ? (
                <>
                  <p className="mt-2.5 text-[11px] text-text-tertiary">이 상품의 이미지</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {productImageUrls.map((url) => (
                      <button key={url} type="button" onClick={() => addImage(url)} title="이 이미지 넣기">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="h-14 w-14 rounded border border-border object-cover hover:border-primary"
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="mt-2.5 text-[11px] text-text-tertiary">이미지 라이브러리</p>
              {assets === null ? (
                <p className="mt-1 text-xs text-text-tertiary">불러오는 중…</p>
              ) : assets.length === 0 ? (
                <p className="mt-1 text-xs text-text-tertiary">
                  저장된 이미지가 없습니다. 파일을 올리거나 이미지 관리에서 먼저 등록해 주세요.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => addImage(asset.url)}
                      title={asset.fileName ?? "이 이미지 넣기"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt=""
                        className="h-14 w-14 rounded border border-border object-cover hover:border-primary"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* 상단·하단 «공통» 이미지는 여기서 다루지 않는다 — 셀러 설정의 것이고
              상품마다 다르지 않다(CEO 지시 2026-08-24 의 경계). */}
          <p className="mt-2 text-[11px] text-text-tertiary">
            상단·하단 공통 이미지는 설정에서 관리합니다. 외부 사이트 이미지 주소를 직접 넣을 수는
            없습니다 — 올린 파일이나 수집된 이미지에서 고릅니다.
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
