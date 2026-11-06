/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-LIST-UI-01 GT13 — **CEO DIFFERENT 13건이 화면에서 갈리는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 지적(PHASE 5 보완 A): 「C19·C20·C22 만으로 13건 전체를 통과 처리하지 않는다」.
 *    그래서 **운영 DB 의 그 13행을 그대로** 넣고 전수로 마운트해 표시를 읽는다.
 *
 * 🔴 **GT 를 바꾸지 않았다** — 이 fixture 는 `candidate_reviews` 를 **읽어 적은 관측값**
 *    이고 `human_verdict` 는 분류 입력으로 **쓰지 않는다**(시스템 표시와 사람 판정은 다른 계층).
 *
 * 🔴🔴 **측정 한계를 먼저 적는다**:
 * ```
 * ⒜ `candidate_reviews.blockers` 는 **blockers + conflicts 를 합쳐** 저장한다
 *    (candidate-review.ts 의 writer). ⟹ 저장분으로는 둘을 **되가를 수 없다**.
 *    🟢 그래서 합친 배열을 양쪽에 넘긴다 — `resolveSellerDisplay` 는 보조 차이 토큰만
 *       골라 쓰고 `classifySellerProbability` 는 각 축의 토큰만 보므로 **해석이 보존된다**.
 * ⒝ `GT_IMPORT` 2건은 `blockers`·`match_truth`·`match_reasons` 가 **전부 null** 이다
 *    ⟹ 🔴 분류 입력이 **없다**. 「화면이 틀렸다」가 아니라 **측정불가** 다.
 *    (그 둘은 사람 라벨만 들고 들어온 행이다 — 시스템 판정 축이 기록되지 않았다)
 * ⒞ 13건 전부 `image_url` 이 **null** 이다(저장 시점에 후보 이미지를 담지 않았다).
 * ```
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeminiTransientCandidates, type GeminiTransientRow } from "../GeminiTransientCandidates";
import { classifySellerProbability, resolveSellerDisplay } from "../seller-probability";
import { splitEvidenceReasons } from "../blocker-text";

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

/** 🟢 운영 DB 실측(2026-11-06) — `human_verdict='DIFFERENT' AND system_verdict='PRESUMED_SAME'` 전수. */
const GT13: Array<{
  origin: string;
  domain: string;
  url: string;
  truth: string | null;
  blockers: string[] | null;
  reasons: string[] | null;
  source: string;
}> = [
  { origin: "B226AC009", domain: "cemarose.ca", url: "https://cemarose.ca/products/bobo-choses-kids-booty-ghosts-sweatshirt-light-blue-c7907", truth: null, blockers: null, reasons: null, source: "GT_IMPORT" },
  { origin: "B226AC009", domain: "tinyapple.net", url: "https://www.tinyapple.net/en-kr/products/bobo-choses-bobo-choses-pop-t-shirt-blue", truth: null, blockers: null, reasons: null, source: "GT_IMPORT" },
  { origin: "B226AC009", domain: "villagekids.co.uk", url: "https://villagekids.co.uk/products/pale-blue-3d-logo-t-shirt", truth: "TEXT_CONFIRMED", blockers: ["NO_TITLE_OVERLAP", "MATERIAL", "AUDIENCE_LINE", "BRAND_UNCONFIRMED"], reasons: null, source: "OVERSEAS_AUTO" },
  { origin: "B226AC033", domain: "designerkidswear.com", url: "https://designerkidswear.com/products/stone-island-junior-kids-boys-sweatshirt-blue-6100001-s0a20-v004b", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "MATERIAL"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 BLUE", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC033", domain: "folkberlin.com", url: "https://folkberlin.com/products/baby-sweatsuit-blue-moon-organic-cotton", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "MATERIAL", "AUDIENCE_LINE"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 BLUE", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC033", domain: "kidbizkid.com", url: "https://kidbizkid.com/products/hugo-boss-navy-zip-sweatshirt", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "COLOR_VARIANT", "NO_TITLE_OVERLAP", "MATERIAL", "AUDIENCE_LINE"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 BLUE", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC033", domain: "petitemaisonkids.com", url: "https://petitemaisonkids.com/products/maya-blue-cotton-sweater-top", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "MATERIAL", "AUDIENCE_LINE", "GARMENT_FORM"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 BLUE", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC033", domain: "shoppiccoliandco.com", url: "https://shoppiccoliandco.com/products/jude-navy-baby-boy-anchor-sweater", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "COLOR_VARIANT", "NO_TITLE_OVERLAP", "AUDIENCE_LINE"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 BLUE", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC110", domain: "designerkidswear.com", url: "https://designerkidswear.com/products/dolce-gabbana-kids-boys-dg-t-shirt-white-l4jthvg7nvc-s9000", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH"], reasons: ["근거: 핵심 상품명 일부 embossed", "근거: 상품군 TOP↔TOP", "근거: 소재 cotton:100", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC110", domain: "kidbizkid.com", url: "https://kidbizkid.com/products/marc-jacobs-black-t-shirt", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "AUDIENCE_LINE"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 소재 cotton:100", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC110", domain: "villagekids.co.uk", url: "https://villagekids.co.uk/products/white-multi-sequin-logo-crop-t-shirt", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP"], reasons: ["근거: 상품군 shirts", "근거: 소재 cotton:100", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC170", domain: "nickis.com", url: "https://nickis.com/products/levis-sweatshirt-rot-7401897725", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "MATERIAL"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 RED", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
  { origin: "B226AC170", domain: "shoppiccoliandco.com", url: "https://shoppiccoliandco.com/products/rudolph-knitted-sweater", truth: "TEXT_CONFIRMED", blockers: ["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "MATERIAL"], reasons: ["근거: 상품군 TOP↔TOP", "근거: 색상 RED", "근거: 대상 KIDS"], source: "OVERSEAS_AUTO" },
];

/** 🔴 분류 입력이 있는 행만 — `GT_IMPORT` 2건은 **측정불가** 다(위 ⒝). */
const MEASURABLE = GT13.filter((r) => r.blockers != null);

const toRow = (r: (typeof GT13)[number]): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: r.domain,
    title: r.domain,
    imageUrl: null,
    soldOut: null,
    discoveredUrl: r.url,
    matchTruth: r.truth,
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: null,
    matchReasons: r.reasons ?? [],
    /** 🔴 저장분은 blockers+conflicts 가 합쳐져 있다 — 양쪽에 같은 배열을 넘긴다(위 ⒜). */
    crossSellerBlockers: r.blockers ?? [],
    crossSellerConflicts: r.blockers ?? [],
    priceAmount: null,
    priceCurrency: null,
    priceKrw: null,
    priceStatus: null,
    market: "OVERSEAS",
    basis: null,
    verified: false,
    matchType: null,
  }) as unknown as GeminiTransientRow;

const displayOf = (r: (typeof GT13)[number]) =>
  resolveSellerDisplay({
    result: classifySellerProbability({
      crossSellerBlockers: r.blockers ?? [],
      crossSellerConflicts: r.blockers ?? [],
      matchTruth: r.truth,
      agreement: splitEvidenceReasons(r.reasons ?? []),
    }),
    conflicts: r.blockers ?? [],
    /** 🔴 13건 전부 후보 이미지가 없다(⒞) — 원본만 있으므로 `ONE_SIDE`. */
    imageEvidence: "ONE_SIDE",
  });

describe("GT13 A — 분모를 정직하게 가른다", () => {
  it("A-0 🔴 13건 중 분류 입력이 있는 것은 **11건** 이다(GT_IMPORT 2 는 측정불가)", () => {
    expect(GT13).toHaveLength(13);
    expect(MEASURABLE).toHaveLength(11);
    expect(GT13.filter((r) => r.source === "GT_IMPORT")).toHaveLength(2);
  });
});

describe("GT13 B — 🔴🔴 CEO DIFFERENT 가 「동일상품」으로 보이지 않는다", () => {
  /**
   * 🔴🔴 **이 파일의 존재 이유** — 이것이 깨지면 셀러가 **다른 상품을 동일상품으로 본다**.
   */
  it("B-1 🔴 11건 중 「동일상품 가능성 높음」이 **0건** 이다", () => {
    const same = MEASURABLE.filter((r) => displayOf(r).state === "LIKELY_SAME");
    expect(same.map((r) => `${r.origin}/${r.domain}`), "🔴 CEO DIFFERENT 가 동일상품으로 표시된다").toEqual([]);
  });

  it("B-2 🔴 「유사상품」으로 보이는 것도 **0건** 이다(핵심 일치가 아니다)", () => {
    const sim = MEASURABLE.filter((r) => displayOf(r).state === "LIKELY_SIMILAR");
    expect(sim.map((r) => `${r.origin}/${r.domain}`)).toEqual([]);
  });

  /** 🟢 실측 분포 — 브랜드 확정 불일치 10 + 근거 부족 1. */
  it("B-3 🟢 전부 「다른 상품일 수 있음」 또는 「검토 필요」 다", () => {
    const states = MEASURABLE.map((r) => displayOf(r).state);
    expect(new Set(states)).toEqual(new Set(["LIKELY_DIFFERENT", "NEEDS_REVIEW"]));
    expect(states.filter((s) => s === "LIKELY_DIFFERENT")).toHaveLength(10);
    expect(states.filter((s) => s === "NEEDS_REVIEW")).toHaveLength(1);
  });
});

describe("GT13 C — 마운트 DOM 전수(11행을 한 번에 그린다)", () => {
  it("C-1 🟢 11행 전부 표시 노드가 서고 「동일상품 가능성 높음」이 **없다**", () => {
    act(() => {
      root.render(
        createElement(GeminiTransientCandidates, {
          evidence: MEASURABLE.map(toRow),
          originImageUrl: "https://img.example/origin.jpg",
        }),
      );
    });
    const shown = [...container.querySelectorAll('[data-testid="gt-display-state"]')].map(
      (n) => n.textContent ?? "",
    );
    expect(shown).toHaveLength(11);
    expect(shown.filter((t) => t.includes("동일상품 가능성 높음")), "🔴 화면에서 동일상품으로 보인다").toEqual([]);
    expect(shown.filter((t) => t.includes("유사상품"))).toEqual([]);
    /** 🟢 그리고 사유가 **보이는 글자** 로 전부 선다. */
    expect(
      [...container.querySelectorAll('[data-testid="gt-display-reason"]')].filter((n) => (n.textContent ?? "").length > 0),
    ).toHaveLength(11);
  });

  /** 🔴 기존 MI 판정도 **같이** 보인다 — 덮지 않았다는 증거(11행 전수). */
  it("C-2 🔴 기존 판정 노드가 11행 전부에 **그대로** 있다", () => {
    act(() => {
      root.render(
        createElement(GeminiTransientCandidates, {
          evidence: MEASURABLE.map(toRow),
          originImageUrl: "https://img.example/origin.jpg",
        }),
      );
    });
    expect(container.querySelectorAll('[data-testid="gt-verdict"]')).toHaveLength(11);
  });
});
