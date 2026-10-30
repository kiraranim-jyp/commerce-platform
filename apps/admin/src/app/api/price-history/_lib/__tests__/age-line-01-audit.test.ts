import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ComparisonCandidate, ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-AGE-LINE-AUDIT-01 — **AB/AC 가 «왜» CONFLICT 인가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 전략: 「**baby 와 kids 는 처음부터 같은 후보군에서 본다.** 연령/라인 표현의
 *           차이는 후보를 버리는 이유가 아니라 Evidence 중 하나다.」
 *
 * 🔴🔴 이 파일은 **아무것도 바꾸지 않는다.** 묻는 것은 하나다 —
 *    「model code 차이가 **상품 자체의 차이** 인가 **라인/SKU 차이** 인가,
 *      그리고 Identity 가 그걸 가를 Evidence 를 손에 들고 있는가?」
 * 🔴 `AB ↔ AC → SAME` 강제 **0** · `→ DIFFERENT` 강제 **0** · threshold **0** ·
 *    blocker 삭제 **0** · Query/Search/Registry/MI **0** · **새 Search 0**.
 * 🔴 게이트 `AGE_LINE_PROBE=1` 없으면 SKIP.
 */
const LIVE = process.env.AGE_LINE_PROBE === "1";
const FIX = path.join(__dirname, "fixtures");
const OUTDIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const fx = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const productKey = (u: string): string => {
  try {
    const x = new URL(u);
    const segs = x.pathname.toLowerCase().replace(/\/+$/, "").split("/").filter(Boolean);
    return `${x.hostname.toLowerCase().replace(/^www\./, "")}/${segs[segs.length - 1] ?? ""}`;
  } catch {
    return loose(u);
  }
};

/** 🔴 원상품 URL 은 저장 데이터에서 읽은 값이다(지어내지 않았다). */
const ORIGINS = [
  { code: "B226AC009", url: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt" },
  { code: "B226AC010", url: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt" },
];

/**
 * 🔴 「baby 라인인가」를 **URL 문자열로만** 거친다 — 이것은 **감사 대상 선별** 이고
 *    판정이 아니다. 🔴 운영에 이 규칙을 넣지 않는다.
 */
const looksBabyLine = (u: string) => /(^|[/-])(baby|b226ab)/.test(u.toLowerCase());

function loadGt(): { origin: string; url: string; human: string }[] {
  const m = new Map<string, { origin: string; url: string; human: string }>();
  const add = (o?: string, u?: string, v?: string) => {
    if (!o || !u || !v) return;
    const k = loose(u);
    if (!m.has(k)) m.set(k, { origin: o, url: u, human: v.toUpperCase() });
  };
  type C = Record<string, string | undefined>;
  const files: [string, string, string, string][] = [
    ["wu-112-human-gt.json", "originCode", "url", "verdict"],
    ["wu-111-human-gt.json", "originCode", "url", "humanVerdict"],
    ["wu-125-human-gt.json", "origin", "url", "human"],
    ["wu-116-human-gt.json", "originCode", "url", "humanVerdict"],
  ];
  for (const [f, o, u, v] of files)
    for (const c of fx<{ candidates?: C[] }>(f).candidates ?? []) add(c[o], c[u], c[v]);
  for (const f of ["core-same03-human-gt.json", "core-2aj-human-gt.json", "core-2al-human-gt.json"])
    for (const c of fx<{ candidates?: C[]; rows?: C[] }>(f).candidates ?? fx<{ rows?: C[] }>(f).rows ?? [])
      add(c.originCode ?? c.origin, c.url, c.humanVerdict ?? c.human ?? c.verdict);
  return [...m.values()];
}

describe("AGE-LINE-01 — AB/AC Evidence 전수 감사 (새 Search 0)", () => {
  it.runIf(LIVE)(
    "model code 차이가 «상품 차이» 인지 «라인 차이» 인지 Evidence 로 가른다",
    async () => {
      const gt = loadGt();
      const out: Record<string, unknown>[] = [];
      /* eslint-disable no-console */

      for (const origin of ORIGINS) {
        const mine = gt.filter((g) => g.origin === origin.code);
        if (mine.length === 0) continue;
        const r = await shopifySiteStrategy.extract(origin.url);
        expect(r, `원상품 추출 실패: ${origin.url}`).toBeTruthy();
        const dna = buildProductIdentityDna(
          buildCanonicalProduct(
            origin.url,
            r!.productData as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
        const of_ = productFactsFromIdentityDna(dna);
        const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          searchTerm: terms[0] ?? dna.title,
          searchTerms: terms,
          facts: of_,
        };
        console.log(
          `\n━━━━ 원상품 ${origin.code} ━━━━\n` +
            `  brand=${of_.brand} code=${of_.brandModelCode} color=${of_.colorText}\n` +
            `  form=${of_.categoryText} material=${of_.materialText} fit=${of_.fitText}\n` +
            `  age=${of_.ageRangeText} audience=[${of_.audienceSignals.join(",")}] images=${of_.imageUrls.length}\n` +
            `  tokens=[${of_.coreTitleTokens.join(" ")}]`,
        );

        const pool = await collectUrlCandidatePool({
          urls: mine.map((g) => g.url),
          originUrl: dna.sourceUrl,
          maxUrls: mine.length,
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        });
        const byProduct = new Map(gt.map((g) => [productKey(g.url), g]));

        for (const res of pool.searchResults) {
          if (res.status !== "ok" || res.candidates.length === 0) continue;
          const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          if (notSelf.length === 0) continue;
          let priced: ComparisonCandidate[] = withConfidence(query, notSelf);
          try {
            priced = await enrichCandidatePrices(priced, res.domain, query);
          } catch {
            /* 운영과 같다 */
          }
          for (const c of priced) {
            const g = byProduct.get(productKey(c.url));
            const f = c.facts;
            out.push({
              origin: origin.code,
              host: res.domain,
              url: c.url,
              human: g?.human ?? "(라벨없음)",
              babyLine: looksBabyLine(c.url),
              code: f?.brandModelCode ?? null,
              brand: f?.brand ?? null,
              title: c.title,
              form: f?.categoryText ?? null,
              color: f?.colorText ?? null,
              material: f?.materialText ?? null,
              fit: f?.fitText ?? null,
              age: f?.ageRangeText ?? null,
              audience: f?.audienceSignals ?? [],
              images: f?.imageUrls?.length ?? 0,
              tokens: f?.coreTitleTokens ?? [],
              verdict: c.crossSellerVerdict ?? null,
              matchLevel: c.matchLevel ?? null,
              reasons: c.crossSellerReasons ?? [],
              blockers: (c.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
              conflicts: (c.crossSellerConflicts ?? []).map((x) => (typeof x === "string" ? x : x.conflict)),
              price: c.price?.amount ?? null,
              currency: c.price?.currency ?? null,
              priceStatus: c.priceStatus ?? null,
            });
          }
        }
      }

      /* ── A. baby 라인 전수 표 ── */
      const baby = out.filter((r) => r.babyLine);
      console.log(`\n【A. baby 라인 후보 ${baby.length}건 — 전수】`);
      for (const r of baby) {
        console.log(
          `\n  ${String(r.host)}  human=${String(r.human)}  현재=${String(r.verdict)}/${String(r.matchLevel)}`,
        );
        console.log(`    code=${String(r.code)}  form=${String(r.form)}  color=${String(r.color)}`);
        console.log(
          `    material=${String(r.material)}  fit=${String(r.fit)}  age=${String(r.age)}  images=${String(r.images)}`,
        );
        console.log(`    title=${String(r.title).slice(0, 86)}`);
        console.log(`    tokens=[${(r.tokens as string[]).join(" ")}]`);
        console.log(`    conflicts=[${(r.conflicts as string[]).join(",")}] blockers=[${(r.blockers as string[]).join(",")}]`);
        console.log(`    reasons=${JSON.stringify(r.reasons).slice(0, 300)}`);
      }

      /* ── B. 🔴 가격 누출 영향 «사전» 측정(구현 전에 분모를 본다) ── */
      const strong = out.filter((r) => r.verdict === "SAME" || r.verdict === "PRESUMED_SAME");
      const pricedStrong = strong.filter((r) => r.price != null);
      const blockerPresumed = pricedStrong.filter(
        (r) => r.verdict === "PRESUMED_SAME" && (r.blockers as string[]).length > 0,
      );
      console.log(
        `\n【B. 가격 집계 영향 — 구현 «전» 측정】\n` +
          `  SAME/PRESUMED ${strong.length} · 금액 보유 ${pricedStrong.length}\n` +
          `  그중 PRESUMED + blocker 있음 = **${blockerPresumed.length}**  ← 제외 대상`,
      );
      for (const r of blockerPresumed)
        console.log(
          `    ${String(r.host).padEnd(24)} ${String(r.price)}${String(r.currency)} human=${String(r.human)} blk=[${(r.blockers as string[]).join(",")}]`,
        );
      const keptKrw = pricedStrong.filter(
        (r) => r.currency === "KRW" && !(r.verdict === "PRESUMED_SAME" && (r.blockers as string[]).length > 0),
      );
      console.log(`  🔴 제외 후 남는 KRW 후보 ${keptKrw.length}건 — ${keptKrw.map((r) => `${r.host}:${r.price}`).join(" · ")}`);

      mkdirSync(OUTDIR, { recursive: true });
      writeFileSync(path.join(OUTDIR, "age-line-01-audit.json"), JSON.stringify(out, null, 2));
      console.log(`\n산출 → ${path.join(OUTDIR, "age-line-01-audit.json")}  (행 ${out.length})`);
      expect(out.length).toBeGreaterThan(0);
    },
    1_200_000,
  );
});
