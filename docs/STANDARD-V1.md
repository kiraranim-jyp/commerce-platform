# 📘 Product Intelligence & Seller Decision Standard **v1.0**

> **작성 주체 CPO** · 기준일 2026-11-04 · 기준 자료 `STANDARD-V1-INPUT-CURRENT-BEHAVIOUR.md`
>
> 🔴🔴 **이 파일은 CPO 표준안 v1.0 의 «리포 사본» 이다.** 규범 조항(원칙 · 계약 ·
> 결정표 · 금지 · 검수 항목)은 **빠짐없이** 옮겼고, 산문 설명만 압축했다.
> 🔴 **CTO 가 이 문서의 조항을 고치지 않는다.** 표준 변경은 CPO 산출물이다.
> 🔴 **표준에 없는 동작을 CTO 가 임의로 만들지 않는다**(§11).
>
> 🔵 §12·§13 은 **CTO 가 더한 집행 자료** 다(CPO 지침 1·2) — 5계층 ↔ 코드 매핑과
> 표준 ↔ 코드 불일치 목록. 🔴 그 두 절은 **사실 기록** 이고 정책이 아니다.

---

## 0. 제품 정의와 최상위 전략

**국내외 상품 소싱 기회를 발견하고, 실제 판매처와 가격 근거를 비교하여 판매자의
소싱 의사결정을 지원하는 플랫폼** 이다. 단순 수집·자동등록 도구가 아니다.

```
상품 URL 입력 → AI Search 후보 탐색 → Evidence 수집·비교
→ 동일/추정 동일/유사 구분 → 판매처·소싱 가격 비교 → 권장 판매가격
→ 판매자 최종 가격 결정 → 스마트스토어 및 지원 마켓 등록
```

### 0.2 핵심 운영 원칙
| 영역 | 최우선 원칙 |
|---|---|
| Search | **Recall 우선** |
| Candidate Discovery | 후보 보존 및 폭넓은 노출 |
| Evidence | 원문과 출처 보존 |
| Identity | 근거 기반 **Precision** |
| Price Eligibility | 엄격한 자격 관리 |
| Price Aggregation | 검증 가능한 금액만 집계 |
| Seller Decision | 최종 결정권은 **판매자** |

> 후보를 발견하는 것과 동일상품이라고 판단하는 것은 **서로 다른 작업** 이다.
> 동일상품 여부가 불확실하다는 이유만으로 후보를 **숨기지 않는다**. 반대로 후보가
> 발견되었다는 이유로 그 가격을 동일상품 가격에 **합산하지 않는다**.

### 0.3 🔴 절대 불변 원칙 (7)
```
① 후보 발견과 Identity 판정을 분리한다
② Identity 판정과 가격 자격을 분리한다
③ Evidence 의 누락과 불일치를 구분한다
④ 원본 Evidence 와 정규화 결과를 보존한다
⑤ 미측정을 «실패 0건» 으로 취급하지 않는다
⑥ 사람의 판정 이력을 임의로 변경하지 않는다
⑦ 판매자가 최종 소싱 판단을 내릴 수 있도록 근거를 공개한다
```

---

## 1. 다섯 계층 아키텍처

| 계층 | 명칭 | 책임 |
|---|---|---|
| 1 | **Evidence Attribute** | 상품 원문에서 관측한 사실 수집 |
| 2 | **Identity Signal** | Evidence 가 상품 식별에 갖는 **의미** 정의 |
| 3 | **Matcher Rule** | 실제 상품 동일성 판정 |
| 4 | **Price Eligibility** | 가격 비교·집계 자격 판단 |
| 5 | **Seller Display** | 판매자가 이해할 수 있는 정보 표현 |

🔴 **정보가 존재한다는 사실** 과 **식별력이 있다는 판단** 을 구분한다(계층 1 ↔ 2).

### 1.2 명칭 충돌 방지
| 계층 | FIT | IMAGE |
|---|---|---|
| Evidence | `FIT_EVIDENCE` | `IMAGE_EVIDENCE` |
| Identity Signal | `FIT_IDENTITY_SIGNAL` | `IMAGE_IDENTITY_SIGNAL` |
| Matcher | `FIT_MATCHER_RULE` | `IMAGE_MATCHER_RULE` |
| Display | `FIT_DISPLAY_NOTE` | `IMAGE_DISPLAY_NOTE` |

🔴 **이 명칭은 표준상의 개념 구분이고 기존 코드 식별자를 일괄 변경하라는 지시가 아니다.**
🔴🔴 **FIT Evidence 가 PROBE 라는 사실은 Matcher 의 FIT 조건이 없다는 뜻이 아니다.**

---

## 2. Evidence Standard

### 2.1 기본 계약 + 상태 4
```
EvidenceItem { value, source } · 원문 보존 · 출처 보존
근거가 없으면 항목 자체를 만들지 않는다
추정값을 원문 확보 사실처럼 저장하지 않는다
추출값 · 정규화값 · 추론값을 구분한다
```
| 상태 | 의미 |
|---|---|
| `PRESENT` | 원문 또는 허용된 규칙으로 확보 |
| `MISSING` | 확인 가능한 정보가 없음 |
| `NOT_MEASURED` | 현재 추출 구조로 측정할 수 없음 |
| `CONFLICT` | 출처 또는 비교 결과에서 충돌이 확인됨 |

🔴 **`MISSING` 과 `CONFLICT` 를 같은 상태로 처리하지 않는다.**

### 2.2 속성 사전 (표준 원칙)
| 속성 | 현재 주요 출처 | 현재 Identity 사용 | 표준상 원칙 |
|---|---|---|---|
| BRAND | Shopify · HTML · JSON-LD · 제목 alias · `siteBrandName` | 브랜드 게이트 | 원본과 정규화값 보존 |
| MODEL_CODE | 설명문 · URL · 제목 · 상세 복구 | 3점 | **품번 ↔ 스타일 코드 의미 구분 필요** |
| PRODUCT_NAME | 제목·설명문 | TITLE 경로 | 원문 보존 · 제목 정규화 별도 |
| FORM | 제목·설명문 | `GARMENT_FORM` blocker | **상품 형태 ↔ 소매 길이 구분** |
| COLOR | 설명문·라벨·제목 | 1점 + `COLOR_VARIANT` 보류 | **색상 ↔ 패턴 구분** |
| MATERIAL | 설명문 | 1점 + blocker | 원문 보존 · **무리한 정규화 금지** |
| FIT | 설명문 | **Matcher FIT 조건 존재** | Evidence 와 Matcher 를 **분리** |
| AUDIENCE | Shopify tags/type | 1점 + blocker | 연령·대상 정보 보존 |
| SIZE | Shopify · 사이즈 라벨 | 1점 + blocker | 사이즈 체계 구분 |
| IMAGE | `imageUrls` · dHash | **SAME 정원에서 제외** | 보조 근거로 보존 |
| COMPOSITION / SET / OPTION_SKU | 설명문 | PROBE | **판정 입력 금지 유지** |

### 2.3 측정불가 속성 (7)
`PATTERN` · `DESIGN` · `CHARACTER` · `STYLE_CODE` · `MANUFACTURER_CODE` ·
`COLLECTION` · `SEASON`
🔴 **측정불가는 「정보가 존재하지 않는다」가 아니다.**
🔴 추출 구조를 확장해도 **먼저 Evidence 로 저장** 하고 Identity 반영은 **별도 승인** 이다.

### 2.4 출처 우선 원칙
🔴 출처를 합쳐 하나의 값으로 **덮어쓰지 않는다.** 브랜드가 제목과 JSON-LD 에서 다르게
발견되면 **두 출처를 보존** 하고 충돌을 확인할 수 있어야 한다. **정규화는 원문을 대체하지 않는다.**

---

## 3. Identity Standard

### 3.1 판정 결과
| Verdict | 의미 |
|---|---|
| `SAME` | 동일상품으로 판단 |
| `PRESUMED_SAME` | 동일상품 추정 |
| `SIMILAR` | 유사상품 |
| `DIFFERENT` | 다른 상품으로 확인 |
| `UNKNOWN` | 판단에 필요한 근거 부족 |

🔴 후보의 **존재 여부** 와 Identity **결과** 를 혼동하지 않는다.

### 3.2 현행 판정식 (유지)
```
!blocked && brandOk && corePoints >= SAME_MIN_AXES(5)                      → SAME
totalPoints >= PRESUMED_SAME_MIN_AXES(3) && !sameSellerWithoutIdentity     → PRESUMED_SAME
totalPoints >= 1                                                           → SIMILAR
그 외                                                                       → UNKNOWN
corePoints 에서 IMAGE 와 TITLE 1점 제외 · SAME 을 막는 것은 blocker 와 corePoints 기준
```

### 3.3 관측된 차이 ↔ 정보 부족 (유지)
```
관측된 차이 9  MATERIAL · FIT · SIZE_SYSTEM · GARMENT_FORM · BRAND_MISMATCH ·
               AUDIENCE_LINE · NO_TITLE_OVERLAP · SAME_SELLER_DISTINCT_LISTING ·
               MODEL_CODE_AGE_LINE
집합 밖        BRAND_UNCONFIRMED(브랜드 미확인) · COLOR_VARIANT(색조 일치·색상명 불일치)
🔴 정보 부족과 관측된 불일치는 구분한다
```

### 3.4 Identity 변경 7조건
```
① 실제 사람 판정 데이터 확보   ② SAME ↔ DIFFERENT 양쪽 비교
③ 누락과 불일치 구분          ④ 기존 판정과 반사실 비교
⑤ FP · FN 변화 확인          ⑥ 기존 보호 계약 영향 확인
⑦ 정책 승인
🔴 Evidence 를 추가했다고 자동으로 판정 규칙을 변경하지 않는다
🔴 표본 수치를 전체 시스템 성능으로 표현하지 않는다
```

---

## 4. Search & Candidate Discovery Standard

🟢 Search 는 **동일상품을 확정하는 단계가 아니다** — 검토 가치가 있는 후보를 최대한 발견한다.

**확인된 기존 구조** — BRAND+MODEL CODE+PRODUCT NAME+FACTS/DESCRIPTION 조합 ·
상품당 검색 1회 · 쿼리당 최대 2페이지 · 공급자 OCI primary / Fixie fallback ·
Search Intent ↔ Identity 판정 분리 · 실패 telemetry 및 `searchRun` 기록.

🔴🔴 **§4 는 미완결이다.** 전체 운영 표준과 공급자별 최신 성능이 이 문서의 기준 자료에
없다 ⟹ **검색 공급자 추가 · 검색 횟수 변경 · 검색어 전략 변경을 승인하지 않는다.**

---

## 5. Price Intelligence Standard

### 5.1 가격의 세 의미
| 구분 | 의미 |
|---|---|
| Sourcing Price | 국내외 판매처에서 발견한 소싱 가격 |
| Recommended Sale Price | 시스템이 제안하는 판매가격 — 🔴 **현재 미구현**(원가·수수료 축 보류) |
| Final Sale Price | 판매자가 최종 확정한 판매가격 |

### 5.2 가격 자격 계약 — **다섯을 전부** 통과
```
① tier ≠ EXCLUDED
② verdict ∈ { SAME, PRESUMED_SAME }
③ 유한한 금액이 존재
④ priceStatus ≠ UNVERIFIED_SEARCH
⑤ PRICE_DISQUALIFYING blocker 없음
   BRAND_MISMATCH · NO_TITLE_OVERLAP · SAME_SELLER_DISTINCT_LISTING
```

### 5.3 관측 ↔ 집계 분리
🔴 가격 자격을 충족하지 못했다고 **후보 관측 자체를 삭제하지 않는다.**
의미를 유지할 지표 — `count` · `byMarket` · `byPriceTier` · `unverifiedCount` ·
`observedDifferenceCount`.

### 5.4 통화 정책
```
원본 통화 보존 · 통화별 집계 · 🔴 환산 금지 ·
🔴 서로 다른 통화의 단일 합계 금지 · 🔴 확인되지 않은 환율을 만들지 않는다
```

### 5.5 국내외 시장 구분
도메인 × 통화 **교차 근거** · 충돌·부족은 `UNKNOWN`.
🔴 현재 **국내 가격 축은 판정 입력** 이고 **해외 축은 판정에 닿지 않는다** — 이는
**현행 구현 사실** 이고, 대칭 구조 변경은 **별도 검토** 다.

---

## 6. Seller Decision & UX Standard

### 6.1 후보 표시
🔴 동일상품 가격 집계 대상이 아니더라도 **후보 자체를 숨기지 않는다.**

### 6.2 가격 블록 — `lines.length === 0 → null` **유지**
그 상태의 **확정 문구**:
> 동일상품 가격으로 비교할 수 있는 판매처가 아직 없습니다. 후보 상품의 가격과 상품 정보를 확인해 주세요.

### 6.3 가격 제외 사유 (문구 owner 유지)
```
UNVERIFIED       「N곳은 가격을 확인하지 못해 위 금액에 넣지 않았습니다.」
관측된 상품 차이   「N곳은 상품 차이가 확인돼 동일상품 가격에 넣지 않았습니다.」
🔴 다른 상품이라고 근거 없이 단정하지 않는다
```

### 6.4 Tier 표시
| Tier | 사용자 표현 |
|---|---|
| EXACT / CONFIRMED | 동일상품 |
| COMPARISON | 동일상품 추정 |
| REFERENCE | 유사상품 · 참고 |
| EXCLUDED | 동일상품 아님 |

🔴 내부 토큰·기술적 blocker 이름을 판매자 화면에 노출하지 않는다.
🔴 「시장 평균」 표현과 통화 환산 표시는 **현재 확정 범위에서 금지** 한다.

---

## 7. 운영 품질 및 변경 관리

### 7.1 변경 전 필수 검증
실제 운영 데이터 · 사람 판정 데이터 · 기존 계약 · 기존 회귀 · **음성 대조** ·
typecheck · build · **실제 운영 경로 검증**.

### 7.2 테스트 원칙
```
🔴 테스트 통과 숫자만으로 제품 기능 완료를 선언하지 않는다
🔴 실제 운영 데이터 효과와 사용자 화면 효과를 «별도» 로 검증한다
🔴 변이가 «실제로 적용됐는지» 확인한다 — 적용되지 않은 통과는 유효한 음성 대조가 아니다
🔴 Flaky 테스트는 재실행 결과와 원인을 «함께» 기록한다
```

### 7.3 변경 권한
| 역할 | 책임 |
|---|---|
| CEO | 사업 전략 및 최종 제품 경험 결정 |
| CPO | 제품 표준 · 정책 · 우선순위 · 품질 승인 |
| CTO | 기술 설계 · 구현 · 테스트 · 배포 및 완료 보고 |

CTO 는 승인된 범위 내에서 구현 세부를 자율 결정한다. 정책 충돌 · LOCK 변경 ·
사업적 판단이 필요할 때만 CPO/CEO 에 요청한다.

---

## 8. 미확정 정책 및 현재 결정

| 항목 | 현재 근거 | **CPO 결정** |
|---|---|---|
| Evidence / Matcher 어휘 충돌 | FIT · IMAGE 등 계층 간 명칭 중복 | **어휘 표준화 필요 · 판정 동작 변경 금지** |
| `COLOR_VARIANT` | 사람 판단 4/4 일관 관측 | **기존 분류 유지** · 분류표 변경은 별도 승인 |
| PATTERN | COLOR 칸에 패턴명 혼입 | **추출 분리 방향 승인 · 구현은 표준 확정 전 보류** |
| FIT 무조건 정규화 | SAME 6/18→7/18 · R1 가드 2건 · 기준선 13파일 | 🔴 **불승인** |
| MATERIAL 정규화 | 동일 브랜드·제목 후보에 blocker 발생 사례 | **현행 유지 · 규칙 변경 불승인** |
| AC↔AB | CEO 사람 판정 SAME 4/4 ↔ 품번 보호 계약 충돌 | **현행 보호 유지** |
| 독립 소매 길이 축 | 5/6 원문 정합 · 1건 반증 | 🔴 **신설 불승인** |
| 미수집 7속성 | 추출 칸 부재 | **측정불가** · 신규 추출은 별도 범위 |
| 원상품 브랜드 공백 | C48·C14 하니스 측정불가 | **라이브 원상품 재추출 필요** |

### 8.1 FIT 명시적 결정
🔴 `relaxed fit ↔ loose fit` **무조건 정규화는 승인하지 않는다.**
🟢 `fitExpressionOnlyNote` 는 **판정과 분리된 표시 기능** 으로 유지한다.
🔴 **S1-4 는 SAME 회복으로 간주하지 않는다.**

### 8.2 PATTERN 명시적 결정
PATTERN 은 COLOR 와 **다른 속성** 이다. 추출 구조를 분리하되 **추출 성공만으로
Identity blocker 나 점수를 변경하지 않는다.**

---

## 9. 단계별 로드맵

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | UNVERIFIED 가격 집계 분리 | **완료** |
| 2 | 후보 노출과 가격 자격 분리 | **완료** |
| 3 | 브랜드 Evidence 공급 | **완료** |
| 4 | FIT 표현 차이 설명 기능 | **부분 완료** · 무조건 정규화 **불승인** |
| 5 | COLOR / PATTERN 추출 분리 | **보류** |
| 6 | AC↔AB 완화 및 독립 소매 축 | 🔴 **불승인** |

🔴 **1~3 의 구현 완료와 실제 사용자 화면 검수 완료를 혼동하지 않는다.**
🔴 4 의 설명 기능은 판정 변경이 아니며 **S1-4 회복으로 기록하지 않는다.**

---

## 10. 판매자 화면 최종 검수 (CPO/CEO 직접 확인 · 10항)
```
① 국내 후보가 실제로 노출되는가            ② 해외 후보가 실제로 노출되는가
③ 후보별 판매처와 가격이 명확한가            ④ 동일상품 ↔ 동일상품 추정이 구분되는가
⑤ 유사상품 가격이 동일상품 가격으로 오인되지 않는가
⑥ 가격 확인 불가 사유가 이해되는가           ⑦ 후보가 없어 보이는 빈 화면이 발생하지 않는가
⑧ 판매자가 최종 소싱처를 쉽게 선택할 수 있는가
⑨ 권장 판매가격과 최종 판매가격의 책임이 구분되는가
⑩ 등록 단계까지 정보가 정확하게 이어지는가
🔴 화면을 직접 확인하지 않은 경우 «완료» 로 선언하지 않는다
```

---

## 11. 표준안 변경 원칙

이 표준은 기존 코드의 모든 동작을 **무조건 정답으로 선언하는 문서가 아니다.**
현재 운영 사실을 출발점으로 하되 제품 전략과 충돌하는 지점은 **미확정 정책으로 분리** 한다.

새 정책 승인 전 요구 자료 — 근거 데이터 · 변경 전후 영향 · FP/FN 변화 ·
후보 노출 변화 · 가격 자격 변화 · 기존 계약 영향 · 회귀 및 음성 대조 결과.

🔴 **기존 계약이 잘못된 경우 계약을 «약화» 시키지 않는다** — 실제 의도와 일치하도록
**근거를 갖추어 갱신** 한다.
🔴🔴 **표준에 없는 동작을 CTO 가 임의로 만들어서는 안 된다.**

> **발견은 넓게. 근거는 풍부하게. 판정은 정교하게. 가격은 엄격하게. 최종 결정은 판매자에게.**

🔴 **v1 은 기존 구현 사실과 확정 정책의 기준이다.** Search 전체 표준과 실제 화면 검수가
미완결이므로 **제품 전체가 표준 적합 상태라고 선언하지 않는다.**

---
---

# 🔵 §12 (CTO) 5계층 ↔ **현재 코드** 매핑 — 지침 1 · **동작 변경 0**

🔴 CPO 가 「기존 코드 식별자를 일괄 변경하라는 지시가 아니다」라고 했으므로 **이름을 바꾸지
않았다.** 아래는 **표준 용어가 코드의 어느 자리를 가리키는지** 의 사전이다.

| 표준 계층 | 코드 자리(owner) |
|---|---|
| Evidence Attribute | `attachProductEvidence` → `ProductFacts.evidence` (`product-evidence.ts`) · 축 목록 `IDENTITY_EVIDENCE_AXES` / `PROBE_EVIDENCE_AXES` (`product-facts.ts:682·697`) · 🔴 **관측 전용**(계약 P2) |
| Identity Signal | 🔴 **전용 자리가 없다** — 의미가 `compareFit` 등 **비교 함수 주석** 과 `OBSERVED_DIFFERENCE_BLOCKERS`(`cross-seller.ts:153`)에 흩어져 있다 |
| Matcher Rule | `compareCrossSellerProducts`(`cross-seller.ts`) · 축 `CrossSellerAxis`(:642) · blocker `CrossSellerBlocker` · 점수 `SAME_MIN_AXES` / `PRESUMED_SAME_MIN_AXES` / `corePoints`(:1281) |
| Price Eligibility | `summarizeCandidateOverseasPrices`(`candidate-market.ts`) 다섯 조건 · `PRICE_ELIGIBLE_VERDICTS` · `PRICE_DISQUALIFYING_BLOCKERS` · `priceTierFromLink`(`domestic-product-link.ts`) |
| Seller Display | `TIER_LABEL` · `buildOverseasReference`(`overseas-reference.ts`) · `OverseasReferencePrice.tsx` · `marketEmptyNote` / `MARKET_EMPTY_NO_COMPARABLE_PRICE`(`mi-same-candidates.ts`) |

**FIT 네 층의 실제 자리**
```
FIT_EVIDENCE        evidence.FIT (PROBE_EVIDENCE_AXES)            🟢 존재
FIT_IDENTITY_SIGNAL 🔴 **없다** — R1 예외 의미가 compareFit 주석에만 산다
FIT_MATCHER_RULE    compareFit + FIT blocker + FIT_CANONICAL      🟢 존재
FIT_DISPLAY_NOTE    fitExpressionOnlyNote (STAGE 7-6)            🟢 존재
```
**IMAGE 네 층의 실제 자리**
```
IMAGE_EVIDENCE        evidence.IMAGE · classifyImageEvidence · dHash  🟢 존재
IMAGE_IDENTITY_SIGNAL 🔴 **없다** — 「SAME 정원에 들어가지 않는다」가 corePoints 필터 한 줄뿐
IMAGE_MATCHER_RULE    corePoints 에서 제외(cross-seller.ts:1281)        🟢 존재
IMAGE_DISPLAY_NOTE    후보 카드 이미지                                 🟢 존재
```

---

# 🔵 §13 (CTO) 표준 ↔ 코드 **불일치 목록** — 지침 2 · 🔴 **사실만. 수정 0**

| # | 표준 조항 | 코드 사실 | 성질 |
|---|---|---|---|
| A | §3.1 verdict 에 **`DIFFERENT`** 가 있다 | 🔴 `CrossSellerVerdict = SAME \| PRESUMED_SAME \| SIMILAR \| UNKNOWN \| **CONFLICT**`(`cross-seller.ts:77`) — **`DIFFERENT` 라는 값이 없다**. 사람 라벨은 `DIFFERENT`, 시스템은 `CONFLICT` 다 | **어휘 불일치** |
| B | §2.1 Evidence 상태 **4**(`PRESENT`/`MISSING`/`NOT_MEASURED`/`CONFLICT`) | 🔴 그 enum 이 **코드에 없다**(전수 grep 0). 현재는 ⒜ 항목 존재/부재 ⒝ blocker 로만 표현되고 **`NOT_MEASURED` 는 어디에도 없다** | **구조 부재** |
| C | §1 Identity Signal 계층 | 🔴 **전용 자리 없음**(§12) — FIT·IMAGE 의 「의미」가 주석에만 있다 | **구조 부재** |
| D | §2.4 「두 출처를 보존하고 충돌을 확인할 수 있어야 한다」 | 🟡 **Evidence 층은 source 별로 보존** 하지만 `facts.brand` 는 **`??` 체인으로 하나를 고른다**(`seller-facts.ts`) ⟹ matcher 가 보는 값에는 **출처 충돌이 남지 않는다** | **부분 불일치** |
| E | §5.1 Recommended Sale Price | 🔴 **미구현**(표준이 그 사실을 적고 있다) | 표준과 일치(미구현 명시) |
| F | §5.5 국내/해외 비대칭 | 🟢 표준이 **현행 사실로 인정** 하고 대칭화는 별도 검토 | 불일치 아님 |
| G | §2.2 「MODEL_CODE — 품번 ↔ 스타일 코드 의미 구분 필요」 | 🔴 코드에는 **한 칸**(`brandModelCode`)뿐이다. 스타일 코드 칸은 §2.3 측정불가 | **구조 부재** |
| H | §2.2 「FORM — 상품 형태 ↔ 소매 길이 구분」 | 🔴 `GARMENT_FORM` 이 **소매 길이를 보지 않는다**(양쪽 전건 `SHIRT`) · 독립 소매 축은 §8 **불승인** | 표준과 일치(보류 명시) |
| I | §2.2 「COLOR — 색상 ↔ 패턴 구분」 | 🔴 패턴명이 **COLOR 칸으로 들어온다**(`Conker Stripe`) · 분리는 §8 **표준 확정 전 보류** | 표준과 일치(보류 명시) |

🔴 **A·B·C·D·G 는 「구조가 없다/어휘가 다르다」이고 동작 결함이 아니다.** 어느 것도
이 세션에서 **고치지 않았다** — 전부 §11(「표준에 없는 동작을 임의로 만들지 않는다」)에 따른다.
🔵 집행 순서는 CPO 가 정한다. 🟡 **A 와 B 는 「동작 변경 0」 으로 닫을 수 있는 후보** 다
(어휘 사전 · 상태 enum 추가 후 기존 값 매핑). 🔴 CTO 가 착수하지 않았다.

---
---

# 🔵 §14 (CTO) **1차 집행 — A · C · B**(CPO 지시 2026-11-04 · 🔴 운영 코드 변경 0)

> 🔴 이 절은 **문서 산출물** 이다 — enum 추가 **0** · verdict 변경 **0** · DB **0** ·
> Identity 점수/blocker **0** · 사람 판정 이력 **0** · 우선순위 5 착수 **0**.
> 🔴 CPO 가 금지한 「시스템 enum 추가」를 하지 않았다 — **대응 관계만 정의** 한다.

---

## 14-A. **Human Label ↔ System Verdict 용어 사전**

### A-1 🔴 `CONFLICT` 의 실제 의미와 발화 조건 (코드 확인)

```
생산 자리  cross-seller.ts:1041 — **단 한 곳** 이고 «조기 반환» 이다
조건       conflicts.length > 0 && !skipConflictReturn
반환       { verdict: "CONFLICT", **axes: []**, conflicts, blockers, identifierConfirmed: false }
🔴🔴 그래서 `CONFLICT` 는 **「점수가 낮다」가 아니다** — 점수를 **계산하지도 보지도 않는다**.
   「적어도 한 축에서 **서로 다른 값을 읽었다**」는 **관측** 이다.
예외       skipConflictReturn = ageLineDesignMatch && 충돌이 **MODEL_CODE 하나뿐**
           ⟹ 그때는 조기 반환을 건너뛰고 `MODEL_CODE_AGE_LINE` **blocker** 로 남는다
           (= SAME 에는 못 닿고 **보류 이하** 다 · AC↔AB 정책의 그 자리)
충돌 축 6  AUDIENCE · GENDER · CATEGORY · COLOR · MODEL_CODE · COMPOSITION
```

🔴 **`conflicts`(충돌) ↔ `blockers`(보류)는 다른 배열이고 다른 결과를 낸다** —
충돌은 **조기 반환(CONFLICT)**, 보류는 **SAME 차단(점수는 계산됨)**.

### A-2 사람 `DIFFERENT` ↔ 시스템 verdict **대응 관계**(실측 · 라이브 25쌍)

| 사람 라벨 | 시스템 verdict | 건수 | 의미 |
|---|---|---|---|
| **DIFFERENT 8** | `CONFLICT` | **2** | 🟢 시스템도 「축이 어긋났다」고 말했다(S1-5·S1-6 · 품번 `AC141`) |
| | `PRESUMED_SAME` | **4** | 🔴 축이 **모자라지 않았고** 충돌도 없었다(C51·C19·C20·C25) |
| | `SIMILAR` | **1** | 증거가 1점뿐(C22) |
| | `UNKNOWN` | **1** | 추출 실패(S6-4 · 제목 「concept」) |
| **SAME 17** | `SAME` | **8** | (7-5 뒤) |
| | `PRESUMED_SAME` | **6** | 🔴 보류 — 브랜드 공백 · FIT 어휘 등 |
| | `CONFLICT` | **1** | 🔴 AC↔AB 라인(S1-7 · `AB046`) |
| | `SIMILAR` | **2** | 현지어 제목(S2-1·S3-1) |

🔴🔴 **그래서 `DIFFERENT` 와 `CONFLICT` 는 서로 번역되지 않는다**:
```
사람 DIFFERENT ⊅ 시스템 CONFLICT   — DIFFERENT 8 중 CONFLICT 는 **2** 뿐이다
시스템 CONFLICT ⊅ 사람 DIFFERENT   — CONFLICT 3 중 **1 은 사람 SAME** 이다(AC↔AB)
⟹ 🔴 `DIFFERENT` 를 시스템 enum 에 더해도 **그 둘이 같아지지 않는다.**
   시스템이 내는 것은 **「무엇이 어긋났는가」** 이고 사람이 내는 것은 **「다른 상품인가」** 다.
```

### A-3 저장 데이터와 소비 코드 영향 (확인)

```
저장    candidate_reviews.system_verdict (text · 시스템 문자열 그대로)
        candidate_reviews.human_verdict  🔴 **HUMAN_VERDICTS = SAME · SIMILAR · DIFFERENT · UNDECIDED**
                                          (candidate-review.ts:20)
🔴 두 칸은 **서로 덮지 않는다**(기존 계약 · 「그 불일치가 GT 다」)
🔴 그리고 **값 집합이 애초에 다르다** — 사람에게 `PRESUMED_SAME`·`CONFLICT` 가 **없고**
   시스템에 `DIFFERENT`·`UNDECIDED` 가 **없다**
소비    deriveMatchTruth(cross.verdict) · crossSellerReserved(= PRESUMED_SAME) ·
        PRICE_ELIGIBLE_VERDICTS = { SAME, PRESUMED_SAME } · 화면 tier 라벨
⟹ 🔴 verdict 문자열을 바꾸면 **저장분 · 판정 · 가격 자격 · 화면** 이 동시에 움직인다
   (그래서 CPO 가 enum 변경을 금지한 것이 맞다)
```

### A-4 **표준 §3.1 용어 사전 보완**(이 표가 §3.1 의 각주다)

| 표준 용어 | 누가 내는가 | 코드 값 | 의미 |
|---|---|---|---|
| `SAME` | 양쪽 | 시스템 `SAME` / 사람 `SAME` | 🔴 **같은 글자인데 근거가 다르다** — 시스템은 「축 5점 + 무충돌 + 브랜드 확인」, 사람은 육안 |
| `PRESUMED_SAME` | **시스템만** | `PRESUMED_SAME` | 동일상품 추정 · 🔴 가격은 `COMPARISON` 상한 |
| `SIMILAR` | 양쪽 | 시스템 `SIMILAR` / 사람 `SIMILAR` | 증거 1점 이상 · 확정 아님 |
| `DIFFERENT` | **사람만** | 사람 `DIFFERENT` | 🔴 시스템 enum 에 **없다** |
| `CONFLICT` | **시스템만** | `CONFLICT` | 🔴 「축이 어긋났다」는 **관측** — 「다른 상품」 선언이 아니다 |
| `UNKNOWN` | **시스템만** | `UNKNOWN` | 근거 부족 |
| `UNDECIDED` | **사람만** | 사람 `UNDECIDED` | 판단 보류 |

🔴 **보고·문서에서 두 체계를 한 열에 섞어 적지 않는다.** 섞으면 「DIFFERENT 방어 N건」이
`CONFLICT` 건수로 읽히고, 위 표가 보여 주듯 그 둘은 **2 ↔ 8** 로 어긋난다.

---

## 14-C. **Identity Signal 계층 — 논리적 책임과 코드 owner**

🔴 새 서비스·데이터 모델 **만들지 않았다**(CPO 지시). 아래는 **책임의 정의와 현 owner** 다.

**논리적 책임**(표준 §1 계층 2)
```
① 그 Evidence 가 **동일성에 대해 무엇을 말하는가** — 긍정 근거인가 반증인가
② **단독으로 쓸 수 있는가** — 아니면 어떤 다른 근거와 함께여야 하는가
③ **없을 때의 의미** — 「모른다」인가 「다르다」인가(표준 §0.3 ③)
④ **예외 조건** — 그 신호를 내려놓아도 되는 자리와 그 근거
```

| 축 | ① 의미 | ② 단독 | ③ 부재의 의미 | ④ 예외 | 현 코드 owner |
|---|---|---|---|---|---|
| **FIT** | 🔴 **반증 전용** — 같으면 1점, 다르면 보류 | X | **모른다**(`핏 정보 없음` → `unknown`) | 🟡 **R1** — 브랜드 확인 + 품번 완전일치 + 교차판매처면 `loose ↔ relaxed` 를 같게 읽는다 | `compareFit`(:667~) · `FIT_CANONICAL` · `LOOSE_RELAXED` · `isLooseRelaxedPair` · 🔴 **①~④ 가 그 함수 주석에만 있다** |
| **IMAGE** | 보조 근거 | X | 모른다 | — | 🔴 **「SAME 정원 제외」가 `corePoints` 필터 한 줄**(:1281)뿐 |

🔵 **그래서 C 의 결론**: 계층은 **코드에 존재한다 — 흩어져 있다.** 필요한 것은 새 모듈이
아니라 **그 네 질문의 답이 한 자리에 적혀 있는 것** 이다. 🔴 이 표가 그 자리다(표준 안).
🔴 그 이상(코드에 선언 상수를 만드는 것)은 **별도 승인** 이다 — 이번에 하지 않았다.

---

## 14-B. **Evidence 상태 4종 — 개념 정의와 기존 데이터 매핑**(🔴 구조 변경 0)

### B-1 CPO 의 네 질문에 대한 **코드 사실**

| 질문 | 답 |
|---|---|
| `NOT_MEASURED` 를 추출기가 기록하는가 | 🔴 **아니다.** 그 상태가 **코드에 없다**(전수 grep 0). |
| 「추출을 시도하지 않았다」 ↔ 「추출할 칸 자체가 없다」를 구분하는가 | 🔴 **구분하지 않는다.** 둘 다 **항목 부재** 로 같은 모양이다. 🟡 단 **경로 상태**(`ProductUrlFactsResult.status` = `OK`/`UNREACHABLE`/`NOT_PRODUCT_URL`/`REDIRECTED_AWAY`/`NO_FACTS`)는 **있다** ⟹ 「페이지를 못 읽었다」와 「읽었는데 그 칸이 없다」는 **그 칸으로 갈릴 수 있다**(현재 Evidence 층은 그것을 쓰지 않는다). |
| 기존 `EvidenceItem` 항목 부재와 어떻게 연결하는가 | 현재 `MISSING` 과 `NOT_MEASURED` 가 **같은 표현**(항목이 없음)이다. |
| `CONFLICT` 는 서로 다른 출처에서 충돌할 때만 쓰는가 | 🔴 **Evidence 층에는 `CONFLICT` 개념이 없다.** 지금 `conflicts`/`blockers` 는 **matcher 층의 «쌍 비교» 결과** 다 ⟹ **「한 상품 안에서 출처가 엇갈림」과 「두 상품을 비교해 어긋남」은 다른 사실** 이고, 전자를 담는 자리가 없다. |

### B-2 **기존 상태 → 표준 4종 매핑**(현행 표현 기준 · 🔴 코드 변경 0)

| 표준 상태 | 현행 표현 | 갈라지는가 |
|---|---|---|
| `PRESENT` | `EvidenceItem` 이 **있다**(`{value, source}`) | 🟢 그대로 |
| `MISSING` | 항목이 **없다** | 🔴 `NOT_MEASURED` 와 **구별 안 됨** |
| `NOT_MEASURED` | 항목이 **없다** (같은 모양) · 🟡 측정불가 7속성은 **칸 자체가 없다** | 🔴 **표현 수단 없음** |
| `CONFLICT` | 🔴 Evidence 층 **없음** · matcher 의 `conflicts`(쌍 비교)는 **다른 층의 사실** | 🔴 **자리 없음** |

### B-3 🔴 그래서 **구조 변경을 보류하는 것이 맞다**(CPO 판단과 같은 결론 · 근거)
```
① enum 만 추가하면 **전건 PRESENT/MISSING** 으로 채워진다 — `NOT_MEASURED` 를 낼
   생산자가 없기 때문이다 ⟹ 표준 §0.3 ⑤ 를 **코드가 말하는 척만** 하게 된다
② 「칸이 없다」(측정불가 7속성)는 **추출기가 아니라 «스키마» 의 사실** 이다 —
   런타임 상태 enum 으로 표현할 대상인지부터 정해야 한다
③ Evidence 층 `CONFLICT` 를 만들면 **matcher 의 `conflicts` 와 이름이 겹친다** —
   §13-A 와 **같은 종류의 어휘 충돌** 을 새로 만드는 셈이다
⟹ 🔴 CTO 는 enum 을 추가하지 않았다. 선행 결정 셋(①②③)은 **CPO 판단 사안** 이다
```

---

## 14-D. 🔵 이번 1차 집행이 **고정한 것**과 **열어 둔 것**

```
🟢 고정   A 용어 사전(§14-A-4) — 두 판정 체계를 **같은 열에 적지 않는다**
         C Identity Signal 네 질문의 답을 FIT·IMAGE 에 대해 **한 자리에** 적었다
         B 기존 표현 → 표준 4종 매핑 · **구조 변경 보류 근거 셋**
🔴 열림   D 브랜드 출처 덮어쓰기 · G Style Code — **다음 정책 검토 대상**(CPO 등록)
         B 의 선행 결정 셋 · C 의 코드 선언 상수화 — **별도 승인**
🔴 변경 0 운영 코드 · enum · verdict · DB · Identity 점수/blocker · 사람 판정 이력 ·
         우선순위 5
```
