import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { backfillCanonicalProduct, buildProductIdentityDna, extractCodeLikeSlugSegment, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-072 — **국내 COLOR 부재 × L4 위험 정량화 + 숫자시작 SKU** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「L4 구현이 아니라 **국내 시장에서 L4 가 왜 위험한지 최종 수치화**」
 * 🔴 「색상 추출기를 개선하지 않는다 — **이미 존재하는 evidence 를 측정만** 한다」
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
const IS_KR = (d: string) => /\.kr$/i.test(d) || /kihanan|biskuit|mustit|trenbe|luxboy|donokids/i.test(d);
const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json")) &&
  existsSync(NEW_GT);

/** 🔴 운영이 **읽지 않는** 소스까지 «세기만» 한다. 추출기를 바꾸지 않는다. */
function colorSources(html: string | null) {
  if (!html) return { ld: null as string | null, micro: null as string | null, microProduct: false, meta: null as string | null, itemprop: 0, label: 0 };
  const ld = (() => {
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const found: string[] = [];
        const walk = (o: unknown): void => {
          if (!o || typeof o !== "object") return;
          if (Array.isArray(o)) return o.forEach(walk);
          const r = o as Record<string, unknown>;
          if (typeof r.color === "string" && r.color.trim()) found.push(r.color.trim());
          for (const v of Object.values(r)) if (v && typeof v === "object") walk(v);
        };
        walk(JSON.parse(m[1].trim()));
        if (found.length) return found[0].slice(0, 30);
      } catch {
        /* 🔴 깨진 JSON-LD 는 «없음» 이 아니라 읽기 실패다 — 그대로 넘어간다. */
      }
    }
    return null;
  })();
  const meta = /<meta[^>]+(?:property|name)=["'](?:og:color|product:color)["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  /**
   * 🔴🔴 **`ExtractedProductData` 에 `color` 칸이 «없다».** 처음에 `micro?.color` 로 읽었다가
   *    typecheck 가 잡았다(이 트랙 **14번째** 칸 이름 추측 오류).
   * 🟢 그래서 microdata 색상 「0/17」은 **「없어서」가 아니라 「읽는 코드가 없어서」** 다.
   *    `extractMicrodataFromHtml` 은 title·price·brand 만 낸다 — 색상 칸 자체가 없다.
   *    ⟹ 아래는 **원시 `itemprop="color"` 출현 수** 로만 센다(「미지원」과 「부재」를 가른다).
   */
  const microProduct = extractMicrodataFromHtml(html) != null;
  return {
    ld,
    micro: null,
    microProduct,
    meta,
    itemprop: (html.match(/itemprop\s*=\s*["']color["']/gi) ?? []).length,
    label: (html.match(/(색\s*상|컬\s*러)/g) ?? []).length,
  };
}

describe("WU-072 — 국내 COLOR × L4 (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("① color 소스 분해 · ② 국내 L4 · ③ 숫자시작 SKU", () => {
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as any[];
    const of: Record<string, any> = {};
    for (const [sid, id] of Object.entries(IDS))
      of[sid] = productFactsFromIdentityDna(buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product)));

    type It = { id: string; src: string; origin: string; domain: string; gt: string | null; cand: any; title: string; url: string; html: string | null };
    const items: It[] = [];
    const gt = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as any[];
    for (const r of gt) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      const h = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.html`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (!c.candidate?.facts) continue;
      items.push({ id: r.id, src: "OLD", origin: r.searchId, domain: r.domain, gt: r.humanGt ?? null, cand: c.candidate.facts, title: c.candidate.title ?? "", url: r.candidateUrl, html: existsSync(h) ? readFileSync(h, "utf8") : null });
    }
    for (const r of JSON.parse(readFileSync(NEW_GT, "utf8")) as any[])
      if (r.facts) items.push({ id: r.id, src: "NEW", origin: r.searchId, domain: r.domain, gt: r.gt, cand: r.facts, title: r.title ?? "", url: r.url, html: null });
    for (const r of gt.filter((x) => x.humanGt === "SAME")) {
      const f = path.join(OUT, "wu-032-cache", `${key(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) continue;
      const c = JSON.parse(readFileSync(f, "utf8"));
      if (!c.candidate?.facts) continue;
      for (const sid of Object.keys(IDS))
        if (sid !== r.searchId)
          items.push({ id: `${sid}/${r.id}`, src: "DERIVED", origin: sid, domain: r.domain, gt: "DIFFERENT", cand: c.candidate.facts, title: c.candidate.title ?? "", url: r.candidateUrl, html: null });
    }

    /* ════ ① 국내 color evidence 소스 분해 ════ */
    const kr = items.filter((x) => x.src === "OLD" && IS_KR(x.domain));
    console.log(`\n════════ ① 국내/한국계 ${kr.length}건 — color evidence 가 «어디에» 있는가 ════════`);
    console.log("  id   host                  colorText   JSON-LD   microScope og/product  itemprop  「색상/컬러」");
    const src = kr.map((x) => ({ x, s: colorSources(x.html) }));
    for (const { x, s } of src)
      console.log(
        `  ${x.id.padEnd(4)} ${x.domain.padEnd(21)} ${String(x.cand.colorText ?? "null").slice(0, 11).padEnd(11)} ${String(s.ld ?? "-").slice(0, 9).padEnd(9)} ${(s.microProduct ? "Product" : "-").padEnd(10)} ${String(s.meta ?? "-").slice(0, 11).padEnd(11)} ${String(s.itemprop).padEnd(9)} ${s.label}`,
      );
    const has = (f: (s: ReturnType<typeof colorSources>) => boolean) => src.filter((v) => f(v.s)).length;
    console.log(`\n  colorText 있음 ${src.filter((v) => v.x.cand.colorText).length}/${src.length} · JSON-LD color ${has((s) => !!s.ld)} · microdata **미지원**(읽는 칸 없음 · Product scope ${has((s) => s.microProduct)}건) · og/product ${has((s) => !!s.meta)} · itemprop ${has((s) => s.itemprop > 0)} · 「색상/컬러」 문자열 ${has((s) => s.label > 0)}`);
    console.log(`  🔴 **구조화 색상(JSON-LD/microdata/meta/itemprop) 중 하나라도 있는 것: ${has((s) => !!s.ld || !!s.meta || s.itemprop > 0)}/${src.length}**`);

    /* ════ ② L4 counterfactual (국내 / 해외 분리) ════ */
    function run(it: It, mode: "BASE" | "L4" | "L4_NO_COLOR" | "L4_NO_CATEGORY", digitGuard = false) {
      const o = of[it.origin];
      const cross = compareCrossSellerProducts(o, it.cand) as any;
      const oCode = (o.brandModelCode as string | null) ?? null;
      /** ③ — slug 승격에 「숫자 시작 거부」를 끼운 변형. 운영 함수는 그대로 둔다. */
      let dCode = (it.cand.brandModelCode as string | null) ?? null;
      if (digitGuard && dCode) {
        const slug = (() => { try { return new URL(it.url).pathname.split("/").filter(Boolean).pop() ?? ""; } catch { return ""; } })();
        const fromSlug = extractCodeLikeSlugSegment(slug);
        if (fromSlug && fromSlug === dCode.toUpperCase() && /^[0-9]/.test(slug)) dCode = null;
      }
      dCode = dCode ?? confirmBrandCodeInEvidence(oCode, { title: it.title, url: it.url });
      const mc = compareModelCode(oCode, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, it.cand.colorText ?? null);
      let confs: string[] = (cross.conflicts ?? []).map((c: any) => c.conflict);
      if (mode === "L4_NO_COLOR") confs = confs.filter((c) => c !== "COLOR");
      if (mode === "L4_NO_CATEGORY") confs = confs.filter((c) => c !== "CATEGORY");
      const brandSame = Boolean(o.brand && it.cand.brand && String(o.brand).toLowerCase().replace(/\s+/g, "") === String(it.cand.brand).toLowerCase().replace(/\s+/g, ""));
      const demote = mode !== "BASE" && cross.verdict === "CONFLICT" && confs.length > 0 && confs.every((c) => c === "MODEL_CODE") && brandSame && !cu;
      const truth = deriveMatchTruth("very_high", (demote ? "unavailable" : mc) as never, (demote ? "SAME" : cross.verdict) as never, (cross.blockers ?? []) as never, (cross.conflicts ?? []) as never, cu);
      return { tier: priceTierFromLink({ matchTruth: truth, verified: false } as never), mc, cu, dCode };
    }

    const scored = items.filter((x) => x.src !== "DERIVED" && (x.gt === "SAME" || x.gt === "DIFFERENT"));
    const derived = items.filter((x) => x.src === "DERIVED");
    const krScored = scored.filter((x) => IS_KR(x.domain));
    const ovScored = scored.filter((x) => !IS_KR(x.domain));
    const kpi = (set: It[], m: any, dg = false) => {
      const ex = set.filter((x) => run(x, m, dg).tier === "EXACT");
      return { ex: ex.length, s: ex.filter((x) => x.gt === "SAME").length, d: ex.filter((x) => x.gt === "DIFFERENT").length };
    };
    console.log("\n════════ ② L4 counterfactual — 국내 / 해외 분리 ════════");
    const MODES = [["BASE", "Baseline"], ["L4", "L4"], ["L4_NO_COLOR", "L4 − COLOR"], ["L4_NO_CATEGORY", "L4 − CATEGORY"]] as const;
    for (const [m, name] of MODES) {
      const k = kpi(krScored, m), o2 = kpi(ovScored, m), d = kpi(derived, m);
      console.log(` ${name.padEnd(16)} 국내 EXACT ${k.ex}(SAME ${k.s}·🔴DIFF ${k.d}) | 해외 EXACT ${String(o2.ex).padStart(2)}(SAME ${o2.s}·🔴DIFF ${o2.d}) | 파생 EXACT ${d.ex}(🔴DIFF ${d.d})`);
    }
    console.log(`\n 🔴 국내 후보 ${krScored.length}건의 colorUnverified: ${krScored.filter((x) => run(x, "BASE").cu).length}/${krScored.length}`);
    console.log(` ⟹ L4 조건 ③(!colorUnverified)을 통과하는 국내 후보: **${krScored.filter((x) => !run(x, "BASE").cu).length}건**`);

    /* ════ ③ 숫자 시작 SKU counterfactual ════ */
    console.log("\n════════ ③ 「숫자 시작 slug 는 품번으로 쓰지 않는다」 counterfactual ════════");
    const changed = items.filter((x) => run(x, "BASE").dCode !== run(x, "BASE", true).dCode);
    console.log(` 품번이 바뀌는 후보 ${changed.length}: ${changed.map((x) => `${x.id}(${x.domain})`).join(" ")}`);
    for (const x of changed)
      console.log(`   ${x.id} ${x.domain.padEnd(16)} CEO=${String(x.gt).padEnd(10)} code ${String(run(x, "BASE").dCode)} → ${String(run(x, "BASE", true).dCode)}  tier ${run(x, "BASE").tier} → ${run(x, "BASE", true).tier}`);
    const a = kpi(scored, "BASE"), b = kpi(scored, "BASE", true);
    const da = kpi(derived, "BASE"), db = kpi(derived, "BASE", true);
    console.log(`\n 전체 GT  EXACT ${a.ex}(SAME ${a.s}·DIFF ${a.d}) → ${b.ex}(SAME ${b.s}·DIFF ${b.d})`);
    console.log(` 파생 135 EXACT ${da.ex}(DIFF ${da.d}) → ${db.ex}(DIFF ${db.d})`);
    console.log(` precision ${a.ex ? ((a.s / a.ex) * 100).toFixed(1) : "-"}% → ${b.ex ? ((b.s / b.ex) * 100).toFixed(1) : "-"}%  ·  recall ${((a.s / scored.filter((x) => x.gt === "SAME").length) * 100).toFixed(1)}% → ${((b.s / scored.filter((x) => x.gt === "SAME").length) * 100).toFixed(1)}%`);

    writeFileSync(path.join(OUT, "wu-072.json"), JSON.stringify({ colorSrc: src.map((v) => ({ id: v.x.id, domain: v.x.domain, colorText: v.x.cand.colorText ?? null, ...v.s })), skuChanged: changed.map((x) => x.id) }, null, 1));

    /* ══════ 🔴 계약 ══════ */
    /** 🔴🔴 국내 후보는 **구조화 색상이 거의 없다** — L4 조건 ③이 국내에서 거의 통과하지 못한다. */
    expect(src.length).toBe(17);
    expect(src.filter((v) => v.x.cand.colorText).length).toBeLessThanOrEqual(src.length / 2);
    /** 🟢 국내에서 L4 가 **False SAME 을 만들지 않는다** — 단 그 이유는 조건 ③에 막혀서다. */
    for (const [m] of MODES) expect(kpi(krScored, m).d, `국내/${m}`).toBe(kpi(krScored, "BASE").d);
    /** 🔴 해외에서는 COLOR 를 빼면 뚫린다(WU-071 재확인). */
    expect(kpi(derived, "L4_NO_COLOR").d).toBeGreaterThan(kpi(derived, "L4").d);
    /** 🟢 ③ — 숫자 시작 가드는 **kids21 3건만** 건드리고 진짜 품번을 잃지 않는다. */
    expect(changed.every((x) => /kids21/.test(x.domain))).toBe(true);
    /** 🔴 그리고 파생 DIFFERENT 보호를 깨지 않는다. */
    expect(db.d).toBeLessThanOrEqual(da.d);
  });
});
