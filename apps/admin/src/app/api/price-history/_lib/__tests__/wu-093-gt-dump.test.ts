import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  searchDomesticShops,
  withConfidence,
  isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-093 — **CEO 육안 GT 확보용 후보 덤프** (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시 2026-10-19: 「검색/매칭 로직을 고치는 것이 아니라 **실제 후보의 정답(GT)**
 *    을 확보하는 것이 목적이다.」
 * 🔴 금지(§8): SAME_MIN_AXES · threshold · title matching · **한국어 띄어쓰기 normalization** ·
 *    brand fallback · model code 완화 · color 완화 · category 완화 · matchLevel 승격 ·
 *    `very_high → SAME` · Registry · AI API · price gate · 가격 계산 · UI 본편 개편
 *
 * ── 🔴🔴 §6 — **하나도 거르지 않는다** ──────────────────────────────────────
 * 「very_high 라고 숨기거나 SAME 으로 처리하지 말 것 · SIMILAR/CONFLICT 라고 숨기지 말 것 ·
 *  상위 N개만 보여주지 말 것」 ⟹ 이 덤프는 **운영이 낸 후보 전부** 를 적는다.
 *
 * ── 🔴 §9 — CTO 는 판정하지 않는다 ─────────────────────────────────────────
 * 산출 JSON 에 `humanReview` 칸을 **비워서** 둔다. CTO 가 채우지 않는다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

/** 🟢 운영 DB 실측(2026-10-19 · `enabled AND collection_strategy LIKE 'AUTO%'`). */
const SHOPS = [
  { id: "1479ca9d-8a13-4cf2-813a-0e25ec3c9439", name: "CHOCO.EL(초코엘)", domain: "chocoel.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "03677bb2-da2d-4603-ba8c-67f673c8b245", name: "DEUXBEBE(듀베베)", domain: "deuxbebe.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "85b573b1-2f89-4a4f-a54c-40391d211800", name: "포레포레", domain: "foretforet.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "04e8aa1d-b430-4d4b-b453-1c9f7a808e23", name: "LITTLE LUNA(리틀루나)", domain: "littleluna.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "4de6b18e-cc58-4eb9-9def-b2fb96ef2350", name: "RULII(루리샵)", domain: "rulii.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];

/** 🔴 CEO/CPO 가 준 URL 을 **그대로** 쓴다. */
const CASES = [
  {
    id: "S1",
    code: "B226AC009",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/",
  },
  {
    id: "S2",
    code: "B226AC042",
    url: "https://bobochoses.com/en-kr/products/b226ac042-mystery-bc-half-zipped-sweatshirt?pr_prod_strat=similar&pr_rec_id=793ca40cb&pr_rec_pid=1569266t1588351&pr_ref_pid=15692661621119&pr_seq=uniform",
  },
] as const;

describe("WU-093 — 후보 전수 덤프 (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "원상품 + 샵별 후보 전부를 GT 검증용으로 적는다",
    async () => {
      const cases: Record<string, unknown>[] = [];
      for (const c of CASES) {
        const of_ = await factsFromProductUrl(c.url);
        const f = of_.candidate?.facts;
        const query: ComparisonQuery = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: f,
        } as ComparisonQuery;

        const origin = {
          url: c.url,
          expectCode: c.code,
          title: of_.candidate?.title ?? null,
          brand: f?.brand ?? null,
          /** 🔴 **없는 값은 `null` 로 둔다** — 화면이 「없음」이라고 적는다(지어내지 않는다). */
          modelCode: f?.brandModelCode ?? null,
          color: f?.colorText ?? null,
          price: of_.candidate?.price ?? null,
          imageUrl: of_.candidate?.imageUrl ?? null,
          status: of_.status,
          fetchPath: of_.fetchPath,
        };

        const results = await searchDomesticShops(query, SHOPS);
        const shops: Record<string, unknown>[] = [];
        for (const r of results) {
          const notSelf = (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
          const scored = withConfidence(query, notSelf);
          shops.push({
            shopName: r.shopName,
            domain: r.domain,
            /** 🔴 「후보 없음」과 「검색 실패」를 가른다(§7). */
            status: r.status,
            error: r.error ?? null,
            candidates: scored.map((x) => ({
              title: x.title,
              url: x.url,
              imageUrl: x.imageUrl ?? null,
              brand: x.facts?.brand ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
              color: x.facts?.colorText ?? null,
              price: x.price ?? null,
              market: classifyCandidateMarket({
                domain: r.domain,
                currency: x.price?.currency ?? null,
                /** 🔴 등록부 소속은 **충돌 감지용** 이다. 이 6곳은 전부 등록부 샵이다. */
                isRegisteredDomesticShop: true,
              }).market,
              /* ── 🔴 system 값은 «읽기만» 한다 (§9) ── */
              systemVerdict: x.crossSellerVerdict ?? null,
              systemMatchLevel: x.matchLevel ?? null,
              systemBlockers: (x.crossSellerBlockers ?? []).map((b) => (b as { blocker: string }).blocker),
              systemReasons: x.crossSellerReasons ?? [],
              /** 🔴 **CTO 가 채우지 않는다.** CEO 가 화면에서 채운다. */
              humanReview: null,
            })),
          });
        }
        const total = shops.reduce((n, s) => n + ((s.candidates as unknown[]).length ?? 0), 0);
        // eslint-disable-next-line no-console
        console.log(`\n════ ${c.id} ${c.code} ════  후보 **${total}건**`);
        for (const s of shops)
          // eslint-disable-next-line no-console
          console.log(`   ${String(s.domain).padEnd(20)} ${String(s.status).padEnd(8)} ${(s.candidates as unknown[]).length}건`);
        cases.push({ id: c.id, origin, shops, total });
      }
      writeFileSync(path.join(OUT, "wu-093-gt.json"), JSON.stringify({ cases }, null, 1));
      // eslint-disable-next-line no-console
      console.log(`\n🟢 wu-093-gt.json 작성 완료`);
      expect(cases).toHaveLength(2);
    },
    1_800_000,
  );
});
