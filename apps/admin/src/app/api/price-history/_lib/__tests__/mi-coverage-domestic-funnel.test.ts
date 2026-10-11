/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Coverage Work Unit — Phase C: 운영 국내 Discovery 퍼널 실측 (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 HTTP 를 쓴다.
 * 🔴 **DB 를 쓰지 않는다** — 선행 읽기 전용 스크립트가 덤프한 JSON 만 읽는다.
 *
 * ── 전략 질문 ──────────────────────────────────────────────────────────────
 *   상품 1개가 들어왔을 때 **운영** Discovery 가 국내에서 비교 가능한 후보를
 *   얼마나 회수하고, 놓치는 이유는 무엇인가. KPI 는 후보 수가 아니라
 *   **Product 당 SAME yield / 비용** 이다.
 *
 * ── 🔴 운영 경로를 그대로 쓴다 (측정 규칙 ③) ───────────────────────────────
 *   backfillCanonicalProduct → buildProductIdentityDna → resolveMarketCategoryScopes
 *     → isBatchSurveyTarget 로 샵 필터 → searchDomesticShops(query, refs)
 *     → withConfidence(query, candidates)        ← 판정 owner. 하니스가 만들지 않는다
 *   query 는 `run-domestic-price-check.ts:710-718` 이 만드는 모양 그대로다
 *   (title · brand · sourceUrl · sku · searchTerm · searchTerms · facts).
 *
 * ── 🔴 하니스 검증 게이트 — 대조군 ─────────────────────────────────────────
 *   표본에 **운영이 이미 링크를 만든 상품** 을 섞는다. 하니스가 그 상품에서
 *   후보를 0건 회수하면 **측정이 무효** 다(내 호출이 운영과 다른 것이다).
 *   → 「링크 없는 상품에서 0건」을 「국내에 상품이 없다」로 읽지 않기 위한 대조군이다.
 *
 * ── 🔴 선행 실측 (FULL POPULATION 497, 읽기 전용 SELECT) ───────────────────
 *   링크 있음 69 (14%) · 링크 없음 428 (86%)
 *   운영 유효 판매처 19개 중 **AUTO_SCRAPE 7개** 만 자동 후보를 만들 수 있다
 *     chocoel · deuxbebe · foretforet · littleluna · looxloo · rulii · skysport
 *   MANUAL 12 · NOT_AVAILABLE 13(포털/오픈마켓) 은 자동 후보 경로가 없다
 *   실제로 링크가 생긴 호스트는 foretforet · deuxbebe · littleluna · bobochoses(현재 disabled)
 *   🔴 그래서 이 파일이 재는 것: **chocoel · looxloo · rulii · skysport 가 진짜 0건인가.**
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct, buildCrossSellerSearchQueries, buildDomesticShopQuery,
  buildProductIdentityDna, productFactsFromIdentityDna,
} from "@commerce/shared";
import { searchDomesticShops, withConfidence } from "@commerce/crawler";
// 🔴 운영 판정의 «마지막» 단계. MI-P0-02c 가 DB 없이 부를 수 있게 꺼내 뒀다.
//    withConfidence 만으로는 운영을 재현하지 못한다 — 대조군 게이트가 그것을 잡았다.
import { isBatchSurveyTarget, judgeDomesticCandidate } from "../run-domestic-price-check";
import { fetchDomesticModelCode } from "@commerce/crawler";
import { resolveMarketCategoryScopes } from "../../../domestic-price-sources/_lib/category-scope";
import type { CanonicalProduct } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 비용 상한. 넘겨서 «버린» 건수는 리포트에 적는다(조용한 truncate 금지). */
const MAX_NOLINK = Number(process.env.COV_MAX_NOLINK ?? 12);
const MAX_CONTROL = Number(process.env.COV_MAX_CONTROL ?? 3);

interface SrcRow {
  id: string; name: string; domain: string; currency: string | null;
  collection_strategy: string | null; enabled: boolean; status: string;
  access_status: string | null; category_scope: string[] | null;
}
interface SnapRow { id: string; title: string; workspace_id: string; cp: CanonicalProduct; links?: number }

describe.skipIf(!LIVE)("🔴 MI Coverage — 운영 국내 Discovery 퍼널", () => {
  it(
    "운영 함수 사슬로 검색 → 후보 → Identity → SAME 까지 Product 단위로 센다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const sources = read<SrcRow[]>("cov-sources.json");
      const shopSettings = read<{ workspace_id: string; source_id: string; enabled: boolean }[]>("cov-shopsettings.json");
      const noLink = read<SnapRow[]>("cov-nolink.json");
      const withLink = read<SnapRow[]>("cov-withlink.json");

      /** 🔴 브랜드 층화 — 한 브랜드가 표본을 지배하면 편차를 못 본다. */
      const stratify = (rows: SnapRow[], cap: number): SnapRow[] => {
        const seen = new Set<string>();
        const out: SnapRow[] = [];
        for (const r of rows) {
          const b = (r.cp?.brand?.value ?? "(none)").toLowerCase();
          if (seen.has(b)) continue;
          seen.add(b);
          out.push(r);
          if (out.length >= cap) break;
        }
        return out;
      };
      const sampleNoLink = stratify(noLink, MAX_NOLINK);
      const sampleControl = stratify(withLink, MAX_CONTROL);
      const targets = [
        ...sampleControl.map((r) => ({ row: r, arm: "CONTROL(운영이 이미 링크를 만든 상품)" as const })),
        ...sampleNoLink.map((r) => ({ row: r, arm: "NO_LINK(운영에 링크가 없는 상품)" as const })),
      ];

      /** 운영 샵 집합 — 셀러가 끈 샵을 제외한다(운영과 같은 집합이어야 한다). */
      const offFor = (ws: string) =>
        new Set(shopSettings.filter((s) => s.workspace_id === ws && !s.enabled).map((s) => s.source_id));

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      const perSource: Record<string, { searched: number; candidates: number; judged: number; same: number; likely: number; errors: number; linked: number }> = {};

      for (const t of targets) {
        const product = backfillCanonicalProduct(t.row.cp);
        const dna = buildProductIdentityDna(product);
        const scopes = resolveMarketCategoryScopes(product, null);
        const off = offFor(t.row.workspace_id);
        const eligible = sources.filter(
          (s) =>
            !off.has(s.id) &&
            isBatchSurveyTarget(
              { enabled: s.enabled, status: s.status as never, accessStatus: s.access_status as never,
                categoryScope: s.category_scope ?? [] } as never,
              scopes,
            ),
        );
        /** 🔴 자동 후보를 만들 수 있는 것만 실제로 검색한다 — MANUAL 은 경로가 없다. */
        const auto = eligible.filter((s) => s.collection_strategy === "AUTO_SCRAPE");
        const refs = auto.map((s) => ({
          id: s.id, name: s.name, domain: s.domain,
          currency: s.currency ?? "KRW", collectionStrategy: s.collection_strategy ?? undefined,
        }));

        // 🔴 운영이 만드는 query 모양 그대로
        const searchTerms = buildCrossSellerSearchQueries(dna);
        const query = {
          title: dna.title ?? t.row.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: product.sku?.value || undefined,
          searchTerm: buildDomesticShopQuery(dna),
          searchTerms,
          facts: productFactsFromIdentityDna(dna),
        } as Parameters<typeof searchDomesticShops>[0];

        const t0 = Date.now();
        const results = await searchDomesticShops(query, refs as never);
        const elapsed = Date.now() - t0;

        let cand = 0, judged = 0, same = 0, likely = 0, errs = 0;
        let fetchCalls = 0;
        const bySource: Row[] = [];
        /** 🔴 운영 게이트별 탈락 — 「후보 없음」과 섞지 않는다. */
        const gateTally: Record<string, number> = {};
        const tierTally: Record<string, number> = {};
        for (const r of results) {
          const ps = (perSource[r.domain] ??= { searched: 0, candidates: 0, judged: 0, same: 0, likely: 0, errors: 0, linked: 0 });
          ps.searched++;
          if (r.status !== "ok") { ps.errors++; errs++; bySource.push({ domain: r.domain, status: r.status, candidates: 0 }); continue; }
          cand += r.candidates.length;
          ps.candidates += r.candidates.length;
          // ① 운영 판정 owner
          const scored = r.candidates.length > 0 ? withConfidence(query, r.candidates) : [];
          let s2 = 0, l2 = 0;
          for (const c of scored) {
            if (!c.crossSellerVerdict) continue;
            judged++; ps.judged++;
            if (c.crossSellerVerdict === "SAME") { s2++; ps.same++; }
            else if (c.crossSellerVerdict === "PRESUMED_SAME") { l2++; ps.likely++; }
          }
          same += s2; likely += l2;
          /**
           * ② 🔴 운영의 «마지막» 단계 — 이것 없이는 링크가 생기는지 알 수 없다.
           *    `fetchDomesticModelCode` 를 주입해 국내 품번 추출까지 운영과 같게 만든다
           *    (대조군 PèPè 는 foretforet 추출기가 필요하다 — 제목만으로는 안 된다).
           */
          const j = scored.length > 0
            ? await judgeDomesticCandidate({
                domain: r.domain, candidates: scored, sourceUrl: dna.sourceUrl,
                foreignModelCode: dna.brandModelCode ?? null, foreignColor: dna.color ?? null,
                fetchModelCode: async (u: string) => { fetchCalls++; return fetchDomesticModelCode(r.domain, u); },
              })
            : { kind: "NO_CANDIDATES" as const, selfReferenceExcluded: 0 };
          const gateKey =
            j.kind === "NO_CANDIDATES" ? "NO_CANDIDATES"
            : j.kind === "DROPPED" ? `DROPPED(${j.gate})`
            : "JUDGED";
          gateTally[gateKey] = (gateTally[gateKey] ?? 0) + 1;
          let tier: string | null = null;
          if (j.kind === "JUDGED") {
            const jj = j as unknown as { matchTruth: string; verified: boolean; matchType: string };
            tier =
              jj.matchTruth === "EXACT_IDENTIFIER" || jj.matchTruth === "STRONG_IDENTIFIER" ? "EXACT"
              : jj.matchTruth === "TEXT_CONFIRMED" ? "COMPARISON"
              : jj.matchTruth === "SIMILAR" ? "REFERENCE"
              : jj.matchTruth === "CONFLICT" || jj.matchTruth === "INSUFFICIENT_EVIDENCE" ? "EXCLUDED"
              : jj.verified ? "EXACT" : "COMPARISON";
            tierTally[tier] = (tierTally[tier] ?? 0) + 1;
            ps.linked++;
          }
          bySource.push({ domain: r.domain, status: r.status, candidates: r.candidates.length,
                          judged: scored.filter((c) => c.crossSellerVerdict).length, same: s2, likely: l2,
                          gate: gateKey, tier,
                          matchTruth: j.kind === "JUDGED" ? (j as unknown as { matchTruth: string }).matchTruth : null,
                          topTitles: r.candidates.slice(0, 2).map((c) => c.title) });
        }

        rows.push({
          arm: t.arm, title: t.row.title.slice(0, 70),
          brand: t.row.cp?.brand?.value ?? null,
          brandModelCode: dna.brandModelCode ?? null, sku: product.sku?.value || null,
          color: dna.color ?? null, existingLinks: t.row.links ?? 0,
          categoryScopes: scopes, eligibleShops: eligible.length, autoScrapeShops: auto.length,
          queryCount: searchTerms.length, searchTerms: searchTerms.slice(0, 4),
          rawCandidates: cand, identityJudged: judged, SAME: same, SAME_LIKELY: likely,
          sourceErrors: errs, elapsedMs: elapsed,
          /** 🔴 운영이 링크를 만들었을 샵 수 + 게이트 탈락 분포 */
          gateTally, tierTally, wouldLink: Object.values(tierTally).reduce((a, b) => a + b, 0),
          modelCodeFetchCalls: fetchCalls, bySource,
        });
        // eslint-disable-next-line no-console
        console.log(`${t.arm.slice(0, 8)} ${String(t.row.cp?.brand?.value ?? "-").slice(0, 18).padEnd(19)} shops=${auto.length} q=${searchTerms.length} cand=${String(cand).padStart(3)} judged=${String(judged).padStart(3)} SAME=${same} LIKELY=${likely} ${elapsed}ms`);
      }

      const sum = (xs: Row[], k: string) => xs.reduce((s, x) => s + (Number(x[k]) || 0), 0);
      const funnelFor = (arm: string) => {
        const xs = rows.filter((r) => r.arm === arm);
        return {
          products: xs.length,
          productsWithAnyCandidate: xs.filter((x) => Number(x.rawCandidates) > 0).length,
          productsWithAnySame: xs.filter((x) => Number(x.SAME) > 0).length,
          productsWithSameOrLikely: xs.filter((x) => Number(x.SAME) + Number(x.SAME_LIKELY) > 0).length,
          /** 🟢 운영이 실제로 «링크를 만들었을» 상품 수 — 이것이 Coverage 의 결과다 */
          productsThatWouldGetALink: xs.filter((x) => Number(x.wouldLink) > 0).length,
          totalLinksWouldCreate: sum(xs, "wouldLink"),
          modelCodeFetchCalls: sum(xs, "modelCodeFetchCalls"),
          rawCandidates: sum(xs, "rawCandidates"), identityJudged: sum(xs, "identityJudged"),
          SAME: sum(xs, "SAME"), SAME_LIKELY: sum(xs, "SAME_LIKELY"),
          samePerProduct: xs.length ? +(sum(xs, "SAME") / xs.length).toFixed(2) : null,
          totalElapsedMs: sum(xs, "elapsedMs"),
        };
      };

      const report = {
        scope: {
          "🔴 모집단": "FULL POPULATION 497 — 링크 있음 69(14%) · 없음 428(86%) (선행 읽기 전용 SELECT)",
          "🔴 이 퍼널은 표본이다": `sample N=${sampleNoLink.length} (NO_LINK, 브랜드 층화) + sample N=${sampleControl.length} (CONTROL)`,
          droppedByCap: { noLinkPoolAvailable: noLink.length, controlPoolAvailable: withLink.length,
                          capNoLink: MAX_NOLINK, capControl: MAX_CONTROL },
          autoScrapeOnly: "🔴 MANUAL / NOT_AVAILABLE 샵은 자동 후보 경로가 «없어» 검색하지 않았다",
        },
        /** 🔴 이 arm 이 0 이면 아래 숫자 전부 무효다. */
        harnessGate_control: funnelFor("CONTROL(운영이 이미 링크를 만든 상품)"),
        funnel_noLink: funnelFor("NO_LINK(운영에 링크가 없는 상품)"),
        perSource: Object.fromEntries(Object.entries(perSource).sort((a, b) => b[1].candidates - a[1].candidates)),
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "cov-funnel.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBe(targets.length);
    },
    180 * 60 * 1000,
  );
});
