import { resolveBrandName } from "./brand-resolver";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-134 — **사이트가 스스로 밝힌 이름** (순수 · HTTP 0 · AI 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일은 「브랜드를 추측하는 곳」이 아니다.** 하는 일은 하나다 —
 *    페이지가 **두 자리에 같은 이름을 적어 뒀을 때만** 그 문자열을 돌려준다.
 *    돌려준 값을 브랜드로 쓸지는 **호출부가** 훨씬 좁은 조건에서 정한다
 *    (`canonical-product.ts` · 아래 「언제 쓰이는가」).
 *
 * ── 🔴 왜 필요했나 (WU-133/134 실측) ───────────────────────────────────────
 * ```
 * 원상품 bobochoses.com(브랜드 **공식몰**)
 *   Shopify vendor          = "AW26"   ← 시즌코드
 *   JSON-LD Product.brand   = "AW26"   ← 같은 값
 *   ⟹ `resolveBrandName` 이 **올바르게** 버린다(REWORK-12 ④) → brand.value = ""
 * 그 결과가 만든 사슬(WU-133 전수 추적):
 *   brandKnown=false → **모든 후보** BRAND_UNCONFIRMED → PRESUMED_SAME
 *   → crossSellerReserved → TEXT_CONFIRMED → COMPARISON → 가격비교 **0건**
 * 🟢 그런데 그 페이지는 브랜드를 **두 자리에 적어 두고 있었다** —
 *    `og:site_name` = `Organization.name` = **"Bobo Choses"**
 * ```
 *
 * ── 🔴🔴 WU-080 이 REJECT 한 축과 «무엇이 다른가» ──────────────────────────
 * ```
 * WU-080 가 막은 것   「후보/도메인/판매처 이름을 브랜드로 쓴다」
 *                      (멀티브랜드 리테일러 25/26 에 상점 이름이 박힌다 · 계약으로 잠김)
 * 🟢 이 파일이 하는 것 「**원상품** 이 브랜드를 적어 뒀는데 그 값이 시즌코드로
 *                      **거부된** 경우에만」 사이트가 밝힌 이름을 본다
 * 🔴 **도메인에서 만들지 않는다** — 도메인은 이 파일에 등장조차 하지 않는다
 * 🔴 **후보 페이지에 쓰지 않는다** — 호출부가 원상품 경로 하나다
 * 🟢 실측(WU-134 STEP 1 · 후보 17건): 발화 조건(「brand 가 있는데 시즌코드로 거부」)에
 *    걸리는 **리테일러는 0건** 이다. 리테일러는 Product.brand 를 **갖고 있거나**(11)
 *    **아예 없다**(6) — 둘 다 이 경로를 타지 않는다
 * ```
 *
 * ── 🔴 두 자리가 «같아야» 하는 이유 ────────────────────────────────────────
 * ```
 * `og:site_name` 하나만 보면 테마가 넣은 문구·슬로건·국가명이 들어올 수 있다.
 * JSON-LD `Organization.name` 하나만 보면 결제대행사/모회사 이름이 들어올 수 있다.
 * 🟢 **둘이 독립적으로 같은 문자열을 말할 때** 그것은 「이 사이트가 자기를 부르는
 *    이름」이라는 사실이 된다. 🔴 다르면 **모른다**(null) — 고르지 않는다.
 * ```
 */

/** 🔴 `og:site_name` — 테마가 적는 자리. 단독으로는 쓰지 않는다. */
function ogSiteName(html: string): string | null {
  const m =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i.exec(html);
  return m ? decodeBasicEntities(m[1]).trim() || null : null;
}

/**
 * 🔴 JSON-LD `Organization.name` — 구조화 데이터가 적는 자리.
 * 🔴 `@type` 이 **정확히 Organization** 인 노드만 본다(`WebSite`·`BreadcrumbList`·
 *    `Product` 는 보지 않는다 — 그 이름들은 사이트 이름이 아니다).
 * 🟢 `@graph` 와 배열 모양을 **둘 다** 받는다(실측: bobochoses.com 은 블록 7개다).
 */
function jsonLdOrganizationName(html: string): string | null {
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(b[1]);
    } catch {
      /* 🔴 깨진 블록은 **조용히 건너뛴다** — 다른 블록이 정상일 수 있다. */
      continue;
    }
    const root = parsed as { "@graph"?: unknown };
    const nodes = Array.isArray(parsed) ? parsed : Array.isArray(root["@graph"]) ? root["@graph"] : [parsed];
    for (const n of nodes) {
      const node = n as { "@type"?: unknown; name?: unknown };
      const type = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (!type.includes("Organization")) continue;
      if (typeof node.name !== "string") continue;
      const name = decodeBasicEntities(node.name).trim();
      if (name) return name;
    }
  }
  return null;
}

/** 🔴 `&amp;` 류만 푼다 — 실측에 있던 모양이다(`Scout &amp; Co`). 일반 HTML 파서를 쓰지 않는다. */
function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

/** 🔴 비교용 정규화 — **표시값을 바꾸지 않는다**(비교에만 쓴다). */
const sameName = (a: string, b: string): boolean =>
  a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();

export interface SiteBrandName {
  /** 🟢 두 자리가 **같을 때만** 채워진다. */
  value: string;
  /** 🔴 어디서 왔는지 — 「추측이 아니다」를 보고서가 증명할 수 있어야 한다. */
  evidence: "OG_SITE_NAME_AND_JSONLD_ORGANIZATION";
}

/**
 * 사이트가 **두 자리에 같이** 적어 둔 자기 이름. 🔴 없거나 다르면 `null`.
 *
 * 🔴 **그 값이 브랜드로 쓸 수 있는 문자열인지도 여기서 본다** — 시즌코드·마케팅
 *    문구·카테고리 접미어는 `resolveBrandName` 이 이미 아는 것들이고, 그 규칙을
 *    **그대로 재사용** 한다(사본 금지). 통과하지 못하면 `null` 이다.
 *    🟢 그래서 「Bobo Choses for Kids」 같은 꼬리표가 붙은 값도 안전하게 정리된다.
 */
export function extractSiteBrandName(html: string): SiteBrandName | null {
  const og = ogSiteName(html);
  const org = jsonLdOrganizationName(html);
  if (!og || !org) return null;
  if (!sameName(og, org)) return null;
  /** 🔴 브랜드 어휘 규칙을 통과해야 한다 — 통과 못 하면 **모른다**. */
  const resolved = resolveBrandName(og);
  const cleaned = resolved?.cleaned?.trim();
  if (!cleaned) return null;
  return { value: cleaned, evidence: "OG_SITE_NAME_AND_JSONLD_ORGANIZATION" };
}
