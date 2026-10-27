/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-06 — **PLAIN_HTML 의 Evidence 공급원**(CPO GO 2026-10-26)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 SAME 축이 아니다.** 이 파일은 **`ProductFacts.description` 한 칸의 공급원** 이고
 *    판정에 손대지 않는다 — threshold · `SAME_MIN_AXES` · `NO_TITLE_OVERLAP` · BRAND ·
 *    TITLE · COLOR · MATERIAL · FIT · CATEGORY · COMPOSITION · IMAGE scoring ·
 *    OPTION/SKU · `priceTier` · `domesticReference` — **전부 변경 0**.
 *
 * ── 🔴 왜 JSON-LD «만» 인가 (CPO ⒜ 확정 · SPRINT-05 실측) ────────────────────
 * ```
 * PLAIN_HTML facts 확보 6건 기준
 *   JSON-LD Product.description  3/6  ← 🟢 **채택**
 *   meta description             5/6  ← 🔴 **HOLD** (그중 **2건이 UNSAFE** 였다)
 *        beaumonde  「너무 짧다(9자)」      ⟹ 상품 설명이라 판정할 근거가 없다
 *        donokids   「제목과 사실상 같다」   ⟹ 새 정보 0 · title 혼입
 * ⟹ 🔴 목표는 coverage 최대화가 아니라 **신뢰 가능한 공급** 이다(CPO 문장).
 * ```
 *
 * 🔴🔴 **`@type` 이 `Product` 가 아니면 읽지 않는다.** `BreadcrumbList` ·
 *    `Organization` · `WebPage` 의 `description` 은 **그 상품의 설명이 아니다** —
 *    그것을 읽으면 「페이지 일반 설명」이 Evidence 가 된다(CPO §4 금지).
 *
 * 🔴 **추가 HTTP 0.** 호출부(`product-url-facts.ts` htmlPath)가 **이미 받아 둔** HTML 을
 *    넘긴다. 이 파일은 네트워크를 쓰지 않는다(순수 함수).
 */

/** 🔴 태그·스크립트를 걷는다. 원문 의미를 바꾸는 정규화는 하지 않는다. */
function plainText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const LD_BLOCK_RE = () => /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * HTML 의 JSON-LD 에서 **`@type === "Product"` 의 `description`** 만 읽는다.
 *
 * 🔴 **Contract 1 — Product 아니면 읽지 않는다**(위 주석).
 * 🔴 **Contract 2 — 지어내지 않는다.** 없으면 `null` 이고 다른 자리로 폴백하지 않는다
 *    (meta·og·body·breadcrumb·seller name **전부 금지**).
 * 🔴 **Contract 3 — 첫 `Product` 를 쓴다.** 여러 개면 **고르는 규칙을 만들지 않는다** —
 *    문서 순서를 따른다(사이트별 규칙 금지).
 */
export function jsonLdProductDescription(html: string | null | undefined): string | null {
  if (!html) return null;
  const blocks = html.match(LD_BLOCK_RE()) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>\s*$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /** 🔴 깨진 JSON-LD 를 추측해 고치지 않는다. */
      continue;
    }
    const found = findProductDescription(parsed);
    if (found) return found;
  }
  return null;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 CORE-IMAGE-EVIDENCE-02 — **PLAIN_HTML 의 이미지 공급원**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **고친 문제** — `C22`(donokids)는 상품 이미지가 **페이지에 있는데**
 *    `PLAIN_HTML → imageUrls = 0` 이었다(IMAGE-EVIDENCE-01 실측). 원인은
 *    htmlPath 가 `productFactsFromListing` 에 **이미지를 한 장도 넘기지 않은 것** 이다.
 *
 * 🔴 **왜 JSON-LD `Product.image` «만» 인가**(CPO §5 안전조건):
 * ```
 * ❌ `<img>` 태그 수집   C22 페이지에 img 가 **39개** 있고 그중 대다수가
 *                        **추천상품 썸네일**(`*_represent`)이다 ⟹ 다른 상품이 섞인다
 * ❌ og:image           🔴 C22 에는 **아예 없다**(실측 0건) · 그리고 og 는 페이지 대표라
 *                        상품 이미지라는 보장이 없다
 * 🟢 JSON-LD Product.image  **그 상품의 이미지라고 문서가 스스로 말한 것** 이다
 *    ⟹ favicon · logo · sprite · banner · 추천상품 · 네비게이션이 **구조적으로** 못 들어온다
 * ```
 * 🟢 실측(C22) — `["https://www.donokids.com/shopimages/DONOKIDS/0260020000082.jpg"]`
 *    HTTP **200** · `image/jpeg` · 310KB · 🟢 내용은 **C19 와 같은 Conker Stripe** 상품컷.
 *
 * 🔴 **Contract 4 — 설명문과 «같은 규칙» 이다.** `@type=Product` 아니면 읽지 않고,
 *    없으면 빈 배열이며, 다른 자리로 **폴백하지 않는다**. LD 파서는 **이 파일 하나** 다
 *    (세 벌째 JSON-LD 파서를 만들지 않는다 — `extractLabeledProductCode` 선례).
 * 🔴 **Contract 5 — 순서를 바꾸지 않는다.** 문서가 적은 순서가 곧 대표 순서다
 *    (사이트별 「대표 고르기」 규칙 금지).
 * 🔴 **Contract 6 — 추가 HTTP 0.** 이미 받아 둔 HTML 만 읽는다(순수 함수).
 */
export function jsonLdProductImages(html: string | null | undefined): string[] {
  if (!html) return [];
  const blocks = html.match(LD_BLOCK_RE()) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>\s*$/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const found = findProductImages(parsed);
    if (found.length > 0) return found;
  }
  return [];
}

/** 🔴 `image` 는 문자열 · 배열 · `ImageObject` 셋 다로 온다(schema.org). 그 셋만 읽는다. */
function readImageValue(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const v = value.trim();
    /** 🔴 http(s) 만 — `data:` 는 placeholder 인 경우가 많고 보존할 URL 이 아니다. */
    if (/^https?:\/\//i.test(v)) out.push(v);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) readImageValue(v, out);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const types = Array.isArray(obj["@type"]) ? obj["@type"].map(String) : [String(obj["@type"] ?? "")];
    if (types.includes("ImageObject")) readImageValue(obj.url ?? obj.contentUrl, out);
  }
}

function findProductImages(root: unknown): string[] {
  const stack: unknown[] = [root];
  const seen = new Set<object>();
  while (stack.length > 0) {
    const node = stack.shift();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const types = Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
    if (types.includes("Product") && obj.image !== undefined) {
      const out: string[] = [];
      readImageValue(obj.image, out);
      /** 🔴 중복 제거만 한다 — 순서는 문서 그대로(Contract 5). */
      const unique = [...new Set(out)];
      if (unique.length > 0) return unique;
    }
    for (const v of Object.values(obj)) if (v && typeof v === "object") stack.push(v);
  }
  return [];
}

function findProductDescription(root: unknown): string | null {
  const stack: unknown[] = [root];
  /** 🔴 순환 참조 보호 — 무한 루프를 만들지 않는다. */
  const seen = new Set<object>();
  while (stack.length > 0) {
    const node = stack.shift();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const types = Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
    /** 🔴 Contract 1 — 이 조건을 느슨하게 하면 페이지 설명이 Evidence 가 된다. */
    if (types.includes("Product") && typeof obj.description === "string") {
      const value = plainText(obj.description);
      if (value) return value;
    }
    for (const v of Object.values(obj)) if (v && typeof v === "object") stack.push(v);
  }
  return null;
}
