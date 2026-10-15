# WU-022-8 완료 보고 — AI 판정 독립성 검증

## 0. 🔴🔴 먼저 — **「독립 AI 모델」의 한계를 정확히 적는다**
```
🔴 외부 Gemini/GPT 를 **부를 수 없다** — §7·기존 금지(AI API 0 · 키 0 · 결제 0).
🟢 그래서 확보한 독립성은 **둘** 이다:
   ⒜ **다른 모델 가중치** — `opus` · `haiku` (기존 `cto-judge` 는 `sonnet`)
   ⒝ **완전히 분리된 컨텍스트** — cto-judge 결과·GT·MI 를 **일절 주지 않았다**
🔴 확보하지 «못한» 독립성:
   같은 **벤더(Anthropic) 모델 계열** 이고, 프롬프트 틀이 같고, 지시자가 같다.
   → **벤더 간 독립성은 여전히 미확보** 다. 「독립 AI 검증 완료」로 적지 않는다.
🔴 추가 Search 0 · 추가 후보 0 · GT 변경 0 · **HTTP 0** · 코드 0
```

## 1. 대상
WU-022-7 의 **MI threeWay = UNCERTAIN 27건** 그대로 (cto-judge 기준 SAME 18 · DIFFERENT 9).

## 2·3. 판정자 간 일치 (§3 최우선 비교)
| | cto 대비 일치 | **cto=D & X=D** | cto=S & X=D | 🔴 **cto=D & X=S** |
|---|---:|---:|---:|---:|
| **opus** | 23/27 (85%) | 🟢 **9/9** | 4 | 🟢 **0** |
| **haiku** | 24/27 (89%) | 8/9 | 2 | 🔴 **1** |

🟢 **「아니다」 방향이 모델 사이에서 거의 그대로 재현된다** — opus 는 9/9 전건 동의,
haiku 는 8/9. 🔴 haiku 가 1건을 SAME 으로 뒤집었다(단 그 1건도 아래 ④에서 GT 와 충돌하지 않는다).

## 4. 🟢🟢 핵심 — **세 판정자 모두 `DIFFERENT → GT SAME` 오판이 0건**
| 판정자 | DIFFERENT 수 | → GT DIFFERENT | 🔴 → **GT SAME(오판)** |
|---|---:|---:|---:|
| cto-judge (sonnet) | 9 | 9 | 🟢 **0** |
| **opus** | **13** | **13** | 🟢 **0** |
| **haiku** | 10 | 10 | 🟢 **0** |

🟢 **총 32번의 「아니다」 판정에서 진짜 동일상품을 지운 사례가 한 건도 없다.**
🔴 단 분모가 작다 — 9·13·10 이다. 「0%」가 아니라 **「이 표본에서 0건」** 이다.

## 5. D counterfactual 재계산 (n=51 동일 분모)
| 정책 | Accuracy | Precision | **False SAME** | missed | **UNCERTAIN** |
|---|---:|---:|---:|---:|---:|
| A. MI threeWay | 0.725 | 1.000 | 0 | 14 | **27** |
| D (cto-judge) | 0.725 | 1.000 | 🟢 **0** | 14 | 18 |
| **D (opus)** | 0.725 | 1.000 | 🟢 **0** | 14 | 🟢 **14** |
| D (haiku) | 0.725 | 1.000 | 🟢 **0** | 14 | 17 |
| D (3자 만장일치) | 0.725 | 1.000 | 🟢 **0** | 14 | 19 |

🟢 **네 변형 전부 False SAME 0 · Precision 1.000 을 유지했다.**
🔴 **Accuracy 는 어느 쪽도 오르지 않는다** — 이 지표 정의에서 `UNCERTAIN + GT DIFFERENT`
는 이미 「맞음」으로 세기 때문이다. **D 의 이득은 오직 「보류 감소」** 다(27 → 14~19).

## 6. 기존 False SAME 5건에서 독립 판정자는? (§6)
| | cto | opus | haiku | 축 |
|---|---|---|---|---|
| S4 Conker Stripe(한글+품번) | SAME❌ | 🟢 **DIFFERENT** | 🟢 **DIFFERENT** | 색상 |
| S4 Graystone(한글+품번) | SAME❌ | 🟢 **DIFFERENT** | 🟢 **DIFFERENT** | 색상 |
| S4 Graystone(영문 대문자) | SAME❌ | 🟢 **DIFFERENT** | SAME❌ | 색상 |
| S4 Graystone | SAME❌ | 🟢 **DIFFERENT** | SAME❌ | 색상 |
| **S5 225 Pepe Vernice Nero** | SAME❌ | **SAME❌** | **SAME❌** | 🔴 **모델** |

🔴🔴 **두 축이 갈렸다 — 이것이 이번 WU 의 가장 중요한 발견이다**:
```
🟢 **색상 축**(S4 4건) — opus 는 **4/4 전부 잡았다**. haiku 는 2/4.
   → 색상 failure mode 는 **판정자 개인의 것이지 AI 공통이 아니다.**
🔴 **모델 축**(S5 「225 Pepe Shoes Vernice Nero」) — **세 판정자 전부 SAME 으로 틀렸다.**
   원상품은 Lulu T-Bar **01195**, 후보는 **225** 다. 브랜드·색상명이 같아 셋 다 넘어갔다.
   → 🔴 **이것은 AI 공통 failure mode 다.** 그리고 MI 도 PRESUMED_SAME 으로 못 갈랐다.
```
🟢 색상사전·MI·AI 로직 **변경 0**.

## 7. 결론 — **D = 🟡 GO 후보로 승격** (운영 채택은 아님)

§5 채택 기준 대조:
```
🟢 「AI DIFFERENT → GT DIFFERENT 유지」      → 3/3 판정자 · 32/32 건 충족
🟢 「AI DIFFERENT → GT SAME 사례 없음」       → **0건** 충족
🟢 「False SAME 0 유지」                      → 네 변형 전부 충족
→ §5 의 **GO 후보 조건을 전부 만족** 한다 → **「다음 단계 실험 대상으로 승격」**
```
🔴 **그러나 운영 정책으로 채택하지 않았다**(§7 금지 · ensemble/fallback 구현 **0**). 이유 셋:
```
① 🔴 **벤더 독립성 미확보** — 셋 다 Anthropic 계열이다. Gemini/GPT 에서 재현되는지는 미측정.
② 🔴 **분모가 작다** — 「아니다」 판정이 판정자당 9~13건이다.
③ 🔴 **S5 가 남는다** — 모델 축(225 ≠ 1195)은 **세 판정자 + MI 가 전부 실패** 했다.
   D 는 그 실패를 «고치지 못한다»(D 는 DIFFERENT 만 채택하므로 SAME 오판을 그대로 둔다).
   🟢 다행히 D 에서는 그 건이 **UNCERTAIN 으로 남아** False SAME 이 되지 않는다.
```

🔴🔴 **표현 제한 — 이 문장을 그대로 쓴다**:
> 「**n=51(그중 UNCERTAIN 27) · 원상품 6건 · Anthropic 계열 판정자 3개**의 counterfactual 이다.
> 벤더 간 독립성은 확보하지 못했다.」

## 8. 품질
```
code **0** · tests **0** · 문서 1 · HTTP **0** · AI API 0 · 새 Search 0 · ₩0 · 배포 0
ensemble/fallback/MI/threshold/색상사전/PRESUMED_SAME/Category/Sourcing — 전부 0
typecheck **0 errors**
🔴 코드 변경 0 이라 전체 회귀를 재실행하지 않았다 —
   **직전 regression PASS(545 files / 7,857) · 이번 변경에서 코드 0.**
```

## 9. CEO Action — **NONE**
