# WU-069 — `CONFLICT` 품번 충돌 5건 원인 분해 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「품번 충돌을 약화시키는 것이 목적이 아니다.
> 그 충돌을 **현재처럼 모든 경우에 동일한 강도로** `CONFLICT` 로 승격시키는 것이
> 정말 필요한가를 검증하는 것이다.」 · 「안전한 레버가 없으면 그대로 HOLD」

---

## 0. 판정 — 🔴 **HOLD · 품번 보호 동결**

```
🔴🔴 **내가 처음 짚은 레버가 헛다리였다** — 5건 전부 `crossSeller CONFLICT` 가 먼저
     이기므로 `compareModelCode` 를 건드려도 **변화 0건** 이다.
🔴 그리고 삼중 잠금이다 — ①을 「보류」로 내리면 ③(`crossSellerReserved`)이 다시 막는다.
     L1·L2·L3 **전부 변화 0건**.
🟡 삼중을 **전부 해제** 하면 SAME **3건 회복 · False SAME 증가 0 · 파생 유입 0**
     (CF-2 의 1건보다 **3배**). 🔴 그러나 그것은 **품번 보호의 해체** 이고
     CPO 정책선과 정면으로 만난다 ⟹ **구현하지 않았다.**
```

---

## 1~3. 5건 각각의 경로와 원인 (①②③)

| | 도메인 | 원 품번 ↔ 후보 품번 | `compareModelCode` | cross `conflicts` | 브랜드 | 색상미확인 |
|---|---|---|---|---|---|---|
| C33 | junioredition.com | `B226AC009` ↔ `B226AB040` | **conflict** | `[MODEL_CODE]` | 같음 | 아니오 |
| C35 | bornyesterdaykids.com | `B226AC009` ↔ **`null`** | **unavailable** | 🔴 **`[COMPOSITION]`** | 같음 | 아니오 |
| S1-7 | **bobochoses.com** | `B226AC010` ↔ `B226AB046` | **conflict** | `[MODEL_CODE]` | 같음 | 아니오 |
| S2-3 | **bobochoses.com** | `B226AC009` ↔ `B226AB040` | **conflict** | `[MODEL_CODE]` | 같음 | 아니오 |
| S2-4 | kids21.com | `B226AC009` ↔ 🔴 **`700005621LBL`** | **conflict** | `[MODEL_CODE]` | 같음 | **예** |

### 🔴🔴 ② `compareModelCode` 와 상위 판정은 **분리된다** — 그리고 상위가 이긴다

```
deriveMatchTruth:176   if (crossSeller === "CONFLICT") return "CONFLICT";   ← **먼저**
deriveMatchTruth:178   if (modelCode === "conflict")  return "CONFLICT";    ← 그 다음
```
🔴 5건 **전부 첫 줄에서 끝난다.** 그래서 `compareModelCode` 를 `unavailable` 로 바꾸는
counterfactual 을 돌렸더니 **변화 0건** 이었다 — **내 첫 레버가 틀렸다는 직접 증거** 다.

### 🔴 원인이 **셋**으로 갈린다 (하나가 아니다)

```
⒜ **라인 차이** C33 · S1-7 · S2-3 — `AC`(kids) ↔ `AB`(baby)
   🔴🔴 WU-048 이 「AB↔AC 변환 규칙이 아니다」로 **이미 HOLD** 한 바로 그 질문이다.
   🔴 CEO 는 SAME 이라 했지만 **사유를 적지 않았다** — 라인 차이를 인지하고 고른 것인지 **미확인**.
⒝ **샵 자체 SKU** S2-4 — `700005621LBL` 은 브랜드 품번이 아니라 kids21 의 자체 번호다.
   🔴 그것이 `brandModelCode` 칸에 들어와 브랜드 품번과 비교되니 **항상 conflict** 가 난다.
⒞ **소재 충돌** C35 — `conflicts [COMPOSITION]` 이고 **품번 문제가 아니다**(품번은 null).
```

---

## 4~5. Counterfactual — 최소 단위로 나눴다 (파생 135 포함)

🔴 `matchLevel` 은 손대지 않았다(WU-017 이 무효 레버로 확정했다).
🔴 「품번 충돌 완전 무시」도 하지 않았다 — 조건을 **같은 브랜드 + 충돌 사유가 품번뿐** 으로 좁혔다.

| 레버 | EXACT | SAME | 🔴 False SAME | precision | recall | 파생 135 |
|---|---|---|---|---|---|---|
| **현재** | 16 | 14 | **2** | 87.5% | 37.8% | 0 |
| **L1** cross CONFLICT=MODEL_CODE뿐 + 같은 브랜드 → **보류** | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
| **L2** L1 + `colorUnverified` 아님 | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
| **L3** L2 + 후보 색상 실재 | 16 | 14 | 2 | 87.5% | 37.8% | 0 |
| 🔴 **L4 삼중 전부 해제**(비용 측정) | **19** | **17** | **2** | **89.5%** | **45.9%** | **0** |

🔴🔴 **L1·L2·L3 가 전부 0 인 이유 — 삼중 잠금이다**:
```
① crossSeller CONFLICT → 「보류(PRESUMED_SAME)」로 내리면
③ **crossSellerReserved** 가 식별자 경로를 다시 막아 TEXT_CONFIRMED(=COMPARISON) 가 된다
   🟢 WU-066 이 「crossSellerReserved 는 정밀도의 기둥」이라 한 그 층이 여기서도 작동한다
② 그리고 `modelCode === "conflict"` 가 남아 있으면 그 줄이 또 CONFLICT 로 돌린다
⟹ **셋을 다 풀어야(L4) 움직인다.**
```

### L4 가 회복하는 것 — **3건 · 전부 CEO SAME**
```
C33  junioredition.com   EXCLUDED → EXACT
S1-7 bobochoses.com      EXCLUDED → EXACT
S2-3 bobochoses.com      EXCLUDED → EXACT
🔴 S2-4(샵 자체 SKU)와 C35(COMPOSITION)는 **회복되지 않는다** — 조건 밖이다
```

---

## 6~7. 반대편 안전성 (CPO §4)

| 표본 | CEO | 현재 | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|---|
| **C06** global.trenbe | DIFFERENT | EXACT | EXACT | EXACT | EXACT | **EXACT** |
| **S1-6** tinyapple | DIFFERENT | EXACT | EXACT | EXACT | EXACT | **EXACT** |
| 파생 DIFFERENT 135 | DIFFERENT | EXACT 0 | 0 | 0 | 0 | **0** |
| 기존 False SAME | — | 2 | 2 | 2 | 2 | **2** |

🟢 **어떤 레버도 C06·S1-6 을 건드리지 않는다**(둘 다 이미 EXACT 인 기존 False SAME 이고,
이 완화는 CONFLICT 경로에만 걸리므로 무관하다).
🟢 파생 135 에서 **새 False SAME 0**.

---

## 11. 🔴 최종 한 표 (CPO 요구)

| | 회복 SAME | 신규 False SAME | precision | recall | C06 | S1-6 | derived 135 |
|---|---|---|---|---|---|---|---|
| 현재 | — | — | 87.5% | 37.8% | EXACT | EXACT | 0 |
| L1 | **0** | **0** | 87.5% | 37.8% | 불변 | 불변 | 0 |
| L2 | **0** | **0** | 87.5% | 37.8% | 불변 | 불변 | 0 |
| L3 | **0** | **0** | 87.5% | 37.8% | 불변 | 불변 | 0 |
| 🔴 L4 | **3** | **0** | 89.5% | 45.9% | 불변 | 불변 | 0 |

---

## 8~10. 금지 준수 / Mutation / 회귀

```
🔴 CF-2 구현 **0** · `bbambam`/soft-404 **미접촉** · `matchLevel` 레버 **미시도**
🔴 `compareModelCode` 보호계약 **변경 0** — counterfactual 로만 쟀다
```

**Mutation** — baseline **11 passed** · 변형마다 원상복구
| | 변형 | 결과 |
|---|---|---|
| W1 | `crossSeller CONFLICT` 승격 제거 | 🔴 **1 failed** |
| W2 | `modelCode conflict` 승격 제거 | 🔴 **1 failed** |
| W3 | 접두 분기 `conflict` → `partial`(model-code.ts) | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **11 passed** |

**회귀** — 🔴 CPO §10 대로 **실패 테스트명 포착 장치를 걸고** 돌렸다:
```
apps/admin  **575 files / 8,260 passed** / failed **0** (skipped 95)
실패 테스트명 포착: **없음**(실패 0)   typecheck **0**   build **exit 0**
🟢 WU-068 의 「미규명 1 failed」를 반복하지 않았다.
```

---

## 12. 🔴 Known Unknowns

```
① 🔴 **CEO 가 `AC`↔`AB`(kids↔baby) 를 인지하고 SAME 이라 했는지 미확인** — 사유가 비어 있다.
   🔴 이것이 이 WU 전체의 전제다. 틀리면 L4 의 「회복 3건」이 **회복이 아니다**
② 🔴 L4 의 안전성은 **분모 63 + 파생 135** 에서만 쟀다. `AC`↔`AB` 가 실제로 다른 상품인
   표본이 이 데이터에 **없다** — 즉 **그 위험의 분모가 0** 이다(WU-065 A군과 같은 함정)
③ 🔴 S2-4 의 `brandModelCode` 에 **샵 자체 SKU** 가 들어온 경로는 추적하지 않았다
④ 🔴 C35 의 `COMPOSITION` 충돌이 왜 났는지(소재 표기 차이) 조사하지 않았다
⑤ 🔴 bobochoses.com 공식몰이 왜 다른 품번을 쓰는지(`AB046` vs `AC010`) 미확인
```

---

## 13. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 14. CEO Action — **없음** (CPO 지시 그대로 · 운영 변경 0)

---

## 15. 🔴 CPO 판정 요청

| 안건 | 측정 | CTO 권고 |
|---|---|---|
| **L1~L3** (충돌을 「보류」로) | 변화 **0건** | 🔴 **폐기** — 삼중 잠금이라 효과가 없다 |
| 🔴 **L4** (삼중 해제) | SAME +3 · FP +0 · 파생 0 | 🔴 **HOLD** — 숫자는 좋지만 **품번 보호의 해체** 이고 §16-② 처럼 **위험의 분모가 0** 이다 |
| **선행 질문** | — | 🟡 **CEO 에게 물어야 한다** — 「`AC`(kids) 와 `AB`(baby) 가 같은 상품인가」. 그 답이 L4 의 전제다 |
| S2-4 샵 자체 SKU 유입 | 미추적 | 🟡 별 조사(품번 품질 축) |

🟢🟢 **이번 WU 가 확정한 두 문장**:
```
① **`compareModelCode` 는 이 5건의 원인이 아니다.** 상위의 `crossSeller CONFLICT` 가
   먼저 이긴다 — 보호계약을 건드릴 이유가 **없다**(동결 유지).
② 과잉 차단의 실체는 **「같은 디자인의 baby 라인 ↔ kids 라인」** 이고,
   그것을 같은 상품으로 볼지는 **코드가 아니라 제품 정의** 다(WU-048 과 같은 자리).
```
