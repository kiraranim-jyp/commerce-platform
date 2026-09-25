import type { NaverProductRegistrationPayload } from "./types";
import type { RegisteredProductSnapshot } from "./update-preflight";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-6(CPO 확정, 2026-09-25) — **무엇이 바뀌었는가를 «읽어서» 안다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `resolveLifecycle()` 은 ChangeSet 을 받아 CREATE/UPDATE/RECREATE 를 정한다.
 * 그런데 지금까지 그 ChangeSet 을 «만드는 곳이 없었다» — 판단 계층만 있고
 * 근거가 없었다. 이 파일이 그 근거다.
 *
 *     근거는 「우리가 지난번에 보낸 것」이 아니라 「지금 나가 있는 것」이다.
 *
 * 🔴 왜 GET 인가(CEO 확정): 셀러가 스마트스토어 관리자에서 «직접» 고칠 수 있다.
 * 우리가 보낸 payload 를 기준으로 삼으면 그 수정이 보이지 않고, 우리는 「안
 * 바뀌었다」고 말하면서 셀러의 손수정을 덮어쓴다. 현실을 읽는 쪽만이 참이다.
 *
 * ── 🔴 이 비교는 «전수가 아니다» ──────────────────────────────────────────
 * 그리고 그 사실을 숨기지 않는다. `notCompared` 가 그것이다.
 *
 * 비교하지 못하는 것이 있는 이유는 두 가지다:
 *   ① GET 응답의 실제 모양을 «실측한 적이 없다». `fetchRegisteredProduct()` 가
 *      읽는 필드들은 요청 payload 와 «같은 모양일 것» 이라는 대칭 가정 위에
 *      있다(F-2 가 이미 그 가정 위에 서 있다). 가정 위에 더 쌓지 않는다.
 *   ② 값 자체가 매번 달라지는 축이 있다 — 이미지는 등록할 때마다 네이버에
 *      다시 업로드돼 «URL 이 항상 새 것» 이다. 이것을 「바뀌었다」고 세면
 *      아무것도 안 고쳤는데도 매번 변경으로 잡힌다.
 *
 * 🔴 그래서 「changedFields 가 비었다」를 「같다」로 읽으면 안 된다. 그렇게
 * 읽으면 비교하지 못한 축(브랜드·옵션 내용·속성)의 수정이 NOOP 으로 조용히
 * 사라지고, 셀러는 고쳤다고 믿는다. 판단은 `resolveLifecycle()` 이 하되,
 * 이 파일은 «무엇을 못 봤는지» 를 반드시 같이 넘긴다.
 */

/**
 * 카테고리는 «세 갈래» 다. `boolean` 으로 쓰지 않는 이유가 여기 있다.
 *
 *   SAME     지금 나가 있는 것과 같다 — 확인됨
 *   CHANGED  다르다 — 확인됨
 *   UNKNOWN  🔴 «읽지 못했다». 「안 바뀌었다」가 아니다.
 *
 * 카테고리는 UPDATE 와 RECREATE 를 가르는 축이다. UNKNOWN 을 SAME 으로
 * 뭉개면 카테고리 변경이 조용히 UPDATE 로 나가고, CHANGED 로 뭉개면 새 상품이
 * 생긴다 — 후자가 바로 이 스프린트가 고치려는 «외부번호 6개» 다.
 */
export type CategoryComparison = "SAME" | "CHANGED" | "UNKNOWN";

export interface RegisteredComparison {
  /** 실제로 «다름이 확인된» 필드. 사람이 읽는 이름으로 담는다(화면이 그대로 쓴다). */
  changedFields: string[];
  category: CategoryComparison;
  /**
   * 🔴 비교하지 «못한» 축. 비어 있지 않은 한 `changedFields: []` 는
   * 「바뀐 게 없다」를 뜻하지 않는다 — 「우리가 본 범위에서 차이가 없었다」일 뿐이다.
   */
  notCompared: string[];
}

/**
 * 🔴 값이 매번 달라져서 «비교 자체가 무의미한» 축, 그리고 GET 응답에서 읽지
 * 않는 축. 둘 다 `notCompared` 로 나간다 — 목록을 줄이려면 코드가 아니라
 * 「실측」이 필요하다.
 */
const NEVER_COMPARED: readonly string[] = [
  /* 등록할 때마다 네이버에 다시 업로드돼 URL 이 항상 새 것이다. 「바뀌었다」고
     세면 아무것도 안 고쳐도 매번 변경으로 잡힌다. 개수는 preflight 가 본다. */
  "이미지(재업로드로 URL 이 매번 바뀐다)",
  "브랜드·제조사·모델명",
  "옵션의 «내용»(개수만 본다)",
  "상품정보제공고시의 «내용»(있는지만 본다)",
  "카테고리 상품속성",
  "원산지·배송/반품 정책",
  "KC 인증·면제 신고",
];

/**
 * 「지금 나가 있는 것」과 「보내려는 것」을 대조한다.
 *
 * 🔴 여기서 lifecycle 을 «정하지 않는다». 무엇이 다른지만 말한다 —
 * CREATE/UPDATE/RECREATE 는 `resolveLifecycle()` 한 곳이 정한다.
 */
export function compareRegisteredProduct(
  current: RegisteredProductSnapshot,
  next: NaverProductRegistrationPayload,
): RegisteredComparison {
  const origin = next.originProduct;
  const changedFields: string[] = [];

  /* 🔴 「읽지 못한 값」은 비교하지 않는다. undefined 를 「없었다」로 읽으면
     있던 것이 사라졌다고 «거짓 변경» 을 만든다. 없으면 notCompared 로 간다. */
  const extra: string[] = [];
  const compare = (
    had: string | number | null | undefined,
    has: string | number | null | undefined,
    label: string,
  ) => {
    if (had === undefined || had === null) {
      extra.push(`${label}(지금 등록된 값을 읽지 못했다)`);
      return;
    }
    if (String(had).trim() !== String(has ?? "").trim()) changedFields.push(label);
  };

  compare(current.name, origin?.name, "상품명");
  compare(current.salePrice, origin?.salePrice, "판매가격");
  compare(current.stockQuantity, origin?.stockQuantity, "재고수량");
  compare(current.detailContent, origin?.detailContent, "상세설명");

  /* 개수 축 — 내용은 못 봐도 «늘거나 줄어든 것» 은 확실한 변경이다.
     🔴 preflight 의 관심(줄어들면 손실)과 다르다. 여기서는 양방향 전부 변경. */
  const currentOptions = current.optionCombinationCount;
  const nextOptions = origin?.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0;
  if (currentOptions === undefined) extra.push("옵션 개수(읽지 못했다)");
  else if (currentOptions !== nextOptions) changedFields.push(`옵션 개수(${currentOptions} → ${nextOptions})`);

  const currentImages = current.optionalImageCount;
  const nextImages = origin?.images?.optionalImages?.length ?? 0;
  if (currentImages === undefined) extra.push("추가 이미지 개수(읽지 못했다)");
  else if (currentImages !== nextImages) changedFields.push(`추가 이미지 개수(${currentImages} → ${nextImages})`);

  return {
    changedFields,
    category: compareCategory(current.leafCategoryId, origin?.leafCategoryId),
    notCompared: [...NEVER_COMPARED, ...extra],
  };
}

/**
 * 🔴 「읽지 못했다」를 「같다」로 만들지 않는다.
 *
 * 지금 등록된 카테고리를 모르는 채로 UPDATE 를 보내면 카테고리 변경이 조용히
 * 나가거나 조용히 무시되고, 어느 쪽인지 우리가 모른다. RECREATE 로 밀면 새
 * 상품이 생긴다. 그래서 «모른다» 를 끝까지 들고 간다 — 판단 계층이 막는다.
 */
function compareCategory(
  current: string | null | undefined,
  next: string | undefined,
): CategoryComparison {
  const had = current?.trim();
  const has = next?.trim();
  if (!had || !has) return "UNKNOWN";
  return had === has ? "SAME" : "CHANGED";
}
