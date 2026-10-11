/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage WU — Phase 5: 브랜드 교집합 (품번보다 «먼저» 볼 것이었다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. robots 를 경로마다 다시 본다.
 *
 * ── 🔴 순서를 틀렸다 (CTO 자체 정정) ──────────────────────────────────────
 *   Phase 2~4 는 「그 샵이 해외 품번을 적는가」를 먼저 쟀다. 그런데 그 질문은
 *   **「그 샵이 우리 브랜드를 파는가」가 참일 때만** 의미가 있다.
 *   실제로 coconjennie 에서 품번 0건이 나왔는데, 원인은 품번 표기가 아니라
 *   **내가 상품 상세에 닿지 못한 것** 이었다(sixshop 상세 URL 규약 미관찰).
 *   🟢 그래서 더 싼 질문을 먼저 답한다 — **브랜드 교집합**.
 *
 * ── 측정 ──────────────────────────────────────────────────────────────────
 *   ① coconjennie `/brand` 에서 브랜드명을 «관찰» 한다(목록을 지어내지 않는다)
 *   ② 우리 497 상품의 `canonicalProduct.brand` 분포와 교집합을 낸다
 *   ③ 교집합이 0 이면 그 샵은 품번을 어떻게 적든 SAME yield 가 0 이다
 *
 * 🔴 「브랜드명이 페이지에 있다」는 「그 브랜드를 판다」의 약한 증거다. 그 한계를
 *    결과에 같이 적는다 — 메뉴/푸터/안내문에 있을 수 있다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 우리 쪽 브랜드는 DB 덤프에서 읽는다. 손으로 적지 않는다. */
interface SnapRow { title: string; cp: { brand?: { value?: string } } }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

describe.skipIf(!LIVE)("🔴 DOM-VALUE-05 — 국내 편집샵 × 우리 브랜드 교집합", () => {
  it(
    "브랜드 교집합을 먼저 재서 「품번을 어떻게 적든 무관」한 샵을 가른다",
    async () => {
      /* ── 우리 브랜드 모집단 (DB 덤프) ── */
      const ours = new Map<string, number>();
      for (const f of ["cov-nolink.json", "cov-withlink.json"]) {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) continue;
        for (const r of JSON.parse(readFileSync(p, "utf8")) as SnapRow[]) {
          const b = (r.cp?.brand?.value ?? "").trim();
          if (b) ours.set(b, (ours.get(b) ?? 0) + 1);
        }
      }
      const ourBrands = [...ours.entries()].sort((a, b) => b[1] - a[1]);

      let requests = 0; const t0 = Date.now();
      const safeGet = async (u: string) => {
        const rb = await checkRobots(u); requests++;
        if (rb.state !== "NOT_DISALLOWED") return null;
        const r = await fetchHtmlDirect(u); requests++;
        return r?.html ?? null;
      };

      /* ── 조사 대상: robots 통과한 RETAILER + 각 샵의 브랜드 목록 경로(관찰된 것만) ── */
      const TARGETS = [
        { domain: "coconjennie.com", paths: ["/brand", "/shop"] },
        { domain: "chouchouenfant.kr", paths: ["/"] },
        { domain: "nokimore.com", paths: ["/"] },
        { domain: "karymarket.com", paths: ["/"] },
      ];

      const rows: Record<string, unknown>[] = [];
      for (const t of TARGETS) {
        let merged = "";
        const fetched: string[] = [];
        for (const p of t.paths) {
          const h = await safeGet(`https://${t.domain}${p}`);
          if (h) { merged += " " + h; fetched.push(p); }
        }
        if (!merged) { rows.push({ domain: t.domain, ok: false, detail: "받지 못했다" }); continue; }
        const up = merged.toUpperCase();
        const upNorm = norm(merged);
        /**
         * 🔴 우리 브랜드가 그 샵 페이지에 «언급» 되는가. 영문/한글 둘 다 본다.
         *    한글 표기는 우리 DB 에 없으므로 영문만 정확히 비교하고, 한글은
         *    별도 수동 목록 없이 «판단하지 않는다**(지어내지 않는다).
         */
        const matched = ourBrands.filter(([b]) => {
          const n = norm(b);
          return n.length >= 4 && (upNorm.includes(n) || up.includes(b.toUpperCase()));
        });
        /** 🔴 그 샵이 내세우는 브랜드명 후보 — 관찰만 한다(정확한 목록이 아니다). */
        const shopBrandish = [...new Set([...merged.matchAll(/>([A-Z][A-Za-z&'. -]{3,28})</g)].map((m) => m[1].trim()))]
          .filter((s) => /^[A-Z]/.test(s) && !/^(?:The|And|All|New|More|Shop|Brand|Home|Login|Cart|Search)$/i.test(s))
          .slice(0, 40);
        rows.push({
          domain: t.domain, ok: true, pathsFetched: fetched, bytes: merged.length,
          ourBrandsMatched: matched.map(([b, n]) => `${b}(상품 ${n}개)`),
          ourBrandsMatchedCount: matched.length,
          ourProductsCovered: matched.reduce((s, [, n]) => s + n, 0),
          shopBrandishTokens: shopBrandish,
          caveat: "🔴 「페이지에 브랜드명이 있다」는 「그 브랜드를 판다」의 약한 증거다(메뉴/푸터 가능).",
        });
        // eslint-disable-next-line no-console
        console.log(`${t.domain.padEnd(22)} ourBrandsMatched=${matched.length} ourProductsCovered=${matched.reduce((s, [, n]) => s + n, 0)}`);
      }

      const report = {
        scope: {
          note: `🔴 sample N=${TARGETS.length} 샵. 우리 브랜드 모집단은 DB 덤프 ${ours.size}종 / 상품 ${[...ours.values()].reduce((a, b) => a + b, 0)}개(링크유무 합).`,
          "🔴 순서 정정": "품번 표기보다 «브랜드 교집합» 이 먼저다 — 교집합 0 이면 품번은 무관하다",
          "🔴 하지 않은 것": "경로 추측 · robots 우회 · 한글 브랜드 매핑 추측 · 어댑터 작성",
        },
        cost: { requests, elapsedMs: Date.now() - t0 },
        ourTopBrands: ourBrands.slice(0, 15).map(([b, n]) => `${b}(${n})`),
        shops: rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-brand-overlap.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2).slice(0, 5000));
      expect(rows.length).toBe(TARGETS.length);
    },
    90 * 60 * 1000,
  );
});
