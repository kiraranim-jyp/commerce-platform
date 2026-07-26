import type { ListingModel, ValidationResult } from "@commerce/marketplace";

/** ERROR 등급 validation만 등록을 실제로 막는다 — WARNING은 등록은 가능하되 품질이 낮다는 신호. */
export function blockingErrors(listing: ListingModel): ValidationResult[] {
  return listing.validations.filter((v) => v.status === "ERROR");
}

export function isCategoryConfirmed(listing: ListingModel): boolean {
  return listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";
}
