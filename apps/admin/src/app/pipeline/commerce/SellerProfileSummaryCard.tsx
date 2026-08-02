"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";

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
export function SellerProfileSummaryCard() {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
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

  if (profile === undefined) return null;

  if (!profile) {
    return (
      <CollapsibleSection title="배송 정책 · 반품/교환" defaultOpen={false}>
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
    <CollapsibleSection title="배송 정책 · 반품/교환" defaultOpen={false}>
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
            <dd className="text-text-primary">{profile.asContactNumber || profile.companyContactNumber || "미설정"}</dd>
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
            <dd className="text-text-primary">{profile.manufacturer || "미설정"}</dd>
            <dt className="text-text-tertiary">품질보증기준</dt>
            <dd className="text-text-primary">{profile.qualityGuarantee || "미설정"}</dd>
          </dl>
        </div>
      </div>
    </CollapsibleSection>
  );
}
