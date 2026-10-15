/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A — **AI vs MI 동일상품 판정 Benchmark** (순수 측정 · 엔진 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 축은 CTO 가 만들 수 없다.** 지시서 §11 이 「CTO 가 자동 브라우저/API 를
 *    만들지 않는다」 고 명시하고, 외부 AI API 는 전면 금지다. 그래서 이 하니스는
 *    AI 판정을 **파일로 받는다** — 없으면 AI 축을 **「측정불가」** 로 적고
 *    🔴 **0% 로 적지 않는다**(헌장 §5-B).
 * ```
 * OUT_DIR/mi-019a-ai-verdicts.json   [{ caseId, verdict, reason, raw? }, …]
 *   verdict ∈ SAME | DIFFERENT | UNCERTAIN   (정규화기는 아래 `normalizeAiVerdict`)
 * ```
 * 🔴 AI 의 confidence · 가격 · 판매처 · 「동일상품입니다」 문장은 **읽지 않는다.**
 *    이 하니스가 AI 입력에서 쓰는 칸은 `verdict` 와 (보존용) `reason` 뿐이다.
 * 🔴 **AI 결과를 MI 입력에 넣지 않는다** — MI 측정은 AI 파일 유무와 무관하게 돈다
 *    (아래에서 MI 측정이 AI 파일을 읽기 **전** 에 끝난다).
 *
 * 🔴 MI 는 **기존 운영 판정 그대로** 다 — threshold 0 · 색상 사전 0 · 보류 정책 0 ·
 *    새 scoring 0. `factsFromProductUrl` → `withConfidence`(원상품별 배열 1회).
 * 🔴 기본 SKIP(`MI_019A_LIVE=1`). AI 0 · Gemini 0 · 키 0 · 결제 0 · DB 쓰기 0 ·
 *    UI 0 · Registry 0 · 배포 0. 🟡 판매처 GET 만 쓴다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { withConfidence } from "../match";
import { factsFromProductUrl, type ProductUrlFactsResult } from "../product-url-facts";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

const LIVE = process.env.MI_019A_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

import {
  CASES,
  GT_OF,
  normalizeAiVerdict,
  normalizeMi,
  type BenchCase,
  type Gt,
  type ProductType,
  type ThreeWay,
} from "./__fixtures__/mi-identity-benchmark";
/** 🟢 019A-EXT 와 **같은 배열** 을 읽는다(사본 금지 · EXT §2). */
void (0 as unknown as BenchCase | undefined);

interface Row {
  caseId: string;
  productType: ProductType;
  sourceUrl: string;
  candidateUrl: string;
  gt: Gt;
  gtReason: string;
  observedTitle: string | null;
  factsStatus: string;
  miRaw: string | null;
  miConfidence: number | null;
  miStrict: ThreeWay | null;
  miThreeWay: ThreeWay | null;
  miCorrect: boolean | null;
  ai: ThreeWay | null;
  aiReason: string | null;
  aiCorrect: boolean | null;
  agreement: boolean | null;
}

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-019A — AI vs MI Benchmark (MI 실측 · AI 는 파일)", () => {
  it(
    "MI 축을 실측하고, AI 파일이 있으면 4분면까지 집계한다",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath}`);
      const originRows = JSON.parse(readFileSync(casesPath, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: Record<string, unknown>;
      }[];
      const byPrefix = new Map(originRows.map((r) => [String(r.id).slice(0, 8), r]));

      /* ── ① MI 축 — 🔴 AI 파일을 **읽기 전에** 끝낸다(주입 불가 구조) ───────── */
      const factsCache = new Map<string, ProductUrlFactsResult>();
      let httpCalls = 0;
      for (const c of CASES) {
        if (factsCache.has(c.candidateUrl)) continue;
        try {
          const f = await factsFromProductUrl(c.candidateUrl);
          httpCalls += f.httpCalls;
          factsCache.set(c.candidateUrl, f);
        } catch {
          factsCache.set(c.candidateUrl, {
            status: "UNREACHABLE", crawlerUrl: null, dedupeKey: null, candidate: null, httpCalls: 1, fetchPath: "PLAIN_HTML",
          });
          httpCalls += 1;
        }
      }

      const rows: Row[] = [];
      for (const origin of [...new Set(CASES.map((c) => c.origin))]) {
        const row = byPrefix.get(origin);
        if (!row) throw new Error(`원상품 덤프 없음: ${origin}`);
        const dna = buildProductIdentityDna(row.canonical_product as never);
        const query: ComparisonQuery = {
          title: dna.title.replace(/^\s*\[[^\]]*\]\s*/, "").trim(),
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          facts: productFactsFromIdentityDna(dna),
        };
        const group = CASES.filter((c) => c.origin === origin);
        const ok = group.filter((c) => factsCache.get(c.candidateUrl)?.status === "OK");
        const scored = ok.length
          ? withConfidence(query, ok.map((c) => factsCache.get(c.candidateUrl)!.candidate as ComparisonCandidate))
          : [];
        const byUrl = new Map(scored.map((c) => [c.url, c]));

        for (const c of group) {
          const f = factsCache.get(c.candidateUrl)!;
          const cand = f.candidate ? byUrl.get(f.candidate.url) ?? null : null;
          const gt = GT_OF[c.productType];
          const mi = cand ? normalizeMi(cand.crossSellerVerdict ?? null) : null;
          rows.push({
            caseId: c.caseId,
            productType: c.productType,
            sourceUrl: query.sourceUrl ?? "",
            candidateUrl: c.candidateUrl,
            gt,
            gtReason: c.gtReason,
            observedTitle: cand?.title ?? null,
            factsStatus: f.status,
            miRaw: cand?.crossSellerVerdict ?? null,
            miConfidence: cand?.confidence ?? null,
            miStrict: mi?.strict ?? null,
            miThreeWay: mi?.threeWay ?? null,
            miCorrect: mi ? (mi.strict === "SAME") === (gt === "SAME") : null,
            ai: null,
            aiReason: null,
            aiCorrect: null,
            agreement: null,
          });
        }
      }

      /* ── ② GT 독립 검증 — 관측된 제목이 GT 근거와 어긋나면 **측정 전에** 깬다 ── */
      for (const c of CASES) {
        const r = rows.find((x) => x.caseId === c.caseId)!;
        if (!c.gtToken || !r.observedTitle) continue;
        const t = r.observedTitle.toLowerCase();
        for (const inc of c.gtToken.mustInclude ?? []) {
          expect(t.includes(inc.toLowerCase()), `${c.caseId} GT 근거와 실제 제목이 어긋난다: "${r.observedTitle}" ⊅ "${inc}"`).toBe(true);
        }
        for (const exc of c.gtToken.mustExclude ?? []) {
          expect(t.includes(exc.toLowerCase()), `${c.caseId} GT 근거와 실제 제목이 어긋난다: "${r.observedTitle}" ⊃ "${exc}"`).toBe(false);
        }
      }

      /* ── ③ AI 축 — **파일이 없으면 측정불가** 다. 🔴 0% 로 적지 않는다 ────── */
      const aiPath = path.join(OUT_DIR, "mi-019a-ai-verdicts.json");
      const aiAvailable = existsSync(aiPath);
      if (aiAvailable) {
        const entries = JSON.parse(readFileSync(aiPath, "utf8")) as { caseId: string; verdict: string; reason?: string }[];
        for (const e of entries) {
          const r = rows.find((x) => x.caseId === e.caseId);
          if (!r) continue;
          r.ai = normalizeAiVerdict(e.verdict);
          r.aiReason = e.reason ?? null;
          r.aiCorrect = r.ai ? (r.ai === "SAME") === (r.gt === "SAME") : null;
          r.agreement = r.ai && r.miThreeWay ? r.ai === r.miThreeWay : null;
        }
      }

      /* ── ④ KPI — 🔴 분모를 전부 같이 적는다 ────────────────────────────── */
      const miScored = rows.filter((r) => r.miStrict !== null);
      const miCorrect = miScored.filter((r) => r.miCorrect);
      const miFalseSame = miScored.filter((r) => r.gt === "DIFFERENT" && r.miStrict === "SAME");
      const gtSame = miScored.filter((r) => r.gt === "SAME");
      const miRecall = gtSame.filter((r) => r.miStrict === "SAME");
      const excluded = rows.filter((r) => r.factsStatus !== "OK");

      console.log(`\n── WU-019A (쌍 ${rows.length} · MI 분모 ${miScored.length} · 제외 ${excluded.length} · HTTP ${httpCalls})`);
      console.log(`  유형별: ${Object.entries(
        CASES.reduce<Record<string, number>>((a, c) => ({ ...a, [c.productType]: (a[c.productType] ?? 0) + 1 }), {}),
      ).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
      for (const r of rows) {
        console.log(
          `  ${r.caseId} ${r.productType.padEnd(22)} GT=${r.gt.padEnd(9)} MI=${
            r.factsStatus === "OK" ? `${r.miRaw}/${r.miStrict}/${r.miConfidence}`.padEnd(34) : `[제외:${r.factsStatus}]`.padEnd(34)
          } AI=${r.ai ?? "측정불가"}  ${r.miCorrect === null ? "⚪" : r.miCorrect ? "🟢" : "🔴"}`,
        );
      }
      console.log(`\n  MI Accuracy   ${miCorrect.length}/${miScored.length}`);
      console.log(`  MI False SAME ${miFalseSame.length}  (${miFalseSame.map((r) => r.caseId).join(",") || "없음"})`);
      console.log(`  MI Recall     ${miRecall.length}/${gtSame.length}`);
      /**
       * ── §7 4분면 · §8 충돌 분석 — 🔴 **AI 파일이 있을 때만** 산출된다.
       *    없으면 `null` 이고 보고서에 **「측정불가」** 로 적는다(0% 금지).
       */
      let quadrants: Record<string, string[]> | null = null;
      let conflictWinner: { aiRight: string[]; miRight: string[]; bothWrong: string[] } | null = null;
      if (aiAvailable) {
        const scored = rows.filter((r) => r.ai !== null && r.miThreeWay !== null);
        quadrants = {};
        for (const r of scored) {
          const key = `GT=${r.gt} AI=${r.ai} MI=${r.miThreeWay}`;
          (quadrants[key] ??= []).push(r.caseId);
        }
        /* 🔴 충돌 = AI 와 MI 가 **다르게** 말한 쌍. 어느 쪽이 GT 와 맞았는지만 센다. */
        const conflicts = scored.filter((r) => r.ai !== r.miThreeWay);
        conflictWinner = {
          aiRight: conflicts.filter((r) => r.aiCorrect === true && r.miCorrect === false).map((r) => r.caseId),
          miRight: conflicts.filter((r) => r.miCorrect === true && r.aiCorrect === false).map((r) => r.caseId),
          bothWrong: conflicts.filter((r) => r.aiCorrect === false && r.miCorrect === false).map((r) => r.caseId),
        };
        const aiScored = rows.filter((r) => r.ai !== null);
        const aiFalseSame = aiScored.filter((r) => r.gt === "DIFFERENT" && r.ai === "SAME");
        console.log(`  AI Accuracy   ${aiScored.filter((r) => r.aiCorrect).length}/${aiScored.length}`);
        console.log(`  AI False SAME ${aiFalseSame.length}  (${aiFalseSame.map((r) => r.caseId).join(",") || "없음"})`);
        console.log(`  AI↔MI 일치     ${scored.filter((r) => r.agreement).length}/${scored.length}`);
        console.log(`  4분면         ${JSON.stringify(quadrants)}`);
        console.log(`  충돌 시 정답   AI ${conflictWinner.aiRight.length} · MI ${conflictWinner.miRight.length} · 둘 다 틀림 ${conflictWinner.bothWrong.length}`);
      } else {
        console.log(`  AI Accuracy   🔴 **측정불가** — AI 판정 파일 없음(0% 가 아니다)`);
        console.log(`  AI↔MI 일치     🔴 **측정불가**`);
        console.log(`  4분면 · 충돌분석 🔴 **측정불가**(AI 축 분모 0)`);
      }
      console.log(`  🔴 제외(WU-017 축): ${excluded.map((r) => `${r.caseId}:${r.factsStatus}`).join(" · ") || "없음"}`);

      writeFileSync(
        path.join(OUT_DIR, "mi-019a-result.json"),
        JSON.stringify(
          {
            rows,
            httpCalls,
            aiAvailable,
            mi: { accuracy: `${miCorrect.length}/${miScored.length}`, falseSame: miFalseSame.map((r) => r.caseId), recall: `${miRecall.length}/${gtSame.length}` },
            ai: aiAvailable ? "계산됨" : "측정불가(분모 없음)",
            quadrants,
            conflictWinner,
          },
          null,
          2,
        ),
        "utf8",
      );

      /* 🔴🔴 P10(B10) regression — 색상만 다른 그 쌍이 MI 에서 **SAME 으로 확정되지 않는다**. */
      const b10 = rows.find((r) => r.caseId === "B10")!;
      expect(b10.miRaw, "P10 의 MI raw verdict 가 바뀌었다 — 안전장치를 확인한다").toBe("PRESUMED_SAME");
      expect(b10.miThreeWay).toBe("UNCERTAIN");

      /* 🔴 등록된 오판 외의 새 False SAME 이 생기면 실패(WU-018 과 같은 양방향 잠금). */
      const KNOWN_FALSE_SAME = ["B10"];
      expect(miFalseSame.filter((r) => !KNOWN_FALSE_SAME.includes(r.caseId)).map((r) => r.caseId)).toEqual([]);
      expect(miFalseSame.map((r) => r.caseId).sort()).toEqual(KNOWN_FALSE_SAME);

      /* 🔴 분모가 비면 측정이 아니다. */
      expect(miScored.length).toBeGreaterThan(0);
      expect(gtSame.length).toBeGreaterThan(0);
    },
    25 * 60 * 1000,
  );
});

/* ═══════════ SKIP 상태에서도 도는 것 — HTTP 0 · AI 0 ═══════════ */
describe("WU-019A 정의·독립성·정규화", () => {
  it("🔴 6유형이 전부 있고 GT 근거가 비어 있지 않다", () => {
    const types = new Set(CASES.map((c) => c.productType));
    for (const t of [
      "EXACT_SAME", "SAME_OTHER_MARKET", "SAME_BRAND_DIFF_MODEL", "SAME_MODEL_DIFF_COLOR", "SIMILAR", "DIFFERENT",
    ] as ProductType[]) {
      expect(types.has(t), `유형 누락: ${t}`).toBe(true);
    }
    for (const c of CASES) expect(c.gtReason.length, c.caseId).toBeGreaterThan(10);
  });

  it("🔴🔴 **색상만 다른 쌍은 GT 가 DIFFERENT** 다 — GT 정의 자체를 잠근다", () => {
    expect(GT_OF.SAME_MODEL_DIFF_COLOR).toBe("DIFFERENT");
    expect(GT_OF.SIMILAR).toBe("DIFFERENT");
    expect(Object.entries(GT_OF).filter(([, v]) => v === "SAME").map(([k]) => k).sort()).toEqual([
      "EXACT_SAME",
      "SAME_OTHER_MARKET",
    ]);
  });

  it("🔴 AI 정규화는 **세 값만** 받는다 — confidence·가격·문장을 읽지 않는다", () => {
    expect(normalizeAiVerdict("same")).toBe("SAME");
    expect(normalizeAiVerdict(" UNCERTAIN ")).toBe("UNCERTAIN");
    /* 🔴 「동일상품입니다(확신 95%, ₩49,000)」 같은 산문은 **받지 않는다**. */
    expect(normalizeAiVerdict("동일상품입니다 확신 95% ₩49,000")).toBeNull();
    expect(normalizeAiVerdict("SAME (0.95)")).toBeNull();
    expect(normalizeAiVerdict(null)).toBeNull();
  });

  it("🔴 P10(B10)이 benchmark 에 **필수 포함** 돼 있다", () => {
    const b10 = CASES.find((c) => c.caseId === "B10");
    expect(b10?.productType).toBe("SAME_MODEL_DIFF_COLOR");
    expect(b10?.candidateUrl).toContain("product_no=18285");
  });

  it("🔴 MI 정규화는 PRESUMED_SAME 을 **두 축으로 갈라** 적는다(숨기지 않는다)", () => {
    expect(normalizeMi("PRESUMED_SAME")).toEqual({ strict: "SAME", threeWay: "UNCERTAIN" });
    expect(normalizeMi("SAME")).toEqual({ strict: "SAME", threeWay: "SAME" });
    expect(normalizeMi("CONFLICT")).toEqual({ strict: "DIFFERENT", threeWay: "DIFFERENT" });
  });
});
