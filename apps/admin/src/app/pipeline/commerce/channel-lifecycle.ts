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
 *   Coupang     🔴 UNKNOWN. 카테고리는 공식 가이드가 「이미 등록된 상품의
 *               카테고리 수정 불가」로 «명시»(NOT_SUPPORTED — 확인된 사실).
 *
 *               ── STEP 6 조사로 «이유» 가 바뀌었다(2026-09-26) ─────────────
 *               전: 「수정 엔드포인트 근거 없음」
 *               후: 「문서 근거 확보 · 실측 대기」
 *
 *               🔴 그런데 값은 «그대로 UNKNOWN» 이다. 문서가 늘었다고 올리지
 *               않는다 — 그것이 LotteON apiNo 90 에서 겪은 혼동이다.
 *               확인된 것: PUT .../seller-products(전체 JSON 전문 되보내기) ·
 *               vendorItemId 별 가격/수량 PUT · 승인불필요 부분수정은 배송·반품
 *               축뿐. 확인되지 «않은» 것: GET 응답의 실제 모양 · 승인 대기 중
 *               상품의 수정 가능성 · 수정 후 sellerProductId 유지.
 *               그리고 `coupang/_lib/client.ts` 가 메서드를 GET|POST 로 타입
 *               수준에서 막고 있어 지금 코드로는 PUT 을 «보낼 수 없다».
 *               전문: docs/p0-channel-03-step6-coupang-update-survey.md
 *   LotteON     🔴 UNKNOWN. 아래 참조 — 「apiNo 90 이 있다」는 근거가 아니다.
 *
 * ── 🔴 LotteON update 를 SUPPORTED 로 올리지 않는 이유(CTO 지시, 2026-09-25) ──
 * 앞선 판이 `SUPPORTED` 였고 그 근거가 「apiNo 90·91·92/111 이 문서에 있다」였다.
 * 그것은 «존재» 이지 «확인» 이 아니다 — 이 파일이 막으려던 바로 그 혼동이다.
 * 조사 문서(docs/lotteon-commerce-sprint-2-survey.md)가 실제로 말하는 것:
 *
 *   §5-2  apiNo 90 의 이름은 「상품 수정」이 아니라 «승인 상품 수정»
 *         (POST /v1/openapi/product/v1/product/modification/request).
 *         어떤 «상태» 의 어떤 «필드» 를 바꿀 수 있는지는 인용된 바 없다.
 *   §7-2  🔴 「롯데ON «만» 옵션명·옵션값 사후 수정 불가」 — 수정이 안 되는 축이
 *         문서로 «확인돼» 있다. 전체를 SUPPORTED 라고 말할 수 없다.
 *   §6-3  상품 쓰기가 허용된 근거는 「등록(87)은 92 판매중지로 되돌릴 수 있다」
 *         였다. 90 수정에는 그런 되돌림 수단이 «기록돼 있지 않다».
 *
 * 🔴 `forbidden-endpoints.ts` 가 90 을 막고 있는 것이 «아니다». 그 목록은 주문·
 * 배송·클레임 축뿐이고 상품 축은 의도적으로 열려 있다. 즉 가드는 이 판단의
 * 근거가 아니다 — 근거는 위 세 줄이다. 가드를 읽고 안심하지 말 것.
 *
 * UNKNOWN 이므로 일반 수정은 BLOCKED 로 간다(아래 cap.update 분기). 셀러는
 * 「안 된다」가 아니라 「확인되지 않았다」는 말을 듣는다 — 그것이 사실이다.
 * 올리려면: 90 의 대상 상태·수정 가능 필드·되돌림 수단이 공식 문서로 확인되고,
 * 옵션 축 제약과의 관계가 정리돼야 한다. 실측 없이 올리지 않는다.
 *
 * 🔴 근거가 생기면 «이 표만» 고친다. 판단 로직은 건드리지 않는다.
 */
export const CHANNEL_CAPABILITY: Record<CommerceId, ChannelCapability> = {
  smartstore: { create: true, update: "SUPPORTED", categoryUpdate: "UNKNOWN" },
  coupang: { create: true, update: "UNKNOWN", categoryUpdate: "NOT_SUPPORTED" },
  elevenst: { create: true, update: "UNKNOWN", categoryUpdate: "UNKNOWN" },
  lotteon: { create: true, update: "UNKNOWN", categoryUpdate: "UNKNOWN" },
};

/** 무엇이 바뀌었는가. 🔴 카테고리는 «따로» 센다 — lifecycle 이 다르다. */
export interface ChangeSet {
  /** 상품명·가격·옵션·이미지·상세 등 일반 변경 필드 이름. */
  fields: readonly string[];
  /** 카테고리가 바뀌었는가. */
  category: boolean;
  /**
   * 🔴 카테고리를 «비교하지 못했다». `category: false` 와 «다르다» — 바뀌지
   * 않은 것이 아니라 모르는 것이다. F-6 이 추가했다.
   *
   * 두 필드로 나눈 이유: boolean 하나면 「모름」이 자동으로 「안 바뀜」이 되고,
   * 그 순간 카테고리 변경이 조용히 UPDATE 로 나간다.
   */
  categoryUnknown: boolean;
  /**
   * 🔴 이 비교가 «전수» 였는가.
   *
   * false 면 「fields 가 비었다」가 「바뀐 게 없다」를 뜻하지 «않는다» —
   * 우리가 본 범위에서 차이가 없었다는 뜻일 뿐이다. 그 둘을 같게 다루면
   * 비교하지 못한 축의 수정이 NOOP 으로 조용히 사라지고, 셀러는 고쳤다고
   * 믿는다. 이 저장소에서 가장 비싼 종류의 거짓말이다.
   *
   * 🔴 optional 로 두지 않는다. 생략하면 「전수였다」가 기본이 되는데, 그것이
   * 정확히 위험한 쪽이다. 부르는 쪽이 «무엇을 아는지 말하게» 강제한다.
   */
  comparedEverything: boolean;
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

  /* ── 🔴 카테고리를 «모르면» 여기서 멈춘다(F-6) ───────────────────────────
     카테고리는 UPDATE 와 RECREATE 를 가르는 축이다. 모르는 채로
       · UPDATE 로 밀면 → 카테고리 변경이 조용히 나가거나 조용히 무시된다.
                          어느 쪽인지 우리가 모른다.
       · RECREATE 로 밀면 → 새 상품이 생긴다. 그것이 이 스프린트가 고치려는
                          «SmartStore 외부번호 6개» 그 자체다.
     어느 쪽에 밀어넣어도 틀린다. 그래서 «정하지 않고 말한다». 이 분기가
     NOOP 보다 앞인 이유도 같다 — 카테고리를 못 읽은 채로 「달라진 것이
     없습니다」라고 말하면 확인하지 않은 것을 확인했다고 적는 셈이다. */
  if (change.categoryUnknown) {
    return {
      operation: "BLOCKED",
      reason: "지금 등록돼 있는 카테고리를 확인하지 못했습니다 — 수정할지 새로 등록할지 정할 수 없습니다.",
      needsAttention: true,
    };
  }

  /* 🔴 이미 나가 있는데 바뀐 것이 없으면 «아무것도 하지 않는다». 같은 값을
     다시 보내면 마켓 쪽에 불필요한 심사가 걸릴 수 있고, 무엇보다 셀러에게
     「했다」고 말할 근거가 없다.

     🔴 단, «전수로 비교했을 때만» 그렇게 말할 수 있다(F-6). 부분 비교에서
     차이가 없었다는 것은 「같다」가 아니다 — 여기서 NOOP 을 내면 비교하지
     못한 축(브랜드·옵션 내용·속성)의 수정이 조용히 사라진다. 그 경우는
     아래 일반 수정 분기로 «흘려보내» 등록된 내용 전체를 다시 보낸다. */
  if (change.fields.length === 0 && !change.category && change.comparedEverything) {
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
      return {
        operation: "UPDATE",
        /* 🔴 「0개 항목을 수정합니다」라고 말하지 않는다. 여기에 fields 가 빈
           채로 도달했다는 것은 «전수로 보지 못했다» 는 뜻이고(위 NOOP 분기가
           전수일 때만 잡는다), 그 사실을 그대로 말하는 편이 정확하다. */
        reason:
          change.fields.length > 0
            ? `${change.fields.length}개 항목을 수정합니다.`
            : "달라진 곳을 전부 확인하지는 못해, 등록된 내용 전체를 다시 보냅니다.",
        needsAttention: false,
      };
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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a(CTO 지시, 2026-09-25) — **새 상품을 만들어도 되는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-12 후속에서 세 라우트에 같은 빗장을 «복제» 했다. 복제된 판단은 반드시
 * 갈라진다 — 이 스프린트가 내내 고쳐 온 실수이고, 실제로 그때도 한 채널의
 * 채널 이름만 안 고치면 조용히 틀리는 상태였다. 판단을 여기로 모은다.
 *
 * ── 🔴 두 가지 「이미 나가 있음」이 있다 ─────────────────────────────────
 *     hasChannelProduct  연결을 «안다»       → 고칠 수 있다(UPDATE/RECREATE)
 *     priorSuccess       연결은 «모르는데»   → 고칠 수도 없고 만들어서도 안 된다
 *                        성공 이력이 있다
 * 뒤쪽이 F-12 준비 중 드러난 구멍이다. 기존 381 snapshot(product_id NULL)과
 * 연결 기록이 유실된 경우가 여기 해당하고, 13713593585 가 바로 그 상태였다.
 *
 * ── 🔴 `priorSuccess: null`(확인 못 함)은 «막는 쪽» 이다 ──────────────────
 * 조회 실패를 「성공한 적 없다」로 읽으면 DB 가 흔들릴 때마다 중복 등록의 문이
 * 열린다. 중복은 되돌리기 어렵고, 셀러가 잠시 후 다시 누르는 것은 싸다.
 *
 * ── 🔴 RECREATE 는 지나간다 ──────────────────────────────────────────────
 * 「이미 있다」를 알고도 셀러가 «새로 만들기로» 정한 경우다. 여기서 막으면
 * 카테고리를 바꿀 방법이 영영 없어진다(쿠팡은 그 길뿐이다).
 */
export type CreateGateVerdict =
  /** 만들어도 된다. */
  | "ALLOW"
  /** 연결을 안다 — 새로 만들지 말고 UPDATE/RECREATE 로 가야 한다. */
  | "BLOCKED_LINKED"
  /** 🔴 연결은 모르는데 이미 나가 있다 — 만들면 중복이다. */
  | "BLOCKED_PRIOR_SUCCESS"
  /** 🔴 이미 나가 있는지 «확인하지 못했다». 모르면 만들지 않는다. */
  | "BLOCKED_UNKNOWN";

export function resolveCreateGate(input: {
  /** `channel_products` 에 현재 연결이 있는가. */
  hasChannelProduct: boolean;
  /** 이 snapshot × 이 채널로 한 번이라도 성공했는가. `null` = 확인 못 함. */
  priorSuccess: boolean | null;
  /** 이 요청이 수행하기로 «정해진» 작업. */
  plannedOperation: "CREATE" | "RECREATE";
}): CreateGateVerdict {
  /* 🔴 동의받은 재등록은 두 빗장 모두 지나간다 — 순서상 가장 먼저 본다. */
  if (input.plannedOperation === "RECREATE") return "ALLOW";
  if (blocksCreate(input.hasChannelProduct)) return "BLOCKED_LINKED";
  if (input.priorSuccess === null) return "BLOCKED_UNKNOWN";
  return input.priorSuccess ? "BLOCKED_PRIOR_SUCCESS" : "ALLOW";
}

/** 셀러가 읽는 문장. 🔴 막힌 이유마다 «할 수 있는 일» 이 달라 말도 다르다. */
export function createGateMessage(verdict: CreateGateVerdict, channelLabel: string, externalProductId?: string | null): string {
  switch (verdict) {
    case "ALLOW":
      return "";
    case "BLOCKED_LINKED":
      return `이미 ${channelLabel}에 등록된 상품입니다(${externalProductId ?? "번호 확인 불가"}) — 새로 만들지 않았습니다.`;
    case "BLOCKED_PRIOR_SUCCESS":
      return `이미 ${channelLabel}에 등록된 상품입니다 — 연결 정보를 찾지 못해 수정할 수 없고, 새로 만들면 중복이 되어 막았습니다.`;
    case "BLOCKED_UNKNOWN":
      return "이미 등록된 상품인지 확인하지 못해 새로 만들지 않았습니다.";
  }
}
