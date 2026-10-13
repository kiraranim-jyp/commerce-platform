# MI-GEMINI-DISCOVERY-QUERY-014 — Primary Query 재설계

> 🔴🔴 **Gemini API 호출 0 · grounding 호출 0 · AI Studio credit 사용 0 · ₩3,300 보존.**
> 기존 DB 덤프와 순수 함수만 썼다(§9).
> 🟢 **1 Product = 1 API Call = 1 Primary Query = 최대 3 Candidate** 를 코드로 고정했다.
> 🔴 Gemini 내부 검색어 N 은 **강제할 수 없다** — 측정하고 최소화한다(CPO 정정).

---

## 1. Current Query Audit — 🔴🔴 **결함이 실측으로 확증됐다**

### 현재 생성 규칙 (`generateQueries` · `SPECS` 순서 그대로)

```
Q1 상품명              Q5 상품코드
Q2 브랜드+상품명        Q6 브랜드+상품코드
Q3 상품명+색상          Q7 상품명+buy
Q4 브랜드+상품명+색상    Q8 브랜드+상품명+buy
```

🔴 운영 pool 은 이것을 `slice(0, maxQueries)` 로 **잘라 썼다.**

### 실측 (`sample 상품 N=15` · 아동 10 · 테니스 5 · Gemini 호출 0)

```
🔴🔴 Primary(queries[0]) = **Q1 15/15** — 상품명 «단독». 브랜드도 품번도 없다.
🔴🔴 품번 보유 3상품 중 Primary 가 품번 query 인 것 **0**
     (Q5/Q6 는 5~6번째라 `maxQueries = 1` 에서 **도달 불가**)

Primary 토큰 구성(전 상품 합계)
  PRODUCT_NAME 71 · CATEGORY 13 · MATERIAL 7
  🔴 노이즈 — MARKETING 6 · COLOR 3 · SIZE 1 · PRICE 1 = **11**
  🔴 IDENTIFIER 는 단 **1**
```

→ 🔴 **식별력이 거의 없는 긴 상품명을 던지고 있었다.**

### 🔴🔴 증거 등급을 두 층으로 가른다 (CPO 확정) — 섞어 읽지 않는다

```
🟢 **확정** — Query 품질 결함
   · 기존 Primary 가 상품명 단독이었다                     (15/15)
   · 품번 상품도 품번이 Primary 에 들어가지 않았다           (0/3)
   · Primary 에 불필요 토큰 11개가 포함된 사례가 있었다
   · WU-014 로 Primary 가 1개로 줄었다
   · 테스트상 calls 2→1 · grounding 6→3 의 **구조적** 변화가 발생했다
   · 실제 Gemini 호출은 **0** 이다

🔴 **미검증 가설** — 「상품명 단독 Query 가 실제 Gemini 의 5.5 grounding query
   확장을 **직접 발생시킨 원인** 이다」
   🔴 이 WU 는 Gemini 를 부르지 않았으므로 **실제 검색엔진에서 확장이 얼마나
      줄어드는지 측정하지 않았다.** 「원인을 잡았다」로 적지 않는다.
```

🔴 **중복/의미중복**: Q1~Q4 와 Q7/Q8 은 `productName` 을 공유하고 색상·`buy` 만
다르다 — 축이 다른 것이 아니라 **같은 축의 변형** 이다. 품번 축(Q5/Q6)만 질이 다르다.

---

## 2. Query Quality Analysis

| 분류 | Primary 에 들어간 토큰 수 | 판정 |
|---|---:|---|
| `PRODUCT_NAME` | 71 | 🟢 유지 |
| `CATEGORY` | 13 | 🟡 유지(식별에 약하지만 노이즈는 아니다) |
| `MATERIAL` | 7 | 🟢 **유지** — CPO 예시가 `Ribbed Velvet` 을 좋은 형태로 든다 |
| `MARKETING` | 6 | 🔴 **제거** |
| `COLOR` | 3 | 🔴 **제거** |
| `SIZE` | 1 | 🔴 **제거** |
| `PRICE` | 1 | 🔴 **제거** |
| `IDENTIFIER` | **1** | 🔴 **가장 강한데 거의 없다** → Level 1 로 끌어올린다 |

🔴 분류기의 `MATERIAL` 과 **제거 대상은 다르다** — 섞지 않았다. CPO STEP 3 의
제거 목록에 소재는 **없다.**

---

## 3. Proposed Primary Query Algorithm — 구현 완료

```
buildPrimaryQuery(identity)        packages/crawler/src/discovery-core/query-generator.ts

Level 1  brand && productCode
         → `${brand} ${productCode}`            ← 그 둘만. 다른 토큰 0
Level 2  brand && core.length > 0
         → `${brand} ${core(2~4)}`              ← denylist 로 노이즈만 제거
Level 3  core.length > 0  (브랜드 없음)
         → `${core(2~4)}`
UNAVAILABLE
         → **빈 문자열** · 🔴 호출하지 않는다
```

```ts
if (brand && code) return `${brand} ${code}`;              // L1
core = tokens(productName)
         .drop(DENYLIST)          // 색상·사이즈·가격·지역·시즌·마케팅
         .drop(SEASON_YEAR)       // 2026 · 26FW · AW26
         .drop(DUPLICATE_OF_BRAND)
         .take(MAX_CORE_TOKENS = 4);
if (brand && core.length) return `${brand} ${core}`;       // L2
if (core.length)          return core;                     // L3
return "";                                                 // UNAVAILABLE
```

🔴🔴 **denylist 로 간다 — allowlist 가 아니다.** 「Holly Hearts」·「Cherry Print」·
「T Bar」 같은 **고유 디자인명이 곧 식별자** 이고 allowlist 를 쓰면 모르는 디자인명이
조용히 죽는다. 🟢 이 리포가 `NON_IDENTIFYING_PARAMS` 에서 쓴 것과 같은 원칙
(「과소 제외는 기존 동작이지만 과다 제외는 정상 후보를 죽인다」).

🔴 `generateQueries`(8축)는 **한 줄도 바꾸지 않았다** — 벤치마크가 8축 전부를 쓴다.
운영용 Primary 만 새로 만들었고, `DiscoveryQuery.id` 계약을 지키려고 level 을
의미가 같은 축(`L1→Q6` · `L2→Q2` · `L3→Q1`)에 매핑하고 정확한 level 은 `axis` 에 실었다.

### 실제 변환 예

```
before  Booty Ghosts Long Sleeve T-Shirt by Bobo Choses        (Q1 · 8토큰 · 품번 없음)
after   Bobo Choses B226AC114                                  (L1 · 3토큰)

before  Holly Hearts Ribbed Velvet Baby Pants Pale Pink 2026 Sale
after   Louis Louise Holly Hearts Ribbed Velvet                (L2 · 노이즈 제거)
```

---

## 4. Prompt v2 — 적용 완료

🔴 v1 의 첫 줄은 **「최대한 많이 찾아 주세요」** 였고 「한국·해외 모두 포함」이었다.
그 지시가 **내부 검색어 확장을 부른다.**

v2 의 핵심 변경:

```
🟢 「최대 3개까지」 · 🔴 「반드시 3개가 아니다」
🔴 「확실한 후보가 없으면 **반환하지 마라**」
🟢 우선순위 5단 — 브랜드 → 모델코드/SKU → 고유 상품명/디자인 → 상품 상세 페이지 → 실제 판매정보
🔴 제외 8항 — 자기 자신 · URL 변형 · 카테고리/목록 · 검색결과 · 브랜드 메인 ·
   동일 브랜드의 «다른» 상품 · 단순 유사상품 · 무관 상품
🔴 「동일상품인지 **판정하지 마라** — 판정은 우리 시스템이 한다」
```

🔴 **STEP 6 유지** — Gemini 가 「Exact Match」라고 써도 그것을 사업 KPI 의 SAME 으로
인정하지 않는다. 판정은 `compareCrossSellerProducts` → `judgeDomesticCandidate` 다.

---

## 5. Cost Architecture — 🔴 보장과 비보장을 가른다

```
🟢 우리가 통제한다
   1 상품 = 1 API call = **1 Primary Query** = 최대 3 후보
   (+ Primary 를 만들 수 없으면 **호출하지 않는다** → `NO_PRIMARY_QUERY`)

🔴 통제하지 못한다
   1 Primary Query
        ↓  Gemini 내부
   N grounding queries   ← 실측 호출당 **5.5**
   🔴 `google_search` 인터페이스로 「무조건 1개」를 **보장할 수 없다**(CPO 정정).
      공식 문서가 한 요청에서 하나 이상의 검색어를 생성할 수 있다고 명시한다.
→ 그래서 목표는 「1회 강제」가 아니라 **N 을 최소화** 하고 **실측** 하는 것이다.
```

🟡 이번 변경이 N 을 줄일 **기대 근거**: Primary 가 짧고 식별자를 담으면 모델이
추가 검색어를 만들 이유가 줄어든다. 🔴🔴 **그러나 그것은 가설이고 미측정이다** —
Gemini HARD STOP 이라 이번 WU 에서 재지 않았다. 다음 실행에서
`groundingQueryTexts[]` 로 확인한다(아래 §9).

## 9. 다음 단계 — 🔴 **최소 probe 뿐이고 Billing 이 먼저다** (CPO 확정)

```
🔴 선행 조건  **Billing reconciliation 이 먼저** 다. 잔액 ₩3,300 은 보존 자산이다.
🔴 지금 10~15 상품을 돌리지 않는다.
승인 시 `MI-GEMINI-DISCOVERY-QUERY-VALIDATION-015` — **1~2 상품만**:
   1 API call / product · Primary Query 1개 · groundingQueryTexts **전체 기록** ·
   후보 최대 3 · 기존 MI 판정 · 실제 비용 확인
확인할 것 **딱 4개**:
   ① 기존 Query 대비 실제 grounding query 수가 줄었는가
   ② 불필요 후보가 줄었는가
   ③ MI 가 인정하는 후보가 늘었는가
   ④ **유효 후보 1개당 비용이 내려갔는가**
🟢 넷이 확인된 «뒤에» Children/Tennis 전체 표본으로 확대한다.
```

---

## 6. Measurement Schema — 구현 완료

`GeminiPoolMetrics` 에 추가된 칸:

```
primaryQuery            실제로 보낸 검색어 문자열
primaryQueryLevel       L1_MODEL_CODE | L2_BRAND_NAME | L3_NAME_ONLY
primaryQueryTokenCount  토큰 수
groundingQueries        개수 (과금 단위)
groundingQueryTexts[]   🔴🔴 **실제 검색어 문자열 전부**
```

🔴 `groundingQueryTexts[]` 가 핵심이다 — 개수만 세면 **무엇이 확장을 불렀는지**
볼 수 없다. 공식 응답 필드 `groundingMetadata.webSearchQueries[]` 를 그대로 싣는다.
🔴 그리고 **「grounding query 를 측정할 수 없다」는 전제는 폐기됐다.**

🔴 아직 보존하지 않는 것(§9 의 결정 항목 — 이번에 **하지 않았다**):
`requestedModel` ↔ `resolvedModel` ↔ `modelVersion` · `cachedContentTokenCount`.
🔴 비용 원인 규명이 끝난 뒤 진행한다(CPO 지시).

---

## 7. Tests — 19건 · 음성대조 4종

`packages/crawler/src/discovery-core/__tests__/mi-014-primary-query.test.ts`

```
① 품번 우선 — 색상·사이즈·마케팅이 섞이지 않는다 · 브랜드 없는 품번은 L1 아님
② 품번 없으면 브랜드+코어 2~4 · 브랜드 없으면 코어만(L3)
③ 코어 상한 4 — 5번째 이후 OVER_CAP
④~⑧ 제거 — 색상 · 사이즈 · 가격/할인 · 지역(Korea·직구·무료배송) ·
     시즌/연도(SS·FW·2026·26FW) · 마케팅
⑨ 🔴🔴 디자인 토큰 **보존** — Holly Hearts · Cherry Print · T Bar ·
     그리고 소재(Ribbed·Velvet)는 제거 목록에 **없다**
⑩ 빈 query 방지 — 브랜드만 / 전부 빈 값 / 노이즈만 → **UNAVAILABLE**
⑪ 브랜드 중복 제거
⑫ 식별력 — 품번 있으면 3토큰 · 노이즈 많은 상품명도 코어만 남는다
```

🟢 **음성 대조**(가드가 살아 있다는 증거):

```
정상                              19/19 PASS
① 품번 우선(L1) 제거              → **2 FAIL**
② denylist 비우기                 → **7 FAIL**
③ 코어 상한 제거                  → **2 FAIL**
④ 빈 query 방지 제거              → **3 FAIL**
원상복구                          19/19 PASS
```

### 🔴 기존 테스트 3건을 갱신했다 — **문구가 아니라 의도를 잠그게**

```
① `목록에만 한정하지 마세요` → 어미가 「마라」로 바뀌어 리터럴 단언이 깨졌다.
   🟢 `/목록에만 한정하지/` 정규식으로 바꿨다 — 다음 prompt 수정에 또 깨지지 않는다.
② `판단하지 마세요` → v2 는 「판정하지 마라」. `/판[단정]하지 마/` 로 바꿨다.
   🔴 의도: **Gemini 에 SAME 판정을 맡기지 않는다.**
③ `usage` shape → `groundingQueryTexts: []` 추가. 의도 그대로 — 「응답이 주지
   않으면 빈 값이다(지어내지 않는다)」.
④ 🔴 negative test 의 grounding 단언 **6 → 3** · 호출 **2 → 1**.
   🟢 이것은 **회귀가 아니라 WU-014 의 목적** 이다 — Primary 가 1개라 호출이 1회다.
   그 사실을 단언에 적고 `geminiCalls === 1` · `queriesUsed === 1` 도 같이 잠갔다.
```

---

## 8. Regression / Typecheck / Build / Guard

```
🟢 admin   **511 files / 7,614 tests passed** / 53 skipped · failed **0**
🟢 crawler Files 1 failed / **62 passed** / 19 skipped ·
           Tests **871 passed** / 23 skipped · 실패 «테스트» **0**
           🔴 그 1 파일은 선재 collection failure(match-truth-priority → `@/lib` alias)
🟢 typecheck 전 패키지 **10 = baseline 10**
🟢 guard     no-production-coupling **6/6**
🟢 build     exit 0 · Compiled successfully
```

---

## 성공 기준 점검 (§「014의 성공 기준」)

```
[상품] → [정확한 식별정보 추출]        🟢 brandModelCode / brand / coreTitle
      → [Primary Query 정확히 1개]     🟢 buildPrimaryQuery · 테스트로 잠김
      → [Gemini 1 API Call]           🟢 pool 이 1개만 만든다 · 못 만들면 호출 0
      → [최대 3 후보]                  🟢 maxCandidates 3 (호출부가 준다)
      → [기존 MI]                      🟢 withConfidence → judgeDomesticCandidate
```

🔴 **그리고 Gemini 내부 N 은 인정하고 최소화 방향으로 설계했다** — 강제 1회로
가정하지 않았고, 실제 `webSearchQueries[]` 를 보존해 다음 실행에서 측정한다.

## 이번 WU 준수 사항

```
🟢 Gemini API 호출 **0** · grounding 호출 **0** · AI Studio credit **0** · ₩3,300 보존
🟢 Registry 추가 0 · 가격추적 0 · MI threshold 0 · 모델 변경 0
🟢 merge 0 · deploy 0 · flag OFF 유지
🔴 「검색 결과 많이 찾기」·「Recall 최대화」·「검색어 여러 개」를 목표로 삼지 않았다
```
