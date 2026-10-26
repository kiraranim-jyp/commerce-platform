import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts, compareModelCode, deriveMatchTruth } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-NEXT STEP 5-EVIDENCE **Track A** — WU-143 **C3** GT precision 측정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시(2026-10-26) — 「`품번 exact → 브랜드 확인` 승격을 **열기 전에** false SAME
 *    위험을 측정한다」. 🔴 **C3 를 운영에 적용하지 않는다** · `NO_TITLE_OVERLAP` 완화 0.
 *
 * ── 🔴 C3 를 «코드를 고치지 않고» 재는 방법 ─────────────────────────────────
 * ```
 * C3 가 바꾸는 것은 **boolean 둘** 이다(cross-seller.ts:807·808):
 *      brandKnown = Boolean(x.brand && y.brand)
 *      brandOk    = brandKnown && brandsCompatible(x.brand, y.brand)
 * 🟢 그래서 **후보 facts 의 brand 를 원상품 brand 로 바꿔** 같은 판정기를 두 번 돌리면
 *    그 둘이 **정확히 C3 의 상태** 가 된다(WU-134 STEP 2 의 반사실 방식과 같다).
 * 🔴 그리고 **품번이 exact 일 때만** 바꾼다 — C3 의 조건이 그것이다(`partial` 제외).
 * 🔴 한계 — brand 문자열 자체가 바뀌므로 **brand 를 읽는 다른 곳이 있으면** 그 효과도
 *    섞인다. 실측 범위에서 brand 를 보는 축은 `BRAND_*` 둘뿐이다(그 파일 전수).
 * ```
 *
 * 🔴 **분모를 숨기지 않는다** — CPO 가 말한 「GT 63쌍」 중 **facts 가 저장된 쌍만**
 *    offline 으로 돌릴 수 있다(나머지는 live 재추출 = HTTP 수십 회). 그 수를 적는다.
 * 🔴 운영 코드 변경 0 · 네트워크 0 · 배포 0.
 */
const FIX = join(__dirname, "fixtures");
const A = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<
    string,
    { searchId: string; domain: string; url: string; humanGt: string; title: string; facts: ProductFacts }
  >;
};
const B = JSON.parse(readFileSync(join(FIX, "wu-068-new-gt.json"), "utf8")) as Record<
  string,
  { id: string; searchId: string; domain: string; url: string; gt: string; facts: ProductFacts }
>;

/** 🟢 원상품 facts 는 **운영과 같은 경로** 로 만든다(dna → facts · 사본 0). */
const originFacts = new Map<string, ProductFacts>();
for (const [sid, o] of Object.entries(A.origins)) {
  const dna = buildProductIdentityDna(o.canonicalProduct as never);
  originFacts.set(sid, productFactsFromIdentityDna(dna));
}

interface Pair {
  id: string;
  searchId: string;
  domain: string;
  human: string;
  facts: ProductFacts;
  src: string;
}
const pairs: Pair[] = [];
for (const [id, c] of Object.entries(A.candidates)) {
  pairs.push({ id, searchId: c.searchId, domain: c.domain, human: c.humanGt, facts: c.facts, src: "wu-059" });
}
for (const r of Object.values(B)) {
  pairs.push({ id: r.id, searchId: r.searchId, domain: r.domain, human: r.gt, facts: r.facts, src: "wu-068" });
}

/** 🔴 운영 판정 순서 그대로 — cross-seller → deriveMatchTruth → priceTierFromLink. */
function judge(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  const code = compareModelCode(origin.brandModelCode, cand.brandModelCode);
  const truth = deriveMatchTruth(
    "low",
    code,
    cross.verdict,
    cross.blockers,
    cross.conflicts,
    /** 🔴 색상 미확인 술어를 **지어내지 않는다** — 후보 색상이 없으면 그 상태다. */
    !cand.colorText,
  );
  return {
    cross,
    code,
    truth,
    display: domesticMatchDisplay(truth).tier,
    tier: priceTierFromLink({ matchTruth: truth, verified: false }),
  };
}

describe("STEP 5-EVIDENCE Track A — C3(품번 exact ⟹ 브랜드 확인) GT precision", () => {
  it("baseline 과 C3 반사실을 같은 분모에서 비교한다", () => {
    /* eslint-disable no-console */
    const usable = pairs.filter((p) => originFacts.has(p.searchId) && p.facts);
    const labeled = usable.filter((p) => p.human === "SAME" || p.human === "DIFFERENT");
    console.log(
      `\n═══ 분모 ═══\n저장된 GT 쌍 ${pairs.length} · facts+원상품 보유 ${usable.length}` +
        ` · 라벨 있음(UNCERTAIN 제외) **${labeled.length}**` +
        ` (SAME ${labeled.filter((p) => p.human === "SAME").length} ·` +
        ` DIFFERENT ${labeled.filter((p) => p.human === "DIFFERENT").length})`,
    );
    console.log(
      `🔴 CPO 가 말한 「GT 63쌍」 중 **facts 가 저장된 쌍만** offline 측정 가능하다 —` +
        ` 나머지는 live 재추출(HTTP)이 필요하다. 이 숫자를 63 으로 적지 않는다.`,
    );

    let baseSame = 0;
    let baseFalse = 0;
    let cfSame = 0;
    let cfFalse = 0;
    const flips: string[] = [];
    const codeExactRows: string[] = [];
    const noTitleAndCodeExact: string[] = [];

    console.log("\n═══ 쌍별 ═══\nid | src | domain | human | code | base(truth/display/tier) | C3(truth/display/tier)");
    for (const p of labeled) {
      const origin = originFacts.get(p.searchId)!;
      const base = judge(origin, p.facts);
      /** 🟢 C3 반사실 — **품번 exact 일 때만** 후보 brand 를 원상품 brand 로 둔다. */
      const cfFacts: ProductFacts =
        base.code === "exact" && origin.brand ? { ...p.facts, brand: origin.brand } : p.facts;
      const cf = judge(origin, cfFacts);

      const baseIsSame = base.display === "SAME";
      const cfIsSame = cf.display === "SAME";
      if (baseIsSame) {
        if (p.human === "SAME") baseSame += 1;
        else baseFalse += 1;
      }
      if (cfIsSame) {
        if (p.human === "SAME") cfSame += 1;
        else cfFalse += 1;
      }
      if (baseIsSame !== cfIsSame) {
        flips.push(
          `${p.id}(${p.domain}) human=${p.human} ${baseIsSame ? "SAME→비SAME" : "비SAME→**SAME**"}`,
        );
      }
      if (base.code === "exact") {
        codeExactRows.push(`${p.id} ${p.domain} human=${p.human} base=${base.display} C3=${cf.display}`);
        const bl = base.cross.blockers.map((b) => b.blocker);
        if (bl.includes("NO_TITLE_OVERLAP")) {
          noTitleAndCodeExact.push(`${p.id} ${p.domain} human=${p.human} blockers=[${bl.join(",")}]`);
        }
      }
      console.log(
        `${p.id} | ${p.src} | ${p.domain} | ${p.human} | ${base.code} |` +
          ` ${base.truth}/${base.display}/${base.tier} | ${cf.truth}/${cf.display}/${cf.tier}`,
      );
    }

    const pct = (n: number, d: number) => (d === 0 ? "측정불가" : `${((n / d) * 100).toFixed(1)}%`);
    console.log(
      `\n═══ 결과 ═══\nbaseline  SAME 판정 ${baseSame + baseFalse} = 정답 ${baseSame} · **false SAME ${baseFalse}**` +
        ` · precision ${pct(baseSame, baseSame + baseFalse)}` +
        ` · recall ${pct(baseSame, labeled.filter((p) => p.human === "SAME").length)}`,
    );
    console.log(
      `C3        SAME 판정 ${cfSame + cfFalse} = 정답 ${cfSame} · **false SAME ${cfFalse}**` +
        ` · precision ${pct(cfSame, cfSame + cfFalse)}` +
        ` · recall ${pct(cfSame, labeled.filter((p) => p.human === "SAME").length)}`,
    );
    console.log(`\n뒤집힌 쌍 ${flips.length}건${flips.length ? ":\n  " + flips.join("\n  ") : ""}`);
    console.log(`\n품번 exact 쌍 ${codeExactRows.length}건:\n  ${codeExactRows.join("\n  ") || "없음"}`);
    console.log(
      `\n🔴 **NO_TITLE_OVERLAP ∧ 품번 exact** = ${noTitleAndCodeExact.length}건` +
        `${noTitleAndCodeExact.length ? ":\n  " + noTitleAndCodeExact.join("\n  ") : " (이 분모에 없다)"}`,
    );

    /** 🔴 이 하니스는 **판정하지 않는다** — 분모가 섰는지만 단언한다. */
    expect(labeled.length, "🔴 라벨 쌍이 없으면 측정 자체가 성립하지 않는다").toBeGreaterThan(10);
    expect(originFacts.size).toBeGreaterThan(0);
  });
});
