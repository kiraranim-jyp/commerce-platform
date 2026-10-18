import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
import { summarizeCandidateOverseasPrices } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-059 — **남은 경계 넷을 «계약» 으로 잠근다** (동작 변화 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 완화하지 않는다. WU-059 가 측정으로 확정한 **현재 경계** 를 고정해서
 *    누가 조용히 바꾸면 **여기서 깨지게** 만드는 것이 목적이다.
 *
 * ── 🔴🔴 §1 이 WU-057 을 정정한다 ────────────────────────────────────────────
 * WU-057 은 「품번 O 그룹에 Human DIFFERENT 가 0 → **FP 분모가 없다**」고 적었다.
 * 🔴 **그 분모 설정이 좁았다.** 완화는 «게이트» 단위로 적용되므로 분모도 게이트
 *    단위여야 한다 — `BRAND_UNCONFIRMED` **단독** 군이다. 그 군에는 Human
 *    DIFFERENT 가 **있고**, 완화하면 **실제로 False SAME 이 2건 생긴다**(C50·C51).
 *
 * GT 51 전수(SAME 27 · DIFFERENT 23) · `deriveMatchTruth`+`priceTierFromLink` 로 측정:
 * ```
 * 현행       EXACT 12 | SAME 11 · DIFFERENT  1      (🔴 기존 False EXACT 1건 = C06)
 * CF-1 전면  EXACT 28 | SAME 19 · DIFFERENT  9      False SAME **+8** 🔴 기각
 * CF-2 수술  EXACT 19 | SAME 16 · DIFFERENT  3      False SAME **+2** 🔴 기각
 * CF-3 품번  EXACT 17 | SAME 16 · DIFFERENT  1      False SAME **+0** 🟡 정책 판정
 * 🔴 level=very_high / low 결과가 **동일** 하다 — tier 는 level 과 무관하다(식별자 경로).
 * ```
 * 🔴 **CF-3 도 구현하지 않았다.** 측정 FP 0 은 「FP 가 없다」가 아니다 —
 *    같은 품번을 여러 상품에 쓰는 샵의 **다른 리스팅을 우리가 보지 못한 경우** 를
 *    이 표본이 담고 있지 않다(C19·C20 은 **둘 다 관측돼서** 막혔다). CPO 판정 사안.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const GT = path.join(OUT, "wu-036-3way.json");
const CACHE = path.join(OUT, "wu-032-cache");
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/**
 * 🔴🔴 **입력을 손으로 만들지 않는다.** 직전 시도에서 `productFactsFromListing` 로
 *    제목만 주고 facts 를 «재구성» 했더니 C27 verdict 가 실제 `PRESUMED_SAME` 이 아니라
 *    `SIMILAR` 로 나왔다 — 축(색상·소재·상품군·토큰)이 모자란 **더 깨끗한** 입력이었다.
 *    🟢 그래서 GT 캐시의 **실측 facts 를 fixture 로 커밋** 했다(「fixture 는 더럽게 만든다」).
 */
const FX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<string, { searchId: string; domain: string; url: string; humanGt: string | null; title: string | null; facts: Record<string, unknown> }>;
};

const originOf = (sid: string) =>
  productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(FX.origins[sid].canonicalProduct as never)));

/** 🔴 운영 두 호출부(`attachMatchTruth` · `decideCandidateEvidence`)와 **같은 6인자** 다. */
function judge(candId: string, level: "very_high" | "low" = "very_high") {
  const c = FX.candidates[candId];
  const origin = originOf(c.searchId);
  const cand = c.facts;
  const cross = compareCrossSellerProducts(origin as never, cand as never) as {
    verdict: string;
    blockers?: { blocker: string }[];
    conflicts?: unknown[];
  };
  const oCode = origin.brandModelCode ?? null;
  const dCode = (cand.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: c.title ?? "", url: c.url });
  const modelCode = compareModelCode(oCode, dCode ?? null);
  const truth = deriveMatchTruth(
    level,
    modelCode as never,
    cross.verdict as never,
    (cross.blockers ?? []) as never,
    (cross.conflicts ?? []) as never,
    isColorUnverified(origin.colorText ?? null, (cand.colorText as string | null) ?? null),
  );
  return {
    human: c.humanGt,
    verdict: cross.verdict,
    blockers: (cross.blockers ?? []).map((b) => b.blocker),
    modelCode,
    truth,
    tier: priceTierFromLink({ matchTruth: truth, verified: false } as never),
  };
}

/* ════════ §1  EXACT 게이트 — 막는 것은 「PRESUMED_SAME 보류」다 ════════ */

describe("§1 EXACT 게이트", () => {
  /**
   * 🔴🔴 헌장 §12 병목 ① 의 문장을 정정한다 — 「`BRAND_UNCONFIRMED` 가 남는다」는
   *    **증상** 이고, EXACT 를 실제로 막는 코드는 `match-truth.ts:233·237` 의
   *    `crossSellerReserved`(verdict === "PRESUMED_SAME") 다.
   */
  it("🔴 국내 후보 C27 — 품번이 exact 인데 PRESUMED_SAME 보류가 EXACT 를 막는다", () => {
    const r = judge("C27");
    expect(r.human).toBe("SAME");
    expect(r.modelCode).toBe("exact");
    expect(r.blockers).toEqual(["BRAND_UNCONFIRMED"]);
    expect(r.verdict).toBe("PRESUMED_SAME");
    /** 🔴 품번이 맞는데도 EXACT 가 아니다 — 이것이 「국내 EXACT 0」의 직접 원인이다. */
    expect(r.tier).not.toBe("EXACT");
    expect(r.tier).toBe("COMPARISON");
  });

  /** 🟢 tier 는 matchLevel 과 «무관» 하다 — 식별자 경로의 두 값이 모두 EXACT 로 매핑된다. */
  it("🟢 level 을 low 로 내려도 tier 가 같다 (level 은 레버가 아니다)", () => {
    for (const id of ["C27", "C11", "C48", "C50", "C51"])
      expect(judge(id, "low").tier, id).toBe(judge(id, "very_high").tier);
  });

  /**
   * 🔴🔴 **WU-057 의 「FP 분모 0」을 정정하는 두 건.** 둘 다 `BRAND_UNCONFIRMED`
   *    **단독** 이고 Human **DIFFERENT** 다. 보류를 풀면 이들이 EXACT 로 올라간다.
   *    🟢 지금 막는 것은 **품번이 없다** 는 사실 하나다.
   */
  it.each([["C50"], ["C51"]])("🔴 %s — Human DIFFERENT 인데 BRAND_UNCONFIRMED 단독이다 (FP 분모가 있다)", (id) => {
    const r = judge(id);
    expect(r.human).toBe("DIFFERENT");
    expect(r.blockers).toEqual(["BRAND_UNCONFIRMED"]);
    /** 🔴 품번이 **없다** — CF-3 가 이 둘을 건드리지 않는 유일한 이유다. */
    expect(r.modelCode).toBe("unavailable");
    expect(r.tier).not.toBe("EXACT");
  });

  /** 🔴 품번 단독 승격 금지(WU-057 §4)는 그대로 유효하다. */
  it("🔴 품번 exact «만» 으로 SAME 이 되지 않는다", () => {
    const c = FX.candidates.C27;
    const r = compareCrossSellerProducts(originOf(c.searchId) as never, { ...c.facts, brandModelCode: "B226AC010" } as never) as { verdict: string };
    expect(r.verdict).not.toBe("SAME");
  });
});

/* ════════ §4  참고가격 ↔ 판매판정 경계 ════════ */

describe("§4 참고가격 ↔ 판매판정 경계 (코드 위치로 고정)", () => {
  const read = (p: string) =>
    readFileSync(path.join(__dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  /**
   * 🟢 **해외 축은 판정에 들어가지 않는다** — `overseasEvidence.push` 뒤에 `continue`
   *    가 있어 가격 버킷(`exactShopRecords`/`comparisonShopRecords`)에 닿지 못한다.
   */
  it("🟢 해외 후보는 판정 버킷에 들어가지 않는다", () => {
    const src = read("market-intelligence.ts");
    const i = src.indexOf("overseasEvidence.push(");
    expect(i).toBeGreaterThan(0);
    const j = src.indexOf("continue;", i);
    expect(j).toBeGreaterThan(i);
    /** 🔴 그 사이에 판정 버킷 적재가 **없어야** 한다. */
    const between = src.slice(i, j);
    expect(between).not.toContain("exactShopRecords.push");
    expect(between).not.toContain("comparisonShopRecords.push");
  });

  /**
   * 🔴🔴 **국내 transient 는 «판정 입력» 이다** — WU-039 가 의도적으로 합쳤다.
   *    그래서 국내 구역 문구에 「판매판정 미반영」을 적지 않는다(WU-056 결정).
   */
  it("🔴 국내 transient 는 EXACT/COMPARISON 버킷에 들어간다 (판정 입력이다)", () => {
    const src = read("market-intelligence.ts");
    expect(src).toContain("exactShopRecords.push(transient)");
    expect(src).toContain("comparisonShopRecords.push(transient)");
    const scope = readFileSync(path.join(__dirname, "../../../../pipeline/commerce/overseas-reference.ts"), "utf8");
    const line = scope.split("\n").find((l) => l.includes("DOMESTIC_REFERENCE_SCOPE ="))!;
    expect(line).not.toContain("판매판정");
  });

  /**
   * 🔴🔴 그리고 그 경로가 **영속 알림까지** 간다 — `price_alerts` 는 transient 를
   *    포함한 `sellerAction` 에서 쓰인다. 「저장되지 않습니다」는 **가격** 이야기이고
   *    파생된 알림 행은 남는다. 🔴 CPO 정책 판정 사안(WU-059 §4).
   */
  it("🔴 알림이 transient 를 포함한 sellerAction 에서 쓰인다", () => {
    const route = read("../check/route.ts");
    const i = route.indexOf("computeMarketAlert({");
    expect(i).toBeGreaterThan(0);
    expect(route.slice(i, i + 400)).toContain("intelligence.sellerAction");
    expect(route.slice(i)).toContain("openAlertIfNotActive");
  });

  /** 🟢 단 **원가/추세 축은 DB 전용** 이다 — transient 가 알림 «변화량» 을 만들지 않는다. */
  it("🟢 알림 변화량은 DB 관측에서만 온다", () => {
    const src = read("market-intelligence.ts");
    expect(src).toContain('const domesticShopTrend7d = computePriceTrend(domesticShopHistory, 7)');
    expect(src).toContain('getPriceHistory(snapshotId, "DOMESTIC_SHOP")');
  });
});

/* ════════ §5  국내/해외 tier 비대칭 ════════ */

describe("§5 tier 비대칭 — 측정값으로 고정한다", () => {
  /**
   * 🔴🔴 **WU-062 에서 이 단언이 뒤집혔다 — 그것이 수정이 적용됐다는 증거다.**
   * ```
   * WU-059 이 고정한 «그때» 동작   lowestAmount **9** (EXCLUDED 가 최저가를 만들었다)
   * WU-062 이후 동작(CPO 승인)     lowestAmount **40** (금액 집계에서만 EXCLUDED 를 뺀다)
   * ```
   * 🟢 그리고 **관측은 지워지지 않았다** — `byPriceTier.EXCLUDED` 가 그대로 1 이라
   *    화면의 「동일상품 아님 1」 표시가 유지된다.
   */
  it("🟢 해외 금액 집계에서 EXCLUDED 가 빠진다 (WU-062 · 관측은 남는다)", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "OVERSEAS", currency: "EUR", amount: 40, priceTier: "EXACT" } as never,
      { market: "OVERSEAS", currency: "EUR", amount: 9, priceTier: "EXCLUDED" } as never,
    ]);
    expect(s.byCurrency.EUR.lowestAmount).toBe(40);
    expect(s.byCurrency.EUR.count).toBe(1);
    /** 🔴 관측/검증 결과는 유지된다(CPO 조건). */
    expect(s.byPriceTier.EXCLUDED).toBe(1);
    expect(s.count).toBe(2);
  });

  /** 🟢 국내 축은 **적재 시점에** EXACT/COMPARISON 만 담는다 — 비대칭의 다른 쪽. */
  it("🟢 국내 적재 조건이 EXACT/COMPARISON 둘뿐이다", () => {
    const src = readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8");
    const i = src.indexOf("domesticTransientRecords.push(");
    expect(i).toBeGreaterThan(0);
    const guard = src.slice(src.lastIndexOf("if (", i), i);
    expect(guard).toContain('e.priceTier === "EXACT"');
    expect(guard).toContain('e.priceTier === "COMPARISON"');
  });
});

/* ════════ §3  transient 수명 — 현 설계를 계약으로 확정 ════════ */

describe("§3 transient 수명", () => {
  /**
   * 🟢 두 참고 축은 **POST 응답에서만** state 로 들어간다. GET(`loadPriceHistory`)은
   *    이 둘을 건드리지 않으므로 **세션 안에서는 살아 있고** 새로고침에 사라진다.
   * 🔴 그것이 「저장하지 않는다」의 구현이다 — client 저장(sessionStorage 등)을
   *    넣으면 참고가격이 그것을 만든 POST 보다 오래 살아남아 **옆에 있는 판정과
   *    무한히 벌어진다**(판정은 GET = DB 전용). 그래서 **도입하지 않았다.**
   */
  it("🔴 참고 축은 POST 응답에서만 set 되고 GET 은 건드리지 않는다", () => {
    /** 🔴🔴 **주석을 벗긴다.** 직전 시도에서 `sessionStorage` 단언이 실패했는데
     *    실제로는 **주석 안의 설명**(쿠팡 탭 복원 이야기)이었다 — 헌장이 여덟 번
     *    걸렸다고 적어 둔 그 함정이다. */
    const panel = readFileSync(
      path.join(__dirname, "../../../../pipeline/commerce/DomesticPriceIntelligencePanel.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(panel).toContain("setOverseasReference(json.overseasReference ?? null)");
    expect(panel).toContain("setDomesticReference(json.domesticReference ?? null)");
    const i = panel.indexOf("function loadPriceHistory()");
    const body = panel.slice(i, panel.indexOf("\n  }", i));
    expect(body).not.toContain("setOverseasReference");
    expect(body).not.toContain("setDomesticReference");
    /** 🔴 client 영속화를 쓰지 않는다. */
    expect(panel).not.toContain("sessionStorage");
    expect(panel).not.toContain("localStorage");
  });
});

/* ════════ 🟡 선택 — GT 캐시가 있으면 전수 재현 ════════ */

const canSweep = existsSync(GT) && existsSync(CACHE);
const sweep = canSweep ? it : it.skip;

describe("전수 재현 (GT 캐시 필요 · 없으면 skip)", () => {
  /** 🔴 분모를 숫자로 고정한다. 위 §1 주석의 표가 이 테스트에서 나온 값이다. */
  sweep("GT 51 — 현행 EXACT 12(SAME 11 · DIFFERENT 1)", () => {
    const rows = (JSON.parse(readFileSync(GT, "utf8")) as { rows: Record<string, string>[] }).rows;
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as {
      id: string;
      canonical_product: unknown;
    }[];
    const ids: Record<string, string> = {
      S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
      S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
      S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
      S4: "c27d4727-2248-4fe0-9084-8c239737a889",
      S5: "32f7b651-29b9-4217-b8ce-46596f538306",
      S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
    };
    const origins: Record<string, ReturnType<typeof productFactsFromIdentityDna>> = {};
    for (const [sid, id] of Object.entries(ids)) {
      const snap = cases.find((c) => c.id === id)!;
      origins[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(snap.canonical_product as never)));
    }

    let exact = 0;
    let exactSame = 0;
    let exactDiff = 0;
    let n = 0;
    for (const r of rows) {
      const o = origins[r.searchId];
      const f = path.join(CACHE, `${key(r.candidateUrl)}.facts.json`);
      if (!o || !existsSync(f)) continue;
      const cached = JSON.parse(readFileSync(f, "utf8")) as { candidate?: { facts?: unknown; title?: string } };
      const cand = cached.candidate?.facts as Record<string, unknown> | undefined;
      if (!cand) continue;
      n++;
      const oo = o;
      const oCode = oo.brandModelCode ?? null;
      const cc = cand as Record<string, unknown>;
      const cross = compareCrossSellerProducts(oo as never, cc as never) as { verdict: string; blockers?: { blocker: string }[]; conflicts?: unknown[] };
      const dCode = (cc.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
      const truth = deriveMatchTruth("very_high", compareModelCode(oCode, dCode ?? null) as never, cross.verdict as never, (cross.blockers ?? []) as never, (cross.conflicts ?? []) as never, isColorUnverified(oo.colorText ?? null, (cc.colorText as string | null) ?? null));
      const t = { tier: priceTierFromLink({ matchTruth: truth, verified: false } as never) };
      if (t.tier === "EXACT") {
        exact++;
        if (r.humanGt === "SAME") exactSame++;
        if (r.humanGt === "DIFFERENT") exactDiff++;
      }
    }
    expect(n).toBe(51);
    expect(exact).toBe(12);
    expect(exactSame).toBe(11);
    /** 🔴 **기존 False EXACT 1건(C06 global.trenbe.com)** — 이 WU 에서 고치지 않았다. */
    expect(exactDiff).toBe(1);
  });
});
