import { DETAIL_PAGE_REFERENCE_TEXT } from "../notice/reference-eligibility";
import { LOTTEON_SELLER_FILLABLE_ARTICLE_CODES, isLotteOnSellerFillableArticle } from "./notice-resolve";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-NOTICE-BULK-REFERENCE-01 (CPO 승인 「E」, 2026-09-30)
 * **셀러가 채울 수 있는 고시 항목을 «한 번에» 상세페이지 참조로 돌린다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 여기(순수 함수)인가 ─────────────────────────────────────────────────
 * 버튼 `onClick` 안에서 `articleValues` 를 직접 펼쳐 쓰면 「기존 값을 덮지 않는다」
 * 규칙이 JSX 한복판에 숨는다. 이 저장소에서 그렇게 숨은 규칙이 지워진 적이 있다.
 * 그래서 **무엇을 바꾸고 무엇을 건드리지 않았는지** 를 값으로 돌려준다 —
 * 화면은 그 결과를 쓰기만 하고, 테스트는 규칙을 직접 잰다.
 *
 * ── 🔴 CPO 안전조건과 이 파일의 대응 ───────────────────────────────────────
 *   ① 기존 셀러 입력값을 덮지 않는다   → `skipped` 로 빼고 `next` 에 그대로 둔다
 *   ② KC `0200` · 원산지 `0060` 제외   → 화이트리스트 밖은 애초에 들어오지 못한다
 *   ③ 반복 적용은 멱등                  → 이미 참조면 `applied` 에 들지 않는다
 *   ④ 해제는 기존 전이 규칙              → 칸별 버튼과 «같은» `""` 로 되돌린다
 *   ⑤ 실제 값과 참조를 구분              → 값이 참조 문구인지 여부로만 판단한다
 *   ⑥ payload/검증 불변                  → 이 파일은 폼 값만 만든다. 어댑터를 모른다
 *
 * 🔴 ②는 «이중 게이트» 다. 부르는 쪽이 코드 목록을 넘기더라도 화이트리스트 밖은
 * 여기서 다시 떨어진다 — 「화면이 안 보여주니까 안전하다」에 기대지 않는다.
 * KC 를 상세페이지 참조로 얼버무리면 규제 위반이고, 그 가드는 화면 하나에
 * 맡길 것이 아니다(「12313ㄹㅇ」 사건).
 */

/** 일괄 적용이 무엇을 했는지 — 화면이 문구를 만들 수 있게 «사실» 로 돌려준다. */
export interface LotteOnBulkReferencePlan {
  /** 적용 후의 `articleValues` 전체. 🔴 원본을 변형하지 않는다. */
  next: Record<string, string>;
  /** 이번에 참조로 바뀐 항목코드. 이미 참조였던 것은 들어가지 않는다(멱등). */
  applied: string[];
  /** 🔴 셀러가 이미 «실제 값» 을 적어 둬서 건드리지 않은 항목코드. */
  skipped: string[];
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * 「비어 있는 칸만」 상세페이지 참조로 채운다.
 *
 * 🔴 빈 칸만 고르는 것이 핵심이다. 전부 덮어쓰면 셀러가 어제 적어 둔 「최대 체중
 * 20kg」이 「상품 상세페이지 참조」로 조용히 바뀐다 — 값을 잃는 쪽이 클릭 한 번
 * 아끼는 것보다 훨씬 비싸다.
 */
export function planLotteOnBulkReference(
  articleValues: Record<string, string>,
  codes: readonly string[] = LOTTEON_SELLER_FILLABLE_ARTICLE_CODES,
): LotteOnBulkReferencePlan {
  const next = { ...articleValues };
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const code of codes) {
    /* 🔴 이중 게이트 — 화이트리스트 밖은 여기서 끝난다. */
    if (!isLotteOnSellerFillableArticle(code)) continue;
    const current = clean(articleValues[code]);
    if (current === DETAIL_PAGE_REFERENCE_TEXT) continue; /* 이미 참조 — 멱등 */
    if (current) {
      /* 셀러가 실제로 적어 둔 값이다. 손대지 않는다. */
      skipped.push(code);
      continue;
    }
    next[code] = DETAIL_PAGE_REFERENCE_TEXT;
    applied.push(code);
  }

  return { next, applied, skipped };
}

/**
 * 일괄로 «참조만» 해제한다.
 *
 * 🔴 셀러가 직접 적은 값은 해제 대상이 아니다 — 해제는 「우리가 넣은 참조를
 * 되돌리는 것」이고, 실제 값을 지우는 것이 아니다. 칸별 버튼과 같은 `""` 로
 * 되돌려 상태가 「입력 필요」로 후퇴하게 둔다(미적용 = 미입력 원칙).
 */
export function planLotteOnBulkReferenceClear(
  articleValues: Record<string, string>,
  codes: readonly string[] = LOTTEON_SELLER_FILLABLE_ARTICLE_CODES,
): LotteOnBulkReferencePlan {
  const next = { ...articleValues };
  const applied: string[] = [];

  for (const code of codes) {
    if (!isLotteOnSellerFillableArticle(code)) continue;
    if (clean(articleValues[code]) !== DETAIL_PAGE_REFERENCE_TEXT) continue;
    next[code] = "";
    applied.push(code);
  }

  return { next, applied, skipped: [] };
}
