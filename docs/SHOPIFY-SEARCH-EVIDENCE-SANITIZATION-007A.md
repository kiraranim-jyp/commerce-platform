# WU-007A — Shopify Search URL **Evidence Sanitization** · 🟢 FP 28/28 → **0**

> 🔴 **검색어가 상품 Evidence 로 재활용되는 False Positive 를 제거했다.**
> 🔴 threshold 변경 **0** · Identity 규칙 완화 **0** · 품번 질의 삭제 **0** ·
> provider 변경 **0** · AI/외부 API **0** · Gemini **0** · Registry schema **0** ·
> DB 쓰기 **0** · Production 배포 **0** · Gemini flag **OFF** · 잔액 **₩3,171 보존**.
> 🟢 운영 변경은 **파일 1개 · 로직 1줄 + 순수 함수 1개** 다.

---

## 1. 무엇이 문제였나 (WU-007 실측)

```
buildCrossSellerSearchQueries(product-identity-dna.ts:432) 의 **1번 질의 = 품번 단독**
  → Shopify Predictive Search 가 응답 URL 에 **그 질의를 되돌려 넣는다**
      /products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_ss=sc
                                           └──── 우리 질의 ────┘
  → match.ts:514 · attach-match-truth.ts:124·143 이 그 URL 을 건초더미로 쓴다
  → 「우리가 물어본 품번」이 「상대가 가진 품번」이 된다 → MODEL_CODE 축 **exact**
  → matchTruth EXACT/STRONG → priceTierFromLink **EXACT**
  → 🔴 **전혀 다른 상품(기프트백)의 가격이 국내 최저가·판매판정에 들어간다**
```

🔴 이것은 정확도 문제가 아니라 **가격판정 무결성** 문제다(CPO 판정).

---

## 2. 고친 것 — **한 곳**

🔴 호출부 2곳을 각각 고치지 **않았다.** 두 호출부의 주석이 명시한다 — 「**같은 건초더미**를
본다. 둘이 갈라지면 화면과 저장이 다른 판정을 낸다」. 그래서 **둘이 공유하는 함수 안** 에서
고쳤다.

`packages/crawler/src/comparison-search/domestic-identifiers.ts`
```ts
// 신규 순수 함수
export function stripSearchContextFromUrl(raw: string): string   // 검색 문맥 파라미터만 제거

// confirmBrandCodeInEvidence 안 — 바뀐 로직은 이 1줄이다
const urlHaystack = fields.url ? stripSearchContextFromUrl(fields.url) : null;
for (const haystack of [fields.title, urlHaystack, fields.sku]) { … }
```

### 🟢 이것은 **새 정책이 아니다** — 리포가 이미 적어 뒀다

`self-reference.ts:63-67` 원문:
> 「Shopify 는 검색/컬렉션 문맥을 `_pos` `_psq` `_ss` `_v` `_fid` 처럼 밑줄로 시작하는
>  파라미터에 싣는다 — **전부 listing 을 가리지 못한다**」

🟢 즉 「`_psq` 는 우리 검색 문맥이고 페이지의 신원이 아니다」는 **확정된 제품 정책** 이고,
이 WU 는 그것을 식별 증거 경로에도 **일관되게 적용** 한 것이다.

### 🔴🔴 쿼리 «전체» 를 버리지 않았다 — 그 이유가 실측에 있다

```
?variant=40096037535807   Shopify 변형 id (리포 테스트에 실재)
?product_no=8021&cate_no=6  Cafe24 (운영 링크에 실재)
?branduid=10226592          메이크샵 (운영 링크에 실재)
🔴 쿼리를 통째로 버리면 위 식별 정보까지 사라진다 → **검색 문맥 파라미터만** 걷어낸다.
```

제거 대상:
```
① 🟢 **측정된 원인** — 이름이 `_` 로 시작하는 파라미터(Shopify 문맥: `_psq` `_pos` `_ss` …)
② 🟡 **예방** — 검색어 파라미터 이름 `q · query · keyword · keywords · search ·
   searchword · sq · term · s`
   근거: `buildCrossSellerSearchQueries` 가 **모든 어댑터에** 품번을 질의로 던지므로,
   검색어를 URL 에 남기는 플랫폼이면 **같은 FP** 가 난다.
   🔴 「측정됨」과 「예방」을 **섞어서 적지 않는다**(②는 이 표본에서 발화하지 않았다).
🟢 `search` 는 이미 self-reference.ts 의 `NON_IDENTIFYING_PARAMS` 에도 있다(메이크샵).
🔴 보존 — 그 밖의 모든 파라미터. 상대 경로·fragment·잘못 인코딩된 이름도 처리한다.
```

---

## 3. 측정 — CPO 지정 표

| 지표 | Before | 결과 |
|---|---:|---|
| Raw Code Hit (WU-007 날것) | 5/6 = **83%** | 🟢 git 이력(`2fcff3fd`)에 보존 · 재현 가능 |
| **FP** | **27/27 = 100%** | 🟢 **0 / 28** (fixture 전건) |
| 실제 상품 URL 의 품번 | 보호해야 함 | 🟢 **유지**(handle 품번 TRUE) |
| 기존 Identity verdict | baseline | 🟢 **변화 없음** — 회귀 전건 통과 |
| 가격 승격 | baseline | 🟢 FP 경로 차단(MODEL_CODE 축이 더는 거짓 exact 를 못 만든다) |

🔴 **fixture 는 날조가 아니다** — WU-007 에서 `bobochoses.com/search/suggest.json` 이
**실제로 돌려준** URL·제목 28건 그대로다(메모 `fixtures-must-be-dirty`).
🟢 그 28건 중 **품번이 상품 handle 에 있는 것은 0건** → **진짜 양성이 섞여 있지 않다**.

### 🔴 「고쳤으니 0」만 단언하지 않았다
테스트 ①이 먼저 **입력 성질** 을 못박는다 — 「품번이 URL **쿼리에만** 있고 경로에는 없다」.
그래서 **수정 전에는 전건 매칭됐을 입력** 이라는 것이 테스트 안에서 증명된다.

---

## 4. Positive / Negative / Mutation

### CPO 지정 필수 케이스 셋 (전부 통과)
```
Negative  `_psq` 에만 품번 · path/handle 에 없음                   → **FALSE** 🟢
Positive  실제 handle 에 품번 + `_psq` 도 있음                      → **TRUE**  🟢
Negative  `_psq` 에 **다른 상품의** 품번만 있음                      → **FALSE** 🟢
```

### 과잉 수정 방지 (CPO 보호조건)
```
🟢 variant / product_no / branduid 는 **보존** 된다
🟢 식별 파라미터에 적힌 품번(`?sku=B226AC010`)은 증거로 **살아 있다**
🟢 혼합 쿼리에서 **검색 문맥만** 골라 제거한다
🟢 `confirmBrandCodeInTitle` 은 **한 줄도 바꾸지 않았다**(제목 경로 불변)
```

### 🔴 음성 대조 3종 — 전부 FAIL 후 원상복구
```
M1 소독기 호출 제거                         → **3 FAIL**
M2 쿼리 «전체» 삭제(과잉 수정)               → **3 FAIL** (보호조건 테스트가 잡았다)
M3 밑줄 규칙 제거(`_psq` 를 남긴다)          → **5 FAIL**
원상복구 → **10 passed** · 소스에 `MUTATION` 문자열 **0건**
```
🟢 M2 가 중요하다 — **「더 많이 지우는」 잘못된 수정도 테스트가 막는다.**

### 🟢 WU-007 하니스 ①-4 가 **뒤집혔다** — 그것이 수정의 증거다
WU-007 에서 그 단언은 `toBe(code)`(거짓 양성 고정)였다. WU-007A 에서 `toBeNull()` 로
바꿨고, 같은 자리에 「입력에는 여전히 품번 문자열이 있다」와 「진짜 양성은 TRUE」를 같이 뒀다.
🔴 쿠팡 고시 FAIL 고정과 같은 방식이다.

---

## 5. 🔴 하지 않은 것 (CPO 금지 전수 대조)

```
threshold 변경        ❌ 없음 — 비교 함수·문턱을 한 글자도 안 바꿨다
Identity 규칙 완화    ❌ 없음 — 바뀐 것은 **건초더미** 뿐이고 판정 규칙은 그대로다
                         🟢 방향도 «완화» 가 아니라 **엄격화** 다(거짓 증거 제거)
품번 검색어 삭제      ❌ 없음 — `buildCrossSellerSearchQueries` 무변경(1번 질의 유지)
새 AI/API             ❌ 호출 0 · 키 0 · 결제 0
Gemini                ❌ flag OFF · 잔액 ₩3,171 보존
Registry schema       ❌ 없음 · DB 쓰기 0
Production 배포       ❌ 없음
provider 변경         ❌ 없음 — Shopify 어댑터(`searchShopifySuggest`)도 무변경
```

🔴 **어댑터를 고치지 않은 이유** — `candidate.url` 은 상세 fetch·저장·화면에도 쓰인다.
거기서 쿼리를 떼면 영향 범위가 식별 밖으로 넓어진다. 🟢 **식별 증거를 읽는 자리에서만**
무시하는 것이 최소 변경이다.

🔴 **남은 교환 하나(미측정)** — 검색어 파라미터 이름에 **진짜** 품번을 싣는 샵이 있으면 그
증거는 사라진다. 🟢 단 그 이름들은 정의상 검색어 칸이고, 운영에서 실제로 관측된 식별
파라미터(`product_no`·`branduid`·`variant`)는 **보존** 된다.

---

## 6. 검증

```
WU-007A 테스트   **10 passed** (fixture 28건 + CPO 3종 + 보호조건 6종)
음성 대조        M1 3 FAIL · M2 3 FAIL · M3 5 FAIL → 원상복구 10 passed
🟢 실제 경로 재측정(무키 HTTP 58 · 비용 ₩0 · AI 0) — 수정 후:
     후보 총수 27 · 품번 확인 후보(정규화) **0** · 품번 확인 후보(**날것 입력**) **0** ·
     🟢 잔존 FP **0** · Code Hit Rate **0/6 = 0%**(진짜 값)
   🔴 즉 어댑터가 날것 URL 을 그대로 넘겨도 **우리 질의가 증거가 되지 않는다.**
회귀 admin       **523 files / 7,730 passed · failed 0** (기존 verdict 변화 없음)
typecheck        **10 = baseline** · build **exit 0**
운영 변경        domestic-identifiers.ts **+77 / -1** (대부분 주석) · 그 외 운영 파일 0
🔴 Production 배포 **0** — `main` push 는 배포를 부르므로 **브랜치로** 밀었다
   (헌장 §8 · 메모 `vercel-deploy-from-repo-root` 의 「push 승인 · 배포 보류」 분리법)
```
