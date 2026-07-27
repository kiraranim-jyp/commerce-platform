import type { CoupangSellerConfig } from "@commerce/listing";

/**
 * 쿠팡 API 키/시크릿/판매자 계정 설정은 전부 서버 전용 환경변수로만 읽는다 —
 * 이 파일은 "use client" 컴포넌트에서 import되면 안 된다(app/api/ 라우트 핸들러
 * 전용). 프론트엔드/localStorage/상품 데이터/Git 어디에도 값을 저장하지 않는다.
 */
export interface CoupangCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

export function getCoupangCredentials(): CoupangCredentials | null {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  const vendorId = process.env.COUPANG_VENDOR_ID;
  if (!accessKey || !secretKey || !vendorId) return null;
  return { accessKey, secretKey, vendorId };
}

/**
 * 인증 키(access/secret)와 달리 이 값들은 "비밀"이 아니라 쿠팡 Wing에 이미
 * 등록되어 있는 판매자 계정 설정(반품지/발송지/배송사 코드 등)이다. 그래도
 * 서버 전용 환경변수로만 읽는다 — 프론트엔드가 몰라도 되는 값이고, 잘못
 * 노출되면 반품/배송 정보가 바뀔 수 있다.
 */
export function getCoupangSellerConfig(vendorId: string): CoupangSellerConfig {
  return {
    vendorId,
    vendorUserId: process.env.COUPANG_VENDOR_USER_ID ?? "",
    deliveryCompanyCode: process.env.COUPANG_DELIVERY_COMPANY_CODE ?? "",
    returnCenterCode: process.env.COUPANG_RETURN_CENTER_CODE ?? "",
    returnChargeName: process.env.COUPANG_RETURN_CHARGE_NAME ?? "",
    companyContactNumber: process.env.COUPANG_COMPANY_CONTACT_NUMBER ?? "",
    returnZipCode: process.env.COUPANG_RETURN_ZIP_CODE ?? "",
    returnAddress: process.env.COUPANG_RETURN_ADDRESS ?? "",
    returnAddressDetail: process.env.COUPANG_RETURN_ADDRESS_DETAIL ?? "",
    outboundShippingPlaceCode: process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE
      ? Number(process.env.COUPANG_OUTBOUND_SHIPPING_PLACE_CODE)
      : null,
  };
}
