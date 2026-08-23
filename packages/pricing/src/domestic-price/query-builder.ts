/**
 * N-4.03 Part 3(대표님 지시) — title 전체를 그대로 검색어로 보내지 않는다.
 * "브랜드+모델명" → "브랜드+상품명 핵심어" → "모델명 단독" 순으로 우선순위를
 * 둔다(예시: "Bobo Choses B126AC050" → "Bobo Choses Color Block Zipped
 * Sweatshirt" → "B126AC050"). 호출하는 쪽(run-price-check.ts)이 이 배열을
 * 순서대로 시도하다가 첫 유의미한 결과(NO_RESULTS가 아닌)에서 멈춘다 —
 * 이 함수는 후보 목록만 만들고 실제 검색/멈춤 판단은 하지 않는다(단일 책임).
 * CanonicalProduct의 ProvenanceField를 그대로 받지 않고 원시 문자열만
 * 받는다 — 이 함수는 "값이 어디서 왔는지"에 관심이 없고, 호출부(이미
 * product.brand.value 등을 꺼내 쓰는 run-price-check.ts)가 그 책임을 진다.
 */
export function buildDomesticSearchQueries(product: { brand: string; title: string; modelName: string }): string[] {
  const brand = product.brand.trim();
  const title = product.title.trim();
  const modelName = product.modelName.trim();

  const candidates = [
    brand && modelName ? `${brand} ${modelName}` : null,
    brand && title ? `${brand} ${title}` : null,
    modelName || null,
    // 브랜드/모델명이 전혀 없을 때만 최후 수단으로 원문 title 단독 사용.
    !brand && !modelName && title ? title : null,
  ].filter((q): q is string => Boolean(q));

  // 중복 제거(브랜드가 이미 title에 포함돼 "브랜드+title"과 "title"이 같아지는
  // 경우 등) — 순서는 유지한다(Array.from(new Set())은 첫 등장 순서를 보존한다).
  return Array.from(new Set(candidates));
}
