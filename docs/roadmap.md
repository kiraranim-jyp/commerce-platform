# CartPilot Roadmap

CartPilot의 최종 목표는 URL 하나로 등록만 대신해주는 도구가 아니라, 아래 전체
흐름을 지원하는 AI Commerce Operating System이다.

```
상품 발견 → 상품 정보 추출 → 이미지 처리 → 동일 상품 탐색 → 판매처 비교
  → 최적 Source 선택 → 통합 상품 생성 → 국내 커머스 플랫폼 등록 → 판매 분석
```

지금까지(그리고 현재 진행 중인 Mission까지)는 앞쪽 세 단계 + 마지막 두 단계
(상품 정보 추출 → 이미지 처리 → ... → 국내 커머스 플랫폼 등록)에 집중해왔다.
"동일 상품 탐색 → 판매처 비교 → 최적 Source 선택 → 통합 상품 생성" 구간은
**EPIC 6**으로 공식 로드맵에 등록하되, 지금은 착수하지 않는다 — 쿠팡 등록
성공까지가 현재 Mission의 우선순위다.

## EPIC 6 — Product Intelligence (미착수, 장기 로드맵)

1. Multiple Source Input — 같은 상품을 여러 사이트(Source)에서 동시에 입력받는다.
2. Product Identity Resolution — 브랜드/모델명/SKU/GTIN 등으로 "같은 상품"인지 식별한다.
3. Product Matching — 서로 다른 Source에서 온 상품들을 하나의 Product Group으로 묶는다.
4. Source Comparison — 같은 상품 그룹 안에서 가격/배송비/이미지 품질/설명 품질을 비교한다.
5. Best Source Selection — 그룹별로 가장 유리한 Source를 자동/수동으로 고른다.
6. Unified Product — 여러 Source의 장점을 합친 하나의 "통합 상품"을 만든다.

### 예상 구조

```
Source Product A
Source Product B          →  Product Matching Engine  →  Product Group  →  Unified Product
Source Product C
```

### Source Optimization — Unified Product의 예상 스키마

```
UnifiedProduct
├── identity
│   ├── brand
│   ├── model
│   ├── sku
│   └── gtin
│
├── price
│   ├── source
│   ├── productPrice
│   ├── shippingCost
│   ├── taxes
│   └── effectiveCost
│
├── images
│   └── bestSource
│
├── description
│   └── bestSource
│
└── variants
```

## 지금 이 Mission에서 하지 않는 것

- AI 이미지 유사도 분석 (Product Matching의 핵심 기술이지만 이번 범위 밖)
- 여러 사이트 자동 검색 / 프록시 인프라
- 실제 쿠팡 API 인증 자동화 (DRY_RUN까지만)
- Product Matching 전체 구현
- Sales Analytics

이번 Mission(SaaS 첫 경험 개선 + 쿠팡 등록 MVP + 이미지 JPG 표준화)이 끝나면
다음 우선순위는 "SmartStore/Coupang LIVE Integration"(실제 API 인증 → 실제
등록)이고, EPIC 6은 그 이후 별도 Mission으로 다시 논의한다.
