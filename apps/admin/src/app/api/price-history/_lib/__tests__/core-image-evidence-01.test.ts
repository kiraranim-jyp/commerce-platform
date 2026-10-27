import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROBE_EVIDENCE_AXES, type EvidenceItem, type ProductEvidence, type ProductFacts } from "@commerce/shared";
import {
  attachProductEvidence,
  extractProductEvidence,
} from "@commerce/crawler/src/comparison-search/product-evidence";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-01 — **IMAGE 를 Evidence «출처» 로만 수용한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 Sprint 는 image matcher 를 만들지 않는다.** 보존하는 것은 **URL 하나** 이고
 *    그 값은 어떤 판정에도 들어가지 않는다. 금지(CPO §3)를 계약으로 잠근다:
 * ```
 * ❌ image score / similarity / threshold     ❌ IMAGE → SAME · IMAGE → DIFFERENT
 * ❌ 기존 verdict 를 이미지로 변경            ❌ price · priceTier · Comparability
 * ```
 *
 * ── 변이 대응(CPO §12 · I1~I6) ──────────────────────────────────────────────
 * ```
 * I1 이미지 URL 이 있으면 IMAGE evidence 가 **source 를 잃지 않는다**
 * I2 이미지 URL 이 없으면 기존 TITLE/DESCRIPTION evidence 가 **영향받지 않는다**
 * I3 이미지 **접근 실패** 가 matcher verdict 를 바꾸지 않는다(= 추출이 HTTP 를 안 한다)
 * I4 이미지 evidence 추가만으로 **SAME shortcut 이 생기지 않는다**
 * I5 **C19 · C20 · C22** 의 기존 verdict 가 변하지 않는다
 * I6 IMAGE 를 제거하는 변이에서 관련 계약이 **FAIL** 한다
 * ```
 */

const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const readCrawler = (f: string) => stripComments(readFileSync(join(CRAWLER, f), "utf8").replace(/\r\n/g, "\n"));

const items = (ev: ProductEvidence | null | undefined, axis: string): EvidenceItem[] =>
  (ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [];
const allItems = (ev: ProductEvidence | null | undefined): EvidenceItem[] =>
  Object.values(ev ?? {}).flatMap((v) => v ?? []);

const IMG = "https://cdn.shopify.com/s/files/1/2263/4907/files/AW26MS185-BubbleSweatshirt-GreyMelange_front.jpg";

const facts = (over: Partial<ProductFacts>): ProductFacts => ({
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
  imageUrls: [],
  ...over,
});

describe("CORE-IMAGE-EVIDENCE-01 §I1 — IMAGE evidence 는 출처를 잃지 않는다", () => {
  /**
   * 🔴 **CORE-IMAGE-EVIDENCE-02 에서 이 계약이 FAIL 했고 «의도된 변경» 이라 갱신했다** —
   *    대표 표시(`representative`)가 칸으로 추가됐다. 🟢 느슨하게 하지 않고 **그 칸까지
   *    단언** 하도록 강화했다(전체 회귀가 잡아 줬다 · 단일 파일 실행으로는 안 보였다).
   */
  it("I1-a — 이미지 URL 이 있으면 axis IMAGE · source IMAGE 로 보존된다", () => {
    const ev = extractProductEvidence({ title: null, description: null, imageUrls: [IMG] });
    expect(items(ev, "IMAGE")).toEqual([{ value: IMG, source: "IMAGE", representative: true }]);
  });

  it("I1-b — 운영 facts 경유(`attachProductEvidence`)로도 보존된다", () => {
    const f = attachProductEvidence(facts({ imageUrls: [IMG] }));
    expect(items(f.evidence, "IMAGE").map((i) => i.source)).toEqual(["IMAGE"]);
  });

  it("I1-c — 🔴 **대표 1장만** 남긴다(증거 개수를 부풀리지 않는다)", () => {
    const ev = extractProductEvidence({
      title: null,
      description: null,
      imageUrls: [IMG, `${IMG}?v=2`, `${IMG}?v=3`],
    });
    expect(items(ev, "IMAGE")).toHaveLength(1);
    expect(items(ev, "IMAGE")[0]?.value).toBe(IMG);
  });

  it("I1-d — IMAGE 는 🟡 **관측 전용 축** 목록에 있다(판정 축 아님)", () => {
    expect(PROBE_EVIDENCE_AXES).toContain("IMAGE");
  });
});

describe("CORE-IMAGE-EVIDENCE-01 §I2 — 이미지가 없어도 기존 Evidence 는 그대로다", () => {
  const DESC = "Brand : BOBO CHOSES Color : Light Blue 100% Organic Cotton B226AC009";

  it("I2-a — imageUrls 유무가 TITLE/DESCRIPTION 증거를 바꾸지 않는다", () => {
    const without = extractProductEvidence({ title: "Bubble Sweatshirt", description: DESC });
    const with_ = extractProductEvidence({ title: "Bubble Sweatshirt", description: DESC, imageUrls: [IMG] });
    const strip = (ev: ProductEvidence | null) => {
      const { IMAGE: _drop, ...rest } = ev ?? {};
      return rest;
    };
    expect(strip(with_)).toEqual(strip(without));
  });

  it("I2-b — 이미지가 **하나도 없으면** IMAGE 축 자체가 없다(빈 배열 아님)", () => {
    const ev = extractProductEvidence({ title: "Bubble Sweatshirt", description: null, imageUrls: [] });
    expect(ev && "IMAGE" in ev).toBe(false);
    /** 🔴 C22 가 실제로 이 상태다 — 「이미지 없음」은 **정상 상태** 이고 결함이 아니다. */
    expect(allItems(ev).length).toBeGreaterThan(0);
  });
});

describe("CORE-IMAGE-EVIDENCE-01 §I3 — 추출은 이미지를 «내려받지 않는다»", () => {
  it("I3-a — 접근 불가 URL 이어도 던지지 않고 값만 보존한다", () => {
    const dead = "https://nonexistent.invalid/missing.jpg";
    const ev = extractProductEvidence({ title: "t", description: null, imageUrls: [dead] });
    expect(items(ev, "IMAGE")[0]?.value).toBe(dead);
  });

  it("I3-b — 🔴 추출기 소스에 fetch/http 가 **없다**(그래서 접근 실패가 판정에 닿을 수 없다)", () => {
    const code = readCrawler("product-evidence.ts");
    for (const forbidden of ["fetch(", "http.get", "https.get", "axios", "undici", "sharp"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("I3-c — 이미지 접근 실패를 흉내내도 verdict 가 변하지 않는다", () => {
    const p = SAME05_PAIRS.find((x) => x.id === "C19")!;
    const broken = attachProductEvidence({ ...p.facts, imageUrls: ["https://nonexistent.invalid/x.jpg"] });
    const none = attachProductEvidence({ ...p.facts, imageUrls: [] });
    expect(String(same05Judge(p.origin, broken).cross.verdict)).toBe(
      String(same05Judge(p.origin, none).cross.verdict),
    );
  });
});

describe("CORE-IMAGE-EVIDENCE-01 §I4 — 🔴🔴 IMAGE 가 SAME 을 만들지 않는다", () => {
  it("I4-a — 이미지 URL 이 «완전히 같아도» SAME 이 되지 않는다", () => {
    /** 🔴 가장 위험한 모양 — 두 판매처가 **같은 이미지 파일** 을 쓰는 경우. */
    const a = attachProductEvidence(facts({ title: "Bubble Sweatshirt - Grey Melange", imageUrls: [IMG] }));
    const b = attachProductEvidence(
      facts({ title: "Modern Tracksuit Jacket", coreTitleTokens: ["modern", "tracksuit"], imageUrls: [IMG] }),
    );
    expect(items(a.evidence, "IMAGE")[0]?.value).toBe(items(b.evidence, "IMAGE")[0]?.value);
    expect(String(same05Judge(a, b).cross.verdict)).not.toBe("SAME");
  });

  it("I4-b — GT 33 전수에서 IMAGE 부착 전후 verdict · tier 가 동일하다", () => {
    for (const p of SAME05_PAIRS) {
      const before = same05Judge(p.origin, p.facts);
      const after = same05Judge(p.origin, attachProductEvidence(p.facts));
      expect({ id: p.id, v: String(after.cross.verdict), t: after.tier }).toEqual({
        id: p.id,
        v: String(before.cross.verdict),
        t: before.tier,
      });
    }
  });

  it("I4-c — 기준선 숫자가 그대로다", () => {
    const t = same05Tally((p) => same05Judge(p.origin, attachProductEvidence(p.facts)).cross.verdict);
    expect(t.gtSame).toBe(SAME05_BASELINE.same);
    expect(t.gtDifferent).toBe(SAME05_BASELINE.different);
    expect(t.falsePositive).toBe(SAME05_BASELINE.fp);
    expect(`${t.truePositive}/${t.gtSame}`).toBe(SAME05_BASELINE.samePrecision);
  });

  it("I4-d — 비교 모듈이 이미지 어휘를 **읽지 않는다**", () => {
    for (const f of ["cross-seller.ts", "match-truth.ts", "model-code.ts"]) {
      const code = readCrawler(f);
      expect(code).not.toMatch(/\.evidence\b/);
      expect(code).not.toContain("imageUrls");
      expect(code).not.toContain("product-evidence");
    }
  });
});

describe("CORE-IMAGE-EVIDENCE-01 §I5 — C19 · C20 · C22 의 판정이 변하지 않는다", () => {
  /** 🔴 실측 기준선(이 WU 착수 시점) — 숫자가 아니라 **이름** 으로 고정한다. */
  const EXPECTED: Record<string, string> = { C19: "PRESUMED_SAME", C20: "PRESUMED_SAME", C22: "SIMILAR" };

  for (const [id, want] of Object.entries(EXPECTED)) {
    it(`I5-${id} — human DIFFERENT 이고 시스템은 SAME 이 아니다(${want} 유지)`, () => {
      const p = SAME05_PAIRS.find((x) => x.id === id);
      expect(p).toBeDefined();
      expect(p!.human).toBe("DIFFERENT");
      const j = same05Judge(p!.origin, attachProductEvidence(p!.facts));
      expect(String(j.cross.verdict)).toBe(want);
      expect(String(j.cross.verdict)).not.toBe("SAME");
    });
  }

  it("I5-C22 — 🔴 이미지가 **0장** 인 것이 현재 상태다(측정 사실 고정)", () => {
    const p = SAME05_PAIRS.find((x) => x.id === "C22")!;
    /** 🔴 「없다」를 matcher 결함으로 적지 않는다 — PLAIN_HTML 경로가 수집하지 않는다. */
    expect(p.facts.imageUrls).toHaveLength(0);
    expect(attachProductEvidence(p.facts).evidence?.IMAGE).toBeUndefined();
  });
});

describe("CORE-IMAGE-EVIDENCE-01 §I6 — 배선 제거 변이가 잡힌다", () => {
  it("I6-a — 추출기가 imageUrls 를 실제로 읽는다(배선 앵커)", () => {
    const code = readCrawler("product-evidence.ts");
    expect(code).toContain("input.imageUrls");
    expect(code).toContain('b.add("IMAGE", "IMAGE"');
  });

  it("I6-b — attachProductEvidence 가 facts.imageUrls 를 넘긴다", () => {
    const code = readCrawler("product-evidence.ts");
    expect(code).toContain("imageUrls: facts.imageUrls");
  });
});
