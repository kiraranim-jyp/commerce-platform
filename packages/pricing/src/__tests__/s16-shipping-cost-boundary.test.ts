import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computePriceBreakdown } from "../breakdown";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-16 — **국제배송비는 «한 번만» 계산된다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 금지한 구조:
 *
 *     MI 에서 국제배송비 19,800원 반영 → 판매가격 계산
 *        → Commerce 배송 화면에서 19,800원 입력 → «또» 가격에 반영
 *
 * ── 조사 결과: 분리가 «이미» 돼 있다 ──────────────────────────────────────
 * `breakdown.ts` 의 SHIPPING-POLICY-01 ③ 이 네 가지 돈을 이미 갈라 두었다.
 *
 *     ① shippingKrw                 해외 판매처 → 한국. 판매자가 «치르는» 돈.
 *                                   🔴 원가에 «들어간다»(landedCost).
 *     ② SellerProfile.deliveryCharge 국내 구매자에게 «청구하는» 배송비.
 *                                   🔴 원가가 «아니다» — 등록 payload 전용.
 *     ③ 롯데ON·마켓 출고배송비       등록 정보이지 해외물류비가 아니다.
 *     ④ sellerDomesticShippingCostKrw 계산에서 빠졌다(@deprecated).
 *
 * 🔴 그래서 «고치지 않았다». 없는 결함을 만들지 않는다. 대신 이 경계가 나중에
 * 조용히 무너지지 않도록 계약으로 박는다 — 이름이 비슷한 값 넷이 한 파일에
 * 있고, 「배송비니까 원가에 더하자」는 수정이 언제든 들어올 수 있다.
 */

const BREAKDOWN = readFileSync(join(__dirname, "..", "breakdown.ts"), "utf8").replace(/\r\n/g, "\n");

/**
 * 🔴 주석을 걷고 «선언» 만 본다.
 *
 * 이 파일의 설명문이 네 가지 돈을 구분하느라 `SellerProfile.deliveryCharge` 를
 * 예시로 인용한다. 그대로 검사하면 그 «설명» 을 잡는다 — 이 스프린트에서 같은
 * 실수를 다섯 번 했다(C-2B 「롯데ON API 필드명」 · C-2C 「근거 없음」 ·
 * S-8/9 migration 의 4279402 · S-15 옛 라벨 · 여기).
 */
const DECL = BREAKDOWN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("① 원가는 «해외 → 한국» 배송비만 먹는다", () => {
  it("landedCost = 상품원가 + 국제배송비", () => {
    const r = computePriceBreakdown({
      originalAmount: 100,
      originalCurrency: "GBP",
      shippingKrw: 19800,
      feePercent: 10,
      marginPercent: 20,
      rates: { GBP: 1700 },
    });
    /* 🔴 절대 금액을 박지 않는다. 환산·반올림 규칙은 이 테스트의 관심사가
       아니고, 박아 두면 그 규칙이 바뀔 때마다 «경계와 무관한» 이유로 깨진다.
       (처음에 170,000 을 기대했다가 174,000 을 받았다 — 반올림 때문이다.)
       여기서 지키려는 것은 하나다: 착지원가 = 상품원가 + 국제배송비. */
    expect(r.landedCostKrw).toBe(r.costKrw + 19800);
  });

  /* 🔴 국제배송비가 «두 번» 들어가면 착지원가가 그만큼 부풀고, 셀러는 팔리지
     않을 가격을 권장가로 받는다. 한 번만 더해진다는 것을 숫자로 고정한다. */
  it("국제배송비는 «한 번만» 더해진다", () => {
    const base = computePriceBreakdown({
      originalAmount: 100,
      originalCurrency: "GBP",
      shippingKrw: 0,
      feePercent: 10,
      marginPercent: 20,
      rates: { GBP: 1700 },
    });
    const withShipping = computePriceBreakdown({
      originalAmount: 100,
      originalCurrency: "GBP",
      shippingKrw: 19800,
      feePercent: 10,
      marginPercent: 20,
      rates: { GBP: 1700 },
    });
    expect(withShipping.landedCostKrw - base.landedCostKrw).toBe(19800);
  });
});

describe("② 🔴 «고객에게 청구하는» 배송비는 원가가 아니다", () => {
  /* 이름이 비슷한 값이 넷이라 언제든 섞인다. 경계가 코드에 적혀 있는지 본다. */
  it("네 가지 돈의 구분이 문서로 남아 있다", () => {
    expect(BREAKDOWN).toContain("SHIPPING-POLICY-01");
    expect(BREAKDOWN).toContain("원가가 아니다");
  });

  it("입력에 «청구 배송비» 를 받는 칸이 없다 — 들어올 문이 없다", () => {
    const inputBlock = DECL.slice(
      DECL.indexOf("export interface PriceBreakdownInput"),
      DECL.indexOf("export interface PriceBreakdownResult"),
    );
    expect(inputBlock).not.toContain("deliveryCharge");
    expect(inputBlock).not.toContain("customerCharged");
    expect(inputBlock).not.toContain("returnDeliveryCharge");
  });

  /* 🔴 반대 방향도 금지다 — 원가용 국제배송비가 등록 payload 의 배송비로
     나가면 고객이 해외 물류비를 청구받는다. */
  it("계산 결과에 등록 payload 용 배송비 칸이 없다", () => {
    const resultBlock = DECL.slice(DECL.indexOf("export interface PriceBreakdownResult"));
    expect(resultBlock.slice(0, 1200)).not.toContain("deliveryCharge");
  });
});

describe("③ 🔴 Commerce 가 30개가 되어도 이 경계는 하나다", () => {
  /* 채널이 늘어도 「원가에 들어가는 배송비」는 shippingKrw 하나다. 채널별
     배송비 칸이 이 계산에 붙기 시작하면 Commerce 수만큼 원가가 갈라진다. */
  it("계산 입력에 채널 이름이 없다", () => {
    const inputBlock = DECL.slice(
      DECL.indexOf("export interface PriceBreakdownInput"),
      DECL.indexOf("export interface PriceBreakdownResult"),
    );
    for (const channel of ["coupang", "Coupang", "naver", "smartstore", "lotteon", "LotteOn"]) {
      expect(inputBlock, channel).not.toContain(channel);
    }
  });
});
