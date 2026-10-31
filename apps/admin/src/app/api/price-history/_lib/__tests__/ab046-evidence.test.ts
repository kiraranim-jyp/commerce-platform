import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 AB046-EVIDENCE — **CEO 가 SAME 이라 한 그 후보 하나의 원본 증거**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 판정(2026-10-31): 「`CONFLICT 니까 버린다` 로 끝내면 안 된다.
 *    CEO 가 육안으로 SAME 이라 확인한 이력이 있다 ⟹ **원본 Evidence 를 보고**
 *    CPO 가 직접 `LIKELY / PRESUMED / POSSIBLE / EXCLUDE` 를 정한다.」
 *
 * ```
 * 원상품  B226AC010  Booty Ghosts Long Sleeve T-Shirt   (junioredition · 저장 canonicalProduct)
 * 후보    B226AB046  bobochoses.com/products/b226ab046-booty-ghosts-t-shirt
 * CEO 과거 = SAME   ·   현재 Identity = CONFLICT
 * ```
 *
 * 🔴 **이 파일은 아무것도 고치지 않는다** — threshold 0 · 8축 0 · Search 0 · Query 0.
 *    운영 함수를 운영 순서로 부르고 **그 산출을 전부 적는다**.
 * 🔴 게이트 `AB046_LIVE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.AB046_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const CANDIDATE_URL = "https://bobochoses.com/products/b226ab046-booty-ghosts-t-shirt";

describe("AB046-EVIDENCE — AC010(원상품) ↔ AB046(후보) 증거 대조", () => {
  it.runIf(LIVE)(
    "🔴 운영 경로로 한 쌍을 태우고 모든 증거 칸을 원문으로 적는다",
    async () => {
      const { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna, buildCrossSellerSearchQueries } =
        await import("@commerce/shared");
      const { factsFromProductUrl, withConfidence, enrichCandidatePrices, isSelfReferenceCandidate } = await import(
        "@commerce/crawler"
      );

      /* ── ① 원상품 — `/check` 와 같은 owner 둘 ── */
      const origins = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
        origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
      };
      const product = backfillCanonicalProduct(origins.origins.S1!.canonicalProduct as never);
      const dna = buildProductIdentityDna(product);
      const originFacts = productFactsFromIdentityDna(dna);
      /* eslint-disable no-console */
      console.log(`\n━━━━━━ 원상품 ${dna.brandModelCode} ━━━━━━`);
      console.log(JSON.stringify({ url: dna.sourceUrl, title: dna.title, brand: dna.brand, code: dna.brandModelCode, color: dna.color, identifier: dna.identifier }, null, 1));
      console.log(`원상품 facts = ${JSON.stringify(originFacts, null, 1)}`);
      console.log(`원상품 description = ${JSON.stringify(product.description?.value ?? null)}`);
      console.log(`원상품 material = ${JSON.stringify((product as { material?: { value?: string } }).material?.value ?? null)}`);

      /* ── ② 후보 — 운영 추출기 그대로 ── */
      const cf = await factsFromProductUrl(CANDIDATE_URL);
      console.log(`\n━━━━━━ 후보 ${CANDIDATE_URL} ━━━━━━`);
      console.log(`status=${cf.status} fetchPath=${(cf as { fetchPath?: string }).fetchPath} httpCalls=${(cf as { httpCalls?: number }).httpCalls}`);
      console.log(`후보 원문 = ${JSON.stringify(cf, null, 1).slice(0, 4000)}`);

      /** 🔴 자기참조인가 — CPO ②의 확인 지점. */
      console.log(`\n자기참조 판정(원상품↔후보) = ${isSelfReferenceCandidate(dna.sourceUrl, CANDIDATE_URL)}`);

      /* ── ③ 운영 판정 순서 ── */
      const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        searchTerm: terms[0] ?? dna.title,
        searchTerms: terms,
        facts: originFacts,
      };
      /**
       * 🔴🔴 **1차 하니스가 여기서 틀렸다 — 그대로 보고했으면 거짓 verdict 였다.**
       *    `factsFromProductUrl` 산출은 `{status, crawlerUrl, dedupeKey, **candidate**}` 이고
       *    제목·facts·가격은 **`candidate` 아래** 있다. 최상위에서 읽어 `title:""`·`facts:null`
       *    인 **빈 후보** 를 판정시켰고 「모델명 유사도 0%」라는 **하니스 산출물** 이 나왔다.
       *    (이 트랙의 「칸 이름을 추측했다」 그 함정 · 운영 `judgeDomesticCandidate` 는
       *     `res.candidates` 를 그대로 넘긴다.)
       */
      const raw = [cf.candidate];
      const scored = withConfidence(query as never, raw as never);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, "bobochoses.com", query as never);
      } catch {
        /* 운영과 같다 */
      }
      const c = priced[0] as unknown as Record<string, unknown>;
      console.log(`\n━━━━━━ 운영 판정 산출(전문) ━━━━━━`);
      console.log(JSON.stringify(c, null, 1).slice(0, 6000));

      writeFileSync(
        join(FIX, "ab046-evidence.json"),
        JSON.stringify(
          {
            origin: { url: dna.sourceUrl, title: dna.title, brand: dna.brand, code: dna.brandModelCode, color: dna.color, facts: originFacts, description: product.description?.value ?? null },
            candidate: { url: CANDIDATE_URL, extracted: cf, judged: c, selfReference: isSelfReferenceCandidate(dna.sourceUrl, CANDIDATE_URL) },
          },
          null,
          2,
        ),
      );
      expect(cf.status).toBeTruthy();
    },
    600_000,
  );
});
