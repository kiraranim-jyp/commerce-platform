/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-MULTI-CATEGORY-SAME-EXPANSION-02 — **품번 증거 경로 검증 + 기준선 정합성**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 운영 코드 0 · 판정 로직 0 · slug 품번 식별자 인정 **0** ·
 *    blocker/eligibility 0 · DB 0 · UI 0 · 새 라이브 수집 **0**(기존 산출물 재사용).
 * 🟢 품번 복구는 **운영 순수 함수** `extractUrlSlug` + `extractCodeLikeSlugSegment` 를
 *    그대로 부른다(HTTP 0 · 새 추출기 0).
 *
 * 🔴🔴 **CPO 가 지적한 분모 불일치를 먼저 닫는다** — 381 vs 364 · 86 vs 83.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractCodeLikeSlugSegment, extractUrlSlug } from "@commerce/shared";

const FIX = join(__dirname, "fixtures");
const BASE = join(FIX, "mmse01-baseline.json");
const SECOND = join(FIX, "mmse01-secondpass.json");
const DUMP = join(FIX, "mmse02-code-evidence.json");

interface Snap {
  snapshot_id: string;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  shopify_type: string | null;
  source_url: string | null;
  candidates: number;
  v_same: number;
}
interface Row {
  snapshot_id: string | null;
  candidate_url: string;
  candidate_domain: string | null;
  candidate_title: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  blockers: string[] | null;
  match_reasons: string[] | null;
  human_verdict: string | null;
  source: string | null;
}
interface Base {
  totals: { rows: number; snapshots: number; domains: number; human_labeled: number }[];
  bySnapshot: Snap[];
  rows: Row[];
}

/** 🟢 운영 저장 문장에서 **품번 쌍** 을 그대로 꺼낸다 — 해석하지 않는다. */
function storedCodePair(reasons: string[]): { origin: string | null; candidate: string | null; raw: string | null } {
  for (const r of reasons) {
    const m = /품번증거=\S+\s*\(해외\s*(.+?)\s*↔\s*국내\s*(.+?)\)/.exec(r);
    if (m) {
      const norm = (s: string) => (s === "없음" || s === "unavailable" ? null : s.trim());
      return { origin: norm(m[1]!), candidate: norm(m[2]!), raw: r };
    }
  }
  return { origin: null, candidate: null, raw: null };
}

/** 🟢 **운영 순수 함수** 로 URL 에서 품번 모양을 복구한다(HTTP 0). */
const codeFromUrl = (url: string | null | undefined): string | null =>
  extractCodeLikeSlugSegment(extractUrlSlug(url ?? null));

/**
 * 🔴 CPO §4 의 위험 분류 — **여섯으로 가른다.** 섞지 않는다.
 * 🔴 「정확한 일치」와 「표기만 다름」을 같은 칸에 넣지 않는다.
 */
type Risk =
  | "EXACT_MATCH" // 정확한 품번 일치
  | "NOTATION_ONLY" // 표기만 다른 품번(대소문자·구분자·접미)
  | "SLUG_INCIDENTAL" // URL slug 에서 우연히 추출된 문자열
  | "VARIANT_BLIND" // 상품 변형을 구분하지 못하는 품번
  | "REAL_CONFLICT" // 실제 품번 충돌
  | "BASELINE_MISSING"; // 기준값 자체가 누락

const canon = (s: string | null) => (s ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : null);
/** 🔴 숫자만인 세그먼트는 식별자가 아니다 — 기존 가드와 **같은 기준** 이다(WU-095). */
const numericOnly = (s: string | null) => Boolean(s && /^[0-9]+$/.test(s));

function classifyRisk(originCode: string | null, candCode: string | null): { risk: Risk; note: string } {
  if (!originCode) return { risk: "BASELINE_MISSING", note: "원상품 기준 품번이 없다" };
  if (!candCode) return { risk: "BASELINE_MISSING", note: "후보 품번이 없다" };
  if (numericOnly(candCode) || numericOnly(originCode))
    return { risk: "SLUG_INCIDENTAL", note: "숫자만인 세그먼트 — 식별자로 쓰지 않는다" };
  const a = canon(originCode)!;
  const b = canon(candCode)!;
  if (a === b) return { risk: "EXACT_MATCH", note: "정규화 후 완전 일치" };
  if (a.startsWith(b) || b.startsWith(a))
    return {
      risk: "VARIANT_BLIND",
      note: `접두 공유 — 한쪽이 더 길다(색상·시즌 접미 가능): ${originCode} ↔ ${candCode}`,
    };
  /** 🔴 공통 접두 4자 이상 뒤 분기 = 기존 `compareModelCode` 가 conflict 로 보는 모양. */
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i >= 4) return { risk: "REAL_CONFLICT", note: `공통 접두 ${i}자 뒤 분기: ${originCode} ↔ ${candCode}` };
  return { risk: "REAL_CONFLICT", note: `전혀 다른 품번: ${originCode} ↔ ${candCode}` };
}

describe("MMSE02 — 기준선 정합성 + 품번 증거 출처", () => {
  const base = JSON.parse(readFileSync(BASE, "utf8")) as Base;

  /* ═══ A. 기준선 정합성 — 🔴 CPO 가 지적한 세 숫자 ═══════════════════════ */

  it("A-1 🔴🔴 **분모 불일치의 원인은 `snapshot_id` 가 NULL 인 17행** 이다", () => {
    const orphans = base.rows.filter((r) => r.snapshot_id === null);
    expect(orphans, "🔴 고아 행 수가 바뀌었다").toHaveLength(17);
    /** 🔴🔴 **전부 `GT_IMPORT` 시딩 행** 이다 — 운영 판정 결과가 아니다. */
    expect(new Set(orphans.map((o) => o.source))).toEqual(new Set(["GT_IMPORT"]));
    /**
     * 🔴 `match_truth` 는 **전건 null** 이다(판정을 거치지 않았다).
     * 🔴🔴 **그런데 `price_tier` 가 `EXACT` 인 행이 «1건» 있다** — 내 1차 단언이
     *    「전건 null」이었고 **틀렸다**. 🟢 그 1건도 `match_truth` 는 null 이므로
     *    **판정 산출이 아니다**(GT 시딩 시점에 칸이 채워진 것으로 보인다 · 원인 미규명).
     */
    expect(orphans.every((o) => o.match_truth === null)).toBe(true);
    expect(orphans.filter((o) => o.price_tier === null)).toHaveLength(16);
    expect(orphans.filter((o) => o.price_tier === "EXACT")).toHaveLength(1);
    /** 🟢 그런데 `system_verdict` 칸에 값이 **일부 들어가 있다** ⟹ 그래서 86 으로 세졌다. */
    expect(orphans.filter((o) => o.system_verdict === "SAME")).toHaveLength(3);
    expect(orphans.filter((o) => o.system_verdict === "PRESUMED_SAME")).toHaveLength(2);
    expect(orphans.filter((o) => o.system_verdict === null)).toHaveLength(12);
  });

  it("A-2 🟢 **단일 기준선 — 후보 364 · 원상품 122 · 운영 SAME 83**", () => {
    const joined = base.rows.filter((r) => r.snapshot_id !== null);
    expect(joined).toHaveLength(364);
    expect(base.bySnapshot.reduce((s, r) => s + r.candidates, 0)).toBe(364);
    expect(base.bySnapshot).toHaveLength(122);
    expect(new Set(joined.map((r) => r.snapshot_id)).size).toBe(122);
    expect(joined.filter((r) => r.system_verdict === "SAME")).toHaveLength(83);
    expect(base.bySnapshot.reduce((s, r) => s + r.v_same, 0)).toBe(83);
    /** 🔴 `candidate_reviews` 단독 숫자(381/86)는 **GT 시딩을 포함한 값** 이다. */
    expect(base.totals[0]!.rows).toBe(381);
    expect(base.rows.filter((r) => r.system_verdict === "SAME")).toHaveLength(86);
  });

  it("A-3 🔴 **「원상품 122 vs 121」은 내 표가 122 로 맞다** — 합계를 다시 센다", () => {
    const TYPE_GROUP: Record<string, string> = {
      "T-shirts": "의류-상의",
      "T Shirt": "의류-상의",
      Sweatshirts: "의류-상의",
      Blouse: "의류-상의",
      Dress: "의류-원피스",
      Trousers: "의류-하의",
      Jacket: "의류-아웃터",
      Outerwear: "의류-아웃터",
      Cap: "액세서리-모자",
      Backpack: "가방",
    };
    const g: Record<string, number> = {};
    for (const s of base.bySnapshot) {
      const k = TYPE_GROUP[s.shopify_type ?? "(없음)"] ?? `미분류:${s.shopify_type ?? "(없음)"}`;
      g[k] = (g[k] ?? 0) + 1;
    }
    expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(122);
    expect(g["의류-상의"]).toBe(108);
  });

  /* ═══ B. 품번 증거 출처 — 🔴 여덟 칸을 갈라 적는다 ═══════════════════════ */

  it("B-1 🟢🟢 품번 증거 출처 전수 분해(HTTP 0) — MATCH / CONFLICT 위험 측정", () => {
    const snapById = new Map(base.bySnapshot.map((s) => [s.snapshot_id, s]));
    const joined = base.rows.filter((r) => r.snapshot_id !== null);

    const detail = joined.map((r) => {
      const s = snapById.get(r.snapshot_id!)!;
      const reasons = r.match_reasons ?? [];
      const bl = r.blockers ?? [];
      const stored = storedCodePair(reasons);

      /* ① 원상품 DB SKU */
      const originDbSku = s.origin_sku && s.origin_sku.trim() ? s.origin_sku.trim() : null;
      /* ② 원상품 URL 복구 품번 — 운영 순수 함수 */
      const originUrlCode = codeFromUrl(s.source_url);
      /* ③ 후보 구조화 품번 — 🔴 저장 칸이 «없다». URL 복구값으로 대신하고 그 사실을 적는다. */
      const candUrlCode = codeFromUrl(r.candidate_url);
      /* ④ 후보 상세설명 품번 — 🔴 저장 칸이 없다(2차 라이브에서만 확보) */
      /* ⑤ match_reasons 의 품번 증거 */
      const storedOrigin = stored.origin;
      const storedCand = stored.candidate;
      const codeAxis = bl.includes("MODEL_CODE")
        ? "CONFLICT"
        : reasons.some((x) => /근거: 브랜드 품번 일치/.test(x))
          ? "MATCH"
          : reasons.some((x) => /품번증거=unavailable/.test(x))
            ? "NO_EVIDENCE"
            : "UNKNOWN";

      /* ⑥ 출처 */
      const originSource = originDbSku
        ? "DB sku"
        : originUrlCode
          ? "URL slug 복구"
          : "없음";
      const candSource = candUrlCode ? "URL slug 복구" : "없음";

      /* ⑦⑧ 일치 여부 + 변형 구분 */
      const originEffective = originDbSku ?? originUrlCode ?? storedOrigin;
      const candEffective = candUrlCode ?? storedCand;
      const { risk, note } = classifyRisk(originEffective, candEffective);
      /** 🔴 변형(색상·시즌) 접미를 **구분할 수 있는가** — 접미 유무를 사실로만 적는다. */
      const variantSuffix =
        originEffective && candEffective && canon(originEffective) !== canon(candEffective)
          ? /[-_][0-9]{2,4}$/.test(candEffective) || /[-_][0-9]{2,4}$/.test(originEffective)
          : false;

      return {
        snapshot: r.snapshot_id!.slice(0, 8),
        group: s.shopify_type ?? "(없음)",
        originTitle: s.origin_title,
        domain: r.candidate_domain,
        codeAxis,
        originDbSku,
        originUrlCode,
        candUrlCode,
        storedOrigin,
        storedCand,
        storedRaw: stored.raw,
        originSource,
        candSource,
        originEffective,
        candEffective,
        risk,
        riskNote: note,
        variantSuffix,
        verdict: r.system_verdict,
        tier: r.price_tier,
        human: r.human_verdict,
      };
    });

    const match = detail.filter((d) => d.codeAxis === "MATCH");
    const conflict = detail.filter((d) => d.codeAxis === "CONFLICT");

    const riskOf = (arr: typeof detail) => {
      const m: Record<string, number> = {};
      for (const d of arr) m[d.risk] = (m[d.risk] ?? 0) + 1;
      return m;
    };

    writeFileSync(
      DUMP,
      JSON.stringify(
        {
          note:
            "MMSE02 — 기준선 정합성 + 품번 증거 출처 분해. HTTP 0 · 운영 순수 함수 " +
            "extractUrlSlug/extractCodeLikeSlugSegment 사용 · 판정 변경 0 · slug 식별자 인정 0.",
          baseline: {
            candidateReviewsRows: base.totals[0]!.rows,
            orphanNullSnapshot: 17,
            orphanSource: "GT_IMPORT",
            joinedRows: 364,
            snapshots: 122,
            operationalSame: 83,
            rawSameIncludingSeed: 86,
          },
          matchRisk: riskOf(match),
          conflictRisk: riskOf(conflict),
          matchCount: match.length,
          conflictCount: conflict.length,
          match,
          conflict,
        },
        null,
        1,
      ),
      "utf8",
    );

    /* eslint-disable no-console */
    console.log("\n═══ A. 기준선 정합성 ═══");
    console.log(`  candidate_reviews 전수        381  (= 364 + GT_IMPORT 고아 17)`);
    console.log(`  snapshot 연결 후보             364  ← 🟢 단일 기준선`);
    console.log(`  원상품(스냅샷)                 122`);
    console.log(`  운영 판정 SAME                  83  ← 🟢 단일 기준선`);
    console.log(`  🔴 raw SAME 86 = 83 + GT_IMPORT 시딩 3(tier·truth 전건 null)`);

    console.log(`\n═══ B. 품번축 MATCH ${match.length}건 — 위험 분류 ═══`);
    console.log("  " + JSON.stringify(riskOf(match)));
    console.log(`═══ 품번축 CONFLICT ${conflict.length}건 — 위험 분류 ═══`);
    console.log("  " + JSON.stringify(riskOf(conflict)));

    console.log("\n── MATCH 의 품번 출처 조합 ──");
    const srcCombo: Record<string, number> = {};
    for (const d of match) {
      const k = `원상품=${d.originSource} / 후보=${d.candSource} / 위험=${d.risk}`;
      srcCombo[k] = (srcCombo[k] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(srcCombo).sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(v).padStart(3)}  ${k}`);

    console.log("\n── CONFLICT 의 품번 출처 조합 ──");
    const cCombo: Record<string, number> = {};
    for (const d of conflict) {
      const k = `원상품=${d.originSource} / 후보=${d.candSource} / 위험=${d.risk}`;
      cCombo[k] = (cCombo[k] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(cCombo).sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(v).padStart(3)}  ${k}`);

    console.log("\n── CONFLICT 실제 품번 쌍(상위 12) ──");
    for (const d of conflict.slice(0, 12))
      console.log(
        `  ${String(d.domain ?? "-").padEnd(24)} 원=${String(d.originEffective ?? "-").padEnd(14)} 후=${String(d.candEffective ?? "-").padEnd(16)} ${d.risk}  ${d.riskNote.slice(0, 50)}`,
      );
    /* eslint-enable no-console */

    expect(detail).toHaveLength(364);
    expect(match.length + conflict.length).toBeGreaterThan(0);
  });

  /* ═══ C. Wynken 2건 — 원상품·후보 품번 연결 검증 ═════════════════════════ */

  it("C-1 🟢 Wynken 2건의 품번 연결을 여덟 칸으로 갈라 적는다", () => {
    const second = JSON.parse(readFileSync(SECOND, "utf8")) as {
      rows: {
        group: string;
        originTitle: string | null;
        originBrand: string | null;
        originSku: string | null;
        domain: string | null;
        url: string;
        live: {
          brandRaw: string | null;
          codeRaw: string | null;
          originCodeInCandidate: { found: boolean; excerpt: string | null };
          originBrandInCandidate: { found: boolean; excerpt: string | null };
        };
      }[];
    };
    const wyn = second.rows.filter((r) => r.originBrand === "Wynken");
    /** 🔴 **4건이다** — 내 1차 단언이 3 이었고 틀렸다(같은 원상품에 후보 3곳 + 모자 1곳). */
    expect(wyn, "🔴 Wynken 대상 수가 바뀌었다").toHaveLength(4);

    const snapByTitle = new Map(base.bySnapshot.map((s) => [s.origin_title, s]));
    const out = wyn.map((w) => {
      const s = snapByTitle.get(w.originTitle ?? "") ?? null;
      const originUrlCode = codeFromUrl(s?.source_url ?? null);
      const candUrlCode = codeFromUrl(w.url);
      const { risk, note } = classifyRisk(w.originSku ?? originUrlCode, w.live.codeRaw ?? candUrlCode);
      return {
        group: w.group,
        originTitle: w.originTitle,
        domain: w.domain,
        /* ① 원상품 DB SKU */ originDbSku: w.originSku,
        /* ② 원상품 URL 복구 */ originUrlCode,
        /* ③ 후보 구조화(라이브 추출) */ candStructuredCode: w.live.codeRaw,
        /* ④ 후보 상세설명 품번 */ candDescCode: w.live.originCodeInCandidate.found
          ? w.live.originCodeInCandidate.excerpt
          : null,
        /* ⑤ 후보 URL 복구 */ candUrlCode,
        /* ⑥ 브랜드 근거 */ candBrand: w.live.brandRaw,
        brandExcerpt: w.live.originBrandInCandidate.excerpt,
        /* ⑦ 일치 여부 */ risk,
        riskNote: note,
        /* ⑧ 변형 구분 */ variantDistinguishable:
          /[-_][0-9]{2,4}$/.test(w.originSku ?? "") || /[-_][0-9]{2,4}$/.test(w.live.codeRaw ?? ""),
      };
    });

    /* eslint-disable no-console */
    console.log("\n═══ C. Wynken 품번 연결 검증 ═══");
    for (const o of out) {
      console.log(`\n  [${o.group}] ${o.domain} — ${o.originTitle}`);
      console.log(`    ① 원상품 DB SKU        : ${JSON.stringify(o.originDbSku)}`);
      console.log(`    ② 원상품 URL 복구 품번  : ${JSON.stringify(o.originUrlCode)}`);
      console.log(`    ③ 후보 구조화 품번      : ${JSON.stringify(o.candStructuredCode)}`);
      console.log(`    ④ 후보 상세설명 품번    : ${o.candDescCode ?? "없음"}`);
      console.log(`    ⑤ 후보 URL 복구 품번    : ${JSON.stringify(o.candUrlCode)}`);
      console.log(`    ⑥ 후보 브랜드          : ${JSON.stringify(o.candBrand)} | ${o.brandExcerpt ?? "-"}`);
      console.log(`    ⑦ 일치 판정            : ${o.risk} — ${o.riskNote}`);
      console.log(`    ⑧ 변형 접미 구분 가능   : ${o.variantDistinguishable}`);
    }
    /* eslint-enable no-console */

    /** 🟢 두 건은 품번이 **정확히 일치** 한다(세 출처가 같은 값을 말한다). */
    const exact = out.filter((o) => o.risk === "EXACT_MATCH");
    expect(exact.length, "🔴 Wynken 정확 일치 건수가 바뀌었다").toBe(2);
    /** 🔴 나머지 **2건** 은 후보 품번이 없다 — 올리지 않는다(미확정). */
    expect(out.filter((o) => o.risk !== "EXACT_MATCH")).toHaveLength(2);
  });

  it("D-1 🔴 이 파일은 **slug 품번을 식별자로 인정하지 않는다**(CPO §5)", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of [
      ["price", "TierFromLink"].join(""),
      ["SAME", "MIN", "AXES"].join("_"),
      ["attach", "MatchTruth"].join(""),
    ]) {
      expect(src, `🔴 판정 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 복구는 **순수 함수 둘** 로만 한다. */
    expect(src).toContain("extractCodeLikeSlugSegment(extractUrlSlug(");
  });
});
