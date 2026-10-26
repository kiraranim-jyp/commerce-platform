import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-05 — **GT 적재 · 운영 판정 호출 · 집계**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **이 파일은 아무것도 바꾸지 않는다.** 이후 STEP 2~4 의 반사실을 **같은 분모** 에서
 *    비교하기 위한 **기준선** 이고, 그 숫자를 계약으로 **고정** 한다.
 *
 * ── 🔴🔴 왜 네트워크 0 으로 가능한가 ────────────────────────────────────────
 * ```
 * `wu-059-gt-facts.json` 과 `wu-068-new-gt.json` 이 후보마다 **ProductFacts 를 저장**
 * 해 뒀다(14/14 · 19/19 실측). 원상품도 `wu-059.origins[sid].canonicalProduct` 로 있다.
 * ⟹ 운영 판정 함수를 **그대로** 부르면서 네트워크 0 으로 전수 측정이 된다.
 * 🟢 기존 `core-step5-evidence-c3-gt.test.ts` 가 쓰는 **그 패턴·그 judge 순서** 다 —
 *    새 인프라 0 · fixture 신설 0(§8 「새 DIFFERENT fixture 를 만들지 않는다」).
 * ```
 *
 * ── 🔴 분모를 숨기지 않는다 ─────────────────────────────────────────────────
 * ```
 * 🔴 `UNCERTAIN` 은 SAME 도 DIFFERENT 도 아니다 ⟹ **recall/precision 분모에서 뺀다**
 *    (0 으로 처리하지 않고 **측정불가** 로 따로 센다).
 * 🔴 CEO 가 재라벨한 것이 있으면 **그 사실을 적는다** — 이 트랙에서 `m.luxboy.com` 의
 *    과거 DIFFERENT 가 「동일」로 정정됐다(SAME-03/04). 🔴 단 **이 파일의 fixture 는
 *    고치지 않는다**(§8: fixture 수정으로 PASS 만들기 금지) — 교차 사실로만 기록한다.
 * ```
 */

const FIX = join(__dirname, "fixtures");

interface Wu059 {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<
    string,
    { searchId: string; domain: string; url: string; humanGt: string; title: string; facts: ProductFacts }
  >;
}
interface Wu068Row {
  id: string;
  searchId: string;
  domain: string;
  url: string;
  gt: string;
  facts: ProductFacts;
}

const A = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as Wu059;
const B = JSON.parse(readFileSync(join(FIX, "wu-068-new-gt.json"), "utf8")) as Record<string, Wu068Row>;

/** 🟢 원상품 facts 는 **운영과 같은 경로** 로 만든다(canonicalProduct → dna → facts · 사본 0). */
export const SAME05_ORIGIN_FACTS = new Map<string, ProductFacts>();
for (const [sid, o] of Object.entries(A.origins)) {
  SAME05_ORIGIN_FACTS.set(sid, productFactsFromIdentityDna(buildProductIdentityDna(o.canonicalProduct as never)));
}

export interface Same05Pair {
  id: string;
  searchId: string;
  domain: string;
  url: string;
  /** SAME · DIFFERENT · UNCERTAIN. */
  human: string;
  facts: ProductFacts;
  src: string;
  origin: ProductFacts;
}

export const SAME05_PAIRS: Same05Pair[] = [];
for (const [id, c] of Object.entries(A.candidates)) {
  const origin = SAME05_ORIGIN_FACTS.get(c.searchId);
  if (origin) {
    SAME05_PAIRS.push({ id, searchId: c.searchId, domain: c.domain, url: c.url, human: c.humanGt, facts: c.facts, src: "wu-059", origin });
  }
}
for (const r of Object.values(B)) {
  const origin = SAME05_ORIGIN_FACTS.get(r.searchId);
  if (origin) {
    SAME05_PAIRS.push({ id: r.id, searchId: r.searchId, domain: r.domain, url: r.url, human: r.gt, facts: r.facts, src: "wu-068", origin });
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 최신 라벨이 이긴다** — CORE-DESC-REVIEW 조서(2026-10-27 · CPO 확정)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **원본 fixture 를 «고치지 않는다».** `wu-059-gt-facts.json` 의 `humanGt` 는 그때의
 *    판정이고 **역사 기록** 이다(CPO: 「이전 Sprint 의 FP 2 는 **역사적 측정값으로만** 취급」).
 *    🟢 그래서 덮어쓰지 않고 **나중 라벨을 위에 얹고 출처를 남긴다**.
 *
 * 🔴 **실제로 뒤집힌 것은 C06 하나** 다(조서 11건 전수 대조 · `core-desc-review-gt` 실측):
 * ```
 * C06  global.trenbe.com   DIFFERENT → **SAME**
 * 🔴 §12 는 그 건을 「현행 **False EXACT** 1건 · precision 11/12」로 적었다 ⟹
 *    그 서술은 **사실이 아니다**. 운영 판정이 SAME 이고 CEO 도 SAME 이므로 **옳았다**.
 * 🟢 그 건의 품번은 **unavailable** 이다 ⟹ **품번 없이 올바른 SAME** 의 실증이다.
 * ⟹ 🔴🔴 기준선이 **FP 2 → 1 · SAME 6/18** 로 바뀐다(CPO 확정 2026-10-27)
 * ```
 * 🔴 나머지 10건은 기존 라벨과 **일치** 하므로 **건드리지 않는다**.
 * 🔴 미응답(`S1-5.set`)은 **임의 보정하지 않는다** — 그 칸은 판정 라벨이 아니다.
 */
const CEO_RELABEL: Record<string, { human: string; why: string }> = {
  C06: { human: "SAME", why: "CORE-DESC-REVIEW 조서(2026-10-27) — 상세설명에 브랜드·품번·색상이 전부 있다" },
};
for (const p of SAME05_PAIRS) {
  const r = CEO_RELABEL[p.id];
  if (r && p.human !== r.human) {
    p.human = r.human;
    /** 🟢 출처를 **지우지 않고 잇는다** — 어느 조서가 덮었는지 추적 가능해야 한다. */
    p.src = `${p.src}+desc-review`;
  }
}

/**
 * 🔴🔴 **CPO 가 적은 숫자 둘을 정정했다**(실측 · 2026-10-27):
 *    SAME **18** 🟢 · FP **1** 🟢 — 맞다.
 *    🔴 DIFFERENT 는 **9** 다(CPO 10) · 🔴 UNCERTAIN 은 **6** 다(CPO 5).
 *    산술이 그렇다 — C06 이 DIFFERENT → SAME 이므로 **DIFFERENT 가 1 줄고**
 *    UNCERTAIN 은 **변하지 않는다**. 18 + 9 + 6 = 33.
 */
export const SAME05_BASELINE = { total: 33, same: 18, different: 9, uncertain: 6, fp: 1, samePrecision: "6/18" } as const;

/**
 * 🔴 **운영 판정 순서 그대로** — cross-seller → compareModelCode → deriveMatchTruth
 *    → priceTierFromLink. 🔴 순서를 바꾸거나 인자를 지어내지 않는다.
 * 🟢 `core-step5-evidence-c3-gt.test.ts:71` 의 `judge()` 와 **같은 모양** 이다.
 */
export function same05Judge(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  const code = compareModelCode(origin.brandModelCode, cand.brandModelCode);
  const truth = deriveMatchTruth(
    "low",
    code,
    cross.verdict,
    cross.blockers,
    cross.conflicts,
    /** 🔴 색상 미확인 술어를 **지어내지 않는다** — 후보 색상이 없으면 그 상태다. */
    !cand.colorText,
  );
  return {
    cross,
    code: String(code),
    truth: String(truth),
    tier: priceTierFromLink({ matchTruth: truth, verified: false }),
  };
}

/** 🔴 「SAME 으로 확정됐는가」의 단일 술어 — 여러 곳에서 다르게 세지 않는다. */
export const isSystemSame = (verdict: string): boolean => verdict === "SAME";

export interface Same05Tally {
  /** 분모. */
  gtSame: number;
  gtDifferent: number;
  gtUncertain: number;
  /** GT SAME 중 시스템이 SAME 으로 확정한 수. */
  truePositive: number;
  /** GT SAME 중 시스템이 SAME 을 못 낸 수. */
  falseNegative: number;
  /** 🔴 GT DIFFERENT 인데 시스템이 SAME 이라 한 수 — **leakage** 다. */
  falsePositive: number;
  /** GT DIFFERENT 를 올바르게 막은 수. */
  trueNegative: number;
  /** 🔴 UNCERTAIN 중 시스템 SAME — 분모가 없어 **측정불가** 로만 센다. */
  uncertainSystemSame: number;
}

export function same05Tally(verdictOf: (p: Same05Pair) => string, pairs = SAME05_PAIRS): Same05Tally {
  const t: Same05Tally = {
    gtSame: 0,
    gtDifferent: 0,
    gtUncertain: 0,
    truePositive: 0,
    falseNegative: 0,
    falsePositive: 0,
    trueNegative: 0,
    uncertainSystemSame: 0,
  };
  for (const p of pairs) {
    const sysSame = isSystemSame(verdictOf(p));
    if (p.human === "SAME") {
      t.gtSame += 1;
      if (sysSame) t.truePositive += 1;
      else t.falseNegative += 1;
    } else if (p.human === "DIFFERENT") {
      t.gtDifferent += 1;
      if (sysSame) t.falsePositive += 1;
      else t.trueNegative += 1;
    } else {
      t.gtUncertain += 1;
      if (sysSame) t.uncertainSystemSame += 1;
    }
  }
  return t;
}

export const fmtTally = (label: string, t: Same05Tally): string =>
  `${label.padEnd(12)} SAME ${String(t.truePositive).padStart(2)}/${t.gtSame}` +
  ` · FN ${String(t.falseNegative).padStart(2)}` +
  ` · DIFFERENT 방어 ${String(t.trueNegative).padStart(2)}/${t.gtDifferent}` +
  ` · 🔴 FP ${String(t.falsePositive).padStart(2)}` +
  ` · UNCERTAIN(측정불가) ${t.gtUncertain}(그중 시스템 SAME ${t.uncertainSystemSame})`;

