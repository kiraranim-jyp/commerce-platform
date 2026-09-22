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
  /**
   * ══ LOTTEON-REAL-REGISTRATION-02 §6(CEO 지시, 2026-09-22) ══
   *
   * 이 자리를 **막고 있는 항목들**. 통과한 자리는 빈 배열이다.
   *
   * 왜 생겼나. 검증기는 이미 field · label · reason · code 를 준다. 그런데
   * 화면이 그걸 자리 단위로 접으면서 **버리고** 있었다 — 셀러가 보는 것은
   * 「✗ 배송」 한 줄이었고, 배송의 무엇이 왜 막는지는 어디에도 없었다.
   * 「✗ 채널 필수정보」는 특히 아무것도 말해 주지 않는다.
   *
   * 🔴 판정을 새로 만들지 않는다. 접기 전의 항목을 «같이 들고 갈» 뿐이다 —
   * passed 계산은 한 글자도 바뀌지 않는다.
   */
  blocking: {
    label: string;
    /** 왜 막는가 — 검증기의 reason 에서 API 내부 필드명을 걷어낸 첫 문장. */
    hint?: string;
    /** 이 화면 안에서 고칠 수 있으면 그 자리. */
    sectionId?: string;
    /** 이 화면 밖에서 고쳐야 하면 갈 곳(설정 등). */
    externalHref?: string;
  }[];
  /**
   * 상한(3개)을 넘어 접힌 blocker 수. 우측은 «요약» 이라 목록이 되면 안 되지만,
   * 접었다는 사실을 숨기지도 않는다 — 전체는 좌측 상세가 보여준다.
   */
  hiddenBlockingCount: number;
}

/**
 * 필수 항목을 자리 단위로 접는다. 항목이 하나도 없는 자리는 아예 나오지
 * 않는다 — 이 상품·이 채널에 요구되지 않는 자리를 "✓"로 그리면 통과한 적
 * 없는 것을 통과했다고 말하는 셈이다.
 *
 * 순서는 SUMMARY_GROUPS 고정 순서다(입력 순서가 아니다). 채널이 달라도 같은
 * 자리가 같은 줄에 온다.
 */
/**
 * 🔴 셀러에게 보여줄 수 없는 말을 걷어낸다(CEO 지시, 2026-09-22).
 *
 * 검증기의 `reason` 은 개발자가 읽으라고 쓴 문장이라 API 내부 필드명이 괄호로
 * 박혀 있다 — 「상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다」. 그 괄호를
 * 지우고 **첫 문장만** 남긴다. 뒤따르는 「임의 값을 보낼 수 없습니다」 같은
 * 구현 사정은 셀러의 다음 행동을 바꾸지 않는다.
 *
 * 🔴 문장을 새로 «쓰지» 않는다. 지우기만 한다 — 우리가 다시 쓰면 검증기와
 * 화면이 다른 말을 하게 되고, 그것이 이 저장소가 CP001 로 겪은 일이다.
 */
function humanize(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const withoutApiCodes = text.replace(/\(\s*[A-Z][A-Z0-9_]{2,}\s*\)/g, "");
  const firstSentence = withoutApiCodes.split(/(?<=다\.)\s+/)[0] ?? withoutApiCodes;
  const cleaned = firstSentence.replace(/\s{2,}/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * 한 자리에 펼칠 blocker 상한. 우측은 «요약» 이라는 REWORK-7 의 원칙을 숫자로
 * 지킨다 — 막는 것이 열 개여도 우측이 목록 화면이 되면 안 된다. 나머지는
 * 「외 N개」로 세기만 하고, 전체는 좌측 상세가 이미 보여준다.
 */
const MAX_BLOCKING_PER_GROUP = 3;

export function buildSummaryChecks(required: ReadinessItem[]): SummaryCheck[] {
  const byGroup = new Map<SummaryGroupName, boolean>();
  /** §6 — 접기 «전» 의 항목을 자리별로 들고 있는다. 막는 것만 남긴다. */
  const blockingByGroup = new Map<SummaryGroupName, SummaryCheck["blocking"]>();
  for (const item of required) {
    const group = groupOf(item);
    byGroup.set(group, (byGroup.get(group) ?? true) && item.passed);
    // 🔴 통과한 항목은 «절대» 펴지 않는다. REWORK-7 이 지운 것이 정확히
    //    그것이었다(✓상품명 ✓브랜드 … 가 좌측과 중복으로 두 번 서 있었다).
    if (item.passed) continue;
    const list = blockingByGroup.get(group) ?? [];
    list.push({
      label: humanize(item.label) ?? item.label,
      hint: humanize(item.hint),
      sectionId: item.sectionId,
      externalHref: item.externalHref,
    });
    blockingByGroup.set(group, list);
  }
  return SUMMARY_GROUPS.filter((g) => byGroup.has(g)).map((g) => {
    const all = blockingByGroup.get(g) ?? [];
    return {
      label: g,
      passed: byGroup.get(g)!,
      blocking: all.slice(0, MAX_BLOCKING_PER_GROUP),
      hiddenBlockingCount: Math.max(0, all.length - MAX_BLOCKING_PER_GROUP),
    };
  });
}
