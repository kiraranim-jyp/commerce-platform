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
  // Sprint A-7(작업2) — "Origin: Portugal" 처럼 짧은 라벨도 흔하다.
  /\borigin\s*[:：]\s*([a-z][a-z\s]{1,20}?)(?:[.,;\n]|$)/i,
  /제조국\s*[:：]\s*([가-힣]{1,10})/,
  /원산지\s*[:：]\s*([가-힣]{1,10})/,
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

/** Sprint A-7(작업2) — 실측 확인: "88% Polyester" 같은 구성비 표기가 없는
 * 설명문(예: allbirds.com의 마케팅 위주 서술)에서는 소재 정보가 전부 빠졌다.
 * "Material: Organic Cotton", "Fabric: Recycled Polyester" 처럼 라벨이 붙은
 * 문장은 구성비 없이도 흔하다 — FABRIC_WORDS 화이트리스트(같은 불변식: 원문에
 * 실제로 있는 단어만 반환)에 형용사 접두어(organic/recycled/genuine/premium
 * 등)까지만 허용해서 좁게 매칭한다. */
const MATERIAL_LABEL_PATTERN = new RegExp(
  `(?:material|fabric|fabrication)\\s*[:：]\\s*((?:[a-z]+\\s+){0,2}(?:${FABRIC_WORDS}))\\b`,
  "i",
);

export function extractMaterial(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const matches = description.match(MATERIAL_COMPOSITION_PATTERN);
  if (matches && matches.length > 0) {
    return matches.reduce((longest, m) => (m.length > longest.length ? m : longest)).trim();
  }
  const labeled = MATERIAL_LABEL_PATTERN.exec(description);
  return labeled?.[1]?.trim();
}

/** "Colour - Green.", "Color: Blue" — 라벨이 명시적이라(material의 "%"와 달리
 * 이 문구가 다른 맥락에서 우연히 등장할 일이 거의 없다) 화이트리스트 없이도
 * 오탐 위험이 낮다. */
const COLOR_PATTERNS = [/colou?r\s*[-:]\s*([a-z][a-z\s/]{1,20}?)(?:[.,;\n]|$)/i];

/** Sprint A-7(작업2) — 실측 확인(allbirds.com "Men's Cruiser Terralux -
 * Anthracite (Dark Gum Sole)"): 색상이 설명문 라벨이 아니라 **제목**에 대시로
 * 붙는 경우가 흔하다("상품명 - 색상" 패턴). 알려진 색상 이름 화이트리스트로만
 * 매칭해서(임의 단어를 색상으로 오인하지 않도록) 좁게 잡는다 — 목록에 없는
 * 색상 표현은 못 잡아도, 잡은 건 확실히 맞는 값이라는 이 파일의 불변식을
 * 유지한다. */
const KNOWN_COLOR_WORDS = [
  "black", "white", "red", "blue", "green", "yellow", "grey", "gray", "brown",
  "beige", "navy", "purple", "orange", "ivory", "khaki", "mint", "silver", "gold",
  "pink", "anthracite", "charcoal", "olive", "burgundy", "maroon", "teal", "coral",
  "lavender", "mustard", "rust", "clay", "sand", "cream", "tan", "taupe", "indigo",
  "turquoise", "magenta", "crimson", "emerald", "sapphire", "bronze", "copper",
  // Sprint A-7(작업2) — 실측 확인(bobochoses.com "Offwhite t-shirt."): 표준
  // 색이름 밖의 표기도 실제로 쓰인다. off-white/offwhite는 white의 변형이라
  // 별도 화이트리스트 확장으로 안전하게 추가한다(임의 단어 허용이 아님).
  "off-white", "offwhite",
];
const COLOR_TITLE_PATTERN = new RegExp(
  `\\b(${KNOWN_COLOR_WORDS.join("|")})\\b`,
  "i",
);

/** Sprint A-7(작업2) — 실측 확인(bobochoses.com "Beige sweatshirt. Cotton 66%,
 * Organic Cotton 34%..."): 라벨 없이 색상 단어가 설명문 맨 앞 문장의 첫 단어로
 * 바로 오는 경우가 실제로 있다. 문서 전체에서 아무 데나 찾으면 오탐 위험이
 * 크지만(예: 중간 문장의 "black"이 상품과 무관할 수 있음), "맨 앞"으로
 * 앵커링하면 라벨과 거의 같은 신뢰도를 갖는다 — 화이트리스트 밖 표현은 여전히
 * 못 잡는다.
 *
 * 실측 확인(bobochoses.com "Heather grey t-shirt."): 색상 단어 앞에 수식어
 * 하나가 더 붙는 경우도 있다("Heather grey"/"Dusty pink" 등) — 앞 단어 최대
 * 1개까지만 선택적으로 허용한다(문장 전체를 삼키지 않도록 제한). 정규식
 * 백트래킹 덕분에 수식어가 없는 "Beige sweatshirt."도 그대로 "Beige"만
 * 잡힌다(sweatshirt는 색상 화이트리스트에 없어 수식어 시도가 실패하고
 * 색상 단어 자체를 바로 매칭). */
const COLOR_LEADING_WORD_PATTERN = new RegExp(
  `^((?:[a-z]+\\s+)?(?:${KNOWN_COLOR_WORDS.join("|")}))\\b`,
  "i",
);

export function extractColor(description: string | undefined): string | undefined {
  if (!description) return undefined;
  for (const pattern of COLOR_PATTERNS) {
    const match = pattern.exec(description);
    if (match?.[1]) return match[1].trim();
  }
  const leading = COLOR_LEADING_WORD_PATTERN.exec(description.trim());
  return leading?.[1] ? leading[1].trim() : undefined;
}

/** description에서 못 찾았을 때만 호출하는 폴백 — 상품명(title)에서 알려진
 * 색상 단어를 찾는다. description보다 신뢰도가 낮은 게 아니라(제목도 원문
 * 그대로다) 단지 "라벨이 명시된 값"보다 "단어 하나만 보고 판단한 값"이라
 * 화이트리스트 밖 색상(예: 브랜드가 지어낸 색상명 "Dark Gum")은 놓친다는
 * 한계가 있을 뿐이다. */
export function extractColorFromTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const match = COLOR_TITLE_PATTERN.exec(title);
  return match?.[1] ? match[1].trim() : undefined;
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

/** N-4.19(대표님 지시, 2026-08-26: "매칭상태의 계산이 아직도 너무 안맞아") —
 * 이 파일 맨 위 주석에 원래부터 근거로 인용돼 있던 "Product code B126AH013
 * SS26 Made in China." 패턴을 실제로 추출하는 함수가 없었다(country만 뽑고
 * 코드 자체는 버려짐). 실측 확인(2026-08-26): junioredition.com/bobochoses.com
 * 등 여러 Shopify 키즈패션 스토어가 이 라벨로 내부 품번을 설명문에 그대로
 * 노출하고(예: "Product code B226AC010 AW26 Made in Portugal."), 그 품번이
 * bobochoses.com 공식몰의 상품 URL handle에도 그대로 포함된다
 * (b226ac010-booty-ghosts-t-shirt) — 국내/해외 비교검색 매칭(match.ts)의
 * SKU 최우선 신호가 이 품번을 못 받아 "동일상품"을 확실히 구분 못 하고 있었다. */
const PRODUCT_CODE_PATTERN = /\bproduct\s+code\s+([A-Za-z0-9]{4,20})\b/i;

export function extractProductCode(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const match = PRODUCT_CODE_PATTERN.exec(description);
  return match?.[1]?.trim();
}
