import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_EVIDENCE_AXES,
  PROBE_EVIDENCE_AXES,
  buildCoreTitleTokens,
  type EvidenceItem,
  type ProductEvidence,
  type ProductFacts,
} from "@commerce/shared";
import {
  attachProductEvidence,
  extractProductEvidence,
} from "@commerce/crawler/src/comparison-search/product-evidence";
import { recoverModelCodeFromDetail } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-DESC-EVIDENCE-01 — **Evidence Layer 계약**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 Sprint 의 성공은 「SAME 이 늘었다」가 아니다.** 성공은 셋이다:
 * ```
 * ① 원문(TITLE · DESCRIPTION)의 사실을 구조화 증거로 **보존** 한다
 * ② 그 증거가 **어느 원문에서 왔는지** 를 잃지 않는다
 * ③ 🔴 기존 Identity / Comparability / Price 를 **한 글자도 훼손하지 않는다**
 * ```
 * ⟹ 그래서 이 파일의 절반은 **「무엇이 일어나면 안 되는가」** 를 잠근다.
 *
 * ── 변이 대응(§9-Y M1~M6) ───────────────────────────────────────────────────
 * ```
 * M1 DESCRIPTION 추출 배선 제거  → §2 · §6 FAIL
 * M2 TITLE source 제거           → §3(C27) FAIL
 * M3 설명문 MODEL_CODE recovery 제거 → §4 FAIL
 * M4 provenance 제거             → §1 FAIL
 * M5 description score → SAME    → §7-b FAIL
 * M6 brand + modelCode → SAME    → §7-a(C19 · C20) FAIL
 * ```
 */

const CEO_GT = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "core-desc-review-ceo-gt.json"), "utf8"),
) as { cases: number; answers: Record<string, Record<string, string>> };

/**
 * 🔴🔴 **아래 두 상수는 「내가 지어낸 설명문」이 아니다** — CEO 조서(2026-10-27)가
 *    인용한 **판매처 원문** 이고, §0 의 단언이 그 사실을 **기계로** 지킨다
 *    (조서 `phrase` 의 부분문자열이 아니면 FAIL). 🔴 그래서 조서와 따로 낡을 수 없다.
 * 🔴 조서의 CEO **코멘트 줄**(「상세설명에 다 존재함.」 등)은 상품 원문이 아니라서 **뺐다**.
 */
const C06_DESCRIPTION =
  "Gender : Men Brand : BOBO CHOSES Product Name : Bobo Choses Kids Hug Hairy Monster Long Sleeve T-Shirt (Light Blue) B226AC009 451 160484657 [P] Color : Light Blue SKU : 26FW B226AC009 451 trenbe Code : 160484657";
const C05_DESCRIPTION =
  "Tinyapple | FW26 Bobo Choses | Hug Hairy Monster T-shirt, Light Blue 100% Organic Cotton Wash Cold-30° Do Not Bleach Iron Low Do not Dry-clean Do Not Tumble Dry B226AC009";

const pairById = (id: string) => {
  const p = SAME05_PAIRS.find((x) => x.id === id);
  /** 🔴 없으면 **건너뛰지 않고 실패** 한다 — 반례가 조용히 사라지는 것이 가장 나쁘다. */
  if (!p) throw new Error(`GT 반례 ${id} 가 분모에 없다`);
  return p;
};

const values = (ev: ProductEvidence | null | undefined, axis: string, source?: string): string[] =>
  ((ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [])
    .filter((i) => (source ? i.source === source : true))
    .map((i) => i.value);

const allItems = (ev: ProductEvidence | null | undefined): EvidenceItem[] =>
  Object.values(ev ?? {}).flatMap((v) => v ?? []);

const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const readCrawler = (f: string) => stripComments(readFileSync(join(CRAWLER, f), "utf8").replace(/\r\n/g, "\n"));

/* ─────────────────────────────────────────────────────────────────────────── */

describe("CORE-DESC-EVIDENCE-01 §0 — 조서 원문 고정(설명문 입력이 CEO 기록에서 왔다)", () => {
  it("계약 0-a — 계약에 쓰는 설명문은 CEO 조서 phrase 의 부분문자열이다", () => {
    expect(CEO_GT.answers.C06?.phrase).toContain(C06_DESCRIPTION);
    expect(CEO_GT.answers.C05?.phrase).toContain(C05_DESCRIPTION);
  });

  it("계약 0-b — 🔴 미응답(S1-5.set)을 yes/no 로 «채우지 않는다»", () => {
    /** 🔴 조서 11건은 그대로다 — 이 Sprint 가 라벨을 만들어 넣지 않았다. */
    expect(CEO_GT.cases).toBe(11);
    expect(Object.keys(CEO_GT.answers)).toHaveLength(11);
    const s15 = CEO_GT.answers["S1-5"];
    expect(s15).toBeDefined();
    expect(["yes", "no"]).not.toContain(s15?.set ?? "");
  });
});

describe("CORE-DESC-EVIDENCE-01 §1 — provenance(M4)", () => {
  it("계약 1-a — 모든 증거 항목이 value 와 source 를 «둘 다» 갖는다", () => {
    const ev = extractProductEvidence({ title: "Bobo Choses T-shirt B226AC009", description: C06_DESCRIPTION });
    const items = allItems(ev);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(typeof i.value).toBe("string");
      expect(i.value.length).toBeGreaterThan(0);
      /** 🔴 출처가 없는 증거는 **증거가 아니다** — 이 Sprint 가 막으려는 바로 그 상태다. */
      expect(["TITLE", "DESCRIPTION"]).toContain(i.source);
    }
  });

  it("계약 1-b — 같은 값이 두 원문에 있으면 «둘 다» 남는다(출처 소실 0)", () => {
    const ev = extractProductEvidence({
      title: "Bobo Choses Kids Hug Hairy Monster Long Sleeve T-Shirt (Light Blue) B226AC009",
      description: C06_DESCRIPTION,
    });
    /** 🔴 하나로 합치면 「설명에도 있다」와 「상품명에만 있다」가 같은 모양이 된다. */
    expect(values(ev, "MODEL_CODE", "TITLE")).toContain("B226AC009");
    expect(values(ev, "MODEL_CODE", "DESCRIPTION")).toContain("B226AC009");
  });

  it("계약 1-c — 🔴 부재는 «정상» 이다(빈 배열/빈 객체를 만들지 않는다)", () => {
    expect(extractProductEvidence({ title: null, description: null })).toBeNull();
    for (const list of Object.values(
      extractProductEvidence({ title: "Bubble Sweatshirt", description: null }) ?? {},
    )) {
      expect((list ?? []).length).toBeGreaterThan(0);
    }
  });
});

describe("CORE-DESC-EVIDENCE-01 §2 — DESCRIPTION source(M1)", () => {
  it("계약 2-a — C06 설명문의 라벨에서 BRAND · MODEL_CODE · COLOR · PRODUCT_NAME 을 읽는다", () => {
    const ev = extractProductEvidence({ title: null, description: C06_DESCRIPTION });
    expect(values(ev, "BRAND", "DESCRIPTION")).toContain("BOBO CHOSES");
    expect(values(ev, "MODEL_CODE", "DESCRIPTION")).toContain("B226AC009");
    expect(values(ev, "COLOR", "DESCRIPTION")).toContain("Light Blue");
    expect(values(ev, "PRODUCT_NAME", "DESCRIPTION")).toContain(
      "Bobo Choses Kids Hug Hairy Monster Long Sleeve T-Shirt (Light Blue) B226AC009 451 160484657 [P]",
    );
  });

  it("계약 2-b — 🔴 라벨 값이 «다음 라벨» 을 삼키지 않는다", () => {
    const ev = extractProductEvidence({ title: null, description: C06_DESCRIPTION });
    /** 🔴 실측으로 잡은 버그 — 줄 끝까지 읽으면 Brand 가 「BOBO CHOSES Product Name : …」 이 됐다. */
    for (const v of values(ev, "BRAND", "DESCRIPTION")) {
      expect(v).not.toMatch(/product\s*name/i);
      expect(v).not.toContain(":");
    }
    for (const v of values(ev, "COLOR", "DESCRIPTION")) expect(v).not.toMatch(/sku/i);
  });

  it("계약 2-c — C05 설명문에서 MODEL_CODE 와 MATERIAL 을 읽는다", () => {
    const ev = extractProductEvidence({ title: null, description: C05_DESCRIPTION });
    expect(values(ev, "MODEL_CODE", "DESCRIPTION")).toContain("B226AC009");
    expect(values(ev, "MATERIAL", "DESCRIPTION")).toContain("organic cotton");
  });

  it("계약 2-d — 한국어 라벨(「브랜드 :」·「색상 :」)도 읽는다", () => {
    const ev = extractProductEvidence({ title: null, description: "브랜드 : 보보쇼즈 색상 : 라이트블루" });
    expect(values(ev, "BRAND", "DESCRIPTION")).toContain("보보쇼즈");
    expect(values(ev, "COLOR", "DESCRIPTION")).toContain("라이트블루");
  });
});

describe("CORE-DESC-EVIDENCE-01 §3 — TITLE source(M2) · 🔴 C27 이 그 이유다", () => {
  it("계약 3-a — C27 은 설명이 «없고» 상품명에 BRAND·MODEL_CODE 가 있다", () => {
    const p = pairById("C27");
    /** 🔴 전제부터 고정한다 — 저장 facts 에 description 이 없다는 것이 C27 의 상황이다. */
    expect(p.facts.description ?? null).toBeNull();
    const ev = extractProductEvidence({ title: p.facts.title, description: p.facts.description });
    expect(values(ev, "BRAND", "TITLE")).toContain("Bobo Choses");
    expect(values(ev, "MODEL_CODE", "TITLE")).toContain("B226AC010");
    /** 🔴 그리고 DESCRIPTION source 가 **하나도 없어야** 한다 — 없는 것을 지어내지 않는다. */
    expect(allItems(ev).filter((i) => i.source === "DESCRIPTION")).toHaveLength(0);
  });

  it("계약 3-b — 상품명만 있어도 FORM 과 PRODUCT_NAME 이 선다", () => {
    const ev = extractProductEvidence({ title: pairById("C42").facts.title, description: null });
    expect(values(ev, "FORM", "TITLE")).toContain("SWEATSHIRT");
    expect(values(ev, "PRODUCT_NAME", "TITLE")).toContain("Bubble Sweatshirt - Grey Melange");
  });
});

describe("CORE-DESC-EVIDENCE-01 §4 — 설명문 → MODEL_CODE recovery 가 살아 있다(M3)", () => {
  const base = (over: Partial<ProductFacts>): ProductFacts => ({
    sourceUrl: "https://example.test/p",
    urlSlug: null,
    brand: null,
    brandModelCode: null,
    sellerSku: null,
    title: "T-shirt",
    coreTitleTokens: [],
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

  it("계약 4-a — 비어 있을 때만 설명문에서 품번을 채운다", () => {
    expect(recoverModelCodeFromDetail(base({ description: C05_DESCRIPTION })).brandModelCode).toBe("B226AC009");
  });

  it("계약 4-b — 🔴 기존 값을 덮지 않는다(충돌 보호 불변)", () => {
    const kept = recoverModelCodeFromDetail(base({ brandModelCode: "B226AC010", description: C05_DESCRIPTION }));
    expect(kept.brandModelCode).toBe("B226AC010");
  });
});

describe("CORE-DESC-EVIDENCE-01 §5 — attachProductEvidence 는 «더하기만» 한다(계약 P3)", () => {
  it("계약 5-a — evidence 외의 칸이 한 글자도 바뀌지 않는다", () => {
    for (const p of SAME05_PAIRS) {
      const after = attachProductEvidence(p.facts);
      const { evidence: _drop, ...rest } = after;
      expect(rest).toEqual(p.facts);
    }
  });

  it("계약 5-b — 증거가 없으면 «같은 객체» 를 돌려준다(할당 0)", () => {
    const bare: ProductFacts = {
      sourceUrl: "https://example.test/x",
      urlSlug: null,
      brand: null,
      brandModelCode: null,
      sellerSku: null,
      title: "",
      coreTitleTokens: [],
      categoryText: null,
      colorText: null,
      materialText: null,
      fitText: null,
      ageRangeText: null,
      sizeLabels: [],
      audienceSignals: [],
      imageUrls: [],
    };
    expect(attachProductEvidence(bare)).toBe(bare);
  });
});

describe("CORE-DESC-EVIDENCE-01 §6 — 운영 배선(M1) · 🔴 두 경로 «모두»", () => {
  const CODE = readCrawler("product-url-facts.ts");

  it("계약 6-a — Shopify 경로와 HTML 경로가 «둘 다» 증거를 붙인다", () => {
    /** 🔴 개수로 잠근다 — 한 경로만 배선하면 Shopify 아닌 판매처에서 증거가 조용히 사라진다. */
    expect(CODE.split("attachProductEvidence(recoverModelCodeFromDetail(").length - 1).toBe(2);
  });

  it("계약 6-b — 🔴 recovery 를 «대체하지» 않는다(둘 다 산다)", () => {
    expect(CODE).toContain("recoverModelCodeFromDetail");
  });
});

describe("CORE-DESC-EVIDENCE-01 §7 — 🔴🔴 금지: 증거가 늘었다고 SAME 이 되지 않는다", () => {
  it("계약 7-a(M6) — 브랜드·품번이 둘 다 «일치» 해도 SAME 이 아니다(C19 · C20)", () => {
    for (const id of ["C19", "C20"]) {
      const p = pairById(id);
      /** 🔴 전제 — 이 둘은 브랜드가 같고 품번이 exact 인데 **human DIFFERENT** 다. */
      expect(p.human).toBe("DIFFERENT");
      expect(p.facts.brand).toBe(p.origin.brand);
      expect(p.facts.brandModelCode).toBe(p.origin.brandModelCode);
      const j = same05Judge(p.origin, attachProductEvidence(p.facts));
      expect(String(j.cross.verdict)).not.toBe("SAME");
    }
  });

  it("계약 7-a2(M6) — text evidence 가 풍부한 C22 · C50 도 SAME 이 아니다", () => {
    for (const id of ["C22", "C50"]) {
      const p = pairById(id);
      expect(p.human).toBe("DIFFERENT");
      expect(String(same05Judge(p.origin, attachProductEvidence(p.facts)).cross.verdict)).not.toBe("SAME");
    }
  });

  /**
   * 🔴🔴 **내 1차 단언이 M5 를 «놓쳤다» — 그 사실을 적는다.**
   * ```
   * 1차에는 「형태가 다른」 쌍 하나만 썼다 → `compareCrossSellerProducts` 는 conflict 가
   * 생기면 **cross-seller.ts:895 에서 즉시 반환** 한다(점수 로직에 도달하지 않는다).
   * ⟹ 점수 자리에 넣은 M5 shortcut 이 **그 쌍에서는 실행되지 않아** 26/26 이 통과했다.
   * 🔴 이 트랙이 세 번 넘게 겪은 **「단언 좌표가 틀렸다」** 와 같은 함정이다.
   * 🟢 그래서 **충돌이 없어서 점수 로직까지 «실제로 가는»** 쌍을 같이 둔다.
   * ```
   */
  const RICH_DESCRIPTION =
    "Brand : Bobo Choses Product Name : Bobo Choses Kids Garment Color : Multicolor 100% Organic Cotton " +
    "Wash Cold Do Not Bleach Iron Low Do Not Tumble Dry Made in Spain Loose fit";
  const mkRich = (title: string, color: string | null): ProductFacts => ({
    sourceUrl: `https://example.test/${encodeURIComponent(title)}`,
    urlSlug: null,
    brand: "Bobo Choses",
    brandModelCode: null,
    sellerSku: null,
    title,
    coreTitleTokens: buildCoreTitleTokens(title, ["Bobo Choses", color]),
    categoryText: null,
    colorText: color,
    materialText: null,
    fitText: null,
    ageRangeText: null,
    sizeLabels: [],
    audienceSignals: ["kids"],
    imageUrls: [],
    description: RICH_DESCRIPTION,
  });

  it("계약 7-b(M5) — 설명문이 «똑같이 풍부해도» 형태가 다르면 SAME 이 아니다", () => {
    const a = attachProductEvidence(mkRich("Bobo Choses Modern tracksuit jacket, Multicolor", "Multicolor"));
    const b = attachProductEvidence(mkRich("Bobo Choses Hug Hairy Monster T-shirt, Light Blue", "Light Blue"));
    /** 🟢 증거는 **양쪽 다 풍부하다** — 그래서 「풍부함 → SAME」 shortcut 이 들어오면 여기서 뒤집힌다. */
    expect(allItems(a.evidence).length).toBeGreaterThanOrEqual(5);
    expect(allItems(b.evidence).length).toBeGreaterThanOrEqual(5);
    expect(String(same05Judge(a, b).cross.verdict)).not.toBe("SAME");
  });

  it("계약 7-b2(M5) — 🔴 충돌이 «없어» 점수 로직까지 가는 쌍에서도 SAME 이 아니다", () => {
    /** 🔴 같은 브랜드 · 같은 형태(SHIRT) · 색상 충돌 없음 ⟹ **조기 반환이 일어나지 않는다**. */
    const a = attachProductEvidence(mkRich("Bobo Choses Hug Hairy Monster T-shirt", null));
    const b = attachProductEvidence(mkRich("Bobo Choses Booty Ghosts T-shirt", null));
    const j = same05Judge(a, b);
    /** 🟢 전제 — 충돌로 끝나지 않았다는 것을 **먼저** 단언한다(좌표가 또 틀리지 않게). */
    expect(String(j.cross.verdict)).not.toBe("CONFLICT");
    expect(j.cross.conflicts ?? []).toHaveLength(0);
    /** 🔴 그런데도 **서로 다른 상품** 이다 — 설명문이 같다고 SAME 이 되면 안 된다. */
    expect(String(j.cross.verdict)).not.toBe("SAME");
  });

  it("계약 7-c(M5 · M6) — GT 33 전수에서 verdict · tier 가 «한 건도» 바뀌지 않는다", () => {
    for (const p of SAME05_PAIRS) {
      const before = same05Judge(p.origin, p.facts);
      const after = same05Judge(p.origin, attachProductEvidence(p.facts));
      expect({ id: p.id, v: String(after.cross.verdict), t: after.tier, c: after.code }).toEqual({
        id: p.id,
        v: String(before.cross.verdict),
        t: before.tier,
        c: before.code,
      });
    }
  });

  it("계약 7-d — 기준선 숫자가 그대로다(상수 import · 리터럴 금지)", () => {
    const t = same05Tally((p) => same05Judge(p.origin, attachProductEvidence(p.facts)).cross.verdict);
    expect(t.gtSame).toBe(SAME05_BASELINE.same);
    expect(t.gtDifferent).toBe(SAME05_BASELINE.different);
    expect(t.gtUncertain).toBe(SAME05_BASELINE.uncertain);
    expect(t.falsePositive).toBe(SAME05_BASELINE.fp);
    expect(`${t.truePositive}/${t.gtSame}`).toBe(SAME05_BASELINE.samePrecision);
  });
});

describe("CORE-DESC-EVIDENCE-01 §8 — 🔴 Evidence 는 비교 입력이 아니다(계약 P2)", () => {
  const COMPARATORS = ["cross-seller.ts", "match-truth.ts", "model-code.ts"];

  it("계약 8-a — 비교 모듈이 `.evidence` 를 읽지 않는다", () => {
    for (const f of COMPARATORS) {
      expect(readCrawler(f)).not.toMatch(/\.evidence\b/);
    }
  });

  /**
   * 🔴🔴 **내 1차 단언이 틀렸고 그것을 적는다.** 처음에는 「관측 전용 축 이름이 비교
   *    모듈에 등장하지 않는다」로 썼는데 **FAIL** 했다 — `FIT`·`COMPOSITION`·`SET` 은
   *    이 Sprint 이전부터 `cross-seller.ts` 에 **이미 있던 축/충돌 이름** 이다(실측
   *    FIT 5 · COMPOSITION 2 · SET 1). 🟢 **코드가 맞고 내 단언이 틀렸다.**
   *
   * 🔴 그리고 그 이름 겹침은 「같은 말이 다른 것을 가리키는」 사고(`sellerDecision` 선례)와
   *    **다르다** — 여기서는 evidence `FIT` 과 matcher `FIT` 이 **같은 개념** 을 가리킨다.
   *    ⟹ 이름을 옮기지 않는다. 대신 **「승격되지 않았다」를 승격 «경로» 로** 잠근다.
   */
  it("계약 8-b — 🟡 관측 전용 축이 «승격되지 않았다»(비교 모듈이 추출기를 모른다)", () => {
    for (const f of COMPARATORS) {
      const code = readCrawler(f);
      expect(code).not.toContain("product-evidence");
      expect(code).not.toContain("extractProductEvidence");
      expect(code).not.toContain("attachProductEvidence");
    }
    /** 🔴 그리고 추출기도 비교 모듈을 **거꾸로 부르지 않는다**(양방향 잠금). */
    const evidenceCode = readCrawler("product-evidence.ts");
    for (const f of COMPARATORS) expect(evidenceCode).not.toContain(f.replace(/\.ts$/, '"'));
  });

  it("계약 8-c — 축 목록이 둘로 갈려 있고 겹치지 않는다", () => {
    const ident = new Set<string>(IDENTITY_EVIDENCE_AXES);
    for (const axis of PROBE_EVIDENCE_AXES) expect(ident.has(axis)).toBe(false);
    expect(IDENTITY_EVIDENCE_AXES).toHaveLength(6);
    expect(PROBE_EVIDENCE_AXES).toHaveLength(4);
  });

  it("계약 8-d — 추출기가 «판정 어휘» 를 만들지 않는다", () => {
    const code = readCrawler("product-evidence.ts");
    for (const word of ["SAME", "DIFFERENT", "PRESUMED_SAME", "CONFLICT", "priceTier", "matchTruth"]) {
      expect(code).not.toContain(word);
    }
  });
});
