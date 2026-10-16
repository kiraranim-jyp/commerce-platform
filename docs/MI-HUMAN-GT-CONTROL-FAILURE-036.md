# WU-036 — 🔴 육안 GT **CONTROL 실패** 기록 (1차 수집분 무효)

> 🔴🔴 **이 문서의 요지 한 줄**: CEO 가 성실하게 50건을 판정했지만, **내 도구가
> 왼쪽 「원본 상품」을 첫 상품에서 멈춰 보여줬다.** 그래서 1차 수집분은 KPI 로 쓸 수 없다.
> 🟢 판정 자체는 **그 잘못된 기준에서는 전부 옳다.** CEO 의 작업 문제가 아니다.

---

## 1. 왜 바로 집계하지 않았나 — 헌장 §5-B

```
🔴 **CONTROL 이 실패하면 그 숫자를 전략 판단에 쓰지 않는다.**
🔴 단 실패를 곧바로 하니스 결함으로도 제품 결함으로도 단정하지 않고
   순서대로 가른다 — 호출 경로 → 설정 상태 → 입력 → Production 결과.
```

가른 결과 **입력(= 사람에게 보여준 기준 상품)** 이 틀렸다.

---

## 2. CONTROL 셋이 전부 실패했다 — 전부 «객관» 검정이다

### ① 후보가 «원상품 바로 그 페이지» 인데 DIFFERENT — **4건**

로케일/스토어만 다른 같은 상품이다.

| | 원본 | 후보 | 판정 |
|---|---|---|---|
| C09 | junioredition `/en-kr/products/curious-turnip-all-over-swim-cap…` | junioredition `/products/curious-turnip-all-over-swim-cap…` | DIFFERENT 「전혀 다름 이건 수영 모자」 |
| C12 | junioredition `/en-kr/products/lulu-t-bar-shoes…` | junioredition `/en-au/collections/shoes/products/lulu-t-bar-shoes…` | DIFFERENT 「전혀 다름 이건 신발」 |
| C17 | junioredition `/en-kr/products/bubble-sweatshirt-in-grey-melange…` | junioredition `/products/bubble-sweatshirt-in-grey-melange…` | DIFFERENT 「전혀 다름 맨투맨」 |
| C48 | bobochoses**.co.jp** `/products/b226ac117…` | bobochoses**.com** `/products/b226ac117…` | DIFFERENT 「집업」 |

### ② 「다르다」 근거가 **원상품 자신의 카테고리** 를 지목한다

```
S3 원본 = Curious Turnip All Over **Swim Cap**   → 근거 「이건 수영 모자」  5건
S4 원본 = Bubble **Sweatshirt**                  → 근거 「맨투맨」         13건
S5 원본 = Lulu T Bar **Shoes**                   → 근거 「이건 신발」        5건
S6 원본 = B.C. Embossed **tracksuit jacket**     → 근거 「집업」             6건
```

### ③ 판정이 **첫 그룹에서 완전히 갈린다**

```
S1 (첫 그룹 · n=9)   SAME 6 · DIFFERENT 2 · UNCERTAIN 1
S2~S6    (n=42)      **DIFFERENT 41 · 미판정 1 · SAME 0**
→ SAME 은 전부 S1, 비-S1 은 전부 DIFFERENT
```

🔴 **셋을 합치면 결론은 하나다** — CEO 는 51건 전부를 **S1 의 Booty Ghosts 긴팔
티셔츠** 와 비교했다. 그 기준에서 보면 「다른 프린트」·「수영 모자」·「맨투맨」·
「신발」·「집업」은 **전부 정확한 관찰** 이다.

---

## 3. 원인 — 내 도구다 (코드 위치까지)

```
설계: 왼쪽에 «sticky» 원본 패널 + IntersectionObserver 로 스크롤에 맞춰 교체
현실: artifact 는 **iframe 높이가 콘텐츠 전체** 이고 부모 문서가 스크롤한다
      → `position: sticky` 가 발동하지 않는다
      → IO 의 root 가 iframe 뷰포트라 **51장이 동시에 intersecting** 상태로 고정
      → 콜백이 「가장 위」를 고르므로 **S1 에서 영원히 멈춘다**
```

🔴 **직전 DOM 하니스가 왜 못 잡았나** — 「원본 패널이 S1 을 그린다」만 단언했다.
그래서 **패널이 멈춰 있어도 통과** 했다. 「위치만 보면 속는다」를 또 한 번 밟았다.

---

## 4. 고친 방식 — 패치가 아니라 구조 변경

```
🟢 sticky 패널과 IntersectionObserver 를 **삭제** 했다
🟢 **원본을 카드 «안에»** 좌우로 넣었다 → 어긋날 수 있는 경로가 없다
🟢 저장키 v2 — 기준이 어긋난 v1 판정을 물려받지 않는다(🔴 v1 은 지우지 않는다)
🟢 새 단언: **카드 51장 각각이 «자기» 원본 제목·URL 을 품는가** + 원본 6종이
   전부 화면에 나타나는가 + `origin-card` 가 더 이상 존재하지 않는가
```

---

## 5. 🟢 살릴 수 있는 것 — 기준이 맞았던 S1 **9건**

패널이 S1 을 보여줬으므로 S1 그룹의 판정은 **기준이 옳다.**

| | MI | Human | 근거 |
|---|---|---|---|
| C01 · C02 · C03 | SAME | **SAME** | |
| C27 | PRESUMED_SAME | **SAME** | |
| C29 | PRESUMED_SAME | **SAME** | (cissywears · baby) |
| C30 | PRESUMED_SAME | **SAME** | (billsstore · baby) |
| C28 | CONFLICT | **UNCERTAIN** | 「이미지가 잘려서 모르겠음」 |
| C31 | PRESUMED_SAME | DIFFERENT | 「컬러가 다르고, Sweatshirt」 |
| C32 | CONFLICT | DIFFERENT | 「컬러가 다르고, Sweatshirt」 |

```
🟢 **False SAME = 0**        (Human DIFFERENT 인데 MI SAME 인 건이 없다)
🟡 SAME MISS = 3             (C27·C29·C30 — **전부 PRESUMED_SAME**)
🔴 N=9 · 원상품 1개 → **일반화하지 않는다**
```

🟡 **그 9건이 낸 진짜 발견 둘**:
```
C29 · C30  prior=DIFFERENT → human=**SAME**
  둘 다 **baby 사이즈 판**(cissywears / billsstore)이고 MI blocker 는 `SIZE_SYSTEM` 이다.
  🔴 「baby 판을 같은 상품으로 볼 것인가」는 **제품 정책** 이다 — CTO 가 정하지 않는다.
```

---

## 6. 🔴 CPO 집계와의 대조 — 숫자를 그대로 쓸 수 없는 이유

CPO 가 낸 `False SAME 7 · Precision 30%` 는 1차 수집분 전체를 쓴 값이다.

```
False SAME 7건 = C04 C05 C06 (S2) · C09 (S3) · C12 (S5) · C17 (S4) · C44 (S5)
🔴🔴 **7/7 이 비-S1 이다** — 전부 §2 의 결함으로 설명된다
```

🔴 그러므로 **「MI Precision 1.0 / False SAME 0 이 깨졌다」는 결론을 지금 내리지
않는다.** 기준이 맞았던 구간(S1)에서는 **False SAME 이 여전히 0** 이다.

🔴 동시에 **「안전하다」고도 결론내지 않는다** — 비-S1 42건은 **측정불가** 다(0% 가 아니다).

---

## 7. 최종 판정

```
1차 수집분        🔴 **무효** (CONTROL 3/3 실패 · 원인 = CTO 도구)
살린 구간          🟢 S1 9건 — False SAME 0 · SAME MISS 3(전부 PRESUMED)
나머지 42건        🔴 **측정불가** — 재판정 필요
도구               🟢 구조 변경 + 마운트 DOM 전건 검증 완료
코드 변경          🟢 운영 0
──────────────────────────────────────────
**HOLD — 재수집 필요.** WU-036 을 지금 닫지 않는다.
```

🔴 **CEO Action: 재판정 1회** — 같은 주소, 고쳐진 화면. v1 판정은 불러오지 않으므로
처음부터다. 🔴 CEO 의 1차 작업은 낭비가 아니었다 — **그 데이터가 이 결함을 찾아냈다.**
