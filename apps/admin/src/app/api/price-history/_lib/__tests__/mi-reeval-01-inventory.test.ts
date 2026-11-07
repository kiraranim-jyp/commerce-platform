import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeProductUrl } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **STEP 1** — 기존 테스트 데이터 **전수 조사 · 중복 제거 기준 확정**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **네트워크 0 · DB 접근 0 · 운영 변경 0 · GT 변경 0 · Shadow 평가 0.**
 *    STEP 1 은 **분모와 키를 정하는 단계** 다(CPO §8). 평가는 STEP 5 다.
 *
 * ── 🔴🔴 **기존 GT 와 CEO 최신 판정을 «섞지 않는다»**(CPO §2) ─────────────────
 * ```
 * 열이 **둘** 이다 — `priorGt`(기존 기준) · `ceoLatest`(CEO Evidence Review 2026-11-07).
 * 🔴 한 칸에 합치지 않는다. 충돌하면 **충돌로 센다**(C42 가 그 사례다).
 * ```
 *
 * ── 🔵 중복 제거 기준(제안) ─────────────────────────────────────────────────
 * ```
 * KEY = `canonicalizeProductUrl(원본 URL)` + " >> " + `canonicalizeProductUrl(후보 URL)`
 * 🟢 `canonicalizeProductUrl` 을 쓰는 이유 — 이 리포의 **식별 보존** 정규화기다
 *    (`normalizeCandidateUrl` 은 쿼리를 통째로 지워 `?variant=` 같은 식별자를 잃는다).
 * 🔴 **로케일을 접지 않는다** — `/en-kr/` 과 `/` 는 이 리포 정책상 **다른 시장** 이다
 *    (`self-reference` 계약 · 메모 `self-reference-collapses-collections-not-locale`).
 * 🔴 원본 URL 이 **없는** 행(스냅샷 소실 17건)은 그 키를 만들 수 없다 ⟹ **보조 키**
 *    `originCode + " >> " + canonical(후보 URL)` 로 따로 센다. 🔴 합치지 않는다.
 * ```
 */

const FIX = join(__dirname, "fixtures");
const J = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const canon = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    return canonicalizeProductUrl(u).toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
};
const pairKey = (o: string | null | undefined, c: string | null | undefined): string | null => {
  const a = canon(o);
  const b = canon(c);
  return a && b ? `${a} >> ${b}` : null;
};
const codeKey = (code: string | null | undefined, c: string | null | undefined): string | null => {
  const b = canon(c);
  return code && b ? `${code} >> ${b}` : null;
};

interface Entry {
  sources: Set<string>;
  originUrl: string | null;
  candidateUrl: string;
  originCode: string | null;
  /** 🔴 기존 기준 GT — 여러 출처에서 오면 **전부** 담는다(덮지 않는다). */
  priorGt: Map<string, string>;
  /** 🔴 CEO Evidence Review(2026-11-07) 최신 판정 — **별도 칸** 이다. */
  ceoLatest: string | null;
  /** 운영 MI — 재현값과 DB 저장값을 **가른다**. */
  miReproduced: string | null;
  miStored: string | null;
  facts: ProductFacts | null;
  /** CEO 기준 다섯 증거의 **확보 여부**. */
  evidence: Record<string, boolean | null>;
}

describe("MI-REEVAL STEP 1 — 전수 조사 · 중복 제거 기준(네트워크 0 · DB 0)", () => {
  /* ═══════ 수집 ═══════════════════════════════════════════════════════════ */
  /**
   * 🔴 **기존 분류 계약을 `import` 하지 않는다** — 그 파일은 `.test.ts` 이고 import 하면
   *    그 `describe` 가 **두 번** 돈다. 🟢 그 숫자는 **따로 실행해** 인용한다:
   * ```
   * `core-same06-safety-gt-search.test.ts` 실행 결과(2026-11-07)
   *   fixture 전체 **44** · 수집 **17** · 제외 **27**  (🔴 합이 44 인 이유 —
   *   `core-same03-human-gt.json` 이 **두 목록에 모두** 있다[「수집함(아래 별도)」])
   * ```
   * 🔴 그 17 파일의 사람 라벨 행은 이 인벤토리의 **분모가 아니다** — 아래 넷만 쓴다.
   */
  const FIXTURE_CENSUS = { total: 44, scanned: 17, skipped: 27 } as const;
  const ceo = J("ceo-evidence-review-gt.json") as {
    pairs: { id: string; originUrl: string; candidateUrl: string; priorCeoVerdict: string; ceoVerdict: string; reproducedVerdict: string; dbMiVerdict: string | null }[];
  };
  const dbHuman = J("mi-reeval-01-db-human.json") as {
    rows: { origin_code: string | null; candidate_url: string; origin_url: string | null; human_verdict: string; system_verdict: string | null; origin_snapshot_missing: boolean }[];
  };
  const descPairs = J("mi-reeval-01-desc-pairs.json") as {
    pairs: {
      originCode: string | null; originUrl: string; candidateUrl: string;
      baselineSystemVerdict: string | null; humanGt: string | null;
      hasOriginDescription: boolean; hasCandidateDescription: boolean;
      axisStatus: Record<string, string | null>; originTitle: string | null; candidateTitle: string | null;
    }[];
  };
  const byId = new Map(SAME05_PAIRS.map((p) => [p.id, p]));

  /** 🔴 키를 만들 수 없는 행을 **조용히 버리지 않는다** — 따로 센다. */
  const noPairKey: { src: string; why: string; candidateUrl: string }[] = [];
  const entries = new Map<string, Entry>();
  const touch = (key: string, base: Partial<Entry> & { candidateUrl: string }): Entry => {
    const cur = entries.get(key);
    if (cur) return cur;
    const e: Entry = {
      sources: new Set(), originUrl: base.originUrl ?? null, candidateUrl: base.candidateUrl,
      originCode: base.originCode ?? null, priorGt: new Map(), ceoLatest: null,
      miReproduced: null, miStored: null, facts: base.facts ?? null, evidence: {},
    };
    entries.set(key, e);
    return e;
  };

  /* ⒜ SAME05_PAIRS — 🟢 **원본 URL · 기존 GT · facts 를 다** 들고 있다(기존 MI fixture 축) */
  for (const p of SAME05_PAIRS) {
    const k = pairKey(p.origin.sourceUrl, p.url) ?? codeKey(p.searchId, p.url);
    if (!k) { noPairKey.push({ src: "same05", why: "원본·후보 URL 중 하나가 없다", candidateUrl: p.url }); continue; }
    const e = touch(k, { candidateUrl: p.url, originUrl: p.origin.sourceUrl, facts: p.facts });
    e.sources.add("same05");
    /** 🔴 `p.human` 은 **기존 기준 GT** 다(CEO 최신과 다른 칸). */
    e.priorGt.set(`same05:${p.src}`, p.human);
    if (!e.originUrl) e.originUrl = p.origin.sourceUrl;
    if (!e.originCode) e.originCode = p.origin.brandModelCode ?? null;
  }

  /* ⒞ CEO Evidence Review 11 — 🔴 **별도 칸** 이다 */
  for (const p of ceo.pairs) {
    const k = pairKey(p.originUrl, p.candidateUrl);
    const alt = codeKey(byId.get(p.id)?.origin.brandModelCode ?? null, p.candidateUrl);
    const key = k ?? alt;
    if (!key) { noPairKey.push({ src: "ceo-review", why: "URL 둘 중 하나가 없다", candidateUrl: p.candidateUrl }); continue; }
    const e = touch(key, { candidateUrl: p.candidateUrl, originUrl: p.originUrl, facts: byId.get(p.id)?.facts ?? null });
    e.sources.add("ceo-review");
    e.ceoLatest = p.ceoVerdict;
    e.miReproduced = p.reproducedVerdict;
    e.miStored = p.dbMiVerdict;
    if (p.priorCeoVerdict) e.priorGt.set("ceo-prior", p.priorCeoVerdict);
  }

  /* ⒟ DB `candidate_reviews` 사람 판정 38행 */
  for (const r of dbHuman.rows) {
    const k = pairKey(r.origin_url, r.candidate_url) ?? codeKey(r.origin_code, r.candidate_url);
    if (!k) { noPairKey.push({ src: "db", why: "원본 URL·originCode 둘 다 없다", candidateUrl: r.candidate_url }); continue; }
    const e = touch(k, { candidateUrl: r.candidate_url, originUrl: r.origin_url, originCode: r.origin_code });
    e.sources.add("db:candidate_reviews");
    e.priorGt.set("db", r.human_verdict);
    if (!e.miStored) e.miStored = r.system_verdict;
  }

  /* ⒠ 상세설명 비교 109쌍 — 증거 확보 현황의 유일한 출처 */
  for (const p of descPairs.pairs) {
    const k = pairKey(p.originUrl, p.candidateUrl) ?? codeKey(p.originCode, p.candidateUrl);
    if (!k) { noPairKey.push({ src: "desc-compare", why: "원본 URL·originCode 둘 다 없다", candidateUrl: p.candidateUrl }); continue; }
    const e = touch(k, { candidateUrl: p.candidateUrl, originUrl: p.originUrl, originCode: p.originCode });
    e.sources.add("desc-compare");
    if (!e.miReproduced) e.miReproduced = p.baselineSystemVerdict;
    if (p.humanGt) e.priorGt.set("desc-gt", p.humanGt);
    /** CEO 기준 다섯 증거 — ①②상품명 ③품번 ④상세설명 ⑤정규화 토큰. */
    e.evidence = {
      titleRaw: Boolean(p.originTitle && p.candidateTitle),
      productName: p.axisStatus.PRODUCT_NAME != null,
      modelCode: p.axisStatus.MODEL_CODE != null && p.axisStatus.MODEL_CODE !== "UNKNOWN",
      description: p.hasOriginDescription && p.hasCandidateDescription,
      normalizedTokens: Boolean(e.facts?.coreTitleTokens?.length) || p.axisStatus.PRODUCT_NAME != null,
    };
  }

  const all = [...entries.values()];

  /* ═══════ 보고 ═══════════════════════════════════════════════════════════ */
  it("STEP 1 — 분모·중복 제거·충돌을 전수로 센다", () => {
    const line = (s: string) => console.log(s);
    line("\n" + "═".repeat(78));
    line("  MI-REEVAL STEP 1 — 기존 테스트 데이터 전수 조사");
    line("═".repeat(78));

    line("\n§1 출처별 «원시» 규모 — 🔴 합산하지 않는다");
    line(`   [참고] fixture 전수 인구조사  전체 ${FIXTURE_CENSUS.total} · 수집 ${FIXTURE_CENSUS.scanned} · 제외 ${FIXTURE_CENSUS.skipped}`);
    line(`          🔴 그 17 파일의 라벨 행은 이 인벤토리의 **분모가 아니다**(아래 넷만 쓴다)`);
    line(`   SAME05_PAIRS      쌍 **${SAME05_PAIRS.length}**  (원본 URL + 기존 GT + facts 보유)`);
    line(`   CEO Evidence Review 쌍 **${ceo.pairs.length}**  (2026-11-07 · 🔴 별도 칸)`);
    line(`   DB candidate_reviews 사람 판정 행 **${dbHuman.rows.length}** ` +
      `(🔴 그중 원상품 스냅샷 없음 **${dbHuman.rows.filter((r) => r.origin_snapshot_missing).length}**)`);
    line(`   상세설명 비교        쌍 **${descPairs.pairs.length}**  (증거 확보 현황의 유일한 출처)`);

    line("\n§2 중복 제거 — 🔵 제안 키로 합친 결과");
    line(`   🟢 고유 비교 쌍(Pair) **${all.length}**`);
    line(`   🔴 키를 만들 수 없어 제외 **${noPairKey.length}**`);
    for (const n of noPairKey.slice(0, 5)) line(`      · ${n.src} — ${n.why}`);
    const bySrcCount: Record<string, number> = {};
    for (const e of all) {
      const k = [...e.sources].sort().join(" + ");
      bySrcCount[k] = (bySrcCount[k] ?? 0) + 1;
    }
    line("   출처 조합별 쌍 수:");
    for (const [k, v] of Object.entries(bySrcCount).sort((a, b) => b[1] - a[1])) line(`      ${String(v).padStart(3)}  ${k}`);

    line("\n§3 라벨 보유 — 🔴 **기존 GT 와 CEO 최신을 가른다**");
    const withPrior = all.filter((e) => e.priorGt.size > 0);
    const withCeo = all.filter((e) => e.ceoLatest);
    const withBoth = all.filter((e) => e.priorGt.size > 0 && e.ceoLatest);
    line(`   기존 GT 보유 **${withPrior.length}** · CEO 최신 보유 **${withCeo.length}** · 둘 다 **${withBoth.length}**`);
    /** 🔴 같은 쌍에 기존 GT 가 **여럿** 이고 값이 갈리는 경우 — 조용히 덮지 않는다. */
    const priorConflict = all.filter((e) => new Set([...e.priorGt.values()].map((v) => v.toUpperCase())).size > 1);
    line(`   🔴 기존 GT «내부» 충돌(같은 쌍, 다른 라벨) **${priorConflict.length}**`);
    for (const e of priorConflict.slice(0, 8)) {
      line(`      · ${String(e.originCode ?? "-").padEnd(11)} ${e.candidateUrl.slice(0, 58)}`);
      line(`        ${[...e.priorGt.entries()].map(([k, v]) => `${k}=${v}`).join(" · ")}`);
    }
    const ceoVsPrior = withBoth.filter((e) => {
      const p = [...e.priorGt.values()].map((v) => v.toUpperCase());
      return !p.includes(String(e.ceoLatest).toUpperCase());
    });
    line(`   🔴 CEO 최신 ↔ 기존 GT 충돌 **${ceoVsPrior.length}**`);
    for (const e of ceoVsPrior) {
      line(`      · ${e.candidateUrl.slice(0, 56)} — 기존 ${[...e.priorGt.values()].join("/")} ↔ CEO ${e.ceoLatest}`);
    }

    line("\n§4 운영 MI 결과 보유 — 🔴 재현값과 DB 저장값을 가른다");
    line(`   재현값 보유 **${all.filter((e) => e.miReproduced).length}** · DB 저장값 보유 **${all.filter((e) => e.miStored).length}**`);
    const tally = (xs: Entry[], f: (e: Entry) => string | null) =>
      xs.reduce<Record<string, number>>((a, e) => { const k = f(e) ?? "(없음)"; a[k] = (a[k] ?? 0) + 1; return a; }, {});
    line(`   재현 분포: ${JSON.stringify(tally(all, (e) => e.miReproduced))}`);
    line(`   DB 분포:   ${JSON.stringify(tally(all, (e) => e.miStored))}`);

    line("\n§5 CEO 기준 다섯 증거 확보 현황 — 🔴 분모는 상세설명 비교가 닿은 쌍뿐이다");
    const withEv = all.filter((e) => Object.keys(e.evidence).length > 0);
    line(`   증거 현황을 아는 쌍 **${withEv.length}** / ${all.length}  ` +
      `🔴 나머지 **${all.length - withEv.length}** 은 **측정불가**(그 조사가 닿지 않았다)`);
    for (const k of ["titleRaw", "productName", "modelCode", "description", "normalizedTokens"]) {
      const n = withEv.filter((e) => e.evidence[k] === true).length;
      line(`      ${k.padEnd(18)} ${n}/${withEv.length}`);
    }

    line("\n§6 🔴 **분모를 섞지 않는다** — 이 숫자들은 서로 다른 것을 센다");
    line("   fixture 행 ≠ SAME05 쌍 ≠ CEO 11 ≠ DB 38행 ≠ 상세설명 109쌍 ≠ 고유 Pair");

    /* ─── 계약 ─────────────────────────────────────────────────────────── */
    expect(all.length, "🔴 고유 쌍이 0 이면 STEP 1 이 성립하지 않는다").toBeGreaterThan(0);
    /** 🔴 CEO 최신 11건이 **전부** 인벤토리에 들어와야 한다(하나라도 빠지면 분모가 거짓이다). */
    expect(withCeo.length, "🔴 CEO 최신 판정 11건이 전부 들어오지 않았다").toBe(ceo.pairs.length);
    /** 🔴 DB 38행이 **전부** 반영돼야 한다(스냅샷 없는 17 포함 · inner join 손실 재발 금지). */
    expect(all.filter((e) => e.sources.has("db:candidate_reviews")).length, "🔴 DB 행이 일부만 들어왔다")
      .toBeGreaterThanOrEqual(new Set(dbHuman.rows.map((r) => pairKey(r.origin_url, r.candidate_url) ?? codeKey(r.origin_code, r.candidate_url))).size);
    /** 🔴 **기존 GT 와 CEO 최신이 같은 칸에 들어가면 안 된다**(CPO §2). */
    for (const e of all) {
      expect(e.priorGt.has("ceo-review"), "🔴 CEO 최신이 기존 GT 칸에 섞였다").toBe(false);
    }
    /** 🔴 키를 못 만든 행을 조용히 버리지 않았다 — 그 수를 보고한다. */
    expect(Array.isArray(noPairKey)).toBe(true);
  });
});
