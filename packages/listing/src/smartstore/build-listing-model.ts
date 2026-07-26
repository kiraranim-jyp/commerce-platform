import type { CategorySelection } from "@commerce/category";
import { smartstoreAdapter, type ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * PM이 요청한 명시적 3단 이름(buildSmartStoreListingModel → validateSmartStoreListing
 * → buildSmartStorePayload) 중 첫 단계 — 실제 변환 로직은 다시 만들지 않고
 * @commerce/marketplace의 smartstoreAdapter를 그대로 감싼다. 플랫폼 Adapter
 * 패턴(어댑터 하나 = 플랫폼 하나)을 이미 3개 플랫폼이 쓰고 있어서, 등록 준비
 * 레이어가 그 위에 새 이름만 붙이는 게 기존 구조를 안 깨는 방법이다.
 */
export function buildSmartStoreListingModel(
  product: CanonicalProduct,
  categorySelection?: CategorySelection,
): ListingModel {
  return smartstoreAdapter.toListingModel(product, categorySelection);
}
