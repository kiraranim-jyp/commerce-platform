import type { CrossSellerVerdict } from "./cross-seller";
import type { MatchLevel } from "./match";
import type { ModelEvidenceResult } from "./evidence";

/**
 * P-7-B(CPO 지시, 2026-08-29) — "72%를 60%로 낮추는 땜질"이 아니라, 점수(confidence)와
 * "동일상품인지에 대한 판단"을 분리한다. 실측 골든케이스(Pepe Shoes "Lulu T-Bar
 * Shoes in Vernice Nero"): 포레포레의 진짜 동일상품(PP24KASHE1195NER)은 텍스트
 * 유사도만으로는 71%(medium)에 그치고, 실제로는 전혀 다른 상품인 듀베베 후보가
 * 72%(medium)로 더 높게 나온다 — 이 상태에서는 아무리 배지 색을 바꿔도 두 후보가
 * 화면에서 구분되지 않는다.
 *
 * 이 파일은 새 confidence 계산식이 아니다(scoreCandidateMatch/classifyMatchLevel은
 * 그대로 둔다, decision.ts와 동일 원칙 — "기존 판단은 다시 계산하지 않는다"). 대신
 * 이미 계산된 matchLevel과 modelCode 증거(evidence.ts/model-code.ts, 이미 존재)를
 * 조합해서 "이 후보를 사람이 어떤 근거로 신뢰해야 하는지"를 별도 축으로 매긴다.
 *
 * 우선순위 설계 원칙(CPO 지시):
 * - modelCode가 "conflict"면 텍스트 점수가 아무리 높아도 절대 상위 등급을 주지
 *   않는다(다른 상품이라는 명백한 반증이 있다는 뜻).
 * - modelCode가 "exact"/"partial"이면(=식별자 증거가 있다면) 텍스트 점수가 낮아도
 *   (medium 이하) 식별자가 없는 후보보다 항상 위에 온다 — 실측 케이스 그대로:
 *   포레포레 71%+partial이 듀베베 72%+unavailable보다 신뢰도가 높아야 한다.
 * - modelCode가 "unavailable"(식별자를 아예 비교할 수 없음, 추출 기능이 없는
 *   사이트 포함)이면 텍스트 점수만으로 판단하되, 식별자 확인 후보보다는 절대
 *   위로 올라가지 않는다.
 */
export type MatchTruth =
  | "EXACT_IDENTIFIER"
  | "STRONG_IDENTIFIER"
  | "TEXT_CONFIRMED"
  | "SIMILAR"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

/** 값이 클수록 "더 신뢰할 수 있는 동일상품 근거". 서로 다른 판매처의 후보를
 * 비교할 때(예: 포레포레 vs 듀베베) 이 값으로 우선순위를 매긴다 — CONFLICT는
 * 텍스트 점수와 무관하게 항상 최하위(0)로 취급한다. */
export const MATCH_TRUTH_RANK: Record<MatchTruth, number> = {
  EXACT_IDENTIFIER: 5,
  STRONG_IDENTIFIER: 4,
  TEXT_CONFIRMED: 3,
  SIMILAR: 2,
  INSUFFICIENT_EVIDENCE: 1,
  CONFLICT: 0,
};

const HIGH_OR_ABOVE: ReadonlySet<MatchLevel> = new Set(["high", "very_high"]);

/**
 * decision.ts의 decideCandidateEvidence()와 같은 입력(match level + modelCode
 * 증거)을 받지만, 목적이 다르다 — decideCandidateEvidence는 "자동확정해도
 * 되는가"(verified 플래그, 3단계)를 결정하고, 이 함수는 "화면에 어떤 신뢰
 * 등급으로 보여줄 것인가"(6단계 랭크)를 결정한다. 두 함수는 서로 다른
 * 소비자(자동확정 파이프라인 vs UI 배지)를 위한 것이라 별도로 둔다 — 하나를
 * 다른 하나 위에 구현하면 "자동확정 기준"과 "화면 표시 기준"이 우연히 같은 값이
 * 되어야 한다는 잘못된 결합이 생긴다.
 */
export function deriveMatchTruth(
  level: MatchLevel,
  modelCode: ModelEvidenceResult,
  crossSeller?: CrossSellerVerdict,
): MatchTruth {
  // MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 교차판매처 반증은 여기서도 먼저,
  // 그리고 무조건 이긴다. 대상 연령·성별·상품군·색상·품번 중 하나라도 서로
  // 반증하면 텍스트 점수가 얼마든 상관없다.
  if (crossSeller === "CONFLICT") return "CONFLICT";

  if (modelCode === "conflict") return "CONFLICT";

  // exact/partial(=식별자 증거가 있음)은 텍스트 등급이 low여도 승격한다 — CPO 지시
  // 원문 "텍스트 점수가 낮아도(medium 이하) 식별자가 없는 후보보다 항상 위에 온다"의
  // "이하"에는 low도 포함된다. 실측으로 확인된 케이스: 포레포레 정답 후보가 이
  // 라이브 검색 라우트에서는 confidence 42%(low)로 나오는데도 SKU가 partial
  // 일치한다 — 이걸 INSUFFICIENT_EVIDENCE로 깔아뭉개면 실제로는 다른 상품인
  // 듀베베(SIMILAR)한테 다시 역전당한다(회귀 재현, 2026-08-29 production 실측).
  if (modelCode === "exact") {
    return HIGH_OR_ABOVE.has(level) ? "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
  }
  if (modelCode === "partial") return "STRONG_IDENTIFIER";

  // modelCode === "unavailable" — 식별자 증거가 아예 없다. 여기가 판매처마다
  // 자기 SKU를 쓰는 상황의 기본값이고, 지금까지 텍스트 점수 말고는 볼 것이
  // 없었다. 이제는 교차판매처 판정이 있으면 그 근거를 함께 본다.
  //
  // SAME을 STRONG_IDENTIFIER로 옮기는 것에 대해: 이름은 식별자를 말하지만 이 값이
  // 실제로 하는 일은 "🟢 동일상품으로 표시하고 가격 비교에 쓴다"이고, 그것이
  // SAME이 요구하는 것과 정확히 같다. 이름과 뜻의 어긋남을 없애려면 새 값을
  // 만들어야 하는데, 이 값은 domestic_product_links의 CHECK 제약(마이그레이션
  // 030)에 그대로 들어가 있어 스키마 변경을 부른다 — 배지 문구
  // (match-display.ts)를 사실에 맞게 고치는 쪽이 정직하면서 스키마를 건드리지
  // 않는 길이다.
  const textOnly: MatchTruth =
    level === "low" ? "INSUFFICIENT_EVIDENCE" : HIGH_OR_ABOVE.has(level) ? "TEXT_CONFIRMED" : "SIMILAR";
  if (!crossSeller) return textOnly;
  //
  // P0-A.29-F R1(CEO 지시, 2026-09-20) — **SIMILAR 은 «닮았다» 가 아니라
  // «반증이 없다» 는 뜻이다. 그것으로 등급을 올리지 않는다.**
  //
  // compareCrossSellerProducts 의 SIMILAR 조건은 `totalPoints >= 1` 이다 —
  // 축 «하나» 만 맞아도 나온다. 신발 대 신발이면 상품군 축이 언제나 맞으므로
  // 사실상 항상 참이다.
  //
  // 그 값이 여기서 텍스트 등급을 이기고 있었다:
  //
  //     level=low            → textOnly  = INSUFFICIENT_EVIDENCE  (rank 1)
  //     crossSeller=SIMILAR  → fromCross = SIMILAR                (rank 2)
  //                            2 > 1     → 🔴 SIMILAR 로 승격
  //
  // 실측(2026-09-20, Lulu T Bar Shoes in Tobacco): 국내 원시 후보 18건이 전부
  // 「모델명 유사도 0%」인데, 그중 10건이 이 경로로 SIMILAR 이 되어 화면에
  // 「비교 가능한 유사상품」으로 섰다. 실제로는 페페슈즈 플라워샌들 · 나파 키안티
  // 부츠 · 폼폼 라소 발레리나 슈즈 — 전부 다른 신발이다. 셀러는 동일상품 검증
  // 결과를 보러 온 것이지 같은 브랜드 카탈로그를 보러 온 것이 아니다.
  //
  // 🔴 SAME · PRESUMED_SAME 의 승격은 그대로 둔다. 그 둘은 축이 여럿 맞아야
  //    나오는 «근거» 이고, 텍스트 점수가 낮아도 동일상품인 실제 사례(Smallable
  //    430701 ↔ Bobo B226AC114)가 그 길로 살아 있다. 이번에 막는 것은 근거가
  //    「축 하나」뿐인 경우 하나다.
  if (crossSeller === "SIMILAR") return textOnly;
  const fromCross: MatchTruth =
    crossSeller === "SAME"
      ? "STRONG_IDENTIFIER"
      : crossSeller === "PRESUMED_SAME"
        ? "TEXT_CONFIRMED"
        // 남은 것은 UNKNOWN 뿐이다(SIMILAR 는 위에서 돌아갔고, CONFLICT 는 맨
        // 위에서 끝났다). rank 1 이라 아래 비교에서 절대 승격시키지 않는다 —
        // «판단 근거가 없다» 가 텍스트 근거를 깎지는 않는다.
        : "INSUFFICIENT_EVIDENCE";
  // 둘 중 근거가 강한 쪽. 오늘 잘 동작하는 매칭을 새 규칙이 조용히 깎지 않게 한다.
  return MATCH_TRUTH_RANK[fromCross] > MATCH_TRUTH_RANK[textOnly] ? fromCross : textOnly;
}
