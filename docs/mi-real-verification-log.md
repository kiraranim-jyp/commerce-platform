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

---

## [MI-REAL-04 #3 보강] `Stamp Bloom ↔ B226AC070` — PASS 와 «별개로» 남겨야 할 두 가지

판정은 `PASS`(CEO 확정)다. 아래는 정확도가 아니라 **근거 품질**의 기록이다.

### 중요한 발견 1 — `match_truth = null` 인데 EXACT 로 갔다

`B226AC070` 은 **해외·국내 두 페이지 본문에 모델코드가 모두 박혀 있다**
(해외 `Product code B226AC070` / 국내 `Ref.B226AC070`). 그런데 저장된 근거는

```text
match_truth = null      verified = true       Vision 관측 0건
reasons     = 모델명 유사도 100% | 카테고리 일치
```

`EXACT` 에 도달한 경로는 `EXACT_IDENTIFIER` 가 아니라 `priceTierFromLink` 의
**`null + verified=true` fallback** 이었다. #2 가 모델코드로 `EXACT_IDENTIFIER` 를
받은 것과 대비된다.

🔴 **이번엔 결과가 맞았다. 그러나 맞은 이유가 「코드가 같아서」가 아니다.**
같은 fallback 은 코드가 **다른** 쌍에도 `EXACT` 를 줄 수 있다. 정확도 FAIL 은
아니고, **잠재적 근거 취약점**이다. 지금 코드는 고치지 않는다(CEO 지시).

### 중요한 발견 2 — 「`B226AC070` 스냅샷 0건」은 «내 조회의 오류» 였다

이전 세션에서 내가 `0건` 이라고 보고했다. 실제로는 **22건** 있다.
원인은 조회 조건이었다 — `source_url` / `sku` 만 뒤졌는데, 해외 URL 은
`/products/stamp-bloom-all-over-denim-pants` 라서 코드가 **본문에만** 있다.

> **`0건` 이라는 과거 판단은 잘못된 조회 결과였으며, 실제 Production 데이터
> 부재를 의미하지 않는다.**

**교훈(CEO 지시로 규칙화):** DB 컬럼 하나의 값이나 특정 URL 패턴만으로
실제 상품 관계·존재 여부를 확정하지 않는다.

---

## [MI-REAL-04 #4] `Smallable ↔ B226AC060` — 🔴 **UNRESOLVED**

프로토콜 6단계. 가격·과거 판정은 ⑥ 전까지 보지 않았다.

### ② 해외 원본 — **독립 확인 실패(차단)**

| 시도 | 결과 |
|---|---|
| Node `fetch` | `TypeError: fetch failed` |
| `curl -L` | **HTTP 403** (919 bytes) |
| 실제 브라우저(Chrome 확장) | **미연결** — 세션에서 사용 불가 |

우회(UA 위장·프록시·헤드리스)는 **금지**이므로 여기서 멈춘다.
확보한 것은 URL 슬러그뿐이다 — `…organic-cotton-ample-joggers-lavender…430663`.

### ③ 국내 후보 — 확인 완료

`bobochoses.com/products/b226ac060-bobo-choses-straight-jogging-pants` (HTTP 200)

```text
Ref.B226AC060 · "Bobo Choses straight violet jogging pants"
Lavender pants · Organic Cotton 66%, Recycled Cotton 17%, Cotton 17%
Loose fit · Responsibly made in Spain
```

### ③-보강 — 슬러그만으로 특정되는지 «반증» 을 찾아봤다

브랜드 공식 카탈로그에 `straight jogging pants` 가 **3종**이고 색만 다르다.

| Ref | 색 | 핏 |
|---|---|---|
| `B226AC059` | Dark green | Relaxed fit |
| **`B226AC060`** | **Lavender** | **Loose fit** |
| `B226AC061` | Electric blue | Loose fit |

여기까지는 `lavender` + `ample`(佛 = 넉넉한 ≒ Loose fit) 가 `B226AC060` 을
가리키는 것처럼 보였다. 그런데 —

🔴 **`B999CD005` 「Lavender Pace joggers」가 따로 있다.**

```text
Ref.B999CD005 · Lavender pants
Organic Cotton 66%, Recycled Cotton 17%, Cotton 17%   ← B226AC060 과 «완전히 동일»
Responsibly made in Spain · Model: 168 cm 착용        ← 성인 라인
```

색도 같고 **원단 조성까지 소수점 없이 동일**하다. 다른 것은 라인(키즈 `B226` /
성인 `B999`)뿐이다. 그리고 Smallable 슬러그는 `jogging pants` 가 아니라
**`joggers`** 라고 쓴다 — `Pace joggers` 쪽 표기와 더 가깝다.

### ④ 이미지 대조 — **불가**

국내 이미지(`B226AC060_1_1.webp`)는 받았다. 해외 이미지는 페이지가 403 이라
URL 자체를 얻을 수 없다. **URL 을 추측해서 받는 행위는 하지 않았다.**

### ⑤ ACTUAL_TRUTH = **UNRESOLVED**

> 해외 원본을 독립적으로 열지 못했고, 국내에는 **같은 색·같은 원단 조성**의
> 후보가 키즈/성인 **두 개** 있다. 슬러그 문자열만으로는 어느 쪽인지 정할 수 없다.

🔴 이것이 바로 #3 에서 CEO 가 규칙으로 못 박은 상황이다 —
**「특정 URL 패턴만으로 실제 상품 관계를 확정하지 않는다.」**
슬러그만 보고 `SAME` 을 적었다면 성인 상품을 키즈 상품으로 확정할 뻔했다.

### ⑥ 시스템 결과 (여기서 처음 열었다)

```text
match_truth = SIMILAR     verified = false     confidence = 0.84
reasons     = 모델명 유사도 75% | 카테고리 일치 | 브랜드 일치(제목 내 확인)
cross_seller_verdict = null
→ priceTier = COMPARISON      (SIMILAR → COMPARISON)
```

**시스템도 `EXACT` 라고 말하지 않았다.** 정책 A(EXACT 만 판매판정에 사용) 아래서
이 쌍은 **판매판정에 들어가지 않는다.** 독립 검증이 불가능했던 그 불확실성을
시스템도 `SIMILAR` 로 유지하고 있다 — 이번 건에 한해 **방향이 일치**한다.

⚠️ 다만 이것을 `PASS` 로 세지 않는다. **내가 정답을 못 만들었으므로 비교 자체가
성립하지 않는다.** 「시스템이 보수적이었다」는 관찰이지 정확도 검증이 아니다.

*(참고 · truth 로 쓰지 않음)* 저장된 해외 스냅샷 제목은
`Bobo Choses 26FW Straight Jogging Pants` 다. 키즈(`26FW`=AW26) 쪽을 가리키지만,
이건 **시스템이 수집한 데이터**라 프로토콜상 정답 근거로 쓸 수 없다.

### 판정

| 항목 | 값 |
|---|---|
| ACTUAL_TRUTH | **UNRESOLVED** — 해외 원본 접근 차단 |
| 시스템 | `SIMILAR` / `COMPARISON` |
| 비교 | **성립 불가** (PASS 도 FAIL 도 아님) |
| 판매판정 영향 | 없음 — 정책 A 로 애초에 제외 |

---

## 🔴 누적 (MI-REAL-04 #4 종료 시점)

```text
■ 실물 상품쌍 검증
  PASS          7
  FAIL          0
  UNRESOLVED    2      ← Curious Turnip(국내 404) · #4 Smallable(해외 403)
  미착수        1      ← #5 FORETFORET ↔ FORETFORET
  NOT AVAILABLE 1      ← SAME_MODEL_OPTION_DIFF

■ 별도 UI 검증
  UNVERIFIED    1      ← Product 화면 14항목 (렌더 경로 재현 불가)

MI 정확도  🔴 HOLD
코드 / DB / fixture 변경  0건
```

🔴 **UNRESOLVED 2건의 원인은 서로 다르다** — 하나는 국내 페이지 소멸(404),
하나는 해외 판매처 차단(403). 같은 숫자로 묶어 읽으면 안 된다.

---

## [MI-REAL-04 #4-A] Smallable 대체 수집경로 조사 — 6단계 전수

「사이트 접근 실패 = 수집 실패」로 끝내지 않는다(CEO 지시). 합의된 우선순위를
**순서대로 전부** 밟았다. 코드·DB 변경 0.

| # | 경로 | 결과 |
|---|---|---|
| ① | 공식 API | `api.smallable.com` → **robots.txt = `Disallow: *`** · **사용 중단** |
| ② | 공식 feed / sitemap | `sitemap.xml` · `sitemap_index.xml` · `/en/sitemap.xml` 전부 **403** |
| ③ | 공개 검색 인덱스 | 해당 상품 페이지가 **인덱스에 없음** · 요약은 **상호 모순** |
| ④ | 일반 HTTP | `www` · `en.` · `fr.` **전 호스트 403** |
| ⑤ | 브라우저 정상 접근 | Chrome 확장 **미연결** |
| ⑤-b | 브랜드 공식 역추적 | 판별표는 확보했으나 **대조할 Smallable 값이 없음** |
| ⑥ | → | **UNRESOLVED 확정** |

### ① 🔴 `api.smallable.com` 은 robots.txt 가 전면 금지다

```
User-agent: *
Disallow: *
```

정책을 읽기 **전에** 호스트 루트 1회를 받았다(탐색 목적). 정책을 확인한 시점에
중단했고, **그 응답은 증거로 사용하지 않았다.** 기록해 둔다.

### ④ 차단의 «성격» — 경로 규칙이 아니라 전면 차단

`robots.txt` **조차 403**이다(CloudFront). 즉 Smallable 의 크롤 정책이 무엇인지
읽을 방법 자체가 없다. 특정 경로를 막은 게 아니라 이 네트워크를 막은 것이다.
UA 위장·프록시·403 우회는 하지 않는다.

### ⑤-b 브랜드 공식 역추적 — «판별표» 는 만들었다

키즈/성인을 가르는 깨끗한 식별자를 브랜드 공식에서 확보했다.

| | `B226AC060` (키즈) | `B999CD005` (성인) |
|---|---|---|
| 사이즈 | **2-3Y · 4-5Y · 6-7Y · 8-9Y · 10-11Y · 12-13Y** | **XS · S · M · L · XL** |
| 가격 | **€65,00** | **€95,00** |
| 색·소재 | Lavender / Organic 66·Recycled 17·Cotton 17 | **완전히 동일** |

**색과 소재로는 절대 못 가른다. 사이즈와 가격이면 한 번에 갈린다.**
문제는 Smallable 쪽 사이즈·가격을 허용 경로로 얻을 수 없다는 것이다.

### ③ 🔴 검색 요약을 truth 로 쓰지 않은 이유 — 실제로 모순됐다

| 질의 | 요약이 말한 것 |
|---|---|
| 1차 | 「€65.00 · 2 colours · 2/3~12/13 years」 → **키즈** |
| 2차 | `bobochoses.com/es/products/**b999cd005**-lavender-pace-joggers` 를 매칭 → **성인** |

같은 상품에 대해 **두 요약이 서로 다른 결론**을 냈다. 게다가 1차의 값(€65 ·
키즈 사이즈)은 내가 직전에 조회한 **브랜드 공식 페이지에서도 그대로 나오는 값**이라,
Smallable 페이지에서 온 것인지 구분할 수 없다 — **순환논증 위험**.

→ **검색엔진 요약은 이번 건에서 독립 증거로 성립하지 않는다.**

### 정황은 있으나 증거는 아니다 (기록만)

검색 결과 «링크 목록»(요약이 아니라 실제 URL)에서 확인된 사실:
Smallable 은 성인 상품 슬러그에 **`women-s-collection`** 을 박는다 —
예: `…/product/trousers-women-s-collection-lavender-bobo-choses-229788`.
우리 대상 슬러그에는 그 표시가 **없다**.

⚠️ 이것은 **명명 관행에서 온 정황**이지 상품 증거가 아니다. `ACTUAL_TRUTH` 로
승격하지 않는다. #4 에서 slug 만 믿었다가 반증당한 것과 같은 종류의 근거다.

### #4 최종

```text
Smallable ↔ B226AC060
ACTUAL_TRUTH = UNRESOLVED   (허용된 수집경로 6종 전부 소진)
SYSTEM       = SIMILAR / verified=false / COMPARISON
결과         = UNRESOLVED   (PASS 아님 · FAIL 아님)
```

**사유(다른 UNRESOLVED 와 반드시 분리):**

```text
Curious Turnip → 국내 후보 페이지 소멸 (404)
Smallable      → 해외 원본 호스트 전면 차단 (CloudFront 403, robots.txt 포함)
```

### 🔴 이번 조사가 드러낸 것은 검증 문제가 아니라 «수집 아키텍처» 문제다

`페이지 HTTP 200` 하나에 수집 가능 여부가 걸려 있다. source 별로
`acquisition_method(API·FEED·SEARCH·SCRAPE·MANUAL)` / `availability` /
`last_success` / `fallback_method` 를 관리해야 한다는 CEO 지적이 맞다.
**단, 지금 코드로 만들지 않는다.** MI-REAL 은 정확도 검증 단계다.
(MANUAL 7곳 · `rulii`/`looxloo` 후보 0건 · Smallable 403 이 같은 뿌리로 보인다.)

---

## [MI-REAL-04 #5] `FORETFORET ↔ FORETFORET` — 두 층으로 기록

CEO 지시대로 **상품 동일성**과 **후보 품질**을 분리한다. 코드·DB 변경 0.

### 먼저 갈라야 할 두 종류 — 「자기 도메인」은 5건이지만 성격이 다르다

전체 ACTIVE 링크 71건 중 원본 host == 후보 host 인 것이 **5건**이다.

| 층 | 쌍 | 경로 | 판정 |
|---|---|---|---|
| **A** | `bobochoses.com` ↔ `bobochoses.com` (4건) | 원본 `/en-kr/…b226ac043` · 후보 `/…b226ac042` | **서로 다른 listing** |
| **B** | `www.foretforet.com` ↔ `www.foretforet.com` (1건) | 양쪽 `shopdetail.html?branduid=**10278273**` | 🔴 **동일 listing** |

**A 는 결함이 아니다.** 같은 도메인이지만 상품코드가 `B226AC043` vs `B226AC042` 로
다르고 listing 도 다르다(MI-REAL-04 #1 에서 이미 실물 검증한 그 쌍이다).
브랜드 공식의 글로벌 스토어프런트(`/en-kr`)와 KR 스토어프런트를 비교한 것으로,
**정상적인 cross-listing** 이다.

### ①~④ B 가 동일 listing 이라는 확정

```text
host      www.foretforet.com  ==  www.foretforet.com
path      /shop/shopdetail.html  ==  /shop/shopdetail.html
branduid  10278273            ==  10278273
모델코드  MYM2609004          ==  MYM2609004
상품명    26FW1차 [마이마이]532 캐너피슈즈 canopy shoes_실버  (동일)
```

**본문 텍스트 SHA-256 완전 일치** — `4f10497a1b6c7d70c7666bb5f0b3baed` / 9,324자.
두 응답의 차이 20줄은 전부 **URL 에코**(`og:url`, 검색창 `value="신발"`,
Q&A `returnurl`, 요청마다 새로 발급되는 `GfDT` 추적 토큰)다.

→ **차이는 검색 추적 파라미터뿐이고, 상품 페이지는 같은 것이다.**

### ⑤ 시스템 결과

```text
match_truth = TEXT_CONFIRMED   verified = false   confidence = 1.0
→ priceTier = COMPARISON
```

정책 A(EXACT 만 판매판정) 아래서 **판매판정에는 들어가지 않는다.**
다만 COMPARISON 티어(국내 경쟁가격)에는 들어간다.

🔴 **그리고 실제로 자기 가격을 자기 경쟁가로 들고 있다.** 이 스냅샷의 가격 관측은

```text
[DOMESTIC_SHOP] 포레포레  KRW 70,000   ← 중복 2건
해외 원본 관측                0건
```

즉 「원본 가격」이 없고 「국내 경쟁가격」만 있는데, 그 둘이 같은 페이지다.

### ⑥ 후보가 생성된 원인 — 🔴 스키마에 「해외」라는 개념이 없다

`product_snapshots` 의 컬럼 전부:

```text
id, source_url, title, thumbnail_url, status, workspace,
created_at, updated_at, last_opened_at, job_key, workspace_id
```

**market / country / source_type / is_overseas 같은 필드가 하나도 없다.**
원본이 해외인지 국내인지 기록하는 자리 자체가 없으므로, 국내 쇼핑몰 URL 이
그대로 「원본」이 될 수 있고, 그 다음 국내 후보 탐색이 **같은 쇼핑몰을 다시 찾는다.**

보강 사실: `포레포레` 는 `domestic_price_sources` 에 `seller_type=DOMESTIC` /
`AUTO_SCRAPE` / `enabled=true` 로 등록된 **국내 판매처**다. 그 판매처의 상품
페이지가 원본으로 들어왔고, 같은 판매처에서 후보를 찾았다.

### 판정 — 두 층

```text
상품 동일성 : SAME        (같은 페이지이므로 자명하다)
후보 품질   : 🔴 SELF-REFERENCE / INVALID CANDIDATE
```

🔴 **이 SAME 을 「매칭 PASS」로 세지 않는다.** 우리가 검증하려는 능력은
**서로 다른 판매처의 독립 listing 에서 동일상품을 찾아내는 것**인데,
동일 URL 자기참조는 그 능력을 전혀 검증하지 않는다.

```text
정확도 표본     → 제외
후보 생성 결함  → 별도 기록 (이 항목)
```

### 별도 backlog (지금 코드로 만들지 않는다)

`domestic_price_sources` 에는 이미 `collection_strategy` 가 있다 —
`MANUAL 10곳 · AUTO_SCRAPE 5곳 · AUTO_API 1곳 · NOT_AVAILABLE 1곳`.
그러나 `source_role` 은 **18곳 중 16곳이 null**, `access_status` 는 **전부 null** 이다.
#4-A 의 수집경로 문제(API/Feed/Search/정상 페이지)와 같은 자리에서 만난다.
**MI-REAL 검증 중에는 수집 시스템을 고치지 않는다는 원칙을 유지한다.**

### ⑥-보강 — 코드에서 확인한 원인 (읽기만 함, 수정 0)

**자기참조를 막는 필터가 «없다».** 후보 생성 경로
`searchDomesticShops → scoreCandidateMatch → selectDomesticCandidate →
upsertDomesticProductLink` 어디에도 **host 비교가 한 줄도 없다.**
필터가 있어야 할 자리는 `run-domestic-price-check.ts` 의
`selectDomesticCandidate()` 직후, `upsertDomesticProductLink()` 직전이다.

#### 저장된 `match_reasons` 원문

```text
["모델명 유사도 100%", "카테고리 일치", "URL slug 일치", "브랜드 일치",
 "근거: 핵심 상품명 26fw1차/532/canopy/마이마이/실버",
 "판정방법: CROSS_SELLER_AXES — 품번을 비교할 수 없어 교차판매처 축과 텍스트 등급으로 판단",
 "판정근거: 입력 텍스트등급=very_high · 품번증거=unavailable
            (해외 없음 ↔ 국내 MYM2609004) · 교차판매처=PRESUMED_SAME → TEXT_CONFIRMED"]
```

🔴 **`품번증거=unavailable (해외 없음 ↔ 국내 MYM2609004)`** —
**같은 페이지인데 「국내 후보」로 읽을 때만 품번이 나왔다.**
국내 쪽에는 `fetchForetforetModelCode`(`domestic-identifiers.ts`) 추출기가 붙고
원본 쪽에는 안 붙기 때문이다. 그래서 품번 비교를 건너뛰고 텍스트 등급으로
내려갔다. 양쪽을 같은 방식으로 읽었다면 `MYM2609004` 로 품번이 일치했을 것이다.

#### 🔴 `"URL slug 일치"` 가 발화한 이유 — slug 가 «상수» 로 붕괴한다

`extractSlug`(`match.ts:80`)는 **pathname 만** 쓰고 쿼리스트링을 버린다.

```ts
const { pathname } = new URL(url);          // ?branduid=10278273 은 버려진다
const last = segments[segments.length - 1];
return last ? normalizeText(last.replace(/\.html$/i, "")) : null;
```

포레포레는 `/shop/shopdetail.html?branduid=…` 구조다 →
**모든 상품의 slug 가 `shopdetail` 하나다.** 그리고 slug 가 같으면
`score = Math.max(score, 0.95)`(match.ts:402)로 **0.95 가 강제**된다.

ACTIVE 링크 71건의 slug 분포:

| slug | 링크 | host |
|---|---|---|
| `shopdetail` | **21건** | www.foretforet.com |
| `detail` | **18건** | www.deuxbebe.com |
| (나머지는 bobochoses 의 품번 포함 handle) | | |

**71건 중 39건(55%)** 이 slug 가 상수로 붕괴하는 쇼핑몰에 있다.

⚠️ **과장하지 않는다.** 이 신호는 `원본 slug == 후보 slug` 일 때만 발화한다.
오늘 원본들은 대부분 bobochoses/junioredition 의 품번 포함 handle 이라
**실제로 발화한 것은 이 자기참조 1건뿐**이다. 또 `shopdetail` ≠ `detail` 이므로
두 쇼핑몰 «사이» 의 충돌도 현재는 없다.

🔴 그러나 **원본이 이런 쇼핑몰에서 들어오는 순간**(이번처럼) 또는
**두 번째 쇼핑몰이 같은 마지막 경로 세그먼트를 쓰는 순간**,
`URL slug 일치` 는 **상품과 무관하게** 0.95 를 얹는 신호가 된다.
지금 고치지 않는다 — 기록만 한다.
