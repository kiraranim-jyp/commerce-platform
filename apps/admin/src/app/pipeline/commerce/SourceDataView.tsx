"use client";

import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { convertToKrw, formatKrw } from "@commerce/pricing";
import { EditableText, EditableTextarea } from "./EditableField";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

/**
 * Sprint A-9(작업4 — CEO 지시: "현재 원본 가격만 가져옵니다. 원하는 것은
 * 원본통화 → 실시간 환율 → KRW 자동 계산") — 실제 환율 변환 로직(PriceEditor,
 * /api/exchange-rates)은 이미 있었지만, 분석 직후 가장 먼저 보이는 이 화면
 * (source 탭)에는 원본 통화만 보이고 KRW 환산이 전혀 없었다. "가격" 아코디언을
 * 열어야만(쿠팡 탭 안) 환산값이 보였다 — 대표님이 본 화면은 여기였을 가능성이
 * 높다. 같은 계산 로직(convertToKrw)을 재사용해 라이트하게 옆에 붙인다.
 */
export function SourceDataView({
  product,
  onUpdateField,
  onUpdatePrice,
  onUpdateOptions,
  exchangeRates,
}: {
  product: CanonicalProduct;
  onUpdateField: (
    /* REWORK-8 ①(CEO 지시, 2026-09-15) — "modelName"이 새로 들어왔다. 이 union은
       CommerceWorkspace.updateField()의 키 집합의 부분집합이고(그쪽에 이미
       "modelName"이 있다), 넓히는 것 말고 새 배선을 만들지 않았다. */
    key: "title" | "brand" | "sku" | "description" | "material" | "modelName",
    value: string,
  ) => void;
  onUpdatePrice: (amount: number, currency: string) => void;
  onUpdateOptions: (raw: string) => void;
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
              <th className="w-24 py-2 pr-2 font-medium">필드</th>
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
            <Row label="모델명" field={product.modelName}>
              <EditableText
                value={product.modelName.value}
                onCommit={(v) => onUpdateField("modelName", v)}
                placeholder="모델명 미확인 (예: B226AC043)"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
                위 SKU와 다른 값입니다 — SKU는 판매처 자신의 재고번호이고, 모델명은 네이버 쇼핑
                카탈로그 검색·연결에 쓰이는 값입니다.
              </p>
              {product.modelName.source === "DETAIL_PAGE_REFERENCE" && (
                <p className="mt-1 rounded border border-warning/40 bg-warning-soft px-2 py-1 text-[11px] leading-relaxed text-warning">
                  ⚠ 지금은 &ldquo;상세페이지 참조&rdquo;로 표시돼 있습니다 — 고시정보 모델명만 대체되고
                  「네이버 쇼핑 카탈로그 모델명」은 비어 있습니다. 위 칸에 직접 입력하면 두 자리가 모두
                  채워집니다.
                </p>
              )}
            </Row>
            <Row label="옵션" field={product.options}>
              <EditableText
                value={product.options.value.join(", ")}
                onCommit={onUpdateOptions}
                placeholder="옵션 없음 (쉼표로 구분)"
              />
            </Row>
            <Row label="소재" field={product.material}>
              <EditableText
                value={product.material.value}
                onCommit={(v) => onUpdateField("material", v)}
                placeholder="소재 미확인"
              />
            </Row>
            <Row label="상세설명" field={product.description}>
              <EditableTextarea
                value={product.description.value}
                onCommit={(v) => onUpdateField("description", v)}
                placeholder="상세설명 없음"
              />
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
