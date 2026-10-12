/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 후보 «상세확인» 가치 측정 — UNKNOWN/SIMILAR 이 SAME 으로 올라가는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · 검색어 0 · Registry 0 · DB 0.
 *    기본값 SKIP(`MI_P0_02_LIVE=1`).
 *
 * ── 🔴🔴 가치 상한이 먼저 확정됐다 (owner 를 읽어서) ────────────────────
 *   `DOMESTIC_IDENTIFIER_EXTRACTORS`(domestic-identifiers.ts:88)에 등록된 도메인:
 *     🟢 `foretforet.com`   → fetchForetforetModelCode (실제 HTTP)
 *     🟢 `bobochoses.com`   → extractBobochosesModelCode (URL 파싱 · HTTP 없음)
 *   🔴 **`looxloo.com` 은 등록돼 «있지 않다».**
 *   → `fetchDomesticModelCode(domain, url)`(:97)은 등록 안 된 도메인에 **null** 을
 *      돌려준다. 🟢 즉 상세확인을 「켜도」 LOOXLOO 후보는 **한 건도 안 바뀐다.**
 *   🔴 그런데 직전 WU 실측에서 후보 대부분이 LOOXLOO 였다(6/6 · 14/17).
 *      → 🔴 **가치 상한이 구조적으로 작다.** 이 하니스가 그 숫자를 센다.
 *
 * ── 측정 (CPO 지시) ────────────────────────────────────────────────────
 *   목록 단계 verdict  →  상세 확인(modelCode)  →  verdict 변화
 *   🟢 `compareCrossSellerProducts` 를 **그대로** 두 번 부른다(before/after).
 *      facts 의 `brandModelCode` 만 상세확인 결과로 채워 넣는다 — 다른 칸은 손대지 않는다.
 *   🔴 값을 지어내지 않는다 — 추출기가 null 을 주면 null 그대로 둔다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const TARGETS = ["Boo Bo Choses T-shirt", "Astrid Organic Cotton"] as const;

interface UrlRow { id: string; source_url: string; title: string; brand: string }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}

describe.skipIf(!LIVE)("🔴 MI-DETAIL-01 — 상세확인 가치", () => {
  it(
    "후보별로 상세확인 전/후 verdict 를 비교한다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<{ id: string; canonicalProduct: unknown }[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      const all = [...groups.kids, ...groups.kids2, ...groups.tennis];

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{ shopName: string; domain: string; candidates: Record<string, unknown>[] }[]>;
        compareCrossSellerProducts: (a: unknown, b: unknown) => { verdict: string; axes: { axis: string }[]; blockers: { blocker: string }[]; conflicts: { conflict: string }[] };
        fetchDomesticModelCode: (domain: string, url: string) => Promise<string | null>;
        supportsDomesticIdentifierExtraction: (domain: string) => boolean;
        confirmBrandCodeInTitle: (code: string, title: string) => string | null;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      const autoTargets = sources
        .filter((s) => isBatchSurveyTarget(s as never, null))
        .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /** 🟢 상세확인이 «가능한» 샵을 owner 로 판별한다(추측 금지) */
      const supported = autoTargets.map((s) => ({
        name: s.name, domain: s.domain,
        supported: crawler.supportsDomesticIdentifierExtraction(s.domain),
      }));

      const out: Record<string, unknown>[] = [];
      let fetchCount = 0;
      for (const frag of TARGETS) {
        const row = all.find((r) => r.title.includes(frag))!;
        const snap = snaps.find((x) => x.id === row.id)!;
        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = { title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl, searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts };
        const foreignCode = qFacts.brandModelCode as string | null;

        const results = await crawler.searchDomesticShops(query, autoTargets.map((s) => ({
          id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy,
        })));
        const flat = results.flatMap((r) => r.candidates.map((c) => ({ c, domain: r.domain, shop: r.shopName })));

        const rows: Record<string, unknown>[] = [];
        for (const { c, domain, shop } of flat) {
          const cf = c.facts as Record<string, unknown> | undefined;
          if (!cf) { rows.push({ shop, title: String(c.title).slice(0, 40), "🔴": "facts 없음" }); continue; }

          /** ① 목록 단계 — 운영과 같은 전처리(confirmBrandCodeInTitle)까지 포함 */
          const listFacts = cf.brandModelCode === null && foreignCode
            ? { ...cf, brandModelCode: crawler.confirmBrandCodeInTitle(foreignCode, String(c.title)) }
            : cf;
          const before = crawler.compareCrossSellerProducts(qFacts, listFacts);

          /** ② 상세 확인 — 🔴 추출기가 없는 도메인은 null 이 온다(지어내지 않는다) */
          const canDetail = crawler.supportsDomesticIdentifierExtraction(domain);
          let detailCode: string | null = null;
          if (canDetail) {
            fetchCount += 1;
            detailCode = await crawler.fetchDomesticModelCode(domain, String(c.url)).catch(() => null);
          }

          /** ③ 상세 결과로 brandModelCode 만 채워 다시 판정 */
          const afterFacts = detailCode ? { ...listFacts, brandModelCode: detailCode } : listFacts;
          const after = detailCode ? crawler.compareCrossSellerProducts(qFacts, afterFacts) : before;

          rows.push({
            shop, domain, title: String(c.title).slice(0, 44),
            "상세확인 가능": canDetail,
            "목록 modelCode": listFacts.brandModelCode ?? null,
            "상세 modelCode": detailCode,
            "원상품 품번": foreignCode,
            "🔴 품번 일치": detailCode && foreignCode ? detailCode === foreignCode : null,
            before: before.verdict,
            after: after.verdict,
            "🟢 verdict 변화": before.verdict !== after.verdict ? `${before.verdict} → ${after.verdict}` : "없음",
            "🟢 SAME 으로 승격": before.verdict !== "SAME" && after.verdict === "SAME",
            axesBefore: before.axes.length, axesAfter: after.axes.length,
          });
        }
        out.push({ 대상: frag, 원상품품번: foreignCode, 후보수: rows.length, candidates: rows });
      }

      const flatRows = out.flatMap((o) => o.candidates as Record<string, unknown>[]).filter((r) => !r["🔴"]);
      const tally = (xs: string[]) => { const t: Record<string, number> = {}; for (const x of xs) t[x] = (t[x] ?? 0) + 1; return t; };
      const report = {
        "🟢 DISCLAIMER": "조사 전용 · 코드 0 · DB 0. compareCrossSellerProducts 를 그대로 두 번 불러 " +
          "before/after 를 비교했다. brandModelCode 만 상세확인 결과로 채웠고 다른 칸은 손대지 않았다.",
        "🔴🔴 가치 상한": {
          "등록된 추출기": "foretforet.com · bobochoses.com — **단 2개**(domestic-identifiers.ts:88)",
          "🔴 looxloo.com": "**등록되지 않았다** → 상세확인을 켜도 LOOXLOO 후보는 한 건도 안 바뀐다",
          "활성 자동수집 샵별 지원 여부": supported,
        },
        비용: { "실제 상세 fetch 횟수": fetchCount, "후보 전체": flatRows.length },
        결과: {
          "상세확인 가능한 후보": flatRows.filter((r) => r["상세확인 가능"]).length,
          "🔴 상세확인 불가(추출기 없음)": flatRows.filter((r) => !r["상세확인 가능"]).length,
          "상세에서 modelCode 를 실제로 얻은 후보": flatRows.filter((r) => r["상세 modelCode"]).length,
          "🟢 verdict 가 바뀐 후보": flatRows.filter((r) => r["🟢 verdict 변화"] !== "없음").length,
          "🟢🟢 SAME 으로 승격한 후보": flatRows.filter((r) => r["🟢 SAME 으로 승격"]).length,
          "verdict before": tally(flatRows.map((r) => String(r.before))),
          "verdict after": tally(flatRows.map((r) => String(r.after))),
        },
        products: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "detail-value.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${out.length}건 — 파일 참조)` }, null, 1));
      expect(out.length).toBe(2);
    },
    60 * 60 * 1000,
  );
});
