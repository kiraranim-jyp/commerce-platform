/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-20/21/22 — **필드 상태 표준 · 값의 출처 · 공통 Readiness**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 파일이 필요한가 ─────────────────────────────────────────────────
 * Commerce 를 20~30개로 늘리는 것이 목표다. 새 채널이 「필드 40개가 필요하다」고
 * 할 때 입력칸 40개를 만들면 셀러의 관리 부담이 Commerce 수만큼 늘어난다 —
 * 우리가 만들려는 것과 정반대다.
 *
 * 그래서 새 채널을 붙일 때의 순서를 «타입으로» 고정한다.
 *
 *     요구 필드 → Common 에서 해결 → Category 에서 해결 → Seller Settings 에서
 *     해결 → 기본값 → 조건부 → 그래도 남은 것만 셀러에게 «확인/입력»
 *
 * 🔴 새 축을 «발명하지 않았다». 이 저장소에는 이미 두 축이 있고 잘 돌아간다 —
 * `ReadinessItem.sourceStatus`(누가 채우나)와 `MissingKind`(어디서 고치나).
 * 이 파일은 그 위에 CEO 가 확정한 «한 축» 을 얹는다: **무엇이 필요한가.**
 */

/**
 * S-20 — 모든 Commerce 필드는 넷 중 하나다.
 *
 *  REQUIRED              값 자체가 반드시 필요하다(상품명·가격·이미지).
 *  CONDITIONAL_REQUIRED  조건이 맞을 때만 필요하다(KC 대상=YES → 인증번호).
 *  USER_CONFIRMATION     🔴 자동으로 «확정하면 안 된다». 판매자가 판단한다.
 *  OPTIONAL              없어도 등록된다.
 *
 * 🔴 REQUIRED 와 USER_CONFIRMATION 의 차이가 이 표준의 핵심이다. 둘 다 「지금
 * 없다」지만, 앞엣것은 «채우면» 되고 뒤엣것은 «판단해야» 한다. 섞으면 시스템이
 * 판매자의 책임을 대신 지거나(KC 를 임의 확정), 채울 수 있는 값을 확인이라며
 * 미룬다.
 */
export type FieldRequirementKind = "REQUIRED" | "CONDITIONAL_REQUIRED" | "USER_CONFIRMATION" | "OPTIONAL";

/**
 * S-21 — 값이 «어디서» 오는가. 위에서부터 먼저 찾는다.
 *
 * 🔴 순서가 이 표준의 전부다. Commerce 가 추가될 때 개발자가 묻는 첫 질문을
 * 「이 화면에 뭘 새로 입력시키지?」에서 「우리가 이미 아는 값이 있나?」로
 * 바꾸는 것이 목적이다.
 *
 * 🔴 다만 «모든 필드에 이 순서를 그대로» 적용하지 않는다. 필드마다 허용되는
 * 출처가 다르다(KC 는 SELLER_SETTINGS 에서 올 수 없다). 중요한 것은 순서가
 * 아니라 **값의 출처와 책임을 추적할 수 있다는 것** 이다.
 */
export type FieldValueSource =
  /** 판매자가 «확인해서 정한» 값. 무엇도 이것을 덮지 않는다. */
  | "USER_CONFIRMED"
  /** 공통 상품정보. 한 번 확보하면 모든 채널이 쓴다. */
  | "COMMON_PRODUCT"
  /** 카테고리가 알려준 값(고시 품목·요구 인증 유형 등). */
  | "CATEGORY"
  /** 판매자 설정. 상품마다 다시 묻지 않는 값. */
  | "SELLER_SETTINGS"
  /** 🔴 우리가 채운 관용값. 판매자가 정한 적이 «없다». */
  | "DEFAULT"
  /** 아직 아무 데서도 못 찾았다. */
  | "MISSING";

/** 위에서부터 먼저 찾는다 — 배열 순서가 곧 우선순위다. */
export const FIELD_SOURCE_PRIORITY: readonly FieldValueSource[] = [
  "USER_CONFIRMED",
  "COMMON_PRODUCT",
  "CATEGORY",
  "SELLER_SETTINGS",
  "DEFAULT",
] as const;

export interface ResolvedField {
  kind: FieldRequirementKind;
  source: FieldValueSource;
  /** 🔴 값 자체는 여기 없다. 이 표준은 «어떻게 얻었나» 만 말한다. */
  hasValue: boolean;
  /** CONDITIONAL_REQUIRED 일 때, 지금 그 조건이 성립하는가. */
  conditionMet?: boolean;
}

/**
 * S-22 — 셀러가 보는 «세 덩어리».
 *
 * 🔴 Commerce 가 30개가 되어도 셀러가 보는 것은 이 셋이어야 한다. 「필드 40개
 * 중 34개 자동」처럼 «숫자» 가 늘어나는 것은 괜찮지만, «종류» 가 늘어나면
 * 화면이 Commerce 수만큼 복잡해진다.
 */
export interface ReadinessTally {
  /** 🟢 시스템이 채웠다. 셀러가 할 일이 없다. */
  auto: number;
  /** 🟡 판매자가 «판단» 해야 한다(자동 확정 금지). */
  confirm: number;
  /** 🔴 판매자가 «입력» 해야 한다. */
  input: number;
}

/**
 * 등록을 막아야 하는가. 🔴 OPTIONAL 과 «조건 미성립» 은 막지 않는다.
 *
 * 🔴 이름이 `fieldBlocksRegistration` 인 이유: 같은 패키지의 source-stock 에
 * 이미 `blocksRegistration`(재고 «사실» 기준)이 있다. 둘은 서로 다른 질문이라
 * 한 이름을 나눠 쓰지 않는다 — 나눠 쓰면 호출부에서 어느 규칙인지 알 수 없고,
 * 실제로 barrel export 가 충돌해 빌드가 먼저 막았다.
 */
export function fieldBlocksRegistration(field: ResolvedField): boolean {
  if (field.kind === "OPTIONAL") return false;
  if (field.kind === "CONDITIONAL_REQUIRED" && field.conditionMet !== true) return false;
  return !field.hasValue;
}

/**
 * 한 필드가 셀러에게 «무엇으로» 보이는가.
 *
 * 🔴 `USER_CONFIRMATION` 은 값이 있어도 판매자가 확인하기 전에는 confirm 이다 —
 * 시스템이 찾아낸 값이라도 판매자가 책임질 값이면 대신 확정하지 않는다.
 * 그것이 KC 같은 규제 항목에서 이 축이 존재하는 이유다.
 */
export function tallyOf(field: ResolvedField): keyof ReadinessTally | null {
  if (field.kind === "USER_CONFIRMATION") {
    return field.source === "USER_CONFIRMED" ? "auto" : "confirm";
  }
  if (!fieldBlocksRegistration(field)) return field.hasValue ? "auto" : null;
  return "input";
}

/** 여러 필드를 셋으로 접는다. 🔴 Commerce 가 늘어도 «종류» 는 셋 그대로다. */
export function tallyFields(fields: readonly ResolvedField[]): ReadinessTally {
  const tally: ReadinessTally = { auto: 0, confirm: 0, input: 0 };
  for (const field of fields) {
    const bucket = tallyOf(field);
    if (bucket) tally[bucket] += 1;
  }
  return tally;
}

/**
 * 🔴 셀러에게 «다시 묻지 않는다» — 이 표준이 존재하는 이유.
 *
 * Common·카테고리·판매자 설정에서 이미 값이 나왔으면 그 필드는 채널이 몇 개든
 * 셀러의 할 일이 아니다. 새 Commerce 를 붙이면서 이 검사를 빠뜨리면 같은 값을
 * 채널 수만큼 묻게 된다.
 */
export function alreadyKnown(field: ResolvedField): boolean {
  return (
    field.hasValue &&
    (field.source === "USER_CONFIRMED" ||
      field.source === "COMMON_PRODUCT" ||
      field.source === "CATEGORY" ||
      field.source === "SELLER_SETTINGS")
  );
}
