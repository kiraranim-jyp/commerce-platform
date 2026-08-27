/**
 * N-4.18-Q3 PART H-3-8(대표님 지시, 2026-08-27) — H-3-7 실측 중 발견된 버그를
 * 좁게 고친다. junioredition.com 실제 상품 title에 "- Last Ones In Stock -
 * 28-29 EUR"처럼 재고상태/가격 문구가 그대로 붙어 있는 경우가 있고, 이 문구가
 * scoreCandidateMatch()의 title Jaccard 유사도("모델명 유사도") 계산에 그대로
 * 섞여 들어가면서 실제 동일상품(PèPè golden case)의 confidence를
 * 0.71(medium)에서 0.67(low)로 떨어뜨려 NOT_MATCHED로 오분류시키는 것을
 * 순수 함수 재현으로 직접 확인했다.
 *
 * 절대 원칙: scoreCandidateMatch()의 계산식(Jaccard, 가중치, 브랜드/카테고리/
 * SKU 신호)과 classifyMatchLevel()의 95/85/70 threshold는 손대지 않는다. 이
 * 함수는 그 계산에 들어가는 "입력 title"만 정제하는 별도 전처리 단계다 —
 * 원본 title은 어디서도 이 함수로 덮어쓰지 않는다(검색 키워드 생성/화면 표시용
 * title은 여전히 원문 그대로 쓰인다, matching 용도로 scoreCandidateMatch에
 * 넘기기 직전에만 이 정제본을 사용한다).
 *
 * 임의의 번역사전/일반 stopword 목록은 만들지 않는다 — 실측으로 확인된 패턴만
 * 좁게 제거한다("- Last Ones In Stock - <가격/사이즈 정보>" 형태, 대소문자
 * 무관, "20 EUR / 34 EUR"처럼 슬래시로 여러 값이 이어지는 경우도 포함). 이
 * 문구가 없는 title은 완전히 그대로 반환된다 — 오탐(정상 상품명을 잘못
 * 잘라내는 것) 위험이 없다.
 */
const LAST_ONES_IN_STOCK_SUFFIX_RE = /\s*-\s*last ones in stock\s*-.*$/i;

export function normalizeMatchingTitle(title: string): string {
  return title.replace(LAST_ONES_IN_STOCK_SUFFIX_RE, "").trim();
}
