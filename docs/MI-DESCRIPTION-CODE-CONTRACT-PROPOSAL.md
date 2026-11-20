# MI 상세설명 품번 — 계약 충돌 정리와 개정안 (CTO 산출 · 2026-11-20)

> 🔴 **운영 코드 변경 0 · verdict 변경 0 · 계약 테스트 변경 0 · DB 0 · 배포 0.**
> 🔴 표준(`docs/STANDARD-V1.md`)·진입점(`docs/START-HERE.md`)은 **수정하지 않았다**.
> 🔴 이 문서는 **개정안 제출물** 이고 표준 조항이 아니다 — 조항 작성은 CPO 산출물이다.
> 🟢 근거는 PHASE 2~6 산출물 재사용이다(`preserved/mi-composite-identity-eval.json` · 재조사 0).

---

## 1. Contract A · P2 정확한 문구와 충돌 지점

**원문**(`packages/shared/src/product-facts.ts`)

```
:778  Contract A — 후보측 전용이다. 원상품 설명을 후보 증거로 쓰지 않는다.
:801  Contract P2 — 비교 입력이 아니다. compareCrossSellerProducts · compareModelCode ·
      deriveMatchTruth · priceTierFromLink 는 이 칸(`evidence`)을 읽지 않는다.
      늘어난 증거가 verdict 를 바꾸면 그것은 실패다.
:786  Contract C — 부재가 «정상» 이다. 없으면 null 이고 추정해서 채우지 않는다.
:1010 Contract M — 라벨 품번이 서로 다른 값으로 둘 이상이면 **null**(지어내지 않는다).
```

🔵🔵 **충돌은 «없다» — Contract A 는 CPO 결정 ①과 이미 같은 뜻이다.** 실측:

```
🟢 원상품측  product-identity-dna.ts:213
   `const labeled = extractLabeledProductCode(product.description?.value)`
   ⟹ **원상품 설명에서 «자기» 품번을 이미 복구한다**
🟢 후보측(Shopify)  seller-facts.ts:247
   `brandModelCode: extractLabeledProductCode(description) ?? extractCodeLikeSlugSegment(slug)`
   ⟹ **후보 설명에서 «자기» 품번을 이미 복구한다**
```

⟹ 🔴 **Contract A 가 금지하는 것은 「양쪽 설명을 읽는 것」이 아니라 「한쪽 설명을 다른 쪽
상품의 증거로 복사하는 것」** 이다. 코드가 이미 그 의미로 동작한다.
🟡 **그러므로 필요한 것은 A 의 «폐지» 가 아니라 «문구 명확화» 다**(CPO 결정 ①과 동일한 내용):
```
현행 문구  「🔴 **Contract A — 후보측 전용이다.** 원상품 설명을 후보 증거로 쓰지 않는다.」
```

🟡 **CPO 검토용 개정 문구(제안)** — 🔴 `STANDARD-V1.md` 와 `product-facts.ts` 를 **수정하지 않았다**:

```
🔴 **Contract A — 설명은 «그 상품 자신의» 사실 복구에만 쓴다.**
   ① 원상품 설명 → **원상품 자신의** ProductFacts(brand · brandModelCode · productName …) 복구
   ② 후보 설명   → **후보 자신의** ProductFacts 복구
   ③ 🔴 **교차 복사 금지** — 한쪽 설명에서 읽은 값을 다른 쪽 상품의 칸에 넣지 않는다
   ④ 🟢 복구된 **양쪽 ProductFacts 를 비교하는 것은 허용** 한다(그것이 비교의 정의다)
   ⑤ 🔴 설명에서 발견된 품번이 **그 상품의 공식 품번인지** 확인한다 —
      라벨 앵커 · **Contract M**(서로 다른 값 둘 이상이면 null) · 가격 방어
   ⑥ 🔴 설명에 품번이 있다는 사실만으로 **SAME 을 결정하지 않는다**
```

**바뀌는 것 / 바뀌지 않는 것**

```
🟢 바뀌지 않는다  Contract **P2**(`evidence` 는 비교 입력이 아니다) · Contract **C**(부재가 정상) ·
                Contract **M**(복수 코드 null) · Contract **D/P1**(optional) ·
                `SAME_MIN_AXES 5` · `PRESUMED_SAME_MIN_AXES 3` · 점수축 · 운영 verdict
🟡 바뀌는 것     **문구의 범위 서술 하나** — 「후보측 전용」 → 「각 상품 자신의 사실 복구」
                🟢 코드 동작은 **이미 후자** 다(:213 원상품측 · :247 후보측 실측)
🔴 그래서 이 개정은 **동작 변경이 아니라 문서 정합화** 다 — 현행 문구가 코드보다 좁다
```

🔴 아래 개정안(§2)도 `evidence` 를 쓰지 않는다 — 기존 `brandModelCode` 칸만 쓰므로 **P2 무관** 이다.

---

## 2. 현재 데이터 흐름과 🔴 **진짜 변경 지점 — 팩토리 비대칭 한 줄**

```
원상품   canonicalProduct.description → product-identity-dna.ts:213
         extractLabeledProductCode → ProductIdentityDna → productFactsFromIdentityDna
         → ProductFacts.brandModelCode                                   🟢 복구된다
후보 A   Shopify  productFactsFromShopifyProduct(:179)
         :247 extractLabeledProductCode(description) ?? slug             🟢 복구된다
후보 B   PLAIN_HTML/목록  productFactsFromListing(:371)
         🔴🔴 **:380 `brandModelCode: null`** — :412 에서 description 을 **담기만** 하고
            라벨 품번을 **읽지 않는다**
비교     compareModelCode(x.brandModelCode, y.brandModelCode) → MODEL_CODE 축 3점/2점
         또는 품번 충돌 → CONFLICT
```

🔴🔴 **그래서 B-38 대상이 막힌 기전이 정정된다.** 「건초더미(title·url·sku)에 설명이 없다」는
`confirmBrandCodeInEvidence` 축의 사실이고, **더 근본적인 것은 후보 facts 의 품번 칸이
listing 경로에서 «항상 null» 이라는 것** 이다. ⟹ 🔴 **MODEL_CODE 축이 아예 생기지 않는다**
(PHASE 2~6 실측: 16쌍 전건 `axisPoints` 에 `MODEL_CODE` **없음**).

🟢 **변경 지점은 한 줄이고 새 기능이 아니다** — Shopify 팩토리가 이미 쓰는 **같은 owner** 를
listing 팩토리에도 세우는 것. 🔴 **구현하지 않았다**(CPO 보류 · 운영 verdict 변경).

---

## 3. 「그 상품의 공식 품번인가」 검증 조건 — 🟢 **이미 구현돼 있다**

```
① 라벨 앵커     extractLabeledProductCodes — 「Product/Article code」류 라벨 뒤의 값만 읽는다
                🟢 실측 회수 3건이 전부 이 모양이다:
                  「… 100% Organic Cotton. **Product code B226AC009** AW26 Made in Portugal.」
                  「… 12% Cotton. **Product code B226AC033** AW26 Made in Spain.」
② 복수 코드 방어 **Contract M** — 서로 다른 라벨 품번이 둘 이상이면 **null**
                ⟹ 🟢 「연관상품·다른 색상 코드가 섞인 경우」를 **구조적으로 거부** 한다
③ 가격 방어     값 바로 뒤가 통화 표시면 품번이 아니다(`상품코드 88000원`)
④ 충돌 검출     compareModelCode 가 **다르면 CONFLICT** 를 낸다
                ⟹ 🔴 이것이 기각된 레버와의 **결정적 차이** 다(아래 §4)
```

🔴 **추가로 필요한 조건은 「없다」** — 넷이 이미 있다. 🟡 단 **미검증 조건 하나**: 라벨이
**후보 페이지의 다른 상품 블록**(연관상품 섹션)에 있을 가능성. 🔴 이 분모에서 관측되지 않았고
**측정하지 않았다**(0 으로 적지 않는다).

---

## 4. 기존 계약 유지 ↔ 개정의 기술적 차이

| | 기각된 레버(2026-11-19) | 🟡 이번 개정안 |
|---|---|---|
| 수단 | `confirmBrandCodeInEvidence` 건초더미에 **설명 추가** | `productFactsFromListing` 이 **자기 라벨 품번** 복구 |
| 일치 방식 | **맨문자열** 토큰수열 일치 | **라벨 앵커** + Contract M |
| 후보 자신의 코드 | 🔴 **보지 않는다** | 🟢 그 값이 `brandModelCode` 가 된다 |
| 충돌 검출 | 🔴 **불가** — 「있다/없다」뿐 | 🟢 `compareModelCode` 가 **CONFLICT** 를 낸다 |
| 측정 결과 | 🔴 GT DIFFERENT **2건 오염** (`CODE_PRESENT_BUT_DIFFERENT`) | 🟡 **미측정** |
| Contract P2 | 무관 | 🟢 무관(`evidence` 칸 미사용 · 기존 `brandModelCode` 칸) |

🔴🔴 **기각 사유가 개정안에 그대로 적용되지 않는다** — 오염 2건의 라벨이
`CODE_PRESENT_BUT_DIFFERENT`(후보 **자신의** 코드가 **다르다**)였고, 개정안은 바로 그 값을
읽어 **CONFLICT 로 막는 쪽** 이다. 🔴 그러나 **그것이 실제로 막는지는 측정되지 않았다.**

🔴 **분모 불일치 1건 — 반드시 먼저 해소해야 한다**:
```
IDENTITY_AXIS 26  cemarose.ca · tinyapple.net 의 GT DIFFERENT 가 **열린다**(opensGtDifferent 2)
mi-reeval-03 109  같은 두 호스트의 GT DIFFERENT 쌍에 원상품 품번이 **아예 없다**
                  (cemarose 설명 32자 · tinyapple DIFFERENT 쌍 코드 없음)
⟹ 🔴 두 분모가 **같은 호스트에 대해 다른 위험을 말한다.** 합산하지 않는다.
🔴 그리고 내 직전 보고의 「오염 2건은 설명에 다른 상품 코드가 섞인 것」이라는 **정황 해석은
   이 분모에서 반증됐다** — 그 쌍에는 코드가 없다. 기전은 **여전히 미규명** 이다.
```

🟡 그리고 **라벨 앵커를 «필수» 로 하면 잃는 것이 있다**(실측) — `tinyapple.net` 의 GT SAME
2건은 품번이 **라벨 없이** 적혀 있다(「… Do Not Tumble Dry **B226AC009**」).
⟹ 🔴 「라벨 앵커만 허용」은 그 회수를 **버린다**. 라벨 앵커는 **안전하지만 recall 을 깎는다**.

---

## 5. 운영 연결 전 필요한 GT 표본 조건 (최소 검증 범위)

```
필수 ① **후보 자신의 라벨 품번이 원상품과 «다른» GT DIFFERENT 쌍** — 개정안이
       CONFLICT 로 막는지 보는 **유일한** 모양이다. 🔴 현재 분모에 **0건** 이다
     ② listing(PLAIN_HTML) 경로 후보 — 변경 지점이 그 팩토리다
     ③ 양쪽 설명 확보 + GT 라벨
     ④ 브랜드가 **채워진** 원상품(B226AC009 는 fixture 에서 brand `""` 라 복합 조합이 과소된다)
최소 규모  DIFFERENT **≥ 10**(현재 9) · 그중 ①이 **≥ 3** · SAME ≥ 10(현재 6)
          🔴 현재 분모(SAME 6 / DIFFERENT 9)로는 **표준 §3.4 7조건 ⑤(FP·FN 변화 확인)를
             충족할 수 없다**
수집      🔴 429 호스트 12곳 제외 · UA 우회 금지 ⟹ **정상 접근 가능 후보로만** 확장
```

---

## 5-B. 🟢🟢 [2026-11-20 집행] 표본 확장 + 유형 평가 — **분모 16 → 32**

🟢 산출 `preserved/mi-code-typology-eval.json` · 하니스 `mi-code-typology-eval.test.ts`
🔵 **분모를 넓힌 근거** — 유형 ①~⑦ 은 **후보 자신의 코드** 만 필요하므로 「양쪽 전문」이 아니라
**GT 라벨 ∩ 후보 설명 ∩ originCode** 가 유효 분모다(원상품 품번은 `originCode` 칸).
🔴 수집 **0** · HTTP **0** · 429 우회 **0** — 기존 fixture 원문만 썼다.

```
유효 분모 **32**(SAME 18 · DIFFERENT 13 · SIMILAR 1)   🔴 16쌍·A군 7·IDENTITY_AXIS 26 과 합산 금지
CPO 목표  DIFFERENT ≥10 → **13 🟢** · SAME ≥10 → **18 🟢** ·
         후보 자신의 라벨 품번이 «다른» 사례 ≥3 → **2 🔴 1건 부족**
```

### 유형 × GT (운영 owner 산출)

| 유형 | GT SAME | 🔴 GT DIFFERENT | SIMILAR |
|---|---|---|---|
| ① 라벨 품번 **일치** | **4** | **0** | 0 |
| ② 라벨 품번 **불일치** | 🔴 **1** | **0** | 1 |
| ③ 맨문자열 **일치** | **3** | **0** | 0 |
| ⑤ 복수 품번 | 0 | 0 | 0 |
| ⑦ 품번 없음 | 10 | **13** | 0 |

🟢🟢 **오염 0 의 기전이 드러났다** — **GT DIFFERENT 13건이 «전부» ⑦ 품번 없음** 이다.
즉 **다른 상품의 설명에는 원상품 품번이 애초에 나타나지 않는다.** 그래서 코드 일치 유형
(①+③ = **7건**)에서 **DIFFERENT 오염이 0** 이다.

🟢 **맨문자열도 이 분모에서 안전했다** — ③ 3건 전부 GT SAME · 오염 0.
⟹ 🔴 **라벨 앵커 필수화는 그 3건을 버린다**(CPO 결정 ⑤·⑥과 일치 — 라벨을 유일 조건으로 쓰지 않는다).

### 🔴🔴 개정안의 «비용» 이 측정됐다 — GT SAME 1건을 CONFLICT 로 막는다

```
junioredition.com  originCode **B226AC009** ↔ 후보 자신의 라벨 품번 **B226AB040**
                   compareModelCode → **conflict** · Human GT **SAME**
junioredition.com  originCode B226AC110 ↔ 후보 B226AC111 → conflict · GT SIMILAR  🟢 올바른 차단
```
🔵 그 1건은 **`AC`(kids) ↔ `AB`(baby) 라인 차이** 이고 헌장이 「**AC↔AB 라인 차이 = CEO 기준
동일상품**」으로 기록한 그 축이다(WU-070 · WU-112). ⟹ 🔴 **개정안을 넣으면 그 모양이
`CONFLICT` 로 바뀐다.** 🔴 **그 축을 CTO 가 열지 않는다**(품번 보호 해체 선례).

### 개정안의 순효과(이 분모 · 반사실)

```
🟢 얻는 것  ① 4건에 **MODEL_CODE 축 공급**(전부 GT SAME · 오염 0)
🔴 잃는 것  ② 중 GT SAME **1건** 이 CONFLICT 로 차단된다(AC↔AB 라인)
⚪ 무효과   ③ 3건은 라벨이 없어 **개정안으로 복구되지 않는다**(변화 0)
🔴 DIFFERENT 오염  **0/13** — 🟢 CPO 필수 안전 기준 충족
```

### 브랜드 축 실측 (복합 조합의 병목)

```
원상품 brand **공백 19/32 (59%)**        후보 브랜드 추출 실패 **10/32**
⟹ 🔴 「BRAND + MODEL_CODE」 복합의 분모가 작은 이유가 이것이다(후보 품질이 아니다)
```

### 🔴 측정불가 (0 으로 적지 않는다)

```
유형 ④ 맨문자열 «불일치»   generic 코드 모양 탐지기를 **만들지 않았다**(WU-079 금지 선례)
유형 ⑥ 연관상품 블록       fixture 에 **섹션 위치 정보가 없다** ⟹ ⑤가 대용치(이 분모에서 **0건**)
PLAIN_HTML 경로           후보 `fetchPath` 가 fixture 에 **없다** ⟹ URL 모양 대용치만 기록
목표 ③ 1건 부족           🔴 표본을 맞추려 GT 를 추정하거나 라벨을 부여하지 **않았다**
```

---

## 5-C. 🔴🔴 [2026-11-20] AC↔AB 근거 추적 + 표본 전수 — **요구 표본이 0건이다**

🔴 **방법**(재현 가능) — 읽기 전용 스캔 · 새 산출물 **0** · 수집 **0** · HTTP **0**.
대상 `fixtures/mi-reeval-01-db-human.json`(38행 · 칸 **`origin_code` · `candidate_url` ·
`human_verdict`** 🔴 snake_case) + `core-2al-human-gt.json` + `wu-112/125` + `preserved/a-identity-axis.json`.
분류식 — `origin_code` 가 `B226A(B|C|I)\d+` 이고 `candidate_url` 에 `b226a(b|c|i)\d+` 가 있을 때
**라인 문자 비교 → AC↔AB** / **같은 라인·다른 번호 → 일반 불일치** / 같으면 동일.

### ① AC↔AB 가 CONFLICT 가 되는 **정확한 경로**(model-code.ts:95~110)

```
a = B226AC009 · b = B226AB040
  a === b ?                      아니오
  a.startsWith(b) || 역방향 ?     아니오
  공통 접두 = "B226A" → **5자** ≥ PARTIAL_MATCH_MIN_LENGTH ⟹ 🔴 **return "conflict"**
```
🔴🔴 **그 분기는 `AC042 ↔ AC043` 을 가르는 바로 그 보호다**(헌장: 「공통 접두 ≥4자 뒤 분기
→ conflict」). ⟹ **AC↔AB 예외를 그 함수 안에 넣으면 일반 품번 충돌 방어와 «같은 분기» 를 건드린다.**

🔴 **「라인만 무시」로는 안전한 예외를 만들 수 없다** — 헌장 WU-070 실측:
**번호 변환 규칙이 없다**(`AC009↔AB040` 차 31 · `AC010↔AB046` 차 36). 라인과 **번호가 둘 다**
다르므로 예외는 사실상 **「숫자부를 무시」** 가 되고, 그러면 `AC042↔AC043` 도 충돌이 아니게 된다.
⟹ 🔴 **CTO 가 그 예외를 구현하지 않았다**(CPO 결정 ②를 코드로 옮기면 일반 방어가 깨진다).

### ② 표본 전수 — 🔴 **①② 모양이 0건이다**

```
AC↔AB (라인 다름)         **1** — `B226AC009 ↔ B226AB040`(bobochoses.com) GT **SAME**
                          🟢 §5-B 의 junioredition 사례와 **같은 모양이 다른 출처에서 재현**
같은 라인·다른 번호(일반)   **0**   🔴 ⟸ **일반 품번 불일치 방어를 GT 로 검증할 표본이 없다**
코드 동일                  2 (전부 GT SAME)
🔴 후보 자신의 코드 불일치 + GT **DIFFERENT**  → **0건**(전 출처)
🔴 맨문자열 불일치 + GT DIFFERENT             → **0건**(전 출처)
```

🔵🔵 **왜 0 인지 기전이 확정됐다** — §5-B 에서 **GT DIFFERENT 13건이 전부 「품번 없음」** 이었다.
다른 상품(Hugo Boss · Marc Jacobs · DG · 무브랜드)은 **Bobo 품번을 어디에도 들고 오지 않는다.**
⟹ 🔴 **품번 불일치로 인한 오염은 이 데이터에서 구조적으로 발생하지 않는다.**

🔴 그리고 `core-2al-human-gt.json` 의 GT DIFFERENT 6건은 **쓸 수 없다** — 원상품 식별자가
`SM430632`(**Smallable 판매처 SKU**)이고 제조사 품번이 아니다(판매처 SKU 오인 금지).

### ③ 작업 C — 오염·회수 (분모를 갈라 적는다)

| 측정 항목 | 결과 |
|---|---|
| 일반 품번 불일치가 GT DIFFERENT 를 **올바르게 차단** | 🔴 **측정불가 — 분모 0** |
| 일반 품번 불일치가 GT SAME 을 **잘못 차단** | 🔴 측정불가 — 분모 0 |
| AC↔AB 예외가 GT SAME 을 **보존** | 🟢 **1/1**(그 예외 없이는 `conflict` 로 막힌다) |
| AC↔AB 예외가 GT DIFFERENT 를 **잘못 허용** | 🔴 **측정불가 — AC↔AB DIFFERENT 표본 0건** |
| 라벨 품번 일치 | 🟢 SAME **4** · DIFFERENT **0** |
| 맨문자열 품번 일치 | 🟢 SAME **3** · DIFFERENT **0** |
| 브랜드 공백 영향 | 🔴 원상품 brand 공백 **19/32(59%)** ⟹ 복합 조합 분모가 구조적으로 작다 |

🔴🔴 **그래서 지금 GT 안에서는 품번 충돌 방어가 «회수만 깎는다»** — 손실 1(AC↔AB GT SAME) ·
막은 오염 **0**. 🔴 단 그 방어의 가치는 **다른 분모(WU-069/070 파생쌍)에서 측정됐다** ⟹
**이 분모의 결과로 그 방어를 약화하지 않는다**(합산 금지).

---

## 5-D. 🔵🔵🔵 [2026-11-20 정정] **CPO 정책이 코드에 «이미» 있다 — `ageLineDesignMatch`**

🔴🔴 **내 직전 보고의 「AC↔AB 안전한 예외가 없다」를 정정한다.** 예외는 **이미 구현돼 있다**
(`cross-seller.ts:1067` · blocker `MODEL_CODE_AGE_LINE` · 헌장 「관측된 차이 9」 중 하나).

```
발화 조건 **둘 다** 필요(:1050 주석 원문)
  ① modelCode === "conflict"  (= 접두 공유 후 분기 · compareModelCode **그대로**)
  ② **연령 어휘를 뺀 `coreTitleTokens` 가 완전 일치**(집합 동일 · 부분일치 ❌ · fuzzy ❌)
     🟢 연령 어휘 판단은 **기존 owner** `resolveAudienceLine` 이 한다(새 사전 0 · threshold 0)
거동   🔴 **충돌은 «언제나» 적는다** — 예외가 발화해도 `conflicts.MODEL_CODE` 를 그대로 push
      🔴 **점수를 주지 않는다** — `identifierConfirmed` 는 `exact` 만 보므로 MODEL_CODE 축 **0점**
      🟢 최종 등급은 **기존 축·blocker 가** 결정한다(자동 DIFFERENT 확정이 아니다)
보호 유지(주석 원문)  `B226AC042 ↔ B226AC043` 디자인명이 달라 **미발화** ·
      WU-143 false SAME 13건 **미발화** · 같은 디자인·다른 색상은 **COLOR 충돌이 위에서** 막는다 ·
      세트 구성 차이는 **COMPOSITION 충돌** 이 막는다 · `cemarose.ca` 는 토큰이 하나 더 많아 **미발화**
```

### CPO 정책 ↔ 현행 코드 정합성 — 🟢 **여섯 항 전부 이미 충족**

| CPO 정책 | 현행 코드 | 판정 |
|---|---|---|
| 품번 일치 = SAME 뒷받침 | `MODEL_CODE` 축 **3점**(`IDENTIFIER_AXIS_POINTS`) | 🟢 충족 |
| 일반 불일치 = **충돌로 기록** 하고 함께 판단 | `conflicts.MODEL_CODE` **항상 push** | 🟢 충족 |
| 불일치 하나로 **자동 확정 금지** | 예외 시 blocker 로 전환 · 등급은 다른 축이 결정 | 🟢 충족 |
| AC↔AB 동일상품 가능성 **보존** | `MODEL_CODE_AGE_LINE` blocker | 🟢 충족 |
| `AC042↔AC043` 보호 **유지** | 디자인명 달라 **미발화** | 🟢 충족 |
| 복수 품번 Contract M · 품번 없음 UNKNOWN | `extractLabeledProductCode` · `"unavailable"` | 🟢 충족 |

⟹ 🔴🔴 **그래서 코드 변경이 필요한 항목이 «없다».** 비대칭 사용(일치할 때만 쓰기)도 **애초에
코드에 없다** — 충돌은 언제나 기록된다.

### 🔴 그리고 내 「비용 1건」 수치를 **미확정으로 내린다**

```
§5-B 에서 「B226AC009 ↔ B226AB040 이 GT SAME 인데 conflict 로 막힌다」고 적었다.
🔴 그 측정은 `compareModelCode` 를 **직접** 불렀고 **운영 경로(cross-seller)를 거치지 않았다**
⟹ 운영에서는 `ageLineDesignMatch` 가 발화하면 **blocker 로 전환** 되고 **DIFFERENT 확정이 아니다**
🔴 발화 여부는 「연령 어휘를 뺀 핵심 상품명 완전 일치」에 달려 있고 **이 세션에서 측정하지 않았다**
⟹ 🔴 **「GT SAME 1건 손실」을 확정 비용으로 쓰지 않는다 — 미측정이다**(§5-B 표를 그렇게 읽는다)
```

### 표본 구출 시도 — 🔴 **실패(미측정 유지)**

```
`core-2al-human-gt.json` 의 bobochoses.com GT DIFFERENT 2건(`b226ab043` · `b226ab048`)을
쓰려면 원상품 `SM430632` 의 **제조사 품번** 이 필요하다.
🔴 `gt-master-origins.json` 실측 — `canonicalProduct.sku = "AAA1804532"`(**Smallable 자체 SKU**) ·
   brand `Bobo Choses` · 🔴 **B226A* 형식 품번이 없다**
⟹ 🔴 그 2건은 품번 축 검증에 **쓸 수 없다**(판매처 SKU 오인 금지) ⟹ 요구 표본 **여전히 0건**
```

---

## 5-E. 🟢🟢 [2026-11-20] **운영 판정 경로 반사실 — 오염 0 · B-38 대상이 개선됐다**

🟢 산출 `preserved/mi-operational-code-counterfactual.json` · 하니스
`mi-operational-code-counterfactual.test.ts`. 🔴 운영 변경 **0** · 수집 **0** · HTTP **0**.
🔵 두 설정의 차이는 **후보 facts 의 `brandModelCode` 한 칸** 뿐이고, 판정은 **운영
`compareCrossSellerProducts`** 가 한다(직접 호출값은 `directCompareModelCode` 로 **따로** 적었다).

### 🔴🔴 1차 측정을 «무효» 로 만든 하니스 결함 — 먼저 적는다

```
`origin.title` 이 빈 행에 폴백 「(제목 없음)」을 넣었더니 원상품 `coreTitleTokens` 가
**`["제목","없음"]`** 이 됐다 ⟹ `ageLineDesignMatch` 조건 ②(연령 어휘 뺀 토큰 **완전 일치**)가
**당연히** 실패했다. 🔴 그 값을 「운영에서도 CONFLICT 로 떨어진다」로 읽으면 **거짓 결론** 이다.
🟢 그래서 **원상품 제목이 있는 행만** 유효 분모로 삼았다 — 32 → **16** · **측정불가 16**.
```

### 결과 (분모 16 · SAME 6 · DIFFERENT 9 · SIMILAR 1 · 후보 코드 복구 4)

| GT | BASE(후보 코드 null) | FILLED(후보 라벨 품번 채움) |
|---|---|---|
| SAME 6 | PRESUMED_SAME 5 · SIMILAR 1 | 🟢 **PRESUMED_SAME 6** |
| 🔴 DIFFERENT 9 | SIMILAR 9 | 🟢 **SIMILAR 9 (완전 불변 = 오염 0)** |
| SIMILAR 1 | SIMILAR 1 | 🟡 **CONFLICT 1** |

```
바뀐 쌍 **2건**
🟢 `B226AC033 ↔ B226AC033`  GT SAME · **SIMILAR → PRESUMED_SAME**  ⟸ 🔵 **B-38 대상 페어다**
🟡 `B226AC110 ↔ B226AC111`  GT SIMILAR · SIMILAR → **CONFLICT**
   ⟹ 🟢 **같은 라인·다른 번호(일반 충돌 보호)가 올바르게 발화했다**(1건 · 방향 정확)
🟢🟢 **GT DIFFERENT 9건이 두 설정에서 한 건도 바뀌지 않았다** — 계약으로 잠갔다
   (`expect(filled.DIFFERENT).toEqual(base.DIFFERENT)` ⟹ 오염이 생기면 **FAIL 로 드러난다**)
```

### 🔴 작업 A(`ageLineDesignMatch` 발화 검증) = **측정불가**

```
유효 분모(원상품 제목 보유)에 **AC↔AB 사례가 0건** 이다 ⟹ 예외 발화를 잴 수 없다
🔴 그러므로 **§5-D 의 「운영에서는 blocker 로 전환될 수 있다」도 확정하지 않는다** —
   그 쌍(B226AC009↔B226AB040)은 **원상품 제목이 없어 측정 자체가 불가** 했다
🟢 확정된 것은 하나 — 그 예외의 **코드 경로와 조건 둘** 이고, **발화 실측은 남아 있다**
```

⟹ 🟢 **이 분모에서 개정안의 순효과** — SAME 회수 **+1**(B-38 대상) · 🟢 **오염 0/9** ·
🟡 GT SIMILAR 1건이 CONFLICT(일반 보호의 **올바른** 동작) · AC↔AB **측정불가**.

---

## 5-F. 🔵🔵🔵 [2026-11-20] **작업 A 의 답은 기존 계약에 있다 — `AGE-LINE-POLICY-01`(CPO GO)**

🔴 **새 측정이 필요하지 않았다.** `MODEL_CODE_AGE_LINE` 를 단언하는 **기존 계약이 9개** 다
(`core-2an-identity-engine` · `dif-02-identity-funnel` · `kids-identity-strategy-stabilization` ·
`mi-g-safety-shadow` · `mt-01-match-truth-price` · `pe-01a-price-eligibility` ·
`pp-01-conditional-price` · `stage7-2-price-eligibility-cf` · `-split`) ·
그리고 `core-2ag-title-strong-audience-boundary.test.ts:28` 이 **그 쌍**(`b226ab046`·`b226ab040`)을
「AB(baby) 라인 · 같은 그래픽」으로 **표본에 고정** 한다. 🟢 전부 **회귀 PASS**(932 files · 0 failed).

### 계약 원문이 적어 둔 정책(`core-2an-identity-engine.test.ts:321`)

```
🔵 **AGE-LINE-POLICY-01(CPO GO)** — 「품번 단독 충돌 + 연령어휘 제거 후 핵심 상품명 완전일치면
   **조기 반환을 건너뛴다**. 🔴 그래도 **blocker(MODEL_CODE_AGE_LINE)가 SAME 을 막고**,
   matchTruth 는 MODEL_CODE 충돌을 그대로 보아 **tier 는 EXCLUDED 유지** 다(**가격 축 미유입**).」
잠긴 발화 조건 **셋**(계약이 문자열로 고정)
  ① `ageLineDesignMatch && conflicts.length === 1 && conflicts[0].conflict === "MODEL_CODE"`
  ② `modelCode === "conflict" && sameDesignIgnoringAgeWords(x, y)`
  ③ `blocker: "MODEL_CODE_AGE_LINE"`
```

🔴🔴 **그래서 CPO 질문 1의 답이 확정된다** — AC↔AB 에서 예외가 발화하면:

```
🟢 CONFLICT **조기 반환을 건너뛴다**      ⟹ 자동 DIFFERENT 가 아니다(CPO 정책 충족)
🔴 그러나 **blocker 가 SAME 을 막는다**   ⟹ 등급은 PRESUMED_SAME 이하
🔴 그리고 **tier 는 EXCLUDED 유지**       ⟹ **가격 비교에 들어가지 않는다**
⟹ 🔴 **「AC↔AB 동일상품 가능성 보존」은 «판정 보존» 까지이고 «가격 축 진입» 이 아니다.**
   그것이 이미 **CPO GO 된 정책** 이다 — 새로 열 사안이 아니다
```

🔴 **발화 «실측» 은 여전히 내 분모에서 측정불가다**(유효 분모에 AC↔AB 0건 · 그 쌍은 **후보 제목이
어느 fixture 에도 없다** — `mi-reeval-01-db-human` 은 `origin_title` 만 있고 `candidate_title` 이 없다).
🟢 그러나 **「검증되지 않았다」는 과장이다** — 기존 계약 9건이 그 축을 잠그고 있다.

### 작업 B — 🔴 **0건 확정**(추가 수집 없음)

```
후보 **라벨** 품번 불일치 + GT DIFFERENT   **0건**
후보 **맨문자열** 품번 불일치 + GT DIFFERENT **0건**
스캔 범위  mi-reeval-03(109) · mi-reeval-01-db-human(38) · core-2al · core-2m ·
          wu-112 · wu-125 · core-same03 · preserved/a-identity-axis(26)
🔴 기전 — GT DIFFERENT 후보는 **품번을 어디에도 들고 오지 않는다**(멀티브랜드 리테일러)
🔴 429 우회 **0** · 새 수집 **0** · GT 추정·임의 라벨 **0**
```

---

## 6. CTO 권고

```
🟢 권고 1  Contract A 는 **폐지하지 않고 문구만 명확화** 한다(§1 제안문). 코드는 이미 그 의미다
🟡 권고 2  개정안(listing 팩토리의 라벨 품번 복구) = **채택 후보** · 🟢 §5-B 에서
          **DIFFERENT 오염 0/13** 확인. 🔴 **그러나 선행 셋이 남았다**:
          ⒜ 🔴🔴 **AC↔AB 라인 1건이 GT SAME 인데 CONFLICT 로 막힌다**(B226AC009 ↔ B226AB040)
             그 축은 「CEO 기준 동일상품」으로 기록돼 있다 ⟹ **CPO 정책 결정** · CTO 가 열지 않았다
          ⒝ 후보 자신의 코드가 «다른» **GT DIFFERENT 표본이 0건** — 개정안이 **진짜 오염을
             막는지** 보는 모양이 아직 없다(목표 ③ **2/3** · 1건 부족)
          ⒞ 분모 불일치(§4) 해소 — 같은 호스트가 두 분모에서 다른 위험을 말한다
🔴 권고 3  `confirmBrandCodeInEvidence` 건초더미 확장은 **계속 기각** 유지 —
          충돌을 검출할 수 없는 구조이고 이미 오염이 측정됐다
🔴 권고 4  라벨 앵커를 **필수 조건으로 고정하지 않는다** — tinyapple SAME 2건을 버린다.
          🟡 「라벨 앵커 = 강한 증거 / 맨문자열 = 약한 증거」로 **등급을 가르는** 설계가
          남아 있지만 **새 점수축** 이라 표준 개정 사안이다(CTO 가 만들지 않았다)
🔴 지금 운영 연결 **0** · 점수 반영 **0** · SAME 승격 **0**(CPO 보류 준수)
```

🟡 **CPO 결정이 필요한 항목은 둘뿐이다** — ① Contract A 문구 개정(표준 산출물)
② §5 표본 확장을 열 것인가(정상 접근 가능 후보 한정 · 429 제외).
