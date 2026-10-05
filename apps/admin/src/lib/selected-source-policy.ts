import type { PolicyOk } from "./sourcing-candidate-policy";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ④ — Selected Source **command 정책**. CRUD 와 «다른 일» 이다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   ② CRUD       Candidate «데이터» 를 만들고 고치고 지운다
 *   ④ Selection  Product 의 «의사표시» 를 바꾼다 — 칸 하나다
 *
 * 🔴 섞지 않는다(CPO 지시). 후보를 고치는 것과 「어디서 사올지 정하는 것」은
 * 권한도 되돌리는 방법도 다르다. 한 라우트에 넣으면 PATCH 하나가 선택까지
 * 바꿔 버리고, 셀러는 자기가 무엇을 바꿨는지 모른다.
 *
 * 🔴 **소유권 판단을 새로 쓰지 않는다.** `checkCandidateAccess()` 를 그대로 쓴다 —
 * 두 벌이 되면 한쪽에만 검사가 빠진다(이 저장소가 「호출부 하나가 빼먹는다」로
 * 네 번 겪은 유형). 이 파일에는 ②에 «없는» 결정만 있다.
 */

/**
 * 🔴 ②의 `PolicyDenial` 을 «넓히지 않는다» — 그 타입은 커밋된 결정이고, 거기에
 * 400 을 더하면 ②의 모든 판정이 400 을 돌려줄 수 있게 된다. ④에만 400 이 있다:
 * 「어느 후보를 고를지 지정하지 않았다」는 권한 문제가 아니라 요청 모양 문제다.
 * ②의 `PolicyDenial`(403|404|409|422)은 이 타입에 그대로 대입된다 — 부분집합이다.
 */
export type SelectionDenial = { ok: false; status: 400 | 403 | 404 | 409 | 422; error: string };

/**
 * ── 🔴 선택 쓰기가 «만질 수 있는 칸» ──────────────────────────────────────
 *
 * CPO 검증 5 — 「선택 시 `selected_sourcing_candidate_id` 만 변경」. 그것을 사람이
 * 읽고 확인하는 규칙이 아니라 **구조** 로 만든다: 패치를 여기서만 만들고, 칸이
 * 하나라는 것을 테스트가 못박는다. 라우트가 객체를 직접 쓰면 나중에 칸이 는다.
 */
export const SELECTION_WRITABLE_COLUMNS = ["selected_sourcing_candidate_id"] as const;

export function buildSelectionPatch(candidateId: string | null): Record<string, unknown> {
  /* 🔴 `updated_at` 조차 넣지 않는다. Product 의 다른 칸을 건드리면 그것이
     「상품이 수정됐다」로 읽히고, 등록 경로가 그 시각을 근거로 쓴다. */
  return { [SELECTION_WRITABLE_COLUMNS[0]]: candidateId };
}

/**
 * ── 선택 요청 모양 ────────────────────────────────────────────────────────
 *
 * 🔴 모르는 칸은 거절한다. 「선택하면서 가격도 같이 고치기」가 조용히 되면
 * ②와 ④의 경계가 사라진다 — 그 경계가 이 커밋의 전부다.
 */
const SELECTION_ALLOWED_FIELDS: readonly string[] = ["candidateId", "registrationReady"];

export function parseSelectionBody(
  body: Record<string, unknown> | null,
): PolicyOk<{ candidateId: string }> | SelectionDenial {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "요청 내용을 읽지 못했습니다." };
  }
  const unknown = Object.keys(body).filter((key) => !SELECTION_ALLOWED_FIELDS.includes(key));
  if (unknown.length > 0) {
    /* 🔴 여기서 `priceAmount` 같은 칸이 걸린다 — 선택 command 로 후보를 고칠 수 없다. */
    return { ok: false, status: 422, error: "소싱처 선택에는 후보만 지정할 수 있습니다." };
  }
  const candidateId = typeof body.candidateId === "string" ? body.candidateId.trim() : "";
  if (!candidateId) {
    return { ok: false, status: 400, error: "어느 소싱처를 선택할지 지정해야 합니다." };
  }
  return { ok: true, candidateId };
}

/**
 * ── 🔴 등록 readiness 는 이 API 가 «계산하지 않는다» ──────────────────────
 *
 * `computeMasterReady()` 는 `registrationReadyRequiredPassed` 를 «받는다» — 다시
 * 계산하지 않기로 한 결정이다(master-ready.ts: 판정을 두 곳에서 구현하면 화면과
 * 서버가 다른 말을 한다). 그래서 이 라우트도 계산하지 않고 받는다.
 *
 * 🔴 그런데 「받지 못한 것」을 `false` 로 넘기면 **「등록 준비가 안 됐다」고 단정** 하는
 * 것이 된다. 「모른다」와 「아니다」를 섞지 않는다 — 이 저장소가 반복해 지킨 원칙이다.
 * 그래서 평가 여부를 «따로» 돌려주고, 평가되지 않았으면 화면이 그 단계를 믿지
 * 않도록 표시한다.
 */
export function parseRegistrationReady(
  value: unknown,
): PolicyOk<{ evaluated: boolean; passed: boolean }> | SelectionDenial {
  if (value === undefined || value === null) return { ok: true, evaluated: false, passed: false };
  if (value === true || value === "true") return { ok: true, evaluated: true, passed: true };
  if (value === false || value === "false") return { ok: true, evaluated: true, passed: false };
  /* 🔴 모르는 값에 기본값을 골라 주지 않는다. */
  return { ok: false, status: 422, error: "등록 준비 여부를 알아볼 수 없습니다." };
}
