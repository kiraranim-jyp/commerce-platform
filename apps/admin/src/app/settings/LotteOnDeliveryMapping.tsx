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

/**
 * 한 줄. 🔴 고른 «이름» 만 보여주고 번호는 값으로만 들고 있는다.
 *
 * ── 🔴 F2(CPO 2차 검증 BLOCK, 2026-09-28) ────────────────────────────────
 * 이 줄이 «거짓말» 을 했다. 저장을 서버에 묻기 전에 화면을 먼저 바꿔서,
 * PUT 이 실패해도 초록 「✓ 연결됨 · Hessen 물류센터」가 그대로 서 있었다.
 * 아래에 「저장하지 못했습니다」가 같이 떠 있어도 셀러는 초록 체크를 믿는다.
 * 실제로는 서버가 `{}` 였고, 다시 열면 여섯 칸이 전부 비어 있었다.
 *
 * 그래서 이 줄이 말하는 상태는 이제 **서버가 확인해 준 것** 하나뿐이다.
 *
 *     저장 중      「저장 중…」        — 아직 아무것도 확정하지 않았다
 *     저장 실패    「저장하지 못했습니다 + 다시 시도」  🔴 ✓ 연결됨 없음
 *     저장 성공    「✓ 연결됨 · 이름」  — 서버에 있는 값과 같다
 *     저장한 적 없음「연결 필요」
 *
 * 조회 실패를 «선택 안 함» 으로 위장하지 않는 규칙과 **같은 모양** 이다 —
 * 조회 쪽만 지키고 저장 쪽을 안 지키고 있었다.
 */
function MappingRow({
  label,
  hint,
  options,
  value,
  onPick,
  savedLabel,
  pendingValue,
  failed,
  onRetry,
}: {
  label: string;
  hint: string;
  options: { value: string; name: string }[];
  /** 🔴 «서버가 확인해 준» 값. 저장에 성공하기 전에는 절대 바뀌지 않는다. */
  value: string | null;
  onPick: (value: string, name: string) => void;
  savedLabel: string | null;
  /** 저장 요청이 날아가 있는 동안 셀러가 고른 값. 확정이 아니다. */
  pendingValue?: string | null;
  failed?: boolean;
  onRetry?: () => void;
}) {
  const saving = pendingValue !== undefined;
  /* 고르는 순간의 선택은 보여 주되(그래야 화면이 튀지 않는다) 「연결됨」이라고
     말하지는 않는다. 실패하면 pendingValue 가 사라져 서버 값으로 되돌아간다. */
  const shown = saving ? pendingValue : value;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {failed ? (
          <span className="text-[11px] text-warning">
            저장하지 못했습니다
            {onRetry && (
              <button type="button" onClick={onRetry} className="ml-1.5 underline">
                다시 시도
              </button>
            )}
          </span>
        ) : saving ? (
          <span className="text-[11px] text-text-tertiary">저장 중…</span>
        ) : value ? (
          <span className="text-[11px] text-success">✓ 연결됨{savedLabel ? ` · ${savedLabel}` : ""}</span>
        ) : (
          <span className="text-[11px] text-warning">연결 필요</span>
        )}
      </div>
      <select
        className={SELECT_CLASS}
        value={shown ?? ""}
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
  /** 🔴 F2 — «서버가 확인해 준» 값만 들어온다(GET 결과 또는 PUT 성공). */
  const [saved, setSaved] = useState<Saved>(EMPTY);
  /** 저장 요청이 날아가 있는 동안의 선택. 확정이 아니라서 따로 들고 있는다. */
  const [pending, setPending] = useState<Partial<Saved> | null>(null);
  const [saveFailed, setSaveFailed] = useState<Partial<Saved> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, savedRes] = await Promise.all([
        /* 🔴 P0-1(CPO 2차 감사, 2026-09-28) — 여기가 `{ method: "POST" }` 였다.
           라우트가 내보내는 핸들러는 `GET` 하나뿐이라(route.ts:140) 405 가 돌아왔고,
           화면은 그것을 「불러오지 못했습니다」로 읽었다. 그래서 셀러는 «한 번도»
           목록을 본 적이 없고, 고를 수 없으니 저장도 없었고, 상품 화면의 배송비
           정책·지역·택배사가 전부 「선택 안 함」이었다.

           POST 를 쓴 이유는 짐작이 간다 — 이 라우트가 «안에서» 롯데ON 150/166 을
           POST 로 부른다(route.ts:169,211). 상류 API 의 메서드를 우리 라우트의
           메서드로 착각한 것이다. 둘은 다른 계약이다.

           상품 등록 패널은 처음부터 GET 으로 불렀다(LotteOnRegistrationPanel:755) —
           그래서 그쪽만 동작했다. 두 캡처가 달랐던 이유가 이것이다. */
        fetch("/api/lotteon/delivery-settings"),
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

  /**
   * 🔴 고르는 즉시 저장한다. 「저장」을 따로 누르게 하면 셀러는 골라 놓고 나가고,
   * 다음에 와서 또 고른다 — 이 화면이 없앴어야 할 바로 그 반복이다.
   *
   * 🔴 F2 — **서버가 「저장했다」고 한 뒤에만 `saved` 를 바꾼다.**
   * 예전에는 `setSaved(next)` 를 PUT «전에» 했다. 그래서 저장이 실패해도 화면은
   * 연결된 것처럼 보였고, 서버에는 아무것도 없었다. 화면이 서버보다 앞서 나가면
   * 셀러는 다음에 와서 「분명 연결했는데」가 된다.
   */
  const pick = useCallback(
    async (patch: Partial<Saved>) => {
      setPending(patch);
      setSaveFailed(null);
      setMessage(null);
      try {
        const res = await fetch("/api/settings/lotteon-seller", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...saved, ...patch }),
        });
        if (!res.ok) throw new Error("save failed");
        setSaved({ ...saved, ...patch });
        setMessage("저장했습니다 — 이후 상품에 자동 적용됩니다.");
      } catch {
        /* 🔴 `saved` 를 «건드리지 않는다». 화면은 서버에 있는 그대로로 되돌아가고,
           그 줄이 「저장하지 못했습니다 + 다시 시도」를 말한다. */
        setSaveFailed(patch);
      } finally {
        setPending(null);
      }
    },
    [saved],
  );

  /** 이 칸이 지금 어떤 상태인가 — 저장 중 / 실패 / 서버가 확인해 준 값. */
  const rowState = (key: keyof Saved) => ({
    pendingValue: pending && key in pending ? ((pending[key] as string | null) ?? "") : undefined,
    failed: Boolean(saveFailed && key in saveFailed),
    onRetry: saveFailed && key in saveFailed ? () => void pick(saveFailed) : undefined,
  });

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
            {...rowState("outboundPlaceNo")}
            savedLabel={saved.outboundPlaceLabel}
            onPick={(v, n) => void pick({ outboundPlaceNo: v || null, outboundPlaceLabel: n || null })}
          />
          <MappingRow
            label="반품지"
            hint="반품을 받을 곳입니다. 출고지와 달라도 됩니다."
            options={asOptions(lists.returnPlaces)}
            value={saved.returnPlaceNo}
            {...rowState("returnPlaceNo")}
            savedLabel={saved.returnPlaceLabel}
            onPick={(v, n) => void pick({ returnPlaceNo: v || null, returnPlaceLabel: n || null })}
          />
          <MappingRow
            label="배송비 정책"
            hint="해외직구는 상품마다 정책이 달라지지 않습니다 — 하나만 정해 두면 됩니다."
            options={asOptions(lists.costPolicies)}
            value={saved.deliveryCostPolicyNo}
            {...rowState("deliveryCostPolicyNo")}
            savedLabel={saved.deliveryCostPolicyLabel}
            onPick={(v, n) => void pick({ deliveryCostPolicyNo: v || null, deliveryCostPolicyLabel: n || null })}
          />
          <MappingRow
            label="배송 가능 지역"
            hint="롯데ON이 정한 지역 구분 중에서 고릅니다."
            options={asCodeOptions(lists.deliveryRegionGroups)}
            value={saved.deliveryRegionGroupCode}
            {...rowState("deliveryRegionGroupCode")}
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
            {...rowState("courierCode")}
            savedLabel={saved.courierLabel}
            onPick={(v, n) => void pick({ courierCode: v || null, courierLabel: n || null })}
          />
          <MappingRow
            label="반품 택배사"
            hint="반품을 회수할 택배사입니다. 출고 택배사와 달라도 됩니다."
            options={asCodeOptions(lists.couriers)}
            value={saved.returnCourierCode}
            {...rowState("returnCourierCode")}
            savedLabel={saved.returnCourierLabel}
            onPick={(v, n) => void pick({ returnCourierCode: v || null, returnCourierLabel: n || null })}
          />
        </div>
      )}

      {message && <p className="text-xs text-text-secondary">{message}</p>}
    </div>
  );
}
