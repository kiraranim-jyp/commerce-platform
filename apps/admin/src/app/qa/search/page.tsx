import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import {
  SearchCompareView,
  type SearchOrigin,
  type SearchResultRow,
  type SearchRunView,
} from "./SearchCompareView";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-04 QA — **Q2 vs Q3 육안 검증 화면**(서버 렌더)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **검색을 돌리지 않는다.** Apify 가 보관하던 run 8건을 받아 고정한 **fixture** 를 읽는다
 *    (`search-provider-04-raw.json` · 재검색 0 · 추가 과금 0).
 * 🔴 MI 0 · SAME/DIFFERENT 0 · Query 확정 0 · 운영 배선 0.
 * 🟢 유일하게 «계산» 하는 것은 기존 `classifyUrlShape` 뿐이다(새 규칙 0).
 */

export const dynamic = "force-static";

interface RawRun {
  productId: string;
  label: "Q2" | "Q3";
  query: string;
  results: { url: string; title?: string; displayedUrl?: string; description?: string }[];
}
interface RawFile {
  origins: Record<string, SearchOrigin>;
  runs: RawRun[];
}

const FIXTURE = join(
  process.cwd(),
  "src/app/api/price-history/_lib/__tests__/fixtures/search-provider-04-raw.json",
);

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};

/** 🔴 **순수 변환** — 판정을 만들지 않는다. 분류는 기존 owner, 품번은 «관측» 이다. */
export function buildRunViews(raw: RawFile): SearchRunView[] {
  return raw.runs.map((run) => {
    const code = (raw.origins[run.productId]?.code ?? "").toUpperCase();
    const shaped = run.results.map((r) => ({
      ...r,
      shape: String(classifyUrlShape(r.url)),
      host: hostOf(r.url),
    }));
    /** 같은 판매처가 **상품 상세를 2개 이상** 낸 경우만 「반복」으로 본다(로케일 중복 의심). */
    const productCount = new Map<string, number>();
    for (const r of shaped) {
      if (r.shape === "PRODUCT_PAGE") productCount.set(r.host, (productCount.get(r.host) ?? 0) + 1);
    }
    const results: SearchResultRow[] = shaped.map((r) => ({
      url: r.url,
      title: r.title,
      displayedUrl: r.displayedUrl,
      description: r.description,
      shape: r.shape,
      host: r.host,
      /** 🔴 관측 — 품번 «문자열» 이 보이는가. 동일상품 판정이 아니다. */
      codeSeen: Boolean(code) && `${r.url} ${r.title ?? ""}`.toUpperCase().includes(code),
      sellerRepeat: r.shape === "PRODUCT_PAGE" && (productCount.get(r.host) ?? 0) > 1,
    }));
    return { productId: run.productId, label: run.label, query: run.query, results };
  });
}

export default function QaSearchPage() {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as RawFile;
  const runs = buildRunViews(raw);
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
        TEST / QA — Apify 검색 결과 육안 비교 (Q2 vs Q3)
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px" }}>
        상품 4개 × Query 2개 = <strong>8회 검색</strong>의 원본 결과입니다. 🔴 이 화면은 검색을 다시 돌리지
        않습니다.
      </p>
      <SearchCompareView origins={raw.origins} runs={runs} />
    </main>
  );
}
