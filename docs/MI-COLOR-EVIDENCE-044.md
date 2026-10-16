# WU-044 — 색상 증거 구조 확보

> 🟢 **GO.** 운영 1파일 변경 · 배포 완료 · KPI **무변화**(기준선과 동일) ·
> 🔴 색상 사전 확대 **0** · threshold **0** · `SIZE_SYSTEM` **손대지 않음**.

---

## §1 원인 — 「가용성」이 아니라 **비교** 였다

WU-043 이 찾은 구멍을 한 줄로:

```
compareColor 는 색상 «이름» 이 아니라 **색조 그룹** 을 비교한다.
  Grey Melange → {GREY}      Graystone → {GREY}      → **match**
```
🔴 그래서 같은 모델의 서로 다른 colorway 가 **같은 색** 으로 읽힌다.
그 쌍(C20·C25)을 막고 있던 것은 **`SIZE_SYSTEM` 이 «우연히»** 였고, WU-043 이
그것을 풀자 **즉시 새 False SAME** 이 됐다.

> **즉 진짜로 막아야 할 축(색상)은 처음부터 작동하지 않고 있었다.**

---

## §2 사전 측정 — 이름 수준이 실제로 가르는가 (전수 51)

양쪽에 색상이 있는 **26쌍** 을 색상 «이름» 겹침으로 갈랐다:

```
이름겹침 × Human SAME        **14**
이름겹침 × Human DIFFERENT     3    (색상이 아니라 다른 이유로 다른 쌍)
이름다름 × Human DIFFERENT   **8**   🟢 엄격화가 잡아 준다
이름다름 × Human SAME        **0**   🔴🔴 **깨지는 것이 하나도 없다**
이름다름 × UNCERTAIN            1
```
🟢 **Recall 을 한 건도 희생하지 않고** C19·C20·C25 를 잡는다.

---

## §3 구현 — 운영 1파일

```
COLOR_VARIANT (**보류**)
  조건: 색조 `match` **그리고** 이름 `mismatch`
  🔴 충돌(DIFFERENT)이 아니다 — 다국어/표기 차이로 이름이 갈릴 수 있다.
     보류는 SAME 만 막고 CONFLICT 로 내리지 않는다.
  🔴 색조가 이미 불일치면 기존 COLOR 충돌이 더 강하므로 **겹쳐 두지 않는다**.
  🔴 한쪽이라도 색상이 없으면 **아무것도 하지 않는다**(기존 정책 유지).

colorNameTokens
  🔴 **새 사전을 만들지 않았다** — 상품군 낱말은 **기존 `extractCategoryTaxon`**
     으로 걷는다(추출 오염 실측: `"sweatshirt in graystone"`). 두 글자 이하는 버린다.
```
🔴 **이것은 색상 사전 «확대» 의 반대다** — 색조 사전에 **덜** 기대는 방향이다.

---

## §4 E2E (운영 `withConfidence` · 전수 51)

| KPI | 기준선 | After |
|---|---:|---:|
| MI SAME | 11 | **11** |
| **False SAME** | 1 | **1** |
| SAME MISS | 17 | **17** |
| Precision | 0.909 | **0.909** |

🟢 **아무것도 깨지지 않았다.** 그리고 보류가 **정확히 2건** 발화했다:

```
C20 junioredition  Grey Melange ↔ Graystone              Human **DIFFERENT**
C25 main-story     Grey Melange ↔ "sweatshirt in graystone"  Human **DIFFERENT**
🟢 Human SAME 에는 **0건**
🟢 C19(Conker Stripe)는 색조가 이미 달라 기존 COLOR 충돌이 먼저 잡는다(설계대로)
```

---

## §5 CPO 측정 요구 대조 — 🔴 한 줄을 정확히 적는다

| 요구 | 결과 |
|---|---|
| C17 Grey Melange → SAME | 🟢 **SAME**(무변화) |
| C19 Conker Stripe → DIFFERENT | 🟢 **CONFLICT** |
| C20 Graystone → DIFFERENT | 🟡 **SAME 아님(보류)** — 🔴 CONFLICT 는 아니다 |
| C25 Grey Melange ↔ Graystone → DIFFERENT | 🟡 **SAME 아님(보류)** — 🔴 CONFLICT 는 아니다 |
| C29/C30/C34 baby → SAME 후보 유지 | 🟢 PRESUMED_SAME 유지(이 WU 는 `SIZE_SYSTEM` 미변경) |
| False SAME 1건 악화 금지 | 🟢 **1 → 1** |
| 색상 정보 없으면 기존 정책 | 🟢 유지 |

🔴 **C20·C25 를 「DIFFERENT」로 적지 않는다** — 보류(SAME 차단)이지 충돌이 아니다.
그렇게 만든 이유는 §3 의 다국어 위험이다.

---

## §6 🔴 미측정 — 0 으로 적지 않는다

```
한글 색상 표기(「그레이 멜란지」 등)가 표본에 **없다** → 다국어 이름 차이 N=0.
🔴 그 경우 보류가 과하게 걸릴 수 있다. 다만 **보류이지 충돌이 아니라서**
   최악이 「SAME 대신 PRESUMED_SAME」이고 False SAME 을 만들지 않는다.
```

---

## §7 검증·배포

```
계약 테스트   10 passed (발화 · 비발화 · 충돌 미승격 · 소스 가드)
음성대조      M1 술어 상수화 **3 FAIL** · M2 extractCategoryTaxon 제거 **1 FAIL** ·
              M3 nameOutcome 고정 **2 FAIL** → 복구 10 passed
회귀          admin **555 files / 8,123 passed · failed 0**
typecheck 0 · build exit 0
배포          `9c257d9f` — 빌드 로그 `Commit: 9c257d9`
smoke         GET / **200** · POST /api/price-history/check **401**(인증)
```

---

## §8 최종 판정

```
색상 증거      🟢 **세웠다** — 색조에 덜 기대고 이름을 본다
안전성         🟢 KPI 전건 무변화 · 발화 2건 전부 Human DIFFERENT
C25 안전성     🟢 **해결** — 이제 색상이 막는다(그 전엔 SIZE_SYSTEM 이 우연히 막았다)
SIZE_SYSTEM    🟢 **손대지 않았다**(CPO 제한 준수)
운영 변경      1파일 · 배포 완료
──────────────────────────────────────────
**GO**
```

### 🔴 다음에 열리는 것 (CTO 가 고르지 않았다)

```
🟢 이제 `SIZE_SYSTEM` 완화를 **다시 검토할 수 있다** — C25 가 색상으로 막히므로
   WU-043 에서 샜던 그 경로가 닫혔다. 🔴 단 C29 는 그때도 안 올라왔으므로
   「baby 판 회수」가 실제로 몇 건인지는 **다시 재야 한다.**
🔴 한글 색상 표기 쌍을 표본에 넣어 다국어 과잉 차단을 측정하는 것도 남아 있다.
```

🔴 **CEO Action: NONE.**
