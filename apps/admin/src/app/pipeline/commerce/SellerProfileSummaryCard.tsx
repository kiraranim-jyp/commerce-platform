"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { sectionTitle } from "./registration-sections";

interface SellerProfile {
  id: string;
  name: string;
  isDefault: boolean;
  deliveryCompanyCode: string;
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  outboundShippingPlaceCode: number | null;
  deliveryCharge: number | null;
  returnDeliveryCharge: number | null;
  exchangeDeliveryCharge: number | null;
  outboundLeadTimeDays: number | null;
  deliveryMethod: string;
  manufacturer: string;
  asContactNumber: string;
  qualityGuarantee: string;
}

interface ShippingPlaceOption {
  code: number | null;
  name: string;
  countryCode: string | null;
}

const COURIER_LABELS: Record<string, string> = {
  CJGLS: "CJ대한통운",
  HANJIN: "한진택배",
  LOTTE: "롯데택배",
  KGB: "로젠택배",
  EPOST: "우체국택배",
  KDEXP: "경동택배",
  CVSNET: "GS Postbox 택배(편의점택배)",
  HDEXP: "합동택배",
  ILYANG: "일양로지스",
  CHUNIL: "천일택배",
  DAESIN: "대신택배",
};

function won(value: number | null): string {
  return value != null ? `${value.toLocaleString()}원` : "미설정";
}

/**
 * Sprint A-8(작업1/3 — 배송 정책/반품·교환 카드) — CPO 지시: "상품마다 배송/반품
 * 정보를 다시 입력하지 않는다. 기본 프로필을 자동으로 불러오고, 필요하면
 * Settings에서 수정한다." 등록 Editor에는 읽기 전용 요약만 보여준다 — 실제
 * 수정 폼은 Settings 페이지 SellerProfileSection 한 곳에만 있다(이미 작업2/4로
 * 수정 기능이 생겼다). 같은 판정/편집 로직이 두 군데 있으면 CP001류 불일치가
 * 재발하므로, 여기서는 fetch해서 보여주기만 하고 "설정에서 수정"으로 보낸다.
 */
/* PIVOT-03 0-4+2-B — 이 카드는 «두 가지» 를 그린다.
     배송 정책·반품지·출고지 → 배송 프로필(여러 개 중 기본)
     판매자 기본정보 세 칸  → seller_settings(셀러당 하나)
   예전에는 둘 다 배송 프로필에서 꺼냈다. 그래서 프로필을 하나 더 만들면 화면의
   제조사가 빈칸이 됐는데, 서버의 실제 등록 경로는 이미 seller_settings 를 본다.
   화면이 말하는 값과 등록에 나가는 값이 갈라지는 자리였다. */
interface SellerSettingsValues {
  manufacturer?: string | null;
  qualityGuarantee?: string | null;
  asContactNumber?: string | null;
}

export function SellerProfileSummaryCard() {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [sellerSettings, setSellerSettings] = useState<SellerSettingsValues | undefined>(undefined);
  // Sprint A-9(작업5 — CEO 지시: "출고지 코드가 그대로 보인다. 사용자가 알 필요
  // 없다 — 이름만 보여주고 코드는 내부에서만 관리하라") — SellerProfile은
  // outboundShippingPlaceCode(숫자)만 갖고 있고 이름은 안 갖고 있다. Settings
  // 페이지가 이미 쓰는 것과 같은 실제 쿠팡 API(/api/coupang/shipping-places)로
  // 코드→이름을 조회해서 화면에는 이름만 보여준다.
  const [shippingPlaces, setShippingPlaces] = useState<ShippingPlaceOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/coupang/profiles")
      .then((res) => res.json())
      .then((data: { profiles?: SellerProfile[] }) => {
        if (cancelled) return;
        const list = data.profiles ?? [];
        setProfile(list.find((p) => p.isDefault) ?? list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    /* 🔴 고르지 않는다 — 판매자 공통 설정은 하나라서 고를 것이 없다.
       실패하면 빈 객체다. 위의 프로필 조회가 실패했을 때 null 을 넣어 「아직
       판매자 정보가 없습니다」로 가는 것과 달리, 여기는 카드 자체를 막지
       않는다 — 배송 정보는 여전히 보여줄 수 있다. */
    fetch("/api/settings/seller-settings")
      .then((res) => res.json())
      .then((data: { values?: SellerSettingsValues }) => {
        if (!cancelled) setSellerSettings(data.values ?? {});
      })
      .catch(() => {
        if (!cancelled) setSellerSettings({});
      });
    fetch("/api/coupang/shipping-places")
      .then((res) => res.json())
      .then((data: { options?: ShippingPlaceOption[] }) => {
        if (!cancelled) setShippingPlaces(data.options ?? []);
      })
      .catch(() => {
        // 조회 실패해도 아래에서 코드로 폴백 표시하므로 조용히 무시한다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 둘 다 기다린다. 한쪽만 먼저 그리면 「미설정」이 한 번 번쩍이고 값으로
     바뀐다 — 셀러에게는 설정이 사라졌다 돌아온 것처럼 보인다. */
  if (profile === undefined || sellerSettings === undefined) return null;

  if (!profile) {
    return (
      <CollapsibleSection title={sectionTitle("SHIPPING_POLICY")} defaultOpen={false}>
        <p className="text-xs text-text-secondary">
          아직 판매자 정보가 없습니다.{" "}
          <a href="/settings" className="text-primary hover:underline">
            설정에서 만들기
          </a>
        </p>
      </CollapsibleSection>
    );
  }

  const courierLabel = COURIER_LABELS[profile.deliveryCompanyCode] ?? (profile.deliveryCompanyCode || "미설정");
  const outboundPlace = shippingPlaces.find((p) => p.code === profile.outboundShippingPlaceCode);
  const outboundLabel = outboundPlace
    ? [outboundPlace.name, outboundPlace.countryCode].filter(Boolean).join(", ")
    : profile.outboundShippingPlaceCode == null
      ? "소싱 국가에 맞춰 자동 선택"
      : `출고지 #${profile.outboundShippingPlaceCode}`;

  return (
    <CollapsibleSection title={sectionTitle("SHIPPING_POLICY")} defaultOpen={false}>
      <div className="space-y-4 text-xs">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-medium text-text-secondary">배송 정보</p>
            <a href="/settings" className="text-primary hover:underline">
              배송정보 수정
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <dt className="text-text-tertiary">출고지</dt>
            <dd className="text-text-primary">{outboundLabel}</dd>
            <dt className="text-text-tertiary">택배사</dt>
            <dd className="text-text-primary">{courierLabel}</dd>
            <dt className="text-text-tertiary">배송방법</dt>
            <dd className="text-text-primary">{profile.deliveryMethod || "구매대행"}</dd>
            <dt className="text-text-tertiary">배송비</dt>
            <dd className="text-text-primary">{won(profile.deliveryCharge)}</dd>
            <dt className="text-text-tertiary">반품배송비</dt>
            <dd className="text-text-primary">{won(profile.returnDeliveryCharge)}</dd>
            <dt className="text-text-tertiary">교환배송비</dt>
            <dd className="text-text-primary">{won(profile.exchangeDeliveryCharge)}</dd>
            <dt className="text-text-tertiary">출고 소요일</dt>
            <dd className="text-text-primary">
              {profile.outboundLeadTimeDays != null ? `${profile.outboundLeadTimeDays}일` : "7일(기본값)"}
            </dd>
          </dl>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-medium text-text-secondary">반품/교환</p>
            <a href="/settings" className="text-primary hover:underline">
              반품주소 수정
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <dt className="text-text-tertiary">반품지</dt>
            <dd className="text-text-primary">{profile.returnChargeName || profile.returnAddress || "미설정"}</dd>
            <dt className="text-text-tertiary">전화번호</dt>
            {/* 🔴 A/S 연락처는 판매자 공통 설정, 반품지 연락처는 배송 프로필이다.
                이름이 비슷해 같이 옮기기 쉬운 자리 — 폴백 순서는 그대로 둔다. */}
            <dd className="text-text-primary">
              {sellerSettings.asContactNumber || profile.companyContactNumber || "미설정"}
            </dd>
          </dl>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-medium text-text-secondary">판매자 기본정보</p>
            <a href="/settings" className="text-primary hover:underline">
              설정에서 수정
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <dt className="text-text-tertiary">제조자(수입자)</dt>
            <dd className="text-text-primary">{sellerSettings.manufacturer || "미설정"}</dd>
            <dt className="text-text-tertiary">품질보증기준</dt>
            <dd className="text-text-primary">{sellerSettings.qualityGuarantee || "미설정"}</dd>
          </dl>
        </div>
      </div>
    </CollapsibleSection>
  );
}
