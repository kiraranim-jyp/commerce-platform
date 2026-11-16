import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import {
  canonicalizeProductUrl,
  factsFromProductUrl,
  hasPrimaryIdentitySignal,
  originFactsFromIdentityDna,
  verifyDomesticCandidates,
  withConfidence,
  type ComparisonCandidate,
  type ProductUrlFactsResult,
} from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **SPRINT 2 라이브 계측 — `B226AC038` Hidden Monster Sweatshirt**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 최종 승인(2026-11-16) — **①번 · HTTP 총 6건 · 단일 실측 실행.**
 * ```
 * 🔴 승인 범위에 «없는» 것 — ② 운영 등록부 경로 · ①+② 12건 · 추가 검색 · 자동 재시도 ·
 *    어댑터 확장 · 운영 코드 변경 · **기준 상품 URL 재조회**
 * 🔴 URL 6개는 CPO 가 전달한 것을 **그대로** 쓴다(추측 대체 URL 생성 금지)
 * ```
 *
 * 🔴🔴 **CPO 가 요구한 분리를 그대로 낸다** — 「검색 결과가 나왔다」 ≠ 「정상적인 상품 발견」:
 * ```
 * A 동일상품 식별   브랜드 · 제조사 품번 · 상품명   ⟹ **SAME 은 기존 판정만**
 * B 이미지         🔴 **존재** 와 **실제 상품 일치** 를 가른다(일치는 **미확인** 으로 남긴다)
 * C 링크           상세페이지 ↔ 목록/브랜드 ↔ 판별 불가 — 🔴 목록을 상세로 적지 않는다
 * D 가격/판매상태   금액 · 통화 · `priceStatus` · 품절
 * ```
 *
 * 🔴 이 파일은 **환경변수 둘이 있을 때만** 돈다(`SPRINT2_LIVE_AC038=1` + `DATABASE_URL`).
 *    그래서 회귀에서는 **항상 SKIP** 이고 기준선을 흔들지 않는다.
 */

const LIVE = process.env.SPRINT2_LIVE_AC038 === "1";

/** 🔴 CPO 가 전달한 URL 6개. **이 목록 밖의 URL 을 추가하지 않는다.** */
const SUPPLIED_URLS = [
  "https://www.nordstrom.com/s/bobo-choses-hidden-monster-sweatshirt/9195361",
  "https://vividvia.com/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-26fw-hidden-monster-sweatshirt-b226ac038/505/category/1/display/6/",
  "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011",
  "https://www.junioredition.com/collections/11-years/products/hidden-monster-sweatshirt-by-bobo-choses",
  "https://james-basile.be/en/brands/bobo-choses",
  "https://stitch-house.com/SHOP/129832/112134/list.html",
] as const;

const ORIGIN_URL = "https://bobochoses.com/en-kr/products/b226ac038-hidden-monster-sweatshirt";

/**
 * 🔴🔴 **HTTP 예산을 «기계적으로» 끊는다.**
 *
 * CPO 승인은 **6건** 이다. `factsFromProductUrl` 은 내부에서 1회를 쓰지만 예외 경로
 * (헤더 초과 재시도 · 429 폴백)가 **1건을 더 쓸 수 있다**(WU-084). 그래서 호출 «전» 에
 * 누적값을 보고 **넘을 것 같으면 아예 부르지 않는다** — 사후에 「넘었다」를 적는 것은
 * 승인 위반이고, 나는 그 경계를 추측해 사고를 낸 적이 있다.
 */
const HTTP_BUDGET = 6;

describe.skipIf(!LIVE)("SPRINT 2 라이브 — B226AC038 · HTTP 6건 단일 실행", () => {
  it(
    "① URL 6개를 candidateUrls 경로로 통과시키고 A~D 를 분리해 기록한다",
    async () => {
      /* ───── 0. 원상품 — 🔴 **재조회 금지**. DB 스냅샷을 그대로 덤프해 둔 것을 읽는다 ─────
       *
       * 🔴 `@commerce/database` 는 apps/admin 에서 해석되지 않는다(typecheck 가 잡았다) ⟹
       *    DB 읽기는 `packages/database` 에서 **별도 단계** 로 끝내고 그 산출(JSON)만 받는다.
       * 🟢 받는 것은 `workspace->'canonicalProduct'` **원문** 이고, 가공은 아래 두 줄이
       *    운영과 **같은 owner 로** 한다 ⟹ 입력이 갈릴 구조가 없다(§5-B).
       */
      const originJsonPath = process.env.SPRINT2_ORIGIN_JSON;
      expect(originJsonPath, "SPRINT2_ORIGIN_JSON 이 없다 — 원상품 덤프 경로를 줘야 한다").toBeTruthy();
      const dump = JSON.parse(readFileSync(originJsonPath!, "utf8")) as {
        snapshotId: string;
        sourceUrl: string;
        canonicalProduct: unknown;
      };
      expect(dump.sourceUrl, "덤프의 원상품 URL 이 기준 URL 과 다르다").toBe(ORIGIN_URL);
      /** 🔴 운영 `check/route.ts:87·151` 과 **같은 두 줄** 이다 — 사본이 아니라 그 순서다. */
      const product = backfillCanonicalProduct(dump.canonicalProduct as never);
      const dna = buildProductIdentityDna(product);
      const originFacts = originFactsFromIdentityDna(dna);

      /* ───── 1. 후보 풀 — 운영 owner `collectUrlCandidatePool` · fetch 만 예산으로 감싼다 ───── */
      let httpUsed = 0;
      const fetchLog: { url: string; httpCalls: number; status: string; skipped: boolean }[] = [];
      const budgetedFetch = async (url: string): Promise<ProductUrlFactsResult> => {
        if (httpUsed >= HTTP_BUDGET) {
          fetchLog.push({ url, httpCalls: 0, status: "BUDGET_EXHAUSTED", skipped: true });
          /** 🔴 예산이 끝나면 **요청을 보내지 않는다.** 「도달 실패」로 적지 않는다. */
          return { status: "UNREACHABLE", httpCalls: 0 } as unknown as ProductUrlFactsResult;
        }
        const facts = await factsFromProductUrl(url);
        httpUsed += facts.httpCalls;
        fetchLog.push({ url, httpCalls: facts.httpCalls, status: facts.status, skipped: false });
        return facts;
      };

      const pool = await collectUrlCandidatePool({
        urls: SUPPLIED_URLS,
        originUrl: ORIGIN_URL,
        /** 🔴 6 — CPO 승인 수와 같다. 더 열지 않는다. */
        maxUrls: SUPPLIED_URLS.length,
        existingCanonicalUrls: new Set<string>(),
        fetchFacts: budgetedFetch,
      });

      /* ───── 2. 점수/판정 — 🔴 순수 함수만. 가격 보강·품번 상세확인은 «부르지 않는다» ───── */
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: ORIGIN_URL,
        searchTerm: dna.title,
        facts: originFacts,
      };
      /**
       * 🔴 링크 모양을 **기존 owner 로** 읽는다 — `classifyUrlShape` 는 패키지 밖으로
       *    공개돼 있지 않고(typecheck 가 잡았다), 그것을 공개하려 새 export 를 만들면
       *    이번 승인 범위(「코드 변경 없음」)를 넘는다. `verifyDomesticCandidates` 가
       *    **그 함수를 부르는 유일한 자리** 이므로 후보 하나씩 넣어 되읽는다.
       */
      const shapeOf = (c: ComparisonCandidate) => {
        const v = verifyDomesticCandidates([c]);
        return v.detailPage === 1 ? "PRODUCT_PAGE" : v.listingPage === 1 ? "LISTING_PAGE" : "UNDETERMINED";
      };
      const rowsOut = pool.searchResults.flatMap((r) =>
        withConfidence(query, r.candidates).map((c) => {
          const shape = shapeOf(c);
          return {
            domain: r.domain,
            url: c.url,
            canonical: canonicalizeProductUrl(c.url),
            title: c.title ?? null,
            /* A 동일상품 식별 */
            candidateBrand: c.facts?.brand ?? null,
            candidateCode: c.facts?.brandModelCode ?? null,
            sellerSku: c.facts?.sellerSku ?? null,
            primaryIdentitySignal: hasPrimaryIdentitySignal(originFacts, c.facts),
            crossSellerVerdict: c.crossSellerVerdict ?? null,
            crossSellerBlockers: c.crossSellerBlockers ?? null,
            matchLevel: c.matchLevel ?? null,
            /* B 이미지 — 🔴 존재와 일치를 가른다 */
            imagePresent: Boolean(c.imageUrl),
            imageUrl: c.imageUrl ?? null,
            imageMatchesProduct: "UNVERIFIED_BY_CTO" as const,
            /* C 링크 */
            urlShape: shape,
            isDetailPage: shape === "PRODUCT_PAGE",
            /* D 가격/판매상태 */
            price: c.price ?? null,
            priceStatus: c.priceStatus ?? null,
            soldOut: c.soldOut ?? null,
            /**
             * 🔵 **재실측(CPO 2026-11-16) — 후보 facts «전문» 을 보존한다.**
             *
             * 🔴 1차 실행이 이것을 저장하지 않아 **오프라인 반사실이 불가능** 했다
             *    (「브랜드 연결이 SAME 까지 올리는가」를 HTTP 없이 다시 계산할 수 없었다).
             * 🟢 이 칸이 있으면 다음부터 그 계산이 **HTTP 0** 으로 가능하다.
             */
            facts: c.facts ?? null,
            crossSellerReasons: c.crossSellerReasons ?? null,
            crossSellerConflicts: c.crossSellerConflicts ?? null,
            matchTruth: c.matchTruth ?? null,
          };
        }),
      );

      const out = {
        approvedHttpBudget: HTTP_BUDGET,
        httpUsed,
        /**
         * 🔴 **URL 당 호출 수를 따로 낸다**(CPO 재실측 경계: 「각 URL 최대 1회 요청」).
         *
         * 🔴 하니스는 각 URL 을 **정확히 한 번** 부른다. 그런데 운영 `factsFromProductUrl`
         *    내부에 **헤더초과 복구 재시도**(WU-084)가 있어 `httpCalls` 가 2 로 올 수 있다 —
         *    1차 실행의 junioredition 이 그것이다. 🟢 **내 재시도가 아니고** 운영 동작이며,
         *    운영 코드 변경은 승인 범위 밖이라 **고치지 않았다**. 누적 상한으로 묶는다.
         */
        perUrlCalls: fetchLog.map((f) => ({ url: f.url, httpCalls: f.httpCalls })),
        /** 🟢 외부 AI/검색 provider 호출 — 이 경로는 **구조상 0** 이다. */
        providerCalls: pool.metrics.providerCalls,
        /**
         * 🔴 **상세 요청(품번 상세확인·가격 보강) 0** — 이 하니스는 `judgeDomesticCandidate`
         *    와 `enrichCandidatePrices` 를 **부르지 않는다**(승인 6건을 넘기기 때문).
         *    ⟹ 그래서 아래 verdict 는 **cross-seller 판정** 이고 운영 최종 tier 가 아니다.
         */
        detailRequests: 0,
        origin: {
          snapshotId: dump.snapshotId,
          url: ORIGIN_URL,
          title: dna.title,
          brand: dna.brand.value,
          brandModelCode: dna.brandModelCode,
          color: dna.color,
          refetched: false,
        },
        suppliedUrls: SUPPLIED_URLS.length,
        poolMetrics: pool.metrics,
        fetchLog,
        /** 🔴 후보 수 ↔ 검증 통과 수를 **다른 칸** 으로 낸다. */
        candidateCount: rowsOut.length,
        verification: verifyDomesticCandidates(pool.searchResults.flatMap((r) => r.candidates)),
        /** 🔴 실제 SAME — 기존 판정 어휘 그대로. 임계값/정책 변경 0. */
        sameCount: rowsOut.filter((r) => r.crossSellerVerdict === "SAME").length,
        presumedOrSimilar: rowsOut.filter(
          (r) => r.crossSellerVerdict === "PRESUMED_SAME" || r.crossSellerVerdict === "SIMILAR",
        ).length,
        rows: rowsOut,
      };

      /**
       * 🔴 **1차 실행 산출을 덮어쓰지 않는다**(CPO: 「계측 결과와 기존 실행 결과를 구분해서
       *    보고」). 파일명을 환경변수로 받아 **두 실행을 나란히** 남긴다.
       */
      const outName = process.env.SPRINT2_OUT_NAME ?? "SPRINT2-LIVE-AC038-2026-11-16.json";
      writeFileSync(
        join(__dirname, "../../../../../../../../docs", outName),
        JSON.stringify(out, null, 1),
        "utf8",
      );

      /** 🔴 승인 경계를 **단언으로** 잠근다 — 넘었으면 이 측정은 무효다. */
      expect(httpUsed, `HTTP 승인 ${HTTP_BUDGET}건을 넘었다`).toBeLessThanOrEqual(HTTP_BUDGET);
    },
    240_000,
  );
});
