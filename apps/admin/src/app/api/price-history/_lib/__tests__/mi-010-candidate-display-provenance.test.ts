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

/* ════════════════════════════════════════════════════════════════════════════
 * ④ 🔴🔴 WU-010A — **브랜드 반사실** (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **딱 한 변수만 바꾼다.** 샵 목록·질의 구성·판정 함수·표시 게이트는 ③과 **같은 코드** 다.
 * ```
 * A  brand = 공백            (운영 현재 상태 — canonicalProduct.brand.value 가 빈 값)
 * B  brand = "Bobo Choses"   🟢 **원본 상품 URL 에서 검증된 값**(og:site_name 실측)
 *                            🔴 **측정 입력** 이고, 운영에 그 규칙을 넣는 것이 아니다.
 * ```
 * 🔴🔴 두 실행은 **서로 다른 HTTP 응답** 이다(샵 오류율이 매번 다르다). 그래서 후보를
 *    **정규화 URL 로 조인** 해 **공통 집합만** 비교한다 — 분모가 다른 숫자를 나란히 적지 않는다.
 * 🔴 임계값·게이트·판정 로직을 **한 글자도 바꾸지 않았다.**
 */
describe.skipIf(!LIVE)("④ 🔴🔴 WU-010A 브랜드 반사실 — 한 변수만 바꾼다", () => {
  it(
    "A(brand 공백) vs B(brand 주입) — 같은 후보의 판정이 바뀌는가",
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
      const { isCollectableAccess } = await import("../../../comparison-shops/_lib/comparison-shop");
      const { sourceFitsScopes } = (await import("@commerce/category")) as unknown as {
        sourceFitsScopes: (sourceScope: string[], profileScopes: string[] | null) => boolean;
      };
      const { overseasMatchDisplay } = await import("@/app/pipeline/commerce/match-display");
      /** 🟢 조인 키는 운영 정규화기 — 쿼리 echo 가 붙어 생문자열로는 맞지 않는다. */
      const { normalizeCandidateUrl } = await import("../gemini-candidate-pool");

      const snap = prov.snapshots.find((s) => s.source_url.includes("bobochoses.co.jp") && !s.source_url.includes("?"));
      if (!snap) throw new Error("대상 스냅샷 없음");
      const dnaFromSnapshot = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonical_product));
      const sku = (dnaFromSnapshot.brandModelCode as string | null) ?? undefined;
      const color = (dnaFromSnapshot.color as string | null) ?? undefined;
      const material = (dnaFromSnapshot.material as string | null) ?? undefined;

      const shops = shopRows.filter(
        (s) =>
          s.is_active &&
          isCollectableAccess(s.access_status as never) &&
          sourceFitsScopes(s.category_scope ?? [], ["KIDS_FASHION"]),
      );
      const shopRefs = shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency }));

      /** 🔴 질의 구성은 route.ts:46-56 과 **같은 모양** 이고 brand 만 인자다. */
      const buildQuery = (brand: string | undefined) => {
        const facts = shared.productFactsFromIdentityDna(
          shared.identityDnaFromFields({ title: snap.title, brand, sku, sourceUrl: snap.source_url, color, material }),
        );
        return { title: snap.title, brand, sourceUrl: snap.source_url, sku, facts };
      };

      const runArm = async (label: string, brand: string | undefined) => {
        const query = buildQuery(brand);
        const raw = await crawler.searchComparisonShops(query, shopRefs);
        const withTruth = crawler.attachProductMatchTruth(query, raw);
        const rows = withTruth
          .filter((r) => r.status === "ok")
          .flatMap((r) =>
            r.candidates.map((c) => {
              const truth = c.productMatchTruth as Parameters<typeof overseasMatchDisplay>[0] | undefined;
              const tier = truth ? overseasMatchDisplay(truth).tier : null;
              const confidence = Number(c.confidence ?? 0);
              return {
                key: normalizeCandidateUrl(String(c.url ?? "")),
                domain: r.domain,
                title: String(c.title ?? "").slice(0, 56),
                truth: truth ?? null,
                confidence,
                tier,
                shown: tier ? mayShowCandidate({ tier, confidence }) : null,
              };
            }),
          );
        return {
          label,
          brand: brand ?? "(공백)",
          "대상 샵": shopRefs.length,
          "오류 샵": raw.filter((r) => r.status !== "ok").length,
          "후보 수": rows.length,
          "표시 수": rows.filter((r) => r.shown).length,
          rows,
        };
      };

      /** 🔴 A → B **직렬** 실행(동시 실행하면 같은 샵에 두 배 부하가 간다). */
      const A = await runArm("A(brand 공백)", undefined);
      const B = await runArm("B(brand 주입)", "Bobo Choses");

      const bByKey = new Map(B.rows.map((r) => [r.key, r]));
      const common = A.rows
        .filter((a) => bByKey.has(a.key))
        .map((a) => {
          const b = bByKey.get(a.key)!;
          return {
            domain: a.domain,
            title: a.title,
            "A truth": a.truth,
            "A conf": a.confidence,
            "A 표시": a.shown,
            "B truth": b.truth,
            "B conf": b.confidence,
            "B 표시": b.shown,
            "🔴 판정 변화": a.truth !== b.truth,
            "🔴 표시 변화": a.shown !== b.shown,
          };
        });

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-010A — **브랜드 한 변수만** 바꾼 반사실. 🔴 두 실행은 서로 다른 HTTP 응답이라 " +
          "후보를 **정규화 URL 로 조인한 공통 집합** 만 비교했다(분모 혼합 금지). " +
          "🔴 임계값·게이트·판정 로직 변경 0 · AI 0 · 키 0 · 결제 0 · DB 쓰기 0 · 운영 변경 0. " +
          "🟢 B 의 브랜드는 **원본 상품 URL 의 og:site_name 실측값** 이고 운영 규칙이 아니다.",
        A: { ...A, rows: undefined },
        B: { ...B, rows: undefined },
        "공통 후보 수": common.length,
        "🔴🔴 판정이 바뀐 후보": common.filter((r) => r["🔴 판정 변화"]).length,
        "🔴🔴 표시가 바뀐 후보": common.filter((r) => r["🔴 표시 변화"]).length,
        "A→B truth 전이": common.reduce<Record<string, number>>((acc, r) => {
          const k = `${String(r["A truth"])} → ${String(r["B truth"])}`;
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        "🔴 ICHI/Elovera 후보": common.filter((r) => /ichi|elovera/i.test(r.title)),
        "A 에서만 표시": A.rows.filter((a) => a.shown && !bByKey.get(a.key)?.shown).map((a) => `${a.domain} | ${a.title}`),
        "B 에서만 표시": B.rows
          .filter((b) => b.shown)
          .filter((b) => {
            const a = A.rows.find((x) => x.key === b.key);
            return !a || !a.shown;
          })
          .map((b) => `${b.domain} | ${b.title}`),
        공통: common,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu010a-counterfactual-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu010a-counterfactual-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, 공통: `(wu010a-counterfactual-${seq}.json)` }, null, 1));

      /** 🔴 공통 집합이 0 이면 비교가 성립하지 않는다. */
      expect(common.length).toBeGreaterThan(0);
    },
    60 * 60 * 1000,
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * ⑤ 🔴🔴 WU-011 — **해외 검색 신뢰도: 샵별 원인 분류** (CPO 지시 · 분류만)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 threshold 변경 0 · SIMILAR 차단 0 · brand resolver 0 · 검색 query 변경 0 ·
 *    Registry 0 · AI/API 0 · 배포 0 · 운영 코드 변경 0.
 *
 * 🔴🔴 **앞선 「오류 20/30」을 그대로 쓰지 않는다.** 그 숫자는 `status !== "ok"` 였고,
 *    운영 타입이 **네 상태** 를 명시적으로 가른다(types.ts:139-154):
 * ```
 * ok             자동 수집을 실제로 수행했다(결과 0건일 수도 있다)
 * unsupported    이 소스를 읽을 파서/어댑터가 **없다 — 요청을 보내지 않았다**
 * error          수행했는데 실패했다
 * not_configured 어댑터는 있는데 **자격증명이 없어** 요청을 보내지 않았다
 * ```
 * 🔴 그 주석이 **바로 이 뭉개기를 금지** 한다 — 「물어보지도 못한 것을 없다고 말하지
 *    않는다」. 그래서 이 블록은 넷을 **갈라서** 센다.
 */
describe.skipIf(!LIVE)("⑤ 🔴🔴 WU-011 해외 검색 신뢰도 — 샵별 원인 분류", () => {
  it(
    "status 넷을 갈라 세고, ok 인 샵만 후보 품질을 집계한다",
    async () => {
      const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
      const shopRows = read<
        {
          id: string; name: string; domain: string; currency: string | null;
          is_active: boolean; access_status: string | null; category_scope: string[] | null;
        }[]
      >("wu010-comparison-shops.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchComparisonShops: (q: unknown, s: unknown[]) => Promise<
          { shopId: string; shopName: string; domain: string; status: string; candidates: Record<string, unknown>[]; error?: string }[]
        >;
        attachProductMatchTruth: (q: unknown, r: unknown[]) => { domain: string; status: string; candidates: Record<string, unknown>[] }[];
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        identityDnaFromFields: (f: Record<string, unknown>) => unknown;
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
      };
      const { isCollectableAccess } = await import("../../../comparison-shops/_lib/comparison-shop");
      const { sourceFitsScopes } = (await import("@commerce/category")) as unknown as {
        sourceFitsScopes: (s: string[], p: string[] | null) => boolean;
      };
      const { overseasMatchDisplay } = await import("@/app/pipeline/commerce/match-display");

      const snap = prov.snapshots.find((s) => s.source_url.includes("bobochoses.co.jp") && !s.source_url.includes("?"));
      if (!snap) throw new Error("대상 스냅샷 없음");
      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonical_product));
      const facts = shared.productFactsFromIdentityDna(
        shared.identityDnaFromFields({
          title: snap.title,
          sku: (dna.brandModelCode as string | null) ?? undefined,
          sourceUrl: snap.source_url,
          color: (dna.color as string | null) ?? undefined,
          material: (dna.material as string | null) ?? undefined,
        }),
      );
      /** 🔴 검색 query 를 바꾸지 않았다 — ③④와 **같은 구성** 이다. */
      const query = { title: snap.title, sourceUrl: snap.source_url, sku: (dna.brandModelCode as string | null) ?? undefined, facts };

      const shops = shopRows.filter(
        (s) => s.is_active && isCollectableAccess(s.access_status as never) && sourceFitsScopes(s.category_scope ?? [], ["KIDS_FASHION"]),
      );
      const t0 = Date.now();
      const raw = await crawler.searchComparisonShops(
        query,
        shops.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency })),
      );
      const elapsedMs = Date.now() - t0;
      const withTruth = crawler.attachProductMatchTruth(query, raw);

      /** 🔴 error 문자열을 **분류** 한다. 🟢 원문도 같이 남긴다(분류가 틀렸을 때 보이게). */
      const classify = (r: { status: string; error?: string }) => {
        if (r.status !== "error") return r.status;
        const e = (r.error ?? "").toLowerCase();
        if (/timeout|aborted|abort/.test(e)) return "error:timeout";
        if (/40[13]|forbidden|unauthorized|blocked|captcha/.test(e)) return "error:접근차단";
        if (/404|not found/.test(e)) return "error:404";
        if (/50\d|bad gateway|gateway/.test(e)) return "error:5xx";
        if (/json|parse|unexpected token|invalid/.test(e)) return "error:parse/형식";
        if (/enotfound|econnrefused|dns|certificate|tls|socket|network|fetch failed/.test(e)) return "error:네트워크";
        return "error:기타";
      };

      const perShop = raw.map((r) => ({
        domain: r.domain,
        status: r.status,
        분류: classify(r),
        "후보 수": r.candidates.length,
        "error 원문": r.error ? String(r.error).slice(0, 160) : null,
      }));

      const byClass = perShop.reduce<Record<string, number>>((a, r) => {
        a[r.분류] = (a[r.분류] ?? 0) + 1;
        return a;
      }, {});

      /** 🟢 **ok 인 샵만** 후보 품질을 집계한다 — 물어보지 못한 샵을 분모에 넣지 않는다. */
      const okRows = withTruth
        .filter((r) => r.status === "ok")
        .flatMap((r) =>
          r.candidates.map((c) => {
            const truth = c.productMatchTruth as Parameters<typeof overseasMatchDisplay>[0] | undefined;
            const tier = truth ? overseasMatchDisplay(truth).tier : null;
            const confidence = Number(c.confidence ?? 0);
            return {
              domain: r.domain,
              title: String(c.title ?? "").slice(0, 56),
              truth: truth ?? null,
              confidence,
              tier,
              shown: tier ? mayShowCandidate({ tier, confidence }) : null,
            };
          }),
        );

      const okShops = raw.filter((r) => r.status === "ok");
      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-011 — **분류만** 한다. 🔴 threshold·SIMILAR·brand·query·Registry·AI·배포 변경 0. " +
          "🔴🔴 앞선 「오류 20/30」은 `status !== ok` 였고 운영 타입은 **네 상태** 를 가른다 — " +
          "`unsupported`(파서 없음 · 요청 안 보냄)와 `error`(실제 실패)를 **같은 숫자로 쓰지 않는다**. " +
          "🔴 1회 관측이고 해외 응답은 실행마다 달라진다(WU-010A 실측) — 재현성은 별 사안이다.",
        "대상 샵": shops.length,
        "총 소요(ms)": elapsedMs,
        "🔴🔴 status 분류": byClass,
        "ok 샵": okShops.length,
        "ok 이지만 후보 0건인 샵": okShops.filter((r) => r.candidates.length === 0).map((r) => r.domain),
        "🟢 ok 샵만의 후보 품질": {
          "후보 총수": okRows.length,
          "truth 분포": okRows.reduce<Record<string, number>>((a, r) => {
            const k = String(r.truth ?? "(없음)");
            a[k] = (a[k] ?? 0) + 1;
            return a;
          }, {}),
          "displayTier 분포": okRows.reduce<Record<string, number>>((a, r) => {
            const k = String(r.tier ?? "(없음)");
            a[k] = (a[k] ?? 0) + 1;
            return a;
          }, {}),
          "표시 대상": okRows.filter((r) => r.shown).length,
          "표시되는 후보": okRows.filter((r) => r.shown).map((r) => `${r.domain} | ${r.title} | conf ${r.confidence}`),
          "confidence 분포(표시 등급만)": okRows
            .filter((r) => r.tier === "SIMILAR" || r.tier === "PRESUMED_SAME" || r.tier === "SAME")
            .map((r) => r.confidence)
            .sort((a, b) => b - a),
        },
        "샵별 상세": perShop,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu011-reliability-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu011-reliability-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, "샵별 상세": `(wu011-reliability-${seq}.json)` }, null, 1));

      expect(shops.length).toBeGreaterThan(0);
    },
    60 * 60 * 1000,
  );
});
