import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { lookupBrandAlias } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";
import {
  SAME05_PAIRS,
  type Same05Pair,
  fmtTally,
  isSystemSame,
  same05Tally,
  SAME05_BASELINE,
} from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-05 **STEP 2·3·4** — 반사실 측정(운영 변경 0 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **구현 «전» 에 잰다.** §12 의 PASS 기준이 「recall 개선 **과** leakage 없음」을
 *    동시에 요구하므로, **측정이 곧 착수 게이트** 다. 운영 코드는 한 글자도 바꾸지 않았다.
 * 🔴 반사실은 **운영 함수에 입력만 바꿔** 넣는다(WU-134 STEP-2 방식 · WU-164 와 같은 모양).
 *
 * ── 🔴🔴🔴 먼저 — **분모가 둘로 갈려 있고 그것이 이 WU 의 핵심 제약이다** ────
 * ```
 * 안전성(DIFFERENT)을 가진 분모   GT 33쌍 (SAME 17 · DIFFERENT 10 · UNCERTAIN 6)
 * P0 축(NO_TITLE_OVERLAP)이 막는 FN   **0 / 12**        ← STEP 1 실측
 * DIFFERENT 10 중 **한글 토큰 보유**  **1**(C22)         ← 아래 측정
 * ⟹ 🔴 「한글 음역 normalization」의 **효과도 위험도 이 GT 로는 거의 측정되지 않는다.**
 *
 * 효과(제목 문제)를 가진 분모      SAME-03 FN (biskuit · luxboy) — 🔴 **DIFFERENT 0**
 * ⟹ 🔴🔴 **두 분모를 합치지 않는다.** 합치면 「recall 올랐고 leakage 없다」가
 *    **서로 다른 표본에서 나온 말** 이 되어 §12 를 충족한 것처럼 보인다.
 * ```
 *
 * ── 🔴 WU-164 · WU-078 과의 관계(숨기지 않는다) ─────────────────────────────
 * ```
 * WU-164(CPO 2026-10-22)가 **같은 축(CF-B)** 을 이미 닫았다 —
 *   「`coreTitleTokens` 는 brand-alias 를 쓰지 않는다 · 음역 축은 WU-078 에서 종료 ·
 *     CF-B 는 **새 유사도/느슨한 토큰 매칭 없이는 성립하지 않는다** = CPO 금지」
 * 🟢 CPO 가 SAME-05 §4 로 **재개** 했으므로 측정한다(§3 reopen 조건 충족).
 * 🔴 단 WU-078 의 REJECT 사유(「DIFFERENT 를 열 위험」)를 **그 분모로 다시 재야** 하고,
 *    그 분모가 이 GT 에 **거의 없다** 는 것이 아래 결과다.
 * ```
 */

const LIVE = process.env.CORE_SAME05_LIVE === "1";

/* ══════════════════════════════════════════════════════════════════════════════
   P0 — TITLE 음역 normalization (반사실 전용)
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴🔴 **일반 번역 사전이 «아니다»**(§4 금지). 이 트랙에서 **실제로 관측된 토큰만** 넣었다 —
 *    `biskuit.kr` 제목 「허그 헤어리 몬스터」 ↔ 원상품 `[hug, hairy, monster, shirt]`.
 * 🔴 브랜드 음역은 **새로 만들지 않았다** — 기존 `lookupBrandAlias`(WU-151 자산)를 **역방향**
 *    으로 쓴다(아래 `BRAND_TRANSLIT`). 🔴 alias 표를 늘리지 않았다.
 * 🔴 이 표를 늘려서 결과를 만들지 않는다 — **늘리면 그것이 「새 사전」** 이다.
 */
const OBSERVED_TRANSLIT: Record<string, string> = {
  허그: "hug",
  헤어리: "hairy",
  몬스터: "monster",
};

/** 🟢 기존 brand alias 를 **역방향** 으로 — 「보보쇼즈 → bobochoses」. 새 표 0. */
const BRAND_TRANSLIT: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const brand of ["Bobo Choses", "Pèpè Shoes"]) {
    const alias = lookupBrandAlias(brand);
    if (alias) out[alias.replace(/\s+/g, "")] = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  return out;
})();

/**
 * 🔴 **토큰 단위 치환만** 한다 — 부분 문자열 매칭을 하지 않는다(「보보쇼즈st」 같은
 *    유사품 표기를 브랜드로 읽지 않는다는 WU-151 경계를 그대로 지킨다).
 * 🔴 **모르는 한글 토큰은 그대로 둔다** — 지어내지 않는다.
 */
export function transliterateTokens(tokens: string[]): string[] {
  return tokens.map((t) => OBSERVED_TRANSLIT[t] ?? BRAND_TRANSLIT[t] ?? t);
}

/** 반사실 입력 — `coreTitleTokens` 만 바꾼다. 🔴 다른 칸은 **건드리지 않는다**. */
const cfTitle = (f: ProductFacts): ProductFacts => ({ ...f, coreTitleTokens: transliterateTokens(f.coreTitleTokens) });

/* ══════════════════════════════════════════════════════════════════════════════
   P2 — MODEL_CODE 표기 normalization (반사실 전용)
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴🔴 **「같은 코드로 만들기」가 아니다.** `#226AC009` 처럼 **접두 1글자가 빠진** 모양만
 *    원상품 코드로 **복원** 한다. 조건을 **넷 동시** 로 걸어 구조를 보존한다:
 * ```
 * ① 원상품 코드가 있다
 * ② 후보 코드가 **null** 이다(값이 있으면 **절대 덮지 않는다** — 충돌 보호 유지)
 * ③ 후보 **제목 토큰** 에 「원상품 코드에서 앞 1글자를 뗀 문자열」이 있다
 * ④ 그 뗀 글자가 **영문자** 이고 남은 부분이 **원상품 코드의 꼬리와 글자 그대로 같다**
 * ```
 * 🔴 ②가 **기존 `compareModelCode` 충돌 보호를 그대로 살린다** — 값이 있는 후보끼리의
 *    비교는 **한 글자도 바뀌지 않는다**(AC042↔AC043 보호가 유지된다).
 * 🔴 길이·영숫자 구조를 **느슨하게 하지 않는다** — 임의 자리수 매칭 0.
 */
export function recoverTruncatedModelCode(origin: string | null, cand: ProductFacts): string | null {
  if (cand.brandModelCode) return cand.brandModelCode; // ② 값이 있으면 덮지 않는다
  const code = origin?.trim();
  if (!code || code.length < 4) return null;
  const head = code[0];
  if (!/^[A-Za-z]$/.test(head)) return null; // ④ 뗀 글자는 영문자만
  const tail = code.slice(1).toLowerCase();
  if (tail.length < 3) return null;
  const hit = cand.coreTitleTokens.some((t) => t.toLowerCase() === tail);
  return hit ? code : null;
}

const cfCode = (p: Same05Pair): ProductFacts => {
  const recovered = recoverTruncatedModelCode(p.origin.brandModelCode, p.facts);
  return recovered === p.facts.brandModelCode ? p.facts : { ...p.facts, brandModelCode: recovered };
};

/* ══════════════════════════════════════════════════════════════════════════════
   P1 — BRAND evidence (반사실 전용)
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴🔴 **seller name 을 브랜드로 보는 기존 의미를 «제거하지 않는다»**(§6).
 *    대신 **brand 가 비어 있을 때만** 제목 토큰의 브랜드 음역으로 **채운다**.
 * 🔴 `biskuit` 처럼 brand 에 **판매처 이름이 들어간 경우는 덮지 않는다** —
 *    그것은 「inferred brand 가 declared brand 를 이긴다」가 되고 §6 이 금지한 방향이다.
 *    ⟹ 🔴 그래서 이 반사실은 **donokids(brand null)만** 움직인다(설계된 범위다).
 * 🟢 쓰는 자산은 기존 `lookupBrandAlias` 역방향 하나다 — alias 표 **확장 0**.
 */
export function brandFromTitleTokens(f: ProductFacts): string | null {
  if (f.brand) return f.brand; // declared 를 덮지 않는다
  for (const t of f.coreTitleTokens) {
    for (const [alias, _ascii] of Object.entries(BRAND_TRANSLIT)) {
      if (t === alias) return Object.keys(BRAND_TRANSLIT).length ? aliasToBrand(alias) : null;
    }
  }
  return null;
}
/** 🟢 alias → 정식 브랜드명(기존 표의 역인덱스 · 새 값 0). */
function aliasToBrand(alias: string): string | null {
  for (const brand of ["Bobo Choses", "Pèpè Shoes"]) {
    const a = lookupBrandAlias(brand);
    if (a && a.replace(/\s+/g, "") === alias) return brand;
  }
  return null;
}
const cfBrand = (f: ProductFacts): ProductFacts => {
  const b = brandFromTitleTokens(f);
  return b === f.brand ? f : { ...f, brand: b };
};

/* ══════════════════════════════════════════════════════════════════════════════
   측정
   ══════════════════════════════════════════════════════════════════════════════ */

type Mode = "baseline" | "title" | "code" | "brand" | "all";

/**
 * 🔴🔴🔴 **순서가 결과를 바꾼다 — 1차 구현이 틀렸고 측정이 그것을 드러냈다.**
 *
 * 1차에는 `cfTitle` 을 **먼저** 돌렸다. 그러면 음역이 「보보쇼즈」를 `bobochoses` 로
 * 바꿔 버려서 뒤따르는 `cfBrand`(한글 alias 토큰을 찾는다)가 **발화하지 못한다.**
 * ⟹ `all` 모드가 brand 를 못 채워 **「세 축을 합쳐도 SAME 이 안 된다」는 거짓 결론** 이
 *    나올 자리였다(실측으로 잡았다 — donokids 가 그 모양이다).
 * 🟢 그래서 **brand → code → title** 순서로 고정한다. 앞의 둘은 **원래 토큰** 을 보고,
 *    음역은 **맨 마지막** 에 토큰을 바꾼다.
 * 🔴 운영 판정 규칙은 **한 글자도 바꾸지 않았다** — 반사실 입력을 만드는 순서다.
 */
function factsFor(p: Same05Pair, mode: Mode): ProductFacts {
  let f = p.facts;
  if (mode === "brand" || mode === "all") f = cfBrand(f);
  if (mode === "code" || mode === "all") {
    const recovered = recoverTruncatedModelCode(p.origin.brandModelCode, f);
    if (recovered !== f.brandModelCode) f = { ...f, brandModelCode: recovered };
  }
  if (mode === "title" || mode === "all") f = cfTitle(f);
  return f;
}

const verdictOf = (p: Same05Pair, mode: Mode): string => {
  const f = factsFor(p, mode);
  const origin = mode === "title" || mode === "all" ? cfTitle(p.origin) : p.origin;
  return compareCrossSellerProducts(origin, f).verdict;
};

const MODES: Mode[] = ["baseline", "title", "code", "brand", "all"];

describe("CORE-PRICE-SAME-05 STEP 2·3·4 — 반사실(안전성 분모 · 네트워크 0)", () => {
  it("🔴 한글 음역 축의 «위험 분모» 가 이 GT 에 거의 없다", () => {
    const diff = SAME05_PAIRS.filter((p) => p.human === "DIFFERENT");
    const withHangul = diff.filter((p) => /[가-힣]/.test(p.facts.coreTitleTokens.join("")));
    console.log(`\n═══ 음역 축 위험 분모 ═══`);
    console.log(`    DIFFERENT ${diff.length} 중 **한글 토큰 보유 ${withHangul.length}**` + ` → ${withHangul.map((p) => `${p.id}(${p.domain})`).join(" · ") || "없음"}`);
    console.log(`    🔴 나머지 ${diff.length - withHangul.length} 쌍은 한글 토큰이 **0** 이라 음역이 구조적으로 영향을 줄 수 없다`);
    expect(diff.length).toBe(SAME05_BASELINE.different);
    /** 🔴 1 이면 「안전하다」가 아니라 **그 축의 안전성을 이 GT 로 못 증명한다** 는 뜻이다. */
    expect(withHangul.length).toBeLessThanOrEqual(2);
  });

  /**
   * 🔴🔴🔴 **「변화 0 = 안전」을 금지하는 발화 단언.**
   *
   * 아래 leakage 비교가 `FP +0` 을 내도, 그것이 **반사실이 돌지 않아서** 라면
   * 아무것도 증명하지 않는다(이 저장소가 반복해서 처벌한 그 모양이다).
   * 🟢 그래서 **입력이 실제로 바뀐 쌍 수** 를 먼저 센다.
   */
  it("[발화 확인] 각 반사실이 이 GT 에서 «실제로 입력을 바꿨는가»", () => {
    const fired = { title: [] as string[], code: [] as string[], brand: [] as string[] };
    for (const p of SAME05_PAIRS) {
      const tag = `${p.id}(${p.domain}·human=${p.human})`;
      if (JSON.stringify(cfTitle(p.facts).coreTitleTokens) !== JSON.stringify(p.facts.coreTitleTokens)) fired.title.push(tag);
      if (cfCode(p).brandModelCode !== p.facts.brandModelCode) fired.code.push(tag);
      if (cfBrand(p.facts).brand !== p.facts.brand) fired.brand.push(tag);
    }
    console.log(`\n═══ 반사실 발화 (GT ${SAME05_PAIRS.length}쌍) ═══`);
    console.log(`    title  ${fired.title.length} → ${fired.title.join(" · ") || "없음"}`);
    console.log(`    code   ${fired.code.length} → ${fired.code.join(" · ") || "없음"}`);
    console.log(`    brand  ${fired.brand.length} → ${fired.brand.join(" · ") || "없음"}`);
    /**
     * 🔴🔴🔴 **내 1차 단언이 「세 축 전부 발화 0」이었고 틀렸다 — 측정이 정정했다.**
     *
     * 실측: `title` **1** · `code` **0** · `brand` **1** 이 발화한다. 🔴 그래서 아래
     * leakage 비교의 뜻이 축마다 **다르다**:
     * ```
     * title  발화 1 · DIFFERENT 쌍이다(C22) ⟹ 🟢 「그 1쌍에서 leakage 없음」은 **의미 있다**
     *                                        🔴 단 분모가 **1** 이다
     * brand  발화 1 · 같은 쌍이다            ⟹ 🟢 같은 성질 · 분모 **1**
     * code   발화 **0**                      ⟹ 🔴🔴 **이 GT 로는 측정되지 않았다**
     *                                        (「FP +0」을 안전 근거로 **쓰지 않는다**)
     * ```
     * 🔴 셋 중 **어느 것도 SAME 을 회복하지 못한다**(SAME +0) — 효과는 이 GT 밖에 있다.
     */
    expect(fired.title).toHaveLength(1);
    expect(fired.code, "🔴 품번 복원이 이 GT 에서 발화하지 않는다 ⟹ 안전성 측정불가").toHaveLength(0);
    expect(fired.brand).toHaveLength(1);
    /**
     * 🔴🔴🔴 **그리고 발화한 쌍이 «DIFFERENT 가 아니다» — 내 2차 단언도 틀렸다.**
     *
     * 실측: 발화한 유일한 쌍은 `C27 beaumonde.co.kr` 이고 **human = SAME** 이다.
     * ⟹ 🔴🔴 **이 GT 에서 세 반사실은 DIFFERENT 쌍을 «단 한 번도 건드리지 않는다».**
     *    그러므로 아래 `FP +0` 은 **「leakage 가 없다」가 아니라 「leakage 를 측정할
     *    기회가 0 이었다」** 다. §9 규칙대로 **측정불가** 로 적는다.
     * 🔴 이것이 이 WU 의 가장 중요한 결과다 — §12 가 요구한 「recall 개선 + leakage
     *    없음」을 **같은 분모에서 증명할 수 없다**.
     */
    expect(fired.title[0], "🔴 발화 쌍이 바뀌면 안전성 서술을 다시 써야 한다").toContain("human=SAME");
    expect(fired.brand[0]).toContain("human=SAME");
    const firedDifferent = [...fired.title, ...fired.code, ...fired.brand].filter((s) => s.includes("human=DIFFERENT"));
    expect(firedDifferent, "🔴 DIFFERENT 쌍에서 발화한 반사실이 0 이다 ⟹ leakage 측정불가").toEqual([]);
  });

  it("[STEP 2·3·4] 축별 반사실을 같은 분모에서 비교한다 — leakage 가 기준이다", () => {
    console.log(`\n═══ 축별 반사실 (GT 33쌍 · SAME 17 · DIFFERENT 10 · UNCERTAIN 6) ═══`);
    const tallies = new Map<Mode, ReturnType<typeof same05Tally>>();
    for (const mode of MODES) {
      const t = same05Tally((p) => verdictOf(p, mode), SAME05_PAIRS);
      tallies.set(mode, t);
      console.log(`    ${fmtTally(mode, t)}`);
    }
    const base = tallies.get("baseline")!;
    expect(base.falsePositive).toBe(SAME05_BASELINE.fp);

    console.log(`\n═══ baseline 대비 변화 ═══`);
    for (const mode of MODES.filter((m) => m !== "baseline")) {
      const t = tallies.get(mode)!;
      const dTp = t.truePositive - base.truePositive;
      const dFp = t.falsePositive - base.falsePositive;
      console.log(
        `    ${mode.padEnd(10)} SAME ${dTp >= 0 ? "+" : ""}${dTp} · 🔴 FP ${dFp >= 0 ? "+" : ""}${dFp}` +
          `   ⟹ ${dFp > 0 ? "🔴 **NO-GO**(leakage 발생)" : dTp > 0 ? "🟡 효과 있음 · leakage 0" : "⚪ 이 분모에서 효과 0"}`,
      );
    }

    /**
     * 🔴🔴🔴 **이것이 §12 의 필수 PASS 조건이다** — 「기존 DIFFERENT regression 에서
     *    **새로운** FP 가 발생하지 않을 것」. baseline 이 **2** 이므로 기준은 0 이 아니라 2 다.
     * 🔴 한 축이라도 FP 를 늘리면 **그 축은 NO-GO** 다(WU-164 의 CPO 기준과 같다).
     */
    for (const mode of MODES) {
      const t = tallies.get(mode)!;
      expect(t.falsePositive, `🔴 ${mode} 가 DIFFERENT leakage 를 만들었다 ⟹ 그 축 NO-GO`).toBeLessThanOrEqual(
        base.falsePositive,
      );
    }

    /**
     * 🔴🔴 **필수 안전 케이스(§10)는 모든 축에서 non-SAME 이어야 한다.**
     *    `C19`·`C20` junioredition — **품번 exact + human DIFFERENT**(품번 재사용 실례).
     */
    const guarded = SAME05_PAIRS.filter(
      (p) => p.human === "DIFFERENT" && compareModelCode(p.origin.brandModelCode, p.facts.brandModelCode) === "exact",
    );
    expect(guarded.length, "🔴 필수 안전 케이스가 0 이면 §10 을 지킬 수 없다").toBe(2);
    for (const mode of MODES) {
      for (const p of guarded) {
        expect(
          isSystemSame(verdictOf(p, mode)),
          `🔴🔴 ${mode} 에서 ${p.id}(${p.domain}) 가 SAME 이 됐다 — 품번 재사용 보호가 뚫렸다 ⟹ 구현 금지`,
        ).toBe(false);
      }
    }
  });

  /**
   * 🔴 **P2 normalization 이 충돌 보호를 건드리지 않는다** 를 직접 단언한다.
   *    (값이 있는 후보 코드를 **절대 덮지 않는다** — 그것이 조건 ②다)
   */
  it("[STEP 3 안전] 값이 있는 후보 품번은 덮지 않는다 — 충돌 보호 유지", () => {
    const withCode = SAME05_PAIRS.filter((p) => p.facts.brandModelCode);
    expect(withCode.length).toBeGreaterThan(0);
    for (const p of withCode) {
      expect(
        recoverTruncatedModelCode(p.origin.brandModelCode, p.facts),
        `🔴 ${p.id} 의 품번이 바뀌었다 — AC042↔AC043 보호가 무너진다`,
      ).toBe(p.facts.brandModelCode);
    }
    /** 🟢 복원은 **null 인 후보에서만** 발화한다. */
    const recovered = SAME05_PAIRS.filter(
      (p) => !p.facts.brandModelCode && recoverTruncatedModelCode(p.origin.brandModelCode, p.facts),
    );
    console.log(`\n    🟢 품번 복원이 발화한 쌍 ${recovered.length} → ${recovered.map((p) => p.id).join(" · ") || "없음"}`);
  });

  /** 🔴 음역 표를 **늘려서 결과를 만들지 않았다** 를 계약으로 잠근다. */
  it("[설계 경계] 음역 표가 관측된 토큰 셋뿐이고 brand alias 는 기존 자산이다", () => {
    expect(Object.keys(OBSERVED_TRANSLIT)).toEqual(["허그", "헤어리", "몬스터"]);
    expect(lookupBrandAlias("Bobo Choses"), "🔴 기존 alias 자산을 쓴다").toBe("보보쇼즈");
    expect(BRAND_TRANSLIT["보보쇼즈"]).toBe("bobochoses");
    /** 🔴 모르는 한글 토큰은 그대로 둔다(지어내지 않는다). */
    expect(transliterateTokens(["모르는말"])).toEqual(["모르는말"]);
    expect(transliterateTokens(["허그", "shirt"])).toEqual(["hug", "shirt"]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   효과 분모 — SAME-03 FN 3건 (🔴 DIFFERENT 0 · 라이브)
   ══════════════════════════════════════════════════════════════════════════════ */

describe("CORE-PRICE-SAME-05 — 효과 분모(SAME-03 FN · 🔴 DIFFERENT 0 이라 안전성 측정 불가)", () => {
  it.runIf(LIVE)(
    "FN 3건에 축별 반사실을 적용해 SAME 승격 여부를 본다",
    async () => {
      const { factsFromProductUrl } = await import("@commerce/crawler");
      const { shopifySiteStrategy } = await import("@commerce/crawler/src/site-strategies/shopify.site-strategy");
      const { fetchPlainHtml } = await import("@commerce/crawler/src/shopify-product-json");
      const { extractSiteBrandName } = await import("@commerce/crawler/src/site-brand-name");
      const { buildProductIdentityDna, productFactsFromIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");

      const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
      const ex = await shopifySiteStrategy.extract(ORIGIN);
      let dna = buildProductIdentityDna(buildCanonicalProduct(ORIGIN, ex!.productData as never, {} as never, []));
      if (!dna.brand.value) {
        const html = await fetchPlainHtml(ORIGIN);
        const site = html ? extractSiteBrandName(html) : null;
        if (site?.value) {
          dna = buildProductIdentityDna(
            buildCanonicalProduct(ORIGIN, { ...(ex!.productData as object), siteBrandName: site.value } as never, {} as never, []),
          );
        }
      }
      const origin = productFactsFromIdentityDna(dna);

      const FN = [
        { label: "biskuit.kr", url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/" },
        { label: "m.luxboy.com", url: "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05" },
        { label: "donokids.com", url: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785" },
      ];

      console.log(`\n═══ 효과 분모 — FN 3건 (🔴 이 표본에 DIFFERENT 가 0 이다) ═══`);
      const results: { label: string; modes: Record<string, string> }[] = [];
      for (const c of FN) {
        const r = await factsFromProductUrl(c.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    ${c.label.padEnd(16)} 🔴 ${r.status} — 측정불가`);
          continue;
        }
        /**
         * 🔴🔴 **운영 순서를 빠뜨리면 baseline 이 달라진다 — 1차에 그랬다.**
         *
         * `factsFromProductUrl` 직후의 facts 를 바로 비교했더니 `biskuit` baseline 이
         * `SIMILAR` 로 나왔다. 🔴 그런데 SAME-04 가 운영 순서로 잰 값은 `PRESUMED_SAME`
         * 이다 — 차이는 **`withConfidence` 를 거치지 않은 것** 이다(그 함수가 facts 를
         * 보강한다). 🟢 운영과 같은 순서로 고친다(`core-same04-evidence-trace` 와 동일).
         */
        const { withConfidence } = await import("@commerce/crawler/src/comparison-search/match");
        const [scored] = withConfidence(
          { title: origin.title, brand: origin.brand ?? undefined, sourceUrl: ORIGIN, sku: origin.brandModelCode ?? undefined, facts: origin } as never,
          [r.candidate],
        );
        const liveFacts = scored?.facts ?? r.candidate.facts;
        const p: Same05Pair = { id: c.label, searchId: "LIVE", domain: c.label, url: c.url, human: "SAME", facts: liveFacts, src: "same-03", origin };
        const modes: Record<string, string> = {};
        for (const mode of MODES) modes[mode] = verdictOf(p, mode);
        results.push({ label: c.label, modes });
        console.log(
          `    ${c.label.padEnd(16)} ` +
            MODES.map((m) => `${m}=${modes[m]}`).join(" · ") +
            `   보류(baseline)=${compareCrossSellerProducts(origin, p.facts).blockers.map((b) => b.blocker).join(",") || "-"}`,
        );
      }

      console.log(`\n═══ 축별 SAME 승격 수 (분모 ${results.length}) ═══`);
      for (const mode of MODES) {
        const n = results.filter((r) => isSystemSame(r.modes[mode])).length;
        console.log(`    ${mode.padEnd(10)} SAME ${n} / ${results.length}`);
      }
      console.log(
        `\n🔴 이 표본에는 **DIFFERENT 가 0** 이다 ⟹ 위 숫자는 **recall 쪽만** 이고\n` +
          `   「leakage 없음」을 **이 분모로 말할 수 없다**(§9 측정불가 규칙).`,
      );
      expect(results.length).toBeGreaterThan(0);
    },
    1_800_000,
  );

  it("라이브 축은 환경변수로만 돈다", () => {
    expect(LIVE, LIVE ? "" : "🟡 CORE_SAME05_LIVE=1 이 아니라 효과 분모를 건너뛴다").toBe(LIVE);
  });
});
