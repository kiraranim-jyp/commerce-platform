# LOTTEON CATEGORY → NOTICE / CHANNEL REQUIRED DATA TRACE

> CPO 지시(2026-09-28). **조사 전용 — 코드 변경 없음.**
> 카테고리를 골랐는데 고시·채널 필수정보가 따라오지 않는 «단절점» 을 코드 경로로 찾는다.
>
> 🔴 `PD_ITMS_CD` 가 조회된다는 것을 근거로 임의 고시값을 만들지 않는다.
> 🔴 배송지 Common 모델은 이번 범위가 아니다(CPO 보류).

---

## 0. 화면이 말한 것 (Production, 2026-09-28)

상품: `Watercolor All Over Cropped Sweatshirt by Bobo Choses` / 카테고리 `여아가디건`

| 섹션 | 상태 | 화면 값 |
|---|---|---|
| ② 카테고리 | 🟢 준비됨 | 표준카테고리 `여아가디건`, 전시카테고리 1개, **과세구분 `01`** |
| ⑤ 배송 | 🟢 준비됨 | 여섯 칸 모두 값 있음 (STEP3-FIX 이후) |
| ⑦ 고시정보 | 🔴 확인 필요 | 고시 품목 = **입력 필요**(드롭다운 「선택 안 함」) · 고시 항목 = **입력 필요**(빈 textarea) |
| ⑧ KC / 인증 | — | 안전인증 목록 입력칸 있음 |
| ⑪ 롯데ON 고유 코드 | 🔴 확인 필요 | 원산지 선택 = **입력 필요**(드롭다운 「선택 안 함」) · **과세 유형 = 「과세」(자동으로 채워짐)** |

Readiness 남은 항목 3개: `상품품목코드(고시)` · `고시정보` · `채널 필수정보`.

🔴 **과세 유형은 이미 자동으로 채워졌다.** 카테고리의 `tdfCd = 01` 이 화면까지 왔다
(Sprint A ② + R3 의 결과). 그러므로 「롯데ON 고유 코드」 두 칸은 **상태가 서로 다르다** —
CPO 지적대로 한 덩어리로 다루면 안 된다.

---

## 1. 검증기가 그 3개를 막는 정확한 조건 (실측)

`packages/listing/src/lotteon/validate-payload.ts`

```ts
// 154  4) 원산지 코드 — 텍스트를 코드로 추론하지 않는다.
if (channel.originCode) ready("oplcCd", "원산지코드");
else … "롯데ON 원산지코드(공통코드 OPLC_CD)가 지정되지 않았습니다. 원산지 텍스트만으로는 코드를 정할 수 없습니다."

// 170  과세
if (isKnownLotteOnTaxType(channel.taxTypeCode)) ready("tdfDvsCd", "과세 유형");

// 186  5) 상품정보제공고시 — 품목코드 + 항목 목록
if (channel.noticeItemCode) ready("pdItmsCd", "상품품목코드(고시)");
else blocked(… "상품품목코드(PD_ITMS_CD)가 지정되지 않았습니다.", "NOTICE_REQUIRED");

if (channel.noticeArticles.length > 0 && channel.noticeArticles.every((a) => a.pdArtlCd && a.pdArtlCnts.trim()))
  ready("pdItmsArtlLst", "고시 항목");
else blocked(… "항목코드(pdArtlCd)는 품목마다 코드체계가 달라 자동 생성하지 않습니다.", "NOTICE_REQUIRED");
```

읽히는 대로다 — 막고 있는 것은 **세 개의 빈 값**이다: `originCode`, `noticeItemCode`, `noticeArticles`.
검증기는 값을 «만들지 않겠다» 고 명시적으로 적어 두었다. 이 조사가 뒤집을 대상이 아니다.

---

## 2. 코드 경로 추적

*(조사 진행 중 — 두 갈래 조사 결과를 여기에 채운다)*

---

## 3. 분류 — `CATEGORY_DERIVED / COMMON_PRODUCT / SELLER_CONFIRMATION / LOTTEON_ONLY / UNKNOWN`

*(조사 진행 중)*

---

## 4. 결론과 다음 판단 요청

*(조사 진행 중)*
