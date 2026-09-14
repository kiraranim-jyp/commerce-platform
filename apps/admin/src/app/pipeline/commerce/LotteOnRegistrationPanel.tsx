"use client";

import { useMemo, useState } from "react";
import type { CanonicalProduct } from "@commerce/shared";
import { Button } from "@/components/ui/Button";
import {
  EMPTY_LOTTEON_CHANNEL_FORM,
  LOTTEON_CHILD_PRODUCT_ITEM_CODE,
  describeLotteOnCategoryItem,
  parseDisplayCategoryNos,
  requiresSafetyCertification,
  summarizeCommonProduct,
  toLotteOnChannelPayload,
  type CommonCategorySource,
  type LotteOnChannelForm,
} from "./lotteon-channel-form";

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — 롯데ON 탭.
 *
 * ── 이 탭이 하는 일 / 하지 않는 일 ─────────────────────────────────────────
 * 하지 않는 일: **상품을 다시 만들지 않는다.** 상품명 · 대표이미지 · 상세페이지 ·
 * 가격 · 옵션 · 재고는 공통 상품관리가 이미 갖고 있고, 이 화면에는 그 값을
 * 입력하는 칸이 하나도 없다(아래 ①은 전부 읽기 전용이다 — input이 아니다).
 * 고치려면 상품정보 탭으로 데려간다(onEditCommonInfo). 스마트스토어/쿠팡 탭과
 * 같은 원칙이다: 같은 상품이 화면 안에 두 벌 생기지 않는다.
 *
 * 하는 일: **롯데ON에만 있는 차별점**만 받는다.
 *   ② 카테고리  표준(scatNo) + 전시(dcatLst[]) 2중 구조
 *   ③ 고시      pdItmsCd · pdItmsArtlLst[]
 *   ④ 인증      sftyAthnLst[] · impPrxCd (유아동=품목코드 23이면 필수)
 *   ⑤ 배송      출고지 · 반품지 · 배송비 정책 · 배송가능지역
 * 전부 "상품 데이터에서 파생할 수 없는 외부 코드"라는 공통점이 있다. 파생할 수
 * 있는 값을 여기 칸으로 만드는 순간 이 탭은 세 번째 상품관리가 된다.
 *
 * ── 구조 ──────────────────────────────────────────────────────────────────
 *  - `PlatformId`에 들어가지 않는다(CPO 확정). PLATFORM_ADAPTERS /
 *    LISTING_EXECUTORS / ListingModel 경로를 전혀 쓰지 않고 서버 라우트
 *    (/api/lotteon/payload-preview · /api/lotteon/register)만 호출한다.
 *    Naver/Coupang 등록 경로는 한 줄도 건드리지 않는다.
 *  - 폼 모양/파싱/요약은 전부 ./lotteon-channel-form.ts(순수 함수)에 있다.
 *    이 파일에는 렌더링과 fetch만 남긴다.
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

interface CategoryLookupState {
  loading: boolean;
  error: string | null;
  /** 알아본 것 — 누르면 번호가 입력칸에 들어간다. */
  options: { code: string; name: string }[];
  /** 못 알아본 원문 — 지어내지 않고 그대로 보여준다. */
  unrecognized: unknown[];
}

const EMPTY_LOOKUP: CategoryLookupState = { loading: false, error: null, options: [], unrecognized: [] };

export function LotteOnRegistrationPanel({
  product,
  snapshotId,
  jobKey,
  liveRates,
  roundingUnit,
  commonPrice,
  commonCategorySources,
  onEditCommonInfo,
}: {
  product: CanonicalProduct;
  snapshotId?: string | null;
  jobKey?: string | null;
  liveRates?: Record<string, number>;
  roundingUnit?: number;
  /** 상품정보 화면이 이미 계산해 둔 판매가격. 여기서 다시 계산하지 않는다 —
   * 다시 계산하면 같은 상품의 가격이 화면 안에 두 벌 생긴다. */
  commonPrice: { priceKrw: number | null; resolved: boolean };
  /** 공통 분류(원본 사이트 · 다른 채널 확정값). **읽기 전용**이고, 이 탭에서
   * 고른 롯데ON 번호가 이 값으로 되돌아 흘러가는 경로는 없다. */
  commonCategorySources: CommonCategorySource[];
  /** 공통 정보를 고치러 가는 유일한 통로 — 상품정보 탭. */
  onEditCommonInfo: () => void;
}) {
  const [form, setForm] = useState<LotteOnChannelForm>(EMPTY_LOTTEON_CHANNEL_FORM);
  const [displayCategoryText, setDisplayCategoryText] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<RegisterResponse | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [standardLookup, setStandardLookup] = useState<CategoryLookupState>(EMPTY_LOOKUP);
  const [displayLookup, setDisplayLookup] = useState<CategoryLookupState>(EMPTY_LOOKUP);

  /** ① 공통 상품정보 — 실제 payload를 만드는 함수와 같은 것을 쓴다(요약이
   * payload와 다른 말을 할 수 있는 경로가 없다). */
  const common = useMemo(() => summarizeCommonProduct(product, commonPrice), [product, commonPrice]);

  const safetyRequired = requiresSafetyCertification(form);
  const safetyMissing = safetyRequired && !form.certification.safetyText.trim();

  function patch<K extends keyof LotteOnChannelForm>(section: K, changes: Partial<LotteOnChannelForm[K]>) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], ...changes } }));
  }

  /** 전시카테고리는 여러 개다 — 화면에서는 한 줄 텍스트로 받고 배열로 보관한다. */
  function setDisplayCategories(raw: string) {
    setDisplayCategoryText(raw);
    patch("category", { displayCategoryNos: parseDisplayCategoryNos(raw) });
  }

  function addDisplayCategory(code: string) {
    const next = parseDisplayCategoryNos(`${displayCategoryText} ${code}`);
    setDisplayCategoryText(next.join(", "));
    patch("category", { displayCategoryNos: next });
  }

  /**
   * 카테고리 조회 — 이미 있는 읽기 전용 라우트(/api/lotteon/categories)를 부른다.
   * 새 조회 경로를 만들지 않는다.
   *
   * 🔴 응답 필드명을 실동작으로 확인하지 못했다. 알아본 것만 버튼으로 만들고,
   * 못 알아본 것은 원문 그대로 보여준다(지어낸 파싱으로 "결과 없음"을 만들지
   * 않는다). 번호를 직접 아는 셀러는 조회 없이 그냥 입력하면 된다.
   */
  async function lookupCategories(kind: "standard" | "display") {
    const setState = kind === "standard" ? setStandardLookup : setDisplayLookup;
    const job = kind === "standard" ? "cheetahStandardCategory" : "cheetahDisplayCategory";
    setState({ ...EMPTY_LOOKUP, loading: true });
    try {
      const res = await fetch(`/api/lotteon/categories?job=${job}&limit=100`);
      const data = (await res.json()) as { ok: boolean; message?: string; items?: unknown[] };
      if (!data.ok) {
        setState({ ...EMPTY_LOOKUP, error: data.message ?? "카테고리를 조회하지 못했습니다." });
        return;
      }
      const items = data.items ?? [];
      const options: { code: string; name: string }[] = [];
      const unrecognized: unknown[] = [];
      for (const item of items) {
        const described = describeLotteOnCategoryItem(item);
        if (described) options.push(described);
        else unrecognized.push(item);
      }
      setState({ loading: false, error: null, options, unrecognized });
    } catch {
      setState({ ...EMPTY_LOOKUP, error: "서버에 연결하지 못했습니다." });
    }
  }

  async function runValidation() {
    setPreviewing(true);
    setError(null);
    setRegisterResult(null);
    try {
      const res = await fetch("/api/lotteon/payload-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, channel: toLotteOnChannelPayload(form), liveRates, roundingUnit }),
      });
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      if (!data.ok) setError(data.message ?? "등록 정보를 만들지 못했습니다.");
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runRegister() {
    // 검증을 통과한 등록 정보가 있을 때만 등록한다 — 화면 게이트이고,
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
          channel: toLotteOnChannelPayload(form),
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
        <p className="text-sm font-semibold text-text-primary">롯데ON 등록</p>
        <p className="mt-1 text-xs text-text-tertiary">
          상품명 · 이미지 · 상세페이지 · 가격 · 옵션 · 재고는 <b>상품정보에 있는 것을 그대로 씁니다</b> — 이 탭에서 다시
          입력하지 않습니다. 아래에서는 <b>롯데ON에만 필요한 것</b>(표준·전시 2중 카테고리, 고시, 안전인증, 배송
          선등록 번호)만 정합니다.
        </p>
      </div>

      {/* ── ① 공통 상품정보 — 읽기 전용 ─────────────────────────────────── */}
      <Section
        title="① 상품정보 (공통)"
        description="상품관리에 저장된 값입니다. 여기서는 고칠 수 없고, 고치면 스마트스토어·쿠팡에도 함께 반영됩니다."
        action={
          <Button variant="secondary" size="sm" onClick={onEditCommonInfo}>
            상품정보에서 수정
          </Button>
        }
      >
        <dl className="divide-y divide-border text-xs">
          {common.rows.map((row) => (
            <div key={row.label} className="grid gap-0.5 py-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
              <dt className="font-medium text-text-secondary">{row.label}</dt>
              <dd>
                {row.value ? (
                  <span className="text-text-primary">{row.value}</span>
                ) : (
                  <span className="text-warning">입력 필요 — 상품정보에서 채워주세요</span>
                )}
                <span className="ml-2 text-[11px] text-text-tertiary">{row.origin}</span>
              </dd>
            </div>
          ))}
        </dl>
        {common.hasMissing && (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-[11px] text-warning">
            비어 있는 항목은 롯데ON 탭에서 채울 수 없습니다 — 상품정보에서 채우면 이 표와 등록 정보가 함께 갱신됩니다.
          </p>
        )}
      </Section>

      {/* ── ② 카테고리 — 표준 + 전시 2중 ────────────────────────────────── */}
      <Section
        title="② 카테고리 (롯데ON 전용 · 2중 구조)"
        description="롯데ON은 표준카테고리 1개와 전시카테고리 1개 이상을 함께 요구합니다. 여기서 고른 값은 롯데ON에만 적용되고, 스마트스토어·쿠팡 카테고리를 덮어쓰지 않습니다."
      >
        {commonCategorySources.length > 0 ? (
          <div className="mb-3 rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
            <p className="font-medium text-text-tertiary">참고 — 이 상품의 공통 분류</p>
            <ul className="mt-1 space-y-0.5">
              {commonCategorySources.map((source) => (
                <li key={`${source.origin}-${source.path.join("/")}`}>
                  {source.path.join(" › ")} <span className="text-text-tertiary">· {source.origin}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-[11px] text-text-tertiary">
            이 상품에는 아직 참고할 공통 분류가 없습니다(원본 사이트 분류도, 확정된 채널 카테고리도 없습니다).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="표준카테고리번호 (scatNo)"
            hint="롯데ON 표준 분류 1개. 아래 [조회]로 목록을 불러오거나 판매자센터에서 확인한 번호를 적습니다."
            value={form.category.standardCategoryNo}
            onChange={(value) => patch("category", { standardCategoryNo: value })}
          />
          <TextField
            label="전시카테고리번호 (dcatLst)"
            hint="1개 이상. 쉼표로 구분합니다. 표준카테고리에 매핑된 것만 등록됩니다."
            value={displayCategoryText}
            onChange={setDisplayCategories}
          />
        </div>
        <p className="mt-1 text-[11px] text-text-tertiary">
          전시카테고리 {form.category.displayCategoryNos.length}개 인식됨
          {form.category.displayCategoryNos.length > 0 ? ` — ${form.category.displayCategoryNos.join(", ")}` : ""}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CategoryLookup
            title="표준카테고리 조회"
            state={standardLookup}
            onLookup={() => void lookupCategories("standard")}
            onPick={(code) => patch("category", { standardCategoryNo: code })}
          />
          <CategoryLookup
            title="전시카테고리 조회"
            state={displayLookup}
            onLookup={() => void lookupCategories("display")}
            onPick={addDisplayCategory}
          />
        </div>
      </Section>

      {/* ── ③ 고시 ──────────────────────────────────────────────────────── */}
      <Section
        title="③ 상품정보제공고시 (롯데ON 전용)"
        description="품목코드에 따라 요구되는 항목이 달라집니다. 항목코드 체계는 품목마다 달라 자동으로 만들지 않습니다."
      >
        <div className="grid gap-3">
          <TextField
            label="상품품목코드 (pdItmsCd)"
            hint={`고시 품목. ${LOTTEON_CHILD_PRODUCT_ITEM_CODE} = 어린이제품(유아동) — 이 경우 ④ 안전인증이 필수입니다.`}
            value={form.notice.itemCode}
            onChange={(value) => patch("notice", { itemCode: value })}
          />
          <TextAreaField
            label="고시 항목 (pdItmsArtlLst)"
            hint="한 줄에 하나씩 `항목코드:내용`"
            placeholder={"0020:색상\n0060:제조국"}
            value={form.notice.articlesText}
            onChange={(value) => patch("notice", { articlesText: value })}
          />
        </div>
      </Section>

      {/* ── ④ 인증 ──────────────────────────────────────────────────────── */}
      <Section
        title="④ 안전인증 (롯데ON 전용)"
        description="인증번호는 실제 취득한 값만 사용할 수 있습니다 — 어떤 경우에도 자동 생성하지 않습니다."
      >
        {safetyRequired && (
          <p
            className={`mb-3 rounded-md px-3 py-2 text-[11px] ${
              safetyMissing ? "bg-error/5 text-error" : "bg-success/5 text-text-secondary"
            }`}
          >
            품목코드 {LOTTEON_CHILD_PRODUCT_ITEM_CODE}(어린이제품)이 선택되어 있습니다 —{" "}
            {safetyMissing ? "안전인증을 입력해야 등록할 수 있습니다." : "안전인증이 입력되어 있습니다."}
          </p>
        )}
        <div className="grid gap-3">
          <TextAreaField
            label="안전인증 목록 (sftyAthnLst)"
            hint="한 줄에 하나씩 `유형코드:인증번호[:기관명]`"
            placeholder={"CHL_CFM:CB123456789"}
            value={form.certification.safetyText}
            onChange={(value) => patch("certification", { safetyText: value })}
          />
          <TextField
            label="수입대행코드 (impPrxCd)"
            hint="전기용품·생활용품 계열 KC 인증을 넣으면 필수 — PUR_PRX / PRL_IMP / NONE. 어린이제품(CHL_*)에는 필요 없습니다."
            value={form.certification.importProxyCode}
            onChange={(value) => patch("certification", { importProxyCode: value })}
          />
        </div>
      </Section>

      {/* ── ⑤ 배송 ──────────────────────────────────────────────────────── */}
      <Section
        title="⑤ 배송 (롯데ON 전용)"
        description="출고지 · 반품지 · 배송비 정책은 롯데ON 판매자센터에 먼저 등록해야 생기는 번호입니다. 우리가 만들 수 없습니다."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="출고지번호 (owhpNo)"
            hint="롯데ON에 선등록된 출고지"
            value={form.delivery.outboundPlaceNo}
            onChange={(value) => patch("delivery", { outboundPlaceNo: value })}
          />
          <TextField
            label="반품지번호 (rtrpNo)"
            hint="롯데ON에 선등록된 회수지"
            value={form.delivery.returnPlaceNo}
            onChange={(value) => patch("delivery", { returnPlaceNo: value })}
          />
          <TextField
            label="배송비정책번호 (dvCstPolNo)"
            hint="롯데ON에 선등록된 배송비 정책"
            value={form.delivery.deliveryCostPolicyNo}
            onChange={(value) => patch("delivery", { deliveryCostPolicyNo: value })}
          />
          <TextField
            label="배송가능지역코드 (dvRgsprGrpCd)"
            hint="공통코드 DV_RGSPR_GRP_CD"
            value={form.delivery.deliveryRegionGroupCode}
            onChange={(value) => patch("delivery", { deliveryRegionGroupCode: value })}
          />
          <TextField
            label="택배사코드 (hdcCd)"
            hint="공통코드 DV_CO_CD (예: 0001 롯데택배)"
            value={form.delivery.courierCode}
            onChange={(value) => patch("delivery", { courierCode: value })}
          />
          <TextField
            label="반품택배사코드 (rtngHdcCd)"
            value={form.delivery.returnCourierCode}
            onChange={(value) => patch("delivery", { returnCourierCode: value })}
          />
          <TextField
            label="평일 발송마감시간"
            hint="HHMM · 분은 00 또는 30만"
            value={form.delivery.weekdayCloseTime}
            onChange={(value) => patch("delivery", { weekdayCloseTime: value })}
          />
        </div>
      </Section>

      {/* ── 그 밖의 롯데ON 코드 ─────────────────────────────────────────── */}
      <Section
        title="그 밖의 롯데ON 코드"
        description="원산지·과세·브랜드는 롯데ON 코드체계를 따릅니다 — 상품정보의 원산지 텍스트로는 코드를 정할 수 없습니다."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="원산지코드 (oplcCd)"
            hint="공통코드 OPLC_CD"
            value={form.codes.originCode}
            onChange={(value) => patch("codes", { originCode: value })}
          />
          <TextField
            label="과세유형코드 (tdfDvsCd)"
            hint="01 과세 · 02 면세 · 03 영세 · 04 해당없음"
            value={form.codes.taxTypeCode}
            onChange={(value) => patch("codes", { taxTypeCode: value })}
          />
          <TextField
            label="브랜드번호 (brdNo)"
            hint="속성모듈(204) 조회 결과. 없으면 비워둡니다"
            value={form.codes.brandNo}
            onChange={(value) => patch("codes", { brandNo: value })}
          />
          <TextField
            label="업체상품번호 (epdNo)"
            hint="우리 쪽 식별자. 등록 후 상품 상태 조회(93)에 씁니다"
            value={form.codes.externalProductNo}
            onChange={(value) => patch("codes", { externalProductNo: value })}
          />
        </div>
      </Section>

      {/* ── 검증 · 등록 ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={previewing} onClick={() => void runValidation()}>
          {previewing ? "확인 중…" : "등록 정보 확인"}
        </Button>
        <Button variant="primary" size="sm" disabled={!validation?.ok || registering} onClick={() => void runRegister()}>
          {registering ? "등록 중…" : "롯데ON에 등록"}
        </Button>
        {!validation?.ok && (
          <span className="text-[11px] text-text-tertiary">등록 정보 확인을 통과해야 등록 버튼이 열립니다.</span>
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
            등록 정보 확인 — 준비 {validation.readyCount} · 누락 {validation.missingCount} · 차단{" "}
            {validation.blockedCount}
          </p>
          <ul className="space-y-1 text-xs">
            {validation.fields.map((field) => (
              <li key={field.field} className="flex gap-2">
                <span
                  className={
                    field.status === "READY" ? "text-success" : field.status === "BLOCKED" ? "text-error" : "text-warning"
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
          <p className="text-xs text-text-tertiary">
            실제로 롯데ON에 전송될 데이터입니다 — 등록 버튼을 누르기 전에도 항상 최신 상태로 계산되어 있습니다.
          </p>
          {/* 개발자용 원문 확인은 유지하고 이름만 스마트스토어/쿠팡 탭과 맞춘다. */}
          <button
            type="button"
            onClick={() => setShowPayload((prev) => !prev)}
            className="mt-1 text-xs font-medium text-text-secondary underline decoration-border hover:text-text-primary"
          >
            {showPayload ? "전송 데이터 원문 닫기" : "▶ 전송 데이터 원문 보기 (LotteON 87 Request)"}
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

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-text-tertiary">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 조회 결과. 알아본 항목은 버튼으로, 못 알아본 것은 원문 그대로 보여준다 —
 * 지어낸 파싱으로 "결과 없음"을 만들지 않는다(lotteon-channel-form.ts 참고). */
function CategoryLookup({
  title,
  state,
  onLookup,
  onPick,
}: {
  title: string;
  state: CategoryLookupState;
  onLookup: () => void;
  onPick: (code: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text-secondary">{title}</span>
        <Button variant="secondary" size="sm" disabled={state.loading} onClick={onLookup}>
          {state.loading ? "조회 중…" : "조회"}
        </Button>
      </div>
      {state.error && <p className="mt-2 text-[11px] text-error">{state.error}</p>}
      {state.options.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto">
          {state.options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onClick={() => onPick(option.code)}
                className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-text-secondary hover:bg-background"
              >
                <span className="font-mono text-text-primary">{option.code}</span> {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.unrecognized.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-warning">
            응답 {state.unrecognized.length}건의 필드 구조를 아직 확인하지 못했습니다 — 원문을 그대로 보여줍니다.
          </p>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-[10px] text-text-tertiary">
            {JSON.stringify(state.unrecognized.slice(0, 5), null, 2)}
          </pre>
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
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-text-secondary">{label}</span>
      <textarea
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none"
      />
      {hint && <span className="text-[11px] text-text-tertiary">{hint}</span>}
    </label>
  );
}
