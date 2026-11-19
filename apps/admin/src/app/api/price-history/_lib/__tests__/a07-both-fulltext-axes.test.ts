/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 A 과제 ④ — **양쪽 원문이 «둘 다» 있는 쌍만** 축 집계(CPO 승인 2026-11-19)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **새 수집 0 · HTTP 0 · DB 0 · service-role 0 · 기존 fixture 쓰기 0.**
 *    verdict 재계산 **0** · 정밀도 산출 **0** · SAME 정책 변경 **0** · 운영 연결 **0**.
 *
 * 🟢 **입력 셋**(전부 커밋된 자료를 «읽기만» 한다)
 * ```
 * 원본측  fixtures/wu-059-gt-facts.json  origins[S1..S6].canonicalProduct
 *         🟢 description.value **6/6** 보유 · descriptionKo · titleKo · material · color · sku
 * 후보측  preserved/a22-candidate-descriptions.json  확보 **7건**
 * 연결    docs/MI-REEVAL-STEP5-SHADOW.json#pairsA  originUrl → S* **33/33 매핑**
 * ```
 *
 * 🔴🔴 **분모를 억지로 늘리지 않았다 — 「7 + 14」로 합산하지 않는다**:
 * ```
 * wu-059 의 candidates **14건** 은 `facts`(추출 축)만 들고 **설명문 원문이 0/14** 다
 *   (칸 전수: sourceUrl·urlSlug·brand·brandModelCode·sellerSku·title·coreTitleTokens·
 *    categoryText·colorText·materialText·fitText·ageRangeText·sizeLabels·
 *    audienceSignals·imageUrls — **description 이 없다**)
 * ⟹ 🔴 후보측 원문은 **A22 의 7건이 유일** 하다. 교집합(A22확보 ∩ wu059) 은 **2** 지만
 *    그 2건도 설명문은 A22 쪽에서만 온다 ⟹ **분모는 7 이다.**
 * ```
 *
 * 🔴 **A22 의 `MODEL_CODE MISMATCH 3` 은 이 분석에서 «제외» 한다** — 그 값은
 *    `pairId.split("|")[0]`(= `C27` 같은 **쌍 ID**)을 code 로 넣어 생긴 **무의미한 값** 이다.
 *    🟢 이 하니스는 code 를 **원본 `canonicalProduct.sku`** 에서 읽는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ALL_AXES,
  compareAxis,
  extractKeywords,
  type ExtractOptions,
} from "./mi-reeval-shadow-keywords";

const HERE = path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__");
const GT_FACTS = path.join(HERE, "fixtures", "wu-059-gt-facts.json");
const A22 = path.join(HERE, "preserved", "a22-candidate-descriptions.json");
const SHADOW = path.join(process.cwd(), "..", "..", "docs", "MI-REEVAL-STEP5-SHADOW.json");
/** 🔴 쓰기는 **전용 파일 하나** — 기존 fixture 를 덮어쓰지 않는다. */
const OUT = path.join(HERE, "preserved", "a07-both-fulltext-axes.json");

type CanonicalProduct = {
  sku?: string | null;
  brand?: { value?: string | null } | string | null;
  color?: string | null;
  title?: string | null;
  titleKo?: string | null;
  material?: string | null;
  sourceUrl?: string | null;
  description?: { value?: string | null } | string | null;
  descriptionKo?: { value?: string | null } | string | null;
};
type A22Row = {
  pairId: string;
  host: string;
  gt: string;
  hasDescription: boolean;
  title: string | null;
  description: string | null;
};

/** 🔴 칸 모양이 두 가지다(`{value}` ↔ 문자열) — 추측하지 않고 둘 다 읽는다. */
const val = (v: unknown): string | null => {
  if (typeof v === "string") return v.length > 0 ? v : null;
  if (v && typeof v === "object" && "value" in v) {
    const x = (v as { value?: unknown }).value;
    return typeof x === "string" && x.length > 0 ? x : null;
  }
  return null;
};

function load() {
  const gt = JSON.parse(readFileSync(GT_FACTS, "utf8")) as {
    origins: Record<string, { canonicalProduct: CanonicalProduct }>;
  };
  const a22 = JSON.parse(readFileSync(A22, "utf8")) as { rows: A22Row[] };
  const pairsA = (
    JSON.parse(readFileSync(SHADOW, "utf8")) as {
      pairsA: { pairId: string; originUrl: string }[];
    }
  ).pairsA;

  /** 🟢 원상품 sourceUrl → S* 역색인(손으로 고르지 않는다). */
  const byUrl = new Map<string, string>();
  for (const [s, v] of Object.entries(gt.origins)) {
    const u = v.canonicalProduct?.sourceUrl;
    if (u) byUrl.set(u, s);
  }
  /** 🟢 pairId → S* (originUrl 로 기계적 연결). */
  const pairToS = new Map<string, string>();
  for (const p of pairsA) {
    const s = byUrl.get(p.originUrl);
    if (s) pairToS.set(String(p.pairId).split("|")[0] ?? "", s);
  }
  return { gt, a22, pairsA, pairToS };
}

const GUARDS_OFF: ExtractOptions = {};
const GUARDS_ON: ExtractOptions = { useObserved: true };

describe("A 과제 ④ — 양쪽 원문 교집합 축 집계(네트워크 0)", () => {
  it("M-1 🟢 원본 연결 — `pairsA` **33/33** 이 S* 로 매핑되고 설명문은 **6/6**", () => {
    const { gt, pairToS } = load();
    expect(pairToS.size).toBe(33);
    const withDesc = Object.values(gt.origins).filter((o) =>
      val(o.canonicalProduct?.description),
    ).length;
    expect(withDesc).toBe(6);
  });

  it("M-2 🔴 `wu-059` candidates 는 설명문을 **0/14** 들고 있다(분모에 넣지 않는다)", () => {
    const raw = JSON.parse(readFileSync(GT_FACTS, "utf8")) as {
      candidates: Record<string, { facts?: Record<string, unknown> }>;
    };
    const keys = Object.keys(raw.candidates);
    expect(keys).toHaveLength(14);
    const withDesc = keys.filter((k) => val(raw.candidates[k]?.facts?.description)).length;
    expect(withDesc, "🔴 facts 는 추출 축만 들고 원문이 없다").toBe(0);
  });

  it("M-3 🔴🔴 **합산하지 않는다** — 분모는 A22 확보 **7** 이다", () => {
    const { a22 } = load();
    const got = a22.rows.filter((r) => r.hasDescription);
    expect(got).toHaveLength(7);
    /** 🔴 7 + 14 = 21 이 아니다. 후보측 원문의 출처는 A22 하나다. */
    expect(got.every((r) => typeof r.description === "string" && r.description.length > 0)).toBe(true);
  });

  it("M-4 🔵 양쪽 원문 쌍만 축 집계(가드 ON/OFF) — 산출물 보존", () => {
    const { gt, a22, pairToS } = load();
    const rows: Record<string, unknown>[] = [];

    for (const r of a22.rows.filter((x) => x.hasDescription)) {
      const id = String(r.pairId).split("|")[0] ?? "";
      const s = pairToS.get(id);
      /** 🔴 원본측이 없으면 **분모에 넣지 않는다**(억지로 채우지 않는다). */
      if (!s) continue;
      const cp = gt.origins[s]?.canonicalProduct;
      const oDesc = val(cp?.description);
      if (!cp || !oDesc) continue;

      const originInput = {
        title: val(cp.title),
        description: oDesc,
        descriptionKo: val(cp.descriptionKo),
        brand: val(cp.brand),
        color: val(cp.color),
        material: val(cp.material),
        /** 🟢 code 는 **원본 sku** 에서 읽는다 — A22 의 쌍 ID 오용을 반복하지 않는다. */
        code: val(cp.sku),
      };
      const candInput = { title: r.title, description: r.description };

      const axes: Record<string, { off: string; on: string }> = {};
      for (const axis of ALL_AXES) {
        axes[axis] = {
          off: compareAxis(
            axis,
            extractKeywords(originInput, GUARDS_OFF),
            extractKeywords(candInput, GUARDS_OFF),
          ).status,
          on: compareAxis(
            axis,
            extractKeywords(originInput, GUARDS_ON),
            extractKeywords(candInput, GUARDS_ON),
          ).status,
        };
      }
      rows.push({
        pairId: id,
        origin: s,
        host: r.host,
        gt: r.gt,
        originDescriptionLength: oDesc.length,
        candidateDescriptionLength: r.description?.length ?? 0,
        axes,
      });
    }

    const tally = (which: "off" | "on") => {
      const t: Record<string, Record<string, number>> = {};
      for (const row of rows) {
        const ax = row.axes as Record<string, { off: string; on: string }>;
        for (const axis of ALL_AXES) {
          const st = ax[axis][which];
          t[axis] ??= {};
          t[axis][st] = (t[axis][st] ?? 0) + 1;
        }
      }
      return t;
    };
    const byGt = (which: "off" | "on", gtv: string) => {
      const t: Record<string, Record<string, number>> = {};
      for (const row of rows.filter((x) => x.gt === gtv)) {
        const ax = row.axes as Record<string, { off: string; on: string }>;
        for (const axis of ALL_AXES) {
          const st = ax[axis][which];
          t[axis] ??= {};
          t[axis][st] = (t[axis][st] ?? 0) + 1;
        }
      }
      return t;
    };
    /** 🟢 가드가 실제로 바꾼 축을 **쌍 단위** 로 센다. */
    const changed = rows.filter((row) => {
      const ax = row.axes as Record<string, { off: string; on: string }>;
      return ALL_AXES.some((axis) => ax[axis].off !== ax[axis].on);
    }).length;

    const out = {
      note: "🔴 관찰 실험 — verdict 재계산 0 · 정밀도 0 · SAME 정책 변경 0 · 운영 연결 0. 표본 7쌍은 모집단을 대표하지 않는다.",
      denominator: { aGroup: 33, candidateFullTextFromA22: 7, bothFullText: rows.length },
      gtDistribution: {
        SAME: rows.filter((r) => r.gt === "SAME").length,
        DIFFERENT: rows.filter((r) => r.gt === "DIFFERENT").length,
      },
      guardChangedPairs: changed,
      axisTallyGuardsOff: tally("off"),
      axisTallyGuardsOn: tally("on"),
      byGtGuardsOff: { SAME: byGt("off", "SAME"), DIFFERENT: byGt("off", "DIFFERENT") },
      rows,
    };
    writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`[A07-DENOM] ${JSON.stringify({ ...out.denominator, gt: out.gtDistribution, guardChangedPairs: changed })}`);
    console.log(`[A07-AXES off] ${JSON.stringify(out.axisTallyGuardsOff)}`);
    console.log(`[A07-AXES on ] ${JSON.stringify(out.axisTallyGuardsOn)}`);
    console.log(`[A07-BYGT] ${JSON.stringify(out.byGtGuardsOff)}`);

    /** 🔴 분모가 0 이면 **PASS 로 만들지 않는다** — 그러면 거짓 완료가 된다. */
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(7);
  });

  it("M-5 🔴 산출물에 **원시 HTML 이 없고** 기존 fixture 를 덮어쓰지 않는다", () => {
    const src = readFileSync(path.join(HERE, "a07-both-fulltext-axes.test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    /**
     * 🔴🔴 **토큰을 런타임에 조립한다 — 자기참조를 끊는 유일한 방법이다.**
     *
     * 리터럴로 적으면 **이 단언 자신이 소스에 그 토큰을 심어** 개수가 하나 늘고 FAIL 한다.
     * 🔴 이 트랙에서 같은 함정을 **다섯 번** 밟았다(A22 에서 넷 · 여기서 하나).
     * 🟢 조립하면 소스에 그 글자가 없으므로 **세는 대상과 세는 코드가 분리** 된다.
     */
    const W = `write${"FileSync("}`;
    const count = src.split(W).length - 1;
    expect(count, "🔴 쓰기 호출이 하나가 아니다").toBe(1);
    expect(src).toContain(`${W}OUT`);
    const raw = readFileSync(OUT, "utf8");
    expect(raw).not.toContain("<html");
    expect(raw).not.toContain("<script");
  });
});
