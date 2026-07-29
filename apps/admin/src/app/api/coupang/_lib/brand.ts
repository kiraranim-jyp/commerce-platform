import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";

/**
 * 브랜드명 문자열만 보내면 실제 쿠팡 API가 "브랜드 ID가 필요합니다. 브랜드 ID
 * 없이 브랜드명을 사용하려면 WING의 브랜드 관리 페이지에서 브랜드를 등록해
 * 주세요"로 거부한다(실등록 시도로 확인) — Wing에 미리 등록되지 않은 브랜드는
 * 텍스트만으로 통과할 수 없고, 쿠팡이 이미 보유한 브랜드 데이터베이스에서
 * brandId를 찾아 함께 보내야 한다. Brand Search API(POST .../brands/search)로
 * 상품명에서 뽑은 브랜드 문자열을 검색해서 가장 관련도 높은(첫 번째) 결과를
 * 쓴다 — 검색어가 지저분해도(예: 프로모션 문구가 섞인 원본 title 파편) 실측 확인
 * 결과 1순위가 정확했다(관련도 기반 정렬로 보임). 못 찾으면 null — 호출부가
 * brandId 없이 진행하면 실제 API가 다시 명확한 오류로 막아준다(추측해서 지어내지
 * 않는다는 원칙).
 */
const BRAND_SEARCH_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/brands/search";

export interface BrandMatch {
  brandId: string;
  brandName: string;
}

interface RawBrandSearchResponse {
  code?: string;
  data?: {
    items?: { brandId?: string; brandName?: string }[];
  };
}

export async function resolveBrand(
  credentials: CoupangCredentials,
  brandNameGuess: string,
): Promise<BrandMatch | null> {
  const trimmed = brandNameGuess.trim();
  if (!trimmed) return null;
  try {
    const response = await callCoupangApi(credentials, {
      method: "POST",
      path: BRAND_SEARCH_PATH,
      body: { brandName: trimmed },
    });
    if (!response.ok) return null;
    const parsed = response.body as RawBrandSearchResponse;
    const top = parsed.data?.items?.[0];
    if (!top?.brandId || !top.brandName) return null;
    return { brandId: top.brandId, brandName: top.brandName };
  } catch {
    return null;
  }
}
