import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  searchDomesticShops, withConfidence, isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";
/** 🔴 barrel 에 없다 — owner 파일에서 직접 가져온다. */
import { classifyMatchLevel } from "@commerce/crawler/src/comparison-search/match";
import { selectCandidatesForDetailConfirmation } from "@commerce/crawler/src/comparison-search/price-confirmation";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { toDomesticMatchType } from "../../../domestic-price-sources/_lib/domestic-product-link";
/** 🔴 rank 의 1순위 입력 — 운영 `selectCandidatesForDetailConfirmation` 이 쓰는 그 함수다. */
import { deriveProductMatchTruth } from "@commerce/crawler/src/comparison-search/product-identity";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-094 — **`matchLevel very_high` 의 의미와 사용처** (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §5: SAME threshold ❌ · 8축 ❌ · `very_high → SAME` ❌ · title normalization ❌ ·
 *    brand fallback ❌ · color ❌ · model-code ❌ · Registry ❌ · AI ❌ · UI ❌ · 가격 정책 ❌
 *    「**코드 변경 필요 없으면 0줄로 종료한다**」
 *
 * 🔴 §3 — **모집단을 섞지 않는다**. 이 하니스는 **③ WU-093 CEO 검증 후보** 만 다룬다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const GT = JSON.parse(readFileSync(path.join(__dirname, "fixtures/wu-093-human-gt.json"), "utf8"))
  .humanReview as { id: string; verdict: string; note: string | null }[];

const SHOPS = [
  { id: "1479ca9d-8a13-4cf2-813a-0e25ec3c9439", name: "CHOCO.EL(초코엘)", domain: "chocoel.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "03677bb2-da2d-4603-ba8c-67f673c8b245", name: "DEUXBEBE(듀베베)", domain: "deuxbebe.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "85b573b1-2f89-4a4f-a54c-40391d211800", name: "포레포레", domain: "foretforet.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "04e8aa1d-b430-4d4b-b453-1c9f7a808e23", name: "LITTLE LUNA(리틀루나)", domain: "littleluna.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
  { id: "4de6b18e-cc58-4eb9-9def-b2fb96ef2350", name: "RULII(루리샵)", domain: "rulii.co.kr", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];
const CASES = [
  { id: "S1", code: "B226AC009", url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/" },
  { id: "S2", code: "B226AC042", url: "https://bobochoses.com/en-kr/products/b226ac042-mystery-bc-half-zipped-sweatshirt?pr_prod_strat=similar&pr_rec_id=793ca40cb&pr_rec_pid=1569266t1588351&pr_ref_pid=15692661621119&pr_seq=uniform" },
] as const;

describe("WU-094 — matchLevel 의미/사용처 (LIVE)", () => {
  (LIVE ? it : it.skip)("STEP2 GT 대조 · STEP4 가격경로 도달", async () => {
    /** 🟢 STEP1 보조 — 경계가 **confidence 하나의 순수 함수** 임을 운영 함수로 확인한다. */
    const boundary = [0.94, 0.95, 0.9499, 0.85, 0.7, 0.69].map((x) => `${x}→${classifyMatchLevel(x)}`);
    // eslint-disable-next-line no-console
    console.log(`\n🟢 STEP1 — classifyMatchLevel 은 confidence 의 순수 함수: ${boundary.join(" · ")}`);

    const rows: Record<string, unknown>[] = [];
    for (const c of CASES) {
      const of_ = await factsFromProductUrl(c.url);
      const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;
      const res = await searchDomesticShops(q, SHOPS);
      const scoredResults = res.map((r) => ({
        ...r,
        candidates: withConfidence(q, (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url))),
      }));
      /** 🟢 **운영 owner 를 그대로 부른다** — matchTruth 를 복제 계산하지 않는다. */
      const truthed = await attachMatchTruth(scoredResults, q.facts?.brandModelCode ?? null, q.facts?.colorText ?? null);
      for (const r of truthed) {
        /**
         * 🟢 STEP4 — 운영 가격 상세확인 자격 게이트를 **그대로** 부른다.
         * 🔴🔴 **이 함수는 «인덱스»(`number[]`)를 돌려준다.** 1차에 후보 «객체» 로
         *    조회해서 **전건 false** 가 나왔고, 그대로 보고했으면
         *    「very_high 인데 가격 자격 0」이라는 **거짓 결론** 이었다.
         *    🟢 owner 서명을 읽고 고쳤다(WU-088 에서는 인덱스로 올바르게 썼다).
         */
        const sel = new Set(selectCandidatesForDetailConfirmation(r.candidates, q));
        r.candidates.forEach((x, i) => {
          const id = `${c.id}-${r.domain}-${i + 1}`;
          const g = GT.find((y) => y.id === id);
          rows.push({
            id, case: c.id, title: x.title,
            confidence: x.confidence ?? null,
            matchLevel: x.matchLevel ?? null,
            /** 🔴 `very_high` 가 **어디로 흘러가는가** 를 운영 함수로 읽는다. */
            domesticMatchType: toDomesticMatchType(x.matchLevel ?? "low"),
            matchTruth: x.matchTruth ?? null,
            verdict: x.crossSellerVerdict ?? null,
            priceEligible: sel.has(i),
            /** 🔴 **왜 그 2칸에 앉았는가** — 운영 rank 의 1순위 입력을 그대로 읽는다. */
            productTruth: deriveProductMatchTruth(q, x, x.confidence),
            human: g?.verdict ?? null, note: g?.note ?? null,
          });
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\n── STEP2 전수 (N=${rows.length}) ──`);
    for (const r of rows)
      // eslint-disable-next-line no-console
      console.log(
        `  ${String(r.id).padEnd(20)} conf=${String(r.confidence).slice(0, 6).padEnd(7)} lvl=${String(r.matchLevel).padEnd(10)} ` +
          `→매치타입 ${String((r.domesticMatchType as { matchType: string }).matchType).padEnd(16)} truth=${String(r.matchTruth).padEnd(18)} ` +
          `verdict=${String(r.verdict).padEnd(9)} pTruth=${String(r.productTruth).padEnd(18)} 가격자격=${r.priceEligible ? "🟢" : "🔴"} human=${r.human}`,
      );

    const n = (f: (r: Record<string, unknown>) => boolean) => rows.filter(f).length;
    // eslint-disable-next-line no-console
    console.log(`\n── STEP2 교차표 (🔴 N=${rows.length} · 1상품 2건 · 일반화 금지) ──`);
    for (const lv of ["very_high", "high", "medium", "low"])
      // eslint-disable-next-line no-console
      console.log(
        `  ${lv.padEnd(10)} 합 ${n((r) => r.matchLevel === lv)} | human SAME ${n((r) => r.matchLevel === lv && r.human === "SAME")} · DIFFERENT ${n((r) => r.matchLevel === lv && r.human === "DIFFERENT")} ` +
          `| verdict SAME ${n((r) => r.matchLevel === lv && r.verdict === "SAME")} · SIMILAR ${n((r) => r.matchLevel === lv && r.verdict === "SIMILAR")} · CONFLICT ${n((r) => r.matchLevel === lv && r.verdict === "CONFLICT")} · UNKNOWN ${n((r) => r.matchLevel === lv && r.verdict === "UNKNOWN")}`,
      );
    // eslint-disable-next-line no-console
    console.log(`\n── STEP4 가격 상세확인 자격 ──  very_high 중 ${n((r) => r.matchLevel === "very_high" && r.priceEligible === true)}/${n((r) => r.matchLevel === "very_high")} · 전체 ${n((r) => r.priceEligible === true)}/${rows.length}`);
    // eslint-disable-next-line no-console
    /** 🔴 reduce 의 누적 타입을 명시한다 — 생략하면 `{}` 로 추론돼 `+` 가 막힌다. */
    const truthDist: Record<string, number> = {};
    for (const r of rows) truthDist[String(r.matchTruth)] = (truthDist[String(r.matchTruth)] ?? 0) + 1;
    // eslint-disable-next-line no-console
    console.log(`── matchTruth 분포 ──  ${JSON.stringify(truthDist)}`);

    writeFileSync(path.join(OUT, "wu-094.json"), JSON.stringify(rows, null, 1));
    expect(rows).toHaveLength(10);
  }, 1_800_000);
});
