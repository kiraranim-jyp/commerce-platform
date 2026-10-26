import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_BASELINE, SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-07 — **Evidence Utility Prioritization**(측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **production code change 0.** matcher 정책 · threshold · `NO_TITLE_OVERLAP` ·
 *    MODEL_CODE conflict · 새 axis · category matcher · description similarity ·
 *    meta 공급 · `priceTier` · `domesticReference` · A/B 가격 — **전부 변경 0**.
 *
 * ── 🔴 CPO 가 고정한 세 단계를 «분리» 한다 ──────────────────────────────────────
 * ```
 * A 공급률          그 칸에 값이 있는가                    ← SPRINT-04 가 쟀다
 * B matcher 사용    그 칸을 **판정이 실제로 읽는가**        ← 🟢 **ablation 으로 잰다**
 * C 판정 효과       SAME 회복 / DIFFERENT 보호 / UNDETERMINED ← 🟢 같은 ablation 산출
 * ```
 *
 * ── 🟢🟢 **왜 ablation 인가** ───────────────────────────────────────────────────
 * ```
 * 「그 Evidence 를 **비우면** 판정이 어떻게 되는가」를 재면 B 와 C 가 **한 번에** 나온다.
 *   변화 0        ⟹ matcher 가 그 칸을 **쓰지 않는다**(또는 이 분모에서 발화 0)
 *   SAME 감소     ⟹ 그 Evidence 가 **SAME 을 지탱한다**(= 공급을 늘릴 가치가 있다)
 *   DIFFERENT 누출 ⟹ 그 Evidence 가 **보호한다**(= 약화하면 위험하다)
 * 🔴 **반대 방향(「채우면」)은 이 분모에서 쓸 수 없다** — 없는 값을 지어내야 하고
 *    그것이 이 트랙이 금지한 행위다. 🔴 그래서 「공급을 늘리면 SAME 이 N 늘어난다」를
 *    **적지 않는다**(그 수는 ablation 으로 측정되지 않는다).
 * ```
 */

/** 🔴 운영 순서 그대로(복제식 금지). */
function judge(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  const code = compareModelCode(origin.brandModelCode, cand.brandModelCode ?? null);
  const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !cand.colorText);
  /**
   * 🔴🔴 **모양을 추측하지 않는다 — 타입에서 읽었다**(`cross-seller.ts:194-195`):
   * ```
   * blockers:  { blocker: CrossSellerBlocker; detail: string }[]
   * conflicts: { conflict: CrossSellerConflict; detail: string }[]
   * ```
   * 🔴 1차 하니스가 `.map(String)` 과 `Object.keys` 를 써서 **`[object Object]` 6건 ·
   *    `conflict:0` 3건** 을 냈다. 그대로 보고했으면 **무의미한 분포** 였다
   *    (이 트랙의 「칸 이름/모양 추측」 반복 실수 · §12 그 자리).
   */
  return {
    verdict: String(cross.verdict),
    blockers: (cross.blockers ?? []).map((b) => String(b.blocker)),
    conflicts: (cross.conflicts ?? []).map((c) => String(c.conflict)),
    truth: String(truth),
    tier: String(priceTierFromLink({ matchTruth: truth, verified: false })),
  };
}

const isSame = (v: string) => v === "SAME";

/**
 * 🔴 **양쪽을 같이 비운다.** 한쪽만 비우면 「한쪽 없음」이 되어 **다른 분기** 를 탄다
 *    (`brandKnown = Boolean(x.brand && y.brand)` 가 그 모양이다) ⟹ 그러면 「그 축을
 *    쓰지 않는다」와 「한쪽 없음 처리를 쓴다」를 **구별할 수 없다**.
 */
type Slot = {
  label: string;
  /** `ProductFacts` 에 칸이 **없으면** `null`(= 측정불가). */
  blank: ((f: ProductFacts) => ProductFacts) | null;
  /** 칸이 없는 이유(측정불가 사유를 반드시 적는다 · CPO). */
  note: string;
};

const SLOTS: Slot[] = [
  {
    label: "TITLE",
    blank: (f) => ({ ...f, title: "", coreTitleTokens: [] }),
    note: "title + coreTitleTokens 를 같이 비운다(둘이 같은 축이다)",
  },
  { label: "BRAND", blank: (f) => ({ ...f, brand: null }), note: "" },
  { label: "MODEL_CODE", blank: (f) => ({ ...f, brandModelCode: null }), note: "" },
  {
    label: "DESCRIPTION",
    blank: (f) => ({ ...f, description: null }),
    note: "🔴 저장 facts 는 SPRINT-03 이전이라 이 칸이 **전건 비어 있다** ⟹ ablation 이 발화하지 않는다",
  },
  { label: "CATEGORY/FORM", blank: (f) => ({ ...f, categoryText: null }), note: "" },
  { label: "COLOR", blank: (f) => ({ ...f, colorText: null }), note: "" },
  { label: "MATERIAL", blank: (f) => ({ ...f, materialText: null }), note: "" },
  { label: "FIT", blank: (f) => ({ ...f, fitText: null }), note: "" },
  {
    label: "COMPOSITION",
    blank: null,
    note: "🔴 `ProductFacts` 에 칸이 **없다** — `compareMaterial` 이 `materialText` 를 그 자리에서 파싱한다 ⟹ MATERIAL 과 **분리 측정 불가**",
  },
  {
    label: "IMAGE",
    blank: (f) => ({ ...f, imageUrls: [] }),
    note: "🔴 URL 공급만 비운다 — image **scoring** 은 이 경로에 없다(별도 트랙)",
  },
  {
    label: "OPTION/SKU",
    blank: (f) => ({ ...f, sellerSku: null }),
    note: "🟡 matcher 미사용 확인용 **관측 전용**(CPO: 우선순위 표 밖)",
  },
];

interface Tally {
  fired: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  und: number;
  undSame: number;
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;

function tally(mut: ((f: ProductFacts) => ProductFacts) | null): Tally {
  const t: Tally = { fired: 0, tp: 0, fn: 0, fp: 0, tn: 0, und: 0, undSame: 0 };
  for (const p of SAME05_PAIRS) {
    /** 🔴 **원상품과 후보 양쪽** 에 같은 ablation 을 적용한다(위 주석의 이유). */
    const origin = mut ? mut(p.origin) : p.origin;
    const cand = mut ? mut(p.facts) : p.facts;
    if (mut && JSON.stringify([origin, cand]) !== JSON.stringify([p.origin, p.facts])) t.fired += 1;
    const same = isSame(judge(origin, cand).verdict);
    if (p.human === "SAME") same ? (t.tp += 1) : (t.fn += 1);
    else if (p.human === "DIFFERENT") same ? (t.fp += 1) : (t.tn += 1);
    else {
      t.und += 1;
      if (same) t.undSame += 1;
    }
  }
  return t;
}

describe("CORE-SAME-SPRINT-07 — Evidence Utility(측정 only · 네트워크 0)", () => {
  const base = tally(null);

  it("[A·B·C] Evidence 별 공급 · matcher 사용 · 판정 효과를 «분리» 해 표로 낸다", () => {
    expect(SAME05_PAIRS.length, "🔴 GT 가 비면 측정이 성립하지 않는다").toBeGreaterThan(0);
    const N = SAME05_PAIRS.length;
    console.log(`\n${"═".repeat(118)}`);
    console.log(
      `  GT ${N}쌍 — human SAME ${base.tp + base.fn} · DIFFERENT ${base.fp + base.tn} · UNCERTAIN ${base.und}` +
        `   |  baseline  SAME 회복 ${base.tp}/${base.tp + base.fn} · 🔴 FP ${base.fp}/${base.fp + base.tn}`,
    );
    console.log(`${"═".repeat(118)}`);
    console.log(
      `  ${pad("Evidence", 16)}${pad("공급(후보)", 12)}${pad("발화", 6)}${pad("matcher사용", 13)}` +
        `${pad("SAME", 10)}${pad("🔴 DIFF누출", 12)}${pad("UND(sysSAME)", 14)}비고`,
    );

    const rows: { label: string; supply: string; fired: number; used: string; t: Tally | null; note: string }[] = [];
    for (const s of SLOTS) {
      /** A — 공급률(후보측). 🔴 분모를 같이 적는다. */
      const populated = SAME05_PAIRS.filter((p) => {
        const f = p.facts;
        switch (s.label) {
          case "TITLE":
            return Boolean(f.title);
          case "BRAND":
            return Boolean(f.brand);
          case "MODEL_CODE":
            return Boolean(f.brandModelCode);
          case "DESCRIPTION":
            return Boolean(f.description);
          case "CATEGORY/FORM":
            return Boolean(f.categoryText);
          case "COLOR":
            return Boolean(f.colorText);
          case "MATERIAL":
            return Boolean(f.materialText);
          case "FIT":
            return Boolean(f.fitText);
          case "IMAGE":
            return f.imageUrls.length > 0;
          case "OPTION/SKU":
            return Boolean(f.sellerSku);
          default:
            return false;
        }
      }).length;
      const supply = s.blank === null && s.label === "COMPOSITION" ? "측정불가" : `${populated}/${N}`;

      if (!s.blank) {
        rows.push({ label: s.label, supply, fired: 0, used: "측정불가", t: null, note: s.note });
        console.log(
          `  ${pad(s.label, 16)}${pad(supply, 12)}${pad("—", 6)}${pad("측정불가", 13)}` +
            `${pad("측정불가", 10)}${pad("측정불가", 12)}${pad("—", 14)}${s.note}`,
        );
        continue;
      }
      const t = tally(s.blank);
      /**
       * 🔴🔴 **B 를 「변화 0 ⟹ 안 쓴다」로 단정하지 않는다.**
       *    발화가 0 이면 **이 분모에 그 값이 없어서** 일 수 있다 ⟹ 둘을 갈라 적는다.
       */
      const changed = t.tp !== base.tp || t.fp !== base.fp || t.undSame !== base.undSame;
      const used =
        t.fired === 0 ? "🔴 발화0(미측정)" : changed ? "🟢 쓴다" : "🔴 변화0";
      rows.push({ label: s.label, supply, fired: t.fired, used, t, note: s.note });
      const dTp = t.tp - base.tp;
      const dFp = t.fp - base.fp;
      console.log(
        `  ${pad(s.label, 16)}${pad(supply, 12)}${padL(String(t.fired), 4)}  ${pad(used, 13)}` +
          `${pad(`${t.tp}(${dTp >= 0 ? "+" : ""}${dTp})`, 10)}${pad(`${t.fp}(${dFp >= 0 ? "+" : ""}${dFp})`, 12)}` +
          `${pad(`${t.und}(${t.undSame})`, 14)}${s.note}`,
      );
    }

    /**
     * 🔴🔴 **해석 규칙을 표에 같이 박는다** — 다음 사람이 거꾸로 읽지 않도록.
     * ablation 은 **「비웠을 때」** 다 ⟹ `SAME` 이 **줄면** 그 Evidence 가 SAME 을 지탱한다.
     */
    console.log(
      `\n  🔴 읽는 법 — 이 표는 **그 칸을 «비웠을 때»** 다.` +
        ` SAME 이 **줄면** 그 Evidence 가 SAME 을 **지탱** 하고,` +
        ` DIFF누출이 **늘면** 그 Evidence 가 **보호** 한다.`,
    );
    console.log(
      `  🔴 그리고 **역방향을 추정하지 않는다** — 「공급을 늘리면 SAME 이 N 늘어난다」는` +
        ` 이 측정으로 **나오지 않는다**(없는 값을 지어내야 한다).`,
    );

    /** 🔴 발화 단언 — 전건 0 이면 하니스가 ablation 을 적용하지 못한 것이다. */
    const anyFired = rows.some((r) => r.fired > 0);
    expect(anyFired, "🔴 ablation 이 하나도 발화하지 않았다 — 하니스 결함이다").toBe(true);
    /** 🔴 baseline 을 고정한다(분모가 바뀌면 이 표 전체가 무효다). */
    expect(base.tp).toBe(6);
    expect(base.fp).toBe(SAME05_BASELINE.fp);
  });

  it("[① FN blocker 분포] human SAME 인데 system 이 SAME 이 아닌 쌍을 «현재 데이터로» 재집계한다", () => {
    const fn = SAME05_PAIRS.filter((p) => p.human === "SAME" && !isSame(judge(p.origin, p.facts).verdict));
    console.log(`\n${"═".repeat(118)}`);
    console.log(`  [①] FN blocker 분포 — 🔴 과거 분류를 «복사하지 않고» 지금 다시 센다 (FN = ${fn.length})`);
    console.log(`${"═".repeat(118)}`);
    const dist = new Map<string, number>();
    const codeDist = new Map<string, number>();
    for (const p of fn) {
      const j = judge(p.origin, p.facts);
      const keys = [...j.blockers, ...j.conflicts.map((c) => `conflict:${c}`)];
      if (keys.length === 0) dist.set("(blocker 0)", (dist.get("(blocker 0)") ?? 0) + 1);
      for (const k of keys) dist.set(k, (dist.get(k) ?? 0) + 1);
      const code = String(compareModelCode(p.origin.brandModelCode, p.facts.brandModelCode ?? null));
      codeDist.set(code, (codeDist.get(code) ?? 0) + 1);
    }
    console.log(`  ${pad("blocker / conflict", 34)}건수   🔴 분모 ${fn.length}(중복 집계 — 한 쌍이 여러 개를 가진다)`);
    for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(k, 34)}${padL(String(v), 4)}`);
    }
    console.log(`\n  MODEL_CODE 비교 결과 분포(FN 안)`);
    for (const [k, v] of [...codeDist.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${pad(k, 20)}${v}`);
    }
    /** 🔴 발화 단언 — FN 이 0 이면 이 집계가 의미 없다. */
    expect(fn.length, "🔴 FN 이 0 이면 blocker 분포를 말할 수 없다").toBeGreaterThan(0);
  });

  it("[② safety] 모든 ablation 에서 DIFFERENT → SAME 을 «측정» 한다", () => {
    console.log(`\n${"═".repeat(118)}`);
    console.log("  [②] safety — 🔴 ablation 은 «약화» 방향이므로 누출이 나올 수 있다(그것이 보호의 증거다)");
    console.log(`${"═".repeat(118)}`);
    let maxLeak = 0;
    for (const s of SLOTS) {
      if (!s.blank) {
        console.log(`  ${pad(s.label, 16)}측정불가 — ${s.note}`);
        continue;
      }
      const t = tally(s.blank);
      const leak = t.fp - base.fp;
      maxLeak = Math.max(maxLeak, leak);
      console.log(
        `  ${pad(s.label, 16)}${pad(t.fired === 0 ? "🔴 발화0 ⟹ 측정불가" : leak > 0 ? `🟢 보호한다(누출 +${leak})` : "누출 +0", 28)}` +
          `${t.fired === 0 ? "" : `FP ${base.fp} → ${t.fp}`}`,
      );
    }
    /**
     * 🔴🔴 **이 Sprint 에서 「DIFFERENT → SAME = 0」은 합격선이 «아니다».**
     *    ablation 은 **일부러 약화** 하는 측정이라 누출이 나오는 것이 **정상이고 정보** 다.
     *    🟢 합격선은 구현 Sprint(SPRINT-06)의 것이고, 여기서는 **보호의 크기** 를 읽는다.
     */
    console.log(`\n  🔴 최대 누출 증가 = +${maxLeak} — 이 Sprint 는 **구현이 없으므로** 운영 누출은 **0** 이다`);
    expect(base.fp, "🔴 baseline FP 가 바뀌면 이 표의 기준선이 무효다").toBe(SAME05_BASELINE.fp);
  });
});
