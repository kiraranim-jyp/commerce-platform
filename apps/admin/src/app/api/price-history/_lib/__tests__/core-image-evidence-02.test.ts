import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidenceItem, ProductEvidence, ProductFacts } from "@commerce/shared";
import {
  attachNormalizedImageEvidence,
  attachProductEvidence,
} from "@commerce/crawler/src/comparison-search/product-evidence";
import {
  jsonLdProductDescription,
  jsonLdProductImages,
} from "@commerce/crawler/src/comparison-search/jsonld-product-description";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-02 — **공급 보강 + 정규화 Evidence**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **threshold 를 만들지 않는다.** 이 파일 어디에도 「dHash < X → SAME」이 없다.
 *    잠그는 것은 **구조** 다 — 원본 보존 · 정규화 생성 · 규격 통일 · 전후 구분 ·
 *    실패 무해 · 판정 불변.
 *
 * ── 계약 지도(CPO §8 · §15) ────────────────────────────────────────────────
 * ```
 * I7  원본 image URL 보존              I10 trim 전/후를 혼동하지 않는다
 * I8  normalized representation 생성   I11 decode 실패가 ProductFacts 를 안 깨뜨린다
 * I9  종횡비가 달라도 같은 규격        I12 normalization 실패가 verdict 를 안 바꾼다
 * M7  공급 배선 제거 → C22 FAIL        M9  IMAGE → SAME      → FAIL
 * M8  정규화 제거    → I8 FAIL         M10 IMAGE → DIFFERENT → FAIL
 * ```
 */

const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const readCrawler = (f: string) => stripComments(readFileSync(join(CRAWLER, f), "utf8").replace(/\r\n/g, "\n"));
const items = (ev: ProductEvidence | null | undefined, axis: string): EvidenceItem[] =>
  (ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [];


const C22_HTML_LD = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"[메인스토리] Bubble Sweatshirt _Conker Stripe  #AW26MS185",
 "description":"설명","image":["https://www.donokids.com/shopimages/DONOKIDS/0260020000082.jpg"],"sku":"3362912"}
</script>
<meta property="og:type" content="website" />
</head><body>
<img src="/shopimages/DONOKIDS/logo.png">
<img class="MS_prod_mobile_image" src="/shopimages/DONOKIDS/mobile/1/3362921_represent?10141609">
<img class="MS_prod_mobile_image" src="/shopimages/DONOKIDS/mobile/1/3362931_represent?09111026">
</body></html>`;

/* ─────────────────────────── A. 공급(M7) ─────────────────────────── */

describe("CORE-IMAGE-EVIDENCE-02 §A — PLAIN_HTML 이미지 공급(M7)", () => {
  it("A-1 — JSON-LD `Product.image` 를 읽는다(C22 실제 모양)", () => {
    expect(jsonLdProductImages(C22_HTML_LD)).toEqual([
      "https://www.donokids.com/shopimages/DONOKIDS/0260020000082.jpg",
    ]);
  });

  it("A-2 — 🔴 `<img>` 태그와 로고/추천썸네일은 **읽지 않는다**", () => {
    const urls = jsonLdProductImages(C22_HTML_LD);
    for (const u of urls) {
      expect(u).not.toContain("logo");
      expect(u).not.toContain("_represent");
    }
    /** 🔴 페이지의 img 3개가 아니라 **JSON-LD 의 1개** 만 나와야 한다. */
    expect(urls).toHaveLength(1);
  });

  it("A-3 — 🔴 `og:image` 가 없어도 동작한다(C22 가 바로 그 경우다)", () => {
    expect(C22_HTML_LD).not.toContain("og:image");
    expect(jsonLdProductImages(C22_HTML_LD).length).toBeGreaterThan(0);
  });

  it("A-4 — `@type` 이 Product 가 아니면 읽지 않는다", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","image":["https://x.test/logo.png"]}</script>`;
    expect(jsonLdProductImages(html)).toEqual([]);
  });

  it("A-5 — ImageObject · 문자열 · 배열 셋 다 읽고, data: 는 버린다", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","image":[
      "https://x.test/a.jpg",
      {"@type":"ImageObject","url":"https://x.test/b.jpg"},
      "data:image/gif;base64,R0lGOD"]}</script>`;
    expect(jsonLdProductImages(html)).toEqual(["https://x.test/a.jpg", "https://x.test/b.jpg"]);
  });

  it("A-6 — 🔴 설명문 reader 와 **같은 블록** 을 쓴다(파서 두 벌 금지)", () => {
    expect(jsonLdProductDescription(C22_HTML_LD)).toBe("설명");
    const code = readCrawler("jsonld-product-description.ts");
    /**
     * 🔴 LD 블록 정규식은 **한 번만 정의** 되고 두 reader 가 **그것을 함께** 쓴다.
     *    (1차 단언이 리터럴 `application/ld` 를 셌는데 소스에는 `application\/ld` 로
     *     이스케이프돼 있어 **0** 이 나왔다 — 내 단언이 틀렸다.)
     */
    expect(code.split("const LD_BLOCK_RE").length - 1).toBe(1);
    expect(code.split("LD_BLOCK_RE()").length - 1).toBe(2);
  });

  it("A-7 — 운영 배선: htmlPath 가 `jsonLdProductImages` 를 넘긴다", () => {
    const code = readCrawler("product-url-facts.ts");
    expect(code).toContain("imageUrls: jsonLdProductImages(html)");
  });

  it("A-8 — 🔴 목록 경로는 영향받지 않는다(imageUrl 한 장 동작 유지)", () => {
    const code = readCrawler("seller-facts.ts");
    expect(code).toContain("input.imageUrls?.length");
    expect(code).toContain("input.imageUrl ? [input.imageUrl] : []");
  });
});

/* ──────────────── C. Evidence 구조(I7 · I11 · I12 · M9/M10) ──────────────── */

describe("CORE-IMAGE-EVIDENCE-02 §C — Evidence 구조", () => {
  const IMG_A = "https://cdn.test/a.jpg";
  const IMG_B = "https://cdn.test/b.jpg";
  const withImages = (urls: string[]): ProductFacts =>
    attachProductEvidence({
      sourceUrl: "https://example.test/p",
      urlSlug: null,
      brand: "Main Story",
      brandModelCode: null,
      sellerSku: null,
      title: "Bubble Sweatshirt - Grey Melange",
      coreTitleTokens: ["bubble"],
      categoryText: null,
      colorText: null,
      materialText: null,
      fitText: null,
      ageRangeText: null,
      sizeLabels: [],
      audienceSignals: [],
      imageUrls: urls,
    });

  it("I7 — 정규화를 붙여도 **원본 URL 이 그대로**다", () => {
    const before = withImages([IMG_A, IMG_B]);
    const after = attachNormalizedImageEvidence(before, { [IMG_A]: "d1:abcd:1,2,3" });
    expect(items(after.evidence, "IMAGE")[0]?.value).toBe(IMG_A);
    /** 🔴 원본 `imageUrls` 목록도 **버리지 않는다**(CPO §10). */
    expect(after.imageUrls).toEqual([IMG_A, IMG_B]);
  });

  it("I7-b — 대표는 **칸으로** 표시되고 1장이다", () => {
    const f = withImages([IMG_A, IMG_B]);
    expect(items(f.evidence, "IMAGE")).toHaveLength(1);
    expect(items(f.evidence, "IMAGE")[0]?.representative).toBe(true);
  });

  it("I7-c — digest 는 **식별자 문자열** 이고 binary 가 아니다", () => {
    const after = attachNormalizedImageEvidence(withImages([IMG_A]), { [IMG_A]: "d1:abcd1234abcd1234:1,2,3" });
    const item = items(after.evidence, "IMAGE")[0]!;
    expect(item.normalized).toBe(true);
    expect(typeof item.digest).toBe("string");
    expect(item.digest!.length).toBeLessThan(120);
    expect(JSON.stringify(after).length).toBeLessThan(4000);
  });

  it("I11-b — 정규화 실패(맵에 없음)는 facts 를 깨뜨리지 않고 «같은 객체» 를 돌려준다", () => {
    const before = withImages([IMG_A]);
    expect(attachNormalizedImageEvidence(before, {})).toBe(before);
    expect(items(before.evidence, "IMAGE")[0]?.normalized).toBeUndefined();
  });

  it("I11-c — 이미지가 없는 facts 에 적용해도 안전하다(C22 이전 상태)", () => {
    const bare = withImages([]);
    expect(attachNormalizedImageEvidence(bare, { [IMG_A]: "d1:x:0,0,0" })).toBe(bare);
  });

  it("I12(M9 · M10) — 정규화 결과가 붙어도 GT 33 verdict · tier 가 불변", () => {
    for (const p of SAME05_PAIRS) {
      const base = attachProductEvidence(p.facts);
      const normalized = attachNormalizedImageEvidence(base, {
        ...Object.fromEntries((p.facts.imageUrls ?? []).map((u) => [u, "d1:ffffffffffffffff:1,1,1"])),
      });
      const a = same05Judge(p.origin, base);
      const b = same05Judge(p.origin, normalized);
      expect({ id: p.id, v: String(b.cross.verdict), t: b.tier }).toEqual({
        id: p.id,
        v: String(a.cross.verdict),
        t: a.tier,
      });
    }
  });

  it("I12-b — 🔴 **모든 상품에 같은 digest** 를 줘도 SAME 이 되지 않는다", () => {
    const same = "d1:0000000000000000:0,0,0";
    const a = attachNormalizedImageEvidence(withImages([IMG_A]), { [IMG_A]: same });
    const b = attachNormalizedImageEvidence(
      attachProductEvidence({ ...withImages([IMG_B]), title: "Modern Tracksuit Jacket" }),
      { [IMG_B]: same },
    );
    expect(String(same05Judge(a, b).cross.verdict)).not.toBe("SAME");
  });

  it("I12-c — 기준선 숫자 불변", () => {
    const t = same05Tally((p) =>
      same05Judge(
        p.origin,
        attachNormalizedImageEvidence(attachProductEvidence(p.facts), { x: "d1:0:0,0,0" }),
      ).cross.verdict,
    );
    expect(t.gtSame).toBe(SAME05_BASELINE.same);
    expect(t.gtDifferent).toBe(SAME05_BASELINE.different);
    expect(t.falsePositive).toBe(SAME05_BASELINE.fp);
    expect(`${t.truePositive}/${t.gtSame}`).toBe(SAME05_BASELINE.samePrecision);
  });

  it("I12-d — 🔴 비교 모듈이 digest · 정규화 어휘를 **읽지 않는다**", () => {
    for (const f of ["cross-seller.ts", "match-truth.ts", "model-code.ts"]) {
      const code = readCrawler(f);
      for (const w of ["digest", "normalized", "VisualSignature", "dHash", "imageUrls", ".evidence"]) {
        expect(code).not.toContain(w);
      }
    }
  });

  it("I12-e — 🔴 추출기는 여전히 HTTP · sharp 를 쓰지 않는다", () => {
    const code = readCrawler("product-evidence.ts");
    for (const w of ["fetch(", "sharp", "http.get", "https.get"]) expect(code).not.toContain(w);
  });
});
