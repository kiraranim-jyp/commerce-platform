import { NextResponse } from "next/server";
import { universalExtract } from "@commerce/crawler";
import {
  GOLDEN_DATASET,
  buildResolverBiasedQuery,
  resolveProductSignals,
  type GoldenBucket,
  type GoldenDatasetItem,
} from "@commerce/category";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";
import { coupangAdapter } from "@commerce/marketplace";
import { buildComplianceReport, buildCoupangPayload, resolveVerifiedCategoryCode } from "@commerce/listing";
import { buildCanonicalProduct } from "../../pipeline/canonical-product";
import { getCoupangCredentials, getVendorUserId } from "../../coupang/_lib/env";
import { getDefaultDescriptionTemplate } from "../../coupang/_lib/description-template";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";
import { fetchShippingPlaces, inferSourceCountry, selectOutboundShippingPlace } from "../../coupang/_lib/shipping-place";
import { fetchCategoryMeta } from "../../coupang/_lib/category-meta";
import { resolveBrand } from "../../coupang/_lib/brand";
import { resolveCategoryV3 } from "../../coupang/_lib/category-resolver-v3";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sprint A-4(작업4 — 실제 등록 QA) — CPO 지시: "최소 30개의 실제 상품으로 등록
 * QA를 수행한다... 카테고리별 분산, 성공/실패 원인 기록." Golden Dataset(80개,
 * Sprint A-2.6에서 이미 카테고리 정확도 100%를 확인한 셋)에서 CPO가 요구한 7개
 * 그룹(의류/신발/가방/모자/장난감/홈/뷰티, kids+adult를 "의류"로 묶음)에 맞춰
 * 30개를 뽑아 register/route.ts와 완전히 같은 조립 로직(Payload Preview 라우트가
 * 재사용하는 것과 같은 경로)으로 실제 Compliance Report를 계산한다.
 *
 * 안전 범위(Sprint A-2.6과 같은 원칙) — 30개 상품을 판매자 계정에 실제로
 * LIVE 등록하지 않는다. callCoupangApi(등록 제출)는 절대 호출하지 않고,
 * register/route.ts가 실제 제출 직전까지 계산하는 것과 완전히 같은 Payload/
 * Compliance Report만 계산한다 — 30건의 되돌리기 힘든 실제 등록은 사용자 승인
 * 없이 진행하지 않는다는 판단이다.
 */

interface BatchItemResult {
  url: string;
  bucket: GoldenBucket;
  group: string;
  status: "success" | "compliance_fail" | "error";
  categoryCode: number | null;
  categoryName: string | null;
  complianceScore: number | null;
  verdict: "PASS" | "WARNING" | "FAIL" | null;
  approvalReadiness: "High" | "Medium" | "Low" | null;
  /** Sprint A-4(작업5 재보정, CPO 피드백) — 73점의 원인이 Attribute Mapper
   * 문제인지(자동완성 낮음) 원래 사람만 채울 수 있는 항목 때문인지(법적필수
   * 낮음)를 배치 리포트에서도 바로 구분할 수 있게 한다. */
  breakdown: { autoFillRate: number; legalRequiredRate: number } | null;
  /** Sprint A-5(Category Resolver 3.0) — 이 카테고리가 AUTO_SELECT(유사도
   * 95%+)/RECOMMEND(정상이지만 자동선택 기준 미달)/REJECT(명백히 다른
   * 도메인) 중 무엇이었는지. null이면 아직 이 필드를 계산하기 전 단계에서
   * 에러가 났다는 뜻. */
  resolverDecision?: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
  unmapped: { fieldName: string; reasonCode: string }[];
  /** Sprint A-7(작업3 — Attribute Coverage KPI) — 이 상품의 필수 필드 총
   * 개수와 자동으로 채워진 개수. Readiness/Compliance 점수(플레이스홀더에도
   * 절반 크레딧을 주는 부드러운 점수)와 다르게, Coverage는 "실제로 값이
   * 있었는가"만 본다(unmapped.length = totalFields - autoResolvedCount). */
  totalFields: number | null;
  autoResolvedCount: number | null;
  error?: string;
}

const BUCKET_GROUP: Record<GoldenBucket, string> = {
  kids: "의류",
  adult: "의류",
  shoes: "신발",
  bag: "가방",
  hat: "모자",
  toy: "장난감",
  home: "홈",
  beauty: "뷰티",
};

/** 8개 버킷 × 10개 중 카테고리별로 나눠서 30개를 뽑는다(kids/adult/shoes/bag/hat/toy
 * 각 4개 + home/beauty 각 3개 = 30). Golden Dataset은 이미 Sprint A-2.6에서 200
 * 응답을 확인한 URL이라 크롤링 실패 위험이 낮다 — 이번 QA는 크롤링이 아니라
 * Attribute Mapper/Compliance 계산 자체를 검증하는 게 목적이다. */
function pickBatch(): GoldenDatasetItem[] {
  const counts: Record<GoldenBucket, number> = {
    kids: 4,
    adult: 4,
    shoes: 4,
    bag: 4,
    hat: 4,
    toy: 4,
    home: 3,
    beauty: 3,
  };
  const picked: GoldenDatasetItem[] = [];
  (Object.keys(counts) as GoldenBucket[]).forEach((bucket) => {
    const items = GOLDEN_DATASET.filter((item) => item.bucket === bucket).slice(0, counts[bucket]);
    picked.push(...items);
  });
  return picked;
}

async function runOne(
  item: GoldenDatasetItem,
  credentials: NonNullable<Awaited<ReturnType<typeof getCoupangCredentials>>>,
  vendorUserId: string,
  sellerProfile: NonNullable<Awaited<ReturnType<typeof getDefaultSellerProfile>>>,
  descriptionTemplate: Awaited<ReturnType<typeof getDefaultDescriptionTemplate>>,
): Promise<BatchItemResult> {
  const base: Pick<BatchItemResult, "url" | "bucket" | "group"> = {
    url: item.url,
    bucket: item.bucket,
    group: BUCKET_GROUP[item.bucket],
  };
  try {
    const { productData, productDataSources } = await universalExtract(item.url);

    const signals = resolveProductSignals({
      title: { value: productData.title ?? "", source: "ORIGINAL", confidence: 0 },
      description: { value: productData.description ?? "", source: "ORIGINAL", confidence: 0 },
      brand: { value: productData.brand ?? "", source: "ORIGINAL", confidence: 0 },
      recommendedAge: { value: "", source: "REQUIRED", confidence: 0 },
      breadcrumbPath: productData.breadcrumbPath,
      jsonLdCategory: productData.jsonLdCategory,
      shopifyTags: productData.shopifyTags,
      shopifyProductType: productData.shopifyProductType,
      sourceUrl: item.url,
    });

    // Sprint A-5(Category Resolver 3.0) — 이전엔 predict API 결과를 검증 없이
    // 그대로 받아들였다(이 배치의 이전 실행에서 파라슈트홈 베갯잇이 "원두
    // 커피믹스"로 잘못 예측됐는데도 "성공"으로 집계된 사고 발견). 이제
    // resolveCategoryV3가 여러 질의 변형 + 상품유형 대조 채점을 거쳐 REJECT
    // 여부까지 판정한 뒤에만 후보로 채택한다.
    const biasedQuery = buildResolverBiasedQuery(signals, productData.title ?? item.url, false);
    const resolverResult = await resolveCategoryV3(credentials, biasedQuery, signals, productData.brand);

    if (resolverResult.decision === "REJECT" || !resolverResult.best) {
      return {
        ...base,
        status: "error",
        categoryCode: null,
        categoryName: null,
        complianceScore: null,
        verdict: null,
        approvalReadiness: null,
        breakdown: null,
        resolverDecision: resolverResult.decision,
        totalFields: null,
        autoResolvedCount: null,
        unmapped: [],
        error: resolverResult.best
          ? `카테고리 Resolver 3.0이 예측을 거부했습니다: "${resolverResult.best.categoryName}" — ${resolverResult.best.reason}`
          : "카테고리 예측 실패(Predict API가 유효한 후보를 하나도 반환하지 않음)",
      };
    }

    const candidate: CategoryCandidate = {
      id: String(resolverResult.best.categoryCode),
      name: resolverResult.best.categoryName,
      path: [resolverResult.best.categoryName],
      platform: "coupang",
      confidence: resolverResult.best.score / 100,
      reason: [`Coupang categorization/predict (Resolver 3.0 유사도 ${resolverResult.best.score}%)`],
      source: "ai",
      isVerifiedPlatformCode: true,
    };
    const categorySelection: CategorySelection = { state: "SELECTED", candidate, provenance: "INFERRED" };

    const product = buildCanonicalProduct(item.url, productData, productDataSources, []);
    const listing = coupangAdapter.toListingModel(product, categorySelection);

    const categoryCode = resolveVerifiedCategoryCode(listing.category);
    const categoryMeta = categoryCode != null ? await fetchCategoryMeta(credentials, categoryCode) : null;
    const resolvedBrand = listing.brand ? await resolveBrand(credentials, listing.brand) : null;

    let outboundShippingPlaceCode = sellerProfile.outboundShippingPlaceCode;
    const shippingPlaces = await fetchShippingPlaces(credentials);
    const sourceCountry = inferSourceCountry(product.sourceUrl);
    const selectedPlace = selectOutboundShippingPlace(sourceCountry, shippingPlaces.options);
    if (selectedPlace?.code != null) outboundShippingPlaceCode = selectedPlace.code;

    const payload = buildCoupangPayload(product, listing, {
      sellerConfig: {
        vendorId: credentials.vendorId,
        vendorUserId,
        deliveryCompanyCode: sellerProfile.deliveryCompanyCode,
        returnCenterCode: sellerProfile.returnCenterCode,
        returnChargeName: sellerProfile.returnChargeName,
        companyContactNumber: sellerProfile.companyContactNumber,
        returnZipCode: sellerProfile.returnZipCode,
        returnAddress: sellerProfile.returnAddress,
        returnAddressDetail: sellerProfile.returnAddressDetail,
        outboundShippingPlaceCode,
        deliveryCharge: sellerProfile.deliveryCharge,
        returnDeliveryCharge: sellerProfile.returnDeliveryCharge,
        outboundLeadTimeDays: sellerProfile.outboundLeadTimeDays,
        manufacturer: sellerProfile.manufacturer,
        asContactNumber: sellerProfile.asContactNumber,
        qualityGuarantee: sellerProfile.qualityGuarantee,
      },
      descriptionTemplate: descriptionTemplate ?? undefined,
      categoryMeta,
      resolvedBrand,
    });

    const attributeResults = payload.complianceFieldResults.filter((r) => r.kind === "ATTRIBUTE");
    const noticeResults = payload.complianceFieldResults.filter((r) => r.kind === "NOTICE");
    const complianceReport = buildComplianceReport(attributeResults, noticeResults);

    return {
      ...base,
      status: complianceReport.verdict === "FAIL" ? "compliance_fail" : "success",
      categoryCode,
      categoryName: candidate.name,
      complianceScore: complianceReport.score,
      verdict: complianceReport.verdict,
      approvalReadiness: complianceReport.approvalReadiness,
      resolverDecision: resolverResult.decision,
      breakdown: {
        autoFillRate: complianceReport.breakdown.autoFillRate,
        legalRequiredRate: complianceReport.breakdown.legalRequiredRate,
      },
      totalFields: complianceReport.autoResolvedCount + complianceReport.userRequiredCount,
      autoResolvedCount: complianceReport.autoResolvedCount,
      unmapped: complianceReport.userInputNeeded.map((f) => ({ fieldName: f.fieldName, reasonCode: f.reasonCode })),
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      categoryCode: null,
      categoryName: null,
      complianceScore: null,
      verdict: null,
      approvalReadiness: null,
      breakdown: null,
      totalFields: null,
      autoResolvedCount: null,
      unmapped: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "쿠팡 인증 정보가 설정되어 있지 않습니다." }, { status: 400 });
  }
  const sellerProfile = await getDefaultSellerProfile();
  if (!sellerProfile) {
    return NextResponse.json({ error: "배송 프로필이 없습니다." }, { status: 400 });
  }
  const vendorUserId = await getVendorUserId();
  const descriptionTemplate = await getDefaultDescriptionTemplate();

  const batch = pickBatch();
  const results: BatchItemResult[] = [];
  // Golden Dataset 검증 라우트와 같은 이유(도메인별 레이트리밋/Vercel maxDuration)로
  // 소규모 동시성으로 순차 배치 처리한다.
  const concurrency = 5;
  for (let i = 0; i < batch.length; i += concurrency) {
    const chunk = batch.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((item) => runOne(item, credentials, vendorUserId, sellerProfile, descriptionTemplate)),
    );
    results.push(...chunkResults);
  }

  const groups = ["의류", "신발", "가방", "모자", "장난감", "홈", "뷰티"];
  const groupSummary = groups.map((group) => {
    const groupResults = results.filter((r) => r.group === group);
    const scored = groupResults.filter((r) => r.complianceScore != null);
    const avgScore =
      scored.length > 0 ? Math.round(scored.reduce((sum, r) => sum + (r.complianceScore ?? 0), 0) / scored.length) : null;
    return {
      group,
      total: groupResults.length,
      success: groupResults.filter((r) => r.status === "success").length,
      complianceFail: groupResults.filter((r) => r.status === "compliance_fail").length,
      error: groupResults.filter((r) => r.status === "error").length,
      avgComplianceScore: avgScore,
    };
  });

  const reasonCounts: Record<string, number> = {};
  results.forEach((r) => r.unmapped.forEach((u) => {
    reasonCounts[u.reasonCode] = (reasonCounts[u.reasonCode] ?? 0) + 1;
  }));

  // Sprint A-7(작업1 — Blocking Field Analyzer) — CPO 요구사항: "실제 데이터
  // 기준으로 어떤 필드가 등록을 가장 많이 막는지" 추측이 아니라 이번 배치
  // results[].unmapped를 그대로 집계한다("색상 31건, 소재 26건..." 포맷).
  // fieldName 그대로 집계하므로 컴플라이언스 리포트가 쓰는 라벨과 항상 같다
  // (여기서 별도 이름 매핑 테이블을 만들지 않는다 — CP001 중복 판정 방지 원칙).
  const blockingFieldTally: Record<string, number> = {};
  results.forEach((r) => r.unmapped.forEach((u) => {
    blockingFieldTally[u.fieldName] = (blockingFieldTally[u.fieldName] ?? 0) + 1;
  }));
  const blockingFieldCounts = Object.entries(blockingFieldTally)
    .map(([fieldName, count]) => ({ fieldName, count }))
    .sort((a, b) => b.count - a.count);

  const scored = results.filter((r) => r.complianceScore != null);
  const overallAvgScore =
    scored.length > 0 ? Math.round(scored.reduce((sum, r) => sum + (r.complianceScore ?? 0), 0) / scored.length) : null;

  const rejectedByResolver = results.filter((r) => r.resolverDecision === "REJECT").length;

  // Sprint A-7(작업3 — Attribute Coverage KPI) — Readiness/Compliance 점수는
  // PLACEHOLDER에도 절반 크레딧을 주는 부드러운 점수라 CPO가 별도로 요청한
  // "실제로 값이 있었는가"만 보는 이진 커버리지. totalFields/autoResolvedCount가
  // null인 항목(REJECT/에러로 여기까지 못 온 상품)은 합산에서 제외한다.
  const coverageItems = results.filter(
    (r): r is BatchItemResult & { totalFields: number; autoResolvedCount: number } =>
      r.totalFields != null && r.autoResolvedCount != null,
  );
  const coverageTotalFields = coverageItems.reduce((sum, r) => sum + r.totalFields, 0);
  const coverageAutoResolved = coverageItems.reduce((sum, r) => sum + r.autoResolvedCount, 0);
  const coveragePercent =
    coverageTotalFields > 0 ? Math.round((coverageAutoResolved / coverageTotalFields) * 1000) / 10 : null;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totalItems: results.length,
    overallAvgComplianceScore: overallAvgScore,
    successCount: results.filter((r) => r.status === "success").length,
    complianceFailCount: results.filter((r) => r.status === "compliance_fail").length,
    errorCount: results.filter((r) => r.status === "error").length,
    // Sprint A-5(Category Resolver 3.0) — 이 배치를 재실행했을 때 Resolver
    // 3.0이 predict 결과를 몇 건이나 거부했는지(작업4 Reject Rate와 같은 값,
    // 배치 규모 기준). 0이면 이번 30개 표본에서는 명백한 오분류가 재현되지
    // 않았다는 뜻이지, Resolver 3.0이 항상 통과시킨다는 뜻이 아니다.
    rejectedByResolverCount: rejectedByResolver,
    groupSummary,
    unmappedReasonCounts: reasonCounts,
    // Sprint A-7(작업1) — Top-N 정렬된 배열, 프론트/리포트가 그대로 잘라 쓴다.
    blockingFieldCounts,
    // Sprint A-7(작업3) — "필수 Attribute 총 N, 자동 추출 M, Coverage X%" 포맷.
    coverageKPI: {
      totalFields: coverageTotalFields,
      autoResolvedCount: coverageAutoResolved,
      coveragePercent,
    },
    results,
  });
}
