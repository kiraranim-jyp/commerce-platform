import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";

export const runtime = "nodejs";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 LOTTEON-PD-ARTL-02 — **조사 전용.** 88 공통코드 «그룹» 조회
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────────────────
 * 우리는 고시 «항목코드» 가 없다고 세 문서에 적어 왔다. 근거는 이 한 줄이었다 —
 *
 *     89 PD_ARTL_CD   ok:true · rowCount 0     → 「어휘가 없다」(CONFIRMED)
 *
 * 🔴 그런데 그 `PD_ARTL_CD` 라는 그룹 이름은 **우리가 지어낸 것**이다
 * (`payload-preview/route.ts` 의 `probeCodeGroup("PD_ARTL_CD")`). 문서 어디에도
 * 그 이름이 없다. 그러면 `rowCount 0` 은 둘을 «구분하지 못한다» —
 *
 *     ① 항목코드 어휘가 없다
 *     ② 그 «이름» 의 그룹이 없다 (이름만 다르고 어휘는 있다)
 *
 * 「없음은 실행으로 확인한다」고 해 놓고, 실행에 넣은 이름이 추측이었다.
 *
 * 88 은 요청 파라미터가 없다 — 지어낼 것이 없다. 전체 그룹 목록을 받아서
 * 「그런 그룹이 실재하는가, 실재한다면 정확한 이름은 무엇인가」를 가른다.
 * 그 답이 나온 뒤에야 89 를 «정확한 이름으로» 다시 부른다.
 *
 * ── 이 라우트가 «하지 않는» 것 (CPO 조건, 2026-09-28) ─────────────────────
 *   쓰기 없음        읽기 하나뿐이다. 등록·수정·삭제 경로를 부르지 않는다.
 *   파라미터 없음    쿼리를 읽지 않는다 — 열린 프록시가 될 여지를 남기지 않는다.
 *   저장 없음        응답을 DB 에 넣지 않는다. 화면에도 붙이지 않는다.
 *   키 노출 없음     API Key 는 서버에서만 쓰인다(`runLotteOnRead`).
 *   비인증 접근 없음 `requireUser()` — 세션과 workspace 를 확인한다.
 *
 * 🔴 `common-codes` 와 `delivery-settings` 는 앱 레벨 세션 검사가 «없다».
 * 이 라우트는 그 전철을 밟지 않는다(그 둘은 별도 보안 항목으로 남아 있다).
 *
 * 🔴 **조사용이 기능으로 몰래 남지 않는다.** 결과를 문서로 남긴 뒤 존치 여부는
 * CPO 가 정한다 — 전례대로다(`notice-article-probe` 는 조사 후 삭제됐다).
 */
export async function GET() {
  /* 🔴 인증이 먼저다. 실패하면 롯데ON 을 부르지 않는다 — 인증 실패자가
     우리 API Key 로 외부 호출을 «일으키게» 두지 않는다. */
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const read = await runLotteOnRead({
    /* host 를 주지 않으면 기본 호스트(openapi.lotteon.com) — 88 은 onpick 이 아니다. */
    method: "GET",
    path: LOTTEON_READ_PATHS.groupCodeList,
    step: "88 공통코드 그룹조회(조사 전용)",
  });
  /* 🔴 실패를 «0건» 으로 바꿔 말하지 않는다. 그 혼동이 바로 이 라우트를 만든
     이유다 — 조회가 닿지 않은 것과 값이 없는 것은 다르다. */
  if (!read.ok) return read.response;

  const rows = Array.isArray(read.result.data) ? (read.result.data as Record<string, unknown>[]) : [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const groups = rows
    .map((row) => {
      const code = text(row.grpCd);
      if (!code) return null;
      /* 설명(grpCdEpn)까지 본다 — 이름만으로는 「고시 항목」 그룹인지 가릴 수
         없다. 셀러 데이터가 아니라 롯데ON 의 코드 메타데이터다. */
      return { grpCd: code, grpCdNm: text(row.grpCdNm), grpCdEpn: text(row.grpCdEpn) };
    })
    .filter((row): row is { grpCd: string; grpCdNm: string; grpCdEpn: string } => row != null);

  return NextResponse.json({ ok: true, readOnly: true, probeOnly: true, count: groups.length, groups });
}
