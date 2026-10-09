/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 재작업(CEO 실측, 2026-10-09) — **태그가 「불러오지 못한」 것이 아니었다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO: 「상품정보 → 태그(검색 키워드) 에서 태그 값을 불러오지 못함」.
 *
 * 화면 결함이 아니다. 실측으로 확인한 원인은 «수집 단계» 다 —
 *
 *   apps/admin/src/app/api/pipeline/canonical-product.ts:339
 *     keywords: { value: [], source: "ORIGINAL", confidence: 0 }
 *
 * 크롤러 결과를 CanonicalProduct 로 바꿀 때 keywords 를 **항상 빈 배열로**
 * 초기화했다. 그리고 채우는 경로는 disabled 인 「AI 콘텐츠」 탭 하나뿐이었다.
 * 즉 어떤 상품을 열어도 태그는 비어 있는 것이 «정상 동작» 이었다.
 *
 * ── 🔴 그런데 원본 태그는 «이미 수집되고 있었다» ───────────────────────────
 * `shopifyTags`(쉼표로 이어진 원문 문자열)가 `ExtractedProductData` 까지 올라와
 * canonical-product.ts:332 에서 그대로 저장된다. 다만 쓰이는 곳이 카테고리
 * 추천 신호(`product-resolver.ts:466`) 하나였고, 태그 칸은 그것을 보지 않았다.
 *
 * 🔴 그래서 이 파일은 **새 수집을 하지 않는다.** 이미 올라온 문자열을 태그
 *    목록으로 «나누기만» 한다. 네트워크 호출도, 새 파서도 없다.
 *
 * ── 🔴 지어내지 않는다 ────────────────────────────────────────────────────
 *   · 브랜드명·상품유형을 «합성해» 태그로 만들지 않는다. 그것은 생성이고,
 *     `mockProductContentProvider.generateKeywords` 가 하는 별개의 일이다.
 *     이 파일은 사이트가 «실제로 적어 둔» 값만 옮긴다.
 *   · 번역하지 않는다("children" → "아동" 금지). 검색어가 달라진다
 *     ([[merge-keywords]] 가 같은 이유로 한글/영문을 합치지 않는다).
 *   · 소문자화하지 않는다 — 표시값은 사이트 표기 그대로다. 중복 판정만
 *     `keywordDedupeKey` 가 대소문자를 무시한다(그 함수는 content 쪽에 있다).
 */

/**
 * Shopify `product.tags` 는 실측상 두 모양으로 온다 —
 *
 *   products.json      "children, Kid, SS26"        쉼표로 이어진 한 문자열
 *   일부 테마/API      ["children","Kid","SS26"]    배열
 *
 * 🔴 배열도 받는다. 한쪽 모양만 받으면 다른 사이트에서 조용히 0건이 된다.
 */
export function parseSourceKeywords(raw: string | string[] | null | undefined): string[] {
  if (raw == null) return [];
  const parts = Array.isArray(raw) ? raw : raw.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    /* 🔴 내부 공백도 한 칸으로 줄인다 — 실측 표기 흔들림("Bobo  Choses"). */
    const tag = String(part ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!tag) continue;
    /* 🔴 중복 판정만 대소문자를 무시한다. 넣는 값은 원문 표기 그대로다. */
    const key = tag.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * 🔴 태그를 «쓸 수 있는 것» 으로만 좁힌다.
 *
 * 실측으로 걸러야 하는 것이 있다 — Shopify 테마가 운영용 플래그를 태그에 섞는다
 * (`__label:new` · `yotpo-ugc` · `hidden`). 그런 값이 쿠팡 검색태그로 나가면
 * 셀러가 적은 적 없는 글자가 상품 검색에 올라간다.
 *
 * 🔴 「그럴싸한 금지어 목록」을 지어내지 않는다. 걸러내는 기준은 두 가지 «모양»
 *    뿐이다 — 콜론이 든 기계 키(`__label:new`, `type:shirt`)와 밑줄 두 개로
 *    시작하는 내부 플래그. 둘 다 사람이 검색창에 칠 수 있는 말이 아니다.
 * 🔴 모르는 값은 버리지 않고 «남긴다». 셀러가 화면에서 지울 수 있다.
 */
export function isUsableSourceKeyword(tag: string): boolean {
  const t = tag.trim();
  if (!t) return false;
  if (t.startsWith("__")) return false;
  if (t.includes(":")) return false;
  return true;
}

/** 수집 결과 → 태그 칸 초기값. 🔴 비면 빈 배열이고, 비었다고 만들어 채우지 않는다. */
export function sourceKeywords(raw: string | string[] | null | undefined): string[] {
  return parseSourceKeywords(raw).filter(isUsableSourceKeyword);
}
