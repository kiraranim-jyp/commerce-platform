"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * FINAL-3COMMERCE — **롯데ON 배송 연결을 «한 번» 고른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 화면이 없었나 ───────────────────────────────────────────────────
 * `lotteon_seller_settings` 표도 있고 PUT 라우트도 있고 067 로 컬럼도 있는데
 * **값을 넣는 화면만 없었다.** 그래서 CEO 캡처에서 배송 프로필에는 Hessen ·
 * 우체국택배 · 반품주소지가 있는데 롯데ON 탭은 전부 「선택 안 함」이었다.
 *
 * 🔴 그 상태에서 내가 「설정값이 있으면 picker 를 숨긴다」를 넣었고, 그 조건은
 * «한 번도 참이 된 적이 없다». 증상을 숨긴 것도 아니고 아무 일도 하지 않았다.
 * 이 화면이 그 단절을 잇는다.
 *
 * ── 🔴 이름으로 «자동 매칭하지 않는다» ────────────────────────────────────
 * 쿠팡 Wing 의 Hessen(24496935)과 롯데ON 의 PLO3837441 은 **다른 채널이 발급한**
 * 번호다. 이름이 같아도 같은 장소라는 근거가 없고, 틀리면 물건이 엉뚱한 곳에서
 * 나간다. 장소의 동일성은 데이터로 증명되지 않는다 — **셀러가 선언한다.**
 *
 * 그래서 여기서 «한 번» 고르게 하고, 그 뒤 상품마다는 다시 묻지 않는다.
 *
 * ── 🔴 셀러에게 코드를 보여주지 않는다 ───────────────────────────────────
 * 고른 결과는 이름으로 보인다. 롯데ON 이 발급한 번호는 저장만 되고 화면에
 * 서지 않는다(F-7 · S-19 와 같은 규칙).
 */

interface Option {
  no: string;
  name: string | null;
}
interface CodeOption {
  code: string;
  name: string | null;
}

interface DeliveryLists {
  outboundPlaces: Option[];
  returnPlaces: Option[];
  costPolicies: Option[];
  couriers: CodeOption[];
  deliveryRegionGroups: CodeOption[];
  issues?: string[];
}

interface Saved {
  outboundPlaceNo: string | null;
  outboundPlaceLabel: string | null;
  returnPlaceNo: string | null;
  returnPlaceLabel: string | null;
  deliveryCostPolicyNo: string | null;
  deliveryCostPolicyLabel: string | null;
  deliveryRegionGroupCode: string | null;
  deliveryRegionGroupLabel: string | null;
  courierCode: string | null;
  courierLabel: string | null;
  returnCourierCode: string | null;
  returnCourierLabel: string | null;
}

const EMPTY: Saved = {
  outboundPlaceNo: null,
  outboundPlaceLabel: null,
  returnPlaceNo: null,
  returnPlaceLabel: null,
  deliveryCostPolicyNo: null,
  deliveryCostPolicyLabel: null,
  deliveryRegionGroupCode: null,
  deliveryRegionGroupLabel: null,
  courierCode: null,
  courierLabel: null,
  returnCourierCode: null,
  returnCourierLabel: null,
};

const SELECT_CLASS =
  "w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none";

/** 한 줄. 🔴 고른 «이름» 만 보여주고 번호는 값으로만 들고 있는다. */
function MappingRow({
  label,
  hint,
  options,
  value,
  onPick,
  savedLabel,
}: {
  label: string;
  hint: string;
  options: { value: string; name: string }[];
  value: string | null;
  onPick: (value: string, name: string) => void;
  savedLabel: string | null;
}) {
  const connected = Boolean(value);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {connected ? (
          <span className="text-[11px] text-success">✓ 연결됨{savedLabel ? ` · ${savedLabel}` : ""}</span>
        ) : (
          <span className="text-[11px] text-warning">연결 필요</span>
        )}
      </div>
      <select
        className={SELECT_CLASS}
        value={value ?? ""}
        onChange={(e) => {
          const picked = options.find((o) => o.value === e.target.value);
          onPick(e.target.value, picked?.name ?? "");
        }}
      >
        <option value="">선택...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-relaxed text-text-tertiary">{hint}</p>
    </div>
  );
}

export function LotteOnDeliveryMapping() {
  const [lists, setLists] = useState<DeliveryLists | null>(null);
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, savedRes] = await Promise.all([
        fetch("/api/lotteon/delivery-settings", { method: "POST" }),
        fetch("/api/settings/lotteon-seller"),
      ]);
      const listJson = (await listRes.json()) as { ok?: boolean; message?: string } & Partial<DeliveryLists>;
      /* 🔴 실패를 «목록 0건» 으로 바꿔 말하지 않는다 — 화면이 「고를 것이 없다」고
         하면 셀러는 롯데ON 에 값이 없는 줄 알지만 사실은 조회가 닿지 않은 것이다. */
      if (!listRes.ok || listJson.ok === false) {
        setError(listJson.message ?? "롯데ON 배송 정보를 불러오지 못했습니다.");
      } else {
        setLists({
          outboundPlaces: listJson.outboundPlaces ?? [],
          returnPlaces: listJson.returnPlaces ?? [],
          costPolicies: listJson.costPolicies ?? [],
          couriers: listJson.couriers ?? [],
          deliveryRegionGroups: listJson.deliveryRegionGroups ?? [],
          issues: listJson.issues,
        });
      }
      const savedJson = (await savedRes.json()) as { ok?: boolean; values?: Partial<Saved> };
      if (savedJson.ok && savedJson.values) setSaved({ ...EMPTY, ...savedJson.values });
    } catch {
      setError("롯데ON 배송 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 🔴 고르는 즉시 저장한다. 「저장」을 따로 누르게 하면 셀러는 골라 놓고 나가고,
      다음에 와서 또 고른다 — 이 화면이 없앴어야 할 바로 그 반복이다. */
  const pick = useCallback(
    async (patch: Partial<Saved>) => {
      const next = { ...saved, ...patch };
      setSaved(next);
      setMessage(null);
      const res = await fetch("/api/settings/lotteon-seller", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setMessage(res.ok ? "저장했습니다 — 이후 상품에 자동 적용됩니다." : "저장하지 못했습니다.");
    },
    [saved],
  );

  const asOptions = (items: Option[]) => items.map((i) => ({ value: i.no, name: i.name ?? i.no }));
  const asCodeOptions = (items: CodeOption[]) => items.map((i) => ({ value: i.code, name: i.name ?? i.code }));

  return (
    <div className="space-y-3" data-lotteon-delivery-mapping="true">
      <div>
        <p className="text-sm font-semibold text-text-primary">롯데ON 연결</p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          위 배송 정보와 같은 곳을 롯데ON 목록에서 <b className="text-text-secondary">한 번만</b> 골라 주세요. 이후
          상품 등록에서는 자동으로 적용됩니다.
        </p>
      </div>

      {loading && <p className="text-xs text-text-tertiary">롯데ON 배송 정보를 불러오는 중…</p>}

      {error && (
        <div className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 underline">
            다시 불러오기
          </button>
        </div>
      )}

      {lists && (
        <div className="grid gap-3 sm:grid-cols-2">
          <MappingRow
            label="출고지"
            hint="🔴 이름이 같아도 자동으로 잇지 않습니다 — 롯데ON이 발급한 장소는 별개라 같은 곳인지 판단은 판매자만 할 수 있습니다."
            options={asOptions(lists.outboundPlaces)}
            value={saved.outboundPlaceNo}
            savedLabel={saved.outboundPlaceLabel}
            onPick={(v, n) => void pick({ outboundPlaceNo: v || null, outboundPlaceLabel: n || null })}
          />
          <MappingRow
            label="반품지"
            hint="반품을 받을 곳입니다. 출고지와 달라도 됩니다."
            options={asOptions(lists.returnPlaces)}
            value={saved.returnPlaceNo}
            savedLabel={saved.returnPlaceLabel}
            onPick={(v, n) => void pick({ returnPlaceNo: v || null, returnPlaceLabel: n || null })}
          />
          <MappingRow
            label="배송비 정책"
            hint="해외직구는 상품마다 정책이 달라지지 않습니다 — 하나만 정해 두면 됩니다."
            options={asOptions(lists.costPolicies)}
            value={saved.deliveryCostPolicyNo}
            savedLabel={saved.deliveryCostPolicyLabel}
            onPick={(v, n) => void pick({ deliveryCostPolicyNo: v || null, deliveryCostPolicyLabel: n || null })}
          />
          <MappingRow
            label="배송 가능 지역"
            hint="롯데ON이 정한 지역 구분 중에서 고릅니다."
            options={asCodeOptions(lists.deliveryRegionGroups)}
            value={saved.deliveryRegionGroupCode}
            savedLabel={saved.deliveryRegionGroupLabel}
            onPick={(v, n) =>
              void pick({ deliveryRegionGroupCode: v || null, deliveryRegionGroupLabel: n || null })
            }
          />
          <MappingRow
            label="택배사"
            hint="위에서 고른 기본 택배사와 같은 곳을 롯데ON 목록에서 골라 주세요."
            options={asCodeOptions(lists.couriers)}
            value={saved.courierCode}
            savedLabel={saved.courierLabel}
            onPick={(v, n) => void pick({ courierCode: v || null, courierLabel: n || null })}
          />
          <MappingRow
            label="반품 택배사"
            hint="반품을 회수할 택배사입니다. 출고 택배사와 달라도 됩니다."
            options={asCodeOptions(lists.couriers)}
            value={saved.returnCourierCode}
            savedLabel={saved.returnCourierLabel}
            onPick={(v, n) => void pick({ returnCourierCode: v || null, returnCourierLabel: n || null })}
          />
        </div>
      )}

      {message && <p className="text-xs text-text-secondary">{message}</p>}
    </div>
  );
}
