import type { CommerceId } from "./commerce-registry";
import type { EditableField } from "./channel-field-capability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A(CEO 전략 고정, 2026-09-26) — **Commerce Core 의 경계.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Commerce 는 Product 의 «주인이 아니다». 마지막에 붙는 판매/유통 어댑터다.
 *
 *     MasterProduct → MI/판매 판단 → 판매 결정 → Commerce Distribution
 *
 * 그래서 커머스가 늘어날 때 늘어나야 하는 것은 «어댑터 하나» 뿐이고, 최근작업 ·
 * 등록 ID 찾기 · 불러오기 · 현재값/보낼값 · ChangeSet · 수정 버튼 · 확인 화면 ·
 * ID 일치 검증 · 이력은 «전부 공통» 이어야 한다. 3개까지는 복붙으로도 빠르지만
 * 10개가 되면 유지보수가 무너진다(CEO 명시).
 *
 * ── 🔴 이 파일이 세우는 «중립 통화» ──────────────────────────────────────
 * Core 는 네이버 payload 도, 쿠팡 응답도 모른다. 채널이 자기 API 모양을
 * `ChannelFieldValues` 로 «번역해서» 건네고, 채널 API 의 모양은 어댑터에서 끝난다.
 *
 *     채널 GET 응답 ─┐
 *                    ├─ adapter.readRegistered()  ─┐
 *     보낼 payload  ─┘                              ├→ ChannelFieldValues
 *                       adapter.projectOutgoing() ─┘        │
 *                                                            ▼
 *                        ChannelEditModel → ChangeSet → EditGate → UI
 *
 * 🔴 Master 를 커머스에 맞춰 바꾸지 않는다. 번역은 «한 방향» 이다 —
 * Master/payload → 중립 통화. 반대 방향으로 채널 값이 Master 를 덮는 길은 없다.
 */

/**
 * 커머스가 Core 에 건네는 값. 🔴 「셀러가 아는 단위」이고, 채널 payload 경로가
 * 아니다(`EditableField` 와 한 몸이다).
 *
 * 🔴 «읽지 못한 것» 은 키를 비운다(undefined). `null` 로도 `0` 으로도 메우지
 * 않는다 — 그 둘은 「읽었는데 값이 이랬다」이고, 추정이 거기서 시작된다.
 */
export interface ChannelFieldValues {
  name?: string | null;
  salePrice?: number | null;
  stockQuantity?: number | null;
  detailContent?: string | null;
  /** 대표 + 추가를 «합친» 장수. 채널마다 세는 법이 달라 어댑터가 합쳐서 준다. */
  imageCount?: number;
  optionCount?: number;
  hasProvidedNotice?: boolean;
  /** 채널의 카테고리 식별자. 🔴 값의 «모양» 은 채널마다 다르고 Core 는 모른다. */
  categoryId?: string | null;
}

/**
 * 커머스 하나가 「등록된 상품 수정」에 참여하기 위해 구현하는 것.
 *
 * 🔴 모든 커머스가 모두 구현해야 한다는 뜻이 «아니다». 할 수 있는 것은
 * `CHANNEL_CAPABILITY` 가 선언하고(F-14-2), 여기 없는 기능은 Core 가 「확인되지
 * 않았습니다」로 말한다 — 「안 됩니다」가 아니다.
 *
 * 🔴 `identify`·`register`·`recreate`·`validate` 는 이 인터페이스에 «아직» 두지
 * 않는다. 그 경로들은 이미 각 채널 register 라우트에 있고, 근거 없이 옮기면
 * 실등록이 회귀한다. Sprint A 의 범위는 «수정» 이다 — 없는 것을 있다고 적지
 * 않는다는 이 프로젝트의 원칙 그대로다.
 */
export interface CommerceEditAdapter<Registered = unknown, Outgoing = unknown> {
  readonly commerceId: CommerceId;

  /**
   * 채널 GET 응답 → 중립 통화.
   *
   * 🔴 `undefined` 를 성실하게 남긴다. 읽지 못한 칸을 0·null 로 메우면 Core 가
   * 「읽었는데 비어 있었다」로 읽고, 그 순간 「값이 사라집니다」를 셀러에게 말한다.
   */
  readRegistered(registered: Registered): ChannelFieldValues;

  /**
   * 「지금 보낼 것」 → 중립 통화. 🔴 Master 가 아니라 «보낼 payload» 를 넣는다 —
   * 채널마다 파생 규칙(상품명 가공 등)이 있어서, 원본을 보면 화면과 전송이 갈린다.
   */
  projectOutgoing(outgoing: Outgoing): ChannelFieldValues;

  /**
   * 수정 화면을 연 뒤 «셀러가 고친» 항목.
   *
   * 🔴 「채널 값과 다르다」가 아니라 「우리 화면에서 달라졌다」다. 둘 다 우리가
   * 만든 payload 이므로 서버 정규화가 끼지 않는다 — 이 비교가 성립하는 조건이
   * 그것이고, 조건이 깨지면 이 함수도 못 쓴다.
   */
  editedFields(before: Outgoing, after: Outgoing): EditableField[];
}

/**
 * 🔴 Core 가 대조할 수 «없는» 축 — 채널을 가리지 않는다.
 *
 * 이미지·옵션·고시는 GET 에서 «개수·존재» 만 읽히는 것이 세 채널 공통의 현실이다
 * (네이버는 이미지 URL 이 매번 재업로드돼 바뀌고, 옵션·고시는 카테고리마다 필드
 * 집합이 달라 같은 잣대로 볼 수 없다). 그래서 이 축의 안전성은 채널별로 따로
 * 정하지 않고 «공통 정책» 하나로 다룬다:
 *
 *   ① 개수·존재로만 대조한다(내용은 모른다고 «말한다»).
 *   ② 개수가 같은 교체는 대조로 잡히지 않으므로, 셀러가 «손댔다는 사실» 로
 *      수정 버튼을 연다 — 그러지 않으면 고쳐도 보낼 수 없다.
 *   ③ 🔴 그 내용이 우리 값으로 덮이는 것은 «아직 막지 못한다». 복원할 값을
 *      읽을 수단이 없기 때문이다. 안전하다고 «판정하지 않는다» — 그 축을 넓히려면
 *      GET 을 더 넓게 읽는 조사가 먼저다.
 */
export const CONTENT_BLIND_FIELDS: readonly EditableField[] = ["images", "options", "providedNotice"];

/** 🔴 등록 ID 의 «모양» 을 Core 가 해석하지 않는다 — 문자열로만 다룬다. */
export function sameExternalProductId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}
