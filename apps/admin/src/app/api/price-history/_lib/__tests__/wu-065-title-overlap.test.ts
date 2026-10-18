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

const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;
/** 🔴 토큰 집합의 «문자 체계» 를 센다. 「언어」를 추정하지 않는다 — 글자를 본다. */
const script = (tokens: string[]) => {
  const ko = tokens.filter((t) => HANGUL.test(t)).length;
  const la = tokens.filter((t) => LATIN.test(t) && !HANGUL.test(t)).length;
  return { ko, la, label: ko > 0 && la > 0 ? "MIXED" : ko > 0 ? "KO" : la > 0 ? "LA" : "NONE" };
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-065 — **`NO_TITLE_OVERLAP` 전수 검증** (조사 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 생산 조건은 **하나** 다 — `cross-seller.ts:864-871`
 *    `jaccard(distinctiveTokensX, distinctiveTokensY) === 0` (카테고리 단어 제외).
 *    ⟹ **한국어 ↔ 영어 제목은 구조적으로 0 이 된다.**
 *
 * ── 전수 (GT 51) ──────────────────────────────────────────────────────────
 * ```
 * NO_TITLE_OVERLAP  **4/51** · **전부 국내 후보** (원제목 LA → 후보 MIXED)
 *   A 같은 문자체계인데 겹침 0 (진짜 불일치)   **0건**  ← 🔴 분모가 없다
 *   B 언어만 다르고 독립증거 충분             2건  C07 **SAME** · C08 **DIFFERENT**
 *   C 언어 다르고 독립증거 부족               2건  C15 SAME · C47 SAME
 * 토큰 실물
 *   C07 원[hug hairy monster shirt] 후[보보쇼즈 허그 헤어리 몬스터 티셔츠 b226ac009]  ← 음역
 *   C08 원[hug hairy monster shirt] 후[보보쇼즈 키즈 긴팔티셔츠 b226ac009 since 2002] ← 상품명 **없음**
 * ```
 * 🔴🔴 **B 군 2건 중 1건이 Human DIFFERENT 다.** 즉 CPO 가 제안한 B 기준
 *    (품번 exact + 독립증거 ≥2)은 **동일성을 보장하지 않는다**(C08 사유 「컬러 다름」).
 *
 * ── Counterfactual ────────────────────────────────────────────────────────
 * ```
 * 현재                              EXACT 12 | SAME 11 · DIFF 1 | prec 91.7% · recall 40.7%
 * CF-1 전면 비차단                   **변화 0건** (동일)
 * CF-2 + 품번 exact                  **변화 0건**
 * CF-3 + 품번 exact & 독립증거 ≥2     **변화 0건**
 * 🔴 단독 완화는 **효과가 0 이다** — 색상 축(`colorUnverified`)이 그 뒤에서 또 막는다
 * CF-4 색상 복구 **＋** 비차단        C47 +1 SAME · **False SAME 0** · prec 92.3%
 *      🟢 C08(DIFFERENT)은 `PRESUMED_SAME` 보류가 **한 겹 더** 막는다(blockers 가 비어도)
 * ```
 * 🟢 C06 은 `noOverlap=false` 라 **모든 CF 에서 불변** — regression anchor 유지.
 *
 * ⟹ 🟡 **HOLD.** False SAME 증가 0 이고 문자체계 판별도 안정적이라 REJECT 는 아니다.
 *    🔴 그러나 표본이 **4건** 이고 회복이 **1건** 이라 CPO 의 GO 조건
 *    (「충분한 표본에서 SAME 회복」)을 **충족하지 못한다**. 구현 **0**.
 */
const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json"));

describe("WU-065 — NO_TITLE_OVERLAP 전수 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("전수 분리 + CF 넷", () => {
    const rows = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    const all = rows
      .map((r) => {
        const o = of[r.searchId];
        const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
        if (!o || !existsSync(f)) return null;
        const cached = JSON.parse(readFileSync(f, "utf8"));
        const cand = cached.candidate?.facts;
        if (!cand) return null;
        const cross = compareCrossSellerProducts(o, cand) as any;
        const bl: string[] = (cross.blockers ?? []).map((b: any) => b.blocker);
        const dCode = cand.brandModelCode ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
        const modelCode = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
        const cu = isColorUnverified(o.colorText ?? null, cand.colorText ?? null);
        const t = (blockers: { blocker: string }[]) =>
          priceTierFromLink({
            matchTruth: deriveMatchTruth("very_high", modelCode as never, cross.verdict, blockers as never, (cross.conflicts ?? []) as never, cu),
            verified: false,
          } as never);
        const drop = (cross.blockers ?? []).filter((b: any) => b.blocker !== "NO_TITLE_OVERLAP");

        const oS = script(o.coreTitleTokens ?? []);
        const cS = script(cand.coreTitleTokens ?? []);
        /** 🔴 독립 증거 — 제목 «밖» 의 축만 센다. */
        const indep = {
          code: modelCode === "exact",
          brand: Boolean(o.brand && cand.brand),
          category: Boolean(o.categoryText && cand.categoryText),
          color: Boolean(o.colorText && cand.colorText),
        };
        const indepN = Object.values(indep).filter(Boolean).length;

        return {
          id: r.id, human: r.humanGt, domain: r.domain, noOverlap: bl.includes("NO_TITLE_OVERLAP"),
          oScript: oS.label, cScript: cS.label, oTok: (o.coreTitleTokens ?? []).slice(0, 5), cTok: (cand.coreTitleTokens ?? []).slice(0, 6),
          verdict: cross.verdict, blockers: bl, modelCode, colorUnverified: cu, indep, indepN,
          humanReason: r.humanReason ?? null,
          now: t(cross.blockers ?? []),
          cf1: t(drop),
          cf2: modelCode === "exact" ? t(drop) : t(cross.blockers ?? []),
          cf3: modelCode === "exact" && indepN >= 2 ? t(drop) : t(cross.blockers ?? []),
        };
      })
      .filter(Boolean) as any[];

    const NO = all.filter((x) => x.noOverlap);
    console.log(`\n════════ NO_TITLE_OVERLAP 전수 — ${NO.length}/${all.length} ════════`);
    console.log(" id  human      host                 원제목script 후보script 품번        독립증거 현재tier    blockers");
    for (const x of NO)
      console.log(
        ` ${x.id} ${String(x.human).padEnd(10)} ${x.domain.padEnd(20)} ${x.oScript.padEnd(11)} ${x.cScript.padEnd(9)} ${x.modelCode.padEnd(11)} ${String(x.indepN).padEnd(8)} ${x.now.padEnd(11)} [${x.blockers.join("+")}]`,
      );

    console.log("\n──  A/B/C 분리 ──");
    const cls = (x: any) =>
      x.oScript === x.cScript ? "A 같은 문자체계인데 겹침 0 (진짜 불일치 가능)" : x.modelCode === "exact" && x.indepN >= 2 ? "B 언어만 다르고 독립증거 충분" : "C 언어도 다르고 독립증거 부족";
    const g: Record<string, any[]> = {};
    for (const x of NO) (g[cls(x)] ??= []).push(x);
    for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length))
      console.log(` ${String(v.length).padStart(2)}  ${k}\n       ${v.map((x) => `${x.id}:${x.human}:${x.oScript}→${x.cScript}`).join(" ")}`);

    console.log("\n──  토큰 실물 (B/C 후보) ──");
    for (const x of NO.filter((y) => y.oScript !== y.cScript))
      console.log(` ${x.id} 원[${x.oTok.join(" ")}]  후[${x.cTok.join(" ")}]`);

    const kpi = (sel: string) => {
      const ex = all.filter((x) => x[sel] === "EXACT");
      const s = ex.filter((x) => x.human === "SAME").length;
      const d = ex.filter((x) => x.human === "DIFFERENT").length;
      return `EXACT ${String(ex.length).padStart(2)} | SAME ${String(s).padStart(2)} · DIFFERENT ${d} | precision ${ex.length ? ((s / ex.length) * 100).toFixed(1) : "-"}% · recall ${((s / all.filter((x) => x.human === "SAME").length) * 100).toFixed(1)}%`;
    };
    console.log("\n════════ Counterfactual ════════");
    console.log(` 현재                                   ${kpi("now")}`);
    console.log(` CF-1 NO_TITLE_OVERLAP 전면 비차단       ${kpi("cf1")}`);
    console.log(` CF-2 + 품번 exact 조건                  ${kpi("cf2")}`);
    console.log(` CF-3 + 품번 exact & 독립증거 ≥2         ${kpi("cf3")}`);
    for (const sel of ["cf1", "cf2", "cf3"]) {
      const ch = all.filter((x) => x.now !== x[sel]);
      console.log(`\n ${sel} 로 바뀌는 후보 (${ch.length}):`);
      for (const x of ch) console.log(`   ${x.id} ${String(x.human).padEnd(10)} ${x.domain.padEnd(20)} ${x.now} → ${x[sel]}  ${x.oScript}→${x.cScript} code=${x.modelCode} indep=${x.indepN}`);
    }

    /* ── 🔴 결정적 — 색상 복구 «와» NO_TITLE_OVERLAP 비차단을 **동시에** 하면? ── */
    console.log("\n==== CF-4 결합: 색상 복구 + NO_TITLE_OVERLAP 비차단 ====");
    const RECOVERED: Record<string, string> = { C07: "라이트 블루", C47: "블루", C23: "Graystone", C24: "Graystone", C08: "블루" };
    const comb = rows
      .map((r) => {
        const o = of[r.searchId];
        const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
        if (!o || !existsSync(f)) return null;
        const cached = JSON.parse(readFileSync(f, "utf8"));
        const b0 = cached.candidate?.facts;
        if (!b0) return null;
        const cand = RECOVERED[r.id] ? { ...b0, colorText: RECOVERED[r.id] } : b0;
        const cross = compareCrossSellerProducts(o, cand) as any;
        const dCode = cand.brandModelCode ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
        const mc = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
        const cu = isColorUnverified(o.colorText ?? null, cand.colorText ?? null);
        const drop = (cross.blockers ?? []).filter((b: any) => b.blocker !== "NO_TITLE_OVERLAP");
        const tier = priceTierFromLink({
          matchTruth: deriveMatchTruth("very_high", mc as never, cross.verdict, drop as never, (cross.conflicts ?? []) as never, cu),
          verified: false,
        } as never);
        return { id: r.id, human: r.humanGt, domain: r.domain, verdict: cross.verdict, blockers: drop.map((b: any) => b.blocker), cu, tier };
      })
      .filter(Boolean) as any[];
    const baseTier = new Map(all.map((x) => [x.id, x.now]));
    for (const x of comb.filter((y) => baseTier.get(y.id) !== y.tier))
      console.log(`   ${x.id} ${String(x.human).padEnd(10)} ${x.domain.padEnd(20)} ${baseTier.get(x.id)} → ${x.tier}  verdict=${x.verdict} colorUnv=${x.cu} blockers=[${x.blockers.join("+")}]`);
    const e4 = comb.filter((x) => x.tier === "EXACT");
    console.log(`   EXACT ${e4.length} | SAME ${e4.filter((x) => x.human === "SAME").length} · DIFFERENT ${e4.filter((x) => x.human === "DIFFERENT").length}`);
    const c8 = comb.find((x) => x.id === "C08")!;
    console.log(`   🔴 C08 (Human DIFFERENT) tier=${c8.tier} verdict=${c8.verdict} colorUnv=${c8.cu} blockers=[${c8.blockers.join("+")}] ⟹ ${c8.tier === "EXACT" ? "🔴 뚫린다" : "🟢 막힌다"}`);

    console.log("\n──  🔴 C06 regression anchor ──");
    const c06 = all.find((x) => x.id === "C06")!;
    console.log(`   C06 noOverlap=${c06.noOverlap} now=${c06.now} cf1=${c06.cf1} cf2=${c06.cf2} cf3=${c06.cf3} (Human ${c06.human})`);

    writeFileSync(path.join(OUT, "wu-065.json"), JSON.stringify(all, null, 1));

    /* ══════ 🔴 계약 ══════ */
    expect(all.length).toBe(51);
    /** 🔴 NO_TITLE_OVERLAP 은 **4건** 이고 전부 국내 후보다(원 LA → 후보 MIXED). */
    expect(NO.map((x) => x.id)).toEqual(["C07", "C08", "C15", "C47"]);
    for (const x of NO) {
      expect(x.oScript, x.id).toBe("LA");
      expect(x.cScript, x.id).toBe("MIXED");
    }
    /** 🔴 **A 군(같은 문자체계인데 겹침 0)이 0건** 이다 — 「진짜 불일치」 분모가 없다. */
    expect(NO.filter((x) => x.oScript === x.cScript)).toHaveLength(0);
    /** 🔴🔴 B 군에 Human DIFFERENT 가 있다 — 그 기준이 동일성을 보장하지 않는다. */
    const B = NO.filter((x) => x.modelCode === "exact" && x.indepN >= 2);
    expect(B.map((x) => x.id)).toEqual(["C07", "C08"]);
    expect(B.filter((x) => x.human === "DIFFERENT").map((x) => x.id)).toEqual(["C08"]);
    /** 🔴 단독 완화 셋 전부 **효과 0**. */
    for (const sel of ["cf1", "cf2", "cf3"]) expect(all.filter((x) => x.now !== x[sel]), sel).toHaveLength(0);
    /** 🟡 결합(CF-4)만 효과가 있다 — C47 하나 · False SAME 0. */
    expect(comb.filter((x) => baseTier.get(x.id) !== x.tier).map((x) => x.id)).toEqual(["C47"]);
    expect(e4.filter((x) => x.human === "DIFFERENT")).toHaveLength(1); // C06(기존 1건) 그대로
    /** 🟢 C08 은 결합 CF 에서도 막힌다 — `PRESUMED_SAME` 보류가 한 겹 더 있다. */
    expect(c8.tier).not.toBe("EXACT");
    expect(c8.verdict).toBe("PRESUMED_SAME");
    /** 🟢 C06 regression anchor — NO_TITLE_OVERLAP 과 무관하므로 모든 CF 에서 불변. */
    expect(c06.noOverlap).toBe(false);
    for (const k of ["cf1", "cf2", "cf3"] as const) expect(c06[k], k).toBe(c06.now);
  });
});
