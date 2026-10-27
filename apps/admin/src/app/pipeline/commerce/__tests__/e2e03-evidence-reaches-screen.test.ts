import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 E2E-03 — **생산자를 늘리면 «화면이 읽는 자리» 도 같이 늘어나야 한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 왜 이 파일이 생겼나 — **같은 함정을 두 번 밟았다**:
 * ```
 * CORE-2R-4  `domesticListingEvidence` 를 MI 입력에만 넘기고 패널이 안 읽었다
 *            ⟹ 국내 후보 둘이 화면에서 사라졌다(CORE-2R-5 가 고쳤다)
 * SP-07      `webSearchEvidence` 로 **똑같이** 반복했다
 *            ⟹ AI Search 의 국내 후보(11st · danawa)가 화면에서 사라졌다(E2E-03 이 고쳤다)
 * ```
 * 🔴 그때 주석에 「읽는 쪽 다섯 자리를 같이 고쳐라」고 적어 뒀는데 **주석은 막지 못했다.**
 * 🟢 그래서 **목록을 손으로 적지 않고** runner 의 결과 타입에서 **전수로 뽑아** 돌린다 —
 *    일곱 번째 생산자를 만들고 화면 배선을 빠뜨리면 **이 계약이 FAIL 한다**.
 */

const LIB = join(__dirname, "../../../api/price-history/_lib");
const RUNNER = stripComments(readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n"));
const ROUTE = stripComments(
  readFileSync(join(LIB, "../check/route.ts"), "utf8").replace(/\r\n/g, "\n"),
);
const PANEL = stripComments(
  readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8").replace(/\r\n/g, "\n"),
);

/**
 * 🟢 **생산자 목록을 손으로 적지 않는다.** runner 의 결과 타입에서
 *    `…Evidence?: GeminiTransientEvidence[] | null;` 칸을 전수로 뽑는다.
 */
function producerFields(): string[] {
  const out = new Set<string>();
  for (const m of RUNNER.matchAll(/^\s*(\w+Evidence)\?:\s*GeminiTransientEvidence\[\]\s*\|\s*null;/gm)) {
    out.add(m[1]!);
  }
  return [...out].sort();
}

describe("E2E-03 — transient 생산자가 «화면까지» 간다", () => {
  it("🟢 생산자 칸을 runner 타입에서 **전수로** 뽑는다(손으로 적지 않는다)", () => {
    const fields = producerFields();
    /** 🔴 지금 여섯이다. 숫자가 아니라 **이름** 으로 확인한다(엉뚱한 칸으로 바꿔치기 방지). */
    expect(fields).toEqual([
      "domesticListingEvidence",
      "geminiEvidence",
      "overseasAutoEvidence",
      "reviewedSameEvidence",
      "urlCandidateEvidence",
      "webSearchEvidence",
    ]);
  });

  it("🔴 route 가 **전 생산자** 를 MI 입력에서 펼친다", () => {
    const at = ROUTE.indexOf("const transientEvidence");
    expect(at).toBeGreaterThan(0);
    const block = ROUTE.slice(at, ROUTE.indexOf("computeMarketIntelligence", at));
    for (const f of producerFields()) {
      expect(block, `${f} 가 MI 입력에서 펼쳐지지 않는다`).toContain(`...(domesticShop.${f} ?? [])`);
    }
  });

  /**
   * 🔴🔴 **이 네 자리를 하나라도 빠뜨리면 후보가 «조용히» 사라진다.**
   *    두 번 다 여기가 뚫렸다 — MI 에는 갔는데 화면에는 안 왔다.
   */
  it("🔴🔴 패널이 **전 생산자** 를 읽는다 — setter · 자동1회차 · 다시분석 · rows · deps", () => {
    for (const f of producerFields()) {
      const setter = `set${f[0]!.toUpperCase()}${f.slice(1)}`;
      /** ① state 가 있다 */
      expect(PANEL, `${f}: state 가 없다`).toContain(`const [${f}, ${setter}]`);
      /** ② 자동 1회차 응답을 읽는다 */
      expect(PANEL, `${f}: 자동 1회차 setter 가 없다`).toContain(`${setter}(j.domesticShop?.${f} ?? null)`);
      /** ③ 「🔄 다시 분석」 응답도 읽는다 */
      expect(PANEL, `${f}: 다시분석 setter 가 없다`).toContain(`${setter}(json.domesticShop?.${f} ?? null)`);
      /** ④ 화면 rows 에 **펼쳐** 들어간다 */
      expect(PANEL, `${f}: rows 에 펼쳐지지 않는다`).toContain(`...(${f} ?? [])`);
    }
  });

  it("🔴 `anyEvidence` 판정과 `useMemo` deps 에도 **전 생산자** 가 있다", () => {
    const at = PANEL.indexOf("const anyEvidence");
    expect(at).toBeGreaterThan(0);
    const block = PANEL.slice(at, PANEL.indexOf("return {", at));
    for (const f of producerFields()) {
      expect(block, `${f}: anyEvidence 에 없다`).toContain(`${f} != null`);
    }
    /** 🔴 deps 에 없으면 **첫 응답 뒤 값이 갱신되지 않는다**(조용히 낡는다). */
    const memoEnd = PANEL.indexOf("}, [", at);
    const deps = PANEL.slice(memoEnd, PANEL.indexOf("]);", memoEnd));
    for (const f of producerFields()) {
      expect(deps, `${f}: useMemo deps 에 없다`).toContain(f);
    }
  });

  /**
   * 🔴 화면에 **내부 어휘를 노출하지 않는다**(CPO §8). 이 패널이 출처 id 를 글자로
   *    찍으면 셀러가 `__web_search__` 같은 내부 값을 본다.
   */
  it("🔴 패널이 내부 출처 id 를 **문자열로 찍지 않는다**", () => {
    for (const id of ["__web_search__", "__domestic_listing__", "__overseas_auto__", "__url_candidates__"]) {
      expect(PANEL, id).not.toContain(id);
    }
  });
});
