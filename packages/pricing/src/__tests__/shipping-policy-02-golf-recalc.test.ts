import { describe, expect, it } from "vitest";
import { computeGolfLandedCost } from "../golf-landed-cost";
import { EMS_JAPAN_TO_KOREA_BRACKETS } from "../parcel-weight";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHIPPING-POLICY-02 ④ — 골프 실측 «재계산 기반» (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO §13: "새 배송비로 기존 골프 실측을 «재계산할 수 있는 기반»을 만든다."
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * f4f1565 가 EMS 표를 다섯 칸에서 스물두 칸으로 채웠다. 그 전에 나온 GOLF-02 ·
 * GOLF-03 의 숫자는 «2kg 요금 ¥3,400» 위에 서 있었다. 이 파일은 그 두 표를
 * 나란히 놓고 «무엇이 얼마나 움직였는가»를 계산으로 고정한다. 그래서
 * 아래 OLD_BRACKETS 가 있다 — 되살리려는 것이 아니라 «기존 값»을 재현해서
 * 차이를 잴 기준선으로만 쓴다.
 *
 * 🔴 새 계산기가 아니다. computeGolfLandedCost 를 그대로 부른다.
 * 🔴 새 실측값을 만들지 않았다. 아래 숫자는 전부 golf02/golf03 이 이미 들고 있는
 *    2026-09-16 실측 그대로다(같은 출처 주석을 그대로 옮겼다).
 *
 * ── 🔴 이 파일이 «하지 않는» 일 — CEO §12·§13 ────────────────────────────
 * **골프의 판매 가능 여부를 확정하지 않는다.** 여기에는 verdict 도, «후보다/
 * 아니다» 도 없다. 배송비가 절반 이하로 내려갔다는 사실이 판정을 뒤집는지는
 * 이 파일이 답할 질문이 아니다 — 답하려면 아직 없는 축(배송수단 · 실제 배대지
 * 요금 · 조달 가능성)이 필요하고, 그 축이 없는 채로 내린 판정은 f4f1565 가
 * 지운 그 착시와 같은 종류다. 판정이 필요한 곳은 golf02/golf03 이고, 이 파일은
 * 그 두 파일이 다시 계산될 때 쓸 «기준선»만 제공한다.
 */

/** Frankfurter(ECB) 2026-09-15. golf02/golf03 과 같은 상수 — 세 파일의 숫자가 같아야 한다. */
const RATES_2026_09_15 = { JPY: 1568.32 / 178.86 } as const;

/** 골프공 1개 최대 중량 45.93g(R&A/USGA) × 12. 포장 미포함 «하한». */
const DOZEN_BALL_MIN_WEIGHT_KG = 0.55116;

/**
 * 🔴 f4f1565 **이전**의 다섯 칸 표. 되살리는 값이 아니라 «기존 배송비»를
 * 재현하기 위한 기준선이다. 2kg 미만 칸이 아예 없어서 0.06kg 장갑도 0.551kg
 * 골프공도 전부 2kg 요금 ¥3,400 이 붙었다 — 그것이 이 표의 사실이다.
 */
const OLD_BRACKETS: readonly { uptoKg: number; jpy: number }[] = [
  { uptoKg: 2, jpy: 3400 },
  { uptoKg: 3, jpy: 4400 },
  { uptoKg: 5, jpy: 6400 },
  { uptoKg: 7, jpy: 8200 },
  { uptoKg: 10, jpy: 10600 },
] as const;

function oldShippingKrw(chargeableWeightKg: number): number | null {
  const bracket = OLD_BRACKETS.find((b) => chargeableWeightKg <= b.uptoKg);
  return bracket ? Math.round(bracket.jpy * RATES_2026_09_15.JPY) : null;
}

/**
 * 해외 조달가 한 칸. 🔴 «관측 최저»와 «조달 가능 최저»를 구분해서 들고 다닌다
 * (CEO §13). 가격비교 사이트의 최저가는 그 값으로 실제로 살 수 있다는 뜻이
 * 아니다 — 재고·해외배송 가부·판매처 신뢰도가 확인되지 않았다.
 */
interface OverseasPrice {
  jpy: number;
  /** false = 관측만 됐다(가격비교 최저가). true = 그 판매처에서 실제로 조달 가능하다. */
  procurable: boolean;
  source: string;
}

interface RecalcRow {
  label: string;
  /** 해외① 가격비교 최저가(kakaku.com). 없으면 null. */
  observedLowest: OverseasPrice | null;
  /** 해외③ 공식 브랜드몰 — 조달 가능 최저. 없으면 null. */
  procurableLowest: OverseasPrice | null;
  /** 국내① 다나와 최저가 + 그 판매처 배송비. */
  domesticDanawaKrw: number;
  domesticDanawaShippingKrw: number;
  /** 국내② 실제 판매처(공식몰/전문몰). 🔴 국내①과 뭉개지 않는다. */
  domesticRetailKrw: number | null;
  /** 「고객직접선택」처럼 금액이 없으면 null — 0 으로 적지 않는다. */
  domesticRetailShippingKrw: number | null;
  actualWeightKg: number;
}

/** 2026-09-16 실측. golf02/golf03 의 출처 주석 그대로다. */
const ROWS: RecalcRow[] = [
  {
    label: "스릭슨 Z-STAR 9 (2025년형) 화이트 1더즌",
    observedLowest: { jpy: 4950, procurable: false, source: "kakaku K0001668395" },
    procurableLowest: { jpy: 6930, procurable: true, source: "dunlop d-sports item/10360217" },
    domesticDanawaKrw: 36432,
    domesticDanawaShippingKrw: 3500,
    domesticRetailKrw: 59000, // dunlopsportskorea /product/z-star9/9517/
    domesticRetailShippingKrw: null, // ⚪ 「배송 비용 : 고객직접선택」 — 0 이 아니라 모른다
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    label: "스릭슨 Z-STAR 9 XV (2025년형) 화이트 1더즌",
    observedLowest: { jpy: 4950, procurable: false, source: "kakaku K0001663838" },
    procurableLowest: null, // ⚪ 공식몰 상세 URL 미확인(목록·검색이 JS)
    domesticDanawaKrw: 36432,
    domesticDanawaShippingKrw: 3500,
    domesticRetailKrw: 59000, // dunlopsportskorea /product/z-star9-xv/9267/
    domesticRetailShippingKrw: null,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    label: "타이틀리스트 프로 V1 (2025년형) 화이트 1더즌",
    observedLowest: { jpy: 5904, procurable: false, source: "kakaku K0001676143" },
    procurableLowest: null, // ⚪ 미조사
    domesticDanawaKrw: 58560,
    domesticDanawaShippingKrw: 0,
    domesticRetailKrw: null, // ⚪ titleist.co.kr 403 · 아베골프 미취급
    domesticRetailShippingKrw: null,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    label: "스릭슨 투어 클라리노 글러브 GGG-S029",
    observedLowest: null, // ⚪ kakaku 는 글러브를 등재하지 않는다
    procurableLowest: { jpy: 2200, procurable: true, source: "dunlop d-sports item/10317517" },
    domesticDanawaKrw: 17940,
    domesticDanawaShippingKrw: 3000,
    domesticRetailKrw: 15000, // avesports goodsNo=132646
    domesticRetailShippingKrw: 3000,
    actualWeightKg: 0.06,
  },
];

/**
 * 🔴 CEO §13 의 대상 목록 중 **실측이 하나도 없는 두 건**. 값을 지어내지 않고
 * 목록에 이름만 남긴다 — 「표에서 빠졌다」와 「잴 값이 없다」는 다른 말이다.
 * 이 배열이 비는 날은 실측이 들어온 날이어야 한다.
 */
const NO_MEASUREMENT: readonly string[] = ["PHYZ Premium", "adidas 아디테크"] as const;

interface Recalculated {
  oldShippingKrw: number;
  newShippingKrw: number;
  oldLandedKrw: number;
  newLandedKrw: number;
}

/** 한 건을 기존 표/새 표 양쪽으로 계산한다. 새 값은 언제나 프로덕션 엔진이 낸다. */
function recalc(price: OverseasPrice, weightKg: number): Recalculated {
  const cost = computeGolfLandedCost({
    sourcePriceAmount: price.jpy,
    sourcePriceCurrency: "JPY",
    liveRates: RATES_2026_09_15,
    actualWeightKg: weightKg,
    // GOLF-04 — 출발국을 적지 않으면 배송비가 «확인 필요»로 나간다.
    originCountry: "JP",
  });
  expect(cost.productCostKrw, price.source).not.toBeNull();
  expect(cost.internationalShippingKrw, price.source).not.toBeNull();
  const productKrw = cost.productCostKrw as number;
  const newShippingKrw = cost.internationalShippingKrw as number;
  const oldShippingKrw = oldShippingKrw_(weightKg, price.source);
  return {
    oldShippingKrw,
    newShippingKrw,
    oldLandedKrw: productKrw + oldShippingKrw,
    newLandedKrw: productKrw + newShippingKrw,
  };
}

function oldShippingKrw_(weightKg: number, label: string): number {
  const v = oldShippingKrw(weightKg);
  expect(v, `${label}: 기존 표 범위 밖`).not.toBeNull();
  return v as number;
}

describe("SHIPPING-POLICY-02 ④ — 골프 실측 재계산 기반", () => {
  it("실측 전 건이 재계산된다 — 기존 표/새 표 양쪽으로 값이 나온다", () => {
    const prices = ROWS.flatMap((r) => [r.observedLowest, r.procurableLowest]).filter(
      (p): p is OverseasPrice => p != null,
    );
    // 4개 상품 · 해외 축 5칸(Z-STAR 9 는 두 축 모두 있다).
    expect(prices).toHaveLength(5);
    for (const p of prices) {
      const row = ROWS.find((r) => r.observedLowest === p || r.procurableLowest === p) as RecalcRow;
      const got = recalc(p, row.actualWeightKg);
      expect(got.oldShippingKrw, p.source).toBeGreaterThan(0);
      expect(got.newShippingKrw, p.source).toBeGreaterThan(0);
    }
  });

  it("🔴 새 배송비가 기존보다 싸다 — 실측 전 건이 2kg 미만이라 없던 구간에 걸려 있었다", () => {
    for (const row of ROWS) {
      const price = (row.procurableLowest ?? row.observedLowest) as OverseasPrice;
      const got = recalc(price, row.actualWeightKg);
      // 기존 값은 예외 없이 2kg 구간 ¥3,400 이었다 — 0.06kg 이든 0.551kg 이든.
      expect(got.oldShippingKrw, row.label).toBe(Math.round(3400 * RATES_2026_09_15.JPY));
      expect(got.newShippingKrw, row.label).toBeLessThan(got.oldShippingKrw);
      // 원가도 정확히 배송비 차이만큼 내려간다 — 상품가는 손대지 않았다.
      expect(got.oldLandedKrw - got.newLandedKrw, row.label).toBe(got.oldShippingKrw - got.newShippingKrw);
    }
  });

  it("골프공 1더즌과 장갑은 «서로 다른» 구간으로 내려간다 — 기존 표에서는 같은 칸이었다", () => {
    const dozen = recalc({ jpy: 4950, procurable: false, source: "볼" }, DOZEN_BALL_MIN_WEIGHT_KG);
    const glove = recalc({ jpy: 2200, procurable: true, source: "장갑" }, 0.06);
    // 기존: 둘 다 2kg 칸 — 같은 값.
    expect(dozen.oldShippingKrw).toBe(glove.oldShippingKrw);
    // 새: 0.551kg → 600g 구간 ¥1,600 · 0.06kg → 500g 구간 ¥1,450.
    expect(dozen.newShippingKrw).toBe(Math.round(1600 * RATES_2026_09_15.JPY));
    expect(glove.newShippingKrw).toBe(Math.round(1450 * RATES_2026_09_15.JPY));
    expect(dozen.newShippingKrw).toBeGreaterThan(glove.newShippingKrw);
  });

  it("🔴 국내①(다나와)과 국내②(실판매처)는 재계산 뒤에도 «따로» 남는다 — 하나의 국내가로 뭉개지 않는다", () => {
    const withBoth = ROWS.filter((r) => r.domesticRetailKrw != null);
    expect(withBoth.length).toBeGreaterThanOrEqual(3);
    for (const r of withBoth) {
      // 두 축이 같은 값이면 굳이 나눌 이유가 없다 — 실제로 갈린다는 것이 요점이다.
      expect(r.domesticRetailKrw, r.label).not.toBe(r.domesticDanawaKrw);
    }
    // 🔴 배송비가 null 인 칸을 0 으로 메우지 않는다.
    const zstar = ROWS[0];
    expect(zstar.domesticRetailShippingKrw).toBeNull();
  });

  it("🔴 «관측 최저»와 «조달 가능 최저»가 구분돼 있다 — 가격비교 최저가를 조달가로 쓰지 않는다", () => {
    const observed = ROWS.map((r) => r.observedLowest).filter((p): p is OverseasPrice => p != null);
    const procurable = ROWS.map((r) => r.procurableLowest).filter((p): p is OverseasPrice => p != null);
    expect(observed.every((p) => !p.procurable)).toBe(true);
    expect(procurable.every((p) => p.procurable)).toBe(true);
    // Z-STAR 9 는 두 축이 다 있고, 조달 가능한 쪽이 «더 비싸다»(¥4,950 < ¥6,930).
    // 관측 최저를 조달가로 쓰면 원가를 ₩17,361 낮게 잡는다.
    const row = ROWS[0];
    const cheap = recalc(row.observedLowest as OverseasPrice, row.actualWeightKg);
    const real = recalc(row.procurableLowest as OverseasPrice, row.actualWeightKg);
    expect(real.newLandedKrw).toBeGreaterThan(cheap.newLandedKrw);
  });

  it("🔴 실측이 없는 건은 재계산하지 않는다 — PHYZ Premium · adidas 아디테크", () => {
    // 이 두 이름은 CEO §13 대상 목록에 있지만 이 저장소에 측정값이 하나도 없다.
    // 값을 지어내면 그 순간 «재계산했다»고 말하게 된다.
    expect(NO_MEASUREMENT).toHaveLength(2);
    for (const name of NO_MEASUREMENT) {
      expect(ROWS.some((r) => r.label.includes(name))).toBe(false);
    }
  });

  it("재계산은 프로덕션 EMS 표를 그대로 쓴다 — 이 파일이 요금을 따로 들고 있지 않다", () => {
    // OLD_BRACKETS 는 «기존 값 재현»용이고, 새 값은 언제나 프로덕션 상수에서 나온다.
    // 프로덕션 표가 바뀌면 이 테스트가 먼저 깨져야 한다.
    expect(EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => b.uptoKg === 0.5)?.jpy).toBe(1450);
    expect(EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => b.uptoKg === 0.6)?.jpy).toBe(1600);
    expect(EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => b.uptoKg === 2)?.jpy).toBe(3400);
    // 기존 다섯 칸의 «값»은 하나도 바뀌지 않았다(f4f1565 는 칸을 채웠을 뿐이다).
    for (const old of OLD_BRACKETS) {
      expect(EMS_JAPAN_TO_KOREA_BRACKETS.find((b) => b.uptoKg === old.uptoKg)?.jpy, `${old.uptoKg}kg`).toBe(old.jpy);
    }
  });
});
