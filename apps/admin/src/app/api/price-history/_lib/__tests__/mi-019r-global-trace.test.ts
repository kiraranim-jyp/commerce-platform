/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GLOBAL-E2E-TRACE (WU-019R) — 초기 2개 카테고리 연결상태 추적
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **조사 WU 다. 운영 코드를 한 줄도 바꾸지 않는다.**
 * 🔴🔴 **Gemini 호출 0 · 외부 HTTP 0.** 이 파일은 네트워크를 쓰지 않는다 —
 *    ① 덤프된 스냅샷에 **운영 owner 함수**(buildProductIdentityDna →
 *      productFactsFromIdentityDna)를 돌려 Trace A 를 «순수 계산» 으로 재고
 *    ② Gemini 후보는 **선행 WU 가 이미 저장한 결과**(acc011-1.json)를 다시 분류한다.
 *    🔴 `factsFromProductUrl` · `searchDomesticShops` 를 **부르지 않는다**(HTTP 가 난다).
 *
 * 🔴 시장(KR/해외) 분류는 **증거가 있는 것만** 한다 — ⒜ `.kr` TLD ⒝ 국내 등록부
 *    도메인 ⒞ 통화 증거. 셋 중 아무것도 없으면 **UNKNOWN** 이다(추측 금지).
 *    근거: `ComparisonCandidate` 에 market/country 칸이 **없다**(types.ts grep 0건).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown }
interface SourceRow { domain: string; name: string; collectionStrategy: string }

const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};
const rate = (n: number, d: number) => (d === 0 ? "n/a" : `${n}/${d} = ${((n / d) * 100).toFixed(0)}%`);
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null && v !== "");

describe.skipIf(!LIVE)("🔴 WU-019R — 전체 MI 연결 추적 (Gemini 0 · HTTP 0)", () => {
  it("Trace A 를 운영 owner 로 재고, 저장된 Gemini 후보를 시장별로 가른다", async () => {
    const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
    const snaps = read<SnapRow[]>("e2e-snapshots.json");
    const sources = read<SourceRow[]>("e2e-sources.json");

    const shared = (await import("@commerce/shared")) as unknown as {
      buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
      backfillCanonicalProduct: (p: unknown) => unknown;
      productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
    };

    /* ─────────── Trace A — 원상품 Identity / Facts (순수 계산) ─────────── */

    const seen = new Set<string>();
    const kids = [...(groups.control ?? []), ...groups.kids, ...groups.kids2].filter((r) =>
      seen.has(r.id) ? false : (seen.add(r.id), true),
    );
    const plan = [
      ...kids.map((row) => ({ row, scope: "KIDS_FASHION" as const })),
      ...groups.tennis.map((row) => ({ row, scope: "TENNIS" as const })),
    ];

    const identityRows: Record<string, unknown>[] = [];
    for (const { row, scope } of plan) {
      const snap = snaps.find((x) => x.id === row.id);
      if (!snap) continue;
      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
      const facts = shared.productFactsFromIdentityDna(dna);
      const brandObj = dna.brand as { value?: string; confident?: boolean } | undefined;
      const ident = dna.identifier as { tier?: string } | null;
      identityRows.push({
        scope,
        brand: row.brand || "(빈 브랜드)",
        title: row.title.slice(0, 40),
        /** 🔴 칸 이름은 owner 타입에서 읽은 것이다 — 추측하지 않았다. */
        "facts.brand": filled(facts.brand),
        "facts.brandModelCode": filled(facts.brandModelCode),
        "facts.sellerSku": filled(facts.sellerSku),
        "facts.coreTitleTokens": (facts.coreTitleTokens as string[] | undefined)?.length ?? 0,
        "facts.colorText": filled(facts.colorText),
        "facts.materialText": filled(facts.materialText),
        "facts.categoryText": filled(facts.categoryText),
        "dna.identifier.tier": ident?.tier ?? null,
        /** 🔴 Identity 전체의 confidence 칸은 «없다». brand 에만 confident(boolean) 가 있다. */
        "dna.brand.confident": brandObj?.confident ?? null,
      });
    }

    const summarize = (scope: string) => {
      const rs = identityRows.filter((r) => r.scope === scope);
      const n = rs.length;
      const cnt = (k: string) => rs.filter((r) => r[k] === true).length;
      return {
        상품: n,
        brand: rate(cnt("facts.brand"), n),
        brandModelCode: rate(cnt("facts.brandModelCode"), n),
        sellerSku: rate(cnt("facts.sellerSku"), n),
        "coreTitleTokens ≥1": rate(rs.filter((r) => Number(r["facts.coreTitleTokens"]) > 0).length, n),
        colorText: rate(cnt("facts.colorText"), n),
        materialText: rate(cnt("facts.materialText"), n),
        categoryText: rate(cnt("facts.categoryText"), n),
        "brand.confident=true": rate(rs.filter((r) => r["dna.brand.confident"] === true).length, n),
        "🔴 identifier tier 분포": rs.reduce<Record<string, number>>((t, r) => {
          const k = String(r["dna.identifier.tier"] ?? "(없음)");
          t[k] = (t[k] ?? 0) + 1;
          return t;
        }, {}),
      };
    };

    /* ──── Trace B/C — 저장된 Gemini 후보를 «시장» 으로 가른다 (신규 호출 0) ──── */

    const registryDomains = new Set(sources.map((s) => s.domain.toLowerCase()));
    /** 🔴 증거 기반 분류만 한다. 근거가 없으면 UNKNOWN 이고 0 으로도 KR 로도 세지 않는다. */
    const classifyMarket = (domain: string, currencies: Record<string, number>) => {
      const d = domain.toLowerCase();
      const cur = Object.keys(currencies);
      if (d.endsWith(".kr") || d.includes(".co.kr")) return { market: "KR", basis: "TLD(.kr)" };
      if (registryDomains.has(d)) return { market: "KR", basis: "국내 등록부 도메인" };
      if (cur.length === 1 && cur[0] === "KRW") return { market: "KR", basis: "통화 KRW" };
      if (cur.length === 1 && cur[0] !== "KRW") return { market: "해외", basis: `통화 ${cur[0]}` };
      if (/\.(jp|com\.jp|co\.jp|us|fr|de|uk|co\.uk|it|es)$/.test(d)) return { market: "해외", basis: "국가 TLD" };
      return { market: "UNKNOWN", basis: "🔴 증거 없음 — 추측하지 않는다" };
    };

    let acc: Record<string, unknown> | null = null;
    try {
      acc = read<Record<string, unknown>>("acc011-1.json");
    } catch {
      acc = null;
    }

    const candidateTable: Record<string, unknown>[] = [];
    if (acc) {
      const coverage = acc["⑨ Domain Coverage"] as {
        domain: string;
        candidates: number;
        priceOk: number;
        currencies: Record<string, number>;
        tiers: Record<string, number>;
      }[];
      for (const c of coverage) {
        const { market, basis } = classifyMarket(c.domain, c.currencies ?? {});
        candidateTable.push({
          domain: c.domain,
          "🔴 Source Market": market,
          "분류 근거": basis,
          후보: c.candidates,
          "가격 획득": c.priceOk,
          통화: Object.keys(c.currencies ?? {}).join(",") || "(없음)",
          tier: c.tiers ?? {},
        });
      }
    }

    const byMarket = candidateTable.reduce<Record<string, { domains: number; candidates: number; priceOk: number }>>(
      (t, r) => {
        const k = String(r["🔴 Source Market"]);
        const b = (t[k] ??= { domains: 0, candidates: 0, priceOk: 0 });
        b.domains += 1;
        b.candidates += Number(r.후보);
        b.priceOk += Number(r["가격 획득"]);
        return t;
      },
      {},
    );

    const report = {
      "🔴🔴 DISCLAIMER":
        "조사 전용. **Gemini 호출 0 · 외부 HTTP 0.** Trace A 는 덤프 스냅샷에 운영 owner 를 " +
        "돌린 «순수 계산» 이고, Gemini 후보는 선행 WU 가 저장한 결과(acc011-1.json)를 재분류한 것이다. " +
        "🔴 후보 표본은 그 WU 의 sample 이고 운영 전수가 아니다.",
      "① Trace A — 원상품 Identity/Facts (운영 owner 산출)": {
        KIDS_FASHION: summarize("KIDS_FASHION"),
        TENNIS: summarize("TENNIS"),
        "🔴 Identity confidence 칸": "**없다.** ProductFacts 에 confidence 칸이 없고 " +
          "ProductIdentityDna 에는 brand.confident(boolean) 하나만 있다 — facts 로 옮겨지지 않는다.",
      },
      "② 저장된 Gemini 후보 — 🔴 시장별 분리 (§6)": {
        "시장별 합계": byMarket,
        "🔴 주의": "ComparisonCandidate 에 market/country 칸이 **없다** → 이 분류는 제품이 아니라 " +
          "**내가 TLD·등록부·통화로 사후 추정** 한 것이다. 운영이 내는 값이 아니다.",
        도메인별: candidateTable,
      },
      "③🔴 해석 한계": [
        "🔴 Trace A 는 **표본 전수가 아니라 덤프 표본** 이다(아동 + 테니스).",
        "🔴 ② 의 시장 분류는 제품 기능이 아니다 — 후보에 시장 칸이 없어 사후 추정했다.",
        "🔴 UNKNOWN 을 KR 로도 해외로도 세지 않았다.",
        "🔴 가격 획득 수는 선행 WU 실행 시점의 값이다 — 지금 다시 재지 않았다(HTTP 0).",
      ],
      identityRows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    let seq = 1;
    while (existsSync(path.join(OUT_DIR, `trace019r-${seq}.json`))) seq += 1;
    writeFileSync(path.join(OUT_DIR, `trace019r-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify({ ...report, identityRows: `(${identityRows.length}건 — trace019r-${seq}.json)` }, null, 1));

    expect(identityRows.length).toBeGreaterThan(0);
  }, 10 * 60 * 1000);
});
