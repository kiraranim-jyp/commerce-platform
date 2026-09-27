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
S-12 | MI 원본 판매처 방향 뒤집힘 | 🟢 «재현 불가» 로 닫음 |
S-7 | 재고 위치 — 배송 → 상품/옵션 | 🟢 완료(렌더 검증 5건) |
S-4/5/6 | 공통 자동수집 → 3채널 고시 | 🟢 판정 완료(수입사명은 S-8/9 에 포함) |
S-8/9 | LotteON 배송 기본값 + Seller Settings migration | 🟢 코드 완료 · migration «미실행» |
S-1/2/3 | 3채널 UI 쿠팡 기준 통일 | 🟢 REWORK-14 가 이미 강제 중 · 잔여 기록 |
S-11/13/14 | 고유코드 🟢 · MI 가격 🟢(이미 구현 · 계약 고정) |  |

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

### 🔴 S-12 결론 — 코드에서 «재현되지 않는다»

실제 렌더 덤프를 떴다(Junior Edition sourceUrl + Bobo Choses brand).

```
화면 출력:  「Pickles The Dog … 🔗 원본 상품 보기 junioredition.com/products/…」
Bobo 등장:  idx = -1   ← 화면에 «한 번도» 나오지 않는다
```

원본은 정확히 Junior Edition 으로 섰다. 서버 5곳 + 화면 모두 무죄다.
→ 남은 가능성 둘. 둘 다 지금 확인할 수 없다:
   ① Production 스냅샷의 `canonicalProduct.sourceUrl` 자체가 bobochoses 로
      저장돼 있다(화면은 그 값을 «정직하게» 보여준 것) — DB 접근 필요
   ② CEO 가 본 곳이 MI 카드가 아니라 «🌎 해외 판매처 가격 표» 다
      (fixture 에서는 「검색 데이터 없음」이라 그 표를 못 그렸다)

🔴 없는 결함을 고치지 않는다. S-12 는 «재현 불가» 로 닫고 Production 배포 후
   실제 화면에서 ①②를 확인한다. 그때 재현되면 그 자리를 고친다.

### S-12 부산물 → P2 backlog (이번에 고치지 않는다)

`sellerNameFromUrl` 이 host 첫 라벨을 대문자화한다 → `Junioredition`.
🔴 고치려면 「호스트 그대로 표기」가 유일하게 지어내지 않는 방법인데, 그러면
지금 올바른 `Smallable` 까지 `smallable.com` 으로 퇴행한다. CEO 가 보고한
증상도 아니다 — 회귀 위험 있는 미요청 변경은 하지 않는다.

---

## 🟢 S-7 완료 (2026-09-26)

```
CEO 지적이 맞았다 — <FieldRow label="재고"> 가 section-shipping 안에서
배송비·반품안내와 나란히 서 있었다. 옵션 섹션 끝으로 옮겼다.

🔴 덤으로 «내 C-2F 오판» 을 정정했다.
   C-2F 때 readiness 의 재고 sectionId 를 section-price 로 적었는데 틀렸다.
   소스에서 «가장 가까운 주석»(id="section-price" 설명)만 보고 감싼
   CollapsibleSection 을 확인하지 않았다. 화면과 안내가 다른 자리를
   가리키는 상태였다 — 셀러가 눌러도 재고 칸이 없는 섹션으로 간다.

검증 방식도 바꿨다: 소스 문자열이 아니라 «펼쳐서 그려진 DOM» 을 본다
(mountExpanded). 접힌 섹션은 자식을 그리지 않으므로 반드시 펼쳐야 한다.
그리고 섹션 소속은 텍스트를 제목으로 자르지 않고 sectionProps 가 붙인
DOM id 로 가른다 — 텍스트로 자르니 옵션 안내문의 「품목별 가격/재고」의
«가격» 이 다음 섹션 제목으로 오인돼 경계가 재고 앞에서 잘렸다.

테스트 5건: 배송에 재고 «없음»(2탭) · 옵션에 재고 «있음»(2탭) ·
readiness 안내가 section-options(1).
admin 332파일/4,545건 통과 · typecheck 0 · build 성공.
```

---

## S-4/5/6 진행 중 — 누락 6개의 «확보 가능성» 실측

CEO 가 SmartStore 에서 본 누락을 코드로 대조했다.

```
필드            현재 시작 상태                    resolver     결론
수입사명         REQUIRED                         🔴 «없다»    원본에 없는 정보(N-3.29)
세탁방법/취급주의 DEFAULT                          🟢 있다      이 상품에서 «못 찾은» 것
사용연령         REQUIRED                         🟢 있다      이 상품에서 «못 찾은» 것
품명(itemName)   REQUIRED                         🔴 «없다»
모델명           REQUIRED                         🔴 «없다»
중량             REQUIRED                         🔴 «없다»
```

크롤러 전수 확인: `careInstructions`/`recommendedAge`/`itemName`/`modelName`/
`weight`/`importer` 를 «추출하는» 경로가 packages/crawler 에 없다(0건).
`canonical-product.ts` 의 정규식 resolver 가 설명문에서 찾아보는 것이
세탁방법·사용연령 둘뿐이다.

### 🔴 갈림길 — 두 갈래가 완전히 다르다

```
① 세탁방법 · 사용연령
   resolver 가 «이미 있다». junioredition.com 설명문에서 못 찾은 것이므로
   → 실제 원본 페이지 문구를 확인해 정규식을 넓히는 일이다(값 지어내기 아님)

② 품명 · 모델명 · 중량 · 수입사명
   resolver 가 아예 없다. 원본에 그 항목이 «있는지» 부터 확인해야 한다.
   🔴 sku(B126AC096 SS26) → 모델명 자동 매핑은 «금지» 다 — CEO S-11 원문:
      「임의로 상품코드/모델번호/고유번호를 같은 것으로 취급하지 않는다」
      S-11 에서 셋의 관계를 먼저 확정한 뒤에야 연결할 수 있다.
```

→ 그래서 S-4/5/6 은 **S-11 과 묶어서** 진행하는 것이 맞다(순서 조정).
   S-11 이 「상품코드 ≠ 모델명 ≠ 고유번호」를 확정해야 ②를 연결할 수 있다.

### 다음 작업(여기서 이어서 시작한다)

```
1. junioredition 원본 페이지의 실제 문구 확인 → ①의 정규식 범위 판단
2. S-11 먼저: B126AC096 SS26 이 원본에서 어떻게 추출되고 Common 어디에
   보존되며 LotteON 이 요구하는 코드와 어떤 관계인지 확정
3. 그 결과로 ②를 연결하거나 「원본에 없음」으로 확정
```

---

## 🟢 S-11 완료 — 그리고 «상품코드가 사라지는» 실제 결함을 잡았다

```
sku(B126AC096 SS26)  원본에서 추출 ✅ → Common product.sku 에 보존 ✅
   네이버   sellerManagementCode(판매자상품코드)
   롯데ON   eitmNo(업체단품번호)
   쿠팡     externalVendorSku   🔴 variant?.sku 만 봤다 → 옵션 «없는» 단품에서
            상품코드가 통째로 빠졌다. 바로 아래 재고는 이미 상품 값으로
            폴백하는데 이 줄만 빠져 있었다 → 고쳤다.

modelName            네이버 고시 modelName · 네이버쇼핑 검색정보
                     🔴 쿠팡·롯데ON payload 에는 «없다»
채널 발급 번호        롯데ON epdNo/spdNo — 우리가 만들거나 sku 로 대신할 수 없다
```

🔴 CEO 경고가 정확했다: **셋은 다른 개념이다.** 그래서 `sku → modelName` 자동
매핑은 금지이고, 테스트가 세 빌더 모두에서 그 대입을 막는다.

화면 표기: 「상품코드(SKU)」 그대로 둔다 — 이미 셀러가 아는 약어이고 쿠팡·
스마트스토어가 쓰던 라벨이다.

## S-4/5/6 ②갈래 판정 (S-11 확정 뒤)

```
품명 · 모델명 · 중량   원본에 없고 resolver 도 없다. 🔴 sku 로 대신할 수 없다(S-11).
                      네이버는 이미 «상세페이지 참조로 등록» 경로를 준다 —
                      셀러가 «선택» 하는 것이라 값을 지어내지 않는다. 유지.
수입사명(importer)     🔴 여기가 진짜 결함이다. 상품마다 다른 값이 아니라
                      «판매자 정보» 인데 product.importer(상품 필드)로 남아
                      상품마다 다시 입력하게 된다. seller_settings 에는
                      manufacturer·asContactNumber·qualityGuarantee·
                      kcExemptionText·defaultCountryOfOrigin 5칸이 있는데
                      importer 만 «없다».
                      → S-8/9 migration 과 «같은 배치» 로 처리한다(다음 작업).
```

---

## 🟢 S-8/9 — 코드 완료 · migration 은 «작성만»

```
067_lotteon_seller_settings_workspace_and_courier.sql  (작성 · 🔴 실행 안 함)
   ① workspace_id + scope_key       043/059 패턴 그대로
      workspace 당 1행 · 레거시(NULL) 도 1행 — 부분 유니크 인덱스 둘
   ② courier_code/label · return_courier_code/label
      🔴 code 와 label 을 «함께» 둔다. label 이 없으면 화면이 코드를 보여주거나
         매번 89 를 다시 불러야 한다(F-7 로 되돌아가는 길)
   ③ seller_settings.importer  — 수입사명은 상품이 아니라 «판매자» 의 것이다

코드 배선
   seller-settings.ts   타입 · COLUMNS · fromRow · writer 에 택배사 4칸
   build-context.ts     courierCode/returnCourierCode 가 fixed() 사다리를 탄다
                        🔴 상품 폼이 «먼저» — 이 상품만 다른 택배사가 가능하다

계약 14건. 레거시 삭제·backfill·임의 workspace·코드 값 기본값 전부 «없음» 을
테스트가 본다.
```

🔴 **migration 은 실행하지 않았다** — 자격증명이 없고(실행으로 확인), 실행은
배포 환경의 일이다. 배포 후 067 을 적용해야 이 배선이 실제로 값을 읽는다.
적용 전에는 새 컬럼이 없으므로 select 가 실패할 수 있다 — 🔴 **배포 순서는
migration 먼저, 그다음 앱이다.**

## 다음 작업

```
S-13/14 (MI 국내/해외 가격)  →  S-1/2/3 (3채널 UI 쿠팡 기준 통일)
```

---

## 🟢 S-13/14 — «이미 돼 있었다». 고치지 않고 계약으로 고정했다

CEO 가 요구한 국내가 네 갈래 구분이 `summarizeRecheckResult` 에 그대로 있다.

```
🔴 오류    검색 자체가 실패(status 가 SUCCESS/NO_RESULT 가 아님)
🟢 확인됨  국내 편집샵 가격을 실제로 저장
🟡 탈락    후보는 찾았으나 «검증된 가격» 이 없다 — 판별에서 걸렀다
⚪ 없음    일치하는 국내 판매처를 찾지 못했다
```

🔴 없는 결함을 만들지 않았다. 대신 이 넷이 한 문장으로 뭉개지지 않도록,
그리고 미탐색이 숫자 0 으로 바뀌지 않도록 계약 8건을 세웠다.
S-14(원본가 ≠ 비교가)도 `origin-product.ts` 가 후보를 «입력으로도» 받지 않는
구조로 이미 만족한다(S-12 조사에서 확인한 그 구조다).

## 🟢 S-1/2/3 — REWORK-14 가 «이미» 쿠팡 기준을 강제하고 있다

```
① 칸 안에 쿠팡에 없는 «부품» 이 하나도 없다
② 필수·선택을 말하는 방법이 세 탭에서 하나다
③ 라벨은 사람이 읽는 이름이다          (+ C-2B 가 내부 필드명 전 통로 제거)
④ 도움말 줄은 «글» 이지 입력칸이 아니다
⑤ 입력칸이 쿠팡과 같은 옷을 입는다
⑥ 배송 한 칸의 «칸 구성» 이 쿠팡과 같다
```

세 탭이 같은 `CollapsibleSection` 셸을 쓴다(REWORK-11). 이번 스프린트가 더한 것:
S-7(재고 자리 통일) · C-2B(내부 코드 비노출) · C-2A(배송 라벨 의미화).

### 🔴 잔여 — 다음 스프린트 후보(이번 범위에서 «구현하지 않음»)

```
옵션 «편집» UX   롯데ON 탭에는 옵션 편집기가 없다(상품정보의 값을 그대로 쓴다).
                 쿠팡의 OptionVariantEditor 를 롯데ON 에 붙이는 것은 UI 통일이
                 아니라 «기능 추가» 다 — CEO §15 「상품 등록 기능 전체 재설계」
                 금지와 경계가 붙어 있어 별도 지시가 필요하다.
카테고리 선택 UX  롯데ON 은 표준+전시 «2중» 구조라 쿠팡과 선택 횟수가 다르다.
                 화면 «모양» 은 통일됐지만(추천 → 고르기) 단계 수는 채널이
                 요구하는 것이라 없앨 수 없다.
```

---

## 🟢 배포 완료 (2026-09-27)

```
push        67e7d49   origin/main 확인
배포        ttaejyo-6q9i1xokm…   ● Ready (Production)
별칭        ttaejyo.vercel.app · commerce-platform-mocha.vercel.app
smoke       두 주소 HTTP 200
SQL 067     CEO 가 실행 완료
```

🔴 **CTO 는 067 반영을 독립적으로 «확인할 수 없다».** DB 자격증명이 없고
`/api/settings/lotteon-seller` 는 401(로그인 뒤)이다. 다만 67e7d49 가 순서
의존을 없앴으므로 067 적용 전/후 어느 쪽이든 앱은 정상이다 — 적용 전이면
택배사가 비어 있을 뿐이고, 적용 후면 값이 흐른다.

## 다음 — Production E2E (CEO 화면 확인 1회)

`docs/CEO-TEST-GUIDE.md` — 🔴 개발 용어 없이 탭/화면/라벨 이름만 사용.
가장 확인이 필요한 곳은 **MI 원본 판매처**다(S-12 는 코드상 재현 불가로
닫혔고 Production 확인 대기 상태다).
