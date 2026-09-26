// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { manufacturerFixture } from "./manufacturer-fixture";
import { fieldLabelOf, mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — **화면을 통째로 그려서**
 * "롯데ON 탭이 상품을 다시 만들지 않는다"를 확인한다.
 *
 * 소스 텍스트 검사(lotteon-channel-form.test.ts)는 "그 코드가 없다"를 증명한다.
 * 이 파일은 다른 명제를 본다: **셀러가 실제로 보는 화면에** 상품명/가격/옵션
 * 입력칸이 없고, 대신 그 값들이 어디서 왔는지가 읽히는가. 같은 실수를 두 층에서
 * 각각 잡는다(mi-ux-final.test.ts가 같은 이유로 존재한다).
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
  } as unknown as CanonicalProduct;
}

/**
 * REWORK-11 ①(2026-09-15) — **정적 렌더에서 실제 마운트로.**
 *
 * 롯데ON 탭도 이제 첫 화면에 ① 기본 상품정보만 펼치고 시작한다(스마트스토어·
 * 쿠팡과 같은 정책). 그래서 한 번 그려서 안쪽 글자를 읽던 방식으로는 "접혀
 * 있어서 없다"와 "화면에 아예 없다"를 구분할 수 없다 — 셀러가 하는 그대로
 * 섹션을 펼친 뒤에 읽는다.
 */
async function renderTab(): Promise<string> {
  const container = await mountExpanded(
    createElement(LotteOnRegistrationPanel, {
      product: makeProduct(),
      commonPrice: { priceKrw: 128000, resolved: true },
      commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
      onEditCommonInfo: () => {},
      manufacturerResolution: manufacturerFixture(),
    } as never),
  );
  return container.innerHTML;
}

afterEach(async () => {
  await unmountTab();
});

/** 셀러가 **읽는 글자**만 남긴다(태그를 통째로 지운다). */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 화면에 실제로 선 입력 요소들의 라벨.
 *
 * REWORK-11 ① — 예전에는 `<label>라벨<input …></label>` 구조를 정규식으로
 * 읽었다. 롯데ON 전용 TextField가 그렇게 그렸기 때문이다. 지금은 세 탭이 같은
 * 행 컴포넌트(FieldRow)를 쓰고, 거기서는 라벨과 입력칸이 **형제**다 —
 * 그래서 DOM에서 올라가며 찾는다(fieldLabelOf).
 */
function inputLabels(html: string): string[] {
  const host = document.createElement("div");
  host.innerHTML = html;
  return Array.from(host.querySelectorAll("input, textarea, select")).map((el) => fieldLabelOf(el));
}

describe("롯데ON 탭 — 실제로 그려지는 화면", () => {
  it("입력칸이 하나도 공통 상품정보를 묻지 않는다", async () => {
    const labels = inputLabels((await renderTab()));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      for (const forbidden of ["상품명", "판매가", "가격", "재고", "옵션", "이미지", "상세설명", "상세페이지"]) {
        expect(label, `롯데ON 탭이 공통 항목을 다시 묻고 있다: "${label}"`).not.toContain(forbidden);
      }
    }
  });

  it("입력칸은 전부 롯데ON 전용 네 축(카테고리·고시·인증·배송)과 코드값이다", async () => {
    const labels = inputLabels((await renderTab()));
    /* REWORK-14(CEO 실측 판정 3회차, 2026-09-15) — 라벨은 사람이 읽는 이름만
       들고 있다. 롯데ON API 필드명은 **사라진 것이 아니라** 라벨 뒤 ⓘ 안으로
       들어갔다(쿠팡이 이미 쓰던 InfoTip 형식 — 쿠팡·스마트스토어 라벨에는
       코드 병기가 0건이라 같은 자리의 글자 조판이 탭마다 달랐다). 셀러가
       판매자센터에서 같은 이름을 찾을 수 있어야 한다는 요구는 그대로이고,
       그 증명은 rework14-field-parity.test.ts ③이 한다. */
    /* REWORK-5 ③(CEO 실측 판정: FAIL — "다시 조회 → 번호 찾아서 입력") —
       표준/전시 카테고리번호는 이제 **입력칸이 아니다.** 셀러가 번호를 찾아
       적는 UX를 폐기하고 [카테고리 추천] → [선택] 하나로 남겼다. 그래서 이
       두 줄은 "있어야 한다"가 아니라 **"없어야 한다"**로 뒤집힌다. */
    expect(labels).not.toContain("표준카테고리번호 (scatNo)");
    expect(labels).not.toContain("전시카테고리번호 (dcatLst)");
    expect(labels).toContain("상품품목코드");
    expect(labels).toContain("고시 항목");
    expect(labels).toContain("안전인증 목록");
    expect(labels).toContain("수입대행코드");
    expect(labels).toContain("출고지번호");
    expect(labels).toContain("반품지번호");
    expect(labels).toContain("배송비정책번호");
    /* Commerce-6 F-7 — 「배송가능지역코드」에서 「코드」가 빠졌다. 라벨에 코드
       이름을 두면 셀러가 그것을 답으로 적는다(첫 LIVE 등록이 그렇게 거절됐다).
       🔴 칸이 «선다» 는 사실을 보는 이 검사의 뜻은 그대로다. */
    expect(labels).toContain("배송 가능 지역");
  });

  it("공통 정보는 값과 출처를 함께 읽어준다 — '다시 입력하라'가 아니라 '이걸 씁니다'", async () => {
    const text = visibleText((await renderTab()));
    expect(text).toContain("테리 버뮤다 반바지"); // 상품명(공통)
    expect(text).toContain("128,000원"); // 판매가격(공통 · 화면이 계산한 값 그대로)
    expect(text).toContain("옵션 없음 — 단품 1건으로 등록");
    expect(text).toContain("상품정보에서 수정");
    expect(text).toContain("다시 입력하지 않습니다");
  });

  it("공통 분류를 참고로 보여주되 롯데ON 카테고리와 섞지 않는다", async () => {
    const text = visibleText((await renderTab()));
    expect(text).toContain("참고 — 이 상품의 공통 분류");
    expect(text).toContain("Home › Kids › Shorts");
    expect(text).toContain("스마트스토어·쿠팡 카테고리를 덮어쓰지 않습니다");
  });

  it("'Preview'라는 글자가 화면에 없다", async () => {
    expect(visibleText((await renderTab()))).not.toContain("Preview");
  });

  /**
   * REWORK-2(CEO 지시, 2026-09-14) — 등록 버튼이 **우측 등록 요약**으로 올라갔고,
   * 문구를 정하는 곳도 스마트스토어·쿠팡과 같은 컴포넌트(RegistrationReadinessCard)가
   * 됐다. 그래서 확인 전 문구는 더 이상 "롯데ON에 등록"이 아니라 세 채널이 함께
   * 쓰는 문구다 — **게이트 자체는 한 글자도 바뀌지 않았다**(canRegister 하나).
   *
   * REWORK-7 ①(CEO 지시, 2026-09-15) — 그 문구가 상태별로 갈리지 않게 됐다.
   * 등록 전에는 세 채널 모두 언제나 [등록 시작]이고, **왜 못 누르는지**는 바로
   * 위 「남은 항목」이 말한다(퍼센트·상태 문구가 아니라 등록을 막는 조건 중심).
   * 게이트는 여전히 canRegister 하나라 disabled가 그대로 걸린다.
   */
  it("등록 버튼은 확인을 통과하기 전에는 잠겨 있다", async () => {
    const html = (await renderTab()).replace(/\s+/g, " ");
    expect(/<button[^>]*disabled[^>]*>등록 시작<\/button>/.test(html)).toBe(true);
    expect(html).toContain("등록 정보 확인을 통과해야 등록 버튼이 열립니다");
    // 확인 버튼은 잠기지 않는다 — 잠그면 여는 방법이 없어진다.
    expect(html).toContain(">등록 정보 확인</button>");
  });
});
