import { NextResponse } from "next/server";
import type { CommerceCategoryTreeNode } from "@commerce/shared";
import { LOTTEON_READ_PATHS } from "../_lib/client";
import { runLotteOnRead } from "../_lib/request";
import {
  parseLotteOnStandardCategory,
  type LotteOnStandardCategory,
} from "../../../pipeline/commerce/lotteon-category";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-5b-③ — 롯데ON 카테고리 «직접 선택» 트리 (CPO 승인, 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 오추천(「가방/지갑 > 남성가방 53점」) 대응의 마지막 조각이다. 추천이
 * 틀렸을 때 셀러가 **트리를 펼쳐 직접 고르는** 경로를 쿠팡·스마트스토어와 같은
 * 컴포넌트(CategoryTreeBrowser)로 준다.
 *
 * ── 🔴 이것은 debug/우회 라우트가 «아니다» ─────────────────────────────────
 * `/api/naver/category-tree` · `/api/coupang/category-tree` 와 **같은 종류의 읽기
 * 전용 라우트**다. `/api/*` 프록시 뒤에 그대로 있고 인증 예외를 받지 않는다
 * (`/api/debug` 처럼 matcher 에서 빠지지 않는다).
 *
 * ── 왜 서버에서 변환하는가 ─────────────────────────────────────────────────
 * 205 는 페이징 응답이다(문서 기본 limit 100). 클라이언트가 수십 번 fetch 하게
 * 만들지 않는다 — 네이버 라우트와 같은 모양으로 **서버가 페이징하고 공통
 * `CommerceCategoryTreeNode` 로 변환해서** 한 번에 내려준다. 그래서 클라이언트
 * 어댑터는 네이버처럼 «통과만» 한다.
 *
 * ── 🔴 지어내지 않는다 ────────────────────────────────────────────────────
 * 응답 파싱은 기존 `parseLotteOnStandardCategory()` 를 **그대로 재사용** 한다.
 * 그 함수의 필드명은 롯데ON 공개 가이드 원문에서 옮긴 것이고, 필수 필드가 없으면
 * `null` 을 돌려준다 — 새 파서를 만들지 않았고 필드명을 추측하지 않았다.
 *
 * 🔴 **그 파서는 Production 실제 응답을 받은 적이 없다**(`lotteon-category.ts` 가
 * 스스로 적어 둔 사실이다 — 인증키 있는 세션에서 한 번도 호출되지 않았다).
 * 이 라우트는 그 등급을 그대로 물려받는다: `Implemented / Not Production Verified`.
 * 그래서 **파싱이 0건이면 성공으로 내려보내지 않는다**(아래 PARSE_EMPTY) —
 * 잘못된 빈 트리를 「OK」로 포장하면 셀러는 「카테고리가 없다」로 읽는다.
 */
export const runtime = "nodejs";

/** 추천기(category-recommend)와 «같은» 값. 두 곳이 다른 페이지 크기를 쓰면
 *  「추천에는 보이는데 트리에는 없는」 카테고리가 생긴다. */
const PAGE_SIZE = 500;
const MAX_PAGES = 40;
/** 트리 깊이 상한 — 순환 참조 방어용이다. 🔴 페이지 수(MAX_PAGES)와 «다른 뜻»
 *  이므로 따로 둔다(처음에 MAX_PAGES 를 깊이로 썼는데 의미가 다르다). 205 의
 *  depth_no 는 문서상 한 자리이고, 10 은 그보다 넉넉하다. */
const MAX_TREE_DEPTH = 10;

/** 트리 루트 — 실제 카테고리가 아니라 담는 그릇이다(쿠팡/네이버도 루트가 있다). */
const ROOT_ID = "LOTTEON_ROOT";

/**
 * 평면 목록 → 중첩 트리. `parentId` 가 유일한 근거다.
 *
 * 🔴 `usable === false` 는 제외한다 — 쿠팡 어댑터가 `status === "DISABLED"` 를
 * 빼는 것과 같은 원칙이다(셀러가 고를 수 없는 것을 고르게 하지 않는다).
 * 🔴 부모가 제외됐으면 그 자식도 트리에 서지 못한다 — 고아를 루트로 끌어올리지
 * 않는다. 끌어올리면 「최상위에 느닷없이 리프가 있는」 트리가 된다.
 */
export function buildLotteOnCategoryTree(categories: LotteOnStandardCategory[]): CommerceCategoryTreeNode {
  const usable = categories.filter((category) => category.usable);
  const byId = new Map(usable.map((category) => [category.id, category]));

  const childrenByParent = new Map<string, LotteOnStandardCategory[]>();
  const roots: LotteOnStandardCategory[] = [];
  for (const category of usable) {
    /* 부모가 없거나, 부모가 «사용 가능 목록에» 없으면 최상위로 둔다. 후자는
       부모가 use_yn=N 인 경우인데, 그때 자식을 버리면 트리가 통째로 비는 사고가
       난다(205 의 상위 노드 플래그를 실측으로 확인하지 못했다). 🔴 그래서 여기서는
       「버리지 않고 최상위에 둔다」를 고른다 — 셀러가 고를 수 있는 것을 숨기는
       쪽보다, 깊이가 한 칸 얕게 보이는 쪽이 덜 나쁘다. */
    if (!category.parentId || !byId.has(category.parentId)) {
      roots.push(category);
      continue;
    }
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const toNode = (category: LotteOnStandardCategory, depth: number): CommerceCategoryTreeNode => {
    /* 순환 참조 방어 — 205 의 upr_std_cat_id 를 실측으로 확인하지 못했으므로
       자기 자신을 가리키는 값이 와도 무한 재귀하지 않게 한다(파서가 `parentId === id`
       는 이미 걸러내지만, 긴 순환은 못 본다). */
    const children =
      depth >= MAX_TREE_DEPTH ? [] : (childrenByParent.get(category.id) ?? []).map((c) => toNode(c, depth + 1));
    return {
      id: category.id,
      name: category.name,
      children: children.length > 0 ? children : undefined,
    };
  };

  return {
    id: ROOT_ID,
    name: "롯데ON 표준카테고리",
    children: roots.length > 0 ? roots.map((category) => toNode(category, 0)) : undefined,
  };
}

export async function GET() {
  const categories: LotteOnStandardCategory[] = [];
  let unrecognized = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const read = await runLotteOnRead({
      host: "onpick",
      method: "GET",
      path: LOTTEON_READ_PATHS.onpickCheetah,
      query: { job: "cheetahStandardCategory", skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) },
      envelope: "RAW",
      step: `205 표준카테고리 트리 조회(${page + 1}번째 페이지)`,
    });
    /* 🔴 첫 페이지 실패는 그대로 올린다 — 인증키 없음/401/403 을 「카테고리 없음」
       으로 바꾸지 않는다(추천기가 같은 원칙을 쓴다). 2페이지 이후 실패는 이미 받은
       만큼으로 트리를 세우고 truncated 를 표시한다. */
    if (!read.ok) {
      if (page === 0) return read.response;
      truncated = true;
      break;
    }

    const raw = read.result.raw as { itemList?: unknown } | null;
    const itemList = Array.isArray(raw?.itemList) ? (raw.itemList as Record<string, unknown>[]) : [];
    for (const entry of itemList) {
      const source = (entry.data ?? entry) as Record<string, unknown>;
      const parsed = parseLotteOnStandardCategory(source);
      if (parsed) categories.push(parsed);
      else unrecognized += 1;
    }
    if (itemList.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  /* 🔴 **조용히 빈 트리를 성공으로 내려보내지 않는다**(CPO ④).
     응답은 받았는데 파싱이 0건이면 그것은 「카테고리가 없다」가 아니라
     「우리가 그 응답을 못 읽었다」다 — 두 사실을 섞으면 셀러가 영원히 못 고친다.
     파서가 Production 응답을 받아 본 적이 없으므로(머리 주석) 이 분기는 실제로
     일어날 수 있는 경로다. */
  if (categories.length === 0) {
    return NextResponse.json({
      status: "PARSE_EMPTY",
      error:
        unrecognized > 0
          ? `롯데ON 카테고리 응답 ${unrecognized}건을 읽지 못했습니다 — 응답 형식이 문서와 다릅니다.`
          : "롯데ON이 표준카테고리를 한 건도 돌려주지 않았습니다.",
      unrecognized,
    });
  }

  return NextResponse.json({
    status: "OK",
    tree: buildLotteOnCategoryTree(categories),
    /* 진단용 — 화면이 「몇 개를 읽었고 몇 개를 못 읽었는가」를 말할 수 있게 한다. */
    parsed: categories.length,
    unrecognized,
    truncated,
  });
}
