import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-06 §17 — 롯데ON 공통코드 목록(읽기 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 89 `getDetailCodeList` 는 그룹 이름 하나만 다르게 주면 여러 코드표를 돌려준다.
 * 이미 택배사(DV_CO_CD) · 배송가능지역(DV_RGSPR_GRP_CD) 을 그렇게 받고 있었고,
 * 고시 품목(PD_ITMS_CD) 40건도 같은 방식으로 확인됐다.
 *
 * ── 왜 생겼나 ──────────────────────────────────────────────────────────────
 * 롯데ON 첫 LIVE 등록이 이 한 줄로 거절됐다(2026-09-22, returnCode 9999):
 *
 *     "[원산지코드(oplcCd)] 가 유효하지 않습니다."
 *
 * 보낸 값을 보니 `"oplcCd": "OPLC_CD"` — **코드가 아니라 «코드그룹 이름»** 이
 * 들어가 있었다. 우리 코드 어디에도 그 문자열을 넣는 곳은 없다. 화면이
 * 「공통코드 OPLC_CD」라는 힌트를 달아 두고 셀러에게 번호를 «적게» 했고,
 * 셀러는 그 힌트를 답으로 읽었다.
 *
 * 🔴 셀러에게 코드를 외워 적게 하는 자리가 남아 있으면 반드시 이런 일이 난다.
 * 오늘 하루 같은 실패를 세 번 봤다(쿠팡 구매옵션 · 롯데ON 품목코드 · 이 건).
 * 고르게 하면 틀릴 수가 없다.
 *
 * ── 왜 «화이트리스트» 인가 ────────────────────────────────────────────────
 * 🔴 `grpCd` 를 그대로 흘려보내면 이 라우트가 롯데ON 공통코드 API 의 열린
 * 프록시가 된다. 우리가 실제로 쓰는 그룹만 통과시킨다 — 새 그룹이 필요하면
 * 그때 실제 응답을 확인하고 여기 «이름을 적어» 추가한다(오늘 PD_ITMS_CD 를
 * 그렇게 확인했다: 규칙이 아니라 실제 40건 응답을 보고 인정했다).
 */
const ALLOWED_GROUPS: Record<string, string> = {
  /** 고시 품목코드 — 실측 확인(2026-09-22): 40건. */
  PD_ITMS_CD: "고시 품목코드",
  /** 원산지코드 — 첫 LIVE 등록이 지목한 필드. */
  OPLC_CD: "원산지코드",
};

export async function GET(request: Request) {
  const group = new URL(request.url).searchParams.get("group") ?? "";
  const label = ALLOWED_GROUPS[group];
  if (!label) {
    return NextResponse.json(
      { ok: false, reason: "UNKNOWN_GROUP", message: `허용되지 않은 공통코드 그룹입니다: ${group}` },
      { status: 400 },
    );
  }

  const read = await runLotteOnRead({
    // host 를 주지 않으면 기본 호스트(openapi.lotteon.com) — 89 는 onpick 이 아니다.
    method: "GET",
    path: LOTTEON_READ_PATHS.detailCodeList,
    query: { grpCd: group },
    step: `89 공통코드 상세 조회(${label})`,
  });
  // 🔴 실패를 «목록 0건» 으로 바꿔 말하지 않는다 — 화면이 「고를 것이 없다」고
  //    하면 셀러는 값이 없는 줄 알지만 사실은 조회가 닿지 않은 것이다.
  if (!read.ok) return read.response;

  const rows = Array.isArray(read.result.data) ? (read.result.data as Record<string, unknown>[]) : [];
  const items = rows
    .map((row) => {
      const code = typeof row.cd === "string" ? row.cd.trim() : "";
      if (!code) return null;
      const name = typeof row.cdNm === "string" ? row.cdNm.trim() : "";
      // 🔴 값을 만들지 않는다. 롯데ON 이 준 cd 를 그대로 payload 로 보내고,
      //    셀러에게는 cdNm 만 보여준다. 매핑도 번역도 하지 않는다.
      return { code, name: name || code };
    })
    .filter((item): item is { code: string; name: string } => item != null);

  return NextResponse.json({ ok: true, readOnly: true, group, items });
}
