import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PRICE-ELIGIBILITY-AUDIT-01A — **「금액이 있다」 ≠ 「가격 축에 들어간다」**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 내 보고의 숫자 모순을 잡았다**: `19/19 → 20/20` 과 「가격/MI 변화 0」이
 *    같이 적혀 있었다. 원인은 하니스에 **두 축을 가를 칸이 없었던 것** 이다.
 *
 * 🟢 실측(새 Search 0 · 운영 코드 0):
 * ```
 * SAME/PRESUMED 20 · priceAmountPresent 20 · 🔴 **priceEligible 18**
 *
 * blocker                       전체 hSAME hDIFF  금액  가격자격
 * (blocker 없음)                   12    12     0    12       12
 * AUDIENCE_LINE                    8     8     0     8        4   🟡 누출 0 인데 절반 차단
 * MODEL_CODE_AGE_LINE              4     3     1     4        0   🔴 전부 차단
 * NO_TITLE_OVERLAP                 2     1     1     2        2   🔴 누출 1 이 여기서 온다
 * SAME_SELLER_DISTINCT_LISTING     2     2     0     2        0
 * BRAND_MISMATCH                   1     1     0     1        1
 * ```
 *
 * 🔴🔴🔴 **그래서 이 WU 의 가장 중요한 산출은 반증이다** — **blocker 는 가격 자격의
 *    결정자가 아니다.** 같은 blocker 안에서 자격이 갈린다(`AUDIENCE_LINE` 8 → 4).
 *    결정하는 것은 `matchTruth`(→ `priceTierFromLink`)이고 blocker 는 그 입력이 아니다.
 *    ⟹ 「blocker 별로 가격을 허용/제외한다」는 정책은 **이 데이터에서 성립하지 않는다**.
 *
 * 🔴 정책 변경 **0** — 이 파일은 현재 owner 의 성질을 고정하고 두 축의 분리를 잠근다.
 */

const HARNESS = readFileSync(join(__dirname, "dif-02-identity-funnel.test.ts"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`. */
const CODE = HARNESS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

describe("PE-01A P1/P2 — 가격 자격의 owner 와 두 축의 분리", () => {
  /**
   * 🔴🔴 P1 — **금액이 있어도 `tier = EXCLUDED` 면 가격 축에 들어가지 않는다.**
   *    그 둘을 같은 숫자로 보고하면 「가격이 늘었다」는 거짓이 된다.
   */
  it("P1 🔴 `EXCLUDED` 는 가격 자격이 **아니다**", () => {
    const eligible = (t: string) => t === "EXACT" || t === "COMPARISON";
    expect(eligible("EXCLUDED")).toBe(false);
    expect(eligible(priceTierFromLink({ matchTruth: "CONFLICT", verified: false }))).toBe(false);
    /** 🟢 반대로 식별자 확정·텍스트 확정은 자격이 있다(기존 동작 불변). */
    expect(eligible(priceTierFromLink({ matchTruth: "EXACT_IDENTIFIER", verified: true }))).toBe(true);
    expect(eligible(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false }))).toBe(true);
  });

  /**
   * 🔴🔴 P2 — 하니스가 **운영 owner 의 값을 그대로 적는다.** 재계산하면 운영과
   *    어긋나고, 그 숫자로 정책을 정하면 틀린 정책이 나온다(이 트랙의 반복 교훈).
   */
  it("P2 🔴 하니스는 `judgeDomesticCandidate` 산출을 **그대로** 기록한다(재계산 0)", () => {
    expect(CODE).toContain("tier: j.kind === \"JUDGED\" && isBest ? j.priceTier : null");
    expect(CODE).toContain("matchTruth: j.kind === \"JUDGED\" && isBest ? j.matchTruth : null");
    /** 🔴 하니스가 tier 를 **스스로 만들지 않는다**. */
    expect(CODE, "🔴 하니스가 tier 를 재계산한다 — 운영과 어긋난다").not.toContain("priceTierFromLink(");
    /** 🔴 샵 대표가 아니면 **null** 이다 — 운영도 그 행의 tier 를 만들지 않는다. */
    expect(CODE).toContain("isBest ?");
  });

  /** 🟢 두 축이 **다른 이름** 으로 보고된다 — 같은 줄에 뭉개지지 않는다. */
  it("P2-b 🟢 보고가 `priceAmountPresent` 와 `priceEligible` 을 **가른다**", () => {
    expect(CODE).toContain("priceAmountPresent");
    /**
     * 🔴🔴 **변이 N5 가 이 단언을 뚫었다** — 파일 어딘가에 `r.priceEligible` 이 있으면
     *    통과했고, 정작 **보고 줄** 은 `price != null` 로 바뀌어 두 축이 뭉개졌다.
     * 🟢 그래서 **그 줄의 범위를 잘라** 단언한다.
     */
    const at = CODE.indexOf("const eligible =");
    expect(at, "가격 자격 집계 줄이 사라졌다").toBeGreaterThan(-1);
    const line = CODE.slice(at, CODE.indexOf(";", at));
    expect(line, "🔴 가격 자격을 «금액 존재» 로 바꿔치기했다").toContain("priceEligible");
    expect(line, "🔴 금액 존재를 가격 자격으로 쓰고 있다").not.toContain("price != null");
    /**
     * 🔴🔴 **변이 N6 가 이 단언을 또 뚫었다** — `|| r.tier === "EXCLUDED"` 를 더해도
     *    `priceEligible` 이 그 줄에 남아 있어 통과했다.
     * 🟢 그래서 **자격 줄에 `EXCLUDED` 가 등장하는 것 자체** 를 막는다 —
     *    「가격 축에 들어가지 않는다」의 반대말이 그 줄에 있으면 자격이 뒤집힌 것이다.
     */
    expect(line, "🔴 EXCLUDED 를 가격 자격으로 세고 있다").not.toContain("EXCLUDED");
  });
});

describe("PE-01A P3~P6 — 보호가 가격 축에서도 유지된다", () => {
  /**
   * 🔴 P3 — `MODEL_CODE_AGE_LINE` 후보는 **가격 자격 0** 이다(실측 4/4).
   *    Identity 로는 살렸지만 가격은 막혀 있다 — 그 경계가 AGE-LINE-POLICY-01 의 설계다.
   * 🟢 그 사실은 `matchTruth = CONFLICT` 에서 나온다(품번 충돌이 conflicts 에 남아 있다).
   */
  it("P3 🔴 품번 충돌이 남아 있으면 tier 는 `EXCLUDED` 다", () => {
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
    /** 🔴 `verified` 로 뒤집히지 않는다 — matchTruth 가 먼저다. */
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: true })).toBe("EXCLUDED");
  });

  /** 🔴 P4 — CONFLICT 는 어느 축에서 와도 가격 축에 들어가지 않는다. */
  it("P4 🔴 CONFLICT 는 가격 축으로 들어가지 않는다", () => {
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
  });

  /**
   * 🟢 P5 — **세트 상품 보호가 가격 축에서도 유지된다**(실측 `bornyesterdaykids`).
   *    그 후보는 verdict 가 `CONFLICT` 라 **SAME/PRESUMED 분모에 아예 없다** ⟹
   *    blocker 표에 `COMPOSITION` 행이 **없는 것이 정상** 이고 가격 유입은 **0** 이다.
   * 🔴 그래서 「표에 없다」를 「측정 안 했다」로 읽지 않는다.
   */
  it("P5 🟢 세트(COMPOSITION) 후보는 SAME/PRESUMED 분모에 들어가지 않는다", () => {
    /** 🔴 분모 술어가 바뀌면 이 보호가 조용히 사라진다 — 그 술어를 잠근다. */
    expect(CODE).toContain('x.verdict === "SAME" || x.verdict === "PRESUMED_SAME"');
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
  });

  /**
   * 🔴🔴 P6 — **`NO_TITLE_OVERLAP` 은 가격 자격이 있다**(실측 2/2) 그리고 그 안에
   *    **Human DIFFERENT 1건**(`m.luxboy` ₩59,000)이 있다 ⟹ 누출 1건의 출처가 그것이다.
   * 🔴 그러나 **같은 blocker 의 다른 1건은 Human SAME** 이라 precision 1/2 다 ⟹
   *    blocker 단위로 끊으면 정답도 같이 버린다(CPO §0 의 그 순손실).
   * 🟢 이 계약은 현재 동작을 고정한다 — 정책이 바뀌면 FAIL 로 뒤집힌다.
   */
  it("P6 🔴 `TEXT_CONFIRMED`(보류)는 **현재** 가격 자격이 있다 — 그래서 누출이 가능하다", () => {
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false })).toBe("COMPARISON");
    /** 🔴 blocker 를 보지 않는다 — 그것이 이 WU 가 확인한 사실이다. */
    const src = readFileSync(
      join(__dirname, "../../../domestic-price-sources/_lib/domestic-product-link.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const at = src.indexOf("export function priceTierFromLink");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n}", at)).replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(body, "🔴 가격 자격이 blocker 를 보기 시작했다 — 정책이 바뀐 것이다").not.toContain("blocker");
  });
});
