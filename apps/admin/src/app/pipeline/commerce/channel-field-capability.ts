import { CHANNEL_CAPABILITY } from "./channel-lifecycle";
import type { CommerceId } from "./commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-2(CEO 지시, 2026-09-26) — **이 채널에서 «무엇을» 고칠 수 있나.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 수정 화면과 우측 요약이 「수정 가능 / 수정 불가」를 보여주려면 그 목록이
 * 어딘가에 있어야 한다. 🔴 그것을 «화면에 하드코딩하지 않는다»(CEO 명시).
 * 화면에 박으면 capability 표가 바뀌어도 화면은 옛말을 계속 한다 — 그리고
 * 셀러는 화면을 믿는다.
 *
 * ── 🔴 두 번째 진실을 만들지 않는다 ─────────────────────────────────────
 * 이 파일은 «새로운 표가 아니라» `CHANNEL_CAPABILITY` 에서 «파생» 된다.
 * 채널이 수정을 지원하는지는 이미 그 표가 알고 있고, 여기서 다시 판단하면
 * 「lifecycle 은 BLOCKED 라는데 화면은 수정 가능이라고 말하는」 상태가 된다.
 *
 *     CHANNEL_CAPABILITY.update          → 일반 필드가 고쳐지는가
 *     CHANNEL_CAPABILITY.categoryUpdate  → 카테고리가 고쳐지는가
 *
 * ── 🔴 물음표를 ○ 로 만들지 않는다 ──────────────────────────────────────
 * Coupang·LotteON 의 update 는 «UNKNOWN» 이다. 「아직 확인 안 됨」이지
 * 「안 됨」이 아니고, 「됨」은 더더욱 아니다. 그래서 필드 단위에서도 UNKNOWN 이
 * 그대로 내려온다 — 화면은 「수정 가능」이라고 «말하지 않는다».
 */

/** 이 필드를 지금 고칠 수 있는가. */
export type FieldCapability =
  /** 고칠 수 있다 — 수정 요청에 실려 반영된다. */
  | "EDITABLE"
  /** 🔴 수정으로는 안 되고 «새 상품으로 다시 등록» 해야 바뀐다. */
  | "RECREATE_ONLY"
  /** 🔴 아직 «확인되지 않았다». 「안 됨」이 아니다. */
  | "UNKNOWN";

/**
 * 수정 화면이 다루는 필드. 🔴 payload 필드가 아니라 «셀러가 아는 단위» 다 —
 * 화면이 보여줄 목록이므로 사람의 말로 나눈다.
 */
export type EditableField =
  | "name"
  | "salePrice"
  | "stockQuantity"
  | "detailContent"
  | "images"
  | "options"
  | "providedNotice"
  | "category";

export const FIELD_LABEL: Record<EditableField, string> = {
  name: "상품명",
  salePrice: "판매가격",
  stockQuantity: "재고",
  detailContent: "상세설명",
  images: "이미지",
  options: "옵션",
  providedNotice: "상품정보제공고시",
  category: "카테고리",
};

/** 🔴 화면 순서도 여기서 정한다 — 채널마다 다른 순서로 보이면 안 된다. */
export const FIELD_ORDER: readonly EditableField[] = [
  "name",
  "salePrice",
  "stockQuantity",
  "detailContent",
  "images",
  "options",
  "providedNotice",
  "category",
];

/**
 * 채널 × 필드 → 지금 고칠 수 있는가.
 *
 * 🔴 «파생» 이다. 새 사실을 여기서 만들지 않는다:
 *   · 카테고리는 `categoryUpdate` 를 따른다.
 *       SUPPORTED → EDITABLE / NOT_SUPPORTED·UNKNOWN → RECREATE_ONLY
 *       («불가» 로 확인된 것과 «미확인» 은 갈 곳이 같다 — 둘 다 수정으로는
 *        안 되고 재등록이 유일하게 확실한 길이다. 다만 셀러에게 «말하는 이유»
 *        는 resolveLifecycle 이 다르게 준다.)
 *   · 나머지는 `update` 를 따른다.
 *       SUPPORTED → EDITABLE / NOT_SUPPORTED → RECREATE_ONLY / UNKNOWN → UNKNOWN
 *
 * 🔴 필드별로 더 좁힐 근거가 생기면 «그때» 예외를 둔다. 지금 없는 근거로
 * 「이 필드만 되고 저건 안 된다」를 지어내지 않는다.
 */
export function fieldCapability(commerceId: CommerceId, field: EditableField): FieldCapability {
  const cap = CHANNEL_CAPABILITY[commerceId];
  if (field === "category") {
    return cap.categoryUpdate === "SUPPORTED" ? "EDITABLE" : "RECREATE_ONLY";
  }
  if (cap.update === "SUPPORTED") return "EDITABLE";
  if (cap.update === "NOT_SUPPORTED") return "RECREATE_ONLY";
  /* 🔴 「아직 확인 안 됨」을 「수정 가능」으로 올리지 않는다.
     그리고 모르는 값이 새로 생겨도 여기로 떨어진다 — 안전한 쪽이 기본이다. */
  return "UNKNOWN";
}

export interface ChannelEditScope {
  /** 고칠 수 있는 항목 — 화면의 「수정 가능」 목록. */
  editable: EditableField[];
  /** 수정으로는 안 되는 항목 — 「수정 불가」 목록(이유와 함께). */
  recreateOnly: EditableField[];
  /** 🔴 아직 확인되지 않은 항목. «수정 가능이라고 말하지 않는다». */
  unknown: EditableField[];
}

/** 화면이 그대로 그릴 수 있게 세 묶음으로 나눠 준다. */
export function channelEditScope(commerceId: CommerceId): ChannelEditScope {
  const scope: ChannelEditScope = { editable: [], recreateOnly: [], unknown: [] };
  for (const field of FIELD_ORDER) {
    const capability = fieldCapability(commerceId, field);
    if (capability === "EDITABLE") scope.editable.push(field);
    else if (capability === "RECREATE_ONLY") scope.recreateOnly.push(field);
    else scope.unknown.push(field);
  }
  return scope;
}

/** 화면이 쓰는 한 줄. 🔴 개발용 낱말을 쓰지 않는다. */
export function fieldCapabilityNote(capability: FieldCapability): string {
  switch (capability) {
    case "EDITABLE":
      return "수정할 수 있습니다.";
    case "RECREATE_ONLY":
      return "수정으로는 바꿀 수 없어 새 상품으로 다시 등록해야 합니다.";
    case "UNKNOWN":
      /* 🔴 「안 됩니다」가 아니다. 확인되지 않았다는 것이 사실이다. */
      return "이 커머스에서 수정할 수 있는지 아직 확인되지 않았습니다.";
  }
}

/**
 * ── F-14-4 변경 감지 ────────────────────────────────────────────────────
 *
 * 🔴 규칙은 한 줄이다: «고칠 수 있는 항목» 중 하나라도 값이 달라지면 수정할 수
 * 있다. 되돌리면 다시 못 한다.
 *
 * 🔴 고칠 수 «없는» 항목의 변화는 세지 않는다. 카테고리를 바꿔 놓고 「수정」을
 * 누를 수 있게 하면, 그 변경은 나가지도 않는데 셀러는 반영됐다고 믿는다 —
 * 그것이 이 프로젝트가 계속 고쳐 온 종류의 거짓말이다.
 */
export interface FieldChange {
  field: EditableField;
  label: string;
  /** 🔴 값이 없으면 «생략» 한다. 「-」로 채우면 빈 값으로 바뀐다고 읽힌다. */
  from?: string;
  to?: string;
}

/** 값 하나를 비교 가능한 꼴로. 🔴 빈 문자열과 없음을 같게 본다. */
function normalize(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function detectFieldChanges(
  commerceId: CommerceId,
  original: Partial<Record<EditableField, unknown>>,
  current: Partial<Record<EditableField, unknown>>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of FIELD_ORDER) {
    /* 🔴 고칠 수 있는 항목만 센다 — UNKNOWN·RECREATE_ONLY 는 제외. */
    if (fieldCapability(commerceId, field) !== "EDITABLE") continue;
    const before = normalize(original[field]);
    const after = normalize(current[field]);
    if (before === after) continue;
    changes.push({
      field,
      label: FIELD_LABEL[field],
      from: before === "" ? undefined : before,
      to: after === "" ? undefined : after,
    });
  }
  return changes;
}

/** 수정 버튼을 열어도 되는가. 🔴 변경이 «하나라도» 있어야 한다. */
export function canSubmitEdit(changes: readonly FieldChange[]): boolean {
  return changes.length > 0;
}
