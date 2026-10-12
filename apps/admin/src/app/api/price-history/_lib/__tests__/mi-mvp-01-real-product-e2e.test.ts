/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI MVP 실상품 E2E 검증 — URL → Discovery → Identity → 가격 → GO/STOP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). **코드 변경 0 · DB 쓰기 0**(SELECT 와 HTTP 만).
 * 🔴 운영 owner 를 그대로 부른다. 복제 계산하지 않는다.
 *
 * ── 🔴🔴 지시서의 흐름과 «운영 경로» 의 차이를 먼저 적는다 ──────────────
 *   지시서: URL → **Google/Naver 후보 검색** → MI 검증 → 가격 → GO/STOP
 *   🔴 **`Google/Naver` 후보 검색은 운영 호출부가 «없다».** 선행 WU 둘이 전수로
 *      확정했다(counterfactual). `discovery-benchmark` 는 실험 모듈이고 운영
 *      가격/판정 경로가 import 하지 않는다.
 *   🟢 운영에 실재하는 후보 경로는 **국내 편집샵 검색** 하나다:
 *      `searchDomesticShops` → `withConfidence` → `judgeDomesticCandidate`
 *   → 🔴 그래서 이 하니스는 **운영 경로를 돌리고**, Google/Naver 단계는
 *      「경로 없음」으로 기록한다. **FAIL 로 적지 않는다** — 없는 기능의 실패가
 *      아니라 측정 대상이 아니다.
 *
 * ── 운영 owner (선행 WU 확정 · 재조사 안 함) ────────────────────────────
 *   후보 검색   `searchDomesticShops(dna, sources, …)`   crawler
 *   신뢰도      `withConfidence(query, candidates)`      match.ts:476
 *   최종 판정   `judgeDomesticCandidate(input)`          run-domestic-price-check.ts:533
 *   가격 tier   `priceTierFromLink`                      domestic-product-link.ts:86
 *   샵 목록     `listDomesticPriceSources(workspaceId)`  🔴 ON/OFF 는 workspace 설정
 *   탐색 대상   `isBatchSurveyTarget(source, scopes)`    :442
 *
 * ── 🔴 GO/STOP 어휘를 지어내지 않는다 ──────────────────────────────────
 *   운영 어휘는 `SellerFacingVerdictCode = RECOMMENDED|CONDITIONAL|NOT_RECOMMENDED`
 *   와 `PriceDecisionVerdict = MAINTAIN|CONSIDER_LOWER|MARGIN_RISK` 다.
 *   🔴 `GO`/`STOP` 은 **리포에 없는 말** 이므로, 이 하니스는 운영 값을 그대로 싣고
 *      그 옆에 지시서 어휘를 **파생 표기**로만 붙인다(새 판정을 만들지 않는다).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow {
  id: string; source_url: string; title: string; brand: string;
  sku: string | null; color: string | null; amt: string | null; cur: string | null;
  has_link: boolean;
}

/** 지시서 §3 의 각 단계를 «실제로 돌았는지» 로만 기록한다. */
interface StageResult {
  stage: string;
  status: "PASS" | "FAIL" | "NO_PRODUCTION_PATH" | "NOT_MEASURED";
  detail: string;
}

describe.skipIf(!LIVE)("🔴 MI-MVP-01 — 실상품 E2E", () => {
  it(
    "실상품 9개를 운영 owner 로 통과시켜 단계별 결과를 기록한다",
    async () => {
      const p = path.join(OUT_DIR, "e2e-urls.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const groups = JSON.parse(readFileSync(p, "utf8")) as Record<string, UrlRow[]>;
      const products = [
        ...groups.kids.map((r) => ({ ...r, category: "아동의류(Bobo 공식)" })),
        ...groups.kids2.map((r) => ({ ...r, category: "아동의류(Smallable)" })),
        ...groups.tennis.map((r) => ({ ...r, category: "테니스" })),
      ];

      /** 🟢 운영 owner 를 그대로 받는다. 🔴 「존재하는가」가 아니라 «실제로 부른다». */
      /** 🔴 `buildCrossSellerSearchQueries` 의 owner 는 **`@commerce/shared`** 다.
       *     처음에 `@commerce/crawler` 에서 받으려 해 `is not a function` 으로 터졌다
       *     — 패키지마다 확인한다(이 함정에 이번 트랙에서 두 번 걸렸다). */
      /** 🔴🔴 owner 를 «운영 코드의 import 블록» 에서 그대로 베꼈다.
       *     run-domestic-price-check.ts:1-22 가 정답이다 —
       *       @commerce/crawler : searchDomesticShops · withConfidence · …
       *       @commerce/shared  : buildCrossSellerSearchQueries ·
       *                           productFactsFromIdentityDna · buildProductIdentityDna
       *     🔴 두 번 틀렸다(둘 다 shared 인데 crawler 에서 받으려 했다). grep 으로
       *        「배럴 노출」을 추측하지 말고 **운영 import 블록을 읽는다.** */
      const { searchDomesticShops, withConfidence } =
        (await import("@commerce/crawler")) as unknown as {
          searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{ shopName: string; domain: string; status: string; candidates: { title: string; url: string; matchLevel?: string }[]; error?: string }[]>;
          withConfidence: (q: unknown, c: unknown[]) => unknown[];
        };
      const { buildProductIdentityDna, backfillCanonicalProduct, buildCrossSellerSearchQueries, productFactsFromIdentityDna } =
        (await import("@commerce/shared")) as unknown as {
          buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
          backfillCanonicalProduct: (p: unknown) => unknown;
          buildCrossSellerSearchQueries: (dna: unknown) => string[];
          productFactsFromIdentityDna: (dna: unknown) => unknown;
        };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      /** 🔴🔴 `listDomesticPriceSources` 를 «부를 수 없다** — `getSupabaseAdmin()` 이
       *     `SUPABASE_SERVICE_ROLE_KEY` 를 요구하고 그 값은 로컬에 없다(헌장 §10).
       *     🔴 처음에 그 함수를 불러 **샵 0개** 를 받았고, 그대로 두면
       *        「후보 0 = 검색 실패」라는 **완전히 틀린 결론**이 나왔다.
       *     🟢 그래서 같은 머지(카탈로그 + workspace 설정 · 설정 없으면 ON)를
       *        DB 에서 재현해 덤프했다. 로직을 바꾼 것이 아니라 **데이터 출처만** 바꿨다. */
      const allSources = JSON.parse(readFileSync(path.join(OUT_DIR, "e2e-sources.json"), "utf8")) as {
        id: string; name: string; domain: string; currency: string;
        collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
        status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
      }[];
      /** 🟢 운영 owner 를 그대로 부른다. scope 는 null(= 전체)로 둔다. */
      const targets = allSources.filter((s) => isBatchSurveyTarget(s as never, null));
      const autoTargets = targets.filter(
        (s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE",
      );
      const toRef = (s: (typeof allSources)[number]) => ({
        id: s.id, name: s.name, domain: s.domain, currency: s.currency,
        collectionStrategy: s.collectionStrategy,
      });
      // eslint-disable-next-line no-console
      console.log(`
🟢 실효 탐색 대상 ${targets.length} · 그중 AUTO_* ${autoTargets.length}: ` +
        autoTargets.map((s) => s.name).join(", "));

      const rows: Record<string, unknown>[] = [];
      for (const pr of products) {
        const stages: StageResult[] = [];

        /* ── ① 상품 원본 정보 (스냅샷에 이미 수집돼 있다) ── */
        const facts = {
          brand: pr.brand || null, title: pr.title, sku: pr.sku,
          color: pr.color, price: pr.amt, currency: pr.cur,
        };
        const factCount = Object.values(facts).filter((v) => v !== null && v !== "").length;
        stages.push({
          stage: "① 원본 정보 수집",
          status: factCount >= 4 ? "PASS" : "FAIL",
          detail: `확보 ${factCount}/6 — brand=${facts.brand ?? "∅"} sku=${facts.sku ?? "∅"} ` +
            `color=${facts.color ?? "∅"} ${facts.currency ?? "∅"} ${facts.price ?? "∅"}`,
        });

        /* ── ② Google/Naver 후보 검색 ── 🔴 운영 호출부 없음 */
        stages.push({
          stage: "② Google/Naver 후보 검색",
          status: "NO_PRODUCTION_PATH",
          detail: "🔴 운영 호출부 0(선행 WU 2개가 전수 확정). discovery-benchmark 는 " +
            "실험 모듈이고 운영 가격/판정 경로가 import 하지 않는다. FAIL 이 아니라 «경로 없음» 이다.",
        });

        /* ── ③ 국내 후보 탐색 — 🔴 실제로 부른다 ── */
        let searchDetail = "", candTotal = 0, shopErrors = 0, scored = 0, best = "";
        try {
          /** 🟢 운영과 같은 조립: DB 스냅샷 → backfill → DNA → query */
          const snapRows = JSON.parse(readFileSync(path.join(OUT_DIR, "e2e-snapshots.json"), "utf8")) as Record<string, unknown>[];
          const snap = snapRows.find((x) => x.id === pr.id);
          if (!snap) throw new Error("스냅샷 본문 없음");
          const product = backfillCanonicalProduct((snap as { canonicalProduct: unknown }).canonicalProduct);
          const dna = buildProductIdentityDna(product);
          const searchTerms = buildCrossSellerSearchQueries(dna).filter(Boolean);
          const query = {
            title: String((dna as { title?: string }).title ?? pr.title),
            brand: (dna as { brand?: { value?: string } }).brand?.value || undefined,
            sourceUrl: (dna as { sourceUrl?: string }).sourceUrl,
            sku: undefined,
            searchTerm: searchTerms[0] ?? pr.title,
            searchTerms,
            facts: productFactsFromIdentityDna(dna),
          };
          const results = await searchDomesticShops(query, autoTargets.map(toRef));
          candTotal = results.reduce((a, r) => a + r.candidates.length, 0);
          shopErrors = results.filter((r) => r.status === "error").length;
          const flat = results.flatMap((r) => r.candidates.map((c) => ({ ...c, shop: r.shopName })));
          const withConf = withConfidence(query, flat) as { matchLevel?: string; title?: string; shop?: string }[];
          scored = withConf.length;
          const top = withConf.find((c) => c.matchLevel === "very_high" || c.matchLevel === "high");
          best = top ? `${top.matchLevel} · ${top.shop} · ${String(top.title).slice(0, 34)}` : "(high 이상 없음)";
          searchDetail = `검색어 "${String(query.searchTerm).slice(0, 40)}" · 샵 ${autoTargets.length}곳 · ` +
            `후보 ${candTotal} · 오류샵 ${shopErrors} · scored ${scored} · best ${best}`;
        } catch (e) {
          searchDetail = `🔴 호출 실패: ${e instanceof Error ? e.message : String(e)}`;
        }
        stages.push({
          stage: "③ 국내 후보 탐색 (실제 호출)",
          /** 🔴 「돌았다」를 PASS 로 쓰지 않는다 — 후보가 0 이면 FAIL 이 아니라 후보 부재다 */
          status: searchDetail.startsWith("🔴") ? "FAIL" : candTotal > 0 ? "PASS" : "NOT_MEASURED",
          detail: searchDetail + (candTotal === 0 && !searchDetail.startsWith("🔴")
            ? " → 🔴 후보 0. 「검색 실패」와 「그 샵에 그 상품이 없음」을 구분할 수 없다(측정불가)" : ""),
        });

        /* ── ④ Identity ── 🔴 운영 DB 에 남은 실제 판정을 쓴다(복제 금지) ── */
        stages.push({
          stage: "④ Identity (운영 결과)",
          status: pr.has_link ? "PASS" : "NOT_MEASURED",
          detail: pr.has_link
            ? "운영이 이 상품에 국내 링크를 만들었다 → matchTruth/tier 는 DB 값 사용"
            : "🔴 운영 링크 0 — 이 상품은 운영이 아직 국내 후보를 확보하지 못했다. " +
              "「Identity 실패」가 아니라 **후보 부재** 다(선행 WU: 429/498 이 같은 상태)",
        });

        /* ── ⑤ 가격 / 통화 ── */
        const curOk = !!pr.cur && pr.cur !== "KRW";
        stages.push({
          stage: "⑤ 가격·통화 (원본)",
          status: pr.amt && pr.cur ? "PASS" : "FAIL",
          detail: `${pr.cur ?? "∅"} ${pr.amt ?? "∅"} · 원본 통화인가=${curOk}` +
            (pr.cur === "KRW" ? " 🔴 KRW 면 «판매처의 한국 표시가» 일 수 있다" : ""),
        });

        /* ── ⑥ GO/STOP ── 🔴 데이터가 없으면 GO 로 추정하지 않는다 ── */
        const canDecide = pr.has_link && !!pr.amt && !!pr.cur;
        stages.push({
          stage: "⑥ GO/STOP",
          status: canDecide ? "PASS" : "FAIL",
          detail: canDecide
            ? "국내 링크 + 원본 가격이 둘 다 있다 → 비교 가능"
            : "🔴 **STOP** — 국내 동일상품 후보가 없어 비교 자체가 불가능하다. " +
              "지시서 §4-④ 대로 **GO 로 추정하지 않았다.**",
        });

        rows.push({
          category: pr.category, brand: pr.brand || "(빈 브랜드)",
          title: pr.title.slice(0, 44), url: pr.source_url.slice(0, 90),
          sku: pr.sku, color: pr.color, price: `${pr.cur ?? "∅"} ${pr.amt ?? "∅"}`,
          hasDomesticLink: pr.has_link,
          stages,
          verdict: canDecide ? "GO 후보" : "STOP",
          verdictReason: canDecide
            ? ["동일상품 링크 확인", "원본 가격·통화 확인"]
            : [
                ...(pr.has_link ? [] : ["🔴 국내 동일상품 후보 없음"]),
                ...(pr.amt && pr.cur ? [] : ["🔴 원본 가격/통화 없음"]),
                ...(pr.brand ? [] : ["🔴 브랜드 미확정"]),
              ],
        });
      }

      const tally = (xs: string[]) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[x] = (t[x] ?? 0) + 1;
        return t;
      };
      const report = {
        "🟢 DISCLAIMER": "코드 변경 0 · DB 쓰기 0 · 운영 owner 를 그대로 썼다. " +
          "🔴 Google/Naver 단계는 운영 호출부가 없어 «경로 없음» 으로 기록했다(FAIL 아님).",
        "🔴 어휘 주의": "GO/STOP 은 리포에 없는 말이다. 운영 어휘는 " +
          "SellerFacingVerdictCode(RECOMMENDED|CONDITIONAL|NOT_RECOMMENDED) · " +
          "PriceDecisionVerdict(MAINTAIN|CONSIDER_LOWER|MARGIN_RISK) 다. " +
          "이 표의 GO/STOP 은 지시서 어휘를 쓴 **파생 표기** 이고 새 판정이 아니다.",
        scope: { products: rows.length, categories: tally(rows.map((r) => String(r.category))) },
        verdicts: tally(rows.map((r) => String(r.verdict))),
        stageTally: tally(rows.flatMap((r) => (r.stages as StageResult[]).map((s) => `${s.stage} = ${s.status}`))),
        products: rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mvp-e2e.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThanOrEqual(5);
    },
    60 * 60 * 1000,
  );
});
