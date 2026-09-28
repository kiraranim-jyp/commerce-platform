import { NextResponse, type NextRequest } from "next/server";
import { requireRegistrationAccess } from "@/lib/auth/require-registration-access";
import { buildChannelEditModel } from "@/app/pipeline/commerce/channel-edit-model";
import { coupangEditAdapter } from "@/app/pipeline/commerce/edit-adapters/coupang";
import { findChannelProductBySnapshot } from "../../_lib/channel-product";
import { getCoupangCredentials } from "../_lib/env";
import { fetchCoupangBaseline } from "../_lib/update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-WIRE-01 Phase 3 A — **수정 화면이 쓸 「지금 나가 있는 값」.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 형제 라우트(`api/smartstore/registered-product`)와 «같은 계약» 이다. 문구도
 * 응답 모양도 맞춘다 — 화면이 채널마다 다른 방식으로 실패를 읽어야 하면 한
 * 채널만 빠뜨리는 일이 생긴다.
 *
 * ── 🔴 상품번호를 «받지» 않는다 ──────────────────────────────────────────
 * `snapshotId` 만 받고 어느 `sellerProductId` 를 읽을지는 서버가
 * `channel_products` 에서 직접 찾는다. 번호를 쿼리로 받아 그대로 읽으면
 * 로그인한 누구나 남의 상품을 열 수 있고, 그 화면에서 수정을 누르면 남의
 * 상품이 고쳐진다. 쿠팡에는 이미 중복 3건이 있다 — 번호는 우리가 정한다.
 *
 * ── 🔴 여기서 판단하지 않는다 ────────────────────────────────────────────
 * 수정해도 되는 상태인지(SAVED)도, UPDATE 인지 RECREATE 인지도 이 라우트가
 * 정하지 않는다. 상태 게이트는 실행부(`updateCoupangProduct`)가 «전송 직전에»
 * 한 번 더 본다 — 읽은 시점과 보내는 시점 사이에 상태가 변할 수 있기 때문이다.
 * 이 라우트는 읽어서 «옮기는» 일만 한다.
 *
 * 🔴 GET 만 둔다. `PUT`/`POST` 를 여기 얹지 않는다 — 읽기 라우트가 쓰기를 겸하면
 * 「읽어 보기」가 실수로 전송이 되는 길이 생긴다.
 */

/** 화면이 이 값으로 「무슨 말을 할지」 고른다. 🔴 실패를 성공으로 뭉개지 않는다. */
export type CoupangRegisteredProductReason =
  /** 이 상품은 아직 쿠팡에 연결돼 있지 않다 — 오류가 아니다. */
  | "NOT_LINKED"
  | "NOT_CONFIGURED"
  /** 🔴 채널에서 읽지 «못했다». 「값이 없다」가 아니다. */
  | "FETCH_FAILED"
  | "INVALID_LINK";

export async function GET(request: NextRequest) {
  const snapshotId = request.nextUrl.searchParams.get("snapshotId");

  /* 🔴 등록 라우트와 «같은 게이트» 다. 쿠팡 자격증명도 전역이라, 이 라우트를
     막지 않으면 다른 워크스페이스 셀러가 대표 계정의 상품을 읽게 된다. */
  const access = await requireRegistrationAccess(snapshotId);
  if (!access.ok) return access.response;

  const link = await findChannelProductBySnapshot(snapshotId, "coupang");
  if (!link) {
    return NextResponse.json({
      ok: false,
      reason: "NOT_LINKED" satisfies CoupangRegisteredProductReason,
      message: "이 상품은 아직 쿠팡에 등록된 것으로 연결돼 있지 않습니다.",
    });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({
      ok: false,
      reason: "NOT_CONFIGURED" satisfies CoupangRegisteredProductReason,
      message: "쿠팡 인증 정보가 설정되어 있지 않아 현재 등록된 내용을 읽지 못했습니다.",
    });
  }

  /* 🔴 실행부와 «같은» GET 을 쓴다(`fetchCoupangBaseline`). 읽기 전용 사본을
     따로 만들면 화면이 본 baseline 과 전송 직전 baseline 의 모양이 갈린다. */
  const fetched = await fetchCoupangBaseline(credentials, link.externalProductId);
  if (!fetched.ok) {
    /* 🔴 읽지 못한 것을 빈 기준값으로 내려보내지 않는다. 그러면 화면이 모든
       항목을 「지금 값 없음」으로 그리고, 셀러는 수정을 누르는 순간 전부
       사라진다고 읽는다. */
    return NextResponse.json({
      ok: false,
      reason: "FETCH_FAILED" satisfies CoupangRegisteredProductReason,
      message: fetched.message,
      externalProductId: link.externalProductId,
    });
  }

  /* 🔴 쿠팡 응답을 «중립 통화» 로 번역해 넘긴다. Core 는 쿠팡 모양을 모른다 —
     `CoupangRegisteredProduct` 가 이 라우트 밖으로 새어 나가지 않는다. */
  const built = buildChannelEditModel(
    { kind: "CHANNEL_GET", commerceId: "coupang", externalProductId: link.externalProductId },
    coupangEditAdapter.readRegistered(fetched.baseline),
  );
  if (!built.ok) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_LINK" satisfies CoupangRegisteredProductReason,
      message: built.message,
    });
  }

  /* 🔴 `model` 만 내려준다. 필드 목록은 화면이 `editorFieldSchema(model)` 로
     만든다 — 여기서 같이 내려보내면 같은 사실이 두 벌이 되고 반드시 갈라진다.
     🔴 baseline 원문도 내려보내지 «않는다». 화면은 그것으로 할 일이 없고,
     내려보내면 다음 사람이 그 값으로 PUT 전문을 만들려 한다. */
  return NextResponse.json({ ok: true, model: built.model, channelProductId: link.id });
}
