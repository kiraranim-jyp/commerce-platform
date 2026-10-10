# ② 3-Commerce Semantic Notice Parity — 착수점 (기준 `8a6733e8`, 2026-10-10)

> 🔴 **새 세션은 이 문서부터 읽고 ②-1 로 들어간다.** 아래 「확보된 근거」는
> 재조사 금지다. 그리고 **②-3 에는 CPO 판정이 필요한 막힘이 하나 있다**(§3).

---

## 0. 지금 상태

```
① Naver Notice Adapter   🟢 PASS · 배포됨 (8a6733e8)
   LotteON B⑥             🟢 PASS · 배포됨 (b5cac1de)
   Coupang                🔴 교체 «대상 아님» — 고정 코드표가 없다(런타임 메타)
전체 회귀                 🟢 493 files / 7417 passed
Type / Build / smoke      🟢 (typecheck baseline: listing 5 · crawler 2 는 선재)
② 3채널 parity            🔴 미착수 — 이 문서가 그 착수점이다
③ Smallable 실상품 E2E    🔴 미착수
④ 3-Commerce 최종 E2E     🔴 미착수
실등록                    🔴 STOP
```

---

## 1. 각 채널의 고시가 payload 에서 «어디» 에 있는가 (확보됨)

```
Naver     originProduct.detailAttribute.productInfoProvidedNotice
            → { productInfoProvidedNoticeType: "KIDS"|"WEAR", kids|wear: {…} }
            → 조립은 buildNaverNoticePayload() 가 한다 (①에서 교체)
Coupang   items[].notices[]
            → { noticeCategoryName, noticeCategoryDetailName, content }
            → packages/listing/src/coupang/build-payload.ts:1594-1600
LotteON   spdLst[].pdItmsArtlLst
            → { pdArtlCd, pdArtlCnts }
            → 항목 집합·순서는 lotteOnNoticeSpecs() 가 정한다 (B⑥에서 교체)
```

🔴 **세 구조는 서로 다르다.** 그래서 ②의 비교 기준은 raw JSON equality 가 아니라
「공통 semantic 이 각 채널에서 같은 의미로 표현됐는가」다(지시서 ②-4 그대로).

---

## 2. 🔴 공용화 범위 — 생각보다 «좁다» (②-1)

세 builder 의 «추가» 입력이 완전히 다르다. 실측:

| 채널 | 공유 입력 | 🔴 채널 전용 추가 입력 |
|---|---|---|
| Naver | `CanonicalProduct` + `ListingModel` | `leafCategoryId` · 주소록번호 2개 · 반품/교환 배송비 · `originAreaCode` · `categoryRequiresChildCertification` 등 **필수 9~11개** |
| Coupang | 같음 | `binding: CoupangCommerceBinding` **(필수)** + `categoryMeta` 등 선택 |
| LotteON | 같음 | `channel: LotteOnChannelConfig` **(필드 ~30개)** + `detailHtml` |

### 결론 — 공용화할 수 있는 것은 둘뿐이다

```
✅ field<T>(value, source)                 세 테스트가 각자 복사해 쓰고 있다
✅ CanonicalProduct / ListingModel fixture 세 테스트의 make*Product 가 거의 같다
❌ 채널 입력 생성                           공용화 불가 — 각 채널이 다른 세계다
```

🔴 즉 ②-1 은 「세 채널 입력을 하나로 합치기」가 **아니다.** 상품 fixture 하나를
공유하고, **채널 입력은 채널별로 따로 만들어** 세 builder 를 각각 부른다.

### 기존 헬퍼 위치 (옮길 원본)

```
Naver     naver/__tests__/build-payload.test.ts
          field():19 · makeMinimalProduct():23 · makeMinimalListing():70 · baseInput():803
Coupang   coupang/__tests__/notice-regression.test.ts
          makeMockProduct():21 · makeListing():69 · NO_BINDING
LotteON   lotteon/__tests__/build-payload.test.ts
          makeProduct():30 · completeChannel():81 · inputFor():119
```

🔴 `backfillCanonicalProduct` 는 **없다**(grep 확인). 세 파일이 각자 inline 으로
만든다 — 그래서 공용화 가치가 있고, 동시에 **기존 테스트 동작을 바꾸지 않는 것**이
제약이다(지시서 ②-1).

### 참고 — 이미 있는 다채널 테스트

`naver/__tests__/p0channel02-no-cross-channel-leakage.test.ts` 는 **격리** 만 본다
(각 채널 어휘가 다른 채널 파일에 새지 않는가). 🔴 **같은 입력으로 세 builder 를
동시에 부르는 테스트는 없다** — ②가 그 첫 번째다.

---

## 3. 🔴🔴 ②-3 막힘 — 쿠팡 `required` 에 «실측 근거가 없다» (CPO 판정 필요)

지시서 ②-3 은 「실제 channel metadata 구조에서 확인 가능한 것만 fixture 화 ·
**required 를 추정하지 않는다** · 확인할 수 없는 항목은 FAIL/CLOSED」다.

그 기준으로 전수 조사한 결과:

| 항목 | 근거 | 판정 |
|---|---|---|
| 타입 구조 `CoupangCategoryNoticeMeta` | `coupang/build-payload.ts:858-861` | 🟢 코드 확실 |
| API 경로 | `coupang/_lib/category-meta.ts:10-11` | 🟢 코드 확실 |
| payload 구조 `items[].notices[]` | `build-payload.ts:1594-1600` | 🟢 코드 확실 |
| 값 채우기 우선순위 | `build-payload.ts:1519-1593` | 🟢 코드 확실 |
| **`required` 의 실제 값** | 🔴 **없음** | 🔴 **선언만 있음** |
| **항목명이 한국어인지** | 테스트 스텁뿐 (간접) | 🟡 간접 증거 |

```
🔴 리포지터리에 쿠팡 category-meta API 의 «실제 응답 샘플이 한 건도 없다».
   apps/admin/fixtures/ 에는 SmartStore 것만 있다.
   기존 테스트의 noticeCategories 는 전부 «손으로 쓴 스텁» 이다
   (kc-coupang02-notice-content.test.ts:32 · tennis-registration-baseline.test.ts:403).
   "MANDATORY" | "OPTIONAL" 은 우리가 «타입으로 선언» 한 것이고 실측이 아니다.
```

### 그래서 ②-3 을 지시서대로 하면 — 쿠팡은 FAIL/CLOSED 다

🔴 **근거 없이 fixture 를 만들면 그 자체가 「required 추정」이다.** 지시서가
금지한 바로 그것이다. 내가 스텁을 하나 더 쓰는 것은 근거를 만드는 것이 아니다.

### 근거를 얻는 경로는 둘뿐이고, 🔴 **CTO 는 둘 다 할 수 없다**

```
① 실제 API GET   /…/category-related-metas/display-category-codes/{code}
                 → 쿠팡 자격증명 필요. Production Sensitive = CTO 는 읽을 수 없다.
                 → /api/* 는 미들웨어가 인증 앞단에서 막는다.
② 공식 문서       developers.coupang.com — 인증 필요 영역이다.
```

### CPO 가 고를 것 (둘 중 하나)

```
(A) 쿠팡 required parity 를 UNKNOWN 으로 «남기고» ② 를 진행한다
    → Naver·LotteON 은 required parity 까지 전수 대조
    → 쿠팡은 «구조 + 값 보존» 만 대조하고 required 는 UNKNOWN 으로 표시
    → 기존 스텁(이미 42건+ 테스트가 쓰는 것)을 fixture 로 승격하지 «않고»
      「근거 없음」을 명시한 채 구조 검증에만 쓴다
    🔴 이때 ②-6 의 「Coupang metadata fixture 근거 확인」은 «UNKNOWN 으로 종결»
       이 되고, 「PASS」로 적지 않는다

(B) ③/④ 라이브 단계에서 실제 응답을 «한 번» 캡처한 뒤 ② 를 완성한다
    → 쿠팡 등록 화면을 한 번 여는 것으로 category-meta 가 실제로 호출된다
    → 그 응답을 fixture 로 남기면 required 가 실측 근거를 갖는다
    → 🔴 그러면 ② 의 쿠팡 부분이 ③ 뒤로 밀린다 (지시서 순서와 어긋난다)
```

🔴 **내 권고는 (A)** 다. 이유: ②의 목적은 「공통 모델이 채널 payload 로 올바르게
번역되는가」이고, 그것은 쿠팡 `required` 실값 없이도 **구조·값·누락** 축에서
검증된다. 그리고 (B)는 ② 전체를 실상품 단계에 묶어 버려, ②가 ③의 선행조건이라는
지시서 순서를 뒤집는다. 다만 어느 쪽이든 **「근거 없음」을 PASS 로 적지 않는 것**이
핵심이고, 그 판정은 CPO 몫이다.

---

## 3.5 🟢 CPO 판정 = **(A)** (2026-10-10 확정)

```
쿠팡 required 는 UNKNOWN 으로 «유지» 하고 ② 를 진행한다
쿠팡 검증 범위   ✓ notice 구조 · ✓ 항목 대응 · ✓ 값 보존
                 ✓ 누락/추가 감지 · ✓ semantic mapping
                 ✗ required 실측 판정 → UNKNOWN
🔴 UNKNOWN 을 PASS 로 기록하지 않는다. ②-6 게이트의 「Coupang metadata fixture
   근거 확인」 칸은 «UNKNOWN 종결» 로 적는다.
```

🔴 그래서 쿠팡 메타 스텁을 **「fixture」로 승격하지 않는다.** 변수 이름에
`UNVERIFIED` 를 넣고, required 값은 «타입이 요구해서» 적는 것일 뿐 **비교에
쓰지 않는다.** 판정은 함수 하나가 UNKNOWN 과 «이유» 를 같이 돌려주게 한다.

---

## 3.6 확보된 입력 상수 — 🔴 다시 찾지 않는다

세 builder 를 부르는 데 필요한 값을 실측으로 뽑아 두었다.

```
Naver  buildNaverProductPayload({ product, listing, …아래 })
       leafCategoryId "50000535"            (실제 production GET 으로 확인된 리프)
       releaseAddressBookNo 900000001        🔴 placeholder — 판매자 식별정보는
       refundAddressBookNo  900000002           코드에 하드코딩하지 않는다
       primaryReturnDeliveryCompanyPriorityType "PRIMARY"
       sellerDeliveryFee null · returnDeliveryFee 3000 · exchangeDeliveryFee 5000
       originAreaCode "00" · originAreaRequiresContent false
       childCertificationInfoId 1041 · categoryRequiresChildCertification true/false

Coupang buildCoupangPayload(product, listing, { binding: {} })   ← binding 필수
        categoryMeta 는 선택 — 넘기면 items[].notices[] 가 채워진다

LotteON buildLotteOnPayload({ product, channel, detailHtml })
        channel = { ...BLANK_LOTTEON_CHANNEL_CONFIG,
                    ...buildLotteOnSalePeriod(new Date(고정값)),
                    trGrpCd "SR" · trNo "LO10000" · standardCategoryNo "BC63080300"
                    displayCategories [{ mallCd:"LTON", lfDcatNo:"FC11130203" }]
                    originCode · taxTypeCode "01"
                    noticeItemCode "01"|"23" · noticeArticles [{pdArtlCd,pdArtlCnts}]
                    outboundPlaceNo "115" · returnPlaceNo "115"
                    deliveryCostPolicyNo "335" · deliveryRegionGroupCode "GN101" }
        🔴 noticeArticles 는 «손으로 적지 말고» resolveLotteOnNotice() 결과로
           채운다 — 그것이 실제 경로이고(관리 앱 build-context 가 그렇게 한다),
           손으로 적으면 공통 모델이 실제로 쓰였는지 검증하지 못한다.
        import 위치: BLANK_LOTTEON_CHANNEL_CONFIG · buildLotteOnSalePeriod
                     ← packages/listing/src/lotteon/types
```

🔴 **fixture 는 더럽게 만든다.** `careInstructions` · `itemName` · `weight` ·
`certificationType` · `importer` 를 **비워서 명시** 한다(생략하면 `.value` 로
터진다 — 3회 걸렸다). 그리고 값은 「면 100%」 같은 흔한 문자열이 아니라
추적 가능한 값으로 둔다(예: `"코튼 97% 엘라스탄 3%"`) — 세 채널에서 같은 값인지
확인하려면 구별되는 값이어야 한다.

---

## 3.7 🔴 이 세션이 ② 를 «시작했다가 되돌린» 기록

공용 fixture + parity 테스트 두 파일을 썼다가 **지웠다.** 이유를 남긴다:

```
그 테스트는 세 builder 를 «실제로 호출하지 않았다» — 모델/adapter 계층만
비교했고, 그건 channel-notice-adapters.test.ts 가 이미 하는 일이다.
그런데 파일 이름이 notice-semantic-parity 였다.
🔴 그건 「테스트가 거짓말하는」 형태다. ②-2 의 본체(3채널 payload 동시 생성)를
   빼고 이름만 parity 인 파일을 남기면, 다음 사람은 ②가 된 줄 안다.
```

→ 다음 세션은 **②-2 를 먼저** 한다. 세 builder 를 실제로 부르고 payload 를 손에
쥔 다음 비교를 쓴다. 비교부터 쓰면 또 같은 함정에 빠진다.

---

## 4. ② 착수 순서 (CPO 판정 후)

```
②-1  공용 fixture 추출 — field() + CanonicalProduct/ListingModel 두 개만
      🔴 기존 세 테스트의 make*Product 를 «바꾸지 않는다». 새 공용 헬퍼를 만들고
         새 parity 테스트만 그것을 쓴다(기존 테스트 이동은 범위 밖 — payload 변화
         위험 0 을 유지한다)
②-2  상품 1건 → 세 builder 각각 호출 (채널 입력은 채널별로)
②-4  semantic parity 판정 — 항목존재 · required · 값 · 순서 · label · 누락
      🔴 공통 모델이 채널 label/키 순서를 «덮지 않는다» 를 같이 단정한다
         (①에서 그 원칙을 세웠다: 순서·라벨은 채널 표기다)
②-5  음성 대조 6건 — 🔴 **기대값과 실제값을 같은 함수에서 만들지 않는다**
         ①에서 그 함정에 실제로 걸렸다: 순서 가드의 기대값을
         naverNoticeFieldOrder() 로 적었더니 순환이라 순서 변조를 못 잡았다.
         → 교체 «전» 리터럴을 손으로 박아 독립 기준으로 만들어야 한다
②-6  게이트 16항 — 🔴 쿠팡 required 는 판정 (A)/(B) 에 따라 적는다
```

---

## 5. ① 에서 세운 원칙 (②가 그대로 따른다)

```
공통 모델이 정하는 것   semanticKey · 항목 «집합» · 필수여부 · 품목/타입 선택
채널이 정하는 것        label · 키 «순서» · 값 해석
🔴 라벨을 공통으로 올리지 않는다
   품목 01 의 0090 = 「A/S」 · 품목 23 의 0090 = 「A/S 책임자와 전화번호」
   같은 코드의 이름이 품목마다 다르다
🔴 순서를 공통 모델에서 가져오지 않는다
   공통 모델 KIDS 순서 ≠ 네이버 payload 순서 (롯데ON 은 우연히 일치했을 뿐)
🔴 fail closed
   모델이 요구하는 칸이 채널에 없으면 «부분» 을 보내지 않고 전체를 닫는다
🔴 UNKNOWN → WEAR 를 「닫는다」로 바꾸지 않는다
   네이버는 카테고리 경로가 없어 UNKNOWN 이 흔하고, 그 상품들이 지금 정상
   등록된다. 닫으면 돌고 있는 등록이 깨진다
```

---

## 6. 🔴 교체하면 «소스를 보던» 기존 가드가 먼저 떨어진다 — 옳은 반응이다

①에서 두 번 겪었다. **지우지 말고 감시 대상을 옮긴다.**

```
common-notice-parity          kids/wear 리터럴 칸 수 세기
   → 「adapter 에 넘겼는가 + 리터럴로 되돌아가지 않았는가」 + payload 로 순서 센다
p56-followup-ceo-three        `naverNoticeTypeFor(` 존재 검사
   → builder 는 공통 판정 호출 + adapter 위임, 그리고 변환이 adapter 에
     «있는지» 대조군까지
```

🔴 「builder 에서 사라졌다」만 확인하면 **「어디에도 없다」와 구별되지 않는다.**
부정 단정에는 반드시 대조군을 둔다.

---

## 7. 명령어

```bash
# 기준 숫자 — 이 셋이 변하면 payload 가 변한 것이다
cd apps/admin
npx vitest run ../../packages/listing/src/naver/__tests__/build-payload.test.ts   # 92
npx vitest run ../../packages/listing/src/lotteon                                 # 187
npx vitest run ../../packages/listing/src/notice                                   # 104

# 전수 — 🔴 PIPESTATUS 로 vitest 종료코드를 본다(head 의 0 을 믿지 않는다)
npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^ *(FAIL|×)|Test Files|Tests "
echo "vitest-exit=${PIPESTATUS[0]}"

# typecheck — 🔴 0 이 기준이 «아니다». baseline: listing 5 · crawler 2 · 나머지 0
for p in shared content listing crawler category marketplace; do
  echo "$p=$(npx tsc --noEmit -p packages/$p/tsconfig.json 2>&1 | grep -c 'error TS')"; done

# 배포 증거 — 🔴 307/401 은 route 증거가 아니다. 빌드 로그의 Commit: 줄을 본다
npx vercel inspect https://ttaejyo.vercel.app --logs 2>&1 | grep -iE "Commit:" | head -1

# 완료 기준 — clean «과» ahead/behind 둘 다
git fetch origin --quiet && git status --short
git rev-list --left-right --count origin/main...HEAD   # → 0  0
```

---

## 8. 관련 메모리

```
common-notice-model-is-observation-only   B⑥ 현 위치 · 14:13 · 순환 가드 함정
commerce-egress-handoff                   FIXIE 는 한도 초과로 종결(재조사 금지)
coverage-is-a-property-not-a-filename     「테스트 존재」≠「속성 검증」
source-scan-must-strip-comments           소스 검사는 주석을 벗기고
fixtures-must-be-dirty                    깨끗한 fixture 는 공란을 놓친다
kc-value-is-not-verification              「값 있음」 ≠ 「확인됨」
measure-with-the-production-function      손으로 만든 요청은 운영 경로가 아니다
```
