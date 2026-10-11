/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage WU — Phase 7(최종): looxloo · rulii 가 왜 링크 0 인가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. robots 를 매 경로마다 본다.
 *
 * ── 🔴🔴 Phase 6 이 결론을 뒤집었다 ───────────────────────────────────────
 *   브랜드 교집합(홈 기준, 우리 상품 커버 수):
 *     looxloo 94 · foretforet 59 · rulii 46 · deuxbebe 19 · littleluna 14 ·
 *     chocoel 2 · skysport 0
 *   🔴 **커버가 가장 큰 `looxloo`(94)와 3위 `rulii`(46)가 운영 링크 0 건이다.**
 *   🟢 그 둘은 **이미 어댑터가 있고**(looxloo.ts · rulii.ts) **Cafe24** 다.
 *   → 그러면 레버는 「샵 추가」가 아니라 **이미 있는 샵의 검색/추출** 이다.
 *
 * ── 이 파일이 가르는 것 ───────────────────────────────────────────────────
 *   ① 그 샵이 실제로 그 브랜드 «상품» 을 파는가(홈 언급 false positive 배제)
 *   ② 상품 페이지에 해외 품번이 있는가
 *   ③ 없다면 품번 없이 SAME 을 판정할 증거(브랜드·상품명·색상·소재)가 있는가
 *   🔴 「검색 0건」과 「미취급」과 「접근 실패」를 합치지 않는다.
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
];
const vis = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").toUpperCase();
const shapesIn = (h: string) => {
  const t = vis(h); const o: Record<string, string[]> = {};
  for (const s of SHAPES) { const x = [...new Set([...t.matchAll(s.re)].map((m) => m[0]))]; if (x.length) o[s.name] = x; }
  return o;
};
const title = (h: string) => (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] ?? "").trim().slice(0, 95);

/** 🔴 교집합이 실제로 큰 브랜드만 본다 — 지어내지 않고 Phase 6 결과에서 가져왔다. */
const TARGETS = [
  { domain: "looxloo.com", brands: [{ q: "보보쇼즈", en: "Bobo Choses", ours: 84 }, { q: "타오", en: "The Animals Observatory", ours: 10 }] },
  { domain: "rulii.co.kr", brands: [{ q: "루이스미샤", en: "Louise Misha", ours: 10 }, { q: "미니로디니", en: "Mini Rodini", ours: 6 }] },
];

describe.skipIf(!LIVE)("🔴 DOM-VALUE-07 — looxloo · rulii 의 실제 취급과 품번", () => {
  it(
    "홈 언급이 아니라 «상품 페이지» 기준으로 취급과 품번을 가른다",
    async () => {
      let requests = 0; const t0 = Date.now();
      const safeGet = async (u: string) => {
        const rb = await checkRobots(u); requests++;
        if (rb.state !== "NOT_DISALLOWED") return { blocked: rb.state as string, html: null as string | null };
        const r = await fetchHtmlDirect(u); requests++;
        return { blocked: null, html: r?.html ?? null };
      };

      const rows: Record<string, unknown>[] = [];
      for (const t of TARGETS) {
        for (const b of t.brands) {
          const su = `https://${t.domain}/product/search.html?keyword=${encodeURIComponent(b.q)}`;
          const s = await safeGet(su);
          if (!s.html) { rows.push({ domain: t.domain, brand: b.en, step: "SEARCH", ok: false, blocked: s.blocked }); continue; }
          /** 🔴 Cafe24 상품 URL 은 `/product/{이름}/{번호}/` 다. 기능 페이지를 뺀다. */
          const links = [...new Set([...s.html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))]
            .filter((h) => /\/product\/[^/"?]+\/\d+\//.test(h))
            .filter((h) => !/search\.html|list\.html/.test(h))
            .slice(0, 3);
          const pages: Record<string, unknown>[] = [];
          for (const h of links) {
            const u = h.startsWith("http") ? h : `https://${t.domain}${h.startsWith("/") ? "" : "/"}${h}`;
            const p = await safeGet(u);
            if (!p.html) { pages.push({ url: u, ok: false, blocked: p.blocked }); continue; }
            const txt = vis(p.html);
            pages.push({
              url: u, ok: true, title: title(p.html),
              /** 🔴 상품 페이지에 그 브랜드가 있는가 — 홈 언급과 다른 축 */
              brandOnProductPage: txt.includes(b.en.toUpperCase()) || txt.includes(b.q.toUpperCase()),
              codeShapes: shapesIn(p.html),
              hasCodeShape: Object.keys(shapesIn(p.html)).length > 0,
              /** 🔴 품번이 없을 때 SAME 을 판정할 다른 증거가 있는가 (§8/§10) */
              otherEvidence: {
                hasPrice: /[\d,]{4,}\s*원/.test(txt),
                hasColorWord: /(색상|컬러|COLOR)/i.test(txt),
                hasMaterialWord: /(소재|혼용률|COTTON|울|MATERIAL)/i.test(txt),
                hasSizeOptions: /<option/i.test(p.html),
                hasLdJson: /application\/ld\+json/i.test(p.html),
              },
            });
          }
          rows.push({
            domain: t.domain, brand: b.en, ourProducts: b.ours, step: "SEARCH", ok: true,
            searchUrl: su, bytes: s.html.length,
            productLinksFound: links.length,
            /** 🔴 검색 페이지에 브랜드가 있는가(에코 가능) vs 상품 링크가 나왔는가 */
            brandOnSearchPage: vis(s.html).includes(b.en.toUpperCase()) || vis(s.html).includes(b.q.toUpperCase()),
            productPages: pages,
            productPagesWithBrand: pages.filter((p) => p.brandOnProductPage).length,
            productPagesWithCode: pages.filter((p) => p.hasCodeShape).length,
            /** 🔴 세 가지를 갈라 적는다 */
            interpretation:
              links.length === 0 ? "🔴 검색에서 상품 링크 0건 — 「미취급」과 「검색이 안 먹음」을 가르지 못했다"
              : pages.filter((p) => p.brandOnProductPage).length === 0 ? "🔴 상품은 나왔지만 그 브랜드가 아니다 — 검색 품질 문제"
              : pages.filter((p) => p.hasCodeShape).length === 0 ? "🟡 브랜드 상품은 판다. 단 해외 품번 표기가 없다"
              : "🟢 브랜드 상품 + 해외 품번 모양 관찰",
          });
          // eslint-disable-next-line no-console
          console.log(`${t.domain.padEnd(14)} ${b.en.slice(0, 22).padEnd(23)} links=${links.length} brandOnProd=${pages.filter((p) => p.brandOnProductPage).length} code=${pages.filter((p) => p.hasCodeShape).length}`);
        }
      }

      const report = {
        scope: {
          note: "🔴 sample — 2샵 × 2브랜드 × 상품 최대 3건. 전수가 아니다.",
          why: "Phase 6: 커버 최대 looxloo(94)·rulii(46)가 운영 링크 0 건이다. 둘은 이미 어댑터가 있고 Cafe24 다.",
          "🔴 갈라 적음": "검색 0건 ≠ 미취급 ≠ 접근 실패 ≠ 품번 없음",
        },
        cost: { requests, elapsedMs: Date.now() - t0 },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-looxloo-rulii.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2).slice(0, 5500));
      expect(rows.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
