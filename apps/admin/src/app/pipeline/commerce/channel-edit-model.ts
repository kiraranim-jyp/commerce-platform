import type { NaverProductRegistrationPayload, RegisteredProductSnapshot } from "@commerce/listing";
import {
  FIELD_LABEL,
  FIELD_ORDER,
  canSubmitEdit,
  detectFieldChanges,
  fieldCapability,
  fieldCapabilityNote,
  type EditableField,
  type FieldCapability,
  type FieldChange,
} from "./channel-field-capability";
import type { CommerceId } from "./commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3(CEO 지시, 2026-09-26) — **지금 채널에 나가 있는 값.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 수정 화면이 「현재값」을 보여주고 「바뀌었다」를 판단하려면 기준값이 필요하다.
 * 그 기준값은 «채널에서 GET 한 것» 하나뿐이다:
 *
 *     ChannelProduct.external_product_id
 *       → fetchRegisteredProduct()   (F-2, GET 실측 완료)
 *       → ChannelEditModel           (이 파일)
 *       → editorFieldSchema()        (이 파일)
 *       → detectFieldChanges()       (F-14-4)
 *       → 변경 1개 이상 → 수정 버튼 활성화
 *
 * ── 🔴 Snapshot 을 기준값으로 쓰지 않는다 ────────────────────────────────
 * 이 프로젝트에는 「Snapshot」이 둘 있고 «둘 다» 기준값이 아니다:
 *
 *   ① `snapshots` 표 — 우리가 «수집·분석한» 원본 상품. 채널에 나가 있는 값이
 *      아니다. 셀러는 스마트스토어 관리자에서 «직접» 고칠 수 있고, 그 순간
 *      우리 수집값은 현재값이 아니게 된다.
 *   ② `RegisteredProductSnapshot` — GET 결과이지만 «수정 전 손실 검사»
 *      (detectUpdateDataLoss)를 위한 모양이다. 편집 화면의 기준값으로 그대로
 *      쓰면 「읽지 못한 것」과 「값이 없는 것」이 한 칸에서 섞인다.
 *
 * 그래서 이 파일은 ②를 «재료로» 받아 «다른 타입» 을 만든다. 같은 타입을
 * 재사용하면 기준값의 출처가 코드에서 사라지고, 그 붕괴는 화면에 보이지 않는다.
 * `source.kind` 를 필수로 둔 이유가 그것이다 — 출처를 적지 않으면 못 만든다.
 */

/** 이 값이 «어디서» 왔는가. 🔴 생략할 수 없다. */
export interface ChannelEditSource {
  /** 🔴 채널 GET 뿐이다. 수집 Snapshot 으로 이 모델을 만들 길은 없다. */
  readonly kind: "CHANNEL_GET";
  readonly commerceId: CommerceId;
  /** 🔴 어느 상품을 읽은 것인지. 섞이면 남의 상품을 고친다(F-12b). */
  readonly externalProductId: string;
}

/** 이 항목을 «무엇으로» 대조하는가. 초안도 «같은 단위» 로 담아야 한다. */
export type CompareUnit =
  /** 값 그대로. */
  | "VALUE"
  /** 개수만 — 이미지·옵션. */
  | "COUNT"
  /** 있는지만 — 상품정보제공고시. */
  | "PRESENCE"
  /** 🔴 대조하지 않는다(읽지 못했다). */
  | "NONE";

/**
 * 한 항목의 기준값.
 *
 * 🔴 세 상태를 «절대» 합치지 않는다. 특히 UNREAD 를 「값 없음」으로 적으면,
 * 아무것도 안 고친 셀러에게 「빈 값으로 바뀝니다」라고 말하게 된다.
 */
export type EditBaseline =
  /** 읽었다 — 그대로 대조할 수 있다. */
  | { state: "OBSERVED"; value: string }
  /**
   * 🔴 일부만 대조할 수 있다. `value` 는 «개수·존재» 이고, `blind` 는 그 단위로
   * 는 «보이지 않는» 변경이다 — 대표이미지 교체가 그것이다(F-13 §표).
   */
  | { state: "PARTIAL"; value: string; unit: CompareUnit; blind: string }
  /** 🔴 «읽지 못했다». 「값이 없다」가 아니다. */
  | { state: "UNREAD"; reason: string };

export interface ChannelEditModel {
  readonly source: ChannelEditSource;
  readonly baseline: Readonly<Record<EditableField, EditBaseline>>;
}

/** 🔴 존재 여부는 두 글자로만 말한다 — 기준값과 초안이 «같은 말» 을 써야 한다. */
const PRESENT = "있음";
const ABSENT = "없음";

function unread(what: string): EditBaseline {
  /* 🔴 셀러에게 「없습니다」라고 말하지 않는다. 사실은 「읽지 못했다」다. */
  return { state: "UNREAD", reason: `지금 등록된 ${what}을(를) 읽지 못했습니다.` };
}

/**
 * GET 결과를 편집 기준값으로 «옮긴다». 새 사실을 만들지 않는다.
 *
 * 🔴 여기의 「읽었다」 기준은 `compareRegisteredProduct()` 보다 «좁다» —
 * 묻는 것이 다르다:
 *     compareRegisteredProduct  보낼 값과 다른가
 *     이 파일                    셀러에게 «현재값» 으로 보여줘도 되는가
 * 없는 값을 화면에 「없음」으로 쓰는 것은 관측이 아니라 추측이다. 그래서
 * `null` 을 값으로 받지 않고 UNREAD 로 둔다.
 */
export function buildChannelEditModel(
  source: ChannelEditSource,
  snapshot: RegisteredProductSnapshot,
): { ok: true; model: ChannelEditModel } | { ok: false; message: string } {
  /* 🔴 상품번호 없이 편집 화면을 열지 않는다. 「무엇을 고치는지」를 모르는
     화면은 아무것도 고치지 못하는 화면보다 위험하다(F-12b). */
  if (!source.externalProductId.trim()) {
    return { ok: false, message: "어느 상품을 수정하는지 알 수 없어 수정 화면을 열지 않았습니다." };
  }

  const text = (value: string | null | undefined, what: string): EditBaseline =>
    value === undefined || value === null ? unread(what) : { state: "OBSERVED", value: value.trim() };

  const number = (value: number | null | undefined, what: string): EditBaseline =>
    typeof value === "number" ? { state: "OBSERVED", value: String(value) } : unread(what);

  /* 개수 축. 🔴 읽지 못한 개수를 0 으로 적지 않는다 — 있던 것이 사라진다고
     읽히고, 아무것도 안 고친 셀러에게 「이미지가 없어집니다」가 된다. */
  const count = (value: number | undefined, what: string, plus: number, blind: string): EditBaseline =>
    typeof value === "number"
      ? { state: "PARTIAL", value: String(value + plus), unit: "COUNT", blind }
      : unread(what);

  return {
    ok: true,
    model: {
      source,
      baseline: {
        name: text(snapshot.name, "상품명"),
        salePrice: number(snapshot.salePrice, "판매가격"),
        stockQuantity: number(snapshot.stockQuantity, "재고"),
        detailContent: text(snapshot.detailContent, "상세설명"),
        /* 🔴 대표이미지는 «반영은 되고 감지는 안 되는» 축이다(F-13 §표).
           등록할 때마다 네이버에 재업로드돼 URL 이 항상 새 것이라, URL 로
           대조하면 아무것도 안 고쳐도 매번 「바뀜」이 된다. 그래서 개수만
           보고, 개수로는 보이지 않는 것을 `blind` 에 적어 둔다. */
        images: count(
          snapshot.optionalImageCount,
          "이미지",
          snapshot.representativeImageUrl ? 1 : 0,
          "이미지를 «같은 장수로» 교체하면 화면이 미리 알려드리지 못합니다. 바꾸신 내용은 그대로 반영됩니다.",
        ),
        options: count(
          snapshot.optionCombinationCount,
          "옵션",
          0,
          "옵션 «내용» 만 바꾸면 화면이 미리 알려드리지 못합니다. 바꾸신 내용은 그대로 반영됩니다.",
        ),
        providedNotice:
          typeof snapshot.hasProvidedNotice === "boolean"
            ? {
                state: "PARTIAL",
                value: snapshot.hasProvidedNotice ? PRESENT : ABSENT,
                unit: "PRESENCE",
                blind: "고시 «항목의 값» 만 바꾸면 화면이 미리 알려드리지 못합니다. 바꾸신 내용은 그대로 반영됩니다.",
              }
            : unread("상품정보제공고시"),
        category: text(snapshot.leafCategoryId, "카테고리"),
      },
    },
  };
}

/**
 * 보낼 payload 를 편집 화면의 초안으로 «투영» 한다.
 *
 * 🔴 초안의 출처는 `product`·`listing` 이 아니라 «보낼 payload» 다(CEO 확정,
 * 2026-09-26). 상품명은 빌더 안에서 파생 규칙을 거치는데(`smartStoreProductName`),
 * 원본 title 로 대조하면 화면은 「A → B」라고 말하고 실제로는 `B'` 가 나간다.
 * 화면과 전송이 갈리고, 그 갈림은 화면에 보이지 않는다.
 *
 * 🔴 이 함수가 `buildChannelEditModel` 과 «같은 파일에» 있는 이유: 두 곳이
 * 만드는 값은 단위가 같아야 한다(개수는 개수로, 존재는 같은 두 글자로).
 * 떨어져 있으면 한쪽만 고쳐져 아무것도 안 고쳐도 「바뀜」이 된다.
 */
export function channelEditDraftFromNaverPayload(
  payload: NaverProductRegistrationPayload,
): Partial<Record<EditableField, unknown>> {
  const origin = payload.originProduct;
  const images = origin?.images;
  return {
    name: origin?.name,
    salePrice: origin?.salePrice,
    stockQuantity: origin?.stockQuantity,
    detailContent: origin?.detailContent,
    /* 🔴 기준값과 «같은 셈» 이다 — 추가 이미지 + 대표 이미지 한 장. */
    images: (images?.optionalImages?.length ?? 0) + (images?.representativeImage ? 1 : 0),
    options: origin?.detailAttribute?.optionInfo?.optionCombinations?.length ?? 0,
    /* 존재 축 — 값이 아니라 «있는지» 가 초안이다. toComparable 이 두 글자로 바꾼다. */
    providedNotice: origin?.detailAttribute?.productInfoProvidedNotice,
    category: origin?.leafCategoryId,
  };
}

/**
 * 채널과 대조할 수 «없는» 축에서, 셀러가 이번에 «고쳤는지» 만 본다.
 *
 * 🔴 이것은 「채널 값과 다르다」가 아니다. 「우리 화면에서 달라졌다」다 —
 * 두 payload 가 «둘 다 우리 것» 이라 할 수 있는 말이고, 그래서 채널에 대한
 * 주장을 하지 않는다. 대표이미지를 같은 장수로 교체한 셀러는 개수로는 잡히지
 * 않고 이 신호로만 잡힌다(F-13 §표 「반영 ○ · 감지 ✗」).
 *
 * 🔴 여기서 JSON 비교를 쓰는 것이 `registered-change.ts` 가 금지한 것과
 * «다른» 이유: 그쪽은 서버가 정규화한 값과 우리 값을 비교해서 키 순서 하나로
 * 거짓 CHANGED 가 났다. 여기는 «같은 빌더가 같은 세션에서» 만든 두 payload 라
 * 정규화도 서버 개입도 없다. 그 조건이 깨지면 이 비교도 쓸 수 없다.
 *
 * @param before 수정 화면을 열 때의 payload  @param after 지금의 payload
 */
export function localTouchSignals(
  before: NaverProductRegistrationPayload,
  after: NaverProductRegistrationPayload,
): EditableField[] {
  /* 🔴 대조할 수 없는 세 축만 추린다. 나머지는 채널 값과 대조해서 알 수 있고,
     그 축까지 여기서 세면 「고쳤다」와 「원래 달랐다」가 섞인다. */
  const blind: EditableField[] = ["images", "options", "providedNotice"];
  return editedFieldsSinceLoad(before, after).filter((field) => blind.includes(field));
}

/** 한 축을 우리 payload 에서 꺼낸다. 🔴 `editedFieldsSinceLoad` 하나만 쓴다. */
const PAYLOAD_AXIS: Record<EditableField, (p: NaverProductRegistrationPayload) => unknown> = {
  name: (p) => p.originProduct?.name,
  salePrice: (p) => p.originProduct?.salePrice,
  stockQuantity: (p) => p.originProduct?.stockQuantity,
  detailContent: (p) => p.originProduct?.detailContent,
  images: (p) => p.originProduct?.images,
  options: (p) => p.originProduct?.detailAttribute?.optionInfo,
  providedNotice: (p) => p.originProduct?.detailAttribute?.productInfoProvidedNotice,
  category: (p) => p.originProduct?.leafCategoryId,
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-7 — **셀러가 «이번에» 고친 항목.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 「채널 값과 다르다」가 아니라 「수정 화면을 연 뒤 우리 화면에서 달라졌다」다.
 * 이 둘은 «전혀» 다른 질문이고, 섞은 것이 Production 사고의 원인이었다:
 *
 *   우리 Master 의 재고는 999, 채널의 재고는 7 이다. 셀러가 재고를 건드린 적이
 *   없어도 두 값은 다르다. 그것을 「고쳤다」로 읽으면 상품명 하나 고친 셀러에게
 *   「재고 7 → 999」가 같이 나간다.
 *
 * 그래서 비교 대상은 «둘 다 우리 payload» 다 — 수정 화면을 열 때의 것과 지금 것.
 * 같은 빌더가 같은 세션에서 만든 값이라 서버 정규화도 키 순서 문제도 없다
 * (`registered-change.ts` 가 JSON 비교를 금지한 조건과 다른 이유가 그것이다).
 */
export function editedFieldsSinceLoad(
  before: NaverProductRegistrationPayload,
  after: NaverProductRegistrationPayload,
): EditableField[] {
  return FIELD_ORDER.filter((field) => {
    const read = PAYLOAD_AXIS[field];
    return JSON.stringify(read(before) ?? null) !== JSON.stringify(read(after) ?? null);
  });
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-7 — **화면이 보는 초안 = 지금 등록된 값 + 고친 것.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 payload 를 «그대로» 초안으로 쓰면 안 된다. 그 안에는 셀러가 건드린 적 없는
 * Master 값이 전부 들어 있고(재고 999·상세설명 1835자), 채널 값과 대조하면 그것이
 * 몽땅 「변경사항」이 된다 — Production 에서 실제로 그렇게 보였다.
 *
 * 🔴 서버도 «같은 규칙» 으로 실제 payload 를 만든다(preserveRegisteredValues).
 * 화면이 보여주는 변경사항과 실제로 나가는 내용이 같아야 하므로, 규칙은 한
 * 문장이어야 한다 — 「고친 축은 내 값, 나머지는 지금 등록된 값」.
 */
export function channelEditDraft(
  model: ChannelEditModel,
  current: NaverProductRegistrationPayload,
  edited: readonly EditableField[],
): Partial<Record<EditableField, unknown>> {
  const projected = channelEditDraftFromNaverPayload(current);
  const draft: Partial<Record<EditableField, unknown>> = {};
  for (const field of FIELD_ORDER) {
    if (edited.includes(field)) {
      draft[field] = projected[field];
      continue;
    }
    /* 고치지 않은 축은 «지금 등록된 값» 그대로다 — 그래서 변경으로 잡히지 않는다.
       🔴 읽지 못한 축(UNREAD)은 비워 둔다. 대조하지 않는다는 뜻이고, 그 처리는
       evaluateEditGate 가 이미 한다(한쪽만 비우면 거짓 변경이 난다). */
    const baseline = model.baseline[field];
    if (baseline.state !== "UNREAD") draft[field] = baseline.value;
  }
  return draft;
}

/** 초안을 기준값과 «같은 단위» 로 만든다. 🔴 단위가 어긋나면 항상 「바뀜」이 된다. */
export function toComparable(unit: CompareUnit, value: unknown): string | undefined {
  if (unit === "NONE") return undefined;
  if (unit === "PRESENCE") {
    /* 🔴 `undefined` 는 「없다」가 아니라 «화면이 아직 담지 않았다» 다. 없음으로
       적으면 수정 화면을 열자마자 「고시가 없어집니다」가 뜬다. 셀러가 비운
       것(`null`·`""`·`[]`)과 구분한다. */
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value.length > 0 ? PRESENT : ABSENT;
    return value === null || value === "" ? ABSENT : PRESENT;
  }
  if (unit === "COUNT") {
    if (Array.isArray(value)) return String(value.length);
    if (typeof value === "number") return String(value);
    /* 🔴 셀 수 없는 것을 0 으로 적지 않는다 — 있던 것이 사라진다고 읽힌다. */
    return undefined;
  }
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

/** 수정 화면이 그대로 그리는 한 항목. */
export interface EditorField {
  field: EditableField;
  label: string;
  capability: FieldCapability;
  /** 셀러가 지금 이 화면에서 값을 바꿀 수 있는가. 🔴 UNKNOWN 은 «못» 바꾼다. */
  editable: boolean;
  baseline: EditBaseline;
  compareUnit: CompareUnit;
  /**
   * 🔴 대조로 「안 바뀌었다」를 말할 수 «없는» 항목인가.
   *
   * 그런 항목은 셀러가 «손댔다는 사실» 로만 변경을 안다. 대조에만 의존하면
   * 대표이미지를 같은 장수로 교체한 셀러는 수정 버튼이 열리지 않아 «아무것도
   * 못 한다» — 이것이 이 스프린트가 계속 고쳐 온 「조용히 안 되는」 것이다.
   */
  touchCounts: boolean;
  /** 화면이 그대로 쓰는 한 줄. 🔴 개발용 낱말을 쓰지 않는다. */
  note: string;
}

/** 채널 × 기준값 → 수정 화면의 항목 목록. 🔴 순서도 FIELD_ORDER 가 정한다. */
export function editorFieldSchema(model: ChannelEditModel): EditorField[] {
  return FIELD_ORDER.map((field) => {
    const capability = fieldCapability(model.source.commerceId, field);
    const baseline = model.baseline[field];
    const compareUnit =
      baseline.state === "OBSERVED" ? "VALUE" : baseline.state === "PARTIAL" ? baseline.unit : "NONE";
    return {
      field,
      label: FIELD_LABEL[field],
      capability,
      editable: capability === "EDITABLE",
      baseline,
      compareUnit,
      /* 🔴 OBSERVED 만 대조로 닫을 수 있다 — 되돌리면 버튼이 닫혀야 하므로. */
      touchCounts: baseline.state !== "OBSERVED",
      note: editorFieldNote(capability, baseline),
    };
  });
}

function editorFieldNote(capability: FieldCapability, baseline: EditBaseline): string {
  /* 🔴 고칠 수 없는 항목에는 대조 이야기를 덧붙이지 않는다 — 고칠 수 없다는
     것이 먼저이고, 그 위에 다른 말을 얹으면 고칠 수 있다고 읽힌다. */
  if (capability !== "EDITABLE") return fieldCapabilityNote(capability);
  if (baseline.state === "UNREAD") return `${baseline.reason} 값을 입력하시면 그대로 반영됩니다.`;
  if (baseline.state === "PARTIAL") return `${fieldCapabilityNote(capability)} ${baseline.blind}`;
  return fieldCapabilityNote(capability);
}

/**
 * 변경 한 줄을 셀러가 읽는 꼴로.
 *
 * 🔴 화면 두 곳(왼쪽 항목 목록 · 우측 요약)이 «같은 함수» 를 쓴다. 각자 형식을
 * 정하면 같은 변경이 두 자리에서 다른 숫자로 보인다.
 *
 * 🔴 상세설명을 그대로 쏟지 않는다 — from/to 에 HTML 전체가 들어 있어서, 그대로
 * 그리면 요약이 상세설명 본문으로 덮인다.
 */
export function describeChange(change: FieldChange): { label: string; from?: string; to?: string } {
  const show = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    if (change.field === "detailContent") return `${value.length}자`;
    /* 🔴 천 단위 구분은 «가격에만» 넣는다. 「값이 숫자면 넣는다」로 하면
       카테고리 코드가 50,000,167 이 된다 — 숫자처럼 생긴 것은 숫자가 아니다. */
    if (change.field === "salePrice") return Number(value).toLocaleString("ko-KR");
    /* 상품명은 길 수 있다. 요약에서 줄을 밀어내지 않게 끊고, 끊었음을 보인다. */
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  };
  return { label: change.label, from: show(change.from), to: show(change.to) };
}

/** 수정 버튼을 열어도 되는가 — 그 «근거» 와 함께. */
export interface EditGate {
  /** 대조해서 확인한 변경. 화면이 「무엇이 무엇으로」를 그대로 보여준다. */
  changes: FieldChange[];
  /** 🔴 대조하지 못했지만 셀러가 «손댄» 항목. 「바뀌었다」가 아니라 「모른다」다. */
  touched: EditableField[];
  canSubmit: boolean;
}

/**
 * 변경 1개 이상이면 수정 버튼이 열린다.
 *
 * @param draft   셀러가 화면에서 만든 값. 🔴 단위 변환은 여기서 한다 —
 *                호출부가 개수를 만들어 넘기게 하면 반드시 어긋난다.
 * @param touched 셀러가 손댄 항목. 🔴 대조 가능한 항목에서는 «세지 않는다» —
 *                고쳤다가 되돌리면 버튼은 닫혀야 한다.
 */
export function evaluateEditGate(
  model: ChannelEditModel,
  draft: Partial<Record<EditableField, unknown>>,
  touched: readonly EditableField[] = [],
): EditGate {
  const schema = editorFieldSchema(model);
  const original: Partial<Record<EditableField, unknown>> = {};
  const current: Partial<Record<EditableField, unknown>> = {};

  for (const entry of schema) {
    /* 🔴 대조할 수 없는 항목은 «양쪽 다» 비운다. 한쪽만 비우면 빈 값과 값이
       맞붙어 아무것도 안 고쳐도 「바뀜」이 된다. */
    if (entry.compareUnit === "NONE" || entry.baseline.state === "UNREAD") continue;
    const value = toComparable(entry.compareUnit, draft[entry.field]);
    /* 🔴 초안 쪽을 같은 단위로 만들지 «못한» 경우도 마찬가지다. 화면이 아직
       그 항목을 담지 않았을 뿐인데 「값이 사라졌다」로 읽으면, 셀러는 아무것도
       고치지 않았는데 수정 버튼이 열린다. */
    if (value === undefined) continue;
    original[entry.field] = entry.baseline.value;
    current[entry.field] = value;
  }

  const changes = detectFieldChanges(model.source.commerceId, original, current);
  const changed = new Set(changes.map((c) => c.field));
  const touchedFields = schema
    .filter((entry) => entry.editable && entry.touchCounts && touched.includes(entry.field))
    /* 🔴 이미 대조로 잡힌 항목을 또 세지 않는다 — 근거가 둘로 갈린다. */
    .filter((entry) => !changed.has(entry.field))
    .map((entry) => entry.field);

  return {
    changes,
    touched: touchedFields,
    canSubmit: canSubmitEdit(changes) || touchedFields.length > 0,
  };
}
