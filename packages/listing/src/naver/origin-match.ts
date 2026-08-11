/**
 * Sprint N-3.4 — Naver 원산지 코드(originAreaCode) 매칭.
 *
 * `GET /v1/product-origin-areas`(공식 GitHub 공지, commerce-api-naver
 * discussion #3632 — "행정체계 개편에 따른 상품 원산지 수정 필요")로 실제
 * production 계정에서 535개 코드/이름 목록을 확인했다. 최상위 6개:
 * 00(국산)/01(원양산)/02(수입산)/03(상세설명에 표시)/04(직접입력)/
 * 05(원산지 표기 의무대상 아님) — discussion #3531(commerce-api-naver 공식
 * 계정 답변)에서 03/04 값이 실제로 쓰인다는 것도 교차 확인됨. 수입산(02) 하위
 * 234개 국가 리프 노드는 전부 실제 응답에서 그대로 가져온 표기다(추측 금지).
 *
 * CartPilot이 뽑아낸 원산지 텍스트(예: "Spain"/"스페인"/"대한민국")를 이
 * 목록과 매칭한다 — 매칭 성공하면 실제 코드를 쓰고, 실패하면 04(직접입력) +
 * content로 원문을 그대로 보존한다(코드를 지어내지 않는다). "브랜드 국가 =
 * 원산지"라는 가정은 이 함수에 넣지 않는다 — 호출부가 이미 확인된 원산지
 * 텍스트만 넘겨야 한다(CPO 지시, N-3.4 Part 7).
 */
export interface NaverOriginAreaCode {
  code: string;
  name: string;
}

export interface NaverOriginAreaMatch {
  /** MATCHED: 535개 목록에서 실제 국가/국산 코드를 찾음.
   * OTHER_MANUAL: 텍스트는 있지만 목록에 없어 04(직접입력)로 대체.
   * NO_INPUT: 원산지 텍스트 자체가 없음. */
  status: "MATCHED" | "OTHER_MANUAL" | "NO_INPUT";
  code: string | null;
  matchedDisplayName: string | null;
  /** true면 수입산(02) 계열 코드 — originAreaInfo.importer가 스펙상 필수. */
  requiresImporter: boolean;
}

/** 영어(소문자) → Naver 실측 응답의 한국어 국가명(정확히 이 표기여야 매칭됨,
 * 임의 번역이 아니라 위 GET 응답에서 그대로 가져온 문자열이다). 자주 보이는
 * 소싱 국가 위주로 채웠다 — 목록에 없는 국가는 OTHER_MANUAL로 안전하게 폴백된다. */
const COUNTRY_NAME_KO: Record<string, string> = {
  china: "중국",
  vietnam: "베트남",
  cambodia: "캄보디아",
  bangladesh: "방글라데시",
  india: "인도",
  pakistan: "파키스탄",
  indonesia: "인도네시아",
  thailand: "태국",
  myanmar: "미얀마",
  "sri lanka": "스리랑카",
  turkey: "터키",
  türkiye: "터키",
  italy: "이탈리아",
  spain: "스페인",
  portugal: "포르투갈",
  france: "프랑스",
  uk: "영국",
  "united kingdom": "영국",
  england: "영국",
  germany: "독일",
  netherlands: "네덜란드",
  holland: "네덜란드",
  belgium: "벨기에",
  poland: "폴란드",
  romania: "루마니아",
  bulgaria: "불가리아",
  morocco: "모로코",
  tunisia: "튀니지",
  egypt: "이집트",
  usa: "미국",
  "united states": "미국",
  "united states of america": "미국",
  mexico: "멕시코",
  peru: "페루",
  brazil: "브라질",
  japan: "일본",
  taiwan: "대만",
  "hong kong": "홍콩",
  macau: "마카오",
  malaysia: "말레이시아",
  philippines: "필리핀",
  laos: "라오스",
  nepal: "네팔",
  switzerland: "스위스",
  austria: "오스트리아",
  sweden: "스웨덴",
  norway: "노르웨이",
  denmark: "덴마크",
  finland: "핀란드",
  ireland: "아일랜드공화국",
  greece: "그리스",
  "czech republic": "체코",
  czechia: "체코",
  hungary: "헝가리",
  slovakia: "슬로바키아",
  slovenia: "슬로베니아",
  croatia: "크로아티아",
  australia: "호주",
  "new zealand": "뉴질랜드",
  canada: "캐나다",
  "south africa": "남아프리카공화국",
  israel: "이스라엘",
  "united arab emirates": "아랍에미리트",
  uae: "아랍에미리트",
  ecuador: "에콰도르",
  colombia: "콜롬비아",
  chile: "칠레",
  argentina: "아르헨티나",
  russia: "러시아연방",
  ukraine: "우크라이나",
  singapore: "싱가포르",
  mongolia: "몽골",
};

const KOREA_NAMES = new Set(["korea", "south korea", "republic of korea", "대한민국", "한국"]);

export function resolveNaverOriginArea(
  countryText: string | null | undefined,
  areas: NaverOriginAreaCode[],
): NaverOriginAreaMatch {
  const raw = (countryText ?? "").trim();
  if (!raw) {
    return { status: "NO_INPUT", code: null, matchedDisplayName: null, requiresImporter: false };
  }

  const lower = raw.toLowerCase();
  if (KOREA_NAMES.has(lower)) {
    const domestic = areas.find((a) => a.code === "00");
    return {
      status: "MATCHED",
      code: domestic?.code ?? "00",
      matchedDisplayName: domestic?.name ?? "국산",
      requiresImporter: false,
    };
  }

  // 이미 한국어 국가명(예: "중국")이면 COUNTRY_NAME_KO에 없어도 raw 그대로 매칭 시도.
  const koName = COUNTRY_NAME_KO[lower] ?? raw;
  const match = areas.find((a) => a.code.startsWith("02") && a.name.split(">").pop() === koName);
  if (match) {
    return { status: "MATCHED", code: match.code, matchedDisplayName: match.name, requiresImporter: true };
  }

  return { status: "OTHER_MANUAL", code: "04", matchedDisplayName: null, requiresImporter: false };
}
