import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeProductUrl, withConfidence } from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { TRANSIENT_URL_SHOP_ID } from "../transient-candidates";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-024 LIVE E2E — **실제 GT 판매처로** 병목 A 를 통과시킨다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기본 SKIP 이다.** `WU_024_LIVE=1` 없이는 한 줄도 돌지 않는다 — 회귀 전수가
 *    네트워크를 타면 안 된다(기존 `MI_P0_02_LIVE` 규약과 같은 모양).
 *
 * 🔴 **AI 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 0 · DB 쓰기 0.**
 *    쓰는 것은 **공개 상품 페이지 HTTP GET** 뿐이다(후보 URL 당 1~2회).
 *
 * ── 🔴 왜 fixture 가 아니라 이것이 E2E 인가 ──────────────────────────────────
 * 이 트랙은 「fixture 가 통과했다」를 E2E 로 적어 여덟 번 틀렸다. 여기서는:
 *   ① **원상품이 운영 DB 덤프** 다(`mi-017-e2e-cases.json` · canonical_product 원본)
 *   ② **후보 URL 이 GT** 다(`mi-022-gt.json` · 사람이 라벨한 SAME/DIFFERENT)
 *   ③ **판정 함수가 운영 함수** 다(`withConfidence` → `judgeDomesticCandidate`)
 *   ④ 입력 변환도 운영 경로 그대로다
 *      (`backfillCanonicalProduct` → `buildProductIdentityDna` → `productFactsFromIdentityDna`
 *       = `check/route.ts` 가 쓰는 그 셋)
 *
 * 🔴 **CONTROL** — 원상품 매핑을 손으로 적었으므로 그 매핑이 맞는지를 **먼저 단언**
 *    한다(`source_url` 일치). 틀린 원상품으로 재면 그 숫자는 전부 무효다(§5-B).
 *
 * 실행:
 *   cd apps/admin && WU_024_LIVE=1 npx vitest run src/app/api/price-history/_lib/__tests__/wu-024-live-e2e.test.ts
 */

const LIVE = process.env.WU_024_LIVE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const GT = path.join(OUT, "mi-022-gt.json");

/**
 * 🔴 searchId → 원상품 스냅샷. 출처는 `docs/AI-SEARCH-COLLECTION-019A-SEARCH.md` §3
 *    작업표(S1~S6 · 전부 운영 DB 실데이터)다. 🔴 `expectedOrigin` 을 같이 적어
 *    **매핑이 맞는지 테스트가 확인** 한다 — 추측으로 두지 않는다.
 */
const ORIGINS: Record<string, { snapshotId: string; expectedOrigin: string }> = {
  S1: {
    snapshotId: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
  },
  S2: {
    snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
  },
  S3: {
    snapshotId: "c5395889-7651-4272-aff5-dbeddd8d6199",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses",
  },
  S4: {
    snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  },
  S5: {
    snapshotId: "32f7b651-29b9-4217-b8ce-46596f538306",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  },
  S6: {
    snapshotId: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
    expectedOrigin: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
  },
};

/** 🔴 운영 등록부 34곳(WU-024 census 실측). 이 목록 **밖** 이 병목 A 의 대상이다. */
const REGISTRY_DOMAINS = new Set([
  "11st.co.kr", "29cm.co.kr", "auction.co.kr", "bobochoses.com", "chocoel.co.kr", "chouchouenfant.kr",
  "cjonstyle.com", "coconjennie.com", "coupang.com", "danawa.com", "deuxbebe.com", "enuri.com",
  "foretforet.com", "gmarket.co.kr", "gsshop.com", "hmall.com", "karymarket.com", "kidikidi.elandmall.co.kr",
  "kream.co.kr", "littleluna.co.kr", "looxloo.com", "lotteon.com", "musinsa.com", "nokimore.com",
  "ocokorea.com", "rulii.co.kr", "shopping.naver.com", "shoppinghow.kakao.com", "skysport.co.kr",
  "smartstore.naver.com", "ssfshop.com", "ssg.com", "wconcept.co.kr",
]);

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

interface GtRow {
  searchId: string;
  candidateUrl: string;
  gt: string;
  gtReason?: string;
}
interface CaseRow {
  id: string;
  source_url: string;
  canonical_product: unknown;
}

const maybe = LIVE ? it : it.skip;

describe("WU-024 LIVE — Registry 밖 GT 판매처가 일시 경로로 들어온다", () => {
  maybe(
    "GT 등록부 밖 후보를 운영 판정 함수로 끝까지 통과시킨다",
    async () => {
      expect(existsSync(CASES), `원상품 덤프 없음: ${CASES}`).toBe(true);
      expect(existsSync(GT), `GT 없음: ${GT}`).toBe(true);
      const cases = JSON.parse(readFileSync(CASES, "utf8")) as CaseRow[];
      const gtRows = (JSON.parse(readFileSync(GT, "utf8")) as GtRow[]).filter(
        (r) => !REGISTRY_DOMAINS.has(hostOf(r.candidateUrl)),
      );
      expect(gtRows.length).toBeGreaterThan(0);

      const perSearch = new Map<string, GtRow[]>();
      for (const row of gtRows) {
        const b = perSearch.get(row.searchId);
        if (b) b.push(row);
        else perSearch.set(row.searchId, [row]);
      }

      const results: Record<string, unknown>[] = [];
      let fetchCalls = 0;

      for (const [searchId, rows] of perSearch) {
        const origin = ORIGINS[searchId];
        if (!origin) continue;
        const snapshot = cases.find((c) => c.id === origin.snapshotId);
        expect(snapshot, `스냅샷 ${origin.snapshotId} 없음`).toBeTruthy();
        /**
         * 🔴🔴 CONTROL — 매핑이 맞는지 **먼저** 확인한다. 틀리면 아래 숫자가 전부 무효다.
         *
         * 🔴🔴 **문자열 완전일치로 비교하지 않는다.** 이 CONTROL 이 **실제로 그 함정을
         *    잡았다**(1차 실행 FAIL): S4 의 덤프 `source_url` 에 검색 문맥 파라미터가
         *    붙어 있다 — `?_pos=1&_sid=a0738e824&_ss=r`. 같은 함정으로 WU-022-2 에서
         *    S4 가 **통째로 빠진** 전례가 있다(인수인계 §3-5 ②).
         * 🟢 그래서 **운영 정규화기** 로 맞춘다 — 추적/검색 파라미터만 걷히고 식별
         *    파라미터·로케일·host 는 보존된다(WU-009C).
         */
        expect(canonicalizeProductUrl(snapshot!.source_url)).toBe(canonicalizeProductUrl(origin.expectedOrigin));

        /* 🟢 운영 `check/route.ts` 와 **같은 변환 사슬** 이다 — 복제 계산이 아니다. */
        const product = backfillCanonicalProduct(snapshot!.canonical_product as never);
        const dna = buildProductIdentityDna(product);
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          facts: productFactsFromIdentityDna(dna),
        };

        /* ① 생산자 — **실제 HTTP.** AI 0 · provider 0. */
        const pool = await collectUrlCandidatePool({
          urls: rows.map((r) => r.candidateUrl),
          originUrl: dna.sourceUrl,
          maxUrls: rows.length,
          existingCanonicalUrls: new Set<string>(),
        });
        fetchCalls += pool.metrics.fetchCalls;
        expect(pool.metrics.providerCalls).toBe(0);
        /** 🔴 일시 샵 id 를 달고 나온다 — 저장 차단의 기준이다. */
        expect(pool.searchResults.every((s) => s.shopId === TRANSIENT_URL_SHOP_ID)).toBe(true);

        /* ②③ 소비자 — **운영 함수 그대로.** 점수는 배열 단위 1회. */
        for (const shop of pool.searchResults) {
          const scored = withConfidence(query, shop.candidates);
          const judgement = await judgeDomesticCandidate({
            domain: shop.domain,
            candidates: scored,
            sourceUrl: dna.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            /** 🔴 운영과 같은 owner 를 쓴다 — 추출기 없는 도메인은 null 이 정답이다. */
            fetchModelCode: async () => null,
          });
          for (const candidate of shop.candidates) {
            const gt = rows.find((r) => hostOf(r.candidateUrl) === shop.domain);
            results.push({
              searchId,
              domain: shop.domain,
              candidateUrl: candidate.url,
              gt: gt?.gt ?? null,
              judgementKind: judgement.kind,
              gate: judgement.kind === "DROPPED" ? judgement.gate : null,
              matchTruth: judgement.kind === "JUDGED" ? judgement.matchTruth : null,
              priceTier: judgement.kind === "JUDGED" ? judgement.priceTier : null,
              crossSellerVerdict: judgement.kind === "JUDGED" ? judgement.best.crossSellerVerdict ?? null : null,
              confidence: judgement.kind === "JUDGED" ? judgement.best.confidence ?? null : null,
              priceAmount: judgement.kind === "JUDGED" ? judgement.best.price?.amount ?? null : null,
              priceCurrency: judgement.kind === "JUDGED" ? judgement.best.price?.currency ?? null : null,
              priceStatus: judgement.kind === "JUDGED" ? judgement.best.priceStatus ?? null : null,
            });
          }
        }
        results.push({
          searchId,
          kind: "POOL_METRICS",
          supplied: pool.metrics.suppliedUrls,
          accepted: pool.metrics.acceptedUrls,
          usable: pool.metrics.usableProductUrls,
          miEligible: pool.metrics.miEligibleCandidates,
          fetchCalls: pool.metrics.fetchCalls,
          dropped: pool.metrics.dropped,
        });
      }

      mkdirSync(OUT, { recursive: true });
      writeFileSync(path.join(OUT, "wu-024-live-e2e.json"), JSON.stringify(results, null, 2), "utf8");
      console.log(`[WU-024-live] rows=${results.length} httpCalls=${fetchCalls}`);

      /**
       * 🔴🔴 **여기서 단언하는 것은 「후보가 들어왔다」 하나다.**
       *    「SAME 이 몇 건 나왔다」를 단언하지 않는다 — 그것은 **측정값** 이고 임계값을
       *    만들어 맞추는 순간 benchmark 통과용 하드코딩이 된다(§6 금지). 숫자는
       *    위 JSON 에 남기고 보고서가 읽는다.
       */
      const judged = results.filter((r) => r.kind !== "POOL_METRICS");
      expect(judged.length).toBeGreaterThan(0);
    },
    600_000,
  );
});
