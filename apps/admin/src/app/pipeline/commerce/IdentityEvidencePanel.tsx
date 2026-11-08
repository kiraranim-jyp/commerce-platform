"use client";

import { useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-EVIDENCE-API-UI-1 — **원본 ↔ 후보 근거 대조 화면**(CPO 승인 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **여기 있는 「양립 가능」은 Evidence 비교 상태이고 «동일상품 판정이 아니다».**
 *    그래서 이 파일에는 다음 어휘가 **한 글자도 없다**(계약이 소스로 잠근다):
 * ```
 * ❌ 동일상품 / SAME / 매칭 성공 / 확정 / 일치 판정
 * ❌ 가격 · 금액 · tier · verdict · 적격 · 수익 · 추천
 * ```
 * 🔴 `wu-130 F-4`(「그 영역에 집계/판정 어휘 금지」)가 실제로 FAIL 을 낸 선례가 있어
 *    **어휘를 처음부터 좁게** 썼다.
 *
 * ── 🔵 첫 화면 = 상태 / 상세 = 근거 (CPO 원칙) ────────────────────────────────
 * ```
 * 첫 화면  축 11개 × (원본 상태 · 후보 상태 · 비교 상태 · 관측 전용 여부)
 * 상세     원문(raw) · 정규화(normalized) · 출처(source) · 독립 출처 수 ·
 *          충돌 근거(conflictBasis) · 증거 공급 여부
 * ```
 * 🔴 **없는 값을 채우지 않는다** — 값이 없으면 「—」를 적고 상태로 말한다.
 * 🔴 **API 가 내려준 값만 표시한다** — 브랜드/상품명 양립 판정을 UI 에서 **다시 구현하지 않는다**
 *    (그 계산은 `identity-evidence-summary.ts` 하나가 소유한다).
 */

/* ── 🔴 타입은 API 응답 모양 그대로다(UI 가 새 칸을 만들지 않는다) ───────────── */

export interface IdentityEvidenceValueRow {
  raw: string;
  normalized: string;
  source: string;
}

export interface IdentityEvidenceAxisRow {
  axis: string;
  observationOnly: boolean;
  originState: string;
  candidateState: string;
  comparison: string;
  origin: IdentityEvidenceValueRow[];
  candidate: IdentityEvidenceValueRow[];
  originIndependentSources: number;
  candidateIndependentSources: number;
  conflictBasis: string | null;
}

export interface IdentityEvidenceCandidateRow {
  candidateUrl: string;
  domain: string;
  axes: IdentityEvidenceAxisRow[];
  supply: { originHasEvidence: boolean; candidateHasEvidence: boolean; asymmetric: boolean };
}

export interface IdentityEvidencePayload {
  candidates: IdentityEvidenceCandidateRow[];
}

/**
 * 🔴 **판매자 표현** — CPO 지시서의 표를 그대로 쓴다.
 *    🔴 「양립 가능」은 **비교 상태 전용** 이고 한쪽 상태(PRESENT 등)와 **섞지 않는다**.
 */
const SIDE_LABEL: Record<string, string> = {
  PRESENT: "근거 확인",
  MISSING: "데이터는 있으나 근거 없음",
  NOT_MEASURED: "확인할 데이터 없음",
  CONFLICT: "근거 충돌",
};

/** 🔴 비교 상태만 쓰는 표 — `PRESENT` 를 「양립 가능」으로 읽는 자리는 **여기뿐** 이다. */
const COMPARISON_LABEL: Record<string, string> = {
  PRESENT: "현재 근거상 충돌 없음",
  MISSING: "데이터는 있으나 근거 없음",
  NOT_MEASURED: "확인할 데이터 없음",
  CONFLICT: "근거 충돌",
};

/** 🔵 축 이름을 판매자 말로. 🔴 내부 토큰을 그대로 노출하지 않는다(기존 원칙). */
const AXIS_LABEL: Record<string, string> = {
  BRAND: "브랜드",
  PRODUCT_NAME: "상품명",
  MODEL_CODE: "품번",
  FORM: "형태",
  COLOR: "색상",
  MATERIAL: "소재",
  FIT: "핏",
  COMPOSITION: "혼용률",
  SET: "세트 구성",
  OPTION_SKU: "판매처 품번",
  IMAGE: "이미지",
};

const sideLabel = (s: string): string => SIDE_LABEL[s] ?? s;
const comparisonLabel = (s: string): string => COMPARISON_LABEL[s] ?? s;
const axisLabel = (a: string): string => AXIS_LABEL[a] ?? a;

function ValueList({ rows }: { rows: IdentityEvidenceValueRow[] }) {
  /** 🔴 **없으면 「—」** — 지어내지 않는다. */
  if (rows.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <ul className="space-y-1">
      {rows.map((v, i) => (
        <li key={`${v.source}-${i}`} className="leading-snug">
          <span className="font-medium text-slate-800">{v.raw}</span>
          <span className="ml-1 text-slate-500">· 정규화 {v.normalized}</span>
          <span className="ml-1 text-slate-400">· 출처 {v.source}</span>
        </li>
      ))}
    </ul>
  );
}

function AxisRow({ axis }: { axis: IdentityEvidenceAxisRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`identity-axis-${axis.axis}`} className="border-t border-slate-100 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[72px] font-semibold text-slate-800">{axisLabel(axis.axis)}</span>
        {/** 🟡 관측 전용 축임을 숨기지 않는다 — 판정 축과 구분한다. */}
        {axis.observationOnly ? (
          <span data-testid={`identity-observation-only-${axis.axis}`} className="rounded bg-slate-100 px-1 text-slate-500">
            관측 전용
          </span>
        ) : null}
        <span data-testid={`identity-comparison-${axis.axis}`} className="text-slate-700">
          대조 — {comparisonLabel(axis.comparison)}
        </span>
        <span data-testid={`identity-origin-state-${axis.axis}`} className="text-slate-500">
          원본 {sideLabel(axis.originState)}
        </span>
        <span data-testid={`identity-candidate-state-${axis.axis}`} className="text-slate-500">
          후보 {sideLabel(axis.candidateState)}
        </span>
        <button
          type="button"
          data-testid={`identity-detail-toggle-${axis.axis}`}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded border border-slate-200 px-2 py-0.5 text-slate-600"
        >
          {open ? "근거 접기" : "근거 보기"}
        </button>
      </div>
      {open ? (
        <div data-testid={`identity-detail-${axis.axis}`} className="mt-2 grid gap-2 rounded bg-slate-50 p-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-semibold text-slate-600">원본 상품</div>
            <ValueList rows={axis.origin} />
            <div className="mt-1 text-slate-400">독립 출처 {axis.originIndependentSources}곳</div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-600">후보 상품</div>
            <ValueList rows={axis.candidate} />
            <div className="mt-1 text-slate-400">독립 출처 {axis.candidateIndependentSources}곳</div>
          </div>
          {axis.conflictBasis ? (
            <div data-testid={`identity-conflict-${axis.axis}`} className="sm:col-span-2 text-rose-700">
              충돌 근거 — {axis.conflictBasis}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IdentityEvidencePanel({
  identityEvidence,
}: {
  /**
   * 🔴🔴 **`null` 과 `{candidates: []}` 를 가른다** — 그 둘은 다른 사실이다:
   * ```
   * null              그 경로가 **돌지 않았다**(국내 확인을 하지 않았다)
   * {candidates: []}  **돌았는데 대조 대상이 0** 이다
   * ```
   */
  identityEvidence?: IdentityEvidencePayload | null;
}) {
  /** 🔴 경로가 안 돌았으면 **영역 자체를 만들지 않는다**(「근거 없음」으로 적지 않는다). */
  if (!identityEvidence) return null;

  const rows = identityEvidence.candidates;
  return (
    <section data-testid="identity-evidence-panel" className="mt-3 rounded border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-slate-800">🔍 원본 ↔ 후보 근거 대조</h4>
      {/** 🔴🔴 이 한 줄이 「양립 가능 = 동일상품」 오독을 막는다. 지우면 계약이 FAIL 한다. */}
      <p data-testid="identity-evidence-scope" className="mt-1 text-xs text-slate-500">
        속성별로 어떤 근거가 확인됐는지 보여주는 자료입니다. 충돌이 없다는 것이 같은 상품이라는 뜻은 아닙니다.
      </p>
      {rows.length === 0 ? (
        <p data-testid="identity-evidence-empty" className="mt-2 text-xs text-slate-500">
          이번 조회에서 대조할 후보가 없었습니다.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {rows.map((c) => (
            /** 🔴 **후보 하나당 한 블록** — `candidateUrl` 이 연결 키다(후보가 섞이지 않는다). */
            <div key={c.candidateUrl} data-testid={`identity-candidate-${c.candidateUrl}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700">{c.domain}</span>
                <a href={c.candidateUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  후보 페이지
                </a>
                {/** 🔴 공급 비대칭을 **숨기지 않는다**. */}
                {c.supply.asymmetric ? (
                  <span data-testid={`identity-asymmetric-${c.candidateUrl}`} className="text-amber-700">
                    한쪽 근거만 수집됨
                  </span>
                ) : null}
              </div>
              {c.axes.map((a) => (
                <AxisRow key={`${c.candidateUrl}-${a.axis}`} axis={a} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
