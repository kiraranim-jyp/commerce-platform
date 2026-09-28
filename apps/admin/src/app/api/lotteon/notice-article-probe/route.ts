import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { fetchLotteOnIdentity } from "../_lib/identity";
import { runLotteOnRead } from "../_lib/request";

export const runtime = "nodejs";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 P1-D ③ **조사 전용** — 고시 «항목코드» 실물이 존재하는지 한 번 본다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────────────────
 * 롯데ON 은 고시 «항목코드» 목록을 주지 않는다 — 이미 실측으로 확정됐다(8eaba28).
 *
 *     89 PD_ARTL_CD        rowCount 0
 *     89 PD_ITMS_CD 참조칸  ref1 "SELECT" · 나머지 빈값
 *     205 pd_itms_list     항상 empty
 *
 * 남은 길은 하나다 — **이미 등록된 상품의 상세(94)** 에는 롯데ON 이 «직접»
 * 돌려주는 항목코드가 들어 있을 수 있다. 그러면 셀러가 숫자를 옮겨 적는 일이
 * 사라진다. 없으면 없는 것이고, 그 «없음» 자체가 결론이다.
 *
 * 🔴 CPO 가 «예외적으로» 허용한 조사용 라우트다(2026-09-28). 조사가 끝나면
 * 존치 여부를 CPO 가 정한다 — **조사용이 기능으로 몰래 남지 않는다.**
 *
 * ── 이 라우트가 «하지 않는» 것 ────────────────────────────────────────────
 *   쓰기 없음        등록·수정·삭제를 하지 않는다. 읽기 둘뿐이다.
 *   저장 없음        응답을 DB 에 넣지 않는다. 화면에도 붙이지 않는다.
 *   무제한 노출 없음  94 원본을 통째로 내보내지 않는다 — 고시 부분과
 *                    «키 이름» 만 돌려준다(값이 아니라 구조를 보려는 것이다).
 *   비인증 접근 없음  requireUser() 로 막는다.
 *
 * 🔴 `delivery-settings` 는 앱 레벨 세션 검사가 없어 Vercel 보호에만 기대고
 * 있다(별도 보안 후보로 기록됨). 이 라우트는 그 전철을 밟지 않는다.
 */

/** 고시 항목 한 줄. 이름이 확정되지 않아 후보 키를 전부 읽어 본다. */
function pickArticles(detail: Record<string, unknown>): { key: string; rows: unknown[] } | null {
  /* 🔴 키 이름을 «추측해서 하나만» 보지 않는다. 205 에서 `pd_itms_list` 와
     `pd_Itms_list` 가 갈렸던 전례가 있다(lotteon-category.ts:195). */
  for (const key of ["pdItmsArtlLst", "pd_itms_artl_lst", "pdItmsArtlList", "pdArtlLst"]) {
    const value = detail[key];
    if (Array.isArray(value)) return { key, rows: value };
  }
  return null;
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const identity = await fetchLotteOnIdentity();
  if (!identity.ok) {
    return NextResponse.json({ ok: false, step: identity.step, message: identity.message });
  }

  /* ── STEP 1 — 등록된 상품이 «하나라도» 있는가 (93) ───────────────────────
     🔴 이것부터다. 0건이면 94 를 불러도 볼 것이 없고, 그 0건이 결론이다.
     2026-09-22 의 첫 LIVE 등록은 거절됐고(returnCode 9999) 그 뒤 성공 기록이
     저장소에 없다 — 정말로 0건일 수 있다. */
  const now = new Date();
  const from = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const compact = (d: Date, end: boolean) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${end ? "235959" : "000000"}`;

  const list = await runLotteOnRead({
    step: "93 상품목록 조회",
    method: "POST",
    path: LOTTEON_READ_PATHS.productList,
    body: {
      trGrpCd: identity.identity.trGrpCd,
      trNo: identity.identity.trNo,
      regStrtDttm: compact(from, false),
      regEndDttm: compact(now, true),
      pageNo: 1,
      /* 조사다. 한 건이면 충분하다. */
      rowsPerPage: 1,
    },
  });
  if (!list.ok) return list.response;

  const rows = Array.isArray(list.result.data) ? (list.result.data as Record<string, unknown>[]) : [];
  const first = rows[0];
  const spdNo = typeof first?.spdNo === "string" ? first.spdNo : null;

  if (!spdNo) {
    /* 🔴 「없다」도 결론이다. 여기서 멈춘다 — 94 를 부르지 않는다. */
    return NextResponse.json({
      ok: true,
      readOnly: true,
      step: "93",
      registeredProductCount: 0,
      conclusion: "NO_REGISTERED_PRODUCT",
      note: "등록된 상품이 없어 고시 항목코드 실물을 확인할 수 없습니다. 이 사실 자체가 결론입니다.",
    });
  }

  /* ── STEP 2 — 그 한 건의 상세(94) ──────────────────────────────────────── */
  const detailRead = await runLotteOnRead({
    step: "94 상품상세 조회",
    method: "POST",
    path: LOTTEON_READ_PATHS.productDetail,
    body: { trGrpCd: identity.identity.trGrpCd, trNo: identity.identity.trNo, spdNo },
  });
  if (!detailRead.ok) return detailRead.response;

  const data = detailRead.result.data;
  const detail = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!detail || typeof detail !== "object") {
    return NextResponse.json({ ok: true, readOnly: true, step: "94", conclusion: "DETAIL_EMPTY" });
  }

  const articles = pickArticles(detail);

  return NextResponse.json({
    ok: true,
    readOnly: true,
    registeredProductCount: rows.length,
    /* 🔴 상품명·가격·주소 같은 판매자 데이터는 내보내지 않는다. 조사에 필요한
       것은 «고시 부분» 과 «구조» 뿐이다. */
    detailTopLevelKeys: Object.keys(detail).sort(),
    noticeItemCode: typeof detail.pdItmsCd === "string" ? detail.pdItmsCd : null,
    articlesKey: articles?.key ?? null,
    articleCount: articles?.rows.length ?? 0,
    /* 항목코드와 그 내용이 이 조사의 «전부» 다. */
    articles: articles?.rows ?? [],
    conclusion: articles ? (articles.rows.length > 0 ? "ARTICLES_FOUND" : "ARTICLES_EMPTY") : "ARTICLES_KEY_ABSENT",
  });
}
