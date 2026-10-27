"use client";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-04 QA — **Q2 vs Q3 육안 비교 화면**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정하지 않는다.** 이 화면은 **저장된 8회 Search 의 원본 결과를 보여줄 뿐** 이다.
 * ```
 * ❌ MI 계산   ❌ SAME/DIFFERENT 자동판정   ❌ Query 확정   ❌ 추가 Search
 * 🟢 허용 — 원본 URL · 제목 · 도메인 · 기존 `classifyUrlShape` 의 상품 상세 여부 표시
 * ```
 * 🔴 **검색을 다시 돌리지 않는다** — 데이터는 Apify 가 보관한 run 을 받아 고정한 fixture 다.
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
}

export interface SearchRunView {
  productId: string;
  label: "Q2" | "Q3";
  query: string;
  results: SearchResultRow[];
}

export interface SearchOrigin {
  brand: string;
  code: string;
  name: string;
}

const SHAPE_COLOR: Record<string, string> = {
  PRODUCT_PAGE: "#15803d",
  LISTING_PAGE: "#b45309",
  UNKNOWN_PAGE: "#6b7280",
  UNUSABLE: "#b91c1c",
};

function Row({ r }: { r: SearchResultRow }) {
  return (
    <li
      data-testid={`qa-sr-${r.host}`}
      style={{
        padding: "8px 10px",
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

function Column({ run }: { run: SearchRunView | undefined }) {
  if (!run) return <div style={{ fontSize: 13, color: "#6b7280" }}>(결과 없음)</div>;
  const products = run.results.filter((r) => r.shape === "PRODUCT_PAGE");
  const sellers = new Set(products.map((r) => r.host));
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: "#f8fafc", padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>
          {run.label}{" "}
          <span style={{ fontWeight: 400, color: "#6b7280" }} data-testid={`qa-q-${run.productId}-${run.label}`}>
            {run.query}
          </span>
        </div>
        {/* 🔴 집계는 «세어서» 보여줄 뿐 판정이 아니다. */}
        <div style={{ fontSize: 12, color: "#374151" }} data-testid={`qa-sum-${run.productId}-${run.label}`}>
          결과 {run.results.length} · 상품상세 <strong>{products.length}</strong> · 판매처{" "}
          <strong>{sellers.size}</strong>곳
        </div>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 520, overflowY: "auto" }}>
        {run.results.map((r, i) => (
          <Row key={`${r.url}-${i}`} r={r} />
        ))}
      </ul>
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
      <p style={{ fontSize: 13, color: "#b45309", margin: "0 0 16px" }}>
        🔴 이 화면은 <strong>저장된 8회 검색 결과</strong>를 그대로 보여줍니다. 검색을 다시 돌리지 않으며,
        동일상품 판정·MI 계산을 <strong>하지 않습니다</strong>. 「상품상세」는 기존 URL 분류기의 결과이고,
        「품번 보임」은 <strong>관측</strong>이지 동일상품 판정이 아닙니다.
      </p>
      {productIds.map((pid) => {
        const o = origins[pid];
        return (
          <section key={pid} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 2px" }} data-testid={`qa-origin-${pid}`}>
              {pid} — {o?.brand} {o?.code}
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>원상품: {o?.name}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Column run={runs.find((r) => r.productId === pid && r.label === "Q2")} />
              <Column run={runs.find((r) => r.productId === pid && r.label === "Q3")} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
