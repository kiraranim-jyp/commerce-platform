"use client";

import type { ComplianceReport } from "@commerce/listing";

const READINESS_CLASS: Record<ComplianceReport["approvalReadiness"], string> = {
  High: "text-success",
  Medium: "text-warning",
  Low: "text-error",
};

const READINESS_LABEL: Record<ComplianceReport["approvalReadiness"], string> = {
  High: "승인 가능성 높음",
  Medium: "일부 확인 필요",
  Low: "승인 전 반드시 확인 필요",
};

/**
 * P0-UI Epic 7(Resolver 결과 시각화) — "Compliance 76점"이라는 숫자만 보여주면
 * 사용자가 왜 그 점수인지 알 수 없다. buildComplianceReport의 resolvedFields(✓ 자동
 * 채움)와 userInputNeeded(△ 확인 필요)를 그대로 나열해서, CPO가 요청한 "자동 채움 /
 * 확인 필요" 목록 형태로 보여준다.
 */
export function ComplianceBreakdown({ report }: { report: ComplianceReport }) {
  const scoreClassName =
    report.score >= 90 ? "text-success" : report.score >= 60 ? "text-warning" : "text-error";

  return (
    <section className="rounded-md bg-surface p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium text-text-primary">Compliance</p>
        <span className={`text-lg font-semibold tabular-nums ${scoreClassName}`}>{report.score}점</span>
      </div>
      <p className={`mt-0.5 font-medium ${READINESS_CLASS[report.approvalReadiness]}`}>
        {READINESS_LABEL[report.approvalReadiness]}
      </p>
      <p className="mt-1 text-text-secondary">
        구매옵션 {report.requiredAttributeRate}% · 고시정보 {report.requiredNoticeRate}% · 자동입력{" "}
        {report.autoResolvedCount}/{report.autoResolvedCount + report.userRequiredCount} · 평균신뢰도{" "}
        {Math.round(report.confidenceAvg * 100)}%
      </p>

      {/* Sprint A-4(작업5 재보정, CPO 피드백) — "73점"이 왜 73점인지 하나의
          숫자로는 설명이 안 된다. 자동 매핑 자체가 부족한 건지(자동완성),
          아니면 원래 사람만 채울 수 있는 KC/인증 같은 항목이라 그런 건지
          (법적필수)를 나눠서 보여준다 — 대응 방법이 서로 다르기 때문이다. */}
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-background p-2 text-center">
        <div>
          <p className="text-[10px] text-text-tertiary">자동완성</p>
          <p className="text-sm font-semibold tabular-nums text-text-primary">{report.breakdown.autoFillRate}%</p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary">법적필수</p>
          <p
            className={`text-sm font-semibold tabular-nums ${report.breakdown.legalRequiredRate >= 100 ? "text-success" : "text-error"}`}
          >
            {report.breakdown.legalRequiredRate}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-tertiary">최종등록가능</p>
          <p className="text-sm font-semibold tabular-nums text-text-primary">
            {report.breakdown.finalRegistrableRate}%
          </p>
        </div>
      </div>

      {report.resolvedFields.length > 0 && (
        <div className="mt-3">
          <p className="font-medium text-text-secondary">자동 채움</p>
          <ul className="mt-1 space-y-1">
            {report.resolvedFields.map((f, i) => (
              <li key={`${f.fieldName}-${i}`} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-success">✓</span>
                <span className="text-text-primary">
                  {f.fieldName}
                  <span className="ml-1.5 text-text-secondary">{f.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.userInputNeeded.length > 0 && (
        <div className="mt-3">
          <p className="font-medium text-text-secondary">확인 필요</p>
          <ul className="mt-1 space-y-1">
            {report.userInputNeeded.map((f, i) => (
              <li key={`${f.fieldName}-${i}`} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-warning">△</span>
                <span className="text-text-primary">
                  {f.fieldName}
                  <span className="ml-1.5 text-text-secondary">{f.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
