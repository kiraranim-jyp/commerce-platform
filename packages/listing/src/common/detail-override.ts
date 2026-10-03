import { resolveDetailBlocks, type DetailPageBlock } from "../coupang/build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 — 상품별 상세페이지 override (CEO 확정 2026-10-03, 방안 B + key ⓒ)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 셀러는 상세페이지 구성을 Settings 에 «한 번» 저장한다. 그런데 상품마다
 * 「이 상품만 사이즈 안내를 넣자」가 생긴다. 그것을 담는 자리다.
 *
 * ── 🔴 왜 블록 전체를 상품에 복사하지 «않는가» ───────────────────────────
 * N-3.86(대표님 지시: *「설정이 공통 상세페이지의 유일한 기준」*)이 상품별
 * detailBlocks 를 **일부러 끊었다**. 상품이 블록 배열을 통째로 복사해 가지면
 * 그 순간 설정에서 «분리» 되고, 셀러가 나중에 템플릿을 고쳐도 기존 상품에
 * 반영되지 않는다 — 그것이 끊은 이유다.
 *
 * 그래서 상품은 **바꾼 것만** 갖는다(delta). 안 건드린 블록은 계속 설정이
 * 주인이고, 템플릿 변경이 그대로 전파된다.
 *
 * ── 🔴 override 가 «없으면» 기존 코드 경로와 같아야 한다 ──────────────────
 * `mergeProductDetailBlocks` 는 override 가 비면 **입력 배열을 그대로(동일
 * 참조로) 돌려준다**. 그래서 「상품에서 아무것도 수정하지 않으면 payload 가
 * byte 단위로 같다」가 테스트로 «지키는 약속» 이 아니라 **구조상 다를 수 없는
 * 사실** 이 된다. 이 early-return 을 지우면 테스트가 실패해야 한다.
 *
 * ── 🔴 식별자는 `block.id` 가 아니다 (CEO 확정 ⓒ) ────────────────────────
 * `defaultDetailBlocks()` 는 id 를 `default-${seq++}` 로 **매번 새로 만든다**.
 * 셀러가 Settings 를 다시 저장하면 id 가 달라질 수 있고, 그러면 id 로 키잉한
 * 상품 override 는 전부 고아가 된다. 그래서 **의미/위치** 로 키잉한다:
 *
 *     AI_DESCRIPTION              → "AI_DESCRIPTION"
 *     TEMPLATE_SECTION(shipping)  → "TEMPLATE_SECTION:shipping"
 *     COMMON_IMAGE(top)           → "COMMON_IMAGE:top"
 *     CUSTOM_TEXT                 → "CUSTOM_TEXT:<customTextId>"   ← 별도 안정 ID
 *
 * `CUSTOM_TEXT` 만 같은 종류를 여러 개 넣을 수 있어 의미로 구분되지 않는다.
 * 그래서 그것 하나에만 `customTextId` 를 둔다.
 *
 * ── 🔴 「삭제」는 제거가 아니라 `enabled: false` 다 ───────────────────────
 * N-4.09 가 안내문구 5종을 지울 때 *「삭제가 아니라 enabled:false 로만 바꾼다 —
 * 에디터에서 셀러가 원하면 다시 켤 수 있어야 한다」* 고 정했다. 상품 override 도
 * 같은 규칙을 따른다. 그래서 `removed` 목록이 **필요하지 않다** — 지우는 것은
 * `{ enabled: false }` patch 하나이고, 되살리는 것은 그 patch 를 지우는 것이다.
 * 목록을 따로 두면 「enabled:false 인데 removed 는 아닌」 모순 상태가 생긴다.
 */

/** 블록의 안정 식별자. `block.id` 와 «다르다» — 위 주석 참고. */
export type DetailBlockIdentity = string;

/**
 * 블록 하나의 안정 식별자를 만든다.
 *
 * 🔴 `customTextId` 가 없는 `CUSTOM_TEXT`(이 기능 이전에 저장된 셀러 기본값)는
 * 의미로 구분할 수 없으므로 **순서 기반 폴백** 을 쓴다. 폴백이라도 「같은 배열
 * 안에서는 안정」하므로 편집이 엉뚱한 블록에 붙지 않는다. 새로 추가하는
 * `CUSTOM_TEXT` 는 항상 `customTextId` 를 갖는다(`newCustomTextId`).
 *
 * @param customTextOrdinal 이 블록이 배열에서 몇 번째 `CUSTOM_TEXT` 인가(0부터).
 *        `customTextId` 가 있으면 쓰이지 않는다.
 */
export function detailBlockIdentity(block: DetailPageBlock, customTextOrdinal = 0): DetailBlockIdentity {
  switch (block.kind) {
    case "TEMPLATE_SECTION":
      return `TEMPLATE_SECTION:${block.section}`;
    case "COMMON_IMAGE":
      return `COMMON_IMAGE:${block.position}`;
    case "CUSTOM_TEXT": {
      const stable = block.customTextId;
      return stable ? `CUSTOM_TEXT:${stable}` : `CUSTOM_TEXT#${customTextOrdinal}`;
    }
    default:
      /* AI_DESCRIPTION · BRAND_INTRO · SIZE_CHART_IMAGES · PRODUCT_IMAGES —
         한 상세페이지에 한 번만 의미가 있는 블록들. */
      return block.kind;
  }
}

/** 배열 전체의 식별자를 «순서대로» 만든다 — `CUSTOM_TEXT` 폴백 번호를 맞춰 준다. */
export function detailBlockIdentities(blocks: readonly DetailPageBlock[]): DetailBlockIdentity[] {
  let customTextSeq = 0;
  return blocks.map((b) => detailBlockIdentity(b, b.kind === "CUSTOM_TEXT" ? customTextSeq++ : 0));
}

/**
 * 새 `CUSTOM_TEXT` 의 안정 ID. 🔴 **저장할 때마다 새로 만들지 않는다** — 이미
 * `customTextId` 가 있는 블록은 그대로 두고, 없는 «새» 블록에만 붙인다.
 * 그래야 기존 override 가 깨지지 않는다(CEO 지시).
 */
export function newCustomTextId(seed: number): string {
  /* 🔴 Date.now()/Math.random() 을 쓰지 않는다 — 같은 입력에서 같은 payload 가
     나와야 테스트가 byte 동일성을 잴 수 있다. 호출부가 배열 길이 같은
     결정적인 값을 넘긴다. */
  return `ct-${seed}`;
}

/** 블록 하나에 덮을 값. 지정하지 않은 칸은 셀러 기본값 그대로다. */
export interface DetailBlockPatch {
  /** 노출 여부. 🔴 「삭제」도 이것으로 표현한다(위 주석 참고). */
  enabled?: boolean;
  /** `CUSTOM_TEXT` 본문. 다른 kind 에서는 무시된다. */
  content?: string;
}

/** 상품 하나의 상세페이지 override. 🔴 아무것도 안 바꿨으면 이 객체 자체가 없다. */
export interface ProductDetailOverride {
  /** 식별자 → 덮을 값. */
  patches?: Record<DetailBlockIdentity, DetailBlockPatch>;
  /** 이 상품에만 «추가» 한 블록. 셀러 기본값에는 없다. */
  added?: DetailPageBlock[];
  /** 순서를 바꿨다면 식별자 전체 순서. 없으면 기본 순서 + `added` 를 뒤에 붙인다. */
  order?: DetailBlockIdentity[];
}

/**
 * override 가 «실질적으로» 비어 있는가. 🔴 빈 객체 `{}` · 빈 맵 · 빈 배열을
 * 모두 「없음」으로 본다 — UI 가 편집을 켰다 껐다 하면 빈 껍데기가 남는데,
 * 그것 때문에 payload 가 달라지면 안 된다.
 */
export function isEmptyDetailOverride(override: ProductDetailOverride | null | undefined): boolean {
  if (!override) return true;
  const hasPatch = Object.keys(override.patches ?? {}).length > 0;
  const hasAdded = (override.added ?? []).length > 0;
  const hasOrder = (override.order ?? []).length > 0;
  return !hasPatch && !hasAdded && !hasOrder;
}

/** patch 가 실제로 이 블록을 바꾸는가 — 같은 값이면 새 객체를 만들지 않는다. */
function applyPatch(block: DetailPageBlock, patch: DetailBlockPatch | undefined): DetailPageBlock {
  if (!patch) return block;
  const nextEnabled = patch.enabled ?? block.enabled;
  const nextContent = block.kind === "CUSTOM_TEXT" ? (patch.content ?? block.content) : undefined;
  const enabledChanged = nextEnabled !== block.enabled;
  const contentChanged = block.kind === "CUSTOM_TEXT" && nextContent !== block.content;
  if (!enabledChanged && !contentChanged) return block;
  return block.kind === "CUSTOM_TEXT"
    ? { ...block, enabled: nextEnabled, content: nextContent as string }
    : { ...block, enabled: nextEnabled };
}

/**
 * 셀러 기본 블록 + 상품 override → **최종 블록**.
 *
 * 🔴 override 가 비면 `sellerResolved` 를 **그대로(동일 참조)** 돌려준다.
 * 🔴 절대 빈 배열을 돌려주지 않는다 — `resolveDetailBlocks` 의 불변이다
 *    (빈 배열을 넘기면 build-payload 의 레거시 하드코딩 경로로 빠진다).
 */
export function mergeProductDetailBlocks(
  sellerResolved: DetailPageBlock[],
  override: ProductDetailOverride | null | undefined,
): DetailPageBlock[] {
  /* 🔴 이 한 줄이 「무편집 = byte 동일」을 구조로 보장한다. */
  if (isEmptyDetailOverride(override)) return sellerResolved;
  const ov = override as ProductDetailOverride;

  const identities = detailBlockIdentities(sellerResolved);
  const patched = sellerResolved.map((block, i) => applyPatch(block, ov.patches?.[identities[i]]));

  /* 추가 블록. 🔴 셀러 기본값과 식별자가 겹치면 «무시» 한다 — 같은 식별자가
     둘이면 patch 가 어느 쪽에 붙는지 알 수 없어진다. */
  const seen = new Set(identities);
  const addedIdentities: DetailBlockIdentity[] = [];
  const added: DetailPageBlock[] = [];
  let customTextSeq = patched.filter((b) => b.kind === "CUSTOM_TEXT").length;
  for (const block of ov.added ?? []) {
    const id = detailBlockIdentity(block, block.kind === "CUSTOM_TEXT" ? customTextSeq : 0);
    if (seen.has(id)) continue;
    if (block.kind === "CUSTOM_TEXT") customTextSeq++;
    seen.add(id);
    addedIdentities.push(id);
    added.push(applyPatch(block, ov.patches?.[id]));
  }

  const all = [...patched, ...added];
  const allIdentities = [...identities, ...addedIdentities];

  const requestedOrder = ov.order ?? [];
  if (requestedOrder.length === 0) return all;

  /* 🔴 순서 재배치는 «걸러내지» 않는다 — order 에 없는 블록도 원래 상대순서로
     뒤에 붙인다. order 를 필터로 쓰면 셀러 설정에 블록이 추가될 때 그 블록이
     조용히 사라진다(템플릿 전파가 깨진다). */
  const byIdentity = new Map<DetailBlockIdentity, DetailPageBlock>();
  allIdentities.forEach((id, i) => byIdentity.set(id, all[i]));
  const ordered: DetailPageBlock[] = [];
  const placed = new Set<DetailBlockIdentity>();
  for (const id of requestedOrder) {
    const block = byIdentity.get(id);
    if (!block || placed.has(id)) continue;
    placed.add(id);
    ordered.push(block);
  }
  allIdentities.forEach((id, i) => {
    if (!placed.has(id)) ordered.push(all[i]);
  });

  /* 🔴 불변 유지 — 어떤 경로로든 비면 셀러 기본값으로 되돌린다. */
  return ordered.length > 0 ? ordered : sellerResolved;
}

/**
 * 🔴 **서버가 detailBlocks 를 정하는 유일한 통로.** 기존 `resolveDetailBlocks`
 * 를 그대로 감싼다 — 그 함수의 계약(설정 우선 · 코드 상수 폴백 · 절대 빈 배열
 * 반환 안 함)은 건드리지 않았다.
 *
 * override 를 넘기지 않으면 `resolveDetailBlocks` 와 **완전히 같다**.
 */
export function resolveProductDetailBlocks(
  sellerDefaultDetailBlocks?: DetailPageBlock[] | null,
  override?: ProductDetailOverride | null,
): DetailPageBlock[] {
  return mergeProductDetailBlocks(resolveDetailBlocks(sellerDefaultDetailBlocks), override);
}
