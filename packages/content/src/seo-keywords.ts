import type { CanonicalProduct } from "@commerce/shared";
import { classifyProductType, resolveProductSignals, type AgeGroup, type Gender } from "@commerce/category";
import { KOREAN_TYPE_LABELS } from "./korean-labels";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0-2(CPO, 2026-10-09) — **검색 의도형 SEO 태그.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 판정: 지금 결과가 「상품 속성 나열」이다. 실측으로 확인했다 —
 *
 *   Sergio Tacchini · 셔츠 · shirt · 100% Polyester · Sergio Tacchini 셔츠
 *   Louis Louise    · 바지 · pants · 100% Cotton    · Louis Louise 바지
 *
 * ── 🔴 원인은 생성기가 «있는 근거를 안 썼다» 는 것이다 ───────────────────
 * 두 상품을 운영 함수로 수집해 보니 근거는 충분했다:
 *
 *   TACCHINI      소재 100% Polyester · 색상 Brilliant White · adult/men
 *   LOUIS LOUISE  소재 100% Cotton    · 색상 Pink            · baby/girl
 *
 * 그런데 `generateKeywords` 는 브랜드·상품종류·소재 셋만 봤다. **성별·연령·색상을
 * 아예 쓰지 않았다.** 그 셋을 쓰면 「남성 폴로」·「여아 바지」·「베이비 코튼 바지」가
 * 나온다 — 그것이 한국 소비자가 실제로 치는 말이다.
 *
 * ── 🔴 없는 것은 만들지 않는다(CPO 금지사항) ────────────────────────────
 *   · **브랜드 한글명** — 두 상품 모두 «데이터에 없다». `Louise Misha → 루이스미샤`
 *     같은 임의 번역을 하지 않는다. 매핑이 생기면 그때 축을 더한다.
 *   · **시즌** — 두 상품의 제목·설명·태그 어디에도 `SS26`/`AW26` 이 없었다
 *     (정규식 전수 검색 0건). `26SS` 를 지어내지 않는다. 원문에 «있을 때만» 쓴다.
 *   · 성별이 `unknown`/`unisex` 면 성별 축을 비운다. 남아를 여아로 적지 않는다.
 *   · 소재는 원문 표기 그대로 쓰고, 한국어 소재명은 **화이트리스트에 있을 때만**
 *     바꾼다(「코튼」은 cotton 이지만 「피케」를 polyester 로 바꾸지 않는다).
 *
 * ── 🔴 「검색량이 높은 키워드」라고 말하지 않는다 ────────────────────────
 * CPO 명시: 검색량 데이터가 없다. 이 파일이 만드는 것은 **검색 의도에 맞는
 * 조합** 이고, 그것을 「인기 검색어」로 포장하지 않는다. 외부 검색량 API 를
 * 붙이지 않았다(이번 범위 제한).
 */

/** 상품군의 한국어 이름. 🔴 모르면 undefined — 영문을 억지로 번역하지 않는다. */
function koreanType(product: CanonicalProduct): string | undefined {
  const ranked = classifyProductType(product);
  const top = ranked[0];
  if (!top) return undefined;
  /* ══ 🔴 실측이 정한 규칙 — «동점이면 쓰지 않는다» ════════════════════════

     부분문자열 오탐이 실제로 있다:
       "dressing"(easy dressing)  → Dress 0.6
       "hat"(that/what 안의 hat)  → Hat   0.6

     절대 문턱만 두면 그 둘을 못 가른다 —
       LOUIS LOUISE  Pants 0.97 vs Dress 0.6   ← 1위가 여유 있게 이긴다
       TACCHINI      Shirt 0.6  vs Hat   0.6   ← 동점. 어느 쪽도 믿을 수 없다

     🔴 그래서 «여유(margin)» 를 본다. 2위와 붙어 있으면 상품군을 비운다 —
        틀린 상품군으로 태그를 만드는 것이 비워 두는 것보다 나쁘다.
     🔴 2위가 없으면(후보 1개) 그 자체가 여유다. */
  const runnerUp = ranked[1];
  const margin = runnerUp ? top.confidence - runnerUp.confidence : top.confidence;
  if (margin < 0.15) return undefined;
  return KOREAN_TYPE_LABELS[top.type];
}

/** 🔴 연령은 «상품에서 확인된» 것만. unknown 은 비운다. */
const AGE_LABEL: Partial<Record<AgeGroup, string[]>> = {
  baby: ["베이비", "유아"],
  kids: ["키즈", "아동"],
  teen: ["주니어"],
};

/** 🔴 성별도 확인된 것만. unisex/unknown 은 비운다 — 「남아」를 지어내지 않는다. */
const GENDER_LABEL: Partial<Record<Gender, string[]>> = {
  girl: ["여아"],
  boy: ["남아"],
  women: ["여성"],
  men: ["남성"],
};

/**
 * 원문 소재 → 한국어 소재명. 🔴 화이트리스트에 «있을 때만» 바꾼다.
 * 실측 근거: `100% Polyester`(tennis-warehouse) · `100% Cotton`(smallable).
 */
const MATERIAL_KO: Record<string, string> = {
  cotton: "코튼",
  polyester: "폴리에스터",
  wool: "울",
  linen: "린넨",
  silk: "실크",
  denim: "데님",
  leather: "가죽",
  cashmere: "캐시미어",
  nylon: "나일론",
  corduroy: "코듀로이",
  velvet: "벨벳",
};

function koreanMaterial(raw: string): string | undefined {
  const lower = raw.toLowerCase();
  for (const [en, ko] of Object.entries(MATERIAL_KO)) {
    if (lower.includes(en)) return ko;
  }
  return undefined;
}

/**
 * 🔴 시즌은 **원문에 있을 때만**. 실측: 두 테스트 상품 모두 0건이었다.
 * 그래도 함수를 두는 이유 — Bobo Choses 류는 설명문에 `AW26` 을 적는다
 * (description-facts.ts 주석의 실측 기록). 있으면 쓰고 없으면 비운다.
 */
export function extractSeasonCode(product: CanonicalProduct): string | undefined {
  /* 🔴 `sku`·`description` 은 `backfillCanonicalProduct` 가 «채워 주지 않는» 칸이다
     — 저장된 옛 스냅샷에는 아예 없다. 무방비로 `.value` 를 읽어 터졌다(실측).
     순수 함수가 입력 모양 하나로 죽으면 그 위의 사슬 전체가 죽는다. */
  const haystack = [product.title?.value, product.description?.value, product.sku?.value]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  const m = /\b((?:SS|AW|FW)\s?\d{2})\b|\b(\d{2}\s?(?:SS|AW|FW))\b/i.exec(haystack);
  return m ? m[0].replace(/\s+/g, "").toUpperCase() : undefined;
}

export interface SeoKeywordAxes {
  brand?: string;
  koreanType?: string;
  ageLabels: string[];
  genderLabels: string[];
  materialKo?: string;
  season?: string;
}

/** 🔴 축을 «먼저» 확정한다 — 화면·테스트가 「무엇을 근거로 썼는지」 볼 수 있게. */
export function seoKeywordAxes(product: CanonicalProduct): SeoKeywordAxes {
  const brand = (product.brand?.value ?? "").trim();
  const signals = resolveProductSignals(product);
  const material = (product.material?.value ?? "").trim();
  return {
    brand: brand || undefined,
    koreanType: koreanType(product),
    ageLabels: AGE_LABEL[signals.ageGroup] ?? [],
    genderLabels: GENDER_LABEL[signals.gender] ?? [],
    materialKo: material ? koreanMaterial(material) : undefined,
    season: extractSeasonCode(product),
  };
}

/**
 * 검색 의도형 태그.
 *
 * 🔴 조합은 «둘~세 토막» 까지만 만든다. 네 토막을 넘기면 아무도 치지 않는 말이
 *    되고(「루이스미샤 베이비 여아 코튼 바지」), 그것은 키워드 나열이다.
 * 🔴 같은 뜻의 동의어를 한 축에서 둘 다 쓴다(「베이비」·「유아」) — 검색어가
 *    실제로 갈리는 말이고, 과다 생성이 아니다. 다만 **조합에는 첫 번째만** 쓴다.
 */
export function generateSeoKeywords(product: CanonicalProduct): string[] {
  const ax = seoKeywordAxes(product);
  const out: string[] = [];
  const push = (...parts: (string | undefined)[]) => {
    const tag = parts.filter((p) => p && p.trim()).join(" ").trim();
    if (tag) out.push(tag);
  };

  /* ① 단독 축 — 브랜드는 그 자체로 검색어다. */
  push(ax.brand);
  /* ⑤ 시즌은 «있을 때만» — 브랜드와 붙여야 검색어가 된다.
     🔴 이 조합은 상품군 없이도 성립한다(「Bobo Choses AW26」). 그래서 아래
        조기 반환 «앞» 에 둔다 — 처음에 뒤에 뒀다가 가드가 잡았다. */
  push(ax.brand, ax.season);
  /* 🔴 상품군을 모르면 여기서 멈춘다. 「남성」·「폴리에스터」처럼 홀로 선 축은
     검색 의도가 «없다» — 그것을 태그로 내보내는 것이 CPO 가 지적한 「속성 나열」
     바로 그것이다. 상품군이 확인될 때만 «조합» 을 만든다. */
  if (!ax.koreanType) return dedupe(out);
  /* ② 연령·성별 + 상품군 — 한국 소비자가 가장 많이 치는 모양이다. */
  for (const age of ax.ageLabels) push(age, ax.koreanType);
  for (const g of ax.genderLabels) push(g, ax.koreanType);
  /* ③ 브랜드 + (연령|성별) + 상품군 — 브랜드를 아는 구매자의 모양. */
  push(ax.brand, ax.ageLabels[0], ax.koreanType);
  push(ax.brand, ax.genderLabels[0], ax.koreanType);
  /* ④ 소재 축 — 「코튼 바지」·「베이비 코튼 바지」. */
  push(ax.materialKo, ax.koreanType);
  push(ax.ageLabels[0], ax.materialKo, ax.koreanType);

  /* 🔴 상품군만 홀로 두지 않는다(「바지」는 검색 의도가 없다) — 위 조합 안에서만
     쓰인다. 조합이 하나도 못 만들어졌으면(상품군을 모르면) 브랜드만 남는다. */
  return dedupe(out);
}

function dedupe(out: string[]): string[] {
  const seen = new Set<string>();
  return out.filter((tag) => {
    const key = tag.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0-4/5(CPO, 2026-10-09) — **상품명(한국 검색용) · 모델명(해외 원문)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「상품명 = 한국 소비자 검색용 · 모델명 = 해외 원상품 식별용」으로 역할을
 * 가른다.
 *
 * 🔴 모델명은 **원상품명 그대로** 다. SKU·상품 ID·URL·브랜드+임의번호·AI 생성
 *    전부 금지(CPO 명시). 원문이 없으면 «비워 둔다» — 직접 입력 상태다.
 *    실측 근거: `sku` 가 `STMRPWH2`·`AAA1847110` 이고 둘 다 모델명이 아니다.
 */
export function suggestModelName(product: CanonicalProduct): string | undefined {
  const original = (product.title?.value ?? "").trim();
  return original || undefined;
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  상품명 — **브랜드 + 원상품 핵심어 + 한국어 검색 보정어**
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정(2026-10-10, CEO 실화면 테스트 결과) — 전에는 속성만으로 다시
 *    조립했다. 그래서 상품 식별력이 사라졌다:
 *
 *      ❌ Sergio Tacchini 남성 폴리에스터 셔츠
 *      ✅ Sergio Tacchini Racchetto Polo 남성 셔츠
 *
 *      ❌ Louis Louise 여아 코튼 바지
 *      ✅ Louis Louise Holly Hearts Ribbed Velvet Baby Pants 여아 바지
 *
 * 🔴 **원상품명을 지우지 않는다.** 소재·색상은 «보조» 검색정보이고 모델
 *    식별자를 «대체하지 않는다». 그래서 소재는 상품명에서 빼고 태그로만 남긴다
 *    (태그 생성은 `generateSeoKeywords` 가 따로 한다).
 *
 * 🔴 CPO 지시문의 규칙은 세 토막("브랜드 + 핵심어 + 한국어 보정어")이고 LOUIS
 *    예시에는 보정어가 안 붙어 있다. **규칙을 따른다** — 예시는 「원상품명을
 *    유지한다」를 보이려는 것이고, 한국어 보정어는 규칙에 명시된 축이다.
 *    한국 소비자는 「바지」로 검색하고 영어 "Pants" 로 검색하지 않는다.
 */
export function suggestKoreanProductName(product: CanonicalProduct): string | undefined {
  const ax = seoKeywordAxes(product);
  const original = (product.title?.value ?? "").trim();
  if (!original) return undefined;

  const core = productCoreName(original, ax.brand);
  /* 🔴 상품군을 «확신하지 못하면» 보정어를 붙이지 않는다 — 틀린 상품군을 붙이면
     검색이 아니라 오분류다(koreanType 은 1·2위 차가 작으면 비어서 온다). */
  const target = ax.koreanType ? (ax.genderLabels[0] ?? ax.ageLabels[0]) : undefined;

  const parts = [ax.brand, ax.season, core, target, ax.koreanType].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  /* 폴백 — 조립할 것이 브랜드뿐이면 원문을 그대로 쓴다(빈 상품명 금지). */
  return parts.length > 1 ? parts.join(" ") : original;
}

/** 상품명에서 빼는 성별 표기 — 한국어 보정어가 그 뜻을 이미 담는다. */
const REDUNDANT_GENDER_WORDS =
  /(?:^|\s)(?:men(?:'|’)?s|women(?:'|’)?s|mens|womens|boys(?:'|’)?|girls(?:'|’)?|unisex)(?=\s|$)/gi;

/**
 * 원상품명에서 «식별 가능한 핵심어» 를 뽑는다.
 *
 * 🔴 지어내지 않는다 — 원문에서 «빼기만» 한다. 빼는 것은 셋뿐이다:
 *    ① 앞에 붙은 브랜드(중복) ② `|` 뒤의 색상/변형 꼬리 ③ 성별 표기
 *
 * 실측:
 *   "Sergio Tacchini Men's Racchetto Polo"              → "Racchetto Polo"
 *   "Holly Hearts Ribbed Velvet Baby Pants | Pale Pink" → "Holly Hearts Ribbed Velvet Baby Pants"
 */
export function productCoreName(title: string, brand: string | undefined): string {
  /* 🔴 `|` 뒤를 버린다 — Smallable 류가 색상을 그 뒤에 붙인다. 색상은 옵션이지
     상품명이 아니다. `|` 가 없으면 아무것도 버리지 않는다. */
  let core = title.split("|")[0]!.trim();

  if (brand) {
    /* 🔴 브랜드가 «앞에» 붙었을 때만 벗긴다. 가운데 있는 브랜드는 상품명의
       일부일 수 있다(예: "Nike Air" 의 Air 처럼). */
    const lower = core.toLowerCase();
    const b = brand.toLowerCase();
    if (lower.startsWith(b)) core = core.slice(brand.length).trim();
  }

  core = core.replace(REDUNDANT_GENDER_WORDS, " ").replace(/\s{2,}/g, " ").trim();
  /* 앞뒤에 남은 구분자 정리 — "- Racchetto Polo" 같은 꼴이 생긴다. */
  core = core.replace(/^[-–—·,:\s]+/, "").replace(/[-–—·,:\s]+$/, "").trim();
  return core;
}

