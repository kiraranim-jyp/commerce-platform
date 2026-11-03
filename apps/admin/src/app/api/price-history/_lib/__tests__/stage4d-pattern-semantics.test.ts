import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-D — **PATTERN / DESIGN SEMANTICS**(CPO 2026-11-04 · 분석 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 코드 0 · 정책 코드화 0 · Legacy GT 보존 · 재라벨 0 · 네트워크 0.
 *
 * ── 🔴 «사전» 으로 판정하지 않는다 ────────────────────────────────────────
 * 「stripe 면 패턴」 같은 규칙을 내가 만들면 그것이 바로 CPO 가 금지한 **추정** 이다.
 * 🟢 그래서 **원문이 스스로 말하는 것** 을 먼저 본다:
 * ```
 * ① 브랜드 원상품이 그 이름을 **옵션/변형으로 파는가**(optionGroups · variants)
 * ② 판매처가 그 이름에 **같은 품번을 붙이는가**(brandModelCode)
 * ③ 그 이름이 **색 칸** 에 왔는가 **제목** 에 왔는가
 * ```
 * 🔴 셋 다로도 안 갈리면 **UNKNOWN** 으로 적는다.
 */

const FIX = join(__dirname, "fixtures");
const pad = (s: unknown, n: number) => String(s ?? "-").replace(/\s+/g, " ").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const v = (x: unknown) => (x == null || String(x).trim() === "" ? null : String(x).replace(/\s+/g, " ").trim());

const gt = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  candidates: Record<string, { searchId: string; domain: string; humanGt: string; humanReason?: string; title: string; facts: Record<string, unknown> }>;
};

describe("STAGE4-D — Pattern / Design semantics (분석 전용)", () => {
  it("① 원상품이 그 이름을 옵션으로 파는가 ② 같은 품번인가 ③ 어디에 적혔나", () => {
    /* eslint-disable no-console */

    /* ── ① 원상품의 옵션/변형 전수 ─────────────────────────────────── */
    console.log("\n═══ ① 브랜드 원상품이 «무엇을 변형으로 파는가» ═══");
    for (const [sid, o] of Object.entries(gt.origins)) {
      const cp = o.canonicalProduct;
      const title = v((cp.title as { value?: string })?.value) ?? v(cp.title);
      const groups = cp.optionGroups as unknown;
      const options = cp.options as unknown;
      const variants = cp.variants as unknown;
      const dump = (x: unknown, n = 300) => (x == null ? "-" : JSON.stringify(x).slice(0, n));
      console.log(`\n  [${sid}] ${pad(title, 44)}`);
      console.log(`     optionGroups ${dump(groups)}`);
      console.log(`     options      ${dump(options, 200)}`);
      console.log(`     variants(수) ${Array.isArray(variants) ? variants.length : dump(variants, 60)}`);
      if (Array.isArray(variants) && variants.length) {
        const names = variants
          .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>).title ?? (x as Record<string, unknown>).option1 : x))
          .filter(Boolean)
          .slice(0, 8);
        console.log(`     variant 이름 ${JSON.stringify(names)}`);
      }
    }

    /* ── ②③ 변형 이름이 어디에 왔고 품번이 같은가 ───────────────── */
    console.log("\n═══ ②③ 변형 이름의 «자리» 와 품번 ═══");
    console.log(`${pad("case", 6)} ${pad("색 칸(후보)", 26)} ${pad("품번(원↔후)", 24)} ${pad("제목에 그 말이 있나", 20)} ${pad("Legacy", 10)} 사유`);
    const NAMES = ["conker", "stripe", "graystone", "grey melange", "melange", "our grey"];
    for (const [cid, c] of Object.entries(gt.candidates)) {
      const o = gt.origins[c.searchId]?.canonicalProduct ?? {};
      /** 🔴 원상품 품번은 **여러 칸** 에 있을 수 있다 — 객체면 value 를 꺼낸다(1차에 `[object Object]` 로 찍혔다). */
      const pick = (x: unknown): string | null => {
        if (x == null) return null;
        if (typeof x === "object") return v((x as { value?: unknown }).value);
        return v(x);
      };
      const oCode = pick(o.sku) ?? pick(o.modelName);
      const cCode = v(c.facts.brandModelCode);
      const cColor = v(c.facts.colorText);
      const t = c.title.toLowerCase();
      const inTitle = NAMES.filter((n) => t.includes(n));
      const inColor = NAMES.filter((n) => (cColor ?? "").toLowerCase().includes(n));
      if (inTitle.length === 0 && inColor.length === 0) continue;
      console.log(
        `${pad(cid, 6)} ${pad(cColor, 26)} ${pad(`${oCode ?? "-"}↔${cCode ?? "-"}`, 24)} ${pad(JSON.stringify(inTitle), 20)} ${pad(c.humanGt, 10)} ${c.humanReason ?? "-"}`,
      );
      console.log(`        색 칸에 걸린 말 ${JSON.stringify(inColor)}`);
    }

    /* ── 분류표 — 🔴 근거가 없으면 UNKNOWN ──────────────────────── */
    console.log("\n═══ 변형 이름 분류(근거 없으면 UNKNOWN · CTO 가 지어내지 않는다) ═══");
    console.log(`${pad("이름", 18)} ${pad("색 칸 등장", 12)} ${pad("제목 등장", 10)} ${pad("같은 품번 사례", 14)} 판정`);
    const rows = Object.values(gt.candidates);
    for (const n of ["grey melange", "our grey", "graystone", "conker stripe"]) {
      const inColor = rows.filter((c) => (v(c.facts.colorText) ?? "").toLowerCase().includes(n)).length;
      const inTitle = rows.filter((c) => c.title.toLowerCase().includes(n)).length;
      const sameCode = rows.filter(
        (c) =>
          ((v(c.facts.colorText) ?? "").toLowerCase().includes(n) || c.title.toLowerCase().includes(n)) &&
          v(c.facts.brandModelCode) === "AW26MS185",
      ).length;
      console.log(`${pad(n, 18)} ${pad(inColor, 12)} ${pad(inTitle, 10)} ${pad(sameCode, 14)} ?(아래 결론 참조)`);
    }

    expect(Object.keys(gt.candidates).length).toBeGreaterThan(0);
  });
});
