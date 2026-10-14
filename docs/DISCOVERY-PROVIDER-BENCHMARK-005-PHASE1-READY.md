# WU-005 Phase 1 — Exa 실측 하니스 **준비 완료 / 호출 0**

> 🔴🔴 **Exa 를 호출하지 않았다.** 키가 없고, CPO 가 「계정/키가 준비되기 전에는 CTO가
> 호출하지 않습니다」라고 지시했다. 🔴 계정 생성·카드 등록도 하지 않았다.
> 🟢 **대신 키가 오는 즉시 한 번에 돌아가는 하니스를 완성하고, 측정 로직은 돈을 쓰기
> «전» 에 저장된 실제 후보 URL 로 검증했다.**
> 🔴 다른 provider 호출 0(Gemini·OpenAI·Perplexity·Brave·Mojeek) · Registry 저장 0 ·
> 가격 수집 0 · 판매판정 0 · UI 0 · Production 0 · 비용 ₩0 · Gemini 잔액 ₩3,171 보존.

---

## 1. 🟢 사전 검증 — 돈을 쓰기 전에 측정 로직이 맞는지 확인했다

```
판정기 셋을 저장된 «실제» 후보 URL 로 돌려 기대값을 글자로 박았다:
  bobochoses.com/products/b226ac010-…          → 품번 발견 **true**  · shape PRODUCT_PAGE
  global.trenbe.com/…-b226ac010-041-…          → 품번 발견 **true**  · market **UNKNOWN**
                                                  (🔴 `.com` + 등록부 밖 → 추측하지 않는다)
  m.web.mustit.co.kr/…/product_detail/126769866 → 품번 발견 **false**(URL 에 품번 없음)
                                                  · market KR(추정) · 근거 TLD(.kr)
자기참조 3건 전부 false · 분모 **6건** 을 단언으로 잠갔다(20건이 섞이면 깨진다)
```

### 🟢 실제로 나갈 질의 6개 (운영 `buildPrimaryQuery` 산출물 그대로 · 변형 0)

| 브랜드 | 품번 | level | 질의 |
|---|---|---|---|
| Bobo Choses | B226AC010 | L1_MODEL_CODE | `Bobo Choses B226AC010` |
| Pèpè Shoes | 01195-VERNICE-NERO | L1_MODEL_CODE | `Pèpè Shoes 01195-VERNICE-NERO` |
| Misha & Puff Fall 26 Drop 2 | B1408F26-670 | L1_MODEL_CODE | `Misha & Puff Fall 26 Drop 2 B1408F26-670` |
| Bobo Choses | B226AC035 | L1_MODEL_CODE | `Bobo Choses B226AC035` |
| Bobo Choses | B126AC050 | L1_MODEL_CODE | `Bobo Choses B126AC050` |
| Bobo Choses | B226AC058 | L1_MODEL_CODE | `Bobo Choses B226AC058` |

🟢 **6/6 이 `L1_MODEL_CODE`(브랜드+품번)** 다 — WU-014 가 의도한 모양이 그대로 나간다.

### 🔴 그 과정에서 내 실수 하나를 잡았다

```
처음에 `buildPrimaryQuery(dna)` 로 **DNA 를 그대로** 넘겼다 → 질의가 **빈 문자열** 이었다.
🔴 그 함수는 `ProductIdentity` 를 받고 DNA 와 **칸 이름이 다르다.** `as never` 가 그것을 가렸다.
🟢 운영에 이미 변환기가 있었다 — `identityFromDna`(gemini-candidate-pool.ts:185).
   **그것을 export 해서 그대로 썼다**(로직 복제 0 · 운영 동작 변경 0).
🔴 이 트랙에서 반복되는 같은 계열 실수다(메모 `measure-with-the-production-function`).
🟢🟢 그래서 **키가 오기 «전» 에 이 버그가 드러났다** — 키가 있었다면 12 요청을 빈 질의로
   태우고 「Exa 가 못 찾는다」는 **완전히 틀린 결론** 을 냈을 것이다.
```

---

## 2. 하니스 사양 (CPO §A~§D 그대로)

```
게이트    `EXA_API_KEY` **그리고** `MI_P0_02_EXA=1` — 🔴 **둘 다** 있어야 호출한다
          (키만 있어도 돌지 않는다 · 회귀에서 돈이 새지 않는다)
대상      품번 보유 **6건** 만 — 🔴 품번 없는 20건은 **섞지 않는다**
질의      `buildPrimaryQuery` 산출물 **그대로** · 변형 0
요청      상품 1건 = **1 요청** · `numResults: 10` · `type: "instant"` · **재시도 0**
ARM A     도메인 제한 **없음**
ARM B     `includeDomains` = 우리 등록부 도메인
          🔴 두 ARM 을 **합쳐 평가하지 않는다**(별 표로 집계)
총 호출   **12** — 🔴 단언으로 잠갔다(`expect(calls).toBe(12)`)
```

### 후보별로 기록하는 것 (CPO §C 전부)

`rank` · `rawUrl` · `normalizedUrl` · `domain` · `shape`/`isProductDetail` ·
**품번 발견**(`confirmBrandCodeInEvidence` 결과 포함) · `market`+`marketBasis` ·
`selfReference` · `publishedDate` · `title` · **Gemini 와 URL 중복** ·
그리고 요청 단위로 `httpStatus` · `requestId` · **`costDollars.total`** · `searchTime` · `latencyMs`

### 🟢 판정기를 새로 만들지 않았다 (CPO §D)

```
품번 발견     confirmBrandCodeInEvidence   WU-004 운영 함수 그대로
상품 상세     classifyUrlShape             기존 함수
              🔴 값은 `PRODUCT_PAGE` 다 — 추측하지 않고 **타입에서 읽었다**
URL 정규화    normalizeCandidateUrl        기존 함수
자기참조      isSelfReferenceCandidate     008A 정책 그대로
DNA→Identity  identityFromDna              운영 함수 그대로(export 만 추가)
```

---

## 3. 🟢🟢 비용은 **추정하지 않는다**

```
Exa 응답 top-level 에 `costDollars { total, search, contents }` 가 온다(공식 문서 확인).
→ 🟢 **상품당 비용을 응답 실측값으로** 적는다. 🔴 단가 × 요청수 추정이 아니다.
🔴 그리고 그 합계가 무료 크레딧($10/월)을 넘기지 않는지도 그 값으로 확인한다.
```

---

## 4. KPI — CPO 지정 8개를 그대로 집계한다

`Code Hit Rate` · `Top-1 / Top-3 / Top-10 Hit` · `Product Detail Rate` ·
`KR Candidate Rate(추정)` · `Overseas Candidate Rate(추정)` · **`UNKNOWN market`** ·
`Self-reference Rate` · **`Gemini 와 URL 중복`**(provider ensemble 가능성) ·
`cost 합계(응답 실측)`

🔴 **국내/해외는 「추정」으로 적는다** — 가격이 없어 통화 증거가 없고, WU-020 의
`classifyCandidateMarket` 은 통화를 **요구** 한다(없으면 UNKNOWN). 그래서 Discovery
단계에서는 TLD·등록부 기반 **추정** 이고, 그 사실을 KPI 이름에 넣었다.
🔴 `Recall`/`Precision` 은 **집계하지 않는다** — 라벨이 없다(CPO 도 Phase 1 에서 제외했다).

---

## 5. 🟡 CEO 가 해 주실 것 — **하나뿐이고 결제가 없다**

```
① https://exa.ai 에서 계정 생성
② 대시보드에서 **API Key** 발급
③ 🔴 그 키를 대화로 보내지 **마십시오.** repo 의 다음 파일에 한 줄만 추가하면 된다:
     scripts/.env   →   EXA_API_KEY=<키>
   🟢 그 파일은 커밋되지 않는다(GEMINI_API_KEY 도 같은 자리에 있다)

🔴 **하지 않아도 되는 것 / 하지 말아야 하는 것**
   ❌ 신용카드 등록      — Exa 공식 문서: "**No payment method required.**"
   ❌ 유료 플랜 전환     — 무료 **$10 크레딧**(매월 1일 리셋)으로 충분하다
   ❌ 조직/사업자 정보   — 요구하지 않는다
   ❌ 다른 provider 가입 — Brave·Perplexity·Mojeek 은 **이번에 필요 없다**
```

🟢 **키가 들어오면 CTO 가 한 줄로 실행한다**:
```
cd apps/admin && MI_P0_02_EXA=1 npx vitest run \
  src/app/api/price-history/_lib/__tests__/mi-005-p1-exa-benchmark.test.ts
```
🟢 예상 소모는 **12 요청**(무료 $10 ≈ instant 2,500회 기준 **0.5% 미만**)이고,
   실제 차감은 응답의 `costDollars` 로 보고한다.

---

## 6. 검증 (이 커밋 기준)

```
🟢 admin 전수  Test Files **520 passed** / 50 skipped · Tests **7,713 passed** · FAIL **0**
🟢 typecheck   **10** (baseline 10) · build `Compiled successfully` exit 0
🟢 회귀 로그에 `api.exa.ai` 문자열 **0건** → 실측 테스트가 **SKIP** 됐다(호출 0 증거)
🟢 운영 변경은 **`export` 한 단어**(identityFromDna) 뿐 — 로직·동작 변경 0
🔴 Gemini flag **OFF**(env 0건) · 잔액 **₩3,171 보존**
```

---

## 7. 🔴 Phase 1 결과를 받을 때 미리 알아야 할 것

```
🔴 6건은 **품번 보유 상품** 이다. Code Hit Rate 가 높아도 그것은
   「**강한 식별자가 있는 상품** 을 provider 가 잘 찾는다」는 뜻이고
   **전체 동일상품 Recall 이 아니다**(CPO 가 판정에서 고정한 해석).
🔴 품번 없는 **20/26 은 이 Phase 가 답하지 않는다.**
🔴 Exa 가 잘 찾아도 **바로 채택하지 않는다**(CPO) — 다음 실측 순서는 CPO 가 정한다.
🔴 그리고 Exa 의 **상업적 사용 조항은 「불명확」** 으로 남아 있다(금지 문구도 없다) —
   채택 단계에서 확인이 필요하다.
🔴 `type: "instant"` 로 고정했다 — 모드(`fast`/`auto`/`deep`) 비교는 **이 WU 범위가 아니다.**
```
