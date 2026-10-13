# MI-GEMINI-COST-RECONCILIATION-013 — 대조 준비표

> 🔴🔴 **Gemini API 호출 0 · 코드 변경 0 · ₩3,300 보존.** 이 문서는 §5 가 지시한
> **「1:1 대조 준비」** 다 — CTO 쪽 칸만 채웠고 **Billing 쪽은 비워 뒀다.**
> 🔴 **VALIDATION-015 는 실행하지 않았다.** 재개 트리거는 CPO 의 Billing
> reconciliation 완료 하나다.

---

## 1. 🔴🔴 먼저 — 「₩21,700 사용」을 사용액으로 쓰지 않는다

지시서 §6 그대로 둔다.

```
❌ ₩25,000 → ₩3,300 = **₩21,700 사용**        ← 이렇게 확정하지 않는다
✅ 「충전/잔액 «표시» 기준 차액 ≈ ₩21,700」 이고 **실제 사용액은 미확정** 이다
🔴 그 차액에는 다음이 섞여 있을 수 있고 전부 미확정이다:
   7월 충전분 · 기존 잔액 · 크레딧 만료 · 세금 · 조정 · 환불 ·
   Billing 집계 지연 · credit balance 와 비용 화면의 회계 기준 차이 ·
   같은 Billing Account 의 다른 API/프로젝트/API key
```

🔴 그리고 **「7월 ₩25,000 충전」은 내가 몰랐던 사실** 이다(CPO 가 알려줬다). 그래서
내 이전 산식의 **분모 자체가 흔들린다.** 이 문서는 그 산식을 쓰지 않는다.

---

## 2. CTO 쪽 내부 증거 — 저장된 실행 리포트 전수

| 리포트 | API 호출 | OK | 실패 | 총 토큰 | grounding 쿼리 |
|---|---:|---:|---:|---:|---:|
| `gemini-005-e2e.json` | 10 | 0 | 10 (`402`) | 0 | 미포착 |
| `vclose-1.json` | 16 | 0 | 16 (`402`) | 0 | 미포착 |
| `vclose-2.json` | 16 | 0 | 16 (`402`) | 0 | 미포착 |
| `vclose-3.json` | 11 | **10** | 1 | **43,215** | 🔴 미포착 |
| `acc011-1.json` | 8 | **7** | 1 | **28,570** | 🟢 **44** |
| **합계** | **61** | **17** | **44** | **71,785** | **44** |

🔴 **포착 범위의 한계를 명시한다**:
```
grounding 쿼리는 `acc011-1`(8 호출) 회차에만 있다 — 그 전 회차에는 포착 코드가 없었다.
→ 🔴 그래서 **44 를 전체 기간의 grounding 총량으로 쓸 수 없다.**
🔴 토큰도 성공 회차(vclose-3 · acc011-1)만 있다. 402 회차는 usage 를 주지 않는다.
🔴 `cachedContentTokenCount` 는 집계에 **없다**(probe 1회에서 1,400 관측).
🔴 probe 류 호출(리포트에 없음)은 **약 6회 grounded + 2회 non-grounded** 로 **추정** 이고
   정확한 수는 로그로 복원되지 않는다.
```

### 실행 시간창 — 내가 «직접 기록한» 것만

```
🟢 확실    덤프            2026-10-13 02:11:56 → 02:12:52 UTC  (DB 읽기 · Gemini 0)
🟢 확실    WU-4 1차(SIGTERM) 02:13:00 → 02:23:00 UTC  (결과 파일 없음)
🟢 확실    WU-4 2차 완주      02:23:27 → 02:36:08 UTC
🟢 확실    WU-011            05:35:49 → 05:44:35 UTC
🟢 확실    probe             02:08:40 · 02:09:05 UTC
🔴 미확정  `gemini-005-e2e` · `vclose-1` · `vclose-2` 회차의 시간창
          — 파일 mtime 만 있고 실행 로그에 시작/종료를 찍지 않았다. **추정하지 않는다.**
```

---

## 3. 🔴 Gemini 호출부는 **둘** 이다 — Discovery 만 세면 틀린다

```
① packages/crawler/src/discovery-core/google-discovery.ts   (Discovery · grounding)
② apps/admin/src/app/api/price-history/_lib/vision-evidence.ts (Vision · 이미지 2장 base64)
🔴 ②도 **같은 `GEMINI_API_KEY`·같은 별칭** 을 쓴다(vision-evidence.ts:28).
🟢 소스 전수 확인 — `generativelanguage.googleapis.com` 를 쓰는 곳은 이 둘뿐이다.
```

🟢 **Vision 은 이 기간에 돌지 않았다**(DB 증거):
```
domestic_product_links.vision_checked_at  총 17행 · 마지막 **2026-10-08**
vision_observations                        총 2행 · 전부 **2026-09-20**
runDomesticPriceCheck 테스트 호출부 5곳    **전부 `vi.mock`** (실제 HTTP 0)
오늘 price_observations                    SELLER_ORIGIN 5행 ·
                                           그 경로(run-price-check.ts)에 Gemini 어휘 **0**
```
🔴 그래도 **Billing 대조에서는 Vision 행을 비워 두지 않는다** — 과거 17건이 과금됐을
수 있고 그 기간이 원장에 섞여 있을 수 있다.

### 🔴 별칭 주의

```
코드가 쓰는 값   "gemini-flash-latest"  (Discovery · Vision 양쪽)
🔴 이것은 **별칭** 이고 실제 모델명이 아니다. 별칭은 Google 쪽에서 움직인다.
🔴 응답의 `modelVersion` 을 우리 타입이 선언하지 않아 **버린다** →
   내부 로그만으로 **과금 모델을 확정할 수 없다.**
🟢 그래서 Billing 의 «모델별» 사용량을 ground truth 로 쓴다(지시서 §5).
```

---

## 4. 대조표 — 🔴 Billing 칸은 **CPO 가 채운다**

| 항목 | CTO 내부 로그 | Billing (ground truth) | 차이 |
|---|---:|---|---|
| 기간 | 위 §2 시간창(일부 미확정) | — | — |
| 프로젝트 | `commerce-platform` | — | — |
| Discovery API 호출 | **61** (OK 17 · 실패 44) | — | — |
| Vision API 호출 | **0** (이 기간) · 과거 누적 17행 | — | — |
| grounding 쿼리 | **44** (🔴 8 호출분만 포착) | — | — |
| 총 토큰 | **71,785** (성공 회차만) | — | — |
| cached 토큰 | 🔴 **미집계** (probe 1,400 관측) | — | — |
| 모델별 사용량 | 🔴 **불가** (별칭만 기록) | — | — |
| 402 / timeout | **44** (과금 여부 미확정) | — | — |
| 실제 KRW 차감 | 🔴 **읽을 수 없다** | — | — |
| 7월 충전분 | 🔴 **몰랐다** | — | — |
| 크레딧 만료/조정/세금 | 🔴 **알 수 없다** | — | — |

🔴 **원장에 없는 금액을 추정해 채우지 않는다.** 빈 칸은 빈 칸으로 둔다.

---

## 5. 분기 — 지시서 §7 그대로

```
A. 원장 ↔ 내부 로그가 충분히 reconciled   → CPO 가 VALIDATION-015 재개 승인
B. 비용 차이가 남는다                      → 🔴 **HARD STOP 유지** · 추가 호출 금지
C. 모델/과금 구조가 불명확                 → 🔴 **HARD STOP 유지** ·
                                            🔴 **추가 호출로 확인하려 하지 않는다**
```

---

## 6. 🟢 VALIDATION-015 측정 설계 — **미리 등록한다**(실행 아님)

🔴 사후에 숫자를 보고 해석을 맞추지 않기 위해 **지금** 설계를 고정한다.
🔴 **실행은 하지 않는다.**

### 6-1. 🔴🔴 `5.5` 를 Before 로 쓰지 않는다 — 두 요소가 섞여 있다

```
BEFORE 관측치   grounding 5.5 queries/call
   조건         상품당 Query **2** · Primary = **구(상품명 단독)**
AFTER 측정 예정  조건  상품당 Query **1** · Primary = **신(식별자 우선)**
🔴 두 변경이 동시에 들어갔으므로 「신 Query 가 5.5 → X 로 줄였다」고 **단정할 수 없다.**
```

🟢 **분리 설계** — 015 는 **같은 상품**에 대해 두 조건을 각각 1회씩 재서
요소를 가른다(상품 1~2개 × 2조건 = **최대 4 호출**):

```
① 구 Primary · Query 1   ← 「Query 수 감소」 효과를 뺀 상태의 구 Query
② 신 Primary · Query 1   ← 신 Query 효과

① vs ②        = **Query 내용 품질** 효과 (Query 수는 둘 다 1로 고정)
① vs 5.5(기존) = **Query 수 감소** 효과 (Primary 내용은 둘 다 구 Query)
```

🔴 그래도 **①의 분모가 1 상품** 이므로 두 효과 모두 `sample N=1~2` 로 적는다.
🔴 **5.5 는 N=8 호출의 평균** 이고 ①②는 호출 1회씩이다 — 분모를 같은 표에 섞지 않는다.

🔴 구 Primary 를 다시 만들려면 `generateQueries(identity)[0]` 를 쓰면 된다
(WU-014 가 그 함수를 **건드리지 않았다**) — **새 코드가 필요하지 않다.**

### 6-2. 보고할 KPI — 지시서 §20 의 넷

```
① Grounding 효율   groundingQueries · groundingQueryTexts[] 전문 ·
                   🔴 검색어 «내용» 을 같이 본다(숫자만으로 성공 판정하지 않는다)
② 후보 품질        discoveredUrls → usableProductUrls → candidateCount ·
                   self-reference 제거 수 · irrelevant 수
③ MI 유효 후보     SAME / PRESUMED_SAME / SIMILAR / CONFLICT / UNKNOWN
                   🔴 threshold 변경 0 · 기존 MI 통과분만
④ 비용 효율        실제 비용 ÷ 유효 MI 후보
                   🔴 분자(실제 비용)는 **Billing** 이 ground truth다 —
                      CTO 가 계산해 확정하지 않는다
```

🔴 **네 축을 섞지 않는다**:
```
웹에서 동일해 보이는 후보 발견 ≠ 국내 동일상품 ≠ 가격 비교 가능 ≠ 등록 판단 변경
```

### 6-3. 안전 조건 (015 실행 시 그대로 적용)

```
🟢 1 상품 = Gemini 최대 1회 · Primary 최대 1개 · 후보 최대 3
🟢 UNAVAILABLE 이면 **호출 0** (Query 를 억지로 만들지 않는다)
🟢 후보 0 이면 **0 그대로 기록** · 추가 Query/call 로 fallback 하지 않는다
🟢 transient domestic evidence 는 `marketCode = null` · `currency = KRW`
   🔴 회귀 조건: 기존 50,000 + Gemini 47,000 에서 **기존 집계가 사라지거나
      대체되지 않아야 한다** — 이미 테스트로 잠겨 있다
🟢 가격 없으면 `domesticMatched` 를 **증가시키지 않는다**(identity evidence 만)
🟢 self-reference 정책은 008A 확정 그대로 — 로케일은 다른 market
```

### 6-4. 즉시 중단 조건 (지시서 §21)

```
비용 이상 증가 · grounding 폭증 · irrelevant 후보 증가 · self-reference 재발 ·
국내 동일상품 판정 개선 없음 · 가격 evidence 개선 없음 ·
기존 domestic aggregation 회귀 · 기존 registration judgment 회귀
🔴 threshold 완화로 해결하지 않는다.
```

---

## 7. 현재 상태

```
WU-014                    CLOSED / PASS
COST-RECONCILIATION-013   🟡 **CTO 쪽 준비 완료 · Billing 칸 대기**
VALIDATION-015            🔴 **실행하지 않음** — Billing reconciliation 선행 필요
Gemini API 호출            **0**
잔액 ₩3,300               🟢 **보존**
추가 결제                  금지
flag                      OFF
Production                HOLD
CEO 액션                   없음
```

🔴 **보고에서 쓰지 않은 표현**(지시서 §25): 「grounding 비용이 X% 감소했다」·
「Gemini 비용이 X원이다」·「Recall 이 X%다」·「동일상품을 X건 찾았다」.
🔴 그리고 015 상태를 「측정 불가」로 적지 않았다 — **「현재 실행하지 않음 ·
Billing reconciliation 선행 필요」** 가 정확한 상태다.
