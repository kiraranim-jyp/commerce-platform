import type { DiscoveryQuery, ProductIdentity, QueryId } from "./types";

/**
 * MI-DISCOVERY-LONGSPRINT-P1 §4 — Query Set 생성.
 *
 * 🔴 **사전 우선순위를 확정하지 않는다**(P1.1 §4). 여기서 하는 일은 여덟 축을
 *    «같은 규칙으로» 만드는 것뿐이고, 어느 축이 좋은지는 benchmark 가 정한다.
 *    그래서 반환 순서는 Q1..Q8 선언 순서이며 «추천 순서가 아니다».
 *
 * 🔴 **없는 칸으로 쿼리를 만들지 않는다.** 필요한 칸이 비면 그 쿼리를 건너뛴다 —
 *    빈 문자열을 넣어 「검색했는데 못 찾았다」로 만들면 SEARCH_QUERY_MISS 와
 *    「애초에 물어보지 못했다」가 같은 값이 된다.
 *
 * 🔴 상품코드 축(Q5·Q6)은 실측에서 약했다(2026-10-07: Shopify suggest 미색인 ·
 *    웹검색 상품 URL 0/10). 그래도 **빼지 않는다** — CPO 가 낮은 우선순위로
 *    «유지» 하라고 했고, 판단은 Query 별 Recall 이 한다.
 */

/** 쇼핑 의도어. 🔴 번역하거나 늘리지 않는다 — 축을 늘리면 비교가 흐려진다. */
const SHOPPING_INTENT = "buy";

interface QuerySpec {
  id: QueryId;
  axis: string;
  fields: (keyof ProductIdentity)[];
  /** 고정 접미사(쇼핑 의도어 등). 없으면 빈 배열. */
  suffix: string[];
}

const SPECS: readonly QuerySpec[] = [
  { id: "Q1", axis: "상품명", fields: ["productName"], suffix: [] },
  { id: "Q2", axis: "브랜드+상품명", fields: ["brand", "productName"], suffix: [] },
  { id: "Q3", axis: "상품명+색상", fields: ["productName", "color"], suffix: [] },
  { id: "Q4", axis: "브랜드+상품명+색상", fields: ["brand", "productName", "color"], suffix: [] },
  { id: "Q5", axis: "상품코드", fields: ["productCode"], suffix: [] },
  { id: "Q6", axis: "브랜드+상품코드", fields: ["brand", "productCode"], suffix: [] },
  { id: "Q7", axis: "상품명+쇼핑의도", fields: ["productName"], suffix: [SHOPPING_INTENT] },
  { id: "Q8", axis: "브랜드+상품명+쇼핑의도", fields: ["brand", "productName"], suffix: [SHOPPING_INTENT] },
] as const;

function readField(identity: ProductIdentity, field: keyof ProductIdentity): string | null {
  const raw = identity[field];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 🔴 반환 타입을 명시한다 — 이 저장소에서 union/optional 반환을 추론에 맡겼다가
 *    판별자가 죽은 전례가 있다.
 */
export function generateQueries(identity: ProductIdentity): DiscoveryQuery[] {
  const queries: DiscoveryQuery[] = [];
  for (const spec of SPECS) {
    const parts: string[] = [];
    const used: (keyof ProductIdentity)[] = [];
    let missing = false;
    for (const field of spec.fields) {
      const value = readField(identity, field);
      if (value === null) {
        missing = true;
        break;
      }
      parts.push(value);
      used.push(field);
    }
    // 필요한 칸이 하나라도 비면 이 축은 «질문하지 못한 것» 이다. 만들지 않는다.
    if (missing) continue;
    const text = [...parts, ...spec.suffix].join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    queries.push({ id: spec.id, axis: spec.axis, text, usedFields: used });
  }
  return queries;
}

/**
 * 「이 상품에서 «물어보지도 못한» 축」. 🔴 KPI 가 SEARCH_QUERY_MISS 와 이것을
 * 가르는 데 쓴다 — 못 물어본 축을 「검색이 실패했다」로 세면 안 된다.
 */
export function unaskedQueryIds(identity: ProductIdentity): QueryId[] {
  const asked = new Set(generateQueries(identity).map((q) => q.id));
  return SPECS.filter((s) => !asked.has(s.id)).map((s) => s.id);
}
