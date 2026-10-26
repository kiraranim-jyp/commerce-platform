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
