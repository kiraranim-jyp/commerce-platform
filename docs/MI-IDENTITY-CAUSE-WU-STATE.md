# MI Identity 원인 규명 WU — 후보를 열어 축으로 분해했다

> 🟢 **종료.** 판정 — **코드 수정 필요: NO** · **MVP PARTIAL 유지**.
> 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · 검색어 0 · DB 쓰기 0.
> 🔴🔴 **핵심 답: 「동일상품인데 high 미달」 사례가 «하나도 없다».** 5건 전부
> 후보가 **실제로 다른 상품** 이거나 **원상품 facts 가 비어** 축이 쌓일 수 없었다.

---

## 1. 대상 (CPO 지정 5건 · 늘리지 않았다)

```
B226AB069 Pixel Abduction jogging pants   후보 0
B226AC002 Boo Bo Choses T-shirt           후보 6 / high 0
B226AC018 All About Monsters T-shirt      후보 5 / high 0
Smallable/Bobo  All About Monsters Washed 후보 10 / high 0
Smallable/L.Misha Astrid Organic Jacket   후보 17 / high 0
```
검색 샵 **7곳**: CHOCO.EL · LOOXLOO · RULII · 스카이스포츠 · 포레포레 · DEUXBEBE · LITTLE LUNA

---

## 2. 🔴🔴 가장 중요한 발견 — `matchLevel` 이 **전건 `low`** 다

```
B226AC002   low 6      B226AC018   low 5
Smallable/Bobo low 10  Smallable/L.Misha low 17
→ 🔴 `medium` 도 **하나도 없다.** 「high 문턱에 걸렸다」가 아니라
   **「점수가 거의 0 이다」** 다. 문제의 성질이 다르다.
confidence 실측  0 · 0.02 · 0.3 · 0.43 · 0.51
```

🔴 **threshold 를 낮춰도 해결되지 않는다** — `low` → `high` 는 한 칸이 아니다.

## 3. 🔴🔴 그리고 `axes` 가 **전건 비어 있다**

```
모든 후보: verdict=null · identifierConfirmed=null · axes=[] · conflicts=[] · blockers=[]
```
🟢 `withConfidence`(match.ts:476)는 `query.facts && candidateFacts` 일 때만
`compareCrossSellerProducts` 를 부른다. 🔴 **`match` 가 아예 만들어지지 않았다** —
즉 **Cross-Seller 판정 단계에 도달조차 못 했다.** 남는 `matchReasons` 는
`scoreCandidateMatch` 의 산출이고 **다른 함수**다.

---

## 4. 🔴🔴 원인 — 원상품 `facts` 가 비어 있다 (실측)

```
                brand           brandModelCode   color   material  titleTokens
AB069           "AW26"          B226AB069        null    null      null
AC002           "AW26"          B226AC002        null    null      null
AC018           "AW26"          B226AC018        null    null      null
Smallable/Bobo  "Bobo Choses"   null             null    null      null
Smallable/L.M.  "Louise Misha"  null             null    null      null
```

🔴 **셋이 동시에 틀려 있다**:

```
① color 가 **전건 null** 이다 — 🔴 원상품에는 색상이 «있다»
   (Heather grey · Midnight blue · Blue · Cream)
   → productFactsFromIdentityDna 가 그 값을 facts 로 옮기지 못한다
② titleTokens 가 **전건 null** 이다 → 제목 겹침 축이 작동할 수 없다
③ brand 가 Bobo 공식 3건에서 **"AW26"** 이다 — 🔴 브랜드가 아니다(시즌 코드).
   후보의 brand 는 "BOBO CHOSES" → matchReasons 에 **「브랜드 불일치」** 가 찍힌다
```

🟢 ①②는 선행 메모 `mi-p0-02-whitelist-works-chain-breaks-at-identity`
(「ProductIdentity 를 채우는 운영 경로가 없다」)와 **정합한다.**
🟢 ③은 선행 WU 가 센 `AW26` 브랜드 오염(40건)의 **구체적 피해 증거** 다.

---

## 5. 🔴 후보를 실제로 열어 본 결과 — **정말 다른 상품이다**

| 원상품 | 최상위 후보 | 같은 상품인가 |
|---|---|---|
| `B226AC002` Boo Bo Choses **T-shirt** | 보보쇼즈 Booo보쇼즈택**데님셔츠** (76A7D-320-01) | 🔴 **아니다** — 데님셔츠 |
| | 보보쇼즈 **쁘띠북**AW26 (76A7D-CIC-01) | 🔴 아니다 — 책 |
| `B226AC018` All About Monsters **T-shirt** | 보보쇼즈 쁘띠북AW26 · **컬러링북**AW26 | 🔴 아니다 — 책 |
| | **BLUEDOG레깅스** (46119-416-04) | 🔴 아니다 — 다른 브랜드 |
| Smallable/Bobo **Washed T-shirt** | 보보쇼즈BS고BOBO**트랙수트팬츠** | 🔴 아니다 — 바지 |
| | 보보쇼즈 베이비 고BOBO**데님윈터캡** · **롱퍼프숏양말** | 🔴 아니다 — 모자/양말 |
| Smallable/L.Misha **Astrid Jacket Cream** | SS26 루이스미샤 Astrid 자켓 **Cream Floral Haven** | 🟡 **같은 모델 · 다른 프린트/시즌** |
| | SS25 루이스미샤 자켓 Astrid **Cream Rosa Festa** | 🟡 같은 모델 · 다른 프린트/시즌 |

🟢 **즉 현재 시스템이 `low` 를 준 것은 «옳다».** 데님셔츠·책·양말·레깅스를
T-shirt 와 같은 상품으로 올리지 않았다. 🟢 **Precision 이 지켜졌다.**

🟡 Astrid 자켓만 **같은 모델명** 이다 — 🔴 그러나 `Cream Floral Haven`(SS26) ·
`Cream Rosa Festa`(SS25) 는 원상품 `Astrid … | Cream` 과 **프린트·시즌이 다르다.**
🔴 동일상품으로 올리면 **오탐** 이다. 🟢 `low` 가 맞다.

---

## 6. B226AB069 후보 0 — 🟢 원인 규명

```
검색어  ['B226AB069', 'AW26 pixel abduction all over jogging pants Trousers', …]
샵별    7곳 **전부 0** · 오류샵 **0**(전부 정상 응답)
```
🟢 **같은 브랜드 AC002/AC018 은 LOOXLOO 에서 후보가 나왔다.** 즉 검색 경로·검색어
형태 문제가 **아니다**(셋 다 품번 단독 + 제목 조합으로 같은 형태였다).
→ 🔴 **LOOXLOO 카탈로그에 그 상품군(jogging pants)이 없거나 다른 이름으로 있다.**
🔴 「검색 실패」가 아니라 **샵 카탈로그 부재** 쪽 증거가 강하다 — 단 카탈로그를
전수로 세지 않았으므로 **단정하지 않는다**(측정불가).

🔴 **검색어를 바꿔 성공시키지 않았다**(CPO §4 금지).

---

## 7. 원인 분류 (CPO §3 형식)

| 분류 | 건수 | 근거 |
|---|---:|---|
| **A. 실제 다른 상품** | **3** | AC002 · AC018 · Smallable/Bobo — 후보가 데님셔츠·책·양말·레깅스·바지다 |
| **A-2. 같은 모델 · 다른 프린트/시즌** | **1** | Smallable/L.Misha — 오탐으로 올리면 안 된다 |
| **B. 정보 부족**(동반 원인) | **5(전건)** | `color` null · `titleTokens` null · brand 가 `AW26` |
| **C. 검색 후보 품질** | **1** | AB069 — 후보 0(샵 카탈로그 부재 추정 · 🔴 미확정) |
| **D. Identity scoring 문제** | **0** | 🟢 「동일상품인데 high 미달」 사례 **없음** |
| **E. 데이터 수집 문제** | **5(전건)** | 🔴 facts 전이 실패(①②) + 브랜드 오염(③) |
| F. 기타 | 0 | |

🔴 **합계를 내지 않는다** — B/E 는 A·C 와 동반한다(상호배타가 아니다).

---

## 8. 판정

### 코드 수정 필요 여부 — **NO**

```
🟢 CPO 가 정한 기준: 「사람이 보면 동일상품인데 MI 만 high 미달」이면 로직 결함.
🔴 그런 사례가 **0건** 이다. 5건 모두 —
   · 후보가 실제로 다른 상품(3) 또는 다른 프린트/시즌(1)
   · 또는 후보 자체가 없다(1)
→ 🟢 **현재 Identity 는 정상 동작이다.** threshold·scoring 을 건드릴 근거가 없다.
```

### MVP 판단 영향 — **기존 PARTIAL 유지**

```
🟢 Identity 가 틀린 것이 아니라는 증거가 확보됐다 → MVP 평가가 «나빠지지» 않는다
🔴 그러나 GO 는 여전히 0/9 다. 끊기는 자리는 **후보 확보** 이고 이 WU 가 더 좁혔다 —
   LOOXLOO 가 거의 유일하게 후보를 내고(6/5/10/14) 포레포레가 3,
   나머지 5샵은 **전건 0** 이다
```

### 🔴 이 WU 가 새로 드러낸 것 — **별 과제 후보 셋** (이번에 고치지 않았다)

```
① 🔴 productFactsFromIdentityDna 가 color 를 **옮기지 못한다**(전건 null).
   원상품에 색상이 있는데 facts 에 안 들어간다 → 색상 축이 영구히 죽어 있다.
   🔴 단 그 함수를 고치는 것은 Identity 입력 변경이고 CPO 승인 영역이다
② 🔴 titleTokens 전건 null → 제목 겹침 축도 죽어 있다
③ 🔴 AW26 브랜드 오염이 **실제 피해를 만든다** — 「브랜드 불일치」가 찍힌다
   (선행 WU 가 40건으로 센 것의 구체 증거)
🟢 ①②가 살아나면 compareCrossSellerProducts 가 **처음으로 호출된다.**
   지금은 match 가 null 이라 Cross-Seller 판정이 아예 돌지 않는다.
```

---

## 9. Known Unknowns

```
🔴 AB069 후보 0 이 「샵 카탈로그 부재」인지 「검색 실패」인지 **미확정**
   (LOOXLOO 카탈로그를 전수로 세지 않았다)
🔴 color/titleTokens 가 null 인 «이유» 미조사 — 추출 실패인지 전이 실패인지
🔴 sample N=5. 🔴 후보를 낸 샵이 LOOXLOO·포레포레 둘뿐이다. 일반화 금지
🔴 이미지 축은 이 경로에서 계산되지 않아(호출부가 미리 넣어 준다) 미측정
🔴 후보 전체(38개)를 열지 않았다 — 상위 3개씩만 사람이 읽었다
🔴 「다른 프린트/시즌」 판정은 CTO 의 제목 판독이다. CEO/CPO 확인은 받지 않았다
```
