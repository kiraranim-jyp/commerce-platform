"use client";

import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { convertToKrw, formatKrw } from "@commerce/pricing";
import { InfoTip } from "./registration-fields";
import { EditableText, EditableTextarea } from "./EditableField";
import { OptionVariantEditor } from "./OptionVariantEditor";
import { variantsWithUnknownStock } from "@commerce/shared";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

/**
 * Sprint A-9(작업4 — CEO 지시: "현재 원본 가격만 가져옵니다. 원하는 것은
 * 원본통화 → 실시간 환율 → KRW 자동 계산") — 실제 환율 변환 로직(PriceEditor,
 * /api/exchange-rates)은 이미 있었지만, 분석 직후 가장 먼저 보이는 이 화면
 * (source 탭)에는 원본 통화만 보이고 KRW 환산이 전혀 없었다. "가격" 아코디언을
 * 열어야만(쿠팡 탭 안) 환산값이 보였다 — 대표님이 본 화면은 여기였을 가능성이
 * 높다. 같은 계산 로직(convertToKrw)을 재사용해 라이트하게 옆에 붙인다.
 */
/** DELTA-B(CEO 판정, 2026-09-15) — 이 화면에서 "모델명"이라고만 적으면 **두
 * 개념이 섞인다.** 한 칸이 두 자리로 나가기 때문이다:
 *
 *   ① 고시정보 모델명              productInfoProvidedNotice(KIDS).modelName
 *   ② 네이버 쇼핑 카탈로그 모델명   naverShoppingSearchInfo.modelName
 *
 * 등록을 막는 쪽은 ②이고, «상세페이지 참조»로 채워지는 쪽은 ①뿐이다. 그래서
 * 이 칸의 **이름을 ②로 적는다** — 셀러가 화면을 보고 "아, 네이버 쇼핑
 * 카탈로그에 들어가는 모델명이구나"를 바로 알아야 한다. ①은 참조를 골랐을 때만
 * 이름이 등장한다(그때만 관계가 생긴다).
 *
 * 🔴 SKU와 섞지 않는다 — 바로 위 칸이고 값도 있지만 payload에서 서로 다른
 * 자리로 나간다(sku → sellerManagementCode). 두 줄 모두 "이 값이 어디로
 * 가는가"를 자기 줄에 달고 있는 이유다. */
export const CATALOG_MODEL_NAME_LABEL = "네이버 쇼핑 카탈로그 모델명";
/** 🔴 P5.6 P0-1 — 우선순위 안내가 이 칸으로 이동할 때 쓰는 DOM id.
 *  readiness-state 의 REGISTRATION_FIELD_ANCHOR 와 PlatformPreview 가 같은 상수를
 *  본다 — 문자열을 두 곳에 적으면 한쪽만 바뀌어 이동이 조용히 깨진다. */
export const CATALOG_MODEL_NAME_ANCHOR = "field-catalogModelName";

export function SourceDataView({
  product,
  onUpdateField,
  onUpdatePrice,
  onUpdateKeywords,
  onUpdateVariant,
  onUpdateSellerDefaultStock,
  onGenerateDescription,
  onSetModelNameReference,
  exchangeRates,
}: {
  product: CanonicalProduct;
  onUpdateField: (
    /* REWORK-8 ①(CEO 지시, 2026-09-15) — "modelName"이 새로 들어왔다. 이 union은
       CommerceWorkspace.updateField()의 키 집합의 부분집합이고(그쪽에 이미
       "modelName"이 있다), 넓히는 것 말고 새 배선을 만들지 않았다. */
    /* 🔴 P5.6 재작업 — "descriptionKo" 가 들어왔다. CommerceWorkspace.updateField()
       가 이미 그 키를 받는다(그 함수의 union 부분집합이다) — 새 setter 를
       만들지 않았다. "description" 은 그대로 둔다: 쓰는 곳은 없어졌지만 이
       union 은 CommerceWorkspace 쪽과 맞춰 둔 것이고, 좁히면 다른 호출부가 깨진다. */
    key: "title" | "brand" | "sku" | "description" | "descriptionKo" | "material" | "modelName",
    value: string,
  ) => void;
  onUpdatePrice: (amount: number, currency: string) => void;
  /** 🔴 P5.6 P1-6 — 태그(검색 키워드). 넘기지 않으면 칸을 그리지 «않는다»
   *  (기존 호출부 호환 — onSetModelNameReference 와 같은 규약). */
  onUpdateKeywords?: (raw: string) => void;
  /**
   * ══ 🔴 P5.6 P1-5(CPO ①, 2026-10-09) — **옵션의 주인은 상품정보다.** ══════
   *
   * CEO 실측: 「옵션은 들어오지만 개별 Commerce 탭에서 보인다」. 맞았다 —
   * 상품정보에는 축 «이름» 한 줄(`product.options`, deprecated)만 있었고,
   * 실제 구조(옵션그룹 × 값 · 단품별 SKU/재고/가격)는 세 채널 탭에만 있었다.
   * 그래서 셀러는 같은 공통 데이터를 채널 탭 세 곳에서 고쳤다.
   *
   * 🔴 새 편집기를 만들지 않는다 — 채널 탭이 쓰던 `OptionVariantEditor` «그
   *    컴포넌트» 를 그대로 옮긴다. 쓰는 setter(onUpdateVariant)도 같은 함수다.
   *    두 벌을 만들면 둘이 다르게 답하는 순간이 곧 오등록이다.
   * 🔴 이 자리는 가격이 이미 쓰는 어휘를 따른다(PHASE 3.2): 「정하는 곳은
   *    상품정보 하나이고, 채널 화면은 그 값을 그대로 쓴다」.
   * 🔴 넘기지 않으면 표를 그리지 «않는다» — 기존 호출부 호환.
   */
  /**
   * 🔴 P5.6 P0-1(CPO) — 판매자 기본 재고. 넘기지 않으면 칸을 그리지 «않는다»
   * (기존 호출부 호환). `undefined` 를 넘기면 그 값을 «지운다» — 0 이 아니다.
   */
  onUpdateSellerDefaultStock?: (value: number | undefined) => void;
  onUpdateVariant?: (
    variantId: string,
    patch: Partial<{ sku: string; stockQuantity: number; price: { amount: number; currency: string } | undefined }>,
  ) => void;
  /**
   * 🔴 P5.6 재작업(CEO 실측) — 「상세설명 자동 작성」 버튼이 여기로 왔다.
   * CommerceWorkspace 의 `generateDescriptionOnly` «그 함수» 다 — 새 생성기를
   * 만들지 않았고, mockProductContentProvider.generateDescription 하나만 쓴다
   * (description-autowrite-ux05 가 그 계약을 이미 고정해 뒀다).
   * 넘기지 않으면 버튼을 그리지 않는다(기존 호출부 호환).
   */
  onGenerateDescription?: () => void;
  /** DELTA-B — CommerceWorkspace.setFieldReference("modelName", …) 그대로다.
   * 새 상태 전이를 만들지 않는다(채널 탭의 참조 버튼과 **같은 함수**를 부른다).
   * 넘기지 않으면 라디오 없이 직접 입력칸만 그린다(기존 호출부 호환). */
  onSetModelNameReference?: (referenced: boolean) => void;
  exchangeRates?: { rates: Record<string, number> } | null;
}) {
  const krw = convertToKrw(product.price.value.amount, product.price.value.currency, exchangeRates?.rates);
  return (
    // UX 2.2(CEO 지시, 2026-09-11) — 이 편집기는 이제 자기 카드 껍데기를 갖지
    // 않는다. 두 자리에서 쓰이는데(③ 등록 준비의 펼친 작업면 / 그 외 단계의
    // "Source Data ▾" 접힘 섹션) 둘 다 이미 제목과 테두리를 갖고 있어서,
    // 여기서 또 두르면 카드 안에 같은 제목의 카드가 겹쳐 보인다.
    <div className="text-sm">
      <p className="text-xs text-text-secondary">
        원본 사이트에서 추출한 상품 정보입니다. 값을 직접 수정할 수 있으며, 수정한 필드는
        &ldquo;수정됨&rdquo;으로 표시됩니다.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary">
              {/* DELTA-B — 라벨이 길어졌다("네이버 쇼핑 카탈로그 모델명").
                  w-24(6rem)에서는 네 줄로 쪼개져 읽히지 않는다. */}
              <th className="w-40 py-2 pr-2 font-medium">필드</th>
              <th className="py-2 pr-2 font-medium">값</th>
              <th className="w-28 py-2 pr-2 font-medium">출처</th>
              <th className="w-20 py-2 pr-2 font-medium">신뢰도</th>
              <th className="w-20 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            <Row label="상품명" field={product.title}>
              <EditableText value={product.title.value} onCommit={(v) => onUpdateField("title", v)} />
            </Row>
            <Row label="브랜드" field={product.brand}>
              <EditableText
                value={product.brand.value}
                onCommit={(v) => onUpdateField("brand", v)}
                placeholder="브랜드 미확인"
              />
            </Row>
            <Row label="가격" field={product.price}>
              <div className="flex items-center gap-2">
                <EditableText
                  value={Number(product.price.value.amount).toFixed(2)}
                  onCommit={(v) => onUpdatePrice(Number(v) || 0, product.price.value.currency)}
                  className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                />
                <EditableText
                  value={product.price.value.currency}
                  onCommit={(v) => onUpdatePrice(product.price.value.amount, v.toUpperCase())}
                  placeholder="통화"
                  className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                />
                {product.priceValidity !== "VALID" ? (
                  // N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지
                  // 말고") — 원본 가격을 못 읽은 상태에서 "≈ ₩0"을 보여주면
                  // 진짜 0원 상품처럼 보인다(이 화면이 바로 그 혼란의
                  // 진원지였다: Source Data 가격=0.00인데 아래 가격 계산은
                  // 배송비만으로 다른 숫자를 만들어냈다). 계산값 대신 경고를
                  // 보여준다.
                  <span className="text-xs font-medium text-warning">
                    ⚠️ 원본 가격을 확인할 수 없습니다 — 위에서 직접 입력하면 자동으로 계산이 시작됩니다.
                  </span>
                ) : (
                  product.price.value.currency.toUpperCase() !== "KRW" && (
                    /* UX 2.3(CEO 지시, 2026-09-11) — "≈ ₩99,928"에서 "≈"만
                       빼고 라벨을 붙인다. 앞의 £55와 뒤의 ₩99,928은 같은 가격의
                       다른 표기가 아니라 *원본 판매자 가격*과 *우리가 환율로 만든
                       환산값*이다. ≈로 이으면 "한국에서도 그 값"으로 읽힌다. */
                    <span className="text-xs text-text-tertiary">
                      원화 환산 {formatKrw(krw.amountKrw)}
                      {krw.isEstimate ? " (추정 환율)" : " (실시간 환율)"} — 배송비/마진 포함 계산은
                      플랫폼 탭의 &ldquo;가격&rdquo; 섹션에서
                    </span>
                  )
                )}
              </div>
            </Row>
            <Row label="SKU" field={product.sku}>
              <EditableText
                value={product.sku.value}
                onCommit={(v) => onUpdateField("sku", v)}
                placeholder="SKU 없음"
              />
              {/* DELTA-B(CEO 지시, 2026-09-15) — SKU와 아래 카탈로그 모델명이
                  **완전히 분리되게** 각 줄이 자기 도착지를 달고 있는다. 이 두
                  줄은 나란히 서 있고 값도 둘 다 영문+숫자라, 도착지를 적어
                  두지 않으면 셀러는 계속 같은 값으로 읽는다. */}
              <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
                └─ 판매자 상품관리번호 — 판매처 자신의 재고번호입니다.
              </p>
            </Row>
            {/* REWORK-8 ①(CEO 지시, 2026-09-15) — **빠져 있던 입력 자리를 만든다.**

                신고된 상태: 상품명 정상 · 상품코드(SKU) AAA1804916 · 모델명 비어
                있음 · 화면은 "네이버 쇼핑 카탈로그 모델명이 없습니다"라고 하는데
                **모델명을 칠 칸이 없다.**

                실측한 근본 원인은 문구가 아니라 자리다. 이 화면(상품정보)에서
                모델명에 도달하는 길은 「불러오지 못한 항목」 패널의 체크박스
                하나뿐이었고, 그 체크박스가 하는 일은 «상세페이지 참조»로 바꾸는
                것이다 — 그것은 고시정보 모델명만 채우고 카탈로그 모델명
                (naverShoppingSearchInfo.modelName)은 끝내 비운다(REWORK-6에서
                확정). 즉 상품정보에서 셀러가 할 수 있는 유일한 동작이 **막다른
                길을 만드는 동작**이었다.

                🔴 SKU를 복사하지 않는다. 바로 위 칸이 SKU이고 값도 있지만, 그 둘은
                payload에서 서로 다른 자리로 나간다(sku → sellerManagementCode,
                모델명 → naverShoppingSearchInfo.modelName). 그 판정은 REWORK-7 ③
                에서 확정됐고 rework6-modelname-chain.test.ts가 못으로 박아 뒀다.

                새 편집 패턴을 만들지 않는다 — 위 SKU/소재와 같은 Row + EditableText
                이고, 같은 onUpdateField를 탄다(USER_EDITED가 되고 build-payload가
                그 값만 카탈로그로 보낸다). */}
            <Row label={CATALOG_MODEL_NAME_LABEL} field={product.modelName}>
              <ModelNameField
                field={product.modelName}
                onCommit={(v) => onUpdateField("modelName", v)}
                onSetReference={onSetModelNameReference}
              />
            </Row>
            {/* ══ 🔴 P5.6 재작업(CEO 실측, 2026-10-09) — **옵션 칸을 여기서 «지웠다».** ══

                CEO: 「상품정보 탭에 옵션 항목이 2개가 보임」. 맞았다 — 이 줄과
                아래 옵션 블록이 둘 다 옵션을 말하고 있었다.

                지운 쪽이 «이 줄» 인 이유: 이 칸은 `product.options`(deprecated)
                이고 축 «이름» 문자열 목록뿐이다. 실제 등록 payload 를 만드는
                것은 `optionGroups`·`variants` 이고(세 채널 빌더가 그 둘만 읽는다),
                이 칸을 고치면 «등록에 쓰이지 않는 값» 만 바뀐다. 즉 고칠 수
                있지만 아무 효과가 없는 칸이었다 — 지우는 것이 맞다.
                🔴 onUpdateOptions prop 도 함께 지웠다(받아 놓고 안 쓰는 prop 금지). */}
            {/* 🔴 P5.6 P1-6(CEO 실측, 2026-10-09) — 태그가 화면에 «없었다».
                채우는 유일한 경로가 disabled 인 「AI 콘텐츠」 탭이라 셀러가
                보지도 고치지도 못했고, 쿠팡 검색태그에는 옵션 축 이름이 갔다.
                🔴 새 편집 패턴을 만들지 않는다 — 바로 위 「옵션」과 같은
                   Row + EditableText 이고 쉼표로 나눈다. */}
            {onUpdateKeywords ? (
              <Row label="태그(검색 키워드)" field={product.keywords}>
                <EditableText
                  value={product.keywords.value.join(", ")}
                  onCommit={onUpdateKeywords}
                  placeholder="태그 없음 (쉼표로 구분 · 예: 수입원피스, 아동)"
                />
              </Row>
            ) : null}
            <Row label="소재" field={product.material}>
              <EditableText
                value={product.material.value}
                onCommit={(v) => onUpdateField("material", v)}
                placeholder="소재 미확인"
              />
            </Row>
            {/* ══ 🔴 P5.6 재작업(CEO 실측, 2026-10-09) — **상세설명은 여기 한 곳이다.** ══

                CEO: 「source data · 필수정보 두 곳에 상세설명이 존재한다.
                Source Data 에 있는 것이 맞고 필수정보 쪽은 제거. 자동 작성도
                Source Data 로 옮기고 글 수정도 되어야 한다」.

                ── 🔴 이 칸이 어느 값을 고치는가 ─────────────────────────────
                세 채널이 실제로 받는 글은 `descriptionKo || description` 이다
                (marketplace/content-field.ts:13 — 세 어댑터가 모두 이 함수를 쓴다).
                그래서 이 칸은 «등록될 글»(descriptionKo)을 고친다.

                🔴 전에 이 칸은 `description`(원문)을 고쳤다. 그러면 자동 작성을
                   한 번이라도 누른 뒤에는 고쳐도 등록값이 한 글자도 바뀌지 않고
                   원문만 조용히 덮였다 — 「고쳤는데 그대로」의 원인이다.
                🔴 원문은 «지우지 않고» 바로 아래 접힘으로 남긴다. 자동 작성의
                   재료이고 출처이기 때문이다. 단 편집칸은 아니다 — 두 개의
                   편집칸이 「상세설명」을 말하는 상태로 되돌리지 않는다. */}
            <Row label="상세설명" field={product.descriptionKo}>
              <div className="space-y-1.5">
                <EditableTextarea
                  value={product.descriptionKo.value}
                  onCommit={(v) => onUpdateField("descriptionKo", v)}
                  placeholder="상세설명 없음 — [상세설명 자동 작성]을 누르거나 직접 적어 주세요."
                />
                <div className="flex flex-wrap items-center gap-2">
                  {onGenerateDescription ? (
                    <button
                      type="button"
                      onClick={onGenerateDescription}
                      className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white"
                    >
                      상세설명 자동 작성
                    </button>
                  ) : null}
                  <span className="text-[11px] text-text-tertiary">
                    브랜드 · 상품 종류 · 색상 · 소재 · 옵션 · 원문을 모아 한국어로 조립합니다 — 만든 뒤 바로 고칠 수
                    있습니다.
                  </span>
                </div>
                {product.description.value.trim() ? (
                  <details className="rounded-md border border-dashed border-border px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] text-text-tertiary">
                      원본 상세설명 보기 (수집값 · 등록에는 쓰이지 않습니다)
                    </summary>
                    <p className="mt-1.5 whitespace-pre-line text-[11px] text-text-secondary">
                      {product.description.value}
                    </p>
                  </details>
                ) : null}
              </div>
            </Row>
            <tr className="border-b border-border align-top">
              <td className="py-2 pr-2 text-text-secondary">이미지</td>
              <td className="py-2 pr-2" colSpan={4}>
                {product.images.length === 0
                  ? "이미지 없음"
                  : `${product.images.length}장 (대표 ${product.images.filter((i) => i.isRepresentative).length}장 포함)`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* ══ 🔴 P5.6 P1-5(CPO ①, 2026-10-09) — **옵션의 실제 구조는 여기 있다.** ══

          위 「옵션」 칸은 축 «이름» 한 줄(`product.options`, deprecated)이다.
          그것만으로는 셀러가 「사이즈가 몇 개 들어왔는지」도 「단품별 재고가
          얼마인지」도 모른다 — 그 정보가 세 채널 탭에만 있었던 것이 CEO 가 본
          결함이다.

          🔴 표 «안» 에 넣지 않는다. 위 표는 5열(이름/값/출처/확신도/배지) 격자고,
             옵션 그룹과 단품 표는 열 수가 다르다. 끼워 넣으면 격자가 깨진다. */}
      {product.optionGroups.length > 0 || product.variants.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium text-text-primary">
            옵션 <span className="font-normal text-text-tertiary">— 모든 Commerce 가 이 값을 그대로 씁니다</span>
          </p>
          {/* ══ 🔴 P5.6 재작업(CEO 실측) — **「재고 수집이 안 되는 것 같다」에 답한다.** ══

              CEO 가 본 것이 맞다. 다만 원인은 이 화면이 아니라 «원본 사이트» 다 —
              실측으로 경로마다 갈린다:

                Shopify            inventory_management 가 켜져 있을 때만 수량이 온다
                                   (shopify-product-json.ts:504 — 꺼져 있으면 숫자를
                                    신뢰할 수 없어 «일부러» 비운다)
                PrestaShop         수량이 유한한 숫자일 때만 (prestashop:334)
                JSON-LD            OutOfStock → 0 만. InStock 은 «수량을 모른다»
                                   (product-data-extractor.ts:372)
                Smallable          사이즈만 있고 수량이 페이지에 «없다»
                                   (smallable-size-options.ts:90)

              🔴 그래서 빈 칸을 0 이나 999 로 채우지 않는다. 「비어 있다」와
                 「0개」는 다른 사실이고, 0 으로 채우면 팔 수 있는 상품이 품절로
                 등록된다. 대신 «왜 비었는지» 를 화면이 말한다. */}
          {/* ══ 🔴 P5.6 P0-1(CPO, 2026-10-09) — **판매자가 정하는 기본 재고.** ══

              CPO: 「source UNKNOWN → 판매자가 입력한 기본재고 적용 · 기본재고가
              source 의 실제 수량을 덮지 않음 · 999/0 임의 생성 금지」.

              Smallable 실측: 사이즈만 주고 수량을 한 칸도 주지 않는다. 그 상품은
              옵션 전부가 「재고 모름」이고 payload 에서 빠져 — 팔 수 있는 상품인데
              등록이 안 됐다. 그래서 판매자가 한 번 정하면 그 값을 쓴다.

              🔴 추정값이 아니다 — 판매자가 여기서 직접 적은 수다. 저장 자리도
                 `stockQuantity`(원본 재고, 모르면 999)와 «따로» 둔다
                 (`sellerDefaultStock`). 한 칸에 담으면 「판매자가 정한 10」과
                 「파이프라인이 모른다는 999」가 구별되지 않는다.
              🔴 실측을 덮지 않는다. 적용 대상은 재고를 «모르는» 옵션뿐이다.
              🔴 커머스 탭에 옵션 UI 를 되살리는 것이 아니다 — 여기 상품정보 한 곳이다. */}
          {onUpdateSellerDefaultStock && variantsWithUnknownStock(product).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-warning/40 bg-background px-2.5 py-2">
              <span className="text-[11px] text-text-secondary">
                재고를 모르는 옵션 {variantsWithUnknownStock(product).length}개 — 기본 재고수량
              </span>
              <EditableText
                value={product.sellerDefaultStock != null ? String(product.sellerDefaultStock) : ""}
                onCommit={(v) => {
                  const n = Number(v.trim());
                  /* 🔴 빈 값이면 «지운다» — 0 으로 바꾸지 않는다(0 은 품절 주장이다). */
                  onUpdateSellerDefaultStock(v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n);
                }}
                placeholder="예: 10"
                className="w-20 rounded border border-border px-1.5 py-1 text-xs"
              />
              <span className="text-[11px] text-text-tertiary">
                개 — 이 값은 «모르는 옵션에만» 적용됩니다. 비워 두면 그 옵션은 등록에서 제외됩니다.
              </span>
            </div>
          )}
          {product.variants.length > 0 && product.variants.every((v) => v.stockQuantity == null) && (
            <p className="rounded-md border border-dashed border-border bg-background px-2.5 py-2 text-[11px] text-text-secondary">
              원본 사이트가 옵션별 재고 수량을 공개하지 않습니다 — 빈 칸은 「0개」가 아니라 「모름」입니다.
              비워 두면 등록 시 상품 재고로 채워집니다. 직접 알고 있으면 아래에 적어 주세요.
            </p>
          )}
          {product.optionGroups.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {product.optionGroups.map((group) => (
                <div key={group.name} className="rounded-md border border-border p-2.5">
                  <p className="text-xs font-medium text-text-secondary">
                    {group.name} <span className="text-text-tertiary">({group.values.length}개)</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.values.map((v) => (
                      <span key={v} className="rounded-full bg-background px-2 py-0.5 text-xs text-text-primary">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 🔴 baseProduct 를 «넘기지 않는다» — 「가격차이·최종판매가」 두 열은
              배송비·수수료·마진이 들어간 채널 최종가 기준이고, 그 값은 채널
              가격 섹션이 가진다. 여기서 환산가(convertToKrw)로 대신 계산하면
              같은 열이 화면마다 다른 숫자를 말한다(OptionVariantEditor 가 바로
              그것을 금지한다). 그래서 이 표는 «원본 SKU·재고·옵션가» 만 받는다. */}
          {onUpdateVariant && <OptionVariantEditor variants={product.variants} onUpdateVariant={onUpdateVariant} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * DELTA-B(CEO 지시, 2026-09-15) — 「네이버 쇼핑 카탈로그 모델명」 한 칸.
 *
 * REWORK-8이 만든 것은 **칸**이었고 이름은 그대로 "모델명"이었다. CEO 판정:
 * "무슨 모델을 말하는 거지?" — 라벨은 위(Row)에서 ②의 이름으로 바꿨고, 여기는
 * 두 가지를 더 말한다.
 *
 * 1. 이 칸이 무엇인가 — SmartStore 카탈로그 식별용이라고 **먼저** 말한다.
 *    (기존 문구는 "…에는 쓸 수 없습니다"로 시작해서 문제부터 설명했다 —
 *     CEO 지적: 너무 뒤에서 설명한다.)
 * 2. «상세페이지 참조»가 정확히 무엇을 가져오는가 — 「고시정보의 모델명」이다.
 *    그래서 선택지 이름이 "상세페이지에서 찾기"이고, 그 아래 한 줄이 무엇을
 *    가져오는지 적는다. 고르기 **전에** 읽힌다.
 *
 * 🔴 상태 전이를 새로 만들지 않는다 — onSetReference는 CommerceWorkspace의
 * setFieldReference("modelName", …)이고, 채널 탭의 참조 버튼과 같은 함수다.
 */
function ModelNameField({
  field,
  onCommit,
  onSetReference,
}: {
  field: { value: string; source: FieldSource };
  onCommit: (v: string) => void;
  onSetReference?: (referenced: boolean) => void;
}) {
  const isReferenced = field.source === "DETAIL_PAGE_REFERENCE";
  return (
    <div className="space-y-1">
      {onSetReference ? (
        <>
          {/* 🔴 입력칸을 <label> 안에 넣지 않는다 — label은 자기 안의 첫
              컨트롤(라디오)로 클릭을 넘기므로, 입력칸을 감싸면 값을 치려고
              누른 클릭이 라디오로 가서 포커스를 빼앗는다. */}
          <div className="flex items-center gap-2 text-sm">
            <label className="flex shrink-0 items-center gap-2">
              <input
                type="radio"
                name="catalog-model-name-mode"
                checked={!isReferenced}
                onChange={() => onSetReference(false)}
              />
              <span className="text-text-secondary">직접 입력</span>
            </label>
            <EditableText
              value={field.value}
              onCommit={onCommit}
              placeholder="예: B226AC043"
              className="w-40 rounded border border-border px-2 py-0.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="catalog-model-name-mode"
              checked={isReferenced}
              onChange={() => onSetReference(true)}
              className="mt-1"
            />
            <span>
              <span className="text-text-secondary">상세페이지에서 찾기</span>
              <span className="block text-[11px] leading-relaxed text-text-tertiary">
                상세페이지의 고시정보 모델명을 사용합니다.
              </span>
            </span>
          </label>
        </>
      ) : (
        <EditableText value={field.value} onCommit={onCommit} placeholder="예: B226AC043" />
      )}

      {/* REWORK-11 ⑤(CEO 지시, 2026-09-15: "설명으로 화면을 채우지 마라") —
          화면에 남는 것은 **이 칸이 무엇인가** 한 줄. SKU와 어떻게 다른지,
          참조가 정확히 무엇을 가져오는지는 ⓘ로 접힌다(글자는 그대로 남는다). */}
      <p className="text-[11px] text-text-tertiary">
        └─ 네이버 카탈로그 식별용 모델명
        {/* REWORK-12 ⑤(CEO 판정, 2026-09-15) — 77자 → 40자. "무엇인지"만 남긴다. */}
        <InfoTip text="네이버 쇼핑 카탈로그가 상품을 식별하는 모델명입니다. 위 SKU와는 다른 값입니다." />
      </p>

      {isReferenced && (
        <p className="text-[11px] text-warning">
          ⚠ 「{CATALOG_MODEL_NAME_LABEL}」은 비어 있는 채로 남습니다
          <InfoTip
            /* REWORK-12 ⑤ — 108자 → 41자. 남는 것은 "무엇인지" 한 줄. */
            text={`“상세페이지 참조”는 고시정보 모델명만 채웁니다. 「${CATALOG_MODEL_NAME_LABEL}」은 직접 입력해야 합니다.`}
          />
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  field,
  children,
}: {
  label: string;
  field: { source: FieldSource; confidence: number };
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-border align-top">
      <td className="py-2 pr-2 text-text-secondary">{label}</td>
      <td className="py-2 pr-2">{children}</td>
      <td className="py-2 pr-2 text-xs text-text-secondary">{extractionSourceLabel(field)}</td>
      <td className="py-2 pr-2 text-xs text-text-secondary">
        {field.source === "USER_EDITED" ? "—" : `${Math.round(field.confidence * 100)}%`}
      </td>
      <td className="py-2">
        <ProvenanceBadge source={field.source} />
      </td>
    </tr>
  );
}
