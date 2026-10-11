/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-11 — `compareMaterial` owner 추적 + `SAME` 문턱의 식별 증거 (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MI-P0-10 이 FP 1건을 찾고 그 원인을 **미측정으로** 남겼다. CPO 지시는 셋이다 —
 * ① `materialText 원천 → normalize → compareMaterial → MATERIAL axis → corePoints
 *    → verdict` 전체 Production 경로 확인
 * ② `velvet ↔ corduroy` 가 왜 match 가 됐는지 **독립 fixture 로 재현**
 * ③ 실제 라벨 방어까지 통과할 때만 최소 수정 여부 판단
 *
 * ── 🔴🔴 ②의 전제가 틀렸다 (CTO 자체 정정) ─────────────────────────────────
 *   `compareMaterial` 은 **섬유 조성** 만 본다:
 *     parseMaterialComposition  → `PERCENT_FIRST_RE` / `PERCENT_LAST_RE` 두 개로
 *                                 «퍼센트 + 섬유명» 만 긁는다(product-facts.ts:241)
 *     materialCompositionKey    → `fabric:percent` 를 이어 붙인 문자열
 *     keyLeft === keyRight      → match, 아니면 mismatch (cross-seller.ts:505)
 *
 *   🔴 `velvet` · `corduroy` 는 **조직(weave) 이름이고 섬유가 아니다.** 퍼센트가
 *      붙지 않으므로 파서가 **그 낱말을 아예 보지 않는다.** 그래서 「velvet 과
 *      corduroy 를 같다고 봤다」가 아니라 **「둘의 섬유 조성이 실제로 같았다」** 다.
 *      → `compareMaterial` 은 설계대로 동작했다. **결함이 아니다.**
 *      → 🔴 MI-P0-10 보고에서 소재를 FP 원인으로 지목한 것은 내 오진이다.
 *
 * ── 🟢 그러면 FP 의 실제 원인 (덤프 177쌍에서 계산) ────────────────────────
 *     verdict=SAME 28쌍 중 core 에 식별 증거(TITLE 2점 · MODEL_CODE)가
 *       🟢 있음 26쌍(93%)   🔴 없음 2행 = 실제 1쌍
 *     그 1쌍 axes = TITLE:1 CATEGORY:1 COLOR:1 MATERIAL:1 AUDIENCE:1 SIZE:1
 *       → corePoints 5 («TITLE 1점은 core 에서 빠진다») → 정확히 문턱
 *
 *   🔴 `SAME` 조건은 `!blocked && brandOk && corePoints >= 5` 뿐이고 **식별 증거를
 *      요구하지 않는다.** MI-DISCOVERY-P4 변경 A 가 만든 `hasIdentifyingEvidence`
 *      요구는 `PRESUMED_SAME` 에만, 그리고 «같은 판매처» 조건과 함께 걸려 있다.
 *      → 부수 증거(CATEGORY·COLOR·MATERIAL·AUDIENCE·SIZE) 다섯 개면 SAME 에 닿는다.
 *      그리고 cross-seller.ts:930 주석이 **이미 같은 모양을 경고했다**
 *      ("Coco Dress" ↔ "CHARLENE DRESS": TITLE«1» + 부수 4개 = 5).
 *
 * 🔴 이 파일은 **아무것도 고치지 않는다.** 현재 동작을 고정하고, 수정안의 효과와
 *    «라벨 방어» 를 계산해 보고만 한다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { materialCompositionKey, parseMaterialComposition } from "@commerce/shared";
import { compareCrossSellerProducts } from "../cross-seller";
import { factsFromProductUrl } from "../product-url-facts";
import { productFactsFromShopifyProduct, productFactsFromSmallableHtml } from "../seller-facts";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures");

const smallable = (file: string, id: string): ProductFacts => {
  const f = productFactsFromSmallableHtml(readFileSync(path.join(FIXTURES, file), "utf8"), id);
  if (!f) throw new Error(`fixture 실패: ${file}`);
  return f;
};
const bobo = (code: string): ProductFacts =>
  productFactsFromShopifyProduct(
    JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")),
    "bobochoses.com",
  );

/** 🔴 cross-seller.ts 의 corePoints 식과 «같은» 규칙. 상수도 그 파일에서 읽어 적었다. */
const SAME_MIN_AXES = 5;
const coreAxes = (axes: { axis: string; points: number }[]) =>
  axes.filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1));
const corePointsOf = (axes: { axis: string; points: number }[]) =>
  coreAxes(axes).reduce((s, a) => s + a.points, 0);
/** core 에 «기여하는» 식별 증거만 센다 — TITLE 1점(부분일치)은 식별 증거가 아니다. */
const coreIdentityAxes = (axes: { axis: string; points: number }[]) =>
  coreAxes(axes).filter((a) => a.axis === "TITLE" || a.axis === "MODEL_CODE").map((a) => a.axis);

/**
 * 🔴 CEO 라벨 쌍(MATCHING-2.0-CORE, 2026-09-13). MI-P0-10 STEP A 와 **같은 7쌍** 을
 *    쓴다 — 거기서 Vision 이 7/7 재현한 그 집합이라 라벨 방어의 기준으로 적합하다.
 */
const LABELED: { id: string; label: "SAME" | "DIFF"; a: () => ProductFacts; b: () => ProductFacts }[] = [
  { id: "A 430701↔B226AC114", label: "SAME", a: () => smallable("smallable-430701-product.html", "430701"), b: () => bobo("B226AC114") },
  { id: "D 430632↔B226AC018", label: "SAME", a: () => smallable("smallable-430632-product.html", "430632"), b: () => bobo("B226AC018") },
  { id: "F 430651↔B226AC043", label: "SAME", a: () => smallable("smallable-430651-fr.html", "430651"), b: () => bobo("B226AC043") },
  { id: "C B226AC114↔B226AD013", label: "DIFF", a: () => bobo("B226AC114"), b: () => bobo("B226AD013") },
  { id: "E 430632↔B226AD013", label: "DIFF", a: () => smallable("smallable-430632-product.html", "430632"), b: () => bobo("B226AD013") },
  { id: "G 430651↔B226AC042", label: "DIFF", a: () => smallable("smallable-430651-fr.html", "430651"), b: () => bobo("B226AC042") },
  { id: "H 430701↔B226AC049", label: "DIFF", a: () => smallable("smallable-430701-product.html", "430701"), b: () => bobo("B226AC049") },
];

describe("🔴 MI-P0-11 ① — parseMaterialComposition 은 «조직» 을 보지 않는다 (순수·오프라인)", () => {
  /**
   * 🔴 이것이 CPO 가 요구한 ② 재현이다. 다만 재현되는 사실은 「velvet↔corduroy 를
   *    같다고 본다」가 **아니라** 「조직 이름은 입력으로 들어가지도 않는다」다.
   */
  it("조직 이름(velvet/corduroy/ribbed)은 조성에서 «누락» 된다 — 비교에 쓰이지 않는다", () => {
    for (const weave of ["Ribbed velvet", "corduroy", "velvet", "big corduroy", "Velvet / Corduroy"]) {
      expect(parseMaterialComposition(weave), weave).toEqual([]);
    }
  });

  it("🔴 조직이 달라도 «퍼센트 조성» 이 같으면 MATERIAL 키가 같다 — 그래서 match 다", () => {
    const velvet = parseMaterialComposition("100% Cotton — ribbed velvet");
    const cord = parseMaterialComposition("Corduroy, 100% cotton");
    expect(materialCompositionKey(velvet)).toBe(materialCompositionKey(cord));
    expect(materialCompositionKey(velvet)).toBe("cotton:100");
  });

  it("조성이 실제로 다르면 그대로 갈린다 — 이 축이 무력한 것이 아니다(대조군)", () => {
    const a = parseMaterialComposition("100% cotton");
    const b = parseMaterialComposition("80% cotton, 20% polyester");
    expect(materialCompositionKey(a)).not.toBe(materialCompositionKey(b));
  });
});

describe("🔴 MI-P0-11 ② — `SAME` 문턱은 식별 증거를 요구하지 않는다 (순수·오프라인)", () => {
  it("CEO 라벨 7쌍의 현재 판정과 core 식별 증거를 «그대로» 남긴다", () => {
    const rows = LABELED.map((p) => {
      const m = compareCrossSellerProducts(p.a(), p.b());
      const ident = coreIdentityAxes(m.axes);
      return {
        pair: p.id, humanLabel: p.label, verdict: m.verdict,
        axes: m.axes.map((a) => `${a.axis}:${a.points}`),
        corePoints: corePointsOf(m.axes), coreIdentityAxes: ident,
        blockers: m.blockers.map((b) => b.blocker), conflicts: m.conflicts.map((c) => c.conflict),
        /** 🔴 수정안 counterfactual: `SAME` 에 식별 증거를 요구하면 이 쌍은? */
        verdictIfIdentityRequired:
          m.verdict === "SAME" && ident.length === 0 ? "PRESUMED_SAME(강등)" : m.verdict,
      };
    });
    // eslint-disable-next-line no-console
    console.log("\n[MI-P0-11 라벨 방어] " + JSON.stringify(rows, null, 2));

    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 라벨 방어가 수정안을 **죽였다** (실측 2026-10-12)
     * ══════════════════════════════════════════════════════════════════════
     * 처음에 이 자리에 「SAME 라벨 쌍에는 core 식별 증거가 있어야 한다」를 썼다.
     * **두 쌍에서 실패했다:**
     *
     *   A 430701↔B226AC114   사람 라벨 SAME   core=6   coreIdentityAxes=[]
     *   F 430651↔B226AC043   사람 라벨 SAME   core=5   coreIdentityAxes=[]
     *
     * 🔴 즉 CEO 가 동일상품이라고 확정한 3쌍 중 **2쌍이 식별 증거 없이** 부수
     *    축만으로 SAME 이다. 「SAME 에 식별 증거를 요구한다」는 수정은 **정답
     *    쌍 2/3 을 PRESUMED_SAME 으로 강등시킨다.** → 쓸 수 없다.
     *
     * 🟢 그리고 cross-seller.ts 가 **이미 그렇게 적어 뒀다** —
     *    「이 저장소의 출발점이 「판매처마다 상품명이 다르다」 이므로 다른
     *     판매처의 제목 불일치는 정상이다(그래서 430701 은 TITLE 없이도 SAME 에
     *     닿는 설계다)」.
     *
     * 그래서 단언 방향을 **반대로** 고정한다 — 이 사실이 바뀌면(누가 문턱에
     * 식별 증거를 더하면) 이 테스트가 깨져서 「정답 쌍이 죽는다」를 알려 준다.
     */
    const sameLabeled = rows.filter((x) => x.humanLabel === "SAME");
    const withoutIdentity = sameLabeled.filter((x) => x.coreIdentityAxes.length === 0);
    expect(
      withoutIdentity.map((x) => x.pair),
      "CEO SAME 라벨 쌍 중 식별 증거 없이 SAME 인 것 — 이 목록이 비면 문턱이 바뀐 것이다",
    ).toEqual(["A 430701↔B226AC114", "F 430651↔B226AC043"]);
    // 🟢 그래도 셋 다 «지금은» SAME 이어야 한다(정답 보존).
    for (const r of sameLabeled) expect(r.verdict, r.pair).toBe("SAME");
    // DIFF 라벨 쌍은 SAME 이 아니어야 한다(현재 동작 고정).
    for (const r of rows.filter((x) => x.humanLabel === "DIFF")) {
      expect(r.verdict, `${r.pair}`).not.toBe("SAME");
    }
  });

  it("🔴 부수 증거 5개만으로 SAME 에 닿는 것이 «가능하다» — 구조를 고정한다", () => {
    /**
     * 🔴 합성 fixture 다. 실제 판매처 응답이 아니라 **문턱의 산술** 을 보이는 것이
     *    목적이고, 그 사실을 여기 적는다(fixture 를 실측으로 포장하지 않는다).
     *    MI-P0-10 이 찾은 실제 FP 쌍과 **같은 axes 구성** 을 만든다.
     */
    const base = (over: Partial<ProductFacts>): ProductFacts => ({
      sourceUrl: "https://a.example/p/1", urlSlug: "p-1", brand: "Louis Louise",
      brandModelCode: null, sellerSku: null, title: "T", coreTitleTokens: [],
      categoryText: "trousers", colorText: "pink", materialText: "100% cotton",
      fitText: null, ageRangeText: null, sizeLabels: ["6M", "12M"],
      audienceSignals: ["baby"], imageUrls: [], ...over,
    });
    /**
     * 🔴 처음엔 `["holly","hearts"]` ↔ `["holly"]` 로 썼다가 **재현에 실패했다** —
     *    jaccard 가 1/2 = 0.5 로 `STRONG_TITLE_OVERLAP` 에 «닿아» TITLE 이 2점이
     *    됐고, 그러면 식별 증거가 생겨 실제 FP 와 다른 쌍이 된다. 실제 FP 는
     *    TITLE:1(부분일치)이었다. 그래서 jaccard 를 0.5 «아래» 로 내린다:
     *      {holly,hearts,ribbed} ∩ {holly,big} = 1 · ∪ = 4 → 0.25
     *    🔴 유형어(trousers/pants)는 `distinctive` 가 떼므로 토큰에 넣지 않는다.
     */
    const x = base({ title: "Holly Hearts Ribbed Velvet Baby Pants", coreTitleTokens: ["holly", "hearts", "ribbed"] });
    const y = base({
      sourceUrl: "https://b.example/p/2", urlSlug: "p-2",
      title: "holly baby corduroy trousers", coreTitleTokens: ["holly", "big"],
    });
    const m = compareCrossSellerProducts(x, y);
    // eslint-disable-next-line no-console
    console.log(`\n[MI-P0-11 합성] verdict=${m.verdict} core=${corePointsOf(m.axes)} axes=${m.axes.map((a) => `${a.axis}:${a.points}`).join(" ")} ident=${JSON.stringify(coreIdentityAxes(m.axes))}`);

    // 🔴 방향을 고르지 않는다 — 지금 동작을 «그대로» 고정한다.
    expect(m.conflicts).toEqual([]);
    expect(m.blockers).toEqual([]);
    expect(corePointsOf(m.axes)).toBeGreaterThanOrEqual(SAME_MIN_AXES);
    expect(coreIdentityAxes(m.axes)).toEqual([]); // 식별 증거가 «없다»
    expect(m.verdict).toBe("SAME"); // 그런데도 SAME 이다 — 이것이 FP 의 구조다
  });
});

describe.skipIf(!LIVE)("🔴 MI-P0-11 ③ — 실제 FP 쌍의 materialText 원천 (LIVE)", () => {
  it("두 판매처가 실제로 내려준 소재 원문과 조성 키를 «그대로» 적는다", async () => {
    const urls = [
      { side: "origin(smallable)", url: "https://www.smallable.com/en/product/holly-hearts-ribbed-velvet-baby-pants-pale-pink-louis-louise-467263" },
      { side: "candidate(kodomoboston)", url: "https://www.kodomoboston.com/products/louis-louise-holly-baby-trousers-pink" },
      { side: "control(smolstore)", url: "https://smolstore.com/products/w265013-pink" },
    ];
    const rows = [];
    for (const u of urls) {
      const r = await factsFromProductUrl(u.url);
      const f = r.candidate?.facts;
      const comp = parseMaterialComposition(f?.materialText);
      rows.push({
        side: u.side, status: r.status, fetchPath: r.fetchPath,
        title: f?.title ?? null, materialText: f?.materialText ?? null,
        composition: comp, compositionKey: materialCompositionKey(comp),
        colorText: f?.colorText ?? null, brandModelCode: f?.brandModelCode ?? null,
        coreTitleTokens: f?.coreTitleTokens ?? null,
      });
    }
    // eslint-disable-next-line no-console
    console.log("\n[MI-P0-11 실측 원천] " + JSON.stringify(rows, null, 2));
    expect(rows).toHaveLength(urls.length);
  }, 10 * 60 * 1000);
});
