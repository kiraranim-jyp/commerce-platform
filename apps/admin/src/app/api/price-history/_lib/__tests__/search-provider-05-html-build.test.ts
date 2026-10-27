import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildRunViews } from "@/app/qa/search/page";
import { SearchCompareView } from "@/app/qa/search/SearchCompareView";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵 SEARCH-PROVIDER-05 — **자립형 HTML 생성기**(로그인 없이 URL 을 클릭하기 위해)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `/qa/search` 는 **인증 뒤** 다(로컬 실측 307 → `/login`). CPO 가 따져에 로그인하면
 *    그 화면이 정답이지만, **클릭 검증이 로그인에 막히지 않도록** 같은 컴포넌트를
 *    정적 HTML 로도 떨궈 둔다(이 저장소의 `docs/wu-112-candidate-list.html` 선례).
 *
 * 🔴🔴 **회귀에서 자동 실행하지 않는다** — 그러면 매 회귀마다 산출물이 바뀌어
 *    작업트리가 더러워진다(이 트랙에서 실제로 겪었다). `CORE_SP05_HTML=1` 일 때만 쓴다.
 */

const FIXTURE = join(__dirname, "fixtures", "search-provider-05-raw.json");
/** 🔴 경로를 손으로 세다 한 칸 틀렸다(`apps/docs/`). 레포 루트는 `apps/admin` 에서 **두 단계** 위다. */
const OUT = join(__dirname, "../../../../../../../../docs/search-provider-05-urls.html");
const WRITE = process.env.CORE_SP05_HTML === "1";

function html(): string {
  const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as Parameters<typeof buildRunViews>[0];
  const body = renderToStaticMarkup(
    createElement(SearchCompareView, { origins: raw.origins, runs: buildRunViews(raw) }),
  );
  return [
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">",
    "<title>SEARCH-PROVIDER-05 — 정의된 Query 전수 검색 결과</title>",
    "<style>body{max-width:1180px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif}</style>",
    "</head><body>",
    "<h1 style=\"font-size:20px;font-weight:800;margin:0 0 4px\">TEST / QA — 정의된 Query 전수 검색 결과 육안 비교</h1>",
    "<p style=\"font-size:13px;color:#6b7280;margin:0 0 18px\">🔴 이 파일은 저장된 검색 결과를 그대로 그린 사본입니다. 검색을 다시 돌리지 않습니다.</p>",
    body,
    "</body></html>",
  ].join("");
}

describe("SEARCH-PROVIDER-05 — 자립형 HTML", () => {
  it("같은 컴포넌트로 렌더되고 원본 URL 이 전건 링크로 들어간다", () => {
    const out = html();
    const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as Parameters<typeof buildRunViews>[0];
    const total = buildRunViews(raw).reduce((a, v) => a + v.results.length, 0);
    expect((out.match(/<a /g) ?? []).length).toBe(total);
    /** 🔴 판정 어휘가 사본에도 없어야 한다. */
    for (const w of ["SAME", "DIFFERENT", "MI 판단"]) expect(out).not.toContain(w);
    if (WRITE) {
      writeFileSync(OUT, `${out}\n`);
      console.log(`저장 → ${OUT} (${(out.length / 1024).toFixed(0)}KB · 링크 ${total})`);
    }
  });
});
