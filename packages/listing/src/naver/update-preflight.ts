import type { NaverProductRegistrationPayload } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-2(CPO 확정, 2026-09-25) — **수정이 «지우지» 않게 막는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 네이버 공식 문서가 확정한 계약:
 *
 *   「상품 정보를 수정하는 경우 요청 메시지에 «포함하지 않은 정보는 제거»하는
 *     행동으로 동작하며, 변경하려는 정보뿐만 아니라 «유지하려는 정보 역시»
 *     요청 메시지에 그대로 구성하여 호출해야 합니다.」
 *
 * 🔴 PATCH 가 아니라 «전체 교체» 다. 바뀐 것만 보내면 나머지가 지워진다 —
 * 그리고 네이버는 200 을 준다. 실제 판매 중인 상품의 상세설명·이미지·고시정보가
 * 조용히 사라지고, 우리는 성공으로 기록한다. 이 파일이 그것을 막는다.
 *
 * ── 🔴 여기서 «채우지» 않는다 ─────────────────────────────────────────────
 * 빠진 값을 추측해서 메우지 않는다. 무엇이 빠졌는지 «말하고 멈춘다». 추측으로
 * 채우면 원래 값과 다른 것이 들어가고, 그것도 마찬가지로 손실이다.
 */

/** 무엇이 사라지는가. 필드 경로는 네이버 payload 경로 그대로 쓴다. */
export interface UpdateDataLossRisk {
  field: string;
  /** 사람이 읽는 이름 — 화면이 그대로 보여준다. */
  label: string;
  /**
   * MISSING  있던 값을 이번에 안 보낸다
   * EMPTIED  개수가 줄어든다
   * CHANGED  🔴 P0-CHANNEL-03 F-14-6a — 값이 «지워지는» 것이 아니라 «바뀐다».
   *          전시 상태가 그렇다: ON 이던 상품에 SUSPENSION 을 보내면 아무것도
   *          사라지지 않지만 상품이 «안 보이게» 된다. 손실의 한 종류로 같이
   *          막되, 이름을 나눠 둔다 — 「사라짐」과 「바뀜」은 다른 사고다.
   */
  reason: "MISSING" | "EMPTIED" | "CHANGED";
}

/** GET 으로 읽은 «현재 등록된» 상품에서 preflight 가 보는 부분만. */
export interface RegisteredProductSnapshot {
  detailContent?: string | null;
  representativeImageUrl?: string | null;
  optionalImageCount?: number;
  optionCombinationCount?: number;
  hasProvidedNotice?: boolean;
  salePrice?: number | null;
  /** 지금 등록돼 있는 상품명. 🔴 셀러가 가장 자주 고치는 값이고, 비교하지
   *  않으면 그 수정이 «조용히 사라진다». */
  name?: string | null;
  stockQuantity?: number | null;
  /**
   * 지금 등록돼 있는 카테고리. 🔴 `undefined`(읽지 못함)와 `null`(응답에 없음)을
   * 「안 바뀌었다」로 읽으면 안 된다 — `compareRegisteredProduct()` 가 그 경우를
   * `UNKNOWN` 으로 낸다. 카테고리는 UPDATE 와 RECREATE 를 가르는 축이라,
   * 모르는 채로 어느 쪽에 밀어넣어도 틀린다.
   */
  leafCategoryId?: string | null;

  /* ════════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-11b — 실측(F-11 GET probe)으로 «있음» 이 확인돼 비교로
     승격된 축들. 🔴 `detectUpdateDataLoss()` 는 이 칸들을 «보지 않는다» —
     손실 방지 6축은 한 줄도 바뀌지 않았다(ChangeSet 과 역할 분리, CTO 명시).

     🔴 전부 optional 이고, 못 읽으면 `undefined` 로 둔다. 없는 것을 `null` 이나
     빈 객체로 메우면 「있던 값이 사라졌다」는 거짓 MISSING 이 난다.
  ════════════════════════════════════════════════════════════════════════ */

  /** 모델명·제조사명·브랜드명. 평평한 문자열 3개라 칸별로 비교할 수 있다. */
  naverShoppingSearchInfo?: {
    modelName?: string;
    manufacturerName?: string;
    brandName?: string;
  } | null;

  /** 🔴 «코드만» 비교한다. content/importer 는 조건부 필드라 제외(registered-change.ts). */
  originAreaInfo?: {
    originAreaCode?: string;
    content?: string;
    importer?: string;
  } | null;

  /**
   * 인증 «대상 제외 신고».
   * 🔴 `productCertificationInfos`(실제 인증정보)와 «다른 것» 이다 — 이름이
   * 비슷해 섞기 쉬운데, 하나는 「대상이 아니라고 신고한 내용」이고 다른 하나는
   * 「실제로 받은 인증서」다. 후자는 비교 계약 근거가 없어 승격하지 않았다.
   */
  certificationTargetExcludeContent?: {
    childCertifiedProductExclusionYn?: boolean;
    kcCertifiedProductExclusionYn?: string;
    kcExemptionType?: string;
  } | null;

  /**
   * ════════════════════════════════════════════════════════════════════════
   * P0-CHANNEL-03 F-14-6a — 🔴 `originProduct` «밖» 의 축.
   * ════════════════════════════════════════════════════════════════════════
   *
   * F-14-6 실측(13714803530, HTTP 200)에서 GET 응답의 최상위 키가 «둘» 이라는
   * 것이 드러났다 — `originProduct` 와 `smartstoreChannelProduct`. 그동안 이
   * 타입에는 두 번째가 «아예 없었고», 그래서 손실검사도 변경감지도 그 축을
   * 본 적이 없다(notCompared 에조차 없다 — 축 자체가 없었다).
   *
   * 그런데 수정은 «전체 교체» 이고, 빌더는 그 자리를 고정값으로 채운다. 판매
   * 중인 상품을 고치면 전시 상태까지 함께 덮인다 — 셀러는 가격 하나 고치려다
   * 상품이 «안 보이게» 된다.
   *
   * 🔴 이 칸이 이 타입에 있다는 것 자체가 «출처» 다. `RegisteredProductSnapshot`
   * 은 「채널에서 GET 으로 읽은 것」만 담는 타입이고, 다른 데서 만든 값을 여기
   * 넣으면 그 순간 이 타입의 뜻이 무너진다. 못 읽었으면 `undefined` 로 둔다 —
   * 빈 객체로 메우면 「읽었는데 상태가 없었다」가 되어 추정이 시작된다.
   */
  smartstoreChannelProduct?: {
    /** 🔴 「ON(판매/전시 중)」인지 「SUSPENSION(전시 중지)」인지. 응답 전용 값
     *  (WAIT 등)이 올 수 있고, 그 경우는 «보존할 수 없다» — 추정하지 않는다. */
    channelProductDisplayStatusType?: string;
  } | null;
}

/**
 * 지금 나가 있는 전시 상태를 «그대로 되보낼 수 있는가».
 *
 * 🔴 되보낼 수 있는 값은 공식 스펙상 둘뿐이다 — 「ON, SUSPENSION만 입력 가능」.
 * GET 이 `WAIT` 같은 응답 전용 값을 주면 우리는 그것을 보존할 «수단이 없다».
 * 그때 SUSPENSION 으로 대신 보내면 그것이 바로 이 작업이 막으려는 사고다.
 */
export function preservableDisplayStatus(
  snapshot: Pick<RegisteredProductSnapshot, "smartstoreChannelProduct">,
): "ON" | "SUSPENSION" | undefined {
  const status = snapshot.smartstoreChannelProduct?.channelProductDisplayStatusType;
  return status === "ON" || status === "SUSPENSION" ? status : undefined;
}

/**
 * 🔴 「현재 나가 있는 것」과 「보내려는 것」을 대조한다. 있던 것이 없어지면 막는다.
 *
 * 반환이 비어 있어야만 PUT 을 호출한다. 한 건이라도 있으면 호출 자체를 하지
 * 않는다 — 「일부만 지워지는」 결과가 가장 나쁘다.
 */
export function detectUpdateDataLoss(
  current: RegisteredProductSnapshot,
  next: NaverProductRegistrationPayload,
): UpdateDataLossRisk[] {
  const risks: UpdateDataLossRisk[] = [];
  const origin = next.originProduct;

  const check = (
    had: boolean,
    has: boolean,
    field: string,
    label: string,
    reason: UpdateDataLossRisk["reason"] = "MISSING",
  ) => {
    if (had && !has) risks.push({ field, label, reason });
  };

  /* 상세설명 — 지워지면 상품 페이지가 비어 버린다. */
  check(
    Boolean(current.detailContent?.trim()),
    Boolean(origin?.detailContent?.trim()),
    "originProduct.detailContent",
    "상세설명",
  );

  /* 대표 이미지 — 없으면 목록에 아무것도 안 보인다. */
  check(
    Boolean(current.representativeImageUrl),
    Boolean(origin?.images?.representativeImage?.url),
    "originProduct.images.representativeImage",
    "대표 이미지",
  );

  /* 추가 이미지 — 개수가 «줄어드는» 것도 손실이다. */
  const nextOptional = origin?.images?.optionalImages?.length ?? 0;
  if ((current.optionalImageCount ?? 0) > nextOptional) {
    risks.push({
      field: "originProduct.images.optionalImages",
      label: `추가 이미지(${current.optionalImageCount} → ${nextOptional})`,
      reason: "EMPTIED",
    });
  }

  /* 옵션 — 줄어들면 팔던 사이즈가 사라진다. */
  const nextOptions = origin?.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0;
  if ((current.optionCombinationCount ?? 0) > nextOptions) {
    risks.push({
      field: "originProduct.detailAttribute.optionInfo",
      label: `옵션(${current.optionCombinationCount} → ${nextOptions})`,
      reason: "EMPTIED",
    });
  }

  /* 상품정보제공고시 — 법적 고지다. 지워지면 등록 자체가 잘못된 상태가 된다. */
  check(
    Boolean(current.hasProvidedNotice),
    Boolean(origin?.detailAttribute?.productInfoProvidedNotice),
    "originProduct.detailAttribute.productInfoProvidedNotice",
    "상품정보제공고시",
  );

  /* 🔴 salePrice — 공식 문의(Discussion #1903)에서 «수정 시에도 필수» 로 확인됐다.
     「가격은 안 바꿨으니 빼도 된다」가 통하지 않는다. */
  if (typeof origin?.salePrice !== "number" || origin.salePrice <= 0) {
    risks.push({ field: "originProduct.salePrice", label: "판매가격", reason: "MISSING" });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-14-6a — 🔴 전시 상태. 여기가 «유일하게» originProduct 밖이다.

     지금까지 이 검사는 「있던 것이 없어지는가」만 물었다. 전시 상태는 없어지지
     않는다 — «바뀐다». ON 이던 상품에 SUSPENSION 이 나가면 데이터는 그대로인데
     상품이 안 보이고, 셀러는 가격 하나 고쳤을 뿐이다.

     🔴 그리고 모르면 «보내지 않는다». 읽지 못한 상태를 SUSPENSION 으로도,
     ON 으로도 추정하지 않는다 — 둘 다 틀릴 수 있고 둘 다 되돌리기 어렵다.
  ══════════════════════════════════════════════════════════════════════════ */
  const currentDisplay = preservableDisplayStatus(current);
  const nextDisplay = next.smartstoreChannelProduct?.channelProductDisplayStatusType;
  if (!currentDisplay) {
    risks.push({
      field: "smartstoreChannelProduct.channelProductDisplayStatusType",
      label: "전시 상태(지금 상태를 읽지 못했습니다)",
      reason: "MISSING",
    });
  } else if (nextDisplay !== currentDisplay) {
    risks.push({
      field: "smartstoreChannelProduct.channelProductDisplayStatusType",
      label: `전시 상태(${describeDisplayStatus(currentDisplay)} → ${describeDisplayStatus(nextDisplay)})`,
      reason: "CHANGED",
    });
  }

  return risks;
}

/** 🔴 셀러의 말로. 「SUSPENSION」은 우리 말이지 셀러 말이 아니다. */
function describeDisplayStatus(status: string | undefined): string {
  if (status === "ON") return "판매 중";
  if (status === "SUSPENSION") return "전시 중지";
  return status === undefined || status.trim() === "" ? "값 없음" : status;
}

/**
 * 응답의 상품번호가 «보낸 것과 같은가».
 *
 * 🔴 다르면 성공으로 처리하지 않는다. UPDATE 인 줄 알았는데 새 상품이 생긴
 * 것이라면, 그대로 성공 처리하면 우리는 모르는 채 중복을 하나 더 만든다 —
 * 이 프로젝트가 이미 그렇게 SmartStore 외부번호 6개를 만들었다.
 */
export function isSameOriginProduct(
  requested: string,
  responded: string | number | null | undefined,
): boolean {
  if (responded === null || responded === undefined) return false;
  return String(responded).trim() === String(requested).trim();
}
