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
  reason: "MISSING" | "EMPTIED";
}

/** GET 으로 읽은 «현재 등록된» 상품에서 preflight 가 보는 부분만. */
export interface RegisteredProductSnapshot {
  detailContent?: string | null;
  representativeImageUrl?: string | null;
  optionalImageCount?: number;
  optionCombinationCount?: number;
  hasProvidedNotice?: boolean;
  salePrice?: number | null;
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

  return risks;
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
