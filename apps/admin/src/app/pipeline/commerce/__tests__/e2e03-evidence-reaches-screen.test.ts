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
 *
 * ── 🔴🔴🔴 E2E-04 — **이 계약이 «한 번 더» 뚫렸다. 그 구멍을 여기 적는다** ─────────
 * ```
 * E2E-03 은 네 자리(state · setter ×2 · rows · deps)만 단언했다.
 * 🔴 그런데 패널의 evidence 소비처는 **둘** 이다:
 *    ① marketComparisonInput.rows  → 📊 시장 판단(집계)      ← E2E-03 이 고쳤다
 *    ② <TransientCandidateSections> → **후보 카드(화면 행)**  ← **빠져 있었다**
 * ⟹ CEO 화면에서 집계는 움직였는데(comparisonSellers 2) **후보 카드는 비어 있었다.**
 * 🟢 그래서 아래 ⑤⑥ 을 더한다 — **렌더 경로** 와 **🇰🇷 합집합** 까지 전수로 본다.
 * ```
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
   * 🔴🔴🔴 E2E-04 ⑤ — **렌더 컴포넌트가 «전 생산자» 를 받는다.**
   *    `rows`(집계)에만 넣고 여기를 빠뜨리면 **집계는 움직이는데 화면 행이 없다** —
   *    CEO 가 본 그 화면이 정확히 이 모양이었다.
   */
  it("🔴🔴 `<TransientCandidateSections>` 호출부가 **전 생산자** 를 넘긴다", () => {
    const at = PANEL.indexOf("<TransientCandidateSections");
    expect(at).toBeGreaterThan(0);
    const call = PANEL.slice(at, PANEL.indexOf("/>", at));
    for (const f of producerFields()) {
      expect(call, `${f}: 렌더 컴포넌트에 전달되지 않는다 — 집계만 되고 화면에 안 보인다`).toContain(
        `{${f}}`,
      );
    }
  });

  /**
   * 🔴🔴🔴 E2E-04 ⑥ — **🇰🇷 합집합이 «전 생산자» 를 본다.**
   *    국내 행은 출처 구역이 아니라 「🇰🇷 국내 후보 검토」로 **옮겨진다**(WU-081).
   *    그 합집합이 좁으면 **국내 후보만 조용히 사라진다** — 해외는 멀쩡해 보인다.
   */
  it("🔴🔴 `krRows` 합집합에 **전 생산자** 가 들어간다", () => {
    const at = PANEL.indexOf("const krRows");
    expect(at).toBeGreaterThan(0);
    const block = PANEL.slice(at, PANEL.indexOf(".filter(isKr)", at));
    /**
     * 🟢 prop 이름을 **손으로 적지 않는다** — 호출부에서 `prop={field}` 를 파싱해
     *    생산자 칸 → prop 이름을 기계적으로 얻는다(일곱째 생산자에서도 성립한다).
     */
    const callAt = PANEL.indexOf("<TransientCandidateSections");
    const call = PANEL.slice(callAt, PANEL.indexOf("/>", callAt));
    const propOf = new Map<string, string>();
    for (const m of call.matchAll(/(\w+)=\{(\w+)\}/g)) propOf.set(m[2]!, m[1]!);
    for (const f of producerFields()) {
      const prop = propOf.get(f);
      expect(prop, `${f}: 호출부에서 prop 이름을 찾지 못했다`).toBeTruthy();
      expect(block, `${f}: 🇰🇷 합집합에 없다 — 그 출처의 국내 후보가 화면에서 사라진다`).toContain(
        `...(${prop} ?? [])`,
      );
    }
  });

  /**
   * 🔴🔴 E2E-04 ⑦ — **KR 이 아닌 행도 설 자리가 있어야 한다.**
   *    🇰🇷 합집합만 고치면 **해외 행이 조용히 사라진다**(국내만 보여 정상처럼 읽힌다).
   *    생산자마다 `<prop>Rest` 를 만들어 `evidence=` 로 그리는지 **기계적으로** 본다.
   */
  it("🔴 KR 이 아닌 행도 **출처 구역** 에 그려진다", () => {
    const callAt = PANEL.indexOf("<TransientCandidateSections");
    const call = PANEL.slice(callAt, PANEL.indexOf("/>", callAt));
    const propOf = new Map<string, string>();
    for (const m of call.matchAll(/(\w+)=\{(\w+)\}/g)) propOf.set(m[2]!, m[1]!);
    for (const f of producerFields()) {
      const rest = `${propOf.get(f)}Rest`;
      expect(PANEL, `${f}: ${rest} 를 만들지 않는다`).toContain(`const ${rest} = `);
      expect(PANEL, `${f}: ${rest} 를 그리지 않는다 — 해외 행이 사라진다`).toContain(`evidence={${rest}}`);
    }
  });

  /**
   * 🔴 E2E-04 ⑧ — **「조회가 돌았다」 판정도 전 생산자를 본다**(WU-130 ② 계약).
   *    빠지면 다른 출처가 전부 null 인 상황에서 🇰🇷 구역이 **통째로 사라진다** —
   *    셀러에게는 「조회조차 안 했다」로 읽힌다. 🔴 N7 변이가 이 자리를 뚫었다.
   */
  it("🔴 `checkRan` 이 **전 생산자** 를 본다", () => {
    const at = PANEL.indexOf("const checkRan");
    expect(at).toBeGreaterThan(0);
    const block = PANEL.slice(at, PANEL.indexOf(";", PANEL.indexOf("overseasReference", at)));
    const callAt = PANEL.indexOf("<TransientCandidateSections");
    const call = PANEL.slice(callAt, PANEL.indexOf("/>", callAt));
    const propOf = new Map<string, string>();
    for (const m of call.matchAll(/(\w+)=\{(\w+)\}/g)) propOf.set(m[2]!, m[1]!);
    for (const f of producerFields()) {
      expect(block, `${f}: checkRan 에 없다 — 🇰🇷 구역이 통째로 사라질 수 있다`).toContain(
        `${propOf.get(f)} != null`,
      );
    }
  });

  /**
   * 🔴🔴 E2E-04 ⑨ — **출처 배지가 «모든» 출처를 안다.**
   *    runner 의 `source` 유니온과 UI 의 `SOURCE_LABEL` 키가 어긋나면
   *    `SOURCE_LABEL[row.source]` 가 **undefined** 가 되어 배지가 **빈칸** 으로 나간다.
   *    🟢 이번에 typecheck 가 잡았지만, 타입을 넓히기만 하고 라벨을 안 넣으면 또 빈다.
   */
  it("🔴 runner 의 출처 집합 == UI `SOURCE_LABEL` 키 집합", () => {
    const union = RUNNER.match(/source:\s*\n?([\s\S]{0,400}?);/);
    expect(union, "runner 의 source 유니온을 찾지 못했다").toBeTruthy();
    const runnerSources = [...union![1]!.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]!).sort();
    expect(runnerSources.length).toBeGreaterThan(3);
    const CANDS = stripComments(
      readFileSync(join(__dirname, "../GeminiTransientCandidates.tsx"), "utf8").replace(/\r\n/g, "\n"),
    );
    const at = CANDS.indexOf("export const SOURCE_LABEL");
    const block = CANDS.slice(at, CANDS.indexOf("};", at));
    const uiKeys = [...block.matchAll(/^\s{2}([A-Z_]+):/gm)].map((m) => m[1]!).sort();
    expect(uiKeys, "출처 배지 라벨이 runner 집합과 다르다 — 배지가 빈칸으로 나간다").toEqual(runnerSources);
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
