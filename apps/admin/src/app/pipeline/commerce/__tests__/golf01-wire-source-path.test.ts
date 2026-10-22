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
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **WU-149 STEP 1 — 경로가 «둘에서 하나로» 줄었다**(끊긴 것이 아니다)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 조사 카테고리는 전까지 **두 경로** 로 흘렀다:
 * ```
 * ⒜ page → CommerceWorkspace → ComparisonShopSearch → /api/comparison/search
 *    (셀러 화면의 해외 후보 «연구 표» 가 자기 검색을 돌리는 경로)
 * ⒝ page → 스냅샷 저장 payload → 서버 → resolveMarketCategoryScopes
 *    (국내·해외 공통 **엔진** 경로)
 * ```
 * 🔴 WU-149 가 그 연구 표를 셀러 화면에서 제거했으므로 **⒜ 가 사라졌다.**
 * 🟢 **⒝ 는 그대로다** — 그래서 「카테고리가 조사 대상을 거른다」는 성질은 유지된다.
 * 🔴 그러므로 이 파일은 이제 ⒝ 를 단언하고, ⒜ 의 부재를 **명시적으로** 단언한다
 *    (약화가 아니다 — 부활하면 FAIL 이다).
 */

const workspace = stripComments(readSourceAt(new URL("../../CommerceWorkspace.tsx", import.meta.url)));
const page = stripComments(readSourceAt(new URL("../../page.tsx", import.meta.url)));
const panel = stripComments(readSourceAt(new URL("../ComparisonShopSearch.tsx", import.meta.url)));

describe("GOLF-01-WIRE — page → 엔진(스냅샷) 경로", () => {
  it("🟢 page.tsx가 셀러가 고른 카테고리를 **스냅샷 payload** 에 싣는다(엔진 경로)", () => {
    expect(page).toContain("marketCategoryProfileId: marketCategoryId || undefined");
  });

  it("빈 문자열(미선택)을 그대로 보내지 않는다 — 라우트의 자동추정 폴백이 살아야 한다", () => {
    expect(page).not.toContain("marketCategoryProfileId: marketCategoryId,");
  });

  /**
   * 🔴🔴 **WU-149 — 셀러 화면 경로는 «없다».**
   *
   * 🔴 전 단언은 「CommerceWorkspace 가 ComparisonShopSearch 로 그대로 흘린다」였다.
   *    그 컴포넌트가 셀러 화면에서 제거됐으므로 흘릴 곳이 없고, 그래서 그 prop 도
   *    `CommerceWorkspace` 에서 **같이** 지웠다(쓰이지 않는 prop 을 남기면 다음
   *    사람이 그 패널을 되살린다).
   */
  it("🔴🔴 WU-149 — CommerceWorkspace 는 그 값을 받지도 흘리지도 않는다", () => {
    expect(workspace, "🔴 셀러 화면에 해외 후보 연구 표 배선이 되살아났다").not.toContain(
      "marketCategoryProfileId",
    );
    expect(page, "🔴 page 가 CommerceWorkspace 로 그 값을 다시 넘긴다").not.toContain(
      "marketCategoryProfileId={marketCategoryId",
    );
  });

  /**
   * 🟢🟢 **엔진 보존 — 패널 «파일» 은 그대로 있고 그 안의 배선도 살아 있다.**
   * 🔴 이 단언이 `wu-149 M7`(엔진 삭제 금지)의 이 파일 쪽 몫이다 — 파일을 지우면
   *    `readSourceAt` 이 던져서 FAIL 한다.
   */
  it("🟢 패널(보존)이 collectOverseasPrices 입력에 그대로 싣는다", () => {
    expect(panel).toMatch(/collectOverseasPrices\({[^}]*marketCategoryProfileId[^}]*}\)/);
  });

  it("🔴 useCollectOnce 키에는 카테고리를 넣지 않는다 — 복원 중 키가 바뀌면 크롤링이 두 번 돈다", () => {
    expect(panel).toContain("`overseas:${sourceUrl || title}`");
    expect(panel).not.toMatch(/overseas:\$\{[^}]*marketCategoryProfileId/);
  });
});
