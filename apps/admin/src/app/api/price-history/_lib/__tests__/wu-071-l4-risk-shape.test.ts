import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  isColorUnverified,
} from "@commerce/crawler";
import { extractCodeLikeSlugSegment } from "@commerce/shared";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-071 — **L4 의 실제 위험 형태 탐색 + 샵 SKU 유입 경로** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── ① 위험 형태 — **찾지 못했다**(그리고 그 «이유» 가 중요하다) ────────────
 * 찾은 조건: `라인 다름 + 같은 브랜드 + 색상 충돌 없음 + 카테고리 충돌 없음 + Human DIFFERENT`
 * ```
 * 전수 결과  **0건**
 * 🔴 그런데 그것은 「안전하다」가 아니다 — 라인이 다른 Human DIFFERENT **17쌍** 이
 *    **전부** 브랜드 또는 COLOR/CATEGORY 에서 걸렸다는 뜻이고,
 *    **라인 자체를 보는 축은 여전히 없다.**
 * ```
 *
 * ── ③ 방어축 분해 — **COLOR 를 빼면 즉시 뚫린다** ──────────────────────────
 * ```
 * L4                  False SAME **+0**
 * L4 − COLOR 방어      🔴 False SAME **증가** (S1/C33 등 AC↔AB DIFFERENT 가 EXACT 로)
 * L4 − CATEGORY 방어   측정값은 본문 표에
 * ⟹ 🔴 **COLOR 가 단독 하중을 지고 있다.** CPO 가 지적한 그대로다.
 * ```
 *
 * ── ⑤ `700005621LBL` — 유입 경로를 **코드로 확정** 했다 ────────────────────
 * ```
 * seller-facts.ts:208  brandModelCode = extractLabeledProductCode(desc)
 *                                       ?? **extractCodeLikeSlugSegment(slug)**
 * product-facts.ts:759 첫 slug 조각 · 길이 6~20 · [a-z0-9] · 글자와 숫자 **둘 다**
 * kids21 URL `/products/700005621lbl` → 첫 조각 `700005621lbl`(12자 · 영숫자 혼합)
 *   ⟹ **조건을 통과해 브랜드 품번으로 승격된다**
 * 🔴🔴 그 함수 주석이 「판매처 재고번호가 여기 걸리지 않는지가 중요한데 실측한 두 형태
 *    모두 안전하게 빠진다」고 적어 뒀다 — **그 전제가 이번에 반증됐다.**
 * 🔴 안전한 식별 축은 **찾지 못했다**(§ 아래) — 수정하지 않았다(CPO 지시).
 * ```
 */

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
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const LINE = /^B(\d{3})([A-Z]{2})(\d+)/;
const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json")) &&
  existsSync(NEW_GT);

describe("WU-071 — L4 위험 형태 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("① 위험 형태 탐색 · ③ 방어축 분해 · ④ 회귀", () => {
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    type It = { id: string; src: string; origin: string; domain: string; gt: string | null; cand: any; title: string; url: string };
    const items: It[] = [];
    const gt = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    const push = (id: string, src: string, origin: string, domain: string, gtv: string | null, c: any, t: string, u: string) =>
      items.push({ id, src, origin, domain, gt: gtv, cand: c, title: t, url: u });
    for (const r of gt) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (c.candidate?.facts) push(r.id, "OLD", r.searchId, r.domain, r.humanGt ?? null, c.candidate.facts, c.candidate.title ?? "", r.candidateUrl);
    }
    for (const r of JSON.parse(readFileSync(NEW_GT, "utf8")) as any[])
      if (r.facts) push(r.id, "NEW", r.searchId, r.domain, r.gt, r.facts, r.title ?? "", r.url);
    for (const r of gt.filter((x) => x.humanGt === "SAME")) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (!c.candidate?.facts) continue;
      for (const sid of Object.keys(IDS))
        if (sid !== r.searchId) push(`${sid}/${r.id}`, "DERIVED", sid, r.domain, "DIFFERENT", c.candidate.facts, c.candidate.title ?? "", r.candidateUrl);
    }

    /** 🔴 운영 owner. `strip` 으로 **방어축을 하나씩 뺀다**(counterfactual 전용). */
    function run(it: It, mode: "BASE" | "L4" | "L4_NO_COLOR" | "L4_NO_CATEGORY" | "L4_ONLY_BRAND") {
      const o = of[it.origin];
      const cross = compareCrossSellerProducts(o, it.cand) as any;
      const oCode = (o.brandModelCode as string | null) ?? null;
      const dCode = (it.cand.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: it.title, url: it.url });
      const mc = compareModelCode(oCode, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, it.cand.colorText ?? null);
      let confs: string[] = (cross.conflicts ?? []).map((c: any) => c.conflict);
      /** 🔴 방어축 제거 — 그 축이 **하중을 지는지** 보기 위해서다. */
      if (mode === "L4_NO_COLOR") confs = confs.filter((c) => c !== "COLOR");
      if (mode === "L4_NO_CATEGORY") confs = confs.filter((c) => c !== "CATEGORY");
      if (mode === "L4_ONLY_BRAND") confs = confs.filter((c) => c === "MODEL_CODE");
      const brandSame = Boolean(o.brand && it.cand.brand && String(o.brand).toLowerCase().replace(/\s+/g, "") === String(it.cand.brand).toLowerCase().replace(/\s+/g, ""));
      const demote =
        mode !== "BASE" && cross.verdict === "CONFLICT" && confs.length > 0 && confs.every((c) => c === "MODEL_CODE") && brandSame && !cu;
      const truth = deriveMatchTruth(
        "very_high",
        (demote ? "unavailable" : mc) as never,
        (demote ? "SAME" : cross.verdict) as never,
        (cross.blockers ?? []) as never,
        (cross.conflicts ?? []) as never,
        cu,
      );
      const om = oCode ? LINE.exec(oCode.toUpperCase()) : null;
      const dm = dCode ? LINE.exec(String(dCode).toUpperCase()) : null;
      return {
        tier: priceTierFromLink({ matchTruth: truth, verified: false } as never),
        verdict: cross.verdict, mc, cu, brandSame, oCode, dCode,
        rawConfs: (cross.conflicts ?? []).map((c: any) => c.conflict) as string[],
        oLine: om?.[2] ?? null, dLine: dm?.[2] ?? null,
      };
    }

    /* ── ① 위험 형태 탐색 ── */
    const diff = items.filter((x) => x.gt === "DIFFERENT");
    const risky = diff
      .map((it) => ({ it, r: run(it, "BASE") }))
      .filter(
        (x) =>
          x.r.mc === "conflict" && x.r.oLine && x.r.dLine && x.r.oLine !== x.r.dLine && x.r.brandSame &&
          !x.r.rawConfs.includes("COLOR") && !x.r.rawConfs.includes("CATEGORY"),
      );
    console.log("\n════════ ① 위험 형태 — 라인다름 + 같은브랜드 + COLOR/CATEGORY 충돌 없음 + DIFFERENT ════════");
    console.log(`   **${risky.length}건**`);
    for (const { it, r } of risky) console.log(`   🔴 ${it.id} ${it.domain} ${r.oCode}→${r.dCode} ${r.oLine}→${r.dLine} confs[${r.rawConfs.join("+")}]`);

    console.log("\n   ── 라인 다른 Human DIFFERENT 가 «무엇에» 걸리는가(전수) ──");
    const crossLineDiff = diff.map((it) => ({ it, r: run(it, "BASE") })).filter((x) => x.r.oLine && x.r.dLine && x.r.oLine !== x.r.dLine);
    const why: Record<string, number> = {};
    for (const { r } of crossLineDiff) {
      const k = !r.brandSame ? "브랜드 다름" : r.rawConfs.includes("COLOR") ? "COLOR 충돌" : r.rawConfs.includes("CATEGORY") ? "CATEGORY 충돌" : r.cu ? "색상 미확인" : "🔴 아무것도 안 막음";
      why[k] = (why[k] ?? 0) + 1;
    }
    console.log(`   분모 ${crossLineDiff.length}쌍 · ${JSON.stringify(why)}`);

    /* ── ③ 방어축 분해 ── */
    const scored = items.filter((x) => x.src !== "DERIVED" && (x.gt === "SAME" || x.gt === "DIFFERENT"));
    const derived = items.filter((x) => x.src === "DERIVED");
    const kpi = (set: It[], m: any) => {
      const ex = set.filter((x) => run(x, m).tier === "EXACT");
      return { ex: ex.length, s: ex.filter((x) => x.gt === "SAME").length, d: ex.filter((x) => x.gt === "DIFFERENT").length };
    };
    console.log("\n════════ ③ 방어축 분해 ════════");
    const MODES = [["BASE", "Baseline"], ["L4", "L4"], ["L4_NO_COLOR", "L4 − COLOR 방어"], ["L4_NO_CATEGORY", "L4 − CATEGORY 방어"], ["L4_ONLY_BRAND", "L4 − COLOR·CATEGORY 둘 다"]] as const;
    for (const [m, name] of MODES) {
      const a = kpi(scored, m), b = kpi(derived, m);
      console.log(` ${name.padEnd(26)} EXACT ${String(a.ex).padStart(2)} | SAME ${String(a.s).padStart(2)} · 🔴FalseSAME ${a.d} | 파생 EXACT ${b.ex} (🔴그중 DIFF ${b.d})`);
    }
    for (const [m, name] of MODES.slice(2)) {
      const newFp = [...scored, ...derived].filter((x) => x.gt === "DIFFERENT" && run(x, "L4").tier !== "EXACT" && run(x, m).tier === "EXACT");
      console.log(`\n 🔴 ${name} 로 새로 생기는 False SAME: **${newFp.length}건** ${newFp.map((x) => x.id).join(" ")}`);
    }

    /* ── ④ 안전성 회귀 ── */
    console.log("\n════════ ④ 회귀 anchor ════════");
    for (const id of ["C06", "S1-6"]) {
      const it = items.find((x) => x.id === id && x.src !== "DERIVED")!;
      console.log(`   ${id} CEO=${it.gt} ` + MODES.map(([m]) => `${m}=${run(it, m).tier}`).join(" · "));
    }

    /* ── ⑤ 샵 SKU ── */
    console.log("\n════════ ⑤ slug → 품번 승격 전수 ════════");
    const slugCode = items.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
      .map((x) => ({ x, slug: (() => { try { return new URL(x.url).pathname.split("/").filter(Boolean).pop() ?? ""; } catch { return ""; } })() }))
      .map((v) => ({ ...v, code: extractCodeLikeSlugSegment(v.slug) }))
      .filter((v) => v.code);
    for (const v of slugCode) console.log(`   ${v.x.domain.padEnd(24)} slug ${v.slug.slice(0, 40).padEnd(42)} → **${v.code}**`);

    writeFileSync(path.join(OUT, "wu-071.json"), JSON.stringify({ risky: risky.map((x) => x.it.id), why, modes: MODES.map(([m]) => ({ m, scored: kpi(scored, m), derived: kpi(derived, m) })) }, null, 1));

    /* ══════ 🔴 계약 ══════ */
    /** 🔴 위험 형태는 **0건** 이다 — 「안전」이 아니라 **미측정** 이다. */
    expect(risky).toHaveLength(0);
    /** 🔴 라인 다른 DIFFERENT 는 전부 **다른 축** 이 막는다 — 「아무것도 안 막음」이 0 이어야 한다. */
    expect(why["🔴 아무것도 안 막음"] ?? 0).toBe(0);
    /** 🟢 L4 는 False SAME 을 늘리지 않는다(Baseline 과 같다). */
    expect(kpi(scored, "L4").d).toBe(kpi(scored, "BASE").d);
    expect(kpi(derived, "L4").ex).toBe(0);
    /** 🔴🔴 **COLOR 방어를 빼면 즉시 뚫린다** — 그 축이 단독 하중을 진다. */
    const noColorFp = [...scored, ...derived].filter((x) => x.gt === "DIFFERENT" && run(x, "L4").tier !== "EXACT" && run(x, "L4_NO_COLOR").tier === "EXACT");
    expect(noColorFp.length).toBeGreaterThan(0);
    /** 🟢 anchor — C06·S1-6 은 모든 모드에서 EXACT(이 완화와 무관하다). */
    for (const id of ["C06", "S1-6"]) {
      const it = items.find((x) => x.id === id && x.src !== "DERIVED")!;
      for (const [m] of MODES) expect(run(it, m).tier, `${id}/${m}`).toBe("EXACT");
    }
    /** 🔴 ⑤ — kids21 의 **샵 자체 SKU** 가 slug 추출기를 통과한다(원인 고정). */
    expect(extractCodeLikeSlugSegment("700005621lbl")).toBe("700005621LBL");
    /** 🟢 그리고 브랜드 공식몰의 진짜 품번도 같은 함수로 들어온다 — **둘을 가를 수 없다**. */
    expect(extractCodeLikeSlugSegment("b226ac114-bobo-choses-bolder-half-zipped-sweatshirt")).toBe("B226AC114");
  });
});
