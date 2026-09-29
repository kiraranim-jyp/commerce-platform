import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PlatformPreview } from "../PlatformPreview";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { RegistrationStatusBanner } from "../RegistrationStatusBanner";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPriorityItems, describePriorityItem, REGISTRATION_SECTION_LABEL } from "../readiness-state";
import { computeChecklistReadiness } from "../readiness";
import { manufacturerFixture } from "./manufacturer-fixture";

/**
 * REWORK-4 §2(CEO 지시, 2026-09-14) — **추상 버튼을 없애고 1개 안내를 세운다.**
 *
 * CEO 지시 원문:
 *   ❌ 제거   "부족한 정보 한 번에 해결하기" — 무엇을·어디를 고칠지 불명확하고
 *             눌러도 해결되지 않는다
 *   ✅ 대신   먼저 해결할 항목 1개를, 네 가지를 전부 연결해서:
 *             무엇이 부족한가 → 왜 필요한가 → 어디서 입력하는가 → [바로 이동]
 *   🔴 금지   이동 경로가 없는 안내
 *
 * 이 파일은 그 네 가지가 **렌더 결과에 실제로 서 있는지**만 본다. 소스에
 * 문자열이 있다는 사실은 화면에 그것이 섰다는 증거가 아니다 — 이 저장소가
 * 여러 번 그렇게 틀렸다.
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
  } as unknown as CanonicalProduct;
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

function renderLotteOnTab(): string {
  return renderToStaticMarkup(
    createElement(LotteOnRegistrationPanel, {
      product: makeProduct(),
      commonPrice: { priceKrw: 128000, resolved: true },
      commonCategorySources: [],
      onChannelInfoChange: () => {},
      onEditCommonInfo: () => {},
      manufacturerResolution: manufacturerFixture(),
    }),
  );
}

const ALL_TABS: [string, () => string][] = [
  ["smartstore", () => renderPlatformTab("smartstore")],
  ["coupang", () => renderPlatformTab("coupang")],
  ["lotteon", renderLotteOnTab],
];

describe("§2 — 「부족한 정보 한 번에 해결하기」가 세 탭 어디에도 없다", () => {
  for (const [name, render] of ALL_TABS) {
    it(`${name} 탭에 추상 버튼이 0건이다`, () => {
      const text = stripTags(render());
      expect(text, `${name}: 추상 버튼이 남아 있다`).not.toContain("부족한 정보 한 번에 해결하기");
    });
  }
});

describe("§2 — 먼저 해결할 항목 1개가 네 가지를 전부 말한다", () => {
  /**
   * 실제 화면과 같은 입력으로 배너 하나를 그린다. priorityItems는 손으로
   * 적지 않는다 — 쿠팡 탭이 쓰는 그 계산(computeChecklistReadiness →
   * buildPriorityItems)을 그대로 부른다.
   */
  function bannerHtml() {
    const summary = computeChecklistReadiness([], UNRESOLVED_CATEGORY);
    const items = buildPriorityItems(summary, true, "section-price");
    return {
      html: renderToStaticMarkup(
        createElement(RegistrationStatusBanner, {
          state: "NEEDS_REVIEW" as const,
          priorityItems: items,
          onItemClick: () => {},
          checkedItems: summary.required,
        }),
      ),
      items,
    };
  }

  /* REWORK-7 ①(CEO 지시, 2026-09-15) — 머리말이 CEO가 §1에 적은 "남은 항목 N개"로
     바뀌었다. **"하나만 펼친다"는 규칙 자체는 그대로다** — 아래 세 검사(무엇/왜/
     어디서/[이동])가 여전히 첫 항목 하나에 대해서만 성립한다. */
  it("머리말이 '남은 항목 N개'다 — 목록이 아니라 하나를 편다", () => {
    const text = stripTags(bannerHtml().html);
    expect(text).toContain("남은 항목");
    // 펼쳐진 항목은 하나뿐이다 — 나머지를 번호로 나열하지 않는다.
    expect(text).not.toContain("그 다음");
  });

  it("① 무엇이 부족한가 · ② 왜 필요한가 · ③ 어디서 입력하는가가 전부 화면에 있다", () => {
    const { html, items } = bannerHtml();
    const guide = describePriorityItem(items[0]);
    const text = stripTags(html);
    expect(text, "무엇이 부족한가가 없다").toContain(stripTags(guide.what));
    expect(text, "왜 필요한가가 없다").toContain(stripTags(guide.why));
    expect(text, "어디서 입력하는가가 없다").toContain(stripTags(guide.where));
  });

  it("④ [바로 이동]이 실제 버튼으로 선다", () => {
    const { html, items } = bannerHtml();
    const guide = describePriorityItem(items[0]);
    expect(guide.action, "카테고리 항목에 갈 곳이 없다").not.toBeNull();
    // 카테고리는 이 화면 안의 「카테고리」 섹션으로 간다(기존 goToSection 그대로).
    expect(guide.action).toEqual({
      kind: "SECTION",
      sectionId: "section-category",
      label: "「카테고리」에서 입력하기 →",
    });
    expect(html).toContain("「카테고리」에서 입력하기 →");
  });

  /**
   * REWORK-7 ①(CEO 판정, 2026-09-15) — **여기 있던 "그 외 확인 항목 N개 ✓ 상품명
   * ✓ 브랜드 …"가 사라졌다.**
   *
   * BEFORE 렌더 덤프에서 이 줄과 바로 아래 준비도 카드가 **같은 필드 목록을 한
   * 기둥 안에서 두 번** 그리고 있었다(쿠팡: ✓ 상품명 ✓ 브랜드 ✓ 대표이미지
   * ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명 — 두 번). 무엇이 이미 끝났는지는
   * 사라지지 않는다: 아래 「필수 확인」이 **자리 단위**로 말한다(summary-checklist).
   *
   * 배너가 checkedItems로 하는 일은 이제 **세는 것뿐**이다.
   */
  it("통과 여부는 세기만 한다 — 배너가 항목 이름을 나열하지 않는다", () => {
    const summary = computeChecklistReadiness([], UNRESOLVED_CATEGORY);
    const html = renderToStaticMarkup(
      createElement(RegistrationStatusBanner, {
        state: "NEEDS_REVIEW" as const,
        priorityItems: buildPriorityItems(summary, true, "section-price"),
        onItemClick: () => {},
        checkedItems: [
          ...summary.required,
          { label: "상품명", passed: true, required: true },
          { label: "브랜드", passed: true, required: true },
        ],
      }),
    );
    const text = stripTags(html);
    expect(text).not.toContain("그 외 확인 항목");
    expect(text).not.toContain("✓ 상품명");
    expect(text).not.toContain("✓ 브랜드");
    // 미통과 개수(카테고리 1개)는 머리말이 말한다.
    expect(text).toContain("남은 항목 1개");
  });
});

describe("§2 — 🔴 이동 경로가 없는 안내를 만들지 않는다", () => {
  /**
   * 갈 곳이 확실하지 않으면 버튼을 그리지 않는다. 그래서 이 검사는 "버튼이
   * 있다"가 아니라 **"화면에 선 이동 버튼은 전부 실제 목적지를 갖는다"**를 본다.
   *
   * readiness.ts는 대표이미지를 "section-images"로 매핑해 두었는데 그 앵커는
   * PlatformPreview에 존재하지 않는다 — 그런 sectionId가 버튼이 되면 눌러도
   * 아무 데도 가지 않는다. describePriorityItem이 그것을 걸러낸다.
   */
  it("존재하지 않는 섹션으로 보내는 버튼은 만들어지지 않는다", () => {
    const guide = describePriorityItem({
      key: "x",
      label: "대표이미지",
      sectionId: "section-images", // 실제 화면에 없는 앵커
      sourceItems: [{ label: "대표이미지", passed: false, required: true, group: "PRODUCT_INFO" }],
    });
    expect(guide.action, "없는 곳으로 보내는 버튼이 만들어졌다").toBeNull();
    // 그래도 "어디서"는 말한다 — 모른다고 침묵하지 않는다.
    expect(guide.where.length).toBeGreaterThan(0);
  });

  it("세 탭 어디에도 목적지 없는 이동 버튼이 서 있지 않다", () => {
    for (const [name, render] of ALL_TABS) {
      const html = render();
      const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
      const deadLinks = Array.from(doc.querySelectorAll("a")).filter((a) => {
        const href = a.getAttribute("href");
        return href == null || href === "" || href === "#";
      });
      expect(deadLinks.map((a) => a.textContent), `${name}: 갈 곳 없는 링크가 있다`).toEqual([]);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 UX-FLOW-01(2026-09-30) — 「이동할 자리를 특정하지 못했습니다」가 막다른 길이다
   ════════════════════════════════════════════════════════════════════════════

   롯데ON 패널은 이동 장치를 전부 배선해 두었다(`sectionId` · `goToSection` ·
   `onPriorityItemClick` · `scrollIntoView`). 그런데 `describePriorityItem()` 은
   `REGISTRATION_SECTION_LABEL` 에 «있는 id 에만» 버튼을 만든다. 롯데ON 이 쓰는
   `lotteon-section-*` 가 그 표에 없어서, 셀러는 언제나 폴백 문장만 봤다 —
   스크롤은 준비돼 있는데 «누를 것이 없었다».

   🔴 이 블록이 지키는 것은 「롯데ON 5개를 넣었다」가 아니라 **「패널이 낼 수 있는
   sectionId 가 전부 풀린다」** 이다. 채널이 늘어도 같은 함정에 빠지지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("🔴 UX-FLOW-01 — 안내가 «갈 곳» 을 못 찾는 경우가 없다", () => {
  const FORM_SRC = readFileSync(join(__dirname, "..", "lotteon-channel-form.ts"), "utf8");

  it("롯데ON 이 내보내는 sectionId 가 «전부» 라벨 표에서 풀린다", () => {
    /* 소스에서 실제로 쓰이는 앵커 id 를 모은다 — 표를 손으로 맞추지 않는다. */
    const used = [...new Set(FORM_SRC.match(/"lotteon-section-[a-z]+"/g) ?? [])].map((s) => s.slice(1, -1));
    expect(used.length, "롯데ON 앵커 id 를 하나도 찾지 못했다 — 이 검사가 무력하다").toBeGreaterThan(0);
    for (const id of used) {
      expect(REGISTRATION_SECTION_LABEL[id], `${id} 가 라벨 표에 없다 — 이동 버튼이 뜨지 않는다`).toBeTruthy();
    }
  });

  it("🔴 롯데ON 항목이 «이동 버튼» 을 받는다 — 폴백 문장으로 떨어지지 않는다", () => {
    const guidance = describePriorityItem({
      key: "pdItmsArtlLst",
      label: "고시 항목",
      sectionId: "lotteon-section-notice",
      sourceItems: [],
    } as never);
    expect(guidance.action, "이동 액션이 없다 — 셀러가 갈 곳을 못 받는다").toBeTruthy();
    expect(guidance.action!.kind).toBe("SECTION");
    expect(guidance.where).not.toContain("이동할 자리를 아직 특정하지 못했습니다");
  });

  it("라벨은 롯데ON 탭이 실제로 그리는 섹션 제목과 같다", () => {
    /* 안내가 부르는 이름과 화면 제목이 다르면 「거기가 어딘데」가 다시 생긴다. */
    expect(REGISTRATION_SECTION_LABEL["lotteon-section-notice"]).toBe("고시정보");
    expect(REGISTRATION_SECTION_LABEL["lotteon-section-certification"]).toBe("KC / 인증");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 REGISTRATION-INCIDENT-02(2026-09-30) — 서버가 말한 이유를 화면이 버리지 않는다
   ════════════════════════════════════════════════════════════════════════════

   게이트가 막으면 응답은 `{ ok:false, error, errorCode }` 다 — `message` 가 아니다.
   화면이 `data.message` 만 읽어서, 서버가 「이 워크스페이스에는 커머스 등록 권한이
   없습니다」라고 정확히 말하는데도 셀러에게는 「등록 정보를 만들지 못했습니다」만
   갔다. 세 채널이 동시에 막힌 P0 에서 진단을 가린 것이 이 한 줄이었다.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("🔴 REGISTRATION-INCIDENT-02 — 실패 이유가 화면까지 온다", () => {
  const PANEL_SRC = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("preview 응답의 `error` 도 읽는다 — `message` 만 보지 않는다", () => {
    expect(PANEL_SRC, "게이트 거절 사유(error)가 화면에서 버려진다").toContain("data.error");
  });

  it("폴백 문장은 «서버가 아무 말도 하지 않았을 때» 만 쓴다", () => {
    /* `?? "등록 정보를 만들지 못했습니다."` 앞에 반드시 error 폴백이 있어야 한다. */
    for (const m of PANEL_SRC.matchAll(/등록 정보를 만들지 못했습니다/g)) {
      const before = PANEL_SRC.slice(Math.max(0, m.index - 160), m.index);
      expect(before, "서버 사유를 거치지 않고 폴백으로 바로 간다").toMatch(/\.error/);
    }
  });
});
