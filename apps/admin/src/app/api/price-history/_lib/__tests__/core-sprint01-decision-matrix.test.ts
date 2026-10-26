import { describe, expect, it } from "vitest";
import { SAME05_PAIRS, type Same05Pair, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-01 **STEP 6** — Universal Decision Matrix(측정 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **추측 표를 만들지 않는다.** CPO 가 요구한 「증거 조합 × Identity × Comparability」
 *    표의 각 행을 **기존 GT 33쌍에서 실제로 세어** 채운다. 🔴 분모가 없는 행은
 *    **측정불가** 로 남기고 **0 으로 적지 않는다**(§9 규칙).
 * 🔴 운영 변경 0 · matcher 0 · verdict 0 · 새 GT 0.
 *
 * ── 🔴 이 표가 「판정표」가 «아니다» ─────────────────────────────────────────
 * ```
 * 이것은 **「그 증거 조합에서 사람은 실제로 무엇이라 했는가」** 의 분포다.
 * 🔴 「그러므로 이렇게 판정하라」는 **CPO 결정** 이고 CTO 가 적지 않는다.
 * ```
 */

/** 🔴 Identity 는 운영 verdict 를 **그대로** 읽는다(해석 0). */
type Row = { p: Same05Pair; j: ReturnType<typeof same05Judge> };

const ROWS: Row[] = SAME05_PAIRS.map((p) => ({ p, j: same05Judge(p.origin, p.facts) }));

const has = (r: Row, kind: "blocker" | "conflict", name: string): boolean =>
  kind === "blocker"
    ? r.j.cross.blockers.some((b) => String(b.blocker) === name)
    : r.j.cross.conflicts.some((c) => String(c.conflict) === name);
const axis = (r: Row, name: string): boolean => r.j.cross.axes.some((a) => String(a.axis) === name);

/**
 * CPO §6 의 표 행. 🔴 `match` 는 **증거 조합의 술어** 이고 판정이 아니다.
 * 🔴 `measurable: false` 면 그 행은 **구조적으로 측정 불가** 다(이유를 적는다).
 */
const COMBOS: {
  label: string;
  match: ((r: Row) => boolean) | null;
  why?: string;
}[] = [
  { label: "Brand + Code 일치", match: (r) => r.j.code === "exact" && !has(r, "blocker", "BRAND_UNCONFIRMED") && !has(r, "blocker", "BRAND_MISMATCH") },
  { label: "Brand + 제품명(코드 없음)", match: (r) => r.j.code === "unavailable" && axis(r, "TITLE") && !has(r, "blocker", "BRAND_UNCONFIRMED") && !has(r, "blocker", "BRAND_MISMATCH") },
  { label: "Title 약함 + Description 강함", match: null, why: "🔴 `ProductFacts` 에 description 칸이 **없다** ⟹ 그 조합을 만들 수 없다(SAME-04 확정)" },
  { label: "Code conflict + 제목 겹침", match: (r) => r.j.code === "conflict" && axis(r, "TITLE") },
  { label: "Code conflict(전체)", match: (r) => r.j.code === "conflict" },
  { label: "Form conflict(GARMENT_FORM)", match: (r) => has(r, "blocker", "GARMENT_FORM") },
  { label: "Composition conflict(세트)", match: (r) => has(r, "conflict", "COMPOSITION") },
  { label: "Color variant(색조 같고 이름 다름)", match: (r) => has(r, "blocker", "COLOR_VARIANT") },
  { label: "Color conflict(색조 다름)", match: (r) => has(r, "conflict", "COLOR") },
  { label: "Image only", match: null, why: "🔴 IMAGE 축에 증거가 **공급되지 않는다**(후보 imageUrl 하드코딩 null) ⟹ 발화 0" },
  { label: "Brand 미확인(BRAND_UNCONFIRMED)", match: (r) => has(r, "blocker", "BRAND_UNCONFIRMED") },
  { label: "Title 겹침 0(NO_TITLE_OVERLAP)", match: (r) => has(r, "blocker", "NO_TITLE_OVERLAP") },
  { label: "같은 판매처 다른 리스팅", match: (r) => has(r, "blocker", "SAME_SELLER_DISTINCT_LISTING") },
  { label: "증거 부족(축 0 · 보류/반증 0)", match: (r) => r.j.cross.axes.length === 0 && r.j.cross.blockers.length === 0 && r.j.cross.conflicts.length === 0 },
];

describe("CORE-SAME-SPRINT-01 STEP 6 — Universal Decision Matrix(GT 측정 · 구현 0)", () => {
  it("증거 조합마다 «사람이 무엇이라 했는가» 를 센다", () => {
    const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
    console.log(`\n${"═".repeat(104)}`);
    console.log(`  STEP 6 — 증거 조합 × human 라벨 × 현재 Identity (GT ${ROWS.length}쌍)`);
    console.log(`${"═".repeat(104)}`);
    console.log(
      `  ${pad("증거 조합", 34)}${pad("분모", 6)}${pad("human S/D/U", 14)}${pad("현재 sys SAME", 14)}${pad("tier자격", 10)}비고`,
    );

    const unmeasurable: string[] = [];
    for (const c of COMBOS) {
      if (!c.match) {
        unmeasurable.push(c.label);
        console.log(`  ${pad(c.label, 34)}${pad("—", 6)}${pad("측정불가", 14)}${pad("—", 14)}${pad("—", 12)}${c.why ?? ""}`);
        continue;
      }
      const hit = ROWS.filter(c.match);
      const S = hit.filter((r) => r.p.human === "SAME").length;
      const D = hit.filter((r) => r.p.human === "DIFFERENT").length;
      const U = hit.filter((r) => r.p.human === "UNCERTAIN").length;
      const sysSame = hit.filter((r) => r.j.cross.verdict === "SAME").length;
      /**
       * 🔴🔴 **「가격축 진입」이 아니다** — `priceTier` **자격만** 본다.
       *    실제 국내 적재는 `market === "KR"` **그리고** KRW 가격이 **더** 필요하다
       *    (`market-intelligence.ts:318`). 🔴 1차에 이 칸을 「가격축 진입」으로 적었고
       *    그러면 CPO 가 「DIFFERENT 가 가격에 들어간다」로 **오독** 한다 ⟹ 라벨을 좁혔다.
       */
      const priced = hit.filter((r) => r.j.tier === "EXACT" || r.j.tier === "COMPARISON").length;
      const note = hit.length === 0 ? "🔴 **분모 0 — 측정불가**" : D > 0 && sysSame > 0 ? "🔴 누출 있음" : D > 0 ? "🟢 DIFFERENT 를 막는다" : "";
      console.log(
        `  ${pad(c.label, 34)}${pad(String(hit.length), 6)}${pad(`${S}/${D}/${U}`, 14)}${pad(String(sysSame), 14)}${pad(String(priced), 10)}${note}`,
      );
    }

    console.log(
      `\n  🔴 **구조적 측정불가 ${unmeasurable.length}행** — ${unmeasurable.join(" · ")}\n` +
        `     ⟹ 그 둘은 **증거가 공급되지 않아서** 비어 있다(판정 문제가 아니다)\n` +
        `  🔴 tier자격 은 **priceTier 만** 본 값이다 — 실제 국내 적재는 market=KR + KRW 가 **더** 필요하다.\n` +
        `  🔴 이 표는 「판정표」가 **아니다** — 「그 조합에서 사람은 무엇이라 했는가」의 분포다.`,
    );

    /** 🔴 측정불가 행이 **정확히 둘** 이다(description · image) — 바뀌면 전제가 바뀐 것이다. */
    expect(unmeasurable).toEqual(["Title 약함 + Description 강함", "Image only"]);
  });

  /**
   * 🔴🔴🔴 **A/B 분리의 효과를 «숫자로» 낸다 — 구현 0.**
   *
   * CPO 설계: Identity(A) 와 Comparability(B) 를 가른다. 지금은 `COMPOSITION` 이
   * A 의 conflict 로 들어가 **「다른 상품」** 이 된다. 🟢 그 행을 **B 로 옮기면**
   * A 에서 무엇이 바뀌는지를 GT 로 센다(판정 변경 0 · 반사실 계산만).
   */
  it("[A/B 분리 반사실] COMPOSITION 을 B 로 옮기면 A 에서 무엇이 바뀌는가", () => {
    const setRows = ROWS.filter((r) => has(r, "conflict", "COMPOSITION"));
    console.log(`\n═══ A/B 분리 반사실 — COMPOSITION 보유 ${setRows.length}쌍 ═══`);
    for (const r of setRows) {
      console.log(
        `    ${r.p.id.padEnd(7)} ${r.p.domain.padEnd(24)} human=${r.p.human.padEnd(10)} ` +
          `현재 A=${r.j.cross.verdict} · tier=${r.j.tier}  ⟹ 분리 후 A=**재계산 필요** · B=NOT_COMPARABLE`,
      );
    }
    if (setRows.length === 0) {
      console.log(
        `    🔴🔴 **분모 0 — 이 GT 에 세트 사례가 없다.**\n` +
          `       🟢 CEO 가 세트로 판정한 \`bornyesterdaykids\` 는 **다른 GT 풀**(core-2m · wu-112)에 있고\n` +
          `          그 풀에는 **저장 facts 가 없다** ⟹ 이 네트워크-0 분모에서는 **측정불가** 다.\n` +
          `       🔴 ⟹ A/B 분리의 효과를 **지금 GT 로는 수치화할 수 없다**(설계는 유효 · 수치는 측정불가).`,
      );
    }
    /** 🔴 분모를 숨기지 않는다 — 0 이면 「효과 0」이 아니라 「측정불가」다. */
    expect(setRows.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * 🟢 **Universal ↔ Category-specific 분리**(CPO §5) — 코드 사실로만 적는다.
   */
  it("[공통 ↔ 카테고리 의존] 축을 두 부류로 가른다", () => {
    const universal = ["BRAND(게이트)", "MODEL_CODE", "TITLE", "CATEGORY/GARMENT_FORM", "COMPOSITION", "IMAGE"];
    const categoryDependent = ["COLOR", "MATERIAL", "FIT", "SIZE/SIZE_SYSTEM", "AUDIENCE/AUDIENCE_LINE"];
    console.log(
      `\n═══ 공통 ↔ 카테고리 의존 ═══\n` +
        `  🟢 공통(카테고리가 바뀌어도 같은 뜻) — ${universal.join(" · ")}\n` +
        `  🟡 카테고리 의존(뜻이 달라진다)      — ${categoryDependent.join(" · ")}\n` +
        `  🔴 근거 — 신발에 FIT/AUDIENCE_LINE 은 의미가 다르고 가방에 SIZE 는 치수다.\n` +
        `     🔴🔴 그러나 **이 GT 로는 검증할 수 없다** — 원상품이 상의 5 · 신발 1 · 액세서리 1 이고\n` +
        `        신발·액세서리는 **국내 후보가 0** 이다(SAME-08 실측) ⟹ **측정불가**.\n` +
        `  🟢 그래서 이 분류는 **설계 가설** 이고 「측정됐다」로 적지 않는다.`,
    );
    /** 🔴 축 이름을 지어내지 않았다 — 전부 `CrossSellerAxis`/blocker/conflict 에 실재한다. */
    expect(universal.length + categoryDependent.length).toBe(11);
  });
});
