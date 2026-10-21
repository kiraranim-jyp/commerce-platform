import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import {
  buildMarketJudgement,
  buildPriceGuide,
  priceGuideCountNote,
  priceGuideHeadline,
  saleState,
  isPriceConfirmed,
  selectMiSameCandidates,
  countPendingCandidates,
  countUnresolvedMarketCandidates,
} from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-142 STEP 1 — **두 상품을 «같은 조건» 으로 태워 국내/해외를 가른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 지시(2026-10-21)의 핵심은 「UI 를 먼저 고치지 않는다」 다.**
 * > 「지금처럼 이 화면을 보고 바로 UI 를 또 고치면 안 됩니다. 다음은 **반드시 2개
 * >  상품으로** 봐야 합니다. B226AC009 하나만 보면 SAME · SIMILAR · DIFFERENT ·
 * >  국내 · 해외 · 가격 있음 · 가격 없음 의 **모든 상태를 구분할 수 없습니다**.」
 *
 * 🔴 그래서 이 파일은 **결과를 바꾸지 않는다** — 운영 함수를 운영 순서로 부르고
 *    **무엇이 어디에 속하는지** 만 적는다. threshold 0 · 8축 0 · Registry 0 · 새 축 0.
 *
 * ── 🔴 왜 wu-138 하니스를 그대로 베끼는가 ──────────────────────────────────
 * 이 트랙에서 **여덟 번** 「운영 경로를 한 단계 빠뜨렸다」가 났고 일곱 번은 사후
 * 발견이었다(§5-B). 그래서 호출 순서를 **새로 쓰지 않고** 검증된 복제
 * (`wu-138-same-funnel`)를 **같은 순서로** 쓴다 —
 * `extract → buildCanonicalProduct → dna → collectUrlCandidatePool →
 *  isSelfReferenceCandidate → withConfidence → enrichCandidatePrices →
 *  judgeDomesticCandidate → classifyCandidateMarket → buildMarketJudgement`.
 *
 * ── 🔴 분모(CEO 육안 GT · `wu-112-human-gt.json` 27건) ──────────────────────
 * ```
 * B226AC010 (S1)  SAME 9 · DIFFERENT 4 · UNCERTAIN 2 · `.kr` 4 · 해외 11
 * B226AC009 (S2)  SAME 10 · DIFFERENT 2 · UNCERTAIN 0 · `.kr` 1 · 해외 11
 * ```
 * 🔴 `UNCERTAIN` 은 **정확도 분모에서 뺀다**(사람이 판단하지 못한 것이다).
 * 🔴 `.kr` 수는 **도메인 추정** 이고 운영 시장 판정이 아니다 — 표의 `market` 칸이 그것이다.
 *
 * 🔴 게이트 `WU_142_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.WU_142_PROBE === "1";

const PRODUCTS = [
  {
    sid: "S1",
    code: "B226AC010",
    origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
  },
  {
    sid: "S2",
    code: "B226AC009",
    origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
  },
] as const;

const FIX = path.join(__dirname, "fixtures");
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const fx = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;

/** 🔴 진단 조회용 host 정규화 — 운영 `res.domain` 과 GT host 의 `www.` 차이를 맞춘다. */
const bare = (h: string) => h.replace(/^www\./, "");

/** 🔴 표 라벨 용도만. 운영 시장 판정은 `classifyCandidateMarket` 산출(`market` 칸)이다. */
const looksKr = (u: string) => {
  try {
    return new URL(u).hostname.endsWith(".kr");
  } catch {
    return false;
  }
};

interface Row {
  url: string;
  domain: string;
  human: string;
  krGuess: boolean;
  candidate: boolean;
  judged: boolean;
  isBest: boolean;
  displayTier: string | null;
  blockers: string[];
  market: string | null;
  sale: string | null;
  price: string | null;
  priceConfirmed: boolean;
  inComparison: boolean;
  /** 🔴 **처음** 사라진 한 지점(CPO STEP A: 「각 SAME 이 처음 사라진 한 지점만 기록」). */
  lostAt: string | null;
  /** 🔴 STEP B 의 축 이름 — 사유 문자열이 아니라 **분류 키** 다(집계가 흩어지지 않게). */
  axis: string | null;
}

/**
 * 🔴🔴 **CPO 가 고정한 7축.** 사유 문자열을 그대로 세면 조합마다 칸이 갈라져
 *    (`MODEL_CODE` ↔ `MODEL_CODE·COLOR`) 집계가 흩어진다 ⟹ **키로 접는다.**
 * 🔴 순서가 곧 우선순위다(P0 → P3). 모르는 모양은 `OTHER` 로 두고 **지어내지 않는다.**
 */
const AXES = [
  "MODEL_CODE",
  "NO_BLOCKER",
  "AUDIENCE_LINE",
  "SHOP_GATE",
  "SHOP_REP",
  "BRAND_UNCONFIRMED",
  "BRAND_MISMATCH+TITLE",
  "MARKET_UNRESOLVED",
  "PRICE_UNCONFIRMED",
  "DUP_URL",
  "NO_CANDIDATE",
  "OTHER",
] as const;

/**
 * 🔴 **1차 출력이 표를 깨뜨렸다** — `"🇰🇷 국내".length` 는 **5** 가 아니라 **7** 이다
 *    (국기 이모지가 서로게이트 페어 둘). `pad(…, 6)` 이 「🇰🇷 국0」으로 **숫자를 잘라먹었다**.
 * 🟢 그래서 **라벨은 자르지 않고** 오른쪽만 채운다(절단 금지).
 */
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

async function runOne(p: (typeof PRODUCTS)[number]) {
  /* ── ① 원상품을 운영 추출 경로로 ── */
  const r = await shopifySiteStrategy.extract(p.origin);
  const product = buildCanonicalProduct(
    p.origin,
    r!.productData as ExtractedProductData,
    {} as Record<string, ProductDataSource>,
    [],
  );
  const dna = buildProductIdentityDna(product);
  /* eslint-disable no-console */
  console.log(`\n━━━━━━ ${p.sid} ${p.code} — brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} color=${JSON.stringify(dna.color)}`);
  /** 🔴 WU-137 수정이 여기서 발화한다 — 브랜드가 비면 **모든 후보가 BRAND_UNCONFIRMED** 다. */
  expect(dna.brand.value, "원상품 brand 가 비었다 — 측정이 무효가 된다(WU-133 사슬의 머리)").toBe("Bobo Choses");

  /* ── ② GT(SAME «그리고» DIFFERENT — Negative 를 같이 본다) ── */
  const seen = new Set<string>();
  const gt: { url: string; verdict: string }[] = [];
  for (const c of fx<{ candidates: { originCode: string; url: string; verdict: string }[] }>(
    "wu-112-human-gt.json",
  ).candidates) {
    if (c.originCode !== p.code) continue;
    if (seen.has(loose(c.url))) continue;
    seen.add(loose(c.url));
    gt.push({ url: c.url, verdict: c.verdict });
  }

  /* ── ③ 운영 순서 그대로 ── */
  const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
  const query = {
    title: dna.title,
    brand: dna.brand.value || undefined,
    sourceUrl: dna.sourceUrl,
    sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
    searchTerm: terms[0] ?? dna.title,
    searchTerms: terms,
    facts: productFactsFromIdentityDna(dna),
  };
  const pool = await collectUrlCandidatePool({
    urls: gt.map((g) => g.url),
    originUrl: dna.sourceUrl,
    maxUrls: gt.length,
    existingCanonicalUrls: new Set<string>(),
    shopId: REVIEWED_SAME_SHOP_ID,
    shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
  });
  /** 🔴 **열화된 실행으로 숫자를 내지 않는다**(「측정불가」≠「0」· WU-133 게이트). */
  expect(pool.metrics.usableProductUrls, `${p.sid} 열화된 실행 — 재실행 필요`).toBeGreaterThan(gt.length / 2);

  const inPool = new Set<string>();
  for (const res of pool.searchResults) for (const c of res.candidates ?? []) inPool.add(loose(c.url));

  const rows: GeminiTransientRow[] = [];
  const judgedByUrl = new Map<string, { best: boolean; judged: boolean }>();
  /**
   * 🔴🔴 STEP C — **축별 «진단» 에 필요한 원후보를 보존한다**(CPO P0~P3).
   *
   * CPO 는 「축을 바로 완화」가 아니라 **「그 축이 실제 식별 실패인지 정상 방어인지
   * 확인」** 을 요구했다 ⟹ 판정 산출(`GeminiTransientRow`)만으로는 답할 수 없다.
   * 그 행에는 **후보측 품번·브랜드·축 근거가 없다**(요약된 뒤의 값이다).
   * 🟢 그래서 `withConfidence`+`enrichCandidatePrices` 가 돌린 **그 객체** 를 그대로 둔다.
   * 🔴 값을 **만들지 않는다** — 운영이 계산한 것을 읽기만 한다.
   */
  const rawByUrl = new Map<string, Record<string, unknown>>();
  /** 🔴 샵 게이트/대표 선정 진단용 — 그 샵이 들고 있던 **후보 전부**. */
  const shopCandidates = new Map<string, Record<string, unknown>[]>();
  const shopGate = new Map<string, string>();

  for (const res of pool.searchResults) {
    if (res.status !== "ok" || res.candidates.length === 0) continue;
    const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
    const scored = withConfidence(query, notSelf);
    let priced = scored;
    try {
      priced = await enrichCandidatePrices(scored, res.domain, query);
    } catch {
      /* 운영과 같다 */
    }
    const j = await judgeDomesticCandidate({
      domain: res.domain,
      candidates: priced,
      sourceUrl: query.sourceUrl,
      foreignModelCode: dna.brandModelCode,
      foreignColor: dna.color,
      fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
    });
    /**
     * 🔴 **1차 진단이 `www.stockmann.ee` 에서 「후보 0건 · 사유 ?」를 찍었다** — 운영
     *    `res.domain` 은 `stockmann.ee` 인데 GT 행의 host 는 `www.stockmann.ee` 라
     *    조회가 빗나갔다. 🔴 「후보 0건」은 **거짓** 이었다(게이트 진단이 통째로 비었다).
     * 🟢 `www.` 를 떼어 맞춘다.
     */
    shopCandidates.set(bare(res.domain), priced as unknown as Record<string, unknown>[]);
    if (j.kind !== "JUDGED") shopGate.set(bare(res.domain), (j as { reason?: string }).reason ?? j.kind);
    for (const c of priced) {
      judgedByUrl.set(loose(c.url), {
        judged: j.kind === "JUDGED",
        best: j.kind === "JUDGED" && loose(j.best.url) === loose(c.url),
      });
      rawByUrl.set(loose(c.url), c as unknown as Record<string, unknown>);
    }
    if (j.kind !== "JUDGED") continue;
    const m = classifyCandidateMarket({
      domain: res.domain,
      currency: j.best.price?.currency ?? null,
      isRegisteredDomesticShop: false,
    });
    rows.push({
      source: "REVIEWED_SAME",
      domain: res.domain,
      title: j.best.title,
      imageUrl: j.best.imageUrl ?? null,
      soldOut: j.best.soldOut ?? null,
      discoveredUrl: j.best.url,
      matchTruth: j.matchTruth,
      priceTier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
      crossSellerVerdict: j.best.crossSellerVerdict ?? null,
      confidence: j.best.confidence ?? null,
      matchReasons: j.best.matchReasons ?? [],
      crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
      crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)),
      priceAmount: j.best.price?.amount ?? null,
      priceCurrency: j.best.price?.currency ?? null,
      priceStatus: j.best.priceStatus ?? null,
      market: m.market,
      basis: m.basis,
    } as GeminiTransientRow);
  }

  /* ── ④ 운영 산출 — 셀러가 보는 그 값 ── */
  const judgement = buildMarketJudgement(rows);
  const inComparison0 = new Set(judgement.sellers.map((s) => loose(s.row.discoveredUrl)));

  const table: Row[] = gt.map((g) => {
    const key = loose(g.url);
    const jr = judgedByUrl.get(key);
    const row = rows.find((x) => loose(x.discoveredUrl) === key);
    const blockers = [...(row?.crossSellerBlockers ?? []), ...(row?.crossSellerConflicts ?? [])];
    const domain = (() => {
      try {
        return new URL(g.url).hostname;
      } catch {
        return "?";
      }
    })();
    /** 🔴 같은 판매처가 **다른 URL** 로 최종에 섰으면 「사라졌다」가 아니다(WU-138 교훈). */
    const sameHostInComparison = judgement.sellers.some((x) => {
      try {
        return new URL(x.row.discoveredUrl).hostname === domain;
      } catch {
        return false;
      }
    });
    const candidate = inPool.has(key);
    const judged = jr?.judged ?? false;
    const isBest = jr?.best ?? false;
    const tier = row?.matchTruth ? domesticMatchDisplay(row.matchTruth as never).tier : null;
    const priceConfirmed = row ? isPriceConfirmed(row) : false;
    const inComparison = inComparison0.has(key);

    /** 🔴 **처음** 사라진 칸 하나만. 뒤 칸에서 또 걸려도 **앞 칸만** 적는다. */
    let lostAt: string | null = null;
    let axis: string | null = null;
    if (!inComparison) {
      if (!candidate) {
        lostAt = sameHostInComparison ? "🟡 중복 URL(같은 판매처가 다른 URL 로 통과)" : "② 후보 생성";
        axis = sameHostInComparison ? "DUP_URL" : "NO_CANDIDATE";
      } else if (!judged) {
        lostAt = `③ 샵 게이트(${shopGate.get(domain) ?? "?"})`;
        axis = "SHOP_GATE";
      } else if (!isBest) {
        lostAt = "④ 샵 대표 선정";
        axis = "SHOP_REP";
      } else if (tier !== "SAME") {
        lostAt = `⑤ MI 판정(${blockers.join("·") || "blocker 없음"})`;
        axis = blockers.includes("MODEL_CODE")
          ? "MODEL_CODE"
          : blockers.includes("BRAND_MISMATCH")
            ? "BRAND_MISMATCH+TITLE"
            : blockers.includes("BRAND_UNCONFIRMED")
              ? "BRAND_UNCONFIRMED"
              : blockers.includes("AUDIENCE_LINE")
                ? "AUDIENCE_LINE"
                : blockers.length === 0
                  ? "NO_BLOCKER"
                  : "OTHER";
      } else if (row?.market !== "KR" && row?.market !== "OVERSEAS") {
        lostAt = "⑥ 시장 미확정";
        axis = "MARKET_UNRESOLVED";
      } else if (!priceConfirmed) {
        lostAt = "⑧ 가격 미확인";
        axis = "PRICE_UNCONFIRMED";
      } else {
        lostAt = "⑨ 기타";
        axis = "OTHER";
      }
    }
    return {
      url: g.url,
      domain,
      human: g.verdict,
      krGuess: looksKr(g.url),
      candidate,
      judged,
      isBest,
      displayTier: tier,
      blockers,
      market: row?.market ?? null,
      sale: row ? saleState(row) : null,
      price: row?.priceAmount != null ? `${row.priceCurrency} ${row.priceAmount}` : null,
      priceConfirmed,
      inComparison,
      lostAt,
      axis,
    };
  });

  return { p, dna, gt, table, rows, judgement, rawByUrl, shopCandidates, shopGate };
}

describe("WU-142 STEP 1 — 2상품 MI 실측", () => {
  it.runIf(LIVE)("국내/해외 × SAME·판매중·가격을 두 상품에서 같은 조건으로 측정한다", async () => {
    const results = [];
    for (const p of PRODUCTS) results.push(await runOne(p));

    /* ══════════ ① 상품 × 시장 교차표 — CPO 가 요구한 그 모양 ══════════ */
    console.log(`\n\n════════ ① 상품 × 시장 — 「국내/해외 각각 SAME → 판매중 → 가격」 ════════`);
    console.log(
      `   ${pad("상품", 12)}${pad("시장", 6)}${pad("humanSAME", 11)}${pad("후보", 6)}${pad("판정", 6)}` +
        `${pad("MI SAME", 9)}${pad("판매중", 8)}${pad("가격확인", 10)}${pad("최종", 6)}`,
    );
    for (const { p, table } of results) {
      /**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 **1차 분류가 행을 «사라지게» 만들었다 — 그 결함을 먼저 적는다**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 1차 picker 는 `market === "KR"` / `=== "OVERSEAS"` / `market == null` 만 봤다.
       * 🔴 그런데 운영 `classifyCandidateMarket` 은 **`"UNKNOWN"`** 을 낸다(null 이 아니다)
       *    ⟹ `beaumonde.co.kr`(**human SAME · `.kr` · 가격 없음 → UNKNOWN**)이
       *    **두 버킷 어디에도 안 들어갔다.** 그래서 S1 🇰🇷 humanSAME 이 **0** 으로 찍혔는데
       *    같은 실행의 ③ 누락 목록에는 그 판매처가 **human SAME 으로 올라왔다** — 모순이다.
       * 🔴 그대로 보고했으면 **「국내에는 human SAME 이 1건뿐」이라는 거짓 분모** 였다
       *    (실제 2건 — biskuit.kr · beaumonde.co.kr · WU-138 이 확정한 그 둘).
       * 🟢 WU-140 ⒠ 가 **화면에서** 지적한 바로 그 구멍이고, 내 표가 그것을 복제했다.
       * ⟹ 🟢 **세 번째 버킷(❔ 미확정)을 만들어 어느 행도 사라지지 않게** 한다.
       */
      for (const [label, pick] of [
        ["🇰🇷 국내  ", (r: Row) => r.market === "KR"],
        ["🌎 해외  ", (r: Row) => r.market === "OVERSEAS"],
        ["❔ 미확정", (r: Row) => r.market !== "KR" && r.market !== "OVERSEAS"],
      ] as const) {
        const seg = table.filter(pick);
        const hs = seg.filter((r) => r.human === "SAME");
        console.log(
          `   ${pad(p.code, 12)}${pad(label, 6)}${pad(String(hs.length), 11)}` +
            `${pad(String(seg.filter((r) => r.candidate).length), 6)}` +
            `${pad(String(seg.filter((r) => r.judged).length), 6)}` +
            `${pad(String(seg.filter((r) => r.displayTier === "SAME").length), 9)}` +
            `${pad(String(seg.filter((r) => r.sale === "ON_SALE").length), 8)}` +
            `${pad(String(seg.filter((r) => r.priceConfirmed).length), 10)}` +
            `${pad(String(seg.filter((r) => r.inComparison).length), 6)}`,
        );
      }
    }

    /* ══════════ ② 셀러가 실제로 보는 값 — 📊 시장 판매 판단 ══════════ */
    console.log(`\n════════ ② 📊 시장 판매 판단 (운영 산출 그대로) ════════`);
    for (const { p, rows, judgement } of results) {
      const kr = buildPriceGuide(judgement, "KR");
      const os = buildPriceGuide(judgement, "OVERSEAS");
      console.log(`\n   ── ${p.sid} ${p.code} — verdict **${judgement.verdict}**`);
      console.log(`      판매중 ${judgement.onSaleCount} · 확인불가 ${judgement.unknownCount} · 품절 ${judgement.soldOutCount}`);
      for (const [flag, g] of [
        ["🇰🇷 국내", kr],
        ["🌎 해외", os],
      ] as const) {
        console.log(`      ${flag}  ${priceGuideCountNote(g)}`);
        console.log(`             기준가 — ${priceGuideHeadline(g) ?? "(없음)"}  [basis ${g.basis}]`);
      }
      /**
       * 🔴 **1차에 `[object Object]` 가 찍혔다** — `countPendingCandidates` 는 숫자가 아니라
       *    `PendingSummary {count, reasons[]}` 를 돌려준다. 🔴 이 트랙에서 반복된
       *    「칸/반환 모양을 추측했다」의 또 한 번이다(owner 타입에서 읽고 고쳤다).
       * 🟢 그리고 `reasons` 가 **왜 보류인지** 를 이미 들고 있다 — STEP 2 분류의 재료다.
       */
      const pending = countPendingCandidates(rows);
      console.log(
        `      보류 후보 ${pending.count}건` +
          (pending.reasons.length > 0 ? ` (${pending.reasons.map((x) => `${x.text} ${x.n}`).join(" · ")})` : "") +
          ` · 시장 미확정 ${countUnresolvedMarketCandidates(rows)}건`,
      );
    }

    /* ══════════ ③ 정확도 — 오포함/누락을 «갈라» 적는다 ══════════ */
    console.log(`\n════════ ③ 정확도 (UNCERTAIN 은 분모에서 뺀다) ════════`);
    for (const { p, table } of results) {
      const labeled = table.filter((r) => r.human === "SAME" || r.human === "DIFFERENT");
      const final = labeled.filter((r) => r.inComparison);
      const falseSame = final.filter((r) => r.human === "DIFFERENT");
      const missed = labeled.filter((r) => r.human === "SAME" && !r.inComparison);
      console.log(
        `   ${pad(p.code, 12)} 분모 ${labeled.length} · 최종 진입 ${final.length} · ` +
          `🔴 오포함(DIFFERENT 누출) **${falseSame.length}** · 🔴 누락(human SAME 미도달) **${missed.length}**`,
      );
      for (const m of missed) {
        console.log(
          `        ↳ 누락 ${pad(m.domain, 26)} ${pad(m.displayTier ?? "-", 15)} ${m.blockers.join(" · ") || "(blocker 없음)"}`,
        );
      }
      for (const f of falseSame) console.log(`        ↳ 🔴 오포함 ${f.domain} tier=${f.displayTier}`);
    }

    /* ═══════════════════ STEP A — human SAME 19건 전수 funnel ═══════════════════ */
    const allSame = results.flatMap(({ p, table }) => table.filter((r) => r.human === "SAME").map((r) => ({ p, r })));
    console.log(`\n\n════════ STEP A — human SAME **${allSame.length}건** 전수 loss funnel (URL 단위) ════════`);
    console.log(
      `   ${pad("상품", 11)}${pad("판매처", 27)}${pad("후보", 5)}${pad("게이트", 7)}${pad("대표", 5)}` +
        `${pad("tier", 15)}${pad("시장", 10)}${pad("판매", 9)}${pad("가격", 12)}${pad("최종", 5)}처음 사라진 칸`,
    );
    for (const { p, r } of allSame) {
      console.log(
        `   ${pad(p.code, 11)}${pad(r.domain, 27)}${pad(r.candidate ? "O" : "X", 5)}` +
          `${pad(r.judged ? "O" : "X", 7)}${pad(r.isBest ? "O" : "X", 5)}${pad(r.displayTier ?? "-", 15)}` +
          `${pad(r.market ?? "-", 10)}${pad(r.sale ?? "-", 9)}${pad(r.price ?? "-", 12)}` +
          `${pad(r.inComparison ? "🟢" : "X", 5)}${r.lostAt ?? "🟢 통과"}`,
      );
    }

    /* ═══════════ STEP B — 7축 분리 + 🔴 DIFFERENT 방어를 «같이» 센다 ═══════════ */
    console.log(`\n════════ STEP B — 축별 분리 (🔴 human DIFFERENT 방어를 같이 본다) ════════`);
    console.log(
      `   ${pad("축", 24)}${pad("SAME 손실", 11)}${pad("DIFF 방어", 11)}${pad("판정", 10)}근거`,
    );
    const allRows = results.flatMap(({ table }) => table);
    for (const axis of AXES) {
      const sameLost = allRows.filter((r) => r.human === "SAME" && r.axis === axis);
      const diffHeld = allRows.filter((r) => r.human === "DIFFERENT" && r.axis === axis);
      if (sameLost.length === 0 && diffHeld.length === 0) continue;
      /**
       * 🔴🔴 **이 칸이 CPO STEP B 의 핵심이다.** 같은 축이 **human DIFFERENT 를 몇 건
       *    막고 있는지** 를 모르면 「완화하면 recall 이 오른다」만 보고 지르게 된다 —
       *    이 트랙이 여덟 번 그렇게 측정하고 전부 **순손실** 로 끝났다.
       * 🔴 CTO 는 GO/HOLD/NO-GO 를 **정하지 않는다**(CPO 몫) — 재료만 적는다.
       */
      const verdict =
        diffHeld.length > 0 ? "🔴 방어 동반" : sameLost.length > 0 ? "🟡 방어 0" : "-";
      /**
       * 🔴 **1차 출력이 두 집합의 판매처를 «합쳐» 찍었다** ⟹ 「MODEL_CODE 가 막는
       *    DIFFERENT 가 **어느 것인지**」를 알 수 없었다. 그 1건이 GO/NO-GO 를 가르는
       *    값이라 **갈라서** 적는다.
       */
      console.log(
        `   ${pad(axis, 24)}${pad(String(sameLost.length), 11)}${pad(String(diffHeld.length), 11)}${pad(verdict, 12)}`,
      );
      if (sameLost.length > 0) console.log(`      SAME 손실 → ${sameLost.map((r) => r.domain).join(" · ")}`);
      if (diffHeld.length > 0) console.log(`      🔴 DIFF 방어 → ${diffHeld.map((r) => r.domain).join(" · ")}`);
    }

    /* ═══════════ STEP C — 축별 «진단» 증거 (CPO P0~P3) ═══════════ */
    console.log(`\n════════ STEP C — 축별 진단 증거 (🔴 완화 0 · threshold 0) ════════`);
    const pick = (o: Record<string, unknown> | undefined, ...keys: string[]) => {
      if (!o) return "(후보 객체 없음)";
      const out: string[] = [];
      for (const k of keys) {
        const v = k.split(".").reduce<unknown>((a, s) => (a as Record<string, unknown>)?.[s], o);
        if (v != null && v !== "") out.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
      return out.join(" · ") || "(전부 비어 있다)";
    };

    for (const { p, table, rawByUrl, shopCandidates, shopGate } of results) {
      for (const r of table.filter((x) => x.human === "SAME" && !x.inComparison)) {
        const raw = rawByUrl.get(loose(r.url));
        console.log(`\n   ── ${p.code} · ${r.domain} · 축 **${r.axis}**`);
        switch (r.axis) {
          case "MODEL_CODE":
            /** 🔴 P0 — 「실제 식별 실패인가, 정상 방어인가」. **두 품번을 나란히** 적는다. */
            console.log(`      원상품 품번 = ${results.find((x) => x.p === p)!.dna.brandModelCode}`);
            console.log(`      후보   ${pick(raw, "facts.brandModelCode", "sku", "title")}`);
            break;
          case "NO_BLOCKER":
            /** 🔴 P1 — 「threshold 가 아니라 **판정 경로의 표현력**」인지 본다. */
            console.log(`      verdict=${String(raw?.crossSellerVerdict)} · blockers **0**`);
            console.log(`      맞은 축 = ${JSON.stringify(raw?.crossSellerReasons ?? raw?.matchReasons ?? null)}`);
            console.log(`      후보 ${pick(raw, "facts.brandModelCode", "facts.colorText", "facts.brand")}`);
            break;
          case "AUDIENCE_LINE":
            console.log(`      ${pick(raw, "title", "facts.brandModelCode")}`);
            console.log(`      축 근거 = ${JSON.stringify(raw?.crossSellerReasons ?? null)}`);
            break;
          case "SHOP_GATE":
            /** 🔴 P2 — MI 가 아니라 **그 앞단** 이다. 게이트가 본 입력을 적는다. */
            console.log(`      게이트 사유 = ${shopGate.get(bare(r.domain)) ?? "?"}`);
            console.log(
              `      그 샵 후보 ${shopCandidates.get(bare(r.domain))?.length ?? 0}건 · top matchLevel = ` +
                `${String((shopCandidates.get(bare(r.domain))?.[0] as Record<string, unknown> | undefined)?.matchLevel)}`,
            );
            break;
          case "SHOP_REP": {
            const cands = shopCandidates.get(bare(r.domain)) ?? [];
            console.log(`      그 샵 후보 ${cands.length}건 — 대표가 «다른» 후보로 뽑혔다`);
            cands.slice(0, 4).forEach((c, i) =>
              console.log(
                `        #${i} ${pick(c, "url", "crossSellerVerdict", "confidence")}` +
                  `${loose(String(c.url)) === loose(r.url) ? "   ← human SAME 인 그 후보" : ""}`,
              ),
            );
            break;
          }
          case "BRAND_UNCONFIRMED":
          case "BRAND_MISMATCH+TITLE":
            /** 🔴 P2/P3 — WU-134 복구가 **왜 발화하지 않았는지** 만 본다(재개발 금지). */
            console.log(`      원상품 brand = ${JSON.stringify(results.find((x) => x.p === p)!.dna.brand)}`);
            console.log(`      후보   ${pick(raw, "facts.brand", "title")}`);
            break;
          default:
            console.log(`      ${r.lostAt}`);
            console.log(`      ${pick(raw, "crossSellerVerdict", "facts.brandModelCode", "facts.brand")}`);
        }
      }
    }

    /* ═══════ STEP C-2 — 🔴 «방어 동반» 축이 막는 DIFFERENT 의 증거 ═══════ */
    console.log(`\n════════ STEP C-2 — 🔴 그 축이 막는 human DIFFERENT (GO/NO-GO 를 가르는 값) ════════`);
    /**
     * 🔴🔴 **이것 없이는 CPO 가 판정할 수 없다.** 「축을 풀면 SAME +N」만 보면 전부
     *    GO 로 보인다 — 이 트랙이 여덟 번 그렇게 측정하고 전부 **순손실** 로 끝났다.
     * 🔴 특히 `junioredition.com` 은 **SAME 1건과 DIFFERENT 1건을 같이** 갖고 있어
     *    같은 축을 풀면 **둘이 동시에 열린다.** 그 둘이 구별 가능한지가 핵심이다.
     */
    for (const { p, table, rawByUrl } of results) {
      for (const r of table.filter((x) => x.human === "DIFFERENT" && x.axis && x.axis !== "NO_CANDIDATE")) {
        console.log(`\n   ── ${p.code} · ${r.domain} · 막은 축 **${r.axis}** · tier ${r.displayTier ?? "-"}`);
        console.log(
          `      ${pick(rawByUrl.get(loose(r.url)), "title", "facts.brandModelCode", "facts.colorText", "facts.brand")}`,
        );
        console.log(`      축 근거 = ${JSON.stringify(rawByUrl.get(loose(r.url))?.crossSellerReasons ?? null)}`);
      }
    }

    /* ══════════ ⑤ 전략 Gate 분류용 — 1차 화면에 설 자격이 있는 값 ══════════ */
    console.log(`\n════════ ⑤ 전략 Gate — ①MI판단 / ②시장가격참고(SAME만) / ③셀러행동 ════════`);
    for (const { p, judgement, rows } of results) {
      const os = buildPriceGuide(judgement, "OVERSEAS");
      const kr = buildPriceGuide(judgement, "KR");
      const linkNeeded = judgement.sellers.filter((s) => s.price == null).length;
      console.log(
        `   ${pad(p.code, 12)} ① SAME ${kr.sameCount + os.sameCount}곳 · ` +
          `② 가격확인 ${kr.pricedCount + os.pricedCount}곳 · ` +
          `③ 가격확인필요(🔗) ${linkNeeded}곳 · (원자료 후보 ${rows.length}행)`,
      );
    }

    /** 🔴 **측정이 돌았다** 는 것만 단언한다 — 숫자를 기대값으로 박지 않는다(이것은 측정이다). */
    expect(results).toHaveLength(2);
    for (const r of results) expect(r.gt.length).toBeGreaterThan(0);
  }, 600_000);
});
