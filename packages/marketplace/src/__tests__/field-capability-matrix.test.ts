import { describe, expect, it } from "vitest";
import { FIELD_CAPABILITY_MATRIX } from "../field-capability-matrix";

describe("FIELD_CAPABILITY_MATRIX", () => {
  it("모든 행이 4개 마켓 전부에 값을 갖는다(빈 셀 없음)", () => {
    for (const row of FIELD_CAPABILITY_MATRIX) {
      expect(row.smartstore).toBeTruthy();
      expect(row.coupang).toBeTruthy();
      expect(row.elevenst).toBeTruthy();
      expect(row.esm).toBeTruthy();
      expect(row.note.length).toBeGreaterThan(0);
    }
  });

  it("11번가/ESM은 모든 필드에서 SOON이다(이번 스프린트 실 연동 없음)", () => {
    for (const row of FIELD_CAPABILITY_MATRIX) {
      expect(row.elevenst).toBe("SOON");
      expect(row.esm).toBe("SOON");
    }
  });

  it("KC는 SMARTSTORE_ONLY, Coupang은 PARTIAL(자동 매핑 없음, 사람이 직접 입력)", () => {
    const kc = FIELD_CAPABILITY_MATRIX.find((r) => r.field === "kc");
    expect(kc?.ownership).toBe("SMARTSTORE_ONLY");
    expect(kc?.coupang).toBe("PARTIAL");
  });

  it("상품속성은 SmartStore/Coupang 둘 다 지원하는 MAPPED다(SMARTSTORE_ONLY 아님)", () => {
    const attrs = FIELD_CAPABILITY_MATRIX.find((r) => r.field === "attributes");
    expect(attrs?.ownership).toBe("MAPPED");
    expect(attrs?.coupang).toBe("SUPPORTED");
  });

  it("필드 id는 중복이 없다", () => {
    const ids = FIELD_CAPABILITY_MATRIX.map((r) => r.field);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
