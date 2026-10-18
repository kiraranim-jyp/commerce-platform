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
 * WU-066 — **GT 표본 확대 + 판별력 검증** (데이터/CF 스프린트 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Human GT 는 CTO 가 만들 수 없다.** WU-036 의 51건은 CEO 블라인드 리뷰 산출물이다.
 *    그래서 **새 사람 라벨을 지어내지 않았다.** 대신 기존 사람 라벨에서
 *    **논리적으로 «함의» 되는** 쌍만 파생시켰다:
 * ```
 * 전제  원상품 S1~S6 는 **서로 다른 여섯 상품** 이다(제목 전수 확인)
 * 규칙  후보 c 가 S_i 에 Human **SAME** 이면, (S_j, c) 는 j≠i 일 때 **DIFFERENT** 다
 *       — c 는 «하나의 상품 페이지» 이므로 두 상품일 수 없다
 * 산출  Human SAME 27 × 5 = **파생 DIFFERENT 135쌍**  → 총 **186쌍**
 * ```
 * 🔴 **Human DIFFERENT 후보는 파생에 쓰지 않았다** — 그것이 다른 원상품에는 SAME 일
 *    수 있기 때문이다(예: beaumonde 가 S5 에 DIFFERENT 지만 S1 에는 SAME 일 수 있다).
 *
 * 🔴🔴 **한계를 먼저 적는다**:
 * ```
 * ① 파생 쌍은 **운영에서 실제로 만들어지지 않는 조합** 이다(후보는 자기 원상품하고만 비교된다).
 *    ⟹ 「게이트가 **비동일 쌍을 거절하는가**」를 재는 **정밀도 시험** 으로만 쓴다.
 *    🔴 Recall 을 이 분모로 재지 않는다.
 * ② SAME 은 **한 건도 늘지 않았다**(27 그대로). 늘릴 방법이 사람 라벨뿐이다.
 * ③ 후보 도메인·원상품은 그대로다 — 「새 샵」이 들어온 것이 아니다.
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
/** 🔴 WU-064 에서 **실제 페이지에 있는 글자만** 확인한 색상. 지어내지 않았다. */
const RECOVERED: Record<string, string> = { C07: "라이트 블루", C47: "블루", C23: "Graystone", C24: "Graystone", C08: "블루" };

const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;
const script = (t: string[]) => {
  const ko = t.filter((x) => HANGUL.test(x)).length;
  const la = t.filter((x) => LATIN.test(x) && !HANGUL.test(x)).length;
  return ko > 0 && la > 0 ? "MIXED" : ko > 0 ? "KO" : la > 0 ? "LA" : "NONE";
};

const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json"));

describe("WU-066 — 확대 GT 판별력 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("186쌍 · Baseline / CF-1 / CF-2 / CF-3", () => {
    const rows = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const origins: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      origins[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    /** 🔴 네 정책을 **같은 owner** 로 돌린다. 게이트를 재구현하지 않는다. */
    function evalPair(originId: string, r: any, opts: { color?: boolean; dropTitle?: boolean; dropReserve?: boolean }) {
      const o = origins[originId];
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) return null;
      const cached = JSON.parse(readFileSync(f, "utf8"));
      const b0 = cached.candidate?.facts;
      if (!b0) return null;
      const cand = opts.color && RECOVERED[r.id] ? { ...b0, colorText: RECOVERED[r.id] } : b0;
      const cross = compareCrossSellerProducts(o, cand) as any;
      let blockers = (cross.blockers ?? []) as { blocker: string }[];
      if (opts.dropTitle) blockers = blockers.filter((b) => b.blocker !== "NO_TITLE_OVERLAP");
      /** 🔴 CF-3 — `crossSellerReserved` 우회는 **counterfactual 전용** 이다(구현 금지). */
      const verdict = opts.dropReserve && cross.verdict === "PRESUMED_SAME" ? "SAME" : cross.verdict;
      const dCode = cand.brandModelCode ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title: cached.candidate?.title ?? "", url: r.candidateUrl });
      const mc = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, (cand.colorText as string | null) ?? null);
      const truth = deriveMatchTruth("very_high", mc as never, verdict as never, blockers as never, (cross.conflicts ?? []) as never, cu);
      return {
        tier: priceTierFromLink({ matchTruth: truth, verified: false } as never),
        verdict: cross.verdict, blockers: blockers.map((b) => b.blocker), modelCode: mc, colorUnverified: cu,
        oScript: script(o.coreTitleTokens ?? []), cScript: script((cand.coreTitleTokens as string[]) ?? []),
      };
    }

    /* ── 표본 구성 ── */
    type P = { pid: string; originId: string; r: any; label: "SAME" | "DIFFERENT" | "OTHER"; derived: boolean };
    const pairs: P[] = [];
    for (const r of rows)
      pairs.push({ pid: `${r.searchId}/${r.id}`, originId: r.searchId, r, label: r.humanGt === "SAME" ? "SAME" : r.humanGt === "DIFFERENT" ? "DIFFERENT" : "OTHER", derived: false });
    for (const r of rows.filter((x) => x.humanGt === "SAME"))
      for (const sid of Object.keys(IDS))
        if (sid !== r.searchId) pairs.push({ pid: `${sid}/${r.id}`, originId: sid, r, label: "DIFFERENT", derived: true });

    const OPTS = {
      base: {},
      cf1: { dropTitle: true },
      cf2: { dropTitle: true, color: true },
      cf3: { dropTitle: true, color: true, dropReserve: true },
    } as const;

    const data = pairs
      .map((p) => {
        const e: Record<string, any> = { ...p };
        for (const k of Object.keys(OPTS) as (keyof typeof OPTS)[]) e[k] = evalPair(p.originId, p.r, OPTS[k]);
        return e.base ? e : null;
      })
      .filter(Boolean) as any[];

    const human = data.filter((x) => !x.derived);
    const derived = data.filter((x) => x.derived);
    console.log(`\n════════ 표본 ════════`);
    console.log(` Human GT ${human.length} (SAME ${human.filter((x) => x.label === "SAME").length} · DIFFERENT ${human.filter((x) => x.label === "DIFFERENT").length} · 기타 ${human.filter((x) => x.label === "OTHER").length})`);
    console.log(` 파생 DIFFERENT ${derived.length}  ⟹ 합계 **${data.length}쌍**  (🔴 SAME 은 늘지 않았다)`);

    /* ── A 군 분모가 깨졌는가 ── */
    const noOv = data.filter((x) => x.base.blockers.includes("NO_TITLE_OVERLAP"));
    /**
     * 🔴 **직전 집계가 틀렸다** — `oScript`/`cScript` 는 `x.base` 안에 있는데
     *    `x.oScript` 로 읽어 `undefined === undefined` 가 **전부 참** 이 됐다(36/36).
     *    🟢 owner 결과에서 읽도록 고쳤다.
     */
    const A = noOv.filter((x) => x.base.oScript === x.base.cScript);
    console.log(`\n════════ A 군 분모 ════════`);
    console.log(` NO_TITLE_OVERLAP ${noOv.length}쌍 (Human ${noOv.filter((x) => !x.derived).length} · 파생 ${noOv.filter((x) => x.derived).length})`);
    console.log(` 🔴 A 군(같은 문자체계인데 겹침 0) **${A.length}쌍** — label: ${JSON.stringify(A.reduce((a: any, x) => ((a[x.label] = (a[x.label] ?? 0) + 1), a), {}))}`);
    const byScript: Record<string, number> = {};
    for (const x of noOv) byScript[`${x.base.oScript}→${x.base.cScript}`] = (byScript[`${x.base.oScript}→${x.base.cScript}`] ?? 0) + 1;
    console.log(`    문자체계 분포: ${JSON.stringify(byScript)}`);
    console.log(` 🟢 ⟹ A 군 분모 ${A.length > 0 ? "**깨졌다**" : "여전히 0"}`);

    /* ── 정책별 KPI ── */
    const kpi = (sel: string) => {
      const ex = data.filter((x) => x[sel].tier === "EXACT");
      const s = ex.filter((x) => x.label === "SAME").length;
      const d = ex.filter((x) => x.label === "DIFFERENT").length;
      const allSame = data.filter((x) => x.label === "SAME").length;
      return { n: ex.length, s, d, prec: ex.length ? (s / ex.length) * 100 : 0, rec: (s / allSame) * 100 };
    };
    console.log(`\n════════ 정책별 (전체 ${data.length}쌍) ════════`);
    for (const [k, label] of [["base", "Baseline(현재)"], ["cf1", "CF-1 NO_TITLE_OVERLAP"], ["cf2", "CF-2 +color"], ["cf3", "CF-3 +reserve 우회"]] as const) {
      const v = kpi(k);
      console.log(` ${label.padEnd(26)} EXACT ${String(v.n).padStart(3)} | SAME ${String(v.s).padStart(2)} · 🔴 False SAME ${String(v.d).padStart(2)} | precision ${v.prec.toFixed(1)}% · recall ${v.rec.toFixed(1)}%`);
    }
    console.log(`\n🔴 파생 분모에서만 본 False SAME (운영 비재현 조합 · 정밀도 시험):`);
    for (const k of ["base", "cf1", "cf2", "cf3"]) {
      const fp = derived.filter((x) => x[k].tier === "EXACT");
      console.log(`   ${k.padEnd(5)} ${fp.length}/${derived.length}  ${fp.length ? fp.map((x) => `${x.pid}`).join(" ") : ""}`);
    }

    /* ── 회귀 anchor ── */
    console.log(`\n──  🔴 C06 / C08 anchor ──`);
    for (const id of ["C06", "C08"]) {
      const x = human.find((y) => y.r.id === id)!;
      console.log(`   ${id} ${x.label.padEnd(10)} base=${x.base.tier.padEnd(11)} cf1=${x.cf1.tier.padEnd(11)} cf2=${x.cf2.tier.padEnd(11)} cf3=${x.cf3.tier}`);
    }

    writeFileSync(path.join(OUT, "wu-066.json"), JSON.stringify(data.map((x) => ({ pid: x.pid, label: x.label, derived: x.derived, base: x.base.tier, cf1: x.cf1.tier, cf2: x.cf2.tier, cf3: x.cf3.tier })), null, 1));

    /* ══════ 🔴 계약 ══════ */
    expect(human).toHaveLength(51);
    expect(derived).toHaveLength(135);
    expect(data).toHaveLength(186);
    /**
     * 🟢🟢 **A 군 분모가 깨졌다** — WU-065 에서 **0** 이었다.
     *    18쌍이고 **전부 DIFFERENT** 다(영어↔영어인데 제목 겹침 0 = 진짜 다른 상품).
     * ⟹ 🔴 `NO_TITLE_OVERLAP` 은 **실제로 「다른 상품」을 잘 잡는다.** 전면 비차단은 위험하다.
     */
    expect(A).toHaveLength(18);
    expect(A.every((x) => x.label === "DIFFERENT")).toBe(true);
    expect(noOv).toHaveLength(36);

    /* 🔴🔴 CF-3(crossSellerReserved 우회)은 **확대 표본에서 참사다** — REJECT 근거. */
    const k3 = kpi("cf3");
    expect(k3.d).toBeGreaterThanOrEqual(16);
    expect(k3.prec).toBeLessThan(60);
    /** 🟢 CF-1·CF-2 는 확대 분모에서도 False SAME 증가 0 이다. */
    for (const k of ["base", "cf1", "cf2"]) expect(derived.filter((x) => x[k].tier === "EXACT"), k).toHaveLength(0);
    /** 🔴 C08 은 CF-3 에서 **뚫린다** — ③ 보호가 유일한 방어라는 증거. */
    expect(human.find((x) => x.r.id === "C08")!.cf3.tier).toBe("EXACT");
    /** 🔴 Baseline 의 False SAME 은 **C06 하나** 여야 한다(파생 분모에서 추가 누출 0). */
    const baseFp = data.filter((x) => x.base.tier === "EXACT" && x.label === "DIFFERENT");
    expect(baseFp.map((x) => x.pid)).toEqual(["S2/C06"]);
    /** 🟢 C06·C08 은 모든 CF 에서 anchor 다. */
    const c06 = human.find((x) => x.r.id === "C06")!;
    expect(c06.base.tier).toBe("EXACT");
    const c08 = human.find((x) => x.r.id === "C08")!;
    expect(c08.base.tier).not.toBe("EXACT");
  });
});
