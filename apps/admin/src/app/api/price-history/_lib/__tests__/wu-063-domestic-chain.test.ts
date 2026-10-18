import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  extractFromJsonLd,
  extractMicrodataFromHtml,
  isColorUnverified,
} from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-063 — **국내 가격 비교 E2E 전수 역추적** (조사 · 운영 동작 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **「국내 가격 비교가 약하다」는 하나의 문제가 아니다 — 셋이고 원인이 다르다.**
 * 국내/한국계 후보 **17건** 을 운영 분기 순서 그대로 흘려 보낸 결과:
 * ```
 * 국내 가격 버킷 진입   **5**  (전부 COMPARISON · **EXACT 0**)
 * 해외 축으로 감        **4**  (trenbe×3 USD · kihanan JPY) 🟢 올바른 판정이다
 * 🔴 버려짐             **8**
 *     ① KRW + market UNKNOWN  **4**  C08 C21 C22 C43  ← WU-051 가드(최대 회수 대상)
 *     ② 가격 증거 없음         **2**  C13 C27 (beaumonde) ← CPO HOLD
 *     ③ tier EXCLUDED          **2**  C28 C32 (luksusbaby) 🟢 올바른 차단
 * ```
 *
 * ── 🔴🔴 국내 EXACT 0 의 원인 = **색상 미확인** (MI 가 엄격해서가 아니다) ────
 * 국내 버킷 5건이 **전부** `verdict SIMILAR · modelCode **exact** · colorUnverified **true**` 다.
 * 그리고 후보 `colorText` 가 **전건 `null`** 이다 — **불일치가 아니라 추출 실패** 다.
 * ```
 * ⟹ 「국내 후보 페이지가 색상을 구조화해 노출하지 않는다」가 원인이고,
 *    MI threshold 나 SAME 조건과 **무관** 하다.
 * ```
 *
 * ── 🔴🔴 그리고 그 보호를 풀면 «순손실» 이다 (내 예측이 측정으로 반증됐다) ──
 * 색상 축만 제거했을 때 EXACT 로 올라가는 것은 **둘뿐이고 둘 다 Human DIFFERENT** 다
 * (C23 littleluna · C24 miniboutique · 둘 다 `modelCode exact` + `blockers []`).
 * 🔴 Human SAME 은 **한 건도** 회복되지 않는다 — C07·C15·C47 은 `NO_TITLE_OVERLAP`/
 *    `BRAND_MISMATCH` 가 `hasObservedDifference` 에 걸려 **색상과 무관하게** 막힌다.
 * ⟹ CF-4 는 **이득 0 · False EXACT +2** · **완화 기각**.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const GT = path.join(OUT, "wu-036-3way.json");
const CACHE = path.join(OUT, "wu-032-cache");
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);
const IDS: Record<string, string> = {
  S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
  S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
  S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
  S4: "c27d4727-2248-4fe0-9084-8c239737a889",
  S5: "32f7b651-29b9-4217-b8ce-46596f538306",
  S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
};
const IS_KOREAN_SAMPLE = (d: string) => /\.kr$/i.test(d) || /kihanan|biskuit|mustit|trenbe|luxboy|donokids/i.test(d);

type Row = ReturnType<typeof buildRow>;

function buildRow(r: Record<string, string>, origin: ReturnType<typeof productFactsFromIdentityDna>) {
  const cached = JSON.parse(readFileSync(path.join(CACHE, `${key(r.candidateUrl)}.facts.json`), "utf8")) as {
    fetchPath?: string;
    candidate?: { title?: string; facts?: Record<string, unknown> };
  };
  const cand = cached.candidate!.facts as Record<string, unknown>;
  const hp = path.join(CACHE, `${key(r.candidateUrl)}.html`);
  const html = existsSync(hp) ? readFileSync(hp, "utf8") : null;

  /** 🔴 운영 후보 경로와 **같은 두 층** — JSON-LD → microdata(WU-061 이 3층을 기각했다). */
  const priced = (html ? extractFromJsonLd(html)?.price ?? extractMicrodataFromHtml(html)?.price : null) ?? null;
  const currency = priced?.currency ?? null;
  const market = classifyCandidateMarket({ domain: r.domain, currency, isRegisteredDomesticShop: false });

  const cross = compareCrossSellerProducts(origin as never, cand as never) as {
    verdict: string;
    blockers?: { blocker: string }[];
    conflicts?: unknown[];
  };
  const oCode = origin.brandModelCode ?? null;
  const dCode = (cand.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
  const modelCode = compareModelCode(oCode, dCode ?? null);
  const colorUnverified = isColorUnverified(origin.colorText ?? null, (cand.colorText as string | null) ?? null);
  const blockers = (cross.blockers ?? []).map((b) => b.blocker);
  const truthWith = (cu: boolean) =>
    deriveMatchTruth("very_high", modelCode as never, cross.verdict as never, (cross.blockers ?? []) as never, (cross.conflicts ?? []) as never, cu);
  const tierOf = (t: string) => priceTierFromLink({ matchTruth: t, verified: false } as never);

  const tier = tierOf(truthWith(colorUnverified));
  const priceKrw = priced && String(currency).toUpperCase() === "KRW" ? priced.amount : null;

  /** 🔴 **운영 분기 순서 그대로**(market-intelligence.ts:226~325). 내가 지어내지 않는다. */
  let sink: "DOMESTIC" | "OVERSEAS" | "DROP_KRW_NO_KR_EVIDENCE" | "DROP_NO_PRICE" | "DROP_TIER";
  if (market.market !== "KR") {
    if (String(currency).toUpperCase() === "KRW") sink = "DROP_KRW_NO_KR_EVIDENCE";
    else if (priced != null) sink = "OVERSEAS";
    else sink = "DROP_NO_PRICE";
  } else if (priceKrw == null) sink = "DROP_NO_PRICE";
  else if (tier === "EXACT" || tier === "COMPARISON") sink = "DOMESTIC";
  else sink = "DROP_TIER";

  return {
    id: r.id, human: r.humanGt ?? null, domain: r.domain, shape: classifyUrlShape(r.candidateUrl),
    price: priced?.amount ?? null, currency, market: market.market, basis: market.basis,
    verdict: cross.verdict, blockers, modelCode, colorUnverified, tier, priceKrw, sink,
    /** CF-4 — 색상 축만 제거했을 때의 tier. */
    tierNoColor: tierOf(truthWith(false)),
  };
}

const ready = existsSync(GT) && existsSync(CACHE) && existsSync(path.join(OUT, "mi-017-e2e-cases.json"));
const t = ready ? it : it.skip;

function load(): Row[] {
  const rows = (JSON.parse(readFileSync(GT, "utf8")) as { rows: Record<string, string>[] }).rows;
  const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as { id: string; canonical_product: unknown }[];
  const origins: Record<string, ReturnType<typeof productFactsFromIdentityDna>> = {};
  for (const [sid, id] of Object.entries(IDS))
    origins[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product as never)));
  return rows
    .filter((r) => origins[r.searchId] && existsSync(path.join(CACHE, `${key(r.candidateUrl)}.facts.json`)))
    .map((r) => buildRow(r, origins[r.searchId]));
}

describe("WU-063 국내 체인 (GT 캐시 필요 · 없으면 skip)", () => {
  /* ════════ Step1 — 병목이 셋이고 원인이 다르다 ════════ */
  t("🔴 국내/한국계 17건의 종착지가 다섯으로 갈린다", () => {
    const kr = load().filter((x) => IS_KOREAN_SAMPLE(x.domain));
    expect(kr).toHaveLength(17);
    const by = (s: string) => kr.filter((x) => x.sink === s).map((x) => x.id);
    expect(by("DOMESTIC")).toEqual(["C07", "C15", "C23", "C24", "C47"]);
    expect(by("OVERSEAS")).toEqual(["C06", "C10", "C14", "C41"]);
    /** 🔴 최대 회수 대상 — KRW 인데 KR 증거가 없어 **양쪽 축 모두에서 빠진다**(WU-051). */
    expect(by("DROP_KRW_NO_KR_EVIDENCE")).toEqual(["C08", "C21", "C22", "C43"]);
    /** 🔴 beaumonde — 가격 증거 0 (CPO HOLD). */
    expect(by("DROP_NO_PRICE")).toEqual(["C13", "C27"]);
    /** 🟢 EXCLUDED 는 금액 버킷에 들어가지 않는다(올바른 차단). */
    expect(by("DROP_TIER")).toEqual(["C28", "C32"]);
  });

  /* ════════ Step5 — 국내 EXACT 0 의 원인은 «색상 미확인» ════════ */
  t("🔴🔴 국내 버킷 5건이 전부 colorUnverified 로 EXACT 를 못 넘는다", () => {
    const dom = load().filter((x) => x.sink === "DOMESTIC");
    expect(dom).toHaveLength(5);
    for (const x of dom) {
      expect(x.tier, x.id).toBe("COMPARISON");
      /** 🔴 품번은 **맞는다** — 막는 것은 품번이 아니다. */
      expect(x.modelCode, x.id).toBe("exact");
      /** 🔴 그리고 색상은 «불일치» 가 아니라 **미확인** 이다. */
      expect(x.colorUnverified, x.id).toBe(true);
    }
    expect(dom.filter((x) => x.tier === "EXACT")).toHaveLength(0);
  });

  /* ════════ Step6 CF-4 — 색상 완화는 즉시 False EXACT 를 만든다 ════════ */
  t("🔴🔴 CF-4(색상 축 제거) → 올라가는 것이 **Human DIFFERENT 2건뿐** 이다 (기각)", () => {
    const dom = load().filter((x) => x.sink === "DOMESTIC");
    const promoted = dom.filter((x) => x.tierNoColor === "EXACT");
    /**
     * 🔴🔴 **내 예측(5건 승격)이 측정으로 반증됐다 — 결과가 «더 나쁘다».**
     *    올라가는 것은 **둘뿐이고 둘 다 Human DIFFERENT** 다.
     *    C07·C15·C47(Human SAME)은 `NO_TITLE_OVERLAP`/`BRAND_MISMATCH` 가
     *    `hasObservedDifference` 에 걸려 **색상과 무관하게** 막힌다.
     * ⟹ CF-4 는 **이득 0 · False EXACT +2** 다. 교환이 아니라 **순손실** 이다.
     */
    expect(promoted.map((x) => x.id)).toEqual(["C23", "C24"]);
    expect(promoted.every((x) => x.human === "DIFFERENT")).toBe(true);
    /** 🔴 그 둘은 `blockers` 가 **비어 있다** — 색상 축이 유일한 방어다. */
    for (const x of promoted) expect(x.blockers, x.id).toEqual([]);
    /** 🟢 Human SAME 은 **한 건도** 회복되지 않는다. */
    expect(promoted.filter((x) => x.human === "SAME")).toHaveLength(0);
  });

  /* ════════ Step6 CF-2 — KR 증거 확대는 «같은 샵에서 갈린다» ════════ */
  t("🔴 CF-2(KR 증거 확대) — donokids 가 한 샵인데 페이지마다 갈린다", () => {
    const kr = load().filter((x) => IS_KOREAN_SAMPLE(x.domain));
    const dono = kr.filter((x) => x.domain === "donokids.com");
    expect(dono.map((x) => x.id)).toEqual(["C21", "C22", "C43"]);
    /** 🔴 셋 다 KRW 인데 셋 다 UNKNOWN 이다 — 현재는 **일관되게** 빠진다. */
    for (const x of dono) {
      expect(x.market, x.id).toBe("UNKNOWN");
      expect(x.basis, x.id).toBe("KRW_WITHOUT_DOMAIN_EVIDENCE");
      expect(String(x.currency).toUpperCase(), x.id).toBe("KRW");
    }
    /**
     * 🔴🔴 페이지 단위 KR 신호(사업자등록·통신판매신고·`lang="ko"`)는 **같은 샵 안에서
     *    흔들린다** — 실측: C21 ✓ · C22 ✓ · **C43 ✗**(세 신호 전부 없음).
     *    🟢 해외 34건에서 그 신호의 오탐은 **0** 이었다(정밀도는 좋다).
     *    🔴 그러나 같은 샵의 후보가 KR/UNKNOWN 으로 갈리면 집계가 페이지 운에 좌우된다.
     *    ⟹ **채택하지 않았다.** 이 단언은 그 근거(세 건이 같은 도메인)를 고정한다.
     */
    expect(new Set(dono.map((x) => x.domain)).size).toBe(1);
  });

  /* ════════ M2 — 통화 가드 (운영 함수 직접 호출) ════════ */
  it("🔴 KRW 가 아니면 국내 시장이 되지 않는다 (.kr 이어도 충돌로 처리한다)", () => {
    /** 🟢 `.kr` + KRW 일 때만 KR 이다. */
    expect(classifyCandidateMarket({ domain: "shop.kr", currency: "KRW", isRegisteredDomesticShop: false })).toEqual({
      market: "KR",
      basis: "KR_TLD_AND_KRW",
    });
    /** 🔴 `.kr` 인데 외화 → **충돌** 이다. 둘 중 하나를 고르지 않는다. */
    expect(classifyCandidateMarket({ domain: "shop.kr", currency: "USD", isRegisteredDomesticShop: false })).toEqual({
      market: "UNKNOWN",
      basis: "CONFLICT_KR_TLD_WITH_FOREIGN_CURRENCY",
    });
    /** 🔴 등록부 샵인데 외화 → 충돌(`bobochoses.com` 이 EUR 를 낸 실측 근거 · WU-019R). */
    expect(classifyCandidateMarket({ domain: "shop.com", currency: "EUR", isRegisteredDomesticShop: true })).toEqual({
      market: "UNKNOWN",
      basis: "CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY",
    });
    /** 🔴 통화 **단독** 으로 KR 을 만들지 않는다(CPO WU-020 §4). */
    expect(classifyCandidateMarket({ domain: "shop.com", currency: "KRW", isRegisteredDomesticShop: false })).toEqual({
      market: "UNKNOWN",
      basis: "KRW_WITHOUT_DOMAIN_EVIDENCE",
    });
    /** 🔴 통화가 없으면 **판정하지 않는다**(beaumonde 가 여기에 해당한다). */
    expect(classifyCandidateMarket({ domain: "shop.kr", currency: null, isRegisteredDomesticShop: false })).toEqual({
      market: "UNKNOWN",
      basis: "NO_PRICE_EVIDENCE",
    });
  });

  /* ════════ Step2 — 해외와의 단계별 차이 ════════ */
  t("🟢 상품페이지·가격 추출은 국내가 약하지 않다 — 갈리는 곳은 market 과 tier 다", () => {
    const all = load();
    const kr = all.filter((x) => IS_KOREAN_SAMPLE(x.domain));
    const ov = all.filter((x) => !IS_KOREAN_SAMPLE(x.domain));
    /** 🟢 C) 상품페이지 판별 — 양쪽 전건 통과. */
    expect(kr.every((x) => x.shape === "PRODUCT_PAGE")).toBe(true);
    expect(ov.every((x) => x.shape === "PRODUCT_PAGE")).toBe(true);
    /** 🟢 D) 가격 증거 — 국내 15/17 · 해외 34/34. 국내가 **거의 같다**. */
    expect(kr.filter((x) => x.price != null)).toHaveLength(15);
    expect(ov.filter((x) => x.price != null)).toHaveLength(34);
    /** 🔴 F) tier EXACT — 국내 **1**(해외 도메인 C06) · 해외 11. 여기서 갈린다. */
    expect(kr.filter((x) => x.tier === "EXACT").map((x) => x.id)).toEqual(["C06"]);
  });

  /* ════════ §12 — 국내 aggregate 계약 ════════ */
  t("🟢 국내 금액 버킷에 EXCLUDED/REFERENCE 가 들어가지 않는다", () => {
    const dom = load().filter((x) => x.sink === "DOMESTIC");
    for (const x of dom) expect(["EXACT", "COMPARISON"], x.id).toContain(x.tier);
    /**
     * 🔴 EXCLUDED 후보는 가격이 있어도 금액 버킷 밖이다.
     * 🔴 **분모를 한국계 표본으로 좁힌다** — 전수에는 `junioredition.com/en-kr` 처럼
     *    **KRW 를 내는 해외 도메인**(C26·C33)이 섞여 있고, 그들은 `DROP_TIER` 가 아니라
     *    **`DROP_KRW_NO_KR_EVIDENCE`** 로 빠진다(WU-051 가드가 먼저 걸린다).
     *    🟢 그 사실 자체가 「통화 단독 결정 금지」가 작동한다는 증거다.
     */
    const excluded = load().filter((x) => IS_KOREAN_SAMPLE(x.domain) && x.tier === "EXCLUDED" && x.priceKrw != null);
    expect(excluded.map((x) => x.id)).toEqual(["C28", "C32"]);
    for (const x of excluded) expect(x.sink, x.id).toBe("DROP_TIER");
    /** 🔴 KRW 를 내는 **해외** 도메인은 양쪽 축 모두에서 빠진다. */
    const krwOverseas = load().filter((x) => !IS_KOREAN_SAMPLE(x.domain) && String(x.currency).toUpperCase() === "KRW");
    for (const x of krwOverseas) expect(x.sink, `${x.id} ${x.domain}`).toBe("DROP_KRW_NO_KR_EVIDENCE");
  });
});
