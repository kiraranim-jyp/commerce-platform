/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DOMESTIC-STRUCTURED-BRAND-COVERAGE-1 — 국내 샵이 «구조화 brand» 를 선언하는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **READ-ONLY 측정 전용.** 운영 코드 **0** · DB **0** · matcher/BRAND Evidence **0**.
 *    🔴 이 결과로 matcher 나 BRAND Evidence 를 **바꾸지 않는다**(CPO 명시).
 *    🔴 **국내 전체 시장의 성질로 확대 해석하지 않는다** — 이 표본의 관찰이다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * `DOMESTIC-EXACT-PRICE-DISCOVERY-1` 이 찾은 것 — 국내 후보를 막는 것은 **BRAND 축**
 * (10/11)이고, 그것은 **원상품 탓이 아니다**(원상품 brand = "Bobo Choses" 정상).
 * 후보 페이지가 **구조화 brand 를 선언하지 않는다**. 🔴 그런데 그것이 **그 두 샵의 성질**
 * 인지 **국내 샵 전반의 성질** 인지는 **재지 않았다** — 이 측정이 그 하나만 가른다.
 *
 * ── 표본 frame (🔴 손으로 고르지 않았다) ─────────────────────────────────────
 * ```
 * ① 운영 등록부 `domestic_price_sources` 중 **포털/오픈마켓/가격비교를 뺀** 판매처
 *    🔴 제외 근거는 약관이다(메모 `portal-scraping-blocked-by-terms`) — 성능이 아니다
 * ② 운영 `candidate_reviews` 가 실제로 만난 한국계 도메인
 * ```
 * 🔴🔴 **30 을 채우지 못했다** — 이유를 숨기지 않는다:
 *    ⒜ `WebSearch` 가 **US-only** 라 국내 쇼핑몰이 결과에 안 나온다
 *    ⒝ **URL 을 지어내지 않는다**(이 저장소의 금지 행위) ⟹ 상품 URL 은 **그 사이트가
 *       스스로 건 링크** 에서만 얻는다(홈 1-hop · `classifyUrlShape` 로 고른다)
 *    ⟹ 🟢 그래서 분모는 **「제품이 실제로 아는 국내 판매처 전수」** 다(임의 30 보다 정직하다)
 *
 * 🔴 실패·접근 불가 페이지를 **분모에서 숨기지 않는다**(CPO 명시 ⑥).
 */
import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/** 🔴 측정이 네트워크를 쓰므로 **명시 플래그** 가 있을 때만 돈다(기본 SKIP). */
const LIVE = process.env.DSBC_LIVE === "1";

/**
 * 🔴 **frame ①** — 등록부에서 포털/오픈마켓/가격비교를 뺀 판매처(2026-11-09 DB 실측).
 *    🔴 `NOT_AVAILABLE` 13곳 전부 + MANUAL 중 포털성 8곳(29cm · danawa · kidikidi ·
 *       kream · musinsa · shoppinghow · ssfshop · wconcept)을 **약관으로** 뺐다.
 */
const REGISTRY = [
  "bobochoses.com",
  "chocoel.co.kr",
  "deuxbebe.com",
  "foretforet.com",
  "littleluna.co.kr",
  "looxloo.com",
  "rulii.co.kr",
  "skysport.co.kr",
  "chouchouenfant.kr",
  "coconjennie.com",
  "donokids.com",
  "karymarket.com",
  "nokimore.com",
  "ocokorea.com",
] as const;

/** 🔴 **frame ②** — 운영이 실제로 만난 한국계 후보 도메인(candidate_reviews 실측). */
const SEEN = ["vividvia.com", "miniboutique.co.kr", "biskuit.kr", "coupleshot.com", "kids-world.com"] as const;

const DOMAINS = [...new Set([...REGISTRY, ...SEEN])];

const UA = "Mozilla/5.0 (compatible; ttaejyo-research/1.0)";

async function get(url: string, ms = 20000): Promise<{ ok: boolean; status: number; body: string; finalUrl: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: ac.signal, redirect: "follow" });
    const body = r.ok ? await r.text() : "";
    return { ok: r.ok, status: r.status, body, finalUrl: r.url || url };
  } catch {
    return { ok: false, status: 0, body: "", finalUrl: url };
  } finally {
    clearTimeout(t);
  }
}

/** 🔴 robots 를 먼저 본다 — 전면 차단이면 **그 도메인을 읽지 않는다**(분모엔 남긴다). */
function robotsBlocksAll(txt: string): boolean {
  const lines = txt.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  let inStar = false;
  for (const l of lines) {
    if (l.startsWith("user-agent:")) inStar = l.slice(11).trim() === "*";
    else if (inStar && l.startsWith("disallow:") && l.slice(9).trim() === "/") return true;
  }
  return false;
}

/** 🟢 상품 URL 을 **그 사이트가 건 링크** 에서 고른다 — 운영 분류기 `classifyUrlShape` 로. */
function pickProductUrl(html: string, origin: string): string | null {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!);
  for (const h of hrefs) {
    let abs: string;
    try {
      abs = new URL(h, origin).toString();
    } catch {
      continue;
    }
    if (new URL(abs).hostname.replace(/^www\./, "") !== new URL(origin).hostname.replace(/^www\./, "")) continue;
    if (classifyUrlShape(abs) === "PRODUCT_PAGE") return abs;
  }
  return null;
}

/** JSON-LD 블록 전부에서 `Product` 를 찾고 `brand` 를 꺼낸다(배열·@graph 포함). */
function readJsonLdProduct(html: string): { hasProduct: boolean; brand: unknown } {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
  let hasProduct = false;
  let brand: unknown = undefined;
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    const t = o["@type"];
    const isProduct = t === "Product" || (Array.isArray(t) && t.includes("Product"));
    if (isProduct) {
      hasProduct = true;
      if (brand === undefined && o.brand !== undefined) brand = o.brand;
    }
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const b of blocks) {
    try {
      walk(JSON.parse(b));
    } catch {
      /* 🔴 깨진 JSON-LD 도 «있었다» 는 사실이라 조용히 넘기되 분모에 남는다 */
    }
  }
  return { hasProduct, brand };
}

const ogSiteName = (html: string): string | null =>
  html.match(/property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;

describe("DOMESTIC-STRUCTURED-BRAND-COVERAGE-1 — 국내 샵 구조화 brand 선언율(관측)", () => {
  /**
   * 🔴🔴 **[사후 정정 · 2026-11-09] 이 측정의 「JSON-LD」 칸을 «쓰지 않는다».**
   *
   * 실행 결과 `Product JSON-LD 0/14` 가 나왔는데 **CONTROL(아래)에서 2/6 이 나왔다** ⟹
   * 이 측정이 고른 URL 중 일부는 **상품 상세가 아니다**(WU-073 이 기록한 그 오분류 —
   * `classifyUrlShape` 가 한국 CMS 목록을 `PRODUCT_PAGE` 로 읽는다).
   * 🟢 **유효한 것은 CONTROL** 이고, 이 블록에서 살아남는 관측은 **도메인 접근성 ·
   *    `og:site_name` · 본문 브랜드명**(페이지 종류에 덜 민감한 축)뿐이다.
   * 🔴 「0」을 그대로 보고하지 않은 이유가 이것이다(헌장 §5-B).
   */
  it.runIf(LIVE)(
    "측정 — 도메인별 상품 상세 1건 (🔴 JSON-LD 칸은 CONTROL 로 대체됨)",
    async () => {
      type Row = {
        domain: string;
        robots: string;
        product: string;
        jsonLd: string;
        brand: string;
        brandType: string;
        bodyBrand: string;
        site: string;
      };
      const rows: Row[] = [];
      for (const domain of DOMAINS) {
        const origin = `https://${domain}`;
        const rb = await get(`${origin}/robots.txt`, 12000);
        if (rb.ok && robotsBlocksAll(rb.body)) {
          rows.push({ domain, robots: "🔴 전면차단", product: "—", jsonLd: "—", brand: "—", brandType: "—", bodyBrand: "—", site: "—" });
          continue;
        }
        const home = await get(origin);
        if (!home.ok) {
          rows.push({ domain, robots: "ok", product: `🔴 홈 ${home.status || "fail"}`, jsonLd: "—", brand: "—", brandType: "—", bodyBrand: "—", site: "—" });
          continue;
        }
        const purl = pickProductUrl(home.body, home.finalUrl);
        if (!purl) {
          rows.push({ domain, robots: "ok", product: "🔴 상품링크 미발견", jsonLd: "—", brand: "—", brandType: "—", bodyBrand: "—", site: ogSiteName(home.body) ?? "-" });
          continue;
        }
        const pg = await get(purl);
        if (!pg.ok) {
          rows.push({ domain, robots: "ok", product: `🔴 상품 ${pg.status || "fail"}`, jsonLd: "—", brand: "—", brandType: "—", bodyBrand: "—", site: "—" });
          continue;
        }
        const { hasProduct, brand } = readJsonLdProduct(pg.body);
        const bt = brand === undefined ? "—" : typeof brand === "string" ? "문자열" : "객체";
        const bv =
          brand === undefined
            ? "🔴 없음"
            : typeof brand === "string"
              ? brand.slice(0, 20)
              : String((brand as Record<string, unknown>)?.name ?? "(name 없음)").slice(0, 20);
        rows.push({
          domain,
          robots: "ok",
          product: "🟢",
          jsonLd: hasProduct ? "🟢 Product" : "🔴 없음",
          brand: bv,
          brandType: bt,
          /** 🔴 본문 브랜드명은 **Product.brand 와 별도로** 기록한다(CPO ⑤). */
          bodyBrand: /bobo\s*choses|보보쇼즈/i.test(pg.body) ? "있음" : "-",
          site: ogSiteName(pg.body) ?? "-",
        });
      }

      const n = rows.length;
      const reach = rows.filter((r) => r.product === "🟢").length;
      const prod = rows.filter((r) => r.jsonLd === "🟢 Product").length;
      const hasBrand = rows.filter((r) => r.jsonLd === "🟢 Product" && r.brand !== "🔴 없음").length;
      const bodyOnly = rows.filter((r) => r.brand === "🔴 없음" && r.bodyBrand === "있음").length;

      const out = [
        "\n━━━━━━━━━━ DOMESTIC-STRUCTURED-BRAND-COVERAGE-1 (관측) ━━━━━━━━━━",
        "  domain                     robots   product  JSON-LD      brand            type    본문  og:site_name",
        ...rows.map(
          (r) =>
            `  ${r.domain.padEnd(26)} ${r.robots.padEnd(8)} ${r.product.padEnd(8)} ${r.jsonLd.padEnd(12)} ${r.brand.padEnd(16)} ${r.brandType.padEnd(7)} ${r.bodyBrand.padEnd(5)} ${r.site}`,
        ),
        "",
        `  조사 도메인(분모)            ${n}`,
        `  접근 가능한 상품 페이지       ${reach}`,
        `  Product JSON-LD 존재         ${prod}`,
        `  Product.brand 선언           ${hasBrand}`,
        `  🔴 본문에만 브랜드 존재        ${bodyOnly}`,
        "  🔴 실패·차단도 분모에 남겼다(CPO ⑥) · 🔴 이 표본의 관찰이고 국내 전체가 아니다",
      ];
      // eslint-disable-next-line no-console
      console.log(out.join("\n"));
      expect(n).toBeGreaterThan(0);
    },
    600000,
  );

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **CONTROL — 「0」을 보고하기 «전» 에 하니스를 의심한다**(헌장 §5-B)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 위 측정은 상품 URL 을 **홈 1-hop + `classifyUrlShape`** 으로 고른다. 그런데
   *    WU-073 이 기록했다 — **그 분류기는 한국 CMS 목록(`goods_list`·`product_list`·
   *    `shopbrand`)을 `PRODUCT_PAGE` 로 오분류** 한다. ⟹ 위의 「Product JSON-LD 0」이
   *    **목록 페이지를 읽어서** 나온 값일 수 있다(= 하니스 결함).
   * 🟢 그래서 **운영이 실제로 판정한 상품 상세 URL**(DB `candidate_reviews` 실측)로
   *    같은 측정을 다시 한다. 🔴 **CONTROL 이 실패하면 위 숫자를 쓰지 않는다.**
   */
  const CONTROL: { domain: string; url: string }[] = [
    { domain: "donokids.com", url: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785&type=x&current_category=058" },
    { domain: "vividvia.com", url: "https://www.vividvia.com/product/%eb%b3%b4%eb%b3%b4%ec%87%bc%ec%a6%88-26fw-hug-hairy-monster-t-shirt-b226ac009/496/" },
    { domain: "miniboutique.co.kr", url: "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/" },
    { domain: "biskuit.kr", url: "https://biskuit.kr/product/%eb%b3%b4%eb%b3%b4%ec%87%bc%ec%a6%88-%ed%97%88%ea%b7%b8-%ed%97%a4%ec%96%b4%eb%a6%ac-%eb%aa%ac%ec%8a%a4%ed%84%b0-%ed%8b%b0%ec%85%94%ec%b8%a0-b226ac009/8891/category/367/display/1/" },
    { domain: "coupleshot.com", url: "http://www.coupleshot.com/m/product.html?branduid=574657&special=1" },
    { domain: "kids-world.com", url: "https://www.kids-world.com/ko-kr/bobo-choses-sweatshirt-midnight-blue-print-p-450718.html" },
  ];

  it.runIf(LIVE)(
    "CONTROL — 운영이 «실제로 판정한» 상품 상세 URL 로 같은 측정",
    async () => {
      const rows: string[] = [
        "\n━━━━━━━━━━ CONTROL · 운영 실측 상품 URL(6) ━━━━━━━━━━",
        "  domain                 http  JSON-LD      brand        microdata  본문  og:site_name",
      ];
      let reach = 0;
      let prod = 0;
      let brandN = 0;
      let micro = 0;
      for (const c of CONTROL) {
        const pg = await get(c.url, 25000);
        if (!pg.ok) {
          rows.push(`  ${c.domain.padEnd(22)} 🔴${String(pg.status || "fail").padEnd(4)} —            —            —          —     —`);
          continue;
        }
        reach += 1;
        const { hasProduct, brand } = readJsonLdProduct(pg.body);
        if (hasProduct) prod += 1;
        const bv =
          brand === undefined
            ? "🔴 없음"
            : typeof brand === "string"
              ? brand.slice(0, 11)
              : String((brand as Record<string, unknown>)?.name ?? "(name없음)").slice(0, 11);
        if (brand !== undefined) brandN += 1;
        /** 🔴 microdata 도 **별도로** 센다 — JSON-LD 가 없다고 「구조화 0」이 아니다. */
        const hasMicro = /itemtype\s*=\s*["'][^"']*schema\.org\/Product/i.test(pg.body);
        if (hasMicro) micro += 1;
        rows.push(
          `  ${c.domain.padEnd(22)} 🟢200 ${(hasProduct ? "🟢 Product" : "🔴 없음").padEnd(12)} ${bv.padEnd(12)} ${(hasMicro ? "🟢 있음" : "🔴 없음").padEnd(10)} ${(/bobo\s*choses|보보쇼즈/i.test(pg.body) ? "있음" : "-").padEnd(5)} ${ogSiteName(pg.body) ?? "-"}`,
        );
      }
      rows.push(
        "",
        `  CONTROL 분모                 ${CONTROL.length}`,
        `  접근 가능                    ${reach}`,
        `  Product JSON-LD 존재         ${prod}`,
        `  Product.brand 선언           ${brandN}`,
        `  microdata Product 존재       ${micro}`,
        "  🔴 CONTROL 이 0 이면 위 frame 측정의 0 은 **하니스 결함이 아니다**(같은 결과)",
      );
      // eslint-disable-next-line no-console
      console.log(rows.join("\n"));
      expect(reach).toBeGreaterThan(0);
    },
    300000,
  );

  it("frame — 표본이 «운영에서» 유도됐다(손으로 고르지 않았다)", () => {
    /** 🔴 등록부 포털/오픈마켓은 **약관** 으로 뺐다 — 성능이 아니다. */
    for (const portal of ["coupang.com", "ssg.com", "musinsa.com", "shopping.naver.com", "danawa.com"]) {
      expect(DOMAINS, `🔴 포털이 표본에 들어왔다: ${portal}`).not.toContain(portal);
    }
    /** 🔴 분모가 30 이 아니라는 사실을 계약이 들고 있는다(숨기지 않는다). */
    expect(DOMAINS.length).toBeLessThan(30);
    expect(DOMAINS.length).toBeGreaterThanOrEqual(15);
  });
});
