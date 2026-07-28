# 쿠팡 Category Metadata API 연동 설계안 (다음 스프린트, 설계만·미구현)

## 왜 필요한가

지금 `buildCoupangPayload()`는 카테고리별 `attributes`(구매옵션/검색옵션 등 필수
속성)와 `notices`(원산지/품질보증기준 등 카테고리별 고시정보)를 항상 빈 배열로
보낸다. 카테고리가 이 값들을 필수로 요구하면 Pre-flight 체크리스트를 전부
통과해도 실제 쿠팡 API 호출 단계(`API004`/`API005`)에서만 실패가 드러난다 —
"등록 전 확인"의 사각지대다. 성인상품 여부(`adultOnly`)도 카테고리별로 정답이
다른데 지금은 `"EVERYONE"`으로 고정돼 있고, KC 인증 대상 여부는 아예 모델링돼
있지 않다. 이 넷(속성/고시정보/성인상품/KC)은 전부 "카테고리를 알아야 무엇이
필요한지 알 수 있다"는 공통점이 있어서 하나의 연동으로 묶는다.

## 예상 엔드포인트 (검증 필요)

쿠팡 Open API 문서 기준 "카테고리 메타 정보 조회"(displayCategoryCode로 조회,
GET, 인증 필요 — 기존 `callCoupangApi()` 서명 방식 그대로 재사용 가능)가
필수/선택 attributes 목록, notice 카테고리 목록, 인증 필요 여부 플래그를
반환하는 것으로 알려져 있다. **정확한 경로/응답 스키마는 구현 착수 시
developers.coupang.com에서 다시 확인해야 한다** — 이번 세션에서도 문서 사이트가
일부 페이지에서 403을 반환한 전례가 있어(`courier-codes.ts` 주석 참고),
가정만으로 구현부터 시작하면 안 된다. `coupang.adapter.ts`/`build-payload.ts`가
이미 "실제 문서로 검증된 스키마만 코드화한다"는 원칙을 지켜왔으므로 이 연동도
같은 기준을 따른다.

## 연동 지점

```
사용자가 카테고리 확정(SELECTED/CONFIRMED)
  ↓
카테고리 메타 정보 조회 (신규 API route: /api/coupang/category-metadata?code=...)
  ↓
필수 attributes/notices 목록 + adultOnly 필요 여부 + KC 인증 필요 여부 반환
  ↓
PreflightChecklist에 카테고리별 필수 항목 추가 표시
  (예: "성인인증 여부", "소재", "치수" 같은 카테고리 고유 항목)
  ↓
사용자가 값을 입력 → ListingModel에 attributeValues로 저장
  ↓
buildCoupangPayload()가 attributes/notices/adultOnly를 실제 값으로 채움
```

## 데이터 모델 변경(예상)

- `packages/marketplace/src/types.ts`의 `ListingModel`에 카테고리별 동적 필드를
  담을 `categoryAttributeValues?: Record<string, string>` 추가(필드 이름은
  실제 API 응답의 attribute 식별자를 그대로 키로 쓴다).
- 새 타입 `CategoryMetadata { attributes: CategoryAttributeSpec[]; notices: NoticeCategorySpec[]; requiresAdultVerification: boolean; requiresKcCertification: boolean }` —
  `packages/category` 또는 `packages/marketplace`에 위치(카테고리 개념과
  가까우므로 `packages/category` 쪽이 자연스럽다).
- `PreflightChecklist`가 이 메타데이터를 받아서 필수 attribute마다 체크리스트
  항목을 동적으로 추가한다 — 지금처럼 고정된 목록이 아니라 카테고리마다
  달라지는 목록이 된다.

## Fallback 전략

- 메타 정보 조회 자체가 실패하면(네트워크 오류, 아직 지원 안 하는 카테고리 등)
  기존 동작(빈 attributes/notices, `adultOnly: "EVERYONE"`)으로 폴백한다 —
  이 연동이 실패한다고 등록 자체가 완전히 막히면 안 된다. 대신 Pre-flight
  체크리스트에 "이 카테고리는 필수 속성을 자동으로 확인할 수 없습니다 — 등록
  후 쿠팡이 반려하면 Wing에서 직접 채워주세요" 같은 경고를 보여준다.
- 캐시: 같은 `displayCategoryCode`의 메타 정보는 자주 안 바뀌므로 크롤러의
  `domain-rate-limiter.ts`처럼 메모리 캐시(TTL 1시간 정도)를 둬서 같은 카테고리를
  반복 조회할 때 쿠팡 API 호출을 줄인다.

## 기존 동작에 대한 영향

- 카테고리 메타 조회는 카테고리 확정 시점에만 트리거되는 새 흐름이라, 카테고리를
  아직 안 정한 상품은 지금과 완전히 동일하게 동작한다(회귀 없음).
- `attributes`/`notices`가 채워지기 시작하면 `buildCoupangPayload()`의 출력이
  달라진다 — 이번 세션에서 `overseasPurchased`를 고친 것과 같은 종류의 변경이므로,
  구현 시에도 실제 등록 테스트(DRY_RUN 우선, 이후 LIVE 1건)로 payload가 쿠팡이
  기대하는 형태인지 재확인해야 한다.

## 구현 순서 제안 (다음 스프린트)

1. 실제 API 경로/응답 스키마를 developers.coupang.com에서 재확인(또는 Wing
   판매자센터에서 카테고리 하나를 실제로 조회해보고 응답을 캡처).
2. `/api/coupang/category-metadata` 라우트 + 메모리 캐시.
3. `CategoryMetadata` 타입 + `PreflightChecklist` 동적 항목 렌더링.
4. `buildCoupangPayload()`가 `categoryAttributeValues`를 실제 `attributes`/
   `notices`/`adultOnly`로 매핑.
5. DRY_RUN으로 최소 2~3개 카테고리(속성이 많은 카테고리/적은 카테고리) 검증 후
   LIVE 등록으로 최종 확인.
