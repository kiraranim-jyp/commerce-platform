import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 5 — **BRAND_MISMATCH RECALL GATE**(CPO GO · 2026-11-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO: 「실제 운영 FP/TP 를 고정해서, 그 정책을 적용했을 때 **무엇을 잃고 무엇을 막는지**
 * 측정하라.」 🔴🔴 **이 결과를 전체 상품군 recall 추정치로 쓰지 않는다**(CPO 명시 제한).
 *
 * ── 🔴 반사실의 «정확성» 근거 ───────────────────────────────────────────────
 * ```
 * 새 scoring 을 만들지 않는다. fixture 의 `systemVerdict`/`blockers` 는
 * **운영이 그때 실제로 낸 값** 이고(candidate_reviews), CF 는 그 둘만 읽는다:
 *    PRESUMED_SAME  AND  blockers ∋ BRAND_MISMATCH   →  SIMILAR
 * ```
 * 🔴 운영 정책 **변경 0** · 네트워크 **0** · threshold/축/blocker 정의 **0**.
 *
 * ── 🔴🔴 §4 brand 신뢰도를 «분리해서» 본다 ─────────────────────────────────
 * `x.brand !== y.brand` 만으로 안전성을 결론내지 않는다. 후보 brand 가 **판매처 상호**
 * 일 수 있다(biskuit 「비스킷」 선례). fixture 가 그 축을 들고 있다
 * (`candidateBrandLooksLikeShopName` · 도메인 글자 겹침으로만 판정 · 사전 0).
 */

interface Row {
  id: string;
  originTitle: string | null;
  originBrand: string | null;
  originBrandSource: string | null;
  originBrandConfidence: string | null;
  candidateDomain: string | null;
  candidateTitle: string | null;
  originBrandInReason: string | null;
  candidateBrandInReason: string | null;
  candidateBrandLooksLikeShopName: boolean | null;
  systemVerdict: string | null;
  matchTruth: string | null;
  blockers: string[];
  hasBrandMismatch: boolean;
  humanVerdict: string;
}

const fx = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "sprint5-brand-gt.json"), "utf8"),
) as { rows: Row[] };

/** 🔴 운영 blocker 의미 그대로 — 새 규칙을 만들지 않는다. */
const counterfactual = (r: Row) =>
  r.systemVerdict === "PRESUMED_SAME" && r.hasBrandMismatch ? "SIMILAR" : r.systemVerdict;

const pad = (s: unknown, n: number) => String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

describe("SPRINT5-IDENTITY-02 — BRAND_MISMATCH recall gate", () => {
  it("🔎 운영 FP/TP 고정 GT 에서 «막는 것» 과 «잃는 것» 을 센다", () => {
    const rows = fx.rows;
    /* eslint-disable no-console */

    /** 🔴 시스템 판정이 없는 행은 **반사실 분모가 아니다**(GT 시딩분 등). */
    const scored = rows.filter((r) => r.systemVerdict);
    const unscored = rows.length - scored.length;

    const fp = scored.filter((r) => r.humanVerdict === "DIFFERENT");
    const tp = scored.filter((r) => r.humanVerdict === "SAME");
    const other = scored.filter((r) => !["SAME", "DIFFERENT"].includes(r.humanVerdict));

    console.log(`\nfixture ${rows.length}행 · 시스템 판정 보유 ${scored.length} · 🔴 판정 없음 ${unscored}(측정불가)`);
    console.log(`  human DIFFERENT ${fp.length} · SAME ${tp.length} · 그 외 ${other.length}\n`);

    console.log("═══ §6 표 ═══");
    console.log(
      `${pad("Fixture", 7)} ${pad("Human", 10)} ${pad("Current", 14)} ${pad("B_MISMATCH", 11)} ${pad("CF", 14)} ${pad("상호의심", 9)} 후보`,
    );
    const show = (list: Row[]) => {
      for (const r of list) {
        const cf = counterfactual(r);
        const changed = cf !== r.systemVerdict;
        console.log(
          `${pad(r.id, 7)} ${pad(r.humanVerdict, 10)} ${pad(r.systemVerdict, 14)} ${pad(r.hasBrandMismatch ? "YES" : "no", 11)} ` +
            `${pad(cf, 14)} ${pad(r.candidateBrandLooksLikeShopName === true ? "🔴 YES" : r.candidateBrandLooksLikeShopName === false ? "no" : "?", 9)} ` +
            `${changed ? "→변경 " : "      "}${pad(r.candidateDomain, 22)} "${String(r.candidateTitle ?? "-").slice(0, 38)}"`,
        );
        if (r.candidateBrandInReason) {
          console.log(`        brand  ${JSON.stringify(r.originBrandInReason)} ↔ ${JSON.stringify(r.candidateBrandInReason)}`);
        }
      }
    };
    console.log("\n── FP 군(human DIFFERENT) ──");
    show(fp);
    console.log("\n── TP 군(human SAME) ──");
    show(tp);
    if (other.length) {
      console.log("\n── 그 외(human SIMILAR/UNKNOWN) ──");
      show(other);
    }

    /* ── 집계 ── */
    const fpMismatch = fp.filter((r) => r.hasBrandMismatch);
    const tpMismatch = tp.filter((r) => r.hasBrandMismatch);
    const fpBlocked = fp.filter((r) => counterfactual(r) !== r.systemVerdict);
    const tpLost = tp.filter((r) => counterfactual(r) !== r.systemVerdict);

    console.log("\n═══ 집계 ═══");
    console.log(`  FP 총수                       ${fp.length}`);
    console.log(`  BRAND_MISMATCH FP 수          ${fpMismatch.length}`);
    console.log(`  🟢 CF 에서 제거되는 FP 수      ${fpBlocked.length}`);
    console.log(`  TP 총수                       ${tp.length}`);
    console.log(`  BRAND_MISMATCH TP 수          ${tpMismatch.length}`);
    console.log(`  🔴 CF 에서 손실되는 TP 수      ${tpLost.length}   ← **recall 비용**`);
    for (const r of tpLost) {
      console.log(`     🔴 잃는다 ${r.id} ${r.candidateDomain} "${String(r.candidateTitle).slice(0, 40)}"`);
      console.log(`        brand ${JSON.stringify(r.originBrandInReason)} ↔ ${JSON.stringify(r.candidateBrandInReason)} · 상호의심=${r.candidateBrandLooksLikeShopName}`);
    }

    /* ── §4 brand 신뢰도 ── */
    const withBrandText = scored.filter((r) => r.candidateBrandInReason);
    const shopNameSuspect = withBrandText.filter((r) => r.candidateBrandLooksLikeShopName === true);
    console.log("\n═══ §4 brand 신뢰도(역위험) ═══");
    console.log(`  후보 brand 원문 확보 ${withBrandText.length}/${scored.length}`);
    console.log(`  🔴 **판매처 상호로 보이는 brand** ${shopNameSuspect.length}`);
    for (const r of shopNameSuspect) {
      console.log(
        `     ${r.id} ${r.candidateDomain} brand=${JSON.stringify(r.candidateBrandInReason)} human=${r.humanVerdict}`,
      );
    }
    console.log(
      `  🔴 후보 brand 의 **출처/신뢰도 칸은 저장되지 않는다** — 원상품만 있다` +
        `(source=${JSON.stringify(scored[0]?.originBrandSource ?? null)}) ⟹ 후보측은 **추정 금지 · UNKNOWN**`,
    );

    /** 🔴 숫자를 단언으로 고정하지 않는다(측정이다). 🟢 분모 성립만 단언한다. */
    expect(rows.length, "🔴 fixture 가 비었다 — 측정불가").toBeGreaterThan(0);
    expect(scored.length, "🔴 시스템 판정 보유 행이 0 — 반사실 불가").toBeGreaterThan(0);
    /** 🔴 발화 분모가 0 이면 이 CF 는 또 측정불가다 — 그 사실을 FAIL 로 드러낸다. */
    expect(
      fpMismatch.length + tpMismatch.length,
      "🔴 BRAND_MISMATCH 발화 0 — 이 fixture 로도 recall 비용을 못 잰다",
    ).toBeGreaterThan(0);
  });
});
