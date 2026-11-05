import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DOMESTIC-FUNNEL — **국내 축을 지금 «잴 수 있는 범위까지» 잰다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 가 가르라고 한 셋(A/B/C)이 이 하니스의 출력이다:
 * ```
 * A 후보는 생기는데 `market` 이 KR 로 안 붙는다        → 시장 분류 연결부
 * B KR 로 붙는데 SAME/PRESUMED 에 도달하지 않는다       → Evidence/Identity 병목 위치
 * C SAME/PRESUMED 는 되는데 가격에 도달하지 않는다      → 가격 수집/자격/저장
 * ```
 *
 * 🟢 **운영 함수만 부른다**(복제 0) — `collectDomesticListingUrls` →
 *    `collectUrlCandidatePool` → `classifyCandidateMarket`. 선별·정렬·상한도
 *    **운영 코드와 같은 함수·같은 순서** 다(`isListingHopTarget` · priority,domain).
 *
 * 🔴🔴 **측정 한계를 먼저 적는다 — 이 숫자를 전수로 읽지 않는다**
 * ```
 * ① WEB_SEARCH(SP07)는 **잴 수 없다** — `APIFY_API_TOKEN` 이 Production 전용이라
 *    로컬에서 `skipped: NOT_CONFIGURED` 다(실측). ⟹ 국내 축 중 **목록 hop 만** 잰다
 * ② 등록부의 **workspace scope/enabled 필터를 적용하지 못한다**(service-role 부재)
 *    ⟹ 공급 사이트 집합은 운영의 **상한(superset)** 이다. 「운영이 이만큼 본다」로
 *    적지 않는다
 * ③ `priceTier`/가격 자격은 `judgeDomesticCandidate`(runner 안) 소관이라 **만들지
 *    않는다** — 지어내면 WU-085 가 두 번 밟은 그 거짓이 된다 ⟹ **측정불가** 로 적는다
 * ```
 * 🔴 게이트 `DOMESTIC_FUNNEL=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴 입력은 `packages/database/scripts/domestic-funnel-dump.mjs` 가 만든다.
 */

const LIVE = process.env.DOMESTIC_FUNNEL === "1";
const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "domestic-funnel-input.json");

interface SourceRow {
  domain: string;
  url: string | null;
  priority: string;
  source_type: string | null;
  collection_strategy: string | null;
}
interface SnapRow {
  id: string;
  source_url: string;
  title: string | null;
}
const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

describe("DOMESTIC-FUNNEL — 국내 목록 hop 라이브", () => {
  it.runIf(LIVE)(
    "🔴 공급 → 상세URL → 후보 → 시장 → 판정 을 «운영 함수로» 센다",
    async () => {
      expect(existsSync(DUMP), `🔴 입력 덤프가 없다: ${DUMP}`).toBe(true);
      const dump = JSON.parse(readFileSync(DUMP, "utf8")) as {
        sources: SourceRow[];
        snapshots: SnapRow[];
      };

      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { lookupBrandAlias } = await import("@commerce/crawler");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { collectDomesticListingUrls, isListingHopTarget, MAX_LISTING_HOP_SITES } =
        await import("../domestic-listing-pool");
      const { collectUrlCandidatePool } = await import("../url-candidate-pool");
      const { classifyCandidateMarket } = await import("../candidate-market");
      const { DOMESTIC_LISTING_SHOP_ID, DOMESTIC_LISTING_SHOP_NAME } = await import(
        "../transient-candidates"
      );
      const { MAX_SUPPLIED_CANDIDATE_URLS } = await import("../run-domestic-price-check");

      /* ── ① 원상품 — 운영 추출 경로 그대로. 🔴 URL 을 지어내지 않는다 ────────── */
      const snap = dump.snapshots[0];
      expect(snap?.source_url, "🔴 원상품 스냅샷이 없다").toBeTruthy();
      const extracted = await shopifySiteStrategy.extract(snap.source_url);
      expect(extracted, "🔴 원상품 추출 실패 — 열화다. 이 실행의 숫자를 쓰지 않는다").toBeTruthy();
      const product = buildCanonicalProduct(
        snap.source_url,
        extracted!.productData as never,
        {} as never,
        [],
      );
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(
        `\n[DF-origin] ${String(snap.id).slice(0, 8)} brand="${dna.brand.value}" ` +
          `code=${dna.brandModelCode} color=${dna.color}`,
      );

      /* ── ② 공급 사이트 — 운영과 «같은 함수·같은 순서» ──────────────────────── */
      const hopSites = dump.sources
        .filter((s) => isListingHopTarget({ sourceType: s.source_type }))
        .filter((s) => s.url && /^https?:\/\//i.test(s.url))
        .sort((a, b) => a.priority.localeCompare(b.priority) || a.domain.localeCompare(b.domain))
        .map((s) => ({ domain: s.domain, entryUrl: s.url as string }));
      /** 🔴 POLICY-GATE-01 — 운영과 **같은 derivation** 이다(전략 칸에서 만든다). */
      const notAvailableDomains = new Set(
        dump.sources
          .filter((s) => s.collection_strategy === "NOT_AVAILABLE")
          .map((s) => s.domain.trim().toLowerCase())
          .filter(Boolean),
      );
      const brandTerms = [dna.brand.value, lookupBrandAlias(dna.brand.value || undefined)].filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      );
      console.log(
        `[DF-supply] 등록부 ${dump.sources.length} → 목록hop 대상 ${hopSites.length} ` +
          `(상한 ${MAX_LISTING_HOP_SITES}) · NOT_AVAILABLE ${notAvailableDomains.size} · ` +
          `brandTerms ${JSON.stringify(brandTerms)}`,
      );
      /** 🔴🔴 열화 게이트 — 입력이 비면 **측정을 거부한다**(0 을 사실로 쓰지 않는다). */
      expect(hopSites.length, "🔴 공급 사이트 0 — 측정불가(덤프/필터를 먼저 본다)").toBeGreaterThan(0);
      expect(brandTerms.length, "🔴 브랜드 표기 0 — 목록 hop 이 돌 수 없다").toBeGreaterThan(0);

      /* ── ③ 목록 hop — 운영 함수 ───────────────────────────────────────────── */
      const pool = await collectDomesticListingUrls({
        sites: hopSites,
        code: dna.brandModelCode,
        brandTerms,
        maxSites: MAX_LISTING_HOP_SITES,
      });
      const m = pool.metrics;
      console.log(
        `[DF-listing] supplied=${m.suppliedSites} visited=${m.visitedSites} ` +
          `skippedOverLimit=${m.skippedOverLimit} http=${m.httpCalls} detailUrls=${m.detailUrls}`,
      );
      for (const o of m.outcomes)
        console.log(`  · ${pad(o.domain, 26)} src=${pad(o.source, 14)} urls=${o.detailUrls.length} ${o.note ?? ""}`);

      /* ── ④ 후보 생성 — 운영 함수 ──────────────────────────────────────────── */
      const cand = await collectUrlCandidatePool({
        urls: pool.urls,
        originUrl: snap.source_url,
        maxUrls: MAX_SUPPLIED_CANDIDATE_URLS,
        existingCanonicalUrls: new Set<string>(),
        notAvailableDomains,
        shopId: DOMESTIC_LISTING_SHOP_ID,
        shopNamePrefix: DOMESTIC_LISTING_SHOP_NAME,
      });
      const cm = cand.metrics;
      console.log(
        `[DF-candidate] supplied=${cm.suppliedUrls} accepted=${cm.acceptedUrls} ` +
          `usable=${cm.usableProductUrls} miEligible=${cm.miEligibleCandidates} fetch=${cm.fetchCalls}`,
      );
      for (const d of cm.dropped.slice(0, 20)) console.log(`  ✗ ${JSON.stringify(d)}`);

      /* ── ⑤ 시장 — 운영 산출을 «그대로» 읽는다 ─────────────────────────────── */
      /**
       * 🔴🔴 **칸 이름을 추측하지 않는다.** 1차 실행에서 `c.currency` 를 읽어
       *    `[object Obje` 가 찍혔다 — 실제 타입은 `price: {amount, currency} | null`
       *    (`ComparisonCandidate`)이고, 그 결과 `classifyCandidateMarket` 이
       *    **통화 null** 을 받아 전건 `NO_PRICE_EVIDENCE` 가 됐다. 🔴 그대로
       *    보고했으면 「국내 후보의 시장이 확정되지 않는다」는 **거짓 결론** 이었다.
       * 🟢 아래 세 줄은 운영 호출부(`run-domestic-price-check.ts:2126~2136`)와
       *    **글자 그대로 같은 읽기** 다.
       */
      const registeredDomains = new Set(
        dump.sources.map((s) => s.domain.trim().toLowerCase()).filter(Boolean),
      );
      const rows = cand.searchResults.flatMap((r) =>
        r.candidates.map((c) => {
          const market = classifyCandidateMarket({
            domain: r.domain,
            currency: c.price?.currency ?? null,
            isRegisteredDomesticShop: registeredDomains.has(r.domain.trim().toLowerCase()),
            marketEvidence: (c as { marketEvidence?: never }).marketEvidence ?? null,
          });
          return {
            domain: r.domain,
            title: String(c.title ?? "").slice(0, 34),
            market: market.market,
            basis: market.basis,
            amount: c.price?.amount ?? null,
            currency: c.price?.currency ?? null,
            /** 🔴 pool 경계에서는 **점수가 매겨지지 않았다**(아래 B 축 주석). */
            matchLevel: c.matchLevel ?? null,
          };
        }),
      );
      console.log(`\n──── 후보 전수 ${rows.length}건 ────`);
      console.log(`  ${pad("domain", 26)} ${pad("market", 9)} ${pad("price", 14)} basis`);
      for (const x of rows)
        console.log(
          `  ${pad(x.domain, 26)} ${pad(x.market, 9)} ` +
            `${pad(x.amount == null ? "-" : `${x.amount} ${x.currency ?? ""}`, 14)} ${x.basis}`,
        );

      const kr = rows.filter((x) => x.market === "KR");
      console.log("\n════ CPO A/B/C 삼분 ════");
      console.log(`  후보 생성            ${rows.length}`);
      console.log(`  🇰🇷 market=KR         ${kr.length}        ← A`);
      console.log(`  🇰🇷 그중 가격 보유      ${kr.filter((x) => x.amount != null).length}        ← C 재료`);
      console.log(`  🌎 market=OVERSEAS   ${rows.filter((x) => x.market === "OVERSEAS").length}`);
      console.log(`  ❔ UNKNOWN           ${rows.filter((x) => x.market === "UNKNOWN").length}`);
      /**
       * 🔴🔴 **B 축(SAME/PRESUMED)은 이 층에서 측정불가다 — 0 으로 적지 않는다.**
       *    `collectUrlCandidatePool` 은 **점수를 매기지 않는다**(그 파일 머리 주석:
       *    「`withConfidence` 는 호출부가 배열 단위 1회 부른다」) ⟹ 이 경계의 후보에는
       *    `crossSellerVerdict`/`matchLevel` 이 **아직 없다**.
       * 🔴 그래서 `withConfidence` 를 여기서 부르지 **않았다** — 그 함수는 운영
       *    `query`(title·brand·sku·searchTerm·searchTerms·facts)를 받고, 그 중 일부만
       *    손으로 지어 넣으면 **운영과 다른 verdict** 가 나온다. 그 숫자를 B 축이라고
       *    적는 것이 이 트랙이 반복해 틀린 바로 그 행위다.
       * 🟢 B 축은 **배포된 `workspace.searchRun.funnel`** 이 운영 실행에서 낸다.
       */
      console.log("\n🔴 B 축(🇰🇷 SAME/PRESUMED) = **측정불가** — pool 경계는 점수를 매기지 않는다.");
      console.log("   🟢 B 축은 운영 실행의 `workspace.searchRun.funnel` 로 읽는다.");
      console.log("🔴 `priceTier`/가격 «자격» 도 측정불가 — `judgeDomesticCandidate` 는 runner 안이다.");
      console.log("🔴 WEB_SEARCH(SP07) 축은 로컬에서 측정불가 — 위 숫자는 **목록 hop 만** 이다.");
      /* eslint-enable no-console */

      /** 🔴🔴 열화 판정 — 상세 URL 도 후보도 0 이면 그 실행은 **측정이 아니다**. */
      expect(
        m.detailUrls + rows.length,
        "🔴 상세URL·후보가 전건 0 — 열화 가능성. 이 실행의 숫자를 제품 사실로 쓰지 않는다",
      ).toBeGreaterThan(0);
    },
    900_000,
  );
});
