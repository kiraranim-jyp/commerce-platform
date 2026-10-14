# WU-006 — Anthropic Web Research **Controlled Benchmark** · 하니스 준비 완료 / **호출 0**

> 🔴🔴 **Anthropic 을 호출하지 않았다.** 키가 **없고**(env 전수 확인), CPO 가
> 「실제 키·계정·결제가 필요한 경우에는 실측 직전에 CEO 에게 필요한 최소 조치만
> 별도로 보고하고, **임의로 결제하거나 계정을 만들지 않습니다**」라고 지시했다.
> 🟢 **대신 키가 오는 즉시 한 번에 돌아가는 하니스를 완성하고, 측정 로직을 돈을 쓰기
> «전» 에 검증했다**(사전검증 3건 PASS · 음성 대조 1건 FAIL→복구).
>
> 🔴 Gemini 호출 **0** · Exa 0 · OpenAI 0 · Perplexity 0 · 계정 생성 0 · 카드 등록 0 ·
> 결제 0 · Registry 저장 0 · 가격 수집 0 · 판매판정 0 · UI 0 · Production 0 ·
> Gemini flag **OFF** · 잔액 **₩3,171 보존**.

---

## 0. 🔴 CPO 정정 둘을 먼저 기록한다 (이 문서가 그 기록이다)

```
① Anthropic 판정을 🟢 GO → 🟡 **CONDITIONAL GO** 로 내린다.
   🔴 「Output ownership = GO」 와 「우리 Registry 에 Discovery 결과를 **장기 저장·
      가격추적 자산** 으로 쓸 권리 = GO」는 **같지 않다.** 후자는 미확정이다.
   🟢 그래서 이 WU 의 하니스는 결과를 **transient JSON 파일** 로만 남기고
      Registry 에 **한 행도** 쓰지 않는다.

② 🟢🟢 이번 트랙의 진짜 발견은 「검색 결과를 AI 가 JSON 으로 만들어 준다」가 아니라
   **「AI 가 실제 Web Research 를 수행하고 원본 source URL 을 반환한다」** 다.
   🔴🔴 그래서 승격된 원칙 — **이 문장을 그대로 유지한다**:
     「AI 가 만들어낸 URL 문자열을 그대로 믿지 않는다.
       URL 은 Discovery signal 이고, Evidence 는 따져가 직접 검증한다.」

③ 비용 정책: **유료 API 는 마지막 fallback** 이다.
```

🟢 **②를 코드로 구현했고 음성 대조로 잠갔다** — 아래 §4-①-2.

---

## 1. 🔴 먼저 확인한 사실 — **키가 없다. 그래서 호출할 수 없다**

값은 출력하지 않고 **이름만** 확인했다:

```
scripts/.env             GEMINI_API_KEY                 ← 🔴 그것 하나뿐
packages/database/.env   DATABASE_URL · DIRECT_URL
apps/admin/.env.local    QA_PROXY_TO_PROD · OCI_PROXY_URL
Production(vercel env ls) OUTBOUND_PROXY · GEMINI_API_KEY · COMMERCE_REGISTRATION_WORKSPACE_IDS ·
                          NAVER_* · OCI_PROXY_URL · DEBUG_NAVER_PROBE_TOKEN · SMARTSTORE_CLIENT_ID
→ 🔴 `ANTHROPIC_API_KEY` **0건** (`.env*` 전수 grep 0)
```

---

## 2. 🟢 공식 규격을 1차 자료로 확정했다 (추측 0 · 호출 0)

🔴 이 표는 **공식 문서에서 읽은 것** 이고 내 추정이 아니다. 하니스가 이 값을 그대로 쓴다.

### `web_search`

| 항목 | 확정값 |
|---|---|
| tool type | `web_search_20250305`(basic) · `_20260209`(dynamic filtering) · `_20260318`(+response inclusion) |
| 필수 헤더 | `anthropic-version: 2023-06-01` · 🟢 **beta 헤더 불필요**(GA) |
| 상한 | `max_uses` — 초과 시 결과가 `max_uses_exceeded` **오류** 로 온다 |
| 도메인 통제 | `allowed_domains` **또는** `blocked_domains` — 🔴 **둘을 같이 보내면 400** |
| 과금 단위 | `usage.server_tool_use.web_search_requests` |
| 단가 | **$10 / 1,000 searches** + 검색 결과가 만든 **토큰** |
| 🟢 실패 과금 | 「**If an error occurs during web search, the web search will not be billed.**」 |
| 오류 전달 | 🔴 HTTP **200** 으로 오고 본문에 `web_search_tool_result_error` 가 들어온다 |
| 결과 필드 | `url` · `title` · `page_age` · `encrypted_content` |
| 인용 | 🔴 **항상 켜져 있다**(끌 수 없다) · `cited_text` 최대 150자 · 🟢 인용 필드는 토큰에 포함되지 않는다 |
| 조직 설정 | 🔴 Console 에서 관리자가 **끌 수 있다** — 꺼져 있으면 요청이 400 으로 실패한다 |

### `web_fetch`

| 항목 | 확정값 |
|---|---|
| tool type | `web_fetch_20250910`(basic) · `_20260209` · `_20260309`(+`use_cache`) · `_20260318` |
| 🟢 과금 | **no additional cost** — 🔴 단 가져온 내용이 **input 토큰** 이 된다 |
| 토큰 상한 | `max_content_tokens`(근사치) · 공식 환산 예: 10 kB ≈ 2,500 토큰 |
| 🔴🔴 URL 제약 | **대화에 이미 등장한 URL 만** fetch 할 수 있다 — 「Claude 자신의 출력에만 등장한 URL」은 **금지**(`url_not_in_prior_context`) |
| 인용 | 기본 **꺼짐** — `citations:{enabled:true}` 로 켠다 |
| 상한 | `max_uses` — 🔴 **기본 상한이 없다**(안 넣으면 무제한) · 실패도 상한에 포함 |
| 🔴 JS 렌더 | 「does **not** support websites dynamically rendered with JavaScript」 |

🟢🟢 **URL 제약이 우리 설계와 정확히 맞는다** — Claude 가 지어낸 URL 은 **제품이 fetch 자체를
거부한다.** 즉 CPO 가 승격한 원칙이 **provider 쪽에서도 한 겹 더** 지켜진다.

🔴 **그러나 JS 렌더 미지원이 중요하다** — 국내 샵 상당수가 JS 렌더다. 🟢 그래서
**Evidence 수집을 AI 에게 맡기지 않는 것이 맞다**(따져의 Playwright 경로가 이미 있다).

---

## 3. 하니스 사양 — 호출 상한을 **코드에 박았다**

```
파일   apps/admin/src/app/api/price-history/_lib/__tests__/
       mi-006-anthropic-research-benchmark.test.ts
게이트 `ANTHROPIC_API_KEY` **그리고** `MI_P0_02_ANTHROPIC=1` — 🔴 둘 다 없으면 SKIP
       (키만 있어도 돌지 않는다 · 회귀에서 돈이 새지 않는다)
대상   품번 보유 **6건** 만 — 🔴 품번 없는 20건은 섞지 않는다(CPO)
질의   운영 `buildPrimaryQuery ∘ identityFromDna` 산출물 **그대로** · 변형 0
요청   상품 1건 = **1 요청** · **재시도 0**
상한   web_search `max_uses: 3` · web_fetch `max_uses: 2` · `max_content_tokens: 8,000`
       → 🔴 상품 6건의 **검색 최대 18회**(= 공식 단가로 $0.18) · 단언으로 잠갔다
모델   `claude-sonnet-5`(기본) — 🔴 env 로 바꿀 수 있고 **응답의 `model` 을 그대로 기록** 한다
       (별칭이 움직였는지 사후에 알 수 있게 — Gemini 에서 그걸 못 해 비용 원인을 놓쳤다)
결과   transient JSON 파일 1개. 🔴 Registry 저장 0 · DB 쓰기 0
```

### 🔴 상한을 «왜» 파라미터로 박았는가

Gemini 에서 「상한을 **배열 길이가** 지키고 **파라미터가 지키지 않는** 」 상태를 실측했고
(헌장 §12), 그래서 조용히 2 call 이 될 수 있었다. 🟢 여기서는 상한이 **provider 가
강제하는 파라미터**(`max_uses`)이고, 넘으면 Anthropic 이 `max_uses_exceeded` 로 막는다.

---

## 4. 🟢 돈을 쓰기 «전» 에 검증한 것 (호출 0 · 비용 $0)

### ①-1 판정기 전수 — 저장된 **실제** 후보 URL 로 돌렸다

```
bobochoses.com/products/b226ac010-…          → 품번 발견 **true**  · shape PRODUCT_PAGE
global.trenbe.com/…-b226ac010-041-…          → 품번 발견 **true**  · market **UNKNOWN**
                                                (🔴 `.com` + 등록부 밖 → 추측하지 않는다)
m.web.mustit.co.kr/…/product_detail/126769866 → 품번 발견 **false** · market KR(추정)
자기참조 3/3 false · 분모 **6건** 단언 · 🟢 **6/6 이 `L1_MODEL_CODE`**
```

### ①-2 🔴🔴 음성 대조 — **산문에만 있는 URL 은 후보가 되지 않는다**

CPO 가 승격한 원칙을 **테스트로 잠갔다.** 공식 응답 구조를 그대로 쓴 fixture 의
`text` 블록에 **실재하지 않는 URL**(`totally-made-up-shop.example/...`)을 심었다.

```
🟢 정상 코드   후보 **2건**(검색결과 블록의 URL 만) · 지어낸 URL **없음** ·
               「산문에만 있던 URL」 **1건으로 카운트만** 된다
🔴 변형(M1)    harvest 가 산문 URL 도 후보에 넣게 바꾸자 → **FAIL**
               `expected [ …(3) ] to have a length of 2 but got 3`
🟢 원상복구     3 passed
```

🔴 그리고 **「돌았다」와 「성공했다」를 가른다** — fixture 에 `web_fetch_tool_result_error`
(`url_not_accessible`)를 넣어 **도구 오류가 집계에 남는다**는 것까지 단언했다.
(Gemini 트랙에서 「후보가 나왔다」를 통과로 써서 측정을 무효화한 전례 때문이다 — 헌장 §5-B)

### ①-3 🔴 요청 본문이 상한을 들고 있는지 단언

tool type 2개 · `max_uses` 2개 · 🔴 `allowed_domains`+`blocked_domains` 동시 금지 ·
프롬프트에 **「판정하지 마라」·「환산하지 마라」** 가 들어 있는지까지 단언했다.

---

## 5. 측정 13개 — 배선만 했고 **실행하지 않았다**

```
①  Top-1 Hit(품번)            ②  Top-3 Hit            ③  Top-10 Hit
④  🔴🔴 Code Hit Rate(상품 단위)                       ⑤  Product Detail Rate
⑥  KR Candidate Rate(추정)    ⑦  Overseas Rate(추정)   ⑧  🔴 UNKNOWN market
⑨  Self-reference Rate        ⑩  🟢 Gemini 와 URL 중복(provider ensemble 가능성)
⑪  호출 수 / **web_search_requests** / web_fetch_requests
⑫  토큰(input·output·cache_read 실측)                  ⑬  🔴 실패율
보조 — 상품당 후보 수 · 🔴 **산문에만 있던 URL 합계**(환각 관측값) · 도구 오류 합계 ·
      🟢 **AI 내부 검색어 전문**(Gemini 의 groundingQueryTexts 대응) · AI 가 fetch 한 URL
```

🔴🔴 **「AI 가 SAME 이라고 말했는지」는 KPI 에 없다**(CPO 명시). 동일상품 판정은
WU-004/WU-020 계층이 한다. 그래서 하니스는 Claude 의 **문장을 채점하지 않고**,
검색결과 URL 을 **우리 판정기에 넣은 결과만** 센다.

🔴 **국내/해외는 「추정」으로 적는다** — 가격이 없어 통화 증거가 없고 `classifyCandidateMarket`
(WU-020)은 통화를 **요구** 한다. 🔴 `Recall`/`Precision` 은 라벨이 없어 **집계하지 않는다**.
🔴 원화 환산도 하지 않는다 — 과금 원장을 CTO 가 읽을 수 없다(§5-B 측정불가).

---

## 6. 🟡 실측을 열려면 필요한 **최소 조치** — 🔴 이것은 **비용 결정이다**

🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(헌장 §3). CPO 에게 보고한다.

```
① Anthropic Console 계정 + **API Key** 발급
② 🔴🔴 **선불 크레딧 구매가 필요한지 확인** — 🔴 나는 확인할 수 없다
   (Billing 화면은 CTO 범위 밖이다 · Gemini 에서도 같은 한계였다)
   🟢 확실한 것은 **이번 측정이 쓰는 양** 이다:
       web_search 최대 **18회** = 공식 단가로 **$0.18**
       web_fetch  최대 12회 = **추가 과금 $0** (토큰만)
       토큰 = 6 요청 × (검색결과 + 최대 8,000 토큰 fetch 2회) → 🔴 **실측으로만 확정**
   🔴 즉 **측정 자체의 비용은 매우 작지만, 최소 충전 단위가 그보다 클 수 있다.**
      그 차액이 곧 CEO 승인 대상이다.
③ 관리자 설정 확인 — Console 에서 **web search 가 켜져 있어야** 한다
   (꺼져 있으면 요청이 400 으로 실패한다 · 공식 문서)
④ 키를 **대화로 보내지 않는다.** `scripts/.env` 에 한 줄만 추가하면 된다:
       ANTHROPIC_API_KEY=<키>
   🟢 그 파일은 커밋되지 않는다(`.gitignore:20` `.env*` · GEMINI_API_KEY 와 같은 자리)
```

🟢 **키가 들어오면 CTO 가 한 줄로 실행한다**:

```
cd apps/admin && MI_P0_02_ANTHROPIC=1 npx vitest run \
  src/app/api/price-history/_lib/__tests__/mi-006-anthropic-research-benchmark.test.ts
```

🔴 **하지 않아도 되는 것** — 다른 provider 가입(Exa·Brave·Perplexity·OpenAI) ·
Gemini 재충전 · Production 배포 · flag 변경. **전부 이번에 불필요하다.**

---

## 7. 🔴 결과를 받을 때 미리 알아야 할 해석 제약

```
🔴 6건은 **품번 보유 상품** 이다. Code Hit Rate 가 높아도 그것은 「**강한 식별자가 있는
   상품** 을 AI 가 잘 찾는다」는 뜻이고 **전체 동일상품 Recall 이 아니다.**
🔴 품번 없는 **20/26 은 이 측정이 답하지 않는다.**
🔴 Gemini 의 1-call 실측(N=1)과 **직접 비교하지 않는다** — 분모·조건·상한이 다르다.
🔴 「Anthropic 이 잘 찾았다」가 곧 **채택** 이 아니다 — CPO 가 정정한 대로 저장 권리
   (Registry 장기 보관 · 가격추적)는 **별도 확인 사안** 이다.
🔴 web_fetch 가 JS 렌더 사이트를 못 읽는다 — 그래서 가격·품번 **Evidence 는 여전히
   따져가 직접** 가져온다. 이 측정은 **Discovery(URL 발견)** 만 잰다.
🔴 실패가 나면 **즉시 개발 WU 로 전환하지 않는다** — FAIL 지점·실제 입출력·원인까지만
   보고하고 CPO 가 분류한다(헌장).
```

---

## 8. 검증 (이 커밋 기준)

```
🟢 WU-006 하니스    사전검증 **3 passed** / 실측 arm **1 skipped**(키 없음 = 호출 0 증거)
🟢 음성 대조 M1     FAIL 확인 → 원상복구 3 passed
🟢 admin 전수       (§회귀 결과 본문 참조)
🔴 Gemini flag OFF(env 0건) · 잔액 ₩3,171 보존 · Production 변경 0
🟢 운영 코드 변경 **0** — 추가된 것은 **테스트 파일 1개와 문서** 뿐이다
```
