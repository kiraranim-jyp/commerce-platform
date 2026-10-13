/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-SAME-DAY-GUARD-RATE-018 — 당일 가드 발화 측정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini API 호출 0.** 🔴 국내 검색 HTTP 는 쓴다(「무료」가 아니다 · 별도 집계).
 *
 * 🔴 운영 게이트와 **같은 순서** 로 다섯 범주를 가른다:
 * ```
 * ① veryHighSkipped            국내가 very_high 를 냈다 → Gemini 안 부름
 * ② sameDayChecked             오늘 이미 확인됐다
 * ③ geminiSkippedBySameDayGuard ②이면서 ①이 아닌 것 = **당일 가드가 실제로 막는 수**
 * ④ noPrimaryQuery             Primary Query 를 만들 수 없다 → 호출 0
 * ⑤ geminiEligible             위 어디에도 안 걸린다 → 실제 Gemini 필요
 * ```
 *
 * 🔴🔴 **「상품당 재확인 횟수」는 이 데이터로 잴 수 없다**(§「중요한 제한」).
 *    `hasObservationToday` 멱등 때문에 같은 날 반복 확인은 **행을 남기지 않는다.**
 *    그래서 「당일 가드가 실제로 몇 번 막았는가」가 아니라
 *    **「재확인이 지금 오면 막힐 상품이 몇 %인가」**(발화 자격률)를 잰다.
 *    🔴 둘을 같은 숫자로 쓰지 않는다.
 *
 * 🔴 threshold 0 · DB 쓰기 0 · 기본값 SKIP(`MI_P0_02_LIVE=1`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown; description: string | null }
interface ObsRow { snapshot_id: string; checked_at: string }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}
interface RawResult { shopId: string; domain: string; status: string; candidates: Record<string, unknown>[] }

const pct = (n: number, d: number) => (d === 0 ? null : `${((n / d) * 100).toFixed(1)}%`);

describe.skipIf(!LIVE)("🔴 MI-018 — 당일 가드 발화 (Gemini 호출 0)", () => {
  it(
    "운영 게이트와 같은 순서로 다섯 범주를 센다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<SnapRow[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      /** 🔴 `hasObservationToday` 는 로컬에서 service-role key 가 없으면 **조용히
       *     false** 다(헌장 §12 함정). 그러면 「가드 발화 0」이라는 거짓 결론이 난다.
       *  🟢 그래서 같은 판정을 **덤프한 관측 행** 으로 재현한다. */
      const observations = read<ObsRow[]>("e2e-observations.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<RawResult[]>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");
      const { buildPrimaryQuery } = (await import("@commerce/crawler/src/discovery-core")) as unknown as {
        buildPrimaryQuery: (i: unknown) => { text: string; level: string };
      };

      const targetsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => isBatchSurveyTarget(s as never, scopes))
          .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /** 🟢 운영 pool 과 같은 식으로 identity 를 만든다. */
      const identityFromDna = (dna: Record<string, unknown>) => {
        const brand = dna.brand as { value?: string } | undefined;
        const category = dna.category as { value?: string } | undefined;
        return {
          brand: brand?.value || null,
          productName: String(dna.title ?? "").split("|")[0]?.trim() || String(dna.title ?? ""),
          productType: category?.value?.split(">").pop()?.trim() ?? null,
          genderAge: (dna.ageRange as string | null) ?? null,
          color: (dna.color as string | null) ?? null,
          size: null, season: null,
          productCode: (dna.brandModelCode as string | null) ?? null,
          sourceUrl: String(dna.sourceUrl ?? ""), sourceSite: null,
          sourceCountry: null, market: null,
        };
      };

      /** 🔴 운영 `hasObservationToday` 와 **같은 기준** — UTC 자정 이후 관측이 있는가. */
      const startOfTodayUtc = new Date();
      startOfTodayUtc.setUTCHours(0, 0, 0, 0);
      const checkedTodaySet = new Set(
        observations.filter((o) => new Date(o.checked_at) >= startOfTodayUtc).map((o) => o.snapshot_id),
      );
      /** 🟢 일자별 관측 분포 — 「같은 날 여러 번」이 행으로 남는지 확인한다. */
      const dayCount = new Map<string, Set<string>>();
      const rowCount = new Map<string, number>();
      for (const o of observations) {
        const d = new Date(o.checked_at).toISOString().slice(0, 10);
        if (!dayCount.has(o.snapshot_id)) dayCount.set(o.snapshot_id, new Set());
        dayCount.get(o.snapshot_id)!.add(d);
        rowCount.set(o.snapshot_id, (rowCount.get(o.snapshot_id) ?? 0) + 1);
      }

      const seen = new Set<string>();
      const kids = [...(groups.control ?? []), ...groups.kids, ...groups.kids2]
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      const plan = [
        ...kids.map((row) => ({ row, scope: "KIDS_FASHION" })),
        ...groups.tennis.map((row) => ({ row, scope: "TENNIS" })),
      ];

      const rows: Record<string, unknown>[] = [];
      let shopRequests = 0;

      for (const { row, scope } of plan) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) continue;
        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts,
        };
        const targets = targetsFor([scope]);
        const results = await crawler.searchDomesticShops(
          query,
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );
        shopRequests += results.length;

        /** ① — 운영 게이트와 같은 술어 */
        const veryHigh = results.some((r) =>
          r.status === "ok" ? r.candidates.some((c) => c.matchLevel === "very_high") : false,
        );
        /** ② — 운영과 같은 기준(UTC 자정) */
        const sameDay = checkedTodaySet.has(row.id);
        /** ④ — 순수 함수 · HTTP 0 */
        const primary = buildPrimaryQuery(identityFromDna(dna) as never);
        const noPrimary = primary.text === "";

        /** 🟢 운영 «순서» 그대로: ① → ② → (호출 시) ④ */
        const decision = veryHigh
          ? "DETERMINISTIC_HIT"
          : sameDay
            ? "ALREADY_CHECKED_TODAY"
            : noPrimary
              ? "NO_PRIMARY_QUERY"
              : "GEMINI_ELIGIBLE";

        rows.push({
          scope, brand: row.brand, title: row.title.slice(0, 40),
          "① veryHigh": veryHigh,
          "② 오늘 이미 확인": sameDay,
          "④ Primary 없음": noPrimary,
          "primary level": primary.level,
          "🔴🔴 결정": decision,
          "관측 일수": dayCount.get(row.id)?.size ?? 0,
          "관측 행수": rowCount.get(row.id) ?? 0,
        });
      }

      const n = rows.length;
      const by = (d: string) => rows.filter((r) => r["🔴🔴 결정"] === d).length;
      const sameDayAll = rows.filter((r) => r["② 오늘 이미 확인"]).length;
      /** 🔴 당일 가드가 «실제로 막는» 수 = ② 이면서 ① 이 아닌 것. */
      const guardBlocks = rows.filter((r) => r["② 오늘 이미 확인"] && !r["① veryHigh"]).length;
      /** 🔴 같은 날 여러 행이 남은 상품 — 멱등이 뚫렸는지 확인하는 대조군. */
      const multiRowSameDay = rows.filter((r) => Number(r["관측 행수"]) > Number(r["관측 일수"])).length;

      const report = {
        "🔴🔴 DISCLAIMER":
          `sample 상품 N=${n}. 🔴 **Gemini API 호출 0.** 🔴 국내 검색 HTTP ${shopRequests} 요청 사용 ` +
          "— 「무료」가 아니다. 🔴 threshold 0 · DB 쓰기 0. " +
          "🔴🔴 이 숫자는 **이 표본의 발화 «자격률»** 이고 운영 전수 절감액이 아니다.",
        "① 다섯 범주 (운영 게이트와 같은 순서)": {
          "① veryHighSkipped": by("DETERMINISTIC_HIT"),
          "③ geminiSkippedBySameDayGuard": by("ALREADY_CHECKED_TODAY"),
          "④ noPrimaryQuery": by("NO_PRIMARY_QUERY"),
          "⑤ geminiEligible": by("GEMINI_ELIGIBLE"),
          합계: n,
        },
        "② 당일 가드": {
          "② sameDayChecked (①과 중복 포함)": sameDayAll,
          "🔴 당일 가드가 실제로 막는 수(②이고 ①아님)": guardBlocks,
          "발화 자격률": pct(guardBlocks, n),
        },
        "③ Gemini 를 부르게 되는 비율": {
          "⑤ geminiEligible": by("GEMINI_ELIGIBLE"),
          비율: pct(by("GEMINI_ELIGIBLE"), n),
          "🟢 세 게이트가 합쳐서 막는 비율": pct(n - by("GEMINI_ELIGIBLE"), n),
        },
        "④🔴🔴 잴 수 없는 것 — 상품당 재확인 «횟수»": {
          "같은 날 여러 행이 남은 상품": multiRowSameDay,
          "🔴 설명":
            "`hasObservationToday` 멱등 때문에 같은 날 반복 확인은 **행을 남기지 않는다**. " +
            "그래서 「당일 가드가 실제로 몇 번 막았는가」는 **이 데이터로 측정 불가** 다. " +
            "위 숫자는 「재확인이 지금 오면 막힐 상품 수」(자격)이다. 둘을 섞지 않는다.",
          "🟢 측정 가능해지는 조건":
            "운영 코드에 추가한 `[MI-016-gate]` 로그 한 줄이 flag ON 상태에서 " +
            "skip 이유를 매 호출 찍는다 → 그 로그를 세면 **실제 발화 횟수** 가 나온다.",
        },
        "⑤🔴 국내 HTTP (Gemini 와 다른 축)": {
          "샵 검색 요청": shopRequests,
          "상품당": n ? +(shopRequests / n).toFixed(2) : null,
          "🔴 Gemini 호출": 0,
        },
        "⑥ primary level 분포": rows.reduce<Record<string, number>>((a, r) => {
          const k = String(r["primary level"]);
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {}),
        products: rows,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `guard018-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `guard018-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${n}건 — guard018-${seq}.json)` }, null, 1));

      expect(n).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
