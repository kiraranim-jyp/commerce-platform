"use client";

import { useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { Button } from "@/components/ui/Button";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 3 — 롯데ON 상품등록 화면.
 *
 * 흐름은 작업지시서 그대로다: 필수값 검증 → Payload Preview → 등록 → 결과.
 *
 * 이 컴포넌트가 기존 채널 탭들과 다른 점:
 *  - `PlatformId`에 들어가지 않는다(CPO 확정). 그래서 PLATFORM_ADAPTERS /
 *    LISTING_EXECUTORS / ListingModel 경로를 전혀 쓰지 않고, 서버 라우트
 *    (/api/lotteon/payload-preview · /api/lotteon/register)만 호출한다.
 *    Naver/Coupang 등록 경로는 한 줄도 건드리지 않는다.
 *  - 롯데ON 전용 입력(표준/전시 카테고리, 고시, 안전인증, 출고지/반품지/
 *    배송비정책 번호)을 여기서 받는다 — 상품 데이터에서 만들어낼 수 없는 값들이라
 *    비어 있으면 서버 검증이 등록을 막는다.
 *
 * 🔴 인증키는 이 화면에 절대 나타나지 않는다. 설정 화면에서 저장하고, 등록은
 * 서버가 그 키로 수행한다.
 */
interface ValidationField {
  field: string;
  label: string;
  status: "READY" | "MISSING" | "BLOCKED";
  reason?: string;
  code?: string;
}

interface ValidationResult {
  ok: boolean;
  fields: ValidationField[];
  readyCount: number;
  missingCount: number;
  blockedCount: number;
}

interface PreviewResponse {
  ok: boolean;
  message?: string;
  identityError?: string | null;
  payload?: unknown;
  validation?: ValidationResult;
}

interface RegisterResponse {
  ok: boolean;
  message?: string;
  validation?: ValidationResult;
  nextStep?: string;
  result?: {
    status: "SUBMITTED" | "FAILED";
    externalProductId: string | null;
    message: string;
    errorCode: string | null;
    optionIdNote?: string;
    rows?: { spdNo?: string; epdNo?: string; resultCode?: string; resultMessage?: string }[];
  };
}

interface ChannelForm {
  standardCategoryNo: string;
  displayCategoryNos: string;
  originCode: string;
  taxTypeCode: string;
  noticeItemCode: string;
  noticeArticles: string;
  safetyCertifications: string;
  importProxyCode: string;
  brandNo: string;
  outboundPlaceNo: string;
  returnPlaceNo: string;
  deliveryCostPolicyNo: string;
  deliveryRegionGroupCode: string;
  courierCode: string;
  returnCourierCode: string;
  weekdayCloseTime: string;
  externalProductNo: string;
}

const EMPTY_FORM: ChannelForm = {
  standardCategoryNo: "",
  displayCategoryNos: "",
  originCode: "",
  taxTypeCode: "01",
  noticeItemCode: "",
  noticeArticles: "",
  safetyCertifications: "",
  importProxyCode: "",
  brandNo: "",
  outboundPlaceNo: "",
  returnPlaceNo: "",
  deliveryCostPolicyNo: "",
  deliveryRegionGroupCode: "",
  courierCode: "",
  returnCourierCode: "",
  weekdayCloseTime: "1400",
  externalProductNo: "",
};

/** "코드:값" 줄 단위 입력 → 고시 항목 배열. 코드체계를 우리가 만들지 않으므로
 * 셀러가 롯데ON 문서/판매자센터에서 본 코드를 그대로 적는다. */
function parseNoticeArticles(raw: string): { pdArtlCd: string; pdArtlCnts: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) return null;
      return { pdArtlCd: line.slice(0, separator).trim(), pdArtlCnts: line.slice(separator + 1).trim() };
    })
    .filter((item): item is { pdArtlCd: string; pdArtlCnts: string } => Boolean(item?.pdArtlCd && item.pdArtlCnts));
}

/** "유형코드:인증번호[:기관명]" 줄 단위 입력. 인증번호는 절대 자동 생성하지 않는다. */
function parseSafetyCertifications(raw: string): { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [typeCode, number, orgName] = line.split(":").map((part) => part.trim());
      if (!typeCode || !number) return null;
      return { sftyAthnTypCd: typeCode, sftyAthnNo: number, ...(orgName ? { sftyAthnOrgnNm: orgName } : {}) };
    })
    .filter((item): item is { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string } => Boolean(item));
}

function toChannelPayload(form: ChannelForm) {
  return {
    standardCategoryNo: form.standardCategoryNo,
    displayCategoryNos: form.displayCategoryNos
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean),
    originCode: form.originCode,
    taxTypeCode: form.taxTypeCode,
    noticeItemCode: form.noticeItemCode,
    noticeArticles: parseNoticeArticles(form.noticeArticles),
    safetyCertifications: parseSafetyCertifications(form.safetyCertifications),
    importProxyCode: form.importProxyCode,
    brandNo: form.brandNo,
    outboundPlaceNo: form.outboundPlaceNo,
    returnPlaceNo: form.returnPlaceNo,
    deliveryCostPolicyNo: form.deliveryCostPolicyNo,
    deliveryRegionGroupCode: form.deliveryRegionGroupCode,
    courierCode: form.courierCode,
    returnCourierCode: form.returnCourierCode,
    weekdayCloseTime: form.weekdayCloseTime,
    externalProductNo: form.externalProductNo,
  };
}

export function LotteOnRegistrationPanel({
  product,
  snapshotId,
  jobKey,
  liveRates,
  roundingUnit,
}: {
  product: CanonicalProduct;
  snapshotId?: string | null;
  jobKey?: string | null;
  liveRates?: Record<string, number>;
  roundingUnit?: number;
}) {
  const [form, setForm] = useState<ChannelForm>(EMPTY_FORM);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<RegisterResponse | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ChannelForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    setRegisterResult(null);
    try {
      const res = await fetch("/api/lotteon/payload-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, channel: toChannelPayload(form), liveRates, roundingUnit }),
      });
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      if (!data.ok) setError(data.message ?? "미리보기를 만들지 못했습니다.");
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runRegister() {
    // 검증을 통과한 미리보기가 있을 때만 등록한다 — 화면 게이트이고,
    // 서버(register 라우트)가 같은 검증을 한 번 더 한다.
    if (!preview?.validation?.ok) return;
    if (!window.confirm("롯데ON에 이 상품을 실제로 등록합니다. 계속하시겠습니까?")) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/lotteon/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          channel: toChannelPayload(form),
          snapshotId: snapshotId ?? undefined,
          jobKey: jobKey ?? undefined,
          liveRates,
          roundingUnit,
        }),
      });
      const data = (await res.json()) as RegisterResponse;
      setRegisterResult(data);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setRegistering(false);
    }
  }

  const validation = preview?.validation;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">롯데ON 상품등록</p>
        <p className="mt-1 text-xs text-text-tertiary">
          롯데ON은 <b>표준카테고리 + 전시카테고리 2중 구조</b>이고, 고시정보 · 안전인증(KC) · 옵션이 모두 상품등록
          요청 안의 필드입니다. 아래 값들은 상품 데이터에서 만들어낼 수 없어 직접 입력해야 하며, 비어 있으면 등록이
          차단됩니다.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:grid-cols-2">
        <TextField
          label="표준카테고리번호 (scatNo)"
          hint="카테고리 조회(205)로 확인한 표준카테고리 ID"
          value={form.standardCategoryNo}
          onChange={set("standardCategoryNo")}
        />
        <TextField
          label="전시카테고리번호 (dcatLst)"
          hint="1개 이상, 쉼표로 구분. 표준카테고리에 매핑된 것만 가능"
          value={form.displayCategoryNos}
          onChange={set("displayCategoryNos")}
        />
        <TextField
          label="원산지코드 (oplcCd)"
          hint="공통코드 OPLC_CD — 원산지 텍스트로는 코드를 정할 수 없습니다"
          value={form.originCode}
          onChange={set("originCode")}
        />
        <TextField label="과세유형코드 (tdfDvsCd)" hint="01 과세 · 02 면세 · 03 영세 · 04 해당없음" value={form.taxTypeCode} onChange={set("taxTypeCode")} />
        <TextField
          label="상품품목코드 (pdItmsCd)"
          hint="고시 품목. 23 = 어린이제품(유아동) — 이 경우 안전인증이 필수입니다"
          value={form.noticeItemCode}
          onChange={set("noticeItemCode")}
        />
        <TextField label="브랜드번호 (brdNo)" hint="속성모듈(204) 조회 결과. 없으면 비워둡니다" value={form.brandNo} onChange={set("brandNo")} />
        <TextField label="출고지번호 (owhpNo)" hint="롯데ON에 선등록된 출고지" value={form.outboundPlaceNo} onChange={set("outboundPlaceNo")} />
        <TextField label="회수지번호 (rtrpNo)" hint="롯데ON에 선등록된 반품지" value={form.returnPlaceNo} onChange={set("returnPlaceNo")} />
        <TextField
          label="배송비정책번호 (dvCstPolNo)"
          hint="롯데ON에 선등록된 배송비 정책"
          value={form.deliveryCostPolicyNo}
          onChange={set("deliveryCostPolicyNo")}
        />
        <TextField
          label="배송가능지역코드 (dvRgsprGrpCd)"
          hint="공통코드 DV_RGSPR_GRP_CD"
          value={form.deliveryRegionGroupCode}
          onChange={set("deliveryRegionGroupCode")}
        />
        <TextField label="택배사코드 (hdcCd)" hint="공통코드 DV_CO_CD (예: 0001 롯데택배)" value={form.courierCode} onChange={set("courierCode")} />
        <TextField label="반품택배사코드 (rtngHdcCd)" value={form.returnCourierCode} onChange={set("returnCourierCode")} />
        <TextField label="평일 발송마감시간" hint="HHMM · 분은 00 또는 30만" value={form.weekdayCloseTime} onChange={set("weekdayCloseTime")} />
        <TextField
          label="수입대행코드 (impPrxCd)"
          hint="KC인증 계열 안전인증을 넣으면 필수 — PUR_PRX / PRL_IMP / NONE"
          value={form.importProxyCode}
          onChange={set("importProxyCode")}
        />
        <TextField label="업체상품번호 (epdNo)" hint="우리 쪽 식별자. 등록 후 상품 상태 조회에 씁니다" value={form.externalProductNo} onChange={set("externalProductNo")} />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <TextAreaField
          label="상품정보제공고시 항목"
          hint="한 줄에 하나씩 `항목코드:내용` — 항목코드 체계는 품목마다 다르므로 자동 생성하지 않습니다"
          placeholder={"0020:색상\n0060:제조국"}
          value={form.noticeArticles}
          onChange={set("noticeArticles")}
        />
        <TextAreaField
          label="안전인증(KC) 목록"
          hint="한 줄에 하나씩 `유형코드:인증번호[:기관명]` — 인증번호는 절대 임의로 만들 수 없습니다"
          placeholder={"CHL_CFM:CB123456789"}
          value={form.safetyCertifications}
          onChange={set("safetyCertifications")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={previewing} onClick={() => void runPreview()}>
          {previewing ? "검증 중…" : "필수값 검증 · Payload Preview"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!validation?.ok || registering}
          onClick={() => void runRegister()}
        >
          {registering ? "등록 중…" : "롯데ON에 등록"}
        </Button>
        {!validation?.ok && (
          <span className="text-[11px] text-text-tertiary">검증을 통과해야 등록 버튼이 열립니다.</span>
        )}
      </div>

      {error && <div className="rounded-lg border border-error/40 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>}

      {preview?.identityError && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-xs text-text-secondary">
          거래처 정보(Identity) 조회 실패 — {preview.identityError}
        </div>
      )}

      {validation && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-text-primary">
            필수값 검증 — 준비 {validation.readyCount} · 누락 {validation.missingCount} · 차단 {validation.blockedCount}
          </p>
          <ul className="space-y-1 text-xs">
            {validation.fields.map((field) => (
              <li key={field.field} className="flex gap-2">
                <span
                  className={
                    field.status === "READY"
                      ? "text-success"
                      : field.status === "BLOCKED"
                        ? "text-error"
                        : "text-warning"
                  }
                >
                  {field.status === "READY" ? "●" : field.status === "BLOCKED" ? "■" : "▲"}
                </span>
                <span className="text-text-secondary">
                  <b className="text-text-primary">{field.label}</b>
                  {field.reason ? ` — ${field.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview?.payload != null && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setShowPayload((prev) => !prev)}
            className="text-sm font-semibold text-text-primary"
          >
            Payload Preview {showPayload ? "▾" : "▸"}
          </button>
          {showPayload && (
            <pre className="mt-2 max-h-[420px] overflow-auto rounded bg-background p-3 text-[11px] text-text-secondary">
              {JSON.stringify(preview.payload, null, 2)}
            </pre>
          )}
        </div>
      )}

      {registerResult?.result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            registerResult.result.status === "SUBMITTED"
              ? "border-success/40 bg-success/5 text-text-secondary"
              : "border-error/40 bg-error/5 text-error"
          }`}
        >
          <p className="font-semibold text-text-primary">
            {registerResult.result.status === "SUBMITTED" ? "등록 요청 완료" : "등록 실패"}
          </p>
          <p className="mt-1">{registerResult.result.message}</p>
          {registerResult.result.externalProductId && (
            <p className="mt-1 font-mono text-xs">판매자상품번호(spdNo): {registerResult.result.externalProductId}</p>
          )}
          {registerResult.nextStep && <p className="mt-1 text-xs text-text-tertiary">{registerResult.nextStep}</p>}
          {registerResult.result.optionIdNote && (
            <p className="mt-1 text-[11px] text-text-tertiary">{registerResult.result.optionIdNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </label>
  );
}

function TextAreaField({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <textarea
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="rounded-md border border-border px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none"
      />
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </label>
  );
}
