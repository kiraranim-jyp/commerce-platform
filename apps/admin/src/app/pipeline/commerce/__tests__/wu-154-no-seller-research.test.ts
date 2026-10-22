import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-154 — **셀러에게 «조사 업무» 를 돌려주지 않는다**(CPO 확정 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일은 **되돌린 구현에서 나왔다.** WU-154-A 에서 CTO 가 「동일상품 URL 추가」
 * 입력 한 칸을 셀러 화면에 만들었고, **CPO 가 그것을 폐기했다.** 이유를 그대로 적는다:
 *
 * > 「판매자가 URL 을 찾아서 넣는 시스템이 아니라, **시스템이 동일상품을 찾아서**
 * >  가격을 비교하고 판매 여부를 판단해주는 시스템」 (CPO 문장)
 *
 * ```
 * ❌ 시스템이 못 찾음 → **판매자가 URL 찾아서 입력** → 시스템이 다시 판단
 * ✅ 원상품 입력 → **시스템이 탐색** → MI 판정 → 가격 수집 → 시장가격 → 판매 판단
 * ```
 * 🔴 공급이 막혔다는 사실을 **셀러 노동으로 메우면** 제품의 존재 이유가 약해진다.
 *    그 순간 「후보 목록 제거」(WU-149/152)도 뜻을 잃는다 — 목록만 없을 뿐 **일은 그대로**다.
 *
 * ── 🟢 이 계약이 «막지 않는» 것 ───────────────────────────────────────────────
 * ```
 * 🟢 내부 공급 경로는 **그대로 살아 있다** — `candidateUrls` API 경계 ·
 *    `collectUrlCandidatePool` · `listReviewedSameUrls` 재투입 · 붙여넣기 파서.
 * 🟢 개발/검증용 입력도 **살아 있다** — `isSuppliedUrlInputVisible()`(기본 false ·
 *    WU-130 ③). 🔴 그것은 **셀러 제품 기능이 아니다** — 그 구분이 이 계약의 전부다.
 * ```
 */

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (...p: string[]) => strip(readFileSync(path.join(__dirname, ...p), "utf8"));

const AREA = read("..", "MarketPriceComparison.tsx");
const WORKSPACE = read("..", "..", "CommerceWorkspace.tsx");

describe("🔴🔴 셀러 결론 영역은 셀러에게 «입력» 을 요구하지 않는다", () => {
  /**
   * 🔴 가격/판단의 유일한 owner 영역이다. 여기에 입력칸이 생기는 순간
   *    「결론을 읽는 자리」가 「일을 하는 자리」가 된다.
   */
  it("A-1 🔴 결론 영역에 입력칸·전송 버튼이 **없다**", () => {
    expect(AREA, "🔴 결론 영역에 <input> 이 생겼다").not.toMatch(/<input\b/);
    expect(AREA, "🔴 결론 영역에 <textarea> 가 생겼다").not.toMatch(/<textarea\b/);
    expect(AREA, "🔴 결론 영역이 요청을 보낸다").not.toContain("fetch(");
  });

  /** 🔴 어휘로도 막는다 — 모양을 바꿔 같은 일을 시키는 길을 닫는다. */
  it("A-2 🔴 셀러에게 URL/후보 조사를 요구하는 **말** 이 없다", () => {
    for (const banned of ["URL 추가", "URL을 추가", "주소를 넣", "직접 확인", "직접 찾"]) {
      expect(AREA, `🔴 "${banned}" 이 결론 영역에 있다`).not.toContain(banned);
    }
  });

  /**
   * 🔴🔴 Workspace 쪽 배선도 같이 막는다 — 영역만 깨끗하고 상위가 핸들러를
   *    꽂아 두면 다음 사람이 한 줄로 되살린다.
   */
  it("A-3 🔴 Workspace 에 셀러 URL 공급 핸들러가 **없다**", () => {
    expect(WORKSPACE).not.toContain("handleAddSameUrl");
    expect(WORKSPACE).not.toContain("onAddSameUrl");
    expect(WORKSPACE).not.toContain("suppliedUrlRequest");
  });
});

describe("🟢 그러나 내부 공급 «경로» 는 지우지 않았다(엔진 보존)", () => {
  /**
   * 🔴 이 구역이 없으면 위 단언만 보고 다음 사람이 **API 경계와 재투입까지** 지운다.
   *    그러면 자동 공급을 고칠 때 들어갈 자리가 사라진다.
   */
  const ROUTE = read("..", "..", "..", "api", "price-history", "check", "route.ts");
  const RUNNER = read("..", "..", "..", "api", "price-history", "_lib", "run-domestic-price-check.ts");

  it("B-1 🟢 `candidateUrls` API 경계가 살아 있다", () => {
    expect(ROUTE).toContain("candidateUrls");
    expect(RUNNER).toContain("candidateUrls");
  });

  /**
   * 🟢 사람이 SAME 이라 한 URL 의 **자동 재투입** — 셀러 행동 없이 도는 경로다.
   *
   * 🔴 1차에 이것을 **좌표(indexOf)** 로 쓰려다 틀렸다 — `indexOf` 가 **import 줄** 을
   *    집어서 「게이트보다 앞」이 나왔다(이 저장소가 여러 번 기록한 그 함정).
   * 🟢 그래서 **성질** 로 쓴다: 재투입 URL 은 `candidateUrls` 와 **다른 칸** 으로
   *    **자기 조건** 에 따라 runner 에 넘어간다. 그 둘이 한 조건에 묶이면 FAIL 한다.
   */
  it("B-2 🟢 재투입이 `candidateUrls` 와 **다른 칸·다른 조건** 으로 넘어간다", () => {
    expect(ROUTE).toContain("listReviewedSameUrls");
    expect(RUNNER).toContain("reviewedSameUrls");
    /** 🔴 자기 조건으로 넘어간다 — `candidateUrls` 가 비어도 재투입은 간다. */
    expect(ROUTE).toMatch(/reviewedSameUrls:\s*reviewedSameUrls\.length > 0/);
    /** 🔴 runner 쪽도 **별도 분기** 다(두 생산자가 한 조건에 묶이지 않는다). */
    expect(RUNNER).toMatch(/if \(input\.reviewedSameUrls && input\.reviewedSameUrls\.length > 0\)/);
  });

  /** 🟢 개발/검증용 입력은 **flag 뒤에** 그대로 있다(제품 기능이 아니다 · WU-130 ③). */
  it("B-3 🟢 개발용 붙여넣기 입력이 flag 뒤에 보존돼 있다", () => {
    const PANEL = read("..", "DomesticPriceIntelligencePanel.tsx");
    expect(PANEL).toContain("isSuppliedUrlInputVisible");
    expect(PANEL).toContain("candidateUrlsText");
  });
});
