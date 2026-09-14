/**
 * REWORK-4 §5(CEO 지시, 2026-09-14) — **커머스 등록 화면 좌측의 10섹션 골격.**
 *
 * ── 왜 한 곳에서 정하나 ──────────────────────────────────────────────────
 * 지금까지 세 채널의 좌측 상세는 각자 자기 순서와 자기 번호를 들고 있었다.
 * 스마트스토어·쿠팡은 기본정보 → 카테고리 → 옵션 → 가격 → 배송 → 고시 → KC →
 * 상세설명 → 등록정보, 롯데ON은 상품정보 → 셀러설정 → 카테고리 → 고시 →
 * 안전인증 → 배송 → 코드였다. 같은 일을 하는 화면이 서로 다른 목차를 갖고
 * 있으면 셀러는 채널을 옮길 때마다 화면을 처음부터 다시 읽어야 한다.
 *
 * 이 파일은 **목차 하나**다. 섹션의 내용을 만들지 않고, 어떤 채널이 어떤
 * 섹션을 갖는지도 정하지 않는다 — 번호와 이름만 한 곳에서 정한다. 그래야
 * "롯데ON이 10개 중 몇 개를 갖췄는가"가 화면 두 개를 눈으로 비교하는 일이
 * 아니라 렌더 결과로 셀 수 있는 값이 된다.
 *
 * ── 이 목록에 없는 것 ────────────────────────────────────────────────────
 * **채널 고유 항목.** 롯데ON의 「그 밖의 롯데ON 코드」처럼 그 채널에만 있는
 * 값은 이 골격 뒤에 붙는다(CEO 표의 "+ 채널 고유 항목"). 골격 안에 끼워 넣으면
 * 번호가 채널마다 달라져서 이 파일이 존재하는 이유가 없어진다.
 */
export const REGISTRATION_SECTION_KEYS = [
  "BASIC",
  "CATEGORY",
  "OPTIONS",
  "PRICE",
  "SHIPPING",
  "SHIPPING_POLICY",
  "NOTICE",
  "KC",
  "DESCRIPTION",
  "LISTING_INFO",
] as const;

export type RegistrationSectionKey = (typeof REGISTRATION_SECTION_KEYS)[number];

/** 화면에 찍히는 이름. 셀러가 읽는 글자이지 내부 키가 아니다. */
export const REGISTRATION_SECTION_LABELS: Record<RegistrationSectionKey, string> = {
  BASIC: "기본 상품정보",
  CATEGORY: "카테고리",
  OPTIONS: "옵션",
  PRICE: "가격",
  SHIPPING: "배송",
  SHIPPING_POLICY: "배송정책 · 반품/교환",
  NOTICE: "고시정보",
  KC: "KC / 인증",
  DESCRIPTION: "상세설명",
  LISTING_INFO: "등록정보",
};

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"] as const;

/**
 * 섹션 제목 한 줄. `sectionTitle("OPTIONS")` → `"③ 옵션"`.
 *
 * suffix는 그 채널에서만 참인 사실을 덧붙일 때 쓴다(예: 롯데ON 카테고리의
 * "롯데ON 전용 · 2중 구조"). 번호와 이름은 절대 채널이 고쳐 쓰지 않는다 —
 * 그 순간 목차가 다시 세 벌이 된다.
 */
export function sectionTitle(key: RegistrationSectionKey, suffix?: string): string {
  const index = REGISTRATION_SECTION_KEYS.indexOf(key);
  const base = `${CIRCLED[index]} ${REGISTRATION_SECTION_LABELS[key]}`;
  return suffix ? `${base} (${suffix})` : base;
}

/** 렌더 결과에서 골격 달성도를 세기 위한 것 — 테스트가 쓰는 유일한 기준. */
export function sectionHeadings(): string[] {
  return REGISTRATION_SECTION_KEYS.map((key) => sectionTitle(key));
}
