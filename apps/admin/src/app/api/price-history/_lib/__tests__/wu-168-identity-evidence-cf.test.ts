import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-168 — **이미 확보된 증거만으로 SAME 을 판단할 수 있는가** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문(2026-10-22) — 「**현재 시스템이 이미 수집하고 있는 정보만으로, 한글↔영문
 * 완전한 동의어 사전 없이도 SAME 을 판단할 수 있는가**」.
 *
 * 🔴 동의어 사전 **0** · 음역 규칙 **0** · 형태소 **0** · 번역/LLM **0** ·
 *    fuzzy title **0** · threshold **0** · `MODEL_CODE` 변경 **0** ·
 *    「품번 일치 = SAME」 **0** · 운영 코드 **0** · 배포 **0**.
 * 🔴 반사실은 **운영 `compareCrossSellerProducts` 의 산출(axes/conflicts/blockers/
 *    identifierConfirmed)만** 재조합한다 — 새 증거를 만들지 않는다.
 * 🔴 게이트 `WU_168_PROBE=1` 없으면 SKIP.
 *
 * ── 반사실 정의(운영 상수 그대로) ──────────────────────────────────────────
 * ```
 * 운영 상수 — SAME_MIN_AXES = **5** · PRESUMED_SAME_MIN_AXES = **3** (cross-seller.ts:250-251)
 * CF-0  운영 verdict 그대로
 * CF-1  **`NO_TITLE_OVERLAP` 하나만** 무시하고 축 점수 합이 5 에 닿는가
 *       (🔴 다른 blocker 는 그대로 둔다 · 새 축을 더하지 않는다)
 * CF-2  CF-1 **그리고** `conflicts` 가 **비어 있다**(색상/소재/상품군/대상 불일치 0)
 * ```
 * 🔴🔴 **`m.luxboy.com` 이 이 측정의 핵심 방어 대상이다** — 같은 `B226AC009` · human
 *    **DIFFERENT**. 🔴 CF 가 그것을 SAME 으로 바꾸면 **즉시 그 가설 NO-GO** 다.
 */
const LIVE = process.env.WU_168_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const SAME_MIN_AXES = 5;
const ATTR_AXES = new Set(["COLOR", "MATERIAL", "CATEGORY", "AUDIENCE", "SIZE", "FIT"]);

describe("WU-168 — 기존 evidence 조합 반사실", () => {
  it.runIf(LIVE)("CF-0/1/2 를 비교하고 DIFFERENT 방어를 본다", async () => {
    /* eslint-disable no-console */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const of = productFactsFromIdentityDna(dna);
    console.log("\n══════ 🔴 ① 원상품이 «이미» 가진 증거 ══════");
    console.log(
      `  brand=${JSON.stringify(of.brand)} code=${JSON.stringify(of.brandModelCode)}` +
        ` color=${JSON.stringify(of.colorText)} material=${JSON.stringify(of.materialText)}`,
    );
    console.log(
      `  category=${JSON.stringify(of.categoryText)} age=${JSON.stringify(of.ageRangeText)}` +
        ` fit=${JSON.stringify(of.fitText)} sizes=${of.sizeLabels.length} images=${of.imageUrls.length}`,
    );

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: { domain: string; url: string; verdict: string; originCode: string }[] };
    const rows = gt.candidates.filter((c) => c.originCode === "B226AC009");

    interface Out {
      label: string;
      human: string;
      cf0: string;
      axes: string;
      points: number;
      attrAxes: string[];
      conflicts: string[];
      blockers: string[];
      idc: boolean;
      cf1: boolean;
      cf2: boolean;
      color: string | null;
    }
    const out: Out[] = [];

    for (const r of rows) {
      const f = await factsFromProductUrl(r.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`  ${r.domain.padEnd(24)} 🔴 ${f.status} — 제외(측정불가)`);
        continue;
      }
      const cf = f.candidate.facts as ProductFacts;
      const m = compareCrossSellerProducts(of, cf);
      const blockers = m.blockers.map((b) => b.blocker);
      const conflicts = m.conflicts.map((c) => c.conflict);
      const points = m.axes.reduce((n, a) => n + a.points, 0);
      /** 🔴 CF-1 — `NO_TITLE_OVERLAP` **하나만** 무시한다(다른 blocker 는 그대로). */
      const otherBlockers = blockers.filter((b) => b !== "NO_TITLE_OVERLAP");
      const cf1 = points >= SAME_MIN_AXES && otherBlockers.length === 0;
      const cf2 = cf1 && conflicts.length === 0;
      out.push({
        label: r.domain,
        human: r.verdict,
        cf0: m.verdict,
        axes: m.axes.map((a) => `${a.axis}:${a.points}`).join(","),
        points,
        attrAxes: m.axes.filter((a) => ATTR_AXES.has(a.axis)).map((a) => a.axis),
        conflicts,
        blockers,
        idc: m.identifierConfirmed,
        cf1,
        cf2,
        color: cf.colorText,
      });
    }

    console.log("\n══════ 🔴🔴 ② CF 결과 ══════");
    console.log(
      `  ${"판매처".padEnd(24)} ${"human".padEnd(10)} ${"CF0".padEnd(14)} ${"점".padStart(3)} ${"품번".padStart(4)} ${"CF1".padStart(5)} ${"CF2".padStart(5)}`,
    );
    for (const o of out) {
      console.log(
        `  ${o.label.padEnd(24)} ${o.human.padEnd(10)} ${o.cf0.padEnd(14)} ${String(o.points).padStart(3)}` +
          ` ${(o.idc ? "🟢" : "🔴").padStart(3)} ${(o.cf1 ? "🟢SAME" : "🔴-").padStart(6)} ${(o.cf2 ? "🟢SAME" : "🔴-").padStart(6)}`,
      );
    }

    /** 🔴 방어 대상을 **따로** 펼친다 — 이 측정의 핵심이다. */
    console.log("\n══════ 🔴🔴 ③ 핵심 방어 대상 상세 ══════");
    for (const key of ["luxboy", "biskuit", "parkette"]) {
      const o = out.find((x) => x.label.includes(key));
      if (!o) continue;
      console.log(`\n  [${o.label}] human **${o.human}** · 운영 verdict ${o.cf0}`);
      console.log(`    axes        ${o.axes || "(없음)"}  → 합계 **${o.points}**`);
      console.log(`    속성 축      ${JSON.stringify(o.attrAxes)}`);
      console.log(`    conflicts   ${JSON.stringify(o.conflicts)}`);
      console.log(`    blockers    ${JSON.stringify(o.blockers)}`);
      console.log(`    색상        ${JSON.stringify(o.color)} · 품번확인 ${o.idc ? "🟢" : "🔴"}`);
      console.log(`    CF-1 ${o.cf1 ? "🟢 SAME" : "🔴 안 열림"} · CF-2 ${o.cf2 ? "🟢 SAME" : "🔴 안 열림"}`);
    }

    /* ── 집계 ── */
    const n = (xs: Out[]) => `SAME ${xs.filter((x) => x.human === "SAME").length} · DIFFERENT ${xs.filter((x) => x.human === "DIFFERENT").length}`;
    const base = out.filter((o) => o.cf0 === "SAME");
    const c1 = out.filter((o) => o.cf1);
    const c2 = out.filter((o) => o.cf2);
    const leak = (xs: Out[]) => xs.filter((x) => x.human === "DIFFERENT").length;

    console.log("\n══════ 🔴🔴 ④ 회수 / leakage ══════");
    console.log(`  측정 후보 ${out.length} (${n(out)})`);
    console.log(`  CF-0 운영 SAME      ${base.length} (${n(base)}) · 🔴 leakage **${leak(base)}**`);
    console.log(`  CF-1 제목무시       ${c1.length} (${n(c1)}) · 🔴 leakage **${leak(c1)}**`);
    console.log(`  CF-2 +속성충돌없음   ${c2.length} (${n(c2)}) · 🔴 leakage **${leak(c2)}**`);
    const bisk1 = out.find((o) => o.label.includes("biskuit"));
    console.log(
      `\n  🔴 비스킷 회수 — CF-0 ${bisk1?.cf0 === "SAME" ? "🟢" : "🔴"} · CF-1 ${bisk1?.cf1 ? "🟢" : "🔴"} · CF-2 ${bisk1?.cf2 ? "🟢" : "🔴"}`,
    );

    /**
     * 🔴🔴🔴 **②에서 드러난 것 — 비스킷의 품번 축이 «안 선다».**
     *    품번 `b226ac009` 가 **제목에도 URL 에도 있는데** `identifierConfirmed` 가 false 다.
     *    🔴 원인을 추측하지 않고 **칸을 직접 찍는다**(`brandModelCode` · URL 세그먼트).
     */
    console.log("\n══════ 🔴🔴 ④-B 진단 — 품번 증거가 어디서 끊기는가 ══════");
    for (const r of rows) {
      const f = await factsFromProductUrl(r.url);
      if (f.status !== "OK" || !f.candidate?.facts) continue;
      const cf = f.candidate.facts as ProductFacts;
      let segs: string[] = [];
      try {
        segs = new URL(r.url).pathname.split("/").filter(Boolean);
      } catch {
        segs = [];
      }
      const last = segs[segs.length - 1] ?? "";
      const anywhere = segs.some((s) => s.toLowerCase().includes("b226ac009"));
      const inTitle = String(cf.title).toLowerCase().includes("b226ac009");
      if (!anywhere && !inTitle) continue;
      console.log(
        `  ${r.domain.padEnd(24)} brandModelCode=${String(cf.brandModelCode ?? "null").padEnd(12)}` +
          ` 마지막세그먼트=${JSON.stringify(last).padEnd(14)} URL중품번 ${anywhere ? "🟢" : "🔴"} 제목중품번 ${inTitle ? "🟢" : "🔴"}`,
      );
    }
    console.log("  🔴 `extractUrlSlug` 는 **마지막 경로 세그먼트** 만 본다(product-facts.ts:715 주석) —");
    console.log("     Cafe24 계열은 `…/display/1/` 로 끝나므로 품번이 **중간 세그먼트** 에 있으면 못 본다");
    console.log("     🟢 WU-094/095 가 기록한 그 꼬리표 구조이고, 숫자-only 가드는 **올바르다**");
    console.log("     🔴 그러나 **중간 세그먼트의 품번을 회수하는 경로가 없다**");

    console.log("\n══════ 🔴🔴 ⑤ 판정 ══════");
    const verdictOf = (xs: Out[], label: string) => {
      const l = leak(xs);
      const got = xs.some((x) => x.label.includes("biskuit"));
      if (l > leak(base)) return `${label} 🔴 **NO-GO**(DIFFERENT leakage ${l})`;
      if (got) return `${label} 🟡 **회수 있음 · leakage 불변** — CPO 판정 사안`;
      return `${label} 🔴 **회수 0**`;
    };
    console.log(`  ${verdictOf(c1, "CF-1")}`);
    console.log(`  ${verdictOf(c2, "CF-2")}`);
    console.log(`\n  🔴 분모 ${out.length} · 원상품 **1개** · DIFFERENT ${out.filter((o) => o.human === "DIFFERENT").length} —`);
    console.log(`     「leakage 0」을 강한 precision 증명으로 쓰지 않는다`);
    console.log(`  🔴 동의어 사전 **0** · 음역 **0** · 새 축 **0** — 재조합만 했다`);

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(out.length).toBeGreaterThan(0);
  }, 900_000);
});
