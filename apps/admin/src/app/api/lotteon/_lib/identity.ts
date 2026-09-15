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

/** 이 호출의 이름. 실패 메시지·로그·화면이 전부 같은 글자를 쓴다. */
export const LOTTEON_IDENTITY_STEP = "207 identity(거래처 조회)";

export async function fetchLotteOnIdentity(): Promise<
  | { ok: true; identity: LotteOnIdentity }
  | { ok: false; message: string; step: string; elapsedMs: number | null; proxyProvider: string | null }
> {
  const read = await runLotteOnRead({
    method: "GET",
    path: LOTTEON_READ_PATHS.identity,
    step: LOTTEON_IDENTITY_STEP,
  });
  if (!read.ok) {
    /* 라우트 응답 본문에서 사람이 읽을 값만 꺼낸다(자격증명은 애초에 없다).
       🔴 LOTTEON-TIMEOUT-1 — 여기서 `message`만 꺼내던 것이 CEO 화면의
       "제한 시간 안에 오지 않았습니다" 한 줄이었다. 그 한 줄로는 5회 직렬 중
       **어디서** 끊겼는지 알 수 없었다. 단계·소요시간·아웃바운드 홉을 같이
       올려보낸다. */
    const body = (await read.response.json().catch(() => null)) as
      | { message?: string; elapsedMs?: number; proxyProvider?: string }
      | null;
    return {
      ok: false,
      message: body?.message ?? "롯데ON 거래처 정보(Identity)를 조회하지 못했습니다.",
      step: LOTTEON_IDENTITY_STEP,
      elapsedMs: typeof body?.elapsedMs === "number" ? body.elapsedMs : null,
      proxyProvider: typeof body?.proxyProvider === "string" ? body.proxyProvider : null,
    };
  }

  const data = read.result.data as Record<string, unknown> | null;
  const trGrpCd = typeof data?.trGrpCd === "string" ? data.trGrpCd : null;
  const trNo = typeof data?.trNo === "string" ? data.trNo : null;
  if (!trGrpCd || !trNo) {
    return {
      ok: false,
      message: "롯데ON Identity 응답에 거래처그룹코드/거래처번호가 없습니다 — 응답 형식이 문서와 다릅니다.",
      step: LOTTEON_IDENTITY_STEP,
      elapsedMs: null,
      proxyProvider: null,
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
