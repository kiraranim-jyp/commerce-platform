import type { ProcessingReport } from "./types";

const TYPE_LABELS: Record<string, string> = {
  PRODUCT: "PRODUCT",
  MODEL: "MODEL",
  DETAIL: "DETAIL",
  SIZE_CHART: "SIZE_CHART",
  PACKAGE: "PACKAGE",
  LOGO: "LOGO",
  BANNER: "BANNER",
  UNKNOWN: "UNKNOWN",
};

export function ProcessingReportView({ report }: { report: ProcessingReport }) {
  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h2 className="text-base font-medium">작업 리포트</h2>

      <dl className="mt-3 grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        <Row label="총 이미지" value={report.total} />
        <Row label="성공" value={report.success} />
        <Row label="실패" value={report.failed} />
        <Row label="처리 시간" value={`${report.processingTimeSec}s`} />
      </dl>

      <hr className="my-3 border-border" />

      <dl className="grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        <Row label="다운로드" value={report.downloaded} />
        {Object.entries(report.byType).map(([type, count]) => (
          <Row key={type} label={TYPE_LABELS[type] ?? type} value={count} />
        ))}
      </dl>

      <hr className="my-3 border-border" />

      <dl className="grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        <Row label="누끼" value={report.nukkiApplied} />
        <Row label="리사이즈" value={report.resized} />
        <Row label="압축" value={report.compressed} />
      </dl>

      {report.extraction && (
        <>
          <hr className="my-3 border-border" />
          <h3 className="text-xs font-medium text-text-secondary">Extraction</h3>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 sm:grid-cols-4">
            <Row label="Strategy" value={report.extraction.strategies.join(" + ") || "dom-scan"} />
            <Row label="Candidates" value={report.extraction.candidates} />
            <Row label="Excluded" value={report.extraction.excluded} />
            <Row label="Final" value={report.extraction.final} />
          </dl>
        </>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  );
}
