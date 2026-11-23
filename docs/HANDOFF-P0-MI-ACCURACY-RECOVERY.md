# HANDOFF — P0-MI-ACCURACY-RECOVERY (2026-11-16 · 1차)

> 🔴🔴 **이 문서는 진입점이 아니다.** 좌표는 `docs/START-HERE.md` 다.
> 🔴 **다음 세션은 §A~§C 를 다시 조사하지 않는다.** 남은 것은 §D·§E 다.
> 🔴 코드 변경 **0** · DB 쓰기 **0** · HTTP **0**(donokids 1-GET 은 이미 완료분).

---

## A. 🔴🔴 CTO 가 직전 턴에 제안한 「브랜드 alias 입력 확장」은 **금지 목록에 있다**

CPO 가 2026-11-08 에 승인한 설계(`brand-description-evidence.ts` 머리 주석)가 **그 행위를 글자로 금지**한다:

```
❌ 원본 brand 자동 보충·덮어쓰기        ❌ domain = brand
❌ **한글 alias 단순 추가로 추출률 확대**  ❌ 판매처 이름을 브랜드로 간주
❌ WU-080 기준선/GT 라벨 변경           ❌ SAME 임계치·matcher 규칙 변경
```
🔴 즉 제 제안은 **이미 닫힌 축** 이었다. CPO 가 「브랜드 alias 단독 개선 목표 설정 금지」로
정정한 것이 **맞다**. ⟹ 🔴 다시 제안하지 않는다.

---

## B. 🟢🟢 조사 B 핵심 답 — **상세설명 증거는 «이미 구현돼 있고, 의도적으로 연결돼 있지 않다»**

### B-1. 구현 상태 (작업트리 · 🔴 **커밋되지 않음** · 세션 기준선에 포함)

| 파일 | 줄 | 성격 |
|---|---:|---|
| `packages/crawler/.../brand-description-evidence.ts` | **302** | BRAND-1 · CPO 승인 2026-11-08 · **관찰 전용** |
| `packages/crawler/.../product-name-description-evidence.ts` | **310** | PRODUCT-NAME-1 · 관찰 전용 |
| `__tests__/brand-1-description-evidence.test.ts` | — | 계약 |
| `__tests__/product-name-1-description-evidence.test.ts` | — | 계약 |
| `packages/shared/src/__tests__/mi-desc-evidence-01-code-labels.test.ts` | — | 계약 |

export — `analyzeBrandDescriptionEvidence` · `analyzeProductNameDescriptionEvidence`

### B-2. 🔴🔴 호출 상태 — **운영 호출 0 이고 그것이 «계약으로 잠겨 있다»**

```
analyzeBrandDescriptionEvidence        운영 호출 **0**(테스트·자기 파일 제외)
analyzeProductNameDescriptionEvidence  운영 호출 **0**
🔴 그리고 brand-1-description-evidence.test.ts:257 가 이것을 «단언» 한다:
     expect(read(owner)).not.toContain("analyzeBrandDescriptionEvidence")
   ⟹ 운영 owner 소스에 그 이름이 **있으면 FAIL** 한다. 「관찰 전용」이 계약이다
```
⟹ 🟢 **「미구현」이 아니라 「구현 + 의도적 미연결」** 이다. CPO 의 분류로는
   **「추출했지만 정책상 사용하지 않음」** 이다.

### B-3. 🔴 왜 연결하지 않았는가 — 측정된 이유가 있다

메모 `description-evidence-turns-same-into-blockers`:
```
🔴 상세설명을 SAME 축에 넣으면 **정답이 blocker 를 얻는다** —
   COLOR_VARIANT / FIT 가 «다른 표기» 를 «다른 상품» 으로 취급한다(**2분모 재현**)
🔴 CPO 가 **연결 금지** 로 닫았다
🟡 재개 조건은 **하나** — **GT 정밀도 재측정 WU**
```
⟹ 🔴🔴 **CPO 의 §2 원칙(「핵심 정보 누락·불일치 시 상세설명 추가 검토」)과 이 금지가
   정면으로 만난다.** 그 충돌을 푸는 것이 이 트랙의 진짜 결정이다.

### B-4. 상세설명 라벨 추출기 — 현재 **4종**

`product-evidence.ts` 의 `*_LABEL_RE` 전수: **`BRAND` · `COLOR` · `PRODUCT_NAME` · `SKU`**

CPO §2 가 요구한 추출 대상과 대조:
```
🟢 있다    브랜드 · 색상 · 상품명 · 품번(SKU)
🔴 라벨 없다  소재 · 디자인 · 제품 유형 · 성별·대상 · 시즌
   🟡 단 「유형」은 `resolveGarmentForms`(shared:521)가 **다른 경로로** 본다 ·
      소재는 `extractFromJsonLd` 의 `material` 칸이 있다(`product-url-facts` 주석)
   🔴 그 둘이 **match input 에 도달하는지는 미확인** — 다음 세션 §D
```

---

## C. 🟢 donokids 1-GET 실측 결과(완료분 · 재조사 금지)

전문 — 원본 HTML `docs/DONOKIDS-1GET-RAW-2026-11-16.html`(116,348 bytes).

```
요청 2026-11-16 10:24:58 KST · HTTP **200** · 리다이렉트 **없음** · HTTP 총 **1**
og:* meta **2개** — og:type="website" · og:url 뿐 ⟹ 🔴 **og:title 없음**
<title>  "[[보보쇼즈] Hidden Monster sweatshirt #226AC038]"
JSON-LD 1블록 · microdata itemprop **0**
  name/description 에 「보보쇼즈」·「#226AC038」 **둘 다 있다**
  🔴 `brand` 칸 **없음**  ·  sku "058003000184"(판매처 자체)
  🟢 category "BOBO CHOSES (대) > F/W 2026 (중)"  ← 라틴 브랜드가 구조화 칸에 있다
문자열 — 「보보쇼즈」8회 · 「Bobo Choses」0회 · `#226AC038` 7회 · `B226AC038` **0회**

운영 추출기 실제 산출(함수 직접 호출)
  brandFromHtml(html)             = **null**
  jsonLdProductDescription(html)  = "[[보보쇼즈] Hidden Monster sweatshirt #226AC038]"  🟢
  extractDetailModelCodes(desc)   = **[]**
  🟢 lookupBrandByAliasInTitle(<title>)     = **"Bobo Choses"**   ← 입력만 바꾸면 맞춘다
  🟢 lookupBrandByAliasInTitle(jsonLd desc) = **"Bobo Choses"**
```

**끊기는 지점 둘(코드 좌표)**
```
① 브랜드  brandFromHtml 의 세 경로가 전부 공회전 —
          JSON-LD `brand` 칸 없음 · microdata 0 · alias 경로가 **og:title 만** 읽는데 없다
② 품번    DETAIL_MODEL_CODE_PATTERN = /\bB\d{3}[A-Z]{2}\d{3}\b/ 가 **B 접두 요구** ·
          페이지는 `B226AC038` 을 **0회** 쓴다(`#226AC038` 7회)
🟢 교차 대조 — 같은 경로에서 vividvia(`B226AC009` 완전형)는 품번증거 **exact 5/5**
```

---

## D. 🔴 남은 조사 (다음 세션이 **준비 없이** 들어갈 수 있다)

```
D-1 조사 A — CEO 육안 검토 기록 복원
    🟢 출발점이 이미 있다 — `docs/CEO-GT-LEDGER-2026-11-08.md`(9건 · 사유 포함) ·
       `candidate_reviews` human_verdict **39행**(SAME 23 · DIFFERENT 15 · SIMILAR 1) ·
       `fixtures/wu-*-human-gt.json` 다수
    🔴 「브랜드+품번」·「상품명+품번」 조합별 사례 분류는 **미작성**

D-2 조사 B 잔여 — `material` · `garmentForm` 이 match input 에 도달하는가
    좌표 `extractFromJsonLd` → `productFactsFromListing`(product-url-facts:83~113) →
    `withConfidence` → `compareCrossSellerProducts`

D-3 조사 C — 마지막 MI 정확도 개선 WU 복원
    🟡 후보 = BRAND-0/BRAND-1/PRODUCT-NAME-1(2026-11-08 · 작업트리 미커밋) ·
       `docs/MI-REEVAL-STEP5-SHADOW.json`(수정됨) · `core-same05~07`(수정됨)
    🔴 **그 파일들은 사용자 작업물이다** — CTO 가 커밋·수정하지 않는다(§4-D)

D-4 조사 D — 33건 / 3도메인 통합 대조표(원상품 ↔ 후보 필드별 추출 성공·실패)
    🟢 입력은 전부 저장돼 있다(candidate_reviews: blockers · match_reasons · title · url)
    🔴 vividvia · miniboutique 는 **HTTP 미승인** ⟹ 페이지 축은 미측정으로 남는다
```

---

## D-bis. 🟢 조사 A 완료 + 관찰 파일럿 완료 (2026-11-16 · HTTP 0 · 코드 0)

### 1. CEO 기준은 **CLAUDE.md §5-D 에 고정 등록** 됐다
🟢 스프린트와 무관하게 유효 · `START-HERE 0-NOW` 에 요약과 진행 위치를 연결 ·
🔴 CEO 원장 **복제 0** · 신규 진입 문서 **0**.

### 2. CEO 원장 9건 ↔ 현재 MI 대조 (원장 원문에서 복원)
```
S1-1 rboutique   동일(상세정보 사양 표)  ↔ SIMILAR 1/5      🔴 재캡처 429 미확인
S2-1 stockmann   동일(사양 표·에스토니아어) ↔ SIMILAR 0/5·품번null  🔴 desc 398자인데 미복구
S2-2 (브랜드+품번) 동일                   ↔ PRESUMED_SAME     원상품 brand null
S1-4 kolkid      동일(소재·상품명·이미지)  ↔ PRESUMED 7/5      FIT · 🔴 IMAGE 는 표준이 제외
S2-3 bobochoses  동일 또는 유사           ↔ PRESUMED          MODEL_CODE_AGE_LINE+FIT
S2-4 kids21      동일 또는 유사           ↔ 🟢 재캡처 SAME     🟢 일치(자체 SKU 승격 소멸)
S1-7 bobochoses  동일 또는 유사           ↔ 🔴 CONFLICT 0축    품번 충돌 **조기 반환**
C27  beaumonde   동일(영/한+제목 품번)     ↔ 🟢 재캡처 SAME     🟢 일치
S3-1 stadtlandkind 동일이나 근거 없음      ↔ SIMILAR 1/5       🔴 429 · 품번·소재·이미지 전무
🟢 일치 2 · 보류 4 · 충돌 1 · 측정불가 2   🔴 정밀도 수치로 환산하지 않았다
```

### 3. 🟢🟢 관찰 파일럿 — **운영 ↔ 관찰 분석기의 격차가 1건에서 측정됐다**

입력은 **운영 생산자 산출** 이다(`jsonLdProductDescription` · `<title>`). 🔴 HTML 가공 0 · 분석기 재구현 0.
```
입력   title       "[[보보쇼즈] Hidden Monster sweatshirt #226AC038]"
       description "[[보보쇼즈] Hidden Monster sweatshirt #226AC038]"   ← 🔴 제목 복사본이다

운영   brandFromHtml(html)                  = **null**
관찰   analyzeBrandDescriptionEvidence(...)  = **CORROBORATED "Bobo Choses"**
       observations 2(TITLE/ALIAS_REGISTRY · DESCRIPTION/ALIAS_REGISTRY) ·
       confidence **HIGH** · knownProductBrand true · productAttributable true ·
       reasons 「독립 출처 2곳이 같은 브랜드를 말한다」
관찰   analyzeProductNameDescriptionEvidence = **OBSERVED** ·
       coreTokens ["hidden","monster","sweatshirt","226ac038"]
       🔴 그 `226ac038` 은 **상품명 토큰** 이고 품번 증거가 아니다
```
🔴🔴 **그래도 운영에 연결하지 않았다** — 계약 유지(`:257`).

### 4. 🔴 파일럿의 한계 — donokids 는 **S1-1/S2-1 의 대리 표본이 아니다**
```
HTML 본문 사양 라벨 — 브랜드 1 · 소재 1 · 색상 1 · 시즌 1 · 제조 3 · Brand 1 (각 «1회»)
표 마크업 — <table 13 · <th 11 · <dl 2 · <li 48
🔴 각 1회뿐이라 **고시정보 표로 보인다** — S1-1(`Model code: B226AC010`) ·
   S2-1(`Valmistaja tootenumber B226AC009`) 같은 **사양 표가 아니다**
⟹ 🔴 「사양 표를 운영이 읽는가」는 **이 표본으로 답할 수 없다** · 여전히 미확인
```

### 5. 🔵 다음 단계의 입력 확보 가능성
```
🟢 가능   human GT 39 · 국내 PRESUMED 33 의 **title** 은 저장돼 있다 ⟹ 관찰 분석기에 바로 넣을 수 있다
🔴 불가   **description 원문이 저장돼 있지 않다**(길이만) ⟹ 사양 표 축은 분모가 없다
🟡 필요   S1-1 · S2-1 페이지 재수집(과거 둘 다 **429**) — 🔴 **HTTP 미승인**
```

---

---

## D-ter. 🔵🔵 CPO 결정표 (2026-11-16 · 🔴 다시 논의하지 않는다)

| 작업 | 결정 |
|---|---|
| **S1-1 URL 복원** | 🟡 **CEO 제공 대기** — 🔴 CTO 가 추정·사이트 검색으로 만들지 않는다 |
| **S2-1 GET** | 🔴 **보류** — URL 은 있으나 오판 사례가 아니다(human SAME · blockers `[]`) |
| **S1-1 GET** | 🟡 URL 확인 후 **별도 승인** |
| 원본 응답 보존 정책 | 🟢 **향후 승인된 라이브 검증의 «필수 조건»** · 🔴 단 기존 테스트·수집 코드 **지금 수정 불허** |
| title 관찰 분석 | 🔴 **후순위** (금지 사유를 건드리지 못한다) |
| 상세설명 운영 연결 | 🔴 **금지 유지** |
| matching 축 · threshold | 🔴 **변경 금지** |

### 🔴 S1-1 URL 상태 — 네 저장 자리 **전부 0**
```
CEO 원장           호스트명만(`### S1-1 · www.rboutique.com`) · 🔴 URL 없음
fixture wu-059-gt-facts.json   🔴 0건  (⟹ 기존 테스트는 그 건을 **애초에 fetch 하지 않는다**)
candidate_reviews  🔴 0행
product_snapshots  🔴 0건
```
🟢 **S2-1 은 있다** — `candidate_reviews` 1행:
`https://www.stockmann.ee/et-ee/bobo-choses-trikoosark-hug-monster/18119748633-1.html`
(human SAME · blockers `[]` · 🔴 `candidate_title` 은 **∅**)

### 🟢 URL 을 받으면 **HTTP 전에** 할 일(비용 0)
```
🔴 CEO 가 준 URL 이 원장의 그 상품인지 **먼저 대조** 한다 — 원장 S1-1 원문에
   `Model code: B226AC010` · `Color: Grey` · `Material: 100% CO` · `Sku: 38533` 가 있다
   ⟹ URL 이 **B226AC010(Grey)** 상품을 가리켜야 한다
🔴 일치하지 않으면 **HTTP 를 요청하지 않고** 불일치를 보고한다
```

### 🔴 구조적 원인(별건 · 수정 불허)
```
기존 테스트 `core-step5-e2-description-evidence.test.ts:127` 가
fetch 응답에서 description 을 만들어 쓰고 **원문을 버린다**
⟹ 429 를 만나면 그 사례가 **영구히 사라진다**(S1-1 이 그렇게 됐다)
🟢 CPO 가 「향후 승인된 라이브 검증의 필수 조건」으로 보존 정책을 고정했다
🔴 그러나 **지금 그 코드를 고치는 것은 승인되지 않았다**
```

### 🟡 정정 기록 — CTO 보고 1줄
🔴 「S1-1·S2-1 둘 다 429」라 적었는데 **틀렸다.** 원장 §3-② 기준 **S1-1 · S3-1 이 429** 이고
**S2-1 은 status OK** 였다.

---

---

## D-qu. 🔵🔵🔵 CEO 전략 확정 — **단계별 검색 · 조기 종료**(2026-11-16)

🔴 전문은 **`CLAUDE.md §5-D-2`** 다(여기 복제하지 않는다). 🔴 CEO 승인 없이 변경 금지.
```
1차 브랜드+제조사 품번 → 2차 상품명(1차 0일 때만) → 3차 상세설명(1·2차 모두 0일 때만)
종료 동일 3~5개 즉시 종료 · 1개 이상이면 다음 단계 금지 · 유사는 동일 수량에 포함 안 함
🔴 조기 종료는 **실제 provider 호출·수집까지** 멈춰야 한다
```

### D-qu-1. 🔴🔴 S1-1 GET — **보류로 전환** (기존 승인 요청은 무효)
```
🟢 URL 은 확보됐다 — `https://www.rboutique.com/products/booty-ghosts-cotton-t-shirt-bobo-choses-38533`
   출처 `fixtures/wu-112-human-gt.json:9` · `originCode: "B226AC010"` · `verdict: "SAME"`
   🟢 원장 대조 **일치**(`Sku: 38533` ↔ URL 끝 `-38533` · `Model code B226AC010`)
🟡 리다이렉트 — `en-us` → **`en-sk`** (`fixtures/wu-074-probe.json`)
🔴 **실행 금지** — 상세설명은 **3차 단계** 이고 1·2차가 모두 0일 때만 고려한다
🔴 기존 HTTP 승인 요청을 **현재 실행 승인으로 해석하지 않는다** · URL·증거는 보존
```

### D-qu-2. 🔴 **정정 기록 — 삭제하지 않는다**(CPO 지시)
```
내가 「S1-1 URL 이 네 저장 자리 전부에 0 · 확보 불가 · CEO 제공 대기」로 보고했다. **틀렸다.**
🔴 원인 — 검색 범위를 좁게 잡았다(원장 · wu-059 fixture · candidate_reviews · 스냅샷만).
   전수 검색 결과 **리포 소스 13개 파일**에 있었다 — wu-112-human-gt · wu-067 · wu-068 ·
   wu-074-probe · cand-02-rows · mi-current-recapture(3) · search-provider-05-raw ·
   wu-099/100-human-value · core-2b-browser-handoff · run-domestic-price-check.ts
🔴 내 메모가 「그 fixture 들은 **URL 을 키로** 쓴다」를 이미 적어 뒀는데 적용하지 않았다.
🔴 그리고 헌장 §3「CTO 가 할 수 있는 일을 CEO 에게 넘기지 않는다」를 넘었다 —
   대표님이 「이게 뭐지?」라고 물어 주셔서 잡혔다.
🟢 교훈 — 「저장 자리 전부 0」을 선언하기 전에 **리포 전수 grep** 을 먼저 한다.
```

### D-qu-3. 🔴 `description` 원문은 여전히 0 건
```
mi-current-recapture.json / -retry / -delayed (사용자 미커밋 · 읽기만)
  `"description"` 칸 존재 **false**(3/3) · 「Model code」 **0회** · rboutique 2회 · 38533 1회
⟹ 사양 표 원문은 **재수집 없이 확보되지 않는다**(그 결론은 유지)
```

---

---

## D-sx. 🔵🔵🔵 SPRINT 0 완료(정정된 사실관계) + SPRINT 1 착수 좌표 (2026-11-16)

### D-sx-1. 🔴🔴 **한글 검색어는 «이미 구현돼 있다»** — 중복 구현 금지

```
운영 국내 경로   run-domestic-price-check.ts
  :1238  englishTerms = buildCrossSellerSearchQueries(input.dna)…
  :1271  koreanQuery  = **buildKoreanDiscoveryQueries({...})**
  :1276  searchTerms  = [...englishTerms, ...**koreanQuery.queries**]   🟢 영문 + 한글
owner          packages/shared/src/korean-discovery-query.ts:81 (128줄)
  질의 ① **alias + 품번**(품번이 언어 중립이라 한국어 상품명 벽을 넘는다 · 주석)
       ② alias + **한글 상품명 토큰** + 품번 (한글 제목이 «디자인어» 를 들 때만)
  🔴 거부 게이트 둘 — `NO_BRAND_ALIAS` · `NO_IDENTIFYING_TOKEN`(「이 모듈의 심장」)
  🟢 provenance(query·parts·koreanTitleSource) · 중복 제거 **있다**
```

🔴 **CTO 오보고 정정(삭제하지 않는다)** — 「`buildCrossSellerSearchQueries` 에 alias 0
⟹ 국내는 전부 영문」으로 보고했다. **틀렸다.** 그 함수 하나만 보고 호출 경로를 보지
않았다(§4-D 위반). 운영은 그 위에 한글 질의를 **합친다**.

🔴 **CPO 가 가른 구분** — 「한글 질의 생성 기능이 **있다**」 ≠ 「국내 후보를 **충분히 만든다**」.
현재 확인된 것은 **전자뿐** 이다. 국내 후보 67 · SAME 1 의 원인은 **미확정**.

### D-sx-2. 🟢 CPO 선행 확인 3건 — 답

```
① searchTerms 생산자 **둘**
   ⒜ run-domestic-price-check.ts:1276        운영 /check  🟢 **영문+한글**
   ⒝ domestic-price-sources/search/route.ts:181  패널 자기검색 🔴 **영문 전용**
      (`buildCrossSellerSearchQueries(dna)` 만 · searchTerm = [0])
② index.ts:263 단일 `term: query.title` = 🟢 **해외**(`findPriceSourceAdapter(domain,"OVERSEAS")`)
   🔴 여기에 한글을 꽂지 않는다
③ 상품명 번역·동의어 🟡 **부분** — `buildKoreanDiscoveryQueries` 가 `koreanTitle`·`brandAlias`
   를 **받는다**. 🔴 그 두 입력의 «생산자» 는 **미확인**
```

### D-sx-3. 🔵 SPRINT 1 = **구현이 아니라 계측** (CPO 승인 · HTTP 0 · DB 쓰기 0)

```
산출물 셋(코드 변경 전에 이것부터)
  ① `NO_BRAND_ALIAS` ↔ `NO_IDENTIFYING_TOKEN` **실제 분포**
  ② 그 결과가 국내 후보 부족을 **설명하는 범위와 한계**
  ③ 패널 경로(⒝)가 **실제 국내 검색 기능인지 별도 목적인지** 호출 근거

계측 조건(CPO 명시)
  🔴 저장된 GT·스냅샷 대상 **관찰 호출만** · HTTP 0 · DB 쓰기 0 · 데이터 수정 0
  🔴 두 사유 **각각** 집계 + 입력값 누락 여부 + **브랜드별 분포**
  🔴 두 사유 **동시 발생** · **다른 거부 사유** 존재도 확인
  🔴🔴 관찰 호출의 입력이 **운영 호출과 동일한지 검증** 한다 —
       임의로 입력을 보충한 결과를 **운영 발생률로 보고하지 않는다**

🟡 의심 자리 둘(코드 근거)
  ⒜ alias 등록부가 **「Bobo Choses → 보보쇼즈」 1건뿐** ⟹ 다른 브랜드는 한글 질의 **0**
     🔴 그러나 **alias 추가는 CPO 금지축** 이다 ⟹ 그 결론이 나와도 **자동 진행 금지 · CPO 판단**
  ⒝ 원상품 **품번 공백** ⟹ `NO_IDENTIFYING_TOKEN` 으로 전부 거부
     🟢 이쪽이면 금지축 «밖» 이고 고칠 수 있다
```

### D-sx-4. 🔴 변경 금지 재확인
```
① brand alias 등록부 임의 확대  ② index.ts:263 해외 경로에 한글 투입
③ buildCrossSellerSearchQueries 를 한글 생성 목적으로 변경(운영은 이미 합산한다)
④ 기존 SAME 판정 기준 · 가격 정책  ⑤ **S1-1 GET 보류 유지**
```

🟢 **SPRINT 0 = 완료(정정 반영) · SPRINT 1~7 = 미완료 · 코드 변경 0 으로 인계.**

---

---

## D-sv. 🟢🟢 SPRINT 1 라이브 진단 — **병목은 「검색」이 아니라 「공급」이다**(2026-11-16)

🔴 CPO 승인 HTTP 24 · **실제 6회** 사용(상세 0 · 429 0). 원본 `docs/S1-LIVE-KOREAN-QUERY-2026-11-16.json`.

```
검색어  "보보쇼즈 B226AC009" **단일 한글** · 운영 `searchDomesticShops` 그대로 · 소요 1,320ms
status  **{ok: 6}** — 비200·429·timeout **0**

🟢🟢 LOOXLOO  후보 **5** — 한글 질의가 **한글 상품명 후보를 실제로 가져왔다**
   "보보쇼즈 팝조깅팬츠(76A7D-415-02)" · "팝레깅스(416-02)" · "팝롱양말(812-05)" ·
   "데님캡(800-02)" · "팝티셔츠(330-09)"
   🔴 품번 전부 **76A7D-xxx-xx = looxloo 자체 SKU**(제조사 품번 아님)
   🔴 confidence **0** · matchLevel **low** (전건) ⟹ 🟢 **다른 상품이므로 그 판정이 정확하다**
rulii · foretforet · chocoel · deuxbebe · littleluna  status=ok · 후보 **0**
```

### CPO 4분류 결과
```
⒜ 원응답 0              🟡 5곳 — 🔴 「응답 0」 ↔ 「미취급」 **미분리**(CPO 가 추가 계측 **미승인**)
⒝ 원응답→필터 후 0       🔴 **0건** (looxloo 5건은 필터를 통과했다)
⒞ 후보 남음→SAME 0       🟢🟢 **looxloo 5/5** ← 병목은 여기지만 **판정 오류가 아니다**
⒟ SAME 확인             🔴 0건
```

### 🔴 이것이 바꾼 전제
```
❌ 「한글 검색어를 만들어야 한다」       — 이미 만들고 **이미 통한다**(실증)
❌ 「국내 후보가 내부 필터에서 죽는다」    — 통과했다(5/5)
✅ 「국내 후보가 «애초에 다른 상품» 이다」  — looxloo 5건 전부 다른 품번
✅ 5곳 후보 0 ⟹ **공급 축 한계가 유력**(WU-114/115/130 과 같은 방향)
🔴 CPO 결정 — 한글 생성기 수정 **금지** · SAME 완화 **금지** · 추가 원응답 계측 **미승인**
```

### 🔴 측정 한계
```
⒜ 5곳의 「응답 0 ↔ 미취급」 미분리   ⒝ 질의 1 · 상품 1 · 샵 6 (전수 아님)
⒞ 영문 질의와 **비교하지 않았다** ⟹ 「한글이 영문보다 낫다」를 적을 수 없다
⒟ 상세 요청 0 의 이유 = 후보 전건 `low` ⟹ 자격 필터 탈락(WU-088 재현)
```

---

## D-sw. 🔵 SPRINT 2~7 — **미착수 · 코드 변경 0 으로 인계**(용량 중단 · §4-C)

🔴 CPO 가 통합 자율 진행을 지시했으나 **이 세션 용량으로 완주 불가** 하여, 구현을 시작하지 않고
**작업트리를 clean 하게** 넘긴다(중간에 끊기는 것이 가장 나쁘다 · §4-C).

```
다음 세션의 첫 작업 — SPRINT 2(1차 핵심 식별) **설계부터**가 아니라 **좌표부터**:
  조기 종료 축 교체  run-domestic-price-check.ts:1411-1414
    현재  foundVeryHighInP0 = p0Results.some(c.matchLevel === "very_high")
    🔴 그 값은 WU-094/095 가 **거짓값으로 제거** 했다 ⟹ 지금 거의 발화하지 않을 것
    🔵 CEO 전략의 축 = **「동일 후보 수」**(SAME 1개 이상 / 3~5개)
    🔴 그것은 **판정 산출을 단계 전환에 쓰는 첫 사례** 다(axes 변경 아님)
  계측 신설        단계별 provider 호출 수 · 상세 요청 수 · 소요 시간
    🔴 CEO 완료 조건이 **「실행 기록으로 증명」** 이므로 **구현과 같이** 가야 한다
    🟢 기준선은 이미 있다 — 이번 실측 **6회 / 1,320ms / 후보 5**
  3단 구조         현재 **2단**(P0 → 기타) ⟹ 2차(상품명) · 3차(상세설명) 추가
    🔴 3차는 상세설명 **운영 판정 연결 금지** 계약을 깨지 않는다(추출 ≠ 반영)
  공급 축          🔴 어댑터/등록부 확대는 **§12-0 금지축** ⟹ CPO 결정 없이 열지 않는다
```

---

---

## D-sx2. 🔵🔵🔵 **SPRINT 2 — CPO 결정 확정 · 다음 세션이 «조사 없이» 바로 구현**(2026-11-16)

🔴 **진행 규칙 확정** — SPRINT 2 완료 → CTO 보고 **1회** → CPO 검토 → SPRINT 3 결정.
🔴 스프린트 **내부** 조사·설계·구현·테스트·회귀는 CTO 자율. **세부 검토 요청 금지.**

### CPO 결정 — ⒝ 채택 / ⒜(수집↔판정 교대) **불허**
```
🟢 `brand + manufacturer model code` 일치  = **1차 검색의 강한 식별 신호**
🟢 기존 `matchLevel`                      = **기존 계약 그대로 유지**
🔴 실제 SAME                              = **`judgeDomesticCandidate` 결과만** 인정
🔴 SIMILAR / PRESUMED_SAME                = SAME 후보 수에서 **제외**
🔴🔴 **품번 exact + 브랜드 일치만으로 «SAME 후보» 라 부르거나
     CEO 의 SAME 기반 조기 종료 조건을 «충족했다» 로 간주 금지**
     ⟹ 그 신호는 **검색 우선순위·후보 식별에만** 쓴다(판정 기준으로 승격 금지)
🔴 구조 변경을 **몰래 우회하지 않는다** — 구조 변경이 반드시 필요하다고 «확인되면»
   임의로 바꾸지 말고 **완료 보고에 기술적 제약과 대안을 명시** 한다
```

### 구현 방향 6 (CPO 지정)
```
① 기존 `compareModelCode` + 브랜드 비교 **재사용**(새 함수 금지)
② 브랜드+품번 일치 후보를 **후보 식별·검색 우선순위** 에 활용
③ 실제 SAME 은 `judgeDomesticCandidate` 결과를 따른다
④ SIMILAR · PRESUMED_SAME 은 SAME 수에 **넣지 않는다**(계약으로 잠근다)
⑤ 기존 **P0/P1 구조** 와 **WU-095 수정**(거짓 very_high 제거)을 **보존**
⑥ **단계별 비용 계측** 구현
```

### 🔴 이미 확정된 기술적 제약(재조사 금지 · 보고에 그대로 싣는다)
```
조기 종료 지점  run-domestic-price-check.ts:**1412** — 그 시점에 **SAME verdict 가 없다**
SAME 판정 시점  `judgeDomesticCandidate` 호출 **:2087**(정의 :1060) — **676줄 뒤**
⟹ 🔴 **현 구조에서는 「실제 SAME 수」로 조기 종료할 수 없다** ⟹ SPRINT 2 의 **제약으로 기록**
현재 가드 상태  `foundVeryHighInP0`(:1412) 는 **사실상 죽어 있다** —
               SPRINT 1 라이브 실측에서 후보 **전건 `low` · confidence 0**
               (WU-095 가 거짓 `very_high` 를 제거한 뒤의 정상 상태)
🔴 그 가드를 «되살리지» 않는다 — WU-095 는 의도된 수정이다
```

### 🟢 계측 기준선 (이번 세션 실측 · 재측정 불필요)
```
HTTP **6회**(provider 6 × 1) · 상세 요청 **0** · 429 **0** · 소요 **1,320ms**
후보 — looxloo **5**(전건 low · conf 0) · 나머지 5곳 **0** · status {ok:6}
원본 `docs/S1-LIVE-KOREAN-QUERY-2026-11-16.json`
```

### 🔴 회귀 주의 좌표
```
`foundVeryHighInP0` 를 단언하는 기존 테스트 · P0/P1 분기 테스트 ·
`searchRun` 집계 계약(단일 `query` 칸 — 🔴 복수 검색어 기록으로 **오해 금지**)
```

---

## D-sx3. 🟢🟢 **SPRINT 2 실행 완료 · 배포 `5d560002`**(2026-11-16 · 🔴 §D-sx2 결정 원문은 위에 보존)

🔴 **먼저 — 착수 전 확인이 설계를 바꿨다**(§4-D 「기존 구현 확인」이 실제로 일했다):

```
🟢🟢 CEO 조기 종료의 **정지 조건은 이미 구현돼 있었다**
   `packages/crawler/src/comparison-search/index.ts` 샵 사다리(`for (const term of terms)`)가
   **자기참조를 뺀 `crossSellerVerdict === "SAME"`** 에서 멈춘다(그 자리 주석이
   「STOP 은 「후보가 생겼을 때」가 아니라 「동일상품이 확정됐을 때」다」라고 적어 뒀다).
   ⟹ 🔴 SIMILAR·PRESUMED_SAME 은 그 조건을 **만족하지 못한다** = CPO ③④ 가 **이미 지켜진다**
   ⟹ 🔴 그래서 **멈춤 로직을 새로 만들지 않았다**(만들면 정지 조건 owner 가 둘이 된다)
🟢 1차/2차 단계 순서도 이미 있다 — `buildCrossSellerSearchQueries`(product-identity-dna.ts:580)
   ① `dna.brandModelCode` **단독** → ② 브랜드+핵심명+유형+색상 → ③④⑤ 로 넓어진다
   + 그 뒤에 한글 질의(`alias + 품번`)가 붙는다(`run-domestic-price-check.ts:1276`)
🟡 **관측 1건(고치지 않았다)** — CEO §5-D-2 의 1차는 「브랜드 **+** 제조사 품번」인데
   영문 사다리 ①은 **품번 단독** 이다. 🔴 더 좁은 쪽이고 골든케이스가 걸려 있어
   **검색어 생성 정책 변경** 이다 ⟹ 임의로 바꾸지 않았다. 한글 질의 ①이 「alias+품번」이다
```

### 🟢 구현한 것 — **둘** (운영 4파일 · 신규 1파일)

```
⒜ 1차 식별 신호(**관측 전용**)  `comparison-search/domestic-stage-metrics.ts` 신규
   `hasPrimaryIdentitySignal(origin, candidate)` = `brandsCompatible` **그리고**
   `compareModelCode(...) === "exact"` ⟹ 🔴 **둘 다** 맞아야 선다(§5-D 「100%」 정의)
   🔴 새 비교 함수 **0** — 기존 둘을 그대로 부른다(`brandsCompatible` 은 **export 만** 더했고
      본문 불변 · 그 함수가 쥔 실측(「Konges Sløjd A/S」↔「… Sale」)을 잃지 않기 위해서다)
   🔴 판매처 자체 SKU 는 **보지 않는다** — SPRINT 1 라이브 looxloo 5건이 전부
      `76A7D-xxx-xx`(자체 SKU)이고 `facts.brandModelCode` 는 **null** 이었다
⒝ 단계별 비용 계측          `[SPRINT2-stage]` 로그 1줄 + 응답 `domesticStageMetrics`
   칸마다 — provider 호출 수 · 새 후보 수 · 1차 신호 수 · 소요 ms · **그 칸 뒤 멈춤 여부**
   🔴 alias 폴백은 `termIndex: null` 로 가른다(**단계가 아니다** — 사다리 칸으로 세면
      「2차 상품명 질의」 수가 부풀어 CEO 단계 전략의 숫자가 거짓이 된다)
   🔴 P0 기록과 그 뒤 기록을 **합산하지 않는다**(합치면 「P0 에서 끝났다」가 사라진다)
   🔴 로그를 **판정 루프 뒤** 에서 낸다 — 검색 직후면 상세 요청 수가 **항상 0** 이라
      CEO 완료 조건의 그 칸이 **거짓으로 0** 이 된다(계약 C-4 가 순서를 잠근다)
🟢 관측자는 **선택 인자** 다 ⟹ 안 넘기면 한 줄도 돌지 않아 기존 호출부 동작 **불변**
```

### 🔴🔴 제약 3건 — **구현으로 우회하지 않았다**(CPO 지시대로 보고에 싣는다)

```
⒜ `:1412` 조기 종료 시점에 **SAME verdict 가 없다** — 판정은 `judgeDomesticCandidate`
   호출 **676줄 뒤** 다 ⟹ 🔴 현 구조에서 「실제 SAME 수」로 조기 종료 **불가**
⒝ `foundVeryHighInP0` 는 **되살리지 않았다** — WU-095 가 거짓 `very_high` 를 없앤 뒤의
   정상 상태이고 SPRINT 1 실측에서 국내 후보는 **전건 `low` · conf 0** 이었다
⒞ 🔴🔴 **샵 «사이» 조기 종료가 성립하지 않는다** — `searchDomesticShops` 가
   `Promise.allSettled` 로 샵을 **동시에** 출발시키므로 샵 A 에서 SAME 이 확정돼도
   샵 B~F 의 첫 요청은 **이미 나갔다**. 샵 «안» 에서는 성립한다(사다리가 멈춘다).
   ⟹ 고치려면 샵을 순차로 돌리며 판정과 교대해야 하고 그것이 **CPO 불허(⒜)** 다
   ⟹ 🔵 **그것을 열 것인가가 SPRINT 3 의 CPO 판정 사안이다**
```

### 🟢 검증

```
계약 **31 신규**(`sprint2-stage-metrics.test.ts`) — A 1차 신호 두 축 8 · B 수집기 6 ·
     C 배선 7 · D 판정 승격 금지 5 · E 기존 구조 보존 5
기존 앵커 **1건 갱신·강화** — `pipeline-error-ux` 의 「사이트별 allSettled」 문자열이
     인자 추가로 깨졌다. 🔴 성질(한 사이트 실패 격리)은 불변이라 **느슨하게 하지 않고**
     관측자 배선까지 **같이** 단언하도록 강화했다(M9 가 1 FAIL 로 확인)
음성 대조 **M1~M9 전부 FAIL → 바이트 동일 복구**(md5 3파일 일치 · 흔적 0)
     M1 브랜드 검사 제거 2F · M2 partial 허용 2F · M3 alias 를 단계로 셈 1F ·
     M4 2차 검색 관측자 끊기 1F · M5 멈춤 조건에 PRESUMED_SAME 1F ·
     M6 신호를 조기종료 조건으로 승격 2F · M7 날것 후보에서 셈 1F ·
     M8 alias 2차 호출 조건 완화 1F · M9 사다리 배선 끊기 2F
회귀 **11,042 passed / 876 files · failed 3 = 기준선 전부**(golf01-wire-page-chain)
     🟡 2차 실행에서만 `coupang/notice-regression` 1건 실패 — 단독 **7/7 PASS** ·
        운영 트리가 **동일한** 1·3차는 통과 ⟹ 🔴 내 변경이 원인일 수 없다 · **원인 미규명**
typecheck **0** · build **exit 0** · 배포 `5d560002`(빌드 로그 `Commit: 5d56000`) ·
Production root **200** · /today·/pipeline **307**(정상 인증)
```

### 🔴 측정불가 / 한계

```
⒜ 🔴 **실제 라이브 수치를 이 세션에서 재지 않았다** — 계측을 «심었고» 그 값은
   운영 호출에서 나온다. SPRINT 1 기준선(HTTP 6 · 상세 0 · 1,320ms · 후보 5)과의
   대조는 **다음 라이브 실행** 에서 가능하다 ⟹ 「비용이 줄었다」로 적지 않는다
⒝ 🔴 `searchWith` 가 던지면 그 칸은 **기록되지 않는다**(`status:"error"` 로 간다) —
   그때 「요청 0」으로 읽히지 않도록 샵 status 와 같이 읽어야 한다
⒞ 🔴 어댑터 **안쪽** 상세 HTTP(예: `MAX_DETAIL_LOOKUPS`)는 계측하지 않았다 —
   `detailModelCodeFetches` 는 `fetchDomesticModelCode` **시도 수** 다(기존 칸 재사용)
⒟ 🔴 1차 신호의 실제 발생률 **미측정** — SPRINT 1 표본에서는 후보 `brandModelCode` 가
   전건 null 이라 **0 이 예상되지만** 그것은 예상이고 측정값이 아니다
```

---

## D-sx4. 🔴🔴 **B226AC038 라이브 계측 — 선행 확인 완료 · 실행 BLOCKED**(2026-11-16 · HTTP 0 · 배포 `14dad602`)

🔵 **CPO 확정 기준 상품** — Bobo Choses **Hidden Monster Sweatshirt · `B226AC038`**.
🔵 검증 축 넷 — A 동일상품 식별 · B 이미지 일치 · C 링크 정확성 · D 가격/판매상태.
🔴 CPO 핵심 — 「**검색 결과가 나왔다**」와 「**정상적인 상품 발견**」을 가른다.

### 🟢 구현·배포한 것 (그 분리를 계측에 심었다 · HTTP 0)

```
verifyDomesticCandidates(candidates)  →  칸별로 센다. 🔴 **판정하지 않는다**
  링크   classifyUrlShape — detailPage / listingPage / **unknownShape(판별 불가)**
         🔴 목록·브랜드·카테고리를 **상세페이지로 확인된 것처럼 기록하지 않는다**
         🔴 판별 규칙을 복제하지 않는다 — 기존 owner **하나** 를 부른다
  이미지 withImage / **imageUnavailable** 🔴 「있다」만 센다 — **「일치한다」가 아니다**
         (§5-D 보조 근거 · 표준 §2.2 가 SAME 정원에서 제외 ⟹ CTO 가 판정하면 반칙)
  가격   priceConfirmed = `VERIFIED_CURRENT` 만
요약에 `candidates` 와 `verification` 을 **따로** 둔다 — 🔴 합계가 후보 수와 **같지 않을 수
있고 그것이 정상** 이다(목록 링크 2건 ⟹ detailPage 0 · listingPage 2)
🔴 이 숫자는 **SAME 의 근거가 아니다** — 이미지 오류·목록 링크는 「노출 품질 실패」·
   「연결 품질 미달」이고 **동일성 축이 아니다**(CPO 표 그대로)
```

### 🔴🔴 블로커 둘 — **실측으로 확인했다**(추측 아님 · 그 자리에서 오보고한 선례가 있다)

```
⒜ **지시서의 6개 URL 이 «없다»**
   B226AC038 로 저장소 전수(13파일) → URL 은 **하나뿐** 이고 그것은 «원상품» 이다
     https://bobochoses.com/en-kr/products/b226ac038-hidden-monster-sweatshirt
   판매처 URL 들은 **다른 상품** 이다 —
     vividvia  → **B226AC009**(Hug Hairy Monster T-shirt) · coupleshot → `branduid` 만 ·
     nordstrom → **Sergio Tacchini** 목록/browse · stitchhouse **0** · jamesxbasile **0**
   🔴 URL 을 **지어내지 않았다**(이 트랙의 금지 행위)
⒝ **국내 2곳은 등록부 검색으로 «도달 불가» 다**
   국내 어댑터 전수 **8** — bobochoses · chocoel · deuxbebe · foretforet · littleluna ·
     looxloo · rulii · skysport(TENNIS) ⟹ **아동 실효 6**
   🔴 `vividvia.com` · `coupleshot.com` 은 어댑터가 **없다** ⟹
     `findPriceSourceAdapter(domain,"DOMESTIC") === null` → `status:"unsupported"` →
     **요청을 한 번도 보내지 않는다**(WU-115 가 반사실로 확정: 전략을 AUTO 로 세워도 후보 0)
   ⟹ 🔴 그 둘은 **URL 을 받아야만**(`candidateUrls`) 파이프라인에 들어온다
```

### 🔵 승인만 있으면 한 번에 끝난다 — **CPO 가 고를 둘**

```
① URL 6개 전달        `candidateUrls` 경로로 6곳 전수 검증(A~D 전 축) · 예상 HTTP **6**
② URL 없이 운영 경로만  원상품 → 국내 등록부 6곳 검색 · 예상 HTTP **6**(SPRINT 1 과 동일)
                      🔴 단 지시서의 그 6곳은 **못 본다**(⒝ 때문)
①+② 둘 다 ⟹ HTTP **12**
🔴 「HTTP 1회」를 **요청 1건** 으로 읽으면 어느 쪽도 불가능하다(SPRINT 1 도 6회였다) ⟹
   **숫자로 승인** 해 주셔야 실행한다. 🔴 추측해서 쏘지 않는다
   (메모 `time-gated-calls-need-a-networkless-dry-run` — 승인 경계를 추측해 사고를 냈다)
```

🔴 **B226AC038 스냅샷이 DB 에 있는지는 확인하지 않았다** — ②를 고르면 그것이 선행 확인이고,
WU-133 의 「B226AC010 스냅샷이 DB 에 없다 ⟹ 측정불가」와 같은 자리다. 🟢 없더라도
WU-138 하니스처럼 **원상품 URL 에서 직접 추출** 하는 길이 있다(그때 HTTP +1).

---

## D-sx5. 🟢🟢 **B226AC038 라이브 계측 실행 완료 — 승인 HTTP 6 중 «4» 사용**(2026-11-16)

🟢 원본 `docs/SPRINT2-LIVE-AC038-2026-11-16.json` · 하니스 `sprint2-live-ac038.test.ts`
(🔴 `SPRINT2_LIVE_AC038=1` 없으면 **항상 SKIP** ⟹ 회귀 기준선 불변).
🔴 ② 운영 등록부 경로 **미실행**(CPO 미승인) · 운영 코드 변경 **0** · 기준 URL 재조회 **0**.

### 🟢 CONTROL — 원상품은 **운영과 같은 owner 로** 세웠다(§5-B)

```
DB 스냅샷 `a4fd7939`(`workspace->canonicalProduct` 원문) →
  backfillCanonicalProduct → buildProductIdentityDna → originFactsFromIdentityDna
  (운영 `check/route.ts:87·151` 과 **같은 순서**)
🟢🟢 그 결과 **brandModelCode = `B226AC038` 이 복원됐다** — 저장된 canonicalProduct 에는
   그 칸이 **없다**(키 부재). DNA 생성기가 URL/설명에서 파생한다 ⟹
   🔴 「저장 칸이 null 이니 품번이 없다」로 읽으면 **틀린다**
brand "Bobo Choses" · color "Blue" · title "Hidden Monster sweatshirt"
```

### 🔴 HTTP 실사용 — **4건**(승인 6). 🔴 「6건 썼다」로 적지 않는다

```
vividvia        1 → **OK**
coupleshot      1 → **NO_FACTS**      (목록이 모양 게이트를 **통과해** HTTP 를 썼다)
junioredition   **2** → **UNREACHABLE** (🔴 재시도 1회 포함 · WU-084 경로)
nordstrom       **0** → NOT_PRODUCT_PAGE  ← 🔴 요청 전에 거부
james-basile    **0** → NOT_PRODUCT_PAGE  🟢 브랜드 목록이므로 **올바른 차단**
stitch-house    **0** → NOT_PRODUCT_PAGE  🟢 상품 목록이므로 **올바른 차단**
```

### 🔵 CPO 결과표 — 그대로 채웠다

| 결과 | 건수 | 어디 |
|---|---:|---|
| SAME + 이미지 정상 + 상세 링크 정상 (**정상 발견**) | **0** | — |
| SAME + 이미지 오류 | 0 | — |
| SAME + 목록 링크 | 0 | — |
| **SIMILAR / PRESUMED_SAME**(동일 확정 **아님**) | **1** | vividvia |
| 검색 결과 없음 / 도달 실패 | **5** | 아래 셋으로 **갈라진다** |

🔴 **그 5 를 한 숫자로 적지 않는다 — 원인이 셋이다**:
```
🟢 올바른 차단 **2**  james-basile(브랜드 목록) · stitch-house(상품 목록) · HTTP 0
🔴 오차단 **1**      **nordstrom `/s/…` 상품 상세가 `NOT_PRODUCT_PAGE`** ⟹ 요청조차 안 했다
🔴 도달 실패 **1**    junioredition **UNREACHABLE**(2 HTTP) — 🔴 fixture 기준으로
                     BRAND·MODEL_CODE·PRODUCT_NAME·FORM_DESIGN 이 **전부 MATCH** 였던 유력 후보다
🟡 오통과 후 탈락 **1** coupleshot 목록이 모양 게이트를 **통과**(한국 CMS `shopbrand`)해
                     HTTP 1 을 쓰고 `NO_FACTS` 로 걸렸다 🟢 후보가 되지는 않았다(깊이방어)
```

### 🔵 유일한 생존 후보 — vividvia (A~D 분리)

```
A 식별  brand **"보보쇼즈"**(한글) ↔ 원상품 "Bobo Choses" ⟹ blocker **BRAND_MISMATCH**
        code **B226AC038 exact** 🟢 · sellerSku null
        🔴 **1차 식별 신호 = false** — 품번은 맞는데 **브랜드 표기가 달라** 서지 않았다
        verdict **PRESUMED_SAME** · matchLevel low ⟹ 🔴 **SAME 아님**(확정 인정 안 함)
B 이미지 **존재 자체가 false**(`imageUrl` null) ⟹ **이미지 검증 불가**
        🔴 「일치/불일치」를 적지 않았다 — `imageMatchesProduct: UNVERIFIED_BY_CTO`
C 링크  **PRODUCT_PAGE · 상세 정상** 🟢
D 가격  **KRW 138,000 · VERIFIED_CURRENT** · soldOut **null**(품절 신호 없음 = 모른다)
```

### 🔴🔴 대표님이 제보한 두 문제 — **둘 다 재현됐다**

```
① 상품 식별/이미지 오류  🔴 vividvia 는 **상세 링크가 정상인데 이미지를 아예 못 읽는다**
   ⟹ 셀러 화면에서 「이미지가 다른 상품」으로 보이는 그 자리와 같은 축이다
   🔴 단 **우리 추출이 이미지를 못 읽은 것** 이고 「사이트가 틀린 이미지를 준다」와는
      **다른 사실** 이다 — 이 측정으로는 그 둘을 **가르지 못했다**(측정불가)
② 링크 연결 오류        🟡 coupleshot 목록이 모양 게이트를 **통과했다**(알려진 오통과) ·
   🟢 `NO_FACTS` 가 막아 후보가 되지 않았다 ⟹ 지금은 **화면에 서지 않는다**
🔴🔴 **새로 나온 것 하나 — Nordstrom 오차단.** 정상 상품 상세(`/s/<slug>/<id>`)가
   `classifyUrlShape` 에서 거부된다. 🔴 WU-073 이 기록한 「분류기 양방향 오류」의
   **새 실례** 이고 WU-052 가 HOLD 한 자리다 ⟹ **고치지 않았다**(CPO 판정 사안)
```

### 🔴 고치지 않은 것 · 측정불가

```
🔴 brand alias 확대 금지축 ⟹ 「보보쇼즈 → Bobo Choses」를 **넣지 않았다**(§5-D 명시)
🔴 `classifyUrlShape` 수정 금지(WU-052 HOLD) ⟹ nordstrom 오차단을 **열지 않았다**
🔴 SAME 정책·임계값 **변경 0** · 이미지/링크 오류를 SAME 근거로 **쓰지 않았다**
측정불가 — ⒜ 이미지 「사이트 오류」 ↔ 「우리 추출 실패」 **미분리**
          ⒝ junioredition UNREACHABLE **원인 미규명**(재시도 2회 후 실패)
          ⒞ nordstrom·james-basile·stitch-house 는 **요청을 보내지 않았다** ⟹
             그 페이지의 실제 내용은 **확인되지 않았다**(「상품 없음」이 아니다)
          ⒟ 표본 **원상품 1 · URL 6** ⟹ 전수 환산 금지
```

---

## D-sx6. 🟢🟢 **SPRINT 2 후속 ①② — 구현·배포 완료**(2026-11-16 · `beea5b59` · HTTP 0)

🔴 CPO 승인 범위 — ① WU-052 HOLD **이번 건 한정** 해제 · ② **기존 자산 재사용·연결만**.
🔴 공통 제한 전수 준수 — SAME 정책·임계값·8축 **0** · 가격 정책·DB·등록 payload **0** ·
HTTP **0** · 신규 alias **0** · 분류 정책 전체 완화 **0**.

### ① URL 오차단 — `/s/<하이픈 슬러그>/<숫자 id>`

```
🔴 손실의 정체  `s` 는 `PRODUCT_PATH` 에도 `LISTING_PATH` 에도 **없다** ⟹ `UNKNOWN_PAGE` ⟹
                후보 풀은 `PRODUCT_PAGE` 만 열므로 **요청조차 나가지 않았다**
🔴 하지 않은 것  토큰 목록에 `s` **추가 금지** — `/s/sale`·`/s/search`·`/s/new` 가 전부
                상품이 되고, 그것이 CPO 가 「승인하지 않겠다」고 한 그 부작용이다.
                🔴 그리고 한 글자 토큰은 SPRINT-02 가 고친 **`c` 사고와 같은 종류** 다
🟢 한 것        `PRODUCT_ITEM_ID_SUFFIX`(SP-13)와 **같은 설계** — 셋을 **동시에** 요구한다
                ⒜ `s` 가 경로 **세그먼트** ⒝ 그 아래가 **하이픈 포함 슬러그**
                ⒞ **마지막 세그먼트가 숫자만**
🔴 도메인 조건 **0**(사이트 전용 규칙 금지) · `og:type` 역수입 **0** · 기존 토큰 변경 **0**
🟡 미측정 위험  「하이픈 카테고리 + 숫자 꼬리」(`/s/womens-clothing/12345`) 모양 목록은
                이 표본에 **없었다**. 있으면 통과한다 — 🟢 그때도 `factsFromProductUrl` 의
                `NO_FACTS` 가 **두 번째 층** 으로 막는다(실측에서 coupleshot 이 그렇게 걸렸다)
```

### ② 한글 브랜드 표기 — **기존 등록부를 «비교» 에서 재사용**

🔴 **CPO 세 질문의 답**:
```
⒜ 검색어 생성에만 쓰이는가   🔴 아니다 — **셋** 이다
   검색어 생성(`run-domestic-price-check:1305·1713` · `domestic-listing-pool`) ·
   **`facts.brand` 생산**(`product-url-facts:255` — 브랜드가 **없을 때만** og:title 에서 복구) ·
   관찰/설명(`evidence-explain` · `brand-description-evidence` · `identity-evidence-summary`)
⒝ cross-seller 비교에 쓸 수 있는가  🔴 **지금은 연결 안 돼 있었다**
   `brandsCompatible` → `brandIdentitiesCompatible(resolveBrandIdentity(…))` 이고 그 둘은
   `packages/shared` 다. 그 패키지의 dependencies 가 `{}` 라 crawler 의 등록부를
   **구조적으로 볼 수 없다** ⟹ 그래서 한글 표기가 `BRAND_MISMATCH` 로 떨어졌다
⒞ 비교 함수에서 재사용 가능한가  🟢 **가능** — `brandsCompatible` 은 `cross-seller.ts`(crawler)
   이고 `./brand-alias` 와 **같은 패키지** 다(순환 0)
```

🟢 **연결 방식**:
```
brandsCompatible(a,b)
  ① 기존 판정 그대로 — 참이면 **등록부를 보지 않는다**(기존 경로 불변)
  ② 실패했을 때만 `registryCanonicalBrand` 로 양쪽을 등록부 정규명으로 환원한 뒤 재비교
     `isKnownProductBrand(raw)` ? raw : `lookupBrandByAliasInTitle(raw)`
  🔴 한쪽이라도 등록부가 모르면 **그대로 불일치** — 「모른다」를 「같다」로 읽지 않는다
🔴 **추출은 건드리지 않았다** — `facts.brand` 는 판매처가 적은 값 그대로다
   (WU-151 이 「소비처가 `brandFromHtml` 이므로 동작을 건드리면 **확정 브랜드가 움직인다**」
    고 금지한 자리 · 계약 E-4 가 그 금지를 잠근다)
🔴 이것은 「브랜드 불일치 차단 완화」가 **아니다** — 완화는 **다른 브랜드** 를 같다고 하는 것이고,
   이 연결은 **같은 브랜드의 등록된 다른 표기** 를 인식하는 것이다(거짓 신호 제거).
   🟢 같은 파일에 선례가 있다 — 이 함수가 `includes` 였을 때
      「Konges Sløjd A/S ↔ … Clothing 30% Off Sale」가 불일치였고 그것이 **SAME 도달을
      막는 단일 최대 원인** 이었다(P0-A.35 ④).
🔴 사정거리는 **등록부 4건** 뿐 — 신규 alias 0 · 음역 추론 0 · 사전 확대 0 · 도메인 조건 0
🔴🔴 **품번 exact 를 SAME 으로 승격하지 않았다** — 브랜드 축 하나만 돌려주고
   `SAME_MIN_AXES` 와 blocker 전수는 **그대로** 다(계약 E-5)
```

### 🟢 검증

```
계약 **29** — 양성 4(실측에서 잃은 그 URL · 쿼리·끝슬래시·로케일) ·
  🔴 **음성 12**(`/s/sale`·`/s/search`·`/s/new`·숫자꼬리 없음·숫자아닌 꼬리·`/shoes/…` ·
     실측에서 **올바르게** 차단된 james-basile·stitch-house 유지 · 모르는 표기 ·
     유사품 표기(「보보쇼즈풍」) · 다른 등록 브랜드 · 한쪽만 등록 · 시즌코드/빈값) ·
  구조 보존 5(등록부 4건 그대로 · 기존 조회 함수 호출 · 1차 우선 · **추출 불변** · 품번 승격 0)
음성 대조 **M12** `/s/` 전면 허용 → **7 FAIL**(CPO 금지 부작용을 정확히 잡는다) ·
         **M13** 모르는 이름을 등록 브랜드로 접음 → **6 FAIL** ·
         **M14** 1차 비교 경로 제거 → **1 FAIL**   → 전부 **바이트 동일 복구**
회귀 **11,079 passed / 877 files · 실패 3 = 기준선 전부**(`golf01-wire-page-chain`)
  🟢🟢 ⟹ **false SAME 0** — human GT·골든 계약이 **하나도 깨지지 않았다**
typecheck **0** · build **exit 0** · 배포 `beea5b59`(빌드 로그 `Commit: beea5b5`) · root **200**
```

### 🔴 측정불가 / 남은 것

```
⒜ 🔴 **이 둘이 vividvia 를 «SAME 까지» 올리는지는 재지 않았다** — 재측정은 HTTP 가
   필요하고 승인 범위 밖이다. 🟢 blocker `BRAND_MISMATCH` 는 사라진다(계약 C-1) ·
   🔴 그러나 SAME 은 `SAME_MIN_AXES` 를 지나야 하고, fixture 근거로는 축 **4개 MATCH**
   (BRAND·MODEL_CODE·PRODUCT_NAME·FORM_DESIGN)에서도 baseline 이 **PRESUMED_SAME** 이었다
   ⟹ 🔴 「국내 SAME 이 생겼다」로 적지 않는다
⒝ 🔴 Nordstrom 페이지의 **실제 내용은 여전히 확인되지 않았다** — 분류가 고쳐졌으니
   **다음 라이브에서 열린다**. 「상품이 거기 있다」는 아직 측정되지 않았다
⒞ 🔴 junioredition UNREACHABLE **원인 미규명**(이 후속 조치가 그것을 고치지 않는다)
⒟ 🔴 라이브 하니스가 **후보 facts 전문을 저장하지 않았다** ⟹ 오프라인 반사실이 불가능했다.
   다음 라이브에서 facts 를 같이 덤프하면 그 반사실이 **HTTP 0 으로** 가능해진다
```

---

## D-sx7. 🔵🔵 **동일 6 URL 재실측 — 수정 둘의 효과가 «갈렸다»**(2026-11-16 · HTTP **5/6** · `3dd8d56c`)

🟢 원본 `docs/SPRINT2-LIVE-AC038-RERUN-2026-11-16.json`(🔴 1차 산출 `…-2026-11-16.json` 는
**덮어쓰지 않았다** — CPO: 「계측 결과와 기존 실행 결과를 구분해서 보고」).
🔴 운영 코드 변경 **0**(배포본 `beea5b59` 와 바이트 동일) · provider **0** · 상세요청 **0**.

### 1차 ↔ 재실측 대조 (같은 6 URL · 같은 기준 스냅샷 `a4fd7939`)

| URL | 1차 | 재실측 | 판정 |
|---|---|---|---|
| nordstrom `/s/…/9195361` | HTTP **0** · `NOT_PRODUCT_PAGE` | HTTP **1** · `NO_FACTS` | 🟢 **분류 통과** · 🔴 사실 추출 실패 |
| vividvia | 1 · OK · **BRAND_MISMATCH** · 신호 false | 1 · OK · **blockers `[]`** · 신호 **true** | 🟢🟢 **거짓 신호 제거 확인** |
| coupleshot `shopbrand.html` | 1 · `NO_FACTS` | 1 · `NO_FACTS` | 🟡 모양 오통과 그대로 · 🟢 후보 **0** |
| junioredition | **2** · `UNREACHABLE` | **2** · `UNREACHABLE` | 🔴 **재현** |
| james-basile `/brands/…` | 0 · 차단 | 0 · 차단 | 🟢 유지 |
| stitch-house `list.html` | 0 · 차단 | 0 · 차단 | 🟢 유지 |
| **합계** | HTTP 4 · 후보 1 · SAME **0** | HTTP **5** · 후보 1 · SAME **0** | — |

### 🟢🟢 ② 의 효과는 측정됐다 — 그리고 **SAME 은 오르지 않았다**

```
vividvia  brand 「보보쇼즈」 · code **B226AC038 exact** · sellerSku null
  1차 식별 신호  false → 🟢 **true**(브랜드 «그리고» 품번 둘 다 일치)
  blockers      [BRAND_MISMATCH] → 🟢 **[]**
  verdict       PRESUMED_SAME → 🔴 **PRESUMED_SAME (변화 없음)**
  reasons 3개   「핵심 상품명 일부 hidden/monster」·「브랜드 품번 일치」·「상품군 TOP↔TOP」
  🔴 **왜 SAME 이 아닌가** — 후보 `colorText` **null** · `materialText` **null** ⟹
     축이 **3개** 뿐이고 `SAME_MIN_AXES` 에 닿지 않는다
⟹ 🟢🟢 **「BRAND_MISMATCH 해소 ≠ SAME 도달」이 실측으로 확인됐다**(내 보고의 경고 · CPO 주의)
⟹ 🟢 **SAME 승격을 강제하지 않았다**(CPO 조건 4) · 🔴 「국내 SAME 이 생겼다」로 적지 않는다
```

### 🟢 ① 의 효과도 측정됐다 — 그런데 **막는 곳이 한 칸 뒤로 옮겨졌다**

```
1차   모양 게이트에서 거부 ⟹ **요청조차 나가지 않았다**(HTTP 0)
재실측 모양 게이트 **통과** ⟹ 페이지를 **열었다**(HTTP 1) ⟹ 🔴 `NO_FACTS`
🔴 그러므로 **「정상 상품 발견」으로 기록하지 않는다**(CPO 조건 그대로).
🔴 원인 미규명 — `NO_FACTS` 는 `<title>`/`og:title` 을 못 읽었다는 뜻이고, 봇 차단인지
   JS 렌더인지 가르려면 **추가 HTTP** 가 필요하다(승인 범위 밖) ⟹ **측정불가**
🟢 분류 수정 자체는 **작동했다** — 그것이 이번에 확인하려던 것이다
```

### 🔴 측정 한계 · 고치지 않은 것

```
⒜ 🔴 junioredition 의 **2 HTTP** 는 내 재시도가 아니라 운영 `factsFromProductUrl` 내부의
   헤더초과 복구(WU-084)다. 🟢 누적 상한으로 묶어 총 5/6 · 🔴 운영 변경은 승인 범위 밖
⒝ 🔴 nordstrom `NO_FACTS` 원인 **미규명** · ⒞ 🔴 junioredition `UNREACHABLE` 원인 **미규명**
⒟ 🔴 coupleshot 모양 오통과는 **그대로** 다(WU-052 범위 밖 · 🟢 후보로는 들어오지 않는다)
⒠ 🔴 이 verdict 는 **cross-seller 판정** 이고 운영 최종 tier 가 아니다 —
   `judgeDomesticCandidate`·`enrichCandidatePrices` 를 **부르지 않았다**(승인 6건 초과)
⒡ 🟢 **후보 facts 전문을 보존했다** ⟹ 다음 반사실은 **HTTP 0** 으로 가능하다
```

### 🔵 이 재실측이 CPO 에게 남기는 질문 **하나**

```
🔴 국내 동일상품이 SAME 에 닿지 못하는 **현재의 직접 원인은 「축 부족」** 이다 —
   후보 페이지가 **색상·소재를 구조화해 주지 않는다**(vividvia 실측: 둘 다 null).
🔴 그 둘을 메우는 길은 **상세설명 증거 연결** 이고, 그것은 CLAUDE.md §5-D 가
   「**정밀도 재측정 WU 하나**」를 재개 조건으로 걸어 둔 **동결된 축** 이다.
⟹ 🔵 **그 동결을 열 것인가가 SPRINT 3 의 CPO 판정 사안** 이다. 🔴 CTO 가 열지 않았다.
```

---

## D-sx8. 🔵🔵🔵 **SPRINT 3 선행 — GT 정밀도 재측정**(2026-11-16 · HTTP 0 · 운영 코드 **0**)

🔴🔴 **착수 전 확인(§4-D)이 이 WU 의 답을 바꿨다 — 이 측정은 «이미» 수행돼 있다.**

```
docs/MI-REEVAL-STEP5-SHADOW.json   2분모 혼동행렬 · 방향별 변화 · A/B/C **합산 금지** 선언
docs/MI-REEVAL-STEP5-SHADOW.md     V1↔V2 분석 + 🔴 **CPO 판단 요청 넷**(답 미수신)
docs/MI-REEVAL-STEP6-HOLD-AND-COLOR.md  COLOR 경계·보류 승격 + 🔴 CPO 판단 요청 넷
docs/MI-DESC-COMPARE-REPORT.md     비교가능 82 · 신규 증거 3 · GT 12쌍 오포함 0
fixtures/mi-reeval-01-desc-pairs.json  B군 **109쌍**
⟹ 🔴 **새 측정을 만들지 않았다.** 한 것은 ⒜ 독립 재집계로 **검증** ⒝ 재현 실패 구간을
   **FAIL 조건으로 고정** ⒞ CPO 7항목에 대한 **공백 특정** 이다.
계약 `sprint3-gate-gt-precision.test.ts` **23건** (HTTP 0 · 운영 import **0**)
```

### 🔴 제한 1 — 분모 넷은 **서로 다르다**(합산하지 않았다)

```
A군(STEP5 pairsA)        **33**   🔴 후보 설명문 **0/33**(원상품만 33/33)
B군(desc-pairs)          **109**  ⟹ 🔴 GT 라벨 보유는 **36** (SAME 20 · DIFFERENT 15 · SIMILAR 1)
                                     라벨 없음 **73** ⟹ 「DIFFERENT」로도 「측정됨」으로도 안 센다
C군                      **11**   (A∩C = 11 · A∩B = 0 — 파일이 그렇게 선언한다)
CEO 원장                  **9**    🔴 별도 문서 · 숫자로 합치지 않았다
🔴 **「human GT 39」의 출처를 특정하지 못했다** — 위 어느 분모와도 다르다.
   WU-133 의 `candidate_reviews` **라벨행 39**(고유 37)로 보이지만 **확인하지 못했다** ⟹
   🔴 그 39 를 이 측정의 분모로 **쓰지 않았다**(§5-B 「분모를 섞지 않는다」)
```

### 🟢 제한 3·6 — 방향별 오판. **baseline 은 재현되고 shadow 는 재현되지 않는다**

```
독립 재집계(분모 27 = A군 33 − main-story 6)
  baseline  오포함 **1**(S1-6) · 누락 **12**   🟢🟢 저장 guardrail 과 **정확히 일치**
  V1        오포함 **1**(S1-6) · 누락 **5**
  V2        오포함 **0**        · 누락 **8**
🔴🔴 그런데 저장된 guardrail 은 **V1 fp 3 · V2 fp 2** 다 — 같은 분모 선언인데 다르다.
   ⟹ `pairsA` 만으로 저장 shadow 오포함을 **복원할 수 없다**(보이지 않는 GT/필터가 있다)
   ⟹ 🔴 §5-B 에 따라 **shadow 의 오포함 수를 GO 근거로 쓰지 않는다**
   🟢 **누락(fn)은 양쪽이 일치** 한다(V1 5 · V2 8) ⟹ **회수 효과는 인용 가능** 하다
🟢 저장 측정의 방향 기록 — 회수 **7**(C27·C11·C48·C14·C37·S1-1·S1-4) ·
   **정답 SAME 상실 0** · 🔴 새 오포함 **2**(C20·C25 · 둘 다 **main-story** 쌍이다)
```

### 🟢🟢 제한 5 — COLOR / FIT 의 **false DIFFERENT 위험 = 두 군 모두 0 건**

```
A군(33)   COLOR·FORM_DESIGN·MATERIAL MISMATCH 인데 GT=SAME → **0 · 0 · 0**
B군(GT 36) 같은 세 축 → **0 · 0 · 0**
🟢 그리고 차단이 죽지도 않았다 — GT≠SAME 에서 COLOR MISMATCH 가 **정당하게** 쓰인 사례 있음
🔴🔴 **그러나 「동결 사유가 반증됐다」로 적지 않는다** — 위에서 본 것은 **shadow 축 상태**
   (`axisStatus`)이고, 동결 사유가 지목한 `COLOR_VARIANT`·`FIT` 는 운영 **blocker** 다
   (색조 일치 + 색상명 불일치 → 보류 · WU-044). **서로 다른 계산** 이다.
🔵 ⟹ **남은 공백은 하나로 좁혀졌다** — 「운영 `COLOR_VARIANT`/`FIT` blocker **×** GT」
   교차표. 그 blocker 분포는 측정돼 있으나(`COLOR_VARIONT` 10 · `FIT` 4 · B군) **GT 와
   교차한 표가 없다**(계약 D-4 가 그 부재를 단언한다)
```

### 🔵 제한 4 — CPO 지목 8건 (기존 GT 라벨 **변경 0** · 여덟 건 전부 `priorGt = SAME`)

| 케이스 | baseline | shadow V1 | shadow V2 | 판정 |
|---|---|---|---|---|
| C27 | PRESUMED_SAME | **SAME** | **SAME** | 🟢 회수(CEO 최신도 SAME) |
| S1-4 | PRESUMED_SAME | **SAME** | **SAME** | 🟢 회수 |
| S1-1 | SIMILAR | **SAME** | SIMILAR | 🟡 **V1 에서만** 회수 ⟹ V1/V2 선택이 이 1건을 가른다 |
| S2-1 | SIMILAR | SIMILAR | SIMILAR | 🔴 회수 안 됨 |
| S2-3 | PRESUMED_SAME | SIMILAR | SIMILAR | 🔴 회수 안 됨 |
| S2-4 | PRESUMED_SAME | SIMILAR | SIMILAR | 🔴 회수 안 됨 |
| S1-7 | **CONFLICT** | SIMILAR | SIMILAR | 🔴 품번 충돌로 조기 반환되는 자리 |
| S3-1 | SIMILAR | SIMILAR | SIMILAR | 🔴 회수 안 됨 |

🔴 즉 **상세설명을 연결해도 CEO 지목 8건 중 회수는 2~3건** 이다(V2 2 · V1 3).

### 🔴 제한 7 — 편향·측정불가

```
⒜ 🔴 A군 **후보 설명문 0/33** ⟹ 「후보측 상세설명 효과」를 그 군에서 **재지 못했다**
⒝ 🔴 B군 양쪽 설명문 보유 **82/109** · GT 보유 **36/109**
⒞ 🔴 baseline 재현 실패 **17건**(B군) — 「판정 변화」로 세지 않는다
⒟ 🔴 브랜드 편향 — Bobo Choses 계열 다수 · `main-story` **6쌍은 별도 집계**
   🔴🔴 그리고 **새 오포함 2건이 전부 그 6쌍 안** 이다 ⟹ 분모 선택이 결론을 바꾼다
⒠ 🔴 shadow 오포함 **재현 실패**(위) ⟹ 정밀도 숫자를 전략 판단에 쓰지 않는다
⒡ 🔴 설명문 **원문** 은 fixture 에 없다(「옮기지 않았다」) · 과거 산출은 **세션 임시
   디렉터리** 였다 ⟹ 🔴 **원문 기반 재계산은 현재 불가**(원상품 설명문만 DB 에 있다)
```

### 🔵🔵 CPO 판정 사안 — **셋** (🔴 CTO 가 고르지 않았다)

```
① **분모** — main-story 포함(오포함 2 추가) ↔ 제외(오포함 불변). 🔴 내가 고르지 않았다
② **V1 ↔ V2** — V1 은 회수 +1(S1-1)에 오포함 +1(S1-6 · 반팔↔긴팔) · V2 는 오포함 0
   🟢 CEO 는 S1-6 에 「유사상품이면 문제없다」고 적었다 ⟹ 그 1건의 허용 여부가 선택이다
③ **shadow 재현 실패를 어떻게 다룰 것인가** — 🔴 그 숫자를 쓰려면 저장 측정의 GT/필터를
   복원해야 하고, 그러려면 **설명문 원문 재수집(HTTP)** 이 필요하다
🔴 그리고 STEP5·STEP6 가 각각 남긴 **CPO 판단 요청 넷** 이 아직 답을 받지 못했다
```

🔴 **운영 연결은 하지 않았다** — 계약 F-1 이 운영 owner 셋의 import 0 을 지금도 단언한다.

---

## D-sx9. 🔵🔵🔵 **GT 정밀도 보완 — 운영 blocker × GT 교차표 + CPO 질문 8개**(2026-11-16 · HTTP 0 · 운영 0)

🔴 CPO 결정 셋을 고정값으로 받았다 — ① A군 분모 **33 기본**(27 은 민감도) ② **V2 안전 기준**
(V1 은 회수 비교용 보존) ③ 저장 shadow 정밀도 **GO 근거 금지 · 원문 재수집 HTTP 미승인**.

### A. 🔵🔵 운영 `COLOR_VARIANT` / `FIT` × GT 교차표

🔴 **shadow `axisStatus` 와 섞지 않았다** — 아래는 전부 **운영 「최초 blocker」** 다.

**B군 — 분모 = GT 보유 36**(109 중 라벨 없음 73 은 **분모에서 제외**)

| 운영 blocker | 발생(중복 집계) | 고유 원상품 | GT=SAME | GT=DIFFERENT | GT=SIMILAR |
|---|---:|---:|---:|---:|---:|
| `COLOR_VARIANT` | **2** | **1**(B226AC033) | **0** | **2** | 0 |
| `FIT` | **1** | **1**(B226AC009) | 🔴 **1** | 0 | 0 |

```
🟢 `COLOR_VARIANT` — GT=SAME 를 막은 사례 **0** · 막은 2건은 **둘 다 GT=DIFFERENT**(정당)
🔴 `FIT` — GT=SAME 를 막은 사례 **1건** (#10 · B226AC009 ↔ junioredition.com)
   🔴 **단독 원인으로 특정할 수 없다** — 그 행의 blocker 는 `FIT` **그리고**
      `BRAND_UNCONFIRMED` **둘** 이다(동반)
🔴🔴 **이 표는 «하한» 이다** — 표의 blocker 칸이 **46/109 에서 잘려 있다**(`…`).
   전건 원본은 `%TEMP%/mi-url-evidence/desc-compare.json` 이었고 **세션 임시 디렉터리라
   지금 없다** ⟹ 잘린 칸에 숨은 `COLOR_VARIANT`/`FIT` 를 복원할 수 없다.
   🟢 참고 — 잘림 없는 전체 집계는 `COLOR_VARIANT` **12** · `FIT` **1**(109 기준)인데
      REPORT 는 `FIT` **4** 라고 적는다 ⟹ 🔴 **잘림이 최소 3건을 숨긴다**(확정)
```

🟢 **보강 — REPORT 의 「개선 가능 6건」 표는 잘리지 않은 blocker 전수다**(재측정 아님 · 인용)

| 원상품 | 후보 | 최초 blocker |
|---|---|---|
| B226AC009 | junioredition.com | `FIT` `BRAND_UNCONFIRMED` |
| B226AC009 | miniboutique.co.kr | `NO_TITLE_OVERLAP` |
| B226AC033 | junioredition.com | `MATERIAL` |
| B226AC038 | junioredition.com | `MATERIAL` |
| B226AC073 | junioredition.com | `COLOR_VARIANT` |
| WK21A165 | junioredition.com | `MATERIAL` |

🔴 그 6건은 **「품번 증거를 갖고도 막힌」** 집합이고 **GT=SAME 집합이 아니다** — 섞지 않는다.

**A군 — 🔴 쌍 단위 운영 blocker 산출물이 «없다»**

```
`pairsA`(33)에 **blocker 칸이 없다**(키 전수: pairId · domain · originUrl · candidateUrl ·
priorGt · ceoLatest · baselineReproduced · shadowV1 · shadowV2 · shadowV1SynonymOff · axes)
⟹ 🔴 A군 33쌍 전수 교차표는 **측정불가** 다(원문 없이 blocker 를 재계산할 수 없다).
🟢 CEO 원장 범위에서는 기록돼 있다(ledger · CTO-HANDOVER-NEXT:128·234·287 인용):
   S1-4 `FIT`(GT SAME) · S2-3 `MODEL_CODE_AGE_LINE`+`FIT`(GT SAME) ·
   S2-4 `MODEL_CODE_AGE_LINE`(GT SAME) · C14 code unavailable ·
   C11 · C48 · C37 `BRAND_UNCONFIRMED` 뿐
⟹ 🔴 A군에서 `FIT` 이 GT=SAME 를 막은 사례 **2**(S1-4 · S2-3 · 둘 다 동반 blocker 있음) ·
   `COLOR_VARIANT` 는 **0**
```

🔵🔵 **합산하지 않은 결론 — 두 blocker 의 위험도가 «다르다»**

```
`COLOR_VARIANT`  GT=SAME 를 막은 사례  A군 **0** · B군 **0**   ⟹ 🟢 측정 범위에서 위험 0
`FIT`            GT=SAME 를 막은 사례  A군 **2** · B군 **1**   ⟹ 🔴 위험이 «실재» 한다
🔴 전부 **동반 blocker** 가 있어 FIT 단독 기여를 분리하지 못했다(측정불가)
🔴 그리고 동결 사유는 둘을 **한 묶음** 으로 적고 있다 ⟹ 🔵 **그 둘을 가르는 것이 CPO 판정 재료다**
```

### B. 🔴 STEP5 · STEP6 「CPO 판단 요청」 **8개 — 원문 그대로**

🔴 요약하지 않았다 · 새 질문으로 바꾸지 않았다. 출처는 각 문서의 그 절이다.

**STEP 5(`MI-REEVAL-STEP5-SHADOW.md` §10) — 넷**

```
① 🔴 **어느 분모를 기준으로 볼 것인가** — 33쌍(MS 포함 · FP 1→5 ⟹ 개선 아님) ↔
   22쌍(MS 제외 · FP 1→1 ⟹ 충족). 🟢 운영은 이미 MS 를 제외하므로 **22 가 현실** 이지만,
   CTO 가 분모를 골라 숫자를 좋게 만들지 않았다 — **판정은 CPO** 다.
② 🔴 **V1 ↔ V2** — V1 은 FN 5(TP 12)에 FP 1(S1-6 · 반팔↔긴팔), V2 는 FN 8(TP 9)에 FP 0.
   🟢 CEO 는 S1-6 에 「유사상품이면 문제없다」고 적었다 ⟹ 그 1건을 허용할지가 선택이다.
③ 🔴 **보류 승격을 운영에 반영할 것인가** — FN 7건 회수는 「품번 일치인데 `PRESUMED_SAME`」을
   SAME 으로 올린 것이다. 🔴 그 완화는 과거 WU 들이 **반복해서 위험하다고 측정한 축** 이다
   (`crossSellerReserved` 우회 시 precision 91.7% → 55.6%). ⟹ **별도 검증 WU 가 필요하다.**
④ 🔴 `folkberlin` COLOR **추출 결함**(브랜드명 오염)을 고칠 것인가 — 고치면 B군 측정값이 바뀐다.
```

**STEP 6(`MI-REEVAL-STEP6-HOLD-AND-COLOR.md` §E) — 넷**

```
① 🔴 **보류 승격을 운영에 반영할 것인가** — 이번 검증의 답은 이렇다:
   · 무조건 승격 ⟹ **전부 위험**(과거 저하 조건이 재현됐다 · FP 1→8)
   · 조건부(보류 + 품번 일치) ⟹ 22쌍에서 **통과하지만** FN 이 9 로 남고 V1 보다 약하다
   · V1(STEP 5) ⟹ 22쌍에서 FN 5 · FP 1 이고 그 회수의 **4/7 이 신규 증거** 다
   ⟹ 🟡 **CTO 권고는 「V1 중에서도 «신규 증거 4건» 축만 따로 검증」** 이다(상태 승격 3건 분리)
② 🔴 **상태 승격 3건(C11 · C48 · C37)을 허용할 것인가** — 근거가 늘지 않았고
   셋 다 `BRAND_UNCONFIRMED` 다. 🔴 그 축의 완화는 WU-080 이 **REJECT** 한 자리다.
③ 🔴 **단어 경계 결함을 고칠 것인가** — A군 4쌍이 바뀌므로 STEP 5 수치가 갱신된다.
   🟡 CTO 권고는 **고치는 쪽** 이다(`embroidered`→red 는 명백한 거짓 증거다).
④ `B-shadow-v2` 를 이후 기준으로 쓸 것인가(현재는 v1 과 **두 열로** 보존 중이다).
```

🔵 **CPO 결정으로 이미 답이 내려간 것 둘**(이번 지시서가 답했다 — 질문에서 내린다):
```
🟢 STEP5-① 분모 ⟹ **A군 33 기본 · 27 은 민감도**(CPO 확정 2026-11-16)
🟢 STEP5-② V1↔V2 ⟹ **V2 안전 기준 · V1 회수 비교용 보존**(CPO 확정 2026-11-16)
🟢 STEP6-④ 는 ②와 같은 선택이므로 **함께 답됐다**
⟹ 🔴 **남은 질문은 다섯** 이다 — STEP5-③④ · STEP6-①②③
```

### 🟡 남은 다섯에 대한 CTO 권고 (🔴 결정은 CPO)

| # | 질문 | CTO 권고 | 근거 |
|---|---|---|---|
| S5-③ | 보류 승격 운영 반영 | 🔴 **반영 금지** | `crossSellerReserved` 우회가 precision 91.7%→55.6%(WU-066 실측) |
| S5-④ | `folkberlin` COLOR 추출 결함 수정 | 🟡 **수정** | 원본 grey ↔ 후보 blue/red 인데 브랜드명 오염으로 축이 섞였다 · B군 수치는 **갱신 공지** 필요 |
| S6-① | 승격 범위 | 🟡 **「신규 증거 4건」 축만 별도 검증** | 무조건 승격은 FP 1→8 재현 · 상태 승격 3건은 근거 증가 0 |
| S6-② | 상태 승격 3건(C11·C48·C37) | 🔴 **불허** | 셋 다 `BRAND_UNCONFIRMED` 단독 · WU-080 이 **REJECT** 한 축 |
| S6-③ | 단어 경계 결함 수정 | 🟡 **수정** | `embroidered`→red 는 거짓 증거 · 🔴 단 A군 4쌍(C20·C25·S3-2·S6-1)이 바뀌어 STEP5 수치 갱신 |

### C. 🔴 분모·출처

```
🔴 **「human GT 39」의 출처를 특정하지 못했다** ⟹ **정밀도 분모로 쓰지 않았다**(CPO 지시 그대로).
   🟡 가장 가까운 후보는 WU-133 의 `candidate_reviews` **라벨행 39**(고유 37)이고
      그것은 **DB 행** 이라 이 fixture 분모들과 **다른 객체** 다 — 확인은 DB 조회가 필요하다
🟢 CEO GT **9건** 은 별도 유지(`CEO-GT-LEDGER-2026-11-08.md`) · 숫자로 합치지 않았다
🟢 기존 GT 원본 **수정 0** · 기존 측정 산출물 **수정 0**(새 절로만 추가했다)
```

### 🔴 측정불가 (이번 보완에서 새로 확정된 것)

```
⒜ 🔴🔴 **B군 blocker 칸이 46/109 잘려 있다** ⟹ 교차표는 **하한** 이다. 전건 원본이
   세션 임시 디렉터리에 있었고 지금 없다 ⟹ 원문 재수집(HTTP) 없이는 복원 불가
   🟢 잘림이 최소 3건을 숨긴다는 것은 **확정** 이다(REPORT `FIT` 4 ↔ 표에서 1)
⒝ 🔴 **A군 33쌍 전수 교차표는 측정불가** — `pairsA` 에 blocker 칸이 없다
⒞ 🔴 `FIT` 이 GT=SAME 를 막은 3건(A 2 · B 1)이 **전부 동반 blocker** 를 갖는다 ⟹
   FIT **단독** 기여를 분리하지 못했다
⒟ 🔴 B군 GT 분모 36 중 `COLOR_VARIANT`·`FIT` 발생이 **3건** 뿐이다 — 분모가 작다
```

---

## D-sxA. 🔵🔵🔵 **작업 묶음 종료 — 전부 동결**(CPO 최종 판정 2026-11-16 · 배포 `197f7fc6`)

🔴🔴 **다음 세션은 이 절을 먼저 읽는다. 아래 것들을 «다시 열지 않는다».**

### CPO 가 닫은 것 — 전수

| 항목 | 판정 | 상태 |
|---|---|---|
| S5-③ 보류 승격(`crossSellerReserved`) 운영 반영 | 🔴 **불허** | 기존 보류 정책 유지 |
| S5-④ folkberlin COLOR 추출 결함 | 🟢 수정 승인 · 🔴 **운영 적용 불승인** | `colorBrandGuard` **기본 OFF** |
| S6-① 신규 증거 4건 | 🟢 유형별 평가 **완료** | 🔴 운영 SAME 연결 **불허** |
| S6-② 상태 승격 C11·C48·C37 | 🔴 **불허** | `BRAND_UNCONFIRMED` 단독 승격 금지(WU-080 유지) |
| S6-③ 단어 경계 결함 | 🟢 수정 승인 · 🔴 **후보 규칙 폐기** | `wordBoundary` **기본 OFF** |
| STEP5-① 분모 | 🟢 **A군 33 기본** · 27 은 민감도 | 확정 |
| STEP5-② V1 ↔ V2 | 🟢 **V2 안전 기준** · V1 회수 비교용 보존 | 확정 |
| `COLOR_VARIANT` 동결 | 🔴 **유지** | 측정 범위에서 GT=SAME 차단 **0**(🔴 안전성 입증 아님) |
| `FIT` 동결 | 🔴 **유지** | GT=SAME 차단 **3**(A 2 · B 1) ⟹ 🔵 **우선 검증 대상** |
| verdict 재계산 | 🔴 **불승인** | `synthesize()` 복제·별도 구현 **금지** |
| 상세설명 운영 SAME 판정 연결 | 🔴 **동결** | 해제 조건 없음(이번 결과로 열리지 않았다) |
| SPRINT 3 | 🔴 **보류** | CPO 가 재개 조건을 확인한 뒤 결정 |

### 🔴 재개할 때의 **선행 조건 하나** (CPO 문장)

```
「기존 GT 와 원본 산출물을 **보존한 상태** 에서, **실제 상품 설명문을 근거로** 추출
 정밀도를 검증할 수 있는 **조건부터** 확인해야 한다. 그 전까지는 현재 운영 판단을
 변경하지 않는다.」
🔴 즉 다음 작업의 첫 질문은 「무엇을 고칠까」가 아니라 **「설명문 원문을 어떻게 확보하는가」** 다
   (현재 원문은 **없다** — fixture 가 옮기지 않았고 과거 산출은 세션 임시 디렉터리였다).
```

### 🔴 색상 경계 축의 재분류 (CPO 확정)

```
🔴 「색상 토큰 하나의 예외 처리」가 **아니다** ⟹ **한국어 색상 표현과 일반 명사의 경계를
   함께 다루는 «추출 설계» 문제** 로 분류됐다.
🔴 근거(실측) — 과잉차단(「블루계열」)과 과소차단(「그레이스 컬렉션」)이 **같은 길이 조건
   (`f.length < 3`)** 에서 나온다 ⟹ 한쪽을 고치면 다른 쪽이 움직인다.
🔴 접미사 예외 후보(계열·색·컬러·톤·빛)는 **폐기** 됐다 — 자체 생성 문자열 검증뿐이고
   실데이터 성능이 **미확인** 이다.
```

### 🔴 verdict 재검토 시 **먼저 볼 숫자** (이번에 산출됨 · 재계산 아님)

```
🟢 입력 불변            **20**  `UNKNOWN → NOT_APPLICABLE`(규칙이 그 상태를 읽지 않는다)
🔴 SAME 을 «올릴» 가능성  **13**  `PRODUCT_TYPE` MISMATCH 제거 8 + 보조 MISMATCH 제거 5
🟡 SAME 을 «내릴» 가능성   **6**  MATCH 상실 — COLOR 4 · PRODUCT_TYPE 2
🔴 CPO 지시 — 재검토 시 **13 의 상승 가능성과 6 의 하락 가능성을 «함께»** 검증한다
🔴 정적 코드 경로만으로 **실제 verdict 변화가 났다고 주장하지 않는다**
```

### 🟢 이 트랙이 남긴 것 (CPO 최종 문장)

> **「거짓 증거 제거는 진전이지만, 그것이 곧 SAME 판정의 안전성 향상을 뜻하지는 않는다.
> 현재 기준을 동결한다.」**

🟢 측정 산출물 — STEP5(`…STEP5-SHADOW.json/.md`) · STEP6(`…STEP6-HOLD-AND-COLOR.md`) ·
**STEP7**(`…STEP7-EXTRACT-FIX-V2.json` · 신규) · 계약 4파일
(`sprint3-gate-gt-precision` 32 · `sprint3-extract-fix-v2` 26 · `sprint3-gate-boundary-verdict` 17 ·
`sprint2-stage-metrics` 39). 🔴 **전부 보존** · 덮어쓰기 0.

### 🔴🔴🔴 [정정 이력 2026-11-16 · CPO 승인] 위 「재개 선행 조건」의 전제가 틀렸다

🔴 **위 문장들을 지우지 않는다** — 무엇을 근거로 동결했는지가 기록으로 남아야 한다.

```
🔴 폐기   「현재 원문은 **없다** — fixture 가 옮기지 않았고 과거 산출은 세션 임시 디렉터리였다」
🟢 정정   **B군에는 원문이 있지만, 동결 기본 분모인 A군 33쌍에는 후보 원문이 없다**

근거(실측 · HTTP 0 · DB 읽기만)
  🟢 `fixtures/mi-reeval-03-keyword-input.json`(커밋 `269d9b22` · 158,651B)이 **전문** 보유
     원본 92/109 · 후보 98/109 · 양쪽 82/109 · 후보 길이 p50 319자 **max 2,010자**
     🔴 「없다」가 참인 것은 `mi-reeval-01-desc-pairs.json` 뿐이다(불리언만 옮겼다)
  🟢 원본측 ↔ 운영 DB **27/27 바이트 동일** ⟹ fixture 의 「가공 0」이 자술이 아니라 실증
  🔴 후보 원문을 담는 **DB 칸 0개**(migration 전수 · `candidate_reviews`·`ceo_judgments`·
     `workspace.searchRun`) ⟹ 후보측은 transient 이고 **A군은 재수집해야 한다**
  🔴 `aGroupConstraint` = `{candidateDescription: 0, originDescription: 33, of: 33}` ·
     `groups.note` = 「A∩C = 11 · **A∩B = 0**」 ⟹ 🔴 **B군 결과로 A군을 대체할 수 없다**
```

#### 🔵 CPO 결정 (2026-11-16)

| 항목 | 결정 |
|---|---|
| B군 GT **16쌍** 오프라인 검증 | 🟢 **승인 · 실행 완료** |
| A군 **32건** HTTP 수집 | 🔴 **불승인**(16쌍 결과 검토 후 재결정) |
| 설명문 추출 규칙 변경 | 🔴 금지 |
| 추출 가드 기본 ON | 🔴 금지 |
| verdict 재계산 · 상세설명 운영 연결 · SPRINT 3 | 🔴 불승인 / 동결 / 보류 |

#### 🟢 B16 실행 결과 (산출물 `docs/MI-B16-FULLTEXT-EXTRACTION.json`)

```
하니스  `apps/admin/.../__tests__/b16-fulltext-extraction.test.ts` **7/7 PASS**
       🟢 기존 owner 재사용(`extractKeywords` · `compareAxis`) · 🔴 `synthesize` 미호출(계약 F-1)
CONTROL 🟢 전문 재집계가 **STEP 3 산출을 행 단위로 전건 재현**(후보측 16/16 · 원본측 16/16)
       ⟹ 이 측정이 기존 수치를 덮지 않는다는 직접 증거(가드 OFF 바이트 동일 계약 C-1)
분모    16쌍(GT SAME 6 · DIFFERENT 9 · SIMILAR 1) · 원상품 6종 · 후보 도메인 9
결과    ⒜ DESIGN — SAME **6/6 MATCH** ↔ DIFFERENT **MATCH 0**(MISMATCH 6 · UNKNOWN 3)
       ⒝ GT SAME 6쌍 **전 축 MISMATCH 0**
       ⒞ 🔴 DIFFERENT 9쌍에서 COLOR·MATERIAL·PRODUCT_TYPE 각 **MATCH 5** (보조축 변별력 낮음)
       ⒟ 창 커버리지 — 후보측 **최저 11.9%** · p50 81.7% ⟹ 과소추출은 창으로 검증 불가
       ⒠ 선언된 색상 자리(`Colour: X`) — 전문 **1건** 발견 · 창에서는 **0건 도달**
          🟢 STEP7 이 `kw.context` 를 입력으로 써서 그 규칙이 발화하지 못한 것을 **수치로 확인**
       ⒡ 가드 ON 영향 **11/16 쌍** — 🟢 거짓 증거 제거(「sweatshirt」⊃「tshirt」 5쌍 ·
          SLEEVE_FORM 4쌍) · 🔴 **올바른 방향 신호 상실 2쌍**(DIFFERENT PRODUCT_TYPE MISMATCH→UNKNOWN)
🔴 정정  folkberlin COLOR 일치값은 가드 OFF/ON **둘 다 `blue`** 다 ⟹ S5-④ 의 거짓 `grey` 일치는
       **이 16쌍 분모에서 재현되지 않았다**. 🔴 「그 결함이 없다」로 적지 않는다(분모가 다르다)
🟡 신규 관측(고치지 않았다) — 선언 색상 자리 포착이 **과포착** 된다
       실측 `"Blue Moon Made in Portugal About the Bra"`(40자 상한까지 긁는다)
       🔴 추출 규칙 변경 금지라 **보고만** 한다 · 🟢 전문이 없으면 볼 수 없던 결함이다
한계    🔴 분모 16 은 모집단을 대표하지 않는다 · 정밀도/재현율 일반화 금지 ·
       🔴 **A군 33 미측정은 그대로다**
```

---

## D-sxB. 🔵🔵🔵 **상세설명 기반 «핵심 식별» 전략 — 정의와 현재 상태**(CPO 지시 2026-11-16 · 조사 완료 · 구현 0)

🔴🔴 **이 절은 §D-sxA 동결표를 «해제하지 않는다».** 동결된 것은 **보조 속성 축**(아래 B)이고
이 절은 **다른 작업**(아래 A)의 상태 기록이다. 🔴 둘을 같은 문장으로 적지 않는다.

### 전략 정의 — CEO 요구 원문(CPO 확정)

> 브랜드·제조사 품번·상품명으로 상품을 식별하지 못하거나 정보가 미스매치하는 경우,
> 후보 상품의 **상세설명을 조회** 하여 대상 상품의 **식별 키워드**(브랜드 · 품번 · 상품명)가
> 존재하는지 확인하고, 상세설명에서 발견한 그 정보를 **원상품 정보와 대조** 해 동일상품 여부를 판단한다.

```
🔴 단순히 키워드가 포함되어 있다는 이유만으로 SAME 처리하지 않는다 — 추출 후 «비교» 한다
🔴 세 정보의 **존재 여부와 일치 여부를 각각** 확인한다 · 없으면 **미확인**(임의 일치 금지)
🔴 기본 정보 미스매치·불충분을 **즉시 DIFFERENT 로 처리하지 않는다**
🔴 판정 분류는 기존 체계 유지 — SAME · PRESUMED_SAME · SIMILAR · DIFFERENT
🔴 새 가중치·임계값·축 승격·판정 정책 변경은 이 지시만으로 **승인된 것이 아니다**
```

### 🔴🔴 A 와 B 를 섞지 않는다

| | 작업 | 상태 |
|---|---|---|
| **A** | 기본 식별 실패 시 상세설명에서 **브랜드·품번·상품명** 식별 근거를 찾아 판단 | 이 절 |
| **B** | **COLOR · FIT · DESIGN · MATERIAL** 등 보조 속성 비교/판정 축 | §D-sxA **동결** |

🔴 **B 의 오판 위험이 A 를 중단시키는 근거가 되지 않는다**(CPO 명시).
🔴 B16 결과(`docs/MI-B16-FULLTEXT-EXTRACTION.json`)는 **보조 속성·추출 규칙 검증 자료** 로 유지하고
**A 의 실패 증거로 해석하지 않는다**.

### 🟢🟢 조사 결과 — 세 축의 연결 상태가 **서로 다르다**(파일·줄로 증명)

```
① 품번(MODEL_CODE)   🟢🟢 **이미 구현·운영 연결돼 있고 작동한다**
   공급   product-url-facts.ts **:412**(SHOPIFY_JSON) · **:593**(PLAIN_HTML)
          → recoverModelCodeFromDetail(model-code-from-detail.ts:68)
          → extractDetailModelCodes(:49) 가 `facts.description` 에서 승인 패턴만 뽑는다
   안전   Contract A 기존 값 **안 덮음** · **Contract C 정확히 1개일 때만**(:74) ⟹
          관련상품 품번이 섞이면 **스스로 포기** · Contract E 충돌 **완화 안 함**
   🔴 추가 HTTP **0** — 이미 받아 둔 HTML/JSON 의 `description` 을 읽는다(:566)

② 브랜드(BRAND)      🔴 추출기 **있다** · 운영 호출 **0**
   analyzeBrandDescriptionEvidence(brand-description-evidence.ts:207) · 순수 함수 · 4상태
   🔴 모듈 index 에서 **export 조차 안 된다**(comparison-search/index.ts 에 없다)

③ 상품명(PRODUCT_NAME) 🔴 추출기 **있다** · 운영 호출 **0**
   analyzeProductNameDescriptionEvidence(product-name-description-evidence.ts:152)

🔴 ②③ 을 잠그는 계약 **둘** — ⒜ brand-1-description-evidence.test.ts ④-1(owner **5파일** 이
   그 모듈을 import 하지 않음) ⒝ sprint3-gate-gt-precision.test.ts **:373·:374**
```

🔵🔵 **별 경로 하나 — `confirmBrandCodeInEvidence` 는 description 을 «일부러» 뺐다**
```
domestic-identifiers.ts **:243** 건초더미 = [title · url · sku] ⟹ description **없음**
그 사유가 **:105~111 에 기록돼 있다**:
  ① 벤치마크에서 **효과가 측정되지 않았다**(fixture 분모가 무관한 상품이라 0건)
  ② 상세설명에 **관련상품/추천상품 품번** 이 함께 적히는 FP 벡터가 있다
  🔴 「측정되지 않은 이득을 위해 FP 위험을 먼저 받지 않는다. **필요해지면 그때 재서 넣는다.**」
🟢 ①의 「미측정」은 **이번에 측정됐다**(아래). 🔴 단 ②의 FP 벡터는 ①번 축의
   **Contract C(정확히 1개)** 가 이미 다루는 방식이 있다 — 같은 방어를 쓰면 된다
```

### 🔵 섀도 측정 — `docs/MI-DESC-IDENTITY-STRATEGY-PROBE.json`(HTTP 0 · 운영 변경 0)

분모 **16쌍**(B군 ∩ GT ∩ 양쪽 전문 · SAME 6 · DIFFERENT 9 · SIMILAR 1)

| 축 | 설명문에서 발견 | 증분(기존 title·url 로는 못 찾음) | GT SAME | GT DIFFERENT |
|---|---:|---:|---:|---:|
| 품번 | **3** | 3 | **3** | **0** |
| 브랜드 | 4 | **0** | 3 | 0 |
| 상품명 | **0** | 0 | 0 | 0 |

🔴🔴 **가장 중요한 교차검증 — 그 「증분 3」은 운영에서 «이미» 잡고 있다**
```
프로브의 「설명문에 원상품 품번 있음」 3쌍  ∩  B16 의 「MODEL_CODE 축 MATCH」 3쌍
   = **교집합 3 · 차집합 0**(양방향)
⟹ 🟢🟢 **① 품번 축은 CEO 전략 그대로 이미 동작한다** — 추가 구현 **불필요**
⟹ 🔴 그러므로 「증분 3」은 **`confirmBrandCodeInEvidence` 한 경로에 대한 증분** 이고
   **시스템 전체의 누락이 아니다**. 🔴 그 둘을 같은 말로 적지 않는다
```

🟢 **브랜드 상태** CORROBORATED 7 · UNKNOWN 9 · 🔴 **증분 0**(이 분모에서는 제목으로 이미 커버)
🔴 **상품명** 설명문 발화 **0**(`genericTypeOnly` 제외 후) ⟹ 이 분모에서 효과 **0**

### 🔴 그래서 지금 «실제» 미해결인 것

```
🟢 해결된 것      기본 식별 실패 시 **품번**을 상세설명에서 찾아 비교하는 경로 — **구현·연결 완료**
🔴 미해결(측정됨)  브랜드·상품명 축 연결 ⟹ 🔴 **이 분모(16)에서 증분이 0 이다**
                 ⟹ 연결을 정당화하는 근거가 **아직 없다**(효과 0 인 변경을 하지 않는다)
🔴 미측정         ⒜ 기본 식별이 **양쪽 다 비는** 쌍에서의 효과(MODEL_CODE UNKNOWN 12 중 다수)
                 ⒝ A군 33(후보 원문 0/33) · ⒞ 16쌍 밖의 모집단
🔴 분모 한계      16 은 모집단을 대표하지 않는다 · A∩B=0 ⟹ A군에 대입 금지
```

### 🟡 최소 연결 지점과 정확도 검증 방법 — 🔴 **제시만 한다**(구현 불승인)

```
연결 지점(둘 중 하나 · CPO 선택)
  ⒜ `confirmBrandCodeInEvidence` 건초더미에 description 추가 + **Contract C 형 방어**
     (품번이 정확히 1개일 때만) 🔴 :105 가 적은 FP 벡터를 그 방어로 닫는다
  ⒝ 브랜드·상품명 분석기를 **관찰 전용으로** 판정 경로에 노출(계약 둘을 갱신해야 한다)
🔴 어느 쪽도 지금 근거가 없다 — ⒜ 는 운영이 이미 같은 효과를 내고 ⒝ 는 증분 0 이다

정확도 검증 방법(CPO §5 분류 그대로 · 분모 혼합 금지)
  기존 기본 식별만으로 발견한 SAME ↔ 상세설명으로 **새로** 발견한 SAME ↔
  상세설명으로도 판단 불가 ↔ 상세설명과 기존 정보가 **충돌** ↔
  기존 SAME 을 **잘못 변경** ↔ DIFFERENT/PRESUMED_SAME 에서 **올바르게 회복**
  🔴 GT SAME/DIFFERENT/SIMILAR 를 구분하고 **SIMILAR 를 SAME 회복 성과에 넣지 않는다**
  🔴 원문 없는 표본을 추정치로 채우지 않는다
```

---

## D-sxC. 🔵🔵🔵 **KIDS 기존 자산 재검증 — 자산 목록 + 상세설명 핵심 식별 효과 측정**(CPO 지시 2026-11-16 · 구현 0)

### 우선순위 (CPO 정정)

```
① **KIDS 기존 상품 기반 MI 정확도 재검증** ← 최우선  ② KIDS 상세설명 핵심 식별 검증·안정화
③ KIDS 전체 흐름 검증  ④ 실제 상품군 확대  ⑤ 카테고리 엔진  ⑥ MI 통합  ⑦ 추가 커머스
🔴 **KIDS 검증 전 새 카테고리 확대 금지** · 🔴 과거 테스트를 새로 만들지 않고 **재사용** 한다
🔴 이전 로드맵의 카테고리 확대 순서는 **삭제하지 않고 ④ 로 유지** 한다
```

### 🟢 §1 기존 KIDS 테스트 자산 — 전수 목록(내용으로 확인 · 파일명 신뢰 금지)

| 자산 | 위치 | 라벨 | 성격 |
|---|---|---|---|
| **CEO 육안 판단(권위)** | DB `candidate_reviews.human_verdict` | **39행**(SAME 23 · DIFFERENT 15 · SIMILAR 1) | 🟢 origin 18종 · URL 114종 |
| 그 DB 캡처 | `mi-reeval-01-db-human.json` 38행 · `sprint5-brand-gt.json` 38행 | 동일 분포 | 🔴 **서로 중복** — 합산 금지 |
| CEO GT(WU 계열) | `wu-093`(10 · 🔴 **SKU 키**) · `wu-111`(2) · `wu-112`(27) · `wu-116`(1) · `wu-125`(9) | SAME/DIFFERENT/UNCERTAIN | URL 키(093 제외) |
| CEO GT(CORE 계열) | `core-2aj`(4) · `core-2al`(6) · `core-desc-review-ceo-gt`(11) | SAME/DIFFERENT | — |
| CEO 원장 | `docs/CEO-GT-LEDGER-2026-11-08.md` 9건 | 서술형 | 🔴 **읽기 전용 · 복제 금지** |
| A군 분모 | `MI-REEVAL-STEP5-SHADOW.json` `pairsA` **33** | priorGt 33 · ceoLatest 11 | 🔴 후보 원문 **0/33** |
| B군 쌍 + **설명문 전문** | `mi-reeval-03-keyword-input.json` **109쌍** | humanGt **36** | 🟢 후보 전문 98 · 원본 92 |
| 🔴 **가치 라벨(동일성 아님)** | `wu-099`(26) · `wu-100`(26) | USEFUL/NOISE/UNSURE | 🔴 **GT 분모에 넣지 않는다** |
| 🔴 미사용 저장소 | DB `ceo_judgments` · `ceo_judgment_axes` | **0행** | 테이블만 있다 |

🔴 **출처를 섞지 않는다** — CEO 육안 판단 / 시스템 판정 / 가치 라벨 / 미확인은 **별 칸** 이다.
🔴 `wu-093` 은 **SKU 키** 라 URL 축으로 조인되지 않는다(측정불가로 적는다).

### 🔵 §4 측정 — `docs/MI-KIDS-DESC-IDENTITY-RECHECK.json`(HTTP 0 · DB 0 · 운영 0)

🔴 **「회복」은 verdict 가 아니라 «식별 근거 확보» 기준이다**(§6 이 verdict 재계산을 금지).
분모 **32쌍** = GT 보유 **그리고** 후보 상세설명 보유 (SAME 18 · DIFFERENT 13 · SIMILAR 1)
🟢 CEO 전략은 **후보** 설명문만 요구하므로 분모가 B16 의 16 → **32** 로 넓어졌다.

| 축 | 분모 | A 기본 | B 기본+설명문 | 🔵 설명문에서만 | 중복 |
|---|---:|---:|---:|---:|---:|
| **품번** | 32 | 3 | **9** | **6** | 3 |
| 브랜드 | 13 | 4 | 4 | **0** | 4 |
| 상품명 | 16 | 12 | 12 | **0** | 12 |

```
GT SAME 18       품번 A 2 → B 8 (설명문에서만 **6**)
GT DIFFERENT 13  품번 A 1 → B 1 (설명문에서만 **0**) ⟹ 🟢🟢 **오판 증가 0**
GT SIMILAR 1     변화 0 · 🔴 SIMILAR 를 SAME 회복 성과에 넣지 않았다
근거가 «줄어든» 쌍 **0**(B ⊇ A · 계약으로 단언)
```

### 🔴🔴 그런데 그 6건은 «이미 운영이 잡고 있다» — 교차검증

```
6건 중 B16 분모 안 **3건** ⟹ 🔴 **3/3 이 이미 `MODEL_CODE` 축 MATCH** 다
   (운영 `recoverModelCodeFromDetail` 이 같은 조건으로 이미 공급한다 · §D-sxB ①)
나머지 3건은 B16 분모 밖 ⟹ **미확인**(그중 baseline 이 이미 `SAME` 인 것이 2건)
⟹ 🔴 「설명문에서만 6건」은 **`confirmBrandCodeInEvidence` 한 경로 기준** 이고
   **시스템 전체의 누락이 아니다**
```

### 🔴🔴🔴 가장 중요한 발견 — **남은 미검출은 상세설명으로 풀리지 않는다**

```
GT SAME 18 중 baseline 이 SAME 이 «아닌» 쌍 **15**
  🔴 **BASELINE_NOT_REPRODUCED 13** ⟹ baseline 자체가 없어 **측정불가**(최대 덩어리)
  🟡 PRESUMED_SAME **2**

그 PRESUMED_SAME 2건의 축 상태(desc-pairs 기록):
  AC009/junioredition  BRAND **MATCH** · MODEL_CODE **MATCH** · PRODUCT_NAME **MATCH** ·
                       FORM_DESIGN MATCH · COLOR MATCH   ⟹ 축 **5개 MATCH 인데 보류**
  AC033/junioredition  BRAND **MATCH** · MODEL_CODE **MATCH** · FORM_DESIGN·COLOR MATCH
⟹ 🔴🔴 **식별 증거가 모자라서 막힌 것이 아니다.** 상세설명에서 브랜드·품번·상품명을 더
   찾아도 이 두 건은 **움직이지 않는다** — 남은 것은 **보류 정책**(PRESUMED_SAME 유지 ·
   WU-066 에서 우회 시 precision 91.7% → 55.6% 측정)이고 **CPO 동결 축** 이다
```

### 🔵 결론 — CPO 핵심 질문에 대한 답

> 「상세설명에서 브랜드·품번·상품명을 추가로 확인하면 기존에 놓친 동일상품을 얼마나 찾아내는가」

```
🟢 품번    이미 운영에 연결돼 작동한다 — 추가 구현 **불필요** · FP 증가 **0**
🔴 브랜드  이 분모에서 설명문 증분 **0/13**
🔴 상품명  이 분모에서 설명문 증분 **0/16**
🔴🔴 ⟹ **이 분모(32)에서 상세설명 핵심 식별로 «추가 회복» 할 동일상품은 0건이다.**
     남은 미검출 15 = 측정불가 13 + 보류정책 2 이고 **둘 다 상세설명 축이 아니다**
```

### 🟡 다음 권고 — 🔴 구현하지 않았다

```
권고 ① 🔴🔴 **baseline 재현 실패 13건을 먼저 닫는다** — 가장 큰 덩어리이고, 그것 없이는
       어떤 정확도 개선도 **verdict 수준에서 측정할 수 없다**(지금 우리가 그 상태다)
권고 ② 브랜드·상품명 분석기 연결은 **지금 하지 않는다**(증분 0)
권고 ③ 원상품 brand/title 분모 확대는 **DB 읽기로 가능** 하다
       (원상품 URL 7종 중 brand 5 · title 6 보유 · 🔴 이 하니스는 재현성을 위해 DB 를 읽지 않았다)
권고 ④ 미커밋 3파일(분석기 2 + 잠금 계약 1) 커밋 여부 — CPO 결정
```

🔴 **B16·STEP5~7(보조 속성 축)과 이 결과를 하나의 결론으로 합치지 않는다**(§D-sxB 의 A↔B 분리).

---

## D-sxD. 🔵🔵🔵 **KIDS GT SAME 13건 — baseline 재현 실패 원인 «확정»**(CPO 지시 2026-11-16 · 조사 전용 · 구현 0)

🟢 전수 결과표 = `docs/MI-KIDS-BASELINE-REPRO-13.json` · 계약 `kids-baseline-repro-contract.test.ts`(5/5)
🔴 HTTP 0 · DB **쓰기 0**(읽기만) · 운영 코드 0 · 기존 산출물 **해시 전후 동일**(5파일).

### 🔴🔴 원인은 «실행 실패» 가 아니다 — 구조다

```
BASELINE_NOT_REPRODUCED 생산지
  mi-url-evidence-live.test.ts **:202**  `t.baseline.systemVerdict ?? "BASELINE_NOT_REPRODUCED"`
  ⟹ 그 문자열은 **「system_verdict 가 null 이었다」** 는 뜻이다(실행이 터진 것이 아니다)

🟢 13건 전부 `candidate_reviews` 에 **행이 있다**(행 없음 **0** · 데이터 소실 **0**)
🔴 전수 상관(347행) — human=O/system=X **17** · human=O/system=O **22** · human=X/system=O **308**
🔴 source 별 — `GT_IMPORT` 17행 중 system 보유 **5** · `SELLER_URL` 7행 중 **2**
⟹ 🔴🔴 **CEO GT 가 시딩된 행에는 baseline 이 «구조적으로» 없다.**
   그것이 계약이다 — 「`system_*` 와 `human_verdict` 는 서로 덮지 않는다」(079/WU-131)
```

### 🔵 13건 분류 (CPO 6분류 적용 · 🔴 추측 확정 0)

| 분류 | 건수 | 증거 |
|---|---:|---|
| **입력 데이터 누락** | **11** | 그 쌍의 **모든 행**에 `system_verdict` 없음 (`GT_IMPORT` 단독 7 · `SELLER_URL` 단독 4) |
| **GT ↔ 실행 결과 연결 실패** | **2** | baseline 이 **같은 쌍의 다른 행**에 **`SAME`** 으로 실재 — `global.trenbe.com`(GT_IMPORT + **SELLER_URL**) · `tinyapple.net`(GT_IMPORT + **WEB_SEARCH ×11**) |
| 원본 데이터 변경·소실 | **0** | 행 13/13 존재 |
| 실행 환경·버전 차이 | **0** | 그런 근거 없음 |
| 판정 경로 차이 | **0** | 관측되지 않음(🔴 「없다」로 단정하지 않는다 — 이 축의 증거가 없다) |
| 원인 미확인 | **0** | — |

🔵🔵 **연결 실패 2건의 baseline 은 실제로 `SAME` 이다** ⟹ 그 둘은 **놓친 적이 없다**.
🔴 「미발견」으로 셌던 것이 **측정 장치의 산물** 이었다.

### 🔵 다음 단계의 «실제» 측정 가능 분모

```
DB 수준   human 39행 중 baseline 보유 **22**(고유 URL 20 · 원상품 4)
          SAME 23 → 보유 **8** · 미보유 15      DIFFERENT 15 → 보유 13 · 미보유 2
          SIMILAR 1 → 보유 1
🔴 SAME 축에 결손이 몰려 있다(15/23) — DIFFERENT 는 2/15 뿐이다

fixture 32쌍의 GT SAME 18 재구성(🔴 임의 baseline 으로 채우지 않았다)
  baseline SAME **3** + 🔵 행 선택으로 회복 가능 **2** + PRESUMED_SAME **2** + 🔴 측정불가 **11**
  ⟹ **측정 가능 = 7 / 18**(= 18 − 11) · 계약이 이 산술을 잠근다(C-1)
```

### 🟡 권고 — 🔴 구현하지 않았다

```
① 🔵 **행 선택 규칙(출처 우선순위)** 을 정하면 **2건이 즉시 회복** 된다 — 코드 0 · HTTP 0
   🔴 단 「같은 쌍의 어느 행을 baseline 으로 삼는가」는 **제품 정책** 이다(CPO 결정)
② 🔴 나머지 11건은 **시스템 판정을 다시 산출해야** 하고 그것은
   ⒜ 후보 facts 재수집(HTTP · 현재 불승인) 또는 ⒝ 오프라인 재판정(verdict 재계산 · 현재 불승인)
   ⟹ **둘 다 승인 밖** 이다. 🟢 그 입력 중 **후보 상세설명 원문은 13/13 이미 보유** 하고 있다
③ 🔴 그러므로 「정확도 개선」을 verdict 수준에서 말하려면 **분모 7** 부터 시작해야 한다 —
   그 사실을 숨기지 않고 보고한다
④ 🔴 GT 시딩 경로가 system_* 를 쓰지 않는 **계약은 바꾸지 않는다**(사람 판정을 시스템이 덮지 않게 하는 보호다)
```

---

## D-sxE. 🔵🔵🔵 **CPO 단계별 검토 자료 작성 완료 — REVIEW 1 대기**(2026-11-16 · 조사 전용 · 구현 0)

🟢 **자료 = `docs/MI-KIDS-CPO-COMPARISON-REVIEW.md`**(§A 자산목록 · §B 통합비교표 · §C **CEO 근거 분석** ·
§D 원인분류 · §E 상세설명 기여도 · §F 국내외 SAME 현황 · §G CPO 안건)
🟢 전수 per-pair = 같은 이름 `.json`(109행) · 계약 `kids-cpo-review-contract`(9/9 · 문서↔자료 숫자 일치)
🔴 **CTO 는 전략·판정 정책·구현 범위를 확정하지 않았다** — §G 는 안건이다.

### 🔵 상시 고정 전략 7항 (CPO 확정 · START-HERE §0-ROADMAP 과 동일)

```
① 100% 전체 후보 판별이 목표가 아니다
② 목표 = **국내 3~5 · 해외 3~5 신뢰 가능 동일상품 증거** · 🔴 SIMILAR·PRESUMED 제외
③ 기존 KIDS 테스트 + CEO 육안 판단 **우선 활용**     ④ 육안 판단 **근거를 규칙으로**
⑤ 🔴 baseline 재현 실패 ↔ 육안 판단 활용 가능성 **혼동 금지**
⑥ KIDS 검증 전 카테고리 확대 금지                  ⑦ CPO 단계 판단 후 CTO 진행
```

### 🔴 이번 조사가 새로 확정한 사실 셋

```
① 🔴🔴 **판정은 DB 에, 근거는 fixture 에** 있다 — `candidate_reviews.human_note` **0/39** ⟹
   §B 에서 CEO 근거가 조인된 쌍은 **2/109** 뿐이다. 근거 기록은 **6종 출처**에 흩어져 있다
   (`core-desc-review` 11 · `core-2al` 6 · `core-2aj` 4 · `wu-093` 8 · `wu-112` 8 · Ledger 9)
② 🔴🔴 **CEO 근거 안에 «승격» 과 «반례» 가 같이 있다** —
   승격: 제목/상세설명의 **브랜드+품번**(영/한 차이 허용) · **사양 표** · **라인 Kids↔Baby**
   반례: **품번이 같아도 DIFFERENT 4건**(사이트 품번 오등록 · 색상차) · **소매 길이** 2 · **프린트** 6
   🔵 그리고 CEO 가 **세 번** 「**이미지 비교 필요**」라 적었다(C22·C19·C20)
   🔴 ⟹ 한쪽으로 규칙을 정하지 않았다 — **CPO 판정 사안**
③ 🔴🔴 **국내 확정 SAME = 0**(DB `market=KR` 34건 전부 `PRESUMED_SAME` · 가격은 34/34 VERIFIED 33)
   ⟹ §F 목표(국내 3~5) **미달** · 🔴 그리고 **CEO 라벨 18건이 `market=(null)`** 이라
      **GT 기준 국내/해외 분리 집계가 구조적으로 불가능** 하다
```

### 🔴 측정 불가 (0 으로 적지 않는다)

```
baseline 미재현 **17**(SAME 15) · A군 **33**(후보 원문 0) · `wu-093` **10**(SKU 키) ·
브랜드 축 19/32 · 상품명 축 16/32 · GT 기준 국내/해외 분리 · C42 근거 미기재 · 「판정 경로 차이」 축
```

🔵 **다음 한 수 = CPO REVIEW 1**(신뢰 근거 집합 확정 · 활용 데이터 확정 · 추가 분석 필요 여부).
🔴 CTO 는 REVIEW 1 승인 전에 다음 단계 분석·구현을 **시작하지 않는다**.

---

## D-sxF. 🔵🔵🔵 **PRESUMED_SAME Root Cause Resolution**(CPO 지시 2026-11-16 · 조사 전용 · 구현 0)

🟢 산출물 `docs/MI-KIDS-PRESUMED-ROOTCAUSE.json`(원장) · `docs/MI-KIDS-PRESUMED-RESTORATION.json`(복원 가능성)
🟢 하니스 `kids-presumed-rootcause.test.ts`(5/5) · HTTP **0** · DB **쓰기 0** · 운영 **0**

### 전략적 배경 — 🔴 상시 전략이다

> PRESUMED_SAME 은 포기하는 결과가 아니다. 원인을 해소해 **SAME 증거를 늘리고**, 해소할 수 없는
> 근사 상품도 **판매자에게 유용한 정보로** 제공할 방법을 정의한다. 🔴 건수 보고로 끝내지 않는다.

### 🔴🔴 ① 분모 정정 — **행 34 ≠ 상품 4**

```
DB 실측(`candidate_reviews` · market=KR · system_verdict=PRESUMED_SAME)
  행 **34**  —  BRAND_UNCONFIRMED **28** · BRAND_MISMATCH **5** · NO_TITLE_OVERLAP **1**
  🔴🔴 그러나 **고유 상품 페이지는 4** 다 —
     `donokids.com` 26행 + 2행 = **URL 2** · `vividvia.com` 5행 = **URL 1** ·
     `miniboutique.co.kr` 1행 = **URL 1**
  ⟹ 🔴 **「33건」을 상품 수로 읽지 않는다.** 판매처는 **3곳** 이다
🔴 CPO 지시서 **33**(27/5/1) ↔ DB 실측 **34**(28/5/1) — `BRAND_UNCONFIRMED` 에서 **1 차이**.
   🔴 임의로 맞추지 않았다(둘 다 기록).
```

### 🟢🟢 ② 핵심 정체성 복원 가능성 — 기존 owner 로 측정(신규 구현 0)

| 판매처 | 행 | blocker | 제목 | 브랜드 복원 | 품번 | 상태 |
|---|---:|---|---|---|---|---|
| `donokids.com` | 26 | BRAND_UNCONFIRMED | `[[보보쇼즈] Hug Hairy Monster T-shirt #226AC009]` | 🟢 **Bobo Choses** | 🔴 승인패턴 **0** · 접두생략 `226AC009` | `NOT_EXTRACTED` |
| `donokids.com` | 2 | BRAND_UNCONFIRMED | `[[보보쇼즈] Hidden Monster sweatshirt #226AC038]` | 🟢 **Bobo Choses** | 🔴 〃 `226AC038` | `NOT_EXTRACTED` |
| `miniboutique.co.kr` | 1 | NO_TITLE_OVERLAP | `[BOBO CHOSES]T-Shirt - B226AC009 - 미니부띠끄` | 🟢 **Bobo Choses** | 🟢 `B226AC009` **원상품 대조 성공** | `MATCH_CANDIDATE` |
| `vividvia.com` | 5 | BRAND_MISMATCH | `보보쇼즈 26FW Hug Hairy Monster T-shirt B226AC009 - VIVIDVIA` | 🟢 **Bobo Choses** | 🟢 `B226AC009` **대조 성공** | `MATCH_CANDIDATE` |

```
🟢🟢 **브랜드 4/4 복원 가능** — 🔴 **신규 alias 0** · 기존 `brand-alias.ts:42`
   (`{ brand: "Bobo Choses", alias: "보보쇼즈" }`)를 **읽기만** 했다
   경로 — `lookupBrandByAliasInTitle`(3) · `findBrandAliasMentions`(1 · 영문 `BOBO CHOSES`)
   ⟹ 상태는 **`TRANSLATION_VARIANT`** 이고 🔴 **실제 브랜드 충돌이 아니다**
🟡 품번 2/4 는 승인 패턴으로 **원상품과 대조 성공** · 🔴 2/4 는 **`NOT_EXTRACTED`**
   원인 — donokids 가 **접두 `B` 를 생략**(`#226AC009`)하고 승인 패턴은
   `/\bB\d{3}[A-Z]{2}\d{3}\b/`(`model-code-from-detail.ts:46`)라 **걸리지 않는다**
🔴 상품명 축 — 원장에 **원상품 제목이 없다** ⟹ **측정불가**(지어내지 않았다)
```

### 🔴🔴 ③ 상세설명 검토 결과 — **이 표본에서는 새 정보를 주지 않는다**

```
오프라인 원문(HTTP 0) `docs/DONOKIDS-1GET-RAW-2026-11-16.html`
  🟢 그 캡처가 **이 사례의 URL** 이다(`branduid=3362798` · `og:url` 로 확인)
  JSON-LD `@type=Product` — 🔴 `brand` **없음** · 🔴 `mpn` **없음** ·
    `sku` = **`058003000184`**(🔴 **판매처 SKU** · 제조사 품번이 아니다) ·
    `name` = `[보보쇼즈] Hidden Monster sweatshirt #226AC038` ·
    🔴 `description` = `"[[보보쇼즈] Hidden Monster sweatshirt #226AC038] "` — **제목의 복사본(45자)**
  본문 브랜드 언급 — 「보보쇼즈」 **8회** · `BOBO CHOSES` **3회**
⟹ 🔴🔴 **정보는 «제목» 에 있고 상세설명에 추가 정보가 없다.**
   그러므로 이 34행(4 페이지)의 레버는 **상세설명 보완이 아니다** —
   **제목의 한글 브랜드 인식 + 접두 생략 품번 인식** 이다
🟢 기존 측정과 일치 — `DOMESTIC-STRUCTURED-BRAND-COVERAGE-1.md`:
   국내 CONTROL N=6 에서 `Product.brand` **0/6** · 본문 브랜드 **6/6**
```

### 🔵 ④ 원인 재분류 (CPO §3.3 상태 어휘)

| 기존 blocker | 행 | 페이지 | 재분류 | 근거 |
|---|---:|---:|---|---|
| `BRAND_UNCONFIRMED` | 28 | 2 | **TRANSLATION_VARIANT** | 한글 「보보쇼즈」 · 기존 등록부로 복원 |
| `BRAND_MISMATCH` | 5 | 1 | **TRANSLATION_VARIANT** | 〃 · 🔴 **실제 충돌 아님** |
| `NO_TITLE_OVERLAP` | 1 | 1 | 별도 축(영/한 혼재) | 품번은 `MATCH` |
| 품번(파생) | — | 2 | **NOT_EXTRACTED** | 접두 생략형 |

🟡 **그리고 미측정 하나** — `brandsCompatible` 의 **기존 등록부 재사용은 이미 배포됐다**
(§D-sx6 · `beea5b59`). 🔴 그 배포 **이후** 이 34행을 재측정하지 않았다 ⟹
`BRAND_MISMATCH 5` 는 **이미 해소됐을 수 있다**(확인되지 않았다 · HTTP 필요).

### 🟡 ⑤ 개선안 — 🔴 **CTO 가 확정하지 않았다**(CPO 결정)

| 원인 | 개선 후보 | 분류 | 위험 |
|---|---|---|---|
| 브랜드(33행 · 3페이지) | 🟢 **기존 등록부 연결만 필요** — 신규 구현 0 | **기존 기능 연결** | `facts.brand` 생산 경로 변경은 **운영 변경** ⟹ 승인 필요 |
| 품번(2페이지) | 🟡 **접두 생략형 인식** | **추출 로직 개선** | 🔴 승인 패턴 변경 · 숫자열 FP 위험 ⟹ **CPO 판정** |
| 상세설명 | 🔴 **이 표본에서 효과 없음**(제목 복사본) | 해당 없음 | — |
| NO_TITLE_OVERLAP 1 | 영/한 혼재 제목 — 🔴 별도 조사 필요 | 추가 데이터 필요 | — |
| BRAND_MISMATCH 5 | 🟡 **배포 후 재측정** | 측정 필요 | HTTP 필요(현재 불승인) |

### 🟡 ⑥ 판매자 노출 — 🔴 확정하지 않았다(PART 6 유형 분류만)

```
4 페이지 전부 **가격 보유**(KRW 88,000 ×2 · 138,000 · 88,000) · `VERIFIED_CURRENT` **3/4**
🔴 그러나 **human GT 전건 null** — CEO 육안 검증이 **없다**
⟹ 유형은 **A(정보 누락형)** 에 가깝다(핵심 정체성 일부 미확인 · **실제 충돌 없음**)
🔴 「동일상품 추정」 노출 여부는 **CPO 결정** 이고 CTO 가 고르지 않았다
🟢 기존 가격 정책 유지 — PRESUMED_SAME 은 수익성 계산 **제외** 그대로
```

### 🔴 금지된 반복 작업 (다음 세션이 다시 하지 않는다)

```
① 국내 PRESUMED_SAME **건수 재집계** — 행 34 / 페이지 4 로 확정됐다
② 「브랜드 미확인이 원인이다」 **재조사** — 원인은 **한글 표기(TRANSLATION_VARIANT)** 로 확정
③ donokids 상세설명 **재수집** — 캡처가 있고 설명문은 **제목의 복사본** 이다
④ B16(보조 속성 축) 재시작 · P0③ 종료 작업 재개
```

### 다음 작업 순서 · 완료 조건

```
🔵 다음 = **CPO 검토** → ⒜ 브랜드 등록부 연결 승인 여부 ⒝ 접두 생략 품번 인식 판정
   ⒞ BRAND_MISMATCH 5 재측정(HTTP) 승인 여부 ⒟ 판매자 노출 유형 확정
완료 조건 — 🔴 CPO 가 ⒜~⒟ 를 결정한 뒤에만 구현 스프린트를 연다
```

---

## D-sxG. 🔵🔵🔵 **PRESUMED_SAME 후속 검증 — alias 경로 확정 + 품번 실험**(CPO 추가 지시 2026-11-16 · 구현 0)

🟢 산출물 `docs/MI-KIDS-PRESUMED-FOLLOWUP.json` · 하니스 `kids-presumed-followup.test.ts`(8/8)
🔴 운영 코드 **0** · 운영 정규식 **0** · alias 신규 **0** · HTTP **0** · DB 쓰기 **0**

### §1 분모 — 🔴 **네 축으로 가른다**(CPO 지시)

```
DB 행 **34**  ·  고유 스냅샷 **29**  ·  고유 후보 URL **4**  ·  판매처 **3**
🔵 그리고 원상품은 «상품» **2종** 이다(`B226AC009` · `B226AC038`)
⟹ 🔴🔴 **34행은 같은 상품 2종을 29개 스냅샷으로 재분석한 결과** 다 —
   「34개 독립 상품」이 아니고 「중복 행」이라고도 적지 않는다(각 행은 **다른 스냅샷**과의 비교다)

URL 별 — donokids `branduid=3362785` 26행(2026-11-08~11-15 · DOMESTIC_LISTING) ·
         donokids `branduid=3362798` 2행(11-15~11-16) ·
         vividvia 5행(11-08~11-11 · WEB_SEARCH) · miniboutique 1행(10-23 · SELLER_URL)
🔴 **33(27/5/1) ↔ 34(28/5/1) 의 1 차이는 미해결로 남긴다** — 추출 시점·조건이 다르고
   임의로 일치시키지 않았다(이전 조사의 쿼리·시점이 기록에 없다)
```

### §2 alias 기능의 실제 효과 — 🔵🔵 **중복 연결 작업이 아니다**

| 단계 | 자리 | 상태 |
|---|---|---|
| ① 브랜드 **추출**(`facts.brand` 생산) | 후보 facts 생산 경로 | 🔴 **donokids 에서 비어 있다** |
| ② 브랜드 **별칭 정규화** | `cross-seller.ts:378` `brandsCompatible` → `registryCanonicalBrand` | 🟢 **배포됨**(`beea5b59`) |
| ③ 원상품 ↔ 후보 **비교** | `cross-seller.ts:953` | 🟢 작동 |
| ④ 최종 판정 **반영** | `:980` `BRAND_MISMATCH` · `:1365` `BRAND_UNCONFIRMED` | 🟢 작동 |

```
🔴🔴 **게이트** `cross-seller.ts:952` `brandKnown = Boolean(x.brand && y.brand)`
   ⟹ ①이 비면 ②③은 **호출조차 되지 않는다** ⟹ 🟢 **같은 기능을 다시 연결하는 중복이 아니다**
🟢 실측 검증(오프라인) — `brandsCompatible("Bobo Choses","보보쇼즈")` **true**(양방향) ·
   `"BOBO CHOSES"` **true** · 🔴 `"비스킷"`·`"VIVIDVIA"`·`""` 는 **false**(모른다를 같다로 읽지 않는다)
```

**재평가 전후(기존 저장 데이터만 · HTTP 0)** — ①을 채우면 4/4 가 ②③을 통과한다

| 판매처 | 행 | 현재 blocker | ① 제목 추출 브랜드 | ②③ 결과 | ④ 남는 blocker |
|---|---:|---|---|---|---|
| donokids 3362785 | 26 | BRAND_UNCONFIRMED | 🟢 `Bobo Choses` | 🟢 **true** | **없음** |
| donokids 3362798 | 2 | BRAND_UNCONFIRMED | 🟢 `Bobo Choses` | 🟢 **true** | **없음** |
| miniboutique | 1 | NO_TITLE_OVERLAP | 🟢 `Bobo Choses` | 🟢 true | 없음(🔴 제목겹침 축은 별개) |
| vividvia | 5 | BRAND_MISMATCH | 🟢 `Bobo Choses` | 🟢 **true** | **없음** |

🟢 **§C(BRAND_MISMATCH 5건 재측정)의 답 — 기존 데이터로 오프라인 재평가가 «가능했다»**.
그 5행은 배포(`beea5b59` · 11-16) **이전** 데이터(11-08~11-11)이고, 배포된 경로를 직접 부르면 **호환(true)** 이다.
🔴 단 **운영 재실행 결과가 아니다** — 운영 verdict 변화는 **미측정**(HTTP 필요 · 불승인).

### §3 접두 생략 품번 — 🟡 **오프라인 실험만** (운영 정규식 변경 0)

```
🔴 운영 승인 패턴 불변 확인 — `extractDetailModelCodes("#226AC009")` = **[]** ·
   `("B226AC009")` = `["B226AC009"]`
🟡 실험 패턴(운영 밖) `(?<![A-Z0-9])\d{3}[A-Z]{2}\d{3}(?![A-Z0-9])`
   정확 추출 — `#226AC009` → `226AC009` · `#226AC038` → `226AC038`
   원상품 **가족 서명** 대조 — `B226AC009`.endsWith(`226AC009`) ⟹ **일치 2/2**
   🔴 다른 상품은 걸러진다 — `B226AC009` ↔ `226AC038` **불일치**
🟢🟢 오탐 검사 **8종 전건 통과** — 판매처 SKU `058003000184`(donokids 실측) · 일반 숫자열 ·
   가격 `88000` · 전화번호 · `2026AC00912` · `X226AC009` · `226AC0091` · `A226AC009`
🔴🔴 **그래도 남는 위험을 적는다** — 가족 서명은 **접두 한 글자를 구분하지 못한다**
   (`B226AC009` ↔ `C226AC009` 를 섞는다). 접두가 브랜드/라인을 가르는 체계면 오판이 된다
⟹ 🔴 **운영 판정에 연결하지 않았다.** 정밀도·오탐 분모가 더 필요하다(현재 대상 2건)
```

### §4 상세설명 전략의 적용 조건 — 🔵 **문서에 고정한다**(폐기 아님)

```
① 제목·기본 데이터에 핵심 정체성이 **있으면** → **그 정보부터** 활용한다(추출·비교 우선)
② 제목·기본 데이터에 **없거나 충돌하면** → **상세설명을 확인** 한다
③ 상세설명에서 **브랜드 · 제조사 모델코드 · 상품명** 을 복원해 **원상품과 비교** 한다
④ 상세설명에서도 못 찾으면 → **`NOT_PRESENT` / `NOT_EXTRACTED` 등 실제 원인을 구분** 한다
🔴🔴 **이번 표본(donokids)에서 상세설명이 제목 복사본이었다는 사실은 «이 표본의 결과» 다** —
   전체 PRESUMED_SAME 의 상세설명 전략을 폐기하는 근거로 **쓰지 않는다**(CPO 명시)
```

### §5 판매자 노출 — 🔴 **확정하지 않았다**(제안)

| 축 | 이번 4 페이지 | 근거 |
|---|---|---|
| 표시 명칭 | 「동일상품 **추정**」 | 🔴 SAME 아님 |
| 추정 사유 | 「브랜드 표기 차이(한글↔영문)」 · 「품번 표기 차이(접두 생략)」 | §2·§3 실측 |
| 확인된 일치 | 브랜드 **4/4** · 품번 **2/4**(운영 대조 성공) | — |
| 미확인 | 품번 2/4(`NOT_EXTRACTED`) · **상품명 전건**(원상품 제목 부재) | 측정불가 |
| 실제 충돌 | 🟢 **없음**(전건 `TRANSLATION_VARIANT`) | — |
| 가격 참고 | KRW 88,000 ×2 · 138,000 · 88,000 · `VERIFIED_CURRENT` **3/4** | — |
| **SAME 가격 제공** | 🔴 **불가** | CEO GT **전건 없음** |
| **수익성 계산 포함** | 🔴 **불가**(기존 정책 유지) | — |
| **SIMILAR 분류** | 🔴 **보류** | 🔴 **정보 부족 ≠ 유사** — 자동 변환 금지 |
| 내부 PRESUMED_SAME 후보 유지 | 🟢 **가능** | — |

### 🔴 CPO 결정 필요 · 운영 변경 시 위험

```
⒜ 브랜드 ①추출(`facts.brand` 생산 경로) 연결 — 🟢 효과 33행/3페이지 · 신규 alias 0
   🔴 위험: `facts.brand` 는 판정 입력이다 ⟹ 다른 후보의 brand 도 같이 바뀐다(회귀 범위 넓다)
⒝ 접두 생략 품번 — 🔴 **보류 유지** 권고(접두 한 글자 구분 불가 · 분모 2건)
⒞ BRAND_MISMATCH 5 운영 재실행 — HTTP 필요(현재 불승인) · 🟢 오프라인 재평가는 **완료**
⒟ 노출 설계 — 위 표가 제안이고 **확정은 CPO**
```

---

## D-sxH. 🔵🔵🔵 **MI 핵심 동일성 판단 — CEO 확정 전략 + 모델코드·상품명 원인 분석**(2026-11-17)

🔴🔴 **이 절이 §D-sxB~G 보다 «우선 기준» 이다**(CPO 확정). 전문 요약은 `START-HERE.md`
§「MI 핵심 상품 동일성 판단 — CEO 확정 전략」과 **같은 내용** 이다 — 🔴 두 문서를 어긋나게 두지 않는다.

```
목표  🔴 100% 자동 판정이 아니다 — 판매자가 쓸 **국내·해외 동일상품 증거** 확보 +
      자동 확정이 어려운 것은 **CEO 판단으로 해결** 하고 그 판단을 **재사용** 한다
순서  ① 기본(브랜드+품번+상품명) → ② 부족하면 **상세설명 보완** → ③ 애매하면 **CEO 판단 요청**
      (🔴 자동 DIFFERENT·무조건 제외 금지) → ④ 4분류 구분 + 근거·CEO 판단 보존
원칙  🔴 과도한 추출 규칙/threshold 선행 금지 · 🔴 코드 하나로 SAME 금지 ·
      🔴 누락 ↔ 실제 차이 구분 · 🔵 **동일성 ↔ 가격 비교 적합성 분리** · CEO 검토 경로 상설
```

🔴 **새 전략이 덮지 «않는» 기존 동결 둘** — ⒜ 이미지는 `STANDARD-V1.md:109` 가 **SAME 정원에서
제외**(검토 화면 «표시» 는 가능 · 판정 승격은 **표준 개정 사안**) ⒝ CEO 판정 재사용은 **SAME 만**
(DIFFERENT/SIMILAR/UNDECIDED 재사용 **CPO 금지** · 2026-11-07 「표시 승인 · 자동 차단 불승인」).

### 🔵 모델코드 · 상품명 원인 분석 결과 (분모 **109** · 산출물 `MI-KIDS-CODE-NAME-CAUSES.json`)

| 모델코드 원인 | 전체 | GT SAME(20) | GT DIFF(14) |
|---|---:|---:|---:|
| `NOT_PRESENT` | 56 | 8 | 12 |
| 🔴 `ORIGIN_CODE_ABSENT` | **28** | — | — |
| 🟢 `DESCRIPTION_ONLY`(이미 운영 공급) | **11** | **6** | **0** |
| `CODE_PRESENT_BUT_DIFFERENT` | 7 | 1 | 2 |
| `TITLE_APPROVED` | 5 | 3 | **0** |
| 🟡 `TITLE_PREFIXLESS_NOT_EXTRACTED` | **2** | 2 | 0 |

| 상품명 원인 | 전체 | GT SAME(20) | GT DIFF(14) |
|---|---:|---:|---:|
| `TOKENS_SHARED` | 44 | **6** | 1 |
| `WEAK_OVERLAP` | 27 | 0 | **6** |
| `NO_OVERLAP` | 19 | 0 | **4** |
| 🔴 `ORIGIN_TITLE_ABSENT` | **17** | **13** | 3 |
| `SCRIPT_DIFFERENCE_*` | 2 | 1 | 0 |

```
🔵 증거 출처(STEP3) — 후보측 모델코드는 **상세설명 26 : 제목 5** ⟹ 🟢 **상세설명을 기본 경로로 유지**
   원상품측은 **STRUCTURED 81**
🔴🔴 **두 축의 최대 덩어리는 공통으로 「원상품측 식별정보 부재」** 다 — 코드 **28** · 제목 **17**
   🟢 운영 DB 에 원상품 제목이 **92/109** 있다 ⟹ 그 분모는 **오프라인으로 열 수 있다**
🟢 변별력 — `TITLE_APPROVED` GT SAME 3 : **DIFF 0** · `TOKENS_SHARED` 6 : 1 ·
   `WEAK/NO_OVERLAP` 은 DIFF 쪽 10 ⟹ 축은 올바른 방향으로 작동한다
🟡 접두 생략 **2건** — 🔴 CPO 보류 유지(작은 예외를 위해 복잡한 규칙을 만들지 않는다)
```

### 🔴🔴 이 분석에서 «낡은 GT» 로 거짓 반례를 보고할 뻔했다 — 기록으로 남긴다

```
1차  「동일 코드인데 human DIFFERENT **1건**(m.luxboy)」 ⟹ 「코드 단독 승격 금지」의 직접 근거
🔴 그러나 `core-2m-ceo-visual-gt.json`(2026-10-24 · CPO 「최신 CEO 판정을 truth 로」)에서
   그 후보는 **DIFFERENT → SAME** 이다 — CEO 근거 「**브랜드 + 품번 동일로 판단 가능**」
🔴 조인을 **두 번** 틀렸다 — ⒜ `originUrl` null 에서 키 불일치(17쌍 누락)
   ⒝ **URL 대소문자 차이**(`a14338…` ↔ `A14338…`) ⟹ 정확 7/10 · 소문자 **9/10**
🟢 둘 다 고치고 **매칭 수를 계약으로 잠갔다**(`kids-code-name-causes` A-1 · A-3)
🔵 최종 — 「동일 코드인데 human DIFFERENT」 **0**
🔴 그래도 「코드 단독 승격 안전」으로 **뒤집어 적지 않는다** — CEO 근거 **C19·C20·C22**
   (「품번 동일하나 다른 제품/컬러」·「사이트 품번 오등록」·「이미지 비교 필요」)는 **살아 있다**
```

### 🔴 다음 작업의 간소화 기준 (CPO 확정)

```
① 기본정보로 확인 가능한 상품을 **먼저** 가른다
② 부족한 것만 **상세설명으로 보완**
③ 상세설명에서 브랜드·품번·상품명 일치 근거 확인
④ **자동 판단이 애매한 사례만** CEO 판단 대상으로 정리
⑤ CEO 판단 결과를 **동일 유형에 재사용**
🔴 복잡한 추출 정규식·축별 threshold 를 **먼저 만들지 않는다**
🔴 모델코드·상품명을 각각 더 세분화해 장기 조사하지 않는다
```

---

## D-sxI. 🔵🔵🔵 **핵심 동일성 조합 v2 — 품번은 필수 조건이 아니다**(CPO 기준 수정 2026-11-17 · 구현 0)

🟢 산출물 `docs/MI-KIDS-TRIAGE-V2.json` · 하니스 `kids-triage-v2.test.ts`(3/3)
🔴 운영 0 · HTTP 0 · DB 0 · 새 threshold·정규식 **0** · 기존 근거만 재사용 · 이미지 미사용

### 기준 (CPO 확정 · START-HERE 와 동일)

| 확보된 정보 | 처리 |
|---|---|
| **브랜드 + 상품명 MATCH** | 🟢 **동일상품 판단**(품번 불필요) |
| **품번 MATCH 만** | 🟡 **상세설명·기타정보 확인 대상** |
| **품번 + 상세설명 브랜드** | 🟢 동일상품 판단 가능 |
| 일부 불일치(충돌) | 🔴 **CEO 검토**(브랜드·상품명·상세설명 근거 함께 제시) |
| 근거 없음 | 정보 부족 |

### 109건 재분류 결과

| 상태 | v1(품번 필수) | **v2** | GT 대조(최신 CEO truth) |
|---|---:|---:|---|
| JUDGEABLE | 11 | **23** | 🟢 SAME 5 · null 18 · **DIFFERENT 0 · SIMILAR 0** |
| NEEDS_DETAIL_CHECK | — | **6** | 🔵 **SAME 6**(전부) |
| CEO_REVIEW | 7 | 7 | SAME 1 · DIFFERENT 2 · SIMILAR 1 · null 3 |
| INSUFFICIENT | 91 | **73** | SAME 8 · DIFFERENT 12 · UNCERTAIN 1 · null 52 |

```
이동  INSUFFICIENT → JUDGEABLE **12** · INSUFFICIENT → NEEDS_DETAIL_CHECK **6**(합 18)
🔵 품번 «없이» JUDGEABLE 이 된 **12** = CPO 가 센 **10**(`axisStatus.BRAND=MATCH` + 상품명)
   + **2**(STEP3 브랜드 키워드 공유 · 🟢 둘 다 **GT SAME** ⟹ 올바른 방향)
🔵🔵 **NEEDS_DETAIL_CHECK 6 이 전부 GT SAME** ⟹ 「품번만 일치 → 상세설명 확인」 경로가
   실제 동일상품을 담고 있다(상세설명 브랜드 근거를 더하면 JUDGEABLE 후보)
🟢 CEO_REVIEW 7 은 전부 **「품번이 양쪽에 있으나 다르다」** 이고 그 안에 GT 가
   SAME 1 · DIFFERENT 2 · SIMILAR 1 로 **갈려 있다** ⟹ 사람이 봐야 하는 자리다
🔴 GT 대체 2건 반영 — `m.luxboy` DIFFERENT→**SAME** · `bornyesterdaykids` SAME→**UNCERTAIN**
```

### 🔴🔴 이 작업에서 내가 틀린 것 — 전부 적는다

```
① **GT 대체를 1차에 빠뜨렸다** ⟹ `m.luxboy` 가 낡은 `DIFFERENT` 로 찍혀
   `NEEDS_DETAIL_CHECK` 에 「DIFFERENT 1」이라는 거짓 숫자가 생겼다(실제는 **SAME 6**)
② **v1↔v2 이동 비교 키를 두 번 틀렸다** —
   ⒜ `candidateUrl` 단독 ⒝ `(originCode|candidateUrl)`(**103/109** · 중복 6)
   ⟹ `global.trenbe` 가 「JUDGEABLE → 강등」된 것처럼 보였다(**거짓 이동**)
   🔴 그 중복의 실체 — 같은 (품번, 후보) 에 **originUrl 이 `null` ↔ `en-kr` 로 갈린 두 행**
   🟢 고친 방법 — **교차 artifact 조인을 없애고** v1 기준을 **같은 행에서 계산**
③ 🔴 그 과정에서 「키 산물 가설이 틀렸다」고 **중간에 단정** 했는데 그것도 성급했다
   (여전히 고유하지 않은 키로 재확인한 결과였다)
🟢 교훈 — **분모가 109 인 자료의 고유 키는 `(originUrl, candidateUrl)` 하나다.**
   `originCode`·`candidateUrl` 단독·조합 **모두 고유하지 않다**
```

---

## E. 🔴 다음 세션이 **먼저 읽을 한 줄**

> 상세설명 증거는 **이미 구현돼 있고(612줄) 운영에 연결되지 않도록 계약이 잠그고 있다.**
> 그 잠금을 푸는 것이 CPO §2 원칙의 실행이고, 재개 조건은 **GT 정밀도 재측정 WU 하나** 다.
> 🔴 그 전에 **브랜드 alias·품번 패턴·제목 승격을 건드리지 않는다**(전부 금지 목록).
