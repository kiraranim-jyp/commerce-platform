# WU-005 Phase 0 — Discovery Provider Capability + Benchmark 설계

> 🔴 **외부 API 호출 0 · API 키 발급 0 · 계정 생성 0 · 카드 등록 0 · 비용 ₩0 ·
> 코드 변경 0 · Production 변경 0 · flag OFF 유지.**
> 🟢 공식 문서만 읽었다. 🔴 3자 블로그 수치는 전부 「불명확」으로 표시했다.
> 🔴🔴 **그리고 내 이전 보고 한 줄을 정정한다** — §6.

---

## 1. Capability Matrix — 우리 Discovery 에 필요한 축만

| 축 | **Gemini** Grounding | **OpenAI** `web_search` | **Perplexity** Search | **Exa** | **Brave** | **Mojeek** |
|---|---|---|---|---|---|---|
| **원본 URL** | 🔴🔴 **리다이렉트** (`vertexaisearch.cloud.google.com/...`) · `title` 에 **도메인**이 온다 | 🟡 불명확(프록시 언급 0) | 🟢 **원본** | 🟡 불명확 | 🟢 원본 | 🟢 원본 |
| snippet / date | 🔴 **둘 다 없음** | 🔴 미문서화 | 🟢 둘 다 | 🟢 date | 🟢🟢 최다(+`extra_snippets`) | 🟢 desc·pdate |
| 결과 수 | 🔴 불명확 | 🔴 **보장 안 함**(공식 명시) | 10/최대 20 | 10/**최대 100** | 20/최대 20 | 10/상한 불명확 |
| **도메인 제한** | 🔴🔴 **Developer API 에 없음**(Vertex 는 exclude 전용) | 🟢 allow/block **각 100** · 서브도메인 자동 | 🟢 **20** · path 매칭 · 🔴 include/exclude **동시 불가** | 🟢🟢 **1,200** · **와일드카드** | 🔴 **전용 파라미터 없음**(`site:` 가 자칭 experimental) | 🟢 `fi`/`fe` **각 25** |
| pagination | 🔴 없음 | 🔴 없음 | 🔴 없음 | 🔴 **공식 명시로 없음** | 🟢 `offset` 9(→200건) | 🟢 `s`(상한 불명확) |
| freshness | 🔴 없음 | 🔴 없음 | 🟢 5종 | 🟢 publishedDate | 🟢 `freshness` | 🟢 since/before |
| **KR / ko** | 🔴 **파라미터 0건** | 🟡 `country: KR` 만(언어 없음) | 🟢 `country` + **`ko`** | 🟡 `userLocation` 만 | 🟢🟢 **KR · ko · ko-KR 전부** | 🔴🔴 `reg` 가 **UK/DE/FR/EU 전용** |
| **1 call = 1 과금?** | 🔴🔴 **아니다** — "model… generates **one or multiple** search queries" · "**billed for each search query**" · **상한 파라미터 없음** | 🔴 아니다(agentic) · 🟢 **`max_tool_calls` 로 상한 가능** | 🟢🟢 **1:1** — multi-query 5개도 **과금 1건** · 토큰비 **0** | 🟡 모드별 · 🟢 과금은 request 고정 | 🟢 1:1 | 🟡 불명확 |
| 한국 커버리지 공식 언급 | 🔴 0건 | 🔴 0건 | 🔴 0건 | 🔴 0건 | 🔴 0건 | 🔴🔴 0건 + **비영어 약세 자기언급 2건** |
| 인덱스 | Google | 🔴 미공개 | 🟢 자체 크롤러 | 🟡 1.4T URL | 🟢 자체 30B | 🟢 자체 **9B** |

🔴 **「한국 커버리지」는 여섯 곳 모두 공식 언급이 0 이다** — `country=KR` 파라미터가 있다는 것은
「한국 사이트가 인덱스에 있다」와 **다른 말** 이다. 🔴 그래서 **이것이 실측으로만 갈리는 축** 이고
이 WU 의 benchmark 가 존재하는 이유다.

### 🔴 우리 use case 에 직접 걸리는 것 (제공자별 한 줄)

```
Gemini      🔴🔴 **리다이렉트 URL + snippet·date 없음 + 도메인 제한 없음 + 과금이 내부
            쿼리 수를 따라가는데 상한 파라미터가 없다.** WU-023B 에서 preferredDomains 가
            무시된 실측이 이것과 정합한다. → 🔴 「우리가 어디를 뒤질지 정한다」가 불가능.
OpenAI      🟢 `include: ["web_search_call.action.sources"]` 가 "**the complete list of URLs
            the model consulted**" 를 준다 — 인용이 아니라 **후보 목록** 이다. 우리 용도에 맞다.
            🟢 그리고 `max_tool_calls` 가 **Gemini 에 없는 비용 상한축** 이다.
Perplexity  🟢🟢 유일하게 **1:1 과금 + multi-query 5개가 1건** + snippet·date + 토큰비 0 +
            `ko` 언어 + 도메인 20. 🔴 그런데 **무료 tier 가 없고** 카드·조직 세금정보·최소 $10.
Exa         🟢🟢 도메인 **1,200 + 와일드카드** = 우리 등록부를 그대로 넣을 수 있다. 🟢 무료 $10/월
            **카드 불필요**. 🔴🔴 그런데 `findSimilar`(URL→유사후보)가 **deprecated** 다 —
            「동일상품 탐색」에 가장 맞아 보였던 기능이 사라졌다. 🔴 pagination·언어 파라미터 없음.
Brave       🟢 **KR·ko·ko-KR 이 실제로 있고** 필드가 가장 풍부하며 과금 1:1 · pagination 있음.
            🔴 도메인 전용 파라미터가 없다. 🔴🔴 **결과를 저장하려면 storage rights plan 이
            따로 필요하다** — 후보 URL 을 Registry 에 남기는 설계와 **직접 충돌** 한다.
            🔴 무료 plan 은 **출처 표기 의무** 가 있고 **카드 등록이 필수** 다.
Mojeek      🟢 `fi`/`fe` 가 가장 깔끔하다. 🔴🔴 그런데 **KR 지역 제한이 불가**(UK/DE/FR/EU 전용)
            이고 지원언어에 한국어 실재를 확인 못 했으며 **공식 블로그가 비영어 인덱스 미성숙을
            스스로 인정** 한다. → 🔴 한국 후보 탐색에는 **구조적으로 불리** 하다.
```

---

## 2. 🟢🟢 Benchmark 프로토콜 — **라벨 없이도 객관적으로 잴 수 있다**

🔴 이 트랙의 반복된 벽은 「ground truth 가 없어 정확도를 못 잰다」였다.
🟢 **그런데 Discovery 비교에는 라벨이 필요 없는 결정적 KPI 가 있다** — WU-004 가 만든
`confirmBrandCodeInEvidence` 를 **심판으로** 쓰면 된다.

```
원상품 26건 중 **품번 보유 6건**(B226AC010 · B226AC035 · B126AC050 · B226AC058 ·
01195-VERNICE-NERO · B1408F26-670)
      ↓ 각 provider 에 같은 질의
후보 URL 목록
      ↓ confirmBrandCodeInEvidence(원상품 품번, {url, title})
🟢 **「그 provider 가 실제 동일상품 페이지를 가져왔는가」가 결정적으로 판정된다**
   — 사람 라벨 없이, provider 와 무관하게, FP 안전하게(토큰 전체일치 + 경계 + 구분자 제한)
```

### 입력 고정 (공정성)

```
질의      `buildPrimaryQuery(dna)` 산출물 **그대로** — 26건에 대해 이미 결정적이다
          (L1_MODEL_CODE 6 · L2_BRAND_NAME 20 · WU-018 실측)
결과 수   상위 **10건** 으로 정규화(여섯 곳 모두 10 이상 지원)
요청 수   **상품 1건 = 요청 1건** → provider 당 **26 요청**
```

### 🔴 두 갈래로 나눠 돌린다 — 섞으면 비교가 깨진다

```
ARM A  도메인 제한 **없음**            → 여섯 곳 **전부** 동일 조건(사과 대 사과)
ARM B  도메인 제한 **있음**(우리 등록부) → 🔴 Gemini·Brave 는 **구조적으로 불가**
                                         (파라미터가 없다) → **참가 불가로 기록**
🔴 ARM B 의 결과를 ARM A 와 같은 표에 넣지 않는다. 「capability 보너스」로 따로 적는다.
```

### KPI — 🟢 라벨 불필요 / 🔴 라벨 필요를 **가른다**

| KPI | 분모 | 라벨 | 산출 방법 |
|---|---|---|---|
| **① 품번 적중률** | 품번 보유 **6건** | 🟢 **불필요** | `confirmBrandCodeInEvidence` 가 후보 URL/title 에서 품번을 찾는가 |
| ② 품번 적중 순위 | 6건 | 🟢 불필요 | 적중 후보가 상위 몇 번째인가(랭킹 품질) |
| ③ 상품 상세 URL 비율 | 26×10 | 🟢 불필요 | 기존 `classifyUrlShape` 가 `PRODUCT_PAGE` 로 분류하는 비율(HTTP 0) |
| ④ 국내/해외 분포 | 26×10 | 🟢 불필요 | `.kr` TLD + 등록부 소속(WU-020 `classifyCandidateMarket` 규칙) |
| ⑤ provider 간 중복/고유 | 전체 | 🟢 불필요 | `normalizeCandidateUrl` 로 dedup 후 교집합·차집합 |
| ⑥ 자기참조 혼입률 | 전체 | 🟢 불필요 | 기존 `isSelfReferenceCandidate`(008A 정책) |
| ⑦ 비용/상품 | — | 🟢 불필요 | **실제 청구/크레딧 차감** (🔴 추정하지 않는다) |
| ⑧ Recall / Precision | 20건(품번 없음) | 🔴 **필요** | 🔴 **측정 불가** — 별도 라벨링이 선행 |

🔴🔴 **⑧을 「0%」로 적지 않는다.** 품번 없는 20건의 정확도는 이 benchmark 로 **알 수 없다**.
🟢 그러나 ①~⑥만으로도 **provider 간 순위는 갈린다** — 그것이 이 WU 의 목적이다.

### 🔴 실행 순서 (비용이 가장 적은 것부터)

```
① Exa        (무료 $10/월 · **카드 불필요**)          → 승인 비용이 가장 작다
② OpenAI     (기존 계정 있으면 ~$1 수준)
③ Brave      (무료 $5/월 · 🔴 카드 등록 필수 · 출처 표기)
④ Perplexity (🔴 무료 없음 · 최소 $10 선불 · 조직 세금정보)
⑤ Mojeek     (🔴 「Contact」 — 영업 접촉이 필요하다)
⑥ Gemini     (🔴 §6 — 잔액으로 부족할 수 있다)
🔴 한 provider 를 끝내고 결과를 보고한 뒤 다음으로 간다. 동시에 열지 않는다.
```

---

## 3. 공식 가격 · 무료구간 · 상업사용 (요약)

| Provider | 단가 | 무료 구간 | 갱신 | 상업사용 | 🔴 주의 |
|---|---|---|---|---|---|
| Exa | $4/1k(instant)~$15 | **$10 크레딧** | 월 1일 리셋 | 🔴 **불명확**(금지 문구도 없음) | pagination 없음 |
| Brave | **$5/1k** | **$5 크레딧**(≈1,000) | 월 | 🟢 허용 | 🔴🔴 **저장은 별 plan** · 출처 표기 · **카드 필수** |
| Perplexity | **$5/1k**(fast $1) | 🔴 **없음** | — | 🟢 허용(재판매 금지) | 최소 $10 · 조직 세금정보 |
| OpenAI | **$10/1k calls** + content 토큰 | 🔴 불명확 | — | 🟢 허용 | 🔴 **citation 노출 의무** |
| Mojeek | **£2~3/1k** | 「limited · Contact」 | 불명확 | 🟢 **AI 사용 명시 허용** | 🔴 KR 제한 불가 |
| Gemini | **$14/1k**(3+) / $35(2.5) | §6 참조 | 월 | 🟢 허용 | 🔴 `analyze` 조항(법무 1건) |

---

## 4. 26건 benchmark 실행계획 — provider 당 비용 추정

🔴 **추정값이고 실제 청구가 ground truth 다.** `*` = 공식 단가에서 산술.

| Provider | ARM A(26) | ARM B(26) | 합 | 무료로 가능? |
|---|---|---|---|---|
| **Exa** | 26 search | 26 search | 52 | 🟢 **예**($10 크레딧 내 · 카드 불필요) |
| **Brave** | 26 | 🔴 불가 | 26 | 🟢 예($5 내) · 🔴 **카드 등록 필요** |
| **Perplexity** | 26 | 26 | 52 → **$0.26*** | 🔴 **아니오**(최소 $10 선불) |
| **OpenAI** | 26 calls | 26 calls | 52 → **$0.52\*** + 토큰 | 🔴 불명확 |
| **Mojeek** | 26 | 26 | 52 | 🔴 불명확(Contact) |
| **Gemini** | 26 calls | 🔴 불가 | 26 calls | 🔴 §6 |

🟢 **즉 benchmark 자체의 금액은 매우 작다**(합쳐 $2 미만 수준). 🔴 **문제는 금액이 아니라
「계정·카드·조직정보·영업접촉」이라는 사업 행위** 다 — 그래서 §5 가 이 WU 의 산출물이다.

---

## 5. 🔴 필요한 승인 — 「무엇을 준비해야 실측할 수 있는가」

| # | Provider | 필요한 것 | 승인 주체 |
|---|---|---|---|
| ① | **Exa** | 계정 생성 + 약관 동의 (🟢 **카드 불필요** · 결제 0) | 🟡 **가장 작은 승인** — CPO 판단으로 충분할 수 있다 |
| ② | **OpenAI** | 계정/키 (🔴 기존 조직 계정 보유 여부를 CTO 가 모른다) | 🟡 CPO 확인 |
| ③ | **Brave** | 계정 + **카드 등록**(과금 0 이지만 등록 필요) + **출처 표기 수용** | 🔴 **CEO** — 카드 등록 |
| ④ | **Perplexity** | **최소 $10 선불** + **조직명·주소·세금정보** | 🔴 **CEO** — 결제·법인정보 |
| ⑤ | **Mojeek** | 영업 **접촉**(Contact) | 🔴 **CEO/CPO** — 외부 커뮤니케이션 |
| ⑥ | **Gemini** | §6 — 🔴 billing 활성화 또는 잔액 보강 | 🔴 **CEO** — 비용 |

🔴 **그리고 Brave 에는 승인 전에 결정해야 하는 제품 문제가 하나 있다**:
```
"If you would like to **store** the API results in part or whole… you will need to
 subscribe to a plan that **explicitly grants storage rights**"
→ 🔴 우리 Registry 설계(후보 URL 을 저장해 가격 추적)와 **직접 충돌** 한다.
🟡 단 benchmark 자체는 transient 사용이라 무료 plan 으로 **측정은 가능** 하다.
🔴 **채택** 단계에서는 별 plan 가격을 확인해야 한다(비공개 · Contact).
```

---

## 6. 🔴🔴 내 이전 보고 정정 — Gemini 「월 5,000 무료」

```
❌ 내가 WU-001/003 에 적은 것: 「Gemini 3세대+ 는 월 5,000 쿼리 무료 → 월 1,000 상품까지 $0」
🔴 **정확하지 않았다.** 공식 가격표를 다시 읽으면:
     Gemini 3+   무료 tier **"Not available"** → **billing 활성화가 전제** 이고,
                 그 «유료» tier 안에서 **월 5,000 search requests 까지 $0**, 이후 $14/1k
     Gemini 2.5  무료 **500 RPD**(일 단위 · Flash-Lite 와 공유) → 유료 후 $35/1k
→ 🔴 즉 「무료로 월 1,000 상품」은 **billing 을 켠 상태에서만** 성립한다. 지금 우리처럼
   선불 크레딧만 있는 상태와 다르다.
🔴 그리고 2.5 무료 tier 는 **입력이 제품 개선에 쓰이고 사람이 검토할 수 있다** —
   공식 문서가 "Human reviewers may read, annotate, and process your API input and output"
   라고 적는다. → **셀러 상품 데이터를 그 경로로 보내는 것은 제품정책 판단 사안** 이다.
🟢 숫자 자체(「$14/1k」·「5,000」)는 맞았고, **전제(billing)** 를 빠뜨렸다.
```

🔴 그리고 **잔액 ₩3,171 로 Gemini arm 을 돌리는 것은 권하지 않는다**: 26 call 이고
WU-023B 실측이 **1 call = grounding 3 쿼리** 였으므로 약 **78 쿼리** 다. 2.5 요율($35/1k)이면
약 **$2.7 ≈ ₩3,600** 으로 **잔액을 넘길 수 있다**. 🔴 추정이므로 단정하지 않는다 —
그러나 **「잔액 안에서 안전하다」고도 말할 수 없다.**

---

## 7. 추천 1순위 후보

```
🟢 **1순위: Exa** — 「실측을 시작하기 위한 승인 비용」이 가장 작다
     · 카드 불필요 · 무료 $10/월 · 도메인 **1,200 + 와일드카드**(우리 등록부를 그대로)
     · 🔴 단 `findSimilar` deprecated · pagination 없음 · 상업사용 조항 불명확
🟡 **2순위: OpenAI** — `action.sources` 가 **후보 목록** 을 주고 `max_tool_calls` 로
     비용 상한을 건다. 🔴 citation 노출 의무 · 기존 계정 여부 확인 필요
🟡 **3순위: Perplexity** — capability 적합도는 **가장 높다**(1:1 과금 · ko · snippet·date)
     🔴 그러나 선불 $10 + 조직 세금정보라 승인이 무겁다
🔴 **보류: Brave** — KR 지원은 최고인데 **저장 권리** 가 우리 Registry 와 충돌한다
🔴 **탈락 후보: Mojeek** — KR 지역 제한 불가 + 비영어 인덱스 미성숙 **자기언급**
🔴 **Gemini** — 기존 구현이 있어 비교군으로 가치가 있지만 §6 때문에 **마지막**
```

🔴🔴 **그리고 이것은 「Exa 를 채택한다」가 아니다.** CPO 가 명시한 대로 provider 선택은
**coverage benchmark 뒤** 다. 위는 **「어느 것을 먼저 재는가」** 의 순서다.

---

## 8. 🔴 CPO 가 지적한 연결 — Discovery 가 좋아도 끝이 아니다

```
Discovery (이 WU)          후보를 «가져오는» 능력        ← ①~⑥ KPI 로 갈린다
Identity  (WU-004/Track B) 그 후보가 동일상품인지        ← 🔴 품번 23% 가 상한
→ 🔴 **둘을 곱해야 제품 가치** 다. provider 가 후보 100개를 줘도 품번이 없으면
     VERIFIED 로 못 가고 가격비교에 들어가지 않는다(WU-004 §7 매핑).
🟢 그래서 benchmark KPI ①(품번 적중률)이 **두 축을 한 번에 재는** 숫자다 —
   「provider 가 가져온 후보에서 우리가 실제로 VERIFIED 를 만들 수 있는가」.
🔴 품번 없는 20건은 provider 를 바꿔도 **이 WU 로는 해결되지 않는다.**
```

---

## 9. CEO Action Required

```
🔴 **있다 — 단 「지금 당장」은 ③④⑤⑥ 뿐이다.**
   ① Exa      🟡 계정 생성만(카드·결제 0) → **CPO 판단으로 가능할 수 있다**
   ② OpenAI   🟡 기존 계정 보유 여부 **확인 필요**
   ③ Brave    🔴 **카드 등록** → CEO
   ④ Perplexity 🔴 **$10 선불 + 조직 세금정보** → CEO
   ⑤ Mojeek   🔴 영업 접촉 → CEO/CPO
   ⑥ Gemini   🔴 billing/잔액 → CEO
🟢 **①만 열어 주면 Phase 1 을 바로 시작할 수 있다**(Exa 단독 실측 · 비용 $0).
🔴 CTO 는 어느 것도 임의로 하지 않았다.
```

---

## 10. 준수 사항

```
🟢 외부 API 호출 **0** · 키 발급 **0** · 계정 생성 **0** · 카드 등록 **0** · 비용 **₩0**
🟢 코드 변경 **0** · Production 변경 **0** · DB **0** · flag **OFF** · deploy **0**
🔴 **무료/유료만으로 provider 를 고르지 않았다**(§7 은 「측정 순서」다)
🔴 한국 커버리지는 **여섯 곳 모두 공식 언급 0** → 실측 전에는 **판단하지 않는다**
🔴 「불명확」을 「없음」·「0%」로 적지 않았다(제공자별 목록은 조사 원본에 그대로 있다)
🔴 내 이전 보고 한 줄을 **정정** 했다(§6)
```
