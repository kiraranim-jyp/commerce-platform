import { lookupBrandAlias } from "../comparison-search/brand-alias";
import { buildPrimaryQuery } from "./query-generator";
import type { ProductIdentity } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-1 — **Discovery Query Planner**(순수 · HTTP 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「AI Search 에 **하나의 질문만 던지지 않는다**」 ·
 * 「**고정된 7개 질문을 실행하는 시스템이 아니다** — 상품 정보에 따라 Query Planner 가
 * 여러 검색 질문을 구성한다」 · 「**Search 는 넓게 / MI 는 좁게**」.
 *
 * ── 🔴 이 모듈이 «하지 않는» 것 ────────────────────────────────────────────
 * ```
 * 🔴 HTTP 를 **하지 않는다**(순수 함수) — 검색 실행은 호출부의 일이다
 * 🔴 **MI 에서 import 되지 않는다** — synonym 은 **Search Query 생성에만** 쓴다
 *    (SAME 판정·threshold·title matching 에 **한 글자도** 닿지 않는다)
 * 🔴 **새 사전을 만들지 않는다** — 쓰는 자산은 둘뿐이다:
 *      ① `lookupBrandAlias`(brand → 한글 alias · `brand-alias.ts` · **기존**)
 *      ② `buildPrimaryQuery(...).tokens`(denylist 통과한 **코어 토큰** · **기존**)
 * ```
 *
 * ── 🔴🔴 만들 수 «없는» 축을 분명히 적는다 ─────────────────────────────────
 * ```
 * CPO 예시의 「허그 헤어리 몬스터」같은 **디자인명의 한글 음역** 은 **만들지 않는다** —
 * 그 자산이 **0** 이고(WU-165/166/167 전수 확인), 만들면 그것이 바로
 * CPO 가 FINAL-2 에서 **추가하지 않기로 한** 사전이다.
 * 🟢 대신 **브랜드만 한글** 로 바꾼 **혼합 질의** 를 만든다 —
 *      `"보보쇼즈" "Hug Hairy Monster"` · `"보보쇼즈" "B226AC009" 구매`
 *    그 조합으로도 한국 페이지가 색인에 걸린다(WU-156/161 실측: 한국 샵 제목이
 *    브랜드는 한글, 디자인명은 **영문 그대로** 인 경우가 많다 —
 *    예: `[보보쇼즈] Bigtooth Lemon T-shirt #226AC007`).
 * ```
 *
 * ── 🔴 축을 «고정 실행» 하지 않는다(CPO §5) ────────────────────────────────
 * ```
 * 품번이 없으면 품번 축을 **만들지 않는다** · 브랜드가 없으면 브랜드 축을 **만들지 않는다** ·
 * 한글 alias 가 없으면 한글 축을 **만들지 않는다** · 코어 토큰이 없으면 디자인명 축 **없음**
 * ⟹ 🟢 질의 수는 **상품이 가진 증거에 따라 달라진다**(고정 N 이 아니다)
 * ```
 */

export type DiscoveryQueryAxis =
  /** 가장 강한 식별 축 — 브랜드 + 품번 */
  | "BRAND_CODE"
  /** 같은 축의 **한글 브랜드** 판 — 한국 샵이 브랜드를 한글로 적는다 */
  | "BRAND_CODE_KO"
  /** 품번 단독 — 브랜드 표기가 흔들리는 색인을 위해 */
  | "CODE_ONLY"
  /** 브랜드 + 디자인명(코어 토큰) */
  | "BRAND_DESIGN"
  /** 한글 브랜드 + **영문** 디자인명(혼합) */
  | "BRAND_DESIGN_KO"
  /** 구매 의도 — 상품 상세/판매 페이지를 노린다 */
  | "PURCHASE_KO"
  /** 가격 의도 */
  | "PRICE_KO"
  /** 영어 판매 의도 */
  | "SHOP_EN";

export interface PlannedQuery {
  axis: DiscoveryQueryAxis;
  text: string;
}

/** 🔴 상한. 호출부가 더 좁힐 수 있다 — **늘리는 쪽은 호출부가 명시해야** 한다. */
export const DEFAULT_MAX_QUERIES = 8;

const quote = (s: string) => `"${s.trim()}"`;

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🟢🟢🟢 **운영 Discovery Query — 하나다.** `"{MODEL_CODE}"` (CPO 확정 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 품번 «단독» 인가 (SPRINT-05/06 실측) ────────────────────────────────
 * ```
 * 🔴 상품명이 들어간 **영어** 질의는 국내 결과가 «구조적으로» 0 이었다
 *    (G-Q1·Q2·Q3·Q4·Q7·Q8 · P-BRAND_DESIGN · I-3 → 🇰🇷 도메인 **0**).
 * 🔴 목적어(`exact product` · `buy`)도 그것을 바꾸지 못했다(I-1/I-2 → 🇰🇷 **1**).
 * 🟢 **품번 정확 일치만** 상품 4개 **전부** 에서 국내와 해외를 **같이** 냈다
 *    (`"{code}"` → 🇰🇷 8 도메인 + 🌎 다수 · 따옴표 없는 판은 S1·S4 에서 국내 0).
 * ```
 *
 * ── 🔴🔴 이것은 «Identity» 가 아니다 ───────────────────────────────────────
 * ```
 * Search Query `"{MODEL_CODE}"`   ≠   MODEL_CODE → SAME
 * 🔴 이 함수는 **후보를 어디서 찾을지** 만 정한다. 동일상품 판단은 Evidence/Identity
 *    층이 한다(`cross-seller` · `match-truth`). 🔴 그 둘을 연결하지 않는다.
 * ```
 *
 * 🔴 **품번이 없으면 질의를 만들지 않는다**(`null`) — 「브랜드로 대신한다」 같은
 *    **fallback 을 만들지 않는다**(CPO §7 ⑨ · 숨은 2차 Search 금지).
 * 🔴 `buildDiscoveryQuerySet`(8축)은 **그대로 둔다** — 그 함수의 소비자와 계약이 따로 있다.
 */
export function buildDiscoverySearchQuery(identity: ProductIdentity): string | null {
  const code = identity.productCode?.trim();
  if (!code) return null;
  return quote(code);
}

/**
 * 🟢 상품이 가진 증거만으로 Discovery 질의 집합을 만든다.
 *
 * 🔴 **순서가 의미를 가진다** — 앞쪽이 식별력이 높다. 호출부가 상한으로 자를 때
 *    강한 축이 먼저 살아남아야 한다.
 */
export function buildDiscoveryQuerySet(
  identity: ProductIdentity,
  options?: { max?: number },
): PlannedQuery[] {
  const max = Math.max(1, options?.max ?? DEFAULT_MAX_QUERIES);
  const brand = identity.brand?.trim() || null;
  const code = identity.productCode?.trim() || null;
  /** 🟢 기존 자산 — 한글 alias 가 **없으면 만들지 않는다**(지어내지 않는다). */
  const ko = brand ? (lookupBrandAlias(brand) ?? null) : null;

  /**
   * 🟢 기존 자산 — `buildPrimaryQuery` 가 denylist 로 색상·사이즈·시즌·마케팅을
   *    걷어낸 **코어 토큰** 을 이미 돌려준다. 🔴 그 규칙을 **복제하지 않는다**.
   * 🔴 그 함수가 품번을 쓰는 레벨(L1)이면 tokens 가 품번일 수 있으므로
   *    **품번과 같은 토큰은 디자인명에서 뺀다**(같은 근거를 두 축으로 세지 않는다).
   */
  let design = "";
  try {
    /**
     * 🔴🔴 **품번을 «빼고» 부른다.** 품번이 있으면 그 함수는 `L1_MODEL_CODE` 로 가서
     *    `tokens` 가 **[브랜드, 품번]** 이 되고 **디자인명이 안 나온다**
     *    (계약 D-4 가 1차에서 그것을 FAIL 로 잡았다).
     * 🟢 같은 입력에서 품번만 비우면 그 함수가 `L2_BRAND_NAME`/`L3_NAME_ONLY` 로 가서
     *    **denylist 통과한 코어 토큰** 을 돌려준다 ⟹ **규칙을 복제하지 않고** 재사용한다.
     */
    const primary = buildPrimaryQuery({ ...identity, productCode: null });
    const lowerCode = code?.toLowerCase() ?? "";
    const brandWords = new Set((brand ?? "").toLowerCase().split(/\s+/).filter(Boolean));
    const tokens = primary.tokens
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => t.toLowerCase() !== lowerCode)
      .filter((t) => !brandWords.has(t.toLowerCase()));
    design = tokens.slice(0, 4).join(" ");
  } catch {
    design = "";
  }

  const out: PlannedQuery[] = [];
  const push = (axis: DiscoveryQueryAxis, parts: (string | null)[]) => {
    const text = parts.filter((p): p is string => Boolean(p && p.trim())).join(" ").trim();
    if (!text) return;
    if (out.some((q) => q.text === text)) return;
    out.push({ axis, text });
  };

  if (brand && code) push("BRAND_CODE", [quote(brand), quote(code)]);
  if (ko && code) push("BRAND_CODE_KO", [quote(ko), quote(code)]);
  if (code) push("CODE_ONLY", [quote(code)]);
  if (brand && design) push("BRAND_DESIGN", [quote(brand), quote(design)]);
  if (ko && design) push("BRAND_DESIGN_KO", [quote(ko), quote(design)]);
  /** 🔴 의도 키워드는 **고정 어휘** 다(사전이 아니다) — 한국 상품 페이지를 노린다. */
  if (ko && code) push("PURCHASE_KO", [quote(ko), quote(code), "구매"]);
  if (ko && code) push("PRICE_KO", [quote(ko), quote(code), "가격"]);
  if (brand && code) push("SHOP_EN", [quote(brand), quote(code), "shop"]);

  return out.slice(0, max);
}
