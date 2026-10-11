/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 Coverage WU — STEP 3: Independent Ground Truth (§10 · §11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. Production 을 바꾸지 않는다.
 *
 * ── 🔴 왜 이것이 남은 최대 블로커인가 ─────────────────────────────────────
 *   `looxloo` 에는 운영 링크가 0 이므로 **CONTROL 이 존재하지 않는다**(§3-6).
 *   즉 GT 없이는 「looxloo 가 SAME 을 만들 수 있는가」를 판정할 수 없다.
 *
 * ── 🟢 독립 라벨러를 «만들지 않는다» ──────────────────────────────────────
 *   `vision-evidence.ts` 의 `observeVision(imgA, imgB)` 를 쓴다 —
 *     · 사진 두 장만 본다 → title·brand·품번과 **완전히 독립**
 *     · 🔴 「어떤 판정에도 입력으로 들어가지 않는다」(P0-A.29-B CEO 승인)
 *     · MI-P0-10 에서 **CEO 라벨 7/7 재현** 게이트를 통과했다
 *   🔴 임계값도 내가 고르지 않는다 — PROMPT 가 정의한 구간을 사전등록한다
 *      (≥80 clearly same · ≤50 probably different).
 *
 * ── GT strata (§10) ───────────────────────────────────────────────────────
 *   A 기존 링크 있음 / B 없음 · C 품번 있음 / D 없음 · E looxloo / F rulii /
 *   G 기존 정상 source. 🔴 `UNKNOWN` 은 Recall 분모에서 제외한다.
 *   🔴 사람이 SAME 이라고 본 것에 품번이 없다고 NOT_SAME 으로 만들지 않는다(§10).
 *
 * ── 🔴 라벨 어휘 ──────────────────────────────────────────────────────────
 *   KNOWN_SAME      운영 `verified=true`(사람이 눌렀다) **또는** Vision ≥80
 *   KNOWN_NOT_SAME  Vision ≤50
 *   UNKNOWN         이미지가 없어 Vision 을 돌릴 수 없다 → 🔴 분모에서 빼낸다
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct, buildCrossSellerSearchQueries, buildDomesticShopQuery,
  buildProductIdentityDna, productFactsFromIdentityDna,
} from "@commerce/shared";
import { fetchDomesticModelCode, searchDomesticShops, withConfidence } from "@commerce/crawler";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { observeVision } from "../vision-evidence";
import type { CanonicalProduct } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../".repeat(8));
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 사전등록 구간. `vision-evidence.ts` PROMPT 의 정의 그대로. */
const SAME_MIN = 80;
const DIFF_MAX = 50;

function loadGeminiKey(): void {
  if (process.env.GEMINI_API_KEY?.trim()) return;
  const p = path.join(REPO_ROOT, "scripts", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const hit = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (hit) process.env.GEMINI_API_KEY = hit[1].replace(/^["']|["']$/g, "");
  }
}
const absolute = (u: string | null | undefined): string | null =>
  !u ? null : u.startsWith("//") ? `https:${u}` : u;

interface SnapRow { id: string; title: string; workspace_id: string; cp: CanonicalProduct; links?: number }
interface SrcRow {
  id: string; name: string; domain: string; currency: string | null;
  collection_strategy: string | null; enabled: boolean; status: string;
}

/** 🔴 브랜드별 1개씩 — 한 브랜드가 strata 를 지배하면 편차를 못 본다. */
function stratify(rows: SnapRow[], cap: number): SnapRow[] {
  const seen = new Set<string>();
  const out: SnapRow[] = [];
  for (const r of rows) {
    const b = (r.cp?.brand?.value ?? "(none)").toLowerCase();
    if (seen.has(b)) continue;
    seen.add(b);
    out.push(r);
    if (out.length >= cap) break;
  }
  return out;
}

describe.skipIf(!LIVE)("🔴 DOM-RECOVERY-03 — Independent Ground Truth", () => {
  it(
    "looxloo·rulii·정상 source 후보에 독립 라벨을 붙여 GT 를 만든다",
    async () => {
      loadGeminiKey();
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const sources = read<SrcRow[]>("cov-sources.json");
      const noLink = read<SnapRow[]>("cov-nolink.json");
      const withLink = read<SnapRow[]>("cov-withlink.json");

      /** strata A(링크 있음) / B(링크 없음) × 브랜드 층화 */
      /** 🔴 분모를 키운다(STEP 6). 상한은 env 로 — 버린 건수를 리포트에 적는다. */
      const capA = Number(process.env.GT_CAP_A ?? 6);
      const capB = Number(process.env.GT_CAP_B ?? 20);
      const A = stratify(withLink, capA).map((r) => ({ row: r, strata: "A_링크있음" as const }));
      const B = stratify(noLink, capB).map((r) => ({ row: r, strata: "B_링크없음" as const }));
      const targets = [...A, ...B];

      /** E looxloo · F rulii · G 정상 source(foretforet·deuxbebe·littleluna) */
      const SHOPS = ["looxloo.com", "rulii.co.kr", "foretforet.com", "deuxbebe.com", "littleluna.co.kr"];
      const refs = sources
        .filter((s) => SHOPS.includes(s.domain))
        .map((s) => ({ id: s.id, name: s.name, domain: s.domain,
                       currency: s.currency ?? "KRW", collectionStrategy: s.collection_strategy ?? undefined }));

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let searchReq = 0, visionCalls = 0;
      const t0 = Date.now();

      for (const t of targets) {
        const product = backfillCanonicalProduct(t.row.cp);
        const dna = buildProductIdentityDna(product);
        /**
         * 🔴 칸 이름을 추측하지 않는다 — `CanonicalProductImage` 는 `originalUrl` 이고
         *    `ExtractedImage` 는 `url` 이다(MI-P0-05 에서 반대 방향으로 한 번 걸렸다).
         * 🟢 그리고 `isRepresentative` 가 있으므로 대표 이미지를 «먼저» 쓴다 —
         *    운영 Vision 경로도 대표 이미지를 쓴다(A-1 원소스 대표이미지).
         */
        const rep = product.images?.find((x) => x.isRepresentative) ?? product.images?.[0];
        const originImg = absolute(dna.imageUrls?.[0] ?? rep?.originalUrl ?? null);
        const query = {
          title: dna.title ?? t.row.title, brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl, sku: product.sku?.value || undefined,
          searchTerm: buildDomesticShopQuery(dna),
          searchTerms: buildCrossSellerSearchQueries(dna),
          facts: productFactsFromIdentityDna(dna),
        } as Parameters<typeof searchDomesticShops>[0];

        const results = await searchDomesticShops(query, refs as never);
        searchReq += refs.length;

        for (const r of results) {
          if (r.status !== "ok" || r.candidates.length === 0) {
            rows.push({ strata: t.strata, brand: dna.brand.value, shop: r.domain,
                        status: r.status, candidates: 0, label: "UNKNOWN",
                        labelReason: "🔴 후보 0건 — 미취급과 검색실패를 가르지 못한다" });
            continue;
          }
          const scored = withConfidence(query, r.candidates);
          /** 🔴 운영 판정 owner 로 tier 까지 간다 — 하니스가 verdict 를 만들지 않는다 */
          const j = await judgeDomesticCandidate({
            domain: r.domain, candidates: scored, sourceUrl: dna.sourceUrl,
            foreignModelCode: dna.brandModelCode ?? null, foreignColor: dna.color ?? null,
            fetchModelCode: async (u) => fetchDomesticModelCode(r.domain, u),
          });
          const gate = j.kind === "DROPPED" ? `DROPPED(${j.gate})` : j.kind;
          /**
           * 🟢🟢 STEP 5 — tier 를 **복제 계산하지 않는다.** `DomesticJudgement.JUDGED`
           *    에 `priceTier` 가 있고 주석이 「최종 owner 의 값」이라고 적어 뒀다
           *    (run-domestic-price-check.ts:504~). 1차에는 matchTruth 로 다시 계산했다.
           */
          const tier: string | null = j.kind === "JUDGED" ? j.priceTier : null;

          /**
           * 🔴🔴 STEP 4b 가 잡은 결함을 고친다 — 1차는 Vision 을 `scored[0]` 에
           *    돌렸고, `tier` 는 `judgeDomesticCandidate` 가 고른 **대표 후보** 기준이라
           *    **두 축이 서로 다른 후보** 를 가리켰다. 그래서 FP 9% 가 거짓이었다.
           * 🟢 `JUDGED` 에 `best: ComparisonCandidate` 가 있다 — 그것에 돌린다.
           */
          const top = j.kind === "JUDGED" ? j.best : scored[0];
          const candImg = absolute(top?.imageUrl ?? top?.facts?.imageUrls?.[0] ?? null);
          let score: number | null = null, reason: string | null = null, vstatus = "SKIPPED";
          if (originImg && candImg) {
            const o = await observeVision(originImg, candImg);
            visionCalls++;
            score = o.score ?? null; reason = o.reason; vstatus = o.status;
          } else vstatus = `NO_IMAGE(origin=${!!originImg} cand=${!!candImg})`;
          const label = score == null ? "UNKNOWN"
                      : score >= SAME_MIN ? "KNOWN_SAME"
                      : score <= DIFF_MAX ? "KNOWN_NOT_SAME" : "UNKNOWN";

          rows.push({
            strata: t.strata, brand: dna.brand.value, originTitle: String(t.row.title).slice(0, 56),
            hasModelCode: !!dna.brandModelCode, modelCode: dna.brandModelCode ?? null,
            shop: r.domain, candidates: r.candidates.length,
            topCandidateTitle: String(top?.title ?? "").slice(0, 56),
            /** 🔴 STEP 4 가 추출기를 직접 부르려면 URL 이 필요하다(1차에 빠뜨렸다). */
            topCandidateUrl: top?.url ?? null,
            topCandidateSku: top?.sku ?? null,
            topCandidateFactsCode: top?.facts?.brandModelCode ?? null,
            /** 🟢 타입에서 읽은 칸 그대로 — `as unknown as` 캐스트를 쓰지 않는다. */
            judgedDomesticModelCode: j.kind === "JUDGED" ? j.domesticModelCode : null,
            judgedModelEvidence: j.kind === "JUDGED" ? j.modelCodeEvidence : null,
            judgedMatchTruth: j.kind === "JUDGED" ? j.matchTruth : null,
            /** 🔴 두 축이 같은 후보를 보는지 «확인» 하는 칸. 다르면 그 행은 무효다. */
            visionTargetIsJudgedBest: j.kind === "JUDGED",
            topConfidence: typeof top?.confidence === "number" ? Number(top.confidence.toFixed(3)) : null,
            topMatchLevel: top?.matchLevel ?? null, crossSellerVerdict: top?.crossSellerVerdict ?? null,
            gate, tier,
            visionStatus: vstatus, visionScore: score, visionReason: reason,
            /** 🟢 독립 라벨. 🔴 UNKNOWN 은 Recall 분모에서 뺀다. */
            label,
            labelReason: score == null ? `🔴 Vision 불가 — ${vstatus}` : `Vision ${score}`,
            /** 🔴 TP/FP 판정 — 운영 tier 가 EXACT/COMPARISON 이면 「SAME 으로 썼다」로 본다 */
            usedAsSame: tier === "EXACT" || tier === "COMPARISON",
            /**
             * 🔴🔴 STEP 7-① 금액 — FP 가 `domesticLowestPriceKrw` 를 «얼마나» 움직이는가.
             *    가격이 같으면 영향 0 이다. 🔴 통화를 섞지 않는다.
             */
            originPriceKrw: product.priceOverrideKrw?.value ?? null,
            originPrice: product.price?.value ?? null,
            candidatePrice: top?.price ?? null,
            candidateSoldOut: top?.soldOut ?? null,
            /**
             * 🔴🔴 STEP 7-② 미회수 원인 — KNOWN_SAME 인데 tier 가 없는 행의 이유.
             *    「게이트 탈락」과 「대표 후보가 다른 상품」을 가른다.
             */
            notRecoveredReason: tier !== null ? null
              : j.kind === "NO_CANDIDATES" ? "NO_CANDIDATES"
              : j.kind === "DROPPED" ? `GATE_${j.gate}`
              : "UNKNOWN_SHAPE",
            droppedObservedCandidate: j.kind === "DROPPED"
              ? String(j.observed.candidate.title ?? "").slice(0, 56) : null,
            droppedModelEvidence: j.kind === "DROPPED" ? (j.observed.modelCodeEvidence ?? null) : null,
            droppedInitialMatchType: j.kind === "DROPPED" ? (j.observed.initialMatchType ?? null) : null,
          });
          // eslint-disable-next-line no-console
          console.log(`${t.strata} ${String(dna.brand.value).slice(0, 14).padEnd(15)} ${r.domain.split(".")[0].padEnd(11)} ` +
            `cand=${String(r.candidates.length).padStart(2)} tier=${String(tier).padEnd(10)} vision=${String(score ?? "-").padStart(4)} ${label}`);
        }
      }

      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const labeled = rows.filter((r) => r.label !== "UNKNOWN");
      const knownSame = rows.filter((r) => r.label === "KNOWN_SAME");
      const knownNot = rows.filter((r) => r.label === "KNOWN_NOT_SAME");
      /** 🔴 Recall 분모는 KNOWN_SAME «만». UNKNOWN 을 넣지 않는다. */
      const recovered = knownSame.filter((r) => r.usedAsSame);
      const falseSame = knownNot.filter((r) => r.usedAsSame);

      const report = {
        scope: {
          note: `🔴 sample N=${targets.length} 상품 × ${refs.length} 샵. 전수가 아니다.`,
          labeler: "observeVision — 판정에 입력되지 않는 독립 관측기(MI-P0-10 에서 CEO 라벨 7/7 재현)",
          preRegistered: { SAME_MIN, DIFF_MAX, source: "vision-evidence.ts PROMPT 구간" },
          "🔴 UNKNOWN 규칙": "이미지 없음/후보 0건 → UNKNOWN. Recall 분모에서 제외한다.",
          "🔴 하지 않은 것": "threshold 변경 · no-code SAME 승격 · 가드 완화 · Production 변경",
        },
        labelCoverage: {
          pairs: rows.length, labeled: labeled.length, unknown: rows.length - labeled.length,
          /** 🔴 UNKNOWN 을 한 덩어리로 두지 않는다 — 원인이 다르면 처방이 다르다. */
          unknownReason: count(rows.filter((r) => r.label === "UNKNOWN"), (r) => {
            const s2 = String(r.labelReason ?? "");
            return s2.includes("후보 0건") ? "후보 0건(미취급↔검색실패 미분리)"
                 : s2.includes("NO_IMAGE") ? "이미지 없음(어댑터가 채우지 않음)"
                 : s2.includes("UNCERTAIN") || s2.includes("51") ? "Vision UNCERTAIN(51~79)"
                 : `기타(${s2.slice(0, 40)})`;
          }),
          /** 🟢 샵별 이미지 확보율 — 어느 샵에서 GT 를 만들 수 있는가 */
          imageAvailabilityByShop: count(rows, (r) =>
            `${r.shop} ${String(r.visionStatus ?? "").startsWith("NO_IMAGE") ? "이미지없음" : r.candidates === 0 ? "후보0" : "이미지있음"}`),
        },
        byLabel: count(rows, (r) => String(r.label)),
        byStrataLabel: count(rows, (r) => `${r.strata} × ${r.label}`),
        byShopLabel: count(rows, (r) => `${r.shop} × ${r.label}`),
        byCodeLabel: count(rows, (r) => `${r.hasModelCode ? "품번있음" : "품번없음"} × ${r.label}`),
        /** 🔴🔴 SAME Yield — 분모는 KNOWN_SAME 만 */
        sameYield: {
          eligibleKnownSame: knownSame.length,
          recoveredAsSame: recovered.length,
          recall: knownSame.length === 0 ? "🔴 측정불가(분모 0)"
                : `${Math.round((100 * recovered.length) / knownSame.length)}%`,
          byShop: count(knownSame, (r) => `${r.shop} ${r.usedAsSame ? "회수" : "미회수"}`),
        },
        /** 🔴 FP 도 같이 센다(§14) */
        falsePositive: {
          knownNotSame: knownNot.length,
          falseSame: falseSame.length,
          rate: knownNot.length === 0 ? "🔴 측정불가(분모 0)"
              : `${Math.round((100 * falseSame.length) / knownNot.length)}%`,
          cases: falseSame.map((r) => ({ brand: r.brand, shop: r.shop, tier: r.tier,
                                         origin: r.originTitle, candidate: r.topCandidateTitle,
                                         vision: r.visionScore, reason: r.visionReason })),
        },
        /** 🔴🔴 STEP 7-① FP 의 금액 영향 */
        fpPriceImpact: {
          note: "🔴 가격이 같으면 FP 의 금액 영향은 0 이다. 통화를 섞지 않았다.",
          cases: falseSame.map((r) => ({
            brand: r.brand, shop: r.shop, tier: r.tier,
            origin: r.originTitle, candidate: r.topCandidateTitle,
            originPriceKrw: r.originPriceKrw, originPrice: r.originPrice,
            candidatePrice: r.candidatePrice, candidateSoldOut: r.candidateSoldOut,
            vision: r.visionScore,
          })),
        },
        /** 🔴🔴 STEP 7-② KNOWN_SAME 인데 회수 못 한 행의 원인 */
        notRecovered: {
          note: "🔴 「게이트 탈락」과 「대표 후보가 다른 상품」을 가른다.",
          count: knownSame.filter((r) => !r.usedAsSame).length,
          byReason: count(knownSame.filter((r) => !r.usedAsSame), (r) => String(r.notRecoveredReason)),
          cases: knownSame.filter((r) => !r.usedAsSame).map((r) => ({
            brand: r.brand, shop: r.shop, origin: r.originTitle,
            candidate: r.topCandidateTitle, vision: r.visionScore,
            reason: r.notRecoveredReason,
            droppedCandidate: r.droppedObservedCandidate,
            droppedEvidence: r.droppedModelEvidence,
            droppedMatchType: r.droppedInitialMatchType,
          })),
        },
        byGate: count(rows, (r) => String(r.gate ?? "-")),
        byTier: count(rows.filter((r) => r.tier), (r) => String(r.tier)),
        cost: { shopSearchRequests: searchReq, visionCalls, elapsedMs: Date.now() - t0 },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domrec-ground-truth.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThan(0);
    },
    240 * 60 * 1000,
  );
});
