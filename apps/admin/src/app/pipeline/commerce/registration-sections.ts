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

/**
 * REWORK-11 ①(CEO 판정, 2026-09-15: "섹션 순서가 같다를 통합 완료로 인정하지
 * 않는다 — 접힘/펼침 동작까지 같아야 한다") — **처음 화면에서 어느 섹션이
 * 펼쳐져 있는가.**
 *
 * 이 값이 세 채널에 흩어져 있던 동안 화면은 이렇게 갈렸다:
 *   스마트스토어·쿠팡  `{ "section-basic": true }`  — ① 만 펼치고 시작
 *   롯데ON            모든 섹션 `defaultOpen`       — 전부 펼치고 시작
 * 같은 상품으로 탭을 옮기면 롯데ON만 화면이 서너 배 길었다.
 *
 * 🔴 여기서 정하는 것은 **정책 하나**다. 어느 섹션이 어떤 id를 갖는지는 채널이
 * 정한다(스마트스토어·쿠팡은 `section-*`, 롯데ON은 `lotteon-section-*` — 각자의
 * 스크롤 목적지 계약이 이미 그 이름으로 굳어 있다). 이 함수는 "첫 화면에서 열려
 * 있어야 하는 것은 **첫 섹션 하나**"라는 규칙만 들고 있는다.
 */
export function initialOpenSections(firstSectionId: string): Record<string, boolean> {
  return { [firstSectionId]: true };
}

/** 렌더 결과에서 골격 달성도를 세기 위한 것 — 테스트가 쓰는 유일한 기준. */
export function sectionHeadings(): string[] {
  return REGISTRATION_SECTION_KEYS.map((key) => sectionTitle(key));
}

/**
 * REWORK-13B(CEO 실측 판정, 2026-09-15: "롯데ON만 UI가 아직 다르다") — **공통
 * 10섹션이 쓰는 뼈대 클래스.**
 *
 * ── 왜 여기로 올렸나 ────────────────────────────────────────────────────
 * 직전까지 "세 탭이 같은 컴포넌트를 쓴다"는 테스트는 전부 통과했는데도 화면은
 * 달랐다. 재 보니 같은 것은 **카드·머리·입력칸**뿐이고, 그 사이를 채우는
 * 골격은 채널마다 제 값을 들고 있었다(jsdom 실측, 수정 전):
 *
 *   섹션 카드 사이 간격   쿠팡 `space-y-3`        롯데ON `space-y-4`
 *   필드 격자            쿠팡 3열 한 종류        롯데ON 3열 · 2열 · 1열 세 종류
 *   본문 첫 줄           쿠팡 파란 안내 문단     롯데ON 우측정렬 버튼 행
 *
 * 간격 하나가 4px 다르면 카드 열 개가 쌓인 화면은 눈에 띄게 다른 화면이 된다.
 * 그래서 값을 **글자로 여기 한 번** 적고 세 채널이 그것을 읽는다.
 *
 * 🔴 값은 전부 스마트스토어·쿠팡(PlatformPreview)이 이미 쓰던 그대로다 — 그
 * 두 탭의 렌더 결과는 한 글자도 바뀌지 않고, 롯데ON이 이쪽으로 맞춰 온다.
 */

/** 섹션 카드끼리의 세로 간격. 좌측 상세가 이 클래스 하나로 카드를 쌓는다. */
export const SECTION_STACK_CLASS = "space-y-3";

/** 섹션 본문의 입력 격자. 화면 폭에 따라 1 → 2 → 3열. */
export const FIELD_GRID_CLASS = "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3";

/**
 * 같은 격자의 2열판. 한 칸에 긴 글(고시 항목 · 인증 목록처럼 textarea)이 들어가는
 * 섹션이 쓴다 — 쿠팡 ⑦ 고시정보가 이미 이 값이다. 🔴 새 값이 아니라 **둘 중
 * 하나**라는 규칙이다: 격자는 이 두 종류뿐이고, 채널이 제 것을 만들지 않는다.
 */
export const FIELD_GRID_NARROW_CLASS = "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2";

/**
 * 섹션 본문 맨 위의 안내 한 줄("이 값은 어디서 오는가 / 어디서 고치는가").
 *
 * 쿠팡·스마트스토어는 ① 기본 상품정보와 ⑦ 고시정보에서 이 문단을 쓴다. 롯데ON은
 * 같은 말을 **섹션 머리의 summary**에 넣고 있어서 머리가 두세 줄로 부풀었고,
 * 본문 첫 줄에는 대신 우측정렬 버튼 행이 서 있었다 — 카드 열한 개가 전부 그
 * 모양이라 목록 전체의 인상이 달랐다.
 */
export const SECTION_NOTE_CLASS = "mb-2 rounded bg-selected-soft px-2 py-1.5 text-[11px] text-selected";

const CHANNEL_CIRCLED = ["⑪", "⑫", "⑬", "⑭", "⑮"] as const;

/**
 * 공통 10섹션 **뒤에** 붙는 채널 고유 섹션의 제목. `channelSectionTitle(0,
 * "롯데ON 고유 코드")` → `"⑪ 롯데ON 고유 코드"`.
 *
 * CEO 지시(2026-09-15): "롯데ON 고유 데이터는 ⑩ 이후 별도 영역으로 붙인다 —
 * ⑪ 롯데ON 고유 관리정보 · ⑫ 롯데ON 고유 코드 …". 지금까지 이 자리의 제목은
 * 번호가 없는 문장("그 밖의 롯데ON 코드")이라, 공통 골격과 고유 영역의 경계가
 * 화면에서 번호로 읽히지 않았다.
 *
 * 🔴 번호를 ①~⑩ 안에 끼워 넣지 않는다 — 그 순간 공통 목차가 채널마다 갈린다.
 */
export function channelSectionTitle(index: number, label: string): string {
  const mark = CHANNEL_CIRCLED[index] ?? `(${index + 11})`;
  return `${mark} ${label}`;
}
