/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 판매처가 실제로 내려주는 응답을
 * ProductFacts로 옮기는 어댑터.
 *
 * 왜 판매처별 어댑터가 필요한가: 같은 사실이 사이트마다 다른 칸에 들어 있다.
 * 색상은 Smallable에서는 JSON-LD `color`이고 Bobo 공식몰에서는 설명문 첫 문장이다
 * ("Light heather grey sweatshirt."). 대상 연령은 Smallable에서는 breadcrumb이고
 * Bobo에서는 상품 태그다. 이 차이를 판정기(cross-seller.ts) 안에 넣으면 판정
 * 규칙이 사이트 수만큼 갈라진다 — 그래서 차이는 전부 여기서 흡수하고, 판정기는
 * 사이트를 모른다.
 *
 * 값을 지어내지 않는다는 규칙은 여기서도 같다. 원문에서 못 읽은 칸은 null이다.
 */
import {
  buildCoreTitleTokens,
  extractCodeLikeSlugSegment,
  extractFitPhrase,
  extractLabeledProductCode,
  extractLeadingColorPhrase,
  extractUrlSlug,
  parseMaterialComposition,
  type ProductFacts,
} from "@commerce/shared";
import { extractColor, extractColorFromTitle } from "../description-facts";

/** HTML 태그를 걷어내고 공백을 정리한다. Shopify description/Smallable
 * longDescription 둘 다 HTML 조각으로 온다(실측). */
function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreTokens(title: string, brand: string | null, color: string | null, material: string | null): string[] {
  const fabrics = parseMaterialComposition(material).map((c) => c.fabric).join(" ");
  return buildCoreTitleTokens(title, [brand, color, fabrics]);
}

/**
 * 브랜드 공식몰은 상품마다 브랜드명을 적지 않는다 — 가게 전체가 그 브랜드이기
 * 때문이다(실측: bobochoses.com의 `vendor` 필드에는 브랜드가 아니라 시즌코드
 * "AW26"이 들어 있고, 상품 title에도 브랜드가 없는 상품이 많다). 그래서 "이
 * 도메인은 이 브랜드의 공식몰"이라는 사실만 여기에 둔다. 추측이 아니라 관측된
 * 사실이고, 목록에 없는 도메인은 아무 브랜드도 부여하지 않는다.
 */
const OFFICIAL_STORE_BRANDS: Record<string, string> = {
  "bobochoses.com": "Bobo Choses",
};

const SEASON_CODE_ONLY_RE = /^(ss|aw|fw|pe)\d{2}$/i;

/* ───────────────────────── Shopify(브랜드 공식몰/편집샵) ───────────────────────── */

/** `/search/suggest.json`의 product 항목과 `/products/{handle}.js` 응답이 공유하는
 * 부분집합. 둘 다 실제로 이 칸들을 준다(실측) — 어느 쪽이 오든 같은 어댑터로
 * 처리하려고 optional로 둔다. */
export interface ShopifyProductLike {
  title?: string;
  handle?: string;
  url?: string;
  /** `/products/*.js`는 description, `suggest.json`은 body에 같은 HTML을 준다. */
  description?: string;
  body?: string;
  vendor?: string;
  type?: string;
  tags?: string[] | string;
  options?: { name?: string; values?: string[] }[];
  images?: string[];
  featured_image?: { url?: string } | string | null;
  image?: string | null;
}

function shopifyTags(input: ShopifyProductLike): string[] {
  if (Array.isArray(input.tags)) return input.tags;
  if (typeof input.tags === "string") return input.tags.split(/[,;]/);
  return [];
}

function shopifyImages(input: ShopifyProductLike): string[] {
  const out: string[] = [];
  for (const image of input.images ?? []) {
    if (typeof image === "string") out.push(image.startsWith("//") ? `https:${image}` : image);
  }
  const featured =
    typeof input.featured_image === "string"
      ? input.featured_image
      : (input.featured_image?.url ?? input.image ?? null);
  if (featured) out.unshift(featured.startsWith("//") ? `https:${featured}` : featured);
  return [...new Set(out)];
}

function shopifySizeLabels(input: ShopifyProductLike): string[] {
  const group = (input.options ?? []).find((o) => /size|사이즈|치수/i.test(o.name ?? ""));
  return group?.values ?? [];
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02l(CPO 지시, 2026-10-11) — **`vendor` 는 브랜드 칸이 아니다.**
 *     두 독립 출처가 «동의할 때만» 브랜드를 만든다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 fixture 전수 실측(27건 · Shopify vendor 보유분)에서 `vendor` 오염이 **5유형**
 *    으로 나왔다. 기존 가드(`SEASON_CODE_ONLY_RE`)는 ①만 잡는다:
 *
 *      ① 전체가 시즌       'AW26'                        🟢 기존 가드가 잡는다
 *      ② 시즌 섞임         'Main Story AW26'             🔴 통과
 *      ③ 프로모션          'Bobo Choses 60% Off Sale'    🔴 통과 · «시즌이 아니다»
 *      ④ 시즌 영문표기      'Misha & Puff Fall 26'        🔴 통과
 *      ⑤ 라인/카테고리어    'Pèpè Shoes' · '… Clothing'   🔴 오염인지 «불명확»
 *
 * 🔴 그래서 **regex 를 넓히는 방식은 쓰지 않는다.** ③④를 잡으려 넓히면 ⑤에 닿고,
 *    `'Pèpè Shoes'` 가 브랜드 공식명인지 오염인지 판단할 근거가 없다 — 그것이
 *    False Positive 다(CPO 경고).
 *
 * ── 🟢 실측으로 찾은 독립 evidence: title 의 「… by {BRAND}」절 ──────────────
 *
 *      junioredition(편집샵)  16/16 = 100%   ← vendor 를 «컬렉션/프로모션 라벨» 로 쓴다
 *      bobochoses(자사몰)      0/9           ← vendor 를 «시즌» 으로 쓴다
 *      main-story(자사몰)      0/2           ← vendor 를 «브랜드» 로 쓴다
 *
 *    🟢 **정확히 상보적이다.** by절이 있는 곳은 vendor 가 오염돼 있고, by절이 없는
 *       곳은 기존 가드/도메인 매핑이 담당한다.
 *
 * ── 🔴 by절을 «그대로» 쓰지 않는다 — 실측 FP 2/16 ──────────────────────────
 *
 *      'Bobo Choses - Last One In Stock - 6 Months'   ← 재고/사이즈 라벨이 붙는다
 *      'PèPè - Last Ones In Stock - 28-29 EUR'
 *
 *    그래서 **vendor 와 by절의 «공통 토큰 접두사»** 만 채택한다. 둘이 서로를
 *    교정하고, 동의하지 않으면 `null` 이다.
 *
 * 🟢 실측 검증: junioredition 16/16 정답. FP 대조군도 안전하다 —
 *      by절 없음                → null  (기존 경로로 내려간다)
 *      'Mini-La-Mode'          → 보존   (토큰 단위라 하이픈이 깎이지 않는다)
 *      by절이 브랜드가 아님      → null
 *      완전히 다른 값            → null
 *
 * 🔴 **추가 전용이다.** 이 함수가 null 을 주면 아래 분기는 예전과 «똑같이»
 *    동작한다. 기존 가드와 도메인 매핑을 지우지 않았다.
 * 🔴 표기 차이(`Pèpè` ↔ `PèPè`)는 downstream 이 흡수한다(brand-alias 의
 *    normalizeBrand 가 NFKD+소문자로 비교한다) — 여기서 통일하지 않는다.
 */
const TITLE_BY_CLAUSE_RE = /\bby\s+(.+?)\s*$/i;

/** 🔴 비교 전용 정규화. 값을 바꾸지 않는다 — 채택하는 것은 원문 토큰이다. */
function normalizeBrandToken(token: string): string {
  return token.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function brandFromTitleByClause(title: string, vendor: string | undefined): string | null {
  const by = TITLE_BY_CLAUSE_RE.exec(title)?.[1]?.trim();
  if (!by || !vendor) return null;
  const byTokens = by.split(/\s+/).filter(Boolean);
  const vendorTokens = vendor.trim().split(/\s+/).filter(Boolean);
  const agreed: string[] = [];
  for (let i = 0; i < Math.min(byTokens.length, vendorTokens.length); i += 1) {
    if (normalizeBrandToken(byTokens[i]) !== normalizeBrandToken(vendorTokens[i])) break;
    // 🔴 by절 표기를 채택한다 — 그것이 «상품 페이지» 가 말하는 브랜드다.
    agreed.push(byTokens[i]);
  }
  return agreed.length > 0 ? agreed.join(" ") : null;
}

export function productFactsFromShopifyProduct(input: ShopifyProductLike, domain: string): ProductFacts {
  const title = input.title ?? "";
  const description = plainText(input.description ?? input.body);
  const url = input.url?.startsWith("http")
    ? input.url
    : `https://${domain}${input.url ?? (input.handle ? `/products/${input.handle}` : "")}`;
  const slug = input.handle ? input.handle.toLowerCase() : extractUrlSlug(url);

  // vendor가 시즌코드인 스토어가 실제로 있다(bobochoses.com). 시즌코드를 브랜드로
  // 쓰면 "AW26 ↔ Bobo Choses" 브랜드 불일치가 되어 진짜 동일상품이 깎인다.
  const vendor = input.vendor?.trim();
  /**
   * 🔴 MI-P0-02l — Brand Evidence Priority. 근거는 `brandFromTitleByClause` 주석
   *    (fixture 27건 전수 실측 · vendor 오염 5유형 · by절 상보성 · FP 대조군).
   *
   *      ① title by절 ∩ vendor   두 독립 출처가 «동의» 할 때만 (편집샵 16/16)
   *      ② 검증된 vendor          시즌코드 전체가 아닐 때      (자사몰 main-story)
   *      ③ 공식몰 도메인 매핑      vendor 가 시즌일 때          (자사몰 bobochoses)
   *      ④ null                  지어내지 않는다
   *
   * 🔴 ①이 null 이면 ②③은 **예전과 똑같이** 동작한다 — 추가 전용이다.
   */
  const brand =
    brandFromTitleByClause(title, vendor) ??
    (vendor && !SEASON_CODE_ONLY_RE.test(vendor) ? vendor : (OFFICIAL_STORE_BRANDS[domain] ?? null));

  // 색상은 설명문 첫 문장에 그대로 나온다(실측: "Light heather grey sweatshirt.").
  // 수식어가 둘 붙는 표기까지 읽는 extractLeadingColorPhrase를 먼저 쓰고, 그래도
  // 없으면 기존 추출기(라벨형 "Colour - Green" / 제목 안 색 단어)로 내려간다.
  const color =
    extractLeadingColorPhrase(description) ?? extractColor(description) ?? extractColorFromTitle(title) ?? null;
  const material = parseMaterialComposition(description).length > 0 ? description : null;

  return {
    sourceUrl: url,
    urlSlug: slug,
    brand,
    // 브랜드 품번은 설명문 라벨 → URL 앞머리 순으로만 읽는다. 실측상 Bobo 공식몰
    // suggest 응답 본문에는 품번이 없고 handle에만 있다(`b226ac114-…`).
    brandModelCode: extractLabeledProductCode(description) ?? extractCodeLikeSlugSegment(slug),
    sellerSku: null,
    title,
    coreTitleTokens: coreTokens(title, brand, color, material),
    categoryText: input.type?.trim() || null,
    colorText: color,
    materialText: material,
    fitText: extractFitPhrase(description),
    ageRangeText: null,
    sizeLabels: shopifySizeLabels(input),
    audienceSignals: [...shopifyTags(input), ...(input.type ? [input.type] : [])],
    imageUrls: shopifyImages(input),
  };
}

/* ─────────────────── 검색 목록만 주는 편집샵(국내 Cafe24/MakeShop · Childrensalon) ─────────────────── */

/**
 * MI-MATCHING-3.0(CEO 지시, 2026-09-14) — 검색 결과 **목록**에서 읽은 사실을
 * 그대로 ProductFacts로 옮긴다.
 *
 * ── 무엇이 빠져 있었나(실측) ────────────────────────────────────────────────
 * 국내 파서 5개(looxloo/rulii/deuxbebe/chocoel/foretforet)와 childrensalon은
 * 목록에서 브랜드·이미지·판매처 상품코드를 **이미 읽고 있었다**. 그런데 그 값을
 * `ComparisonCandidate.brand` / `.imageUrl` / `.sku` 에만 담았고, 판정기
 * (compareCrossSellerProducts)는 그 세 칸을 보지 않는다 — `facts`만 본다.
 * 그래서 match.ts의 `query.facts && c.facts` 관문이 언제나 거짓이 되고,
 * 국내 후보 전부가 `crossSellerVerdict = undefined`(판정 미실행)로 남았다.
 * 데이터가 없어서가 아니라 **담는 칸이 비어 있어서**였다.
 *
 * ── 판매처 상품코드를 brandModelCode에 넣지 않는다 ──────────────────────────
 * 포레포레 `BB26KSSSTC045041`, LOOXLOO `75A7D-415-16`은 그 판매처(또는 국내
 * 유통사)가 붙인 번호이지 브랜드 품번이 아니다(실측). 이 값을 brandModelCode에
 * 넣으면 compareModelCode가 접두사부터 갈라져 "모델코드 충돌"을 지어내고,
 * slugCarriesCode가 우연히 걸리면 반대로 근거 없는 SAME이 만들어진다. 그래서
 * 언제나 sellerSku 칸에만 둔다 — ProductFacts.brandModelCode 주석의 규칙 그대로다.
 *
 * ── 목록에 없는 것은 지어내지 않는다 ────────────────────────────────────────
 * 판매처 자신의 분류·소재·핏·사이즈는 **상세 페이지에만** 있고 목록에는 없다
 * (실측). 그래서 여기서는 null/빈 배열이고, 판정기는 그것을 "다름"이 아니라
 * "근거 없음"으로 읽는다. 색상은 기존 추출기(extractColorFromTitle)를 그대로
 * 쓴다 — 한국어 색상 표기("헤더그레이")는 이 추출기가 읽지 못하며, 그 사실을
 * 여기서 어휘를 새로 심어 덮지 않는다(별도 판단 대상).
 */
export interface ListingProductLike {
  title: string;
  url: string;
  /** 목록 마크업에 브랜드 칸이 있는 판매처만 채워진다. */
  brand?: string | null;
  /** 판매처 자신의 상품코드/재고번호. 브랜드 품번이 아니다. */
  sellerSku?: string | null;
  imageUrl?: string | null;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AC — **상세 경로가 쓰는 세 칸.** 목록 경로는 넘기지 않는다
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 위 「목록에 없는 것은 지어내지 않는다」는 **그대로 유효** 하다 — 검색 «목록»
   *    파서는 이 셋을 **안 넘긴다**(undefined ⟹ 기존 null/[] 동작 그대로).
   * 🟢 넘기는 쪽은 **상세 페이지를 받은 경로 하나** 다 —
   *    `factsFromProductUrl` 의 `PLAIN_HTML` 분기(product-url-facts.ts).
   *
   * 🔴🔴 **왜 필요한가**(CORE-2AB 실측): 같은 MI 가 경로에 따라 **다른 수의 축** 을 봤다.
   * ```
   * SHOPIFY_JSON  body_html → description → materialText · type → categoryText/audienceSignals
   * PLAIN_HTML    HTML 은 받았는데 **이 함수에 들어오지 않아** 일곱 칸이 null/[] 였다
   * ```
   * 🟢 그래서 이 WU 는 **새 규칙을 만들지 않고** Shopify 가 쓰는 **같은 의미** 를 쓴다.
   * 🔴 CPO 가 범위를 **세 칸** 으로 고정했다(2026-10-25) —
   *    `materialText` · `categoryText` · `audienceSignals`.
   * 🔴 `brandModelCode` 는 **이번에 채우지 않는다**(seller SKU 오염 이력 · CORE-2K ·
   *    MODEL_CODE conflict 정책과 직결). `fitText`·`sizeLabels`·`ageRangeText` 도 범위 밖이다.
   * 🔴 `coreTitleTokens` 의 4번째 인자(material)도 **바꾸지 않는다** — 그것을 바꾸면
   *    제목 토큰이 움직여 `NO_TITLE_OVERLAP`/TITLE 축이 같이 흔들린다(네 번째 칸이다).
   */
  /**
   * 🟢 Shopify 의 `type`(product_type)과 **같은 자리** — 페이지가 스스로 적은 분류다.
   *
   * 🔴🔴🔴 **`materialText` 는 «이 WU 에서 채우지 않는다» — 실측으로 순손실이다**
   * ```
   * 원상품     "… Organic Cotton 100% …"  → parseMaterialComposition ⟹ [organic cotton:100]
   * m.luxboy   "Outer & Lining : 100% Cotton" → ⟹ [cotton:100]
   * ⟹ 🔴 **MATERIAL blocker 가 생긴다** — 「organic cotton ↔ cotton」을 다른 소재로 읽는다.
   *    둘 다 면 100% 이고 CEO 는 그 후보를 **SAME** 이라 했다 ⟹ **거짓 충돌** 이다
   * stockmann  "100% puuvill"(에스토니아어) → ⟹ **[]**(어휘에 없다) ⟹ 축 0
   * ```
   * 🟢 측정 결과 — 소재 칸은 **새 축 0 · 거짓 blocker 1** 이었다(CEO SAME 후보에).
   * 🔴 그래서 넣지 않았다. 고치는 길은 **소재 어휘 정규화**(`organic cotton ≡ cotton`)이고
   *    그것은 `compareMaterial` 축 변경이라 **CPO 판정 사안** 이다(이 WU 금지 범위).
   */
  category?: string | null;
}

export function productFactsFromListing(input: ListingProductLike): ProductFacts {
  const brand = input.brand?.trim() || null;
  const color = extractColorFromTitle(input.title) ?? null;
  const category = input.category?.trim() || null;
  return {
    sourceUrl: input.url,
    urlSlug: extractUrlSlug(input.url),
    brand,
    /** 🔴 CORE-2AC 범위 밖 — 품번은 여전히 **채우지 않는다**(CPO §3). */
    brandModelCode: null,
    sellerSku: input.sellerSku?.trim() || null,
    title: input.title,
    /** 🔴 4번째 인자를 `material` 로 바꾸지 않는다 — CPO 가 고정한 세 칸 밖이다. */
    coreTitleTokens: coreTokens(input.title, brand, color, null),
    categoryText: category,
    colorText: color,
    /** 🔴 CORE-2AC — 위 주석의 실측(거짓 MATERIAL blocker)으로 **채우지 않는다**. */
    materialText: null,
    fitText: null,
    ageRangeText: null,
    sizeLabels: [],
    /**
     * 🟢 Shopify 와 **같은 구성** — 그쪽은 `[...tags, ...(type ? [type] : [])]` 이고
     *    PLAIN_HTML 에는 tags 가 없으므로 **분류 하나** 다. 🔴 지어내지 않는다.
     */
    audienceSignals: category ? [category] : [],
    imageUrls: input.imageUrl ? [input.imageUrl] : [],
  };
}

/* ───────────────────────────────── Smallable ───────────────────────────────── */

/**
 * smallable.com 상품 페이지에서 사실을 읽는다.
 *
 * 가격 관측기(smallable-market-probe.ts)와 목적이 다르다 — 저쪽은 "요청한 배송
 * 국가의 금액"만 보고, 여기는 "이 상품이 무엇인가"를 본다. 두 관심사를 한 파서에
 * 합치면 한쪽 사정으로 다른 쪽이 깨진다.
 *
 * 읽는 자리(전부 실측 확인, 2026-09-13):
 *  · JSON-LD Product — name / description / brand.name / model / sku / color
 *  · JSON-LD BreadcrumbList — "Fashion  Children" / "Boy" / "Sweatshirts"
 *    (대상 연령과 상품군이 여기 있다. 제목에는 없다.)
 *  · 페이지에 내장된 declinations 배열 — `{"sku":"AAA1804922","size":"4/5 years"}`
 *    (사이즈 체계를 아는 유일한 자리다.)
 */
const LD_JSON_SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const DECLINATIONS_BLOCK_RE = /declinations\\?":\s*\[([\s\S]*?)\]/;
const DECLINATION_SIZE_RE = /size\\?":\\?"([^"\\]{1,24})/g;

function parseLdJsonNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(LD_JSON_SCRIPT_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && typeof node === "object") nodes.push(node as Record<string, unknown>);
      }
    } catch {
      // 깨진 블록 하나 때문에 나머지를 버리지 않는다(market-probe와 같은 원칙).
    }
  }
  return nodes;
}

function hasType(node: Record<string, unknown>, type: string): boolean {
  const value = node["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/**
 * Product 노드는 최상위에 있을 때도 있고 ProductGroup 안에 들어 있을 때도 있다 —
 * 같은 사이트에서 둘 다 실제로 관측된다(실측: 색상 변형이 있는 상품은
 * `ProductGroup.hasVariant[]`, 변형이 없으면 최상위 `Product`). 최상위만 보면
 * 색상 변형이 있는 상품은 통째로 "읽을 게 없음"이 되고, 그게 시장 관측기가
 * 이미 겪어서 collectProductNodes로 고쳐 둔 문제다. 같은 방식으로 훑는다.
 */
function collectProductNodes(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const child of node) collectProductNodes(child, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  const obj = node as Record<string, unknown>;
  if (hasType(obj, "Product")) found.push(obj);
  for (const key of ["@graph", "hasVariant", "isVariantOf", "itemListElement"]) {
    if (obj[key] !== undefined) collectProductNodes(obj[key], found);
  }
  return found;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractSmallableSizeLabels(html: string): string[] {
  const block = DECLINATIONS_BLOCK_RE.exec(html);
  if (!block) return [];
  const sizes = [...block[1].matchAll(DECLINATION_SIZE_RE)].map((m) => m[1]);
  return [...new Set(sizes)];
}

/** breadcrumb의 마지막 항목은 상품명 자체다(실측) — 상품명은 이미 title로 세고
 * 있으므로 카테고리 신호에서는 뺀다. */
export function extractSmallableBreadcrumb(html: string): string[] {
  for (const node of parseLdJsonNodes(html)) {
    if (!hasType(node, "BreadcrumbList")) continue;
    const items = node.itemListElement;
    if (!Array.isArray(items)) continue;
    const names = items
      .map((item) => readString((item as Record<string, unknown>)?.name))
      .filter((name): name is string => name !== null);
    return names.slice(0, Math.max(0, names.length - 1));
  }
  return [];
}

/**
 * productId를 주면 **그 상품의** 노드만 읽는다. smallable 페이지에는 형제 색상
 * 변형이 같이 실려 있어서(실측: 430651 페이지에 430650 링크가 함께 있다) 아무
 * Product 노드나 집으면 다른 색의 사실을 이 상품의 사실로 적게 된다. 시장
 * 관측기가 이미 같은 이유로 model 대조를 하고 있고, 같은 근거를 여기서도 쓴다.
 */
export function productFactsFromSmallableHtml(html: string, productId?: string): ProductFacts | null {
  const products = parseLdJsonNodes(html).flatMap((node) => collectProductNodes(node));
  const product = productId
    ? products.find((node) => String(node.model ?? "").trim() === productId)
    : products.find((node) => node.offers !== undefined);
  if (!product) return null;

  const title = readString(product.name) ?? "";
  const description = plainText(readString(product.description));
  const brand = readString((product.brand as Record<string, unknown>)?.name);
  const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as
    | Record<string, unknown>
    | undefined;
  const sourceUrl = readString(offers?.url) ?? "";
  const color = readString(product.color);
  const material = parseMaterialComposition(description).length > 0 ? description : null;
  const breadcrumb = extractSmallableBreadcrumb(html);

  return {
    sourceUrl,
    urlSlug: extractUrlSlug(sourceUrl),
    brand,
    // Smallable 페이지 어디에도 브랜드 품번이 없다(실측). sku(AAA…)와 model(430701)은
    // 둘 다 Smallable 자신의 번호라 여기에 넣지 않는다 — 넣는 순간 "SKU가 다르니 다른
    // 상품"이라는 틀린 규칙이 되살아난다.
    brandModelCode: extractLabeledProductCode(description),
    sellerSku: readString(product.sku),
    title,
    coreTitleTokens: coreTokens(title, brand, color, material),
    // 마지막 한 조각(가장 구체적인 분류)을 카테고리로 쓴다. 앞 조각들은 대상
    // 연령 신호로 따로 쓴다 — 둘은 다른 질문에 답한다.
    categoryText: breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1] : null,
    colorText: color,
    materialText: material,
    fitText: extractFitPhrase(description),
    ageRangeText: null,
    sizeLabels: extractSmallableSizeLabels(html),
    audienceSignals: breadcrumb,
    imageUrls: readString(product.image)
      ? [readString(product.image)!.startsWith("//") ? `https:${readString(product.image)}` : readString(product.image)!]
      : [],
  };
}
