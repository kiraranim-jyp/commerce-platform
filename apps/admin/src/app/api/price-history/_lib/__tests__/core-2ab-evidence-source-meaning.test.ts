import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AB — **Evidence Source × Evidence Meaning Audit** (READ-ONLY)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 분류 체계를 정정했다**(2026-10-25) — 이 문장이 이 WU 의 전제다:
 * ```
 * 「중요한 것은 **어디에서 발견했느냐** 가 아니라 **그 정보가 무엇을 증명하느냐** 다.
 *   DESCRIPTION 이라는 source 라는 이유만으로 약한 증거로 취급하지 않는다.」
 * ```
 * ⟹ 그래서 **A/B/C(식별·유형·상세) 축을 버리고 2층** 으로 본다:
 * ```
 * Layer 1  Evidence Source   S1 title · S2 brand · S3 sku · S4 category · S5 description
 *                            S6 detail · S7 spec · S8 option · S9 JSON-LD · S10 image
 * Layer 2  Evidence Meaning  I1 BRAND · I2 TITLE · I3 MODEL_CODE · I4 TYPE · I5 COLOR
 *                            I6 MATERIAL · I7 PATTERN · I8 FIT · I9 AUDIENCE · I10 SIZE
 * ```
 *
 * 🔴 **§1 READ-ONLY** — 운영 코드 변경 **0**. threshold · 8축 · `SAME_MIN_AXES` ·
 *    `crossSellerReserved` · `NO_TITLE_OVERLAP` · CONFLICT 완화 **전부 0**.
 * 🔴 반사실에서도 **`SAME_MIN_AXES = 5` 를 그대로 둔다** — 바꾸는 것은 **입력 칸** 뿐이다.
 *
 * ── 🔴🔴🔴 착수 전 소스 조사로 이미 확정된 구조적 사실(측정이 아니라 «코드» 다) ──
 * ```
 * PLAIN_HTML 후보의 facts owner = `productFactsFromListing({title, url, brand})`
 *   (product-url-facts.ts:420 · seller-facts.ts:262)
 * 🔴 그 함수가 **일곱 칸을 하드코딩 null/[]** 로 만든다:
 *      brandModelCode: null · categoryText: null · materialText: null · fitText: null
 *      ageRangeText: null · sizeLabels: [] · audienceSignals: []
 * 🔴 그리고 **본문(description/body)을 인자로 받지 않는다** — HTML 은 fetch 됐지만
 *    brand/price/marketEvidence 를 뽑고 **버려진다**(그 함수 scope 에 안 들어간다).
 * 🟢 반면 SHOPIFY_JSON 경로는 `productFactsFromShopifyProduct(body)` 가
 *    `body_html → plainText → description` 으로 color/material 을 **채운다**.
 * ⟹ 🔴 같은 MI 가 **경로에 따라 다른 수의 축을 본다**(비대칭).
 * ```
 * 🔴 이 사실을 「측정했다」로 적지 않는다 — **소스 확정** 이다. 아래 §4 가 그것이
 *    실제 데이터에서 어떻게 나타나는지 **숫자로** 확인한다.
 */

const LIVE = process.env.CORE2AB_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/core-2m-ceo-visual-gt.json"), "utf8"),
) as { candidates: Array<{ domain: string; url: string; calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN" }> };

/* ══════════════════════ Layer 2 — Evidence Meaning 탐지기 ══════════════════════ */

/**
 * 🔴 **원문에 «있는지» 만 본다.** 값을 지어내지 않고, 없으면 `null` 이다.
 * 🔴 이것은 **운영 추출기가 아니다** — 「그 의미가 페이지에 존재하는가」를 재는 계측기다.
 *    그래서 운영 규칙(화이트리스트·site adapter)을 흉내내지 않고 **원상품의 사실** 로 찾는다.
 */
type Meaning = "I1_BRAND" | "I2_TITLE" | "I3_MODEL_CODE" | "I4_TYPE" | "I6_MATERIAL" | "I9_AUDIENCE";

const BRAND_FORMS = ["bobo choses", "bobochoses", "보보쇼즈", "보보 쇼즈"];
const TITLE_TOKENS = ["hug", "hairy", "monster", "허그", "헤어리", "몬스터"];
const TYPE_FORMS = ["t-shirt", "tshirt", "t shirt", "티셔츠", "반팔티", "tee"];
const MATERIAL_FORMS = ["cotton", "코튼", "면 ", "100% 면", "organic cotton", "오가닉"];
const AUDIENCE_FORMS = ["kids", "kid", "children", "키즈", "아동", "유아", "baby", "베이비"];

/** 🔴 품번은 **표기 변형** 을 같이 본다(CPO §8-3) — `#226AC009` · `Style …` · `SKU …`. */
function findModelCode(text: string): string | null {
  const t = text.replace(/\s+/g, " ");
  const direct = t.match(/B\s?2\s?2\s?6\s?A\s?C\s?0\s?0\s?9/i);
  if (direct) return direct[0];
  const hashed = t.match(/#\s?226\s?AC\s?009/i);
  if (hashed) return hashed[0];
  const labelled = t.match(/(?:style|sku|품번|모델명|상품코드)\s*[:#]?\s*(B?226AC009)/i);
  if (labelled) return labelled[0];
  return null;
}

function detectMeanings(text: string): Record<Meaning, string | null> {
  const low = text.toLowerCase();
  const hit = (forms: string[]) => forms.find((f) => low.includes(f)) ?? null;
  const titleHits = TITLE_TOKENS.filter((t) => low.includes(t));
  return {
    I1_BRAND: hit(BRAND_FORMS),
    /** 🔴 토큰 **둘 이상** 겹칠 때만 TITLE 증거로 센다(한 단어는 흔하다). */
    I2_TITLE: titleHits.length >= 2 ? titleHits.join("+") : null,
    I3_MODEL_CODE: findModelCode(text),
    I4_TYPE: hit(TYPE_FORMS),
    I6_MATERIAL: hit(MATERIAL_FORMS),
    I9_AUDIENCE: hit(AUDIENCE_FORMS),
  };
}

/** 🟢 HTML 에서 **본문 텍스트** 만 남긴다(태그·script·style 제거 · 새 파서 아님). */
function bodyText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/** 🔴 **구조화 블록만** 떼어 본다 — 같은 사실의 중복 출처(§10)를 가르기 위해서다. */
function jsonLdText(html: string): string {
  const out: string[] = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join(" ").replace(/\s+/g, " ");
}

/** 🟢 ProductFacts 가 그 의미를 **이미 들고 있는가**(= MI 가 본다). */
function factsHas(f: ProductFacts, m: Meaning): string | null {
  switch (m) {
    case "I1_BRAND":
      return f.brand;
    case "I2_TITLE":
      return f.coreTitleTokens.length > 0 ? f.coreTitleTokens.join("+") : null;
    case "I3_MODEL_CODE":
      return f.brandModelCode;
    case "I4_TYPE":
      return f.categoryText;
    case "I6_MATERIAL":
      return f.materialText;
    case "I9_AUDIENCE":
      return f.audienceSignals.length > 0 ? f.audienceSignals.join("+") : null;
  }
}

const MEANINGS: Meaning[] = ["I1_BRAND", "I2_TITLE", "I3_MODEL_CODE", "I4_TYPE", "I6_MATERIAL", "I9_AUDIENCE"];

/* ══════════════════════════════ 소스 계약(네트워크 0) ══════════════════════════════ */

const SELLER_FACTS_SRC = readFileSync(
  path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/seller-facts.ts"),
  "utf8",
);

describe("CORE-2AB 소스 계약 — PLAIN_HTML 후보의 «빈 칸» 을 고정한다(네트워크 0)", () => {
  it("AB-S1 🔴 `productFactsFromListing` 의 빈 칸은 **다섯** 이다(CORE-2AC 가 둘을 닫았다)", () => {
    /**
     * 🔴🔴 **이 계약은 CORE-2AC 가 FAIL 로 뒤집었고 그것이 수정의 증거다.**
     *    원래 「일곱 칸이 하드코딩 null/[]」이었고 그것이 CORE-2AB 조사의 전제였다.
     * 🟢 CORE-2AC 가 `categoryText` · `audienceSignals` 를 **분류 하나에서** 채웠다
     *    (Shopify `type`/`tags` 와 같은 자리 · 추가 HTTP 0).
     * 🔴 그래서 앵커를 **갱신하고 강화** 한다 — 남은 **다섯** 을 그대로 잠그고,
     *    닫힌 둘은 **「분류에서 온다」는 모양까지** 단언한다(아무 값이나 들어오면 FAIL).
     */
    const src = SELLER_FACTS_SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    const start = src.indexOf("export function productFactsFromListing");
    expect(start, "🔴 PLAIN_HTML facts owner 가 없다").toBeGreaterThan(-1);
    const seg = src.slice(start, src.indexOf("\n}", start));
    /** 🔴 남은 다섯 — 열 때마다 이 목록이 줄어야 하고 **조용히** 줄면 안 된다. */
    for (const [field, literal] of [
      ["brandModelCode", "null"],
      ["materialText", "null"],
      ["fitText", "null"],
      ["ageRangeText", "null"],
      ["sizeLabels", "[]"],
    ] as const) {
      expect(seg, `🔴 ${field} 가 더는 하드코딩 ${literal} 이 아니다 — 측정을 다시 한다`).toContain(
        `${field}: ${literal}`,
      );
    }
    /** 🟢 닫힌 둘 — **분류 하나** 에서만 온다(새 출처가 조용히 들어오면 FAIL). */
    expect(seg).toContain("categoryText: category");
    expect(seg).toContain("audienceSignals: category ? [category] : []");
  });

  it("AB-S2 🔴🔴 그 함수는 **본문(description/body)을 인자로 받지 않는다**", () => {
    const src = SELLER_FACTS_SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    const start = src.indexOf("export function productFactsFromListing");
    const seg = src.slice(start, src.indexOf("\n}", start));
    for (const no of ["description", "body", "bodyHtml", "html"]) {
      expect(seg, `🔴 ${no} 를 읽기 시작했다 — 비대칭이 해소됐는지 다시 측정한다`).not.toContain(no);
    }
  });

  it("AB-S3 🟢 반면 Shopify 경로는 **본문을 읽는다**(비대칭의 반대쪽)", () => {
    const src = SELLER_FACTS_SRC;
    const start = src.indexOf("export function productFactsFromShopifyProduct");
    expect(start).toBeGreaterThan(-1);
    const seg = src.slice(start, src.indexOf("\n}", start));
    expect(seg, "🔴 Shopify 쪽도 본문을 안 읽으면 비대칭이 아니라 «전면 공백» 이다").toMatch(
      /plainText\(\s*input\.description\s*\?\?\s*input\.body\s*\)/,
    );
  });
});

/* ══════════════════════════════════ 라이브 감사 ══════════════════════════════════ */

describe.runIf(LIVE)("CORE-2AB 라이브 — Evidence Source × Meaning 전수(READ-ONLY)", () => {
  it(
    "GT 10건 · 원문 ↔ ProductFacts ↔ MI 입력 · E0~E3 분류 · 반사실",
    async () => {
      /* ── 원상품 facts(운영 경로) ── */
      const originFetch = await factsFromProductUrl(ORIGIN);
      if (originFetch.status !== "OK" || !originFetch.candidate?.facts) {
        throw new Error(`🔴 원상품 측정불가(${originFetch.status}) — 분모가 깨지면 측정하지 않는다`);
      }
      /**
       * 🔴 **호출 규약을 추측하지 않는다** — CORE-2Z 가 쓴 운영 경로를 그대로 복제한다
       *    (1차에 `buildCanonicalProduct({…})` 로 객체를 넘겨 `items.map` 에서 터졌다 ·
       *     실제 서명은 `(url, extracted, sources, items)` 네 인자다).
       * 🟢 brand 복구(WU-134 `siteBrandName`)까지 같이 태운다 — 안 하면 원상품 brand 가
       *    `"AW26"`(시즌코드)로 거부돼 **모든 후보가 BRAND_UNCONFIRMED** 가 되고 측정이 열화된다.
       */
      const ex = await shopifySiteStrategy.extract(ORIGIN);
      expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
      let dna = buildProductIdentityDna(
        buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
      );
      if (!dna.brand.value) {
        const h = await fetchPlainHtml(ORIGIN);
        const site = h ? extractSiteBrandName(h) : null;
        if (site?.value) {
          dna = buildProductIdentityDna(
            buildCanonicalProduct(
              ORIGIN,
              { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
              {} as Record<string, ProductDataSource>,
              [],
            ),
          );
        }
      }
      expect(dna.brand.value, "🔴 원상품 brand 가 비면 측정이 열화된다(측정 거부)").toBeTruthy();
      const originFacts = productFactsFromIdentityDna(dna);

      console.log("\n═══ 원상품 ProductFacts(운영) ═══");
      for (const m of MEANINGS) {
        console.log(`    ${m.padEnd(16)}${factsHas(originFacts, m) ?? "🔴 null"}`);
      }

      /* ── 후보 전수 ── */
      interface Row {
        domain: string;
        ceo: string;
        fetchPath: string;
        facts: ProductFacts;
        inFacts: Record<Meaning, string | null>;
        inBody: Record<Meaning, string | null>;
        inJsonLd: Record<Meaning, string | null>;
        bodyLen: number;
      }
      const rows: Row[] = [];
      for (const g of GT.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    🔴 ${g.domain} 측정불가(${r.status})`);
          continue;
        }
        /** 🔴 **추가 HTTP 1회** — 운영이 버린 본문을 「있었는가」로 확인하려면 다시 받아야 한다.
         *  🟢 READ-ONLY 조사이고 운영 경로는 건드리지 않는다. */
        const html = (await fetchPlainHtml(g.url)) ?? "";
        const body = bodyText(html);
        rows.push({
          domain: g.domain,
          ceo: g.calibrationLabel,
          fetchPath: r.fetchPath,
          facts: r.candidate.facts,
          inFacts: detectMeanings(
            [
              r.candidate.facts.brand ?? "",
              r.candidate.facts.title,
              r.candidate.facts.brandModelCode ?? "",
              r.candidate.facts.categoryText ?? "",
              r.candidate.facts.materialText ?? "",
              r.candidate.facts.audienceSignals.join(" "),
            ].join(" "),
          ),
          inBody: detectMeanings(body),
          inJsonLd: detectMeanings(jsonLdText(html)),
          bodyLen: body.length,
        });
      }

      /* ── §2 Evidence matrix ── */
      console.log("\n═══ §2 CEO SAME 8 + negative 2 — Evidence matrix ═══");
      console.log(
        `    ${"판매처".padEnd(22)}${"CEO".padEnd(10)}${"경로".padEnd(13)}${"의미".padEnd(16)}${"원문".padEnd(8)}${"facts".padEnd(8)}분류`,
      );
      const bucket = { E0: 0, E1: 0, E2: 0, E3: 0 };
      const e2Detail: string[] = [];
      for (const r of rows) {
        for (const m of MEANINGS) {
          const inBody = r.inBody[m] ?? r.inJsonLd[m];
          const inFacts = r.inFacts[m];
          /**
           * E0 원문 O · facts O  ⟹ MI 가 이미 본다
           * E2 원문 O · facts X  ⟹ **페이지에 있는데 ProductFacts 에 구조화되지 않았다**
           * E3 원문 X            ⟹ 현재 확보 불가(해결 대상 아님)
           * 🔴 E1(facts 엔 있는데 MI 가 안 본다)은 **이 축에서는 0 이다** —
           *    `compareCrossSellerProducts` 가 ProductFacts **전 칸** 을 읽는다(소스 확정).
           */
          const cls = !inBody ? "E3" : inFacts ? "E0" : "E2";
          bucket[cls] += 1;
          if (cls === "E2") e2Detail.push(`${r.domain}|${m}|${String(inBody).slice(0, 40)}`);
          console.log(
            `    ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}${r.fetchPath.padEnd(13)}${m.padEnd(16)}${(inBody ? "O" : "X").padEnd(8)}${(inFacts ? "O" : "X").padEnd(8)}${cls}`,
          );
        }
      }

      console.log("\n═══ §4 E0 / E1 / E2 / E3 분포 ═══");
      console.log(`    E0(MI 가 이미 본다)                ${bucket.E0}`);
      console.log(`    E1(facts 엔 있는데 MI 가 안 본다)   0  🟢 구조적으로 0(MI 가 전 칸을 읽는다)`);
      console.log(`    E2(원문엔 있는데 facts 에 없다)      ${bucket.E2}   ← 🔴 1순위`);
      console.log(`    E3(원문에 없다)                     ${bucket.E3}`);

      console.log("\n═══ §3 상세/구조화에서 발견된 «식별» 증거 ═══");
      for (const m of ["I1_BRAND", "I2_TITLE", "I3_MODEL_CODE"] as Meaning[]) {
        const found = rows.filter((r) => (r.inBody[m] ?? r.inJsonLd[m]) && !r.inFacts[m]);
        console.log(`    ${m.padEnd(16)}원문 O · facts X = **${found.length}건**  ${found.map((r) => r.domain).join(", ")}`);
      }

      console.log("\n═══ §6 같은 사실의 «중복 출처»(evidence_count ≠ fact_count) ═══");
      for (const r of rows) {
        const dup = MEANINGS.filter((m) => r.inBody[m] && r.inJsonLd[m]);
        if (dup.length > 0) console.log(`    ${r.domain.padEnd(22)}본문 ∩ JSON-LD = ${dup.join(", ")}`);
      }

      /* ── §7 반사실 — threshold 는 그대로, **입력 칸만** 채운다 ── */
      console.log("\n═══ §7 반사실 — 원문 증거를 facts 에 넣으면(SAME_MIN_AXES=5 불변) ═══");
      let same = 0;
      let diffLeak = 0;
      let uncLeak = 0;
      console.log(`    ${"판매처".padEnd(22)}${"CEO".padEnd(10)}${"before".padEnd(18)}${"축".padEnd(5)}${"after".padEnd(18)}축`);
      for (const r of rows) {
        const before = compareCrossSellerProducts(originFacts, r.facts);
        /**
         * 🔴 **지어내지 않는다** — 위에서 **원문에 실제로 있다고 확인된 의미만** 넣는다.
         * 🔴 `brandModelCode` 는 원상품 품번 문자열을 그대로 쓰지 않고 **페이지가 적은 그 문자열** 을 쓴다.
         */
        const enriched: ProductFacts = {
          ...r.facts,
          brand: r.facts.brand ?? (r.inBody.I1_BRAND ?? r.inJsonLd.I1_BRAND) ?? null,
          brandModelCode:
            r.facts.brandModelCode ??
            (() => {
              const raw = r.inBody.I3_MODEL_CODE ?? r.inJsonLd.I3_MODEL_CODE;
              return raw ? raw.replace(/[\s#]/g, "").toUpperCase() : null;
            })(),
          categoryText: r.facts.categoryText ?? (r.inBody.I4_TYPE ?? r.inJsonLd.I4_TYPE) ?? null,
          materialText: r.facts.materialText ?? (r.inBody.I6_MATERIAL ?? r.inJsonLd.I6_MATERIAL) ?? null,
          audienceSignals:
            r.facts.audienceSignals.length > 0
              ? r.facts.audienceSignals
              : [r.inBody.I9_AUDIENCE ?? r.inJsonLd.I9_AUDIENCE].filter((v): v is string => Boolean(v)),
        };
        const after = compareCrossSellerProducts(originFacts, enriched);
        /**
         * 🔴🔴 **「축 수」가 게이트가 아니다** — `SAME_MIN_AXES=5` 는 **점수 합** 을 보고
         *    식별자 축은 `IDENTIFIER_AXIS_POINTS=3` 을 받는다. 그래서 축 **4개** 로도
         *    SAME 이 된다(donokids). 🔴 「축 4인데 SAME」을 모순으로 읽지 않는다.
         *
         * 🔴🔴🔴 **CORE-2AD 정정 — 아래 `after` 열은 «주입된» 값이다. 운영 값이 아니다.**
         * ```
         * 내가 CORE-2AB 보고에 「stockmann 축 = TITLE:1 + MODEL_CODE:3 + AUDIENCE:1 = 5p」로
         * 적었는데 그것은 **이 반사실의 주입 결과** 였다. 운영 실측은(CORE-2AD):
         *      stockmann  축[TITLE:1]  ·  total **1**  ·  core **0**
         * ⟹ 🔴 「5p 인데 corePoints 4 라서 떨어진다」는 **틀렸다**. 그 후보는 애초에
         *    **증거가 거의 없다**(MODEL_CODE 는 facts 에 없고 내가 넣은 것이다).
         * 🔴 `before` 열(운영 facts)만 운영 값이다 — `after` 를 운영 값으로 인용하지 않는다.
         * ```
         */
        const pts = (c: typeof after) => (c.axes ?? []).reduce((s, a) => s + (a.points ?? 0), 0);
        console.log(
          `    ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}${String(before.verdict).padEnd(18)}${`${before.axes?.length ?? 0}/${pts(before)}p`.padEnd(8)}${String(after.verdict).padEnd(18)}${`${after.axes?.length ?? 0}/${pts(after)}p`.padEnd(8)}`,
        );
        /** 🔴 **안 움직이는 후보의 사유** 를 같이 적는다 — 그것이 다음 WU 좌표다. */
        if (after.verdict !== "SAME") {
          const blk = (after.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker));
          const cfl = (after.conflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict));
          console.log(
            `        ↳ 막는 것 — conflicts[${cfl.join(",") || "없음"}] · blockers[${blk.join(",") || "없음"}] · 축[${(after.axes ?? []).map((a) => `${a.axis}:${a.points}`).join(" ") || "없음"}]`,
          );
        }
        const isSame = after.verdict === "SAME";
        if (r.ceo === "SAME" && isSame) same += 1;
        if (r.ceo === "DIFFERENT" && isSame) diffLeak += 1;
        if (r.ceo === "UNCERTAIN" && isSame) uncLeak += 1;
      }
      const ceoSame = rows.filter((r) => r.ceo === "SAME").length;
      console.log(`\n    SAME recovery **${same}/${ceoSame}** · DIFFERENT leakage **${diffLeak}** · UNCERTAIN leakage **${uncLeak}**`);

      console.log("\n═══ 🔴 E2 상세(1순위 후보) ═══");
      for (const d of e2Detail) console.log(`    ${d}`);

      /* ── 단언 — 분모가 깨지면 측정하지 않는다 ── */
      expect(rows.length, "🔴 후보를 하나도 읽지 못했다 — 측정불가").toBeGreaterThan(0);
      expect(bucket.E1, "🟢 E1 은 구조적으로 0 이다(MI 가 ProductFacts 전 칸을 읽는다)").toBe(0);
      /** 🔴🔴 반사실은 **위험 측정** 이다 — 누출이 생기면 그 증거는 즉시 위험 후보다. */
      expect(diffLeak + uncLeak, `🔴 negative 누출 ${diffLeak + uncLeak}건 — 보고에 그대로 적는다`).toBeLessThan(99);
    },
    20 * 60 * 1000,
  );
});
