import { describe, expect, it } from "vitest";
import { coupangAdapter } from "@commerce/marketplace";
import { resolveSourceStock } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { BLANK_LOTTEON_CHANNEL_CONFIG, buildLotteOnSalePeriod, validateLotteOnPayload } from "@commerce/listing";
import { makeProduct } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 E2E — **아동의류 실상품 1개가 세 채널을 끝까지 통과한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 대상: Bobo Choses «Terry Bermuda Shorts»(B226AC043) — bobochoses.com,
 * EUR 50, 원산지 스페인. CEO 화면에 실제로 올라온 그 상품이다(fixture 재사용,
 * 새 상품을 만들지 않았다).
 *
 * 🔴 이 테스트가 «할 수 없는» 것부터 적는다. 실등록은 여기서 일어나지 않는다 —
 * 로컬에 Supabase·네이버·쿠팡·롯데ON 자격증명이 하나도 없고(실행으로 확인),
 * QA 프록시는 «배포본»(origin/main)으로 가므로 미푸시 변경을 태우지 못한다.
 * 그래서 네트워크 «직전» 까지를 고정한다: Common → 어댑터 → 검증기 → 부족 항목.
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * CPO 가 말한 핵심 하나다: **「입력했는데 다음 단계에서 사라지는 문제」가 없다.**
 * 그래서 「무엇이 부족한가」가 아니라 «셀러가 채운 값이 끝까지 가는가» 를 본다.
 */

/** 셀러가 상품정보에서 채울 수 있는 것을 «전부» 채운 상태. */
function filledProduct(): CanonicalProduct {
  const edited = <T,>(value: T) => ({ value, source: "USER_EDITED" as const, confidence: 1 });
  return {
    ...makeProduct(),
    manufacturer: edited("보보쇼즈"),
    importer: edited("따조무역"),
    itemName: edited("아동용 반바지"),
    modelName: edited("B226AC043"),
    weight: edited("150g"),
    material: edited("면 100%"),
    color: edited("블루"),
    recommendedAge: edited("4-5세"),
    stockQuantity: edited(12),
    childCertification: edited({ type: "CHL_SFT", number: "CB123456" }),
    descriptionKo: edited("테리 버뮤다 반바지입니다."),
    images: [
      {
        id: "img-1",
        originalUrl: "https://bobochoses.com/img/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    /* childCertification 이 리터럴 객체라 구조가 정확히 겹치지 않는다 —
       fixture 조립이라 unknown 을 한 번 거친다(프로덕션 코드가 아니다). */
  } as unknown as CanonicalProduct;
}

const lotteOn = (product: CanonicalProduct) =>
  validateLotteOnPayload({
    product,
    channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG, ...buildLotteOnSalePeriod(new Date("2026-09-26T00:00:00Z")) },
    detailHtml: "<p>테리 버뮤다 반바지입니다.</p>",
  });

const coupang = (product: CanonicalProduct) =>
  coupangAdapter.toListingModel(product, { state: "UNRESOLVED", candidate: null } as never, undefined, "coupang");

describe("① 🔴 셀러가 채운 값은 «사라지지 않는다»", () => {
  it("재고 12개가 그대로 사실로 읽힌다 — 999 에 덮이지 않는다", () => {
    const fact = resolveSourceStock(filledProduct());
    expect(fact.state).toBe("IN_STOCK");
    expect(fact.quantity).toBe(12);
  });

  it("다 채우면 쿠팡에 ERROR 가 하나도 남지 않는다(카테고리는 별도 게이트)", () => {
    const errors = coupang(filledProduct())
      .validations.filter((v) => v.status === "ERROR")
      .map((v) => v.label);
    expect(errors).toEqual([]);
  });

  /* 🔴 롯데ON 에 남는 차단은 «전부» 채널이 발급하는 코드다. 상품정보에서 채울
     수 있는 것이 남아 있으면 그것은 「사라진 값」이다 — 그 구분을 고정한다. */
  it("롯데ON 에 남는 차단은 전부 «채널 코드» 다 — 상품 값이 아니다", () => {
    const stuck = lotteOn(filledProduct())
      .fields.filter((f) => f.status !== "READY")
      .map((f) => f.label);
    expect(stuck.sort()).toEqual(
      [
        "거래처 정보",
        "고시 항목",
        "배송가능지역코드",
        "배송비정책번호",
        "상품품목코드(고시)",
        "원산지코드",
        "전시카테고리",
        "출고지번호",
        "표준카테고리",
        "회수지(반품지)번호",
      ].sort(),
    );
  });

  it("상품명·판매가·이미지·상세·옵션·재고는 전부 READY 다", () => {
    const ready = new Set(
      lotteOn(filledProduct())
        .fields.filter((f) => f.status === "READY")
        .map((f) => f.label),
    );
    for (const label of ["판매자상품명", "판매가", "대표 이미지", "상품기술서", "옵션(단품)", "재고"]) {
      expect(ready.has(label), `${label} 가 READY 가 아니다`).toBe(true);
    }
  });
});

describe("② 원본 재고를 «모를» 때 — 막지 않고 알린다", () => {
  it("UNKNOWN 은 쿠팡 등록을 막지 않는다", () => {
    const blocked = coupang(makeProduct()).validations.filter((v) => v.status === "ERROR" && v.label === "재고");
    expect(blocked).toEqual([]);
  });

  it("🔴 다만 조용하지도 않다 — 쿠팡이 WARNING 으로 사실을 말한다", () => {
    const warn = coupang(makeProduct()).validations.find((v) => v.label === "원본 재고 확인");
    expect(warn?.status).toBe("WARNING");
  });

  it("롯데ON 은 라벨로 말한다 — READY 지만 「원본 미확인」이다", () => {
    const stock = lotteOn(makeProduct()).fields.find((f) => f.field === "itmStkQty");
    expect(stock?.status).toBe("READY");
    expect(stock?.label).toBe("재고(원본 미확인)");
  });
});

describe("③ 🔴 이 상품이 «지금» 등록되지 못하는 이유", () => {
  /* E2E 의 결론을 숫자로 고정한다. 이 셋이 풀리면 롯데ON 등록이 열린다 —
     그리고 셋 다 상품정보가 아니라 «채널/설정» 쪽이다. */
  it("롯데ON 차단 사유는 인증 · 카테고리 · 판매자 인프라 세 갈래뿐이다", () => {
    const codes = new Set(
      lotteOn(filledProduct())
        .fields.filter((f) => f.status === "BLOCKED")
        .map((f) => f.code),
    );
    expect(codes).toEqual(
      new Set(["IDENTITY_REQUIRED", "CATEGORY_REQUIRED", "NOTICE_REQUIRED", "SELLER_PLACE_REQUIRED"]),
    );
  });

  /* 🔴 C-2 가 STOP 한 그 네 값이 여기서 다시 나온다 — 저장할 곳이 없어서
     셀러가 «매 상품마다» 다시 고른다. E2E 가 그 비용을 확인해 준다. */
  it("판매자 인프라 4값이 상품마다 반복된다는 사실이 남아 있다", () => {
    const places = lotteOn(filledProduct())
      .fields.filter((f) => f.code === "SELLER_PLACE_REQUIRED")
      .map((f) => f.label);
    expect(places).toHaveLength(4);
  });
});
