import { describe, expect, it } from "vitest";
import { defaultDetailBlocks, resolveDetailBlocks, type DetailPageBlock } from "../build-payload";

/**
 * N-3.86 STEP3(대표님 지시: "설정이 공통 상세페이지의 유일한 기준") —
 * resolveDetailBlocks()는 이제 register/payload-preview/naver-resolve 라우트가
 * detailBlocks를 결정하는 유일한 통로다. 이 테스트는 그 함수 자체의 계약
 * (Settings 값 우선, 없으면 코드 상수 폴백, 절대 undefined/빈 배열을 반환하지
 * 않음)을 검증한다 — "클라이언트가 무엇을 보내든 서버 payload에 영향이 없다"는
 * 요구사항은, 서버 라우트가 이 함수 하나만 거쳐서 detailBlocks를 만들고
 * 클라이언트 POST body의 detailBlocks 필드 자체를 아예 읽지 않는다는 사실로
 * 구조적으로 보장된다(register/payload-preview/resolve-context 세 라우트 모두
 * body에서 detailBlocks를 destructure하지 않음 — 이 파일에서 그 계약이 깨지면
 * TS가 사용되지 않는 변수로 잡아내지 못하므로, 함수 자체의 폴백 규칙만
 * 유닛으로 고정한다).
 */
describe("resolveDetailBlocks()", () => {
  it("셀러가 Settings에 저장한 값이 있으면 그대로 반환한다", () => {
    const sellerDefault: DetailPageBlock[] = [
      { id: "seller-0", kind: "AI_DESCRIPTION", enabled: true },
      { id: "seller-1", kind: "PRODUCT_IMAGES", enabled: true },
    ];
    const resolved = resolveDetailBlocks(sellerDefault);
    expect(resolved).toBe(sellerDefault);
  });

  it("셀러 기본값이 null이면(한 번도 설정 안 함) 코드 상수로 폴백한다", () => {
    const resolved = resolveDetailBlocks(null);
    expect(resolved).toEqual(defaultDetailBlocks());
  });

  it("셀러 기본값이 undefined면 코드 상수로 폴백한다", () => {
    const resolved = resolveDetailBlocks(undefined);
    expect(resolved).toEqual(defaultDetailBlocks());
  });

  it("셀러 기본값이 빈 배열이면(저장은 했지만 블록을 다 지운 경우) 코드 상수로 폴백한다", () => {
    const resolved = resolveDetailBlocks([]);
    expect(resolved).toEqual(defaultDetailBlocks());
  });

  it("항상 비어있지 않은 배열을 반환한다 — 절대 undefined를 반환하지 않는다", () => {
    expect(resolveDetailBlocks(null).length).toBeGreaterThan(0);
    expect(resolveDetailBlocks(undefined).length).toBeGreaterThan(0);
    expect(resolveDetailBlocks([]).length).toBeGreaterThan(0);
  });
});
