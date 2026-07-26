/** Shopify류는 <img src="//cdn..."> 형태의 프로토콜 상대 URL을 흔히 쓴다 — "https:"를
 * 붙이지 않으면 new URL()이 그냥 던져버려서 정규화/CDN-ID 추출이 조용히 실패하고,
 * 다운로더까지 그대로 넘기면 "Failed to parse URL" 로 파이프라인 전체가 죽는다.
 * 최종적으로 반환하는 이미지 URL 자체도 이걸로 절대경로화해야 한다. */
export function toParsableUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

/** 쿼리스트링을 제거해 같은 이미지의 트래킹 파라미터 차이 등을 무시하고 비교할 수 있게 한다. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(toParsableUrl(url));
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * 많은 쇼핑몰(PrestaShop 계열 등)은 이미지 URL에 "/{ID}-{사이즈명}/파일명" 형태로
 * 같은 사진의 여러 해상도 변형을 표시한다. ID는 순수 숫자(/24726-big_default/)이거나
 * 짧은 문자 접두사+숫자(Smallable의 /gs_11748876-2000x2000q80/)인 경우가 흔하다.
 * 이 ID를 뽑아내면 같은 사진의 저해상도 중복을 안전하게 병합할 수 있다.
 */
export function extractCdnImageId(url: string): string | null {
  try {
    const pathname = new URL(toParsableUrl(url)).pathname;
    const match = /\/([a-z]*_?\d{3,})-[a-z0-9_]+\//i.exec(pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
