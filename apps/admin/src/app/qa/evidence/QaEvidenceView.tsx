"use client";

import type { EvidenceExplanation } from "@commerce/crawler/src/comparison-search/evidence-explain";
import type { JudgmentReadiness } from "@/app/api/price-history/_lib/judgment-readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **TEST/QA X-Ray 화면**(CPO GO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 컴포넌트는 «운영 화면» 이 아니다.** 여기서 보여주는 내부 Evidence 를
 *    `CommerceWorkspace` 등 운영 UI 로 가져가지 않는다(계약이 양방향으로 잠근다).
 * 🔴 **판단하지 않는다** — 받은 값을 그리기만 한다(계산 0 · fetch 0).
 */

const STATE_LABEL: Record<string, string> = { READY: "판단 가능", LIMITED: "제한적 판단", HOLD: "판단 불가" };
const STATE_COLOR: Record<string, string> = { READY: "#15803d", LIMITED: "#b45309", HOLD: "#b91c1c" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>{title}</h2>
      {children}
    </section>
  );
}

export function QaJudgmentPanel({ judgment }: { judgment: JudgmentReadiness }) {
  return (
    <Section title="① 기존 판단 결과 — 재계산 없음">
      <p data-testid="qa-readiness-state" style={{ fontWeight: 700, color: STATE_COLOR[judgment.state] }}>
        {STATE_LABEL[judgment.state] ?? judgment.state} ({judgment.state})
      </p>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <tbody>
          {judgment.steps.map((s) => (
            <tr key={s.name} data-testid={`qa-step-${s.name}`}>
              <th style={{ textAlign: "left", padding: "4px 8px", width: 140 }}>{s.name}</th>
              <td style={{ padding: "4px 8px", color: STATE_COLOR[s.state], fontWeight: 600, width: 90 }}>
                {STATE_LABEL[s.state]}
              </td>
              <td style={{ padding: "4px 8px" }}>{s.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {judgment.state !== "READY" && (
        <div data-testid="qa-hold-reasons" style={{ marginTop: 12 }}>
          {/* 🔴 CPO §9 — HOLD 면 «왜» 가 반드시 보여야 한다. */}
          <strong style={{ fontSize: 13 }}>막힌 이유</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
            {judgment.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

export interface QaDiscovery {
  queries: { axis: string; text: string }[];
  searchExecutor: string | null;
  blocker: string | null;
  note: string;
}

/**
 * 🔵 **Discovery 단계** — 검색어 생성까지는 동작하고, 그 뒤가 막혀 있다는 사실을
 *    화면이 **직접** 말한다. 🔴 이 패널은 검색을 실행하지 않는다.
 */
export function QaDiscoveryPanel({ discovery }: { discovery: QaDiscovery }) {
  return (
    <Section title="⓪ Discovery — 검색어 생성 / 자동 검색 실행">
      <p style={{ fontSize: 13, margin: "0 0 8px" }} data-testid="qa-discovery-executor">
        자동 검색 실행자:{" "}
        <strong style={{ color: discovery.searchExecutor ? "#15803d" : "#b91c1c" }}>
          {discovery.searchExecutor ?? "없음 (BLOCKED)"}
        </strong>
        {discovery.blocker && <span style={{ color: "#6b7280" }}> · blocker {discovery.blocker}</span>}
      </p>
      <p style={{ fontSize: 13, margin: "0 0 10px", color: "#b45309" }} data-testid="qa-discovery-note">
        {discovery.note}
      </p>
      <strong style={{ fontSize: 13 }}>생성된 검색어 {discovery.queries.length}개</strong>
      <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 13 }} data-testid="qa-discovery-queries">
        {discovery.queries.length === 0 && <li>(증거가 부족해 검색어를 만들지 못했습니다)</li>}
        {discovery.queries.map((q) => (
          <li key={`${q.axis}-${q.text}`}>
            <code>{q.text}</code>
            <span style={{ color: "#6b7280" }}> · {q.axis}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function QaEvidenceView({ explanation }: { explanation: EvidenceExplanation }) {
  const { titleStructure: ts, language, image, sleeve } = explanation;
  return (
    <div data-testid="qa-evidence-root">
      <Section title="② 원본">
        <dl style={{ fontSize: 13, margin: 0 }}>
          <dt style={{ fontWeight: 600 }}>상품 URL</dt>
          <dd data-testid="qa-source-url" style={{ margin: "0 0 8px", wordBreak: "break-all" }}>
            {explanation.sourceUrl}
          </dd>
          <dt style={{ fontWeight: 600 }}>TITLE 원문</dt>
          <dd data-testid="qa-raw-title" style={{ margin: "0 0 8px" }}>{explanation.title || "(없음)"}</dd>
          <dt style={{ fontWeight: 600 }}>DESCRIPTION 원문</dt>
          <dd data-testid="qa-raw-description" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {explanation.description ?? "(없음)"}
          </dd>
        </dl>
      </Section>

      <Section title="③ 상품명 구조 분석">
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            <tr data-testid="qa-structure-brand">
              <th style={{ textAlign: "left", padding: "4px 8px", width: 130 }}>BRAND</th>
              <td style={{ padding: "4px 8px" }}>{ts.brand ? `${ts.brand.value} (source: ${ts.brand.source})` : "(없음)"}</td>
            </tr>
            <tr data-testid="qa-structure-season">
              <th style={{ textAlign: "left", padding: "4px 8px" }}>SEASON</th>
              <td style={{ padding: "4px 8px" }}>{ts.season?.value ?? "(없음)"}</td>
            </tr>
            <tr data-testid="qa-structure-form">
              <th style={{ textAlign: "left", padding: "4px 8px" }}>FORM</th>
              <td style={{ padding: "4px 8px" }}>{ts.forms.length ? ts.forms.join(" · ") : "(없음)"}</td>
            </tr>
            <tr data-testid="qa-structure-product-name">
              <th style={{ textAlign: "left", padding: "4px 8px" }}>PRODUCT_NAME</th>
              <td style={{ padding: "4px 8px" }}>{ts.productName ?? "(없음)"}</td>
            </tr>
            <tr data-testid="qa-structure-model-code">
              <th style={{ textAlign: "left", padding: "4px 8px" }}>MODEL_CODE</th>
              <td style={{ padding: "4px 8px" }}>{ts.modelCode?.value ?? "(없음)"}</td>
            </tr>
            <tr data-testid="qa-structure-sleeve">
              <th style={{ textAlign: "left", padding: "4px 8px" }}>SLEEVE</th>
              {/* 🔴 긴팔/반팔은 «관측값» 이고 판정 축이 아니다 — 화면이 그 사실을 적는다. */}
              <td style={{ padding: "4px 8px" }}>
                {sleeve.kind ? `${sleeve.kind} (${sleeve.phrase}) · 관측값 · 판정 축 아님` : "(원문이 말하지 않음)"}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="④ 한글 / 영문 의미 분석 · 동의어">
        <p style={{ fontSize: 13, margin: "0 0 8px" }} data-testid="qa-language-flags">
          한글 {language.hasKorean ? "있음" : "없음"} · 영문 {language.hasLatin ? "있음" : "없음"}
        </p>
        <div data-testid="qa-language-mappings">
          <strong style={{ fontSize: 13 }}>한글 → 영문 대응</strong>
          <ul style={{ margin: "4px 0 10px", paddingLeft: 18, fontSize: 13 }}>
            {language.mappings.length === 0 && <li>(대응된 표기 없음)</li>}
            {language.mappings.map((m) => (
              <li key={`${m.axis}-${m.from}`}>
                [{m.axis}] {m.from} → {m.to}
              </li>
            ))}
          </ul>
        </div>
        <div data-testid="qa-synonym-groups">
          <strong style={{ fontSize: 13 }}>같은 뜻으로 읽은 표기</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
            {language.synonymGroups.length === 0 && <li>(없음)</li>}
            {language.synonymGroups.map((g) => (
              <li key={g.canonical} data-testid={`qa-synonym-${g.canonical}`}>
                {g.canonical} ← {g.matched.join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="⑤ 추출 Evidence (출처 포함)">
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px", width: 140 }}>축</th>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>값 · 출처</th>
            </tr>
          </thead>
          <tbody>
            {explanation.evidence.map((e) => (
              <tr key={e.axis} data-testid={`qa-axis-${e.axis}`}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600 }}>
                  {e.axis}
                  {e.probeOnly && <span style={{ color: "#b45309", fontWeight: 400 }}> (관측 전용)</span>}
                </th>
                <td style={{ padding: "4px 8px" }}>
                  {e.values.length === 0 && <span>(없음)</span>}
                  {e.values.map((v, i) => (
                    <div key={`${v.source}-${v.value}-${i}`}>
                      {v.value}
                      <span style={{ color: "#6b7280" }}> · source: {v.source}</span>
                      {v.recovered === true && (
                        <span style={{ color: "#15803d" }}> · recovered: YES</span>
                      )}
                      {v.recovered === false && <span style={{ color: "#6b7280" }}> · recovered: NO</span>}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="⑥ IMAGE Evidence">
        <p style={{ fontSize: 13, margin: "0 0 8px" }} data-testid="qa-image-summary">
          이미지 {image.count}장 · 정규화 {image.normalized ? "있음" : "없음"}
          {image.digest ? ` · digest ${image.digest}` : ""}
        </p>
        {image.representative && (
          <img
            data-testid="qa-image-representative"
            src={image.representative}
            alt="대표 이미지"
            style={{ maxWidth: 240, border: "1px solid #e5e7eb", borderRadius: 6 }}
          />
        )}
        {!image.representative && <p style={{ fontSize: 13 }} data-testid="qa-image-none">대표 이미지 없음</p>}
      </Section>

      <Section title="⑦ 이 화면의 한계">
        {/* 🔴 한계를 숨기면 화면이 거짓말을 한다. */}
        <ul data-testid="qa-caveats" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {explanation.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
