import type { ComplianceFieldResult } from "./build-payload";

/**
 * Sprint B(Product Compliance Engine) — "등록됐다"가 아니라 "얼마나 실제
 * 판매/승인 가능한 수준으로 등록됐는가"를 점수로 보여준다. buildCoupangCompliance가
 * 만든 ComplianceFieldResult[](각 필드가 실제 값인지 자리표시자인지)를 입력으로
 * 받아 계산하는 순수 함수 — register 라우트가 실제 등록 직후(또는 직전) 호출한다.
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
  /** 아직 자리표시자인 필드 목록 — "등록 전 이것만 채우면 됩니다" 화면에 그대로 쓸 수 있다. */
  userInputNeeded: { fieldName: string; reason: string }[];
  verdict: "PASS" | "WARNING" | "FAIL";
  reasons: string[];
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

/** attributeCount/noticeCount가 있으면 requiredAttributeRate/requiredNoticeRate를
 * 구분해서 계산한다 — 없으면(register 라우트가 구분 안 하고 그냥 다 넘기는 경우)
 * 전부 attribute로 취급해도 score 자체는 동일하게 나온다. */
export function buildComplianceReport(
  attributeResults: ComplianceFieldResult[],
  noticeResults: ComplianceFieldResult[],
): ComplianceReport {
  const all = [...attributeResults, ...noticeResults];
  const score = rate(all);
  const requiredAttributeRate = rate(attributeResults);
  const requiredNoticeRate = rate(noticeResults);
  const aiAutoFillRate =
    all.length > 0 ? Math.round((all.filter((r) => r.source !== "PLACEHOLDER").length / all.length) * 100) : 100;

  const userInputNeeded = all
    .filter((r) => r.source === "PLACEHOLDER")
    .map((r) => ({
      fieldName: r.fieldName,
      reason: r.critical
        ? "법적/컴플라이언스 필수 항목(KC/인증 등) — 실제 값 확인이 꼭 필요합니다."
        : "원본 사이트에서 확인되지 않아 자리표시자로 등록됐습니다.",
    }));

  const criticalMissing = all.some((r) => r.critical && r.source === "PLACEHOLDER");
  const verdict: ComplianceReport["verdict"] = criticalMissing
    ? "FAIL"
    : userInputNeeded.length > 0
      ? "WARNING"
      : "PASS";
  const reasons = criticalMissing
    ? ["KC/인증 등 법적 필수 항목이 자리표시자 상태로 등록됐습니다 — Wing 승인 요청 전 반드시 확인하세요."]
    : [];

  return { score, requiredAttributeRate, requiredNoticeRate, aiAutoFillRate, userInputNeeded, verdict, reasons };
}
