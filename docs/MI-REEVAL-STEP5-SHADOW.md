# MI-REEVAL **STEP 5** — 개선 MI Shadow 종합 평가

> 🔴 **운영 코드 · matcher · extractor · Identity · alias · GT · DB · schema · 검색/수집
> 변경 0 · 네트워크 0.** Shadow 평가만 했다. 🔴 **운영 반영 0** — CPO 판단 대기.
> 산출 — `mi-reeval-05-shadow.test.ts` · `docs/MI-REEVAL-STEP5-SHADOW.json`

---

## 0. 🔴🔴 보완 1 — CPO 가 지적한 **분류 대응표**

CPO 가 본 `SAME 18` 과 `SAME 7` 은 **분류 체계가 다른 것이 아니라 «축» 이 다르다**:
`18` 은 **기존 GT 라벨** 분모이고 `7` 은 **재현 verdict** 다.

### 재현 verdict × 기존 GT 라벨 — 교차표 (A군 33)

| 재현 verdict ＼ GT | SAME | DIFFERENT | UNCERTAIN |
|---|---:|---:|---:|
| `SAME` | **6** | **1** | 0 |
| `PRESUMED_SAME` | 8 | 5 | 0 |
| `SIMILAR` | 3 | 1 | 0 |
| `CONFLICT` | 1 | 1 | 0 |
| `UNKNOWN` | 0 | 1 | 6 |
| **합** | **18** | **9** | **6** |

```
GT `SAME 18` = PRESUMED_SAME 8 + SIMILAR 3 + SAME 6 + CONFLICT 1
TP 6 = 재현 `SAME` ∩ GT SAME      FP 1 = 재현 `SAME` ∩ GT DIFFERENT
🔴 TP/FP 에서 «SAME 쪽» 은 **`SAME` 하나** 다 — `PRESUMED_SAME` 을 포함하지 않는다
🔴 **FN 12 의 내역 = 보류(PRESUMED_SAME) 8 + SIMILAR 3 + CONFLICT 1**
```
🟢 그래서 **FN 축소의 자리가 «보류» 다** — 8/12 가 `PRESUMED_SAME` 이다.

---

## 1. 🔴🔴 보완 2 — **A군에 상세설명이 없다**(이번에 실측)

```
A군 33쌍  후보 `facts.description` **0/33** · 원본 **0/33** · `facts.evidence` **0/33**
🟢 대신 구조화 칸이 있다 — 원본 materialText 33 · colorText 32 · categoryText 33
                          후보 materialText 16 · colorText 15 · categoryText 19
⟹ 🔴 **CEO 증거 ④「상세설명」을 A군에서 쓸 수 없다.** 그 축의 개선은 **B군 관찰에서만** 보인다
⟹ 🔴 그러므로 「상세설명 기반 개선」을 A군 수치로 주장하지 않는다
```

---

## 2. 평가군 — 🔴 **합산하지 않았다**(CPO 결정 ①)

| | 분모 | 성격 | 교집합 |
|---|---:|---|---|
| **A** `SAME05` | **33** | 동일 조건 **주 평가** | A∩C = **11** · A∩B = **0**(계약으로 고정) |
| **B** desc-compare | **109** | **별도 관찰군**(라이브 기록 ↔ Shadow · 🔴 조건이 다르다) | — |
| **C** CEO Evidence Review | **11** | CEO 기준군(🔴 A 와 겹친다 ⟹ 중복 계산 금지) | — |

🔴 109쌍 `ProductFacts` **네트워크 재수집 0**(CPO 미승인).

---

## 3. 개선 Shadow 규칙 — 🔴 **점수·확률·가중치 0**

순서가 전부다. CEO·CPO 가 못 박은 것을 그대로 옮겼다.

```
C1  BRAND MISMATCH                        → DIFFERENT        (브랜드는 핵심 식별이다)
C2  MODEL_CODE MISMATCH + 상품종류 일치     → **SIMILAR**      🔴 품번 불일치만으로 다름 단정 금지
    MODEL_CODE MISMATCH + 종류 근거 없음    → DIFFERENT
C3  MODEL_CODE MATCH + 보조 충돌 없음       → **SAME**
C4  MODEL_CODE MATCH + 보조 충돌 있음       → **SIMILAR**      🔴 품번 일치만으로 SAME 확정 금지
C5  품번 미확정 + 브랜드·상품명·종류 일치      → **SAME**         ← 🟢 FN 을 줄이는 유일한 자리
    (V2 는 여기서 **색상 일치까지** 요구한다)
C6  브랜드만 같고 하나만 일치               → SIMILAR
C7  종류·상품명이 **둘 다** 충돌            → DIFFERENT        🔴 DESIGN 단독 판정 금지
C8  그 외                                 → UNDECIDED        (UNKNOWN ≠ MISMATCH)
🔴 소매 길이 **단독 규칙을 만들지 않았다** — 보조 축으로만 쓴다(CEO: 「유사상품이면 문제없다」)
```
보조 축 = `COLOR` · `MATERIAL` · `SLEEVE_FORM` · `PRINT_PATTERN` · `FIT`.

---

## 4. 🔴🔴 가드레일 — **두 분모를 «같이» 적는다**

### ⒜ A군 33쌍 (Main Story **포함**) · 기존 GT 확정 **27**

| 기준 | TP | FP | FN | TN | 판정 |
|---|---:|---:|---:|---:|---|
| 기존 MI 재현(기준선) | 6 | **1** | **12** | 8 | — |
| 개선 Shadow **V1** | 13 | **5** | 5 | 4 | 🔴 **개선 아님**(FP 증가) |
| 개선 Shadow **V2** | 10 | **4** | 8 | 5 | 🔴 **개선 아님**(FP 증가) |

### 🟢🟢 ⒝ Main Story **제외** 후 (= 운영에서 **실제로 비교되는** 쌍) · 확정 **22**

| 기준 | TP | FP | FN | TN | 판정 |
|---|---:|---:|---:|---:|---|
| 기존 MI 재현(기준선) | 5 | **1** | **12** | 4 | — |
| 개선 Shadow **V1** | **12** | **1** | **5** | 4 | 🟢 FN **−7** · FP **동일** ⟹ **충족** |
| 개선 Shadow **V2** | 9 | **0** | 8 | 5 | 🟢 FN **−4** · FP **감소** ⟹ **충족** |

🔴🔴 **두 표의 차이가 전부 Main Story 때문이다** — 새로 생긴 FP 4건이 `C22 · C19 · C20 · C25`
이고 **전부 Main Story** 다. 🟢 그 브랜드는 **이미 취급 제외가 배포됐다**(`21d4a5fa`) ⟹
운영에서 그 쌍은 **애초에 비교되지 않는다**. CPO 가 「Main Story 는 별도 집계」로 지시한 그 자리다.
🔴 그래도 **33쌍 표를 지우지 않았다** — 분모를 바꿔 숫자를 좋게 만들지 않는다.

### 🟢🟢 FP 가 **같은 건인지** 확인했다 — 수만 같으면 거짓일 수 있다

```
기준선 FP  [S1-6]      V1 FP  [S1-6]   ⟹ 🟢 **같은 1건이다**
기준선 TP 중 V1 이 «잃은» 것 — 🟢 **없음**(계약으로 단언)
🔴 S1-6 = 반팔 ↔ 긴팔 건이고 CEO 가 「유사상품 분류는 문제되지 않는다」고 적은 그 쌍이다
🟢 V2 는 그 1건마저 SAME 에서 내린다(FP 0) — 대가로 TP 가 12 → 9 다
```

### ⒞ C군 11쌍 · CEO 최신 기준 — 🔴 **A 와 합산하지 않는다** (확정 10)

| 기준 | TP | FP | FN | TN |
|---|---:|---:|---:|---:|
| 기존 MI 재현 | 2 | 2 | 1 | 5 |
| 개선 Shadow V1 | 3 | **6** | 0 | 1 |
| 개선 Shadow V2 | 3 | **5** | 0 | 2 |

🔴🔴 **C군에서는 FP 가 크게 늘었다** — 그 11쌍에 Main Story 5쌍이 들어 있고 CEO 가 그것을
**전부 DIFFERENT** 로 판정했기 때문이다. 🔴 **「CEO 기준으로도 개선됐다」로 적지 않는다.**
🟢 Main Story 를 빼면 C군의 유효 분모가 **5 이하** 로 떨어져 **측정불가** 다.

🔴 `precision` / `recall` / `F1` / 점수 / 확률을 **산출에 쓰지 않았다**(계약으로 금지).

---

## 5. 판정이 바뀐 쌍 — 개선 / 악화

```
바뀐 쌍 24 / 33
🟢 기존이 **놓친 SAME 을 찾아냈다**  **7**
   C27 beaumonde.co.kr    PRESUMED_SAME → SAME   품번 일치 · 충돌 축 없음
   C11 bobochoses.co.jp   PRESUMED_SAME → SAME   같은 사유
   C48 bobochoses.com     PRESUMED_SAME → SAME   같은 사유
   C14 kihanan.com        PRESUMED_SAME → SAME   같은 사유
   C37 bobochoses.co.jp   PRESUMED_SAME → SAME   같은 사유
   S1-1 www.rboutique.com SIMILAR       → SAME   품번 없이 브랜드·상품명·종류 일치
   S1-4 kolkid.ca         PRESUMED_SAME → SAME   같은 사유
🟢 기존이 맞춘 SAME 을 **잃었다**     **0**
🔴 **새로 틀린 SAME**                 **4** — C22 · C19 · C20 · C25  ⟹ **전부 Main Story**
🟡 기존의 틀린 SAME 을 걸러냈다        **0**(V1) · **1**(V2 · S1-6)
```

🟢🟢 **FN 7건 중 5건이 「품번은 일치하는데 보류였던」 쌍** 이다 — STEP 4 가 「FN 12 의 8이
`PRESUMED_SAME`」이라고 적은 그 자리를 **정확히** 열었다. 🔴 그리고 그것은 **품번을 새로
찾은 것이 아니다** — 보류를 SAME 으로 **승격한** 것이다(그래서 운영 반영은 CPO 판단이다).

---

## 6. 동의어 **OFF / ON** (CPO 결정 ②)

### A군 판정 변화
```
V1  OFF {SAME 18 · UNDECIDED 8 · SIMILAR 6 · DIFFERENT 1}
V1  ON  {SAME 18 · UNDECIDED 8 · SIMILAR 6 · DIFFERENT 1}   ⟹ 🔴 바뀐 쌍 **0**
V2  OFF {SAME 13 · UNDECIDED 8 · SIMILAR 11 · DIFFERENT 1}
V2  ON  {SAME 14 · UNDECIDED 8 · SIMILAR 10 · DIFFERENT 1}  ⟹ 바뀐 쌍 **1**(C25 · Main Story)
```
🔴🔴 **A군에서 동의어의 판정 효과는 «거의 0» 이다** — A군은 영문 원문이 많고 설명문이
없기 때문이다. 🟢 동의어의 효과는 **B군(한국어 후보가 있는 코퍼스)** 에서 나타난다(STEP 4 §5).
🔴 그러므로 「동의어 사전이 판정을 개선한다」로 **적지 않는다**.

### 🔴 미확정 2건 — **OBSERVED / UNVERIFIED 유지** · 🟢 답이 나왔다

**① COLOR · `folkberlin.com` — 🔴🔴 «거짓 통합» 이다**
```
원본  구조화 color = ""  · 설명문 「Light heather grey sweatshirt…」 → grey (DESCRIPTION@14)
후보  제목 「Baby Sweater Suit ''Blue Moon''」 → blue (TITLE@20)
      설명문 「… The **Gray Label** logo embroidery is embroidered…」 → grey (DESCRIPTION@301)
🔴🔴 후보의 「Gray」는 **브랜드명 「Gray Label」** 에서 왔다 — **색상이 아니다.**
   후보의 실제 색상은 「Blue Moon」(blue) 이고, 동의어 OFF 는 올바르게 `MISMATCH` 였다.
⟹ 🔴 **동의어 문제가 아니라 «추출» 결함** 이다 — COLOR 축이 브랜드명 안의 색상 단어를 집는다.
🟢 A군 판정에 영향 **0**(이 쌍은 B군이다) · 🔴 **고치지 않았다**(측정값이 흔들린다 · CPO 판단)
```

**② MATERIAL · `designerkidswear.com` — 🟡 화학적으로는 타당하나 부분 일치다**
```
원본  구조화 material 「100% polyamide」 → nylon (OBSERVED·STRUCTURED@5)
      설명문 「100% polyamide in one face and 100% **polyester** polar fleece on the other」 → polyester
후보  설명문 「… crafted from **nylon** laqué …」 → nylon (DESCRIPTION@151)
🟢 `polyamide = nylon` 은 **같은 섬유** 다 ⟹ 그 연결 자체는 타당하다
🔴 그러나 원본은 **양면 소재**(polyamide + polyester)이고 후보는 nylon 하나다 ⟹ **부분 일치** 다
⟹ 🔴 **「같은 소재」로 단정하지 않는다** — `OBSERVED / UNVERIFIED` 유지
```

🔴 두 건 모두 **REGISTRY 승격 0 · 운영 alias 반영 0 · 생산 비교기 적용 0**.

---

## 7. B군 — 별도 관찰군 (🔴 A 와 합산 금지)

```
라이브 기록 분포  PRESUMED_SAME 80 · BASELINE_NOT_REPRODUCED 17 · SAME 10 · CONFLICT 2
Shadow V1 분포    UNDECIDED 71 · SAME 20 · DIFFERENT 11 · SIMILAR 7
GT 확정 **35쌍**  라이브 TP 3 · FP 0 · FN 17 · TN 15
                 Shadow TP **10** · FP **1** · FN **10** · TN 14
🔴 **조건이 다르다** — 라이브는 실제 HTTP facts, Shadow 는 제목+설명문 키워드다 ⟹ 참고값이다
🔴 Shadow 가 `UNDECIDED` 71 인 이유 — 그 코퍼스는 **후보 brand·품번 추출이 얇다**(STEP 3 §2)
```

---

## 8. 🔴 측정불가 · 한계 — 숨기지 않는다

```
🔴 A군에 **설명문이 0/33** ⟹ CEO 증거 ④ 의 개선을 A군에서 측정할 수 없다
🔴 A군 확정 분모 **22**(Main Story 제외) · C군 **10** · B군 **35** — 전부 작다
   ⟹ precision/recall 을 적지 않았고 「정확도가 X% 개선」이라고 쓰지 않는다
🔴 C군에서는 FP 가 늘었다(Main Story 때문) ⟹ 「CEO 기준으로도 개선」은 **성립하지 않는다**
🔴 FN 7건 회수는 **보류 승격** 이다 — 새 증거를 찾은 것이 아니다
🔴 동의어의 판정 효과는 A군에서 **0** 이다 ⟹ 사전의 가치는 이 분모로 입증되지 않았다
🔴 `folkberlin` COLOR 는 **추출 결함**(브랜드명 오염)이고 고치지 않았다
🔴 `SIZE_OPTION` 추출 0 · `AUDIENCE` 양쪽 추출 0(STEP 3 과 같은 한계)
🔴 브랜드 편향 — Bobo Choses 계열 다수
🔴 B군은 **조건이 다른 관찰군** 이다 — A 의 성능을 보완하지 않는다
```

---

## 9. 검증

```
계약 — 기준선 교차검증(TP 6/18 · FP 1 · 분모 27) · A∩B = 0 · A∩C = 11 ·
      어휘 넷 고정 · 점수/확률/가중치 산출 0 · precision/recall/f1 0 ·
      미확정 동의어 UNVERIFIED 유지 · 🟢 **기존 TP 를 잃지 않았다**(단언) ·
      🟢 가드레일을 **두 분모로** 기록
결과 — 1 passed / 0 failed · 네트워크 0 · DB 쓰기 0 · 운영 변경 0
```

---

## 10. CPO 판단 요청 — **넷**

```
① 🔴 **어느 분모를 기준으로 볼 것인가** — 33쌍(MS 포함 · FP 1→5 ⟹ 개선 아님) ↔
   22쌍(MS 제외 · FP 1→1 ⟹ 충족). 🟢 운영은 이미 MS 를 제외하므로 **22 가 현실** 이지만,
   CTO 가 분모를 골라 숫자를 좋게 만들지 않았다 — **판정은 CPO** 다.
② 🔴 **V1 ↔ V2** — V1 은 FN 5(TP 12)에 FP 1(S1-6 · 반팔↔긴팔), V2 는 FN 8(TP 9)에 FP 0.
   🟢 CEO 는 S1-6 에 「유사상품이면 문제없다」고 적었다 ⟹ 그 1건을 허용할지가 선택이다.
③ 🔴 **보류 승격을 운영에 반영할 것인가** — FN 7건 회수는 「품번 일치인데 `PRESUMED_SAME`」을
   SAME 으로 올린 것이다. 🔴 그 완화는 과거 WU 들이 **반복해서 위험하다고 측정한 축** 이다
   (`crossSellerReserved` 우회 시 precision 91.7% → 55.6%). ⟹ **별도 검증 WU 가 필요하다.**
④ 🔴 `folkberlin` COLOR **추출 결함**(브랜드명 오염)을 고칠 것인가 — 고치면 B군 측정값이 바뀐다.
```

🔴 **운영 반영은 하지 않았다.** CPO 승인 없이 운영 판정 로직을 바꾸지 않는다.
