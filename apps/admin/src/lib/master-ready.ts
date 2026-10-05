/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ⑦ — **Master Ready 는 «저장 상태가 아니라 파생 계산» 이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PIVOT-02 가 내린 결정을 코드로 고정한다. 책임 경계:
 *
 *   Product            persistent identity          (DB)
 *   Snapshot           collection / analysis run    (DB)
 *   SourcingCandidate  sourcing evidence            (DB, 075)
 *   Selected Source    seller's explicit decision   (DB, products 컬럼 — 076 이 제약)
 *   🔴 Master Ready    derived application state    ← **이 파일. DB 에 칸이 없다.**
 *   Commerce Product   channel registration result  (DB)
 *
 * ── 🔴 왜 저장하지 않는가 ───────────────────────────────────────────────────
 * Master Ready 는 세 가지의 «현재» 상태에 달려 있다 — Product 존재 · 선택된 후보 ·
 * 기존 readiness. 그 중 readiness 는 이미 온디맨드 계산이고(computeChecklistReadiness
 * 등), 후보의 재고·가격도 바뀐다. 저장하면 「준비됨」이 지금 사실인지 과거
 * 스냅샷인지 모호해진다 — 이 저장소가 MI 판단을 저장하지 않기로 한 것과 같은 이유다.
 *
 * ── 🔴 상태값을 새로 만들지 않았다 ──────────────────────────────────────────
 * `product_snapshots.status`(IN_PROGRESS|REGISTERED)를 확장하지 «않는다». 그것은
 * 「수집·분석 실행」의 lifecycle 이고 Master 는 Product 의 것이다. 섞으면 재분석으로
 * 새 snapshot 이 IN_PROGRESS 가 되는 순간 **이미 확정된 Master 가 미확정으로 보인다**
 * (schema.prisma 머리 주석이 기록한 외부번호 6개 사고와 같은 구조).
 * 아래 단계값은 **DB 에 저장되지 않는 화면용 파생값** 이다.
 */

/** 🔴 DB 컬럼이 아니다 — 화면이 「지금 어디까지 왔는가」를 말하기 위한 파생값이다. */
export type MasterStage =
  /** Product 는 있지만 소싱 후보가 아직 없다. */
  | "DISCOVERED"
  /** 후보는 있는데 아직 고르지 않았다 — 셀러의 의사표시를 기다린다. */
  | "SOURCING_READY"
  /** 후보를 골랐다 = Master 확정(PIVOT-02 ④). 다만 등록 준비는 아직일 수 있다. */
  | "SOURCE_SELECTED"
  /** 선택까지 됐고 기존 등록 readiness 도 통과했다. */
  | "READY_FOR_COMMERCE";

export interface MasterReadyInput {
  /** Product 가 발급됐는가. 최초 저장에서 발급되므로 보통 true 다. */
  hasProduct: boolean;
  /** 이 Product 가 가진 후보 수(availability 와 무관한 «존재» 개수). */
  candidateCount: number;
  /** `products.selected_sourcing_candidate_id`. 고르지 않았으면 null. */
  selectedCandidateId: string | null;
  /**
   * 선택된 후보의 availability — SourceStockState 그대로.
   * 🔴 OUT_OF_STOCK 이어도 선택을 «해제하지 않는다»(PIVOT-02 Case 4).
   */
  selectedAvailability?: "IN_STOCK" | "OUT_OF_STOCK" | "INVALID" | "UNKNOWN" | null;
  /**
   * 기존 등록 readiness 가 통과했는가. 🔴 이 파일이 다시 계산하지 «않는다» —
   * `computeChecklistReadiness` / `computeNaverPayloadReadiness` 의 결과를 받는다.
   * 판정을 두 곳에서 구현하면 화면과 서버가 다른 말을 한다(CP001 사고).
   */
  registrationReadyRequiredPassed: boolean;
}

export interface MasterReadyResult {
  stage: MasterStage;
  /** Master 가 확정됐는가 = 셀러가 소싱처를 골랐는가(PIVOT-02 ④). */
  masterConfirmed: boolean;
  /** 지금 Commerce 로 보낼 수 있는가. */
  readyForCommerce: boolean;
  /**
   * 🔴 「막힌 이유」가 아니라 「다음에 할 일」. 없으면 null.
   * 화면이 이 문장을 그대로 쓸 수 있어야 한다 — 코드명을 노출하지 않는다.
   */
  nextAction: string | null;
  /** 🔴 선택은 유지하면서 경고만 띄우는 자리(품절 등). 없으면 null. */
  warning: string | null;
}

/**
 * 🔴 **순수 함수다.** DB 도 네트워크도 보지 않는다 — 그래서 어디서든 같은 답을 내고,
 * 저장할 이유가 없다.
 */
export function computeMasterReady(input: MasterReadyInput): MasterReadyResult {
  if (!input.hasProduct) {
    /* 정체성이 없는 상태. 실제로는 최초 저장에서 발급되므로 드물지만, 기존 381건처럼
       product_id 가 null 인 snapshot 이 있다 — 그 경우를 「준비됨」으로 읽지 않는다. */
    return {
      stage: "DISCOVERED",
      masterConfirmed: false,
      readyForCommerce: false,
      nextAction: "상품을 저장하면 소싱 후보를 모을 수 있습니다.",
      warning: null,
    };
  }

  if (!input.selectedCandidateId) {
    /* 🔴 후보가 «있는지» 와 «골랐는지» 를 가른다. 둘을 뭉개면 「후보가 없어서 못
       고른 것」과 「고르지 않은 것」이 같은 문장이 되고, 셀러가 할 일이 달라진다. */
    const hasCandidates = input.candidateCount > 0;
    return {
      stage: hasCandidates ? "SOURCING_READY" : "DISCOVERED",
      masterConfirmed: false,
      readyForCommerce: false,
      nextAction: hasCandidates
        ? "소싱 후보 중에서 어디서 사올지 고릅니다."
        : "아직 소싱 후보가 없습니다 — 가격을 조사하면 후보가 모입니다.",
      warning: null,
    };
  }

  /* ── 여기부터 Master 확정이다(PIVOT-02 ④ — 선택 시점) ─────────────────────
     🔴 품절이어도 확정은 유지한다. 자동으로 풀면 셀러가 «왜» 풀렸는지 모른다.
     경고만 올리고 결정은 셀러에게 남긴다. */
  const warning =
    input.selectedAvailability === "OUT_OF_STOCK"
      ? "선택한 소싱처가 품절입니다 — 다른 후보로 바꾸거나 재입고를 기다려야 합니다."
      : input.selectedAvailability === "INVALID"
        ? "선택한 소싱처의 재고 표기를 읽지 못했습니다 — 직접 확인이 필요합니다."
        : input.selectedAvailability === "UNKNOWN" || input.selectedAvailability == null
          ? "선택한 소싱처의 재고를 아직 확인하지 못했습니다."
          : null;

  if (!input.registrationReadyRequiredPassed) {
    return {
      stage: "SOURCE_SELECTED",
      masterConfirmed: true,
      readyForCommerce: false,
      nextAction: "등록에 필요한 항목을 채우면 커머스에 보낼 수 있습니다.",
      warning,
    };
  }

  return {
    stage: "READY_FOR_COMMERCE",
    masterConfirmed: true,
    readyForCommerce: true,
    nextAction: null,
    warning,
  };
}

/**
 * 🔴 **cross-product 선택을 사람이 읽는 말로 거절한다.**
 *
 * 076 이 복합 FK 로 DB 에서 막지만, DB 가 거절하면 셀러에게는 날것 에러가 간다.
 * 역할이 다르다 — DB 는 «구조적 보증», 이것은 «설명» 이다. 둘 다 둔다.
 *
 * 🔴 Prisma 는 그 복합 FK 를 모르므로(076 주석) 이 검사를 생략하면 Prisma 경로로
 * 들어온 쓰기가 DB 에서 터진다.
 */
export function assertCandidateBelongsToProduct(input: {
  productId: string;
  candidateProductId: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (!input.candidateProductId) {
    return { ok: false, error: "소싱 후보를 찾을 수 없습니다." };
  }
  if (input.candidateProductId !== input.productId) {
    /* 🔴 상대 Product 의 id 를 메시지에 담지 않는다 — 다른 워크스페이스의 식별자가
       새어 나갈 수 있다. 셀러가 할 수 있는 행동만 말한다. */
    return { ok: false, error: "다른 상품의 소싱 후보는 선택할 수 없습니다." };
  }
  return { ok: true };
}
