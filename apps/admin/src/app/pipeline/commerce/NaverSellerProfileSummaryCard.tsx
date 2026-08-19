"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface SellerProfile {
  id: string;
  name: string;
  isDefault: boolean;
  naverDeliveryCompanyCode: string;
  returnDeliveryCharge: number | null;
  exchangeDeliveryCharge: number | null;
  companyContactNumber: string;
  manufacturer: string;
  asContactNumber: string;
  qualityGuarantee: string;
}

function won(value: number | null): string {
  return value != null ? `${value.toLocaleString()}원` : "미설정";
}

/**
 * Sprint P1(CPO 지시, 2026-08-19: "SmartStore도 Coupang 수준으로 — 배송정책·
 * 반품/교환") — SellerProfileSummaryCard(Coupang용)를 그대로 재사용하지
 * 않는다. 그 카드는 outboundShippingPlaceCode/returnCenterCode처럼 Coupang
 * 출고지 API(/api/coupang/shipping-places)로만 이름을 조회할 수 있는 값이라
 * SmartStore에 그대로 보여주면 틀린 데이터를 보여주는 셈이다(출고지/반품지는
 * SmartStore에서 Naver 주소록 API로 별도 관리되고, 이미 NaverPayloadPreview의
 * 배송/반품 섹션이 READY/MISSING으로 보여주고 있다 — 여기서 중복하지
 * 않는다). 이 카드는 SmartStore register route(payloadInputCommon)가 실제로
 * 쓰는 SellerProfile 필드만(택배사/반품배송비/교환배송비/AS연락처/제조자/
 * 품질보증기준) 보여준다. `/api/settings/coupang/profiles`는 이름과 달리
 * 플랫폼 공용 SellerProfile 테이블을 그대로 반환한다(Coupang 전용 API가
 * 아니다 — Settings 페이지도 이 하나의 프로필을 두 플랫폼에 같이 쓴다).
 */
export function NaverSellerProfileSummaryCard() {
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);

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
            <dt className="text-text-tertiary">택배사</dt>
            <dd className="text-text-primary">{profile.naverDeliveryCompanyCode || "미설정"}</dd>
            <dt className="text-text-tertiary">반품배송비</dt>
            <dd className="text-text-primary">{won(profile.returnDeliveryCharge)}</dd>
            <dt className="text-text-tertiary">교환배송비</dt>
            <dd className="text-text-primary">{won(profile.exchangeDeliveryCharge)}</dd>
          </dl>
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            출고지/반품지 주소는 네이버 주소록 기준으로 별도 확인됩니다 — 아래 "SmartStore 등록
            상세 확인"의 배송/반품 항목을 참고하세요.
          </p>
        </div>

        <div className="border-t border-border pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-medium text-text-secondary">반품/교환 문의처</p>
            <a href="/settings" className="text-primary hover:underline">
              설정에서 수정
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
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
