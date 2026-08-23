import type { DomesticPriceListing, DomesticPriceSearchResult, DomesticPriceSource } from "./types";

/**
 * N-4.01 Part G(대표님 지시) — 네이버 쇼핑 검색(오픈API, 공식 문서 기준
 * `GET https://openapi.naver.com/v1/search/shop.json`, 헤더
 * `X-Naver-Client-Id`/`X-Naver-Client-Secret`, 커머스 API(Client ID/Secret)와는
 * **별도의** 네이버 개발자센터 애플리케이션이 필요하다 — SmartStore 등록에
 * 쓰는 `SMARTSTORE_CLIENT_ID`를 재사용하지 않는다, 서로 다른 API 상품이다).
 * 응답 필드(items[].lprice/hprice/mallName/link)는 공식 문서 구조를 그대로
 * 따랐지만, 이번 세션에는 실제 Client ID/Secret이 없어 라이브 호출로
 * 검증하지 못했다 — 대표님이 credential을 넣은 뒤 반드시 한 번 실제 응답으로
 * 재확인해야 한다(이 파일이 "미검증"이라는 사실을 코드 주석에 남긴다,
 * 하드코딩 API 스펙 추정 금지 원칙과 별개로 최소한 이 사실은 숨기지 않는다).
 */
const NAVER_SHOPPING_SEARCH_ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";

export interface NaverSearchCredentials {
  clientId: string;
  clientSecret: string;
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

interface NaverShoppingSearchApiItem {
  title: string;
  link: string;
  lprice: string;
  hprice: string;
  mallName: string;
}

interface NaverShoppingSearchApiResponse {
  total: number;
  items: NaverShoppingSearchApiItem[];
}

export function createNaverShoppingSearchSource(
  credentials: NaverSearchCredentials | null,
): DomesticPriceSource {
  return {
    id: "NAVER_SHOPPING",
    label: "네이버 쇼핑",
    async search(query: string): Promise<DomesticPriceSearchResult> {
      if (!credentials) {
        return {
          status: "NOT_CONFIGURED",
          source: "NAVER_SHOPPING",
          listings: [],
          message: "네이버 쇼핑 검색 API 인증정보(NAVER_SEARCH_CLIENT_ID/SECRET)가 설정되지 않았습니다.",
        };
      }
      const url = `${NAVER_SHOPPING_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&display=20&sort=asc`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            "X-Naver-Client-Id": credentials.clientId,
            "X-Naver-Client-Secret": credentials.clientSecret,
          },
        });
      } catch (err) {
        return {
          status: "ERROR",
          source: "NAVER_SHOPPING",
          listings: [],
          message: `네이버 쇼핑 검색 요청 실패: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      if (!response.ok) {
        return {
          status: "ERROR",
          source: "NAVER_SHOPPING",
          listings: [],
          message: `네이버 쇼핑 검색 API가 ${response.status}를 반환했습니다.`,
        };
      }
      const data = (await response.json()) as NaverShoppingSearchApiResponse;
      if (!data.items || data.items.length === 0) {
        return { status: "NO_RESULTS", source: "NAVER_SHOPPING", listings: [] };
      }
      const listings: DomesticPriceListing[] = data.items
        .map((item) => {
          const priceStr = item.lprice || item.hprice;
          const priceKrw = priceStr ? Number(priceStr) : NaN;
          return {
            mallName: item.mallName || null,
            priceKrw,
            productUrl: item.link || null,
            title: item.title ? stripHtmlTags(item.title) : null,
          };
        })
        // 가격을 숫자로 못 읽은 리스팅(빈 문자열→0원 포함)은 제외한다 — 0원을
        // 실제 가격으로 지어내지 않는다.
        .filter((l) => Number.isFinite(l.priceKrw) && l.priceKrw > 0);
      if (listings.length === 0) {
        return { status: "NO_RESULTS", source: "NAVER_SHOPPING", listings: [] };
      }
      return { status: "OK", source: "NAVER_SHOPPING", listings };
    },
  };
}
