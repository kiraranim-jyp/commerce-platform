import { describe, expect, it } from "vitest";
import { buildCoupangCompliance, type CoupangCategoryMeta } from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-REAL-OPTION-01(CEO 확정, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 «실제로 실패한 등록» 을 그대로 재현한다. 지어낸 입력이 아니다.
 *
 *     registration_attempts  a7572b88-4a50-4228-b0c5-b25718ce3e74
 *     2026-09-22 10:55:36 KST · platform=coupang · status=FAILED · API005
 *     상품   Lulu T Bar Shoes in Vernice Nero by PèPè
 *     카테고리 70346  ROOT,패션의류잡화,영유아동 신발/잡화/기타의류(0~17세),
 *                     여아신발,여아 구두
 *
 *     보낸 것  items[].attributes
 *        색상       = "전체 상품 상세페이지 참조"   [PLACEHOLDER · conf 0.1]
 *        신발사이즈 = "28 EUR (UK 10)"             [OPTION_MATCH · conf 0.95]
 *
 *     받은 것  { code:"ERROR",
 *                message:"유효하지 않은 구매 옵션 값이 존재합니다.
 *                         |허용되지 않는 구매옵션 값이 입력되었습니다." }
 *
 * ── 왜 "전체 상품 상세페이지 참조" 가 거기 있었나 ──────────────────────────
 * `NOTICE_DEFAULT_CONTENT` 는 build-payload.ts L583 에서 스스로 «상품정보제공
 * 고시» 용 관용 문구라고 말한다. 그것이 **구매옵션(attributes)의 마지막 폴백**
 * 으로도 쓰이고 있었다. 2026-07-30 성공 건(cat 70625)은 이 폴백을 «탄 적이
 * 없다» — 그때 색상은 attr.inputValues[0] = "상세페이지 참조", 즉 쿠팡이 «준»
 * 값이었다. 구매옵션에 고시 문구가 들어간 첫 사례가 이번 실패다.
 *
 * ── 이번에 고친 것 두 가지뿐이다 ───────────────────────────────────────────
 *   ㈀ 구매옵션 폴백에서 NOTICE_DEFAULT_CONTENT 제거. 값이 없으면 «비운다».
 *   ㈁ matchOptionValue 결과도 resolveEnumValue 를 거친다(형제 경로와 대칭).
 *
 * 🔴 ㈂(값 없는 MANDATORY 구매옵션 사전 차단)은 **넣지 않았다** — CEO 판정:
 *    실제 원인 확정 전에 등록 가능 범위를 바꾸지 않는다. 재등록 결과로 결정한다.
 */

const CONTEXT = {
  productName: "Lulu T Bar Shoes in Vernice Nero by PèPè - Last Ones In Stock - 28-29 EUR",
  contactNumber: "010-0000-0000",
};

/** 실패 당시 옵션 구조 그대로 — 옵션그룹 1개(Size) · 값 2개. */
const VARIANT_CONTEXT = {
  optionGroups: [{ name: "Size", values: ["28 EUR (UK 10)", "29 EUR (UK 11)"] }],
  variant: { id: "v1", optionValues: { Size: "28 EUR (UK 10)" }, sku: "KA1-2" },
};

const attr = (attributeTypeName: string, inputValues: string[] = []) => ({
  attributeTypeName,
  dataType: "STRING",
  inputType: "INPUT",
  inputValues,
  basicUnit: "없음",
  required: "MANDATORY" as const,
});

const meta = (attributes: CoupangCategoryMeta["attributes"]): CoupangCategoryMeta => ({
  attributes,
  noticeCategories: [],
});

const valueOf = (attributes: { attributeTypeName: string; attributeValueName: string }[], name: string) =>
  attributes.find((a) => a.attributeTypeName === name)?.attributeValueName;

/* ════════════════════════════════════════════════════════════════════════════
   ㈀ — 고시 문구는 구매옵션에 «서지 않는다»
   ════════════════════════════════════════════════════════════════════════════ */

describe("㈀ 실패 재현 — 카테고리 70346(색상·신발사이즈 둘 다 자유 입력)", () => {
  // CEO 실측 답변: 이 카테고리의 두 속성은 «자유 입력란» 이다 = inputValues 비어 있음.
  const built = buildCoupangCompliance(meta([attr("색상"), attr("신발사이즈")]), CONTEXT, VARIANT_CONTEXT);

  it("🔴 「전체 상품 상세페이지 참조」가 구매옵션 어디에도 없다 — 이것이 이번 수정의 전부다", () => {
    const values = built.attributes.map((a) => a.attributeValueName);
    expect(values).not.toContain("전체 상품 상세페이지 참조");
    expect(values.some((v) => v.includes("상세페이지 참조"))).toBe(false);
  });

  it("🔴 채울 값이 없는 색상은 «보내지 않는다» — 빈 문자열도 보내지 않는다", () => {
    expect(valueOf(built.attributes, "색상")).toBeUndefined();
    expect(built.attributes.every((a) => a.attributeValueName.trim().length > 0)).toBe(true);
  });

  it("🔴 그래도 «못 채웠다» 는 기록은 남는다 — 조용히 사라지지 않는다", () => {
    const color = built.attributeResults.find((r) => r.fieldName === "색상");
    expect(color).toBeDefined();
    expect(color!.source).toBe("PLACEHOLDER");
    expect(color!.unmappedReason).toBe("NO_VALUE");
  });

  it("🔴 원본 옵션값은 «한 글자도» 바뀌지 않는다 — 자유 입력이므로 그대로 나간다", () => {
    expect(valueOf(built.attributes, "신발사이즈")).toBe("28 EUR (UK 10)");
  });

  it("두 번째 단품도 자기 옵션값을 그대로 쓴다", () => {
    const second = buildCoupangCompliance(meta([attr("색상"), attr("신발사이즈")]), CONTEXT, {
      ...VARIANT_CONTEXT,
      variant: { id: "v2", optionValues: { Size: "29 EUR (UK 11)" } },
    });
    expect(valueOf(second.attributes, "신발사이즈")).toBe("29 EUR (UK 11)");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   무회귀 — 쿠팡이 허용값을 «준» 경우는 예전 그대로다
   ════════════════════════════════════════════════════════════════════════════ */

describe("무회귀 — 2026-07-30 성공 건(cat 70625)의 모양이 그대로 유지된다", () => {
  it("🔴 색상에 허용값이 있으면 그 첫 값을 쓴다 — 성공 건이 실제로 보낸 값이다", () => {
    const built = buildCoupangCompliance(
      meta([attr("색상", ["상세페이지 참조", "블랙", "화이트"])]),
      CONTEXT,
      VARIANT_CONTEXT,
    );
    expect(valueOf(built.attributes, "색상")).toBe("상세페이지 참조");
  });

  it("허용값이 정확히 하나면 그것으로 채운다(DETERMINISTIC 분기 유지)", () => {
    const built = buildCoupangCompliance(meta([attr("신발사이즈", ["1.5C"])]), CONTEXT, {
      optionGroups: [],
    });
    expect(valueOf(built.attributes, "신발사이즈")).toBe("1.5C");
  });

  it("상품에 실제 색상이 있으면 예전처럼 매칭된다(PRODUCT_FIELD 경로 무변경)", () => {
    const built = buildCoupangCompliance(meta([attr("색상", ["핑크", "블랙"])]), { ...CONTEXT, color: "Pink" }, {
      optionGroups: [],
    });
    expect(valueOf(built.attributes, "색상")).toBe("핑크");
  });

  it("사람이 직접 넣은 값은 여전히 무엇보다 먼저다(USER_INPUT)", () => {
    const built = buildCoupangCompliance(
      meta([attr("색상")]),
      { ...CONTEXT, userOverrides: { 색상: "블랙" } },
      VARIANT_CONTEXT,
    );
    expect(valueOf(built.attributes, "색상")).toBe("블랙");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ㈁ — 원본 옵션값도 «허용 목록» 을 한 번 거친다
   ════════════════════════════════════════════════════════════════════════════ */

describe("㈁ matchOptionValue 가 resolveEnumValue 를 거친다", () => {
  it("🔴 자유 입력(허용목록 없음)이면 값을 그대로 통과시킨다 — 이번 실패 케이스의 조건", () => {
    const built = buildCoupangCompliance(meta([attr("신발사이즈")]), CONTEXT, VARIANT_CONTEXT);
    expect(valueOf(built.attributes, "신발사이즈")).toBe("28 EUR (UK 10)");
  });

  it("🔴 허용 목록이 있는데 원본 옵션값이 거기 없으면 그 값을 «보내지 않는다»", () => {
    const built = buildCoupangCompliance(
      meta([attr("신발사이즈", ["130", "135", "140"])]),
      CONTEXT,
      VARIANT_CONTEXT,
    );
    // 예전에는 "28 EUR (UK 10)" 이 검증 없이 그대로 나갔다.
    expect(valueOf(built.attributes, "신발사이즈")).not.toBe("28 EUR (UK 10)");
    // 🔴 숫자만 남기는 식으로 «지어내지» 않는다 — 쿠팡이 준 값 중 하나를 쓴다.
    expect(["130", "135", "140"]).toContain(valueOf(built.attributes, "신발사이즈"));
  });

  it("허용 목록에 원본 옵션값이 «있으면» 그대로 쓴다", () => {
    const built = buildCoupangCompliance(meta([attr("신발사이즈", ["28 EUR (UK 10)", "29 EUR (UK 11)"])]), CONTEXT, {
      ...VARIANT_CONTEXT,
    });
    expect(valueOf(built.attributes, "신발사이즈")).toBe("28 EUR (UK 10)");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   고시정보(notices)는 이번 수정의 «대상이 아니다»
   ════════════════════════════════════════════════════════════════════════════ */

describe("고시정보는 그대로다 — 문구가 옮겨간 것이 아니라 «잘못 쓰이던 곳»에서만 빠졌다", () => {
  it("🔴 고시정보에는 「전체 상품 상세페이지 참조」가 계속 쓰인다", () => {
    const built = buildCoupangCompliance(
      {
        attributes: [],
        noticeCategories: [
          {
            noticeCategoryName: "기타 재화",
            // 상품 필드와 매칭되는 규칙이 없는 항목을 고른다 — 매칭되는 이름을
            // 쓰면 그 값이 채워져서 «폴백이 살아 있는가» 를 못 본다.
            noticeCategoryDetailNames: [{ noticeCategoryDetailName: "기타 추가 정보", required: "MANDATORY" }],
          },
        ],
      },
      CONTEXT,
      { optionGroups: [] },
    );
    expect(built.notices.length).toBeGreaterThan(0);
    expect(built.notices.some((n) => n.content === "전체 상품 상세페이지 참조")).toBe(true);
  });
});
