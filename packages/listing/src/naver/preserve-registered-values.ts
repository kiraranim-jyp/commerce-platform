import type { NaverProductRegistrationPayload } from "./types";
import type { RegisteredProductSnapshot } from "./update-preflight";
import { resolveUpdateSellerTags, type SellerTagsUpdateDecision } from "./seller-tags-update";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-7(CTO 지시 §6, 2026-09-26)
 * **수정은 «고친 것만» 바꾼다 — 나머지는 지금 등록된 값 그대로.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production 에서 셀러가 상품명에 「!」 하나를 붙였는데 재고가 7 → 999 로,
 * 상세설명이 1907자 → 1835자로 같이 바뀐다는 것이 드러났다. UX 문제가 아니다 —
 * 실제로 그렇게 나간다.
 *
 * ── 왜 그런가 ────────────────────────────────────────────────────────────
 * UPDATE payload 는 CREATE 와 «같은 빌더» 로 만든다(F-2, 그 판단은 옳다). 그런데
 * 그 빌더가 채우는 값은 전부 «우리 Master» 다:
 *
 *     name           ← Master title 에서 파생
 *     salePrice      ← listing.priceKrw
 *     stockQuantity  ← product.stockQuantity.value || 1      ← 999
 *     detailContent  ← 블록·템플릿으로 «생성»                  ← 1835자
 *
 * 그리고 네이버 수정은 «전체 교체» 다. 그래서 상품명 한 글자를 고쳐도 나머지
 * 칸이 전부 Master 값으로 덮인다. 셀러가 스마트스토어에서 직접 고쳐 둔 재고와
 * 상세설명이 «조용히» 되돌아간다.
 *
 * 🔴 이것은 F-14-6a(전시 상태)와 «같은 축의 사고» 다. 그때는 한 칸이었고, 이번은
 * 상품 내용 전체다.
 *
 * ── 고치는 방향(CTO §6 명시) ─────────────────────────────────────────────
 * 「변경된 필드만 PUT 에 넣자」로 바꾸지 «않는다». 전체 교체라 그러면 나머지가
 * 지워진다. 보내는 것은 여전히 전체 payload 이고, 그 내용이 이렇게 된다:
 *
 *     전체 payload = 지금 등록된 값(GET) + 셀러가 «실제로 고친» 값
 *
 * ── 🔴 무엇을 되돌릴 수 «있는가» ─────────────────────────────────────────
 * 되돌릴 수 있는 것은 «GET 에서 값 자체를 읽은» 축뿐이다. 이미지·옵션·고시는
 * 개수와 존재만 읽으므로(F-13 §표) 내용을 복원할 수단이 없다 — 그 축은 여전히
 * Master 값으로 나간다. 그 사실을 숨기지 않고 `unpreservable` 로 알린다.
 */

/** 지금 등록된 값으로 되돌릴 수 있는 축 — GET 에서 «값» 을 읽는 것만. */
export const PRESERVABLE_UPDATE_FIELDS = ["name", "salePrice", "stockQuantity", "detailContent"] as const;

export type PreservableUpdateField = (typeof PRESERVABLE_UPDATE_FIELDS)[number];

export interface PreserveRegisteredValuesResult {
  payload: NaverProductRegistrationPayload;
  /** 지금 등록된 값으로 되돌린 축. */
  preserved: PreservableUpdateField[];
  /**
   * ══ 🔴 P5.6 P2(CPO 결정, 2026-10-09) — **태그는 다른 축이다.** ════════════
   *
   * 위 네 축은 「셀러가 안 고쳤으면 GET 값으로 되돌린다」다. 태그는 그 규칙으로
   * 다룰 수 없다 — 보내면 «전체 교체» 이고 안 보내면 네이버가 «지운다»
   * (기술지원 #1650). 「그대로 두기」가 없다.
   *
   * 그래서 판정을 `resolveUpdateSellerTags` 한 곳에 두고 그 결과를 여기 담는다.
   * 🔴 `PRESERVABLE_UPDATE_FIELDS` 에 넣지 «않았다» — 그 배열은 「GET 값으로
   *    덮어쓰면 되는 축」이라는 뜻이고, 태그는 합쳐야 하므로 의미가 다르다.
   *    한 배열에 섞으면 다음 사람이 태그도 단순 복원으로 다룬다.
   */
  sellerTags: SellerTagsUpdateDecision;
  /**
   * 🔴 셀러가 고치지 «않았는데» 되돌리지도 못한 축. 이대로 보내면 Master 값으로
   * 덮인다 — 호출부가 «보내지 않는다». 값을 모르면 멈추는 쪽이 맞다.
   */
  unpreservable: PreservableUpdateField[];
}

function readSnapshot(
  snapshot: RegisteredProductSnapshot,
  field: PreservableUpdateField,
): string | number | undefined {
  switch (field) {
    case "name":
      return snapshot.name ?? undefined;
    case "salePrice":
      return typeof snapshot.salePrice === "number" ? snapshot.salePrice : undefined;
    case "stockQuantity":
      return typeof snapshot.stockQuantity === "number" ? snapshot.stockQuantity : undefined;
    case "detailContent":
      return snapshot.detailContent ?? undefined;
  }
}

/**
 * 셀러가 고치지 않은 축을 «지금 등록된 값» 으로 되돌린다.
 *
 * @param editedFields 셀러가 이번에 «실제로 고친» 축. 🔴 이 목록은 판단이 아니라
 *   의도다 — 무엇을 되돌릴지는 여기서 정하고, 되돌리는 «값» 은 호출부가 채널에서
 *   직접 읽은 snapshot 에서만 온다. 그래서 이 목록이 틀려도 남의 값이 들어갈
 *   길은 없다(최악의 경우 지금처럼 Master 값이 나갈 뿐이고, 그것은 아래
 *   `unpreservable` 이 아니라 셀러가 고쳤다고 «말한» 축에 한한다).
 */
export function preserveRegisteredValues(
  payload: NaverProductRegistrationPayload,
  snapshot: RegisteredProductSnapshot,
  editedFields: readonly string[],
): PreserveRegisteredValuesResult {
  /* ══ 🔴 P5.6 P2(CPO 결정) — 태그 축을 «먼저» 정한다 ══════════════════════
     CPO: 「CREATE/UPDATE 모두 동일한 기존 + 사용자/AI → dedupe · 생략으로
     삭제되는 상황 방지 · 명시적 삭제만 삭제 의도로 인정」.

     🔴 「셀러가 태그를 고쳤는가」는 editedFields 로 가른다 — 이미 있는 축이고,
        새 신호를 만들지 않는다. 목록이 비었다는 사실만으로는 「지우려 했다」와
        「원래 없었다」를 구별할 수 없다. */
  const sellerTags = resolveUpdateSellerTags({
    ourTags: payload.originProduct.detailAttribute?.seoInfo?.sellerTags?.map((tag) => tag.text) ?? [],
    channelTags: snapshot.sellerTags,
    sellerEditedTags: editedFields.includes("keywords"),
  });
  const origin = payload.originProduct;
  /* 🔴 원본을 건드리지 않는다. 호출부가 같은 payload 로 보고서를 만들고 있을 수
     있고, 그 둘이 갈라지면 「본 것과 나간 것」이 달라진다. */
  const next = { ...payload, originProduct: { ...origin } } as NaverProductRegistrationPayload;
  const preserved: PreservableUpdateField[] = [];
  const unpreservable: PreservableUpdateField[] = [];

  for (const field of PRESERVABLE_UPDATE_FIELDS) {
    /* 셀러가 고친 축은 그대로 둔다 — 고치라고 만든 화면이다. */
    if (editedFields.includes(field)) continue;
    const registered = readSnapshot(snapshot, field);
    if (registered === undefined) {
      /* 🔴 읽지 못한 값을 Master 값으로 «대신» 보내지 않는다. 그 대체가 사고다. */
      unpreservable.push(field);
      continue;
    }
    (next.originProduct as unknown as Record<string, unknown>)[field] = registered;
    preserved.push(field);
  }

  /* 🔴 판정 결과를 payload 에 «반영» 한다. 선언만 하고 넘기지 않는 실수가 이
     저장소에서 세 번 났다(certificationTargetExcludeContent · validator 인자 ·
     빌더 인자). 여기서 반영하지 않으면 CREATE 값이 그대로 나가 채널 태그가 덮인다. */
  const attr = next.originProduct.detailAttribute;
  if (attr) {
    const nextAttr = { ...attr };
    if (sellerTags.action === "SEND") {
      nextAttr.seoInfo = { ...nextAttr.seoInfo, sellerTags: sellerTags.tags };
    } else {
      /* CLEAR 와 UNKNOWN 은 둘 다 «우리가 만든 목록을 보내지 않는다».
         CLEAR  — 셀러가 비웠다. 빈 값을 보내면 네이버가 지운다(의도대로다).
         UNKNOWN — 보내도 지우고 안 보내도 지운다. 이 축을 건드리지 않고
                   호출부가 그 사실을 셀러에게 알린다(reason 에 적혀 있다). */
      if (sellerTags.action === "CLEAR") {
        nextAttr.seoInfo = { ...nextAttr.seoInfo, sellerTags: [] };
      } else {
        delete nextAttr.seoInfo;
      }
    }
    next.originProduct = { ...next.originProduct, detailAttribute: nextAttr };
  }

  return { payload: next, preserved, unpreservable, sellerTags };
}
