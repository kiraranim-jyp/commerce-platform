import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { fetchLotteOnIdentity } from "../_lib/identity";
import { runLotteOnRead, formatLotteOnDateTime } from "../_lib/request";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 등록 상품 **상태 조회**(읽기 전용).
 *
 * `93 상품 목록 조회` POST /v1/openapi/product/v1/product/list
 *
 * 쿠팡 `/api/coupang/product-status`(등록한 sellerProductId의 검수/승인 상태
 * 조회)와 같은 자리다. 롯데ON은 승인이 **2단계**다 — 카테고리 승인
 * (catAprvStatCd)과 상품정보 승인(pdInfoAprvStatCd)이 **둘 다** 완료되어야
 * 최종승인(fnlAprvYn='Y')이 되고 고객 화면에 노출된다. 한쪽만 보면 "등록은
 * 됐는데 왜 안 보이지"가 된다.
 *
 * 상태 변경(92/111)은 구현하지 않는다 — 이번 스프린트의 허용된 쓰기는
 * 상품등록(87) 하나뿐이다.
 *
 * ⚠️ 이 API는 등록일 조회 기간(regStrtDttm/regEndDttm)이 **필수**다.
 */
export const LOTTEON_SALE_STATUS_LABEL: Record<string, string> = {
  SALE: "판매중",
  SOUT: "품절",
  STP: "판매중지",
  END: "판매종료",
};

export const LOTTEON_APPROVAL_STATUS_LABEL: Record<string, string> = {
  APRV_WT: "승인대기",
  APRV_CMPT: "승인완료",
  GVBK: "반려",
  ADMR_TCTL: "관리자이관",
  NONE: "해당없음",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    /** "YYYY-MM-DD" — 등록일 조회 시작/종료. 생략 시 최근 30일. */
    fromDate?: string;
    toDate?: string;
    /** 업체상품번호(우리가 등록할 때 보낸 epdNo) 최대 100개. */
    externalProductNos?: string[];
    pageNo?: number;
    rowsPerPage?: number;
  } | null;

  const identity = await fetchLotteOnIdentity();
  if (!identity.ok) {
    return NextResponse.json({ ok: false, reason: "IDENTITY_FAILED", message: identity.message });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toCompact = (value: string | undefined, fallback: Date, endOfDay: boolean) => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value.replace(/-/g, "")}${endOfDay ? "235959" : "000000"}`;
    }
    return formatLotteOnDateTime(fallback);
  };

  const read = await runLotteOnRead({
    method: "POST",
    path: LOTTEON_READ_PATHS.productList,
    body: {
      trGrpCd: identity.identity.trGrpCd,
      trNo: identity.identity.trNo,
      regStrtDttm: toCompact(body?.fromDate, defaultFrom, false),
      regEndDttm: toCompact(body?.toDate, now, true),
      // 문서 원문: 최대 100개.
      ...(body?.externalProductNos?.length ? { epdNo: body.externalProductNos.slice(0, 100) } : {}),
      pageNo: body?.pageNo ?? 1,
      rowsPerPage: Math.min(body?.rowsPerPage ?? 50, 100),
    },
  });
  if (!read.ok) return read.response;

  const rows = Array.isArray(read.result.data) ? (read.result.data as Record<string, unknown>[]) : [];
  const products = rows.map((row) => ({
    spdNo: typeof row.spdNo === "string" ? row.spdNo : null,
    epdNo: typeof row.epdNo === "string" ? row.epdNo : null,
    spdNm: typeof row.spdNm === "string" ? row.spdNm : null,
    scatNo: typeof row.scatNo === "string" ? row.scatNo : null,
    slStatCd: typeof row.slStatCd === "string" ? row.slStatCd : null,
    slStatRsnCd: typeof row.slStatRsnCd === "string" ? row.slStatRsnCd : null,
    // 2단계 승인 — 둘 다 봐야 한다.
    catAprvStatCd: typeof row.catAprvStatCd === "string" ? row.catAprvStatCd : null,
    catGvbkRsnCnts: typeof row.catGvbkRsnCnts === "string" ? row.catGvbkRsnCnts : null,
    pdInfoAprvStatCd: typeof row.pdInfoAprvStatCd === "string" ? row.pdInfoAprvStatCd : null,
    pdInfoGvbkRsnCnts: typeof row.pdInfoGvbkRsnCnts === "string" ? row.pdInfoGvbkRsnCnts : null,
    fnlAprvYn: typeof row.fnlAprvYn === "string" ? row.fnlAprvYn : null,
    regDttm: typeof row.regDttm === "string" ? row.regDttm : null,
    /** 단품 목록 — 등록 응답(87)에는 단품번호가 없고 여기서만 얻을 수 있다. */
    sitmNoLst: Array.isArray(row.sitmNoLst) ? row.sitmNoLst : [],
  }));

  return NextResponse.json({
    ok: true,
    readOnly: true,
    identity: identity.identity,
    products,
    dataCount: read.result.dataCount ?? products.length,
    returnCode: read.result.returnCode,
  });
}
