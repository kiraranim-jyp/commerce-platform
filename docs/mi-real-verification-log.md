# MI 실물 정확도 검증 기록 (진행 중 — GO 아님)

- 시작: 2026-09-20
- 갱신: 2026-09-20 (MI-REAL-01.5 ~ 01.7)
- 상태: **HOLD.** 실물 독립 검증 **PASS 4 / FAIL 0 / UNVERIFIED 1 / NOT AVAILABLE 1**
- 이 문서는 **코드 변경 기록이 아니다.** 「실제 상품의 독립 정답 ↔ 시스템 결과」 대조 기록이다.

---

## 🔴 PASS 의 정의가 바뀌었다 (CEO 지시, 2026-09-20)

```text
❌ 정확도 PASS 가 «아닌» 것
   테스트 2,613개 통과 · TypeScript PASS · Production READY · API 응답 성공

✅ 정확도 PASS
   사람이 «독립적으로» 확인한 실제 정답  ==  시스템 결과
```

> **「2,613개 테스트 통과 = MI 정확도 PASS」라는 기준을 폐기한다.**

---

## 검증 프로토콜 (4회 반복으로 안정화)

```text
① 시스템 결과를 «보지 않고» URL 만 꺼낸다
② 해외 원본 페이지를 «직접» 읽는다   — 모델코드·상품명·색상·소재·형태
③ 국내 후보 페이지를 «직접» 읽는다   — 같은 항목
④ 🔴 이미지를 «눈으로» 대조한다      — 구조(스트랩·솔·실루엣)가 판정축이다
⑤ ACTUAL_TRUTH 를 먼저 확정한다     — SAME / DIFFERENT / UNRESOLVED
⑥ 그 «다음에» 시스템 결과를 공개한다
```

🔴 **④를 건너뛰면 UNRESOLVED 다.** 텍스트 일치만으로 SAME 을 주지 않는다.
🔴 애매하면 **DIFFERENT 를 우선**한다. 확정 근거가 없으면 EXACT 가 아니라 COMPARISON 이다.

---

## 결과

| # | 대상 | ACTUAL_TRUTH | 시스템 | 판정 |
|---|---|---|---|---|
| 1 | `b226ac043` 가격 | 시장별로 다른 가격 | `MARKET_PROBE` EUR 75 / `KR_MARKET` ₩162,000 | ✅ **PASS** |
| 2 | PèPè Lulu × DEUXBEBE 8021 | **DIFFERENT** | `SIMILAR` → COMPARISON | ✅ **PASS** |
| 3 | `B226AC009` × Bobo Choses KR | **SAME** | `EXACT_IDENTIFIER` → EXACT | ✅ **PASS** |
| 4 | PèPè Lulu × 포레포레 10226592 | **SAME** | `STRONG_IDENTIFIER` → EXACT | ✅ **PASS** |
| 5 | Hard Negative #3 (같은 모델·다른 옵션) | — | — | ⬜ **NOT AVAILABLE** |
| 6 | Product 화면 14항목 | — | — | ⚪ UNVERIFIED |

### ① 가격 — `b226ac043`

```
en-fr / en-int / en-de   EUR 75  → ₩116,742   MARKET_PROBE
en-us                    USD 108 → ₩145,021   MARKET_PROBE
en-kr                    KRW 162,000          KR_MARKET
```

🔴 **CTO 가 처음에 「시스템이 틀렸다」고 경보했다가 정정한 건이다.** 저장된
`source_url` 은 `/en-kr`(₩162,000)인데 헤드라인 원본가는 €75 라서 틀려 보였다.
실측하니 **다국가 가격을 전부 잡고 원본가/한국가를 라벨로 구분**하고 있었다.

> **남은 UX 문제**: 화면의 「원본 상품 보기」를 누르면 시스템이 쓴 가격과 다른
> 숫자가 보인다. 가격 수집 오류가 아니라 **검증 가능성(Explainability)** 문제다.

### ② Hard Negative — PèPè Lulu × DEUXBEBE (거짓 EXACT 를 만들지 않았다)

텍스트는 전부 같았다 — 브랜드 PèPè · 소재 Vernice(에나멜) · 색 Nero · 상품군 동일.
**이미지가 갈랐다:**

| | 해외 원본 | 국내 후보 |
|---|---|---|
| 스트랩 | **T-Bar**(세로+가로 T자) | **사선 스트랩 하나**, 세로 바 없음 |
| 솔 | 두툼한 검정 굽 | 얇고 납작한 탄색 |
| 안감 | 탄/브라운 | 핑크·크림 |

시스템 근거: `모델명 유사도 33% | 색상 일치 | 브랜드 일치` → **SIMILAR 에서 멈췄다.**
🔴 원본에 **모델코드가 아예 없는** 상품인데도 EXACT 로 올리지 않았다.

### ③ Positive — `B226AC009` (진짜 동일상품을 찾았다)

양쪽 모두 모델코드 `B226AC009`. 이미지의 그래픽(초록 몬스터 + 주황 곱슬머리
포옹, 우측 세로 `BOBO CHOSES` 각인)이 동일. 국내 ₩88,000.
시스템 근거: `품번이 URL에 포함됨 | modelCode 완전 일치 — 식별자 증거로 자동확정`

### ④ 🔴 다음 세션의 시작점 — PèPè Lulu × 포레포레 `10226592`

**같은 해외 원본에 국내 후보가 둘인데 시스템이 다르게 판정한다.**

```text
PèPè "Lulu T Bar Shoes in Vernice Nero"
  ├─ DEUXBEBE 8021     → SIMILAR           → COMPARISON   (②에서 DIFFERENT 확정)
  └─ 포레포레 10226592   → STRONG_IDENTIFIER → EXACT        ← 미확인
```

국내 후보 제목(실측):
`FORETFORET_AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER`

**형태가 「T-스트랩」으로 명시돼 있다** — ②를 DIFFERENT 로 가른 바로 그 축이
여기서는 일치한다. 그러나 **상품 이미지를 확보하지 못해** 확정하지 못했다
(그 페이지에서 뽑힌 이미지가 전부 배너였다. MakeShop 이라 상품 이미지 경로가
별도다 — 브라우저로 열면 즉시 보인다).

🔴 **이것이 `DIFFERENT → EXACT` 를 잡을 수 있는 가장 가까운 후보다.**
결과가 DIFFERENT 면 **즉시 FAIL · 표본 확대 중단 · matcher 원인 분석**으로 간다.

---

## 확인 못 한 것

| | |
|---|---|
| **Product 화면 14항목** | CTO 가 인증된 Production 화면을 열 수 없다. **코드 조사로 대체하지 않는다**(CEO 지시). CEO 가 직접 확인하는 별도 트랙 |
| **Smallable `jp/us → EUR`** | 라이브 조회 차단(`fetch failed`). 우회하지 않았다. P0-B 의 「`?currency=EUR` 고정 설계」 설명은 **검증된 사실이 아니라 가설**로 내려 둔다 |

### 🔴 Product 화면에서 반드시 볼 것

**PèPè Lulu 상품**(COMPARISON 만 있는 상품)에서 이런 문구가 나오는지:

```text
국내 최저가 ₩234,900보다 현재 판매가가 높습니다
```

나오면 **P0-D.2 정책 A 가 화면 어딘가에서 우회된 것이므로 즉시 FAIL** 이다.

---

## 현재 결론

> **실물 독립 검증 3건에서 가격 1 PASS · 거짓 EXACT 방지 1 PASS · 진짜 SAME 검출
> 1 PASS. FAIL 0. 그러나 표본이 3건이므로 MI 정확도 GO 를 선언할 수 없다.**

「3건 PASS」와 「MI 전체가 정확하다」는 **분리해서** 유지한다.

---

# 갱신 — MI-REAL-01.5 ~ 01.7 (2026-09-20)

## ④ 해결 — PèPè Lulu × 포레포레 `10226592` → ✅ **PASS**

`og:image` 에서 상품 이미지를 확보해 12축을 전부 대조했다.

```
중앙 세로 스트랩 O · 가로 스트랩 T자 연결 O · T-Bar 전체 구조 O
버클 위치 O · 앞코 라운드 O · 갑피 실루엣 O · 밑창 두툼·검정 O
힐 낮은 굽 O · 안감 탄/브라운 가죽 O · 인솔 PèPè 금박 각인 O
색상 O · 소재(에나멜) O
```

**핵심 차이 없음.** 사이즈 각인만 27(원본) vs 26(국내) — 같은 모델의 다른 사이즈다.
촬영 구도까지 같은 계열(위에서 내려다본 한 쌍, 직물 배경, 인솔 금박 노출).

`ACTUAL_TRUTH = SAME` → 시스템 `STRONG_IDENTIFIER → EXACT` → **일치**

### 🔴 이 건의 진짜 의미 — 같은 원본에서 두 후보를 «정확히 갈랐다»

```text
PèPè "Lulu T Bar Shoes in Vernice Nero"   (원본에 모델코드 «없음»)
  ├─ DEUXBEBE 8021    실제 DIFFERENT → SIMILAR           → COMPARISON  ✅
  └─ 포레포레 10226592  실제 SAME      → STRONG_IDENTIFIER → EXACT       ✅
```

브랜드·소재·색·상품군이 전부 같은 두 후보를 **실물 구조(스트랩·밑창)대로** 분리했다.
🔴 다만 이것은 「STRONG_IDENTIFIER 가 항상 정확하다」의 증명이 아니다. 1건이다.

## ⑤ Hard Negative #3 — ⬜ **NOT AVAILABLE** (억지로 만들지 않았다)

### 탐색 결과 (최소 조회로 종료)

```
모델코드가 다른 연결 쌍                     0건
URL 에 색상 단어가 있는 연결 쌍              2건 — 둘 다 이미 검증한 Lulu Vernice Nero
근거에 옵션/색상 차이가 적힌 링크            0건
cross_seller_verdict                     null 70 · PRESUMED_SAME 1
```

🔴 **`SAME_MODEL_OPTION_DIFF` 는 코드에 어휘가 있지만**(match-display.ts 의
`VISUAL_CHECK_TIER_ORDER`, P0-A.29-D) **Production 데이터에 «한 건도 없다».**
테스트로는 덮여 있으나 실제 상품에서 그 판정이 나온 적이 없다.

### 후보 생성 시도(MI-REAL-01.7)도 NOT AVAILABLE

`Lulu T-Bar` 의 **다른 색상**(`lulu-t-bar-shoes-in-tobacco`)으로 쌍을 만들려 했다.
해외 원본은 존재하고 이미지도 확보 가능하다(HTTP 200 · `Pepe-Lulu-T-Bar-Shoes-Tobacco.jpg`).

**그러나 국내에 그 색상이 유통되지 않는다.** DEUXBEBE 의 PèPè 전 라인업 3종:

| 상품명 | 모델 | 판단 |
|---|---|---|
| 페페 Lucy 블랙 [벨크로] | **Lucy**(벨크로) | Lulu 아님 |
| 페페 **Lucy Brown** [벨크로] | **Lucy**(벨크로) | 🔴 이름·색만 비슷 — **후보로 쓰지 않았다** |
| 페페 VERNICE NERO | (위 ②에서 DIFFERENT 확정) | — |

`Lucy Brown` ↔ `Lulu Tobacco` 는 **다른 모델**이다(벨크로 vs T-바). 이걸 후보로 쓰면
Hard Negative **#3(같은 모델·다른 색상)** 이 아니라 **#2(다른 모델)** 의 반복이고,
#2 는 이미 PASS 로 확인했다.

🔴 **「데이터를 못 찾았다」가 아니라 「국내에 그 색상이 유통되지 않는다」이다.**
MI 분석을 실행해도 결론은 같으므로 **Production 분석을 돌리지 않았다**(불필요한 데이터 생성 회피).

---

## 누적 (2026-09-20 기준)

```text
PASS          4   가격 1 · DIFFERENT→COMPARISON 1 · SAME→EXACT 2
FAIL          0
UNVERIFIED    1   Product 화면 14항목 — CEO 직접 확인 트랙
NOT AVAILABLE 1   Hard Negative #3 — 국내에 해당 색상 미유통

MI 정확도     🔴 HOLD
```

코드 변경 **0건** · DB 변경 **0건** · fixture **0건** (01.5~01.7 전 구간)

## 🔴 남은 핵심 미검증 — Product 화면 14항목

표본을 억지로 늘리는 것보다 **이것이 남은 핵심**이다. 체크리스트는 이 문서 위쪽에
있고, 그중 하나가 결정적이다:

> **PèPè Lulu 상품**(COMPARISON only)에서 `국내 최저가 ₩234,900보다 높습니다` 가
> 뜨면 **P0-D.2 정책 A 가 화면에서 우회된 것 = 즉시 FAIL**

## 이 트랙을 닫으며 — 확보한 것

1. 진짜 `SAME → EXACT` **2건**
2. 진짜 `DIFFERENT → COMPARISON` **1건**
3. **같은 해외 원본의 두 국내 후보를 실물 구조 차이로 올바르게 분리**한 사례
4. 가격 시장 구분(`MARKET_PROBE` / `KR_MARKET`) **1건**
5. `SAME_MODEL_OPTION_DIFF` 는 Production 에 **검증 가능한 실물 사례가 없다**는 사실

🔴 **「PASS 4건」과 「MI 전체가 정확하다」는 계속 분리해서 유지한다.**
