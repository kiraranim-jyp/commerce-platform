/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage WU — Phase 6(최종): coconjennie 상세 + AUTO 7 전수
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다.
 * 🔴 경로를 추측하지 않는다 — HTML 에서 «관찰한» href 만 쓴다. robots 를 매번 본다.
 * 🔴 「접근 실패」와 「미취급」과 「품번 없음」을 합치지 않는다.
 *
 * ── ① coconjennie(sixshop) 상세 구조 — §4-1/4-2/4-3 ───────────────────────
 *   Phase 4 가 `/shop` · `/brand` 를 받았지만 상세 URL 규약을 «관찰하지 못했다»
 *   (내부 링크가 `/untitled-NN` = 브랜드 랜딩). 그래서 이번에는 **브랜드 랜딩 안에서**
 *   상세 링크를 찾는다. 🟢 `/untitled-31` 은 「2026 Duns Sweden」이라 현행 시즌이다.
 *   🔴 sixshop 상세 URL 을 추측하지 않는다 — 랜딩 HTML 의 href 를 전부 분류한다.
 *
 * ── ② AUTO_SCRAPE 7 전수 재평가 — §7 ─────────────────────────────────────
 *   🔴 기존 link count 를 재사용하지 않는다. 🟢 그리고 Phase 5 가 가르쳐 준 순서를
 *      따른다 — **브랜드 교집합을 «먼저»** 본다. 교집합 0 이면 품번/검색은 무관하다.
 *   대상: chocoel · deuxbebe · foretforet · littleluna · looxloo · rulii · skysport
 *
 * ── Ground Truth 대상 (§8, 중복 접어 distinct 6) ──────────────────────────
 *   coconjennie 교집합 브랜드의 우리 상품 — 🔴 전부 `sku=AAA…`(Smallable 자체번호)로
 *   **해외 model code 가 없다.** 즉 「품번 없는 SAME」 strata 다(§10 이 유지하라고 한 축).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

const vis = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").toUpperCase();
const title = (h: string) => (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? "").trim().slice(0, 90);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

/** 🔴 우리 브랜드는 DB 덤프에서 읽는다. 손으로 적지 않는다. */
function ourBrands(): [string, number][] {
  const m = new Map<string, number>();
  for (const f of ["cov-nolink.json", "cov-withlink.json"]) {
    const p = path.join(OUT_DIR, f);
    if (!existsSync(p)) continue;
    for (const r of JSON.parse(readFileSync(p, "utf8")) as { cp?: { brand?: { value?: string } } }[]) {
      const b = (r.cp?.brand?.value ?? "").trim();
      if (b) m.set(b, (m.get(b) ?? 0) + 1);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

describe.skipIf(!LIVE)("🔴 DOM-VALUE-06 — coconjennie 상세 구조 + AUTO 7 브랜드 교집합", () => {
  it(
    "관찰된 경로로만 상세에 닿고, AUTO 7 은 교집합을 먼저 본다",
    async () => {
      let requests = 0; const t0 = Date.now();
      const safeGet = async (u: string) => {
        const rb = await checkRobots(u); requests++;
        if (rb.state !== "NOT_DISALLOWED") return { blocked: rb.state as string, html: null as string | null };
        const r = await fetchHtmlDirect(u); requests++;
        return { blocked: null, html: r?.html ?? null };
      };
      const BR = ourBrands();

      /* ══ ① coconjennie — 브랜드 랜딩 안에서 상세 링크를 «관찰» ══ */
      const cj: Record<string, unknown> = { domain: "coconjennie.com", platform: "sixshop" };
      const seeds = ["/untitled-31", "/shop", "/brand"]; // 🔴 Phase 3/4 가 HTML 에서 관찰한 링크
      const hrefClasses: Record<string, string[]> = {};
      const detailPages: Record<string, unknown>[] = [];
      for (const seed of seeds) {
        const g = await safeGet(`https://coconjennie.com${seed}`);
        if (!g.html) { hrefClasses[seed] = [`🔴 받지 못함 ${g.blocked ?? ""}`]; continue; }
        const hrefs = [...new Set([...g.html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))]
          .filter((x) => !/^(?:https?:)?\/\//.test(x) || x.includes("coconjennie.com"))
          .filter((x) => !/(?:^#|javascript:|mailto:|\.(?:png|jpe?g|css|js|svg|ico|webp))/i.test(x));
        /** 🔴 분류만 한다 — 「상세일 것」이라고 지어내지 않는다. */
        hrefClasses[seed] = hrefs.slice(0, 60);
        /** 🟢 쿼리스트링/숫자 id 를 가진 링크 = sixshop 상세 후보. 관찰된 모양만 쓴다. */
        const cands = hrefs.filter((x) => /[?&](?:idx|no|id|product)=/i.test(x) || /\/\d{4,}/.test(x)).slice(0, 4);
        for (const c of cands) {
          const u = c.startsWith("http") ? c : `https://coconjennie.com${c.startsWith("/") ? "" : "/"}${c}`;
          const p = await safeGet(u);
          if (!p.html) { detailPages.push({ url: u, blocked: p.blocked, ok: false }); continue; }
          const t = vis(p.html);
          detailPages.push({
            url: u, ok: true, title: title(p.html), bytes: p.html.length,
            /** 🔴 우리 브랜드가 «상품 페이지» 에 있는가 — 메뉴 false positive 와 구분된다 */
            ourBrandsOnPage: BR.filter(([b]) => norm(b).length >= 4 && norm(p.html!).includes(norm(b))).map(([b]) => b),
            hasPrice: /[\d,]{4,}\s*원|KRW/i.test(t),
            hasLdJson: /application\/ld\+json/i.test(p.html),
            hasOgTags: /property="og:/i.test(p.html),
          });
        }
      }
      cj.hrefBySeed = hrefClasses;
      cj.detailCandidatesTried = detailPages.length;
      cj.detailPages = detailPages;
      cj.verdict = detailPages.filter((d) => d.ok).length === 0
        ? "🔴 상세 URL 규약을 관찰하지 못했다 — 「품번 없음」이 아니라 «접근 실패» 다"
        : "🟢 상세에 닿았다";

      /* ══ ② AUTO_SCRAPE 7 — 브랜드 교집합을 «먼저» ══ */
      const AUTO = ["chocoel.co.kr", "deuxbebe.com", "foretforet.com", "littleluna.co.kr",
                    "looxloo.com", "rulii.co.kr", "skysport.co.kr"];
      const autoRows: Record<string, unknown>[] = [];
      for (const d of AUTO) {
        const g = await safeGet(`https://${d}/`);
        if (!g.html) { autoRows.push({ domain: d, ok: false, blocked: g.blocked }); continue; }
        const matched = BR.filter(([b]) => norm(b).length >= 4 && norm(g.html!).includes(norm(b)));
        autoRows.push({
          domain: d, ok: true, bytes: g.html.length, title: title(g.html),
          ourBrandsMatched: matched.map(([b, n]) => `${b}(${n})`),
          ourBrandsMatchedCount: matched.length,
          ourProductsCovered: matched.reduce((s, [, n]) => s + n, 0),
          caveat: "🔴 홈페이지 언급이다 — 상품 페이지 기준이 아니다(메뉴/푸터 가능).",
        });
        // eslint-disable-next-line no-console
        console.log(`${d.padEnd(20)} brands=${matched.length} covered=${matched.reduce((s, [, n]) => s + n, 0)}`);
      }

      const report = {
        scope: {
          note: `🔴 sample — coconjennie seed ${seeds.length}개 + 상세 후보 최대 12건 · AUTO 7 홈 1건씩. 전수가 아니다.`,
          "🔴 하지 않은 것": "경로 추측 · robots 우회 · 어댑터 작성 · confirmBrandCodeInTitle 수정",
          "🔴 갈라 적은 것": "접근 실패 ≠ 미취급 ≠ 품번 없음",
          ourBrandPopulation: `DB 덤프 ${BR.length}종 / 상품 ${BR.reduce((s, [, n]) => s + n, 0)}개`,
        },
        cost: { requests, elapsedMs: Date.now() - t0 },
        coconjennie: cj,
        autoScrapeBrandOverlap: autoRows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-final.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, coconjennie: { ...cj, hrefBySeed: "(파일 참조)" } }, null, 2).slice(0, 4500));
      expect(autoRows.length).toBe(AUTO.length);
    },
    120 * 60 * 1000,
  );
});
