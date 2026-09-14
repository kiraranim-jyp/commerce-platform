import { LOTTEON_READ_PATHS } from "./client";
import { runLotteOnRead } from "./request";

/**
 * LOTTEON COMMERCE SPRINT 2 — `207 Identity`로 거래처 정보를 얻는다.
 *
 * 롯데ON은 "인증키로 접속하면 상위 거래처 정보를 가지고 있으므로 따로 거래처
 * 정보를 파라미터에 넣지 않아도 됩니다"라고 하지만, **상품등록(87)과 상품목록
 * 조회(93)는 trGrpCd/trNo를 바디에 요구한다**(문서 원문 필수 O). 그 값이
 * 나오는 유일한 자리가 이 API다.
 *
 * 그래서 이 값을 DB에 저장하지 않는다 — 인증키 하나만 저장하고, 필요한 순간
 * 서버가 조회한다. 저장하면 키를 교체했을 때 조용히 옛 거래처로 등록된다.
 */
export interface LotteOnIdentity {
  trGrpCd: string;
  trDvsCd: string | null;
  trNo: string;
  trNm: string | null;
}

export async function fetchLotteOnIdentity(): Promise<
  { ok: true; identity: LotteOnIdentity } | { ok: false; message: string }
> {
  const read = await runLotteOnRead({ method: "GET", path: LOTTEON_READ_PATHS.identity });
  if (!read.ok) {
    // 라우트 응답 본문에서 사람이 읽을 메시지만 꺼낸다(자격증명은 없다).
    const body = (await read.response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: body?.message ?? "롯데ON 거래처 정보(Identity)를 조회하지 못했습니다." };
  }

  const data = read.result.data as Record<string, unknown> | null;
  const trGrpCd = typeof data?.trGrpCd === "string" ? data.trGrpCd : null;
  const trNo = typeof data?.trNo === "string" ? data.trNo : null;
  if (!trGrpCd || !trNo) {
    return {
      ok: false,
      message: "롯데ON Identity 응답에 거래처그룹코드/거래처번호가 없습니다 — 응답 형식이 문서와 다릅니다.",
    };
  }
  return {
    ok: true,
    identity: {
      trGrpCd,
      trNo,
      trDvsCd: typeof data?.trDvsCd === "string" ? data.trDvsCd : null,
      trNm: typeof data?.trNm === "string" ? data.trNm : null,
    },
  };
}
