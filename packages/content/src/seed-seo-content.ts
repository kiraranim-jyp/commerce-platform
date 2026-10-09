import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";
import { mockProductContentProvider } from "./providers/mock.provider";
import { mergeKeywords } from "./merge-keywords";
import { generateSeoKeywords, suggestKoreanProductName, suggestModelName } from "./seo-keywords";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 FINAL(CPO FAIL ②③, 2026-10-09) — **상품이 생기는 순간 비어 있지 않다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 판정:
 *   ② 「상품 최초 생성/Source Data 로딩 시 상세설명이 비어 있지 않도록 ·
 *       별도 `AI 자동 생성` 버튼을 눌러야만 채워지는 구조는 제거」
 *   ③ 「상품 최초 생성 시 SEO 고려 태그 자동 생성 · 기존 원본 태그가 있으면
 *       기존 + SEO · 중복 제거 · 상품과 무관한 일반 키워드 생성 금지」
 *
 * ── 🔴 왜 «여기» 인가 ────────────────────────────────────────────────────
 * 지금까지 두 값은 수집 시점에 «빈 값으로 초기화» 됐고, 채우는 경로는 셀러가
 * 버튼을 누르는 것뿐이었다. 그래서 어떤 상품을 열어도 비어 있는 것이 정상
 * 동작이었다(CEO 가 두 번 같은 결함을 봤다 — 태그·상세설명).
 *
 * 🔴 생성기를 «새로 만들지 않는다». `mockProductContentProvider` 의 그 메서드
 *    둘을 그대로 부른다 — 버튼이 부르던 그 함수다. 두 벌이면 버튼과 자동 생성이
 *    다른 글을 만든다.
 * 🔴 LLM 이 아니다. 브랜드·상품종류·색상·소재·옵션·원문을 조립하는 «결정론적
 *    템플릿» 이고, 같은 입력에 같은 결과를 낸다. URGENT ④(CPO, 2026-10-03)가
 *    「AI」 라벨을 금지한 이유가 그것이고, 그 판단은 그대로다.
 *
 * ── 🔴 덮지 않는다 ──────────────────────────────────────────────────────
 * CPO: 「기존 수정값이 있으면 자동 생성이 덮어쓰지 않음」.
 *   · `USER_EDITED` 이고 값이 있으면 손대지 않는다.
 *   · 태그는 «합친다» — 원본 태그(수집된 shopifyTags)가 앞이고 SEO 태그가 뒤다.
 *     기존을 한 개도 잃지 않는 것이 `mergeKeywords` 의 불변식이다.
 *
 * ── 🔴 없는 사실을 만들지 않는다 ────────────────────────────────────────
 * `generateKeywords` 는 브랜드·상품종류·소재에서만 태그를 만든다 — 「인기」
 * 「추천」 같은 상품 무관 키워드를 넣는 경로가 없다. 생성 결과가 비면 비운 채
 * 둔다(CPO: 상품과 무관한 일반 키워드 생성 금지).
 */

/** 값이 «셀러가 고친 것» 인가 — 그렇다면 자동 생성이 건드리지 않는다. */
function isSellerEdited<T>(field: ProvenanceField<T> | undefined, hasValue: (v: T) => boolean): boolean {
  if (!field) return false;
  return field.source === "USER_EDITED" && hasValue(field.value);
}

export interface SeedSeoContentResult {
  product: CanonicalProduct;
  /** 무엇을 채웠는가 — 호출부가 로그/화면에 쓸 수 있게. 🔴 조용히 바꾸지 않는다. */
  filled: ("descriptionKo" | "keywords" | "titleKo" | "modelName")[];
  /** 셀러 수정값이라 건드리지 않은 축. */
  skipped: ("descriptionKo" | "keywords" | "titleKo" | "modelName")[];
}

/**
 * 🔴 **순수 함수다.** 새 객체를 돌려주고 입력을 바꾸지 않는다 — 호출부가 같은
 * product 로 다른 계산을 하고 있을 수 있고, 그 둘이 갈라지면 「본 것과 저장된
 * 것」이 달라진다(preserveRegisteredValues 가 같은 이유로 복제한다).
 */
export function seedSeoContent(product: CanonicalProduct): SeedSeoContentResult {
  const filled: SeedSeoContentResult["filled"] = [];
  const skipped: SeedSeoContentResult["skipped"] = [];
  const next = { ...product };

  /* ── ② 상세설명 ──────────────────────────────────────────────────────── */
  if (isSellerEdited(product.descriptionKo, (v) => (v ?? "").trim().length > 0)) {
    skipped.push("descriptionKo");
  } else if ((product.descriptionKo?.value ?? "").trim().length === 0) {
    const generated = mockProductContentProvider.generateDescription(product);
    /* 🔴 생성기가 빈 글을 내면 넣지 않는다 — 재료(브랜드·종류·소재·원문)가
       하나도 없는 상품이 그렇다. 빈 값을 AI_GENERATED 로 적으면 화면이
       「만들었다」고 거짓을 말한다. */
    if (generated.value.trim().length > 0) {
      next.descriptionKo = generated;
      filled.push("descriptionKo");
    }
  }

  /* ── ③ 태그 ─────────────────────────────────────────────────────────── */
  if (isSellerEdited(product.keywords, (v) => (v ?? []).length > 0)) {
    skipped.push("keywords");
  } else {
    const existing = product.keywords?.value ?? [];
    /* ══ 🔴 P5.6 P0-2(CPO, 2026-10-09) — 생성기를 «바꿨다» ═══════════════════
       `generateKeywords` 는 브랜드·상품종류·소재 셋만 봤다(속성 나열).
       실측으로 성별·연령·색상이 다 잡히는 것을 확인했고, 그 축을 쓰는
       `generateSeoKeywords` 로 교체한다 — 검색 의도형 조합이다.
       🔴 없는 축은 비운다(브랜드 한글명·시즌). 지어내지 않는다. */
    const generated = generateSeoKeywords(product);
    /* 🔴 기존(원본 수집 태그)이 «앞» 이다. mergeKeywords 의 불변식 —
       기존 태그는 한 개도 잃지 않고, 중복은 한글/영문을 섞지 않고 걷는다. */
    const merged = mergeKeywords(existing, generated);
    if (merged.merged.length > existing.length) {
      next.keywords = {
        value: merged.merged,
        /* 🔴 출처를 가른다 — 원본 태그가 있었으면 ORIGINAL 을 유지한다(그 값이
           사이트에서 온 사실이라는 것이 더 중요하다). 전부 생성이면 AI_GENERATED. */
        source: existing.length > 0 ? (product.keywords?.source ?? "ORIGINAL") : "AI_GENERATED",
        confidence: existing.length > 0 ? (product.keywords?.confidence ?? 0.9) : 0.6,
      };
      filled.push("keywords");
    }
  }

  /* ── 🔴 P0-4(CPO) — 한국어 SEO 상품명 ──────────────────────────────────
     CPO: 「상품명 = 한국 소비자 검색용」. titleKo 가 비어 있으면 확인된 축으로
     조립한다.
     🔴 셀러 수정값은 덮지 않는다. 상품군을 모르면 원상품명이 그대로 들어간다
        (억지 한국어 제목을 만들지 않는다 — 그 판단은 생성기 안에 있다). */
  if (isSellerEdited(product.titleKo, (v) => (v ?? "").trim().length > 0)) {
    skipped.push("titleKo");
  } else if ((product.titleKo?.value ?? "").trim().length === 0) {
    const name = suggestKoreanProductName(product);
    if (name && name.trim()) {
      next.titleKo = { value: name.trim(), source: "AI_GENERATED", confidence: 0.7 };
      filled.push("titleKo");
    }
  }

  /* ── 🔴 D3(라이브 실측) — 모델명을 «배선» 한다 ─────────────────────────
     `suggestModelName` 을 만들어 두고 호출부에서 넘기지 않아, 실측 payload 의
     `naverShoppingSearchInfo.modelName` 이 `undefined` 였다 — 이 저장소가 네
     번째로 겪는 「인자를 만든 것과 넘기는 것은 다르다」 다.
     🔴 원상품명 그대로다(SKU·ID·URL·AI 금지 — CPO 명시). 원문이 없으면 비운다.
     🔴 셀러 수정값·상세페이지 참조를 덮지 않는다. DETAIL_PAGE_REFERENCE 는
        「참조로 채운다」는 선택이므로 그것도 건드리지 않는다. */
  const modelSource = product.modelName?.source;
  if (modelSource === "USER_EDITED" || modelSource === "DETAIL_PAGE_REFERENCE") {
    skipped.push("modelName");
  } else if ((product.modelName?.value ?? "").trim().length === 0) {
    const model = suggestModelName(product);
    if (model) {
      next.modelName = { value: model, source: "ORIGINAL", confidence: 0.8 };
      filled.push("modelName");
    }
  }

  return { product: next, filled, skipped };
}
