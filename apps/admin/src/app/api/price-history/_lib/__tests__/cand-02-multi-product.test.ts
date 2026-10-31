import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
/**
 * 🔵 CANDIDATE-CAP-AND-LABEL-01 — 상한을 **운영 상수에서 읽는다**(하드코딩 금지).
 * 🔴 전에는 `10` 을 손으로 적어 뒀고, 그러면 운영이 바뀔 때 하니스가 **조용히 거짓**
 *    을 말한다(「상한이 N 을 자른다」가 실제 상한과 달라진다).
 * 🟢 상한의 **값 자체** 는 `ccl-01-cap-and-label` 이 리터럴로 잠근다 — 여기서
 *    `toBe(20)` 을 또 쓰면 그쪽과 owner 가 둘이 된다.
 */
import { MAX_SUPPLIED_CANDIDATE_URLS } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CANDIDATE-02 — **다상품 후보 표시 검증 (방법 ⒜ 재투입)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **질문은 하나다**(CPO 명시) —
 * > 「이미 찾아낸 후보를 화면이 후보군으로 제대로 보여주고,
 * >  가격이 있는 후보를 그 안에서 함께 보여주는가?」
 *
 * 🔴 **발견 능력을 평가하지 않는다.** Search 0 · Registry 0 · Identity 0 ·
 *    가격정책 0 · 운영 코드 변경 0. 후보가 적게 나오는 것은 이 측정의 FAIL 이 아니다.
 *
 * ── 🔴 왜 ⒜(재투입)인가 — 로컬 측정 제약을 먼저 적는다 ────────────────────
 * ```
 * APIFY_API_TOKEN            부재 ⟹ AI Search 는 skipped(NOT_CONFIGURED)
 * SUPABASE_SERVICE_ROLE_KEY   부재 ⟹ getSupabaseAdmin() === null
 *                                  ⟹ 등록부가 **비어서** 돌고 DB 쓰기가 **구조적으로 불가**
 * ⟹ 🔴 「5개 상품을 새로 Search 한다」는 로컬에서 불가능하다(CORE-E2E-CLOSE-06 실측).
 * 🟢 그래서 **이미 사람이 확정해 둔 후보 URL** 을 운영 재투입 생산자로 되돌려 넣는다.
 * ```
 *
 * ── 🔴 원상품 DNA 의 owner 를 «크롤» 이 아니라 «저장분» 으로 둔 이유 ────────
 * 측정 대상 경로는 `/api/price-history/check` 이고 그 라우트의 DNA owner 는
 * **저장된 canonicalProduct** 다(`check/route.ts`:
 *   `backfillCanonicalProduct(snapshot.workspace.canonicalProduct)` →
 *   `buildProductIdentityDna(product)`).
 * 🔴 `dsp-01`/`wu-142` 하니스는 `shopifySiteStrategy.extract(originUrl)` 로 **새로
 *    크롤** 하는데 그것은 「새 상품 분석」(pipeline) 경로다 — 이 WU 가 보는 경로가 아니다.
 * 🟢 그리고 저장분을 쓰면 메모 `origin-brand-recovery-fails-intermittently` 의
 *    **간헐적 brand 공백** 에 측정이 흔들리지 않는다(brand 가 비면 Query Planner 가
 *    1축으로 쪼그라들어 숫자가 조용히 틀린다).
 * 🔴 값을 **만들지 않았다** — `wu-059-gt-facts.json` 의 `origins` 는 운영 DB 의
 *    canonicalProduct 그대로다(그 파일 머리 주석).
 *
 * ── 🔴 분모(사람이 이미 라벨한 후보) ─────────────────────────────────────────
 * ```
 * wu-067-blind-review-set.json   sid → 원상품 URL + 후보 items   (블라인드 세트)
 * wu-068-new-gt.json             sid 별 후보의 **CEO 라벨**       (그 세트의 정답)
 * wu-059-gt-facts.json           origins(저장 canonicalProduct) + searchId 별 후보
 * wu-112-human-gt.json           originCode 별 후보 + CEO 라벨   (B226AC010 축)
 * ```
 * 🔴 **B226AC009 는 제외** 한다(CPO ⒜ 지시 — 그 상품은 이미 다섯 WU 가 쟀다).
 *
 * 🔴 게이트 `CAND02_LIVE=1` 없으면 LIVE 블록 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴 이 파일은 **jsdom 을 쓰지 않는다** — 라이브 fetch 하니스에 jsdom 을 붙여
 *    전건 UNREACHABLE 을 받은 선례가 있다(WU-133). 화면 축은 별 파일이다
 *    (`commerce/__tests__/cand-02-candidate-display.test.ts`).
 */

const LIVE = process.env.CAND02_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;

/** 🔴 재투입 상한의 owner 는 운영이다 — 하니스가 다른 상한을 갖지 않는다. */
const OPERATIONAL_URL_CAP = MAX_SUPPLIED_CANDIDATE_URLS;

/**
 * 🔴 운영 재투입은 **AC009 의 스냅샷 id** 를 쓴다(dsp-01 과 같은 값).
 *    이 다섯 상품의 스냅샷 id 가 아니다 — 그래서 다음 둘을 먼저 확정해 둔다:
 * ```
 * ⒜ 후보 URL 은 **인자로** 넘긴다 ⟹ 이 id 로 DB 를 읽어 후보를 만들지 않는다
 * ⒝ 쓰기는 구조적으로 불가 ⟹ service-role 부재(getSupabaseAdmin null) **그리고**
 *    `REVIEWED_SAME_SHOP_ID` 가 `TRANSIENT_SHOP_IDS` 에 있어 upsert 앞에서 끊긴다
 * ```
 * 🔴 그래서 이 id 로 **엉뚱한 스냅샷을 오염시킬 수 없다**(이중 방어 · 아래 계약이 단언).
 */
const SNAPSHOT = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";
const WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";

/* ─────────────────────────── 분모 조립(순수) ─────────────────────────── */

interface BlindSet {
  [k: string]: { sid: string; title: string; url: string; items: { id: string; url: string; domain: string; title: string }[] };
}
interface Gt68 {
  [k: string]: { searchId: string; url: string; domain: string; gt: string };
}
interface Facts59 {
  origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  candidates: Record<string, { searchId: string; url: string; domain: string; humanGt: string; title: string }>;
}
interface Gt112 {
  candidates: { originCode: string; url: string; domain: string; verdict: string }[];
}

/** 🔴 비교 키 — 쿼리/해시/트레일링 슬래시를 떼고 소문자로(운영 dedupe 와 같은 성질). */
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

export interface CandidateSeed {
  url: string;
  domain: string;
  /** 🔴 사람 라벨. 없으면 `null` — **「DIFFERENT」로 지어내지 않는다**. */
  human: string | null;
  labelSource: string | null;
}

export interface ProductSeed {
  sid: string;
  /** 🟢 셀러가 보는 식별자. 🔴 sku 가 비면 **비었다고 적는다**(품번을 URL 에서 지어내지 않는다). */
  code: string;
  title: string;
  originUrl: string;
  canonicalProduct: Record<string, unknown>;
  candidates: CandidateSeed[];
}

/**
 * 🔴 다섯 상품의 분모를 **네 fixture 에서 합친다.** 합치는 곳이 하나여야 같은 후보가
 *    두 번 세어지지 않는다. 🔴 sid 공간이 fixture 마다 같은지는 **단언으로** 확인한다
 *    (추측하면 엉뚱한 원상품에 후보가 붙어 측정 전체가 조용히 틀린다).
 */
function buildSeeds(): ProductSeed[] {
  const blind = fx<BlindSet>("wu-067-blind-review-set.json");
  const gt68 = fx<Gt68>("wu-068-new-gt.json");
  const f59 = fx<Facts59>("wu-059-gt-facts.json");
  const gt112 = fx<Gt112>("wu-112-human-gt.json");

  const seeds: ProductSeed[] = [];
  for (const entry of Object.values(blind)) {
    const origin = f59.origins[entry.sid];
    if (!origin) continue;
    const cp = origin.canonicalProduct as {
      sku?: { value?: string };
      title?: { value?: string };
      sourceUrl?: string;
    };
    /** 🔴 **B226AC009 제외**(CPO ⒜). 그 상품은 이미 측정이 끝났다. */
    const sku = (cp.sku?.value ?? "").trim();
    if (sku.toUpperCase() === "B226AC009") continue;

    const byKey = new Map<string, CandidateSeed>();
    const add = (url: string, domain: string, human: string | null, labelSource: string | null) => {
      const k = loose(url);
      const prev = byKey.get(k);
      if (prev) {
        /** 🟢 라벨이 뒤에 생기면 채운다 — 🔴 **덮어쓰지 않는다**(먼저 붙은 라벨이 이긴다). */
        if (!prev.human && human) {
          prev.human = human;
          prev.labelSource = labelSource;
        }
        return;
      }
      byKey.set(k, { url, domain, human, labelSource });
    };

    /** ① 블라인드 세트의 후보 + 그 세트의 CEO 라벨(`wu-068`, 같은 sid 공간). */
    for (const it of entry.items) {
      const label = Object.values(gt68).find((g) => g.searchId === entry.sid && loose(g.url) === loose(it.url));
      add(it.url, it.domain, label?.gt ?? null, label ? "wu-068" : null);
    }
    /** ② WU-059 GT 의 같은 searchId 후보. */
    for (const c of Object.values(f59.candidates)) {
      if (c.searchId !== entry.sid) continue;
      add(c.url, c.domain, c.humanGt ?? null, "wu-059");
    }
    /** ③ originCode 축 GT(B226AC010 에만 걸린다). */
    if (sku) {
      for (const c of gt112.candidates) {
        if (c.originCode.toUpperCase() !== sku.toUpperCase()) continue;
        add(c.url, c.domain, c.verdict ?? null, "wu-112");
      }
    }

    seeds.push({
      sid: entry.sid,
      code: sku || "(sku 공란)",
      title: cp.title?.value ?? entry.title,
      originUrl: cp.sourceUrl ?? entry.url,
      canonicalProduct: origin.canonicalProduct,
      candidates: [...byKey.values()],
    });
  }
  return seeds;
}

describe("CAND-02 분모 — 다상품 재투입 입력", () => {
  /**
   * 🔴🔴 **CAND-02-A — sid 공간이 fixture 사이에서 같은지 먼저 단언한다.**
   *    `wu-067`(블라인드 세트)의 원상품 URL 과 `wu-059`(저장 canonicalProduct)의
   *    `sourceUrl` 이 같아야 「그 sid 의 후보」가 「그 원상품의 후보」가 된다.
   * 🔴 S4 는 `wu-059` 쪽에 Shopify 검색 문맥 쿼리(`?_pos=…&_ss=r`)가 붙어 있다 ⟹
   *    **경로로** 비교한다(메모 `our-own-query-must-not-become-evidence` 의 그 성질).
   */
  it("CAND-02-A sid → 원상품이 fixture 사이에서 일치한다", () => {
    const blind = fx<BlindSet>("wu-067-blind-review-set.json");
    const f59 = fx<Facts59>("wu-059-gt-facts.json");
    let checked = 0;
    for (const entry of Object.values(blind)) {
      const origin = f59.origins[entry.sid];
      expect(origin, `${entry.sid} 의 저장 canonicalProduct 가 없다 — 분모를 세울 수 없다`).toBeTruthy();
      const stored = (origin!.canonicalProduct as { sourceUrl?: string }).sourceUrl ?? "";
      expect(loose(stored), `${entry.sid} 원상품 불일치 — 후보가 엉뚱한 상품에 붙는다`).toBe(loose(entry.url));
      checked += 1;
    }
    expect(checked).toBe(6);
  });

  /** 🔴 CAND-02-B — **다섯 상품이고 전부 B226AC009 가 아니다**(CPO ⒜ 조건). */
  it("CAND-02-B B226AC009 를 제외한 원상품 5개가 선다", () => {
    const seeds = buildSeeds();
    expect(seeds).toHaveLength(5);
    expect(seeds.map((s) => s.code)).not.toContain("B226AC009");
    /** 🔴 원상품 URL 을 **전부** 들고 있어야 보고서가 §19 를 지킬 수 있다. */
    for (const s of seeds) expect(s.originUrl).toMatch(/^https?:\/\//);
  });

  /** 🔴 CAND-02-C — 상품마다 후보가 **하나 이상** 있어야 표시 축을 잴 수 있다. */
  it("CAND-02-C 상품마다 사람이 라벨한 후보가 있다", () => {
    for (const s of buildSeeds()) {
      expect(s.candidates.length, `${s.sid} 후보 0 — 이 상품으로는 표시 축을 못 잰다`).toBeGreaterThan(0);
      expect(s.candidates.some((c) => c.human != null), `${s.sid} 라벨 0`).toBe(true);
      /** 🔴 같은 URL 이 두 번 들어오면 상한(10)을 **헛되게 먹는다**. */
      expect(new Set(s.candidates.map((c) => loose(c.url))).size).toBe(s.candidates.length);
    }
  });

  /**
   * 🔴🔴 CAND-02-D — **상한이 무엇을 자르는지 측정 «전» 에 센다.**
   *    운영 상한은 `MAX_SUPPLIED_CANDIDATE_URLS` 다(CCL-01 에서 20). 상품 하나가 그보다
   *    많은 후보를 들고 있으면 **일부는 fetch 되지 않는다** ⟹ 그것을 「후보 없음」으로
   *    적으면 거짓이다(메모 「상한이 무엇을 자르는지 배포 전에 센다」).
   */
  it("CAND-02-D 운영 상한(10)이 자르는 양을 기록한다", () => {
    const over = buildSeeds()
      .filter((s) => s.candidates.length > OPERATIONAL_URL_CAP)
      .map((s) => `${s.sid}:${s.candidates.length - OPERATIONAL_URL_CAP}건 초과`);
    /* eslint-disable-next-line no-console */
    console.log(`[CAND02-cap] 상한 ${OPERATIONAL_URL_CAP} · 초과 상품 ${over.length}건 ${JSON.stringify(over)}`);
    /** 🔴 단언은 「초과가 0이다」가 아니다 — **초과를 알고 있다** 는 것이다. */
    expect(Array.isArray(over)).toBe(true);
  });
});

/* ─────────────────────────── LIVE 측정 ─────────────────────────── */

interface MeasuredRow {
  url: string;
  domain: string;
  title: string | null;
  human: string | null;
  market: string | null;
  tier: string | null;
  verdict: string | null;
  price: number | null;
  currency: string | null;
  priceStatus: string | null;
  soldOut: boolean | null;
  source: string | null;
  /** 🟢 운영 선택기 산출 — 복제 계산 0. */
  display: "LIKELY" | "PRESUMED" | "POSSIBLE" | null;
  priced: boolean;
}

export interface MeasuredProduct {
  sid: string;
  code: string;
  title: string;
  originUrl: string;
  suppliedUrls: string[];
  /** 🔴 상한에 잘려 **fetch 되지 않은** URL. 「후보 없음」과 다른 사실이다. */
  notFetched: string[];
  rows: MeasuredRow[];
  lost: { url: string; human: string | null }[];
  metrics: Record<string, unknown> | null;
}

describe("CAND-02 — 다상품 후보 표시 측정(재투입 · 새 Search 0)", () => {
  it.runIf(LIVE)(
    "🔴 5개 상품을 운영 재투입 경로로 태우고 두 선택기 산출을 기록한다",
    async () => {
      const { backfillCanonicalProduct, buildProductIdentityDna } = await import("@commerce/shared");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { isTransientShopId, REVIEWED_SAME_SHOP_ID } = await import("../transient-candidates");
      const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
      const { selectCandidateList, selectMiSameCandidates } = await import(
        "../../../../pipeline/commerce/mi-same-candidates"
      );
      type Row = import("../../../../pipeline/commerce/GeminiTransientCandidates").GeminiTransientRow;

      /**
       * 🔴🔴 **쓰기 불가를 측정 «전» 에 증명한다.** 이 둘이 참이 아니면 하니스가
       *    엉뚱한 스냅샷에 행을 남길 수 있다 ⟹ 그 상태로는 측정하지 않는다.
       */
      expect(getSupabaseAdmin(), "service-role 이 있다 — 이 하니스로 운영 DB 를 건드릴 수 있다").toBeNull();
      expect(isTransientShopId(REVIEWED_SAME_SHOP_ID), "재투입이 일시 샵이 아니다 — 저장될 수 있다").toBe(true);

      const seeds = buildSeeds();
      const out: MeasuredProduct[] = [];

      for (const s of seeds) {
        /** ① 원상품 DNA — **운영 `/check` 와 같은 owner 둘.** */
        const product = backfillCanonicalProduct(s.canonicalProduct as never);
        const dna = buildProductIdentityDna(product);
        /* eslint-disable no-console */
        console.log(
          `\n━━━━━━ ${s.sid} ${s.code} — brand=${JSON.stringify(dna.brand.value)} ` +
            `code=${dna.brandModelCode} color=${JSON.stringify(dna.color)} 후보=${s.candidates.length}`,
        );
        console.log(`   원상품 URL = ${s.originUrl}`);
        /**
         * 🔴 brand 가 비면 **모든 후보가 BRAND_UNCONFIRMED** 가 되어 숫자가 조용히
         *    틀린다(WU-133 사슬의 머리). 🔴 그래서 비면 **그 사실을 적고** 측정에서
         *    제외 판단을 CPO 에게 넘긴다 — 임의로 채우지 않는다.
         */
        if (!dna.brand.value) console.log(`   🔴 brand 공백 — 이 상품의 판정 숫자는 그 전제 아래 읽어야 한다`);

        const supplied = s.candidates.map((c) => c.url);
        const r = (await runDomesticPriceCheck({
          snapshotId: SNAPSHOT,
          workspaceId: WORKSPACE,
          dna,
          description: product.description.value || undefined,
          /** 🔴 **검색이 아니다** — 사람이 확정한 URL 을 운영 생산자로 다시 연다. */
          reviewedSameUrls: supplied,
          webSearch: false,
        } as never)) as unknown as Record<string, unknown>;

        /**
         * 🔴 **여섯 출처를 운영과 같은 순서로 합친다** —
         *    `DomesticPriceIntelligencePanel.marketComparisonInput` 의 그 concat 이다.
         *    🔴 한 줄을 빠뜨리면 후보가 화면에서 사라진다(그 파일이 두 번 그렇게 틀렸다).
         */
        const rows = [
          ...((r.geminiEvidence as Row[] | null) ?? []),
          ...((r.urlCandidateEvidence as Row[] | null) ?? []),
          ...((r.overseasAutoEvidence as Row[] | null) ?? []),
          ...((r.reviewedSameEvidence as Row[] | null) ?? []),
          ...((r.domesticListingEvidence as Row[] | null) ?? []),
          ...((r.webSearchEvidence as Row[] | null) ?? []),
        ];

        /** ② 운영 선택기 — 표시 축과 가격 축을 **각각** 부른다(복제 0). */
        const display = new Map<string, "LIKELY" | "PRESUMED" | "POSSIBLE">();
        const priced = new Set<string>();
        for (const market of ["KR", "OVERSEAS"] as const) {
          for (const x of selectCandidateList(rows, market)) display.set(loose(x.row.discoveredUrl), x.group);
          for (const x of selectMiSameCandidates(rows, market).priced) priced.add(loose(x.discoveredUrl));
        }

        const humanByUrl = new Map(s.candidates.map((c) => [loose(c.url), c.human]));
        const measured: MeasuredRow[] = rows.map((row) => ({
          url: row.discoveredUrl,
          domain: row.domain,
          title: row.title ?? null,
          human: humanByUrl.get(loose(row.discoveredUrl)) ?? null,
          market: row.market ?? null,
          tier: (row.matchTruth as string | null) ?? null,
          verdict: (row.crossSellerVerdict as string | null) ?? null,
          price: row.priceAmount ?? null,
          currency: row.priceCurrency ?? null,
          priceStatus: (row.priceStatus as string | null) ?? null,
          soldOut: row.soldOut ?? null,
          source: (row.source as string | null) ?? null,
          display: display.get(loose(row.discoveredUrl)) ?? null,
          priced: priced.has(loose(row.discoveredUrl)),
        }));

        const arrived = new Set(rows.map((x) => loose(x.discoveredUrl)));
        /**
         * 🔴🔴 **칸 이름을 두 번 틀렸고 둘 다 적는다**(이 트랙의 그 함정 · 13번째).
         * ```
         * ⒜ `reviewedSameUrlMetrics`  → **없는 칸** 이다. 실제는 `reviewedSameMetrics`
         *    (`run-domestic-price-check.ts`:2334). 🔴 1차 실행이 `metrics=null` 을 찍었는데
         *    **같은 실행에 후보 행이 있었다** ⟹ 모순이다(evidence 는 metrics!==null 일
         *    때만 반환된다). 그대로 보고했으면 「상한이 아무것도 자르지 않았다」가 거짓이 됐다.
         * ⒝ 상한에 잘린 URL 은 `dropped` 가 아니라 **별 칸** 이다
         *    (`url-candidate-pool.ts`:155 `notFetchedOverLimit` — 「버리지 않고 남긴다」).
         * ```
         * 🟢 그래서 아래 단언을 넣어 **칸 이름이 조용히 썩지 않게** 한다.
         */
        const metrics = (r.reviewedSameMetrics ?? null) as Record<string, unknown> | null;
        expect(
          metrics,
          "reviewedSameMetrics 가 null 인데 후보 행이 있다 — 칸 이름이 바뀌었다(측정 무효)",
        ).not.toBeNull();
        const notFetched = (metrics?.notFetchedOverLimit as string[] | undefined) ?? [];

        out.push({
          sid: s.sid,
          code: s.code,
          title: s.title,
          originUrl: s.originUrl,
          suppliedUrls: supplied,
          notFetched,
          rows: measured,
          lost: s.candidates.filter((c) => !arrived.has(loose(c.url))).map((c) => ({ url: c.url, human: c.human })),
          metrics,
        });

        console.log(`   [CAND02-metrics] ${JSON.stringify(metrics)}`);
        for (const m of measured) {
          console.log(
            `   [CAND02-row] ${m.domain.padEnd(24)} human=${(m.human ?? "-").padEnd(10)}` +
              ` market=${(m.market ?? "-").padEnd(9)} tier=${(m.tier ?? "-").padEnd(18)}` +
              ` verdict=${(m.verdict ?? "-").padEnd(14)}` +
              ` ${String(m.price ?? "-").padStart(9)} ${(m.currency ?? "").padEnd(4)}` +
              ` ${(m.priceStatus ?? "-").padEnd(18)} display=${(m.display ?? "X").padEnd(8)} priced=${m.priced ? "O" : "X"}`,
          );
          console.log(`        ${m.url}`);
        }
        console.log(`   [CAND02-lost] ${out.at(-1)!.lost.length}건`);
        for (const l of out.at(-1)!.lost) console.log(`        - (${l.human ?? "라벨없음"}) ${l.url}`);
      }

      /* ══════════ 표 — §20 의 그 모양 ══════════ */
      const pad = (v: unknown, n: number) => {
        const s = String(v);
        return s.length >= n ? s : s + " ".repeat(n - s.length);
      };
      console.log(`\n\n════════ CAND-02 — 상품별 후보 / 가격 / 표시 ════════`);
      console.log(
        `   ${pad("상품", 22)}${pad("공급", 6)}${pad("도달", 6)}${pad("표시", 6)}${pad("가격", 6)}${pad("PRICE⊆DISPLAY", 15)}`,
      );
      let measurable = 0;
      for (const p of out) {
        const shown = p.rows.filter((x) => x.display != null);
        const pricedRows = p.rows.filter((x) => x.priced);
        const violation = pricedRows.filter((x) => x.display == null);
        /**
         * 🔴🔴 **분모 0 을 PASS 로 적지 않는다.** `priced` 가 0 이면 「가격 후보가
         *    리스트에서 사라지지 않았다」는 **참이 될 재료가 없다** ⟹ 측정불가다.
         *    🔴 1차 출력이 S3·S5 를 PASS 로 찍었고 그것이 §5-B 가 금지한 「돌았다 = 통과」다
         *    (CONTROL 통과 조건: 「그 값이 재현된다」 · 「함수가 돌았다」가 아니다).
         */
        const verdict =
          pricedRows.length === 0 ? "측정불가(분모0)" : violation.length === 0 ? "PASS" : `FAIL(${violation.length})`;
        if (pricedRows.length > 0) measurable += 1;
        console.log(
          `   ${pad(`${p.sid} ${p.code}`, 22)}${pad(p.suppliedUrls.length, 6)}${pad(p.rows.length, 6)}` +
            `${pad(shown.length, 6)}${pad(pricedRows.length, 6)}${pad(verdict, 15)}`,
        );
      }
      console.log(
        `\n   🔴 불변식 유효 분모 — 상품 ${measurable}/5 · 가격 후보 ` +
          `${out.reduce((n, p) => n + p.rows.filter((x) => x.priced).length, 0)}건`,
      );

      writeFileSync(join(FIX, "cand-02-rows.json"), JSON.stringify({ products: out }, null, 2));

      /**
       * 🔴🔴 **불변식은 여기서도 단언한다** — 화면 축(별 파일)과 **두 군데** 에서
       *    잠근다. 선택기만 보는 단언은 **배선이 끊겨도 통과** 하므로(WU-110 교훈)
       *    DOM 축이 따로 있고, 반대로 DOM 만 보면 어느 상품에서 깨졌는지 모른다.
       */
      for (const p of out) {
        for (const row of p.rows.filter((x) => x.priced)) {
          expect(
            row.display,
            `🔴 PRICE ⊄ DISPLAY — ${p.sid} ${row.domain} 가격이 있는데 후보 리스트에 없다\n   ${row.url}`,
          ).not.toBeNull();
        }
      }
      /** 🔴 숫자를 기대값으로 박지 않는다 — **측정이 돌았다** 는 것만 단언한다. */
      expect(out).toHaveLength(5);
    },
    2_400_000,
  );
});
