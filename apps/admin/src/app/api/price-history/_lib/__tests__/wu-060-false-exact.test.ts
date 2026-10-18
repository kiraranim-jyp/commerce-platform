import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  isColorUnverified,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-060 — **C06 False EXACT 의 원인 확정** (조사 · 운영 동작 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **결론을 먼저 적는다 — C06 은 「게이트가 놓친 것」이 아니다.**
 * 우리가 읽을 수 있는 **모든 축이 동일상품이라고 말한다**. 후보 페이지가 스스로
 * 원상품과 **같은 품번(B226AC009)** 과 **같은 색상명(Light Blue)** 을 적는다.
 * 사람은 **눈으로** 다른 색을 봤다(`humanReason: "컬러가 다름"`).
 * ⟹ 🔴 **텍스트 축에 신호가 없다.** 막을 수 있는 유일한 축은 **이미지** 다(Vision · 금지 영역).
 *
 * ── 🔴 그리고 C05 ↔ C06 은 같은 원상품(S2)의 두 후보다 ──────────────────────
 * ```
 * C05 tinyapple.net      Human **SAME**       colorText "shirt light blue"  code unavailable  → EXACT
 * C06 global.trenbe.com  Human **DIFFERENT**  colorText "shirt light blue"  code **exact**    → EXACT
 * ```
 * 🔴 `colorText` 가 **글자 그대로 같다.** 그리고 **틀린 쪽(C06)이 증거가 «더» 많다**
 *    (품번 exact · 원상품 설명문의 "long sleeves" 토큰까지 일치).
 *
 * ── 🔴🔴 보호조건 후보 6개를 전수로 쟀다 — 전부 «프록시» 였다 ───────────────
 * 현행 EXACT 12 = Human SAME 11 + DIFFERENT 1(C06) 위에서:
 * ```
 * P1 후보 sizeLabels 부재 → 금지     차단 1(C06) · SAME 손실 **0**   🟡 그러나 인과 없음
 * P2 후보 materialText 부재 → 금지   차단 1(C06) · SAME 손실 **0**   🔴 쓰레기를 보상한다
 * P3 categoryText 가 상품군 아니면   차단 2 · SAME 손실 1(C42)       🔴 틀린 값을 통과시킨다
 * P4 colorText 완전일치 요구         차단 5 · SAME 손실 **4**        🔴 못 가른다(C05 도 걸린다)
 * P5 구조화 brandModelCode 요구      차단 5 · SAME 손실 **4**        🔴 못 가른다
 * P6 사이즈 교집합 0 → 금지          차단 3 · SAME 손실 2            🟡 인과 없음
 * ```
 * 🔴 **P2·P3 의 실체가 실측으로 드러났다**:
 * ```
 * C05(통과) materialText = "Tinyapple | FW26 Bobo Choses | Hug Hairy Monster T-shirt…"
 *           🔴 **소재가 아니다** — 제목/브레드크럼 덤프다
 *           categoryText = "Cardigans and Sweaters"  🔴 **티셔츠인데 가디건** 이다(틀렸다)
 * C42(SAME) categoryText = **null** → P3 가 **진짜 동일상품을 차단한다**
 * ```
 * ⟹ 🔴🔴 **분모가 1 이라서 보호조건을 «고를» 수 없다**(§5-B). 차단에 성공하는 셋은
 *    전부 **「데이터 풍부도」 프록시** 이고 상품 동일성과 **인과가 없다**. 그래서
 *    **하나도 구현하지 않았다.** 이 파일은 그 사실을 계약으로 고정한다.
 */

const FX = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "wu-059-gt-facts.json"), "utf8"),
) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<
    string,
    {
      searchId: string;
      domain: string;
      url: string;
      humanGt: string | null;
      humanReason: string | null;
      title: string | null;
      priceStatus: string | null;
      price: unknown;
      facts: Record<string, unknown>;
    }
  >;
};

const originOf = (sid: string) =>
  productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(FX.origins[sid].canonicalProduct as never)));

/** 🔴 운영 두 호출부와 **같은 6인자** 다. 게이트를 재구현하지 않는다. */
function judge(id: string, override?: { verdict?: string; blockers?: { blocker: string }[]; colorUnverified?: boolean }) {
  const c = FX.candidates[id];
  const origin = originOf(c.searchId);
  const cand = c.facts;
  const cross = compareCrossSellerProducts(origin as never, cand as never) as {
    verdict: string;
    blockers?: { blocker: string }[];
    conflicts?: unknown[];
    axes?: { axis: string; points: number; detail: string }[];
  };
  const oCode = origin.brandModelCode ?? null;
  const dCode = (cand.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: c.title ?? "", url: c.url });
  const modelCode = compareModelCode(oCode, dCode ?? null);
  const colorUnverified = override?.colorUnverified ?? isColorUnverified(origin.colorText ?? null, (cand.colorText as string | null) ?? null);
  const truth = deriveMatchTruth(
    "very_high",
    modelCode as never,
    (override?.verdict ?? cross.verdict) as never,
    (override?.blockers ?? cross.blockers ?? []) as never,
    (cross.conflicts ?? []) as never,
    colorUnverified,
  );
  return {
    human: c.humanGt,
    reason: c.humanReason,
    verdict: cross.verdict,
    axes: cross.axes ?? [],
    blockers: (cross.blockers ?? []).map((b) => b.blocker),
    modelCode,
    colorUnverified,
    truth,
    tier: priceTierFromLink({ matchTruth: truth, verified: false } as never),
    origin,
    cand,
  };
}

/* ════════ ① C06 — 모든 읽을 수 있는 축이 일치한다 ════════ */

describe("① C06 원인 확정", () => {
  it("🔴 다섯 축이 전부 일치하고 blockers 가 0 이다 (게이트가 놓친 것이 아니다)", () => {
    const r = judge("C06");
    expect(r.human).toBe("DIFFERENT");
    expect(r.reason).toBe("컬러가 다름");
    expect(r.verdict).toBe("SAME");
    expect(r.blockers).toEqual([]);
    expect(r.modelCode).toBe("exact");
    /** 🔴 후보 페이지가 **스스로** 원상품과 같은 색상명을 적는다 → 색상 축이 «일치» 로 센다. */
    expect(r.colorUnverified).toBe(false);
    expect(r.axes.map((a) => a.axis).sort()).toEqual(["AUDIENCE", "CATEGORY", "COLOR", "MODEL_CODE", "TITLE"]);
    expect(r.truth).toBe("EXACT_IDENTIFIER");
    expect(r.tier).toBe("EXACT");
  });

  /** 🔴🔴 같은 원상품의 C05(Human SAME)와 **색상 텍스트가 글자 그대로 같다**. */
  it("🔴🔴 C05(SAME) 과 colorText 가 동일하다 — 텍스트로 가를 신호가 없다", () => {
    const a = judge("C05");
    const b = judge("C06");
    expect(a.human).toBe("SAME");
    expect(b.human).toBe("DIFFERENT");
    expect(a.cand.colorText).toBe(b.cand.colorText);
    expect(a.cand.colorText).toBe("shirt light blue");
    expect(a.tier).toBe("EXACT");
    expect(b.tier).toBe("EXACT");
    /** 🔴 그리고 **틀린 쪽이 식별자 증거가 «더» 많다.** */
    expect(a.modelCode).toBe("unavailable");
    expect(b.modelCode).toBe("exact");
  });

  /**
   * 🔴 보호조건 후보가 통과 근거로 쓰는 값이 **쓰레기** 라는 사실을 고정한다.
   *    이 단언이 깨지는 날은 추출기가 좋아진 날이고, 그때 P2/P3 를 다시 평가해야 한다.
   */
  it("🔴 P2/P3 는 쓰레기 값을 보상한다 (C05 의 소재/카테고리가 둘 다 오염돼 있다)", () => {
    const c05 = FX.candidates.C05.facts;
    /** 🔴 소재 칸에 제목/브레드크럼 덤프가 들어 있다. */
    expect(String(c05.materialText ?? "")).toContain("Tinyapple");
    /** 🔴 티셔츠인데 카테고리가 「Cardigans and Sweaters」다. */
    expect(c05.categoryText).toBe("Cardigans and Sweaters");
    /** 🔴 그리고 진짜 동일상품 C42 는 카테고리가 **null** 이라 P3 가 그것을 차단한다. */
    expect(FX.candidates.C42.facts.categoryText).toBeNull();
    expect(FX.candidates.C42.humanGt).toBe("SAME");
  });
});

/* ════════ ⑤ CF-3 에서 품번 재사용이 어떻게 보호되는가 ════════ */

describe("⑤ 품번 재사용 사례의 보호 메커니즘", () => {
  const solo = (b: string[]) => b.length === 1 && b[0] === "BRAND_UNCONFIRMED";

  /** 🟢 junioredition 재사용 2건은 `SAME_SELLER_DISTINCT_LISTING` 이 **단독 조건을 깬다**. */
  it.each([["C19"], ["C20"]])("🟢 %s — 같은 판매처가 둘로 진열 → CF-3 조건 밖", (id) => {
    const r = judge(id);
    expect(r.human).toBe("DIFFERENT");
    expect(r.modelCode).toBe("exact");
    expect(r.blockers).toContain("SAME_SELLER_DISTINCT_LISTING");
    expect(solo(r.blockers)).toBe(false);
    expect(r.tier).not.toBe("EXACT");
  });

  /**
   * 🔴🔴 **C22 는 CF-3 조건을 «충족한다»** — blockers 단독 + 품번 exact.
   *    그런데 막힌다. 막는 것은 **색상 축 하나** 다.
   * 🔴 그리고 그 색상 축이 작동한 이유가 **「색이 다르다」가 아니라 「후보 색상 추출이
   *    실패했다」** 다 — `colorText === null` 이라 `isColorUnverified` 가 참이 됐다.
   *    제목에는 `Conker Stripe` 가 있는데 추출되지 않았다.
   */
  it("🔴🔴 C22 — CF-3 조건을 충족하지만 «색상 축» 하나가 막는다", () => {
    const r = judge("C22");
    expect(r.human).toBe("DIFFERENT");
    expect(r.modelCode).toBe("exact");
    expect(solo(r.blockers)).toBe(true);
    expect(r.colorUnverified).toBe(true);
    expect(r.cand.colorText).toBeNull();
    expect(String(r.cand.title ?? FX.candidates.C22.title)).toContain("Conker Stripe");
    expect(r.tier).not.toBe("EXACT");

    /** 🔴 색상 축을 빼면 **False EXACT 가 된다** — 그것이 이 방어의 전부라는 증거다. */
    const without = judge("C22", { verdict: "SAME", blockers: [], colorUnverified: false });
    expect(without.tier).toBe("EXACT");
  });
});

/* ════════ ⑥ 국내 EXACT → price_alerts 체인 ════════ */

describe("⑥ 국내 축 → 알림 체인", () => {
  /**
   * 🔴🔴 CF-3 이 승격시키는 5건 중 **국내 축 자격은 0** 이다. 막는 것이 둘로 갈린다:
   * ```
   * C11 C37 C48   해외 도메인          → 시장 게이트
   * C14           kihanan.com(.kr 아님 · 등록부 아님) → 시장 게이트
   * C27           beaumonde.co.kr(.kr) → 🔴 **가격 게이트**(priceStatus PRICE_UNAVAILABLE)
   * ```
   * ⟹ 🟢 **CF-3 만 열어도 알림 경로는 열리지 않는다.** 가격 추출(§2 HOLD)이 함께 필요하다.
   */
  it("🔴 CF-3 승격 5건 중 국내(KR) 시장 자격이 0 이다", () => {
    for (const id of ["C11", "C14", "C27", "C37", "C48"]) {
      const c = FX.candidates[id];
      /** 🔴 운영 owner 를 그대로 부른다 — 통화 증거가 없으면 **UNKNOWN** 이다(통화 단독 결정 금지). */
      const m = classifyCandidateMarket({
        domain: c.domain,
        currency: null,
        isRegisteredDomesticShop: false,
      });
      expect(m.market, `${id} ${c.domain}`).not.toBe("KR");
    }
  });

  /** 🔴 국내 TLD 인 유일한 후보(C27)는 **가격** 에서 막힌다 — §2 가 HOLD 한 그 이유다. */
  it("🔴 C27(.kr)은 가격 게이트에서 막힌다", () => {
    const c = FX.candidates.C27;
    expect(c.domain.endsWith(".kr")).toBe(true);
    expect(c.priceStatus).toBe("PRICE_UNAVAILABLE");
    expect(c.price).toBeNull();
  });

  /** 🟢 그리고 국내 축 진입 조건이 코드에 그대로 있다(가격 + 통화). */
  it("🟢 국내 축 진입이 VERIFIED_CURRENT && KRW 를 요구한다", () => {
    const runner = readFileSync(path.join(__dirname, "..", "run-domestic-price-check.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(runner).toContain('priceStatus === "VERIFIED_CURRENT"');
    expect(runner).toContain('"KRW"');
  });
});
