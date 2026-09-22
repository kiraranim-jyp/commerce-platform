import { getCoupangCredentials, getVendorUserId } from "./env";
import { getDefaultSellerProfile, type SellerProfile } from "./seller-profile";
import { loadSellerSettings, type SellerSettings } from "@/lib/seller-settings";

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
];

/* PIVOT-03 Phase 1 — 판매자 «공통» 세 값은 배송 프로필이 아니라 seller_settings
   에서 온다. 라벨도, 「비었으면 권장에 넣는다」는 판정도 그대로다. 출처만 옮긴다.

   🔴 목록을 나눈 이유는 읽는 «표» 가 다르기 때문이다. 한 목록으로 두면
   keyof SellerProfile 이 강제되어 다시 배송 프로필을 보게 된다.

   이 판정이 어긋나면 조용히 틀린다 — 체크리스트는 「제조자 미입력」이라는데
   등록에는 값이 나가거나 그 반대가 된다. 등록 화면의 게이트가 이 함수를 쓴다. */
const RECOMMENDED_SELLER_SETTING_FIELDS: { key: keyof SellerSettings; label: string }[] = [
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
  const sellerSettings = await loadSellerSettings();

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
    /* 🔴 판정을 «이 자리에» 그대로 둔다. 판매자 공통 설정은 이제 프로필과
       무관하지만, 밖으로 빼면 「프로필이 없을 때」의 출력이 달라진다 —
       그건 reader 교체가 아니라 cardinality 변경이고 0-4+2 의 일이다.
       라벨 순서도 그대로라 화면의 체크리스트가 한 줄도 안 움직인다. */
    for (const field of RECOMMENDED_SELLER_SETTING_FIELDS) {
      if (!sellerSettings[field.key]) recommended.push(field.label);
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
