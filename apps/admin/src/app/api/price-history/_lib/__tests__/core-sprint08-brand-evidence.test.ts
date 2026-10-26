import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-08 — **BRAND Evidence Quality**(measurement-first)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **BRAND Evidence 개선 ≠ BRAND 판정 완화.** `WU-080 REJECT` 를 유지한다 —
 *    BRAND gate · `BRAND_MISMATCH` · `BRAND_UNCONFIRMED` 통과 규칙 · threshold ·
 *    `NO_TITLE_OVERLAP` · MODEL_CODE conflict · 새 axis — **전부 변경 0**.
 * 🔴 seller name 자동 brand 인정 **0** · 브랜드 사전 확대 **0** · fuzzy/substring **0**.
 *
 * ── 🟢 실제 BRAND source hierarchy (가설이 아니라 «코드에서 읽었다») ───────────
 * ```
 * PLAIN_HTML  `brandFromHtml`(product-url-facts.ts:244) 순서대로
 *   ① meta og:brand        ② meta product:brand      ③ JSON-LD "brand".name
 *   ④ og:title → **`lookupBrandByAliasInTitle`**(등록부 alias · WU-151)
 *   ⑤ microdata brand      → null
 * SHOPIFY     `productFactsFromShopifyProduct`(seller-facts.ts:190)
 *   ① `brandFromTitleByClause(title, vendor)`(title by절 ∩ vendor)
 *   ② 검증된 vendor(시즌코드 전체가 아닐 때)  ③ `OFFICIAL_STORE_BRANDS[domain]` → null
 * ```
 *
 * ── 🔴 counterfactual 후보를 «코드에 이미 있는 것» 으로 제한한 이유 ─────────────
 * ```
 * A  `lookupBrandByAliasInTitle(**후보 title**)`  🟢 **유일한 안전 후보**
 *    현재 이 등록부는 **og:title 에만** 적용된다(④). 저장된 facts 의 `title` 에
 *    적용해 보는 것은 **새 사전 0 · 새 규칙 0** 이다
 * B  원상품 brand 를 후보에 투사        🔴 **금지** — WU-080 이 「원상품 공백 메우기」를
 *    측정해 **악화**(SAME 4 더 막힘 · DIFFERENT 2 열림)로 REJECT 했다
 * C  domain → brand 확대                🔴 **금지** — `wu-080-brand-producer` 계약이 2 FAIL
 * D  seller/store name 승격             🔴 **금지**(CPO 명시) — 측정만 한다(Step 3)
 * ```
 */

function judge(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  const code = compareModelCode(origin.brandModelCode, cand.brandModelCode ?? null);
  const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !cand.colorText);
  /** 🔴 모양을 타입에서 읽는다(SPRINT-07 에서 틀렸던 자리). */
  return {
    verdict: String(cross.verdict),
    blockers: (cross.blockers ?? []).map((b) => String(b.blocker)),
    conflicts: (cross.conflicts ?? []).map((c) => String(c.conflict)),
    truth: String(truth),
  };
}

const isSame = (v: string) => v === "SAME";
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

/**
 * 🔴 **store/seller 이름 추정에 사전을 만들지 않는다.** 호스트 라벨(점 앞 토큰)과
 *    brand 문자열을 **정규화해 비교** 할 뿐이다 — 「같으면 의심」이고 **판정이 아니다**.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
function looksLikeSellerName(brand: string | null, url: string): boolean {
  if (!brand) return false;
  const h = host(url);
  const label = h.split(".")[0] ?? "";
  const b = norm(brand);
  if (!b || !label) return false;
  const l = norm(label);
  return b === l || (b.length >= 4 && l.includes(b)) || (l.length >= 4 && b.includes(l));
}

type Cause =
  | "BRAND_PRESENT_CORRECT"
  | "BRAND_MISSING"
  | "BRAND_PRESENT_WRONG"
  | "BRAND_AMBIGUOUS"
  | "BRAND_SOURCE_UNTRUSTED";

/** 🟢 counterfactual A — 등록부 alias 를 **후보 title** 에 적용(새 사전 0). */
const cfAliasFromTitle = (f: ProductFacts): ProductFacts =>
  f.brand ? f : { ...f, brand: lookupBrandByAliasInTitle(f.title) ?? null };

describe("CORE-SAME-SPRINT-08 — BRAND Evidence Quality(측정 · 네트워크 0)", () => {
  const fn = SAME05_PAIRS.filter((p) => p.human === "SAME" && !isSame(judge(p.origin, p.facts).verdict));
  const brandFn = fn.filter((p) => judge(p.origin, p.facts).blockers.includes("BRAND_UNCONFIRMED"));

  it("[Step 1] `BRAND_UNCONFIRMED` 전수 원인 분해 — 원문 근거와 현재 값을 같이 적는다", () => {
    expect(fn.length, "🔴 FN 이 0 이면 이 Sprint 가 성립하지 않는다").toBeGreaterThan(0);
    console.log(`\n${"═".repeat(116)}`);
    console.log(`  [Step 1] FN ${fn.length}건 중 BRAND_UNCONFIRMED **${brandFn.length}건** 전수 분해`);
    console.log(`${"═".repeat(116)}`);
    const dist = new Map<Cause, number>();
    for (const p of brandFn) {
      const o = p.origin.brand;
      const c = p.facts.brand;
      /**
       * 🔴🔴 **분류는 「누가 비었는가」로 시작한다.** `brandKnown = Boolean(x.brand && y.brand)`
       *    이므로 **한쪽만 비어도** UNCONFIRMED 다 ⟹ 「후보가 문제」로 단정하면 틀린다
       *    (WU-080 이 실측으로 그것을 뒤집었다).
       */
      let cause: Cause;
      let why: string;
      if (!o && !c) {
        cause = "BRAND_MISSING";
        why = "🔴 **양쪽 다 없다**";
      } else if (!o) {
        cause = "BRAND_MISSING";
        why = "🔴 **원상품** 이 비었다(후보엔 있다)";
      } else if (!c) {
        cause = "BRAND_MISSING";
        why = "🔴 **후보** 가 비었다";
      } else if (looksLikeSellerName(c, p.facts.sourceUrl)) {
        cause = "BRAND_SOURCE_UNTRUSTED";
        why = `🔴 후보 brand 가 **판매처 이름** 으로 보인다(host ${host(p.facts.sourceUrl)})`;
      } else if (norm(o) === norm(c)) {
        cause = "BRAND_PRESENT_CORRECT";
        why = "🟢 표기 같음 — 다른 이유로 막혔다";
      } else {
        cause = "BRAND_AMBIGUOUS";
        why = "🟡 표기가 다르다(같은 브랜드인지 이 데이터로 단정 불가)";
      }
      dist.set(cause, (dist.get(cause) ?? 0) + 1);
      console.log(`  ${pad(p.id, 8)}${pad(host(p.facts.sourceUrl), 22)}${pad(cause, 26)}${why}`);
      console.log(`      원상품 brand = ${JSON.stringify(o)}   후보 brand = ${JSON.stringify(c)}`);
      console.log(`      후보 title   = ${JSON.stringify(p.facts.title.slice(0, 70))}`);
    }
    console.log(`\n  분포(분모 ${brandFn.length})`);
    for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${pad(k, 28)}${v}`);
    /** 🔴 발화 단언 — SPRINT-07 이 센 5 와 대응해야 한다. */
    expect(brandFn.length, "🔴 SPRINT-07 의 BRAND_UNCONFIRMED 5 와 대응해야 한다").toBe(5);
  });

  it("[Step 3] seller/store name 오염을 **전수** 조사한다(승격·삭제 구현 0)", () => {
    const suspect = SAME05_PAIRS.filter((p) => looksLikeSellerName(p.facts.brand, p.facts.sourceUrl));
    console.log(`\n${"═".repeat(116)}`);
    console.log(`  [Step 3] store/seller name 오염 의심 — **${suspect.length}/${SAME05_PAIRS.length}**`);
    console.log(`${"═".repeat(116)}`);
    for (const p of suspect) {
      console.log(
        `  ${pad(p.id, 8)}${pad(host(p.facts.sourceUrl), 24)}brand=${JSON.stringify(p.facts.brand)}  [human ${p.human}]`,
      );
    }
    if (suspect.length === 0) console.log("  🟢 이 분모에서 **호스트 라벨과 같은 brand 는 없다**");
    /**
     * 🔴🔴 **「0」을 「오염이 없다」로 적지 않는다.** 이 술어는 **호스트 라벨 대조** 하나이고
     *    한글 상점명(biskuit → 「비스킷」)처럼 **음역된 경우를 잡지 못한다**.
     *    🟢 그 사례는 §12 가 실측으로 기록해 뒀다(`biskuit.kr` brand = 「비스킷」) ⟹
     *       **이 분모에 그 행이 있는지** 를 따로 확인한다.
     */
    const biskuit = SAME05_PAIRS.filter((p) => host(p.facts.sourceUrl).includes("biskuit"));
    console.log(`\n  🔴 알려진 음역 사례 확인 — biskuit 행 ${biskuit.length}건`);
    for (const p of biskuit) {
      console.log(`     ${pad(p.id, 8)}brand=${JSON.stringify(p.facts.brand)}  [human ${p.human}]`);
    }
    console.log(
      `  🔴 **측정 한계** — 음역/번역된 상점명은 이 술어로 잡히지 않는다 ⟹ 「오염 ${suspect.length}건」은 **하한** 이다`,
    );
  });

  it("[Step 4] counterfactual — 안전한 source 는 «하나» 이고 그 효과를 잰다", () => {
    interface T {
      fired: number;
      tp: number;
      fn: number;
      fp: number;
      tn: number;
      und: number;
      undSame: number;
    }
    const run = (mut: ((f: ProductFacts) => ProductFacts) | null): T => {
      const t: T = { fired: 0, tp: 0, fn: 0, fp: 0, tn: 0, und: 0, undSame: 0 };
      for (const p of SAME05_PAIRS) {
        /** 🔴 **후보측에만** 적용한다 — 원상품을 메우는 것은 WU-080 REJECT 다. */
        const cand = mut ? mut(p.facts) : p.facts;
        if (mut && cand.brand !== p.facts.brand) t.fired += 1;
        const same = isSame(judge(p.origin, cand).verdict);
        if (p.human === "SAME") same ? (t.tp += 1) : (t.fn += 1);
        else if (p.human === "DIFFERENT") same ? (t.fp += 1) : (t.tn += 1);
        else {
          t.und += 1;
          if (same) t.undSame += 1;
        }
      }
      return t;
    };
    const base = run(null);
    const a = run(cfAliasFromTitle);

    console.log(`\n${"═".repeat(116)}`);
    console.log("  [Step 4] BRAND source 결정 매트릭스   🔴 분모 = GT " + SAME05_PAIRS.length);
    console.log(`${"═".repeat(116)}`);
    console.log(
      `  ${pad("BRAND source", 34)}${pad("발화", 6)}${pad("SAME 회복", 11)}${pad("🔴 DIFF→SAME", 14)}${pad("SAME 손실", 11)}Production`,
    );
    const row = (label: string, t: T, note: string) => {
      const dTp = t.tp - base.tp;
      const dFp = t.fp - base.fp;
      console.log(
        `  ${pad(label, 34)}${padL(String(t.fired), 4)}  ${pad(`${t.tp}/${t.tp + t.fn}(${dTp >= 0 ? "+" : ""}${dTp})`, 11)}` +
          `${pad(`${dFp >= 0 ? "+" : ""}${dFp}`, 14)}${pad(String(Math.max(0, -dTp)), 11)}${note}`,
      );
    };
    row("현재 baseline", base, "—");
    row(
      "A  등록부 alias → 후보 title",
      a,
      a.fired === 0 ? "🔴 **측정불가**(발화 0)" : a.fp > base.fp ? "🔴 제외(누출)" : a.tp > base.tp ? "🟢 후보" : "🔴 효과 0",
    );
    console.log(`  ${pad("B  원상품 brand 투사", 34)}${pad("—", 6)}${pad("금지", 11)}${pad("—", 14)}${pad("—", 11)}🔴 WU-080 REJECT(악화 실측)`);
    console.log(`  ${pad("C  domain → brand", 34)}${pad("—", 6)}${pad("금지", 11)}${pad("—", 14)}${pad("—", 11)}🔴 계약이 2 FAIL 로 잠근다`);
    console.log(`  ${pad("D  seller/store name 승격", 34)}${pad("—", 6)}${pad("금지", 11)}${pad("—", 14)}${pad("—", 11)}🔴 CPO 명시 금지`);

    /** 🔴🔴 **safety gate** — 발화가 0 이면 **SAFE 가 아니라 측정불가** 다(CPO 명시). */
    if (a.fired === 0) {
      console.log(
        `\n  🔴🔴 **A 는 측정불가다** — 발화 0. 「DIFFERENT → SAME 0」을 **SAFE 로 적지 않는다**.` +
          `\n     원인: 저장 facts 의 후보 title 에 등록부 alias 가 **걸리지 않는다**` +
          `(그 등록부는 브랜드당 1개 · 실측 전용 · WU-151).`,
      );
    } else {
      console.log(`\n  🟢 A 발화 ${a.fired}건 · DIFFERENT → SAME **${a.fp - base.fp}**`);
    }

    /**
     * 🔴🔴🔴 **이것이 이 Sprint 의 결정적 측정이다 — 발화했는데 효과가 0 인 이유.**
     *
     * 등록부에는 「보보쇼즈」 alias 가 **이미 있다**(`brand-alias.ts:42`). 그러므로
     * A 가 발화한 행은 brand 가 **실제로 채워졌다**. 그런데 SAME 회복이 **0** 이다 ⟹
     * 🔴 **BRAND_UNCONFIRMED 가 해소돼도 다른 관문이 남는다.**
     * 🟢 그 「다른 관문」을 **이름으로** 적는다 — 그것 없이 「BRAND 를 고치면 된다」로
     *    적으면 **다음 사람이 엉뚱한 곳을 고친다**.
     */
    console.log(`\n${"═".repeat(116)}`);
    console.log("  🔴 A 가 brand 를 «채운» 행의 전/후 blocker — 「채워도 왜 SAME 이 아닌가」");
    console.log(`${"═".repeat(116)}`);
    for (const p of SAME05_PAIRS) {
      const after = cfAliasFromTitle(p.facts);
      if (after.brand === p.facts.brand) continue;
      const b = judge(p.origin, p.facts);
      const c = judge(p.origin, after);
      console.log(`  ${pad(p.id, 8)}${pad(host(p.facts.sourceUrl), 22)}[human ${p.human}]  brand null → ${JSON.stringify(after.brand)}`);
      console.log(`      전  verdict ${pad(b.verdict, 16)}blockers [${b.blockers.join(" · ")}]  conflicts [${b.conflicts.join(" · ")}]`);
      console.log(`      후  verdict ${pad(c.verdict, 16)}blockers [${c.blockers.join(" · ")}]  conflicts [${c.conflicts.join(" · ")}]`);
      console.log(
        `      🔴 **남은 관문** = [${c.blockers.join(" · ") || "없음"}]` +
          `${c.conflicts.length ? ` + conflicts [${c.conflicts.join(" · ")}]` : ""}`,
      );
    }

    expect(base.tp).toBe(5);
    expect(base.fp).toBe(2);
  });
});
