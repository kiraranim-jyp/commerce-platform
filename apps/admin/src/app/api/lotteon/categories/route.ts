import { NextResponse } from "next/server";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 카테고리 **조회 전용** 라우트.
 *
 *  205 표준카테고리  GET onpick-api…/cheetah/econCheetah.ecn?job=cheetahStandardCategory
 *  206 전시카테고리  GET onpick-api…/cheetah/econCheetah.ecn?job=cheetahDisplayCategory
 *  203 속성          …?job=cheetahAttr
 *  204 브랜드        …?job=cheetahBrnd
 *
 * ✅ 인증 요구 여부 — **확인했다(조사 §11-2 미해결 항목 해소).**
 * 2026-09-14 무자격 probe 실측:
 *   Authorization 없음        → HTTP 401
 *   잘못된 Bearer 키          → HTTP 401
 * 즉 공개 엔드포인트가 아니라 openapi.lotteon.com과 **같은 인증키**를 요구한다.
 * (문서의 Status Message 표에도 401 "등록되지 않은 OpenAPI Key" 항목이 있다.)
 *
 * ⚠️ 응답 규약이 다르다. onpick-api는 `{returnCode, message, data}` 봉투를
 * 쓰지 않고 `{ itemList: [{ data: {...}, ... }] }` 형태다(문서 Response
 * Sample). 그래서 envelope: "RAW"로 호출해 returnCode 게이트를 끈다.
 *
 * 🔴 롯데ON은 **표준카테고리 + 전시카테고리 2중 구조**다. 표준카테고리 응답의
 * `disp_list`가 그 표준카테고리에 매핑된 전시카테고리를 알려주고, 상품등록(87)의
 * `dcatLst`에는 그중 1개 이상을 넣어야 한다. `pd_Itms_list`는 그 카테고리의
 * 상품품목코드(고시)를 알려준다 — 유아동(23) 여부가 여기서 드러난다.
 */
export type LotteOnCheetahJob = "cheetahStandardCategory" | "cheetahDisplayCategory" | "cheetahAttr" | "cheetahBrnd";

const ALLOWED_JOBS: LotteOnCheetahJob[] = [
  "cheetahStandardCategory",
  "cheetahDisplayCategory",
  "cheetahAttr",
  "cheetahBrnd",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const job = (url.searchParams.get("job") ?? "cheetahStandardCategory") as LotteOnCheetahJob;
  if (!ALLOWED_JOBS.includes(job)) {
    return NextResponse.json({
      ok: false,
      reason: "INVALID_REQUEST",
      message: `지원하지 않는 조회 유형입니다(job=${job}).`,
    });
  }

  // 문서 원문 파라미터만 통과시킨다 — 임의 파라미터를 그대로 전달하지 않는다.
  const query: Record<string, string> = { job };
  for (const key of ["skip", "limit", "filter_1", "filter_2", "filter_3", "mf_1", "sort", "direction"]) {
    const value = url.searchParams.get(key);
    if (value) query[key] = value;
  }
  // 기본값 — 문서 기본은 limit 100이고, 전체 트리를 한 번에 끌어오지 않는다.
  if (!query.limit) query.limit = "100";

  const read = await runLotteOnRead({
    host: "onpick",
    method: "GET",
    path: LOTTEON_READ_PATHS.onpickCheetah,
    query,
    envelope: "RAW",
  });
  if (!read.ok) return read.response;

  const raw = read.result.raw as { itemList?: unknown } | null;
  const itemList = Array.isArray(raw?.itemList) ? (raw.itemList as Record<string, unknown>[]) : [];
  // 실제 값은 각 원소의 `data` 안에 있다(문서 Response Sample). 래퍼 필드
  // (filter_1/sort_1/key 등)는 조회용 인덱스라 화면에 내보내지 않는다.
  const items = itemList.map((entry) => entry.data ?? entry);

  return NextResponse.json({
    ok: true,
    readOnly: true,
    job,
    items,
    count: items.length,
  });
}
