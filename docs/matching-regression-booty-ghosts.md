# MATCHING-REGRESSION · Booty Ghosts ↔ Bobo 샘플 라인 SAME 오탐

**등록일** 2026-09-14 · **등록자** CTO · **지시** CEO(MATCHING-3.2 STEP 6)
**상태** 🔴 미해결 — **원인 분리까지만 했다. 이번 작업에서 고치지 않았다.**
**전제 커밋** `872defc`(MONTH 파싱) 적용 상태에서 라이브 재현했다.
**2026-09-14 재확인(MATCHING-3.2-B)** 연령 라인 분리 이후에도 **세 쌍 전부 판정이
그대로다**(`SAME`, core 5, 보류 없음 — 전수 카탈로그로 재측정). 원본 Booty Ghosts 의
태그는 연령 낱말이 아니라 사이즈 목록(`2-years` … `13-years`)이라 라인이 읽히지
않고, 한쪽이 모름이면 `AUDIENCE_LINE` 보류는 발화하지 않는다. 이 문서 §6 의
"AUDIENCE 축 세분화로 이 건을 막으려는 시도 금지" 가 실측으로 다시 확인된 셈이다 —
이 건은 여전히 `MODEL_CODE +2`(`26AC0`) 문제이고, 별건으로 남는다.

> CEO 지시 원문: *"이번 AUDIENCE 조사에 묻히지 않게 별도 Regression case로 등록하라.
> 축별 분해만 한다. 이번 작업에서 자동 수정하지 마라. 원인 분리까지만."*

---

## 1. 사례 — 라이브 재현 (2026-09-14, bobochoses.com 4,015건 전수)

```
원본(등록상품)  junioredition.com  Booty Ghosts Long Sleeve T-Shirt by Bobo Choses
                brandModelCode  B226AC010
                사이즈          2-3 / 4-5 / 6-7 / 8-9 / 10-11 / 12-13 Years
                categoryText    "T Shirt"        colorText  "Heather Grey"

거짓 SAME 3건 (bobochoses.com)
  sb126ac001  Rapid Radish long sleeve T-shirt          SB126AC001
  sb126ac002  Bobo Choses stripes long sleeve T-shirt   SB126AC002
  sb126ac003  Summer Story long sleeve T-shirt          SB126AC003
```

세 상대는 전부 **Bobo 공식몰의 샘플(sample) 진열**이다. 태그가
`["children","Kid","samples","samples-20251202","ss26","t-shirt"]`이고,
**사이즈 옵션이 하나도 없으며**, 설명문이 없어 색상·소재·핏도 전부 null이다.
상품명도 서로 다르다 — Booty Ghosts / Rapid Radish / Bobo Choses stripes /
Summer Story 는 네 개의 다른 그래픽이다.

## 2. 축별 분해 — 5점이 정확히 어디서 왔나

세 쌍이 완전히 같은 모양이다(실측 출력 그대로):

| 축 | 점수 | 판정기가 적은 근거 |
|---|---|---|
| TITLE | **+1** | `핵심 상품명 일부 long/sleeve` |
| MODEL_CODE | **+2** | `모델코드 부분 일치 SB126AC001 / B226AC010` |
| CATEGORY | **+1** | `상품군 shirt` |
| AUDIENCE | **+1** | `대상 KIDS` |
| COLOR | — | 상대 색상 없음 → 근거 없음 |
| MATERIAL | — | 상대 설명문 없음 → 근거 없음 |
| FIT | — | 상대 설명문 없음 → 근거 없음 |
| SIZE | — | **상대 사이즈 없음 → 근거도 반증도 없음** |
| **core 합계** | **5** | `SAME_MIN_AXES`(5)에 **정확히** 닿는다 |

```
conflicts  없음        blockers  없음        brandOk  true
→ verdict = SAME
```

**보류가 하나도 걸리지 않는다.** 사이즈가 아예 없으므로 `SIZE_SYSTEM`이 발화할
자리가 없고(430632를 막은 것이 바로 그 보류다), 제목이 양쪽 다 `shirt`를 말하므로
`GARMENT_FORM`도 발화하지 않는다(430701을 막은 것이 그 보류다).

## 3. 왜 core 5 이상이 되는가 — **MODEL_CODE +2 가 결정적이다**

```
normalize("B226AC010")   B226AC010
normalize("SB126AC001")  SB126AC001

앞자리 공통 접두사 길이 = 0        ("B" vs "S")  → "같은 체계, 다른 상품" 규칙에 안 걸린다
최장 공통 부분문자열   = "26AC0"  (5자 ≥ PARTIAL_MATCH_MIN_LENGTH 4)
→ compareModelCode = "partial"  →  MODEL_CODE +2
```

겹친 다섯 글자 `26AC0`는 상품을 가리키는 말이 아니라 **Bobo 품번 체계의 뼈대**다
(`B` + 시즌 2자리 + 라인 2자리 + 일련번호). 샘플 진열은 그 앞에 `S` 하나를
붙일 뿐이라(`SB126ACxxx`), 접두사 규칙을 피하면서 LCS는 5자를 확보한다.
**즉 Bobo의 모든 아동 샘플 상품이 Bobo의 모든 아동 정품과 partial로 맞는다.**

`brandModelCode`가 `SB…`로 시작하는 bobochoses 상품은 **520건**이다(실측).

각 축을 하나씩 빼 보면 무엇이 결정적인지 산술로 드러난다:

```
MODEL_CODE +2 를 빼면   core 3  →  SAME 아님   ← 이것만이 단독으로 판정을 뒤집는다
AUDIENCE   +1 을 빼면   core 4  →  SAME 아님
CATEGORY   +1 을 빼면   core 4  →  SAME 아님
TITLE      +1 을 빼면   core 4  →  SAME 아님
```

네 축 어느 하나만 빠져도 5에 못 닿는다는 것이 이 쌍의 성질이다(430632는 반대로
6점이라 한 점을 빼도 통과했다). 다만 **MODEL_CODE +2 는 혼자서 두 점이고, 그
두 점의 근거가 실제 사실이 아니다** — 나머지 세 축(제목 일부·상품군·대상)은
적어도 "둘 다 아동용 긴팔 셔츠"라는 참인 사실을 말하고 있다.

### 규모 (bobochoses.com × junioredition.com 전수, 1,108,140쌍)

```
cross-domain SAME                               918건
  그중 bobochoses 샘플 라인이 낀 것              796건 (86.7%)
  그중 MODEL_CODE +2 를 가진 것                  736건
  그 +2 를 빼면 SAME 이 아니게 되는 것           736건 (100%)
```

Booty Ghosts 3건은 이 736건의 대표 사례이지 특수 사례가 아니다.

## 4. 430632 / 430701 과 기전이 **다르다**

| | 430701 ↔ B226AC049 | 430632 ↔ 아기옷 5건 | **Booty Ghosts ↔ 샘플 3건** |
|---|---|---|---|
| 원본 판매처 | smallable.com | smallable.com | junioredition.com |
| 원본 `brandModelCode` | **null** | **null** | **B226AC010 (있다)** |
| MODEL_CODE 축 | 없음(0점) | 없음(0점) | **+2 (있다)** |
| 상대의 사이즈 | 있다(연령형) | 있다(개월형) | **아예 없다** |
| 상대의 색상/소재/핏 | 있다(공유 설명문) | 있다(공유 설명문) | **전부 없다** |
| 점수를 사 준 것 | 라인 공통 축 5개 + 필러 토큰 `zipped` | 라인 공통 축 5개 + 필러 토큰 `all` | **품번 체계 조각 `26AC0`** |
| 해결 | `GARMENT_FORM` 보류 | `SIZE_SYSTEM` 보류(MONTH 추가) | ❌ 두 보류 모두 원리상 발화 못 함 |

앞의 두 건은 **"정보가 많은데 그 정보가 상품을 구별하지 못한다"** 였다.
이 건은 **"정보가 거의 없는데 없다는 사실이 감점이 되지 않는다"** 이고, 그
빈자리를 품번 부분 일치 2점이 채운다. 같은 해결책을 옮겨 붙일 수 없다.

## 5. 조사 방향 (확정 아님 — 실측으로 검증할 것)

1. **`compareModelCode`의 LCS 규칙.** 브랜드 품번 체계의 공통 뼈대(`26AC0`)와
   상품을 가리키는 숫자 코어(`1195`, PèPè 골든 쌍)를 LCS 길이만으로는 가르지
   못한다. 카탈로그 전수에서 "우연한 LCS≥4"가 몇 %인지 먼저 세라.
   **PèPè `01195-VERNICE-NERO` ↔ `PP24KASHE1195NER` partial 은 회귀 대상이다.**
2. **`S` 접두 샘플 코드.** `SB126AC001` 은 `B126AC001` 에 `S` 가 붙은 모양이다.
   접두사 규칙이 첫 글자 하나 때문에 무력화되는 것이 일반 현상인지 확인할 것.
3. **증거가 없는 쪽에 대한 정책.** 색상·소재·핏·사이즈가 **전부 null** 인 상대와
   SAME 을 선언해도 되는가. §8의 CEO 정책("증거가 부족하면 SAME 이 아니라
   PRESUMED 가 기본값")과 현 동작이 어긋나는 자리다.
4. **판매처가 샘플이라고 적은 것.** bobochoses.com 4,015건 중 3,287건이 `samples`
   계열 태그를 달고 있고, 그중 520건은 사이즈가 없다. 이것을 "상품"으로 볼지
   자체가 판단 대상이다.

## 6. 하지 말 것

```
❌ AUDIENCE 축을 세분화해서 이 건을 막으려는 시도
   — 세 쌍 모두 양쪽이 실제로 아동용이다. AUDIENCE 는 참을 말하고 있다.
❌ SAME_MIN_AXES 조정
   5→6 으로 올리면 **정답 쌍이 함께 죽는다**(실측). 원본 16건 SAME 19건 중 core 5 는
   4건이고, 그중 하나는 정답이다:
     Curious Turnip All Over Swim Cap (junioredition, B126AI018)
       ↔ bobochoses `sb126ai018` "SB126AI018 Curious Turnip all over swim cap"
       core 5 = TITLE+2, MODEL_CODE+3      ← 같은 상품이다
   같은 core 5 자리에 정답과 오답이 함께 있으므로 숫자로는 가를 수 없다.
❌ GARMENT_FORM / 어휘 목록 확대로 우회
❌ "샘플은 검색어에 안 걸리게 한다" 로 종료  — 검색이 가린 것은 해결이 아니다
❌ sb126ac001 / B226AC010 개별 하드코딩
```

## 7. 완료 조건

1. `Booty Ghosts ↔ sb126ac001 / sb126ac002 / sb126ac003` 이 SAME이 **아니다** — 라이브 확인.
2. PèPè 골든 쌍(`01195-VERNICE-NERO` ↔ `PP24KASHE1195NER`)이 여전히 `partial` →
   `STRONG_IDENTIFIER` 다.
3. `B126AI018 ↔ B126AI01831152`(접미사형 부분 일치)가 여전히 `partial` 이다.
4. `B226AC042 ↔ B226AC043`(접두사 공유 후 분기)이 여전히 `conflict` 다.
5. 전수 전이표(bobochoses × junioredition 1,108,140쌍)에서 **그 외 → SAME 이 0건**.
6. 실제 응답 픽스처로 회귀 고정. 손으로 쓴 fixture 는 증거로 불인정.
