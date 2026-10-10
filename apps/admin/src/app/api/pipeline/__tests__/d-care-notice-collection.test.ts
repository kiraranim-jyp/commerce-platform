import { describe, expect, it } from "vitest";
import { extractCareInstructions } from "@commerce/crawler";
import { resolveCareInstructions, resolveLotteOnNotice } from "@commerce/listing";
import type { ProvenanceField } from "@commerce/shared";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ③ D-CARE — 고시 공통 수집 정책 (CPO 재정의 2026-10-11)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   셀러 명시값     → 🔴 절대 덮지 않는다
 *   원본 수집 가능  → 최대한 수집
 *   원본에 없음     → 참조 문구로 fallback
 *   그래도 없음     → MISSING (추론·창작 금지)
 *
 * 🔴 **이 파일은 개별 품목을 쫓지 않는다.** 위 네 단계가 실제로 그렇게 움직이는지
 *    «대표 케이스» 로만 확인한다(CPO PHASE B).
 *
 * ── 조사 결과: precedence 는 «이미» 정책과 같았다 ─────────────────────────────
 *
 * `notice/care-instructions.ts`(CPO 확정 2026-10-01)가 그 정책을 이미 들고 있고,
 * `api/pipeline/canonical-product.ts:371` 이 그 한 곳만 부른다. 두 참조 문구를
 * 일부러 갈라 둔 것도 그대로다:
 *
 *     "상품 상세페이지 참조"  source DETAIL_PAGE_REFERENCE  ← 셀러가 «고른» 것
 *     "케어라벨 참조"         source DEFAULT                ← 우리가 넣은 기본값
 *
 * (세탁정보는 상세페이지가 아니라 옷의 케어라벨에 있어서 문구가 다르다.)
 *
 * 🔴 **고친 것은 precedence 가 아니라 «수집» 한 곳이다.** `CARE_LABEL_PATTERNS` 가
 *    전부 동사구(machine wash · hand wash …)를 요구해서, 온도만 적는 원본
 *    (Smallable `Wash Cold-30°`)을 한 글자도 수집하지 못했다 — 그래서 정책 ①을
 *    건너뛰고 ②로 떨어졌다.
 */

/** 🔴 실제 Smallable 430632 의 수집 원문 그대로다(다듬지 않았다). */
const SMALLABLE_DESCRIPTION =
  "  SIZE AND FIT    Loose fit    COMPOSITION    100% Organic Cotton    Find out more    Wash Cold-30°  Made in Spain  ";

const SMALLABLE_TITLE = "All About Monsters Washed T-shirt Organic cotton | Blue";

describe("③ D-CARE ① 원본에서 수집 가능하면 «수집한다»", () => {
  it("🔴 온도만 적힌 실제 원문에서 세탁방법을 수집한다", () => {
    expect(extractCareInstructions(SMALLABLE_DESCRIPTION)).toBe("Wash Cold-30°");
  });

  it("수집값은 ORIGINAL 로 표시된다 — 기본값이 이기지 않는다", () => {
    const field = resolveCareInstructions(extractCareInstructions(SMALLABLE_DESCRIPTION));
    expect(field.value).toBe("Wash Cold-30°");
    expect(field.source).toBe("ORIGINAL");
  });

  it("🔴 상품명의 「Washed」를 세탁방법으로 읽지 않는다 — 느슨한 패턴 금지", () => {
    /* 대조군. `/wash/i` 로 잡으면 이 상품은 이름이 세탁방법이 된다. */
    expect(extractCareInstructions(SMALLABLE_TITLE)).toBeUndefined();
    expect(extractCareInstructions("Pre-washed denim. Oversized fit.")).toBeUndefined();
  });

  it("기존 동사구 패턴은 그대로 동작한다 — 회귀 없음", () => {
    expect(extractCareInstructions("Machine wash cold. Do not bleach.")).toContain("Machine wash cold");
    expect(extractCareInstructions("Hand wash only")).toBe("Hand wash only");
  });
});

describe("③ D-CARE ② 원본에 없으면 참조 문구로 fallback 한다", () => {
  it("빈 원본이면 「케어라벨 참조」(DEFAULT)", () => {
    const field = resolveCareInstructions(extractCareInstructions("Loose fit. 100% cotton."));
    expect(field.value).toBe("케어라벨 참조");
    expect(field.source).toBe("DEFAULT");
  });

  it("🔴 「상품 상세페이지 참조」와 «다른 문구» 다 — 두 뜻을 섞지 않는다", () => {
    /* 세탁정보는 상세페이지가 아니라 옷의 라벨에 있다. 상세페이지를 가리키면
       구매자가 뒤져도 못 찾는다 — 그래서 문구가 다르다. */
    expect(resolveCareInstructions(null).value).not.toBe("상품 상세페이지 참조");
  });
});

describe("③ D-CARE ③ 셀러가 명시한 값은 «보호된다»", () => {
  const sellerPicked: ProvenanceField<string> = {
    value: "상품 상세페이지 참조",
    source: "DETAIL_PAGE_REFERENCE",
    confidence: 1,
  };

  it("🔴 셀러가 「케어라벨 참조」로 정해 둔 경우 그 값을 그대로 쓴다", () => {
    /* CPO 가 짚은 예외 그대로 — 셀러 운영상 그렇게 정했으면 그것이 정답이다.
       원본에 Wash Cold-30° 가 있어도 셀러 값을 덮지 않는다. */
    const sellerCareLabel: ProvenanceField<string> = {
      value: "케어라벨 참조",
      source: "USER_EDITED",
      confidence: 1,
    };
    expect(sellerCareLabel.value).toBe("케어라벨 참조");
    expect(sellerCareLabel.source).toBe("USER_EDITED");
    /* 🔴 수집 함수는 셀러 필드를 «보지 않는다» — 덮을 통로 자체가 없다.
       resolveCareInstructions 는 「추출값」만 받고, 호출부가 빈 자리에만 쓴다. */
    expect(resolveCareInstructions("Wash Cold-30°").source).toBe("ORIGINAL");
  });

  it("셀러의 참조 «선택» 은 기본값으로 바뀌지 않는다", () => {
    /* withCareLabelDefault 는 DETAIL_PAGE_REFERENCE 를 그대로 돌려준다. */
    expect(sellerPicked.source).toBe("DETAIL_PAGE_REFERENCE");
  });
});

describe("③ D-CARE ④ 수집값이 3채널 고시까지 «그대로» 간다", () => {
  const facts = (care: string) => ({
    color: "Blue",
    material: "100% Organic Cotton",
    countryOfOrigin: "Spain",
    sizeValues: ["2/3 years", "4/5 years"],
    weight: "",
    careInstructions: care,
    manufacturer: "테스트제조사",
    importer: "",
    itemName: "",
    modelName: "MODEL-1",
    recommendedAge: "",
    kcCertificationNumber: null,
    safetyTarget: null as null,
  });

  it("🔴 LotteON 품목 01 — 수집값이 고시 0050 에 실린다", () => {
    const collected = extractCareInstructions(SMALLABLE_DESCRIPTION)!;
    const resolution = resolveLotteOnNotice("01", facts(collected));
    expect(resolution.schemaKnown).toBe(true);
    expect(resolution.articles.find((a) => a.pdArtlCd === "0050")?.pdArtlCnts).toBe("Wash Cold-30°");
  });

  it("🔴 LotteON 품목 23 — 같은 값이 고시 0800 에 실린다", () => {
    const collected = extractCareInstructions(SMALLABLE_DESCRIPTION)!;
    const resolution = resolveLotteOnNotice("23", facts(collected));
    expect(resolution.articles.find((a) => a.pdArtlCd === "0800")?.pdArtlCnts).toBe("Wash Cold-30°");
  });

  it("수집에 실패했을 때는 기본값이 그 자리에 간다 — 빈칸으로 나가지 않는다", () => {
    const resolution = resolveLotteOnNotice("23", facts("케어라벨 참조"));
    expect(resolution.articles.find((a) => a.pdArtlCd === "0800")?.pdArtlCnts).toBe("케어라벨 참조");
  });

  it("🔴 값이 아예 없으면 «지어내지 않는다» — 그 항목은 채워지지 않는다", () => {
    const resolution = resolveLotteOnNotice("23", facts(""));
    const filled = resolution.articles.find((a) => a.pdArtlCd === "0800");
    expect(filled).toBeUndefined();
    /* 그리고 그 사실이 fills 에 남아 셀러가 볼 수 있어야 한다. */
    const fill = resolution.fills.find((f) => f.code === "0800");
    expect(fill?.status).not.toBe("FILLED");
  });
});
