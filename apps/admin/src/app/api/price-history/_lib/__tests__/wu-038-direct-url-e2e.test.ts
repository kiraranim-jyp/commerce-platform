import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichCandidatePrices, withConfidence } from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { TRANSIENT_URL_SHOP_ID } from "../transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-038 — **직접 URL 후보 공급 → 동일상품 가격비교 E2E** (실측)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 판정: 후보 공급자를 **② 직접 URL 입력** 으로 정했다. 이 하니스는
 * 「직접 입력이 된다」가 아니라 **「SAME 후보가 어느 지점에서 처음 사라지는가」**
 * 를 단계별로 센다.
 *
 * 🔴 네 가지를 섞지 않는다 (CPO 명시):
 * ```
 * A 후보 공급 — URL 이 시스템에 들어오는가
 * B MI 연결   — 들어왔는데 MI 에서 탈락하는가
 * C 가격 검증 — SAME 인데 가격 증거가 없어 탈락하는가
 * D UI/집계   — 데이터는 있는데 가격비교에 진입하지 못하는가
 * ```
 *
 * 🔴 AI **0** · 외부 검색 API **0** · Registry 0 · threshold 0 · 색상사전 0.
 *    쓰는 것은 **우리가 직접 적은 후보 URL 의 공개 상품 페이지 GET** 뿐이다.
 * 🔴 기본 SKIP — `WU_038_LIVE=1`.
 */

const LIVE = process.env.WU_038_LIVE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const ORIGINS_FILE = path.join(OUT, "wu-038-origins.json");

/**
 * 🔴 **후보 URL 은 지어내지 않았다.**
 *  - `B226AC009` 넷은 **WU-036 Human GT 가 실제로 판정한 URL** 이다
 *    (SAME 3 · DIFFERENT 1 — DIFFERENT 를 일부러 섞어 False SAME 을 같이 잰다).
 *  - `B226AC043` 은 알려진 타 판매처가 **없다**. 그래서 원상품과 **같은 스토어의
 *    다른 시장 경로** 만 넣는다(WU-037 이 다루는 바로 그 관계). 🔴 추측 URL 0.
 */
const CASES: {
  snapshotId: string;
  label: string;
  candidateUrls: string[];
  /** WU-036 Human GT. 없는 것은 `null`(모름) 이고 0 으로 적지 않는다. */
  humanGt: Record<string, "SAME" | "DIFFERENT" | null>;
}[] = [
  {
    snapshotId: "cd93efd9-6c34-42a3-b733-d1178e968113",
    label: "B226AC009 Hug Hairy Monster T-Shirt",
    candidateUrls: [
      "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
      "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
      "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
      "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05",
    ],
    humanGt: {
      "bobochoses.com": "SAME",
      "tinyapple.net": "SAME",
      /** 🔴 host 는 `global.`·`m.` 접두사를 **뗀 뒤** 비교한다 — 키를 원문으로 두면
       *     조회가 조용히 null 이 되고 **CONTROL 이 거짓 통과** 한다(실제로 그랬다). */
      "trenbe.com": "DIFFERENT",
      "luxboy.com": "DIFFERENT",
    },
  },
  {
    snapshotId: "c1b54b9a-f325-415e-b338-eeae08c3c814",
    label: "B226AC043 Mystery BC half zipped sweatshirt",
    candidateUrls: ["https://bobochoses.com/products/b226ac043-mystery-bc-half-zipped-sweatshirt"],
    humanGt: { "bobochoses.com": null },
  },
];

const maybe = LIVE ? it : it.skip;

describe("WU-038 — 직접 URL 공급이 가격비교까지 닿는가", () => {
  maybe(
    "단계별로 세고, SAME 후보가 «처음 사라지는 지점» 을 찾는다",
    async () => {
      expect(existsSync(ORIGINS_FILE), ORIGINS_FILE).toBe(true);
      const origins = JSON.parse(readFileSync(ORIGINS_FILE, "utf8")) as {
        id: string;
        source_url: string;
        title: string;
        canonical_product: unknown;
      }[];

      const report: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const snap = origins.find((o) => o.id === c.snapshotId);
        expect(snap, `스냅샷 ${c.snapshotId}`).toBeTruthy();
        const dna = buildProductIdentityDna(backfillCanonicalProduct(snap!.canonical_product as never));
        const originFacts = productFactsFromIdentityDna(dna);

        /* ── A. 후보 공급 ────────────────────────────────────────────── */
        const pool = await collectUrlCandidatePool({
          urls: c.candidateUrls,
          originUrl: dna.sourceUrl,
          maxUrls: c.candidateUrls.length,
          existingCanonicalUrls: new Set<string>(),
        });
        /** 🔴 pool 은 **host 로 묶인 searchResults** 를 준다 — 후보를 평평하게 편다. */
        const candidates = pool.searchResults.flatMap((r) => r.candidates ?? []);

        /* ── B. MI 연결 — 운영 `withConfidence` 그대로 ─────────────────── */
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          facts: originFacts,
        };
        const scoredRaw = withConfidence(query, candidates as never);

        /* ── C. 가격 검증 ────────────────────────────────────────────────
         * 🔴🔴 **처음엔 이 단계를 빠뜨렸다.** 운영은 transient URL pool 에도
         *    `enrichCandidatePrices` 를 적용한다(run-domestic-price-check.ts:1078,
         *    `isUrlPool` 분기). 그걸 빼고 재면 **보강 «전» 상태를 보고하게 된다** —
         *    이 저장소에서 같은 실수가 반복된 바로 그 함정이다(§5-B). */
        let scored = scoredRaw;
        for (const r of pool.searchResults) {
          try {
            const enriched = await enrichCandidatePrices(
              scoredRaw.filter((s) => (r.candidates ?? []).some((x) => x.url === s.url)),
              r.domain,
              query,
            );
            scored = scored.map((s) => enriched.find((e) => e.url === s.url) ?? s);
          } catch {
            /* fail-soft — 운영과 같다(가격 보강 실패가 전체를 깨지 않는다) */
          }
        }

        const rows = scored.map((s) => {
          const host = (() => {
            try {
              return new URL(s.url).hostname.replace(/^(www|m|global)\./, "");
            } catch {
              return "?";
            }
          })();
          return {
            host,
            verdict: (s.crossSellerVerdict as string | null) ?? null,
            blockers: (s.crossSellerBlockers ?? []).map((b: { blocker?: string } | string) =>
              typeof b === "string" ? b : (b.blocker ?? ""),
            ),
            /** C. 가격 검증 — 금액과 «상태» 를 같이 본다(상태 없이 금액만 보면 거짓이다). */
            price: s.price ? `${s.price.currency} ${s.price.amount}` : null,
            priceStatus: (s as { priceStatus?: string }).priceStatus ?? null,
            humanGt: c.humanGt[host] ?? null,
            /** D. 🔴 가격비교 진입 — transient 는 **저장되지 않는다**. */
            shopId: TRANSIENT_URL_SHOP_ID,
          };
        });

        const same = rows.filter((r) => r.verdict === "SAME");
        const funnel = {
          "① 입력 URL": c.candidateUrls.length,
          "② Fetch·추출 성공": candidates.length,
          "③ MI SAME": same.length,
          "④ MI PRESUMED_SAME": rows.filter((r) => r.verdict === "PRESUMED_SAME").length,
          "⑤ MI 그 외": rows.filter((r) => r.verdict !== "SAME" && r.verdict !== "PRESUMED_SAME").length,
          "⑥ SAME 중 가격 보유": same.filter((r) => r.price).length,
          "⑦ SAME 중 가격 VERIFIED": same.filter((r) => r.priceStatus === "VERIFIED_CURRENT").length,
          /** 🔴🔴 transient 는 `domestic_product_links` 에 **쓰이지 않는다** —
           *     그리고 가격비교/EXACT 집계는 그 테이블을 읽는다. 그래서 **구조적으로 0** 이다. */
          "⑧ 가격비교 진입(DB 링크)": 0,
          "⑨ Human GT SAME": rows.filter((r) => r.humanGt === "SAME").length,
          "🔴 FALSE SAME": rows.filter((r) => r.humanGt === "DIFFERENT" && r.verdict === "SAME").length,
          "🟡 SAME MISS": rows.filter((r) => r.humanGt === "SAME" && r.verdict !== "SAME").length,
        };

        report.push({ label: c.label, originBrand: originFacts.brand, metrics: pool.metrics, funnel, rows });
        // eslint-disable-next-line no-console
        console.log(`\n[WU-038] ${c.label}  (원상품 brand=${JSON.stringify(originFacts.brand)})`);
        // eslint-disable-next-line no-console
        console.log("  " + JSON.stringify(funnel));
        for (const r of rows) {
          // eslint-disable-next-line no-console
          console.log(
            `   ${r.host.padEnd(20)} ${String(r.verdict).padEnd(14)} [${r.blockers.join(",") || "-"}] price=${r.price ?? "없음"}(${r.priceStatus ?? "-"}) human=${r.humanGt ?? "미판정"}`,
          );
        }
      }

      writeFileSync(path.join(OUT, "wu-038-e2e.json"), JSON.stringify(report, null, 2));

      /** 🔴 CONTROL — WU-036 Human GT 와 어긋나면 측정이 무효다. */
      const ac009 = report[0] as { funnel: Record<string, number> };
      expect(ac009.funnel["① 입력 URL"]).toBe(4);
      /** 🔴 **GT 가 전건 붙었는지 먼저 본다** — 안 붙으면 아래 KPI 가 거짓으로 통과한다. */
      const unlabeled = (report[0] as { rows: { humanGt: string | null }[] }).rows.filter((r) => !r.humanGt);
      expect(unlabeled, "B226AC009 4건은 전부 Human GT 가 있어야 한다").toHaveLength(0);
      /** WU-036 재현 — Human SAME 2(bobochoses·tinyapple) · DIFFERENT 2(trenbe·luxboy). */
      expect(ac009.funnel["⑨ Human GT SAME"]).toBe(2);
      expect(ac009.funnel["🔴 FALSE SAME"], "WU-036 에서 trenbe 가 유일한 False SAME 이었다").toBe(1);
    },
    20 * 60_000,
  );
});
