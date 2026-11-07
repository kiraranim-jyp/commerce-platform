import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXCLUDED_BRAND_LABEL,
  EXCLUDED_BRAND_NOTICE,
  isExcludedCandidate,
  isExcludedOriginBrand,
} from "@commerce/crawler";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-BRAND-EXCLUSION-01 — **Main Story 한정 제외**(CEO 결정 2026-11-07 · CPO 승인)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **네트워크 0 · DB 0.** 저장 fixture 와 순수 술어만 쓴다.
 *
 * 🔴🔴 **이 계약이 지키는 것은 「제외가 된다」가 아니라 «다른 브랜드가 그대로다» 다.**
 * ```
 * CPO §2 — Main Story 에만 적용 · 다른 브랜드 품번 비교 기준 변경 0 ·
 *          `Story` 부분 문자열만으로 제외 금지 · alias 등록부 변경 0
 * ```
 */

/** 🔴 Main Story 신호가 **0인 6쌍**(실측 · CEO Evidence Review 11쌍 중). 이 값들이 불변이어야 한다. */
const UNAFFECTED: Record<string, string> = {
  C27: "PRESUMED_SAME",
  C50: "PRESUMED_SAME",
  C05: "SAME",
  C06: "SAME",
  "S1-5": "CONFLICT",
  "S1-6": "SAME",
};
/** 🔴 CEO 가 취급 제외라 한 5쌍. */
const MAIN_STORY_IDS = ["C22", "C19", "C20", "C42", "C25"];

describe("MI-BRAND-EXCLUSION-01 — Main Story 한정 제외(네트워크 0)", () => {
  /* ═══════ A. 술어 — 경계와 범위 ═══════════════════════════════════════════ */
  it("A-1 원상품 브랜드 술어는 Main Story 표기 변형만 잡는다", () => {
    /**
     * 🔴 **`Mainstory`(공백 없음)도 제외 대상이다** — 1차 단언에서 내가 「제외돼선 안 된다」로
     *    적었고 **FAIL 했다. 코드가 맞았다.** 이 리포는 한국어/판매처 제목에서 띄어쓰기가
     *    사라지는 것을 이미 실측했다(메모 `korean-title-spacing`: 「허그헤어리몬스터티셔츠」).
     *    ⟹ 공백 없는 표기는 **같은 브랜드** 다.
     */
    for (const yes of ["Main Story", "main story", "MAIN STORY", "main-story", "Main_Story", "Mainstory", "메인스토리", "매인스토리"]) {
      expect(isExcludedOriginBrand(yes), `🔴 「${yes}」 는 취급 제외여야 한다`).toBe(true);
    }
  });

  it("A-2 🔴 `Story` 부분 문자열로 다른 브랜드를 지우지 않는다", () => {
    /** 🔴 CPO §2 가 명시한 금지다 — 이 단언이 그 금지를 **기계로** 지킨다. */
    for (const no of [
      "Story", "story", "Story Loris", "Storybook", "Main", "Main Storybook", "Mainstory Kids",
      "Bobo Choses", "Wynken", "Bonjour", "The Animals Observatory", "Pèpè", "", null, undefined,
    ]) {
      expect(isExcludedOriginBrand(no as string | null), `🔴 「${String(no)}」 는 제외돼선 안 된다`).toBe(false);
    }
  });

  it("A-3 후보 술어는 brand «또는» 공식몰 호스트로 잡고 접미사 경계를 지킨다", () => {
    expect(isExcludedCandidate({ brand: "Main Story", url: "https://junioredition.com/products/x" })).toBe(true);
    expect(isExcludedCandidate({ brand: null, url: "https://main-story.com/products/x" })).toBe(true);
    expect(isExcludedCandidate({ brand: null, url: "https://shop.main-story.com/products/x" })).toBe(true);
    /** 🔴 접미사 경계 — 비슷한 도메인을 지우지 않는다. */
    expect(isExcludedCandidate({ brand: null, url: "https://notmain-story.com/products/x" })).toBe(false);
    expect(isExcludedCandidate({ brand: null, url: "https://main-story.com.evil.test/x" })).toBe(false);
    /** 🔴 다른 브랜드 후보는 그대로다. */
    expect(isExcludedCandidate({ brand: "Bobo Choses", url: "https://tinyapple.net/products/x" })).toBe(false);
    expect(isExcludedCandidate({ brand: null, url: null })).toBe(false);
    expect(isExcludedCandidate({ brand: null, url: "not a url" })).toBe(false);
  });

  it("A-4 🔴 후보 «제목» 은 보지 않는다 — 새 추출 규칙을 만들지 않았다", () => {
    /**
     * 「by Main Story」 같은 귀속 문구를 읽는 것은 **새 규칙** 이고 CPO 가 열지 않았다.
     * 🟢 실측에서 필요하지도 않다 — 그 후보들은 `brand` 가 채워져 있고, brand 가 비어 있던
     *    1건(donokids)은 **원상품이 Main Story** 라 진입점에서 먼저 끊긴다.
     */
    expect(isExcludedCandidate({ brand: null, url: "https://junioredition.com/products/bubble-sweatshirt-by-main-story" })).toBe(false);
  });

  /* ═══════ B. 실데이터 — 5/5 가 잡히고 6/6 이 그대로다 ═════════════════════ */
  it("B-1 CEO 가 지목한 Main Story 5쌍이 ①+② 로 전부 덮인다", () => {
    const gt = JSON.parse(readFileSync(join(__dirname, "fixtures", "ceo-evidence-review-gt.json"), "utf8")) as {
      pairs: { id: string; domain: string; originUrl: string }[];
    };
    const byId = new Map(SAME05_PAIRS.map((p) => [p.id, p]));
    for (const id of MAIN_STORY_IDS) {
      const p = byId.get(id);
      expect(p, `🔴 ${id} 가 fixture 에 없으면 이 계약이 성립하지 않는다`).toBeDefined();
      const originExcluded = isExcludedOriginBrand(p!.origin.brand);
      const candExcluded = isExcludedCandidate({ brand: p!.facts.brand, url: p!.url });
      expect(originExcluded || candExcluded, `🔴 ${id} 가 ①②  어디에서도 걸리지 않는다`).toBe(true);
    }
    /** 🟢 그리고 **원상품 쪽에서 5/5 전부** 걸린다 — 그래서 ① 하나로 검색 자체가 돌지 않는다. */
    const originHits = MAIN_STORY_IDS.filter((id) => isExcludedOriginBrand(byId.get(id)!.origin.brand));
    expect(originHits.length, "🔴 원상품 브랜드로 5/5 가 잡혀야 한다(실측)").toBe(MAIN_STORY_IDS.length);
    expect(gt.pairs.filter((p) => MAIN_STORY_IDS.includes(p.id)).length).toBe(MAIN_STORY_IDS.length);
  });

  it("B-2 🔴🔴 **다른 브랜드 6쌍은 제외되지 않고 verdict 가 한 글자도 바뀌지 않는다**", () => {
    const byId = new Map(SAME05_PAIRS.map((p) => [p.id, p]));
    for (const [id, expected] of Object.entries(UNAFFECTED)) {
      const p = byId.get(id);
      expect(p, `🔴 ${id} 가 fixture 에 없다`).toBeDefined();
      expect(isExcludedOriginBrand(p!.origin.brand), `🔴 ${id} 의 원상품이 제외되면 안 된다`).toBe(false);
      expect(isExcludedCandidate({ brand: p!.facts.brand, url: p!.url }), `🔴 ${id} 의 후보가 제외되면 안 된다`).toBe(false);
      /** 🔴 그리고 **판정 결과가 그대로** 여야 한다 — 제외는 matcher 입력에 닿지 않는다. */
      expect(String(same05Judge(p!.origin, p!.facts).cross.verdict), `🔴 ${id} verdict 가 바뀌었다`).toBe(expected);
    }
  });

  it("B-3 전수 33쌍에서 제외되는 것은 **Main Story 뿐** 이고 그 수는 6 이다", () => {
    /**
     * 🔴🔴 **1차 단언이 틀렸다** — 「검토 대상 11쌍에 없으면 Main Story 가 아니다」로 썼고
     *    `S4-1(main-story.com · human UNCERTAIN)` 에서 **FAIL 했다. 코드가 맞았다.**
     *    ⟹ 제외의 영향 범위는 **검토한 5쌍이 아니라 전수 6쌍** 이다(실측).
     * 🟢 그래서 판정은 **id 목록이 아니라 브랜드/호스트** 로 센다.
     */
    const hits = SAME05_PAIRS.filter(
      (p) => isExcludedOriginBrand(p.origin.brand) || isExcludedCandidate({ brand: p.facts.brand, url: p.url }),
    );
    expect(hits.length, "🔴 전수 영향 범위가 6 이 아니면 분모가 바뀐 것이다").toBe(6);
    /** 🔴 제외된 쌍은 **전부** 원상품 brand 가 Main Story 다(실측 6/6). */
    for (const p of hits) {
      expect(isExcludedOriginBrand(p.origin.brand), `🔴 ${p.id} 가 원상품 브랜드 없이 제외됐다`).toBe(true);
    }
    /** 🔴 나머지 27쌍은 **하나도** 제외되지 않는다. */
    const rest = SAME05_PAIRS.filter((p) => !hits.includes(p));
    expect(rest.length).toBe(SAME05_PAIRS.length - 6);
    const victims = rest
      .filter((p) => isExcludedOriginBrand(p.origin.brand) || isExcludedCandidate({ brand: p.facts.brand, url: p.url }))
      .map((p) => `${p.id}(${p.domain})`);
    expect(victims, "🔴 Main Story 가 아닌데 제외된 쌍이 있다").toEqual([]);
  });

  it("B-4 🔴🔴 **`SAME05_BASELINE` 이 바뀌지 않는다** — 제외는 GT 집계 경로에 닿지 않는다", () => {
    /**
     * CPO §6 「SAME05_BASELINE 변경 금지」를 **구조로** 지킨다:
     * 제외는 `runDomesticPriceCheck`(진입점)와 `judgeDomesticCandidate`(운영 루프)에만 있고,
     * GT 집계는 `same05Judge` → `compareCrossSellerProducts` 를 **직접** 부른다.
     * ⟹ 🟢 Main Story 쌍의 판정 산출도 **전과 같다**(기준선이 흔들리지 않는다).
     */
    expect(SAME05_BASELINE.total).toBe(33);
    expect(SAME05_BASELINE.same).toBe(18);
    expect(SAME05_BASELINE.different).toBe(9);
    expect(SAME05_BASELINE.uncertain).toBe(6);
    expect(SAME05_BASELINE.fp).toBe(1);
    /** 🔴 Main Story 쌍도 **여전히 판정된다**(집계 경로에서는 제외가 발화하지 않는다). */
    const byId = new Map(SAME05_PAIRS.map((p) => [p.id, p]));
    for (const id of MAIN_STORY_IDS) {
      const v = String(same05Judge(byId.get(id)!.origin, byId.get(id)!.facts).cross.verdict);
      expect(v, `🔴 ${id} 가 집계 경로에서 판정되지 않는다`).toMatch(/^(SAME|PRESUMED_SAME|SIMILAR|CONFLICT|UNKNOWN)$/);
    }
  });

  /* ═══════ C. 배선 — 운영 코드가 실제로 그 자리에서 부른다 ══════════════════ */
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const runner = stripComments(
    readFileSync(join(__dirname, "..", "run-domestic-price-check.ts"), "utf8"),
  );

  it("C-1 ① 원상품 조기 종료가 `runDomesticPriceCheck` **입구** 에 있다", () => {
    const entry = runner.indexOf("export async function runDomesticPriceCheck");
    expect(entry).toBeGreaterThan(0);
    const gate = runner.indexOf("isExcludedOriginBrand(input.dna.brand.value)", entry);
    expect(gate, "🔴 입구에서 원상품 브랜드를 보지 않는다").toBeGreaterThan(entry);
    /** 🔴🔴 **검색보다 «앞» 이어야 한다** — 뒤에 있으면 HTTP 가 이미 나갔다. */
    const search = runner.indexOf("searchDomesticShops", entry);
    expect(search, "🔴 검색 호출을 찾지 못했다").toBeGreaterThan(0);
    expect(gate, "🔴 제외 게이트가 검색보다 뒤에 있으면 비용이 0 이 아니다").toBeLessThan(search);
    /** 🔴 그 분기는 **문구를 서버가 실어** 보내야 한다. */
    expect(runner).toContain("brandExcluded: { brand: EXCLUDED_BRAND_LABEL, notice: EXCLUDED_BRAND_NOTICE }");
  });

  it("C-2 ② 후보 제외가 `judgeDomesticCandidate` 안에서 **판정보다 앞** 에 있다", () => {
    const fn = runner.indexOf("export async function judgeDomesticCandidate");
    expect(fn).toBeGreaterThan(0);
    const filter = runner.indexOf("isExcludedCandidate(", fn);
    const gate = runner.indexOf("isEvidenceEvaluationWorthwhile(", fn);
    expect(filter, "🔴 후보 제외 필터가 없다").toBeGreaterThan(fn);
    expect(gate).toBeGreaterThan(fn);
    expect(filter, "🔴 제외가 ⑧ 게이트보다 뒤면 판정이 이미 돌았다").toBeLessThan(gate);
    /** 🔴 자기참조 제외와 **같은 모양** 이어야 한다 — 카운트를 돌려준다. */
    expect(runner).toContain("const brandExcluded = notSelf.length - candidates.length;");
  });

  it("C-3 🔴 제외가 matcher 입력에 **닿지 않는다** — 판정 함수에 그 술어가 없다", () => {
    for (const f of [
      join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
      join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/model-code.ts"),
      join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/match-truth.ts"),
    ]) {
      const src = stripComments(readFileSync(f, "utf8"));
      for (const b of ["isExcludedCandidate", "isExcludedOriginBrand", "EXCLUDED_BRAND"]) {
        expect(src.includes(b), `🔴 ${f.split(/[\\/]/).pop()} 가 ${b} 를 읽으면 제외가 «판정» 이 된다`).toBe(false);
      }
    }
  });

  it("C-4 🔴 alias 등록부를 건드리지 않았다", () => {
    const alias = readFileSync(
      join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/brand-alias.ts"),
      "utf8",
    );
    for (const b of ["Main Story", "메인스토리", "EXCLUDED_BRAND", "isExcluded"]) {
      expect(alias.includes(b), `🔴 alias 등록부에 ${b} 가 들어가면 CPO 금지 위반이다`).toBe(false);
    }
  });

  /* ═══════ D. 화면 — 문구와 자리 ═══════════════════════════════════════════ */
  const panel = stripComments(
    readFileSync(join(__dirname, "../../../../pipeline/commerce/DomesticPriceIntelligencePanel.tsx"), "utf8"),
  );

  it("D-1 CPO 가 고정한 문구를 **그대로** 쓴다", () => {
    expect(EXCLUDED_BRAND_NOTICE).toBe(
      "취급 제외 브랜드입니다. Main Story는 현재 취급 대상이 아니므로 상품 검색 및 가격 비교를 진행하지 않았습니다.",
    );
    expect(EXCLUDED_BRAND_LABEL).toBe("Main Story");
  });

  it("D-2 🔴 화면이 문구를 **복제하지 않는다** — 서버 값을 그대로 렌더한다", () => {
    expect(panel).toContain('data-testid="brand-excluded-notice"');
    expect(panel).toContain("{brandExcludedNotice}");
    /** 🔴 문구 리터럴이 화면 파일에 있으면 owner 가 둘이 된다. */
    expect(panel.includes("취급 제외 브랜드입니다"), "🔴 화면이 문구를 사본으로 들고 있다").toBe(false);
  });

  it("D-3 🔴🔴 「후보 없음」과 **같은 칸에 넣지 않는다**", () => {
    /** `urlCandidateNotice` 는 「URL 풀이 무엇을 버렸나」이고 이것은 「시작하지 않았다」다. */
    expect(panel).toContain("setBrandExcludedNotice(json.domesticShop?.brandExcluded?.notice ?? null)");
    expect(panel.includes("setUrlCandidateNotice(json.domesticShop?.brandExcluded"), "🔴 두 칸을 섞었다").toBe(false);
  });

  it("D-4 🔴 안내가 접힘 «밖» 에 선다 — 펼치지 않아도 보인다", () => {
    const notice = panel.indexOf('data-testid="brand-excluded-notice"');
    const sections = panel.indexOf("<TransientCandidateSections");
    expect(notice).toBeGreaterThan(0);
    expect(sections).toBeGreaterThan(0);
    expect(notice, "🔴 안내가 탐색 접힘 뒤로 들어가면 셀러가 못 본다").toBeLessThan(sections);
  });
});
