import { NextResponse } from "next/server";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";

/**
 * Sprint N-2.8 — NaverPayloadPreview에 필요한 실제 read-only 데이터를 한 번에
 * 모아준다(카테고리 상세 + 주소록). 카테고리 매칭 Resolver는 N-2.9로 분리됐다
 * (CPO 지시 — 학습데이터 없이 만들면 오분류 위험) — 그래서 categoryId는 이
 * 라우트의 입력값이지 이 라우트가 만들어내는 값이 아니다(Preview에서 QA가
 * 실제 Naver 카테고리 ID를 알고 있을 때만 수동으로 입력한다).
 *
 * 택배사 코드는 N-2.5에서 전용 조회 API 3곳이 모두 404였던 걸 재확인만 하고
 * 새로 호출하지 않는다 — courier.available은 항상 false로 고정된 값이다.
 */

interface NaverCertificationInfo {
  id: number;
  kindTypes?: string[];
}

interface NaverCategoryDetail {
  exceptionalCategories?: string[];
  certificationInfos?: NaverCertificationInfo[];
}

interface NaverAddressBookEntry {
  addressBookNo: number;
  addressType?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json(
      { status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." },
      { status: 200 },
    );
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json(
      { status: "AUTH_FAILED", message: tokenResult.message, debug: { step: tokenResult.step } },
      { status: 200 },
    );
  }
  const accessToken = tokenResult.accessToken;

  let category: {
    categoryId: string;
    exceptionalCategories: string[];
    requiresChildCertification: boolean;
    childCertificationInfoId: number | null;
  } | null = null;

  if (categoryId) {
    const detailResult = await callNaverApi(accessToken, { method: "GET", path: `/v1/categories/${categoryId}` });
    if (detailResult.ok && detailResult.status === 200) {
      const detail = detailResult.body as NaverCategoryDetail;
      const exceptionalCategories = detail.exceptionalCategories ?? [];
      const requiresChildCertification = exceptionalCategories.includes("CHILD_CERTIFICATION");
      const childCert = (detail.certificationInfos ?? []).find((c) => c.kindTypes?.includes("CHILD_CERTIFICATION"));
      category = {
        categoryId,
        exceptionalCategories,
        requiresChildCertification,
        childCertificationInfoId: childCert?.id ?? null,
      };
    }
  }

  let releaseAddressBookNo: number | null = null;
  let refundAddressBookNo: number | null = null;
  const addressResult = await callNaverApi(accessToken, { method: "GET", path: "/v1/seller/addressbooks-for-page?page=1" });
  if (addressResult.ok && addressResult.status === 200) {
    const body = addressResult.body as { addressBooks?: NaverAddressBookEntry[] };
    const addressBooks = body.addressBooks ?? [];
    releaseAddressBookNo = addressBooks.find((a) => a.addressType === "RELEASE")?.addressBookNo ?? null;
    refundAddressBookNo = addressBooks.find((a) => a.addressType === "REFUND_OR_EXCHANGE")?.addressBookNo ?? null;
  }

  return NextResponse.json({
    status: "OK",
    category,
    address: { releaseAddressBookNo, refundAddressBookNo },
    // N-2.5에서 확인 — 전용 조회 API가 없어 항상 미확인 상태다(추측 코드 금지).
    courier: { available: false, reason: "택배사 코드 조회 API를 찾지 못했습니다(N-2.5 확인).", },
  });
}
