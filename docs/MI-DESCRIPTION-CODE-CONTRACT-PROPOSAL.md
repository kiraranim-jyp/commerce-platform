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
