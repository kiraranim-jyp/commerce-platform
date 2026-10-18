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
 * WU-068 — **통합 GT(51 + 19) 재계산** (측정 전용 · CF-2 구현 **금지**)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 집계를 정정한다.** 지시서에 「SAME 11 · UNCERTAIN 5」로 적혔는데
 *    CEO 가 보낸 JSON 을 세면 **SAME 10 · DIFFERENT 3 · UNCERTAIN 6** 이다.
 *    (S1 SAME5/DIFF2 · S2 SAME4 · S3 SAME1/UNC1 · S4 UNC1 · S5 UNC1 · S6 UNC3/DIFF1)
 *    🔴 분모라서 중요하다 — 아래 숫자는 **10/3/6** 기준이다.
 *
 * ── 통합 결과 ─────────────────────────────────────────────────────────────
 * ```
 * 분모   기존 50(SAME 27·DIFF 23) + 신규 13(SAME 10·DIFF 3) = **63**
 *        🔴 UNCERTAIN **7건**(기존 1 + 신규 6)은 분모에서 **제외**(억지로 환산하지 않는다)
 * Baseline  EXACT **16** = SAME **14** · False SAME **2**
 *           precision **87.5%** (51건만일 때 91.7%) · recall 14/37 = 37.8%
 * CF-2      EXACT **17** = SAME **15** · False SAME **2** · precision 88.2% · recall 40.5%
 *           🟢 파생 135 를 더해도 **숫자가 같다**(파생에서 EXACT 0)
 * ```
 * 🔴🔴 **새 False EXACT 1건** — `S1-6 tinyapple.net` · CEO 사유 **「반팔이고, 컬러 다름」**
 *    C06 과 **같은 클래스** 이고 **같은 샵** 이다(WU-060 의 C05 가 tinyapple 이었다).
 *
 * ── 🔴 그리고 반대 방향 결함이 처음 보인다 — **과잉 차단 3건** ──────────────
 * ```
 * S1-7 bobochoses.com  modelCode **conflict** → EXCLUDED  · CEO **SAME**
 * S2-3 bobochoses.com  modelCode **conflict** → EXCLUDED  · CEO **SAME**
 * S2-4 kids21.com      modelCode **conflict** → EXCLUDED  · CEO **SAME**
 * 🟢 올바른 차단은 1건 — S1-5 junioredition (CEO DIFFERENT)
 * 🔴 기존 GT 에도 2건이 더 있었다(C33 junioredition · C35 bornyesterdaykids)
 *    ⟹ **CEO SAME 인데 EXCLUDED 가 통합 5건** 이다 — recall 손실의 최대 덩어리다
 * ```
 *
 * ── CF-2 ──────────────────────────────────────────────────────────────────
 * ```
 * 🔴 신규 19건에서 tier 가 바뀌는 것 **0건** · 통합 63건에서 새 승격 **C47 하나**
 * ⟹ 실제 Human SAME 회복 **1** · False SAME 증가 **0**
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
/** 🔴 WU-064 에서 **실제 페이지에 있는 글자만** 확인한 색상. */
const RECOVERED: Record<string, string> = { C07: "라이트 블루", C47: "블루", C23: "Graystone", C24: "Graystone", C08: "블루" };

const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json")) &&
  existsSync(NEW_GT);

describe("WU-068 — 통합 GT 재계산 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("51 + 19 통합 · Baseline / CF-2 · 파생 135 회귀", () => {
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as {
      id: string;
      canonical_product: unknown;
    }[];
    const origins: Record<string, ReturnType<typeof productFactsFromIdentityDna>> = {};
    for (const [sid, id] of Object.entries(IDS))
      origins[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product as never)));

    /** 🔴 네 정책을 **같은 owner** 로 돌린다. 게이트를 재구현하지 않는다. */
    function judge(
      originId: string,
      cand: Record<string, unknown>,
      title: string,
      url: string,
      opts: { color?: string | null; dropTitle?: boolean } = {},
    ) {
      const o = origins[originId];
      const c = opts.color ? { ...cand, colorText: opts.color } : cand;
      const cross = compareCrossSellerProducts(o as never, c as never) as {
        verdict: string;
        blockers?: { blocker: string }[];
        conflicts?: unknown[];
      };
      let bl = (cross.blockers ?? []) as { blocker: string }[];
      if (opts.dropTitle) bl = bl.filter((b) => b.blocker !== "NO_TITLE_OVERLAP");
      const dCode = (c.brandModelCode as string | null) ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title, url });
      const mc = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, (c.colorText as string | null) ?? null);
      const truth = deriveMatchTruth("very_high", mc as never, cross.verdict as never, bl as never, (cross.conflicts ?? []) as never, cu);
      return { tier: priceTierFromLink({ matchTruth: truth, verified: false } as never), verdict: cross.verdict, modelCode: mc, blockers: bl.map((b) => b.blocker) };
    }

    type Row = { id: string; src: "OLD" | "NEW" | "DERIVED"; origin: string; domain: string; gt: string | null; why: string | null; base: ReturnType<typeof judge>; cf2: ReturnType<typeof judge> };
    const rows: Row[] = [];

    /* ── ① 기존 GT 51 ── */
    const gt = (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: Record<string, string>[] }).rows;
    for (const r of gt) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const cached = JSON.parse(readFileSync(f, "utf8")) as { candidate?: { title?: string; facts?: Record<string, unknown> } };
      const cand = cached.candidate?.facts;
      if (!cand) continue;
      rows.push({
        id: r.id, src: "OLD", origin: r.searchId, domain: r.domain, gt: r.humanGt ?? null, why: r.humanReason ?? null,
        base: judge(r.searchId, cand, cached.candidate?.title ?? "", r.candidateUrl),
        cf2: judge(r.searchId, cand, cached.candidate?.title ?? "", r.candidateUrl, { color: RECOVERED[r.id], dropTitle: true }),
      });
    }

    /* ── ② 신규 19 (CEO 라벨) ── */
    const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as {
      id: string; searchId: string; url: string; domain: string; gt: string | null; why: string | null;
      title: string | null; facts: Record<string, unknown> | null;
    }[];
    for (const r of nw) {
      if (!r.facts) continue;
      rows.push({
        id: r.id, src: "NEW", origin: r.searchId, domain: r.domain, gt: r.gt, why: r.why,
        base: judge(r.searchId, r.facts, r.title ?? "", r.url),
        cf2: judge(r.searchId, r.facts, r.title ?? "", r.url, { dropTitle: true }),
      });
    }

    /* ── ③ 파생 DIFFERENT 135 (WU-066) ── */
    for (const r of gt.filter((x) => x.humanGt === "SAME")) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const cached = JSON.parse(readFileSync(f, "utf8")) as { candidate?: { title?: string; facts?: Record<string, unknown> } };
      const cand = cached.candidate?.facts;
      if (!cand) continue;
      for (const sid of Object.keys(IDS)) {
        if (sid === r.searchId) continue;
        rows.push({
          id: `${sid}/${r.id}`, src: "DERIVED", origin: sid, domain: r.domain, gt: "DIFFERENT", why: null,
          base: judge(sid, cand, cached.candidate?.title ?? "", r.candidateUrl),
          cf2: judge(sid, cand, cached.candidate?.title ?? "", r.candidateUrl, { color: RECOVERED[r.id], dropTitle: true }),
        });
      }
    }

    const human = rows.filter((r) => r.src !== "DERIVED");
    const scored = human.filter((r) => r.gt === "SAME" || r.gt === "DIFFERENT");
    const derived = rows.filter((r) => r.src === "DERIVED");

    /* ── ① 분모 ── */
    const nwRows = rows.filter((r) => r.src === "NEW");
    console.log("\n════════ ①②③ 분모 ════════");
    console.log(` 기존 51  SAME ${human.filter((r) => r.src === "OLD" && r.gt === "SAME").length} · DIFFERENT ${human.filter((r) => r.src === "OLD" && r.gt === "DIFFERENT").length} · UNCERTAIN ${human.filter((r) => r.src === "OLD" && r.gt === "UNCERTAIN").length}`);
    console.log(` 신규 19  SAME ${nwRows.filter((r) => r.gt === "SAME").length} · DIFFERENT ${nwRows.filter((r) => r.gt === "DIFFERENT").length} · 🔴 UNCERTAIN ${nwRows.filter((r) => r.gt === "UNCERTAIN").length}  ← CPO 지시서의 11/5 를 정정한다`);
    console.log(` 채점 분모 **${scored.length}** (UNCERTAIN ${human.length - scored.length}건 제외) · 파생 ${derived.length}`);

    /* ── ④⑤⑩ 정책별 ── */
    const kpi = (set: Row[], sel: "base" | "cf2") => {
      const ex = set.filter((r) => r[sel].tier === "EXACT");
      const s = ex.filter((r) => r.gt === "SAME").length;
      const d = ex.filter((r) => r.gt === "DIFFERENT").length;
      const allSame = set.filter((r) => r.gt === "SAME").length;
      return { ex: ex.length, s, d, prec: ex.length ? (s / ex.length) * 100 : 0, rec: allSame ? (s / allSame) * 100 : 0 };
    };
    const show = (name: string, v: ReturnType<typeof kpi>) =>
      console.log(` ${name.padEnd(30)} EXACT ${String(v.ex).padStart(3)} | SAME ${String(v.s).padStart(2)} · 🔴 False SAME ${String(v.d).padStart(2)} | precision ${v.prec.toFixed(1)}% · recall ${v.rec.toFixed(1)}%`);
    console.log("\n════════ ④⑤ 정책별 ════════");
    const old51 = scored.filter((r) => r.src === "OLD");
    show("기존 51만 · Baseline", kpi(old51, "base"));
    show("통합 64 · Baseline", kpi(scored, "base"));
    show("통합 64 · CF-2", kpi(scored, "cf2"));
    show("통합 64 + 파생 135 · Base", kpi([...scored, ...derived], "base"));
    show("통합 64 + 파생 135 · CF-2", kpi([...scored, ...derived], "cf2"));

    /* ── ⑥ CF-2 가 새로 승격시키는 건 ── */
    console.log("\n════════ ⑥ CF-2 가 새로 EXACT 로 올리는 것 ════════");
    const promoted = [...scored, ...derived].filter((r) => r.base.tier !== "EXACT" && r.cf2.tier === "EXACT");
    if (!promoted.length) console.log("   없음");
    for (const r of promoted) console.log(`   ${r.id.padEnd(10)} ${String(r.src).padEnd(8)} CEO=${String(r.gt).padEnd(10)} ${r.domain}`);

    /* ── ⑩ 세 축 분리 ── */
    const b = kpi(scored, "base"), c = kpi(scored, "cf2"), o = kpi(old51, "base");
    console.log("\n════════ ⑩ 세 축을 분리한다 ════════");
    console.log(`  ⒜ 실제 Human SAME 회복(CF-2)      **${c.s - b.s}건**  ${promoted.filter((r) => r.gt === "SAME").map((r) => r.id).join(" ")}`);
    console.log(`  ⒝ False SAME 증가(CF-2)           **${c.d - b.d}건**`);
    console.log(`  ⒞ 분모 증가만으로 생긴 precision 변화  ${o.prec.toFixed(1)}% → ${b.prec.toFixed(1)}%  (**${(b.prec - o.prec).toFixed(1)}p** · CF-2 와 무관)`);

    /* ── ⑦ 신규 EXACT 4건 ── */
    console.log("\n════════ ⑦ WU-067 의 «라벨 없던 EXACT 4건» ════════");
    for (const r of nwRows.filter((r) => r.base.tier === "EXACT")) console.log(`   ${r.id} ${r.domain.padEnd(24)} CEO=${String(r.gt).padEnd(10)} ${r.why ?? ""}`);
    console.log("\n🔴 과잉 차단 — CEO SAME 인데 EXCLUDED:");
    for (const r of scored.filter((r) => r.gt === "SAME" && r.base.tier === "EXCLUDED"))
      console.log(`   ${r.id} ${r.domain.padEnd(24)} modelCode=${r.base.modelCode} verdict=${r.base.verdict}`);

    /* ── ⑧ anchor ── */
    console.log("\n════════ ⑧ C06 / C08 anchor ════════");
    for (const id of ["C06", "C08"]) {
      const r = rows.find((x) => x.id === id && x.src === "OLD")!;
      console.log(`   ${id} CEO=${r.gt} base=${r.base.tier} cf2=${r.cf2.tier}`);
    }

    writeFileSync(path.join(OUT, "wu-068.json"), JSON.stringify(rows.map((r) => ({ id: r.id, src: r.src, gt: r.gt, base: r.base.tier, cf2: r.cf2.tier })), null, 1));

    /* ══════ 🔴 계약 ══════ */
    expect(nwRows.filter((r) => r.gt === "SAME")).toHaveLength(10);
    expect(nwRows.filter((r) => r.gt === "DIFFERENT")).toHaveLength(3);
    expect(nwRows.filter((r) => r.gt === "UNCERTAIN")).toHaveLength(6);
    /** 🔴 **63 이다.** 51 − UNCERTAIN 1 + 19 − UNCERTAIN 6 = 63 — 내 첫 단언(64)이 틀렸다. */
    expect(scored).toHaveLength(63);
    expect(derived).toHaveLength(135);
    /** 🔴 Baseline — False SAME **2** (C06 + S1-6). */
    expect(b.ex).toBe(16);
    expect(b.s).toBe(14);
    expect(b.d).toBe(2);
    /** 🔴 CF-2 — SAME 회복 1 · False SAME 증가 **0**. */
    expect(c.s - b.s).toBe(1);
    expect(c.d - b.d).toBe(0);
    expect(promoted.filter((r) => r.src === "DERIVED")).toHaveLength(0);
    /** 🟢 anchor. */
    expect(rows.find((x) => x.id === "C06" && x.src === "OLD")!.base.tier).toBe("EXACT");
    expect(rows.find((x) => x.id === "C08" && x.src === "OLD")!.base.tier).not.toBe("EXACT");
  });
});
