import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-DISCOVERY-QUERY-014 STEP 1 — 현재 Query Generator 해부
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini API 호출 0.** 기존 DB 덤프와 순수 함수만 쓴다(§9).
 *
 * 🔴 조사 대상: `generateQueries(identity)`(discovery-core/query-generator.ts)가
 *    실제로 무엇을 만드는가, 그리고 **`queries[0]`(= 우리 Primary Query)이 무엇인가.**
 *
 * 🔴 이 하니스는 「좋아 보이는 것」을 적지 않는다 — 실제 상품으로 **덤프** 한다.
 */
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown; description: string | null }

/** 🔴 CPO STEP 1 의 분류 축 그대로. 추측하지 않고 토큰으로 가른다. */
type TokenClass =
  | "IDENTIFIER" | "PRODUCT_NAME" | "DESIGN" | "COLOR" | "MATERIAL"
  | "CATEGORY" | "MARKETING" | "SIZE" | "PRICE" | "GEO" | "OTHER";

const COLOR = /^(black|white|navy|blue|red|pink|green|grey|gray|beige|cream|ecru|ivory|brown|yellow|purple|orange|silver|gold|khaki|mustard|burgundy|camel|rose|lilac|lavender|charcoal|melange|heather|nero|bleu|jean)$/i;
const MATERIAL = /^(cotton|organic|wool|linen|silk|denim|velvet|cashmere|polyester|nylon|leather|fleece|jersey|ribbed|recycled|fiber|piq(ue)?)$/i;
const CATEGORY = /^(t-?shirt|shirt|tee|sweatshirt|sweat|jacket|coat|pants|trouser|trousers|short|shorts|dress|skirt|cardigan|jumper|hoodie|polo|top|tunique|tunic|shoes|sneakers|boots|sandals|hat|cap|socks|leggings|jogger|joggers|tracksuit|bermuda)$/i;
const MARKETING = /^(new|sale|discount|off|best|hot|limited|exclusive|last|ones|in|stock|season|ss|fw|aw|collection|official|shop|buy|free|shipping)$/i;
const SIZE = /^(xs|s|m|l|xl|xxl|\d{1,3}(y|m|cm|mm)?|\d{1,2}-\d{1,2}|one|size)$/i;
const PRICE = /^(krw|usd|eur|gbp|won|\$|€|£|price|\d+원)$/i;
const GEO = /^(korea|korean|kr|한국|직구|배송|무료배송|japan|us|uk|eu|global|intl|international)$/i;
const IDENTIFIER = /^(?=.*\d)[a-z0-9][a-z0-9-]{3,}$/i;

function classify(token: string): TokenClass {
  const t = token.trim();
  if (!t) return "OTHER";
  if (GEO.test(t)) return "GEO";
  if (PRICE.test(t)) return "PRICE";
  if (SIZE.test(t)) return "SIZE";
  if (MARKETING.test(t)) return "MARKETING";
  if (COLOR.test(t)) return "COLOR";
  if (MATERIAL.test(t)) return "MATERIAL";
  if (CATEGORY.test(t)) return "CATEGORY";
  if (IDENTIFIER.test(t)) return "IDENTIFIER";
  return "PRODUCT_NAME";
}

const tally = (xs: string[]): Record<string, number> => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return t;
};

describe("MI-014 STEP 1 — 현재 Query Generator 실측 해부 (Gemini 호출 0)", () => {
  it("실제 상품 15건의 generateQueries 를 덤프하고 Primary Query 를 확인한다", async () => {
    const read = <T>(f: string): T => {
      const p = path.join(OUT_DIR, f);
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p} — scripts/mi-gemini-005-dump.mjs 먼저`);
      return JSON.parse(readFileSync(p, "utf8")) as T;
    };
    const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
    const snaps = read<SnapRow[]>("e2e-snapshots.json");

    const { generateQueries } = (await import("@commerce/crawler/src/discovery-core")) as unknown as {
      generateQueries: (i: unknown) => { id: string; axis: string; text: string; usedFields: string[] }[];
    };
    const shared = (await import("@commerce/shared")) as unknown as {
      buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
      backfillCanonicalProduct: (p: unknown) => unknown;
    };

    /** 🟢 운영 pool 과 **같은 식** 으로 identity 를 만든다(gemini-candidate-pool.ts 복사). */
    const identityFromDna = (dna: Record<string, unknown>) => {
      let host: string | null = null;
      try { host = new URL(String(dna.sourceUrl)).hostname.replace(/^www\./i, ""); } catch { host = null; }
      const brand = dna.brand as { value?: string } | undefined;
      const category = dna.category as { value?: string } | undefined;
      return {
        brand: brand?.value || null,
        productName: String(dna.title ?? "").split("|")[0]?.trim() || String(dna.title ?? ""),
        productType: category?.value?.split(">").pop()?.trim() ?? null,
        genderAge: (dna.ageRange as string | null) ?? null,
        color: (dna.color as string | null) ?? null,
        size: null, season: null,
        productCode: (dna.brandModelCode as string | null) ?? null,
        sourceUrl: String(dna.sourceUrl ?? ""),
        sourceSite: host, sourceCountry: null, market: null,
      };
    };

    const kids = [...(groups.control ?? []), ...groups.kids, ...groups.kids2];
    const seen = new Set<string>();
    const pick = [
      ...kids.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 10),
      ...groups.tennis.slice(0, 5),
    ];

    const rows: Record<string, unknown>[] = [];
    const primaryIds: string[] = [];
    const primaryClasses: string[] = [];
    let withCode = 0;
    let codeReachedAsPrimary = 0;

    for (const row of pick) {
      const snap = snaps.find((x) => x.id === row.id);
      if (!snap) continue;
      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
      const identity = identityFromDna(dna);
      const qs = generateQueries(identity as never);
      const primary = qs[0] ?? null;
      const tokens = (primary?.text ?? "").split(/\s+/).filter(Boolean);
      const classes = tokens.map(classify);

      if (identity.productCode) {
        withCode += 1;
        if (primary && (primary.id === "Q5" || primary.id === "Q6")) codeReachedAsPrimary += 1;
      }
      if (primary) { primaryIds.push(primary.id); primaryClasses.push(...classes); }

      rows.push({
        brand: identity.brand,
        title: row.title.slice(0, 46),
        "🔴 productCode": identity.productCode,
        color: identity.color,
        "생성된 query 수": qs.length,
        "🔴🔴 Primary(queries[0])": primary ? { id: primary.id, axis: primary.axis, text: primary.text } : null,
        "Primary 토큰 수": tokens.length,
        "Primary 토큰 분류": tally(classes),
        "🔴 품번 query 가 몇 번째인가": (() => {
          const i = qs.findIndex((q) => q.id === "Q6" || q.id === "Q5");
          return i < 0 ? "생성되지 않음" : i + 1;
        })(),
        "전체 query": qs.map((q) => `${q.id}:${q.text}`),
      });
    }

    const report = {
      "🔴🔴 DISCLAIMER": `Gemini API 호출 **0**. 기존 덤프 + 순수 함수만 썼다. sample 상품 N=${rows.length}.`,
      "① 현재 생성 규칙 (SPECS 순서 그대로)": [
        "Q1 상품명", "Q2 브랜드+상품명", "Q3 상품명+색상", "Q4 브랜드+상품명+색상",
        "Q5 상품코드", "Q6 브랜드+상품코드", "Q7 상품명+buy", "Q8 브랜드+상품명+buy",
      ],
      "②🔴🔴 핵심 결함": {
        "Primary(queries[0]) 분포": tally(primaryIds),
        "품번을 가진 상품": withCode,
        "그중 품번 query 가 Primary 가 된 상품": codeReachedAsPrimary,
        "🔴 설명":
          "`generateQueries` 는 SPECS 순서로 돌려주고 우리 pool 은 slice(0, maxQueries) 를 쓴다. " +
          "품번 query(Q5/Q6)는 5~6번째라 maxQueries=1 에서 **절대 선택되지 않는다** — " +
          "품번이 있어도 Primary 는 `productName` 단독(Q1)이다.",
      },
      "③ Primary Query 토큰 구성 (전 상품 합계)": tally(primaryClasses),
      products: rows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "q014-audit.json"), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify({ ...report, products: `(${rows.length}건 — q014-audit.json)` }, null, 1));

    expect(rows.length).toBeGreaterThan(0);
    /** 🔴 결함을 «숫자로» 고정한다 — 품번이 있는 상품이 하나라도 있으면
     *     그중 Primary 가 품번 query 인 것은 **0** 이어야 한다(= 현재 결함). */
    if (withCode > 0) expect(codeReachedAsPrimary).toBe(0);
  });
});
