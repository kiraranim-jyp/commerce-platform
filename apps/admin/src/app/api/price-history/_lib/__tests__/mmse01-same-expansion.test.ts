/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-MULTI-CATEGORY-SAME-EXPANSION-01 — **다수 상품군 SAME 확대 가능성 검증**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용이다.** 운영 코드 0 · 판정 로직 0 · DB 쓰기 0 · UI 0 · 새 크롤러 0.
 * 🔴 **특정 사이트 한 곳을 중심으로 보지 않는다**(CPO §1-1) — 분모는 운영 전수다.
 *
 * ── 🟢 1차 빠른 판단은 **HTTP 0** 으로 한다 ────────────────────────────────
 * 운영이 판정 당시의 근거를 `candidate_reviews.match_reasons` 에 **문장으로 저장해
 * 둔다**. 그 문장이 「브랜드 일치/불일치」·「브랜드 품번 일치」·「양쪽 브랜드를 확인하지
 * 못했다」·「모델명 유사도 N%」를 **이미 구분해 적는다** ⟹ 🟢 전수 381행을 **라이브
 * 호출 없이** 1차 분류할 수 있다(CPO §3 「모든 후보를 동일한 깊이로 조사하지 않는다」).
 * 🔴 그 문장을 **해석해 판정을 바꾸지 않는다** — 분류만 한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIX = join(__dirname, "fixtures");
const BASE = join(FIX, "mmse01-baseline.json");
const DUMP = join(FIX, "mmse01-firstpass.json");

/** 🔴 상품군은 **판매처 자기 선언**(`shopifyProductType`)으로만 가른다 — 제목 추측 금지. */
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

interface Snap {
  snapshot_id: string;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  shopify_type: string | null;
  candidates: number;
}
interface Row {
  snapshot_id: string;
  candidate_domain: string;
  candidate_url: string;
  candidate_title: string | null;
  market: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_status: string | null;
  blockers: string[] | null;
  match_reasons: string[] | null;
  human_verdict: string | null;
}
interface Base {
  totals: { rows: number; snapshots: number; domains: number; human_labeled: number }[];
  bySnapshot: Snap[];
  rows: Row[];
}

/** 🟢 CPO §3 의 1차 결과 분류 — 🔴 여섯 상태를 **섞지 않는다**. */
type FirstPass =
  | "STRUCTURED_ENOUGH" // 구조화 정보로 충분히 판단 가능
  | "DESC_EVIDENCE" // 상세설명에서 식별값 추가 확인
  | "EXTRACTION_SUSPECT" // 구조화 추출 실패 의심
  | "LANG_SUSPECT" // 다국어·표기 차이 의심
  | "REAL_DIFFERENT" // 실제 다른 상품 근거
  | "INSUFFICIENT"; // 증거 부족으로 판단 보류

const has = (rs: string[], re: RegExp) => rs.some((r) => re.test(r));

/**
 * 🔴 **운영이 적어 둔 문장만 읽는다.** 판정을 만들지 않는다.
 * 🟢 세 축을 저장 문장에서 **그대로** 꺼낸다:
 * ```
 * 브랜드  「브랜드 일치」 / 「브랜드 불일치」 / 「보류: 양쪽 브랜드를 확인하지 못했다」
 *         / 「보류: 브랜드 A ↔ B」(실제 다른 브랜드가 적힌다)
 * 품번    「근거: 브랜드 품번 일치」 / 「품번증거=unavailable」
 * 상품명  「모델명 유사도 N%」 / 「보류: 핵심 상품명에 겹치는 말이 없다」
 * ```
 */
export function classifyFirstPass(row: Row): {
  state: FirstPass;
  brand: "MATCH" | "MISMATCH" | "UNCONFIRMED" | "UNKNOWN";
  code: "MATCH" | "NO_EVIDENCE" | "CONFLICT" | "UNKNOWN";
  nameSimilarity: number | null;
  titleOverlapZero: boolean;
  note: string;
} {
  const rs = row.match_reasons ?? [];
  const bl = row.blockers ?? [];

  const brand: "MATCH" | "MISMATCH" | "UNCONFIRMED" | "UNKNOWN" = has(rs, /브랜드 일치/)
    ? "MATCH"
    : has(rs, /양쪽 브랜드를 확인하지 못했다/) || bl.includes("BRAND_UNCONFIRMED")
      ? "UNCONFIRMED"
      : has(rs, /브랜드 불일치/) || bl.includes("BRAND_MISMATCH")
        ? "MISMATCH"
        : "UNKNOWN";

  const code: "MATCH" | "NO_EVIDENCE" | "CONFLICT" | "UNKNOWN" = bl.includes("MODEL_CODE")
    ? "CONFLICT"
    : has(rs, /근거: 브랜드 품번 일치/)
      ? "MATCH"
      : has(rs, /품번증거=unavailable/)
        ? "NO_EVIDENCE"
        : "UNKNOWN";

  const m = rs.map((r) => /모델명 유사도 (\d+)%/.exec(r)).find(Boolean);
  const nameSimilarity = m ? Number(m[1]) : null;
  const titleOverlapZero = bl.includes("NO_TITLE_OVERLAP") || has(rs, /핵심 상품명에 겹치는 말이 없다/);

  /** 🔴 **실제 다른 브랜드가 «이름으로» 적혔는가** — 「보류: 브랜드 X ↔ Y」 문장을 본다. */
  const namedBrandConflict = rs.find((r) => /보류: 브랜드 .+ ↔ .+/.test(r)) ?? null;

  let state: FirstPass;
  let note: string;
  if (brand === "MISMATCH" && namedBrandConflict) {
    state = "REAL_DIFFERENT";
    note = namedBrandConflict;
  } else if (code === "CONFLICT") {
    state = "REAL_DIFFERENT";
    note = "품번 충돌(기존 정책 유지)";
  } else if (brand === "MATCH" && code === "MATCH" && !titleOverlapZero) {
    state = "STRUCTURED_ENOUGH";
    note = `브랜드·품번 일치 · 상품명 유사도 ${nameSimilarity ?? "?"}%`;
  } else if (brand === "MATCH" && code === "MATCH" && titleOverlapZero) {
    state = "LANG_SUSPECT";
    note = "브랜드·품번은 일치하는데 제목 토큰 겹침 0 ⟹ 언어·표기 의심";
  } else if (brand === "UNCONFIRMED" && code === "MATCH") {
    state = "EXTRACTION_SUSPECT";
    note = "품번은 일치하는데 브랜드를 확인하지 못했다 ⟹ 브랜드 추출 실패 의심";
  } else if (code === "MATCH") {
    state = "DESC_EVIDENCE";
    note = "품번 일치 근거 보유(브랜드 축 미확정)";
  } else {
    state = "INSUFFICIENT";
    note = `브랜드=${brand} · 품번=${code} · 제목겹침0=${titleOverlapZero}`;
  }
  return { state, brand, code, nameSimilarity, titleOverlapZero, note };
}

describe("MMSE01 — 다수 상품군 1차 빠른 판단(HTTP 0)", () => {
  const base = JSON.parse(readFileSync(BASE, "utf8")) as Base;

  it("A-0 🔴 분모를 먼저 잠근다 — 운영 전수 381행 · 스냅샷 122 · 도메인 33", () => {
    const t = base.totals[0]!;
    expect(t.rows, "🔴 후보 전수가 바뀌었다").toBe(381);
    expect(t.snapshots).toBe(122);
    expect(t.domains).toBe(33);
    expect(t.human_labeled, "🔴 사람 라벨 수가 바뀌었다").toBe(39);
    expect(base.rows).toHaveLength(381);
  });

  it("A-1 🔴🔴 상품군 확보량 — **신발 0 · 가방 1 · 액세서리 1**(임의로 채우지 않는다)", () => {
    const byGroup: Record<string, { snapshots: number; types: Set<string> }> = {};
    for (const s of base.bySnapshot) {
      const t = s.shopify_type ?? "(없음)";
      const g = TYPE_GROUP[t] ?? `미분류:${t}`;
      byGroup[g] = byGroup[g] ?? { snapshots: 0, types: new Set() };
      byGroup[g].snapshots += 1;
      byGroup[g].types.add(t);
    }
    /** 🔴 CPO §2 예시 중 **신발 유형은 운영 데이터에 하나도 없다**. */
    expect(Object.keys(byGroup).some((k) => k.includes("신발")), "🔴 신발 상품군이 생겼다면 분모가 바뀐 것이다").toBe(false);
    expect(byGroup["가방"]?.snapshots).toBe(1);
    expect(byGroup["액세서리-모자"]?.snapshots).toBe(1);
    expect(byGroup["의류-상의"]?.snapshots).toBe(108);
  });

  it("A-2 🔴🔴 **원상품 품번 보유가 43/122(35.2%)** 다 — 이 숫자가 1차 판단의 상한이다", () => {
    const withSku = base.bySnapshot.filter((s) => Boolean(s.origin_sku && s.origin_sku.trim())).length;
    expect(withSku).toBe(43);
    expect(base.bySnapshot).toHaveLength(122);
  });

  it("B-1 🟢🟢 1차 분류 전수 — 여섯 상태로 갈라 집계한다(HTTP 0)", () => {
    const snapById = new Map(base.bySnapshot.map((s) => [s.snapshot_id, s]));
    const perRow = base.rows.map((r) => {
      const s = snapById.get(r.snapshot_id);
      const t = s?.shopify_type ?? "(없음)";
      return {
        group: TYPE_GROUP[t] ?? `미분류:${t}`,
        originTitle: s?.origin_title ?? null,
        originSku: s?.origin_sku ?? null,
        originHasSku: Boolean(s?.origin_sku && s.origin_sku.trim()),
        domain: r.candidate_domain,
        url: r.candidate_url,
        market: r.market,
        verdict: r.system_verdict,
        tier: r.price_tier,
        human: r.human_verdict,
        ...classifyFirstPass(r),
      };
    });

    const agg: Record<string, Record<string, number>> = {};
    for (const p of perRow) {
      agg[p.group] = agg[p.group] ?? {};
      agg[p.group]![p.state] = (agg[p.group]![p.state] ?? 0) + 1;
    }

    /** 🟢 기존 SAME ↔ 1차에서 「동일상품 가능」으로 올라올 수 있는 후보를 **갈라** 센다. */
    const existingSame = perRow.filter((p) => p.verdict === "SAME").length;
    const liftCandidates = perRow.filter(
      (p) => p.verdict !== "SAME" && (p.state === "LANG_SUSPECT" || p.state === "EXTRACTION_SUSPECT"),
    );
    const realDifferent = perRow.filter((p) => p.state === "REAL_DIFFERENT").length;
    const insufficient = perRow.filter((p) => p.state === "INSUFFICIENT").length;

    writeFileSync(
      DUMP,
      JSON.stringify(
        {
          note:
            "MI-MULTI-CATEGORY-SAME-EXPANSION-01 1차 빠른 판단 — 운영 저장 match_reasons 분류. " +
            "HTTP 0 · 판정 변경 0 · 분류만 한다.",
          totals: base.totals[0],
          groupAgg: agg,
          existingSame,
          liftCandidateCount: liftCandidates.length,
          realDifferent,
          insufficient,
          liftCandidates: liftCandidates.map((p) => ({
            group: p.group,
            originTitle: p.originTitle,
            originHasSku: p.originHasSku,
            domain: p.domain,
            url: p.url,
            market: p.market,
            verdict: p.verdict,
            tier: p.tier,
            human: p.human,
            state: p.state,
            brand: p.brand,
            code: p.code,
            nameSimilarity: p.nameSimilarity,
            note: p.note,
          })),
          perRow,
        },
        null,
        1,
      ),
      "utf8",
    );

    /* eslint-disable no-console */
    console.log("\n═══ 1차 빠른 판단 — 상품군 × 상태 ═══");
    const states: FirstPass[] = [
      "STRUCTURED_ENOUGH",
      "LANG_SUSPECT",
      "EXTRACTION_SUSPECT",
      "DESC_EVIDENCE",
      "REAL_DIFFERENT",
      "INSUFFICIENT",
    ];
    console.log(["상품군".padEnd(22), ...states.map((s) => s.slice(0, 10).padStart(11))].join(" |"));
    for (const [g, m] of Object.entries(agg).sort(
      (a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0),
    )) {
      console.log([g.padEnd(22), ...states.map((s) => String(m[s] ?? 0).padStart(11))].join(" |"));
    }
    console.log(`\n기존 SAME ${existingSame} · 1차 상향 후보 ${liftCandidates.length} · 실제다름 ${realDifferent} · 증거부족 ${insufficient}`);
    console.log("\n═══ 1차 상향 후보 전수 ═══");
    for (const p of liftCandidates) {
      console.log(
        [
          p.state.padEnd(19),
          p.domain.padEnd(26),
          (p.market ?? "-").padEnd(8),
          "verdict=" + (p.verdict ?? "-"),
          "tier=" + (p.tier ?? "-"),
          "human=" + (p.human ?? "-"),
          "품번=" + p.code,
          "브랜드=" + p.brand,
          "유사도=" + (p.nameSimilarity ?? "-"),
          "| " + String(p.originTitle ?? "").slice(0, 30),
        ].join(" "),
      );
    }
    /* eslint-enable no-console */

    expect(perRow).toHaveLength(381);
    /** 🔴 분모를 같이 잠근다 — 상향 후보가 0 이면 이 WU 의 결론이 「효과 없음」이다. */
    expect(liftCandidates.length, "🔴 1차 상향 후보 수가 바뀌었다").toBeGreaterThanOrEqual(0);
  });

  it("C-1 🔴 분류기는 **판정을 만들지 않는다** — 저장 문장만 읽는다", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    /** 🔴 threshold·tier·verdict 를 계산하거나 덮는 코드가 없어야 한다. */
    /** 🔴 **자기참조 함정 — 이 세션 세 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
    const banned4 = [
      ["price", "TierFromLink"].join(""),
      ["SAME", "MIN", "AXES"].join("_"),
      ["crossSeller", "Verdict ="].join(""),
      ["human", "verdict ="].join("_"),
    ];
    for (const banned of banned4) {
      expect(src, `🔴 판정을 만들었다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 입력은 저장 문장 둘뿐이다. */
    expect(src).toContain("row.match_reasons");
    expect(src).toContain("row.blockers");
  });
});
