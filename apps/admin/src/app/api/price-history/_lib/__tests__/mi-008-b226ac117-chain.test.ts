/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-008 — `B226AC117` **Production 후보 사슬 / 가격 provenance 추적**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Gemini 0 · Anthropic 0 · OpenAI 0 · 검색 API 0 · API 키 0 · 결제 0 ·
 *    새 Discovery 기능 0 · Registry 변경 0 · 가격 추정/환산 0 · 임계값 변경 0 ·
 *    Production 재배포 0 · DB 쓰기 0.
 * 🔴 게이트 `MI_P0_02_CHAIN=1` 없으면 **SKIP**(회귀에서 외부 HTTP 금지).
 *
 * ── 🔴🔴 이 WU 가 먼저 깨야 하는 전제 ──────────────────────────────────────
 * ```
 * CEO 화면의 `¥26,400` 이 「엉뚱한 판매처 가격」인가?
 * 🔴 DB 실측(wu008-provenance): **아니다.**
 *    같은 상품이 **스냅샷 13개** 로 쪼개져 있고 원본 URL 이 둘이다 —
 *      bobochoses.co.jp → canonicalProduct.price = **26,400 JPY** (source ORIGINAL)
 *      bobochoses.com   → canonicalProduct.price = **120 EUR**    (source ORIGINAL)
 *    CPO 가 CEO 에게 준 테스트 URL 이 **`.co.jp`** 였다(게다가 `?utm_source=chatgpt.com`).
 * → 그 화면의 JPY 는 **그 URL 의 원본 시장 가격** 이고 헌장의 「원본 통화 그대로」와 일치한다.
 * ```
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInEvidence } from "@commerce/crawler";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_CHAIN === "1";

interface SourceRow {
  id: string; name: string; domain: string; currency: string | null;
  collectionStrategy: string; status: string; accessStatus: string | null;
  categoryScope: string[] | null; enabled: boolean;
}
interface ProvSnap {
  id: string; source_url: string; title: string; workspace_id: string;
  canonical_product: unknown;
}
interface RawResult {
  status: string; domain: string;
  candidates: { title: string; url: string; price?: { amount: number; currency: string } | null; matchLevel?: string | null; sku?: string | null; facts?: Record<string, unknown> | null }[];
}

const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${f}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

describe("① 🟢 사전 검증 — 전제 반증 (HTTP 0 · AI 0)", () => {
  it("①-1 🔴🔴 같은 상품이 스냅샷 여러 개로 쪼개져 있고 **원본 통화가 다르다**", () => {
    const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
    const snaps = prov.snapshots;
    expect(snaps.length).toBeGreaterThan(1);

    const priceOf = (s: ProvSnap) =>
      (s.canonical_product as { price?: { value?: { amount?: number; currency?: string } } } | null)?.price?.value ?? {};
    const jp = snaps.filter((s) => s.source_url.includes("bobochoses.co.jp"));
    const com = snaps.filter((s) => /bobochoses\.com/.test(s.source_url));

    expect(jp.length).toBeGreaterThan(0);
    expect(com.length).toBeGreaterThan(0);
    /** 🔴 `.co.jp` 원본가는 **JPY 26,400** 이고 그것이 ORIGINAL 이다. */
    expect(priceOf(jp[0]).currency).toBe("JPY");
    expect(priceOf(jp[0]).amount).toBe(26400);
    /** 🟢 `.com` 원본가는 **EUR 120** — 서로 다른 시장이다. */
    expect(priceOf(com[0]).currency).toBe("EUR");
    expect(priceOf(com[0]).amount).toBe(120);
  });

  it("①-2 🔴 쿼리 파라미터만 다른 URL 이 **별개 스냅샷** 을 만든다", () => {
    const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
    const jp = prov.snapshots.filter((s) => s.source_url.includes("bobochoses.co.jp"));
    /** 🔴 실측: 하나는 `?utm_source=chatgpt.com` 가 붙어 있고 하나는 없다 — 그 차이만으로
     *     스냅샷이 둘이 됐다. 🟢 WU-007A 와 **같은 계열**(쿼리 정규화)의 문제다. */
    const withQuery = jp.filter((s) => s.source_url.includes("?"));
    const withoutQuery = jp.filter((s) => !s.source_url.includes("?"));
    expect(withQuery.length).toBeGreaterThan(0);
    expect(withoutQuery.length).toBeGreaterThan(0);
    expect(withQuery[0].source_url.split("?")[0]).toBe(withoutQuery[0].source_url);
  });

  it("①-3 🔴🔴 `.co.jp` 스냅샷에는 **en-kr(₩258,000) 관측이 없다**", () => {
    const ms = read<{
      snaps: { id: string; source_url: string }[];
      rows: { snapshot_id: string; market_code: string | null; currency: string; price_krw: string | number }[];
    }>("wu008-market-split.json");

    const hasKr = (id: string) => ms.rows.some((r) => r.snapshot_id === id && r.market_code === "en-kr");
    const jp = ms.snaps.filter((s) => s.source_url.includes("bobochoses.co.jp"));
    const com = ms.snaps.filter((s) => /bobochoses\.com/.test(s.source_url));

    /** 🔴 **결함** — 원본이 `.co.jp` 면 KR 시장 가격을 한 건도 갖지 못한다. */
    expect(jp.every((s) => !hasKr(s.id))).toBe(true);
    /** 🟢 그런데 `.com` 스냅샷은 **전건** KR 가격을 갖고 있다 → 수집기는 작동한다. */
    expect(com.every((s) => hasKr(s.id))).toBe(true);
    /** 🟢 그 값이 ₩258,000 이다 — CPO 가 외부에서 확인한 값과 같다. */
    const kr = ms.rows.filter((r) => r.market_code === "en-kr");
    expect(kr.length).toBeGreaterThan(0);
    expect(kr.every((r) => Number(r.price_krw) === 258000 && r.currency === "KRW")).toBe(true);
  });

  it("①-4 🔴 이 상품에 국내 링크가 **0건** 이다 (저장된 동일상품 증거 없음)", () => {
    const prov = read<{ links: unknown[] }>("wu008-provenance.json");
    expect(prov.links).toHaveLength(0);
  });

  it("①-5 🔴 브랜드가 **비어 있다** — Identity 브랜드 축이 죽어 있다", () => {
    const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
    const brandOf = (s: ProvSnap) =>
      String((s.canonical_product as { brand?: { value?: string } } | null)?.brand?.value ?? "");
    const brands = prov.snapshots.map(brandOf);
    /** 🔴 실측: 대부분 빈 문자열이고, 값이 있는 1건은 **"AW26"**(시즌이지 브랜드가 아니다). */
    expect(brands.filter((b) => b === "").length).toBeGreaterThan(0);
    expect(brands.some((b) => b === "" || b === "AW26")).toBe(true);
    expect(brands.includes("Bobo Choses")).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
 * ② 🔴 실측 — 운영 검색 경로를 그대로 돌려 **후보 사슬** 을 본다
 * ════════════════════════════════════════════════════════════════════════════ */

describe.skipIf(!LIVE)("② 🔴 Production 후보 사슬 재현 (AI 0 · 무키 HTTP)", () => {
  it(
    "실효 대상 샵 → 후보 → 품번 Evidence → 가격 provenance",
    async () => {
      const prov = read<{ snapshots: ProvSnap[] }>("wu008-provenance.json");
      const sources = read<SourceRow[]>("e2e-sources.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<RawResult[]>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      /** 🔴 운영과 **같은 술어** 로 대상 샵을 고른다(복제 계산 아님). */
      const targets = sources
        .filter((s) => isBatchSurveyTarget(s as never, ["KIDS_FASHION"]))
        .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /** 🟢 두 원본(.co.jp · .com)을 **각각** 돌린다 — 입력이 다르면 결과도 다를 수 있다. */
      const picks = [
        prov.snapshots.find((s) => s.source_url.includes("bobochoses.co.jp") && !s.source_url.includes("?")),
        prov.snapshots.find((s) => /bobochoses\.com/.test(s.source_url)),
      ].filter(Boolean) as ProvSnap[];

      const out: Record<string, unknown>[] = [];
      for (const snap of picks) {
        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonical_product));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const code = (dna.brandModelCode as string | null) ?? null;

        const results = await crawler.searchDomesticShops(
          {
            title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
            searchTerm: terms[0] ?? snap.title, searchTerms: terms, facts: qFacts,
          },
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );

        const ok = results.filter((r) => r.status === "ok");
        const cands = ok.flatMap((r) =>
          r.candidates.map((c) => ({
            domain: r.domain,
            title: c.title,
            url: c.url,
            matchLevel: c.matchLevel ?? null,
            price: c.price ?? null,
            /** 🔴 WU-007A 적용 결과 — 우리 검색어가 증거로 쓰이지 않는지 본다. */
            "품번 Evidence": code
              ? confirmBrandCodeInEvidence(code, { title: c.title, url: c.url, sku: c.sku ?? null })
              : null,
          })),
        );

        out.push({
          snapshot: snap.id.slice(0, 8),
          sourceUrl: snap.source_url,
          "원본 품번(DNA)": code,
          "원본 브랜드(DNA)": dna.brand ?? null,
          "검색어 전수": terms,
          "대상 샵": targets.map((t) => t.domain),
          "응답 샵": results.length,
          "오류 샵": results.filter((r) => r.status === "error").length,
          "후보 수": cands.length,
          "🔴 품번 Evidence 획득": cands.filter((c) => c["품번 Evidence"]).length,
          "matchLevel 분포": cands.reduce<Record<string, number>>((a, c) => {
            const k = String(c.matchLevel ?? "(없음)");
            a[k] = (a[k] ?? 0) + 1;
            return a;
          }, {}),
          "후보 상세": cands,
        });
      }

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-008 — `B226AC117` 후보 사슬 재현. 🔴 AI 호출 0 · 검색 API 0 · 키 0 · 결제 0 · " +
          "새 기능 0 · DB 쓰기 0. 🔴 **CEO 화면 자체를 재현한 것이 아니다** — 로그인 뒤 응답은 " +
          "CTO 가 읽을 수 없다(메모 production-payload-is-unreachable). 이것은 **운영 검색 함수를 " +
          "같은 입력으로 돌린 결과** 이고, 화면에 무엇이 그려졌는지는 별 사안이다.",
        결과: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `wu008-chain-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `wu008-chain-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, 결과: out.map((o) => ({ ...o, "후보 상세": "(파일 참조)" })) }, null, 1));

      expect(picks.length).toBe(2);
    },
    30 * 60 * 1000,
  );
});
