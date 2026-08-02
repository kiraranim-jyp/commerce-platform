import { getCoupangCredentials, getVendorUserId } from "./env";
import { getDefaultSellerProfile, type SellerProfile } from "./seller-profile";

const REQUIRED_PROFILE_FIELDS: { key: keyof SellerProfile; label: string }[] = [
  { key: "deliveryCompanyCode", label: "택배사" },
  { key: "returnCenterCode", label: "반품지" },
  { key: "returnChargeName", label: "반품지명" },
  { key: "companyContactNumber", label: "반품지 연락처" },
  { key: "returnZipCode", label: "반품지 우편번호" },
  { key: "returnAddress", label: "반품지 주소" },
];

/** Sprint A-11(작업8 — CPO 지시: "판매자 설정 사전 체크리스트 확장") — 없어도
 * 등록 자체는 되지만(어댑터/build-payload.ts가 빈 값 또는 다른 필드로 폴백)
 * 채워두면 품질이 올라가는 필드다. REQUIRED_PROFILE_FIELDS와 달리 missing에
 * 안 넣고 recommended로만 보여준다 — "등록 가능성" 퍼센트(필수만 반영)는 그대로
 * 두고, 체크리스트에는 ✓/△로 노출한다. */
const RECOMMENDED_PROFILE_FIELDS: { key: keyof SellerProfile; label: string }[] = [
  { key: "deliveryCharge", label: "배송비" },
  { key: "returnDeliveryCharge", label: "반품배송비" },
  { key: "exchangeDeliveryCharge", label: "교환배송비" },
  { key: "manufacturer", label: "제조자(수입자)" },
  { key: "qualityGuarantee", label: "품질보증기준" },
  { key: "asContactNumber", label: "A/S 연락처" },
];

/** 등록 화면(게이트)과 설정 페이지가 공통으로 쓰는 "지금 등록 가능한 상태인가"
 * 판정 — 계정 인증(env.ts) + 기본 배송 프로필(seller-profile.ts) 둘 다 확인한다.
 * 상세설명 템플릿은 여기 포함하지 않는다 — 없어도 등록 자체는 되고(AI 생성분만
 * 쓰임) 품질만 낮아지므로 "필수"가 아니라 PreflightChecklist의 권장 항목으로만
 * 보여준다. */
export async function getCoupangSettingsStatus(): Promise<{
  configured: boolean;
  missing: string[];
  recommended: string[];
  hasCredentials: boolean;
  hasSellerProfile: boolean;
}> {
  const credentials = await getCoupangCredentials();
  const vendorUserId = await getVendorUserId();
  const profile = await getDefaultSellerProfile();

  const missing: string[] = [];
  const recommended: string[] = [];
  if (!credentials) missing.push("쿠팡 API 키 (Access Key / Secret Key / Vendor ID)");
  if (!vendorUserId) missing.push("Wing 계정 ID");

  if (!profile) {
    missing.push("배송 프로필");
  } else {
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (!profile[field.key]) missing.push(field.label);
    }
    if (profile.outboundShippingPlaceCode == null) missing.push("출고지");
    for (const field of RECOMMENDED_PROFILE_FIELDS) {
      if (!profile[field.key]) recommended.push(field.label);
    }
  }

  return {
    configured: missing.length === 0,
    missing,
    recommended,
    hasCredentials: Boolean(credentials),
    hasSellerProfile: Boolean(profile),
  };
}
