import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 쿠팡 카테고리 추천(자동매칭) API 위임 — CartPilot 내부 카테고리 후보는 쿠팡의
 * 실제 숫자 displayCategoryCode와 다른 체계이므로, 등록 직전 이 API로 실제 코드를
 * 받아와야 한다.
 *
 * 주의(정직하게 표시): 이 엔드포인트의 요청/응답 필드는 공식 문서로 확인했지만
 * (POST /v2/providers/openapi/apis/api/v1/categorization/predict), 실제 인증
 * 정보가 없는 이번 세션에서는 실제 호출로 응답 형태까지 검증하지 못했다 —
 * unverified: true를 항상 함께 내려보내고, UI는 이 값을 "참고용, 최종 확인
 * 필요"로 표시해야 한다.
 */
const CATEGORY_PREDICT_PATH = "/v2/providers/openapi/apis/api/v1/categorization/predict";

interface CategoryPredictResponse {
  code?: number;
  message?: string;
  data?: {
    autoCategorizationPredictionResultType?: string;
    comment?: string;
    predictedCategoryId?: string;
    predictedCategoryName?: string;
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { productName?: string; brand?: string } | null;
  if (!body?.productName) {
    return NextResponse.json({ error: "productName이 필요합니다." }, { status: 400 });
  }

  const credentials = getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", status: "NOT_CONFIGURED" },
      { status: 200 },
    );
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "POST",
      path: CATEGORY_PREDICT_PATH,
      body: { productName: body.productName, brand: body.brand },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "쿠팡 카테고리 추천 요청이 실패했습니다.", status: response.status, body: response.body },
        { status: 200 },
      );
    }

    const parsed = response.body as CategoryPredictResponse;
    const predictedId = parsed.data?.predictedCategoryId ? Number(parsed.data.predictedCategoryId) : null;

    return NextResponse.json({
      categoryCode: Number.isFinite(predictedId) ? predictedId : null,
      categoryName: parsed.data?.predictedCategoryName ?? null,
      comment: parsed.data?.comment ?? null,
      /** 이 API의 실제 응답 형태는 인증 정보가 없어 실호출로 검증하지 못했다 —
       * 항상 true. UI는 반드시 "참고용, 등록 전 확인 필요"로 표시해야 한다. */
      unverified: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
        status: "NETWORK_ERROR",
      },
      { status: 200 },
    );
  }
}
