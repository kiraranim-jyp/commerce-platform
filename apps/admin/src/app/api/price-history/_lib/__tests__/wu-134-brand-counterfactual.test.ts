/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-134 — **원상품 브랜드 확정성: 반사실 측정** (게이트 없으면 SKIP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 게이트 `WU_134_PROBE=1` 없으면 **SKIP**(회귀에서 외부 HTTP 금지).
 * 🔴 운영 코드 변경 **0** — 이 파일은 **재기만** 한다.
 *
 * 🔴🔴🔴 **구현 «전» 에 재는 이유** — WU-080 이 「원상품 brand 공백을 메우면 **악화**
 *    된다」를 측정해 CPO 가 REJECT 한 자리다(SAME 4 더 막힘 · DIFFERENT 2 열림).
 *    🔴 그래서 「이번 축은 다르다」를 **말로** 주장하지 않고 **숫자로** 확인한다.
 *    실측이 순손실이면 **구현하지 않는다.**
 *
 * ── 🔴 WU-134 STEP 1 측정 결과 (이 파일의 전제 · `wu-134-signals.json`) ────────
 * ```
 * 원상품 bobochoses.com  Product.brand="AW26"(시즌코드) → 규칙이 **올바르게** 버린다
 *                        Organization.name == og:site_name == "Bobo Choses"
 *                        mpn = sku = "B226AC00945101"
 * 후보 17건              Product.brand 보유 11 · null 6
 *                        org/site 는 **자기 상점 이름**("Tinyapple" · "trenbe" · "Kids21" …)
 * 🔴 **내 1차 가설(「브랜드 품번을 자기 sku 로 싣는 곳이 공식몰」)은 반증됐다** —
 *    trenbe · thefrontshop · luxboy 도 `B226AC009` 를 sku 로 싣는다(리테일러인데).
 * 🟢 **발화 조건이 리테일러에 걸리지 않는다는 것은 측정됐다** — 「Product.brand 가
 *    «있는데» 시즌코드로 거부됨」은 **원상품 1건뿐이고 후보 17건 중 0** 이다.
 * ```
 *
 * ── 🔴 Positive + Negative 를 «같이» 본다 (CPO §7) ─────────────────────────
 * ```
 * 실제 SAME      → SAME 으로 회복되는가
 * 실제 DIFFERENT → DIFFERENT 로 **계속 방어되는가**   ← 이쪽이 더 중요하다
 * ```
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildCrossSellerSearchQueries,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

const LIVE = process.env.WU_134_PROBE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const FIX = path.join(__dirname, "fixtures");
const read = <T>(f: string): T => {
  const p = path.join(OUT, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${f}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};
const fixture = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;
/* eslint-disable no-console */
const log = (s: string) => console.log(s);
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

const ORIGIN_CODE = "B226AC009";
/**
 * 🔴 **반사실로 넣는 값은 추측이 아니다** — 원상품 페이지의 `Organization.name` ==
 *    `og:site_name` 실측값이다(`wu-134-signals.json`). 🔴 도메인에서 만들지 않았다.
 */
const CF_BRAND = "Bobo Choses";

interface Snap {
  id: string;
  source_url: string;
  title: string;
  workspace_id: string;
  workspace: Record<string, unknown>;
}

/** 🔴 **원상품 1개 축**(`B226AC009`)의 human 라벨 전수 — SAME «그리고» DIFFERENT. */
function gtForOrigin(): { url: string; verdict: string }[] {
  const out: { url: string; verdict: string }[] = [];
  const seen = new Set<string>();
  const push = (url: string | undefined, verdict: string | undefined) => {
    if (!url || !verdict) return;
    const k = loose(url);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ url, verdict });
  };
  const f112 = fixture<{ candidates: { originCode: string; url: string; verdict: string }[] }>("wu-112-human-gt.json");
  for (const c of f112.candidates) if (c.originCode === ORIGIN_CODE) push(c.url, c.verdict);
  const f111 = fixture<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>("wu-111-human-gt.json");
  for (const c of f111.candidates) if (c.originCode === ORIGIN_CODE) push(c.url, c.humanVerdict);
  const f125 = fixture<{ candidates: { origin: string; url: string; human: string }[] }>("wu-125-human-gt.json");
  for (const c of f125.candidates) if (c.origin === ORIGIN_CODE) push(c.url, c.human);
  return out;
}

interface Judged {
  url: string;
  host: string;
  human: string;
  /** 🟢 운영 `domesticMatchDisplay` 가 내는 표시 등급(화면이 SAME 으로 보는 그 값). */
  displayTier: string | null;
  matchTruth: string | null;
  verdict: string | null;
  blockers: string[];
  conflicts: string[];
  priceStatus: string | null;
  tier: string | null;
}

describe("WU-134 — 원상품 브랜드 반사실 (Positive + Negative)", () => {
  it.runIf(LIVE)(
    "브랜드를 복구하면 실제 SAME 이 회복되고 실제 DIFFERENT 는 계속 막히는가",
    async () => {
      const gt = gtForOrigin();
      const two = read<{ s1: Snap | null; s2: Snap | null }>("wu130-two.json");
      const snap = two.s2!;
      expect(snap.source_url.toLowerCase()).toContain(ORIGIN_CODE.toLowerCase());

      const product = backfillCanonicalProduct(
        (snap.workspace as { canonicalProduct: unknown }).canonicalProduct as never,
      );
      const dna = buildProductIdentityDna(product);
      log(
        `\n📦 원상품 ${snap.title} · brand=${JSON.stringify(dna.brand)} · code=${dna.brandModelCode ?? "null"}`,
      );
      log(
        `📚 GT ${gt.length}건 — SAME ${gt.filter((g) => g.verdict === "SAME").length} · ` +
          `DIFFERENT ${gt.filter((g) => g.verdict === "DIFFERENT").length} · ` +
          `그 외 ${gt.filter((g) => g.verdict !== "SAME" && g.verdict !== "DIFFERENT").length}`,
      );
      /** 🔴 분모가 **양쪽** 있어야 반사실을 판정할 수 있다(Positive 만 보면 FP 를 놓친다). */
      expect(gt.filter((g) => g.verdict === "DIFFERENT").length).toBeGreaterThan(0);

      /**
       * 🔴 후보는 **한 번만** 모은다(HTTP 절약 · 두 조건이 **같은 후보** 를 보게 한다).
       *    🟢 운영 상한을 넘겨 GT 전수를 열어 본다 — 「상한에 막혀 못 봤다」를 원인으로
       *       오인하지 않기 위해서다(운영 상한은 그대로 10).
       */
      const pool = await collectUrlCandidatePool({
        urls: gt.map((g) => g.url),
        originUrl: dna.sourceUrl,
        maxUrls: gt.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });
      log(
        `🔁 pool — supplied ${pool.metrics.suppliedUrls} · usable ${pool.metrics.usableProductUrls} · ` +
          `후보 ${pool.metrics.miEligibleCandidates} · dropped ${JSON.stringify(pool.metrics.dropped.map((d) => d.reason))}`,
      );
      /**
       * 🔴🔴 **열화된 실행으로 반사실을 판정하지 않는다**(WU-133 교훈). 후보가 거의
       *    없으면 두 조건이 둘 다 0 이 되어 「변화 없음」이라는 거짓 결론이 난다.
       */
      expect(
        pool.metrics.usableProductUrls,
        "열화된 실행 — 재실행 필요(이 숫자로 반사실을 판정하지 않는다)",
      ).toBeGreaterThan(gt.length / 2);

      const humanByUrl = new Map(gt.map((g) => [loose(g.url), g.verdict]));

      /** 🔴 **같은 후보 집합** 에 brand 만 바꿔 두 번 판정한다(그 외 입력은 글자 그대로 동일). */
      const judge = async (brand: string): Promise<Judged[]> => {
        const searchTerms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const facts = productFactsFromIdentityDna(dna);
        const query = {
          title: dna.title,
          brand: brand || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          searchTerm: searchTerms[0] ?? dna.title,
          searchTerms,
          /**
           * 🔴 판정이 보는 것은 `facts.brand` 다 — 거기까지 같이 바꿔야 반사실이 성립한다.
           * 🔴 **칸의 타입을 지키다**(`string | null`) — `undefined` 를 넣으면 타입이 막는다
           *    (이 트랙에서 칸 이름/모양을 추측해 틀린 것이 스무 번이다).
           */
          facts: { ...facts, brand: brand || null },
        };
        const out: Judged[] = [];
        for (const result of pool.searchResults) {
          if (result.status !== "ok" || result.candidates.length === 0) continue;
          const notSelf = result.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          const scored = withConfidence(query, notSelf);
          let priced = scored;
          try {
            priced = await enrichCandidatePrices(scored, result.domain, query);
          } catch {
            /* 운영과 같다. */
          }
          const j = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: priced,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
          });
          if (j.kind !== "JUDGED") continue;
          out.push({
            url: j.best.url,
            host: result.domain,
            human: humanByUrl.get(loose(j.best.url)) ?? "(라벨없음)",
            displayTier: j.matchTruth ? domesticMatchDisplay(j.matchTruth).tier : null,
            matchTruth: j.matchTruth,
            verdict: j.best.crossSellerVerdict ?? null,
            blockers: (j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
            conflicts: (j.best.crossSellerConflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)),
            priceStatus: j.best.priceStatus ?? null,
            tier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
          });
        }
        return out;
      };

      const before = await judge(dna.brand.value);
      const after = await judge(CF_BRAND);

      const idx = (rows: Judged[]) => new Map(rows.map((r) => [loose(r.url), r]));
      const B = idx(before);
      const A = idx(after);
      const keys = [...new Set([...B.keys(), ...A.keys()])];

      const stat = (rows: Judged[]) => {
        const same = rows.filter((r) => r.displayTier === "SAME");
        return {
          판정도달: rows.length,
          displaySAME: same.length,
          /** 🔴 **그 SAME 이 맞는가** — Human 라벨과 교차한다. */
          trueSAME: same.filter((r) => r.human === "SAME").length,
          falseSAME: same.filter((r) => r.human === "DIFFERENT").length,
          /** 🟢 실제 DIFFERENT 가 계속 막히는가. */
          diffBlocked: rows.filter((r) => r.human === "DIFFERENT" && r.displayTier !== "SAME").length,
          diff도달: rows.filter((r) => r.human === "DIFFERENT").length,
        };
      };
      log(`\n── BEFORE(brand="${dna.brand.value}") ── ${JSON.stringify(stat(before))}`);
      log(`── AFTER (brand="${CF_BRAND}") ── ${JSON.stringify(stat(after))}`);

      log(`\n── 행별 변화 ──`);
      for (const k of keys) {
        const b = B.get(k);
        const a = A.get(k);
        const changed = (b?.displayTier ?? "-") !== (a?.displayTier ?? "-");
        log(
          `  ${changed ? "🔸" : "  "} ${(a?.host ?? b?.host ?? "?").padEnd(24)} human=${(a?.human ?? b?.human ?? "?").padEnd(10)} ` +
            `${(b?.displayTier ?? "-").padEnd(14)} → ${(a?.displayTier ?? "-").padEnd(14)} ` +
            `truth ${(b?.matchTruth ?? "-").padEnd(18)} → ${(a?.matchTruth ?? "-").padEnd(18)} ` +
            `blk[${(b?.blockers ?? []).join("/")}]→[${(a?.blockers ?? []).join("/")}] ` +
            `cfl[${(b?.conflicts ?? []).join("/")}]→[${(a?.conflicts ?? []).join("/")}]`,
        );
      }

      const s0 = stat(before);
      const s1 = stat(after);
      log(
        `\n📣 판정 재료 — trueSAME ${s0.trueSAME} → ${s1.trueSAME} · ` +
          `falseSAME ${s0.falseSAME} → ${s1.falseSAME} · ` +
          `실제DIFFERENT 방어 ${s0.diffBlocked}/${s0.diff도달} → ${s1.diffBlocked}/${s1.diff도달}`,
      );
      writeFileSync(
        path.join(OUT, "wu-134-counterfactual.json"),
        JSON.stringify({ before, after, stat: { before: s0, after: s1 } }, null, 2),
        "utf8",
      );
      /**
       * 🔴🔴 **이 테스트는 「좋아졌다」를 단언하지 않는다** — 측정이 목적이다.
       *    🔴 단 **False SAME 이 늘어나면 그 자리에서 실패시킨다** — 그러면 구현하지
       *       않는다는 결정이 자동으로 기록된다(CPO 금지선: Precision 을 깨지 않는다).
       */
      expect(s1.falseSAME, "🔴 False SAME 증가 — 이 축은 구현하지 않는다").toBeLessThanOrEqual(s0.falseSAME);
    },
    1_800_000,
  );
});
