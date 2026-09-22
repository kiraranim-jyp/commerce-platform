import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-05(CEO 확정, 2026-09-22) — 고시 품목코드 목록
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 롯데ON 등록을 막던 마지막 큰 블로커가 `pdItmsCd` 였다. 셀러가 번호를 어디선가
 * 찾아 적어야 했고, 그래서 아무도 등록할 수 없었다.
 *
 * ── 어디서 오는가(실측으로 확정) ───────────────────────────────────────────
 * 오래 찾았다. 205 표준카테고리가 줄 것 같았지만 아니었다.
 *
 *     205 목록 6,131건   pd_itms_list  present 6131 · empty 6131 · nonEmpty 0
 *     205 단건 조회      pd_itms_list  empty
 *     205 attr_list      12건이지만 키가 std_cat_id/prio_rnk/attr_pi_type/attr_id
 *                        — 상품 «속성» 이지 고시 «품목» 이 아니다
 *     89 PD_ITMS_CD      🎉 40건 · cd/cdNm                    ← 여기 있었다
 *
 * 89 getDetailCodeList 는 이미 택배사(DV_CO_CD)와 배송가능지역(DV_RGSPR_GRP_CD)을
 * 부르고 있던 경로다. 새 API 가 아니라 grpCd 하나만 다르다.
 *
 * 🔴 코드그룹 이름이 payload 필드명과 같다는 «규칙» 만으로 이 경로를 쓰기로
 * 정하지 않았다. 실제 응답이 40건을 돌려준 것을 audit_log 로 확인한 뒤에야
 * 공급원으로 인정했다(CEO 명시 조건).
 *
 * 🔴 값을 만들지 않는다. 롯데ON 이 준 `cd` 를 그대로 payload 로 보내고, 셀러에게는
 * `cdNm` 만 보여준다. 매핑도 번역도 하지 않는다.
 */
export async function GET() {
  const read = await runLotteOnRead({
    // host 를 주지 않으면 기본 호스트(openapi.lotteon.com) — 89 는 onpick 이 아니다.
    method: "GET",
    path: LOTTEON_READ_PATHS.detailCodeList,
    query: { grpCd: "PD_ITMS_CD" },
    step: "89 공통코드 상세 조회(고시 품목코드)",
  });
  // 🔴 실패를 «목록 0건» 으로 바꿔 말하지 않는다 — 화면이 「품목이 없습니다」라고
  //    하면 셀러는 고를 것이 없다고 읽고, 사실은 조회가 닿지 않은 것이다.
  if (!read.ok) return read.response;

  const rows = Array.isArray(read.result.data) ? (read.result.data as Record<string, unknown>[]) : [];
  const items = rows
    .map((row) => {
      const code = typeof row.cd === "string" ? row.cd.trim() : "";
      if (!code) return null;
      const name = typeof row.cdNm === "string" ? row.cdNm.trim() : "";
      return { code, name: name || code };
    })
    .filter((item): item is { code: string; name: string } => item != null);

  return NextResponse.json({ ok: true, readOnly: true, items });
}
