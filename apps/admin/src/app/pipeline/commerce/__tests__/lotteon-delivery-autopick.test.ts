// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { autoPick } from "../LotteOnRegistrationPanel";

/**
 * LOTTEON-HOLD-FIX-A(2026-09-15) — `isDefault`의 **출처**를 고쳤으니
 * (`bscYn` → 150 문서 원문의 `rprtYn`), 그 값을 쓰는 **규칙**이 그대로인지도
 * 같이 고정한다.
 *
 * 규칙: 자동으로 채우는 건 ① 대표로 표시된 건이거나 ② 후보가 하나뿐일 때뿐이다.
 * 여럿 중 하나를 우리가 고르면 엉뚱한 출고지로 주문이 간다.
 */
describe("배송지 자동 적용 규칙", () => {
  it("대표 표시건(isDefault)이 있으면 그 건을 고른다", () => {
    const picked = autoPick([
      { no: "PLO00008", isDefault: false },
      { no: "PLO00009", isDefault: true },
      { no: "PLO00010", isDefault: false },
    ]);
    expect(picked?.no).toBe("PLO00009");
  });

  it("후보가 하나뿐이면 표시가 없어도 그 건을 고른다", () => {
    expect(autoPick([{ no: "PLO00008", isDefault: false }])?.no).toBe("PLO00008");
  });

  it("여럿인데 대표 표시가 없으면 **고르지 않는다** — 셀러가 고른다", () => {
    expect(
      autoPick([
        { no: "PLO00008", isDefault: false },
        { no: "PLO00009", isDefault: false },
      ]),
    ).toBeNull();
  });

  it("0건이면 null이다", () => {
    expect(autoPick([])).toBeNull();
  });

  it("isDefault가 아예 없는 목록(배송비정책)도 하나뿐이면 고른다", () => {
    expect(autoPick([{ no: "DV0001" }])?.no).toBe("DV0001");
    expect(autoPick([{ no: "DV0001" }, { no: "DV0002" }])).toBeNull();
  });
});
