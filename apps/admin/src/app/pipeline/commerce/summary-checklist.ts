import type { ReadinessItem } from "./readiness";

/**
 * REWORK-7 ①(CEO 판정, 2026-09-15) — **우측은 요약이다. 좌측의 복제가 아니다.**
 *
 * ── 무엇이 잘못돼 있었나(BEFORE 렌더 덤프) ────────────────────────────────
 * 쿠팡 탭의 우측 기둥은 이렇게 서 있었다:
 *
 *   그 외 확인 항목 6개  ✓ 상품명 ✓ 브랜드 ✓ 대표이미지 ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명
 *   등록 가능성 86%
 *   상품 정보  ✗ 카테고리 ✓ 상품명 ✓ 브랜드 ✓ 대표이미지 ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명
 *   선택 입력  △ 옵션
 *
 * 같은 필드 목록이 **한 기둥 안에서 두 번** 나열됐고, 그 목록은 좌측 상세가
 * 이미 섹션마다 보여주는 것과 같은 것이었다. 셀러가 우측에서 알고 싶은 것은
 * "지금 등록할 수 있는가 · 못 한다면 무엇 하나 때문인가"이지 필드 목록이
 * 아니다.
 *
 * ── 이 파일이 하는 일 ─────────────────────────────────────────────────────
 * 판정을 **하지 않는다.** readiness가 이미 계산해 둔 ReadinessItem[]을 받아서
 * **자리(섹션) 단위로 접기만** 한다. 한 자리는 그 자리에 속한 필수 항목이
 * 전부 통과했을 때만 ✓다. 새 규칙이 생기면 CP001류(카드는 100%인데 등록은
 * 실패) 버그가 그대로 돌아온다 — 그래서 여기에는 조건문이 아니라 `every`
 * 하나뿐이다.
 *
 * ── 왜 sectionId로 묶는가 ─────────────────────────────────────────────────
 * sectionId는 이미 "이 항목을 고치려면 좌측 어느 섹션으로 가야 하는가"를
 * 가리키는 값이다(readiness.ts의 LABEL_TO_SECTION / naverFieldSectionId,
 * lotteon-channel-form.ts의 missingInfo). 셀러가 한 번에 처리하는 단위와
 * 정확히 같으므로, 요약을 접는 단위로도 이것 말고 다른 것을 만들 이유가 없다.
 */

/** 화면에 서는 자리 이름. 세 채널이 같은 이름을 쓴다. */
const SUMMARY_GROUPS = [
  "카테고리",
  "상품정보",
  "판매가격",
  "옵션",
  "상세설명",
  "배송",
  "고시정보",
  "인증",
  "판매자 설정",
  "채널 필수정보",
] as const;

export type SummaryGroupName = (typeof SUMMARY_GROUPS)[number];

/**
 * sectionId → 요약 자리.
 *
 * 롯데ON은 같은 자리를 `lotteon-` 접두사로 부른다(lotteon-section-category
 * 등). 접두사를 벗겨서 같은 자리로 모은다 — 세 채널의 요약이 같은 이름으로
 * 서야 "같은 등록 화면"이 렌더 결과에서 참이 된다.
 */
const SECTION_TO_GROUP: Record<string, SummaryGroupName> = {
  "section-category": "카테고리",
  "section-basic": "상품정보",
  "section-images": "상품정보",
  "section-price": "판매가격",
  "section-options": "옵션",
  "section-description": "상세설명",
  "section-shipping": "배송",
  "section-delivery": "배송",
  "section-notice": "고시정보",
  "section-kc": "인증",
  "section-certification": "인증",
  // 롯데ON 고유 코드(oplcCd/tdfDvsCd/brdNo/epdNo)는 어느 공통 자리에도 없다 —
  // 그 채널에만 있는 필수정보라는 사실을 이름으로 그대로 말한다.
  "section-codes": "채널 필수정보",
  "section-payload": "채널 필수정보",
};

function groupOf(item: ReadinessItem): SummaryGroupName {
  const sectionId = item.sectionId?.replace(/^lotteon-/, "");
  if (sectionId && SECTION_TO_GROUP[sectionId]) return SECTION_TO_GROUP[sectionId];
  // sectionId가 없는 항목은 이 화면 안에서 고칠 수 없는 것들이다 —
  // /settings로 가는 판매자 설정이거나(externalHref), 아직 어느 자리에도
  // 매핑되지 않은 채널 검증 결과다. 둘을 뭉치지 않는다: 셀러가 가야 할 곳이
  // 다르다.
  if (item.externalHref) return "판매자 설정";
  return "채널 필수정보";
}

export interface SummaryCheck {
  label: SummaryGroupName;
  /** 그 자리의 필수 항목이 **전부** 통과했을 때만 true. */
  passed: boolean;
}

/**
 * 필수 항목을 자리 단위로 접는다. 항목이 하나도 없는 자리는 아예 나오지
 * 않는다 — 이 상품·이 채널에 요구되지 않는 자리를 "✓"로 그리면 통과한 적
 * 없는 것을 통과했다고 말하는 셈이다.
 *
 * 순서는 SUMMARY_GROUPS 고정 순서다(입력 순서가 아니다). 채널이 달라도 같은
 * 자리가 같은 줄에 온다.
 */
export function buildSummaryChecks(required: ReadinessItem[]): SummaryCheck[] {
  const byGroup = new Map<SummaryGroupName, boolean>();
  for (const item of required) {
    const group = groupOf(item);
    byGroup.set(group, (byGroup.get(group) ?? true) && item.passed);
  }
  return SUMMARY_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({ label: g, passed: byGroup.get(g)! }));
}
