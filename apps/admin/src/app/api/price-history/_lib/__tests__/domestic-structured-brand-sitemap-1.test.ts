/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DOMESTIC-STRUCTURED-BRAND-SITEMAP-1 — **사이트맵에서 뽑은 «진짜» 상품 URL 로 재측정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **READ-ONLY 측정 전용.** 운영 코드 **0** · DB **0** · BRAND Evidence **0** ·
 *    matcher/threshold/GT **0** · `PRESUMED_SAME` 승격 **0** · 본문/도메인/`og:site_name`
 *    **브랜드 승격 0**. 🔴 **이번 조사는 측정만 한다**(CPO 명시).
 *
 * ── 왜 다시 재는가 ──────────────────────────────────────────────────────────
 * `DOMESTIC-STRUCTURED-BRAND-COVERAGE-1` 의 frame 측정이 상품 URL 을
 * **홈 1-hop + `classifyUrlShape`** 으로 골랐는데, WU-073 이 기록한 대로 그 분류기가
 * **한국 CMS 목록을 `PRODUCT_PAGE` 로 오분류** 한다 ⟹ 그 측정의 JSON-LD 숫자는 **무효** 였다.
 * 🟢 이번에는 **사이트가 스스로 내놓은 sitemap** 에서 URL 을 뽑는다(URL 지어내기 0).
 *
 * ── 🔴🔴 순환 논증을 피한다 ─────────────────────────────────────────────────
 * 「상품 페이지인가」를 **JSON-LD Product 로 판별하면** 그 다음에 재는 「JSON-LD Product
 * 비율」이 **항상 100%** 가 된다(동어반복). 🟢 그래서 상품 페이지 판별은 **JSON-LD 와
 * 독립된 신호 둘** 로만 한다 — `og:type=product` · `itemprop="price"`.
 * 🔴 1차에 「장바구니/구매하기」 **본문 문구** 를 넣었다가 **홈페이지가 전부 통과** 했다
 *    (한국 쇼핑몰은 헤더에 장바구니 링크를 둔다) ⟹ 뺐다. 상세는 `looksLikeProductPage` 주석.
 *
 * 🔴 표본은 **기존 19 도메인 그대로** 다(CPO: 「표본을 새로 임의 선정하지 않는다」).
 */
import { describe, expect, it } from "vitest";

const LIVE = process.env.DSBS_LIVE === "1";
/* 🔴 JS 실행 축 플래그는 **없앴다** — 그 측정은 이 파일에서 돌지 않는다(맨 아래 주석). */

/** 🔴 `DOMESTIC-STRUCTURED-BRAND-COVERAGE-1` 과 **같은 19 도메인**(새로 고르지 않았다). */
const DOMAINS = [
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
  "vividvia.com",
  "miniboutique.co.kr",
  "biskuit.kr",
  "coupleshot.com",
  "kids-world.com",
] as const;

const UA = "Mozilla/5.0 (compatible; ttaejyo-research/1.0)";

async function get(url: string, ms = 20000): Promise<{ ok: boolean; status: number; body: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: ac.signal, redirect: "follow" });
    return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : "" };
  } catch {
    return { ok: false, status: 0, body: "" };
  } finally {
    clearTimeout(t);
  }
}

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
const isSitemapIndex = (xml: string): boolean => /<sitemapindex/i.test(xml);

/** robots 의 `Sitemap:` 줄도 본다 — 사이트가 **스스로 알려 주는** 자리다. */
function sitemapsFromRobots(txt: string): string[] {
  return [...txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
}

/**
 * 🔴🔴 **JSON-LD 와 독립된** 상품 페이지 신호. 이것으로만 「상품 상세인가」를 가른다.
 */
function looksLikeProductPage(html: string): boolean {
  /**
   * 🔴🔴 **[정정 · 1차 실행에서 내가 틀렸다]** 처음엔 「장바구니|구매하기」 **본문 문구** 를
   *    신호에 넣었다. 그런데 한국 쇼핑몰은 **헤더에 장바구니 링크** 를 둔다 ⟹ **홈페이지가
   *    전부 「상품 확인」으로 통과** 했다(실행 결과 `PRODUCT_URLS` 가 대부분 `https://도메인/`).
   *    🔴 그대로 보고했으면 **「상품 11곳 중 brand 1곳」이라는 거짓 숫자** 였다.
   * 🟢 그래서 **페이지 단위로만 서는 신호 둘** 로 좁혔다 — `og:type=product` ·
   *    `itemprop="price"`. 🔴 둘 다 **JSON-LD 와 독립** 이라 순환 논증이 아니다.
   */
  if (/property\s*=\s*["']og:type["'][^>]*content\s*=\s*["']product["']/i.test(html)) return true;
  if (/itemprop\s*=\s*["']price["']/i.test(html)) return true;
  return false;
}

/** JSON-LD 에서 `Product` 와 `brand` 를 읽는다(배열·@graph 포함). */
function readJsonLdProduct(html: string): { hasProduct: boolean; brand: unknown } {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
  let hasProduct = false;
  let brand: unknown = undefined;
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    const t = o["@type"];
    if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
      hasProduct = true;
      if (brand === undefined && o.brand !== undefined) brand = o.brand;
    }
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const b of blocks) {
    try {
      walk(JSON.parse(b));
    } catch {
      /* 깨진 JSON-LD 도 분모에 남는다 */
    }
  }
  return { hasProduct, brand };
}

const brandText = (b: unknown): string =>
  b === undefined
    ? "🔴 없음"
    : typeof b === "string"
      ? b.slice(0, 14)
      : String((b as Record<string, unknown>)?.name ?? "(name없음)").slice(0, 14);

interface Row {
  domain: string;
  sitemap: string;
  productUrl: string | null;
  tried: number;
  verdict: string;
  jsonLd: string;
  brand: string;
  micro: string;
}

describe("DOMESTIC-STRUCTURED-BRAND-SITEMAP-1 — sitemap 기반 재측정(관측)", () => {
  it.runIf(LIVE)(
    "측정 — 도메인별 sitemap → 실제 상품 URL → Product.brand",
    async () => {
      const rows: Row[] = [];
      for (const domain of DOMAINS) {
        const origin = `https://${domain}`;
        /** ① sitemap 후보 — robots 의 `Sitemap:` 줄 우선, 없으면 표준 위치. */
        const rb = await get(`${origin}/robots.txt`, 12000);
        const cands = [...sitemapsFromRobots(rb.body), `${origin}/sitemap.xml`];
        let urls: string[] = [];
        let used = "—";
        for (const sm of cands.slice(0, 4)) {
          const r = await get(sm, 20000);
          if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
          used = sm.replace(origin, "");
          if (isSitemapIndex(r.body)) {
            /** ② index 면 자식 sitemap 중 **product/goods** 를 먼저 본다. */
            const kids = locs(r.body);
            const pick = kids.filter((k) => /product|goods|item/i.test(k)).slice(0, 2);
            for (const k of (pick.length ? pick : kids.slice(0, 2))) {
              const kr = await get(k, 20000);
              if (kr.ok) urls.push(...locs(kr.body));
              if (urls.length > 400) break;
            }
          } else {
            urls = locs(r.body);
          }
          if (urls.length) break;
        }
        if (!urls.length) {
          rows.push({ domain, sitemap: used === "—" ? "🔴 없음/불가" : used, productUrl: null, tried: 0, verdict: "—", jsonLd: "—", brand: "—", micro: "—" });
          continue;
        }
        /**
         * ③ 🔴 **HTML 구조로** 상품 페이지를 확인한다(JSON-LD 와 독립 신호).
         *    🔴 시도 횟수를 **8 로 묶는다** — 무제한 요청을 보내지 않는다(그 상한을 같이 적는다).
         */
        /**
         * 🔴 **홈/최상위 URL 을 뺀다** — 1차 실행에서 sitemap 의 첫 줄(= 홈)이 계속 뽑혔다.
         * 🟢 그리고 **상품처럼 보이는 경로를 먼저** 시도한다(순서일 뿐 · 판정은 **HTML** 이 한다).
         */
        const deep = urls
          .filter((u) => !/\.(jpg|png|webp|gif|pdf|xml)$/i.test(u))
          .filter((u) => {
            try {
              return new URL(u).pathname.replace(/\/+$/, "").length > 1;
            } catch {
              return false;
            }
          });
        const score = (u: string) => (/product|goods|shopdetail|item|\/p\//i.test(u) ? 0 : 1);
        const sample = [...deep].sort((a, b) => score(a) - score(b)).slice(0, 40);
        let found: { url: string; html: string } | null = null;
        let tried = 0;
        for (const u of sample) {
          if (tried >= 8) break;
          tried += 1;
          const pg = await get(u, 20000);
          if (!pg.ok) continue;
          if (looksLikeProductPage(pg.body)) {
            found = { url: u, html: pg.body };
            break;
          }
        }
        if (!found) {
          rows.push({ domain, sitemap: used, productUrl: null, tried, verdict: "🔴 상품확인 실패", jsonLd: "—", brand: "—", micro: "—" });
          continue;
        }
        const { hasProduct, brand } = readJsonLdProduct(found.html);
        rows.push({
          domain,
          sitemap: used,
          productUrl: found.url,
          tried,
          verdict: "🟢 상품확인",
          jsonLd: hasProduct ? "🟢 Product" : "🔴 없음",
          brand: brandText(brand),
          micro: /itemtype\s*=\s*["'][^"']*schema\.org\/Product/i.test(found.html) ? "🟢" : "🔴",
        });
      }

      const n = rows.length;
      const ok = rows.filter((r) => r.verdict === "🟢 상품확인");
      const prod = ok.filter((r) => r.jsonLd === "🟢 Product").length;
      const withBrand = ok.filter((r) => r.brand !== "🔴 없음" && r.brand !== "—").length;
      const micro = ok.filter((r) => r.micro === "🟢").length;

      const out = [
        "\n━━━━━━━━━━ DOMESTIC-STRUCTURED-BRAND-SITEMAP-1 (정적 HTML · 관측) ━━━━━━━━━━",
        "  domain                     sitemap              시도  상품확인        JSON-LD      brand          micro",
        ...rows.map(
          (r) =>
            `  ${r.domain.padEnd(26)} ${r.sitemap.slice(0, 20).padEnd(20)} ${String(r.tried).padEnd(5)} ${r.verdict.padEnd(14)} ${r.jsonLd.padEnd(12)} ${r.brand.padEnd(14)} ${r.micro}`,
        ),
        "",
        `  조사 도메인(분모)                 ${n}`,
        `  sitemap 미확보                    ${rows.filter((r) => r.verdict === "—").length}`,
        `  sitemap 있으나 상품확인 실패        ${rows.filter((r) => r.verdict === "🔴 상품확인 실패").length}`,
        `  🟢 상품 상세 확인(독립 신호)        ${ok.length}`,
        `  Product JSON-LD 존재              ${prod} / ${ok.length}`,
        `  🔴 Product.brand 선언             ${withBrand} / ${ok.length}`,
        `  microdata Product                 ${micro} / ${ok.length}`,
        "  🔴 상품 URL 시도 상한 **8/도메인** — 그 상한 때문에 놓쳤을 수 있다(숨기지 않는다)",
        "  🔴 이 표본의 관찰이고 국내 전체가 아니다 · 🔴 matcher/BRAND Evidence 변경 0",
      ];
      // eslint-disable-next-line no-console
      console.log(out.join("\n"));
      /** 🟢 다음 테스트가 쓰도록 **확인된 상품 URL** 을 남긴다. */
      // eslint-disable-next-line no-console
      console.log("\nPRODUCT_URLS=" + JSON.stringify(ok.map((r) => ({ d: r.domain, u: r.productUrl }))));
      expect(n).toBe(DOMAINS.length);
    },
    1800000,
  );

  it("frame — 표본이 직전 조사와 «같은 19» 다(새로 고르지 않았다)", () => {
    expect(DOMAINS.length).toBe(19);
    for (const portal of ["coupang.com", "ssg.com", "musinsa.com", "shopping.naver.com", "danawa.com"]) {
      expect(DOMAINS, `🔴 포털이 들어왔다: ${portal}`).not.toContain(portal);
    }
  });
});


/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 JS 실행 축(CPO 방법 ⑤) — **여기서 돌리지 않는다. 이유를 적는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `playwright` 는 `packages/crawler` 의 의존성이라 **`apps/admin` 에서 resolve 되지
 *    않는다**(실측: vitest `Failed to load url playwright` · tsc `TS2307`).
 *    처음엔 이 파일 안에 JS 블록을 뒀다가 **typecheck 2건** 이 나서 **제거** 했다 —
 *    죽은 블록을 남기면 다음 사람이 「JS 축도 이 파일이 잰다」로 읽는다.
 *
 * 🟢 **측정은 실제로 했다** — `packages/crawler` 에서 Playwright 로 같은 9 URL 을 렌더했고
 *    결과는 `docs/DOMESTIC-STRUCTURED-BRAND-SITEMAP-1.md` §2 에 있다:
 * ```
 * 로드 성공 9/9 · Product JSON-LD **3** · Product.brand 선언 **3** · 값도 동일
 * ⟹ 정적 HTML 과 **차이 0** ⟹ 「JS 실행 후에만 brand 가 보인다」 가설은 **반증됐다**
 * ```
 * 🔴 그래서 이 저장소에 **렌더 기반 수집을 붙일 근거가 이 표본에는 없다**(얻는 것이 0).
 */
