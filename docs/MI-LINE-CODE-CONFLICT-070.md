# WU-070 — `AC ↔ AB` 라인 충돌 안전성 검증 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「CEO 에게 추가 질문하지 말고 CTO 가 먼저 할 수 있는 범위를 전부 조사」
> 「새로운 Human GT 를 임의 생성하지 말 것 · 코드가 다르다는 이유로 DIFFERENT 라벨링 금지」

---

## 0. 판정 — 🟢 **DIFFERENT 분모를 확보했다 · L4 위험이 측정됐다**

```
🔴🔴 **WU-069 의 「DIFFERENT 분모 0」을 정정한다.** AC↔AB 에 DIFFERENT 가 **2건** 있고,
     라인이 다른 충돌 전체로는 **17건**, 라인 구조가 있는 DIFFERENT 전체는 **26쌍** 이다.
🟢🟢 **L4 는 그 26쌍을 하나도 뚫지 않는다**(False SAME 증가 **0**).
🔴 그러나 **막는 것은 라인이 아니다** — `브랜드 다름` 또는 `COLOR/CATEGORY 충돌 동반` 이다.
   「AC↔AB **+ 같은 색 + 같은 카테고리 + 같은 브랜드** + DIFFERENT」 표본은 **0** 이다.
   ⟹ 🔴 **그 구멍은 여전히 미측정** 이다.
⟹ CPO 기준 「안전한 DIFFERENT 표본 확보 + L4 위험 측정 가능」에 **해당** · 구현 **0**
```

---

## 1. 품번 구조가 파싱된다 — `B<season><LINE><num>`

```
관측 라인 코드   **AC** 6 · **AB** 2 · **AI** 1
🔴 구조 밖 3종   `AW26MS185`(Main Story) · `01195-VERNICE-NERO`(PèPè) ·
                 🔴 `700005621LBL` — **kids21 의 샵 자체 SKU** 가 `brandModelCode` 칸에 있다
🔴 번호 변환 규칙 **없다** — AC009↔AB040(차 31) · AC010↔AB046(차 36). 일정하지 않다
   ⟹ WU-048 의 「AB↔AC 변환 규칙이 아니다」와 정합한다
```

🔴 **이 파서는 서술용이다.** 운영 규칙으로 만들지 않았다(라인 코드를 «보기 위해» 썼다).

---

## 2. 품번 충돌 **62쌍** 전수 — 라인 구조 × Human 라벨

| 라인 구조 | SAME | DIFFERENT |
|---|---|---|
| **AC ↔ AB** | **3** | 🟢 **2** ← WU-069 가 0 이라 본 자리 |
| AC ↔ AC | 0 | **10** |
| AC ↔ AI | 0 | **9** |
| AI ↔ AB | 0 | **1** |
| AI ↔ AC | 0 | **5** |
| 구조 밖 | 1 | 31 |

🟢🟢 **DIFFERENT 분모가 생겼다** — 라인 구조가 있는 DIFFERENT **26쌍**(교차 라인 17 + 같은 라인 10 중 중복 제외).

🔴 **파생 DIFFERENT 를 어떻게 얻었는지 다시 적는다**(CPO 제한 준수):
```
🟢 사람 라벨에서 **논리적으로 함의** 되는 것만 썼다 —
   후보 c 가 S_i 에 Human SAME 이면 j≠i 에 대해 (S_j, c) 는 DIFFERENT 다.
🔴 「코드가 다르니까 DIFFERENT」로 라벨한 것은 **한 건도 없다.**
🔴 새 Human GT 를 **생성하지 않았다.**
```

---

## 3. L4 가 완화하는 조건 — 코드 수준 명세 (CPO 요구)

```ts
if (crossSeller === "CONFLICT"
    && conflicts.length > 0
    && conflicts.every(c => c.conflict === "MODEL_CODE")   // ① 충돌 사유가 품번 «뿐»
    && brandSame                                           // ② 양쪽 브랜드가 같다
    && !colorUnverified)                                   // ③ 색상이 확인됐다
  → verdict = "SAME"  그리고  modelCode = "unavailable"
```
🔴 **라인 코드를 전혀 보지 않는다.** `AC↔AB` 든 `AC↔AC` 든 **같은 강도로** 해제한다.

---

## 4. 🟢🟢 L4 위험 측정 — 26쌍 전수에서 **뚫리는 것 0**

L4 가 여는 것: **3건** — C33 · S1-7 · S2-3 (**전부 Human SAME · 전부 AC↔AB**).
🔴 그중 Human DIFFERENT: **0건**.

막힌 26쌍이 **무엇에** 막혔는지 전수:

| 막는 이유 | 건수 | 예 |
|---|---|---|
| 🟢 **브랜드 다름**(`brandSame=false`) | 13 | C39 · C49 · S6/C01 · S1/C11 … |
| 🟢 **충돌 사유가 품번 외에도 있다**(COLOR/CATEGORY 동반) | 13 | S1-5 `[COLOR+MODEL_CODE]` · S1/C33 `[COLOR+MODEL_CODE]` … |

🔴🔴 **가장 중요한 한 쌍**:
```
S1/C33  B226AC010 → B226AB040   **AC↔AB** · CEO **DIFFERENT** · brandSame **true**
        conflicts [COLOR+MODEL_CODE]  ⟹ 🟢 **COLOR 충돌이 막는다**
```
🟢 즉 「AC↔AB 이면서 DIFFERENT」인 쌍이 **실재하고**, L4 가 그것을 **메커니즘으로** 막는다
(우연이 아니다). 🔴 **그러나 막는 것은 라인이 아니라 색상이다.**

---

## 5. 🔴 남은 구멍 — 이것이 이 WU 의 가장 중요한 한계

```
L4 가 열리려면 ① 충돌이 품번뿐 ② 같은 브랜드 ③ 색상 확인됨 — 셋이 **동시에** 필요하다.
26쌍의 DIFFERENT 는 전부 ① 또는 ②에서 걸렸다.
🔴 **「AC↔AB + 같은 브랜드 + 같은 색 + 같은 카테고리 + 실제로 다른 상품」 표본은 0 이다.**
   ⟹ 그것이 L4 가 뚫릴 수 있는 **유일한 모양** 이고, 이 데이터에 **없다**.
🔴 「없다」가 「존재하지 않는다」가 아니다 — **미측정** 이다(§5-B).
```

---

## 6. 동일 구조의 다른 라인 충돌

```
🟢 `AI` 라인이 관측된다(`B126AI018` — 수영모자). AC↔AI · AI↔AB · AI↔AC 전부 DIFFERENT 다.
🔴 즉 **라인 코드 차이가 보통은 다른 상품** 이다 — `AC↔AB` 의 SAME 3건이 **예외** 다.
🟡 그 3건의 공통점: 전부 **bobochoses 공식몰 또는 junioredition** 이고 **같은 디자인의
   baby 라인** 으로 보인다. 🔴 그러나 「baby 라인」이라는 해석은 **CEO 가 말한 것이 아니다** —
   사유가 공란이다. 🔴 단정하지 않는다.
```

---

## 7. 공식몰이라도 실제 라인이 다른 사례

```
🔴 **찾지 못했다.** bobochoses.com 의 AB 품번 2건(AB040 · AB046)은 **둘 다 Human SAME** 이다.
🔴 즉 「공식몰인데 라인이 달라서 실제로 다른 상품」인 반례가 이 데이터에 **없다**.
```

---

## 8~10. 금지 준수 / Mutation / 회귀

```
🔴 L4 구현 0 · `compareModelCode` 변경 0 · CF-2 구현 0 ·
   `crossSellerReserved` 우회 0 · `bbambam`/soft-404 미접촉
```

**Mutation** — baseline **3 passed** · 변형마다 원상복구
| | 변형 | 결과 |
|---|---|---|
| X1 | `crossSeller CONFLICT` 승격 제거 | 🔴 **1 failed** |
| X2 | `COLOR` 충돌 push 제거 (L4 를 막던 축) | 🔴 **2 failed** |
| — | 원상복구 | 🟢 **3 passed** |

🟢 **X2 가 중요하다** — COLOR 충돌이 L4 의 방어라는 §4 결론을 **변이로 확인** 했다.

**회귀** — 🔴 CPO §10 대로 실패 테스트명 포착 장치를 걸었다:
```
apps/admin  **576 files / 8,261 passed** / failed **0** (skipped 95)
포착된 실패명 **없음** · typecheck **0** · build **exit 0**
🟢 WU-069 의 baseline(575/8,260)에서 **+1 file / +1 test** — 이 WU 의 신규 계약뿐이다
```

---

## 11. 🔴 Known Unknowns

```
① 🔴 **「AC↔AB + 같은브랜드 + 같은색 + DIFFERENT」 표본 0** — L4 의 유일한 구멍이 미측정
② 🔴 CEO 가 AC↔AB 를 「baby/kids 라인」으로 인지하고 SAME 이라 했는지 **여전히 미확인**
   (CPO 지시대로 **묻지 않았다**)
③ 🔴 파생 DIFFERENT 는 **운영 비재현 조합** 이다 — 정밀도 시험으로만 유효하다
④ 🔴 라인 코드 어휘(AC/AB/AI)의 **의미를 브랜드 공식 자료로 확인하지 않았다** — 추정이다
⑤ 🔴 `700005621LBL`(kids21 샵 자체 SKU)이 `brandModelCode` 에 들어온 경로 미추적
⑥ 🔴 관측 라인이 **Bobo Choses 하나** 다 — 다른 브랜드의 라인 체계는 미관측
```

---

## 12. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 13. CEO Action — **없음** (CPO 지시 그대로)

---

## 14. 🔴 CPO 판정 요청

| 안건 | 측정 | CTO 권고 |
|---|---|---|
| **L4 위험** | DIFFERENT 26쌍에서 뚫림 **0** · 열리는 3건 전부 SAME | 🟡 **다음 단계 검토 가능** — 단 §5 구멍을 명시해야 한다 |
| 🔴 **남은 구멍** | 「AC↔AB+같은브랜드+같은색」 DIFFERENT 표본 **0** | 🔴 **그 표본을 찾기 전에는 구현 보류 권고** |
| `700005621LBL` 유입 | 미추적 | 🟡 별 조사(품번 품질) |

🟢🟢 **이번 WU 가 확정한 두 문장**:
```
① **DIFFERENT 분모는 더 이상 0 이 아니다** — 26쌍이고 L4 는 그 전부를 막는다.
   WU-069 의 「분모 0 이라 측정 불가」는 **AC↔AB 만 좁게 본 결과** 였다.
② 🔴 그러나 **L4 를 막는 것은 라인이 아니라 색상·카테고리·브랜드** 다.
   라인 코드는 지금도 **아무도 보지 않는다** — 그래서 「AC↔AB 를 안전하게 허용한다」가
   아니라 **「다른 축이 우연히 막아 주고 있다」** 가 정확한 서술이다.
```
