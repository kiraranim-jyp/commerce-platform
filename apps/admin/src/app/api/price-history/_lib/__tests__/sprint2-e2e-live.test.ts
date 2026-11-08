import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 2 E2E — **URL 입력 → 국내외 후보 → 판정 → 가격** 을 상품 여섯에서 잰다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 가 볼 셋을 그대로 출력한다 — **발견력 · 비교력 · 실용성(가격 자격)**.
 *
 * 🟢 **운영 함수만 쓴다**(복제 0):
 * ```
 * 원상품   universalExtract → buildCanonicalProduct → buildProductIdentityDna
 * query    운영 러너와 **같은 네 줄**(stripLeadingDevTag · buildCrossSellerSearchQueries ·
 *          productFactsFromIdentityDna) — 🔴 계약이 그 네 줄의 동일성을 단언한다
 * 🌎 발견  collectOverseasAutoPool(`listShops` **주입구** — 그 파일이 「테스트/측정용
 *          주입구」라고 명시한 자리 · 활성/접근/scope 필터는 **운영 그대로**)
 * 🇰🇷 발견  collectDomesticListingUrls(운영 선별·정렬·상한 그대로)
 * 판정/가격 runDomesticPriceCheck(candidateUrls) — 러너가 `withConfidence` ·
 *          `judgeDomesticCandidate` 를 **스스로** 부른다 ⟹ 수작업 판정 불가
 * 자격     summarizeCandidateOverseasPrices — 🔴 tier 로 추론하지 않는다(그 오독을 했다)
 * ```
 *
 * 🔴🔴 **측정 한계를 먼저 적는다 — 이 숫자를 운영 전수로 읽지 않는다**
 * ```
 * ① **WEB_SEARCH(SP07)는 로컬에서 측정불가** — `APIFY_API_TOKEN` 이 Production 전용이다.
 *    ⟹ 🔴 국내 발견력에서 **가장 큰 생산자가 빠진 값** 이다(운영 funnel 이 그 축을 들고 있다)
 * ② 등록부는 **덤프로 주입** 한다 — workspace scope/enabled 머지를 적용하지 못하므로
 *    공급 집합은 운영의 **상한(superset)** 이다
 * ③ 해외 후보는 pool 산출 URL 을 러너에 **candidateUrls 로** 넣어 판정한다 ⟹ 산출물의
 *    **출처 배지가 `SELLER_URL` 로 보인다**(운영은 `OVERSEAS_AUTO`). 🔴 판정·가격은 같다
 * ```
 * 🔴 게이트 `SPRINT2_E2E=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */

const LIVE = process.env.SPRINT2_E2E === "1";
const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "sprint2-e2e-input.json");

interface Shop {
  id: string;
  name: string;
  domain: string;
  url: string;
  currency: string | null;
  categoryScope: string[];
  accessStatus: string | null;
  isActive: boolean;
}
interface Src {
  domain: string;
  url: string | null;
  priority: string;
  source_type: string | null;
  collection_strategy: string | null;
}
interface Sample {
  host: string;
  id: string;
  source_url: string;
  title: string | null;
  brand: string | null;
}
interface Ev {
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
}

const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";

describe("SPRINT 2 E2E — URL → 국내외 후보 → 판정 → 가격", () => {
  it.runIf(LIVE)(
    "🔴 상품 여섯에서 발견력·비교력·가격 자격을 «운영 함수로» 센다",
    async () => {
      expect(existsSync(DUMP), `🔴 입력 덤프가 없다: ${DUMP}`).toBe(true);
      const dump = JSON.parse(readFileSync(DUMP, "utf8")) as {
        overseasShops: Shop[];
        domesticSources: Src[];
        samples: Sample[];
      };

      const { universalExtract, lookupBrandAlias, originFactsFromIdentityDna } = await import("@commerce/crawler");
      const { buildProductIdentityDna, buildCrossSellerSearchQueries } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { collectOverseasAutoPool } = await import("../overseas-auto-pool");
      const { collectDomesticListingUrls, isListingHopTarget, MAX_LISTING_HOP_SITES } = await import(
        "../domestic-listing-pool"
      );
      /** 🟢 `stripLeadingDevTag` 는 **운영 러너의 owner** 다 — 복제하지 않는다. */
      const { runDomesticPriceCheck, stripLeadingDevTag } = await import("../run-domestic-price-check");
      const { summarizeCandidateOverseasPrices } = await import("../candidate-market");
      const { splitEvidenceReasons } = await import("../../../../pipeline/commerce/blocker-text");

      /* eslint-disable no-console */
      /** 🟢 국내 목록 hop 대상 — 운영 선별·정렬 그대로(한 번만 만든다). */
      const hopSites = dump.domesticSources
        .filter((s) => isListingHopTarget({ sourceType: s.source_type }))
        .filter((s) => s.url && /^https?:\/\//i.test(s.url))
        .sort((a, b) => a.priority.localeCompare(b.priority) || a.domain.localeCompare(b.domain))
        .map((s) => ({ domain: s.domain, entryUrl: s.url as string }));
      const notAvailableDomains = new Set(
        dump.domesticSources
          .filter((s) => s.collection_strategy === "NOT_AVAILABLE")
          .map((s) => s.domain.trim().toLowerCase())
          .filter(Boolean),
      );

      const table: Record<string, unknown>[] = [];
      const rowsDump: Record<string, unknown>[] = [];

      for (const sample of dump.samples) {
        console.log(`\n${"═".repeat(78)}\n■ ${sample.host}  ${String(sample.id).slice(0, 8)}  ${sample.title ?? "-"}`);
        const rec: Record<string, unknown> = { host: sample.host, snapshot: String(sample.id).slice(0, 8) };

        /* ── ① 원상품 — 운영 추출 경로 ──────────────────────────────────── */
        let dna: Record<string, unknown> | null = null;
        let descr: string | undefined;
        try {
          const ex = await universalExtract(sample.source_url, { debug: false } as never);
          if (!ex || !(ex as { productData?: unknown }).productData) throw new Error("NO_PRODUCT_DATA");
          const e = ex as { productData: unknown; productDataSources?: unknown };
          const product = buildCanonicalProduct(
            sample.source_url,
            e.productData as never,
            (e.productDataSources ?? {}) as never,
            [],
          );
          dna = buildProductIdentityDna(product) as unknown as Record<string, unknown>;
          descr = (product as { description?: { value?: string } }).description?.value || undefined;
        } catch (err) {
          rec["원상품 추출"] = `FAIL(${err instanceof Error ? err.message.slice(0, 40) : "?"})`;
          console.log(`  🔴 원상품 추출 FAIL — ${rec["원상품 추출"]}`);
          table.push(rec);
          continue;
        }
        const brandVal = (dna.brand as { value?: string } | undefined)?.value ?? "";
        const code = (dna.brandModelCode as string | null) ?? null;
        rec["원상품 추출"] = "PASS";
        rec["brand"] = brandVal || "(없음)";
        rec["품번"] = code ?? "(없음)";
        console.log(`  🟢 원상품 brand="${brandVal}" code=${code ?? "null"} color=${String(dna.color ?? "null")}`);

        /**
         * 🔴🔴 `query` — **운영 러너와 같은 네 줄** 이다(run-domestic-price-check.ts:1125~1141).
         *    🔴 손으로 로직을 만들지 않는다 — 전부 운영 함수 산출의 조립이다.
         *    🟢 계약 `sprint2-query-parity` 가 그 네 줄의 동일성을 단언한다.
         */
        const searchTitle = stripLeadingDevTag(dna.title as string);
        const ident = dna.identifier as { tier?: string; value?: string } | undefined;
        const sku = ident?.tier === "SKU" ? ident.value : undefined;
        const searchTerms = buildCrossSellerSearchQueries(dna as never).map(stripLeadingDevTag).filter(Boolean);
        const searchTerm = searchTerms[0] ?? searchTitle;
        const query = {
          title: searchTitle,
          brand: brandVal || undefined,
          sourceUrl: dna.sourceUrl as string,
          sku,
          searchTerm,
          searchTerms,
          facts: originFactsFromIdentityDna(dna as never),
        };

        /* ── ② 🌎 해외 발견 — 운영 pool · listShops 주입 ─────────────────── */
        let osUrls: string[] = [];
        try {
          const os = await collectOverseasAutoPool({
            query: query as never,
            categoryScopes: null,
            listShops: (async () => dump.overseasShops) as never,
          } as never);
          const m = os.metrics;
          osUrls = os.searchResults.flatMap((r) => r.candidates.map((c) => c.url));
          rec["🌎 발견"] = osUrls.length;
          console.log(
            `  🌎 해외 — 등록부 ${m.registrySources} · 자격 ${m.eligibleShops} · ` +
              `후보 ${m.candidates} · outcomes ${JSON.stringify(m.outcomes)}`,
          );
        } catch (err) {
          rec["🌎 발견"] = `ERR(${err instanceof Error ? err.message.slice(0, 30) : "?"})`;
        }

        /* ── ③ 🇰🇷 국내 발견 — 운영 목록 hop ────────────────────────────── */
        let krUrls: string[] = [];
        const brandTerms = [brandVal, lookupBrandAlias(brandVal || undefined)].filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        );
        if (brandTerms.length === 0) {
          rec["🇰🇷 발견"] = "측정불가(브랜드 표기 0)";
        } else {
          try {
            const kr = await collectDomesticListingUrls({
              sites: hopSites,
              code,
              brandTerms,
              maxSites: MAX_LISTING_HOP_SITES,
            });
            krUrls = kr.urls.slice();
            rec["🇰🇷 발견"] = krUrls.length;
            console.log(
              `  🇰🇷 국내 — 대상 ${kr.metrics.suppliedSites} · visited ${kr.metrics.visitedSites} · ` +
                `상세URL ${kr.metrics.detailUrls} · http ${kr.metrics.httpCalls}`,
            );
          } catch (err) {
            rec["🇰🇷 발견"] = `ERR(${err instanceof Error ? err.message.slice(0, 30) : "?"})`;
          }
        }
        rec["🇰🇷 WEB_SEARCH"] = "측정불가(APIFY Production 전용)";

        /* ── ④ 판정 + 가격 — 운영 러너 ───────────────────────────────────── */
        const all = [...krUrls, ...osUrls];
        if (all.length === 0) {
          rec["판정"] = "후보 0";
          console.log("  🔴 후보 0 — 판정 단계에 들어갈 입력이 없다(「실패」가 아니라 공급 0)");
          table.push(rec);
          continue;
        }
        let ev: Ev[] = [];
        try {
          const run = (await runDomesticPriceCheck({
            snapshotId: sample.id,
            workspaceId: WORKSPACE,
            dna,
            description: descr,
            candidateUrls: all.slice(0, 40),
            webSearch: false,
            domesticListingHop: false,
          } as never)) as unknown as Record<string, unknown>;
          ev = ((run.urlCandidateEvidence as Ev[] | null) ?? []).slice();
        } catch (err) {
          rec["판정"] = `ERR(${err instanceof Error ? err.message.slice(0, 30) : "?"})`;
          table.push(rec);
          continue;
        }

        const sp = ev.filter((x) => x.crossSellerVerdict === "SAME" || x.crossSellerVerdict === "PRESUMED_SAME");
        rec["판정 도달"] = ev.length;
        rec["SAME"] = ev.filter((x) => x.crossSellerVerdict === "SAME").length;
        rec["PRESUMED"] = ev.filter((x) => x.crossSellerVerdict === "PRESUMED_SAME").length;
        rec["SIMILAR/UNKNOWN"] = ev.filter(
          (x) => x.crossSellerVerdict === "SIMILAR" || x.crossSellerVerdict === "UNKNOWN" || x.crossSellerVerdict == null,
        ).length;
        rec["CONFLICT"] = ev.filter((x) => x.crossSellerVerdict === "CONFLICT").length;
        rec["🇰🇷 가격"] = ev.filter((x) => x.market === "KR" && x.priceAmount != null).length;
        rec["🌎 가격"] = ev.filter((x) => x.market === "OVERSEAS" && x.priceAmount != null).length;

        /**
         * 🔴🔴 **가격 «자격» 은 집계기를 직접 돌려 센다** — tier 로 추론하지 않는다.
         *    칸 매핑은 운영 호출부(market-intelligence.ts:305~319)와 같은 읽기다.
         */
        const records = ev.map((x) => ({
          market: x.market,
          currency: x.priceCurrency,
          amount: x.priceAmount,
          priceTier: x.priceTier,
          matchTruth: x.matchTruth,
          verdict: x.crossSellerVerdict,
          priceStatus: x.priceStatus,
          blockers: x.crossSellerBlockers ?? null,
        }));
        const s = summarizeCandidateOverseasPrices(records as never);
        const eligible = Object.values(s.byCurrency).reduce((a, c) => a + c.count, 0);
        rec["가격 자격"] = eligible;
        rec["상품차이 제외"] = s.observedDifferenceCount;
        rec["가격미확인 제외"] = s.unverifiedCount;

        console.log(
          `  ${pad("domain", 26)} ${pad("market", 9)} ${pad("verdict", 14)} ${pad("tier", 11)} ${pad("price", 13)} status`,
        );
        for (const x of ev)
          console.log(
            `  ${pad(x.domain, 26)} ${pad(x.market, 9)} ${pad(x.crossSellerVerdict, 14)} ${pad(x.priceTier, 11)} ` +
              `${pad(x.priceAmount == null ? "-" : `${x.priceAmount} ${x.priceCurrency ?? ""}`, 13)} ${x.priceStatus ?? "-"}`,
          );
        console.log(
          `  🟢 가격 자격 **${eligible}** · byCurrency ${JSON.stringify(s.byCurrency)} · ` +
            `상품차이 제외 ${s.observedDifferenceCount} · 미확인 제외 ${s.unverifiedCount}`,
        );

        /** 🔵 Evidence — 실제 데이터로 일치/불일치 분리 + 내부 진단 누출 검사. */
        let agree = 0;
        let hold = 0;
        const leaked: string[] = [];
        for (const x of ev) {
          const e = splitEvidenceReasons(x.matchReasons);
          if (e.agree.length > 0) agree += 1;
          if (e.hold.length > 0) hold += 1;
          for (const line of [...e.agree, ...e.hold])
            for (const b of ["판정방법", "판정근거", "모델명 유사도", "CROSS_SELLER_AXES", "TEXT_CONFIRMED"])
              if (line.includes(b)) leaked.push(`${x.domain}: ${line.slice(0, 50)}`);
        }
        rec["Evidence 일치근거"] = `${agree}/${ev.length}`;
        rec["Evidence 불일치근거"] = `${hold}/${ev.length}`;
        rec["내부진단 누출"] = leaked.length;
        if (sp[0]) {
          const e = splitEvidenceReasons(sp[0].matchReasons);
          console.log(`  🔵 예시(${sp[0].domain}) 같다고 본 점 — ${e.agree.join(" · ") || "(없음)"}`);
          console.log(`  🔵 예시(${sp[0].domain}) 다른 점·확인 필요 — ${e.hold.join(" · ") || "(없음)"}`);
        }
        expect(leaked, `🔴 내부 진단이 셀러 Evidence 로 새어 나갔다(${sample.host})`).toEqual([]);

        table.push(rec);
        rowsDump.push({ host: sample.host, snapshot: sample.id, rows: ev });
      }

      /* ── 종합표 ───────────────────────────────────────────────────────── */
      console.log(`\n${"═".repeat(78)}\n════ SPRINT 2 — 상품별 결과(CPO §9 표) ════`);
      for (const r of table) console.log(`  ${JSON.stringify(r)}`);

      const outFile = path.join(path.dirname(DUMP), "sprint2-e2e-rows.json");
      writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), table, rowsDump }, null, 1), "utf8");
      console.log(`\n🟢 화면 축 입력 덤프 → ${outFile}`);
      console.log("🔴 WEB_SEARCH(SP07) 축은 이 표에 **없다** — 운영 funnel 로만 읽는다.");
      /* eslint-enable no-console */

      /** 🔴🔴 열화 게이트 — 원상품 추출이 전건 실패면 그 실행은 **측정이 아니다**. */
      const extracted = table.filter((r) => r["원상품 추출"] === "PASS").length;
      expect(extracted, "🔴 원상품 추출이 전건 실패 — 열화다. 이 실행의 숫자를 쓰지 않는다").toBeGreaterThan(0);
    },
    3_600_000,
  );
});
