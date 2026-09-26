# Commerce-6 C-2D — 기본 필수정보 누락 감사

> CTO(2026-09-26). **migration 0 · Common 신설 0 · 고급 옵션 통합 0 · push 0.**
> 범위: 아동의류 해외직배송을 기본 셀러가 3채널에 등록할 때 **필수값이 조용히
> 누락되지 않는가**. 그 하나만 본다.

---

## ① 기본 필수정보 Matrix (실측)

`payload` / `validator` / `readiness` 를 직접 읽어 채웠다. 추정 없음.

| 개념 | Common | SmartStore | Coupang | LotteON |
|---|---|---|---|---|
상품명 | ✅ `title` | 🟢 `originProduct.name` 막음 | 🟢 ERROR 규칙 | 🟢 `spdNm` MISSING |
브랜드 | ✅ `brand` | 🟡 payload 만 | 🟢 ERROR 규칙 | 🔴 **검증 없음** |
제조사 | ✅ `manufacturer` | 🟢 고시 필수 | 🟢 고시 필수 | 🟡 `mfcrNm` 조건부 전송 · 검증 없음 |
수입자 | ✅ `importer` | 🟢 `originAreaInfo.importer` | 🟡 고시 경유 | 🟡 `impDvsCd` 조건부 |
판매자 | ✅ `seller_settings` | 🟢 A/S·품질보증 필수 | 🟡 `recommended` | 🔴 검증 없음 |
원산지 | ✅ `countryOfOrigin` | 🟢 `originAreaCode` 막음 | 🟢 고시 | 🟢 `oplcCd` MISSING |
가격 | ✅ `resolveListingPrice` | 🟢 `salePrice>0` | 🟢 ERROR | 🟢 `slPrc` BLOCKED |
**재고** | ✅ `stockQuantity` | 🔴 **검사가 무효였다** | 🔴 **규칙 없었다** | 🔴 **검사 없었다** |
옵션 | ✅ `variants` | 🟢 `optionInfo` | 🟡 WARNING(정상) | 🟢 `itmLst` |
대표이미지 | ✅ `images` | 🟢 막음 | 🟢 ERROR | 🟢 `itmImgLst` |
상세설명 | ✅ `descriptionKo` | 🟢 `detailContent` | 🟡 WARNING | 🟢 `epnLst` |
상품고시 | ✅ 고시 엔진 | 🟢 막음 | 🟢 compliance | 🟢 `pdItmsCd`·`pdItmsArtlLst` |
KC | ✅ `childCertification` | 🟢 막음 | 🟢 CRITICAL | 🟢 `sftyAthnLst` BLOCKED |
카테고리 | ✅ 추천/선택 | 🟢 `leafCategoryId` | 🟢 ERROR | 🟢 표준+전시 BLOCKED |
배송 기본 | 🟡 프로필 | 🟢 주소록 런타임 | 🟢 `settingsMissing` | 🟢 출고지·반품지·정책·지역 BLOCKED |
A/S 기본 | ✅ `seller_settings` | 🟢 전화번호 필수 | 🟡 `recommended` | 🔴 검증 없음 |

🟢 막는다 · 🟡 통과시키되 알린다 · 🔴 **아무 말 없이 지나간다**

---

## ② 분류 (A / B / C / D)

```text
A  Common 필수        상품명 · 브랜드 · 가격 · 재고 · 옵션 · 대표이미지 ·
                      상세설명 · 원산지 · 제조사 · 수입자 · 판매자 · A/S
B  Common + Mapping   카테고리 · 고시 · KC · 택배사(C-2A 에서 확정)
C  Commerce 필수      출고지 · 반품지 · 배송비정책 · 배송가능지역 ·
                      거래처번호 · 수입대행코드 · 판매기간   (채널이 발급/요구)
D  선택/고급          선물포장 · 선물메시지 · 조건부무료 · 묶음배송 ·
                      발송마감시간 · 토요일발송   → 🔴 이번 범위에서 통합 «안 함»
```

🔴 제조사 ≠ 수입자 ≠ 판매자는 **재논의하지 않았다**(CPO §4). payload 연결만 확인했다.
🔴 배송은 「기본 등록에 필요한가」로만 걸렀다(§5). 해외배송비가 판매가에 포함된다는
전제도 그대로 뒀다 — 국내 배송비 정책을 새로 설계하지 않았다.

---

## ③ 🔴 실제 누락 — 재고

세 채널이 **전부** 새고 있었다. 그리고 가장 나쁜 쪽이 스마트스토어였다.

```text
스마트스토어   검증기는 «있었다»   originProduct.stockQuantity > 0
               그런데 빌더가        product.stockQuantity.value || 1
               ────────────────────────────────────────────────────
               🔴 0 을 1 로 바꾼 뒤 그 값을 검사한다 → «절대 실패할 수 없다»
               재고 0 상품이 「재고 READY」로 서고 재고 1 로 등록됐다

쿠팡           규칙이 아예 없었다. payload 는 재고를 그대로 실어 보낸다
롯데ON         검사가 아예 없었다. 옵션 «개수» 만 봤다
```

🔴 **이 결함에 기존 테스트가 한 건도 없었다.** 고친 뒤 아무 테스트도 깨지지
않았다 — 깨질 것이 없었다는 뜻이다.

### 수정

```text
스마트스토어   `|| 1` 제거 → 원본을 그대로 넘긴다. 검증기가 이제 «도달» 한다
쿠팡           어댑터에 stock 규칙(ERROR) 추가
롯데ON         validator 에 itmStkQty 검사 추가
```

🔴 **옵션 상품을 잘못 막지 않는다.** 세 곳 모두 payload 와 «같은 해석» 을 쓴다 —
단품은 상품 재고, 옵션 상품은 조합 중 하나라도 재고가 있으면 판다고 본다.
다른 규칙을 만들면 화면과 등록이 어긋난다(CP001 류 불일치).

---

## ④ 오배선 — 없음(하나는 «죽은 규칙»)

쿠팡 어댑터의 `shipping` 규칙이 `check: () => true` 라 절대 실패하지 않는다.
다만 `readiness.ts` 가 그 필드를 목록에서 걸러내므로 화면에 영향이 없다.
🔴 죽은 코드지만 **잘못 통과시키는 것이 아니므로** 이번에 건드리지 않았다.

`requirementOf` 는 validator 를 그대로 읽어 REQUIRED/OPTIONAL 을 정한다 —
「폼은 필수라는데 검증기는 안 본다」류의 어긋남이 구조적으로 없다.

---

## ⑤ 근거 없는 기본값

```text
🔴 naver `stockQuantity ... || 1`   근거 0 · 검증기를 무효화  → 이번에 제거
🟡 lotteon weekdayCloseTime "1400"  폼 기본값(셀러가 화면에서 보고 고친다) → 유지
🟡 lotteon satSndPsbYn false        같음 → 유지
🟢 lotteon shipBudgetDays 3         문서화된 폴백(일반상품 상한) → 유지
D  선물포장·선물메시지·묶음배송·조건부무료  → 고급, 범위 밖(C-2C 에 기록)
```

---

## ⑥~⑩ 수정 파일 · DB · Readiness · UI · Production

| | |
|---|---|
수정 | `naver/build-payload.ts` · `coupang.adapter.ts` · `lotteon/validate-payload.ts` + 테스트 1 |
DB / migration | **0** |
Readiness | 재고 항목이 세 채널에 «생겼다». 🔴 선택 항목은 그대로(쿠팡 옵션은 WARNING 유지) |
UI | 변경 0. 재고 부족이 기존 부족 항목 목록에 그대로 선다 |
Production 영향 | 🔴 재고 0 상품이 **이제 등록되지 않는다.** 지금까지 스마트스토어는 재고 1 로, 쿠팡·롯데ON 은 0 으로 등록됐다. 재고가 있는 상품의 payload 는 **바이트 단위로 동일** |

이것을 「등록 정책 변경」으로 보지 않은 이유: 스마트스토어 검증기가 이미
「재고 수량이 없거나 0 이하입니다」를 **선언하고 있었다.** 코드가 그 선언대로
동작하게 만든 것이다 — 새 정책이 아니라 결함 수정이다.

## ⑪ 테스트 / Typecheck / Build

🟢 admin **328 파일 / 4,507건** · listing **514건** · marketplace **42건** ·
admin typecheck **0** · marketplace typecheck **0** · build 성공.
listing 5건은 `origin/main` 에서 온 기존 오류(전부 테스트 파일, 내 파일 아님).

## ⑫ Production 검증 상태

가능: 검증기·규칙·payload 경로 전부 테스트로 고정. 🔴 불가: 실제 재고 0 상품이
Production 에 몇 건인지 — DB 자격증명 접근이 막혀 있다(C-1 이후 동일).

---

## ⑬ [CEO 결정 필요]

```text
1. 재고 0 상품을 «등록 자체를 막을» 것인가, 「품절로 등록」을 허용할 것인가
   → 이번엔 막았다(스마트스토어 검증기의 기존 선언을 따름). 커머스에 품절
     상품을 미리 올려두는 운영을 한다면 이 판단이 달라진다.
2. 묶음배송 — 네이버는 대표님 지시로 ON, 쿠팡은 OFF (C-2C 이월)
3. 도서산간 배송 가능 여부를 판매자가 정하게 할 것인가 (C-2B 이월, migration)
```

## ⑭ 다음 작업 후보

```text
· 🔴 브랜드·제조사·A/S 가 롯데ON 에서 검증되지 않는다(위 Matrix 의 남은 빨강)
  — 롯데ON API 가 이 셋을 필수로 요구하는지 UNKNOWN 이라 이번에 막지 않았다.
    막았다가 필수가 아니면 정상 등록을 막게 된다. 89/87 실응답이 선행이다.
· 쿠팡 죽은 `shipping` 규칙 정리(영향 0, 언제 해도 된다)
· C-2B 이월 — 도서산간 결정값 저장(migration → CPO)
```
