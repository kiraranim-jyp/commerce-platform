/**
 * P1-1(Brand Resolver) — 크롤러가 뽑아온 브랜드 문자열에 시즌/프로모션 문구가
 * 섞여 오는 경우가 흔하다(실측: "Bobo Choses SS26 Baby 50% Off Sale" — 실제
 * 브랜드는 "Bobo Choses"뿐). AI로 추측하지 않고 알려진 마케팅 토큰을 만나는
 * 지점에서 뒤를 잘라내는 결정론적 규칙이다 — description-facts.ts와 같은 원칙
 * ("모른다 → 규칙으로 찾아본다 → 그래도 모르면 원본 그대로").
 *
 * Explainable — 어떤 Rule이 왜 적용됐는지 항상 함께 반환한다(CPO 요구사항:
 * "Raw → Rule Applied → Cleaned → Confidence"). 이 파일은 앞으로 Category/
 * Notice/Option Resolver가 따라갈 템플릿이다 — 다른 Resolver를 만들 때도
 * {원본, 정제값, 적용된 규칙 목록, 신뢰도, 바뀌었는지} 모양을 그대로 따른다.
 *
 * 세 가지 규칙 카테고리:
 * - SEASON_CODE: 시즌 코드(SS26/AW25/FW26 등). 브랜드 이름에 우연히 들어갈
 *   가능성이 사실상 없다 → HIGH.
 * - MARKETING_SUFFIX: sale/%off/kids/baby/official/now/collection/shop.
 *   자를 근거로는 충분하지만 "Tommy Hilfiger Kids"류 공식 서브라인일 가능성이
 *   남아있어 → LOW.
 * - NEW_COOCCURRENCE: "new". "New Balance"/"The New Society"처럼 브랜드
 *   이름 자체에 흔히 들어가는 단어라, SEASON_CODE나 MARKETING_SUFFIX가 문자열
 *   어딘가에 실제로 있어서 "이건 확실히 프로모션 문구다"가 확인됐을 때만 자르는
 *   후보에 넣는다 → LOW.
 *
 * 세 카테고리 모두 "문자열 맨 앞(index 0)"에서 매치되면 후보에서 제외한다 —
 * 거기 있는 단어는 브랜드 이름의 시작일 가능성이 높다("New Balance"의 "New").
 */

export type BrandResolverConfidence = "HIGH" | "LOW";
export type BrandResolverRule = "SEASON_CODE" | "MARKETING_SUFFIX" | "NEW_COOCCURRENCE";

export interface BrandResolution {
  raw: string;
  /** 정제 결과 — 규칙에 안 걸리면 raw와 동일. */
  cleaned: string;
  changed: boolean;
  /** changed가 true일 때만 있다. */
  confidence?: BrandResolverConfidence;
  /** 원문에서 실제로 발견된(그리고 자르는 후보가 될 자격이 있었던) 규칙
   * 카테고리 전부 — 어느 것이 실제로 잘랐는지와 무관하게, "왜 이 문자열이
   * 의심스러웠는지" 전체를 보여준다(디버깅용). 고정 순서(SEASON_CODE →
   * MARKETING_SUFFIX → NEW_COOCCURRENCE)로 반환한다. */
  ruleApplied: BrandResolverRule[];
  /** 실제로 잘라낸 지점의 토큰 원문(디버깅/로그용). */
  matchedToken?: string;
}

/** P-13A(대표님/CPO 지시, 2026-08-31) — 실측 확인(2026-08-31): 약어 시즌코드만
 * 잡던 기존 패턴이 풀어쓴 시즌명("Summer 26"/"Winter 25"/"Fall 26")을 놓쳐서
 * 그 문자열이 그대로 브랜드명이 돼버리는 걸 확인했다(Konges Sløjd Summer 26
 * Drop 1, Misha & Puff Winter 25 등). 결정론적 규칙 확장이지 AI 추측이
 * 아니다 — 같은 SEASON_CODE 카테고리/HIGH 신뢰도를 유지한다. */
const SEASON_CODE_PATTERN = /\b(?:SS|AW|FW|SU|WI)\d{2}\b|\b(?:Spring|Summer|Fall|Autumn|Winter)\s?\d{2}\b/gi;
/** P-13B(대표님/CPO 지시, 2026-08-31) — 실측 확인: "Konges Slojd Clothing"/
 * "Konges Sløjd Clothing"이 "Konges Sløjd Summer 26 Drop 1"(시즌명 제거 후
 * "Konges Sløjd")과 다른 브랜드 키로 분리돼 있었다. "Clothing"이 브랜드명
 * 뒤에 붙는 카테고리성 접미어인 경우가 있어 MARKETING_SUFFIX에 추가한다 —
 * 결정론적 규칙 확장, alias/AI 추측 아님. */
const MARKETING_SUFFIX_PATTERN =
  /\bsale\b|\bkids\b|\bbaby\b|\bofficial\b|\bnow\b|\bcollection\b|\bshop\b|\bclothing\b|\d{1,3}%\s*off\b/gi;
const NEW_COOCCURRENCE_PATTERN = /\bnew\b/gi;

const RULE_ORDER: BrandResolverRule[] = ["SEASON_CODE", "MARKETING_SUFFIX", "NEW_COOCCURRENCE"];

interface RuleCandidate {
  rule: BrandResolverRule;
  index: number;
  token: string;
}

/** pattern으로 trimmed 전체를 훑어서 index > 0인 첫 매치를 찾는다. 없으면 null. */
function earliestMatchAfterStart(trimmed: string, pattern: RegExp): RegExpExecArray | null {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(trimmed))) {
    if (match.index > 0) return match;
  }
  return null;
}

/** 세 카테고리 중 문자열 맨 앞이 아닌 위치에 실제로 있는 것들만 후보로 모은다.
 * NEW_COOCCURRENCE는 SEASON_CODE/MARKETING_SUFFIX 중 하나라도 후보에 있을
 * 때만(=이 문자열이 프로모션 문구임이 이미 확인됐을 때만) 포함시킨다. */
function findCandidates(trimmed: string): RuleCandidate[] {
  const candidates: RuleCandidate[] = [];

  const season = earliestMatchAfterStart(trimmed, SEASON_CODE_PATTERN);
  if (season) candidates.push({ rule: "SEASON_CODE", index: season.index, token: season[0] });

  const suffix = earliestMatchAfterStart(trimmed, MARKETING_SUFFIX_PATTERN);
  if (suffix) candidates.push({ rule: "MARKETING_SUFFIX", index: suffix.index, token: suffix[0] });

  if (candidates.length > 0) {
    const weak = earliestMatchAfterStart(trimmed, NEW_COOCCURRENCE_PATTERN);
    if (weak) candidates.push({ rule: "NEW_COOCCURRENCE", index: weak.index, token: weak[0] });
  }

  return candidates;
}

/** MARKETING_SUFFIX 안에서도 sale/%off는 브랜드 이름에 우연히 들어갈 가능성이
 * 시즌코드만큼이나 낮다 — kids/baby/official/now/collection/shop과 신뢰도를
 * 나눠서 판정한다(CPO 예시: SS26→HIGH, Kids 단독→LOW, 반면 SALE/%off도 HIGH가
 * 맞다 — "Sale"이 진짜 브랜드 이름의 일부인 경우는 사실상 없다). */
const HIGH_CONFIDENCE_SUFFIX_PATTERN = /^sale$|^\d{1,3}%\s*off$/i;

function classifyConfidence(rule: BrandResolverRule, matchedToken: string): BrandResolverConfidence {
  if (rule === "SEASON_CODE") return "HIGH";
  if (rule === "MARKETING_SUFFIX" && HIGH_CONFIDENCE_SUFFIX_PATTERN.test(matchedToken)) return "HIGH";
  return "LOW";
}

export function resolveBrandName(raw: string | undefined): BrandResolution | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const candidates = findCandidates(trimmed);
  if (candidates.length === 0) return { raw: trimmed, cleaned: trimmed, changed: false, ruleApplied: [] };

  const ruleApplied = RULE_ORDER.filter((rule) => candidates.some((c) => c.rule === rule));

  // 실제로 자르는 지점은 후보 중 가장 이른 위치.
  const cutCandidate = candidates.reduce((earliest, c) => (c.index < earliest.index ? c : earliest));
  const cleaned = trimmed.slice(0, cutCandidate.index).replace(/[\s\-–—,.:|/]+$/, "").trim();

  // 너무 짧게 잘리면(예: 오탐으로 브랜드 이름 대부분이 날아간 경우) 지어내지
  // 않고 원본을 그대로 돌려준다 — 자리표시자보다 "덜 정제된 원본"이 낫다.
  if (cleaned.length < 2) return { raw: trimmed, cleaned: trimmed, changed: false, ruleApplied: [] };

  return {
    raw: trimmed,
    cleaned,
    changed: true,
    confidence: classifyConfidence(cutCandidate.rule, cutCandidate.token),
    ruleApplied,
    matchedToken: cutCandidate.token,
  };
}

export function cleanBrandName(raw: string | undefined): string | undefined {
  return resolveBrandName(raw)?.cleaned;
}

/** P-13A — Brand Market Profile 집계용 그룹핑 키. 표시용 브랜드명(displayBrand)은
 * 절대 안 바꾼다("Konges Sløjd"는 화면에 그대로 보여준다) — 이 키는 비교/집계
 * 전용이다. 두 단계:
 * 1) NFD 정규화 + combining mark 제거 — "Pèpè"처럼 결합형 발음기호(e+`)는 이걸로
 *    "Pepe"가 된다.
 * 2) 결합형이 아닌 별개 문자(ø/æ/œ/ß 등, NFD로 안 풀리는 노르딕/유럽 문자) —
 *    실측 확인(Konges Sløjd)된 것만 명시적 매핑. 새 문자를 발견하면 여기 추가한다
 *    (추측 금지, 실제로 문제된 문자만).
 * 3) 소문자화 + 공백 정리.
 * "무리하게 합치지 않는다"(CPO 명시) — 이 함수는 철자/표기 차이만 접고, 시즌
 * suffix 제거(resolveBrandName)는 이미 앞단에서 끝난 뒤의 값에만 적용한다. */
const NON_COMBINING_DIACRITIC_MAP: Record<string, string> = {
  ø: "o",
  Ø: "O",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  å: "a",
  Å: "A",
  ß: "ss",
};

export function normalizeBrandKey(displayBrand: string): string {
  const withoutCombiningDiacritics = displayBrand.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const withoutNonCombining = [...withoutCombiningDiacritics]
    .map((ch) => NON_COMBINING_DIACRITIC_MAP[ch] ?? ch)
    .join("");
  return withoutNonCombining.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface ResolvedBrand {
  rawBrand: string;
  /** 시즌/마케팅 문구만 제거한 표시용 브랜드명 — UI에 그대로 보여준다. */
  displayBrand: string;
  /** Brand Market Profile 집계·비교 전용 키. UI에 노출하지 않는다. */
  normalizedBrandKey: string;
}

export function resolveBrand(raw: string | undefined): ResolvedBrand | undefined {
  const resolution = resolveBrandName(raw);
  if (!resolution) return undefined;
  return {
    rawBrand: resolution.raw,
    displayBrand: resolution.cleaned,
    normalizedBrandKey: normalizeBrandKey(resolution.cleaned),
  };
}
