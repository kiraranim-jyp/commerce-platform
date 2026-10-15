# WU-022-11 완료 보고 — AI 오류 taxonomy · D 최종 counterfactual

## 1. 완료 판정 — 🟢 **완료**. Q6 = **HOLD**

🔴 **분모를 먼저 고정한다**(이 보고의 모든 숫자가 여기에 걸린다):
```
cto(sonnet)   **51건 전수** 판정
opus · haiku  🔴 **27건**(MI UNCERTAIN) + 2건(022-10) 만 판정 — **51건을 본 적이 없다**
→ Q1 은 51 분모 · Q2/Q3 는 **27 분모**. 🔴 섞지 않는다.
```

## 2. Q1 — 51건 AI(cto) 오류 taxonomy
```
정상(GT 일치) **46** · 오류 **5** · UNCERTAIN 2
  A. Evidence 부족형 오류  **0**
  B. Evidence 충분 + reasoning 오류  **5**
  C. 합리적 UNCERTAIN  2   D. 정상  46
```
🔴🔴 **이것이 Q1 의 답이고 중요한 성질이다 — AI 오류 5건이 «전부 B(reasoning)» 다.**
샵이름·깨진 제목 같은 **evidence 부족 구간에서는 한 건도 틀리지 않았다**(그런 구간에서
AI 는 UNCERTAIN 을 냈다). 🔴 즉 AI 의 약점은 **정보 부족이 아니라 판단** 이다.

오류 5건 전수(전부 `GT DIFFERENT → AI SAME`):
```
S4 [[메인스토리] Bubble Sweatshirt _Conker Stripe #AW26MS185
S4 [메인스토리] AW26MS185 - Bubble Sweatshirt - Graystone
S4 [MAIN STORY]Bubble Sweatshirt - AW26MS185 - Graystone
S4 Bubble Sweatshirt - Graystone
S5 225 Pepe Shoes Vernice Nero
```
🟢 **방향이 한쪽뿐이다** — 5/5 전부 `SAME` 오판이고 `DIFFERENT` 오판은 **0건**.

## 3. Q2/Q3 — 3-AI 공통/개별 (🔴 분모 27)
| 공통도 | 사례 | 틀린 judge |
|---|---|---|
| **3/3** | S5 `225 Pepe Shoes Vernice Nero` | cto · opus · haiku |
| 2/3 | S4 `[MAIN STORY]… Graystone` | cto · haiku |
| 2/3 | S4 `Bubble Sweatshirt - Graystone` | cto · haiku |
| 1/3 | S4 `_Conker Stripe #AW26MS185` | cto |
| 1/3 | S4 `AW26MS185 - … Graystone` | cto |
| 1/3 | S2 `Baby Hug Hairy Monster T-Shirt` | haiku |

```
🔴 **3자 공통 오류 = 1건** (S5) — 022-10 에서 이미 UNKNOWN 으로 닫은 그 건이다
🟡 2/3 반복 = 2건 (둘 다 S4 Graystone 색상축)
🟢 opus 는 **27건 중 오류 0** 이다(이 분모에서)
🔴 「AI 전체의 구조적 한계」로 적지 않는다 — **현재 benchmark 27건에서 관찰된 공통 오류** 다
```

## 4. Q4 — AI(cto) × MI strict 교차 (51건)
| | MI 정답 | MI 오답 |
|---|---:|---:|
| **AI 정답** | 36 | 🟢 **10** |
| **AI 오답** | 🔴 **0** | 5 |

```
🟢🟢 **AI 오답 5건이 MI 오답 15건의 «부분집합» 이다** — AI 만 틀린 경우가 **0건**.
🟢 AI 가 단독으로 맞힌 10건이 있고, MI 가 단독으로 맞힌 건 **0건**.
🔴 그리고 둘 다 틀린 5건은 **전부 같은 방향(둘 다 SAME 오판)** 이다 — 검증했다.
→ 🔴🔴 **Q4 의 답: 보완적이지 «않다». AI 가 MI 를 포함한다(이 표본에서).**
   서로 다른 실수를 하는 것이 아니라 **MI 의 실수 일부를 AI 가 고치고, 나머지는 같이 틀린다.**
```
🔴 이것이 **ensemble 의 전제를 깬다** — 조합의 가치는 「서로 다른 실수」에서 오는데
이 표본에는 그 구조가 없다.

## 5. Q5 — D counterfactual (51건)
| 정책 | Precision | False SAME | **GT SAME 손실** | UNCERTAIN |
|---|---:|---:|---:|---:|
| A. MI threeWay | 1.000 | 0 | 1 | **27** |
| D / cto | 1.000 | 0 | 1 | 18 |
| **D / opus** | 1.000 | 0 | 1 | 🟢 **14** |
| D / haiku | 1.000 | 0 | 1 | 17 |
| D / 3자 만장일치 | 1.000 | 0 | 1 | 19 |

### D 의 실질 가치 — `A UNCERTAIN → D DIFFERENT` 로 줄어든 건의 GT
```
cto  −9  → GT DIFFERENT **9** · GT SAME **0**
opus −13 → GT DIFFERENT **13** · GT SAME **0**
haiku −10 → GT DIFFERENT **10** · GT SAME **0**
3자  −8  → GT DIFFERENT **8** · GT SAME **0**
🟢 **줄어든 건이 전부 GT DIFFERENT 다. 진짜 동일상품을 지운 건 0.**
```

## 6. D 안전성 요약
```
🟢 Precision 1.000 유지 · 🟢 False SAME 0 유지 · 🟢 GT SAME 추가 손실 **0**
🟢 UNCERTAIN 감소 실재(27 → 14~19) · 🟢 AI DIFFERENT 의 위험 신호 **0**(32/32)
→ §6 의 **「GO 후보 유지」 네 조건을 전부 충족** 한다
```

## 7. Q6 — D 운영 판정: 🔴 **HOLD**

🔴 **§6 의 GO 후보 조건은 충족됐지만, Q6(「production 으로 구현할 가치」)은 다른 질문이고
그 답은 HOLD 다.** 근거 넷:
```
① 🔴 **벤더 독립성 0** — cto/opus/haiku 전부 Anthropic 계열. 외부 AI 는 약관·비용으로 닫혀 있다
   (WU-021). 🔴 **운영에 쓰려면 어떤 AI 를 어떤 경로로 부를지가 먼저인데 그 경로가 없다.**
② 🔴 **분모가 작다** — AI DIFFERENT 판정이 judge 당 9~13건이고 전체 표본 51·원상품 6 이다
③ 🔴 **Q4 가 ensemble 전제를 깼다** — AI 오류가 MI 오류의 부분집합이라 「서로 보완」이 아니다.
   그러면 D 의 논리적 종착점은 「AI 단독」이고, AI 단독은 False SAME 5건을 낸다(022-6).
④ 🟢 **얻는 것이 Accuracy 가 아니다** — D 의 이득은 **보류 9~13건 감소** 하나다.
   그 대가로 **운영에 AI 호출 경로를 새로 들이는** 것은 비용·약관·복잡도가 이득보다 크다.
```
🟢 **그래서 D 는 「틀렸다」가 아니라 「지금 구현할 이유가 없다」** 다. 데이터는 안전하다고
말하지만 **그 안전을 제품에 배달할 경로가 없다.**

🔴🔴 **표현 제한**: 「n=51 · 원상품 6 · Anthropic 계열 judge 3(그중 2는 27건만)」의
counterfactual 이다. 「AI 가 MI 를 포함한다」도 **이 표본에서** 그렇다는 뜻이다.

## 8. 변경/품질
```
code **0** · Search **0** · HTTP **0** · AI/API **0** · 비용 **₩0** · deploy **0** · 문서 1
SKU rule/AI prompt/MI/threshold/색상사전/PRESUMED_SAME/D production/ensemble/
Category/Sourcing/Registry — 전부 **0**
typecheck **0 errors**
🔴 코드 변경 0 이라 regression 재실행 안 함 — **직전 PASS(545 files / 7,857) · 이번 코드 0**
worktree **clean** · origin/main **ahead 59 / behind 0**
```

## 9. CEO Action — **NONE**
