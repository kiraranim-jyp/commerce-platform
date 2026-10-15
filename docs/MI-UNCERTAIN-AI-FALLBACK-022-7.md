# WU-022-7 완료 보고 — MI 보류구간 AI fallback 안전성 (counterfactual)

## 1. 대상
```
기존 51건(WU-022-6) 재사용 · 그중 **MI threeWay = UNCERTAIN 27건**
🔴 새 Search 0 · 새 AI 수집 0 · 외부 모델 0 · **HTTP 0** · GT 재작성 0 · 코드 0
```

## 2·3. 정책 비교 (같은 GT 분모 n=51)

| 정책 | Accuracy | Precision | **False SAME** | missed | UNCERTAIN |
|---|---:|---:|---:|---:|---:|
| **A. MI threeWay** | 0.725 | 🟢 **1.000** | 🟢 **0** | 14 | 27 |
| **B. MI → AI fallback** | 0.882 | 0.821 | 🔴 **5** | 1 | 0 |
| **C. AI only** | 🟢 **0.902** | 0.828 | 🔴 **5** | 🟢 **0** | 2 |
| 🟡 **D. 한방향 fallback**(참고) | 0.725 | 🟢 **1.000** | 🟢 **0** | 14 | **18** |

🔴 **D 는 지시서에 없던 추가 계산이다** — ⑥의 비대칭을 보고 **같은 데이터로** 돌렸다.
정책을 채택한 것이 아니라 **선택지를 하나 더 드러낸 것**이다.

## 4. 27건 상세 — AI × GT
| MI 상태 | AI SAME | AI DIFFERENT | AI UNCERTAIN |
|---|---:|---:|---:|
| MI UNCERTAIN (27) | **18** | **9** | 0 |

```
AI SAME      18 → GT SAME **13** · GT DIFFERENT **5**   (정답률 13/18 = 72%)
AI DIFFERENT  9 → GT SAME **0**  · GT DIFFERENT **9**   🟢🟢 **정답률 9/9 = 100%**
AI UNCERTAIN  0
fallback 이 «맞게» 확정한 수 = **22 / 27**(81.5%)
```

🔴🔴 **핵심은 평균이 아니라 «비대칭» 이다**:
> **AI 가 「아니다(DIFFERENT)」라고 말할 때는 9/9 전부 맞았고,
> 「같다(SAME)」라고 말할 때만 틀렸다(5/18).**

## 5. fallback 때문에 **새로 생긴 False SAME 5건** (전수)
```
S4  PRESUMED_SAME  [[메인스토리] Bubble Sweatshirt _Conker Stripe #AW26MS185
S4  PRESUMED_SAME  [메인스토리] AW26MS185 - Bubble Sweatshirt - Graystone
S4  PRESUMED_SAME  [MAIN STORY]Bubble Sweatshirt - AW26MS185 - Graystone
S4  PRESUMED_SAME  Bubble Sweatshirt - Graystone
S5  PRESUMED_SAME  225 Pepe Shoes Vernice Nero
```
🔴 **전부 MI 가 `PRESUMED_SAME` 으로 보류한 바로 그 자리** 다. 즉 B 는 MI 가 **일부러
참은 지점에서** 틀렸다.

## 6. 색상 failure mode — 🔴 **존재한다. 5건 중 4건이 그것이다**
```
S4 4건 — 전부 「**한글 쇼핑몰 제목 + 품번(AW26MS185) 표기**」이고 색상이 Conker Stripe /
         Graystone 인데 AI 가 SAME 으로 갔다. WU-022-6 Q3 와 **동일 축** 이다.
S5 1건 — 「225 Pepe Shoes Vernice Nero」. 색상명은 같고 **모델(225 ≠ 1195)이 다르다**.
         🔴 색상 축이 아니라 **모델 축** 실패다 — 섞지 않는다.
🟢 색상사전·MI·AI 로직 **변경 0**.
```

## 7. 결론 — **HOLD**
```
MI → AI fallback (B) = 🟡 **HOLD**
```
근거 셋:
```
① 🔴 B 는 **AI 단독(C)을 넘지 못했다** — 0.882 < 0.902. 「MI 를 섞어서 더 좋아진다」가 아니다.
② 🔴 B 는 **A 의 유일한 강점(False SAME 0)을 깨뜨린다** — 0 → 5.
   그리고 그 5건이 전부 **MI 가 의도적으로 참은 PRESUMED_SAME 자리** 다.
③ 🟢 그러나 **REJECT 도 아니다** — 보류 27건을 22건 맞게 확정했고,
   「아니다」 방향은 **9/9 완벽** 했다.
```
🟡 **그래서 D 가 남는다** — 한방향(DIFFERENT 만) fallback 은 이 표본에서
**False SAME 0 과 Precision 1.000 을 유지하면서 보류를 27 → 18 로 줄인다.**
🔴 단 **accuracy 는 오르지 않는다** — 이 지표 정의에서 `UNCERTAIN + GT DIFFERENT` 는
이미 「맞음」으로 세기 때문이다. D 의 이득은 **정확도가 아니라 「보류 9건이 줄어든다」** 이다.
🔴 **CTO 가 D 를 채택하지 않았다.** production ensemble 구현 **0**.

🔴🔴 **표현 제한(§9) — 이 문장을 그대로 쓴다**:
> 「이번 **n=51 · 원상품 6건 · `cto-judge` 판정자 1개** 측정에서, MI UNCERTAIN 구간에
> AI fallback 을 적용한 **counterfactual** 결과다.」
🔴 「AI 가 MI 보다 우수하다」로 일반화하지 않는다. 판정자가 **CTO 자신**이라는 편향도 그대로 남는다.

## 8. 품질
```
code **0** · tests **0** · 문서 1 · HTTP **0** · AI 수집 **0** · ₩0 · 배포 0
MI/threshold/색상사전/PRESUMED_SAME/Registry/Category/Sourcing/ensemble — 전부 0
typecheck **0 errors**
🔴 코드 변경이 0 이므로 전체 회귀를 재실행하지 않았다 —
   **직전 regression PASS(545 files / 7,857) · 이번 변경에서 코드 0.**
```

## 9. CEO Action — **NONE**
