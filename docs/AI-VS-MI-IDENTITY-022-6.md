# WU-022-6 완료 보고 — AI Identity 정확도 실측

## 1. 측정 범위
```
고유 후보 **51** (WU-022-5-1 GT SAME/DIFFERENT 만) · 새 후보 0 · 새 Search 0 · HTTP **0**
🔴 분모 제외 — UNVERIFIED 22 · UNREACHABLE 17 (정상 GT 상태 · 「0」이 아니다)
🔴🔴 판정 주체 = **CTO 자신**(라벨 `cto-judge`). 사람 수집 Claude/Gemini/GPT 는 **미수집**.
   → §6 의 3모델 비교는 **측정불가**. 모델 우열을 말하지 않는다.
🟢 AI 에게 준 것 — 원상품 정보/URL · 후보 제목/URL. **GT 0 · MI 0 · 웹접속 0.**
```
🟢 **§12 선검증 PASS** — 022-4 하니스 11/11, `combine.length === 2`(price·tier·category·seller 미수용).

## 2. AI 수집 · 3. GT join
```
수집 51 · 🟢 거부 **0** · 🟢 AI_VERDICT_INVALID **0** · GT join **51/51**
분포 — SAME 29 · DIFFERENT 20 · UNCERTAIN 2
```

## 4·5. AI vs MI (같은 51건)
| | n | Accuracy | Precision | **False SAME** | missed |
|---|---:|---:|---:|---:|---:|
| **AI (cto-judge)** | 51 | 🟢 **0.902** | 0.828 | 🔴 **5** | 🟢 **0** |
| MI strict | 51 | 0.706 | 0.622 | 🔴 **14** | 1 |
| MI threeWay | 51 | 0.725 | 🟢 **1.000** | 🟢 **0** | 14 |

## 6. Agreement (AI × MI strict)
```
agreement **0.765** · AI=SAME/MI=SAME 28 · AI=SAME/MI≠SAME 1 ·
AI≠SAME/MI=SAME **9** · 둘 다 ≠SAME 13
bothCorrect **36** · **aiOnlyCorrect 10** · **miOnlyCorrect 0** · bothWrong 5
```
🔴🔴 **miOnlyCorrect = 0 이다.** 이 표본에서 **MI 가 맞고 AI 가 틀린 경우가 한 건도 없다.**

3×3(AI × MI threeWay): `AI_SAME/MI_UNCERTAIN` **18** · `AI_DIFFERENT/MI_UNCERTAIN` **9** ·
`AI_SAME/MI_SAME` 10 · `AI_DIFFERENT/MI_DIFFERENT` 11 · `AI_UNCERTAIN/MI_DIFFERENT` 2 · `AI_SAME/MI_DIFFERENT` 1
🟢 즉 불일치의 대부분이 **MI 의 「보류(UNCERTAIN)」를 AI 가 확정으로 가른 것**이다.

## 7·8. Disagreement · False SAME
```
Q1 AI 가 MI 의 strict False SAME 14건을 잡는가 → 🟢 **9/14 잡았다**(DIFFERENT)
   🔴 못 잡은 5건이 AI 의 False SAME 5건과 같은 집합이다
Q2 AI 가 MI 가 놓친 SAME 을 찾는가 → 🟢 **1/1 찾았다**
missed-SAME: AI **0** · MI strict 1 · MI threeWay 14
```
🔴🔴 **Q3 — AI 도 같은 색상 failure mode 를 갖는다**(S4 · GT DIFFERENT 9건):
```
🟢 AI DIFFERENT (정답) 5 — Blue Topaz · Chocolate Brown · Rose Shadow · Conker Stripe · Graystone
                           (전부 **영문 제목**, 색상이 또렷하다)
🔴 AI SAME   (오답) 4 — 「[메인스토리] … _Conker Stripe #AW26MS185」·「… Graystone」 ×3
                        (전부 **한글 쇼핑몰 제목 + 품번 표기**)
→ 🔴 AI 는 «품번이 제목에 보이면» 색상을 넘겨 SAME 으로 갔다. MI 와 **같은 실패 축**이다.
```
🔴 패킷에 미리 적은 **편향 단서**가 그대로 적용된다 — 제목에 색상이 있는데도 틀린 4건은
**강한 신호**이고, 맞힌 5건은 「쉬웠다」와 구분되지 않는 **약한 신호**다.

## 9. A/B/C 비교
| | Accuracy | Precision | False SAME | missed |
|---|---:|---:|---:|---:|
| A. MI only (strict) | 0.706 | 0.622 | 14 | 1 |
| A'. MI only (threeWay) | 0.725 | **1.000** | **0** | 14 |
| **B. AI only** | 🟢 **0.902** | 0.828 | 5 | **0** |
| C. AI+MI (vs strict) | 0.882 | 0.821 | 5 | 1 |
| C'. AI+MI (vs threeWay) | 0.725 | **1.000** | **0** | 14 |

🔴 **「조합이 최고」가 아니다.** 이 표본에서 Accuracy 는 **B(AI 단독) > C(조합) > A(MI)** 이고,
조합이 AI 단독을 **넘지 못했다**(0.882 < 0.902). 🟢 §8 지시대로 「둘이 같으니 좋다」로 쓰지 않았다.
🔴 그리고 **False SAME 0 을 원하면 여전히 A'(MI threeWay) 뿐**이다 — AI 는 5건을 낸다.

## 10. 모델 간 비교 가능성 — 🔴 **없다**
`cto-judge` 1개만 수집됐다. Claude/Gemini/GPT 사람 수집은 미실행이므로 §6 모델 비교는 **측정불가**.

## 11. 결론
```
AI          🟢 Accuracy 0.902 · missed-SAME 0 · MI 의 False SAME 9/14 를 잡는다
            🔴 그러나 **False SAME 5건** 을 스스로 만든다 · **색상 failure mode 를 공유** 한다
MI          🟢 threeWay 축 **Precision 1.000 / False SAME 0** — 「틀린 SAME 을 안 만든다」가 강점
            🔴 대신 14건을 **보류** 한다(Accuracy 손해)
Combination 🔴 이 표본에서 **AI 단독을 넘지 못했다**. production ensemble 근거 **부족**
```
🔴 **일반화 금지** — n=51 · 원상품 6 · 판정자 1(그리고 그 판정자가 CTO 자신이다).
🔴 PRESUMED_SAME 정책·threshold·색상사전 **변경 0**(§10·§11).

🟡 **다음에 가장 값싼 한 걸음** — AI 의 False SAME 5건과 MI 의 보류 14건이 **겹치지 않는 구간**이
있다. 그 구간만 보면 「MI 가 보류한 것을 AI 가 안전하게 가를 수 있는가」가 닫힌다. 🔴 CTO 가 고르지 않았다.

## 12. 변경/품질
```
code **0** · tests **0** · 문서 1 · HTTP **0** · AI API 0 · ₩0 · 배포 0
MI/threshold/색상사전/PRESUMED_SAME/Registry/Category/Sourcing/ensemble — 전부 0
typecheck **0 errors**
🔴 코드 변경 0 이라 전체 회귀를 새로 돌리지 않았다 —
   **직전 regression PASS(545 files / 7,857)이며 이번 변경에서 코드 0.**
   「재실행 PASS」로 적지 않는다.
```

## 13. CEO Action — **NONE**
