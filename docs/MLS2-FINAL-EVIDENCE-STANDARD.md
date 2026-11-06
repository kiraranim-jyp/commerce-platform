# MLS2 — FINAL EVIDENCE STANDARD (동일상품 판단 기준)

> 🔴🔴 **이 문서는 기존 전수 데이터 분석의 산출물이다.** 새 상품 수집 **0** · 사이트 추출 **0** ·
> 429 조사 **0** · 새 하니스 **0** · 검색 공급자 변경 **0** · Identity/가격 정책 변경 **0**.
> 🟢 재현(read-only): `npx tsx packages/database/scripts/mls2-final-standard-analysis.mjs`
> 🟢 전수 후보 비교표: `%TEMP%\mi-p0-02\mls2-final-candidates.tsv`(38행 · 22칸 · 원본 라벨 보존)
> 🟢 선행 자료: `docs/IPES-STEP1-EVIDENCE-INVENTORY.md` · `docs/IPES-STEP2-CPO-EVIDENCE-DOSSIER.md`

---

## 1. 제품 목적과 동일상품 판단 원칙

**100% 동일상품을 증명하는 것이 목적이 아니다.** 판매 가능성이 높은 후보를 넓게 발견하고,
근거와 불확실성을 투명하게 보여 셀러가 ① 국내에서 팔 수 있는지 ② 어디서 가장 싸게
소싱하는지를 **스스로 판단** 하게 하는 것이 목적이다.

🔴 그래서 이 기준은 **발견을 좁히지 않는다.** 좁히는 것은 **가격 집계 자격** 뿐이다.

---

## 2~3. Evidence 전체 정의 — 핵심 3축과 추가 근거

| 핵심 축 | 정의 | 판단 입력(기존 칸) |
|---|---|---|
| **BRAND** | 브랜드 동일성 | `BRAND_MISMATCH`(불일치) ↔ `BRAND_UNCONFIRMED`(미확인) |
| **PRODUCT_NAME** | 상품명 동일성 | `NO_TITLE_OVERLAP`(불일치) ↔ `근거:` 줄의 상품명 언급(일치) |
| **DETAIL_IDENTIFIER** | 품번·모델코드·스타일코드 | `matchTruth ∈ {EXACT_IDENTIFIER, STRONG_IDENTIFIER}`(일치) ↔ `MODEL_CODE` 충돌(불일치) |

| 추가 근거 | 역할 |
|---|---|
| IMAGE · FORM/DESIGN · COLOR · MATERIAL · AUDIENCE/AGE · CATEGORY · OPTION/SET | 🟢 **보강만** 한다 · 🔴 **강한 불일치를 덮지 못한다** |

🔴 **상세설명에서 발견한 브랜드는 BRAND 에, 상품명은 PRODUCT_NAME 에, 품번은
DETAIL_IDENTIFIER 에 «귀속» 된다** — **네 번째 근거가 되지 않는다**(CPO 확정).
🔴 축당 상태는 **하나** 다 ⟹ 같은 원문을 여러 경로에서 읽어도 **중복 계산이 구조적으로 불가능**.

---

## 4~6. 정규화 · 번역 · 상세설명 추출 기준

```
브랜드   영문 ↔ 한글은 **등록부(`brand-alias.ts`)** 로만 동일 취급한다
         🔴 미등록 브랜드의 한글 alias 를 **만들지 않는다**(CPO 유지)
         🟢 미등록이어도 **원문 영문 검색은 그대로** 돈다
상품명   번역 · 표기 · 띄어쓰기 · 시즌명 · 판매처 자체 상품명 차이를 **동일상품 배제 근거로
         쓰지 않는다**(§9 약한 차이)
         🔴 AI 번역(`titleKo`) 단독 검색은 **철회됐다** — 실측 결과 한글 토큰이 전부
            일반 카테고리 명사(「키즈 티셔츠」·「바지」)라 **식별력 0** 이다
         🟢 한글 질의는 **「등록 alias + 품번」** 꼴로만 만든다(`korean-discovery-query.ts`)
품번     ⒜ 설명문 명시 라벨(`Product/Article code`) → ⒝ 제목 → ⒞ URL slug
         🟢 이 순서가 `resolveBrandModelCode` 의 계약이고 **설명문이 1순위** 다
         🔴 판매자 SKU 를 제조사 품번으로 **단정하지 않는다**
```

## 7. 출처·신뢰도 보존

원상품 Evidence 는 `{value, source, confidence}` 로 저장된다(실측 — 지어낸 구조가 아니다).
🔴 기본정보와 상세설명의 값이 다르면 **하나를 고르지 않고 둘 다 보존하고 충돌로 표시** 한다.

---

## 8~9. 상태 정의 — **「미확인」과 「불일치」를 섞지 않는다**

| 상태 | 의미 | 분류에 미치는 영향 |
|---|---|---|
| `MATCHED` | 양쪽이 **같다고 확인됐다** | 일치 1 |
| `MISMATCHED` | 양쪽이 **다르다고 확인됐다** | 강/약으로 갈린다(아래) |
| `UNKNOWN` | **확인하지 못했다** | 🔴 일치로도, 불일치로도 **세지 않는다** |

```
🔴 강한 불일치  BRAND 확정 불일치 · DETAIL_IDENTIFIER 확정 불일치
               ⟹ 언어 중립 식별자라 「확실히 다름」이 곧 다른 상품이다
🟡 약한 차이    PRODUCT_NAME 불일치
               ⟹ 국내 판매처는 상품명을 **자기 말로 다시 쓴다**(토큰 겹침 0 이 정상)
               🔴 **상품명 차이 하나만으로 고확률에서 탈락시키지 않는다**
```

## 10~11. 2-of-3 고확률 판단 기준 (확정)

```
CONFLICTED     강한 불일치 ≥ 1            🔴 개수 검사보다 «먼저» 본다
HIGH           강한 불일치 0 · MATCHED ≥ 2
POSSIBLE       강한 불일치 0 · MATCHED = 1
INSUFFICIENT   MATCHED = 0
```
🔴 추가 근거는 **HIGH 로 올리지 못한다**(계약으로 잠김 · 변이 Q2 5 FAIL).
🔴 이 분류는 **표현 계층** 이다 — `crossSellerVerdict` 를 덮지 않고 Identity 어휘를 반환하지 않는다.

---

## 12. 🔵🔵 전체 CEO GT 대조 결과

### ① 상품별 GT (인수인계 표와 대조 — **원본이 이긴다**)

| 상품 | 행 | 고유 URL | SAME | DIFFERENT | SIMILAR |
|---|---:|---:|---:|---:|---:|
| B226AC009 | 23 | **21** | 18 | 5 | 0 |
| B226AC033 | 6 | 6 | 1 | 5 | 0 |
| B226AC110 | 4 | 4 | 0 | 3 | 1 |
| B226AC036 | 2 | 2 | 2 | 0 | 0 |
| B226AC170 | 2 | 2 | 0 | 2 | 0 |
| B226AC073 | 1 | 1 | 1 | 0 | 0 |
| **합계** | **38** | | **22** | **15** | **1** |

🟢 인수인계 표(22 / 15 / 1)와 **일치한다.** 🔴 단 AC009 는 **같은 URL 이 2행** 이다
(23행 ↔ 고유 21) — **병합하지 않았다**(표시만 · CPO 지시).

### ② Evidence 확보율 (사람 판정 38행)

| 칸 | 확보 | 미수집 |
|---|---:|---:|
| `system_verdict` | 21 | 17 |
| `candidate_title` · `price_amount` | 17 | 21 |
| `blockers` · `match_truth` · `market` | 16 | 22 |
| `match_reasons` · `price_status` | 12 | 26 |
| 🔴 `image_url` | **0** | **38** |

🔴 **IPES DOSSIER §5 의 「`match_reasons` 0/38 없음」을 다시 정정한다** — 실제 **26/38 미수집**
(확보 12)이다. 그때는 「jsonb 배열인가」만 봤고 **빈 배열을 보유로 셌다**.

### ③ 🔴🔴🔴 핵심 축별 상태 — **축 하나가 데이터에 사실상 없다**

| 축 | MATCHED | MISMATCHED | 🔴 UNKNOWN |
|---|---:|---:|---:|
| BRAND | 24 | 10 | 4 |
| PRODUCT_NAME | 3 | 11 | **24** |
| **DETAIL_IDENTIFIER** | **0** | 1 | **37** |

```
관측 가능한 핵심 축 수 —  0축 2 · 1축 24 · 🟢 2축 11 · 🟢 3축 1
🔴🔴 **2-of-3 을 평가할 수 있는 행 = 12 / 38.** 나머지 26 은 관측 축이 1개 이하라
     **구조적으로 HIGH 가 불가능** 하다 ⟹ 그 26 을 실패로 세지 않는다.
```

### ④ CPO §5 교차표 — **두 분모를 갈라 적는다**

**전수 분모 n=38** 🔴 *성능 지표로 쓰지 않는다(Evidence 결손 포함)*

| CEO 판정 | HIGH | POSSIBLE | CONFLICTED | INSUFFICIENT | 합계 |
|---|---:|---:|---:|---:|---:|
| SAME | 1 | 18 | 0 | 3 | 22 |
| DIFFERENT | 0 | 4 | 10 | 1 | 15 |
| SIMILAR | 0 | 0 | 1 | 0 | 1 |

**🟢 평가 가능 분모 n=12** (핵심 축 2개 이상 관측)

| CEO 판정 | HIGH | POSSIBLE | CONFLICTED | INSUFFICIENT | 합계 |
|---|---:|---:|---:|---:|---:|
| SAME | **1** | 0 | 0 | 0 | **1** |
| DIFFERENT | **0** | 0 | **10** | 0 | **10** |
| SIMILAR | 0 | 0 | 1 | 0 | 1 |

```
🟢 HIGH 오포함(CEO DIFFERENT 가 HIGH)        **0 건**
🟢 평가 가능 SAME 중 HIGH 가 아닌 것(놓침)     **0 건**
🟢 CEO DIFFERENT 10/10 이 CONFLICTED 로 간다   **10/10**
🔴 평가 분모에서 제외된 행                    **26 건** — 성공/실패로 세지 않는다
```

🔴🔴 **그러나 이것을 「정확도 100%」로 적지 않는다.** 평가 가능 분모의 **CEO SAME 이 1건**
이다 ⟹ **SAME 측(재현율) 성능은 N=1 이라 판정 불가** 다. 🟢 확정된 것은 **DIFFERENT 측
방어(10/10)와 오포함 0** 뿐이다.

---

## 13. 🔴 오분류 및 미측정 — 숨기지 않는다

```
① 🔴🔴 **DETAIL_IDENTIFIER 가 37/38 UNKNOWN** 이다 ⟹ 2-of-3 이 실질적으로
   **BRAND + PRODUCT_NAME 의 2-of-2** 로 돌고 있다. 「3축」은 **아직 데이터로 성립하지 않는다**
② 🔴 `image_url` **38/38 미수집** ⟹ IMAGE 가산 근거는 **구조적으로 0** 이다
   🟢 단 당시 CEO 화면 HTML 12종에는 사진이 `data:` 로 임베드돼 있다(DB 칸 부재 ≠ 자료 부재)
③ 🔴 `candidate_reviews` 에 **`conflicts` 칸이 없다** ⟹ MODEL_CODE 충돌은 이 분모에서 측정불가
④ 🔴 전수 분모의 「SAME → POSSIBLE 18」은 **오분류가 아니라 Evidence 결손** 이다
   (BRAND 만 관측되고 나머지 둘이 UNKNOWN) — 「18건 놓쳤다」로 적지 않는다
⑤ 🔴 AC009 의 **중복 URL 2행** — 병합 기준은 CPO 결정 사안이라 표시만 했다
⑥ 🔴 `wu-099/100`(가치 라벨 USEFUL/NOISE/UNSURE)은 동일상품 판정이 **아니므로 합치지 않았다**
⑦ 🔴 `core-2m` 의 `ceoUiLabel=유사`(parkette)는 CEO 의 실제 의미가 **「다름」** 이다 —
   「유사」를 기계적으로 SIMILAR 로 읽으면 DIFFERENT 가 섞인다(라벨 정렬은 CPO 소관)
```

## 14. 기존 Identity 정책과의 관계

```
🟢 읽기만 한다 — `crossSellerVerdict` · `matchTruth` · `blockers` · `matchReasons`
🔴 변경 0 — threshold · `SAME_MIN_AXES` · 8축 · blocker · GT · human_verdict ·
   가격 eligibility · brand-alias 등록부 · Registry · DB/schema
🟢 기존 Identity 판정 ↔ 새 표현 분류의 «차이» 는 보존된다 —
   실측 `PRESUMED_SAME → CONFLICTED 13` 이 IPES DOSSIER 의 그 13행이다
```

## 15. 실제 후보별 판정 예시 (전수는 TSV)

| 원상품 | 후보 | CEO | 축 상태 | 분류 |
|---|---|---|---|---|
| AC033 | designerkidswear | DIFFERENT | BRAND **MISMATCHED**(↔ STONE ISLAND JUNIOR) · NAME MISMATCHED | **CONFLICTED** 🟢 |
| AC033 | kidbizkid | DIFFERENT | BRAND **MISMATCHED**(↔ Hugo Boss) | **CONFLICTED** 🟢 |
| AC033 | junioredition | **SAME** | BRAND MATCHED · NAME MATCHED | **HIGH** 🟢 |
| AC009 | biskuit.kr | SAME | BRAND MATCHED · NAME **UNKNOWN** · DETAIL **UNKNOWN** | POSSIBLE 🔴 결손 |

---

## 🔵 기준 확정 결과 (요약)

```
🟢 **확정** — 핵심 3축 정의 · MATCHED/MISMATCHED/UNKNOWN 정의 · 강한 불일치 2축 ·
   약한 차이 1축 · 2-of-3 분류 규칙 · 추가 근거의 비월권 · 중복 계산 금지 구조 ·
   브랜드 정규화(등록부 전용) · 한글 질의(alias+품번) · 품번 출처 3순위
🟢 **검증된 것** — 평가 가능 12행에서 **오포함 0 · DIFFERENT 방어 10/10**
🔴 **확정 못 한 것** — **재현율**(평가 가능 CEO SAME 이 1건) ·
   DETAIL_IDENTIFIER 축의 실효성(37/38 UNKNOWN) · IMAGE 가산(38/38 미수집)
🔵 **다음에 필요한 것은 코드가 아니라 «Evidence 재수집»** 이다 —
   기존 38행은 `match_truth`·`match_reasons`·`image_url` 이 비어 재현율을 잴 수 없다.
   🔴 그 재수집은 운영 재분석이고 **CPO 가 순서를 정할 사안** 이다.
```
