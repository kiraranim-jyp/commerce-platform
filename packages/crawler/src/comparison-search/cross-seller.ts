/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 판매처가 다른 두 상품이 같은 물건인지
 * 판정한다. 어느 쪽에서 출발해도 같은 답이 나와야 한다.
 *
 * ══ 이 파일이 기존 판정기와 다른 점 ═══════════════════════════════════════════
 *
 * scoreCandidateMatch()는 "질의"와 "후보"를 구분한다. 그래서 질의 쪽에만 적용되는
 * 규칙이 실제로 있다(예: 질의 색상이 4자 이상이면 후보 제목에서 그 말을 찾아본다).
 * 그런 규칙이 하나라도 있으면 A→B와 B→A가 다른 답을 낼 수 있다. 실제로 그랬다.
 *
 * 여기서는 "질의"와 "후보"라는 개념 자체를 없앤다. 두 개의 ProductFacts가 있고,
 * 둘 사이의 관계만 있다. 방향 대칭은 관례가 아니라 구조로 보장한다 — 아래
 * orderPair()가 두 쪽을 **고정된 순서**로 다시 세운 뒤에야 계산이 시작되므로,
 * compare(a,b)와 compare(b,a)는 말 그대로 동일한 계산을 실행한다.
 *
 * ══ 증거는 합산하되, 대체하지 않는다 ═════════════════════════════════════════
 *
 * 어떤 비식별자 신호 하나도 혼자서 "동일상품"을 만들 수 없다. 색상이 같다고,
 * 소재가 같다고, 제목이 비슷하다고 동일상품이 되지 않는다 — 같은 브랜드 안에서
 * 그런 일치는 흔하다. 서로 다른 축에서 최소 SAME_MIN_AXES개가 동시에 맞을 때만
 * 동일상품이라고 말한다. 식별자(브랜드 품번)가 실제로 일치할 때만 예외인데,
 * 그건 식별자가 바로 "같은 상품"의 정의이기 때문이다.
 *
 * ══ 강한 반증은 점수로 뒤집을 수 없다 ════════════════════════════════════════
 *
 * 성인↔아동, 남성↔여성, 상품군 충돌, 명백한 색상 충돌, 모델코드 충돌 —
 * 이 다섯은 점수를 **보기 전에** 판정을 끝낸다(evaluate()의 첫 return). 점수가
 * 아무리 높아도 도달할 수 없는 자리에 있다는 뜻이고, 구조상 역전이 불가능하다.
 * 실측 근거: B226AC114(아동 스웨트셔츠)와 B226AD013(여성 티셔츠)은 제목·소재·
 * 브랜드가 전부 겹쳐서 텍스트 점수로는 높게 나오지만, 대상 연령층과 색상이
 * 서로 반증한다.
 */
import {
  buildSizeProfile,
  extractUrlSlug,
  materialCompositionKey,
  normalizeFactText,
  parseMaterialComposition,
  resolveAdultGender,
  resolveAudienceGroup,
  resolveColorHueGroups,
  resolveGarmentForms,
  tokenizeFactText,
  type AudienceGroup,
  type ColorHueGroup,
  type GarmentForm,
  type GenderGroup,
  type ProductFacts,
  type SizeSystem,
} from "@commerce/shared";
import { extractCategoryTaxon, type CategoryTaxon } from "./match";
import { compareModelCode } from "./model-code";

/** match-display.ts(apps/admin)의 MatchDisplayTier와 같은 말을 쓴다 — 판정과
 * 표시가 다른 어휘를 쓰면 "🟢이 무슨 뜻이냐"가 화면마다 달라진다. */
export type CrossSellerVerdict = "SAME" | "PRESUMED_SAME" | "SIMILAR" | "UNKNOWN" | "CONFLICT";

export type CrossSellerConflict =
  | "AUDIENCE"
  | "GENDER"
  | "CATEGORY"
  | "COLOR"
  | "MODEL_CODE"
  | "BRAND";

/** SAME으로 올라가는 것을 막지만, CONFLICT로 끌어내리지는 않는 반증. "다르다고
 * 말할 만큼은 아니지만, 같다고 확정할 수는 없다"는 상태다. */
export type CrossSellerBlocker =
  | "MATERIAL"
  | "FIT"
  | "SIZE_SYSTEM"
  | "BRAND_UNCONFIRMED"
  | "NO_TITLE_OVERLAP"
  | "GARMENT_FORM";

export type CrossSellerAxis =
  | "TITLE"
  | "MODEL_CODE"
  | "CATEGORY"
  | "COLOR"
  | "MATERIAL"
  | "FIT"
  | "AUDIENCE"
  | "SIZE"
  | "IMAGE";

export interface CrossSellerMatch {
  verdict: CrossSellerVerdict;
  /** 어떤 축이 몇 점씩 근거가 됐는지. 점수 하나로 뭉개지 않는다 — "왜 91%인가"가
   * 아니라 "무슨 근거로 같다고 봤는가"를 사람이 읽을 수 있어야 한다. */
  axes: { axis: CrossSellerAxis; points: number; detail: string }[];
  conflicts: { conflict: CrossSellerConflict; detail: string }[];
  blockers: { blocker: CrossSellerBlocker; detail: string }[];
  /** 식별자(브랜드 품번/URL 품번)로 확정됐는지. 가격 정책이 "동일상품 확인"을
   * 이 값과 verdict로 판단한다. */
  identifierConfirmed: boolean;
  /** 사람이 읽는 한 줄 근거 목록(화면/로그용). */
  reasons: string[];
}

/** 이미지 증거는 호출부가 미리 계산해서 넣어준다 — 이 함수는 네트워크를 모른다
 * (순수 함수여야 같은 입력에 늘 같은 답이 나오고, 테스트가 고정된다). */
export interface CrossSellerImageEvidence {
  minDistance: number | null;
}

/**
 * 이미지 거리 임계값을 여기서 따로 정하는 이유.
 *
 * image-evidence.ts의 기존 기준(<=10)은 "같은 파일인가"를 묻는 중복제거용 값이라,
 * 판매처가 각자 촬영한 사진에는 원리상 한 번도 걸리지 않는다(실측 3쌍 전부
 * 100 언저리). 그 기준을 그대로 둔 채 매칭에 연결하면 이미지 축은 항상 "근거
 * 없음"이고, 연결하지 않은 것과 똑같다.
 *
 * 실측값은 동일상품 86 < 완전히 다른 상품 107 < 유사한 다른 상품 119였다. 순서
 * 자체는 옳다. 그래서 유일하게 측정된 동일상품(86)과 가장 가까운 비동일상품
 * (107) 사이에, 양쪽에 여유를 두고 선을 긋는다.
 *
 * 다만 측정이 3쌍뿐이다. 그래서 이 축은 **SAME 판정의 정원에 들어가지 못한다**
 * (evaluate()의 coreAxisCount에서 IMAGE를 뺀다). 이미지는 SIMILAR을 PRESUMED_SAME
 * 으로 올릴 수는 있어도, 혼자 힘으로 가격 비교에 쓰이는 등급을 만들지는 못한다.
 * 쌍이 더 쌓이면 그때 정원에 넣을지 다시 본다.
 */
export const CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE = 95;

/** 서로 다른 축 몇 개가 동시에 맞아야 "동일상품"이라고 말할 것인가.
 *
 * ── 여기 있던 근거는 실측으로 틀렸다(MATCHING-2.0-INTEGRATION-3, 2026-09-13) ──
 * 원래 이 자리에는 이렇게 적혀 있었다: "상품군=스웨트셔츠 · 색상=회색 계열 ·
 * 소재=Organic Cotton 100% · 핏=Loose fit · 대상=아동 · 사이즈 체계=연령형을
 * 동시에 만족하는 것은 B226AC114 하나뿐이다." 표본이 여섯 개 상품이었다.
 *
 * bobochoses.com 카탈로그 전체(3,000건)를 실제로 받아 세어 보니 그 여섯 조건을
 * 동시에 만족하는 상품은 하나가 아니라 **최소 여섯 개**다. 색상·소재·핏이 전부
 * 설명문 한 문장에서 나오는데, "Light heather grey sweatshirt. Organic Cotton
 * 100%. Loose fit. Responsibly made in Portugal."이라는 **글자 하나까지 같은
 * 문장을 여섯 상품이 공유**하기 때문이다(B226AC114, B226AC049, B226AC027,
 * B226AC036, B226AB055, B226AB058). 즉 그 세 축은 독립된 세 근거가 아니라 한
 * 문장을 세 번 센 것이고, 상품군·대상·사이즈는 아동 라인의 상수다.
 *
 * ── 그래서 이 숫자를 올리지 않았다 ──────────────────────────────────────────
 * 숫자를 6으로 올려도 위 여섯 상품은 여전히 전부 통과한다(점수가 7점이다).
 * 문제는 개수가 아니라 **세는 축이 상품을 구별하지 못한다**는 것이라, 숫자로는
 * 고쳐지지 않는다. 대신 구별하는 축(제목이 말하는 옷의 형태, GarmentForm)을
 * 판정에 들여보냈다 — compareGarmentForm 주석 참고. */
const SAME_MIN_AXES = 5;
const PRESUMED_SAME_MIN_AXES = 3;

/** 제목 토큰 겹침이 이 이상이면 "핵심 상품명이 같다"고 본다(Jaccard). */
const STRONG_TITLE_OVERLAP = 0.5;

/* ─────────────────────────── 대칭 보조 함수 ─────────────────────────── */

function intersects<T>(a: Set<T>, b: Set<T>): boolean {
  for (const value of a) if (b.has(value)) return true;
  return false;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const value of a) if (b.has(value)) out.push(value);
  return out.sort();
}

/** 브랜드 이름은 판매처마다 표기가 조금씩 다르다(대소문자, 구두점). 한쪽이 다른
 * 쪽을 품는 경우까지 같은 것으로 본다 — includes는 양방향을 둘 다 확인하므로
 * 대칭이다. */
function brandsCompatible(a: string, b: string): boolean {
  const na = normalizeFactText(a).replace(/\s+/g, " ");
  const nb = normalizeFactText(b).replace(/\s+/g, " ");
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * 두 쪽을 고정된 순서로 다시 세운다.
 *
 * 방향 대칭을 "모든 규칙을 대칭으로 짰다"는 약속에만 기대지 않기 위한 장치다.
 * 여기서 순서를 고정해 버리면, 인자를 어떤 순서로 넘기든 그 다음 코드는 완전히
 * 같은 두 값을 같은 자리에서 본다 — 대칭이 아닌 규칙을 실수로 하나 넣더라도
 * 답은 여전히 방향에 무관하다. 열쇠는 비교에 쓰이지 않는 값(URL)만 쓴다.
 */
function orderPair(a: ProductFacts, b: ProductFacts): [ProductFacts, ProductFacts] {
  const keyA = `${a.sourceUrl} ${a.urlSlug ?? ""} ${a.title}`;
  const keyB = `${b.sourceUrl} ${b.urlSlug ?? ""} ${b.title}`;
  return keyA <= keyB ? [a, b] : [b, a];
}

/* ─────────────────────────── 축별 판정 ─────────────────────────── */

type AxisOutcome = "match" | "mismatch" | "unknown";

function compareAudience(x: ProductFacts, y: ProductFacts): {
  outcome: AxisOutcome;
  values: [AudienceGroup | null, AudienceGroup | null];
} {
  // 상품군/제목만으로는 안 잡히던 신호다 — 사이트 자신의 분류(breadcrumb)와
  // 상품 태그를 함께 읽는다. 사이즈 표기도 신호다: 연령형 사이즈("2-3Y")는
  // 아동복이라는 사실을 원문이 직접 말해주는 것이다.
  const signalsOf = (facts: ProductFacts): string[] => {
    const ageSizes = buildSizeProfile(facts.sizeLabels);
    return [
      ...facts.audienceSignals,
      ...(facts.ageRangeText ? [facts.ageRangeText] : []),
      ...(ageSizes.systems.has("AGE") ? ["kids"] : []),
      facts.title,
    ];
  };
  const left = resolveAudienceGroup(signalsOf(x));
  const right = resolveAudienceGroup(signalsOf(y));
  if (!left || !right) return { outcome: "unknown", values: [left, right] };
  return { outcome: left === right ? "match" : "mismatch", values: [left, right] };
}

function compareGender(x: ProductFacts, y: ProductFacts): {
  outcome: AxisOutcome;
  values: [GenderGroup | null, GenderGroup | null];
} {
  const left = resolveAdultGender(x.audienceSignals);
  const right = resolveAdultGender(y.audienceSignals);
  if (!left || !right) return { outcome: "unknown", values: [left, right] };
  return { outcome: left === right ? "match" : "mismatch", values: [left, right] };
}

function taxonOf(facts: ProductFacts): CategoryTaxon | null {
  // 카테고리 원문이 있으면 그것을 먼저 본다(사이트 자신의 분류가 제목보다
  // 정확하다). 없으면 제목으로 내려간다 — 기존 extractCategoryTaxon을 그대로
  // 재사용한다(새 어휘를 만들지 않는다).
  return extractCategoryTaxon(facts.categoryText ?? "") ?? extractCategoryTaxon(facts.title);
}

function compareCategory(x: ProductFacts, y: ProductFacts): {
  taxonOutcome: AxisOutcome;
  textOutcome: AxisOutcome;
  detail: string;
} {
  const taxonX = taxonOf(x);
  const taxonY = taxonOf(y);
  const taxonOutcome: AxisOutcome =
    !taxonX || !taxonY ? "unknown" : taxonX === taxonY ? "match" : "mismatch";

  const textX = new Set(x.categoryText ? tokenizeFactText(x.categoryText) : []);
  const textY = new Set(y.categoryText ? tokenizeFactText(y.categoryText) : []);
  const textOutcome: AxisOutcome =
    textX.size === 0 || textY.size === 0 ? "unknown" : intersects(textX, textY) ? "match" : "mismatch";

  const shared = sharedTokens(textX, textY);
  const detail = shared.length > 0 ? `상품군 ${shared.join("/")}` : `상품군 ${taxonX ?? "?"}↔${taxonY ?? "?"}`;
  return { taxonOutcome, textOutcome, detail };
}

/**
 * 두 상품의 **제목이 말하는 옷의 형태**를 견준다.
 *
 * 판매처 자신의 분류(categoryText)는 보지 않는다. 그건 이미 compareCategory가
 * 보고 있고, 무엇보다 그 칸은 판매처의 진열 칸이라 형태를 말해주지 않는다 —
 * Bobo는 후드집업(B226AC049)도 하프집업 스웨트셔츠(B226AC114)도 똑같이
 * type="Sweatshirts"에 넣는다(실측). 상품 자신의 이름만이 형태를 말한다.
 *
 * 한쪽이라도 형태를 말하지 않으면 "모름"이다. 겹치는 형태가 하나라도 있으면
 * "일치"다("hooded sweatshirt" ↔ "sweatshirt"는 겹친다). 양쪽 다 말했는데 하나도
 * 겹치지 않을 때만 "불일치"다.
 */
function compareGarmentForm(x: ProductFacts, y: ProductFacts): { outcome: AxisOutcome; detail: string } {
  const left = resolveGarmentForms(x.title);
  const right = resolveGarmentForms(y.title);
  const show = (s: Set<GarmentForm>) => [...s].sort().join("/");
  if (left.size === 0 || right.size === 0) return { outcome: "unknown", detail: "옷의 형태를 읽지 못했다" };
  return intersects(left, right)
    ? { outcome: "match", detail: `옷의 형태 ${show(left)}` }
    : { outcome: "mismatch", detail: `옷의 형태 ${show(left)} ↔ ${show(right)}` };
}

function compareColor(x: ProductFacts, y: ProductFacts): {
  outcome: AxisOutcome;
  groups: [Set<ColorHueGroup>, Set<ColorHueGroup>];
} {
  const left = resolveColorHueGroups(x.colorText);
  const right = resolveColorHueGroups(y.colorText);
  if (left.size === 0 || right.size === 0) return { outcome: "unknown", groups: [left, right] };
  return { outcome: intersects(left, right) ? "match" : "mismatch", groups: [left, right] };
}

function compareMaterial(x: ProductFacts, y: ProductFacts): { outcome: AxisOutcome; detail: string } {
  const left = parseMaterialComposition(x.materialText);
  const right = parseMaterialComposition(y.materialText);
  if (left.length === 0 || right.length === 0) return { outcome: "unknown", detail: "소재 정보 없음" };
  const keyLeft = materialCompositionKey(left);
  const keyRight = materialCompositionKey(right);
  return keyLeft === keyRight
    ? { outcome: "match", detail: `소재 ${keyLeft}` }
    : { outcome: "mismatch", detail: `소재 ${keyLeft} ↔ ${keyRight}` };
}

function compareFit(x: ProductFacts, y: ProductFacts): { outcome: AxisOutcome; detail: string } {
  if (!x.fitText || !y.fitText) return { outcome: "unknown", detail: "핏 정보 없음" };
  return x.fitText === y.fitText
    ? { outcome: "match", detail: `핏 ${x.fitText}` }
    : { outcome: "mismatch", detail: `핏 ${x.fitText} ↔ ${y.fitText}` };
}

function compareSize(x: ProductFacts, y: ProductFacts): {
  systemOutcome: AxisOutcome;
  valueOutcome: AxisOutcome;
  detail: string;
} {
  const left = buildSizeProfile(x.sizeLabels);
  const right = buildSizeProfile(y.sizeLabels);
  if (left.systems.size === 0 || right.systems.size === 0) {
    return { systemOutcome: "unknown", valueOutcome: "unknown", detail: "사이즈 정보 없음" };
  }
  const systemOutcome: AxisOutcome = intersects(left.systems, right.systems) ? "match" : "mismatch";
  // 값의 불일치로는 "다르다"고 말하지 않는다 — 한쪽에 4/5세만, 다른 쪽에 12/13세만
  // 남는 일은 재고 때문에 늘 생긴다. 겹치면 근거로 쓰고, 안 겹치면 침묵한다.
  const valueOutcome: AxisOutcome = intersects(left.values, right.values) ? "match" : "unknown";
  const systems = (s: Set<SizeSystem>) => [...s].sort().join("/");
  return {
    systemOutcome,
    valueOutcome,
    detail: `사이즈 체계 ${systems(left.systems)} ↔ ${systems(right.systems)}`,
  };
}

/** 한쪽의 브랜드 품번이 다른 쪽 URL 안에 그대로 들어 있는지. 실측: Bobo 공식몰
 * handle이 `b226ac114-…`로 시작한다. 양쪽을 다 확인하므로 대칭이다. */
function slugCarriesCode(facts: ProductFacts, code: string | null): boolean {
  if (!code || code.length < 4) return false;
  const slug = facts.urlSlug ?? extractUrlSlug(facts.sourceUrl);
  if (!slug) return false;
  return slug.replace(/[^a-z0-9]/g, "").includes(normalizeFactText(code).replace(/[^a-z0-9]/g, ""));
}

/* ─────────────────────────── 본 판정 ─────────────────────────── */

export function compareCrossSellerProducts(
  a: ProductFacts,
  b: ProductFacts,
  image?: CrossSellerImageEvidence,
): CrossSellerMatch {
  const [x, y] = orderPair(a, b);

  const axes: CrossSellerMatch["axes"] = [];
  const conflicts: CrossSellerMatch["conflicts"] = [];
  const blockers: CrossSellerMatch["blockers"] = [];

  /* ── 1. 강한 반증부터 모은다 ── */

  const brandKnown = Boolean(x.brand && y.brand);
  const brandOk = brandKnown && brandsCompatible(x.brand!, y.brand!);
  if (brandKnown && !brandOk) {
    conflicts.push({ conflict: "BRAND", detail: `브랜드 ${x.brand} ↔ ${y.brand}` });
  }

  const audience = compareAudience(x, y);
  if (audience.outcome === "mismatch") {
    conflicts.push({ conflict: "AUDIENCE", detail: `대상 ${audience.values[0]} ↔ ${audience.values[1]}` });
  }

  const gender = compareGender(x, y);
  if (gender.outcome === "mismatch") {
    conflicts.push({ conflict: "GENDER", detail: `성별 ${gender.values[0]} ↔ ${gender.values[1]}` });
  }

  const category = compareCategory(x, y);
  if (category.taxonOutcome === "mismatch") {
    conflicts.push({ conflict: "CATEGORY", detail: category.detail });
  }

  const color = compareColor(x, y);
  if (color.outcome === "mismatch") {
    const groups = (g: Set<ColorHueGroup>) => [...g].sort().join("/");
    conflicts.push({ conflict: "COLOR", detail: `색상 ${groups(color.groups[0])} ↔ ${groups(color.groups[1])}` });
  }

  // 브랜드 품번 비교는 compareModelCode(P-10-F)를 그대로 쓴다 — 접두사를 공유하다
  // 갈라지면 충돌이라는 규칙이 B226AC042↔B226AC043을 지켜주고 있고, 그 규칙을
  // 여기서 다시 쓰면 같은 보호가 그대로 적용된다. 한쪽이라도 품번이 없으면
  // "unavailable"이고, 그건 충돌이 아니다 — 판매처가 서로 다른 SKU를 쓰는 것이
  // 정상이라는 이 작업의 출발점이 바로 그것이다.
  const modelCode = compareModelCode(x.brandModelCode, y.brandModelCode);
  if (modelCode === "conflict") {
    conflicts.push({ conflict: "MODEL_CODE", detail: `모델코드 ${x.brandModelCode} ↔ ${y.brandModelCode}` });
  }

  if (conflicts.length > 0) {
    // 점수를 계산하지도, 보지도 않는다. 여기서 끝난다.
    return {
      verdict: "CONFLICT",
      axes: [],
      conflicts,
      blockers,
      identifierConfirmed: false,
      reasons: conflicts.map((c) => `충돌: ${c.detail}`),
    };
  }

  /* ── 2. 식별자 증거 ── */

  const identifierConfirmed =
    modelCode === "exact" || slugCarriesCode(x, y.brandModelCode) || slugCarriesCode(y, x.brandModelCode);

  /* ── 3. 나머지 축을 센다 ── */

  // 상품유형을 가리키는 말(shirt/sweatshirt/pants…)은 제목 축에서 뺀다. 그 말은
  // 이미 CATEGORY 축이 세고 있어서 남겨두면 같은 근거를 두 번 세는 셈이고, 더
  // 나쁘게는 제목이 짧을 때 유형어 하나만 겹쳐도 "상품명이 거의 같다"가 된다.
  // 실측 사례: Smallable "Bobo Choses Organic Cotton T-shirt"는 브랜드·소재·유형을
  // 빼고 나면 남는 말이 없다 — 그 사실이 드러나야 정직하다.
  const distinctive = (tokens: string[]) => new Set(tokens.filter((t) => extractCategoryTaxon(t) === null));
  const titleX = distinctive(x.coreTitleTokens);
  const titleY = distinctive(y.coreTitleTokens);
  const titleOverlap = jaccard(titleX, titleY);
  const titleShared = sharedTokens(titleX, titleY);
  if (titleOverlap >= STRONG_TITLE_OVERLAP) {
    axes.push({ axis: "TITLE", points: 2, detail: `핵심 상품명 ${titleShared.join("/")}` });
  } else if (titleOverlap > 0) {
    axes.push({ axis: "TITLE", points: 1, detail: `핵심 상품명 일부 ${titleShared.join("/")}` });
  } else {
    blockers.push({ blocker: "NO_TITLE_OVERLAP", detail: "핵심 상품명에 겹치는 말이 없다" });
  }

  if (modelCode === "partial") {
    axes.push({ axis: "MODEL_CODE", points: 2, detail: `모델코드 부분 일치 ${x.brandModelCode}/${y.brandModelCode}` });
  }
  if (category.taxonOutcome === "match" || category.textOutcome === "match") {
    axes.push({ axis: "CATEGORY", points: 1, detail: category.detail });
  }
  if (color.outcome === "match") {
    const groups = [...color.groups[0]].sort().join("/");
    axes.push({ axis: "COLOR", points: 1, detail: `색상 ${groups}` });
  }

  const material = compareMaterial(x, y);
  if (material.outcome === "match") axes.push({ axis: "MATERIAL", points: 1, detail: material.detail });
  if (material.outcome === "mismatch") blockers.push({ blocker: "MATERIAL", detail: material.detail });

  const fit = compareFit(x, y);
  if (fit.outcome === "match") axes.push({ axis: "FIT", points: 1, detail: fit.detail });
  if (fit.outcome === "mismatch") blockers.push({ blocker: "FIT", detail: fit.detail });

  if (audience.outcome === "match") {
    axes.push({ axis: "AUDIENCE", points: 1, detail: `대상 ${audience.values[0]}` });
  }

  // 일치해도 점수를 주지 않는다(불일치에만 보류). 의도한 비대칭이다 — 새 신호가
  // 기존 쌍의 점수를 한 점도 움직이지 않는다는 것을 산술로 보장하는 가장 단순한
  // 방법이고, match.ts의 AudienceTaxon이 같은 이유로 이미 쓰는 방식이다.
  const garment = compareGarmentForm(x, y);
  if (garment.outcome === "mismatch") blockers.push({ blocker: "GARMENT_FORM", detail: garment.detail });

  const size = compareSize(x, y);
  if (size.systemOutcome === "mismatch") blockers.push({ blocker: "SIZE_SYSTEM", detail: size.detail });
  if (size.systemOutcome === "match" && size.valueOutcome === "match") {
    axes.push({ axis: "SIZE", points: 1, detail: size.detail });
  }

  if (
    image?.minDistance !== null &&
    image?.minDistance !== undefined &&
    image.minDistance <= CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE
  ) {
    axes.push({ axis: "IMAGE", points: 1, detail: `대표 이미지 거리 ${image.minDistance}` });
  }

  if (!brandOk) {
    blockers.push({ blocker: "BRAND_UNCONFIRMED", detail: "양쪽 브랜드를 확인하지 못했다" });
  }

  /* ── 4. 등급 ── */

  const totalPoints = axes.reduce((sum, axis) => sum + axis.points, 0);
  // 이미지 축은 SAME의 정원에 넣지 않는다(위 CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE
  // 주석 참고) — 실측 표본이 3쌍뿐이라 가격에 쓰이는 등급을 혼자 만들게 둘 수 없다.
  const corePoints = axes
    .filter((axis) => axis.axis !== "IMAGE")
    .reduce((sum, axis) => sum + axis.points, 0);

  const verdict = ((): CrossSellerVerdict => {
    if (identifierConfirmed) return "SAME";
    const blocked = blockers.length > 0;
    if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";
    if (totalPoints >= PRESUMED_SAME_MIN_AXES) return "PRESUMED_SAME";
    if (totalPoints >= 1) return "SIMILAR";
    return "UNKNOWN";
  })();

  const reasons = [
    ...axes.map((axis) => `근거: ${axis.detail}`),
    ...blockers.map((blocker) => `보류: ${blocker.detail}`),
  ];
  if (identifierConfirmed) reasons.unshift("근거: 브랜드 품번 일치");

  return { verdict, axes, conflicts, blockers, identifierConfirmed, reasons };
}

/** 🟢 동일상품으로 확인된 것만 가격 비교에 쓴다(가격 정책, CEO 지시). 🟡/⚪는
 * 화면에 참고로만 남고 동일상품 가격 판단에는 절대 들어가지 않는다. */
export function isSameProductForPricing(match: CrossSellerMatch): boolean {
  return match.verdict === "SAME";
}
