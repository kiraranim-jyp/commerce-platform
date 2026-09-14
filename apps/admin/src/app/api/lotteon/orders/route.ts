import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead, toSearchRange } from "../_lib/request";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 주문 **조회 전용** 라우트.
 *
 * `209 출고/회수지시(주문정보) 조회`
 *   POST /v1/openapi/delivery/v1/SellerDeliveryOrdersSearch
 *
 * 🔴 이 라우트는 조회만 한다. 롯데ON 문서가 "데이터 수신 후 연동완료 통보를
 * 필히 수행"이라고 권하지만, `210 SellerIfCompleteInform`은 호출 즉시 주문을
 * 상품준비중으로 **되돌릴 수 없게** 전이시킨다. 이번 스프린트에서 210은
 * 구현 대상이 아니며, `_lib/forbidden-endpoints.ts`의 guard가 호출 시도 자체를
 * 차단한다(테스트로 고정: `__tests__/forbidden-endpoints.test.ts`).
 *
 * 그래서 이 화면은 **읽기 전용**이고, 실제 주문 처리는 롯데ON 판매자센터에서
 * 해야 한다. 여기에 처리 버튼을 붙이지 마라.
 *
 * 조회 제약(문서 원문 returnCode 2003): **조회기간은 1일을 초과할 수 없다.**
 * 그래서 이 라우트는 "날짜 하루"만 받는다 — 범위를 넓게 받아 서버에서 잘라
 * 여러 번 부르는 식으로 숨기지 않는다(호출 수가 조용히 늘어나면 429가 난다).
 */
export interface LotteOnOrderRow {
  odNo: string | null;
  clmNo: string | null;
  odTypCd: string | null;
  odPrgsStepCd: string | null;
  dvRtrvDvsCd: string | null;
  odCmptDttm: string | null;
  spdNm: string | null;
  sitmNm: string | null;
  epdNo: string | null;
  odrNm: string | null;
  odQty: number | null;
  slAmt: number | null;
  actualAmt: number | null;
  dvpCustNm: string | null;
}

/** 문서 원문 코드표 — 화면이 코드 숫자를 그대로 보여주지 않게 한다. */
export const LOTTEON_ORDER_PROGRESS_LABEL: Record<string, string> = {
  "11": "출고지시",
  "23": "회수지시",
};

export const LOTTEON_ORDER_TYPE_LABEL: Record<string, string> = {
  "10": "주문",
  "20": "취소(주문취소)",
  "30": "교환",
  "31": "교환취소",
  "40": "반품",
  "41": "반품취소",
  "50": "AS",
};

export const LOTTEON_DELIVERY_DIVISION_LABEL: Record<string, string> = {
  DV: "배송",
  RTRV: "회수",
};

function pickString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function pickNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    /** "YYYY-MM-DD" — 하루 단위(문서 제약: 조회기간 1일 초과 불가). */
    date?: string;
    /** 주문번호 단건 조회. 있으면 날짜보다 우선한다(문서: 둘 중 하나 필수). */
    orderNo?: string;
    /** 신규(연동 미완료)만 볼지. 값이 없으면 신규생성 주문이 조회된다. */
    onlyNew?: boolean;
    /** 11 출고지시 / 23 회수지시. */
    progressStepCode?: string;
  } | null;

  const orderNo = body?.orderNo?.trim();
  const range = body?.date ? toSearchRange(body.date) : null;

  if (!orderNo && !range) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_REQUEST",
      message: "조회할 날짜(YYYY-MM-DD) 또는 주문번호가 필요합니다. 롯데ON은 조회기간이 1일을 초과할 수 없습니다.",
    });
  }

  const read = await runLotteOnRead({
    method: "POST",
    path: LOTTEON_READ_PATHS.ordersSearch,
    body: {
      srchStrtDt: range?.start ?? "",
      srchEndDt: range?.end ?? "",
      odNo: orderNo ?? "",
      odPrgsStepCd: body?.progressStepCode ?? "",
      odTypCd: "",
      // 문서 원문: 값이 없으면 신규생성 주문이 조회된다. 'N'은 연동 미완료(=신규).
      ifCplYN: body?.onlyNew ? "N" : "",
    },
  });
  if (!read.ok) return read.response;

  const data = read.result.data as { deliveryOrderList?: unknown } | null;
  const rawList = Array.isArray(data?.deliveryOrderList) ? (data.deliveryOrderList as Record<string, unknown>[]) : [];

  const orders: LotteOnOrderRow[] = rawList.map((row) => ({
    odNo: pickString(row, "odNo"),
    clmNo: pickString(row, "clmNo"),
    odTypCd: pickString(row, "odTypCd"),
    odPrgsStepCd: pickString(row, "odPrgsStepCd"),
    dvRtrvDvsCd: pickString(row, "dvRtrvDvsCd"),
    odCmptDttm: pickString(row, "odCmptDttm"),
    spdNm: pickString(row, "spdNm"),
    sitmNm: pickString(row, "sitmNm"),
    epdNo: pickString(row, "epdNo"),
    odrNm: pickString(row, "odrNm"),
    odQty: pickNumber(row, "odQty"),
    slAmt: pickNumber(row, "slAmt"),
    actualAmt: pickNumber(row, "actualAmt"),
    dvpCustNm: pickString(row, "dvpCustNm"),
  }));

  return NextResponse.json({
    ok: true,
    readOnly: true,
    orders,
    dataCount: read.result.dataCount ?? orders.length,
    returnCode: read.result.returnCode,
  });
}
