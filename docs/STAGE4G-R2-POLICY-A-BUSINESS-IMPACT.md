# STAGE 4-G-R2 — POLICY A BUSINESS IMPACT & CONTRACT REVIEW (2026-11-04)

> 🔴 **분석 전용.** A 구현 **0** · B 구현 **0** · 운영 코드 **0** · 테스트 기대값 수정 **0** ·
> 계약 수정 **0** · Legacy GT **0** · 가격/Search/UI/DB/Migration **0** · **네트워크 0 · 과금 0**.
> 기준 HEAD **`73bf59ad`** · 작업트리 **clean** · `cross-seller.ts` md5 `212b5904…` (**실험 코드 미적용**).
> 🟢 **이번에는 운영 파일을 임시로도 고치지 않았다** — A 는 별도 하니스
> `stage4g-r2-policy-a-impact.test.ts` **안에서만** 모사했다(§0-B).

---

## 0. 최종 권고 — **C(1건 확인) → B** · 🔴 「A 영구 보류」는 권고하지 않는다

```
권고  **C + B 복수** — 순서가 있다
      ① C 먼저  남은 미지 **1건**(TP-16)만 확인한다 ⟹ 🟢 **그런데 R2 에서 이미 닫혔다**(§3-C)
      ② 그 뒤 B  p4 계약 변경을 전제로 A 적용 준비
🔴 「A 영구 보류」(선택 A)를 권고하지 않는 이유 — 이득이 실측됐고(FP 9/9) 비용이
   **순 0 으로 확정** 됐다. 보류의 근거였던 「운영 TP 측정불가 6건」이 **사라졌다**
```

### 0-B. A 를 모사한 방법 — 전체 복제가 아니다

```
운영 분기   totalPoints >= 3 && <조건>  → PRESUMED_SAME
            totalPoints >= 1           → SIMILAR
⟹ A 가 바꿀 수 있는 것은 **PRESUMED_SAME 한 칸** 이고, 그때 totalPoints 는 이미 3 이상이라
   **반드시 SIMILAR 로 내려간다** ⟹ 매핑이 **한 줄** 이다
🟢 그 등가성은 R1 의 `replicationGate`(복제식 ↔ 운영 verdict **mismatch 0**)가 검증했다
🟢 CF-3 숫자의 교차검증 — 내 하니스 baseline precision **55.6%** 가
   헌장에 기록된 wu-066 의 「91.7% → **55.6%**」와 **한 자리도 다르지 않다**
```

---

## 1. 🔴🔴 R2 가 R1 을 정정하는 것 — **둘 다 A 에 유리한 방향이다**

```
⒜ R1: 「wu-066 CF-3 증거가 약해진다」
   🔴 **틀렸다.** A 는 CF-3 의 **False SAME 4건을 제거** 하고 **true SAME 은 20 → 20**(손실 0) ·
      precision **55.6% → 62.5%(개선)** 다 ⟹ **약화가 아니라 «오판 제거» 다**(§3-B)
⒝ R1: 「운영 TP 측정불가 6건」
   🔴 **과했다.** 저장된 `blockers` 로 **6/7 이 영향 0 으로 확정** 되고 미지는 **1건** 이었다 ·
      🟢 그리고 그 1건은 **GT 모순쌍** 이라 **순 0 으로 닫힌다**(§3-C)
```

---

## 2. 조사 A — `p4-candidate-truth-gate` 불변식

출처: 커밋 **`e7bfca87`** 「fix(MI-DISCOVERY-P4): 부수 증거로 추정하지 않고, 색상 변형을 버리지도 않는다」

**① 원래 보호하려던 기능**
`변경 A` 는 **좁은** 게이트다 — 「식별 증거(TITLE·MODEL_CODE)가 없고 **그리고** 같은 판매처의
다른 진열」이면 추정하지 않는다. 🔴 그리고 이 테스트는 그 게이트가 **「다른 판매처」로
넓어지지 않는지** 를 지키는 **과잉 차단 대조군** 이다. 테스트 주석 원문:
> 「구현 중 «식별 증거만 요구» 로 넣었다가 아래 둘째 쌍이 함께 죽었고, 그래서 «같은 판매처» 조건을 더했다」

그리고 그 커밋의 **보존 확인 목록에 그 쌍이 이름으로 적혀 있다** —
`430701↔B226AC114 SAME · 430700↔B226AC112 PRESUMED_SAME`. 🔴 즉 **의도된 보존 대상** 이다.

**② 다른 판매처 쌍에 영향이 없어야 하는 이유**
이 저장소의 출발점이 「**판매처마다 상품명이 다르다**」다. 그래서 **교차판매처의 제목
불일치는 정상** 이고, 거기에 식별 증거를 요구하면 정상 후보가 함께 죽는다.

**③ 현재 소싱 전략에도 반드시 필요한가 — 🟡 「필요하다」와 「충돌한다」가 동시에 참이다**
```
🟢 전략과 정렬  START-HERE 「국내·해외 동일/유사 판매처를 **최대한 많이** 찾는다 ·
   후보를 줄여 정확도만 올리지 않는다」 ⟹ 이 불변식은 그 문장의 코드 표현이다
🔴 그런데 **운영 FP 9건이 정확히 그 허용에서 나온다** — 전부 교차판매처 · NO_TITLE_OVERLAP ·
   Generic 3축(「상품군 TOP↔TOP · 색상 BLUE · 대상 KIDS」) · 브랜드가 Hugo Boss·Levi's·Marc Jacobs
⟹ 🔴🔴 **불변식과 A 는 «같은 축» 의 양 끝이다.** 둘 다 가질 수 없다
```

**④ A 적용 시 바뀌는 판정 — 정확히 한 쌍**
```
Smallable 430700 ↔ Bobo B226AC112    PRESUMED_SAME → **SIMILAR**
🟢 가격 영향 **0** — `goesIntoSameProductPrice` 가 **이미 false** 다(cross-seller-matching:221 실측)
🔴 human 라벨 **없음** ⟹ 그 1건이 TP 인지 FP 인지는 **여전히 미확정**
```

**⑤ 불변식을 수정하면 다른 후보 비교 기능의 역위험**
```
모집단 = 「교차판매처 + 식별 축 0 + Generic ≥3」
  wu-059 GT 14      그 모양의 positive **0건**(측정)         ⟹ 역위험 0
  CORE-SAME-05 33   A 아래 TP/FN/FP **한 칸도 안 움직인다**  ⟹ 역위험 0
  wu-068 통합 64    EXACT **16 그대로**(A-only 에서 b.ex 통과) ⟹ 가격 버킷 영향 0
  운영 21           TP 7 중 **6 영향 0 확정 · 1 은 모순쌍**   ⟹ 순 0 (§3-C)
🔴 남는 역위험 하나 — 반사실 `wu-064/065` 의 결합 CF 승격이 `[C47]` → **`[C08, C47]`** 이 된다
   (C08 = human **DIFFERENT**) 🟢 **운영 영향 0**(그 CF 는 구현되지 않았다) ·
   🔴 그러나 「국내 SAME 을 여는 다음 수」의 전제를 흔든다
```

---

## 3. 조사 B — `wu-066` CF-3

**① CF-3 가 측정하는 False SAME 의 정의**
```js
// wu-066:88 원문 — CF-3 는 `crossSellerReserved` 우회다
const verdict = opts.dropReserve && cross.verdict === "PRESUMED_SAME" ? "SAME" : cross.verdict;
```
CF-3 = `dropTitle + color + **dropReserve**`. **False SAME** = `label === "DIFFERENT"` 인데
`priceTierFromLink` 가 **EXACT** 를 내는 쌍. 분모 **186**(실측 51 + 파생 135).

**② 16 → 12 의 구성 (실측)**
| | BASE | A | 변화 |
|---|---:|---:|---|
| CF-3 **False** SAME | **16** | **12** | 🟢 **−4** |
| CF-3 **true** SAME | **20** | **20** | 🟢 **0 (손실 없음)** |
| CF-3 precision | **55.6%** | **62.5%** | 🟢 **+6.9p (개선)** |

**③ 줄어든 4건 중 실제 Human Judgment 가 있는 사례 — 🟢 0건**
```
S4/C03  tinyapple.net       파생쌍   base PRESUMED_SAME
S2/C30  billsstore.com.au   파생쌍   base PRESUMED_SAME
S4/C30  billsstore.com.au   파생쌍   base PRESUMED_SAME
S1/C42  main-story.com      파생쌍   base PRESUMED_SAME
⟹ 🟢 **4/4 가 파생쌍** 이다(「human SAME 후보 × 다른 원상품」으로 **함의된** DIFFERENT) ·
   사람이 직접 라벨한 쌍은 **0건**
```

**④ 약화인가, 오판 제거인가 — 🟢 「오판 제거」 쪽이다. 단 분모가 바뀐다**
```
🟢 제거다 — true SAME 손실 0 · False SAME −4 · precision 개선
🔴 그러나 **지표의 분모가 바뀐다** — CF-3 는 `PRESUMED_SAME` 을 승격시키는 반사실이고,
   A 가 PRESUMED_SAME 을 줄이면 **승격시킬 모집단이 줄어든다**
   ⟹ 🔴 **16 과 12 를 같은 표에 넣지 않는다**(헌장 「전수와 표본을 섞지 않는다」와 같은 계열)
🟢🟢 **그리고 CF-3 의 «결론» 은 유지된다** — 62.5% 는 운영 baseline precision **87.5%** 보다
   여전히 **크게 나쁘다** ⟹ 「CF-3 = 영구 폐기안」은 **그대로** 다
```

**⑤ 향후에도 같은 지표를 유지할 수 있는가 — 🟡 지표는 유지 · 핀은 재도출**
```
🔴 A 를 적용하면 wu-066 의 핀 **둘** 이 깨진다:
   `expect(k3.d).toBeGreaterThanOrEqual(16)`   → 12
   `expect(k3.prec).toBeLessThan(60)`          → 62.5%   ← 🔴 이것도 깨진다
🟡 그래서 A 를 승인하면 wu-066 은 **「CF-3 는 운영보다 나쁘다」를 «상대 비교» 로** 재도출해야 한다
   (절대 숫자 16·60 이 아니라 「CF-3 precision < baseline precision」) 🔴 그 설계는 CPO 판정 사안이다
```

---

## 4. 조사 C — 운영 TP 측정불가 문제

**출처(fixture 메타 원문)**: `"capturedFrom": "production candidate_reviews (read-only)"` ·
`"운영 candidate_reviews 의 사람 판정이 있는 행 전수"`.

### 4-A. 칸 전수 — 무엇이 없는가

| TP | 판매처 | systemVerdict | candidateUrl | matchReasons | blockers | market |
|---|---|---|---|---|---|---|
| TP-06 | junioredition | PRESUMED_SAME | 있음 | **있음(11)** | 있음(1) | 있음 |
| TP-16 | villagekids | PRESUMED_SAME | 있음 | ·없음 | 있음(4) | 있음 |
| TP-17 | junioredition | PRESUMED_SAME | 있음 | ·없음 | 있음(2) | 있음 |
| TP-21 | junioredition | PRESUMED_SAME | 있음 | ·없음 | 있음(2) | 있음 |
| TP-23 | junioredition | **SAME** | 있음 | ·없음 | ·빈배열 | ·없음 |
| TP-25 | scoutandcokids | **SAME** | 있음 | ·없음 | ·빈배열 | ·없음 |
| TP-26 | tinyapple | **SAME** | 있음 | ·없음 | ·빈배열 | ·없음 |

```
Evidence 누락 위치   `matchReasons` 가 **6/7 에서 null** 이다
                     🔴 `blockers` 는 **별도 칸** 이고 3/6 에 살아 있다(섞어 읽지 않는다)
                     🔴 `facts`(축 원자료) 칸은 fixture 에 **애초에 없다** — 0/6
Human Judgment       🟢 **7/7 보존**(`humanVerdict`) · `humanNote` 는 7/7 null
원본 URL 로 복구      🟢 URL **6/6 보유** ⟹ **재수집하면 복구 가능** ·
                     🔴 재수집은 네트워크/과금이라 **이번 범위 금지**
```

### 4-B. 🟢🟢 **재수집 없이 6/7 이 닫혔다** — `blockers` 가 답을 갖고 있었다

운영 owner 의 구조가 **상호배타 전수** 다(`cross-seller.ts`):
```
titleOverlap >= 0.5  → axes TITLE 2점
titleOverlap >  0    → axes TITLE 1점
titleOverlap == 0    → blockers **NO_TITLE_OVERLAP**
⟹ 🟢 `NO_TITLE_OVERLAP` 이 «없다» ⟺ **TITLE 축이 «있다»** ⟺ `hasIdentifyingEvidence` 참
⟹ 🟢 **A 가 건드리지 못한다**
그리고 A 는 `PRESUMED_SAME` **한 칸만** 바꾼다 ⟹ `systemVerdict === "SAME"` 은 **구조적으로 영향 0**
```

| TP | systemVerdict | NO_TITLE_OVERLAP | A 영향 |
|---|---|---|---|
| TP-06 · TP-17 · TP-21 | PRESUMED_SAME | 없음 | 🟢 **0 (TITLE 축 보유)** |
| TP-23 · TP-25 · TP-26 | **SAME** | — | 🟢 **0 (SAME 경로)** |
| **TP-16** | PRESUMED_SAME | 🔴 **있음** | 🔴 **측정불가**(MODEL_CODE 축 유무 불명) |

**⟹ 🟢🟢 A 영향 0 으로 확정 = 6/7 · 미지 = 1건.** R1 의 「6건 측정불가」를 정정한다.

### 4-C. 🔴🔴🔴 그 마지막 1건은 **GT 모순쌍** 이다 — 그래서 순 0 으로 닫힌다

```
(원상품코드, 후보URL) 고유 쌍 36 중 **라벨이 갈리는 쌍 1**:
  B226AC009 :: https://villagekids.co.uk/products/pale-blue-3d-logo-t-shirt
     FP-20  2026-10-21 **09:05**  human **DIFFERENT**
     TP-16  2026-10-21 **16:29**  human **SAME**
🔴 두 행의 **모든 칸이 같다** — originCode · originTitle · candidateUrl · candidateTitle ·
   systemVerdict PRESUMED_SAME · matchTruth TEXT_CONFIRMED · priceTier COMPARISON ·
   blockers 4개 동일 · GBP 21.2 · market OVERSEAS. 다른 것은 `at` 과 `humanVerdict` 뿐이다
```
🟢🟢 **그러므로 A 가 그 쌍을 차단하면 TP −1 «그리고» FP −1 ⟹ 순 0 이다.**
⟹ 🟢 「A 의 운영 TP 비용」은 **순 0 으로 확정** 된다. 보류의 근거가 사라졌다.
🔴 **CTO 는 둘 중 어느 라벨이 맞는지 고르지 않았다**(사람 판단 영역).

🔴🔴 **그리고 이것이 R2 의 부수 발견이자 더 큰 문제다** — 나중 라벨이 이전 라벨을
**덮지 않고 둘 다 남는다**. `candidate_reviews` 에 **모순 감지/해소 경로가 없다.**
⟹ 🔵 3순위(「후보 검토 → GT 누적 → MI 개선」)의 **전제가 흔들린다** — GT 를 쌓을수록
모순이 조용히 누적된다. 🔴 **이번 범위에서 고치지 않았다**(schema/정책 영역 · CPO 판정).

---

## 5. 표 D — A 의 실제 사업 효과

| 항목 | BASE | **A** | 실제 의미 |
|---|---|---|---|
| Generic-only 운영 FP | **9** | 🟢 **0 (9/9 차단)** | Hugo Boss·Levi's·Marc Jacobs 가 「동일상품 후보」로 서는 것이 사라진다 |
| 운영 TP 손실 | — | 🟢 **0/6 확정 · 1 은 모순쌍 ⟹ 순 0** | 🟢 R1 의 「측정불가 6」이 닫혔다 |
| 가격 비교 영향 | — | 🟢 **0** | 바뀌는 1쌍은 `goesIntoSameProductPrice` **이미 false** |
| `CORE-SAME-05`(33쌍) | SAME 6/18 · FN 12 · FP 1 | 🟢 **동일(6/12/1)** | **독립 영향 없음** |
| `wu-068` EXACT(64쌍) | 16 = SAME 14 · FS 2 | 🟢 **16 그대로** | A 는 EXACT 버킷을 안 건드린다 |
| `wu-059` EXACT(51쌍) | 12 | 🟢 **12 그대로** | 동일 |
| **p4 불변식** | PASS | 🔴 **FAIL** | **계약 폐기 1건이 필요하다** |
| `wu-066` CF-3 | FS 16 · prec 55.6% | 🟢 **FS 12 · prec 62.5%** | 🟢 오판 제거 · 🔴 핀 **2개** 재도출 필요 |
| `wu-064/065` 결합 CF | `[C47]` | 🔴 `[C08, C47]` | 반사실 역위험(운영 0) |
| `core-2ad` AD-S3 | PASS | 🔴 FAIL | 🟢 소스 앵커 · 기계적 갱신 |

🟢 **A 의 회귀 7건 내역** — 운영 판정 변화 **1쌍** · 소스 앵커 **1** · 반사실 **4** · 불변식 **1**.

---

## 6. 최종 권고 — **C → B (복수)**

```
🔵 ① 선택 C — 「운영 TP 증거 확보 후 재평가」
   🟢 **R2 에서 이미 충족됐다.** 6/7 은 저장 blockers 로 확정 · 1건은 **모순쌍이라 순 0** ·
      재수집 **0 · 네트워크 0 · 과금 0** 으로 닫았다
   🟡 남은 것은 「그 모순쌍의 올바른 라벨」 하나이고 그것은 **사람 판단** 이다(CTO 범위 밖)

🔵 ② 선택 B — 「p4 계약 변경을 전제로 A 적용 준비」
   🟢 근거: 이득 FP **9/9** · 가격 영향 **0** · 세 GT(33·51·64쌍)에서 **한 칸도 안 움직인다** ·
      CF-3 는 **개선** · 운영 TP 순손실 **0**
   🔴 비용: 계약 **7건** 갱신 — 그중 **진짜 폐기는 1건**(p4 불변식) ·
      wu-066 핀 **2개 재도출** · 나머지 4 는 반사실 기록 · 1 은 소스 앵커

🔴 선택 A(「A 영구 보류」)를 권고하지 «않는다»
   보류의 유일한 근거였던 「운영 TP 측정불가」가 **사라졌고**, 운영 FP 9건은 **셀러가 보는
   화면에 지금도 남아 있다**(Hugo Boss 가 Bobo Choses 의 동일상품 후보로 선다)
```

🔴🔴 **CPO 가 판정해야 하는 것은 «하나» 로 좁혀졌다**:
> 「**교차판매처의 제목 불일치를 정상으로 보던 불변식(p4)을, Generic-only 추정 금지와
> 바꿀 것인가.**」 — 그 둘은 같은 축의 양 끝이고 **동시에 가질 수 없다**(§2-③).

🔵 **CTO 는 정책을 결정하지 않았다.**

---

## 7. 측정불가로 남긴 것

```
⒜ 🔴 `430700 ↔ B226AC112` 의 **human 라벨이 없다** ⟹ A 가 잃는 그 1쌍이 TP 인지 FP 인지 미확정
   🟢 단 **가격 영향은 0 으로 확정** 됐다(동일상품 가격에 애초에 안 들어간다)
⒝ 🔴 `TP-16 / FP-20` 모순쌍의 **올바른 라벨** — 사람 판단 영역 · CTO 가 고르지 않았다
⒞ 🔴 `wu-066` 핀을 「상대 비교」로 재설계할 때의 **구체적 기준** — CPO 판정 사안
⒟ 🔴 운영 분모 **21행** 은 「사람 판정이 있는 행 전수」이고 **전체 상품군 recall 추정치가 아니다**
   (fixture 메타 원문) ⟹ 「A 를 켜면 전체 FP 가 9건 줄어든다」로 **일반화하지 않는다**
⒠ 실제 따져 화면 — CTO 는 볼 수 없다
```
