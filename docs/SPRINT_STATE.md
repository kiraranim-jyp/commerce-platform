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

### S-12 — 추가 진척 (comparison/search 확인)

```
🟢 comparison/search/route.ts 도 올바르다
   body.sourceUrl → verifySourcePriceDirect(원본 «직접» 재조회)
   그것과 «별개로» 타 판매처를 검색한다 — 원본과 후보가 코드에서 분리돼 있다

→ 서버 경로 다섯 곳이 전부 무죄다. 그러므로 뒤집힘은 «서버 판정» 이 아니라
  화면이 그 둘을 그리는 «자리/라벨» 이다.

🔴 다음 확인(여기서 이어서 시작한다)
   1. 실제 렌더 덤프를 뜬다 — DomesticPriceIntelligencePanel 을 이 상품으로
      마운트해 「원본」 라벨 옆에 무엇이 그려지는지 «문자열로» 본다.
      (추측하지 않는다. 지금까지 소스 읽기로는 원인이 안 나왔다.)
   2. sellerNameFromUrl() 이 junioredition.com 을 무엇으로 읽는지 확인.
      브랜드명 표(brand-identity)와 충돌하면 그 자리가 범인이다.
```

### 🔴 S-12 중 발견한 «별건» 결함 (같은 스프린트 안에서 처리)

```
sellerNameFromUrl("https://junioredition.com/…")
   → host "junioredition.com" → label "junioredition"
   → 화면 표기 «Junioredition»          ← 한 단어, 띄어쓰기 없음

실제 판매처 이름은 "Junior Edition" 이다. 셀러는 자기가 넣은 주소의
판매처를 화면에서 «다른 이름» 으로 보게 된다. 이것만으로도 「원본이 이상하다」는
인상을 준다 — CEO 가 본 뒤집힘의 «일부» 일 수 있다.

🔴 고칠 때 주의: 호스트에서 사람 이름을 «지어내지» 않는다. 알 수 없는 호스트는
   호스트 그대로 보여주는 편이 낫다(브랜드 표에 있는 것만 예쁜 이름을 쓴다).
   brand-identity 표가 이미 있으므로 새 표를 만들지 않는다.
```
