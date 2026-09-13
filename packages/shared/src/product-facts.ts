/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — "판매처가 달라도 같은 물건이면 같다고
 * 말할 수 있어야 한다."
 *
 * ── 무엇이 막고 있었나 ───────────────────────────────────────────────────────
 * 판매처는 저마다 자기 SKU를 붙인다. Smallable은 `430701`/`AAA1804922`, Bobo
 * 공식몰은 `B226AC114`다. Smallable 페이지 어디에도 Bobo 품번이 없다(실측). 즉
 * 식별자를 맞춰보는 길은 **원리적으로** 막혀 있고, "SKU가 다르면 다른 상품"은
 * 규칙이 될 수 없다.
 *
 * 그런데 두 페이지는 같은 사실을 여러 개 말하고 있었다 — 브랜드(Bobo Choses),
 * 상품군(Sweatshirts), 색상(Heather grey / Light heather grey), 소재(100%
 * Organic Cotton / Organic Cotton 100%), 핏(Loose fit), 대상(Children / Kid),
 * 사이즈 체계(4/5 years … 12/13 years vs 2-3Y … 12-13Y). 이 사실들은 이미
 * CanonicalProduct에 들어와 있었지만 ProductIdentityDna → ComparisonQuery →
 * scoreCandidateMatch로 **한 번도 실려 간 적이 없다**. 이 파일은 그 사실들을
 * 비교 가능한 모양으로 만드는 곳이다.
 *
 * ── 왜 packages/shared인가 ──────────────────────────────────────────────────
 * 등록상품(CanonicalProduct)과 검색 후보(ComparisonCandidate)는 서로 다른
 * 패키지에 산다. 둘을 같은 자로 재려면 자가 두 패키지보다 아래에 있어야 한다.
 * 여기 있는 함수는 전부 순수 함수이고 네트워크/DB를 모른다.
 *
 * ── 이 파일의 불변식 ────────────────────────────────────────────────────────
 * 1. 모르는 것은 null이다. "확인 못 함"을 "다름"으로 바꿔 적지 않는다.
 * 2. 모든 비교 함수는 인자 순서를 바꿔도 같은 값을 돌려준다(대칭). 집합 교집합,
 *    문자열 동등성, Math.min/max처럼 원래 대칭인 연산만 쓴다 — "질의 쪽만 보는"
 *    규칙을 여기에 두지 않는다.
 * 3. 어휘 목록은 실제 상품 원문에서 관측된 말만 넣는다. 번역사전이나 "있을
 *    법한" 표현을 지어내지 않는다(comparison-search/match.ts가 "코트"→
 *    "타이니코튼" 오탐으로 한 번 겪은 문제다).
 */

/** 발음기호를 떼고 소문자로 통일한다. 한글은 NFKD가 자모로 분해하므로, 이 함수를
 * 통과한 문자열끼리만 비교해야 한다 — 어휘 목록도 반드시 같이 통과시킨다. */
export function normalizeFactText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * 알파벳/숫자/한글 덩어리로 쪼갠다.
 *
 * 한글 처리에 두 가지가 함께 들어 있다.
 *
 * 첫째, NFKD는 완성형 음절("원")을 조합용 자모(U+1100~U+11FF)로 분해한다. 그래서
 * 쪼개는 문자 클래스에 `가-힣`만 넣으면 한글이 **통째로 사라진다** — 분해된
 * 자모가 전부 구분자로 취급되기 때문이다(comparison-search/match.ts가 같은
 * 이유로 한글 어휘 목록이 죽어 있던 것을 실측으로 확인한 적이 있다). 자모 범위를
 * 함께 넣어야 한글 낱말이 한 덩어리로 남는다.
 *
 * 둘째, 그렇게 남긴 토큰은 다시 NFC로 합친다. 이 토큰은 비교에만 쓰이는 것이
 * 아니라 검색어 문자열로 그대로 나가기 때문이다(buildDomesticShopQuery). 분해된
 * 자모를 그대로 이어붙이면 화면에는 같아 보여도 바이트가 다른 문자열이 되어
 * 검색이 0건이 된다. 발음기호는 이미 위에서 떼어낸 뒤라 NFC로 되돌려도 é가
 * 되살아나지 않는다.
 *
 * 1글자 토큰은 버린다 — "B.C."의 b/c처럼 단독으로는 아무 뜻도 없는 조각이
 * 교집합을 부풀리는 것을 막는다.
 */
export function tokenizeFactText(text: string): string[] {
  return normalizeFactText(text)
    .split(/[^a-z0-9가-힣ᄀ-ᇿ㄰-㆏]+/)
    .filter((t) => t.length > 1)
    .map((t) => t.normalize("NFC"));
}

/** 어휘 목록은 반드시 토큰과 **같은 파이프라인**을 통과시킨다. 한쪽만 NFC로
 * 합치면 한글 항목이 통째로 죽는다(이 저장소가 이미 한 번 겪은 사고다). */
function normalizedWordSet(words: string[]): Set<string> {
  return new Set(words.map((w) => normalizeFactText(w).normalize("NFC")));
}

/* ───────────────────────────── 색상 ───────────────────────────── */

/**
 * 색상은 "같다"보다 "명백히 다르다"를 말할 때 훨씬 위험하다. 그래서 개별 색이름이
 * 아니라 **묶음(hue group)** 단위로만 판정한다 — Heather grey와 Light heather
 * grey가 다르다고 말하면 안 되고, Blue와 Light pink가 같다고 말해도 안 된다.
 *
 * 목록에 없는 말은 판정하지 않는다(unknown). "Ecru"를 일부러 넣지 않은 것이
 * 그 예다 — 아이보리 쪽인지 베이지 쪽인지 사람마다 다르게 부르는 말이라, 어느
 * 묶음에 넣어도 그 순간 "명백한 충돌"을 지어내게 된다. 모르는 채로 두면 색상은
 * 그냥 근거에서 빠질 뿐이고, 다른 근거들이 판단을 계속한다.
 */
export type ColorHueGroup =
  | "WHITE"
  | "BLACK"
  | "GREY"
  | "BEIGE"
  | "BROWN"
  | "RED"
  | "PINK"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE";

const COLOR_HUE_WORDS: Record<ColorHueGroup, string[]> = {
  WHITE: ["white", "offwhite", "ivory", "cream", "흰색", "화이트"],
  BLACK: ["black", "검정", "블랙"],
  GREY: ["grey", "gray", "charcoal", "anthracite", "회색", "그레이"],
  BEIGE: ["beige", "sand", "baige", "베이지"],
  BROWN: ["brown", "chocolate", "camel", "taupe", "갈색", "브라운"],
  RED: ["red", "crimson", "burgundy", "maroon", "빨강", "레드"],
  PINK: ["pink", "magenta", "fuchsia", "분홍", "핑크"],
  ORANGE: ["orange", "rust", "coral", "terracotta", "주황", "오렌지"],
  YELLOW: ["yellow", "mustard", "gold", "노랑", "옐로우"],
  GREEN: ["green", "olive", "khaki", "mint", "emerald", "초록", "그린"],
  BLUE: ["blue", "navy", "indigo", "denim", "파랑", "블루", "네이비"],
  PURPLE: ["purple", "lavender", "lilac", "violet", "보라", "퍼플"],
};

const NORMALIZED_COLOR_HUE_WORDS: [ColorHueGroup, Set<string>][] = (
  Object.entries(COLOR_HUE_WORDS) as [ColorHueGroup, string[]][]
).map(([group, words]) => [group, normalizedWordSet(words)]);

/** 색상 문구에서 알아볼 수 있는 색 묶음을 전부 모은다. "Navy blue"처럼 한 문구가
 * 같은 묶음을 두 번 가리켜도 Set이라 한 번만 남는다. */
export function resolveColorHueGroups(colorText: string | null | undefined): Set<ColorHueGroup> {
  const found = new Set<ColorHueGroup>();
  if (!colorText) return found;
  const tokens = new Set(tokenizeFactText(colorText));
  for (const [group, words] of NORMALIZED_COLOR_HUE_WORDS) {
    for (const token of tokens) {
      if (words.has(token)) {
        found.add(group);
        break;
      }
    }
  }
  return found;
}

/**
 * 설명문 첫 문장 맨 앞의 색상 문구를 그대로 뽑는다.
 *
 * 브랜드 공식몰은 설명을 색으로 시작한다(실측, Bobo Choses 6개 상품 전부):
 * "Light heather grey sweatshirt.", "Midnight blue t-shirt.", "Navy blue
 * sweatshirt.", "Offwhite t-shirt." 여기서 색 이름 앞에 수식어가 **두 개**
 * 붙는 경우가 실제로 있다("Light heather grey") — description-facts.ts의 기존
 * 추출기는 수식어를 한 개까지만 허용해서 이 표기를 통째로 놓쳤고, 그래서
 * 아동 스웨트셔츠와 여성 티셔츠의 색상 반증이 발화하지 않았다.
 *
 * 그쪽 함수를 넓히지 않은 이유는 그 결과가 등록 payload(고시정보)로 나가기
 * 때문이다. 비교용으로 필요한 넓힘을 등록 값까지 함께 바꾸는 것은 별개의 위험이다.
 *
 * 첫 문장만 본다. 문서 전체를 훑으면 "made in ..." 같은 뒤쪽 문장의 색 단어가
 * 상품 색으로 둔갑한다. 색 이름이 없으면 null이다.
 */
const MAX_COLOR_MODIFIER_WORDS = 2;

export function extractLeadingColorPhrase(text: string | null | undefined): string | null {
  if (!text) return null;
  const firstSentence = text.split(/[.．\n]/)[0] ?? "";
  const tokens = tokenizeFactText(firstSentence);
  const hueIndex = tokens.findIndex((token) =>
    NORMALIZED_COLOR_HUE_WORDS.some(([, words]) => words.has(token)),
  );
  if (hueIndex < 0) return null;
  return tokens.slice(Math.max(0, hueIndex - MAX_COLOR_MODIFIER_WORDS), hueIndex + 1).join(" ");
}

/* ───────────────────────────── 소재 ───────────────────────────── */

/**
 * "100% Organic Cotton"(Smallable)과 "Organic Cotton 100%"(Bobo 공식몰)은 같은
 * 사실을 순서만 바꿔 적은 것이다. 문자열로 비교하면 영원히 다르고, 구성 성분
 * 목록으로 바꾸면 같다. 그래서 문구를 **성분 목록**으로 환원한 뒤에 비교한다.
 *
 * packages/crawler/description-facts.ts의 extractMaterial()을 고치지 않았다. 그
 * 함수는 등록 payload(고시정보)에 들어가는 값을 만들고 있어서, 여기서 필요한
 * "비교용 정규화"를 위해 그 출력 모양을 바꾸면 등록 쪽이 함께 흔들린다. 같은
 * 어휘를 쓰되 목적이 다른 함수를 따로 둔다.
 */
const FABRIC_WORDS = [
  "cotton", "polyester", "elastane", "nylon", "wool", "linen", "silk", "spandex",
  "viscose", "acrylic", "cashmere", "leather", "denim", "rayon", "lycra", "modal",
  "bamboo", "hemp", "polyamide", "acetate", "polyurethane", "elastomultiester",
];

/** 원단 이름 앞에 붙는 수식어 중 **실제 상품 원문에서 관측된 것만** 둔다(실측:
 * Bobo Choses "Organic Cotton 66%, Recycled Cotton 17%, Cotton 17%", Smallable
 * "100% Organic Cotton"). 수식어를 무제한 허용하면 "50% Off Sale ... cotton"
 * 같은 할인 문구가 소재로 둔갑한다 — description-facts.ts가 이미 겪은 오탐이다. */
const FABRIC_QUALIFIERS = ["organic", "recycled", "virgin", "brushed", "combed", "merino", "regenerated", "bio"];

const FABRIC_GROUP = FABRIC_WORDS.join("|");
const QUALIFIER_GROUP = FABRIC_QUALIFIERS.join("|");
/** "100% Organic Cotton" — 비율이 앞. */
const PERCENT_FIRST_RE = new RegExp(`(\\d{1,3})\\s*%\\s*((?:(?:${QUALIFIER_GROUP})\\s+){0,2}(?:${FABRIC_GROUP}))`, "gi");
/** "Organic Cotton 100%" — 비율이 뒤. */
const PERCENT_LAST_RE = new RegExp(`((?:(?:${QUALIFIER_GROUP})\\s+){0,2}(?:${FABRIC_GROUP}))\\s*(\\d{1,3})\\s*%`, "gi");

export interface MaterialComponent {
  /** 수식어까지 포함한 원단 이름(예: "organic cotton") — "cotton"과 "organic
   * cotton"은 실제로 다른 성분으로 표기되므로 뭉개지 않는다. */
  fabric: string;
  percent: number;
}

/** 성분 목록을 정렬된 형태로 돌려준다. 정렬해 두는 이유는 하나뿐이다 — 두 판매처가
 * 같은 성분을 다른 순서로 적어도 같은 값이 나와야 하기 때문이다(대칭). */
export function parseMaterialComposition(text: string | null | undefined): MaterialComponent[] {
  if (!text) return [];
  const found = new Map<string, MaterialComponent>();
  const add = (fabricRaw: string, percentRaw: string) => {
    const fabric = normalizeFactText(fabricRaw).replace(/\s+/g, " ");
    const percent = Number(percentRaw);
    if (!fabric || !Number.isFinite(percent) || percent <= 0 || percent > 100) return;
    found.set(`${fabric}|${percent}`, { fabric, percent });
  };
  for (const m of text.matchAll(PERCENT_FIRST_RE)) add(m[2], m[1]);
  for (const m of text.matchAll(PERCENT_LAST_RE)) add(m[1], m[2]);
  return [...found.values()].sort((a, b) =>
    a.fabric === b.fabric ? a.percent - b.percent : a.fabric.localeCompare(b.fabric),
  );
}

export function materialCompositionKey(components: MaterialComponent[]): string {
  return components.map((c) => `${c.fabric}:${c.percent}`).join(",");
}

/* ───────────────────────────── 핏 ───────────────────────────── */

/**
 * 실측으로 관측된 표현만 등록한다(Smallable "SIZE AND FIT → Loose fit", Bobo
 * 공식몰 "Loose fit." / "Fits true to size, take your normal size."). 목록에
 * 없으면 null이고, null은 감점도 가점도 아니다.
 *
 * 긴 표현을 먼저 본다 — "fits true to size"가 "true to size"보다 먼저 잡혀야
 * 같은 문장이 두 가지로 읽히지 않는다.
 */
const FIT_PHRASES = [
  "fits true to size",
  "true to size",
  "oversize fit",
  "oversized fit",
  "loose fit",
  "relaxed fit",
  "regular fit",
  "slim fit",
];

const NORMALIZED_FIT_PHRASES = FIT_PHRASES.map((p) => normalizeFactText(p)).sort((a, b) => b.length - a.length);

export function extractFitPhrase(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeFactText(text).replace(/\s+/g, " ");
  for (const phrase of NORMALIZED_FIT_PHRASES) {
    if (normalized.includes(phrase)) return phrase;
  }
  return null;
}

/* ───────────────────────────── 사이즈 ───────────────────────────── */

/**
 * 사이즈는 두 가지를 서로 다른 목적으로 쓴다.
 *
 *  · 사이즈 **체계**(연령형 / 알파벳형 / 숫자형)는 상품 종류를 가른다. 아동복은
 *    "2-3Y", 성인복은 "XS~XL"이다(실측: B226AC114 vs B226AD013). 체계가 다르면
 *    같은 상품일 수 없다.
 *  · 사이즈 **값**의 겹침은 보조 근거다. 다만 이것만으로 다름을 말하지는 않는다 —
 *    한쪽에 4/5 years만 남고 다른 쪽에 12/13Y만 남는 일은 재고 때문에 늘 생긴다.
 */
export type SizeSystem = "AGE" | "ALPHA" | "NUMERIC";

const ALPHA_SIZE_TOKENS = normalizedWordSet(["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "free"]);

/** "4/5 years", "4-5Y", "2-3Y"를 같은 값("4-5y")으로 만든다. 구분자(/ 또는 -)와
 * 단위 표기(Y / years)가 판매처마다 다를 뿐 같은 사실이다. */
export function normalizeSizeLabel(label: string): { value: string; system: SizeSystem } | null {
  const raw = normalizeFactText(label).replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const ageRange = /^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*(?:y|yr|yrs|year|years|ans)\b/.exec(raw);
  if (ageRange) return { value: `${Number(ageRange[1])}-${Number(ageRange[2])}y`, system: "AGE" };

  const ageSingle = /^(\d{1,2})\s*(?:y|yr|yrs|year|years|ans)\b/.exec(raw);
  if (ageSingle) return { value: `${Number(ageSingle[1])}y`, system: "AGE" };

  const monthRange = /^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*(?:m|mo|month|months|mois)\b/.exec(raw);
  if (monthRange) return { value: `${Number(monthRange[1])}-${Number(monthRange[2])}m`, system: "AGE" };

  const compact = raw.replace(/[^a-z0-9]/g, "");
  if (ALPHA_SIZE_TOKENS.has(compact)) return { value: compact, system: "ALPHA" };

  if (/^\d{1,3}$/.test(compact)) return { value: compact, system: "NUMERIC" };
  return null;
}

export interface SizeProfile {
  values: Set<string>;
  systems: Set<SizeSystem>;
}

export function buildSizeProfile(labels: string[]): SizeProfile {
  const values = new Set<string>();
  const systems = new Set<SizeSystem>();
  for (const label of labels) {
    const normalized = normalizeSizeLabel(label);
    if (!normalized) continue;
    values.add(normalized.value);
    systems.add(normalized.system);
  }
  return { values, systems };
}

/* ───────────────────────── 대상 연령층 / 성별 ───────────────────────── */

/**
 * comparison-search/match.ts의 extractAudienceTaxon()은 **제목 문자열의 부분
 * 포함**으로 판단한다. 그래서 "men"을 넣을 수 없었다(garment/embellishment 안에
 * 그대로 들어 있다). 여기서는 breadcrumb 조각/Shopify 태그처럼 **이미 낱말로
 * 쪼개져 있는 신호**를 받아서 토큰 완전일치로만 본다 — 부분 포함 오탐이 원리상
 * 생기지 않으므로 "men"/"boy" 같은 짧은 말도 안전하게 쓸 수 있다.
 *
 * 실측 신호: Smallable breadcrumb ["Fashion / Children", "/ Boy", "/ Sweatshirts"],
 * Bobo 공식몰 태그 ["children","Kid",...] 및 ["adult","Woman",...].
 */
export type AudienceGroup = "KIDS" | "ADULT";

const KIDS_TOKENS = normalizedWordSet([
  "kid", "kids", "child", "children", "childrens", "baby", "babies", "toddler", "newborn",
  "junior", "boy", "boys", "girl", "girls", "아동", "키즈", "베이비", "주니어", "유아",
]);
const ADULT_TOKENS = normalizedWordSet([
  "adult", "adults", "men", "man", "mens", "women", "woman", "womens", "성인", "남성", "여성",
]);

/** KIDS를 먼저 본다 — 아동 상품이 "girls women's-style"처럼 두 신호를 함께 다는
 * 일은 있어도, 성인 상품이 자신을 "kid"라고 부르는 일은 없다(match.ts의 기존
 * 규칙과 같은 근거). */
export function resolveAudienceGroup(signals: string[]): AudienceGroup | null {
  const tokens = new Set(signals.flatMap((s) => tokenizeFactText(s)));
  for (const token of tokens) if (KIDS_TOKENS.has(token)) return "KIDS";
  for (const token of tokens) if (ADULT_TOKENS.has(token)) return "ADULT";
  return null;
}

/**
 * 성별은 **성인 표기가 양쪽에 다 있을 때만** 읽는다. 아동복의 boy/girl은 상품의
 * 성질이라기보다 매장의 진열 칸이라서(같은 유니섹스 티셔츠가 한 판매처에서는
 * Boy, 다른 곳에서는 Girl에 걸린다) 이걸로 충돌을 선언하면 진짜 동일상품이
 * 무더기로 떨어진다. 실측에서도 Smallable은 모든 아동 상품을 "Boy" 아래에 두고
 * 있었다.
 */
export type GenderGroup = "MALE" | "FEMALE";

const MALE_TOKENS = normalizedWordSet(["men", "man", "mens", "남성"]);
const FEMALE_TOKENS = normalizedWordSet(["women", "woman", "womens", "여성"]);

export function resolveAdultGender(signals: string[]): GenderGroup | null {
  const tokens = new Set(signals.flatMap((s) => tokenizeFactText(s)));
  for (const token of tokens) if (FEMALE_TOKENS.has(token)) return "FEMALE";
  for (const token of tokens) if (MALE_TOKENS.has(token)) return "MALE";
  return null;
}

/* ───────────────────────────── 상품 사실 묶음 ───────────────────────────── */

/**
 * 한 판매처의 한 상품에 대해 **원문에 실제로 있던 사실만** 담는다. 없는 값은
 * null이고, 비교하는 쪽은 null을 "다름"이 아니라 "근거 없음"으로 읽는다.
 */
export interface ProductFacts {
  /** 비교에는 쓰지 않는다 — 쌍의 계산 순서를 고정하는 열쇠로만 쓴다(방향 대칭). */
  sourceUrl: string;
  urlSlug: string | null;
  brand: string | null;
  /**
   * 브랜드가 부여한 품번(Article/Product code, 예: B226AC114). 판매처가 스스로
   * 붙인 재고번호와 **절대 같은 칸에 넣지 않는다** — 그 둘을 섞은 것이 "SKU가
   * 다르니 다른 상품"이라는 틀린 규칙의 출발점이었다.
   */
  brandModelCode: string | null;
  /** 판매처 자신의 SKU(Smallable AAA1804922 등). 판정에 쓰지 않고 보존만 한다. */
  sellerSku: string | null;
  title: string;
  /** 브랜드/색상/소재 낱말을 걷어낸 핵심 상품명 토큰. 그 셋은 각자 별도 축으로
   * 이미 세고 있어서, 제목에 남겨두면 같은 근거를 두 번 세게 된다. */
  coreTitleTokens: string[];
  categoryText: string | null;
  colorText: string | null;
  materialText: string | null;
  fitText: string | null;
  ageRangeText: string | null;
  sizeLabels: string[];
  /** breadcrumb 조각, 상품 태그 등 대상 연령/성별을 읽을 수 있는 원문 조각들. */
  audienceSignals: string[];
  imageUrls: string[];
}

const TITLE_STOPWORDS = normalizedWordSet(["the", "an", "for", "and", "with", "by", "in", "of", "et", "le", "la"]);
const SEASON_CODE_RE = /^(ss|aw|fw|pe)\d{2}$/i;
const SIZE_LIKE_RE = /^\d{1,3}(y|m|cm|호)$/i;

/**
 * 핵심 상품명 토큰을 만든다. 브랜드/색상/소재 낱말과 시즌코드·사이즈 토큰을
 * 걷어낸다 — 남는 것이 "이 상품을 다른 상품과 구별하는 말"이다.
 *
 * 실측으로 확인한 효과: Smallable "Bobo Choses Zipped Sweat Organic Cotton |
 * Heather grey"에서 브랜드/색상/소재를 빼면 ["zipped","sweat"]만 남고, Bobo
 * 공식몰 "Bobo Choses Bolder half zipped sweatshirt"에서는 ["bolder","half",
 * "zipped","sweatshirt"]가 남는다. 공유 토큰 "zipped"는 우연이 아니라 실제로
 * 이 상품을 가리키는 말이다.
 */
export function buildCoreTitleTokens(
  title: string,
  noiseSources: (string | null | undefined)[],
): string[] {
  const noise = new Set<string>();
  for (const source of noiseSources) {
    if (!source) continue;
    for (const token of tokenizeFactText(source)) noise.add(token);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenizeFactText(title)) {
    if (noise.has(token) || TITLE_STOPWORDS.has(token)) continue;
    if (SEASON_CODE_RE.test(token) || SIZE_LIKE_RE.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/** URL의 마지막 경로 조각. Shopify(`/products/handle`)도 Smallable
 * (`/product/{slug}-{id}`)도 같은 방식으로 동작한다. */
export function extractUrlSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? normalizeFactText(last.replace(/\.html$/i, "")) : null;
  } catch {
    return null;
  }
}

/* ─────────────────────── 브랜드 품번(원문이 그렇게 부른 것만) ─────────────────────── */

/**
 * 설명문이 스스로 "Product code" / "Article code"라고 이름 붙인 값만 뽑는다.
 *
 * 정규식은 packages/crawler/description-facts.ts에 있던 것을 그대로 옮겨 왔고,
 * 그쪽은 이제 이 함수에 위임한다. 같은 개념의 정규식이 저장소 안에 이미 두 벌
 * 있었는데(description-facts, comparison-search/product-identity) 세 벌째를
 * 만들지 않기 위해서다. 실측 근거: junioredition.com "Product code B126AH013
 * SS26 Made in China.", PèPè "Article code: 01195-VERNICE-NERO."
 */
const LABELED_PRODUCT_CODE_RE = /\b(?:product|article)\s+code[:\s]+([A-Za-z0-9][A-Za-z0-9-]{2,29})\b/i;

export function extractLabeledProductCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = LABELED_PRODUCT_CODE_RE.exec(text);
  return match?.[1]?.trim() ?? null;
}

/**
 * 브랜드 공식몰이 URL 앞머리에 품번을 그대로 붙여두는 경우만 읽는다(실측:
 * bobochoses.com `b226ac114-bobo-choses-bolder-half-zipped-sweatshirt`).
 *
 * 첫 조각만 본다. 뒤쪽 조각까지 훑으면 상품명 안의 숫자(사이즈/연도)를 품번으로
 * 오인한다. 그리고 판매처 재고번호가 여기 걸리지 않는지가 중요한데, 실측한 두
 * 형태 모두 안전하게 빠진다 — Smallable 슬러그의 첫 조각은 "bobo"(숫자 없음),
 * 마지막 조각은 "430701"(글자 없음)이라 어느 쪽도 조건을 못 넘는다.
 */
const MIN_SLUG_CODE_LENGTH = 6;
const MAX_SLUG_CODE_LENGTH = 20;

export function extractCodeLikeSlugSegment(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const first = slug.split("-").filter(Boolean)[0];
  if (!first) return null;
  if (first.length < MIN_SLUG_CODE_LENGTH || first.length > MAX_SLUG_CODE_LENGTH) return null;
  if (!/^[a-z0-9]+$/.test(first)) return null;
  if (!/[a-z]/.test(first) || !/[0-9]/.test(first)) return null;
  return first.toUpperCase();
}
