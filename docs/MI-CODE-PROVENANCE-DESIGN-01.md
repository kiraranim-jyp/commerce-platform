# MI-CODE-PROVENANCE-DESIGN-01 — 품번 출처 보존 · 변형 충돌 구분 설계

> 🔴 **설계 문서다.** 실제 schema 변경 **0** · migration **0** · backfill **0** ·
> 운영 코드 **0** · UI **0** · 판정 로직 **0** · slug 품번 식별자 승격 **0**.
> 🟢 기존 산출물(`mmse01-*` · `mmse02-code-evidence.json` · `mier01-reassessment.json`)만 재사용.

작성 2026-11-22 · 기준선 **후보 364 · 원상품 122 · 운영 SAME 83 · human 22**

---

## §0. 🔴 먼저 — CPO 가 지적한 숫자 오류를 정정한다

```
🔴 내 보고서: 「EXACT_MATCH 33건의 고유 품번은 **4개**」 — **틀렸다**.
🟢 데이터 재집계: 고유 품번은 **3개** 다 — `B226AC009` · `B226AC033` · `B226TC174`
   (후보측 고유 품번도 **3개** · 완전히 같은 집합)
🔴 **왜 틀렸나** — 같은 EXACT_MATCH 33건의 **고유 원상품 «제목» 이 4개** 이고
   내가 그 둘(품번 종류 ↔ 원상품 종류)을 **한 문장에 섞었다**.
🟢 정확한 서술:  EXACT_MATCH **33건** = 고유 품번 **3종** × 고유 원상품 제목 **4개** ×
                 관련 스냅샷 **22개**(재분석 중복)
```

🔴 **이 혼동이 이번 설계의 동기와 같은 종류다** — 「값」과 「그 값이 가리키는 대상」을
한 칸에 두면 사람도 시스템도 섞어 읽는다.

---

## §A. 품번 출처별 데이터 모델

### A-1. 🟢🟢 **새 모양을 만들지 않는다 — 코드에 이미 있다**

CPO 가 요구한 「값 + 출처 + 근거 + 정규화」는 **이미 운영 타입으로 존재한다**:

```ts
// packages/crawler/src/comparison-search/identity-evidence-summary.ts
export interface AxisEvidenceValue {
  raw: string;                 // 🔴 원문 그대로
  normalized: string;          // 🟢 owner `normalizeFactText` 산출(새 정규화 0)
  source: EvidenceSource;      // "TITLE" | "DESCRIPTION" | "IMAGE"
}
```
그리고 원상품 쪽에는 **`ProvenanceField<T>`**(`value` · `source: FieldSource` · …)가 있다.

🔴 **그래서 이 설계의 핵심은 「새 구조 발명」이 아니라 «그 구조를 저장하지 않는 것» 을 고치는 것이다.**
현재 `summarizeIdentityEvidence` 는 11축 × 양쪽 관찰을 **계산해서 버린다**(저장 경로 0).

### A-2. 출처 축을 **다섯**으로 못 박는다 — 🔴 CPO 표의 네 칸 + 하나

| 출처 코드 | 뜻 | 실측 건수 | 신뢰 등급(제안) |
|---|---|---:|---|
| `ORIGIN_DB_SKU` | 원상품 `canonicalProduct.sku` 선언값 | 원상품 **43/122** 보유 | 🟢 **A** — 사이트가 선언한 값 |
| `ORIGIN_URL_SLUG` | 원상품 URL slug 복구값 | EXACT_MATCH 중 **8건** | 🟡 **B** — 값은 맞아 보이나 선언이 아니다 |
| `CANDIDATE_STRUCTURED` | 후보 페이지 구조화 추출(`facts.brandModelCode`) | 🔴 **저장되지 않는다** | 🟢 A |
| `CANDIDATE_DESCRIPTION` | 후보 상세설명 **명시 문장** | Wynken 2건 실측 | 🟢 **A+** — `Product Code …` 선언 |
| `JUDGEMENT_TEXT` | 운영 `match_reasons` 문장에 적힌 값 | EXACT_MATCH 중 **13건** | 🔴 **C** — 사후 텍스트이고 원값이 아니다 |

🔴 **다섯을 한 칸에 합치지 않는다**(CPO 필수 원칙). 🔴 등급 A/B/C 는 **제안** 이고
**자동 판정에 쓰지 않는다** — §F 의 승인 항목이다.

### A-3. 레코드 설계 — 🟢 **기존 모양 + 네 칸만 추가**

```ts
/** 🔵 제안 — 🔴 구현하지 않았다. 이름도 CPO 확정 전 가안이다. */
interface CodeEvidenceRecord {
  /* ── 기존 모양 그대로 ─────────────────────────────── */
  raw: string;                      // 🔴 원문 그대로(대소문자·구분자 보존)
  normalized: string;               // 🟢 비교용 — owner 산출(새 정규화 금지)
  source: EvidenceSource;           // TITLE | DESCRIPTION | IMAGE  (기존 타입)

  /* ── 추가 네 칸(CPO §2 요구) ──────────────────────── */
  provenance: CodeProvenance;       // A-2 의 다섯 중 하나
  /** 🟢 **추출 위치 또는 근거** — 원문 발췌 또는 경로. 🔴 번역·가공 0. */
  locator: string | null;           // 예: "Product Code WK21W97 AW26" / "slug[0]"
  /** 🔴 **추출 시점** — 가격처럼 값이 바뀐다(실측: GBP 58 → 40.6 / 15일 차). */
  observedAt: string;               // ISO8601
  /** 🔴 **변형 식별 가능 여부** — §C 가 이 칸의 규칙을 정한다. */
  variantScope: "FULL_VARIANT" | "BASE_ONLY" | "UNKNOWN";
}
```

🔴 **`variantScope` 를 「값」과 분리한 이유가 이번 조사의 실증이다** — Wynken 아웃터는
품번이 같은데 색상이 다르다. 🟢 그 사실을 **품번 레코드 자신이** 들고 있어야
소비처가 「이 품번으로 변형까지 말할 수 있는가」를 묻지 않고 알 수 있다.

### A-4. 양쪽을 **대칭**으로 담는다

```
CodeEvidenceSet {
  origin:     CodeEvidenceRecord[]   // ORIGIN_DB_SKU · ORIGIN_URL_SLUG …
  candidate:  CodeEvidenceRecord[]   // CANDIDATE_STRUCTURED · CANDIDATE_DESCRIPTION …
  /** 🟢 비교 결과는 «계산» 이고 저장은 선택이다 — 저장하면 재현 가능해진다. */
  comparison: {
    verdict: "EXACT_MATCH" | "NOTATION_ONLY" | "VARIANT_DIFFERENT"
           | "REAL_CONFLICT" | "SLUG_INCIDENTAL" | "BASELINE_MISSING";
    matchedPair: { originIdx: number; candidateIdx: number } | null;
    note: string;
  }
}
```
🔴 `verdict` 어휘는 **MMSE-02 가 이미 쓴 여섯 그대로** 다(새 어휘 0).
🔴 그리고 이 `verdict` 는 **MI `priceTier`·`matchTruth` 와 다른 칸** 이다 —
**판정이 아니라 관측** 이다. 🔴 소비처가 섞지 못하게 이름을 `comparison` 으로 두었다.

---

## §B. EXACT_MATCH 33건 / CONFLICT 40건의 재현 가능성

### B-1. 현재 재현 가능성 — 🔴 **절반이 불가능하다**

| 구분 | 건수 | 재현 가능? | 왜 |
|---|---:|---|---|
| EXACT_MATCH | **33** | 🟡 **부분** | 원상품값은 DB/URL 로 재현 가능 · 후보값은 **13건이 `match_reasons` 텍스트 의존** |
| CONFLICT | **40** | 🔴 **0/40** | **후보 품번이 어디에도 저장되지 않는다**(slug 에도 없다) |
| MATCH 중 BASELINE_MISSING | 42 | 🔴 0 | 같은 이유 |

🔴🔴 **CONFLICT 40건이 재현 불가능한 «정확한 이유»** — 운영 `compareModelCode` 는
**후보 페이지에서 읽은 `facts.brandModelCode`** 로 충돌을 판정한 뒤, `candidate_reviews` 에는
**결과 토큰(`MODEL_CODE`)만** 남긴다. 🔴 **입력값이 사라진다.**
```
저장되는 것   blockers: ["MODEL_CODE"]  ·  match_reasons: "… 품번증거=unavailable (해외 X ↔ 국내 없음)"
저장되지 않는 것  **후보가 실제로 선언한 품번 문자열**  ← 🔴 충돌 판정의 «피고» 다
```

### B-2. 🔵 해결 설계 — **세 단계이고 1단계는 schema 변경이 없다**

```
STEP 1 (🟢 schema 0)  이미 계산되는 값을 «응답» 에 싣는다
   `summarizeIdentityEvidence` 는 MODEL_CODE 축의 양쪽 관찰을 **이미 만든다**.
   그것을 `GeminiTransientEvidence` 에 한 칸으로 실으면 **라이브 조사에서 즉시 재현** 된다.
   🔴 저장은 아니므로 과거 40건은 복구되지 않는다 ⟹ **앞으로 생기는 행만** 재현 가능.
   🟢 비용 0(추가 HTTP 0 · 추가 계산 0 — 버리던 값을 넘긴다).

STEP 2 (🔵 schema 1칸)  `candidate_reviews` 에 **jsonb 한 칸** 을 더한다
   가안 `code_evidence jsonb` — A-4 의 `CodeEvidenceSet` 을 그대로 담는다.
   🟢 왜 jsonb 인가 — 기존 `blockers` · `match_reasons` 가 **이미 jsonb** 다(선례 그대로).
   🔴 왜 칸을 쪼개지 않는가 — 출처가 **다섯이고 양쪽이며 배열** 이다. 컬럼으로 펼치면
      `origin_db_sku` · `origin_url_code` · `cand_structured_code` … 처럼 **칸이 열 개** 가 되고
      그 순간 「합치지 않는다」는 원칙이 **컬럼 이름으로 고정** 돼 축 추가가 schema 변경이 된다.

STEP 3 (🔴 CPO 승인 사안)  `comparison.verdict` 를 **관측으로** 저장
   🔴 그 칸이 `priceTier`/`matchTruth` 와 **혼동될 위험** 이 있다 ⟹ 이름·소비처 제약을
      CPO 가 못 박아야 한다(§F).
```

### B-3. 🔴 과거 40건의 복구 — **backfill 로는 불가능하다**

```
🔴 이유 — 후보 품번은 **후보 페이지에만** 있었고 그 페이지는 **그 시점의 상태** 다.
   지금 다시 받으면 **다른 값** 일 수 있다(실측: junioredition GBP 58 → 40.6 · 15일 차).
🔴 그러므로 「backfill 하면 과거 40건이 복구된다」는 **거짓** 이다.
🟡 가능한 것은 **재관측** 이다 — 지금 페이지를 다시 읽어 **새 `observedAt` 으로** 적는다.
   🔴 그것은 「과거 판정의 입력 복구」가 **아니다** ⟹ 두 사실을 섞어 적지 않는다.
🟢 비용 추정 — 후보 40건이면 HTTP 40회(MMSE-01 2차가 9건에 10회를 썼다 · 같은 경로).
🔴 **이번 설계에서 실행하지 않았다**(조사·설계만).
```

---

## §C. Wynken 변형 충돌 사례 처리 설계

### C-1. 사례를 테스트 케이스로 고정한다

| 케이스 | 원상품 | 후보 | 품번 | 색상 | 🔵 기대 처리 |
|---|---|---|---|---|---|
| **W-1** 모자 | `WK21A165`(DB SKU) | junioredition `WK21A165`(구조화+상세설명) | 🟢 완전 일치 | 🔴 양쪽 **색상 미확인** | `EXACT_MATCH` + `variantScope: UNKNOWN` ⟹ 🔴 **SAME 확정 금지** |
| **W-2** 아웃터 | `WK21W97`(DB SKU) · `Ecru Mix` | junioredition `WK21W97` · **`Blue Mix`** | 🟢 완전 일치 | 🔴🔴 **충돌** | `VARIANT_DIFFERENT` ⟹ 🔴 **기존 `COLOR_VARIANT` 보류 유지** |
| **W-3** 아웃터 | `WK21W97` | nickis.com 품번 **없음** | 🔴 재현 불가 | 브랜드만 일치 | `BASELINE_MISSING` ⟹ 미확정 |
| **W-4** 아웃터 | `WK21W97` | villagekids 브랜드 **`Guess`** | — | — | 🔴 **다른 상품 근거** |

### C-2. 🔵 `variantScope` 판정 규칙 — 제안 (🔴 구현 0)

```
FULL_VARIANT   품번에 **변형 접미가 있고** 그 접미가 양쪽에서 같다
               예: `B226AC033-401` ↔ `B226AC033-401`
               🔴 단 「-401 이 색상 코드인가」는 **아직 미확정** 이다(MIER-01 ⒞)
BASE_ONLY      품번이 **기본 모델만** 가리키고 변형 접미가 없다
               예: `WK21W97` ↔ `WK21W97`  ⟹ 🔴 **색상·사이즈를 말할 수 없다**
UNKNOWN        접미 유무를 판단할 근거가 없다
🔴🔴 그리고 **규칙 하나를 못 박는다**:
   `BASE_ONLY` + 색상 축 CONFLICT  ⟹ **SAME 확정 금지**(기존 `COLOR_VARIANT` 그대로)
   🟢 즉 **이 설계는 차단을 «추가» 하지 않는다** — 기존 차단이 왜 맞는지를 **설명 가능하게** 만든다.
```

🟢🟢 **이것이 이 설계의 가장 중요한 효과다** — 지금 W-2 는 「`COLOR_VARIANT` 때문에
보류」라고만 적힌다. 🔵 설계 후에는 **「품번은 완전 일치하는데 그 품번이 색상을 가르지
못하고, 실제 색상이 충돌한다」** 를 셀러·CPO 가 **한 줄로** 읽는다.

### C-3. 🔴 이 설계가 **하지 않는** 것

```
❌ 품번 일치만으로 SAME 확정            ❌ `COLOR_VARIANT` 차단 완화
❌ slug 복구 품번의 식별자 승격          ❌ 새 blocker/axis 신설
❌ SAME 임계값·eligibility 변경          ❌ 변형 접미 의미의 임의 확정(`-401` 미확정 유지)
```

---

## §D. schema 변경이 필요한 이유와 최소 범위

### D-1. 🔵 최소 변경 — **컬럼 «하나»**

| 대상 | 변경 | 이유 |
|---|---|---|
| `candidate_reviews` | 🔵 `code_evidence jsonb NULL` **1칸 추가** | 후보 품번과 출처를 담을 자리가 **없다**(현재 24칸 전수 확인) |
| `product_snapshots` | 🟢 **변경 0** | 원상품 쪽은 `workspace` jsonb 안에 담을 수 있다(기존 칸) |
| 그 외 테이블 | 🟢 **변경 0** | — |
| 인덱스 | 🟢 **추가 0** | 조회 축이 아니다(관측 보존용) |
| CHECK 제약 | 🟢 **추가 0** | 🔴 `source` CHECK 를 건드리지 않는다(079 그대로) |

🔴 **왜 jsonb 한 칸인가** — 출처 다섯 × 양쪽 × 배열이므로 컬럼으로 펼치면 10칸 이상이고,
축이 늘 때마다 **migration 이 필요해진다**. 🟢 기존 `blockers`/`match_reasons` 가 이미 jsonb 다.

### D-2. 기존 데이터 호환성

```
🟢 `NULL` 허용이므로 **기존 364행은 그대로** 읽힌다(읽는 쪽이 `?? null` 하면 끝).
🟢 기존 소비처 영향 0 — 새 칸을 읽는 코드가 아직 없다.
🔴 그러나 **「NULL = 품번 증거 없음」으로 읽으면 틀린다** — 그 행들은
   **기록되지 않은 것** 이다(MMSE-01 에서 같은 함정을 실증했다: 축이 UNKNOWN 이던
   2건이 2차에서 품번 완전일치로 뒤집혔다).
🔵 그래서 설계에 **`observedAt` 이 필수** 다 — 「언제 관측했는가」가 없으면
   「없다」와 「아직 안 봤다」를 영구히 구분할 수 없다.
```

### D-3. backfill 가능 여부와 한계

| 값 | backfill 가능? | 근거 |
|---|---|---|
| `ORIGIN_DB_SKU` | 🟢 **가능** | 스냅샷에 이미 있다(43/122) · 계산 0 |
| `ORIGIN_URL_SLUG` | 🟢 **가능** | `source_url` + 순수 함수 ⟹ **HTTP 0**(이번에 실제로 그렇게 했다) |
| `CANDIDATE_STRUCTURED` | 🔴 **불가** | 후보 페이지 재요청이 필요하고 그것은 **재관측** 이다(B-3) |
| `CANDIDATE_DESCRIPTION` | 🔴 **불가** | 같은 이유 |
| `JUDGEMENT_TEXT` | 🟡 **부분** | `match_reasons` 에서 파싱 가능(이번에 13건 했다) · 🔴 등급 C 다 |

🔴🔴 **그래서 backfill 은 «원상품 쪽만» 가능하다.** 후보 쪽을 채우려면 재관측이고,
그것은 **과거 판정의 입력이 아니다**. 🔴 CPO 승인 없이 실행하지 않는다.

---

## §E. 구현 시 예상 효과와 오판 위험

### E-1. 🟢 효과 — **측정 가능성이 먼저 열린다**(SAME 증가가 아니다)

```
① 🟢🟢 **CONFLICT 40건의 성질을 처음으로 측정할 수 있다** — 지금은 0/40 재현이다.
   🔵 그 측정 없이는 「slug 품번 자격」을 영구히 판단할 수 없다(CPO 보류의 해제 조건).
② 🟢 **출처 등급이 생긴다** — EXACT_MATCH 33건이 「DB 선언 25 / URL 복구 8」로 갈린다.
   🔵 CPO 가 「A 등급만 식별자로 인정」 같은 결정을 **데이터 위에서** 할 수 있다.
③ 🟢 **변형 충돌을 설명할 수 있다** — W-2 가 「품번 일치 · 변형 불가 · 색상 충돌」로 적힌다.
🔴 **SAME 이 몇 건 늘어나는지는 예측하지 않는다** — 미측정이고, 이 설계의 목적이 아니다.
```

### E-2. 🔴 오판 위험 — 넷을 분리한다

```
① 🔴🔴 **새 칸이 «판정» 으로 읽히는 위험**(가장 크다)
   `comparison.verdict` 가 `EXACT_MATCH` 를 적으면 다음 사람이 그것을 **SAME 근거** 로 읽는다.
   🟢 완화: 이름을 `comparison`(관측)으로 두고, **소비처 계약** 으로 잠근다 —
      「MI 판정·가격 집계·등록 payload 가 이 칸을 읽지 않는다」.
      🔵 그 계약을 **구현 WU 의 필수 산출물** 로 못 박을 것을 요청한다(§F).
② 🔴 **`NULL` 을 「증거 없음」으로 읽는 위험** — D-2 에 적었다. `observedAt` 이 완화 수단이다.
③ 🔴 **재관측값이 과거 판정의 입력으로 오인되는 위험** — `observedAt` 과
   「판정 시점」을 **같이** 적어야 한다. 🔴 두 시점이 다르면 **비교 근거로 쓰지 않는다**.
④ 🔴 **출처 등급이 조용히 판정에 섞이는 위험** — 등급 A/B/C 는 **제안** 이고
   자동 판정 입력이 아니다. 🔵 등급을 판정에 쓰는 것은 **별도 승인** 이다.
```

### E-3. 🔴 이 설계로도 해결되지 않는 것

```
⒜ 🔴 과거 CONFLICT 40건의 **그 시점 입력** — 영구 복구 불가(B-3)
⒝ 🔴 `-401` 류 변형 접미의 **의미** — 미확정 유지
⒞ 🔴 표본 — 고유 품번 **3종** · 고유 원상품 제목 **4개** · 고유 상품 **28개**
   ⟹ 🔴 이 설계의 효과도 그 표본에서만 관측됐다
⒟ 🔴 **국내 후보 공급** — 의류-상의 밖 국내 후보가 0 인 문제는 이 설계와 무관하다
```

---

## §F. CPO · CEO 승인 필요 항목

### ⒜ 🔵 CPO 승인 — 설계 범위

| # | 항목 | CTO 권고 | 비고 |
|---|---|---|---|
| F-1 | **STEP 1**(계산된 품번 관찰을 응답에 싣기 · **schema 0**) | 🟢 **먼저 승인 권고** | 비용 0 · 앞으로의 행만 재현 가능 |
| F-2 | **STEP 2** `candidate_reviews.code_evidence jsonb` **1칸** | 🔵 **설계 승인 → 구현 별도** | 기존 364행 영향 0 |
| F-3 | 출처 다섯 축과 등급 A/B/C **어휘 확정** | 🔵 CPO 확정 필요 | 🔴 등급을 판정에 쓰지 않는 조건 |
| F-4 | `variantScope` 세 상태 **어휘 확정** | 🔵 CPO 확정 필요 | 🟢 차단 추가 0 |
| F-5 | **소비처 계약**(MI·가격·등록이 이 칸을 읽지 않는다)을 구현 WU 필수 산출물로 | 🟢 **강하게 권고** | E-2 ① 완화 수단 |

### ⒝ 🔴 CPO 승인 — 실행 범위(설계와 **분리**)

| # | 항목 | CTO 권고 |
|---|---|---|
| F-6 | migration 실행 | 🔴 **설계 검토 후 별도 승인**(CPO 가 이미 그렇게 정했다) |
| F-7 | 원상품 쪽 backfill(DB SKU · URL 복구 — **HTTP 0**) | 🟡 가능하나 **승인 필요** |
| F-8 | 후보 쪽 **재관측**(HTTP 약 40회) | 🔴 **과거 복구가 아니다**를 전제로만 |
| F-9 | slug 품번 식별자 자격 | 🔴 **보류 유지** — F-1/F-2 로 분모가 생긴 **뒤** 판단 |

### ⒞ 🔴 CEO 승인이 필요한 것

```
🟢 **없다.** 이 설계는 외부로 나가는 행위·비용·상업적 결정을 포함하지 않는다.
🔴 단 F-8(재관측 HTTP 40회)은 외부 요청이므로, CPO 가 비용·약관 관점에서
   필요하다고 보면 그때 CEO 판단 사안이 된다(현재는 아니다).
```

---

## §G. 변경 0 확인

```
schema 0 · migration 0 · backfill 0 · 운영 코드 0 · 판정 로직 0 · UI 0 ·
slug 품번 식별자 승격 0 · SAME 기준·blocker 0 · `COLOR_VARIANT` 차단 유지 ·
DB 쓰기 0 · 새 수집 0 · typecheck 0
산출물   이 설계 문서 하나(코드 추가 0)
🔴 정정 1건 — 「EXACT_MATCH 고유 품번 4개」는 **3개** 다(§0).
   원인은 「고유 품번 3종」과 「고유 원상품 제목 4개」를 한 문장에 섞은 것이다.
```
