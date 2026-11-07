# STEP 3A-M — 수동 판독 12건 + GT 확대 계획(제안만)

> 🔴 **운영 코드 · 추출기 · matcher · Identity · alias · BRAND 정책 · GT · DB · UI 변경 0 · 재방문 0.**
> 기준 HEAD `bf30950f`. 판독자 = CTO(사람 1인). 🔴 **12건은 62건의 통계적 표본이 아니다.**

---

## 1. 행별 수동 판독

질문은 하나다 — **「이 문맥은 «이 상품의» 제조사 브랜드를 말하는가」**

| # | 판매처 | 원상품 브랜드 | 규칙 | 🧑 판독 | 일치 |
|---|---|---|---|---|---|
| 1 | miniboutique.co.kr | Bobo Choses | `MENTIONED` | 🟡 모르겠다 | 🟢 적정 |
| 2 | nickis.com | Bobo Choses | `MENTIONED` | 🟢 **예** | 🔴 **불일치** |
| 3 | nickis.com | Wynken | `MENTIONED` | 🟡 모르겠다 | 🟢 적정 |
| 4 | junioredition.com | Bobo Choses | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 5 | junioredition.com | Bobo Choses | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 6 | tiptoeboutique.com | Bobo Choses | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 7 | junioredition.com | Bobo Choses | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 8 | junioredition.com | Wynken | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 9 | junioredition.com | Wynken | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 10 | junioredition.com | Bonjour | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 11 | junioredition.com | Bonjour | `ATTRIBUTED` | 🟢 예 | 🟢 |
| 12 | junioredition.com | Main Story | `ATTRIBUTED` | 🟢 예 | 🟢 |

### 판독 근거 — 원문과 함께

**[1] 미니부띠끄 — 🟡 모르겠다 / 규칙 적정**
```
「미니부띠끄 | BOBO CHOSES의 감각적인 디자인이 돋보이는 상품입니다. … 프리미엄 수입
 아동복 큐레이션을 지금 미니부띠끄에서 경험해보세요.」
```
앞 문장만 보면 **이 상품의 귀속**으로 읽힌다. 🔴 그런데 뒤가 **상점 큐레이션 홍보** 라
「수입 아동복 큐레이션 전반」을 가리킬 여지가 있다 ⟹ `MENTIONED` 가 **보수적으로 맞다**.

**[2] nickis(독일어) — 🟢 예 / 🔴 규칙 불일치 = 과소 추출**
```
「**Dieses** Bobo Choses Tank Top aus der Iconic Collection überzeugt …」
```
`Dieses {BRAND} {제품}` 은 영어 `This {BRAND} {product}` 와 **같은 상품 귀속** 이다.
⟹ 🔴 규칙이 독일어 지시대명사를 몰라 **놓쳤다**(유일한 불일치).

**[3] nickis(Wynken) — 🟡 모르겠다 / 규칙 적정**
```
「… während die **Wynken**-Stickerei in Form einer Malpalette einen kreativen Akzent setzt」
```
**자수(Stickerei) 장식 묘사** 다. 상품이 Wynken 일 가능성은 높지만 **이 문장만으로는**
제조사 귀속이 아니다 ⟹ `MENTIONED` 가 맞다. 🟢 귀속 게이트를 끄면 이것이 `ATTRIBUTED`
가 되고 그것이 **실제 오탐** 이다(STEP 3A-R §4 가 재현했다).

**[4][5] `by Bobo Choses` — 🟢 예** · 명확한 상품 귀속.

**[6] tiptoeboutique — 🟢 예** · 제목이 「**Bobo Choses** Midnight Blue Pop Long Sleeve
Sweatshirt」로 시작한다. 🔴 단 **출처가 TITLE** 이다(설명문이 아니다).

**[7] junioredition Embossed — 🟢 예 · GT 보유(CEO `SIMILAR`)**
```
「**Bobo Choses** Embossed T-Shirt **by Bobo Choses**. Loose fit striped tee …」
```
🟢🟢 **이 1건이 중요한 것을 말한다** — 브랜드 귀속이 **맞는데** CEO 판정은 `SIMILAR` 다.
⟹ 🔴 **브랜드 귀속 정확도와 동일성 판정은 다른 축** 이라는 직접 증거다.
   「브랜드를 더 읽으면 SAME 이 늘어난다」로 연결하지 않는다.

**[8][9] `by Wynken` — 🟢 예** · 🟢 [8] 안에 `subtle tone-on-tone "wynken" embroidery` 가
**또** 있다 — **자수 언급과 귀속 문구가 같은 설명문에 공존** 한다.
⟹ 🟢 [3] 판독을 뒷받침한다: 자수 언급만으로 귀속을 정하면 안 되고, 귀속 문구가 따로 있다.

**[10][11] `by Bonjour` — 🟢 예** · `Bonjour's signature smocking` **소유격** 이 2차 확인을 준다.

**[12] `by Main Story` — 🟢 예** · 🔴 두 번째 등장은 `a large Main Story print across the chest`
= **프린트 묘사** 다([3] 과 같은 모양). 귀속 문구가 있어서 구제된다.

---

## 2. 기존 상태 ↔ 수동 판독 불일치

```
불일치 **1 / 12**  —  [2] nickis 독일어 `Dieses {BRAND}` ⟹ **과소 추출**
`ATTRIBUTED` 판독 정밀도   **9 / 9**(이 표본에서 오탐 0)
`MENTIONED` 과소 추출      **1 / 3**(나머지 2는 보수적으로 적정)
```
🔴 **9/9 를 「정밀도 100%」로 적지 않는다** — 12건은 통계적 표본이 아니고 `by {BRAND}`
   모양에 쏠려 있다(junioredition 다수).

---

## 3. 실제 오탐·과소 추출 사례

| 유형 | 건수 | 실례 |
|---|---|---|
| 🔴 과소 추출(놓침) | 1 | [2] 독일어 `Dieses Bobo Choses Tank Top` |
| 🟢 오탐(잘못 올림) | **0** | — (이 표본에서) |
| 🟡 보수적 보류(적정) | 2 | [1] 상점 큐레이션 문구 · [3] 자수 묘사 |

---

## 4. 현재 규칙으로 해결 가능 / 불가능

**🟢 해결 가능(규칙 안에서)**
- `by|from|collection` 귀속 문구 — 영어권에서 **9/9** 정확
- 자수·프린트 묘사 단독 → `MENTIONED` 로 내리는 것 — **의도대로 동작**([3])
- 한국어 조사 결합 — 10/10(STEP 3A-R)

**🔴 해결 불가능(규칙 밖)**
1. **다국어 지시대명사 귀속** — `Dieses/Diese/Dieser + {BRAND}`. 🔴 CPO **보류** 상태라 넣지 않았다.
2. **상점 큐레이션 문구 ↔ 상품 귀속 구별**([1]) — 「{BRAND}의 디자인이 돋보이는 상품입니다」가
   이 상품인지 큐레이션 전반인지 **문맥만으로 애매** 하다. 🔴 규칙으로 가를 방법을 찾지 못했다.
3. **판매처명이 브랜드 자리에 오는 오탐** — 🔴 이 코퍼스에 **사례 0** 이라 여전히 **미입증**.

---

## 5. STEP 3B 구현 시 필요한 추가 게이트 (제안 · 구현 0)

| 게이트 | 근거(관측) | 효과 | 위험 |
|---|---|---|---|
| **소유격 2차 확인** `{BRAND}'s` · `{BRAND}의` | [10][11] Bonjour's | 귀속 신뢰도 보강 | 낮음(2차 확인 전용) |
| **장식·프린트 어휘 제외** `embroidery·Stickerei·print·프린트` 뒤 브랜드 | [3][12] | 오탐 차단 | 🔴 [12] 처럼 귀속 문구가 **같이** 있으면 그쪽이 먼저 이겨야 한다 |
| 다국어 지시대명사 | [2] | 과소 추출 1건 회수 | 🔴 **CPO 보류** — 언어별로 늘어난다 |

🔴 셋 다 **구현하지 않았다.** 그리고 **첫 둘만으로는 과소 추출 [2] 를 회수하지 못한다**.

---

## 6. GT 확대 계획 (제안만 · 실행 0)

### 6-1. 현재 GT 4건의 출처와 판정 근거
```
출처   `candidate_reviews.human_verdict` — CEO 가 직접 누른 값(사람 라벨)
분포   A 62건 중 **4건**(나머지 58 측정불가) · 전체 코퍼스로는 38/190
근거   CEO 육안 판정이고 **시스템 판정과 다른 칸** 이다(STEP 1 이 그 분리를 잠갔다)
🔴 그중 판독 표본에 든 것은 **[7] 1건**(CEO `SIMILAR`)
```

### 6-2. 추가 GT 확보가 가능한 실제 데이터 범위
```
🟢 즉시 가능   A 62건 중 GT 없는 **58건** — 이미 원문·이미지·URL 이 보존돼 있다
🟢 확장 가능   step2 코퍼스 190행 중 GT 없는 152행
🔴 불가능      C15 등 C-코드 사례 — URL 매핑이 리포에 없다(특정 불가)
🟡 신규 수집   국내 후보(현재 `market='KR'` **1건**) — 분석 실행이 선행
```

### 6-3. 브랜드별 편향 완화
```
현재 A 62건 — Bobo Choses **53** · Wynken 4 · Bonjour 3 · Main Story 2
🔴 한 브랜드가 85% 다 ⟹ 🟢 **브랜드별 상한**(예: 브랜드당 최대 N건)으로 층화한다
🟢 그리고 **판매처별** 로도 층화한다 — junioredition 쏠림이 `by {BRAND}` 비율을 끌어올린다
```

### 6-4. 판정 기준 (기존 어휘 그대로 · 새 상태 0)
```
SAME       같은 상품(브랜드·품번·색상·형태가 같다)
SIMILAR    같은 계열인데 **실물 차이** 가 있다(색상·형태 등)
DIFFERENT  다른 상품
UNDECIDED  판단할 근거가 부족하다
🟢 `candidate_reviews.human_verdict` 의 CHECK 와 **같은 넷** 이다(migration 0)
```

### 6-5. 사람 검토 절차
```
① 후보 카드(이미지 + 제목 + 가격 + 원문)를 **원상품과 나란히** 보여준다
② 🔴 **시스템 판정을 먼저 보여주지 않는다**(앵커링 방지) — 누른 뒤에 공개
③ 넷 중 하나를 누른다 + (선택) 고정 사유
④ 저장은 기존 경로 그대로 — `POST /api/price-history/[id]/candidate-reviews`
🟢 UI·저장 경로가 **이미 있다**(WU-131 · 4상태 버튼 · `HUMAN_VERDICTS` 에 SIMILAR 포함)
⟹ 🔴 **새 화면이 필요 없다** — 필요한 것은 **CEO 가 누르는 시간** 이다
```

### 6-6. 기존 GT 를 바꾸지 않고 추가하는 방법
```
🟢 `candidate_reviews` 는 (snapshot_id, url) / (origin_code, url) **부분 유니크** 다
   ⟹ 새 행은 **새 (상품, URL) 조합** 으로만 들어간다(기존 행 UPDATE 0)
🔴 같은 조합을 다시 누르면 `human_verdict` 가 **덮인다** ⟹ 재판정은 **CPO 승인 사안** 으로 둔다
🔴 `system_*` 칸과 `human_verdict` 는 서로 덮지 않는다(WU-131 양방향 계약 · STEP 1 과 같은 성질)
```

### 6-7. 비용 판단 재료
```
58건 판독   후보당 약 30초~1분 가정 ⟹ **30~60분**(CEO 1인 · 1회)
152건 판독  ⟹ 약 1.5~2.5시간
🔴 이것은 **제 추정** 이고 실측이 아니다 — CEO 가 12건을 눌러 보면 실제 속도가 나온다
🟢 코드 작업 **0** — 화면과 저장이 이미 있다
```

---

## 7. CTO 권고

```
🔴 STEP 3B 를 지금 열지 않는 것이 맞다 — 이유 둘이 그대로 남았다:
   ① 판매처명 게이트 발화 사례 **0**(안전성 미입증)
   ② GT **4/62** — `ATTRIBUTED` 59 의 정확도를 말할 수 없다
🟢 가장 값싼 다음 수는 **GT 확대** 다 — **코드 0** 이고 화면이 이미 있다.
   58건을 누르면 ①의 반례도 같이 찾을 가능성이 있다(판매처명이 브랜드 자리에 오는 후보).
🔴 제가 GT 를 만들지 않았고 기존 GT 를 고치지 않았다.
```
