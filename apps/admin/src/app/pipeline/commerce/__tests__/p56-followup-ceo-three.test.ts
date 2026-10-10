/**
 * ══════════════════════════════════════════════════════════════════════════
 *  P5.6 후속 — **CEO 실화면 FAIL 3건 + 고시/원산지 공통화** (CPO 2026-10-10)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 실화면에서 잡은 셋은 UX 취향이 아니라 **셀러 workflow 결함**이었다.
 * 그리고 셋 다 내가 「완료」로 닫은 것이다 — 무엇을 틀렸는지 같이 적는다.
 *
 *   P0-1  기본재고 입력 UX 가 «없다»
 *         → 있었지만 `variantsWithUnknownStock > 0` 에 가려졌고, 라벨이
 *           경고문처럼 읽혔다. 옵션 행 placeholder 도 「기본값」이라 혼동됐다.
 *
 *   P0-3  블록별 이미지 + 텍스트 수정 «불가»
 *         → 절반만 맞았다. 제목·문구·caption 은 됐고, 없던 것은 **이미지를
 *           갈아끼우는 길** 뿐이었다. 지우고 다시 넣으면 순서가 끝으로 밀린다.
 *
 *   P0-5  채널 탭에 옵션 편집이 «아직 있다»
 *         → 재고 입력 «한 칸» 이 SmartStore·Coupang 탭에 살아 있었다. 옵션이
 *           없는 단품에서만 보이는 분기여서, 옵션 상품으로만 확인하고 「없다」고
 *           두 번 단정했다. 「커버리지는 파일명이 아니라 속성이다」를 또 틀렸다.
 *
 *   P0-6  고시품목이 채널마다 «따로»
 *         → 세 채널이 서로 다른 입력으로 각자 판정했다. 같은 상품이 채널마다
 *           다른 고시로 신고될 수 있는 구조였다.
 *
 *   P0-2  상품명에 상품 식별력이 없다
 *         → 속성만으로 다시 조립해 원상품명이 사라졌다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { productCoreName, suggestKoreanProductName, seedSeoContent } from "@commerce/content";
import {
  lotteOnNoticeItemCodeFor,
  naverNoticeTypeFor,
  resolveNoticeCategory,
  suggestLotteOnNoticeItemCode,
} from "@commerce/listing";
import { backfillCanonicalProduct, type CanonicalProduct, type FieldSource } from "@commerce/shared";

const ROOT = join(__dirname, "..");
/* 🔴 리포지터리 루트를 «세어서» 잡지 않는다 — `../../../../../` 를 손으로 세면
   한 칸 틀리고 파일이 안 열린다(실측에서 그렇게 터졌다). 이 테스트 파일에서
   루트까지는 고정이므로 한 번만 계산해 둔다. */
const REPO = join(__dirname, "../../../../../../..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
const readRepo = (f: string) => readFileSync(join(REPO, f), "utf8");
/** 🔴 주석을 벗긴다 — 이 저장소가 여덟 번 걸린 함정이다. */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const f = (value: string, source: FieldSource = "ORIGINAL") => ({ value, source, confidence: 0.9 });

function product(over: Record<string, unknown>): CanonicalProduct {
  return backfillCanonicalProduct({
    id: "x",
    sourceUrl: "https://example.com/p",
    description: f(""),
    price: { value: { amount: 10, currency: "EUR" }, source: "ORIGINAL", confidence: 0.9 },
    optionGroups: [],
    variants: [],
    stockQuantity: { value: 999, source: "DEFAULT", confidence: 0 },
    recommendedAge: f("", "DEFAULT"),
    sku: f("", "DEFAULT"),
    itemName: f("", "DEFAULT"),
    modelName: f("", "DEFAULT"),
    weight: f("", "DEFAULT"),
    certificationType: f("", "DEFAULT"),
    manufacturer: f("", "DEFAULT"),
    importer: f("", "DEFAULT"),
    careInstructions: f("", "DEFAULT"),
    titleKo: f("", "DEFAULT"),
    descriptionKo: f("", "DEFAULT"),
    keywords: { value: [], source: "DEFAULT", confidence: 0 },
    ...over,
  } as never as CanonicalProduct);
}

/* ══ P0-2 — 상품명에 원상품 핵심어가 남는다 ═════════════════════════════ */
describe("P0-2 상품명 — 브랜드 + 원상품 핵심어 + 한국어 보정어", () => {
  it("🔴 CPO 예시 그대로 — Sergio Tacchini Racchetto Polo 남성 셔츠", () => {
    const p = product({
      title: f("Sergio Tacchini Men's Racchetto Polo"),
      brand: f("Sergio Tacchini"),
      material: f("100% Polyester"),
      color: f("Brilliant White"),
    });
    expect(suggestKoreanProductName(p)).toBe("Sergio Tacchini Racchetto Polo 남성 셔츠");
  });

  it("🔴 핵심어는 원문에서 «빼기만» 한다 — 브랜드 중복 · | 뒤 색상 · 성별 표기", () => {
    expect(productCoreName("Sergio Tacchini Men's Racchetto Polo", "Sergio Tacchini")).toBe("Racchetto Polo");
    expect(productCoreName("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink", "Louis Louise")).toBe(
      "Holly Hearts Ribbed Velvet Baby Pants",
    );
    /* 🔴 가운데 있는 브랜드는 «벗기지 않는다» — 상품명의 일부일 수 있다. */
    expect(productCoreName("Air Nike Max", "Nike")).toBe("Air Nike Max");
    /* 🔴 `|` 가 없으면 아무것도 버리지 않는다. */
    expect(productCoreName("Simple Shirt", undefined)).toBe("Simple Shirt");
  });

  it("🔴 소재는 상품명에 «들어가지 않는다» — 보조 검색정보이고 식별자가 아니다", () => {
    const p = product({
      title: f("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"),
      brand: f("Louis Louise"),
      material: f("100% Cotton"),
      description: f("Ribbed velvet baby pants for girls."),
    });
    const name = suggestKoreanProductName(p)!;
    expect(name).toContain("Holly Hearts");
    expect(name).not.toContain("코튼");
    expect(name).not.toContain("Pale Pink");
  });

  it("🔴 상품군을 모르면 한국어 보정어를 붙이지 않는다(브랜드는 원문 근거로 남는다)", () => {
    const p = product({ title: f("Mystery Item"), brand: f("Acme") });
    expect(suggestKoreanProductName(p)).toBe("Acme Mystery Item");
  });

  it("원문이 비면 상품명을 «만들지 않는다»", () => {
    expect(suggestKoreanProductName(product({ title: f(""), brand: f("Acme") }))).toBeUndefined();
  });

  it("🔴 상품명 ≠ 모델명 — 모델명은 원상품명을 그대로 유지한다", () => {
    const out = seedSeoContent(
      /* 🔴 `material` 을 «비워서» 넣는다 — 생략하면 backfill 이 채워 주지 않고
         `mock.provider` 가 `.value` 로 터진다(이 저장소에서 두 번째다). */
      product({
        title: f("Sergio Tacchini Men's Racchetto Polo"),
        brand: f("Sergio Tacchini"),
        material: f("", "DEFAULT"),
      }),
    ).product;
    expect(out.modelName.value).toBe("Sergio Tacchini Men's Racchetto Polo");
    expect(out.titleKo.value).not.toBe(out.modelName.value);
  });
});

/* ══ P0-6 — 고시품목은 한 곳에서 판정한다 ═══════════════════════════════ */
describe("P0-6 고시품목 — 의미는 공통, 코드는 채널 변환", () => {
  it("🔴 채널이 「어린이인증 필요」라고 명시하면 그것이 1순위다", () => {
    const v = resolveNoticeCategory({ childCertificationRequired: true });
    expect(v.kind).toBe("KIDS_APPAREL");
  });

  it("🔴 어린이 낱말이 의류 낱말보다 «먼저» 다 — 뒤집으면 아동복이 일반 의류로 신고된다", () => {
    expect(resolveNoticeCategory({ categoryPath: ["패션의류", "유아동 의류", "바지"] }).kind).toBe("KIDS_APPAREL");
  });

  it("🔴 카테고리가 아동을 말하지 않아도 상품이 아동복이면 어린이제품으로 본다", () => {
    expect(resolveNoticeCategory({ categoryPath: ["패션의류", "바지"], ageGroup: "baby" }).kind).toBe("KIDS_APPAREL");
    expect(resolveNoticeCategory({ categoryPath: ["패션의류", "바지"], ageGroup: "adult" }).kind).toBe("APPAREL");
  });

  it("🔴 Known Unknown — 카테고리 경로가 «없으면» 연령축이 닿지 «않는다»", () => {
    /* 라이브 실측: Smallable 아기 바지에서 공통 판정은 카테고리 경로가 있을 때만
       KIDS_APPAREL 이고, 네이버 payload 는 "WEAR" 로 나간다(네이버 입력에 경로
       이름이 없다).

       🔴 이것을 「경로가 없으면 연령축을 본다」로 고쳤다가 **되돌렸다** —
          네이버 선재 테스트 7건이 깨졌고, 깨진 내용이 「채널 카테고리는 어린이
          인증을 요구하지 않는데 상품은 아동복」인 경우였다. 그때 KIDS 로 신고하는
          것은 실제 등록 없이 확인할 수 없는 규제 주장을 새로 만드는 일이다.
       🔴 그래서 채널 플래그가 네이버의 최종 권한이다. 이 단정은 「아직 못 한 것」을
          «기록» 한다 — 조용히 넘어가지 않기 위해서다. */
    expect(resolveNoticeCategory({ ageGroup: "baby" }).kind).toBe("UNKNOWN");
    expect(resolveNoticeCategory({ categoryPath: [], ageGroup: "kids" }).kind).toBe("UNKNOWN");
    /* 🔴 경로가 «있으면» 닿는다 — 롯데ON 은 경로를 준다. */
    expect(resolveNoticeCategory({ categoryPath: ["패션의류", "바지"], ageGroup: "baby" }).kind).toBe("KIDS_APPAREL");
    /* 🔴 비의류 반대 근거가 있으면 연령축으로도 뚫리지 않는다. */
    expect(resolveNoticeCategory({ categoryPath: ["테니스 라켓"], ageGroup: "baby" }).kind).toBe("UNKNOWN");
  });

  it("🔴 모르면 UNKNOWN 으로 «남긴다» — 「일단 의류」로 떨어뜨리지 않는다", () => {
    expect(resolveNoticeCategory({ categoryPath: ["스포츠", "테니스 라켓"] }).kind).toBe("UNKNOWN");
    expect(resolveNoticeCategory({ categoryPath: [] }).kind).toBe("UNKNOWN");
    /* 🔴 연령축만 아동이어도 «의류가 아니면» 어린이제품 의류 고시가 아니다. */
    expect(resolveNoticeCategory({ categoryPath: ["유아동 가방"], ageGroup: "baby" }).kind).toBe("KIDS_APPAREL");
  });

  it("채널 변환 — 롯데ON 2자리 코드 · 네이버 문자열 enum", () => {
    expect(lotteOnNoticeItemCodeFor("KIDS_APPAREL")).toBe("23");
    expect(lotteOnNoticeItemCodeFor("APPAREL")).toBe("01");
    expect(lotteOnNoticeItemCodeFor("UNKNOWN")).toBeNull();
    expect(naverNoticeTypeFor("KIDS_APPAREL")).toBe("KIDS");
    expect(naverNoticeTypeFor("APPAREL")).toBe("WEAR");
  });

  it("🔴 롯데ON 제안이 공통 판정에 «위임» 한다 — 낱말 목록이 두 벌이 아니다", () => {
    const src = strip(readRepo("packages/listing/src/lotteon/notice-item-suggest.ts"));
    expect(src).toContain("resolveNoticeCategory");
    expect(src).toContain("lotteOnNoticeItemCodeFor");
    /* 🔴 자기 낱말 목록을 다시 갖지 않는다 — 두 벌이면 채널마다 다르게 판정한다. */
    expect(src).not.toContain("CHILD_WORDS");
    expect(src).not.toContain("APPAREL_WORDS");
    /* 기존 계약은 그대로 — 반환 모양과 판정 결과가 변하지 않았다. */
    expect(suggestLotteOnNoticeItemCode(["패션의류", "유아동 의류"]).code).toBe("23");
    expect(suggestLotteOnNoticeItemCode(["패션의류", "셔츠"]).code).toBe("01");
    expect(suggestLotteOnNoticeItemCode(["스포츠", "라켓"]).code).toBeNull();
  });

  it("🔴 네이버 builder 가 플래그 하나로 갈라치지 «않는다» — 공통 판정을 부른다", () => {
    const src = strip(readRepo("packages/listing/src/naver/build-payload.ts"));
    /* ① B⑥(2026-10-10) — 🔴 이 가드가 보던 `naverNoticeTypeFor(` 호출이 adapter 로
       옮겨가면서 이 테스트가 먼저 떨어졌다. 가드가 «옳게» 반응한 것이다 —
       지우지 않고 **감시 대상을 넓힌다**(약화시키지 않는다). 지키는 것은 셋이다:
         ① builder 는 여전히 «공통 판정» 을 부른다
         ② 네이버 어휘(KIDS/WEAR) 변환이 «한 곳에만» 있다
         ③ 전 코드 모양이 남아 있지 않다 */
    expect(src).toContain("resolveNoticeCategory({");
    /* ② 변환·조립을 adapter 에 넘겼다 — builder 가 직접 갈라치지 않는다. */
    expect(src).toContain("buildNaverNoticePayload(");
    expect(src).not.toContain("naverNoticeTypeFor(");

    /* 🔴 그 변환이 «실제로» adapter 에 있는지 본다. builder 에서 사라진 것만
       확인하면 「어디에도 없다」와 구별되지 않는다 — 부정 단정에는 대조군을 둔다. */
    const adapter = strip(readRepo("packages/listing/src/notice/channel-notice-adapters.ts"));
    expect(adapter).toContain("naverNoticeTypeForKind");
    expect(adapter).toContain('kind === "KIDS_APPAREL" ? "KIDS" : "WEAR"');

    /* ③ 전 코드 모양이 남아 있으면 안 된다 — 남으면 판정이 두 벌이다. */
    expect(src).not.toContain("productInfoProvidedNotice: categoryRequiresChildCertification");
  });
});

/* ══ P0-5 — 채널 탭에 재고를 «바꾸는» UI 가 없다 ════════════════════════ */
describe("P0-5 채널 탭 — 옵션/재고 편집 손잡이가 타입에도 없다", () => {
  const preview = strip(read("PlatformPreview.tsx"));
  const workspace = strip(readFileSync(join(ROOT, "../CommerceWorkspace.tsx"), "utf8"));

  it("🔴 재고 입력칸이 지워졌다 — CEO 가 본 그 한 칸", () => {
    expect(preview).not.toContain('onFixNumberField?.("stockQuantity"');
    expect(preview).not.toContain('placeholder="원본 재고 미확인"');
  });

  it("🔴 타입에서도 지워졌다 — 화면만 지우면 다음에 다시 배선된다(내가 두 번 그랬다)", () => {
    expect(preview).toContain('onFixNumberField?: (field: "shippingFee", value: number) => void;');
    expect(workspace).toContain('function updateNumberField(key: "shippingFee", value: number)');
  });

  it("배송비 편집은 «남는다» — 채널별로 실제로 다른 값이다", () => {
    expect(preview).toContain('onFixNumberField?.("shippingFee"');
  });

  it("🔴 읽기 전용 요약은 허용된다(CPO 명시) — 재고를 «보여주는» 것은 남는다", () => {
    expect(preview).toContain("재고 모름");
  });
});

/* ══ P0-1 — 기본재고 입력이 조건부가 아니다 ═════════════════════════════ */
describe("P0-1 기본 재고 수량 — 제목으로 승격되고 항상 보인다", () => {
  const sv = strip(read("SourceDataView.tsx"));
  const ove = strip(read("OptionVariantEditor.tsx"));

  it("🔴 라벨이 제목이다 — 경고문이 아니다", () => {
    expect(sv).toContain("기본 재고 수량");
    expect(sv).toContain("※ 원본 재고가 없는 옵션에만 적용됩니다");
  });

  it("🔴 «조건부가 아니다» — 재고를 모르는 옵션이 생기기 전에도 보인다", () => {
    expect(sv).not.toContain("onUpdateSellerDefaultStock && variantsWithUnknownStock(product).length > 0");
    expect(sv).toContain("onUpdateSellerDefaultStock && (");
  });

  it("🔴 옵션 행 placeholder 가 「기본값」이 아니다 — 두 개념이 같은 낱말을 쓰면 화면이 거짓말한다", () => {
    expect(ove).not.toContain('placeholder="기본값"');
    expect(ove).toContain('placeholder="모름"');
  });

  it("🔴 빈 값은 «지운다» — 0 으로 바꾸지 않는다(0 은 품절 주장이다)", () => {
    expect(sv).toContain('v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n');
  });
});

/* ══ P0-3 — 이미지 교체 ═════════════════════════════════════════════════ */
describe("P0-3 상세페이지 블록 — 이미지 교체가 생겼다", () => {
  const panel = strip(read("ProductDetailBlocksPanel.tsx"));
  const override = strip(readRepo("packages/listing/src/common/detail-override.ts"));

  it("🔴 추가한 블록은 이미지를 «갈아끼울 수» 있다", () => {
    expect(panel).toContain("function replaceImage(");
    expect(panel).toContain("이미지 변경");
  });

  it("🔴 교체는 «추가한» 블록에만 — 셀러 기본값 이미지는 주인이 다르다", () => {
    expect(panel).toContain("isProductOnly ? (");
    expect(panel).toContain("셀러 기본 상세페이지의 이미지입니다");
  });

  it("🔴 `DetailBlockPatch.url` 은 여전히 «열지 않는다» — 모순 상태를 만들지 않는다", () => {
    const patchBlock = /export interface DetailBlockPatch \{([\s\S]*?)\n\}/.exec(override)?.[1] ?? "";
    expect(patchBlock.length).toBeGreaterThan(0);
    expect(patchBlock).not.toContain("url");
  });

  it("🔴 「고르는 중」이 추가인지 교체인지 구분된다 — 합치면 교체가 추가로 샌다", () => {
    expect(panel).toContain("setReplacing");
    expect(panel).toContain("if (replacing) {");
  });

  it("제목·문구·caption 편집은 그대로다(회귀 방지)", () => {
    expect(panel).toContain("patch(identity, { heading: e.target.value })");
    expect(panel).toContain("patch(identity, { content: e.target.value })");
    expect(panel).toContain("patch(identity, { caption: e.target.value })");
  });
});

/* ══ P0-4 / P0-7 — 원산지는 상품정보 한 곳 ══════════════════════════════ */
describe("P0-4 · P0-7 원산지 — 상품정보에서 한 번 적고 세 채널이 쓴다", () => {
  const sv = strip(read("SourceDataView.tsx"));

  it("🔴 입력칸이 상품정보에 «있다» — 전에는 채널 탭에만 있었다", () => {
    expect(sv).toContain('<Row label="원산지"');
    expect(sv).toContain('onUpdateField("countryOfOrigin", v)');
  });

  it("🔴 설명이 한 줄로 줄었다(CPO 명시) — 여기서 자동 수집을 돌리지 않는다", () => {
    expect(sv).toContain("세 Commerce 가 이 값을 그대로 씁니다");
    expect(sv).not.toContain("OfficialOriginCheck");
  });

  it("USER_EDITED 보호 문구가 셀러에게 보인다", () => {
    expect(sv).toContain("직접 적은 값은 자동 수집이 덮지 않습니다");
  });
});
