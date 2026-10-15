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

/** 6유형. 🔴 측정용 어휘이고 제품 판정 어휘가 아니다. */
type ProductType =
  | "EXACT_SAME"
  | "SAME_OTHER_MARKET"
  | "SAME_BRAND_DIFF_MODEL"
  | "SAME_MODEL_DIFF_COLOR"
  | "SIMILAR"
  | "DIFFERENT";

/** 🟢 GT 는 **두 값** 뿐이다 — 「이 후보를 동일상품으로 쓸 수 있는가」. */
type Gt = "SAME" | "DIFFERENT";
const GT_OF: Record<ProductType, Gt> = {
  EXACT_SAME: "SAME",
  SAME_OTHER_MARKET: "SAME",
  /* 🔴 색상만 달라도 동일상품이 아니다 — 판매/가격 축에서 다른 상품이다. */
  SAME_MODEL_DIFF_COLOR: "DIFFERENT",
  SAME_BRAND_DIFF_MODEL: "DIFFERENT",
  SIMILAR: "DIFFERENT",
  DIFFERENT: "DIFFERENT",
};

type ThreeWay = "SAME" | "DIFFERENT" | "UNCERTAIN";

interface BenchCase {
  caseId: string;
  productType: ProductType;
  /** 원상품 스냅샷 id 앞 8자리(읽기전용 덤프 키). */
  origin: string;
  candidateUrl: string;
  /** 🔴 GT 근거 — 추측 금지. 아래 `gtToken` 으로 **관측된 제목과 대조** 한다. */
  gtReason: string;
  /**
   * 🟢 **GT 독립 검증 장치**(WU-018 에 없던 것) — 실제로 가져온 후보 제목에
   *    이 토큰이 «있어야/없어야» 한다. GT 가 페이지와 어긋나면 측정 전에 깨진다.
   */
  gtToken?: { mustInclude?: string[]; mustExclude?: string[] };
}

const BOBO = "https://bobochoses.com/products";
/**
 * 🟢 쌍 **14건 전부 운영 DB 실데이터** 다(덤프 `mi-017-e2e-urlset.json` / `-cases.json`).
 * 🔴 WU-018 의 GT 를 **그대로 베끼지 않았다** — 유형을 다시 적고 `gtToken` 으로
 *    **실제 페이지 제목과 대조하는 검증 장치를 추가** 했다(지시서 §1).
 */
const CASES: BenchCase[] = [
  { caseId: "B01", productType: "EXACT_SAME", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "원상품 sku B226AC010 · 후보 handle 에 b226ac010 · 제목 Booty Ghosts 동일",
    gtToken: { mustInclude: ["booty", "ghosts"] } },
  { caseId: "B02", productType: "SIMILAR", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`,
    gtReason: "같은 브랜드·같은 상품군(T-shirt)·다른 품번 B226AC009",
    gtToken: { mustInclude: ["hug"], mustExclude: ["booty"] } },
  { caseId: "B03", productType: "SAME_BRAND_DIFF_MODEL", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac070-stamp-bloom-all-over-denim-pants`,
    gtReason: "같은 브랜드 · 품번 B226AC070 · 상품군 denim pants(원상품은 긴팔 티셔츠)",
    gtToken: { mustInclude: ["denim"], mustExclude: ["booty"] } },
  { caseId: "B04", productType: "DIFFERENT", origin: "c0725ecc", candidateUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
    gtReason: "제목 「[마이마이]532 캐너피슈즈」 — 브랜드·상품군 모두 다르다",
    gtToken: { mustExclude: ["bobo", "booty"] } },

  { caseId: "B05", productType: "EXACT_SAME", origin: "cd93efd9", candidateUrl: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`,
    gtReason: "원상품 sku B226AC009 · 후보 handle 에 b226ac009",
    gtToken: { mustInclude: ["hug", "monster"] } },
  { caseId: "B06", productType: "SIMILAR", origin: "cd93efd9", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "B02 의 반대 방향 — 방향 대칭성 확인용",
    gtToken: { mustInclude: ["booty"], mustExclude: ["monster"] } },

  { caseId: "B07", productType: "EXACT_SAME", origin: "c5395889", candidateUrl: `${BOBO}/b126ai018-curious-turnip-all-over-swim-cap`,
    gtReason: "원상품 sku B126AI018 · 후보 handle 에 b126ai018 (🔴 WU-018 실측에서 이 URL 은 404 였다)" },
  { caseId: "B08", productType: "SAME_BRAND_DIFF_MODEL", origin: "c5395889", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "같은 브랜드 · 상품군이 다르다(수영모 ↔ 티셔츠)",
    gtToken: { mustInclude: ["booty"], mustExclude: ["swim"] } },

  { caseId: "B09", productType: "EXACT_SAME", origin: "c27d4727",
    candidateUrl: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/2",
    gtReason: "국내 샵 제목에 품번 AW26MS185 + 색상 Grey Melange 가 그대로 있다",
    gtToken: { mustInclude: ["aw26ms185", "grey"] } },
  /** 🔴🔴 **P10 — 필수 regression case**(지시서 §9). */
  { caseId: "B10", productType: "SAME_MODEL_DIFF_COLOR", origin: "c27d4727",
    candidateUrl: "https://www.deuxbebe.com/product/detail.html?product_no=18285&cate_no=293&display_group=1",
    gtReason: "🔴 제목 「AW26MS185 - Bubble Sweatshirt - Rose Shadow」 — 같은 품번, 색상이 다르다(원상품 Grey Melange)",
    gtToken: { mustInclude: ["aw26ms185", "rose"], mustExclude: ["grey melange"] } },

  { caseId: "B11", productType: "EXACT_SAME", origin: "32f7b651", candidateUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
    gtReason: "제목 「VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER」 — 색상·모델(1195) 일치",
    gtToken: { mustInclude: ["vernice", "nero"] } },
  { caseId: "B12", productType: "EXACT_SAME", origin: "32f7b651",
    candidateUrl: "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1",
    gtReason: "제목 「페페 VERNICE NERO」 — 브랜드·색상 일치",
    gtToken: { mustInclude: ["vernice", "nero"] } },
  { caseId: "B13", productType: "SAME_MODEL_DIFF_COLOR", origin: "32f7b651",
    candidateUrl: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe",
    gtReason: "운영 DB sku 01195-NEVADA-TOBACCO — 같은 모델 01195, 색상이 다르다",
    gtToken: { mustInclude: ["tobacco"], mustExclude: ["vernice"] } },

  { caseId: "B14", productType: "SAME_OTHER_MARKET", origin: "278d4c38", candidateUrl: `${BOBO}/b226ac117-b-c-embossed-tracksuit-jacket`,
    gtReason: "같은 품번 b226ac117 의 .com(Global) 스토어 — 원상품은 .co.jp",
    gtToken: { mustInclude: ["embossed", "tracksuit"] } },
];

/**
 * 🔴 AI 원문 verdict 를 **세 값으로만** 정규화한다. 🔴 설명·confidence·가격은 읽지 않는다.
 * 🟢 순수 함수라 AI 데이터 없이도 테스트된다(아래 ③).
 */
export function normalizeAiVerdict(raw: string | null | undefined): ThreeWay | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === "SAME" || v === "DIFFERENT" || v === "UNCERTAIN") return v;
  return null;
}

/**
 * 🔴 MI verdict → 세 값. **두 가지 정규화를 같이 낸다**(하나만 쓰면 결과가 숨는다):
 * ```
 * strict      SAME · PRESUMED_SAME → SAME        ← WU-018 이 쓴 기준(False SAME 엄격)
 * threeWay    PRESUMED_SAME → UNCERTAIN          ← AI 와 같은 3값 비교용
 * ```
 * 🔴 **판정 정책을 바꾸는 것이 아니다** — 집계 라벨이다.
 */
function normalizeMi(verdict: string | null): { strict: ThreeWay; threeWay: ThreeWay } {
  if (verdict === "SAME") return { strict: "SAME", threeWay: "SAME" };
  if (verdict === "PRESUMED_SAME") return { strict: "SAME", threeWay: "UNCERTAIN" };
  if (verdict === "UNKNOWN" || verdict === null) return { strict: "UNCERTAIN", threeWay: "UNCERTAIN" };
  return { strict: "DIFFERENT", threeWay: "DIFFERENT" };
}

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
