/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-02 P0 — 원산지 텍스트 → 롯데ON 원산지코드(OPLC_CD)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 생겼나 ──────────────────────────────────────────────────────────────
 * 실제 LotteON 등록이 이 필드에서 막혔다. 화면은 「롯데ON 원산지코드(공통코드
 * OPLC_CD)가 지정되지 않았습니다」라고만 말하고, 셀러가 239개 목록에서 손으로
 * 고르게 했다. 그런데 **원산지는 우리가 이미 갖고 있다** — 같은 값이 쿠팡·
 * 네이버에는 그대로 나간다.
 *
 * 🔴 이전에는 일부러 매핑하지 않았다(`useLotteOnCommonCodes` 아래 주석:
 * 「매핑이 아니다. 코드를 고르지도 않는다」). 그 보수적 결정을 CPO 가 뒤집었다
 * (2026-09-29): 「이걸 상세페이지 참조로 고정하는 것은 현재 구조상 후퇴다.
 * 기존 OPLC_CD 목록과 기존 원산지 값을 재사용해 정확 매칭만 한다.」
 *
 * ── 🔴 이 파일이 지키는 것 ─────────────────────────────────────────────────
 * **코드를 «만들지» 않는다.** 고르는 것은 언제나 롯데ON 이 준 239개 중 하나다.
 * 못 맞추면 `null` 이고, 그때는 셀러가 고른다. 첫 LIVE 등록이 거절된 이유가
 * 바로 「코드 자리에 코드가 아닌 것」을 보낸 것이었다
 * (`"oplcCd": "OPLC_CD"` ← 코드그룹 «이름»).
 *
 * 🔴 여럿이 맞으면 «고르지 않는다». 배송지 `autoPick` 과 같은 규칙이다 —
 * 여럿 중 하나를 우리가 고르면 틀린 값이 조용히 나간다.
 */

/** 롯데ON 공통코드 한 줄. `/api/lotteon/common-codes?group=OPLC_CD` 가 주는 모양. */
export interface LotteOnCommonCode {
  code: string;
  name: string;
}

/** 앞뒤 공백과 연속 공백만 정리한다. 🔴 값을 «바꾸지» 않는다. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * 영문 국가명 → 롯데ON 목록에 실제로 있는 한국어 표기.
 *
 * 🔴 이것은 **코드가 아니라 «이름»** 이다. 틀려도 코드가 잘못 나가지 않는다 —
 * 목록에 없는 이름이 되어 그냥 매칭에 실패하고 `null` 이 된다. 그것이 이 표를
 * 두는 것이 안전한 이유다.
 *
 * 🔴 왜 별도로 두는가: `naver/origin-match.ts` 에 같은 성격의 표가 있지만
 * (`COUNTRY_NAME_KO`) export 되지 않고 아시아 10개국뿐이라 우리 소싱 국가
 * (유럽)가 없다. **두 표를 하나로 합치는 것은 별건이다** — 지금 합치면 네이버
 * 실측 매칭까지 건드리게 된다(기록만 하고 하지 않는다).
 */
const LATIN_COUNTRY_NAME_KO: Record<string, string> = {
  spain: "스페인",
  france: "프랑스",
  italy: "이탈리아",
  portugal: "포르투갈",
  germany: "독일",
  netherlands: "네덜란드",
  denmark: "덴마크",
  sweden: "스웨덴",
  poland: "폴란드",
  turkey: "튀르키예",
  china: "중국",
  vietnam: "베트남",
  india: "인도",
  indonesia: "인도네시아",
  japan: "일본",
  "united kingdom": "영국",
  uk: "영국",
  "united states": "미국",
  usa: "미국",
};

/** 이름 후보를 만든다 — 원문 그대로, 그리고 영문이면 한국어 표기까지. */
function candidateNames(originText: string): string[] {
  const raw = normalize(originText);
  if (!raw) return [];
  const ko = LATIN_COUNTRY_NAME_KO[raw.toLowerCase()];
  return ko ? [raw, ko] : [raw];
}

/**
 * 원산지 텍스트로 OPLC_CD 를 고른다.
 *
 * @returns 고른 코드 한 줄, 또는 `null`(못 맞췄거나 여럿이 맞았다 → 셀러가 고른다)
 */
export function autoPickLotteOnOriginCode(
  items: readonly LotteOnCommonCode[],
  originText: string | null | undefined,
): LotteOnCommonCode | null {
  const candidates = candidateNames(originText ?? "");
  if (candidates.length === 0 || items.length === 0) return null;

  for (const candidate of candidates) {
    /* 🔴 정확 일치만 본다. 「스페인」이 「스페인령 ○○」에 부분일치해서 엉뚱한
       코드가 잡히는 것을 막는다. 대소문자는 라틴 문자에서만 의미가 있어 무시한다. */
    const key = candidate.toLowerCase();
    const matched = items.filter((item) => normalize(item.name).toLowerCase() === key);
    if (matched.length === 1) return matched[0];
    /* 🔴 여럿이면 «고르지 않는다» — 여기서 하나를 집으면 틀린 원산지가 조용히 나간다. */
    if (matched.length > 1) return null;
  }
  return null;
}
