/** Shopify류는 <img src="//cdn..."> 형태의 프로토콜 상대 URL을 흔히 쓴다 — "https:"를
 * 붙이지 않으면 new URL()이 그냥 던져버려서 정규화/CDN-ID 추출이 조용히 실패하고,
 * 다운로더까지 그대로 넘기면 "Failed to parse URL" 로 파이프라인 전체가 죽는다.
 * 최종적으로 반환하는 이미지 URL 자체도 이걸로 절대경로화해야 한다. */
export function toParsableUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

/**
 * 쿼리스트링을 제거해 같은 이미지의 트래킹 파라미터 차이 등을 무시하고 비교할 수 있게 한다.
 *
 * 🔴 **이 함수는 이미지 전용이 아니다.** 상품 «페이지» URL 의 신원도 이것으로
 * 정한다 — `productIdentityKey`(price-history) · `computeSourceUrlKey`(snapshots) ·
 * 중복등록 가드(lifecycle-final-02 §②, CPO 명시)가 모두 이 결과를 쓴다. 그래서
 * 쿼리를 살려 두면 `?utm_source=…`·`?fbclid=…` 만 다른 URL 이 **다른 상품** 이 되고
 * 중복등록 가드가 우회된다.
 *
 * 🔴 실제로 P2-1 C 에서 내가 여기에 「경로에 이미지 확장자가 없으면 쿼리를 신원으로
 * 본다」를 넣었다가 그 가드 4건을 깨뜨렸다(상품 페이지 경로에는 당연히 이미지
 * 확장자가 없다). 이미지 URL 의 사정은 이미지 쪽에서 처리한다 —
 * `scoring.ts` 의 `normalizeImageUrl()` 참고. **여기는 바꾸지 않는다.**
 */
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
    const parsed = new URL(toParsableUrl(url));
    const match = /\/([a-z]*_?\d{3,})-[a-z0-9_]+\//i.exec(parsed.pathname);
    if (match) return match[1];
    /* ══ P2-1 C — 리사이저형 URL 의 신원은 쿼리에 있다 ═════════════════════════
       🔴 `normalizeUrl` 이 이제 리사이저 URL 의 쿼리를 «유지» 하므로(위 주석),
       같은 사진의 해상도 변형이 서로 다른 URL 로 남는다. 실측에서 테니스창고
       대표 이미지가 `nw=1486` 과 `nw=656` 두 장으로 중복됐다.

       그래서 「어떤 파일인가」를 쿼리에서 읽어 CDN ID 로 쓴다 — 그러면 기존
       `collapseByCdnId` 가 그대로 둘을 한 그룹으로 묶고 큰 쪽을 대표로 고른다.
       🔴 새 중복제거 경로를 만들지 않는다. 이미 있는 그 자리에 신원을 알려 줄 뿐이다.

       파라미터 이름을 사이트별로 적지 않는다: 값이 «이미지 파일명» 인 첫 번째
       파라미터를 신원으로 본다(`path=a.jpg` · `url=/p/2.jpg` 둘 다 걸린다). */
    for (const value of parsed.searchParams.values()) {
      const decoded = (() => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      })();
      const file = /([^/\\?&=]+\.(?:jpg|jpeg|png|webp|gif|avif))(?:$|[?&])/i.exec(decoded);
      if (file) return file[1].toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}
