import { describe, expect, it } from "vitest";
import { resolveNaverOriginArea } from "../origin-match";
import type { NaverOriginAreaCode } from "../origin-match";

/**
 * Sprint N-3.4 — GET /v1/product-origin-areas 실측 응답 중 이 테스트에
 * 필요한 항목만 발췌한 fixture(실제 코드/이름을 그대로 옮김, 임의 생성 아님).
 */
const AREAS: NaverOriginAreaCode[] = [
  { code: "00", name: "국산" },
  { code: "01", name: "원양산" },
  { code: "02", name: "수입산" },
  { code: "03", name: "상세설명에 표시" },
  { code: "04", name: "직접입력" },
  { code: "05", name: "원산지 표기 의무대상 아님" },
  { code: "0201025", name: "수입산:유럽>스페인" },
  { code: "0200016", name: "수입산:아시아>중국" },
];

describe("resolveNaverOriginArea", () => {
  it("원산지 텍스트가 없으면 NO_INPUT", () => {
    const result = resolveNaverOriginArea(null, AREAS);
    expect(result.status).toBe("NO_INPUT");
    expect(result.code).toBeNull();
  });

  it("대한민국/한국 계열 텍스트는 국산(00)으로 매칭되고 수입사명이 필요 없다", () => {
    const result = resolveNaverOriginArea("대한민국", AREAS);
    expect(result.status).toBe("MATCHED");
    expect(result.code).toBe("00");
    expect(result.requiresImporter).toBe(false);
  });

  it("영어 국가명(Spain)은 EN→KO 매핑을 거쳐 실제 목록의 리프 코드로 매칭된다", () => {
    const result = resolveNaverOriginArea("Spain", AREAS);
    expect(result.status).toBe("MATCHED");
    expect(result.code).toBe("0201025");
    expect(result.requiresImporter).toBe(true);
  });

  it("이미 한국어인 국가명(중국)도 EN 매핑 없이 직접 매칭된다", () => {
    const result = resolveNaverOriginArea("중국", AREAS);
    expect(result.status).toBe("MATCHED");
    expect(result.code).toBe("0200016");
    expect(result.requiresImporter).toBe(true);
  });

  it("목록에 없는 텍스트는 코드를 지어내지 않고 04(직접입력)로 폴백한다", () => {
    const result = resolveNaverOriginArea("Narnia", AREAS);
    expect(result.status).toBe("OTHER_MANUAL");
    expect(result.code).toBe("04");
    expect(result.requiresImporter).toBe(false);
  });
});
