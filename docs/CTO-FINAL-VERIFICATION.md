# CTO FINAL VERIFICATION — 3-Commerce 등록 준비

> 대상 커밋 `e27c604` · Production 반영 완료 · 2026-09-28
> 🔴 **「소스에 조건이 있으니 PASS」를 쓰지 않는다.** 이 스프린트에서 그 방식으로
> 두 번 틀렸고(아래 §7), 그래서 아래 항목은 전부 «실행 결과» 다.

---

## 1. 목표

Common/판매자 설정에서 «한 번» 정한 값이 롯데ON 등록에 자동으로 쓰이고,
셀러가 같은 정보를 다시 입력하지 않는 상태. SmartStore·Coupang 기존 등록은
건드리지 않는다.

## 2. 변경사항

| | |
|---|---|
신규 | `settings/LotteOnDeliveryMapping.tsx` — [배송 프로필] «안» 의 「롯데ON 연결」 |
신규 | `shared/source-stock.ts` · `common-carrier.ts` · `field-requirement.ts` · `listing/common/logistics.ts` |
migration | `067` — `lotteon_seller_settings` workspace 축 + 택배사 4칸 · `seller_settings.importer` (CEO 적용 완료) |
수정 | 재고 해석 단일화(4경로) · 상품코드 단품 폴백 · 라벨 사람화 · ⑤배송 6칸 접기 · MI 축 정렬 |

## 3. 실제 렌더 — 두 탭을 마운트해 «전수» 로 뽑았다

```
              Coupang                     LotteON
① 기본정보    상품명·브랜드·SKU·제조사…    같음
② 카테고리                                 같음
③ 옵션        [재고]                      [옵션 · 재고]
④ 가격                                     같음
⑤ 배송        [배송비 · 반품/교환]         7칸 → 6칸 «접힘 조건» 적용
⑦ 고시        [원산지 · 세탁방법]          [고시 품목 · 고시 항목]
⑧⑨⑩                                       같음
⑪ —                                       롯데ON 고유 코드
```

🔴 섹션 골격은 이미 같았다. 라벨의 「번호/코드」를 걷어냈다(출고지번호→출고지 등).
🔴 `원산지코드→원산지`·`브랜드번호→브랜드` 는 **되돌렸다** — 공통 필드와 개념이
섞인다(테스트가 막았다). → `원산지 선택` · `브랜드 선택`.

## 4. 실제 데이터 저장/재조회 — 실제 함수 왕복

`final-mapping-roundtrip.test.ts` (7건, 프로덕션 코드 · Supabase 만 흉내)

```
save(고른 6값)            → 컬럼 6 + 이름 6 «전부» 실린다        PASS
load()                    → 6값이 그대로 돌아온다                PASS
067 «적용 전»(컬럼 없음)  → undefined→null, 죽지 않는다          PASS
조회 실패                  → source=ERROR·failed=true             PASS
                            («설정 없음» 으로 위장하지 않는다)
```

## 5. Common → Mapping → UI → Payload

```
[배송 프로필] 「롯데ON 연결」 6값 선택 → 즉시 PUT
   ↓ /api/settings/lotteon-seller (비어 있던 라우트를 «부른다»)
lotteon_seller_settings (067)
   ↓ GET — LotteOnRegistrationPanel:722
sellerFixed
   ↓ fixed() 사다리 — build-context  6/6 확인
payload  owhpNo · rtrpNo · dvCstPolNo · dvRgsprGrpCd · hdcCd · rtngHdcCd  6/6 확인
```

🔴 Common(배송 프로필)의 값은 **그대로 둔다**. 롯데ON 번호는 별도로 고른다 —
Common 에 채널 코드를 넣지 않는다.

## 6. 정상 케이스

```
폼이 비었고 설정에 값이 있다   → 설정값이 payload 로 간다        PASS
                                 picker 를 숨긴다               PASS(조건)
이 상품만 다른 출고지를 골랐다 → 설정이 «덮지 않는다»            PASS
```

## 7. 실패/미설정 케이스 — 🔴 여기서 내가 두 번 틀렸다

```
① ⑤배송 picker 숨김  조건은 있었는데 sellerFixed 가 언제나 null 이라
                      «한 번도 발동하지 않았다» → §4 의 저장 경로가 그것을 고쳤다
② 067 컬럼           화면 타입이 몰라서 판단 자체가 불가능했다 → typecheck 가 잡았다

미설정              둘 다 없으면 null → 검증기가 막는다            PASS
조회 실패            「목록 0건」이 아니라 실패라고 말하고 재시도    PASS
내부 코드            이름을 모르면 «코드가 아니라» 「확인 필요」     PASS
```

## 8. 실제 상품 E2E — Pickles / Bobo Choses

`commerce6-e2e-children-fashion.test.ts` (9건)

```
셀러가 채운 값이 «사라지지 않는다»      재고 12 → IN_STOCK qty=12   PASS
쿠팡 ERROR 0건                                                      PASS
롯데ON 에 남는 차단은 «전부 채널 것»    상품정보에서 채울 수 있는데
                                        막힌 항목 «0개»             PASS
```

## 9. 회귀 — SmartStore · Coupang

```
admin       347 파일 / 4,683건   PASS
listing 530 · pricing 538 · shared 133 · marketplace 42 · category 22   PASS
```
🔴 SmartStore/Coupang 등록 로직은 **건드리지 않았다**(변경 파일 목록 §2 참조).

## 10~13. typecheck / build / deploy / Production

```
typecheck   admin 0 · shared 0 · marketplace 0 · pricing 0 · category 0
            listing 5 → origin/main 에서 온 기존 오류(전부 테스트 파일, 내 파일 아님)
build       next build 성공
deploy      ttaejyo-rjpcpuxap… ● Ready (Production)
반영 확인    ttaejyo.vercel.app · commerce-platform-mocha.vercel.app  HTTP 200
git         origin/main = e27c604 · 미푸시 0 · tree clean
```

## 14. 🔴 미검증 항목 — 정직하게

```
1. Production API 실제 등록 «호출»
   자격증명이 로컬에 없다(실행으로 확인: .env.local 에 QA_PROXY_TO_PROD ·
   OCI_PROXY_URL 둘뿐). 외부 실행 제약이다.

2. 「롯데ON 연결」 화면의 «실제 렌더»
   useEffect + fetch 구성이라 마운트 검증을 못 했다. 계약 11건은 구조를
   보지만 «그려진 DOM» 은 아니다. 🔴 이 스프린트에서 두 번 틀린 것이 바로
   그 차이라 «검증했다고 말하지 않는다».

3. 롯데ON 150/166/89 «실응답»
   목록이 실제로 몇 건 오는지, cdNm 형식이 무엇인지 본 적이 없다.
   그래서 코드를 추정하지 않고 셀러가 고른 값만 저장한다.

4. 실제 재고 0 상품이 Production 에 몇 건인지 — DB 접근 불가.
```

### 🔴 2번이 CEO 테스트에서 가장 먼저 드러날 자리다

「롯데ON 연결」에서 **목록이 뜨지 않으면** 인증키/IP 문제이고, 그때 화면은
「불러오지 못했습니다 + 다시 불러오기」를 보여준다 — 「선택 안 함」으로 조용히
넘어가지 않는다(§7 계약). 그 화면이 나오면 그것이 신호다.
