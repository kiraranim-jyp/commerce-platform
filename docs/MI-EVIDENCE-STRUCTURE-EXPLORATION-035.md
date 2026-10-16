# WU-035 — Evidence Structure Exploration

> CPO 질문: **「브랜드 확인 없이도 SAME 을 안전하게 확정할 수 있는 독립 증거 구조가
> 있는가?」**
>
> 🔴 **측정 전용.** 운영 코드 변경 **0** · HTTP **0** · AI **0** · 비용 **₩0** · 구현 **0**.
> 금지 유지 — threshold 0 · 색상사전 0 · 별칭사전 0 · Registry 0 · domain→brand 0.

---

## 1. 답 — 🔴🔴 **없다. 그리고 원인이 데이터 품질이 아니라 «식별 체계» 다**

단조 규칙(`axes ⊇ S → SAME`)을 **255개 전수** 열거했다:

```
🔴🔴 **False SAME 0 을 달성하는 규칙이 «0개» 다.**

TP 최대 규칙들 (전부 FP > 0)
  MODEL_CODE 단독        TP 20 / **FP 5**
  TITLE 단독             TP 20 / FP 17
  CATEGORY 단독          TP 19 / FP 15
  TITLE+MODEL_CODE       TP 16 / **FP 5**
  MODEL_CODE+CATEGORY    TP 16 / **FP 5**
현재 운영 MI             SAME 10 / **FP 0**     ← 비교 기준
```

🟢 **즉 「축을 더 요구해서」 FP 0 에 도달하는 길이 없다.** 가장 엄격한 규칙(8축 전부
요구)조차 FP 1 이다.

---

## 2. 🔴🔴🔴 왜 그런가 — **브랜드가 색상 변형에 «같은 품번» 을 쓴다**

축 서명(axis signature)이 두 class 에서 겹치는지 봤다:

```
순수 서명 19 · 🔴 **충돌 서명 3** · **충돌에 갇힌 GT SAME 8건**
최대 충돌  AUDIENCE+CATEGORY+COLOR+FIT+MATERIAL+MODEL_CODE+SIZE+TITLE
           GT SAME **5** | GT DIFFERENT **1**     ← 8축 전부 일치인데 다른 상품
```

그 1건의 정체:

```
원상품   Main Story  **AW26MS185**  "Bubble Sweatshirt in **Grey Melange**"
후보     Main Story  **AW26MS185**  "Bubble Sweatshirt in **Graystone**"
         https://www.junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story
```

🔴 **같은 품번이고 다른 색상이다.** 그리고 품번 축이 선 GT DIFFERENT 는 **5건 전부
같은 구조**다 — `AW26MS185` 가 `Grey Melange` · `Graystone` · `Conker Stripe` 에
**공통으로 쓰인다.**

> **`AW26MS185` 는 «상품 모델 코드» 이지 «색상별 SKU» 가 아니다.**

### 🔴🔴 그런데 변형을 갈라야 할 **색상 축이 그 둘을 같다고 본다**

```
원 colorText   "Grey Melange"
후보 colorText "Graystone"
→ 🔴 **COLOR 축이 «일치» 로 섰다** (둘 다 grey 계열로 정규화된다)
```

🔴 그래서 **품번과 색상이 둘 다 있어도 변형을 가르지 못하는 실제 쌍이 존재한다.**
이것이 §1 에서 FP 0 규칙이 0개인 **직접적인 이유** 다.

---

## 3. 🟢🟢 이 발견이 선행 WU 의 결론을 **새로 해석하게 한다**

```
WU-032  「색상 완벽 추출 → ΔSAME 0」
        → 🔴 색상은 **레버가 아닐 뿐 아니라, 이미 거짓 일치를 만들고 있다.**
          색상 추출을 강화했다면 **FP 가 늘었을 수도 있다.**
          🟢 CPO 가 「색상 추출을 무작정 강화하면 안 된다」고 한 판단이 **데이터로 맞았다.**
```

🟢 **그리고 MI 의 보수적 설계가 정당화됐다** — blocker 가 없었다면 그 5건(같은 품번
다른 색상)이 **전부 False SAME** 이 됐을 것이다. `Precision 1.000` 은 우연이 아니라
**설계의 산출** 이다.

🔴 양방향 오차도 확인됐다 — 같은 S4 에서 공식몰 `main-story.com`(GT SAME · color
`"our grey"`)은 `SIZE_SYSTEM` blocker 에 막혀 PRESUMED_SAME 에 머문다. **색상 어휘는
한쪽에서는 과하게 일치하고 다른 쪽에서는 못 잇는다.**

---

## 4. CPO 5항 동시 검토 결과

| CPO 요구 | 결과 |
|---|---|
| GT SAME 을 얼마나 더 구하는가 | 🔴 FP 0 조건에서 **0** (규칙 자체가 없다) |
| GT DIFFERENT 를 SAME 으로 만드는가 | 🔴 **모든 발화 규칙이 만든다**(최소 FP 1) |
| `False SAME = 0` 유지되는가 | 🟢 **현재 설계만 유지한다** |
| 기존 MI gate 를 우회하는가 | 🔴 축 기반 규칙은 **정의상 blocker 를 우회한다** → 그래서 FP 가 난다 |
| 새 추정/사전/Registry 가 필요한가 | 🔴 변형을 가르려면 **variant 식별자** 가 필요하다(§5) |

---

## 5. 🟢 그래서 필요한 증거원이 **정확한 이름**을 얻었다

🔴 브랜드가 아니다. 축 조합도 아니다.

> **필요한 것은 «variant(색상) 단위 식별자» 다** — 색상별 SKU · Shopify variant id ·
> GTIN/EAN 처럼 **같은 모델의 다른 색상을 서로 다른 값으로 구분해 주는 식별자.**

🟢 **그 축이 없으면 어떤 조합으로도 못 가른다**는 것이 §1~§2 의 증명이다.
🔴 **그 축이 실제로 수집 가능한지는 이 WU 에서 측정하지 않았다** — 다음 질문이다.
🔴 그리고 그것을 `brandModelCode` 칸에 넣는 것은 **WU-032 가 FP 1:1 로 탈락시킨 바로
   그 행위** 이므로, 넣는다면 **새 칸** 이어야 한다(설계 사안 · CPO 결정).

---

## 6. 최종 판정

```
CPO 질문            🟢 답했다 — **안전한 브랜드-프리 증거 구조는 없다**
증명 방식            🟢 단조 규칙 **255개 전수** + 축 서명 충돌 분석
근본 원인            🟢 **품번이 색상 변형에 공유된다** + **색상 어휘가 변형을 못 가른다**
MI 설계              🟢 **정당화됐다** — blocker 가 없으면 FP 5
선행 결론 재해석      🟢 색상 강화는 **FP 를 늘렸을 수 있다**(WU-032 를 강화)
새 증거원            🟢 이름 확정 — **variant 단위 식별자**(수집 가능성 미측정)
코드 변경            🟢 **0**
False SAME           🟢 **0 유지**
──────────────────────────────────────────
**HOLD / 축 조합 탐색은 CLOSED** — 현재 축 체계 안에 답이 없다는 것이 증명됐다.
```

🔴 **CEO Action: NONE.**
