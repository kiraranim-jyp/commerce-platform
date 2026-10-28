import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-SYNC-01 §6·§7 — **국내 참고가격 블록의 의미 충돌 제거**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 캡처가 한 블록에 이것을 같이 뒀다:
 * ```
 * 국내 참고가격 ₩88,000
 * 동일상품으로 확정된 국내 판매처는 없습니다.
 * 국내 판매처의 상세 페이지에서 확인한 가격입니다 …
 * 이번 확인에만 쓰이고 저장되지 않습니다 — 새로고침하면 사라집니다.
 * ```
 *
 * 🔴🔴 **1차에 내가 owner 를 틀렸고 정정한다.** 이 블록 숫자는
 *    `candidateDomesticPrice`(**일시 후보 집계** · tier `EXACT|COMPARISON`)다 —
 *    `domesticCompetition.lowestPriceKrw`(← `price_observations` · **영속**)가 아니다.
 *    ⟹ 🟢 그래서 `scope`(「저장되지 않습니다」)는 이 블록에서 **참** 이고 **되돌려 놨다**.
 *
 * 🔴 남은 진짜 모순은 **하나** — 「국내 판매처는 **없습니다**」가 가격 숫자 옆에 있었다.
 *    🟢 **부정문을 안 쓰는 짧은 라벨**(`DOMESTIC_REFERENCE_BASIS`)로 **교체** 했다.
 *
 * ── 🔴 교체 계약엔 **보존 단언을 같이** 둔다 ──────────────────────────────
 * 「없다」만 적으면 다음 사람이 **근거까지** 지운다(메모 그 함정).
 * 그래서 아래 B 군이 **숫자·집계·해외 축·상수·상세 근거가 살아 있다** 를 같이 단언한다.
 */

const DIR = join(__dirname, "..");
const MPC = stripComments(readFileSync(join(DIR, "MarketPriceComparison.tsx"), "utf8").replace(/\r\n/g, "\n"));
const REF = readFileSync(join(DIR, "overseas-reference.ts"), "utf8").replace(/\r\n/g, "\n");

/** 🟢 🇰🇷 분기만 잘라낸다 — 해외 분기를 같이 보면 단언이 뭉개진다. */
function domesticBranch(): string {
  const at = MPC.indexOf('market === "KR"');
  expect(at, "🇰🇷 분기를 찾지 못했다 — 구조가 바뀌었다").toBeGreaterThan(0);
  const end = MPC.indexOf("showTierNote: false,", MPC.indexOf(": {", at));
  return MPC.slice(at, end > at ? end + 40 : at + 1200);
}

describe("CANDIDATE-SYNC-01 A — 🇰🇷 블록에서 **문장이 빠졌다**", () => {
  it("A-1 🔴 「동일상품으로 확정된 국내 판매처는 없습니다」를 **가격 옆에 두지 않는다**", () => {
    expect(
      domesticBranch(),
      "의미 충돌 문장이 되돌아왔다 — 가격 숫자와 다른 축이 한 블록에 선다",
    ).not.toContain("DOMESTIC_SAME_NOT_CONFIRMED");
  });

  it("A-2 🟢 **부정문 대신 짧은 근거 라벨** 이 선다", () => {
    expect(domesticBranch()).toContain("statusLine: DOMESTIC_REFERENCE_BASIS");
    expect(REF).toContain('DOMESTIC_REFERENCE_BASIS = "국내 가격 참고값"');
    /** 🔴 라벨에 **부정문/판정 어휘** 가 들어가면 같은 모순이 되돌아온다. */
    for (const w of ["없습니다", "아닙니다", "확정", "SAME"]) {
      expect(
        "국내 가격 참고값",
        `라벨에 ${w} 가 들어갔다 — 가격 축과 판정 축이 또 섞인다`,
      ).not.toContain(w);
    }
  });

  /**
   * 🔴🔴 **1차에 내가 틀린 자리를 계약으로 남긴다.** 이 블록 숫자는 일시 후보 집계이고
   *    영속 관측이 아니다 ⟹ `scope`(「저장되지 않습니다」)는 **참** 이므로 **남아야** 한다.
   *    그것을 「거짓이다」라고 판단해 뺐던 것이 내 오류였다.
   */
  it("A-3 🟢 상세의 근거 문장 둘은 **남아 있다**(장문 제거는 1차 한정 · §7)", () => {
    const b = domesticBranch();
    expect(b, "근거 문장을 지웠다 — §7 은 «기본 화면에서» 제거다").toContain("note: DOMESTIC_REFERENCE_NOTE");
    expect(b).toContain("scope: DOMESTIC_REFERENCE_SCOPE");
  });
});

describe("CANDIDATE-SYNC-01 B — **보존**(지운 것이 문장뿐이다)", () => {
  it("B-1 🟢 가격 숫자와 집계 배선은 그대로다", () => {
    const b = domesticBranch();
    expect(b).toContain("DOMESTIC_REFERENCE_TITLE");
    expect(b, "금액 testid 가 사라졌다 — 숫자가 화면에서 빠진다").toContain('amountTestId: "domestic-lowest"');
    expect(b).toContain('testId: "domestic-reference"');
    /** 🔴 「확인 N곳」 라벨(CORE-2T)은 숫자 축이라 **남는다**. */
    expect(b).toContain("DOMESTIC_SELLER_COUNT_LABEL");
  });

  it("B-2 🟢 상수 자체를 **지우지 않았다** — 다른 호출부/해외 축이 쓴다", () => {
    for (const k of ["DOMESTIC_REFERENCE_NOTE", "DOMESTIC_REFERENCE_SCOPE", "DOMESTIC_SAME_NOT_CONFIRMED"]) {
      expect(REF, `${k} 상수를 지웠다 — 제거가 아니라 삭제가 됐다`).toContain(`export const ${k}`);
    }
  });

  it("B-3 🟢 **해외 축은 건드리지 않았다**", () => {
    expect(MPC).toContain("OverseasReferencePrice");
    expect(MPC, "해외 집계 배선이 사라졌다").toContain('testId="mi-same-overseas"');
  });

  /**
   * 🔴 같은 사실(동일상품 확정 0)을 말하는 **숫자 줄** 은 남아 있어야 한다 —
   *    문장을 뺐다고 그 사실까지 사라지면 셀러가 근거를 잃는다(CORE-UX-SELLER-02).
   */
  it("B-4 🔴 「동일상품 확인 N곳」 **숫자 줄** 은 살아 있다", () => {
    expect(MPC, "동일상품 확인 건수 줄이 사라졌다").toContain("SAME_CONFIRMED_COUNT_LABEL");
  });
});
