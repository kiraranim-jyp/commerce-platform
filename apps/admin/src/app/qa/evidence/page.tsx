"use client";

import { useState } from "react";
import type { EvidenceExplanation } from "@commerce/crawler/src/comparison-search/evidence-explain";
import type { JudgmentReadiness } from "@/app/api/price-history/_lib/judgment-readiness";
import { QaDiscoveryPanel, QaEvidenceView, QaJudgmentPanel, type QaDiscovery } from "./QaEvidenceView";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **TEST / QA 화면**(내부 Evidence X-Ray)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 화면이 아니다.** `/pipeline` · `/today` 등 실제 셀러 화면은 이 화면의
 *    내부 정보를 **가져가지 않는다**(계약이 잠근다).
 * 🔴 **새 판단을 만들지 않는다** — 기존 `factsFromProductUrl` · `computeMarketIntelligence`
 *    결과를 **그대로** 받아 보여줄 뿐이다.
 */
interface QaResponse {
  ok?: boolean;
  error?: string;
  extraction?: { status?: string; fetchPath?: string; httpCalls?: number | null; error?: string };
  explanation?: EvidenceExplanation | null;
  judgment?: JudgmentReadiness | null;
  discovery?: QaDiscovery | null;
  judgmentError?: string;
}

export default function QaEvidencePage() {
  const [url, setUrl] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/qa/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url || undefined, snapshotId: snapshotId || undefined }),
      });
      const json = (await res.json()) as QaResponse;
      if (!res.ok || json.ok === false) setError(json.error ?? `요청 실패 (${res.status})`);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>TEST / QA — 상품 Evidence 점검</h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
        🔴 내부 검증용 화면입니다. 여기 표시되는 분석 정보는 <strong>실제 운영 화면에 노출되지 않습니다.</strong>{" "}
        이 화면은 판단을 새로 만들지 않고 <strong>기존 판단 결과를 그대로</strong> 보여줍니다.
      </p>

      <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          상품 URL (Evidence 점검)
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          스냅샷 ID (기존 판단 결과 확인 · 선택)
          <input
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            placeholder="snapshot uuid"
            style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading || (!url && !snapshotId)}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            background: loading ? "#9ca3af" : "#111827",
            color: "#fff",
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "확인 중…" : "점검 실행"}
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      {result?.judgment && <QaJudgmentPanel judgment={result.judgment} />}
      {result?.judgmentError && <p style={{ color: "#b45309", fontSize: 13 }}>{result.judgmentError}</p>}

      {result?.extraction && (
        <p style={{ fontSize: 13, color: "#374151" }}>
          추출 상태 {result.extraction.status} · 경로 {result.extraction.fetchPath ?? "-"} · HTTP{" "}
          {result.extraction.httpCalls ?? "-"}
        </p>
      )}

      {result?.discovery && <QaDiscoveryPanel discovery={result.discovery} />}
      {result?.explanation && <QaEvidenceView explanation={result.explanation} />}
      {result && !result.explanation && url && (
        <p style={{ fontSize: 13, color: "#b45309" }}>
          이 URL 에서 상품 사실을 읽지 못했습니다 — 값을 지어내지 않고 상태만 표시합니다.
        </p>
      )}
    </main>
  );
}
