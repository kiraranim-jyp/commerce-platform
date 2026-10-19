# WU-124 — 오판 3건의 증거 구조 (측정 · 구현 0 · 가격 0)

> 🔴 CPO 2026-10-20: 「새 축을 무작정 추가하지 않는다. **3건의 오판 원인을 기존 MI 증거
> 구조 «안에서»** 조사한다. 가격 · Registry · 1-hop · 외부 검색 확대 ❌」

---

# [WU-124 완료 보고]

## 1. 🔴🔴 **세 오판은 «같은 문제가 아니다»** — 둘은 시스템이 이미 이유를 적었다

| | human | 시스템 | blockers(기존 축) | 성질 |
|---|---|---|---|---|
| **c4** | DIFFERENT | **PRESUMED_SAME**(보류) | `NO_TITLE_OVERLAP` · **`MATERIAL`** | 🟢 **보류 신호 있었다** |
| **c7** | DIFFERENT | **PRESUMED_SAME**(보류) | `NO_TITLE_OVERLAP` · **`GARMENT_FORM`** | 🟢 **보류 신호 있었다** |
| 🔴 **c2** | DIFFERENT | 🔴 **SAME** | 🔴 **없음(0)** | 🔴 **못 막았다** |

```
🟢 c7 은 이유까지 정확히 적었다 — 「보류: 옷의 형태 **SHIRT ↔ SWEATSHIRT**」
🟢 c4 도 그랬다 — 「보류: 핵심 상품명에 겹치는 말이 없다」 + 「소재 organic cotton:100 ↔ cotton:100」
⟹ 🔴🔴 **c4·c7 은 「MI 가 동일상품이라고 했다」가 아니다.** MI 는 **보류(PRESUMED_SAME)** 로 내렸다.
   🔴 문제는 그 다음이다 — **`PRESUMED_SAME` 이 가격 집계에 들어간다**(tier `COMPARISON`).
   🟢 WU-112 에서 eraldo(PRESUMED_SAME)가 **COMPARISON 으로 금액에 들어간** 그 모양이다.
```

## 2. 🔴🔴 c2 가 **진짜 결함** 이다 — 축 5개로 SAME 이 됐다

```
원상품  Booty Ghosts T-shirt · 품번 B226AC010 · 색상 **heather grey**
c2      Bobo Choses Booty Ghosts T-shirt · 품번 **null** · 색상 **null**
축 5개 — 제목 booty/ghosts · 상품군 TOP↔TOP · 소재 organic cotton:100 · 대상 KIDS · 사이즈 AGE↔AGE
blockers **0** · conflicts **0** ⟹ `SAME_MIN_AXES = 5` 를 **정확히 채웠다**
🔴 그 5개 중 **식별력 있는 축은 제목 하나** 다(나머지 넷은 「아동 상의·면·연령 사이즈」 = 거의 전부에 맞는다)
🔴 그리고 **품번도 색상도 없다** — 가를 수 있는 두 축이 **둘 다 비어 있었다**
```

🟢🟢 **그런데 사람이 가른 축이 데이터에 «있다»** — 소매 길이다:

```
c1 제목 「Booty Ghosts **Long Sleeve** T-Shirt」 → human **SAME**  (원상품은 긴팔)
c2 제목 「Booty Ghosts T-shirt」(Long Sleeve 없음) → human **DIFFERENT**(「긴팔이 아니다」)
🔴 그런데 `GARMENT_FORM` 축은 **둘 다 SHIRT** 로 읽어 **발화하지 않았다**
   (그 축은 셔츠/스웨트셔츠 같은 **옷 종류** 를 보고 **소매 길이를 보지 않는다**)
🔴 N=2 다 — 일반화하지 않는다.
```

## 3. 🔴 기존 구조 안에서 c2 를 막는 **안전한 레버가 없다**

```
① 색상 축        🔴 c2 는 색상이 **null** 이다 — `colorUnverified` 는 **EXACT 는 막지만 SAME verdict 는 막지 않는다**
② 품번 축        🔴 c2 는 품번이 **null** — 비교할 것이 없다
③ GARMENT_FORM   🔴 **발화하지 않는다**(둘 다 SHIRT) — 소매 길이를 보는 코드가 **없다**
④ 축 수 올리기   🔴 **threshold 변경** 이고 금지 축이다(SAME_MIN_AXES)
⑤ 소매 길이 축 신설 🔴 **새 축** 이고 CPO 가 「무작정 추가 금지」라 했다
⟹ 🔴 **그래서 c2 는 이번 범위에서 고칠 수 없다.** 그 사실을 그대로 보고한다.
```

## 4. 🟡 반대로 **c4·c7 은 기존 축만으로 다룰 수 있다**(🔴 단 가격 집계 영역이다)

```
🟢 두 건 다 **blocker 가 이미 있다**(`MATERIAL` · `GARMENT_FORM` · `NO_TITLE_OVERLAP`)
🟡 최소안 — 「**그 blocker 가 있는 PRESUMED_SAME 은 금액 집계에서 뺀다**」
   🟢 새 축 **0** · threshold **0** · 8축 재개 **0**(이미 계산된 blocker 를 읽기만 한다)
   🔴 그러나 그것은 **가격 집계 조건 변경** 이고 §00-B 가 **가격 작업 전부 보류** 로 묶어 뒀다
⟹ 🔴 **구현하지 않았다.** CPO 가 가격 단계를 열 때 **1순위 후보** 로 올린다.
```

## 5. 🟢 그리고 **정확도 숫자를 가른다**

```
SAME 로 «확정» 된 것      4건 — human SAME **3** · DIFFERENT **1**(c2) ⟹ precision **3/4**
PRESUMED_SAME(보류)       3건 — human SAME **1**(c3 아님 · c3는 SAME 확정) · DIFFERENT **2**(c4·c7)
🔴 WU-123 의 「precision 4/5」는 SAME·PRESUMED 를 **합친** 값이다 —
   🟢 갈라 보면 **「확정 SAME 은 3/4, 보류는 1/3」** 이고 **보류가 더 틀린다**(설계대로다)
🟢 recall — human SAME 4건 전부 SAME/PRESUMED 로 올라왔다(**놓친 동일상품 0**)
```

---

## 🔴 Known Unknowns

```
① 🔴 표본 **7건 · 원상품 2개** 다
② 🔴 「소매 길이」 축의 전수 빈도·안전성 **미측정**(N=2)
③ 🔴 `PRESUMED_SAME` 이 금액 집계에 들어가는 **전수 비율** 미측정
④ 🔴 원상품 `category` 가 **undefined** 다 — 상품군 축은 **후보 쪽 추정** 으로만 선다(별도 관측)
⑤ 🔴 가격은 한 건도 건드리지 않았다
```

## 결론 — 🔴 **c4·c7 은 「표기/집계」 문제 · c2 는 「가를 축이 없음」**

```
🟢 MI 는 c4·c7 에서 **보류 신호를 이미 냈다**(MATERIAL · GARMENT_FORM) ⟹ 판정 결함이 아니다
🔴 **c2 만 진짜 오판** 이고 원인은 **약한 축 5개 + 품번·색상 둘 다 부재** 다
🔴 기존 구조 안에 c2 를 막는 **안전한 레버가 없다**(새 축 또는 threshold 필요 ⟹ 둘 다 금지)
🟡 c4·c7 의 최소안(**blocker 있는 PRESUMED_SAME 을 금액에서 제외**)은 **가격 단계 1순위** 로 보관
🔴 운영 변경 **0** · 배포 0 · 가격 **0** · 8축 **0** · threshold **0** · 새 축 **0**
```
