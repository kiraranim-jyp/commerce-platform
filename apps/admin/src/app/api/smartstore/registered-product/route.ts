import { NextResponse, type NextRequest } from "next/server";
import { requireRegistrationAccess } from "@/lib/auth/require-registration-access";
import { buildChannelEditModel } from "@/app/pipeline/commerce/channel-edit-model";
import { smartStoreEditAdapter } from "@/app/pipeline/commerce/edit-adapters/smartstore";
import { findChannelProductBySnapshot } from "../../_lib/channel-product";
import { getNaverCredentials } from "../../naver/_lib/env";
import { issueNaverAccessToken } from "../../naver/_lib/client";
import { fetchRegisteredProduct } from "../_lib/update-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3 — **수정 화면이 쓸 「지금 나가 있는 값」.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 수정 화면의 기준값은 채널에서 GET 한 것 하나뿐이다. 그 GET 은 판매자
 * 자격증명이 필요해 브라우저에서 할 수 없으므로 이 라우트가 대신 읽고,
 * `ChannelEditModel` 로 «옮겨서» 내려준다.
 *
 * ── 🔴 상품번호를 «받지» 않는다 ──────────────────────────────────────────
 * 이 라우트는 `snapshotId` 만 받고, 어느 외부 상품을 읽을지는 서버가
 * `channel_products` 에서 «직접» 찾는다. 번호를 쿼리로 받아 그대로 읽으면
 * 로그인한 누구나 임의의 originProductNo 를 넣어 «남의 상품» 을 열 수 있고,
 * 그 화면에서 수정을 누르면 남의 상품이 고쳐진다. 이 프로젝트는 이미
 * 「번호가 두 개라 섞인」 사고를 겪었다(F-12b) — 번호는 우리가 정한다.
 *
 * ── 🔴 여기서 판단하지 않는다 ────────────────────────────────────────────
 * 무엇을 고칠 수 있는지(capability)도, UPDATE 인지 RECREATE 인지도 이 라우트가
 * 정하지 않는다. 읽어서 «옮기는» 일만 한다.
 */

/** 화면이 이 값으로 「무슨 말을 할지」 고른다. 🔴 실패를 성공으로 뭉개지 않는다. */
export type RegisteredProductReason =
  /** 이 상품은 아직 이 채널에 연결돼 있지 않다 — 오류가 아니다. */
  | "NOT_LINKED"
  | "NOT_CONFIGURED"
  | "AUTH_FAILED"
  /** 🔴 채널에서 읽지 «못했다». 「값이 없다」가 아니다. */
  | "FETCH_FAILED"
  | "INVALID_LINK";

export async function GET(request: NextRequest) {
  const snapshotId = request.nextUrl.searchParams.get("snapshotId");

  /* 🔴 등록 라우트 3개와 «같은 게이트» 다. 네이버 자격증명은 전역 싱글턴이라
     (commerce_accounts platform='naver' 첫 행) 다른 워크스페이스 셀러가 이
     라우트를 부르면 대표 계정의 상품을 읽게 된다 — 읽기도 막아야 한다. */
  const access = await requireRegistrationAccess(snapshotId);
  if (!access.ok) return access.response;

  /* 🔴 연결을 «우리가» 찾는다. 없으면 수정 화면을 열지 않는다 — 연결이 없는
     상품을 고치려 하면 어느 외부 상품에 나가는지 아무도 모른다. */
  const link = await findChannelProductBySnapshot(snapshotId, "smartstore");
  if (!link) {
    return NextResponse.json({
      ok: false,
      reason: "NOT_LINKED" satisfies RegisteredProductReason,
      message: "이 상품은 아직 스마트스토어에 등록된 것으로 연결돼 있지 않습니다.",
    });
  }

  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({
      ok: false,
      reason: "NOT_CONFIGURED" satisfies RegisteredProductReason,
      message: "네이버 인증 정보가 설정되어 있지 않아 현재 등록된 내용을 읽지 못했습니다.",
    });
  }
  const token = await issueNaverAccessToken(credentials);
  if (!token.ok) {
    return NextResponse.json({
      ok: false,
      reason: "AUTH_FAILED" satisfies RegisteredProductReason,
      message: token.message,
    });
  }

  const fetched = await fetchRegisteredProduct(token.accessToken, link.externalProductId);
  if (!fetched.ok) {
    /* 🔴 읽지 못한 것을 빈 기준값으로 내려보내지 않는다. 그러면 화면이 모든
       항목을 「지금 값 없음」으로 그리고, 셀러는 수정을 누르는 순간 전부
       사라진다고 읽는다 — 혹은 실제로 그렇게 보낸다. */
    return NextResponse.json({
      ok: false,
      reason: "FETCH_FAILED" satisfies RegisteredProductReason,
      message: fetched.message,
      externalProductId: link.externalProductId,
    });
  }

  /* 🔴 Sprint A — 채널 응답을 «중립 통화» 로 번역해 넘긴다. Core(ChannelEditModel)
     는 네이버 모양을 모르고, 그래서 쿠팡이 붙을 때 Core 를 고칠 일이 없다. */
  const built = buildChannelEditModel(
    { kind: "CHANNEL_GET", commerceId: "smartstore", externalProductId: link.externalProductId },
    smartStoreEditAdapter.readRegistered(fetched.snapshot),
  );
  if (!built.ok) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_LINK" satisfies RegisteredProductReason,
      message: built.message,
    });
  }

  /* 🔴 `model` 만 내려준다. 필드 목록은 화면이 `editorFieldSchema(model)` 로
     만든다 — 여기서 같이 내려보내면 같은 사실이 두 벌이 되고, 그 둘은 반드시
     갈라진다(F-14-2 「두 번째 진실을 만들지 않는다」). */
  return NextResponse.json({ ok: true, model: built.model, channelProductId: link.id });
}
