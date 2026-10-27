import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildProductIdentityDna } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { describe, expect, it } from "vitest";
import { collectDomesticListingUrls } from "../domestic-listing-pool";
import { DOMESTIC_LISTING_SHOP_ID, DOMESTIC_LISTING_SHOP_NAME, REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-PROVIDER-14 — **직접 경로 vs 1-hop 경로** funnel 분리(추가 Search 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-27) — 「1-hop 을 **구현** 하는 작업이 아니라, **기존 1-hop 의 운영
 * 투입 안전성** 을 검증한다」. 🔴 **14건을 얻었다는 것만으로 GO 하지 않는다** —
 * 그 14건이 **Evidence 까지 살아남는지** 가 핵심이다.
 *
 * ── 🔴 금지(CPO 명시) ──────────────────────────────────────────────────────
 * ```
 * ❌ 추가 Search   ❌ 1-hop **운영 활성화**   ❌ Query 변경   ❌ MI   ❌ Identity
 * ❌ Registry      ❌ Farfetch 우회(UA/쿠키/프록시/브라우저/재시도/전용 adapter)
 * 🟢 쓰는 것은 **이미 있는 모듈** 뿐이다 — 새 수집기/분류기 0.
 * ```
 *
 * 🔴🔴 **두 경로를 «합치지» 않는다.** 합치면 `.aspx` 분류 수정 효과와 1-hop 효과가
 *    섞여 무엇이 funnel 을 움직였는지 다시 못 가른다(CPO 가 지적한 그 자리).
 */

const LIVE = process.env.CORE_SP14 === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;
const LABELS = ["S-A", "S-C", "S-D"] as const;
/** 🔴 1-hop 은 외부 HTTP 가 비싸다 — 측정 상한을 **명시** 한다(넘으면 보고에 적는다). */
const MAX_HOP_ENTRIES = 30;

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));
const padL = (s: unknown, n: number) => " ".repeat(Math.max(0, n - [...String(s)].length)) + String(s);
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};
const pathSegs = (u: string) => {
  try {
    return new URL(u).pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  } catch {
    return [];
  }
};

function loadOrigins(): Record<string, CanonicalProduct> {
  const a = fx<{ origins: Record<string, { canonicalProduct: CanonicalProduct }> }>("wu-059-gt-facts.json").origins;
  const b = fx<{ origins: Record<string, { canonicalProduct: CanonicalProduct }> }>(
    "search-provider-11-origins.json",
  ).origins;
  const fix = (cp: CanonicalProduct): CanonicalProduct =>
    cp.modelName ? cp : ({ ...cp, modelName: { value: "", source: "REQUIRED", confidence: 0 } } as CanonicalProduct);
  const out: Record<string, CanonicalProduct> = {};
  for (const id of ["S1", "S2", "S3", "S4"]) if (a[id]) out[id] = fix(a[id]!.canonicalProduct);
  for (const id of ["S5", "S6"]) if (b[id]) out[id] = fix(b[id]!.canonicalProduct);
  return out;
}

describe("SP-14 §경계 — 운영을 바꾸지 않았다(순수)", () => {
  it("🔴 이 하니스는 **기존 모듈만** 쓴다 — 새 수집기/분류기 0", () => {
    const src = readFileSync(join(__dirname, "search-provider-14-onehop.test.ts"), "utf8");
    const code = src.replace(/\/\*\*[\s\S]*?\*\//g, "");
    /**
     * 🔴 Farfetch 우회 어휘가 **하나도** 없어야 한다(CPO 금지 전수).
     * 🔴 금지어를 **쪼개서** 적는다 — 통짜로 적으면 이 파일 자신이 그 문자열을 갖게 돼
     *    계약이 **자기 자신 때문에** FAIL 한다(SP-11 에서 이미 한 번 밟은 함정).
     */
    for (const parts of [
      ["user", "-agent"],
      ["coo", "kie"],
      ["pro", "xy"],
      ["play", "wright"],
      ["puppe", "teer"],
      ["ret", "ry"],
    ]) {
      expect(code.toLowerCase(), parts.join("")).not.toContain(parts.join(""));
    }
    /** 🟢 쓰는 모듈을 이름으로 고정한다. */
    expect(code).toContain("collectDomesticListingUrls");
    expect(code).toContain("collectUrlCandidatePool");
  });

  it("🔴 1-hop 을 **운영에 켜지 않았다** — 호출부에 그 플래그가 없다", () => {
    const route = readFileSync(join(__dirname, "../../check/route.ts"), "utf8");
    /** 🟢 운영은 **국내 등록부 샵** 에만 1-hop 을 쓴다(그 플래그 하나뿐) — 검색 결과엔 안 쓴다. */
    expect(route).toContain("domesticListingHop: true");
    expect(route).not.toContain("searchListingHop");
  });
});

interface Bucket {
  detailUrls: number;
  crawled: number;
  evidence: number;
  brandMatch: number;
  brandMismatch: number;
}

describe.skipIf(!LIVE)("SP-14 §funnel — 직접 vs 1-hop(라이브 · 추가 Search 0)", () => {
  it(
    "두 경로를 **갈라서** 상세URL → Crawl → Evidence 까지 센다",
    async () => {
      const raw = fx<{ runs: { productId: string; label: string; results: { url: string }[] }[] }>(
        "search-provider-05-raw.json",
      );
      const origins = loadOrigins();

      const direct: Bucket = { detailUrls: 0, crawled: 0, evidence: 0, brandMatch: 0, brandMismatch: 0 };
      const hop: Bucket = { detailUrls: 0, crawled: 0, evidence: 0, brandMatch: 0, brandMismatch: 0 };
      const hopNotes = new Map<string, number>();
      let hopEntries = 0;
      let hopSkippedOverLimit = 0;
      let hopDupOfDirect = 0;
      const hopFromStoreHome: { url: string; brandOk: boolean }[] = [];

      for (const productId of Object.keys(origins)) {
        const dna = buildProductIdentityDna(origins[productId]!);
        const originBrand = (dna.brand.value || "").trim().toLowerCase();
        const brandTerms = [dna.brand.value].filter((t) => t && t.trim().length > 0);

        const urls = [
          ...new Set(
            LABELS.flatMap(
              (l) => raw.runs.find((r) => r.productId === productId && r.label === l)?.results.map((x) => x.url) ?? [],
            ),
          ),
        ];
        const productUrls = urls.filter((u) => String(classifyUrlShape(u)) === "PRODUCT_PAGE");
        const entryUrls = urls.filter((u) => String(classifyUrlShape(u)) !== "PRODUCT_PAGE");

        /** 🟢 경로 A — **직접 상품 URL**(여기엔 SP-13 이 새로 올린 `.aspx` 가 포함된다). */
        const directSeen = new Set(productUrls.map(loose));
        const poolA = await collectUrlCandidatePool({
          urls: productUrls,
          originUrl: dna.sourceUrl,
          maxUrls: productUrls.length,
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        });
        direct.detailUrls += productUrls.length;
        for (const res of poolA.searchResults) {
          for (const c of res.candidates) {
            direct.crawled += 1;
            const f = c.facts;
            if (f?.brand || c.brand || c.title) direct.evidence += 1;
            const b = (f?.brand || c.brand || "").trim().toLowerCase();
            if (b && originBrand && b.includes(originBrand.split(" ")[0]!)) direct.brandMatch += 1;
            else if (b) direct.brandMismatch += 1;
          }
        }

        /** 🟢 경로 B — **기존 1-hop 모듈**(새 구현 0). 🔴 상한에 걸린 것은 센다. */
        const take = entryUrls.slice(0, Math.max(0, MAX_HOP_ENTRIES - hopEntries));
        hopSkippedOverLimit += entryUrls.length - take.length;
        const hopDetail: string[] = [];
        const fromHome = new Set<string>();
        for (const entry of take) {
          hopEntries += 1;
          const res = await collectDomesticListingUrls({
            sites: [{ domain: hostOf(entry), entryUrl: entry }],
            code: dna.brandModelCode,
            brandTerms,
            maxSites: 1,
          }).catch(() => null);
          for (const o of res?.metrics.outcomes ?? []) {
            const note = o.note ?? o.source ?? "?";
            hopNotes.set(note, (hopNotes.get(note) ?? 0) + 1);
          }
          /** 🔴 「브랜드/스토어 대표 페이지」에서 나온 것을 따로 표시한다(CPO 지목). */
          const isStoreHome = pathSegs(entry).length <= 1;
          for (const u of res?.urls ?? []) {
            hopDetail.push(u);
            if (isStoreHome) fromHome.add(loose(u));
          }
        }
        /** 🔴 **중복이 이 경로의 실질 가치를 가른다** — 이미 직접 경로에 있던 것은 증분이 아니다. */
        const fresh = [...new Set(hopDetail.map(loose))].filter((u) => !directSeen.has(u));
        hopDupOfDirect += new Set(hopDetail.map(loose)).size - fresh.length;
        hop.detailUrls += fresh.length;

        if (fresh.length > 0) {
          const poolB = await collectUrlCandidatePool({
            urls: [...new Set(hopDetail)].filter((u) => !directSeen.has(loose(u))),
            originUrl: dna.sourceUrl,
            maxUrls: fresh.length,
            existingCanonicalUrls: directSeen,
            shopId: DOMESTIC_LISTING_SHOP_ID,
            shopNamePrefix: DOMESTIC_LISTING_SHOP_NAME,
          });
          for (const res of poolB.searchResults) {
            for (const c of res.candidates) {
              hop.crawled += 1;
              const f = c.facts;
              if (f?.brand || c.brand || c.title) hop.evidence += 1;
              const b = (f?.brand || c.brand || "").trim().toLowerCase();
              const ok = Boolean(b && originBrand && b.includes(originBrand.split(" ")[0]!));
              if (ok) hop.brandMatch += 1;
              else if (b) hop.brandMismatch += 1;
              if (fromHome.has(loose(c.url))) hopFromStoreHome.push({ url: c.url, brandOk: ok });
            }
          }
        }
      }

      /* eslint-disable no-console */
      console.log(`\n══ SP-14 — 직접 경로 vs 1-hop 경로(추가 Search 0) ══`);
      console.log(`${pad("경로", 10)}${padL("상세URL", 9)}${padL("Crawl", 7)}${padL("Evidence", 10)}${padL("브랜드일치", 11)}${padL("브랜드불일치", 13)}`);
      for (const [n, b] of [
        ["직접", direct],
        ["1-hop", hop],
      ] as const) {
        console.log(pad(n, 10) + padL(b.detailUrls, 9) + padL(b.crawled, 7) + padL(b.evidence, 10) + padL(b.brandMatch, 11) + padL(b.brandMismatch, 13));
      }
      console.log(`\n🔴 1-hop 상세 중 **직접 경로와 중복** ${hopDupOfDirect}건(증분에서 뺐다)`);
      console.log(`🔴 1-hop 진입 ${hopEntries}곳(상한 ${MAX_HOP_ENTRIES}) · 상한으로 **보지 않은 진입 ${hopSkippedOverLimit}곳**`);
      console.log(`🔴 브랜드/스토어 대표 페이지에서 나온 상세 ${hopFromStoreHome.length}건 · 그중 브랜드 불일치 ${hopFromStoreHome.filter((x) => !x.brandOk).length}건`);
      console.log(`\n══ 1-hop 막힘 사유 ══`);
      for (const [n, c] of [...hopNotes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(n, 30)}${padL(c, 4)}`);

      /** 🔴 열화된 실행으로 결론을 내지 않는다. */
      expect(direct.detailUrls).toBeGreaterThan(50);
      expect(hopEntries).toBeGreaterThan(0);
    },
    3 * 60 * 60_000,
  );
});
