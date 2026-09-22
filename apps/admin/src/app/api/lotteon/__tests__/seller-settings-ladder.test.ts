import { describe, expect, it } from "vitest";
import { resolveLotteOnSellerFixedValue } from "../_lib/seller-settings";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-02 §3~§5(CEO 확정, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 「한 번 설정할 값은 Settings 에서 한 번, 상품마다 달라지는 값은 Product Info
 *   에서 한 번」 — 그 경계가 실제로 지켜지는가를 여기서 고정한다.
 *
 * 왜 필요했나. 롯데ON 등록을 막는 필드 중 여섯 개(출고지·반품지·배송비정책·
 * 배송가능지역·평일/토요일 발송마감)가 판매자 고정값인데 저장할 곳이 없어서
 * **상품별 폼에만** 살았다. 기존 완화책 autoPick 은 후보가 «정확히 하나» 일 때만
 * 동작한다 — 출고지가 두 곳인 판매자에게는 아무 도움이 안 됐고, 매 상품마다
 * 다시 골라야 했다.
 *
 * 🔴 여기서 고정하는 것은 «순서» 다. 뒤집히면 「이 상품에서만 다른 출고지를
 *    골랐다」는 셀러의 결정이 설정에 덮인다 — 엉뚱한 곳에서 물건이 나간다.
 */
describe("판매자 고정값 사다리 — 상품이 먼저, 설정은 빈 자리에만", () => {
  it("🔴 상품 폼에 값이 있으면 «설정이 있어도» 상품 값을 쓴다", () => {
    const r = resolveLotteOnSellerFixedValue("99999", "12345");
    expect(r.value).toBe("99999");
    expect(r.source).toBe("PRODUCT");
  });

  it("상품 폼이 비면 설정값이 들어온다 — 이것이 «재입력 제거» 다", () => {
    const r = resolveLotteOnSellerFixedValue("", "12345");
    expect(r.value).toBe("12345");
    expect(r.source).toBe("SELLER_SETTING");
  });

  it.each([[undefined], [null], [""], ["   "]])("빈 폼 표현(%s)은 전부 설정으로 넘어간다", (formValue) => {
    expect(resolveLotteOnSellerFixedValue(formValue as never, "12345").source).toBe("SELLER_SETTING");
  });

  it("🔴 둘 다 없으면 «없다» 고 말한다 — 값을 지어내지 않는다", () => {
    const r = resolveLotteOnSellerFixedValue(null, null);
    expect(r.value).toBeNull();
    expect(r.source).toBe("NONE");
  });

  it("설정이 빈 문자열이어도 «없음» 이다(저장소가 빈 값을 흘려도 막는다)", () => {
    expect(resolveLotteOnSellerFixedValue(null, "   ").source).toBe("NONE");
  });

  it("앞뒤 공백은 다듬어 내보낸다 — 번호에 공백이 붙어 나가면 롯데ON이 거부한다", () => {
    expect(resolveLotteOnSellerFixedValue("  777  ", null).value).toBe("777");
    expect(resolveLotteOnSellerFixedValue(null, "  888  ").value).toBe("888");
  });

  it("🔴 출처를 «이름으로» 돌려준다 — 화면이 「설정값 적용됨」을 말할 근거다", () => {
    expect(resolveLotteOnSellerFixedValue(null, "12345").source).toBe("SELLER_SETTING");
    expect(resolveLotteOnSellerFixedValue("12345", null).source).toBe("PRODUCT");
  });
});
