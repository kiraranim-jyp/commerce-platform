"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { formatKrw } from "@commerce/pricing";

/**
 * Sprint N-2.7/N-2.8 — 네이버 v2 상품등록 payload를 실제 POST 없이 미리 보여준다.
 * N-2.6에서 만든 buildNaverProductPayload/validateNaverPayload를 그대로 쓴다
 * (payload를 다시 만들지 않는다 — 화면에 보이는 값과 Raw Payload가 어긋나면
 * CP001과 같은 신뢰 문제가 재발한다).
 *
 * N-2.8 — 카테고리 자동 매칭 Resolver는 별도 Sprint(N-2.9)로 분리됐다(CPO
 * 지시 — 학습데이터 없이 만들면 Coupang 초기처럼 오분류 위험이 크다). 그래서
 * leafCategoryId는 QA가 실제 Naver 카테고리 ID를 알고 있을 때 직접 입력하는
 * "다리" 역할만 한다 — 값을 입력하면 /api/naver/resolve가 실제 카테고리
 * detail(exceptionalCategories/certificationInfos)과 판매자 주소록을
 * 실시간으로 조회해서 고시/인증/배송 상태를 채운다. 값이 없으면(대부분의
 * 실제 상품) 여전히 MISSING/BLOCKED로 정직하게 남는다.
 */

interface NaverResolveResponse {
  status: string;
  category: {
    categoryId: string;
    exceptionalCategories: string[];
    requiresChildCertification: boolean;
    childCertificationInfoId: number | null;
  } | null;
  address: { releaseAddressBookNo: number | null; refundAddressBookNo: number | null };
  courier: { available: boolean; reason: string };
}

const FIELD_SECTION: Record<string, string> = {
  "originProduct.leafCategoryId": "naver-section-category",
  "originProduct.name": "naver-section-basic",
  "originProduct.images.representativeImage": "naver-section-images",
  "originProduct.salePrice": "naver-section-pricing",
  "originProduct.stockQuantity": "naver-section-pricing",
  "deliveryInfo.outboundLocationId": "naver-section-shipping",
  "claimDeliveryInfo.returnAddressId": "naver-section-shipping",
  "deliveryInfo (address mapping)": "naver-section-shipping",
  "deliveryInfo.deliveryCompany": "naver-section-shipping",
  productCertificationInfos: "naver-section-certification",
  "productCertificationInfos[].certificationNumber": "naver-section-certification",
  "detailAttribute.optionInfo": "naver-section-options",
};

/** validateNaverPayload가 실제로 검사하는 필드 수 — READY 카운트는
 * "전체 - 문제있는 항목"으로 역산한다(검증 로직을 이 컴포넌트에서 다시 만들지
 * 않는다). 옵션/인증서처럼 상품마다 있고 없고가 달라지는 항목만 조건부로 센다. */
function countTotalCheckedFields(hasOptions: boolean, requiresCertification: boolean, hasCertificationId: boolean) {
  // leafCategoryId, name, image, price, stock, outboundLocationId, returnAddressId,
  // address-mapping, deliveryCompany, originAreaCode(N-2.8 추가)
  const BASE = 10;
  let total = BASE;
  if (hasOptions) total += 1;
  if (requiresCertification) total += hasCertificationId ? 2 : 1;
  return total;
}

function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

export function NaverPayloadPreview({ product, listing }: { product: CanonicalProduct; listing: ListingModel }) {
  const [showJson, setShowJson] = useState(false);
  const [categoryIdInput, setCategoryIdInput] = useState("");
  const [resolved, setResolved] = useState<NaverResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // N-2.8 — 카테고리 ID는 수동 입력(자동 매칭은 N-2.9), 나머지는 실시간 조회.
  // 500ms 디바운스로 입력 중 매 키 입력마다 호출하지 않는다.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setResolving(true);
      setResolveError(null);
      const query = categoryIdInput.trim() ? `?categoryId=${encodeURIComponent(categoryIdInput.trim())}` : "";
      fetch(`/api/naver/resolve${query}`)
        .then((res) => res.json())
        .then((data: NaverResolveResponse) => {
          if (cancelled) return;
          if (data.status !== "OK") {
            setResolveError(
              data.status === "NOT_CONFIGURED"
                ? "네이버 인증 정보가 설정되어 있지 않습니다."
                : "네이버 API 조회에 실패했습니다.",
            );
            setResolved(null);
            return;
          }
          setResolved(data);
        })
        .catch(() => {
          if (!cancelled) setResolveError("리졸버 호출 중 오류가 발생했습니다.");
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [categoryIdInput]);

  const leafCategoryId = categoryIdInput.trim();
  const releaseAddressBookNo = resolved?.address.releaseAddressBookNo ?? null;
  const refundAddressBookNo = resolved?.address.refundAddressBookNo ?? null;
  const childCertificationInfoId = resolved?.category?.childCertificationInfoId ?? null;
  const categoryRequiresChildCertification = resolved?.category?.requiresChildCertification ?? false;

  const payload = useMemo(
    () =>
      buildNaverProductPayload({
        product,
        listing,
        leafCategoryId,
        releaseAddressBookNo,
        refundAddressBookNo,
        childCertificationInfoId,
        categoryRequiresChildCertification,
      }),
    [
      product,
      listing,
      leafCategoryId,
      releaseAddressBookNo,
      refundAddressBookNo,
      childCertificationInfoId,
      categoryRequiresChildCertification,
    ],
  );

  const validation = useMemo(
    () =>
      validateNaverPayload(
        payload,
        { product, releaseAddressBookNo, refundAddressBookNo, childCertificationInfoId },
        categoryRequiresChildCertification,
      ),
    [payload, product, releaseAddressBookNo, refundAddressBookNo, childCertificationInfoId, categoryRequiresChildCertification],
  );

  const hasOptions = product.optionGroups.length > 0;
  const totalChecked = countTotalCheckedFields(
    hasOptions,
    categoryRequiresChildCertification,
    childCertificationInfoId !== null,
  );
  const missingCount = validation.issues.filter((i) => i.severity === "MISSING").length;
  const blockedCount = validation.issues.filter((i) => i.severity === "BLOCKED").length;
  const readyCount = Math.max(0, totalChecked - missingCount - blockedCount);

  const overallState = blockedCount > 0 || missingCount > 0 ? "등록 불가" : "등록 가능";
  const overallIcon = blockedCount > 0 ? "🔴" : missingCount > 0 ? "🟡" : "🟢";

  const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
  const representative = payload.originProduct.images.representativeImage.url;
  const optionalImages = payload.originProduct.images.optionalImages ?? [];

  function goToSection(field: string) {
    const sectionId = FIELD_SECTION[field];
    if (!sectionId) return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">네이버 상품등록 미리보기</h3>
        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
          Preview 전용 — 실제 등록 API는 호출하지 않습니다
        </span>
      </div>

      {/* Validation Summary */}
      <div className="rounded-md bg-background p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-success">🟢 READY {readyCount}</span>
          <span className="text-warning">🟡 MISSING {missingCount}</span>
          <span className="text-error">🔴 BLOCKED {blockedCount}</span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-text-primary">
          현재 상태: {overallIcon} {overallState}
        </p>
        {validation.issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {validation.issues.map((issue, i) => (
              <li key={`${issue.field}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                <span className={issue.severity === "BLOCKED" ? "text-error" : "text-warning"}>
                  {issue.severity === "BLOCKED" ? "🔴" : "🟡"}
                </span>
                <button
                  type="button"
                  onClick={() => goToSection(issue.field)}
                  className="min-w-0 flex-1 text-left text-text-secondary hover:text-text-primary hover:underline"
                >
                  <span className="font-medium text-text-primary">{issue.field}</span> — {issue.reason}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Section id="naver-section-basic" title="기본 상품정보">
        <Row label="상품명" value={payload.originProduct.name || "MISSING"} />
        <Row label="판매가격" value={formatKrw(payload.originProduct.salePrice)} />
        <Row label="재고" value={`${payload.originProduct.stockQuantity}개`} />
        <Row label="판매상태" value={payload.originProduct.statusType} />
      </Section>

      <Section id="naver-section-category" title="카테고리">
        <div>
          <label className="text-xs text-text-secondary" htmlFor="naver-category-id-input">
            네이버 카테고리 ID(수동 입력 — 자동 매칭은 N-2.9에서 별도 구현)
          </label>
          <input
            id="naver-category-id-input"
            type="text"
            value={categoryIdInput}
            onChange={(e) => setCategoryIdInput(e.target.value)}
            placeholder="예: 50000535"
            className="mt-0.5 w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {resolving && <p className="text-[11px] text-text-tertiary">네이버 카테고리 조회 중...</p>}
        {resolveError && <p className="text-[11px] text-error">{resolveError}</p>}
        <Row label="네이버 카테고리" value={leafCategoryId || "미확정 — 위 입력란에 실제 카테고리 ID를 입력하세요"} />
        {resolved?.category && (
          <Row
            label="어린이제품 인증"
            value={resolved.category.requiresChildCertification ? "필요(CHILD_CERTIFICATION)" : "불필요"}
          />
        )}
      </Section>

      <Section id="naver-section-images" title="이미지">
        <div className="flex flex-wrap gap-2">
          {representative && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={representative} alt="대표" className="h-14 w-14 rounded border-2 border-primary object-cover" />
          )}
          {optionalImages.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img.url} alt="" className="h-14 w-14 rounded border border-border object-cover" />
          ))}
          {!representative && <p className="text-xs text-text-tertiary">MISSING — 대표 이미지 없음</p>}
        </div>
      </Section>

      <Section id="naver-section-options" title="옵션">
        {hasOptions ? (
          <>
            {product.variants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-tertiary">
                      {Object.keys(product.variants[0].optionValues).map((k) => (
                        <th key={k} className="pb-1 pr-3 font-medium">
                          {k}
                        </th>
                      ))}
                      <th className="pb-1 pr-3 font-medium">가격</th>
                      <th className="pb-1 font-medium">재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        {Object.values(v.optionValues).map((val, i) => (
                          <td key={i} className="py-1 pr-3 text-text-primary">
                            {val}
                          </td>
                        ))}
                        <td className="py-1 pr-3 text-text-primary">
                          {v.price ? formatKrw(v.price.amount) : "—"}
                        </td>
                        <td className="py-1 text-text-primary">{v.stockQuantity ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">옵션 그룹은 있으나 조합(variant) 정보가 없습니다.</p>
            )}
            <p className="rounded bg-error-soft px-2 py-1 text-[11px] text-error">
              🔴 BLOCKED — optionCombinations 필드명은 확인됐지만(GitHub #241) price/id 필드의 정확한 의미는
              실제 등록 성공 검증 전까지 확인되지 않았습니다(N-2.8).
            </p>
          </>
        ) : (
          <p className="text-xs text-text-tertiary">옵션 없음</p>
        )}
      </Section>

      <Section id="naver-section-notice" title="상품정보제공고시">
        {notice ? (
          <>
            <Row label="상품군" value={notice.productInfoProvidedNoticeType} />
            <Row label="재질" value={notice.material || "MISSING"} />
            <Row label="색상" value={notice.color || "MISSING"} />
            <Row label="제조자" value={notice.manufacturer || "MISSING"} />
            <Row label="주의사항" value={notice.caution || "MISSING"} />
            {notice.productInfoProvidedNoticeType === "KIDS" && (
              <Row label="권장연령" value={notice.recommendedAge || "MISSING"} />
            )}
          </>
        ) : (
          <p className="text-xs text-text-tertiary">고시정보 없음</p>
        )}
      </Section>

      <Section id="naver-section-certification" title="인증정보">
        {categoryRequiresChildCertification ? (
          <>
            <p className="text-xs font-medium text-warning">⚠ 어린이제품 인증 필요</p>
            <Row label="인증종류" value="CHILD_CERTIFICATION" />
            <Row label="인증번호" value="MISSING" />
            <Row label="인증기관" value="MISSING" />
            <Row label="인증일자" value="MISSING" />
          </>
        ) : resolved?.category ? (
          <p className="text-xs text-text-tertiary">이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION) 대상이 아닙니다.</p>
        ) : (
          <p className="text-xs text-text-tertiary">
            카테고리 미입력 — 위 카테고리 섹션에서 실제 Naver 카테고리 ID를 입력하면 인증요건을 실시간으로 조회합니다.
          </p>
        )}
      </Section>

      <Section id="naver-section-shipping" title="배송 / 반품">
        <Row
          label="출고지"
          value={releaseAddressBookNo !== null ? `addressBookNo: ${releaseAddressBookNo}` : "MISSING"}
        />
        <Row
          label="반품/교환지"
          value={refundAddressBookNo !== null ? `addressBookNo: ${refundAddressBookNo}` : "MISSING"}
        />
        <Row label="택배사" value={`BLOCKED — ${resolved?.courier.reason ?? "택배사 코드 조회 API 미확인(N-2.5)"}`} />
        <Row
          label="배송비"
          value={`${payload.originProduct.deliveryInfo?.deliveryFee?.deliveryFeeType === "FREE" ? "무료배송" : "미확정"} (기본값 — 실제 배송비 정책 미연동)`}
        />
        <Row label="반품배송비" value="BLOCKED/MISSING — 미확정" />
        <Row label="교환배송비" value="BLOCKED/MISSING — 미확정" />
        <p className="text-[11px] text-text-tertiary">
          출고지/반품지는 판매자 주소록(GET /v1/seller/addressbooks-for-page)에서 실시간 조회됩니다. 다만
          addressBookNo → outboundLocationId/shippingAddressId/returnAddressId 매핑 자체는 실제 등록 성공으로
          검증된 적이 없습니다(N-2.6).
        </p>
      </Section>

      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        className="text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
      >
        {showJson ? "Naver v2 Request Payload 닫기" : "▶ Naver v2 Request Payload"}
      </button>
      {showJson && (
        <pre className="max-h-96 overflow-auto rounded-md bg-background p-2 text-[11px] text-text-secondary">
          {JSON.stringify(payload, payloadReplacer, 2)}
        </pre>
      )}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 rounded-md border border-border p-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{title}</h4>
      <dl className="mt-2 space-y-1">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isProblem = value === "MISSING" || value.startsWith("BLOCKED") || value === "미확정";
  return (
    <div className="flex items-start gap-2 text-xs">
      <dt className="w-20 shrink-0 text-text-secondary">{label}</dt>
      <dd className={isProblem ? "text-warning" : "text-text-primary"}>{value}</dd>
    </div>
  );
}
