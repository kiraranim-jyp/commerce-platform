import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 5 — IDENTITY PRECISION 반사실 (측정 전용 · 운영 코드 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 운영 N=6 에서 사람 판정 15건을 받았고 그중:
 * ```
 * FALSE POSITIVE(human DIFFERENT × system SAME/PRESUMED)  **10**
 *   🔴 **10/10 전건이 `BRAND_MISMATCH` 를 달고 있다**
 *      (Marc Jacobs Black T-Shirt · Hugo Boss Navy Zip Sweatshirt · Boys Embossed DG Logo …)
 * AGREE(human SAME)  **1** — junioredition 「Bobo Choses Pop Sweatshirt」 blk=[MATERIAL]
 *   🟢 그 1건에는 `BRAND_MISMATCH` 가 **없다**
 * ```
 * 🔴 원인 코드 — `cross-seller.ts` 의 verdict 분기에서 `blocked` 는 **SAME 만** 막고
 *    `PRESUMED_SAME` 분기는 **blockers 를 보지 않는다**.
 *
 * ── 🔴🔴 이 파일이 재는 것 ────────────────────────────────────────────────
 * ```
 * CF  「BRAND_MISMATCH 가 있으면 PRESUMED_SAME 으로 올리지 않는다」
 *     를 **하니스 안에서만** 적용했을 때 기존 GT 51쌍의 recall 이 얼마나 깎이는가
 * ```
 * 🔴 **운영 코드를 한 글자도 바꾸지 않는다** — 반환값을 후처리해 «세기만» 한다.
 * 🔴 threshold · 축 · blocker 정의 **전부 불변**. 네트워크 **0**.
 * 🔴 이 수치는 **CPO 판단 재료** 이고, 구현 승인이 아니다.
 */

const FIX = join(__dirname, "fixtures", "wu-059-gt-facts.json");

interface GtCandidate {
  searchId: string;
  domain: string;
  url: string;
  humanGt: string;
  title: string;
  facts: Record<string, unknown>;
}

const gt = JSON.parse(readFileSync(FIX, "utf8")) as {
  origins: Record<string, { canonicalProduct: unknown }>;
  candidates: Record<string, GtCandidate>;
};

/** 🔴 CF 는 **하니스 안에서만** 적용된다(운영 분기를 고치지 않았다). */
const applyCf = (verdict: string, blockers: string[]) =>
  verdict === "PRESUMED_SAME" && blockers.includes("BRAND_MISMATCH") ? "SIMILAR" : verdict;

describe("SPRINT5-IDENTITY-01 — BRAND_MISMATCH × PRESUMED_SAME 반사실", () => {
  it("🔎 기존 GT 51쌍에서 recall 손실과 precision 변화를 «센다»", () => {
    const originFacts = new Map<string, ReturnType<typeof productFactsFromIdentityDna>>();
    for (const [sid, o] of Object.entries(gt.origins)) {
      const dna = buildProductIdentityDna(o.canonicalProduct as never);
      originFacts.set(sid, productFactsFromIdentityDna(dna));
    }

    const rows = Object.entries(gt.candidates);
    /* eslint-disable no-console */
    console.log(`\nGT 후보 ${rows.length}건 · 원상품 ${originFacts.size}개\n`);

    let positiveBefore = 0;
    let positiveAfter = 0;
    let tpBefore = 0;
    let tpAfter = 0;
    let fpBefore = 0;
    let fpAfter = 0;
    const lost: string[] = [];
    const killed: string[] = [];
    /** 🔴 발화 분모 — 「효과 0」과 「미발화」를 가르는 칸이다. */
    let brandMismatchRows = 0;
    let brandMismatchPresumed = 0;
    const blockerFreq = new Map<string, number>();
    const verdictFreq = new Map<string, number>();

    for (const [cid, c] of rows) {
      const of_ = originFacts.get(c.searchId);
      if (!of_) continue;
      const r = compareCrossSellerProducts(of_, c.facts as never) as {
        verdict: string;
        blockers?: { blocker: string }[];
      };
      const blk = (r.blockers ?? []).map((b) => b.blocker);
      const before = r.verdict;
      const after = applyCf(before, blk);

      verdictFreq.set(before, (verdictFreq.get(before) ?? 0) + 1);
      for (const b of blk) blockerFreq.set(b, (blockerFreq.get(b) ?? 0) + 1);
      if (blk.includes("BRAND_MISMATCH")) {
        brandMismatchRows++;
        if (before === "PRESUMED_SAME") brandMismatchPresumed++;
      }

      const posB = before === "SAME" || before === "PRESUMED_SAME";
      const posA = after === "SAME" || after === "PRESUMED_SAME";
      const humanSame = c.humanGt === "SAME";
      const humanDiff = c.humanGt === "DIFFERENT";

      if (posB) positiveBefore++;
      if (posA) positiveAfter++;
      if (posB && humanSame) tpBefore++;
      if (posA && humanSame) tpAfter++;
      if (posB && humanDiff) fpBefore++;
      if (posA && humanDiff) fpAfter++;

      if (posB && !posA) {
        /** 🔴 CF 가 떨어뜨린 것 — human SAME 이면 **recall 손실**, DIFFERENT 면 **이득**. */
        (humanSame ? lost : killed).push(
          `${cid} ${c.domain} [${c.humanGt}] "${String(c.title).slice(0, 44)}" blk=${blk.join("|")}`,
        );
      }
    }

    /**
     * 🔴🔴 **「CF 효과 0」을 「안전하다」로 읽지 않는다.** 그 분기가 **발화조차 안 했을**
     *    수 있다(이 트랙이 WU-074 W1 · WU-113 M2 에서 두 번 밟은 함정).
     * 🟢 그래서 **발화 분모** 를 먼저 찍는다 — `BRAND_MISMATCH` 를 단 후보가 몇이고
     *    그중 PRESUMED_SAME 이 몇인가.
     */
    console.log("═══ 발화 분모(이게 0 이면 위 CF 숫자는 «측정불가» 다) ═══");
    console.log(`  BRAND_MISMATCH 를 단 후보            ${brandMismatchRows}`);
    console.log(`  그중 verdict = PRESUMED_SAME         ${brandMismatchPresumed}`);
    console.log(`  blocker 빈도(전체) ${JSON.stringify(Object.fromEntries(blockerFreq))}`);
    console.log(`  verdict 분포(전체) ${JSON.stringify(Object.fromEntries(verdictFreq))}\n`);

    console.log("═══ 기존 GT 반사실 — threshold 0 · 축 0 · blocker 정의 0 ═══");
    console.log(`  positive(SAME|PRESUMED)   before ${positiveBefore}  →  after ${positiveAfter}`);
    console.log(`  🟢 TP (human SAME)        before ${tpBefore}  →  after ${tpAfter}   ← **여기가 recall 비용**`);
    console.log(`  🔴 FP (human DIFFERENT)   before ${fpBefore}  →  after ${fpAfter}   ← 여기가 이득`);
    console.log(`\n🔴 CF 가 떨어뜨린 **human SAME**(= 잃는 것) ${lost.length}건`);
    for (const l of lost) console.log(`   ${l}`);
    console.log(`\n🟢 CF 가 떨어뜨린 **human DIFFERENT**(= 막는 것) ${killed.length}건`);
    for (const k of killed) console.log(`   ${k}`);

    /** 🔴 숫자를 단언으로 고정하지 않는다 — 이건 **측정** 이고 정책 승인이 아니다.
     *   🟢 단 측정이 성립했는지(분모가 0이 아닌지)는 단언한다. */
    expect(rows.length, "🔴 GT 가 비었다 — 측정불가").toBeGreaterThan(0);
    expect(originFacts.size, "🔴 원상품 facts 가 비었다 — 측정불가").toBeGreaterThan(0);
  });
});
