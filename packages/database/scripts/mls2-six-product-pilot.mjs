/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLS2 — **CEO GT 6상품 독립 검증**(read-only · 운영 함수 직접 호출)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO §4: 「**어느 단계가 실제 병목인지** 알 수 있게 분리해서 본다」 —
 *    원본 접근 / 추출 / 국내 검색 / 해외 검색 / Evidence / 가격 집계.
 *    ⟹ 이 스크립트는 **단계마다 결과를 따로** 적는다.
 *
 * 🔴 **한 상품의 실패가 다음 상품을 막지 않는다**(try/catch 로 상품 단위 격리).
 * 🔴 **429 우회 금지** — 재시도 루프 0 · UA 변조 0. 상태코드를 **적고 넘어간다**.
 * 🔴 **429/추출 실패를 「후보 0」으로 적지 않는다** — `측정불가` 로 남긴다.
 * 🔴 새 하니스/분류 재구현 0 — 기존 운영 함수와 `seller-probability` 를 **그대로** 쓴다.
 * 🔴 DB 쓰기 0.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **이 스크립트의 「추출 성공」을 제품 성공으로 읽지 않는다**(2026-11-06 실측)
 * ════════════════════════════════════════════════════════════════════════════
 * ```
 * 1회차  6상품 전건 `extract` **null**           (429)
 * 2회차  6상품 전건 **truthy · HTTP 200**  —  🔴 그런데 **brand 가 6/6 빈값** 이고
 *        설명문 품번도 6/6 null · 한글 질의 6/6 **0**(alias 조회가 빈 brand 로 돌았다)
 * 3회차  다시 **null**                           (429 재발)
 * ⟹ 🔴 **「truthy 면 성공」은 약한 게이트다.** WU-134 가 기록한 그 함정이고
 *      (칸을 손으로 옮기다 brand 를 빠뜨린 그 사고) 이번에도 **가르지 못했다** —
 *      ⒜ 내가 `extracted.brand` 칸 이름을 틀렸는가  ⒝ 추출이 열화됐는가.
 *      3회차가 429 라 **키 전수를 찍어 보지 못했다**.
 * 🔴 그래서 2회차의 「6/6 성공」을 **성공으로 보고하지 않는다**(측정 보류).
 * 🟢 다음 세션이 **가장 먼저** 할 일: 429 가 풀린 창에서 `extract` 반환 **키 전수** 를
 *    찍어 ⒜⒝를 가른다. 🔴 그 전에 이 표의 brand 칸을 제품 사실로 쓰지 않는다.
 * ```
 */
import { PrismaClient } from "@prisma/client";
import { shopifySiteStrategy } from "../../crawler/src/site-strategies/shopify.site-strategy.ts";
import {
  buildProductIdentityDna,
  buildDomesticShopQuery,
  buildCrossSellerSearchQueries,
} from "../../shared/src/product-identity-dna.ts";
import { buildKoreanDiscoveryQueries } from "../../shared/src/korean-discovery-query.ts";
import { lookupBrandAlias } from "../../crawler/src/comparison-search/brand-alias.ts";
import { extractProductCode } from "../../crawler/src/description-facts.ts";

/** 🔴 CPO 가 고정한 순서(GT 수 기준). 이 순서를 바꾸지 않는다. */
const ORDER = ["b226ac033", "b226ac110", "b226ac036", "b226ac170", "b226ac073", "b226ac009"];

const p = new PrismaClient();
const stamp = new Date().toISOString();

console.log("══════════════════════════════════════════════════════════════════");
console.log("  MLS2 — CEO GT 6상품 독립 검증 (단계 분리)");
console.log(`  실행 시각 ${stamp}`);
console.log("══════════════════════════════════════════════════════════════════\n");

const rows = [];

for (const code of ORDER) {
  const rec = {
    code: code.toUpperCase(),
    url: null,
    http: null,
    extract: "측정불가",
    brand: null,
    modelCode: null,
    codeFromDescription: null,
    domesticQuery: null,
    englishQueries: 0,
    koreanQueries: 0,
    koreanRejected: [],
    gt: null,
    note: null,
  };

  try {
    const snap = await p.$queryRawUnsafe(
      `select source_url from product_snapshots where source_url ilike $1 order by created_at desc limit 1`,
      `%${code}%`,
    );
    rec.url = snap[0]?.source_url ?? null;
    const g = await p.$queryRawUnsafe(
      `select human_verdict v, count(*)::int n from candidate_reviews
        where human_verdict is not null and lower(origin_code)=$1 group by 1 order by 2 desc`,
      code,
    );
    rec.gt = g.map((x) => `${x.v} ${x.n}`).join(" · ") || "없음";

    if (!rec.url) {
      rec.note = "스냅샷 없음";
      rows.push(rec);
      continue;
    }

    /** ① 원본 접근 — 🔴 **한 번만** 부른다(레이트리밋 악화 금지). */
    const res = await fetch(rec.url, { redirect: "follow" }).catch((e) => ({ ok: false, status: 0, err: e }));
    rec.http = res.status ?? 0;

    /** ② 운영 추출기 — 🔴 복제식이 아니라 **운영 전략 그대로**. */
    const extracted = await shopifySiteStrategy.extract(rec.url).catch(() => null);
    if (!extracted) {
      rec.extract = rec.http === 429 ? "측정불가(429)" : `측정불가(http ${rec.http})`;
      rec.note = "🔴 원상품 추출 실패 — 후보 0 으로 세지 않는다";
      rows.push(rec);
      continue;
    }
    rec.extract = "성공";

    /**
     * ③ DNA · 질의 — 🔴 **저장된 canonicalProduct 를 쓰지 않는다**(CPO: 과거 스냅샷을
     *    성공 근거로 재사용 금지). 🟢 방금 추출한 값으로 만든 최소 CanonicalProduct 다.
     */
    const cp = {
      sourceUrl: rec.url,
      title: { value: extracted.title ?? "", source: "ORIGINAL", confidence: 0.9 },
      brand: { value: extracted.brand ?? "", source: "ORIGINAL", confidence: 0.9 },
      description: { value: extracted.description ?? "", source: "ORIGINAL", confidence: 0.9 },
      color: { value: extracted.color ?? "", source: "ORIGINAL", confidence: 0.7 },
      material: { value: "", source: "ORIGINAL", confidence: 0 },
      recommendedAge: { value: "", source: "REQUIRED", confidence: 0 },
      sku: { value: extracted.sku ?? "", source: "ORIGINAL", confidence: 0.5 },
      modelName: { value: "", source: "REQUIRED", confidence: 0 },
      titleKo: { value: "", source: "ORIGINAL", confidence: 0 },
      images: [],
      optionGroups: [],
      variants: [],
      price: { value: { amount: 0, currency: "EUR" }, source: "ORIGINAL", confidence: 0 },
      priceValidity: "VALID",
    };
    const dna = buildProductIdentityDna(cp);
    rec.brand = dna.brand.value || null;
    rec.modelCode = dna.brandModelCode;
    rec.codeFromDescription = extractProductCode(extracted.description ?? "") ?? null;
    rec.domesticQuery = buildDomesticShopQuery(dna);
    rec.englishQueries = buildCrossSellerSearchQueries(dna).length;
    const ko = buildKoreanDiscoveryQueries({
      brandAlias: lookupBrandAlias(dna.brand.value || undefined),
      brandModelCode: dna.brandModelCode,
      koreanTitle: dna.koreanTitle,
    });
    rec.koreanQueries = ko.queries.length;
    rec.koreanRejected = ko.rejected;
  } catch (e) {
    rec.note = `🔴 예외 ${String(e.message).slice(0, 70)}`;
  }
  rows.push(rec);
}

/* ── CPO §3 통합표 ──────────────────────────────────────────────────────── */
console.log("── 상품별 결과(단계 분리) ──\n");
const pad = (s, n) => String(s ?? "-").padEnd(n);
console.log(
  `${pad("원상품", 11)} ${pad("HTTP", 5)} ${pad("추출", 16)} ${pad("브랜드", 13)} ` +
    `${pad("품번", 11)} ${pad("설명문품번", 11)} ${pad("국내질의", 16)} ${pad("영문", 5)} ${pad("한글", 5)} CEO GT`,
);
for (const r of rows)
  console.log(
    `${pad(r.code, 11)} ${pad(r.http, 5)} ${pad(r.extract, 16)} ${pad((r.brand ?? "-").slice(0, 12), 13)} ` +
      `${pad(r.modelCode, 11)} ${pad(r.codeFromDescription, 11)} ${pad((r.domesticQuery ?? "-").slice(0, 15), 16)} ` +
      `${pad(r.englishQueries, 5)} ${pad(r.koreanQueries, 5)} ${r.gt}`,
  );

const ok = rows.filter((r) => r.extract === "성공");
const blocked = rows.filter((r) => r.extract.startsWith("측정불가"));
console.log(`\n🟢 추출 성공 ${ok.length} / 6   🔴 측정불가 ${blocked.length} / 6`);
if (blocked.length > 0) {
  console.log("🔴 측정불가 상품(사유와 마지막 확인 시각 · 「후보 0」이 아니다):");
  for (const r of blocked) console.log(`    ${r.code}  ${r.extract}  ${stamp}`);
}
if (ok.length > 0) {
  console.log("\n🟢 파일럿 후보(추출 성공 · GT 보유):");
  for (const r of ok) console.log(`    ${r.code}  품번 ${r.modelCode}  국내질의 ${JSON.stringify(r.domesticQuery)}  GT ${r.gt}`);
}
for (const r of rows) if (r.note) console.log(`\n${r.code}: ${r.note}`);

console.log("\n🔴 읽기만 했다 — DB 쓰기 0 · 재시도 루프 0 · UA 변조 0 · 상품당 요청 최소.");
await p.$disconnect();
