"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { TemplateSectionBlock } from "@commerce/listing";

const TAB_KEYS = [
  "coupang",
  "shipping",
  "seller",
  "pricing",
  "brand",
  "detail",
  "comparisonShops",
  "smartstore",
] as const;
type SettingsTabKey = (typeof TAB_KEYS)[number];

interface ShippingPlaceOption {
  code: number | null;
  name: string;
}

interface ReturnCenterOption {
  code: string | null;
  name: string;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  contactNumber: string | null;
}

interface AccountValues {
  accessKeyMasked: string | null;
  secretKeySaved: boolean;
  vendorId: string | null;
  vendorUserId: string | null;
}

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
  defaultMarginPercent: number | null;
  includeShippingInPrice: boolean;
  priceRoundingUnit: number;
  defaultCountryOfOrigin: string;
  topCommonImageUrl: string | null;
  topCommonImageEnabled: boolean;
  bottomCommonImageUrl: string | null;
  bottomCommonImageEnabled: boolean;
  kcExemptionText: string;
}

interface BrandProfile {
  id: string;
  name: string;
  countryOfOrigin: string;
  manufacturer: string;
  brandIntro: string;
  representativeImageUrl: string | null;
  commonDescription: string;
}

interface DescriptionTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  shippingInfo: string;
  exchangeInfo: string;
  returnInfo: string;
  agentBuyInfo: string;
  asInfo: string;
  shippingBlocks: TemplateSectionBlock[];
  exchangeBlocks: TemplateSectionBlock[];
  returnBlocks: TemplateSectionBlock[];
  agentBuyBlocks: TemplateSectionBlock[];
  asBlocks: TemplateSectionBlock[];
}

const COURIER_OPTIONS = [
  { code: "CJGLS", label: "CJ대한통운" },
  { code: "HANJIN", label: "한진택배" },
  { code: "LOTTE", label: "롯데택배" },
  { code: "KGB", label: "로젠택배" },
  { code: "EPOST", label: "우체국택배" },
  { code: "KDEXP", label: "경동택배" },
  { code: "CVSNET", label: "GS Postbox 택배(편의점택배)" },
  { code: "HDEXP", label: "합동택배" },
  { code: "ILYANG", label: "일양로지스" },
  { code: "CHUNIL", label: "천일택배" },
  { code: "DAESIN", label: "대신택배" },
];

/**
 * 쿠팡 판매자 설정 — 세 가지로 나뉜다.
 * 1. 계정(Access/Secret Key, Vendor ID, Wing 계정 ID) — 계정당 하나.
 * 2. 배송 프로필(출고지/반품지/택배사) — 여러 개 만들어두고 기본값을 고를 수 있다.
 * 3. 상세설명 템플릿(배송/교환/반품/구매대행/A·S 고정 문구) — 여러 개 만들어두고
 *    기본값을 고를 수 있다.
 * 둘 다 "최초 1회 생성하면 이후에는 등록할 때 자동으로 기본값을 쓴다"는 흐름이다.
 */
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);

  const [account, setAccount] = useState<AccountValues>({
    accessKeyMasked: null,
    secretKeySaved: false,
    vendorId: null,
    vendorUserId: null,
  });
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorUserId, setVendorUserId] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([]);

  // 4개로 흩어져 있던 <section>(계정/배송프로필/브랜드/템플릿)을 ?tab= 쿼리로 제어하는
  // 탭으로 전환한다 — useSearchParams는 정적 렌더 시 Suspense 경계가 필요해서, 이미
  // "use client"로 완전히 클라이언트 렌더되는 이 페이지에서는 window.location을 직접
  // 읽는 쪽이 더 단순하다. 탭 전환 시 언마운트하지 않고 hidden 클래스로만 감춰서 폼
  // 입력 중이던 값이 탭을 오가도 유지되게 한다.
  const [activeTab, setActiveTabState] = useState<SettingsTabKey>("coupang");
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && (TAB_KEYS as readonly string[]).includes(tab)) {
      setActiveTabState(tab as SettingsTabKey);
    }
  }, []);
  function setActiveTab(tab: string) {
    setActiveTabState(tab as SettingsTabKey);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  async function loadAll() {
    const [accountRes, profilesRes, brandProfilesRes, templatesRes] = await Promise.all([
      fetch("/api/settings/coupang"),
      fetch("/api/settings/coupang/profiles"),
      fetch("/api/settings/coupang/brand-profiles"),
      fetch("/api/settings/coupang/templates"),
    ]);
    const accountData = (await accountRes.json()) as {
      configured: boolean;
      missing: string[];
      values: AccountValues;
    };
    const profilesData = (await profilesRes.json()) as { profiles: SellerProfile[] };
    const brandProfilesData = (await brandProfilesRes.json()) as { profiles: BrandProfile[] };
    const templatesData = (await templatesRes.json()) as { templates: DescriptionTemplate[] };

    setConfigured(accountData.configured);
    setMissing(accountData.missing);
    setAccount(accountData.values);
    setVendorId(accountData.values.vendorId ?? "");
    setVendorUserId(accountData.values.vendorUserId ?? "");
    setProfiles(profilesData.profiles ?? []);
    setBrandProfiles(brandProfilesData.profiles ?? []);
    setTemplates(templatesData.templates ?? []);
  }

  // loadAll()을 effect 콜백에서 직접 호출하면 setState가 effect 본문 내에서
  // 동기적으로 실행된 것으로 잡혀 react-hooks/set-state-in-effect에 걸린다 —
  // 마운트 시 최초 호출만 async IIFE로 감싸서 우회한다(loadAll()은 프로필/템플릿
  // 변경 후 재조회용으로 그대로 재사용한다).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveAccount() {
    setAccountSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/settings/coupang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: accessKey || undefined,
          secretKey: secretKey || undefined,
          vendorId: vendorId || undefined,
          vendorUserId: vendorUserId || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setSaveMessage(`계정 저장 실패: ${data.error}`);
        return;
      }
      setSaveMessage("계정 정보가 저장되었습니다.");
      setAccessKey("");
      setSecretKey("");
      await loadAll();
    } finally {
      setAccountSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="설정" subtitle="쿠팡/스마트스토어 판매에 필요한 정보를 관리합니다." />
        <PageContainer size="lg">
          <p className="text-sm text-text-secondary">불러오는 중...</p>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageHeader title="설정" subtitle="쿠팡/스마트스토어 판매에 필요한 정보를 관리합니다." />
      <PageContainer size="lg">
        <div className="mx-auto max-w-2xl">
          <div
            className={`rounded-md p-3 text-sm ${
              configured ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
            }`}
          >
            {configured
              ? "✓ 쿠팡 등록에 필요한 설정이 모두 준비되어 있습니다."
              : `⚠ 아직 준비되지 않은 항목: ${missing.join(", ")}`}
          </div>
          {saveMessage && <p className="mt-2 text-xs text-text-secondary">{saveMessage}</p>}

          <Tabs
            className="mt-6"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { value: "coupang", label: "쿠팡 계정" },
              { value: "shipping", label: "배송 프로필" },
              { value: "seller", label: "판매자 정보" },
              { value: "pricing", label: "가격 정책" },
              { value: "brand", label: "브랜드 관리" },
              { value: "detail", label: "상세페이지 관리" },
              { value: "comparisonShops", label: "해외 편집샵" },
              { value: "smartstore", label: "스마트스토어", badge: "Soon", disabled: true },
            ]}
          />

          <div className={activeTab === "coupang" ? "mt-5" : "hidden"}>
            <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
              <h2 className="text-base font-semibold text-text-primary">쿠팡 계정</h2>
              <div className="mt-3 space-y-3 text-sm">
                <Field label="Access Key" hint={account.accessKeyMasked ? `저장됨 (${account.accessKeyMasked})` : "미저장"}>
                  <input
                    type="password"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    placeholder={account.accessKeyMasked ?? "새 값을 입력하지 않으면 기존 값 유지"}
                    className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="Secret Key" hint={account.secretKeySaved ? "저장됨" : "미저장"}>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder={account.secretKeySaved ? "•••• (변경하려면 새 값 입력)" : "새 값을 입력하지 않으면 기존 값 유지"}
                    className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="Vendor ID">
                  <input
                    type="text"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="Wing 계정 ID" hint="Wing 로그인 ID — API로 조회할 수 없어 직접 입력해야 합니다">
                  <input
                    type="text"
                    value={vendorUserId}
                    onChange={(e) => setVendorUserId(e.target.value)}
                    className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                  />
                </Field>
                <button
                  type="button"
                  onClick={handleSaveAccount}
                  disabled={accountSaving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {accountSaving ? "저장 중…" : "계정 저장"}
                </button>
              </div>
            </section>
          </div>

          {/* 배송 프로필/판매자 정보/가격 정책/상세페이지(공통이미지) 4개 탭이
              전부 하나의 SellerProfile 저장 단위를 공유하므로, 인스턴스를
              하나만 마운트하고 내부에서 activeTab에 따라 어느 섹션을 보여줄지
              결정한다(탭을 오갈 때 상태가 유지되어야 하므로 언마운트 금지 —
              최상위 탭과 같은 CSS-hidden 패턴을 컴포넌트 내부에 적용). */}
          <SellerProfileEditor profiles={profiles} onChanged={loadAll} activeTab={activeTab} />

          <div className={activeTab === "brand" ? "mt-5" : "hidden"}>
            <BrandProfileSection profiles={brandProfiles} onChanged={loadAll} />
          </div>
          <div className={activeTab === "detail" ? "mt-5" : "hidden"}>
            <SectionHeader
              title="상세페이지 템플릿"
              description="상품 설명 템플릿을 관리합니다."
              className="mb-3"
            />
            <DescriptionTemplateSection templates={templates} onChanged={loadAll} />
          </div>
          <div className={activeTab === "comparisonShops" ? "mt-5" : "hidden"}>
            <SectionHeader
              title="해외 편집샵 가격 비교"
              description="상품의 해외 가격 비교에 사용할 편집샵을 선택하고 관리합니다."
              className="mb-3"
            />
            <ComparisonShopsSection />
          </div>
          {activeTab === "smartstore" && (
            <p className="mt-5 rounded-md border border-dashed border-border p-4 text-sm text-text-tertiary">
              스마트스토어 설정은 준비 중입니다.
            </p>
          )}

          <DeveloperModeSection />
        </div>
      </PageContainer>
    </>
  );
}

/** CartPilot UI 2.0 — Developer Mode 토글을 pipeline 페이지 헤더에서 이곳으로
 * 옮겼다. 계정/프로필과 무관한 순수 UI 설정이라 DB 컬럼 없이 localStorage에만
 * 저장한다 — 브라우저를 넘어서까지 유지될 필요는 없고, 이 브라우저에서 새로고침해도
 * 꺼지지 않으면 충분하다. 탭 구조와 무관하게 항상 페이지 맨 아래에 고정한다. */
function DeveloperModeSection() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem("cartpilot:developerMode") === "true");
    } catch {
      // localStorage 접근 불가 — 기본값 false 유지.
    }
  }, []);
  function toggle(next: boolean) {
    setEnabled(next);
    try {
      window.localStorage.setItem("cartpilot:developerMode", String(next));
    } catch {
      // 저장 실패해도 화면 동작에는 영향 없음(다음 새로고침 시 다시 꺼진 상태로 보일 뿐).
    }
  }
  return (
    <div className="mt-10 border-t border-border pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Developer</p>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        Developer Mode — 상품등록 화면에서 JSON/ZIP/원본 URL/Payload 등 개발자용 정보를 노출합니다.
      </label>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** CEO 지시(2026-08-03) — "설정 메뉴의 수정 정보를 상품등록시 필요한 정보카테고리
 * 기준으로 분류해줬으면 해, 너무 숨겨져 있어." 배송 프로필 폼이 출고지/반품지/
 * 가격정책/판매자정보가 전부 한 줄로 이어져 있어 다 펼쳐봐야만 확인 가능했다 —
 * 등록 시 실제로 쓰이는 정보 단위(출고·배송 / 반품·교환 / 판매자 기본정보 /
 * 가격 정책 / 공통 이미지)로 접이식 그룹을 나눈다. state/저장 로직은 그대로
 * 두고 시각적 그룹핑만 바꾼다 — 필드 하나도 옮기지 않고 감싸기만 한다. */
function SettingsSubSection({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-text-secondary hover:bg-background hover:text-text-primary">
        {title}
        {hint && <span className="ml-2 font-normal text-text-tertiary">{hint}</span>}
      </summary>
      <div className="space-y-3 border-t border-border p-3">{children}</div>
    </details>
  );
}

/** Sprint A-11(작업3) — 파일 선택 즉시 업로드해서 미리보기+URL을 보여주고,
 * ON/OFF 토글로 실제 등록 payload에 넣을지 정한다. */
/**
 * SellerProfile 저장 단위 하나(배송 프로필/판매자 정보/가격 정책/상세페이지
 * 공통이미지)를 4개 탭으로 나눠 보여준다. CEO 피드백(2026-08-04) — DB/API는
 * 그대로 두고 화면만 나눈다("탭 = 화면 분리, 저장 = 기존 API 그대로"). 상태/
 * 저장(handleSave)/startEdit/resetForm은 이 컴포넌트 하나가 갖고, 화면 조각만
 * ShippingSection/SellerInfoSection/PricingSection/CommonImagesSection으로
 * 분리한다(CPO 지적 — activeTab별 if-분기 대신 컴포넌트 트리로 나눠 유지보수
 * 용이하게). 네 개 wrapper 전부 이 컴포넌트 하나를 참조해야 탭을 오가도 입력
 * 중이던 값이 유지된다 — page.tsx에서 한 번만 마운트한다.
 */
function SellerProfileEditor({
  profiles,
  onChanged,
  activeTab,
}: {
  profiles: SellerProfile[];
  onChanged: () => Promise<void>;
  activeTab: SettingsTabKey;
}) {
  const [formOpen, setFormOpen] = useState(profiles.length === 0);
  // Sprint A-8(작업2/4/6) — 지금까지는 "새로 만들기"만 있었다. editingId가
  // null이 아니면 그 프로필을 고치는 중이라는 뜻이고, 폼은 그대로 재사용하되
  // 저장 버튼이 POST(생성) 대신 PATCH(수정)를 부른다.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deliveryCompanyCode, setDeliveryCompanyCode] = useState("");
  const [returnCenterCode, setReturnCenterCode] = useState("");
  const [returnChargeName, setReturnChargeName] = useState("");
  const [companyContactNumber, setCompanyContactNumber] = useState("");
  const [returnZipCode, setReturnZipCode] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  const [returnAddressDetail, setReturnAddressDetail] = useState("");
  const [outboundShippingPlaceCode, setOutboundShippingPlaceCode] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [returnDeliveryCharge, setReturnDeliveryCharge] = useState("");
  const [exchangeDeliveryCharge, setExchangeDeliveryCharge] = useState("");
  const [outboundLeadTimeDays, setOutboundLeadTimeDays] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("구매대행");
  const [manufacturer, setManufacturer] = useState("");
  const [asContactNumber, setAsContactNumber] = useState("");
  const [qualityGuarantee, setQualityGuarantee] = useState("");
  // A-12.3-P0-2(CPO 지시: "KC마크 없이 구매대행 가능한 품목 — 기본값 자동
  // 입력") — 빈 문자열이면 기능이 꺼진 것과 같다(기존처럼 사용자가 직접
  // 확인해야 하는 상태 유지).
  const [kcExemptionText, setKcExemptionText] = useState("");
  // Sprint A-11(작업1/2/4 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)",
  // "가격 반올림 단위", "원산지 기본값") — 상품마다 다시 입력하지 않는 가격
  // 정책/원산지 기본값도 위 배송/판매자 기본정보와 같은 패턴으로 저장한다.
  const [defaultMarginPercent, setDefaultMarginPercent] = useState("");
  const [includeShippingInPrice, setIncludeShippingInPrice] = useState(false);
  const [priceRoundingUnit, setPriceRoundingUnit] = useState("10");
  const [defaultCountryOfOrigin, setDefaultCountryOfOrigin] = useState("");
  // Sprint A-11(작업3) — 상세페이지 상단/하단에 항상 붙는 공통 이미지.
  const [topCommonImageUrl, setTopCommonImageUrl] = useState<string | null>(null);
  const [topCommonImageEnabled, setTopCommonImageEnabled] = useState(false);
  const [bottomCommonImageUrl, setBottomCommonImageUrl] = useState<string | null>(null);
  const [bottomCommonImageEnabled, setBottomCommonImageEnabled] = useState(false);
  const [imageUploading, setImageUploading] = useState<"top" | "bottom" | null>(null);

  const [shippingPlaces, setShippingPlaces] = useState<ShippingPlaceOption[]>([]);
  const [returnCenters, setReturnCenters] = useState<ReturnCenterOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDeliveryCompanyCode("");
    setReturnCenterCode("");
    setReturnChargeName("");
    setCompanyContactNumber("");
    setReturnZipCode("");
    setReturnAddress("");
    setReturnAddressDetail("");
    setOutboundShippingPlaceCode("");
    setDeliveryCharge("");
    setReturnDeliveryCharge("");
    setExchangeDeliveryCharge("");
    setOutboundLeadTimeDays("");
    setDeliveryMethod("구매대행");
    setManufacturer("");
    setAsContactNumber("");
    setQualityGuarantee("");
    setDefaultMarginPercent("");
    setIncludeShippingInPrice(false);
    setPriceRoundingUnit("10");
    setDefaultCountryOfOrigin("");
    setTopCommonImageUrl(null);
    setTopCommonImageEnabled(false);
    setBottomCommonImageUrl(null);
    setBottomCommonImageEnabled(false);
  }

  // startEdit(수동 "수정" 클릭)과 아래 자동 채움 effect가 공유하는 필드
  // 채우기 로직 — 하나로 유지해 두 경로가 어긋나지 않게 한다.
  function fillForm(p: SellerProfile) {
    setName(p.name);
    setDeliveryCompanyCode(p.deliveryCompanyCode);
    setReturnCenterCode(p.returnCenterCode);
    setReturnChargeName(p.returnChargeName);
    setCompanyContactNumber(p.companyContactNumber);
    setReturnZipCode(p.returnZipCode);
    setReturnAddress(p.returnAddress);
    setReturnAddressDetail(p.returnAddressDetail);
    setOutboundShippingPlaceCode(p.outboundShippingPlaceCode != null ? String(p.outboundShippingPlaceCode) : "");
    setDeliveryCharge(p.deliveryCharge != null ? String(p.deliveryCharge) : "");
    setReturnDeliveryCharge(p.returnDeliveryCharge != null ? String(p.returnDeliveryCharge) : "");
    setExchangeDeliveryCharge(p.exchangeDeliveryCharge != null ? String(p.exchangeDeliveryCharge) : "");
    setOutboundLeadTimeDays(p.outboundLeadTimeDays != null ? String(p.outboundLeadTimeDays) : "");
    setDeliveryMethod(p.deliveryMethod || "구매대행");
    setManufacturer(p.manufacturer);
    setAsContactNumber(p.asContactNumber);
    setQualityGuarantee(p.qualityGuarantee);
    setKcExemptionText(p.kcExemptionText);
    setDefaultMarginPercent(p.defaultMarginPercent != null ? String(p.defaultMarginPercent) : "");
    setIncludeShippingInPrice(p.includeShippingInPrice);
    setPriceRoundingUnit(p.priceRoundingUnit != null ? String(p.priceRoundingUnit) : "10");
    setDefaultCountryOfOrigin(p.defaultCountryOfOrigin);
    setTopCommonImageUrl(p.topCommonImageUrl);
    setTopCommonImageEnabled(p.topCommonImageEnabled);
    setBottomCommonImageUrl(p.bottomCommonImageUrl);
    setBottomCommonImageEnabled(p.bottomCommonImageEnabled);
  }

  function startEdit(p: SellerProfile) {
    setEditingId(p.id);
    fillForm(p);
    setFormOpen(true);
  }

  // CEO 피드백(2026-08-04) — "판매자 정보"/"가격 정책"/"상세페이지 관리" 탭은
  // 목록/토글이 없어서 "배송 프로필" 탭에서 먼저 "수정"을 눌러야만 값이
  // 보였다. 프로필이 이미 하나 있는 게 일반적인 상태이므로, 처음 로드되고
  // 아직 아무 것도 편집 중이 아닐 때 기본 프로필(없으면 첫 프로필)을 자동으로
  // 채운다. editingId도 같이 세팅해야 이 탭들에서 저장을 눌러도 새 프로필이
  // 아니라 같은 프로필을 PATCH한다(CPO 지적 — 기본 프로필 우선 순서 명확화).
  useEffect(() => {
    if (profiles.length > 0 && editingId === null) {
      const target = profiles.find((p) => p.isDefault) ?? profiles[0];
      setEditingId(target.id);
      fillForm(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  async function uploadCommonImage(position: "top" | "bottom", file: File) {
    setImageUploading(position);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/coupang/common-images", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        // CartPilot UI 2.0 — 실측 확인된 버그: 업로드는 됐는데 "사용(ON)"을 따로
        // 켜야 실제 등록 payload에 반영되는 2단계 흐름이라 사용자가 후자를 놓치기
        // 쉬웠다(라이브 프로필에 topCommonImageUrl은 있는데 topCommonImageEnabled는
        // false인 사례로 확인). 업로드 성공 시 자동으로 켜고, 끄고 싶으면 여전히
        // 체크박스로 끌 수 있다 — 기본 동작만 "업로드 = 사용"으로 바꾼다.
        if (position === "top") {
          setTopCommonImageUrl(data.url);
          setTopCommonImageEnabled(true);
        } else {
          setBottomCommonImageUrl(data.url);
          setBottomCommonImageEnabled(true);
        }
      } else {
        setLookupError(data.error ?? "이미지 업로드에 실패했습니다.");
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setImageUploading(null);
    }
  }

  async function fetchLookups() {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const [placesRes, centersRes] = await Promise.all([
        fetch("/api/coupang/shipping-places"),
        fetch("/api/coupang/return-centers"),
      ]);
      const places = (await placesRes.json()) as { options: ShippingPlaceOption[]; error?: string };
      const centers = (await centersRes.json()) as { options: ReturnCenterOption[]; error?: string };
      setShippingPlaces(places.options ?? []);
      setReturnCenters(centers.options ?? []);
      if (places.error || centers.error) {
        setLookupError(places.error || centers.error || null);
      } else if ((places.options?.length ?? 0) === 0 && (centers.options?.length ?? 0) === 0) {
        setLookupError("조회된 항목이 없습니다 — Wing에 등록된 출고지/반품지가 있는지 확인해주세요.");
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLookupLoading(false);
    }
  }

  // Sprint A-9(작업5 — CEO 지시: "출고지 코드가 그대로 보인다") — 프로필 목록
  // 요약 줄이 출고지/반품지 코드를 이름으로 바꿔 보여주려면 이 조회가 폼을
  // 펼치기 전에도 미리 되어 있어야 한다. 기존엔 사용자가 "목록 불러오기"를
  // 눌러야만(폼 안에서만) 조회됐다 — 화면 진입 시 한 번만 자동으로 불러온다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchLookups();
  }, []);

  function selectReturnCenter(code: string) {
    setReturnCenterCode(code);
    const found = returnCenters.find((c) => c.code === code);
    if (found) {
      setReturnChargeName(found.name);
      setReturnZipCode(found.zipCode ?? "");
      setReturnAddress(found.address ?? "");
      setReturnAddressDetail(found.addressDetail ?? "");
      if (found.contactNumber) setCompanyContactNumber(found.contactNumber);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        name: name || "기본",
        deliveryCompanyCode: deliveryCompanyCode || undefined,
        returnCenterCode: returnCenterCode || undefined,
        returnChargeName: returnChargeName || undefined,
        companyContactNumber: companyContactNumber || undefined,
        returnZipCode: returnZipCode || undefined,
        returnAddress: returnAddress || undefined,
        returnAddressDetail: returnAddressDetail || undefined,
        outboundShippingPlaceCode: outboundShippingPlaceCode ? Number(outboundShippingPlaceCode) : undefined,
        deliveryCharge: deliveryCharge ? Number(deliveryCharge) : undefined,
        returnDeliveryCharge: returnDeliveryCharge ? Number(returnDeliveryCharge) : undefined,
        exchangeDeliveryCharge: exchangeDeliveryCharge ? Number(exchangeDeliveryCharge) : undefined,
        outboundLeadTimeDays: outboundLeadTimeDays ? Number(outboundLeadTimeDays) : undefined,
        deliveryMethod: deliveryMethod || undefined,
        manufacturer: manufacturer || undefined,
        asContactNumber: asContactNumber || undefined,
        qualityGuarantee: qualityGuarantee || undefined,
        kcExemptionText: kcExemptionText || undefined,
        defaultMarginPercent: defaultMarginPercent ? Number(defaultMarginPercent) : undefined,
        includeShippingInPrice,
        priceRoundingUnit: priceRoundingUnit ? Number(priceRoundingUnit) : undefined,
        defaultCountryOfOrigin: defaultCountryOfOrigin || undefined,
        topCommonImageUrl,
        topCommonImageEnabled,
        bottomCommonImageUrl,
        bottomCommonImageEnabled,
      };
      const res = await fetch(
        editingId ? `/api/settings/coupang/profiles/${editingId}` : "/api/settings/coupang/profiles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        // CEO 피드백(2026-08-07) — "상세페이지 상단/하단 고정 이미지가 실제
        // 반영되지 않음." 실제 원인: 이 handleSave가 4개 탭(배송/판매자정보/
        // 가격정책/상세페이지)이 공유하는 단일 저장 버튼인데, 저장 성공 시
        // 무조건 resetForm()(editingId→null 포함)을 호출했다. editingId가
        // null이 되면 위쪽 자동 채움 effect가 재실행되며 "기본 프로필"로
        // 다시 채우는데, 지금 편집 중이던 프로필이 기본 프로필이 아니면
        // 화면이 방금 저장한 값 대신 다른 프로필 값으로 바뀌어 보인다 —
        // DB 저장 자체는 성공했지만 사용자 눈에는 "반영 안 됨"으로 보였다.
        // 새 프로필 생성(POST, editingId 없음)일 때만 폼을 초기화/닫는다 —
        // 기존 프로필 수정(PATCH)은 같은 프로필을 계속 보여줘야 한다.
        if (!editingId) {
          resetForm();
          setFormOpen(false);
        }
        await onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/settings/coupang/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await onChanged();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/settings/coupang/profiles/${id}`, { method: "DELETE" });
    await onChanged();
  }

  const saveButtonLabel = saving ? "저장 중…" : editingId ? "수정 저장" : "프로필 저장";

  return (
    <>
      <div className={activeTab === "shipping" ? "mt-5" : "hidden"}>
        <ShippingSection
          profiles={profiles}
          formOpen={formOpen}
          onToggleForm={() => {
            resetForm();
            setFormOpen((v) => !v);
          }}
          returnCenters={returnCenters}
          shippingPlaces={shippingPlaces}
          name={name}
          onNameChange={setName}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          onFetchLookups={fetchLookups}
          outboundShippingPlaceCode={outboundShippingPlaceCode}
          onOutboundShippingPlaceCodeChange={setOutboundShippingPlaceCode}
          deliveryCompanyCode={deliveryCompanyCode}
          onDeliveryCompanyCodeChange={setDeliveryCompanyCode}
          deliveryMethod={deliveryMethod}
          onDeliveryMethodChange={setDeliveryMethod}
          deliveryCharge={deliveryCharge}
          onDeliveryChargeChange={setDeliveryCharge}
          outboundLeadTimeDays={outboundLeadTimeDays}
          onOutboundLeadTimeDaysChange={setOutboundLeadTimeDays}
          returnCenterCode={returnCenterCode}
          onReturnCenterCodeChange={setReturnCenterCode}
          onSelectReturnCenter={selectReturnCenter}
          returnChargeName={returnChargeName}
          onReturnChargeNameChange={setReturnChargeName}
          companyContactNumber={companyContactNumber}
          onCompanyContactNumberChange={setCompanyContactNumber}
          returnZipCode={returnZipCode}
          onReturnZipCodeChange={setReturnZipCode}
          returnAddress={returnAddress}
          onReturnAddressChange={setReturnAddress}
          returnAddressDetail={returnAddressDetail}
          onReturnAddressDetailChange={setReturnAddressDetail}
          returnDeliveryCharge={returnDeliveryCharge}
          onReturnDeliveryChargeChange={setReturnDeliveryCharge}
          exchangeDeliveryCharge={exchangeDeliveryCharge}
          onExchangeDeliveryChargeChange={setExchangeDeliveryCharge}
          onStartEdit={startEdit}
          onSetDefault={handleSetDefault}
          onDelete={handleDelete}
          onSave={handleSave}
          saving={saving}
          saveButtonLabel={saveButtonLabel}
        />
      </div>

      <div className={activeTab === "seller" ? "mt-5" : "hidden"}>
        <SellerInfoSection
          manufacturer={manufacturer}
          onManufacturerChange={setManufacturer}
          asContactNumber={asContactNumber}
          onAsContactNumberChange={setAsContactNumber}
          qualityGuarantee={qualityGuarantee}
          onQualityGuaranteeChange={setQualityGuarantee}
          kcExemptionText={kcExemptionText}
          onKcExemptionTextChange={setKcExemptionText}
          defaultCountryOfOrigin={defaultCountryOfOrigin}
          onDefaultCountryOfOriginChange={setDefaultCountryOfOrigin}
          onSave={handleSave}
          saving={saving}
          saveButtonLabel={saveButtonLabel}
        />
      </div>

      <div className={activeTab === "pricing" ? "mt-5" : "hidden"}>
        <PricingSection
          defaultMarginPercent={defaultMarginPercent}
          onDefaultMarginPercentChange={setDefaultMarginPercent}
          includeShippingInPrice={includeShippingInPrice}
          onIncludeShippingInPriceChange={setIncludeShippingInPrice}
          priceRoundingUnit={priceRoundingUnit}
          onPriceRoundingUnitChange={setPriceRoundingUnit}
          onSave={handleSave}
          saving={saving}
          saveButtonLabel={saveButtonLabel}
        />
      </div>

      <div className={activeTab === "detail" ? "mt-5" : "hidden"}>
        <SectionHeader
          title="공통 이미지"
          description="상세페이지 상단/하단에 자동 삽입됩니다."
          className="mb-3"
        />
        <CommonImagesSection
          topCommonImageUrl={topCommonImageUrl}
          topCommonImageEnabled={topCommonImageEnabled}
          onTopCommonImageEnabledChange={setTopCommonImageEnabled}
          bottomCommonImageUrl={bottomCommonImageUrl}
          bottomCommonImageEnabled={bottomCommonImageEnabled}
          onBottomCommonImageEnabledChange={setBottomCommonImageEnabled}
          imageUploading={imageUploading}
          onUploadTop={(file) => uploadCommonImage("top", file)}
          onUploadBottom={(file) => uploadCommonImage("bottom", file)}
          onSelectTopExisting={(asset) => {
            setTopCommonImageUrl(asset.url);
            setTopCommonImageEnabled(true);
          }}
          onSelectBottomExisting={(asset) => {
            setBottomCommonImageUrl(asset.url);
            setBottomCommonImageEnabled(true);
          }}
          onSave={handleSave}
          saving={saving}
          saveButtonLabel={saveButtonLabel}
        />
      </div>
    </>
  );
}

function SaveButton({ onSave, saving, label }: { onSave: () => void; saving: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function ShippingSection({
  profiles,
  formOpen,
  onToggleForm,
  returnCenters,
  shippingPlaces,
  name,
  onNameChange,
  lookupLoading,
  lookupError,
  onFetchLookups,
  outboundShippingPlaceCode,
  onOutboundShippingPlaceCodeChange,
  deliveryCompanyCode,
  onDeliveryCompanyCodeChange,
  deliveryMethod,
  onDeliveryMethodChange,
  deliveryCharge,
  onDeliveryChargeChange,
  outboundLeadTimeDays,
  onOutboundLeadTimeDaysChange,
  returnCenterCode,
  onReturnCenterCodeChange,
  onSelectReturnCenter,
  returnChargeName,
  onReturnChargeNameChange,
  companyContactNumber,
  onCompanyContactNumberChange,
  returnZipCode,
  onReturnZipCodeChange,
  returnAddress,
  onReturnAddressChange,
  returnAddressDetail,
  onReturnAddressDetailChange,
  returnDeliveryCharge,
  onReturnDeliveryChargeChange,
  exchangeDeliveryCharge,
  onExchangeDeliveryChargeChange,
  onStartEdit,
  onSetDefault,
  onDelete,
  onSave,
  saving,
  saveButtonLabel,
}: {
  profiles: SellerProfile[];
  formOpen: boolean;
  onToggleForm: () => void;
  returnCenters: ReturnCenterOption[];
  shippingPlaces: ShippingPlaceOption[];
  name: string;
  onNameChange: (v: string) => void;
  lookupLoading: boolean;
  lookupError: string | null;
  onFetchLookups: () => void;
  outboundShippingPlaceCode: string;
  onOutboundShippingPlaceCodeChange: (v: string) => void;
  deliveryCompanyCode: string;
  onDeliveryCompanyCodeChange: (v: string) => void;
  deliveryMethod: string;
  onDeliveryMethodChange: (v: string) => void;
  deliveryCharge: string;
  onDeliveryChargeChange: (v: string) => void;
  outboundLeadTimeDays: string;
  onOutboundLeadTimeDaysChange: (v: string) => void;
  returnCenterCode: string;
  onReturnCenterCodeChange: (v: string) => void;
  onSelectReturnCenter: (code: string) => void;
  returnChargeName: string;
  onReturnChargeNameChange: (v: string) => void;
  companyContactNumber: string;
  onCompanyContactNumberChange: (v: string) => void;
  returnZipCode: string;
  onReturnZipCodeChange: (v: string) => void;
  returnAddress: string;
  onReturnAddressChange: (v: string) => void;
  returnAddressDetail: string;
  onReturnAddressDetailChange: (v: string) => void;
  returnDeliveryCharge: string;
  onReturnDeliveryChargeChange: (v: string) => void;
  exchangeDeliveryCharge: string;
  onExchangeDeliveryChargeChange: (v: string) => void;
  onStartEdit: (p: SellerProfile) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  saving: boolean;
  saveButtonLabel: string;
}) {
  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">배송 프로필</h2>
        <button
          type="button"
          onClick={onToggleForm}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background"
        >
          {formOpen ? "닫기" : "새 프로필 만들기"}
        </button>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        출고지/반품지/택배사를 한 번 만들어두면 등록할 때 기본 프로필이 자동으로 쓰입니다.
      </p>

      {profiles.length > 0 && (
        <ul className="mt-3 divide-y divide-border text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-text-primary">{p.name}</span>
                {p.isDefault && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    기본
                  </span>
                )}
                <p className="text-xs text-text-secondary">
                  택배사 {COURIER_OPTIONS.find((c) => c.code === p.deliveryCompanyCode)?.label ?? p.deliveryCompanyCode ?? "-"} ·
                  반품지 {returnCenters.find((c) => c.code === p.returnCenterCode)?.name ?? p.returnChargeName ?? "-"} ·
                  출고지{" "}
                  {shippingPlaces.find((s) => s.code === p.outboundShippingPlaceCode)?.name ??
                    (p.outboundShippingPlaceCode != null ? `#${p.outboundShippingPlaceCode}` : "-")}
                </p>
                <p className="text-xs text-text-secondary">
                  배송비 {p.deliveryCharge != null ? `${p.deliveryCharge.toLocaleString()}원` : "-"} · 반품배송비{" "}
                  {p.returnDeliveryCharge != null ? `${p.returnDeliveryCharge.toLocaleString()}원` : "-"} ·
                  제조자(수입자) {p.manufacturer || "-"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartEdit(p)}
                  className="text-xs text-text-secondary hover:underline"
                >
                  수정
                </button>
                {!p.isDefault && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(p.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    기본으로 설정
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="text-xs text-error hover:underline"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <Field label="프로필 이름">
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="예: 기본"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">출고지/반품지 자동 조회</span>
            <button
              type="button"
              onClick={onFetchLookups}
              disabled={lookupLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background disabled:opacity-50"
            >
              {lookupLoading ? "불러오는 중…" : "출고지/반품지 목록 불러오기"}
            </button>
          </div>
          {lookupError && <p className="text-xs text-warning">{lookupError}</p>}

          <SettingsSubSection title="출고지 · 배송" hint="상품이 출발하는 곳과 어떻게 보낼지" defaultOpen>
            <Field label="출고지">
              {shippingPlaces.length > 0 && (
                <select
                  value={outboundShippingPlaceCode}
                  onChange={(e) => onOutboundShippingPlaceCodeChange(e.target.value)}
                  className="mb-1.5 w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                >
                  <option value="">목록에서 선택...</option>
                  {shippingPlaces.map((p) => (
                    <option key={p.code ?? p.name} value={p.code ?? ""}>
                      {p.name} {p.code != null ? `(${p.code})` : ""}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={outboundShippingPlaceCode}
                onChange={(e) => onOutboundShippingPlaceCodeChange(e.target.value)}
                placeholder="출고지 코드 직접 입력(폴백용 — 실제 등록 때는 상품 소싱 국가에 맞는 출고지가 자동 선택됩니다)"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>

            <Field label="택배사">
              <select
                value={deliveryCompanyCode}
                onChange={(e) => onDeliveryCompanyCodeChange(e.target.value)}
                className="mb-1.5 w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              >
                <option value="">선택...</option>
                {COURIER_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.code})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={deliveryCompanyCode}
                onChange={(e) => onDeliveryCompanyCodeChange(e.target.value)}
                placeholder="목록에 없으면 코드 직접 입력"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>

            <Field label="배송방법" hint="현재 CartPilot은 해외구매대행으로만 등록합니다">
              <input
                type="text"
                value={deliveryMethod}
                onChange={(e) => onDeliveryMethodChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="배송비(원)">
              <input
                type="number"
                value={deliveryCharge}
                onChange={(e) => onDeliveryChargeChange(e.target.value)}
                placeholder="예: 19800"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="출고 소요일">
              <input
                type="number"
                value={outboundLeadTimeDays}
                onChange={(e) => onOutboundLeadTimeDaysChange(e.target.value)}
                placeholder="예: 7"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
          </SettingsSubSection>

          <SettingsSubSection title="반품 · 교환" hint="반품/교환 요청이 왔을 때 쓰는 정보">
            <Field label="반품지">
              {returnCenters.length > 0 && (
                <select
                  value={returnCenterCode}
                  onChange={(e) => onSelectReturnCenter(e.target.value)}
                  className="mb-1.5 w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                >
                  <option value="">목록에서 선택...</option>
                  {returnCenters.map((c) => (
                    <option key={c.code ?? c.name} value={c.code ?? ""}>
                      {c.name} {c.code != null ? `(${c.code})` : ""}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={returnCenterCode}
                onChange={(e) => onReturnCenterCodeChange(e.target.value)}
                placeholder="반품지 코드 직접 입력"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>

            <Field label="반품지명">
              <input
                type="text"
                value={returnChargeName}
                onChange={(e) => onReturnChargeNameChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="반품지 연락처">
              <input
                type="text"
                value={companyContactNumber}
                onChange={(e) => onCompanyContactNumberChange(e.target.value)}
                placeholder="02-1234-5678"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="반품지 우편번호">
              <input
                type="text"
                value={returnZipCode}
                onChange={(e) => onReturnZipCodeChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="반품지 주소">
              <input
                type="text"
                value={returnAddress}
                onChange={(e) => onReturnAddressChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="반품지 상세주소">
              <input
                type="text"
                value={returnAddressDetail}
                onChange={(e) => onReturnAddressDetailChange(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="반품배송비(원)">
              <input
                type="number"
                value={returnDeliveryCharge}
                onChange={(e) => onReturnDeliveryChargeChange(e.target.value)}
                placeholder="예: 25000"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="교환배송비(원)" hint="현재 쿠팡 등록 Payload에는 반영되지 않고 참고용으로만 저장됩니다">
              <input
                type="number"
                value={exchangeDeliveryCharge}
                onChange={(e) => onExchangeDeliveryChargeChange(e.target.value)}
                placeholder="예: 25000"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>
          </SettingsSubSection>

          <SaveButton onSave={onSave} saving={saving} label={saveButtonLabel} />
        </div>
      )}
    </section>
  );
}

/** Sprint A-8(추가 권장사항) — Sprint A-7 실측에서 "제조자(수입자)"가 30건 중
 * 30건을 막은 1위 블로커였다. 원본 사이트가 아니라 판매자 본인의 사업자
 * 정보라 상품마다 다시 찾을 게 아니라 여기서 한 번만 입력한다. */
function SellerInfoSection({
  manufacturer,
  onManufacturerChange,
  asContactNumber,
  onAsContactNumberChange,
  qualityGuarantee,
  onQualityGuaranteeChange,
  kcExemptionText,
  onKcExemptionTextChange,
  defaultCountryOfOrigin,
  onDefaultCountryOfOriginChange,
  onSave,
  saving,
  saveButtonLabel,
}: {
  manufacturer: string;
  onManufacturerChange: (v: string) => void;
  asContactNumber: string;
  onAsContactNumberChange: (v: string) => void;
  qualityGuarantee: string;
  onQualityGuaranteeChange: (v: string) => void;
  kcExemptionText: string;
  onKcExemptionTextChange: (v: string) => void;
  defaultCountryOfOrigin: string;
  onDefaultCountryOfOriginChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saveButtonLabel: string;
}) {
  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold text-text-primary">판매자 정보</h2>
      <p className="mt-1 text-xs text-text-secondary">사업자/인증/원산지 — 상품마다 자동 채워집니다.</p>
      <div className="mt-4 space-y-3 text-sm">
        <Field label="제조자(수입자)" hint="Sprint A-7 실측 1위 블로커 — 여기 입력하면 상품마다 자동 채워집니다">
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => onManufacturerChange(e.target.value)}
            placeholder="예: 대표님 사업자명"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="A/S 연락처" hint="비워두면 반품지 연락처를 대신 씁니다">
          <input
            type="text"
            value={asContactNumber}
            onChange={(e) => onAsContactNumberChange(e.target.value)}
            placeholder="02-1234-5678"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="품질보증기준">
          <input
            type="text"
            value={qualityGuarantee}
            onChange={(e) => onQualityGuaranteeChange(e.target.value)}
            placeholder="예: 관련 법령 및 소비자분쟁해결기준에 따름"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        {/* A-12.3-P0-2(CPO 지시) — 비워두면(기본값) 기존처럼 "인증/허가 사항"은
            사용자가 직접 입력해야 하는 상태로 남는다. 실제로 KC 인증이 법적으로
            필요한 카테고리에는 이 문구를 쓰면 안 되므로, 대표님이 직접 확인하고
            채워야 하는 값이라는 걸 hint로 명시한다. */}
        <Field
          label="인증/허가 사항 기본값 (KC 등)"
          hint="대부분의 구매대행 상품에 해당되는 문구만 넣어주세요 — 실제로 KC 인증이 필요한 상품에는 비워두고 직접 입력해야 합니다"
        >
          <input
            type="text"
            value={kcExemptionText}
            onChange={(e) => onKcExemptionTextChange(e.target.value)}
            placeholder="예: KC마크 없이 구매대행 가능한 품목"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="원산지 기본값" hint="상품 설명에서 원산지를 못 찾았을 때만 이 값을 대신 씁니다">
          <input
            type="text"
            value={defaultCountryOfOrigin}
            onChange={(e) => onDefaultCountryOfOriginChange(e.target.value)}
            placeholder="예: 중국"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <SaveButton onSave={onSave} saving={saving} label={saveButtonLabel} />
      </div>
    </section>
  );
}

/** Sprint A-11(작업1/2 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)") —
 * 상품마다 다시 정하지 않는 가격 정책 기본값. PriceEditor 최상단의 "원가 →
 * 환율 → 마진 → 최종 판매가" 자동계산이 이 값을 그대로 쓴다. */
function PricingSection({
  defaultMarginPercent,
  onDefaultMarginPercentChange,
  includeShippingInPrice,
  onIncludeShippingInPriceChange,
  priceRoundingUnit,
  onPriceRoundingUnitChange,
  onSave,
  saving,
  saveButtonLabel,
}: {
  defaultMarginPercent: string;
  onDefaultMarginPercentChange: (v: string) => void;
  includeShippingInPrice: boolean;
  onIncludeShippingInPriceChange: (v: boolean) => void;
  priceRoundingUnit: string;
  onPriceRoundingUnitChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saveButtonLabel: string;
}) {
  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold text-text-primary">가격 정책</h2>
      <p className="mt-1 text-xs text-text-secondary">마진율 · 반올림 단위 — 판매가 자동계산 기준.</p>
      <div className="mt-4 space-y-3 text-sm">
        <Field label="기본 마진율(%)" hint="비워두면 22%를 씁니다">
          <input
            type="number"
            value={defaultMarginPercent}
            onChange={(e) => onDefaultMarginPercentChange(e.target.value)}
            placeholder="예: 22"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="배송비 포함 여부" hint="켜면 자동계산에 위 배송비(원)를 더한 뒤 마진을 적용합니다">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={includeShippingInPrice}
              onChange={(e) => onIncludeShippingInPriceChange(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            판매가 자동계산에 배송비를 포함
          </label>
        </Field>
        <Field label="가격 반올림 단위" hint="최종 판매가를 이 단위로 반올림합니다(쿠팡은 10원 단위 필수)">
          <select
            value={priceRoundingUnit}
            onChange={(e) => onPriceRoundingUnitChange(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          >
            <option value="10">10원</option>
            <option value="100">100원</option>
            <option value="1000">1,000원</option>
          </select>
        </Field>
        <SaveButton onSave={onSave} saving={saving} label={saveButtonLabel} />
      </div>
    </section>
  );
}

/** Sprint A-11(작업3 — CPO 지시: "상세페이지 공통 이미지(상단/하단)") —
 * 상세설명 맨 앞/맨 뒤에 항상 붙는 고정 이미지(배송/구매대행 안내 등). 업로드는
 * 여기서 즉시 하고(uploadCommonImage), 실제 프로필 저장은 아래 "프로필 저장"
 * 버튼을 눌러야 반영된다(다른 필드와 같은 흐름 — CP001류 이중 저장 로직 방지). */
function CommonImagesSection({
  topCommonImageUrl,
  topCommonImageEnabled,
  onTopCommonImageEnabledChange,
  bottomCommonImageUrl,
  bottomCommonImageEnabled,
  onBottomCommonImageEnabledChange,
  imageUploading,
  onUploadTop,
  onUploadBottom,
  onSelectTopExisting,
  onSelectBottomExisting,
  onSave,
  saving,
  saveButtonLabel,
}: {
  topCommonImageUrl: string | null;
  topCommonImageEnabled: boolean;
  onTopCommonImageEnabledChange: (v: boolean) => void;
  bottomCommonImageUrl: string | null;
  bottomCommonImageEnabled: boolean;
  onBottomCommonImageEnabledChange: (v: boolean) => void;
  imageUploading: "top" | "bottom" | null;
  onUploadTop: (file: File) => void;
  onUploadBottom: (file: File) => void;
  onSelectTopExisting: (asset: { url: string }) => void;
  onSelectBottomExisting: (asset: { url: string }) => void;
  onSave: () => void;
  saving: boolean;
  saveButtonLabel: string;
}) {
  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="space-y-3">
        <ImagePicker
          label="상단 공통 이미지"
          hint="상세설명 이미지의 맨 앞/맨 뒤에 자동으로 붙습니다"
          imageUrl={topCommonImageUrl}
          enabled={topCommonImageEnabled}
          uploading={imageUploading === "top"}
          onEnabledChange={onTopCommonImageEnabledChange}
          onUpload={onUploadTop}
          onSelectExisting={onSelectTopExisting}
        />
        <ImagePicker
          label="하단 공통 이미지"
          hint="상세설명 이미지의 맨 앞/맨 뒤에 자동으로 붙습니다"
          imageUrl={bottomCommonImageUrl}
          enabled={bottomCommonImageEnabled}
          uploading={imageUploading === "bottom"}
          onEnabledChange={onBottomCommonImageEnabledChange}
          onUpload={onUploadBottom}
          onSelectExisting={onSelectBottomExisting}
        />
        <SaveButton onSave={onSave} saving={saving} label={saveButtonLabel} />
      </div>
    </section>
  );
}

/**
 * Sprint A-12(작업4 — CPO 지시: "Apolina 원산지 영국, 제조자 Apolina Ltd.를
 * 한 번만 입력하면 Apolina 상품은 자동 적용") — ShippingSection과 같은
 * 목록+폼 패턴이지만 매칭 단위가 브랜드명이다(isDefault 개념 없음). 원산지/
 * 제조자는 register/route.ts가 product.brand.value로 조회해 build-payload.ts의
 * 우선순위(상품 추출값 > 이 프로필 > SellerProfile 기본값)에 끼워 넣는다.
 * 브랜드소개/대표이미지/공통설명은 지금은 저장만 하고 등록 Payload에는 아직
 * 안 쓴다(상세설명 템플릿 블록화는 A-12의 다음 작업 범위).
 */
function BrandProfileSection({
  profiles,
  onChanged,
}: {
  profiles: BrandProfile[];
  onChanged: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [brandIntro, setBrandIntro] = useState("");
  const [representativeImageUrl, setRepresentativeImageUrl] = useState<string | null>(null);
  const [commonDescription, setCommonDescription] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCountryOfOrigin("");
    setManufacturer("");
    setBrandIntro("");
    setRepresentativeImageUrl(null);
    setCommonDescription("");
  }

  function startEdit(p: BrandProfile) {
    setEditingId(p.id);
    setName(p.name);
    setCountryOfOrigin(p.countryOfOrigin);
    setManufacturer(p.manufacturer);
    setBrandIntro(p.brandIntro);
    setRepresentativeImageUrl(p.representativeImageUrl);
    setCommonDescription(p.commonDescription);
    setFormOpen(true);
  }

  async function uploadRepresentativeImage(file: File) {
    setImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/coupang/common-images", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) setRepresentativeImageUrl(data.url);
    } finally {
      setImageUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name,
        countryOfOrigin: countryOfOrigin || undefined,
        manufacturer: manufacturer || undefined,
        brandIntro: brandIntro || undefined,
        representativeImageUrl,
        commonDescription: commonDescription || undefined,
      };
      const res = await fetch(
        editingId ? `/api/settings/coupang/brand-profiles/${editingId}` : "/api/settings/coupang/brand-profiles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        resetForm();
        setFormOpen(false);
        await onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/settings/coupang/brand-profiles/${id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">브랜드 프로필</h2>
        <button
          type="button"
          onClick={() => {
            if (formOpen) resetForm();
            setFormOpen((v) => !v);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background"
        >
          {formOpen ? "닫기" : "새 브랜드 만들기"}
        </button>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        브랜드별로 원산지/제조자를 한 번 등록해두면, 상품 원문에서 못 찾았을 때 이 값이 자동으로 채워집니다.
      </p>

      {profiles.length > 0 && (
        <ul className="mt-3 divide-y divide-border text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-text-primary">{p.name}</span>
                <p className="text-xs text-text-secondary">
                  원산지 {p.countryOfOrigin || "-"} · 제조자 {p.manufacturer || "-"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => startEdit(p)} className="text-xs text-text-secondary hover:underline">
                  수정
                </button>
                <button type="button" onClick={() => handleDelete(p.id)} className="text-xs text-error hover:underline">
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <Field label="브랜드명" hint="상품의 브랜드값과 정확히 일치해야 자동 적용됩니다(대소문자 무시)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: Apolina"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="원산지">
            <input
              type="text"
              value={countryOfOrigin}
              onChange={(e) => setCountryOfOrigin(e.target.value)}
              placeholder="예: 영국"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="제조자">
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="예: Apolina Ltd."
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="브랜드 소개" hint="상세설명 템플릿 블록화(다음 작업)에서 사용 예정 — 지금은 저장만 됩니다">
            <textarea
              value={brandIntro}
              onChange={(e) => setBrandIntro(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <ImagePicker
            label="대표 이미지"
            imageUrl={representativeImageUrl}
            uploading={imageUploading}
            onUpload={(file) => void uploadRepresentativeImage(file)}
            onSelectExisting={(asset) => setRepresentativeImageUrl(asset.url)}
          />
          <Field label="공통 설명" hint="상세설명 템플릿 블록화(다음 작업)에서 사용 예정 — 지금은 저장만 됩니다">
            <textarea
              value={commonDescription}
              onChange={(e) => setCommonDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "브랜드 저장"}
          </button>
        </div>
      )}
    </section>
  );
}

let nextTemplateBlockSeq = 0;
function newTemplateBlockId(): string {
  nextTemplateBlockSeq += 1;
  return `tblock-${Date.now()}-${nextTemplateBlockSeq}`;
}

function moveTemplateBlock<T>(blocks: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 섹션 하나(배송안내 등)의 텍스트/이미지 블록 리스트 편집기 — `DetailPageEditor`와
 * 같은 상호작용(↑/↓ 순서변경, 삭제, 추가)을 재사용하되 블록 종류가 텍스트/이미지
 * 2종뿐이라 on/off 체크박스는 두지 않는다(블록 삭제로 대체). */
function TemplateSectionBlockEditor({
  blocks,
  onChange,
}: {
  blocks: TemplateSectionBlock[];
  onChange: (blocks: TemplateSectionBlock[]) => void;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function updateText(id: string, content: string) {
    onChange(blocks.map((b) => (b.id === id && b.type === "text" ? { ...b, content } : b)));
  }
  function updateImageUrl(id: string, url: string) {
    onChange(blocks.map((b) => (b.id === id && b.type === "image" ? { ...b, url } : b)));
  }
  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }
  async function uploadImage(id: string, file: File) {
    setUploadingId(id);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/coupang/common-images", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) updateImageUrl(id, data.url);
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2">
      {blocks.length === 0 && <p className="text-xs text-text-tertiary">블록이 없습니다. 아래에서 추가하세요.</p>}
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded border border-border bg-surface p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-text-tertiary">
              {block.type === "text" ? "텍스트" : "이미지"} {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onChange(moveTemplateBlock(blocks, index, -1))}
                className="text-xs text-text-secondary disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === blocks.length - 1}
                onClick={() => onChange(moveTemplateBlock(blocks, index, 1))}
                className="text-xs text-text-secondary disabled:opacity-30"
              >
                ↓
              </button>
              <button type="button" onClick={() => removeBlock(block.id)} className="text-xs text-error hover:underline">
                삭제
              </button>
            </div>
          </div>
          {block.type === "text" ? (
            <textarea
              value={block.content}
              onChange={(e) => updateText(block.id, e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-border px-2 py-1 text-xs focus:border-primary focus:outline-none"
            />
          ) : (
            <div className="mt-1">
              <ImagePicker
                label=""
                imageUrl={block.url || null}
                uploading={uploadingId === block.id}
                onUpload={(file) => void uploadImage(block.id, file)}
                onSelectExisting={(asset) => updateImageUrl(block.id, asset.url)}
              />
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange([...blocks, { id: newTemplateBlockId(), type: "text", content: "" }])}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-background"
        >
          + 텍스트 추가
        </button>
        <button
          type="button"
          onClick={() => onChange([...blocks, { id: newTemplateBlockId(), type: "image", url: "" }])}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-background"
        >
          + 이미지 추가
        </button>
      </div>
    </div>
  );
}

/**
 * 상세설명 템플릿 — 배송/교환/반품/구매대행/A·S 안내처럼 상품마다 바뀌지 않는
 * 고정 문구를 한 번만 만들어둔다. AI가 만든 상품소개/특징 뒤에 자동으로 붙는다.
 *
 * Sprint 0(CEO 지시, 2026-08-07) — "설정된 거 수정할 수 있어야 하는데 없어."
 * 수정 버튼 추가 + 각 섹션을 텍스트/이미지 블록 배열로 확장(레거시 문자열
 * 필드는 백엔드에서 계속 미러로 유지되므로 이 화면은 blocks만 다룬다).
 */
function DescriptionTemplateSection({
  templates,
  onChanged,
}: {
  templates: DescriptionTemplate[];
  onChanged: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(templates.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [shippingBlocks, setShippingBlocks] = useState<TemplateSectionBlock[]>([]);
  const [exchangeBlocks, setExchangeBlocks] = useState<TemplateSectionBlock[]>([]);
  const [returnBlocks, setReturnBlocks] = useState<TemplateSectionBlock[]>([]);
  const [agentBuyBlocks, setAgentBuyBlocks] = useState<TemplateSectionBlock[]>([]);
  const [asBlocks, setAsBlocks] = useState<TemplateSectionBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteBlockedId, setDeleteBlockedId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setShippingBlocks([]);
    setExchangeBlocks([]);
    setReturnBlocks([]);
    setAgentBuyBlocks([]);
    setAsBlocks([]);
  }

  function startEdit(t: DescriptionTemplate) {
    setEditingId(t.id);
    setName(t.name);
    setShippingBlocks(t.shippingBlocks);
    setExchangeBlocks(t.exchangeBlocks);
    setReturnBlocks(t.returnBlocks);
    setAgentBuyBlocks(t.agentBuyBlocks);
    setAsBlocks(t.asBlocks);
    setDeleteBlockedId(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/settings/coupang/templates/${editingId}` : "/api/settings/coupang/templates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name || "기본",
            shippingBlocks,
            exchangeBlocks,
            returnBlocks,
            agentBuyBlocks,
            asBlocks,
          }),
        },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        // A-8 판매자 프로필에서 겪은 실수를 반복하지 않는다: 신규 생성(POST)일
        // 때만 폼을 초기화/닫는다 — 수정(PATCH) 후에는 폼을 그대로 유지해서
        // "저장했는데 내용이 사라졌다"는 착각이 안 생기게 한다.
        if (!editingId) {
          resetForm();
          setFormOpen(false);
        }
        await onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/settings/coupang/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await onChanged();
  }

  async function handleDelete(t: DescriptionTemplate) {
    if (t.isDefault && templates.length > 1) {
      setDeleteBlockedId(t.id);
      return;
    }
    await fetch(`/api/settings/coupang/templates/${t.id}`, { method: "DELETE" });
    if (editingId === t.id) resetForm();
    await onChanged();
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">상세설명 템플릿</h2>
        <button
          type="button"
          onClick={() => {
            if (formOpen) resetForm();
            setFormOpen((v) => !v);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background"
        >
          {formOpen ? "닫기" : "새 템플릿 만들기"}
        </button>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        없어도 등록은 됩니다(AI 생성 설명만 사용) — 있으면 배송/교환/반품/구매대행/A·S 안내가 자동으로 붙습니다.
      </p>

      {templates.length > 0 && (
        <ul className="mt-3 divide-y divide-border text-sm">
          {templates.map((t) => (
            <li key={t.id} className="py-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-text-primary">{t.name}</span>
                  {t.isDefault && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      기본
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(t)} className="text-xs text-text-secondary hover:underline">
                    수정
                  </button>
                  {!t.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(t.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      기본으로 설정
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(t)}
                    className="text-xs text-error hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {deleteBlockedId === t.id && (
                <p className="mt-1 text-[11px] text-error">다른 템플릿을 기본으로 설정한 후 삭제할 수 있습니다.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <Field label="템플릿 이름">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="배송안내">
            <TemplateSectionBlockEditor blocks={shippingBlocks} onChange={setShippingBlocks} />
          </Field>
          <Field label="교환안내">
            <TemplateSectionBlockEditor blocks={exchangeBlocks} onChange={setExchangeBlocks} />
          </Field>
          <Field label="반품안내">
            <TemplateSectionBlockEditor blocks={returnBlocks} onChange={setReturnBlocks} />
          </Field>
          <Field label="구매대행 안내">
            <TemplateSectionBlockEditor blocks={agentBuyBlocks} onChange={setAgentBuyBlocks} />
          </Field>
          <Field label="A/S 안내">
            <TemplateSectionBlockEditor blocks={asBlocks} onChange={setAsBlocks} />
          </Field>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "템플릿 저장"}
          </button>
        </div>
      )}
    </section>
  );
}

interface ComparisonShop {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  source: "SYSTEM" | "USER";
  isActive: boolean;
}

/**
 * Sprint B-0(CPO 지시, 2026-08-09) — 향후 가격 비교 기능(B-1+)의 기반. 이번
 * 스프린트는 크롤링/파싱 없이 "어떤 해외 편집샵을 비교 대상으로 쓸지"만
 * 관리한다. SYSTEM(추천 seed)은 활성/비활성만, USER(직접 추가)는 삭제도
 * 가능하다 — API가 이미 이 규칙을 강제하므로 UI는 버튼 노출만 그에 맞춘다.
 */
function ComparisonShopsSection() {
  const [shops, setShops] = useState<ComparisonShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/comparison-shops");
      const data = (await res.json()) as { shops?: ComparisonShop[] };
      setShops(data.shops ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd() {
    if (!urlInput.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/comparison-shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput, name: nameInput || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setUrlInput("");
        setNameInput("");
        await load();
      } else {
        setError(data.error ?? "추가에 실패했습니다.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(shop: ComparisonShop) {
    await fetch(`/api/comparison-shops/${shop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !shop.isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/comparison-shops/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold text-text-primary">편집샵 목록</h2>
      <p className="mt-1 text-xs text-text-secondary">
        체크된 사이트만 향후 가격 비교 대상이 됩니다. 추천 사이트는 삭제 대신 비활성화할 수 있습니다.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-text-tertiary">불러오는 중…</p>
      ) : shops.length === 0 ? (
        <p className="mt-3 text-xs text-text-tertiary">등록된 편집샵이 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {shops.map((shop) => (
            <li key={shop.id} className="flex items-center justify-between gap-3 py-2">
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={shop.isActive}
                  onChange={() => void handleToggleActive(shop)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <span className="font-medium text-text-primary">{shop.name}</span>
                  {shop.source === "SYSTEM" && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      추천
                    </span>
                  )}
                  <p className="text-xs text-text-secondary">
                    {shop.domain}
                    {shop.country ? ` · ${shop.country}` : ""}
                    {shop.currency ? ` · ${shop.currency}` : ""}
                  </p>
                </div>
              </label>
              {shop.source === "USER" && (
                <button
                  type="button"
                  onClick={() => void handleDelete(shop.id)}
                  className="text-xs text-error hover:underline"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
        <Field label="사이트 이름" hint="비워두면 도메인이 이름으로 사용됩니다">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="예: My Kids Boutique"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="사이트 URL">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example-shop.com"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        {error && <p className="text-xs text-error">{error}</p>}
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={adding || !urlInput.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {adding ? "추가 중…" : "편집샵 추가"}
        </button>
      </div>
    </section>
  );
}
