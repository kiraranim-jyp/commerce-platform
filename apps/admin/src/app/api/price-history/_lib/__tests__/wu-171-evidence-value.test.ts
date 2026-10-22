import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { extractCategoryTaxon } from "@commerce/crawler/src/comparison-search/match";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-171 — **증거별 가치표**(상품명에 더 투자할지 숫자로 판단한다)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**상품명 문제를 더 깊게 파지 않는다.** 먼저 이미 가지고
 * 있는 정보로 얼마나 해결되는지 숫자로 확인한다」.
 *
 * 🔴 운영 코드 **0** · 새 extractor **0** · 새 동의어 사전 **0** · 새 음역 규칙 **0** ·
 *    fuzzy threshold **0** · 배포 **0**. 🔴 **운영 산출(axes/conflicts/blockers) 재집계만** 한다.
 * 🔴 게이트 `WU_171_PROBE=1` 없으면 SKIP.
 *
 * ── 분모 ───────────────────────────────────────────────────────────────────
 * ```
 * wu-112 GT 의 **두 원상품** 을 다 쓴다 — B226AC009 **12** + B226AC010 **13** = **25**
 * 🟢 B226AC010 원상품 URL 은 **추측해서 쓰지 않고 검증** 했다 —
 *    `…/products/b226ac010-booty-ghosts-t-shirt.json` → handle 과 제목이 그 상품이다
 * 🔴 UNCERTAIN 2건은 **분모에서 뺀다**(SAME 도 DIFFERENT 도 아니다)
 * ```
 *
 * ── 축별 «가치» 의 정의(측정 가능한 형태로 고정) ───────────────────────────
 * ```
 * 🟢 **회수 기여** = human **SAME** 인데 **현재 SAME 이 아닌** 행에서 그 축이 **점수를 준다**
 * 🔴 **leakage 위험** = human **DIFFERENT** 행에서 그 축이 **점수를 준다**
 *    ⟹ 그 축만 믿으면 **열리는** 쪽이다
 * 🔴 **방어 기여** = human DIFFERENT 행에서 그 축이 **conflict/blocker 를 낸다**
 * 🔴 어느 축도 **단독으로 SAME 을 만들지 않는다** — 이 표는 **기여도** 지 규칙이 아니다
 * ```
 */
const LIVE = process.env.WU_171_PROBE === "1";
const ORIGINS: Record<string, string> = {
  B226AC009: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
};

/* ════ 🔴 WU-078 하니스의 자음 뼈대 «사본» — 변경 0(CF-TOKEN 전용) ════ */
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "c", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "c", "k", "t", "p", "h"];
const romanize = (s: string) => {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xac00 && c <= 0xd7a3) {
      const i = c - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
    } else out += ch.toLowerCase();
  }
  return out;
};
const generalize = (x: string) =>
  x.replace(/sy|sh/g, "s").replace(/ch/g, "c").replace(/c/g, "k").split("").filter((c, i, a) => c !== a[i - 1]).join("");
const engSkel = (s: string) => generalize(s.toLowerCase().replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");
const koSkel = (s: string) => generalize(romanize(s).replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");
const HANGUL = /[가-힣]/;
const skelOf = (t: string) => (HANGUL.test(t) ? koSkel(t) : engSkel(t));
/* ═══════════════════════════════════════════════════════════════════════ */

interface Row {
  origin: string;
  domain: string;
  human: "SAME" | "DIFFERENT";
  verdict: string;
  axes: Map<string, number>;
  conflicts: Set<string>;
  blockers: Set<string>;
  idc: boolean;
  /** 🔵 CF-TOKEN — 자음 뼈대 기준 공통 의미 단위 수(기존 자산만 · 새 사전 0) */
  tokenUnits: number;
}

describe("WU-171 — 증거별 가치표", () => {
  it.runIf(LIVE)("축별 회수 기여 / leakage / 방어 기여를 센다", async () => {
    /* eslint-disable no-console */
    const originFacts = new Map<string, ProductFacts>();
    const originSkel = new Map<string, Set<string>>();
    for (const [code, url] of Object.entries(ORIGINS)) {
      const ex = await shopifySiteStrategy.extract(url);
      expect(ex, `원상품 추출 실패 ${code}`).not.toBeNull();
      const p = buildCanonicalProduct(url, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []);
      const dna = buildProductIdentityDna(p);
      const f = productFactsFromIdentityDna(dna);
      /** 🔴 검증 — 그 URL 이 **정말 그 품번** 인지 본다(추측으로 쓰지 않는다). */
      expect(`${f.title} ${f.sourceUrl}`.toLowerCase(), `원상품 불일치 ${code}`).toContain(code.toLowerCase());
      originFacts.set(code, f);
      originSkel.set(
        code,
        new Set(f.coreTitleTokens.filter((t) => extractCategoryTaxon(t) === null).map(skelOf).filter((s) => s.length >= 2)),
      );
      console.log(`  🟢 원상품 ${code} — brand=${f.brand} color=${JSON.stringify(f.colorText)} tokens=${JSON.stringify(f.coreTitleTokens)}`);
    }

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: { originCode: string; domain: string; url: string; verdict: string }[] };

    const rows: Row[] = [];
    for (const c of gt.candidates) {
      if (c.verdict !== "SAME" && c.verdict !== "DIFFERENT") continue;
      const of = originFacts.get(c.originCode);
      if (!of) continue;
      const f = await factsFromProductUrl(c.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`  ${c.domain.padEnd(24)} 🔴 ${f.status} — 분모 제외(측정불가)`);
        continue;
      }
      const cf = f.candidate.facts as ProductFacts;
      const m = compareCrossSellerProducts(of, cf);
      const skels = cf.coreTitleTokens
        .filter((t) => extractCategoryTaxon(t) === null)
        .map(skelOf)
        .filter((s) => s.length >= 2);
      const os = originSkel.get(c.originCode)!;
      rows.push({
        origin: c.originCode,
        domain: c.domain,
        human: c.verdict,
        verdict: m.verdict,
        axes: new Map(m.axes.map((a) => [a.axis, a.points])),
        conflicts: new Set(m.conflicts.map((x) => x.conflict)),
        blockers: new Set(m.blockers.map((x) => x.blocker)),
        idc: m.identifierConfirmed,
        tokenUnits: [...new Set(skels.filter((s) => os.has(s)))].length,
      });
    }

    const same = rows.filter((r) => r.human === "SAME");
    const diff = rows.filter((r) => r.human === "DIFFERENT");
    const missedSame = same.filter((r) => r.verdict !== "SAME");
    console.log(`\n══════ 🔴 분모 ══════`);
    console.log(`  측정 ${rows.length} (human SAME ${same.length} · DIFFERENT ${diff.length}) · 원상품 2개`);
    console.log(`  🔴 현재 SAME 을 못 받는 human SAME = **${missedSame.length}**  ← 회수 대상`);

    /** 🔴 운영 산출에 실제로 등장한 축만 센다(내가 목록을 지어내지 않는다). */
    const axisNames = [...new Set(rows.flatMap((r) => [...r.axes.keys()]))].sort();
    const conflictNames = [...new Set(rows.flatMap((r) => [...r.conflicts]))].sort();

    console.log("\n══════ 🔴🔴 증거별 가치표 ══════");
    console.log(
      `  ${"축".padEnd(14)} ${"회수기여".padStart(8)} ${"leakage".padStart(8)} ${"SAME일치율".padStart(11)} ${"DIFF일치율".padStart(11)}  판단`,
    );
    const pct = (n: number, d: number) => (d === 0 ? "  -  " : `${((n / d) * 100).toFixed(0)}%`.padStart(5));
    for (const a of axisNames) {
      const contrib = missedSame.filter((r) => r.axes.has(a)).length;
      const leak = diff.filter((r) => r.axes.has(a)).length;
      const sHit = same.filter((r) => r.axes.has(a)).length;
      const dHit = diff.filter((r) => r.axes.has(a)).length;
      const sep = sHit / Math.max(1, same.length) - dHit / Math.max(1, diff.length);
      const judge = sep >= 0.5 ? "🟢 식별력 높다" : sep >= 0.2 ? "🟡 보조" : leak > 0 ? "🔴 단독 사용 위험" : "🟡 약하다";
      console.log(
        `  ${a.padEnd(14)} ${String(contrib).padStart(8)} ${String(leak).padStart(8)} ${pct(sHit, same.length).padStart(11)} ${pct(dHit, diff.length).padStart(11)}  ${judge}`,
      );
    }
    /** 🟢 품번은 축이 아니라 `identifierConfirmed` 로도 따로 본다. */
    const idcS = same.filter((r) => r.idc).length;
    const idcD = diff.filter((r) => r.idc).length;
    console.log(
      `  ${"품번확인".padEnd(14)} ${String(missedSame.filter((r) => r.idc).length).padStart(8)} ${String(idcD).padStart(8)}` +
        ` ${pct(idcS, same.length).padStart(11)} ${pct(idcD, diff.length).padStart(11)}  ${idcD === 0 ? "🟢 **오염 0**" : "🔴 오염 있다"}`,
    );
    /** 🔵 CF-TOKEN — 상품명 token(기존 자산만). */
    const tS = same.filter((r) => r.tokenUnits > 0).length;
    const tD = diff.filter((r) => r.tokenUnits > 0).length;
    console.log(
      `  ${"상품명token".padEnd(14)} ${String(missedSame.filter((r) => r.tokenUnits > 0).length).padStart(8)} ${String(tD).padStart(8)}` +
        ` ${pct(tS, same.length).padStart(11)} ${pct(tD, diff.length).padStart(11)}  🔵 CF-TOKEN(기존 자산만)`,
    );

    console.log("\n══════ 🔴 DIFFERENT 를 «막는» 축(방어 기여) ══════");
    for (const c of conflictNames) {
      const dBlock = diff.filter((r) => r.conflicts.has(c)).length;
      const sBlock = same.filter((r) => r.conflicts.has(c)).length;
      console.log(
        `  ${c.padEnd(14)} DIFFERENT 차단 ${String(dBlock).padStart(2)}/${diff.length} ·` +
          ` 🔴 SAME 오차단 ${String(sBlock).padStart(2)}/${same.length}`,
      );
    }

    console.log("\n══════ 🔴🔴 판정(A / B / C) ══════");
    /**
     * 🔴 CPO 가 고정한 세 결론 중 하나를 **데이터로** 고른다.
     *    A 품번+브랜드+색상+속성만으로 충분 · B 일부는 상품명 필요 · C 상품명이 핵심
     */
    const nonTitleCovers = missedSame.filter((r) => r.idc || r.axes.has("COLOR") || r.axes.has("MATERIAL")).length;
    const titleOnly = missedSame.filter((r) => !r.idc && !r.axes.has("COLOR") && !r.axes.has("MATERIAL")).length;
    console.log(`  회수 대상 ${missedSame.length} 중 — 상품명 **밖** 증거가 있는 것 ${nonTitleCovers} · 없는 것 ${titleOnly}`);
    const verdict = missedSame.length === 0 ? "A" : nonTitleCovers > titleOnly ? "B" : "C";
    console.log(
      `  ⟹ **${verdict}** — ${
        verdict === "A"
          ? "🟢 상품명은 보조축으로 격하 가능"
          : verdict === "B"
            ? "🟡 다수는 다른 증거로 덮이고 일부만 상품명이 필요하다"
            : "🔴 상품명 밖 증거가 부족하다"
      }`,
    );
    console.log(`\n  🔴 분모 ${rows.length}(DIFFERENT ${diff.length}) · 원상품 **2개** — 「가치」를 일반화하지 않는다`);
    console.log("  🔴 이 표는 **기여도** 다 — 어느 축도 단독으로 SAME 을 만들지 않는다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(rows.length).toBeGreaterThan(0);
  }, 900_000);
});
