# SPRINT STATE — 장기 스프린트 (CEO 고정 지시, 2026-09-26)

> 🔴 **이 파일을 먼저 읽고 «이어서» 작업한다.** 컨텍스트 초과는 작업 종료 사유가
> 아니다 — 상태를 여기 압축하고 계속한다. CEO 중간 확인 금지.

## 운영 규칙

```
S-12 → S-7 → S-4/5/6 → S-8/9 → S-1/2/3 → S-11/13/14 까지 «전부» 끝낸다
각 항목: 조사 → 수정 → 테스트 → 다음 항목으로 «바로» 넘어간다
금지: "컨텍스트가 부족합니다" / "다음 세션에서" / "확인 후 진행" / "CEO가 눌러주세요"
```

## 이미 확정 — 다시 묻지 않는다

```
옵션·기본정보·카테고리 UI      → 쿠팡 기준으로 3채널 통일
기본 배송정보                   → Seller Settings (migration 허용됨)
LotteON 해외직구 배송비 정책     → 설정에서 «하나» 관리, 상품마다 선택 안 함
배송가능지역·택배사·반품택배사   → 설정에서 관리
원본 상품                       → 실제 입력된 원본 URL 기준
  이번 상품: 원본 = Junior Edition / 동일상품 후보 = Bobo Choses 공홈
국내 가격                       → 못 찾으면 «만들지 않는다», 명확히 미탐색 표시
CEO 테스트 안내                 → 코드명 아닌 실제 화면명/라벨명으로
Production 테스트               → 구현 완료 «후» 한 번
```

## 대상 상품

```
Pickles The Dog All Over Light Denim Pants by Bobo Choses
원본 판매처: Junior Edition (junioredition.com)
상품 코드:   B126AC096 SS26
```

---

## 진행 상태

| 순서 | 항목 | 상태 |
|---|---|---|
S-12 | MI 원본 판매처 방향 뒤집힘 | **진행 중** |
S-7 | 재고 위치 — 배송 → 상품/옵션 | 대기 |
S-4/5/6 | 공통 자동수집 → 3채널 고시 | 대기 |
S-8/9 | LotteON 배송 기본값 + Seller Settings migration | 대기 |
S-1/2/3 | 3채널 UI 쿠팡 기준 통일 | 대기 |
S-11/13/14 | 고유코드 + MI 국내/해외 가격 | 대기 |

### S-12 — 조사 기록

```
🟢 무죄(건드리지 않는다 — 이미 올바른 가드다)
   origin-product.ts         후보 목록을 «입력으로도» 받지 않는다
   same-product-sellers.ts   isOrigin 은 셀러 등록 sourceUrl 에서만 온다
   Panel :2450               origin: { sourceUrl: data.product.sourceUrl }

🟢 무죄 (추가 확인)
   candidateLabel()          동일상품 «등급» 라벨이다 — 원본/후보 방향과 무관
   global-market.ts          같은 «판매처» 의 로케일 변형(kr/en-kr) 줄이다.
                             isJudgingMarket 은 시장 판정이지 원본 판정이 아니다

🔴 남은 조사 — 여기 하나뿐이다
   comparison/search         브랜드 공홈(Bobo Choses)이 원본으로 «승격» 되는
                             경로가 있는가. brand-resolver-p13a/p13b 테스트가
                             이 상품을 이미 다룬다 → 거기서부터 읽는다.
   확인 질문: 화면의 「원본」이 sourceUrl 에서 오는가, 아니면 brand 에서 오는가.
              (Junior Edition = 판매처 / Bobo Choses = 브랜드 — 둘을 섞으면
               브랜드가 원본 자리에 선다. 이것이 가장 유력한 가설이다.)
```

## 배경(닫힌 사안 — 다시 파지 않는다)

`docs/commerce-6-*.md` 참조. Commerce-6 기본 필수정보 정합성은 닫혔고
40커밋이 `origin/main`(2c34346)에 반영됐다. 재고 사실 해석은
`packages/shared/src/source-stock.ts` 한 곳이다.
