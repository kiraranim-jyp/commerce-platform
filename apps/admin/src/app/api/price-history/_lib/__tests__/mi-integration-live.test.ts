import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
/** 🔴 8단계가 아니다 — `__tests__ → _lib → price-history → api → app` 넷이다(계산해 확인했다). */
import { splitEvidenceReasons } from "../../../../pipeline/commerce/blocker-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-INTEGRATION — **B/C 축을 «운영 러너로» 직접 잰다**(CPO 지시 2026-11-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO: 「정상 운영 분석 1회를 **기다리는 동안** 나머지 작업을 중단하지 마십시오」.
 *    그래서 기다리지 않고 **운영 러너를 직접 부른다** — `runDomesticPriceCheck` 가
 *    `query` 를 **스스로 만들고** `withConfidence` · `judgeDomesticCandidate` 를
 *    **스스로 부른다** ⟹ 🟢 **수작업 판정이 구조적으로 불가능** 하다(CPO 금지 준수).
 *
 * ── 🔴🔴 입력을 «어디서» 얻었는지가 이 하니스의 정당성이다 ──────────────────
 * ```
 * 🇰🇷 국내  `collectDomesticListingUrls`(운영 목록 hop)가 **실제로 발견한** 상세 URL
 * 🌎 해외  운영 `OVERSEAS_AUTO` 가 **실제로 발견한** 후보 URL(최근 스냅샷 전수)
 * 🔴 **CTO 가 URL 을 고르거나 지어내지 않았다** · 🔴 과거 verdict/price 는 **안 가져왔다**
 *    (판정은 이번 실행에서 운영이 **처음부터 다시** 낸다 — 그것이 CPO §2 「재확인」이다)
 * ```
 * 🔴 `candidateUrls` 주입은 **공급을 증명하는 용도가 아니다**(그것은 DOMESTIC-FUNNEL 이
 *    이미 쟀다). 여기서 재는 것은 **그 뒤** — 판정 · 가격 · 시장 · Evidence 다.
 *
 * 🔴 게이트 `MI_INTEGRATION=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴 입력은 `packages/database/scripts/domestic-funnel-dump.mjs` 가 만든다.
 */

const LIVE = process.env.MI_INTEGRATION === "1";
const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "domestic-funnel-input.json");

interface SourceRow {
  domain: string;
  url: string | null;
  priority: string;
  source_type: string | null;
  collection_strategy: string | null;
}
interface Dump {
  sources: SourceRow[];
  snapshots: { id: string; source_url: string; title: string | null }[];
  overseasCandidateUrls: string[];
  overseasSnapshot: { id: string; source_url: string; title: string | null } | null;
}
const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

/** 🔴 운영 러너 산출의 **읽는 칸만** 옮긴 모양이다(칸 이름을 추측하지 않는다). */
interface EvRow {
  domain: string;
  title: string;
  market: string | null;
  crossSellerVerdict: string | null;
  matchTruth: string | null;
  priceTier: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceStatus: string | null;
  matchReasons?: string[];
  crossSellerBlockers?: string[];
  source?: string | null;
}

describe("MI-INTEGRATION — 국내/해외 축을 운영 러너로 재확인", () => {
  it.runIf(LIVE)(
    "🔴 후보 → 판정 → 가격 → 시장 → Evidence 를 두 시장에서 «운영 함수로» 센다",
    async () => {
      expect(existsSync(DUMP), `🔴 입력 덤프가 없다: ${DUMP}`).toBe(true);
      const dump = JSON.parse(readFileSync(DUMP, "utf8")) as Dump;

      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { lookupBrandAlias } = await import("@commerce/crawler");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { collectDomesticListingUrls, isListingHopTarget, MAX_LISTING_HOP_SITES } =
        await import("../domestic-listing-pool");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");

      /* eslint-disable no-console */
      /** 🟢 원상품 하나를 운영 추출 경로로 만든다(둘 다 같은 방식). */
      const originOf = async (sourceUrl: string) => {
        const extracted = await shopifySiteStrategy.extract(sourceUrl);
        expect(extracted, `🔴 원상품 추출 실패(열화) — ${sourceUrl}`).toBeTruthy();
        const product = buildCanonicalProduct(
          sourceUrl,
          extracted!.productData as never,
          {} as never,
          [],
        );
        return { product, dna: buildProductIdentityDna(product) };
      };

      /**
       * 🔴🔴 운영 러너를 **라우트와 같은 인자 모양** 으로 부른다.
       *    🔴 `webSearch`/`domesticListingHop` 은 **끈다** — 이 측정의 목적은 공급이
       *       아니라 **판정/가격** 이고, 켜면 과금(Search)과 중복 HTTP 가 생긴다.
       *       🟢 공급은 DOMESTIC-FUNNEL 이 이미 쟀다(상한 21 · visited 21).
       */
      const judge = async (
        snapshotId: string,
        dna: unknown,
        description: string | undefined,
        urls: string[],
      ): Promise<EvRow[]> => {
        const run = (await runDomesticPriceCheck({
          snapshotId,
          workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756",
          dna,
          description,
          candidateUrls: urls,
          webSearch: false,
          domesticListingHop: false,
        } as never)) as unknown as Record<string, unknown>;
        return ((run.urlCandidateEvidence as EvRow[] | null) ?? []).slice();
      };

      const show = (label: string, rows: EvRow[]) => {
        console.log(`\n──── ${label} — 후보 ${rows.length}건 ────`);
        console.log(
          `  ${pad("domain", 24)} ${pad("market", 9)} ${pad("verdict", 15)} ` +
            `${pad("tier", 11)} ${pad("price", 13)} priceStatus`,
        );
        for (const x of rows)
          console.log(
            `  ${pad(x.domain, 24)} ${pad(x.market, 9)} ${pad(x.crossSellerVerdict, 15)} ` +
              `${pad(x.priceTier, 11)} ` +
              `${pad(x.priceAmount == null ? "-" : `${x.priceAmount} ${x.priceCurrency ?? ""}`, 13)} ` +
              `${x.priceStatus ?? "-"}`,
          );
      };

      /* ══════════════ 🇰🇷 국내 — 운영 목록 hop 이 «발견한» URL 로 ══════════════ */
      /**
       * 🔵 **MLS2 FALLBACK(CPO 결정 2026-11-06)** — 파일럿 원상품을 **고를 수 있게** 한다.
       *
       * 🔴 왜: `bobochoses.com` 이 **간헐적 HTTP 429** 를 내서 특정 상품에서 원상품 추출이
       *    실패했다(실측 — 같은 호스트에서 요청마다 200/429 가 갈린다). 그때 이 하니스가
       *    **`snapshots[0]` 하나에 고정** 돼 있어 **전체 검증이 한 URL 에 종속** 됐다.
       *    ⟹ CPO: 「한 사이트가 막혀도 다른 상품으로 검증을 계속할 수 있어야 한다」.
       * 🟢 기본값은 **종전과 같다**(`snapshots[0]`) — 지정하지 않으면 동작 불변이다.
       * 🔴 429 를 **우회하지 않는다** — 대상을 바꾸는 것뿐이다(UA 변조 · 프록시 · 재시도 루프 0).
       */
      const want = process.env.MI_ORIGIN_CODE?.trim().toLowerCase();
      const picked = want ? dump.snapshots.find((s) => s.source_url.toLowerCase().includes(want)) : null;
      const krSnap = picked ?? dump.snapshots[0];
      if (want) {
        /** 🔴 지정이 **빗나갔으면 그 사실을 적는다** — 조용히 다른 상품을 재지 않는다. */
        console.log(`[MI-pilot] MI_ORIGIN_CODE=${want} → ${krSnap.source_url}${picked ? "" : "  🔴 덤프에 없어 기본값"}`);
      }
      const kr = await originOf(krSnap.source_url);
      console.log(
        `\n[MI-origin-KR] ${String(krSnap.id).slice(0, 8)} brand="${kr.dna.brand.value}" code=${kr.dna.brandModelCode}`,
      );
      const hopSites = dump.sources
        .filter((s) => isListingHopTarget({ sourceType: s.source_type }))
        .filter((s) => s.url && /^https?:\/\//i.test(s.url))
        .sort((a, b) => a.priority.localeCompare(b.priority) || a.domain.localeCompare(b.domain))
        .map((s) => ({ domain: s.domain, entryUrl: s.url as string }));
      const brandTerms = [
        kr.dna.brand.value,
        lookupBrandAlias(kr.dna.brand.value || undefined),
      ].filter((t): t is string => typeof t === "string" && t.trim().length > 0);
      const listing = await collectDomesticListingUrls({
        sites: hopSites,
        code: kr.dna.brandModelCode,
        brandTerms,
        maxSites: MAX_LISTING_HOP_SITES,
      });
      console.log(
        `[MI-supply-KR] 목록hop 대상 ${hopSites.length} · visited ${listing.metrics.visitedSites} ` +
          `· 상세URL ${listing.metrics.detailUrls} · 잘림 [${listing.metrics.skippedOverLimit}]`,
      );
      /** 🔴🔴 열화 게이트 — 공급이 0 이면 **측정을 거부한다**(0 을 제품 사실로 쓰지 않는다). */
      expect(
        listing.urls.length,
        "🔴 국내 상세 URL 0 — 측정불가(공급 쪽을 먼저 본다 · DOMESTIC-FUNNEL)",
      ).toBeGreaterThan(0);
      const krRows = await judge(
        krSnap.id,
        kr.dna,
        kr.product.description.value || undefined,
        listing.urls.slice(),
      );
      show("🇰🇷 국내", krRows);

      /* ══════════════ 🌎 해외 — 운영 OVERSEAS_AUTO 가 «발견한» URL 로 ══════════ */
      expect(dump.overseasSnapshot, "🔴 해외 원상품이 덤프에 없다").toBeTruthy();
      const osSnapInfo = dump.overseasSnapshot!;
      const os = await originOf(osSnapInfo.source_url);
      console.log(
        `\n[MI-origin-OS] ${String(osSnapInfo.id).slice(0, 8)} brand="${os.dna.brand.value}" code=${os.dna.brandModelCode}`,
      );
      expect(
        dump.overseasCandidateUrls.length,
        "🔴 해외 후보 URL 0 — 측정불가",
      ).toBeGreaterThan(0);
      const osRows = await judge(
        osSnapInfo.id,
        os.dna,
        os.product.description.value || undefined,
        dump.overseasCandidateUrls.slice(),
      );
      show("🌎 해외", osRows);

      /* ══════════════ CPO 완료 기준 — 축별로 «갈라» 적는다 ═══════════════════ */
      const cut = (rows: EvRow[], market: string) => {
        const m = rows.filter((x) => x.market === market);
        const sp = m.filter(
          (x) => x.crossSellerVerdict === "SAME" || x.crossSellerVerdict === "PRESUMED_SAME",
        );
        return {
          후보: rows.length,
          [`market=${market}`]: m.length,
          "SAME/PRESUMED": sp.length,
          "가격 보유": sp.filter((x) => x.priceAmount != null).length,
          "tier 자격": sp.filter((x) => x.priceTier === "EXACT" || x.priceTier === "COMPARISON")
            .length,
        };
      };
      console.log("\n════ CPO 완료 기준 — 실측 ════");
      console.log("  🇰🇷 국내 ", JSON.stringify(cut(krRows, "KR")));
      console.log("  🌎 해외 ", JSON.stringify(cut(osRows, "OVERSEAS")));

      /* ══════════════ Evidence — 실제 데이터로 «분리» 를 확인한다(CPO §3) ═════ */
      const all = [...krRows, ...osRows];
      let withAgree = 0;
      let withHold = 0;
      let empty = 0;
      console.log("\n──── Evidence 상세(실제 데이터) ────");
      for (const x of all) {
        const s = splitEvidenceReasons(x.matchReasons);
        if (s.agree.length > 0) withAgree += 1;
        if (s.hold.length > 0) withHold += 1;
        if (s.agree.length === 0 && s.hold.length === 0) empty += 1;
        console.log(`  ${pad(x.domain, 24)}`);
        console.log(`     같다고 본 점      — ${s.agree.join(" · ") || "(없음)"}`);
        console.log(`     다른 점·확인 필요 — ${s.hold.join(" · ") || "(없음)"}`);
      }
      console.log(
        `\n  Evidence 분리 — 일치 근거 보유 ${withAgree}/${all.length} · ` +
          `불일치 근거 보유 ${withHold}/${all.length} · 둘 다 없음 ${empty}/${all.length}`,
      );
      /**
       * 🔴🔴 **내부 진단이 셀러 근거로 새지 않는다** — 실제 데이터 전수로 단언한다.
       *    (구조 테스트는 고정 문자열로 봤다. 여기는 **운영이 방금 만든 문자열** 이다.)
       */
      const leaked: string[] = [];
      for (const x of all) {
        const s = splitEvidenceReasons(x.matchReasons);
        for (const line of [...s.agree, ...s.hold]) {
          for (const banned of [
            "CROSS_SELLER_AXES",
            "판정방법",
            "판정근거",
            "모델명 유사도",
            "텍스트등급",
            "TEXT_CONFIRMED",
            "EXACT_IDENTIFIER",
            "INSUFFICIENT_EVIDENCE",
          ]) {
            if (line.includes(banned)) leaked.push(`${x.domain}: ${line}`);
          }
        }
      }
      if (leaked.length > 0) console.log("\n🔴 누출:", JSON.stringify(leaked, null, 1));
      expect(leaked, "🔴🔴 내부 진단이 셀러 Evidence 로 새어 나갔다").toEqual([]);
      /* eslint-enable no-console */

      /**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵 **실제 행을 화면 축으로 넘긴다**(CPO §4) — 덤프 하나로 잇는다
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **이 파일에 jsdom 을 붙이지 않는다.** 라이브 fetch 하니스에
       *    `@vitest-environment jsdom` 을 붙였다가 **전건 UNREACHABLE** 이 난 전례가
       *    있다(메모 그 함정). 🟢 그래서 **덤프 → 별 파일**(저장소의 기존 패턴)로 잇는다.
       */
      const outFile = path.join(path.dirname(DUMP), "mi-integration-rows.json");
      writeFileSync(
        outFile,
        JSON.stringify({ at: new Date().toISOString(), kr: krRows, overseas: osRows }, null, 1),
        "utf8",
      );
      console.log(`\n🟢 화면 축 입력 덤프 → ${outFile}`);

      /** 🔴 열화 판정 — 양쪽 다 후보가 0 이면 그 실행은 **측정이 아니다**. */
      expect(
        krRows.length + osRows.length,
        "🔴 양쪽 후보가 전건 0 — 열화 가능성. 이 실행의 숫자를 제품 사실로 쓰지 않는다",
      ).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
