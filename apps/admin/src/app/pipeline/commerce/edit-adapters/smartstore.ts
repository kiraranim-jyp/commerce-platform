import type { NaverProductRegistrationPayload, RegisteredProductSnapshot } from "@commerce/listing";
import type { EditableField } from "../channel-field-capability";
import { FIELD_ORDER } from "../channel-field-capability";
import type { ChannelFieldValues, CommerceEditAdapter } from "../commerce-edit-adapter";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A — **SmartStore 어댑터. 네이버 모양은 여기서 끝난다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일 밖으로 `NaverProductRegistrationPayload` 도 `RegisteredProductSnapshot`
 * 도 새어 나가지 않는다. Core(ChannelEditModel · ChangeSet · EditGate · UI)는
 * 네이버를 «모른다» — 그래서 쿠팡이 붙을 때 Core 를 고칠 일이 없다.
 *
 * 여기 있는 셈들은 전부 F-14-3~7 에서 실측·사고로 확인된 것이고, 옮기기만 했다:
 *   · 이미지 장수 = 추가 + 대표 한 장
 *   · 상품명은 빌더가 파생한 값(`smartStoreProductName`)이 나간다
 *   · 고시·옵션은 존재/개수만 읽힌다
 */

/** 네이버 payload 의 축 하나를 꺼낸다. 🔴 `editedFields` 하나만 쓴다. */
const PAYLOAD_AXIS: Record<EditableField, (p: NaverProductRegistrationPayload) => unknown> = {
  name: (p) => p.originProduct?.name,
  salePrice: (p) => p.originProduct?.salePrice,
  stockQuantity: (p) => p.originProduct?.stockQuantity,
  detailContent: (p) => p.originProduct?.detailContent,
  images: (p) => p.originProduct?.images,
  options: (p) => p.originProduct?.detailAttribute?.optionInfo,
  providedNotice: (p) => p.originProduct?.detailAttribute?.productInfoProvidedNotice,
  category: (p) => p.originProduct?.leafCategoryId,
};

export const smartStoreEditAdapter: CommerceEditAdapter<
  RegisteredProductSnapshot,
  NaverProductRegistrationPayload
> = {
  commerceId: "smartstore",

  readRegistered(snapshot) {
    return {
      name: snapshot.name,
      salePrice: snapshot.salePrice,
      stockQuantity: snapshot.stockQuantity,
      detailContent: snapshot.detailContent,
      /* 🔴 개수를 «읽지 못했으면» 키를 비운다. 0 으로 메우면 아무것도 안 고친
         셀러에게 「이미지가 없어집니다」가 된다(F-14-3 에서 실제로 걸렸다). */
      imageCount:
        typeof snapshot.optionalImageCount === "number"
          ? snapshot.optionalImageCount + (snapshot.representativeImageUrl ? 1 : 0)
          : undefined,
      optionCount: snapshot.optionCombinationCount,
      hasProvidedNotice: snapshot.hasProvidedNotice,
      categoryId: snapshot.leafCategoryId,
    };
  },

  projectOutgoing(payload) {
    const origin = payload.originProduct;
    const images = origin?.images;
    return {
      name: origin?.name,
      salePrice: origin?.salePrice,
      stockQuantity: origin?.stockQuantity,
      detailContent: origin?.detailContent,
      /* 🔴 기준값과 «같은 셈» 이다 — 추가 + 대표 한 장. 셈이 어긋나면 아무것도
         안 고쳐도 「이미지가 바뀝니다」가 된다. */
      imageCount: (images?.optionalImages?.length ?? 0) + (images?.representativeImage ? 1 : 0),
      optionCount: origin?.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0,
      hasProvidedNotice: Boolean(origin?.detailAttribute?.productInfoProvidedNotice),
      categoryId: origin?.leafCategoryId,
    };
  },

  editedFields(before, after) {
    /* 🔴 JSON 비교가 여기서 «성립하는» 이유: 두 payload 가 둘 다 우리 것이고(같은
       빌더·같은 세션) 서버 정규화가 끼지 않는다. `registered-change.ts` 가 JSON
       비교를 금지한 조건(서버가 정규화한 값과 비교)과 다른 상황이다. */
    return FIELD_ORDER.filter((field) => {
      const read = PAYLOAD_AXIS[field];
      return JSON.stringify(read(before) ?? null) !== JSON.stringify(read(after) ?? null);
    });
  },
};

/** 🔴 값을 «중립 통화» 로 옮기는 일만 한다 — 화면도 판단도 여기 없다. */
export function smartStoreFieldValues(snapshot: RegisteredProductSnapshot): ChannelFieldValues {
  return smartStoreEditAdapter.readRegistered(snapshot);
}
