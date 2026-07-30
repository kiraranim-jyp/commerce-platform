import type { ComplianceFieldResult } from "./build-payload";

/**
 * Sprint B(Product Compliance Engine) + Sprint C(Confidence/Explainable) —
 * "등록됐다"가 아니라 "얼마나 실제 판매/승인 가능한 수준으로 등록됐는가"를
 * 점수로 보여준다. buildCoupangCompliance가 만든 ComplianceFieldResult[](각
 * 필드가 실제 값인지 자리표시자인지, 얼마나 확실한지)를 입력으로 받아 계산하는
 * 순수 함수 — register 라우트가 실제 등록 직후(또는 직전) 호출한다.
 */
export interface ComplianceReport {
  /** 0~100. 전체 필드 중 "실제 근거가 있는 값"의 비율(자리표시자는 절반만 인정). */
  score: number;
  /** 필수 구매옵션(attributes) 중 실제 값 비율. */
  requiredAttributeRate: number;
  /** 필수 고시정보(notices) 중 실제 값 비율. */
  requiredNoticeRate: number;
  /** 전체 필드 중 사람 손 없이 자동으로 채운(자리표시자가 아닌) 비율. */
  aiAutoFillRate: number;
  /** 사람 손 없이 자동으로 채운 필드 개수. */
  autoResolvedCount: number;
  /** 아직 자리표시자라 사용자 확인이 필요한 필드 개수(= userInputNeeded.length). */
  userRequiredCount: number;
  /** 0~1. 전체 필드 confidence의 평균 — 자리표시자(0.1)가 많을수록 낮아진다. */
  confidenceAvg: number;
  /** 아직 자리표시자인 필드 목록 — "등록 전 이것만 채우면 됩니다" 화면에 그대로 쓸 수 있다. */
  userInputNeeded: { fieldName: string; reason: string; confidence: number }[];
  /** score가 왜 이 값인지 필드별 감점 근거 — 자리표시자 필드만 나열한다(감점이
   * 있는 필드만 "설명할 거리"가 있다). 감점이 큰 순서로 정렬. */
  scoreBreakdown: { fieldName: string; deduction: number; reason: string }[];
  /** P0-UI Epic 7(Resolver 결과 시각화) — "몇 개 자동 채움"이라는 카운트만으로는
   * 사용자가 "왜 이 점수인지" 바로 이해할 수 없다. 실제로 채워진 필드 이름과 값을
   * 그대로 나열해서 "✓ 소재: 88% Polyester, 12% Elastane" 같은 화면을 만들 수 있게
   * 한다 — userInputNeeded(플레이스홀더 목록)의 반대쪽 목록. */
  resolvedFields: { fieldName: string; value: string; source: ComplianceFieldResult["source"] }[];
  verdict: "PASS" | "WARNING" | "FAIL";
  reasons: string[];
  /** "High"(score>=90, 컴플라이언스 필수 항목 전부 확보) / "Medium"(실제 값은
   * 있지만 일부 미확인) / "Low"(KC/인증 등 필수 항목이 자리표시자) — Wing에
   * 승인 요청하기 전 사람이 얼마나 봐야 하는지에 대한 요약 신호. */
  approvalReadiness: "High" | "Medium" | "Low";
}

/** OPTION_MATCH/PRODUCT_FIELD/KNOWN_VALUE/DETERMINISTIC은 전부 실제 근거가 있는
 * 값이라 만점, PLACEHOLDER는 "등록은 통과하지만 내용은 비어있다"는 뜻이라 반만
 * 인정한다 — 0점을 주면 "일단 등록되게는 한다"는 기존 원칙과 충돌하고, 100%를
 * 주면 자리표시자가 실제 데이터인 것처럼 숨겨진다. */
const FIELD_CREDIT: Record<ComplianceFieldResult["source"], number> = {
  OPTION_MATCH: 1,
  PRODUCT_FIELD: 1,
  KNOWN_VALUE: 1,
  DETERMINISTIC: 1,
  PLACEHOLDER: 0.5,
};

function rate(results: ComplianceFieldResult[]): number {
  if (results.length === 0) return 100;
  const earned = results.reduce((sum, r) => sum + FIELD_CREDIT[r.source], 0);
  return Math.round((earned / results.length) * 100);
}

export function buildComplianceReport(
  attributeResults: ComplianceFieldResult[],
  noticeResults: ComplianceFieldResult[],
): ComplianceReport {
  const all = [...attributeResults, ...noticeResults];
  const score = rate(all);
  const requiredAttributeRate = rate(attributeResults);
  const requiredNoticeRate = rate(noticeResults);
  const autoResolvedCount = all.filter((r) => r.source !== "PLACEHOLDER").length;
  const aiAutoFillRate = all.length > 0 ? Math.round((autoResolvedCount / all.length) * 100) : 100;
  const confidenceAvg =
    all.length > 0 ? Math.round((all.reduce((sum, r) => sum + r.confidence, 0) / all.length) * 100) / 100 : 1;

  // 같은 필드(예: "색상")가 구매옵션(ATTRIBUTE)과 고시정보(NOTICE) 양쪽에 같은 값으로
  // 채워지는 경우가 흔하다 — 화면에는 한 번만 보여준다(같은 이름+값 조합만 dedupe,
  // 이름은 같아도 값이 다르면 둘 다 보여준다).
  const seenResolved = new Set<string>();
  const resolvedFields = all
    .filter((r) => r.source !== "PLACEHOLDER")
    .filter((r) => {
      const key = `${r.fieldName}::${r.value}`;
      if (seenResolved.has(key)) return false;
      seenResolved.add(key);
      return true;
    })
    .map((r) => ({ fieldName: r.fieldName, value: r.value, source: r.source }));

  const placeholders = all.filter((r) => r.source === "PLACEHOLDER");
  // 같은 필드명이 구매옵션(ATTRIBUTE)과 고시정보(NOTICE) 양쪽에 다 필수라서 자리
  // 표시자로 두 번 잡히는 경우가 흔하다(예: "색상") — resolvedFields와 같은 이유로
  // 화면 목록(userInputNeeded/scoreBreakdown)에는 필드명당 한 번만 보여준다. score/
  // rate/카운트 계산(all.length 기반)은 실제 검사 항목 수를 그대로 반영해야 하므로
  // 여기서 건드리지 않는다 — dedupe는 "표시용 목록"에만 적용한다.
  const seenPlaceholder = new Set<string>();
  const dedupedPlaceholders = placeholders.filter((r) => {
    if (seenPlaceholder.has(r.fieldName)) return false;
    seenPlaceholder.add(r.fieldName);
    return true;
  });
  const userInputNeeded = dedupedPlaceholders.map((r) => ({
    fieldName: r.fieldName,
    reason: r.critical
      ? "법적/컴플라이언스 필수 항목(KC/인증 등) — 실제 값 확인이 꼭 필요합니다."
      : "원본 사이트에서 확인되지 않아 자리표시자로 등록됐습니다.",
    confidence: r.confidence,
  }));

  // 필드 하나가 (1 - 0.5)만큼 감점되는데, 그 실제 점수 영향은 전체 필드 수에
  // 반비례한다(필드가 적을수록 하나의 감점이 더 크다) — "82점, 왜?"에 대한
  // 실제 계산 근거를 그대로 보여준다.
  const perFieldWeight = all.length > 0 ? 100 / all.length : 0;
  const scoreBreakdown = dedupedPlaceholders
    .map((r) => ({
      fieldName: r.fieldName,
      deduction: Math.round(perFieldWeight * (1 - FIELD_CREDIT.PLACEHOLDER)),
      reason: r.critical ? "KC/인증 등 필수 컴플라이언스 항목 미확인" : "원본에서 확인 안 됨(자리표시자)",
    }))
    .sort((a, b) => b.deduction - a.deduction);

  const criticalMissing = all.some((r) => r.critical && r.source === "PLACEHOLDER");
  const verdict: ComplianceReport["verdict"] = criticalMissing ? "FAIL" : userInputNeeded.length > 0 ? "WARNING" : "PASS";
  const reasons = criticalMissing
    ? ["KC/인증 등 법적 필수 항목이 자리표시자 상태로 등록됐습니다 — Wing 승인 요청 전 반드시 확인하세요."]
    : [];

  const approvalReadiness: ComplianceReport["approvalReadiness"] = criticalMissing
    ? "Low"
    : score >= 90
      ? "High"
      : "Medium";

  return {
    score,
    requiredAttributeRate,
    requiredNoticeRate,
    aiAutoFillRate,
    autoResolvedCount,
    userRequiredCount: userInputNeeded.length,
    confidenceAvg,
    userInputNeeded,
    scoreBreakdown,
    resolvedFields,
    verdict,
    reasons,
    approvalReadiness,
  };
}
