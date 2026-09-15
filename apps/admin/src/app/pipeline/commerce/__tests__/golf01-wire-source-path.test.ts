import { describe, expect, it } from "vitest";
import { readSourceAt, stripComments } from "./source-text";

/**
 * GOLF-01-WIRE(CEO 지시, 2026-09-16) — **경로가 실제로 이어져 있는가.**
 *
 * 형제 파일 `golf01-wire-overseas-category.test.ts`는 패널을 직접 마운트해
 * 나간 요청 본문을 본다. 그것만으로는 **패널 위쪽 두 단계**(page →
 * CommerceWorkspace)가 값을 흘리는지 알 수 없다 — 패널에 직접 prop을 꽂아
 * 테스트하면 위가 끊겨 있어도 통과한다. 그 구간을 여기서 고정한다.
 *
 * jsdom이 아닌 node 환경이어야 한다(`import.meta.url`이 `file:`이라야
 * readSourceAt이 읽는다).
 */

const workspace = stripComments(readSourceAt(new URL("../../CommerceWorkspace.tsx", import.meta.url)));
const page = stripComments(readSourceAt(new URL("../../page.tsx", import.meta.url)));
const panel = stripComments(readSourceAt(new URL("../ComparisonShopSearch.tsx", import.meta.url)));

describe("GOLF-01-WIRE — page → CommerceWorkspace → 패널", () => {
  it("page.tsx가 셀러가 고른 카테고리를 CommerceWorkspace에 넘긴다", () => {
    expect(page).toContain("marketCategoryProfileId={marketCategoryId || undefined}");
  });

  it("빈 문자열(미선택)을 그대로 보내지 않는다 — 라우트의 자동추정 폴백이 살아야 한다", () => {
    expect(page).not.toContain("marketCategoryProfileId={marketCategoryId}");
  });

  it("CommerceWorkspace가 ComparisonShopSearch로 그대로 흘린다", () => {
    expect(workspace).toContain("marketCategoryProfileId={marketCategoryProfileId}");
  });

  it("패널이 collectOverseasPrices 입력에 싣는다", () => {
    expect(panel).toMatch(/collectOverseasPrices\({[^}]*marketCategoryProfileId[^}]*}\)/);
  });

  it("🔴 useCollectOnce 키에는 카테고리를 넣지 않는다 — 복원 중 키가 바뀌면 크롤링이 두 번 돈다", () => {
    expect(panel).toContain("`overseas:${sourceUrl || title}`");
    expect(panel).not.toMatch(/overseas:\$\{[^}]*marketCategoryProfileId/);
  });
});
