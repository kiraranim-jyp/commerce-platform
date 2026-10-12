/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-09 ⑧ — SAME 손실이 «돈이 움직이는 경로» 에서도 손실인가 (CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 이고 crawler 쪽 `mi-p0-09-pairs.json` 이
 *    있을 때만 돈다. **HTTP 를 한 줄도 쓰지 않는다** — 앞 단계가 덤프한 입력만 읽는다.
 *
 * ── 🔴 왜 이 파일이 따로 있는가 ─────────────────────────────────────────────
 *   `crossSellerVerdict` 는 **최종 판정이 아니다.** 돈이 움직이는 경로의 owner 는
 *   `deriveMatchTruth` → `priceTierFromLink` 다(MI-P0-02 에서 CTO 가 이것을
 *   혼동해 오판했다 — 그 교훈이 이 파일이다).
 *
 *   그리고 `priceTierFromLink` 는 `apps/admin` 에 산다. crawler 하니스가 그것을
 *   import 하면 패키지 경계를 거꾸로 넘는다. 🔴 그래서 측정을 둘로 나눴다 —
 *   crawler 는 **입력만 덤프** 하고, tier 계산은 owner 가 사는 여기서 한다.
 *
 * ── 측정하는 것 ────────────────────────────────────────────────────────────
 *   ① verdict ↔ matchTruth ↔ priceTier 교차표
 *   ② 🔴 **품번이 양쪽 일치인데 SAME 이 아닌 쌍** 이 tier 에서도 손실인가
 *   ③ `NO_TITLE_OVERLAP` 이 tier 를 깎는가
 *   ④ 「SAME 이 아니다」와 「가격 비교에서 빠진다」가 얼마나 겹치는가
 */
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareModelCode, deriveMatchTruth, isColorUnverified } from "@commerce/crawler";
import { priceTierFromLink } from "../domestic-product-link";
// 🔴 이 넷의 owner 는 `@commerce/crawler` 다 — cross-seller.ts:77/79/90 · match.ts:234,
//    배럴 `comparison-search/index.ts:93-97` 이 re-export 한다.
//    `@commerce/shared` 로 적어 tsc 에러 4개를 만들었다. 원인은 `ProductFacts`(owner 가
//    실제로 shared 다) 때의 교정을 **반대 방향으로 과적용** 한 것이다.
//    🔴 vitest 는 타입을 보지 않아 테스트는 통과했다 — 그래서 tsc 를 따로 본다.
import type { CrossSellerBlocker, CrossSellerConflict, CrossSellerVerdict } from "@commerce/crawler";
// 🔴 `MatchLevel` 은 배럴이 re-export 하지 «않는다»(match.ts:234 에만 있다).
//    배럴에 추가하면 비테스트 파일 변경이 되고 이 WU 의 「Production 0」이 깨지므로
//    깊은 경로로 받는다. 로컬에 union 을 베껴 쓰지 않는다 — 값이 늘면 조용히 어긋난다.
import type { MatchLevel } from "@commerce/crawler/src/comparison-search/match";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

interface Pair {
  arm: string; originHost: string; originTitle: string; candidateTitle: string; candidateUrl: string;
  ownerVerdict: string | null; codeInjected: boolean; matchLevel: string | null;
  originColorText: string | null; candidateColorText: string | null;
  verdict: string; blockers: string[]; conflicts: string[]; corePoints: number;
  independent: { originCode: string | null; candidateCode: string | null; codeExact: boolean; label: string };
  soleBlockerRemovalYieldsSame: string | null;
}

describe.skipIf(!LIVE)("🔴 MI-P0-09 ⑧ — SAME 손실의 운영 효과(priceTier)", () => {
  it("verdict → matchTruth → priceTier 를 운영 함수로 이어 붙인다", () => {
    const p = path.join(OUT_DIR, "mi-p0-09-pairs.json");
    if (!existsSync(p)) throw new Error(`선행 측정 없음: ${p}`);
    const all = JSON.parse(readFileSync(p, "utf8")) as Pair[];
    const pairs = all.filter((x) => x.arm === "WITH_FALLBACK" && x.matchLevel);

    const rows = pairs.map((x) => {
      /**
       * 🔴 `attach-match-truth.ts` 의 `truthOf` 와 **같은 인자 순서** 로 부른다.
       *    하나라도 빠뜨리면(특히 blockers) 품번만 보고 EXACT_IDENTIFIER 로
       *    통과하던 MI-3/P0-1 의 버그를 측정이 재현한다.
       */
      const matchTruth = deriveMatchTruth(
        x.matchLevel as MatchLevel,
        compareModelCode(x.independent.originCode, x.independent.candidateCode),
        (x.ownerVerdict ?? undefined) as CrossSellerVerdict | undefined,
        x.blockers.map((b) => ({ blocker: b as CrossSellerBlocker })),
        x.conflicts.map((c) => ({ conflict: c as CrossSellerConflict })),
        isColorUnverified(x.originColorText, x.candidateColorText),
      );
      // 🔴 `verified` 는 사람이 누른 사실이고 이 측정에는 없다 — false 로 둔다.
      const tier = priceTierFromLink({ matchTruth, verified: false });
      return { ...x, matchTruth, tier };
    });

    const count = <T>(xs: T[], key: (x: T) => string) => {
      const t: Record<string, number> = {};
      for (const x of xs) t[key(x)] = (t[key(x)] ?? 0) + 1;
      return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
    };

    const codeExact = rows.filter((r) => r.independent.codeExact);
    const nto = rows.filter((r) => r.blockers.includes("NO_TITLE_OVERLAP"));
    const report = {
      scope: { note: "🔴 sample N=7 origin 이 만든 쌍. 전수가 아니다.", pairs: rows.length },
      byVerdict: count(rows, (r) => r.verdict),
      byMatchTruth: count(rows, (r) => r.matchTruth ?? "undefined"),
      byPriceTier: count(rows, (r) => r.tier),
      /** 🔴 핵심 교차표 — 「SAME 이 아니다」가 tier 에서도 손실인가 */
      verdictToTier: count(rows, (r) => `${r.verdict} → ${r.tier}`),
      codeExactPairs: {
        total: codeExact.length,
        sameVerdict: codeExact.filter((r) => r.verdict === "SAME").length,
        byVerdictAndTier: count(codeExact, (r) => `${r.verdict} → ${r.tier}`),
        /** 🟢 이것이 0 이면 「SAME 이 아니어도 가격에서는 동일상품으로 쓴다」가 참이다. */
        notSameButEXACT: codeExact.filter((r) => r.verdict !== "SAME" && r.tier === "EXACT").length,
        notSameAndLostFromPricing: codeExact.filter((r) => r.verdict !== "SAME" && r.tier === "EXCLUDED").length,
      },
      noTitleOverlapPairs: {
        total: nto.length,
        byTier: count(nto, (r) => r.tier),
        withCodeExactByTier: count(nto.filter((r) => r.independent.codeExact), (r) => r.tier),
      },
      /** 🔴 단독 병목으로 SAME 을 놓친 쌍이 tier 에서는 어디로 가는가 */
      soleBarrierPairs: count(rows.filter((r) => r.soleBlockerRemovalYieldsSame),
                              (r) => `${r.soleBlockerRemovalYieldsSame} → ${r.tier}`),
    };
    // eslint-disable-next-line no-console
    console.log("\n" + JSON.stringify(report, null, 2));
    expect(rows.length).toBeGreaterThan(0);
  });
});
