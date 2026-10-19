# WU-113 — 샵 대표(best) 선택 P1 최소 수정 (구현 · 배포)

> 🔴 CPO 지시 2026-10-19. 「**P1 만 채택.** P2(⑧ 게이트) · P3(샵당 다중 후보 구조) ·
> P4(품번 보호) · P5(가격)는 열지 않는다. 8축·threshold 변경 없음.」

---

# [WU-113 완료 보고]

## 1. Scope / 변경 내용

```
운영 **1 파일** — apps/admin/.../run-domestic-price-check.ts
  ⒜ orderByCrossSellerVerdict 에 **2차 키**(색상 증거) 추가 · 선택적 인자 `foreignColor`
  ⒝ selectDomesticCandidate 가 그 값을 받아 넘긴다(선택적 인자)
  ⒞ judgeDomesticCandidate 호출부가 **이미 갖고 있던** `input.foreignColor` 를 넘긴다
🔴 새 데이터 0 · 새 HTTP 0 · 새 색상 사전 0 · 새 판정 규칙 0 · threshold 0 · 8축 0 ·
   ⑧ 게이트 0 · 가격 파서/priceStatus/가격 집계 0 · UI 0 · Registry 0 · AI 0 · schema 0
```

## 2. 🔴🔴 원인 — **같은 등급에서 색을 적은 후보가 «그 토큰 때문에» 밀렸다**

STEP 1 에서 운영 함수(`orderByCrossSellerVerdict`)의 실제 입력을 전수로 찍었다:

```
tinyapple.net  (원상품 색상 **"heather grey"**)
 #0 [BEST] v=SAME  truth=STRONG_IDENTIFIER  conf **1.00**  color **null**
           → 🔴 Human **DIFFERENT**(반팔) · USD 53
 #1        v=SAME  truth=STRONG_IDENTIFIER  conf **0.64**  color **"shirt heather grey"**
           → 🟢 Human **SAME** · USD 58
 #2        v=PRESUMED_SAME                  conf 0.46      color null
```

```
🔴 verdict 도 matchTruth 도 **같다** ⟹ 기존 코드는 2차 키가 없어 **confidence 순서** 로 갈렸고,
   제목에 색을 적은 후보가 **토큰이 늘어 유사도에서 손해** 를 봤다.
🔴 그 결과 **「해외 동일상품 USD 최저가 = 53」이 다른 상품(반팔)의 가격** 이었다.
```

## 3. 구현 — **기존 신호 둘만** 2차 키로 쓴다

```ts
colorRank = 색이 «있고»(isColorUnverified === false) COLOR 충돌이 «없으면» 0, 그 외 1
sort((a,b) => rank(a)-rank(b) || colorRank(a)-colorRank(b))
```

```
🟢 `isColorUnverified` 는 **EXACT 게이트가 이미 쓰는 술어** 다(match-truth.ts:58) ·
   같은 파일이 **이미 import** 하고 있었다(:8) ⟹ 새 의존 0
🟢 `crossSellerConflicts[].conflict === "COLOR"` 도 **이미 계산된 값** 이다(types.ts:109)
🔴 **2차 키** 다 — 1차 키(`{SAME:0, PRESUMED_SAME:1, …, CONFLICT:3}`)를 **넘지 못한다**
🔴 원상품 색이 없거나 후보 전원이 색이 없으면 **순서 불변**(fail-safe)
🔴 색이 **어긋난** 후보는 올려주지 않는다 — 「색만 있으면 이긴다」가 아니다
```

## 4. 🟢🟢 E2E — **운영 경로로 다시 산출해 GT 27건과 재조인**(URL 키)

### best 가 바뀐 곳은 **하나** 다

```
- BEST 아님  [DIFFERENT] tinyapple.net USD 53   tier EXACT → **null**
+ BEST 됨    [SAME     ] tinyapple.net USD 58   tier null  → **EXACT**
🟢 나머지 21 샵의 대표는 **한 건도 바뀌지 않았다**
```

### CPO 가 요구한 세 측정

| | Before | After |
|---|---|---|
| Human SAME 인데 **잘못된 best 때문에 탈락** | 1 (tinyapple USD 58) | 🟢 **0** |
| Human DIFFERENT 가 **best 로 선택** | 1 (tinyapple USD 53) | 🟢 **0** |
| Human SAME 이 best 로 선택 | 13 | 🟢 **14** |

### 금액 집계 / 최저가

```
금액 집계 진입      9건 → 9건 (수는 같고 **구성이 정확해졌다**)
  Human SAME        8 → **9**        🔴 오포함  1 → **0**
tier EXACT 정밀도   5/6 → **6/6**
🟢🟢 **해외 USD 최저가 53 → 58** (CPO 목표 그대로)
🟢 다른 통화 최저가 **전부 불변** — EUR 40 · GBP 33 · CAD 64
🟢 🇰🇷 국내 KRW 88,000 **불변**
```

🟢 **tinyapple 3항 전부 충족** — ⒜ USD 53 이 대표가 **아니다** ⒝ USD 58 이 대표가 **됐다**
⒞ USD 53 이 해외 동일상품 가격에서 **사라졌다**.

## 5. 테스트 / 음성 대조

```
계약 **12** (네트워크 0 · 운영 함수 직접 호출 + 소스 앵커)
🔴🔴 **음성 대조가 내 단언의 구멍을 하나 찾았다**:
   1차 M2(`colorRank` 에서 COLOR 충돌 검사 제거) → **0 failed**
   원인 — 그 케이스의 색상 후보가 **충돌 하나뿐** 이라 `colorTieBreak` 가 false 가 되어
          `colorRank` 에 **도달하지 않았다**(「통과했다」≠「가드가 있다」)
   🟢 **깨끗한 색상 + 충돌 색상이 «같이» 있는** 모양을 추가해 잠갔다
최종 — M1(2차 키 제거) **3 FAIL** · M2(충돌검사 제거) **1 FAIL** ·
       M3(키 순서 뒤집기) **1 FAIL** · M4(배선 제거) **1 FAIL** → 복구 **12 passed**
```

🔴🔴 **작업 중 실수 1건을 적는다** — 음성 대조를 돌릴 때 `git checkout --` 로 복구했는데
**구현이 아직 커밋되지 않아 구현 자체가 지워졌다**(M2~M4 1차 결과 무효). 🟢 **파일 백업으로
복구하는 방식으로 바꿔** 다시 측정했다. 🔴 미커밋 상태에서 `git checkout` 을 복구 수단으로 쓰지 않는다.

## 6. 회귀 / Typecheck / Build / 배포

```
apps/admin **603 files / 8,396 passed · failed 0**  (WU-112 기준 601/8,378 + 신규 12 · 기존 0건 깨짐)
typecheck **0** · build **exit 0**
```

## 7. 🔴 바꾸지 않은 것 (CPO 보류 전수 대조)

```
P2 ⑧ 게이트 완화            ❌ (술어 `candidates[0].matchLevel !== "low"` **원문 그대로** · 계약으로 잠금)
P3 샵당 다중 후보 구조       ❌ (sink 는 여전히 샵당 best 1건)
P4 품번 보호 완화            ❌ (AB 라인 4건은 **여전히 EXCLUDED**)
P5 가격 파서/priceStatus/집계 ❌ · 8축 ❌ · threshold ❌ · AI 검색 전략 ❌ · 국내/해외 가격비교 작업 ❌
```

---

## 🔴 Known Unknowns

```
① 🔴 표본 **원상품 2개 · 후보 27건** 이다 — 「정밀도 6/6」을 전수로 쓰지 않는다
② 🔴 이 2차 키가 발화한 샵은 **1곳**(tinyapple) 이다 · 전수 발화 빈도 **미측정**
③ 🔴 Human SAME 19 중 가격비교 반영은 **8 → 9** 다 — 나머지 10건의 원인은
   P2/P3/P4/P5 이고 **CPO 가 보류** 했다
④ 🔴 색상 축이 **없는** 샵에서는 이 수정이 아무 일도 하지 않는다(설계대로)
⑤ 🔴 `priceStatus` 모순(WU-111)은 **그대로 남아 있다**(§00-B 보류)
```

## CEO Action — 🟡 **따져 실제 화면 1회**

```
URL  https://ttaejyo.vercel.app/pipeline  (B226AC009 / B226AC010)
🔴 보실 것 — 🌎 해외 동일상품 참고가격의 **USD 최저가가 58** 인지(53 이면 FAIL)
🟢 그 밖은 바뀌지 않아야 합니다 — EUR 40 · GBP 33 · CAD 64 · 🇰🇷 ₩88,000
🟡 후보 목록(판정 입력 포함)도 새 판정값으로 갱신해 뒀습니다 —
   https://claude.ai/code/artifact/e333b58b-d70a-4e83-b21c-2af4b6bff8e5
   🔴 **후보 27건은 그대로** 이고 대표 선택만 바뀌었으므로 **다시 판정하실 필요는 없습니다**
      (기존 GT 가 그대로 유효합니다). 보시고 싶을 때 참고용으로만 쓰십시오.
```

## 결론 — 🟢 **P1 GO / 오포함 0 · USD 최저가 교정 완료**

```
Code PASS 🟢 · Test PASS 🟢 12 + 회귀 8,396 · Type PASS 🟢 0 · Build PASS 🟢
Deploy PASS 🟢 · Production UI PASS 🔴 **CEO 1회 확인 대기**
```
