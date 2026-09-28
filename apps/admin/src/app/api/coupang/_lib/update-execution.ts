import type { CoupangLossRisk, CoupangProductEdits } from "@commerce/listing";
import { sameExternalProductId } from "@/app/pipeline/commerce/commerce-edit-adapter";
import { fieldCapability, FIELD_ORDER, type EditableField } from "@/app/pipeline/commerce/channel-field-capability";
import { resolveSavedScopedUpdate } from "@/app/pipeline/commerce/channel-lifecycle";
import type { CoupangCredentials } from "./env";
import { fetchCoupangBaseline, updateCoupangProduct } from "./update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-WIRE-01 Phase 3 E — **UPDATE 실행 경계. CREATE 와 섞이지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * register 라우트가 이 함수를 «buildCoupangPayload 보다 앞에서» 부르고 곧바로
 * 반환한다. 그래서 UPDATE 요청은 CREATE payload 조립을 **지나가지 않는다** —
 * 「UPDATE 인데 CREATE payload 를 만들 이유가 없다」가 구조로 성립한다.
 *
 * 🔴 **이 파일에 `buildCoupangPayload` 가 «없다».** import 도 하지 않는다.
 * 그것이 이 모듈을 따로 만든 이유이고, 형제 테스트가 소스에서 그 부재를 센다.
 * 여기에 빌더가 들어오는 순간 「Master → 전체 payload → PUT」이 열린다(CPO 금지).
 *
 * ── 🔴 Master 는 «변경값의 출처» 이지 «전문의 출처» 가 아니다 ──────────────
 * 이 함수가 Master 에서 받는 것은 `title` 문자열 «하나» 다. 전문은 전부
 * `fetchCoupangBaseline()` 이 읽어 온 GET 응답에서 나오고, 덮어쓰는 일은
 * `applyCoupangEdits()` 가 한다 — 그 둘 다 `update-product.ts` 안에서 끝난다.
 *
 * ── 순서가 곧 안전장치다 ─────────────────────────────────────────────────
 *   ① 번호 대조    화면이 보고 고친 상품과 지금 연결된 상품이 같은가 (TOCTOU)
 *   ② GET baseline  없으면 아무것도 못 한다
 *   ③ 상태 판단     SAVED 가 아니면 막는다 — 판단은 lifecycle 한 곳에서
 *   ④ 축 좁히기     capability 가 EDITABLE 이라고 한 축만 남긴다
 *   ⑤ overlay~PUT   `updateCoupangProduct` 가 게이트·손실검사·번호검증까지
 */

/** 🔴 실패 이유를 «구분해서» 말한다 — 원인이 다르면 셀러가 할 일도 다르다. */
export type CoupangUpdateExecutionFailure =
  /** 화면이 보던 상품과 지금 연결된 상품이 다르다. */
  | "PRODUCT_MISMATCH"
  /** 이 상품이 쿠팡에 연결돼 있지 않다. */
  | "NOT_LINKED"
  /** 지금 등록된 내용을 읽지 못했다. */
  | "FETCH"
  /** 지금 고칠 수 있다고 «확인된» 상태가 아니다. */
  | "STATUS"
  /** 우리가 고치는 법을 아는 항목이 하나도 없다. */
  | "NO_EDITABLE_CHANGE"
  /** 보내면 사라지거나 줄어드는 것이 있다. */
  | "PREFLIGHT"
  | "SUBMIT"
  | "VERIFY";

export type CoupangUpdateExecution =
  | { ok: true; sellerProductId: string; changed: readonly EditableField[] }
  | {
      ok: false;
      failure: CoupangUpdateExecutionFailure;
      message: string;
      retryable: boolean;
      risks?: CoupangLossRisk[];
    };

export interface CoupangUpdateExecutionInput {
  credentials: CoupangCredentials;
  /** 🔴 `channel_products` 에서 «서버가» 찾은 번호다. 클라이언트가 준 것이 아니다. */
  sellerProductId: string | null;
  /** 화면이 실제로 보고 고친 번호. 다르면 남의 상품을 고치는 것이 된다(F-12b). */
  expectedExternalProductId?: string | null;
  /** 🔴 셀러가 이번에 고친 항목의 «이름». 값은 오지 않는다. */
  editedFields: readonly string[];
  /** 🔴 Master 에서 온 상품명 «변경값». 전문이 아니다. */
  title: string;
}

/** 우리가 이름을 아는 편집 축인가. 🔴 모르는 이름은 조용히 버리지 않고 걸러낸다. */
function asEditableField(name: string): EditableField | null {
  return (FIELD_ORDER as readonly string[]).includes(name) ? (name as EditableField) : null;
}

export async function executeCoupangUpdate(
  input: CoupangUpdateExecutionInput,
): Promise<CoupangUpdateExecution> {
  const { credentials, sellerProductId, expectedExternalProductId, editedFields, title } = input;

  /* ── ① 연결과 번호 대조 ─────────────────────────────────────────────────
     🔴 연결이 없으면 «수정이 아니다». 여기서 CREATE 로 흘려보내지 않는다 —
     그것이 중복 등록을 만드는 길이다(쿠팡 중복 3건). */
  if (!sellerProductId) {
    return {
      ok: false,
      failure: "NOT_LINKED",
      message: "이 상품은 아직 쿠팡에 등록된 것으로 연결돼 있지 않아 수정할 수 없습니다.",
      retryable: false,
    };
  }
  /* 🔴 화면이 불러온 뒤 연결이 갈아끼워졌을 수 있다. 다르면 «보내지 않는다» —
     셀러는 A 를 보고 고쳤는데 B 가 수정되는 일이 그렇게 일어난다. */
  if (expectedExternalProductId && !sameExternalProductId(expectedExternalProductId, sellerProductId)) {
    return {
      ok: false,
      failure: "PRODUCT_MISMATCH",
      message:
        "화면에서 보고 계신 상품과 지금 연결된 쿠팡 상품이 달라 수정하지 않았습니다 — 등록된 내용을 다시 불러와주세요.",
      retryable: true,
    };
  }

  /* ── ② GET baseline ───────────────────────────────────────────────────── */
  const fetched = await fetchCoupangBaseline(credentials, sellerProductId);
  if (!fetched.ok) {
    return { ok: false, failure: "FETCH", message: fetched.message, retryable: true };
  }
  const baseline = fetched.baseline;

  /* ── ③ 상태 판단 — 🔴 판단은 lifecycle «한 곳» 에서 한다 ─────────────────
     실행부(`updateCoupangProduct`)도 전송 직전에 같은 게이트를 한 번 더 본다.
     두 번 보는 것이 중복이 아니다 — 읽은 시점과 보내는 시점이 다르다. */
  const status = typeof baseline.status === "string" ? baseline.status : null;
  const changedFields = editedFields
    .map(asEditableField)
    .filter((f): f is EditableField => f !== null)
    /* ── ④ 🔴 capability 가 «열었다고 말한» 축만 남긴다 ──────────────────
       화면이 EDITABLE 이라고 그린 것과 서버가 실제로 보내는 것이 같아야 한다.
       여기서 걸러진 축은 UI 에서도 UNKNOWN 이라 셀러가 고칠 수 없다. */
    .filter((f) => fieldCapability("coupang", f) === "EDITABLE");

  const decision = resolveSavedScopedUpdate(
    {
      fields: changedFields,
      /* 카테고리는 쿠팡에서 `RECREATE_ONLY` 다 — 이 경로로 오지 않는다. */
      category: false,
      categoryUnknown: false,
      /* 🔴 전수로 비교하지 «않았다». 상품명 축 하나만 본다. */
      comparedEverything: false,
    },
    status,
  );
  if (decision.operation !== "UPDATE") {
    return { ok: false, failure: "STATUS", message: decision.reason, retryable: true };
  }

  /* 🔴 고칠 «수 있는» 변경이 하나도 없으면 보내지 않는다. 빈 edits 로 전체를
     되보내면 아무것도 안 바뀐 전문이 다시 등록 심사에 걸리고, 셀러에게
     「수정했다」고 말할 근거도 없다. */
  if (changedFields.length === 0) {
    return {
      ok: false,
      failure: "NO_EDITABLE_CHANGE",
      message: "지금 쿠팡에서 수정할 수 있다고 확인된 항목 중 달라진 것이 없어 보내지 않았습니다.",
      retryable: false,
    };
  }

  /* ── ⑤ 변경값을 «축별로» 담는다 ─────────────────────────────────────────
     🔴 `CoupangProductEdits` 에 없는 축은 애초에 담을 자리가 없다. 그래서
     capability 를 넓히면서 이 타입을 같이 넓히지 않으면 컴파일이 아니라
     «조용한 무시» 가 되는데, ④의 필터가 그보다 먼저 막는다. */
  const edits: CoupangProductEdits = {};
  if (changedFields.includes("name")) edits.name = title;

  const result = await updateCoupangProduct(credentials, sellerProductId, edits, baseline);
  if (result.ok) {
    return { ok: true, sellerProductId: result.sellerProductId, changed: changedFields };
  }
  return {
    ok: false,
    failure: result.step,
    message: result.message,
    retryable: result.step === "FETCH" || result.step === "SUBMIT",
    risks: result.risks,
  };
}
