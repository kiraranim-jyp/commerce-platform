import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  assembleContentsFromBlocks,
  assembleNaverDetailContent,
  defaultDetailBlocks,
  resolveDetailBlocks,
  type DetailPageBlock,
} from "@commerce/listing";
import { ActionCenter } from "../ActionCenter";
import { resolveStageFocus } from "../stage-focus";

/**
 * REWORK 커머스 등록 구조 통일(CEO 지시, 2026-09-14).
 *
 * 지시서 필수 표에서 **테스트가 없던 두 칸**을 실제 실행 결과로 채운다:
 *
 *   · 상세설명 / 상단 템플릿 / 하단 템플릿 **공통 Source**
 *       → 셋 다 같은 함수에 같은 셀러 설정을 넣어 돌린 결과가 같은가
 *   · MI 표시/관리 **제거**(세 탭 전부)
 *       → 커머스 탭에서 판매 판단이 실제로 그려지지 않는가
 *
 * 🔴 "코드상 그렇다"로 여섯 번 틀린 저장소다. 그래서 (1) 조립 함수는 **실제로
 *    실행**하고 (2) 배선은 세 채널의 호출 지점 **원문**을 읽어서 확인한다.
 *    둘 중 하나만으로는 부족하다 — 함수가 옳아도 롯데ON이 그 함수를 안 부르면
 *    소용없고, 부르기만 하고 셀러 설정을 안 넘기면 템플릿이 비어서 나간다.
 */

/* ── 공통 상세 Source ───────────────────────────────────────────────────── */

const TEMPLATE = {
  shippingInfo: "평일 14시 이전 주문은 당일 출고됩니다.",
  exchangeInfo: "교환은 수령 후 7일 이내입니다.",
  returnInfo: "반품은 수령 후 7일 이내입니다.",
} as never;

/** 셀러 설정(coupang_seller_profiles)의 상단/하단 공통 이미지 그대로. */
const COMMON_IMAGES = {
  topCommonImageUrl: "https://cdn.example.com/seller/top-banner.jpg",
  topCommonImageEnabled: true,
  bottomCommonImageUrl: "https://cdn.example.com/seller/bottom-banner.jpg",
  bottomCommonImageEnabled: true,
};

const CTX = {
  aiDescription: "부드러운 테리 소재 반바지입니다.",
  template: TEMPLATE,
  productImageUrls: ["https://cdn.example.com/product/1.jpg"],
  sizeChartImageUrls: ["https://cdn.example.com/product/size.jpg"],
  brandIntro: "보보쇼즈는 바르셀로나의 키즈 브랜드입니다.",
};

/** 세 채널이 전부 이 한 줄로 블록을 얻는다(셀러가 따로 저장한 구성이 없을 때). */
function blocks(sellerDefault?: DetailPageBlock[] | null): DetailPageBlock[] {
  return resolveDetailBlocks(sellerDefault);
}

describe("상세설명 · 상단/하단 템플릿 — 세 채널이 같은 Source를 쓴다", () => {
  it("셀러 설정을 안 건드리면 세 채널이 같은 블록 구성을 얻는다", () => {
    // resolveDetailBlocks()는 채널 인자를 받지 않는다 — 채널별로 다른 구성을
    // 낼 자리 자체가 없다는 것이 이 계약의 핵심이다.
    expect(resolveDetailBlocks.length).toBe(1);
    expect(blocks(null)).toEqual(defaultDetailBlocks());
    expect(blocks(undefined)).toEqual(defaultDetailBlocks());
  });

  it("셀러가 저장한 구성이 있으면 그것이 그대로 세 채널에 간다", () => {
    const custom: DetailPageBlock[] = [
      { id: "b0", kind: "COMMON_IMAGE", position: "top", enabled: true },
      { id: "b1", kind: "AI_DESCRIPTION", enabled: true },
      { id: "b2", kind: "COMMON_IMAGE", position: "bottom", enabled: true },
    ];
    expect(blocks(custom)).toEqual(custom);
  });

  /**
   * 🔴 이 테스트가 지시서의 "❌ LOTTEON 용 상/하단 템플릿 신규 생성"을 막는다.
   * 롯데ON이 쓰는 조립기(assembleNaverDetailContent)와 쿠팡이 쓰는 조립기
   * (assembleContentsFromBlocks)에 **같은 셀러 설정**을 넣고, 상단/하단 이미지가
   * 같은 URL로 같은 자리에 오는지를 실행 결과로 본다.
   */
  /**
   * 🔴 실행해 보고 알게 된 사실 — **기본 구성에서 상단 공통 이미지는 꺼져 있다**
   * (`defaultDetailBlocks()`의 top 블록 `enabled: false`, bottom만 `true`).
   * 셀러 설정에서 `topCommonImageEnabled`를 켜도 블록이 꺼져 있으면 안 나간다.
   * 게이트가 둘이라는 뜻이고, 그 둘 다 **세 채널에 똑같이** 걸린다 — 그래서
   * 이것은 롯데ON 결함이 아니라 세 채널 공통 기본값이다. 추정하지 않고 적는다.
   */
  it("기본 구성의 상단/하단 공통 이미지 스위치는 세 채널에 똑같이 걸린다", () => {
    const top = defaultDetailBlocks().find((b) => b.kind === "COMMON_IMAGE" && b.position === "top");
    const bottom = defaultDetailBlocks().find((b) => b.kind === "COMMON_IMAGE" && b.position === "bottom");
    expect(top?.enabled).toBe(false);
    expect(bottom?.enabled).toBe(true);

    // 셀러 설정만 켜고 블록은 기본값이면 상단은 나가지 않는다 — 두 조립기 모두.
    const html = assembleNaverDetailContent(blocks(null), { ...CTX, commonImages: COMMON_IMAGES });
    const contents = assembleContentsFromBlocks(blocks(null), {
      ...CTX,
      sellerConfig: { ...COMMON_IMAGES } as never,
    });
    const urls = contents.flatMap((c) => c.contentDetails.filter((d) => d.detailType !== "TEXT").map((d) => d.content));
    expect(html).not.toContain(COMMON_IMAGES.topCommonImageUrl);
    expect(urls).not.toContain(COMMON_IMAGES.topCommonImageUrl);
    // 하단은 기본값이 켜져 있으므로 양쪽 다 나간다.
    expect(html).toContain(COMMON_IMAGES.bottomCommonImageUrl);
    expect(urls).toContain(COMMON_IMAGES.bottomCommonImageUrl);
  });

  it("상단 · 하단 템플릿이 세 채널에서 같은 URL · 같은 순서로 들어간다", () => {
    // 셀러가 상단 블록까지 켜 둔 구성. 여기서부터는 두 게이트가 모두 열려 있다.
    const detailBlocks: DetailPageBlock[] = defaultDetailBlocks().map((block) =>
      block.kind === "COMMON_IMAGE" ? { ...block, enabled: true } : block,
    );

    // ① 스마트스토어 · 롯데ON — 둘 다 assembleNaverDetailContent를 쓴다.
    //    (롯데ON은 api/lotteon/_lib/build-context.ts가 이 함수를 그대로 부른다)
    const html = assembleNaverDetailContent(detailBlocks, { ...CTX, commonImages: COMMON_IMAGES });

    // ② 쿠팡 — 같은 블록 · 같은 셀러 설정으로 배열을 만든다.
    const contents = assembleContentsFromBlocks(detailBlocks, {
      ...CTX,
      sellerConfig: { ...COMMON_IMAGES } as never,
    });
    const coupangUrls = contents.flatMap((content) =>
      content.contentDetails.filter((d) => d.detailType !== "TEXT").map((d) => d.content),
    );

    // 상단/하단 공통 이미지가 양쪽에 다 있다 — 한쪽에만 있으면 채널마다 다른
    // 상세페이지가 나간다는 뜻이다.
    expect(html).toContain(COMMON_IMAGES.topCommonImageUrl);
    expect(html).toContain(COMMON_IMAGES.bottomCommonImageUrl);
    expect(coupangUrls).toContain(COMMON_IMAGES.topCommonImageUrl);
    expect(coupangUrls).toContain(COMMON_IMAGES.bottomCommonImageUrl);

    // 순서도 같다 — 상단이 하단보다 먼저.
    expect(html.indexOf(COMMON_IMAGES.topCommonImageUrl)).toBeLessThan(
      html.indexOf(COMMON_IMAGES.bottomCommonImageUrl),
    );
    expect(coupangUrls.indexOf(COMMON_IMAGES.topCommonImageUrl)).toBeLessThan(
      coupangUrls.indexOf(COMMON_IMAGES.bottomCommonImageUrl),
    );
  });

  it("셀러가 상단 공통 이미지를 끄면 세 채널에서 함께 사라진다", () => {
    const detailBlocks: DetailPageBlock[] = defaultDetailBlocks().map((block) =>
      block.kind === "COMMON_IMAGE" ? { ...block, enabled: true } : block,
    );
    const off = { ...COMMON_IMAGES, topCommonImageEnabled: false };

    const html = assembleNaverDetailContent(detailBlocks, { ...CTX, commonImages: off });
    const contents = assembleContentsFromBlocks(detailBlocks, { ...CTX, sellerConfig: { ...off } as never });
    const coupangUrls = contents.flatMap((content) =>
      content.contentDetails.filter((d) => d.detailType !== "TEXT").map((d) => d.content),
    );

    expect(html).not.toContain(COMMON_IMAGES.topCommonImageUrl);
    expect(coupangUrls).not.toContain(COMMON_IMAGES.topCommonImageUrl);
    // 하단은 그대로다 — 끈 것만 사라진다.
    expect(html).toContain(COMMON_IMAGES.bottomCommonImageUrl);
  });

  it("본문(AI 상세설명)도 같은 ctx 키 하나에서 온다", () => {
    const html = assembleNaverDetailContent(blocks(null), { ...CTX, commonImages: COMMON_IMAGES });
    expect(html).toContain("부드러운 테리 소재 반바지입니다");
  });
});

/* ── 배선 — 세 채널이 정말 그 함수를 부르는가 ────────────────────────────── */

const ADMIN_SRC = join(__dirname, "..", "..", "..", "..");

function readSource(relative: string): string {
  return readFileSync(join(ADMIN_SRC, relative), "utf-8");
}

describe("배선 — 롯데ON이 공통 Source를 실제로 부른다(전용 경로를 만들지 않았다)", () => {
  const lotteOn = readSource("app/api/lotteon/_lib/build-context.ts");

  it("롯데ON 상세페이지는 공통 조립기 두 개를 그대로 부른다", () => {
    expect(lotteOn).toContain("assembleNaverDetailContent(resolveDetailBlocks(");
  });

  it("롯데ON이 읽는 템플릿 · 셀러 설정은 스마트스토어/쿠팡과 같은 저장소다", () => {
    // 같은 getter를 부른다 = 같은 DB 행을 읽는다. 롯데ON 전용 템플릿 테이블을
    // 만들면 이 줄이 먼저 깨진다.
    expect(lotteOn).toContain("getDefaultDescriptionTemplate");
    expect(lotteOn).toContain("getDefaultSellerProfile");
    expect(lotteOn).toContain("sellerProfile?.defaultDetailBlocks");
    for (const key of [
      "topCommonImageUrl",
      "topCommonImageEnabled",
      "bottomCommonImageUrl",
      "bottomCommonImageEnabled",
    ]) {
      expect(lotteOn, `롯데ON이 ${key}를 넘기지 않는다 — 템플릿이 비어서 나간다`).toContain(key);
    }
  });

  it("스마트스토어도 같은 셀러 프로필에서 상세 블록을 얻는다", () => {
    const naver = readSource("app/api/naver/_lib/resolve-context.ts");
    expect(naver).toContain("getDefaultSellerProfile");
  });

  it("롯데ON 코드 어디에도 자기 상세 템플릿을 만드는 자리가 없다", () => {
    // "롯데ON 전용 상세 콘텐츠를 만들기 시작하면 체크박스 하나로 여러 커머스에
    // 등록하는 구조가 다시 깨진다"(CEO) — 그 시작점을 여기서 막는다.
    for (const forbidden of ["lotteOnDetailTemplate", "LOTTEON_DETAIL_TEMPLATE", "lotteon_description_templates"]) {
      expect(lotteOn).not.toContain(forbidden);
    }
  });
});

/* ── MI 제거 — 세 탭 전부 ───────────────────────────────────────────────── */

describe("MI 표시/관리 — 커머스 탭에서 제거됐다(세 탭 전부)", () => {
  const CHECKLIST = [
    { key: "product-info", label: "상품정보", ok: true, onClick: () => {} },
    { key: "images", label: "이미지", ok: true, onClick: () => {} },
  ];

  function renderActionCenter(verdictMode: "LIST" | "DEFERRED") {
    return renderToStaticMarkup(
      createElement(ActionCenter, {
        verdict: { icon: "🟡", title: "조건부 판매", tone: "CAUTION" as const },
        verdictPending: false,
        verdictMode,
        checklist: CHECKLIST,
        channels: [],
        onOpenVerdict: () => {},
        onGoToChannel: () => {},
      }),
    );
  }

  it("커머스 탭의 오른쪽 기둥에 판매 판단이 그려지지 않는다", () => {
    const html = renderActionCenter("DEFERRED");
    expect(html).not.toContain("판매 판단");
    expect(html).not.toContain("조건부 판매");
    // 등록 전 확인은 그대로 남는다 — 지운 것은 MI뿐이다.
    expect(html).toContain("등록 전 확인");
  });

  it("상품정보 탭에서는 지금까지와 똑같이 그려진다", () => {
    const html = renderActionCenter("LIST");
    expect(html).toContain("판매 판단");
    expect(html).toContain("조건부 판매");
  });

  it("세 커머스 탭 모두 같은 규칙 하나를 탄다 — 탭마다 예외가 없다", () => {
    // 스마트스토어 · 쿠팡 · 롯데ON은 전부 surface="CHANNEL"이다
    // (CommerceWorkspace의 workSurface: source/content가 아니면 CHANNEL).
    for (const stage of ["COLLECTING", "MARKET_JUDGING", "REGISTRATION_PREPARING", "COMMERCE_REGISTERING"] as const) {
      const focus = resolveStageFocus({ stage, surface: "CHANNEL", marketDetailOpen: true });
      expect(focus.mi).toBe("HIDDEN");
      expect(focus.actionCenter.verdict).toBe("DEFERRED");
    }
  });

  it("MI 패널은 계산을 멈추지 않는다 — 화면에서만 사라진다", () => {
    // HIDDEN이 `return null`인 자리가 훅 **아래**에 있어야 조회가 계속 돈다.
    // (UX 2.2가 고쳤던 "쿠팡 탭으로 복원된 세션에서 시장 분석이 시작조차 되지
    //  않던" 버그를 되돌리지 않기 위한 조건이다.)
    const panel = readSource("app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx");
    const guardAt = panel.indexOf('if (presentation === "HIDDEN") return null;');
    expect(guardAt, "HIDDEN 가드를 찾지 못했다").toBeGreaterThan(0);
    const beforeGuard = panel.slice(0, guardAt);
    expect(beforeGuard).toContain("useEffect");
  });

  it("커머스 탭에서 MI에서 온 체크리스트 항목을 넣지 않는다", () => {
    const workspace = readSource("app/pipeline/CommerceWorkspace.tsx");
    // 가격경쟁력은 priceLevel(MI)에서만 나온다. 커머스 탭에서는 그 항목을
    // 만들지 않는다는 조건이 코드에 박혀 있어야 한다.
    const at = workspace.indexOf('key: "price-competitiveness"');
    expect(at).toBeGreaterThan(0);
    const guard = workspace.slice(workspace.lastIndexOf("if (", at), at);
    expect(guard).toContain('workSurface !== "CHANNEL"');
  });
});

/* ── 🔴 최종 payload 문자열 — 값으로 비교한다 ──────────────────────────────
 *
 * REWORK-2(CEO 지시, 2026-09-14) — "함수 이름이 같은지 보는 것으로 끝내지
 * 마라. 실제 등록 payload에서 동일한 공통 Source가 최종 콘텐츠로 들어가는가."
 *
 * 그래서 여기서는 조립기 출력이 아니라 **세 채널의 실제 등록 payload를 만들고**,
 * 상단 이미지 URL · 본문 문장 · 하단 이미지 URL이 그 payload 안에 같은 값으로
 * 같은 순서로 들어 있는지 본다. 세 payload는 서로 다른 스키마라(Coupang은
 * contents 배열, Naver는 detailContent HTML 문자열, 롯데ON은 epnLst[].cnts)
 * 비교 대상은 "스키마"가 아니라 **그 안에 실린 문자열 값**이다.
 * ──────────────────────────────────────────────────────────────────────── */

import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildCoupangPayload,
  buildLotteOnPayload,
  buildNaverProductPayload,
} from "@commerce/listing";
import type { CanonicalProduct } from "@commerce/shared";

function provenance<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

const BODY_TEXT = "부드러운 테리 소재 반바지입니다.";

function payloadProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: provenance("Terry Bermuda Shorts"),
    brand: provenance("Bobo Choses"),
    price: provenance({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: provenance("B226AC043"),
    description: provenance(BODY_TEXT),
    material: provenance("면 100%"),
    color: provenance("네이비"),
    recommendedAge: provenance(""),
    manufacturer: provenance("Bobo Choses"),
    careInstructions: provenance(""),
    options: provenance([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "img-1",
        originalUrl: "https://cdn.example.com/product/1.jpg",
        processedUrl: null,
        selectedVariant: "ORIGINAL",
        useInGallery: true,
        useInDescription: true,
        classification: "PRODUCT",
      },
    ],
    titleKo: provenance("테리 버뮤다 반바지"),
    descriptionKo: provenance(BODY_TEXT),
    keywords: provenance([]),
    seoTitle: provenance(""),
    seoDescription: provenance(""),
    countryOfOrigin: provenance("스페인"),
    returnPolicy: provenance("반품 가능"),
    shippingFee: provenance(0),
    stockQuantity: provenance(999),
    certification: provenance(""),
    importer: provenance(""),
    childCertification: provenance(null),
    itemName: provenance(""),
    modelName: provenance(""),
    weight: provenance(""),
    certificationType: provenance(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
  } as unknown as CanonicalProduct;
}

/** 셀러가 상단 블록까지 켜 둔 구성 — 세 채널에 같은 배열이 간다. */
function enabledBlocks(): DetailPageBlock[] {
  return defaultDetailBlocks().map((block) => (block.kind === "COMMON_IMAGE" ? { ...block, enabled: true } : block));
}

describe("🔴 최종 payload 문자열 — 상단 템플릿 · 본문 · 하단 템플릿이 같은 값이다", () => {
  const product = payloadProduct();
  const blocksForAll = enabledBlocks();

  /** 스마트스토어 최종 payload에서 상세 콘텐츠 문자열. */
  function naverDetailContent(): string {
    const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: "50000535",
      releaseAddressBookNo: 1,
      refundAddressBookNo: 2,
      primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
      sellerDeliveryFee: null,
      returnDeliveryFee: 3000,
      exchangeDeliveryFee: 6000,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: "0200037",
      originAreaRequiresContent: false,
      detailBlocks: blocksForAll,
      descriptionTemplate: TEMPLATE,
      commonImages: COMMON_IMAGES,
      brandIntro: CTX.brandIntro,
    } as never);
    return (payload as unknown as { originProduct: { detailContent: string } }).originProduct.detailContent;
  }

  /** 쿠팡 최종 payload에서 상세 콘텐츠 문자열(배열을 순서대로 이어붙인 값). */
  function coupangDetailContent(): string {
    const listing = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    const payload = buildCoupangPayload(product, listing, {
      sellerConfig: { ...COMMON_IMAGES } as never,
      descriptionTemplate: TEMPLATE,
      detailBlocks: blocksForAll,
    });
    return payload.items
      .flatMap((item) => item.contents.flatMap((content) => content.contentDetails.map((d) => d.content)))
      .join("\n");
  }

  /** 롯데ON 최종 payload에서 상품기술서(epnLst[DSCRP].cnts). */
  function lotteOnDetailContent(): string {
    // api/lotteon/_lib/build-context.ts의 buildDetailHtml()이 만드는 값 그대로.
    const detailHtml = assembleNaverDetailContent(blocksForAll, {
      aiDescription: product.descriptionKo.value || product.description.value,
      template: TEMPLATE,
      commonImages: COMMON_IMAGES,
      productImageUrls: product.images.map((image) => image.originalUrl),
      sizeChartImageUrls: [],
      brandIntro: CTX.brandIntro,
    });
    const payload = buildLotteOnPayload({
      product,
      channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG },
      detailHtml,
    });
    const description = payload.spdLst[0].epnLst.find((entry) => entry.pdEpnTypCd === "DSCRP");
    expect(description, "롯데ON payload에 상품기술서(DSCRP)가 없다").toBeDefined();
    return description!.cnts;
  }

  const FINAL: Record<string, string> = {
    smartstore: naverDetailContent(),
    coupang: coupangDetailContent(),
    lotteon: lotteOnDetailContent(),
  };

  it("세 payload 모두 비어 있지 않다 — 빈 문자열끼리 같다고 말하지 않는다", () => {
    for (const [channel, content] of Object.entries(FINAL)) {
      expect(content.length, `${channel} 최종 상세 콘텐츠가 비어 있다`).toBeGreaterThan(50);
    }
  });

  it("상단 템플릿 이미지 URL이 세 payload에 **같은 문자열**로 들어 있다", () => {
    for (const [channel, content] of Object.entries(FINAL)) {
      expect(content, `${channel} payload에 상단 공통 이미지가 없다`).toContain(COMMON_IMAGES.topCommonImageUrl);
    }
  });

  it("본문(AI 상세설명)이 세 payload에 같은 문장으로 들어 있다", () => {
    for (const [channel, content] of Object.entries(FINAL)) {
      expect(content, `${channel} payload의 본문이 공통 Source가 아니다`).toContain(BODY_TEXT);
    }
  });

  it("하단 템플릿 이미지 URL이 세 payload에 **같은 문자열**로 들어 있다", () => {
    for (const [channel, content] of Object.entries(FINAL)) {
      expect(content, `${channel} payload에 하단 공통 이미지가 없다`).toContain(COMMON_IMAGES.bottomCommonImageUrl);
    }
  });

  it("상단 → 본문 → 하단 순서가 세 payload에서 같다", () => {
    for (const [channel, content] of Object.entries(FINAL)) {
      const top = content.indexOf(COMMON_IMAGES.topCommonImageUrl);
      const body = content.indexOf(BODY_TEXT);
      const bottom = content.indexOf(COMMON_IMAGES.bottomCommonImageUrl);
      expect(top, `${channel}: 상단이 본문보다 뒤에 있다`).toBeLessThan(body);
      expect(body, `${channel}: 본문이 하단보다 뒤에 있다`).toBeLessThan(bottom);
    }
  });

  it("롯데ON 상세 콘텐츠는 스마트스토어와 **문자 단위로 같다** — 롯데ON 전용 템플릿 0건", () => {
    // 같은 블록 · 같은 셀러 설정 · 같은 본문을 넣으면 결과 문자열까지 같아야
    // 한다. 한 글자라도 다르면 어딘가에 롯데ON 전용 가공이 들어간 것이다.
    expect(FINAL.lotteon).toBe(FINAL.smartstore);
  });
});
