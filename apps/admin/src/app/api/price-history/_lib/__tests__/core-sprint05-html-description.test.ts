import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtmlWithFinalUrl } from "@commerce/crawler/src/shopify-product-json";
import { extractDetailModelCodes } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-05 — **HTML description 공급 가능성**(측정 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **matcher 개선이 아니다.** 다루는 구간은 **Evidence Supply 까지** 다.
 *    threshold · `NO_TITLE_OVERLAP` · MODEL_CODE conflict · BRAND · TITLE ·
 *    material parser · `priceTier` · `domesticReference` · IMAGE scoring ·
 *    OPTION/SKU — **전부 보지 않는다**. `description` 은 **SAME axis 가 아니다**.
 *
 * 🔴 **`materialText ≠ description`** 을 보존한다 — 이 하니스는 그 칸을 **쓰지 않는다**.
 *
 * ── 🔴 CPO §4 — 「찾았다」와 「상품 description 이라고 «판정» 할 수 있다」를 가른다 ──
 * ```
 * 🟢 후보로 인정   ① JSON-LD Product.description  ② meta description(og 포함)
 *                 ③ 명시적 상품 상세 영역        ④ 구조화된 상품 상세 데이터
 * 🔴 후보 아님     body 전체 · breadcrumb · seller name · title 주변 텍스트 ·
 *                 페이지 일반 설명 · footer/navigation · 임의 DOM 텍스트
 * ```
 */

type Verdict = "FOUND_AND_EXTRACTABLE" | "FOUND_BUT_UNSAFE" | "NOT_FOUND" | "ACCESS_UNAVAILABLE";

interface Row {
  url: string;
  host: string;
  status: string;
  fetchPath: string;
  facts: ProductFacts | null;
  /** 🔴 후보 source 를 **갈라서** 적는다(섞으면 Q2 를 답할 수 없다). */
  jsonLd: string | null;
  metaDesc: string | null;
  ogDesc: string | null;
  verdict: Verdict;
  why: string;
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const frac = (n: number, d: number) => (d === 0 ? "—" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

/** 🔴 태그를 걷는다 — 운영 `plainText` 와 같은 성질(원문 보존 · 새 파서 아님). */
const plain = (s: string): string =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 🟢 **① JSON-LD `Product.description`** — 가장 신뢰할 수 있는 자리다.
 *    🔴 스키마가 **「그 상품의 설명」이라고 스스로 말하는** 칸만 읽는다.
 *    🔴 `@type` 이 `Product` 가 **아니면 읽지 않는다**(BreadcrumbList·Organization·
 *       WebPage 의 description 은 **상품 설명이 아니다**).
 */
function jsonLdProductDescription(html: string): string | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const b of blocks) {
    const raw = b.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const stack: unknown[] = [parsed];
    while (stack.length) {
      const n = stack.pop();
      if (Array.isArray(n)) {
        stack.push(...n);
        continue;
      }
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      const t = o["@type"];
      const types = Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
      if (types.includes("Product") && typeof o.description === "string") {
        const v = plain(o.description);
        if (v) return v;
      }
      if (o["@graph"]) stack.push(o["@graph"]);
      for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

const metaContent = (html: string, re: RegExp): string | null => {
  const m = html.match(re);
  return m?.[1] ? plain(m[1]) || null : null;
};

/**
 * 🔴🔴 **판정 규칙 — 「후보 존재」와 「안전하게 공급 가능」을 가른다.**
 *
 * `FOUND_BUT_UNSAFE` 가 되는 조건(CPO §11 STOP 축과 1:1):
 * ```
 * ⒜ 값이 **제목과 사실상 같다**         ⟹ title 혼입(새 정보 0)
 * ⒝ 값이 **브랜드/판매처 이름뿐**        ⟹ seller name 혼입
 * ⒞ **너무 짧다**(< 20자)              ⟹ 상품 설명이라 판정할 근거가 없다
 * ⒟ 🔴 **네비게이션 어휘가 머리에 있다**  ⟹ breadcrumb/메뉴 덩어리
 * ```
 */
const NAV_HEAD = /(전체상품목록|바로가기|skip to content|장바구니|로그인|회원가입|my ?account|menu)/i;

function classify(r: Omit<Row, "verdict" | "why">): { verdict: Verdict; why: string } {
  if (!r.facts) return { verdict: "ACCESS_UNAVAILABLE", why: r.status };
  const cand = r.jsonLd ?? r.metaDesc ?? r.ogDesc;
  if (!cand) return { verdict: "NOT_FOUND", why: "JSON-LD Product.description · meta · og 전부 없음" };
  const t = (r.facts.title ?? "").trim().toLowerCase();
  const c = cand.trim().toLowerCase();
  if (c.length < 20) return { verdict: "FOUND_BUT_UNSAFE", why: `너무 짧다(${cand.length}자)` };
  if (NAV_HEAD.test(cand.slice(0, 80))) return { verdict: "FOUND_BUT_UNSAFE", why: "머리에 네비게이션 어휘" };
  if (t && (c === t || (c.length < t.length * 1.3 && c.includes(t))))
    return { verdict: "FOUND_BUT_UNSAFE", why: "제목과 사실상 같다(새 정보 0)" };
  const b = (r.facts.brand ?? "").trim().toLowerCase();
  if (b && c.replace(b, "").trim().length < 20) return { verdict: "FOUND_BUT_UNSAFE", why: "브랜드 이름뿐" };
  return {
    verdict: "FOUND_AND_EXTRACTABLE",
    why: r.jsonLd ? "JSON-LD Product.description" : r.metaDesc ? "meta description" : "og:description",
  };
}

const LIVE = process.env.CORE_SPRINT05_LIVE === "1";

describe.skipIf(!LIVE)("CORE-SAME-SPRINT-05 — HTML description 공급 가능성", () => {
  it(
    "PLAIN_HTML 원문에서 description 후보를 4분류하고 회복 효과를 측정한다",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      console.log(`\n  분모 — candidate rows **${SAME05_PAIRS.length}** · unique URL **${urls.length}**`);

      const rows: Row[] = [];
      for (const url of urls) {
        let status = "?";
        let fetchPath = "UNRESOLVED";
        let facts: ProductFacts | null = null;
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          status = String(r.status ?? "?");
          const cand = r.candidate as Record<string, unknown> | undefined;
          fetchPath = String(r.fetchPath ?? cand?.fetchPath ?? "UNRESOLVED");
          facts = (cand?.facts as ProductFacts | undefined) ?? null;
        } catch (e) {
          status = `THREW(${(e as Error).message.slice(0, 24)})`;
        }

        let jsonLd: string | null = null;
        let metaDesc: string | null = null;
        let ogDesc: string | null = null;
        /**
         * 🔴 **PLAIN_HTML 만** 원문을 본다. Shopify 는 이미 description 이 있고
         *    (SPRINT-03) 그 경로에 HTML 을 더 받으면 **추가 HTTP** 가 된다.
         * 🟢 운영 fetch owner 를 그대로 쓴다(SSRF·리다이렉트 계약 보존 · WU-075).
         */
        if (fetchPath === "PLAIN_HTML" && facts) {
          try {
            const got = (await fetchPlainHtmlWithFinalUrl(url)) as unknown as Record<string, unknown>;
            const html = typeof got?.html === "string" ? got.html : typeof got === "string" ? got : "";
            if (html) {
              jsonLd = jsonLdProductDescription(html);
              metaDesc = metaContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
              ogDesc = metaContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
            }
          } catch {
            /** 🔴 원문을 못 받은 것을 「후보 없음」으로 세지 않는다. */
          }
        }
        const base = { url, host: host(url), status, fetchPath, facts, jsonLd, metaDesc, ogDesc };
        rows.push({ ...base, ...classify(base) });
      }

      const shopify = rows.filter((r) => r.fetchPath === "SHOPIFY_JSON");
      const html = rows.filter((r) => r.fetchPath === "PLAIN_HTML");
      const htmlOk = html.filter((r) => r.facts);
      const readable = rows.filter((r) => r.facts);

      /** ── 5. 분모 ─────────────────────────────────────────────────────── */
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [5] 분모 — 🔴 섞지 않는다");
      console.log(`${"═".repeat(100)}`);
      console.log(`  candidate rows            ${SAME05_PAIRS.length}`);
      console.log(`  unique URLs               ${urls.length}`);
      console.log(`  facts 확보 URLs            ${readable.length}/${urls.length}`);
      console.log(`  SHOPIFY_JSON URLs         ${shopify.length}  (facts ${shopify.filter((r) => r.facts).length})`);
      console.log(`  PLAIN_HTML URLs           ${html.length}  (facts **${htmlOk.length}**)`);
      console.log(`  🔴 facts 미확보            ${urls.length - readable.length}  ⟹ **description 없음으로 세지 않는다**`);

      /** ── 4. 4분류(PLAIN_HTML facts 확보분) ──────────────────────────── */
      console.log(`\n${"═".repeat(100)}`);
      console.log(`  [4] PLAIN_HTML description 후보 4분류   (분모 = facts 확보 ${htmlOk.length})`);
      console.log(`${"═".repeat(100)}`);
      const buckets: Verdict[] = ["FOUND_AND_EXTRACTABLE", "FOUND_BUT_UNSAFE", "NOT_FOUND", "ACCESS_UNAVAILABLE"];
      for (const b of buckets) {
        const set = html.filter((r) => r.verdict === b);
        console.log(`  ${pad(b, 24)}${padL(String(set.length), 4)}`);
        for (const r of set) console.log(`      ${pad(r.host, 24)} ${r.why}`);
      }

      console.log(`\n  source 별 존재(PLAIN_HTML facts 확보 ${htmlOk.length})`);
      console.log(`     JSON-LD Product.description  ${frac(htmlOk.filter((r) => r.jsonLd).length, htmlOk.length)}`);
      console.log(`     meta description             ${frac(htmlOk.filter((r) => r.metaDesc).length, htmlOk.length)}`);
      console.log(`     og:description               ${frac(htmlOk.filter((r) => r.ogDesc).length, htmlOk.length)}`);

      /** ── 6. 비교표 ──────────────────────────────────────────────────── */
      const cell = (set: Row[], f: (r: Row) => boolean) => frac(set.filter(f).length, set.length);
      const descOf = (r: Row) => r.facts?.description ?? r.jsonLd ?? r.metaDesc ?? r.ogDesc ?? null;
      const EV: { label: string; f: (r: Row) => boolean }[] = [
        /**
         * 🔴🔴 **두 행을 갈라야 한다 — 섞으면 거짓이다.**
         *    1차 표가 `descOf`(후보 폴백)만 써서 PLAIN_HTML 을 **6/6(100%)** 로 적었다.
         *    🔴 그것은 「후보가 있다」이고 **현재 `ProductFacts.description` 은 0/6** 이다.
         *    그대로 보고했으면 「HTML 도 이미 공급된다」는 **거짓 결론** 이었다.
         */
        { label: "description(현재공급)", f: (r) => Boolean(r.facts?.description) },
        { label: "description(후보상한)", f: (r) => Boolean(descOf(r)) },
        { label: "후보 품번(상한)", f: (r) => extractDetailModelCodes(descOf(r)).length > 0 },
        { label: "brand", f: (r) => Boolean(r.facts?.brand) },
        { label: "model code", f: (r) => Boolean(r.facts?.brandModelCode) },
        { label: "category/form", f: (r) => Boolean(r.facts?.categoryText) },
        { label: "color", f: (r) => Boolean(r.facts?.colorText) },
        { label: "material", f: (r) => Boolean(r.facts?.materialText) },
        { label: "fit", f: (r) => Boolean(r.facts?.fitText) },
        { label: "image URL", f: (r) => (r.facts?.imageUrls?.length ?? 0) > 0 },
      ];
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [6] Evidence 비교표   🔴 분모는 «facts 확보분» 이다");
      console.log(`${"═".repeat(100)}`);
      console.log(`  ${pad("Evidence", 20)}${pad("SHOPIFY_JSON", 20)}${pad("PLAIN_HTML", 20)}전체`);
      console.log(
        `  ${pad("facts", 20)}${pad(frac(shopify.filter((r) => r.facts).length, shopify.length), 20)}` +
          `${pad(frac(htmlOk.length, html.length), 20)}${frac(readable.length, urls.length)}`,
      );
      const sOk = shopify.filter((r) => r.facts);
      for (const e of EV) {
        console.log(`  ${pad(e.label, 20)}${pad(cell(sOk, e.f), 20)}${pad(cell(htmlOk, e.f), 20)}${cell(readable, e.f)}`);
      }

      /** ── 7. 회복 효과(관측만 · 새 axis 0) ──────────────────────────── */
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [7] description 공급 시 기존 Evidence 회복 «관측»   🔴 새 axis 승격 0");
      console.log(`${"═".repeat(100)}`);
      const supply = html.filter((r) => r.verdict === "FOUND_AND_EXTRACTABLE");
      const codeRecover = supply.filter(
        (r) => !r.facts?.brandModelCode && extractDetailModelCodes(descOf(r)).length === 1,
      );
      const brandRecover = supply.filter((r) => {
        const d = (descOf(r) ?? "").toLowerCase();
        const b = (r.facts?.brand ?? "").toLowerCase();
        return !b && d.length > 0;
      });
      console.log(`  공급 가능(FOUND_AND_EXTRACTABLE)        ${supply.length}/${htmlOk.length}`);
      console.log(`  🟢 MODEL_CODE 없음 → 단일 품번 회복      **${codeRecover.length}**/${supply.length}`);
      console.log(`  🟡 BRAND 없음 → 설명문 존재(회복 «후보»)  ${brandRecover.length}/${supply.length}`);
      console.log(
        `  🔴 TITLE / FORM / COLOR / MATERIAL / FIT 회복 — **측정 범위 밖**` +
          `(그 추출기를 description 에 연결하는 것이 **matcher 입력 변경** 이다 · CPO 금지)`,
      );
      for (const r of codeRecover) {
        console.log(`      🟢 ${pad(r.host, 24)} ${extractDetailModelCodes(descOf(r))[0]}`);
      }

      /** ── 8. 호스트별 분모(일반화 금지) ─────────────────────────────── */
      console.log(`\n  [8] 호스트별 분모 — 🔴 tinyapple 결과를 일반화하지 않기 위해 센다`);
      const byHost = new Map<string, { n: number; desc: number; path: string }>();
      for (const r of readable) {
        const k = r.host;
        const cur = byHost.get(k) ?? { n: 0, desc: 0, path: r.fetchPath };
        byHost.set(k, { n: cur.n + 1, desc: cur.desc + (descOf(r) ? 1 : 0), path: r.fetchPath });
      }
      for (const [h, v] of [...byHost.entries()].sort((a, b) => b[1].n - a[1].n)) {
        console.log(`     ${pad(h, 28)}${pad(v.path, 14)}${v.desc}/${v.n}`);
      }

      /** 🔴 발화 단언 — 열화되면 전건 0 이 나오고 그것을 사실로 적으면 안 된다. */
      expect(readable.length, "🔴 읽힌 facts 가 0 이면 측정불가다(열화)").toBeGreaterThan(0);
      expect(html.length, "🔴 PLAIN_HTML URL 이 0 이면 이 Sprint 가 성립하지 않는다").toBeGreaterThan(0);
      /**
       * 🔴🔴 **내 1차 단언이 틀렸고 그대로 적는다.**
       *
       * 「description 과 materialText 가 **같은 값이면** 계약 B 위반」으로 썼는데 **아니다** —
       * SPRINT-03 계약 B 는 「**값이 같아질 수 있지만 같은 칸이 아니다**」다(Shopify 는
       * 둘 다 설명문 전문이 될 수 있고 그것이 **정상** 이다). 🔴 값 동일성은 위반이 아니다.
       * 🟢 이 Sprint 가 지켜야 하는 것은 **그 칸이 «변하지 않았다»** 이고, 운영 코드를
       *    바꾸지 않았으므로 **구조적으로 불변** 이다. 아래는 그 사실의 관측이다.
       */
      const matShop = sOk.filter((r) => r.facts?.materialText).length;
      const matHtml = htmlOk.filter((r) => r.facts?.materialText).length;
      console.log(
        `\n  🔴 materialText 불변 관측 — SHOPIFY ${matShop}/${sOk.length} · PLAIN_HTML **${matHtml}/${htmlOk.length}**` +
          `  (공급을 구현하지 않았으므로 **구조적 불변** 이다)`,
      );
      expect(matHtml, "🔴 PLAIN_HTML 에 material 이 생기면 이 Sprint 가 그 칸을 건드린 것이다").toBe(0);
      console.log(`\n  🟢 HTTP — factsFromProductUrl ${urls.length} + PLAIN_HTML 원문 ${htmlOk.length} · 운영 변경 0`);
    },
    15 * 60 * 1000,
  );
});
