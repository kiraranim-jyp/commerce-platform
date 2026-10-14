/**
 * ════════════════════════════════════════════════════════════════════════════
 * AI-DISCOVERY-STRATEGY-003 §2/§3 — **Identity 증거가 실제로 얼마나 «있는가»**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 의 핵심 질문은 「검색」이 아니라 **「정확한 동일상품 판정」** 이다.
 *    그래서 이 벤치마크는 provider 를 비교하지 않는다(키가 없어 측정 불가 · §1 참조).
 *    대신 **판정이 쓸 수 있는 증거가 양쪽에 얼마나 있는지** 를 센다.
 *
 * 🔴🔴 왜 이것이 결정적인가 — 선행 실측이 「후보 matchLevel 이 전건 low · high 0건」
 *    이라고 말했고, 그 이유가 **임계값이 아니라 축(axis) 부족** 이었다
 *    (brandModelCode 전건 null · SAME_MIN_AXES=5).
 *    → 그러면 「양쪽에 식별코드가 있는 비율」이 **Deterministic Identity 의 상한** 이다.
 *
 * 🔴 Gemini 0 · 외부 HTTP 0 · API 키 0 · 비용 ₩0. 입력은 **리포에 이미 있는 캡처 fixture**
 *    와 **덤프된 운영 스냅샷** 뿐이다.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd } from "@commerce/crawler";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 `__dirname` 은 `__tests__` 다 — 루트까지 **여덟 칸**(WU-020 에서 한 칸 모자라 0건이 났다). */
const CRAWLER_SRC = path.join(__dirname, "../../../../../../../../packages/crawler/src");
const FIXTURE_DIRS = [
  path.join(CRAWLER_SRC, "__tests__/fixtures"),
  path.join(CRAWLER_SRC, "site-strategies/__tests__/fixtures"),
];

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown }

const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

const CANONICAL_RE = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
const OG_URL_RE = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i;
const hostFromHtml = (html: string): string | null => {
  const raw = CANONICAL_RE.exec(html)?.[1] ?? OG_URL_RE.exec(html)?.[1] ?? null;
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** 🟢 식별코드 비교는 **정규화해서** 본다(대소문자·하이픈·공백). 새 규칙을 만들지 않는다. */
const normCode = (s: string | null | undefined): string | null => {
  const v = s?.replace(/[\s\-_.]/g, "").toUpperCase().trim();
  return v && v.length >= 4 ? v : null;
};

describe("🔴 WU-003 — Identity 증거 가용성 벤치마크 (Gemini 0 · HTTP 0)", () => {
  it("① 원상품 쪽: 식별코드를 몇 건이나 갖고 있는가", async () => {
    const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
    const snaps = read<SnapRow[]>("e2e-snapshots.json");
    const shared = (await import("@commerce/shared")) as unknown as {
      buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
      backfillCanonicalProduct: (p: unknown) => unknown;
    };

    const seen = new Set<string>();
    const all = [
      ...[...(groups.control ?? []), ...groups.kids, ...groups.kids2].map((r) => ({ r, scope: "KIDS" })),
      ...groups.tennis.map((r) => ({ r, scope: "TENNIS" })),
    ].filter(({ r }) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

    const rows = all.flatMap(({ r, scope }) => {
      const snap = snaps.find((s) => s.id === r.id);
      if (!snap) return [];
      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
      const ident = dna.identifier as { tier?: string; value?: string } | null;
      return [
        {
          scope,
          brand: r.brand || "(빈 브랜드)",
          title: r.title.slice(0, 34),
          brandModelCode: (dna.brandModelCode as string | null) ?? null,
          "identifier.tier": ident?.tier ?? null,
          "identifier.value": ident?.value ?? null,
          color: (dna.color as string | null) ?? null,
        },
      ];
    });

    const n = rows.length;
    const has = (k: string) => rows.filter((x) => x[k as keyof typeof x] != null).length;
    const report = {
      "🔴🔴 DISCLAIMER":
        "원상품 쪽 식별증거 가용성. 🔴 Gemini 0 · HTTP 0 — 덤프된 운영 스냅샷에 운영 owner" +
        "(buildProductIdentityDna)를 돌린 순수 계산이다. 🔴 sample 26건이고 전수가 아니다.",
      "①-a 합계": {
        상품: n,
        "brandModelCode 보유": `${has("brandModelCode")}/${n}`,
        "identifier 보유": `${has("identifier.value")}/${n}`,
        "color 보유": `${has("color")}/${n}`,
      },
      "①-b identifier tier 분포": rows.reduce<Record<string, number>>((t, r) => {
        const k = String(r["identifier.tier"] ?? "(없음)");
        t[k] = (t[k] ?? 0) + 1;
        return t;
      }, {}),
      "①-c 🔴 중요": [
        "🔴 `identifier.tier === 'SKU'` 는 **판매처 재고번호** 일 수 있다 — 다른 샵과 맞출 수 없다",
        "🟢 샵 간 비교에 쓸 수 있는 것은 **brandModelCode**(브랜드가 부여한 품번) 다",
        "   (product-identity-dna.ts:90 주석이 두 칸을 섞지 말라고 명시한다)",
      ],
      products: rows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "bench003-original.json"), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n[①원상품] " + JSON.stringify(report["①-a 합계"]) + " tier=" + JSON.stringify(report["①-b identifier tier 분포"]));
    expect(n).toBeGreaterThan(0);
  });

  it("② 후보 쪽: 캡처 HTML 의 JSON-LD 가 sku 를 주는가 — 🔴 지금 «버리고 있다»", () => {
    const rows: Record<string, unknown>[] = [];
    for (const dir of FIXTURE_DIRS) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(path.join(dir, file), "utf8");
        const d = extractFromJsonLd(html);
        rows.push({
          fixture: file,
          host: hostFromHtml(html) ?? "🔴 (읽지 못함)",
          "JSON-LD 있음": d != null,
          "🔴🔴 sku": d?.sku ?? null,
          "sku(정규화)": normCode(d?.sku),
          brand: d?.brand ?? null,
          "가격": d?.price ? `${d.price.currency} ${d.price.amount}` : null,
        });
      }
    }
    const n = rows.length;
    const withJsonLd = rows.filter((r) => r["JSON-LD 있음"]).length;
    const withSku = rows.filter((r) => r["sku(정규화)"] != null).length;

    const report = {
      "🔴🔴 DISCLAIMER":
        "리포에 **이미 있는** 캡처 fixture 전수. 🔴 추가 HTTP 0 · 실제 URL 재접속 0. " +
        "🔴 이 fixture 들은 다른 WU 가 다른 목적으로 캡처한 것이고 **Discovery 후보 표본이 아니다** — " +
        "비율을 「후보의 기대 sku 획득률」로 쓰지 않는다. 일부는 목록/검색 캡처거나 `-head.html` 이다.",
      "②-a 합계": {
        fixture: n,
        "JSON-LD 보유": `${withJsonLd}/${n}`,
        "🔴🔴 sku 보유": `${withSku}/${n}`,
      },
      "②-b 🔴🔴 핵심 — 🔴 **내 가설을 데이터가 정정했다**": [
        "`extractFromJsonLd`(product-data-extractor.ts:211)는 `sku` 를 **읽는다**.",
        "WU-020 이 후보 경로(product-url-facts.ts htmlPath)에서 그 함수를 **이미 부른다** —",
        "  그런데 `price` 만 꺼내 쓰고 **`sku` 는 버린다**.",
        "그리고 `productFactsFromListing`(seller-facts.ts:262)은 `sellerSku` 를 **인자로 받는데**(:270)",
        "  `htmlPath` 가 **넘기지 않는다** → 후보 `sellerSku = null`.",
        "🔴 그리고 `brandModelCode: null` 이 :269 에 **하드코딩** 돼 있다.",
        "",
        "🔴🔴 **그런데 실측값이 내 가설을 정정했다** — 잡힌 sku 의 «내용» 을 보면:",
        "   littleluna.co.kr → `cafe24_littlelunakr_1_4117_P0000GCJ000A`  = **Cafe24 내부 재고번호**",
        "   smallable.com    → `AAA1804532`                              = **Smallable 자체 코드**",
        "🔴 둘 다 **판매처 재고번호** 이고 **브랜드 품번이 아니다** → 다른 샵과 맞출 수 없다.",
        "🟢 그래서 `brandModelCode: null` 하드코딩은 **버그가 아니라 옳은 보수성** 이다",
        "   (product-identity-dna.ts:90 이 두 칸을 섞지 말라고 명시한다).",
        "",
        "🟢 **올바른 사용법은 반대 방향이다** — 후보 sku 를 품번으로 «승격» 하는 것이 아니라,",
        "   **원상품의 brandModelCode 를 후보의 sku/URL/title 안에서 «찾는» 것** 이다.",
        "   기존 `confirmBrandCodeInTitle`(match.ts)이 바로 그 함수이고 지금은 **title 만** 본다.",
        "   🟢 WU-023B 실측이 그 증거다 — trenbe URL 에 `b226ac010` 이 들어 있었고 SAME 이 났다.",
        "🔴 즉 빠진 배선은 「sku 를 품번으로 쓰기」가 아니라 **「품번을 찾을 범위를 넓히기」** 다.",
      ],
      fixtures: rows,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "bench003-candidate.json"), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n[②후보] " + JSON.stringify(report["②-a 합계"]));
    // eslint-disable-next-line no-console
    console.log(rows.filter((r) => r["🔴🔴 sku"] != null).map((r) => `  ${r.host} → sku=${r["🔴🔴 sku"]}`).join("\n"));
    expect(n).toBeGreaterThan(0);
  });
});
