"use client";

import { useEffect, useState } from "react";

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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-text-secondary">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <a href="/pipeline" className="text-sm text-text-secondary hover:text-text-primary">
        ← CartPilot
      </a>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">설정</h1>
      <p className="mt-1 text-sm text-text-secondary">
        여기서 한 번 만들어두면 상품을 등록할 때마다 다시 입력하지 않아도 됩니다.
      </p>

      <div
        className={`mt-4 rounded-md p-3 text-sm ${
          configured ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
        }`}
      >
        {configured
          ? "✓ 쿠팡 등록에 필요한 설정이 모두 준비되어 있습니다."
          : `⚠ 아직 준비되지 않은 항목: ${missing.join(", ")}`}
      </div>
      {saveMessage && <p className="mt-2 text-xs text-text-secondary">{saveMessage}</p>}

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-subtle">
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

      <SellerProfileSection profiles={profiles} onChanged={loadAll} />
      <BrandProfileSection profiles={brandProfiles} onChanged={loadAll} />
      <DescriptionTemplateSection templates={templates} onChanged={loadAll} />
    </main>
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

/** Sprint A-11(작업3) — 파일 선택 즉시 업로드해서 미리보기+URL을 보여주고,
 * ON/OFF 토글로 실제 등록 payload에 넣을지 정한다. */
function CommonImageField({
  label,
  imageUrl,
  enabled,
  uploading,
  onEnabledChange,
  onUpload,
}: {
  label: string;
  imageUrl: string | null;
  enabled: boolean;
  uploading: boolean;
  onEnabledChange: (v: boolean) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <Field label={label} hint="상세설명 이미지의 맨 앞/맨 뒤에 자동으로 붙습니다">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-16 w-16 rounded border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-[10px] text-text-tertiary">
            없음
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
            className="text-xs text-text-secondary file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
          />
          {uploading && <span className="text-[11px] text-text-tertiary">업로드 중…</span>}
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!imageUrl}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            사용 (ON)
          </label>
        </div>
      </div>
    </Field>
  );
}

/**
 * 배송 프로필 — 목록(이름 + 기본 배지 + 기본으로 설정/삭제)과 "새 프로필 만들기"
 * 폼을 함께 보여준다. 처음(프로필이 하나도 없을 때)에는 폼이 항상 펼쳐져 있어서
 * "최초 1회 생성" 흐름이 자연스럽게 이어진다.
 */
function SellerProfileSection({ profiles, onChanged }: { profiles: SellerProfile[]; onChanged: () => Promise<void> }) {
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

  function startEdit(p: SellerProfile) {
    setEditingId(p.id);
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
    setDefaultMarginPercent(p.defaultMarginPercent != null ? String(p.defaultMarginPercent) : "");
    setIncludeShippingInPrice(p.includeShippingInPrice);
    setPriceRoundingUnit(p.priceRoundingUnit != null ? String(p.priceRoundingUnit) : "10");
    setDefaultCountryOfOrigin(p.defaultCountryOfOrigin);
    setTopCommonImageUrl(p.topCommonImageUrl);
    setTopCommonImageEnabled(p.topCommonImageEnabled);
    setBottomCommonImageUrl(p.bottomCommonImageUrl);
    setBottomCommonImageEnabled(p.bottomCommonImageEnabled);
    setFormOpen(true);
  }

  async function uploadCommonImage(position: "top" | "bottom", file: File) {
    setImageUploading(position);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/coupang/common-images", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) {
        if (position === "top") setTopCommonImageUrl(data.url);
        else setBottomCommonImageUrl(data.url);
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
        resetForm();
        setFormOpen(false);
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

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">배송 프로필</h2>
        <button
          type="button"
          onClick={() => {
            if (formOpen) resetForm();
            setFormOpen((v) => !v);
          }}
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
                  onClick={() => startEdit(p)}
                  className="text-xs text-text-secondary hover:underline"
                >
                  수정
                </button>
                {!p.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(p.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    기본으로 설정
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
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
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">출고지/반품지 자동 조회</span>
            <button
              type="button"
              onClick={fetchLookups}
              disabled={lookupLoading}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background disabled:opacity-50"
            >
              {lookupLoading ? "불러오는 중…" : "출고지/반품지 목록 불러오기"}
            </button>
          </div>
          {lookupError && <p className="text-xs text-warning">{lookupError}</p>}

          <Field label="출고지">
            {shippingPlaces.length > 0 && (
              <select
                value={outboundShippingPlaceCode}
                onChange={(e) => setOutboundShippingPlaceCode(e.target.value)}
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
              onChange={(e) => setOutboundShippingPlaceCode(e.target.value)}
              placeholder="출고지 코드 직접 입력(폴백용 — 실제 등록 때는 상품 소싱 국가에 맞는 출고지가 자동 선택됩니다)"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="반품지">
            {returnCenters.length > 0 && (
              <select
                value={returnCenterCode}
                onChange={(e) => selectReturnCenter(e.target.value)}
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
              onChange={(e) => setReturnCenterCode(e.target.value)}
              placeholder="반품지 코드 직접 입력"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="반품지명">
            <input
              type="text"
              value={returnChargeName}
              onChange={(e) => setReturnChargeName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품지 연락처">
            <input
              type="text"
              value={companyContactNumber}
              onChange={(e) => setCompanyContactNumber(e.target.value)}
              placeholder="02-1234-5678"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품지 우편번호">
            <input
              type="text"
              value={returnZipCode}
              onChange={(e) => setReturnZipCode(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품지 주소">
            <input
              type="text"
              value={returnAddress}
              onChange={(e) => setReturnAddress(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품지 상세주소">
            <input
              type="text"
              value={returnAddressDetail}
              onChange={(e) => setReturnAddressDetail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label="택배사">
            <select
              value={deliveryCompanyCode}
              onChange={(e) => setDeliveryCompanyCode(e.target.value)}
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
              onChange={(e) => setDeliveryCompanyCode(e.target.value)}
              placeholder="목록에 없으면 코드 직접 입력"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          {/* Sprint A-8(작업1/5) — 상품마다 다시 입력하지 않는 배송 정책 기본값.
              등록 Editor의 "배송 정책"/"반품/교환" 카드가 이 값을 그대로 보여준다. */}
          <p className="border-t border-border pt-3 text-xs font-medium text-text-secondary">배송 정책 기본값</p>
          <Field label="배송방법" hint="현재 CartPilot은 해외구매대행으로만 등록합니다">
            <input
              type="text"
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="배송비(원)">
            <input
              type="number"
              value={deliveryCharge}
              onChange={(e) => setDeliveryCharge(e.target.value)}
              placeholder="예: 19800"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품배송비(원)">
            <input
              type="number"
              value={returnDeliveryCharge}
              onChange={(e) => setReturnDeliveryCharge(e.target.value)}
              placeholder="예: 25000"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="교환배송비(원)" hint="현재 쿠팡 등록 Payload에는 반영되지 않고 참고용으로만 저장됩니다">
            <input
              type="number"
              value={exchangeDeliveryCharge}
              onChange={(e) => setExchangeDeliveryCharge(e.target.value)}
              placeholder="예: 25000"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="출고 소요일">
            <input
              type="number"
              value={outboundLeadTimeDays}
              onChange={(e) => setOutboundLeadTimeDays(e.target.value)}
              placeholder="예: 7"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          {/* Sprint A-8(추가 권장사항) — Sprint A-7 실측에서 "제조자(수입자)"가
              30건 중 30건을 막은 1위 블로커였다. 원본 사이트가 아니라 판매자
              본인의 사업자 정보라 상품마다 다시 찾을 게 아니라 여기서 한 번만
              입력한다. */}
          <p className="border-t border-border pt-3 text-xs font-medium text-text-secondary">판매자 기본정보</p>
          <Field label="제조자(수입자)" hint="Sprint A-7 실측 1위 블로커 — 여기 입력하면 상품마다 자동 채워집니다">
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="예: 대표님 사업자명"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="A/S 연락처" hint="비워두면 반품지 연락처를 대신 씁니다">
            <input
              type="text"
              value={asContactNumber}
              onChange={(e) => setAsContactNumber(e.target.value)}
              placeholder="02-1234-5678"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="품질보증기준">
            <input
              type="text"
              value={qualityGuarantee}
              onChange={(e) => setQualityGuarantee(e.target.value)}
              placeholder="예: 관련 법령 및 소비자분쟁해결기준에 따름"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="원산지 기본값" hint="상품 설명에서 원산지를 못 찾았을 때만 이 값을 대신 씁니다">
            <input
              type="text"
              value={defaultCountryOfOrigin}
              onChange={(e) => setDefaultCountryOfOrigin(e.target.value)}
              placeholder="예: 중국"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>

          {/* Sprint A-11(작업1/2 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)")
              — 상품마다 다시 정하지 않는 가격 정책 기본값. PriceEditor 최상단의
              "원가 → 환율 → 마진 → 최종 판매가" 자동계산이 이 값을 그대로 쓴다. */}
          <p className="border-t border-border pt-3 text-xs font-medium text-text-secondary">가격 정책</p>
          <Field label="기본 마진율(%)" hint="비워두면 22%를 씁니다">
            <input
              type="number"
              value={defaultMarginPercent}
              onChange={(e) => setDefaultMarginPercent(e.target.value)}
              placeholder="예: 22"
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="배송비 포함 여부" hint="켜면 자동계산에 위 배송비(원)를 더한 뒤 마진을 적용합니다">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={includeShippingInPrice}
                onChange={(e) => setIncludeShippingInPrice(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              판매가 자동계산에 배송비를 포함
            </label>
          </Field>
          <Field label="가격 반올림 단위" hint="최종 판매가를 이 단위로 반올림합니다(쿠팡은 10원 단위 필수)">
            <select
              value={priceRoundingUnit}
              onChange={(e) => setPriceRoundingUnit(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            >
              <option value="10">10원</option>
              <option value="100">100원</option>
              <option value="1000">1,000원</option>
            </select>
          </Field>

          {/* Sprint A-11(작업3 — CPO 지시: "상세페이지 공통 이미지(상단/하단)")
              — 상세설명 맨 앞/맨 뒤에 항상 붙는 고정 이미지(배송/구매대행 안내
              등). 업로드는 여기서 즉시 하고(uploadCommonImage), 실제 프로필
              저장은 아래 "프로필 저장" 버튼을 눌러야 반영된다(다른 필드와 같은
              흐름 — CP001류 이중 저장 로직 방지). */}
          <p className="border-t border-border pt-3 text-xs font-medium text-text-secondary">상세페이지 공통 이미지</p>
          <CommonImageField
            label="상단 공통 이미지"
            imageUrl={topCommonImageUrl}
            enabled={topCommonImageEnabled}
            uploading={imageUploading === "top"}
            onEnabledChange={setTopCommonImageEnabled}
            onUpload={(file) => uploadCommonImage("top", file)}
          />
          <CommonImageField
            label="하단 공통 이미지"
            imageUrl={bottomCommonImageUrl}
            enabled={bottomCommonImageEnabled}
            uploading={imageUploading === "bottom"}
            onEnabledChange={setBottomCommonImageEnabled}
            onUpload={(file) => uploadCommonImage("bottom", file)}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "프로필 저장"}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Sprint A-12(작업4 — CPO 지시: "Apolina 원산지 영국, 제조자 Apolina Ltd.를
 * 한 번만 입력하면 Apolina 상품은 자동 적용") — SellerProfileSection과 같은
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
          <Field label="대표 이미지">
            <div className="flex items-center gap-3">
              {representativeImageUrl ? (
                <img
                  src={representativeImageUrl}
                  alt="브랜드 대표 이미지"
                  className="h-16 w-16 rounded border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-[10px] text-text-tertiary">
                  없음
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={imageUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadRepresentativeImage(file);
                  e.target.value = "";
                }}
                className="text-xs text-text-secondary file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
              />
            </div>
          </Field>
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

/**
 * 상세설명 템플릿 — 배송/교환/반품/구매대행/A·S 안내처럼 상품마다 바뀌지 않는
 * 고정 문구를 한 번만 만들어둔다. AI가 만든 상품소개/특징 뒤에 자동으로 붙는다.
 */
function DescriptionTemplateSection({
  templates,
  onChanged,
}: {
  templates: DescriptionTemplate[];
  onChanged: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(templates.length === 0);
  const [name, setName] = useState("");
  const [shippingInfo, setShippingInfo] = useState("");
  const [exchangeInfo, setExchangeInfo] = useState("");
  const [returnInfo, setReturnInfo] = useState("");
  const [agentBuyInfo, setAgentBuyInfo] = useState("");
  const [asInfo, setAsInfo] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/coupang/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "기본",
          shippingInfo: shippingInfo || undefined,
          exchangeInfo: exchangeInfo || undefined,
          returnInfo: returnInfo || undefined,
          agentBuyInfo: agentBuyInfo || undefined,
          asInfo: asInfo || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setName("");
        setFormOpen(false);
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

  async function handleDelete(id: string) {
    await fetch(`/api/settings/coupang/templates/${id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">상세설명 템플릿</h2>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
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
            <li key={t.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-text-primary">{t.name}</span>
                {t.isDefault && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    기본
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                  onClick={() => handleDelete(t.id)}
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
            <textarea
              value={shippingInfo}
              onChange={(e) => setShippingInfo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="교환안내">
            <textarea
              value={exchangeInfo}
              onChange={(e) => setExchangeInfo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="반품안내">
            <textarea
              value={returnInfo}
              onChange={(e) => setReturnInfo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="구매대행 안내">
            <textarea
              value={agentBuyInfo}
              onChange={(e) => setAgentBuyInfo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="A/S 안내">
            <textarea
              value={asInfo}
              onChange={(e) => setAsInfo(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "저장 중…" : "템플릿 저장"}
          </button>
        </div>
      )}
    </section>
  );
}
