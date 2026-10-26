import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  deriveMatchTruth,
  extractFromJsonLd,
  productFactsFromListing,
} from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";
import {
  buildProductIdentityDna,
  /**
   * 🔵🔵 CORE-NEXT STEP 5-E2 재측정 — **운영이 쓰는 그 추출기들을 그대로 부른다.**
   *    🔴 규칙을 새로 쓰지 않는다(지어내면 그 측정은 제품과 무관해진다) —
   *       `seller-facts.ts:199~215` 가 Shopify 경로에서 쓰는 **같은 네 함수** 다.
   */
  extractFitPhrase,
  extractLabeledProductCode,
  extractLeadingColorPhrase,
  parseMaterialComposition,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { extractColor } from "@commerce/crawler/src/description-facts";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-NEXT STEP 5-E2 — **상세설명 evidence 안전성 측정**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 결정(2026-10-26) — 「`description` 전체를 무조건 MI 축에 넣는 방식은 금지.
 *    **무엇이 실제 SAME 판단에 영향을 주는가** 를 분리해서 측정한다」.
 *
 * ── 🟢 분모가 «8쌍» 인 구조적 이유 ──────────────────────────────────────────
 * ```
 * CORE-2AC 가 끊은 자리는 `product-url-facts.ts:441`(**PLAIN_HTML 경로**)이다.
 * 🟢 Shopify 경로는 `seller-facts` 가 `description`/`body` 를 **이미 소비** 한다 ⟹
 *    GT 27쌍 중 **19쌍은 이미 채워져 있고** 반사실이 성립하지 않는다.
 * 🔴 그래서 이 측정의 유효 분모는 **다섯 칸이 전건 비어 있는 8쌍**(SAME 5 · DIFF 3)이다.
 *    「27쌍 전수」로 적지 않는다.
 * ```
 *
 * 🔴 **운영 코드 변경 0** — 운영이 쓰는 함수(`extractFromJsonLd` ·
 *    `productFactsFromListing` · `compareCrossSellerProducts` · `deriveMatchTruth` ·
 *    `priceTierFromLink`)를 **그대로** 부르고, 바뀌는 것은 **`description` 인자 하나** 다.
 * 🔴 게이트 `CORE_STEP5E2_PROBE=1` 없으면 SKIP(외부 HTTP).
 */
const LIVE = process.env.CORE_STEP5E2_PROBE === "1";
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
  { id: string; searchId: string; domain: string; url: string; gt: string; title: string; facts: ProductFacts }
>;

interface Pair {
  id: string;
  searchId: string;
  domain: string;
  url: string;
  title: string;
  human: string;
  stored: ProductFacts;
}
const pairs: Pair[] = [];
for (const [id, c] of Object.entries(A.candidates))
  pairs.push({ id, searchId: c.searchId, domain: c.domain, url: c.url, title: c.title, human: c.humanGt, stored: c.facts });
for (const r of Object.values(B))
  pairs.push({ id: r.id, searchId: r.searchId, domain: r.domain, url: r.url, title: r.title, human: r.gt, stored: r.facts });

/** 🔴 **다섯 칸이 전건 비어 있는 쌍만** — 그것이 CORE-2AC 절단의 영향권이다. */
const isPlainShape = (f: ProductFacts) =>
  !f.materialText && !f.colorText && !f.fitText && !f.ageRangeText;
const target = pairs.filter(
  (p) => (p.human === "SAME" || p.human === "DIFFERENT") && p.stored && isPlainShape(p.stored) && A.origins[p.searchId],
);

const originFacts = new Map<string, ProductFacts>();
for (const [sid, o] of Object.entries(A.origins)) {
  const dna = buildProductIdentityDna(o.canonicalProduct as never);
  originFacts.set(sid, productFactsFromIdentityDna(dna));
}

function judge(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  const code = compareModelCode(origin.brandModelCode, cand.brandModelCode);
  const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !cand.colorText);
  return { cross, code, truth, display: domesticMatchDisplay(truth).tier, tier: priceTierFromLink({ matchTruth: truth, verified: false }) };
}

describe("STEP 5-E2 — 상세설명 evidence 안전성", () => {
  it.runIf(LIVE)("description 인자 하나의 전/후를 같은 분모에서 비교한다", async () => {
    /* eslint-disable no-console */
    console.log(
      `\n═══ 1. 분모 ═══\n저장 GT 라벨쌍 ${pairs.filter((p) => p.human === "SAME" || p.human === "DIFFERENT").length}` +
        ` · 그중 **다섯 칸 전건 비어 있음(PLAIN_HTML 영향권) ${target.length}**` +
        ` (SAME ${target.filter((p) => p.human === "SAME").length} · DIFF ${target.filter((p) => p.human === "DIFFERENT").length})`,
    );
    console.log(
      "🔴 나머지는 Shopify 경로라 description 이 **이미 소비** 된다 ⟹ 반사실이 성립하지 않는다.",
    );

    let bS = 0, bF = 0, cS = 0, cF = 0;
    let newMaterial = 0, newMaterialBlocker = 0, newMatBlkSame = 0, newMatBlkDiff = 0;
    /** 🔵 발화 축을 **넷으로** 센다(1차 단언이 둘만 봐서 발화를 놓쳤다). */
    let newColor = 0, newFit = 0, newBlockerSame = 0, newBlockerDiff = 0;
    const newBlockerRows: string[] = [];
    let newCodeExact = 0, newCodeSame = 0, newCodeDiff = 0, codeConflictNew = 0;
    const flips: string[] = [];
    const brandRows: string[] = [];
    const organicRows: string[] = [];

    console.log("\n═══ 2·3. 쌍별 (baseline → description 적용) ═══");
    for (const p of target) {
      const origin = originFacts.get(p.searchId)!;
      let html = "";
      try {
        const res = await fetch(p.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure)" } });
        html = res.ok ? await res.text() : "";
      } catch {
        html = "";
      }
      if (!html) {
        console.log(`${p.id} | ${p.domain} | human=${p.human} | 🔴 **UNREACHABLE — 측정불가**`);
        continue;
      }
      const jsonLd = extractFromJsonLd(html);
      const description = jsonLd?.description ?? null;
      /** 🟢 baseline = 운영이 **지금** 만드는 그 facts(category 하나만 넘긴다). */
      const base = productFactsFromListing({
        title: p.title,
        url: p.url,
        brand: p.stored.brand,
        category: jsonLd?.jsonLdCategory ?? null,
      });
      /**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 반사실 — **운영 코드 0 · 하니스 안에서 «로컬 복제»**(CPO 승인 조건)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 1차에는 `productFactsFromListing({description})` 로 넘겼고 **그 칸이 없어서
       *    조용히 무시** 됐다(발화 0). 🟢 그래서 이번에는 그 함수가 «할 일» 을
       *    **운영이 쓰는 같은 추출기** 로 여기서 조립한다(`seller-facts.ts:199~215`).
       * 🔴 **규칙을 새로 쓰지 않는다** — 네 함수의 호출 모양을 그 파일에서 그대로 베꼈다.
       * 🔴 `coreTitleTokens` 는 **재파생하지 않았다** — 그 4번째 인자(material)를 바꾸는
       *    것은 CORE-2AC 가 「바꾸지 않는다」고 적어 둔 자리다(한계로 보고한다).
       */
      const descPlain = (description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const cf: ProductFacts = {
        ...base,
        colorText: base.colorText ?? extractLeadingColorPhrase(descPlain) ?? extractColor(descPlain) ?? null,
        materialText:
          base.materialText ?? (parseMaterialComposition(descPlain).length > 0 ? descPlain : null),
        fitText: base.fitText ?? extractFitPhrase(descPlain) ?? null,
        brandModelCode: base.brandModelCode ?? extractLabeledProductCode(descPlain) ?? null,
      };

      const jb = judge(origin, base);
      const jc = judge(origin, cf);
      const bIsSame = jb.display === "SAME";
      const cIsSame = jc.display === "SAME";
      if (bIsSame) (p.human === "SAME" ? bS++ : bF++);
      if (cIsSame) (p.human === "SAME" ? cS++ : cF++);
      if (bIsSame !== cIsSame) flips.push(`${p.id}(${p.domain}) human=${p.human} ${bIsSame ? "SAME→비SAME" : "비SAME→**SAME**"}`);

      /* ── Track E2-B — material false blocker ── */
      if (!base.materialText && cf.materialText) newMaterial += 1;
      if (!base.colorText && cf.colorText) newColor += 1;
      if (!base.fitText && cf.fitText) newFit += 1;
      const bBlk = new Set(jb.cross.blockers.map((x) => x.blocker));
      const cBlk = jc.cross.blockers.map((x) => x.blocker);
      const matNew = cBlk.includes("MATERIAL") && !bBlk.has("MATERIAL");
      if (matNew) {
        newMaterialBlocker += 1;
        if (p.human === "SAME") newMatBlkSame += 1;
        else newMatBlkDiff += 1;
      }
      /** 🔴 **새로 생긴 blocker 를 전부 센다** — false DIFFERENT 위험의 직접 지표다. */
      const addedBlockers = cBlk.filter((x) => !bBlk.has(x));
      if (addedBlockers.length > 0) {
        if (p.human === "SAME") newBlockerSame += 1;
        else newBlockerDiff += 1;
        newBlockerRows.push(`${p.id}(${p.domain}) human=${p.human} +[${addedBlockers.join(",")}]`);
      }
      if (/organic/i.test(String(cf.materialText ?? "")) || /organic/i.test(String(origin.materialText ?? ""))) {
        organicRows.push(`${p.id} origin=${JSON.stringify(origin.materialText)?.slice(0, 50)} cand=${JSON.stringify(cf.materialText)?.slice(0, 50)} MATERIAL새로=${matNew}`);
      }

      /* ── Track E2-C — 품번 회수 ── */
      if (jb.code !== "exact" && jc.code === "exact") {
        newCodeExact += 1;
        if (p.human === "SAME") newCodeSame += 1;
        else newCodeDiff += 1;
      }
      if (jb.code !== "conflict" && jc.code === "conflict") codeConflictNew += 1;

      /* ── Track E2-E — 브랜드는 «별도» 로만 관측 ── */
      const originBrand = origin.brand ?? "";
      const descHasBrand = originBrand ? new RegExp(originBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(description ?? "") : false;
      brandRows.push(
        `${p.id} ${p.domain} storedBrand=${JSON.stringify(p.stored.brand)} descBrandEvidence=${descHasBrand} (🔴 덮어쓰지 않았다)`,
      );

      console.log(
        `${p.id} | ${p.domain} | human=${p.human} | desc=${description ? description.length + "자" : "**없음**"}` +
          ` | base ${jb.code}/${jb.display}/${jb.tier} → CF ${jc.code}/${jc.display}/${jc.tier}` +
          ` | material ${JSON.stringify(base.materialText)}→${JSON.stringify(cf.materialText)?.slice(0, 40)}` +
          ` | code ${JSON.stringify(base.brandModelCode)}→${JSON.stringify(cf.brandModelCode)}` +
          ` | blockers [${[...bBlk].join(",")}]→[${cBlk.join(",")}]`,
      );
    }

    const pct = (n: number, d: number) => (d === 0 ? "측정불가" : `${((n / d) * 100).toFixed(1)}%`);
    const sameN = target.filter((p) => p.human === "SAME").length;
    console.log(
      `\n═══ 4·5·6. 결과 ═══\nbaseline  SAME ${bS + bF} = 정답 ${bS} · **false SAME ${bF}** · precision ${pct(bS, bS + bF)} · recall ${pct(bS, sameN)}`,
    );
    console.log(
      `CF(desc)  SAME ${cS + cF} = 정답 ${cS} · **false SAME ${cF}** · precision ${pct(cS, cS + cF)} · recall ${pct(cS, sameN)}`,
    );
    console.log(`뒤집힌 쌍 ${flips.length}${flips.length ? ":\n  " + flips.join("\n  ") : ""}`);
    console.log(
      `\n═══ 7. material ═══\n새 materialText ${newMaterial}건 · 그중 **새 MATERIAL blocker ${newMaterialBlocker}건**` +
        ` (human SAME ${newMatBlkSame} · DIFFERENT ${newMatBlkDiff})`,
    );
    console.log(`organic 관련 쌍:\n  ${organicRows.join("\n  ") || "없음"}`);
    console.log(
      `\n🔴 **새 blocker 가 붙은 쌍** — human SAME ${newBlockerSame} · DIFFERENT ${newBlockerDiff}` +
        `${newBlockerRows.length ? ":\n  " + newBlockerRows.join("\n  ") : " (없음)"}` +
        `\n   🔴 human SAME 에 새 blocker 가 붙는 것이 **false DIFFERENT 위험** 이다`,
    );
    console.log(
      `\n═══ 8. modelCode ═══\n새로 exact 가 된 쌍 ${newCodeExact}(human SAME ${newCodeSame} · DIFFERENT ${newCodeDiff})` +
        ` · 새 conflict ${codeConflictNew}`,
    );
    console.log(`\n═══ 9. brand evidence (별도 관측 · 덮어쓰기 0) ═══\n  ${brandRows.join("\n  ")}`);

    expect(target.length, "🔴 분모가 비면 측정 자체가 성립하지 않는다").toBeGreaterThan(3);
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 **반사실이 «발화했는지» 를 단언한다 — 이 하니스의 가장 중요한 줄**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 1차 실행에서 `description` 을 넘겼는데 **전건 변화 0** 이 나왔다. 그것을
     *    「안전하다」로 읽었으면 **거짓 보고** 였다 — 원인은 **반사실이 돌지 않은 것** 이다:
     * ```
     * ListingProductLike(seller-facts.ts:252)  →  🔴 **description 칸이 없다**
     * description/body 를 받는 생산자는 `productFactsFromShopifyProduct`(:169) 하나다
     * ⟹ 내가 넘긴 인자는 **조용히 무시** 됐다(`as never` 로 타입도 가렸다)
     * ```
     * 🟢 그래서 **발화 여부를 숫자로** 문다 — 새 materialText 가 하나도 안 생기고
     *    새 품번도 하나도 안 생기면 **「측정불가」** 이고 **「안전」이 아니다.**
     * 🔴 이 단언이 FAIL 하는 동안은 E2-A/B/C 결과를 **인용하지 않는다.**
     */
    /**
     * 🔴 **1차 단언이 좁았다** — `material`/`품번` 만 봤는데 실제 발화는 **color/fit**
     *    에서 났다(S1-1 `[]→[COLOR_VARIANT,FIT]`). 🟢 그래서 **네 축 전부** 를 센다.
     */
    const cfFired = newMaterial > 0 || newCodeExact > 0 || newColor > 0 || newFit > 0;
    console.log(
      `\n═══ 🔴 반사실 발화 여부 ═══\n새 materialText ${newMaterial} · 새 품번 exact ${newCodeExact}` +
        ` · 새 colorText ${newColor} · 새 fitText ${newFit}` +
        ` ⟹ ${cfFired ? "🟢 **발화함**(결과 인용 가능)" : "🔴 **발화하지 않음 — 측정불가다**"}`,
    );
    expect(
      cfFired,
      "🔴🔴 반사실이 발화하지 않았다 — `productFactsFromListing` 은 description 칸이 없다." +
        " 「변화 0」을 「안전」으로 읽지 않는다(측정불가).",
    ).toBe(true);
  }, 600_000);
});
