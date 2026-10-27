"use client";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-05 QA — **정의된 Query 전수 · 실제 URL 육안 검증**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정하지 않는다.** 이 화면은 **저장된 Search 의 원본 결과를 보여줄 뿐** 이다.
 * ```
 * ❌ MI 계산   ❌ SAME/DIFFERENT 자동판정   ❌ Query 확정   ❌ 추가 Search
 * ❌ A/B/C/D 를 **자동으로 찍지 않는다** — 그 분류는 사람 눈이 한다(CPO §7)
 * 🟢 허용 — 원본 URL(클릭 가능) · 제목 · 도메인 · 기존 `classifyUrlShape` · 품번 «노출» ·
 *          같은 판매처 반복(로케일 중복 의심) · 같은 URL 이 다른 Query 에도 나왔는가
 * ```
 * 🔴 **검색을 다시 돌리지 않는다** — 데이터는 고정된 fixture 다.
 * 🔴 운영 화면이 아니다(`/qa/*` 는 격리 계약이 전수로 잠근다).
 */

export interface SearchResultRow {
  url: string;
  title?: string;
  displayedUrl?: string;
  description?: string;
  /** 🟢 기존 `classifyUrlShape` 산출 그대로(새 규칙 0). */
  shape: string;
  host: string;
  /** 🔴 **관측** 이다 — URL/제목에 원상품 품번 문자열이 보이는가. 동일상품 판정이 **아니다**. */
  codeSeen: boolean;
  /** 🔴 같은 판매처가 이 Query 에서 낸 상품 URL 이 2개 이상인가(로케일 중복 의심). */
  sellerRepeat: boolean;
  /** 🟢 이 상품의 **다른 Query** 에서도 같은 URL 이 나왔는가 — Query 간 겹침. */
  alsoInQueries?: string[];
}

export interface SearchRunView {
  productId: string;
  label: string;
  /** `GENERATOR`(운영 열거기 Q1~Q8) · `PLANNER`(이름 있는 8축) · `HARNESS`(SPRINT-03/04 라벨). */
  source?: string;
  axis?: string;
  /** 같은 문자열이라 **합쳐진** 다른 라벨들(같은 질의를 두 번 돌리지 않았다는 기록). */
  alsoFrom?: string[];
  query: string;
  results: SearchResultRow[];
  /**
   * 🔴🔴 1차에서 **0건** 이 나온 질의를 한 번 더 돌린 **관측값**. 5개 중 2개가
   *    0 으로 **재현되지 않았다** ⟹ 「0건」을 「그 Query 는 결과가 없다」로 읽으면 틀린다.
   */
  recheckOrganicCount?: number;
}

export interface SearchOrigin {
  brand: string | null;
  code: string | null;
  name: string | null;
  color?: string | null;
}

const SHAPE_COLOR: Record<string, string> = {
  PRODUCT_PAGE: "#15803d",
  LISTING_PAGE: "#b45309",
  UNKNOWN_PAGE: "#6b7280",
  UNUSABLE: "#b91c1c",
};

const SOURCE_COLOR: Record<string, string> = {
  GENERATOR: "#1d4ed8",
  PLANNER: "#7c3aed",
  HARNESS: "#0f766e",
};

function Row({ r }: { r: SearchResultRow }) {
  return (
    <li
      style={{
        padding: "7px 10px",
        borderBottom: "1px solid #f1f5f9",
        background: r.shape === "PRODUCT_PAGE" ? "#f6fdf8" : "transparent",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: SHAPE_COLOR[r.shape] ?? "#6b7280" }}>
          {r.shape === "PRODUCT_PAGE" ? "상품상세" : r.shape}
        </span>
        <strong style={{ fontSize: 12 }}>{r.host}</strong>
        {r.codeSeen && <span style={{ fontSize: 11, color: "#15803d" }}>품번 보임</span>}
        {r.sellerRepeat && <span style={{ fontSize: 11, color: "#b45309" }}>같은 판매처 반복</span>}
        {r.alsoInQueries && r.alsoInQueries.length > 0 && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>다른 Query 에도 {r.alsoInQueries.length}회</span>
        )}
      </div>
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, color: "#1d4ed8", wordBreak: "break-all" }}
      >
        {r.title || r.url}
      </a>
      <div style={{ fontSize: 11, color: "#6b7280", wordBreak: "break-all" }}>{r.url}</div>
    </li>
  );
}

function QueryBlock({ run }: { run: SearchRunView }) {
  const products = run.results.filter((r) => r.shape === "PRODUCT_PAGE");
  const sellers = new Set(products.map((r) => r.host));
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ background: "#f8fafc", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span
            style={{ fontWeight: 800, fontSize: 13, color: SOURCE_COLOR[run.source ?? ""] ?? "#111827" }}
            data-testid={`qa-label-${run.productId}-${run.label}`}
          >
            {run.label}
          </span>
          {run.axis && <span style={{ fontSize: 11, color: "#6b7280" }}>{run.axis}</span>}
          {run.alsoFrom && run.alsoFrom.length > 0 && (
            <span style={{ fontSize: 11, color: "#6b7280" }}>= {run.alsoFrom.join(", ")}</span>
          )}
        </div>
        <code
          style={{ fontSize: 12, color: "#374151", wordBreak: "break-all" }}
          data-testid={`qa-q-${run.productId}-${run.label}`}
        >
          {run.query}
        </code>
        {/* 🔴 집계는 «세어서» 보여줄 뿐 판정이 아니다. */}
        <div style={{ fontSize: 12, color: "#374151" }} data-testid={`qa-sum-${run.productId}-${run.label}`}>
          결과 {run.results.length} · 상품상세 <strong>{products.length}</strong> · 판매처{" "}
          <strong>{sellers.size}</strong>곳
        </div>
        {run.recheckOrganicCount !== undefined && (
          <div
            style={{ fontSize: 12, color: run.recheckOrganicCount > 0 ? "#b91c1c" : "#6b7280" }}
            data-testid={`qa-recheck-${run.productId}-${run.label}`}
          >
            {run.recheckOrganicCount > 0
              ? `🔴 재확인에서 ${run.recheckOrganicCount}건 — 이 0 은 재현되지 않았습니다(검색 결과가 실행마다 달라집니다)`
              : "재확인에서도 0건"}
          </div>
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 420, overflowY: "auto" }}>
        {run.results.length === 0 ? (
          <li style={{ padding: "10px", fontSize: 12, color: "#6b7280" }}>(결과 없음)</li>
        ) : (
          run.results.map((r, i) => <Row key={`${r.url}-${i}`} r={r} />)
        )}
      </ul>
    </div>
  );
}

/** 🔴 **세는 것만** 한다 — 어느 Query 가 좋은지 이 표가 말하지 않는다(CPO §9). */
function SummaryTable({ runs }: { runs: SearchRunView[] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 14 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {["Query", "질의", "결과", "상품상세", "판매처", "품번 보임"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "4px 8px", border: "1px solid #e5e7eb" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const products = run.results.filter((r) => r.shape === "PRODUCT_PAGE");
            const sellers = new Set(products.map((r) => r.host));
            return (
              <tr key={run.label} data-testid={`qa-row-${run.productId}-${run.label}`}>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", fontWeight: 700 }}>{run.label}</td>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", maxWidth: 360, wordBreak: "break-all" }}>
                  {run.query}
                </td>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                  {run.results.length}
                </td>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                  {products.length}
                </td>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>{sellers.size}</td>
                <td style={{ padding: "3px 8px", border: "1px solid #e5e7eb", textAlign: "right" }}>
                  {run.results.filter((r) => r.codeSeen).length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SearchCompareView({
  origins,
  runs,
}: {
  origins: Record<string, SearchOrigin>;
  runs: SearchRunView[];
}) {
  const productIds = [...new Set(runs.map((r) => r.productId))].sort();
  return (
    <div data-testid="qa-search-root">
      <p style={{ fontSize: 13, color: "#b45309", margin: "0 0 10px", lineHeight: 1.6 }}>
        🔴 이 화면은 <strong>저장된 검색 결과</strong>를 그대로 보여줍니다. 검색을 다시 돌리지 않으며, 동일상품
        판정·MI 계산을 <strong>하지 않습니다</strong>. 「상품상세」는 기존 URL 분류기의 결과이고, 「품번 보임」은{" "}
        <strong>관측</strong>이지 동일상품 판정이 아닙니다.
      </p>
      <p style={{ fontSize: 12, color: "#374151", margin: "0 0 18px", lineHeight: 1.7 }}>
        <strong>육안 분류 기준</strong> — <strong>A</strong> 유효 상품 후보(실제 판매처의 상품 상세) ·{" "}
        <strong>B</strong> 반복/중복(같은 판매처의 locale·파라미터 차이) · <strong>C</strong> 무관(부품·다른 카테고리·
        검색/카테고리 페이지·Pinterest·블로그·기사·이미지·브랜드 홈) · <strong>D</strong> 불확실.
        <br />
        🔴 <strong>이 분류는 화면이 찍지 않습니다</strong> — 재료만 보여 드리고 판단은 사람이 합니다.
      </p>
      {productIds.map((pid) => {
        const o = origins[pid];
        const mine = runs.filter((r) => r.productId === pid);
        return (
          <section key={pid} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 2px" }} data-testid={`qa-origin-${pid}`}>
              {pid} — {o?.brand} {o?.code}
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
              원상품: {o?.name}
              {o?.color ? ` · 색상 ${o.color}` : ""} · 질의 {mine.length}개
            </p>
            <SummaryTable runs={mine} />
            {mine.map((run) => (
              <QueryBlock key={run.label} run={run} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
