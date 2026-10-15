/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-018 — **MI 동일상품 판정 정확도** (URL/fetch 축과 «분리» 해서 잰다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기본 SKIP.** `MI_018_LIVE=1` 일 때만 실제 판매처에 요청한다.
 * 🔴 AI 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 결제 0 · DB 쓰기 0 · UI 0 ·
 *    threshold 0 · Registry 0 · 새 adapter 0 · 배포 0.
 *
 * ── 🔴🔴 분모 규칙 (CPO 확정) ──────────────────────────────────────────────
 * ```
 * URL 문제        → WU-017 축
 * facts 추출 문제 → WU-017 축
 * facts 정상인데 오판 → **WU-018 축** ← 여기만 센다
 * 🔴 그래서 `UNREACHABLE` · `NO_FACTS` · `NOT_PRODUCT_URL` 은 **MI 오판으로 세지 않는다.**
 *    분모에서 빼고 «별도 줄» 로 보고한다.
 * ```
 *
 * ── 🔴 GT 는 품번 + 상품명 + 색상으로 세운다 (우리 판정이 아니다) ──────────
 * ```
 * 🟢 쌍 13건 전부 **운영 DB 실데이터** 다(원상품 5개 · 후보 URL 11개 · 덤프 2개).
 * 🔴 `domestic_product_links.match_truth` 는 **우리가 낸 값** 이라 GT 로 쓰지 않는다.
 *    (참고로만 쓰려 해도 자기채점이 된다 — 이 트랙이 반복해서 걸린 자리다)
 * ```
 *
 * 🔴 판정 owner 를 복제하지 않는다 — 운영과 **같은 함수·같은 순서** 다:
 *    `buildProductIdentityDna` → `productFactsFromIdentityDna` → `withConfidence`
 *    (check/route.ts:52 · run-domestic-price-check.ts:801·808 · comparison-search/index.ts:206)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { withConfidence } from "../match";
import { factsFromProductUrl, type ProductUrlFactsResult } from "../product-url-facts";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

const LIVE = process.env.MI_018_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const stripLeadingDevTag = (t: string): string => t.replace(/^\s*\[[^\]]*\]\s*/, "").trim();

interface CaseRow {
  id: string;
  source_url: string;
  canonical_product: Record<string, unknown>;
}

/** 🔴 **GT 어휘** — 제품 코드의 판정 어휘와 섞지 않는다. */
type Gt =
  /** 같은 품번 · 같은 색 · 같은 상품 */
  | "EXACT_SAME"
  /** 같은 상품인데 다른 시장(스토어/로케일) */
  | "SAME_OTHER_MARKET"
  /** 같은 브랜드 · **다른 모델**(상품군도 다르다) */
  | "SAME_BRAND_DIFF_MODEL"
  /** **같은 모델 · 다른 색상** — 🔴 거짓 SAME 이 가장 위험한 자리 */
  | "SAME_MODEL_DIFF_COLOR"
  /** 같은 브랜드 · 같은 상품군 · 다른 프린트/모델 = 유사상품 */
  | "SIMILAR"
  /** 브랜드도 상품군도 다르다 */
  | "DIFFERENT";

/** 🟢 GT 가 「동일상품」인 유형. 🔴 색상이 다르면 동일상품이 **아니다**(판매 축에서). */
const GT_IS_SAME = new Set<Gt>(["EXACT_SAME", "SAME_OTHER_MARKET"]);

const BOBO = "https://bobochoses.com/products";
const PAIRS: { pairId: string; origin: string; url: string; gt: Gt; why: string }[] = [
  /* ── 원상품 B226AC010 Booty Ghosts Long Sleeve T-Shirt (Heather Grey) ── */
  { pairId: "P1", origin: "c0725ecc", url: `${BOBO}/b226ac010-booty-ghosts-t-shirt`, gt: "EXACT_SAME",
    why: "원상품 sku B226AC010 · 후보 handle 에 b226ac010 · 제목 Booty Ghosts 동일" },
  { pairId: "P2", origin: "c0725ecc", url: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`, gt: "SIMILAR",
    why: "같은 브랜드·같은 상품군(T-shirt)·다른 품번 B226AC009 → 유사상품" },
  { pairId: "P3", origin: "c0725ecc", url: `${BOBO}/b226ac070-stamp-bloom-all-over-denim-pants`, gt: "SAME_BRAND_DIFF_MODEL",
    why: "같은 브랜드인데 품번 B226AC070 · 상품군 denim pants(원상품은 긴팔 티셔츠)" },
  { pairId: "P4", origin: "c0725ecc", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273", gt: "DIFFERENT",
    why: "운영 DB 실측 제목 「[마이마이]532 캐너피슈즈」 — 브랜드·상품군 모두 다르다" },

  /* ── 원상품 B226AC009 Hug Hairy Monster T-Shirt (Light Blue) — 방향을 뒤집어 본다 ── */
  { pairId: "P5", origin: "cd93efd9", url: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`, gt: "EXACT_SAME",
    why: "원상품 sku B226AC009 · 후보 handle 에 b226ac009" },
  { pairId: "P6", origin: "cd93efd9", url: `${BOBO}/b226ac010-booty-ghosts-t-shirt`, gt: "SIMILAR",
    why: "P2 의 반대 방향 — 같은 브랜드·같은 상품군·다른 품번(방향 대칭성 확인)" },

  /* ── 원상품 B126AI018 Curious Turnip Swim Cap (Green) ── */
  { pairId: "P7", origin: "c5395889", url: `${BOBO}/b126ai018-curious-turnip-all-over-swim-cap`, gt: "EXACT_SAME",
    why: "원상품 sku B126AI018 · 후보 handle 에 b126ai018" },
  { pairId: "P8", origin: "c5395889", url: `${BOBO}/b226ac010-booty-ghosts-t-shirt`, gt: "SAME_BRAND_DIFF_MODEL",
    why: "같은 브랜드 · 상품군이 다르다(수영모 ↔ 티셔츠)" },

  /* ── 원상품 AW26MS185 Bubble Sweatshirt **Grey Melange** (Main Story) ── */
  { pairId: "P9", origin: "c27d4727",
    url: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/2", gt: "EXACT_SAME",
    why: "국내 샵이 제목에 품번 AW26MS185 + 색상 Grey Melange 를 그대로 적는다(운영 링크 보유)" },
  { pairId: "P10", origin: "c27d4727",
    url: "https://www.deuxbebe.com/product/detail.html?product_no=18285&cate_no=293&display_group=1", gt: "SAME_MODEL_DIFF_COLOR",
    why: "🔴 운영 DB 실측 제목 「AW26MS185 - Bubble Sweatshirt - **Rose Shadow**」 — 같은 품번, 색상이 다르다" },

  /* ── 원상품 Pèpè Lulu T Bar 01195-VERNICE-NERO ── */
  { pairId: "P11", origin: "32f7b651", url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", gt: "EXACT_SAME",
    why: "제목 「VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER」 — 색상·모델(1195) 일치(운영 링크 보유)" },
  { pairId: "P12", origin: "32f7b651",
    url: "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1", gt: "EXACT_SAME",
    why: "제목 「페페 VERNICE NERO」 — 브랜드·색상 일치(운영 링크 보유)" },
  { pairId: "P13", origin: "32f7b651", url: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe",
    gt: "SAME_MODEL_DIFF_COLOR", why: "🔴 운영 DB sku 01195-NEVADA-TOBACCO — 같은 모델 01195, 색상이 다르다" },

  /* ── 원상품 B.C. Embossed tracksuit jacket (.co.jp · 🔴 브랜드·sku 가 **비어 있다**) ── */
  { pairId: "P14", origin: "278d4c38", url: `${BOBO}/b226ac117-b-c-embossed-tracksuit-jacket`, gt: "SAME_OTHER_MARKET",
    why: "같은 품번 b226ac117 의 .com(Global) 스토어 — 원상품은 .co.jp" },
];

interface Row {
  pairId: string;
  gt: Gt;
  why: string;
  originSku: string | null;
  originBrand: string | null;
  url: string;
  /** 🔴 facts 단계 결과 — `OK` 가 아니면 **MI 분모에서 빠진다**(WU-017 축). */
  factsStatus: string;
  verdict: string | null;
  matchLevel: string | null;
  confidence: number | null;
  blockers: unknown;
  conflicts: unknown;
  /** 🟢 오판 원인 분류에 쓰는 **후보 facts 의 칸 유무**(값을 만들지 않는다). */
  candidateFacts: { brand: boolean; brandModelCode: boolean; colorText: boolean; categoryText: boolean; titleTokens: number } | null;
  judgedSame: boolean;
  correct: boolean;
}

function queryOf(row: CaseRow): ComparisonQuery {
  const dna = buildProductIdentityDna(row.canonical_product as never);
  return {
    title: stripLeadingDevTag(dna.title),
    brand: dna.brand.value || undefined,
    sourceUrl: dna.sourceUrl,
    sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
    facts: productFactsFromIdentityDna(dna),
  };
}

const describeLive = LIVE ? describe : describe.skip;

describeLive("WU-018 — MI 판정 정확도(facts 정상인 후보만 분모)", () => {
  it(
    "쌍 전건을 운영 판정기로 돌리고 GT 와 대조한다",
    async () => {
      const casesPath = path.join(OUT_DIR, "mi-017-e2e-cases.json");
      if (!existsSync(casesPath)) throw new Error(`선행 덤프 없음: ${casesPath}`);
      const cases = JSON.parse(readFileSync(casesPath, "utf8")) as CaseRow[];
      const byPrefix = new Map(cases.map((r) => [String(r.id).slice(0, 8), r]));

      /* 🟢 같은 URL 을 여러 쌍이 쓰므로 **한 번만** 가져온다(HTTP 절약 · 값은 동일). */
      const factsCache = new Map<string, ProductUrlFactsResult>();
      let httpCalls = 0;
      for (const p of PAIRS) {
        if (factsCache.has(p.url)) continue;
        try {
          const f = await factsFromProductUrl(p.url);
          httpCalls += f.httpCalls;
          factsCache.set(p.url, f);
        } catch {
          factsCache.set(p.url, {
            status: "UNREACHABLE", crawlerUrl: null, dedupeKey: null, candidate: null, httpCalls: 1, fetchPath: "PLAIN_HTML",
          });
          httpCalls += 1;
        }
      }

      const rows: Row[] = [];
      /* 🔴 원상품별로 **배열 단위 1회** 점수를 매긴다 — 운영과 같은 호출 모양이다. */
      for (const origin of [...new Set(PAIRS.map((p) => p.origin))]) {
        const row = byPrefix.get(origin);
        if (!row) throw new Error(`원상품 덤프 없음: ${origin}`);
        const query = queryOf(row);
        const group = PAIRS.filter((p) => p.origin === origin);
        const okPairs = group.filter((p) => factsCache.get(p.url)?.status === "OK");
        const scored = okPairs.length
          ? withConfidence(query, okPairs.map((p) => factsCache.get(p.url)!.candidate as ComparisonCandidate))
          : [];
        const byUrl = new Map(scored.map((c) => [c.url, c]));

        for (const p of group) {
          const f = factsCache.get(p.url)!;
          const cand = f.candidate ? byUrl.get(f.candidate.url) ?? null : null;
          const verdict = cand?.crossSellerVerdict ?? null;
          const judgedSame = verdict === "SAME" || verdict === "PRESUMED_SAME";
          rows.push({
            pairId: p.pairId,
            gt: p.gt,
            why: p.why,
            originSku: query.sku ?? null,
            originBrand: query.brand ?? null,
            url: p.url,
            factsStatus: f.status,
            verdict,
            matchLevel: cand?.matchLevel ?? null,
            confidence: cand?.confidence ?? null,
            blockers: cand?.crossSellerBlockers ?? null,
            conflicts: cand?.crossSellerConflicts ?? null,
            candidateFacts: cand?.facts
              ? {
                  brand: !!cand.facts.brand,
                  brandModelCode: !!cand.facts.brandModelCode,
                  colorText: !!cand.facts.colorText,
                  categoryText: !!cand.facts.categoryText,
                  titleTokens: cand.facts.coreTitleTokens?.length ?? 0,
                }
              : null,
            judgedSame,
            correct: f.status !== "OK" ? false : judgedSame === GT_IS_SAME.has(p.gt),
          });
        }
      }

      /* ═══════════ 분모를 가른다 (CPO 규칙) ═══════════ */
      const mi = rows.filter((r) => r.factsStatus === "OK");
      const excluded = rows.filter((r) => r.factsStatus !== "OK");
      const judgedSame = mi.filter((r) => r.judgedSame);
      const gtSame = mi.filter((r) => GT_IS_SAME.has(r.gt));
      const tp = judgedSame.filter((r) => GT_IS_SAME.has(r.gt));
      const precision = judgedSame.length ? tp.length / judgedSame.length : null;
      const recall = gtSame.length ? tp.length / gtSame.length : null;

      console.log(`\n── WU-018 결과 (쌍 ${rows.length} · MI 분모 ${mi.length} · 제외 ${excluded.length} · HTTP ${httpCalls})`);
      for (const r of rows) {
        console.log(
          `  ${r.pairId.padEnd(4)} GT=${r.gt.padEnd(22)} ${
            r.factsStatus === "OK" ? `${r.verdict ?? "(없음)"}/${r.matchLevel}/${r.confidence}` : `[제외:${r.factsStatus}]`
          } ${r.correct ? "🟢" : r.factsStatus === "OK" ? "🔴" : "⚪"}  ${r.url.slice(0, 72)}`,
        );
        if (r.factsStatus === "OK" && !r.correct) {
          console.log(`        blockers=${JSON.stringify(r.blockers)} conflicts=${JSON.stringify(r.conflicts)}`);
          console.log(`        candidateFacts=${JSON.stringify(r.candidateFacts)}`);
        }
      }
      console.log(
        `\n  Precision ${tp.length}/${judgedSame.length} = ${precision === null ? "측정불가" : `${Math.round(precision * 100)}%`}` +
          `   Recall ${tp.length}/${gtSame.length} = ${recall === null ? "측정불가" : `${Math.round(recall * 100)}%`}`,
      );
      console.log(`  🔴 MI 분모에서 제외(WU-017 축): ${excluded.map((r) => `${r.pairId}:${r.factsStatus}`).join(" · ") || "없음"}`);

      if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUT_DIR, "mi-018-result.json"),
        JSON.stringify({ rows, httpCalls, precision, recall, denominator: mi.length, excluded: excluded.length }, null, 2),
        "utf8",
      );

      /**
       * 🔴🔴 Precision 우선 — GT 가 「동일상품이 아니다」인데 SAME/PRESUMED_SAME 이면 오판이다.
       *
       * 🔴 실측에서 **1건** 나왔고 **고치지 않았다**(원인이 전역 판정에 닿는다 · §아래).
       *    그래서 「현재 오판을 통과로 묻어 두지」도, 「하니스를 영구 FAIL 로 두지」도 않고
       *    **등록된 오판 목록** 으로 양방향 잠금을 한다:
       *      ① 목록에 없는 새 거짓 동일상품이 생기면 **FAIL**(회귀 방지)
       *      ② 등록된 오판이 **사라지면 FAIL** → 그것이 수정됐다는 증거다(쿠팡 고시 선례)
       */
      const KNOWN_FALSE_SAME = ["P10"];
      const falseSame = judgedSame.filter((r) => !GT_IS_SAME.has(r.gt));
      expect(falseSame.filter((r) => !KNOWN_FALSE_SAME.includes(r.pairId)).map((r) => `${r.pairId} ${r.gt} → ${r.verdict}`)).toEqual(
        [],
      );
      expect(
        falseSame.map((r) => r.pairId).sort(),
        "등록된 오판이 사라졌다 — 수정이 들어왔다면 KNOWN_FALSE_SAME 를 갱신한다",
      ).toEqual(KNOWN_FALSE_SAME);

      /* 🔴 분모가 비면 측정이 아니다 — 「통과」로 쓰지 않는다. */
      expect(mi.length).toBeGreaterThan(0);
      expect(gtSame.length).toBeGreaterThan(0);
    },
    20 * 60 * 1000,
  );
});

/* ═══════════ SKIP 상태에서도 테스트셋 «정의» 는 검사한다(HTTP 0) ═══════════ */
describe("WU-018 테스트셋 정의", () => {
  it("🔴 §5 여섯 유형이 **전부** 들어 있다", () => {
    const gts = new Set(PAIRS.map((p) => p.gt));
    for (const required of [
      "EXACT_SAME",
      "SAME_OTHER_MARKET",
      "SAME_BRAND_DIFF_MODEL",
      "SAME_MODEL_DIFF_COLOR",
      "SIMILAR",
      "DIFFERENT",
    ] as Gt[]) {
      expect(gts.has(required), `GT 유형 누락: ${required}`).toBe(true);
    }
  });

  it("🔴 GT 마다 **근거** 가 있다 — 추측으로 정답을 적지 않는다", () => {
    for (const p of PAIRS) {
      expect(p.why.length, `${p.pairId} 근거 없음`).toBeGreaterThan(10);
      expect(p.url).toMatch(/^https:\/\//);
    }
  });

  it("🔴 **색상만 다른 쌍을 「동일상품」으로 세지 않는다**(GT 정의 자체를 잠근다)", () => {
    expect(GT_IS_SAME.has("SAME_MODEL_DIFF_COLOR")).toBe(false);
    expect(GT_IS_SAME.has("SIMILAR")).toBe(false);
    expect([...GT_IS_SAME].sort()).toEqual(["EXACT_SAME", "SAME_OTHER_MARKET"]);
  });
});
