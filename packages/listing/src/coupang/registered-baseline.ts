/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-IMPLEMENT-01 — **baseline 은 GET 이다. Master 가 아니다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 쿠팡 수정은 «부분 수정이 아니라 전체 교체» 다. 공식 안내 원문 —
 *
 *   「상품 조회 API 를 이용하여 조회된 JSON 전문에서 **원하는 값만 수정 후,
 *     전체 JSON 전문을 전송**하여 수정이 가능합니다.」
 *
 * 그래서 이 파일의 규칙은 하나다 —
 *
 *   🔴 **GET 응답을 재구성하지 않는다. 고칠 칸만 «덮어쓴다».**
 *
 * ── 🔴 왜 Master 에서 payload 를 다시 만들면 안 되는가 ────────────────────
 * 실측(COUPANG-UPDATE-CAPABILITY-01): GET 은 우리가 보낸 공식 필드를 100%
 * 돌려주고, **거기에 27칸을 더 얹어서** 준다 — `sellerProductItemId` ·
 * `status` · `certifications` · `productOrigin` · `mdId` … 전부 쿠팡이 관리하는
 * 값이다. 빌더는 그 칸들을 만들지 못한다.
 *
 * 전체 교체인데 만들지 못하는 칸을 빼고 보내면 **그 칸들이 지워진다.**
 * 「Master → payload 재생성 → PUT」이 금지인 이유가 그것이다(CPO 확정).
 *
 * ── 🔴 그래서 이 파일은 «타입을 좁히지 않는다» ────────────────────────────
 * `Record<string, unknown>` 위에서 다룬다. 우리가 아는 칸만 인터페이스로 적으면
 * 모르는 칸이 타입에서 사라지고, 그 다음 누군가 「타입에 있는 것만 보내면
 * 되겠지」라고 읽는다. 모르는 칸을 «모르는 채로 그대로» 나르는 것이 요점이다.
 */

/** 쿠팡 GET 응답의 `data`. 🔴 우리가 이름을 아는 칸은 읽기 편하라고 적을 뿐,
 *  «그 칸만 있다는 뜻이 아니다» — 나머지는 index signature 로 보존된다. */
export interface CoupangRegisteredProduct {
  sellerProductId?: number | string | null;
  status?: string | null;
  statusName?: string | null;
  items?: CoupangRegisteredItem[];
  [key: string]: unknown;
}

export interface CoupangRegisteredItem {
  sellerProductItemId?: number | string | null;
  vendorItemId?: number | string | null;
  itemName?: string | null;
  salePrice?: number | null;
  maximumBuyCount?: number | null;
  [key: string]: unknown;
}

/* ════════════════════════════════════════════════════════════════════════════
   상태 게이트 — 실측한 범위 밖으로 나가지 않는다
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴 우리가 수정을 «확인한» 상태는 임시저장 하나뿐이다.
 *
 * 실측(4건)에서 우리 쿠팡 상품은 전부 `status: "SAVED"`(임시저장)였고,
 * **승인된 상품은 한 건도 없다.** 그리고 공식 문서상 승인 후에는 규칙이 다르다 —
 * 가격·재고가 별도 API 로 갈라지고, 승인 이력이 있는 옵션은 삭제할 수 없다.
 *
 * 그래서 이 상수는 「쿠팡이 SAVED 만 수정을 허용한다」는 뜻이 «아니다».
 * **「우리가 SAVED 까지만 확인했다」** 는 뜻이다. 둘을 섞으면 다음 사람이
 * 「쿠팡 제약이니 어쩔 수 없다」고 읽고, 확인을 넓힐 생각을 하지 않게 된다.
 */
export const COUPANG_UPDATABLE_STATUS = "SAVED";

export type CoupangUpdateGate =
  | { allowed: true; status: string }
  /** 🔴 왜 막혔는지 «구분해서» 말한다 — 「안 된다」와 「모른다」는 다른 사실이다. */
  | { allowed: false; reason: "NO_BASELINE" | "STATUS_UNKNOWN" | "STATUS_NOT_SAVED"; status: string | null };

/**
 * 이 상품을 지금 수정해도 되는가.
 *
 * 🔴 모르는 것은 전부 막는다. 상태를 읽지 못했는데 통과시키면, 승인된 상품에
 * 임시저장용 규칙을 적용하게 된다 — 그쪽은 우리가 재 본 적이 없다.
 */
export function coupangUpdateGate(baseline: CoupangRegisteredProduct | null | undefined): CoupangUpdateGate {
  if (!baseline || typeof baseline !== "object") {
    return { allowed: false, reason: "NO_BASELINE", status: null };
  }
  const status = typeof baseline.status === "string" ? baseline.status.trim() : "";
  if (!status) return { allowed: false, reason: "STATUS_UNKNOWN", status: null };
  if (status !== COUPANG_UPDATABLE_STATUS) {
    return { allowed: false, reason: "STATUS_NOT_SAVED", status };
  }
  return { allowed: true, status };
}

/* ════════════════════════════════════════════════════════════════════════════
   Overlay — 「고친 것만」 덮는다
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * 셀러가 실제로 고친 것. 🔴 «고치지 않은 칸은 키 자체가 없다» —
 * `undefined` 를 넣어 「비우기」를 표현하지 않는다. 그 둘이 같은 모양이면
 * 「안 건드렸다」가 「지워라」로 읽히는 날이 온다.
 */
export interface CoupangProductEdits {
  /** 상품명. 🔴 `sellerProductName` 과 `displayProductName` 둘 다에 걸린다. */
  name?: string;
  /** 옵션별 수정. 키는 `sellerProductItemId` 문자열이다. */
  items?: Record<string, CoupangItemEdits>;
}

export interface CoupangItemEdits {
  salePrice?: number;
  /** 🔴 쿠팡의 재고 자리는 `maximumBuyCount` 다(S-17 에서 확정된 기존 매핑). */
  maximumBuyCount?: number;
}

/** `sellerProductItemId` 를 «문자열로» 다룬다 — 숫자로 비교하면 정밀도에서 샌다. */
export function itemKeyOf(item: CoupangRegisteredItem): string | null {
  const raw = item.sellerProductItemId;
  if (raw === null || raw === undefined) return null;
  const key = String(raw).trim();
  return key.length > 0 ? key : null;
}

/**
 * baseline + 고친 것 → PUT 으로 보낼 전문.
 *
 * 🔴 하는 일이 «덮어쓰기» 하나뿐인 것이 이 함수의 정의다.
 *   · baseline 의 모든 칸을 그대로 나른다(모르는 칸 포함).
 *   · `items` 는 **순서도 개수도 그대로** 둔다 — 배열에서 빠지면 쿠팡은 그
 *     옵션을 «삭제» 한다(공식). 여기서 옵션을 지우는 길은 만들지 않는다.
 *   · `sellerProductItemId` 가 없는 옵션은 건드리지 않는다. 그 값이 없으면
 *     쿠팡이 «새 옵션 추가» 로 읽는다(공식) — 수정 경로에서 그 일이 일어나면 안 된다.
 *
 * 🔴 우리 «비공식» 필드(`displayCategoryPath`·`complianceFieldResults`·
 * `priceIsEstimate`)는 애초에 baseline 에 없다. 쿠팡이 저장한 적이 없기 때문이다.
 * 그러니 여기서 더할 일도 없다 — 더하면 우리가 만든 칸을 쿠팡에 흘리는 것이다.
 */
export function applyCoupangEdits(
  baseline: CoupangRegisteredProduct,
  edits: CoupangProductEdits,
): CoupangRegisteredProduct {
  const next: CoupangRegisteredProduct = { ...baseline };

  if (edits.name !== undefined) {
    next.sellerProductName = edits.name;
    /* 쿠팡이 «노출명» 을 따로 들고 있다(실측). 상품명을 고쳤는데 한쪽만 바꾸면
       셀러센터에서 옛 이름이 계속 보인다. */
    if ("displayProductName" in baseline) next.displayProductName = edits.name;
  }

  const itemEdits = edits.items;
  if (itemEdits && Array.isArray(baseline.items)) {
    next.items = baseline.items.map((item) => {
      const key = itemKeyOf(item);
      const patch = key ? itemEdits[key] : undefined;
      if (!patch) return item;
      const nextItem: CoupangRegisteredItem = { ...item };
      if (patch.salePrice !== undefined) nextItem.salePrice = patch.salePrice;
      if (patch.maximumBuyCount !== undefined) nextItem.maximumBuyCount = patch.maximumBuyCount;
      return nextItem;
    });
  }

  return next;
}
