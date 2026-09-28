import {
  applyCoupangEdits,
  coupangUpdateGate,
  detectCoupangUpdateLoss,
  type CoupangLossRisk,
  type CoupangProductEdits,
  type CoupangRegisteredProduct,
} from "@commerce/listing";
import { callCoupangApi } from "./client";
import type { CoupangCredentials } from "./env";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-IMPLEMENT-01 — **GET → overlay → 전체 PUT**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SmartStore 의 `updateRegisteredProduct()` 와 «같은 자리·같은 순서» 다.
 * 다른 것은 baseline 의 출처뿐이다 — 쿠팡은 공식이 「조회한 전문을 되보내라」고
 * 지시하므로, 여기서 만드는 전문은 **GET 응답에서만** 나온다.
 *
 * 🔴 이 파일에 «Master 에서 payload 를 만드는 길» 은 없다. 인자로도 받지 않는다 —
 * 받을 수 있게 열어 두면 언젠가 그 길로 간다(CPO 금지 항목).
 *
 * ── 순서가 곧 안전장치다 ─────────────────────────────────────────────────
 *   ① GET        baseline 이 없으면 아무것도 못 한다 → 실패
 *   ② STATUS     임시저장이 아니면 → 막는다 (확인한 범위 밖)
 *   ③ OVERLAY    고친 칸만 덮는다
 *   ④ PREFLIGHT  사라지거나 줄어든 것이 있으면 → 막는다
 *   ⑤ PUT        위 넷을 전부 통과했을 때만
 *   ⑥ VERIFY     돌아온 상품번호가 «같은 상품» 인지 본다
 */

const PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";

export type CoupangUpdateResult =
  | { ok: true; sellerProductId: string }
  | {
      ok: false;
      /** 🔴 어디서 멈췄는지 «구분해서» 말한다 — 원인이 다르면 셀러가 할 일도 다르다. */
      step: "FETCH" | "STATUS" | "PREFLIGHT" | "SUBMIT" | "VERIFY";
      message: string;
      risks?: CoupangLossRisk[];
    };

/** 🔴 쿠팡 응답 봉투를 푼다. `data` 가 곧 상품 전문이다(실측). */
export async function fetchCoupangBaseline(
  credentials: CoupangCredentials,
  sellerProductId: string,
): Promise<{ ok: true; baseline: CoupangRegisteredProduct } | { ok: false; message: string }> {
  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: `${PATH}/${encodeURIComponent(sellerProductId)}`,
    });
    if (response.status >= 400) {
      return { ok: false, message: `쿠팡이 상품 조회를 거부했습니다(HTTP ${response.status}).` };
    }
    const body = response.body as { code?: string; data?: unknown } | null;
    const data = body?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      /* 🔴 「빈 baseline 으로 진행」이 없다. baseline 없이 전체 교체를 보내면
         그 상품의 모든 값을 지우는 것이 된다. */
      return { ok: false, message: "쿠팡 응답에서 상품 정보를 찾지 못했습니다." };
    }
    return { ok: true, baseline: data as CoupangRegisteredProduct };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다." };
  }
}

/** 요청한 상품과 돌아온 상품이 같은가. 🔴 문자열로만 본다 — 숫자 변환에서 샌다. */
function sameProduct(requested: string, responded: unknown): boolean {
  if (responded === null || responded === undefined) return false;
  return String(responded).trim() === requested.trim();
}

export async function updateCoupangProduct(
  credentials: CoupangCredentials,
  sellerProductId: string,
  edits: CoupangProductEdits,
  /** 이미 읽어 둔 baseline 이 있으면 다시 읽지 않는다(같은 요청 안에서 두 번 GET 하지 않기). */
  prefetched?: CoupangRegisteredProduct,
): Promise<CoupangUpdateResult> {
  /* ── ① GET ─────────────────────────────────────────────────────────────── */
  let baseline = prefetched;
  if (!baseline) {
    const fetched = await fetchCoupangBaseline(credentials, sellerProductId);
    if (!fetched.ok) return { ok: false, step: "FETCH", message: fetched.message };
    baseline = fetched.baseline;
  }

  /* ── ② 상태 게이트 ─────────────────────────────────────────────────────── */
  const gate = coupangUpdateGate(baseline);
  if (!gate.allowed) {
    /* 🔴 셀러에게 내부 상태코드를 보이지 않는다. 그리고 「안 된다」가 아니라
       「확인되지 않았다」로 말한다 — 승인 후 경로는 재 본 적이 없다. */
    const message =
      gate.reason === "STATUS_NOT_SAVED"
        ? "판매 승인이 진행된 상품을 수정할 수 있는지 아직 확인되지 않았습니다."
        : "이 상품이 지금 어떤 상태인지 확인하지 못해 수정할 수 없습니다.";
    return { ok: false, step: "STATUS", message };
  }

  /* ── ③ overlay ─────────────────────────────────────────────────────────── */
  const outgoing = applyCoupangEdits(baseline, edits);

  /* ── ④ 손실 검사 ───────────────────────────────────────────────────────── */
  const risks = detectCoupangUpdateLoss(baseline, outgoing);
  if (risks.length > 0) {
    return {
      ok: false,
      step: "PREFLIGHT",
      message: `지금 보내면 ${risks.length}가지가 사라지거나 줄어듭니다 — 보내지 않았습니다.`,
      risks,
    };
  }

  /* ── ⑤ PUT ─────────────────────────────────────────────────────────────── */
  let response;
  try {
    response = await callCoupangApi(credentials, { method: "PUT", path: PATH, body: outgoing });
  } catch (error) {
    return {
      ok: false,
      step: "SUBMIT",
      message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
    };
  }
  if (response.status >= 400) {
    const body = response.body as { message?: string } | null;
    return {
      ok: false,
      step: "SUBMIT",
      message: body?.message || `쿠팡이 수정을 거부했습니다(HTTP ${response.status}).`,
    };
  }

  /* ── ⑥ 같은 상품인가 ───────────────────────────────────────────────────── */
  const body = response.body as { code?: string; data?: unknown } | null;
  if (!sameProduct(sellerProductId, body?.data)) {
    /* 🔴 이 저장소는 «조용히 새 상품이 생기는» 사고를 이미 겪었다(쿠팡 중복 3건 ·
       스마트스토어 외부번호 6개). 응답 번호가 다르면 성공이라고 말하지 않는다. */
    return {
      ok: false,
      step: "VERIFY",
      message: "쿠팡이 다른 상품번호로 응답했습니다 — 수정이 아니라 새 상품이 생겼을 수 있습니다.",
    };
  }
  return { ok: true, sellerProductId };
}
