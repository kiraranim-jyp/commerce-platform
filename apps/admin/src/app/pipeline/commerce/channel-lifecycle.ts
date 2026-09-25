import type { CommerceId } from "./commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 PHASE F(CPO 확정, 2026-09-25) — **무엇을 할 것인가를 정하는 곳.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 등록은 한 가지뿐이었다 — 만들거나, 이미 있으면 건너뛰거나.
 * 그래서 상품을 고치면 갈 곳이 없었고, 재분석하면 새 snapshot 이 생겨 «또»
 * 만들었다. 한 상품이 SmartStore 외부번호 6개로 갈라진 뿌리가 그것이다.
 *
 *     변경  +  채널이 할 수 있는 것  →  CREATE / UPDATE / RECREATE / BLOCKED
 *
 * 🔴 이 파일은 «판단만» 한다. API 호출도, payload 생성도 하지 않는다. 채널
 * 어댑터가 각자 판단을 따로 내리면 「화면은 UPDATE 라는데 실제로는 새 상품이
 * 생기는」 상태가 된다 — 판단은 한 곳에만 있어야 한다.
 */

/** 이 채널이 «실제로» 할 수 있는 것. 🔴 추측이 아니라 확인된 것만 적는다. */
export interface ChannelCapability {
  create: boolean;
  /** 기등록 상품 수정. */
  update: CapabilityState;
  /** 기등록 상품의 «카테고리» 변경. 수정 가능 ≠ 카테고리 수정 가능. */
  categoryUpdate: CapabilityState;
}

/**
 * 🔴 `UNKNOWN` 과 `NOT_SUPPORTED` 를 «절대» 같게 다루지 않는다(CPO 명시).
 *
 *   SUPPORTED      공식 근거로 «확인됨»
 *   NOT_SUPPORTED  공식 근거로 «불가함이 확인됨»
 *   UNKNOWN        아직 확인하지 못했다 — 「불가」가 아니다
 *
 * 없는 것을 「불가」로 적으면 확인하지 않은 것을 확인했다고 말하는 것이 되고,
 * 「가능」으로 적으면 실제 API 가 거부할 때 셀러가 이유를 알 수 없다.
 */
export type CapabilityState = "SUPPORTED" | "NOT_SUPPORTED" | "UNKNOWN";

/**
 * 2026-09-25 기준. 근거는 P0-CHANNEL-03 PHASE B 조사:
 *
 *   SmartStore  수정 API 존재(공식 OpenAPI 의 「상품 수정 시에만 생략 가능」
 *               문구로 확인). 카테고리 변경 가부는 «근거 없음».
 *   Coupang     수정 엔드포인트 근거 «없음». 카테고리는 공식 가이드가
 *               「이미 등록된 상품의 카테고리 수정 불가」로 «명시».
 *   LotteON     apiNo 90(상품수정)·91(가격)·92/111(판매상태)이 문서에 있고
 *               전부 미구현. 카테고리 변경은 근거 없음.
 *
 * 🔴 근거가 생기면 «이 표만» 고친다. 판단 로직은 건드리지 않는다.
 */
export const CHANNEL_CAPABILITY: Record<CommerceId, ChannelCapability> = {
  smartstore: { create: true, update: "SUPPORTED", categoryUpdate: "UNKNOWN" },
  coupang: { create: true, update: "UNKNOWN", categoryUpdate: "NOT_SUPPORTED" },
  elevenst: { create: true, update: "UNKNOWN", categoryUpdate: "UNKNOWN" },
  lotteon: { create: true, update: "SUPPORTED", categoryUpdate: "UNKNOWN" },
};

/** 무엇이 바뀌었는가. 🔴 카테고리는 «따로» 센다 — lifecycle 이 다르다. */
export interface ChangeSet {
  /** 상품명·가격·옵션·이미지·상세 등 일반 변경 필드 이름. */
  fields: readonly string[];
  /** 카테고리가 바뀌었는가. */
  category: boolean;
}

export type LifecycleOperation = "CREATE" | "UPDATE" | "RECREATE" | "NOOP" | "BLOCKED";

export interface LifecycleDecision {
  operation: LifecycleOperation;
  /** 왜 이렇게 정했는지 — 화면이 그대로 보여준다. 지어내지 않는다. */
  reason: string;
  /** RECREATE·BLOCKED 처럼 셀러가 알아야 할 결과가 있으면 true. */
  needsAttention: boolean;
}

/**
 * 판단 한 곳.
 *
 * @param hasChannelProduct 이 상품 × 이 채널로 «이미 나가 있는» 외부 상품이 있는가.
 *   🔴 snapshot 이 아니라 ChannelProduct 기준이다. 재분석해서 snapshot 이
 *   새로 생겨도 이 값은 그대로다 — 그것이 이 구조를 만든 이유다.
 */
export function resolveLifecycle(
  commerceId: CommerceId,
  hasChannelProduct: boolean,
  change: ChangeSet,
): LifecycleDecision {
  const cap = CHANNEL_CAPABILITY[commerceId];

  if (!hasChannelProduct) {
    return cap.create
      ? { operation: "CREATE", reason: "아직 이 커머스에 등록되지 않았습니다.", needsAttention: false }
      : { operation: "BLOCKED", reason: "이 커머스는 아직 등록을 지원하지 않습니다.", needsAttention: true };
  }

  /* 🔴 이미 나가 있는데 바뀐 것이 없으면 «아무것도 하지 않는다». 같은 값을
     다시 보내면 마켓 쪽에 불필요한 심사가 걸릴 수 있고, 무엇보다 셀러에게
     「했다」고 말할 근거가 없다. */
  if (change.fields.length === 0 && !change.category) {
    return { operation: "NOOP", reason: "등록된 내용과 달라진 것이 없습니다.", needsAttention: false };
  }

  if (change.category) {
    /* 카테고리는 일반 변경과 lifecycle 이 다르다. 카테고리가 바뀌면 필수속성·
       고시·인증 판정이 전부 다시 계산돼야 하므로, 「가격만 고치는 것」과 같이
       취급할 수 없다. */
    switch (cap.categoryUpdate) {
      case "SUPPORTED":
        return { operation: "UPDATE", reason: "카테고리를 포함해 수정할 수 있습니다.", needsAttention: false };
      case "NOT_SUPPORTED":
        return {
          operation: "RECREATE",
          reason: "이 커머스는 등록된 상품의 카테고리를 바꿀 수 없습니다 — 새 상품으로 다시 등록해야 합니다.",
          needsAttention: true,
        };
      case "UNKNOWN":
        /* 🔴 모르는 것을 「가능」으로 밀지 않는다. 실패하면 셀러는 이유를 모른
           채 막힌다. 반대로 「불가」로 단정하지도 않는다 — 확인된 바 없다.
           안전한 쪽(새 상품 생성)으로 «제안» 하고, 실행 여부는 셀러가 정한다. */
        return {
          operation: "RECREATE",
          reason:
            "이 커머스가 카테고리 변경을 지원하는지 아직 확인되지 않았습니다 — 새 상품으로 다시 등록하는 방법만 확실합니다.",
          needsAttention: true,
        };
    }
  }

  switch (cap.update) {
    case "SUPPORTED":
      return { operation: "UPDATE", reason: `${change.fields.length}개 항목을 수정합니다.`, needsAttention: false };
    case "NOT_SUPPORTED":
      return {
        operation: "RECREATE",
        reason: "이 커머스는 등록된 상품을 수정할 수 없습니다 — 새 상품으로 다시 등록해야 합니다.",
        needsAttention: true,
      };
    case "UNKNOWN":
      /* 🔴 여기서는 RECREATE 로 «넘기지 않는다». 카테고리와 달리 일반 필드는
         수정이 되는 채널이 많고, 안 되는지 확인도 안 된 상태에서 새 상품을
         만들면 그것이야말로 중복을 만드는 길이다. 막고 «말한다». */
      return {
        operation: "BLOCKED",
        reason: "이 커머스의 상품 수정 지원 여부가 아직 확인되지 않았습니다.",
        needsAttention: true,
      };
  }
}

/**
 * 중복 등록 방지 — 🔴 기준이 snapshot 에서 ChannelProduct 로 «옮겨졌다».
 *
 * 전: 이 snapshot 으로 성공한 적이 있는가  → 재분석하면 초기화됐다
 * 후: 이 «상품» 이 이 채널에 나가 있는가    → 재분석해도 그대로다
 */
export function blocksCreate(hasChannelProduct: boolean): boolean {
  return hasChannelProduct;
}
