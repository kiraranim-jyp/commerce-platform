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

---

# 갱신 — MI-REAL-01.8 ~ 02.0 (2026-09-20) · Product 화면 실증 시도

**결론: `UNVERIFIED` 유지.** 코드·DB·fixture 변경 **0건**.

## 01.8 — P0-D.2 핵심 로직, 실제 데이터로 확인

**진짜 COMPARISON-only 4건**(국내 EXACT 0 · 비교가격만 존재)을 실제 Production
데이터로 실제 계산 함수에 넣었다.

| 스냅샷 | 국내 비교가 | basis | 실제 출력 문구 | 금지어 |
|---|---:|---|---|---|
| `dbe089ae` | ₩162,000 | COMPARISON | 「국내 가격 비교 데이터 없음 — 마진 기준으로만 판단」 | 0 |
| `0c1a1b23` | ₩75,000 | COMPARISON | 〃 | 0 |
| `e57b4678` | ₩162,000 | COMPARISON | 〃 | 0 |
| `e727a4ee` | ₩162,000 | COMPARISON | 〃 | 0 |

```
찾던 문구   「국내 최저가 ₩162,000보다 현재 판매가가 높습니다」  →  4건 전부 «없음»
gap 지표    priceGapVsLowest / vsAverage  →  전부 null
금지어      낮추 · 인하 · 최저가 · 보다 높습니다 · 경쟁력  →  0건
```

🔴 **₩75,000 짜리 비교상품이 있는 상품에서도 인하 권고가 나오지 않았다.**
비교상품 가격이 판정 «입력에서» 실제로 빠진다.

🔴 **다만 이것은 `computePriceDecision` 직접 호출이다.** 대시보드가 실제로 부르는
`computeSnapshotReadiness` 는 아니다. 그래서 PASS 로 올리지 않았다.

## 01.9 — 🔴 검증 대상이 잘못 지정돼 있었다

DOM 검사 전에 «렌더 지점» 을 먼저 찾았고, 거기서 전제가 어긋났다.

```
판매판정 reason 문자열의 «유일한» 렌더 지점
  apps/admin/src/app/today/page.tsx:417
  <span … title={price?.reason}>        ← 대시보드의 «title 속성»
```

- Product 화면에서 `decision.reason` 을 그리는 곳 **0곳**
- 대시보드에서도 본문 텍스트가 아니라 **속성**이라 `textContent` 로는 잡히지 않는다

즉 「상품 화면을 열어 그 문구를 찾는다」는 설계 자체가 **다른 화면을 겨냥**하고 있었다.
다음에 이 항목을 다시 볼 때는 **대상이 `today/page.tsx` 이고 `[title]` 속성까지
순회해야 한다.**

## 02.0 — 실제 렌더 경로 재현 실패 (자격증명 부재)

대시보드가 쓰는 `computeSnapshotReadiness` 를 실제 데이터로 실행하려 했으나 막혔다.

```
apps/admin/.env.local   OCI_PROXY_URL · QA_PROXY_TO_PROD  (둘뿐)
필요한 것                NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
결과                     Error: supabaseUrl is required.
```

그 둘은 **Vercel 환경변수에만** 있다. 지금까지 쓴 DB 접근은 `packages/database` 의
`DATABASE_URL`(Prisma)인데, `compute-readiness` 는 **Supabase 클라이언트**를 쓰므로
그 경로로 대체되지 않는다.

🔴 **우회하지 않았다.** 자격증명을 로컬로 가져오지도, 다른 값으로 대신하지도 않았다.
CEO 판단: 「이 검증 하나 때문에 Production credential 을 로컬로 가져올 이유가 없다」.

## 📌 별도 보존 — UX / 설명가능성 후보 (정확도 판정과 분리)

> **Product 화면에는 판매판정 근거가 표시되지 않는다.**
> `decision.reason` 은 대시보드의 `title` 속성에서만 확인된다.

이것을 결함으로 판정하지 않는다. 남기는 질문은 이것이다 —
**판매자가 상품 상세에서 「왜 이 가격 판단이 나왔는가」를 확인할 수 있어야 하는가?**
MI 정확도와 별개의 **정책 결정**이다.

---

## 누적 (변동 없음)

```text
PASS          4
FAIL          0
UNVERIFIED    1      Product 화면 — 렌더 경로 재현 불가
NOT AVAILABLE 1

MI 정확도     🔴 HOLD
```

### 🔴 HOLD 의 원인을 정확히 적는다

**이번 COMPARISON 판정 로직 때문이 아니다.** 그쪽은 실제 데이터 4건에서
비교가격이 판정 입력에서 빠지는 것을 확인했다.

HOLD 인 이유는 둘이다:

1. **실물 매칭 표본이 4건**으로 작다
2. **Product 화면 검증이 남아 있다**

「증거」와 「추론」을 섞지 않는다 — 계산 단계는 확인했고, 그 값이 화면에
그대로 실리는지는 확인하지 못했다.

---

# MI-REAL-03 — 검증 표본 확보 가능성 조사 (2026-09-20)

```text
결과: HOLD — 데이터 부족
코드 / DB / fixture 변경: 0
```

## 연결 현황

```text
연결된 스냅샷       53 / 328
연결 안 된 스냅샷   275 / 328
```

## 후보 생성 — 등록 13곳 중 «3곳» 만 후보를 냈다

| 후보 | 소스 | 방식 | 조회 이력 |
|---:|---|---|---|
| **32** | `bobochoses.com` | AUTO_API | O |
| **21** | `foretforet.com` | AUTO_SCRAPE | O |
| **18** | `deuxbebe.com` | AUTO_SCRAPE | O |
| 0 | `rulii.co.kr` · `looxloo.com` | AUTO_SCRAPE | **O** — 돌았는데 0건 |
| 0 | `chocoel.co.kr` | AUTO_SCRAPE | O · `NO_RESULT` |
| 0 | `karymarket` · `nokimore` · `ocokorea` · `coconjennie` · `chouchouenfant` · `kidikidi` · `danawa` | **MANUAL** | **X — 자동 조회 없음** |
| 0 | `shopping.naver.com` | — | `NOT_AVAILABLE` |

## 추가 독립 검증 가능 표본

```text
SAME → EXACT                 42
DIFFERENT → COMPARISON       23
SAME_MODEL_OPTION_DIFF        0
                            ───
검증 대기                    65   (그중 «4건» 만 실물 검증 완료)
```

## 핵심 원인 — 세 겹

```text
① 자동 후보 생성 경로가 3개 소스에 집중
   MANUAL 7곳 + NOT_AVAILABLE 1곳은 후보를 낼 경로가 없다

② 그 3개 소스의 브랜드 / 상품 커버리지가 제한적
   Emile et Ida 9 · Hundred Pieces 6 · Bonpoint 2 · BOSS 2 → 전부 링크 0건

③ 현재 데이터에서 SAME_MODEL_OPTION_DIFF 후보 미확보
```

### 🔴 ③의 표현을 정확히 한다 (CEO 정정)

**확정된 사실**은 여기까지다 — 「현재 Production 데이터에서 그 유형의 후보가
확보되지 않았다」.

🔴 **「국내에 그 상품이 유통되지 않는다」는 이번 조사 범위에서의 «해석» 이다.**
확인한 것은 DEUXBEBE 의 PèPè 3종이 서로 다른 모델이라는 것뿐이고, 국내 유통
전체를 조사한 것이 아니다. **사실처럼 쓰지 않는다.**

## 판정

| | |
|---|---|
| `BLOCKED` 아님 | 후보 생성 경로가 막힌 것이 아니라 **3곳만 열려 있다** |
| `GO` 아님 | `SAME_MODEL_OPTION_DIFF` 는 현재 데이터로 확보 불가 |
| **`HOLD`** | 데이터 부족 |

🔴 **「검증할 표본이 없다」는 뜻이 아니다.** 65건이 대기 중이고 4건만 봤다.
**추가 검증은 코드 변경 없이 지금 바로 가능하다.**

## 다음 — MI-REAL-04

```text
우선순위:  SAME 5건  →  DIFFERENT 5건  →  추가 SAME / DIFFERENT
```

🔴 `SAME_MODEL_OPTION_DIFF` 를 **억지로 만들지 않는다.** Production 에서 0이면
0 그대로 기록한다. 그것을 채우려고 신규 데이터를 만들거나 매칭 로직을 바꾸면
**검증 자체가 오염된다.**

## 누적 (변동 없음)

```text
PASS 4 · FAIL 0 · UNVERIFIED 1 · NOT AVAILABLE 1      MI 정확도 🔴 HOLD
```

---

# MI-REAL-04 (2026-09-20) — 표본 재집계 + 첫 검증

## 🔴 표본 숫자를 두 번 정정했다

```text
링크 수            65   ← MI-REAL-03 이 «대기» 로 적은 수. count(*) 였다
고유 상품쌍        18   ← 중복 스냅샷을 걷어낸 수
실제 미검증 표본    6   ← 이미 검증한 2쌍을 뺀 수
```

같은 상품의 스냅샷이 여러 번 생겨 링크가 부풀어 있었다.
**「65건 대기」는 정정된 과거 수치이고, 이후 정확도 표본에 쓰지 않는다.**

| 유형 | 링크 | 국내상품 | 해외상품 | 고유쌍 |
|---|---:|---:|---:|---:|
| SAME → EXACT | 42 | 11 | **5** | 11 |
| DIFFERENT → COMPARISON | 23 | 7 | **4** | 7 |

🔴 이 상태로 「SAME 5건」을 채우면 **같은 상품을 다섯 번 검증하고 5 PASS 라고 적게 된다.**
그건 표본 확대가 아니라 숫자 부풀리기다.

## 검증 #3 — Curious Turnip All Over Swim Cap → **UNRESOLVED**

```text
해외 (junioredition)   HTTP 200
  🔴 모델코드 B126AI018 — URL 엔 없지만 «페이지 본문» 에 있다
  Green · 88% Polyester, 12% Elastane · Swim Cap · 52 / 2-6 years

국내 (Bobo Choses KR)  HTTP 404  ← 페이지가 죽었다
  이미지 확보 불가 · 현재 상품 정보 확인 불가
```

국내 URL slug 에 `b126ai018` 과 상품명이 그대로 들어 있어 **강한 정황증거**지만,
현재 페이지를 확인하지 못한 상태에서 SAME 을 확정할 근거로 쓰지 않는다.

```text
ACTUAL_TRUTH = UNRESOLVED
MI 결과      = UNVERIFIED
```

## 남은 5쌍 — HTTP 상태 일괄 확인 (이미지·판정 미확인)

| 쌍 | 국내 후보 | 상태 |
|---|---|---|
| `B226AC043` ↔ **`B226AC042`** | `b226ac042-mystery-bc-half-zipped` | **200** |
| Booty Ghosts ↔ `B226AC010` | `b226ac010-booty-ghosts-t-shirt` | **200** |
| Stamp Bloom ↔ `B226AC070` | `b226ac070-stamp-bloom-all-over-d…` | **200** |
| Smallable ↔ `B226AC060` | `b226ac060-bobo-choses-straight-j…` | **200** |
| FORETFORET ↔ FORETFORET | `shopdetail.html` | **200** |

**5쌍 전부 살아 있다.** 리다이렉트·차단 없음. 다음 세션에서 바로 검증 가능하다.

🔴 **최우선은 `B226AC043` ↔ `B226AC042`** — 같은 사진을 쓰면서 모델코드가 다른 쌍이고,
Vision 이 100 을 준 그 쌍이다(P0-A.30 기록). 거짓 SAME 이 나올 수 있는 가장 가까운 자리.

⚠️ `FORETFORET ↔ FORETFORET` 은 원본과 후보가 **같은 판매처**다. 그 자체가 정상인지
먼저 확인해야 한다.

---

## 🔴 누적 — 집계를 «두 축으로» 나눈다 (CEO 지시)

`UNVERIFIED` 하나에 서로 다른 문제를 섞지 않는다.

```text
■ 실물 상품쌍 검증
  PASS          4
  FAIL          0
  UNRESOLVED    1      ← #3 Curious Turnip (국내 404)
  미착수        5      ← HTTP 200 확인됨, 검증 가능
  NOT AVAILABLE 1      ← SAME_MODEL_OPTION_DIFF

■ 별도 UI 검증
  UNVERIFIED    1      ← Product 화면 14항목 (렌더 경로 재현 불가)

MI 정확도  🔴 HOLD
```

**「검증 가능한 상품이 3개면 3개, 2개면 2개다.」** 숫자를 늘리는 것보다
고유 상품 + 실제 확인 가능성을 유지하는 것이 이 트랙의 목적이다.
