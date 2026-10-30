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
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-069 — **CONFLICT 과잉 차단 5건 분해** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── ① 원인은 **둘** 이고, 내가 처음 짚은 레버는 **헛다리였다** ──────────────
 * 5건 **전부** `crossSeller === "CONFLICT"` 이고 `deriveMatchTruth:176` 의
 * `if (crossSeller === "CONFLICT") return "CONFLICT"` 가 **먼저 이긴다**.
 * 🔴 그래서 `compareModelCode` 결과를 바꿔도 **아무 변화가 없다**(측정 0건).
 * ```
 * C33  B226AC009 ↔ B226AB040      conflicts [MODEL_CODE]
 * S1-7 B226AC010 ↔ B226AB046      conflicts [MODEL_CODE]
 * S2-3 B226AC009 ↔ B226AB040      conflicts [MODEL_CODE]
 * S2-4 B226AC009 ↔ **700005621LBL** conflicts [MODEL_CODE]  ← 샵 자체 SKU 다
 * C35  B226AC009 ↔ **null**        conflicts [**COMPOSITION**] ← 소재 충돌(품번 아님)
 * 🟢 다섯 다 **브랜드는 같다**(Bobo Choses) · 색상 미확인은 S2-4 하나뿐
 * ```
 * 🔴🔴 **`AC` ↔ `AB` 가 핵심 패턴** 이고, WU-048 이 「AB↔AC 변환 규칙이 아니다」로
 *    이미 HOLD 한 그 질문이다(baby 라인 ↔ kids 라인). 🔴 CEO 는 SAME 이라 했지만
 *    사유를 적지 않았다 — **라인 차이를 인지하고 고른 것인지 미확인** 이다.
 *
 * ── ②③ 삼중 잠금 ─────────────────────────────────────────────────────────
 * ```
 * ① crossSeller CONFLICT  ② modelCode conflict  ③ crossSellerReserved
 * 🔴 ①을 PRESUMED_SAME 으로 «내리면» ③이 다시 막는다 → L1·L2·L3 전부 **변화 0건**
 * ```
 *
 * ── ④⑤ Counterfactual (파생 135 포함) ────────────────────────────────────
 * | 레버 | EXACT | SAME | False SAME | prec | rec | 파생 |
 * |---|---|---|---|---|---|---|
 * | 현재 | 16 | 14 | **2** | 87.5% | 37.8% | 0 |
 * | L1 같은브랜드+MODEL_CODE뿐 → 보류 | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
 * | L2 + 색상 확인됨 | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
 * | L3 + 후보 색상 실재 | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
 * | 🔴 **L4 삼중 해제** | **19** | **17** | **2** | **89.5%** | **45.9%** | **0** |
 *
 * 🟢 L4 가 회복하는 것 **3건** — C33 · S1-7 · S2-3 (**전부 CEO SAME**)
 * 🟢 False SAME 증가 **0** · 파생 135 유입 **0** · C06/S1-6 anchor **불변**
 * 🔴 S2-4(샵 자체 SKU)·C35(COMPOSITION)는 **회복되지 않는다** — 조건 밖이다
 *
 * ── 🔴🔴 그래도 구현하지 않는다 ───────────────────────────────────────────
 * L4 는 `CONFLICT → SAME` **그리고** `modelCode conflict → unavailable` 둘을 동시에
 * 한다. 그것은 CPO 정책선(「품번이 충돌한다는 사실 자체는 계속 보호」)의 **해체** 다.
 * 🔴 그리고 그 조건의 실질은 **「같은 브랜드면 품번이 달라도 같은 상품」** 이다 —
 *    `AC`(kids) ↔ `AB`(baby) 를 같게 보는 것이고 WU-048 이 HOLD 한 바로 그 규칙이다.
 * ⟹ **HOLD.** 이 파일은 측정값과 삼중 잠금을 계약으로 고정만 한다.
 */
const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json")) &&
  existsSync(NEW_GT);

describe("WU-069 — CONFLICT 과잉 차단 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("5건 분해 + CF 넷", () => {
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    type Item = { id: string; src: string; origin: string; domain: string; gt: string | null; cand: any; title: string; url: string };
    const items: Item[] = [];
    const gt = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    for (const r of gt) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (!c.candidate?.facts) continue;
      items.push({ id: r.id, src: "OLD", origin: r.searchId, domain: r.domain, gt: r.humanGt ?? null, cand: c.candidate.facts, title: c.candidate.title ?? "", url: r.candidateUrl });
    }
    for (const r of JSON.parse(readFileSync(NEW_GT, "utf8")) as any[])
      if (r.facts) items.push({ id: r.id, src: "NEW", origin: r.searchId, domain: r.domain, gt: r.gt, cand: r.facts, title: r.title ?? "", url: r.url });
    for (const r of gt.filter((x) => x.humanGt === "SAME")) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (!c.candidate?.facts) continue;
      for (const sid of Object.keys(IDS))
        if (sid !== r.searchId) items.push({ id: `${sid}/${r.id}`, src: "DERIVED", origin: sid, domain: r.domain, gt: "DIFFERENT", cand: c.candidate.facts, title: c.candidate.title ?? "", url: r.candidateUrl });
    }

    /** 운영 owner 를 그대로. `lever` 로 CONFLICT 승격만 바꿔 본다. */
    function run(it: Item, lever: "NONE" | "L1" | "L2" | "L3" | "L4") {
      const o = of[it.origin];
      const cross = compareCrossSellerProducts(o, it.cand) as any;
      const oCode = o.brandModelCode ?? null;
      const dCode = it.cand.brandModelCode ?? confirmBrandCodeInEvidence(oCode, { title: it.title, url: it.url });
      const mc = compareModelCode(oCode, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, it.cand.colorText ?? null);
      const confs: string[] = (cross.conflicts ?? []).map((c: any) => c.conflict);
      const brandSame = Boolean(o.brand && it.cand.brand && String(o.brand).toLowerCase().replace(/\s+/g, "") === String(it.cand.brand).toLowerCase().replace(/\s+/g, ""));
      /** 🔴 레버는 «modelCode conflict → CONFLICT 승격» 한 줄에만 건다. compareModelCode 는 안 바꾼다. */
      /**
       * 🔴🔴 **내 첫 레버가 헛다리였다** — 5건 전부 `crossSeller === "CONFLICT"` 이고
       *    `deriveMatchTruth` 에서 그 분기가 **먼저 이긴다**. `modelCode` 를 바꿔도
       *    아무 변화가 없다(측정: 세 레버 전부 0건).
       * 🟢 그래서 레버를 **진짜 게이트** 로 옮긴다 — `crossSeller CONFLICT` 승격이다.
       *    🔴 리포에 이미 선례가 있다: `conflicts` 가 **COLOR 뿐** 이면 SIMILAR 로 내린다.
       */
      let verdictIn = cross.verdict;
      const onlyModelCode = confs.length > 0 && confs.every((c) => c === "MODEL_CODE");
      const demote =
        lever === "L1" ? cross.verdict === "CONFLICT" && onlyModelCode && brandSame
        : lever === "L2" ? cross.verdict === "CONFLICT" && onlyModelCode && brandSame && !cu
        : lever === "L3" ? cross.verdict === "CONFLICT" && onlyModelCode && brandSame && !cu && (it.cand.colorText ?? null) !== null
        : lever === "L4" ? cross.verdict === "CONFLICT" && onlyModelCode && brandSame && !cu
        : false;
      /** 🔴 L1~L3 — CONFLICT 를 **SAME 으로 올리지 않는다**. 「확정하지 않음」으로 내린다. */
      if (demote && lever !== "L4") verdictIn = "PRESUMED_SAME";
      /**
       * 🔴🔴 L4 — **삼중 잠금을 전부 푼다**(비용 측정 전용 · 절대 구현 금지).
       *    ① crossSeller CONFLICT → **SAME** ② modelCode conflict → unavailable
       *    ③ 그래야 crossSellerReserved 도 안 걸린다. 즉 **품번 보호의 해체** 다.
       */
      let mcIn = mc;
      if (demote && lever === "L4") { verdictIn = "SAME"; mcIn = "unavailable" as never; }
      const truth = deriveMatchTruth("very_high", mcIn as never, verdictIn as never, (cross.blockers ?? []) as never, (cross.conflicts ?? []) as never, cu);
      return { tier: priceTierFromLink({ matchTruth: truth, verified: false } as never), truth, verdict: cross.verdict, mc, oCode, dCode, cu, confs, brandSame, blockers: (cross.blockers ?? []).map((b: any) => b.blocker) };
    }

    /* ───── ①②③ 5건 분해 ───── */
    const FIVE = ["C33", "C35", "S1-7", "S2-3", "S2-4"];
    console.log("\n════════ ①②③ CONFLICT 5건 분해 ════════");
    for (const id of FIVE) {
      const it = items.find((x) => x.id === id && x.src !== "DERIVED")!;
      const r = run(it, "NONE");
      console.log(`\n ${id}  ${it.domain}  (CEO ${it.gt})`);
      console.log(`   품번  원 ${JSON.stringify(r.oCode)}  ↔  후보 ${JSON.stringify(r.dCode)}   compareModelCode = **${r.mc}**`);
      console.log(`   cross verdict = **${r.verdict}** · conflicts [${r.confs.join("+")}] · blockers [${r.blockers.join("+")}]`);
      console.log(`   브랜드  원 ${JSON.stringify(of[it.origin].brand)} ↔ 후보 ${JSON.stringify(it.cand.brand)}  같은가=${r.brandSame} · colorUnverified=${r.cu}`);
      console.log(`   ⟹ 경로: ${r.verdict === "CONFLICT" ? "**cross-seller CONFLICT**(먼저 이긴다)" : r.mc === "conflict" ? "**modelCode conflict**" : "기타"}  → truth ${r.truth} → tier ${r.tier}`);
    }

    /* ───── ④⑤ counterfactual ───── */
    const scored = items.filter((x) => x.src !== "DERIVED" && (x.gt === "SAME" || x.gt === "DIFFERENT"));
    const derived = items.filter((x) => x.src === "DERIVED");
    const kpi = (set: Item[], lever: any) => {
      const ex = set.filter((x) => run(x, lever).tier === "EXACT");
      const s = ex.filter((x) => x.gt === "SAME").length, d = ex.filter((x) => x.gt === "DIFFERENT").length;
      const allSame = set.filter((x) => x.gt === "SAME").length;
      return { ex: ex.length, s, d, prec: ex.length ? (s / ex.length) * 100 : 0, rec: allSame ? (s / allSame) * 100 : 0 };
    };
    console.log("\n════════ ④⑤ Counterfactual (레버는 «CONFLICT 승격» 한 줄만) ════════");
    const LV = [
      ["NONE", "현재"],
      ["L1", "crossCONFLICT=MODEL_CODE뿐+같은브랜드 → 보류"],
      ["L2", "L1 + colorUnverified 아님"],
      ["L3", "L2 + 후보 색상 실재"],
      ["L4", "🔴 삼중 잠금 전부 해제(비용 측정)"],
    ] as const;
    for (const [lv, name] of LV) {
      const a = kpi(scored, lv), b = kpi(derived, lv);
      console.log(` ${name.padEnd(34)} EXACT ${String(a.ex).padStart(2)} | SAME ${String(a.s).padStart(2)} · 🔴FalseSAME ${a.d} | prec ${a.prec.toFixed(1)}% · rec ${a.rec.toFixed(1)}%  | 파생 EXACT ${b.ex}`);
    }
    for (const [lv, name] of LV.slice(1)) {
      const ch = [...scored, ...derived].filter((x) => run(x, "NONE").tier !== run(x, lv as any).tier);
      console.log(`\n ${name} — 바뀌는 것 ${ch.length}:`);
      for (const x of ch) console.log(`    ${x.id.padEnd(10)} ${String(x.src).padEnd(8)} CEO=${String(x.gt).padEnd(10)} ${run(x, "NONE").tier} → ${run(x, lv as any).tier}  ${x.domain}`);
    }

    /* ───── ⑥ anchor ───── */
    console.log("\n════════ 안전성 anchor ════════");
    for (const id of ["C06", "S1-6"]) {
      const it = items.find((x) => x.id === id && x.src !== "DERIVED")!;
      console.log(`   ${id} CEO=${it.gt}  ` + LV.map(([lv, _]) => `${lv}=${run(it, lv as any).tier}`).join(" · "));
    }
    writeFileSync(path.join(OUT, "wu-069.json"), JSON.stringify(items.map((x) => ({ id: x.id, src: x.src, gt: x.gt, ...Object.fromEntries(LV.map(([lv]) => [lv, run(x, lv as any).tier])) })), null, 1));
    /* ══════ 🔴 계약 ══════ */
    expect(scored.length).toBe(63);
    /** 🔴 5건 전부 `crossSeller CONFLICT` 다 — 그것이 먼저 이긴다. */
    for (const id of FIVE) {
      const r = run(items.find((x) => x.id === id && x.src !== "DERIVED")!, "NONE");
      /**
             * 🔵🔵 AGE-LINE-POLICY-01(CPO GO) — 품번 단독 충돌 + 연령어휘 제거 후 핵심 상품명 완전일치면 조기 반환을 건너뛴다. 🔴 그래도 blocker(MODEL_CODE_AGE_LINE)가 SAME 을 막고, matchTruth 는 MODEL_CODE 충돌을 그대로 보아 **tier 는 EXCLUDED 유지** 다(가격 축 미유입).
             * 🔴 C33(junioredition)만 **PRESUMED_SAME** 으로 내려온다 — 나머지 넷은 그대로다.
             * 🟢 그리고 **tier 는 다섯 모두 EXCLUDED 유지** 다(아래 단언 불변).
             */
            expect(["CONFLICT", "PRESUMED_SAME"], id).toContain(r.verdict);
      expect(r.tier, id).toBe("EXCLUDED");
      expect(r.brandSame, id).toBe(true);
    }
    /** 🔴 C35 만 충돌 사유가 **COMPOSITION** 이다(품번이 아니다). */
    expect(run(items.find((x) => x.id === "C35" && x.src !== "DERIVED")!, "NONE").confs).toEqual(["COMPOSITION"]);
    /** 🔴🔴 삼중 잠금 — ①을 내려도 ③이 막는다. L1·L2·L3 는 **변화 0건** 이다. */
    for (const lv of ["L1", "L2", "L3"] as const)
      expect([...scored, ...derived].filter((x) => run(x, "NONE").tier !== run(x, lv).tier), lv).toHaveLength(0);
    /** 🟡 L4(삼중 해제)만 움직인다 — SAME 3건 회복 · False SAME 증가 0 · 파생 유입 0. */
    const l4 = kpi(scored, "L4");
    /**
     * 🔵🔵 AGE-LINE-POLICY-01(CPO GO) — **이 반사실 숫자가 17 → 15 로 줄었다.**
     *    이유: 운영이 이제 「품번 단독 충돌 + 연령 어휘 뺀 핵심 상품명 완전일치」에
     *    `MODEL_CODE_AGE_LINE` blocker 를 세운다. 그 blocker 는 **L4 반사실에서도**
     *    남아 verdict 가 SAME 에 닿지 못하게 한다.
     * 🟢 줄어든 2 는 **손실이 아니라 보호** 다 — 「삼중 잠금을 다 풀어도 AB/AC 가
     *    SAME 으로 확정되지 않는다」는 뜻이고 CPO 금지(「AB/AC 무조건 SAME」)와 같은 방향이다.
     * 🔴 운영 영향 **0** — 반사실 전용 숫자다(운영 축은 아래 tier 비교다).
     */
    expect(l4.s).toBe(15);
    expect(l4.d).toBe(2);
    expect(kpi(derived, "L4").ex).toBe(0);
    /**
     * 🔵🔵 AGE-LINE-POLICY-01 — **L4 증분이 3 → 1 로 줄었다.**
     *    C33 과 S2-3 은 이제 baseline 에서도 L4 에서도 같은 tier(EXCLUDED)다 —
     *    새 blocker 가 양쪽에서 동일하게 작용하기 때문이다.
     * 🟢 즉 「삼중 잠금을 다 풀어야 움직이던」 둘을 **품번 보호를 해체하지 않고**
     *    보류 단계까지 끌어올렸다. 남은 증분은 S1-7 하나다.
     */
    expect([...scored, ...derived].filter((x) => run(x, "NONE").tier !== run(x, "L4").tier).map((x) => x.id)).toEqual(["S1-7"]);
    /** 🟢 anchor — C06·S1-6 은 어떤 레버에서도 EXACT 그대로(완화가 이들을 건드리지 않는다). */
    for (const id of ["C06", "S1-6"]) {
      const it = items.find((x) => x.id === id && x.src !== "DERIVED")!;
      expect(it.gt, id).toBe("DIFFERENT");
      for (const lv of ["NONE", "L1", "L2", "L3", "L4"] as const) expect(run(it, lv).tier, `${id}/${lv}`).toBe("EXACT");
    }
  });
});
