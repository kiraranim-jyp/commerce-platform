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
 * ── 실측 3회가 결론을 뒤집은 과정 ──────────────────────────────────────────
 *   1차 a7572b88  색상="전체 상품 상세페이지 참조" · 신발사이즈="28 EUR (UK 10)"
 *                 → "허용되지 않는 구매옵션 값이 입력되었습니다."
 *   2차 e6094f66  색상 «없음» · 신발사이즈="UK 1"/"UK 1"
 *                 → "중복된 옵션값이 있습니다."
 *   3차           색상 «없음» · 신발사이즈="UK 10"/"UK 11"
 *                 → "필수 구매 옵션(미입력시 등록/노출 제한) 존재하지 않습니다."
 *
 * 🔴 첫 가설(㈀ — 고시 문구가 구매옵션에 들어간 것이 원인)은 **반증됐다.**
 *    3차에서 신발사이즈가 유효해지고 서로 달라진 뒤 남은 오류는 색상을 «보내지
 *    않은 것» 이었다. 1차의 진범은 신발사이즈 하나였고 자리채움 문구는 무고했다.
 *
 * ── 그래서 지금 살아 있는 수정은 이것뿐이다 ────────────────────────────────
 *   ㈁ matchOptionValue 결과도 resolveEnumValue 를 거친다(형제 경로와 대칭).
 *   ㈁' 부분일치는 «방향» 에 따라 짧은 쪽/긴 쪽을 고른다(2차 회귀 수정).
 *   ㈀ 철회 — 구매옵션 자리채움은 되돌렸다. 다만 상수 이름을 갈라
 *      (ATTRIBUTE_FALLBACK_CONTENT) 고시정책과 함께 끌려다니지 않게 했다.
 *
 * 🔴 ㈂(값 없는 MANDATORY 구매옵션 사전 차단)은 **넣지 않았다** — CEO 판정.
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

describe("🔴 MANDATORY 구매옵션은 «자리를 비우면» 안 된다 — 실측 3차가 가르쳐 준 것", () => {
  const built = buildCoupangCompliance(meta([attr("색상"), attr("신발사이즈")]), CONTEXT, VARIANT_CONTEXT);

  it("🔴 채울 값도 허용값도 없으면 자리채움을 «보낸다» — 빼면 쿠팡이 없다고 거절한다", () => {
    // 3차 실측: 색상을 빼자 「필수 구매 옵션(미입력시 등록/노출 제한) 존재하지
    // 않습니다」로 죽었다. 한때 이 단정은 정반대였다 — 실측이 뒤집었다.
    expect(valueOf(built.attributes, "색상")).toBe("전체 상품 상세페이지 참조");
  });

  it("빈 문자열은 그래도 나가지 않는다", () => {
    expect(built.attributes.every((a) => a.attributeValueName.trim().length > 0)).toBe(true);
  });

  it("🔴 자리채움이라는 «사실» 은 기록에 남는다 — 채워졌다고 속이지 않는다", () => {
    const color = built.attributeResults.find((r) => r.fieldName === "색상")!;
    expect(color.source).toBe("PLACEHOLDER");
    expect(color.confidence).toBeLessThanOrEqual(0.1);
    expect(color.unmappedReason).toBe("NO_VALUE");
  });

  it("🔴 자유 입력(허용값 없음)이면 원본 옵션값이 한 글자도 안 바뀐다", () => {
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
   실제 2차 실패 재현 — 「중복된 옵션값이 있습니다」
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * registration_attempts e6094f66 · 2026-09-22 11:48 · coupang · FAILED · API005
 *   응답: "중복된 옵션값이 있습니다."
 *   item[0] 신발사이즈 = "UK 1"   [OPTION_MATCH]
 *   item[1] 신발사이즈 = "UK 1"   [OPTION_MATCH]   ← 둘이 «같은 값» 이 됐다
 *
 * 이 실패가 두 가지를 동시에 증명했다.
 *   ① 색상 PLACEHOLDER 가 payload 에서 사라졌다 — ㈀ 이 실제로 동작했고
 *      「허용되지 않는 구매옵션 값」 오류가 없어졌다.
 *   ② 쿠팡 신발사이즈는 **자유 입력이 아니라 enum** 이다(허용값에 "UK 1" 이
 *      있으므로). 즉 원래 보내던 "28 EUR (UK 10)" 도 허용값이 아니었다.
 *
 * 그리고 하나를 새로 만들었다: resolveEnumValue 의 부분일치가 «배열에서 먼저
 * 걸리는 것» 을 골라 "UK 10"/"UK 11" 대신 둘 다 "UK 1" 이 됐다.
 */
const UK_SIZES = ["UK 1", "UK 2", "UK 10", "UK 11", "UK 12"];

describe("실제 2차 실패 — 서로 다른 옵션값이 같은 허용값으로 뭉치면 안 된다", () => {
  const sizeOf = (optionValue: string) =>
    valueOf(
      buildCoupangCompliance(meta([attr("신발사이즈", UK_SIZES)]), CONTEXT, {
        optionGroups: [{ name: "Size", values: ["28 EUR (UK 10)", "29 EUR (UK 11)"] }],
        variant: { id: "v", optionValues: { Size: optionValue } },
      }).attributes,
      "신발사이즈",
    );

  it("🔴 «가장 구체적인» 허용값을 고른다 — 조각 「UK 1」이 아니라 「UK 10」", () => {
    expect(sizeOf("28 EUR (UK 10)")).toBe("UK 10");
  });

  it("🔴 두 번째 단품도 자기 값을 받는다 — 「UK 11」", () => {
    expect(sizeOf("29 EUR (UK 11)")).toBe("UK 11");
  });

  it("🔴 두 단품이 «서로 다른» 값을 갖는다 — 이것이 「중복된 옵션값」의 재발 방지다", () => {
    const a = sizeOf("28 EUR (UK 10)");
    const b = sizeOf("29 EUR (UK 11)");
    expect(a).not.toBe(b);
    expect([a, b]).not.toContain("UK 1");
  });

  it("🔴 반대 방향은 예전 그대로 — 후보가 더 긴 값의 일부면 «가장 짧은» 것을 고른다", () => {
    // "네이비" ⊂ "네이비블루" — 여기서 긴 쪽을 고르면 색상이 엉뚱해진다.
    const built = buildCoupangCompliance(
      meta([attr("색상", ["네이비블루", "네이비", "네이비그레이"])]),
      { ...CONTEXT, color: "네이비" },
      { optionGroups: [] },
    );
    expect(valueOf(built.attributes, "색상")).toBe("네이비");
  });

  it("허용값 어디에도 걸리지 않으면 그 값을 쓰지 않는다 — 지어내지 않는다", () => {
    const built = buildCoupangCompliance(meta([attr("신발사이즈", ["230", "235", "240"])]), CONTEXT, {
      optionGroups: [{ name: "Size", values: ["28 EUR (UK 10)"] }],
      variant: { id: "v", optionValues: { Size: "28 EUR (UK 10)" } },
    });
    expect(valueOf(built.attributes, "신발사이즈")).not.toBe("28 EUR (UK 10)");
    expect(["230", "235", "240"]).toContain(valueOf(built.attributes, "신발사이즈"));
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
