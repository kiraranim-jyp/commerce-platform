/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage WU — Phase 3: coconjennie(sixshop) + chouchouenfant 카탈로그
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다.
 * 🔴 robots/약관 정책을 **재구현하지 않는다** — `checkRobots` 를 쓴다.
 * 🔴 경로를 **추측하지 않는다** — HTML 의 `<form>` action 과 `<a href>` 를 «관찰» 한다.
 * 🔴 품번 0건을 「미취급」·「품번 없음」으로 해석하지 않는다.
 *
 * ── ① coconjennie.com (sixshop) ───────────────────────────────────────────
 *   Phase 2 에서 플랫폼 미감지로 빠졌다. 지문: `static.sixshop.com` ·
 *   「코코앤제니(수입 아동복 편집샵)」. 🔴 sixshop 검색 규약을 모르므로 **홈 HTML 에서
 *   검색 form 과 상품 링크를 직접 찾는다.** 못 찾으면 「경로 불명」으로 남긴다.
 *
 * ── ② chouchouenfant.kr 시즌 분포 ─────────────────────────────────────────
 *   Phase 2 는 상위 3건만 봤고 전부 `223…`(AW23)이었다. 🔴 그것으로 「AW23 만 판다」로
 *   닫지 않는다. 질문은 **「`B226…` 계열(현행)을 실제로 파는가」** 다.
 *   Cafe24 검색은 `page` 파라미터를 받으므로 여러 페이지를 본다.
 *
 * ── 🔴 접두 탈락 규약 ─────────────────────────────────────────────────────
 *   실측: 해외 `B223AC074` ↔ 국내 `223AC074` — 접두 영문 1자가 없다.
 *   그래서 두 모양을 **갈라서** 센다(전체형 / 접두탈락형). 🔴 여기서
 *   `confirmBrandCodeInTitle` 을 고치지 않는다 — 세기만 한다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 두 모양을 갈라 센다. 단어경계 필수 — 없으면 긴 토큰 안에서 거짓양성이 난다. */
const SHAPES = [
  { name: "FULL(B226AC035형)", re: /\b[A-Z]\d{3}[A-Z]{2}\d{3}\b/g },
  { name: "PREFIX_STRIPPED(223AC074형)", re: /\b\d{3}[A-Z]{2}\d{3}\b/g },
  { name: "SEASON(AW26MS185형)", re: /\b(?:SS|AW|FW|PE)\d{2}[A-Z]{2}\d{3}\b/g },
  { name: "PEPE(PP24KASHE1195NER형)", re: /\b[A-Z]{2}\d{2}[A-Z]{3,6}\d{3,5}[A-Z]{2,4}\b/g },
];

function visibleText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").toUpperCase();
}
function shapesIn(html: string): Record<string, string[]> {
  const t = visibleText(html);
  const out: Record<string, string[]> = {};
  for (const s of SHAPES) {
    const hits = [...new Set([...t.matchAll(s.re)].map((m) => m[0]))];
    if (hits.length) out[s.name] = hits;
  }
  return out;
}
/** 🔴 `223AC074` → 시즌 접두 숫자 3자리. `226` 이 우리 현행 계열이다. */
function seasonPrefixes(codes: string[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const c of codes) {
    const m = /^([A-Z]?)(\d{3})/.exec(c);
    if (m) t[m[2]] = (t[m[2]] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(t).sort((a, b) => Number(a[0]) - Number(b[0])));
}
const titleOf = (h: string) => (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? "").trim().slice(0, 100);

describe.skipIf(!LIVE)("🔴 DOM-VALUE-03 — sixshop 구조 + chouchouenfant 카탈로그", () => {
  it(
    "경로를 관찰해서 찾고, 시즌 분포로 「현행 상품을 파는가」에 답한다",
    async () => {
      let requests = 0;
      const t0 = Date.now();
      const get = async (u: string) => { requests++; return fetchHtmlDirect(u); };

      /* ══ ① coconjennie — sixshop 구조를 «관찰» 한다 ══ */
      const cj: Record<string, unknown> = { domain: "coconjennie.com" };
      const cjHome = await get("https://coconjennie.com");
      if (!cjHome?.html) cj.error = "홈을 받지 못했다";
      else {
        const h = cjHome.html;
        // 🔴 검색 form 을 «찾는다». 없으면 없다고 적는다.
        const forms = [...h.matchAll(/<form[^>]*action="([^"]*)"[^>]*>([\s\S]{0,600}?)<\/form>/gi)]
          .map((m) => ({ action: m[1], inputs: [...m[2].matchAll(/name="([^"]+)"/gi)].map((x) => x[1]) }))
          .filter((f) => /search|keyword|query/i.test(f.action) || f.inputs.some((n) => /keyword|q|search/i.test(n)));
        // 🔴 상품 링크 후보 — 내부 링크만, 기능 페이지 제외
        const links = [...new Set([...h.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))]
          .filter((u) => !/^(?:https?:)?\/\//.test(u) || u.includes("coconjennie.com"))
          .filter((u) => !/(?:^#|javascript:|mailto:|\.(?:png|jpg|css|js|svg|ico))/i.test(u));
        cj.searchFormsFound = forms;
        cj.internalLinkSample = links.slice(0, 25);
        cj.sixshopHints = [...new Set([...h.matchAll(/sixshop[a-z0-9./-]*/gi)].map((m) => m[0]))].slice(0, 6);
        cj.homeShapes = shapesIn(h);
        cj.brandMentionsOnHome = ["보보쇼즈", "BOBO", "페페", "PEPE", "메인스토리", "MAIN STORY"]
          .filter((b) => h.toUpperCase().includes(b.toUpperCase()));

        /* 🔴 관찰된 링크 중 상품으로 보이는 것 3개를 받아 품번을 본다 */
        const prodish = links.filter((u) => /product|goods|item|detail/i.test(u)).slice(0, 3);
        const pages: unknown[] = [];
        for (const u of prodish) {
          const abs = u.startsWith("http") ? u : `https://coconjennie.com${u.startsWith("/") ? "" : "/"}${u}`;
          const rb = await checkRobots(abs); requests++;
          if (rb.state !== "NOT_DISALLOWED") { pages.push({ url: abs, skipped: `robots ${rb.state}` }); continue; }
          const pr = await get(abs);
          if (pr?.html) pages.push({ url: abs, title: titleOf(pr.html), shapes: shapesIn(pr.html) });
        }
        cj.productishPagesTried = prodish.length;
        cj.productPages = pages;
        cj.conclusion = forms.length === 0 && prodish.length === 0
          ? "🔴 검색 form 도 상품 링크도 관찰되지 않았다 — 경로 불명(추측하지 않았다)"
          : "🟢 관찰된 경로로만 접근했다";
      }

      /* ══ ② chouchouenfant — Bobo Choses 카탈로그 시즌 분포 ══ */
      const ce: Record<string, unknown> = { domain: "chouchouenfant.kr" };
      const allCodes: string[] = [];
      const titles: string[] = [];
      const pageRows: unknown[] = [];
      for (const page of [1, 2, 3, 4]) {
        const u = `https://chouchouenfant.kr/product/search.html?keyword=${encodeURIComponent("보보쇼즈")}&page=${page}`;
        const rb = await checkRobots(u); requests++;
        if (rb.state !== "NOT_DISALLOWED") { pageRows.push({ page, skipped: `robots ${rb.state}` }); break; }
        const r = await get(u);
        if (!r?.html) { pageRows.push({ page, ok: false }); break; }
        /** 🔴 목록 페이지의 «상품명 링크» 에서 품번을 읽는다 — 상세를 N번 받지 않는다(비용). */
        const names = [...new Set([...r.html.matchAll(/<a[^>]+href="\/product\/[^"]*\/\d+\/[^"]*"[^>]*>([\s\S]{0,160}?)<\/a>/gi)]
          .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter((s) => s.length > 3))];
        const sh = shapesIn(r.html);
        const codes = [...(sh["FULL(B226AC035형)"] ?? []), ...(sh["PREFIX_STRIPPED(223AC074형)"] ?? [])];
        allCodes.push(...codes);
        titles.push(...names);
        pageRows.push({ page, bytes: r.html.length, productNames: names.length, codes: codes.length, sampleNames: names.slice(0, 3) });
        if (names.length === 0) break; // 🔴 더 받지 않는다 — 빈 페이지면 끝이다
      }
      const uniqCodes = [...new Set(allCodes)];
      ce.pages = pageRows;
      ce.distinctProductNames = [...new Set(titles)].length;
      ce.distinctCodes = uniqCodes.length;
      ce.codeSamples = uniqCodes.slice(0, 20);
      /** 🔴🔴 핵심 — 「현행 `226` 계열을 파는가」 */
      ce.seasonPrefixDistribution = seasonPrefixes(uniqCodes);
      ce.hasCurrentSeason226 = uniqCodes.some((c) => /^[A-Z]?226/.test(c));
      ce.prefixStrippedRatio = {
        full: uniqCodes.filter((c) => /^[A-Z]\d{3}/.test(c)).length,
        stripped: uniqCodes.filter((c) => /^\d{3}/.test(c)).length,
        note: "🔴 접두 영문이 있는 형태 vs 없는 형태. 규약이 일관되는지 본다.",
      };

      const report = {
        scope: {
          note: "🔴 sample — coconjennie 홈+상품 3건 · chouchouenfant 검색 최대 4페이지. 전수가 아니다.",
          "🔴 하지 않은 것": "경로 추측 · robots 우회 · confirmBrandCodeInTitle 수정 · 어댑터 작성",
          "🔴 해석 금지": "품번 0건을 「미취급」이나 「품번 없음」으로 읽지 않는다",
        },
        cost: { requests, elapsedMs: Date.now() - t0 },
        coconjennie: cj,
        chouchouenfant: ce,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-shop-catalog.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2).slice(0, 6000));
      expect(requests).toBeGreaterThan(0);
    },
    90 * 60 * 1000,
  );
});
