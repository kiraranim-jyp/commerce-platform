import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAME05_BASELINE, SAME05_PAIRS, isSystemSame, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-07 — **판정 기준 v1.0 조사**(네트워크 0 · 운영 변경 0 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 축을 만들지 않았다.** CPO 가 제시한 **10축**과 **A/B 2단계** 가 코드에
 *    이미 있는지를 **전수로 대조** 하고, 없거나 섞여 있는 자리를 **좌표로** 적는다.
 * 🔴 matcher · threshold · 축 정의 · verdict 변경 **0**.
 *
 * ── 🔴🔴🔴 가장 중요한 발견을 먼저 적는다 ──────────────────────────────────
 * ```
 * CPO 의 B(가격 비교 가능성) 재료가 **A(상품 동일성) 축에 섞여 있다.**
 *   `compareComposition`(cross-seller.ts:457)이 **세트/멀티팩을 이미 감지** 하는데,
 *   그 결과가 `conflicts` 로 들어가(:890) **조기 반환 CONFLICT**(:898)가 된다.
 * ⟹ 🔴 CEO 는 `bornyesterdaykids`(상/하의 세트)를 「상의는 동일하지만 **가격 비교에는
 *    부적합** ⟹ **판단불가**」로 봤는데, 시스템은 **DIFFERENT** 로 처리한다.
 * ⟹ 🔴 「동일상품이 아니다」와 「가격을 비교할 수 없다」가 **같은 출력** 이 된다.
 *    CPO 가 요구한 분리(A ↔ B)는 **그 지점을 가르는 일** 이다.
 * 🔴 **CTO 가 가르지 않았다** — verdict 체계 변경이고 제품 정책이다.
 * ```
 */

const CROSS = readFileSync(
  join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
  "utf8",
);
/** 🔴 주석을 벗기고 본다(여덟 번 걸린 함정 · 헌장 §5). */
const SRC = CROSS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");

/** CPO §「검증할 핵심 조합」 10축 ↔ 코드 실체. 🔴 **추측하지 않고 소스에서 확인** 한다. */
const CPO_AXES: {
  n: string;
  label: string;
  /** 코드에서 그 축을 담당하는 식별자(소스에 실재해야 한다). */
  owners: string[];
  /** A(동일성) · B(가격비교) · BOTH · NONE */
  stage: "A" | "B" | "BOTH" | "NONE";
  note: string;
}[] = [
  { n: "①", label: "브랜드", owners: ["brandKnown", "brandOk", "BRAND_MISMATCH", "BRAND_UNCONFIRMED"], stage: "A", note: "🔴 «축» 이 아니라 게이트다(CrossSellerAxis 에 BRAND 가 없다)" },
  { n: "②", label: "모델코드", owners: ["compareModelCode", "MODEL_CODE"], stage: "A", note: "🔴 conflict 면 **조기 종료** — CPO 의 「불일치 ≠ 자동 DIFFERENT」와 충돌" },
  { n: "③", label: "상품명/모델명", owners: ["coreTitleTokens", "NO_TITLE_OVERLAP"], stage: "A", note: "한글↔영문은 겹침 0(WU-078 종료축)" },
  { n: "④", label: "상세설명", owners: [], stage: "NONE", note: "🔴🔴 **ProductFacts 에 칸이 없다** — 어느 축에도 들어가지 않는다" },
  { n: "⑤", label: "상품 형태", owners: ["GARMENT_FORM", "compareCategory", "CATEGORY"], stage: "A", note: "🟢 blocker + conflict 둘 다 있다(parkette 가 그 사례)" },
  { n: "⑥", label: "색상", owners: ["compareColor", "COLOR_VARIANT"], stage: "BOTH", note: "🟡 variant 구분이 **보류** 로만 있고 B 로 분리돼 있지 않다" },
  { n: "⑦", label: "소재", owners: ["compareMaterial", "MATERIAL"], stage: "A", note: "🟢 축 + 보류" },
  /**
   * 🔴🔴 **내 1차 표가 틀렸고 단언이 잡았다** — `sellerSku` 를 owner 로 적었는데
   *    `cross-seller.ts` 에 **그 문자열이 아예 없다**(실측). ⟹ 「판정에 쓰지 않는다」보다
   *    **강한 사실** 이다 — matcher 가 판매처 SKU 를 **한 번도 보지 않는다.**
   */
  { n: "⑧", label: "옵션/SKU", owners: ["SIZE_SYSTEM", "buildSizeProfile"], stage: "BOTH", note: "🔴🔴 `sellerSku` 는 matcher 에 **아예 없다**(variant 구분 수단이 사이즈뿐)" },
  { n: "⑨", label: "세트/단품", owners: ["compareComposition", "COMPOSITION"], stage: "A", note: "🔴🔴 **B 재료인데 A 의 conflict 로 들어간다** — 이 WU 의 핵심" },
  { n: "⑩", label: "이미지", owners: ["CrossSellerImageEvidence", "IMAGE"], stage: "A", note: "🔴 축은 있는데 호출부가 증거를 **넘기지 않는다**(후보 imageUrl 하드코딩 null)" },
];

describe("CORE-SAME-07 ① CPO 10축 ↔ 코드 실체 전수 대조(네트워크 0)", () => {
  it("축마다 코드 owner 가 실재하는지 «소스에서» 확인한다", () => {
    console.log(`\n═══ CPO 10축 ↔ 코드 실체 ═══`);
    const missing: string[] = [];
    for (const a of CPO_AXES) {
      const found = a.owners.filter((o) => SRC.includes(o));
      const state = a.owners.length === 0 ? "🔴 **코드에 없다**" : found.length === a.owners.length ? "🟢 전부 있다" : `🟡 ${found.length}/${a.owners.length}`;
      console.log(`  ${a.n} ${a.label.padEnd(12)} [${a.stage.padEnd(4)}] ${state.padEnd(16)} ${a.note}`);
      if (a.owners.length === 0) missing.push(a.label);
      /** 🔴 owner 가 있다고 적었으면 **소스에 실제로 있어야** 한다. */
      for (const o of a.owners) {
        expect(SRC, `🔴 ${a.label} 의 owner 「${o}」가 소스에 없다 — 이 표가 거짓이다`).toContain(o);
      }
    }
    /** 🔴 코드에 **없는** 축은 **상세설명 하나** 다(나머지 아홉은 전부 실재). */
    expect(missing).toEqual(["상세설명"]);
    /** 🔴🔴 `sellerSku` 가 matcher 에 **없다** 는 것을 별도로 잠근다(1차 표의 오류 자리). */
    expect(SRC, "🔴 sellerSku 가 생기면 ⑧ 축의 서술을 다시 써야 한다").not.toContain("sellerSku");
    console.log(
      `\n  🟢 코드에 실재하는 축 **9 / 10** · 🔴 없는 것 = **상세설명 하나**\n` +
        `  🔴🔴 그리고 sellerSku 는 matcher 에 **아예 없다** — variant 구분 수단이 **사이즈뿐** 이다`,
    );
  });

  /**
   * 🔴🔴🔴 **A/B 가 코드에서 뭉쳐 있는 지점을 좌표로 고정한다.**
   */
  it("B(가격비교 가능성) 재료가 A(동일성) 의 conflict 로 들어간다", () => {
    /** 🟢 세트 감지는 **이미 있다**. */
    expect(SRC).toContain("compareComposition");
    /** 🔴 그런데 그 결과가 `conflicts` 에 push 된다 — 그래서 CONFLICT(= 다른 상품)가 된다. */
    const at = SRC.indexOf("const composition = compareComposition");
    expect(at, "🔴 호출 지점을 못 찾으면 이 단언이 무의미하다").toBeGreaterThan(0);
    const after = SRC.slice(at, at + 400);
    expect(after, "🔴 세트 불일치가 conflicts 로 들어가는 것이 A/B 혼입의 실체다").toContain('conflicts.push');
    expect(after).toContain('conflict: "COMPOSITION"');
    /** 🔴 그리고 conflicts 가 있으면 **조기 반환** 되어 축이 하나도 계산되지 않는다. */
    expect(SRC).toContain("if (conflicts.length > 0 && !skipConflictReturn)");
    expect(SRC).toContain('verdict: "CONFLICT"');
    console.log(
      `\n  🔴🔴 A/B 혼입 좌표 — cross-seller.ts\n` +
        `     compareComposition 정의 :457 · 호출 :890 → conflicts.push\n` +
        `     conflicts.length > 0 → **조기 반환 CONFLICT**(axes: []) :898\n` +
        `  ⟹ 「세트라서 가격을 비교할 수 없다」가 「다른 상품이다」와 **같은 출력** 이 된다\n` +
        `  🔴 CTO 가 가르지 않았다 — verdict 체계 변경이고 제품 정책이다`,
    );
  });
});

describe("CORE-SAME-07 ② CPO 요구의 «분모» 를 GT 에서 센다", () => {
  /**
   * 🔴🔴 CPO 요구 ② — 「코드 일치 = 강한 SAME 증거 / **코드 불일치 ≠ 자동 DIFFERENT**」.
   *    🔴 현재 코드는 **그 반대** 다(conflict → 조기 종료 CONFLICT).
   * 🟢 그 변경이 **무엇을 열고 무엇을 뚫는지** 를 기존 GT 로 센다(새 GT 0).
   */
  it("[코드 불일치 × human 라벨] 그 정책을 바꿀 때의 분모", () => {
    const rows = SAME05_PAIRS.map((p) => ({ p, j: same05Judge(p.origin, p.facts) }));
    const codeConflict = rows.filter((r) => r.j.code === "conflict");
    const dist = { SAME: 0, DIFFERENT: 0, UNCERTAIN: 0 };
    for (const r of codeConflict) {
      const k = r.p.human as keyof typeof dist;
      if (k in dist) dist[k] += 1;
    }
    console.log(`\n═══ 품번 «불일치»(conflict) × human 라벨 — GT ${SAME05_PAIRS.length}쌍 ═══`);
    console.log(`  conflict 전체 ${codeConflict.length} → SAME ${dist.SAME} · DIFFERENT ${dist.DIFFERENT} · UNCERTAIN ${dist.UNCERTAIN}`);
    for (const r of codeConflict) {
      console.log(
        `    ${r.p.id.padEnd(7)} ${r.p.domain.padEnd(24)} human=${r.p.human.padEnd(10)} sys=${r.j.cross.verdict.padEnd(10)} ` +
          `${r.p.origin.brandModelCode} ↔ ${r.p.facts.brandModelCode}`,
      );
    }
    console.log(
      `\n  🟡 **열리는 것** — human SAME ${dist.SAME}건(품번이 달라도 사람은 같다고 본 사례)\n` +
        `  🔴 **뚫릴 위험** — human DIFFERENT ${dist.DIFFERENT}건(품번 보호가 지금 막고 있는 것)\n` +
        `  ⟹ 🔴 둘이 **같은 분모 안에 있다** ⟹ 「불일치 ≠ 자동 DIFFERENT」는 **교환** 이다`,
    );
    /** 🔴 분모가 0 이면 이 측정이 아무것도 말하지 않는다. */
    expect(codeConflict.length, "🔴 품번 불일치 쌍이 0 이면 그 정책을 이 GT 로 판단할 수 없다").toBeGreaterThan(0);
    /** 🔴 양쪽이 **같이** 있다는 것이 이 WU 의 핵심 관측이다 — 단정하지 않고 수로 남긴다. */
    expect(dist.SAME + dist.DIFFERENT).toBeGreaterThan(0);
  });

  /**
   * 🔴 CPO 가 말한 「검색 결과 전체에서 얼마나 안정적으로 골라내느냐」의 **현재 값**.
   *    🟢 SAME-05 가 이미 쟀다 — 다시 재지 않고 **같은 집계기** 로 한 줄 요약만 남긴다.
   */
  it("[현재 선별 성능] 검색 결과 전체 기준 — 다시 재지 않고 요약만", () => {
    const rows = SAME05_PAIRS.map((p) => ({ p, sys: same05Judge(p.origin, p.facts).cross.verdict }));
    const gtSame = rows.filter((r) => r.p.human === "SAME");
    const gtDiff = rows.filter((r) => r.p.human === "DIFFERENT");
    const tp = gtSame.filter((r) => isSystemSame(r.sys)).length;
    const fp = gtDiff.filter((r) => isSystemSame(r.sys)).length;
    console.log(
      `\n═══ 현재 선별 성능(GT ${SAME05_PAIRS.length}쌍) ═══\n` +
        `  SAME 회수 ${tp}/${gtSame.length} · 🔴 DIFFERENT 누출 ${fp}/${gtDiff.length}\n` +
        `  🔴 CPO 성공 기준은 「SAME 몇 건」이 아니라 **누출 0 + 과잉 폐기 최소** 다 —\n` +
        `     지금은 **회수가 낮고 누출이 2** 다(그 2 는 알려진 False EXACT: C06 · S1-6)`,
    );
    expect(tp).toBe(6);
    expect(fp).toBe(SAME05_BASELINE.fp);
  });
});

describe("CORE-SAME-07 ③ 다중 후보 GT 를 받을 준비", () => {
  /**
   * 🟢 CPO 가 요구한 「검색 결과 묶음 · 후보 5~10개 · 3-way 판정」 화면은 **이미 있다**.
   * 🔴 새 UI 를 만들지 않는다 — 그 빌더를 **그대로** 쓴다.
   */
  it("3-way 판정 화면이 이미 있고 재사용 가능하다", () => {
    const builder = join(__dirname, "core-same03-domestic-review-build.test.ts");
    const src = readFileSync(builder, "utf8");
    /** 🟢 동일/다른제품/판단불가 3택 + 사유 + JSON export 가 이미 있다. */
    for (const token of ['value="동일"', 'value="다른제품"', 'value="판단불가"', "<textarea", "판정 결과 복사하기"]) {
      expect(src, `🔴 ${token} 이 없으면 3-way GT 수집을 재사용할 수 없다`).toContain(token);
    }
    console.log(
      `\n  🟢 재사용 — core-same03-domestic-review-build (CORE_SAME03_LIVE=1)\n` +
        `     3택 + 사유 + JSON export + 원상품별 섹션 + 측정불가 표시 **전부 있다**\n` +
        `  🔴 지금 부족한 것은 **화면이 아니라 후보 공급** 이다 —\n` +
        `     현재 국내 후보는 상품당 2~4건이고 CPO 가 요구한 **5~10건** 에 못 미친다\n` +
        `  🔴 그 공급 확대는 §7 ABSOLUTE FREEZE(discovery) 밖이라 **CPO 범위 결정** 이다`,
    );
  });
});
