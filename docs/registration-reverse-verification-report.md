# 실등록 역검증 리포트 (P0-3)

대상: `junioredition.com` "Tangerine All Over Baby Swim Cap by Bobo Choses"
sellerProductId `16325604881`(최신 성공 건, 나머지 4건도 같은 소스 상품이라
구조적으로 동일) — 원본(Shopify JSON) vs 실제 등록 payload vs 쿠팡 실제 저장값
(`GET seller-products/{id}`)을 API로 직접 비교했다. Wing 화면 육안 확인이
아니라 API 데이터 비교이지만, 세 값(원본/우리가 보낸 값/쿠팡이 실제로 저장한 값)
을 전부 대조했으므로 "우리가 뭘 보냈다고 주장하는지"가 아니라 "쿠팡이 실제로
뭘 갖고 있는지"까지 확인한 결과다.

| 항목 | 원본 | 쿠팡 등록 | 판정 |
|---|---|---|---|
| 제목 | Tangerine All Over Baby Swim Cap by Bobo Choses | 동일 | **PASS** |
| 브랜드 | vendor: "Bobo Choses SS26 Baby 50% Off Sale"(프로모션 문구 섞임) | "보보쇼즈"(KR-19580, Brand Search API 매칭) | **PASS**(의도된 정제 — 원본 vendor 필드 자체가 지저분한 것은 별도 이슈, 아래 참고) |
| 대표이미지 | — | 1장 | **PASS** |
| 추가이미지 | 총 4장 | 대표 1 + 추가 3 = 4장 | **PASS** |
| **옵션** | Size 옵션 1개, **variant 2개**(48cm/50cm, 각각 SKU·재고 다름) | **items 1개**(옵션 없이 단일 상품으로 등록됨) | **FAIL — 이번 조사의 핵심 발견** |
| 가격 | £21.00(variant[0]) | ₩48,300 | **PASS**(환율 반영 범위 내) |
| 배송비 | — | ₩0, FREE | **PASS**(CartPilot 무료배송 기본 정책) |
| 구매대행 | — | deliveryMethod: AGENT_BUY, overseasPurchased: OVERSEAS_PURCHASED, pccNeeded: true | **PASS** |
| KC | — | "인증/허가 사항": "상세페이지 참조"(플레이스홀더) | **WARNING — 아래 참고** |
| 상세설명 | body_html(HTML) | 태그 제거된 텍스트, 원문 그대로 | **PASS** |
| 고시정보 | — | 5개 필수 항목 중 2개(품명/연락처)만 실값, 3개는 "상세페이지 참조" | **WARNING**(구조는 통과, 내용은 플레이스홀더) |
| 반품지 | — | 실제 Wing 등록 반품지(1002578446, 경기도 하남시...) | **PASS** |
| 출고지 | — | 실제 GB 소싱 국가 매칭 출고지(24495904) | **PASS** |
| 상태 | — | statusName: "임시저장" | **PASS**(의도된 결과 — `requested:false`) |

## 핵심 발견: 옵션이 등록 시점에 통째로 사라진다

이번 세션에서 P0-1/P0-2로 크롤러→CanonicalProduct까지는 옵션(Size 2개 variant,
SKU/가격/재고 포함)이 정확히 도달하도록 고쳤다(실측 확인). 하지만
`packages/listing/src/coupang/build-payload.ts`의 `buildCoupangPayload()`는
여전히 `items: [ {단일 항목 하나} ]`만 만든다 — `CanonicalProduct.variants`를
전혀 읽지 않는다. 그 결과 **원본에 옵션이 2개 있어도 쿠팡에는 옵션 없는 단일
상품 하나로만 등록된다.**

이게 정확히 CPO가 지적한 문제의 실물 증거다 — "옵션을 못 가져오면 절반 이상의
상품은 결국 사람이 다시 입력해야 한다"는 우려가 이 상품 하나로 이미 실증됐다.
**P1-6(옵션 등록 Payload 구현)이 최우선으로 이어져야 한다.**

## KC/고시정보에 대한 정직한 평가

카테고리 메타정보 조회 시 "기타 재화"(필수 항목 5개, 가장 단순)를 자동
선택하도록 구현했는데, 이 상품은 유아용품이라 실제로는 "어린이제품"
카테고리(KC 인증정보 포함 14개 필수 항목)가 더 정확할 수 있다. "기타 재화"를
쓰면 등록 자체는 쉽게 통과하지만, 어린이제품안전특별법 대상 상품에 KC 인증
정보 없이 등록되는 셈이라 — **이건 등록 성공률보다 컴플라이언스 리스크
문제다.** 지금은 CartPilot이 실제 KC 인증번호를 가진 게 아니므로(해외
구매대행 상품 특성상 국내 KC 인증이 없는 경우가 실제로 많다) 정직하게
"상세페이지 참조"로 두고 판매자(대표님)가 실제 인증 여부를 확인 후 조정하는
게 지금 단계에서는 맞는 방향이라고 판단했다 — 다만 이 판단 자체를 최종
승인권자에게 명시적으로 알려야 한다(지어낸 KC 인증정보를 넣는 것보다는 훨씬
안전하지만, "정답"은 아니다).

## 다음 조치

1. **P1-6 즉시 착수**: `CanonicalProduct.variants`를 `CoupangPayload.items[]`
   여러 개로 매핑 — 옵션 개수만큼 vendorItem을 만들어야 원본과 등록 결과가
   진짜로 일치한다.
2. 유아동 카테고리(81xxx 계열)는 "기타 재화" 대신 "어린이제품" 고시정보
   카테고리를 우선 시도하도록 `buildCoupangCompliance`의 카테고리 선택 규칙
   재검토 필요(단순히 "필수 항목 최소"가 아니라 카테고리 성격 반영).
