import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-DESC-REVIEW GT — **CEO 조서 11건 고정 + 기존 분모 재계산**(운영 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 Sprint 를 쓰기 «전» 에 이것이 먼저다.** 이 조서에 **기존 GT 를 뒤집는
 *    라벨** 이 들어 있으면, 그것을 모르고 설계하면 **낡은 분모로 Sprint 가 쓰인다**.
 *
 * 🔴 운영 변경 **0** · matcher **0** · threshold **0** · fixture 는 **CEO 답을 그대로** 담는다
 *    (CTO 가 해석해 고치지 않았다 · 미응답도 **미응답으로** 남긴다).
 */

interface Answer {
  brand?: string;
  code?: string;
  form?: string;
  colmat?: string;
  set?: string;
  phrase?: string;
  verdict?: string;
}
const GT = JSON.parse(
  readFileSync(join(__dirname, "fixtures/core-desc-review-ceo-gt.json"), "utf8"),
) as { cases: number; answers: Record<string, Answer> };

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;

describe("CORE-DESC-REVIEW GT — CEO 조서 고정(네트워크 0)", () => {
  const ids = Object.keys(GT.answers);

  it("[고정] 11건이 그대로 들어왔고 미응답을 «숨기지 않는다»", () => {
    expect(ids.length, "🔴 조서 건수가 바뀌면 분모가 바뀐다").toBe(11);
    expect(GT.cases).toBe(11);
    const FIELDS = ["brand", "code", "form", "colmat", "set", "verdict"] as const;
    const missing: string[] = [];
    for (const id of ids) {
      for (const f of FIELDS) if (!GT.answers[id][f]) missing.push(`${id}.${f}`);
    }
    console.log(`\n  🔴 미응답 칸 ${missing.length}개 — ${missing.length ? missing.join(" · ") : "없음"}`);
    /** 🔴 **미응답을 「아니오」로 바꾸지 않았다** — 그러면 CEO 가 하지 않은 말을 만든다. */
    expect(missing, "🔴 미응답 목록이 바뀌면 보고가 틀린다").toEqual(["S1-5.set"]);
    /** 🔴 모든 사건에 **최종 판정** 은 있어야 한다(그게 GT 의 본체다). */
    for (const id of ids) expect(GT.answers[id].verdict, `🔴 ${id} 판정 누락`).toBeTruthy();
  });

  it("[🔴🔴 대조] 기존 GT 와 «상충하는» 라벨을 전수 찾는다", () => {
    const rows: { id: string; before: string; after: string; flip: boolean }[] = [];
    for (const id of ids) {
      const prev = SAME05_PAIRS.find((p) => p.id === id);
      const after = String(GT.answers[id].verdict);
      if (!prev) {
        rows.push({ id, before: "(기존 GT 에 없음)", after, flip: false });
        continue;
      }
      rows.push({ id, before: prev.human, after, flip: prev.human !== after });
    }
    console.log(`\n${"═".repeat(96)}`);
    console.log("  [대조] 기존 GT ↔ 이번 조서");
    console.log(`${"═".repeat(96)}`);
    console.log(`  ${pad("건", 8)}${pad("기존", 18)}${pad("이번", 14)}상태`);
    for (const r of rows) {
      console.log(`  ${pad(r.id, 8)}${pad(r.before, 18)}${pad(r.after, 14)}${r.flip ? "🔴🔴 **뒤집혔다**" : "🟢 같다"}`);
    }
    const flips = rows.filter((r) => r.flip);
    console.log(`\n  🔴 뒤집힌 라벨 **${flips.length}건**`);
    /**
     * 🔴🔴🔴 **C06 이 뒤집혔다 — 이 트랙에서 가장 많이 인용된 그 건이다.**
     *    §12 는 C06(`global.trenbe.com`)을 「현행 **False EXACT** 1건 · precision 11/12」로
     *    적고 WU-060 이 그 원인을 확정했다. 🔴 그런데 CEO 가 이번에 **SAME** 이라 했다.
     *    ⟹ 그 「False EXACT」는 **사실이 아니게 된다** ⟹ 기존 FP 분모가 **바뀐다**.
     */
    expect(flips.map((f) => f.id), "🔴 뒤집힌 라벨이 바뀌면 아래 재계산이 전부 틀린다").toEqual(["C06"]);
  });

  it("[🔴🔴 재계산] C06 뒤집힘이 기존 FP 숫자를 «바꾼다»", () => {
    /** 🔴 운영 판정은 그대로 — **라벨만** 바꿔 다시 센다(matcher 변경 0). */
    const judge = (id: string) => {
      const p = SAME05_PAIRS.find((x) => x.id === id)!;
      const cross = compareCrossSellerProducts(p.origin, p.facts);
      return {
        verdict: String(cross.verdict),
        code: String(compareModelCode(p.origin.brandModelCode, p.facts.brandModelCode ?? null)),
      };
    };
    const tally = (labelOf: (id: string) => string) => {
      const t = { tp: 0, fn: 0, fp: 0, tn: 0, und: 0 };
      for (const p of SAME05_PAIRS) {
        const same = judge(p.id).verdict === "SAME";
        const h = labelOf(p.id);
        if (h === "SAME") same ? (t.tp += 1) : (t.fn += 1);
        else if (h === "DIFFERENT") same ? (t.fp += 1) : (t.tn += 1);
        else t.und += 1;
      }
      return t;
    };
    const before = tally((id) => SAME05_PAIRS.find((p) => p.id === id)!.human);
    const after = tally((id) => GT.answers[id]?.verdict ?? SAME05_PAIRS.find((p) => p.id === id)!.human);

    console.log(`\n${"═".repeat(96)}`);
    console.log("  [재계산] 이번 조서 라벨을 반영하면 (운영 판정 불변 · 분모 33)");
    console.log(`${"═".repeat(96)}`);
    console.log(`  ${pad("", 12)}${padL("TP", 5)}${padL("FN", 5)}${padL("🔴 FP", 7)}${padL("TN", 5)}${padL("UND", 5)}`);
    console.log(
      `  ${pad("조서 이전", 12)}${padL(String(before.tp), 5)}${padL(String(before.fn), 5)}` +
        `${padL(String(before.fp), 7)}${padL(String(before.tn), 5)}${padL(String(before.und), 5)}`,
    );
    console.log(
      `  ${pad("조서 반영", 12)}${padL(String(after.tp), 5)}${padL(String(after.fn), 5)}` +
        `${padL(String(after.fp), 7)}${padL(String(after.tn), 5)}${padL(String(after.und), 5)}`,
    );
    console.log(
      `\n  🔴🔴 **FP ${before.fp} → ${after.fp}** · SAME 회복 ${before.tp}/${before.tp + before.fn}` +
        ` → **${after.tp}/${after.tp + after.fn}**`,
    );
    const c06 = judge("C06");
    console.log(
      `  🔴 C06 운영 판정 = ${c06.verdict} · 품번 ${c06.code} ⟹ ` +
        `CEO 가 SAME 이라 했으므로 그 판정은 **옳다** ⟹ §12 의 「False EXACT 1건」이 **정정된다**`,
    );
    /** 🔴 발화 단언 — FP 가 안 움직이면 뒤집힘이 숫자에 닿지 않은 것이다. */
    expect(after.fp, "🔴 C06 이 SAME 이 되면 FP 가 줄어야 한다").toBeLessThan(before.fp);
  });

  it("[🔴🔴 핵심] 상세설명 Evidence 가 «충분해도» DIFFERENT 가 나온다", () => {
    const rich = ids.filter((id) => {
      const a = GT.answers[id];
      return a.brand === "yes" && a.code === "yes" && a.form === "yes" && a.colmat === "yes";
    });
    const richDiff = rich.filter((id) => GT.answers[id].verdict === "DIFFERENT");
    console.log(`\n${"═".repeat(96)}`);
    console.log("  [핵심] 상세설명에서 브랜드·품번·형태·색상소재를 «전부» 얻은 사건");
    console.log(`${"═".repeat(96)}`);
    console.log(`  해당 **${rich.length}건** · 그중 CEO 판정 **DIFFERENT ${richDiff.length}건**`);
    for (const id of richDiff) {
      const why = (GT.answers[id].phrase ?? "").split("\n").join(" / ").slice(0, 78);
      console.log(`  🔴 ${pad(id, 8)}${why}`);
    }
    console.log(
      `\n  🔴🔴 ⟹ **「상세설명에서 Evidence 를 많이 뽑는 것」과 「동일상품」은 다른 문제다.**` +
        `\n     그래서 **DESCRIPTION 점수 하나를 SAME 에 더하는 설계는 성립하지 않는다**.`,
    );
    /** 🔴 발화 단언 — 이 모양이 0 이면 위 결론을 쓸 수 없다. */
    expect(richDiff.length, "🔴 Evidence 충분 ∧ DIFFERENT 가 0 이면 그 결론을 적을 수 없다").toBeGreaterThan(0);

    /** 🟢 반대 방향 — **품번이 없어도 SAME** 인 사건(필수조건이 아니라는 직접 증거). */
    const noCodeSame = ids.filter((id) => GT.answers[id].code === "no" && GT.answers[id].verdict === "SAME");
    console.log(`\n  🟢 품번을 설명에서 못 얻었는데 **SAME** 인 사건 ${noCodeSame.length}건 — ${noCodeSame.join(" · ")}`);
    expect(noCodeSame.length, "🔴 0 이면 「품번은 필수조건이 아니다」를 이 조서로 말할 수 없다").toBeGreaterThan(0);

    /** 🔴 CEO 가 **이미지 확인이 필요하다** 고 직접 적은 사건을 센다(다음 단계의 분모다). */
    const needImage = ids.filter((id) => /이미지/.test(GT.answers[id].phrase ?? ""));
    console.log(`  🔴 CEO 가 **「이미지 확인 필요」** 라 적은 사건 ${needImage.length}건 — ${needImage.join(" · ")}`);
    expect(needImage.length).toBeGreaterThan(0);
  });
});
