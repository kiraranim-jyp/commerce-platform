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

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-070 — **`AC ↔ AB` 라인 충돌 안전성 검증** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 품번 구조가 파싱된다 — Bobo Choses 는 `B<season><LINE><num>` 이다.
 * ```
 * 관측된 라인 코드   **AC** 6 · **AB** 2 · **AI** 1
 * 구조 밖           `AW26MS185`(Main Story) · `01195-VERNICE-NERO`(PèPè) ·
 *                   🔴 `700005621LBL`(kids21 **샵 자체 SKU**)
 * ```
 *
 * ── 🔴🔴 핵심 — **AC↔AB 는 DIFFERENT 분모가 0 이고, AC↔AC 는 있다** ────────
 * ```
 * AC ↔ AB   C33 (AC009↔AB040) · S2-3 (AC009↔AB040) · S1-7 (AC010↔AB046)
 *           ⟹ **전부 Human SAME · DIFFERENT 0건**
 * AC ↔ AC   S1-5 (AC010↔AC141) · C49 (AC010↔AC160) · C39 (AI018↔AC130) 등
 *           ⟹ **Human DIFFERENT 가 있다** — 같은 라인인데 번호가 다르면 다른 상품이다
 * ```
 * 🔴 번호 변환 규칙은 **없다** — 040−009=31 · 046−010=36 (일정하지 않다).
 *    WU-048 의 「AB↔AC 변환 규칙이 아니다」와 정합한다.
 *
 * ── L4 가 완화하는 조건을 코드 수준에서 명세 ──────────────────────────────
 * ```
 * if (crossSeller === "CONFLICT"
 *     && conflicts.every(c => c.conflict === "MODEL_CODE")   // 충돌 사유가 품번뿐
 *     && brandSame                                           // 양쪽 브랜드가 같다
 *     && !colorUnverified)                                   // 색상이 확인됐다
 *   → verdict = "SAME"  **그리고**  modelCode = "unavailable"
 * ```
 * 🔴 **라인 코드를 전혀 보지 않는다.** `AC↔AB` 든 `AC↔AC` 든 **같은 강도로** 해제한다.
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
/** 🔴 서술용 파서일 뿐 운영 규칙이 아니다 — 라인 코드를 «보기 위해» 쓴다. */
const LINE = /^B(\d{3})([A-Z]{2})(\d+)/;

const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json")) &&
  existsSync(NEW_GT);

describe("WU-070 — 라인 코드 충돌 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("충돌 쌍 전수 분류 + L4 위험 측정", () => {
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    type It = { id: string; src: string; origin: string; domain: string; gt: string | null; cand: any; title: string; url: string };
    const items: It[] = [];
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
        if (sid !== r.searchId)
          items.push({ id: `${sid}/${r.id}`, src: "DERIVED", origin: sid, domain: r.domain, gt: "DIFFERENT", cand: c.candidate.facts, title: c.candidate.title ?? "", url: r.candidateUrl });
    }

    /** 🔴 운영 owner 그대로. L4 는 counterfactual 전용(구현 금지). */
    function run(it: It, l4: boolean) {
      const o = of[it.origin];
      const cross = compareCrossSellerProducts(o, it.cand) as any;
      const oCode = (o.brandModelCode as string | null) ?? null;
      const dCode = (it.cand.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(oCode, { title: it.title, url: it.url });
      const mc = compareModelCode(oCode, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, it.cand.colorText ?? null);
      const confs: string[] = (cross.conflicts ?? []).map((c: any) => c.conflict);
      const brandSame = Boolean(o.brand && it.cand.brand && String(o.brand).toLowerCase().replace(/\s+/g, "") === String(it.cand.brand).toLowerCase().replace(/\s+/g, ""));
      const demote = l4 && cross.verdict === "CONFLICT" && confs.length > 0 && confs.every((c) => c === "MODEL_CODE") && brandSame && !cu;
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
        tier: priceTierFromLink({ matchTruth: truth, verified: false } as never), verdict: cross.verdict, mc, cu, confs, brandSame,
        oCode, dCode, oLine: om?.[2] ?? null, dLine: dm?.[2] ?? null, oNum: om?.[3] ?? null, dNum: dm?.[3] ?? null,
        shape: om && dm ? (om[2] === dm[2] ? "같은 라인 · 번호 다름" : "**라인 다름**") : oCode && dCode ? "구조 밖" : "품번 부족",
      };
    }

    /* ── ① 품번이 양쪽 다 있고 conflict 인 쌍 전수 ── */
    const conf = items.map((it) => ({ it, r: run(it, false) })).filter((x) => x.r.mc === "conflict");
    console.log(`\n════════ ① 품번 충돌(compareModelCode = conflict) 전수 — ${conf.length}쌍 ════════`);
    console.log(" id         src      CEO        원품번 → 후보품번               라인             tier");
    for (const { it, r } of conf)
      console.log(` ${it.id.padEnd(10)} ${it.src.padEnd(8)} ${String(it.gt).padEnd(10)} ${String(r.oCode).padEnd(12)}→ ${String(r.dCode).padEnd(16)} ${String(r.oLine ?? "-")}→${String(r.dLine ?? "-")}  ${String(r.shape).padEnd(22)} ${r.tier}`);

    /* ── ② 라인 구조별 × Human 라벨 ── */
    console.log("\n════════ ② 라인 구조 × Human 라벨 ════════");
    const g: Record<string, Record<string, number>> = {};
    for (const { it, r } of conf) {
      const k = r.oLine && r.dLine ? `${r.oLine}↔${r.dLine}` : r.shape;
      (g[k] ??= {})[String(it.gt)] = ((g[k] ??= {})[String(it.gt)] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(g).sort()) console.log(`   ${k.padEnd(14)} ${JSON.stringify(v)}`);

    /* ── ③ L4 위험 — 라인 구조별로 무엇이 뚫리는가 ── */
    console.log("\n════════ ③ L4 가 해제하는 쌍 (라인 구조별) ════════");
    const opened = items.filter((it) => run(it, false).tier !== run(it, true).tier);
    for (const it of opened) {
      const r = run(it, false);
      console.log(`   ${it.id.padEnd(10)} ${it.src.padEnd(8)} CEO=${String(it.gt).padEnd(10)} ${String(r.oCode)}→${String(r.dCode)}  ${r.shape}  ${r.tier} → ${run(it, true).tier}`);
    }
    const openedDiff = opened.filter((it) => it.gt === "DIFFERENT");
    console.log(`   🔴 그중 Human DIFFERENT: **${openedDiff.length}건** ${openedDiff.map((x) => x.id).join(" ")}`);

    /* ── ④ 왜 AC↔AC DIFFERENT 는 L4 에서 안 뚫리는가 ── */
    console.log("\n════════ ④ 같은 라인 · 번호 다름 + Human DIFFERENT — L4 에서 막는 것은 무엇인가 ════════");
    for (const { it, r } of conf.filter((x) => x.it.gt === "DIFFERENT" && x.r.oLine && x.r.dLine)) {
      const after = run(it, true);
      console.log(`   ${it.id} ${String(r.oCode)}→${String(r.dCode)}  conflicts[${r.confs.join("+")}] brandSame=${r.brandSame} colorUnv=${r.cu}  ⟹ ${r.tier} → ${after.tier}  ${after.tier === "EXACT" ? "🔴 뚫린다" : "🟢 막힌다 — " + (!r.brandSame ? "브랜드 다름" : r.cu ? "**색상 미확인**" : r.confs.some((c) => c !== "MODEL_CODE") ? "**충돌 사유가 품번 외에도 있다**" : "?")}`);
    }

    writeFileSync(path.join(OUT, "wu-070.json"), JSON.stringify(conf.map(({ it, r }) => ({ id: it.id, src: it.src, gt: it.gt, oCode: r.oCode, dCode: r.dCode, oLine: r.oLine, dLine: r.dLine, shape: r.shape, confs: r.confs, cu: r.cu, tier: r.tier })), null, 1));

    /* ══════ 🔴 계약 ══════ */
    /**
     * 🟢🟢 **내 예측이 반증됐다 — DIFFERENT 분모가 «있다».**
     *    처음에 「AC↔AB DIFFERENT 0」으로 단언했는데 **2건** 이 나왔고(파생 S1/C33 · S6/C33),
     *    라인이 다른 충돌 전체로는 **17건** 이다(AC↔AB 2 · AC↔AI 9 · AI↔AB 1 · AI↔AC 5).
     * ⟹ 🔴 WU-069 가 「L4 위험의 분모가 0」이라 적은 것은 **AC↔AB 만 좁게 본 결과** 였다.
     *    이제 **분모가 생겼고 L4 를 실제로 시험할 수 있다**.
     */
    const crossLine = conf.filter((x) => x.r.oLine && x.r.dLine && x.r.oLine !== x.r.dLine);
    expect(crossLine.length).toBeGreaterThan(0);
    expect(crossLine.filter((x) => x.it.gt === "DIFFERENT").length).toBe(17);
    const acab = conf.filter((x) => x.r.oLine && x.r.dLine && ((x.r.oLine === "AC" && x.r.dLine === "AB") || (x.r.oLine === "AB" && x.r.dLine === "AC")));
    expect(acab.filter((x) => x.it.gt === "SAME").length).toBe(3);
    expect(acab.filter((x) => x.it.gt === "DIFFERENT").length).toBe(2);
    /** 🟢 반대로 **같은 라인 · 번호 다름** 에는 Human DIFFERENT 가 있다. */
    const sameLine = conf.filter((x) => x.r.oLine && x.r.dLine && x.r.oLine === x.r.dLine);
    expect(sameLine.filter((x) => x.it.gt === "DIFFERENT").length).toBeGreaterThan(0);
    /** 🔴 L4 가 여는 것은 **전부 Human SAME** 이다(이 표본에서는). */
    expect(openedDiff).toHaveLength(0);
    /** 🔴 번호 변환 규칙이 없다 — 관측된 두 쌍의 차이가 다르다. */
    const pairs = acab.map((x) => Math.abs(Number(x.r.dNum) - Number(x.r.oNum))).filter((n) => Number.isFinite(n));
    expect(new Set(pairs).size).toBeGreaterThan(1);
  });
});
