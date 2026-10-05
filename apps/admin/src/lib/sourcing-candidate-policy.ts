import { assertCandidateBelongsToProduct } from "./master-ready";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — Candidate CRUD **정책**. 라우트가 아니라 결정이다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 라우트 안에 정책을 숨기지 않는다. CPO 가 지정한 게이트 셋은 전부 «결정» 이고,
 * 라우트에 섞으면 다음 라우트가 생길 때 그 결정이 복사되거나 빠진다 — 이 저장소가
 * 「호출부 하나가 빼먹는다」로 네 번 겪은 유형이다.
 *
 *   ① ownership 이 «최우선» 이다 — force 보다 먼저
 *   ② CREATE 시점 provenance 검증 (077 이 CHECK 로 못 지키는 쪽)
 *   ③ Selected 삭제는 409, force=true 일 때만 허용 + 해제 사실을 «명시» 반환
 *
 * 🔴 순수 함수다 — DB 도 네트워크도 보지 않는다. 라우트가 DB 에서 읽은 사실을
 * 넘기면 판정만 돌려준다. 그래서 라우트가 여러 개가 되어도 판정은 하나다.
 */

/** 077 의 허용값 그대로 — 새 어휘를 만들지 않는다. */
export type SourceKind = "DISCOVERED" | "SELLER_ENTERED";

/** 🔴 HTTP 상태를 정책이 «정한다» — 라우트마다 다른 코드를 쓰면 화면이 갈린다. */
export type PolicyDenial = { ok: false; status: 403 | 404 | 409 | 422; error: string };
/* 🔴 기본값이 `Record<string, never>` 이면 안 된다 — `{ok:true} & Record<string,never>`
   의 `ok` 가 `never` 로 좁혀져 `{ ok: true }` 를 돌려줄 수 없게 된다(tsc 로 확인). */
export type PolicyOk<T = unknown> = { ok: true } & T;

/**
 * ── ① ownership — 🔴 **force 보다 «먼저»** ─────────────────────────────────
 *
 * 순서: workspace → Product → Candidate.
 *
 * 🔴 클라이언트가 보낸 productId 를 믿지 않는다(CPO 지시 3). 라우트는 DB 에서 읽은
 * `productWorkspaceId` 를 넘겨야 하고, 이 함수는 그것이 «요청자의» workspace 와
 * 같은지 본다.
 *
 * 🔴 「없음」과 「남의 것」을 같은 404 로 돌려준다 — 404 와 403 을 가르면 남의
 * Product 가 «존재한다» 는 사실이 새어 나간다(존재 여부 탐지). 이 저장소의
 * snapshot 소유권 검사가 이미 그 방식이다(쿼리 조건에 workspace 를 넣어 0행).
 */
export function checkCandidateAccess(input: {
  requesterWorkspaceId: string | null;
  productId: string;
  /** DB 에서 읽은 Product 의 workspace. Product 가 없으면 null 을 넘긴다. */
  productWorkspaceId: string | null | undefined;
  /** Candidate 를 지정한 요청만. DB 에서 읽은 그 후보의 product_id. */
  candidateProductId?: string | null;
}): PolicyOk | PolicyDenial {
  if (!input.requesterWorkspaceId) {
    return { ok: false, status: 403, error: "워크스페이스를 확인할 수 없습니다." };
  }
  /* Product 가 없거나 남의 것이면 «같은» 응답이다 — 존재 여부를 알려주지 않는다. */
  if (!input.productWorkspaceId || input.productWorkspaceId !== input.requesterWorkspaceId) {
    return { ok: false, status: 404, error: "상품을 찾을 수 없습니다." };
  }
  if (input.candidateProductId !== undefined) {
    const owned = assertCandidateBelongsToProduct({
      productId: input.productId,
      candidateProductId: input.candidateProductId,
    });
    if (!owned.ok) {
      /* 🔴 「다른 상품의 후보」도 404 로 돌려준다 — 그 후보가 존재한다는 사실을
         알려줄 이유가 없다. master-ready 의 문구는 «선택» 명령에서 쓰고(그때는
         셀러가 이미 그 후보를 화면에서 보고 있다), 여기서는 숨긴다. */
      return { ok: false, status: 404, error: "소싱 후보를 찾을 수 없습니다." };
    }
  }
  return { ok: true };
}

/**
 * ── 🔴 신규 행에 `source_kind = NULL` 을 «만들 수 없다» ────────────────────
 *
 * 077 이 NULL 을 허용하는 것은 **기존 행을 backfill 하지 않기로** 했기 때문이고,
 * 그 NULL 의 뜻은 「migration 이전 미확정(UNKNOWN)」이다 — 077 머리 주석이 그렇게
 * 적어 두었다. 🔴 신규 정상 상태가 «아니다».
 *
 * 그래서 CREATE 가 생략을 허용하면 안 된다. 허용하면 미확정 행이 계속 늘어나고,
 * 「NULL = legacy」라는 설명이 그 순간 거짓이 된다 — 그러면 화면은 어제 만든
 * 후보를 「migration 이전 것」이라고 말하게 된다.
 */
export function parseSourceKind(value: unknown): PolicyOk<{ sourceKind: SourceKind }> | PolicyDenial {
  if (value === "DISCOVERED" || value === "SELLER_ENTERED") {
    return { ok: true, sourceKind: value };
  }
  /* 🔴 「없음」도 「모르는 값」도 같은 거절이다 — 기본값을 골라 주지 않는다.
     둘 중 하나를 추측해 채우면 그 추측이 「사실」 칸에 들어앉는다. */
  return {
    ok: false,
    status: 422,
    error: "소싱 후보가 수집에서 나온 것인지 직접 입력한 것인지 지정해야 합니다.",
  };
}

/**
 * ── ② CREATE provenance — 🔴 077 이 CHECK 로 «못 지키는» 쪽 ────────────────
 *
 * 077 이 DB 에서 지키는 것:  SELLER_ENTERED → snapshot IS NULL
 * 🔴 이 함수가 지키는 것:    DISCOVERED → 생성 시점에 snapshot 이 «있어야» 한다
 *
 * 왜 CHECK 가 아닌가: snapshot 삭제 후 `DISCOVERED + NULL` 은 **정상** 이다.
 * CHECK 는 「언제나」를 요구하므로 그 규칙을 표현할 수 없다 — 생성 시점에만 참이다.
 *
 * 🔴 그리고 그 snapshot 이 «같은 Product» 의 것인지도 본다. 다른 Product 의
 * snapshot 을 provenance 로 붙이면 「어느 수집에서 봤는가」가 거짓이 된다.
 */
export function checkCreateProvenance(input: {
  sourceKind: SourceKind;
  originatingSnapshotId: string | null | undefined;
  /** DB 에서 읽은 그 snapshot 의 product_id. snapshot 이 없으면 null. */
  snapshotProductId?: string | null;
  productId: string;
}): PolicyOk | PolicyDenial {
  if (input.sourceKind === "SELLER_ENTERED") {
    if (input.originatingSnapshotId) {
      /* 077 의 CHECK 와 «같은» 규칙이다. DB 가 막지만 여기서도 막는 이유는
         사람이 읽는 말로 돌려주기 위해서다(날것 CHECK 위반 메시지 금지). */
      return {
        ok: false,
        status: 422,
        error: "직접 입력한 소싱 후보에는 수집 출처를 붙일 수 없습니다.",
      };
    }
    return { ok: true };
  }

  /* DISCOVERED */
  if (!input.originatingSnapshotId) {
    return {
      ok: false,
      status: 422,
      error: "수집에서 발견한 후보는 어느 분석에서 나왔는지 함께 저장해야 합니다.",
    };
  }
  if (!input.snapshotProductId || input.snapshotProductId !== input.productId) {
    /* 🔴 「없음」과 「남의 것」을 같은 응답으로 — 존재 여부를 알려주지 않는다. */
    return { ok: false, status: 404, error: "분석 기록을 찾을 수 없습니다." };
  }
  return { ok: true };
}

/**
 * ── UPDATE — 🔴 provenance 는 **read-only** ───────────────────────────────
 *
 * CPO 지시 8: 명시적으로 정의된 provenance 변경 기능이 없으므로 변경 불가로 둔다.
 * 🔴 셀러가 `DISCOVERED → SELLER_ENTERED` 로 바꾸거나 다른 Product 의 snapshot 을
 * 붙이는 우회를 막는다. 가격·URL 수정과 «다르게» 취급한다.
 */
export const CANDIDATE_IMMUTABLE_FIELDS = ["sourceKind", "originatingSnapshotId", "productId", "id"] as const;

/**
 * 🔴 **허용 목록이다 — 금지 목록이 아니다.** 금지만 적으면 나중에 추가되는 칸이
 * 기본 허용으로 새어 들어간다. 모르는 칸은 조용히 무시하지 «않고» 거절한다 —
 * 조용히 무시하면 화면은 「저장됐다」고 말하고 값은 안 바뀐다(이 저장소가
 * 「READY 인데 안 보냈다」로 한 번 겪은 구조다).
 */
export const CANDIDATE_MUTABLE_FIELDS = [
  "sourceUrl",
  "sourceSite",
  "sourceCountry",
  "priceAmount",
  "currency",
  "availability",
  "shippingNote",
  "identityMatchTruth",
  "observedAt",
] as const;

export function checkUpdatePatch(patch: Record<string, unknown>): PolicyOk<{ fields: string[] }> | PolicyDenial {
  const attempted = CANDIDATE_IMMUTABLE_FIELDS.filter((field) => field in patch);
  if (attempted.length > 0) {
    return {
      ok: false,
      status: 422,
      /* 🔴 내부 필드명을 셀러에게 그대로 노출하지 않는다. */
      error: "소싱 후보의 출처 정보는 수정할 수 없습니다.",
    };
  }
  const keys = Object.keys(patch);
  const unknown = keys.filter((key) => !(CANDIDATE_MUTABLE_FIELDS as readonly string[]).includes(key));
  if (unknown.length > 0) {
    return { ok: false, status: 422, error: "수정할 수 없는 항목이 포함됐습니다." };
  }
  if (keys.length === 0) {
    /* 🔴 빈 수정을 성공으로 돌려주지 않는다 — 화면이 「저장됐다」고 말한다. */
    return { ok: false, status: 422, error: "수정할 내용이 없습니다." };
  }
  return { ok: true, fields: keys };
}

/**
 * ── 🔴 DB CHECK 위반이 «셀러에게 날것으로» 가지 않게 한다 ──────────────────
 *
 * 075 가 `availability` 와 `identity_match_truth` 에 CHECK 를 걸었다. 그 CHECK 가
 * 거절하면 Postgres 의 제약 위반 문구가 그대로 화면에 간다 — 셀러가 읽을 수 없고,
 * 내부 제약명이 노출된다.
 *
 * 🔴 **어휘를 새로 만드는 것이 아니다.** 075 SQL · source-stock.ts · 030 이 쓰는
 * 목록 «그대로» 다. 테스트가 세 곳을 대조해 어긋나면 실패한다 — 그렇지 않으면
 * 이 목록이 조용히 낡는다.
 */
export const CANDIDATE_AVAILABILITY_VALUES = ["IN_STOCK", "OUT_OF_STOCK", "INVALID", "UNKNOWN"] as const;

export const CANDIDATE_MATCH_TRUTH_VALUES = [
  "EXACT_IDENTIFIER",
  "STRONG_IDENTIFIER",
  "TEXT_CONFIRMED",
  "SIMILAR",
  "INSUFFICIENT_EVIDENCE",
  "CONFLICT",
] as const;

export function checkCandidateValues(input: Record<string, unknown>): PolicyOk | PolicyDenial {
  if (
    input.availability != null &&
    !(CANDIDATE_AVAILABILITY_VALUES as readonly unknown[]).includes(input.availability)
  ) {
    return { ok: false, status: 422, error: "재고 상태 값을 알아볼 수 없습니다." };
  }
  if (
    input.identityMatchTruth != null &&
    !(CANDIDATE_MATCH_TRUTH_VALUES as readonly unknown[]).includes(input.identityMatchTruth)
  ) {
    return { ok: false, status: 422, error: "동일상품 근거 값을 알아볼 수 없습니다." };
  }
  if ("priceAmount" in input && input.priceAmount != null) {
    /* 🔴 「가격이 있다」가 아니라 「숫자인가」를 본다. 문자열 "무료" 가 들어오면
       NUMERIC 칸에서 터지고, 그 메시지도 셀러가 읽을 수 없다.

       🔴 `Number("")` 은 **0** 이다. 그래서 빈 칸을 그냥 Number() 에 넘기면 셀러가
       비운 가격이 「0원」으로 저장된다 — 「모름」을 「0」으로 바꾸는 바로 그 경로다
       (이 저장소가 재고 999 로 두 번 겪은 구조). 비우려면 `null` 을 보내야 한다. */
    const raw = input.priceAmount;
    const amount =
      typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, status: 422, error: "원가는 0 이상의 숫자여야 합니다." };
    }
  }
  return { ok: true };
}

/**
 * ── ③ Selected 삭제 — 🔴 409, force 일 때만 ───────────────────────────────
 *
 * 🔴 **ownership 검증이 이 함수보다 «먼저»** 다. 라우트는 반드시
 * `checkCandidateAccess()` 를 통과한 뒤에만 이것을 부른다 — 그 순서가 뒤바뀌면
 * `force=true` 가 남의 후보를 지우는 우회가 된다(CPO 지시 3).
 * 이 함수는 소유권을 «다시» 보지 않는다. 그래서 순서를 테스트로 못박는다.
 *
 * DB 의 `ON DELETE SET NULL (selected_sourcing_candidate_id)`(076)은 그대로 둔다 —
 * 안전망이고, API 가 빠뜨려도 dangling reference 가 생기지 않는다. 역할이 다르다.
 */
export function checkCandidateDelete(input: {
  /** 이 후보가 현재 Product 의 Selected 인가. */
  isSelected: boolean;
  /** 셀러가 «명시적으로» 보낸 의도. undefined 는 force 가 아니다. */
  force?: boolean;
}): PolicyOk<{ selectedCleared: boolean }> | PolicyDenial {
  if (input.isSelected && input.force !== true) {
    return {
      ok: false,
      status: 409,
      error: "선택한 소싱처입니다 — 다른 후보를 선택하거나 선택을 해제한 뒤 삭제하세요.",
    };
  }
  /* 🔴 「삭제 결과 선택도 풀렸다」를 응답에 «명시» 한다(CPO 지시). 조용히 풀면
     셀러는 Master 가 왜 해제됐는지 모른다. 품절(OUT_OF_STOCK)과 혼동하지 않는다 —
     품절은 선택을 유지하고 경고만 올린다(master-ready.ts). */
  return { ok: true, selectedCleared: input.isSelected };
}
