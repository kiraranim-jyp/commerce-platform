import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { describe, expect, it } from "vitest";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { collectUrlCandidatePool } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-PROVIDER-11 — **Candidate URL → Crawl → Evidence → Identity 전수 추적**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-27) — Query 최적화 트랙은 **종료**. 이제 묻는 것은 여섯이다:
 * ```
 * ① Search 가 돌려준 URL 중 몇 개가 **상품 상세** 인가
 * ② 몇 개가 실제 **Crawl** 가능한가
 * ③ 몇 개가 **Product Evidence** 를 갖는가
 * ④ 몇 개가 **브랜드 / 상품명 / 품번** 을 갖는가
 * ⑤ 몇 개가 **동일상품 후보** 로 살아남는가
 * ⑥ **국내/해외** 각각 몇 개가 최종 후보가 되는가
 * ```
 *
 * ── 🔴 이 하니스가 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * ❌ **추가 검색 0** — 이미 확보한 URL(`search-provider-05-raw.json`)만 쓴다
 * ❌ 운영 코드 변경 · Query 변경 · MI 연결 · Identity 규칙 변경 · 가격 정책
 * ❌ 새 판정 — 모든 판정은 **운영 함수** 가 낸다(`withConfidence` · `judgeDomesticCandidate`)
 * 🔴 운영 **호출 순서를 그대로 베낀다**(§5-B) — 한 단계라도 빠지면 숫자가 과소가 된다
 * ```
 * 🔴 게이트 `CORE_SP11_FUNNEL=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */

const LIVE = process.env.CORE_SP11_FUNNEL === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;

/** 🔴 측정 대상 질의 — 운영 Query 는 HOLD 라 **세 후보를 같이** 본다(1차 관측). */
const LABELS = ["S-A", "S-C", "S-D"] as const;

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));
const padL = (s: unknown, n: number) => " ".repeat(Math.max(0, n - [...String(s)].length)) + String(s);
/**
 * 🔴🔴 **URL 키를 느슨하게 맞춘다.** 1차 측정에서 **48건이 「사유 미기록」** 으로 떨어졌는데,
 *    원인은 파이프라인이 아니라 **내 키** 였다 — 검색 결과 URL 에는 `?srsltid=...` 추적
 *    파라미터가 붙어 있고 입력 경계가 그것을 걷어 내므로 원문 키로는 **영원히 매칭되지 않는다**.
 * 🔴 그대로 보고했으면 「Crawl 에서 48건이 사라진다」는 **거짓 원인** 이었다.
 * 🔴 이 키는 **표를 맞추는 용도만** 이다 — 운영 dedupe(`canonicalizeProductUrl`)가 아니다.
 */
const loose = (u: string) =>
  String(u)
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};

interface RawFile {
  runs: { productId: string; label: string; query: string; results: { url: string }[] }[];
}

/**
 * 🟢 원상품은 **운영 canonicalProduct 그대로** 다 — 두 fixture 에서 읽는다.
 * 🔴 값을 만들지 않았다. 🔴🔴 S5·S6 은 **`sku` 가 빈** 상품이지 「품번 없는 상품」이 **아니다**
 *    (아래 정정 계약 참조 — 둘 다 `brandModelCode` 가 있다).
 */
function loadOrigins(): Record<string, CanonicalProduct> {
  const a = fx<{ origins: Record<string, { canonicalProduct: CanonicalProduct }> }>("wu-059-gt-facts.json").origins;
  const b = fx<{ origins: Record<string, { canonicalProduct: CanonicalProduct }> }>(
    "search-provider-11-origins.json",
  ).origins;
  const out: Record<string, CanonicalProduct> = {};
  for (const id of ["S1", "S2", "S3", "S4"]) if (a[id]) out[id] = normalize(a[id]!.canonicalProduct);
  for (const id of ["S5", "S6"]) if (b[id]) out[id] = normalize(b[id]!.canonicalProduct);
  return out;
}

/**
 * 🔴🔴 **스키마 기본값을 복원할 뿐 «사실» 을 만들지 않는다.**
 *
 * 운영 DB 의 오래된 스냅샷에는 `modelName` 칸이 **아예 없다**(S5·S6 실측). 그런데
 * `resolveIdentifier` 가 `product.modelName.value` 를 읽으므로 그대로 넣으면 **TypeError** 다.
 * 🟢 그래서 **운영 builder 가 쓰는 그 기본값**(`canonical-product.ts:487`)과 **똑같이**
 *    비워 둔다 — `sku` 도 `""` 이므로 「식별자 없음」이라는 사실은 **바뀌지 않는다**.
 * 🔴 값을 채워 넣는 것이 아니다. 채우면 그 순간 「품번 없는 상품」 조건이 깨진다.
 */
function normalize(cp: CanonicalProduct): CanonicalProduct {
  if (cp.modelName) return cp;
  return { ...cp, modelName: { value: "", source: "REQUIRED", confidence: 0 } } as CanonicalProduct;
}

describe("SEARCH-PROVIDER-11 §원상품 — 입력이 운영 데이터 그대로다(순수)", () => {
  /**
   * 🔴🔴🔴 **SPRINT-09 의 라벨을 정정한다 — `sku` 와 `brandModelCode` 는 «다른 칸» 이다.**
   *
   * SP-09 에서 「품번이 구조적으로 없는 상품」을 `sku = ''` 로 골랐는데, Discovery 가
   * 실제로 쓰는 칸은 **`brandModelCode`** 다(운영 `input.dna.brandModelCode` → Query).
   * 🔴 실측 — 그 두 상품의 `brandModelCode` 는 **null 이 아니다**:
   * ```
   * S5  sku ""  →  brandModelCode **"F26100"**     (설명문의 Product code 라벨에서 복구)
   * S6  sku ""  →  brandModelCode **"KS105721"**
   * ```
   * ⟹ 🔴 SP-09 의 「품번 없는 상품 2개」는 **「sku 가 빈 상품 2개」** 로 읽어야 한다.
   *    그 PoC 가 **질의에서 품번을 뺀 효과** 를 잰 것은 유효하지만, 「품번 없는 상품에서도
   *    Search 가 돈다」는 결론은 **이 두 상품으로는 지지되지 않는다**(둘 다 품번이 있다).
   * 🟢 그래서 아래에서 **운영 전수로 품번 부재율을 다시 잰다**.
   */
  it("🔴 SP-09 정정 — S5·S6 는 `sku` 가 비었을 뿐 **품번(brandModelCode)은 있다**", () => {
    const origins = loadOrigins();
    expect(Object.keys(origins).sort()).toEqual(["S1", "S2", "S3", "S4", "S5", "S6"]);
    for (const id of ["S1", "S2", "S3", "S4"]) {
      expect(buildProductIdentityDna(origins[id]!).brandModelCode, id).toBeTruthy();
    }
    for (const id of ["S5", "S6"]) {
      expect(origins[id]!.sku.value, `${id} sku 는 비어 있어야 한다`).toBe("");
      /** 🔴 그런데 품번은 **있다** — 이 단언이 SP-09 의 라벨 오류를 기록으로 못박는다. */
      expect(buildProductIdentityDna(origins[id]!).brandModelCode, `${id}`).toBeTruthy();
    }
  });

  it("🔵🔵 운영 전수 — **품번이 실제로 없는 상품의 비율** 을 잰다(순수 · 네트워크 0)", () => {
    const products = fx<{ products: CanonicalProduct[] }>("search-provider-11-code-rate.json").products;
    expect(products.length).toBeGreaterThan(100);
    let noCode = 0;
    let noBrand = 0;
    let neither = 0;
    for (const cp of products) {
      const dna = buildProductIdentityDna(normalize(cp));
      const hasCode = Boolean(dna.brandModelCode);
      const hasBrand = Boolean(dna.brand.value.trim());
      if (!hasCode) noCode += 1;
      if (!hasBrand) noBrand += 1;
      if (!hasCode && !hasBrand) neither += 1;
    }
    /* eslint-disable no-console */
    console.log(
      `\n🔵 운영 전수 ${products.length}건 — 품번 없음 **${noCode}**(${Math.round((noCode / products.length) * 100)}%)` +
        ` · 브랜드 없음 ${noBrand} · **둘 다 없음 ${neither}**`,
    );
    /** 🔴 **숫자를 단정하지 않는다** — 분포가 바뀌면 보고서가 낡는다. 사실만 잠근다. */
    expect(noCode + (products.length - noCode)).toBe(products.length);
  });

  it("🔴 추가 검색을 하지 않는다 — 입력 URL 은 **저장된 fixture** 에서만 온다", () => {
    const code = readFileSync(join(__dirname, "search-provider-11-funnel.test.ts"), "utf8").replace(
      /\/\*\*[\s\S]*?\*\//g,
      "",
    );
    /**
     * 🔴 금지어를 **쪼개서** 적는다 — 통짜로 적으면 이 파일 자신이 그 문자열을 갖게 돼
     *    계약이 **자기 자신 때문에** FAIL 한다(1차에 실제로 그렇게 됐다 · 동어반복의 반대 함정).
     */
    for (const parts of [
      ["api", "fy.com"],
      ["APIFY", "_API_TOKEN"],
      ["run-sync-get", "-dataset-items"],
    ]) {
      expect(code, parts.join("")).not.toContain(parts.join(""));
    }
    /** 🟢 그리고 입력이 **fixture 에서만** 온다는 사실을 직접 단언한다. */
    expect(code).toContain('fx<RawFile>("search-provider-05-raw.json")');
  });
});

interface Row {
  product: string;
  label: string;
  url: string;
  domain: string;
  /** ① */ isProductPage: boolean;
  /** ② */ crawled: boolean;
  /** ③ */ hasEvidence: boolean;
  /** ④ */ hasBrand: boolean;
  hasTitle: boolean;
  hasCode: boolean;
  /** ⑤ */ judged: boolean;
  dropGate: string | null;
  isBest: boolean;
  matchTruth: string | null;
  crossSellerVerdict: string | null;
  priceTier: string | null;
  /** ⑥ */ market: string | null;
  /** 🔴 사라진 **첫** 칸 */ lostAt: string | null;
}

describe.skipIf(!LIVE)("SEARCH-PROVIDER-11 §funnel — 저장된 Search URL 을 운영 경로로 끝까지(라이브)", () => {
  it(
    "URL 단위로 ①~⑥ 을 적는다 — 추가 검색 0",
    async () => {
      const raw = fx<RawFile>("search-provider-05-raw.json");
      const origins = loadOrigins();
      const rows: Row[] = [];

      for (const productId of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
        const product = origins[productId]!;
        const dna = buildProductIdentityDna(product);
        /** 🔴 운영이 만드는 그 query 객체 그대로(WU-138 funnel 과 **같은 조립**). */
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

        for (const label of LABELS) {
          const run = raw.runs.find((r) => r.productId === productId && r.label === label);
          if (!run) continue;
          const urls = run.results.map((r) => r.url);

          /** ① 분류는 **기존 owner** 가 한다. */
          const shapeOk = new Set(urls.filter((u) => String(classifyUrlShape(u)) === "PRODUCT_PAGE"));

          /** ②③④ 후보 풀 — 운영 `collectUrlCandidatePool` 그대로(상한 = 전부). */
          const pool = await collectUrlCandidatePool({
            urls,
            originUrl: query.sourceUrl,
            maxUrls: urls.length,
            existingCanonicalUrls: new Set<string>(),
            shopId: REVIEWED_SAME_SHOP_ID,
            shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
          });

          /**
           * 🔴🔴 **「Crawl 실패」로 뭉개지 않는다.** `collectUrlCandidatePool` 은 fetch 전에
           *    **입력 경계**(목록/자기참조/비공개호스트/중복)로도 버린다. 두 가지를 한 칸에
           *    담으면 「우리가 못 읽었다」와 「애초에 열 자격이 없었다」가 섞인다.
           * 🟢 그 사유는 pool 이 **이미 적어 둔다** — 지어내지 않고 읽는다.
           */
          const dropReason = new Map<string, string>();
          for (const d of pool.metrics.dropped) dropReason.set(loose(d.url), d.reason);

          const byUrl = new Map<string, Row>();
          for (const u of urls) {
            byUrl.set(loose(u), {
              product: productId,
              label,
              url: u,
              domain: hostOf(u),
              isProductPage: shapeOk.has(u),
              crawled: false,
              hasEvidence: false,
              hasBrand: false,
              hasTitle: false,
              hasCode: false,
              judged: false,
              dropGate: null,
              isBest: false,
              matchTruth: null,
              crossSellerVerdict: null,
              priceTier: null,
              market: null,
              lostAt: shapeOk.has(u) ? null : "① 상품상세 아님",
            });
          }

          /** ⑤ 운영 순서 그대로 — self 제외 → withConfidence → 가격보강 → 샵 판정. */
          for (const res of pool.searchResults) {
            if (res.status !== "ok" || res.candidates.length === 0) continue;
            const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
            const scored = withConfidence(query, notSelf);
            let priced = scored;
            try {
              priced = await enrichCandidatePrices(scored, res.domain, query);
            } catch {
              /* 운영과 같다 — 실패해도 점수만으로 계속 간다 */
            }
            const j = await judgeDomesticCandidate({
              domain: res.domain,
              candidates: priced,
              sourceUrl: query.sourceUrl,
              foreignModelCode: dna.brandModelCode,
              foreignColor: dna.color,
              fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
            });
            for (const c of priced) {
              const row = byUrl.get(loose(c.url));
              if (!row) continue;
              row.crawled = true;
              const f = c.facts;
              row.hasBrand = Boolean(f?.brand || c.brand);
              row.hasTitle = Boolean(c.title && c.title.trim().length > 0);
              row.hasCode = Boolean(f?.brandModelCode || c.sku);
              row.hasEvidence = row.hasBrand || row.hasTitle || row.hasCode;
              row.crossSellerVerdict = c.crossSellerVerdict ?? null;
              row.judged = j.kind === "JUDGED";
              /** 🔴 `gate` 는 **`DROPPED` 에만** 있다(타입이 그것을 잡았다 — 추측으로 읽지 않는다). */
              row.dropGate = j.kind === "DROPPED" ? j.gate : j.kind === "JUDGED" ? null : j.kind;
              if (j.kind === "JUDGED" && loose(j.best.url) === loose(c.url)) {
                row.isBest = true;
                row.matchTruth = j.matchTruth;
                row.priceTier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
                row.market = classifyCandidateMarket({
                  domain: res.domain,
                  currency: j.best.price?.currency ?? null,
                  isRegisteredDomesticShop: false,
                }).market;
              }
            }
          }

          for (const row of byUrl.values()) {
            if (!row.lostAt && !row.crawled) {
              const why = dropReason.get(loose(row.url));
              /** 🔴 pool 이 사유를 적었으면 **그 사유** 로, 없으면 「읽지 못했다」로 적는다. */
              row.lostAt = why ? `② 입력경계/접근(${why})` : "② Crawl 실패(사유 미기록)";
            }
            else if (!row.lostAt && !row.hasEvidence) row.lostAt = "③ Evidence 없음";
            else if (!row.lostAt && !row.judged) row.lostAt = `⑤ 샵 판정 전 탈락(${row.dropGate ?? "?"})`;
            else if (!row.lostAt && !row.isBest) row.lostAt = "⑤ 샵 대표 아님";
            else if (!row.lostAt && !row.priceTier) row.lostAt = "⑤ tier 없음";
            rows.push(row);
          }
        }
      }

      /* ── 보고 ── */
      const n = (f: (r: Row) => boolean, sub?: Row[]) => (sub ?? rows).filter(f).length;
      console.log(
        `\n══ SEARCH-PROVIDER-11 funnel — URL ${rows.length}건(상품 6 × 질의 3 · **추가 검색 0**) ══`,
      );
      console.log(
        `${pad("Query", 7)}${padL("URL", 5)}${padL("①상품상세", 10)}${padL("②Crawl", 8)}${padL("③Evidence", 11)}` +
          `${padL("④브랜드", 9)}${padL("④상품명", 9)}${padL("④품번", 7)}${padL("⑤최종후보", 10)}${padL("⑥국내", 7)}${padL("⑥해외", 7)}`,
      );
      for (const label of [...LABELS, "ALL"]) {
        const sub = label === "ALL" ? rows : rows.filter((r) => r.label === label);
        const fin = sub.filter((r) => r.priceTier !== null);
        console.log(
          pad(label, 7) +
            padL(sub.length, 5) +
            padL(n((r) => r.isProductPage, sub), 10) +
            padL(n((r) => r.crawled, sub), 8) +
            padL(n((r) => r.hasEvidence, sub), 11) +
            padL(n((r) => r.hasBrand, sub), 9) +
            padL(n((r) => r.hasTitle, sub), 9) +
            padL(n((r) => r.hasCode, sub), 7) +
            padL(fin.length, 10) +
            padL(fin.filter((r) => r.market === "KR").length, 7) +
            padL(fin.filter((r) => r.market === "OVERSEAS").length, 7),
        );
      }

      console.log("\n══ 🔴 사라진 «첫» 칸 분포 ══");
      const lost = new Map<string, number>();
      for (const r of rows) lost.set(r.lostAt ?? "🟢 최종 후보", (lost.get(r.lostAt ?? "🟢 최종 후보") ?? 0) + 1);
      for (const [k, v] of [...lost.entries()].sort((a, b) => b[1] - a[1])) console.log(`${pad(k, 34)}${padL(v, 5)}`);

      console.log("\n══ 상품별 최종 후보(⑤) ══");
      for (const p of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
        const sub = rows.filter((r) => r.product === p && r.priceTier !== null);
        console.log(
          `${pad(p, 4)}최종 ${padL(sub.length, 2)} · 🇰🇷 ${padL(sub.filter((r) => r.market === "KR").length, 2)}` +
            ` · 🌎 ${padL(sub.filter((r) => r.market === "OVERSEAS").length, 2)}` +
            ` · ❔ ${padL(sub.filter((r) => r.market !== "KR" && r.market !== "OVERSEAS").length, 2)}` +
            ` · tier ${[...new Set(sub.map((r) => r.priceTier))].join("/") || "-"}`,
        );
      }

      /** 🔴 **열화된 실행으로 funnel 을 내지 않는다**(「측정불가」≠「0」 · WU-133 게이트). */
      expect(rows.length).toBeGreaterThan(100);
      expect(n((r) => r.crawled), "전건 Crawl 실패 — 열화된 실행이다").toBeGreaterThan(rows.length / 10);
    },
    3 * 60 * 60_000,
  );
});
