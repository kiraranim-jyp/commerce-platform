# WU-048 FINAL — Baby/Kids 품번 체계 충돌 + SAME_PRODUCT 정책 전수검증

> 🔴 **최종 판정: HOLD — 현재 정책 유지가 가장 안전하다.**
> 운영 코드 변경 **0** · 배포 **없음** · 작업트리 clean(측정 하니스 1개만 추가) ·
> AI 0 · 외부 API 0 · HTTP 0(캐시) · 비용 ₩0.
> 기준선 **SAME 13 / False SAME 1 / MISS 15** — **바꾸지 않았다.**

---

## 1. 문제 정의

C29·C33·C34 는 「같은 디자인인데 품번이 `B226A`**C**`***`(kids) ↔ `B226A`**B**`***`(baby)
로 갈리는」 쌍이고 Human GT 는 **SAME** 이다. 현재 MI 는 `MODEL_CODE` 충돌로 막는다.
**그 정책을 바꿔야 하는가** 를 변경 «전» 에 전수 측정한다.

---

## 2. 전체 데이터 범위

```
Human GT 51건 전수 · 원상품 6 · 캐시된 실제 페이지 51 · HTTP 0
품번 원천 셋을 전부 봤다 — ① 추출된 facts ② **og:image 파일명** ③ 페이지 본문
```

---

## 3. C29/C33/C34 원인 — **축 부족이 아니라 품번 충돌이다**

```
C29  B226AC010 ↔ **B226AB046**   CONFLICT 아님(blockers=[]) · 축 3   Human SAME
C33  B226AC009 ↔ **B226AB040**   **CONFLICT**(MODEL_CODE) · 축 0     Human SAME
C34  B226AC009 ↔ **B226AB040**   (후보 자신 품번을 넣으면 C33 과 같아진다) Human SAME
```
🔴 WU-046 의 「원천 부재」, WU-047 의 「증거 충돌」을 거쳐 **최종 성질은 하나** 다 —
**baby 라인 품번이 kids 라인 품번과 다르다.**

---

## 4. `AB` ↔ `AC` 품번 체계 실측 — 🔴 **라인 변환 규칙이 «아니다»**

```
B226AC010 Booty Ghosts 긴팔 T (kids)   ↔ B226AB046 Booty Ghosts baby T
B226AC009 Hug Hairy Monster T (kids)   ↔ B226AB040 Hug Hairy Monster baby T
🔴 일련번호가 대응하지 않는다 — 010↔046 · 009↔040. **계산으로 유도할 수 없다.**
```

### 🔴🔴 그리고 `AB` 가 SAME 을 예측하지 못한다 — 반례가 있다

```
C31  B226AC010 ↔ **B226AB129**   Human **DIFFERENT**   (baby **sweatshirt**)
C39  B126AI018 ↔ **B126AC130**   Human **DIFFERENT**   (swim cap ↔ swim T)
```
🔴 즉 「라인 글자만 다르면 같은 상품」은 **거짓** 이다. 같은 `AB` 라인 안에
**다른 상품**(C31)이 있고, 라인 글자 차이가 **다른 품목**(C39)이기도 하다.

🟢 **다섯 경우를 섞지 않았다**(CPO ①):
```
같은 모델 + 사이즈 체계만 다름   → WU-045 가 이미 비차단으로 처리(SAME 가능)
같은 디자인 + baby/kids 품번 차이 → 이 WU 의 대상
같은 모델 + 다른 색상            → `COLOR`/`COLOR_VARIANT` 가 막는다(WU-044)
같은 모델 + 다른 구성/set        → `COMPOSITION` 이 막는다
실제 다른 모델                   → `MODEL_CODE` 충돌
```

---

## 5. 정책 A / B counterfactual (전수 51)

🔴 정책 B 를 **「양쪽 품번을 비운다」**(= 충돌도 축도 없앤다)로 가장 충실하게 흉내냈다.
「원상품 품번을 후보에 복사」하면 **축까지 얹어 과대평가** 가 된다.

| 정책 | SAME | **False SAME** | MISS | Precision |
|---|---:|---:|---:|---:|
| **A 현재** | 12 | **1** | 16 | 0.917 |
| A + 후보 자신 품번 반영 | 12 | 1 | 16 | 0.917 |
| **B1 라인 글자만 다르면 무시** | **12** | 1 | 16 | 0.917 |
| **B2 B1 + 상품형태 일치** | **12** | 1 | 16 | 0.917 |
| **B3 B2 + 제목 축** | **12** | 1 | 16 | 0.917 |
| B4 시즌 접두사만 공유해도 무시 | **7** 🔴 | 0 | 20 | 1.000 |

🔴 하니스가 `compareCrossSellerProducts` 를 **직접** 부르므로 `withConfidence` 의
WU-037 브랜드 확인이 빠져 `A 현재`가 12 다(운영은 13). **델타만** 읽는다.

### 🔴🔴 B1~B3 은 **한 건도 회수하지 못한다**

```
C29  CONFLICT → **PRESUMED_SAME**   Human SAME  🔴 SAME 아님
C33  CONFLICT → **PRESUMED_SAME**   Human SAME  🔴 SAME 아님
C34  CONFLICT → **PRESUMED_SAME**   Human SAME  🔴 SAME 아님
C39  CONFLICT → **PRESUMED_SAME**   Human **DIFFERENT**  🔴🔴 **보호 약화**
```
🔴 품번 충돌을 없애도 **축이 모자라서**(C29 축 3 · C33 축 0) SAME 에 못 닿는다.
🔴 그런데 **반대 방향(C39)에서는 보호가 실제로 약해진다.**

🔴 B4 는 **SAME 을 5건 잃는다** — 품번이 «정확히 같은» 쌍에서도 축을 없애기 때문이다.

---

## 6. False SAME 영향

```
B1~B3   False SAME **1 → 1** (증가 없음) 🟢
        🔴 그러나 C39 가 CONFLICT → PRESUMED_SAME 으로 내려와 **한 칸 가까워진다**
B4      False SAME 0 — 🔴 단 SAME 을 5건 잃은 대가다
보호 유지 C19·C20·C25 변화 없음 · C06 변화 없음 · B226AC042↔AC043 규칙 **무변경**
```

---

## 7. 가격 비교 안전성 — 🔴 **회수해도 가격이 없다**

```
C29  price **없음**   sizes ["3m","6m","9m"]
C33  price **없음**   sizes ["6 Months","12 Months","18 Months"]
C34  price **없음**   sizes ["3m","6m","9m"]
```
🔴🔴 **세 건 모두 가격 증거가 없다.** 설령 SAME 으로 올려도 **가격비교에
한 원도 들어가지 않는다** — 회수의 사업적 가치가 **0** 이다.
🟢 그리고 baby 가격이 kids 가격 축에 섞이는 위험을 지금 떠안을 이유가 없다.

---

## 8. 최적안 — **현재 정책 유지(A)**

```
B1~B3   회수 **0** · 보호 **약화 1**  → 채택 불가
B4      회수 -5             → 채택 불가
A       현재 동작            → **유지**
```

### ⑤ 새 축이 필요한가 — 🔴 **아니다**

```
🟢 기존 축이 이미 가른다:
   C31(baby sweatshirt · Human DIFFERENT) → **GARMENT_FORM** 이 막는다
   baby↔kids 연령 라인이 읽히면         → **AUDIENCE_LINE** 이 막는다(WU-045 확인)
   사이즈 체계만 다르면                  → WU-045 가 이미 비차단
🔴 `BABY_KIDS_MODEL_FAMILY` 같은 새 축을 만들 근거가 없다 —
   막는 것이 축이 아니라 **축 부족** 이기 때문이다(§5).
```

---

## 9. 구현 내용 — **없다**

운영 파일 변경 **0**. 추가한 것은 **게이트된 측정 하니스 1개**
(`wu-048-model-family-cf.test.ts` · `WU_048_CF=1` 없이는 skip).

## 10. E2E
전수 51건 · 운영 `compareCrossSellerProducts` · 정책 6종 비교(§5).

## 11. Mutation
🔴 **해당 없음** — 운영 코드를 바꾸지 않았다. 변이를 걸 대상이 없다.

## 12. Regression / Typecheck / Build
```
admin **556 files / 8,136 passed · failed 0** · typecheck **0**
🔴 build 는 돌리지 않았다 — 운영 코드 변경 0 이므로 직전 build(exit 0)가 유효하다.
```

## 13. Production 상태
```
배포 **없음**. 현재 Production 은 WU-045(`7607fb4b`) 그대로다.
```

## 14. 기준선 → After KPI
```
SAME **13** / False SAME **1** / MISS **15**  →  **변화 없음**
```

## 15. **HOLD**

> CPO: 「결과가 “현재 정책 유지가 가장 안전하다”라면 그것이 최종 결론입니다.」
> → **그 결론이다.**

```
GO 조건 대조
  C29/C34 회수            🔴 **불가** — 품번 충돌을 없애도 축이 모자라 PRESUMED_SAME 에 머문다
  False SAME 증가 0        🟢 충족
  색상 variant 보호 유지    🟢 `compareModelCode` 무변경 → B226AC042↔AC043 그대로
  가격 비교 오염 없음       🟢 — 🔴 애초에 **가격이 없어 회수 가치가 0**
  기존 계약 유지           🟢 변경 0
→ 첫 조건이 깨지므로 GO 아님. 그리고 **깨뜨릴 이유도 없다.**
```

## 16. CEO Action
**NONE.**

## 17. 다음 병목

🔴 이 WU 가 확정한 것 — **C29/C33/C34 는 「정책을 바꿔서」 회수되지 않는다.**
품번을 풀어도 **축이 모자라고**, 그 축의 원천(색상·소재·품번)이 **후보 페이지에 없다**
(WU-046 실측). 그리고 **가격도 없다**(§7).

```
→ 그러므로 MISS 15 중 이 셋은 **구조적으로 닫힌 건** 으로 두는 것이 맞다.
→ 다음 병목은 identity 가 아니다. WU-038~039 가 남긴
   「**해외 동일상품 가격을 화면에 보여줄 것인가**」(MI 는 이미 계산하고 UI 소비자가 0)
   가 실제 제품 가치에 더 가깝다. 🔴 그것은 제품 정책 결정이다.
```
