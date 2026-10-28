import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-E2E-HISTORY-10 — **기존 히스토리 10건 실제 운영 경로 1회 실행**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-28): 아동의류 5 + 테니스의류 5. 상품마다
 * `원본 → AI Search 1회 → 후보 → Evidence → Identity → 가격 → MI → API` 를
 * **운영 함수 그대로** 태우고 단계별 분모를 기록한다.
 *
 * ── 🔴 금지(그대로 지킨다) ─────────────────────────────────────────────────
 * ```
 * Search Provider 변경 0 · 1 Product = 1 Search 변경 0 · Query 변경 0 ·
 * retry/추가 Search 0 · Registry 재도입 0 · NOT_AVAILABLE 정책 변경 0 ·
 * marketEvidence 0 · KRW 단독 KR 0 · Identity/threshold 0 · MI 계산식 0 ·
 * 사이트별 adapter 0 · 403 우회 0 · Browser fallback 0 · 상품별 예외 0 · UI 0
 * ```
 *
 * ── 🔴🔴 이 하니스가 운영과 «다른» 지점 — 먼저 적는다 ──────────────────────
 * ```
 * ⒜ **Supabase service-role 키가 없다**(§10 Production Sensitive). 그래서
 *    `listDomesticPriceSources` 가 **빈 배열** 을 돌려준다 ⟹
 *      · 등록부 검색 생산자        → 돌지 않는다
 *      · 국내 목록 탐색(2R-4)      → 돌지 않는다
 *      · 🔴 **정책 게이트가 발화하지 않는다**(`notAvailableDomains` 가 빈 집합)
 *    ⟹ 이 하니스의 Crawl 분모는 **정책 적용 «전»** 이다. 그래서 DB 에서 실측한
 *      `NOT_AVAILABLE` **13 도메인**(fixture)으로 「운영이었다면 막혔을 수」를
 *      **따로** 센다. 🔴 두 수를 합치지 않는다.
 * ⒝ `computeMarketIntelligence` 도 DB 를 읽는다 ⟹ 여기서는 **측정불가** 일 수
 *    있고, null 을 「MI 가 0 을 냈다」로 **적지 않는다**.
 * ⒞ fetch 가 이 PC(한국 가정용 IP)에서 나간다 — 운영은 Vercel egress 다.
 * ⒟ 🔴 **실제 Production 화면은 CTO 가 볼 수 없다**(로그인 뒤). 이 파일이 닿는
 *    가장 먼 지점은 **API 응답** 이고, DOM 은 `e2e-history-10-dom` 이 **이 파일이
 *    남긴 실제 응답** 으로 잇는다.
 * ```
 *
 * 🔴 라이브 실행은 `E2E10_LIVE=1` 에서만 돈다(기본 회귀는 HTTP 0 · Search 0).
 */

const LIVE = process.env.E2E10_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const TARGETS_PATH = join(FIX, "e2e-history-10-targets.json");
const REPORT_PATH = join(FIX, "e2e-history-10-report.json");

interface Target {
  cat: "KIDS" | "TENNIS";
  label: string;
  snapshotId: string;
  workspaceId: string;
  sourceUrl: string;
  title: string;
  brand: string | null;
  code: string | null;
}
interface TargetFile {
  capturedAt: string;
  targets: Target[];
  /** 🔴 운영 DB 실측값(`domestic_price_sources.collection_strategy`). 지어내지 않았다. */
  notAvailableDomains: string[];
}

function load(): TargetFile {
  return JSON.parse(readFileSync(TARGETS_PATH, "utf8")) as TargetFile;
}

/** 🔴 정책 집합과 **같은 매칭 규칙** 을 쓴다(운영 `isCollectionBlocked` 의 형태). */
function blockedByPolicy(url: string, domains: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

describe("E2E-HISTORY-10 — 분모", () => {
  it("🟢 대상은 아동 5 + 테니스 5 이고 **히스토리에 실재한다**", () => {
    const { targets } = load();
    expect(targets).toHaveLength(10);
    expect(targets.filter((t) => t.cat === "KIDS")).toHaveLength(5);
    expect(targets.filter((t) => t.cat === "TENNIS")).toHaveLength(5);
    for (const t of targets) {
      expect(t.sourceUrl, `${t.label}: 원본 URL 이 없다`).toMatch(/^https?:\/\//);
      expect(t.snapshotId).toMatch(/^[0-9a-f-]{36}$/);
      expect(t.workspaceId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("🟢 아동 축은 **브랜드·호스트가 전부 다르다**(한 사이트 종속 방지)", () => {
    const kids = load().targets.filter((t) => t.cat === "KIDS");
    const hosts = new Set(kids.map((t) => new URL(t.sourceUrl).hostname));
    const brands = new Set(kids.map((t) => t.brand));
    expect(hosts.size, "아동 호스트가 겹친다").toBe(5);
    expect(brands.size, "아동 브랜드가 겹친다").toBe(5);
  });

  /**
   * 🔴🔴 **테니스 축은 그 조건을 «구조적으로» 만족할 수 없다.** 히스토리의 테니스
   *    상품은 27건 전부 `Sergio Tacchini` × `tennis-warehouse.com` 이다. 숨기지 않고
   *    **계약으로 적어 둔다** — 새 테니스 원본이 들어오면 이 단언이 FAIL 하고,
   *    그 FAIL 이 「분모가 넓어졌다」는 신호다.
   */
  it("🔴 테니스 축은 **브랜드 1 · 호스트 1** 이다 — 상품으로만 다양화된다", () => {
    const t = load().targets.filter((x) => x.cat === "TENNIS");
    expect(new Set(t.map((x) => x.brand)).size).toBe(1);
    expect(new Set(t.map((x) => new URL(x.sourceUrl).hostname)).size).toBe(1);
    expect(new Set(t.map((x) => x.label)).size, "테니스 상품이 겹친다").toBe(5);
  });

  it("🔴 정책 집합은 **DB 실측 13 도메인** 이다(3 이 아니다)", () => {
    const { notAvailableDomains } = load();
    expect(notAvailableDomains.length).toBeGreaterThanOrEqual(13);
    for (const d of ["11st.co.kr", "coupang.com", "gmarket.co.kr", "ssg.com", "shopping.naver.com"]) {
      expect(notAvailableDomains).toContain(d);
    }
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **실측된 병목을 계약으로 잠근다** — 고치면 여기가 FAIL 하고 그것이 증거다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측(2026-10-28 · 운영 추출기 · 상품 10건): 원본 확정 **10/10** 인데
 * Discovery Query 가 생긴 것은 **2/10** 이고 나머지 **8** 은 `NO_MODEL_CODE` 다.
 * 🔴 그 8 은 **Search 를 «실패» 한 것이 아니라 «하지 않은» 것** 이다.
 */
describe("E2E-HISTORY-10 — 병목 owner", () => {
  it("🔴 Discovery Query 는 **품번 전용** 이다 — 없으면 질의가 서지 않는다", async () => {
    const { buildDiscoverySearchQuery } = await import(
      "@commerce/crawler/src/discovery-core/query-planner"
    );
    const base = {
      brand: "Sergio Tacchini",
      productName: "Racchetto Polo",
      productType: "polo",
      genderAge: null,
      color: "White",
      size: null,
      season: null,
      sourceUrl: "https://www.tennis-warehouse.com/x.html",
      sourceSite: null,
      sourceCountry: null,
      market: null,
    };
    /** 🔴 브랜드·상품명·색상이 **전부 있어도** 품번이 없으면 null 이다. */
    expect(buildDiscoverySearchQuery({ ...base, productCode: null } as never)).toBeNull();
    expect(buildDiscoverySearchQuery({ ...base, productCode: "B226AC009" } as never)).toBe('"B226AC009"');
  });

  it("🔴🔴 품번 생산자는 **둘뿐** 이다 — 확장 지점이 여기다", () => {
    /** 🔴 깊이를 손으로 세지 않는다 — 존재하는 경로를 **확인해서** 쓴다. */
    const DNA_SRC = join(__dirname, "../".repeat(8), "packages/shared/src/product-identity-dna.ts");
    expect(existsSync(DNA_SRC), "품번 생산자 파일 경로가 틀렸다").toBe(true);
    const src = readFileSync(DNA_SRC, "utf8").replace(/\r\n/g, "\n");
    const at = src.indexOf("function resolveBrandModelCode");
    expect(at).toBeGreaterThan(0);
    const body = src.slice(at, src.indexOf("\n}", at));
    /** ⒜ 설명문의 "Product/Article code" 라벨 ⒝ URL slug 조각. 그 외는 없다. */
    expect(body).toContain("extractLabeledProductCode");
    expect(body).toContain("extractCodeLikeSlugSegment");
    /**
     * 🔴🔴 **`new Set(...).size` 로 세지 않는다.** 1차에 그렇게 썼다가 변이 M2
     *    (`?? extractUrlSlug(product.title)` 추가)가 **통과했다** — 그 이름이 이미
     *    집합에 있었기 때문이다. ⟹ **호출 개수와 순서** 로 잠근다.
     */
    const calls = (body.match(/extract[A-Za-z]+\(/g) ?? []).map((s) => s.slice(0, -1));
    expect(
      calls,
      "품번 생산자가 바뀌었다 — E2E-HISTORY-10 의 8/10 NO_MODEL_CODE 가 달라졌을 수 있다",
    ).toEqual(["extractLabeledProductCode", "extractCodeLikeSlugSegment", "extractUrlSlug"]);
  });

  /**
   * 🔴 **결함 고정 계약.** 지금 운영은 이 10건에서 Query 를 2건만 세운다.
   *    품번 생산자가 넓어지면 이 단언이 **FAIL 로 뒤집히고** 그것이 수정의 증거다.
   */
  it("🔴 [결함 고정] 히스토리 10건 중 Query 가 서는 것은 **2건** 이다", () => {
    let report: { label: string; origin: { ok: boolean }; search?: { skipped: string | null } }[];
    try {
      report = (JSON.parse(readFileSync(REPORT_PATH, "utf8")) as { report: typeof report }).report;
    } catch {
      return; // 🔴 라이브 산출물이 없으면 건너뛴다(없는 것을 0 으로 적지 않는다).
    }
    expect(report).toHaveLength(10);
    expect(report.filter((r) => r.origin.ok), "원본 확정이 10/10 이 아니다").toHaveLength(10);
    const noCode = report.filter((r) => r.search?.skipped === "NO_MODEL_CODE");
    const queried = report.filter((r) => r.search?.skipped !== "NO_MODEL_CODE");
    expect(noCode).toHaveLength(8);
    expect(queried.map((r) => r.label).sort()).toEqual(["Bobo Choses", "Main Story"]);
  });
});

describe("E2E-HISTORY-10 — 라이브 실행", () => {
  it.runIf(LIVE)(
    "🔴🔴 상품 10건 × 운영 경로 1회 — 추가 Search 0 · 보정 0",
    async () => {
      const { targets, notAvailableDomains } = load();
      const { universalExtract } = await import("@commerce/crawler");
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { computeMarketIntelligence } = await import("../market-intelligence");

      const report: unknown[] = [];

      for (const t of targets) {
        /* eslint-disable no-console */
        console.log(`\n[E2E10] ══ ${t.cat} · ${t.label} ══ ${t.sourceUrl}`);
        const row: Record<string, unknown> = { ...t };

        /* ── ① 원본 상품정보 — 운영 추출 경로 ────────────────────────────── */
        let dna: Awaited<ReturnType<typeof buildProductIdentityDna>> | null = null;
        try {
          const ex = await universalExtract(t.sourceUrl, { debug: false });
          const product = buildCanonicalProduct(
            t.sourceUrl,
            ex.productData,
            ex.productDataSources,
            [],
          );
          dna = buildProductIdentityDna(product);
          row.origin = {
            ok: true,
            title: dna.title,
            brand: dna.brand,
            code: dna.brandModelCode,
            color: dna.color,
            images: dna.imageUrls.length,
            /** 🔴 `price` 는 `ProvenanceField` 다 — `.value` 를 읽는다(타입에서 확인). */
            price: product.price.value
              ? `${product.price.value.amount} ${product.price.value.currency}`.trim()
              : null,
          };
        } catch (e) {
          row.origin = { ok: false, error: (e as Error).message.slice(0, 160) };
        }
        console.log(`[E2E10-origin] ${JSON.stringify(row.origin)}`);
        if (!dna) {
          report.push(row);
          continue;
        }

        /* ── ②~⑧ 운영 runner — check/route 와 «같은 인자» ─────────────────── */
        try {
          const r = (await runDomesticPriceCheck({
            snapshotId: t.snapshotId,
            workspaceId: t.workspaceId,
            dna,
            description: undefined,
            domesticListingHop: true,
            /** 🔴 상품당 정확히 1회. 재시도도 2차 질의도 없다. */
            webSearch: true,
          } as never)) as unknown as Record<string, unknown>;

          const search = r.webSearchMetrics as Record<string, unknown> | null;
          const pool = r.webSearchUrlMetrics as Record<string, unknown> | null;
          /** 🟢 생산자 목록을 **손으로 적지 않는다** — 결과에서 뽑는다. */
          const producers = Object.keys(r).filter((k) => k.endsWith("Evidence"));
          const evidence = producers.flatMap(
            (k) => ((r[k] as unknown[] | null) ?? []).map((e) => ({ producer: k, ...(e as object) })),
          ) as Record<string, unknown>[];

          const dropped = (pool?.dropped ?? []) as { url: string; reason: string }[];
          const byReason: Record<string, number> = {};
          for (const d of dropped) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;

          /**
           * 🔴 운영이었다면 정책이 막았을 수 — 하니스 분모와 **합치지 않는다**.
           * 🔴 **관측 가능한 범위에서만** 센다: runner 는 공급 URL «목록» 을 돌려주지
           *    않으므로(`UrlCandidatePoolMetrics` 에 그 칸이 없다 · 타입 확인) 탈락
           *    URL 과 살아남은 후보 도메인으로만 센다 ⟹ **하한** 이다.
           */
          const observable = [
            ...dropped.map((d) => d.url),
            ...evidence.map((e) => `https://${String(e.domain)}/`),
          ];
          const wouldBlock = observable;
          row.search = search;
          row.pool = pool
            ? {
                supplied: pool.suppliedUrls,
                accepted: pool.acceptedUrls,
                usable: pool.usableProductUrls,
                miEligible: pool.miEligibleCandidates,
                fetchCalls: pool.fetchCalls,
                byReason,
              }
            : null;
          row.policyWouldBlock = wouldBlock.filter((u) => blockedByPolicy(u, notAvailableDomains)).length;
          row.evidence = evidence.map((e) => ({
            producer: e.producer,
            domain: e.domain,
            market: e.market,
            tier: e.priceTier,
            verdict: e.crossSellerVerdict,
            price: e.price,
            currency: e.currency,
            priceStatus: e.priceStatus,
          }));
          row.sourceErrors = (r.sourceErrors as string[]).slice(0, 3);

          console.log(
            `[E2E10-search] ${JSON.stringify(search)}\n[E2E10-pool]   ${JSON.stringify(row.pool)}` +
              `\n[E2E10-policy] 운영이면 차단됐을 URL ${row.policyWouldBlock}건`,
          );
          for (const e of row.evidence as Record<string, unknown>[]) {
            console.log(
              `[E2E10-ev] ${String(e.producer).padEnd(24)} ${String(e.domain).padEnd(26)}` +
                ` market=${String(e.market).padEnd(9)} tier=${String(e.tier).padEnd(11)}` +
                ` verdict=${String(e.verdict).padEnd(14)} ${String(e.price ?? "-")} ${String(e.currency ?? "")}`,
            );
          }

          /* ── ⑨ MI — 운영과 «같은 합류 자리» ────────────────────────────── */
          try {
            const mi = await computeMarketIntelligence(
              t.snapshotId,
              t.workspaceId,
              evidence.length > 0 ? (evidence as never) : null,
            );
            /**
             * 🔴 칸 이름은 `market-intelligence.ts` 반환부에서 **읽어서** 쓴다 —
             *    국내 최저가는 최상위가 아니라 `domesticCompetition.lowestPriceKrw` 다
             *    (typecheck 가 내 1차 추측 `domesticLowestPriceKrw` 를 잡았다).
             */
            row.mi = mi
              ? {
                  domesticLowestKrw: mi.domesticCompetition?.lowestPriceKrw ?? null,
                  candidateDomesticPrice: mi.candidateDomesticPrice ?? null,
                  candidateOverseasPrice: mi.candidateOverseasPrice ?? null,
                }
              : "MI_NULL(하니스 DB 권한 — 측정불가)";
          } catch (e) {
            row.mi = `MI_ERROR(측정불가): ${(e as Error).message.slice(0, 90)}`;
          }
          console.log(`[E2E10-mi]     ${JSON.stringify(row.mi)}`);
        } catch (e) {
          row.runner = { ok: false, error: (e as Error).message.slice(0, 200) };
          console.log(`[E2E10-runner] 🔴 ${JSON.stringify(row.runner)}`);
        }
        report.push(row);
      }

      mkdirSync(FIX, { recursive: true });
      writeFileSync(REPORT_PATH, JSON.stringify({ ranAt: "E2E10", report }, null, 2));
      console.log(`\n[E2E10-done] ${report.length}건 기록 → ${REPORT_PATH}`);

      /** 🔴 측정이다 — 결과 수치를 미리 고정하지 않는다. 분모만 잠근다. */
      expect(report).toHaveLength(10);
    },
    3_600_000,
  );

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **「품번 없음」을 「페이지에 품번이 없다」로 적지 않는다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 1차 실행에서 10건 중 **8건** 이 `skipped: "NO_MODEL_CODE"` 로 Search 자체가
   * 발화하지 않았다. 🔴 그 8건이 ⒜ **원문에 품번이 없는 것** 인지 ⒝ **있는데 우리
   * 생산자가 못 읽는 것** 인지는 **다른 문제** 다(§5-B · 「측정불가 ≠ 0」).
   *
   * 🔴 **Identity 를 고치지 않는다.** 원문 문자열만 센다(관측 · 판정 0).
   */
  it.runIf(LIVE)(
    "🔴🔴 NO_MODEL_CODE 8건 — 원문에 품번 «모양» 이 있는지 센다(구현 0)",
    async () => {
      const { extractLabeledProductCode } = await import("@commerce/shared");
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
      const out: Record<string, unknown>[] = [];
      for (const t of load().targets) {
        let html = "";
        let status = 0;
        try {
          const res = await fetch(t.sourceUrl, {
            headers: { "user-agent": ua },
            signal: AbortSignal.timeout(30_000),
          });
          status = res.status;
          html = await res.text();
        } catch (e) {
          out.push({ label: t.label, err: (e as Error).name });
          continue;
        }
        /** 🔴 운영 라벨 생산자 그대로 — 새 정규식을 만들지 않는다. */
        const labeled = extractLabeledProductCode(html);
        /** 🟡 **관측용** 지표다 — 판정에 쓰지 않는다(글자+숫자 혼합 6~14자). */
        const codeShapes = new Set(
          (html.match(/\b(?=[A-Z0-9-]{6,14}\b)(?=[^"]*[A-Z])(?=[^"]*\d)[A-Z0-9][A-Z0-9-]{5,13}\b/g) ?? []).slice(
            0,
            400,
          ),
        );
        const row = {
          cat: t.cat,
          label: t.label,
          status,
          bytes: html.length,
          labeledCode: labeled,
          hasLabelPhrase: /(product|article)\s+code/i.test(html),
          slug: new URL(t.sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "",
          shapeSamples: [...codeShapes].slice(0, 6),
        };
        out.push(row);
        /* eslint-disable no-console */
        console.log(
          `[E2E10-code] ${row.cat.padEnd(6)} ${row.label.slice(0, 22).padEnd(22)} HTTP ${row.status}` +
            ` labeled=${row.labeledCode ?? "null"} 라벨문구=${row.hasLabelPhrase ? "O" : "X"}` +
            ` slug=${row.slug.slice(0, 40)} 모양후보=${(row.shapeSamples as string[]).join(",").slice(0, 70)}`,
        );
      }
      writeFileSync(join(FIX, "e2e-history-10-code.json"), JSON.stringify(out, null, 2));
      expect(out).toHaveLength(10);
    },
    1_200_000,
  );
});
