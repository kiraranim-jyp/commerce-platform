# IPES STEP 1 — 기존 후보군 · Evidence · CEO 육안 판정 «회수» 제출

> 🔴🔴 **CTO 는 이 문서에서 판정 기준을 만들지 않았다.** CPO 지시(IDENTICAL PRODUCT
> EVIDENCE STANDARD · STEP 1)대로 **기존 자료의 위치·시점·출처·분포만** 적었다.
> 점수·가중치·필수조건·임계값 **전부 0**. 원본 데이터 수정 **0** · 병합 **0** · 새 검색 **0**.
>
> 🟢 재현: `node packages/database/scripts/ipes-step1-inventory.mjs` (read-only · SELECT only)

---

## 0. 🔴 먼저 — 합치면 틀리는 것 넷

```
① `wu-099-human-value.json` · `wu-100-human-value.json` 은 **가치 라벨**
   (USEFUL / NOISE / UNSURE)이고 **동일상품 판정이 아니다** ⟹ GT 에 합치지 않는다
② `sprint5-brand-gt.json`(38행)은 **운영 `candidate_reviews` 의 사람 판정 행 export** 다
   (파일이 스스로 `capturedFrom: production candidate_reviews` 라고 적었다)
   ⟹ 🔴 DB 38행과 **같은 데이터** 다. 둘을 더하면 **두 배로 센다**
③ `cand-02-rows.json` · `dmc-01-trace.json` · `dsp-01-funnel.json` ·
   `query-adopt-01-production.json` · `query-arch-01-production.json` 의 `verdict` 는
   **시스템 판정** 이다(운영 덤프) ⟹ 🔴 **사람 판정으로 세지 않는다**
④ 🔴 `wu-093-human-gt.json` 은 **키가 판매처 SKU** 다(URL 아님) ⟹ URL 축으로 추적 불가
```

---

## 1. 사람(CEO) 육안 판정 자료 — 전수

| 자료 | 원상품 | 후보 | 라벨 분포 | CEO 근거 | URL | 같이 보존된 Evidence |
|---|---|---:|---|---|---|---|
| `core-same03-human-gt.json` | B226AC009 / B226AC010 | **10** | 동일 **5** · 다른제품 **0** · 판단불가 **5** | 🟢 `why` | 🟢 | `system` · `matchTruth` · `priceTier` · `blockers` · `conflicts` · **`inDomesticReference`** · `priorVerdicts` |
| `core-2m-ceo-visual-gt.json` | B226AC009 | **10** | `ceoUiLabel` 동일 **8** · 유사 **1** · 판단불가 **1**<br>`calibrationLabel` SAME 8 · DIFFERENT 1 · UNCERTAIN 1 | 🟢 `ceoBasis` | 🟢 | `domain` |
| `wu-112-human-gt.json` | 2개 | **27** | SAME **19** · DIFFERENT **6** · UNCERTAIN **2** | 🟡 8/27 | 🟢 27/27 | — |
| `core-desc-review-ceo-gt.json` | — | **11** | SAME **4** · DIFFERENT **7** | 🔴 0/11 | 🔴 **0/11** | `brand` |
| `wu-093-human-gt.json` | 2개 | **10** | SAME **2** · DIFFERENT **8** | 🟢 8/10 | 🔴 0/10(SKU 키) | `title` |
| `wu-125-human-gt.json` | — | **9** | SAME **5** · DIFFERENT **4** | 🟡 3/9 | 🟢 | — |
| `core-2al-human-gt.json` | — | **6** | DIFFERENT **6** | 🟢 6/6 | 🟢 | — |
| `core-2aj-human-gt.json` | — | **4** | SAME **4** | 🟢 4/4 | 🟢 | — |
| `wu-111-human-gt.json` | 2개 | **2** | SAME **2** | 🔴 0/2 | 🟢 | `priceStatus` |
| `wu-116-human-gt.json` | 1개 | **1** | DIFFERENT **1** | 🔴 0/1 | 🟢 | `market` |
| *(가치 라벨 · GT 아님)* `wu-099` / `wu-100` | B226AC112 | 26 / 26 | USEFUL 2·NOISE 12·UNSURE 12 / NOISE 26 | 🟢 24/26 | 🔴 0 | — |

🔴 **합계를 내지 않았다** — 같은 후보가 여러 파일에 중복될 수 있고(원상품/키 체계가 다르다)
중복 제거 기준은 **CPO 가 정할 사안** 이다. 🟢 중복 판정 여부는 아직 **측정하지 않았다**.

### 🔵 CEO 육안 검토 «화면» 산출물(자립형 HTML · 그때 CEO 가 본 그 화면)

```
core-same03-domestic-review.html   4.6MB    core-2m-visual-review.html   8.3MB
core-2aj-ceo-review.html           4.0MB    core-2al-ceo-review.html     6.1MB
wu-112-candidate-list.html         7.6MB    wu-099-dropped-review.html   7.8MB
wu-123-gt-review.html              3.9MB    wu-125-gt-review.html        1.4MB
wu-093-gt-review.html              2.6MB    wu-111-gt-review.html        0.7MB
core-desc-evidence-review.html     0.1MB    search-provider-05-urls.html 1.3MB
```
🟢 이미지가 `data:` URI 로 임베드돼 있어 **로그인·네트워크 없이** 그때의 후보 사진을 볼 수 있다.

---

## 2. 운영 DB `candidate_reviews` — 사람 판정의 «운영» 저장소

```
human_verdict  SAME 22 · DIFFERENT 15 · SIMILAR 1  =  **38행** / 원상품 **6개**
               (human_verdict = null 인 관측 행이 별도로 142행 · 스냅샷 63)
```

| 원상품 | n | SAME | SIMILAR | DIFFERENT |
|---|---:|---:|---:|---:|
| B226AC009 | 23 | 18 | 0 | 5 |
| B226AC033 | 6 | 1 | 0 | 5 |
| B226AC110 | 4 | 0 | 1 | 3 |
| B226AC036 | 2 | 2 | 0 | 0 |
| B226AC170 | 2 | 0 | 0 | 2 |
| B226AC073 | 1 | 1 | 0 | 0 |

### 🟢🟢 사람 ↔ 시스템 «대조 가능» 분모 = **21행** (둘 다 있는 행)

| 사람 | 시스템 | n |
|---|---|---:|
| SAME | **SAME** | **3** |
| SAME | PRESUMED_SAME | 4 |
| **DIFFERENT** | **PRESUMED_SAME** | **13** |
| SIMILAR | PRESUMED_SAME | 1 |

🔴 **이 표가 STEP 2 의 핵심 입력이다**(CTO 는 여기서 기준을 만들지 않았다 · 관측만 적는다):
```
시스템 SAME          3행 → 사람 SAME 3        ⟹ 관측 정밀도 **3/3**
시스템 PRESUMED_SAME 18행 → 사람 SAME 4 · DIFFERENT 13 · SIMILAR 1
                                            ⟹ 관측 정밀도 **4/18**
```
🔴 **분모 21 이다.** 전체 상품군 정밀도로 일반화하지 않는다(원상품 6개 · 사람 판정 38행 중 21).

---

## 3. 🔴 Evidence 미수집 — 「없다」와 「0」을 섞지 않는다 (사람 판정 38행 기준)

| Evidence 칸 | 미수집 | 비고 |
|---|---:|---|
| `image_url` | **38 / 38** | 🔴🔴 **전건 없음** — WU-099 에서 CEO 평가 26건 중 12건이 「이미지가 없어서」 측정불가로 돌아온 그 축이다 |
| `price_status` | 26 / 38 | |
| `market` | 22 / 38 | `null` 또는 `UNKNOWN` |
| `match_truth` | 22 / 38 | |
| `candidate_title` | 21 / 38 | |
| `price_amount` | 21 / 38 | |
| `system_verdict` | 17 / 38 | ⟹ 대조 가능 분모가 21 인 이유 |
| `match_reasons` | **0 / 38** | 🟢 전건 보유 |

🔴 **그 공백을 메우지 않았다** — 추론으로 채우면 그것이 「정답에 맞춘 수정」이다(CPO §1 금지).

---

## 4. 🔴🔴 라벨 체계의 함정 넷 — 기준을 세우기 «전» 에 알아야 한다

```
① **CEO UI 에 「다름」 버튼이 없었다.** 선택지는 **동일 / 유사 / 판단불가** 셋이다
   (`core-2m-ceo-visual-gt.json` 의 note). 그래서 그 파일은 **두 칸으로 갈라** 보존한다 —
   `ceoUiLabel`(사람이 누른 것) ↔ `calibrationLabel`(의미). 🔴 `parkette` 는
   `ceoUiLabel=유사` 인데 CEO 의 실제 의미는 **「다름」** 이라 `calibrationLabel=DIFFERENT` 다
   ⟹ 🔴 **「유사」를 기계적으로 SIMILAR 로 읽으면 DIFFERENT 가 SIMILAR 로 섞인다**
② `core-same03` 은 **「다른제품」이 0** 이다(파일이 스스로 적었다) ⟹ 그 표본으로
   **precision 을 계산할 수 없다**
③ `wu-099/100` 은 **가치 라벨** 이다 — 동일상품 판정이 아니다
④ 사람 판정 어휘가 자료마다 다르다 — `SAME/DIFFERENT/UNCERTAIN` · `동일/유사/판단불가` ·
   `동일/다른제품/판단불가` · `USEFUL/NOISE/UNSURE`
   ⟹ 🔴 **어휘 정렬 규칙은 CPO 가 정할 사안** 이다(CTO 가 번역하지 않았다)
```

---

## 5. 🟢 STEP 3 파일럿 후보 — 조건을 가장 많이 충족하는 상품

🔴 **CTO 가 고르지 않았다.** 조건(「Evidence 가 풍부하고 CEO 육안 판정과 대조 가능」)에
대한 **관측값만** 적는다. 선정은 CPO 몫이다.

| 상품 | 사람 판정 | 대조 가능(system 보유) | 같이 보존된 Evidence | 화면 산출물 |
|---|---:|---|---|---|
| **B226AC009** | **23행**(SAME 18 · DIFF 5) | 🟢 최다 | `core-same03`(why·blockers·priceTier·inDomesticReference) **+** `core-2m`(ceoBasis) | 🟢 2종 |
| B226AC033 | 6행(SAME 1 · DIFF 5) | 🟢 | 운영 DB | — |
| B226AC110 | 4행(SIMILAR 1 · DIFF 3) | 🟢 | 운영 DB | — |

🟢 그리고 B226AC009 는 **운영 funnel 로 국내 축이 열린 상품군**(2026-11-05 실측: 🇰🇷 후보 1 ·
SAME 1 · 가격 1)과 같은 브랜드다. 🔴 단 그 funnel 실측은 **B226AC033** 이었다(섞지 않는다).

---

## 6. 🔴 STEP 1 에서 «하지 않은» 것 — 전수

```
❌ 판정 기준 · 점수 · 가중치 · 필수조건 · 임계값 수립      ❌ 라벨 어휘 번역/정렬
❌ 원본 Evidence 수정 · 병합 · 중복 제거                  ❌ 미수집 칸을 추론으로 채우기
❌ 새 검색 · 새 후보 수집                                 ❌ 전체 상품 적용
❌ Identity / 가격 자격 / GT / Search 정책 변경           ❌ DB 쓰기
```

🔵 **CPO 에게 올리는 것은 위 표들 그대로다.** STEP 2(Evidence 기준 확정)는 CPO 산출물이고,
CTO 는 그 기준을 받은 뒤 STEP 3 파일럿으로 들어간다.
