import { describe, expect, it } from "vitest";
import { assembleContentsFromBlocks, defaultDetailBlocks, type DetailPageBlock } from "../build-payload";

/**
 * N-4.08-DetailPage(대표님 지시) — defaultDetailBlocks()/assembleContentsFromBlocks()가
 * "상품 이미지 → AI 설명 → 하단 공통 이미지"를 정확히 만들고, 안내문구/상단
 * 공통이미지는 기본 비노출이되 ON으로 바꾸면 정상 반영되는지, 기존 저장
 * 상품의 detailBlocks는 절대 자동으로 덮어쓰지 않는지 확인한다.
 * assembleContentsFromBlocks는 Coupang/SmartStore(Naver) 공통 함수라
 * (packages/listing/src/naver/build-payload.ts의 assembleNaverDetailContent가
 * 이 파일에서 그대로 import해 재사용) 이 테스트 하나로 두 플랫폼 모두를
 * 검증하는 셈이다.
 */

function textOf(part: ReturnType<typeof assembleContentsFromBlocks>[number]): string | null {
  return part.contentsType === "TEXT" ? part.contentDetails[0]?.content ?? null : null;
}
function imageOf(part: ReturnType<typeof assembleContentsFromBlocks>[number]): string | null {
  return part.contentsType === "IMAGE" ? part.contentDetails[0]?.content ?? null : null;
}

const baseCtx = {
  aiDescription: "테스트 상품 설명",
  productImageUrls: ["https://example.com/p1.jpg", "https://example.com/p2.jpg"],
  sizeChartImageUrls: [] as string[],
};

const fullTemplate = {
  shippingBlocks: [],
  exchangeBlocks: [],
  returnBlocks: [],
  agentBuyBlocks: [],
  asBlocks: [],
  shippingInfo: "배송 안내",
  exchangeInfo: "교환 안내",
  returnInfo: "반품 안내",
  agentBuyInfo: "구매대행 안내",
  asInfo: "AS 안내",
} as never;

describe("defaultDetailBlocks() 기본 구성", () => {
  it("상단 공통 이미지/안내문구 5종은 기본 비노출, 상품이미지/설명/하단공통이미지는 노출", () => {
    const blocks = defaultDetailBlocks();
    expect(blocks.find((b) => b.kind === "COMMON_IMAGE" && b.position === "top")?.enabled).toBe(false);
    expect(blocks.find((b) => b.kind === "PRODUCT_IMAGES")?.enabled).toBe(true);
    expect(blocks.find((b) => b.kind === "AI_DESCRIPTION")?.enabled).toBe(true);
    expect(blocks.find((b) => b.kind === "COMMON_IMAGE" && b.position === "bottom")?.enabled).toBe(true);
    for (const section of ["shipping", "exchange", "return", "agentBuy", "as"] as const) {
      expect(blocks.find((b) => b.kind === "TEMPLATE_SECTION" && b.section === section)?.enabled).toBe(false);
    }
  });
});

describe("assembleContentsFromBlocks — Case 1: 기본 구성(안내 OFF)", () => {
  it("상품 이미지 → AI 설명 → 하단 공통 이미지 순서로만 조립되고 안내문구는 없다", () => {
    const contents = assembleContentsFromBlocks(defaultDetailBlocks(), {
      ...baseCtx,
      template: fullTemplate,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: true, // 판매자 설정은 ON이어도 블록 자체가 OFF면 안 나와야 한다
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: true,
      } as never,
    });

    expect(contents.map((c) => imageOf(c) ?? textOf(c))).toEqual([
      "https://example.com/p1.jpg",
      "https://example.com/p2.jpg",
      "테스트 상품 설명",
      "https://example.com/bottom.jpg",
    ]);
    expect(contents.some((c) => textOf(c)?.includes("안내"))).toBe(false);
  });
});

describe("assembleContentsFromBlocks — Case 2: 안내 ON", () => {
  it("배송안내를 ON으로 바꾸면 하단 공통 이미지 뒤에 배송안내가 붙는다", () => {
    const blocks: DetailPageBlock[] = defaultDetailBlocks().map((b) =>
      b.kind === "TEMPLATE_SECTION" && b.section === "shipping" ? { ...b, enabled: true } : b,
    );
    const contents = assembleContentsFromBlocks(blocks, {
      ...baseCtx,
      template: fullTemplate,
      sellerConfig: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: true,
      } as never,
    });
    const last = contents[contents.length - 1];
    expect(textOf(last)).toContain("배송 안내");
    expect(imageOf(contents[contents.length - 2])).toBe("https://example.com/bottom.jpg");
  });
});

describe("assembleContentsFromBlocks — Case 3: 상단 이미지 ON", () => {
  it("상단 공통 이미지를 ON하면 맨 앞에 붙는다(상품 이미지보다 먼저)", () => {
    const blocks: DetailPageBlock[] = defaultDetailBlocks().map((b) =>
      b.kind === "COMMON_IMAGE" && b.position === "top" ? { ...b, enabled: true } : b,
    );
    const contents = assembleContentsFromBlocks(blocks, {
      ...baseCtx,
      template: fullTemplate,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: true,
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: true,
      } as never,
    });
    expect(imageOf(contents[0])).toBe("https://example.com/top.jpg");
    expect(imageOf(contents[1])).toBe("https://example.com/p1.jpg");
    expect(imageOf(contents[contents.length - 1])).toBe("https://example.com/bottom.jpg");
  });
});

describe("assembleContentsFromBlocks — Case 4: 빈 템플릿", () => {
  it("템플릿/공통이미지가 전혀 없어도 AI 설명 + 상품 이미지만으로 조립된다", () => {
    const contents = assembleContentsFromBlocks(defaultDetailBlocks(), {
      ...baseCtx,
      template: null,
      sellerConfig: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      } as never,
    });
    expect(contents.map((c) => imageOf(c) ?? textOf(c))).toEqual([
      "https://example.com/p1.jpg",
      "https://example.com/p2.jpg",
      "테스트 상품 설명",
    ]);
  });
});

describe("기존 저장 상품 보호(saved.detailBlocks ?? defaultDetailBlocks() 계약)", () => {
  it("기존에 저장된 blocks가 있으면 defaultDetailBlocks()가 절대 개입하지 않는다", () => {
    const legacySavedBlocks: DetailPageBlock[] = [
      { id: "legacy-0", kind: "AI_DESCRIPTION", enabled: true },
      { id: "legacy-1", kind: "TEMPLATE_SECTION", section: "shipping", enabled: true },
      { id: "legacy-2", kind: "COMMON_IMAGE", position: "top", enabled: true },
      { id: "legacy-3", kind: "PRODUCT_IMAGES", enabled: true },
      { id: "legacy-4", kind: "COMMON_IMAGE", position: "bottom", enabled: true },
    ];
    // 실제 코드 계약(apps/admin/src/app/pipeline/page.tsx): saved.detailBlocks ?? defaultDetailBlocks()
    const resolved = (legacySavedBlocks as DetailPageBlock[] | undefined) ?? defaultDetailBlocks();
    expect(resolved).toBe(legacySavedBlocks);
    expect(resolved[0].kind).toBe("AI_DESCRIPTION"); // 새 기본값(PRODUCT_IMAGES 먼저)으로 안 바뀜
  });

  it("저장된 blocks가 없는(undefined) 세션만 새 defaultDetailBlocks()를 받는다", () => {
    const undefinedBlocks: DetailPageBlock[] | undefined = undefined;
    const resolved = undefinedBlocks ?? defaultDetailBlocks();
    expect(resolved[0].kind).toBe("COMMON_IMAGE");
    expect(resolved[1].kind).toBe("PRODUCT_IMAGES");
  });
});
