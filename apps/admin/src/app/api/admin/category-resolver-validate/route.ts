import { universalExtract } from "@commerce/crawler";
import {
  GOLDEN_DATASET,
  buildResolverBiasedQuery,
  resolveProductSignals,
  type GoldenBucket,
  type GoldenDatasetItem,
  type ProductSignals,
} from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";
import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../../coupang/_lib/env";
import { callCoupangApi } from "../../coupang/_lib/client";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sprint A-2.6(Resolver Accuracy Validation) — CPO 작업지시: "Category Resolver
 * 2.0이 실제 운영 데이터에서 얼마나 정확한지 수치로 입증한다." Golden Dataset(80개)를
 * 하나씩 돌려서 Resolver 판단(연령대/상품유형)이 사람이 미리 지정한 정답과
 * 맞는지 채점하고, 카테고리별 정확도와 실패 원인을 리포트로 낸다.
 *
 * 중요(안전 범위): 이 라우트는 실제 쿠팡 등록을 절대 하지 않는다. "Registered"
 * 컬럼 대신 predict API가 실제로 등록 가능한 코드를 돌려줬는지(predictCode != null)
 * 만 확인한다 — 80개 상품을 판매자 계정에 실제로 등록하는 건 되돌리기 어려운
 * 외부 시스템 변경이라 사용자 승인 없이는 하지 않는다.
 */

interface ValidationResult {
  url: string;
  bucket: GoldenBucket;
  expectedLabel: string;
  note: string;
  status: "pass" | "fail" | "error";
  resolved: {
    ageGroup: string;
    gender: string;
    productType: string | null;
    evidence: string[];
  } | null;
  predict: { categoryCode: number | null; categoryName: string | null } | null;
  failureReasons: string[];
  error?: string;
}

interface BucketSummary {
  bucket: GoldenBucket;
  total: number;
  pass: number;
  accuracy: number;
}

function toResolverInput(
  url: string,
  productData: {
    title?: string;
    description?: string;
    brand?: string;
    breadcrumbPath?: string[];
    jsonLdCategory?: string;
    shopifyTags?: string;
    shopifyProductType?: string;
  },
): Pick<
  CanonicalProduct,
  | "title"
  | "description"
  | "brand"
  | "recommendedAge"
  | "breadcrumbPath"
  | "jsonLdCategory"
  | "sourceUrl"
  | "shopifyTags"
  | "shopifyProductType"
> {
  return {
    title: { value: productData.title ?? "", source: "ORIGINAL", confidence: 0 },
    description: { value: productData.description ?? "", source: "ORIGINAL", confidence: 0 },
    brand: { value: productData.brand ?? "", source: "ORIGINAL", confidence: 0 },
    // Golden Dataset의 정답은 Shopify tags/product_type/breadcrumb 신호로만
    // 판정했다 — recommendedAge(설명문 "6-12 months" 같은 표기)는 이번 데이터셋
    // 상품들에 없어 항상 빈 값으로 둔다(지어내지 않는다).
    recommendedAge: { value: "", source: "REQUIRED", confidence: 0 },
    breadcrumbPath: productData.breadcrumbPath,
    jsonLdCategory: productData.jsonLdCategory,
    shopifyTags: productData.shopifyTags,
    shopifyProductType: productData.shopifyProductType,
    sourceUrl: url,
  };
}

/** kids 계열(baby/kids/teen)인지 판정 — CPO의 "Kids ≥ 95%" 기준 채점에 쓴다. */
function isKidsAgeGroup(ageGroup: string): boolean {
  return ageGroup === "baby" || ageGroup === "kids" || ageGroup === "teen";
}

function scoreItem(
  item: GoldenDatasetItem,
  signals: ProductSignals,
): { pass: boolean; failureReasons: string[] } {
  const failureReasons: string[] = [];

  if (item.expectedAgeGroup) {
    const kidsDetected = isKidsAgeGroup(signals.ageGroup);
    if (item.expectedAgeGroup === "kids" && !kidsDetected) {
      failureReasons.push(
        signals.evidence.length === 0 ? "Age Signal Missing" : "Age Signal Conflict(성인으로 오판)",
      );
    }
    if (item.expectedAgeGroup === "adult" && kidsDetected) {
      failureReasons.push("Age Signal Conflict(아동으로 오판)");
    }
  }

  if (item.expectedProductType) {
    if (signals.productType == null) {
      failureReasons.push("Keyword Missing(상품유형 키워드 매칭 실패)");
    } else if (signals.productType !== item.expectedProductType) {
      failureReasons.push(`Keyword Conflict(${signals.productType}로 오판)`);
    }
  }

  return { pass: failureReasons.length === 0, failureReasons };
}

async function validateOne(
  item: GoldenDatasetItem,
  credentials: Awaited<ReturnType<typeof getCoupangCredentials>>,
): Promise<ValidationResult> {
  try {
    const { productData } = await universalExtract(item.url);
    const resolverInput = toResolverInput(item.url, productData);
    const signals = resolveProductSignals(resolverInput);
    const { pass, failureReasons } = scoreItem(item, signals);

    let predict: ValidationResult["predict"] = null;
    if (credentials) {
      const baseQuery = productData.title ?? item.url;
      const biasedQuery = buildResolverBiasedQuery(signals, baseQuery, false);
      try {
        const response = await callCoupangApi(credentials, {
          method: "POST",
          path: "/v2/providers/openapi/apis/api/v1/categorization/predict",
          body: { productName: biasedQuery, brand: productData.brand },
        });
        const body = response.body as {
          data?: { predictedCategoryId?: string; predictedCategoryName?: string };
        };
        const predictedId = body.data?.predictedCategoryId ? Number(body.data.predictedCategoryId) : null;
        predict = {
          categoryCode: Number.isFinite(predictedId) ? predictedId : null,
          categoryName: body.data?.predictedCategoryName ?? null,
        };
      } catch {
        predict = { categoryCode: null, categoryName: null };
      }
    }

    return {
      url: item.url,
      bucket: item.bucket,
      expectedLabel: item.expectedLabel,
      note: item.note,
      status: pass ? "pass" : "fail",
      resolved: {
        ageGroup: signals.ageGroup,
        gender: signals.gender,
        productType: signals.productType,
        evidence: signals.evidence.map((e) => e.label),
      },
      predict,
      failureReasons,
    };
  } catch (error) {
    return {
      url: item.url,
      bucket: item.bucket,
      expectedLabel: item.expectedLabel,
      note: item.note,
      status: "error",
      resolved: null,
      predict: null,
      failureReasons: ["Crawl Failed"],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** 80개를 동시에 다 쏘면 도메인별 레이트리밋/Vercel maxDuration에 걸릴 수 있어
 * 일정 개수씩 묶어서 처리한다 — 골든 데이터셋은 전부 Shopify fast-path라
 * Playwright 없이 JSON fetch만 하므로 배치당 몇 초면 끝난다. */
async function validateBatch(
  items: GoldenDatasetItem[],
  credentials: Awaited<ReturnType<typeof getCoupangCredentials>>,
  concurrency: number,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item) => validateOne(item, credentials)));
    results.push(...chunkResults);
  }
  return results;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { buckets?: GoldenBucket[] };
  const items = body.buckets?.length
    ? GOLDEN_DATASET.filter((item) => body.buckets!.includes(item.bucket))
    : GOLDEN_DATASET;

  const credentials = await getCoupangCredentials();
  const results = await validateBatch(items, credentials, 10);

  const bucketOrder: GoldenBucket[] = [
    "kids",
    "adult",
    "shoes",
    "bag",
    "hat",
    "toy",
    "home",
    "beauty",
  ];
  const summary: BucketSummary[] = bucketOrder
    .map((bucket) => {
      const bucketResults = results.filter((r) => r.bucket === bucket);
      if (bucketResults.length === 0) return null;
      const passCount = bucketResults.filter((r) => r.status === "pass").length;
      return {
        bucket,
        total: bucketResults.length,
        pass: passCount,
        accuracy: Math.round((passCount / bucketResults.length) * 1000) / 10,
      };
    })
    .filter((s): s is BucketSummary => s !== null);

  const totalPass = results.filter((r) => r.status === "pass").length;
  const overallAccuracy =
    results.length > 0 ? Math.round((totalPass / results.length) * 1000) / 10 : 0;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    coupangConfigured: credentials != null,
    overallAccuracy,
    summary,
    results,
    failures: results.filter((r) => r.status !== "pass"),
  });
}
