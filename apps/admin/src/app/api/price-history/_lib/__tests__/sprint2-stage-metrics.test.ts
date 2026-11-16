import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  countPrimaryIdentitySignals,
  createDomesticStageCollector,
  hasPrimaryIdentitySignal,
  verifyDomesticCandidates,
  type ComparisonCandidate,
  type DomesticStageRecord,
} from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **SPRINT 2 — 1차 식별 신호(관측 전용) + 단계별 실행 기록**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 결정(2026-11-16) — ⒝ 채택 / ⒜(수집↔판정 교대 구조 변경) **불허**:
 * ```
 * 🟢 brand + manufacturer model code 일치 = **1차 검색의 강한 식별 신호**
 * 🔴 그것만으로 「SAME 후보」라 부르거나 조기 종료 충족으로 **간주 금지**
 * 🔴 실제 SAME = `judgeDomesticCandidate` 결과만 · SIMILAR·PRESUMED_SAME **제외**
 * ```
 *
 * 🔴🔴 **이 파일이 지키는 것은 둘이고 서로 반대 방향이다** —
 *    ⒜ 신호가 **실제로 계산되고 기록된다**(CEO 완료 조건: 실행 기록으로 증명)
 *    ⒝ 그 신호가 **판정으로 승격되지 않는다**(CPO 금지)
 *    둘 중 하나만 지키면 각각 「계측이 거짓」·「SAME 이 느슨해졌다」가 된다.
 */

const LIB = join(__dirname, "..");
const RUNNER = readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n");
const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const SEARCH = readFileSync(join(CRAWLER, "index.ts"), "utf8").replace(/\r\n/g, "\n");
const METRICS = readFileSync(join(CRAWLER, "domestic-stage-metrics.ts"), "utf8").replace(/\r\n/g, "\n");

/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`(열 번 걸린 함정). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}
const RUNNER_CODE = stripComments(RUNNER);
const SEARCH_CODE = stripComments(SEARCH);
const METRICS_CODE = stripComments(METRICS);

function facts(over: Partial<ProductFacts>): ProductFacts {
  return {
    sourceUrl: "https://shop.example.com/p/1",
    urlSlug: null,
    brand: null,
    brandModelCode: null,
    sellerSku: null,
    title: "제목",
    coreTitleTokens: [],
    categoryText: null,
    colorText: null,
    materialText: null,
    fitText: null,
    ageRangeText: null,
    sizeLabels: [],
    audienceSignals: [],
    imageUrls: [],
    description: null,
    ...over,
  } as ProductFacts;
}

const ORIGIN = facts({ brand: "Bobo Choses", brandModelCode: "B226AC009" });

/* ════════════════ A. 1차 식별 신호 — 「브랜드 «그리고» 품번」 ════════════════ */

describe("A. 1차 식별 신호는 두 축을 «둘 다» 요구한다 (§5-D 의 「100%」 정의)", () => {
  it("A-1 브랜드 호환 + 품번 exact ⟹ 신호가 선다", () => {
    expect(hasPrimaryIdentitySignal(ORIGIN, facts({ brand: "BOBO CHOSES", brandModelCode: "b226ac009" }))).toBe(true);
  });

  it("A-2 🔴 품번이 exact 라도 브랜드가 다르면 서지 않는다", () => {
    expect(hasPrimaryIdentitySignal(ORIGIN, facts({ brand: "Konges Sløjd", brandModelCode: "B226AC009" }))).toBe(false);
  });

  it("A-3 🔴 브랜드만 같고 품번이 **부분** 일치면 서지 않는다 — 「품번처럼 보이는 문자열 하나」 금지", () => {
    // B226AC009 ↔ B226AC010 — 앞자리를 공유하지만 다른 상품이다(compareModelCode 가 conflict/partial 로 가른다).
    expect(hasPrimaryIdentitySignal(ORIGIN, facts({ brand: "Bobo Choses", brandModelCode: "B226AC010" }))).toBe(false);
  });

  it("A-4 🔴 품번 칸이 비면 서지 않는다 — 「모른다」를 「일치」로 읽지 않는다", () => {
    expect(hasPrimaryIdentitySignal(ORIGIN, facts({ brand: "Bobo Choses", brandModelCode: null }))).toBe(false);
    expect(hasPrimaryIdentitySignal(facts({ brand: "Bobo Choses" }), facts({ brand: "Bobo Choses" }))).toBe(false);
  });

  it("A-5 🔴 브랜드 칸이 비면 서지 않는다(브랜드 단독·품번 단독 승격 금지)", () => {
    expect(hasPrimaryIdentitySignal(ORIGIN, facts({ brand: null, brandModelCode: "B226AC009" }))).toBe(false);
  });

  it("A-6 facts 자체가 없으면 false 다(측정 근거가 없다)", () => {
    expect(hasPrimaryIdentitySignal(undefined, facts({ brand: "Bobo Choses", brandModelCode: "B226AC009" }))).toBe(
      false,
    );
    expect(hasPrimaryIdentitySignal(ORIGIN, undefined)).toBe(false);
  });

  it("A-7 🔴🔴 **판매처 자신의 재고번호는 신호가 아니다** — SPRINT 1 라이브의 그 모양", () => {
    /**
     * 실측(2026-11-16 looxloo): 후보 5건의 품번이 전부 `76A7D-xxx-xx` = 판매처 자체 SKU 이고
     * `facts.brandModelCode` 는 **null** 이었다. 그 값을 품번 칸으로 올리면 1차 식별이 거짓으로 선다.
     */
    const looxloo = facts({ brand: "BOBO CHOSES", brandModelCode: null, sellerSku: "76A7D-415-02" });
    expect(hasPrimaryIdentitySignal(ORIGIN, looxloo)).toBe(false);
    const originWithSameSellerSku = facts({ brand: "Bobo Choses", brandModelCode: null, sellerSku: "76A7D-415-02" });
    expect(hasPrimaryIdentitySignal(originWithSameSellerSku, looxloo)).toBe(false);
  });

  it("A-8 후보 묶음을 세면 신호가 선 것만 센다", () => {
    const candidates = [
      { url: "u1", facts: facts({ brand: "Bobo Choses", brandModelCode: "B226AC009" }) },
      { url: "u2", facts: facts({ brand: "Bobo Choses", brandModelCode: "B226AC010" }) },
      { url: "u3", facts: undefined },
    ] as unknown as ComparisonCandidate[];
    expect(countPrimaryIdentitySignals(ORIGIN, candidates)).toBe(1);
    expect(countPrimaryIdentitySignals(undefined, candidates)).toBe(0);
  });
});

/* ════════════════════ B. 수집기 — 칸별 기록과 요약 ════════════════════ */

function record(over: Partial<DomesticStageRecord>): DomesticStageRecord {
  return {
    shopId: "shop-a",
    domain: "a.example.com",
    termIndex: 0,
    term: "질의",
    providerCalls: 1,
    newCandidates: 0,
    primaryIdentityHits: 0,
    verification: {
      detailPage: 0,
      listingPage: 0,
      unknownShape: 0,
      withImage: 0,
      imageUnavailable: 0,
      priceConfirmed: 0,
    },
    elapsedMs: 10,
    stoppedAfter: false,
    ...over,
  };
}

describe("B. 수집기는 칸별 기록을 보존하고 합계를 «파생» 한다", () => {
  it("B-1 관측자가 부른 기록이 그대로 쌓인다", () => {
    const c = createDomesticStageCollector();
    c.observer(record({ termIndex: 0 }));
    c.observer(record({ termIndex: 1 }));
    expect(c.records.map((r) => r.termIndex)).toEqual([0, 1]);
  });

  it("B-2 providerCalls 는 합계이고 alias 폴백의 2회도 포함된다", () => {
    const c = createDomesticStageCollector();
    c.observer(record({ termIndex: 0, providerCalls: 1 }));
    c.observer(record({ termIndex: null, providerCalls: 2 }));
    expect(c.summary().providerCalls).toBe(3);
  });

  it("B-3 🔴 `stagesUsed` 는 **사다리 칸만** 센다 — alias 폴백(null)은 단계가 아니다", () => {
    const c = createDomesticStageCollector();
    c.observer(record({ termIndex: 0 }));
    c.observer(record({ termIndex: 1 }));
    c.observer(record({ termIndex: null }));
    expect(c.summary().stagesUsed).toBe(2);
  });

  it("B-4 멈춘 샵은 **샵 단위로 한 번** 센다(같은 샵의 여러 기록을 두 번 세지 않는다)", () => {
    const c = createDomesticStageCollector();
    c.observer(record({ shopId: "s1", termIndex: 0, stoppedAfter: false }));
    c.observer(record({ shopId: "s1", termIndex: 1, stoppedAfter: true }));
    c.observer(record({ shopId: "s2", termIndex: 0, stoppedAfter: true }));
    c.observer(record({ shopId: "s3", termIndex: 0, stoppedAfter: false }));
    expect(c.summary().shopsStoppedEarly).toBe(2);
  });

  it("B-5 1차 식별 신호 합계와 소요시간 합계가 기록에서 파생된다", () => {
    const c = createDomesticStageCollector();
    c.observer(record({ primaryIdentityHits: 2, elapsedMs: 100 }));
    c.observer(record({ primaryIdentityHits: 1, elapsedMs: 250 }));
    expect(c.summary().primaryIdentityHits).toBe(3);
    expect(c.summary().elapsedMsTotal).toBe(350);
  });

  it("B-6 기록이 없으면 전부 0 이다 — 🔴 그 0 을 「요청 0」으로 쓰는 쪽이 `null` 로 가른다", () => {
    expect(createDomesticStageCollector().summary()).toEqual({
      providerCalls: 0,
      stagesUsed: 0,
      primaryIdentityHits: 0,
      shopsStoppedEarly: 0,
      elapsedMsTotal: 0,
      candidates: 0,
      verification: {
        detailPage: 0,
        listingPage: 0,
        unknownShape: 0,
        withImage: 0,
        imageUnavailable: 0,
        priceConfirmed: 0,
      },
    });
  });
});

/* ══════ F. 「검색 결과가 나왔다」 ≠ 「정상적인 상품 발견」 (CPO 2026-11-16) ══════ */

describe("F. 검증 분리 — 후보 수와 통과 수를 같은 숫자로 적지 않는다", () => {
  function cand(url: string, over: Partial<ComparisonCandidate> = {}): ComparisonCandidate {
    return { url, title: "t", price: null, confidence: 0, ...over } as unknown as ComparisonCandidate;
  }

  it("F-1 🔴 목록/브랜드 페이지는 **상세 발견으로 세지 않는다**", () => {
    const v = verifyDomesticCandidates([
      cand("https://shop.example.com/products/hidden-monster-sweatshirt-b226ac038"),
      cand("https://shop.example.com/collections/bobo-choses"),
    ]);
    expect(v.detailPage).toBe(1);
    expect(v.listingPage).toBe(1);
  });

  it("F-2 🔴 이미지가 없으면 **검증 불가** 로 따로 남는다(「오류」가 아니다)", () => {
    const v = verifyDomesticCandidates([
      cand("https://shop.example.com/products/a", { imageUrl: "https://img.example.com/a.jpg" }),
      cand("https://shop.example.com/products/b"),
    ]);
    expect(v.withImage).toBe(1);
    expect(v.imageUnavailable).toBe(1);
  });

  it("F-3 가격은 `VERIFIED_CURRENT` 만 통과로 센다", () => {
    const v = verifyDomesticCandidates([
      cand("https://shop.example.com/products/a", { priceStatus: "VERIFIED_CURRENT" }),
      cand("https://shop.example.com/products/b", { priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    expect(v.priceConfirmed).toBe(1);
  });

  it("F-4 🔴🔴 후보 수와 통과 수가 **다른 칸** 이다 — 합계가 후보 수와 같지 않을 수 있다", () => {
    const c = createDomesticStageCollector();
    const list = [
      cand("https://shop.example.com/collections/x"),
      cand("https://shop.example.com/collections/y"),
    ];
    c.observer(record({ newCandidates: list.length, verification: verifyDomesticCandidates(list) }));
    const s = c.summary();
    expect(s.candidates).toBe(2);
    expect(s.verification.detailPage).toBe(0);
    expect(s.verification.listingPage).toBe(2);
  });

  it("F-5 🔴 이 함수는 **판정하지 않는다** — 판정 어휘를 만들지 않는다", () => {
    expect(METRICS_CODE).not.toContain("verdict");
    expect(METRICS_CODE).not.toContain("SAME");
  });

  it("F-6 링크 모양 판별 owner 는 **기존 함수 하나** 다(규칙 복제 금지)", () => {
    expect(METRICS_CODE).toContain("classifyUrlShape(c.url)");
    expect(METRICS_CODE).not.toMatch(/\/collections\/|\/category\/|goods_list/);
  });

  it("F-7 사다리가 **한 자리에서** 센다 — 숫자를 인자로 받지 않는다", () => {
    expect(SEARCH_CODE).toMatch(/verification: verifyDomesticCandidates\(counted\)/);
    expect(SEARCH_CODE).toMatch(/newCandidates: counted\.length/);
  });

  it("F-8 운영 로그가 칸별 검증을 **그대로** 싣는다", () => {
    const log = RUNNER_CODE.slice(RUNNER_CODE.indexOf("[SPRINT2-stage]"));
    expect(log).toContain("verify: r.verification");
  });
});

/* ════════════════════ C. 배선 — 관측자가 «실제로» 꽂혀 있다 ════════════════════ */

describe("C. 배선 (행동 축이 못 보는 자리 — 소스 앵커로 잠근다)", () => {
  it("C-1 사다리가 관측자를 선택 인자로 받고 샵 루프가 그것을 넘긴다", () => {
    expect(SEARCH_CODE).toMatch(/observer\?:\s*DomesticStageObserver/);
    expect(SEARCH_CODE).toMatch(/searchOneDomesticShop\(source,\s*query,\s*observer\)/);
  });

  it("C-2 🔴 운영 러너가 **두 검색 모두** 에 같은 수집기를 넘긴다(P0 에서 끝났는지 알 수 있어야 한다)", () => {
    expect(RUNNER_CODE).toContain("createDomesticStageCollector()");
    /**
     * 🔴 `[^)]*` 로 쓰면 **0 건** 이 된다 — 인자 안에 `p0Sources.map(toRef)` 의 닫는 괄호가
     *    있어서 그 문자군이 넘어가지 못한다. 내 1차 단언이 그렇게 틀렸다(코드는 맞았다).
     */
    const passes = RUNNER_CODE.match(/searchDomesticShops\(query,[\s\S]{0,120}?stageCollector\.observer\)/g) ?? [];
    expect(passes.length).toBe(2);
  });

  it("C-3 🔴 CEO 완료 조건 세 칸이 로그에 실린다 — 검색 요청 · 상세 요청 · 소요 시간", () => {
    const log = RUNNER_CODE.slice(RUNNER_CODE.indexOf("[SPRINT2-stage]"));
    /**
     * 🔴 로그는 요약 객체를 **펼쳐서** 싣는다 — 그래서 칸 이름이 로그 문장에 글자로
     *    없다(내 1차 단언이 그것을 몰랐다). 두 줄로 갈라 잠근다:
     *    ⒜ 로그가 그 객체를 펼친다  ⒝ 그 객체가 상세 요청 칸을 **실제로** 들고 있다
     */
    expect(log).toContain("...domesticStageMetrics");
    expect(RUNNER_CODE).toContain("detailModelCodeFetches: domesticModelCodeFetchCount");
    expect(METRICS_CODE).toContain("providerCalls");
    expect(METRICS_CODE).toContain("elapsedMs");
  });

  it("C-4 🔴 상세 요청 수는 **판정 루프 뒤** 에 읽는다 — 검색 직후면 항상 0 이다", () => {
    expect(RUNNER_CODE.indexOf("domesticModelCodeFetchCount += 1")).toBeLessThan(
      RUNNER_CODE.indexOf("detailModelCodeFetches: domesticModelCodeFetchCount"),
    );
  });

  it("C-5 🔴 칸별 기록을 합계로 뭉개지 않는다(어느 단계에서 멈췄는지가 사라진다)", () => {
    const log = RUNNER_CODE.slice(RUNNER_CODE.indexOf("[SPRINT2-stage]"));
    expect(log).toContain("records:");
    expect(log).toContain("stopped: r.stoppedAfter");
  });

  it("C-6 🔴 P0 기록 수와 그 뒤 기록 수를 **합산하지 않는다**", () => {
    expect(RUNNER_CODE).toContain("p0Records: p0StageRecordCount");
    expect(RUNNER_CODE).toMatch(/laterRecords:\s*stageCollector\.records\.length\s*-\s*p0StageRecordCount/);
  });

  it("C-7 1차 식별 신호는 **점수를 매긴 뒤** 센다(날것 후보엔 facts 가 없다)", () => {
    /**
     * 🔴 세는 자리가 `emit` 안으로 들어갔다(검증 분리 때 한 자리로 모았다). 그래서
     *    단언을 **「무엇을 emit 에 넘기는가」** 로 옮긴다 — 성질은 그대로다:
     *    판정 가능 분기는 `withConfidence` 를 통과한 `added` 를 넘겨야 한다.
     */
    expect(SEARCH_CODE).toMatch(/countPrimaryIdentitySignals\(query\.facts,\s*counted\)/);
    expect(SEARCH_CODE).toContain("emit(added, confirmedExternalSame)");
    const judged = SEARCH_CODE.slice(
      SEARCH_CODE.indexOf("const added: ComparisonCandidate[]"),
      SEARCH_CODE.indexOf("if (confirmedExternalSame) break;"),
    );
    expect(judged.length).toBeGreaterThan(0);
    /** 🔴 판정 가능 분기에서 **날것(`got`)을 세면** FAIL 이다(하위호환 분기는 그래도 된다). */
    expect(judged).not.toContain("emit(got");
  });
});

/* ══════════ D. 금지 — 관측 신호가 «판정» 으로 승격되지 않는다 (CPO 명시) ══════════ */

describe("D. 1차 식별 신호는 판정 축이 아니다", () => {
  it("D-1 🔴 계측 모듈이 판정 owner 를 import 하지 않는다", () => {
    expect(METRICS_CODE).not.toContain("judgeDomesticCandidate");
    expect(METRICS_CODE).not.toContain("match-truth");
    expect(METRICS_CODE).not.toContain("priceTierFromLink");
  });

  it("D-2 🔴 계측 모듈이 판정 어휘를 «만들지» 않는다", () => {
    expect(METRICS_CODE).not.toContain("PRESUMED_SAME");
    expect(METRICS_CODE).not.toContain("crossSellerVerdict");
  });

  it("D-3 🔴 운영 러너가 그 신호 함수를 **부르지 않는다**(기록은 사다리가 한다)", () => {
    expect(RUNNER_CODE).not.toContain("hasPrimaryIdentitySignal");
    expect(RUNNER_CODE).not.toContain("countPrimaryIdentitySignals");
  });

  it("D-4 🔴🔴 그 신호가 **조기 종료 조건에 들어가지 않는다**(CPO: 충족으로 간주 금지)", () => {
    const gate = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf("const foundVeryHighInP0"),
      RUNNER_CODE.indexOf("const overseasAuto ="),
    );
    expect(gate.length).toBeGreaterThan(0);
    expect(gate).not.toContain("primaryIdentityHits");
    expect(gate).not.toContain("stageCollector.summary");
  });

  it("D-5 🔴 사다리를 멈추는 조건은 여전히 **SAME verdict 하나** 이고 관측자가 끼지 않는다", () => {
    const stop = SEARCH_CODE.slice(
      SEARCH_CODE.indexOf("const confirmedExternalSame"),
      SEARCH_CODE.indexOf("if (confirmedExternalSame) break;"),
    );
    expect(stop).toContain('crossSellerVerdict === "SAME"');
    expect(stop).toContain("isSelfReferenceCandidate");
    expect(stop).not.toContain("PRESUMED_SAME");
    expect(stop).not.toContain("SIMILAR");
    expect(stop).not.toContain("observer");
    expect(stop).not.toContain("primaryIdentityHits");
  });
});

/* ══════════ E. 보존 — P0/P1 구조와 WU-095 를 되살리지도 지우지도 않는다 ══════════ */

describe("E. 기존 구조 보존 (CPO 구현 방향 ⑤)", () => {
  it("E-1 P0 우선 검색 → 조건부 나머지 검색 구조가 그대로다", () => {
    expect(RUNNER_CODE).toContain("const p0Sources = allSources.filter((s) => s.priority === \"P0\")");
    expect(RUNNER_CODE).toMatch(/otherSources\.length > 0 && !foundVeryHighInP0/);
  });

  it("E-2 🔴 `foundVeryHighInP0` 의 조건을 **바꾸지 않았다** — WU-095 는 의도된 수정이다", () => {
    expect(RUNNER_CODE).toMatch(/foundVeryHighInP0 =[\s\S]{0,160}matchLevel === "very_high"/);
  });

  it("E-3 🔴 그 가드를 SAME/판정 어휘로 **갈아끼우지 않았다**(되살리기 금지)", () => {
    const line = RUNNER_CODE.slice(
      RUNNER_CODE.indexOf("const foundVeryHighInP0"),
      RUNNER_CODE.indexOf("const otherResults"),
    );
    expect(line).not.toContain("crossSellerVerdict");
    expect(line).not.toContain("judgement");
  });

  it("E-4 관측자는 **선택** 이다 — 기존 호출부가 안 넘겨도 타입이 선다", () => {
    expect(SEARCH_CODE).toMatch(/sources: DomesticSourceRef\[\],\s*observer\?: DomesticStageObserver,/);
  });

  it("E-5 🔴 alias 폴백의 **두 번째 호출 조건** 을 글자 그대로 보존했다", () => {
    expect(SEARCH_CODE).toMatch(/if \(fallback\.length === 0 && color\)/);
  });
});
