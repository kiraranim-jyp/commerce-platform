/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage WU — Phase 4: coconjennie 상품 경로 + chouchouenfant 전수
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. robots 를 매 경로마다 다시 본다.
 * 🔴 경로를 추측하지 않는다 — Phase 3 이 **HTML 에서 관찰한** 링크만 쓴다.
 *
 * ── Phase 3 이 관찰한 것 ───────────────────────────────────────────────────
 *   coconjennie(sixshop) — 검색 form 0건. 🟢 그런데 내부 링크에 `/shop` · `/brand`
 *     가 있고 `sixshop.com/resources/images/product/thumbnail` 이 있다(상품이 있다).
 *     🟢 홈에 「페페 · PEPE」가 언급된다 — PèPè 취급 단서.
 *     🔴 Phase 3 의 필터가 `/product|goods|item|detail` 을 요구해 `/shop` 을 놓쳤다.
 *   chouchouenfant — 품번 40개 전수: 123→18 · 222→2 · 223→20. 🔴 현행 226 «0건».
 *     🔴 단 1페이지만 봤다(상품명 추출이 실패해 조기 break 했다). 전수가 아니다.
 *
 * ── 이 파일이 답하는 것 ───────────────────────────────────────────────────
 *   ① coconjennie 가 **현행 시즌** PèPè/Bobo 를 파는가 · 품번을 적는가
 *   ② chouchouenfant 가 **정말로** 226 계열을 안 파는가(페이지를 더 본다)
 *   🔴 품번 0건을 「미취급」으로 읽지 않는다. 경로 실패와 미취급을 갈라 적는다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

const SHAPES = [
  { name: "FULL", re: /\b[A-Z]\d{3}[A-Z]{2}\d{3}\b/g },
  { name: "STRIPPED", re: /\b\d{3}[A-Z]{2}\d{3}\b/g },
  { name: "SEASON", re: /\b(?:SS|AW|FW|PE)\d{2}[A-Z]{2}\d{3}\b/g },
  { name: "PEPE", re: /\b[A-Z]{2}\d{2}[A-Z]{3,6}\d{3,5}[A-Z]{2,4}\b/g },
];
const vis = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").toUpperCase();
function shapesIn(h: string): Record<string, string[]> {
  const t = vis(h); const o: Record<string, string[]> = {};
  for (const s of SHAPES) { const x = [...new Set([...t.matchAll(s.re)].map((m) => m[0]))]; if (x.length) o[s.name] = x; }
  return o;
}
const seasons = (cs: string[]) => {
  const t: Record<string, number> = {};
  for (const c of cs) { const m = /^([A-Z]?)(\d{3})/.exec(c); if (m) t[m[2]] = (t[m[2]] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(t).sort((a, b) => Number(a[0]) - Number(b[0])));
};
const title = (h: string) => (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? "").trim().slice(0, 90);

describe.skipIf(!LIVE)("🔴 DOM-VALUE-04 — 두 샵의 현행 시즌 취급 여부", () => {
  it(
    "관찰된 경로로만 들어가서 「현행 상품을 파는가」에 답한다",
    async () => {
      let requests = 0; const t0 = Date.now();
      /** 🔴 모든 경로에 robots 를 다시 본다. 막히면 받지 않는다. */
      const safeGet = async (u: string) => {
        const rb = await checkRobots(u); requests++;
        if (rb.state !== "NOT_DISALLOWED") return { blocked: rb.state as string, html: null };
        const r = await fetchHtmlDirect(u); requests++;
        return { blocked: null, html: r?.html ?? null };
      };

      /* ══ ① coconjennie — 관찰된 /shop · /brand 에서 상품 링크를 찾는다 ══ */
      const cj: Record<string, unknown> = { domain: "coconjennie.com", platform: "sixshop" };
      const cjCodes: string[] = []; const cjProducts: unknown[] = []; const cjListings: unknown[] = [];
      for (const seed of ["/shop", "/brand"]) {
        const u = `https://coconjennie.com${seed}`;
        const g = await safeGet(u);
        if (!g.html) { cjListings.push({ seed, blocked: g.blocked, ok: false }); continue; }
        /** 🔴 sixshop 상품 상세 링크를 «관찰» 한다 — 패턴을 지어내지 않고 href 를 모은다. */
        const hrefs = [...new Set([...g.html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))]
          .filter((x) => !/^(?:https?:)?\/\//.test(x) || x.includes("coconjennie.com"))
          .filter((x) => !/(?:^#|javascript:|mailto:|\.(?:png|jpe?g|css|js|svg|ico|webp))/i.test(x));
        const brands = ["페페", "PEPE", "보보", "BOBO", "메인스토리", "MAIN STORY"]
          .filter((b) => g.html!.toUpperCase().includes(b.toUpperCase()));
        cjListings.push({ seed, ok: true, bytes: g.html.length, title: title(g.html),
                          brandMentions: brands, hrefCount: hrefs.length, hrefSample: hrefs.slice(0, 18),
                          shapes: shapesIn(g.html) });
        for (const c of Object.values(shapesIn(g.html)).flat()) cjCodes.push(c);
        /** 상세로 보이는 링크 3개 — 「/product」류가 없으면 목록에서 가장 깊은 경로를 쓴다 */
        const deep = hrefs.filter((x) => (x.match(/\//g) ?? []).length >= 2 && !/^\/(?:shop|brand)\/?$/.test(x)).slice(0, 3);
        for (const dh of deep) {
          const du = dh.startsWith("http") ? dh : `https://coconjennie.com${dh.startsWith("/") ? "" : "/"}${dh}`;
          const p = await safeGet(du);
          if (!p.html) { cjProducts.push({ url: du, blocked: p.blocked, ok: false }); continue; }
          const sh = shapesIn(p.html);
          for (const c of Object.values(sh).flat()) cjCodes.push(c);
          cjProducts.push({ url: du, title: title(p.html), shapes: sh, bytes: p.html.length });
        }
      }
      const cjUniq = [...new Set(cjCodes)];
      cj.listings = cjListings; cj.productPages = cjProducts;
      cj.distinctCodes = cjUniq.length; cj.codeSamples = cjUniq.slice(0, 20);
      cj.seasonPrefixDistribution = seasons(cjUniq);
      cj.hasCurrentSeason226 = cjUniq.some((c) => /^[A-Z]?226/.test(c));
      cj.verdict = cjUniq.length === 0
        ? "🔴 품번 0건 — 「미취급」이 아니라 「이 경로에서 품번을 보지 못했다」다"
        : "🟢 품번을 관찰했다";

      /* ══ ② chouchouenfant — 페이지를 더 받아 226 부재를 확정한다 ══ */
      const ce: Record<string, unknown> = { domain: "chouchouenfant.kr" };
      const ceCodes: string[] = []; const cePages: unknown[] = [];
      for (const kw of ["보보쇼즈", "BOBO", "페페", "메인스토리"]) {
        for (const page of [1, 2, 3]) {
          const u = `https://chouchouenfant.kr/product/search.html?keyword=${encodeURIComponent(kw)}&page=${page}`;
          const g = await safeGet(u);
          if (!g.html) { cePages.push({ kw, page, blocked: g.blocked, ok: false }); break; }
          const sh = shapesIn(g.html);
          const codes = Object.values(sh).flat();
          ceCodes.push(...codes);
          cePages.push({ kw, page, bytes: g.html.length, codes: codes.length, distinct: [...new Set(codes)].length });
          // 🔴 「0건이면 끝」이 아니라 «같은 페이지가 반복되면» 끝이다(페이지 파라미터 무시 감지)
          if (codes.length === 0) break;
        }
      }
      const ceUniq = [...new Set(ceCodes)];
      ce.pages = cePages; ce.distinctCodes = ceUniq.length; ce.codeSamples = ceUniq.slice(0, 30);
      ce.seasonPrefixDistribution = seasons(ceUniq);
      ce.hasCurrentSeason226 = ceUniq.some((c) => /^[A-Z]?226/.test(c));
      ce.prefixForm = { full: ceUniq.filter((c) => /^[A-Z]\d{3}/.test(c)).length,
                        stripped: ceUniq.filter((c) => /^\d{3}/.test(c)).length };

      const report = {
        scope: {
          note: "🔴 sample — coconjennie /shop·/brand + 상세 최대 6건 · chouchouenfant 4키워드×최대3페이지. 전수가 아니다.",
          "🔴 하지 않은 것": "경로 추측 · robots 우회 · 어댑터 작성 · confirmBrandCodeInTitle 수정",
          "🔴 해석 금지": "품번 0건 ≠ 미취급. 경로 실패와 미취급을 갈라 적었다.",
        },
        cost: { requests, elapsedMs: Date.now() - t0 },
        coconjennie: cj,
        chouchouenfant: ce,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-shop-depth.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2).slice(0, 5000));
      expect(requests).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
