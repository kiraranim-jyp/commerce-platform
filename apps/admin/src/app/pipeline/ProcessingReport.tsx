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
    <section className="rounded-lg border border-zinc-200 p-4 text-sm">
      <h2 className="text-base font-medium">작업 리포트</h2>

      <dl className="mt-3 grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        <Row label="총 이미지" value={report.total} />
        <Row label="성공" value={report.success} />
        <Row label="실패" value={report.failed} />
        <Row label="처리 시간" value={`${report.processingTimeSec}s`} />
      </dl>

      <hr className="my-3 border-zinc-100" />

      <dl className="grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        {Object.entries(report.byType).map(([type, count]) => (
          <Row key={type} label={TYPE_LABELS[type] ?? type} value={count} />
        ))}
      </dl>

      <hr className="my-3 border-zinc-100" />

      <dl className="grid grid-cols-2 gap-y-2 sm:grid-cols-4">
        <Row label="중복 제거" value={report.dedupRemoved} />
        <Row label="리사이즈" value={report.resized} />
        <Row label="압축" value={report.compressed} />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-800">{value}</dd>
    </div>
  );
}
