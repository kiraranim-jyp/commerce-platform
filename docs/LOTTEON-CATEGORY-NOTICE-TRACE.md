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

## 2. 코드 경로 추적 — 칸마다 단절점이 «다르다»

CPO 질문: 카테고리→고시를 잇는 코드가 **(a) 있는데 안 도는가, (b) 애초에 없는가.**
답은 하나가 아니다. **칸마다 다르다.** 이것을 뭉뚱그리면 잘못된 처방이 나온다.

### ① 과세 유형 — 🟢 **있고, 돈다**

```
205 응답 tdf_cd
  → lotteon-category.ts:202  readString(source, "tdf_cd","tdfCd","tdf_Cd","tdfDvsCd","tdf_dvs_cd")
  → lotteon-channel-form.ts:266  codes: { …, taxTypeCode: category.taxTypeCode ?? "" }
  → LotteOnRegistrationPanel.tsx:2072  displayValue={lotteOnTaxTypeName(form.codes.taxTypeCode)}
  → build-context.ts:202  taxTypeCode: trimOrNull(form.taxTypeCode) ?? ""
```

Production 화면이 이 경로를 증명한다 — 카테고리 패널에 `과세구분 tdfCd 01`,
⑪ 에 「과세」. **CATEGORY_DERIVED, 완결.**

### ② 고시 품목(`pdItmsCd`) — 🟡 **(a) 코드는 있는데 «데이터가 안 온다»**

```
lotteon-category.ts:195  readArray(source, "pd_Itms_list", "pd_itms_list")
  → 각 entry 에서 pd_Itms_cd 수집 → noticeItemCodes: string[]
lotteon-channel-form.ts:265  itemCode: category.noticeItemCodes[0] ?? keptNoticeItemCode(form)
```

**잇는 코드는 있다.** 그런데 P1-D 실측이 이미 확정했다 —

```
205 pd_itms_list     항상 empty        (REAL-RESPONSE / CONFIRMED)
```

그래서 `noticeItemCodes` 는 늘 `[]` 이고 `itemCode` 는 늘 `""` 다.
**우리 결함이 아니라 롯데ON 이 그 값을 주지 않는 것이다.**

🔴 다만 셀러가 막히지는 않는다. `useLotteOnCommonCodes("PD_ITMS_CD")`(737)가
**롯데ON 이 준 40건**을 이름으로 내려주고, 셀러가 `CommonCodePicker` 로 고른다
(입력칸은 `readOnly` — 코드를 적게 하지 않는다). **SELLER_CONFIRMATION, 2클릭.**

### ③ 원산지(`oplcCd`) — 🟡 **(b) 자동 변환은 «없다». 의도적으로 없다.**

```
Common  countryOfOrigin = "Spain"      (텍스트)
build-context.ts:198  originCode: trimOrNull(form.originCode)   ← 폼 값 그대로
```

Common 텍스트를 롯데ON 코드로 바꾸는 코드는 **어디에도 없다.** 검증기가 이유를
적어 두었다 — 「원산지 텍스트만으로는 코드를 정할 수 없습니다」.

`useLotteOnCommonCodes("OPLC_CD")`(750)가 실제 코드표(239건, ISO 3166-1 alpha-2)를
이름으로 내려주고 셀러가 고른다. **SELLER_CONFIRMATION, 2클릭.**
자동화 설계(ISO 축)는 CPO 보류 중이다 — 이 조사가 푸는 대상이 아니다.

### ④ 고시 항목(`pdItmsArtlLst`) — 🔴 **(b) 없다. 그리고 «만들 수도 없다».**

```
lotteon-channel-form.ts:228-268   articlesText 를 «한 번도 건드리지 않는다»
LotteOnRegistrationPanel.tsx:1814  readOnly          ← 셀러도 채울 수 없다
자동 채움 경로                      코드베이스 전체에 0개
```

항목코드(`pdArtlCd`)의 **어휘 자체가 우리 손에 없다.** P1-D 실측:

```
89  PD_ARTL_CD        ok:true · rowCount 0     → 그룹이 비어 있다
89  PD_ITMS_CD 참조칸  ref1 "SELECT" · ref2~4 빈값
205 pd_itms_list      항상 empty
```

**판정: 고시 항목코드 조회 API = 없음(CONFIRMED).**

---

## 2-B. 🔴 그래서 지금 진짜 막고 있는 것은 «한 칸» 이다

| 칸 | 셀러가 지금 끝낼 수 있는가 |
|---|---|
| 과세 유형 | ✅ 이미 자동으로 채워져 있다 |
| 고시 품목 | ✅ 목록에서 고르면 된다(40건, 이름) |
| 원산지 | ✅ 목록에서 고르면 된다(239건, 이름) |
| **고시 항목** | 🔴 **어떤 방법으로도 끝낼 수 없다** |

`pdItmsArtlLst` 는 API 87 **필수**다(`commerce-6-phase-a-field-census.md:297`).
그리고 3차 LIVE 등록이 정확히 여기서 거절됐다 —
`resultCode 9999 「상품품목항목코드 필수값이 누락입니다」`.

**즉 롯데ON 등록은 현재 우리 화면만으로는 완료할 수 없다.** 이것이 단절점이다.

### 교착의 모양

```
고시 항목코드를 알아야  →  상품을 등록할 수 있고
상품이 등록돼 있어야    →  94 로 고시 항목코드를 알 수 있다
                          (registeredProductCount = 0)
```

유일하게 남은 읽기 경로 93/94 는 **기등록 상품이 1건이라도 있어야** 열린다.
`payload-preview` 가 이미 매 호출마다 세 곳을 탐침하고 그 결과를
`payload.articleCodeProbe` 로 실어 보낸다 — 즉 **새 코드 없이도 답이 나올 수 있는
자리가 이미 있다.** 다만 등록 0건이면 그 자리도 비어 있다.

---

## 3. 분류표

| 필드 | 분류 | 근거 | 상태 |
|---|---|---|---|
| 과세 유형 `tdfDvsCd` | `CATEGORY_DERIVED` | 205 `tdf_cd` → 폼 → payload (실측 연결) | 🟢 완결 |
| 고시 품목 `pdItmsCd` | `SELLER_CONFIRMATION` | 89 PD_ITMS_CD 40건 실응답 | 🟢 2클릭 |
| 원산지 `oplcCd` | `SELLER_CONFIRMATION` | 89 OPLC_CD 239건 실응답 | 🟢 2클릭 |
| 고시 «내용» (소재·색상·치수·원산지) | `COMMON_PRODUCT` | `collectLotteOnNoticeSourceValues` — 이미 상품정보에 있고 화면에 표시됨 | 🟢 값은 있다 |
| **고시 «항목코드» `pdArtlCd`** | 🔴 `UNKNOWN` | 89 rowCount 0 · 205 empty · 94 등록 0건 | 🔴 **막힘** |
| 안전인증 `sftyAthnLst` | `SELLER_CONFIRMATION` | 실제 KC 번호 — 만들 수 없음 | (별건) |

🔴 주목할 대칭: **고시 「내용」은 이미 다 있다**(17% Recycled Cotton · Lavender ·
2-3 Years… · Spain). 없는 것은 그 내용을 **어느 항목코드에 넣을지**뿐이다.
스마트스토어는 이 값들로 고시를 자동 생성하고, 쿠팡은 이름(`noticeCategoryDetailName`)과
`MANDATORY` 표시로 내려주어 `selectCoupangNoticeCategory()` 가 화면과 payload
**양쪽에서 같은 함수**로 고른다. 롯데ON 만 코드로 주고, 그 코드표를 주지 않는다.

---

## 4. 결론

- **(a)/(b) 답**: 과세 = 있고 돈다 · 고시 품목 = **있는데 데이터가 안 온다** ·
  원산지 = 없다(의도) · **고시 항목 = 없고, 만들 수도 없다**.
- 카테고리→고시 배선을 «고치는» 작업으로는 이 화면이 풀리지 않는다.
  배선은 이미 있거나, 없는 것이 옳다.
- 남은 단 하나는 `pdArtlCd` 어휘의 **부재**이고, 그것은 코드로 해결할 수 없다.

🔴 **이 조사는 여기서 멈춘다.** 다음은 CTO 가 정할 문제가 아니다 —
`pdArtlCd` 를 얻는 길은 전부 **Production 실행 또는 판매자센터 실물 확인**을
동반하며, 그것은 CPO/CEO 의 결정 영역이다. 임의 매핑·추정·셀러 코드 입력은
이미 세 번 금지됐고 한 번 LIVE 에서 거절됐다.

