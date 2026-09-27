export * from "./category-path";
export * from "./color-option-sanity";
export * from "./country-flag";
export * from "./error-codes";
export * from "./image-types";
export * from "./product-facts";
export * from "./brand-identity";
export * from "./product-identity-dna";
export * from "./product-types";
/* NEXT-04d Phase A — product-types 뒤에 온다. master-product 는 그 파일의
   타입에서 «파생» 될 뿐이라 반대 방향 의존이 없다. */
export * from "./master-product";
/* Commerce-6 C-2E — 원본 재고 «사실» 해석. 세 채널이 같은 함수 하나를 본다.
   listing 이 아니라 여기 있는 이유: marketplace 어댑터도 써야 하는데 그쪽은
   listing 을 import 하지 않는다(넣으면 순환이 된다). 그리고 이것은 등록의
   성질이 아니라 «상품의 사실» 이다. */
export * from "./source-stock";
/* 장기 스프린트 S-16 — 택배사 Common 하나 + 채널 Mapping. 🔴 채널마다 칸을
   만들지 않는다(Commerce 30개면 택배사 30칸이 된다). */
export * from "./common-carrier";
/* 장기 스프린트 S-20/21/22 — 필드 상태 표준 · 값의 출처 · 공통 Readiness.
   🔴 새 채널을 붙일 때의 «순서» 를 타입으로 고정한다. */
export * from "./field-requirement";
