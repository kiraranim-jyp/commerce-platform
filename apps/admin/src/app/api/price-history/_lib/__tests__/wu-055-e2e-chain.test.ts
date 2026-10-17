import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-055-A — **AI 후보 URL → MI → 국내/해외 가격비교** 전체 체인 추적
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **1차 하니스가 게이트를 «지어냈다» — 그 결과를 버렸다.**
 *    나는 국내 축 자격을 `crossSellerVerdict === "SAME"` 으로 썼다. **운영은 그것을
 *    요구하지 않는다.** 실제 자격은 아래 셋이고 owner 가 각각 다르다:
 * ```
 * market === "KR"                     classifyCandidateMarket      (candidate-market.ts)
 * priceKrw != null                    VERIFIED_CURRENT && KRW      (runner:1294)
 * priceTier ∈ {EXACT, COMPARISON}     priceTierFromLink(matchTruth) (market-intelligence.ts:288)
 * ```
 *    🔴 그리고 그 앞에 **`judgeDomesticCandidate`** 가 있다(gate ②④ + `fetchModelCode`).
 *    §5-B 가 「운영 경로를 한 단계 빠뜨렸다」를 여덟 번 경고한 바로 그 함정이다.
 *
 * 🟢 그래서 이 하니스는 **운영 루프를 순서대로 베낀다**(run-domestic-price-check.ts:1065·1185):
 * ```
 * collectUrlCandidatePool → (host 그룹마다) isSelfReferenceCandidate 필터
 *   → withConfidence → enrichCandidatePrices
 *   → judgeDomesticCandidate  → best · matchTruth · **priceTier(owner 값)**
 *   → classifyCandidateMarket → 국내축 / 해외축 / 제외
 * ```
 * 🔴 `priceTier` 를 **복제 계산하지 않는다** — judgement 가 낸 값을 쓴다.
 * 🔴 새 URL 0 · AI 0 · Gemini 0 · DB 쓰기 0 · 운영 코드 변경 0.
 *
 * 실행: `WU_055_LIVE=1` · 선행: `node packages/database/scripts/wu-055-origins-dump.mjs`
 */

const LIVE = process.env.WU_055_LIVE === "1";
const maybe = LIVE ? it : it.skip;
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const GT_FILE = path.join(OUT, "wu-036-3way.json");
const ORIGINS_FILE = path.join(OUT, "wu-055-origins.json");

interface GtRow {
  id: string;
  searchId: string;
  originUrl: string;
  originTitle: string;
  candidateUrl: string;
  domain: string;
  miVerdict: string;
  humanGt: "SAME" | "DIFFERENT" | "UNCERTAIN";
}
interface Origin {
  id: string;
  source_url: string;
  title: string;
  canonical_product: unknown;
}

/** 🔴 host 그룹 하나가 최종적으로 닿는 곳. 운영은 **host 당 1건** 을 낸다(best). */
type Landing =
  | "A 후보공급 실패"
  | "B 판정 전 탈락"
  | "C tier 제외"
  | "D 가격 없음"
  | "E 시장 미확정"
  | "🟢 국내 가격비교"
  | "🟢 해외 참고가격";

describe("WU-055-A — 전체 체인 (운영 순서)", () => {
  maybe(
    "GT 51건을 운영 경로로 흘려 host 그룹마다 «어디서 끊기는지» 를 기록한다",
    async () => {
      expect(existsSync(GT_FILE), GT_FILE).toBe(true);
      expect(existsSync(ORIGINS_FILE), ORIGINS_FILE).toBe(true);
      const gt = (JSON.parse(readFileSync(GT_FILE, "utf8")) as { rows: GtRow[] }).rows;
      const origins = JSON.parse(readFileSync(ORIGINS_FILE, "utf8")) as Origin[];

      const originByUrl = new Map<string, Origin>();
      for (const o of origins) if (!originByUrl.has(o.source_url)) originByUrl.set(o.source_url, o);

      const groups = new Map<string, GtRow[]>();
      for (const r of gt) {
        const list = groups.get(r.searchId) ?? [];
        list.push(r);
        groups.set(r.searchId, list);
      }

      const hostRows: Record<string, unknown>[] = [];
      const candRows: Record<string, unknown>[] = [];
      const originDiag: Record<string, unknown>[] = [];

      for (const [searchId, members] of groups) {
        const snap = originByUrl.get(members[0]!.originUrl);
        if (!snap) {
          hostRows.push({ searchId, domain: "-", landing: "A 후보공급 실패", note: "원상품 스냅샷 미발견" });
          continue;
        }
        const dna = buildProductIdentityDna(backfillCanonicalProduct(snap.canonical_product as never));
        const originFacts = productFactsFromIdentityDna(dna);
        originDiag.push({
          searchId,
          title: dna.title.slice(0, 46),
          brand: dna.brand.value || null,
          identifier: dna.identifier?.value ?? null,
          tier: dna.identifier?.tier ?? null,
          /** 🔴 운영이 judge 에 넘기는 값(runner:1097) — `dna.brandModelCode` 다. */
          foreignModelCode: dna.brandModelCode ?? null,
          color: dna.color,
        });

        const pool = await collectUrlCandidatePool({
          urls: members.map((m) => m.candidateUrl),
          originUrl: dna.sourceUrl,
          maxUrls: members.length,
          existingCanonicalUrls: new Set<string>(),
        });

        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          sourceUrl: dna.sourceUrl,
          facts: originFacts,
        };

        for (const r of pool.searchResults) {
          /* ── 운영 루프 그대로(runner:1069-1086) ───────────────────────── */
          const notSelf = (r.candidates ?? []).filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          let priced = withConfidence(query, notSelf);
          try {
            priced = await enrichCandidatePrices(priced, r.domain, query);
          } catch {
            /* fail-soft — 운영과 같다 */
          }

          /** 🔴 후보 단위 기록(MI 안전성 축) — host 집계와 **섞지 않는다**. */
          for (const c of priced) {
            const gtRow = members.find((m) => {
              try {
                return new URL(m.candidateUrl).hostname.replace(/^(www|m|global)\./, "") === r.domain;
              } catch {
                return false;
              }
            });
            candRows.push({
              searchId,
              domain: r.domain,
              url: c.url,
              verdict: (c.crossSellerVerdict as string | undefined) ?? null,
              blockers: (c.crossSellerBlockers ?? []).map((b: { blocker?: string } | string) =>
                typeof b === "string" ? b : (b.blocker ?? ""),
              ),
              brandModelCode: c.facts?.brandModelCode ?? null,
              /** 🔴 WU-057 §1 — `BRAND_UNCONFIRMED` 는 **어느 쪽이 비었는지** 로 갈린다
               *     (`cross-seller.ts:751` brandKnown = x.brand && y.brand). 따로 적는다. */
              originBrand: dna.brand.value || null,
              candidateBrand: c.facts?.brand ?? null,
              candidateUrl: c.url,
              humanGt: gtRow?.humanGt ?? null,
            });
          }

          /* ── 🔴 운영 판정(runner:1185) — host 당 1건 ─────────────────── */
          const judgement = await judgeDomesticCandidate({
            domain: r.domain,
            candidates: priced,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode ?? null,
            foreignColor: dna.color,
            fetchModelCode: (url) => fetchDomesticModelCode(r.domain, url),
          });

          const gtForHost = members.filter((m) => {
            try {
              return new URL(m.candidateUrl).hostname.replace(/^(www|m|global)\./, "") === r.domain;
            } catch {
              return false;
            }
          });
          const humanAny = gtForHost.some((m) => m.humanGt === "SAME") ? "SAME" : (gtForHost[0]?.humanGt ?? null);

          if (judgement.kind !== "JUDGED") {
            hostRows.push({
              searchId,
              domain: r.domain,
              humanGt: humanAny,
              landing: "B 판정 전 탈락" satisfies Landing,
              judgeKind: judgement.kind,
              gate: judgement.kind === "DROPPED" ? judgement.gate : null,
            });
            continue;
          }

          const best = judgement.best;
          const priceStatus = (best as { priceStatus?: string }).priceStatus ?? null;
          const currency = best.price?.currency ?? null;
          const priceKrw = priceStatus === "VERIFIED_CURRENT" && currency === "KRW" ? best.price!.amount : null;
          const mkt = classifyCandidateMarket({ domain: r.domain, currency, isRegisteredDomesticShop: false });

          /** 🔴 운영 분기 순서 그대로(market-intelligence.ts:216 → :262 → :288). */
          const landing: Landing =
            mkt.market !== "KR"
              ? best.price
                ? mkt.market === "OVERSEAS"
                  ? "🟢 해외 참고가격"
                  : "E 시장 미확정"
                : "D 가격 없음"
              : priceKrw == null
                ? "D 가격 없음"
                : judgement.priceTier === "EXACT" || judgement.priceTier === "COMPARISON"
                  ? "🟢 국내 가격비교"
                  : "C tier 제외";

          hostRows.push({
            searchId,
            domain: r.domain,
            humanGt: humanAny,
            landing,
            matchTruth: judgement.matchTruth,
            /** 🟢 owner 값 — 복제 계산 아님. */
            priceTier: judgement.priceTier,
            verified: judgement.verified,
            verdict: (best.crossSellerVerdict as string | undefined) ?? null,
            blockers: (best.crossSellerBlockers ?? []).map((b: { blocker?: string } | string) =>
              typeof b === "string" ? b : (b.blocker ?? ""),
            ),
            brandModelCode: best.facts?.brandModelCode ?? null,
            price: best.price ? `${currency} ${best.price.amount}` : null,
            priceStatus,
            market: mkt.market,
            basis: mkt.basis,
          });
        }
      }

      const tally = (pick: (r: Record<string, unknown>) => string, src = hostRows) => {
        const t: Record<string, number> = {};
        for (const r of src) t[pick(r)] = (t[pick(r)] ?? 0) + 1;
        return t;
      };

      // eslint-disable-next-line no-console
      console.log("\n[WU-055 원상품]");
      for (const o of originDiag) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${o.searchId} ${String(o.title).padEnd(48)} brand=${JSON.stringify(o.brand)} code=${JSON.stringify(o.foreignModelCode)} color=${JSON.stringify(o.color)}`,
        );
      }

      // eslint-disable-next-line no-console
      console.log("\n[WU-055 host 판정] searchId · domain · human · matchTruth · tier · price · market · landing");
      for (const r of hostRows) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(r.searchId).padEnd(3)} ${String(r.domain).padEnd(22)} ${String(r.humanGt ?? "-").padEnd(10)} ` +
            `${String(r.matchTruth ?? r.gate ?? r.judgeKind ?? "-").padEnd(22)} ${String(r.priceTier ?? "-").padEnd(11)} ` +
            `${String(r.price ?? "가격없음").padEnd(14)} ${String(r.market ?? "-").padEnd(9)} ${r.landing}`,
        );
      }

      const summary = {
        "host 그룹 수": hostRows.length,
        landing: tally((r) => String(r.landing)),
        matchTruth: tally((r) => String(r.matchTruth ?? "-")),
        priceTier: tally((r) => String(r.priceTier ?? "-")),
        market: tally((r) => String(r.market ?? "-")),
        "🟢 국내 가격비교 도달": hostRows.filter((r) => r.landing === "🟢 국내 가격비교").length,
        "🟢 해외 참고가격 도달": hostRows.filter((r) => r.landing === "🟢 해외 참고가격").length,
        "— 후보 단위(MI 안전성) —": {
          후보수: candRows.length,
          verdict: tally((r) => String(r.verdict ?? "-"), candRows),
          "🔴 FALSE SAME": candRows.filter((r) => r.verdict === "SAME" && r.humanGt === "DIFFERENT").length,
          "🟡 SAME MISS": candRows.filter((r) => r.verdict !== "SAME" && r.humanGt === "SAME").length,
        },
      };
      // eslint-disable-next-line no-console
      console.log("\n[WU-055 요약] " + JSON.stringify(summary, null, 1));

      writeFileSync(
        path.join(OUT, "wu-055-chain.json"),
        JSON.stringify({ summary, originDiag, hostRows, candRows }, null, 2),
      );

      /** 🔴 단언은 측정 성립까지만 — 그룹이 하나도 안 생기면 측정 자체가 무효다. */
      expect(hostRows.length).toBeGreaterThan(0);
      expect(originDiag.length).toBeGreaterThan(0);
    },
    30 * 60_000,
  );
});
