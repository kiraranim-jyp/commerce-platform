import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead, toSearchRange } from "../_lib/request";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 클레임 **조회 전용** 라우트.
 *
 *  취소  50  POST …/cancellationOpenApi/getCancellationRequestAndComplateList
 *  반품  51  POST …/returningOpenApi/returnRequestSearch
 *  교환  69  POST …/exchangeOpenApi/exchangeSearch
 *
 * 🔴 승인/거부(52·53·59·60·71·72·225·64)는 **구현하지 않는다.** 실제 고객
 * 주문을 되돌릴 수 없게 바꾸고, 테스트 주문을 만들 수단이 없다(조사 §6-3
 * STOP-F). 경로 자체가 금지 목록에 있어 클라이언트가 차단한다.
 *
 * 🔴 "환불 처리"는 만들지 않는다. 롯데ON에는 **독립 환불 API가 없다** — 환불은
 * 취소/반품 승인의 부수 효과이고 금액 확인은 정산 모듈로 한다(조사 §5-2).
 * 버튼을 만들면 그건 없는 기능이다.
 *
 * 세 API 모두 요청 파라미터가 같은 모양이다(srchStrtDttm/srchEndDttm 필수,
 * odNo 선택) — 문서 원문 기준. 응답도 `data[]` 안에 odNo/cmNo/itemList[] 구조로
 * 같다. 그래서 라우트를 셋으로 쪼개지 않고 type만 받는다.
 */
export type LotteOnClaimType = "CANCEL" | "RETURN" | "EXCHANGE";

const CLAIM_PATH: Record<LotteOnClaimType, string> = {
  CANCEL: LOTTEON_READ_PATHS.cancellationSearch,
  RETURN: LOTTEON_READ_PATHS.returnSearch,
  EXCHANGE: LOTTEON_READ_PATHS.exchangeSearch,
};

export const LOTTEON_CLAIM_LABEL: Record<LotteOnClaimType, string> = {
  CANCEL: "취소",
  RETURN: "반품",
  EXCHANGE: "교환",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    type?: LotteOnClaimType;
    /** "YYYY-MM-DD" */
    date?: string;
    orderNo?: string;
  } | null;

  const type = body?.type;
  if (!type || !(type in CLAIM_PATH)) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_REQUEST",
      message: "조회할 클레임 유형(CANCEL / RETURN / EXCHANGE)이 필요합니다.",
    });
  }

  const range = body?.date ? toSearchRange(body.date) : null;
  if (!range) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_REQUEST",
      // 세 API 모두 검색시작/종료일자가 **필수**다(문서 원문 O 표시).
      message: "조회할 날짜(YYYY-MM-DD)가 필요합니다 — 롯데ON 클레임 조회는 검색 기간이 필수입니다.",
    });
  }

  const read = await runLotteOnRead({
    method: "POST",
    path: CLAIM_PATH[type],
    body: {
      srchStrtDttm: range.start,
      srchEndDttm: range.end,
      odNo: body?.orderNo?.trim() ?? "",
    },
  });
  if (!read.ok) return read.response;

  // 세 API 모두 data가 배열이다(문서의 Response Sample 기준). 다른 모양이
  // 오면 지어내지 않고 빈 배열 + raw를 같이 내려 화면이 진단할 수 있게 한다.
  const claims = Array.isArray(read.result.data) ? (read.result.data as unknown[]) : [];

  return NextResponse.json({
    ok: true,
    readOnly: true,
    type,
    label: LOTTEON_CLAIM_LABEL[type],
    claims,
    dataCount: read.result.dataCount ?? claims.length,
    returnCode: read.result.returnCode,
    ...(Array.isArray(read.result.data) ? {} : { raw: read.result.data }),
  });
}
