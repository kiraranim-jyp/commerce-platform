/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-IDENTITY-REVIEW-COMPLETION-02 — **원상품 상세설명 근거(표시 전용)**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 판정에 들어가지 않는다.** 이름을 그렇게 지었다 —
 *    `origin-description-evidence` 는 **화면 어댑터** 이고, 운영 판정 owner 셋
 *    (`product-url-facts.ts` · `cross-seller.ts` · `seller-facts.ts`)은 이 모듈도
 *    추출기도 **import 하지 않는다**(`sprint3-gate-gt-precision F-1` 가 그것을 문다).
 *    🟢 그 계약의 범위는 **그 셋** 이고, 화면이 추출기를 읽는 것은 금지가 아니다.
 *
 * 🔴 CPO 가 **두 번** 거부한 것은 「상세설명 브랜드·상품명을 **운영 SAME 판정에 연결**」
 *    이다. 🟢 승인된 것은 「추출해서 **식별 근거로 보여주기**」다 ⟹ 이 파일이 그 경계다.
 *
 * 🔴 **원상품 쪽만** 할 수 있다 — 후보의 상세설명 원문은 응답(`GeminiTransientRow`)에
 *    **없다**. 그 공백을 「후보에 상세설명이 없다」로 적지 않는다(§REVIEW 어휘가 말한다).
 *
 * 🔴 네트워크 0 · DB 0 · state 0 — 두 추출기는 **순수 함수** 다.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { analyzeBrandDescriptionEvidence } from "@commerce/crawler/src/comparison-search/brand-description-evidence";
import { analyzeProductNameDescriptionEvidence } from "@commerce/crawler/src/comparison-search/product-name-description-evidence";

import type { OriginIdentity } from "./mi-same-candidates";

/** 🟢 네 상태의 **사람 말**. 🔴 「확정」이라는 말을 쓰지 않는다 — 관찰 결론이다. */
export const DESCRIPTION_EVIDENCE_STATE_LABEL: Record<string, string> = {
  CORROBORATED: "두 출처가 같은 값을 말함",
  OBSERVED: "한 출처에서만 관찰됨",
  CONFLICT: "출처끼리 다른 값을 말함",
  UNKNOWN: "상세설명에서 찾지 못함",
};

export const DESCRIPTION_EVIDENCE_HEADING = "원상품 상세설명 근거";
/**
 * 🔴🔴 **이 한 줄이 이 영역의 안전장치다.** 없으면 다음 사람이 이 값을 판정 근거로
 *    읽는다 — 그것이 CPO 가 두 번 거부한 그 연결이다.
 */
export const DESCRIPTION_EVIDENCE_SCOPE =
  "상세설명에서 읽은 관찰값입니다 — 동일상품 자동 판정에는 사용되지 않습니다.";

export interface OriginDescriptionEvidenceLine {
  axis: "BRAND" | "TITLE";
  /** 🟢 네 상태 중 하나. 🔴 코드 토큰을 화면에 노출하지 않는다(라벨로 바꿔 쓴다). */
  state: string;
  /** 🔴 `CORROBORATED` 가 아니면 `null` — 추출기 계약 그대로다(확정값이 아니다). */
  observed: string | null;
  /** 🟢 사람이 읽는 이유 문장 — 추출기가 낸 것을 **그대로** 옮긴다. */
  reasons: string[];
}

/**
 * 🟢 원상품의 (상품명 + 상세설명)에서 **브랜드·상품명 근거** 를 뽑아 화면 줄로 만든다.
 *
 * 🔴 `description` 이 없으면 **빈 배열** 이다 — 「UNKNOWN」 줄을 만들지 않는다.
 *    근거가 없는데 영역을 그리면 셀러는 「찾아봤지만 없다」로 읽고, 실제로는
 *    **원문 자체가 화면에 없었던** 것이다(두 사실은 다르다).
 */
export function originDescriptionEvidence(
  identity: OriginIdentity | null | undefined,
): OriginDescriptionEvidenceLine[] {
  if (!identity) return [];
  const description = identity.description ?? null;
  if (!description || description.trim().length === 0) return [];

  const input = { title: identity.title, description };
  const brand = analyzeBrandDescriptionEvidence(input);
  const name = analyzeProductNameDescriptionEvidence(input);

  return [
    { axis: "BRAND", state: brand.state, observed: brand.corroborated, reasons: brand.reasons },
    { axis: "TITLE", state: name.state, observed: name.corroborated, reasons: name.reasons },
  ];
}
