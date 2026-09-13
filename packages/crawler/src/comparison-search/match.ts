import { compareCrossSellerProducts } from "./cross-seller";
import type { ComparisonCandidate, ComparisonQuery } from "./types";
import { normalizeMatchingTitle } from "./title-normalize";

const STOPWORDS = new Set(["the", "a", "an", "for", "and", "with", "by", "in", "of"]);

/** 발음기호(é/è/ê 등)를 제거하고 소문자로 통일한다 — "PèPè"/"Pepe"/"PEPE"가 전부
 * 같은 문자열로 비교되도록 한다. 이게 없으면 기존 정규식 토크나이저가 억양부호를
 * "분리 문자"로 취급해서 "pèpè"(NFC, è가 단일 코드포인트)는 "p"/"p"(둘 다 1글자라
 * 필터링됨)로, "pèpè"(NFD, e+결합 억양부호)는 "pe"/"pe"로 쪼개져 — 같은 브랜드인데
 * 유니코드 정규화 형태에 따라 토큰화 결과가 달라지는 버그가 있었다(60% confidence 원인). */
const COMBINING_DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * MATCHING-2.0-CORE(2026-09-13) — 이 파일의 normalizeText/tokenize는
 * packages/shared의 normalizeFactText/tokenizeFactText와 거의 같지만 **의도적으로
 * 합치지 않았다**.
 *
 * 둘은 한글을 다르게 다룬다. 여기 것은 NFKD로 분해된 자모를 구분자로 취급해서
 * 한글 낱말을 통째로 버리고, 저쪽 것은 자모 범위를 살린 뒤 NFC로 되돌린다.
 * 저쪽 동작이 옳지만, 이 함수는 지금 **운영 중인 confidence 점수**의 입력이다 —
 * 여기를 바꾸면 오늘 잘 맞고 있는 매칭들의 점수가 한꺼번에 움직인다. 이번 변경의
 * 조건이 "기존 매칭을 건드리지 않는다"였으므로, 새 판정 계층만 새 자를 쓰고 이
 * 계층은 쓰던 자를 그대로 쓴다.
 *
 * 합칠 때는 점수 이동 폭을 실측한 뒤에 따로 해야 한다.
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 제목에서 브랜드로 추정되는 단어를 제거한다 — 브랜드 일치는 별도 신호(brandSignal)로
 * 이미 반영하므로, 모델명 비교에서 브랜드 단어가 중복으로 union을 부풀리지 않게 한다. */
function stripBrandWords(text: string, brand: string | undefined): string {
  if (!brand) return text;
  const brandNorm = normalizeText(brand);
  if (!brandNorm) return text;
  const pattern = brandNorm.split(/\s+/).filter(Boolean).join("\\s+");
  if (!pattern) return text;
  return text.replace(new RegExp(pattern, "gi"), " ");
}

/** "{모델명} in {색상} by {브랜드}" 형태(Junior Edition 등)에서 모델명/색상을 분리한다.
 * 패턴이 없으면(예: Childrensalon처럼 다른 제목 형식) 전체 텍스트를 모델명으로,
 * 색상은 "정보 없음"으로 돌려준다 — 추론하지 않는다. */
export function splitModelColor(title: string): { model: string; color: string | null } {
  const byMatch = /\bby\b/i.exec(title);
  const withoutBrandSuffix = byMatch ? title.slice(0, byMatch.index) : title;
  const inMatch = /\bin\b/i.exec(withoutBrandSuffix);
  if (inMatch) {
    const model = withoutBrandSuffix.slice(0, inMatch.index).trim();
    const color = withoutBrandSuffix.slice(inMatch.index + inMatch[0].length).trim();
    if (model && color) return { model, color };
  }
  return { model: withoutBrandSuffix.trim(), color: null };
}

/** URL의 마지막 경로 세그먼트("슬러그")를 뽑는다 — Shopify(`/products/handle`)와
 * Childrensalon(`/{slug}.html`) 둘 다 이 방식으로 동작한다. */
function extractSlug(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? normalizeText(last.replace(/\.html$/i, "")) : null;
  } catch {
    return null;
  }
}

function brandsMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * N-4.18-I STEP I-1(대표님 지시, 2026-08-25) — 실측 결과: RULII/LOOXLOO/DEUXBEBE
 * 3곳 모두 실제 breadcrumb/category 마크업이 존재는 하지만("xans-product-
 * headcategory", 실측 확인) 값 자체가 상품유형(PANTS/TOP 등)이 아니라
 * 프로모션성/브랜드성 분류였다 — 실측 예: RULII는 breadcrumb 자체가 없음(메뉴만
 * 있고 링크가 비어있음), LOOXLOO는 "아울렛"(할인전용관)/"래핑차일드"(브랜드
 * 하위계열), DEUXBEBE는 "Brand > karisako 카리사코"(브랜드 트리). 이 값들을
 * "카테고리 신호"로 쓰면 브랜드 신호와 중복되거나(같은 정보를 두 번 세는 꼴) 완전히
 * 무관한 프로모션 구획을 "카테고리 불일치"로 오판하게 된다 — 대표님이 금지한
 * "추측 기반 신호"가 되어버린다.
 *
 * 대신 실제 관측된 제목 텍스트에 등장하는 상품유형 단어(대표님이 STEP I-3에서
 * 직접 예시로 준 pants/trousers/바지/팬츠/shirt/shirts/셔츠/blouse, + 이번
 * 실측에서 RULII/LOOXLOO/DEUXBEBE 실제 제목에 그대로 등장한 단어: "청바지"(RULII
 * AE099), "원피스"(LOOXLOO 다수), "셔츠"(DEUXBEBE "로히트 셔츠"))만으로 최소
 * taxonomy를 만든다 — breadcrumb가 아니라 상품명 자체에 실제로 쓰인 단어이므로
 * 추측이 아니다. 매핑에 없는 단어는 전부 null(정보 없음) — 감점하지 않는다. */
export type CategoryTaxon = "TOP" | "PANTS" | "DRESS" | "SKIRT" | "OUTER" | "ONE_PIECE" | "ACCESSORY" | "SHOES";

// N-4.18-Q3 PART G-16(대표님 실측 골든케이스, 2026-08-27) — SHOES는 두 실제
// 제목에서 그대로 관측된 단어만 등록한다(junioredition "Lulu T Bar Shoes...",
// FORETFORET "...T-스트랩 슈즈..." — 둘 다 이 세션 실측으로 직접 확인). breadcrumb나
// 번역사전이 아니라 위 TOP/PANTS/DRESS와 동일한 원칙(제목에 실제로 쓰인 단어).
// MI-MATCH-FIX-2(CPO 지시, 2026-09-10) — 감사 23쌍에서 17쌍(74%)이 이 목록에
// 없는 단어라 카테고리 신호가 아예 발화하지 않았다. 추출 로직과 감점 크기는
// 정상이었고 어휘만 부족했다. 그래서 **그 감사에서 실제 제목에 등장한 단어만**
// 추가한다 — 번역사전을 만들지 않는다는 기존 원칙 그대로다.
//
// taxon 신설은 기존 4종에 명백히 안 들어가는 것으로 제한했다. 양말/장갑은
// SHOES(신발)와 다른 상품이고, 원피스형(onesie)·스커트·아우터도 상의/하의/
// 드레스 어디에도 속하지 않는다. 반면 sweater/tee/hoodie는 전부 TOP에 넣는다 —
// 해외와 국내가 같은 상품을 맨투맨/스웨트셔츠/티셔츠로 다르게 부르는 일이
// 흔해서, 세분화하면 진짜 동일상품을 오히려 떨어뜨린다(CPO 지시로 보류).
//
// 처음에는 coat/코트/재킷/romper/맨투맨처럼 "있을 법한" 단어까지 넣었다가 전부
// 뺐다. 이 매칭은 형태소 분석 없이 정규화 문자열의 부분포함만 보는데, normalizeText가
// NFKD로 한글을 자모 분해하기 때문에 "코트"가 **"타이니코튼"(Tinycottons)의 부분
// 문자열이 된다**. 실측에서 브랜드명 때문에 양말·반바지가 OUTER로 잡혔다 — 점수는
// 좋아졌지만 틀린 이유로 좋아진 것이라 되돌렸다. 관측되지 않은 단어는 넣지 않는다.
//
// shorts도 뺐다. 감사 제목에 실제로 있던 표기는 "Flamingos short"(단수)인데,
// "short"를 넣으면 "short sleeve" 같은 흔한 표현이 전부 PANTS가 된다. 그 결과
// jeans↔shorts는 카테고리로 구분하지 못하는데, 이는 CPO가 명시적으로 수용했다.
const CATEGORY_TAXON_WORDS: Record<CategoryTaxon, string[]> = {
  TOP: ["shirt", "shirts", "blouse", "sweater", "티셔츠", "셔츠", "후드"],
  PANTS: ["pants", "trousers", "jeans", "바지", "팬츠", "청바지"],
  DRESS: ["dress", "원피스"],
  SKIRT: ["skirt", "스커트"],
  OUTER: ["jacket", "자켓", "패딩"],
  ONE_PIECE: ["onesie"],
  ACCESSORY: ["socks", "glove", "양말"],
  SHOES: ["shoes", "슈즈"],
};

// N-4.18-Q3 PART G-16 근본 원인(대표님 실측 골든케이스, 2026-08-27) — 이 taxon
// 단어 목록은 여태 등록 이래로 한글 항목이 전부 죽어있었다. normalizeText()가
// NFKD 정규화를 쓰는데, NFKD는 완성형 한글 음절("슈즈")을 개별 자모로 분해한다
// (실측 확인: "슈즈".normalize("NFKD").length는 2가 아니라 4). 반면 이 배열의
// 한글 단어는 일반 완성형 그대로 저장돼 있어서, normalizeText(title).includes(w)가
// 한글 단어에 대해서는 절대 참이 될 수 없었다(SHOES뿐 아니라 기존 TOP/PANTS/
// DRESS의 바지/원피스/셔츠 전부 동일하게 무효). 단어 쪽도 정규화 함수를 그대로
// 통과시켜 비교 대상과 같은 형태(분해된 자모)로 맞춘다 — 새 로직이 아니라 기존
// normalizeText를 양쪽에 일관되게 적용하는 수정.
const NORMALIZED_CATEGORY_TAXON_WORDS: Record<CategoryTaxon, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_TAXON_WORDS).map(([taxon, words]) => [taxon, words.map((w) => normalizeText(w))]),
) as Record<CategoryTaxon, string[]>;

/** 제목 텍스트에서 상품유형 단어를 찾는다 — 정규화(normalizeText)한 문자열에
 * 단어가 부분 포함되는지만 본다(형태소 분석 없음, 실제 관측 단어와의 단순
 * 매칭). 여러 taxon 단어가 동시에 매칭되면(드묾) 첫 번째로 찾은 것을 쓴다 —
 * 완벽한 분류기가 아니라 "명백히 다른 상품유형"을 걸러내는 보조 신호이므로
 * 이 정도 단순함이 목표에 맞다. */
export function extractCategoryTaxon(text: string): CategoryTaxon | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const [taxon, words] of Object.entries(NORMALIZED_CATEGORY_TAXON_WORDS) as [CategoryTaxon, string[]][]) {
    if (words.some((w) => normalized.includes(w))) return taxon;
  }
  return null;
}

/**
 * TTAEJYO 2.0(CEO 지시, 2026-09-12) — "여성 원피스와 아동 원피스가 서로 매칭되면
 * 안 된다."
 *
 * ── 왜 위 CategoryTaxon으로는 안 되는가 ──────────────────────────────────
 * 둘 다 DRESS다. 상품유형은 **정확히 같고**, 다른 것은 대상 연령이다. 그래서
 * taxon 축으로는 "카테고리 일치"(+보정)까지 받는다 — 지금까지 이 두 상품은
 * 매칭에서 서로를 밀어내기는커녕 서로를 끌어당기고 있었다.
 *
 * ── 판정 알고리즘은 건드리지 않는다 ──────────────────────────────────────
 * matchTruth 서열(IDENTIFIER/TEXT/SIMILAR/CONFLICT)도, classifyMatchLevel의
 * 95/85/70 경계도, SKU가 최종 우선이라는 순서도 그대로다. 여기서 더하는 것은
 * 위 taxon과 **완전히 같은 모양의 보조 신호** 하나뿐이다.
 *
 * ── 일치할 때는 아무것도 하지 않는다(비대칭) ─────────────────────────────
 * 의도한 것이다. 불일치에만 감점하고 일치에는 가점하지 않으면, 기존 아동↔아동
 * 쌍의 점수가 **한 소수점도 움직이지 않는다**. 새 신호가 기존 판정을 흔들지
 * 않는다는 것을 산술로 보장하는 가장 단순한 방법이다.
 *
 * ── 어휘 ─────────────────────────────────────────────────────────────────
 * CATEGORY_TAXON_WORDS와 같은 원칙: 번역사전을 만들지 않고, 부분문자열 오탐이
 * 없는 말만 쓴다. "men"은 넣지 않았다 — normalizeText는 형태소 분석 없이 부분
 * 포함만 보는데 "men"은 garment/embellishment 안에 그대로 들어 있다(이 파일이
 * 이미 "코트"→"타이니코튼" 오탐으로 한 번 겪은 문제다). "women"은 그 자체로
 * 충분히 길어 안전하고, 한글 "여성/남성"도 다른 단어에 섞이지 않는다.
 */
export type AudienceTaxon = "KIDS" | "ADULT";

const AUDIENCE_TAXON_WORDS: Record<AudienceTaxon, string[]> = {
  KIDS: ["kids", "girls", "boys", "baby", "toddler", "아동", "키즈", "베이비", "주니어"],
  ADULT: ["women", "여성", "남성"],
};

/** 한글 단어는 반드시 normalizeText를 통과시켜 비교 대상과 같은 형태(NFKD로
 * 분해된 자모)로 맞춘다 — 그러지 않으면 한글 항목이 통째로 죽는다(위
 * NORMALIZED_CATEGORY_TAXON_WORDS 주석의 실측 사고 그대로). */
const NORMALIZED_AUDIENCE_TAXON_WORDS: Record<AudienceTaxon, string[]> = Object.fromEntries(
  Object.entries(AUDIENCE_TAXON_WORDS).map(([taxon, words]) => [taxon, words.map((w) => normalizeText(w))]),
) as Record<AudienceTaxon, string[]>;

/** 제목에서 대상 연령층을 읽는다. 근거가 없으면 null — "모른다"이지 "다르다"가
 * 아니다(taxon과 같은 규칙). */
export function extractAudienceTaxon(text: string): AudienceTaxon | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  // KIDS를 먼저 본다. "Girls Women's-style Dress"처럼 두 신호가 함께 있으면
  // 더 좁은 쪽(아동)이 답이다 — 성인 매장이 아동복을 "girls"로 표기하는 일은
  // 있어도, 아동 매장이 성인복을 "women"으로 표기하는 일은 없다.
  for (const taxon of ["KIDS", "ADULT"] as AudienceTaxon[]) {
    if (NORMALIZED_AUDIENCE_TAXON_WORDS[taxon].some((w) => normalized.includes(w))) return taxon;
  }
  return null;
}

export type MatchLevel = "very_high" | "high" | "medium" | "low";

/** N-4.18-D(대표님 지시, 2026-08-25: "95% 이상만 동일상품 확정, 85~94%는 유사상품으로
 * 별도 표시, 70~84%는 참고용, 70% 미만은 버린다") — 이전 경계(95/80/60)를 대표님이
 * 확정한 정확한 경계(95/85/70)로 교체한다. 이 경계는 domestic-product-link.ts의
 * toDomesticMatchType()이 그대로 이어받아 EXACT(자동 가격반영)/HIGH_CONFIDENCE(후보
 * 표시, 가격 미반영)/REVIEW_REQUIRED(참고용 표시, 가격 미반영)/NOT_MATCHED(버림)로
 * 매핑한다 — 전역 임계값이므로 두 곳에서 따로 정의하지 않고 이 함수 하나만 바꾼다. */
export function classifyMatchLevel(confidence: number): MatchLevel {
  if (confidence >= 0.95) return "very_high";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

export interface MatchResult {
  confidence: number;
  level: MatchLevel;
  reasons: string[];
}

/** 규칙 기반 동일상품 판별(AI 미사용). "검색으로 찾음"이 아니라 "동일상품일 가능성"을
 * 표현하는 것이 목표 — 브랜드/모델명/색상/SKU/URL slug 순으로 확인 가능한 신호만
 * 사용하고, 신호가 없으면 점수를 올리지도 내리지도 않는다(추측 금지).
 *
 * N-3.11 Part C-2 — CPO가 요구한 우선순위(GTIN/EAN/UPC → SKU/ProductID → 브랜드+
 * 정확한 상품명 → 브랜드+모델명 → 이미지/상품명 보조)와 이 함수의 대응 관계:
 * GTIN/EAN/UPC는 현재 comparison_shops/ComparisonCandidate 어디에도 그런 필드가
 * 없어(추출한 적도 없음) 사용할 수 없다 — 억지로 필드를 만들지 않고 BLOCKED로
 * 보고한다. 그다음 순위인 SKU는 이미 최우선 신호로 반영돼 있다(아래 2번, 일치 시
 * 0.97 강제). 브랜드+모델명은 모델명 Jaccard(기본 점수)에 브랜드 게이트(4번,
 * 최종 승수)를 곱하는 구조로 이미 결합돼 있다. */
export function scoreCandidateMatch(query: ComparisonQuery, candidate: ComparisonCandidate): MatchResult {
  const reasons: string[] = [];
  const candidateBrandGuess = candidate.brand;
  const brandForStrip = query.brand ?? candidateBrandGuess;

  const { model: queryModel, color: queryColor } = splitModelColor(query.title);
  const { model: candidateModel, color: candidateColor } = splitModelColor(candidate.title);

  const modelScore = jaccard(
    tokenize(stripBrandWords(queryModel, brandForStrip)),
    tokenize(stripBrandWords(candidateModel, brandForStrip)),
  );

  // N-4.18-Q3 PART K/H(대표님 실측 골든케이스, 2026-08-26) — 실측으로 확인된 버그:
  // "Lulu T-Bar Shoes in Vernice Nero by PèPè"는 "by"/"in" 패턴이 있어 모델("Lulu
  // T-Bar Shoes")과 색상("Vernice Nero")이 분리되는데, 대응하는 국내 후보
  // "AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈"는 이 영문 패턴이 없어 "Vernice
  // Nero"가 그대로 모델명 안에 남는다 — 그 결과 모델명끼리만 비교하면 색상 단어가
  // 한쪽에만 들어있어 겹치는 토큰이 0개가 된다(실측: 258,000원 정가로 정확히 일치하는
  // 진짜 동일상품인데도 모델명 유사도 0%로 매칭 실패). "in"/"by"로 분리되지 않은
  // 쪽은 색상 정보가 애초에 모델명에 섞여있을 수 있으므로, 분리 전 원문 전체(브랜드
  // 단어만 제거) 토큰 비교를 보조 신호로 추가해 더 높은 쪽을 쓴다 — 분리가 정확히
  // 대칭인 경우(둘 다 색상이 분리됨)는 fullTitleScore가 modelScore보다 낮거나
  // 같으므로 기존 동작에 영향 없다(Math.max이므로 오직 개선 방향으로만 작용).
  const fullTitleScore = jaccard(
    tokenize(stripBrandWords(query.title, brandForStrip)),
    tokenize(stripBrandWords(candidate.title, brandForStrip)),
  );

  // MI-MATCH-FIX-3(CPO 지시, 2026-09-10) — fullTitleScore를 원래 만들어진 목적에만
  // 쓴다. 이 보조 신호는 PART K에서 "한쪽만 색상이 분리돼 모델명 교집합이 0이 되는
  // 비대칭"을 구제하려고 도입됐다. 그런데 Math.max로 항상 경쟁시키면, 모델명이
  // 이미 정상 비교되는 경우에도 fullTitle이 색상 토큰을 주워 담아 더 높은 점수를
  // 만든다. 그 색상은 아래에서 색상 신호로 **다시** 가산되므로 같은 근거가 두 번
  // 점수가 된다.
  //
  // 실측(감사 24쌍): 최고 오답 65%가 정확히 이 경로였다 — 모델명 교집합은
  // panel/sweatpants(둘 다 유형어)뿐인데 fullTitle이 grey를 더해 38%를 만들고,
  // 그 뒤 "색상 일치(제목 내 확인)"가 grey로 또 가산했다. 반면 PART K는
  // modelScore가 실제로 0이라 이 신호가 없으면 매칭 자체가 사라진다.
  //
  // 그래서 modelScore가 0일 때만 폴백한다 — 구제가 필요한 상황에서만 쓰고,
  // 모델명이 이미 비교되고 있으면 그 결과를 색상으로 덮어쓰지 않는다.
  // 새 상수나 가중치는 도입하지 않는다(선택 조건만 바꾼다).
  let score = modelScore > 0 ? modelScore : fullTitleScore;
  reasons.push(`모델명 유사도 ${Math.round(score * 100)}%`);

  // 1. 색상 — 둘 다 명시적으로 확인된 경우만 사용(추측 금지)
  if (queryColor && candidateColor) {
    if (normalizeText(queryColor) === normalizeText(candidateColor)) {
      score = score + (1 - score) * 0.4;
      reasons.push("색상 일치");
    } else {
      score = score * 0.65;
      reasons.push("색상 불일치");
    }
  } else if (queryColor && queryColor.trim().length >= 4) {
    // N-4.18-Q3 PART K(대표님 실측 골든케이스) — 후보 쪽 제목엔 "in X by Y" 패턴이
    // 없어 candidateColor가 null인 경우가 실제로 흔하다(국내 편집샵 제목은 대부분
    // 이 영문 패턴을 안 쓴다). 이때도 후보 제목 원문에 색상명(예: "Vernice Nero")이
    // 그대로 포함돼 있으면(실측 확인: FORETFORET 제목에 "VERNICE NERO"가 그대로
    // 노출) 이는 추측이 아니라 실제 텍스트 일치이므로 색상 신호로 인정한다 —
    // "불일치" 판정은 하지 않는다(후보 쪽에 색상 정보가 아예 없을 수도 있어서 —
    // 없는 걸 다르다고 단정하지 않는다, 4번 브랜드 신호와 동일한 원칙).
    //
    // MI-MATCH-FIX-1(CPO 지시, 2026-09-10) — 이 경로의 가산을 0.4에서 0.1로 낮춘다.
    // 정답 2건/오답 21건을 대표님이 직접 판정한 감사에서, 점수 상위 오답 4건이
    // **전부** 이 경로로 올라왔다(청바지↔반바지 70%, 스웨터↔양말 63% 등). 반면
    // 이 경로로 가산을 받은 정답은 한 건도 없었다 — 이 표본에서 정밀도가 0이다.
    //
    // 원인은 근거의 성격이다. 위쪽 "색상 일치"는 양쪽 제목이 모두 "in X by Y"
    // 구조로 색상을 분리해낸 경우라 구조적 증거인 반면, 여기는 질의의 색상 단어가
    // 후보 제목 어딘가에 들어있기만 하면 성립한다. "off white", "black" 같은 흔한
    // 색은 같은 브랜드 안에서 수십 개 상품에 걸쳐 우연히 겹친다.
    //
    // 신호를 없애지는 않는다 — PART K의 "Vernice Nero"처럼 색상명이 그대로 노출돼
    // 실제로 동일상품을 가리키는 경우가 있기 때문이다. 대신 기존에 이미 약한 보조
    // 신호로 쓰이는 카테고리 일치와 같은 크기(0.1)로 낮춰, 확보된 점수를 뒤집지는
    // 못하고 소폭 보정만 하게 한다. 새 상수를 지어내지 않고 기존 약신호 눈금을 쓴다.
    const candidateTitleNorm = normalizeText(stripBrandWords(candidate.title, brandForStrip));
    if (candidateTitleNorm.includes(normalizeText(queryColor))) {
      score = score + (1 - score) * 0.1;
      reasons.push("색상 일치(제목 내 확인)");
    }
  }

  // N-4.18-I STEP I-4/I-6(대표님 지시: "카테고리는 강력한 보조 검증 신호로 쓴다,
  // SKU/모델보다 우선하면 안 된다") — SKU 신호(다음 단계, Math.max로 최종 override
  // 가능)보다 먼저 적용해 "SKU가 실제로 일치하면 카테고리 감점을 다시 끌어올릴 수
  // 있게" 순서를 둔다(대표님이 "품번이 같은데 카테고리가 다른 특수 상황은 별도
  // 검토 대상"이라고 명시한 것과 일치 — 여기서 억지로 해결하지 않고 SKU가 최종
  // 우선하도록만 순서를 잡는다). 둘 다 taxon이 확인될 때만 적용 — 한쪽이라도
  // 모르면(taxon=null) UNKNOWN이지 MISMATCH가 아니므로 감점하지 않는다.
  const queryTaxon = extractCategoryTaxon(query.title);
  const candidateTaxon = extractCategoryTaxon(candidate.title);
  if (queryTaxon && candidateTaxon) {
    if (queryTaxon === candidateTaxon) {
      // "의류 vs 의류"류 약한 보조 신호(대표님 예시) — 이미 확보된 점수를 크게
      // 흔들지 않을 정도로만 소폭 보정한다.
      score = score + (1 - score) * 0.1;
      reasons.push("카테고리 일치");
    } else {
      // "상의 vs 바지"류 강한 감점(대표님 예시 Case C).
      score = score * 0.3;
      reasons.push("카테고리 불일치");
    }
  }

  // TTAEJYO 2.0(CEO 지시, 2026-09-12) — 대상 연령층. 위 taxon과 같은 자리에,
  // 같은 규칙(양쪽 다 확인될 때만)으로, 같은 감점폭을 쓴다. 다른 점은 하나뿐이다:
  // **일치할 때 가점하지 않는다**. 그래서 기존 아동↔아동 매칭 점수는 이 블록이
  // 생기기 전과 완전히 같고, 새로 달라지는 것은 "여성 원피스 ↔ 아동 원피스"처럼
  // 양쪽 연령층이 실제로 확인되면서 서로 다른 경우뿐이다.
  const queryAudience = extractAudienceTaxon(query.title);
  const candidateAudience = extractAudienceTaxon(candidate.title);
  if (queryAudience && candidateAudience && queryAudience !== candidateAudience) {
    score = score * 0.3;
    reasons.push("대상 연령층 불일치");
  }

  // 2. SKU/article code — 둘 다 있을 때만, 가장 강한 신호
  if (query.sku && candidate.sku) {
    if (normalizeText(query.sku) === normalizeText(candidate.sku)) {
      score = Math.max(score, 0.97);
      reasons.push("SKU 일치");
    } else {
      score = score * 0.3;
      reasons.push("SKU 불일치");
    }
  }

  // 3. URL slug — 완전히 같을 때만 보조 신호(다르다고 감점하지 않음, 사이트 간 slug는
  // 원래 다를 수 있음)
  if (query.sourceUrl) {
    const querySlug = extractSlug(query.sourceUrl);
    const candidateSlug = extractSlug(candidate.url);
    if (querySlug && candidateSlug && querySlug === candidateSlug) {
      score = Math.max(score, 0.95);
      reasons.push("URL slug 일치");
    }
  }

  // N-4.19(대표님 지시, 2026-08-26) — 설명문에서 뽑은 품번(extractProductCode,
  // 예: "Product code B226AC010")이 후보 URL slug 안에 그대로 포함돼 있으면
  // 실측으로 확인된 강한 동일상품 신호다. bobochoses.com 공식몰 실측 확인:
  // handle 자체가 "b226ac010-booty-ghosts-t-shirt"처럼 품번을 포함하는데,
  // 검색 API(search/suggest.json)의 body 텍스트에는 그 품번이 안 나와서(실측
  // 확인 — "Light heather grey t-shirt. Organic Cotton 100%..." 뿐) 기존
  // SKU exact-match 신호(candidate.sku 필요)는 못 잡는다. 4자 미만처럼 너무
  // 짧은 값은 우연히 slug에 포함될 위험이 커서 제외한다.
  if (query.sku && query.sku.length >= 4) {
    const candidateSlug = extractSlug(candidate.url);
    const normalizedSku = normalizeText(query.sku);
    if (candidateSlug && normalizedSku && candidateSlug.includes(normalizedSku)) {
      score = Math.max(score, 0.95);
      reasons.push("품번이 URL에 포함됨");
    }
  }

  // 4. 브랜드 — 마지막에 최종 게이트로 적용한다(다른 신호가 이미 올려둔 점수를
  // "확실히 다른 브랜드"라는 강한 반증이 다시 깎을 수 있어야 하기 때문에 순서가
  // 중요하다 — 앞에 두면 색상/SKU 보너스가 브랜드 불일치 페널티를 덮어써버린다).
  // candidate.brand가 명시적으로 있으면 신뢰도 높은 신호, 없으면 title 부분일치로만
  // "일치"를 확인하고 "불일치"는 판단하지 않는다(오탐 방지 — 모르는 걸 다르다고 단정하지 않음).
  if (query.brand) {
    if (candidateBrandGuess) {
      if (brandsMatch(query.brand, candidateBrandGuess)) {
        score = score + (1 - score) * 0.3;
        reasons.push("브랜드 일치");
      } else {
        score = score * 0.2;
        reasons.push("브랜드 불일치");
      }
    } else if (brandsMatch(query.brand, candidate.title)) {
      score = score + (1 - score) * 0.3;
      reasons.push("브랜드 일치(제목 내 확인)");
    }
  }

  const confidence = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
  return { confidence, level: classifyMatchLevel(confidence), reasons };
}

/** 하위호환용 — 숫자 confidence만 필요한 호출부를 위해 유지. */
export function scoreCandidate(query: ComparisonQuery, candidate: ComparisonCandidate): number {
  return scoreCandidateMatch(query, candidate).confidence;
}

/** P-4-DATA-4(CPO 지시, 2026-08-29) — 이 시점(withConfidence)까지 priceSource가
 * "detail"로 명시적으로 설정된 후보(bobochoses.com 국내 검색처럼 검색 자체가 상세
 * 페이지를 조회하는 경우)만 VERIFIED_CURRENT다. 그 외 전부(shopify-suggest처럼 아직
 * priceSource가 없는 경우, childrensalon/국내 스크래핑 파서처럼 검색 결과 HTML에서
 * 바로 뽑은 값)는 일단 UNVERIFIED_SEARCH로 시작한다 — 이후 enrichCandidatePrices가
 * 실제 상세 검증에 성공한 후보만 VERIFIED_CURRENT로 승격한다. 이 함수는 모든
 * ComparisonCandidate 생성 경로(shopify-suggest.ts/childrensalon.ts/bobochoses-kr.ts/
 * looxloo.ts/rulii.ts/deuxbebe.ts/chocoel.ts/foretforet.ts)가 공통으로 거치는 단일
 * 지점이라, 개별 파서 8개를 각각 수정하지 않고 여기 한 곳에서 기본값을 강제한다. */
function derivePriceStatus(candidate: ComparisonCandidate): Pick<ComparisonCandidate, "priceStatus" | "verificationAttempted"> {
  if (candidate.priceSource === "detail") {
    return { priceStatus: "VERIFIED_CURRENT", verificationAttempted: true };
  }
  return { priceStatus: "UNVERIFIED_SEARCH", verificationAttempted: false };
}

/** N-4.18-Q3 PART H-3-8(대표님 지시, 2026-08-27) — scoreCandidateMatch() 계산식/
 * threshold는 그대로 두고, 그 직전 입력 title만 title-normalize.ts로 정제한다.
 * candidate.title도 같은 함수로 정제한다(대칭 처리 — 지금은 실측된 노이즈 패턴이
 * 해외 title에서만 발견됐지만, 국내 후보 title에 같은 패턴이 나타나도 대응
 * 가능하도록). 결과 객체(c)는 원본 title을 그대로 유지한다 — 정제본은 오직
 * scoreCandidateMatch 계산 입력으로만 쓰인다. */
export function withConfidence(query: ComparisonQuery, candidates: ComparisonCandidate[]): ComparisonCandidate[] {
  const normalizedQuery: ComparisonQuery = { ...query, title: normalizeMatchingTitle(query.title) };
  return candidates
    .map((c) => {
      const normalizedCandidate: ComparisonCandidate = { ...c, title: normalizeMatchingTitle(c.title) };
      const { confidence, level, reasons } = scoreCandidateMatch(normalizedQuery, normalizedCandidate);
      const withMatch: ComparisonCandidate = { ...c, confidence, matchLevel: level, matchReasons: reasons };
      // MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 양쪽에서 사실 묶음을 읽어낸
      // 경우에만 교차판매처 판정을 얹는다. confidence도 matchLevel도 손대지
      // 않는다(기존 계산을 다시 하지 않는다는 이 저장소의 계층 분리 원칙 그대로) —
      // 새 필드로만 답을 남기고, 그 답을 쓸지는 화면/가격 정책이 정한다.
      const cross =
        query.facts && c.facts ? compareCrossSellerProducts(query.facts, c.facts) : null;
      const withCross: ComparisonCandidate = cross
        ? { ...withMatch, crossSellerVerdict: cross.verdict, crossSellerReasons: cross.reasons }
        : withMatch;
      return { ...withCross, ...derivePriceStatus(withCross) };
    })
    .sort((a, b) => b.confidence - a.confidence);
}
