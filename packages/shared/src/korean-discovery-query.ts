/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **MLS2 STEP 2 — 식별력 있는 한글 검색어 생성**(CPO 승인 2026-11-06)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 품질 조건(원문 그대로):
 * ```
 * · 브랜드명은 브랜드 alias 를 사용한다
 * · 상품의 고유한 디자인 · 패턴 · 제품 종류를 보존한다
 * · **일반 카테고리명만 남는 번역은 검색어로 사용하지 않는다**
 * · 품번과 고유 식별 토큰은 제거하지 않는다
 * · 원본 영어 상품명도 항상 검색한다
 * · 번역된 상품명은 **후보 발견을 위한 검색어** 이며 Identity 증거로 자동 인정하지 않는다
 * 🔴🔴 「한글 상품명 생성 결과가 식별력이 낮으면 **검색하지 않는 것이 낫다**」
 * ```
 *
 * 🔴🔴🔴 **이 모듈의 핵심은 생성이 아니라 «거부» 다.** 실측으로 그렇게 정했다:
 * ```
 * 운영 스냅샷 619 — `titleKo` 빈값 **484** · 한글 포함 113
 * 🔴 그 113건의 한글 토큰이 **전부 일반 카테고리 명사** 다 —
 *    「키즈 티셔츠」 · 「바지」 · 「티셔츠」 · 「남성 셔츠」
 * 🔴 「보보쇼즈 티셔츠」로 검색하면 브랜드 **전체 카탈로그** 가 온다.
 *    저장소가 그 실패를 이미 측정했다 — 「페페」 단독 = **100건** 이고 사이트별
 *    상위 5건 제한 때문에 **목표 상품이 밀려나 못 찾는다**(골든케이스).
 * ⟹ 🔴 그래서 CPO 가 `titleKo` 직접 사용을 **철회** 했고, 이 모듈이 그 거부를 **코드로** 쥔다.
 * ```
 *
 * 🔴 **새 사전을 만들지 않는다.** 「무엇이 일반 명사인가」를 단어 목록으로 판정하면
 *    그것이 곧 번역 사전이고, 이 저장소가 반복해서 금지한 축이다
 *    (`brand-alias.ts` 「새 alias 추론/자동 번역/유사발음 생성 금지」).
 * 🟢 **대신 «고유 식별 토큰이 동반되는가» 로 판정한다** — 품번처럼 그 상품만
 *    가리키는 토큰이 같이 있으면, 한글 낱말이 일반 명사여도 질의가 좁아진다.
 *    실측 선례가 정확히 그 모양이다 — 「페페」 단독 100건 ↔ **「페페 Vernice Nero」 3건**.
 */

/** 🟢 한글이 한 글자라도 있는가. 🔴 자모 단독(ㄱ~ㅎ)은 세지 않는다. */
const HANGUL_SYLLABLE = /[가-힣]/;

export interface KoreanQueryInput {
  /** 🔴 **등록부에서 온 값만** 받는다 — 이 모듈이 alias 를 만들지 않는다. */
  brandAlias: string | null | undefined;
  /** 원상품 품번(제조사 품번 · 모델코드). 🟢 언어 중립 식별 토큰이다. */
  brandModelCode: string | null | undefined;
  /**
   * 한글 상품명 후보(있으면). 🔴 **출처를 같이 받는다** — CPO:
   * 「번역어의 출처와 신뢰도 보존」. 🔴 이 모듈이 번역을 **만들지 않는다**.
   */
  koreanTitle?: { value: string | null | undefined; source: string | null | undefined } | null;
}

export type KoreanQueryRejection =
  | "NO_BRAND_ALIAS"
  | "NO_IDENTIFYING_TOKEN"
  | "NO_KOREAN_TEXT";

export interface KoreanQueryResult {
  /** 🔴 **빈 배열이 정상 산출이다** — 식별력이 없으면 검색하지 않는다. */
  queries: string[];
  /** 🔴 왜 만들지 않았는지 적는다(조용히 0 을 돌려주지 않는다). */
  rejected: KoreanQueryRejection[];
  /** 🟢 각 질의의 출처 — CPO 「번역어의 출처와 생성 여부를 기록」. */
  provenance: Array<{ query: string; parts: string[]; koreanTitleSource: string | null }>;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **한글 질의 사다리 — 좁은 것부터**
 * ════════════════════════════════════════════════════════════════════════════
 * ```
 * ① `alias + 품번`                 🟢 가장 좁다(품번이 언어 중립 식별자다)
 * ② `alias + 한글상품명 + 품번`      🟢 한글 디자인어가 «있을 때» 만 선다
 * ```
 * 🔴 **③ `alias + 한글상품명`(품번 없음)은 만들지 않는다** — 그것이 실측으로
 *    「브랜드 전체 카탈로그」를 부르는 그 모양이고, 지금 `titleKo` 가 정확히 거기다.
 *    ⟹ `NO_IDENTIFYING_TOKEN` 으로 **거부** 한다.
 * 🔴 **alias 단독도 만들지 않는다**(같은 이유 · 「페페」 단독 100건).
 *
 * 🟢 그래서 **번역 소스가 생기면 이 함수가 그대로 받는다** — 품번과 함께 쓰이는
 *    한글 디자인명은 ②로 즉시 질의가 된다(배선 변경 0).
 */
export function buildKoreanDiscoveryQueries(input: KoreanQueryInput): KoreanQueryResult {
  const alias = input.brandAlias?.trim() ?? "";
  const code = input.brandModelCode?.trim() ?? "";
  const rejected: KoreanQueryRejection[] = [];

  if (!alias) {
    /** 🔴 미등록 브랜드는 한글 질의를 만들지 않는다(CPO A 원칙 유지 · 원문 영문 검색은 그대로). */
    return { queries: [], rejected: ["NO_BRAND_ALIAS"], provenance: [] };
  }
  if (!code) {
    /** 🔴🔴 **고유 식별 토큰이 없으면 한글 질의를 쓰지 않는다** — 이것이 이 모듈의 심장이다. */
    return { queries: [], rejected: ["NO_IDENTIFYING_TOKEN"], provenance: [] };
  }

  const queries: string[] = [];
  const provenance: KoreanQueryResult["provenance"] = [];

  const push = (parts: string[], koSource: string | null) => {
    const q = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!q || queries.includes(q)) return;
    queries.push(q);
    provenance.push({ query: q, parts, koreanTitleSource: koSource });
  };

  /** ① 🟢 alias + 품번 — 품번이 언어 중립이라 한국어 상품명 벽을 넘는다. */
  push([alias, code], null);

  /**
   * ② 한글 상품명이 **디자인어를 들고 있을 때만** 더한다.
   * 🔴 「한글이 있다」로는 부족하다 — 지금 `titleKo` 가 그 조건을 통과하면서
   *    실제로는 「키즈 티셔츠」였다. 🟢 그래서 **품번과 «같이»** 쓴다(①과 같은 안전장치).
   * 🔴 이 모듈은 그 한글 문자열을 **검증하지 않는다** — 번역 품질은 생산자 책임이고
   *    여기서 품질을 판정하면 그것이 새 번역 규칙이 된다.
   */
  const ko = input.koreanTitle?.value?.trim() ?? "";
  if (ko && HANGUL_SYLLABLE.test(ko)) {
    const koTokens = ko
      .split(/\s+/)
      .filter((w) => HANGUL_SYLLABLE.test(w))
      /** 🔴 품번이 이미 ①에 있다 — 같은 토큰을 두 번 넣지 않는다. */
      .filter((w) => w.toLowerCase() !== code.toLowerCase());
    if (koTokens.length > 0) push([alias, ...koTokens, code], input.koreanTitle?.source ?? null);
  } else if (ko) {
    rejected.push("NO_KOREAN_TEXT");
  }

  return { queries, rejected, provenance };
}
