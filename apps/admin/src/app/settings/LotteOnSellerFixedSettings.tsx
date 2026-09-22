"use client";

import { useEffect, useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-02 ①(CEO 확정, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 롯데ON 판매자 «고정값» 을 한 번만 정하는 자리.
 *
 * 왜 생겼나. 롯데ON 등록을 막는 필드 중 넷이 판매자센터에 «선등록» 돼 있어야
 * 하는 번호다(출고지 · 반품지 · 배송비정책 · 배송가능지역). 우리가 만들 수
 * 없고, 판매자가 바꾸지 않는 한 상품마다 달라지지도 않는다. 그런데 저장할 곳이
 * 없어서 상품별 폼에만 살았고 — 매 상품마다 다시 골라야 했다.
 *
 * 🔴 **숫자를 입력받지 않는다.** 롯데ON Master(150/166/89)가 준 목록에서
 * 「서울 ○○센터」를 고르게 하고, 번호와 그 표시이름을 함께 저장한다. 셀러가
 * 외워야 하는 것은 이름이지 번호가 아니다. payload 로 나가는 것은 번호뿐이다.
 *
 * 🔴 목록을 못 불러오면 **아무것도 만들지 않는다.** 연결이 끊긴 동안 빈
 * 드롭다운을 자유 입력칸으로 바꿔 주면 셀러가 없는 번호를 적을 수 있다 —
 * 그 값은 등록 직전에야 거절된다. 대신 지금 저장돼 있는 값이 무엇인지는
 * 그대로 보여준다(목록 없이도 읽을 수 있다).
 *
 * 🔴 `impPrxCd`(수입대행코드)는 여기 없다. 058 에 컬럼은 있지만 그 코드값이
 * 롯데ON API 응답으로 확인된 것이 아니라 우리 코드 주석에서 온 것이다 —
 * CEO 판정으로 contract 확인 전까지 HOLD 다.
 */

interface MasterOption {
  /** 저장되는 값(출고지/반품지/정책은 `no`, 지역은 `code`). */
  value: string;
  /** 사람이 읽는 이름. */
  label: string;
}

interface SellerFixedValues {
  outboundPlaceNo: string | null;
  outboundPlaceLabel: string | null;
  returnPlaceNo: string | null;
  returnPlaceLabel: string | null;
  deliveryCostPolicyNo: string | null;
  deliveryCostPolicyLabel: string | null;
  deliveryRegionGroupCode: string | null;
  deliveryRegionGroupLabel: string | null;
  weekdayCloseTime: string | null;
  saturdayCloseTime: string | null;
}

const EMPTY: SellerFixedValues = {
  outboundPlaceNo: null,
  outboundPlaceLabel: null,
  returnPlaceNo: null,
  returnPlaceLabel: null,
  deliveryCostPolicyNo: null,
  deliveryCostPolicyLabel: null,
  deliveryRegionGroupCode: null,
  deliveryRegionGroupLabel: null,
  weekdayCloseTime: null,
  saturdayCloseTime: null,
};

/** 네 칸의 정의를 한 곳에만 둔다 — 값 키와 이름 키가 어긋나면 화면과 저장이 갈린다. */
const PLACE_FIELDS = [
  {
    valueKey: "outboundPlaceNo",
    labelKey: "outboundPlaceLabel",
    title: "출고지",
    hint: "롯데ON 판매자센터에 등록된 출고지에서 고릅니다.",
    source: "outboundPlaces",
  },
  {
    valueKey: "returnPlaceNo",
    labelKey: "returnPlaceLabel",
    title: "반품지",
    hint: "회수지로 등록된 곳에서 고릅니다.",
    source: "returnPlaces",
  },
  {
    valueKey: "deliveryCostPolicyNo",
    labelKey: "deliveryCostPolicyLabel",
    title: "배송비 정책",
    hint: "판매자센터에 등록된 배송비 정책에서 고릅니다.",
    source: "costPolicies",
  },
  {
    valueKey: "deliveryRegionGroupCode",
    labelKey: "deliveryRegionGroupLabel",
    title: "배송 가능 지역",
    hint: "롯데ON 공통코드에서 고릅니다.",
    source: "deliveryRegionGroups",
  },
] as const;

/** HH24MI 네 자리만 저장된다(서버가 같은 규칙으로 한 번 더 거른다). */
const CLOSE_TIME_FIELDS = [
  { key: "weekdayCloseTime", title: "평일 발송마감", placeholder: "1400" },
  { key: "saturdayCloseTime", title: "토요일 발송마감", placeholder: "1200" },
] as const;

export function LotteOnSellerFixedSettings() {
  const [values, setValues] = useState<SellerFixedValues>(EMPTY);
  const [master, setMaster] = useState<Record<string, MasterOption[]> | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/lotteon-seller");
        const data = (await res.json()) as { ok?: boolean; values?: SellerFixedValues };
        if (!cancelled && data.ok && data.values) setValues(data.values);
      } catch {
        // 저장값을 못 읽어도 화면은 선다 — 빈 상태로 보일 뿐이다.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/lotteon/delivery-settings");
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          outboundPlaces?: { no: string; name: string | null }[];
          returnPlaces?: { no: string; name: string | null }[];
          costPolicies?: { no: string; name: string | null }[];
          deliveryRegionGroups?: { code: string; name: string | null }[];
        };
        if (cancelled) return;
        if (!data.ok) {
          // 🔴 실패를 «목록 없음» 으로 바꿔 말하지 않는다(오늘 스마트스토어
          //    카테고리에서 고친 것과 같은 규칙).
          setMasterError(data.message ?? "롯데ON에서 목록을 불러오지 못했습니다.");
          return;
        }
        setMaster({
          outboundPlaces: (data.outboundPlaces ?? []).map((p) => ({ value: p.no, label: p.name || p.no })),
          returnPlaces: (data.returnPlaces ?? []).map((p) => ({ value: p.no, label: p.name || p.no })),
          costPolicies: (data.costPolicies ?? []).map((p) => ({ value: p.no, label: p.name || p.no })),
          deliveryRegionGroups: (data.deliveryRegionGroups ?? []).map((g) => ({ value: g.code, label: g.name || g.code })),
        });
      } catch {
        if (!cancelled) setMasterError("롯데ON에 연결하지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/lotteon-seller", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; values?: SellerFixedValues };
      if (!data.ok) {
        setMessage(`저장 실패: ${data.error ?? "알 수 없는 오류"}`);
        return;
      }
      // 저장 «후의 실제 값» 으로 화면을 맞춘다 — 발송마감시간은 형식이 틀리면
      // 저장되지 않고 비워진다. 셀러가 자기가 친 값을 그대로 믿게 두지 않는다.
      if (data.values) setValues(data.values);
      setMessage("저장되었습니다. 상품 등록 화면에 자동으로 적용됩니다.");
    } catch {
      setMessage("저장 실패: 서버에 연결하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-text-tertiary">판매자 설정을 읽는 중…</p>;
  }

  return (
    <div className="space-y-3" data-lotteon-seller-settings="true">
      <div>
        <p className="text-sm font-semibold text-text-primary">판매자 고정값</p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          여기서 한 번 정하면 상품마다 다시 고르지 않습니다. 상품에서 다른 값을 직접 고른 경우에는 그 상품의 값이
          우선합니다.
        </p>
      </div>

      {masterError && (
        <div className="rounded-md bg-error/5 px-3 py-2">
          <p className="text-xs font-medium text-error">🔴 롯데ON 목록 조회 실패 — {masterError}</p>
          <p className="mt-1 text-[11px] text-text-secondary">
            지금 저장돼 있는 값은 아래에 그대로 보입니다. 연결이 돌아오면 목록에서 다시 고를 수 있습니다.
            {/* 🔴 여기에 «직접 입력» 칸을 만들지 않는다. 없는 번호를 적어 두면
                그 값은 등록 직전에야 거절된다. */}
          </p>
        </div>
      )}

      {PLACE_FIELDS.map((field) => {
        const options = master?.[field.source] ?? [];
        const currentValue = values[field.valueKey];
        const currentLabel = values[field.labelKey];
        return (
          <div key={field.valueKey} className="space-y-1">
            <label className="text-xs font-medium text-text-secondary" htmlFor={`lotteon-${field.valueKey}`}>
              {field.title}
            </label>
            {options.length > 0 ? (
              <select
                id={`lotteon-${field.valueKey}`}
                value={currentValue ?? ""}
                onChange={(e) => {
                  const picked = options.find((o) => o.value === e.target.value);
                  setValues((prev) => ({
                    ...prev,
                    [field.valueKey]: picked?.value ?? null,
                    [field.labelKey]: picked?.label ?? null,
                  }));
                }}
                className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">선택 안 함</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : currentValue ? (
              // 목록이 없어도 «지금 저장된 것» 은 읽을 수 있어야 한다.
              <p className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-text-primary">
                {currentLabel || currentValue}
                {currentLabel && <span className="ml-1 text-[11px] text-text-tertiary">({currentValue})</span>}
              </p>
            ) : (
              <p className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-text-tertiary">
                {masterError ? "연결이 돌아오면 목록에서 고를 수 있습니다." : "선택 가능한 항목이 없습니다."}
              </p>
            )}
            <p className="text-[11px] text-text-tertiary">{field.hint}</p>
          </div>
        );
      })}

      {CLOSE_TIME_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-xs font-medium text-text-secondary" htmlFor={`lotteon-${field.key}`}>
            {field.title}
          </label>
          <input
            id={`lotteon-${field.key}`}
            value={values[field.key] ?? ""}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            inputMode="numeric"
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
          <p className="text-[11px] text-text-tertiary">24시간 네 자리로 적습니다(예: {field.placeholder}).</p>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          {saving ? "저장 중…" : "판매자 고정값 저장"}
        </button>
        {message && <span className="text-[11px] text-text-secondary">{message}</span>}
      </div>
    </div>
  );
}
