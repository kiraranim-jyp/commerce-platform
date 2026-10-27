import { readFileSync } from "node:fs";
import { join } from "node:path";
import { factsFromProductUrl } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildProductIdentityDna } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { describe, expect, it } from "vitest";
import { collectDomesticListingUrls } from "../domestic-listing-pool";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-PROVIDER-12 — **「상품상세가 아닌 URL」 전수 분해**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-27) — SP-11 이 찾은 **입구 손실 44%(66건)** 가 무엇인지 먼저 본다.
 * 🔴 **구현하지 않는다** — 분류하고 세고 샘플을 적는 것까지다.
 *
 * ── 🔴 금지(CPO 명시) ──────────────────────────────────────────────────────
 * ```
 * ❌ 추가 Search   ❌ Query 변경   ❌ 1-hop **구현**   ❌ MI 연결
 * ❌ Identity 변경 ❌ Registry 확장 ❌ 재시도/fallback
 * 🟢 입력은 **이미 확보한 151 URL** 뿐이다.
 * ```
 *
 * ── 🔴🔴 분류기를 «새로 만들지» 않는다 ─────────────────────────────────────
 * ```
 * 1차 분류는 **운영 `classifyUrlShape`** 가 한다(그 결과를 바꾸지 않는다).
 * 그 아래 세부 유형은 **보고용 관측 라벨** 이고 운영 규칙이 아니다 —
 * 그래서 이 파일 안에만 있고 운영 코드가 import 하지 않는다(계약으로 잠근다).
 * ```
 * 🔴 게이트 `CORE_SP12=1` 없으면 라이브 블록은 SKIP.
 */

const LIVE = process.env.CORE_SP12 === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;
const LABELS = ["S-A", "S-C", "S-D"] as const;

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));
const padL = (s: unknown, n: number) => " ".repeat(Math.max(0, n - [...String(s)].length)) + String(s);
const loose = (u: string) =>
  String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};
const pathOf = (u: string) => {
  try {
    return new URL(u).pathname.toLowerCase();
  } catch {
    return "";
  }
};

/**
 * 🔴 **보고용 관측 라벨** — CPO §12 의 일곱 갈래를 URL 문자열로만 가른다.
 * 🔴 운영 판정이 아니다. 🔴 이 목록을 운영 코드로 옮기지 않는다(계약이 막는다).
 */
export type ObservedKind =
  | "SOCIAL_NOISE"
  | "MARKETPLACE"
  | "EDITORIAL"
  | "SEARCH_PAGE"
  | "LISTING_CATEGORY"
  | "BRAND_STORE_HOME"
  | "OTHER";

const SOCIAL = /(^|\.)(pinterest|facebook|twitter|x|instagram|youtube|tiktok|reddit|threads)\./i;
const MARKET = /(^|\.)(ebay|etsy|walmart|amazon|aliexpress|poshmark|depop|vinted|mercari|goat|stockx|grailed|coupang|gmarket|11st|auction|danawa|enuri)\./i;
const EDITORIAL = /(^|\.)(vogue|elle|harpersbazaar|magazine|blog|tistory|brunch|medium|news)\./i;
const SEARCHY = /(\/search|\/find|[?&]q=|[?&]query=|[?&]keyword=|\/shop\/search)/i;
const LISTING = /(\/collections?\/|\/category\/|\/categories\/|\/c\/|\/brands?\/|\/shop\/|goods_list|product_list|shopbrand)/i;

export function observedKind(url: string): ObservedKind {
  const h = `${hostOf(url)}.`;
  if (SOCIAL.test(h)) return "SOCIAL_NOISE";
  if (MARKET.test(h)) return "MARKETPLACE";
  if (EDITORIAL.test(h)) return "EDITORIAL";
  const full = `${pathOf(url)}${(() => {
    try {
      return new URL(url).search;
    } catch {
      return "";
    }
  })()}`;
  if (SEARCHY.test(full)) return "SEARCH_PAGE";
  if (LISTING.test(pathOf(url))) return "LISTING_CATEGORY";
  if (pathOf(url).replace(/\/+$/, "").split("/").filter(Boolean).length <= 1) return "BRAND_STORE_HOME";
  return "OTHER";
}

describe("SEARCH-PROVIDER-12 §경계 — 관측 라벨이 운영으로 새지 않는다(순수)", () => {
  it("🔴 이 분류는 **보고용** 이다 — 운영 코드가 import 하지 않는다", () => {
    const lib = join(__dirname, "..");
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === "__tests__" || name === "node_modules") continue;
          walk(full, out);
        } else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
      }
      return out;
    };
    for (const f of walk(lib)) {
      expect(readFileSync(f, "utf8"), f).not.toContain("observedKind");
    }
  });

  it("🟢 1차 분류 owner 는 **운영 `classifyUrlShape`** 다 — 결과를 바꾸지 않는다", () => {
    expect(String(classifyUrlShape("https://shop.example/products/abc"))).toBe("PRODUCT_PAGE");
    expect(String(classifyUrlShape("https://shop.example/collections/all"))).toBe("LISTING_PAGE");
  });
});

interface RawFile {
  runs: { productId: string; label: string; results: { url: string }[] }[];
}

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

describe.skipIf(!LIVE)("SEARCH-PROVIDER-12 §분해 — 비상품 URL 과 미기록 Crawl(라이브 · 추가 검색 0)", () => {
  it(
    "유형별 개수 · 샘플 · 현재 crawler 결과를 적는다",
    async () => {
      const raw = fx<RawFile>("search-provider-05-raw.json");
      const origins = loadOrigins();

      /** 🟢 SP-11 과 **같은 입력 집합** 이다(상품 6 × 질의 3 · loose 로 중복 제거). */
      const all = new Map<string, { url: string; productId: string }>();
      for (const productId of Object.keys(origins)) {
        for (const label of LABELS) {
          const run = raw.runs.find((r) => r.productId === productId && r.label === label);
          if (!run) continue;
          for (const r of run.results) all.set(`${productId} ${loose(r.url)}`, { url: r.url, productId });
        }
      }
      const rows = [...all.values()];
      const nonProduct = rows.filter((r) => String(classifyUrlShape(r.url)) !== "PRODUCT_PAGE");
      console.log(
        `\n══ SP-12 — URL ${rows.length}건 중 **상품상세 아님 ${nonProduct.length}건** (추가 검색 0) ══`,
      );

      /* ── ① 유형별 개수 ── */
      const byKind = new Map<ObservedKind, { url: string; productId: string }[]>();
      for (const r of nonProduct) {
        const k = observedKind(r.url);
        byKind.set(k, [...(byKind.get(k) ?? []), r]);
      }
      console.log(`\n${pad("유형", 20)}${padL("건수", 5)}  샘플`);
      for (const [k, v] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`${pad(k, 20)}${padL(v.length, 5)}  ${v[0]!.url.slice(0, 92)}`);
      }

      /* ── ② 🔴 그중 «실제로는 상품» 인 것이 있는가 — 운영 추출기로 확인 ── */
      console.log(`\n══ ② 비상품으로 분류됐지만 **운영 추출기가 상품 사실을 읽는가** ══`);
      const missed: { url: string; kind: ObservedKind; title: string }[] = [];
      const probed = new Map<string, string>();
      for (const r of nonProduct) {
        try {
          const f = await factsFromProductUrl(r.url);
          probed.set(r.url, f.status);
          if (f.status === "OK" && f.candidate) {
            missed.push({ url: r.url, kind: observedKind(r.url), title: f.candidate.title ?? "" });
          }
        } catch {
          probed.set(r.url, "THROW");
        }
      }
      const statusCount = new Map<string, number>();
      for (const s of probed.values()) statusCount.set(s, (statusCount.get(s) ?? 0) + 1);
      for (const [s, n] of [...statusCount.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${pad(s, 22)}${padL(n, 5)}`);
      }
      console.log(`  🔴 **분류기가 놓친 실제 상품: ${missed.length}건**`);
      for (const m of missed.slice(0, 8)) console.log(`     ${pad(m.kind, 18)} ${m.url.slice(0, 80)}`);

      /* ── ②-b 🔴🔴 위 ②는 «순환» 이다 — 같은 게이트를 두 번 쟀다 ── */
      /**
       * `factsFromProductUrl` 은 **안에서 `classifyUrlShape` 로 먼저 막는다**(`NOT_PRODUCT_URL`).
       * 그래서 「분류기가 놓친 상품」을 그 함수로 물으면 **언제나 0** 이 나온다 —
       * WU-120 이 기록한 그 함정(「모양 게이트를 두 번 쟀다」)의 재발이다.
       * 🟢 그래서 **raw fetch** 로 다시 묻는다 — 페이지가 스스로 「나는 상품이다」라고
       *    적어 두었는가(JSON-LD `@type: Product` · `og:type=product`).
       * 🔴 새 분류 규칙을 만드는 것이 **아니다** — 사이트가 적은 것을 **읽기만** 한다.
       */
      console.log(`\n══ ②-b 🔴 같은 질문을 **raw fetch** 로 다시 — 페이지가 스스로 상품이라 하는가 ══`);
      let selfDeclared = 0;
      let fetched = 0;
      const declaredByKind = new Map<ObservedKind, number>();
      const samples: string[] = [];
      for (const r of nonProduct) {
        let html = "";
        try {
          const res = await fetch(r.url, {
            headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) continue;
          html = (await res.text()).slice(0, 400_000);
          fetched += 1;
        } catch {
          continue;
        }
        const isProduct =
          /"@type"\s*:\s*"Product"/i.test(html) ||
          /property=["']og:type["'][^>]*content=["']product["']/i.test(html);
        if (!isProduct) continue;
        selfDeclared += 1;
        const k = observedKind(r.url);
        declaredByKind.set(k, (declaredByKind.get(k) ?? 0) + 1);
        if (samples.length < 8) samples.push(`${pad(k, 18)} ${r.url.slice(0, 84)}`);
      }
      console.log(
        `  raw fetch 성공 ${fetched}/${nonProduct.length} · **페이지가 스스로 상품이라 한 것 ${selfDeclared}건**`,
      );
      for (const [k, c] of [...declaredByKind.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${pad(k, 20)}${padL(c, 4)}`);
      }
      for (const s of samples) console.log(`     ${s}`);

      /* ── ③ 목록에서 **현재 운영 1-hop 모듈** 로 상세를 얻을 수 있는가 ── */
      console.log(`\n══ ③ 현재 운영 1-hop 모듈(\`collectDomesticListingUrls\`)로 상세를 얻는가 ══`);
      const listingish = nonProduct.filter((r) =>
        ["LISTING_CATEGORY", "BRAND_STORE_HOME", "SEARCH_PAGE"].includes(observedKind(r.url)),
      );
      let hopSites = 0;
      let hopDetail = 0;
      const hopNotes = new Map<string, number>();
      for (const r of listingish.slice(0, 30)) {
        const dna = buildProductIdentityDna(origins[r.productId]!);
        const brandTerms = [dna.brand.value].filter((t) => t && t.trim().length > 0);
        const res = await collectDomesticListingUrls({
          sites: [{ domain: hostOf(r.url), entryUrl: r.url }],
          code: dna.brandModelCode,
          brandTerms,
          maxSites: 1,
        }).catch(() => null);
        hopSites += 1;
        hopDetail += res?.urls.length ?? 0;
        for (const o of res?.metrics.outcomes ?? []) {
          const note = o.note ?? o.source ?? "?";
          hopNotes.set(note, (hopNotes.get(note) ?? 0) + 1);
        }
      }
      console.log(`  시도 ${hopSites}곳(상한 30) · **상세 URL 획득 ${hopDetail}건**`);
      for (const [n, c] of [...hopNotes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(n, 26)}${padL(c, 4)}`);

      /* ── ④ 🔴 SP-11 의 「Crawl 실패(사유 미기록)」를 URL 하나씩 분해한다 ── */
      console.log(`\n══ ④ 상품상세인데 후보가 되지 못한 URL — **사유 분해**(pool 을 URL 하나씩) ══`);
      const productPages = rows.filter((r) => String(classifyUrlShape(r.url)) === "PRODUCT_PAGE");
      const reason = new Map<string, number>();
      let became = 0;
      for (const r of productPages) {
        const dna = buildProductIdentityDna(origins[r.productId]!);
        const pool = await collectUrlCandidatePool({
          urls: [r.url],
          originUrl: dna.sourceUrl,
          maxUrls: 1,
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        });
        const got = pool.searchResults.some((s) => s.candidates.length > 0);
        if (got) {
          became += 1;
          continue;
        }
        const why = pool.metrics.dropped[0]?.reason ?? "🔴 사유 없음(pool 이 적지 않았다)";
        reason.set(why, (reason.get(why) ?? 0) + 1);
      }
      console.log(`  상품상세 ${productPages.length}건 중 후보 성립 **${became}** · 탈락 ${productPages.length - became}`);
      for (const [w, c] of [...reason.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(w, 34)}${padL(c, 4)}`);

      expect(rows.length).toBeGreaterThan(100);
      expect(nonProduct.length).toBeGreaterThan(0);
    },
    3 * 60 * 60_000,
  );
});
