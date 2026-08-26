/**
 * N-4.18-P-7(대표님 지시, 2026-08-26) — RULII/LOOXLOO/CHOCO.EL/DEUXBEBE 4개
 * 국내 파서 전부가 정규식으로 raw HTML 텍스트를 그대로 뽑아오면서 HTML
 * 엔티티(&amp; 등)를 디코딩하지 않고 있었다(실측 확인: RULII/LOOXLOO/
 * DEUXBEBE 3곳에서 "Misha & Puff" 브랜드가 "Misha &amp; Puff"로 그대로
 * 넘어와 match.ts의 브랜드 substring 비교가 100% 실패). match.ts 판정
 * 로직 문제가 아니라 크롤러 추출 경계의 데이터 품질 버그다 — 여기서
 * 한 번만 고친다(4개 파서에 디코딩 코드를 각각 복붙하지 않는다).
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ENTITY_RE = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g;

/** 표준 HTML 엔티티(&amp;/&lt;/&gt;/&quot;/&apos;/&nbsp;)와 숫자 엔티티
 * (&#39; / &#x27; 등)만 디코딩한다. `;`로 끝나는 완전한 엔티티 형태가 아닌
 * 문자열 속 순수 "&"는 매칭 대상이 아니므로 그대로 유지된다(오탐 없음 —
 * 이 함수는 문자열 내용을 "해석"하지 않고 이미 존재하는 엔티티 표기만
 * 원래 문자로 복원한다). */
export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY_RE, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const lower = entity.toLowerCase();
    return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : match;
  });
}
