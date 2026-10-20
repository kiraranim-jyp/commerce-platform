/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-133 — **기존 human SAME 전수 추적 · SAME 0 원인 확정** (게이트 없으면 SKIP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 게이트 `WU_133_PROBE=1` 없으면 **SKIP**(회귀에서 외부 HTTP 금지).
 * 🔴 DB 쓰기 0 · AI 0 · Gemini 0 · threshold 0 · 판정 로직 변경 0.
 *
 * 🔴🔴🔴 **이 WU 가 답해야 하는 질문 하나** (CPO 2026-10-20):
 * ```
 * 「우리가 이미 사람이 SAME 이라 확인한 실제 상품이, 현재 시스템에서 어디까지
 *   살아가는가?」 — 「SAME 0」을 「동일상품이 없다」로도 「MI 가 정확하다」로도
 *   닫지 않는다. 원인을 네 갈래 중 하나로 **확정** 한다:
 *     ① Discovery(검색이 못 찾음) ② Pipeline(canonical/filter 제거)
 *     ③ MI matching(SAME → SIMILAR/CONFLICT) ④ Evidence/Price(가격 단계 탈락)
 * ```
 *
 * 🔴 **운영 호출 순서를 그대로 베낀다**(헌장 §5-B). WU-132 에서 `withConfidence` →
 *    `enrichCandidatePrices` 를 빠뜨려 거짓 원인을 낼 뻔한 그 자리다.
 *
 * 🔴🔴🔴 **이 파일에 `@vitest-environment jsdom` 을 «붙이지 않는다».**
 *    실측으로 당했다 — 마운트 테스트를 같이 두려고 jsdom 을 붙인 순간 crawler 의
 *    fetch 경로가 **전건 UNREACHABLE** 이 되고(같은 URL 을 curl 은 200 으로 받는다)
 *    funnel 이 **전부 0** 으로 나왔다. 🔴 그대로 보고했으면 「Discovery 가 완전히
 *    죽었다」는 거짓 결론이었다. 🟢 마운트 DOM 축은 `wu-133-pending-note-render`
 *    **별 파일** 이 본다 — 두 축을 한 파일에 두지 않는다.
 *
 * 🔴 선행 덤프(`packages/database` 에서):
 *    `node --env-file=.env scripts/mi-010-comparison-shops-dump.mjs`
 *    `node --env-file=.env scripts/wu-130-snapshot-dump.mjs`
 *    `node --env-file=.env scripts/wu-133-gt-origin-dump.mjs`
 *  그리고 GT 집계(`wu-133-gt-same.json`)는 이 파일이 fixtures 에서 **직접** 만든다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
  type ComparisonCandidate,
} from "@commerce/crawler";
import {
  backfillCanonicalProduct,
  buildCrossSellerSearchQueries,
  buildProductIdentityDna,
  productFactsFromIdentityDna,
} from "@commerce/shared";
import { collectOverseasAutoPool } from "../overseas-auto-pool";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate, MAX_SUPPLIED_CANDIDATE_URLS } from "../run-domestic-price-check";
import { classifyCandidateMarket } from "../candidate-market";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { BLOCKER_OTHER_TEXT } from "../../../../pipeline/commerce/blocker-text";
import {
  pendingNote,
  selectMiSameCandidates,
  countPendingCandidates,
  transientDisplayTier,
} from "../../../../pipeline/commerce/mi-same-candidates";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

const LIVE = process.env.WU_133_PROBE === "1";
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

/** 🔴 비교용 정규화 — 운영 `canonicalizeProductUrl` 과 **다른 목적** 이다(여기서는
 *  「같은 후보인가」를 사람이 읽기 위한 느슨한 키). 운영 키는 pool 이 소유한다. */
const loose = (u: string) =>
  String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

interface Snap {
  id: string;
  source_url: string;
  title: string;
  workspace_id: string;
  workspace: Record<string, unknown>;
}
interface ShopRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  access_status: string | null;
  category_scope: string[] | null;
}

/* ═══════════════ A. GT 집계 — 순수(네트워크 0 · 회귀에서도 돈다) ═══════════════ */

interface GtRow {
  src: string;
  origin: string;
  url: string;
  canon: string;
  verdict: string;
}

/**
 * 🔴 **가치 라벨을 섞지 않는다.** `wu-099/100-human-value.json` 은 USEFUL/NOISE 이고
 *    SAME/DIFFERENT GT 가 **아니다**(헌장 §12 가 명시한 금지). 여기서 읽지 않는다.
 * 🔴 `wu-093-human-gt.json` 은 **SKU 키** 라 URL 이 없다 ⟹ URL 추적 **측정불가** 로
 *    분리해 적는다(0 으로 세지 않는다).
 */
function collectGt(): { rows: GtRow[]; skuOnlySame: number; skuOnlyTotal: number } {
  const rows: GtRow[] = [];
  const push = (src: string, origin: string, url: string | undefined, verdict: string | undefined) => {
    if (!url || !verdict || !origin) return;
    rows.push({ src, origin, url, canon: loose(url), verdict });
  };
  const f112 = fixture<{ candidates: { originCode: string; url: string; verdict: string }[] }>("wu-112-human-gt.json");
  for (const c of f112.candidates) push("wu-112", c.originCode, c.url, c.verdict);
  const f111 = fixture<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>("wu-111-human-gt.json");
  for (const c of f111.candidates) push("wu-111", c.originCode, c.url, c.humanVerdict);
  const f116 = fixture<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>("wu-116-human-gt.json");
  for (const c of f116.candidates) push("wu-116", c.originCode, c.url, c.humanVerdict);
  const f125 = fixture<{ candidates: { origin: string; url: string; human: string }[] }>("wu-125-human-gt.json");
  for (const c of f125.candidates) push("wu-125", c.origin, c.url, c.human);
  const f093 = fixture<{ humanReview: { verdict: string }[] }>("wu-093-human-gt.json");
  return {
    rows,
    skuOnlySame: f093.humanReview.filter((r) => r.verdict === "SAME").length,
    skuOnlyTotal: f093.humanReview.length,
  };
}

/** 🟢 (원상품, URL) 로 접는다. 🔴 **판단 상충을 숨기지 않는다** — 세어서 보고한다. */
function dedupe(rows: GtRow[]) {
  const m = new Map<string, GtRow[]>();
  for (const r of rows) {
    const k = `${r.origin}|${r.canon}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  let conflicts = 0;
  const unique: GtRow[] = [];
  for (const v of m.values()) {
    if (new Set(v.map((x) => x.verdict)).size > 1) conflicts += 1;
    unique.push(v[0]);
  }
  return { unique, duplicateKeys: rows.length - m.size, conflicts };
}

describe("WU-133 A. GT 집계 (순수)", () => {
  it("A-1 🔴 human SAME GT 분모를 **출처별로** 센다 — 가치 라벨은 섞지 않는다", () => {
    const { rows, skuOnlySame, skuOnlyTotal } = collectGt();
    const { unique, duplicateKeys, conflicts } = dedupe(rows);
    const same = unique.filter((r) => r.verdict === "SAME");
    const byOrigin: Record<string, number> = {};
    for (const r of same) byOrigin[r.origin] = (byOrigin[r.origin] ?? 0) + 1;

    log(
      `\n📚 human GT — 라벨행 ${rows.length} → 고유 ${unique.length}(중복키 ${duplicateKeys} · 상충 ${conflicts})` +
        `\n   고유 human SAME ${same.length} · 원상품축 ${JSON.stringify(byOrigin)}` +
        `\n   🔴 wu-093 ${skuOnlySame}/${skuOnlyTotal} SAME 은 **SKU 키** 라 URL 추적 측정불가`,
    );
    /** 🔴 **판단 상충이 있으면 분모를 믿을 수 없다** — 0 이어야 한다. */
    expect(conflicts).toBe(0);
    /** 🟢 분모가 비면 이 WU 자체가 성립하지 않는다. */
    expect(same.length).toBeGreaterThan(0);
  });
});

/* ═══════════════ B. 단계별 전수 추적 (실제 HTTP · 게이트 필요) ═══════════════ */

interface Stage {
  url: string;
  host: string;
  /** ② 현재 자동검색이 이 URL 을 후보로 냈는가. */
  rediscovered: boolean;
  /** ③ 입력 경계(canonical/shape/self-ref/dup)를 통과했는가. */
  canonical: boolean;
  /** ④ 페이지를 열어 후보가 됐는가(= MI 입력). */
  miInput: boolean;
  /** 🔴 ④ 가 false 인 이유(운영이 낸 값 그대로). */
  dropReason: string | null;
  /** ⑤ 그 샵의 대표로 뽑혔는가(샵당 1건 구조). */
  shopBest: boolean;
  /** ⑥ 판정. */
  verdict: string | null;
  matchTruth: string | null;
  tier: string | null;
  displayTier: string | null;
  blockers: string[];
  conflicts: string[];
  /** ⑦ 가격. */
  priceStatus: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  market: string | null;
  /** ⑧ 최종 가격비교에 들어갔는가. */
  inComparison: boolean;
}

describe("WU-133 B. 전수 추적 — 사람이 SAME 이라 한 상품이 어디까지 사는가", () => {
  it.runIf(LIVE)(
    "B-1 🔴🔴 단계별 숫자를 내고 SAME 0 의 원인을 확정한다",
    async () => {
      const { rows } = collectGt();
      const { unique } = dedupe(rows);
      const gtSame = unique.filter((r) => r.verdict === "SAME");

      const two = read<{ s1: Snap | null; s2: Snap | null }>("wu130-two.json");
      const origins = read<{ origins: Record<string, { id: string }[]> }>("wu-133-gt-origins.json");
      const shopRows = read<ShopRow[]>("wu010-comparison-shops.json");

      /** 🔴 원상품 스냅샷이 **없으면 측정불가** 다 — 「MI 가 못 잡았다」로 세지 않는다. */
      const measurable: { code: string; snap: Snap }[] = [];
      const unmeasurable: { code: string; n: number }[] = [];
      const byOrigin = new Map<string, GtRow[]>();
      for (const r of gtSame) {
        if (!byOrigin.has(r.origin)) byOrigin.set(r.origin, []);
        byOrigin.get(r.origin)!.push(r);
      }
      for (const [code, list] of byOrigin) {
        const snap = [two.s1, two.s2].find(
          (s) => s && s.source_url.toLowerCase().includes(code.toLowerCase()),
        );
        if (snap) measurable.push({ code, snap });
        else unmeasurable.push({ code, n: list.length, hasDbSnapshot: (origins.origins[code] ?? []).length > 0 } as never);
      }
      log(
        `\n🔎 추적 가능 ${measurable.map((m) => m.code).join(" ")} · ` +
          `🔴 측정불가 ${JSON.stringify(unmeasurable)}`,
      );

      const report: Record<string, { stages: Stage[]; funnel: Record<string, number> }> = {};

      for (const { code, snap } of measurable) {
        const gt = byOrigin.get(code)!;
        const product = backfillCanonicalProduct(
          (snap.workspace as { canonicalProduct: unknown }).canonicalProduct as never,
        );
        const dna = buildProductIdentityDna(product);
        const searchTerms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: dna.title,
          brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl,
          sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
          searchTerm: searchTerms[0] ?? dna.title,
          searchTerms,
          facts: productFactsFromIdentityDna(dna),
        };
        log(`\n══════ ${code} · ${snap.title} · human SAME ${gt.length}건`);
        /**
         * 🔴🔴 **BRAND_UNCONFIRMED 의 책임이 «원상품» 인지 «후보» 인지 먼저 가른다.**
         *
         * `cross-seller.ts` 의 술어는 `brandKnown = Boolean(x.brand && y.brand)` 이고
         * x 는 **원상품** 이다. 🔴 즉 원상품 brand 가 비어 있으면 **모든 후보가
         * UNCONFIRMED** 가 되고, 그건 후보 품질과 **무관** 하다(WU-080 이 실측한 그 자리 —
         * 공식몰 JSON-LD 의 `brand.name = "AW26"` 을 SEASON_CODE 규칙이 올바르게 버린다).
         * 🟢 그래서 「후보 5건이 브랜드 미확인」과 「원상품 brand 가 비었다」를 섞지 않는다.
         */
        log(
          `   원상품 facts — brand=${JSON.stringify(dna.brand)} · modelCode=${dna.brandModelCode ?? "null"} ` +
            `· color=${dna.color ?? "null"}`,
        );

        /* ── ② 현재 «자동» 검색이 그 URL 을 다시 찾아내는가 ── */
        const auto = await collectOverseasAutoPool({
          query,
          categoryScopes: ["KIDS_FASHION"],
          listShops: async () =>
            shopRows.map((r) => ({
              id: r.id,
              name: r.name,
              domain: r.domain,
              url: r.url,
              country: r.country,
              currency: r.currency,
              categoryScope: r.category_scope ?? [],
              accessStatus: r.access_status,
              accessNote: null,
              role: null,
              operatorKey: null,
              source: "SYSTEM",
              isActive: r.is_active,
              createdAt: "",
            })) as never,
        });
        const autoUrls = new Set<string>();
        const autoHosts = new Set<string>();
        for (const r of auto.searchResults) {
          for (const c of r.candidates) {
            autoUrls.add(loose(c.url));
            try {
              autoHosts.add(new URL(c.url).hostname.replace(/^www\./, "").toLowerCase());
            } catch {
              /* 무시 — 호스트를 못 읽는 URL 은 교집합에서 뺀다(지어내지 않는다). */
            }
          }
        }
        log(`   ② 자동검색 metrics=${JSON.stringify(auto.metrics)} · 산출 URL ${autoUrls.size}개`);
        /**
         * ══════════════════════════════════════════════════════════════════
         * 🔴🔴🔴 **열화된 실행의 funnel 을 «보고하지 못하게» 막는다**
         * ══════════════════════════════════════════════════════════════════
         *
         * 실측으로 당했다(2026-10-20) — 같은 하니스가 두 번은
         * `outcomes {unsupported 20 · ok 10}` 로 정상 측정되고, 그 사이 세 번은
         * `outcomes {unsupported 20 · **error 10**}` + **13건 전건 UNREACHABLE** 이
         * 나왔다. 🔴 후자의 funnel 은 **전부 0** 이라 「Discovery 가 완전히 죽었다」로
         * 읽힌다 — 그런데 **같은 URL 을 curl 과 plain fetch 는 200 으로 받는다.**
         * ⟹ 일시적 outbound 장애이고 **제품 사실이 아니다.**
         *
         * 🔴 그때 내가 두 번 틀린 가설을 세웠다(① jsdom 환경 ② 해외검색의 연쇄 오염).
         *    둘 다 **재현되지 않았다.** 🟢 그래서 원인을 단정하는 대신 **열화를 감지해
         *    측정을 거부** 한다 — 「측정불가」와 「0」을 섞지 않는 유일한 방법이다(§5-B).
         */
        const errored = auto.metrics.outcomes.error ?? 0;
        if (errored > 0) {
          log(
            `   🔴🔴 **이 실행은 열화됐다** — 해외 샵 ${errored}곳이 \`error\` 다. ` +
              `funnel 을 내지 않는다(「측정불가」이고 「0」이 아니다). 네트워크 회복 후 재실행.`,
          );
          expect(errored, "열화된 실행 — 재실행 필요(이 숫자를 제품 사실로 쓰지 않는다)").toBe(0);
        }
        /**
         * 🔴🔴 **「재발견 0」을 Discovery 실패로 단정하기 전에 세 층을 가른다.**
         *
         * URL 완전일치만 보면 **로케일/경로 변형**(`/en-kr/products/x` ↔ `/products/x`)이
         * 전부 「못 찾았다」로 세어진다 — 그건 Discovery 문제가 아니라 **URL 동일성**
         * 문제이고 처방이 완전히 다르다. 🔴 WU-104 가 같은 함정을 기록해 뒀다.
         * ```
         * ⒜ 등록부에 그 판매처가 있는가      → 없으면 Registry 확대(§12-0 금지축)
         * ⒝ 자동검색이 그 «호스트» 를 냈는가  → 냈으면 Discovery 는 닿았다
         * ⒞ 그 «URL» 까지 같은가            → 다르면 URL 동일성/로케일 문제
         * ```
         */
        const registryHosts = new Set(
          shopRows.map((r) => r.domain.replace(/^www\./, "").toLowerCase()),
        );
        const gtHosts = [
          ...new Set(
            gt.map((g) => {
              try {
                return new URL(g.url).hostname.replace(/^www\./, "").toLowerCase();
              } catch {
                return "?";
              }
            }),
          ),
        ];
        log(
          `   ② 층별 — GT 호스트 ${gtHosts.length} · 등록부에 있음 ` +
            `${gtHosts.filter((h) => registryHosts.has(h)).length} · 자동검색이 그 호스트를 냄 ` +
            `${gtHosts.filter((h) => autoHosts.has(h)).length}`,
        );
        for (const h of gtHosts) {
          log(
            `       ${h.padEnd(24)} 등록부=${registryHosts.has(h) ? "Y" : "N"} 자동검색호스트=${autoHosts.has(h) ? "Y" : "N"}`,
          );
        }

        /* ── ③④ 재투입(= 그 URL 을 직접 열어 본다) ── */
        const pool = await collectUrlCandidatePool({
          urls: gt.map((g) => g.url),
          originUrl: query.sourceUrl,
          /** 🔴 상한을 **GT 수만큼** 올린다 — 여기서는 「상한에 막혀 못 봤다」를
           *  원인으로 오인하지 않는 것이 목적이다(운영 상한은 그대로 10). */
          maxUrls: Math.max(MAX_SUPPLIED_CANDIDATE_URLS, gt.length),
          existingCanonicalUrls: new Set<string>(),
          shopId: REVIEWED_SAME_SHOP_ID,
          shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
        });
        log(`   ③④ pool metrics=${JSON.stringify(pool.metrics)}`);

        const dropByUrl = new Map<string, string>();
        for (const d of pool.metrics.dropped) dropByUrl.set(loose(d.url), d.reason);
        const candidateByUrl = new Map<string, ComparisonCandidate>();
        for (const r of pool.searchResults) for (const c of r.candidates) candidateByUrl.set(loose(c.url), c);

        /* ── ⑤⑥⑦ 운영 순서 그대로: self-ref → withConfidence → enrich → judge ── */
        const rowsOut: GeminiTransientRow[] = [];
        const bestUrls = new Set<string>();
        const judgedByHost = new Map<
          string,
          { verdict: string | null; matchTruth: string | null; tier: string; blockers: string[]; conflicts: string[]; bestUrl: string; priceStatus: string | null; market: string }
        >();
        for (const result of pool.searchResults) {
          if (result.status !== "ok" || result.candidates.length === 0) continue;
          const notSelf = result.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
          const scored = withConfidence(query, notSelf);
          let priced = scored;
          try {
            priced = await enrichCandidatePrices(scored, result.domain, query);
          } catch {
            /* 운영과 같다 — 보강 실패는 점수만 있는 후보로 계속 간다. */
          }
          const j = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: priced,
            sourceUrl: query.sourceUrl,
            foreignModelCode: dna.brandModelCode,
            foreignColor: dna.color,
            fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
          });
          if (j.kind !== "JUDGED") {
            log(`   ⑤ ${result.domain} → ${j.kind}${"gate" in j ? `/${j.gate}` : ""}`);
            continue;
          }
          const tier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
          const m = classifyCandidateMarket({
            domain: result.domain,
            currency: j.best.price?.currency ?? null,
            isRegisteredDomesticShop: false,
          });
          bestUrls.add(loose(j.best.url));
          const blockers = (j.best.crossSellerBlockers ?? []).map((b) =>
            typeof b === "string" ? b : b.blocker,
          );
          const conflicts = (j.best.crossSellerConflicts ?? []).map((c) =>
            typeof c === "string" ? c : c.conflict,
          );
          judgedByHost.set(result.domain, {
            verdict: j.best.crossSellerVerdict ?? null,
            matchTruth: j.matchTruth,
            tier,
            blockers,
            conflicts,
            bestUrl: loose(j.best.url),
            priceStatus: j.best.priceStatus ?? null,
            market: m.market,
          });
          rowsOut.push({
            source: "REVIEWED_SAME",
            domain: result.domain,
            title: j.best.title,
            imageUrl: j.best.imageUrl ?? null,
            soldOut: j.best.soldOut ?? null,
            discoveredUrl: j.best.url,
            matchTruth: j.matchTruth,
            priceTier: tier,
            crossSellerVerdict: j.best.crossSellerVerdict ?? null,
            confidence: j.best.confidence ?? null,
            matchReasons: j.best.matchReasons ?? [],
            crossSellerBlockers: blockers,
            crossSellerConflicts: conflicts,
            priceAmount: j.best.price?.amount ?? null,
            priceCurrency: j.best.price?.currency ?? null,
            priceStatus: j.best.priceStatus ?? null,
            market: m.market,
            basis: m.basis,
          });
        }

        /* ── ⑧ 최종 비교 ── */
        const inComparison = new Set<string>();
        for (const market of ["KR", "OVERSEAS"] as const) {
          for (const r of selectMiSameCandidates(rowsOut, market).priced) inComparison.add(loose(r.discoveredUrl));
        }

        /* ── 단계 표 ── */
        const stages: Stage[] = gt.map((g) => {
          const host = (() => {
            try {
              return new URL(g.url).hostname.replace(/^www\./, "").toLowerCase();
            } catch {
              return "?";
            }
          })();
          const cand = candidateByUrl.get(g.canon) ?? null;
          const judged = judgedByHost.get(host) ?? null;
          const isBest = bestUrls.has(g.canon);
          return {
            url: g.url,
            host,
            rediscovered: autoUrls.has(g.canon),
            canonical: cand != null || !dropByUrl.has(g.canon),
            miInput: cand != null,
            dropReason: dropByUrl.get(g.canon) ?? null,
            shopBest: isBest,
            verdict: isBest ? (judged?.verdict ?? null) : null,
            matchTruth: isBest ? (judged?.matchTruth ?? null) : null,
            tier: isBest ? (judged?.tier ?? null) : null,
            displayTier: isBest
              ? (transientDisplayTier(rowsOut.find((r) => loose(r.discoveredUrl) === g.canon) ?? ({} as never)) ?? null)
              : null,
            blockers: isBest ? (judged?.blockers ?? []) : [],
            conflicts: isBest ? (judged?.conflicts ?? []) : [],
            priceStatus: isBest ? (judged?.priceStatus ?? null) : null,
            priceAmount: rowsOut.find((r) => loose(r.discoveredUrl) === g.canon)?.priceAmount ?? null,
            priceCurrency: rowsOut.find((r) => loose(r.discoveredUrl) === g.canon)?.priceCurrency ?? null,
            market: isBest ? (judged?.market ?? null) : null,
            inComparison: inComparison.has(g.canon),
          };
        });

        const funnel = {
          "① GT human SAME": stages.length,
          /** 🔴 **URL 완전일치** 기준(로케일 변형은 여기서 떨어진다 — 아래 ②-host 와 가른다). */
          "② 자동검색 재발견(URL)": stages.filter((s) => s.rediscovered).length,
          /** 🟢 **호스트 기준** — 「그 판매처에는 닿았는가」. 둘을 섞으면 처방이 틀린다. */
          "②-host 자동검색이 그 판매처를 냄": stages.filter((s) => autoHosts.has(s.host)).length,
          "②-reg 등록부에 그 판매처가 있음": stages.filter((s) => registryHosts.has(s.host)).length,
          "③ canonical 통과": stages.filter((s) => s.canonical).length,
          "④ MI input(후보 생성)": stages.filter((s) => s.miInput).length,
          "⑤ 샵 대표 선정": stages.filter((s) => s.shopBest).length,
          "⑥ displayTier SAME": stages.filter((s) => s.displayTier === "SAME").length,
          "⑦ 가격 VERIFIED": stages.filter((s) => s.priceStatus === "VERIFIED_CURRENT").length,
          "⑧ 최종 가격비교": stages.filter((s) => s.inComparison).length,
        };
        log(`   ── funnel ──\n${JSON.stringify(funnel, null, 2)}`);
        log(`   ── 행별 ──`);
        for (const s of stages) {
          log(
            `     ${s.host.padEnd(24)} redis=${s.rediscovered ? "Y" : "N"} mi=${s.miInput ? "Y" : "N"} ` +
              `best=${s.shopBest ? "Y" : "N"} v=${s.verdict ?? "-"} truth=${s.matchTruth ?? "-"} ` +
              `disp=${s.displayTier ?? "-"} tier=${s.tier ?? "-"} ${s.priceCurrency ?? "-"} ${s.priceAmount ?? "-"} ` +
              `${s.priceStatus ?? "-"} mkt=${s.market ?? "-"} cmp=${s.inComparison ? "Y" : "N"}` +
              (s.dropReason ? ` drop=${s.dropReason}` : "") +
              (s.blockers.length ? ` blk=${s.blockers.join("/")}` : "") +
              (s.conflicts.length ? ` cfl=${s.conflicts.join("/")}` : ""),
          );
        }

        /** 🔴 보류 사유 분포 — 「왜 SAME 이 아닌가」의 직접 답이다. */
        const blockerFreq: Record<string, number> = {};
        for (const s of stages) {
          for (const b of [...s.blockers, ...s.conflicts]) blockerFreq[b] = (blockerFreq[b] ?? 0) + 1;
        }
        log(`   ── 보류/충돌 사유 분포 ── ${JSON.stringify(blockerFreq)}`);
        /**
         * 🔴🔴 **최소 수정이 실데이터에서 맞는 말을 하는지** 여기서 확인한다.
         *    「없습니다」만 적던 화면이 이제 **몇 건이 왜 보류됐는지** 를 말해야 한다.
         */
        const pending = countPendingCandidates(rowsOut);
        log(`   📣 화면 문장 — ${pendingNote(pending) ?? "(보류 0 — 그 줄을 만들지 않는다)"}`);
        /** 🔴 보류가 있는데 문장이 없으면 화면이 **거짓** 을 말한다(WU-132 의 그 상태다). */
        if (pending.count > 0) expect(pendingNote(pending)).not.toBeNull();
        report[code] = { stages, funnel };
      }

      writeFileSync(path.join(OUT, "wu-133-trace.json"), JSON.stringify(report, null, 2), "utf8");
      log(`\n→ ${path.join(OUT, "wu-133-trace.json")}`);
      expect(Object.keys(report).length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});

/* ═══════════ C. 🔴 「비었다」로 끝내지 않는다 — WU-133 최소 수정의 계약 ═══════════ */

describe("WU-133 C. 보류 요약 (순수 + 마운트 DOM)", () => {
  /** 🔴 실측 모양 그대로다(WU-133 B 의 행 다섯). 지어낸 값 0. */
  const pendingRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({
    source: "REVIEWED_SAME",
    domain: "tinyapple.net",
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://www.tinyapple.net/products/x",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: 0.6,
    matchReasons: [],
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
    crossSellerConflicts: [],
    priceAmount: 58,
    priceCurrency: "USD",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
    ...over,
  });

  it("C-1 🔴🔴 가격까지 있는데 SAME 이 아닌 후보를 **세고 사유를 적는다**", () => {
    const s = countPendingCandidates([
      pendingRow(),
      pendingRow({ discoveredUrl: "https://a.com/1", domain: "a.com" }),
      pendingRow({
        discoveredUrl: "https://b.com/1",
        domain: "b.com",
        matchTruth: "CONFLICT",
        crossSellerVerdict: "CONFLICT",
        crossSellerBlockers: [],
        crossSellerConflicts: ["MODEL_CODE"],
      }),
    ]);
    expect(s.count).toBe(3);
    expect(s.reasons).toEqual([
      { text: "브랜드 미확인", n: 2 },
      { text: "품번 충돌", n: 1 },
    ]);
    const note = pendingNote(s)!;
    expect(note).toContain("3건");
    expect(note).toContain("브랜드 미확인 2");
    /** 🔴 「동일상품」이라고 **단정하지 않는다**. */
    expect(note).not.toMatch(/동일상품이 ?있/);
  });

  it("C-2 🔴 SAME 후보는 **세지 않는다**(그건 이미 비교에 들어갔다)", () => {
    expect(countPendingCandidates([pendingRow({ matchTruth: "EXACT_IDENTIFIER" })]).count).toBe(0);
  });

  it("C-3 🔴 품절·가격미확인은 **보류로 세지 않는다**(다른 사실이다)", () => {
    expect(countPendingCandidates([pendingRow({ soldOut: true })]).count).toBe(0);
    expect(countPendingCandidates([pendingRow({ priceStatus: "UNVERIFIED_SEARCH" })]).count).toBe(0);
  });

  it("C-4 🔴 모르는 토큰을 **영문 그대로 노출하지 않는다**(WU-056 누출 재발 방지)", () => {
    const s = countPendingCandidates([pendingRow({ crossSellerBlockers: ["SOME_NEW_TOKEN"] })]);
    expect(s.reasons[0].text).toBe(BLOCKER_OTHER_TEXT);
    expect(pendingNote(s)).not.toContain("SOME_NEW_TOKEN");
  });

  it("C-5 🔴 보류가 0 이면 **그 줄을 만들지 않는다**(없는 말을 적지 않는다)", () => {
    expect(pendingNote(countPendingCandidates([]))).toBeNull();
    expect(pendingNote(countPendingCandidates(null))).toBeNull();
  });

});
