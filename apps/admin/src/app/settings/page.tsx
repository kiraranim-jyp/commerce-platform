"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { PlatformConnectionStatus, TemplateSectionBlock } from "@commerce/listing";
import type { ConnectionErrorType } from "@/lib/connection-error";

const TAB_KEYS = [
  "accounts",
  "shipping",
  "seller",
  "pricing",
  "brand",
  "detail",
  "comparisonShops",
  "domesticPriceSources",
  "platformStatus",
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

interface NaverAccountValues {
  clientIdMasked: string | null;
  clientSecretSaved: boolean;
  /** Sprint C-8 — API 인증에는 쓰이지 않는 표시/추적용 정보. */
  sellerId: string | null;
}

interface SellerProfile {
  id: string;
  name: string;
  isDefault: boolean;
  deliveryCompanyCode: string;
  naverDeliveryCompanyCode: string;
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

  const [naverAccount, setNaverAccount] = useState<NaverAccountValues>({
    clientIdMasked: null,
    clientSecretSaved: false,
    sellerId: null,
  });
  const [naverClientId, setNaverClientId] = useState("");
  const [naverClientSecret, setNaverClientSecret] = useState("");
  const [naverSellerId, setNaverSellerId] = useState("");
  const [naverAccountSaving, setNaverAccountSaving] = useState(false);

  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([]);

  // 4개로 흩어져 있던 <section>(계정/배송프로필/브랜드/템플릿)을 ?tab= 쿼리로 제어하는
  // 탭으로 전환한다 — useSearchParams는 정적 렌더 시 Suspense 경계가 필요해서, 이미
  // "use client"로 완전히 클라이언트 렌더되는 이 페이지에서는 window.location을 직접
  // 읽는 쪽이 더 단순하다. 탭 전환 시 언마운트하지 않고 hidden 클래스로만 감춰서 폼
  // 입력 중이던 값이 탭을 오가도 유지되게 한다.
  const [activeTab, setActiveTabState] = useState<SettingsTabKey>("accounts");
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
    const [accountRes, profilesRes, brandProfilesRes, templatesRes, naverAccountRes] = await Promise.all([
      fetch("/api/settings/coupang"),
      fetch("/api/settings/coupang/profiles"),
      fetch("/api/settings/coupang/brand-profiles"),
      fetch("/api/settings/coupang/templates"),
      fetch("/api/settings/naver"),
    ]);
    const accountData = (await accountRes.json()) as {
      configured: boolean;
      missing: string[];
      values: AccountValues;
    };
    const profilesData = (await profilesRes.json()) as { profiles: SellerProfile[] };
    const brandProfilesData = (await brandProfilesRes.json()) as { profiles: BrandProfile[] };
    const templatesData = (await templatesRes.json()) as { templates: DescriptionTemplate[] };
    const naverAccountData = (await naverAccountRes.json()) as { values: NaverAccountValues };

    setConfigured(accountData.configured);
    setMissing(accountData.missing);
    setAccount(accountData.values);
    setVendorId(accountData.values.vendorId ?? "");
    setVendorUserId(accountData.values.vendorUserId ?? "");
    setProfiles(profilesData.profiles ?? []);
    setBrandProfiles(brandProfilesData.profiles ?? []);
    setTemplates(templatesData.templates ?? []);
    setNaverAccount(naverAccountData.values);
    setNaverSellerId(naverAccountData.values.sellerId ?? "");
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

  async function handleSaveNaverAccount() {
    setNaverAccountSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/settings/naver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: naverClientId || undefined,
          clientSecret: naverClientSecret || undefined,
          // sellerId는 clientId/clientSecret과 달리 시크릿이 아니라 항상
          // 평문으로 보이는 값이라, 입력칸을 비우고 저장하면 실제로 지워져야
          // 한다 — `|| undefined`로 감싸면 "빈 값 = 변경 안 함"이 돼버려서
          // 절대 지울 수 없는 버그가 된다(account.ts saveNaverAccountSettings
          // 참고).
          sellerId: naverSellerId,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setSaveMessage(`네이버 계정 저장 실패: ${data.error}`);
        return;
      }
      setSaveMessage("네이버 계정 정보가 저장되었습니다.");
      setNaverClientId("");
      setNaverClientSecret("");
      await loadAll();
    } finally {
      setNaverAccountSaving(false);
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
      {/* N-3.13 P0(CPO 지시) — N-3.10에서 세로 사이드바로 바꿨던 것을 되돌린다.
          왼쪽 글로벌 메뉴(Dashboard/상품등록/최근 작업/이미지/설정) 옆에 이 세로
          nav가 또 생기면서 "이중 좌측 메뉴"로 보였다 — 실사용 관점에서는 화면
          공간을 불필요하게 잡아먹는 문제였다. 상단 가로 탭으로 되돌리되, N-3.10이
          우려했던 "탭 8개가 좁은 화면에서 줄바꿈되며 깨지는" 문제는 줄바꿈 대신
          가로 스크롤(overflow-x-auto + whitespace-nowrap)로 해결한다 — 탭 개수가
          늘어나도 레이아웃이 깨지지 않고 옆으로 스크롤될 뿐이다. */}
      <PageContainer size="lg">
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

        <div className="mt-6">
          <div className="overflow-x-auto">
            <Tabs
              className="flex-nowrap whitespace-nowrap"
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { value: "accounts", label: "커머스 계정 관리" },
                { value: "shipping", label: "배송 프로필" },
                { value: "seller", label: "판매자 정보" },
                { value: "pricing", label: "가격 정책" },
                { value: "brand", label: "브랜드 관리" },
                { value: "detail", label: "상세페이지 관리" },
                { value: "comparisonShops", label: "해외 편집샵" },
                { value: "domesticPriceSources", label: "국내 가격비교" },
                { value: "platformStatus", label: "플랫폼 지원 현황" },
              ]}
            />
          </div>

          <div className="mt-6 min-w-0 max-w-5xl">
            {/* N-3.14(CPO 지시: "커머스 계정 관리 통합") — 예전엔 이 화면 하나에
                (1) 상단 CommerceAccountsSection(레거시 단일 계정 카드),
                (2) 하단 MultiCommerceAccountsSection(다중 계정, 별도 SectionHeader),
                (3) 완전히 별개인 "스마트스토어" 탭(SmartStoreAccountCard)까지
                커머스 연결 관리가 3곳으로 흩어져 있었다. 실제 저장 데이터/API는
                하나도 새로 만들지 않고(기존 coupang_seller_settings 싱글톤,
                환경변수 기반 Naver, commerce_accounts 다중 계정 테이블 그대로
                재사용) 화면만 커머스별 Accordion 하나로 합친다. */}
            <div className={activeTab === "accounts" ? "" : "hidden"}>
              <SectionHeader
                title="커머스 계정 관리"
                description="연결된 커머스의 계정 정보와 연결 상태를 관리합니다."
                className="mb-3"
              />
              <CommerceAccountManager
                account={account}
                onAccountCleared={loadAll}
                accessKey={accessKey}
                setAccessKey={setAccessKey}
                secretKey={secretKey}
                setSecretKey={setSecretKey}
                vendorId={vendorId}
                setVendorId={setVendorId}
                vendorUserId={vendorUserId}
                setVendorUserId={setVendorUserId}
                handleSaveAccount={handleSaveAccount}
                accountSaving={accountSaving}
                naverAccount={naverAccount}
                naverClientId={naverClientId}
                setNaverClientId={setNaverClientId}
                naverClientSecret={naverClientSecret}
                setNaverClientSecret={setNaverClientSecret}
                naverSellerId={naverSellerId}
                setNaverSellerId={setNaverSellerId}
                handleSaveNaverAccount={handleSaveNaverAccount}
                naverAccountSaving={naverAccountSaving}
                onNaverAccountCleared={loadAll}
              />
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
              description="상품 설명 템플릿과 상단/하단 공통 이미지를 함께 관리합니다."
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
          <div className={activeTab === "domesticPriceSources" ? "mt-5" : "hidden"}>
            <SectionHeader
              title="국내 가격비교 Source"
              description="TTAEJYO 국내 가격비교의 Primary Source(사전 등록된 국내 편집샵) 후보를 관리합니다."
              className="mb-3"
            />
            <DomesticPriceSourcesSection />
          </div>
          <div className={activeTab === "platformStatus" ? "mt-5" : "hidden"}>
            <SectionHeader
              title="플랫폼 지원 현황"
              description="필드별로 SmartStore/Coupang/11번가/ESM에서 실제 지원되는 범위와, 11번가·ESM(SOON) 연동 준비 상태를 보여줍니다."
              className="mb-3"
            />
            <PlatformStatusSection />
          </div>

            <DeveloperModeSection />
          </div>
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
  // N-3.6(개정 Part A) — Naver는 출고 택배사 조회/enum API가 없다(공식 스펙 확인,
  // "택배사" 필드가 그냥 자유 문자열). Coupang의 코드 목록과 달리 정해진 값이
  // 없어 select가 아니라 텍스트 입력이다.
  const [naverDeliveryCompanyCode, setNaverDeliveryCompanyCode] = useState("");
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
    setNaverDeliveryCompanyCode("");
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
    setNaverDeliveryCompanyCode(p.naverDeliveryCompanyCode);
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
        naverDeliveryCompanyCode: naverDeliveryCompanyCode || undefined,
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
          naverDeliveryCompanyCode={naverDeliveryCompanyCode}
          onNaverDeliveryCompanyCodeChange={setNaverDeliveryCompanyCode}
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

      {/* N-3.13 Part A-2(CPO 지시: "설정값은 기본 접힘, 핵심 상태는 요약
          카드로") — 판매자정보/가격정책/상세페이지 3개 탭은 필드 몇 개짜리
          단일 폼이라 별도 목록+토글이 없었고, 그래서 탭에 들어가면 항상 폼
          전체가 펼쳐진 채로 보였다. CollapsibleSection으로 감싸고 badge에
          현재 저장된 핵심 값을 요약해서, 접힌 상태에서도 "지금 뭐가 설정돼
          있는지"는 보이게 한다(값을 고치고 싶을 때만 펼친다). */}
      <div className={activeTab === "seller" ? "mt-5" : "hidden"}>
        <CollapsibleSection
          title="판매자 정보"
          defaultOpen={false}
          badge={
            <span className="text-xs font-normal text-text-tertiary">
              {manufacturer ? `제조자: ${manufacturer}` : "미설정"}
            </span>
          }
        >
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
        </CollapsibleSection>
      </div>

      <div className={activeTab === "pricing" ? "mt-5" : "hidden"}>
        <CollapsibleSection
          title="가격 정책"
          defaultOpen={false}
          badge={
            <span className="text-xs font-normal text-text-tertiary">
              마진 {defaultMarginPercent || "22"}% · {priceRoundingUnit}원 단위 반올림
            </span>
          }
        >
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
        </CollapsibleSection>
      </div>

      {/* N-3.11 Part E — 예전에는 이 카드가 "공통 이미지"라는 별도 SectionHeader를
          달고 있어서, 사용자가 아래(DOM 순서상 뒤에 렌더되는) "상세페이지 템플릿"
          카드와 서로 다른 설정 메뉴로 오해했다(CPO 지시: "별도 설정 메뉴가 아니라
          상세페이지 템플릿 안에서 함께 관리"). 이제 독립된 헤더 없이 "상세페이지
          템플릿"의 일부(상단/하단 공통 이미지)로만 라벨링한다 — 저장 대상 테이블/
          상태는 그대로(SellerProfile), 시각적 소속만 명확히 했다. */}
      <div className={activeTab === "detail" ? "mt-5" : "hidden"}>
        <CollapsibleSection
          title="상세페이지 템플릿 — 공통 상단/하단 이미지"
          defaultOpen={false}
          badge={
            <span className="text-xs font-normal text-text-tertiary">
              {[topCommonImageEnabled && "상단 ON", bottomCommonImageEnabled && "하단 ON"].filter(Boolean).join(" · ") ||
                "미설정"}
            </span>
          }
        >
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
        </CollapsibleSection>
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
  naverDeliveryCompanyCode,
  onNaverDeliveryCompanyCodeChange,
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
  naverDeliveryCompanyCode: string;
  onNaverDeliveryCompanyCodeChange: (v: string) => void;
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

          <SettingsSubSection
            title="배송 정책 (SmartStore · Coupang 공통)"
            hint="배송비/출고 소요일은 두 플랫폼에 동일하게 적용됩니다 — 택배사만 플랫폼별로 따로 관리"
            defaultOpen
          >
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

            <Field label="택배사 (Coupang)" hint="쿠팡 API가 요구하는 코드로 저장됩니다 — 아래 SmartStore 택배사와는 별도 관리">
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

            <Field
              label="택배사 (SmartStore)"
              hint="네이버 공식 API에는 택배사 조회 기능이 없어(확인됨) 직접 입력이 필요합니다 — 예: CJ대한통운. 플랫폼별로 요구하는 코드 체계가 달라 위 쿠팡 택배사와 별도로 저장됩니다"
            >
              <input
                type="text"
                value={naverDeliveryCompanyCode}
                onChange={(e) => onNaverDeliveryCompanyCodeChange(e.target.value)}
                placeholder="예: CJ대한통운"
                className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
              />
            </Field>

            <Field label="배송방법" hint="현재 따져는 해외구매대행으로만 등록합니다">
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

          <SettingsSubSection
            title="반품/교환 정책 (SmartStore · Coupang 공통)"
            hint="반품배송비는 두 플랫폼 등록에 동일하게 적용됩니다"
          >
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
    <>
      <p className="text-xs text-text-secondary">
        사업자/인증/원산지 — 여기서 한 번만 입력하면{" "}
        <span className="font-medium text-primary">SmartStore·Coupang 등록 모두</span>에 자동으로 적용됩니다.
      </p>
      <div className="mt-3 space-y-3 text-sm">
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
    </>
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
    <>
      <p className="text-xs text-text-secondary">마진율 · 반올림 단위 — 판매가 자동계산 기준.</p>
      <div className="mt-3 space-y-3 text-sm">
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
    </>
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
    <>
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
    </>
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

interface DomesticPriceSource {
  id: string;
  name: string;
  domain: string;
  url: string;
  currency: string;
  categoryScope: string[];
  priority: "P0" | "P1" | "P2";
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: "ACTIVE" | "PAUSED" | "NOT_AVAILABLE" | "ERROR";
  lastErrorMessage: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  source: "SYSTEM" | "USER";
  enabled: boolean;
}

interface ConnectionCheckResult {
  status: PlatformConnectionStatus;
  message?: string;
  errorType?: ConnectionErrorType;
  userMessage?: string;
  nextAction?: string;
  /** N-3.75 STEP12(사용자 지시) — auth-test 라우트가 이미 계산해둔 값을
   * 그대로 보여주기만 한다(여기서 새로 판단하지 않는다). "OCI"/"FIXIE"/"NONE". */
  proxyProvider?: "OCI" | "FIXIE" | "NONE";
}

/** N-3.15 Phase 2(CPO 지시: "공통 StatusBadge") — 기존 PlatformConnectionStatus
 * (UNKNOWN/CHECKING/NOT_CONFIGURED/CONNECTED/AUTH_FAILED) 그대로 재사용하고,
 * 공통 StatusBadge 컴포넌트가 쓰는 5종 상태(success/warning/needsCheck/error/
 * neutral)로만 매핑한다 — 이 화면에서 이모지/색상을 다시 정의하지 않는다. */
const CONNECTION_STATUS_MAP: Record<PlatformConnectionStatus, { status: StatusBadgeStatus; label: string }> = {
  NOT_CONFIGURED: { status: "neutral", label: "미연결" },
  UNKNOWN: { status: "needsCheck", label: "확인 필요" },
  CHECKING: { status: "needsCheck", label: "확인 중…" },
  CONNECTED: { status: "success", label: "연결됨" },
  AUTH_FAILED: { status: "error", label: "연결 실패" },
};

/** CPO 지시 15~24 — 실패 사유를 6종 공통 타입(ConnectionErrorType)으로 분류해
 * 항상 같은 형태(무엇이 문제인지 + 다음에 뭘 하면 되는지)로 보여준다. 원본
 * 에러(HTTP status, stack 등)는 서버 로그/디버그 필드에만 남고 여기 노출하지
 * 않는다. */
function ConnectionErrorNotice({ result }: { result: ConnectionCheckResult | null }) {
  // N-3.75 STEP12(사용자 지시: "Naver ● 연결됨 / Proxy: OCI"처럼 성공 시에도
  // 어떤 프록시를 거쳤는지 보여준다") — CONNECTED일 때는 에러 배지 없이
  // proxyProvider 한 줄만 보여준다. IP/포트/자격증명은 노출하지 않는다
  // (proxyProvider 자체가 이미 host/port 없는 라벨만 담고 있다).
  if (result?.status === "CONNECTED") {
    if (!result.proxyProvider || result.proxyProvider === "NONE") return null;
    return (
      <p className="mt-2 text-[11px] text-text-tertiary">
        Proxy: {result.proxyProvider === "OCI" ? "OCI" : "Fixie"}
      </p>
    );
  }
  if (!result || result.status === "UNKNOWN" || result.status === "CHECKING") {
    return null;
  }
  const { status, label } = CONNECTION_STATUS_MAP[result.status];
  return (
    <div className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
      <StatusBadge status={status} label={label} />
      <p className="mt-1 text-text-secondary">{result.userMessage ?? result.message}</p>
      {result.nextAction && <p className="mt-1 text-text-tertiary">{result.nextAction}</p>}
      {result.proxyProvider && result.proxyProvider !== "NONE" && (
        <p className="mt-1 text-text-tertiary">Proxy: {result.proxyProvider === "OCI" ? "OCI" : "Fixie"}</p>
      )}
    </div>
  );
}

/** N-3.14(CPO 지시: "커머스 계정 관리 통합") — 설정 화면에 흩어져 있던
 * (1) 상단 단일 계정 카드(레거시 coupang_seller_settings 싱글톤 + Naver
 * 환경변수), (2) 별도 "스마트스토어" 탭(SmartStoreAccountCard), (3) 하단
 * "다중 계정" 섹션(commerce_accounts 테이블)을 커머스별 Accordion 하나로
 * 합친다. 저장 데이터/API는 하나도 새로 만들지 않는다 — 기존 3개 데이터
 * 소스를 그대로 두고 화면 구조만 통합한다(CPO 지시: "기존 데이터 삭제 금지",
 * "기존 API/DB 최대한 재사용"). 11번가/G마켓은 실제 연동이 없으므로 연결
 * 가능한 것처럼 보이지 않는 정적 행으로만 보여준다. */
function CommerceAccountManager({
  account,
  onAccountCleared,
  accessKey,
  setAccessKey,
  secretKey,
  setSecretKey,
  vendorId,
  setVendorId,
  vendorUserId,
  setVendorUserId,
  handleSaveAccount,
  accountSaving,
  naverAccount,
  naverClientId,
  setNaverClientId,
  naverClientSecret,
  setNaverClientSecret,
  naverSellerId,
  setNaverSellerId,
  handleSaveNaverAccount,
  naverAccountSaving,
  onNaverAccountCleared,
}: {
  account: AccountValues;
  onAccountCleared: () => void;
  accessKey: string;
  setAccessKey: (v: string) => void;
  secretKey: string;
  setSecretKey: (v: string) => void;
  vendorId: string;
  setVendorId: (v: string) => void;
  vendorUserId: string;
  setVendorUserId: (v: string) => void;
  handleSaveAccount: () => void;
  accountSaving: boolean;
  naverAccount: NaverAccountValues;
  naverClientId: string;
  setNaverClientId: (v: string) => void;
  naverClientSecret: string;
  setNaverClientSecret: (v: string) => void;
  naverSellerId: string;
  setNaverSellerId: (v: string) => void;
  handleSaveNaverAccount: () => void;
  naverAccountSaving: boolean;
  onNaverAccountCleared: () => void;
}) {
  const [openCommerce, setOpenCommerce] = useState<"coupang" | "naver" | null>(null);
  const [naverClearing, setNaverClearing] = useState(false);

  // 쿠팡은 저장된 계정 정보(account prop)만으로 "미연결 vs 확인 필요"를
  // 네트워크 호출 없이 판단할 수 있다 — Naver도 N-3.42부터 DB(commerce_accounts)에
  // 저장된 값이 있으면 같은 방식으로 판단한다(가짜 상태 표시 금지 원칙 — 값이
  // env var로만 설정된 경우는 클라이언트가 알 수 없어 여전히 "확인 필요"로 둔다).
  const coupangConfigured = Boolean(account.accessKeyMasked || account.vendorId);
  const naverConfigured = Boolean(naverAccount.clientIdMasked);
  const [coupangCheck, setCoupangCheck] = useState<ConnectionCheckResult | null>(null);
  const [coupangChecking, setCoupangChecking] = useState(false);
  const [coupangCheckedAt, setCoupangCheckedAt] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const [naverCheck, setNaverCheck] = useState<ConnectionCheckResult | null>(null);
  const [naverChecking, setNaverChecking] = useState(false);
  const [naverCheckedAt, setNaverCheckedAt] = useState<string | null>(null);

  const coupangHeaderStatus: PlatformConnectionStatus = coupangCheck
    ? coupangCheck.status
    : coupangConfigured
      ? "UNKNOWN"
      : "NOT_CONFIGURED";
  const naverHeaderStatus: PlatformConnectionStatus = naverCheck
    ? naverCheck.status
    : naverConfigured
      ? "UNKNOWN"
      : "NOT_CONFIGURED";

  async function checkCoupang() {
    setCoupangChecking(true);
    try {
      const res = await fetch("/api/coupang/auth-test", { method: "POST" });
      const data = (await res.json()) as ConnectionCheckResult;
      setCoupangCheck(data);
    } catch {
      setCoupangCheck({ status: "AUTH_FAILED", ...classifyNetworkErrorClient() });
    } finally {
      setCoupangCheckedAt(new Date().toISOString());
      setCoupangChecking(false);
    }
  }

  async function checkNaver() {
    setNaverChecking(true);
    try {
      const res = await fetch("/api/naver/auth-test", { method: "POST" });
      const data = (await res.json()) as ConnectionCheckResult;
      setNaverCheck(data);
    } catch {
      setNaverCheck({ status: "AUTH_FAILED", ...classifyNetworkErrorClient() });
    } finally {
      setNaverCheckedAt(new Date().toISOString());
      setNaverChecking(false);
    }
  }

  async function handleClearCoupang() {
    if (!window.confirm("쿠팡 연결 정보를 삭제하시겠습니까?\n저장된 API 연결 정보가 삭제됩니다.")) return;
    setClearing(true);
    try {
      await fetch("/api/settings/coupang", { method: "DELETE" });
      onAccountCleared();
      setCoupangCheck(null);
      setCoupangCheckedAt(null);
    } finally {
      setClearing(false);
    }
  }

  async function handleClearNaverAccount() {
    if (!window.confirm("네이버 스마트스토어 연결 정보를 삭제하시겠습니까?\n저장된 Client ID/Secret이 삭제됩니다."))
      return;
    setNaverClearing(true);
    try {
      await fetch("/api/settings/naver", { method: "DELETE" });
      onNaverAccountCleared();
      setNaverCheck(null);
      setNaverCheckedAt(null);
    } finally {
      setNaverClearing(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* 쿠팡 */}
      <CommerceAccordionShell
        label="쿠팡"
        status={coupangHeaderStatus}
        checkedAt={coupangCheckedAt}
        open={openCommerce === "coupang"}
        onToggle={() => setOpenCommerce((p) => (p === "coupang" ? null : "coupang"))}
      >
        <div className="space-y-3">
          <ConnectionErrorNotice result={coupangCheck} />
          {/* N-3.41(CPO 지시: "별도 연결 상태 카드를 만들지 않는다 — 상태는
              아코디언 제목의 배지 하나로만 보여준다") — 이전에는 CoupangConnectionPanel
              상태 카드 + "판매자 계정" 요약줄 + 토글형 수정 폼, 이렇게 3단계로
              나뉘어 있었다. 이제 연결 정보 입력 필드를 토글 없이 항상 보여주는
              평평한 폼 하나로 합친다(상태는 CommerceAccordionShell 헤더의
              StatusBadge가 전담). */}
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="mb-3 text-xs font-semibold text-text-secondary">API 연결 정보</p>
            <p className="mb-3 -mt-2 text-[11px] text-text-tertiary">
              쿠팡 Open API 인증(서명)에 쓰이는 값입니다 — 이 3개만 있으면 연결 테스트가 통과합니다.
            </p>
            <div className="space-y-3 text-sm">
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
                  placeholder={
                    account.secretKeySaved ? "•••• (변경하려면 새 값 입력)" : "새 값을 입력하지 않으면 기존 값 유지"
                  }
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
            </div>
          </div>
          {/* C-1-A(CPO 지시: "API 연결 정보와 판매자 등록정보 UI 분리") —
           * vendor_user_id(Wing 계정 ID)는 HMAC 서명/연결 테스트에는 전혀 쓰이지
           * 않지만(build-payload.ts의 CoupangPayload.vendorUserId), 실제 상품
           * 등록 시 쿠팡 API가 요구하는 필수값이라 삭제하면 LIVE 등록이 막힌다
           * (register/route.ts missingSellerConfigFields → CP005). 값은 그대로
           * 두고 "연결 정보" 카드에서만 분리해 오해를 없앤다. */}
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="mb-3 text-xs font-semibold text-text-secondary">상품 등록에 필요한 판매자 정보</p>
            <p className="mb-3 -mt-2 text-[11px] text-text-tertiary">
              API 연결(인증)에는 쓰이지 않지만, 실제 상품을 등록할 때 쿠팡이 요구하는 값입니다 — 비어 있으면 등록이
              차단됩니다.
            </p>
            <div className="space-y-3 text-sm">
              <Field label="Wing 계정 ID" hint="Wing 로그인 ID — API로 조회할 수 없어 직접 입력해야 합니다">
                <input
                  type="text"
                  value={vendorUserId}
                  onChange={(e) => setVendorUserId(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                />
              </Field>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveAccount}
                disabled={accountSaving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {accountSaving ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => void checkCoupang()}
                disabled={coupangChecking}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background disabled:opacity-50"
              >
                {coupangChecking ? "확인 중…" : "연결 테스트"}
              </button>
              <button
                type="button"
                onClick={() => void handleClearCoupang()}
                disabled={clearing}
                className="rounded-md border border-error px-4 py-2 text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
              >
                {clearing ? "삭제 중…" : "연결 정보 삭제"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text-tertiary">
              저장은 위 두 카드의 값을 한 번에 저장합니다. &ldquo;연결 정보 삭제&rdquo;는 이 화면에 저장된 값만
              지웁니다 — 배포 환경 변수로도 설정돼 있다면 계속 연결됨으로 표시될 수 있습니다.
            </p>
          </div>
        </div>
      </CommerceAccordionShell>

      {/* 네이버 스마트스토어 */}
      <CommerceAccordionShell
        label="네이버 스마트스토어"
        status={naverHeaderStatus}
        checkedAt={naverCheckedAt}
        open={openCommerce === "naver"}
        onToggle={() => setOpenCommerce((p) => (p === "naver" ? null : "naver"))}
      >
        <div className="space-y-3">
          <ConnectionErrorNotice result={naverCheck} />
          {/* N-3.42 STEP5(CPO 지시, B안 채택) — N-3.41에서는 DB 저장이 없어
              배포 환경변수 전용 안내문만 보여줬다. commerce_accounts
              (platform='naver')를 싱글톤으로 연결해 Coupang과 동일한 입력형
              폼으로 바꿨다 — getNaverCredentials()가 이 값을 우선 쓰고, 값이
              없으면 여전히 환경변수로 폴백한다(아래 안내문 그대로 유지). */}
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="mb-3 text-xs font-semibold text-text-secondary">연결 정보</p>
            <div className="space-y-3 text-sm">
              <Field
                label="Client ID"
                hint={naverAccount.clientIdMasked ? `저장됨 (${naverAccount.clientIdMasked})` : "미저장"}
              >
                <input
                  type="password"
                  value={naverClientId}
                  onChange={(e) => setNaverClientId(e.target.value)}
                  placeholder={naverAccount.clientIdMasked ?? "새 값을 입력하지 않으면 기존 값 유지"}
                  className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                />
              </Field>
              <Field label="Client Secret" hint={naverAccount.clientSecretSaved ? "저장됨" : "미저장"}>
                <input
                  type="password"
                  value={naverClientSecret}
                  onChange={(e) => setNaverClientSecret(e.target.value)}
                  placeholder={
                    naverAccount.clientSecretSaved ? "•••• (변경하려면 새 값 입력)" : "새 값을 입력하지 않으면 기존 값 유지"
                  }
                  className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                />
              </Field>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveNaverAccount}
                  disabled={naverAccountSaving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {naverAccountSaving ? "저장 중…" : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => void checkNaver()}
                  disabled={naverChecking}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background disabled:opacity-50"
                >
                  {naverChecking ? "확인 중…" : "연결 테스트"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearNaverAccount()}
                  disabled={naverClearing}
                  className="rounded-md border border-error px-4 py-2 text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
                >
                  {naverClearing ? "삭제 중…" : "연결 정보 삭제"}
                </button>
              </div>
              <p className="text-[11px] text-text-tertiary">
                네이버 계정은 배포 환경변수(SMARTSTORE_CLIENT_ID/SMARTSTORE_CLIENT_SECRET)로도 설정될 수 있습니다 —
                &ldquo;연결 정보 삭제&rdquo;는 이 화면에 저장된 값만 지웁니다. 환경 변수가 설정돼 있다면 삭제 후에도 계속
                연결됨으로 표시될 수 있습니다.
              </p>
            </div>
          </div>
          {/* Sprint C-8(CPO 지시) — Coupang의 "API 연결 정보"/"상품 등록에
           * 필요한 판매자 정보" 분리와 같은 패턴. Seller ID는 공식 문서
           * 조사(3개 독립 출처 교차검증, env.ts 주석)로 OAuth 토큰 발급
           * 파라미터가 아님이 확인됐다 — 연결 테스트/등록 게이트 어디에도
           * 쓰지 않는다. 순수 표시/추적용이라 "필수" 딱지를 붙이지 않는다. */}
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="mb-3 text-xs font-semibold text-text-secondary">판매자 정보</p>
            <div className="space-y-3 text-sm">
              <Field label="Seller ID" hint="선택 · 표시/추적용 정보이며 API 인증에는 사용되지 않습니다">
                <input
                  type="text"
                  value={naverSellerId}
                  onChange={(e) => setNaverSellerId(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
                />
              </Field>
            </div>
          </div>
        </div>
      </CommerceAccordionShell>

      {/* 11번가 / G마켓 — 실제 API 연동이 없으므로 연결 가능한 것처럼 보이지
          않는 정적 행으로만 보여준다(CPO 지시: "실제 연동이 구현되어 있지 않은
          커머스는 연결 가능한 것처럼 표시하지 않는다"). */}
      {[
        { id: "elevenst", label: "11번가" },
        { id: "gmarket", label: "G마켓" },
      ].map((commerce) => (
        <div key={commerce.id} className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-text-primary">{commerce.label}</span>
            <span className="text-xs font-medium text-text-tertiary">○ 미연결</span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            아직 지원되지 않습니다 — 실제 API 연동이 준비되면 이 화면에서 관리할 수 있습니다.
          </p>
        </div>
      ))}
    </div>
  );
}

/** fetch 자체가 실패(네트워크 예외)한 경우 클라이언트에서 최소한의 사용자
 * 메시지를 만든다 — 서버가 이미 계산해서 내려주는 것과 같은 문구를 쓰되,
 * 서버 응답조차 못 받았을 때만 쓰는 폴백이다. */
function classifyNetworkErrorClient(): { errorType: ConnectionErrorType; userMessage: string; nextAction: string } {
  return {
    errorType: "NETWORK_ERROR",
    userMessage: "커머스 서버에 연결할 수 없습니다.",
    nextAction: "커머스 서비스의 일시적인 장애일 수 있습니다. 잠시 후 다시 시도해 주세요.",
  };
}

/** 커머스 하나의 Accordion 틀 — 접힌 상태에서도 상태 배지 + 마지막 확인
 * 시각이 보여야 한다(CPO 지시: "Accordion을 닫아도 현재 연결 상태를 확인할
 * 수 있다"). 실제 데이터가 있을 때만 "마지막 확인" 문구를 보여준다(가짜 시간
 * 표시 금지). */
/** N-3.15 Phase 2(CPO 지시: "공통 Accordion") — N-3.14에서 이 카드만을 위해
 * 만들었던 자체 아코디언 구현을 걷어내고, Coupang 탭/Settings 다른 섹션이
 * 이미 쓰고 있는 공통 CollapsibleSection(components/ui)으로 바꾼다. 겉보기
 * 동작은 동일하다(펼침 상태를 부모가 제어 — CollapsibleSection의 controlled
 * 모드) — 화면/기능 변경이 아니라 같은 아코디언 패턴을 하나로 합치는
 * 리팩터다. */
function CommerceAccordionShell({
  label,
  status,
  checkedAt,
  open,
  onToggle,
  children,
}: {
  label: string;
  status: PlatformConnectionStatus;
  checkedAt: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { status: badgeStatus, label: badgeLabel } = CONNECTION_STATUS_MAP[status];
  return (
    <CollapsibleSection
      title={label}
      open={open}
      onToggle={onToggle}
      badge={
        <StatusBadge
          status={badgeStatus}
          label={badgeLabel}
          caption={checkedAt && status !== "CHECKING" ? `(마지막 확인: ${formatCheckedAtRelative(checkedAt)})` : undefined}
        />
      }
    >
      {children}
    </CollapsibleSection>
  );
}

function formatCheckedAtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  return `${Math.floor(diffMin / 60)}시간 전`;
}

/** N-3.40(CPO 지시: "커머스 계정 Settings 단일 계정 구조 정리") — 커머스당
 * 연결 계정은 1개만 있다는 원칙으로 "추가 계정" UI(commerce_accounts 다중
 * 계정 목록/추가/수정/삭제)를 화면에서 제거했다. commerce_accounts 테이블/
 * API 자체는 그대로 남아 있다(CPO 지시: "먼저 UI만 정리, DB/API 마이그레이션
 * 금지") — 기본 계정(coupang_seller_settings 싱글톤 / Naver 환경변수)은 이
 * 다중 계정 데이터를 전혀 참조하지 않으므로 제거해도 안전하다(N-3.40 STEP1
 * 확인). */

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
      <h2 className="text-base font-semibold text-text-primary">편집샵(Seller) 목록</h2>
      <p className="mt-1 text-xs text-text-secondary">
        체크된 사이트만 가격 비교 대상이 됩니다. 추천 사이트는 삭제 대신 비활성화할 수 있습니다.
      </p>
      <p className="mt-1 text-xs text-text-tertiary">
        아래 국가/통화는 참고 표시값입니다 — 실제 원본가격을 조회할 때는 이 값을 그대로 신뢰하지 않고 매번 그
        판매처의 공식 사이트 데이터로 다시 확인합니다.
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

const DOMESTIC_PRIORITY_LABEL: Record<DomesticPriceSource["priority"], string> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
};
const DOMESTIC_STRATEGY_LABEL: Record<DomesticPriceSource["collectionStrategy"], string> = {
  AUTO_API: "자동(API)",
  AUTO_SCRAPE: "자동(스크랩)",
  MANUAL: "수동",
  NOT_AVAILABLE: "수집 불가",
};

/**
 * N-4.07(대표님 지시: "후보군 리스트는 추가로 관리할수 있게 해줘") —
 * ComparisonShopsSection과 완전히 같은 구조(SYSTEM=조사 완료 후보는
 * 비활성화만, USER=직접 추가는 삭제도 가능)를 그대로 따른다. 추가로
 * priority/collectionStrategy는 관리자가 조사 결과에 맞춰 직접 조정할 수
 * 있게 드롭다운을 둔다 — 이 화면 자체는 실제 수집을 하지 않는다(메타데이터
 * CRUD만).
 */
function DomesticPriceSourcesSection() {
  const [sources, setSources] = useState<DomesticPriceSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/domestic-price-sources");
      const data = (await res.json()) as { sources?: DomesticPriceSource[] };
      setSources(data.sources ?? []);
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
      const res = await fetch("/api/domestic-price-sources", {
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

  async function handleToggleEnabled(source: DomesticPriceSource) {
    await fetch(`/api/domestic-price-sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    await load();
  }

  async function handlePriorityChange(source: DomesticPriceSource, priority: DomesticPriceSource["priority"]) {
    await fetch(`/api/domestic-price-sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    await load();
  }

  async function handleStrategyChange(
    source: DomesticPriceSource,
    collectionStrategy: DomesticPriceSource["collectionStrategy"],
  ) {
    await fetch(`/api/domestic-price-sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionStrategy }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/domestic-price-sources/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold text-text-primary">국내 편집샵 후보 목록</h2>
      <p className="mt-1 text-xs text-text-secondary">
        체크된 사이트만 국내 가격비교 Primary Source로 사용됩니다. 조사 완료 후보는 삭제 대신 비활성화할 수
        있습니다.
      </p>
      <p className="mt-1 text-xs text-text-tertiary">
        collectionStrategy는 실제 사이트 구조를 조사한 결과입니다 — 확인되지 않은 사이트를 임의로
        &quot;자동&quot;으로 표시하지 않습니다(N-4.06/N-4.07 원칙).
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-text-tertiary">불러오는 중…</p>
      ) : sources.length === 0 ? (
        <p className="mt-3 text-xs text-text-tertiary">등록된 편집샵이 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {sources.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-3 py-2">
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={() => void handleToggleEnabled(source)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <span className="font-medium text-text-primary">{source.name}</span>
                  {source.source === "SYSTEM" && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      조사완료
                    </span>
                  )}
                  <p className="text-xs text-text-secondary">
                    {source.domain} · {source.currency}
                    {source.categoryScope.length > 0 ? ` · ${source.categoryScope.join(", ")}` : ""}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {source.collectionStrategy === "AUTO_API" || source.collectionStrategy === "AUTO_SCRAPE" ? "🟢" : "🟡"}{" "}
                    {DOMESTIC_STRATEGY_LABEL[source.collectionStrategy]} · 마지막 확인{" "}
                    {source.lastCheckedAt ? new Date(source.lastCheckedAt).toLocaleString("ko-KR") : "-"}
                  </p>
                  {source.lastErrorMessage && (
                    <p className="text-xs text-error">최근 오류: {source.lastErrorMessage}</p>
                  )}
                </div>
              </label>
              <select
                value={source.priority}
                onChange={(e) => void handlePriorityChange(source, e.target.value as DomesticPriceSource["priority"])}
                className="rounded-md border border-border px-2 py-1 text-xs"
              >
                {(Object.keys(DOMESTIC_PRIORITY_LABEL) as DomesticPriceSource["priority"][]).map((p) => (
                  <option key={p} value={p}>
                    {DOMESTIC_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <select
                value={source.collectionStrategy}
                onChange={(e) =>
                  void handleStrategyChange(source, e.target.value as DomesticPriceSource["collectionStrategy"])
                }
                className="rounded-md border border-border px-2 py-1 text-xs"
              >
                {(Object.keys(DOMESTIC_STRATEGY_LABEL) as DomesticPriceSource["collectionStrategy"][]).map((s) => (
                  <option key={s} value={s}>
                    {DOMESTIC_STRATEGY_LABEL[s]}
                  </option>
                ))}
              </select>
              {source.source === "USER" && (
                <button
                  type="button"
                  onClick={() => void handleDelete(source.id)}
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
            placeholder="예: 룩스루"
            className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
          />
        </Field>
        <Field label="사이트 URL">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example-shop.co.kr"
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

type CapabilityLevel = "SUPPORTED" | "PARTIAL" | "NOT_APPLICABLE" | "SOON";
type FieldOwnership = "COMMON" | "MAPPED" | "SMARTSTORE_ONLY" | "COUPANG_ONLY";

interface FieldCapabilityRow {
  field: string;
  label: string;
  ownership: FieldOwnership;
  smartstore: CapabilityLevel;
  coupang: CapabilityLevel;
  elevenst: CapabilityLevel;
  esm: CapabilityLevel;
  note: string;
}

type SoonConnectionStatus = "NOT_CONFIGURED" | "READY_FOR_CONNECTION" | "NOT_AVAILABLE";

interface SoonStatusEntry {
  id: string;
  label: string;
  status: SoonConnectionStatus;
}

interface PlatformStatusResponse {
  ok: boolean;
  capabilityMatrix: FieldCapabilityRow[];
  soon: SoonStatusEntry[];
}

const CAPABILITY_LEVEL_LABEL: Record<CapabilityLevel, string> = {
  SUPPORTED: "🟢 지원",
  PARTIAL: "🟡 부분지원",
  NOT_APPLICABLE: "— 해당없음",
  SOON: "⏳ 준비중",
};

const OWNERSHIP_LABEL: Record<FieldOwnership, string> = {
  COMMON: "공통 필드",
  MAPPED: "매핑됨(구조 다름)",
  SMARTSTORE_ONLY: "SmartStore 전용",
  COUPANG_ONLY: "Coupang 전용",
};

const SOON_STATUS_LABEL: Record<SoonConnectionStatus, string> = {
  NOT_CONFIGURED: "🟡 인증정보 미설정",
  READY_FOR_CONNECTION: "🟢 연결 준비완료",
  NOT_AVAILABLE: "⚪ 공식 API 스펙 미확보(연동 불가)",
};

function capabilityCellClass(level: CapabilityLevel): string {
  if (level === "SUPPORTED") return "text-success";
  if (level === "PARTIAL") return "text-warning";
  return "text-text-tertiary";
}

/**
 * N-4.08-6/7(대표님 지시) — FIELD_CAPABILITY_MATRIX(코드 검증 기반, 12개
 * 필드×4마켓)와 11번가/ESM SOON 연결 상태를 그대로 보여준다. 이 화면 자체는
 * 읽기 전용이며 11번가/ESM에 실제 API를 호출하지 않는다 — /api/platform-status가
 * 반환하는 값도 두 어댑터의 하드코딩된 API_SPEC_CONFIRMED=false로 인해 항상
 * NOT_AVAILABLE이다(공식 스펙 확보 전까지는 정직하게 이 상태를 유지).
 */
function PlatformStatusSection() {
  const [data, setData] = useState<PlatformStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/platform-status");
        const json = (await res.json()) as PlatformStatusResponse;
        setData(json);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <p className="text-xs text-text-tertiary">불러오는 중…</p>;
  if (!data) return <p className="text-xs text-error">불러오지 못했습니다.</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <h2 className="text-base font-semibold text-text-primary">11번가 / G마켓·옥션(ESM) 연결 준비</h2>
        <p className="mt-1 text-xs text-text-secondary">
          두 마켓 모두 공식 API 스펙 문서를 아직 확보하지 못해 실제 등록 연동은 하지 않습니다 — 이 화면은
          상태 표시 전용이며 실제 API를 호출하지 않습니다.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {data.soon.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-text-primary">{entry.label}</span>
              <span className="text-xs text-text-secondary">{SOON_STATUS_LABEL[entry.status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <h2 className="text-base font-semibold text-text-primary">필드별 마켓 지원 현황</h2>
        <p className="mt-1 text-xs text-text-secondary">
          실제 등록 Payload 빌더 코드를 기준으로 분류했습니다(추정 아님).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-tertiary">
                <th className="py-2 pr-3 font-medium">필드</th>
                <th className="py-2 pr-3 font-medium">분류</th>
                <th className="py-2 pr-3 font-medium">SmartStore</th>
                <th className="py-2 pr-3 font-medium">Coupang</th>
                <th className="py-2 pr-3 font-medium">11번가</th>
                <th className="py-2 pr-3 font-medium">ESM</th>
                <th className="py-2 font-medium">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.capabilityMatrix.map((row) => (
                <tr key={row.field}>
                  <td className="py-2 pr-3 font-medium text-text-primary">{row.label}</td>
                  <td className="py-2 pr-3 text-text-secondary">{OWNERSHIP_LABEL[row.ownership]}</td>
                  <td className={`py-2 pr-3 ${capabilityCellClass(row.smartstore)}`}>
                    {CAPABILITY_LEVEL_LABEL[row.smartstore]}
                  </td>
                  <td className={`py-2 pr-3 ${capabilityCellClass(row.coupang)}`}>
                    {CAPABILITY_LEVEL_LABEL[row.coupang]}
                  </td>
                  <td className={`py-2 pr-3 ${capabilityCellClass(row.elevenst)}`}>
                    {CAPABILITY_LEVEL_LABEL[row.elevenst]}
                  </td>
                  <td className={`py-2 pr-3 ${capabilityCellClass(row.esm)}`}>{CAPABILITY_LEVEL_LABEL[row.esm]}</td>
                  <td className="py-2 text-text-tertiary">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
