import type { DiscoveryQuery, ProductIdentity, QueryId } from "./types";

/**
 * MI-DISCOVERY-LONGSPRINT-P1 §4 — Query Set 생성.
 *
 * 🔴 **사전 우선순위를 확정하지 않는다**(P1.1 §4). 여기서 하는 일은 여덟 축을
 *    «같은 규칙으로» 만드는 것뿐이고, 어느 축이 좋은지는 benchmark 가 정한다.
 *    그래서 반환 순서는 Q1..Q8 선언 순서이며 «추천 순서가 아니다».
 *
 * 🔴 **없는 칸으로 쿼리를 만들지 않는다.** 필요한 칸이 비면 그 쿼리를 건너뛴다 —
 *    빈 문자열을 넣어 「검색했는데 못 찾았다」로 만들면 SEARCH_QUERY_MISS 와
 *    「애초에 물어보지 못했다」가 같은 값이 된다.
 *
 * 🔴 상품코드 축(Q5·Q6)은 실측에서 약했다(2026-10-07: Shopify suggest 미색인 ·
 *    웹검색 상품 URL 0/10). 그래도 **빼지 않는다** — CPO 가 낮은 우선순위로
 *    «유지» 하라고 했고, 판단은 Query 별 Recall 이 한다.
 */

/** 쇼핑 의도어. 🔴 번역하거나 늘리지 않는다 — 축을 늘리면 비교가 흐려진다. */
const SHOPPING_INTENT = "buy";

interface QuerySpec {
  id: QueryId;
  axis: string;
  fields: (keyof ProductIdentity)[];
  /** 고정 접미사(쇼핑 의도어 등). 없으면 빈 배열. */
  suffix: string[];
}

const SPECS: readonly QuerySpec[] = [
  { id: "Q1", axis: "상품명", fields: ["productName"], suffix: [] },
  { id: "Q2", axis: "브랜드+상품명", fields: ["brand", "productName"], suffix: [] },
  { id: "Q3", axis: "상품명+색상", fields: ["productName", "color"], suffix: [] },
  { id: "Q4", axis: "브랜드+상품명+색상", fields: ["brand", "productName", "color"], suffix: [] },
  { id: "Q5", axis: "상품코드", fields: ["productCode"], suffix: [] },
  { id: "Q6", axis: "브랜드+상품코드", fields: ["brand", "productCode"], suffix: [] },
  { id: "Q7", axis: "상품명+쇼핑의도", fields: ["productName"], suffix: [SHOPPING_INTENT] },
  { id: "Q8", axis: "브랜드+상품명+쇼핑의도", fields: ["brand", "productName"], suffix: [SHOPPING_INTENT] },
] as const;

function readField(identity: ProductIdentity, field: keyof ProductIdentity): string | null {
  const raw = identity[field];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 🔴 반환 타입을 명시한다 — 이 저장소에서 union/optional 반환을 추론에 맡겼다가
 *    판별자가 죽은 전례가 있다.
 */
export function generateQueries(identity: ProductIdentity): DiscoveryQuery[] {
  const queries: DiscoveryQuery[] = [];
  for (const spec of SPECS) {
    const parts: string[] = [];
    const used: (keyof ProductIdentity)[] = [];
    let missing = false;
    for (const field of spec.fields) {
      const value = readField(identity, field);
      if (value === null) {
        missing = true;
        break;
      }
      parts.push(value);
      used.push(field);
    }
    // 필요한 칸이 하나라도 비면 이 축은 «질문하지 못한 것» 이다. 만들지 않는다.
    if (missing) continue;
    const text = [...parts, ...spec.suffix].join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    queries.push({ id: spec.id, axis: spec.axis, text, usedFields: used });
  }
  return queries;
}

/**
 * 「이 상품에서 «물어보지도 못한» 축」. 🔴 KPI 가 SEARCH_QUERY_MISS 와 이것을
 * 가르는 데 쓴다 — 못 물어본 축을 「검색이 실패했다」로 세면 안 된다.
 */
export function unaskedQueryIds(identity: ProductIdentity): QueryId[] {
  const asked = new Set(generateQueries(identity).map((q) => q.id));
  return SPECS.filter((s) => !asked.has(s.id)).map((s) => s.id);
}

/* ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-DISCOVERY-QUERY-014 — **Primary Query 하나** 를 만든다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 새 함수인가.** `generateQueries` 는 8축을 «전부» 열거하는 벤치마크용
 *    열거기다(SPECS 순서 그대로). 운영 pool 은 그것을 `slice(0, maxQueries)` 로
 *    잘라 썼고, 그래서 `maxQueries = 1` 일 때 **항상 `Q1 = productName` 단독** 이
 *    Primary 가 됐다 — 브랜드도 품번도 없이.
 *
 * 🔴 실측(2026-10-13 · sample 상품 N=15 · Gemini 호출 0):
 * ```
 * Primary(queries[0]) = **Q1 15/15**
 * 품번 보유 3상품 중 Primary 가 품번 query 인 것 **0**
 *   (품번 query Q5/Q6 는 5~6번째라 maxQueries=1 에서 도달 불가)
 * Primary 토큰 구성 — PRODUCT_NAME 71 · CATEGORY 13 · MATERIAL 7 ·
 *   🔴 노이즈(MARKETING 6 · COLOR 3 · SIZE 1 · PRICE 1) = 11 · IDENTIFIER 단 **1**
 * ```
 * → 🔴 식별력이 거의 없는 긴 상품명을 던지고 있었다. `generateQueries` 는
 *    **그대로 둔다**(벤치마크가 8축 전부를 쓴다) — 운영용 Primary 만 새로 만든다.
 *
 * 🔴🔴 **보장할 수 있는 것과 없는 것을 가른다**(CPO 확정):
 * ```
 * 우리가 통제한다   1 상품 = 1 API call = **1 Primary Query** = 최대 3 후보
 * 통제하지 못한다   Gemini 가 그 안에서 내부 검색어 N 개를 «자동 생성» 한다
 *                  (실측 호출당 **5.5**) — API 파라미터로 1 로 고정할 수 없다
 * → 그래서 목표는 「1회 보장」이 아니라 **N 을 최소화** 하는 것이고,
 *   실제 N 은 `groundingMetadata.webSearchQueries[]` 로 **측정** 한다.
 * ```
 */

/** 🔴 CPO STEP 3 의 제거 목록 **그대로** 다. 임의로 늘리지 않는다.
 *
 * 🔴🔴 **denylist 로 간다 — allowlist 가 아니다.** 「Holly Hearts」·「Cherry Print」·
 *    「T Bar」 같은 **고유 디자인명이 곧 식별자** 이고, allowlist 를 쓰면 그것이
 *    조용히 죽는다. 이 리포가 `NON_IDENTIFYING_PARAMS` 에서 쓴 것과 같은 원칙 —
 *    「과소 제외는 기존 동작이지만 과다 제외는 정상 후보를 죽인다」.
 *
 * 🔴 **소재(cotton/velvet/ribbed)는 제거 목록에 «없다».** CPO 예시가
 *    `Louis Louise Holly Hearts Ribbed Velvet Baby Pants` 를 좋은 형태로 들었다.
 *    내 분류기가 MATERIAL 로 세는 것과 **제거 대상은 다르다** — 섞지 않는다. */
const PRIMARY_QUERY_DROP = new Set<string>([
  // 색상
  "black", "white", "navy", "blue", "red", "pink", "green", "grey", "gray",
  "beige", "cream", "ecru", "ivory", "brown", "yellow", "purple", "orange",
  "silver", "gold", "khaki", "mustard", "burgundy", "camel", "rose", "lilac",
  "lavender", "charcoal", "nero", "bleu",
  // 사이즈
  "xs", "s", "m", "l", "xl", "xxl", "size", "one",
  // 가격/통화/할인
  "price", "krw", "usd", "eur", "gbp", "won", "discount", "sale", "off",
  // 지역/배송
  "korea", "korean", "kr", "한국", "직구", "배송", "무료배송", "global",
  "intl", "international",
  // 시즌
  "season", "ss", "fw", "aw",
  // 마케팅
  "new", "best", "hot", "limited", "exclusive", "last", "ones", "stock",
  "official", "buy", "shop", "free", "shipping", "collection",
]);

/** 🔴 연도 토큰(2026 · 26fw · aw26 …). 시즌 표기는 상품 식별자가 아니다. */
const SEASON_YEAR = /^(19|20)\d{2}$|^\d{2}(ss|fw|aw)$|^(ss|fw|aw)\d{2}$/i;

/** 🔴 CPO STEP 2 — 코어 토큰 상한. 「무작정 토큰을 늘리는 것은 금지」다.
 *     Level 2 는 `[Brand] [Core 2~4 tokens]` 이므로 4 로 둔다. */
const MAX_CORE_TOKENS = 4;

export type PrimaryQueryLevel = "L1_MODEL_CODE" | "L2_BRAND_NAME" | "L3_NAME_ONLY" | "UNAVAILABLE";

export interface PrimaryQuery {
  /** Gemini 에 보낼 **단 하나의** 검색어. `UNAVAILABLE` 이면 빈 문자열이다. */
  text: string;
  level: PrimaryQueryLevel;
  tokens: string[];
  /** 🔴 무엇을 왜 버렸는지 남긴다 — 「조용한 제거」를 만들지 않는다. */
  dropped: { token: string; reason: "DENYLIST" | "SEASON_YEAR" | "OVER_CAP" | "DUPLICATE" }[];
}

const normalize = (raw: string): string[] =>
  raw
    .replace(/[|/()[\]{}·,]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * 🔴 **식별력 우선 · 길이 아님**(CPO STEP 4).
 *    `Bobo Choses B226AC114` 가 `Bobo Choses kids blue cotton sweatshirt 2026 sale`
 *    보다 강하다.
 *
 * Level 1  브랜드 + 품번            → 그 둘만. 색상·사이즈·마케팅을 붙이지 않는다
 * Level 2  브랜드 + 코어 2~4 토큰   → denylist 로 노이즈만 제거(디자인명은 보존)
 * Level 3  코어 토큰만              → 브랜드가 없을 때
 * UNAVAILABLE  만들 수 없으면 **빈 값** 이다 — 지어내지 않는다
 */
export function buildPrimaryQuery(identity: ProductIdentity): PrimaryQuery {
  const brand = readField(identity, "brand");
  const code = readField(identity, "productCode");
  const dropped: PrimaryQuery["dropped"] = [];

  /** ── Level 1 — 품번이 있으면 그것이 가장 강하다 ───────────────── */
  if (brand && code) {
    const tokens = [...normalize(brand), ...normalize(code)];
    return { text: tokens.join(" "), level: "L1_MODEL_CODE", tokens, dropped };
  }

  /** ── Level 2/3 — 코어 상품명에서 노이즈만 뺀다 ────────────────── */
  const name = readField(identity, "productName");
  const brandTokens = brand ? normalize(brand).map((t) => t.toLowerCase()) : [];
  const core: string[] = [];
  const seen = new Set<string>(brandTokens);
  for (const token of normalize(name ?? "")) {
    const low = token.toLowerCase();
    if (PRIMARY_QUERY_DROP.has(low)) { dropped.push({ token, reason: "DENYLIST" }); continue; }
    if (SEASON_YEAR.test(low)) { dropped.push({ token, reason: "SEASON_YEAR" }); continue; }
    /** 🔴 브랜드가 상품명에 또 들어 있으면 중복이다 — 같은 근거를 두 번 세지 않는다. */
    if (seen.has(low)) { dropped.push({ token, reason: "DUPLICATE" }); continue; }
    if (core.length >= MAX_CORE_TOKENS) { dropped.push({ token, reason: "OVER_CAP" }); continue; }
    seen.add(low);
    core.push(token);
  }

  if (brand && core.length > 0) {
    const tokens = [...normalize(brand), ...core];
    return { text: tokens.join(" "), level: "L2_BRAND_NAME", tokens, dropped };
  }
  if (core.length > 0) {
    return { text: core.join(" "), level: "L3_NAME_ONLY", tokens: core, dropped };
  }
  /** 🔴 브랜드만 있으면 그것은 상품 검색어가 아니다 — 브랜드 메인 페이지만 나온다. */
  return { text: "", level: "UNAVAILABLE", tokens: [], dropped };
}
