/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-12 ②④⑥ — EXACT 버킷 정확도를 «전수» 로 확정한다 (CPO 지시, 2026-10-12)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. **DB 를 쓰지 않는다**(선행
 *    읽기 전용 스크립트가 덤프한 JSON 만 읽는다).
 *
 * ── 🔴🔴 왜 EXACT 버킷 «하나» 만 재는가 — 돈이 거기서만 움직인다 ───────────
 *   priceTierFromLink(domestic-product-link.ts:86)
 *     → market-intelligence.ts:113-122  tier 로 버킷 분리
 *     → summarizeDomesticMarketSplit(price-history.ts:644-646)
 *         🔴 `if (exact.sellerCount > 0) resolved = exact`  ← COMPARISON 전체 무시
 *     → computePriceDecision / buildSellerDecision (domesticLowestPriceKrw)
 *
 *   즉 **EXACT 에 잘못 들어온 한 건이 「동일상품 최저가」가 된다.** 반대로 FN 은
 *   COMPARISON 으로 내려가도 EXACT 가 비면 여전히 쓰이므로 손실이 작다.
 *
 * ── 운영 전수 실측 (domestic_product_links 88행 / 스냅샷 69개) ──────────────
 *   tier    EXACT 58 · REFERENCE 18 · COMPARISON 12
 *   EXACT 가 «무엇으로» 결정됐나
 *     품번 STRONG_IDENTIFIER 31 · 품번 EXACT_IDENTIFIER 23 · 사람확인(verified) 4
 *   EXACT 의 crossSellerVerdict
 *     🔴 (null) 46 · SIMILAR 11 · SAME 1     ← 79% 가 교차판매처 반증을 안 거쳤다
 *   증폭 실측: EXACT 개수 분포 {0:11, 1:58} — EXACT 는 항상 0 또는 1 이고
 *     COMPARISON 을 덮은 스냅샷은 **1개 · 1행** 뿐이다(내 증폭 가설은 과했다).
 *   🟢 운영이 이미 저장한 Vision 관측 12건은 **전부 96~100(SAME)** 이다.
 *
 * ── 이 파일이 새로 재는 것 ─────────────────────────────────────────────────
 *   Vision 미관측 EXACT **46건** 에 운영과 **같은 함수** `observeVision` 을 돌려
 *   EXACT 버킷 정확도를 전수로 확정한다.
 *
 * 🔴 origin 이미지는 `product_snapshots.thumbnail_url` 을 쓴다 — 운영 E1 게이트가
 *    쓰는 바로 그 값(run-domestic-price-check.ts:784 `originImageUrl:
 *    snapshotThumbnailUrl`)이다. 🔴 단 운영에는 **두 번째 출처** 가 있다
 *    (:879 `dna.imageUrls[0]`). 둘이 다를 수 있으므로 결과에 명시한다.
 * 🔴 Vision 은 사람이 아니다. 「Vision 과 Identity 가 갈린 건」으로만 적는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { observeVision } from "../vision-evidence";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../".repeat(8));
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 `scripts/.env` 직접 읽기(기존 하니스와 같은 방식). 값은 출력하지 않는다. */
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

/** 🔴 사전등록 구간. `vision-evidence.ts` PROMPT 가 정의한 그대로다. */
const SAME_MIN = 80;
const DIFF_MAX = 50;

interface ExactLink {
  id: string; snapshotId: string; snapshotTitle: string | null;
  snapshotThumb: string | null; snapshotSourceUrl: string | null;
  externalUrl: string; matchedTitle: string | null; matchedBrand: string | null;
  sourceDomain: string | null; matchTruth: string | null; crossSellerVerdict: string | null;
  verified: boolean; matchConfidence: number;
  visionScore: number | null; visionReason: string | null;
}

describe.skipIf(!LIVE)("🔴 MI-P0-12 — EXACT 버킷 정확도 전수", () => {
  it(
    "Vision 미관측 EXACT 링크에 운영과 같은 observeVision 을 돌린다",
    async () => {
      loadGeminiKey();
      const p = path.join(OUT_DIR, "mi-p0-12-exact-links.json");
      if (!existsSync(p)) throw new Error(`선행 읽기 전용 덤프 없음: ${p}`);
      const links = JSON.parse(readFileSync(p, "utf8")) as ExactLink[];

      /**
       * 🔴 링크 행에 **중복이 있다**(같은 (snapshot, externalUrl) 이 여러 행).
       *    실측: `STRONG_IDENTIFIER × SIMILAR` 11건이 전부 같은 PèPè 쌍이었다.
       *    그래서 «쌍 단위» 와 «행 단위» 를 **갈라서** 센다 — 합치면 한 상품이
       *    11표를 갖는다.
       */
      const byPair = new Map<string, ExactLink[]>();
      for (const l of links) {
        const k = `${l.snapshotId}|${l.externalUrl}`;
        (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(l);
      }
      const pairs = [...byPair.entries()].map(([k, rows]) => ({ key: k, rows, head: rows[0] }));

      /** 후보 이미지를 한 번만 받는다(쌍 단위). */
      const candImage = new Map<string, { url: string | null; status: string }>();
      for (const pr of pairs) {
        const u = pr.head.externalUrl;
        if (candImage.has(u)) continue;
        try {
          const r = await factsFromProductUrl(u);
          candImage.set(u, { url: absolute(r.candidate?.imageUrl ?? r.candidate?.facts?.imageUrls?.[0]), status: r.status });
        } catch (e) {
          candImage.set(u, { url: null, status: `ERR(${e instanceof Error ? e.name : "?"})` });
        }
      }

      const rows: Record<string, unknown>[] = [];
      let n = 0;
      for (const pr of pairs) {
        const l = pr.head;
        // 🟢 이미 운영이 관측한 값이 있으면 **다시 부르지 않는다** — 그대로 쓴다.
        const stored = pr.rows.map((r) => r.visionScore).filter((s): s is number => s != null);
        const ci = candImage.get(l.externalUrl)!;
        const oi = absolute(l.snapshotThumb);
        let score: number | null = null;
        let reason: string | null = null;
        let source = "";
        let status = "";
        if (stored.length > 0) {
          score = Math.max(...stored);
          reason = pr.rows.find((r) => r.visionScore === score)?.visionReason ?? null;
          source = `운영저장(${stored.length}행)`;
          status = "STORED";
        } else {
          const o = await observeVision(oi, ci.url);
          score = o.score ?? null;
          reason = o.reason;
          source = "이번 측정";
          status = o.status;
          n++;
        }
        const label = score == null ? null : score >= SAME_MIN ? "SAME" : score <= DIFF_MAX ? "DIFF" : "UNCERTAIN";
        rows.push({
          snapshotTitle: l.snapshotTitle, matchedTitle: l.matchedTitle, sourceDomain: l.sourceDomain,
          externalUrl: l.externalUrl, duplicateRows: pr.rows.length,
          matchTruth: l.matchTruth, crossSellerVerdict: l.crossSellerVerdict, verified: l.verified,
          originImagePresent: !!oi, candidateImagePresent: !!ci.url, candidateFetchStatus: ci.status,
          visionSource: source, visionStatus: status, visionScore: score, visionReason: reason,
          visionLabel: label,
          /** 🔴 EXACT 인데 사진이 다르다 = 「동일상품 최저가」가 오염되는 자리 */
          businessLossCandidate: label === "DIFF",
        });
        // eslint-disable-next-line no-console
        console.log(`${String(l.sourceDomain).padEnd(18)} rows=${String(pr.rows.length).padStart(2)} ${source.padEnd(14)} score=${String(score ?? "-").padStart(4)} ${String(label).padEnd(9)} ${status}`);
      }

      const count = (xs: Record<string, unknown>[], k: (x: Record<string, unknown>) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const labelable = rows.filter((r) => r.visionLabel != null);
      const loss = rows.filter((r) => r.businessLossCandidate);
      const report = {
        scope: {
          note: "🔴 운영 DB 전수의 EXACT tier. 행 중복을 접어 «쌍» 단위로 센다.",
          exactLinkRows: links.length, distinctPairs: pairs.length, newVisionCalls: n,
          originImageSource: "product_snapshots.thumbnail_url (운영 E1 게이트와 같은 값, run-domestic-price-check.ts:784)",
          caveat: "🔴 운영에는 두 번째 origin 이미지 출처가 있다(:879 dna.imageUrls[0]). 다를 수 있다.",
          preRegistered: { SAME_MIN, DIFF_MAX, source: "vision-evidence.ts PROMPT 구간" },
        },
        labelCoverage: { labelable: labelable.length, unlabelable: pairs.length - labelable.length },
        byLabel: count(rows, (r) => String(r.visionLabel)),
        byDomainAndLabel: count(rows, (r) => `${r.sourceDomain} × ${r.visionLabel}`),
        byCrossSellerVerdictAndLabel: count(rows, (r) => `${r.crossSellerVerdict ?? "(null)"} × ${r.visionLabel}`),
        candidateImageMissing: rows.filter((r) => !r.candidateImagePresent).length,
        /** 🔴 이것이 0 이면 「EXACT 버킷에서 확인 가능한 사업적 손실은 없다」 */
        businessLossCandidates: loss,
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-12-exact-vision.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBe(pairs.length);
    },
    120 * 60 * 1000,
  );
});
