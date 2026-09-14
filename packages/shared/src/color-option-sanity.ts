import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "./product-types";

/**
 * MATCHING-3.2-F/D(CEO 지시, 2026-09-14) — **COLOR OPTION SANITY FILTER**.
 *
 * 이 파일이 하는 일은 딱 하나다 — `optionGroups`의 **색상 축**이 "이 리스팅이
 * 실제로 파는 색 집합"이라고 말할 수 있는 모양인지 판별한다. 그 이상은 하지
 * 않는다. 특히:
 *
 *   - 이 함수의 결과를 매칭의 COLOR 축에 배선하지 **않는다**(3.2-E GATE 2 =
 *     STOP 유지). 오늘 이 파일을 import하는 프로덕션 코드는 **없다**. 거름망을
 *     먼저 만들어 두고, 배선 여부는 별도 승인 사안으로 남긴다.
 *   - `optionGroups`를 `color.value`보다 권위 있는 값으로 승격하지 않는다.
 *   - **SIZE 축을 절대 건드리지 않는다.** `optionGroups`는 색상에는 도달하지
 *     않지만 사이즈에는 도달한다
 *     (`product-identity-dna.ts:resolveSizeRange` → `dna.sizeRange` →
 *      `ProductFacts.sizeLabels` → `compareSize`). 그래서 이 거름망을
 *     `optionGroups` 전체에 적용하면 **사이즈 데이터가 조용히 사라진다** —
 *     실제로 운영 DB의 `Size=["OS"]`(theanimalsobservatory 1행)는 `variants`가
 *     비어 있어 아래 D2에 걸린다. 그런 일이 구조적으로 불가능하도록 이 파일은
 *     `resolveSizeRange`와 **다른 파일·다른 함수**로 분리했고, 색상 축 이름에
 *     걸린 그룹 하나만 읽는다. 다른 축은 읽지도, 돌려주지도 않는다.
 *
 * 판별 조건(3.2-F §8, 관측 근거는 각 항목 주석 참고):
 *
 *   D1  색상 축이 정확히 1개
 *   D2  `variants`가 비어있지 않다
 *   D3  축의 values 집합 == `variants[].optionValues[축]` 집합
 *       (선언이 더 크면 "가족 목록"이므로 버린다)
 *
 *   D4(경로별 분기: ProductGroup vs Shopify)는 이번 범위가 아니다 — 구현하지
 *   않았다. 그래서 이 파일은 `variants[].id`의 모양(3.2-F §5-1)을 보지 않는다.
 *
 * 저장 시점이 아니라 **소비 시점**에 거른다 — 크롤러가 저장한 원본
 * `optionGroups`는 그대로 둔다. 역사 데이터를 파괴하지 않고, 판단이 바뀌면
 * 이 파일만 되돌리면 된다.
 *
 * 실측 요약(2026-09-14, 이 구현으로 직접 돌린 수치 · SELECT 전용 · 외부는 GET만):
 *
 *   운영 DB dedup 67행     색상 축 없음 62 · 통과 5 · 차단 0
 *                          (차단 0 = 오늘의 판정을 한 건도 바꾸지 않는다)
 *   dna.sizeRange          HEAD 대비 **변한 행 0/67**(사이즈 축 43행 · 값 218개
 *                          · `OS` 1행 모두 그대로)
 *   외부 642상품           차단 238(D3 233 + D2 5) · 통과 404(다색 139 · 단일 265)
 *   표본 한계              D3/D2 의 외부 수치는 **운영 밖 3개 스토어**
 *                          (brooklinen · rothys · vessi)에서 쟀다. 오늘의 8개
 *                          판매처에는 이 모양이 0건이다 — "이미 들어와 있다"가
 *                          아니라 "들어오는 것을 막는 것이 없다"가 정확하다.
 */

/** 색상 축을 고르는 유일한 규칙은 **축 이름 문자열**이다(값을 보지 않는다) —
 * `resolveSizeRange`가 `/size|사이즈|치수/i`로 사이즈 축을 고르는 것과 같은
 * 방식이다. 축 이름은 경로마다 다르다: JSON-LD/Shopify는 원문 그대로
 * (`Color`/`Colour`), DOM `<select>` 경로는 한국어로 정규화(`색상`).
 *
 * 이 정규식과 `resolveSizeRange`의 정규식은 **서로 겹치지 않는다** — 운영 DB에
 * 존재하는 축 이름 4종(`Size` 32행 · `Clothing size` 12행 · `Color` 5행 ·
 * `Title` 1행) 중 두 정규식에 동시에 걸리는 이름은 없다(회귀 테스트로 고정). */
const COLOR_AXIS_NAME_PATTERN = /colou?r|색상/i;

export type ColorOptionRejection =
  /** 색상 축이 없다 = 이 필터가 아무것도 하지 않는다. 운영 DB dedup 67행 중
   * **62행**이 여기다(옵션 없음 18 + Size 31 + Clothing size 12 + Title 1). */
  | "NO_COLOR_AXIS"
  /** D1 — 색상으로 걸리는 축이 2개 이상이라 어느 것이 색인지 모른다.
   * 운영 DB 발생 0건(방어만). */
  | "AMBIGUOUS_COLOR_AXIS"
  /** D2 — `variants`가 비어 있다. 값이 있는 것처럼 보이지만 실제 판매 단위가
   * 하나도 없다는 뜻이고, 이런 `optionGroups`는 "구매 옵션"이 아니다.
   *
   * 근거(3.2-F §6): 이 모양을 만드는 코드 경로가 셋인데 셋 다 구조적으로
   * `variants`를 채우지 않는다 —
   *   `shopify-product-json.ts:420`   hasRealOptions=false → `variants=[]`
   *                                   (Shopify 자리표시자 `Title=["Default Title"]`)
   *   `product-data-extractor.ts:627` 본문 텍스트 경로(치수 스펙 cm)는 절대 안 채움
   *   `prestashop.site-strategy.ts:337` combinations가 없으면 안 채움
   * 운영 DB에서는 자리표시자 **2/2행이 정확히 걸린다**(`Title=["Default Title"]`
   * junioredition · `Size=["OS"]` theanimalsobservatory). 단 그 2행은 둘 다
   * **색상 축이 아니므로** 이 필터에 애초에 들어오지 않는다 — 즉 이 필터는
   * `OS`(사이즈 값)를 지우지 않는다.
   *
   * 외부 642상품 재측정(2026-09-14, 이 구현으로 직접): **5건 차단**(전부
   * brooklinen — 색상 값 1개짜리 단일 옵션 상품이라 Shopify가 `variants`를
   * 비운 모양). 3.2-F §8-1 은 D3 만으로 세어 이 5건을 "통과"로 분류했었다 —
   * D2 가 그보다 5건 더 보수적이라는 뜻이고, 그 5건은 실제 판매 조합으로
   * 교차확인할 방법이 없는 값이다. */
  | "NO_VARIANTS"
  /** D3 — 선언한 색이 실제로 파는 색보다 많다 = "이 색 가족의 형제 목록"이지
   * 이 페이지의 구매 옵션이 아니다.
   *
   * 근거(3.2-F §4-3, 이 구현으로 2026-09-14 재측정해 같은 수를 얻었다):
   * 외부 642상품(brooklinen 144 · rothys 250 · vessi 248, `products.json`
   * limit=250 1페이지)에서 **233건 차단**(rothys 232 · brooklinen 1) ·
   * **404건 통과**(다색 139 + 단일색 265) · 판정불능 0건. 실측 예 —
   * `rothys.com/products/womens-point-flat-iii-revelvet-mulberry`는
   * `options[0]={Color, 12값}`인데 `variants` 17개가 전부 한 색(1색×17사이즈)이다.
   * 운영 DB dedup 67행에서는 **D3 차단 0건**(색상 축 5행 전부 통과) =
   * 오늘 정상 데이터 손실 0.
   *
   * 표본 한계: D3의 233/409 수치는 **운영 밖 3개 스토어**에서 쟀다(오늘의 8개
   * 판매처에는 이 모양이 0건이다 — 막을 것이 없어서가 아니라 아직 안 들어왔다).
   *
   * 반대 방향(실제가 선언보다 큼)도 같은 이유로 여기로 떨어진다 — 선언이
   * 불완전하다는 뜻이고, 그것도 "이 리스팅이 파는 색 집합"이 아니다.
   * 관측 0건(운영 DB·외부 642상품 모두). */
  | "DECLARED_EXCEEDS_SOLD";

export interface ColorOptionSanityResult {
  /** 통과했을 때만 원본 순서 그대로의 색상 값 목록. 떨어지면 **항상 빈 배열**이다
   * — 부분 통과나 추정값을 절대 만들지 않는다. */
  values: string[];
  /** 통과했을 때 그 축의 원본 이름(`Color`/`Colour`/`색상`). 떨어지면 null. */
  axisName: string | null;
  /** 떨어진 이유. 통과했으면 null. */
  rejectedBy: ColorOptionRejection | null;
}

/** `CanonicalProduct`를 통째로 받지 않는다 — 이 거름망이 읽는 칸을 타입으로
 * 못 박아 두면 "다른 축/다른 필드를 건드리지 않는다"가 구조적으로 보장된다.
 * `CanonicalProduct`는 이 모양을 그대로 만족한다. */
export interface ColorOptionSanityInput {
  optionGroups?: CanonicalProductOptionGroup[] | null;
  variants?: CanonicalProductVariant[] | null;
}

const REJECTED = (reason: ColorOptionRejection): ColorOptionSanityResult => ({
  values: [],
  axisName: null,
  rejectedBy: reason,
});

export function checkColorOptionSanity(input: ColorOptionSanityInput): ColorOptionSanityResult {
  // D1 — 색상 축이 정확히 1개.
  const colorAxes = (input.optionGroups ?? []).filter((g) => COLOR_AXIS_NAME_PATTERN.test(g.name));
  if (colorAxes.length === 0) return REJECTED("NO_COLOR_AXIS");
  if (colorAxes.length > 1) return REJECTED("AMBIGUOUS_COLOR_AXIS");
  const axis = colorAxes[0];

  const declared = new Set(axis.values.map((v) => v.trim()).filter((v) => v.length > 0));
  if (declared.size === 0) return REJECTED("NO_COLOR_AXIS");

  // D2 — variants가 비어있지 않다.
  const variants = input.variants ?? [];
  if (variants.length === 0) return REJECTED("NO_VARIANTS");

  // D3 — 선언 집합 == 실제 판매 조합에 등장하는 집합.
  // 양방향으로 같아야 한다. 선언이 더 크면 가족 목록이고, 실제가 더 크면
  // 선언이 불완전한 것이라 어느 쪽도 "이 리스팅이 파는 색 집합"이 아니다.
  const sold = new Set<string>();
  for (const variant of variants) {
    const value = variant.optionValues?.[axis.name];
    if (typeof value === "string" && value.trim()) sold.add(value.trim());
  }
  if (sold.size !== declared.size) return REJECTED("DECLARED_EXCEEDS_SOLD");
  for (const value of sold) {
    if (!declared.has(value)) return REJECTED("DECLARED_EXCEEDS_SOLD");
  }

  return { values: [...axis.values], axisName: axis.name, rejectedBy: null };
}
