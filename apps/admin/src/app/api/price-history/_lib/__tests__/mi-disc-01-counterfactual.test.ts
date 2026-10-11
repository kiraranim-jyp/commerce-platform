/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Discovery WU — STEP A~F: **COUNTERFACTUAL / NON-PRODUCTION DISCOVERY**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일의 숫자는 Production Discovery 성능이 «아니다».**
 *   §3 Preflight 가 확정했다 — External Discovery(Google/Gemini/Naver)에는 운영
 *   호출부가 **0** 이고 `NAVER_SHOPPING` 은 DB 에 **0행** 이다. 운영 Discovery 는
 *   `SELLER_ORIGIN`(가격 재확인) · `DOMESTIC_SHOP`(어댑터, 별 WU 에서 CLOSED) 둘뿐이다.
 *   → 그래서 CPO 가 질문을 전환 승인했다:
 *     「현재 운영에 없는 Gemini Discovery 를 **도입했을 때** Candidate Recall →
 *       MI Identity → Price/Seller Decision 까지 사업적 가치가 있는가」
 *   🔴 보고에 반드시 `COUNTERFACTUAL / NON-PRODUCTION DISCOVERY MEASUREMENT` 를 적는다.
 *
 * ── 🔴 하지 않는 것 (CPO §16) ─────────────────────────────────────────────
 *   새 Discovery API 구현 ✗ · Production 연결 ✗ · 국내 Coverage 재개 ✗ ·
 *   query/prompt 확장 ✗ · threshold 완화 ✗ · no-code SAME 승격 ✗ ·
 *   Vision 을 판정 입력으로 편입 ✗ · UniversalExtract fallback ✗
 *
 * ── 🟢 §5-B CONTROL ──────────────────────────────────────────────────────
 *   판정 사슬은 **운영 owner 그대로** 다 —
 *     `withConfidence` → `judgeDomesticCandidate` → `JUDGED.priceTier`
 *   그 사슬은 `dom-recovery-02` 에서 운영 tier 를 **EXACT 축 8/8 재현** 했다.
 *   🔴 이 파일은 tier 를 **복제 계산하지 않는다**(owner 의 `priceTier` 를 쓴다).
 *   🔴 독립 라벨은 owner 가 고른 `JUDGED.best` 에 돌린다(scored[0] 아님 — 선행 WU
 *      에서 그 혼동이 거짓 FP 를 만들었다).
 *
 * ── 입력: 캐시된 Gemini 후보 (새 Gemini 호출 0) ───────────────────────────
 *   `mi-p0-03-levels.json`          golden 7 상품 · recs 35 · 후보 461
 *   `mi-p0-03-candidate-quality.json` details 456 (readable 195 · crawlerUrl 230)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { observeVision } from "../vision-evidence";
// 🔴 `ProductFacts` 의 owner 는 @commerce/shared 다(선행 WU 와 동일 — 추측하지 않는다).
import type { ComparisonCandidate, ComparisonQuery } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../".repeat(8));
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 사전등록 구간. `vision-evidence.ts` PROMPT 정의 그대로. */
const SAME_MIN = 80;
const DIFF_MAX = 50;
/** 🔴 비용 상한. 넘겨 버린 건수는 리포트에 적는다. */
const MAX_VISION = Number(process.env.MI_DISC_MAX_VISION ?? 60);

function loadGeminiKey(): void {
  if (process.env.GEMINI_API_KEY?.trim()) return;
  const p = path.join(REPO_ROOT, "scripts", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const hit = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (hit) process.env.GEMINI_API_KEY = hit[1].replace(/^["']|["']$/g, "");
  }
}
const abs = (u: string | null | undefined): string | null =>
  !u ? null : u.startsWith("//") ? `https:${u}` : u;
const hostOf = (u: string): string => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "?"; }
};

interface Golden { host: string; url: string; brand: string; title: string; code: string | null }
interface Rec { url: string; level: string; discovered: { url: string; title: string | null }[]; usage?: { totalTokens?: number } }
interface Det { url: string; classification: string; crawlerUrl: string | null; readable: boolean }

describe.skipIf(!LIVE)("🔴 MI-DISC-01 — COUNTERFACTUAL Discovery → Identity → Decision", () => {
  it(
    "캐시된 Gemini 후보를 운영 판정 사슬에 넣고 Recall/Precision/FP/비용을 «분리» 산출한다",
    async () => {
      loadGeminiKey();
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const { golden, recs } = read<{ golden: Golden[]; recs: Rec[] }>("mi-p0-03-levels.json");
      const det = new Map(read<{ details: Det[] }>("mi-p0-03-candidate-quality.json").details.map((d) => [d.url, d]));

      /* ── 원상품 facts (Light Fetch) ── */
      const origins = new Map<string, ProductFacts>();
      const originFail: string[] = [];
      let lightFetchCalls = 0;
      for (const g of golden) {
        const r = await factsFromProductUrl(g.url); lightFetchCalls++;
        if (r.candidate?.facts) origins.set(g.url, r.candidate.facts);
        else originFail.push(`${g.host} ${r.status}`);
      }

      /* ── 후보 ComparisonCandidate 를 한 번만 만든다 ── */
      const candById = new Map<string, ComparisonCandidate | null>();
      const candUrls = [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))];
      for (const u of candUrls) {
        const d = det.get(u);
        if (!d?.readable || !d.crawlerUrl) { candById.set(u, null); continue; }
        const r = await factsFromProductUrl(d.crawlerUrl); lightFetchCalls++;
        candById.set(u, r.candidate?.facts ? r.candidate : null);
      }

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let visionCalls = 0, visionSkippedByCap = 0, judgeCalls = 0;
      const t0 = Date.now();

      for (const g of golden) {
        const of_ = origins.get(g.url);
        if (!of_) continue;
        const originImg = abs(of_.imageUrls?.[0] ?? null);
        const query: ComparisonQuery = {
          title: of_.title, brand: of_.brand ?? undefined, sourceUrl: g.url, facts: of_,
        };

        /** 🔴 후보를 «도메인별» 로 묶는다 — judgeDomesticCandidate 는 domain 단위다. */
        const seen = new Set<string>();
        const byHost = new Map<string, ComparisonCandidate[]>();
        for (const r of recs.filter((x) => x.url === g.url)) {
          for (const d of r.discovered ?? []) {
            if (seen.has(d.url)) continue;
            seen.add(d.url);
            if (isSelfReferenceCandidate(g.url, d.url)) continue;
            const c = candById.get(d.url);
            if (!c) continue;
            const h = hostOf(c.url);
            (byHost.get(h) ?? byHost.set(h, []).get(h)!).push(c);
          }
        }

        for (const [host, cands] of byHost) {
          const scored = withConfidence(query, cands);
          /** 🔴 판정은 운영 owner 가 한다. tier 를 복제 계산하지 않는다. */
          const j = await judgeDomesticCandidate({
            domain: host, candidates: scored, sourceUrl: g.url,
            foreignModelCode: of_.brandModelCode ?? null, foreignColor: of_.colorText ?? null,
            // 🔴 Gemini 후보 도메인에는 추출기가 없다 — null 이 «정상» 이다(지어내지 않는다).
            fetchModelCode: async () => null,
          });
          judgeCalls++;
          const gate = j.kind === "DROPPED" ? `DROPPED(${j.gate})` : j.kind;
          const tier = j.kind === "JUDGED" ? j.priceTier : null;
          const best = j.kind === "JUDGED" ? j.best : null;

          /** 🟢 독립 라벨 — owner 가 고른 `best` 에만 돌린다. 비용 상한을 둔다. */
          let score: number | null = null, reason: string | null = null, vstatus = "NOT_JUDGED";
          if (best) {
            const candImg = abs(best.imageUrl ?? best.facts?.imageUrls?.[0] ?? null);
            if (!originImg || !candImg) vstatus = `NO_IMAGE(o=${!!originImg} c=${!!candImg})`;
            else if (visionCalls >= MAX_VISION) { vstatus = "SKIPPED_BY_CAP"; visionSkippedByCap++; }
            else {
              const o = await observeVision(originImg, candImg); visionCalls++;
              score = o.score ?? null; reason = o.reason; vstatus = o.status;
            }
          }
          const label = score == null ? "UNKNOWN"
                      : score >= SAME_MIN ? "KNOWN_SAME"
                      : score <= DIFF_MAX ? "KNOWN_NOT_SAME" : "UNKNOWN";
          /** 🔴 MI 가 「SAME 으로 썼다」의 정의 — tier 가 EXACT/COMPARISON 이면 가격에 쓰인다. */
          const miUsedAsSame = tier === "EXACT" || tier === "COMPARISON";
          /** 🔴 same-brand 오탐 축(§10) — 브랜드는 같은데 상품이 다른가 */
          const sameBrand = !!(of_.brand && best?.facts?.brand
            && of_.brand.toLowerCase().split(" ")[0] === best.facts.brand.toLowerCase().split(" ")[0]);

          rows.push({
            originHost: g.host, originBrand: g.brand, originTitle: g.title.slice(0, 54),
            originHasCode: !!of_.brandModelCode, originCode: of_.brandModelCode ?? null,
            candidateHost: host, candidateCount: cands.length,
            gate, tier, miUsedAsSame,
            bestTitle: best ? String(best.title).slice(0, 54) : null,
            bestConfidence: typeof best?.confidence === "number" ? Number(best.confidence.toFixed(3)) : null,
            bestMatchLevel: best?.matchLevel ?? null,
            bestCrossSeller: best?.crossSellerVerdict ?? null,
            bestPrice: best?.price ?? null, bestSoldOut: best?.soldOut ?? null,
            visionStatus: vstatus, visionScore: score, visionReason: reason, label,
            sameBrandDifferentProduct: sameBrand && label === "KNOWN_NOT_SAME",
          });
          // eslint-disable-next-line no-console
          console.log(`${g.brand.slice(0, 13).padEnd(14)} ${host.slice(0, 22).padEnd(23)} n=${String(cands.length).padStart(2)} ` +
            `tier=${String(tier).padEnd(10)} vision=${String(score ?? "-").padStart(4)} ${label}`);
        }
      }

      /* ── 집계: Recall / Precision / FP / FN «분리» (§9) ── */
      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const labeled = rows.filter((r) => r.label !== "UNKNOWN");
      const kSame = rows.filter((r) => r.label === "KNOWN_SAME");
      const kNot = rows.filter((r) => r.label === "KNOWN_NOT_SAME");
      const miSame = rows.filter((r) => r.miUsedAsSame);

      const report = {
        "🔴 DISCLAIMER": "COUNTERFACTUAL / NON-PRODUCTION DISCOVERY MEASUREMENT — " +
          "이 숫자는 Production Discovery 성능이 아니다. External Discovery 는 운영 호출부 0 이다.",
        scope: {
          note: `🔴 sample N=${golden.length} 원상품 · 후보 URL ${candUrls.length} · (상품×호스트) 쌍 ${rows.length}. 전수가 아니다.`,
          input: "캐시된 Gemini 후보(mi-p0-03) — 새 Gemini Discovery 호출 0",
          ownerChain: "withConfidence → judgeDomesticCandidate → JUDGED.priceTier (복제 계산 없음)",
          controlRef: "§5-B: dom-recovery-02 가 운영 tier 를 EXACT 축 8/8 재현(PASS)",
          visionTarget: "🟢 owner 가 고른 JUDGED.best (scored[0] 아님)",
          originFactsMissing: originFail,
          visionCap: MAX_VISION, visionSkippedByCap,
        },
        /** ① Discovery Recall 은 «후보 pool 에 KNOWN_SAME 이 들어왔는가» 다 */
        discoveryRecall: {
          note: "🔴 분모는 라벨된 쌍뿐이다. UNKNOWN 은 제외한다(측정불가 ≠ 0).",
          labeledPairs: labeled.length, unknownPairs: rows.length - labeled.length,
          unknownReason: count(rows.filter((r) => r.label === "UNKNOWN"), (r) => String(r.visionStatus)),
          knownSamePairsInPool: kSame.length,
          productsWithAnyKnownSame: new Set(kSame.map((r) => r.originTitle)).size,
          ofProducts: golden.length,
        },
        /** ② MI Precision = MI 가 SAME 으로 쓴 것 중 실제 KNOWN_SAME 비율 */
        miPrecision: (() => {
          const denom = miSame.filter((r) => r.label !== "UNKNOWN").length;
          const tp = miSame.filter((r) => r.label === "KNOWN_SAME").length;
          return { miUsedAsSame: miSame.length, labeledAmongThem: denom, truePositive: tp,
                   precision: denom === 0 ? "🔴 측정불가(분모 0)" : `${Math.round((100 * tp) / denom)}%` };
        })(),
        /** ③ MI Recall = KNOWN_SAME 중 MI 가 실제로 쓴 비율 */
        miRecall: {
          eligibleKnownSame: kSame.length,
          recovered: kSame.filter((r) => r.miUsedAsSame).length,
          recall: kSame.length === 0 ? "🔴 측정불가(분모 0)"
                : `${Math.round((100 * kSame.filter((r) => r.miUsedAsSame).length) / kSame.length)}%`,
          missedCases: kSame.filter((r) => !r.miUsedAsSame).map((r) => ({
            brand: r.originBrand, host: r.candidateHost, gate: r.gate,
            origin: r.originTitle, best: r.bestTitle, vision: r.visionScore,
          })),
        },
        /** ④ False Positive — 특히 same-brand / different-product (§10) */
        falsePositive: (() => {
          const fp = kNot.filter((r) => r.miUsedAsSame);
          return {
            knownNotSame: kNot.length, falseSame: fp.length,
            rate: kNot.length === 0 ? "🔴 측정불가(분모 0)" : `${Math.round((100 * fp.length) / kNot.length)}%`,
            sameBrandDifferentProductTotal: rows.filter((r) => r.sameBrandDifferentProduct).length,
            sameBrandFalseSame: fp.filter((r) => r.sameBrandDifferentProduct).length,
            byTier: count(fp, (r) => String(r.tier)),
            cases: fp.map((r) => ({ brand: r.originBrand, host: r.candidateHost, tier: r.tier,
                                    origin: r.originTitle, best: r.bestTitle,
                                    vision: r.visionScore, reason: r.visionReason })),
          };
        })(),
        /** ⑤ Price / Seller Decision 축 */
        priceAxis: {
          byTier: count(rows.filter((r) => r.tier), (r) => String(r.tier)),
          usableSame: kSame.filter((r) => r.miUsedAsSame && r.bestPrice).length,
          samePriceUnavailable: kSame.filter((r) => r.miUsedAsSame && !r.bestPrice).length,
          /** 🔴🔴 EXACT 가 하나라도 생기면 COMPARISON 전체가 무시된다(price-history:644) */
          productsGainingExact: new Set(rows.filter((r) => r.tier === "EXACT").map((r) => r.originTitle)).size,
          note: "🔴 Seller Decision 변화는 기존 운영 tier 와 대조해야 한다 — 별 단계(§13)",
        },
        byGate: count(rows, (r) => String(r.gate)),
        byHostLabel: count(rows, (r) => `${r.candidateHost} × ${r.label}`),
        byCodeLabel: count(rows, (r) => `${r.originHasCode ? "품번있음" : "품번없음"} × ${r.label}`),
        /** ⑥ Cost (§15) */
        cost: {
          lightFetchCalls, judgeCalls, visionCalls, elapsedMs: Date.now() - t0,
          geminiDiscoveryCalls: 0,
          geminiDiscoveryTokensFromCache: recs.reduce((s, r) => s + (r.usage?.totalTokens ?? 0), 0),
          perProduct: {
            lightFetch: Number((lightFetchCalls / golden.length).toFixed(1)),
            vision: Number((visionCalls / golden.length).toFixed(1)),
          },
          costPerUsableSame: kSame.filter((r) => r.miUsedAsSame && r.bestPrice).length === 0
            ? "🔴 측정불가(분모 0)"
            : `lightFetch ${(lightFetchCalls / kSame.filter((r) => r.miUsedAsSame && r.bestPrice).length).toFixed(1)}회/건`,
        },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-disc-counterfactual.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThan(0);
    },
    240 * 60 * 1000,
  );
});
