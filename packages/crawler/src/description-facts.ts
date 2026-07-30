/**
 * Sprint C(Compliance Resolver) — "모른다 → FAIL" 대신 "모른다 → 원문에서
 * 찾아본다 → 그래도 없으면 FAIL"로 가기 위한 첫 단계. AI 추측이 아니라 상품
 * 설명문에 실제로 적힌 표준 문구를 정규식으로 파싱한다 — 못 찾으면 undefined를
 * 반환하고 절대 지어내지 않는다(이 파일이 반환한 값은 항상 "원문에 실제로
 * 있었던 문자열"이어야 한다는 게 유일한 불변식).
 *
 * 실측 근거: junioredition.com의 실제 상품 설명 "...Product code B126AH013
 * SS26 Made in China."/"88% Polyester, 12% Elastane."에서 확인한 패턴.
 */

/** "Made in China", "제조국: 중국", "Country of Origin: Spain" 등 — 이 세
 * 표현이 이번 세션에 실제로 확인된 것 중 가장 표준적인 패턴이다. */
const COUNTRY_PATTERNS = [
  /made\s+in\s+([a-z][a-z\s]{1,20}?)(?:[.,;\n]|$)/i,
  /country\s+of\s+origin[:\s]+([a-z][a-z\s]{1,20}?)(?:[.,;\n]|$)/i,
  /제조국\s*[:：]\s*([가-힣]{1,10})/,
];

export function extractCountryOfOrigin(description: string | undefined): string | undefined {
  if (!description) return undefined;
  for (const pattern of COUNTRY_PATTERNS) {
    const match = pattern.exec(description);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** "88% Polyester, 12% Elastane" 같은 소재 구성비 목록 — 의류 상품 설명에서
 * 가장 흔한 표준 표기법. 처음엔 "숫자% + 아무 단어"로 느슨하게 매칭했다가
 * "50% Off Sale"/"30% discount" 같은 할인 문구를 소재로 잘못 인식하는 실제
 * 오탐을 확인했다(정규식 자체를 실제 문자열로 검증하는 과정에서 발견) — 그래서
 * 알려진 원단 이름 화이트리스트로 좁혔다. 목록에 없는 원단은 못 잡지만,
 * "틀린 값을 진짜인 것처럼 채우는 것"보다 "몇 가지는 못 잡아도 잡은 건 확실히
 * 맞는 것"이 이 파일의 불변식(원문에 실제로 있는 값만 반환)에 맞다. */
const FABRIC_WORDS =
  "cotton|polyester|elastane|nylon|wool|linen|silk|spandex|viscose|acrylic|cashmere|leather|denim|rayon|lycra|modal|bamboo|hemp|polyamide|acetate|polyurethane|elastomultiester";
const MATERIAL_COMPOSITION_PATTERN = new RegExp(
  `\\b\\d{1,3}%\\s*(?:${FABRIC_WORDS})\\b(?:,\\s*\\d{1,3}%\\s*(?:${FABRIC_WORDS})\\b)*`,
  "gi",
);

export function extractMaterial(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const matches = description.match(MATERIAL_COMPOSITION_PATTERN);
  if (!matches || matches.length === 0) return undefined;
  return matches.reduce((longest, m) => (m.length > longest.length ? m : longest)).trim();
}

/** "Colour - Green.", "Color: Blue" — 라벨이 명시적이라(material의 "%"와 달리
 * 이 문구가 다른 맥락에서 우연히 등장할 일이 거의 없다) 화이트리스트 없이도
 * 오탐 위험이 낮다. */
const COLOR_PATTERNS = [/colou?r\s*[-:]\s*([a-z][a-z\s/]{1,20}?)(?:[.,;\n]|$)/i];

export function extractColor(description: string | undefined): string | undefined {
  if (!description) return undefined;
  for (const pattern of COLOR_PATTERNS) {
    const match = pattern.exec(description);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** "2-3 years", "6-12 months" — 사이즈 안내에도 나이대가 자주 같이 적힌다(실측:
 * "48 / 6-12 months. 50 / 12-24 months."). 상품 전체를 대표하는 값이 아니라
 * 원문에 등장한 첫 번째 나이대 표기를 그대로 반환한다 — 여러 옵션에 걸쳐
 * 나이대가 다양해도, 이 필드는 "고시정보에 뭐라도 써야 할 때 원문 그대로 인용"
 * 하는 용도이지 옵션별 정밀 매핑이 아니다. */
const AGE_PATTERN = /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(years?|months?|yrs?)\b/i;

export function extractAge(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const match = AGE_PATTERN.exec(description);
  return match ? match[0].trim() : undefined;
}

/** "Imported by X", "Manufactured by X" — material과 마찬가지로 일반 단어
 * 화이트리스트가 아니라 "by" 뒤에 붙는 고유명사스러운 패턴(대문자로 시작)만
 * 잡는다. 너무 짧거나(2자 미만) 너무 길면(40자 초과, 문장 전체를 잘못 삼켰을
 * 가능성) 버린다.
 *
 * "imported/manufactured/distributed"를 대소문자 구분 없이 잡으려고 패턴
 * 전체에 /i를 붙였더니, 캡처 그룹의 [A-Z](대문자 시작 검증)까지 대소문자
 * 무시가 적용돼서 "manufactured by hand with love" 같은 문장에서 "hand with
 * love"를 회사명으로 잘못 뽑는 실제 오탐을 테스트 중 발견했다 — 정규식 하나로
 * "동사만 대소문자 무시, 캡처 그룹은 대소문자 구분"을 표현할 수 없어서, 매칭
 * 후에 별도로 대문자 시작 여부를 확인한다. */
const MANUFACTURER_PATTERNS = [
  /(?:imported|manufactured|distributed)\s+by\s+([A-Za-z0-9&.,'\s]{1,38}?)(?:[.,;\n]|$)/i,
  /제조자\s*[:：]\s*([^.,\n]{2,30})/,
];

export function extractManufacturer(description: string | undefined): string | undefined {
  if (!description) return undefined;
  for (const pattern of MANUFACTURER_PATTERNS) {
    const match = pattern.exec(description);
    if (match?.[1]) {
      const value = match[1].trim();
      if (/^[가-힣A-Z]/.test(value)) return value;
    }
  }
  return undefined;
}

/** "Machine wash", "Hand wash cold", "Dry clean only" — 쿠팡 고시정보의
 * "세탁방법"/"취급방법 및 취급시 주의사항"에 그대로 쓸 수 있는 표준 케어 라벨
 * 문구. AI가 아니라 알려진 케어 라벨 화이트리스트로만 매칭한다(P0 Epic 4,
 * Notice Resolver는 Deterministic Rule 기반이어야 한다는 CPO 지시). */
const CARE_LABEL_PATTERNS = [
  /\bmachine\s+wash(?:able)?(?:\s+(?:cold|warm|hot|gentle|delicate))?\b/i,
  /\bhand\s+wash(?:\s+only)?\b/i,
  /\bdry\s+clean(?:\s+only)?\b/i,
  /\bdo\s+not\s+(?:bleach|tumble\s+dry|iron|dry\s+clean)\b/i,
  /\bline\s+dry\b/i,
  /\btumble\s+dry(?:\s+(?:low|medium|high))?\b/i,
];

export function extractCareInstructions(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const found = CARE_LABEL_PATTERNS.map((p) => p.exec(description)?.[0]).filter(
    (v): v is string => Boolean(v),
  );
  if (found.length === 0) return undefined;
  // "do not tumble dry" 패턴과 별개의 "tumble dry" 패턴이 같은 부분 문자열에서
  // 둘 다 매칭되는 경우가 실제로 있었다(테스트 중 발견) — 다른 매칭에 완전히
  // 포함되는 짧은 매칭은 버린다("do not tumble dry"만 남기고 "tumble dry"는 뺀다).
  const deduped = found.filter(
    (value, index) => !found.some((other, otherIndex) => otherIndex !== index && other.includes(value) && other.length > value.length),
  );
  return [...new Set(deduped)].join(", ");
}
