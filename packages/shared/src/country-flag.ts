/** N-3.12 Phase 2 P0② — CPO 지시로 만든 공통 country→국기 변환 함수. 기존 flagFor()
 * 버그: comparison_shops.country/seller.country는 "United Kingdom" 같은 전체 국가명으로
 * 저장되는데, 예전 코드는 이 문자열의 "글자 하나하나"를 ISO-2 코드로 착각해
 * 지역표시문자(regional indicator)로 변환했다 — "UNITED KINGDOM"의 U/N/I/T/E/D/../K/I/N/G/D/O/M
 * 14글자가 각각 국기 조각이 되어 화면에 깨진 기호 뭉치로 렌더링됐다. 이 함수는 알려진 국가명 →
 * ISO-2 매핑을 먼저 시도하고, 이미 유효한 2글자 코드면 그대로 쓰고, 그래도 못 찾으면
 * 억지로 국기를 만들지 않는다(CPO 지시: "잘못된 국가값이면 flag를 억지로 만들지 말고
 * — 또는 국가명만 표시"). */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  germany: "DE",
  france: "FR",
  canada: "CA",
  "united states": "US",
  usa: "US",
  spain: "ES",
  denmark: "DK",
  sweden: "SE",
  italy: "IT",
  austria: "AT",
  "hong kong": "HK",
  australia: "AU",
  "south korea": "KR",
  korea: "KR",
  japan: "JP",
  china: "CN",
  netherlands: "NL",
};

function isValidIso2(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

/** 국기 이모지만 반환한다(못 찾으면 null) — "억지로 만든 국기"를 피하려면 이 함수의
 * null을 받아서 국가명 텍스트나 "—"로 대체 표시해야 한다. */
export function countryToFlagEmoji(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const iso2 = isValidIso2(upper) ? upper : COUNTRY_NAME_TO_ISO2[trimmed.toLowerCase()];
  if (!iso2) return null;
  const codePoints = [...iso2].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** UI에서 바로 쓰는 헬퍼 — 국기를 못 만들면 국가명 원문을 그대로 보여준다(없으면 빈 문자열). */
export function formatCountryWithFlag(country: string | null | undefined): string {
  if (!country) return "";
  const flag = countryToFlagEmoji(country);
  return flag ? `${flag} ${country}` : country;
}
