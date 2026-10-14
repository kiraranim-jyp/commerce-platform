# AI-DISCOVERY-STRATEGY-003 — Discovery Provider + Identity 검증 재설계

> 🔴 **구현 0 · Gemini 호출 0 · credit ₩0 · flag OFF · 외부 API 키 0 · 비용 ₩0.**
> 🟢 측정은 **리포에 이미 있는 캡처 fixture 20건** + **덤프된 운영 스냅샷 26건** 으로만 했다.
> 🔴🔴 **그리고 이 WU 에서 내 가설이 데이터에 한 번 정정됐다** — §2-b 에 그대로 적었다.

---

## 0. 🔴 먼저 — **§1 provider 정확도 벤치마크는 수행하지 못했다**

```
요구: 「우리 상품 26개 기준으로 동일상품 후보를 얼마나 제대로 찾아오는지」
🔴 그러려면 Exa · Brave · Perplexity · Mojeek · OpenAI 의 **API 키** 가 필요하다.
   그 키를 얻는 것은 **계정 생성 + 약관 동의 + (Brave 는) 신용카드 등록** 이고,
   그것은 **외부로 향하는 사업 행위** 다 — CTO 가 임의로 할 수 없다(헌장 §3).
→ 🔴 그래서 §1 의 **정확도 KPI 는 「미측정」** 이다. 「0」이나 「나쁘다」로 적지 않는다.
🟢 대신 **가격·약관은 공식 문서로 전수 확인**했고(WU-001/002), 그보다 더 중요한
   **「판정이 쓸 수 있는 증거가 애초에 얼마나 있는가」를 비용 0 으로 측정**했다(§2).
   🔴🔴 그 숫자가 provider 선택보다 **먼저 결정되는 상한** 이기 때문이다.
```

---

## 1. Discovery Provider 비교 — 가격·약관만 (정확도 미측정)

| Provider | 과금 단위 | 1,000 쿼리 | 무료 구간 | 약관 | 도메인 필터 |
|---|---|---|---|---|---|
| **Gemini API + Grounding (3세대+)** | **검색 쿼리당** | **$14** | 🟢 **월 5,000 requests** | 🟡 조건부 — 🔴 `analyze/learn from Grounded Results` 금지(법무 1건) | 🔴 **무시된다**(WU-023B 실측) |
| Gemini API (2.5세대) | 검색 쿼리당 | $35 | 500 RPD | 🟡 동일 | 동일 |
| **OpenAI `web_search`** | **호출당 + 토큰** | **$10** + content 토큰 | 없음 | 🟢 허용 — 🔴 **inline citation 노출 의무** | 🟡 불명확 |
| **Perplexity Search** | request 당 | **$5** (Fast $1) | 불명확 | 🟢 허용(재판매만 금지) | 🟢 `search_domain_filter` 20 |
| **Exa** | search 당 | **$4** (Instant) | 🟢 **월 $10 리셋** | 🟡 저장조항 **미확인** | 🟢 **wildcard 서브도메인** |
| **Brave** | request 당 | **$5** | 🟢 $5/월(🔴 카드 필수) | 🔴 저장·**benchmark 금지** | 🟡 `site:`(experimental) |
| **Mojeek** | CPM | **£2** | 요청 시 | 🟢 **상업·AI 사용 명시 허용** | 🟢 파라미터 **및** 연산자 |

🔴 **이 표로 provider 를 고르지 않는다** — 정확도가 미측정이고, 헌장이 「싸다를 채택 근거로
쓰면 오염된다」를 이미 경고했다(Mojeek 인덱스 9B 는 롱테일 커버리지 미측정).
🟢 **1 request = 1 과금 단위** 라는 공통점만은 확정 — Gemini 의 「호출 1회가 내부 검색어 N개」
문제가 **구조적으로 사라진다**(헌장 §12 의 「없던 비용상한 ②③④」가 생긴다).

---

## 2. 🔴🔴 핵심 측정 — **판정이 쓸 수 있는 증거가 얼마나 있는가** (비용 0)

### ① 원상품 쪽 (운영 스냅샷 26건 · 운영 owner `buildProductIdentityDna` 산출)

```
brandModelCode(브랜드 품번) 보유   **6/26 = 23%**
identifier 보유                   23/26  — 🔴 tier 가 **전부 `SKU`** 다
color 보유                        20/26
```

🔴🔴 **`identifier` 23건을 「식별코드가 있다」로 읽으면 틀린다.** tier 가 `SKU` 이고 그것은
**판매처 재고번호** 다 — `product-identity-dna.ts:90` 이 **「브랜드가 부여한 품번과 판매처
재고번호를 절대 같은 칸에 넣지 않는다」** 고 명시한다. **샵 간 비교에 쓸 수 있는 것은
`brandModelCode` 하나** 이고 그것이 **23%** 다.

🟢 품번 보유 6건의 실제 값(정확도 판단의 근거라 그대로 적는다):
```
Bobo Choses   B226AC010 · B226AC035 · B126AC050 · B226AC058   (브랜드 품번 체계)
Pèpè Shoes    01195-VERNICE-NERO
Misha & Puff  B1408F26-670
```

### ② 후보 쪽 (캡처 fixture 20건 · 추가 HTTP 0)

```
JSON-LD 보유   12/20
sku 보유       12/20
```

### 🔴🔴 ②-b — **내 가설이 데이터에 정정됐다. 그대로 적는다**

```
처음 가설: 「`extractFromJsonLd` 가 sku 를 읽는데(:211) 후보 경로가 그걸 버린다
            (`productFactsFromListing` 은 `sellerSku` 를 **인자로 받는데**(:270)
             `htmlPath` 가 넘기지 않는다) → MODEL_CODE 축이 «배선이 없어서» 죽어 있다」

🔴 그런데 잡힌 sku 의 «내용» 을 보니 가설이 틀렸다:
   littleluna.co.kr → `cafe24_littlelunakr_1_4117_P0000GCJ000A`   = **Cafe24 내부 재고번호**
   smallable.com    → `AAA1804532`                                = **Smallable 자체 코드**
🔴 둘 다 **판매처 재고번호** 이고 브랜드 품번이 아니다 → 다른 샵과 맞출 수 없다.
🟢 **그래서 `brandModelCode: null` 하드코딩(seller-facts.ts:269)은 버그가 아니라 «옳은
   보수성» 이다.** 그 sku 를 품번으로 승격하면 **거짓 매칭(False Positive)** 이 난다.
   🔴 FP 가 이 WU 의 최우선 KPI 이므로, 그 방향은 **채택 불가** 다.

🟢 **올바른 방향은 반대다** — 후보 sku 를 품번으로 올리는 것이 아니라,
   **원상품의 brandModelCode 를 후보의 sku / URL / title 안에서 «찾는» 것** 이다.
   기존 `confirmBrandCodeInTitle`(match.ts) 이 바로 그 함수이고 지금은 **title 만** 본다.
   🟢 WU-023B 가 그 증거다 — `global.trenbe.com` **URL 에 `b226ac010` 이 들어 있었고
      SAME(0.53) 이 났다.** 🔴 즉 찾을 범위가 좁았던 것이지 증거가 없던 것이 아니다.
```

### 🔴🔴 그래서 구조적 상한이 숫자로 확정된다

```
Deterministic Identity 로 «품번 일치» 를 낼 수 있는 상한 = **원상품 품번 보유율 23%**
나머지 **77%** 는 품번 축이 **구조적으로 없다** → 품번으로는 영원히 SAME 에 못 간다
🟢 그런데 WU-017 실측이 이미 그 결과를 보여줬다 — 후보 175개의 matchLevel 이
   low **173** · medium 1 · very_high 1 · **`high` 0건**. 「임계값 문제가 아니라 점수가
   거의 0」이었고, 그 원인이 바로 이 축 부족이다.
🔴 즉 **MI 가 「약한」 것이 아니라 「증거 없이 단정하지 않은」 것이다.**
   → CPO 가 「MI 를 최종 Judge 로 전제하지 않는다」고 한 판단은 맞지만, 이유는
     **MI 의 정확도가 낮아서가 아니라 입력 증거가 23% 구간에만 있어서** 다.
```

---

## 3. 동일상품 판정 KPI — 🔴 **대부분 지금은 측정 불가이고 이유가 하나다**

| KPI | 현재 | 왜 |
|---|---|---|
| Candidate Recall | 🔴 **측정 불가** | ground truth 라벨이 없다 |
| Exact Match Precision | 🔴 **측정 불가** | 동일 |
| **False Positive** | 🟡 **부분** | 🟢 선행 WU 가 `EXACT FP 0`(3회 확증) · `COMPARISON FP 2/34` 를 실측했다. 🔴 단 분모가 운영 링크뿐 |
| False Negative | 🔴 측정 불가 | GT 없음 |
| SKU Match | 🟢 **상한 23%** (§2) | 측정됨 |
| Brand Match | 🟢 거의 전건 | `brand` 는 양쪽에 있다 |
| Color Match | 🟢 원상품 **20/26** | 측정됨 · 🔴 후보 목록 페이지는 색상 없음 |
| Title Match | 🟢 전건 | `coreTitleTokens` 26/26 |
| Image/Design Match | 🔴 **미측정** | 🟢 단 **관측기는 있다**(아래) |
| URL Quality | 🟢 측정됨 | pool 이 `PRODUCT_PAGE` 가 아니면 버린다(gemini-candidate-pool.ts:295) |

### 🟢 GT 를 만드는 방법은 **이미 리포에 있다** — 새로 만들지 않는다

```
`observeVision` / `runVisionEvidence` — **판정에 입력되지 않는 독립 관측기** 다.
선행 WU 가 그것으로 **Independent GT 를 수립했다**("ESTABLISHED").
🔴 그때 밟은 함정도 기록돼 있다 — 「독립 라벨을 `scored[0]` 에 돌리고 tier 는 운영이
   고른 **대표 후보** 기준으로 재서 **서로 다른 후보를 비교**했다」. 🔴 같은 대상에 붙여야 한다.
🔴 Vision 은 **이미지를 보내므로 단가가 다르다** — Discovery 비용과 **합산 금지**(헌장).
```

---

## 4. 구조 A/B/C/D 판정

| 구조 | 정확도 | 비용 | 판정 |
|---|---|---|---|
| **A** Discovery → MI Identity | 🟡 **23% 구간에서만 SAME 가능** | 🟢 0 | 🟡 **그대로는 부족** |
| **B** Discovery → 페이지 Evidence → Deterministic | 🟢 **23% 구간에서 가장 정확** · FP 최소 | 🟢 **0 (이미 받은 HTML)** | 🟢 **채택(Track A)** |
| **C** Discovery → AI Identity Verification | 🟡 77% 구간을 열 수 있다 | 🔴 후보당 과금 | 🟡 **조건부 채택(Track B)** |
| **D** AI Identity + Evidence, MI 는 보조 | 🔴 **FP 위험이 가장 크다** | 🔴 가장 비쌈 | 🔴 **탈락** |

🔴 **D 를 탈락시키는 이유가 이 WU 의 KPI 다** — FP 최우선. 「AI 가 SAME 이라 했다」를
최종 판정으로 쓰면 **근거 없는 승격**이 되고, 그것은 헌장 금지 5항(「품번 없는 후보를 SAME
승격」)과 같은 위험이다. 🟢 MI 를 보조로 내리는 것이 아니라 **MI 를 게이트로 유지** 해야 한다.

---

## 5. 🟢 추천 Architecture — **단 하나** (2-Track Identity)

```
[상품 URL]
   ↓
[상품정보 추출]            🟢 기존 universalExtract → canonicalProduct → DNA → ProductFacts
   ↓                        재사용률 **100%**
[Discovery Provider]       🟡 **추상화 1칸** — provider 2개 병치(기존 Gemini + 신규 1개)
   ↓                        🔴 어느 provider 를 1순위로 할지는 **커버리지 측정 후** 결정
[Candidate URLs]           🟢 기존 resolveCandidate + PRODUCT_PAGE 게이트 + 자기참조(008A)
   ↓
[Candidate Fetch]          🟢 기존 factsFromProductUrl — **HTML 1회** (JSON-LD 가격 포함)
   ↓
┌──────────────── Identity Verification (2-Track) ────────────────┐
│ 🟢 **Track A — Deterministic** (원상품에 품번이 있는 23%)          │
│    원상품 `brandModelCode` 를 후보의 **sku / URL / title** 에서 찾는다 │
│    🟢 비용 **0**(이미 받은 HTML) · 🟢 FP 최소 · 🟢 기존 함수 확장      │
│    근거: WU-023B 의 trenbe(URL 에 품번) → SAME                      │
│                                                                   │
│ 🟡 **Track B — Vision 1회** (품번이 없는 77%, 그리고 **Track A 가 못 가른 것만**) │
│    기존 `runVisionEvidence` 로 이미지/디자인 비교                     │
│    🔴 후보당 과금 · 🔴 Discovery 비용과 **합산 금지** · 🔴 상한 필요     │
│    🔴 Vision 결과는 **판정 입력이 아니라 축 하나** 로만 쓴다            │
└───────────────────────────────────────────────────────────────────┘
   ↓
[VERIFIED 만 통과]         🔴 PRESUMED / SIMILAR 는 **가격에 들어가지 않는다**(기존 tier 규칙)
   ↓
[Registry]                 🟡 §6 — VERIFIED 만 저장 제안
   ↓
[Market / Price]           🟢 기존 classifyCandidateMarket(WU-020) — **증거 일치 시에만** 단정
   ↓
[Sales Decision]           🟢 기존 사슬 그대로(WU-021 에서 26/26 도달 확인)
```

### 단계별 선택 이유

| 단계 | 왜 | 정확도 | 비용 | 무료구간 | 리스크 | 코드 재사용 |
|---|---|---|---|---|---|---|
| 추출 | 이미 운영에서 돈다 | 🟢 | 🟢 0 | — | 🟢 | **100%** |
| Discovery 추상화 | provider 종속 제거 · 1 req=1 과금 | ⚪ 미측정 | 🟢 저렴 | provider 별 | 🟡 커버리지 | **~90%**(pool 1파일) |
| **Track A** | **FP 최소 · 비용 0** | 🟢 | 🟢 **0** | 🟢 전부 | 🟢 | **~95%**(함수 확장) |
| **Track B** | 77% 를 열 유일한 축 | 🟡 | 🔴 후보당 | 🔴 없음 | 🔴 단가·오판 | **~90%**(기존 Vision) |
| Price/Market | WU-020 이 이미 닫았다 | 🟢 | 🟢 0 | — | 🟢 | **100%** |
| Sales Decision | WU-021 이 이미 닫았다 | 🟢 | 🟢 0 | — | 🟢 | **100%** |

🔴 **Track B 를 「조건부」로 둔 이유** — 77% 를 열려면 이미지 비교가 필요한데, 그것은
**후보당 과금** 이고 FP 위험도 있다. 🟢 그래서 **Track A 가 못 가른 것만** 보내고,
**상한을 코드에 박고**, **판정 입력이 아니라 축 하나** 로만 써야 한다.

---

## 6. 가격 연결 조건 — 🟢 **이미 구현돼 있다**

```
Candidate → Identity VERIFIED → Price Evidence
🟢 기존 규칙이 정확히 그것이다 — `priceTierFromLink` 가
   EXACT_IDENTIFIER / STRONG_IDENTIFIER → **EXACT** · TEXT_CONFIRMED → COMPARISON ·
   SIMILAR → REFERENCE · 나머지 EXCLUDED 로 가르고,
   **EXACT/COMPARISON 만** 가격 버킷에 들어간다.
🟢 그리고 WU-020 이 **시장/통화 게이트** 를 더했다 — `market === "KR" && priceKrw != null`.
```

🔴 CPO 가 지적한 **「일본 URL 이면 무조건 일본 가격」** 문제는 **이미 막혀 있다**:
```
`classifyCandidateMarket` 는 **증거가 «일치» 할 때만** 단정한다 —
  .kr TLD + KRW → KR · 외화 + KR 증거 없음 → OVERSEAS ·
  🔴 **등록부 샵인데 외화 → UNKNOWN(충돌)** · 🔴 통화 단독 결정 금지
🟢 실증: `bobochoses.com` 이 국내 등록부 공식샵인데 가격이 **EUR** 였고 → UNKNOWN 으로 갔다.
🔴 그리고 테스트 상품이 `bobochoses.co.jp` 다 — **`.jp` 라는 이유로 JPY/일본시장으로
   단정하지 않는다.** 통화 증거가 같이 와야 한다. 🟢 그 규칙이 이미 코드에 있다.
```

---

## 7. Registry — 🟢 **10/12 칸이 이미 있다**

`domestic_product_links` 를 `information_schema` 로 읽어 §5 요구와 1:1 대조:

| §5 요구 | 현행 | |
|---|---|---|
| source product | `snapshot_id` | 🟢 |
| candidate URL | `external_url` | 🟢 |
| seller | `source_id`(등록부 FK) | 🟡 **등록 샵만** |
| country / market | 🔴 **없다** | 🔴 (🟢 계산기는 WU-020 에 있다) |
| SKU | `matched_model_name` · `external_product_id` | 🟢 |
| identity status | `match_truth` · `verified` · `status` | 🟢 |
| confidence | `match_confidence` | 🟢 |
| evidence | `match_reasons` · `cross_seller_verdict` | 🟢 |
| last verified | `verified_at` · `updated_at` | 🟢 |

### 🔴 저장 조건 제안 — **VERIFIED 만** 저장한다

```
🟢 VERIFIED(EXACT/STRONG → tier EXACT)  → Registry 저장 · 가격 추적 대상
🔴 PRESUMED / SIMILAR                   → **transient 만** (저장하지 않는다)
   이유 셋:
   ① FP 최우선 — PRESUMED 를 저장하면 「저장됐다」는 사실이 다음 판정에서 신뢰로 오인된다
   ② 가격 추적 대상이 되면 **잘못된 상품의 가격** 을 계속 수집한다(검색 실패보다 위험)
   ③ 헌장 불변식(외부 URL 영구 저장 금지 · `:1067`)과 충돌을 최소화한다
🔴 단 **PRESUMED 를 「다시 보지 않는」 것은 손실** 이다 → 🟡 **대안**: 후보 URL 을 저장하지
   않고 **원상품 쪽에 「이 품번으로 찾았을 때 N건이 PRESUMED 였다」는 카운터만** 남긴다.
   🔴 그 설계는 schema 변경이라 **CPO 판단 사안** 이고 이 WU 에서 결정하지 않았다.
🔴 그리고 `source_id` FK 제약 때문에 **트렌비·머스트잇 같은 등록부 밖 URL 은 지금 못 넣는다**
   — 헌장 §12 가 적어 둔 「P0-1 별 WU」 그 제약이다(Registry 구조 변경).
```

---

## 8. 비용 모델 — 월 상품 수 기준 (환산 0 · `*` = 공식 단가에서 산술)

전제(실측): 상품당 Discovery 쿼리 **3**(WU-023B grounding 3) · Track A 는 **비용 0** ·
Track B 는 **품번 없는 77%** 에만 후보당 1회.

| 월 상품 | Gemini 3+ Grounding | Perplexity $5/1k | Exa $4/1k | 🔴 Track B(Vision) |
|---:|---|---|---|---|
| 100 | 300 쿼리 → 🟢 **$0**(무료 5,000 내) | $1.5* | $1.2* | 🔴 **미산출** |
| 500 | 1,500 쿼리 → 🟢 **$0** | $7.5* | $6* | 🔴 미산출 |
| 1,000 | 3,000 쿼리 → 🟢 **$0** | $15* | $12* | 🔴 미산출 |
| 5,000 | 15,000 쿼리 → 🟡 **$140*** (5,000 무료 차감 후 10,000×$14/1k) | $75* | $60* | 🔴 미산출 |

🔴🔴 **Vision(Track B) 비용을 산출하지 않았다** — 이미지 토큰 단가 × 이미지 수 × 후보 수가
필요하고 그 중 **실측값이 없다**. 🔴 「추정해서 적지 않는다」가 이 트랙의 규칙이다.
→ 🔴 **Track B 를 켜기 전에 그 단가를 먼저 재야 한다**(선행 WU 후보).

🟢 **그리고 재검색 비용은 «구조로» 거의 0 이 된다** — Registry 자산화 + 재관측 주기가
**이미 측정됐다**(최적 **2~3일** · 효율 1.78x · 선행 WU). Discovery 는 **최초 1회** 이고
그 뒤는 가격 재확인이다. 🔴 없는 것은 cron 하나.

🔴🔴 **그리고 이 표가 보여주는 결론 하나** — 월 1,000 상품까지는 **Gemini 3세대+ 가 $0** 이다.
```
🔴 즉 「Gemini 가 비싸다」는 **모델 세대와 쿼리 수의 함수** 였고, 우리는
   `"gemini-flash-latest"` **별칭** 을 써서 어느 세대인지 **코드로 모른다.**
🔴 ₩21,700 소진의 원인 후보가 여기다(2.5세대 $35/1k × 호출당 5.5쿼리).
🔴 단 무료 tier 는 ① 입력이 제품 개선에 사용 ② EEA/영국 대상은 유료 필수 — **제품정책 사안.**
🔴 Billing 원장이 ground truth 이므로 CTO 가 단정하지 않는다.
```

---

## 9. 최종 추천 — 순서가 있다

```
1순위  🟢 **Track A (Deterministic, 비용 0)** 를 먼저 닫는다
        원상품 품번을 후보 **sku/URL/title** 에서 찾도록 `confirmBrandCodeInTitle` 의
        **탐색 범위만** 넓힌다. 🟢 추가 HTTP 0 · 추가 과금 0 · 새 추출기 0.
        🔴 단 **판정을 바꾸는 변경** 이므로 FP 를 반드시 음성대조로 잠근다.

2순위  🟡 **모델 세대 고정** — 별칭을 버리고 3세대+ 모델 ID 를 박는다(+ modelVersion 기록)
        🟢 월 1,000 상품까지 $0 구간. 🔴 선행: 무료 tier 데이터 조건 수용 여부(CPO/법무)

3순위  🟡 **Provider 커버리지 1회 측정** — 무료 tier 로 비용 0
        🔴 선행: API 키 확보(계정 생성 = 사업 행위) → **CPO/CEO 승인 사안**

4순위  🔴 **Track B (Vision)** — 77% 를 열려면 필요하지만 **단가 실측이 선행** 이다

탈락   🔴 구조 D(AI 를 최종 Judge) — FP 최우선 원칙과 충돌
```

🔴 **CTO 가 넷 중 아무것도 구현하지 않았다.** 전부 CPO 결정 사안이다.

---

## 10. 준수 사항

```
🟢 구현 **0** · Gemini 호출 **0** · 외부 API 호출 **0** · API 키 **0** · 비용 **₩0**
🟢 flag **OFF**(env 0건) · Production 배포(기능) 0 · DB/schema 0 · Registry 구현 0 · UI 0
🟢 측정은 **이미 있는 fixture 20 + 덤프 26** 으로만 — 추가 HTTP 0
🔴 §1 provider **정확도는 미측정** 으로 적었다(키 부재 · 「0」으로 적지 않았다)
🔴 Track B(Vision) 비용은 **산출하지 않았다**(실측값 부재 · 추정 금지)
🔴 현재 MI 를 **정답으로 가정하지 않았다**(§2 지시) — 다만 「MI 가 약하다」도 **아니었다**:
   입력 증거가 **23% 구간에만** 있었다는 것이 측정 결과다
🔴🔴 **내 가설이 한 번 틀렸고 그것을 §2-b 에 그대로 남겼다** — 후보 sku 를 품번으로
   쓰자는 방향은 **FP 를 만들므로 채택 불가** 다
```
