"use client";

import { useState } from "react";
import Link from "next/link";

interface ValidationResult {
  url: string;
  bucket: string;
  expectedLabel: string;
  note: string;
  status: "pass" | "fail" | "error";
  resolved: {
    ageGroup: string;
    gender: string;
    productType: string | null;
    evidence: string[];
  } | null;
  predict: { categoryCode: number | null; categoryName: string | null } | null;
  failureReasons: string[];
  error?: string;
}

interface BucketSummary {
  bucket: string;
  total: number;
  pass: number;
  accuracy: number;
}

interface ValidationReport {
  generatedAt: string;
  coupangConfigured: boolean;
  overallAccuracy: number;
  summary: BucketSummary[];
  results: ValidationResult[];
  failures: ValidationResult[];
}

const BUCKET_LABELS: Record<string, string> = {
  kids: "Kids Apparel",
  adult: "Adult Apparel",
  shoes: "Shoes",
  bag: "Bag",
  hat: "Hat",
  toy: "Toy",
  home: "Home",
  beauty: "Beauty",
};

// CPO 완료 기준: Kids/Shoes/Bag/Hat 정확도 목표 — 카드에 목표 대비 달성 여부를
// 바로 보여주기 위한 값이다(그 외 카테고리는 목표가 명시되지 않아 표시하지 않는다).
const ACCURACY_TARGETS: Record<string, number> = { kids: 95, shoes: 90, bag: 90, hat: 90 };

/**
 * Sprint A-2.6(Resolver Accuracy Validation) — Golden Dataset(80개)을 돌려
 * Category Resolver 2.0의 실제 정확도를 카테고리별로 보여준다. 버튼을 눌러야
 * 실행된다(자동 실행 안 함) — universalExtract를 80번 호출하는 무거운 작업이라
 * 페이지 진입만으로 매번 도는 건 낭비다.
 */
export default function ResolverValidationPage() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runValidation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/category-resolver-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "실행 실패");
      const data = (await res.json()) as ValidationReport;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Resolver Accuracy Validation</h1>
        <Link
          href="/admin/dashboard"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
        >
          ← 대시보드
        </Link>
      </div>
      <p className="mt-1 text-xs text-text-tertiary">
        Golden Dataset 80개(8개 카테고리 × 10개, 전부 실제 상품 URL)로 Category Resolver
        2.0의 정확도를 측정합니다. 실제 쿠팡 등록은 하지 않습니다 — Resolver 판단과
        Predict API 결과만 확인합니다.
      </p>

      <button
        type="button"
        onClick={runValidation}
        disabled={loading}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {loading ? "80개 상품 검증 중... (최대 몇 분)" : "검증 실행"}
      </button>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}

      {report && (
        <>
          {!report.coupangConfigured && (
            <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              쿠팡 인증 정보가 설정되어 있지 않아 Predict API 결과 없이 Resolver 판단만
              채점했습니다.
            </p>
          )}

          <section className="mt-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">전체 정확도</p>
              <p className="text-xl font-semibold text-text-primary">{report.overallAccuracy}%</p>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              {new Date(report.generatedAt).toLocaleString("ko-KR")} 실행 · {report.results.length}건
            </p>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {report.summary.map((s) => {
              const target = ACCURACY_TARGETS[s.bucket];
              const meetsTarget = target == null || s.accuracy >= target;
              return (
                <div key={s.bucket} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs text-text-secondary">{BUCKET_LABELS[s.bucket] ?? s.bucket}</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${meetsTarget ? "text-success" : "text-error"}`}
                  >
                    {s.accuracy}%
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {s.pass}/{s.total}건{target != null ? ` · 목표 ${target}%` : ""}
                  </p>
                </div>
              );
            })}
          </section>

          {report.failures.length > 0 && (
            <section className="mt-4 rounded-lg border border-border bg-surface p-4">
              <p className="text-xs font-medium text-text-secondary">
                실패 상세 ({report.failures.length}건)
              </p>
              <ul className="mt-2 space-y-2">
                {report.failures.map((f) => (
                  <li key={f.url} className="rounded-md border border-border/60 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">
                        [{BUCKET_LABELS[f.bucket] ?? f.bucket}] {f.expectedLabel}
                      </span>
                      <span className={f.status === "error" ? "text-warning" : "text-error"}>
                        {f.status === "error" ? "크롤링 실패" : "불일치"}
                      </span>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-primary hover:underline"
                    >
                      {f.url}
                    </a>
                    <p className="mt-1 text-text-tertiary">정답 근거: {f.note}</p>
                    {f.resolved && (
                      <p className="mt-1 text-text-secondary">
                        Resolver 판단: 연령대={f.resolved.ageGroup} / 성별={f.resolved.gender} /
                        상품유형={f.resolved.productType ?? "미검출"}
                      </p>
                    )}
                    {f.predict?.categoryName && (
                      <p className="text-text-secondary">
                        Predict API: {f.predict.categoryName} (코드 {f.predict.categoryCode})
                      </p>
                    )}
                    <p className="mt-1 font-medium text-error">
                      실패 원인: {f.failureReasons.join(", ")}
                      {f.error ? ` — ${f.error}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
