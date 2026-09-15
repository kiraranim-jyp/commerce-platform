import { NextResponse } from "next/server";
import type { CanonicalProduct } from "@commerce/shared";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";
import {
  parseLotteOnStandardCategory,
  recommendLotteOnStandardCategories,
  type LotteOnStandardCategory,
} from "../../../pipeline/commerce/lotteon-category";

/**
 * LOTTEON COMMERCE SPRINT 4(CEO 확정, 2026-09-14) — 롯데ON 카테고리 **추천**.
 *
 * ── 조회와 다른 점 ─────────────────────────────────────────────────────────
 * /api/lotteon/categories 는 셀러가 트리를 뒤지는 **조회**다. 이 라우트는
 * 상품을 보고 시스템이 후보를 제시하는 **추천**이다(CEO 확정 요건).
 *
 * ── 쿠팡과 왜 모양이 다른가 ───────────────────────────────────────────────
 * 쿠팡에는 predict API가 있어서 질의문을 던지면 후보를 돌려준다. 롯데ON
 * onpick 205에는 **이름으로 검색하는 파라미터가 없다**(문서 원문 Request
 * Parameters: job/skip/limit/filter_1=std_cat_id/filter_2=상위/filter_3=depth_no/
 * 수정일 범위/정렬뿐이다). 그래서 후보를 "질의"로 좁힐 수 없고 목록을 받아와서
 * 점수를 매기는 수밖에 없다.
 *
 * 점수 자체는 쿠팡과 **완전히 같은 함수**(scoreCategoryCandidate)를 쓴다 —
 * 채널마다 다른 추천 기준을 만들지 않는다.
 *
 * ── 페이지를 무한히 넘기지 않는다 ─────────────────────────────────────────
 * 표준카테고리 트리의 실제 크기를 확인하지 못했다(조사 §12-3-4). 상한 없이
 * 돌면 한 번의 화면 조작이 롯데ON에 수백 번 요청하는 일이 생긴다. 상한을 두고,
 * **상한에 걸렸다는 사실을 응답에 실어 보낸다** — 조용히 잘라내고 "이게
 * 전부"라고 말하지 않는다.
 */
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { product?: CanonicalProduct } | null;
  if (!body?.product) {
    return NextResponse.json({ ok: false, reason: "INVALID_REQUEST", message: "product가 필요합니다." }, { status: 400 });
  }

  const categories: LotteOnStandardCategory[] = [];
  let unrecognizedCount = 0;
  let truncated = false;
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const read = await runLotteOnRead({
      host: "onpick",
      method: "GET",
      path: LOTTEON_READ_PATHS.onpickCheetah,
      query: { job: "cheetahStandardCategory", skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) },
      envelope: "RAW",
      step: `205 표준카테고리 조회(${page + 1}번째 페이지)`,
    });
    // 첫 페이지가 실패하면 그 실패를 그대로 화면에 보여준다(인증키 없음/401/403
    // 을 "추천 결과 없음"으로 바꾸지 않는다 — 원인이 사라지면 셀러는 영원히
    // 고칠 수 없다).
    if (!read.ok) {
      if (page === 0) return read.response;
      truncated = true;
      break;
    }

    const raw = read.result.raw as { itemList?: unknown } | null;
    const itemList = Array.isArray(raw?.itemList) ? (raw.itemList as Record<string, unknown>[]) : [];
    pages += 1;
    for (const entry of itemList) {
      const parsed = parseLotteOnStandardCategory(entry.data ?? entry);
      if (parsed) categories.push(parsed);
      else unrecognizedCount += 1;
    }
    if (itemList.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const recommendation = recommendLotteOnStandardCategories(body.product, categories, { unrecognizedCount });

  return NextResponse.json({
    ok: true,
    readOnly: true,
    ...recommendation,
    /** 표준카테고리를 몇 건 읽었는지 · 상한에 걸렸는지. 화면이 "이게 전부"라고
     * 말해도 되는지 판단하는 근거다. */
    totalCategoryCount: categories.length,
    pagesFetched: pages,
    truncated,
  });
}
