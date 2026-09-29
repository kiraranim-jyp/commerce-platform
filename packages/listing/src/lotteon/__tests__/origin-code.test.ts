import { describe, expect, it } from "vitest";
import { autoPickLotteOnOriginCode } from "../origin-code";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-02 P0 — 원산지 자동 매핑의 «안전 조건»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 「맞추는가」보다 **「틀리게 고르지 않는가」** 다.
 * 첫 LIVE 등록이 거절된 이유가 코드 자리에 코드가 아닌 것을 보낸 것이었다
 * (`"oplcCd": "OPLC_CD"`). 여기서 한 번 잘못 고르면 그때와 같은 일이 된다.
 */

/** 롯데ON 목록의 모양 그대로(실제 239건 중 일부). */
const ITEMS = [
  { code: "KR", name: "대한민국" },
  { code: "ES", name: "스페인" },
  { code: "FR", name: "프랑스" },
  { code: "CN", name: "중국" },
];

describe("① 맞출 수 있으면 맞춘다", () => {
  it("한국어 원산지는 그대로 맞는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "스페인")?.code).toBe("ES");
  });

  it("🔴 영문 원산지도 맞는다 — 상품 원문이 «Spain» 인 경우가 실제로 있다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "Spain")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "  spain  ")?.code).toBe("ES");
  });

  it("앞뒤/연속 공백은 무시한다 — 값을 «바꾸지» 는 않는다", () => {
    expect(autoPickLotteOnOriginCode([{ code: "X", name: " 프랑스 " }], "프랑스")?.code).toBe("X");
  });
});

describe("🔴🔴 ② 틀리게 고르느니 «고르지 않는다»", () => {
  it("목록에 없으면 null — 국가코드를 지어내지 않는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "안도라")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "Andorra")).toBeNull();
  });

  it("🔴 부분일치로 잡지 않는다 — 「스페인」이 「스페인령…」을 집으면 안 된다", () => {
    const tricky = [{ code: "ZZ", name: "스페인령 카나리아제도" }];
    expect(autoPickLotteOnOriginCode(tricky, "스페인")).toBeNull();
  });

  it("🔴 같은 이름이 여럿이면 고르지 않는다 — 배송지 autoPick 과 같은 규칙", () => {
    const dup = [
      { code: "A1", name: "스페인" },
      { code: "A2", name: "스페인" },
    ];
    expect(autoPickLotteOnOriginCode(dup, "스페인")).toBeNull();
  });

  it("빈 원산지·빈 목록은 null 이다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "   ")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, null)).toBeNull();
    expect(autoPickLotteOnOriginCode([], "스페인")).toBeNull();
  });

  it("🔴 코드 자체를 원산지 텍스트로 준 경우에도 이름으로만 본다", () => {
    /* 「ES」 는 이름이 아니다. 코드로 역매칭하면 셀러가 적은 엉뚱한 문자열이
       코드로 승격된다 — 그 길을 열지 않는다. */
    expect(autoPickLotteOnOriginCode(ITEMS, "ES")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "OPLC_CD")).toBeNull();
  });
});

/* ══ LOTTEON-FINAL-03 A — 🔴 Production 이 «여기서» 끊겼다 ═══════════════════
   순수 함수도 DOM 도 PASS 였는데 실제 상품에서 원산지가 비었다. 테스트가 전부
   `"스페인"` 같은 «깨끗한 국가명» 만 먹였기 때문이다. 실제 원문은 문장이다. */
describe("🔴 ③ 실제 원문은 «문장» 으로 온다", () => {
  it("Made in Spain 을 맞춘다 — 실제 상품 페이지의 표기다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "Made in Spain")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "MADE IN SPAIN")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "Made in Spain.")?.code).toBe("ES");
  });

  it("한국어 라벨도 벗긴다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "원산지: 스페인")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "제조국 스페인")?.code).toBe("ES");
  });

  it("🔴 라벨을 벗겨도 «정확 일치» 다 — 나라 이름을 추측하지 않는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "Made in Spain and Portugal")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "Made in Andorra")).toBeNull();
  });

  it("🔴 목록에 원문 표기가 «그대로» 있으면 그것이 이긴다", () => {
    const listed = [{ code: "ZZ", name: "Made in Spain" }, { code: "ES", name: "스페인" }];
    expect(autoPickLotteOnOriginCode(listed, "Made in Spain")?.code).toBe("ZZ");
  });
});

/* ══ LOTTEON-FINAL-04 ③ — 실제 원문 형태 회귀 ══════════════════════════════
   🔴 이 저장소가 두 번 같은 함정에 걸렸다: fixture 를 «깨끗한 값» 으로 만들면
   Production 이 주는 «지저분한 값» 을 못 잡는다. 실제로 본 표기만 넣는다. */
describe("🔴 ④ 모호하면 «고르지 않는다» — 복수 국가 표기", () => {
  it.each([
    ["Made in Spain and Portugal", "and 로 이어진 둘"],
    ["Made in Spain, Portugal", "쉼표로 이어진 둘"],
    ["Spain / Portugal", "슬래시로 이어진 둘"],
    ["스페인, 프랑스", "한국어 복수"],
    ["원산지: 스페인 또는 프랑스", "라벨 + 한국어 복수"],
  ])("%s → null (%s)", (text) => {
    expect(autoPickLotteOnOriginCode(ITEMS, text)).toBeNull();
  });

  it("🔴 복수 표기에서 «앞의 것» 을 집지 않는다 — 그게 가장 그럴듯한 오답이다", () => {
    for (const text of ["Made in Spain and Portugal", "Spain / Portugal", "스페인, 프랑스"]) {
      const picked = autoPickLotteOnOriginCode(ITEMS, text);
      expect(picked, `${text} 에서 무언가를 골랐다`).toBeNull();
    }
  });

  it("단일 국가에 꼬리 기호만 붙은 것은 «맞춘다» — 복수와 혼동하지 않는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "Made in Spain.")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "스페인,")?.code).toBe("ES");
  });
});

/* ══ LOTTEON-FINAL-05 — 🔴 «임의의 제한 목록» 이 사라졌다 ═══════════════════
   예전에는 손으로 적은 19개국 표만 영문을 알아들었다. 즉 «우리가» 지원 국가를
   정하고 있었다. 이제 ISO-3166 전체를 플랫폼 데이터로 읽는다 —
   지원 범위를 정하는 것은 롯데ON 이 준 목록 하나다. */
describe("🔴 ⑤ 지원 국가를 «우리가» 정하지 않는다", () => {
  const WIDE = [
    { code: "MA", name: "모로코" },
    { code: "PE", name: "페루" },
    { code: "NZ", name: "뉴질랜드" },
    { code: "ES", name: "스페인" },
  ];

  it.each([
    ["Morocco", "MA"],
    ["Peru", "PE"],
    ["New Zealand", "NZ"],
    ["Made in Morocco", "MA"],
  ])("%s → %s — 옛 19개국 표에 «없던» 나라다", (text, code) => {
    expect(autoPickLotteOnOriginCode(WIDE, text)?.code).toBe(code);
  });

  it("🔴 그래도 고르는 것은 «롯데ON 목록 안» 의 코드다 — 목록에 없으면 null", () => {
    /* 모로코를 알아들어도, 목록에 없으면 코드를 만들어 내지 않는다. */
    expect(autoPickLotteOnOriginCode([{ code: "ES", name: "스페인" }], "Morocco")).toBeNull();
  });
});
