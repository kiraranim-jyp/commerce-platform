import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../../lotteon/_lib/client";
import { fetchLotteOnIdentity } from "../../lotteon/_lib/identity";
import { runLotteOnRead, formatLotteOnDateTime } from "../../lotteon/_lib/request";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMERCE-LIFECYCLE-FINAL-03 ②(CPO 지시, 2026-09-29)
 * **롯데ON 기등록 상품을 «읽기만» 하는 조사 통로.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 롯데ON UPDATE 계약을 열려면 「기등록 상품이 실제로 무엇을 돌려주는가」를 먼저
 * 봐야 한다. 지금 상태 —
 *
 *     93 상품목록 조회  구현돼 있다(`/api/lotteon/product-status`)
 *     94 상품상세 조회  상수만 있고 «호출부 0». 요청 파라미터도 응답 모양도 기록 없음
 *
 * ── 🔴 왜 또 만드는가 — product-status 가 이미 93 을 부르는데 ────────────────
 * 그 라우트는 «Seller 세션» 뒤에 있고 CTO 에게는 그 세션이 없다. 그리고 94 는
 * 아예 부르지 않는다. `coupang-product-get-raw` · `naver-product-get-raw` 를
 * 만든 이유와 같은 자리다.
 *
 * 🔴 그 라우트를 고치거나 대체하지 «않는다». 등록 직후 승인 상태를 보는 용도로
 * 살아 있고 역할이 다르다.
 *
 * ── 🔴 하는 일과 하지 않는 일 ──────────────────────────────────────────────
 *   한다:    93 목록 → 94 상세. 응답을 «가공하지 않고» 그대로 싣는다.
 *   안 한다: 87 등록 · 92/111 상태변경 · 어떤 쓰기도 «한 줄도» 없다.
 *            CPO 금지 그대로 — 외부 상품을 새로 만들어 시험하지 않는다.
 *   안 한다: 「이 칸이 저 뜻일 것이다」라는 해석. 판정은 응답을 본 뒤 사람이 한다.
 *
 * 🔴 `DEBUG_LOTTEON_READ_PROBE_TOKEN` 이 없으면 «존재하지 않는 것처럼» 404 로
 * 닫는다. 토큰을 코드에 적지 않는다.
 *
 * 🔴 이 파일은 «일회용» 이다. 실측이 끝나면 토큰 폐기 → 파일 삭제 → 재배포까지가
 * 한 세트다(CLAUDE.md §10).
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_LOTTEON_READ_PROBE_TOKEN;
  /* 🔴 설정이 없으면 열지 않는다 — 「설정이 없으니 일단 통과」는 이 저장소가
     이미 한 번 고친 실수다(requireRegistrationAccess 의 fail-closed). */
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  /** 지정하면 그 상품만 94 로 본다. 없으면 93 목록의 첫 건을 쓴다. */
  const requestedSpdNo = searchParams.get("spdNo");
  const days = Math.min(Number(searchParams.get("days") ?? "60") || 60, 180);

  const identity = await fetchLotteOnIdentity();
  if (!identity.ok) {
    return NextResponse.json({ ok: false, step: "207 identity", message: identity.message }, { status: 200 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  /* ── 93 상품목록 ─────────────────────────────────────────────────────── */
  const list = await runLotteOnRead({
    step: "93 상품목록 조회(조사)",
    method: "POST",
    path: LOTTEON_READ_PATHS.productList,
    body: {
      trGrpCd: identity.identity.trGrpCd,
      trNo: identity.identity.trNo,
      regStrtDttm: formatLotteOnDateTime(from),
      regEndDttm: formatLotteOnDateTime(now),
      pageNo: 1,
      rowsPerPage: 20,
    },
  });
  if (!list.ok) return list.response;

  const rows = Array.isArray(list.result.data) ? (list.result.data as Record<string, unknown>[]) : [];
  const spdNo = requestedSpdNo ?? (typeof rows[0]?.spdNo === "string" ? (rows[0].spdNo as string) : null);

  /* ── 94 상품상세 — 🔴 요청 모양이 «기록에 없다». 문서에 적힌 키만 넣고,
        실패하면 그 실패 원문을 그대로 돌려준다(지어낸 파라미터를 더하지 않는다). */
  const detail = spdNo
    ? await runLotteOnRead({
        step: "94 상품상세 조회(조사)",
        method: "POST",
        path: LOTTEON_READ_PATHS.productDetail,
        body: { trGrpCd: identity.identity.trGrpCd, trNo: identity.identity.trNo, spdNo },
      })
    : null;

  return NextResponse.json(
    {
      ok: true,
      probedAt: now.toISOString(),
      list: {
        path: LOTTEON_READ_PATHS.productList,
        count: rows.length,
        /* 🔴 목록은 «키만» 본다. 상세가 본 조사 대상이고, 목록 전문을 실으면
           응답이 길어져 무엇을 봐야 하는지 흐려진다. */
        firstRowKeys: rows[0] ? Object.keys(rows[0]).sort() : [],
        spdNos: rows.map((row) => (typeof row.spdNo === "string" ? row.spdNo : null)),
      },
      detail: detail
        ? {
            path: LOTTEON_READ_PATHS.productDetail,
            spdNo,
            /* 🔴 상세는 «전문» 을 그대로 싣는다 — 어떤 칸이 오는지가 조사의 전부다. */
            raw: detail.ok ? detail.result : "READ_FAILED",
          }
        : { skipped: "spdNo 를 찾지 못했다(93 목록이 비었다)" },
    },
    { status: 200 },
  );
}
