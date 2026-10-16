# WU-043 — GTIN Variant Evidence 재구현 + 51건 E2E

> 🔴🔴 **결론: CPO 컨트롤 집합이 현재 색상 증거로는 «동시에 만족 불가» 다.**
> 구현해서 돌리고 **분리 측정** 한 뒤 되돌렸다. 작업트리 **clean** · 운영 변경 **0** · 배포 **없음**.

---

## §1 CPO 정책대로 구현했다

```
GTIN 일치   → 축(IDENTIFIER_AXIS_POINTS)
GTIN 불일치 → 🟢 **침묵**(DIFFERENT 로 쓰지 않는다 — WU-042 의 오류를 정정)
한쪽만/없음 → UNKNOWN
SIZE_SYSTEM → 🔴 「사이즈 라인 차이만으로는 SAME 을 막지 않는다」로 **비차단**
              (사실은 버리지 않고 `reasons` 에 관측으로 남겼다)
색상·모델·구성·GARMENT_FORM·AUDIENCE_LINE 은 **전부 그대로** 막는다
```
🟢 typecheck = baseline · 순환 import 0 · 추출은 운영 함수 그대로(추가 HTTP 0).

---

## §2 🔴 분리 측정 — 어느 변경이 무엇을 했는지 갈랐다

| 구성 | MI SAME | **False SAME** | SAME MISS |
|---|---:|---:|---:|
| 기준선 | 11 | **1** | 17 |
| **GTIN 축만** | 11 | 1 | 17 |
| **+ SIZE_SYSTEM 비차단** | **14** | **2** 🔴 | 15 |

### ① GTIN 축은 **아무것도 바꾸지 못한다** (Δ0)

🔴 WU-042 의 결론이 재확인됐다 — **SAME 은 `blockers.length === 0` 이 조건이고
GTIN 은 «축» 만 더한다.** 축을 아무리 더해도 blocker 가 남으면 SAME 이 안 된다.

### ② SIZE_SYSTEM 비차단은 **+3 을 벌고 False SAME 을 1 만든다**

```
🟢 벌었다  C30 · C34 · (+1)  — baby 판이 SAME 으로 올라갔다
🔴 잃었다  **C25 main-story.com** 이 새 False SAME 이 됐다
🔴 그런데도 **C29 는 여전히 PRESUMED_SAME** — CPO 컨트롤 미충족
```

---

## §3 🔴🔴 왜 C25 가 False SAME 이 되는가 — **원인이 색상이다**

```
원상품   Bubble Sweatshirt in **Grey Melange**   (junioredition)
C25      Bubble Sweatshirt **Graystone**          (main-story · Human **DIFFERENT**)
```
🔴 두 색상 문자열이 **둘 다 grey 로 정규화** 돼 comparator 가 충돌을 내지 못한다 —
**WU-035 §3 에서 이미 측정한 그 성질** 이다. 그래서 `SIZE_SYSTEM` 이 **우연히**
그 쌍을 막고 있었고, 그것을 풀자 바로 새 False SAME 이 됐다.

> **즉 C25 를 막고 있던 것은 「사이즈」가 아니라 «사이즈 blocker 가 우연히 걸린 것»
> 이었고, 진짜로 막아야 할 축(색상)은 처음부터 작동하지 않고 있었다.**

---

## §4 🔴🔴 그래서 CPO 컨트롤 집합은 현재 **동시에 만족 불가** 다

```
요구 ⒜ C29·C30·C34 (baby 판)        → **SAME**
요구 ⒝ False SAME 증가 금지(C25 포함) → **DIFFERENT**
```
둘은 **같은 blocker(`SIZE_SYSTEM`) 하나로 함께 막혀 있다.** 풀면 둘 다 풀리고,
두면 둘 다 막힌다. 🔴 가르려면 **색상을 정확히 가려야** 하는데
「Grey Melange ↔ Graystone」을 가르는 것은 **색상 사전 확대** 이고 **CPO 금지 항목** 이다.

🔴 그리고 C29 는 그것을 풀어도 안 올라왔다 — 다른 것이 더 막고 있다(미규명).

---

## §5 되돌렸다

```
git checkout — product-facts.ts · product-url-facts.ts · cross-seller.ts
하니스 삭제 · 작업트리 **clean** · typecheck **0** · 배포 **없음**
```

---

## §6 🟢 확정된 것 (다음 WU 는 이 조사를 반복하지 않는다)

```
🟢 GTIN 추출은 된다 — 원상품 6/6 · 후보 24/51 · 추가 HTTP 0
🔴 **GTIN 축은 Recall 을 못 올린다** — 막는 것은 blocker 이고 축이 아니다 (2회 확인)
🔴 GTIN 불일치를 DIFFERENT 로 쓰면 baby 판이 악화된다 (WU-042 실측)
🔴 SIZE_SYSTEM 을 풀면 **색상이 못 가르는 쌍이 새 False SAME 으로 샌다** (이번 실측)
🔴🔴 **그래서 다음 선행 조건은 「색상 증거」 다** — 「Grey Melange ↔ Graystone」을
     가르지 못하는 한, 사이즈 blocker 를 푸는 어떤 변경도 False SAME 을 만든다
```

### 🔴 CPO 결정 — 선행 순서가 바뀌었다

```
① **색상 증거를 먼저 세운다.** 🔴 단 색상 «사전» 확대는 금지돼 있으므로
   다른 경로여야 한다 — 예: 같은 상품 페이지의 **variant 옵션값**(색상 목록),
   GTIN↔색상 매핑, 이미지. 🔴 CTO 가 고르지 않았다. 측정도 안 했다.
② 색상이 가려지면 그때 SIZE_SYSTEM 을 풀 수 있다 (+3 이 안전해진다)
③ GTIN 은 그 뒤에도 **Recall 레버가 아니다** — blocker 해석을 바꿔야만 효과가 난다
   🔴 그것은 threshold 완화와 같은 등급의 정책 변경이라 CPO 승인 사안이다
```

---

## §7 최종 판정

```
구현        🟢 CPO 정책대로 전부 구현하고 실제로 돌렸다
분리 측정    🟢 GTIN 축 / SIZE_SYSTEM 을 **따로** 쟀다
컨트롤       🔴 **미충족** — C29 SAME 실패 · False SAME 1 → 2
원인         🟢 **확정** — 색상이 「Grey Melange ↔ Graystone」을 못 가른다
조치        🟢 되돌렸다 · 작업트리 clean · 배포 없음
──────────────────────────────────────────
**HOLD** — 선행 조건은 GTIN 이 아니라 **색상 증거** 다.
```

🔴 **CEO Action: NONE.**
