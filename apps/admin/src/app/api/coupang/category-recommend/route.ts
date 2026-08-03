import { NextResponse } from "next/server";
import type { ProductSignals } from "@commerce/category";
import { getCoupangCredentials } from "../_lib/env";
import { resolveCategoryV3 } from "../_lib/category-resolver-v3";

/**
 * 쿠팡 카테고리 추천(자동매칭) API 위임 — CartPilot 내부 카테고리 후보는 쿠팡의
 * 실제 숫자 displayCategoryCode와 다른 체계이므로, 등록 직전 이 API로 실제 코드를
 * 받아와야 한다.
 *
 * Sprint A-5(Category Resolver 3.0) — CPO 지시: "Predict API를 그대로 믿지
 * 않는다." 예전엔 predict API 결과를 검증 없이 그대로 돌려줬다(실측 사고:
 * 파라슈트홈 베갯잇이 "원두커피믹스"로 예측됨). 이제 resolveCategoryV3(여러
 * 질의 변형 + 상품유형 대조 채점)를 거쳐 AUTO_SELECT/RECOMMEND/REJECT 판정과
 * Top5 후보를 함께 돌려준다. productName/brand만으로는 상품유형을 알 수 없어
 * signals(클라이언트가 이미 resolveProductSignals로 계산해둔 값)를 함께
 * 받는다 — 판단 기준(product-resolver.ts의 productType)을 서버에서 다시
 * 추측하지 않고 그대로 넘겨받는다.
 *
 * 주의(정직하게 표시): 이 엔드포인트가 위임하는 predict API의 실제 응답
 * 형태는 실호출로 검증했지만(Sprint A-4 30개 QA 배치), 쿠팡이 이 스코어링
 * 기준에 맞는 카테고리 이름을 항상 준다는 보장은 없다 — unverified: true를
 * 항상 함께 내려보내고, UI는 이 값을 "참고용, 최종 확인 필요"로 표시해야 한다.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    productName?: string;
    brand?: string;
    signals?: ProductSignals;
    /** A-12.3-P0-3(CPO 2차 지시 — "Predict/Search/Rule/Parent Category를
     * 합쳐서 추천") — CommerceWorkspace가 이미 클라이언트에서 계산해 둔
     * 규칙 기반(rule-based.provider.ts) 카테고리 이름들. 서버가 판단을
     * 다시 하지 않고 그대로 받아 predict 질의 변형으로 재사용한다. */
    ruleBasedNames?: string[];
  } | null;
  if (!body?.productName) {
    return NextResponse.json({ error: "productName이 필요합니다." }, { status: 400 });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", status: "NOT_CONFIGURED" },
      { status: 200 },
    );
  }

  const signals: ProductSignals = body.signals ?? {
    ageGroup: "unknown",
    gender: "unknown",
    productType: null,
    evidence: [],
  };

  try {
    const result = await resolveCategoryV3(credentials, body.productName, signals, body.brand, body.ruleBasedNames);

    return NextResponse.json({
      // 하위 호환 — 기존 클라이언트가 categoryCode/categoryName만 읽어도 계속
      // 동작하게 최상위 필드도 함께 채운다(값은 decision이 REJECT가 아닐 때만).
      categoryCode: result.decision !== "REJECT" ? (result.best?.categoryCode ?? null) : null,
      categoryName: result.decision !== "REJECT" ? (result.best?.categoryName ?? null) : null,
      decision: result.decision,
      best: result.best,
      candidates: result.candidates,
      /** 이 API가 위임하는 predict API 응답을 실제 정답으로 100% 검증할
       * 방법은 없다 — 항상 true. UI는 반드시 "참고용, 등록 전 확인 필요"로
       * 표시해야 한다. */
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
