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

interface SettingsValues {
  accessKeyMasked: string | null;
  secretKeySaved: boolean;
  vendorId: string | null;
  vendorUserId: string | null;
  deliveryCompanyCode: string | null;
  returnCenterCode: string | null;
  returnChargeName: string | null;
  companyContactNumber: string | null;
  returnZipCode: string | null;
  returnAddress: string | null;
  returnAddressDetail: string | null;
  outboundShippingPlaceCode: number | null;
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
 * 쿠팡 판매자 계정 설정 — 최초 1회만 저장하면 이후 등록 때마다 다시 입력하지
 * 않는다(Supabase coupang_seller_settings 테이블에 저장, 등록 API가 자동으로
 * 이 값을 읽어 쓴다). 시크릿(access/secret key)은 저장된 값을 다시 평문으로
 * 보여주지 않는다 — 비워두고 저장하면 "변경 안 함"으로 처리되어 기존 값이 유지된다.
 */
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);

  const [accessKeyMasked, setAccessKeyMasked] = useState<string | null>(null);
  const [secretKeySaved, setSecretKeySaved] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorUserId, setVendorUserId] = useState("");
  const [deliveryCompanyCode, setDeliveryCompanyCode] = useState("");
  const [returnCenterCode, setReturnCenterCode] = useState("");
  const [returnChargeName, setReturnChargeName] = useState("");
  const [companyContactNumber, setCompanyContactNumber] = useState("");
  const [returnZipCode, setReturnZipCode] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  const [returnAddressDetail, setReturnAddressDetail] = useState("");
  const [outboundShippingPlaceCode, setOutboundShippingPlaceCode] = useState("");

  const [shippingPlaces, setShippingPlaces] = useState<ShippingPlaceOption[]>([]);
  const [returnCenters, setReturnCenters] = useState<ReturnCenterOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  function applySettingsResponse(data: { configured: boolean; missing: string[]; values: SettingsValues }) {
    setConfigured(data.configured);
    setMissing(data.missing);
    setAccessKeyMasked(data.values.accessKeyMasked);
    setSecretKeySaved(data.values.secretKeySaved);
    setVendorId(data.values.vendorId ?? "");
    setVendorUserId(data.values.vendorUserId ?? "");
    setDeliveryCompanyCode(data.values.deliveryCompanyCode ?? "");
    setReturnCenterCode(data.values.returnCenterCode ?? "");
    setReturnChargeName(data.values.returnChargeName ?? "");
    setCompanyContactNumber(data.values.companyContactNumber ?? "");
    setReturnZipCode(data.values.returnZipCode ?? "");
    setReturnAddress(data.values.returnAddress ?? "");
    setReturnAddressDetail(data.values.returnAddressDetail ?? "");
    setOutboundShippingPlaceCode(
      data.values.outboundShippingPlaceCode != null ? String(data.values.outboundShippingPlaceCode) : "",
    );
  }

  /** 저장 후 재조회(handleSave)에서 쓰는 재사용 가능한 버전 — 이벤트 핸들러 안에서
   * 호출되므로 아래 마운트 useEffect와 달리 그대로 async 함수를 호출해도 된다. */
  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/coupang");
      const data = (await res.json()) as { configured: boolean; missing: string[]; values: SettingsValues };
      applySettingsResponse(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/coupang")
      .then((res) => res.json())
      .then((data: { configured: boolean; missing: string[]; values: SettingsValues }) => {
        if (!cancelled) applySettingsResponse(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 쿠팡 API 키가 저장된 뒤에만 성공한다 — 아직 안 됐으면 에러 메시지를 보여주고
   * 아래 입력칸에 코드를 직접 입력할 수 있게 둔다(막지 않는다). */
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
          deliveryCompanyCode: deliveryCompanyCode || undefined,
          returnCenterCode: returnCenterCode || undefined,
          returnChargeName: returnChargeName || undefined,
          companyContactNumber: companyContactNumber || undefined,
          returnZipCode: returnZipCode || undefined,
          returnAddress: returnAddress || undefined,
          returnAddressDetail: returnAddressDetail || undefined,
          outboundShippingPlaceCode: outboundShippingPlaceCode ? Number(outboundShippingPlaceCode) : undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; configured?: boolean; missing?: string[] };
      if (!data.ok) {
        setSaveMessage(`저장 실패: ${data.error}`);
        return;
      }
      setSaveMessage("저장되었습니다.");
      setAccessKey("");
      setSecretKey("");
      await loadSettings();
    } finally {
      setSaving(false);
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
        여기서 한 번 저장하면 상품을 등록할 때마다 다시 입력하지 않아도 됩니다.
      </p>

      <div
        className={`mt-4 rounded-md p-3 text-sm ${
          configured ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
        }`}
      >
        {configured
          ? "✓ 쿠팡 등록에 필요한 설정이 모두 저장되어 있습니다."
          : `⚠ 아직 저장되지 않은 항목: ${missing.join(", ")}`}
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <h2 className="text-base font-semibold text-text-primary">쿠팡 API</h2>
        <div className="mt-3 space-y-3 text-sm">
          <Field label="Access Key" hint={accessKeyMasked ? `저장됨 (${accessKeyMasked})` : "미저장"}>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder={accessKeyMasked ?? "새 값을 입력하지 않으면 기존 값 유지"}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="Secret Key" hint={secretKeySaved ? "저장됨" : "미저장"}>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={secretKeySaved ? "•••• (변경하려면 새 값 입력)" : "새 값을 입력하지 않으면 기존 값 유지"}
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
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">쿠팡 배송설정</h2>
          <button
            type="button"
            onClick={fetchLookups}
            disabled={lookupLoading}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-background disabled:opacity-50"
          >
            {lookupLoading ? "불러오는 중…" : "출고지/반품지 목록 불러오기"}
          </button>
        </div>
        {lookupError && <p className="mt-2 text-xs text-warning">{lookupError}</p>}

        <div className="mt-3 space-y-3 text-sm">
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
              placeholder="출고지 코드 직접 입력"
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

          <Field label="Wing 계정 ID">
            <input
              type="text"
              value={vendorUserId}
              onChange={(e) => setVendorUserId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        {saveMessage && <p className="text-sm text-text-secondary">{saveMessage}</p>}
      </div>
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
