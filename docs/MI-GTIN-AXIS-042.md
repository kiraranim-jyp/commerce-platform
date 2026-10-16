# WU-042 — GTIN Variant Identity 구현 시도와 **측정 결과**

> 🔴🔴 **결론 먼저: CPO 수용 기준을 넘지 못했고, 구현을 되돌렸다.**
> 작업트리 **clean** · 운영 코드 변경 **0** · 배포 **없음**.
> 🟢 되돌린 이유는 「안 돌아서」가 아니라 **측정값이 바를 못 넘어서** 다.

---

## §1 구현한 것 (그리고 되돌린 것)

설계대로 전부 구현해 **실제로 돌렸다**:

```
① ProductFacts.gtin                                  (@commerce/shared · optional)
② JSON-LD `gtin13|gtin14|gtin8|gtin` + Shopify `barcode` 추출
   🟢 **이미 받은 바이트에서만** — 추가 HTTP **0**     (product-url-facts.ts 양쪽 경로)
③ normalizeGtin — 숫자만 남기고 GS1 대로 선행 0 제거. 8~14자 아니면 null(UNKNOWN)
④ comparator GTIN 축                                  (cross-seller.ts)
     양쪽 일치   → 축(IDENTIFIER_AXIS_POINTS)
     양쪽 불일치 → **CONFLICT**  🔴 조기 반환 «앞» 에 배치(P0-A.27 제약)
     한쪽만/없음 → **아무것도 하지 않는다**(UNKNOWN)
```
🟢 typecheck = baseline · 순환 import 0 · 추출은 **운영 함수** 를 그대로 사용.

---

## §2 전수 E2E (Human GT 51 · 운영 `withConfidence` · HTTP 57)

```
원상품 GTIN 확보  **6/6**   S1 8445782396392 · S2 …96330 · S3 …76707 ·
                            S4 5056470577332 · S5 45203519 · S6 8445782402277
양쪽 GTIN 보유     **24/51**   GTIN 충돌 발화 **14**
```

| KPI | 기준선 | After | Δ |
|---|---:|---:|---:|
| MI SAME | 11 | **11** | **0** |
| **False SAME** | 1 | **1** | **0** ✅ |
| SAME MISS | 17 | **17** | 0 |

### 🔴 CPO 수용 기준 — **미달**

> 「최소한 C11/C37/C38 세 건을 회수하면서 False SAME 이 증가하지 않는지가 핵심」

```
C11  기대 SAME → 실제 **PRESUMED_SAME**  🔴
C37  기대 SAME → 실제 **PRESUMED_SAME**  🔴
C38  기대 SAME → 실제 **PRESUMED_SAME**  🔴 (SIMILAR 에서는 올라왔다)
ΔSAME **0**
```

---

## §3 🔴🔴 왜 회수가 안 됐나 — **내 WU-041 추정이 틀렸다**

SAME 의 조건은 **축 개수가 아니라 `blockers.length === 0`** 이다(WU-037 §2 가 이미
확정한 사실인데 내가 그것을 GTIN 에 적용하지 않았다).

```
GTIN 일치  → **축** 이 하나 늘어난다
그런데     → `BRAND_UNCONFIRMED` 가 그대로 남아 SAME 을 막는다
C11·C37     bobochoses.co.jp 후보 · 원상품은 junioredition → 도메인이 달라
            WU-037 의 same-store 규칙도 닿지 않는다 → blocker 유지
C38         `MATERIAL` blocker 유지
```

🔴 **WU-041 에서 나는 GTIN 의 «판별력» 을 쟀지 «verdict 에 미치는 효과» 를 재지 않았다.**
이 저장소가 반복해서 밟은 §5-B 함정과 같은 계열이다 — 축만 보고 판정 함수를 안 봤다.

---

## §4 🔴 그리고 **부작용** 이 나왔다 — 보호 4 · 악화 3

| | 변화 | Human | 평가 |
|---|---|---|---|
| C19 junioredition (Conker Stripe) | PRESUMED_SAME → **CONFLICT** | DIFFERENT | 🟢 **보호 강화** |
| C20 junioredition (Graystone) | PRESUMED_SAME → **CONFLICT** | DIFFERENT | 🟢 **보호 강화** |
| C40 kolkid.ca | SIMILAR → CONFLICT | DIFFERENT | 🟢 |
| C48 bobochoses.com | PRESUMED_SAME → **SAME** | SAME | 🟢 |
| C38 blanchou.ca | SIMILAR → PRESUMED_SAME | SAME | ⚪ |
| **C29 cissywears (baby)** | PRESUMED_SAME → **CONFLICT** | **SAME** | 🔴 **악화** |
| **C30 billsstore (baby)** | PRESUMED_SAME → **CONFLICT** | **SAME** | 🔴 **악화** |
| **C34 cissywears (baby)** | PRESUMED_SAME → **CONFLICT** | **SAME** | 🔴 **악화** |

🟢 **GTIN 은 틀리지 않았다** — baby 판은 실제로 다른 GTIN 을 가진 **다른 상품** 이다.
🔴 **그런데 CEO 는 baby 사이즈 라인을 「같은 상품」으로 본다**(WU-036 §5 · 아직 **미결 정책**).

> **즉 GTIN 충돌은 기술적으로 옳지만, 아직 결정되지 않은 제품 정책과 정면으로 충돌한다.**
> 그 정책이 정해지기 전에는 **배포할 수 없다.**

---

## §5 되돌렸다

```
git checkout — product-facts.ts · product-url-facts.ts · cross-seller.ts
하니스 삭제
작업트리 **clean** · typecheck **0** · 운영 코드 변경 **0** · 배포 **없음**
```
🔴 회귀에서 쿠팡 테스트 1건이 간헐 실패하는데 **작업트리가 clean 인 상태에서도** 나고
**단독 실행은 18/18** 이다 — 병렬 간섭이고 이번 작업과 무관하다(원인 미규명으로 적는다).

---

## §6 🟢 그래도 확정된 것 — 다음 WU 는 조사를 반복하지 않는다

```
🟢 GTIN 은 원상품 **6/6** · 후보 **24/51** 에서 실제로 추출된다(추가 HTTP 0)
🟢 GTIN 은 색상 변형을 **정확히** 가른다 — C19·C20 을 PRESUMED_SAME 에서 CONFLICT 로 올렸다
🔴 GTIN 축만으로는 **SAME 을 회수하지 못한다** — 막는 것은 blocker 다
🔴 GTIN 충돌은 **baby 사이즈 정책** 과 충돌한다 — 그 정책이 선행이다
```

### 🔴 CPO 결정 — 이것이 선행이다

```
① **baby 사이즈 라인 / 세트 구성을 같은 상품으로 볼 것인가** (WU-036 §5 부터 미결)
   「같다」면 → GTIN 충돌을 그대로 쓸 수 없다(예외 규칙이 필요하고 그것은 새 정책이다)
   「다르다」면 → GTIN 충돌이 옳고, Human GT 쪽 3건을 그 정의로 재라벨해야 한다
   🔴 **어느 쪽이든 정의를 먼저 적어야** 이 축을 배포할 수 있다
② 그 뒤에야 「GTIN 일치가 blocker 를 지울 수 있는가」를 물을 수 있다
   🔴 지금 묻지 않았다 — blocker 의미를 바꾸는 것은 threshold 완화와 같은 등급의
      정책 변경이고 CPO 금지 목록에 있다
```

---

## §7 최종 판정

```
구현        🟢 전부 완료하고 실제로 돌렸다
측정        🟢 전수 51 · 운영 경로 · CONTROL 포함
수용 기준    🔴 **미달** — ΔSAME 0 (C11·C37·C38 회수 실패)
부작용       🔴 Human SAME 3건이 PRESUMED_SAME → CONFLICT 로 악화
False SAME  🟢 1 → 1 (증가 없음)
조치        🟢 **되돌렸다** · 작업트리 clean · 배포 없음
──────────────────────────────────────────
**HOLD** — 선행 조건은 코드가 아니라 **baby 사이즈 정책 결정** 이다.
```

🔴 **CEO Action: NONE.**
