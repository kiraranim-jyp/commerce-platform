/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **국내 후보 0건 — 발견·확보 경로 «범용» 분석**(평가 전용 · HTTP 0 · DB 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **문제 정의를 CPO 문장으로 고정한다**:
 *    「국내 판매처가 **없는 것이 아니다**. 실제 국내 판매처가 존재하는데 현재 MI 가
 *     그 판매처들을 **후보로 확보하지 못한 것**이다.」 ⟹ 두 문제는 **다르다**.
 *
 * 🔴 `B226AC033` 은 **진단 사례로만** 쓴다 · 특정 사이트 대응 **금지** · **구현 0**.
 * 🔴 CASE-01 조사를 **되풀이하지 않는다** — 그쪽은 **② 수집 단계** 를 닫았고
 *    이 분석은 그 **상류(① 발견·후보 확보)** 만 본다.
 * 🔴 HTTP 0 · DB 0 · GT 0 · verdict 재계산 0 · 가격 측정 0(G6 동결) · 운영 변경 0 ·
 *    SAME 기준 0 · 어댑터 0 · 덮어쓰기 0 · 새 WU 0.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const ROOT = path.join(process.cwd(), "..", "..");
/** 🔴 주석을 **벗긴다** — 주석 속 설명을 「구현됐다」로 세지 않는다. */
const bare = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const CRAWLER = (f: string) => path.join(ROOT, "packages", "crawler", "src", f);
const LIB = (f: string) => path.join(HERE, "..", f);
const OUT = path.join(HERE, "preserved", "domestic-discovery-gap.json");

describe("국내 발견 경로 — 범용 분석(구현 0)", () => {
  /* ═══════ ① 국내 후보를 만드는 «생산자 전수» ═══════ */

  it("D-1 🔵 국내 후보 생산자를 **전수** 고정한다(일시 5 + 등록부 1)", () => {
    const src = bare(LIB("transient-candidates.ts"));
    for (const id of [
      "__url_candidates__",
      "__gemini_discovery__",
      "__overseas_auto__",
      "__domestic_listing__",
      "__web_search__",
    ]) {
      expect(src, `🔴 ${id} 생산자가 사라졌다`).toContain(id);
    }
    /** 🟢 등록부 경로는 별도 owner 다(일시 생산자가 아니다). */
    expect(bare(CRAWLER(path.join("comparison-search", "index.ts")))).toContain("searchDomesticShops");
  });

  /* ═══════ ② 등록부 경로를 막는 게이트가 «둘» 이다 ═══════ */

  /**
   * 🔴🔴 **「검색이 약하다」가 아니다 — 요청을 «보내지 않는» 조건이 둘** 이다.
   *    ⒜ 수집전략이 `AUTO_*` 가 아니면 **요청 0** ⒝ 도메인 어댑터가 없으면 **요청 0**.
   * 🟢 둘 다 소스가 「하드코딩 허용목록이 아니라 **파서 존재 여부**」라고 직접 적는다.
   */
  it("D-2 🔴🔴 등록부 경로의 차단 조건 **둘** 을 코드로 고정한다", () => {
    const idx = bare(CRAWLER(path.join("comparison-search", "index.ts")));
    expect(idx).toContain('status: "unsupported"');
    expect(idx).toContain('source.collectionStrategy !== "AUTO_API"');
    expect(idx).toContain('source.collectionStrategy !== "AUTO_SCRAPE"');
    /** 🔴 어댑터 부재도 **같은 결과** 다(요청을 보내지 않는다). */
    expect(idx).toContain("findPriceSourceAdapter");
    /** 🟢 전략 어휘 넷이 그대로다 — 늘리거나 줄이지 않았다. */
    const types = bare(CRAWLER(path.join("comparison-search", "types.ts")));
    for (const s of ["AUTO_API", "AUTO_SCRAPE", "MANUAL", "NOT_AVAILABLE"]) {
      expect(types).toContain(s);
    }
  });

  /**
   * 🔴🔴🔴 **`NOT_AVAILABLE` 은 「못 한다」가 아니라 「약관이 막는다」 다.**
   *    그리고 그 정책은 **등록부 경로에만 있는 것이 아니다** — AI Search 경로에도
   *    정책 게이트가 있다(과거에 그 게이트가 없어 `NOT_AVAILABLE` 도메인을 **실제로
   *    크롤한 사고** 가 있었고 그 기록이 소스에 남아 있다).
   * 🔴 그래서 **포털·오픈마켓 계열을 「발견 실패」로 세면 거짓** 이 된다 — 정책 축이다.
   */
  it("D-3 🔴🔴 `NOT_AVAILABLE` 정책 게이트가 **AI 경로에도** 있다", () => {
    /**
     * 🔴🔴 **1차 단언이 주석을 근거로 해 FAIL 했다** — `gemini-candidate-pool.ts` 의
     *    bare 소스에 `NOT_AVAILABLE` 이라는 글자는 **없다**(주석에만 있다).
     * 🟢 실제 기전은 **술어 owner 하나** 다 — `isCollectionBlocked(url, notAvailableDomains)`
     *    를 AI 경로와 URL 풀이 **같이** 쓴다(사본 0). 그 **코드** 를 단언한다.
     */
    const gem = bare(LIB("gemini-candidate-pool.ts"));
    expect(gem).toContain("notAvailableDomains");
    expect(gem, "🔴 AI 경로가 정책 술어를 안 쓰면 금지 도메인을 크롤한다").toContain(
      "isCollectionBlocked(",
    );
    const pool = bare(LIB("url-candidate-pool.ts"));
    expect(pool, "🔴 술어가 둘이 되면 생산자마다 정책을 다시 해석한다").toContain(
      "export function isCollectionBlocked",
    );
    const run = bare(LIB("run-domestic-price-check.ts"));
    expect(run).toContain("notAvailableDomains");
    /** 🔴 `MANUAL` 을 약관 금지로 **뭉개지 않는다**(「아직 조사하지 않았다」다). */
    const raw = readFileSync(LIB("run-domestic-price-check.ts"), "utf8");
    expect(raw).toContain("아직 조사하지");
  });

  /* ═══════ ③ 🔴🔴 범용 안전 공백 — 상품 «상태» 축이 없다 ═══════ */

  /**
   * 🔴🔴🔴 **이 분석이 새로 찾은 범용 공백이다.**
   *    CEO 조사에 **리퍼상품**(72,700원)과 **일반상품**(95,770원)이 섞여 있다.
   *    그런데 운영 코드에 **상품 상태(일반/리퍼/중고) 축이 없다** — 축도 blocker 도
   *    라벨도 **0** 이다. ⟹ 리퍼 가격이 **동일상품 가격으로 섞이면** 셀러가 보는
   *    「국내 최저가」가 **다른 상태의 상품 가격** 이 된다.
   * 🔴 **이 WU 는 그 축을 만들지 않는다**(새 판정 축 = 제품 정책 · CPO 승인 사안).
   */
  it("D-4 🔴🔴 상품 **상태 축(일반/리퍼/중고)이 운영에 없다**(공백을 고정한다)", () => {
    const owners = [
      CRAWLER(path.join("comparison-search", "cross-seller.ts")),
      LIB("market-intelligence.ts"),
      path.join(process.cwd(), "src", "lib", "price-eligible-verdicts.ts"),
    ];
    for (const f of owners) {
      const src = bare(f);
      for (const token of ["리퍼", "refurb", "itemCondition", "REFURBISHED", "USED_ITEM"]) {
        expect(
          src,
          `🔴 ${path.basename(f)} 에 ${token} 이 생겼다 — **새 판정 축은 CPO 승인 사안** 이다`,
        ).not.toContain(token);
      }
    }
    /** 🟢 그러므로 「상태 구분이 된다」고 적을 수 없다 — **공백** 으로 적는다. */
    expect(true).toBe(true);
  });

  /* ═══════ ④ 원인 분류 산출 — 범용 / 정책 / 측정불가 ═══════ */

  it("D-5 🔵 원인을 **세 묶음** 으로 갈라 산출한다(사례는 진단용)", () => {
    const flow = (() => {
      try {
        return JSON.parse(readFileSync(path.join(HERE, "preserved", "kids-flow-verification.json"), "utf8")) as {
          stages: { stage: string; status: string }[];
        };
      } catch {
        return { stages: [] };
      }
    })();

    const out = {
      note:
        "🔴 분석 전용 — **구현 0** · HTTP 0 · DB 0 · GT 0 · verdict 0 · 가격 측정 0(G6 동결) · " +
        "SAME 기준 0 · 어댑터 0 · 덮어쓰기 0. 🔴 `B226AC033` 은 **진단 사례** 이고 " +
        "특정 사이트 대응은 **하지 않는다**.",
      problemFraming:
        "🔴🔴 「국내에 상품이 없다」 ≠ 「우리가 후보로 확보하지 못했다」 — " +
        "기존 스냅샷의 `KR candidates = 0` 은 **후자** 의 관측값이다(CPO 정정 수용).",
      producers: {
        transient: ["__url_candidates__", "__gemini_discovery__", "__overseas_auto__", "__domestic_listing__", "__web_search__"],
        registry: "searchDomesticShops(등록부 · `domestic_price_sources`)",
        note: "🔴 국내 후보가 들어올 입구는 이 여섯뿐이다 — 그 밖의 경로는 **없다**",
      },
      /** 🔴 범용 원인 — 여러 판매처·상품군에 **공통으로** 작용한다. */
      universalCauses: [
        {
          id: "U1 등록부 경로는 **요청 자체를 보내지 않는** 조건이 둘이다",
          mechanism:
            "⒜ `collectionStrategy !== AUTO_API|AUTO_SCRAPE` ⟹ `unsupported` " +
            "⒝ `findPriceSourceAdapter(domain) === null` ⟹ `unsupported`",
          evidence: "comparison-search/index.ts — 두 분기 모두 **요청 0** (코드 앵커 D-2)",
          priorMeasurement:
            "🟢 기존 실측(재조사 금지) — 등록부 34곳 중 **어댑터 없는 도메인 26** · " +
            "아동의류 실효 **6곳** · 전략을 AUTO 로 세워도 어댑터가 없으면 후보 **0**",
          universal: true,
          leverSafety:
            "🔴 해결 수단이 **어댑터 추가** 로 수렴하고 그것은 **특정 사이트 대응** 이다 ⟹ 금지 축",
        },
        {
          id: "U2 **검색어가 국내 시장을 겨냥하는지** 가 생산자마다 다르다",
          mechanism:
            "등록부 경로는 **샵 내부 검색**(어댑터)이고, 웹검색/AI 경로는 **질의 문자열** 이다 — " +
            "국내 판매처는 브랜드 품번을 **그대로 적지 않는 경우** 가 많다(기존 실측)",
          evidence: "🟢 기존 실측 — 국내 후보의 품번 부재가 **83건 · 17 호스트**(C 평가)",
          priorMeasurement: "🟢 한국어 검색이 **상품 상세 URL 을 거의 돌려주지 않는다**(기존 WU 실측)",
          universal: true,
          leverSafety: "🟡 질의 설계는 **사이트 무관** 이라 범용이다 — 🔴 단 구현은 승인 사안",
        },
        {
          id: "U3 **상품 상태 축이 없다**(일반 ↔ 리퍼 ↔ 중고)",
          mechanism:
            "운영 판정·가격 자격 owner 에 상태 어휘가 **0** 이다 ⟹ 리퍼 가격이 동일상품 " +
            "가격 집합에 들어오면 **셀러가 보는 최저가가 다른 상태의 상품** 이 된다",
          evidence: "🔴 grep 0 — cross-seller · market-intelligence · price-eligible-verdicts (D-4)",
          priorMeasurement: "없음 — **이 분석이 처음 지목한다**",
          universal: true,
          leverSafety:
            "🔴 **새 판정 축이다** ⟹ 제품 정책 · CPO 승인 사안(이 WU 는 만들지 않았다). " +
            "🟡 그러나 **후보를 늘리기 «전»** 에 정해야 한다 — 늘린 뒤에 섞이면 되돌리기 어렵다",
        },
        {
          id: "U4 **동일 플랫폼 중복 입점**을 묶는 축이 없다",
          mechanism:
            "중복 제거는 **(판매처, 상품) 단위** 다 — 같은 유통 플랫폼의 여러 입점은 " +
            "**서로 다른 판매처** 로 세어진다",
          evidence: "🟡 `dedupeKey`·샵 대표 선정은 **샵 단위** 다(기존 계약) — 플랫폼 축은 **미확인**",
          priorMeasurement: "🔴 **측정하지 않았다**(이 WU 는 DB·HTTP 0)",
          universal: true,
          leverSafety: "🟡 집계 축이라 판정에 닿지 않는다 — 🔴 단 「판매처 N곳」 숫자를 바꾼다",
        },
      ],
      /** 🔴 정책 원인 — **고쳐서 되는 것이 아니다**(약관·동결). */
      policyCauses: [
        {
          id: "P1 포털·오픈마켓 계열은 **약관으로 자동수집 대상이 아니다**",
          mechanism: "`NOT_AVAILABLE` — 등록부 경로 **그리고 AI Search 경로** 에 정책 게이트가 있다",
          evidence: "gemini-candidate-pool.ts POLICY-GATE-01 · run-domestic-price-check(과거 사고 기록) (D-3)",
          note:
            "🔴🔴 그래서 포털·오픈마켓에서 상품이 보이는 것을 **「발견 실패」로 세면 거짓** 이다 — " +
            "**정책이 막는 것** 이다. 🔴 우회는 금지(약관).",
        },
        {
          id: "P2 가격 축은 **G6 동결** 이다",
          mechanism: "가격 측정·표시 변경은 동결 해제 전 금지",
          evidence: "기존 진입 기준 G6",
          note: "🔴 리퍼/일반 분리의 **표시** 도 이 동결에 걸린다",
        },
      ],
      /** 🔴 측정불가 — 이 WU 의 권한·범위로 확인할 수 없다. */
      unmeasurable: [
        {
          id: "X1 CEO 가 찾은 국내 판매처들의 **등록부 상태**",
          why: "`domestic_price_sources` 는 **DB** 다 — 이 WU 는 DB 0 이다",
          note: "🔴 그 도메인이 `NOT_AVAILABLE` 인지 `MANUAL` 인지 **어댑터 부재** 인지 가르지 못했다",
        },
        {
          id: "X2 그 실행에서 **국내 질의가 실제로 무엇이었는지**",
          why: "질의 문자열은 `workspace.searchRun.search.query` 에 영속되지만 **읽을 경로가 DB/응답** 이다",
          note: "🟡 `/api/snapshots/<id>` 응답으로 **CEO 가** 꺼낼 수 있다(제가 꺼낼 수 없다)",
        },
        {
          id: "X3 리퍼/중고 후보가 **실제로 동일상품 가격에 섞였는지**",
          why: "가격 측정이 **G6 동결** 이다",
          note: "🔴 「섞였다」로도 「안 섞였다」로도 적지 않는다 — 축이 **없다** 는 사실만 확정했다",
        },
      ],
      diagnosticCase: {
        originCode: "B226AC033",
        usedAs: "진단 사례만 — 🔴 사이트별 대응·개별 과제 승격 **0**",
        priorFinding:
          "🟢 CASE-01 이 **② 수집 단계** 를 이미 닫았다(그 상품의 국내 후보는 MI 판정 탈락이 " +
          "아니라 **수집 실패** 였다) ⟹ 이 분석은 그 **상류** 만 봤다(재조사 0)",
      },
      stages: flow.stages,
      ctoProposal:
        "🔴 **구현하지 않았다.** 🟡 승인 대상 후보는 **둘** 이고 순서가 있다 — " +
        "**① U3 상품 상태 축(후보를 늘리기 «전» 에 정해야 한다)** → **② U2 국내 질의 설계**. " +
        "🔴 U1 은 **어댑터 추가로 수렴** 하므로 금지 축이고, U4 는 집계 축이라 G6 와 같이 판단해야 한다.",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /** 🔴 세 묶음이 **전부 비어 있지 않다**(한쪽만 적으면 그림이 거짓이 된다). */
    expect(out.universalCauses.length).toBeGreaterThan(0);
    expect(out.policyCauses.length).toBeGreaterThan(0);
    expect(out.unmeasurable.length).toBeGreaterThan(0);
    /** 🔴 범용 원인에 **사이트 이름이 없다**. */
    const blob = JSON.stringify(out.universalCauses).toLowerCase();
    for (const site of ["ssg", "lotte", "shinsegae", "emart", "smallable", "trenbe", "luxboy", "donokids"]) {
      expect(blob, `🔴 ${site} — 범용 원인이 사이트 전용이 됐다`).not.toContain(site);
    }
  });

  it("D-6 🔴 이 WU 가 **구현·경계를 넘지 않았다**", () => {
    const self = readFileSync(path.join(HERE, "domestic-discovery-gap-analysis.test.ts"), "utf8");
    for (const victim of ["c-candidate", "a-identity", "g8-", "kids-", "a22-", "a07-", "fixtures", "MI-KIDS"]) {
      expect(new RegExp(`writeFileSync\\([^)]*${victim}`).test(self), `🔴 ${victim} 덮어쓰기 금지`).toBe(false);
    }
    const s = self.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    for (const token of [
      ["DATABASE", "_URL"],
      ["getSupabase", "Admin"],
      ["fetchPlain", "Html"],
      ["judgeDomestic", "Candidate"],
      ["SAME", "_MIN_AXES ="],
      ["UA_", "POOL"],
      /**
       * 🔴🔴 **`findPriceSourceAdapter(` 금지는 «뺐다» — 자기참조였다**(이 트랙 6번째).
       *    D-5 가 차단 기전을 **문장으로 설명** 하면서 그 이름을 적었고, 금지 목록이
       *    **내 설명을 잡아** FAIL 했다. 🟢 과녁을 **어댑터 «등록»** 으로 옮긴다 —
       *    분석 WU 가 어댑터를 추가하면 그것이 진짜 위반이다.
       */
      ["ADAPTER_BY_", "DOMAIN ="],
      ["registerPriceSource", "Adapter"],
    ].map(([x, y]) => `${x}${y}`)) {
      expect(s, `🔴 ${token} — 분석 WU 가 경계를 넘었다`).not.toContain(token);
    }
  });
});
