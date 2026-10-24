import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { withConfidence } from "@commerce/crawler/src/comparison-search/match";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2O — **Product Code Conflict Counterfactual**(측정 전용 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문(2026-10-24) — 「**품번 불일치를 이유로 CONFLICT 를 발생시키는 현재 게이트가
 * 실제 SAME 상품의 recall 을 과도하게 손실시키는가?**」 · 답은 **A 유지 / B 완화 후보 /
 * C 구조 재설계 후보** 중 하나로만 끝낸다.
 *
 * 🔴 운영 코드 변경 **0** · CONFLICT 실제 제거 **0** · threshold **0** ·
 *    `SAME_MIN_AXES` **0** · `crossSellerReserved` 실제 변경 **0** ·
 *    `NO_TITLE_OVERLAP` 실제 변경 **0** · exact identifier 실제 승격 **0** ·
 *    brand/title/product model/normalization/search/price/UI **전부 0**.
 *
 * ── 🟢🟢 변이를 «하지 않고» 분해한다 — 운영 함수가 인자로 받기 때문이다 ─────
 * ```
 * `deriveMatchTruth(level, modelCode, **crossSeller**, **blockers**)`
 *   M2  blockers 에서 `NO_TITLE_OVERLAP` 만 빼서 넘긴다   ← 입력만
 *   M4  crossSeller 를 `undefined` 로 넘긴다              ← 입력만
 *       (`crossSellerReserved = (crossSeller === "PRESUMED_SAME")` 이므로 false 가 된다)
 * `compareCrossSellerProducts(origin, **facts**)`
 *   CF-B  facts.brandModelCode 를 `null` 로 넘긴다        ← 입력만
 * 🟢 그래서 **운영 파일을 한 글자도 건드리지 않는다**(CORE-2I 는 변이를 썼다 · 이번은 불필요).
 * ```
 *
 * ── 🔴 각 CF 가 «무엇을 재는지» 를 섞지 않는다 ───────────────────────────
 * ```
 * CF-B(품번 칸 null)  → `compareCrossSellerProducts` 의 **verdict** 가 움직인다
 * M1~M5              → `deriveMatchTruth` 의 **확정 등급(matchTruth)** 만 움직인다
 *                       🔴 verdict 는 **안 변한다** — 그 둘을 한 숫자로 합치지 않는다
 * CF-C               → 🔴 **엔진을 바꾸지 않으면 「참고 evidence」 상태가 존재하지 않는다**
 *                       ⟹ verdict/등급이 CF-B 와 **같다**. 새 숫자가 아니라 **관찰 기록** 이다
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";
const BOBO = "https://bobochoses.com/products/b226ab040-hug-hairy-monster-t-shirt";

interface GtCand {
  domain: string;
  url: string;
  ceoUiLabel: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
  ceoBasis: string;
}

describe("CORE-2O — Product Code Conflict Counterfactual (운영 변경 0)", () => {
  it("CF-A/B/C + M1~M5 + Safety 를 한 번에 잰다", async () => {
    /* ── 원상품 ─────────────────────────────────────────────────────── */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const h = await fetchPlainHtml(ORIGIN);
      const sb = h ? extractSiteBrandName(h) : null;
      if (sb?.value) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: sb.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    expect(dna.brand.value).toBeTruthy();
    expect(dna.brandModelCode).toBe(ORIGIN_CODE);

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8"),
    ) as { candidates: GtCand[] };
    const query = {
      title: ex!.productData!.title ?? "",
      brand: dna.brand.value || undefined,
      sourceUrl: ORIGIN,
      sku: dna.brandModelCode ?? undefined,
      facts: originFacts,
    } as ComparisonQuery;

    type Lv = "low" | "very_high";
    const run = (facts: ProductFacts, level: Lv) => {
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
      return { cmp, verdict: cross.verdict, truth, blockers: cross.blockers, conflicts: Object.keys(cross.conflicts ?? {}) };
    };

    interface Row {
      g: GtCand;
      code: string | null;
      cls: string;
      a: ReturnType<typeof run>;
      /** 🟢 CPO isolation — `DIFF_OFFICIAL_LOOKING` 에만 적용. */
      b: ReturnType<typeof run>;
      /** 🔴 전 후보 적용(과잉) — 역효과 기록용. */
      bAll: ReturnType<typeof run>;
      level: Lv;
      facts: ProductFacts;
    }
    const rows: Row[] = [];
    let unreachable = 0;

    for (const g of gt.candidates) {
      const f = await factsFromProductUrl(g.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${g.domain.padEnd(24)} 🔴 ${f.status} — 측정불가`);
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const facts = scored?.facts ?? f.candidate.facts;
      const level = (scored?.matchLevel ?? "low") as Lv;
      const code = facts.brandModelCode ?? null;

      /* ── CF-A — 현재 운영 조건 그대로 ───────────────────────────── */
      const a = run(facts, level);
      /**
       * ── CF-B — **품번 칸만 비운다** ───────────────────────────────
       * 🔴 이것은 「conflict 제거」와 「축 점수 제거」를 **동시에** 한다. 🟢 그러나
       *    `conflict` 인 후보는 **축 점수를 애초에 받지 못한다**(점수는 exact/partial 만)
       *    ⟹ 그 후보들에서는 **conflict 하나만 isolate 된다**. 🔴 exact/partial 후보에서는
       *    점수도 같이 빠지므로 **그 둘을 같은 줄로 읽지 않는다**(아래 표에서 분류로 가른다).
       */
      const bAll = run({ ...facts, brandModelCode: null } as ProductFacts, level);

      const sharesPrefix = !!code && code.slice(0, 4).toUpperCase() === ORIGIN_CODE.slice(0, 4);
      const cls =
        code == null
          ? "CODE_ABSENT"
          : a.cmp === "exact"
            ? "EXACT_OFFICIAL_CODE"
            : sharesPrefix
              ? "🔴 DIFF_OFFICIAL_LOOKING"
              : "🔴 SELLER_SKU";

      /**
       * ── 🔴🔴 **1차 CF-B 가 과잉이었고 그것이 측정을 틀리게 했다** ────────
       *
       * 전 후보의 품번 칸을 비웠더니 `biskuit`·`m.luxboy`(**exact** 후보)가
       * `PRESUMED_SAME` → **`SIMILAR` 로 «떨어졌다»**. 🔴 그 둘에서 CF-B 는
       * 「conflict 제거」가 아니라 **「증거 제거」**(축 +3 점 상실)다 — 내가 주석에
       * 적어 둔 함정이 **실제로 발생** 했다. 🔴 그대로 보고했으면 「CONFLICT 를 풀면
       * 등급이 내려간다」는 **거짓 인과** 였다.
       *
       * 🟢 그래서 **CPO 가 지정한 isolation** 으로 좁힌다 — `DIFF_OFFICIAL_LOOKING`
       *    후보에서만 품번 칸을 비운다. 그 후보는 축 점수를 **애초에 못 받으므로**
       *    conflict **하나만** 제거된다. 🟢 전체 적용분(`bAll`)은 **역효과 기록용** 으로 남긴다.
       */
      const b = cls.includes("DIFF_OFFICIAL_LOOKING") ? bAll : a;

      rows.push({ g, code, cls, a, b, bAll, level, facts });
    }
    expect(rows.length).toBeGreaterThan(0);

    /* ═══ 1. CF-A ↔ CF-B 후보별 나란히 ═══════════════════════════════ */
    console.log("\n═══ 1. CONFLICT 제거 전/후 (후보별) ═══");
    console.log("    판매처                  CEO         분류                     code         전(CF-A)        후(CF-B)");
    for (const r of rows) {
      console.log(
        `    ${r.g.domain.padEnd(22)} ${r.g.calibrationLabel.padEnd(11)} ${r.cls.padEnd(24)} ` +
          `${String(r.code).padEnd(12)} ${r.a.verdict.padEnd(15)} ${r.b.verdict}` +
          (r.a.verdict !== r.b.verdict ? "   ← 이동" : ""),
      );
    }

    /* ═══ 2. 핵심 fixture 셋 ═════════════════════════════════════════ */
    console.log("\n═══ 2. 핵심 fixture ═══");
    const je = rows.find((r) => r.g.domain === "junioredition.com");
    const bo = rows.find((r) => r.g.domain === "bobochoses.com");
    const lx = rows.find((r) => r.g.domain === "m.luxboy.com");
    for (const [tag, r] of [["A junioredition", je], ["B bobochoses", bo], ["C m.luxboy", lx]] as const) {
      if (!r) {
        console.log(`    ${tag} — 🔴 측정불가`);
        continue;
      }
      console.log(
        `    ${tag.padEnd(16)} code=${String(r.code).padEnd(12)} cmp=${r.a.cmp.padEnd(11)} ` +
          `CF-A **${r.a.verdict}/${r.a.truth}** → CF-B **${r.b.verdict}/${r.b.truth}**`,
      );
      console.log(`        conflicts ${JSON.stringify(r.a.conflicts)} · blockers ${JSON.stringify(r.a.blockers.map((x) => x.blocker))}`);
    }

    /* ═══ 3. K6 bobochoses fetch-path 변동 ═══════════════════════════ */
    console.log("\n═══ 3. K6 bobochoses fetch-path 변동(같은 URL 3회) ═══");
    const variance: { path: string; code: string | null }[] = [];
    for (let i = 0; i < 3; i++) {
      const f = await factsFromProductUrl(BOBO);
      variance.push({
        path: String((f as { fetchPath?: string }).fetchPath ?? f.status),
        code: f.candidate?.facts?.brandModelCode ?? null,
      });
    }
    for (const [i, v] of variance.entries()) console.log(`    ${i + 1}회  path=${v.path.padEnd(14)} code=${String(v.code)}`);
    const paths = new Set(variance.map((v) => v.path));
    const codes = new Set(variance.map((v) => String(v.code)));
    console.log(
      `    ⟹ path 종류 **${paths.size}** · code 종류 **${codes.size}** ` +
        (paths.size > 1 || codes.size > 1 ? "🔴🔴 **같은 URL 이 실행마다 다른 품번 칸을 낸다**" : "🟢 이번 3회는 일정"),
    );
    /**
     * 🔴🔴 **이번 3회에서는 변동이 «재현되지 않았다»** — 전부 `PLAIN_HTML`/`code=null`.
     *    🔴 그러니 「분모가 1 인 것은 이 변동 때문」이라고 **단정하지 않는다**.
     * 🟢 확정된 사실만 적는다 — **CORE-2L 세션에서는 같은 URL 이 `SHOPIFY_JSON`/
     *    `B226AB040` 을 냈다**(그 보고서에 기록돼 있다) ⟹ **세션 간 변동은 관측됐고**
     *    **같은 세션 3연속에서는 안정적** 이다. 원인은 **미규명** 이다.
     */
    console.log(
      paths.size > 1 || codes.size > 1
        ? "    🔴 같은 세션에서도 변동이 난다"
        : "    🔴 **이번 3회는 재현되지 않았다** — 「분모 1 이 이 변동 때문」이라고 단정하지 않는다.\n" +
          "       🟢 확정 사실: **CORE-2L 세션에서는 같은 URL 이 SHOPIFY_JSON/B226AB040 을 냈다**\n" +
          "       ⟹ **세션 간** 변동은 관측됐고 **같은 세션 3연속** 은 안정적이다 · 원인 **미규명**",
    );

    /* ═══ 4. M1~M5 — m.luxboy 게이트 분해(입력만) ════════════════════ */
    console.log("\n═══ 4. M1~M5 m.luxboy 확정등급 분해 (🔴 verdict 는 안 변한다) ═══");
    if (lx) {
      const noTitle = lx.a.blockers.filter((x) => x.blocker !== "NO_TITLE_OVERLAP");
      const m = {
        M1: deriveMatchTruth(lx.level, lx.a.cmp, lx.a.verdict, lx.a.blockers),
        M2: deriveMatchTruth(lx.level, lx.a.cmp, lx.a.verdict, noTitle),
        M3: deriveMatchTruth(lx.level, lx.a.cmp, lx.a.verdict, lx.a.blockers),
        M4: deriveMatchTruth(lx.level, lx.a.cmp, undefined, lx.a.blockers),
        M5: deriveMatchTruth(lx.level, lx.a.cmp, undefined, noTitle),
      };
      console.log(`    verdict(불변) **${lx.a.verdict}** · cmp **${lx.a.cmp}** · blockers ${JSON.stringify(lx.a.blockers.map((x) => x.blocker))}`);
      console.log(`    M1 현행 유지                      → **${m.M1}**`);
      console.log(`    M2 NO_TITLE_OVERLAP 만 제거        → **${m.M2}**`);
      console.log(`    M3 crossSellerReserved 유지        → **${m.M3}**`);
      console.log(`    M4 crossSellerReserved 만 제거     → **${m.M4}**`);
      console.log(`    M5 둘 다 제거                      → **${m.M5}**`);
      const ident = (v: unknown) => v === "EXACT_IDENTIFIER" || v === "STRONG_IDENTIFIER";
      console.log(
        `    ⟹ 식별자 등급 도달 — M1 ${ident(m.M1) ? "O" : "X"} · M2 ${ident(m.M2) ? "O" : "X"} · ` +
          `M4 ${ident(m.M4) ? "O" : "X"} · **M5 ${ident(m.M5) ? "O" : "X"}**`,
      );
      console.log(
        `    🔴 **${!ident(m.M2) && !ident(m.M4) && ident(m.M5) ? "하나만 풀면 변화 0 · 둘을 풀어야 움직인다(이중 잠금 재확인)" : "분해 결과를 그대로 읽는다"}**`,
      );
      /** 🔴 그래도 verdict 는 `SAME` 이 아니다 — 등급과 verdict 를 섞지 않는다. */
      expect(lx.a.verdict, "🔴 M1~M5 는 verdict 를 바꾸지 않는다(등급 축이다)").not.toBe("SAME");
    } else console.log("    🔴 m.luxboy 측정불가");

    /* ═══ 5. Safety S1~S4 ═══════════════════════════════════════════ */
    const same = (r: Row, k: "a" | "b") => r[k].verdict === "SAME";
    const s1 = rows.filter((r) => r.g.calibrationLabel === "SAME" && !same(r, "a") && same(r, "b"));
    const s2 = rows.filter((r) => r.g.calibrationLabel === "DIFFERENT" && same(r, "b"));
    const s3 = rows.filter((r) => r.g.calibrationLabel === "UNCERTAIN" && same(r, "b"));
    const moved = rows.filter((r) => r.a.verdict !== r.b.verdict);

    console.log("\n═══ 5. Safety ═══");
    console.log(`    S1 CEO SAME recovery          **${s1.length}**${s1.length ? " — " + s1.map((r) => r.g.domain).join(", ") : ""}`);
    console.log(`    S2 CEO DIFFERENT leakage      **${s2.length}**(parkette 가 SAME 으로 오르는가)`);
    console.log(`    S3 UNCERTAIN leakage          **${s3.length}**(bornyesterdaykids)`);
    console.log(`    S4 Gate movement              **${moved.length}**`);
    for (const r of moved) console.log(`        · ${r.g.domain.padEnd(22)} ${r.a.verdict} → ${r.b.verdict}`);

    /** 🔴🔴 과잉 CF 의 역효과를 **숨기지 않는다** — 그것이 「풀면 안 되는 범위」의 증거다. */
    const harmed = rows.filter((r) => r.a.verdict !== r.bAll.verdict && !r.cls.includes("DIFF_OFFICIAL_LOOKING"));
    console.log(`
    🔴 **전 후보에 적용했을 때의 역효과** **${harmed.length}**`);
    for (const r of harmed) {
      console.log(`        · ${r.g.domain.padEnd(22)} ${r.a.verdict} → ${r.bAll.verdict}  (${r.cls} — 축 점수를 같이 잃는다)`);
    }
    console.log("       ⟹ 🔴 **품번 칸을 «전부» 비우는 방향은 탈락** 이다(exact 후보가 증거를 잃는다)");

    /* ═══ 6. KPI ════════════════════════════════════════════════════ */
    const diffLooking = rows.filter((r) => r.cls.includes("DIFF_OFFICIAL_LOOKING"));
    const k1 = diffLooking.filter((r) => r.g.calibrationLabel === "SAME" && r.a.verdict === "CONFLICT");
    const exact = rows.filter((r) => r.cls === "EXACT_OFFICIAL_CODE");
    console.log("\n═══ 6. KPI ═══");
    console.log(`    K1 code-conflict CEO SAME loss  **${k1.length}** — ${k1.map((r) => `${r.g.domain}(${r.code})`).join(", ") || "없음"}`);
    console.log(`    K2 conflict removal SAME recovery **${s1.length}**`);
    console.log(`    K3 DIFFERENT leakage            **${s2.length}** 🔴 분모 **1**`);
    console.log(`    K4 UNCERTAIN leakage            **${s3.length}** 🔴 분모 **1**`);
    console.log(`    K5 m.luxboy gate decomposition  위 §4`);
    console.log(`    K6 bobochoses fetch-path variance path **${paths.size}** · code **${codes.size}**`);
    console.log(
      `    K7 exact-code baseline stability  n=${exact.length} · CF-B 에서 등급 유지 ` +
        `**${exact.filter((r) => r.a.truth === r.b.truth).length}/${exact.length}**`,
    );
    console.log(`    측정불가                         **${unreachable}**`);

    /* ═══ 7. 판정 A / B / C ═════════════════════════════════════════ */
    console.log("\n═══ 7. 판정 ═══");
    /**
     * 🔴🔴 **1차 판정식이 틀렸다** — 「CEO SAME 회복」을 **verdict SAME 도달** 로만
     *    읽어 **A** 를 냈다. 그런데 `junioredition`(**CEO SAME**)이
     *    `CONFLICT` → `PRESUMED_SAME` 으로 **두 칸 올라간다** — `CONFLICT` 는
     *    **가격 축에서 완전 배제** 이고 `PRESUMED_SAME`(=`TEXT_CONFIRMED`)은
     *    **가격 참고 진입 가능** 이다 ⟹ 🟢 **차단이 실제로 풀린다**.
     * 🔴 그래서 **두 숫자를 갈라** 세고 판정은 **CONFLICT 탈출** 기준으로 한다.
     *    🔴 CTO 가 CPO 의 A/B/C 정의를 바꾼 것이 아니라, 「회복」을 **등급 이동으로도**
     *    센다는 뜻이고 **두 숫자를 모두 보고** 한다.
     */
    const escaped = rows.filter(
      (r) => r.g.calibrationLabel === "SAME" && r.a.verdict === "CONFLICT" && r.b.verdict !== "CONFLICT",
    );
    console.log(`
    🟢 **CONFLICT 탈출(CEO SAME)** **${escaped.length}** — ${escaped.map((r) => r.g.domain).join(", ") || "없음"}`);
    console.log(`    🔴 그중 **verdict SAME 까지** 도달 **${s1.length}**`);
    let verdictLabel: "A" | "B" | "C";
    if (s2.length > 0 || s3.length > 0) verdictLabel = "A";
    else if (escaped.length === 0) verdictLabel = "A";
    else if (s1.length >= 3) verdictLabel = "C";
    else verdictLabel = "B";
    console.log(
      `    **${verdictLabel}** — ` +
        (verdictLabel === "A"
          ? "유지(safety 문제 또는 recall 개선 미미)"
          : verdictLabel === "B"
            ? "완화 후보(CEO SAME 회복 발생 · DIFFERENT 누출 없음 · 🔴 추가 GT 필요)"
            : "구조 재설계 후보(CONFLICT 제거만으로 여러 SAME 회복)"),
    );
    console.log(
      `    근거 — CONFLICT 탈출 **${escaped.length}** · verdict SAME 도달 **${s1.length}** · ` +
        `DIFFERENT 누출 **${s2.length}**(분모 1) · UNCERTAIN 누출 **${s3.length}**(분모 1)`,
    );
    console.log("    🔴 운영 변경 결정은 하지 않는다(CPO 명시) · 🔴 이번 GT 로 일반 규칙을 확정하지 않는다");

    /** 🔴🔴 안전 단언 — CF-B 에서도 CEO DIFFERENT/UNCERTAIN 이 SAME 으로 오르면 FAIL. */
    expect(s2.length, "🔴 parkette 가 SAME 으로 오르면 그 완화는 즉시 탈락이다").toBe(0);
    expect(s3.length, "🔴 bornyesterdaykids 가 SAME 으로 오르면 가격 근거가 오염된다").toBe(0);
    /** 🟢 K1 이 0 이 아니라는 것이 이 WU 의 전제다(CORE-2N 에서 관측된 손실). */
    expect(k1.length + variance.filter((v) => v.code === "B226AB040").length, "🔴 품번 손실 사례가 분모에 있어야 한다").toBeGreaterThan(0);
  }, 900000);
});
