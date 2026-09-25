import type { NaverProductRegistrationPayload } from "./types";
import type { RegisteredProductSnapshot } from "./update-preflight";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-6(CPO 확정) / F-11b(CTO 확정, 2026-09-25)
 * **무엇이 바뀌었는가를 «읽어서» 안다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `resolveLifecycle()` 은 ChangeSet 을 받아 CREATE/UPDATE/RECREATE 를 정한다.
 * 그 근거는 「우리가 지난번에 보낸 것」이 아니라 「지금 나가 있는 것」이다 —
 * 셀러가 스마트스토어 관리자에서 «직접» 고칠 수 있기 때문이다.
 *
 * ── 🔴 이 파일은 `detectUpdateDataLoss()` 와 «다른 질문» 이다 ─────────────
 *     ChangeSet             무엇이 달라졌는가?
 *     detectUpdateDataLoss  UPDATE 하면 기존 데이터가 «사라지는가»?
 * 두 질문은 답이 겹칠 때가 있어도 목적이 다르다. 합치면 「손실은 아니지만
 * 바뀐 것」(옵션이 늘어남)과 「바뀌지 않았지만 손실인 것」(필수값 누락)이 서로를
 * 가린다. 합치지 않는다(CTO 명시).
 *
 * ── F-11b — 실측이 가정을 사실로 바꿨다 ──────────────────────────────────
 * F-11 에서 CEO 가 GET probe 를 실행해(HTTP 200, 13713593585 무접촉) 응답의
 * 실제 모양을 «보았다». 그 결과 이 파일이 서 있던 대칭 가정이 확인됐고,
 * notCompared 에 있던 축 일부를 비교로 «승격» 했다.
 *
 * 🔴 그러나 「GET 에 있다」가 「비교해도 된다」는 뜻이 아니다(CTO 명시).
 * 승격 기준은 세 가지를 «전부» 만족하는 것이다:
 *     ① 경로가 같은가  ② 의미가 같은가  ③ 구조가 같은가
 * 하나라도 확인되지 않으면 NOT_COMPARED 로 남긴다 —
 * **거짓 CHANGED 를 만드는 것보다 NOT_COMPARED 가 안전하다.**
 *
 * 그래서 `deliveryInfo` 는 GET 에 «있는데도» 승격하지 않았다:
 *   · 우리는 `deliveryBundleGroupId: null` 을 보내는데, 공식 스펙이
 *     「null 이면 기본 그룹으로 저장됩니다」라고 한다 — 서버가 실제 ID 를
 *     채워 넣는다. 비교하면 아무것도 안 고쳐도 «항상» 다르다.
 *   · `deliveryBundleGroupUsable` 도 「그룹 코드가 존재하면 자동으로 true」다.
 *   · 그리고 probe 가 확인한 것은 `deliveryInfo` 가 «있다» 는 것뿐이고,
 *     그 «안» 의 모양은 아직 실측되지 않았다.
 */

/**
 * 한 축을 비교한 결과.
 *
 *   UNCHANGED      지금 나가 있는 것과 같다
 *   CHANGED        둘 다 값이 있는데 다르다
 *   MISSING        나가 있던 값이 있는데 이번에 «안 보낸다»
 *   ADDED          없던 값을 이번에 «보낸다»
 *   NOT_COMPARED   🔴 «보지 못했다». 「같다」가 아니다.
 */
export type FieldVerdict = "UNCHANGED" | "CHANGED" | "MISSING" | "ADDED" | "NOT_COMPARED";

export interface FieldComparison {
  /** 네이버 payload 경로 그대로 — 실측/디버깅에서 그대로 대조할 수 있게. */
  path: string;
  /** 사람이 읽는 이름. 화면이 그대로 쓴다. */
  label: string;
  verdict: FieldVerdict;
  /** 🔴 NOT_COMPARED 면 «왜 못 봤는지». 이유 없는 미비교를 남기지 않는다. */
  reason?: string;
}

/**
 * 카테고리는 «세 갈래» 다. `boolean` 으로 쓰지 않는 이유가 여기 있다.
 *
 *   SAME / CHANGED / UNKNOWN(🔴 «읽지 못했다» — 「안 바뀌었다」가 아니다)
 *
 * 카테고리는 UPDATE 와 RECREATE 를 가르는 축이다. UNKNOWN 을 SAME 으로
 * 뭉개면 카테고리 변경이 조용히 UPDATE 로 나가고, CHANGED 로 뭉개면 새 상품이
 * 생긴다 — 후자가 이 스프린트가 고치려는 «외부번호 6개» 다.
 *
 * 🔴 F-11b — GET 에 `leafCategoryId` 가 «있다» 는 것이 실측으로 확인됐다.
 * 그것은 「읽을 수 있다」는 뜻이고, 「SmartStore 가 카테고리 수정을 지원한다」는
 * 뜻이 «아니다». 무엇을 할지는 여전히 `resolveLifecycle()` 의 capability 가
 * 정한다 — 이 파일은 capability 를 건드리지 않는다(CTO 명시).
 */
export type CategoryComparison = "SAME" | "CHANGED" | "UNKNOWN";

export interface RegisteredComparison {
  /** 축별 전수 결과 — 화면과 로그가 「무엇을 봤고 무엇을 못 봤는지」 읽는다. */
  fields: FieldComparison[];
  /** CHANGED · MISSING · ADDED 인 축의 이름. 「달라진 것」 전부다. */
  changedFields: string[];
  category: CategoryComparison;
  /**
   * 🔴 비교하지 «못한» 축. 비어 있지 않은 한 `changedFields: []` 는
   * 「바뀐 게 없다」를 뜻하지 않는다 — 「우리가 본 범위에서 차이가 없었다」다.
   */
  notCompared: string[];
}

/**
 * 🔴 구조적으로 비교할 수 없는 축 — 실측을 해도 줄지 않는다(이유가 실측 부족이
 * 아니기 때문). 각 줄에 «왜» 를 붙인다.
 */
const STRUCTURALLY_NOT_COMPARABLE: { path: string; label: string; reason: string }[] = [
  {
    path: "originProduct.images",
    label: "이미지",
    reason: "등록할 때마다 네이버에 재업로드돼 URL 이 항상 새 것이다 — 개수만 본다.",
  },
  {
    path: "originProduct.detailAttribute.optionInfo.optionCombinations[]",
    label: "옵션의 내용",
    reason: "개수만 본다 — 조합별 값까지 대조하려면 옵션 동일성 정의가 먼저 필요하다.",
  },
  {
    path: "originProduct.detailAttribute.productInfoProvidedNotice",
    label: "상품정보제공고시의 내용",
    reason: "있는지만 본다 — 카테고리마다 필드 집합이 달라 같은 잣대로 볼 수 없다.",
  },
  {
    path: "originProduct.deliveryInfo",
    label: "배송/반품 정책",
    reason:
      "🔴 서버가 정규화한다 — deliveryBundleGroupId 를 null 로 보내면 기본 그룹 ID 가 채워져 돌아온다(공식 스펙). 비교하면 항상 다르다. 내부 구조도 아직 실측되지 않았다.",
  },
  {
    path: "originProduct.detailAttribute.originAreaInfo.content/importer",
    label: "원산지 부가정보",
    reason: "「기타 직접입력」·「상세페이지 참조」일 때만 채우는 조건부 값이라, 없는 것이 정상인 경우와 사라진 경우를 구분할 근거가 없다.",
  },
  {
    path: "originProduct.detailAttribute.productAttributes",
    label: "카테고리 상품속성",
    reason: "GET 과 outgoing 의 비교 계약을 확정할 근거가 부족하다(CTO 확정, F-11b 범위 밖).",
  },
  {
    path: "originProduct.detailAttribute.productCertificationInfos",
    label: "KC 인증정보",
    reason: "GET 과 outgoing 의 비교 계약을 확정할 근거가 부족하다(CTO 확정, F-11b 범위 밖).",
  },
  {
    path: "originProduct.sellerManagementCode",
    label: "판매자 상품코드",
    reason: "GET 과 outgoing 의 비교 계약을 확정할 근거가 부족하다(CTO 확정, F-11b 범위 밖).",
  },
];

/**
 * 🔴 「값이 없다」의 기준을 한 곳에 둔다.
 *
 * 빌더는 빈 문자열을 `|| undefined` 로 걷어내 보내지 않는데, GET 이 `""` 로
 * 돌려줄 수 있다. 그 둘을 다르게 보면 아무것도 안 고쳐도 MISSING 이 뜬다 —
 * 실제로는 양쪽 다 「값 없음」이다.
 */
function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

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
  const fields: FieldComparison[] = [];

  /**
   * 스칼라 한 칸.
   *
   * @param readable 이 칸이 «속한 곳» 을 GET 에서 읽었는가. 🔴 못 읽은 것을
   *   「없었다」로 읽으면, 있던 것이 사라졌다는 «거짓 MISSING» 을 만든다.
   */
  const scalar = (
    path: string,
    label: string,
    had: unknown,
    has: unknown,
    readable: boolean,
    notReadableReason: string,
  ) => {
    if (!readable) {
      fields.push({ path, label, verdict: "NOT_COMPARED", reason: notReadableReason });
      return;
    }
    const hadEmpty = isAbsent(had);
    const hasEmpty = isAbsent(has);
    if (hadEmpty && hasEmpty) return void fields.push({ path, label, verdict: "UNCHANGED" });
    if (!hadEmpty && hasEmpty) return void fields.push({ path, label, verdict: "MISSING" });
    if (hadEmpty && !hasEmpty) return void fields.push({ path, label, verdict: "ADDED" });
    fields.push({
      path,
      label,
      verdict: String(had).trim() === String(has).trim() ? "UNCHANGED" : "CHANGED",
    });
  };

  /** 개수 축 — 🔴 preflight 와 달리 «양방향» 이다. 늘어난 것도 변경이다. */
  const count = (path: string, label: string, had: number | undefined, has: number) => {
    if (had === undefined) {
      fields.push({ path, label, verdict: "NOT_COMPARED", reason: "지금 등록된 개수를 읽지 못했다." });
      return;
    }
    fields.push({
      path,
      label: had === has ? label : `${label}(${had} → ${has})`,
      verdict: had === has ? "UNCHANGED" : "CHANGED",
    });
  };

  const unread = (what: string) => `지금 등록된 ${what}을(를) 읽지 못했다.`;

  /* ── ① F-6 부터 있던 축(실측으로 GET 에 전부 존재함이 확인됨) ───────────
     🔴 F-11b 에서 이 9개를 «재설계하지 않는다»(CTO 명시). 계약 그대로 둔다. */
  scalar("originProduct.name", "상품명", current.name, origin?.name, current.name !== undefined, unread("상품명"));
  scalar(
    "originProduct.salePrice", "판매가격",
    current.salePrice, origin?.salePrice,
    current.salePrice !== undefined, unread("판매가격"),
  );
  scalar(
    "originProduct.stockQuantity", "재고수량",
    current.stockQuantity, origin?.stockQuantity,
    current.stockQuantity !== undefined, unread("재고수량"),
  );
  scalar(
    "originProduct.detailContent", "상세설명",
    current.detailContent, origin?.detailContent,
    current.detailContent !== undefined, unread("상세설명"),
  );
  count(
    "originProduct.detailAttribute.optionInfo.optionCombinations",
    "옵션 개수",
    current.optionCombinationCount,
    origin?.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0,
  );
  count(
    "originProduct.images.optionalImages",
    "추가 이미지 개수",
    current.optionalImageCount,
    origin?.images?.optionalImages?.length ?? 0,
  );

  /* ── ② F-11b 승격 — 실측으로 경로가 확인됐고 구조가 평평한 축만 ─────────
     🔴 «객체 통째로» 비교하지 않는다. JSON.stringify 비교는 키 순서·서버가
     덧붙인 칸 하나로 거짓 CHANGED 를 만든다. 뜻이 확인된 칸만 하나씩 본다. */
  const search = current.naverShoppingSearchInfo;
  const searchReadable = search !== undefined && search !== null;
  const searchReason = unread("네이버쇼핑 검색정보(모델명·제조사·브랜드)");
  const nextSearch = origin?.detailAttribute?.naverShoppingSearchInfo;
  scalar("originProduct.detailAttribute.naverShoppingSearchInfo.modelName", "모델명",
    search?.modelName, nextSearch?.modelName, searchReadable, searchReason);
  scalar("originProduct.detailAttribute.naverShoppingSearchInfo.manufacturerName", "제조사명",
    search?.manufacturerName, nextSearch?.manufacturerName, searchReadable, searchReason);
  scalar("originProduct.detailAttribute.naverShoppingSearchInfo.brandName", "브랜드명",
    search?.brandName, nextSearch?.brandName, searchReadable, searchReason);

  /* 🔴 originAreaInfo 는 «코드 한 칸만» 본다. content/importer 는 조건부 필드라
     없는 것이 정상인 경우와 사라진 경우를 구분할 근거가 없다(위 목록 참고). */
  const originArea = current.originAreaInfo;
  scalar(
    "originProduct.detailAttribute.originAreaInfo.originAreaCode", "원산지",
    originArea?.originAreaCode,
    origin?.detailAttribute?.originAreaInfo?.originAreaCode,
    originArea !== undefined && originArea !== null,
    unread("원산지"),
  );

  /* 🔴 인증 «대상 제외 신고» — certificationTargetExcludeContent.
     productCertificationInfos(실제 인증정보)와 «다른 것» 이다. 혼동하지 않는다.

     🔴 그리고 이것은 KC 판정이 아니다(CTO 명시). KcStatus · SmartStoreKcDeclaration ·
     seller_compliance_confirmations 와 «결합하지 않는다». 여기서 답하는 질문은
     하나뿐이다 — 「지금 나가 있는 값과 보낼 값이 다른가」. 법적 인증 여부도,
     판매 가능 여부도 여기서 판단하지 않는다. */
  const exclude = current.certificationTargetExcludeContent;
  const excludeReadable = exclude !== undefined && exclude !== null;
  const excludeReason = unread("인증 대상 제외 신고");
  const nextExclude = origin?.detailAttribute?.certificationTargetExcludeContent;
  scalar(
    "originProduct.detailAttribute.certificationTargetExcludeContent.childCertifiedProductExclusionYn",
    "어린이제품 인증 대상 제외 신고",
    exclude?.childCertifiedProductExclusionYn, nextExclude?.childCertifiedProductExclusionYn,
    excludeReadable, excludeReason,
  );
  scalar(
    "originProduct.detailAttribute.certificationTargetExcludeContent.kcCertifiedProductExclusionYn",
    "KC 인증 대상 제외 신고",
    exclude?.kcCertifiedProductExclusionYn, nextExclude?.kcCertifiedProductExclusionYn,
    excludeReadable, excludeReason,
  );
  scalar(
    "originProduct.detailAttribute.certificationTargetExcludeContent.kcExemptionType",
    "KC 면제 사유",
    exclude?.kcExemptionType, nextExclude?.kcExemptionType,
    excludeReadable, excludeReason,
  );

  /* ── ③ 구조적으로 볼 수 없는 축 — 이유와 함께 그대로 들고 간다 ────────── */
  for (const entry of STRUCTURALLY_NOT_COMPARABLE) {
    fields.push({ path: entry.path, label: entry.label, verdict: "NOT_COMPARED", reason: entry.reason });
  }

  return {
    fields,
    changedFields: fields
      .filter((f) => f.verdict === "CHANGED" || f.verdict === "MISSING" || f.verdict === "ADDED")
      .map((f) => f.label),
    category: compareCategory(current.leafCategoryId, origin?.leafCategoryId),
    notCompared: fields.filter((f) => f.verdict === "NOT_COMPARED").map((f) => f.label),
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
