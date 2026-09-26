// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  describeLotteOnSellerSettings,
  resolveLotteOnShipBudgetDays,
  validateLotteOnPayload,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { PlatformPreview } from "../PlatformPreview";
import { computeChecklistReadiness } from "../readiness";
import { computeLotteOnRegistrationReadiness } from "../lotteon-channel-form";
import { REGISTRATION_SECTION_KEYS, sectionTitle } from "../registration-sections";
import { manufacturerFixture } from "./manufacturer-fixture";
import { fieldLabelOf, mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * REWORK — 커머스 탭 구조 통일(CEO 지시, 2026-09-14).
 *
 * 지시서의 **필수 검증 표**를 실제 실행 결과로 채우기 위한 파일이다. 그래서
 * 여기에는 소스 텍스트 검사가 한 줄도 없다 — 세 탭을 `react-dom/server`로 통째로
 * 그리고, payload는 실제 build/validate 함수로 만든다.
 *
 * 검증 표의 각 칸은 아래 describe 하나와 1:1로 대응한다:
 *
 *   1. 상품정보 자동 반영      값을 바꾼 상품으로 다시 그려서 화면이 따라오는가
 *   2. 셀러 설정 자동 반영      값을 바꾼 셀러 설정으로 다시 그려서 따라오는가
 *   3. 공통값 별도 입력 필요     탭에 선 입력칸의 라벨 전수
 *   4. 채널 고유값 입력        같은 전수에서 채널 전용 칸이 있는가
 *   5. 독립 카테고리          한 채널의 확정이 다른 채널로 새는 경로가 있는가
 *   6. 독립 readiness        계산 함수의 인자에 다른 채널이 들어가는가
 *   7. MI와 readiness 독립     MI 값이 등록 판정에 닿는 배선이 있는가
 *
 * 🔴 "코드상 그렇다"로 여섯 번 틀린 저장소다. 결론은 전부 렌더 결과 · 실제 payload
 *    값으로만 적는다.
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

/** 셀러 설정(배송 프로필)의 롯데ON이 읽는 부분 — 값을 바꿔가며 반영을 본다. */
function makeSellerSettings(overrides: Partial<LotteOnSellerSettingsInput> = {}): LotteOnSellerSettingsInput {
  return {
    outboundLeadTimeDays: 2,
    deliveryCompanyCode: "CJGLS",
    naverDeliveryCompanyCode: "CJ대한통운",
    outboundShippingPlaceCode: 7788,
    returnCenterCode: "RC-1004",
    topCommonImageEnabled: true,
    bottomCommonImageEnabled: false,
    ...overrides,
  };
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
 * REWORK-2(CEO 지시, 2026-09-14) — 한 탭의 렌더 결과를 **좌측 상세 / 우측 요약**
 * 두 덩어리로 가른다.
 *
 * 클래스 이름이 아니라 공용 프레임이 붙인 `data-frame`으로 찾는다. Tailwind
 * 유틸리티 하나만 바뀌어도 "좌우가 실제로 갈렸는가"를 보던 검사가 조용히
 * 무력해지기 때문이다 — 이 저장소가 "코드상 그렇다"로 여러 번 틀린 자리다.
 */
function columnsOf(html: string): { left: string; right: string } {
  const root = new JSDOM(`<!doctype html><body>${html}</body>`).window.document.body.firstElementChild;
  if (!root) throw new Error("렌더 결과가 비어 있다");
  if (root.getAttribute("data-frame") !== "channel-registration") {
    throw new Error("공용 등록 프레임(data-frame=channel-registration)이 최상위에 없다 — 세로형 화면이다");
  }
  const [left, right] = Array.from(root.children);
  return { left: left?.innerHTML ?? "", right: right?.innerHTML ?? "" };
}

/**
 * 화면에 **실제로 선** 입력 요소 전수. three-layer-realign.test.ts가 쓰는 것과
 * 같은 수집기다(라벨 붙이는 방식이 저장소에 두 가지라 둘 다 읽는다).
 */
interface RenderedInput {
  tag: "input" | "textarea" | "select";
  label: string;
  readOnly: boolean;
}

function collectInputs(html: string): RenderedInput[] {
  const found: { at: number; value: RenderedInput }[] = [];
  const consumed = new Set<number>();

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
        },
      });
    }
    if (!hasInput) standaloneLabels.push({ end: labelMatch.index + whole.length, text: stripTags(block) });
  }

  const bare = /<(input|textarea|select)\b([^>]*)>/g;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bare.exec(html)) !== null) {
    if (consumed.has(bareMatch.index)) continue;
    const preceding = standaloneLabels.filter((l) => l.end <= bareMatch!.index).pop();
    found.push({
      at: bareMatch.index,
      value: {
        tag: bareMatch[1] as RenderedInput["tag"],
        label: preceding?.text ?? attr(bareMatch[0], "aria-label") ?? attr(bareMatch[0], "placeholder") ?? "(라벨 없음)",
        readOnly: /\breadonly\b/i.test(bareMatch[2]) || /\bdisabled\b/i.test(bareMatch[2]),
      },
    });
  }
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.value);
}

function labelKey(label: string): string {
  return label.replace(/\([^)]*\)/g, "").replace(/[*\s]/g, "").trim();
}

/** CEO 지시 원문이 지목한 공통 상품정보 축. */
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

/* ── 렌더 ────────────────────────────────────────────────────────────────── */

function lotteOnElement(
  options: { product?: CanonicalProduct; sellerSettings?: LotteOnSellerSettingsInput | null } = {},
) {
  return createElement(LotteOnRegistrationPanel, {
    product: options.product ?? makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: options.sellerSettings,
    onEditCommonInfo: () => {},
    manufacturerResolution: manufacturerFixture(),
  } as never);
}

/**
 * REWORK-11 ①(2026-09-15) — **정적 렌더에서 실제 마운트로.**
 *
 * 롯데ON 탭도 첫 화면에 ① 기본 상품정보만 펼치고 시작한다(스마트스토어·쿠팡과
 * 같은 정책). 정적 렌더로는 "접혀 있다"와 "화면에 없다"가 구분되지 않으므로,
 * 셀러가 하듯 섹션을 펼친 뒤 읽는다.
 */
async function renderLotteOnTab(options: {
  product?: CanonicalProduct;
  sellerSettings?: LotteOnSellerSettingsInput | null;
} = {}): Promise<string> {
  const container = await mountExpanded(lotteOnElement(options));
  return container.innerHTML;
}

afterEach(async () => {
  await unmountTab();
});

function renderPlatformTab(
  platform: PlatformId,
  options: { product?: CanonicalProduct; settingsMissing?: string[]; settingsRecommended?: string[] } = {},
): string {
  const product = options.product ?? makeProduct();
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
  return renderToStaticMarkup(
    createElement(PlatformPreview, {
      product,
      listing,
      categoryCandidates: [],
      listingStatus: "DRAFT" as const,
      listingResult: null,
      settingsMissing: options.settingsMissing,
      settingsRecommended: options.settingsRecommended,
      onUpdateField: () => {},
      onSelectCategory: () => {},
      onOpenListingModal: () => {},
      onRetryListing: () => {},
      developerMode: false,
      manufacturerResolution: manufacturerFixture(),
    }),
  );
}

const PLATFORM_TABS: PlatformId[] = ["smartstore", "coupang"];

/* ─────────────────────────────────────────────────────────────────────── */

describe("골격 — CEO 지시서의 섹션 구조와 실제 렌더 순서가 같다", () => {
  /**
   * 화면에 실제로 선 제목과 그룹 이름표를 순서대로.
   *
   * 세 종류를 읽는다 — 세 탭이 쓰는 제목 표기가 실제로 그 셋이기 때문이다:
   *   1. 접히지 않는 카드(등록 상태 · 등록 가능성)의 h3
   *   2. 그룹 이름표(uppercase)
   *   3. **CollapsibleSection의 제목** — REWORK(2026-09-14)에서 ①~⑦ 섹션이
   *      스마트스토어·쿠팡 탭과 같은 컴포넌트를 쓰게 되면서 제목이 h3가 아니라
   *      아코디언 머리의 span이 됐다. 기대 목록(아래 toEqual)은 한 줄도 바뀌지
   *      않는다 — 바뀐 것은 제목을 그리는 컴포넌트뿐이고, 그것이 이번 작업의
   *      목적이다(세 탭이 같은 섹션 껍데기를 쓴다).
   */
  function sectionTitles(html: string): string[] {
    const found: { at: number; text: string }[] = [];
    const heading = /<(h3|p)[^>]*class="[^"]*(?:text-sm font-semibold text-text-primary|uppercase tracking-wide text-text-tertiary)[^"]*"[^>]*>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = heading.exec(html)) !== null) found.push({ at: match.index, text: stripTags(match[2]) });

    const accordion = /<span[^>]*class="[^"]*text-sm font-medium text-text-primary[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
    while ((match = accordion.exec(html)) !== null) found.push({ at: match.index, text: stripTags(match[1]) });

    return found.sort((a, b) => a.at - b.at).map((entry) => entry.text);
  }

  it("롯데ON 탭 **좌측 등록 상세**의 섹션이 지시서 골격 순서 그대로 선다", async () => {
    /* REWORK-2(CEO 지시, 2026-09-14) — 등록 상태 · 등록 가능성이 이 목록에서
       빠졌다. 지운 것이 아니라 **우측 등록 요약으로 옮겼다**(바로 아래 테스트가
       우측에 있다는 사실을 렌더 결과로 고정한다). 좌측에 남는 것은 CEO 프레임의
       "좌측 · 등록 상세"뿐이다. */
    const titles = sectionTitles(columnsOf(await renderLotteOnTab({ sellerSettings: makeSellerSettings() })).left);
    expect(titles).toEqual([
      /* REWORK-10 C(CEO 지시, 2026-09-15) — 여기 있던 "이 탭에서 정하는 것" 안내
         박스가 사라졌다. 스마트스토어·쿠팡 좌측 상세는 10섹션 골격으로 바로
         시작하는데 롯데ON만 그 앞에 자기 블록을 갖고 있었다(같은 이유로
         「등록을 막고 있는 필수 조건」·「부족한 정보」 두 블록도 없어졌다 —
         셋 다 우측 요약과 ⑩ 등록정보에 이미 있는 내용이었다). */
      /* REWORK-4 §5(CEO 지시, 2026-09-14) — 여기부터 **10섹션 골격** 그대로다.
         이전 순서는 롯데ON만의 것이었고(상품정보 → 셀러설정 → 카테고리 → 고시
         → 안전인증 → 배송, 6/10) ③ 옵션 · ④ 가격 · ⑨ 상세설명 · ⑩ 등록정보가
         아예 없었다. 넷 다 **읽기 전용 요약**으로 붙었다 — 아래 "채널 고유값
         입력" 테스트가 이 탭의 입력칸이 여전히 롯데ON 고유값뿐임을 같은 렌더
         결과로 고정한다. */
      "① 기본 상품정보",
      "② 카테고리",
      "③ 옵션",
      "④ 가격",
      "⑤ 배송",
      "⑥ 배송정책 · 반품/교환",
      "⑦ 고시정보",
      "⑧ KC / 인증",
      "⑨ 상세설명",
      "⑩ 등록정보",
      /* 골격 뒤에 붙는 **채널 고유 항목**(CEO 표의 "+ 채널 고유 항목").
         REWORK-13B(CEO 지시, 2026-09-15: "롯데ON 고유 데이터는 ⑩ 이후 별도
         영역으로 붙인다 — ⑪ …") — 이 자리의 제목에 번호가 붙었다. 공통 골격이
         어디서 끝나고 고유 영역이 어디서 시작하는지가 화면의 번호로 읽힌다. */
      "롯데ON 고유 영역",
      "⑪ 롯데ON 고유 코드",
    ]);
  });

  /**
   * REWORK-4 §5 — 골격 달성도를 **렌더 결과에서 센다.**
   *
   * 지시서의 10개가 화면에 실제로 몇 개 서 있는지를 눈으로 비교하지 않는다.
   * 목차는 registration-sections.ts 하나뿐이므로, 그 목록을 그대로 순회해서
   * 제목이 있는지 본다 — 이름을 손으로 적으면 목차가 다시 두 벌이 된다.
   */
  it("롯데ON 좌측 상세가 10섹션 골격을 10/10 갖춘다", async () => {
    const titles = sectionTitles(columnsOf(await renderLotteOnTab({ sellerSettings: makeSellerSettings() })).left);
    const missing = REGISTRATION_SECTION_KEYS.filter(
      (key) => !titles.some((title) => title.startsWith(sectionTitle(key))),
    );
    expect(missing, `롯데ON 좌측에 없는 골격 섹션: ${missing.join(" / ")}`).toEqual([]);
  });

  /**
   * REWORK-7 ①·②(CEO 지시, 2026-09-15) — 우측 요약의 목차가 바뀌었다.
   *
   * 「등록 상태」(롯데ON 연결 · 직전 등록 결과)는 좌측 상세 맨 아래로 내려갔다 —
   * 스마트스토어·쿠팡이 같은 성격의 사실(ListingSection)을 처음부터 거기 두고
   * 있었기 때문이다. 「등록 가능성 N%」는 「등록 준비 상태」+「필수 확인」으로
   * 바뀌었다(퍼센트보다 등록을 막는 조건 중심). [등록 정보 확인] → [등록 시작]
   * 버튼 순서는 그대로다.
   */
  it("등록 준비 상태 · 필수 확인 · [등록 정보 확인] · [등록 시작]이 전부 우측 요약에 있다", async () => {
    const { right, left } = columnsOf(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    const text = stripTags(right);
    expect(text).toContain("등록 준비 상태");
    expect(text).toContain("필수 확인");
    // CEO 프레임의 버튼 순서 — [등록 정보 확인] 다음에 [등록 시작].
    const confirmButton = right.indexOf(">등록 정보 확인<");
    const registerButton = right.indexOf(">등록 시작<");
    expect(confirmButton).toBeGreaterThan(-1);
    expect(registerButton).toBeGreaterThan(confirmButton);
    // 좌측 상세에는 등록 행동이 남아 있지 않다 — 행동은 한 곳에서만.
    expect(left).not.toContain(">등록 정보 확인<");
    expect(left).not.toContain(">등록 시작<");
    /* REWORK-10 C-2(CEO 지시, 2026-09-15) — 「등록 상태」 카드가 **없어졌다.**
       스마트스토어·쿠팡의 ListingSection은 등록을 시도한 적이 없으면 아무것도
       그리지 않는데(ListingSection.tsx L166), 롯데ON만 항상 이 카드를 세우고
       "아직 이 화면에서 등록한 적이 없습니다"를 적고 있었다. 이제 같은 게이트다. */
    expect(text, "우측 요약에 한 채널만의 칸이 없다").not.toContain("등록 상태");
    expect(stripTags(left), "등록 전에는 좌측에도 상태 카드가 서지 않는다").not.toContain("등록 상태");
    // 채널 연결 사실은 지우지 않았다 — ⑩ 등록정보 안으로 들어갔다.
    expect(stripTags(left)).toContain("롯데ON 연결");
  });

  it("세 탭이 같은 프레임을 쓴다 — 좌측 상세 · 우측 요약", async () => {
    const rendered: [string, string][] = [
      ["smartstore", renderPlatformTab("smartstore")],
      ["coupang", renderPlatformTab("coupang")],
      ["lotteon", await renderLotteOnTab({ sellerSettings: makeSellerSettings() })],
    ];
    for (const [name, html] of rendered) {
      const { left, right } = columnsOf(html);
      expect(left.length, `${name}: 좌측 상세가 비어 있다`).toBeGreaterThan(0);
      expect(right.length, `${name}: 우측 요약이 비어 있다`).toBeGreaterThan(0);
      // 우측 요약은 세 채널 모두 같은 네 칸 중 ①②④를 항상 갖는다.
      expect(stripTags(right), `${name}: 우측에 등록 준비 상태가 없다`).toContain("등록 준비 상태");
      expect(stripTags(right), `${name}: 우측에 필수 확인이 없다`).toContain("필수 확인");
      expect(/<button[^>]*>등록 시작</.test(right), `${name}: 우측에 [등록 시작]이 없다`).toBe(true);
    }
  });

  it("세 탭 어디에도 MI 어휘가 없다 — 커머스 탭의 질문은 등록 하나다", async () => {
    const rendered: [string, string][] = [
      ["smartstore", renderPlatformTab("smartstore")],
      ["coupang", renderPlatformTab("coupang")],
      ["lotteon", await renderLotteOnTab({ sellerSettings: makeSellerSettings() })],
    ];
    const MI_WORDS = [
      "판매 판단",
      "판매 추천",
      "판매 비추천",
      "조건부 판매",
      // REWORK-4 §4(CEO 지시, 2026-09-14) — 띄어쓴 "가격 경쟁력"도 함께 막는다.
      // CEO가 지목한 표기는 띄어쓴 쪽인데 이 목록엔 붙여쓴 것만 있었다 —
      // 한 글자 차이로 검사를 빠져나가는 어휘를 남겨두지 않는다.
      "가격경쟁력",
      "가격 경쟁력",
      "예상 마진",
      "국내 비교상품",
      "시장 판단",
      "Market Intelligence",
      "국내 시장",
      "해외 시장",
      "판단 근거",
    ];
    for (const [name, html] of rendered) {
      const text = stripTags(html);
      for (const word of MI_WORDS) {
        expect(text, `${name} 탭에 MI 어휘가 새어 들어왔다: ${word}`).not.toContain(word);
      }
    }
  });

  it("섹션 명칭은 스마트스토어·쿠팡의 기존 어휘를 재사용한다", async () => {
    const text = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    // 쿠팡/스마트스토어 탭의 셀러 설정 카드 제목 그대로.
    expect(text).toContain("배송 정책 · 반품/교환");
    // 준비도 카드의 BUSINESS_SETTINGS 그룹 문구 그대로.
    expect(text).toContain("Settings에서 한 번만 하면 됩니다");
    // settingsMissing 배너의 버튼 문구 그대로.
    expect(text).toContain("설정하러 가기");
  });
});

describe("표 1행 — 상품정보 자동 반영", () => {
  /**
   * "자동 반영"의 정의: **상품정보의 값을 바꾸면 그 탭이 새 값을 말한다.**
   * 탭이 자기 사본을 들고 있으면 이 테스트가 깨진다.
   */
  it("LOTTEON — 상품정보를 바꾸면 롯데ON 탭이 새 값을 읽는다", async () => {
    const before = stripTags(await renderLotteOnTab());
    expect(before).toContain("테리 버뮤다 반바지");

    const after = stripTags(
      await renderLotteOnTab({ product: makeProduct({ titleKo: field("변경된 상품명 · 니트 조끼") }) }),
    );
    expect(after).toContain("변경된 상품명 · 니트 조끼");
    expect(after).not.toContain("테리 버뮤다 반바지");
  });

  it("LOTTEON — 고시로 쓸 공통 값(소재·색상)도 상품정보를 바꾸면 따라온다", async () => {
    const after = stripTags(
      await renderLotteOnTab({ product: makeProduct({ material: field("면 100%"), color: field("네이비") }) }),
    );
    expect(after).toContain("면 100%");
    expect(after).toContain("네이비");
    // 값이 있다는 사실만이 아니라 "다시 입력하지 마세요"까지 말해야 한다.
    expect(after).toContain("상품정보에 이미 있습니다");
  });

  for (const platform of PLATFORM_TABS) {
    it(`${platform} — 상품정보를 바꾸면 탭 입력칸의 값이 따라온다`, async () => {
      const html = renderPlatformTab(platform, { product: makeProduct({ brand: field("새 브랜드명") }) });
      expect(html).toContain("새 브랜드명");
      expect(html).not.toContain("Bobo Choses");
    });
  }
});

describe("표 2행 — 셀러 설정 자동 반영", () => {
  /**
   * 🔴 여기가 이번 작업의 핵심이다. 셀러 설정 값을 바꿔서 두 번 그리고,
   * 화면이 **다른 말을 하는지**로 판정한다.
   */
  it("LOTTEON — 셀러 설정의 출고 소요일을 바꾸면 탭이 새 값을 말한다", async () => {
    const two = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings({ outboundLeadTimeDays: 2 }) }));
    expect(two).toContain("출고 소요일 2일이 그대로 등록됩니다");

    const one = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings({ outboundLeadTimeDays: 1 }) }));
    expect(one).toContain("출고 소요일 1일이 그대로 등록됩니다");
    expect(one).not.toContain("2일이 그대로 등록됩니다");
  });

  it("LOTTEON — 셀러 설정의 출고지/반품지/택배사 값이 탭에 그대로 나타난다", async () => {
    const text = stripTags(
      await renderLotteOnTab({
        sellerSettings: makeSellerSettings({
          outboundShippingPlaceCode: 7788,
          returnCenterCode: "RC-1004",
          deliveryCompanyCode: "CJGLS",
        }),
      }),
    );
    expect(text).toContain("7788");
    expect(text).toContain("RC-1004");
    expect(text).toContain("CJGLS");
  });

  it("LOTTEON — 셀러 설정이 비어 있으면 '셀러 설정에서 먼저 등록해주세요'와 이동 경로를 말한다", async () => {
    const html = await renderLotteOnTab({ sellerSettings: null });
    expect(stripTags(html)).toContain("셀러 설정에서 먼저 등록해주세요");
    expect(html).toContain('href="/settings"');
    expect(stripTags(html)).toContain("설정하러 가기");
  });

  it("LOTTEON — 셀러 설정 섹션에는 입력칸이 하나도 없다(고치는 곳은 설정 하나뿐)", async () => {
    const html = await renderLotteOnTab({ sellerSettings: makeSellerSettings() });
    const section = /<section id="lotteon-section-seller-settings"[\s\S]*?<\/section>/.exec(html);
    expect(section, "② 셀러 설정 정보 섹션이 렌더되지 않았다").not.toBeNull();
    expect(collectInputs(section![0])).toEqual([]);
  });

  it("LOTTEON — 셀러 설정 값이 payload(sndBgtNday)까지 간다", async () => {
    const payloadFor = (days: number | null) =>
      buildLotteOnPayload({
        product: makeProduct(),
        channel: {
          ...BLANK_LOTTEON_CHANNEL_CONFIG,
          shipBudgetDays: resolveLotteOnShipBudgetDays(makeSellerSettings({ outboundLeadTimeDays: days })).days,
        },
        detailHtml: "<p>상세</p>",
      }).spdLst[0].sndBgtNday;

    expect(payloadFor(1)).toBe(1);
    expect(payloadFor(2)).toBe(2);
    // 셀러 설정이 비어 있으면 기존 기본값 그대로 — 값을 지어내지 않는다.
    expect(payloadFor(null)).toBe(3);
    // 롯데ON 일반상품 상한을 넘으면 상한으로 자르고, 그 사실을 문장으로 말한다.
    expect(payloadFor(9)).toBe(3);
    expect(resolveLotteOnShipBudgetDays(makeSellerSettings({ outboundLeadTimeDays: 9 })).source).toBe(
      "SELLER_SETTINGS_CAPPED",
    );
  });

  /**
   * REWORK-7 ①(CEO 지시, 2026-09-15) — **우측 요약은 이름을 나열하지 않는다.**
   *
   * 셀러 설정 누락 항목(출고지·반품지)은 그대로 살아 있지만, 요약에서는
   * 「판매자 설정」 자리 한 줄로 접힌다. 이름과 [이동]은 그 항목이 **남은 항목
   * 1위**가 됐을 때 선다(REWORK-4 §2의 "한 번에 하나" 규칙 그대로) — 그 경로는
   * rework7-summary-shape.test.ts가 요약 컴포넌트 단위로 따로 증명한다.
   */
  /* ══ LOTTEON-REAL-REGISTRATION-02 §6(CEO 확정, 2026-09-22) ══
     계약이 한 군데 넓어졌다. 「✗ 판매자 설정」 한 줄로는 셀러가 무엇을 해야
     하는지 알 수 없어서, **막는 자리에 한해** 그 이름을 아래 한 줄씩 편다.

     🔴 위 REWORK-7 주석이 지키려던 것은 그대로다 — «자리» 는 여전히 한 줄이고,
     통과한 자리는 아무것도 펴지 않는다. 그때 지운 것은 이미 통과한 필드까지
     전부 나열한 좌측과의 중복이었다(✓상품명 ✓브랜드 …). 지금 펴는 것은 막고
     있는 것뿐이고, 좌측 어디에도 없는 정보다. */
  it("coupang — 셀러 설정 누락은 「판매자 설정」 한 자리로 모이고, 막는 이름만 편다", async () => {
    const { right } = columnsOf(renderPlatformTab("coupang", { settingsMissing: ["출고지", "반품지"] }));
    const text = stripTags(right);
    expect(text).toContain("판매자 설정");
    // 자리는 여전히 하나다 — 두 항목이 각각 «자리» 를 차지하지 않는다.
    const doc = new JSDOM(`<!doctype html><body>${right}</body>`).window.document;
    const groupRows = Array.from(doc.querySelectorAll("li"))
      .filter((li) => li.closest("ul")?.parentElement?.tagName !== "LI")
      .map((li) => (li.querySelector("span")?.textContent ?? "").replace(/\s+/g, ""));
    expect(groupRows.filter((row) => row.includes("판매자설정"))).toHaveLength(1);
    // 그리고 막는 이름이 그 아래 선다 — 셀러가 다음 행동을 안다.
    expect(text, "막는 항목 이름이 없어 무엇을 할지 알 수 없다").toContain("출고지");
    expect(text).toContain("반품지");
  });

  /**
   * 🔴 실측으로 드러난 비대칭 — **고치지 않고 기록한다**(스마트스토어 UX를
   * 함부로 바꾸지 말라는 CEO 재확정 범위).
   *
   * 스마트스토어 탭은 `settingsMissing`을 넘겨도 준비도 카드에 그 항목이 서지
   * 않는다. 카드가 쿠팡처럼 computeChecklistReadiness 결과를 그리는 게 아니라
   * Naver payload 검증 경로를 타기 때문이다("Payload 검증 결과 확인 중"만 선다).
   * 게다가 CommerceWorkspace는 `tab === "coupang"`일 때만 이 prop을 채운다
   * (CommerceWorkspace.tsx의 settingsMissing/settingsRecommended 전달 지점) —
   * 즉 스마트스토어에는 지금 셀러 설정 누락 안내 경로가 아예 없다.
   */
  it("smartstore — settingsMissing을 넘겨도 준비도 카드에 그 항목이 서지 않는다(현재 동작 고정)", async () => {
    const text = stripTags(renderPlatformTab("smartstore", { settingsMissing: ["출고지", "반품지"] }));
    expect(text).not.toContain("출고지");
    /* REWORK-7 ①(2026-09-15) — 여기 있던 "설정하러 가기" 버튼이 사라졌다.
       요약이 settingsMissing을 따로 받아 그리던 자리인데, **목록도 없이 버튼만**
       서 있었다(위 주석이 기록한 그 비대칭). 이동 경로가 필요한 항목은 남은
       항목 1위가 됐을 때 그 항목이 자기 [이동]을 달고 선다 — 갈 곳 없는 버튼을
       남겨 두지 않는다(REWORK-4 §2). 스마트스토어에 셀러 설정 누락 안내 경로가
       아예 없다는 사실 자체는 여전히 그대로다 — 이번 범위가 아니다. */
    expect(text).not.toContain("설정하러 가기");
  });

  /**
   * 🔴 정직하게 남긴다 — 스마트스토어/쿠팡 탭의 「배송 정책 · 반품/교환」 카드는
   * 컴포넌트가 마운트된 뒤 fetch로 채운다(useEffect). 그래서 **서버 렌더
   * 시점에는 셀러 설정 값이 화면에 없다.** 롯데ON은 prop으로 받으므로 첫 렌더에
   * 이미 서 있다. 이 차이를 숨기지 않고 테스트로 고정한다.
   */
  for (const platform of PLATFORM_TABS) {
    it(`${platform} — 셀러 설정 요약 카드는 첫 렌더에 값이 없다(마운트 후 fetch로 채운다)`, async () => {
      const text = stripTags(renderPlatformTab(platform));
      expect(text).not.toContain("CJGLS");
      expect(text).not.toContain("RC-1004");
    });
  }
});

describe("표 3행 — 공통값 별도 입력 필요 (LOTTEON 반드시 FAIL)", () => {
  it("LOTTEON — 공통 상품정보를 묻는 입력칸이 0개다", async () => {
    const inputs = collectInputs(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    expect(inputs.length, "아무것도 안 그려져서 0개가 된 것이 아니다").toBeGreaterThan(0);
    const offending = commonProductInputs(inputs);
    expect(offending, `롯데ON 탭이 공통값을 다시 묻고 있다: ${offending.map((i) => i.label).join(" / ")}`).toEqual([]);
  });

  it("LOTTEON — 셀러 설정 값을 다시 묻는 입력칸도 0개다", async () => {
    const inputs = collectInputs(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    // 셀러 설정이 갖고 있는 개념을 이 탭이 새로 입력받지 않는다.
    for (const forbidden of ["출고 소요일", "배송비", "반품배송비", "교환배송비", "품질보증기준", "A/S연락처"]) {
      expect(
        inputs.map((i) => labelKey(i.label)),
        `롯데ON 탭이 셀러 설정 값을 다시 묻고 있다: ${forbidden}`,
      ).not.toContain(forbidden);
    }
  });

  for (const platform of PLATFORM_TABS) {
    it(`${platform} — 공통값 입력칸이 살아 있다(CEO 재확정: read-only 강제 전환 금지)`, async () => {
      const common = commonProductInputs(collectInputs(renderPlatformTab(platform)));
      expect(common.length).toBeGreaterThan(0);
      expect(common.every((input) => !input.readOnly)).toBe(true);
    });
  }
});

describe("표 4행 — 채널 고유값 입력", () => {
  it("LOTTEON — 선 입력칸 전수가 전부 롯데ON 고유값이다", async () => {
    const labels = collectInputs(await renderLotteOnTab({ sellerSettings: makeSellerSettings() })).map((i) => i.label);
    expect(labels).toEqual([
      // REWORK-4 §5 — 순서가 10섹션 골격을 따른다(⑤ 배송 → ⑦ 고시 → ⑧ KC).
      /* REWORK-5 ③(CEO 실측 판정: FAIL) — 여기 맨 앞에 있던
         "표준카테고리번호 (scatNo)" · "전시카테고리번호 (dcatLst)" 두 칸이
         **없어졌다.** 지운 것이지 옮긴 것이 아니다 — 셀러가 번호를 찾아 손으로
         적는 UX 자체를 폐기했고, 카테고리는 [카테고리 추천] → 후보 → [선택]
         하나로만 정해진다(선택 결과는 읽기 전용 요약으로 확인한다).
         나머지 칸의 집합은 한 건도 달라지지 않았다. */
      /* REWORK-14(CEO 실측 판정 3회차, 2026-09-15) — 라벨에서 괄호 안 API
         필드명이 빠졌다. **지운 것이 아니라 ⓘ 안으로 옮겼다** — 쿠팡·스마트
         스토어 라벨에는 코드 병기가 0건이라 같은 자리의 글자 조판이 탭마다
         달랐고, 서버 검증이 부르는 이름조차 그냥 「출고지번호」다. 코드는
         `title`·`sr-only`에 그대로 남아 있고, 그 사실은
         rework14-field-parity.test.ts가 화면 문서에서 직접 확인한다. */
      "출고지번호",
      "반품지번호",
      "배송비정책번호",
      "배송 가능 지역",
      "택배사",
      "반품 택배사",
      "평일 발송마감시간",
      "상품품목코드",
      "고시 항목",
      "안전인증 목록",
      "수입대행코드",
      "원산지코드",
      "과세유형코드",
      "브랜드번호",
      "업체상품번호",
    ]);
  });

  it("LOTTEON — 왜 셀러 설정에서 못 가져오는지 항목마다 이유가 화면에 있다", async () => {
    const text = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    // 개념은 있으나 코드체계가 다른 것.
    expect(text).toContain("셀러 설정에 있지만 롯데ON 코드체계가 다름");
    // 개념 자체가 없는 것.
    expect(text).toContain("셀러 설정에 없는 개념 — 롯데ON 고유값");
    /* 🔴 C-2A — 라벨에서 「번호」·「코드」를 뺐다(셀러가 보는 이름은 의미다).
       이 줄들이 보는 것은 «이유가 화면에 있는가» 이고 그건 그대로다. */
    expect(text).toContain("배송비 정책");
    expect(text).toContain("배송 가능 지역");
    expect(text).toContain("반품 택배사");
  });

  for (const platform of PLATFORM_TABS) {
    it(`${platform} — 선 입력칸에 채널 전용 값이 없다(전부 공통 상품정보다)`, async () => {
      const inputs = collectInputs(renderPlatformTab(platform));
      expect(commonProductInputs(inputs)).toHaveLength(inputs.length);
    });
  }
});

describe("표 5행 — 독립 카테고리 (LOTTEON 반드시 PASS)", () => {
  it("LOTTEON — 롯데ON 카테고리 판정에 공통/다른 채널 카테고리가 들어갈 자리가 없다", async () => {
    // validateLotteOnPayload는 channel.standardCategoryNo / displayCategories만 본다.
    const result = validateLotteOnPayload({
      product: makeProduct(),
      channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG },
      detailHtml: "<p>상세</p>",
    });
    const category = result.fields.filter((f) => f.field === "scatNo" || f.field === "dcatLst");
    expect(category.map((f) => f.status)).toEqual(["BLOCKED", "BLOCKED"]);
    // 다른 채널을 확정해도 이 판정은 같은 인자만 본다 — 인자 자체에 채널이 없다.
    const withCategory = validateLotteOnPayload({
      product: makeProduct(),
      channel: {
        ...BLANK_LOTTEON_CHANNEL_CONFIG,
        standardCategoryNo: "205001",
        displayCategories: [{ mallCd: "LTON", lfDcatNo: "3001" }],
      },
      detailHtml: "<p>상세</p>",
    });
    expect(withCategory.fields.find((f) => f.field === "scatNo")?.status).toBe("READY");
  });

  it("LOTTEON — 화면이 '스마트스토어·쿠팡 카테고리를 덮어쓰지 않는다'고 말한다", async () => {
    expect(stripTags(await renderLotteOnTab())).toContain("스마트스토어·쿠팡 카테고리를 덮어쓰지 않습니다");
  });

  /**
   * REWORK-5 ③ — 예전에는 "scatNo 입력칸이 value=\"\"로 비어 있다"로 이것을
   * 증명했다. 그 칸이 없어졌으므로(셀러가 번호를 적는 UX 폐기) 같은 명제를
   * **읽기 전용 요약이 뭐라고 말하는가**로 증명한다. 명제 자체는 그대로다:
   * 아무것도 고르지 않았으면 우리가 대신 골라 두지 않는다.
   */
  it("LOTTEON — 카테고리를 자동으로 확정하지 않는다(빈 폼은 빈 채로 남는다)", async () => {
    const text = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    expect(text).toContain("아직 고른 카테고리가 없습니다");
    // "고른 카테고리가 채운 값" 표는 고르기 전에는 서지 않는다.
    expect(text).not.toContain("선택한 카테고리가 채운 값");
  });
});

describe("표 6행 — 독립 readiness (LOTTEON 반드시 PASS)", () => {
  it("LOTTEON readiness는 자기 서버 검증 결과만 센다", async () => {
    const snapshot = validateLotteOnPayload({
      product: makeProduct(),
      channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG },
      detailHtml: "<p>상세</p>",
    });
    const readiness = computeLotteOnRegistrationReadiness(snapshot);
    expect(readiness.percent).toBeLessThan(100);
    expect(readiness.allRequiredPassed).toBe(false);
    // 같은 입력이면 같은 숫자다 — 다른 채널 상태가 끼어들 자리가 없다.
    expect(computeLotteOnRegistrationReadiness(snapshot)).toEqual(readiness);
  });

  it("스마트스토어/쿠팡 readiness 계산에 롯데ON 인자가 없다", async () => {
    // computeChecklistReadiness(validations, category, settingsMissing, compliance, settingsRecommended)
    expect(computeChecklistReadiness.length).toBe(5);
    const summary = computeChecklistReadiness([], UNRESOLVED_CATEGORY);
    expect(summary.required.some((item) => /롯데|lotte/i.test(item.label))).toBe(false);
  });

  it("롯데ON readiness 계산은 스마트스토어/쿠팡 readiness를 인자로 받지 않는다", async () => {
    // 인자가 하나(검증 스냅샷)뿐이라는 사실 자체가 격리다.
    expect(computeLotteOnRegistrationReadiness.length).toBe(1);
  });
});

describe("표 7행 — MI와 readiness 독립 (LOTTEON 반드시 PASS)", () => {
  it("LOTTEON 탭 화면에 MI 어휘가 하나도 없다", async () => {
    const text = stripTags(await renderLotteOnTab({ sellerSettings: makeSellerSettings() }));
    for (const word of ["판매 추천", "판매 비추천", "조건부 판매", "가격경쟁력", "가격 경쟁력", "시장 가격"]) {
      expect(text, `롯데ON 탭에 MI 어휘가 새어 들어왔다: ${word}`).not.toContain(word);
    }
  });

  it("LOTTEON 검증 결과는 MI 입력이 없어도 같은 값을 낸다", async () => {
    // validateLotteOnPayload의 입력에 MI가 들어갈 필드 자체가 없다.
    const input = {
      product: makeProduct(),
      channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG },
      detailHtml: "<p>상세</p>",
    };
    expect(Object.keys(input)).toEqual(["product", "channel", "detailHtml"]);
    expect(validateLotteOnPayload(input).blockedCount).toBe(validateLotteOnPayload(input).blockedCount);
  });
});

describe("셀러 설정 판정표 — 화면과 payload가 같은 함수를 본다", () => {
  it("6개 값의 처지가 한 곳에서만 정해진다", async () => {
    const rows = describeLotteOnSellerSettings(makeSellerSettings());
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

    // 셀러 설정에 **개념이 있는** 것 — 다만 코드체계가 채널마다 다르다.
    expect(byLabel["출고지"].usage).toBe("CHANNEL_CODE_DIFFERS");
    expect(byLabel["반품지"].usage).toBe("CHANNEL_CODE_DIFFERS");
    expect(byLabel["택배사"].usage).toBe("CHANNEL_CODE_DIFFERS");

    /* 셀러 설정에 **개념 자체가 없는** 것 — 롯데ON 고유값으로 남긴다.
       🔴 C-2A — 라벨에서 「코드」·「번호」를 뺐다. 셀러가 보는 이름은 의미여야
       한다(F-7). 판정(usage)은 한 글자도 바뀌지 않았다. */
    expect(byLabel["배송비 정책"].usage).toBe("NO_SETTING_CONCEPT");
    expect(byLabel["배송 가능 지역"].usage).toBe("NO_SETTING_CONCEPT");
    expect(byLabel["반품 택배사"].usage).toBe("NO_SETTING_CONCEPT");
    expect(byLabel["평일 발송마감시간"].usage).toBe("NO_SETTING_CONCEPT");

    // 실제로 자동 반영되는 것.
    expect(byLabel["출고 소요일"].usage).toBe("AUTO_APPLIED");
    expect(byLabel["상세페이지 공통 이미지 · 기본 구성"].usage).toBe("AUTO_APPLIED");
  });

  it("셀러 설정이 비어 있으면 '자동 반영됨'이라고 말하지 않는다", async () => {
    const rows = describeLotteOnSellerSettings(null);
    const leadTime = rows.find((r) => r.label === "출고 소요일")!;
    expect(leadTime.usage).toBe("SETTINGS_REQUIRED");
    expect(leadTime.settingValue).toBeNull();
  });

  it("코드체계가 다른 값을 롯데ON 칸에 옮겨 적지 않는다", async () => {
    // 셀러 설정의 쿠팡 Wing 코드가 롯데ON 폼 초기값으로 새지 않는다 —
    // 셀러 설정을 줘도 출고지/반품지/택배사 입력칸은 빈 채로 남는다.
    /* REWORK-11 ① — 라벨이 롯데ON 전용 TextField의 `<span>`이 아니라 공용
       FieldRow의 `<label>`이 됐고(세 탭이 같은 행을 쓴다), 실제 마운트에서는
       입력값이 DOM 속성이 아니라 프로퍼티다. 그래서 문자열이 아니라 **살아 있는
       입력칸**을 보고 판정한다 — 보는 대상(그 칸이 비어 있는가)은 그대로다. */
    const container = await mountExpanded(lotteOnElement({ sellerSettings: makeSellerSettings() }));
    const byLabel = new Map(
      Array.from(container.querySelectorAll("input")).map((input) => [fieldLabelOf(input), input]),
    );
    /* REWORK-14 — 라벨에서 API 필드명이 ⓘ 안으로 옮겨 갔다(쿠팡 라벨 조판과
       같은 형식). 보는 대상(그 칸이 비어 있는가)은 그대로다. */
    /* Commerce-6 F-7 — 라벨에서 「코드」가 빠졌다(「택배사코드」 → 「택배사」).
       셀러가 코드 «이름» 을 읽고 그것을 답으로 적는 사고를 막기 위한 것이고
       (첫 LIVE 등록이 정확히 그렇게 거절됐다),
       🔴 이 검사가 보는 대상(그 칸이 비어 있는가)은 한 글자도 달라지지 않는다. */
    for (const label of ["출고지번호", "반품지번호", "택배사"]) {
      const input = byLabel.get(label);
      expect(input, `${label} 입력칸을 찾지 못했다`).toBeTruthy();
      expect(input!.value, `${label}에 셀러 설정 값이 흘러들어갔다`).toBe("");
    }
  });
});
