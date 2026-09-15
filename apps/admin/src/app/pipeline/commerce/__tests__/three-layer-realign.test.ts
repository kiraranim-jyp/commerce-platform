// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, LotteOnChannelInfo, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { PlatformPreview } from "../PlatformPreview";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { StageBody } from "../StageBody";
import { computeChecklistReadiness } from "../readiness";
import { resolveStageFocus } from "../stage-focus";
import { MARKET_SIGNAL_NOT_STARTED, resolveWorkflow } from "../workflow";
import {
  EMPTY_LOTTEON_CHANNEL_FORM,
  fromLotteOnChannelInfo,
  toLotteOnChannelInfo,
} from "../lotteon-channel-form";
import { manufacturerFixture } from "./manufacturer-fixture";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * 3층 구조 재정렬(CEO 지시, 2026-09-14) — **렌더 결과로만** 증명한다.
 *
 * CEO 명시: "변경 후 실제 렌더 화면을 기준으로 전수 확인하여, 롯데ON 탭에 공통
 * 상품정보 입력 input/textarea/select가 0개인지, 상품 정보에 롯데ON 관리정보가
 * 실제로 존재하는지 증명하십시오."
 *
 * 그래서 이 파일은 소스 텍스트를 한 줄도 읽지 않는다. 세 탭을 통째로 그려서
 * 실제로 선 <input>/<textarea>/<select>를 전수로 세고, 그 라벨을 나열한다.
 * "코드상 그렇다"로 여섯 번 틀린 저장소라 같은 방식으로 일곱 번째를 만들지 않는다.
 *
 * 목표 구조:
 *   상품 정보  ├─ 공통 상품정보  ├─ MI  └─ 커머스 관리정보(SS · 쿠팡 · 롯데ON)
 *   커머스 탭  = 등록 작업장 (카테고리는 여기서만 관리한다)
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
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
    ...overrides,
  } as unknown as CanonicalProduct;
}

/**
 * 셀러가 실제로 입력할 수 있는 칸 전수. 요소 종류 · 라벨 · 읽기전용 여부까지
 * 뽑는다. 라벨은 감싸는 <label> 안의 첫 <span>(이 저장소의 입력 컴포넌트들이
 * 전부 그 모양이다)이고, 없으면 aria-label / placeholder로 내려간다.
 */
interface RenderedInput {
  tag: "input" | "textarea" | "select";
  label: string;
  readOnly: boolean;
  type: string | null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tagHtml: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(tagHtml);
  return match ? match[1] : null;
}

/**
 * 이 저장소에는 입력칸에 라벨을 붙이는 방식이 **두 가지** 있다. 둘 다 읽는다 —
 * 한쪽만 읽으면 "0개"가 사실이 아니라 정규식의 사각지대가 된다.
 *
 *   ① 감싸는 형태  <label><span>표준카테고리번호 (scatNo)</span><input …></label>
 *                   → 롯데ON 탭(TextField / TextAreaField)
 *   ② 앞서는 형태  <label>소재</label> … <div><input …></div>
 *                   → 스마트스토어·쿠팡 탭(FieldRow)
 */
function collectInputs(html: string): RenderedInput[] {
  const found: { at: number; value: RenderedInput }[] = [];
  const consumed = new Set<number>();

  // ① 입력칸을 품고 있는 <label>.
  const labelPattern = /<label[^>]*>([\s\S]*?)<\/label>/g;
  const standaloneLabels: { end: number; text: string }[] = [];
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelPattern.exec(html)) !== null) {
    const whole = labelMatch[0];
    const block = labelMatch[1];
    const inner = /<(input|textarea|select)\b([^>]*)>/g;
    let innerMatch: RegExpExecArray | null;
    let hasInput = false;
    while ((innerMatch = inner.exec(block)) !== null) {
      hasInput = true;
      const at = labelMatch.index + whole.indexOf(innerMatch[0]);
      consumed.add(at);
      const spanMatch = /<span[^>]*>([\s\S]*?)<\/span>/.exec(block);
      found.push({
        at,
        value: {
          tag: innerMatch[1] as RenderedInput["tag"],
          label: spanMatch ? stripTags(spanMatch[1]) : stripTags(block).slice(0, 60),
          readOnly: /\breadonly\b/i.test(innerMatch[2]) || /\bdisabled\b/i.test(innerMatch[2]),
          type: attr(innerMatch[0], "type"),
        },
      });
    }
    // 입력칸을 품지 않은 <label>은 ②의 후보다(뒤따르는 입력칸의 이름).
    if (!hasInput) standaloneLabels.push({ end: labelMatch.index + whole.length, text: stripTags(block) });
  }

  // ② 남은 입력칸 — 바로 앞에 선 <label>을 자기 이름으로 쓴다.
  const bare = /<(input|textarea|select)\b([^>]*)>/g;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bare.exec(html)) !== null) {
    if (consumed.has(bareMatch.index)) continue;
    const attrs = bareMatch[2];
    const preceding = standaloneLabels.filter((l) => l.end <= bareMatch!.index).pop();
    found.push({
      at: bareMatch.index,
      value: {
        tag: bareMatch[1] as RenderedInput["tag"],
        label:
          preceding?.text ??
          attr(bareMatch[0], "aria-label") ??
          attr(bareMatch[0], "placeholder") ??
          "(라벨 없음)",
        readOnly: /\breadonly\b/i.test(attrs) || /\bdisabled\b/i.test(attrs),
        type: attr(bareMatch[0], "type"),
      },
    });
  }
  // 화면에 선 순서 그대로 돌려준다.
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.value);
}

/**
 * 라벨 비교용 정규화 — 괄호 안의 API 원문 필드명과 필수 표시(*), 공백을 지운다.
 * "브랜드번호 (brdNo)" → "브랜드번호",  "상품코드(SKU)" → "상품코드".
 */
function labelKey(label: string): string {
  return label.replace(/\([^)]*\)/g, "").replace(/[*\s]/g, "").trim();
}

/**
 * 공통 상품정보를 묻는 칸인가. CEO 지시 원문이 지목한 9개(상품명·브랜드·제조사·
 * 소재·색상·사용연령·품명·모델명·중량)와 나머지 공통 축이다.
 *
 * 🔴 부분 문자열이 아니라 **정확히 같은 이름**으로 본다. 부분 문자열로 보면
 * 롯데ON의 "브랜드번호(brdNo)"가 공통 "브랜드"로 잘못 잡힌다 — 그 둘은 전혀
 * 다른 값이다(하나는 브랜드명 문자열, 하나는 롯데ON이 발급한 코드).
 */
const COMMON_PRODUCT_LABELS = [
  "상품명",
  "브랜드",
  "제조사",
  "소재",
  "색상",
  "사용연령",
  "품명",
  "모델명",
  "중량",
  "상품코드",
  "판매가",
  "판매가격",
  "재고",
  "재고수량",
  "옵션",
  "옵션명",
  "이미지",
  "상세설명",
  "상세페이지",
];

function commonProductInputs(inputs: RenderedInput[]): RenderedInput[] {
  return inputs.filter((input) => COMMON_PRODUCT_LABELS.includes(labelKey(input.label)));
}

/* ── 롯데ON 탭 ─────────────────────────────────────────────────────────── */

/**
 * REWORK-11 ①(2026-09-15) — **정적 렌더에서 실제 마운트로.**
 *
 * 롯데ON 탭이 스마트스토어·쿠팡과 같은 펼침 정책을 쓰게 됐다(첫 화면에는 ① 기본
 * 상품정보만 열린다). 한 번 그려서 안쪽을 읽는 방식으로는 "접혀 있다"와 "화면에
 * 없다"가 구분되지 않으므로, 셀러가 하는 그대로 섹션을 펼친 뒤에 읽는다.
 */
async function renderLotteOnTab(channelInfo?: LotteOnChannelInfo): Promise<string> {
  const container = await mountExpanded(
    createElement(LotteOnRegistrationPanel, {
      product: makeProduct(),
      commonPrice: { priceKrw: 128000, resolved: true },
      commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
      channelInfo,
      onChannelInfoChange: () => {},
      onEditCommonInfo: () => {},
      manufacturerResolution: manufacturerFixture(),
    } as never),
  );
  return container.innerHTML;
}

afterEach(async () => {
  await unmountTab();
});

/* ── 스마트스토어 · 쿠팡 탭 ─────────────────────────────────────────────── */

function renderPlatformTab(platform: PlatformId): string {
  const product = makeProduct();
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
  return renderToStaticMarkup(
    createElement(PlatformPreview, {
      product,
      listing,
      categoryCandidates: [],
      listingStatus: "DRAFT" as const,
      listingResult: null,
      onUpdateField: () => {},
      onSelectCategory: () => {},
      onOpenListingModal: () => {},
      onRetryListing: () => {},
      developerMode: false,
      manufacturerResolution: manufacturerFixture(),
    }),
  );
}

/* ── 상품 정보 · 커머스 관리정보 ───────────────────────────────────────── */

const SAVED_LOTTEON: LotteOnChannelInfo = {
  category: { standardCategoryNo: "205001", displayCategoryNos: ["3001", "3002"] },
  notice: { itemCode: "23", articlesText: "0020:네이비\n0060:스페인" },
  certification: { safetyText: "CHL_CFM:CB123456789", importProxyCode: "NONE" },
  delivery: {
    outboundPlaceNo: "OW-77",
    returnPlaceNo: "RT-88",
    deliveryCostPolicyNo: "DC-99",
    deliveryRegionGroupCode: "RG-01",
    courierCode: "0001",
    returnCourierCode: "0001",
    weekdayCloseTime: "1400",
  },
  codes: { originCode: "OP-ES", taxTypeCode: "01", brandNo: "BR-4242", externalProductNo: "EPD-1" },
};

/**
 * REWORK-4 §1(CEO 지시, 2026-09-14) — 여기 있던 renderCommerceManagement()가
 * 사라졌다. 상품정보 탭의 「🛒 커머스 관리정보」 섹션을 없앴기 때문이다
 * (CommerceManagementSection.tsx 삭제). 아래 증명 3이 그 자리를 대신한다:
 * **화면에서는 사라졌고 저장은 그대로**라는 두 사실을 같이 못 박는다.
 */
function renderProductInfoBody(product: CanonicalProduct): string {
  const workflow = resolveWorkflow({
    collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
    market: MARKET_SIGNAL_NOT_STARTED,
    prepare: {
      productInfoOk: true,
      productInfoMissing: null,
      optionGroupCount: 0,
      imageCount: 6,
      detailReady: true,
      priceResolved: true,
      priceKrw: 128000,
      requiredFieldBlockingCount: 0,
    },
    register: { channels: [] },
  });
  return renderToStaticMarkup(
    createElement(StageBody, {
      focus: resolveStageFocus({
        stage: workflow.currentStepKey,
        surface: "PRODUCT",
        marketDetailOpen: false,
      }),
      workflow,
      channels: [],
      onGoToChannel: () => {},
      marketEvidence: createElement("div", null, "시장 근거"),
      archive: createElement("div", null, "기록"),
      surfaces: {
        source: createElement("div", null, "SOURCE"),
        images: createElement("div", null, "IMAGES"),
        price: createElement("div", null, "PRICE"),
        required: createElement(MissingFieldsBulkPanel, { product, onBulkApply: () => {} }),
      },
    }),
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

describe("증명 1 — 롯데ON 탭에 공통 상품정보 입력칸이 0개다", () => {
  it("입력칸은 존재하되, 그중 공통 상품정보를 묻는 것은 하나도 없다", async () => {
    const inputs = collectInputs(await renderLotteOnTab());
    // 0개라는 주장이 "아무것도 안 그려졌다"로 성립하지 않게 먼저 못 박는다.
    expect(inputs.length).toBeGreaterThan(0);
    const offending = commonProductInputs(inputs);
    expect(
      offending,
      `롯데ON 탭이 공통 상품정보를 다시 묻고 있다: ${offending.map((i) => i.label).join(" / ")}`,
    ).toEqual([]);
  });

  it("전수 나열 — 라벨이 전부 롯데ON API 필드명을 달고 있다", async () => {
    const labels = collectInputs(await renderLotteOnTab()).map((i) => i.label);
    // 라벨마다 괄호 안에 롯데ON 원문 필드명이 있다 = 우리가 지어낸 칸이 아니다.
    expect(labels).toEqual([
      // REWORK-4 §5 — 순서가 10섹션 골격을 따른다(⑤ 배송 → ⑦ 고시 → ⑧ KC).
      /* REWORK-5 ③(CEO 실측 판정: FAIL) — 여기 맨 앞에 있던
         "표준카테고리번호 (scatNo)" · "전시카테고리번호 (dcatLst)" 두 칸이
         **없어졌다.** 지운 것이지 옮긴 것이 아니다 — 셀러가 번호를 찾아 손으로
         적는 UX 자체를 폐기했고, 카테고리는 [카테고리 추천] → 후보 → [선택]
         하나로만 정해진다(선택 결과는 읽기 전용 요약으로 확인한다).
         나머지 칸의 집합은 한 건도 달라지지 않았다. */
      "출고지번호 (owhpNo)",
      "반품지번호 (rtrpNo)",
      "배송비정책번호 (dvCstPolNo)",
      "배송가능지역코드 (dvRgsprGrpCd)",
      "택배사코드 (hdcCd)",
      "반품택배사코드 (rtngHdcCd)",
      "평일 발송마감시간",
      "상품품목코드 (pdItmsCd)",
      "고시 항목 (pdItmsArtlLst)",
      "안전인증 목록 (sftyAthnLst)",
      "수입대행코드 (impPrxCd)",
      "원산지코드 (oplcCd)",
      "과세유형코드 (tdfDvsCd)",
      "브랜드번호 (brdNo)",
      "업체상품번호 (epdNo)",
    ]);
  });

  it("MI를 관리하지 않는다 — 판매 추천/비추천 어휘가 화면에 없다", async () => {
    const text = stripTags(await renderLotteOnTab());
    for (const word of ["판매 추천", "판매 비추천", "조건부 판매", "가격경쟁력", "가격 경쟁력"]) {
      expect(text, `롯데ON 탭에 MI 어휘가 새어 들어왔다: ${word}`).not.toContain(word);
    }
  });
});

describe("증명 2 — 롯데ON 관리값이 탭을 벗어났다 돌아와도 남아 있다", () => {
  /**
   * 탭 이동 = 이 컴포넌트의 언마운트/재마운트다(CommerceWorkspace가
   * `{tab === LOTTEON_TAB && <LotteOnRegistrationPanel …/>}`로 조건 렌더한다).
   * 그러므로 "돌아왔을 때 남아 있다"는 **상품에 저장된 값으로 새로 마운트했을
   * 때 그 값이 화면에 서 있는가**와 같은 명제다 — 그것을 그대로 그려서 본다.
   */
  it("저장된 값으로 다시 마운트하면 입력칸에 그 값이 들어 있다", async () => {
    const html = (await renderLotteOnTab(SAVED_LOTTEON));
    /* REWORK-5 ③ — 카테고리 두 값("205001" · "3001, 3002")이 이 목록에서
       빠졌다. 값이 사라진 것이 아니라 **입력칸이 사라졌다** — 이제 읽기 전용
       요약으로 서기 때문에 value 속성이 아니라 본문으로 확인한다(바로 아래
       별도 테스트). 나머지 롯데ON 고유 입력칸은 그대로다. */
    for (const saved of [
      "OW-77",
      "RT-88",
      "DC-99",
      "RG-01",
      "OP-ES",
      "BR-4242",
      "EPD-1",
      "NONE",
    ]) {
      expect(html, `저장된 롯데ON 값이 화면에 돌아오지 않았다: ${saved}`).toContain(`value="${saved}"`);
    }
    // textarea는 value 속성이 아니라 본문으로 그려진다.
    expect(html).toContain("0020:네이비");
    expect(html).toContain("CHL_CFM:CB123456789");
  });

  /**
   * REWORK-5 ③ — 카테고리도 **똑같이 살아 돌아온다**. 입력칸이 아니라 읽기
   * 전용 요약이 되었을 뿐, "탭을 벗어났다 돌아와도 남아 있다"는 명제는 한 점도
   * 약해지지 않았다는 것을 별도로 고정한다.
   */
  it("저장된 카테고리는 읽기 전용 요약으로 돌아온다 — 입력칸이 아닐 뿐 값은 남는다", async () => {
    const text = stripTags((await renderLotteOnTab(SAVED_LOTTEON)));
    expect(text).toContain("선택한 카테고리가 채운 값");
    expect(text, "저장된 표준카테고리번호가 화면에 돌아오지 않았다").toContain("205001");
    expect(text, "저장된 전시카테고리번호가 화면에 돌아오지 않았다").toContain("3001, 3002");
  });

  it("저장된 값이 없으면 빈 폼이다 — 없는 값을 지어내지 않는다", async () => {
    const html = await renderLotteOnTab();
    expect(html).toContain('value=""');
    expect(html).not.toContain("OW-77");
  });
});

describe("증명 3 — 상품정보 화면에서 커머스 관리정보가 사라졌고, 저장은 그대로다", () => {
  /**
   * REWORK-4 §1(CEO 지시, 2026-09-14) — 이 describe가 뒤집혔다.
   *
   * 직전 지시(3층 구조 재정렬)는 롯데ON 관리값을 상품정보에서도 읽어주게 했다.
   * 이번 지시는 그 **화면**을 없앤다 — 커머스 값을 보는 곳은 그 채널 탭 하나다.
   *
   * 🔴 다만 저장까지 없애는 것이 아니다. 그것을 지우면 c451e79가 고친 "탭을
   * 옮기면 롯데ON 입력이 전부 사라지던" 버그가 그대로 돌아온다. 그래서 이
   * 블록은 **두 명제를 한 자리에서** 본다: 화면에 없다 / 저장은 살아 있다.
   */
  it("상품정보 본문에 「🛒 커머스 관리정보」 섹션이 없다", async () => {
    const text = stripTags(renderProductInfoBody(makeProduct({ lotteOnChannelInfo: SAVED_LOTTEON })));
    expect(text).not.toContain("커머스 관리정보");
    expect(text).not.toContain("채널마다 따로 관리되는 값입니다");
  });

  it("상품정보 본문이 롯데ON 관리값을 한 건도 읽어주지 않는다", async () => {
    const html = renderProductInfoBody(makeProduct({ lotteOnChannelInfo: SAVED_LOTTEON }));
    for (const saved of ["OW-77", "RT-88", "DC-99", "BR-4242", "EPD-1", "205001"]) {
      expect(html, `상품정보 화면에 롯데ON 관리값이 남아 있다: ${saved}`).not.toContain(saved);
    }
  });

  it("🔴 저장은 그대로다 — 같은 값으로 롯데ON 탭을 열면 전부 들어 있다", async () => {
    // 화면 한 자리를 지웠을 뿐이라는 사실을, 저장을 읽는 쪽에서 직접 확인한다.
    const html = (await renderLotteOnTab(SAVED_LOTTEON));
    for (const saved of ["OW-77", "RT-88", "DC-99", "BR-4242", "EPD-1"]) {
      expect(html, `롯데ON 탭이 저장값을 잃었다: ${saved}`).toContain(`value="${saved}"`);
    }
    // REWORK-5 ③ — 카테고리는 입력칸이 아니라 요약 본문으로 돌아온다.
    expect(stripTags(html), "롯데ON 탭이 저장된 카테고리를 잃었다").toContain("205001");
  });
});

describe("증명 4 — 스마트스토어 · 쿠팡 탭의 입력 가능 필드 전수", () => {
  /**
   * ③은 (b)로 확정됐다(CEO): 기존 입력 흐름을 그대로 두고 "상품 정보에서
   * 관리된다"를 화면에 명시한다. 그러므로 이 테스트가 고정하는 것은
   * **입력칸이 살아 있다는 사실**과 **역할이 화면에 적혀 있다는 사실**이다.
   * (a)로 바뀌면 여기서 먼저 깨진다.
   */
  for (const platform of ["smartstore", "coupang"] as PlatformId[]) {
    it(`${platform} — 입력 가능 필드 전수(10개)가 전부 공통 상품정보다`, async () => {
      const inputs = collectInputs(renderPlatformTab(platform));
      expect(inputs.map((i) => `${i.tag}:${labelKey(i.label)}:${i.readOnly ? "RO" : "RW"}`)).toEqual([
        "input:상품명:RW",
        "input:브랜드:RW",
        "input:상품코드:RW",
        "input:제조사:RW",
        "input:소재:RW",
        "input:색상:RW",
        "input:사용연령:RW",
        "input:품명:RW",
        "input:모델명:RW",
        "input:중량:RW",
      ]);
      // 전부 공통 상품정보다 = 이 탭에 채널 전용 입력칸은 지금 하나도 없다.
      expect(commonProductInputs(inputs)).toHaveLength(inputs.length);
    });

    it(`${platform} — 공통 상품정보 입력칸이 살아 있고, 공유된다는 문구가 붙어 있다`, async () => {
      const html = renderPlatformTab(platform);
      const common = commonProductInputs(collectInputs(html));
      expect(common.length, `${platform} 탭의 공통 입력칸이 사라졌다 — (a)는 금지다`).toBeGreaterThan(0);
      // 흐름 보존의 조건: 이 칸이 상품 정보와 같은 값이라는 사실이 화면에 있다.
      expect(stripTags(html)).toContain("이 정보는 상품정보 탭과 공유됩니다");
    });

    it(`${platform} — 읽기 전용으로 바뀌지 않았다`, async () => {
      const common = commonProductInputs(collectInputs(renderPlatformTab(platform)));
      expect(common.every((input) => !input.readOnly)).toBe(true);
    });
  }
});

describe("증명 6 — 롯데ON 관리값을 고쳐도 상품 정보와 다른 채널은 변하지 않는다", () => {
  /**
   * CommerceWorkspace.updateLotteOnChannelInfo가 하는 일 그대로다:
   *   setProduct((prev) => ({ ...prev, lotteOnChannelInfo: info }))
   * 여기서 바뀌는 키가 하나뿐이라는 사실을 실제 객체 비교로 고정한다
   * (channel-price-no-mi.test.ts가 channelPriceOverrides에 대해 하는 그 검사와
   * 같은 모양이다 — 같은 층의 값이니 같은 계약을 진다).
   */
  function applyLotteOnChannelInfo(product: CanonicalProduct, info: LotteOnChannelInfo): CanonicalProduct {
    return { ...product, lotteOnChannelInfo: info };
  }

  it("바뀐 키는 lotteOnChannelInfo 하나뿐이다", async () => {
    const before = makeProduct();
    const after = applyLotteOnChannelInfo(before, SAVED_LOTTEON);
    const changed = (Object.keys(after) as (keyof CanonicalProduct)[]).filter((key) => after[key] !== before[key]);
    expect(changed).toEqual(["lotteOnChannelInfo"]);
  });

  it("공통 상품정보도 채널 가격도 손대지 않는다", async () => {
    const before = makeProduct();
    const after = applyLotteOnChannelInfo(before, SAVED_LOTTEON);
    expect(after.title).toBe(before.title);
    expect(after.brand).toBe(before.brand);
    expect(after.price).toBe(before.price);
    expect(after.priceOverrideKrw).toBe(before.priceOverrideKrw);
    expect(after.channelPriceOverrides).toBe(before.channelPriceOverrides);
  });

  it("폼 ↔ 저장을 왕복해도 값이 그대로다", async () => {
    expect(toLotteOnChannelInfo(fromLotteOnChannelInfo(SAVED_LOTTEON))).toEqual(SAVED_LOTTEON);
  });

  it("이 필드를 모르던 과거 스냅샷(키 없음)도 그냥 '아직 입력 안 함'이 된다", async () => {
    const legacy = makeProduct();
    expect("lotteOnChannelInfo" in legacy).toBe(false);
    expect(fromLotteOnChannelInfo(legacy.lotteOnChannelInfo)).toEqual(EMPTY_LOTTEON_CHANNEL_FORM);
  });
});

describe("증명 5 — 채널 readiness는 자기 카테고리만 본다(상품 수준 게이트 제거 후)", () => {
  /**
   * ②의 핵심. 상품 수준에서 "카테고리 확정"을 빼도 등록이 느슨해지지 않는다는
   * 것을, 각 채널의 readiness가 **자기** 카테고리로만 판정한다는 사실로 보인다.
   *
   * computeChecklistReadiness는 `category` 인자 하나만 읽는다. 호출부
   * (CommerceWorkspace.provisionalReadiness)가 categoryMappings[platform]을
   * 넘기므로, 쿠팡을 확정해도 스마트스토어의 판정은 움직이지 않는다.
   */
  function categoryItem(category: CategorySelection) {
    const summary = computeChecklistReadiness([], category);
    return summary.required.find((item) => item.label === "카테고리");
  }

  it("확정되지 않은 카테고리면 그 채널의 필수 항목이 통과하지 않는다", async () => {
    expect(categoryItem(UNRESOLVED_CATEGORY)?.passed).toBe(false);
    expect(categoryItem(UNRESOLVED_CATEGORY)?.required).toBe(true);
  });

  it("한 채널의 확정이 다른 채널 판정으로 새지 않는다 — 인자가 하나뿐이다", async () => {
    // isVerifiedCategorySelected()가 통과시키는 유일한 모양 —
    // state가 SELECTED/CONFIRMED이고 candidate.isVerifiedPlatformCode가 true.
    const confirmed: CategorySelection = {
      state: "SELECTED",
      provenance: "USER_SELECTED",
      candidate: {
        categoryCode: 50000807,
        categoryName: "반바지",
        path: ["패션의류", "유아동", "반바지"],
        score: 1,
        isVerifiedPlatformCode: true,
      },
    } as unknown as CategorySelection;
    // 쿠팡만 확정한 상태를 그대로 두 번 물어본다: 확정된 값으로 물으면 통과하고,
    // 확정되지 않은 값(= 스마트스토어의 현재 상태)으로 물으면 통과하지 않는다.
    expect(categoryItem(confirmed)?.passed).toBe(true);
    expect(categoryItem(UNRESOLVED_CATEGORY)?.passed).toBe(false);
  });

  it("③ 등록 준비 체크리스트에는 카테고리 항목 자체가 없다", async () => {
    // 상품 수준이 카테고리를 묻지 않는다는 것을 workflow 결과로 직접 본다.
    const wf = resolveWorkflow({
      collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
      market: MARKET_SIGNAL_NOT_STARTED,
      prepare: {
        productInfoOk: true,
        productInfoMissing: null,
        optionGroupCount: 0,
        imageCount: 6,
        detailReady: true,
        priceResolved: true,
        priceKrw: 128000,
        requiredFieldBlockingCount: 0,
      },
      register: { channels: [] },
    });
    const prepare = wf.steps[2];
    expect(prepare.subSteps.map((s) => s.key)).not.toContain("category");
    // 커머스 카테고리를 하나도 확정하지 않았는데도 ③이 끝나고 ④가 열린다.
    expect(prepare.done).toBe(true);
  });
});
