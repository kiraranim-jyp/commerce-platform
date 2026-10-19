import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ComparisonCandidate } from "@commerce/crawler";
import { orderByCrossSellerVerdict } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-113 P1 — **샵 대표 선택의 색상 2차 키** (CPO 채택 2026-10-19)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-112 CEO GT 가 잡은 실패: `tinyapple.net` 의 Human **DIFFERENT**(반팔)가
 *    conf 1.00 으로 대표가 되고, 색상이 일치하는 Human **SAME**(conf 0.64)이 밀렸다.
 *    그 결과 **USD 53 이 「해외 동일상품 최저가」로 화면에 떴다**.
 *
 * 🔴 이 계약이 잠그는 것은 **둘** 이다 — ① 색상 2차 키가 산다 ② **1차 키를 넘지 못한다**.
 * 🔴 threshold·8축·SAME 조건·가격·⑧ 게이트는 범위 밖이고, 그 금지도 아래에서 단언한다.
 */
const c = (
  p: Partial<ComparisonCandidate> & { url: string },
): ComparisonCandidate =>
  ({ title: p.url, confidence: 0.5, ...p } as unknown as ComparisonCandidate);

/** 🟢 WU-113 STEP1 에서 **운영이 실제로 만든 값** 이다(하니스가 지어낸 모양이 아니다). */
const TINYAPPLE = [
  c({ url: "no-color", crossSellerVerdict: "SAME", confidence: 1, facts: { colorText: null } as never }),
  c({
    url: "heather-grey",
    crossSellerVerdict: "SAME",
    confidence: 0.64,
    facts: { colorText: "shirt heather grey" } as never,
  }),
  c({ url: "sweatshirt", crossSellerVerdict: "PRESUMED_SAME", confidence: 0.46, facts: { colorText: null } as never }),
];

describe("WU-113 ① 색상 증거가 있는 후보가 같은 등급 안에서 먼저 선다", () => {
  it("🟢🟢 tinyapple 실제 입력 — 대표가 **색상 일치 후보** 로 바뀐다", () => {
    const o = orderByCrossSellerVerdict(TINYAPPLE, "heather grey");
    expect(o[0].url).toBe("heather-grey");
    /** 🔴 등급은 유지된다 — PRESUMED_SAME 이 SAME 들보다 앞에 오지 않는다. */
    expect(o[2].url).toBe("sweatshirt");
  });

  it("🔴 색상 2차 키는 **1차 키(verdict)를 넘지 못한다**", () => {
    const o = orderByCrossSellerVerdict(
      [
        c({ url: "conflict-with-color", crossSellerVerdict: "CONFLICT", facts: { colorText: "heather grey" } as never }),
        c({ url: "same-no-color", crossSellerVerdict: "SAME", facts: { colorText: null } as never }),
      ],
      "heather grey",
    );
    expect(o[0].url).toBe("same-no-color");
  });

  it("🔴 **색이 어긋난** 후보는 올려주지 않는다(「색만 있으면 이긴다」가 아니다)", () => {
    const o = orderByCrossSellerVerdict(
      [
        c({ url: "blank", crossSellerVerdict: "SAME", confidence: 0.3, facts: { colorText: null } as never }),
        c({
          url: "color-conflict",
          crossSellerVerdict: "SAME",
          confidence: 0.9,
          facts: { colorText: "choses light blue" } as never,
          crossSellerConflicts: [{ conflict: "COLOR" }] as never,
        }),
      ],
      "heather grey",
    );
    /** 🟢 둘 다 2차 키에서 동률(1) ⟹ **안정 정렬로 입력 순서 유지** = 기존 동작. */
    expect(o.map((x) => x.url)).toEqual(["blank", "color-conflict"]);
  });

  /**
   * 🔴🔴 **이 단언은 음성 대조가 «통과해서» 추가됐다.** 1차 계약에서
   *    M2(`colorRank` 에서 `!hasColorConflict` 제거)가 **0 failed** 로 통과했다.
   * 🔴 원인을 규명했다 — 위 케이스는 색상 후보가 **충돌 하나뿐** 이라
   *    `colorTieBreak` 자체가 false 가 되어 `colorRank` 가 **도달하지 않았다**.
   *    ⟹ 「가드가 통과했다」를 「가드가 있다」로 읽으면 틀리는 그 모양이다.
   * 🟢 그래서 **깨끗한 색상 후보와 충돌 색상 후보가 «같이» 있는** 모양을 넣는다.
   *    (COLOR 충돌이 반드시 CONFLICT 판정으로 끝나지는 않는다 — `COLOR_VARIANT` 보류는
   *     `PRESUMED_SAME` 으로 남는다 · WU-044)
   */
  it("🔴 깨끗한 색상 후보와 **충돌 색상 후보가 같이 있을 때** 충돌 쪽이 앞서지 않는다", () => {
    const o = orderByCrossSellerVerdict(
      [
        c({
          url: "color-conflict-high-conf",
          crossSellerVerdict: "PRESUMED_SAME",
          confidence: 0.95,
          facts: { colorText: "choses light blue" } as never,
          crossSellerConflicts: [{ conflict: "COLOR" }] as never,
        }),
        c({
          url: "clean-color",
          crossSellerVerdict: "PRESUMED_SAME",
          confidence: 0.4,
          facts: { colorText: "shirt heather grey" } as never,
        }),
        c({ url: "blank", crossSellerVerdict: "PRESUMED_SAME", confidence: 0.6, facts: { colorText: null } as never }),
      ],
      "heather grey",
    );
    expect(o[0].url).toBe("clean-color");
    /** 🔴 충돌 후보는 **색이 없는 후보보다도 앞서지 않는다**(동률 ⟹ conf 순서 유지). */
    expect(o.map((x) => x.url)).toEqual(["clean-color", "color-conflict-high-conf", "blank"]);
  });
});

describe("WU-113 ② 바뀌지 않는 것 (회귀 방어)", () => {
  it("🔴 원상품 색상이 없으면 **순서 불변**", () => {
    const o = orderByCrossSellerVerdict(TINYAPPLE, null);
    expect(o.map((x) => x.url)).toEqual(["no-color", "heather-grey", "sweatshirt"]);
  });

  it("🔴 인자를 **생략하면** 예전 동작 그대로다(기존 호출부 보호)", () => {
    expect(orderByCrossSellerVerdict(TINYAPPLE).map((x) => x.url)).toEqual([
      "no-color",
      "heather-grey",
      "sweatshirt",
    ]);
  });

  it("🔴 후보 전원이 색이 없으면 **순서 불변**", () => {
    const rows = [
      c({ url: "a", crossSellerVerdict: "SAME", facts: { colorText: null } as never }),
      c({ url: "b", crossSellerVerdict: "SAME", facts: { colorText: null } as never }),
    ];
    expect(orderByCrossSellerVerdict(rows, "heather grey").map((x) => x.url)).toEqual(["a", "b"]);
  });

  it("🔴 판정이 하나도 없고 색상 증거도 없으면 **입력 배열을 그대로** 돌려준다", () => {
    const rows = [c({ url: "a" }), c({ url: "b" })];
    expect(orderByCrossSellerVerdict(rows, "heather grey")).toBe(rows);
  });

  it("🟢 판정이 없어도 색상 증거가 있으면 2차 키가 발화한다", () => {
    const rows = [
      c({ url: "blank" }),
      c({ url: "grey", facts: { colorText: "heather grey" } as never }),
    ];
    expect(orderByCrossSellerVerdict(rows, "heather grey").map((x) => x.url)).toEqual(["grey", "blank"]);
  });
});

/**
 * 🔴 **음성 대조가 통과한 뒤에도 배선을 못 보는 함정** 을 WU-110 에서 겪었다.
 *    그래서 「운영이 그 2차 키를 실제로 쓰는가」를 **소스 앵커** 로 같이 잠근다.
 * 🔴 주석을 벗길 필요가 없는 문자열을 골랐다(운영 파일 주석에 등장하지 않는다 · 확인).
 */
const SRC = readFileSync(path.join(__dirname, "../run-domestic-price-check.ts"), "utf8");

describe("WU-113 ③ 배선과 금지를 «소스» 로 잠근다", () => {
  it("🔴 대표 선택이 색상을 **실제로 넘겨받는다**", () => {
    expect(SRC).toContain("orderByCrossSellerVerdict(candidates, foreignColor)");
    expect(SRC).toContain("input.foreignColor,");
  });

  it("🔴 1차 키 표가 **그대로** 다 — 등급을 바꿔 고치지 않았다", () => {
    expect(SRC).toContain('{ SAME: 0, PRESUMED_SAME: 1, CONFLICT: 3 }');
  });

  it("🔴 이 WU 는 ⑧ 게이트·threshold·가격을 건드리지 않았다", () => {
    /** 🟢 ⑧ 게이트의 술어가 **원문 그대로** 남아 있는지 확인한다(완화 금지 · P2 보류). */
    expect(SRC).toContain('candidates[0].matchLevel !== "low"');
  });
});
