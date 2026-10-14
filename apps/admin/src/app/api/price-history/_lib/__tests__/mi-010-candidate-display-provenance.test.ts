/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-010 STEP 1 — **화면 후보의 실제 source 를 코드로 증명한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 외부 AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 0 · Registry 0 · schema 0 ·
 *    DB 쓰기 0 · 환산 0 · 임계값 0 · Production 배포 0.
 * 🔴 게이트 `MI_P0_02_DISPLAY=1` 없으면 **SKIP**(회귀에서 외부 HTTP 금지).
 *
 * ── 🔴🔴 WU-009 에서 남은 미확인 ───────────────────────────────────────────
 * ```
 * low 후보는 DB 링크로 **저장되지 않는다**(upsert 앞 continue · 실측 링크 0건).
 * 그런데 CEO 는 Production 화면에서 무관한 상품을 **봤다.**
 * → 즉 화면에는 **DB 링크가 아닌 다른 공급 경로** 가 있다.
 * ```
 *
 * ── 🟢 전수 조사 결과(코드) — 후보를 화면에 넣는 경로는 **둘** 이다 ────────
 * ```
 * ① 저장된 링크   DomesticPriceIntelligencePanel.tsx:1842
 *                 GET /api/domestic-price-sources/links?snapshotId=…   (= DB)
 * ② 🔴 **transient 라이브 검색**
 *                 DomesticShopSearch.tsx:180
 *                 POST /api/domestic-price-sources/search              (= DB 아님)
 *                   → searchDomesticShops → excludeSelfReference → attachMatchTruth
 *                   → NextResponse.json({ ok: true, results })         (route.ts:220)
 *                 렌더 위치: CommerceWorkspace.tsx:3808 `<DomesticShopSearch …>`
 * ```
 * 🟢 그래서 **①이 0건이어도 ②가 화면에 후보를 띄울 수 있다.** 이 하니스는 ②의
 *    파이프라인을 **운영 함수 그대로** 돌려 그 후보가 실제로 표시 대상이 되는지 센다.
 *
 * 🔴 「화면을 봤다」를 재현한 것이 **아니다** — 로그인 뒤 DOM 은 CTO 가 읽을 수 없다
 *    (메모 `production-payload-is-unreachable`). 이 하니스가 증명하는 것은
 *    **「그 후보가 ②의 표시 게이트를 통과한다」** 까지다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  domesticMatchDisplay,
  isDefaultVisibleTier,
  mayShowCandidate,
  MIN_DISPLAY_SIMILARITY,
} from "@/app/pipeline/commerce/match-display";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_DISPLAY === "1";

interface ProvSnap { id: string; source_url: string; title: string; canonical_product: unknown }
const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${f}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

/* ════════════════════════════════════════════════════════════════════════════
 * ① 🟢 표시 게이트의 성질 — HTTP 0 · 운영 함수만 읽는다
 * ════════════════════════════════════════════════════════════════════════════ */

describe("① 🟢 표시 게이트 (HTTP 0 · AI 0)", () => {
  it("①-1 🔴 `SIMILAR` 는 **기본 노출** 이다 — 「유사상품」으로 화면에 선다", () => {
    /** 🔴 이것이 CEO 가 본 것의 구조적 설명이다. 무관한 상품이라도 matchTruth 가
     *    `SIMILAR` 이면 기본 노출 등급이고, 그 다음은 confidence 하한만 본다. */
    expect(domesticMatchDisplay("SIMILAR").tier).toBe("SIMILAR");
    expect(isDefaultVisibleTier("SIMILAR")).toBe(true);
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: MIN_DISPLAY_SIMILARITY })).toBe(true);
  });

  it("①-2 🟢 `INSUFFICIENT_EVIDENCE` 는 기본 노출에서 빠진다", () => {
    expect(domesticMatchDisplay("INSUFFICIENT_EVIDENCE").tier).toBe("UNKNOWN");
    expect(isDefaultVisibleTier("UNKNOWN")).toBe(false);
    expect(mayShowCandidate({ tier: "UNKNOWN", confidence: 0.9 })).toBe(false);
  });

  it("①-3 🟢 `CONFLICT` 는 verdict 로도 tier 로도 막힌다", () => {
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: 0.9, crossSellerVerdict: "CONFLICT" })).toBe(false);
    expect(isDefaultVisibleTier("CONFLICT")).toBe(false);
  });

  it("①-4 🔴🔴 `matchLevel === low` 는 표시 게이트의 **입력이 아니다**", () => {
    /** 🔴 그래서 「low 를 화면에서 빼라」를 `matchLevel` 로 구현하면 **과거 버그가
     *    되돌아온다** — 리포 기록(P-24 Sprint 2): 진짜 동일상품(STRONG_IDENTIFIER)의
     *    confidence 가 0.42(= low)였고, 그때 걸려 있던 `matchLevel !== "low"` 필터가
     *    그 후보를 숨겼다. 그 필터는 **의도적으로 제거** 됐다.
     *    → 🟢 지금 축은 `matchTruth`(식별 증거) + confidence 하한이다. */
    expect(mayShowCandidate({ tier: "SAME", confidence: 0.1 })).toBe(true);
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: MIN_DISPLAY_SIMILARITY - 0.01 })).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ② 🔴 실측 — transient 경로(②)를 운영 함수로 돌려 **표시 여부** 를 센다
 * ════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!LIVE)("② 🔴 transient 검색 후보가 화면 게이트를 통과하는가", () => {
  it(
    "searchDomesticShops → excludeSelfReference → attachMatchTruth → mayShowCandidate",
    async () => {
      const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
      const sources = read<{ id: string; name: string; domain: string; currency: string | null; collectionStrategy: string; status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean }[]>(
        "e2e-sources.json",
      );

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{ status: string; domain: string; candidates: Record<string, unknown>[] }[]>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      /** 🟢 **운영 함수 그대로** — 검색 route 가 쓰는 두 함수를 같은 순서로 부른다. */
      const { attachMatchTruth, excludeSelfReference } = await import(
        "../../../domestic-price-sources/_lib/attach-match-truth"
      );
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      const snap = prov.snapshots.find((s) => s.source_url.includes("bobochoses.co.jp") && !s.source_url.includes("?"));
      if (!snap) throw new Error("대상 스냅샷 없음");

      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonical_product));
      const qFacts = shared.productFactsFromIdentityDna(dna);
      const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
      const code = (dna.brandModelCode as string | null) ?? null;

      const targets = sources
        .filter((s) => isBatchSurveyTarget(s as never, ["KIDS_FASHION"]))
        .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      const raw = await crawler.searchDomesticShops(
        {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? snap.title, searchTerms: terms, facts: qFacts,
        },
        targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
      );

      /** 🔴 `excludeSelfReference` 는 배열이 아니라 `{ results, excluded }` 를 돌려준다 —
       *     route.ts:215 와 **같은 분해** 를 쓴다(모양을 추측하지 않는다). */
      const { results: deduped, excluded: selfReferenceExcluded } = excludeSelfReference(
        raw as never,
        snap.source_url,
      );
      const withTruth = await attachMatchTruth(deduped, code, (dna.color as string | null) ?? null);

      const rows = (withTruth as unknown as { domain: string; status: string; candidates: Record<string, unknown>[] }[])
        .filter((r) => r.status === "ok")
        .flatMap((r) =>
          r.candidates.map((c) => {
            const truth = c.matchTruth as Parameters<typeof domesticMatchDisplay>[0] | undefined;
            const tier = truth ? domesticMatchDisplay(truth).tier : null;
            const confidence = Number(c.confidence ?? 0);
            return {
              domain: r.domain,
              title: String(c.title ?? "").slice(0, 60),
              url: String(c.url ?? "").slice(0, 90),
              matchLevel: c.matchLevel ?? null,
              matchTruth: truth ?? null,
              crossSellerVerdict: c.crossSellerVerdict ?? null,
              confidence,
              displayTier: tier,
              "🔴 화면에 보이는가": tier
                ? mayShowCandidate({
                    tier,
                    confidence,
                    crossSellerVerdict: c.crossSellerVerdict as never,
                  })
                : null,
            };
          }),
        );

      const shown = rows.filter((r) => r["🔴 화면에 보이는가"] === true);
      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-010 STEP 1 — 화면 후보의 **공급 경로 ②**(transient 라이브 검색)를 운영 함수로 재현. " +
          "🔴 로그인 뒤 DOM 을 재현한 것이 아니다 — 증명 범위는 「그 후보가 표시 게이트를 통과한다」까지다. " +
          "🔴 AI 0 · 키 0 · 결제 0 · DB 쓰기 0.",
        snapshot: snap.id.slice(0, 8),
        sourceUrl: snap.source_url,
        "원본 품번": code,
        "원본 브랜드": dna.brand ?? null,
        "검색어": terms,
        "후보 총수": rows.length,
        "자기참조 제외": selfReferenceExcluded,
        "🔴 화면 표시 대상": shown.length,
        "matchTruth 분포": rows.reduce<Record<string, number>>((a, r) => {
          const k = String(r.matchTruth ?? "(없음)");
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        "displayTier 분포": rows.reduce<Record<string, number>>((a, r) => {
          const k = String(r.displayTier ?? "(없음)");
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        후보: rows,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu010-display-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu010-display-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, 후보: `(wu010-display-${seq}.json)` }, null, 1));

      expect(rows.length).toBeGreaterThan(0);
    },
    30 * 60 * 1000,
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * ③ 🔴🔴 **해외 transient 경로** — CPO 가 최우선으로 지정한 측정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 필터를 그대로 쓴다 — `isActive && isCollectableAccess && sourceFitsScopes`
 *    (comparison/search/route.ts:91-93). `listComparisonShops()` 는 service-role 이
 *    필요해 로컬에서 못 부르므로 **같은 행** 을 DB 덤프로 받아 필터만 운영 함수로 돈다.
 */
describe.skipIf(!LIVE)("③ 🔴🔴 해외 비교 후보가 화면 게이트를 통과하는가", () => {
  it(
    "searchComparisonShops → attachProductMatchTruth → overseasMatchDisplay → mayShowCandidate",
    async () => {
      const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
      const shopRows = read<
        {
          id: string; name: string; domain: string; currency: string | null;
          is_active: boolean; access_status: string | null; category_scope: string[] | null;
        }[]
      >("wu010-comparison-shops.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchComparisonShops: (q: unknown, s: unknown[]) => Promise<{ status: string; domain: string; candidates: Record<string, unknown>[] }[]>;
        attachProductMatchTruth: (q: unknown, r: unknown[]) => { status: string; domain: string; candidates: Record<string, unknown>[] }[];
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        identityDnaFromFields: (f: Record<string, unknown>) => unknown;
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
      };
      /** 🟢 운영 필터 두 함수 — 복제하지 않는다. */
      const { isCollectableAccess } = await import("../../../comparison-shops/_lib/comparison-shop");
      /** 🔴 `sourceFitsScopes` 는 **`@commerce/category`** 다 — 라우트의 import 블록을
       *     그대로 베낀다(패키지를 추측하지 않는다 · 메모 measure-with-the-production-function). */
      const { sourceFitsScopes } = (await import("@commerce/category")) as unknown as {
        sourceFitsScopes: (sourceScope: string[], profileScopes: string[] | null) => boolean;
      };
      const { overseasMatchDisplay } = await import("@/app/pipeline/commerce/match-display");

      const snap = prov.snapshots.find((s) => s.source_url.includes("bobochoses.co.jp") && !s.source_url.includes("?"));
      if (!snap) throw new Error("대상 스냅샷 없음");
      const cp = snap.canonical_product as Record<string, { value?: unknown }> | null;
      const dnaFromSnapshot = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonical_product));

      /** 🔴 화면이 보내는 필드 그대로 — route.ts:46-56 과 같은 모양. */
      const facts = shared.productFactsFromIdentityDna(
        shared.identityDnaFromFields({
          title: snap.title,
          brand: String((cp?.brand?.value as string | undefined) ?? "") || undefined,
          sku: (dnaFromSnapshot.brandModelCode as string | null) ?? undefined,
          sourceUrl: snap.source_url,
          color: (dnaFromSnapshot.color as string | null) ?? undefined,
          material: (dnaFromSnapshot.material as string | null) ?? undefined,
        }),
      );
      const query = {
        title: snap.title,
        brand: String((cp?.brand?.value as string | undefined) ?? "") || undefined,
        sourceUrl: snap.source_url,
        sku: (dnaFromSnapshot.brandModelCode as string | null) ?? undefined,
        facts,
      };

      const scopes = ["KIDS_FASHION"];
      const shops = shopRows.filter(
        (s) =>
          s.is_active &&
          isCollectableAccess(s.access_status as never) &&
          sourceFitsScopes(s.category_scope ?? [], scopes),
      );

      const raw = await crawler.searchComparisonShops(
        query,
        shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
      );
      const withTruth = crawler.attachProductMatchTruth(query, raw);

      const rows = withTruth
        .filter((r) => r.status === "ok")
        .flatMap((r) =>
          r.candidates.map((c) => {
            const truth = c.productMatchTruth as Parameters<typeof overseasMatchDisplay>[0] | undefined;
            const tier = truth ? overseasMatchDisplay(truth).tier : null;
            const confidence = Number(c.confidence ?? 0);
            return {
              domain: r.domain,
              title: String(c.title ?? "").slice(0, 60),
              url: String(c.url ?? "").slice(0, 90),
              price: c.price ?? null,
              matchLevel: c.matchLevel ?? null,
              productMatchTruth: truth ?? null,
              confidence,
              displayTier: tier,
              "🔴 화면에 보이는가": tier ? mayShowCandidate({ tier, confidence }) : null,
            };
          }),
        );

      const shown = rows.filter((r) => r["🔴 화면에 보이는가"] === true);
      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-010 ③ — 해외 transient 경로를 **운영 필터·운영 함수** 로 재현. " +
          "🔴 로그인 뒤 DOM 을 재현한 것이 아니다 — 증명 범위는 「그 후보가 표시 게이트를 통과한다」까지다. " +
          "🔴 AI 0 · 키 0 · 결제 0 · DB 쓰기 0 · 가격 환산 0.",
        snapshot: snap.id.slice(0, 8),
        "원본 브랜드(화면이 보내는 값)": query.brand ?? null,
        "원본 품번": query.sku ?? null,
        "대상 샵 수": shops.length,
        "응답 샵": raw.length,
        "오류 샵": raw.filter((r) => r.status !== "ok").length,
        "후보 총수": rows.length,
        "🔴🔴 화면 표시 대상": shown.length,
        "productMatchTruth 분포": rows.reduce<Record<string, number>>((a, r) => {
          const k = String(r.productMatchTruth ?? "(없음)");
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        "displayTier 분포": rows.reduce<Record<string, number>>((a, r) => {
          const k = String(r.displayTier ?? "(없음)");
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        "🔴 표시되는 후보(도메인별)": shown.reduce<Record<string, number>>((a, r) => {
          a[r.domain] = (a[r.domain] ?? 0) + 1;
          return a;
        }, {}),
        "표시되는 후보 상세": shown,
        후보: rows,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu010-overseas-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu010-overseas-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(
        "\n" + JSON.stringify({ ...report, 후보: `(wu010-overseas-${seq}.json)`, "표시되는 후보 상세": shown.slice(0, 8) }, null, 1),
      );

      expect(shops.length).toBeGreaterThan(0);
    },
    60 * 60 * 1000,
  );
});
