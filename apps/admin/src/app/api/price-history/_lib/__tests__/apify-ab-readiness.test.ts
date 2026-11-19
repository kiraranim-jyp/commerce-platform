/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **Apify AI Search 연동 확인 + 신상품 A/B 실행 가능성**(HTTP 0 · 운영 질의 불변)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **새 인프라를 만들지 않았다** — 기존 경로를 **읽어서** 확정했다.
 * 🔴 토큰·인증정보를 **보고서·산출물·로그에 넣지 않는다**(존재 여부만 본다).
 * 🔴 운영 `SELLER_SIGNAL` **변경 0** · 질의 사본 **0** · 상태 축 **0** ·
 *    SAME/가격/약관/어댑터/DB **전부 0**.
 *
 * 🔴🔴 **먼저 내 이전 표현을 정정한다**(CPO 지적이 맞다) — 「AI Search 는 사용자
 *    브라우저에서 돈다」는 **붙여넣기 생산자**(`__url_candidates__`)에 대한 사실이고,
 *    **Apify 경로는 «서버측» 검색 실행자** 다(`__web_search__`). 둘은 **다른 생산자** 다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const LIB = (f: string) => path.join(HERE, "..", f);
const ROOT = path.join(process.cwd(), "..", "..");
const PLANNER = path.join(ROOT, "packages", "crawler", "src", "discovery-core", "query-planner.ts");
const OUT = path.join(HERE, "preserved", "apify-ab-readiness.json");
const bare = (p: string) =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("STEP A — 기존 Apify 연동 구조(코드 근거 · HTTP 0)", () => {
  it("P-1 🟢 Apify 호출 owner 가 **하나** 이고 Actor·엔드포인트가 고정이다", () => {
    const src = bare(LIB("web-search-pool.ts"));
    /** 🟢 Actor 는 **저장된 Task 가 아니라** run-sync 호출이다. */
    expect(src).toContain('const ACTOR = "apify~google-search-scraper"');
    /** 🔴 호출부가 **하나** 다 — 리포 전체에서 이 파일 밖에 Apify 호출이 없다. */
    expect(src).toContain("async function apifySearch(");
    /**
     * 🔴🔴🔴 **주석 제거로 URL 을 단언하면 틀린다 — 1차에서 실제로 FAIL 했다.**
     *    `//[^\n]*` 가 **`https://` 의 `//` 를 주석으로 먹어** 엔드포인트가 사라진다.
     * 🟢 그래서 URL 은 **원문** 으로 본다(주석 제거는 식별자·구문에만 쓴다).
     */
    const raw = readFileSync(LIB("web-search-pool.ts"), "utf8");
    expect(raw).toContain("https://api.apify.com/v2/acts/");
    /** 🔴 꼬리도 **같은 줄** 이라 같이 먹혔다 — 이것도 원문으로 본다. */
    expect(raw).toContain("run-sync-get-dataset-items");
  });

  it("P-2 🟢 검색어 전달 형식과 실행 파라미터가 고정이다", () => {
    const src = bare(LIB("web-search-pool.ts"));
    expect(src).toContain("queries: query");
    expect(src).toContain("const MAX_PAGES_PER_QUERY = 2");
    expect(src).toContain("const RESULTS_PER_PAGE = 20");
    expect(src).toContain('export const SEARCH_LANGUAGE_CODE = "ko"');
    /** 🟢 HTML 저장을 끈다(비용·저장 축). */
    expect(src).toContain("saveHtml: false");
    /** 🔴 `countryCode` 는 **롤백됐다**(실측 반증) — 되살아나면 FAIL 한다. */
    expect(src, "🔴 countryCode 가 돌아오면 organic 이 0 이 된 그 실측을 다시 밟는다").not.toContain(
      "countryCode:",
    );
  });

  it("P-3 🔴🔴 질의 owner 는 **planner 하나** 다(호출부가 조립하지 않는다)", () => {
    const pool = bare(LIB("web-search-pool.ts"));
    expect(pool).toContain("buildDiscoverySearchQuery(input.identity)");
    expect(pool).toContain("buildCompositeDiscoveryQuery(input.identity");
    expect(pool, "🔴 호출부에 신호 문자열이 생기면 owner 가 둘이 된다").not.toContain("동일상품 판매처");
    expect(bare(PLANNER)).toContain('const SELLER_SIGNAL = "국내해외 동일상품 판매처"');
  });

  /**
   * 🟢🟢 **「Apify 가 실제로 운영에서 돈다」는 증거가 이미 있다.**
   *    `metrics.query` 는 **이 생산자만** 채우고, 그것이 `workspace.searchRun.search.query`
   *    로 영속된다. 🔴 그리고 CEO 가 확인한 X2 질의가 **그 칸의 값** 이었고
   *    `SELLER_SIGNAL` 로 끝난다 ⟹ **그 실행은 Apify 경로였다.**
   */
  it("P-4 🟢 실행 기록 자리와 **운영 발화 증거**가 코드로 연결된다", () => {
    const pool = bare(LIB("web-search-pool.ts"));
    expect(pool).toContain("metrics.query = query");
    const route = bare(path.join(HERE, "..", "..", "check", "route.ts"));
    /** 🟢 그 숫자들이 스냅샷에 영속된다 — 과거 실행을 되짚을 수 있는 유일한 자리다. */
    for (const k of ["query:", "searches:", "organic:", "failed:", "errorStatus:"]) {
      expect(route, `🔴 ${k} 가 사라지면 실행 기록을 되짚을 수 없다`).toContain(k);
    }
  });

  it("P-5 🔴🔴 **두 생산자를 혼동하지 않는다** — 브라우저 붙여넣기 ↔ 서버 Apify", () => {
    const transient = bare(LIB("transient-candidates.ts"));
    expect(transient).toContain("__web_search__");
    expect(transient).toContain("__url_candidates__");
    /** 🔴 서버 Apify 경로는 `__web_search__` 이고 붙여넣기는 `__url_candidates__` 다. */
    const run = bare(LIB("run-domestic-price-check.ts"));
    expect(run).toContain("collectWebSearchUrls");
  });
});

describe("STEP B — A/B 실행 가능성(🔴 실행하지 않았다)", () => {
  /**
   * 🔴🔴🔴 **차단 사유는 「비용」이 아니라 「자격증명」이다.**
   *    운영은 `process.env.APIFY_API_TOKEN` 을 쓰고, 그 값은 **Production Sensitive** 다 —
   *    CTO 환경에 **없다**(아래 단언). ⟹ 기존 인프라를 쓰라는 전제는 맞지만
   *    **그 인프라의 키가 CTO 에게 없어서** A/B 를 실행할 수 없다.
   * 🟢 **토큰을 새로 만들지도, 우회하지도 않았다.**
   */
  it("P-6 🔴🔴 토큰이 **CTO 환경에 없다**(값은 보지 않는다 · 존재 여부만)", () => {
    expect(
      Boolean(process.env.APIFY_API_TOKEN),
      "🟡 토큰이 주어지면 이 단언이 FAIL 로 뒤집히고 그때 A/B 를 실행한다",
    ).toBe(false);
    /** 🟢 코드에는 **주입점이 이미 있다** — 새로 만들 것이 없다. */
    const pool = bare(LIB("web-search-pool.ts"));
    expect(pool).toContain("input.token");
    expect(pool).toContain("input.search");
  });

  it("P-7 🟢 A/B 측정 훅이 **이미 있다**(새 설계 0 · 운영 미전달 유지)", () => {
    const planner = bare(PLANNER);
    expect(planner).toContain("options?: { signal?: string }");
    expect(planner).toContain("options?.signal?.trim() || SELLER_SIGNAL");
    /** 🔴 운영 호출부는 그 인자를 **넘기지 않는다**(계약 Q12 의 성질). */
    const pool = bare(LIB("web-search-pool.ts"));
    expect(pool).toContain("input.signal");
    expect(pool).toContain("buildDiscoverySearchQuery(input.identity)");
  });

  it("P-8 🔴 운영 `SELLER_SIGNAL` 을 **바꾸지 않았다**", () => {
    expect(bare(PLANNER)).toContain('const SELLER_SIGNAL = "국내해외 동일상품 판매처"');
    expect(bare(PLANNER), "🔴 운영 상수에 신품 토큰이 들어가면 채택된 것이다").not.toContain(
      '"국내해외 동일상품 새상품 판매처"',
    );
  });

  it("P-9 🔵 연동 구조·호출량 산출·차단 사유를 산출한다", () => {
    const pool = bare(LIB("web-search-pool.ts"));
    const num = (re: RegExp) => Number(re.exec(pool)?.[1]);
    const pages = num(/const MAX_PAGES_PER_QUERY = (\d+)/);
    const perPage = num(/const RESULTS_PER_PAGE = (\d+)/);

    const out = {
      note:
        "🔴 **연동 확인 + 실행 가능성 평가 전용** — Apify 호출 **0** · 새 인프라 **0** · " +
        "운영 질의 **불변** · 토큰·인증정보 **미기록** · 상태 축 0 · SAME/가격/약관/DB 0.",
      correction:
        "🔴 내 이전 표현을 정정한다 — 「AI Search 는 브라우저에서 돈다」는 **붙여넣기 생산자**" +
        "(`__url_candidates__`)의 사실이고, **Apify 는 «서버측» 검색 실행자**(`__web_search__`)다.",
      integration: {
        actor: "apify~google-search-scraper",
        invocation: "POST https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items",
        taskOrActor: "🟢 저장된 Task 가 아니라 **Actor run-sync** 호출이다",
        callOwner: "apps/admin/src/app/api/price-history/_lib/web-search-pool.ts#apifySearch (호출부 **하나**)",
        queryOwner:
          "packages/crawler/src/discovery-core/query-planner.ts#buildCompositeDiscoveryQuery " +
          "(🔴 호출부는 문자열을 조립하지 않는다 · 사본 0)",
        queryTransport: "body `queries: <질의 문자열>`",
        params: { maxPagesPerQuery: pages, resultsPerPage: perPage, languageCode: "ko", saveHtml: false },
        countryCode: "🔴 **없다**(2026-11-14 롤백 · 넣었더니 organic 2 → 0 으로 반증됐다)",
        auth: "🔴 `process.env.APIFY_API_TOKEN` — URL 쿼리로 전달되며 **로그·보고서에 싣지 않는다**",
        resultPath:
          "items[*].organicResults 전수 이어붙임(중복 1회) → `collectWebSearchUrls` 가 **URL 만** 반환 → " +
          "`run-domestic-price-check` 가 `__web_search__` 일시 생산자로 후보화 → facts → MI",
        browserVsServer:
          "🟢 **서버**: Apify 검색 실행 · 후보 URL 처리 · MI. " +
          "🟢 **브라우저**: 셀러가 붙여넣는 AI 답변(`candidateUrls[]`) — **다른 생산자** 다. " +
          "🔴 서버에 **검색 원문을 담는 칸은 여전히 없다**(질의 문자열만 영속된다).",
        executionRecord:
          "`workspace.searchRun.search` — query · searches · pages · perPage · organic · failed · " +
          "errorName/Status/Code · timeout 이 **영속** 된다(과거 실행을 되짚는 유일한 자리)",
        operationalProof:
          "🟢🟢 CEO 가 확인한 X2 질의가 **그 칸의 값** 이고 `SELLER_SIGNAL` 로 끝난다 ⟹ " +
          "**그 실행이 Apify 경로였음이 기록으로 확인된다**(추정 아님)",
      },
      abPlan: {
        signalA: "국내해외 동일상품 판매처 (운영 · 변경 0)",
        signalB: "국내해외 동일상품 새상품 판매처 (후보 · 토큰 +1)",
        onlyDifference: "🟢 「새상품」 **한 토큰** — 브랜드·품번·디자인·사실 입력 **동일**",
        hook: "buildCompositeDiscoveryQuery(identity, { signal }) · 🔴 운영 호출부 미전달 유지",
        products: 10,
        callsPerCondition: 10,
        /** 🔴 **호출 «구조» 로 산출한 수치** 다 — 금액이 아니다. */
        estimatedApifyRuns: { oneRound: 20, twoRoundsForStability: 40 },
        resultsCeiling: { perRun: pages * perPage, oneRound: 20 * pages * perPage },
        repeatNeeded:
          "🔴 **2회 이상** 필요하다 — 같은 질의의 실행 간 URL 겹침이 **3~30%**(SP-10) ⟹ " +
          "1회 관측으로 A/B 우열을 가를 수 없다",
      },
      /** 🔴🔴 차단 — 「비용」이 아니라 「자격증명」이다. */
      blockers: [
        {
          id: "B1 Apify 토큰이 CTO 환경에 없다",
          detail:
            "운영은 `process.env.APIFY_API_TOKEN`(Production **Sensitive**)을 쓴다 — CTO 로컬에 " +
            "**설정돼 있지 않고**(실측) 그 값은 **읽을 수 없다**(`vercel env pull` 도 빈 문자열 · 기존 확정). " +
            "🔴 토큰을 새로 만들지도 우회하지도 않았다.",
          owner: "CEO",
          resolution:
            "🟡 선택지 둘 — ⒜ **1회용 토큰**을 CTO 에게 주고 A/B 직후 폐기(헌장 §10 수명주기) " +
            "⒝ 또는 **운영에서 B 를 측정 전용 훅으로 1회 실행**하고 그 `searchRun` 을 전달",
        },
        {
          id: "B2 기존 사용량·크레딧은 CTO 가 읽을 수 없다",
          detail:
            "Apify 계정 사용량·크레딧은 **외부 콘솔** 이고 CTO 가 로그인할 수 없다 ⟹ " +
            "「기존 비용 범위 안인가」를 **확인할 수 없다**(측정불가 · 0 으로 적지 않는다)",
          owner: "CEO",
          resolution: "🟡 콘솔의 현재 사용량/크레딧과 run 단가를 알려 주면 위 호출수로 범위를 판정한다",
        },
      ],
      notVerified: [
        "🔴 전체 검색 결과 URL · 국내/해외 후보 · 상품 페이지 비율 · 중고·리퍼 명시 결과 · " +
          "모델코드 일치 · 기존 결과 중복률 · 반복 실행 간 중복률 — **전부 미측정**(Apify 호출 0)",
        "🔴 추가 과금 발생 여부 — **측정불가**(콘솔 접근 불가)",
      ],
      unchanged: [
        "운영 `SELLER_SIGNAL` · 질의 구조 · `countryCode` 미사용 상태",
        "SAME/PRESUMED_SAME 기준 · 임계값 · 가격 적격성 · recommendedPrice · SINGLE/RANGE · G6",
        "`isCollectionBlocked` · 등록부 · 어댑터 · DB 스키마",
      ],
      ctoVerdict:
        "🔴 **STEP A PASS · STEP B~E BLOCKED(자격증명)** — 연동 구조와 A/B 준비는 **완료** 이고 " +
        "코드상 새로 만들 것이 **없다**(훅·주입점이 이미 있다). 🔴 실행만 막혀 있다.",
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));

    /**
     * 🔴 산출물에 **토큰 «값»** 이 없다.
     * 🔴🔴 1차 금지 조건이 틀렸다 — `apify_api` 를 통째로 막으면 **환경변수 «이름»**
     *    (`APIFY_API_TOKEN`)까지 걸린다. 이름은 비밀이 아니고, 적어야 추적이 된다.
     * 🟢 그래서 **토큰 «모양»**(접두 + 실제 값) 과 쿼리 전달 흔적만 막는다.
     */
    const raw = readFileSync(OUT, "utf8");
    expect(raw, "🔴 토큰 값이 산출물에 섞였다").not.toMatch(/apify_api_[A-Za-z0-9]{8,}/);
    expect(raw, "🔴 쿼리스트링에 실린 토큰이 섞였다").not.toMatch(/[?&]token=[A-Za-z0-9]/);
    expect(raw, "🔴 Authorization 헤더 값이 섞였다").not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    expect(out.blockers).toHaveLength(2);
    expect(out.abPlan.estimatedApifyRuns.oneRound).toBe(20);
  });
});
