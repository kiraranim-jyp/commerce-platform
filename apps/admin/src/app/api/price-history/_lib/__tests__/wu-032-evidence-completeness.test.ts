import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalizeProductUrl,
  compareCrossSellerProducts,
  extractFromJsonLd,
  factsFromProductUrl,
} from "@commerce/crawler";
/** 🔴 운영 `htmlPath` 가 쓰는 **바로 그 fetch** 다 — 다른 fetch 로 재면 헤더/리다이렉트가 달라진다. */
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import {
  backfillCanonicalProduct,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
  type ProductFacts,
} from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-032 — **Identity Evidence Completeness Audit** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **MI 를 고치는 하니스가 아니다.** CPO 판정(2026-10-16):
 * ```
 * 「지금은 MI 를 의심해서 뜯어고칠 단계가 아니라, MI 가 판단할 수 있는 «증거» 를
 *   후보 페이지에서 얼마나 안정적으로 확보할 수 있는지를 조사할 단계다.」
 * ```
 * 🔴 그래서 이 파일은 **운영 코드를 한 줄도 바꾸지 않고**, 「증거를 더 넣었다면
 *    어떻게 됐을까」를 **반사실(counterfactual)** 로만 잰다.
 *
 * ── 🔴🔴 반드시 «같이» 재는 것 (CPO 명시) ─────────────────────────────────
 * ```
 * 추가 정보 확보  →  MI SAME 증가  →  **False SAME 변화**
 * ```
 * 🔴 **False SAME 0 을 유지하는 방법만 구현 후보로 인정한다.** 그래서 GT SAME 24 만
 *    보지 않고 **GT DIFFERENT 27 을 전건 같이 통과시킨다** — 그쪽이 위험 축이다.
 *
 * ── 🔴 비용 ───────────────────────────────────────────────────────────────
 * AI **0** · 검색 API **0** · 키 **0** · 결제 **0**. HTTP 는 후보 페이지 GET 뿐이고
 * 🟢 **HTML 을 디스크에 캐시**해서 반복 측정은 **추가 HTTP 0** 이다.
 *
 * 🔴 기본 SKIP — `WU_032_AUDIT=1` 없이는 돌지 않는다.
 */

const LIVE = process.env.WU_032_AUDIT === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const CASES = path.join(OUT, "mi-017-e2e-cases.json");
const GT = path.join(OUT, "mi-022-gt.json");

/** 🔴 WU-031 과 **같은 표** 다 — 분모를 바꾸면 두 WU 를 비교할 수 없다. */
const ORIGINS: Record<string, { snapshotId: string; expectedOrigin: string }> = {
  S1: {
    snapshotId: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
  },
  S2: {
    snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113",
    expectedOrigin:
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
  },
  S3: {
    snapshotId: "c5395889-7651-4272-aff5-dbeddd8d6199",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses",
  },
  S4: {
    snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  },
  S5: {
    snapshotId: "32f7b651-29b9-4217-b8ce-46596f538306",
    expectedOrigin: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  },
  S6: {
    snapshotId: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
    expectedOrigin: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
  },
};

const key = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

/* ────────────────────────────────────────────────────────────────────────────
 * ① 증거 probe — 🔴 **이미 받은 HTML 안에서만** 읽는다
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * 🔴🔴 **이것은 「새 파서」가 아니라 「가용성 측정기」다.** 운영이 그 값을 쓰게
 *    만들지 않는다 — **거기에 값이 있는지** 만 센다.
 *
 * 🟢 그런데 대부분은 **이미 운영 추출기가 파싱해 놓고 버리는** 값이다:
 *    `extractFromJsonLd`(product-data-extractor.ts:175)가 `brand · sku · material ·
 *    jsonLdCategory · breadcrumbPath` 를 전부 돌려주는데,
 *    `product-url-facts.ts` 의 HTML 경로는 그중 **`price` 하나만** 꺼내 쓴다
 *    (`priceFromJsonLd`, WU-020 이 그 한 칸만 열었다).
 * 🔴 **`color` 만 예외다** — schema.org `Product.color` 는 표준인데 추출기가
 *    읽지 않는다. 그래서 그 칸만 여기서 직접 세어 **가용성** 을 확인한다.
 */
interface EvidenceProbe {
  /** JSON-LD Product 노드가 존재하는가. 없으면 아래 전부 null 이다. */
  hasJsonLdProduct: boolean;
  /** 🔴 현재 추출기가 **읽지 않는** 표준 칸. */
  jsonLdColor: string | null;
  /** 🟢 아래 넷은 추출기가 **이미 파싱해 놓고 버리는** 값이다. */
  jsonLdBrand: string | null;
  jsonLdSku: string | null;
  jsonLdMaterial: string | null;
  jsonLdCategory: string | null;
}

function findProductNodeRaw(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findProductNodeRaw(n);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const isProduct = Array.isArray(t) ? t.some((x) => String(x) === "Product") : String(t ?? "") === "Product";
  if (isProduct) return obj;
  for (const v of Object.values(obj)) {
    const found = findProductNodeRaw(v);
    if (found) return found;
  }
  return null;
}

const asText = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim());
    return typeof first === "string" ? first.trim() : null;
  }
  if (v && typeof v === "object") {
    const name = (v as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  return null;
};

function probeEvidence(html: string): EvidenceProbe {
  /** 🟢 운영 추출기를 **그대로** 부른다 — 넷은 복제 계산하지 않는다. */
  const owned = extractFromJsonLd(html);

  /** 🔴 `color` 만 직접 본다(추출기에 그 칸이 없다). 같은 script 태그 집합을 읽는다. */
  let jsonLdColor: string | null = null;
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const product = findProductNodeRaw(parsed);
    if (product) {
      jsonLdColor = asText(product.color);
      if (jsonLdColor) break;
    }
  }

  return {
    hasJsonLdProduct: owned !== null,
    jsonLdColor,
    jsonLdBrand: owned?.brand ?? null,
    jsonLdSku: owned?.sku ?? null,
    jsonLdMaterial: owned?.material ?? null,
    jsonLdCategory: owned?.jsonLdCategory ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * ② 반사실 — 축 하나씩 넣어 보고 **판정 변화** 를 운영 comparator 로 읽는다
 * ──────────────────────────────────────────────────────────────────────────*/

type Axis = "color" | "brand" | "modelCode" | "material" | "category";

/**
 * 🔴 **값을 지어내지 않는다.** 그 사이트가 **스스로 선언한** JSON-LD 값만 넣는다.
 * 🔴 `coreTitleTokens` 는 **건드리지 않는다** — baseline 과 같은 토큰을 유지해야
 *    delta 가 「그 축 하나」의 효과로 분리된다(토큰을 다시 깎으면 제목 축도 같이 움직인다).
 */
function enrich(facts: ProductFacts, probe: EvidenceProbe, axes: readonly Axis[]): ProductFacts {
  const next: ProductFacts = { ...facts };
  for (const axis of axes) {
    if (axis === "color" && !next.colorText && probe.jsonLdColor) next.colorText = probe.jsonLdColor;
    if (axis === "brand" && !next.brand && probe.jsonLdBrand) next.brand = probe.jsonLdBrand;
    /** 🔴 `sellerSku` 가 아니라 `brandModelCode` 에 넣는 것이 **위험한 축** 이다 —
     *    그래서 **따로** 잰다. 두 칸을 섞지 말라는 것이 ProductFacts 주석의 경고다. */
    if (axis === "modelCode" && !next.brandModelCode && probe.jsonLdSku) next.brandModelCode = probe.jsonLdSku;
    if (axis === "material" && !next.materialText && probe.jsonLdMaterial) next.materialText = probe.jsonLdMaterial;
    if (axis === "category" && !next.categoryText && probe.jsonLdCategory) next.categoryText = probe.jsonLdCategory;
  }
  return next;
}

interface Row {
  searchId: string;
  candidateUrl: string;
  gt: "SAME" | "DIFFERENT";
  fetchPath: string | null;
  baselineVerdict: string | null;
  probe: EvidenceProbe;
  /** 축 조합별 판정. 키는 "color" · "color+brand" … · "ALL". */
  verdicts: Record<string, string | null>;
  originFacts: Partial<ProductFacts>;
  candidateFacts: Partial<ProductFacts>;
}

const maybe = LIVE ? it : it.skip;

describe("WU-032 — 증거를 «안전하게» 더 확보할 수 있는가", () => {
  maybe(
    "후보 페이지가 이미 들고 있는 구조화 증거를 세고, 반사실로 ΔSAME · ΔFalseSAME 를 잰다",
    async () => {
      expect(existsSync(CASES) && existsSync(GT)).toBe(true);
      if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

      const cases = JSON.parse(readFileSync(CASES, "utf8")) as {
        id: string;
        source_url: string;
        canonical_product: unknown;
      }[];
      const gtRows = JSON.parse(readFileSync(GT, "utf8")) as {
        searchId: string;
        candidateUrl: string;
        gt: "SAME" | "DIFFERENT";
      }[];

      /** 🔴 축 조합 — 단일 축의 ROI 와 «전부 넣었을 때» 의 안전성을 같이 본다. */
      const COMBOS: Record<string, readonly Axis[]> = {
        color: ["color"],
        brand: ["brand"],
        modelCode: ["modelCode"],
        material: ["material"],
        category: ["category"],
        "color+brand": ["color", "brand"],
        SAFE_ALL: ["color", "brand", "material", "category"],
        ALL: ["color", "brand", "modelCode", "material", "category"],
      };

      const rows: Row[] = [];
      let httpCalls = 0;
      let cacheHits = 0;

      for (const gtRow of gtRows) {
        const origin = ORIGINS[gtRow.searchId];
        if (!origin) continue;
        const snapshot = cases.find((c) => c.id === origin.snapshotId);
        expect(snapshot, `스냅샷 ${origin.snapshotId} 없음`).toBeTruthy();
        /** 🔴 CONTROL — WU-031 과 **같은 게이트**. 원상품 매핑이 틀리면 전부 무효다. */
        expect(canonicalizeProductUrl(snapshot!.source_url)).toBe(canonicalizeProductUrl(origin.expectedOrigin));

        const product = backfillCanonicalProduct(snapshot!.canonical_product as never);
        const dna = buildProductIdentityDna(product);
        const originFacts = productFactsFromIdentityDna(dna);

        /* ── 후보 사실: 운영 함수 · 디스크 캐시 ───────────────────────────── */
        const factsFile = path.join(CACHE, `${key(gtRow.candidateUrl)}.facts.json`);
        let factsResult: Awaited<ReturnType<typeof factsFromProductUrl>> | null = null;
        if (existsSync(factsFile)) {
          factsResult = JSON.parse(readFileSync(factsFile, "utf8"));
          cacheHits++;
        } else {
          try {
            factsResult = await factsFromProductUrl(gtRow.candidateUrl);
            httpCalls += factsResult?.httpCalls ?? 0;
            writeFileSync(factsFile, JSON.stringify(factsResult));
          } catch {
            factsResult = null;
          }
        }

        /* ── 원문 HTML: 증거 probe 용 · 디스크 캐시 ────────────────────────
         * 🔴 **정직하게 적는다** — 운영 `htmlPath` 는 이 HTML 을 **이미 손에 쥐고
         *    있다**(fetchPlainHtml 로 받아서 가격만 읽는다). 그런데 그 함수가 HTML 을
         *    돌려주지 않아 **하니스가 자기 사본을 따로 받는다.** 즉 이 추가 GET 은
         *    **측정 비용** 이고, 실제 구현의 비용이 아니다(구현은 추가 HTTP 0 이다). */
        const htmlFile = path.join(CACHE, `${key(gtRow.candidateUrl)}.html`);
        let html: string | null = null;
        if (existsSync(htmlFile)) {
          html = readFileSync(htmlFile, "utf8");
          cacheHits++;
        } else {
          const target = factsResult?.crawlerUrl ?? gtRow.candidateUrl;
          try {
            html = await fetchPlainHtml(target);
          } catch {
            html = null;
          }
          httpCalls++;
          writeFileSync(htmlFile, html ?? "");
        }

        const probe: EvidenceProbe = html
          ? probeEvidence(html)
          : {
              hasJsonLdProduct: false,
              jsonLdColor: null,
              jsonLdBrand: null,
              jsonLdSku: null,
              jsonLdMaterial: null,
              jsonLdCategory: null,
            };

        const candidateFacts = factsResult?.candidate?.facts ?? null;
        const verdicts: Record<string, string | null> = {};
        let baselineVerdict: string | null = null;

        if (candidateFacts) {
          /** 🟢 **운영 comparator 를 그대로 부른다** — 판정을 복제하지 않는다. */
          baselineVerdict = compareCrossSellerProducts(originFacts, candidateFacts)?.verdict ?? null;
          for (const [name, axes] of Object.entries(COMBOS)) {
            verdicts[name] =
              compareCrossSellerProducts(originFacts, enrich(candidateFacts, probe, axes))?.verdict ?? null;
          }

          /* ── 🔴🔴 상한/천장 실험 — JSON-LD 가용성에 **갇히지 않고** 재는 두 축 ──
           *
           * 위 COMBOS 는 「지금 구조화 데이터에 있는 것」만 넣는다. 그런데 그것이
           * 거의 비어 있으면(실측 color 1/51) **「색상 추출을 고치면 얼마나 벌 수
           * 있는가」에 답하지 못한다.** 그래서 두 가지를 더 잰다:
           *
           *   ORACLE_*      추출기가 **완벽했다면** — GT SAME 후보에 원상품 값을 넣는다.
           *                 🔴 GT DIFFERENT 는 **건드리지 않는다**(완벽한 추출기라면
           *                    그쪽엔 «그 상품의 진짜 값» 이 들어가지 우리 원상품 값이
           *                    들어가지 않는다). → **Recall 상한**
           *   ADVERSARIAL_* 추출기가 **틀렸다면** — GT DIFFERENT 에도 원상품 값이
           *                 잘못 들어간 경우. → **False SAME 천장**
           *
           * 🔴 둘 다 «실제로 구현 가능한가» 와 무관한 **경계값** 이다. 이 숫자를
           *    「개선 효과」로 적지 않는다 — 상한과 천장이다.
           */
          const oracle = (axes: readonly Axis[], applyToDifferent: boolean): ProductFacts => {
            const next: ProductFacts = { ...candidateFacts };
            if (gtRow.gt === "DIFFERENT" && !applyToDifferent) return next;
            for (const axis of axes) {
              if (axis === "color" && !next.colorText && originFacts.colorText) next.colorText = originFacts.colorText;
              if (axis === "brand" && !next.brand && originFacts.brand) next.brand = originFacts.brand;
              if (axis === "modelCode" && !next.brandModelCode && originFacts.brandModelCode)
                next.brandModelCode = originFacts.brandModelCode;
            }
            return next;
          };
          const ORACLE_AXES: Record<string, readonly Axis[]> = {
            color: ["color"],
            brand: ["brand"],
            "color+brand": ["color", "brand"],
            "color+brand+modelCode": ["color", "brand", "modelCode"],
          };
          for (const [name, axes] of Object.entries(ORACLE_AXES)) {
            verdicts[`ORACLE_${name}`] =
              compareCrossSellerProducts(originFacts, oracle(axes, false))?.verdict ?? null;
            verdicts[`ADVERSARIAL_${name}`] =
              compareCrossSellerProducts(originFacts, oracle(axes, true))?.verdict ?? null;
          }

          /* ── 🔴🔴 P1 — **원상품** 쪽 브랜드 공백 (CPO: 「후보 문제가 아니라
           *    원상품 정보 문제다. 별도로 측정해야 한다」)
           *
           * S6 는 `originFacts.brand === null` 이라 **모든 후보에서 브랜드 축이
           * 영구히 죽는다**(4/4 MISS). 위 oracle 은 **후보 쪽** 만 채우므로 이 경우를
           * 전혀 건드리지 못한다 — 그래서 축을 따로 세운다.
           * 🟢 값은 지어내지 않는다 — **원상품 URL 의 호스트가 곧 브랜드 공식몰**
           *    (`bobochoses.co.jp`)인 경우에만, 그 사실에서 읽히는 이름을 넣는다.
           * 🔴 이것이 「도메인→브랜드 표」인지 「다른 안전한 경로」인지는 **CPO 결정**
           *    이고(§12-0 Registry 긴장), 여기서는 **가치만** 잰다.
           */
          const ORIGIN_BRAND_BY_HOST: Record<string, string> = { "bobochoses.co.jp": "Bobo Choses" };
          const originHost = (() => {
            try {
              return new URL(dna.sourceUrl).hostname.replace(/^www\./, "");
            } catch {
              return "";
            }
          })();
          const recoveredOriginBrand = originFacts.brand || ORIGIN_BRAND_BY_HOST[originHost] || null;
          const originFixed: ProductFacts = { ...originFacts, brand: recoveredOriginBrand };
          verdicts.ORIGIN_BRAND = compareCrossSellerProducts(originFixed, candidateFacts)?.verdict ?? null;
          verdicts["ORIGIN_BRAND+ORACLE_brand"] =
            compareCrossSellerProducts(originFixed, oracle(["brand"], false))?.verdict ?? null;
          verdicts["ORIGIN_BRAND+ADVERSARIAL_brand"] =
            compareCrossSellerProducts(originFixed, oracle(["brand"], true))?.verdict ?? null;
        }

        rows.push({
          searchId: gtRow.searchId,
          candidateUrl: gtRow.candidateUrl,
          gt: gtRow.gt,
          fetchPath: factsResult?.fetchPath ?? null,
          baselineVerdict,
          probe,
          verdicts,
          originFacts: {
            brand: originFacts.brand,
            brandModelCode: originFacts.brandModelCode,
            colorText: originFacts.colorText,
            categoryText: originFacts.categoryText,
            materialText: originFacts.materialText,
          },
          candidateFacts: candidateFacts
            ? {
                brand: candidateFacts.brand,
                brandModelCode: candidateFacts.brandModelCode,
                colorText: candidateFacts.colorText,
                categoryText: candidateFacts.categoryText,
                materialText: candidateFacts.materialText,
              }
            : {},
        });
      }

      /* ── 집계 ──────────────────────────────────────────────────────────── */
      const measurable = rows.filter((r) => r.baselineVerdict !== null);
      const gtSame = measurable.filter((r) => r.gt === "SAME");
      const gtDiff = measurable.filter((r) => r.gt === "DIFFERENT");

      const same = (v: string | null) => v === "SAME";
      const baseSame = gtSame.filter((r) => same(r.baselineVerdict)).length;
      const baseFalseSame = gtDiff.filter((r) => same(r.baselineVerdict)).length;

      const deltas: Record<string, unknown> = {};
      const comboNames = [...Object.keys(COMBOS), ...Object.keys(measurable[0]?.verdicts ?? {})].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      for (const name of comboNames) {
        const linked = gtSame.filter((r) => same(r.verdicts[name])).length;
        const falseSame = gtDiff.filter((r) => same(r.verdicts[name])).length;
        deltas[name] = {
          same: linked,
          dSame: linked - baseSame,
          falseSame,
          /** 🔴🔴 이 칸이 0 이 아니면 **구현 후보에서 탈락** 이다(CPO). */
          dFalseSame: falseSame - baseFalseSame,
        };
      }

      /** 🟢 증거 가용성 — 「없어서 못 넣는다」와 「넣어도 안 바뀐다」를 가른다. */
      const availability = {
        hasJsonLdProduct: rows.filter((r) => r.probe.hasJsonLdProduct).length,
        color: rows.filter((r) => r.probe.jsonLdColor).length,
        brand: rows.filter((r) => r.probe.jsonLdBrand).length,
        sku: rows.filter((r) => r.probe.jsonLdSku).length,
        material: rows.filter((r) => r.probe.jsonLdMaterial).length,
        category: rows.filter((r) => r.probe.jsonLdCategory).length,
      };
      /** 🔴 **결손이 실제로 메워지는 건수** — 가용성과 다르다(이미 있는 칸은 안 센다). */
      const fillable = {
        color: rows.filter((r) => !r.candidateFacts.colorText && r.probe.jsonLdColor).length,
        brand: rows.filter((r) => !r.candidateFacts.brand && r.probe.jsonLdBrand).length,
        modelCode: rows.filter((r) => !r.candidateFacts.brandModelCode && r.probe.jsonLdSku).length,
        material: rows.filter((r) => !r.candidateFacts.materialText && r.probe.jsonLdMaterial).length,
        category: rows.filter((r) => !r.candidateFacts.categoryText && r.probe.jsonLdCategory).length,
      };

      const fetchPaths: Record<string, number> = {};
      for (const r of rows) fetchPaths[r.fetchPath ?? "NONE"] = (fetchPaths[r.fetchPath ?? "NONE"] ?? 0) + 1;

      const summary = {
        httpCalls,
        cacheHits,
        candidates: rows.length,
        measurable: measurable.length,
        gtSame: gtSame.length,
        gtDifferent: gtDiff.length,
        baseline: { same: baseSame, falseSame: baseFalseSame },
        fetchPaths,
        availability,
        fillable,
        deltas,
      };

      writeFileSync(path.join(OUT, "wu-032-evidence.json"), JSON.stringify({ summary, rows }, null, 2));
      // eslint-disable-next-line no-console
      console.log("[WU-032]", JSON.stringify(summary));

      /** 🔴 CONTROL — baseline 이 WU-031 과 같아야 두 WU 를 비교할 수 있다. */
      expect(measurable.length).toBe(51);
      expect(baseSame).toBe(10);
      expect(baseFalseSame).toBe(0);
    },
    30 * 60_000,
  );
});
