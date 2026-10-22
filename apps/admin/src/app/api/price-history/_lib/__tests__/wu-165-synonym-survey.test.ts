import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { extractCategoryTaxon } from "@commerce/crawler/src/comparison-search/match";
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna, tokenizeFactText } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-165 — **상품명 동의어/명칭 변형 전수 조사** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 정정(2026-10-22) — 「**WU-078 의 «음역 축 종료» 를 «동의어 검토 전체 종료» 로
 * 잘못 해석했다.** 그건 다른 얘기다」. ⟹ `NO_TITLE_OVERLAP` 을 완화하기 **전에**
 * 제품 전체 관점에서 동의어·명칭 변형 증거를 조사한다.
 *
 * 🔴 운영 코드 **0** · 운영 변경 **0** · 배포 **0** · threshold **0** ·
 *    `B226AC009` 하나를 살리는 **임시 예외 0**.
 * 🔴 게이트 `WU_165_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢🟢 ① 이미 있는 동의어 자산(코드 실측 · 추측 0) ────────────────────────
 * ```
 * 🟢 **품목명 한/영 동의어는 «이미 있다»** — `product-facts.ts:450~463`
 *    HOODIE  hoodie·hooded·**후드집업**·**후디**
 *    SWEATSHIRT sweatshirt·sweat·jumper·**맨투맨**·**스웨트셔츠**
 *    SHIRT   shirt·blouse·polo·tee·**셔츠**·**티셔츠**
 *    PANTS   pants·trousers·leggings·shorts·bermuda·jogging·**바지**·**팬츠**·**레깅스**
 *    ⟹ 그 축은 **CATEGORY** 에서 작동한다(TOP 으로 뭉친다 · CPO 2026-09-10 지시)
 * 🔴 그런데 **TITLE 축에서는 일부러 뺀다** — `cross-seller.ts:919`
 *    `distinctive = tokens.filter((t) => extractCategoryTaxon(t) === null)`
 *    (같은 근거를 두 번 세지 않기 위해 · 주석이 그 이유를 적어 뒀다)
 * 🟢 **브랜드 한/영 alias 는 7건 있다** — `brand-alias.ts`(보보쇼즈·페페·에밀에이다·콩제슬래드…)
 *    🔴 소비처는 **`product-url-facts.ts:248` 하나** 이고 **브랜드 축 전용** 이다
 * 🟢 **표기 변형은 이미 정규화된다** — `tokenizeFactText` 가 영숫자/한글 **이외 전부**
 *    를 구분자로 쪼갠다(하이픈·공백·특수문자·대괄호 전부) · NFC 통일 · 1글자 토큰 버림
 * 🟢 **시즌 표기도 이미 걷어낸다** — `SEASON_CODE_RE = /^(ss|aw|fw|pe)\d{2}$/i`
 *    🔴 단 **`26FW` 는 그 모양이 아니다**(숫자가 앞) ⟹ **토큰으로 남는다**(아래 측정)
 * 🔴 **색상명 한/영 동의어** — `compareColor` 는 색조(GREY/BLUE)로 비교하고 색상사전
 *    확대는 **WU-044 가 금지** 했다(COLOR_VARIANT 보류 계약)
 * 🔴 **고유 상품명(디자인명) 한/영** — 전용 자산 **0**. 그것이 이 조사의 핵심 공백이다
 * ```
 */
const LIVE = process.env.WU_165_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const BISKUIT =
  "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/70/display/1/";

const HANGUL = /[가-힣]/;
const LATIN = /[a-z]/i;
const jac = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = [...a].filter((t) => b.has(t));
  const uni = new Set([...a, ...b]);
  return { inter, jaccard: inter.length / uni.size };
};

describe("WU-165 — 동의어/명칭 변형 전수 조사", () => {
  it.runIf(LIVE)("실제 SAME/DIFFERENT 사례에 적용해 안전성을 측정한다", async () => {
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
    const originAll = new Set(of.coreTitleTokens);
    const originDist = new Set(of.coreTitleTokens.filter((t) => extractCategoryTaxon(t) === null));
    console.log("\n══════ 🔴 원상품 토큰 ══════");
    console.log(`  title        ${JSON.stringify(of.title)}`);
    console.log(`  coreTokens   ${JSON.stringify(of.coreTitleTokens)}`);
    console.log(`  distinctive  ${JSON.stringify([...originDist])}  ← TITLE 축이 **실제로 쓰는** 집합`);
    console.log(`  품목명으로 빠진 것 ${JSON.stringify([...originAll].filter((t) => !originDist.has(t)))}`);

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: { domain: string; url: string; verdict: string; originCode: string }[] };
    const targets = [
      ...gt.candidates.filter((c) => c.originCode === "B226AC009").map((c) => ({ label: c.domain, url: c.url, human: c.verdict })),
      { label: "biskuit.kr(신규)", url: BISKUIT, human: "SAME" },
    ];

    interface Row {
      label: string;
      human: string;
      tokens: string[];
      dist: string[];
      interDist: string[];
      jaccardDist: number;
      /** 🔴 품목명을 **되돌려 포함** 했을 때(= distinctive 필터 해제) 겹치는 말 */
      interAll: string[];
      script: string;
      brandAlias: string | null;
      /** 🔴 샵이 덧붙인 노이즈 토큰(시즌·대상·분류·샵이름) — jaccard 를 희석한다 */
      shopNoise: string[];
    }
    const rows: Row[] = [];

    const NOISE_WORDS = new Set(
      ["26fw", "25ss", "25fw", "24ss", "아동", "키즈", "베이비", "긴팔", "반팔", "신상", "비스킷", "보몽드", "도노키즈"].map(
        (w) => w.normalize("NFC"),
      ),
    );

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`  ${t.label.padEnd(24)} 🔴 ${f.status} — 제외(측정불가)`);
        continue;
      }
      const cf = f.candidate.facts as ProductFacts;
      const all = new Set(cf.coreTitleTokens);
      const dist = new Set(cf.coreTitleTokens.filter((x) => extractCategoryTaxon(x) === null));
      const d = jac(originDist, dist);
      const a = jac(originAll, all);
      const hasK = cf.coreTitleTokens.some((x) => HANGUL.test(x));
      const hasL = cf.coreTitleTokens.some((x) => LATIN.test(x));
      rows.push({
        label: t.label,
        human: t.human,
        tokens: cf.coreTitleTokens,
        dist: [...dist],
        interDist: typeof d === "number" ? [] : d.inter,
        jaccardDist: typeof d === "number" ? 0 : d.jaccard,
        interAll: typeof a === "number" ? [] : a.inter,
        script: hasK && hasL ? "혼재" : hasK ? "한글" : hasL ? "라틴" : "-",
        brandAlias: lookupBrandByAliasInTitle(cf.title) ?? null,
        shopNoise: cf.coreTitleTokens.filter((x) => NOISE_WORDS.has(x.normalize("NFC"))),
      });
    }

    console.log("\n══════ 🔴🔴 ② 실제 사례별 TITLE 축 ══════");
    console.log(`  ${"판매처".padEnd(24)} ${"human".padEnd(10)} ${"문자".padEnd(5)} ${"겹침".padStart(4)} ${"jac".padStart(6)}  겹치는 말`);
    for (const r of rows) {
      console.log(
        `  ${r.label.padEnd(24)} ${r.human.padEnd(10)} ${r.script.padEnd(5)} ${String(r.interDist.length).padStart(4)}` +
          ` ${r.jaccardDist.toFixed(3).padStart(6)}  ${JSON.stringify(r.interDist)}`,
      );
    }

    /* ── ③ 동의어 class 별 «필요성» 과 «위험» 을 같이 센다 ── */
    const blocked = rows.filter((r) => r.interDist.length === 0);
    const blockedSame = blocked.filter((r) => r.human === "SAME");
    const blockedDiff = blocked.filter((r) => r.human === "DIFFERENT");
    console.log("\n══════ 🔴🔴 ③ NO_TITLE_OVERLAP 이 걸리는 집합 ══════");
    console.log(`  전체 ${rows.length} 중 겹침 0 = **${blocked.length}**  (human SAME ${blockedSame.length} · DIFFERENT ${blockedDiff.length})`);
    for (const r of blocked) {
      console.log(`    ${r.human.padEnd(10)} ${r.label.padEnd(22)} ${r.script.padEnd(5)} tokens=${JSON.stringify(r.dist).slice(0, 72)}`);
    }

    console.log("\n══════ 🔴🔴 ④ 동의어 class 별 효과 ↔ 위험 ══════");
    /** class A — 품목명을 TITLE 축에 되돌린다(이미 있는 자산 · 새 규칙 0) */
    const aFix = blocked.filter((r) => r.interAll.length > 0);
    console.log(`  A **품목명 토큰을 TITLE 축에 되돌린다**(기존 자산 · 새 규칙 0)`);
    console.log(`     겹침 0 이던 ${blocked.length}건 중 열리는 것 **${aFix.length}**`);
    console.log(`       그중 human SAME ${aFix.filter((r) => r.human === "SAME").length} · 🔴 **DIFFERENT ${aFix.filter((r) => r.human === "DIFFERENT").length}**`);
    for (const r of aFix) console.log(`       ${r.human.padEnd(10)} ${r.label.padEnd(22)} 겹침 ${JSON.stringify(r.interAll)}`);
    console.log(`     🔴 그러나 그 축은 **CATEGORY 가 이미 센다** ⟹ 같은 근거 이중계산(주석이 금지한 모양)`);

    /** class B — 브랜드 alias(이미 있다 · 브랜드 축 전용) */
    console.log(`\n  B **브랜드 한/영 alias**(이미 있다 · 7건)`);
    console.log(`     alias 로 브랜드가 복원되는 후보 ${rows.filter((r) => r.brandAlias).length}건`);
    console.log(`     🔴 TITLE 축 효과 **0** — brand 는 core token 에서 **노이즈로 제거** 된다(설계)`);

    /** class C — 고유 상품명 한/영(음역) · 전용 자산 0 */
    const crossScript = blocked.filter((r) => r.script === "한글" || r.script === "혼재");
    console.log(`\n  C **고유 상품명 한/영(음역)** — 전용 자산 **0**`);
    console.log(`     겹침 0 중 **문자체계가 다른 것 ${crossScript.length}**` +
      ` (human SAME ${crossScript.filter((r) => r.human === "SAME").length} · DIFFERENT ${crossScript.filter((r) => r.human === "DIFFERENT").length})`);
    for (const r of crossScript) console.log(`       ${r.human.padEnd(10)} ${r.label.padEnd(22)} ${JSON.stringify(r.dist).slice(0, 72)}`);
    console.log(`     🔴 이 class 만이 비스킷을 열 수 있다 — 🔴 그리고 **새 규칙** 이다(CPO 판정)`);

    /** class D — 샵 prefix/suffix·시즌 노이즈가 jaccard 를 희석하는가 */
    const noisy = rows.filter((r) => r.shopNoise.length > 0);
    console.log(`\n  D **샵 prefix/suffix · 시즌 표기 노이즈**`);
    console.log(`     노이즈 토큰이 남은 후보 ${noisy.length}건`);
    for (const r of noisy) console.log(`       ${r.label.padEnd(22)} ${JSON.stringify(r.shopNoise)}`);
    console.log('     🔴 "26fw" 는 SEASON_CODE_RE(/^(ss|aw|fw|pe)\\d{2}$/) 에 **안 걸린다**(숫자가 앞)');
    console.log("     🟡 그 토큰을 걷어내면 **jaccard 분모가 작아진다** — 🔴 단 겹침이 0 이면 효과 0");

    console.log("\n══════ 🔴🔴 ⑤ 판정 재료 ══════");
    console.log("  🔴 A(품목명 되돌리기) — 효과가 있어도 **이중계산** 이라 구조상 금지된 모양이다");
    console.log("  🔴 B(브랜드 alias)   — TITLE 축 효과 **0**(설계상 노이즈 제거)");
    console.log("  🟡 C(고유명 음역)     — **유일하게 효과가 있는 class** · 🔴 **새 규칙** · false SAME 위험을 분모와 함께 봐야 한다");
    console.log("  🟡 D(노이즈 제거)     — 겹침이 0 인 집합에는 **효과 0**(분모만 바뀐다)");
    console.log("  🔴 **임시 예외 0** — B226AC009 전용 규칙을 만들지 않았다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(rows.length).toBeGreaterThan(0);
  }, 900_000);
});
