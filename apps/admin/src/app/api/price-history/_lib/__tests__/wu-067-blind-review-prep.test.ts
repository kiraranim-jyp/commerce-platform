import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  factsFromProductUrl,
  isColorUnverified,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-067 — **CEO 블라인드 GT 리뷰 준비** (자료 생성 전용 · 판정 0 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 **판정하지 않는다.** CEO 가 실제 페이지를 보고 라벨을 붙일 수 있도록
 *    **자료** 를 만든다. WU-036 과 같은 blind 설계다.
 *
 * ── 🔴🔴 blind 조건 (CPO §1) ──────────────────────────────────────────────
 * ```
 * visible  원상품(제목·URL) · 후보(제목·URL·도메인)          ← CEO 가 본다
 * sealed   MI verdict · blockers · tier · CF 결과 · 추천 결론  ← **보여주지 않는다**
 * ```
 * 🔴 `sealed` 를 리뷰 화면에 넣지 않는다 — 넣으면 사람이 **페이지가 아니라 우리 판정을
 *    검증** 하게 된다(WU-036 이 세운 원칙 그대로).
 *
 * ── 표본 ──────────────────────────────────────────────────────────────────
 * `mi-022-gt-worklist.json` 의 **41건** — GT 51 과 **겹치지 않는** 미라벨 후보다.
 * 🔴 파생 DIFFERENT(WU-066)도 제외한다 — 그것은 이미 라벨이 함의돼 있다.
 *
 * 실행: `WU_067_LIVE=1` (기본 skip · 실제 HTTP ~41회 · **읽기 전용 GET**)
 */

const LIVE = process.env.WU_067_LIVE === "1";
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const IDS: Record<string, string> = {
  S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
  S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
  S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
  S4: "c27d4727-2248-4fe0-9084-8c239737a889",
  S5: "32f7b651-29b9-4217-b8ce-46596f538306",
  S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
};
const ORIGIN_URL: Record<string, string> = {
  S1: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
  S2: "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
  S3: "https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses",
  S4: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  S5: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  S6: "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket",
};

describe("WU-067 — 블라인드 리뷰 자료", () => {
  (LIVE ? it : it.skip)(
    "미라벨 41건을 운영 owner 로 돌려 리뷰 대상을 추린다",
    async () => {
      const work = JSON.parse(readFileSync(path.join(OUT, "mi-022-gt-worklist.json"), "utf8")) as {
        searchId: string;
        candidateUrl: string;
        observedTitle: string;
      }[];
      const labeled = new Set(
        (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: { candidateUrl: string }[] }).rows.map((r) => r.candidateUrl),
      );
      const pool = work.filter((w) => !labeled.has(w.candidateUrl));
      expect(pool.length).toBeGreaterThan(30);

      const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as {
        id: string;
        canonical_product: unknown;
      }[];
      const origins: Record<string, ReturnType<typeof productFactsFromIdentityDna>> = {};
      const originTitle: Record<string, string> = {};
      for (const [sid, id] of Object.entries(IDS)) {
        const dna = buildProductIdentityDna(backfillCanonicalProduct(cases.find((c) => c.id === id)!.canonical_product as never));
        origins[sid] = productFactsFromIdentityDna(dna);
        originTitle[sid] = dna.title ?? "";
      }

      const rows: Record<string, unknown>[] = [];
      for (const w of pool) {
        const o = origins[w.searchId];
        if (!o) continue;
        let facts: Awaited<ReturnType<typeof factsFromProductUrl>> | null = null;
        try {
          facts = await factsFromProductUrl(w.candidateUrl);
        } catch {
          facts = null;
        }
        const cand = facts?.candidate?.facts ?? null;
        const base = {
          searchId: w.searchId,
          originTitle: originTitle[w.searchId],
          originUrl: ORIGIN_URL[w.searchId],
          candidateUrl: w.candidateUrl,
          domain: (() => {
            try {
              return new URL(w.candidateUrl).host;
            } catch {
              return "?";
            }
          })(),
          observedTitle: w.observedTitle,
          /** 🔴 아래부터는 **sealed** — 리뷰 화면에 **싣지 않는다**. */
          sealed: {} as Record<string, unknown>,
        };
        if (!cand) {
          base.sealed = { status: facts?.status ?? "UNREACHABLE", category: "제외 — 페이지를 읽지 못했다" };
          rows.push(base);
          continue;
        }
        const cross = compareCrossSellerProducts(o as never, cand as never) as {
          verdict: string;
          blockers?: { blocker: string }[];
          conflicts?: unknown[];
        };
        const bl = (cross.blockers ?? []).map((b) => b.blocker);
        const dCode =
          cand.brandModelCode ?? confirmBrandCodeInEvidence(o.brandModelCode ?? null, { title: facts?.candidate?.title ?? "", url: w.candidateUrl });
        const mc = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
        const cu = isColorUnverified(o.colorText ?? null, cand.colorText ?? null);
        const tier = (blockers: { blocker: string }[], colorUnv: boolean) =>
          priceTierFromLink({
            matchTruth: deriveMatchTruth("very_high", mc as never, cross.verdict as never, blockers as never, (cross.conflicts ?? []) as never, colorUnv),
            verified: false,
          } as never);
        const now = tier(cross.blockers ?? [], cu);
        /** CF-2 — `NO_TITLE_OVERLAP` 비차단 + 색상 확인됐다고 가정. */
        const cf2 = tier((cross.blockers ?? []).filter((b) => b.blocker !== "NO_TITLE_OVERLAP"), false);

        /** 🔴 CPO §1 의 다섯 범주. 우선순위 순으로 **하나만** 매긴다. */
        const category =
          now !== "EXACT" && cf2 === "EXACT"
            ? "① CF-2 로 EXACT 가 되는 후보"
            : bl.includes("NO_TITLE_OVERLAP")
              ? "② NO_TITLE_OVERLAP 후보"
              : cu && mc === "exact"
                ? "③ 색상 evidence 가 필요한 후보"
                : cross.verdict === "PRESUMED_SAME"
                  ? "④ crossSellerReserved 가 보호하는 후보"
                  : now === "EXACT" || cross.verdict === "SAME" || cross.verdict === "CONFLICT"
                    ? "⑤ 경계 사례"
                    : "— 그 외";

        base.sealed = {
          status: facts?.status, verdict: cross.verdict, blockers: bl, modelCode: mc,
          colorUnverified: cu, oColor: o.colorText ?? null, cColor: cand.colorText ?? null,
          now, cf2, category, candTitle: facts?.candidate?.title ?? null, imageUrls: (cand.imageUrls ?? []).slice(0, 3),
        };
        rows.push(base);
      }

      const dist: Record<string, number> = {};
      for (const r of rows) dist[String((r.sealed as Record<string, unknown>).category ?? "제외")] = (dist[String((r.sealed as Record<string, unknown>).category ?? "제외")] ?? 0) + 1;
      console.log("\n════════ 리뷰 대상 분류 ════════");
      console.log(` 풀 ${pool.length} · 읽힘 ${rows.filter((r) => (r.sealed as any).verdict).length}`);
      for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(2)}  ${k}`);
      console.log("\n──  범주별 목록 ──");
      for (const r of rows) {
        const s = r.sealed as any;
        if (!s.verdict) continue;
        console.log(`  [${s.category}] ${r.searchId} ${String(r.domain).padEnd(24)} verdict=${String(s.verdict).padEnd(14)} now=${String(s.now).padEnd(11)} cf2=${String(s.cf2).padEnd(11)} code=${s.modelCode}`);
      }

      writeFileSync(path.join(OUT, "wu-067-review-source.json"), JSON.stringify(rows, null, 1));
      console.log(`\n🟢 wu-067-review-source.json 생성 — ${rows.length}건`);
      expect(rows.length).toBeGreaterThan(0);
    },
    600_000,
  );
});
