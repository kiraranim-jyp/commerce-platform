"use client";

import type { ReactNode } from "react";
import type { FieldSource } from "@commerce/shared";
import { extractionSourceLabel, ProvenanceBadge } from "./provenance";

/**
 * REWORK-11 ①(CEO 판정, 2026-09-15: "섹션 순서가 같다를 통합 완료로 인정하지
 * 않는다") — **세 채널 등록 화면의 입력 한 줄을 그리는 곳은 여기 하나다.**
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────────────────
 * REWORK-10까지 세 탭의 섹션 제목·순서는 같아졌는데 **안이 달랐다.** 같은
 * "라벨 + 입력칸 + 설명 한 줄"을 두 벌이 그리고 있었다:
 *
 *   PlatformPreview (스마트스토어·쿠팡)   LotteOnRegistrationPanel (롯데ON)
 *   ────────────────────────────────    ────────────────────────────────
 *   FieldRow                            TextField / TextAreaField
 *   label  text-xs text-text-secondary  span text-xs font-medium …
 *   input  rounded px-2 py-1            input rounded-md px-3 py-1.5
 *   배지   ProvenanceBadge / StatusBadge RequirementBadge(전용 🔴/⚪ span)
 *   설명   text-[11px] text-text-tertiary span text-[11px] …
 *
 * 그래서 "순서는 같은데 롯데ON만 다르게 생긴" 화면이 됐다 — CEO가 열한 번
 * 지적한 그 차이다. 이 파일은 그 두 벌을 **한 벌로** 만든다.
 *
 * 🔴 새 디자인을 만들지 않았다. 아래 클래스는 전부 PlatformPreview가 쓰던 값
 * 그대로이고(스마트스토어·쿠팡 화면은 한 픽셀도 바뀌지 않는다), 롯데ON이 그
 * 쪽으로 맞춰 온다.
 *
 * ── REWORK-14(CEO 실측 판정 3회차, 2026-09-15) ───────────────────────────
 * 위 표에서 **「배지」 줄만 그대로 남아 있었다.** 컴포넌트는 한 벌이 됐는데
 * 그 안에 넣는 «물건»이 두 벌이었다 — 쿠팡은 값의 출처(테두리 알약), 롯데ON은
 * 필수 여부(이모지 + 맨 글자). 앞선 두 번의 parity 작업이 «그릇»만 재고
 * 통과시킨 자리가 정확히 여기다. 이제 넣는 물건도 한 벌이다(`requirementBadge`).
 */

/** 입력칸 한 벌. 세 탭의 모든 input/textarea가 이 클래스를 쓴다. */
export const FIELD_INPUT_CLASS =
  "w-full rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none";

/**
 * 라벨 오른쪽에서 «출처»가 서는 자리. 쿠팡이 처음부터 쓰던 값이고, 값이
 * 바뀌지 않았다 — 글자로 한 번 적어 롯데ON의 읽기 전용 행도 같은 길을 쓰게
 * 하려고 상수가 됐을 뿐이다.
 */
const SOURCE_SLOT_CLASS =
  "flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] leading-snug text-text-tertiary";

/**
 * Sprint A-3(작업1 — 모든 항목 Editable, 작업8 — Resolver Trace) 필드 라벨 행.
 * SourceDataView가 이미 쓰던 "라벨 + 값 + Source + Confidence" 패턴을 accordion
 * 안에서도 그대로 쓴다 — 새 렌더링 방식을 또 만들지 않는다.
 *
 * REWORK-11 — `badge`와 `note`가 붙었다. 롯데ON의 「🔴 필수 / ⚪ 선택」과 코드
 * 힌트(`공통코드 DV_CO_CD` 등)가 설 자리가 없어서 그 탭이 자기 행 컴포넌트를
 * 따로 갖고 있었기 때문이다. 슬롯 두 개를 여기 열어 주면 롯데ON이 이 행을
 * 그대로 쓸 수 있고, 스마트스토어·쿠팡은 두 슬롯을 안 쓰므로 렌더 결과가
 * 이전과 완전히 같다.
 */
export function FieldRow({
  label,
  labelSuffix,
  field,
  required,
  originLabel,
  badge,
  note,
  children,
}: {
  label: string;
  /** 라벨 바로 뒤(ⓘ 툴팁 등). 라벨 글자 자체는 건드리지 않는다 — 테스트와
   *  스크롤 목적지가 라벨 문자열로 자리를 찾는다. */
  labelSuffix?: ReactNode;
  field?: { source: FieldSource; confidence: number };
  required?: boolean;
  /**
   * REWORK-14 — «어디서 온 값인가»를 **글자로만** 말하는 자리.
   *
   * `field`가 있는 칸에서는 이 말을 `extractionSourceLabel`이 만들어 알약 왼쪽에
   * 세운다("사용자 입력 [사용자 확정]"). 롯데ON의 읽기 전용 행은 알약으로 말할
   * 출처(FieldSource)가 없고 "상품정보 · 브랜드"라는 **경로**만 있는데, 지금까지
   * 그 글자를 `badge`로 밀어 넣어 쿠팡과 다른 자리·다른 서체로 서 있었다:
   *
   *   쿠팡    span.flex … gap-1 … text-[11px] leading-snug text-text-tertiary > span
   *   롯데ON  span.flex … whitespace-nowrap                > span.text-[11px] text-text-tertiary
   *
   * 이제 같은 글자는 같은 길로 간다. 🔴 쿠팡은 이 prop을 쓰지 않으므로 그 탭의
   * 렌더 결과는 한 바이트도 바뀌지 않는다.
   */
  originLabel?: string;
  /** 라벨 오른쪽. `field`(추출 출처)가 없을 때만 쓴다 — 두 개가 같이 서면 줄이 길어진다. */
  badge?: ReactNode;
  /** 입력칸 아래 한 줄(코드 체계 힌트 등). 문단이 아니라 **한 줄**이다. */
  note?: ReactNode;
  children: ReactNode;
}) {
  /* REWORK-12 ③(CEO 실측 캡처, 2026-09-15: "내용 많아지면서 정렬 및 텍스트가
     깨져") — 세 가지가 같은 한 줄에서 서로를 밀고 있었다:

       · 긴 라벨("모델명(고시정보 + 네이버 쇼핑 카탈로그)")이 칸을 넘쳐 잘렸다
       · 「입력 필요」 배지가 shrink 가능해서 라벨에 밀려 두 줄로 쪼개졌다
       · 출처 글자가 값이 없을 때도 "—" 한 글자를 차지해 줄을 더 좁혔다

     고친 방법은 폭 규칙 셋뿐이다(새 디자인이 아니다):
       라벨 쪽  min-w-0 flex-1 + 줄바꿈 허용 → 넘치면 **두 줄로 흐른다**(잘리지 않는다)
       배지 쪽  shrink-0 whitespace-nowrap  → 절대 쪼개지지 않는다
       출처     말할 것이 없으면(—) 아예 그리지 않는다

     그리고 칸 자체가 `h-full flex-col`이 된다. 3열 격자에서 한 칸만 세로로
     커지면(예: 참조 안내가 붙은 모델명) 같은 줄의 다른 칸은 위로 붙어 입력칸
     높이가 들쭉날쭉해 보였다 — 이제 안내는 `mt-auto`로 **칸 바닥**에 서므로
     같은 줄의 입력칸들이 같은 높이에서 시작한다. */
  const sourceLabel = field ? extractionSourceLabel(field) : "";
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-2">
        {/* labelSuffix(ⓘ)는 `<label>` **밖**이다 — 안에 넣으면 그 칸의 이름이
            "제조사 + 툴팁 전문"이 되어버린다(라벨 문자열로 자리를 찾는 검사와
            보조기술 양쪽이 다 어긋난다). */}
        <span className="flex min-w-0 flex-1 items-start">
          <label className="min-w-0 break-words text-xs leading-snug text-text-secondary">
            {label}
            {required && <span className="ml-0.5 text-error">*</span>}
          </label>
          {labelSuffix}
        </span>
        {field ? (
          <span className={SOURCE_SLOT_CLASS}>
            {sourceLabel && sourceLabel !== "—" && <span>{sourceLabel}</span>}
            <ProvenanceBadge source={field.source} />
          </span>
        ) : originLabel ? (
          <span className={SOURCE_SLOT_CLASS}>
            <span>{originLabel}</span>
          </span>
        ) : (
          badge && <span className="flex shrink-0 items-center whitespace-nowrap">{badge}</span>
        )}
      </div>
      <div className="mt-0.5">{children}</div>
      {note && <p className="mt-auto pt-0.5 text-[11px] leading-relaxed text-text-tertiary">{note}</p>}
    </div>
  );
}

/**
 * REWORK-11 — 값을 **읽기만** 하는 한 줄.
 *
 * 롯데ON의 ① 기본 상품정보 · ③ 옵션 · ④ 가격 · ⑨ 상세설명이 전부 이 모양이다
 * (공통값이라 그 탭에서 입력받지 않는다 — three-layer-realign.test.ts 증명 1).
 * 예전에는 `<dl>` 표였다: 같은 자리가 스마트스토어·쿠팡에서는 라벨+입력칸,
 * 롯데ON에서는 정의 목록이라 한눈에 다른 화면으로 보였다.
 *
 * 🔴 input을 만들지 않는다 — 그것이 이 컴포넌트의 계약이다. 대신 입력칸과
 * **같은 틀**(같은 테두리·여백·글자 크기)에 값을 얹어 자리만 맞춘다.
 */
export function ReadOnlyFieldRow({
  label,
  value,
  placeholder,
  origin,
  note,
  referenced = false,
  children,
}: {
  label: string;
  value: string;
  /** 값이 없을 때 그 자리에서 할 말(예: "상품정보에서 채워주세요"). */
  placeholder: string;
  /** 어디서 온 값인가 — 라벨 오른쪽의 작은 글자. */
  origin?: string;
  note?: ReactNode;
  /**
   * ══ COMMERCE-UI-PARITY-02 P0-3(CEO 실측 캡처, 2026-09-22) ══
   *
   * 이 칸이 «비어 있는» 것이 아니라 **등록 시점에 상세페이지를 가리켜 채워지는**
   * 상태인가(= 공통 필드의 `source === "DETAIL_PAGE_REFERENCE"`).
   *
   * 🔴 빈 값과 같은 자리에 같은 색으로 서면 안 된다. 셀러가 상품 정보 탭에서
   * 「선택 N건 상세페이지 참조로 일괄 등록」을 이미 눌러 처리를 끝낸 칸인데,
   * 화면이 「입력 필요 — 상품정보에서 채워주세요」라고 말하면 방금 한 일을
   * 안 한 일로 되돌려 말하는 것이고 셀러는 같은 일을 또 하러 간다.
   *
   * 문구와 껍데기는 쿠팡이 이미 쓰던 것 그대로다(PlatformPreview L117-119 —
   * 점선 테두리 + selected 계열 + 「상세페이지 참조로 등록됩니다」). 새 문장을
   * 쓰지 않는다. 세 채널이 같은 상태를 같은 말로 부르는 것이 이 작업의 목적이다.
   */
  referenced?: boolean;
  children?: ReactNode;
}) {
  const filled = value.trim().length > 0;
  return (
    <FieldRow label={label} originLabel={origin} note={note}>
      {referenced && !filled ? (
        <div
          data-readonly-field="true"
          data-field-state="detail-page-reference"
          className={`${FIELD_INPUT_CLASS} min-h-[1.875rem] break-words border-dashed border-selected-border bg-selected-soft text-selected`}
        >
          상세페이지 참조로 등록됩니다
        </div>
      ) : (
        <div
          data-readonly-field="true"
          className={`${FIELD_INPUT_CLASS} min-h-[1.875rem] break-words bg-background ${
            filled ? "text-text-primary" : "text-warning"
          }`}
        >
          {filled ? value : placeholder}
        </div>
      )}
      {children}
    </FieldRow>
  );
}

/**
 * 그 필드가 서버 검증 결과에 이름으로 올라와 있는가.
 *
 * 🔴 **판정을 여기서 만들지 않는다.** 롯데ON 서버 검증(validateLotteOnPayload)은
 * `ok = missingCount === 0 && blockedCount === 0`이다 — 검증이 한 번이라도
 * 들여다본 필드는 전부 등록을 막는다. 그래서 "그 필드가 검증 결과에 이름으로
 * 올라와 있는가"가 그대로 필수/선택이 된다. 검증 전에는 undefined —
 * 모르는 것을 필수라고도 선택이라고도 적지 않는다.
 */
export type FieldRequirement = "REQUIRED" | "OPTIONAL" | undefined;

/**
 * REWORK-14(CEO 실측 판정 3회차, 2026-09-15: "롯데ON ⑤배송이 아직 다르다") —
 * **「🔴 필수」·「○ 선택 — 없어도 등록 가능」 두 배지가 사라진 자리.**
 *
 * ── 무엇이 달랐나(jsdom 좌측 상세 전수, 수정 전) ─────────────────────────
 *   재는 것                       쿠팡 · 스마트스토어     롯데ON
 *   ───────────────────────────  ─────────────────────  ──────────────────
 *   필수 표시                     라벨 뒤 빨간 `*` 3건    0건
 *   「🔴 필수」 배지              0건                     2건
 *   「○ 선택 — 없어도 등록 가능」  0건                     13건
 *   배지 알약(ProvenanceBadge)    13건                    0건
 *
 * 같은 `FieldRow`의 **같은 자리**에 한쪽은 «값의 출처»(테두리 알약)를, 다른
 * 한쪽은 «필수 여부»(이모지 + 맨 글자)를 세우고 있었다. CEO가 캡처에서 읽은
 * 「● 필수」와 「[입력 필요]」가 정확히 이 둘이다.
 *
 * 🔴 새 모양을 만들지 않았다. 아래는 전부 쿠팡이 **이미 쓰던 말버릇**이다:
 *   필수다            라벨 뒤 빨간 `*`      (FieldRow의 `required`)
 *   필수인데 비었다    「입력 필요」 알약     (ProvenanceBadge source="REQUIRED")
 *   선택이다          **아무것도 적지 않는다**
 *
 * 마지막 줄이 핵심이다. 쿠팡에는 "선택"이라고 적는 칸이 한 곳도 없다 — 별표가
 * 없는 것이 곧 "없어도 된다"는 뜻이다. 롯데ON에만 있던 「○ 선택 — 없어도 등록
 * 가능」은 그래서 **없던 UI 패턴을 한 채널에만 새로 만든 것**이었다. 정보가
 * 사라지는 것이 아니라 세 탭이 같은 말버릇을 쓰게 되는 것이다.
 */
function requirementBadge(requirement: FieldRequirement, value: string): ReactNode {
  if (requirement !== "REQUIRED") return undefined;
  // 이미 채워진 필수 칸에는 쿠팡도 「입력 필요」를 붙이지 않는다.
  return value.trim().length > 0 ? undefined : <ProvenanceBadge source="REQUIRED" />;
}

/**
 * 라벨 뒤에 접히는 **API 필드명**.
 *
 * REWORK-14 — 지금까지 롯데ON 라벨 14개가 「출고지번호 (owhpNo)」였다. 쿠팡·
 * 스마트스토어 라벨에는 그런 병기가 0건이라 같은 자리의 글자 조판이 탭마다
 * 달랐다(서버 검증이 부르는 이름조차 그냥 「출고지번호」다).
 *
 * 🔴 코드를 버리지 않는다 — 쿠팡이 이미 쓰는 ⓘ(InfoTip) 안으로 들어가
 * `title`과 `sr-only`에 그대로 남는다. 눈에 보이는 라벨만 사람이 읽는 이름이
 * 되고, 형식은 쿠팡도 그대로 쓸 수 있는 것 하나다.
 */
function apiCodeTip(code: string | undefined): ReactNode {
  return code ? <InfoTip text={`롯데ON API 필드명 ${code}`} label="API 필드명" /> : undefined;
}

/**
 * 채널 고유 코드 입력 한 줄(롯데ON의 owhpNo · oplcCd 등).
 *
 * 값이 바뀌는 즉시 onChange를 부른다(EditableText의 blur-commit이 아니다) —
 * 롯데ON 폼은 입력이 바뀌는 순간 직전 검증 결과를 stale로 표시해야 하고,
 * blur까지 기다리면 "고쳤는데 여전히 통과로 보이는" 창이 생긴다.
 */
export function ChannelCodeField({
  label,
  code,
  note,
  value,
  onChange,
  requirement,
  placeholder,
  belowInput,
}: {
  label: string;
  /** 이 칸이 실어 보내는 API 필드명. 라벨이 아니라 ⓘ 안에 선다. */
  code?: string;
  note?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  requirement?: FieldRequirement;
  placeholder?: string;
  /**
   * REWORK-14 — 입력칸 **아래**에 서는 보조 컨트롤(목록에서 고르기 등).
   *
   * 쿠팡이 「상세페이지 참조로 등록」 버튼을 두는 자리와 같다(`div.space-y-1`
   * 안, 입력칸 바로 밑). 전에는 이런 컨트롤이 도움말 줄(`note`) **안**에
   * 들어가 있어서, 회색 안내 문장이 서야 할 자리에 전폭 `select`와 버튼 칩이
   * 서는 롯데ON 전용 모양이 됐다 — 쿠팡의 `note`는 글자만 담는다.
   */
  belowInput?: ReactNode;
}) {
  const input = (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={FIELD_INPUT_CLASS}
    />
  );
  return (
    <FieldRow
      label={label}
      labelSuffix={apiCodeTip(code)}
      required={requirement === "REQUIRED"}
      badge={requirementBadge(requirement, value)}
      note={note}
    >
      {belowInput ? (
        <div className="space-y-1">
          {input}
          {belowInput}
        </div>
      ) : (
        input
      )}
    </FieldRow>
  );
}

export function ChannelCodeTextArea({
  label,
  code,
  note,
  value,
  onChange,
  requirement,
  placeholder,
  rows = 4,
}: {
  label: string;
  code?: string;
  note?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  requirement?: FieldRequirement;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FieldRow
      label={label}
      labelSuffix={apiCodeTip(code)}
      required={requirement === "REQUIRED"}
      badge={requirementBadge(requirement, value)}
      note={note}
    >
      {/* REWORK-14 — `font-mono`가 빠졌다. 쿠팡의 입력칸 클래스는
          FIELD_INPUT_CLASS 한 벌뿐인데 여기에만 한 조각이 더 붙어 있었다 —
          같은 칸이 탭마다 다른 서체로 서던 마지막 자리다. */}
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_INPUT_CLASS}
      />
    </FieldRow>
  );
}

/**
 * REWORK-11 ⑤(CEO 지시, 2026-09-15: "설명으로 화면을 채우지 마라") — **장문
 * 안내가 가는 곳.**
 *
 * 지금까지 정책 설명은 화면에 문단으로 눌러 있었다(제조사 3줄 · 모델명 4줄 ·
 * 불러오지 못한 항목 5줄). 셀러가 읽어야 할 한 줄이 그 안에 묻힌다.
 *
 * 🔴 **정보를 지우지 않는다.** 글자는 `title`(브라우저 툴팁)과 화면에 보이지
 * 않는 `sr-only` 텍스트 두 군데에 그대로 남는다 — 스크린리더·검색·테스트는
 * 계속 읽을 수 있고, 눈에 보이는 것은 ⓘ 하나뿐이다. 설명을 "없앴다"가 아니라
 * "접었다"이고, 그 차이가 중요하다(없애면 셀러가 왜 막혔는지 알 길이 사라진다).
 */
export function InfoTip({ text, label = "자세히" }: { text: string; label?: string }) {
  return (
    <span className="inline-flex items-center align-middle">
      <button
        type="button"
        title={text}
        aria-label={`${label} — ${text}`}
        data-info-tip="true"
        className="ml-1 rounded-full px-1 text-[11px] leading-none text-text-tertiary hover:text-text-secondary"
      >
        ⓘ
      </button>
      {/* 화면에는 없고 문서에는 있다 — 보조기술과 검사가 읽는 자리. */}
      <span className="sr-only">{text}</span>
    </span>
  );
}
