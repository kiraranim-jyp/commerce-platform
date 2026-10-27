// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { explainEvidence } from "@commerce/crawler/src/comparison-search/evidence-explain";
import { attachProductEvidence } from "@commerce/crawler/src/comparison-search/product-evidence";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { QaEvidenceView, QaJudgmentPanel } from "@/app/qa/evidence/QaEvidenceView";
import { summarizeJudgmentReadiness } from "../judgment-readiness";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **TEST/QA X-Ray + 운영 UI 격리**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 WU 는 판단을 만들지 않는다.** L8~L10 이 그것을 잠근다 —
 *    Evidence 표시 기능이 matcher 에 **새 SAME shortcut 을 만들지 않는다**.
 *
 * ── 계약 지도(CPO §17) ──────────────────────────────────────────────────────
 * ```
 * L1 synonym 결과 표시      L2 한/영 의미 분석 표시     L3 T-shirt/Sweatshirt/Shirt 과동일화 금지
 * L4 Long/Short Sleeve 구분 L5 TITLE/DESCRIPTION 출처 유지  L6 기존 DESCRIPTION 추출 불변
 * L7 IMAGE Evidence 표시    L8 새 SAME shortcut 0       L9 C19/C20/C22/C50 불변
 * L10 C06/C27/C42 불변
 * ```
 */

const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
const APP = join(__dirname, "../../../../../");
const readCrawler = (f: string) => stripComments(readFileSync(join(CRAWLER, f), "utf8").replace(/\r\n/g, "\n"));

const facts = (over: Partial<ProductFacts>): ProductFacts =>
  attachProductEvidence({
    sourceUrl: "https://example.test/p",
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
    ...over,
  });

/** CEO 조서 C27 의 실제 상품명(한글 브랜드 + 시즌 + 형태 + 품번). */
const C27_TITLE = "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010";

describe("CORE-FINAL-VISUAL-01 §L1·L2 — 의미 분석이 TEST 화면에 표시된다", () => {
  const ex = explainEvidence(facts({ title: C27_TITLE }));

  it("L2 — 한글 상품명에서 브랜드·시즌·형태·품번을 구조로 읽는다", () => {
    expect(ex.titleStructure.brand?.value).toBe("Bobo Choses");
    expect(ex.titleStructure.season?.value).toBe("26FW");
    expect(ex.titleStructure.modelCode?.value).toBe("B226AC010");
    expect(ex.titleStructure.forms).toContain("SHIRT");
    /** 🔴 브랜드·시즌·품번을 걷어낸 **나머지** 가 상품명이다. */
    expect(ex.titleStructure.productName).toContain("Booty Ghosts");
  });

  it("L2-b — 한글 → 영문 대응이 표시된다", () => {
    expect(ex.language.hasKorean).toBe(true);
    const forms = ex.language.mappings.filter((m) => m.axis === "FORM");
    expect(forms.some((m) => m.from === "티셔츠" && m.to === "T-shirt")).toBe(true);
    expect(ex.language.mappings.some((m) => m.axis === "BRAND" && m.to === "Bobo Choses")).toBe(true);
  });

  it("L1 — synonym 묶음이 표시된다(T-shirt · Tee · 티셔츠)", () => {
    const shirt = ex.language.synonymGroups.find((g) => g.canonical === "SHIRT");
    expect(shirt).toBeDefined();
    expect(shirt!.matched).toContain("티셔츠");
    const tee = explainEvidence(facts({ title: "Bobo Choses Booty Ghosts Tee" })).language.synonymGroups.find(
      (g) => g.canonical === "SHIRT",
    );
    expect(tee?.matched).toContain("tee");
  });
});

describe("CORE-FINAL-VISUAL-01 §L3·L4 — 🔴 동의어가 «차이» 를 지우지 않는다", () => {
  it("L3 — T-shirt 와 Sweatshirt 는 같은 형태로 읽지 않는다", () => {
    const tee = explainEvidence(facts({ title: "Bobo Choses Booty Ghosts T-shirt" }));
    const sweat = explainEvidence(facts({ title: "Main Story Bubble Sweatshirt" }));
    expect(tee.titleStructure.forms).toContain("SHIRT");
    expect(sweat.titleStructure.forms).toContain("SWEATSHIRT");
    expect(tee.titleStructure.forms).not.toContain("SWEATSHIRT");
    expect(sweat.titleStructure.forms).not.toContain("SHIRT");
  });

  it("L3-b — Generic `Top` 을 SHIRT 로 승격하지 않는다", () => {
    const top = explainEvidence(facts({ title: "Bobo Choses Ribbed Top" }));
    expect(top.titleStructure.forms).toContain("TOP");
    expect(top.titleStructure.forms).not.toContain("SHIRT");
  });

  it("L3-c — 🔴 셔츠↔티셔츠를 같게 읽는 **기존 정책** 을 화면이 숨기지 않는다", () => {
    const ex = explainEvidence(facts({ title: "Bobo Choses Booty Ghosts T-shirt" }));
    expect(ex.caveats.some((c) => c.includes("셔츠와 티셔츠"))).toBe(true);
  });

  it("L4 — 긴팔 / 반팔이 갈린다(한글·영문 모두)", () => {
    expect(explainEvidence(facts({ title: C27_TITLE })).sleeve.kind).toBe("LONG");
    expect(explainEvidence(facts({ title: "Hug Hairy Monster Long Sleeve T-Shirt" })).sleeve.kind).toBe("LONG");
    expect(explainEvidence(facts({ title: "보보쇼즈 아동 반팔 티셔츠" })).sleeve.kind).toBe("SHORT");
    expect(explainEvidence(facts({ title: "Booty Ghosts Short Sleeve T-Shirt" })).sleeve.kind).toBe("SHORT");
    /** 🔴 원문이 말하지 않으면 **지어내지 않는다**. */
    expect(explainEvidence(facts({ title: "Booty Ghosts T-Shirt" })).sleeve.kind).toBeNull();
  });

  it("L4-b — 🔴 소매는 **관측값** 이고 판정 축이 아님을 화면이 말한다", () => {
    const ex = explainEvidence(facts({ title: C27_TITLE }));
    expect(ex.caveats.some((c) => c.includes("판정 축이 아닙니다"))).toBe(true);
  });
});

describe("CORE-FINAL-VISUAL-01 §L5·L6 — provenance 와 기존 추출이 유지된다", () => {
  const DESC =
    "Gender : Men Brand : BOBO CHOSES Product Name : Bobo Choses Kids Hug Hairy Monster Long Sleeve T-Shirt (Light Blue) B226AC009 451 160484657 [P] Color : Light Blue SKU : 26FW B226AC009 451 trenbe Code : 160484657";

  it("L5 — TITLE 과 DESCRIPTION 출처가 유지된다", () => {
    const ex = explainEvidence(facts({ title: "Bobo Choses T-shirt B226AC010", description: DESC }));
    const code = ex.evidence.find((e) => e.axis === "MODEL_CODE")!;
    expect(code.values.some((v) => v.source === "TITLE" && v.value === "B226AC010")).toBe(true);
    expect(code.values.some((v) => v.source === "DESCRIPTION" && v.value === "B226AC009")).toBe(true);
  });

  it("L5-b — 🔴 설명문에서 **복구된** 품번이 상품명 품번과 구분된다", () => {
    const ex = explainEvidence(facts({ title: "Bobo Choses T-shirt B226AC010", description: DESC }));
    const code = ex.evidence.find((e) => e.axis === "MODEL_CODE")!;
    const recovered = code.values.find((v) => v.source === "DESCRIPTION" && v.value === "B226AC009");
    expect(recovered?.recovered).toBe(true);
    /** 상품명에도 있던 값은 **복구가 아니다**. */
    const both = explainEvidence(facts({ title: "B226AC009 tee", description: DESC }))
      .evidence.find((e) => e.axis === "MODEL_CODE")!
      .values.find((v) => v.source === "DESCRIPTION");
    expect(both?.recovered).toBe(false);
  });

  it("L6 — 기존 DESCRIPTION Evidence 추출이 깨지지 않는다", () => {
    const ex = explainEvidence(facts({ title: "x", description: DESC }));
    const get = (axis: string) => ex.evidence.find((e) => e.axis === axis)!.values.map((v) => v.value);
    expect(get("BRAND")).toContain("BOBO CHOSES");
    expect(get("COLOR")).toContain("Light Blue");
    expect(get("PRODUCT_NAME").some((v) => v.includes("Hug Hairy Monster"))).toBe(true);
  });

  it("L6-b — 모든 Identity 축과 관측 전용 축이 화면 목록에 존재한다", () => {
    const ex = explainEvidence(facts({ title: "x", description: DESC }));
    const axes = ex.evidence.map((e) => e.axis);
    for (const a of ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM", "COLOR", "MATERIAL"]) {
      expect(axes).toContain(a);
    }
    for (const a of ["FIT", "COMPOSITION", "SET", "OPTION_SKU", "IMAGE"]) expect(axes).toContain(a);
    expect(ex.evidence.find((e) => e.axis === "FIT")!.probeOnly).toBe(true);
    expect(ex.evidence.find((e) => e.axis === "BRAND")!.probeOnly).toBe(false);
  });
});

describe("CORE-FINAL-VISUAL-01 §L7 — IMAGE Evidence 가 표시된다", () => {
  const IMG = "https://cdn.test/rep.jpg";

  it("L7 — 이미지 개수 · 대표 이미지가 설명에 들어간다", () => {
    const ex = explainEvidence(facts({ title: "x", imageUrls: [IMG, "https://cdn.test/2.jpg"] }));
    expect(ex.image.count).toBe(2);
    expect(ex.image.representative).toBe(IMG);
    expect(ex.image.normalized).toBe(false);
  });

  it("L7-b — 이미지가 없으면 **없다고** 적는다(결함으로 적지 않는다)", () => {
    const ex = explainEvidence(facts({ title: "x" }));
    expect(ex.image.count).toBe(0);
    expect(ex.image.representative).toBeNull();
    expect(ex.caveats.some((c) => c.includes("공급 상태"))).toBe(true);
  });
});

describe("CORE-FINAL-VISUAL-01 §L8·L9·L10 — 🔴🔴 판단이 한 글자도 바뀌지 않는다", () => {
  it("L8 — 설명기는 matcher 에 연결돼 있지 않다(양방향)", () => {
    for (const f of ["cross-seller.ts", "match-truth.ts", "model-code.ts"]) {
      const code = readCrawler(f);
      expect(code).not.toContain("evidence-explain");
      expect(code).not.toContain("explainEvidence");
      expect(code).not.toContain("synonym");
    }
    const explain = readCrawler("evidence-explain.ts");
    /** 🔴 설명기가 판정 함수를 부르지도 않는다. */
    for (const w of ["compareCrossSellerProducts", "deriveMatchTruth", "priceTierFromLink"]) {
      expect(explain).not.toContain(w);
    }
  });

  it("L8-b — GT 33 전수 verdict · tier 가 불변이다", () => {
    for (const p of SAME05_PAIRS) {
      const before = same05Judge(p.origin, p.facts);
      const withEvidence = attachProductEvidence(p.facts);
      /** 설명을 만들어 본 뒤에도 판정이 같아야 한다(설명기는 facts 를 바꾸지 않는다). */
      explainEvidence(withEvidence);
      const after = same05Judge(p.origin, withEvidence);
      expect({ v: String(after.cross.verdict), t: after.tier }).toEqual({
        v: String(before.cross.verdict),
        t: before.tier,
      });
    }
  });

  it("L9 — C19 · C20 · C22 · C50 이 SAME 이 아니다", () => {
    for (const id of ["C19", "C20", "C22", "C50"]) {
      const p = SAME05_PAIRS.find((x) => x.id === id)!;
      expect(p.human).toBe("DIFFERENT");
      expect(String(same05Judge(p.origin, attachProductEvidence(p.facts)).cross.verdict)).not.toBe("SAME");
    }
  });

  it("L10 — C06 · C27 · C42 의 human 라벨과 기준선이 유지된다", () => {
    for (const id of ["C06", "C27", "C42"]) {
      expect(SAME05_PAIRS.find((x) => x.id === id)!.human).toBe("SAME");
    }
    const t = same05Tally((p) => same05Judge(p.origin, attachProductEvidence(p.facts)).cross.verdict);
    expect(t.gtSame).toBe(SAME05_BASELINE.same);
    expect(t.gtDifferent).toBe(SAME05_BASELINE.different);
    expect(t.falsePositive).toBe(SAME05_BASELINE.fp);
    expect(`${t.truePositive}/${t.gtSame}`).toBe(SAME05_BASELINE.samePrecision);
  });
});

describe("CORE-FINAL-VISUAL-01 §격리 — 운영 UI 에 내부 Evidence 가 없다", () => {
  /** 🔴 QA 화면 **밖** 의 모든 운영 화면 소스를 전수로 훑는다. */
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__" || name === "node_modules" || name === "qa") continue;
        walk(full, out);
      } else if (name.endsWith(".tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  it("격리-1 — 운영 화면(.tsx)이 QA 모듈을 import 하지 않는다", () => {
    const files = walk(join(APP, "app"));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
      for (const forbidden of ["evidence-explain", "explainEvidence", "QaEvidenceView", "/api/qa/"]) {
        expect(code, `${f} 가 ${forbidden} 를 쓴다`).not.toContain(forbidden);
      }
    }
  });

  it("격리-2 — 🔴 운영 화면에 내부 어휘가 새로 노출되지 않는다", () => {
    const files = walk(join(APP, "app"));
    /**
     * 🔴 **이 Sprint 가 만든 내부 어휘** 만 센다 — 운영 화면에 **새로** 나타나면 안 된다(CPO §6).
     *
     * 🔴🔴 **내 1차 단언이 틀렸고 그것을 적는다** — 금지어에 `provenance` 를 넣었더니
     *    `AIContentPanel.tsx` 가 FAIL 했다. 그 파일의 `ProvenanceBadge`(`./provenance`)는
     *    **이 Sprint 이전부터 있던 «AI 콘텐츠 출처» 배지** 이고 Evidence provenance 와
     *    **다른 개념** 이다(내가 건드린 적이 없다). 🟢 코드가 맞고 단언이 틀렸다 ⟹
     *    금지어를 **이 Sprint 의 식별자** 로 좁혔다(느슨하게 한 것이 아니라 **정확하게** 했다).
     */
    for (const f of files) {
      const code = stripComments(readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
      for (const forbidden of [
        "normalizedDHash",
        "VisualSignature",
        "computeVisualSignature",
        "synonymGroups",
        "titleStructure",
        "EvidenceExplanation",
        "probeOnly",
      ]) {
        expect(code, `${f} 가 ${forbidden} 를 노출한다`).not.toContain(forbidden);
      }
    }
  });

  it("격리-3 — QA 화면은 그 정보를 **보여준다**(격리가 「삭제」가 아니다)", () => {
    const qa = stripComments(
      readFileSync(join(APP, "app/qa/evidence/QaEvidenceView.tsx"), "utf8").replace(/\r\n/g, "\n"),
    );
    expect(qa).toContain("qa-synonym-groups");
    expect(qa).toContain("qa-language-mappings");
    expect(qa).toContain("source:");
  });
});

describe("CORE-FINAL-VISUAL-01 §READY/LIMITED/HOLD — 기존 결과를 «읽기만» 한다", () => {
  const base = {
    identityVerdict: "SAME",
    priceTier: "EXACT",
    domesticReferenceCount: 2,
    domesticLowestKrw: 88000,
    overseasLowest: { amount: 37, currency: "GBP" },
    sellerFacingVerdict: "RECOMMENDED",
    recommendedPriceKrw: 120000,
  };

  it("전부 값이 있으면 READY 이고 이유가 비어 있다", () => {
    const r = summarizeJudgmentReadiness(base);
    expect(r.state).toBe("READY");
    expect(r.reasons).toHaveLength(0);
  });

  it("🔴 PRESUMED_SAME 은 LIMITED 이고 **이유를 적는다**", () => {
    const r = summarizeJudgmentReadiness({ ...base, identityVerdict: "PRESUMED_SAME" });
    expect(r.state).toBe("LIMITED");
    expect(r.reasons.join(" ")).toContain("보류");
  });

  it("🔴 국내 후보가 없으면 HOLD 이고 그 이유가 화면에 남는다", () => {
    const r = summarizeJudgmentReadiness({ ...base, domesticReferenceCount: 0, domesticLowestKrw: null });
    expect(r.state).toBe("HOLD");
    expect(r.reasons.join(" ")).toContain("국내 비교 후보 부족");
  });

  it("🔴 READY 가 아니면 이유가 **반드시** 있다(빈 HOLD 금지)", () => {
    for (const over of [
      { identityVerdict: "UNKNOWN" },
      { overseasLowest: null },
      { sellerFacingVerdict: null },
      { recommendedPriceKrw: null },
    ] as const) {
      const r = summarizeJudgmentReadiness({ ...base, ...over });
      expect(r.state).not.toBe("READY");
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });

  it("🔴 분류기는 값을 «만들지» 않는다 — 환산/추정 어휘가 소스에 없다", () => {
    const code = stripComments(
      readFileSync(join(__dirname, "../judgment-readiness.ts"), "utf8").replace(/\r\n/g, "\n"),
    );
    for (const w of ["exchangeRate", "convertToKrw", "Math.round", "estimate", "computePrice"]) {
      expect(code).not.toContain(w);
    }
  });
});

describe("CORE-FINAL-VISUAL-01 §마운트 DOM — 화면이 실제로 그린다", () => {
  /** 🔴 소스 문자열이 아니라 **마운트한 DOM** 으로만 화면을 선언한다(헌장 §5). */
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  const at = (id: string): string =>
    container.querySelector('[data-testid="' + id + '"]')?.textContent ?? "";

  it("HOLD 면 «이유» 가 화면에 실제로 렌더된다", () => {
    const r = summarizeJudgmentReadiness({
      identityVerdict: "SAME",
      priceTier: "EXACT",
      domesticReferenceCount: 0,
      domesticLowestKrw: null,
      overseasLowest: { amount: 37, currency: "GBP" },
      sellerFacingVerdict: "CONDITIONAL",
      recommendedPriceKrw: 100,
    });
    act(() => root.render(createElement(QaJudgmentPanel, { judgment: r })));
    expect(at("qa-readiness-state")).toContain("HOLD");
    expect(at("qa-hold-reasons")).toContain("국내 비교 후보 부족");
  });

  it("Evidence 화면이 원문 · 구조 · 의미 · 축 · 이미지 · 한계를 전부 그린다", () => {
    const ex = explainEvidence(
      facts({
        title: C27_TITLE,
        description: "Brand : BOBO CHOSES Color : Light Blue 100% Organic Cotton B226AC009",
        imageUrls: ["https://cdn.test/rep.jpg"],
      }),
    );
    act(() => root.render(createElement(QaEvidenceView, { explanation: ex })));
    expect(at("qa-raw-title")).toContain("Booty Ghosts");
    expect(at("qa-structure-brand")).toContain("Bobo Choses");
    expect(at("qa-structure-season")).toContain("26FW");
    expect(at("qa-structure-sleeve")).toContain("LONG");
    /** 🔴 소매가 판정 축이 아니라는 사실이 **화면에** 있어야 한다. */
    expect(at("qa-structure-sleeve")).toContain("판정 축 아님");
    expect(at("qa-language-mappings")).toContain("티셔츠");
    expect(at("qa-synonym-SHIRT")).toContain("티셔츠");
    expect(at("qa-axis-MODEL_CODE")).toContain("source:");
    expect(at("qa-image-summary")).toContain("1장");
    expect(at("qa-caveats")).toContain("표시 전용");
  });
});
