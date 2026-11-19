/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **범용 시장 데이터 확보 역량 평가 + 통합 안정화 진입 준비**(평가 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 HTTP 0 · DB 0 · GT 0 · verdict 재계산 0 · 가격 측정 0(G6 동결 유지) ·
 *    운영 코드·API·UI 0 · schema 0 · 기존 산출물 **덮어쓰기 0** · 새 WU 0 · **구현 0**.
 * 🔴 **같은 조사를 반복하지 않는다** — ⑤⑥ · C · A · ③ · ① · ② · G8 산출물을 **읽는다**.
 * 🔴 **특정 사이트 전용 개선을 만들지 않는다** — 후보에 사이트 어휘가 들어가면 FAIL(U-6).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const SRC = path.join(process.cwd(), "src");
const read = (f: string) => JSON.parse(readFileSync(path.join(HERE, "preserved", f), "utf8"));
const code = (rel: string) =>
  readFileSync(path.join(SRC, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const OUT = path.join(HERE, "preserved", "kids-mi-universal-readiness.json");

/* ═══════════════ 작업 C — 가격 노출 구조(코드 근거) ═══════════════ */

describe("작업 C — 시장 가격 노출 구조 확인(측정 0 · 동결 유지)", () => {
  it("U-1 🟢 가격 **표시 자격** owner 가 하나이고 검증된 값만 숫자를 낸다", () => {
    const src = code(path.join("lib", "price-truth.ts"));
    expect(src).toContain('priceStatus === "VERIFIED_CURRENT" && price != null');
    /** 🔴 세 상태가 그대로다 — 「모른다」를 숫자로 만들지 않는다. */
    for (const s of ["VERIFIED_CURRENT", "UNVERIFIED_SEARCH", "PRICE_UNAVAILABLE"]) {
      expect(src).toContain(s);
    }
  });

  /**
   * 🔴🔴 **동일상품 금액 자격 집합이 「유사」를 포함하지 않는다** — 이것이
   *    「동일 ↔ 유사 가격 구분」의 코드 근거다. 🔴 집합을 넓히는 것은 **가격 정책** 이다.
   */
  it("U-2 🔴🔴 금액 자격 = SAME + PRESUMED_SAME 뿐이다(SIMILAR·CONFLICT·UNKNOWN 없음)", () => {
    const src = code(path.join("lib", "price-eligible-verdicts.ts"));
    expect(src).toContain("SAME");
    expect(src).toContain("PRESUMED_SAME");
    for (const excluded of ["SIMILAR", "CONFLICT", "UNKNOWN"]) {
      expect(src, `🔴 ${excluded} 금액이 동일상품 가격에 섞이면 비교가 거짓이 된다`).not.toContain(
        `"${excluded}"`,
      );
    }
  });

  it("U-3 🟢 환산은 **단일 FX** 이고 환율이 없으면 **null** 이다(추측 환율 0)", () => {
    const src = code(path.join("lib", "price-truth.ts"));
    expect(src).toContain("krwRates?.[currency]");
    expect(src).toContain("rate ? Math.round(amount * rate) : null");
    /** 🟢 근거(기준 환율)를 **같이** 낸다 — 숫자만 던지지 않는다. */
    expect(src).toContain("computeFxLine");
  });

  it("U-4 🟢 **부족 상태를 표현할 어휘** 가 있다(가격·재고·표본 수)", () => {
    const src = code(path.join("app", "pipeline", "commerce", "mi-same-candidates.ts"));
    expect(src).toContain("가격 확인 필요");
    /** 🟢 결론이 네 상태로 갈린다 — 「없음」을 한 글자로 뭉개지 않는다. */
    for (const v of ["NO_SAME", "SAME_BUT_NONE_ON_SALE", "ON_SALE_NO_PRICE", "ON_SALE"]) {
      expect(src, `🔴 ${v} 가 사라지면 부족 상태가 성공처럼 보인다`).toContain(v);
    }
    /** 🟢 표본 1건을 「가격대」로 적지 않는다. */
    expect(src).toContain("SINGLE");
    expect(src).toContain("RANGE");
  });

  /**
   * 🔴🔴🔴 **「AI 가 판매가를 결정하는 구조가 없다」로 단정하지 않는다.**
   *    추천가 **칸은 존재한다**(`recommendedPrice` · `estimatedMarginPercent`).
   * 🟢 그러나 그 성질은 **원가 역산(A축)** 이고 **근거가 없으면 `null`** 이며,
   *    시장 가격(B축)을 평균해 「적정가」를 만드는 구조가 **아니다**.
   */
  it("U-5 🟡 추천가 칸은 **있고** 근거 없으면 null 이며 「시장 평균/적정가」가 아니다", () => {
    const panel = code(path.join("app", "pipeline", "commerce", "DomesticPriceIntelligencePanel.tsx"));
    expect(panel, "🔴 칸이 사라지면 이 기록을 갱신한다").toContain("recommendedPrice");
    const raw = readFileSync(
      path.join(SRC, "app", "pipeline", "commerce", "DomesticPriceIntelligencePanel.tsx"),
      "utf8",
    );
    /** 🟢 「억지 추천가를 만들지 않는다」가 **문서로** 고정돼 있다. */
    expect(raw).toContain("억지 추천가");
    /** 🔴 시장 가격 블록은 그 말을 **쓰지 않는다**(라벨 owner 가 분리돼 있다). */
    const market = code(path.join("app", "pipeline", "commerce", "MarketPriceComparison.tsx"));
    expect(market, "🔴 시장 블록이 적정가를 말하면 셀러 판단을 대체한다").not.toContain("적정가 ");
  });
});

/* ═══════════════ 작업 A·B·D — 산출물 통합 ═══════════════ */

describe("작업 A·B·D — 범용성 평가와 진입 준비(기존 산출물 재사용)", () => {
  it("U-6 🔵 범용 후보·단계표·진입 상태를 통합 산출한다(사이트 어휘 0)", () => {
    const flow = read("kids-flow-verification.json") as { stages: { stage: string; status: string }[] };
    const strat = read("kids-identity-strategy-stabilization.json") as {
      strategy: Record<string, unknown>;
      stabilizable: string[];
      needsMoreEvidence: string[];
    };
    const c = read("c-candidate-quality.json") as { buckets: Record<string, number> };
    const a = read("a-identity-axis.json") as {
      denominator: Record<string, unknown>;
      axisTally: Record<string, Record<string, number>>;
    };
    const entry = read("kids-mi-stabilization-entry.json") as {
      entryGates: { id: string; met: boolean; owner: string }[];
      entryVerdict: { decision: string; met: number; unmet: number };
    };
    const g8 = read("g8-baseline-cause.json") as { causeTally: Record<string, number> };
    const g8b = read("g8-join-host-integrity.json") as { hostTally: Record<string, unknown>; ctoVerdict: string };
    const a22 = read("a22-candidate-descriptions.json") as { attempted: number; reached: number; withDescription: number };

    /**
     * 🔴 **범용 ↔ 사이트 한정 ↔ 분류 불가** 를 가른다(CPO §7-B).
     * 🔴 사이트 이름은 **사례 설명에만** 쓰고 개별 과제로 승격하지 않는다.
     */
    const problems = {
      universal: [
        {
          id: "P1 후보 품번 부재",
          evidence: `품질 버킷 QUALITY_NO_CODE ${c.buckets.QUALITY_NO_CODE}건 · **17 호스트**`,
          repeatedAcrossHosts: true,
          knownLever: "제목 토큰 승격 — 🔴 REJECT(false SAME · 되돌린 선례 있음)",
        },
        {
          id: "P2 수집 접근 제한(4xx·타임아웃)",
          evidence: `A22 실측 시도 ${a22.attempted} → 도달 ${a22.reached} · 실패 **12 호스트**`,
          repeatedAcrossHosts: true,
          knownLever: "🟢 사유 반환은 구현됨(⑤⑥) · 🔴 우회는 금지",
        },
        {
          id: "P3 식별 축의 UNKNOWN 지배",
          evidence: `축 UNKNOWN — brand ${a.axisTally.brand.UNKNOWN} · name ${a.axisTally.productName.UNKNOWN} / 26`,
          repeatedAcrossHosts: true,
          knownLever: "🔴 「모른다」는 완화 대상이 아니다 — 입력 확보 축이다",
        },
        {
          id: "P4 평가 산출물의 조인 키 소실",
          evidence: "C 산출물에 `originCode` 없음 · 호스트 축 3종(도메인 24 / URL 26 / 정규화 25)",
          repeatedAcrossHosts: true,
          knownLever: "🟢 산출 시 키·URL 축 보존(이미 A·G8 에 적용)",
        },
        {
          id: "P5 라벨 truth 버전 혼재",
          evidence: "fixture `humanGt` 가 대체 전 라벨 · 갱신 2건(① 에서 정정)",
          repeatedAcrossHosts: true,
          knownLever: "🟢 최신 truth 를 분리 보존(① 산출물)",
        },
      ],
      siteSpecific: [
        {
          id: "S1 단일 호스트 설명문 부재",
          evidence: "A22 에서 도달했으나 설명문 없음 **1건 · 1 호스트**",
          note: "🔴 반복 없음 ⟹ **패스**(개별 과제로 승격하지 않는다)",
        },
      ],
      unclassifiable: [
        {
          id: "X1 baseline 미재현 1건의 원인",
          evidence: "생산지 입력이 `os.tmpdir()` 에 있었고 부재 · 확정엔 DB 필요(금지)",
          note: "🔴 **UNKNOWN 보존** — 추정으로 확정하지 않는다",
        },
        {
          id: "X2 간헐 회귀 실패 1회",
          evidence: "직전 WU 에서 1회 관측 · 파일명 미포착 · 이후 재현 0",
          note: "🔴 「없었다」로 적지 않는다",
        },
      ],
    };

    /** 🔴 후보 평가 — 여섯 기준(CPO §3). 🔴 구현은 하지 않는다(승인 전). */
    const candidates = [
      {
        id: "C1 평가 산출물의 조인 키·호스트 축 표준화",
        reusability: "HIGH — 모든 상품군·호스트에 같은 방식",
        categoryScalability: "HIGH",
        marketDataContribution: "INDIRECT — 데이터가 늘지 않지만 **숫자가 정확해진다**",
        identityReliability: "NEUTRAL",
        operationalSafety: "HIGH — HTTP·DB 0",
        sellerValue: "INDIRECT — 잘못된 집계로 판단을 흐리지 않는다",
        frozenConflict: "없음",
        neededEvidence: "없음(이미 실측)",
        ifNotDone: "🔴 호스트 수·분모가 보고마다 달라진다(실제로 내 ③ 보고를 정정했다)",
        implementNow: false,
      },
      {
        id: "C2 수집 실패 사유의 «운영» 발화 확인",
        reusability: "HIGH — 모든 PLAIN_HTML 후보",
        categoryScalability: "HIGH",
        marketDataContribution: "HIGH — 「막힌 것」과 「없는 것」을 가르면 재시도 대상이 정해진다",
        identityReliability: "NEUTRAL",
        operationalSafety: "HIGH — 우회 0(이미 계약으로 잠김)",
        sellerValue: "MEDIUM — 왜 가격이 없는지 설명할 수 있다",
        frozenConflict: "없음",
        neededEvidence: "🔴 **CEO 1회 수행**(G5 와 동일 작업으로 같이 닫힌다)",
        implementNow: false,
      },
      {
        id: "C3 후보측 식별 정보 «확보» 경로 확대(추출 아님)",
        reusability: "HIGH",
        categoryScalability: "HIGH",
        marketDataContribution: "HIGH — 품번 부재 83건이 지배 병목이다",
        identityReliability: "🔴 위험 — 승격형 접근은 false SAME(REJECT 선례)",
        operationalSafety: "조건부 — 추가 HTTP 없이 가능한 범위만",
        sellerValue: "HIGH",
        frozenConflict: "🔴 **있다** — 제목 토큰 승격·상세설명 연결은 **거부된 레버**",
        neededEvidence: "🔴 **GT 라벨 보강**(CEO) — 지금 분모로는 안전성을 가를 수 없다",
        implementNow: false,
      },
      {
        id: "C4 가격 부족 상태의 셀러 표현 보강",
        reusability: "HIGH",
        categoryScalability: "HIGH",
        marketDataContribution: "NONE — 데이터가 늘지 않는다",
        identityReliability: "NEUTRAL",
        operationalSafety: "HIGH",
        sellerValue: "MEDIUM — 「가격 확인 필요」의 **이유** 를 말할 수 있다",
        frozenConflict: "🔴 **있다** — 가격 표시 축은 **G6 동결** 이다",
        neededEvidence: "동결 해제 판단(CPO)",
        implementNow: false,
      },
    ];

    const out = {
      note:
        "🔴 평가·우선순위 도출 전용 — **구현 0** · HTTP 0 · DB 0 · 가격 측정 0(G6 동결) · " +
        "덮어쓰기 0. 🔴 특정 사이트 전용 개선은 후보에서 **제외** 했다.",
      engine: {
        stages: flow.stages.map((s) => ({ stage: s.stage, status: s.status })),
        strategy: strat.strategy,
        candidateQuality: c.buckets,
        identityAxis: { denominator: a.denominator, axisTally: a.axisTally },
        collection: { attempted: a22.attempted, reached: a22.reached, withDescription: a22.withDescription },
      },
      priceExposureStructure: {
        displayGate: "`isPriceDisplayable` — **VERIFIED_CURRENT && price != null**(owner 하나)",
        sameVsSimilar:
          "🟢 **구분된다** — 금액 자격 집합이 `SAME`+`PRESUMED_SAME` 뿐이고 `SIMILAR`·`CONFLICT`·`UNKNOWN` 은 **없다**",
        provenance: "🟢 `priceStatus` 3상태 + `priceSource`(detail) + 통화 분리 · 환산은 단일 FX · 없으면 null",
        comparability: "🟢 `priceTier`(EXACT/COMPARISON) 로 적재 · `EXCLUDED` 는 금액에서 제외",
        marketBand: "🟢 `basis` **SINGLE ↔ RANGE** — 1건을 「가격대」로 적지 않는다",
        insufficiency: "🟢 「가격 확인 필요」 · verdict 4상태 · 재고 UNKNOWN 을 판매중으로 세지 않는다",
        autoPricing:
          "🟡 **추천가 칸은 존재한다**(`recommendedPrice`·`estimatedMarginPercent`) — 🟢 그 성질은 " +
          "**원가 역산(A축)** 이고 **근거 없으면 null** 이다. 🔴 시장 가격을 평균해 「적정가」를 " +
          "만드는 구조는 **없다**(시장 블록이 그 어휘를 쓰지 않는다) ⟹ 🔴 「AI 자동 결정 구조 0」으로 " +
          "**단정하지 않고** 위와 같이 적는다",
        measuredHere: false,
      },
      problems,
      candidates,
      entryStatus: {
        verdict: entry.entryVerdict,
        gates: entry.entryGates.map((g) => ({ id: g.id, met: g.met, owner: g.owner })),
        g8: { causeTally: g8.causeTally, ctoVerdict: g8b.ctoVerdict },
        unchangedByThisWu: true,
      },
      ctoProposal:
        "🔴 **②번 — 범용 개선 후보 발견 · CPO 승인 후 별도 실행 필요.** 🔴 동시에 **③번(진입 불가)** 도 " +
        "유효하다 — G5·G7 은 CEO · G6 은 동결 · G8 은 부분 충족이다. 🔴 네 후보 중 **지금 구현 가능한 것은 0** 이다",
      stabilizable: strat.stabilizable.length,
      needsMoreEvidence: strat.needsMoreEvidence.length,
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🔴🔴 **범용 후보에 사이트 어휘가 없다** — 들어가면 전략 위반이다. */
    const blob = JSON.stringify({ u: problems.universal, c: candidates }).toLowerCase();
    for (const site of ["smallable", "trenbe", "tinyapple", "luxboy", "junioredition", "biskuit", "donokids"]) {
      expect(blob, `🔴 ${site} — 범용 후보가 사이트 전용이 됐다`).not.toContain(site);
    }
    /** 🔴 **구현하지 않았다** — 네 후보 전부 `implementNow: false`. */
    expect(candidates.every((x) => x.implementNow === false)).toBe(true);
    /** 🟢 셋으로 갈렸고 **어느 묶음도 비어 있지 않다**. */
    expect(problems.universal.length).toBeGreaterThan(0);
    expect(problems.siteSpecific.length).toBeGreaterThan(0);
    expect(problems.unclassifiable.length).toBeGreaterThan(0);
  });

  it("U-7 🔴 G1~G8 상태를 **임의로 바꾸지 않았다**", () => {
    const o = read("kids-mi-universal-readiness.json") as {
      entryStatus: { verdict: { decision: string; met: number; unmet: number }; gates: { owner: string; met: boolean }[] };
      priceExposureStructure: { measuredHere: boolean };
    };
    expect(o.entryStatus.verdict.decision).toBe("CANNOT_ENTER_YET");
    expect(o.entryStatus.verdict.met).toBe(4);
    expect(o.entryStatus.verdict.unmet).toBe(4);
    /** 🔴 미충족 중 **CEO 둘 · 동결 하나 · CTO 하나** — 그 구성이 바뀌면 FAIL 한다. */
    const unmet = o.entryStatus.gates.filter((g) => !g.met);
    expect(unmet.filter((g) => g.owner === "CEO")).toHaveLength(2);
    expect(unmet.filter((g) => g.owner === "FROZEN_BY_POLICY")).toHaveLength(1);
    /** 🟢 가격은 이 WU 에서 **측정하지 않았다**(G6 동결 유지). */
    expect(o.priceExposureStructure.measuredHere).toBe(false);
  });

  it("U-8 🔴 기존 산출물을 **덮어쓰지 않았다** · 금지 경계 0", () => {
    const self = readFileSync(path.join(HERE, "kids-mi-universal-readiness.test.ts"), "utf8");
    for (const victim of ["c-candidate", "a-identity", "g8-", "kids-flow", "kids-identity", "a22-", "fixtures", "MI-KIDS"]) {
      expect(new RegExp(`writeFileSync\\([^)]*${victim}`).test(self), `🔴 ${victim} 덮어쓰기 금지`).toBe(false);
    }
    const bare = self.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["fetchPlain", "Html"],
      ["judgeDomestic", "Candidate"],
      ["SAME", "_MIN_AXES ="],
      ["UA_", "POOL"],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(bare, `🔴 ${token} — 평가 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
