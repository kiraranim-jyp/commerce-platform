# 실행 순서 2 「국내 가격 매칭 정확도」 — **착수 좌표** (CTO · 2026-11-07)

> 🔴 CPO 지시: 「작업 착수 전 **기존 기준선과 실제 코드 경로를 확인** 하고,
> **재조사와 신규 구현을 혼동하지 않는다.**」 이 문서가 그 확인 결과다.
> 🔴 **운영 코드 변경 0 · 측정 0.** 좌표만 찍는다 — 🔴 **이 문서가 WU 가 아니다.**

---

## 1. 🔴🔴 **먼저 — 「두 축」을 하나로 보고하면 틀린다**

CPO 지시는 두 가지를 **나란히** 적었고, 코드에서도 **서로 다른 owner · 다른 분모** 다.

| | 축 A — **판정 구분** | 축 B — **가격비교 적격성** |
|---|---|---|
| 질문 | 이 후보가 동일상품인가 | 그 금액을 동일상품 가격으로 **쓸 수 있는가** |
| owner | `compareCrossSellerProducts` | `summarizeCandidateOverseasPrices` |
| 파일 | `packages/crawler/src/comparison-search/cross-seller.ts` | `apps/admin/.../price-history/_lib/candidate-market.ts` |
| 기준선 | **STEP 6**(33쌍/22쌍 TP·FP·FN·TN) | **STAGE 7-2**(33쌍 금액 자격 **12/18**) |
| 🔴 | 둘을 **합쳐 하나의 정확도 수치로 만들지 않는다** | |

🟢 **둘 다 기준선이 «이미» 있다 ⟹ 재측정이 아니라 «확장» 이다**(CPO 지시의 그 구분).

---

## 2. 🔴🔴🔴 **용어 함정 — 시스템에 `DIFFERENT` 라는 verdict 가 «없다»**

```
CPO 지시 어휘   SAME / PRESUMED_SAME / SIMILAR / **DIFFERENT**
실제 코드        cross-seller.ts:77
  export type CrossSellerVerdict = "SAME" | "PRESUMED_SAME" | "SIMILAR" | "UNKNOWN" | "CONFLICT"
🔴 `DIFFERENT` 는 **사람 GT 어휘** 다(`human_verdict`) — 시스템 verdict 가 아니다.
🔴 그 둘을 같은 열에 두면 **분모가 섞인다**(이 트랙에서 반복된 오류).
🟢 올바른 대응 — 시스템 `SIMILAR`/`UNKNOWN`/`CONFLICT` **셋** ↔ 사람 `DIFFERENT` **하나**.
   🔴 「SIMILAR = DIFFERENT」로 매핑하지 않는다(SIMILAR 중 사람 SAME 이 실재한다 · STEP 6).
```

---

## 3. 축 B 의 실제 경로 — **적격성은 5조건이고 «순서가 의미» 다**

`summarizeCandidateOverseasPrices` 루프(`candidate-market.ts`) — 통과 못 하면 금액에서 빠진다:

```
① :418  priceTier === "EXCLUDED"                        → 제외
② :430  verdict 가 있고 {SAME, PRESUMED_SAME} 밖        → 제외   (PRICE_ELIGIBLE_VERDICTS)
③ :444  blockers ∩ {BRAND_MISMATCH · NO_TITLE_OVERLAP ·
                     SAME_SELLER_DISTINCT_LISTING}      → 제외 + observedDifferenceCount++
④ :448  금액이 없거나 유한수가 아니다                     → 제외
⑤ :462  priceStatus 가 있고 VERIFIED_CURRENT 가 아니다   → 제외 + unverifiedCount++
🔴 **순서를 바꾸면 화면이 거짓을 말한다** — ⑤가 위로 올라가면 「동일상품 아님」까지
   「미확인」으로 세어진다(:454-457 주석이 그 이유를 적는다).
🔴 `null` 은 **막지 않는다**(②⑤ 모두) — 「모른다」로 가격을 지우면 판정 경로를
   타지 않는 기존 후보가 **조용히 사라진다**.
🔴 `BRAND_UNCONFIRMED` 는 ③에 **없다** — 그 사유 4건이 **사람 SAME** 이다(실측).
🔴 `MATERIAL`·`FIT`·`MODEL_CODE_AGE_LINE` 도 **없다**(표기·정규화·정책 축).
🔴🔴 **그 집합을 넓히거나 좁히는 것은 제품 정책 변경** 이다(:265·:307 명시) — 임의 수정 금지.
```

🟢 그리고 그 집합은 **이미 반사실로 선택됐다**(:287-295 · GT 33쌍):
```
현행                        정밀도 12/18 (66.7%) · 재현 12/18
A 전체 hasObservedDifference 11/15 (73.3%) · 🔴 재현 **11/18**(손실 1 — FIT 로 S1-4 사람 SAME 을 잃었다)
B 현재 집합                 **12/16 (75.0%)** · 🟢 재현 **12/18**(손실 0)
⟹ 🔴 「③을 넓히면 정밀도가 오른다」는 **이미 시험됐고 B 가 이겼다.** 다시 열지 않는다.
```

---

## 4. 축 A 의 기준선 — **STEP 6 그대로 쓴다**(재측정 금지)

```
기준선 33쌍(확정 27) `TP 6 · FP 1 · FN 12 · TN 8` / 22쌍 `TP 5 · FP 1 · FN 12 · TN 4`
FN 12 = PRESUMED_SAME **8** + SIMILAR **3** + CONFLICT **1**
🔴🔴 약점은 **「놓친 SAME」** 이고 「거짓 SAME」이 아니다(FP 1).
🔴 무조건 승격은 **과거 저하 조건을 재현** 했다(셋 모두 → 33쌍 FP 1→8 · 22쌍 1→4).
🟡 조건부(보류 + 품번 일치)는 **22쌍만** 통과(FP 1 · FN 12→9).
🔴 **보류 승격의 운영 반영 금지**(CPO) · **threshold 완화 금지** · **Shadow ↔ 운영 분리**.
전문 `docs/MI-REEVAL-STEP6-HOLD-AND-COLOR.md` · `docs/MI-REEVAL-STEP5-SHADOW.md`
```

---

## 5. 🟢🟢 **CPO 가 측정 구조를 «고정» 했다**(2026-11-07 승인) — 그대로 집행한다

🔴 **CTO 가 제시한 후보 둘을 «모두» 수행한다**(CPO 결정). 구조는 아래로 고정됐다.

### 축 A — 국내 동일상품 판정
```
owner   `compareCrossSellerProducts`
기준선  **STEP 6 의 33쌍 / 22쌍 재사용**(TP·FP·FN·TN + **Pair ID 보존**)
🔴 운영 verdict 다섯을 **그대로** 보존 — SAME · PRESUMED_SAME · SIMILAR · UNKNOWN · CONFLICT
🔴 사람 GT 어휘(SAME · DIFFERENT · UNDECIDED)와 **분리** 한다
🔴 `DIFFERENT` 를 운영 verdict 처럼 **만들어 넣지 않는다**
🔴 `SIMILAR` 를 `DIFFERENT` 로 **매핑하지 않는다**
🔴 **Main Story 제외 전후 결과를 둘 다** 유지한다
```

### 축 B — 국내 가격비교 적격성
```
owner   `summarizeCandidateOverseasPrices`
기준선  **STAGE 7-2 의 12/18 재사용**
🔴 5개 적격성 조건과 **실행 순서** 를 보존한다(§3)
🔴 `hasObservedDifference` 집합을 **무조건 확대하지 않는다**
🔴 **FIT / S1-4 의 사람 SAME 손실 반례** 를 **회귀 기준으로 유지** 한다
```

### 🔴🔴 두 축의 결합 — **분모를 합치지 않는다**
| 측정 결과 | 처리 |
|---|---|
| 축 A 판정 | **독립 분모** |
| 축 B 가격 적격성 | **독립 분모** |
| A·B **공통 후보 ID** | 가능한 경우 **교차표** 작성 |
| 공통이 아닌 데이터 | **각 축에서만** 측정 |
| A·B **합산 성능 수치** | 🔴 **금지** |

🔵 **최종적으로 확인하려는 것은 둘이다**(CPO 문장):
```
① 동일상품으로 판단한 후보가 실제 가격비교에 **적격한가**
② 가격비교에 적격한 후보 중 동일상품 판정이 **불확실하거나 잘못된** 후보가 얼마나 되는가
🔴 이 교차표는 **운영 정책을 바꾸기 위한 근거** 이지 두 축을 **하나의 점수로 만들기 위한 것이 아니다.**
```

### 🔵 완료 보고 **9항**(CPO 고정)
```
1 축 A 기준선과 측정 결과        2 축 B 기준선과 측정 결과
3 두 축의 **독립 분모** 와 Pair/Candidate ID      4 공통 후보 **교차표**
5 **기존 반례의 불변 여부**      6 TP·FP·FN·TN 변화
7 가격 적격성 **5조건별 탈락 사유**
8 변경 파일·테스트·타입체크·DB 쓰기·네트워크 여부   9 운영 변경 여부
🔴 완료 보고 후 **CPO 가 다음 구현 범위와 운영 반영 여부를 별도로 결정** 한다.
```

🔴 **이 WU 는 측정이다** — 수정은 블로커가 확인되고 CPO 가 범위를 열 때만 한다(원칙 ⒠ 최소 수정).

---

## 6. 🔴 금지 (CPO 확정 · 전수)

```
❌ threshold 완화           ❌ 보류 승격 운영 반영      ❌ Shadow 결과를 운영 성과로 보고
❌ 기존 GT·CEO GT 덮어쓰기   ❌ 두 축을 합친 단일 정확도   ❌ `DIFFERENT` ↔ `SIMILAR` 매핑
❌ 적격성 5조건의 집합·순서 임의 변경(제품 정책)
❌ precision/recall/F1 을 최종 판정 근거로 사용
❌ 8축 재개방 · Registry 확대 · `BRAND_UNCONFIRMED` 완화(WU-080 REJECT)
```
