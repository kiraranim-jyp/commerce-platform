import {
  detectUpdateDataLoss,
  isSameOriginProduct,
  type NaverProductRegistrationPayload,
  type RegisteredProductSnapshot,
  type UpdateDataLossRisk,
} from "@commerce/listing";
import { callNaverApi } from "@/app/api/naver/_lib/client";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-2(CPO 확정, 2026-09-25) — **기등록 상품 수정.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 네이버 수정은 «전체 교체» 다(공식: 「포함하지 않은 정보는 제거하는 행동으로
 * 동작」). 그래서 이 파일은 세 가지를 «순서대로» 한다:
 *
 *     ① GET 으로 «지금 나가 있는 것» 을 읽는다
 *     ② 보내려는 전체 payload 와 대조해 사라지는 것이 있는지 본다
 *     ③ 하나라도 사라지면 PUT 을 «호출하지 않는다»
 *
 * fail-closed 다. 확인하지 못하면 보내지 않는다 — 실제 판매 중인 상품의
 * 상세설명·이미지가 조용히 지워지는 것보다 등록이 막히는 편이 낫다.
 *
 * ── 🔴 여기서 lifecycle 을 «다시 판단하지» 않는다 ─────────────────────────
 * UPDATE 인지 RECREATE 인지는 `resolveLifecycle()` 이 이미 정했다. 어댑터가
 * 또 판단하면 「화면은 UPDATE 라는데 실제로는 새 상품이 생기는」 상태가 된다.
 * 이 함수는 «UPDATE 하라고 이미 정해진» 경우에만 불린다.
 */

export type UpdateProductResult =
  | { ok: true; originProductNo: string; status: number }
  | { ok: false; step: "FETCH" | "PREFLIGHT" | "SUBMIT" | "VERIFY"; message: string; risks?: UpdateDataLossRisk[] };

/**
 * 지금 나가 있는 원상품을 읽는다.
 *
 * 🔴 이 경로는 원래 `api/debug/naver-product-get-raw` 에 «디버그 전용» 으로만
 * 있었다. 수정이 전체 교체인 이상 현재 상태를 읽는 것은 «필수 단계» 이므로
 * 정식 경로로 올린다. 디버그 라우트는 그대로 둔다(조사 용도가 다르다).
 */
export async function fetchRegisteredProduct(
  accessToken: string,
  originProductNo: string,
): Promise<{ ok: true; snapshot: RegisteredProductSnapshot } | { ok: false; message: string }> {
  const res = await callNaverApi(accessToken, {
    method: "GET",
    path: `/v2/products/origin-products/${originProductNo}`,
  });
  if (!res.ok) return { ok: false, message: res.message };
  if (res.status >= 400) {
    return { ok: false, message: `네이버가 상품 조회를 거부했습니다(HTTP ${res.status}).` };
  }
  return toRegisteredProductSnapshot(res.body);
}

/**
 * GET 응답 본문 → 우리가 읽는 칸.
 *
 * 🔴 `fetchRegisteredProduct` 에서 «꺼내 둔» 이유(P0-CHANNEL-03 F-14-6): 실측
 * probe 가 이 매핑을 «다시 적으면» probe 는 통과하는데 실제 코드는 실패하는
 * 상태가 생긴다. 실측이 코드와 무관해지는 순간이 그때다. 그래서 라우트와 probe
 * 가 «같은 함수» 를 쓴다 — 네트워크만 다르고 읽는 방법은 하나다.
 */
export function toRegisteredProductSnapshot(
  body: unknown,
): { ok: true; snapshot: RegisteredProductSnapshot } | { ok: false; message: string } {
  /* 🔴 응답 모양을 넓게 받는다. 우리가 필요한 것은 「무엇이 있었는가」 뿐이고,
     없는 필드를 «있었다» 고 읽으면 안 된다 — 그러면 preflight 가 거짓
     경보를 낸다. optional chaining 으로 없으면 없는 대로 둔다. */
  const parsed = body as {
    originProduct?: {
      detailContent?: string;
      salePrice?: number;
      /* P0-CHANNEL-03 F-6 — 변경 감지가 쓰는 세 값. 🔴 요청 payload 와 «같은
         이름일 것» 이라는 대칭 가정 위에 있다(위 필드들과 똑같은 가정이다).
         가정이 틀리면 undefined 로 오고, 그러면 「못 읽었다」로 흘러간다 —
         「안 바뀌었다」로 새지 않는다. 그 처리는 compareRegisteredProduct 에. */
      leafCategoryId?: string;
      name?: string;
      stockQuantity?: number;
      images?: { representativeImage?: { url?: string }; optionalImages?: unknown[] };
      detailAttribute?: {
        productInfoProvidedNotice?: unknown;
        optionInfo?: { optionCombinations?: unknown[] };
        /* P0-CHANNEL-03 F-11b — F-11 GET probe 가 «있음» 을 확인한 세 축.
           🔴 이제 대칭 «가정» 이 아니라 실측이다. 그래도 optional 로 둔다 —
           상품마다 없을 수 있고, 없는 것을 읽지 못한 것과 섞지 않는다. */
        naverShoppingSearchInfo?: { modelName?: string; manufacturerName?: string; brandName?: string };
        originAreaInfo?: { originAreaCode?: string; content?: string; importer?: string };
        certificationTargetExcludeContent?: {
          childCertifiedProductExclusionYn?: boolean;
          kcCertifiedProductExclusionYn?: string;
          kcExemptionType?: string;
        };
      };
    };
  } | null;
  const origin = parsed?.originProduct;
  if (!origin) return { ok: false, message: "상품 조회 응답에서 원상품을 찾지 못했습니다." };

  return {
    ok: true,
    snapshot: {
      detailContent: origin.detailContent ?? null,
      representativeImageUrl: origin.images?.representativeImage?.url ?? null,
      optionalImageCount: origin.images?.optionalImages?.length ?? 0,
      optionCombinationCount: origin.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0,
      hasProvidedNotice: Boolean(origin.detailAttribute?.productInfoProvidedNotice),
      salePrice: typeof origin.salePrice === "number" ? origin.salePrice : null,
      /* 🔴 `?? null` 을 쓰지 않는다. 여기서 null 로 메우면 「응답에 없었다」와
         「읽었는데 비어 있었다」가 같아진다 — 앞의 것은 우리 가정이 틀렸다는
         뜻이고 뒤의 것은 실제 데이터다. undefined 로 그대로 둔다. */
      leafCategoryId: origin.leafCategoryId,
      name: origin.name,
      stockQuantity: origin.stockQuantity,
      /* P0-CHANNEL-03 F-11b — 🔴 `?? null` 이나 `?? {}` 로 메우지 않는다.
         빈 객체로 채우면 compareRegisteredProduct 가 「읽었는데 값이 없었다」로
         읽어 있던 값이 사라졌다는 거짓 MISSING 을 만든다. 없으면 undefined. */
      naverShoppingSearchInfo: origin.detailAttribute?.naverShoppingSearchInfo,
      originAreaInfo: origin.detailAttribute?.originAreaInfo,
      certificationTargetExcludeContent: origin.detailAttribute?.certificationTargetExcludeContent,
    },
  };
}

/**
 * 수정한다 — GET → preflight → PUT → 응답 검증.
 *
 * 🔴 payload 는 «호출부가 만든 전체 payload» 를 그대로 받는다. 여기서
 * 조립하지 않는다 — CREATE 와 같은 builder 를 써야 완전성이 보장되고,
 * 두 벌이 되면 「등록은 되는데 수정하면 빠지는」 필드가 생긴다.
 */
export async function updateRegisteredProduct(
  accessToken: string,
  originProductNo: string,
  payload: NaverProductRegistrationPayload,
  /**
   * 이미 읽어 둔 «지금 나가 있는 것»(P0-CHANNEL-03 F-6).
   *
   * 🔴 라우트는 UPDATE 인지 RECREATE 인지 정하려고 이미 GET 을 한다. 그것을
   * 그대로 넘겨 같은 요청에서 두 번 읽지 않게 한다 — 두 번 읽으면 그 사이에
   * 값이 바뀔 수 있고(셀러가 관리자에서 동시에 수정), 그러면 «판단한 상태»
   * 와 «preflight 가 검사한 상태» 가 달라진다. 같은 것을 보고 정하고 보낸다.
   *
   * 생략하면 여기서 직접 읽는다 — 단독 호출도 그대로 안전하다.
   */
  prefetched?: RegisteredProductSnapshot,
): Promise<UpdateProductResult> {
  // ① 지금 나가 있는 것
  const current = prefetched
    ? ({ ok: true as const, snapshot: prefetched })
    : await fetchRegisteredProduct(accessToken, originProductNo);
  if (!current.ok) return { ok: false, step: "FETCH", message: current.message };

  // ② 사라지는 것이 있는가
  const risks = detectUpdateDataLoss(current.snapshot, payload);
  if (risks.length > 0) {
    return {
      ok: false,
      step: "PREFLIGHT",
      message: `수정하면 사라지는 항목이 ${risks.length}개 있습니다 — 전송하지 않았습니다.`,
      risks,
    };
  }

  // ③ 보낸다
  const res = await callNaverApi(accessToken, {
    method: "PUT",
    path: `/v2/products/origin-products/${originProductNo}`,
    body: payload,
  });
  if (!res.ok) return { ok: false, step: "SUBMIT", message: res.message };
  if (res.status >= 400) {
    return { ok: false, step: "SUBMIT", message: describeNaverError(res.status, res.body) };
  }

  /* 🔴 응답 번호가 «보낸 것과 같은가». 다르면 UPDATE 인 줄 알았는데 새 상품이
     생긴 것이다 — 그대로 성공 처리하면 모르는 채 중복을 하나 더 만든다.
     이 프로젝트가 이미 그렇게 SmartStore 외부번호 6개를 만들었다. */
  const responded = (res.body as { originProductNo?: string | number } | null)?.originProductNo;
  if (!isSameOriginProduct(originProductNo, responded)) {
    return {
      ok: false,
      step: "VERIFY",
      message: `수정 요청한 상품번호(${originProductNo})와 응답의 상품번호(${responded ?? "없음"})가 다릅니다 — 성공으로 처리하지 않습니다.`,
    };
  }

  return { ok: true, originProductNo, status: res.status };
}

/** 🔴 네이버가 준 사유를 그대로 옮긴다. 우리가 지어내지 않는다. */
function describeNaverError(status: number, body: unknown): string {
  const invalid = (body as { invalidInputs?: { name?: string; message?: string }[] } | null)?.invalidInputs;
  if (invalid?.length) {
    const first = invalid[0];
    return `네이버가 수정 요청을 거부했습니다(HTTP ${status}). 사유: ${first?.name ?? ""}: ${first?.message ?? ""}`;
  }
  const message = (body as { message?: string } | null)?.message;
  return `네이버가 수정 요청을 거부했습니다(HTTP ${status}).${message ? ` 사유: ${message}` : ""}`;
}
