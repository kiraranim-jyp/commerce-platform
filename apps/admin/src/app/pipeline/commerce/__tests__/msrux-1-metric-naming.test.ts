/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 A — **지표 이름이 «센 것» 을 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 화면의 두 숫자가 무엇을 센 것인지 말하지 않았다(CPO 지적):
 * ```
 * 「KRW 88,000  확인 1곳」        ← 무엇을 확인했다는 것인가
 * 「동일상품 확인 0곳」            ← 「확인해 봤다」로도 읽혀 0 의 뜻이 흐리다
 * ```
 * 🟢 그래서 **이름만** 바꿨다 — 분모·집계·자격·판정은 **한 글자도** 바뀌지 않는다.
 *
 * 🔴🔴 그리고 이름을 바꾸다 **거짓 이름 하나를 더 찾았다**(F-③):
 * ```
 * 집계기 `candidate-market` 의 `count` 는 시장마다 «다른 것» 을 센다
 *   sellerKey 있음(국내) → **판매처 수**(판매처 단위로 접은 뒤)
 *   sellerKey 없음(해외) → **레코드 수**
 * 그런데 해외 라벨이 「판매처 N곳」 이었다 ⟹ 같은 판매처의 리스팅 둘이 「2곳」이 된다
 * ```
 * 🟢 해외는 「반영 가격 N건」 — 세는 **단위** 를 이름에 담는다.
 * 🔴 두 지표를 합치거나 같은 분모로 만들지 않는다(CPO A 명시).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverseasReferencePrice } from "../OverseasReferencePrice";
import {
  DOMESTIC_SELLER_COUNT_LABEL,
  OVERSEAS_SELLER_COUNT_LABEL,
  buildOverseasReference,
} from "../overseas-reference";
import { SAME_CONFIRMED_COUNT_LABEL, marketEmptyNote } from "../mi-same-candidates";

/** 🔴 **글자로** 단언한다 — 상수를 import 해 비교하면 동어반복이다(메모 그 함정). */
describe("MSRUX-1 A — 지표 명칭", () => {
  it("A-1 🔴 국내는 「반영 판매처」 · 해외는 「반영 가격」 — 서로 다른 지표다", () => {
    expect(DOMESTIC_SELLER_COUNT_LABEL).toBe("반영 판매처");
    expect(OVERSEAS_SELLER_COUNT_LABEL).toBe("반영 가격");
    expect(SAME_CONFIRMED_COUNT_LABEL).toBe("동일상품 확정");
  });

  it("A-2 🔴 「확인 N곳」·「동일상품 확인 N곳」은 더 이상 쓰지 않는다", () => {
    const note = marketEmptyNote(0, { count: 0, reasons: [] });
    expect(note).toContain("동일상품 확정 0곳");
    expect(note, "🔴 옛 어휘가 남아 있다").not.toContain("동일상품 확인 0곳");
  });

  /**
   * 🔴🔴 **이 조합이 실제로 났다** — 1차 구현이 라벨과 단위를 «각각» 받아
   *    기존 계약(`wu-056`)이 「반영 판매처 3**건**」을 내며 FAIL 했다.
   * 🟢 이제 라벨이 단위를 결정한다(`COUNT_UNIT_BY_LABEL`).
   */
  it("A-3 🔴🔴 라벨과 단위의 짝이 어긋나지 않는다 — 「반영 판매처 N건」이 불가능하다", () => {
    const summary = {
      count: 3,
      byCurrency: { KRW: { count: 3, lowestAmount: 88_000, highestAmount: 88_000 } },
      byMarket: { KR: 3 },
      byPriceTier: { COMPARISON: 3 },
      unverifiedCount: 0,
      observedDifferenceCount: 0,
      lowestKrw: null,
    };
    /** 🔴 국내 — 라벨만 넘긴다(운영 호출부와 같은 모양). */
    const kr = buildOverseasReference(summary, { sellerCountLabel: DOMESTIC_SELLER_COUNT_LABEL });
    expect(kr?.lines[0]?.scope).toBe("반영 판매처 3곳");
    /** 🔴 해외 — 아무것도 안 넘긴다(기본값). */
    const os = buildOverseasReference(summary);
    expect(os?.lines[0]?.scope).toBe("반영 가격 3건");
    /** 🔴 어느 조합에서도 「판매처 … 건」·「가격 … 곳」이 나오지 않는다. */
    for (const scope of [kr?.lines[0]?.scope ?? "", os?.lines[0]?.scope ?? ""]) {
      expect(scope).not.toMatch(/판매처 \d+건/);
      expect(scope).not.toMatch(/가격 \d+곳/);
    }
  });

  it("A-4 🟢 화면에도 그 말이 그대로 선다(마운트 DOM)", () => {
    const html = renderToStaticMarkup(
      OverseasReferencePrice({
        summary: {
          count: 1,
          byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
          byMarket: { KR: 1 },
          byPriceTier: { COMPARISON: 1 },
          unverifiedCount: 0,
          observedDifferenceCount: 0,
          lowestKrw: null,
        },
        sellerCountLabel: DOMESTIC_SELLER_COUNT_LABEL,
      } as never) as never,
    );
    expect(html).toContain("반영 판매처 1곳");
    expect(html, "🔴 옛 어휘가 화면에 남아 있다").not.toContain(">확인 1곳<");
  });
});
