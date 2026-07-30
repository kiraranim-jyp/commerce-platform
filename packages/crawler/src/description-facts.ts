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
