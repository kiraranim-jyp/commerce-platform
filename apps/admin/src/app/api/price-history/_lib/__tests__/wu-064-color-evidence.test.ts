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
  productFactsFromListing,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);
const IDS: Record<string, string> = {
  S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
  S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
  S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
  S4: "c27d4727-2248-4fe0-9084-8c239737a889",
  S5: "32f7b651-29b9-4217-b8ce-46596f538306",
  S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-064 — **국내 색상 Evidence** · `colorText=null` 원인 확정 (조사 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴🔴 원인 확정 — 생산자가 «제목 전용» 이다 ─────────────────────────────
 * ```
 * seller-facts.ts:264   colorText = extractColorFromTitle(input.title)
 * description-facts.ts  extractColorFromTitle → COLOR_TITLE_PATTERN(KNOWN_COLOR_WORDS **화이트리스트**)
 * product-url-facts.ts:109-110 주석: 「읽는 자리를 셋으로 한정한다 …
 *                       **색상·소재·상품군은 건드리지 않는다**」
 * ⟹ 후보 경로는 HTML 의 색상을 **아예 보지 않는다.** 제목에 영어 색상 단어가
 *    없으면 `null` 이고, 국내 제목은 한국어라 대부분 없다.
 * ```
 *
 * ── 🔴 「없다」와 「있는데 못 읽는다」를 갈랐다 (국내 17건 HTML 전수) ───────
 * ```
 * JSON-LD color   **1/17** (C08 "블루" — 🔴 그마저 국내 버킷 밖이다)
 * itemprop=color  **0/17**     og:color **0/17**
 * 국내 버킷 5건의 색상 소재지:
 *   C07 C47  🟡 **meta description 산문** ("…오가닉 코튼 100% **라이트 블루 컬러**의…")
 *            🔴 WU-047 이 **채택 불가(6 안전기준 미달)** 로 이미 HOLD 한 자리다
 *   C23 C24  🟡 **제목에 있다**("… - **Graystone**") — 🔴 브랜드가 지어낸 색상명이라
 *            화이트리스트 밖이다. 읽으려면 **색상사전 확대** 가 필요하고 WU-044 금지다
 *   C15      🔴 **없다** (`color` 는 전부 CSS/JS 노이즈)
 * ```
 *
 * ── 🔴🔴 그리고 색상을 «완벽히» 복구해도 **효과가 0 이다** (전수 측정) ──────
 * ```
 * EXACT 12 → **12** · COMPARISON 29 → 29 · REFERENCE 2 → 2 · EXCLUDED 8 → 8
 * tier 가 바뀌는 후보 **0건** · Human SAME 회복 **0** · False SAME 증가 **0**
 * ```
 * 🔴🔴 **WU-063 의 「색상 미확인이 직접 원인」을 정정한다.** 그것은
 *    「EXACT 게이트에서 **마지막으로** 걸리는 조건」이라는 뜻이었고
 *    「그것만 풀면 EXACT 가 된다」는 뜻이 **아니었다**. 이번 측정이 그 구분을 닫았다.
 *
 * ── 🟢 진짜로 막는 것은 **한국어 제목** 이다 ───────────────────────────────
 * ```
 * C07 C15 C47  한국어 제목 → 원상품(영문) 과 토큰 겹침 0 → **NO_TITLE_OVERLAP**
 *              그 blocker 는 `hasObservedDifference` 집합이라 **색상·품번과 무관하게** 막는다
 * C23 C24      제목이 영어라 NO_TITLE_OVERLAP 이 **없다** → 그래서 blockers 가 비어 있었고
 *              색상 축만이 유일한 방어였다(WU-063 CF-4)
 * ```
 *
 * ── 🟡 결합 CF — 처음으로 국내 EXACT 가 1건 생긴다 (🔴 금지 둘을 같이 풀어야) ─
 * ```
 * 색상 복구 **+** `NO_TITLE_OVERLAP` 비차단(WU-045 의 SIZE_SYSTEM 과 같은 처리)
 *   C47 biskuit.kr (Human SAME)  COMPARISON → **EXACT**
 *   EXACT 12 → 13 (SAME 11→12 · DIFFERENT 1→1)
 *   Human SAME 회복 **1** · False SAME 증가 **0** · precision 91.7% → **92.3%**
 * 🔴 그러나 둘 다 금지 영역이다 — ① meta description 채택(WU-047 HOLD)
 *    ② MI blocker 완화(CPO STEP 9 가 금지). 그리고 **N=1** 이다(§5-B).
 * ⟹ **구현하지 않았다.** CPO 판정 사안으로 올린다.
 * ```
 *
 * 🔴 GT 캐시가 있을 때만 돈다(없으면 skip). 운영 코드 변경 **0**.
 */

/**
 * 🔴 **페이지에서 «실제로 읽은» 색상** 만 넣는다. 지어낸 값이 아니다 —
 *    위 HTML 조사에서 그 글자가 어디 있는지 확인한 것만 적는다.
 */
const RECOVERED: Record<string, { color: string; where: string }> = {
  C07: { color: "라이트 블루", where: 'meta description 산문: "…오가닉 코튼 100% 라이트 블루 컬러의 티셔츠…"' },
  C47: { color: "블루", where: 'meta description 산문: "…폴리에스터 100% 블루 컬러의 트랙수트 자켓…"' },
  C23: { color: "Graystone", where: "제목: [메인스토리] AW26MS185 - Bubble Sweatshirt - Graystone" },
  C24: { color: "Graystone", where: "제목: [MAIN STORY]Bubble Sweatshirt - AW26MS185 - Graystone*" },
  C08: { color: "블루", where: "JSON-LD color" },
};

const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json"));
const t = READY ? it : it.skip;

describe("WU-064 — 색상 evidence 복구 counterfactual", () => {
  t("색상을 «완벽히» 복구해도 tier 가 하나도 바뀌지 않는다 · 결합 CF 는 +1 SAME / FP 0", () => {
    const rows = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    const judge = (r: any, colorOverride?: string, dropTitleOverlap = false) => {
      const o = of[r.searchId];
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!o || !existsSync(f)) return null;
      const cached = JSON.parse(readFileSync(f, "utf8"));
      const base = cached.candidate?.facts;
      if (!base) return null;
      const cand = colorOverride ? { ...base, colorText: colorOverride } : base;
      const cross0 = compareCrossSellerProducts(o, cand) as any;
      /** 🔴 CF — `NO_TITLE_OVERLAP` 을 **비차단** 으로(WU-045 의 SIZE_SYSTEM 과 같은 처리). */
      const cross = dropTitleOverlap
        ? { ...cross0, blockers: (cross0.blockers ?? []).filter((b: any) => b.blocker !== "NO_TITLE_OVERLAP") }
        : cross0;
      const dCode = cand.brandModelCode ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
      const modelCode = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, cand.colorText ?? null);
      const truth = deriveMatchTruth("very_high", modelCode as never, cross.verdict, (cross.blockers ?? []) as never, (cross.conflicts ?? []) as never, cu);
      return {
        verdict: cross.verdict, blockers: (cross.blockers ?? []).map((b: any) => b.blocker),
        colorUnverified: cu, truth, tier: priceTierFromLink({ matchTruth: truth, verified: false } as never),
        oColor: o.colorText ?? null,
      };
    };

    console.log("\n════════ 색상 복구 전후 (실제로 페이지에 있는 글자만 주입) ════════");
    for (const [id, rec] of Object.entries(RECOVERED)) {
      const r = rows.find((x) => x.id === id)!;
      const before = judge(r)!;
      const after = judge(r, rec.color)!;
      console.log(`\n ${id} ${String(r.humanGt).padEnd(10)} ${r.domain}`);
      console.log(`   출처: ${rec.where}`);
      console.log(`   원상품 색상 = ${JSON.stringify(before.oColor)}  ↔  복구 색상 = ${JSON.stringify(rec.color)}`);
      console.log(`   전: colorUnv=${String(before.colorUnverified).padEnd(5)} verdict=${String(before.verdict).padEnd(14)} tier=${before.tier.padEnd(11)} blockers=[${before.blockers.join("+")}]`);
      console.log(`   후: colorUnv=${String(after.colorUnverified).padEnd(5)} verdict=${String(after.verdict).padEnd(14)} tier=${after.tier.padEnd(11)} blockers=[${after.blockers.join("+")}]`);
      console.log(`   ⟹ tier ${before.tier} → ${after.tier}  ${before.tier === after.tier ? "(변화 없음)" : "🔴 변화"}`);
    }

    /* ── 전수 KPI ── */
    const all = rows.map((r) => ({ r, b: judge(r), a: judge(r, RECOVERED[r.id]?.color) })).filter((x) => x.b && x.a);
    const cnt = (sel: "b" | "a", t: string, h?: string) => all.filter((x) => x[sel]!.tier === t && (!h || x.r.humanGt === h)).length;
    console.log("\n════════ 전수 KPI (GT 51) ════════");
    console.log(` EXACT       전 ${cnt("b", "EXACT")} (SAME ${cnt("b", "EXACT", "SAME")} · DIFFERENT ${cnt("b", "EXACT", "DIFFERENT")})  →  후 ${cnt("a", "EXACT")} (SAME ${cnt("a", "EXACT", "SAME")} · DIFFERENT ${cnt("a", "EXACT", "DIFFERENT")})`);
    console.log(` COMPARISON  전 ${cnt("b", "COMPARISON")}  →  후 ${cnt("a", "COMPARISON")}`);
    console.log(` REFERENCE   전 ${cnt("b", "REFERENCE")}  →  후 ${cnt("a", "REFERENCE")}`);
    console.log(` EXCLUDED    전 ${cnt("b", "EXCLUDED")}  →  후 ${cnt("a", "EXCLUDED")}`);
    const changed = all.filter((x) => x.b!.tier !== x.a!.tier);
    console.log(` 🔴 tier 가 바뀌는 후보: ${changed.length ? changed.map((x) => `${x.r.id}:${x.r.humanGt}:${x.b!.tier}→${x.a!.tier}`).join(" ") : "**0건**"}`);
    console.log(` 🔴 Human SAME 회복(COMPARISON→EXACT): ${all.filter((x) => x.r.humanGt === "SAME" && x.b!.tier !== "EXACT" && x.a!.tier === "EXACT").length}`);
    console.log(` 🔴 False SAME 증가(DIFFERENT→EXACT): ${all.filter((x) => x.r.humanGt === "DIFFERENT" && x.b!.tier !== "EXACT" && x.a!.tier === "EXACT").length}`);
    /* ── 결합 CF: 색상 복구 + NO_TITLE_OVERLAP 비차단 ── */
    console.log("\n==== 결합 CF — 색상 복구 + NO_TITLE_OVERLAP 비차단 ====");
    const comb = rows.map((r) => ({ r, b: judge(r), c: judge(r, RECOVERED[r.id]?.color, true) })).filter((x) => x.b && x.c);
    const ch = comb.filter((x) => x.b!.tier !== x.c!.tier);
    for (const x of ch)
      console.log(` ${x.r.id} ${String(x.r.humanGt).padEnd(10)} ${String(x.r.domain).padEnd(22)} ${x.b!.tier} → ${x.c!.tier}   blockers 전[${x.b!.blockers.join("+")}] 후[${x.c!.blockers.join("+")}]`);
    const ce = (sel: "b" | "c", h?: string) => comb.filter((x) => x[sel]!.tier === "EXACT" && (!h || x.r.humanGt === h)).length;
    console.log(` EXACT 전 ${ce("b")} (SAME ${ce("b", "SAME")} · DIFF ${ce("b", "DIFFERENT")})  →  후 ${ce("c")} (SAME ${ce("c", "SAME")} · DIFF ${ce("c", "DIFFERENT")})`);
    console.log(` 🔴 Human SAME 회복 ${comb.filter((x) => x.r.humanGt === "SAME" && x.b!.tier !== "EXACT" && x.c!.tier === "EXACT").length} · False SAME 증가 ${comb.filter((x) => x.r.humanGt === "DIFFERENT" && x.b!.tier !== "EXACT" && x.c!.tier === "EXACT").length}`);
    const prec = (sel: "b" | "c") => (ce(sel) ? ((ce(sel, "SAME") / ce(sel)) * 100).toFixed(1) : "-");
    console.log(` precision ${prec("b")}% → ${prec("c")}%`);

    /* ══════ 🔴 계약 — 이 숫자들이 바뀌면 여기서 깨진다 ══════ */
    expect(all.length).toBe(51);
    /** 🔴🔴 색상 **단독** 복구는 효과가 0 이다. */
    expect(changed).toHaveLength(0);
    expect(cnt("a", "EXACT")).toBe(cnt("b", "EXACT"));
    /** 🟡 결합 CF 는 Human SAME 을 **1건** 회복하고 False SAME 을 **0** 만든다. */
    expect(ch.map((x) => x.r.id)).toEqual(["C47"]);
    expect(ce("c")).toBe(13);
    expect(ce("c", "SAME")).toBe(12);
    expect(ce("c", "DIFFERENT")).toBe(1);
    /** 🔴 C23·C24 는 색상을 읽으면 **COLOR_VARIANT 가 생겨 더 강하게 막힌다**(승격이 아니다). */
    for (const id of ["C23", "C24"]) {
      const x = all.find((y) => y.r.id === id)!;
      expect(x.a!.blockers, id).toContain("COLOR_VARIANT");
      expect(x.a!.tier, id).toBe("COMPARISON");
    }
  });
});

/* ════════ 🔴🔴 생산자 계약 — 캐시가 아니라 «함수» 를 부른다 ════════ */

describe("색상 evidence 생산자 (productFactsFromListing)", () => {
  /**
   * 🔴🔴 **직전 음성 대조에서 M1·M2·M3 가 전부 통과했다 — 진짜 가드 공백이었다.**
   *    위 counterfactual 들이 **캐시된 facts(출력)** 를 읽어서 생산자를 변조해도
   *    잡지 못했다. 🔴 §5-B 의 「운영 함수를 부른다」를 내가 어긴 것이다.
   *    아래 네 단언이 그 구멍을 막는다.
   */
  const mk = (title: string) => productFactsFromListing({ title, url: "https://shop.example/products/x" });

  /** M1 — 제목의 색상 단어를 **읽어야** 한다. */
  it("🟢 제목의 알려진 색상 단어를 읽는다", () => {
    expect(mk("Bubble Sweatshirt in Grey Melange").colorText).toBeTruthy();
    expect(String(mk("Bubble Sweatshirt in Grey Melange").colorText).toLowerCase()).toContain("grey");
  });

  /** M3 — 🔴 **임의 텍스트를 색상으로 쓰지 않는다.** 화이트리스트 밖이면 `null` 이다. */
  it("🔴 사전 밖 단어를 색상으로 승격하지 않는다", () => {
    /** 🔴 브랜드가 지어낸 색상명(C23·C24 의 실제 값)은 **읽히지 않는다** — 그것이 현재 한계다. */
    expect(mk("[메인스토리] AW26MS185 - Bubble Sweatshirt - Graystone").colorText).toBeNull();
    /** 🔴 한국어 색상도 읽히지 않는다(색상사전 확대는 WU-044 금지). */
    expect(mk("보보쇼즈 26FW 아동 긴팔 티셔츠 B226AC010").colorText).toBeNull();
    /** 🔴 제목 앞부분을 그대로 색상으로 쓰지 않는다. */
    expect(mk("Totally Unrelated Product Name Here").colorText).toBeNull();
  });

  /** M2 — 🔴 **고정 색상을 박아 넣지 않는다.** 입력이 다르면 출력도 달라야 한다. */
  it("🔴 색상이 입력에서 나온다 (상수가 아니다)", () => {
    const a = mk("Sweatshirt in Grey Melange");
    const b = mk("Sweatshirt in Light Blue");
    expect(a.colorText).not.toBe(b.colorText);
    expect(String(b.colorText).toLowerCase()).toContain("blue");
  });

  /** 🔴 생산자가 **HTML 을 보지 않는다** — 그것이 `colorText=null` 의 원인이다(원인 고정). */
  it("🔴 생산자 입력이 제목·URL·브랜드 셋뿐이다 (HTML 미사용)", () => {
    const src = readFileSync(
      path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/seller-facts.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const i = src.indexOf("export function productFactsFromListing");
    const body = src.slice(i, src.indexOf("\n}", i));
    expect(body).toContain("extractColorFromTitle(input.title)");
    /** 🔴 HTML/DOM/JSON-LD 를 읽지 않는다 — 읽게 되면 이 단언이 깨지고 그때 재평가한다. */
    expect(body).not.toContain("html");
    expect(body).not.toContain("extractFromJsonLd");
  });
});
