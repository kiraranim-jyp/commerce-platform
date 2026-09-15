"use client";

import { MANUFACTURER_SOURCE_LABEL } from "@commerce/listing";
import type { FieldSource } from "@commerce/shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EditableText } from "./EditableField";
import { ProvenanceBadge } from "./provenance";
import { FieldRow, FIELD_INPUT_CLASS, InfoTip } from "./registration-fields";
import type { ManufacturerResolutionState } from "./use-manufacturer-resolution";

/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사를 말하는 화면은 하나다.**
 * REWORK-11 ②·⑤(CEO 판정, 2026-09-15) — **그 하나가 값을 보여 준다.**
 *
 * ── REWORK-10이 못 고친 것 ───────────────────────────────────────────────
 * resolver도 배선도 맞았는데 CEO 화면에는 여전히 `제조사 미확인`이 떠 있었다.
 * 이유는 단순했다: **입력칸이 읽는 값과 판정이 읽는 값이 달랐다.**
 *
 *   입력칸  `product.manufacturer.value`          ← 원문에 없으면 빈 문자열
 *   안내문  `resolveManufacturer(...)`의 결과      ← 브랜드 프로필이 채운 값
 *
 * 그래서 브랜드 프로필에 제조사가 있어도 칸은 비어 있고 placeholder("제조사
 * 미확인")가 그대로 보였다. 아래 문단이 "브랜드 프로필의 제조사 X가 자동
 * 적용됩니다"라고 말해도, 셀러 눈에 먼저 들어오는 것은 **빈 칸**이다.
 *
 * 이제 칸이 resolver 결과를 그대로 보여준다. 값이 두 벌 저장되는 것이 아니다 —
 * `product.manufacturer`는 그대로 비어 있고(원문에 없는 게 사실이다), 화면은
 * **등록에 실제로 나갈 값**을 보여줄 뿐이다. 셀러가 그 칸에 다른 값을 치면
 * 그때 `product.manufacturer`가 생기고 그 값이 우선한다(resolver ①).
 *
 * ── 장문 설명은 ⓘ로 접는다(REWORK-11 ⑤) ─────────────────────────────────
 * 여기 있던 3~4줄짜리 경고 문단이 한 줄로 줄었다. 지워진 것이 아니라 InfoTip
 * (title + sr-only)으로 옮겨 갔다 — 눈에 보이는 것은 ⓘ 하나지만 문서에는
 * 그대로 남아 있다.
 *
 * 🔴 값을 지어내지 않는다. NONE은 "어디까지 찾아봤는지"를 적고 실제 입력
 * 경로 두 개(이 칸 직접 입력 / Settings 브랜드 프로필)를 가리킨다.
 */

/* REWORK-12 ④·⑤(CEO 판정, 2026-09-15) — 세 문장이 전부 **한 줄**로 줄었다
   (128자→38자 · 61자→33자 · 54자→24자). 사라진 것은 "어떻게 고치는가"인데,
   그것은 ⓘ 뒤가 아니라 **화면에 보이는 한 줄**(note)로 나왔다 — 셀러가 실제로
   해야 하는 일을 툴팁 안에 접어 두는 것이 CEO가 지적한 그 문제였다. */

/** 셋 다 비었을 때 ⓘ 뒤에 접히는 문장. 세 탭이 같은 글자를 쓴다. */
export const MANUFACTURER_NONE_DETAIL =
  "상품 원문 · 브랜드 프로필 · 판매자 기본정보 어디에도 제조사가 없습니다.";

/** 조회가 아직 안 끝났을 때. */
export const MANUFACTURER_LOADING_DETAIL =
  "상품 원문 → 브랜드 프로필 → 판매자 기본정보 순서로 찾는 중입니다.";

/** 폴백이 채웠을 때 ⓘ 뒤에 접히는 문장. */
export const MANUFACTURER_AUTO_DETAIL = "상품 원문에 없어 자동으로 채워진 값입니다.";

/**
 * REWORK-12 ④ — **폴백이 답하지 못했을 때 화면에 보이는 한 줄.**
 *
 * CEO 캡처의 상태(C 판정)가 이것이다: resolver 배선은 맞는데 조회할 데이터가
 * 실제로 없다. 그러면 화면은 그 사실과 **다음 행동**을 말해야 한다.
 *
 * 브랜드가 비어 있는 경우를 따로 가르는 이유: 브랜드 프로필은 브랜드 이름으로
 * 찾는다. 이름이 없으면 «브랜드 프로필에 등록하세요»는 실행 불가능한 안내다.
 */
export function manufacturerNoneNote(brand: string | undefined): string {
  const name = (brand ?? "").trim();
  return name
    ? `⚠ 브랜드 「${name}」에 등록된 제조사가 없습니다 — 직접 입력하거나 설정 > 브랜드 프로필에 등록하세요`
    : "⚠ 브랜드가 확인되지 않아 브랜드 프로필을 조회하지 못했습니다 — 제조사를 직접 입력해주세요";
}

/**
 * 화면(그리고 payload)이 실제로 쓰게 될 제조사.
 *
 * 🔴 판정을 새로 하지 않는다 — 공통 resolver가 이미 ① 상품 원문을 최우선으로
 * 두고 계산한 결과가 `resolution.value`다. 여기서 하는 일은 "참조로 등록"을
 * 고른 칸만 비워 두는 것뿐이다(그 칸은 값이 아니라 문구로 나간다).
 */
export function manufacturerDisplayValue(
  field: { value: string; source: FieldSource },
  resolution: ManufacturerResolutionState,
): string {
  if (field.source === "DETAIL_PAGE_REFERENCE") return "";
  return field.value.trim() || (resolution.resolved ? resolution.value : "");
}

interface ManufacturerViewState {
  /** 입력칸/읽기칸에 보이는 값. */
  value: string;
  /** 입력칸 아래 한 줄. 없으면 아무것도 그리지 않는다. */
  note: string | null;
  /** ⓘ 뒤에 접히는 글. */
  tip: string | null;
  badge: "PRODUCT" | "AUTO" | "LOADING" | "NONE";
}

function viewStateOf(
  field: { value: string; source: FieldSource },
  resolution: ManufacturerResolutionState,
): ManufacturerViewState {
  const value = manufacturerDisplayValue(field, resolution);
  /* resolution.source === "PRODUCT"도 같은 자리다 — 답한 것이 상품 원문이면
     칸에 이미 그 값이 보이므로 같은 말을 한 줄 더 적지 않는다. */
  const fromProduct = field.value.trim().length > 0 || resolution.source === "PRODUCT";

  if (fromProduct) return { value, note: null, tip: null, badge: "PRODUCT" };
  if (resolution.loading) {
    return { value, note: "제조사 출처를 확인하고 있습니다…", tip: MANUFACTURER_LOADING_DETAIL, badge: "LOADING" };
  }
  if (resolution.resolved) {
    return {
      value,
      note: `🔵 ${MANUFACTURER_SOURCE_LABEL[resolution.source]}의 제조사 ${resolution.value}가 자동 적용됩니다`,
      tip: MANUFACTURER_AUTO_DETAIL,
      badge: "AUTO",
    };
  }
  /* REWORK-12 ④ — 여기서 note가 null이던 것이 CEO가 본 화면이다: 칸에는
     「제조사 미확인」, 배지에는 「입력 필요」, 그리고 **왜 그런지는 ⓘ 안에**.
     이제 어디까지 찾아봤는지와 다음 행동이 화면에 그대로 선다. */
  return { value, note: manufacturerNoneNote(resolution.brand), tip: MANUFACTURER_NONE_DETAIL, badge: "NONE" };
}

function badgeNode(state: ManufacturerViewState["badge"], field: { value: string; source: FieldSource }) {
  if (field.source === "DETAIL_PAGE_REFERENCE") return <ProvenanceBadge source="DETAIL_PAGE_REFERENCE" />;
  if (state === "PRODUCT") return field.value.trim() ? <ProvenanceBadge source={field.source} /> : null;
  if (state === "AUTO") return <StatusBadge status="success" label="자동 적용" />;
  if (state === "LOADING") return <StatusBadge status="neutral" label="확인 중" />;
  return <ProvenanceBadge source="REQUIRED" />;
}

/**
 * 제조사 한 줄. **세 탭(스마트스토어 · 쿠팡 · 롯데ON)이 이 컴포넌트 하나를 쓴다.**
 *
 * 롯데ON은 공통값을 그 탭에서 입력받지 않으므로(three-layer-realign 증명 1)
 * `onCommit` 없이 부른다 — 그러면 입력칸 대신 같은 틀의 읽기 칸이 선다.
 * 라벨 · 배지 · 한 줄 안내 · ⓘ는 어느 탭에서나 글자 그대로 같다.
 */
export function ManufacturerField({
  field,
  resolution,
  onCommit,
  onSetReference,
}: {
  field: { value: string; source: FieldSource; confidence: number };
  resolution: ManufacturerResolutionState;
  /** 없으면 읽기 전용(롯데ON). */
  onCommit?: (value: string) => void;
  onSetReference?: (referenced: boolean) => void;
}) {
  const state = viewStateOf(field, resolution);
  const isReferenced = field.source === "DETAIL_PAGE_REFERENCE";

  return (
    <FieldRow
      label="제조사"
      labelSuffix={state.tip ? <InfoTip text={state.tip} /> : undefined}
      badge={badgeNode(state.badge, field)}
      note={state.note}
    >
      {isReferenced ? (
        <div className="flex items-center justify-between gap-2 rounded border border-dashed border-selected-border bg-selected-soft px-2 py-1 text-sm text-selected">
          <span>상세페이지 참조로 등록됩니다</span>
          {onSetReference && (
            <button type="button" className="shrink-0 text-[11px] underline" onClick={() => onSetReference(false)}>
              직접 입력으로 전환
            </button>
          )}
        </div>
      ) : onCommit ? (
        <div className="space-y-1">
          <EditableText
            value={state.value}
            onCommit={onCommit}
            placeholder="제조사 미확인"
            className={FIELD_INPUT_CLASS}
          />
          {onSetReference && (
            <button
              type="button"
              className="text-[11px] text-text-tertiary underline hover:text-text-secondary"
              onClick={() => onSetReference(true)}
            >
              상세페이지 참조로 등록
            </button>
          )}
        </div>
      ) : (
        <div
          data-readonly-field="true"
          className={`${FIELD_INPUT_CLASS} min-h-[1.875rem] break-words bg-background ${
            state.value ? "text-text-primary" : "text-warning"
          }`}
        >
          {state.value || "제조사 미확인"}
        </div>
      )}
    </FieldRow>
  );
}
